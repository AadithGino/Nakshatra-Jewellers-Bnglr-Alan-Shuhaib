import mongoose from 'mongoose';

export * from './enums.js';
export * from './user.model.js';
export * from './refresh-session.model.js';
export * from './staff-profile.model.js';
export * from './nominee.model.js';
export * from './customer.model.js';
export * from './scheme-plan.model.js';
export * from './scheme-enrollment.model.js';
export * from './gold-rate.model.js';
export * from './payment.model.js';
export * from './payment-intent.model.js';
export * from './payment-gateway-event.model.js';
export * from './receipt-counter.model.js';
export * from './idempotency-record.model.js';
export * from './payment-correction.model.js';
export * from './cash-submission.model.js';
export * from './payout.model.js';
export * from './audit-log.model.js';
export * from './outbox-event.model.js';
export * from './notification.model.js';
export * from './system-setting.model.js';

export const objectIdString = (value: unknown) => new mongoose.Types.ObjectId(String(value));
