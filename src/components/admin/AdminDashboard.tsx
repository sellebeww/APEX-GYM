import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { QrCode, AlertTriangle, Wallet, Ticket, Wrench, CheckCircle2, ArrowRight } from 'lucide-react';
import { BarChart } from '../common/BarChart';
import { GymCrowdMeter } from '../common/GymCrowdMeter';
import { lastMonths, marginLabel, monthKeyOf, formatMonthId, previousMonth, rupiah, rupiahCompact, summarize } from '../../lib/finance';
import { toDateKey } from '../../lib/membership';

const tile = 'p-5 rounded-xl bg-surface border border-line';
const tileLabel = 'text-[10px] text-zinc-500 uppercase font-bold tracking-wider block';

export const AdminDashboard: React.FC = () => {
  const { memberProfiles, payments, expenses, feedbackTickets, gymEquipment, checkIns, setAdminTab } = useApp();

  const profiles = Object.values(memberProfiles);
  const active = profiles.filter(p => p.status === 'ACTIVE').length;
  const expiring = profiles.filter(p => p.status === 'EXPIRING_SOON').length;
  const expired = profiles.filter(p => p.status === 'EXPIRED').length;

  const thisMonth = monthKeyOf(toDateKey());
  const cur = summarize(payments, expenses, thisMonth);
  const prev = summarize(payments, expenses, previousMonth(thisMonth));
  const revenueDelta = prev.revenue > 0 ? Math.round(((cur.revenue - prev.revenue) / prev.revenue) * 100) : null;

  const months = lastMonths(thisMonth, 6);
  const series = useMemo(() => months.map(m => summarize(payments, expenses, m)), [payments, expenses]); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingPayments = payments.filter(p => p.status === 'PENDING');
  const openTickets = feedbackTickets.filter(t => t.status !== 'SELESAI');
  const equipmentAttention = gymEquipment.filter(e => e.status !== 'OPERATIONAL');

  // Check-ins per hour of day, from real turnstile logs
  const hourly = useMemo(() => {
    const counts = Array.from({ length: 17 }, () => 0); // 06:00..22:00
    checkIns
      .filter(c => c.status === 'GRANTED')
      .forEach(c => {
        const h = new Date(c.timestamp).getHours();
        if (h >= 6 && h <= 22) counts[h - 6] += 1;
      });
    return counts;
  }, [checkIns]);
  const totalGranted = hourly.reduce((a, b) => a + b, 0);
  const hourlyMax = Math.max(1, ...hourly);

  const actions = [
    { show: pendingPayments.length > 0, icon: Wallet, text: `${pendingPayments.length} pembayaran kasir menunggu konfirmasi`, tab: 'keuangan', cta: 'Konfirmasi' },
    { show: openTickets.length > 0, icon: Ticket, text: `${openTickets.length} tiket keluhan belum selesai`, tab: 'kepuasan', cta: 'Tangani' },
    { show: equipmentAttention.length > 0, icon: Wrench, text: `${equipmentAttention.length} alat perlu servis atau sedang dirawat`, tab: 'equipment', cta: 'Lihat alat' },
    { show: expiring > 0, icon: AlertTriangle, text: `${expiring} member akan habis dalam 7 hari`, tab: 'members', cta: 'Follow-up' },
  ].filter(a => a.show);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="bg-surface rounded-2xl border border-line p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.2em] block">Operasional APEX Gym</span>
          <h1 className="text-2xl font-extrabold uppercase text-white mt-0.5">Ikhtisar bisnis</h1>
          <p className="text-xs text-zinc-400 mt-1">Semua angka dihitung dari data transaksi, member, dan check-in di sistem.</p>
        </div>
        <button onClick={() => setAdminTab('checkin')} className="px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm transition-colors flex items-center justify-center gap-2 self-start sm:self-auto">
          <QrCode className="w-4 h-4" /> Buka scanner QR
        </button>
      </div>

      <section aria-label="Perlu tindakan" className="bg-surface rounded-2xl border border-line p-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-white mb-3">Perlu tindakan</h2>
        {actions.length === 0 ? (
          <p className="text-xs text-zinc-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Tidak ada yang menunggu. Semua beres.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {actions.map(a => {
              const Icon = a.icon;
              return (
                <li key={a.tab} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-3 text-zinc-200">
                    <Icon className="w-4 h-4 text-amber-400 shrink-0" /> {a.text}
                  </span>
                  <button onClick={() => setAdminTab(a.tab)} className="px-3 py-1.5 rounded-lg border border-line-strong hover:border-white text-white font-semibold inline-flex items-center gap-1 shrink-0 transition-colors">
                    {a.cta} <ArrowRight className="w-3 h-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-tabular">
        <div className={tile}>
          <span className={tileLabel}>Member aktif</span>
          <div className="text-3xl font-black text-white mt-1">
            {active}
            <span className="text-xs font-normal text-zinc-500 ml-1 font-sans">dari {profiles.length}</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-sans block mt-1">{expiring} segera habis · {expired} kedaluwarsa</span>
        </div>
        <div className={tile}>
          <span className={tileLabel}>Pemasukan {formatMonthId(thisMonth, 'short')}</span>
          <div className="text-xl font-black text-white mt-2">{rupiah(cur.revenue)}</div>
          <span className={`text-[10px] font-sans block mt-1 ${revenueDelta === null ? 'text-zinc-500' : revenueDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {revenueDelta === null ? 'Belum ada pembanding bulan lalu' : `${revenueDelta >= 0 ? '+' : ''}${revenueDelta}% vs bulan lalu`}
          </span>
        </div>
        <div className={tile}>
          <span className={tileLabel}>Pengeluaran {formatMonthId(thisMonth, 'short')}</span>
          <div className="text-xl font-black text-white mt-2">{rupiah(cur.expenses)}</div>
          <span className="text-[10px] text-zinc-500 font-sans block mt-1">Gaji, sewa & operasional</span>
        </div>
        <div className="p-5 rounded-xl bg-surface-2 border border-line-strong">
          <span className={tileLabel}>Laba bersih bulan ini</span>
          <div className={`text-xl font-black mt-2 ${cur.net < 0 ? 'text-rose-400' : 'text-white'}`}>{rupiah(cur.net)}</div>
          <span className="text-[10px] text-zinc-500 font-sans block mt-1">{marginLabel(cur.marginPct)}</span>
        </div>
      </div>

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <div className="pb-3 border-b border-line">
          <h2 className="text-sm font-bold text-white">Pemasukan vs pengeluaran, 6 bulan terakhir</h2>
          <p className="text-[11px] text-zinc-400">Hanya pembayaran berstatus lunas yang dihitung sebagai pemasukan.</p>
        </div>
        <BarChart
          ariaLabel="Grafik pemasukan dan pengeluaran per bulan"
          categories={months.map(m => formatMonthId(m, 'short').split(' ')[0])}
          series={[
            { key: 'rev', label: 'Pemasukan', className: 'fill-white' },
            { key: 'exp', label: 'Pengeluaran', className: 'fill-zinc-600' },
          ]}
          values={[series.map(s => s.revenue), series.map(s => s.expenses)]}
          format={rupiahCompact}
        />
      </section>

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">Check-in per jam</h2>
            <p className="text-[11px] text-zinc-400">Dari log turnstile. Gunakan untuk menempatkan staf di lantai gym.</p>
          </div>
          <span className="text-xs text-zinc-500 font-mono shrink-0">{totalGranted} check-in</span>
        </div>
        {totalGranted === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-6">Belum ada check-in tercatat.</p>
        ) : (
          <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(17, minmax(0, 1fr))' }} role="img" aria-label="Distribusi check-in per jam">
            {hourly.map((c, i) => (
              <div key={i} className="flex flex-col items-center gap-1" title={`${String(i + 6).padStart(2, '0')}:00, ${c} check-in`}>
                <div className="w-full h-24 bg-black/40 rounded flex flex-col justify-end border border-line overflow-hidden">
                  <div className="w-full bg-white" style={{ height: `${(c / hourlyMax) * 100}%` }} />
                </div>
                <span className="text-[9px] text-zinc-500 font-mono">{String(i + 6).padStart(2, '0')}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <GymCrowdMeter showAdminControls />
    </div>
  );
};
