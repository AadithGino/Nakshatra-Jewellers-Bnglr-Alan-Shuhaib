import { createSchema, registerModel, Schema } from './model-helpers.js';

const paymentGatewayEventSchema = createSchema({
  provider: { type: String, required: true },
  eventType: String,
  payloadHash: { type: String, required: true, unique: true },
  merchantTransactionId: String,
  providerEventId: String,
  verified: { type: Boolean, required: true },
  processedAt: Date,
  processingError: String,
  rawPayload: { type: Schema.Types.Mixed, required: true },
});

export const PaymentGatewayEvent = registerModel('PaymentGatewayEvent', paymentGatewayEventSchema);
