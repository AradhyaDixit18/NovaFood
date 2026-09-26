import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import helmet from 'helmet';

/**
 * Serves the built web app from the API process, so a deployment is one service on one origin:
 * no CORS, no cross-site cookies, and Socket.IO on the same host. Enabled by WEB_DIST_DIR.
 */
export function mountWebApp(app: Express, distDir: string): boolean {
  const indexPath = path.join(distDir, 'index.html');
  if (!existsSync(indexPath)) return false;
  const indexHtml = readFileSync(indexPath, 'utf8');

  // Allow exactly the inline scripts shipped in index.html (the pre-paint theme script), by hash.
  const inlineHashes = [...indexHtml.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1] ?? '')
    .filter((body) => body.trim())
    .map((body) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);

  const webSecurity = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", ...inlineHashes, 'https://checkout.razorpay.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws:', 'wss:', 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
        frameSrc: ['https://api.razorpay.com', 'https://checkout.razorpay.com'],
        workerSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  const isAppRoute = (url: string) => !url.startsWith('/api') && !url.startsWith('/socket.io');

  app.use((req, res, next) => (isAppRoute(req.path) ? webSecurity(req, res, next) : next()));
  // Vite fingerprints everything under /assets, so it can be cached forever.
  app.use('/assets', express.static(path.join(distDir, 'assets'), { immutable: true, maxAge: '1y', index: false }));
  app.use(express.static(distDir, { index: false, maxAge: '1h' }));
  // Client-side routes: any other GET for a page gets the app shell.
  app.get(/^(?!\/api|\/socket\.io).*/, (req, res, next) => {
    if (!req.accepts('html')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(indexHtml);
  });
  return true;
}
