import { z } from 'zod';

export const createSchemePlanSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(['GOLD_WEIGHT', 'CASH']),
  durationMonths: z.number().int().min(2).default(11),
  flexibleMonths: z.number().int().min(1).default(6),
  capMonths: z.number().int().min(1).default(5),
  minimumPaymentPaise: z.number().int().positive(),
  termsText: z.string().min(5).max(10_000),
  benefitText: z.string().max(2_000).optional(),
  makingChargeBenefit: z.string().max(500).optional(),
  wastageBenefit: z.string().max(500).optional(),
});

export const updateSchemePlanSchema = createSchemePlanSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const createEnrollmentSchema = z.object({
  customerId: z.string().min(1),
  schemePlanId: z.string().min(1),
  enrollmentNumber: z.string().trim().min(2).max(50),
  startDate: z.coerce.date(),
});

export const updateEnrollmentStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'MATURED', 'REDEEMED', 'CLOSED', 'WITHDRAWN']),
  reason: z.string().trim().min(3).max(500),
});

export const createGoldRateSchema = z.object({
  ratePerGramPaise: z.number().int().positive(),
  purity: z.literal('916').default('916'),
  effectiveFrom: z.coerce.date(),
  notes: z.string().max(500).optional(),
});

export const updateGoldRateSchema = createGoldRateSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export type CreateSchemePlanInput = z.infer<typeof createSchemePlanSchema>;
export type UpdateSchemePlanInput = z.infer<typeof updateSchemePlanSchema>;
export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
export type CreateGoldRateInput = z.infer<typeof createGoldRateSchema>;
export type UpdateGoldRateInput = z.infer<typeof updateGoldRateSchema>;
