import type { RequestHandler } from 'express';
import type { Role } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { verifyAccess } from '../services/auth.service.js';
import { User } from '../models/index.js';

export const authenticate: RequestHandler = (req, _res, next) => {
  void (async () => {
    const claims = verifyAccess(req.cookies?.access_token);
    const user = await User.findById(claims.sub).select('status +sessionVersion').lean();
    if (!user || user.status !== 'ACTIVE' || user.sessionVersion !== claims.sessionVersion)
      throw new AppError('SESSION_EXPIRED', 'Session expired', 401);
    req.auth = {
      userId: claims.sub,
      role: claims.role,
      permissions: claims.permissions,
      sessionVersion: claims.sessionVersion,
    };
    next();
  })().catch(next);
};
export const authorize =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth || !roles.includes(req.auth.role))
      throw new AppError('PERMISSION_DENIED', 'You do not have permission for this action', 403);
    next();
  };
export const requirePermission =
  (permission: string): RequestHandler =>
  (req, _res, next) => {
    if (req.auth?.role !== 'ADMIN' && !req.auth?.permissions.includes(permission))
      throw new AppError('PERMISSION_DENIED', 'Required permission is missing', 403);
    next();
  };
