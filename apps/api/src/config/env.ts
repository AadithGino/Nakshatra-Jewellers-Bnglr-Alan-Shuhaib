import 'dotenv/config';
import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(2020),
    MONGODB_URI: z.string().min(1),
    WEB_ORIGINS: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    COOKIE_SECURE: bool.default(false),
    BUSINESS_TIMEZONE: z.literal('Asia/Kolkata').default('Asia/Kolkata'),
    BOOTSTRAP_DEMO: bool.default(false),
    PHONEPE_ENABLED: bool.default(false),
    PHONEPE_ENV: z.enum(['SANDBOX', 'PRODUCTION']).default('SANDBOX'),
    PHONEPE_CLIENT_ID: z.string().default(''),
    PHONEPE_CLIENT_SECRET: z.string().default(''),
    PHONEPE_CLIENT_VERSION: z.coerce.number().int().positive().default(1),
    PHONEPE_WEBHOOK_USERNAME: z.string().default(''),
    PHONEPE_WEBHOOK_PASSWORD: z.string().default(''),
    PHONEPE_REDIRECT_URL: z.string().url(),
    LOG_LEVEL: z.string().default('info'),
  })
  .superRefine((env, ctx) => {
    if (env.PHONEPE_ENABLED) {
      for (const key of [
        'PHONEPE_CLIENT_ID',
        'PHONEPE_CLIENT_SECRET',
        'PHONEPE_WEBHOOK_USERNAME',
        'PHONEPE_WEBHOOK_PASSWORD',
      ] as const) {
        if (!env[key])
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when PhonePe is enabled`,
          });
      }
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) throw new Error(`Invalid environment: ${z.prettifyError(parsed.error)}`);
export const env = Object.freeze({
  ...parsed.data,
  origins: parsed.data.WEB_ORIGINS.split(',').map((x) => x.trim()),
});
