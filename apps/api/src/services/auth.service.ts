import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createHash, randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { verifyPassword } from '../utils/password.js';
import { RefreshSession, StaffProfile, User, type Role } from '../models/index.js';

export { hashPassword } from '../utils/password.js';

type Claims = {
  sub: string;
  role: Role;
  permissions: string[];
  sessionVersion: number;
  type: 'access' | 'refresh';
  jti: string;
};
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
async function claimsFor(user: any) {
  const permissions =
    user.role === 'STAFF'
      ? ((await StaffProfile.findOne({ userId: user._id }).lean())?.permissions ?? [])
      : [];
  return {
    sub: String(user._id),
    role: user.role as Role,
    permissions,
    sessionVersion: user.sessionVersion,
    jti: randomUUID(),
  };
}
export async function issueSession(user: any, context: { ip?: string; userAgent?: string }) {
  const base = await claimsFor(user);
  const access = jwt.sign({ ...base, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`,
  });
  const refresh = jwt.sign(
    { ...base, type: 'refresh', jti: randomUUID() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` },
  );
  await RefreshSession.create({
    userId: user._id,
    tokenHash: hash(refresh),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000),
    ip: context.ip,
    userAgent: context.userAgent,
  });
  return {
    tokens: { access, refresh },
    data: {
      user: {
        id: String(user._id),
        name: user.name,
        phone: user.phone,
        role: user.role,
        permissions: base.permissions,
      },
      redirectTo: `/${String(user.role).toLowerCase()}`,
    },
  };
}

async function issueAccessToken(user: any) {
  const base = await claimsFor(user);
  return jwt.sign({ ...base, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`,
  });
}
export async function login(
  phone: string,
  password: string,
  context: { ip?: string; userAgent?: string },
) {
  const user = await User.findOne({ phone, deletedAt: null }).select(
    '+passwordHash +failedLoginCount +lockedUntil +sessionVersion',
  );
  if (!user) throw new AppError('INVALID_CREDENTIALS', 'Invalid phone or password', 401);
  if (user.status !== 'ACTIVE')
    throw new AppError('ACCOUNT_INACTIVE', 'Account is not active', 403);
  if (user.lockedUntil && user.lockedUntil > new Date())
    throw new AppError('ACCOUNT_LOCKED', 'Too many failed attempts. Try again later', 429, true);
  if (!(await verifyPassword(user.passwordHash, password))) {
    const failures = (user.failedLoginCount ?? 0) + 1;
    await User.updateOne(
      { _id: user._id },
      {
        failedLoginCount: failures,
        ...(failures >= 5 ? { lockedUntil: new Date(Date.now() + 15 * 60000) } : {}),
      },
    );
    throw new AppError('INVALID_CREDENTIALS', 'Invalid phone or password', 401);
  }
  user.failedLoginCount = 0;
  user.lockedUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();
  return issueSession(user, context);
}
export async function refresh(
  token: string | undefined,
  context: { ip?: string; userAgent?: string },
) {
  if (!token) throw new AppError('AUTHENTICATION_REQUIRED', 'Refresh session required', 401);
  let claims: Claims;
  try {
    claims = jwt.verify(token, env.JWT_REFRESH_SECRET) as Claims;
  } catch {
    throw new AppError('SESSION_EXPIRED', 'Session expired', 401);
  }
  const session = await RefreshSession.findOne({
    tokenHash: hash(token),
    revokedAt: null,
    expiresAt: mongoose.trusted({ $gt: new Date() }),
  });
  const user = await User.findById(claims.sub).select('+sessionVersion');
  if (
    !session ||
    !user ||
    user.status !== 'ACTIVE' ||
    user.sessionVersion !== claims.sessionVersion
  )
    throw new AppError('SESSION_EXPIRED', 'Session expired', 401);

  // Renew access only — keep the same refresh token so concurrent tabs/requests
  // cannot invalidate each other by rotating the refresh session.
  session.ip = context.ip;
  session.userAgent = context.userAgent;
  session.expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000);
  await session.save();

  const access = await issueAccessToken(user);
  const permissions =
    user.role === 'STAFF'
      ? ((await StaffProfile.findOne({ userId: user._id }).lean())?.permissions ?? [])
      : [];

  return {
    tokens: { access, refresh: token },
    data: {
      user: {
        id: String(user._id),
        name: user.name,
        phone: user.phone,
        role: user.role,
        permissions,
      },
      redirectTo: `/${String(user.role).toLowerCase()}`,
    },
  };
}
export async function logout(token: string | undefined) {
  if (token) await RefreshSession.updateOne({ tokenHash: hash(token) }, { revokedAt: new Date() });
}
export function verifyAccess(token?: string): Claims {
  if (!token) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  try {
    const c = jwt.verify(token, env.JWT_ACCESS_SECRET) as Claims;
    if (c.type !== 'access') throw new Error();
    return c;
  } catch {
    throw new AppError('SESSION_EXPIRED', 'Session expired', 401);
  }
}
