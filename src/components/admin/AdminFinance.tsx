import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { Expense, Payment } from '../../types';
import { Plus, Download, Check, Clock } from 'lucide-react';
import { Modal } from '../common/Modal';
import { BarChart } from '../common/BarChart';
import { downloadCsv, formatMonthId, lastMonths, marginLabel, monthKeyOf, previousMonth, rupiah, rupiahCompact, summarize } from '../../lib/finance';
import { formatDateId, toDateKey } from '../../lib/membership';

const CATEGORY_LABEL: Record<Expense['category'], string> = {
  SALARY: 'Gaji & komisi staf',
  RENT: 'Sewa gedung',
  ELECTRICITY: 'Listrik & utilitas',
  EQUIPMENT_MAINTENANCE: 'Perawatan alat',
  MARKETING: 'Pemasaran & iklan',
  OTHER: 'Lainnya',
};
const METHOD_LABEL: Record<Payment['method'], string> = { QRIS: 'QRIS', TRANSFER_BCA: 'Virtual Account', MANUAL_CASH: 'Tunai' };
const SOURCE_LABEL: Record<Payment['source'], string> = { MEMBERSHIP: 'Membership', PT_PACKAGE: 'Personal training', DAILY_PASS: 'Day pass' };

const tile = 'p-5 rounded-xl bg-surface border border-line';
const tileLabel = 'text-[10px] text-zinc-500 uppercase font-bold tracking-wider block';
const field = 'w-full bg-surface-2 border border-line-strong rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white';

export const AdminFinance: React.FC = () => {
  const { payments, expenses, addExpense, confirmManualPayment, memberProfiles, membershipPlans, showToast } = useApp();

  const thisMonth = monthKeyOf(toDateKey());
  // Months that actually have data, plus the current month
  const monthOptions = useMemo(() => {
    const keys = new Set<string>([thisMonth]);
    payments.forEach(p => keys.add(monthKeyOf(p.date)));
    expenses.forEach(e => keys.add(monthKeyOf(e.date)));
    return [...keys].toSorted().toReversed();
  }, [payments, expenses, thisMonth]);

  const [period, setPeriod] = useState<string>(thisMonth); // a YYYY-MM key, or 'ALL'
  const month = period === 'ALL' ? undefined : period;
  const [statusFilter, setStatusFilter] = useState<'ALL' | Payment['status']>('ALL');

  const [showAdd, setShowAdd] = useState(false);
  const [exp, setExp] = useState({ title: '', amount: '', category: 'EQUIPMENT_MAINTENANCE' as Expense['category'], date: toDateKey() });
  const [expError, setExpError] = useState('');

  const cur = summarize(payments, expenses, month);
  const prev = month ? summarize(payments, expenses, previousMonth(month)) : null;
  const revenueDelta = prev && prev.revenue > 0 ? Math.round(((cur.revenue - prev.revenue) / prev.revenue) * 100) : null;
  const arpu = cur.payingMembers > 0 ? cur.revenue / cur.payingMembers : 0;

  // MRR: monthly value of memberships that are currently valid (price spread over the plan's months)
  const mrr = Object.values(memberProfiles)
    .filter(p => p.status !== 'EXPIRED')
    .reduce((sum, p) => {
      const plan = membershipPlans.find(x => x.id === p.planId);
      if (!plan || plan.durationDays < 30) return sum;
      return sum + plan.price / Math.max(1, Math.round(plan.durationDays / 30.4));
    }, 0);

  const chartMonths = lastMonths(month ?? thisMonth, 6);
  const chart = chartMonths.map(m => summarize(payments, expenses, m));

  const pending = payments.filter(p => p.status === 'PENDING');
  const periodPayments = useMemo(
    () =>
      payments
        .filter(p => (!month || monthKeyOf(p.date) === month) && (statusFilter === 'ALL' || p.status === statusFilter))
        .toSorted((a, b) => b.date.localeCompare(a.date)),
    [payments, month, statusFilter]
  );
  const periodExpenses = useMemo(
    () => expenses.filter(e => !month || monthKeyOf(e.date) === month).toSorted((a, b) => b.date.localeCompare(a.date)),
    [expenses, month]
  );

  const submitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(exp.amount, 10);
    if (exp.title.trim().length < 3) return setExpError('Keterangan minimal 3 karakter.');
    if (!(amount > 0)) return setExpError('Nominal harus lebih dari 0.');
    if (!exp.date || exp.date > toDateKey()) return setExpError('Tanggal tidak boleh di masa depan.');
    const res = await addExpense({ title: exp.title.trim(), amount, category: exp.category, date: exp.date });
    if (!res.success) return setExpError(res.message);
    showToast('Pengeluaran dicatat.', 'success');
    setShowAdd(false);
    setExp({ title: '', amount: '', category: 'EQUIPMENT_MAINTENANCE', date: toDateKey() });
    setExpError('');
  };

  const exportCsv = () => {
    downloadCsv(`laporan-keuangan-apex-${period === 'ALL' ? 'semua' : period}.csv`, [
      ['Invoice', 'Tanggal', 'Member', 'Paket', 'Sumber', 'Metode', 'Jumlah (Rp)', 'Status'],
      ...periodPayments.map(p => [p.invoiceNumber, p.date.slice(0, 10), p.memberName, p.packageName, SOURCE_LABEL[p.source], METHOD_LABEL[p.method], p.amount, p.status]),
    ]);
    showToast(`${periodPayments.length} transaksi diekspor.`, 'success');
  };

  const sourceRows = (Object.keys(cur.bySource) as Payment['source'][]).map(k => ({ key: k, label: SOURCE_LABEL[k], value: cur.bySource[k] }));

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold uppercase text-white">Keuangan & laba</h1>
          <p className="text-xs text-zinc-400 mt-1">Pemasukan dari pembayaran lunas dikurangi pengeluaran operasional yang tercatat.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="fin-period" className="sr-only">Periode</label>
          <select id="fin-period" value={period} onChange={e => setPeriod(e.target.value)} className="bg-surface border border-line-strong rounded-xl px-3 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-white">
            <option value="ALL">Semua periode</option>
            {monthOptions.map(m => (
              <option key={m} value={m}>{formatMonthId(m)}</option>
            ))}
          </select>
          <button onClick={() => setShowAdd(true)} className="px-4 py-2.5 rounded-xl bg-surface-2 border border-line-strong hover:border-white text-xs font-bold text-white transition-colors flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Catat pengeluaran
          </button>
          <button onClick={exportCsv} className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-xs font-bold text-black transition-colors flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Ekspor CSV
          </button>
        </div>
      </div>

      {pending.length > 0 && (
        <section aria-label="Pembayaran menunggu konfirmasi" className="bg-amber-950/20 border border-amber-800/50 rounded-2xl p-6 space-y-3">
          <h2 className="text-sm font-bold text-amber-200 flex items-center gap-2">
            <Clock className="w-4 h-4" /> {pending.length} pembayaran kasir menunggu konfirmasi
          </h2>
          <ul className="divide-y divide-amber-900/40">
            {pending.map(p => (
              <li key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-white">{p.memberName}</span>
                  <span className="text-zinc-400"> · {p.packageName} · {p.invoiceNumber}</span>
                  <div className="text-[11px] text-zinc-500">{formatDateId(p.date.slice(0, 10))}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-white">{rupiah(p.amount)}</span>
                  <button
                    onClick={() => {
                      confirmManualPayment(p.id);
                      showToast(`Pembayaran ${p.memberName} dikonfirmasi dan paket diaktifkan.`, 'success');
                    }}
                    className="px-3.5 py-2 rounded-lg bg-white text-black font-bold hover:bg-zinc-200 transition-colors inline-flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" /> Konfirmasi lunas
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-tabular">
        <div className={tile}>
          <span className={tileLabel}>Pemasukan</span>
          <div className="text-xl font-black text-white mt-2">{rupiah(cur.revenue)}</div>
          <span className={`text-[10px] font-sans block mt-1 ${revenueDelta === null ? 'text-zinc-500' : revenueDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {month ? (revenueDelta === null ? 'Belum ada pembanding bulan lalu' : `${revenueDelta >= 0 ? '+' : ''}${revenueDelta}% vs bulan lalu`) : `${cur.transactionCount} transaksi lunas`}
          </span>
        </div>
        <div className={tile}>
          <span className={tileLabel}>Pengeluaran</span>
          <div className="text-xl font-black text-white mt-2">{rupiah(cur.expenses)}</div>
          <span className="text-[10px] text-zinc-500 font-sans block mt-1">{periodExpenses.length} catatan</span>
        </div>
        <div className="p-5 rounded-xl bg-surface-2 border border-line-strong">
          <span className={tileLabel}>Laba bersih</span>
          <div className={`text-xl font-black mt-2 ${cur.net < 0 ? 'text-rose-400' : 'text-white'}`}>{rupiah(cur.net)}</div>
          <span className="text-[10px] text-zinc-500 font-sans block mt-1">{marginLabel(cur.marginPct)}</span>
        </div>
        <div className={tile}>
          <span className={tileLabel}>ARPU · MRR</span>
          <div className="text-xl font-black text-white mt-2">{rupiah(arpu)}</div>
          <span className="text-[10px] text-zinc-500 font-sans block mt-1">per member berbayar · MRR est. {rupiah(mrr)}</span>
        </div>
      </div>

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <div className="pb-3 border-b border-line">
          <h2 className="text-sm font-bold text-white">Tren 6 bulan{month ? ` s/d ${formatMonthId(month)}` : ''}</h2>
        </div>
        <BarChart
          ariaLabel="Grafik pemasukan dan pengeluaran per bulan"
          categories={chartMonths.map(m => formatMonthId(m, 'short').split(' ')[0])}
          series={[
            { key: 'rev', label: 'Pemasukan', className: 'fill-white' },
            { key: 'exp', label: 'Pengeluaran', className: 'fill-zinc-600' },
          ]}
          values={[chart.map(s => s.revenue), chart.map(s => s.expenses)]}
          format={rupiahCompact}
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sourceRows.map(r => {
          const pct = cur.revenue > 0 ? Math.round((r.value / cur.revenue) * 100) : 0;
          return (
            <div key={r.key} className={`${tile} space-y-2`}>
              <span className="text-xs font-bold text-white block">{r.label}</span>
              <div className="text-xl font-bold font-tabular text-white">{rupiah(r.value)}</div>
              <div role="progressbar" aria-label={`${r.label} ${pct}% dari pemasukan`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-white h-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-zinc-500 font-mono block">{pct}% dari pemasukan</span>
            </div>
          );
        })}
      </section>

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
          <h2 className="text-sm font-bold text-white">Log transaksi <span className="text-zinc-500 font-mono text-xs">({periodPayments.length})</span></h2>
          <div className="flex items-center gap-1.5" role="group" aria-label="Filter status">
            {(['ALL', 'SUCCESS', 'PENDING', 'REFUNDED'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                aria-pressed={statusFilter === s}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${statusFilter === s ? 'bg-white text-black border-white' : 'bg-surface-2 border-line text-zinc-400 hover:text-white'}`}
              >
                {s === 'ALL' ? 'Semua' : s === 'SUCCESS' ? 'Lunas' : s === 'PENDING' ? 'Menunggu' : 'Refund'}
              </button>
            ))}
          </div>
        </div>
        {periodPayments.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">Tidak ada transaksi pada filter ini.</p>
        ) : (
          <ul className="divide-y divide-line">
            {periodPayments.map(p => (
              <li key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm">{p.memberName}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                        p.status === 'SUCCESS' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : p.status === 'PENDING' ? 'bg-amber-950 text-amber-300 border-amber-800' : 'bg-rose-950 text-rose-300 border-rose-800'
                      }`}
                    >
                      {p.status === 'SUCCESS' ? 'LUNAS' : p.status === 'PENDING' ? 'MENUNGGU' : 'REFUND'}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    <span className="font-mono">{p.invoiceNumber}</span> · {p.packageName} · {METHOD_LABEL[p.method]} · {formatDateId(p.date.slice(0, 10), 'short')}
                  </div>
                </div>
                <span className="font-black font-tabular text-sm text-white">{rupiah(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <h2 className="text-sm font-bold text-white">Pengeluaran operasional</h2>
          <span className="text-xs text-zinc-300 font-mono">{rupiah(cur.expenses)}</span>
        </div>
        {periodExpenses.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">Belum ada pengeluaran pada periode ini.</p>
        ) : (
          <ul className="divide-y divide-line">
            {periodExpenses.map(e => (
              <li key={e.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-white">{e.title}</span>
                  <div className="text-[11px] text-zinc-400 font-mono">{e.categoryLabel} · {formatDateId(e.date, 'short')}</div>
                </div>
                <span className="font-mono font-bold text-zinc-200">− {rupiah(e.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} label="Catat pengeluaran baru" maxWidth="max-w-md">
        <form onSubmit={submitExpense} className="p-6 space-y-4 text-xs" noValidate>
          <h2 className="text-base font-bold text-white pr-8">Catat pengeluaran</h2>
          <div>
            <label htmlFor="exp-title" className="block text-zinc-400 font-semibold mb-1.5">Keterangan</label>
            <input id="exp-title" type="text" maxLength={80} placeholder="Mis. pelumas treadmill atau tagihan listrik" value={exp.title} onChange={e => setExp({ ...exp, title: e.target.value })} className={field} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="exp-cat" className="block text-zinc-400 font-semibold mb-1.5">Kategori</label>
              <select id="exp-cat" value={exp.category} onChange={e => setExp({ ...exp, category: e.target.value as Expense['category'] })} className={field}>
                {(Object.keys(CATEGORY_LABEL) as Expense['category'][]).map(k => (
                  <option key={k} value={k}>{CATEGORY_LABEL[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="exp-date" className="block text-zinc-400 font-semibold mb-1.5">Tanggal</label>
              <input id="exp-date" type="date" max={toDateKey()} value={exp.date} onChange={e => setExp({ ...exp, date: e.target.value })} className={field} />
            </div>
          </div>
          <div>
            <label htmlFor="exp-amt" className="block text-zinc-400 font-semibold mb-1.5">Nominal (Rp)</label>
            <input id="exp-amt" type="number" inputMode="numeric" min="1" step="1000" placeholder="1500000" value={exp.amount} onChange={e => setExp({ ...exp, amount: e.target.value })} className={`${field} font-mono`} />
          </div>
          {expError && <p role="alert" className="text-rose-400">{expError}</p>}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2.5 rounded-lg border border-line-strong text-zinc-300 hover:text-white">Batal</button>
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-white text-black font-bold hover:bg-zinc-200">Simpan</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
