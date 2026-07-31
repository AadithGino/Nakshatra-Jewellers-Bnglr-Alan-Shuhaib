import mongoose from 'mongoose';
import {
  AuditLog,
  CashSubmission,
  Customer,
  GoldRate,
  Payment,
  PaymentCorrection,
  PaymentGatewayEvent,
  PaymentIntent,
  Payout,
  SchemeEnrollment,
  SchemePlan,
  StaffProfile,
} from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { businessDayRange } from '../utils/time.js';

const total = (rows: any[]) => rows[0]?.total ?? 0;
const PAYMENT_METHOD_ORDER = ['CASH', 'UPI', 'BANK', 'CARD'] as const;

const normalizeByMethod = (rows: Array<{ _id: string; total?: number; count?: number }>) => {
  const map = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    const method = String(row._id) === 'PHONEPE' ? 'UPI' : String(row._id);
    const current = map.get(method) ?? { total: 0, count: 0 };
    map.set(method, {
      total: current.total + (row.total ?? 0),
      count: current.count + (row.count ?? 0),
    });
  }
  return PAYMENT_METHOD_ORDER.map((method) => {
    const row = map.get(method);
    return {
      method,
      totalPaise: row?.total ?? 0,
      count: row?.count ?? 0,
    };
  });
};
export async function financialDashboard(filter: Record<string, unknown> = {}) {
  const success = { status: 'SUCCESS', ...filter };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const maturityEnd = new Date(now.getTime() + 30 * 86_400_000);
  const [
    byMethod,
    todayCollection,
    monthCollection,
    submitted,
    payouts,
    cashWithStaff,
    adminCash,
    schemeCounts,
    recentPayments,
    recentCustomers,
    goldLiability,
    upcomingMaturities,
    currentGoldRate,
    schemeTypeCounts,
    monthlyCollections,
  ] = await Promise.all([
    Payment.aggregate([
      { $match: success },
      { $group: { _id: '$method', total: { $sum: '$amountPaise' } } },
    ]),
    Payment.aggregate([
      { $match: { ...success, paymentDate: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { ...success, paymentDate: { $gte: month } } },
      { $group: { _id: null, total: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
    ]),
    CashSubmission.aggregate([
      { $match: { status: 'SUCCESS' } },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]),
    Payout.aggregate([
      { $match: { status: 'SUCCESS' } },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]),
    Payment.aggregate([
      { $match: { status: 'SUCCESS', method: 'CASH', collectorRole: 'STAFF' } },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]),
    Payment.aggregate([
      { $match: { status: 'SUCCESS', method: 'CASH', collectorRole: 'ADMIN' } },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]),
    SchemeEnrollment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Payment.find(success)
      .populate({ path: 'customerId', populate: { path: 'userId', select: 'name phone' } })
      .populate('schemeId', 'schemeType enrollmentNumber')
      .sort({ paymentDate: -1 })
      .limit(8)
      .select('-originalSnapshot')
      .lean(),
    Customer.find({ status: 'ACTIVE' }).sort({ createdAt: -1 }).limit(8).lean(),
    SchemeEnrollment.aggregate([
      { $match: { status: { $in: ['ACTIVE', 'MATURED'] }, schemeType: 'GOLD_WEIGHT' } },
      { $group: { _id: null, total: { $sum: '$totalGoldWeightMg' } } },
    ]),
    SchemeEnrollment.find({
      status: 'ACTIVE',
      maturityDate: mongoose.trusted({ $gte: now, $lte: maturityEnd }),
    })
      .populate({ path: 'customerId', populate: { path: 'userId', select: 'name phone' } })
      .populate('schemePlanId', 'name type')
      .sort({ maturityDate: 1 })
      .limit(8)
      .lean(),
    GoldRate.findOne({ status: 'ACTIVE', effectiveFrom: mongoose.trusted({ $lte: now }) })
      .sort({ effectiveFrom: -1 })
      .lean(),
    SchemeEnrollment.aggregate([
      { $match: { status: 'ACTIVE' } },
      { $group: { _id: '$schemeType', count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      {
        $match: {
          status: 'SUCCESS',
          paymentDate: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) },
        },
      },
      {
        $lookup: {
          from: 'schemeenrollments',
          localField: 'schemeId',
          foreignField: '_id',
          as: 'scheme',
        },
      },
      { $unwind: '$scheme' },
      {
        $group: {
          _id: {
            year: { $year: '$paymentDate' },
            month: { $month: '$paymentDate' },
            schemeType: '$scheme.schemeType',
          },
          totalPaise: { $sum: '$amountPaise' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
  ]);
  const methods = Object.fromEntries(
    byMethod.map((x: any) => [String(x._id).toLowerCase() + 'CollectionPaise', x.total]),
  );
  const submittedPaise = total(submitted);
  const payoutPaise = total(payouts);
  const staffCashPaise = total(cashWithStaff) - submittedPaise;
  const adminCashPaise = total(adminCash);
  const digitalPaise = [
    'phonepeCollectionPaise',
    'upiCollectionPaise',
    'bankCollectionPaise',
    'cardCollectionPaise',
  ].reduce((sum, key) => sum + (methods[key] ?? 0), 0);
  return {
    ...methods,
    totalCollectionPaise: Object.values(methods).reduce((a: number, b: any) => a + b, 0),
    todayCollectionPaise: total(todayCollection),
    todayPaymentCount: todayCollection[0]?.count ?? 0,
    monthCollectionPaise: total(monthCollection),
    monthPaymentCount: monthCollection[0]?.count ?? 0,
    cashSubmittedPaise: submittedPaise,
    cashWithStaffPaise: staffCashPaise,
    totalGivenToCustomersPaise: payoutPaise,
    cashInVaultPaise: submittedPaise + adminCashPaise + digitalPaise - payoutPaise,
    activeSchemes: schemeCounts.find((x: any) => x._id === 'ACTIVE')?.count ?? 0,
    maturedSchemes: schemeCounts.find((x: any) => x._id === 'MATURED')?.count ?? 0,
    goldLiabilityMg: total(goldLiability),
    recentPayments,
    recentCustomers,
    upcomingMaturities,
    currentGoldRate,
    activeCashSchemes: schemeTypeCounts.find((item: any) => item._id === 'CASH')?.count ?? 0,
    activeGoldWeightSchemes:
      schemeTypeCounts.find((item: any) => item._id === 'GOLD_WEIGHT')?.count ?? 0,
    monthlyCollections,
  };
}
const parseStaffObjectId = (staffId: string) => {
  if (
    !mongoose.Types.ObjectId.isValid(staffId) ||
    String(new mongoose.Types.ObjectId(staffId)) !== staffId
  ) {
    throw new AppError('INVALID_STAFF_ID', 'Staff identifier is invalid', 422);
  }
  return new mongoose.Types.ObjectId(staffId);
};

export async function staffDashboard(staffId: string) {
  const id = parseStaffObjectId(staffId);
  const { start, end } = businessDayRange();
  const todayMatch = { $gte: start, $lt: end };
  const [
    byMethod,
    todayCollection,
    submitted,
    recent,
    recentCustomers,
    currentGoldRate,
    customersServedToday,
  ] = await Promise.all([
    Payment.aggregate([
      { $match: { collectedBy: id, status: 'SUCCESS' } },
      { $group: { _id: '$method', total: { $sum: '$amountPaise' } } },
    ]),
    Payment.aggregate([
      {
        $match: {
          collectedBy: id,
          status: 'SUCCESS',
          paymentDate: todayMatch,
        },
      },
      { $group: { _id: null, total: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
    ]),
    CashSubmission.aggregate([
      { $match: { staffId: id, status: 'SUCCESS' } },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]),
    Payment.find({ collectedBy: id })
      .populate({ path: 'customerId', populate: { path: 'userId', select: 'name phone' } })
      .populate('schemeId', 'schemeType enrollmentNumber')
      .sort({ paymentDate: -1 })
      .limit(10)
      .lean(),
    Customer.find({ status: 'ACTIVE' })
      .populate('userId', 'name phone')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    GoldRate.findOne({ status: 'ACTIVE', effectiveFrom: mongoose.trusted({ $lte: new Date() }) })
      .sort({ effectiveFrom: -1 })
      .lean(),
    Payment.distinct('customerId', {
      collectedBy: id,
      status: 'SUCCESS',
      paymentDate: mongoose.trusted(todayMatch),
    }).then((customers: unknown[]) => customers.length),
  ]);
  const cashCollectedPaise = byMethod.find((x: any) => x._id === 'CASH')?.total ?? 0;
  const cashSubmittedPaise = total(submitted);
  return {
    collectionPaise: byMethod.reduce((sum: number, row: any) => sum + (row.total ?? 0), 0),
    todayCollectionPaise: total(todayCollection),
    todayPaymentCount: todayCollection[0]?.count ?? 0,
    cashCollectedPaise,
    cashSubmittedPaise,
    cashWithStaffPaise: cashCollectedPaise - cashSubmittedPaise,
    customersServedToday,
    recentPayments: recent ?? [],
    recentCustomers: recentCustomers ?? [],
    currentGoldRate: currentGoldRate ?? null,
  };
}

/** Admin staff detail workspace — period metrics + lifetime cash outstanding. */
export async function staffMemberReport(staffId: string, from?: Date, to?: Date) {
  const id = parseStaffObjectId(staffId);
  const dateMatch = paymentDateMatch(from, to);
  const subMatch = submissionDateMatch(from, to);
  const [periodByMethod, periodSubmitted, lifetimeCash, lifetimeSubmitted, daily] =
    await Promise.all([
      Payment.aggregate([
        {
          $match: {
            collectedBy: id,
            status: 'SUCCESS',
            collectorRole: 'STAFF',
            ...dateMatch,
          },
        },
        {
          $group: {
            _id: '$method',
            total: { $sum: '$amountPaise' },
            count: { $sum: 1 },
          },
        },
      ]),
      CashSubmission.aggregate([
        { $match: { staffId: id, status: 'SUCCESS', ...subMatch } },
        { $group: { _id: null, total: { $sum: '$amountPaise' } } },
      ]),
      Payment.aggregate([
        {
          $match: {
            collectedBy: id,
            status: 'SUCCESS',
            collectorRole: 'STAFF',
            method: 'CASH',
          },
        },
        { $group: { _id: null, total: { $sum: '$amountPaise' } } },
      ]),
      CashSubmission.aggregate([
        { $match: { staffId: id, status: 'SUCCESS' } },
        { $group: { _id: null, total: { $sum: '$amountPaise' } } },
      ]),
      Payment.aggregate([
        {
          $match: {
            collectedBy: id,
            status: 'SUCCESS',
            collectorRole: 'STAFF',
            ...dateMatch,
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$paymentDate', timezone: 'Asia/Kolkata' },
            },
            totalPaise: { $sum: '$amountPaise' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

  const collectionPaise = periodByMethod.reduce(
    (sum: number, row: any) => sum + (row.total ?? 0),
    0,
  );
  const paymentCount = periodByMethod.reduce(
    (sum: number, row: any) => sum + (row.count ?? 0),
    0,
  );
  const cashCollectedPaise = periodByMethod.find((row: any) => row._id === 'CASH')?.total ?? 0;
  const cashSubmittedPaise = total(periodSubmitted);
  const otherCollectedPaise = collectionPaise - cashCollectedPaise;
  const lifetimeCashWithStaffPaise = Math.max(0, total(lifetimeCash) - total(lifetimeSubmitted));
  const byMethod = normalizeByMethod(periodByMethod as any[]);

  return {
    collectionPaise,
    paymentCount,
    cashCollectedPaise,
    cashSubmittedPaise,
    otherCollectedPaise,
    byMethod,
    cashWithStaffPaise: cashCollectedPaise - cashSubmittedPaise,
    lifetimeCashWithStaffPaise,
    daily: daily.map((row: any) => ({
      date: row._id,
      totalPaise: row.totalPaise ?? 0,
      count: row.count ?? 0,
    })),
  };
}

export async function listPhonePeTransactions() {
  const intents = await PaymentIntent.find()
    .populate({ path: 'customerId', populate: { path: 'userId', select: 'name phone' } })
    .populate({
      path: 'schemeId',
      select: 'enrollmentNumber schemeType status',
      populate: { path: 'schemePlanId', select: 'name' },
    })
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
  const transactionIds = intents.map((intent: any) => intent.merchantTransactionId);
  const [payments, events] = await Promise.all([
    Payment.find({
      merchantTransactionId: mongoose.trusted({ $in: transactionIds }),
    })
      .select('_id merchantTransactionId receiptNumber providerTransactionId status paymentDate')
      .lean(),
    PaymentGatewayEvent.find({
      merchantTransactionId: mongoose.trusted({ $in: transactionIds }),
    })
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  return intents.map((intent: any) => {
    const payment = payments.find(
      (item: any) => item.merchantTransactionId === intent.merchantTransactionId,
    );
    const event = events.find(
      (item: any) => item.merchantTransactionId === intent.merchantTransactionId,
    );
    return {
      ...intent,
      paymentId: payment?._id,
      providerTransactionId: payment?.providerTransactionId,
      webhookStatus: event ? (event.processedAt ? 'PROCESSED' : 'RECEIVED') : 'NOT_RECEIVED',
      receiptStatus: payment?.receiptNumber ? 'GENERATED' : 'PENDING',
      receiptNumber: payment?.receiptNumber,
    };
  });
}

export async function getPhonePeTransactionDetail(recordId: string) {
  const intent = await PaymentIntent.findById(recordId)
    .populate({ path: 'customerId', populate: { path: 'userId', select: 'name phone' } })
    .populate({
      path: 'schemeId',
      select: 'enrollmentNumber schemeType status',
      populate: { path: 'schemePlanId', select: 'name type' },
    })
    .lean();
  if (!intent) throw new AppError('RECORD_NOT_FOUND', 'PhonePe transaction not found', 404);

  const [payment, events] = await Promise.all([
    Payment.findOne({ merchantTransactionId: intent.merchantTransactionId })
      .select(
        '_id merchantTransactionId receiptNumber providerTransactionId status paymentDate amountPaise goldWeightMg goldRatePerGramPaise goldPurity method',
      )
      .lean(),
    PaymentGatewayEvent.find({
      merchantTransactionId: intent.merchantTransactionId,
    })
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  const latestEvent = events[0];
  return {
    ...intent,
    payment,
    paymentId: payment?._id,
    providerTransactionId: payment?.providerTransactionId,
    webhookStatus: latestEvent ? (latestEvent.processedAt ? 'PROCESSED' : 'RECEIVED') : 'NOT_RECEIVED',
    receiptStatus: payment?.receiptNumber ? 'GENERATED' : 'PENDING',
    receiptNumber: payment?.receiptNumber,
    webhookEvents: events.map((event: any) => ({
      _id: event._id,
      eventType: event.eventType,
      verified: event.verified,
      processedAt: event.processedAt,
      processingError: event.processingError,
      createdAt: event.createdAt,
    })),
  };
}

export async function getAdminOperationRecord(module: string, recordId: string) {
  const queries: Record<string, () => Promise<any>> = {
    'scheme-plans': () => SchemePlan.findById(recordId).lean(),
    enrollments: () =>
      SchemeEnrollment.findById(recordId).populate('customerId').populate('schemePlanId').lean(),
    'gold-rates': () => GoldRate.findById(recordId).lean(),
    payments: () => Payment.findById(recordId).populate('customerId').populate('schemeId').lean(),
    'cash-submissions': async () => {
      const record = await CashSubmission.findById(recordId)
        .populate('staffId', 'name phone')
        .populate('receivedBy', 'name phone')
        .populate('createdBy', 'name phone')
        .lean();
      if (!record) return null;
      const staffUserId = record.staffId?._id ?? record.staffId;
      const profile =
        staffUserId && mongoose.isValidObjectId(String(staffUserId))
          ? await StaffProfile.findOne({ userId: staffUserId }).select('_id employeeCode').lean()
          : null;
      return {
        ...record,
        staffProfileId: profile?._id ?? null,
        employeeCode: profile?.employeeCode ?? null,
      };
    },
    corrections: () =>
      PaymentCorrection.findById(recordId)
        .populate('paymentId')
        .populate('requestedBy', 'name phone')
        .lean(),
    payouts: () =>
      Payout.findById(recordId)
        .populate({ path: 'customerId', populate: { path: 'userId', select: 'name phone' } })
        .populate({
          path: 'schemeId',
          select: 'enrollmentNumber schemeType status totalPaidPaise totalGoldWeightMg',
          populate: { path: 'schemePlanId', select: 'name type' },
        })
        .populate('createdBy', 'name phone')
        .lean(),
    'audit-logs': () =>
      AuditLog.findById(recordId).populate('actorId', 'name phone role').lean(),
  };
  if (module === 'phonepe-transactions') return getPhonePeTransactionDetail(recordId);
  const query = queries[module];
  if (!query) throw new AppError('MODULE_NOT_FOUND', 'Operation module is not supported', 404);
  const record = await query();
  if (!record) throw new AppError('RECORD_NOT_FOUND', 'Operation record not found', 404);
  return record;
}

const paymentDateMatch = (from?: Date, to?: Date) => {
  const paymentDate: Record<string, Date> = {};
  if (from) paymentDate.$gte = from;
  if (to) paymentDate.$lte = to;
  return Object.keys(paymentDate).length ? { paymentDate: mongoose.trusted(paymentDate) } : {};
};

const submissionDateMatch = (from?: Date, to?: Date) => {
  const submissionDate: Record<string, Date> = {};
  if (from) submissionDate.$gte = from;
  if (to) submissionDate.$lte = to;
  return Object.keys(submissionDate).length
    ? { submissionDate: mongoose.trusted(submissionDate) }
    : {};
};

export { paymentDateMatch, submissionDateMatch };

export async function collectionReport(method?: string, from?: Date, to?: Date) {
  const match = {
    status: 'SUCCESS',
    ...paymentDateMatch(from, to),
    ...(method ? { method } : {}),
  };
  const [summary, payments] = await Promise.all([
    Payment.aggregate([
      { $match: match },
      { $group: { _id: '$method', totalPaise: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Payment.find(match)
      .populate({ path: 'customerId', populate: { path: 'userId', select: 'name phone' } })
      .populate({
        path: 'schemeId',
        select: 'enrollmentNumber schemeType',
        populate: { path: 'schemePlanId', select: 'name type' },
      })
      .sort({ paymentDate: -1 })
      .limit(5000)
      .lean(),
  ]);
  return { summary, payments };
}

export async function staffPerformanceReport(from?: Date, to?: Date) {
  const dateMatch = paymentDateMatch(from, to);
  const paymentMatch = { status: 'SUCCESS', collectorRole: 'STAFF', ...dateMatch };
  const [profiles, totals, submissions] = await Promise.all([
    StaffProfile.find().populate('userId', 'name phone status').lean(),
    Payment.aggregate([
      { $match: paymentMatch },
      {
        $group: {
          _id: '$collectedBy',
          totalPaise: { $sum: '$amountPaise' },
          cashPaise: { $sum: { $cond: [{ $eq: ['$method', 'CASH'] }, '$amountPaise', 0] } },
          phonepePaise: { $sum: { $cond: [{ $eq: ['$method', 'PHONEPE'] }, '$amountPaise', 0] } },
          upiPaise: { $sum: { $cond: [{ $eq: ['$method', 'UPI'] }, '$amountPaise', 0] } },
          bankPaise: { $sum: { $cond: [{ $eq: ['$method', 'BANK'] }, '$amountPaise', 0] } },
          cardPaise: { $sum: { $cond: [{ $eq: ['$method', 'CARD'] }, '$amountPaise', 0] } },
          cashCount: { $sum: { $cond: [{ $eq: ['$method', 'CASH'] }, 1, 0] } },
          phonepeCount: { $sum: { $cond: [{ $eq: ['$method', 'PHONEPE'] }, 1, 0] } },
          upiCount: { $sum: { $cond: [{ $eq: ['$method', 'UPI'] }, 1, 0] } },
          bankCount: { $sum: { $cond: [{ $eq: ['$method', 'BANK'] }, 1, 0] } },
          cardCount: { $sum: { $cond: [{ $eq: ['$method', 'CARD'] }, 1, 0] } },
          paymentCount: { $sum: 1 },
        },
      },
    ]),
    CashSubmission.aggregate([
      { $match: { status: 'SUCCESS', ...submissionDateMatch(from, to) } },
      { $group: { _id: '$staffId', submittedPaise: { $sum: '$amountPaise' } } },
    ]),
  ]);

  return profiles.map((profile: any) => {
    const userId = String(profile.userId?._id ?? profile.userId);
    const totalRow = totals.find((row: any) => String(row._id) === userId);
    const submissionRow = submissions.find((row: any) => String(row._id) === userId);
    const cashPaise = totalRow?.cashPaise ?? 0;
    const submittedPaise = submissionRow?.submittedPaise ?? 0;
    const byMethod = [
      {
        method: 'CASH',
        totalPaise: totalRow?.cashPaise ?? 0,
        count: totalRow?.cashCount ?? 0,
      },
      {
        method: 'UPI',
        totalPaise: (totalRow?.upiPaise ?? 0) + (totalRow?.phonepePaise ?? 0),
        count: (totalRow?.upiCount ?? 0) + (totalRow?.phonepeCount ?? 0),
      },
      {
        method: 'BANK',
        totalPaise: totalRow?.bankPaise ?? 0,
        count: totalRow?.bankCount ?? 0,
      },
      {
        method: 'CARD',
        totalPaise: totalRow?.cardPaise ?? 0,
        count: totalRow?.cardCount ?? 0,
      },
    ];
    return {
      ...profile,
      totalPaise: totalRow?.totalPaise ?? 0,
      paymentCount: totalRow?.paymentCount ?? 0,
      cashCollectedPaise: cashPaise,
      cashSubmittedPaise: submittedPaise,
      cashWithStaffPaise: cashPaise - submittedPaise,
      byMethod,
    };
  });
}

export async function maturityCalendar(from = new Date(), to?: Date) {
  const end = to ?? new Date(from.getTime() + 366 * 86_400_000);
  return SchemeEnrollment.find({
    maturityDate: mongoose.trusted({ $gte: from, $lte: end }),
    status: mongoose.trusted({ $in: ['ACTIVE', 'MATURED'] }),
  })
    .populate({ path: 'customerId', populate: { path: 'userId', select: 'name phone' } })
    .populate('schemePlanId', 'name type')
    .sort({ maturityDate: 1 })
    .lean();
}

export async function allSchemesReport() {
  const enrollments = await SchemeEnrollment.find({
    status: mongoose.trusted({ $in: ['ACTIVE', 'MATURED'] }),
  })
    .populate({ path: 'customerId', populate: { path: 'userId', select: 'name phone' } })
    .populate('schemePlanId', 'name type')
    .sort({ maturityDate: 1 })
    .lean();
  const goldEnrollments = enrollments.filter((row: any) => row.schemeType === 'GOLD_WEIGHT');
  return {
    totalPaidPaise: enrollments.reduce(
      (sum: number, row: any) => sum + (row.totalPaidPaise ?? 0),
      0,
    ),
    totalGoldWeightMg: goldEnrollments.reduce(
      (sum: number, row: any) => sum + (row.totalGoldWeightMg ?? 0),
      0,
    ),
    activeSchemes: enrollments.filter((row: any) => row.status === 'ACTIVE').length,
    maturedSchemes: enrollments.filter((row: any) => row.status === 'MATURED').length,
    cashSchemes: enrollments.filter((row: any) => row.schemeType === 'CASH').length,
    goldSchemes: goldEnrollments.length,
    enrollments,
  };
}

export async function goldLiabilityReport() {
  const enrollments = await SchemeEnrollment.find({
    schemeType: 'GOLD_WEIGHT',
    status: mongoose.trusted({ $in: ['ACTIVE', 'MATURED'] }),
  })
    .populate({ path: 'customerId', populate: { path: 'userId', select: 'name phone' } })
    .populate('schemePlanId', 'name')
    .sort({ totalGoldWeightMg: -1 })
    .lean();
  return {
    totalGoldWeightMg: enrollments.reduce(
      (sum: number, enrollment: any) => sum + (enrollment.totalGoldWeightMg ?? 0),
      0,
    ),
    enrollments,
  };
}

export async function schemeLedger(enrollmentId: string) {
  const [enrollment, payments, payouts] = await Promise.all([
    SchemeEnrollment.findById(enrollmentId)
      .populate({ path: 'customerId', populate: { path: 'userId', select: 'name phone' } })
      .populate('schemePlanId')
      .lean(),
    Payment.find({ schemeId: enrollmentId }).sort({ paymentDate: -1 }).lean(),
    Payout.find({ schemeId: enrollmentId }).sort({ payoutDate: -1 }).lean(),
  ]);
  if (!enrollment) throw new AppError('SCHEME_NOT_FOUND', 'Enrollment not found', 404);
  return { enrollment, payments, payouts };
}

export async function customerLedger(customerId: string) {
  const [customer, enrollments, payments, payouts, paymentIntents] = await Promise.all([
    Customer.findById(customerId)
      .populate('userId', 'name phone status')
      .populate('nomineeId')
      .lean(),
    SchemeEnrollment.find({ customerId }).populate('schemePlanId', 'name type').lean(),
    Payment.find({ customerId }).sort({ paymentDate: -1 }).lean(),
    Payout.find({ customerId }).sort({ payoutDate: -1 }).lean(),
    PaymentIntent.find({ customerId }).sort({ createdAt: -1 }).lean(),
  ]);
  if (!customer) throw new AppError('CUSTOMER_NOT_FOUND', 'Customer not found', 404);
  return { customer, enrollments, payments, payouts, paymentIntents };
}

export async function adminReport(
  report: string,
  options: { from?: Date; to?: Date; id?: string } = {},
) {
  switch (report) {
    case 'collection':
      return collectionReport(undefined, options.from, options.to);
    case 'phonepe':
      return collectionReport('PHONEPE', options.from, options.to);
    case 'cash':
      return collectionReport('CASH', options.from, options.to);
    case 'staff-performance':
      return staffPerformanceReport(options.from, options.to);
    case 'gold-liability':
      return goldLiabilityReport();
    case 'all-schemes':
      return allSchemesReport();
    case 'maturity':
      return maturityCalendar(options.from, options.to);
    case 'cash-position':
      return financialDashboard();
    case 'payouts':
      return Payout.find()
        .populate('customerId')
        .populate('schemeId')
        .sort({ payoutDate: -1 })
        .lean();
    case 'scheme-ledger':
      if (!options.id) throw new AppError('VALIDATION_ERROR', 'Scheme ID is required', 422);
      return schemeLedger(options.id);
    case 'customer-ledger':
      if (!options.id) throw new AppError('VALIDATION_ERROR', 'Customer ID is required', 422);
      return customerLedger(options.id);
    default:
      throw new AppError('REPORT_NOT_FOUND', 'Report type is not supported', 404);
  }
}
