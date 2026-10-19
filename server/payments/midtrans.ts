import { safeEqualString, sha512Hex } from '../lib/crypto.ts';
import { HttpError } from '../lib/errors.ts';
import type { GatewayNotification, GatewayStatus, PaymentGateway } from './types.ts';

/**
 * Midtrans Snap integration (https://docs.midtrans.com).
 * NOTE: written against the public API documentation; it has not been exercised against a live
 * sandbox account from this repository. Run the sandbox checklist in the README before going live.
 */
interface MidtransNotification {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
  transaction_id?: string;
}

export function mapMidtransStatus(transactionStatus: string | undefined, fraudStatus: string | undefined): GatewayStatus {
  switch (transactionStatus) {
    case 'settlement':
      return 'SUCCESS';
    case 'capture':
      return fraudStatus === 'accept' || fraudStatus === undefined ? 'SUCCESS' : 'PENDING';
    case 'pending':
      return 'PENDING';
    case 'deny':
    case 'cancel':
    case 'failure':
      return 'FAILED';
    case 'expire':
      return 'EXPIRED';
    case 'refund':
      return 'REFUNDED';
    default:
      // partial_refund, authorize, chargeback…: logged and left for manual handling
      return 'IGNORED';
  }
}

/** signature_key = SHA512(order_id + status_code + gross_amount + ServerKey) */
export function midtransSignature(n: { order_id: string; status_code: string; gross_amount: string }, serverKey: string) {
  return sha512Hex(`${n.order_id}${n.status_code}${n.gross_amount}${serverKey}`);
}

function parseGross(gross: string): number {
  // Midtrans sends "150000.00"; IDR amounts are whole rupiah
  const n = Number(gross);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new HttpError(400, 'gross_amount tidak valid', 'BAD_WEBHOOK');
  return n;
}

export function midtransGateway(opts: { serverKey: string; isProduction: boolean; fetchImpl?: typeof fetch }): PaymentGateway {
  const snapBase = opts.isProduction ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
  const apiBase = opts.isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
  const doFetch = opts.fetchImpl ?? fetch;
  const auth = `Basic ${Buffer.from(`${opts.serverKey}:`).toString('base64')}`;

  const normalise = (n: MidtransNotification, verifySignature: boolean): GatewayNotification => {
    if (!n.order_id || !n.status_code || !n.gross_amount || !n.transaction_status) {
      throw new HttpError(400, 'Notifikasi pembayaran tidak lengkap.', 'BAD_WEBHOOK');
    }
    if (verifySignature) {
      const expected = midtransSignature({ order_id: n.order_id, status_code: n.status_code, gross_amount: n.gross_amount }, opts.serverKey);
      if (!n.signature_key || !safeEqualString(expected, n.signature_key)) {
        throw new HttpError(401, 'Signature notifikasi tidak valid.', 'BAD_SIGNATURE');
      }
    }
    const status = mapMidtransStatus(n.transaction_status, n.fraud_status);
    return {
      orderId: n.order_id,
      status,
      grossAmount: parseGross(n.gross_amount),
      eventKey: `midtrans:${n.order_id}:${n.transaction_id ?? '-'}:${n.transaction_status}:${n.fraud_status ?? '-'}`,
      providerRef: n.transaction_id,
      raw: n,
    };
  };

  return {
    name: 'MIDTRANS',
    async createCharge(input) {
      const res = await doFetch(`${snapBase}/snap/v1/transactions`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          transaction_details: { order_id: input.orderId, gross_amount: input.amount },
          item_details: [{ id: input.itemId, price: input.amount, quantity: 1, name: input.itemName.slice(0, 50) }],
          customer_details: { first_name: input.customer.name.slice(0, 50), email: input.customer.email, phone: input.customer.phone },
          enabled_payments: input.method === 'QRIS' ? ['other_qris'] : ['bca_va'],
          callbacks: { finish: input.finishUrl },
          expiry: { unit: 'minutes', duration: 60 },
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        throw new HttpError(502, 'Payment gateway sedang tidak dapat dihubungi. Coba lagi beberapa saat.', 'GATEWAY_ERROR');
      }
      const data = (await res.json()) as { token?: string; redirect_url?: string };
      if (!data.redirect_url) throw new HttpError(502, 'Payment gateway mengembalikan respons tidak valid.', 'GATEWAY_ERROR');
      return { providerRef: data.token, checkoutUrl: data.redirect_url };
    },
    parseWebhook(body) {
      if (!body || typeof body !== 'object') throw new HttpError(400, 'Notifikasi pembayaran tidak valid.', 'BAD_WEBHOOK');
      return normalise(body as MidtransNotification, true);
    },
    async fetchStatus(orderId) {
      const res = await doFetch(`${apiBase}/v2/${encodeURIComponent(orderId)}/status`, {
        headers: { Authorization: auth, Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as MidtransNotification;
      if (!data.transaction_status) return null;
      // Response came straight from Midtrans over TLS with our server key: no signature needed
      return normalise({ ...data, order_id: data.order_id ?? orderId }, false);
    },
  };
}
