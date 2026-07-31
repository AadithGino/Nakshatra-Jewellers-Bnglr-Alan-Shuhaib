import type { ClientSession } from "mongoose";
import { AppError } from "../utils/AppError.js";
import { withMongoTransaction } from "../utils/transaction.js";
import {
  Customer,
  GoldRate,
  Payment,
  Payout,
  ReceiptCounter,
  SchemeEnrollment,
  SchemePlan,
} from "../models/index.js";
import { enrollmentDates } from "./scheme.service.js";
import { audit, outbox, type AuditContext } from "./audit.service.js";
import type {
  CreateEnrollmentInput,
  CreateGoldRateInput,
  CreateSchemePlanInput,
  UpdateSchemePlanInput,
  UpdateGoldRateInput,
} from "../validators/scheme.validators.js";

const ENROLLMENT_SCOPE_PREFIX = "ENROLLMENT";

export async function allocateEnrollmentNumber(
  session: ClientSession,
  startDate: Date,
) {
  const year = startDate.getFullYear();
  const counter = await ReceiptCounter.findOneAndUpdate(
    { scope: `${ENROLLMENT_SCOPE_PREFIX}-${year}` },
    { $inc: { value: 1 } },
    { upsert: true, new: true, session, setDefaultsOnInsert: true },
  );
  return `ENR-${year}-${String(counter.value).padStart(6, "0")}`;
}

export async function createEnrollmentRecord(
  input: CreateEnrollmentInput,
  context: AuditContext & { actorId: string },
  session: ClientSession,
) {
  const [customer, plan] = await Promise.all([
    Customer.findById(input.customerId).session(session),
    SchemePlan.findOne({ _id: input.schemePlanId, status: "ACTIVE" }).session(session),
  ]);
  if (!customer || !plan) {
    throw new AppError(
      "ENROLLMENT_INPUT_INVALID",
      "Customer or active plan not found",
      404,
    );
  }
  const existingActiveEnrollment = await SchemeEnrollment.exists({
    customerId: customer._id,
    status: "ACTIVE",
  }).session(session);
  if (existingActiveEnrollment) {
    throw new AppError(
      "CUSTOMER_ALREADY_ENROLLED",
      "This customer already has an active scheme. Complete or settle it before enrolling again.",
      409,
    );
  }

  const enrollmentNumber =
    input.enrollmentNumber?.trim() ||
    (await allocateEnrollmentNumber(session, input.startDate));
  const dates = enrollmentDates(
    input.startDate,
    plan.flexibleMonths,
    plan.durationMonths,
  );
  const [enrollment] = await SchemeEnrollment.create(
    [
      {
        customerId: input.customerId,
        schemePlanId: input.schemePlanId,
        enrollmentNumber,
        startDate: input.startDate,
        ...dates,
        schemeType: plan.type,
        durationMonths: plan.durationMonths,
        flexibleMonths: plan.flexibleMonths,
        statusHistory: [{ status: "ACTIVE", at: new Date(), actorId: context.actorId }],
        createdBy: context.actorId,
      },
    ],
    { session },
  );
  await audit(
    session,
    context,
    "SCHEME_ENROLLED",
    "SchemeEnrollment",
    enrollment._id,
    undefined,
    enrollment.toObject(),
  );
  await outbox(session, "SCHEME_ENROLLED", "SchemeEnrollment", enrollment._id, {
    customerId: customer._id,
  });
  return enrollment;
}

export const createSchemePlan = (
  input: CreateSchemePlanInput,
  context: AuditContext & { actorId: string },
) =>
  withMongoTransaction(async (session) => {
    const [plan] = await SchemePlan.create(
      [
        {
          ...input,
          flexibleMonths: input.durationMonths,
          capMonths: 0,
          createdBy: context.actorId,
        },
      ],
      { session },
    );
    await audit(
      session,
      context,
      "SCHEME_PLAN_CREATED",
      "SchemePlan",
      plan._id,
      undefined,
      plan.toObject(),
    );
    return plan;
  }, context.requestId);

export const listSchemePlans = () =>
  SchemePlan.find({ deletedAt: null }).sort({ createdAt: -1 }).lean();

export const listActiveSchemePlans = () =>
  SchemePlan.find({ deletedAt: null, status: "ACTIVE" })
    .sort({ name: 1 })
    .lean();

export async function getSchemePlan(planId: string) {
  const plan = await SchemePlan.findOne({
    _id: planId,
    deletedAt: null,
  }).lean();
  if (!plan)
    throw new AppError("SCHEME_PLAN_NOT_FOUND", "Scheme plan not found", 404);
  return plan;
}

export async function updateSchemePlan(
  planId: string,
  input: UpdateSchemePlanInput,
  context: AuditContext & { actorId: string },
) {
  return withMongoTransaction(async (session) => {
    const plan = await SchemePlan.findOne({
      _id: planId,
      deletedAt: null,
    }).session(session);
    if (!plan)
      throw new AppError("SCHEME_PLAN_NOT_FOUND", "Scheme plan not found", 404);
    const before = plan.toObject();
    Object.assign(plan, input, { updatedBy: context.actorId });
    plan.flexibleMonths = plan.durationMonths;
    plan.capMonths = 0;
    await plan.save({ session });
    await audit(
      session,
      context,
      "SCHEME_PLAN_UPDATED",
      "SchemePlan",
      plan._id,
      before,
      plan.toObject(),
    );
    return plan;
  }, context.requestId);
}

export async function createEnrollment(
  input: CreateEnrollmentInput,
  context: AuditContext & { actorId: string },
) {
  return withMongoTransaction(
    (session) => createEnrollmentRecord(input, context, session),
    context.requestId,
  );
}

export async function listEnrollments(page: number, limit: number) {
  const [items, total] = await Promise.all([
    SchemeEnrollment.find()
      .populate({
        path: 'customerId',
        populate: { path: 'userId', select: 'name phone' },
      })
      .populate('schemePlanId', 'name type status minimumPaymentPaise durationMonths')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SchemeEnrollment.countDocuments(),
  ]);

  return { items, total };
}

export async function getEnrollmentDetails(enrollmentId: string) {
  const [enrollment, payments, payouts] = await Promise.all([
    SchemeEnrollment.findById(enrollmentId)
      .populate({
        path: "customerId",
        populate: { path: "userId", select: "name phone status" },
      })
      .populate("schemePlanId")
      .lean(),
    Payment.find({ schemeId: enrollmentId })
      .sort({ paymentDate: -1 })
      .limit(100)
      .lean(),
    Payout.find({ schemeId: enrollmentId }).sort({ payoutDate: -1 }).limit(50).lean(),
  ]);
  if (!enrollment)
    throw new AppError("SCHEME_NOT_FOUND", "Enrollment not found", 404);
  return { enrollment, payments, payouts };
}

export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: "ACTIVE" | "MATURED" | "REDEEMED" | "CLOSED" | "WITHDRAWN",
  reason: string,
  context: AuditContext & { actorId: string },
) {
  return withMongoTransaction(async (session) => {
    const enrollment =
      await SchemeEnrollment.findById(enrollmentId).session(session);
    if (!enrollment)
      throw new AppError("SCHEME_NOT_FOUND", "Enrollment not found", 404);
    const before = enrollment.toObject();
    enrollment.status = status;
    enrollment.updatedBy = context.actorId;
    enrollment.statusHistory.push({
      status,
      at: new Date(),
      actorId: context.actorId,
      reason,
    });
    await enrollment.save({ session });
    await audit(
      session,
      context,
      "SCHEME_STATUS_UPDATED",
      "SchemeEnrollment",
      enrollment._id,
      before,
      enrollment.toObject(),
    );
    await outbox(
      session,
      "SCHEME_STATUS_UPDATED",
      "SchemeEnrollment",
      enrollment._id,
      {
        customerId: enrollment.customerId,
        status,
      },
    );
    return enrollment;
  }, context.requestId);
}

export const listGoldRates = () =>
  GoldRate.find().sort({ effectiveFrom: -1 }).lean();

export async function getGoldRate(rateId: string) {
  const rate = await GoldRate.findById(rateId)
    .populate('createdBy', 'name')
    .populate('updatedBy', 'name')
    .lean();
  if (!rate) throw new AppError('GOLD_RATE_NOT_FOUND', 'Gold rate not found', 404);
  return rate;
}

export async function createGoldRate(
  input: CreateGoldRateInput,
  context: AuditContext & { actorId: string },
) {
  return withMongoTransaction(async (session) => {
    const [rate] = await GoldRate.create(
      [{ ...input, createdBy: context.actorId }],
      {
        session,
      },
    );
    await audit(
      session,
      context,
      "GOLD_RATE_CREATED",
      "GoldRate",
      rate._id,
      undefined,
      rate.toObject(),
    );
    return rate;
  }, context.requestId);
}

export async function updateGoldRate(
  rateId: string,
  input: UpdateGoldRateInput,
  context: AuditContext & { actorId: string },
) {
  return withMongoTransaction(async (session) => {
    const rate = await GoldRate.findById(rateId).session(session);
    if (!rate)
      throw new AppError("GOLD_RATE_NOT_FOUND", "Gold rate not found", 404);
    const changesFinancialSnapshot =
      input.ratePerGramPaise !== undefined ||
      input.purity !== undefined ||
      input.effectiveFrom !== undefined;
    if (rate.usageCount > 0 && changesFinancialSnapshot) {
      throw new AppError(
        "GOLD_RATE_LOCKED",
        "A used gold rate cannot be financially edited",
        409,
      );
    }
    const before = rate.toObject();
    Object.assign(rate, input, { updatedBy: context.actorId });
    await rate.save({ session });
    await audit(
      session,
      context,
      "GOLD_RATE_UPDATED",
      "GoldRate",
      rate._id,
      before,
      rate.toObject(),
    );
    return rate;
  }, context.requestId);
}
