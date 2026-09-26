import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  /** Comma-separated list of allowed browser origins. The first one is used in email links. */
  CLIENT_URL: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Number of reverse proxies in front of the app (1 on Render/Railway), used for client IPs. */
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  /** Path to the built web app (apps/web/dist). When set, the API also serves the site on the same origin. */
  WEB_DIST_DIR: z.string().optional(),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  COOKIE_SECURE: bool.default('false'),
  REQUIRE_EMAIL_VERIFICATION: bool.default('false'),

  EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('NovaFood <onboarding@resend.dev>'),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export class EnvError extends Error {}

/** Parses and validates configuration once at boot so a missing secret fails fast and loudly. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Treat `KEY=` (empty) exactly like an unset variable.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ''));
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new EnvError(`Invalid environment configuration:\n${problems}`);
  }
  const env = result.data;
  if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE) {
    throw new EnvError('COOKIE_SECURE must be true in production.');
  }
  return env;
}

export function allowedOrigins(env: Env): string[] {
  return env.CLIENT_URL.split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export function primaryClientUrl(env: Env): string {
  return allowedOrigins(env)[0] ?? 'http://localhost:5173';
}

export interface Features {
  email: 'resend' | 'console';
  uploads: boolean;
  onlinePayments: boolean;
  razorpayWebhooks: boolean;
}

export function features(env: Env): Features {
  return {
    email: env.EMAIL_PROVIDER === 'resend' && env.RESEND_API_KEY ? 'resend' : 'console',
    uploads: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
    onlinePayments: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
    razorpayWebhooks: Boolean(env.RAZORPAY_WEBHOOK_SECRET),
  };
}
