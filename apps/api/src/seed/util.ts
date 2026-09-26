import { randomBytes } from 'node:crypto';

export { orderNumber, slugify } from '../lib/slug';

export function randomSuffixSafe(): string {
  return randomBytes(8).toString('hex');
}
