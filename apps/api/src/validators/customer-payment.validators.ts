import { z } from 'zod';

export const initiatePhonePeSchema = z.object({
  schemeId: z.string().min(1),
  amountPaise: z.number().int().min(100),
  idempotencyKey: z.string().min(8).max(120),
});
