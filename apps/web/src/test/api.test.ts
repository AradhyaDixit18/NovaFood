import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '../lib/api';
import { useAuth } from '../stores/auth';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const user = { _id: 'u1', name: 'A', email: 'a@b.c' } as never;

describe('api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useAuth.getState().clear();
  });

  it('unwraps data and sends the bearer token', async () => {
    useAuth.getState().setSession(user, 'token-1');
    const fetchMock = vi.fn().mockResolvedValue(json(200, { data: { ok: 1 } }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await api('/thing', { query: { a: 1, empty: '', list: ['x', 'y'] } })).toEqual({ ok: 1 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/thing?a=1&list=x%2Cy');
    expect(init.headers.Authorization).toBe('Bearer token-1');
    expect(init.credentials).toBe('include');
  });

  it('refreshes an expired access token once and retries', async () => {
    useAuth.getState().setSession(user, 'old');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: { code: 'TOKEN_INVALID', message: 'expired' } }))
      .mockResolvedValueOnce(json(200, { data: { user, accessToken: 'new' } }))
      .mockResolvedValueOnce(json(200, { data: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await api('/secure')).toBe('ok');
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/auth/refresh');
    expect(fetchMock.mock.calls[1]![1].headers['X-Requested-With']).toBe('novafood');
    expect(fetchMock.mock.calls[2]![1].headers.Authorization).toBe('Bearer new');
    expect(useAuth.getState().accessToken).toBe('new');
  });

  it('signs out when refresh fails and surfaces the API error', async () => {
    useAuth.getState().setSession(user, 'old');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json(401, { error: { code: 'TOKEN_INVALID', message: 'expired' } }))
        .mockResolvedValueOnce(json(401, { error: { code: 'SESSION_EXPIRED', message: 'gone' } })),
    );
    await expect(api('/secure')).rejects.toMatchObject({ status: 401, code: 'TOKEN_INVALID' });
    expect(useAuth.getState().status).toBe('anonymous');
  });

  it('turns network failures into a friendly error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await api('/x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).isNetwork).toBe(true);
  });
});
