import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createTestKit } from './helpers';

function fakeDist() {
  const dir = mkdtempSync(path.join(tmpdir(), 'nf-web-'));
  mkdirSync(path.join(dir, 'assets'));
  writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html><head><script>document.documentElement.dataset.theme="light"</script><script type="module" src="/assets/app-abc.js"></script></head><body><div id="root"></div></body></html>');
  writeFileSync(path.join(dir, 'assets', 'app-abc.js'), 'console.log(1)');
  writeFileSync(path.join(dir, 'robots.txt'), 'User-agent: *');
  return dir;
}

describe('serving the web app from the API (WEB_DIST_DIR)', () => {
  const kit = createTestKit();
  kit.ctx.env.WEB_DIST_DIR = fakeDist();
  const request = supertest(createApp(kit.ctx));

  it('serves the app shell for client routes with a CSP that allows only its own inline script', async () => {
    const res = await request.get('/r/some-restaurant').set('Accept', 'text/html');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root">');
    expect(res.headers['cache-control']).toBe('no-cache');
    const csp = res.headers['content-security-policy'] as string;
    expect(csp).toMatch(/script-src 'self' 'sha256-[A-Za-z0-9+/=]+' https:\/\/checkout\.razorpay\.com/);
    expect(csp).not.toContain("'unsafe-inline' https://checkout");
  });

  it('caches fingerprinted assets forever and serves static files', async () => {
    const asset = await request.get('/assets/app-abc.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toContain('immutable');
    expect((await request.get('/robots.txt')).text).toContain('User-agent');
  });

  it('keeps unknown API routes as JSON 404s with the strict API policy', async () => {
    const res = await request.get('/api/nope').set('Accept', 'text/html');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBeDefined();
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
  });
});
