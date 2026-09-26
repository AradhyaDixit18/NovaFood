import { z } from 'zod';
import { PAGINATION } from '../constants';

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');

/** Accepts true/false, "true"/"false", "1"/"0" (as sent in query strings). */
export const queryBoolean = z.preprocess((value) => {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
}, z.boolean());

/** Accepts an array or a comma-separated string. */
export const queryList = z.preprocess((value) => {
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return value;
}, z.array(z.string().max(60)).max(20));

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(PAGINATION.defaultLimit),
});

export const phone = z
  .string()
  .trim()
  .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

export const trimmed = (max: number) => z.string().trim().max(max);

export const idParams = z.object({ id: objectId });
