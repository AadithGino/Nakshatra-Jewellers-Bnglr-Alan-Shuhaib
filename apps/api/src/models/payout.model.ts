import { createSchema, objectIdField, registerModel } from './model-helpers.js';

const payoutSchema = createSchema({
  customerId: objectIdField('Customer'),
  schemeId: { ...objectIdField('SchemeEnrollment'), index: true },
  amountPaise: { type: Number, required: true, min: 1 },
  goldWeightMg: { type: Number, default: 0, min: 0 },
  payoutType: {
    type: String,
    enum: ['REDEEM', 'PAYOUT'],
    required: true,
  },
  method: {
    type: String,
    enum: ['CASH', 'UPI', 'BANK', 'GOLD'],
    default: 'CASH',
    required: true,
  },
  payoutDate: { type: Date, required: true },
  referenceNumber: String,
  notes: String,
  status: { type: String, enum: ['SUCCESS', 'REVERSED'], default: 'SUCCESS' },
  createdBy: objectIdField('User'),
  reversedAt: Date,
});

export const Payout = registerModel('Payout', payoutSchema);
