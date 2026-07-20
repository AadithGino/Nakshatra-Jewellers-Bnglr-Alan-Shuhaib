import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const uriFile = resolve(import.meta.dirname, '.vitest-mongo-uri');

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = readFileSync(uriFile, 'utf8').trim();
process.env.WEB_ORIGINS = 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-chars!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-chars!';
process.env.PHONEPE_ENABLED = 'false';
process.env.PHONEPE_REDIRECT_URL = 'http://localhost:5173/customer/payments/return';
process.env.BOOTSTRAP_DEMO = 'false';
process.env.COOKIE_SECURE = 'false';
