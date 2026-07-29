import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/authenticated-request.js';
import { ok } from '../../utils/respond.js';
import {
  adminReport,
  getAdminOperationRecord,
  getPhonePeTransactionDetail,
  listPhonePeTransactions,
} from '../../services/report.service.js';
import { AppError } from '../../utils/AppError.js';

function reportDate(value: unknown, endOfDay = false) {
  if (!value) return undefined;
  const raw = String(value);
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(parsed.getTime()))
    throw new AppError('VALIDATION_ERROR', 'Report date is invalid', 422);
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(raw)) parsed.setHours(23, 59, 59, 999);
  return parsed;
}

export async function listPhonePeTransactionsHandler(
  _request: AuthenticatedRequest,
  response: Response,
) {
  ok(response, await listPhonePeTransactions());
}

export async function getPhonePeTransactionHandler(
  request: AuthenticatedRequest,
  response: Response,
) {
  ok(response, await getPhonePeTransactionDetail(String(request.params.id)));
}

export async function getReportHandler(request: AuthenticatedRequest, response: Response) {
  const from = reportDate(request.query.from);
  const to = reportDate(request.query.to, true);
  if (from && to && from > to)
    throw new AppError('VALIDATION_ERROR', 'Report start date must be before end date', 422);
  ok(
    response,
    await adminReport(String(request.params.report), {
      from,
      to,
      id: request.query.id ? String(request.query.id) : undefined,
    }),
  );
}

export async function getOperationRecordHandler(request: AuthenticatedRequest, response: Response) {
  ok(
    response,
    await getAdminOperationRecord(String(request.params.module), String(request.params.id)),
  );
}
