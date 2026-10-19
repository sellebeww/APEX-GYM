import { describe, expect, it } from 'vitest';
import { csvCell, lastMonths, marginLabel, previousMonth, rupiahCompact, summarize } from '../finance';
import type { Expense, Payment } from '../../types';

const pay = (over: Partial<Payment>): Payment => ({
  id: 'p', invoiceNumber: 'INV', memberId: 'm1', memberName: 'M', amount: 100000, source: 'MEMBERSHIP',
  packageName: 'x', status: 'SUCCESS', method: 'QRIS', provider: 'SIMULATOR', date: '2026-10-05T10:00:00Z', ...over,
});
const exp = (over: Partial<Expense>): Expense => ({
  id: 'e', title: 't', amount: 40000, category: 'OTHER', categoryLabel: 'Lainnya', date: '2026-10-02', ...over,
});

describe('finance summaries', () => {
  it('never counts pending or failed orders as revenue', () => {
    const s = summarize([pay({}), pay({ status: 'PENDING', amount: 999 }), pay({ status: 'FAILED', amount: 777 })], [], '2026-10');
    expect(s.revenue).toBe(100000);
    expect(s.transactionCount).toBe(1);
    expect(s.pendingAmount).toBe(999);
  });

  it('books a refund in the month it happens (cash basis)', () => {
    const refunded = pay({ status: 'REFUNDED', amount: 888, paidAt: '2026-09-20T10:00:00Z', refundedAt: '2026-10-03T10:00:00Z' });
    const sep = summarize([refunded], [], '2026-09');
    const oct = summarize([refunded], [], '2026-10');
    expect(sep.revenue).toBe(888);
    expect(oct.grossRevenue).toBe(0);
    expect(oct.refunds).toBe(888);
    expect(oct.revenue).toBe(-888);
  });

  it('computes net, margin and per-source totals for a month', () => {
    const s = summarize(
      [pay({}), pay({ source: 'PT_PACKAGE', amount: 300000, memberId: 'm2' }), pay({ date: '2026-09-30T10:00:00Z', amount: 5 })],
      [exp({}), exp({ date: '2026-09-01', amount: 7 })],
      '2026-10'
    );
    expect(s.revenue).toBe(400000);
    expect(s.expenses).toBe(40000);
    expect(s.net).toBe(360000);
    expect(s.marginPct).toBe(90);
    expect(s.bySource.PT_PACKAGE).toBe(300000);
    expect(s.payingMembers).toBe(2);
  });

  it('has no margin when there is no revenue', () => {
    expect(summarize([], [exp({})], '2026-10').marginPct).toBeNull();
    expect(marginLabel(null)).toMatch(/Belum/);
    expect(marginLabel(-24135)).toMatch(/< −100%/);
  });

  it('builds month ranges across year boundaries', () => {
    expect(lastMonths('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(previousMonth('2026-01')).toBe('2025-12');
  });

  it('formats compact rupiah', () => {
    expect(rupiahCompact(1_250_000)).toBe('1,3 jt');
    expect(rupiahCompact(85_000)).toBe('85 rb');
  });
});

describe('csv safety', () => {
  it('escapes quotes and neutralises spreadsheet formulas', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe(`"'+1"`);
    expect(csvCell(42)).toBe('42');
    expect(csvCell(-5000)).toBe('-5000');
    expect(csvCell('-5000')).toBe(`"'-5000"`);
  });
});
