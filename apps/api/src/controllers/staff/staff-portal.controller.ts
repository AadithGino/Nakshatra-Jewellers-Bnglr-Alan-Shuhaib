import type { Response } from 'express';
import { ok } from '../../utils/respond.js';
import type { AuthenticatedRequest } from '../../types/authenticated-request.js';
import { auditContextFromRequest } from '../../types/authenticated-request.js';
import { requestCorrection } from '../../services/finance.service.js';
import { createManualPayment } from '../../services/payment.service.js';
import { createCustomer } from '../../services/customer.service.js';
import { getStaffPaymentIntent, initiateStaffPhonePe } from '../../services/gateway.service.js';
import {
  createEnrollment,
  getEnrollmentDetails,
  listActiveSchemePlans,
} from '../../services/scheme-management.service.js';
import { staffDashboard, staffMemberReport } from '../../services/report.service.js';
import { AppError } from '../../utils/AppError.js';
import { getPaymentRules } from '../../services/scheme.service.js';
import {
  getCustomerFinancialView,
  searchCustomers,
} from '../../services/customer-search.service.js';
import {
  getStaffProfile,
  getStaffReceipt,
  listStaffCashSubmissions,
  listStaffCorrections,
  listStaffPayments,
} from '../../services/staff.service.js';
import { paymentPreviewQuerySchema } from '../../validators/staff-portal.validators.js';

export async function getStaffDashboard(request: AuthenticatedRequest, response: Response) {
  ok(response, await staffDashboard(request.auth.userId));
}

function reportDate(value: unknown, endOfDay = false) {
  if (!value) return undefined;
  const raw = String(value);
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(parsed.getTime()))
    throw new AppError('VALIDATION_ERROR', 'Report date is invalid', 422);
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(raw)) parsed.setHours(23, 59, 59, 999);
  return parsed;
}

export async function getOwnCollectionReportHandler(
  request: AuthenticatedRequest,
  response: Response,
) {
  const from = reportDate(request.query.from);
  const to = reportDate(request.query.to, true);
  if (from && to && from > to)
    throw new AppError('VALIDATION_ERROR', 'Report start date must be before end date', 422);
  ok(response, await staffMemberReport(request.auth.userId, from, to), {
    from: from?.toISOString() ?? null,
    to: to?.toISOString() ?? null,
  });
}

export async function searchCustomersHandler(request: AuthenticatedRequest, response: Response) {
  ok(response, await searchCustomers(String(request.query.search ?? '').trim()));
}

export async function getCustomerHandler(request: AuthenticatedRequest, response: Response) {
  ok(response, await getCustomerFinancialView(String(request.params.id)));
}

export async function createCustomerHandler(request: AuthenticatedRequest, response: Response) {
  ok(
    response,
    await createCustomer(request.body, auditContextFromRequest(request)),
    undefined,
    201,
  );
}

export async function listSchemePlansHandler(_request: AuthenticatedRequest, response: Response) {
  ok(response, await listActiveSchemePlans());
}

export async function createEnrollmentHandler(request: AuthenticatedRequest, response: Response) {
  ok(
    response,
    await createEnrollment(request.body, auditContextFromRequest(request)),
    undefined,
    201,
  );
}

export async function getEnrollmentHandler(request: AuthenticatedRequest, response: Response) {
  ok(response, await getEnrollmentDetails(String(request.params.id)));
}

export async function previewPaymentHandler(request: AuthenticatedRequest, response: Response) {
  const query = paymentPreviewQuerySchema.parse(request.query);
  ok(response, await getPaymentRules(String(request.params.id), new Date(), query.amountPaise));
}

export async function collectPaymentHandler(request: AuthenticatedRequest, response: Response) {
  ok(
    response,
    await createManualPayment(request.body, {
      ...auditContextFromRequest(request),
      actorRole: 'STAFF',
    }),
    undefined,
    201,
  );
}

export async function initiatePhonePeCollectionHandler(
  request: AuthenticatedRequest,
  response: Response,
) {
  ok(
    response,
    await initiateStaffPhonePe(request.auth.userId, request.body),
    undefined,
    201,
  );
}

export async function getPhonePeCollectionIntentHandler(
  request: AuthenticatedRequest,
  response: Response,
) {
  ok(response, await getStaffPaymentIntent(request.auth.userId, String(request.params.orderId)));
}

export async function listOwnPaymentsHandler(request: AuthenticatedRequest, response: Response) {
  const from = reportDate(request.query.from);
  const to = reportDate(request.query.to, true);
  ok(response, await listStaffPayments(request.auth.userId, from, to));
}

export async function getOwnReceiptHandler(request: AuthenticatedRequest, response: Response) {
  ok(response, await getStaffReceipt(request.auth.userId, String(request.params.id)));
}

export async function requestCorrectionHandler(request: AuthenticatedRequest, response: Response) {
  ok(
    response,
    await requestCorrection(
      String(request.params.id),
      request.body,
      auditContextFromRequest(request),
    ),
    undefined,
    201,
  );
}

export async function listOwnCorrectionsHandler(request: AuthenticatedRequest, response: Response) {
  ok(response, await listStaffCorrections(request.auth.userId));
}

export async function listOwnCashSubmissionsHandler(
  request: AuthenticatedRequest,
  response: Response,
) {
  const from = reportDate(request.query.from);
  const to = reportDate(request.query.to, true);
  ok(response, await listStaffCashSubmissions(request.auth.userId, from, to));
}

export async function getStaffProfileHandler(request: AuthenticatedRequest, response: Response) {
  ok(response, await getStaffProfile(request.auth.userId));
}
