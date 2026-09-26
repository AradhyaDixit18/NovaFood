import type { Logger } from 'pino';
import { type Env, type Features, features as featuresOf } from './config/env';
import { ConsoleEmailProvider, type EmailProvider, ResendEmailProvider } from './integrations/email';
import { type PaymentProvider, RazorpayProvider } from './integrations/payments';
import { CloudinaryStorage, type StorageProvider } from './integrations/storage';
import { createLogger } from './lib/logger';
import { RecordingHub, type RealtimeHub } from './realtime/hub';

/** Everything a request handler may need, created once at boot and injectable in tests. */
export interface AppContext {
  env: Env;
  features: Features;
  logger: Logger;
  email: EmailProvider;
  storage: StorageProvider | null;
  payments: PaymentProvider | null;
  realtime: RealtimeHub;
  now: () => Date;
  /** Rate limiting is on everywhere except the test suite, where it is opted into per test. */
  rateLimits: boolean;
}

export function createContext(env: Env, overrides: Partial<AppContext> = {}): AppContext {
  const logger = overrides.logger ?? createLogger(env);
  const features = featuresOf(env);

  const email =
    overrides.email ??
    (features.email === 'resend' && env.RESEND_API_KEY
      ? new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM)
      : new ConsoleEmailProvider(logger));

  const storage =
    overrides.storage !== undefined
      ? overrides.storage
      : features.uploads
        ? new CloudinaryStorage({
            cloudName: env.CLOUDINARY_CLOUD_NAME!,
            apiKey: env.CLOUDINARY_API_KEY!,
            apiSecret: env.CLOUDINARY_API_SECRET!,
          })
        : null;

  const payments =
    overrides.payments !== undefined
      ? overrides.payments
      : features.onlinePayments
        ? new RazorpayProvider(env.RAZORPAY_KEY_ID!, env.RAZORPAY_KEY_SECRET!, env.RAZORPAY_WEBHOOK_SECRET)
        : null;

  return {
    env,
    features: {
      ...features,
      uploads: storage !== null,
      onlinePayments: payments !== null,
    },
    logger,
    email,
    storage,
    payments,
    realtime: overrides.realtime ?? new RecordingHub(),
    now: overrides.now ?? (() => new Date()),
    rateLimits: overrides.rateLimits ?? env.NODE_ENV !== 'test',
  };
}
