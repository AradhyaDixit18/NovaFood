import { randomBytes } from 'node:crypto';

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function uniqueSuffix(): string {
  return randomBytes(3).toString('hex');
}

const ORDER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Human-friendly order reference such as "NF-7KQ2XM", avoiding look-alike characters. */
export function orderNumber(): string {
  const bytes = randomBytes(6);
  let out = 'NF-';
  for (const b of bytes) out += ORDER_ALPHABET[b % ORDER_ALPHABET.length];
  return out;
}
