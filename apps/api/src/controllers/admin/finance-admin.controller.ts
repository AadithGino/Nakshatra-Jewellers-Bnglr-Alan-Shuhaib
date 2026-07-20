import type { Response } from 'express';
import { ok } from '../../utils/respond.js';
import type { AuthenticatedRequest } from '../../types/authenticated-request.js';
import { auditContextFromRequest } from '../../types/authenticated-request.js';
import { paginationFromQuery } from '../../utils/pagination.js';
import { listAuditLogs } from '../../services/audit.service.js';
import {
  createPayout,
  listCashSubmissions,
  listCorrections,
  listPayments,
  listPayouts,
  reversePayment,
  reviewCorrection,
  submitCash,
} from '../../services/finance.service.js';
import { createManualPayment } from '../../services/payment.service.js';

export async function createManualPaymentHandler(
  request: AuthenticatedRequest,
  response: Response,
) {
  ok(
    response,
    await createManualPayment(request.body, {
      ...auditContextFromRequest(request),
      actorRole: 'ADMIN',
    }),
    undefined,
    201,
  );
}

export async function listPaymentsHandler(request: AuthenticatedRequest, response: Response) {
  const { page, limit } = paginationFromQuery(request.query);
  const { items, total } = await listPayments(page, limit);
  ok(response, items, { page, limit, total });
}

export async function reversePaymentHandler(request: AuthenticatedRequest, response: Response) {
  ok(
    response,
    await reversePayment(
      String(request.params.id),
      request.body.reason,
      auditContextFromRequest(request),
    ),
  );
}

export async function createCashSubmissionHandler(
  request: AuthenticatedRequest,
  response: Response,
) {
  ok(response, await submitCash(request.body, auditContextFromRequest(request)), undefined, 201);
}

export async function listCashSubmissionsHandler(
  _request: AuthenticatedRequest,
  response: Response,
) {
  ok(response, await listCashSubmissions());
}

export async function createPayoutHandler(request: AuthenticatedRequest, response: Response) {
  ok(response, await createPayout(request.body, auditContextFromRequest(request)), undefined, 201);
}

export async function listPayoutsHandler(_request: AuthenticatedRequest, response: Response) {
  ok(response, await listPayouts());
}

export async function listCorrectionsHandler(_request: AuthenticatedRequest, response: Response) {
  ok(response, await listCorrections());
}

export async function reviewCorrectionHandler(request: AuthenticatedRequest, response: Response) {
  ok(
    response,
    await reviewCorrection(
      String(request.params.id),
      request.body.decision,
      request.body.reviewNotes,
      auditContextFromRequest(request),
    ),
  );
}

export async function listAuditLogsHandler(request: AuthenticatedRequest, response: Response) {
  const { page, limit } = paginationFromQuery(request.query);
  const items = await listAuditLogs(page, limit);
  ok(response, items, { page, limit });
}
