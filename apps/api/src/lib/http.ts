import type { Response } from 'express';
import type { ZodType, ZodTypeDef } from 'zod';
import type { PageMeta } from '@novafood/shared';
import { validationError } from './errors';

export function send<T>(res: Response, data: T, status = 200, meta?: PageMeta): void {
  res.status(status).json(meta ? { data, meta } : { data });
}

export function pageMeta(page: number, limit: number, total: number): PageMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** Validates untrusted input and converts zod issues into a 422 with per-field messages. */
export function parse<Out, In = unknown>(schema: ZodType<Out, ZodTypeDef, In>, input: unknown): Out {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const details: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    (details[key] ??= []).push(issue.message);
  }
  throw validationError(details);
}

/** Escapes user text for safe use inside a RegExp. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
