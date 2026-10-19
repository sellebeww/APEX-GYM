import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Check,
  QrCode,
  CreditCard,
  Building2,
  Clock,
  FileText,
  Printer,
  X,
  Loader2,
  Receipt,
  ExternalLink,
} from 'lucide-react';
import type { Payment } from '../../types';
import { BrandLogo } from '../common/BrandLogo';
import { Modal } from '../common/Modal';
import { GYM_LEGAL_NAME } from '../../config/gym';
import { formatDateId, formatDateTimeId, getDaysRemaining } from '../../lib/membership';

type PayMethod = 'QRIS' | 'TRANSFER_BCA' | 'MANUAL_CASH';

const METHODS: { id: PayMethod; label: string; hint: string; icon: typeof QrCode }[] = [
  { id: 'QRIS', label: 'QRIS Instan', hint: 'Semua bank & e-wallet', icon: QrCode },
  { id: 'TRANSFER_BCA', label: 'Virtual Account', hint: 'BCA / Mandiri otomatis', icon: Building2 },
  { id: 'MANUAL_CASH', label: 'Bayar di Kasir', hint: 'Aktif setelah dikonfirmasi admin', icon: CreditCard },
];

const METHOD_LABEL: Record<PayMethod, string> = {
  QRIS: 'QRIS',
  TRANSFER_BCA: 'Virtual Account',
  MANUAL_CASH: 'Tunai di kasir',
};

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

export const MemberMembership: React.FC = () => {
  const {
    currentUser,
    memberProfiles,
    membershipPlans,
    ptPackages,
    createOrder,
    cancelOrder,
    refreshPaymentStatus,
    simulatePayment,
    payments,
    setMemberTab,
    checkoutIntent,
    setCheckoutIntent,
    showToast,
    config,
  } = useApp();

  const profile = currentUser ? memberProfiles[currentUser.id] : null;
  const isExpired = !profile || profile.status === 'EXPIRED';
  const daysLeft = getDaysRemaining(profile?.endDate);

  const defaultPlan = membershipPlans.find(p => p.isPopular)?.id ?? membershipPlans[0]?.id ?? '';
  const defaultPt = ptPackages.find(p => p.isPopular)?.id ?? ptPackages[0]?.id ?? '';
  const [selectedPlanId, setSelectedPlanId] = useState<string>(defaultPlan);
  const [selectedPtId, setSelectedPtId] = useState<string>(defaultPt);
  const [payMethod, setPayMethod] = useState<PayMethod>('QRIS');
  const [activeTab, setActiveTab] = useState<'membership' | 'pt' | 'history'>('membership');
  const [resultId, setResultId] = useState<string | null>(null);
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);

  // Honour a plan / PT package chosen on the public pricing section (consumed once)
  if (checkoutIntent) {
    if (checkoutIntent.type === 'plan' && membershipPlans.some(p => p.id === checkoutIntent.id)) {
      setSelectedPlanId(checkoutIntent.id);
      setActiveTab('membership');
    } else if (checkoutIntent.type === 'pt' && ptPackages.some(p => p.id === checkoutIntent.id)) {
      setSelectedPtId(checkoutIntent.id);
      setActiveTab('pt');
    }
    setCheckoutIntent(null);
  }

  const memberPayments = payments.filter(p => p.memberId === currentUser?.id);
  const result = resultId ? memberPayments.find(p => p.id === resultId) ?? null : null;
  const viewInvoice = viewInvoiceId ? memberPayments.find(p => p.id === viewInvoiceId) ?? null : null;
  const selectedPlan = membershipPlans.find(p => p.id === selectedPlanId);
  const selectedPt = ptPackages.find(p => p.id === selectedPtId);
  const isSimulator = config.paymentProvider === 'simulator';

  const pay = async (kind: 'plan' | 'pt') => {
    if (!currentUser || isPaying) return;
    setIsPaying(true);
    const res = await createOrder(kind === 'plan' ? 'MEMBERSHIP' : 'PT_PACKAGE', kind === 'plan' ? selectedPlanId : selectedPtId, payMethod);
    setIsPaying(false);
    if (!res.success || !res.data) return showToast(res.message, 'error');
    setResultId(res.data.paymentId);
    showToast(
      payMethod === 'MANUAL_CASH' ? 'Pesanan dibuat. Selesaikan pembayaran di kasir gym.' : 'Pesanan dibuat. Selesaikan pembayaran untuk mengaktifkan paket.',
      'success'
    );
  };

  const act = async (paymentId: string, fn: () => Promise<{ success: boolean; message: string }>) => {
    setBusyPaymentId(paymentId);
    const res = await fn();
    setBusyPaymentId(null);
    showToast(res.message, res.success ? 'success' : 'error');
  };

  const statusChip = (p: Payment) => {
    const map: Record<Payment['status'], { label: string; cls: string }> = {
      SUCCESS: { label: 'LUNAS', cls: 'bg-emerald-950 text-emerald-300' },
      PENDING: { label: p.method === 'MANUAL_CASH' ? 'MENUNGGU KASIR' : 'MENUNGGU PEMBAYARAN', cls: 'bg-amber-950 text-amber-300' },
      FAILED: { label: 'DIBATALKAN', cls: 'bg-zinc-800 text-zinc-300' },
      EXPIRED: { label: 'KEDALUWARSA', cls: 'bg-zinc-800 text-zinc-300' },
      REFUNDED: { label: 'REFUND', cls: 'bg-rose-950 text-rose-300' },
    };
    const c = map[p.status];
    return <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${c.cls}`}>{c.label}</span>;
  };

  /** Next steps for an unpaid order: pay at the gateway, check status, (dev) simulate, or cancel. */
  const pendingActions = (p: Payment) => {
    if (p.status !== 'PENDING') return null;
    const busy = busyPaymentId === p.id;
    const btn = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50';
    return (
      <div className="flex flex-wrap items-center gap-2">
        {p.checkoutUrl && (
          <a href={p.checkoutUrl} rel="noopener noreferrer" className={`${btn} bg-white text-black hover:bg-zinc-200 inline-flex items-center gap-1.5`}>
            <ExternalLink className="w-3.5 h-3.5" /> Bayar sekarang
          </a>
        )}
        {p.provider === 'MIDTRANS' && (
          <button disabled={busy} onClick={() => void act(p.id, () => refreshPaymentStatus(p.id))} className={`${btn} border border-line-strong text-white hover:border-white`}>
            Cek status
          </button>
        )}
        {p.provider === 'SIMULATOR' && isSimulator && config.demoMode && (
          <>
            <button disabled={busy} onClick={() => void act(p.id, () => simulatePayment(p.id, 'SUCCESS'))} className={`${btn} bg-emerald-500 text-black hover:bg-emerald-400`}>
              Simulasikan berhasil
            </button>
            <button disabled={busy} onClick={() => void act(p.id, () => simulatePayment(p.id, 'FAILED'))} className={`${btn} border border-line-strong text-zinc-300 hover:border-white`}>
              Simulasikan gagal
            </button>
          </>
        )}
        <button disabled={busy} onClick={() => void act(p.id, () => cancelOrder(p.id))} className={`${btn} text-zinc-400 hover:text-white`}>
          Batalkan pesanan
        </button>
      </div>
    );
  };

  const tabBtn = (id: typeof activeTab, label: string) => (
    <button
      key={id}
      role="tab"
      aria-selected={activeTab === id}
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
        activeTab === id ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  );

  const methodPicker = (
    <fieldset>
      <legend className="text-sm font-bold text-white mb-3">Metode pembayaran</legend>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {METHODS.map(m => {
          const Icon = m.icon;
          const selected = payMethod === m.id;
          return (
            <label
              key={m.id}
              className={`p-4 rounded-xl border cursor-pointer flex items-center gap-3 transition-colors focus-within:outline-2 focus-within:outline-white ${
                selected ? 'bg-surface-2 border-white' : 'bg-surface-2 border-line hover:border-line-strong'
              }`}
            >
              <input
                type="radio"
                name="pay-method"
                value={m.id}
                checked={selected}
                onChange={() => setPayMethod(m.id)}
                className="sr-only"
              />
              <Icon className="w-5 h-5 text-zinc-300 shrink-0" />
              <div>
                <div className="text-xs font-bold text-white">{m.label}</div>
                <div className="text-[10px] text-zinc-400">{m.hint}</div>
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );

  const payBtnLabel = (kind: 'plan' | 'pt') =>
    isPaying ? (
      <>
        <Loader2 className="w-4 h-4 animate-spin" />
        Memproses…
      </>
    ) : payMethod === 'MANUAL_CASH' ? (
      kind === 'plan' ? 'Buat Pesanan (Bayar di Kasir)' : 'Buat Pesanan PT (Bayar di Kasir)'
    ) : kind === 'plan' ? (
      `Bayar ${selectedPlan ? rupiah(selectedPlan.price) : ''}${isSimulator ? ' (simulasi)' : ''}`
    ) : (
      `Bayar ${selectedPt ? rupiah(selectedPt.price) : ''}${isSimulator ? ' (simulasi)' : ''}`
    );

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Subscription status */}
      <div className="bg-surface rounded-2xl border border-line p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.2em]">Status langganan</span>
          <h2 className="text-2xl font-extrabold text-white mt-1">{profile?.planName || 'Belum ada paket'}</h2>
          <p className="text-xs text-zinc-400 mt-1">
            {isExpired ? 'Berakhir pada' : 'Berlaku hingga'}{' '}
            <strong className="text-zinc-200 font-mono">{formatDateId(profile?.endDate)}</strong>
            {!isExpired && <span> · {daysLeft} hari lagi</span>}
          </p>
        </div>
        <button
          onClick={() => setMemberTab('qr')}
          className="px-4 py-2.5 rounded-xl bg-surface-2 border border-line-strong hover:border-white text-xs font-bold text-white transition-colors flex items-center gap-2 self-start md:self-auto"
        >
          <QrCode className="w-4 h-4" />
          Buka QR Masuk
        </button>
      </div>

      {/* Tabs */}
      <div role="tablist" className="flex items-center gap-2 border-b border-line pb-2 overflow-x-auto no-scrollbar">
        {tabBtn('membership', 'Paket Membership')}
        {tabBtn('pt', 'Paket Personal Training')}
        {tabBtn('history', `Riwayat & Invoice (${memberPayments.length})`)}
      </div>

      {/* Result of the latest order (live status from the server) */}
      {result && (
        <div
          role="status"
          className={`p-5 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
            result.status === 'SUCCESS' ? 'bg-emerald-950/30 border-emerald-700/60' : result.status === 'PENDING' ? 'bg-amber-950/30 border-amber-700/60' : 'bg-surface border-line-strong'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                result.status === 'SUCCESS' ? 'bg-emerald-500 text-black' : result.status === 'PENDING' ? 'bg-amber-500 text-black' : 'bg-zinc-700 text-white'
              }`}
            >
              {result.status === 'SUCCESS' ? <Check className="w-5 h-5 stroke-[3]" /> : result.status === 'PENDING' ? <Clock className="w-5 h-5" /> : <X className="w-5 h-5" />}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-bold text-white">
                {result.status === 'SUCCESS'
                  ? 'Pembayaran lunas. Paket Anda sudah aktif.'
                  : result.status === 'PENDING'
                  ? result.method === 'MANUAL_CASH'
                    ? 'Pesanan dibuat, bayar di kasir gym'
                    : 'Pesanan dibuat, menunggu pembayaran'
                  : 'Pesanan tidak dilanjutkan'}
              </div>
              <div className="text-xs text-zinc-300">
                {result.invoiceNumber} · {result.packageName} · {rupiah(result.amount)} · {METHOD_LABEL[result.method]}
                {result.status === 'PENDING' && ' · Paket aktif otomatis setelah pembayaran terkonfirmasi'}
              </div>
              {pendingActions(result)}
            </div>
          </div>
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={() => setViewInvoiceId(result.id)}
              className="px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              {result.status === 'SUCCESS' ? 'Lihat invoice' : 'Lihat tagihan'}
            </button>
            <button onClick={() => setResultId(null)} aria-label="Tutup notifikasi" className="p-1.5 text-zinc-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Membership plans */}
      {activeTab === 'membership' && (
        <div role="tabpanel" className="space-y-6">
          <div role="radiogroup" aria-label="Pilih paket membership" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {membershipPlans.map(plan => {
              const isSelected = selectedPlanId === plan.id;
              const perMonth = plan.durationDays >= 30 ? Math.round(plan.price / Math.max(1, Math.round(plan.durationDays / 30.4))) : null;
              return (
                <button
                  key={plan.id}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`text-left p-4 rounded-xl border transition-colors flex flex-col justify-between ${
                    isSelected ? 'bg-surface-2 border-white ring-1 ring-white' : 'bg-surface border-line hover:border-line-strong'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-bold text-xs text-white">{plan.name}</span>
                      {plan.isPopular && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-white text-black shrink-0">POPULER</span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400 mb-3">{plan.periodLabel}</div>
                    <div className="text-lg font-black font-tabular text-white">{rupiah(plan.price)}</div>
                    <div className="text-[10px] font-mono text-zinc-500 mb-4 min-h-3.5">
                      {perMonth ? `≈ ${rupiah(perMonth)} / bulan` : ''}
                    </div>
                  </div>
                  <div
                    className={`w-full py-1.5 text-center text-xs font-bold rounded-lg ${
                      isSelected ? 'bg-white text-black' : 'bg-surface-2 text-zinc-300 border border-line'
                    }`}
                  >
                    {isSelected ? 'Terpilih' : 'Pilih'}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="bg-surface rounded-2xl border border-line p-6 space-y-6">
            {methodPicker}
            <div className="pt-5 border-t border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="text-xs text-zinc-400 max-w-md">
                Masa aktif baru{' '}
                <strong className="text-white">
                  {isExpired ? 'dihitung mulai hari ini' : 'ditambahkan setelah tanggal berakhir yang sedang berjalan'}
                </strong>
                {selectedPlan && <> selama {selectedPlan.durationDays} hari.</>}
              </div>
              <button
                onClick={() => void pay('plan')}
                disabled={isPaying || !selectedPlan}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {payBtnLabel('plan')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PT packages */}
      {activeTab === 'pt' && (
        <div role="tabpanel" className="space-y-6">
          <div role="radiogroup" aria-label="Pilih paket personal training" className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {ptPackages.map(pkg => {
              const isSelected = selectedPtId === pkg.id;
              return (
                <button
                  key={pkg.id}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedPtId(pkg.id)}
                  className={`text-left p-5 rounded-2xl border transition-colors flex flex-col justify-between ${
                    isSelected ? 'bg-surface-2 border-white ring-1 ring-white' : 'bg-surface border-line hover:border-line-strong'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="font-bold text-sm text-white">{pkg.name}</span>
                      {pkg.isPopular && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-white text-black shrink-0">POPULER</span>
                      )}
                    </div>
                    <div className="text-2xl font-black font-tabular text-white mb-1">{rupiah(pkg.price)}</div>
                    <div className="text-xs font-mono text-zinc-400 mb-3">{rupiah(pkg.pricePerSession)} / sesi</div>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-6">{pkg.description}</p>
                  </div>
                  <div
                    className={`w-full py-2 text-center text-xs font-bold rounded-lg ${
                      isSelected ? 'bg-white text-black' : 'bg-surface-2 text-zinc-300 border border-line'
                    }`}
                  >
                    {isSelected ? 'Paket terpilih' : 'Pilih paket ini'}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="bg-surface rounded-2xl border border-line p-6 space-y-6">
            {methodPicker}
            <div className="pt-5 border-t border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-white block">Top-up sesi personal training</span>
                <span className="text-xs text-zinc-400">
                  Saldo saat ini: <strong className="text-white">{profile?.ptSessionsRemaining ?? 0} sesi</strong>. Sesi baru langsung masuk
                  setelah pembayaran lunas.
                </span>
              </div>
              <button
                onClick={() => void pay('pt')}
                disabled={isPaying || !selectedPt}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm transition-colors shrink-0 inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {payBtnLabel('pt')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {activeTab === 'history' && (
        <div role="tabpanel" className="bg-surface rounded-2xl border border-line p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
            <h3 className="text-sm font-bold text-white">Riwayat transaksi & bukti pembayaran</h3>
            <span className="text-xs text-zinc-400">{memberPayments.length} transaksi</span>
          </div>

          {memberPayments.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-zinc-400 mb-4">Belum ada transaksi.</p>
              <button
                onClick={() => setActiveTab('membership')}
                className="px-5 py-2.5 rounded-lg bg-white text-black text-xs font-bold hover:bg-zinc-200 transition-colors"
              >
                Pilih Paket Membership
              </button>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {memberPayments.map(p => (
                <div key={p.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-zinc-400 text-[11px]">{p.invoiceNumber}</span>
                      {statusChip(p)}
                    </div>
                    <div className="font-bold text-white text-sm mt-0.5">{p.packageName}</div>
                    <div className="text-[11px] text-zinc-400">
                      {formatDateTimeId(p.date)} WIB · {METHOD_LABEL[p.method]}
                    </div>
                    <div className="mt-2">{pendingActions(p)}</div>
                  </div>
                  <div className="flex items-center gap-4 self-end sm:self-auto">
                    <div className="text-right font-tabular">
                      <div className="font-black text-white text-sm">{rupiah(p.amount)}</div>
                      <div className="text-[10px] text-zinc-500">{p.source === 'PT_PACKAGE' ? 'Personal Training' : p.source === 'DAILY_PASS' ? 'Day Pass' : 'Membership'}</div>
                    </div>
                    <button
                      onClick={() => setViewInvoiceId(p.id)}
                      aria-label={`Lihat invoice ${p.invoiceNumber}`}
                      className="p-2 rounded-lg bg-surface-2 border border-line hover:border-line-strong text-zinc-300 hover:text-white transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invoice */}
      <Modal isOpen={!!viewInvoice} onClose={() => setViewInvoiceId(null)} label="Invoice pembayaran" hideClose>
        {viewInvoice && (
          <div className="p-6 sm:p-8 space-y-6 print-area">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <BrandLogo variant="horizontal" size="sm" subtitleText={viewInvoice.status === 'SUCCESS' || viewInvoice.status === 'REFUNDED' ? 'INVOICE' : 'TAGIHAN'} />
              <button
                onClick={() => setViewInvoiceId(null)}
                aria-label="Tutup invoice"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors print:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs text-zinc-300">
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase font-bold tracking-wider">Nomor invoice</span>
                <span className="font-mono text-white font-bold">{viewInvoice.invoiceNumber}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase font-bold tracking-wider">{viewInvoice.paidAt ? 'Tanggal lunas' : 'Tanggal pesanan'}</span>
                <span>{formatDateTimeId(viewInvoice.paidAt ?? viewInvoice.date)} WIB</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase font-bold tracking-wider">Nama member</span>
                <span className="text-white font-bold">{viewInvoice.memberName}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase font-bold tracking-wider">Status</span>
                {statusChip(viewInvoice)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-2 border border-line flex items-center justify-between gap-4 text-xs">
              <div>
                <div className="font-bold text-white">{viewInvoice.packageName}</div>
                <div className="text-[11px] text-zinc-400">Metode: {METHOD_LABEL[viewInvoice.method]}</div>
              </div>
              <div className="text-lg font-black font-tabular text-white">{rupiah(viewInvoice.amount)}</div>
            </div>

            {viewInvoice.status !== 'SUCCESS' && (
              <p className="text-[11px] text-amber-300/90">
                {viewInvoice.status === 'REFUNDED'
                  ? `Pembayaran ini telah dikembalikan${viewInvoice.refundReason ? ` (${viewInvoice.refundReason})` : ''}.`
                  : 'Dokumen ini bukan bukti pembayaran. Invoice lunas tersedia setelah pembayaran terkonfirmasi.'}
              </p>
            )}

            <div className="pt-4 border-t border-line flex items-center justify-between gap-3">
              <span className="text-[10px] text-zinc-500">{GYM_LEGAL_NAME}</span>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black font-bold text-xs flex items-center gap-1.5 transition-colors print:hidden"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
