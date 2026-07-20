import { createSchema, objectIdField, registerModel, Schema } from './model-helpers.js';

const paymentCorrectionSchema = createSchema({
  paymentId: objectIdField('Payment'),
  requestedBy: objectIdField('User'),
  correctionType: {
    type: String,
    enum: [
      'CHANGE_AMOUNT',
      'CHANGE_METHOD',
      'CHANGE_DATE',
      'CHANGE_REFERENCE',
      'CHANGE_NOTES',
      'REVERSE_PAYMENT',
    ],
    required: true,
  },
  originalSnapshot: { type: Schema.Types.Mixed, required: true },
  requestedChanges: Schema.Types.Mixed,
  reason: { type: String, required: true },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
    default: 'PENDING',
    index: true,
  },
  reviewedBy: objectIdField('User', false),
  reviewedAt: Date,
  reviewNotes: String,
});

export const PaymentCorrection = registerModel('PaymentCorrection', paymentCorrectionSchema);
