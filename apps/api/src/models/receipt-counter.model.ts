import { createSchema, registerModel } from './model-helpers.js';

const receiptCounterSchema = createSchema({
  scope: { type: String, required: true, unique: true },
  value: { type: Number, default: 0 },
});

export const ReceiptCounter = registerModel('ReceiptCounter', receiptCounterSchema);
