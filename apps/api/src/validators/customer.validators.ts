import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/),
  password: z.string().min(10).max(128),
  customerCode: z.string().trim().min(2).max(40),
  address: z.record(z.string(), z.string()).optional(),
  nominee: z
    .object({
      name: z.string().trim().min(2).max(120),
      relationship: z.string().trim().min(2).max(50),
      phone: z
        .string()
        .regex(/^\+?[1-9]\d{7,14}$/)
        .optional(),
    })
    .optional(),
});

const addressSchema = z
  .object({
    line1: z.string().max(200).optional(),
    line2: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    district: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    postalCode: z.string().max(20).optional(),
  })
  .optional();

export const updateCustomerSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    phone: z
      .string()
      .regex(/^\+?[1-9]\d{7,14}$/)
      .optional(),
    customerCode: z.string().trim().min(2).max(40).optional(),
    address: addressSchema,
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    nominee: z
      .object({
        name: z.string().trim().min(2).max(120),
        relationship: z.string().trim().min(2).max(50),
        phone: z
          .string()
          .regex(/^\+?[1-9]\d{7,14}$/)
          .optional(),
      })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
