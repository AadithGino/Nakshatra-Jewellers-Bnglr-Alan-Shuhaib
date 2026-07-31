import { createHash, randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import {
  Customer,
  Payment,
  PaymentGatewayEvent,
  PaymentIntent,
  SchemeEnrollment,
  SystemSetting,
  User,
} from '../models/index.js';
import { getPaymentRules, PAYMENT_QUOTE_TTL_MS } from './scheme.service.js';
import { finalizeGatewayPayment } from './payment.service.js';
import { phonePeProvider } from './phonepe.provider.js';

type InitiatePhonePeInput = {
  schemeId: string;
  amountPaise: number;
  idempotencyKey: string;
};

async function assertGatewayEnabled() {
  const settings = await SystemSetting.findOne({ singletonKey: 'GLOBAL' })
    .select('customerPhonePeEnabled')
    .lean();
  if (settings?.customerPhonePeEnabled === false)
    throw new AppError(
      'CUSTOMER_PAYMENTS_DISABLED',
      'Customer PhonePe payments are temporarily disabled',
      503,
      true,
    );
}

function paymentIntentPayload(intent: any) {
  return {
    merchantTransactionId: intent.merchantTransactionId,
    checkoutUrl: intent.checkoutUrl,
    status: intent.status,
    quoteExpiresAt: intent.quoteExpiresAt,
    expiresAt: intent.expiresAt,
    goldRatePerGramPaise: intent.goldRatePerGramPaise ?? null,
    goldWeightMg: intent.goldWeightMg ?? null,
    goldPurity: intent.goldPurity ?? null,
  };
}

export async function initiatePhonePe(
  userId: string,
  input: InitiatePhonePeInput,
  requestId: string,
) {
  await assertGatewayEnabled();
  const customer = await Customer.findOne({ userId });
  if (!customer) throw new AppError('CUSTOMER_NOT_FOUND', 'Customer profile not found', 404);
  const scheme = await SchemeEnrollment.findOne({
    _id: input.schemeId,
    customerId: customer._id,
  }).populate('schemePlanId');
  if (!scheme) throw new AppError('SCHEME_NOT_FOUND', 'Owned scheme not found', 404);
  if (scheme.status !== 'ACTIVE')
    throw new AppError('SCHEME_NOT_ACTIVE', 'Scheme is not active', 409);

  const quotedAt = new Date();
  const rules = await getPaymentRules(input.schemeId, quotedAt, input.amountPaise);
  const minimumPaymentPaise = Number((scheme.schemePlanId as any)?.minimumPaymentPaise ?? 100);
  if (input.amountPaise < minimumPaymentPaise)
    throw new AppError(
      'VALIDATION_ERROR',
      `Minimum accepted payment is ₹${(minimumPaymentPaise / 100).toFixed(2)}`,
      422,
    );
  if (scheme.schemeType === 'GOLD_WEIGHT' && !rules.goldRatePerGramPaise)
    throw new AppError(
      'GOLD_RATE_NOT_AVAILABLE',
      'No gold rate is active for the payment time',
      409,
    );

  const existing = await PaymentIntent.findOne({
    customerId: customer._id,
    idempotencyKey: input.idempotencyKey,
  });
  if (existing) return paymentIntentPayload(existing);

  const user = await User.findById(userId);
  if (!user) throw new AppError('USER_NOT_FOUND', 'Customer login account not found', 404);
  const merchantTransactionId = `NKS-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const quoteExpiresAt = new Date(quotedAt.getTime() + PAYMENT_QUOTE_TTL_MS);
  const intent = await PaymentIntent.create({
    customerId: customer._id,
    schemeId: scheme._id,
    amountPaise: input.amountPaise,
    merchantTransactionId,
    idempotencyKey: input.idempotencyKey,
    createdBy: userId,
    goldRateId: rules.goldRateId ?? undefined,
    goldRatePerGramPaise: rules.goldRatePerGramPaise ?? undefined,
    goldWeightMg: rules.goldWeightMg ?? undefined,
    goldPurity: rules.goldPurity ?? undefined,
    quoteCreatedAt: quotedAt,
    quoteExpiresAt,
    collectedBy: userId,
    collectorRole: 'CUSTOMER',
  });
  try {
    const checkout = await phonePeProvider.createPayment({
      merchantOrderId: merchantTransactionId,
      amountPaise: input.amountPaise,
      redirectUrl: `${env.PHONEPE_REDIRECT_URL}?order=${merchantTransactionId}`,
      customerPhone: user.phone,
      customerId: String(customer._id),
      schemeId: String(scheme._id),
    });
    intent.providerOrderId = checkout.providerOrderId;
    intent.checkoutUrl = checkout.redirectUrl;
    intent.expiresAt = checkout.expiresAt;
    intent.status = 'PENDING';
    await intent.save();
    return paymentIntentPayload(intent);
  } catch (error) {
    intent.status = 'FAILED';
    await intent.save();
    throw error;
  }
}

export async function initiateStaffPhonePe(
  staffUserId: string,
  input: InitiatePhonePeInput & { customerId: string },
) {
  await assertGatewayEnabled();
  const [customer, scheme] = await Promise.all([
    Customer.findById(input.customerId).populate('userId', 'phone'),
    SchemeEnrollment.findOne({
      _id: input.schemeId,
      customerId: input.customerId,
      status: 'ACTIVE',
    }).populate('schemePlanId'),
  ]);
  if (!customer) throw new AppError('CUSTOMER_NOT_FOUND', 'Customer profile not found', 404);
  if (!scheme) throw new AppError('SCHEME_NOT_FOUND', 'Owned scheme not found', 404);

  const quotedAt = new Date();
  const rules = await getPaymentRules(String(scheme._id), quotedAt, input.amountPaise);
  const minimumPaymentPaise = Number((scheme.schemePlanId as any)?.minimumPaymentPaise ?? 100);
  if (input.amountPaise < minimumPaymentPaise)
    throw new AppError(
      'VALIDATION_ERROR',
      `Minimum accepted payment is ₹${(minimumPaymentPaise / 100).toFixed(2)}`,
      422,
    );
  if (scheme.schemeType === 'GOLD_WEIGHT' && !rules.goldRatePerGramPaise)
    throw new AppError(
      'GOLD_RATE_NOT_AVAILABLE',
      'No gold rate is active for the payment time',
      409,
    );

  const existing = await PaymentIntent.findOne({
    customerId: customer._id,
    idempotencyKey: input.idempotencyKey,
    createdBy: staffUserId,
    collectorRole: 'STAFF',
  });
  if (existing) return paymentIntentPayload(existing);

  const merchantTransactionId = `NKS-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const quoteExpiresAt = new Date(quotedAt.getTime() + PAYMENT_QUOTE_TTL_MS);
  const intent = await PaymentIntent.create({
    customerId: customer._id,
    schemeId: scheme._id,
    amountPaise: input.amountPaise,
    merchantTransactionId,
    idempotencyKey: input.idempotencyKey,
    createdBy: staffUserId,
    collectedBy: staffUserId,
    collectorRole: 'STAFF',
    goldRateId: rules.goldRateId ?? undefined,
    goldRatePerGramPaise: rules.goldRatePerGramPaise ?? undefined,
    goldWeightMg: rules.goldWeightMg ?? undefined,
    goldPurity: rules.goldPurity ?? undefined,
    quoteCreatedAt: quotedAt,
    quoteExpiresAt,
  });

  try {
    const checkout = await phonePeProvider.createPayment({
      merchantOrderId: merchantTransactionId,
      amountPaise: input.amountPaise,
      redirectUrl: `${env.PHONEPE_REDIRECT_URL}?order=${merchantTransactionId}`,
      customerPhone: String((customer.userId as any)?.phone ?? ''),
      customerId: String(customer._id),
      schemeId: String(scheme._id),
    });
    intent.providerOrderId = checkout.providerOrderId;
    intent.checkoutUrl = checkout.redirectUrl;
    intent.expiresAt = checkout.expiresAt;
    intent.status = 'PENDING';
    await intent.save();
    return paymentIntentPayload(intent);
  } catch (error) {
    intent.status = 'FAILED';
    await intent.save();
    throw error;
  }
}

export async function getStaffPaymentIntent(staffUserId: string, orderId: string) {
  const intent = await PaymentIntent.findOne({
    merchantTransactionId: orderId,
    createdBy: staffUserId,
    collectorRole: 'STAFF',
  })
    .select(
      'merchantTransactionId status expiresAt quoteExpiresAt checkoutUrl amountPaise goldRatePerGramPaise goldWeightMg goldPurity',
    )
    .lean();
  if (!intent) throw new AppError('PAYMENT_INTENT_NOT_FOUND', 'Payment attempt not found', 404);
  const payment =
    intent.status === 'SUCCESS'
      ? await Payment.findOne({
          merchantTransactionId: orderId,
          collectedBy: staffUserId,
          collectorRole: 'STAFF',
        })
          .select(
            '_id receiptNumber amountPaise paymentDate status method referenceNumber goldRatePerGramPaise goldWeightMg goldPurity',
          )
          .lean()
      : null;
  return { ...intent, payment };
}

export async function processPhonePeWebhook(
  authorization: string | undefined,
  rawBody: Buffer,
  requestId: string,
) {
  const verified = phonePeProvider.verifyWebhook(authorization, rawBody);
  const payloadHash = createHash('sha256').update(rawBody).digest('hex');
  const prior = await PaymentGatewayEvent.findOne({ payloadHash });
  if (prior?.processedAt) return { duplicate: true };
  let event;
  try {
    event =
      prior ??
      (await PaymentGatewayEvent.create({
        provider: 'PHONEPE',
        eventType: verified.event,
        payloadHash,
        merchantTransactionId: verified.merchantOrderId,
        verified: true,
        rawPayload: verified.raw,
      }));
  } catch (error: any) {
    if (error?.code === 11000) return { duplicate: true };
    throw error;
  }
  const intent = await PaymentIntent.findOne({ merchantTransactionId: verified.merchantOrderId });
  if (!intent || verified.amountPaise !== intent.amountPaise)
    throw new AppError(
      'GATEWAY_VERIFICATION_FAILED',
      'Webhook does not match a payment intent',
      409,
    );
  // Already credited at initiate time — never downgrade on cancel / late webhook.
  if (intent.status === 'SUCCESS') {
    event.processedAt = new Date();
    await event.save();
    return { processed: true, state: intent.status };
  }
  const serverStatus = await phonePeProvider.checkStatus(intent.merchantTransactionId);
  if (serverStatus.amountPaise !== intent.amountPaise)
    throw new AppError('GATEWAY_AMOUNT_MISMATCH', 'Verified gateway amount mismatch', 409);
  if (serverStatus.state === 'SUCCESS')
    await finalizeGatewayPayment(intent, serverStatus, { requestId });
  else {
    intent.status = serverStatus.state === 'FAILED' ? 'FAILED' : 'PENDING';
    await intent.save();
  }
  event.processedAt = new Date();
  await event.save();
  return { processed: true, state: intent.status };
}
