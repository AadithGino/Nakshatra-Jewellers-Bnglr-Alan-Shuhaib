import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate, authorize, requirePermission } from '../../middlewares/auth.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  correctionRequestSchema,
  staffPaymentSchema,
} from '../../validators/staff-portal.validators.js';
import { createCustomerSchema } from '../../validators/customer.validators.js';
import { createEnrollmentSchema } from '../../validators/scheme.validators.js';
import {
  collectPaymentHandler,
  createCustomerHandler,
  createEnrollmentHandler,
  getCustomerHandler,
  getStaffDashboard,
  getStaffProfileHandler,
  getOwnReceiptHandler,
  listSchemePlansHandler,
  listOwnCashSubmissionsHandler,
  listOwnCorrectionsHandler,
  listOwnPaymentsHandler,
  previewPaymentHandler,
  requestCorrectionHandler,
  searchCustomersHandler,
} from '../../controllers/staff/staff-portal.controller.js';

const staffRouter = Router();

staffRouter.use(authenticate, authorize('STAFF'));
staffRouter.get('/dashboard', asyncHandler(getStaffDashboard));
staffRouter.get(
  '/customers',
  requirePermission('canViewCustomers'),
  asyncHandler(searchCustomersHandler),
);
staffRouter.post(
  '/customers',
  requirePermission('canCreateCustomer'),
  validateBody(createCustomerSchema),
  asyncHandler(createCustomerHandler),
);
staffRouter.get(
  '/customers/:id',
  requirePermission('canViewCustomers'),
  asyncHandler(getCustomerHandler),
);
staffRouter.get('/scheme-plans', asyncHandler(listSchemePlansHandler));
staffRouter.post(
  '/enrollments',
  requirePermission('canEnrollScheme'),
  validateBody(createEnrollmentSchema),
  asyncHandler(createEnrollmentHandler),
);
staffRouter.get(
  '/schemes/:id/payment-preview',
  requirePermission('canCollectPayment'),
  asyncHandler(previewPaymentHandler),
);
staffRouter.post(
  '/payments',
  requirePermission('canCollectPayment'),
  validateBody(staffPaymentSchema),
  asyncHandler(collectPaymentHandler),
);
staffRouter.get('/payments', asyncHandler(listOwnPaymentsHandler));
staffRouter.get('/payments/:id/receipt', asyncHandler(getOwnReceiptHandler));
staffRouter.post(
  '/payments/:id/corrections',
  requirePermission('canSubmitCorrectionRequest'),
  validateBody(correctionRequestSchema),
  asyncHandler(requestCorrectionHandler),
);
staffRouter.get('/corrections', asyncHandler(listOwnCorrectionsHandler));
staffRouter.get('/cash-submissions', asyncHandler(listOwnCashSubmissionsHandler));
staffRouter.get('/profile', asyncHandler(getStaffProfileHandler));

export default staffRouter;
