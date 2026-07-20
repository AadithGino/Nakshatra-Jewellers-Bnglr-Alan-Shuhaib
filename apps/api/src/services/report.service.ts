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

export async function listPhonePeTransactions() {
  const intents = await PaymentIntent.find()
    .populate('customerId')
    .populate('schemeId', 'enrollmentNumber status')
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
  const transactionIds = intents.map((intent: any) => intent.merchantTransactionId);
  const [payments, events] = await Promise.all([
    Payment.find({
      merchantTransactionId: mongoose.trusted({ $in: transactionIds }),
    })
      .select('merchantTransactionId receiptNumber providerTransactionId status')
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
      providerTransactionId: payment?.providerTransactionId,
      webhookStatus: event ? (event.processedAt ? 'PROCESSED' : 'RECEIVED') : 'NOT_RECEIVED',
      receiptStatus: payment?.receiptNumber ? 'GENERATED' : 'PENDING',
      receiptNumber: payment?.receiptNumber,
    };
  });
}

export async function getAdminOperationRecord(module: string, recordId: string) {
  const queries: Record<string, () => Promise<any>> = {
    'scheme-plans': () => SchemePlan.findById(recordId).lean(),
    enrollments: () =>
      SchemeEnrollment.findById(recordId).populate('customerId').populate('schemePlanId').lean(),
    'gold-rates': () => GoldRate.findById(recordId).lean(),
    payments: () => Payment.findById(recordId).populate('customerId').populate('schemeId').lean(),
    'cash-submissions': () =>
      CashSubmission.findById(recordId).populate('staffId', 'name phone').lean(),
    corrections: () =>
      PaymentCorrection.findById(recordId)
        .populate('paymentId')
        .populate('requestedBy', 'name phone')
        .lean(),
    payouts: () => Payout.findById(recordId).populate('customerId').populate('schemeId').lean(),
    'audit-logs': () => AuditLog.findById(recordId).lean(),
  };
  if (module === 'phonepe-transactions') {
    const records = await listPhonePeTransactions();
    const record = records.find((item: any) => String(item._id) === recordId);
    if (!record) throw new AppError('RECORD_NOT_FOUND', 'Operation record not found', 404);
    return record;
  }
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
      .populate('customerId')
      .populate('schemeId', 'enrollmentNumber schemeType')
      .sort({ paymentDate: -1 })
      .limit(1000)
      .lean(),
  ]);
  return { summary, payments };
}

export async function staffPerformanceReport() {
  const [profiles, totals, submissions] = await Promise.all([
    StaffProfile.find().populate('userId', 'name phone status').lean(),
    Payment.aggregate([
      { $match: { status: 'SUCCESS', collectorRole: 'STAFF' } },
      {
        $group: {
          _id: '$collectedBy',
          totalPaise: { $sum: '$amountPaise' },
          cashPaise: { $sum: { $cond: [{ $eq: ['$method', 'CASH'] }, '$amountPaise', 0] } },
          paymentCount: { $sum: 1 },
        },
      },
    ]),
    CashSubmission.aggregate([
      { $match: { status: 'SUCCESS' } },
      { $group: { _id: '$staffId', submittedPaise: { $sum: '$amountPaise' } } },
    ]),
  ]);

  return profiles.map((profile: any) => {
    const userId = String(profile.userId?._id ?? profile.userId);
    const totalRow = totals.find((row: any) => String(row._id) === userId);
    const submissionRow = submissions.find((row: any) => String(row._id) === userId);
    const cashPaise = totalRow?.cashPaise ?? 0;
    const submittedPaise = submissionRow?.submittedPaise ?? 0;
    return {
      ...profile,
      totalPaise: totalRow?.totalPaise ?? 0,
      paymentCount: totalRow?.paymentCount ?? 0,
      cashCollectedPaise: cashPaise,
      cashSubmittedPaise: submittedPaise,
      cashWithStaffPaise: cashPaise - submittedPaise,
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
      return staffPerformanceReport();
    case 'gold-liability':
      return goldLiabilityReport();
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
