import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import { allowedOrigins, primaryClientUrl } from './config/env';
import type { AppContext } from './context';
import { send } from './lib/http';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createLimiters } from './middleware/rateLimit';
import { Restaurant } from './models/Restaurant';
import { createAdminRouter } from './modules/admin/admin.routes';
import { createAuthRouter } from './modules/auth/auth.routes';
import { createCartRouter } from './modules/cart/cart.routes';
import { createCatalogRouter } from './modules/catalog/catalog.routes';
import { createCouponsRouter } from './modules/coupons/coupons.routes';
import { createFavoritesRouter } from './modules/favorites/favorites.routes';
import { createRewardsRouter } from './modules/loyalty/rewards.routes';
import { createNotificationsRouter } from './modules/notifications/notifications.routes';
import { createOrdersRouter, createPaymentWebhookRouter } from './modules/orders/orders.routes';
import { createPartnerRouter } from './modules/partner/partner.routes';
import { createRecommendationsRouter } from './modules/recommendations/recommendations.routes';
import { createReviewsRouter } from './modules/reviews/reviews.routes';
import { createUploadsRouter } from './modules/uploads/uploads.routes';
import { createUsersRouter } from './modules/users/users.routes';
import { mountWebApp } from './web';

export function createApp(ctx: AppContext): Express {
  const app = express();
  if (ctx.env.TRUST_PROXY > 0) app.set('trust proxy', ctx.env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(
    pinoHttp({
      logger: ctx.logger,
      genReqId: (req, res) => {
        const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url === '/api/health' },
    }),
  );
  app.use(
    '/api',
    helmet({
      // The API serves JSON only; pages served by mountWebApp get their own CSP.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(
    cors({
      origin: allowedOrigins(ctx.env),
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
      maxAge: 600,
    }),
  );
  app.use(compression());
  app.use(
    express.json({
      limit: '200kb',
      // Webhook signatures are computed over the exact bytes received.
      verify: (req, _res, buf) => {
        if ((req as express.Request).originalUrl?.startsWith('/api/payments/webhooks')) (req as express.Request).rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(cookieParser());
  app.use('/api', createLimiters(ctx).api);

  app.get('/api/health', (_req, res) => {
    const db = mongoose.connection.readyState === 1 ? 'up' : 'down';
    res.status(db === 'up' ? 200 : 503).json({ data: { status: db === 'up' ? 'ok' : 'degraded', db, features: ctx.features } });
  });

  app.use('/api/auth', createAuthRouter(ctx));
  app.use('/api/users', createUsersRouter(ctx));
  app.use('/api/uploads', createUploadsRouter(ctx));
  app.use('/api', createCatalogRouter(ctx));
  app.use('/api/cart', createCartRouter(ctx));
  app.use('/api/orders', createOrdersRouter(ctx));
  app.use('/api/payments/webhooks', createPaymentWebhookRouter(ctx));
  app.use('/api/notifications', createNotificationsRouter(ctx));
  app.use('/api/favorites', createFavoritesRouter(ctx));
  app.use('/api/reviews', createReviewsRouter(ctx));
  app.use('/api/coupons', createCouponsRouter(ctx));
  app.use('/api/rewards', createRewardsRouter(ctx));
  app.use('/api/recommendations', createRecommendationsRouter(ctx));
  app.use('/api/partner', createPartnerRouter(ctx));
  app.use('/api/admin', createAdminRouter(ctx));

  app.get('/api/config', (_req, res) => {
    send(res, {
      onlinePayments: ctx.features.onlinePayments,
      razorpayKeyId: ctx.payments?.keyId ?? null,
      uploads: ctx.features.uploads,
      requireEmailVerification: ctx.env.REQUIRE_EMAIL_VERIFICATION,
    });
  });

  /** Sitemap of public pages; the web host proxies /sitemap.xml here. */
  app.get(['/api/sitemap.xml', '/sitemap.xml'], async (_req, res) => {
    const base = primaryClientUrl(ctx.env);
    const restaurants = await Restaurant.find({ status: 'APPROVED' }).select('slug updatedAt').lean();
    const urls = [
      { loc: `${base}/`, lastmod: new Date() },
      { loc: `${base}/restaurants`, lastmod: new Date() },
      { loc: `${base}/moods`, lastmod: new Date() },
      ...restaurants.map((r) => ({ loc: `${base}/r/${r.slug}`, lastmod: r.updatedAt })),
    ];
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
        .map((u) => `  <url><loc>${u.loc}</loc><lastmod>${new Date(u.lastmod ?? Date.now()).toISOString()}</lastmod></url>`)
        .join('\n')}\n</urlset>`,
    );
  });

  if (ctx.env.WEB_DIST_DIR) {
    const mounted = mountWebApp(app, ctx.env.WEB_DIST_DIR);
    if (!mounted) ctx.logger.warn({ dir: ctx.env.WEB_DIST_DIR }, 'WEB_DIST_DIR has no index.html; serving the API only');
  }

  app.use(notFoundHandler);
  app.use(errorHandler(ctx));
  return app;
}
