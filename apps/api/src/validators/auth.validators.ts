import { z } from 'zod';

export const loginSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/),
  password: z.string().min(8).max(128),
});
