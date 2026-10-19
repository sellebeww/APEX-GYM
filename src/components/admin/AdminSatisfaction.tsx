import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Star, AlertTriangle, ThumbsUp, Inbox } from 'lucide-react';
import type { FeedbackTicket } from '../../types';
import { formatDateId } from '../../lib/membership';

type Filter = 'ALL' | FeedbackTicket['status'];

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'ALL', label: 'Semua' },
  { id: 'BARU', label: 'Baru' },
  { id: 'DIPROSES', label: 'Diproses' },
  { id: 'SELESAI', label: 'Selesai' },
];

const STATUS_CHIP: Record<FeedbackTicket['status'], string> = {
  BARU: 'bg-rose-950 text-rose-300 border-rose-800',
  DIPROSES: 'bg-amber-950 text-amber-300 border-amber-800',
  SELESAI: 'bg-emerald-950 text-emerald-300 border-emerald-800',
};

const tile = 'p-5 rounded-xl bg-surface border border-line';
const tileLabel = 'text-[10px] text-zinc-500 uppercase font-bold tracking-wider block';

export const AdminSatisfaction: React.FC = () => {
  const { satisfactionSurveys, feedbackTickets, updateTicketStatus, coachProfiles, testimonials, toggleTestimonialPublic, showToast } = useApp();

  const [filter, setFilter] = useState<Filter>('ALL');
  const [reply, setReply] = useState<Record<string, string>>({});

  // Every figure comes from submitted surveys. With no surveys there is nothing to report, so we say so.
  const stats = useMemo(() => {
    const n = satisfactionSurveys.length;
    if (n === 0) return null;
    const avg = (pick: (s: (typeof satisfactionSurveys)[number]) => number) => satisfactionSurveys.reduce((a, s) => a + pick(s), 0) / n;
    const promoters = satisfactionSurveys.filter(s => s.npsScore >= 9).length;
    const detractors = satisfactionSurveys.filter(s => s.npsScore <= 6).length;
    return {
      n,
      promoters,
      detractors,
      passives: n - promoters - detractors,
      nps: Math.round(((promoters - detractors) / n) * 100),
      cleanliness: avg(s => s.cleanliness),
      equipment: avg(s => s.equipment),
      atmosphere: avg(s => s.atmosphere),
      service: avg(s => s.service),
    };
  }, [satisfactionSurveys]);

  const openTickets = feedbackTickets.filter(t => t.status !== 'SELESAI').length;
  const tickets = useMemo(
    () => feedbackTickets.filter(t => filter === 'ALL' || t.status === filter).toSorted((a, b) => b.date.localeCompare(a.date)),
    [feedbackTickets, filter]
  );

  const act = (ticket: FeedbackTicket, status: FeedbackTicket['status']) => {
    const text = reply[ticket.id]?.trim();
    if (status === 'SELESAI' && !text && !ticket.adminResponse) {
      return showToast('Tulis tindakan penanganan sebelum menutup tiket.', 'error');
    }
    updateTicketStatus(ticket.id, status, text);
    setReply(prev => ({ ...prev, [ticket.id]: '' }));
    showToast(status === 'SELESAI' ? 'Tiket diselesaikan.' : 'Tiket ditandai sedang diproses.', 'success');
  };

  const npsLabel = (nps: number) => (nps >= 50 ? 'Sangat baik' : nps >= 20 ? 'Baik' : nps >= 0 ? 'Perlu ditingkatkan' : 'Kritis');
  const fmt = (v: number) => v.toFixed(1).replace('.', ',');

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold uppercase text-white">Kepuasan & keluhan</h1>
        <p className="text-xs text-zinc-400 mt-1">NPS dan CSAT dihitung dari survei bulanan member; tiket keluhan ditangani di sini.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-tabular">
        <div className="p-5 rounded-xl bg-surface-2 border border-line-strong">
          <span className={tileLabel}>Net Promoter Score</span>
          <div className="text-3xl font-black text-white mt-1">{stats ? `${stats.nps > 0 ? '+' : ''}${stats.nps}` : '–'}</div>
          <span className="text-[10px] text-zinc-400 font-sans block mt-1">
            {stats ? `${npsLabel(stats.nps)} · ${stats.promoters} promotor, ${stats.detractors} detraktor` : 'Belum ada survei masuk'}
          </span>
        </div>
        <div className={tile}>
          <span className={tileLabel}>Kebersihan</span>
          <div className="text-3xl font-black text-white mt-1 inline-flex items-baseline gap-1">
            {stats ? fmt(stats.cleanliness) : '–'} <Star className="w-4 h-4 fill-amber-400 text-amber-400" aria-hidden />
          </div>
          <span className="text-[10px] text-zinc-500 font-sans block mt-1">Sauna, shower & lantai</span>
        </div>
        <div className={tile}>
          <span className={tileLabel}>Alat & mesin</span>
          <div className="text-3xl font-black text-white mt-1 inline-flex items-baseline gap-1">
            {stats ? fmt(stats.equipment) : '–'} <Star className="w-4 h-4 fill-amber-400 text-amber-400" aria-hidden />
          </div>
          <span className="text-[10px] text-zinc-500 font-sans block mt-1">Kelengkapan & kondisi</span>
        </div>
        <div className={tile}>
          <span className={tileLabel}>Tiket terbuka</span>
          <div className={`text-3xl font-black mt-1 ${openTickets > 0 ? 'text-amber-400' : 'text-white'}`}>{openTickets}</div>
          <span className="text-[10px] text-zinc-500 font-sans block mt-1">{openTickets > 0 ? 'Perlu tindak lanjut' : 'Semua tertangani'}</span>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-4 font-tabular">
          <div className={tile}>
            <span className={tileLabel}>Suasana & tata udara</span>
            <div className="text-xl font-black text-white mt-1">{fmt(stats.atmosphere)} / 5</div>
          </div>
          <div className={tile}>
            <span className={tileLabel}>Layanan staf</span>
            <div className="text-xl font-black text-white mt-1">{fmt(stats.service)} / 5</div>
          </div>
        </div>
      )}
      {stats && <p className="text-[11px] text-zinc-500 -mt-4">Berdasarkan {stats.n} survei member.</p>}

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Star className="w-4 h-4 text-zinc-400" /> Rating personal trainer
        </h2>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.values(coachProfiles)
            .toSorted((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
            .map(c => (
              <li key={c.userId} className="p-4 rounded-xl bg-surface-2 border border-line flex items-center gap-3">
                <img src={c.photoUrl} alt="" className="w-12 h-12 rounded-xl object-cover object-top bg-zinc-800 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-xs truncate">{c.fullName}</div>
                  <div className="text-[11px] text-zinc-300 flex items-center gap-1 font-mono">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" aria-hidden /> {c.rating ?? '–'} <span className="text-zinc-500">· {c.reviewCount} ulasan</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{c.experienceYears} tahun pengalaman</div>
                </div>
              </li>
            ))}
        </ul>
      </section>

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Antrean keluhan member
            </h2>
            <p className="text-[11px] text-zinc-400">Status: Baru → Diproses → Selesai.</p>
          </div>
          <div className="flex items-center gap-1.5" role="group" aria-label="Filter status tiket">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${filter === f.id ? 'bg-white text-black border-white' : 'bg-surface-2 border-line text-zinc-400 hover:text-white'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {tickets.length === 0 ? (
          <div className="py-10 text-center">
            <Inbox className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">Tidak ada tiket pada filter ini.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {tickets.map(ticket => (
              <li key={ticket.id} className="py-4 space-y-3 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-bold text-white text-sm">{ticket.memberName}</span>
                    <span className="text-zinc-400 text-[11px] ml-2">
                      {formatDateId(ticket.date, 'short')} · {ticket.category}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${STATUS_CHIP[ticket.status]}`}>{ticket.status}</span>
                </div>
                <p className="text-zinc-300 leading-relaxed bg-surface-2 p-3 rounded-xl border border-line">"{ticket.text}"</p>
                {ticket.adminResponse && (
                  <div className="p-3 rounded-xl bg-surface-2 border border-line-strong text-zinc-200">
                    <strong>Penanganan:</strong> {ticket.adminResponse}
                  </div>
                )}
                {ticket.status !== 'SELESAI' && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <label className="sr-only" htmlFor={`reply-${ticket.id}`}>
                      Tindakan penanganan
                    </label>
                    <input
                      id={`reply-${ticket.id}`}
                      type="text"
                      maxLength={300}
                      placeholder="Tulis tindakan penanganan atau balasan untuk member"
                      value={reply[ticket.id] || ''}
                      onChange={e => setReply({ ...reply, [ticket.id]: e.target.value })}
                      className="flex-1 bg-surface-2 border border-line-strong rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      {ticket.status === 'BARU' && (
                        <button onClick={() => act(ticket, 'DIPROSES')} className="px-3.5 py-2.5 rounded-lg border border-amber-700/60 text-amber-300 hover:bg-amber-500/10 font-bold transition-colors">
                          Proses
                        </button>
                      )}
                      <button onClick={() => act(ticket, 'SELESAI')} className="px-3.5 py-2.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-bold transition-colors">
                        Selesaikan
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <ThumbsUp className="w-4 h-4 text-zinc-400" /> Kurasi testimoni untuk situs publik
        </h2>
        <p className="text-xs text-zinc-400">Hanya testimoni yang Anda setujui tampil di beranda.</p>
        <ul className="space-y-3">
          {testimonials.map(t => (
            <li key={t.id} className="p-4 rounded-xl bg-surface-2 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <div className="font-bold text-white">
                  {t.name} <span className="text-zinc-500 font-normal">({t.role})</span>
                </div>
                <p className="text-zinc-400 italic text-[11px] mt-0.5">"{t.text}"</p>
              </div>
              <button
                onClick={() => toggleTestimonialPublic(t.id)}
                aria-pressed={t.approvedForPublic}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors shrink-0 ${
                  t.approvedForPublic ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-surface text-zinc-300 border-line-strong hover:border-white'
                }`}
              >
                {t.approvedForPublic ? 'Tampil di publik' : 'Disembunyikan'}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};
