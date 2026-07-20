import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createEnrollmentSchema,
  createGoldRateSchema,
  createSchemePlanSchema,
  updateEnrollmentStatusSchema,
  updateGoldRateSchema,
  updateSchemePlanSchema,
} from '../../validators/scheme.validators.js';
import {
  createEnrollmentHandler,
  createGoldRateHandler,
  createSchemePlanHandler,
  getEnrollmentHandler,
  getSchemePlanHandler,
  listEnrollmentsHandler,
  listGoldRatesHandler,
  listSchemePlansHandler,
  updateGoldRateHandler,
  updateEnrollmentStatusHandler,
  updateSchemePlanHandler,
} from '../../controllers/admin/scheme-admin.controller.js';

export const schemeAdminRouter = Router();

schemeAdminRouter.post(
  '/scheme-plans',
  validateBody(createSchemePlanSchema),
  asyncHandler(createSchemePlanHandler),
);
schemeAdminRouter.get('/scheme-plans', asyncHandler(listSchemePlansHandler));
schemeAdminRouter.get('/scheme-plans/:id', asyncHandler(getSchemePlanHandler));
schemeAdminRouter.patch(
  '/scheme-plans/:id',
  validateBody(updateSchemePlanSchema),
  asyncHandler(updateSchemePlanHandler),
);
schemeAdminRouter.post(
  '/enrollments',
  validateBody(createEnrollmentSchema),
  asyncHandler(createEnrollmentHandler),
);
schemeAdminRouter.get('/enrollments', asyncHandler(listEnrollmentsHandler));
schemeAdminRouter.get('/enrollments/:id', asyncHandler(getEnrollmentHandler));
schemeAdminRouter.patch(
  '/enrollments/:id/status',
  validateBody(updateEnrollmentStatusSchema),
  asyncHandler(updateEnrollmentStatusHandler),
);
schemeAdminRouter.post(
  '/gold-rates',
  validateBody(createGoldRateSchema),
  asyncHandler(createGoldRateHandler),
);
schemeAdminRouter.get('/gold-rates', asyncHandler(listGoldRatesHandler));
schemeAdminRouter.patch(
  '/gold-rates/:id',
  validateBody(updateGoldRateSchema),
  asyncHandler(updateGoldRateHandler),
);
