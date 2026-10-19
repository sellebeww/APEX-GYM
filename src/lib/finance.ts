import type { Expense, Payment } from '../types/index.ts';
import { monthKeyOf } from '../../shared/time.ts';
import { toCsv } from '../../shared/csv.ts';

export { monthKeyOf };
export { rupiah, rupiahCompact } from '../../shared/money.ts';
export { csvCell } from '../../shared/csv.ts';

export const formatMonthId = (key: string, style: 'long' | 'short' = 'long') => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('id-ID', { month: style, year: 'numeric', timeZone: 'UTC' });
};

export interface PeriodSummary {
  /** Money received in the period (paid date), before refunds */
  grossRevenue: number;
  /** Money returned in the period (refund date) */
  refunds: number;
  /** grossRevenue - refunds */
  revenue: number;
  expenses: number;
  net: number;
  /** Net / revenue as a percentage, or null when there is no revenue to compare against */
  marginPct: number | null;
  bySource: Record<Payment['source'], number>;
  payingMembers: number;
  transactionCount: number;
  pendingCount: number;
  pendingAmount: number;
}

/** When the money actually came in: payment date for settled payments, order date for legacy rows. */
export const paidDateOf = (p: Payment) => p.paidAt ?? p.date;

/**
 * Cash-basis summary. Revenue is recognised when a payment is settled; a later refund is booked
 * in the month it happens. Pending, failed and expired orders never count as income.
 */
export function summarize(payments: Payment[], expenses: Expense[], month?: string): PeriodSummary {
  const inMonth = (iso: string | undefined) => !!iso && (!month || monthKeyOf(iso) === month);
  const received = payments.filter(p => (p.status === 'SUCCESS' || p.status === 'REFUNDED') && inMonth(paidDateOf(p)));
  const refunded = payments.filter(p => p.status === 'REFUNDED' && inMonth(p.refundedAt ?? p.date));
  const pending = payments.filter(p => p.status === 'PENDING' && inMonth(p.date));
  const grossRevenue = received.reduce((s, p) => s + p.amount, 0);
  const refunds = refunded.reduce((s, p) => s + p.amount, 0);
  const revenue = grossRevenue - refunds;
  const spent = expenses.filter(e => inMonth(e.date)).reduce((s, e) => s + e.amount, 0);
  const bySource: PeriodSummary['bySource'] = { MEMBERSHIP: 0, PT_PACKAGE: 0, DAILY_PASS: 0 };
  received.forEach(p => {
    bySource[p.source] += p.amount;
  });
  refunded.forEach(p => {
    bySource[p.source] -= p.amount;
  });
  return {
    grossRevenue,
    refunds,
    revenue,
    expenses: spent,
    net: revenue - spent,
    marginPct: revenue > 0 ? Math.round(((revenue - spent) / revenue) * 100) : null,
    bySource,
    payingMembers: new Set(received.filter(p => p.memberId).map(p => p.memberId)).size,
    transactionCount: received.length,
    pendingCount: pending.length,
    pendingAmount: pending.reduce((s, p) => s + p.amount, 0),
  };
}

/** The last `count` calendar months ending at `endKey` (inclusive), oldest first */
export function lastMonths(endKey: string, count: number): string[] {
  const [y, m] = endKey.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

export function previousMonth(key: string): string {
  return lastMonths(key, 2)[0];
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Human label for a margin; extreme losses read as "< -100%" instead of an absurd number. */
export function marginLabel(pct: number | null): string {
  if (pct === null) return 'Belum ada pemasukan';
  if (pct < -100) return 'Margin < −100% (beban melebihi pemasukan)';
  return `Margin ${pct}%`;
}
