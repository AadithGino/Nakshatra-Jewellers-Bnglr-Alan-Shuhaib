import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';
import {
  GoldRate,
  Notification,
  Payment,
  PaymentIntent,
  Payout,
  SchemeEnrollment,
} from '../models/index.js';
import {
  getPaymentRules,
  PAYMENT_QUOTE_TTL_MS,
  resolvePaymentPhase,
} from './scheme.service.js';
import { getOwnedCustomer } from './customer-access.service.js';
import { schemeMonth } from '../utils/time.js';

function timeProgressPercent(startDate: Date, maturityDate: Date, at = new Date()) {
  const startedAt = new Date(startDate).getTime();
  const completesAt = new Date(maturityDate).getTime();
  return Math.max(
    0,
    Math.min(100, ((at.getTime() - startedAt) / Math.max(1, completesAt - startedAt)) * 100),
  );
}

async function buildSchemeStatus(scheme: any, currentGoldRate: any | null) {
  const now = new Date();
  const month = schemeMonth(scheme.startDate, now);
  const phase = resolvePaymentPhase(scheme, month);
  let monthlyCapPaise: number | null = null;
  let paidInCurrentMonthPaise = 0;
  let remainingCapPaise: number | null = null;
  let minimumPaymentPaise: number | null = null;

  try {
    const rules = await getPaymentRules(String(scheme._id), now, 0, undefined, {
      enforceLimit: false,
      requireGoldRate: false,
    });
    monthlyCapPaise = rules.capPaise;
    paidInCurrentMonthPaise = rules.paidThisMonthPaise;
    remainingCapPaise = rules.remainingPaise;
    minimumPaymentPaise = scheme.schemePlanId?.minimumPaymentPaise ?? null;
  } catch {
    /* status stays partial when rules are unavailable */
  }

  if (minimumPaymentPaise === null && scheme.schemePlanId?.minimumPaymentPaise != null) {
    minimumPaymentPaise = scheme.schemePlanId.minimumPaymentPaise;
  }

  const cappedMonths = Math.max(0, scheme.durationMonths - scheme.flexibleMonths);

  return {
    schemeId: String(scheme._id),
    schemeName: scheme.schemePlanId?.name ?? null,
    enrollmentNumber: scheme.enrollmentNumber,
    schemeType: scheme.schemeType,
    status: scheme.status,
    schemeMonth: month,
    durationMonths: scheme.durationMonths,
    flexibleMonthCount: scheme.flexibleMonths,
    cappedMonthCount: cappedMonths,
    phase: phase.phase,
    phaseLabel: phase.phaseLabel,
    flexibleThroughout: phase.flexibleThroughout,
    timeProgressPercent: Math.floor(timeProgressPercent(scheme.startDate, scheme.maturityDate, now)),
    totalPaidPaise: scheme.totalPaidPaise ?? 0,
    totalGoldWeightMg: scheme.totalGoldWeightMg ?? 0,
    monthlyCapPaise,
    paidInCurrentMonthPaise,
    remainingCapPaise,
    minimumPaymentPaise,
    currentGoldRate:
      scheme.schemeType === 'GOLD_WEIGHT'
        ? currentGoldRate
          ? {
              ratePerGramPaise: currentGoldRate.ratePerGramPaise,
              purity: currentGoldRate.purity,
              effectiveFrom: currentGoldRate.effectiveFrom,
            }
          : null
        : null,
    startDate: scheme.startDate,
    completionDate: scheme.maturityDate,
  };
}

export async function getCustomerPaymentPreview(
  userId: string,
  schemeId: string,
  amountPaise: number,
) {
  const customer = await getOwnedCustomer(userId);
  const scheme = await SchemeEnrollment.findOne({
    _id: schemeId,
    customerId: customer._id,
  })
    .populate('schemePlanId')
    .lean();
  if (!scheme) throw new AppError('SCHEME_NOT_FOUND', 'Scheme not found', 404);
  if (scheme.status !== 'ACTIVE')
    throw new AppError('SCHEME_NOT_ACTIVE', 'Scheme is not active', 409);

  const calculatedAt = new Date();
  const quoteExpiresAt = new Date(calculatedAt.getTime() + PAYMENT_QUOTE_TTL_MS);
  const minimumPaymentPaise = Number(scheme.schemePlanId?.minimumPaymentPaise ?? 100);

  const rules = await getPaymentRules(schemeId, calculatedAt, amountPaise, undefined, {
    enforceLimit: false,
    requireGoldRate: false,
  });

  const remainingCapPaise = rules.remainingPaise;
  const capApplies = rules.phase === 'CAPPED' && rules.capPaise !== null;
  let paymentAllowed = true;
  let validationMessage: string | null = null;

  if (scheme.status !== 'ACTIVE') {
    paymentAllowed = false;
    validationMessage = 'This scheme is not accepting payments.';
  } else if (!Number.isInteger(amountPaise) || amountPaise < 1) {
    paymentAllowed = false;
    validationMessage = 'Enter a valid payment amount.';
  } else if (amountPaise < minimumPaymentPaise) {
    paymentAllowed = false;
    validationMessage = `Minimum accepted payment is ₹${(minimumPaymentPaise / 100).toFixed(2)}.`;
  } else if (capApplies && remainingCapPaise !== null && remainingCapPaise <= 0) {
    paymentAllowed = false;
    validationMessage = 'No remaining amount is available for this scheme month.';
  } else if (
    capApplies &&
    remainingCapPaise !== null &&
    amountPaise > remainingCapPaise
  ) {
    paymentAllowed = false;
    validationMessage = `Amount exceeds the remaining allowed payment of ₹${(remainingCapPaise / 100).toFixed(2)} for this scheme month.`;
  } else if (scheme.schemeType === 'GOLD_WEIGHT' && !rules.goldRatePerGramPaise) {
    paymentAllowed = false;
    validationMessage = 'Current 916 gold rate is unavailable. Try again shortly.';
  }

  return {
    schemeId: String(scheme._id),
    schemeName: scheme.schemePlanId?.name ?? null,
    schemeType: scheme.schemeType,
    enrollmentNumber: scheme.enrollmentNumber,
    schemeMonth: rules.schemeMonth,
    phase: rules.phase,
    phaseLabel: rules.phaseLabel,
    flexibleThroughout: rules.flexibleThroughout,
    amountPaise,
    minimumPaymentPaise,
    capApplies,
    monthlyCapPaise: rules.capPaise,
    paidInCurrentMonthPaise: rules.paidThisMonthPaise,
    remainingCapPaise,
    paymentAllowed,
    validationMessage,
    purity: '916' as const,
    goldRateId: rules.goldRateId ? String(rules.goldRateId) : null,
    goldRatePerGramPaise: rules.goldRatePerGramPaise,
    goldWeightMg: rules.goldWeightMg,
    calculatedAt: calculatedAt.toISOString(),
    quoteExpiresAt: quoteExpiresAt.toISOString(),
    totalPaidPaise: scheme.totalPaidPaise ?? 0,
    totalGoldWeightMg: scheme.totalGoldWeightMg ?? 0,
    durationMonths: scheme.durationMonths,
    status: scheme.status,
  };
}

export async function getCustomerHome(userId: string) {
  const customer = await getOwnedCustomer(userId);
  const schemes = await SchemeEnrollment.find({ customerId: customer._id })
    .populate('schemePlanId')
    .sort({ createdAt: -1 })
    .lean();
  const activeScheme = schemes.find((scheme: any) => scheme.status === 'ACTIVE');
  const currentGoldRate = await GoldRate.findOne({
    status: 'ACTIVE',
    effectiveFrom: mongoose.trusted({ $lte: new Date() }),
  })
    .sort({ effectiveFrom: -1 })
    .lean();
  const recentPayments = await Payment.find({ customerId: customer._id, status: 'SUCCESS' })
    .sort({ paymentDate: -1 })
    .limit(5)
    .lean();

  const schemeStatus = activeScheme
    ? await buildSchemeStatus(activeScheme, currentGoldRate)
    : null;

  let paymentRules = null;
  if (schemeStatus) {
    paymentRules = {
      schemeMonth: schemeStatus.schemeMonth,
      phase: schemeStatus.phase,
      phaseLabel: schemeStatus.phaseLabel,
      flexibleThroughout: schemeStatus.flexibleThroughout,
      capPaise: schemeStatus.monthlyCapPaise,
      paidThisMonthPaise: schemeStatus.paidInCurrentMonthPaise,
      remainingPaise: schemeStatus.remainingCapPaise,
      minimumPaymentPaise: schemeStatus.minimumPaymentPaise,
    };
  }

  return {
    customer,
    activeScheme,
    previousSchemes: schemes.filter(
      (scheme: any) => String(scheme._id) !== String(activeScheme?._id),
    ),
    currentGoldRate,
    recentPayments,
    paymentRules,
    schemeStatus,
  };
}

export async function listCustomerSchemes(userId: string) {
  const customer = await getOwnedCustomer(userId);
  return SchemeEnrollment.find({ customerId: customer._id })
    .populate('schemePlanId')
    .sort({ createdAt: -1 })
    .lean();
}

export async function listCustomerPayments(userId: string) {
  const customer = await getOwnedCustomer(userId);
  return Payment.find({ customerId: customer._id }).sort({ paymentDate: -1 }).lean();
}

export async function listCustomerGoldRates(userId: string) {
  await getOwnedCustomer(userId);
  return GoldRate.find({ purity: '916' })
    .select('ratePerGramPaise purity effectiveFrom status notes usageCount')
    .sort({ effectiveFrom: -1 })
    .limit(90)
    .lean();
}

export async function getCustomerPaymentIntent(userId: string, orderId: string) {
  const customer = await getOwnedCustomer(userId);
  const intent = await PaymentIntent.findOne({
    merchantTransactionId: orderId,
    customerId: customer._id,
  })
    .select(
      'merchantTransactionId status expiresAt amountPaise goldRatePerGramPaise goldWeightMg goldPurity quoteCreatedAt',
    )
    .lean();
  if (!intent) throw new AppError('PAYMENT_INTENT_NOT_FOUND', 'Payment attempt not found', 404);
  const payment =
    intent.status === 'SUCCESS'
      ? await Payment.findOne({
          merchantTransactionId: orderId,
          customerId: customer._id,
        })
          .select(
            '_id receiptNumber amountPaise paymentDate status goldRatePerGramPaise goldWeightMg goldPurity',
          )
          .lean()
      : null;
  return { ...intent, payment };
}

export async function listCustomerPayouts(userId: string) {
  const customer = await getOwnedCustomer(userId);
  return Payout.find({ customerId: customer._id }).sort({ payoutDate: -1 }).lean();
}

export const listCustomerNotifications = (userId: string) =>
  Notification.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();

export async function getOwnedSchemeDetails(userId: string, schemeId: string) {
  const customer = await getOwnedCustomer(userId);
  const scheme = await SchemeEnrollment.findOne({
    _id: schemeId,
    customerId: customer._id,
  })
    .populate('schemePlanId')
    .lean();
  if (!scheme) throw new AppError('SCHEME_NOT_FOUND', 'Scheme not found', 404);
  const [payments, payouts, currentGoldRate] = await Promise.all([
    Payment.find({ schemeId: scheme._id }).sort({ paymentDate: -1 }).lean(),
    Payout.find({ schemeId: scheme._id }).sort({ payoutDate: -1 }).lean(),
    GoldRate.findOne({
      status: 'ACTIVE',
      effectiveFrom: mongoose.trusted({ $lte: new Date() }),
    })
      .sort({ effectiveFrom: -1 })
      .lean(),
  ]);
  const schemeStatus = await buildSchemeStatus(scheme, currentGoldRate);
  return { scheme, payments, payouts, schemeStatus, currentGoldRate };
}

export async function getOwnedReceipt(userId: string, paymentId: string) {
  const customer = await getOwnedCustomer(userId);
  const payment = await Payment.findOne({
    _id: paymentId,
    customerId: customer._id,
    status: mongoose.trusted({ $in: ['SUCCESS', 'REVERSED'] }),
  }).lean();
  if (!payment) throw new AppError('RECEIPT_NOT_FOUND', 'Receipt not found', 404);
  return { receiptNumber: payment.receiptNumber, payment };
}

