import { createSchema, registerModel, Schema } from './model-helpers.js';

const outboxEventSchema = createSchema({
  type: { type: String, required: true },
  aggregateType: String,
  aggregateId: Schema.Types.ObjectId,
  payload: { type: Schema.Types.Mixed, required: true },
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'SENT', 'FAILED'],
    default: 'PENDING',
    index: true,
  },
  attempts: { type: Number, default: 0 },
  availableAt: { type: Date, default: Date.now },
  processedAt: Date,
  lastError: String,
});

export const OutboxEvent = registerModel('OutboxEvent', outboxEventSchema);
