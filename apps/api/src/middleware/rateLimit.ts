import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { AppContext } from '../context';

interface LimiterOptions {
  /** Count only failed requests (status >= 400): throttles guessing without locking out real users. */
  failuresOnly?: boolean;
}

function limiter(ctx: AppContext, windowMs: number, limit: number, message: string, options: LimiterOptions = {}): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: options.failuresOnly ?? false,
    skip: () => !ctx.rateLimits,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message } });
    },
  });
}

/**
 * Each property is its own limiter with its own counter, so budgets never bleed into each other.
 * (They used to share one "auth" counter, which let ordinary page loads, each of which calls
 * /auth/refresh, use up the budget for logging in.)
 */
export function createLimiters(ctx: AppContext) {
  const tryAgain = 'Too many attempts. Try again in a few minutes.';
  return {
    /** Whole API: generous, stops runaway clients and scrapers. */
    api: limiter(ctx, 15 * 60_000, 1000, 'Too many requests. Please slow down a little.'),
    /** Failed logins only: slows credential stuffing, never blocks someone who knows their password. */
    login: limiter(ctx, 15 * 60_000, 20, 'Too many failed logins. Try again in a few minutes.', { failuresOnly: true }),
    /** Account creation. */
    register: limiter(ctx, 60 * 60_000, 10, 'Too many sign-ups from this network. Try again later.'),
    /** Refresh-token exchange: runs on every page load, and guessing a 256-bit token is not feasible. */
    session: limiter(ctx, 15 * 60_000, 300, tryAgain),
    /** Token-bearing and password-changing endpoints (verify email, reset, change password). */
    sensitive: limiter(ctx, 15 * 60_000, 20, tryAgain, { failuresOnly: true }),
    /** Emails we send on request (reset, verification): prevents mail bombing. */
    email: limiter(ctx, 60 * 60_000, 6, 'Too many emails requested. Try again in an hour.'),
    /** Order placement. */
    checkout: limiter(ctx, 60_000, 10, 'Too many checkout attempts. Please wait a minute.'),
  };
}
