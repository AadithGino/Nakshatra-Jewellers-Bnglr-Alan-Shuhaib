import mongoose, { type ClientSession } from "mongoose";
import { withMongoTransaction } from "../utils/transaction.js";
import {
  Customer,
  Nominee,
  Payment,
  PaymentIntent,
  Payout,
  ReceiptCounter,
  SchemeEnrollment,
  User,
} from "../models/index.js";
import { AppError } from "../utils/AppError.js";
import { hashPassword } from "./auth.service.js";
import { audit, type AuditContext } from "./audit.service.js";
import { isOurStorageObject, signAadhaarUrls } from "./storage.service.js";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "../validators/customer.validators.js";

const PASSBOOK_SCOPE = "CUSTOMER-PASSBOOK";

function assertAadhaarKeys(aadhaar?: { frontKey?: string; backKey?: string }) {
  if (!aadhaar) return;
  for (const key of [aadhaar.frontKey, aadhaar.backKey]) {
    if (key && !isOurStorageObject(key)) {
      throw new AppError(
        "INVALID_UPLOAD_KEY",
        "Aadhaar upload key is not from the configured storage bucket",
        422,
      );
    }
  }
}

async function allocatePassbookNumber(session: ClientSession) {
  const [row] = await Customer.aggregate([
    { $match: { customerCode: { $regex: /^\d+$/ } } },
    { $addFields: { n: { $toInt: "$customerCode" } } },
    { $group: { _id: null, max: { $max: "$n" } } },
  ]).session(session);
  const floor = Number(row?.max ?? 0);

  await ReceiptCounter.findOneAndUpdate(
    { scope: PASSBOOK_SCOPE },
    { $max: { value: floor } },
    { upsert: true, session, setDefaultsOnInsert: true },
  );

  const counter = await ReceiptCounter.findOneAndUpdate(
    { scope: PASSBOOK_SCOPE },
    { $inc: { value: 1 } },
    { new: true, session },
  );
  return String(counter!.value).padStart(6, "0");
}

export async function createCustomer(
  input: CreateCustomerInput,
  context: AuditContext & { actorId: string },
) {
  assertAadhaarKeys(input.aadhaar);
  return withMongoTransaction(async (session) => {
    const customerCode = await allocatePassbookNumber(session);
    const [user] = await User.create(
      [
        {
          name: input.name,
          phone: input.phone,
          passwordHash: await hashPassword(input.password),
          role: "CUSTOMER",
          createdBy: context.actorId,
        },
      ],
      { session },
    );
    const nominee = input.nominee
      ? (
          await Nominee.create(
            [{ ...input.nominee, createdBy: context.actorId }],
            { session },
          )
        )[0]
      : null;
    const [customer] = await Customer.create(
      [
        {
          userId: user._id,
          customerCode,
          address: input.address,
          aadhaar: {
            frontKey: input.aadhaar?.frontKey,
            backKey: input.aadhaar?.backKey,
          },
          nomineeId: nominee?._id,
          createdBy: context.actorId,
        },
      ],
      { session },
    );
    await audit(
      session,
      context,
      "CUSTOMER_CREATED",
      "Customer",
      customer._id,
      undefined,
      customer.toObject(),
    );
    return customer;
  }, context.requestId);
}

export async function listCustomers(
  page: number,
  limit: number,
  search: string,
) {
  const userIds = search
    ? (
        await User.find({
          role: "CUSTOMER",
          $or: [
            { name: new RegExp(search, "i") },
            { phone: new RegExp(search, "i") },
          ],
        })
          .select("_id")
          .lean()
      ).map((user: any) => user._id)
    : [];
  const match = search
    ? {
        $or: [
          { customerCode: new RegExp(search, "i") },
          { userId: mongoose.trusted({ $in: userIds }) },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    Customer.find(match)
      .populate("userId", "name phone status")
      .populate("nomineeId")
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Customer.countDocuments(match),
  ]);

  return { items, total };
}

export async function getCustomerDetails(customerId: string) {
  const customer = await Customer.findById(customerId)
    .populate("userId", "name phone status lastLoginAt")
    .populate("nomineeId")
    .lean();
  if (!customer)
    throw new AppError("CUSTOMER_NOT_FOUND", "Customer not found", 404);

  const [schemes, payments, payouts, paymentIntents, aadhaar] = await Promise.all([
    SchemeEnrollment.find({ customerId })
      .populate("schemePlanId")
      .sort({ createdAt: -1 })
      .lean(),
    Payment.find({ customerId }).sort({ paymentDate: -1 }).limit(250).lean(),
    Payout.find({ customerId }).sort({ payoutDate: -1 }).lean(),
    PaymentIntent.find({ customerId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    signAadhaarUrls((customer as any).aadhaar),
  ]);

  return {
    customer: { ...customer, aadhaar },
    schemes,
    payments,
    payouts,
    paymentIntents,
  };
}

export async function updateCustomer(
  customerId: string,
  input: UpdateCustomerInput,
  context: AuditContext & { actorId: string },
) {
  assertAadhaarKeys(input.aadhaar);
  await withMongoTransaction(async (session) => {
    const customer = await Customer.findById(customerId).session(session);
    if (!customer)
      throw new AppError("CUSTOMER_NOT_FOUND", "Customer not found", 404);
    const user = await User.findById(customer.userId)
      .select("+sessionVersion")
      .session(session);
    if (!user)
      throw new AppError(
        "USER_NOT_FOUND",
        "Customer login account not found",
        404,
      );
    const before = { customer: customer.toObject(), user: user.toObject() };

    if (input.name !== undefined) user.name = input.name;
    if (input.phone !== undefined) user.phone = input.phone;
    if (input.status !== undefined) {
      customer.status = input.status;
      user.status = input.status;
      user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    }
    user.updatedBy = context.actorId;

    if (input.address !== undefined) customer.address = input.address;
    if (input.aadhaar !== undefined) {
      customer.set("aadhaar", {
        frontKey: input.aadhaar.frontKey ?? customer.get("aadhaar.frontKey"),
        backKey: input.aadhaar.backKey ?? customer.get("aadhaar.backKey"),
      });
    }
    customer.updatedBy = context.actorId;

    if (input.nominee) {
      let nominee = customer.nomineeId
        ? await Nominee.findById(customer.nomineeId).session(session)
        : null;
      if (!nominee) {
        [nominee] = await Nominee.create(
          [{ ...input.nominee, createdBy: context.actorId }],
          {
            session,
          },
        );
        customer.nomineeId = nominee._id;
      } else {
        Object.assign(nominee, input.nominee, { updatedBy: context.actorId });
        await nominee.save({ session });
      }
    }

    await Promise.all([user.save({ session }), customer.save({ session })]);
    await audit(
      session,
      context,
      "CUSTOMER_UPDATED",
      "Customer",
      customer._id,
      before,
      {
        customer: customer.toObject(),
        user: user.toObject(),
      },
    );
  }, context.requestId);

  return getCustomerDetails(customerId);
}
