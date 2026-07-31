import { createHash } from 'node:crypto';
import type { ClientSession } from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { paise } from '../utils/money.js';
import { withMongoTransaction } from '../utils/transaction.js';
import {
  Customer,
  GoldRate,
  IdempotencyRecord,
  Payment,
  ReceiptCounter,
  SchemeEnrollment,
} from '../models/index.js';
import { activeGoldRate, getPaymentRules, goldWeightMg } from './scheme.service.js';
import { audit, outbox, type AuditContext } from './audit.service.js';

export type ManualPaymentInput = {
  customerId: string;
  schemeId: string;
  amountPaise: number;
  method: 'CASH' | 'UPI' | 'BANK' | 'CARD';
  paymentDate: Date;
  referenceNumber?: string;
  notes?: string;
  idempotencyKey: string;
};
const requestHash = (input: unknown) =>
  createHash('sha256').update(JSON.stringify(input)).digest('hex');
export async function allocateReceiptNumber(session: ClientSession, date: Date) {
  const year = date.getFullYear();
  const counter = await ReceiptCounter.findOneAndUpdate(
    { scope: `PAYMENT-${year}` },
    { $inc: { value: 1 } },
    { upsert: true, new: true, session, setDefaultsOnInsert: true },
  );
  return `NKS-${year}-${String(counter.value).padStart(7, '0')}`;
}
async function reserveIdempotency(
  session: ClientSession,
  actorId: string,
  route: string,
  key: string,
  input: unknown,
) {
  const hash = requestHash(input);
  const existing = await IdempotencyRecord.findOne({ actorId, route, key }).session(session);
  if (existing) {
    if (existing.requestHash !== hash)
      throw new AppError(
        'IDEMPOTENCY_KEY_REUSED',
        'Idempotency key was reused with different data',
        409,
      );
    if (existing.state === 'COMPLETED') return existing;
    throw new AppError(
      'PAYMENT_ALREADY_PROCESSED',
      'This request is already processing',
      409,
      true,
    );
  }
  return IdempotencyRecord.create(
    [{ actorId, route, key, requestHash: hash, expiresAt: new Date(Date.now() + 86400000) }],
    { session },
  ).then((x: any[]) => x[0]);
}
export async function createManualPayment(
  input: ManualPaymentInput,
  context: AuditContext & { actorId: string; actorRole: 'ADMIN' | 'STAFF' },
) {
  paise(input.amountPaise);
  return withMongoTransaction(async (session) => {
    const idem = await reserveIdempotency(
      session,
      context.actorId,
      'manual-payment',
      input.idempotencyKey,
      input,
    );
    if (idem.state === 'COMPLETED') return idem.responseBody;
    const customer = await Customer.findById(input.customerId).session(session);
    if (!customer) throw new AppError('CUSTOMER_NOT_FOUND', 'Customer not found', 404);
    const rules = await getPaymentRules(
      input.schemeId,
      input.paymentDate,
      input.amountPaise,
      session,
    );
    if (String(rules.enrollment.customerId) !== input.customerId)
      throw new AppError(
        'SCHEME_OWNERSHIP_MISMATCH',
        'Scheme does not belong to this customer',
        403,
      );
    let gold: any = {};
    if (rules.enrollment.schemeType === 'GOLD_WEIGHT') {
      const rate = await activeGoldRate(input.paymentDate, session);
      gold = {
        goldRateId: rate._id,
        goldRatePerGramPaise: rate.ratePerGramPaise,
        goldPurity: rate.purity,
        goldWeightMg: goldWeightMg(input.amountPaise, rate.ratePerGramPaise),
      };
      await GoldRate.updateOne({ _id: rate._id }, { $inc: { usageCount: 1 } }, { session });
    }
    const receipt = await allocateReceiptNumber(session, input.paymentDate);
    const [payment] = await Payment.create(
      [
        {
          ...input,
          status: 'SUCCESS',
          schemeMonth: rules.schemeMonth,
          receiptNumber: receipt,
          collectedBy: context.actorId,
          collectorRole: context.actorRole,
          createdBy: context.actorId,
          ...gold,
        },
      ],
      { session },
    );
    const enrollmentUpdate = await SchemeEnrollment.updateOne(
      { _id: rules.enrollment._id, __v: rules.enrollment.__v },
      {
        $inc: { totalPaidPaise: input.amountPaise, totalGoldWeightMg: gold.goldWeightMg ?? 0 },
        $set: rules.capPaise !== null ? { averageMonthlyCapPaise: rules.capPaise } : {},
      },
      { session },
    );
    if (enrollmentUpdate.modifiedCount !== 1) {
      throw new AppError(
        'ENROLLMENT_CONCURRENTLY_UPDATED',
        'The scheme changed while collecting payment. Retry with a fresh preview.',
        409,
        true,
      );
    }
    await audit(
      session,
      context,
      'PAYMENT_CREATED',
      'Payment',
      payment._id,
      undefined,
      payment.toObject(),
    );
    await outbox(session, 'PAYMENT_RECEIPT_READY', 'Payment', payment._id, {
      paymentId: payment._id,
      customerId: customer._id,
      receiptNumber: receipt,
    });
    const response = {
      paymentId: payment._id,
      receiptNumber: receipt,
      amountPaise: input.amountPaise,
      method: input.method,
      paymentDate: input.paymentDate,
      status: 'SUCCESS',
      schemeMonth: rules.schemeMonth,
      ...gold,
    };
    await IdempotencyRecord.updateOne(
      { _id: idem._id },
      { state: 'COMPLETED', responseStatus: 201, responseBody: response },
      { session },
    );
    return response;
  }, context.requestId);
}

export async function finalizeGatewayPayment(
  intent: any,
  provider: { transactionId?: string; amountPaise: number },
  context: AuditContext,
) {
  return withMongoTransaction(async (session) => {
    const existing = await Payment.findOne({
      merchantTransactionId: intent.merchantTransactionId,
    }).session(session);
    if (existing) return existing;
    if (provider.amountPaise !== intent.amountPaise)
      throw new AppError(
        'GATEWAY_AMOUNT_MISMATCH',
        'Gateway amount does not match payment intent',
        409,
      );
    const rules = await getPaymentRules(
      String(intent.schemeId),
      new Date(),
      intent.amountPaise,
      session,
    );
    let gold: any = {};
    if (rules.enrollment.schemeType === 'GOLD_WEIGHT') {
      const lockedRate = intent.goldRatePerGramPaise;
      const lockedWeight = intent.goldWeightMg;
      const lockedPurity = intent.goldPurity ?? '916';
      if (lockedRate && lockedWeight != null) {
        const expectedWeight = goldWeightMg(intent.amountPaise, lockedRate);
        gold = {
          goldRateId: intent.goldRateId,
          goldRatePerGramPaise: lockedRate,
          goldPurity: lockedPurity,
          goldWeightMg: lockedWeight,
        };
        if (expectedWeight !== lockedWeight)
          throw new AppError(
            'QUOTE_WEIGHT_MISMATCH',
            'Stored gold quote does not match the payment amount',
            409,
          );
        if (intent.goldRateId)
          await GoldRate.updateOne(
            { _id: intent.goldRateId },
            { $inc: { usageCount: 1 } },
            { session },
          );
      } else {
        const rate = await activeGoldRate(new Date(), session);
        gold = {
          goldRateId: rate._id,
          goldRatePerGramPaise: rate.ratePerGramPaise,
          goldPurity: rate.purity,
          goldWeightMg: goldWeightMg(intent.amountPaise, rate.ratePerGramPaise),
        };
        await GoldRate.updateOne({ _id: rate._id }, { $inc: { usageCount: 1 } }, { session });
      }
    }
    const receipt = await allocateReceiptNumber(session, new Date());
    const [payment] = await Payment.create(
      [
        {
          customerId: intent.customerId,
          schemeId: intent.schemeId,
          amountPaise: intent.amountPaise,
          method: 'UPI',
          status: 'SUCCESS',
          paymentDate: new Date(),
          schemeMonth: rules.schemeMonth,
          receiptNumber: receipt,
          merchantTransactionId: intent.merchantTransactionId,
          providerTransactionId: provider.transactionId,
          collectedBy: intent.collectedBy,
          collectorRole: intent.collectorRole ?? 'CUSTOMER',
          createdBy: intent.createdBy,
          ...gold,
        },
      ],
      { session },
    );
    await SchemeEnrollment.updateOne(
      { _id: rules.enrollment._id },
      {
        $inc: { totalPaidPaise: intent.amountPaise, totalGoldWeightMg: gold.goldWeightMg ?? 0 },
        $set: rules.capPaise !== null ? { averageMonthlyCapPaise: rules.capPaise } : {},
      },
      { session },
    );
    intent.status = 'SUCCESS';
    await intent.save({ session });
    await audit(
      session,
      context,
      'PHONEPE_PAYMENT_FINALIZED',
      'Payment',
      payment._id,
      undefined,
      payment.toObject(),
    );
    await outbox(session, 'PAYMENT_RECEIPT_READY', 'Payment', payment._id, {
      paymentId: payment._id,
      customerId: intent.customerId,
      receiptNumber: receipt,
    });
    return payment;
  }, context.requestId);
}
