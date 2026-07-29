import mongoose from "mongoose";
import { env } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import {
  Customer,
  GoldRate,
  Nominee,
  SchemeEnrollment,
  SchemePlan,
  StaffProfile,
  User,
} from "../models/index.js";
import { hashPassword } from "../services/auth.service.js";
import { enrollmentDates } from "../services/scheme.service.js";

if (env.NODE_ENV === "production")
  throw new Error("Seed is forbidden in production");
await connectDatabase();
const passwordHash = await hashPassword("Nakshathra@123");
const admin = await User.findOneAndUpdate(
  { phone: "+919999999901" },
  {
    $setOnInsert: {
      name: "Nakshathra Admin",
      phone: "+919999999901",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  },
  { upsert: true, new: true },
);
const staffUser = await User.findOneAndUpdate(
  { phone: "+919999999902" },
  {
    $setOnInsert: {
      name: "Demo Staff",
      phone: "+919999999902",
      passwordHash,
      role: "STAFF",
      status: "ACTIVE",
      createdBy: admin._id,
    },
  },
  { upsert: true, new: true },
);
await StaffProfile.findOneAndUpdate(
  { userId: staffUser._id },
  {
    $setOnInsert: {
      employeeCode: "NKS-S001",
      permissions: [
        "canCreateCustomer",
        "canEnrollScheme",
        "canCollectPayment",
        "canViewCustomers",
        "canSubmitCorrectionRequest",
      ],
    },
  },
  { upsert: true },
);
const customerUser = await User.findOneAndUpdate(
  { phone: "+919999999903" },
  {
    $setOnInsert: {
      name: "Demo Customer",
      phone: "+919999999903",
      passwordHash,
      role: "CUSTOMER",
      status: "ACTIVE",
      createdBy: admin._id,
    },
  },
  { upsert: true, new: true },
);
const nominee = await Nominee.findOneAndUpdate(
  { name: "Demo Nominee", phone: "+919999999904" },
  {
    $setOnInsert: {
      name: "Demo Nominee",
      relationship: "Spouse",
      phone: "+919999999904",
      createdBy: admin._id,
    },
  },
  { upsert: true, new: true },
);
const customer = await Customer.findOneAndUpdate(
  { userId: customerUser._id },
  {
    $setOnInsert: {
      customerCode: "00001",
      nomineeId: nominee._id,
      status: "ACTIVE",
      createdBy: admin._id,
    },
  },
  { upsert: true, new: true },
);
const plan = await SchemePlan.findOneAndUpdate(
  { name: "Nakshathra Gold Eleven" },
  {
    $setOnInsert: {
      name: "Nakshathra Gold Eleven",
      type: "GOLD_WEIGHT",
      durationMonths: 11,
      flexibleMonths: 11,
      capMonths: 0,
      minimumPaymentPaise: 10000,
      termsText:
        "Flexible contributions throughout the full eleven-month duration.",
      benefitText: "Gold weight locked at each successful payment.",
      status: "ACTIVE",
      createdBy: admin._id,
    },
  },
  { upsert: true, new: true },
);
const start = new Date();
const dates = enrollmentDates(start, 6, 11);
await SchemeEnrollment.findOneAndUpdate(
  { enrollmentNumber: "NKS-E0001" },
  {
    $setOnInsert: {
      customerId: customer._id,
      schemePlanId: plan._id,
      enrollmentNumber: "NKS-E0001",
      schemeType: "GOLD_WEIGHT",
      startDate: start,
      ...dates,
      durationMonths: 11,
      flexibleMonths: 11,
      status: "ACTIVE",
      statusHistory: [{ status: "ACTIVE", at: new Date(), actorId: admin._id }],
      createdBy: admin._id,
    },
  },
  { upsert: true },
);
await GoldRate.findOneAndUpdate(
  {
    effectiveFrom: mongoose.trusted({
      $gte: new Date(new Date().setHours(0, 0, 0, 0)),
    }),
  },
  {
    $setOnInsert: {
      ratePerGramPaise: 750000,
      purity: "916",
      effectiveFrom: new Date(new Date().setHours(0, 0, 0, 0)),
      status: "ACTIVE",
      notes: "Development seed rate",
      createdBy: admin._id,
    },
  },
  { upsert: true },
);
process.stdout.write(
  "Seed complete. Admin +919999999901, Staff +919999999902, Customer +919999999903. Password: Nakshathra@123\n",
);
await disconnectDatabase();
