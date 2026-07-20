export const ROLES = ['ADMIN', 'STAFF', 'CUSTOMER'] as const;
export type Role = (typeof ROLES)[number];

export const PAYMENT_METHODS = ['CASH', 'PHONEPE', 'UPI', 'BANK', 'CARD'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  'INITIATED',
  'PENDING',
  'SUCCESS',
  'FAILED',
  'EXPIRED',
  'CANCELLED',
  'REVERSED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const SCHEME_TYPES = ['GOLD_WEIGHT', 'CASH'] as const;
export const ENROLLMENT_STATUSES = [
  'ACTIVE',
  'MATURED',
  'REDEEMED',
  'CLOSED',
  'WITHDRAWN',
  'CANCELLED',
] as const;
