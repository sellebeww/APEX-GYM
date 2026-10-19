import { Hono } from 'hono';
import { z } from 'zod';
import { requireRole, type AppEnv } from '../context.ts';
import { forbidden, HttpError, notFound } from '../lib/errors.ts';
import { body, id } from '../lib/validate.ts';
import { closePayment, createOrder, getPayment, handleGatewayNotification } from '../services/payments.ts';

export const paymentRoutes = new Hono<AppEnv>()
  .post('/orders', async c => {
    const actor = requireRole(c, 'MEMBER');
    const deps = c.get('deps');
    deps.limiters.writes.consume(`order:${actor.id}`);
    const input = await body(
      c,
      z.object({ kind: z.enum(['MEMBERSHIP', 'PT_PACKAGE']), itemId: id, method: z.enum(['QRIS', 'TRANSFER_BCA', 'MANUAL_CASH']) })
    );
    const res = await createOrder(deps, actor, input, c.get('ip'));
    return c.json({ ok: true, ...res }, 201);
  })
  .post('/:id/cancel', c => {
    const actor = requireRole(c, 'MEMBER', 'ADMIN');
    const deps = c.get('deps');
    const p = getPayment(deps.db, c.req.param('id'));
    if (!p) throw notFound('Pembayaran tidak ditemukan.');
    if (actor.role === 'MEMBER' && p.member_id !== actor.id) throw forbidden();
    const done = closePayment(deps.db, p.id, 'FAILED', actor, deps.now(), `Dibatalkan oleh ${actor.role === 'ADMIN' ? 'admin' : 'member'}`, c.get('ip'));
    return c.json({ ok: done });
  })
  /** Lets the member pull the latest status from the gateway if a webhook is late. */
  .post('/:id/refresh', async c => {
    const actor = requireRole(c, 'MEMBER', 'ADMIN');
    const deps = c.get('deps');
    const p = getPayment(deps.db, c.req.param('id'));
    if (!p) throw notFound('Pembayaran tidak ditemukan.');
    if (actor.role === 'MEMBER' && p.member_id !== actor.id) throw forbidden();
    if (p.status !== 'PENDING' || !p.provider_order_id || p.provider !== deps.gateway.name) return c.json({ ok: true, status: p.status });
    const n = await deps.gateway.fetchStatus(p.provider_order_id);
    if (n) await handleGatewayNotification(deps, { ...n, eventKey: `${n.eventKey}:poll` });
    return c.json({ ok: true, status: getPayment(deps.db, p.id)!.status });
  })
  .post('/webhooks/midtrans', async c => {
    const deps = c.get('deps');
    if (deps.gateway.name !== 'MIDTRANS') throw new HttpError(404, 'Endpoint tidak ditemukan.');
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      throw new HttpError(400, 'Body notifikasi tidak valid.');
    }
    const notification = deps.gateway.parseWebhook(raw); // throws 401 on a bad signature
    const res = await handleGatewayNotification(deps, notification);
    // 200 tells Midtrans to stop retrying; mismatches are recorded in the audit log for follow-up
    return c.json({ ok: true, ...res });
  });
