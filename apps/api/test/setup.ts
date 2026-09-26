import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, beforeAll, inject } from 'vitest';

process.env.NODE_ENV = 'test';

beforeAll(async () => {
  const base = inject('mongoUri');
  const url = new URL(base);
  // One throwaway database per test file keeps files independent.
  url.pathname = `/novafood_test_${randomBytes(4).toString('hex')}`;
  await mongoose.connect(url.toString());
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init().catch(() => undefined)));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase().catch(() => undefined);
  await mongoose.disconnect();
});
