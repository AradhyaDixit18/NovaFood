import { createServer } from 'node:http';
import { createApp } from './app';
import { DatabaseConnectionError, connectDatabase, disconnectDatabase } from './config/db';
import { EnvError, loadEnv } from './config/env';
import { createContext } from './context';
import { attachRealtime } from './realtime/socket';

async function main(): Promise<void> {
  let env;
  try {
    env = loadEnv();
  } catch (err) {
    if (err instanceof EnvError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  const ctx = createContext(env);
  await connectDatabase(env.MONGODB_URI, ctx.logger);

  const app = createApp(ctx);
  const server = createServer(app);
  const io = attachRealtime(ctx, server);

  server.listen(env.PORT, () => {
    ctx.logger.info({ port: env.PORT, features: ctx.features }, `NovaFood API listening on http://localhost:${env.PORT}`);
  });

  const shutdown = (signal: string) => {
    ctx.logger.info({ signal }, 'Shutting down');
    io.close();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => ctx.logger.error({ reason }, 'Unhandled promise rejection'));
}

main().catch((err: unknown) => {
  // One clear line instead of a stack trace for the failures people actually hit on first run.
  if (err instanceof DatabaseConnectionError) console.error(`\n  ✖ ${err.message}\n`);
  else console.error(err);
  process.exit(1);
});
