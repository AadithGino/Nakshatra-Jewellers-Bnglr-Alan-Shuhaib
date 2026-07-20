import { AppError } from '../utils/AppError.js';
import { withMongoTransaction } from '../utils/transaction.js';
import {
  CashSubmission,
  Customer,
  Payment,
  PaymentCorrection,
  Payout,
  SchemeEnrollment,
} from '../models/index.js';
import { audit, outbox, type AuditContext } from './audit.service.js';
import mongoose from 'mongoose';
import { activeGoldRate, getPaymentRules, goldWeightMg } from './scheme.service.js';
import { allocateReceiptNumber } from './payment.service.js';
import { GoldRate } from '../models/index.js';

export async function listPayments(page: number, limit: number) {
  const [items, total] = await Promise.all([
    Payment.find()
      .sort({ paymentDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Payment.countDocuments(),
  ]);

  return { items, total };
}

export const listCashSubmissions = () => CashSubmission.find().sort({ submissionDate: -1 }).lean();

export const listPayouts = () => Payout.find().sort({ payoutDate: -1 }).lean();

export const listCorrections = () => PaymentCorrection.find().sort({ createdAt: -1 }).lean();

export async function staffCashBalance(staffId: string, session?: any) {
  const staffObjectId = new mongoose.Types.ObjectId(staffId);
  const [payments, submissions] = await Promise.all([
    Payment.aggregate([
      {
        $match: {
          collectedBy: staffObjectId,
          collectorRole: 'STAFF',
          method: 'CASH',
          status: 'SUCCESS',
        },
      },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]).session(session ?? null),
    CashSubmission.aggregate([
      { $match: { staffId: staffObjectId, status: 'SUCCESS' } },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]).session(session ?? null),
  ]);
  return (payments[0]?.total ?? 0) - (submissions[0]?.total ?? 0);
}
export async function submitCash(
  input: { staffId: string; amountPaise: number; submissionDate: Date; notes?: string },
  context: AuditContext & { actorId: string },
) {
  return withMongoTransaction(async (session) => {
    const available = await staffCashBalance(input.staffId, session);
    if (input.amountPaise <= 0 || input.amountPaise > available)
      throw new AppError(
        'INSUFFICIENT_STAFF_CASH',
        'Cash submission exceeds available staff cash',
        409,
        false,
        [{ availablePaise: available }],
      );
    const [record] = await CashSubmission.create(
      [{ ...input, receivedBy: context.actorId, createdBy: context.actorId }],
      { session },
    );
    await audit(
      session,
      context,
      'CASH_SUBMITTED',
      'CashSubmission',
      record._id,
      undefined,
      record.toObject(),
    );
    await outbox(session, 'CASH_SUBMITTED', 'CashSubmission', record._id, {
      staffId: input.staffId,
      amountPaise: input.amountPaise,
    });
    return record;
  }, context.requestId);
}
export async function reversePayment(
  paymentId: string,
  reason: string,
  context: AuditContext & { actorId: string },
) {
  return withMongoTransaction(async (session) => {
    const payment = await Payment.findOne({ _id: paymentId, status: 'SUCCESS' }).session(session);
    if (!payment)
      throw new AppError(
        'PAYMENT_NOT_REVERSIBLE',
        'Successful payment not found or already reversed',
        409,
      );
    const before = payment.toObject();
    payment.status = 'REVERSED';
    payment.reversedAt = new Date();
    payment.reversedBy = context.actorId;
    payment.reversalReason = reason;
    await payment.save({ session });
    await SchemeEnrollment.updateOne(
      { _id: payment.schemeId },
      {
        $inc: {
          totalPaidPaise: -payment.amountPaise,
          totalGoldWeightMg: -(payment.goldWeightMg ?? 0),
        },
      },
      { session },
    );
    await audit(
      session,
      context,
      'PAYMENT_REVERSED',
      'Payment',
      payment._id,
      before,
      payment.toObject(),
    );
    await outbox(session, 'PAYMENT_REVERSED', 'Payment', payment._id, { paymentId: payment._id });
    return payment;
  }, context.requestId);
}
export async function createPayout(
  input: {
    customerId: string;
    schemeId: string;
    payoutDate: Date;
    referenceNumber?: string;
    notes?: string;
  } & ({ payoutType: 'REDEEM' } | { payoutType: 'PAYOUT'; method: 'CASH' | 'UPI' | 'BANK' }),
  context: AuditContext & { actorId: string },
) {
  return withMongoTransaction(async (session) => {
    const [customer, scheme] = await Promise.all([
      Customer.findById(input.customerId).session(session),
      SchemeEnrollment.findById(input.schemeId).session(session),
    ]);
    if (!customer || !scheme || String(scheme.customerId) !== input.customerId)
      throw new AppError('SCHEME_NOT_FOUND', 'Customer scheme not found', 404);
    if (['REDEEMED', 'CLOSED', 'WITHDRAWN'].includes(scheme.status))
      throw new AppError('SCHEME_ALREADY_SETTLED', 'Scheme is already settled', 409);
    const availablePaise = scheme.totalPaidPaise - scheme.totalPayoutPaise;
    if (availablePaise <= 0)
      throw new AppError(
        'INSUFFICIENT_SCHEME_BALANCE',
        'This scheme has no remaining amount available for settlement',
        409,
        false,
        [{ availablePaise }],
      );
    if (input.payoutType === 'REDEEM' && scheme.schemeType !== 'GOLD_WEIGHT')
      throw new AppError(
        'GOLD_REDEMPTION_NOT_AVAILABLE',
        'Gold redemption is available only for gold schemes',
        409,
      );
    if (input.payoutType === 'REDEEM' && scheme.totalGoldWeightMg <= 0)
      throw new AppError(
        'NO_GOLD_AVAILABLE',
        'This scheme has no accumulated gold available to redeem',
        409,
      );

    const settlement = {
      ...input,
      amountPaise: availablePaise,
      goldWeightMg: input.payoutType === 'REDEEM' ? scheme.totalGoldWeightMg : 0,
      method: input.payoutType === 'REDEEM' ? 'GOLD' : input.method,
      createdBy: context.actorId,
    };
    const [payout] = await Payout.create([settlement], { session });
    const status = input.payoutType === 'REDEEM' ? 'REDEEMED' : 'WITHDRAWN';
    await SchemeEnrollment.updateOne(
      { _id: scheme._id },
      {
        $inc: { totalPayoutPaise: availablePaise },
        $set: { status },
        $push: {
          statusHistory: {
            status,
            at: new Date(),
            actorId: context.actorId,
            reason:
              input.payoutType === 'REDEEM'
                ? `Redeemed ${scheme.totalGoldWeightMg} mg of accumulated gold`
                : `Paid out ${availablePaise} paise`,
          },
        },
      },
      { session },
    );
    await audit(
      session,
      context,
      'PAYOUT_CREATED',
      'Payout',
      payout._id,
      undefined,
      payout.toObject(),
    );
    await outbox(session, 'PAYOUT_CREATED', 'Payout', payout._id, {
      customerId: customer._id,
      schemeId: scheme._id,
      payoutType: input.payoutType,
      amountPaise: availablePaise,
      goldWeightMg: settlement.goldWeightMg,
    });
    return payout;
  }, context.requestId);
}
export async function requestCorrection(
  paymentId: string,
  input: any,
  context: AuditContext & { actorId: string },
) {
  return withMongoTransaction(async (session) => {
    const [payment, pending] = await Promise.all([
      Payment.findOne({
        _id: paymentId,
        collectedBy: context.actorId,
        status: 'SUCCESS',
      }).session(session),
      PaymentCorrection.findOne({
        paymentId,
        requestedBy: context.actorId,
        status: 'PENDING',
      }).session(session),
    ]);
    if (!payment) throw new AppError('PAYMENT_NOT_FOUND', 'Eligible payment not found', 404);
    if (pending)
      throw new AppError(
        'CORRECTION_ALREADY_PENDING',
        'This payment already has a pending correction request',
        409,
      );
    const [correction] = await PaymentCorrection.create(
      [
        {
          paymentId,
          requestedBy: context.actorId,
          correctionType: input.correctionType,
          originalSnapshot: payment.toObject(),
          requestedChanges: input.requestedChanges,
          reason: input.reason,
        },
      ],
      { session },
    );
    await audit(
      session,
      context,
      'CORRECTION_REQUESTED',
      'PaymentCorrection',
      correction._id,
      undefined,
      correction.toObject(),
    );
    await outbox(session, 'CORRECTION_REQUESTED', 'PaymentCorrection', correction._id, {
      paymentId: payment._id,
      requestedBy: context.actorId,
    });
    return correction;
  }, context.requestId);
}
export async function reviewCorrection(
  correctionId: string,
  decision: 'APPROVED' | 'REJECTED',
  reviewNotes: string,
  context: AuditContext & { actorId: string },
) {
  return withMongoTransaction(async (session) => {
    const correction = await PaymentCorrection.findOne({
      _id: correctionId,
      status: 'PENDING',
    }).session(session);
    if (!correction)
      throw new AppError('CORRECTION_NOT_FOUND', 'Pending correction not found', 404);
    if (decision === 'REJECTED') {
      correction.status = 'REJECTED';
      correction.reviewedBy = context.actorId;
      correction.reviewedAt = new Date();
      correction.reviewNotes = reviewNotes;
      await correction.save({ session });
      await audit(
        session,
        context,
        'CORRECTION_REJECTED',
        'PaymentCorrection',
        correction._id,
        undefined,
        correction.toObject(),
      );
      return correction;
    }
    const payment = await Payment.findOne({ _id: correction.paymentId, status: 'SUCCESS' }).session(
      session,
    );
    if (!payment)
      throw new AppError('PAYMENT_NOT_REVERSIBLE', 'Original payment is no longer eligible', 409);
    const before = payment.toObject();
    payment.status = 'REVERSED';
    payment.reversedAt = new Date();
    payment.reversedBy = context.actorId;
    payment.reversalReason = `Approved correction ${correction._id}`;
    await payment.save({ session });
    await SchemeEnrollment.updateOne(
      { _id: payment.schemeId },
      {
        $inc: {
          totalPaidPaise: -payment.amountPaise,
          totalGoldWeightMg: -(payment.goldWeightMg ?? 0),
        },
      },
      { session },
    );
    let replacement: any = null;
    if (correction.correctionType !== 'REVERSE_PAYMENT') {
      const changes = correction.requestedChanges ?? {};
      const amountPaise =
        correction.correctionType === 'CHANGE_AMOUNT'
          ? Number(changes.amountPaise)
          : payment.amountPaise;
      const method =
        correction.correctionType === 'CHANGE_METHOD' ? String(changes.method) : payment.method;
      const paymentDate =
        correction.correctionType === 'CHANGE_DATE'
          ? new Date(changes.paymentDate)
          : payment.paymentDate;
      if (
        !Number.isSafeInteger(amountPaise) ||
        amountPaise <= 0 ||
        !['CASH', 'UPI', 'BANK', 'CARD'].includes(method) ||
        Number.isNaN(paymentDate.getTime())
      )
        throw new AppError('INVALID_CORRECTION', 'Requested correction is invalid', 422);
      const rules = await getPaymentRules(
        String(payment.schemeId),
        paymentDate,
        amountPaise,
        session,
      );
      let gold: any = {};
      if (rules.enrollment.schemeType === 'GOLD_WEIGHT') {
        const rate = await activeGoldRate(paymentDate, session);
        gold = {
          goldRateId: rate._id,
          goldRatePerGramPaise: rate.ratePerGramPaise,
          goldPurity: rate.purity,
          goldWeightMg: goldWeightMg(amountPaise, rate.ratePerGramPaise),
        };
        await GoldRate.updateOne({ _id: rate._id }, { $inc: { usageCount: 1 } }, { session });
      }
      const [created] = await Payment.create(
        [
          {
            customerId: payment.customerId,
            schemeId: payment.schemeId,
            amountPaise,
            method,
            status: 'SUCCESS',
            paymentDate,
            schemeMonth: rules.schemeMonth,
            receiptNumber: await allocateReceiptNumber(session, paymentDate),
            referenceNumber:
              correction.correctionType === 'CHANGE_REFERENCE'
                ? changes.referenceNumber
                : payment.referenceNumber,
            notes: correction.correctionType === 'CHANGE_NOTES' ? changes.notes : payment.notes,
            collectedBy: payment.collectedBy,
            collectorRole: payment.collectorRole,
            supersedesPaymentId: payment._id,
            correctionId: correction._id,
            createdBy: context.actorId,
            ...gold,
          },
        ],
        { session },
      );
      await SchemeEnrollment.updateOne(
        { _id: payment.schemeId },
        { $inc: { totalPaidPaise: amountPaise, totalGoldWeightMg: gold.goldWeightMg ?? 0 } },
        { session },
      );
      replacement = created;
    }
    correction.status = 'APPROVED';
    correction.reviewedBy = context.actorId;
    correction.reviewedAt = new Date();
    correction.reviewNotes = reviewNotes;
    await correction.save({ session });
    await audit(
      session,
      context,
      'CORRECTION_APPROVED',
      'PaymentCorrection',
      correction._id,
      before,
      { correction: correction.toObject(), replacementPaymentId: replacement?._id },
    );
    await outbox(session, 'PAYMENT_CORRECTED', 'PaymentCorrection', correction._id, {
      originalPaymentId: payment._id,
      replacementPaymentId: replacement?._id,
    });
    return { correction, replacement };
  }, context.requestId);
}
