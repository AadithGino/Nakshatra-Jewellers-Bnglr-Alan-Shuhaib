import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  cashSubmissionSchema,
  correctionDecisionSchema,
  manualPaymentSchema,
  payoutSchema,
  reversePaymentSchema,
} from '../../validators/finance.validators.js';
import {
  createCashSubmissionHandler,
  createManualPaymentHandler,
  createPayoutHandler,
  getPaymentHandler,
  listAuditLogsHandler,
  listCashSubmissionsHandler,
  listCorrectionsHandler,
  listPaymentsHandler,
  listPayoutsHandler,
  reversePaymentHandler,
  reviewCorrectionHandler,
} from '../../controllers/admin/finance-admin.controller.js';

export const financeAdminRouter = Router();

financeAdminRouter.post(
  '/payments/manual',
  validateBody(manualPaymentSchema),
  asyncHandler(createManualPaymentHandler),
);
financeAdminRouter.get('/payments', asyncHandler(listPaymentsHandler));
financeAdminRouter.get('/payments/:id', asyncHandler(getPaymentHandler));
financeAdminRouter.post(
  '/payments/:id/reverse',
  validateBody(reversePaymentSchema),
  asyncHandler(reversePaymentHandler),
);
financeAdminRouter.post(
  '/cash-submissions',
  validateBody(cashSubmissionSchema),
  asyncHandler(createCashSubmissionHandler),
);
financeAdminRouter.get('/cash-submissions', asyncHandler(listCashSubmissionsHandler));
financeAdminRouter.post('/payouts', validateBody(payoutSchema), asyncHandler(createPayoutHandler));
financeAdminRouter.get('/payouts', asyncHandler(listPayoutsHandler));
financeAdminRouter.get('/corrections', asyncHandler(listCorrectionsHandler));
financeAdminRouter.patch(
  '/corrections/:id',
  validateBody(correctionDecisionSchema),
  asyncHandler(reviewCorrectionHandler),
);
financeAdminRouter.get('/audit-logs', asyncHandler(listAuditLogsHandler));
