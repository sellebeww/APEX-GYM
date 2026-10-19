import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_FAILED_LOGINS } from '../../server/services/auth.ts';
import { ORIGIN, PASSWORD, setup, type TestEnv } from './helpers.ts';

let t: TestEnv;
beforeEach(() => {
  t = setup();
});

describe('login & sessions', () => {
  it('rejects a wrong password with a generic message', async () => {
    const res = await t.call('POST', '/api/auth/login', { body: { email: 'reza@gym.test', password: 'wrong-password-1' } });
    expect(res.status).toBe(401);
    expect(res.json.error.message).toBe('Email atau password salah.');
  });

  it('gives the same answer for an unknown email (no account enumeration)', async () => {
    const res = await t.call('POST', '/api/auth/login', { body: { email: 'nobody@gym.test', password: 'whatever-123' } });
    expect(res.status).toBe(401);
    expect(res.json.error.message).toBe('Email atau password salah.');
  });

  it('sets an HttpOnly SameSite session cookie and exposes the user in /api/state', async () => {
    const res = await t.call('POST', '/api/auth/login', { body: { email: 'REZA@gym.test', password: PASSWORD } });
    expect(res.status).toBe(200);
    const raw = res.headers.get('set-cookie')!;
    expect(raw).toMatch(/HttpOnly/);
    expect(raw).toMatch(/SameSite=Lax/);
    const state = await t.call('GET', '/api/state', { cookie: res.cookie });
    expect(state.json.me.email).toBe('reza@gym.test');
    expect(state.json.me.role).toBe('MEMBER');
  });

  it('locks the account after repeated failures, even for the correct password', async () => {
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      await t.call('POST', '/api/auth/login', { body: { email: 'nadia@gym.test', password: `nope-${i}xx1` } });
    }
    const res = await t.call('POST', '/api/auth/login', { body: { email: 'nadia@gym.test', password: PASSWORD } });
    expect(res.status).toBe(423);
    t.advance(16 * 60_000);
    t.deps.limiters.loginAccount.reset('nadia@gym.test');
    expect((await t.call('POST', '/api/auth/login', { body: { email: 'nadia@gym.test', password: PASSWORD } })).status).toBe(200);
  });

  it('logout revokes the session server-side', async () => {
    const cookie = await t.login('reza@gym.test');
    await t.call('POST', '/api/auth/logout', { cookie });
    const state = await t.call('GET', '/api/state', { cookie });
    expect(state.json.me).toBeNull();
    expect((await t.call('POST', '/api/member/qr-token', { cookie })).status).toBe(401);
  });

  it('expires sessions after their lifetime', async () => {
    const cookie = await t.login('reza@gym.test');
    t.advance((t.config.sessionTtlHours + 1) * 3_600_000);
    expect((await t.call('GET', '/api/state', { cookie })).json.me).toBeNull();
  });

  it('changing the password signs out other devices', async () => {
    const a = await t.login('reza@gym.test');
    const b = await t.login('reza@gym.test');
    const res = await t.call('POST', '/api/auth/change-password', { cookie: a, body: { currentPassword: PASSWORD, newPassword: 'BrandNewPass99' } });
    expect(res.status).toBe(200);
    expect((await t.call('GET', '/api/state', { cookie: b })).json.me).toBeNull();
    expect((await t.call('GET', '/api/state', { cookie: res.cookie })).json.me.email).toBe('reza@gym.test');
    await expect(t.login('reza@gym.test')).rejects.toThrow(/login reza@gym.test failed: 401/);
    await t.login('reza@gym.test', 'BrandNewPass99');
  });

  it('admin reset issues a temporary password that must be changed', async () => {
    const admin = await t.login('admin@gym.test');
    const res = await t.call('POST', '/api/admin/users/member-kevin/reset-password', { cookie: admin });
    expect(res.status).toBe(200);
    const temp = res.json.temporaryPassword as string;
    expect(temp).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const kevin = await t.login('kevin@gym.test', temp);
    expect((await t.call('GET', '/api/state', { cookie: kevin })).json.me.mustChangePassword).toBe(true);
    await expect(t.login('kevin@gym.test', PASSWORD)).rejects.toThrow(/login kevin@gym.test failed: 401/);
  });
});

describe('registration', () => {
  const valid = { name: 'Dewi Lestari', email: 'dewi@example.test', phone: '0812-7000-1234', password: 'StrongPass123' };

  it('creates a member without any active access', async () => {
    const res = await t.call('POST', '/api/auth/register', { body: valid });
    expect(res.status).toBe(201);
    const state = await t.call('GET', '/api/state', { cookie: res.cookie });
    const profile = state.json.memberProfiles[state.json.me.id];
    expect(profile.status).toBe('EXPIRED');
    expect(profile.ptSessionsRemaining).toBe(0);
    expect(state.json.referral.code).toMatch(/^DEWI-[A-Z2-9]{4}$/);
  });

  it('rejects weak passwords, duplicates and unknown referral codes', async () => {
    expect((await t.call('POST', '/api/auth/register', { body: { ...valid, password: 'short' } })).status).toBe(400);
    expect((await t.call('POST', '/api/auth/register', { body: { ...valid, email: 'reza@gym.test' } })).status).toBe(409);
    expect((await t.call('POST', '/api/auth/register', { body: { ...valid, phone: '0817-4455-6677' } })).status).toBe(409);
    expect((await t.call('POST', '/api/auth/register', { body: { ...valid, referralCode: 'NOPE-0000' } })).status).toBe(400);
  });

  it('cannot register as staff by adding a role field', async () => {
    const res = await t.call('POST', '/api/auth/register', { body: { ...valid, role: 'ADMIN' } });
    const state = await t.call('GET', '/api/state', { cookie: res.cookie });
    expect(state.json.me.role).toBe('MEMBER');
  });
});

describe('CSRF & request hygiene', () => {
  it('rejects state-changing requests without the CSRF header', async () => {
    const res = await t.call('POST', '/api/auth/login', { body: { email: 'reza@gym.test', password: PASSWORD }, headers: { 'x-apex-csrf': '' } });
    expect(res.status).toBe(403);
  });

  it('rejects requests from a foreign origin', async () => {
    const res = await t.call('POST', '/api/auth/login', { body: { email: 'reza@gym.test', password: PASSWORD }, headers: { origin: 'https://evil.example' } });
    expect(res.status).toBe(403);
  });

  it('sends security headers including a strict CSP', async () => {
    const res = await t.call('GET', '/api/health', { headers: { origin: ORIGIN } });
    expect(res.headers.get('content-security-policy')).toMatch(/script-src 'self'/);
    expect(res.headers.get('content-security-policy')).toMatch(/frame-ancestors 'none'/);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('returns readable validation errors', async () => {
    const res = await t.call('POST', '/api/auth/register', { body: { name: 'A', email: 'x', phone: '1', password: '1' } });
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe('VALIDATION');
  });
});

describe('production configuration guard', () => {
  it('refuses to start production with demo mode, the simulator, or missing secrets', async () => {
    const { loadConfig } = await import('../../server/config.ts');
    expect(() => loadConfig({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(/QR_SIGNING_SECRET/);
    expect(() =>
      loadConfig({ NODE_ENV: 'production', QR_SIGNING_SECRET: 'x'.repeat(40), PAYMENT_PROVIDER: 'simulator', PUBLIC_URL: 'https://apex.example' } as NodeJS.ProcessEnv)
    ).toThrow(/simulator/);
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        QR_SIGNING_SECRET: 'x'.repeat(40),
        MIDTRANS_SERVER_KEY: 'k',
        DEMO_MODE: 'true',
        PUBLIC_URL: 'https://apex.example',
      } as NodeJS.ProcessEnv)
    ).toThrow(/DEMO_MODE/);
    const ok = loadConfig({ NODE_ENV: 'production', QR_SIGNING_SECRET: 'x'.repeat(40), MIDTRANS_SERVER_KEY: 'k', PUBLIC_URL: 'https://apex.example' } as NodeJS.ProcessEnv);
    expect(ok.demoMode).toBe(false);
    expect(ok.cookieSecure).toBe(true);
  });

  it('does not mount demo endpoints when demo mode is off', async () => {
    const off = setup({ env: { DEMO_MODE: 'false' } });
    expect((await off.call('POST', '/api/dev/login-as', { body: { userId: 'user-admin' } })).status).toBe(404);
  });
});
