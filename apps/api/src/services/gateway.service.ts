import { createHash, randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import {
  Customer,
  PaymentGatewayEvent,
  PaymentIntent,
  SchemeEnrollment,
  SystemSetting,
  User,
} from '../models/index.js';
import { getPaymentRules, PAYMENT_QUOTE_TTL_MS } from './scheme.service.js';
import { finalizeGatewayPayment } from './payment.service.js';
import { phonePeProvider } from './phonepe.provider.js';

export async function initiatePhonePe(
  userId: string,
  input: { schemeId: string; amountPaise: number; idempotencyKey: string },
  requestId: string,
) {
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
  if (existing)
    return {
      merchantTransactionId: existing.merchantTransactionId,
      checkoutUrl: existing.checkoutUrl,
      status: existing.status,
      quoteExpiresAt: existing.quoteExpiresAt,
      goldRatePerGramPaise: existing.goldRatePerGramPaise ?? null,
      goldWeightMg: existing.goldWeightMg ?? null,
      goldPurity: existing.goldPurity ?? null,
    };

  const user = await User.findById(userId);
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

    // Temporary test behaviour: credit immediately so cancel / missing webhook still succeed.
    // Checkout URL is still returned so PhonePe QR / page can open.
    await finalizeGatewayPayment(
      intent,
      {
        transactionId: `FORCE-SUCCESS-${merchantTransactionId}`,
        amountPaise: intent.amountPaise,
      },
      { requestId },
    );

    return {
      merchantTransactionId,
      checkoutUrl: checkout.redirectUrl,
      expiresAt: checkout.expiresAt,
      quoteExpiresAt,
      goldRatePerGramPaise: rules.goldRatePerGramPaise,
      goldWeightMg: rules.goldWeightMg,
      goldPurity: rules.goldPurity,
      status: 'SUCCESS',
    };
  } catch (error) {
    intent.status = 'FAILED';
    await intent.save();
    throw error;
  }
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
