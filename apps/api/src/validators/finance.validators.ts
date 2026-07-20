import { z } from 'zod';

export const manualPaymentSchema = z.object({
  customerId: z.string().min(1),
  schemeId: z.string().min(1),
  amountPaise: z.number().int().positive(),
  method: z.enum(['CASH', 'UPI', 'BANK', 'CARD']),
  paymentDate: z.coerce.date(),
  referenceNumber: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().min(8).max(120),
});

export const reversePaymentSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

export const cashSubmissionSchema = z.object({
  staffId: z.string().min(1),
  amountPaise: z.number().int().positive(),
  submissionDate: z.coerce.date(),
  notes: z.string().max(500).optional(),
});

const settlementBase = {
  customerId: z.string().min(1),
  schemeId: z.string().min(1),
  payoutDate: z.coerce.date(),
  referenceNumber: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
};

export const payoutSchema = z.discriminatedUnion('payoutType', [
  z.object({ ...settlementBase, payoutType: z.literal('REDEEM') }).strict(),
  z
    .object({
      ...settlementBase,
      payoutType: z.literal('PAYOUT'),
      method: z.enum(['CASH', 'UPI', 'BANK']),
    })
    .strict(),
]);

export const correctionDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reviewNotes: z.string().trim().min(3).max(500),
});
