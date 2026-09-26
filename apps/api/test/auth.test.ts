import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { Session } from '../src/models/Session';
import { User } from '../src/models/User';
import { FIXED_NOW, createTestKit, createUser } from './helpers';

const kit = createTestKit();
const CSRF = { 'x-requested-with': 'novafood' };

function refreshCookie(res: supertest.Response): string {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith('nf_rt='));
  if (!cookie) throw new Error('no refresh cookie');
  return cookie.split(';')[0]!;
}

describe('registration & login', () => {
  it('registers, sets an httpOnly refresh cookie and never leaks the password hash', async () => {
    const res = await kit.request.post('/api/auth/register').send({ name: 'Riya', email: 'riya@test.dev', password: 'Password123' });
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(res.body.data.user).toMatchObject({ email: 'riya@test.dev', role: 'customer', emailVerified: false });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('nf_rt='))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
  });

  it('rejects a duplicate email', async () => {
    const res = await kit.request.post('/api/auth/register').send({ name: 'Riya', email: 'RIYA@test.dev', password: 'Password123' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('returns field-level validation errors', async () => {
    const res = await kit.request.post('/api/auth/register').send({ name: 'R', email: 'nope', password: 'short' });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.details)).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    const wrong = await kit.request.post('/api/auth/login').send({ email: 'riya@test.dev', password: 'Wrong12345' });
    const unknown = await kit.request.post('/api/auth/login').send({ email: 'ghost@test.dev', password: 'Wrong12345' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toEqual(unknown.body.error);
  });

  it('logs in and reads the profile with the access token', async () => {
    const login = await kit.request.post('/api/auth/login').send({ email: 'riya@test.dev', password: 'Password123' });
    expect(login.status).toBe(200);
    const me = await kit.request.get('/api/auth/me').set('authorization', `Bearer ${login.body.data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.name).toBe('Riya');
  });

  it('rejects requests without or with a tampered token', async () => {
    expect((await kit.request.get('/api/auth/me')).status).toBe(401);
    const res = await kit.request.get('/api/auth/me').set('authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('blocks suspended accounts', async () => {
    const user = await createUser(kit);
    await User.updateOne({ _id: user.id }, { $set: { status: 'SUSPENDED' } });
    const login = await kit.request.post('/api/auth/login').send({ email: user.email, password: user.password });
    expect(login.status).toBe(403);
    const me = await kit.request.get('/api/auth/me').set('authorization', `Bearer ${user.token}`);
    expect(me.status).toBe(401);
  });
});

describe('refresh token rotation', () => {
  it('requires the CSRF header', async () => {
    const user = await createUser(kit);
    const res = await user.agent.post('/api/auth/refresh');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_HEADER_MISSING');
  });

  it('rotates the refresh token and revokes the family when an old token is replayed', async () => {
    const app = createApp(kit.ctx);
    const email = 'rotate@test.dev';
    const reg = await supertest(app).post('/api/auth/register').send({ name: 'Rotate', email, password: 'Password123' });
    const first = refreshCookie(reg);

    const r1 = await supertest(app).post('/api/auth/refresh').set(CSRF).set('cookie', first);
    expect(r1.status).toBe(200);
    const second = refreshCookie(r1);
    expect(second).not.toBe(first);

    // Using the new token works.
    const r2 = await supertest(app).post('/api/auth/refresh').set(CSRF).set('cookie', second);
    expect(r2.status).toBe(200);

    // Replaying the first (already rotated) token outside the grace window is treated as theft.
    const later = createTestKit({ now: () => new Date(FIXED_NOW.getTime() + 60_000) });
    const replay = await supertest(createApp(later.ctx)).post('/api/auth/refresh').set(CSRF).set('cookie', first);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('SESSION_REVOKED');

    const userId = reg.body.data.user._id;
    const active = await Session.countDocuments({ userId, revokedAt: null });
    expect(active).toBe(0);
  });

  it('logs out and invalidates the cookie session', async () => {
    const app = createApp(kit.ctx);
    const reg = await supertest(app).post('/api/auth/register').send({ name: 'Bye', email: 'bye@test.dev', password: 'Password123' });
    const cookie = refreshCookie(reg);
    expect((await supertest(app).post('/api/auth/logout').set(CSRF).set('cookie', cookie)).status).toBe(200);
    expect((await supertest(app).post('/api/auth/refresh').set(CSRF).set('cookie', cookie)).status).toBe(401);
  });
});

describe('email verification & password reset', () => {
  const tokenFrom = (text: string) => decodeURIComponent(/token=([^\s&]+)/.exec(text)![1]!);

  it('verifies email with the emailed link', async () => {
    const user = await createUser(kit);
    const mail = kit.email.outbox.filter((m) => m.to === user.email).at(-1)!;
    expect(mail.subject).toMatch(/verify/i);
    const res = await kit.request.post('/api/auth/verify-email').send({ token: tokenFrom(mail.text) });
    expect(res.status).toBe(200);
    expect(res.body.data.user.emailVerified).toBe(true);
    // Links are single use.
    expect((await kit.request.post('/api/auth/verify-email').send({ token: tokenFrom(mail.text) })).status).toBe(400);
  });

  it('does not reveal whether an email exists', async () => {
    const a = await kit.request.post('/api/auth/forgot-password').send({ email: 'nobody@test.dev' });
    expect(a.status).toBe(200);
    expect(kit.email.outbox.some((m) => m.to === 'nobody@test.dev')).toBe(false);
  });

  it('resets the password and signs out every session', async () => {
    const user = await createUser(kit);
    await kit.request.post('/api/auth/forgot-password').send({ email: user.email });
    const mail = kit.email.outbox.filter((m) => m.to === user.email && /reset/i.test(m.subject)).at(-1)!;
    const reset = await kit.request.post('/api/auth/reset-password').send({ token: tokenFrom(mail.text), password: 'NewPassword456' });
    expect(reset.status).toBe(200);
    expect(await Session.countDocuments({ userId: user.id, revokedAt: null })).toBe(0);
    expect((await kit.request.post('/api/auth/login').send({ email: user.email, password: user.password })).status).toBe(401);
    expect((await kit.request.post('/api/auth/login').send({ email: user.email, password: 'NewPassword456' })).status).toBe(200);
  });
});

describe('rate limiting', () => {
  it('throttles repeated failed logins', async () => {
    const limited = createTestKit({ rateLimits: true });
    let last = 0;
    for (let i = 0; i < 22; i++) {
      last = (await limited.request.post('/api/auth/login').send({ email: 'x@test.dev', password: 'Nope12345' })).status;
    }
    expect(last).toBe(429);
  });

  it('does not let page-load refreshes or successful logins use up the login budget', async () => {
    const limited = createTestKit({ rateLimits: true });
    const user = await createUser(limited);
    // Anonymous refreshes run on every page load; 40 of them used to lock the login out.
    for (let i = 0; i < 40; i++) {
      expect((await limited.request.post('/api/auth/refresh').set('X-Requested-With', 'novafood')).status).toBe(401);
    }
    for (let i = 0; i < 25; i++) {
      expect((await limited.request.post('/api/auth/login').send({ email: user.email, password: user.password })).status).toBe(200);
    }
  });
});

describe('session hint cookie', () => {
  it('is set, readable and secret-free on login, and cleared on logout', async () => {
    const user = await createUser(kit);
    const login = await kit.request.post('/api/auth/login').send({ email: user.email, password: user.password });
    const cookies = ([] as string[]).concat(login.headers['set-cookie'] ?? []);
    const hint = cookies.find((c) => c.startsWith('nf_session='))!;
    expect(hint).toMatch(/^nf_session=1;/);
    expect(hint).toMatch(/Path=\//);
    expect(hint).not.toMatch(/HttpOnly/i);
    expect(cookies.find((c) => c.startsWith('nf_rt='))).toMatch(/HttpOnly/i);

    const out = await kit.request.post('/api/auth/logout').set('X-Requested-With', 'novafood');
    const cleared = ([] as string[]).concat(out.headers['set-cookie'] ?? []).find((c) => c.startsWith('nf_session='))!;
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});
