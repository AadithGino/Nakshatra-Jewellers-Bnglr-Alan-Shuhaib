import mongoose, { type ClientSession } from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { withMongoTransaction } from '../utils/transaction.js';
import { CashSubmission, Payment, PaymentCorrection, StaffProfile, User } from '../models/index.js';
import { hashPassword } from './auth.service.js';
import { audit, type AuditContext } from './audit.service.js';
import type { CreateStaffInput, UpdateStaffInput } from '../validators/staff.validators.js';
import { paymentDateMatch, staffMemberReport, submissionDateMatch } from './report.service.js';

export async function createStaff(
  input: CreateStaffInput,
  context: AuditContext & { actorId: string },
) {
  return withMongoTransaction(async (session) => {
    const [user] = await User.create(
      [
        {
          name: input.name,
          phone: input.phone,
          passwordHash: await hashPassword(input.password),
          role: 'STAFF',
          createdBy: context.actorId,
        },
      ],
      { session },
    );
    const [profile] = await StaffProfile.create(
      [
        {
          userId: user._id,
          employeeCode: input.employeeCode,
          permissions: input.permissions,
          notes: input.notes,
          createdBy: context.actorId,
        },
      ],
      { session },
    );

    await audit(session, context, 'STAFF_CREATED', 'User', user._id, undefined, {
      name: user.name,
      phone: user.phone,
      role: user.role,
      employeeCode: profile.employeeCode,
    });
    return { userId: user._id, profileId: profile._id };
  }, context.requestId);
}

export async function updateUserStatus(
  userId: string,
  status: 'ACTIVE' | 'INACTIVE',
  context: AuditContext & { actorId: string },
) {
  return withMongoTransaction(async (session) => {
    const user = await User.findById(userId).select('+sessionVersion').session(session);
    if (!user) throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    const before = { status: user.status };
    user.status = status;
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    user.updatedBy = context.actorId;
    await user.save({ session });
    await audit(session, context, 'USER_STATUS_UPDATED', 'User', user._id, before, {
      status: user.status,
    });
    return { id: user._id, status: user.status };
  }, context.requestId);
}

export async function resetUserPassword(
  userId: string,
  newPassword: string,
  context: AuditContext & { actorId: string },
) {
  return withMongoTransaction(async (session: ClientSession) => {
    const user = await User.findById(userId)
      .select('+passwordHash +sessionVersion')
      .session(session);
    if (!user) throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    user.passwordHash = await hashPassword(newPassword);
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    await user.save({ session });
    await audit(session, context, 'PASSWORD_RESET', 'User', user._id, undefined, {
      sessionVersion: user.sessionVersion,
    });
    return { id: user._id, reset: true };
  }, context.requestId);
}

export async function listStaff(page: number, limit: number, search = '') {
  const userIds = search
    ? (
        await User.find({
          role: 'STAFF',
          $or: [{ name: new RegExp(search, 'i') }, { phone: new RegExp(search, 'i') }],
        })
          .select('_id')
          .lean()
      ).map((user: any) => user._id)
    : [];
  const match = search
    ? {
        $or: [
          { employeeCode: new RegExp(search, 'i') },
          { userId: mongoose.trusted({ $in: userIds }) },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    StaffProfile.find(match)
      .populate('userId', 'name phone status lastLoginAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    StaffProfile.countDocuments(match),
  ]);

  return { items, total };
}

async function resolveStaffProfile(id: string, session?: ClientSession) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('STAFF_NOT_FOUND', 'Staff member not found', 404);
  }
  const objectId = new mongoose.Types.ObjectId(id);
  const profile = await StaffProfile.findOne({
    $or: [{ _id: objectId }, { userId: objectId }],
  }).session(session ?? null);
  if (!profile) throw new AppError('STAFF_NOT_FOUND', 'Staff member not found', 404);
  return profile;
}

export async function getStaffDetails(id: string, from?: Date, to?: Date) {
  const profile = await resolveStaffProfile(id);
  const staffUserId = String(profile.userId);
  const [populatedProfile, report, payments, submissions, corrections] = await Promise.all([
    StaffProfile.findById(profile._id).populate('userId', 'name phone status lastLoginAt').lean(),
    staffMemberReport(staffUserId, from, to),
    listStaffPayments(staffUserId, from, to),
    listStaffCashSubmissions(staffUserId, from, to),
    listStaffCorrections(staffUserId),
  ]);
  return {
    profile: populatedProfile,
    report,
    payments,
    submissions,
    corrections,
    range: {
      from: from?.toISOString() ?? null,
      to: to?.toISOString() ?? null,
    },
  };
}

export async function updateStaff(
  id: string,
  input: UpdateStaffInput,
  context: AuditContext & { actorId: string },
) {
  const profileId = await withMongoTransaction(async (session) => {
    const profile = await resolveStaffProfile(id, session);
    const user = await User.findById(profile.userId).session(session);
    if (!user) throw new AppError('USER_NOT_FOUND', 'Staff login account not found', 404);
    const before = { profile: profile.toObject(), user: user.toObject() };

    if (input.name !== undefined) user.name = input.name;
    if (input.phone !== undefined) user.phone = input.phone;
    user.updatedBy = context.actorId;
    if (input.employeeCode !== undefined) profile.employeeCode = input.employeeCode;
    if (input.permissions !== undefined) profile.permissions = input.permissions;
    if (input.notes !== undefined) profile.notes = input.notes;
    profile.updatedBy = new mongoose.Types.ObjectId(context.actorId);

    await Promise.all([user.save({ session }), profile.save({ session })]);
    await audit(session, context, 'STAFF_UPDATED', 'StaffProfile', profile._id, before, {
      profile: profile.toObject(),
      user: user.toObject(),
    });
    return String(profile._id);
  }, context.requestId);

  return getStaffDetails(profileId);
}

export const listStaffPayments = (staffId: string, from?: Date, to?: Date) =>
  Payment.find({
    collectedBy: staffId,
    collectorRole: 'STAFF',
    ...paymentDateMatch(from, to),
  })
    .populate({ path: 'customerId', populate: { path: 'userId', select: 'name phone' } })
    .populate('schemeId', 'enrollmentNumber schemeType')
    .sort({ paymentDate: -1 })
    .limit(200)
    .lean();

export const listStaffCorrections = (staffId: string) =>
  PaymentCorrection.find({ requestedBy: staffId }).sort({ createdAt: -1 }).lean();

export const listStaffCashSubmissions = (staffId: string, from?: Date, to?: Date) =>
  CashSubmission.find({
    staffId,
    ...submissionDateMatch(from, to),
  })
    .sort({ submissionDate: -1 })
    .lean();

export const getStaffProfile = (staffId: string) =>
  StaffProfile.findOne({ userId: staffId }).populate('userId', 'name phone lastLoginAt').lean();

export async function getStaffReceipt(staffId: string, paymentId: string) {
  const payment = await Payment.findOne({
    _id: paymentId,
    collectedBy: staffId,
    status: mongoose.trusted({ $in: ['SUCCESS', 'REVERSED'] }),
  }).lean();
  if (!payment) throw new AppError('RECEIPT_NOT_FOUND', 'Receipt not found', 404);
  return { receiptNumber: payment.receiptNumber, payment };
}
