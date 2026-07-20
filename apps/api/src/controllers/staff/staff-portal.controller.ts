import type { Response } from 'express';
import { ok } from '../../utils/respond.js';
import type { AuthenticatedRequest } from '../../types/authenticated-request.js';
import { auditContextFromRequest } from '../../types/authenticated-request.js';
import { requestCorrection } from '../../services/finance.service.js';
import { createManualPayment } from '../../services/payment.service.js';
import { createCustomer } from '../../services/customer.service.js';
import {
  createEnrollment,
  listActiveSchemePlans,
} from '../../services/scheme-management.service.js';
import { staffDashboard } from '../../services/report.service.js';
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

export async function listOwnPaymentsHandler(request: AuthenticatedRequest, response: Response) {
  ok(response, await listStaffPayments(request.auth.userId));
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
  ok(response, await listStaffCashSubmissions(request.auth.userId));
}

export async function getStaffProfileHandler(request: AuthenticatedRequest, response: Response) {
  ok(response, await getStaffProfile(request.auth.userId));
}
