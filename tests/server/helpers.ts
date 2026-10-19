import { createApp } from '../../server/app.ts';
import { loadConfig } from '../../server/config.ts';
import { migrate, openDatabase } from '../../server/db/index.ts';
import { seedDatabase } from '../../server/db/seed.ts';
import { createDeps } from '../../server/deps.ts';
import { memoryStorage } from '../../server/lib/storage.ts';
import type { PaymentGateway } from '../../server/payments/types.ts';

export const PASSWORD = 'TestPassw0rd!';
export const ORIGIN = 'http://localhost:3000';
/** 14 Oct 2026, 10:00 WIB */
export const T0 = new Date('2026-10-14T03:00:00.000Z');

export function setup(opts: { env?: Record<string, string>; gateway?: PaymentGateway; now?: Date } = {}) {
  const config = loadConfig({
    NODE_ENV: 'test',
    QR_SIGNING_SECRET: 'test-secret-'.padEnd(48, 'x'),
    DEMO_MODE: 'true',
    PAYMENT_PROVIDER: 'simulator',
    ...opts.env,
  } as NodeJS.ProcessEnv);
  const db = openDatabase(':memory:');
  migrate(db);
  const clock = { now: opts.now ?? T0 };
  seedDatabase(db, { now: clock.now, password: PASSWORD });
  const deps = createDeps(config, db, { now: () => clock.now, storage: memoryStorage(), gateway: opts.gateway });
  const app = createApp(deps);

  async function call(method: string, path: string, init: { body?: unknown; cookie?: string; headers?: Record<string, string>; raw?: boolean } = {}) {
    const headers: Record<string, string> = { origin: ORIGIN, 'x-apex-csrf': '1', ...init.headers };
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    if (init.cookie) headers.cookie = init.cookie;
    const res = await app.request(path, { method, headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON */
    }
    const setCookie = res.headers.get('set-cookie');
    return { status: res.status, json, headers: res.headers, cookie: setCookie ? setCookie.split(';')[0] : undefined };
  }

  async function login(email: string, password = PASSWORD) {
    const res = await call('POST', '/api/auth/login', { body: { email, password } });
    if (res.status !== 200 || !res.cookie) throw new Error(`login ${email} failed: ${res.status} ${JSON.stringify(res.json)}`);
    return res.cookie;
  }

  return {
    app,
    db,
    deps,
    config,
    clock,
    call,
    login,
    advance(ms: number) {
      clock.now = new Date(clock.now.getTime() + ms);
    },
  };
}

export type TestEnv = ReturnType<typeof setup>;
