import { createSchema, objectIdField, registerModel, Schema } from './model-helpers.js';
import { ENROLLMENT_STATUSES, SCHEME_TYPES } from './enums.js';

const schemeEnrollmentSchema = createSchema({
  customerId: objectIdField('Customer'),
  schemePlanId: objectIdField('SchemePlan'),
  enrollmentNumber: { type: String, required: true, unique: true },
  schemeType: { type: String, enum: SCHEME_TYPES, required: true },
  startDate: { type: Date, required: true },
  flexiblePeriodEndDate: { type: Date, required: true },
  maturityDate: { type: Date, required: true, index: true },
  durationMonths: { type: Number, required: true },
  flexibleMonths: { type: Number, required: true },
  averageMonthlyCapPaise: { type: Number, min: 0 },
  status: { type: String, enum: ENROLLMENT_STATUSES, default: 'ACTIVE', index: true },
  totalPaidPaise: { type: Number, default: 0, min: 0 },
  totalGoldWeightMg: { type: Number, default: 0, min: 0 },
  totalPayoutPaise: { type: Number, default: 0, min: 0 },
  statusHistory: [{ status: String, at: Date, actorId: Schema.Types.ObjectId, reason: String }],
  createdBy: objectIdField('User'),
  updatedBy: objectIdField('User', false),
});

schemeEnrollmentSchema.index({ customerId: 1, status: 1 });
schemeEnrollmentSchema.index(
  { customerId: 1 },
  { unique: true, partialFilterExpression: { status: 'ACTIVE' } },
);

export const SchemeEnrollment = registerModel('SchemeEnrollment', schemeEnrollmentSchema);
