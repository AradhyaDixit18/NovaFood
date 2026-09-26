import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { AppContext } from '../context';

function limiter(ctx: AppContext, windowMs: number, limit: number, message: string): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => !ctx.rateLimits,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message } });
    },
  });
}

export function createLimiters(ctx: AppContext) {
  return {
    /** Whole API: generous, stops runaway clients and scrapers. */
    api: limiter(ctx, 15 * 60_000, 1000, 'Too many requests. Please slow down a little.'),
    /** Login / register / refresh: slows credential stuffing. */
    auth: limiter(ctx, 15 * 60_000, 30, 'Too many attempts. Try again in a few minutes.'),
    /** Emails we send on request (reset, verification): prevents mail bombing. */
    email: limiter(ctx, 60 * 60_000, 6, 'Too many emails requested. Try again in an hour.'),
    /** Order placement. */
    checkout: limiter(ctx, 60_000, 10, 'Too many checkout attempts. Please wait a minute.'),
  };
}
