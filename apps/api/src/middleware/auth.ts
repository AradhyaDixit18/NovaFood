import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Role } from '@novafood/shared';
import type { AppContext } from '../context';
import { forbidden, unauthorized } from '../lib/errors';
import { verifyAccessToken } from '../lib/tokens';
import { User } from '../models/User';

function bearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

/**
 * Resolves the caller from the access token. The user is re-read on every request so that
 * suspending an account or changing a role takes effect immediately, not when the JWT expires.
 */
export async function resolveUser(ctx: AppContext, token: string | null): Promise<Express.AuthUser | null> {
  if (!token) return null;
  const claims = verifyAccessToken(ctx.env, token);
  if (!claims) return null;
  const user = await User.findById(claims.sub).select('name email role status emailVerified').lean();
  if (!user || user.status !== 'ACTIVE') return null;
  return {
    id: String(user._id),
    role: user.role,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
  };
}

export function authenticate(ctx: AppContext, options: { required: boolean }): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const token = bearer(req);
    const user = await resolveUser(ctx, token);
    if (user) {
      req.user = user;
      return next();
    }
    if (options.required) {
      throw unauthorized(token ? 'Your session expired. Please log in again.' : undefined, token ? 'TOKEN_INVALID' : 'UNAUTHORIZED');
    }
    next();
  };
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

/** Narrowing helper for handlers mounted behind `authenticate({ required: true })`. */
export function currentUser(req: Request): Express.AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

/**
 * Cookie-authenticated endpoints (refresh, logout) must carry a custom header. Browsers
 * refuse to send custom headers cross-origin unless CORS allows that origin, which blocks CSRF.
 */
export const requireCsrfHeader: RequestHandler = (req, _res, next) => {
  if (req.get('x-requested-with') !== 'novafood') {
    throw forbidden('Missing request header.', 'CSRF_HEADER_MISSING');
  }
  next();
};
