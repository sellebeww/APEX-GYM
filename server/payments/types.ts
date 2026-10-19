export type GatewayStatus = 'SUCCESS' | 'PENDING' | 'FAILED' | 'EXPIRED' | 'REFUNDED' | 'IGNORED';

export interface CreateChargeInput {
  orderId: string;
  amount: number;
  method: 'QRIS' | 'TRANSFER_BCA';
  itemId: string;
  itemName: string;
  customer: { name: string; email: string; phone: string };
  finishUrl: string;
}

export interface ChargeResult {
  providerRef?: string;
  checkoutUrl?: string;
}

/** A verified, provider-neutral payment notification. */
export interface GatewayNotification {
  orderId: string;
  status: GatewayStatus;
  /** Integer rupiah reported by the provider; must equal the stored amount */
  grossAmount: number;
  /** Unique per (transaction, status) for idempotent processing */
  eventKey: string;
  providerRef?: string;
  raw: unknown;
}

export interface PaymentGateway {
  name: 'SIMULATOR' | 'MIDTRANS';
  createCharge(input: CreateChargeInput): Promise<ChargeResult>;
  /** Verifies authenticity (signature) and normalises a webhook body. Throws on forgery. */
  parseWebhook(body: unknown): GatewayNotification;
  /** Asks the provider directly for the current status (defence in depth against forged webhooks). */
  fetchStatus(orderId: string): Promise<GatewayNotification | null>;
}
