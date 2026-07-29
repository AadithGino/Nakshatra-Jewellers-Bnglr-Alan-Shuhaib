import express, { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import {
  createPresignedUploadHandler,
  uploadFileHandler,
} from '../controllers/upload.controller.js';
import { env } from '../config/env.js';
import { presignUploadSchema } from '../validators/upload.validators.js';

export const uploadRouter = Router();

uploadRouter.post(
  '/presign',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  validateBody(presignUploadSchema),
  asyncHandler(createPresignedUploadHandler),
);

uploadRouter.post(
  '/',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  express.raw({
    type: () => true,
    limit: env.storage.maxBytes,
  }),
  asyncHandler(uploadFileHandler),
);

export default uploadRouter;
