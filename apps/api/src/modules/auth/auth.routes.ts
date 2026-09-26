import { type CookieOptions, type Request, type Response, Router } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@novafood/shared';
import type { AppContext } from '../../context';
import { parse, send } from '../../lib/http';
import { authenticate, currentUser, requireCsrfHeader } from '../../middleware/auth';
import { createLimiters } from '../../middleware/rateLimit';
import { User } from '../../models/User';
import { toUserDTO } from '../../serializers';
import * as auth from './auth.service';

export const REFRESH_COOKIE = 'nf_rt';

export function createAuthRouter(ctx: AppContext): Router {
  const router = Router();
  const limits = createLimiters(ctx);
  const requireAuth = authenticate(ctx, { required: true });

  const cookieOptions = (expires?: Date): CookieOptions => ({
    httpOnly: true,
    secure: ctx.env.COOKIE_SECURE,
    // Cross-site deployments (e.g. Netlify + Render) need SameSite=None, which requires Secure.
    sameSite: ctx.env.COOKIE_SECURE ? 'none' : 'lax',
    path: '/api/auth',
    ...(expires ? { expires } : {}),
  });

  const meta = (req: Request) => ({ userAgent: req.get('user-agent'), ip: req.ip });

  const respondWithSession = (res: Response, result: Awaited<ReturnType<typeof auth.login>>, status = 200) => {
    res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions(result.refreshExpiresAt));
    send(res, { user: toUserDTO(result.user), accessToken: result.accessToken }, status);
  };

  router.post('/register', limits.auth, async (req, res) => {
    const input = parse(registerSchema, req.body);
    respondWithSession(res, await auth.register(ctx, input, meta(req)), 201);
  });

  router.post('/login', limits.auth, async (req, res) => {
    const input = parse(loginSchema, req.body);
    respondWithSession(res, await auth.login(ctx, input, meta(req)));
  });

  router.post('/refresh', limits.auth, requireCsrfHeader, async (req, res) => {
    try {
      respondWithSession(res, await auth.refresh(ctx, req.cookies?.[REFRESH_COOKIE], meta(req)));
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, cookieOptions());
      throw err;
    }
  });

  router.post('/logout', requireCsrfHeader, async (req, res) => {
    await auth.logout(ctx, req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    send(res, { ok: true });
  });

  router.post('/logout-all', requireAuth, async (req, res) => {
    await auth.logoutEverywhere(ctx, currentUser(req).id);
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    send(res, { ok: true });
  });

  router.get('/me', requireAuth, async (req, res) => {
    const user = await User.findById(currentUser(req).id).lean();
    send(res, { user: toUserDTO(user) });
  });

  router.post('/verify-email', limits.auth, async (req, res) => {
    const { token } = parse(verifyEmailSchema, req.body);
    const user = await auth.verifyEmail(ctx, token);
    send(res, { user: toUserDTO(user) });
  });

  router.post('/resend-verification', requireAuth, limits.email, async (req, res) => {
    await auth.resendVerification(ctx, currentUser(req).id);
    send(res, { ok: true });
  });

  router.post('/forgot-password', limits.email, async (req, res) => {
    const { email } = parse(forgotPasswordSchema, req.body);
    await auth.forgotPassword(ctx, email);
    send(res, { ok: true, message: 'If an account exists for that email, a reset link is on its way.' });
  });

  router.post('/reset-password', limits.auth, async (req, res) => {
    const { token, password } = parse(resetPasswordSchema, req.body);
    await auth.resetPassword(ctx, token, password);
    send(res, { ok: true });
  });

  router.post('/change-password', requireAuth, limits.auth, async (req, res) => {
    const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
    await auth.changePassword(ctx, currentUser(req).id, currentPassword, newPassword);
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    send(res, { ok: true });
  });

  return router;
}
