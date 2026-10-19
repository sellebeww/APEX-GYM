import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { migrate, openDatabase } from './db/index.ts';
import { seedDatabase } from './db/seed.ts';
import { createDeps } from './deps.ts';
import { purgeUsedQrTokens } from './services/checkin.ts';
import { expireStaleOrders } from './services/payments.ts';

const config = loadConfig();
const db = openDatabase(config.databasePath);
const ran = migrate(db);
if (ran.length) console.info(`[db] migrasi diterapkan: ${ran.join(', ')}`);

const userCount = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
if (userCount === 0 && config.demoMode && !config.isProduction) {
  seedDatabase(db, { now: new Date() });
  console.info('[db] database kosong: data demo (sintetis) dibuat. Password semua akun demo: lihat README.');
} else if (userCount === 0) {
  console.warn('[db] database kosong. Buat akun admin pertama dengan `npm run admin:create`.');
}
if (!process.env.QR_SIGNING_SECRET) console.warn('[config] QR_SIGNING_SECRET kosong: memakai secret sementara (QR lama tidak berlaku setelah restart).');
if (config.paymentProvider === 'simulator') console.warn('[config] PAYMENT_PROVIDER=simulator: tidak ada uang sungguhan yang diproses.');

const deps = createDeps(config, db);
const app = createApp(deps);

if (config.serveStatic) {
  const indexFile = path.join(config.staticDir, 'index.html');
  if (!fs.existsSync(indexFile)) throw new Error(`Build frontend tidak ditemukan di ${config.staticDir}. Jalankan "npm run build" dulu.`);
  const root = path.relative(process.cwd(), config.staticDir) || '.';
  app.use('/assets/*', async (c, next) => {
    await next();
    if (c.res.status === 200) c.header('Cache-Control', 'public, max-age=31536000, immutable');
  });
  app.use('*', serveStatic({ root }));
  // SPA fallback: every non-API GET renders the app shell (hash routing does the rest)
  const shell = fs.readFileSync(indexFile, 'utf8');
  app.get('*', c => {
    c.header('Cache-Control', 'no-cache');
    return c.html(shell);
  });
}

// Housekeeping: close abandoned orders and drop expired replay-protection rows
const housekeeping = () => {
  try {
    const now = deps.now();
    const expired = expireStaleOrders(db, now);
    purgeUsedQrTokens(db, now);
    if (expired) console.info(`[jobs] ${expired} pesanan kedaluwarsa ditutup`);
  } catch (err) {
    console.error('[jobs] housekeeping gagal', err);
  }
};
housekeeping();
const timer = setInterval(housekeeping, 10 * 60_000);

const server = serve({ fetch: app.fetch, hostname: config.host, port: config.port }, info => {
  console.info(`[api] APEX Gym ${config.env} berjalan di http://${info.address}:${info.port}`);
});

const shutdown = () => {
  clearInterval(timer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
