import { Hono } from 'hono';
import { deriveMembershipStatus, getDaysRemaining } from '../../shared/membership.ts';
import { z } from 'zod';
import { requireActor, type AppEnv } from '../context.ts';
import { audit } from '../lib/audit.ts';
import { forbidden, notFound } from '../lib/errors.ts';
import { body, id } from '../lib/validate.ts';
import { createSession } from '../services/auth.ts';
import { closePayment, getPayment, settlePayment } from '../services/payments.ts';
import { setSessionCookie } from './auth.ts';

/**
 * Development/demo helpers. Mounted only when DEMO_MODE is on and NODE_ENV is not production
 * (loadConfig refuses to start production with DEMO_MODE, and app.ts checks again).
 */
export const devRoutes = new Hono<AppEnv>()
  /** Demo account list for the account picker (synthetic seed accounts only). */
  .get('/accounts', c => {
    const { db, now } = c.get('deps');
    const rows = db
      .prepare(
        `SELECT u.id, u.name, u.role, u.avatar_url, mp.plan_name, mp.end_date, mp.suspended, cp.title
         FROM users u LEFT JOIN member_profiles mp ON mp.user_id = u.id LEFT JOIN coach_profiles cp ON cp.user_id = u.id
         WHERE u.is_active = 1 ORDER BY CASE u.role WHEN 'ADMIN' THEN 0 WHEN 'COACH' THEN 1 ELSE 2 END, u.name`
      )
      .all() as { id: string; name: string; role: string; avatar_url: string | null; plan_name: string | null; end_date: string | null; suspended: number | null; title: string | null }[];
    return c.json(
      rows.map(r => ({
        id: r.id,
        name: r.name,
        role: r.role,
        avatarUrl: r.avatar_url ?? undefined,
        title: r.title ?? undefined,
        planName: r.plan_name ?? undefined,
        status: r.role === 'MEMBER' ? deriveMembershipStatus({ endDate: r.end_date, suspended: r.suspended === 1 }, now()) : undefined,
        daysRemaining: r.role === 'MEMBER' ? getDaysRemaining(r.end_date, now()) : undefined,
      }))
    );
  })
  .post('/login-as', async c => {
    const deps = c.get('deps');
    const input = await body(c, z.object({ userId: id }));
    const user = deps.db.prepare('SELECT id, name, role FROM users WHERE id = ? AND is_active = 1').get(input.userId) as
      | { id: string; name: string; role: string }
      | undefined;
    if (!user) throw notFound('Akun demo tidak ditemukan.');
    const now = deps.now();
    const session = createSession(deps.db, user.id, deps.config.sessionTtlHours, now, { ip: c.get('ip'), userAgent: c.req.header('user-agent') ?? '' });
    audit(deps.db, user, 'DEMO_LOGIN', 'Masuk lewat pemilih akun demo (mode development)', c.get('ip'), now);
    setSessionCookie(c, session.token, session.expires);
    return c.json({ ok: true, role: user.role });
  })
  .post('/payments/:id/simulate', async c => {
    const deps = c.get('deps');
    const actor = requireActor(c);
    const input = await body(c, z.object({ outcome: z.enum(['SUCCESS', 'FAILED']) }));
    const p = getPayment(deps.db, c.req.param('id'));
    if (!p) throw notFound('Pembayaran tidak ditemukan.');
    if (p.provider !== 'SIMULATOR') throw forbidden('Hanya pesanan simulator yang dapat disimulasikan.');
    if (actor.role === 'MEMBER' && p.member_id !== actor.id) throw forbidden();
    const by = { id: actor.id, name: `${actor.name} (simulator)`, role: actor.role };
    if (input.outcome === 'SUCCESS') settlePayment(deps.db, p.id, by, deps.now(), c.get('ip'));
    else closePayment(deps.db, p.id, 'FAILED', by, deps.now(), 'Simulasi: pembayaran gagal', c.get('ip'));
    return c.json({ ok: true });
  });
