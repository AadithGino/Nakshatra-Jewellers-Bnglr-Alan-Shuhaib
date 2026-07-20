import { createSchema, objectIdField, registerModel } from './model-helpers.js';
import { SCHEME_TYPES } from './enums.js';

const schemePlanSchema = createSchema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: SCHEME_TYPES, required: true, index: true },
  durationMonths: { type: Number, required: true, min: 2, default: 11 },
  flexibleMonths: { type: Number, required: true, min: 2, default: 11 },
  capMonths: { type: Number, required: true, min: 0, default: 0 },
  minimumPaymentPaise: { type: Number, required: true, min: 1 },
  makingChargeBenefit: String,
  wastageBenefit: String,
  benefitText: String,
  termsText: { type: String, required: true },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  createdBy: objectIdField('User'),
  updatedBy: objectIdField('User', false),
  deletedAt: Date,
});

schemePlanSchema.pre('validate', function validateFlexibleScheme(this: any) {
  if (this.flexibleMonths !== this.durationMonths || this.capMonths !== 0) {
    this.invalidate('capMonths', 'Scheme contributions must remain flexible for the full duration');
  }
});

export const SchemePlan = registerModel('SchemePlan', schemePlanSchema);
