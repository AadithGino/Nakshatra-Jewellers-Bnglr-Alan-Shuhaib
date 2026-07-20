import { Customer, Notification, OutboxEvent } from '../models/index.js';
import { logger } from '../config/logger.js';
import { claimableOutboxFilter } from '../utils/mongo-filter.js';

let timer: NodeJS.Timeout | undefined;
let running = false;
async function processBatch() {
  if (running) return;
  running = true;
  try {
    for (let count = 0; count < 25; count++) {
      const event = await OutboxEvent.findOneAndUpdate(
        claimableOutboxFilter(new Date()),
        { $set: { status: 'PROCESSING' }, $inc: { attempts: 1 } },
        { sort: { createdAt: 1 }, new: true },
      );
      if (!event) break;
      try {
        let userId = event.payload?.userId ?? event.payload?.customerUserId;
        if (!userId && event.payload?.customerId)
          userId = (await Customer.findById(event.payload.customerId).select('userId').lean())
            ?.userId;
        if (userId)
          await Notification.create({
            userId,
            type: event.type,
            title: event.type.replaceAll('_', ' '),
            body: 'Your account has been updated.',
            data: event.payload,
          });
        event.status = 'SENT';
        event.processedAt = new Date();
        event.lastError = undefined;
        await event.save();
      } catch (error: any) {
        event.status = event.attempts >= 10 ? 'FAILED' : 'PENDING';
        event.availableAt = new Date(Date.now() + Math.min(3600000, 1000 * 2 ** event.attempts));
        event.lastError = String(error?.message ?? error).slice(0, 500);
        await event.save();
        logger.error({ err: error, outboxEventId: event._id }, 'outbox delivery failed');
      }
    }
  } finally {
    running = false;
  }
}
export function startOutboxWorker() {
  if (timer) return;
  timer = setInterval(() => void processBatch(), 5000);
  timer.unref();
  void processBatch();
}
export function stopOutboxWorker() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
