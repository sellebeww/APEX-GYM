import { MAX_OPEN_ORDERS_PER_MEMBER, REFERRAL_BONUS_POINTS } from '../../shared/rules.ts';
import { toDateKey } from '../../shared/time.ts';
import { rupiah } from '../../shared/money.ts';
import type { Actor, Deps } from '../context.ts';
import { tx, type DB } from '../db/index.ts';
import { audit, SYSTEM_ACTOR, type AuditActor } from '../lib/audit.ts';
import { newId } from '../lib/crypto.ts';
import { conflict, HttpError, notFound } from '../lib/errors.ts';
import type { GatewayNotification } from '../payments/types.ts';
import { addPtCredits, applyMembership, requireMember, reverseMembership } from './members.ts';

export interface PaymentRow {
  id: string;
  invoice_number: string;
  member_id: string | null;
  customer_name: string;
  amount: number;
  source: 'MEMBERSHIP' | 'PT_PACKAGE' | 'DAILY_PASS';
  item_id: string | null;
  package_name: string;
  item_quantity: number | null;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
  method: 'QRIS' | 'TRANSFER_BCA' | 'MANUAL_CASH';
  provider: 'CASH' | 'SIMULATOR' | 'MIDTRANS' | 'LEGACY';
  provider_order_id: string | null;
  applied_at: string | null;
  created_at: string;
}

const getPayment = (db: DB, id: string) => db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as PaymentRow | undefined;

/** Sequential, gap-free per month: INV-APX-202610-0001 */
export function nextInvoiceNumber(db: DB, now: Date): string {
  const month = toDateKey(now).slice(0, 7).replace('-', '');
  const name = `invoice:${month}`;
  db.prepare('INSERT INTO counters (name, value) VALUES (?, 0) ON CONFLICT(name) DO NOTHING').run(name);
  db.prepare('UPDATE counters SET value = value + 1 WHERE name = ?').run(name);
  const { value } = db.prepare('SELECT value FROM counters WHERE name = ?').get(name) as { value: number };
  return `INV-APX-${month}-${String(value).padStart(4, '0')}`;
}

export interface CreateOrderInput {
  kind: 'MEMBERSHIP' | 'PT_PACKAGE';
  itemId: string;
  method: 'QRIS' | 'TRANSFER_BCA' | 'MANUAL_CASH';
}

/**
 * Creates an unpaid order. The price and what it grants are read from the database; nothing the
 * client sends can change the amount. Every order starts PENDING: cash waits for the front desk,
 * digital methods wait for the payment gateway's signed notification.
 */
export async function createOrder(deps: Deps, actor: Actor, input: CreateOrderInput, ip: string) {
  const { db } = deps;
  const now = deps.now();
  const member = requireMember(db, actor.id);
  const user = db.prepare('SELECT email, phone FROM users WHERE id = ?').get(actor.id) as { email: string; phone: string };

  const item =
    input.kind === 'MEMBERSHIP'
      ? (db.prepare('SELECT id, name, price, duration_days AS qty FROM membership_plans WHERE id = ? AND is_active = 1').get(input.itemId) as
          | { id: string; name: string; price: number; qty: number }
          | undefined)
      : (db.prepare('SELECT id, name, price, session_count AS qty FROM pt_packages WHERE id = ? AND is_active = 1').get(input.itemId) as
          | { id: string; name: string; price: number; qty: number }
          | undefined);
  if (!item) throw notFound('Paket tidak ditemukan atau sudah tidak dijual.');
  if (input.kind === 'PT_PACKAGE' && member.suspended) throw conflict('Keanggotaan sedang ditangguhkan. Hubungi resepsionis.');

  const provider = input.method === 'MANUAL_CASH' ? 'CASH' : deps.gateway.name;
  const paymentId = newId('pay');
  const orderId = provider === 'CASH' ? null : `APX-${paymentId}`;

  const created = tx(db, () => {
    const open = db.prepare("SELECT COUNT(*) AS n FROM payments WHERE member_id = ? AND status = 'PENDING'").get(actor.id) as { n: number };
    if (open.n >= MAX_OPEN_ORDERS_PER_MEMBER) {
      throw conflict(`Anda masih punya ${open.n} pesanan yang belum dibayar. Selesaikan atau tunggu pesanan lama kedaluwarsa.`);
    }
    const invoice = nextInvoiceNumber(db, now);
    db.prepare(
      `INSERT INTO payments (id, invoice_number, member_id, customer_name, amount, source, item_id, package_name, item_quantity,
         status, method, provider, provider_order_id, notes, created_at, created_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      paymentId,
      invoice,
      actor.id,
      member.name,
      item.price,
      input.kind,
      item.id,
      item.name,
      item.qty,
      input.method,
      provider,
      orderId,
      provider === 'CASH' ? 'Menunggu pembayaran tunai di kasir' : 'Menunggu pembayaran',
      now.toISOString(),
      actor.id,
      now.toISOString()
    );
    audit(db, actor, 'CREATE_ORDER', `Pesanan ${invoice}: ${item.name} ${rupiah(item.price)} via ${input.method}`, ip, now);
    return invoice;
  });

  if (provider !== 'CASH') {
    try {
      const charge = await deps.gateway.createCharge({
        orderId: orderId!,
        amount: item.price,
        method: input.method as 'QRIS' | 'TRANSFER_BCA',
        itemId: item.id,
        itemName: item.name,
        customer: { name: member.name, email: user.email, phone: user.phone },
        finishUrl: `${deps.config.publicUrl}/#/member/membership`,
      });
      db.prepare('UPDATE payments SET provider_ref = ?, checkout_url = ?, updated_at = ? WHERE id = ?').run(
        charge.providerRef ?? null,
        charge.checkoutUrl ?? null,
        now.toISOString(),
        paymentId
      );
    } catch (err) {
      db.prepare("UPDATE payments SET status = 'FAILED', notes = ?, updated_at = ? WHERE id = ? AND status = 'PENDING'").run(
        'Gagal membuat transaksi di payment gateway',
        now.toISOString(),
        paymentId
      );
      throw err instanceof HttpError ? err : new HttpError(502, 'Payment gateway sedang tidak dapat dihubungi.', 'GATEWAY_ERROR');
    }
  }
  return { paymentId, invoiceNumber: created };
}

/**
 * Marks a PENDING payment as paid and applies what it bought, exactly once.
 * Safe to call repeatedly (webhook retries, double clicks): anything not PENDING is a no-op.
 */
export function settlePayment(db: DB, paymentId: string, by: AuditActor, now: Date, ip: string | null = null): { applied: boolean; payment: PaymentRow } {
  return tx(db, () => {
    const p = getPayment(db, paymentId);
    if (!p) throw notFound('Pembayaran tidak ditemukan.');
    if (p.status !== 'PENDING') return { applied: false, payment: p };

    let note = '';
    if (p.member_id && p.source === 'MEMBERSHIP' && p.item_quantity) {
      const end = applyMembership(db, p.member_id, { id: p.item_id ?? '', name: p.package_name, durationDays: p.item_quantity }, now);
      note = `Aktivasi ${p.package_name} s/d ${end}`;
      grantReferralBonus(db, p.member_id, now);
    } else if (p.member_id && p.source === 'PT_PACKAGE' && p.item_quantity) {
      addPtCredits(db, p.member_id, p.item_quantity, now);
      note = `Top up ${p.item_quantity} sesi personal training`;
    }
    const iso = now.toISOString();
    db.prepare(
      "UPDATE payments SET status = 'SUCCESS', paid_at = ?, applied_at = ?, confirmed_by = ?, notes = ?, updated_at = ? WHERE id = ? AND status = 'PENDING'"
    ).run(iso, iso, by.id, note || p.package_name, iso, p.id);
    audit(db, by, 'PAYMENT_SETTLED', `${p.invoice_number} lunas (${rupiah(p.amount)}, ${p.customer_name}). ${note}`, ip, now);
    return { applied: true, payment: getPayment(db, paymentId)! };
  });
}

/** Referral bonus is earned once, when the referred member's first membership payment succeeds. */
function grantReferralBonus(db: DB, memberId: string, now: Date) {
  const m = db.prepare('SELECT referred_by FROM member_profiles WHERE user_id = ?').get(memberId) as { referred_by: string | null } | undefined;
  if (!m?.referred_by || m.referred_by === memberId) return;
  const res = db
    .prepare(
      `INSERT INTO points_ledger (id, member_id, delta, reason, ref_type, ref_id, created_at)
       VALUES (?, ?, ?, ?, 'REFERRAL_BONUS', ?, ?) ON CONFLICT (ref_type, ref_id, member_id) DO NOTHING`
    )
    .run(newId('pts'), m.referred_by, REFERRAL_BONUS_POINTS, 'Bonus referral: member baru melakukan pembayaran pertama', memberId, now.toISOString());
  if (res.changes) audit(db, SYSTEM_ACTOR, 'REFERRAL_BONUS', `+${REFERRAL_BONUS_POINTS} poin untuk pemilik kode referral (member ${memberId})`, null, now);
}

export function closePayment(db: DB, paymentId: string, status: 'FAILED' | 'EXPIRED', by: AuditActor, now: Date, reason: string, ip: string | null = null) {
  return tx(db, () => {
    const p = getPayment(db, paymentId);
    if (!p) throw notFound('Pembayaran tidak ditemukan.');
    if (p.status !== 'PENDING') return false;
    db.prepare('UPDATE payments SET status = ?, notes = ?, updated_at = ? WHERE id = ?').run(status, reason, now.toISOString(), p.id);
    audit(db, by, status === 'FAILED' ? 'PAYMENT_CANCELLED' : 'PAYMENT_EXPIRED', `${p.invoice_number}: ${reason}`, ip, now);
    return true;
  });
}

/**
 * Records a refund and takes back what the payment granted (membership days / unused PT credits).
 * For gateway payments the money itself must be returned in the provider dashboard; this keeps
 * the books and the member's entitlements consistent with that.
 */
export function refundPayment(db: DB, paymentId: string, by: AuditActor, reason: string, now: Date, ip: string | null = null) {
  return tx(db, () => {
    const p = getPayment(db, paymentId);
    if (!p) throw notFound('Pembayaran tidak ditemukan.');
    if (p.status === 'REFUNDED') return { changed: false, payment: p };
    if (p.status !== 'SUCCESS') throw conflict('Hanya pembayaran lunas yang dapat di-refund.');
    let effect = '';
    if (p.member_id && p.applied_at && p.item_quantity) {
      if (p.source === 'MEMBERSHIP') {
        const end = reverseMembership(db, p.member_id, p.item_quantity, now);
        effect = end ? ` Masa aktif disesuaikan menjadi s/d ${end}.` : '';
      } else if (p.source === 'PT_PACKAGE') {
        const m = requireMember(db, p.member_id);
        const take = Math.min(m.pt_sessions_remaining, p.item_quantity);
        addPtCredits(db, p.member_id, -take, now);
        effect = ` ${take} sesi PT ditarik${take < p.item_quantity ? ` (${p.item_quantity - take} sudah terpakai)` : ''}.`;
      }
    }
    const iso = now.toISOString();
    db.prepare("UPDATE payments SET status = 'REFUNDED', refunded_at = ?, refund_reason = ?, updated_at = ? WHERE id = ?").run(iso, reason, iso, p.id);
    audit(db, by, 'PAYMENT_REFUNDED', `${p.invoice_number} di-refund (${rupiah(p.amount)}): ${reason}.${effect}`, ip, now);
    return { changed: true, payment: getPayment(db, paymentId)! };
  });
}

/**
 * Handles a verified gateway notification. The amount must match what we charged, each event is
 * processed once (event_key), and before settling we re-query the provider for its own status.
 */
export async function handleGatewayNotification(deps: Deps, n: GatewayNotification): Promise<{ result: string }> {
  const { db } = deps;
  const now = deps.now();
  const p = db.prepare('SELECT * FROM payments WHERE provider_order_id = ?').get(n.orderId) as PaymentRow | undefined;

  const fresh = db
    .prepare('INSERT INTO payment_events (id, payment_id, provider, event_key, status, payload, received_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(event_key) DO NOTHING')
    .run(newId('pev'), p?.id ?? null, deps.gateway.name, n.eventKey, n.status, JSON.stringify(n.raw).slice(0, 20_000), now.toISOString());
  if (!fresh.changes) return { result: 'duplicate' };
  if (!p) return { result: 'unknown-order' };
  if (n.grossAmount !== p.amount) {
    audit(db, SYSTEM_ACTOR, 'PAYMENT_AMOUNT_MISMATCH', `${p.invoice_number}: gateway melaporkan ${n.grossAmount}, tagihan ${p.amount}. Tidak diproses.`, null, now);
    return { result: 'amount-mismatch' };
  }

  let status = n.status;
  if (status === 'SUCCESS') {
    const confirmed = await deps.gateway.fetchStatus(n.orderId);
    if (!confirmed || confirmed.status !== 'SUCCESS' || confirmed.grossAmount !== p.amount) {
      audit(db, SYSTEM_ACTOR, 'PAYMENT_UNCONFIRMED', `${p.invoice_number}: notifikasi lunas tidak terkonfirmasi oleh Status API.`, null, now);
      return { result: 'unconfirmed' };
    }
    status = confirmed.status;
  }

  switch (status) {
    case 'SUCCESS':
      settlePayment(db, p.id, SYSTEM_ACTOR, now);
      return { result: 'settled' };
    case 'FAILED':
    case 'EXPIRED':
      closePayment(db, p.id, status, SYSTEM_ACTOR, now, status === 'FAILED' ? 'Dibatalkan/ditolak oleh payment gateway' : 'Batas waktu pembayaran habis');
      return { result: status.toLowerCase() };
    case 'REFUNDED':
      if (p.status === 'SUCCESS') refundPayment(db, p.id, SYSTEM_ACTOR, 'Refund dari payment gateway', now);
      return { result: 'refunded' };
    default:
      return { result: 'ignored' };
  }
}

/** Cash orders not paid within this many days are closed so they stop blocking new orders. */
export const CASH_ORDER_TTL_DAYS = 3;
/** Gateway orders expire after the provider's own expiry (60 min) plus a margin for late webhooks. */
export const GATEWAY_ORDER_TTL_HOURS = 24;

export function expireStaleOrders(db: DB, now: Date): number {
  const cashCutoff = new Date(now.getTime() - CASH_ORDER_TTL_DAYS * 86_400_000).toISOString();
  const gatewayCutoff = new Date(now.getTime() - GATEWAY_ORDER_TTL_HOURS * 3_600_000).toISOString();
  const stale = db
    .prepare(
      `SELECT id, provider FROM payments WHERE status = 'PENDING'
         AND ((provider = 'CASH' AND created_at < ?) OR (provider <> 'CASH' AND created_at < ?))`
    )
    .all(cashCutoff, gatewayCutoff) as { id: string; provider: string }[];
  for (const s of stale) closePayment(db, s.id, 'EXPIRED', SYSTEM_ACTOR, now, 'Pesanan kedaluwarsa karena belum dibayar');
  return stale.length;
}

export { getPayment };
