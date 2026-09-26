import type { TestProject } from 'vitest/node';

/**
 * Uses MONGO_TEST_URI when provided (for example a local MongoDB or FerretDB); otherwise
 * starts an in-memory MongoDB via mongodb-memory-server, which is what CI uses.
 */
export default async function setup(project: TestProject) {
  let uri = process.env.MONGO_TEST_URI;
  let stop: (() => Promise<unknown>) | undefined;
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const server = await MongoMemoryServer.create();
    uri = server.getUri();
    stop = () => server.stop();
  }
  project.provide('mongoUri', uri);
  return async () => {
    await stop?.();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
