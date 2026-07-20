import { Router } from 'express';
import {
  getReportHandler,
  getOperationRecordHandler,
  listPhonePeTransactionsHandler,
} from '../../controllers/admin/report-admin.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const reportAdminRouter = Router();

reportAdminRouter.get('/phonepe-transactions', asyncHandler(listPhonePeTransactionsHandler));
reportAdminRouter.get('/operation-records/:module/:id', asyncHandler(getOperationRecordHandler));
reportAdminRouter.get('/reports/:report', asyncHandler(getReportHandler));
