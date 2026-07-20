import { z } from 'zod';

export const customerPaymentPreviewQuerySchema = z.object({
  amountPaise: z.coerce.number().int().positive(),
});
