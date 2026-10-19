import { describe, expect, it } from 'vitest';
import { setup } from './helpers.ts';

// Vercel runs several function instances, each with its own /tmp SQLite. A demo session made on
// one instance must still be recognised by another (or by the same one after a cold start).
const env = { SESSION_SECRET: 'serverless-demo-secret-'.padEnd(48, 'x') };

describe('serverless demo sessions', () => {
  it('a session created on one instance is accepted by another instance', async () => {
    const a = setup({ env });
    const b = setup({ env });
    for (const userId of ['user-admin', 'coach-hendra']) {
      const res = await a.call('POST', '/api/dev/login-as', { body: { userId } });
      expect(res.status).toBe(200);
      const state = await b.call('GET', '/api/state', { cookie: res.cookie });
      expect(state.json.me?.id).toBe(userId);
    }
  });

  it('rejects a tampered signed session', async () => {
    const a = setup({ env });
    const b = setup({ env });
    const res = await a.call('POST', '/api/dev/login-as', { body: { userId: 'coach-hendra' } });
    const forged = res.cookie!.replace('coach-hendra', 'user-admin');
    const state = await b.call('GET', '/api/state', { cookie: forged });
    expect(state.json.me ?? null).toBeNull();
  });

  it('without SESSION_SECRET sessions stay database-only', async () => {
    const a = setup();
    const b = setup();
    const res = await a.call('POST', '/api/dev/login-as', { body: { userId: 'user-admin' } });
    const state = await b.call('GET', '/api/state', { cookie: res.cookie });
    expect(state.json.me ?? null).toBeNull();
  });
});

describe('same-origin requests on any deployment alias', () => {
  it('accepts a POST whose Origin matches the host it was sent to', async () => {
    const t = setup();
    const host = 'https://apex-gym-vassels-projects.vercel.app';
    const res = await t.app.request(`${host}/api/dev/login-as`, {
      method: 'POST',
      headers: { origin: host, 'x-apex-csrf': '1', 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'user-admin' }),
    });
    expect(res.status).toBe(200);
  });

  it('still rejects a foreign Origin', async () => {
    const t = setup();
    const res = await t.app.request('https://apex-gym-vassels-projects.vercel.app/api/dev/login-as', {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'x-apex-csrf': '1', 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'user-admin' }),
    });
    expect(res.status).toBe(403);
  });
});
