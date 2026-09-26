import mongoose from 'mongoose';
import type { Logger } from 'pino';

/** Thrown when the database cannot be reached, with a message that says what to fix. */
export class DatabaseConnectionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DatabaseConnectionError';
  }
}

/** Turns driver errors into an actionable sentence. Never includes the connection string. */
export function explainMongoError(err: unknown): string {
  const e = err as { code?: number; codeName?: string; message?: string; name?: string };
  const message = e?.message ?? String(err);
  if (e?.code === 8000 || e?.code === 18 || /bad auth|authentication failed/i.test(message)) {
    return [
      'MongoDB rejected the username or password in MONGODB_URI.',
      'In MongoDB Atlas, open Security > Database Access, edit the database user named in the URI and set a new password',
      '(this is not your Atlas login password). Put it in apps/api/.env, percent-encoding special characters (@ becomes %40).',
    ].join(' ');
  }
  if (/ENOTFOUND|querySrv|getaddrinfo/i.test(message)) {
    return 'The MongoDB host in MONGODB_URI could not be found. Check the cluster address and your internet connection.';
  }
  if (e?.name === 'MongoServerSelectionError' || /whitelist|IP.*not allowed|Could not connect to any servers/i.test(message)) {
    return 'Could not reach MongoDB. In Atlas, open Security > Network Access and allow your current IP address (or 0.0.0.0/0 for a demo).';
  }
  return `Could not connect to MongoDB: ${message}`;
}

export async function connectDatabase(uri: string, logger: Logger): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
    logger.info({ db: conn.connection.name }, 'MongoDB connected');
    return conn;
  } catch (err) {
    throw new DatabaseConnectionError(explainMongoError(err), { cause: err });
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
