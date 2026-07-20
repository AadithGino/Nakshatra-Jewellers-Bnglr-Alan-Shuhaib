import { createSchema, objectIdField, registerModel, Schema } from './model-helpers.js';
import { PAYMENT_METHODS, PAYMENT_STATUSES, ROLES } from './enums.js';

const paymentSchema = createSchema({
  customerId: { ...objectIdField('Customer'), index: true },
  schemeId: { ...objectIdField('SchemeEnrollment'), index: true },
  amountPaise: { type: Number, required: true, min: 1 },
  method: { type: String, enum: PAYMENT_METHODS, required: true, index: true },
  status: { type: String, enum: PAYMENT_STATUSES, required: true, index: true },
  paymentDate: { type: Date, required: true, index: true },
  schemeMonth: { type: Number, required: true, min: 1 },
  receiptNumber: { type: String, unique: true, sparse: true },
  referenceNumber: String,
  notes: String,
  collectedBy: objectIdField('User', false),
  collectorRole: { type: String, enum: ROLES, required: true },
  supersedesPaymentId: objectIdField('Payment', false),
  correctionId: objectIdField('PaymentCorrection', false),
  merchantTransactionId: { type: String, unique: true, sparse: true },
  providerTransactionId: { type: String, unique: true, sparse: true },
  idempotencyKey: String,
  goldRateId: objectIdField('GoldRate', false),
  goldRatePerGramPaise: Number,
  goldPurity: String,
  goldWeightMg: { type: Number, min: 0 },
  reversedAt: Date,
  reversedBy: objectIdField('User', false),
  reversalReason: String,
  originalSnapshot: Schema.Types.Mixed,
  createdBy: objectIdField('User'),
  updatedBy: objectIdField('User', false),
});

paymentSchema.index({ schemeId: 1, schemeMonth: 1, status: 1 });
paymentSchema.index({ collectedBy: 1, method: 1, status: 1 });

export const Payment = registerModel('Payment', paymentSchema);
