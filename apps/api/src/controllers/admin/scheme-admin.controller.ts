import type { Response } from "express";
import { ok } from "../../utils/respond.js";
import type { AuthenticatedRequest } from "../../types/authenticated-request.js";
import { auditContextFromRequest } from "../../types/authenticated-request.js";
import {
  createEnrollment,
  createGoldRate,
  createSchemePlan,
  getEnrollmentDetails,
  getSchemePlan,
  listEnrollments,
  listGoldRates,
  getGoldRate,
  listSchemePlans,
  updateEnrollmentStatus,
  updateGoldRate,
  updateSchemePlan,
} from "../../services/scheme-management.service.js";

export async function createSchemePlanHandler(
  request: AuthenticatedRequest,
  response: Response,
) {
  ok(
    response,
    await createSchemePlan(request.body, auditContextFromRequest(request)),
    undefined,
    201,
  );
}

export async function listSchemePlansHandler(
  _request: AuthenticatedRequest,
  response: Response,
) {
  ok(response, await listSchemePlans());
}

export async function getSchemePlanHandler(
  request: AuthenticatedRequest,
  response: Response,
) {
  ok(response, await getSchemePlan(String(request.params.id)));
}

export async function updateSchemePlanHandler(
  request: AuthenticatedRequest,
  response: Response,
) {
  ok(
    response,
    await updateSchemePlan(
      String(request.params.id),
      request.body,
      auditContextFromRequest(request),
    ),
  );
}

export async function createEnrollmentHandler(
  request: AuthenticatedRequest,
  response: Response,
) {
  ok(
    response,
    await createEnrollment(request.body, auditContextFromRequest(request)),
    undefined,
    201,
  );
}

export async function listEnrollmentsHandler(
  request: AuthenticatedRequest,
  response: Response,
) {
  const page = Math.max(1, Number(request.query.page) || 1);
  const limit = Math.min(500, Math.max(1, Number(request.query.limit) || 100));
  const { items, total } = await listEnrollments(page, limit);
  ok(response, items, { page, limit, total });
}

export async function getEnrollmentHandler(
  request: AuthenticatedRequest,
  response: Response,
) {
  ok(response, await getEnrollmentDetails(String(request.params.id)));
}

export async function updateEnrollmentStatusHandler(
  request: AuthenticatedRequest,
  response: Response,
) {
  ok(
    response,
    await updateEnrollmentStatus(
      String(request.params.id),
      request.body.status,
      request.body.reason,
      auditContextFromRequest(request),
    ),
  );
}

export async function createGoldRateHandler(
  request: AuthenticatedRequest,
  response: Response,
) {
  ok(
    response,
    await createGoldRate(request.body, auditContextFromRequest(request)),
    undefined,
    201,
  );
}

export async function listGoldRatesHandler(
  _request: AuthenticatedRequest,
  response: Response,
) {
  ok(response, await listGoldRates());
}

export async function getGoldRateHandler(
  request: AuthenticatedRequest,
  response: Response,
) {
  ok(response, await getGoldRate(String(request.params.id)));
}

export async function updateGoldRateHandler(
  request: AuthenticatedRequest,
  response: Response,
) {
  ok(
    response,
    await updateGoldRate(
      String(request.params.id),
      request.body,
      auditContextFromRequest(request),
    ),
  );
}
