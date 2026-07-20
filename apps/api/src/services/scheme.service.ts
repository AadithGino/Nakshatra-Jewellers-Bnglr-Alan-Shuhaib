import mongoose, { type ClientSession } from 'mongoose';
import { addMonths } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { AppError } from '../utils/AppError.js';
import { GoldRate, Payment, SchemeEnrollment } from '../models/index.js';
import { BUSINESS_TZ, schemeMonth } from '../utils/time.js';

export const PAYMENT_QUOTE_TTL_MS = 15 * 60_000;

export type PaymentPhase = 'FLEXIBLE' | 'CAPPED';

export function resolvePaymentPhase(
  enrollment: { flexibleMonths: number; durationMonths: number },
  schemeMonthValue: number,
): { phase: PaymentPhase; phaseLabel: string; flexibleThroughout: boolean } {
  const flexibleThroughout = enrollment.flexibleMonths >= enrollment.durationMonths;
  if (flexibleThroughout) {
    return {
      phase: 'FLEXIBLE',
      phaseLabel: 'Flexible throughout the scheme',
      flexibleThroughout: true,
    };
  }
  if (schemeMonthValue <= enrollment.flexibleMonths) {
    return { phase: 'FLEXIBLE', phaseLabel: 'Flexible phase', flexibleThroughout: false };
  }
  return { phase: 'CAPPED', phaseLabel: 'Capped phase', flexibleThroughout: false };
}

export async function getPaymentRules(
  schemeId: string,
  paymentDate: Date,
  amountPaise: number,
  session?: ClientSession,
  options: { enforceLimit?: boolean; requireGoldRate?: boolean } = {},
) {
  const enforceLimit = options.enforceLimit !== false;
  const requireGoldRate = options.requireGoldRate !== false;
  const enrollment = await SchemeEnrollment.findById(schemeId).session(session ?? null);
  if (!enrollment) throw new AppError('SCHEME_NOT_FOUND', 'Scheme enrollment not found', 404);
  if (enrollment.status !== 'ACTIVE')
    throw new AppError('SCHEME_NOT_ACTIVE', 'Scheme is not active', 409);
  const month = schemeMonth(enrollment.startDate, paymentDate);
  if (month < 1 || month > enrollment.durationMonths || paymentDate >= enrollment.maturityDate)
    throw new AppError('SCHEME_MATURED', 'Payment date is outside the active scheme period', 409);
  let capPaise: number | null = null;
  let paidThisMonthPaise = 0;
  if (month > enrollment.flexibleMonths) {
    const firstPeriod = await Payment.aggregate([
      {
        $match: {
          schemeId: enrollment._id,
          status: 'SUCCESS',
          schemeMonth: { $lte: enrollment.flexibleMonths },
        },
      },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]).session(session ?? null);
    capPaise = averageMonthlyCapPaise(firstPeriod[0]?.total ?? 0, enrollment.flexibleMonths);
    const current = await Payment.aggregate([
      { $match: { schemeId: enrollment._id, status: 'SUCCESS', schemeMonth: month } },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]).session(session ?? null);
    paidThisMonthPaise = current[0]?.total ?? 0;
    if (enforceLimit && paidThisMonthPaise + amountPaise > capPaise)
      throw new AppError(
        'PAYMENT_LIMIT_EXCEEDED',
        'Payment exceeds this scheme month’s remaining limit',
        409,
        false,
        [
          {
            capPaise,
            paidThisMonthPaise,
            remainingPaise: remainingUnderCapPaise(capPaise, paidThisMonthPaise),
            schemeMonth: month,
          },
        ],
      );
  }
  let rate: Awaited<ReturnType<typeof activeGoldRate>> | null = null;
  if (enrollment.schemeType === 'GOLD_WEIGHT') {
    if (requireGoldRate) {
      rate = await activeGoldRate(paymentDate, session);
    } else {
      try {
        rate = await activeGoldRate(paymentDate, session);
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== 'GOLD_RATE_NOT_AVAILABLE') throw error;
        rate = null;
      }
    }
  }
  const phase = resolvePaymentPhase(enrollment, month);
  return {
    enrollment,
    schemeMonth: month,
    phase: phase.phase,
    phaseLabel: phase.phaseLabel,
    flexibleThroughout: phase.flexibleThroughout,
    capPaise,
    paidThisMonthPaise,
    remainingPaise: capPaise === null ? null : remainingUnderCapPaise(capPaise, paidThisMonthPaise),
    goldRateId: rate?._id ?? null,
    goldRatePerGramPaise: rate?.ratePerGramPaise ?? null,
    goldPurity: rate?.purity ?? (enrollment.schemeType === 'GOLD_WEIGHT' ? '916' : null),
    goldWeightMg: rate ? goldWeightMg(amountPaise, rate.ratePerGramPaise) : null,
  };
}

export async function activeGoldRate(at: Date, session?: ClientSession) {
  const rate = await GoldRate.findOne({
    status: 'ACTIVE',
    effectiveFrom: mongoose.trusted({ $lte: at }),
  })
    .sort({ effectiveFrom: -1 })
    .session(session ?? null);
  if (!rate)
    throw new AppError(
      'GOLD_RATE_NOT_AVAILABLE',
      'No gold rate is active for the payment time',
      409,
    );
  return rate;
}
export const goldWeightMg = (amountPaise: number, ratePerGramPaise: number) =>
  Math.floor((amountPaise * 1000) / ratePerGramPaise);
export const averageMonthlyCapPaise = (firstPeriodTotalPaise: number, flexibleMonths: number) => {
  if (
    !Number.isSafeInteger(firstPeriodTotalPaise) ||
    firstPeriodTotalPaise < 0 ||
    !Number.isInteger(flexibleMonths) ||
    flexibleMonths < 1
  )
    throw new AppError('INVALID_SCHEME_CAP_INPUT', 'Invalid cap calculation input', 422);
  return Math.floor(firstPeriodTotalPaise / flexibleMonths);
};
export const remainingUnderCapPaise = (capPaise: number, paidThisMonthPaise: number) =>
  Math.max(0, capPaise - paidThisMonthPaise);
export function enrollmentDates(startDate: Date, flexibleMonths: number, durationMonths: number) {
  const local = toZonedTime(startDate, BUSINESS_TZ);
  return {
    flexiblePeriodEndDate: fromZonedTime(addMonths(local, flexibleMonths), BUSINESS_TZ),
    maturityDate: fromZonedTime(addMonths(local, durationMonths), BUSINESS_TZ),
  };
}
