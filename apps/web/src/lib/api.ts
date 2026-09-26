import type { ApiErrorBody, PageMeta } from '@novafood/shared';
import { useAuth } from '../stores/auth';
import { API_URL } from './env';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get isNetwork() {
    return this.code === 'NETWORK_ERROR';
  }
}

type Query = Record<string, string | number | boolean | string[] | null | undefined>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  /** Skip the automatic refresh-and-retry on 401 (used by the auth endpoints themselves). */
  noRefresh?: boolean;
}

export interface Paged<T> {
  data: T;
  meta: PageMeta & Record<string, unknown>;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${API_URL}/api${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return API_URL ? url.toString() : url.pathname + url.search;
}

let refreshing: Promise<boolean> | null = null;

/** Exchanges the httpOnly refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'novafood' },
      });
      if (!res.ok) {
        useAuth.getState().clear();
        return false;
      }
      const body = await res.json();
      useAuth.getState().setSession(body.data.user, body.data.accessToken);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function raw(path: string, options: RequestOptions): Promise<Response> {
  const token = useAuth.getState().accessToken;
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'novafood' };
  if (options.body !== undefined && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      credentials: 'include',
      signal: options.signal,
      body:
        options.body === undefined ? undefined : options.body instanceof FormData ? options.body : JSON.stringify(options.body),
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Internet ne thoda dhokha de diya 😭 Check your connection and try again.');
  }
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return new ApiError(res.status, body.error.code, body.error.message, body.error.details);
  } catch {
    return new ApiError(res.status, 'HTTP_ERROR', res.status >= 500 ? 'Something went wrong on our side. Please try again.' : res.statusText);
  }
}

/** Returns the full `{ data, meta }` envelope; use for paginated lists. */
export async function apiPaged<T>(path: string, options: RequestOptions = {}): Promise<Paged<T>> {
  let res = await raw(path, options);
  if (res.status === 401 && !options.noRefresh && useAuth.getState().accessToken) {
    if (await refreshSession()) res = await raw(path, options);
  }
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as Paged<T>;
}

/** Returns just `data`. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await apiPaged<T>(path, options)).data;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}
