import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { getCookie } from 'hono/cookie';
import type { AppEnv, Deps } from './context.ts';
import { forbidden, HttpError } from './lib/errors.ts';
import { adminRoutes } from './routes/admin.ts';
import { authRoutes, sessionCookieName } from './routes/auth.ts';
import { coachRoutes } from './routes/coach.ts';
import { devRoutes } from './routes/dev.ts';
import { memberRoutes } from './routes/member.ts';
import { paymentRoutes } from './routes/payments.ts';
import { sharedRoutes } from './routes/shared.ts';
import { resolveSession } from './services/auth.ts';
import { buildSnapshot } from './services/snapshot.ts';

/** Strict CSP: only same-origin scripts; Google Fonts for typography; images from self/data/blob (QR codes, previews). */
export function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    // Inline style attributes are used for dynamic widths/animations (motion); no inline <script> is allowed
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "manifest-src 'self'",
  ].join('; ');
}

export function securityHeaders(isProduction: boolean): Record<string, string> {
  return {
    'Content-Security-Policy': contentSecurityPolicy(),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=()',
    ...(isProduction ? { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains' } : {}),
  };
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function createApp(deps: Deps) {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    c.set('deps', deps);
    let ip = 'unknown';
    if (deps.config.trustProxy) ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || ip;
    if (ip === 'unknown') {
      try {
        ip = getConnInfo(c).remote.address ?? 'unknown';
      } catch {
        ip = 'local';
      }
    }
    c.set('ip', ip);
    await next();
    for (const [k, v] of Object.entries(securityHeaders(deps.config.isProduction))) c.header(k, v);
    if (c.req.path.startsWith('/api/')) c.header('Cache-Control', 'no-store');
  });

  // CSRF: state-changing API calls must come from our own origin and carry a header
  // that a cross-site form or <img> cannot set (it would trigger a CORS preflight we never approve).
  app.use('/api/*', async (c, next) => {
    if (SAFE_METHODS.has(c.req.method) || c.req.path.startsWith('/api/payments/webhooks/')) return next();
    const origin = c.req.header('origin');
    if (origin && !deps.config.allowedOrigins.includes(origin.replace(/\/$/, ''))) throw forbidden('Permintaan dari origin yang tidak diizinkan.');
    const site = c.req.header('sec-fetch-site');
    if (site && site !== 'same-origin' && site !== 'none' && !origin) throw forbidden('Permintaan lintas situs ditolak.');
    if (c.req.header('x-apex-csrf') !== '1') throw forbidden('Header keamanan permintaan tidak ada.');
    return next();
  });

  app.use('/api/*', async (c, next) => {
    c.set('actor', resolveSession(deps.db, getCookie(c, sessionCookieName(deps.config)), deps.now()));
    await next();
  });

  app.use('/api/*', async (c, next) => {
    if (c.req.path === '/api/member/photos') return next();
    return bodyLimit({ maxSize: 256 * 1024, onError: () => { throw new HttpError(413, 'Data yang dikirim terlalu besar.'); } })(c, next);
  });

  app.get('/api/health', c => {
    deps.db.prepare('SELECT 1').get();
    return c.json({ ok: true, time: deps.now().toISOString() });
  });
  app.get('/api/state', c => c.json(buildSnapshot(deps, c.get('actor'))));

  app.route('/api/auth', authRoutes);
  app.route('/api/member', memberRoutes);
  app.route('/api/coach', coachRoutes);
  app.route('/api/admin', adminRoutes);
  app.route('/api/payments', paymentRoutes);
  app.route('/api', sharedRoutes);
  if (deps.config.demoMode && !deps.config.isProduction) app.route('/api/dev', devRoutes);

  app.all('/api/*', c => c.json({ error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } }, 404));

  app.onError((err, c) => {
    if (err instanceof HttpError) {
      return c.json({ error: { code: err.code, message: err.message } }, err.status as 400);
    }
    // Constraint violations that slipped past service checks are still a client conflict, not a crash
    if (err && typeof err === 'object' && 'code' in err && String((err as { code: unknown }).code).startsWith('SQLITE_CONSTRAINT')) {
      return c.json({ error: { code: 'CONFLICT', message: 'Data bentrok dengan data lain. Muat ulang lalu coba lagi.' } }, 409);
    }
    console.error(`[api] ${c.req.method} ${c.req.path}`, err);
    return c.json({ error: { code: 'INTERNAL', message: 'Terjadi kesalahan pada server. Coba lagi beberapa saat.' } }, 500);
  });

  return app;
}
