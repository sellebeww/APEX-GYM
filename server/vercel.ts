// Vercel Function entry: the whole API as one Node handler (bundled by scripts/vercel-build.ts).
import { getRequestListener } from '@hono/node-server';
import { createHash } from 'node:crypto';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { migrate, openDatabase } from './db/index.ts';
import { seedDatabase } from './db/seed.ts';
import { createDeps } from './deps.ts';

const hosts = [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL].filter(Boolean);
const publicUrl = `https://${hosts[0] ?? 'localhost'}`;

// shortcut: demo mode on a per-instance SQLite in /tmp. Data resets on every cold start and is not shared
// between instances. Move to a hosted database (e.g. Turso/Postgres) before real members use this.
// Secrets must be identical on every instance or sessions/QR codes break when a request lands elsewhere.
// The fallback is guessable, which is acceptable only because demo mode already lets anyone sign in as any account.
const demoSecret = (name: string) => process.env[name] || createHash('sha256').update(`apex-demo:${name}:${process.env.VERCEL_PROJECT_ID ?? ''}`).digest('hex');
const config = loadConfig({
  ...process.env,
  SESSION_SECRET: demoSecret('SESSION_SECRET'),
  QR_SIGNING_SECRET: demoSecret('QR_SIGNING_SECRET'),
  NODE_ENV: 'development',
  DEMO_MODE: 'true',
  DATABASE_PATH: '/tmp/apex.db',
  UPLOAD_DIR: '/tmp/uploads',
  SERVE_STATIC: 'false',
  COOKIE_SECURE: 'true',
  TRUST_PROXY: 'true',
  PUBLIC_URL: publicUrl,
  ALLOWED_ORIGINS: hosts.map(h => `https://${h}`).join(','),
});

const db = openDatabase(config.databasePath);
migrate(db);
if ((db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n === 0) seedDatabase(db, { now: new Date() });

export default getRequestListener(createApp(createDeps(config, db)).fetch);
