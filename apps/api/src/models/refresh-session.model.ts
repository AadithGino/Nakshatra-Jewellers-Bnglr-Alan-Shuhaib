import { createSchema, objectIdField, registerModel } from './model-helpers.js';

const refreshSessionSchema = createSchema({
  userId: objectIdField('User'),
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  revokedAt: Date,
  userAgent: String,
  ip: String,
});

export const RefreshSession = registerModel('RefreshSession', refreshSessionSchema);
