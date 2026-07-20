import mongoose from 'mongoose';
import {
  Customer,
  GoldRate,
  Nominee,
  SchemeEnrollment,
  SchemePlan,
  StaffProfile,
  User,
} from '../models/index.js';
import { hashPassword } from './auth.service.js';
import { enrollmentDates } from './scheme.service.js';

export async function seedDemoData() {
  const passwordHash = await hashPassword('Nakshathra@123');
  const admin = await User.findOneAndUpdate(
    { phone: '+919999999901' },
    {
      $set: { passwordHash, status: 'ACTIVE' },
      $setOnInsert: { name: 'Nakshathra Admin', role: 'ADMIN' },
    },
    { upsert: true, new: true },
  );
  const staffUser = await User.findOneAndUpdate(
    { phone: '+919999999902' },
    {
      $set: { passwordHash, status: 'ACTIVE' },
      $setOnInsert: { name: 'Demo Staff', role: 'STAFF', createdBy: admin._id },
    },
    { upsert: true, new: true },
  );
  await StaffProfile.findOneAndUpdate(
    { userId: staffUser._id },
    {
      $setOnInsert: {
        employeeCode: 'NKS-S001',
        permissions: [
          'canCreateCustomer',
          'canEnrollScheme',
          'canCollectPayment',
          'canViewCustomers',
          'canSubmitCorrectionRequest',
        ],
      },
    },
    { upsert: true },
  );
  const customerUser = await User.findOneAndUpdate(
    { phone: '+919999999903' },
    {
      $set: { passwordHash, status: 'ACTIVE' },
      $setOnInsert: { name: 'Demo Customer', role: 'CUSTOMER', createdBy: admin._id },
    },
    { upsert: true, new: true },
  );
  const nominee = await Nominee.findOneAndUpdate(
    { name: 'Demo Nominee', phone: '+919999999904' },
    { $setOnInsert: { relationship: 'Spouse', createdBy: admin._id } },
    { upsert: true, new: true },
  );
  const customer = await Customer.findOneAndUpdate(
    { userId: customerUser._id },
    {
      $setOnInsert: {
        customerCode: 'NKS-C0001',
        nomineeId: nominee._id,
        status: 'ACTIVE',
        createdBy: admin._id,
      },
    },
    { upsert: true, new: true },
  );
  const plan = await SchemePlan.findOneAndUpdate(
    { name: 'Nakshathra Gold Eleven' },
    {
      $setOnInsert: {
        type: 'GOLD_WEIGHT',
        durationMonths: 11,
        flexibleMonths: 6,
        capMonths: 5,
        minimumPaymentPaise: 10_000,
        termsText: 'Six flexible months followed by five average-capped months.',
        benefitText: 'Gold weight locked at each successful payment.',
        status: 'ACTIVE',
        createdBy: admin._id,
      },
    },
    { upsert: true, new: true },
  );
  const start = new Date();
  const dates = enrollmentDates(start, 6, 11);
  await SchemeEnrollment.findOneAndUpdate(
    { enrollmentNumber: 'NKS-E0001' },
    {
      $setOnInsert: {
        customerId: customer._id,
        schemePlanId: plan._id,
        schemeType: 'GOLD_WEIGHT',
        startDate: start,
        ...dates,
        durationMonths: 11,
        flexibleMonths: 6,
        status: 'ACTIVE',
        statusHistory: [{ status: 'ACTIVE', at: new Date(), actorId: admin._id }],
        createdBy: admin._id,
      },
    },
    { upsert: true },
  );
  const effectiveFrom = new Date();
  effectiveFrom.setHours(0, 0, 0, 0);
  await GoldRate.findOneAndUpdate(
    { effectiveFrom: mongoose.trusted({ $gte: effectiveFrom }) },
    {
      $setOnInsert: {
        ratePerGramPaise: 750_000,
        purity: '916',
        effectiveFrom,
        status: 'ACTIVE',
        notes: 'Opt-in testing rate',
        createdBy: admin._id,
      },
    },
    { upsert: true },
  );
}
