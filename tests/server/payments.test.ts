import assert from 'node:assert/strict';
import { beforeEach, describe, expect, it } from 'vitest';
import { midtransGateway, midtransSignature } from '../../server/payments/midtrans.ts';
import { setup, type TestEnv } from './helpers.ts';

const SERVER_KEY = 'SB-Mid-server-TESTKEY';

/** Fake Midtrans HTTP API: Snap returns a redirect URL; Status API answers from `statusByOrder`. */
function fakeMidtrans() {
  const statusByOrder = new Map<string, { transaction_status: string; gross_amount: string; status_code: string }>();
  const fetchImpl = (async (url: string | URL) => {
    const u = String(url);
    if (u.endsWith('/snap/v1/transactions')) {
      return new Response(JSON.stringify({ token: 'snap-token', redirect_url: 'https://app.sandbox.midtrans.com/snap/v4/redirection/x' }), { status: 201 });
    }
    const m = /\/v2\/(.+)\/status$/.exec(u);
    if (m) {
      const s = statusByOrder.get(decodeURIComponent(m[1]));
      return s ? new Response(JSON.stringify({ order_id: decodeURIComponent(m[1]), transaction_id: 'trx-1', ...s })) : new Response('{}', { status: 404 });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  return { gateway: midtransGateway({ serverKey: SERVER_KEY, isProduction: false, fetchImpl }), statusByOrder };
}

function notification(orderId: string, gross: string, status: string, statusCode = '200') {
  return {
    order_id: orderId,
    status_code: statusCode,
    gross_amount: gross,
    transaction_status: status,
    transaction_id: 'trx-1',
    fraud_status: 'accept',
    signature_key: midtransSignature({ order_id: orderId, status_code: statusCode, gross_amount: gross }, SERVER_KEY),
  };
}

const profileOf = (t: TestEnv, id: string) =>
  t.db.prepare('SELECT end_date, pt_sessions_remaining FROM member_profiles WHERE user_id = ?').get(id) as { end_date: string; pt_sessions_remaining: number };
const paymentOf = (t: TestEnv, id: string) => t.db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as any;

describe('orders (simulator)', () => {
  let t: TestEnv;
  let siti: string;
  let admin: string;
  beforeEach(async () => {
    t = setup();
    siti = await t.login('siti@gym.test'); // expired member
    admin = await t.login('admin@gym.test');
  });

  it('takes the price from the database and starts every order as PENDING', async () => {
    const res = await t.call('POST', '/api/payments/orders', { cookie: siti, body: { kind: 'MEMBERSHIP', itemId: 'plan-1m', method: 'QRIS', amount: 1 } });
    expect(res.status).toBe(201);
    const p = paymentOf(t, res.json.paymentId);
    expect(p.amount).toBe(380000);
    expect(p.status).toBe('PENDING');
    expect(res.json.invoiceNumber).toMatch(/^INV-APX-202610-\d{4}$/);
    // Nothing granted yet
    expect(profileOf(t, 'member-siti').end_date < '2026-10-14').toBe(true);
  });

  it('cash stays pending until an admin confirms, and only once', async () => {
    const order = await t.call('POST', '/api/payments/orders', { cookie: siti, body: { kind: 'MEMBERSHIP', itemId: 'plan-1m', method: 'MANUAL_CASH' } });
    expect((await t.call('POST', `/api/admin/payments/${order.json.paymentId}/confirm-cash`, { cookie: siti })).status).toBe(403);
    const ok = await t.call('POST', `/api/admin/payments/${order.json.paymentId}/confirm-cash`, { cookie: admin });
    expect(ok.status).toBe(200);
    // 30-day plan bought on 14 Oct by a lapsed member: valid 14 Oct .. 12 Nov inclusive
    expect(profileOf(t, 'member-siti').end_date).toBe('2026-11-12');
    expect((await t.call('POST', `/api/admin/payments/${order.json.paymentId}/confirm-cash`, { cookie: admin })).status).toBe(409);
    expect(profileOf(t, 'member-siti').end_date).toBe('2026-11-12');
  });

  it('digital payments cannot be confirmed by hand at the front desk', async () => {
    const order = await t.call('POST', '/api/payments/orders', { cookie: siti, body: { kind: 'MEMBERSHIP', itemId: 'plan-1m', method: 'QRIS' } });
    expect((await t.call('POST', `/api/admin/payments/${order.json.paymentId}/confirm-cash`, { cookie: admin })).status).toBe(409);
  });

  it('the simulator settles exactly once and PT credits are added once', async () => {
    const reza = await t.login('reza@gym.test');
    const before = profileOf(t, 'member-reza').pt_sessions_remaining;
    const order = await t.call('POST', '/api/payments/orders', { cookie: reza, body: { kind: 'PT_PACKAGE', itemId: 'pt-4', method: 'TRANSFER_BCA' } });
    await t.call('POST', `/api/dev/payments/${order.json.paymentId}/simulate`, { cookie: reza, body: { outcome: 'SUCCESS' } });
    await t.call('POST', `/api/dev/payments/${order.json.paymentId}/simulate`, { cookie: reza, body: { outcome: 'SUCCESS' } });
    expect(profileOf(t, 'member-reza').pt_sessions_remaining).toBe(before + 4);
  });

  it('a member cannot simulate or cancel someone else\'s order', async () => {
    const order = await t.call('POST', '/api/payments/orders', { cookie: siti, body: { kind: 'MEMBERSHIP', itemId: 'plan-1m', method: 'QRIS' } });
    const reza = await t.login('reza@gym.test');
    expect((await t.call('POST', `/api/dev/payments/${order.json.paymentId}/simulate`, { cookie: reza, body: { outcome: 'SUCCESS' } })).status).toBe(403);
    expect((await t.call('POST', `/api/payments/${order.json.paymentId}/cancel`, { cookie: reza })).status).toBe(403);
  });

  it('limits the number of open unpaid orders', async () => {
    for (let i = 0; i < 3; i++) {
      expect((await t.call('POST', '/api/payments/orders', { cookie: siti, body: { kind: 'MEMBERSHIP', itemId: 'plan-1m', method: 'MANUAL_CASH' } })).status).toBe(201);
    }
    expect((await t.call('POST', '/api/payments/orders', { cookie: siti, body: { kind: 'MEMBERSHIP', itemId: 'plan-1m', method: 'MANUAL_CASH' } })).status).toBe(409);
  });

  it('a renewal stacks after the current end date for an active member', async () => {
    const reza = await t.login('reza@gym.test');
    const end = profileOf(t, 'member-reza').end_date;
    const order = await t.call('POST', '/api/payments/orders', { cookie: reza, body: { kind: 'MEMBERSHIP', itemId: 'plan-1m', method: 'MANUAL_CASH' } });
    await t.call('POST', `/api/admin/payments/${order.json.paymentId}/confirm-cash`, { cookie: admin });
    const [y, m, d] = end.split('-').map(Number);
    const expected = new Date(Date.UTC(y, m - 1, d + 30)).toISOString().slice(0, 10);
    expect(profileOf(t, 'member-reza').end_date).toBe(expected);
  });

  it('refund takes back the granted days and is recorded once', async () => {
    const order = await t.call('POST', '/api/payments/orders', { cookie: siti, body: { kind: 'MEMBERSHIP', itemId: 'plan-1m', method: 'MANUAL_CASH' } });
    await t.call('POST', `/api/admin/payments/${order.json.paymentId}/confirm-cash`, { cookie: admin });
    const res = await t.call('POST', `/api/admin/payments/${order.json.paymentId}/refund`, { cookie: admin, body: { reason: 'Salah pilih paket' } });
    expect(res.status).toBe(200);
    expect(paymentOf(t, order.json.paymentId).status).toBe('REFUNDED');
    expect(profileOf(t, 'member-siti').end_date).toBe('2026-10-13'); // back to "expired yesterday"
    expect((await t.call('POST', `/api/admin/payments/${order.json.paymentId}/refund`, { cookie: admin, body: { reason: 'lagi lagi' } })).status).toBe(409);
  });

  it('stale unpaid orders expire and stop blocking new ones', async () => {
    const { expireStaleOrders } = await import('../../server/services/payments.ts');
    const order = await t.call('POST', '/api/payments/orders', { cookie: siti, body: { kind: 'MEMBERSHIP', itemId: 'plan-1m', method: 'MANUAL_CASH' } });
    t.advance(4 * 86_400_000);
    expect(expireStaleOrders(t.db, t.clock.now)).toBe(1);
    expect(paymentOf(t, order.json.paymentId).status).toBe('EXPIRED');
    expect((await t.call('POST', `/api/admin/payments/${order.json.paymentId}/confirm-cash`, { cookie: admin })).status).toBe(409);
  });
});

describe('Midtrans webhook', () => {
  let t: TestEnv;
  let fake: ReturnType<typeof fakeMidtrans>;
  let siti: string;
  let orderId: string;
  let paymentId: string;

  beforeEach(async () => {
    fake = fakeMidtrans();
    t = setup({ gateway: fake.gateway });
    siti = await t.login('siti@gym.test');
    const res = await t.call('POST', '/api/payments/orders', { cookie: siti, body: { kind: 'MEMBERSHIP', itemId: 'plan-1m', method: 'QRIS' } });
    assert.equal(res.status, 201);
    paymentId = res.json.paymentId;
    orderId = paymentOf(t, paymentId).provider_order_id;
    assert.match(String(paymentOf(t, paymentId).checkout_url), /^https:\/\/app\.sandbox\.midtrans\.com/);
  });

  const hook = (body: unknown) => t.call('POST', '/api/payments/webhooks/midtrans', { body, headers: { origin: '', 'x-apex-csrf': '' } });

  it('rejects a forged notification', async () => {
    const n = { ...notification(orderId, '380000.00', 'settlement'), signature_key: 'f'.repeat(128) };
    expect((await hook(n)).status).toBe(401);
    expect(paymentOf(t, paymentId).status).toBe('PENDING');
  });

  it('settles a genuine notification once the Status API agrees', async () => {
    fake.statusByOrder.set(orderId, { transaction_status: 'settlement', gross_amount: '380000.00', status_code: '200' });
    const res = await hook(notification(orderId, '380000.00', 'settlement'));
    expect(res.json.result).toBe('settled');
    expect(paymentOf(t, paymentId).status).toBe('SUCCESS');
    expect(profileOf(t, 'member-siti').end_date).toBe('2026-11-12');
    // Retried delivery of the same event is ignored
    expect((await hook(notification(orderId, '380000.00', 'settlement'))).json.result).toBe('duplicate');
    expect(profileOf(t, 'member-siti').end_date).toBe('2026-11-12');
  });

  it('does not settle when the Status API does not confirm payment', async () => {
    fake.statusByOrder.set(orderId, { transaction_status: 'pending', gross_amount: '380000.00', status_code: '201' });
    expect((await hook(notification(orderId, '380000.00', 'settlement'))).json.result).toBe('unconfirmed');
    expect(paymentOf(t, paymentId).status).toBe('PENDING');
  });

  it('ignores a notification whose amount differs from the order', async () => {
    fake.statusByOrder.set(orderId, { transaction_status: 'settlement', gross_amount: '1000.00', status_code: '200' });
    expect((await hook(notification(orderId, '1000.00', 'settlement'))).json.result).toBe('amount-mismatch');
    expect(paymentOf(t, paymentId).status).toBe('PENDING');
  });

  it('marks expired and failed transactions without granting anything', async () => {
    expect((await hook(notification(orderId, '380000.00', 'expire', '407'))).json.result).toBe('expired');
    expect(paymentOf(t, paymentId).status).toBe('EXPIRED');
    expect(profileOf(t, 'member-siti').end_date < '2026-10-14').toBe(true);
  });

  it('a refund notification reverses a settled payment', async () => {
    fake.statusByOrder.set(orderId, { transaction_status: 'settlement', gross_amount: '380000.00', status_code: '200' });
    await hook(notification(orderId, '380000.00', 'settlement'));
    expect((await hook(notification(orderId, '380000.00', 'refund'))).json.result).toBe('refunded');
    expect(paymentOf(t, paymentId).status).toBe('REFUNDED');
  });

  it('the member can pull the status if the webhook is late', async () => {
    fake.statusByOrder.set(orderId, { transaction_status: 'settlement', gross_amount: '380000.00', status_code: '200' });
    const res = await t.call('POST', `/api/payments/${paymentId}/refresh`, { cookie: siti });
    expect(res.json.status).toBe('SUCCESS');
  });
});
