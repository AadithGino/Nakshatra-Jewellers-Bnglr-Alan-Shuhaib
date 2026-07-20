import { createSchema, objectIdField, registerModel, Schema } from './model-helpers.js';

const idempotencyRecordSchema = createSchema({
  actorId: objectIdField('User'),
  route: { type: String, required: true },
  key: { type: String, required: true },
  requestHash: { type: String, required: true },
  responseStatus: Number,
  responseBody: Schema.Types.Mixed,
  state: { type: String, enum: ['PROCESSING', 'COMPLETED'], default: 'PROCESSING' },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

idempotencyRecordSchema.index({ actorId: 1, route: 1, key: 1 }, { unique: true });

export const IdempotencyRecord = registerModel('IdempotencyRecord', idempotencyRecordSchema);
