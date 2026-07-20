import { createSchema, objectIdField, registerModel } from './model-helpers.js';
import { PAYMENT_STATUSES } from './enums.js';

const paymentIntentSchema = createSchema({
  customerId: objectIdField('Customer'),
  schemeId: objectIdField('SchemeEnrollment'),
  amountPaise: { type: Number, required: true },
  merchantTransactionId: { type: String, required: true, unique: true },
  provider: { type: String, enum: ['PHONEPE'], default: 'PHONEPE' },
  status: { type: String, enum: PAYMENT_STATUSES, default: 'INITIATED' },
  providerOrderId: String,
  checkoutUrl: String,
  expiresAt: Date,
  idempotencyKey: { type: String, required: true },
  goldRateId: objectIdField('GoldRate', false),
  goldRatePerGramPaise: Number,
  goldWeightMg: { type: Number, min: 0 },
  goldPurity: { type: String, enum: ['916'] },
  quoteCreatedAt: Date,
  quoteExpiresAt: Date,
  createdBy: objectIdField('User'),
});

paymentIntentSchema.index({ customerId: 1, idempotencyKey: 1 }, { unique: true });

export const PaymentIntent = registerModel('PaymentIntent', paymentIntentSchema);
