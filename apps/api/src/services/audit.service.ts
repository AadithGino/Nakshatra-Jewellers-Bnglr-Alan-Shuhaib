import type { ClientSession } from 'mongoose';
import { AuditLog, OutboxEvent, type Role } from '../models/index.js';
export type AuditContext = {
  actorId?: string;
  actorRole?: Role;
  requestId?: string;
  ip?: string;
  userAgent?: string;
};

export const listAuditLogs = (page: number, limit: number) =>
  AuditLog.find()
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

export async function audit(
  session: ClientSession,
  context: AuditContext,
  action: string,
  entityType: string,
  entityId: unknown,
  before?: unknown,
  after?: unknown,
) {
  await AuditLog.create(
    [
      {
        actorId: context.actorId,
        actorRole: context.actorRole,
        action,
        entityType,
        entityId,
        before,
        after,
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
    ],
    { session },
  );
}
export async function outbox(
  session: ClientSession,
  type: string,
  aggregateType: string,
  aggregateId: unknown,
  payload: unknown,
) {
  await OutboxEvent.create([{ type, aggregateType, aggregateId, payload }], { session });
}
