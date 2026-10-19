import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Wrench, Clock, Plus } from 'lucide-react';
import { Modal } from '../common/Modal';
import { formatDateId } from '../../lib/membership';

const CATEGORIES = ['Semua', 'Free Weights', 'Cardio', 'Machines', 'Wellness & Recovery', 'Functional'];

const EQUIPMENT_STATUS = {
  OPERATIONAL: { label: 'Operasional', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400' },
  NEEDS_SERVICE: { label: 'Jadwal servis', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30', dot: 'bg-amber-400' },
  UNDER_MAINTENANCE: { label: 'Dalam perawatan', cls: 'text-rose-300 bg-rose-500/10 border-rose-500/30', dot: 'bg-rose-400' },
} as const;

const REPORT_STATUS = {
  RESOLVED: { label: 'Selesai diperbaiki', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  IN_PROGRESS: { label: 'Sedang dikerjakan', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  PENDING: { label: 'Menunggu antrian', cls: 'text-zinc-300 bg-white/5 border-line-strong' },
} as const;

export const MemberEquipmentStatus: React.FC = () => {
  const { gymEquipment, equipmentReports, reportEquipmentIssue, currentUser, showToast } = useApp();
  const [category, setCategory] = useState('Semua');
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [equipId, setEquipId] = useState(gymEquipment[0]?.id ?? '');
  const [issueText, setIssueText] = useState('');
  const [error, setError] = useState('');

  const filtered = gymEquipment.filter(e => category === 'Semua' || e.category === category);
  const myReports = equipmentReports.filter(r => r.memberId === currentUser?.id);

  const openReport = (id?: string) => {
    if (id) setEquipId(id);
    setError('');
    setIsReportOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (issueText.trim().length < 10) return setError('Jelaskan kendalanya minimal 10 karakter agar teknisi mudah menindaklanjuti.');
    reportEquipmentIssue(equipId, issueText.trim());
    showToast('Laporan terkirim ke tim operasional APEX.', 'success');
    setIsReportOpen(false);
    setIssueText('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-zinc-400" />
            <h1 className="text-2xl font-extrabold uppercase text-white">Status alat</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">Kondisi dan jadwal servis seluruh peralatan gym APEX.</p>
        </div>
        <button
          onClick={() => openReport()}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Lapor kendala alat
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" role="group" aria-label="Filter kategori alat">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            aria-pressed={category === cat}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
              category === cat ? 'bg-white text-black border-white' : 'bg-surface text-zinc-400 border-line hover:text-white hover:border-line-strong'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-12 border border-dashed border-line rounded-2xl">Tidak ada alat pada kategori ini.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(eq => {
            const st = EQUIPMENT_STATUS[eq.status];
            return (
              <article key={eq.id} className="p-5 rounded-2xl bg-surface border border-line hover:border-line-strong transition-colors flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{eq.category}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${st.cls} flex items-center gap-1.5`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white leading-snug">{eq.name}</h2>
                    <p className="text-xs text-zinc-400 mt-1">{eq.location}</p>
                  </div>
                </div>

                <div>
                  <dl className="p-3 rounded-xl bg-black/40 border border-line space-y-1 text-[11px] text-zinc-400">
                    <div className="flex justify-between">
                      <dt>Inspeksi terakhir</dt>
                      <dd className="font-mono text-zinc-300">{formatDateId(eq.lastServiceDate, 'short')}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Servis berikutnya</dt>
                      <dd className="font-mono text-zinc-300">{formatDateId(eq.nextServiceDate, 'short')}</dd>
                    </div>
                  </dl>
                  <button onClick={() => openReport(eq.id)} className="mt-3 text-[11px] font-semibold text-zinc-400 hover:text-white underline underline-offset-4">
                    Laporkan masalah alat ini
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {myReports.length > 0 && (
        <section className="p-6 rounded-2xl bg-surface border border-line space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" /> Laporan kendala saya
          </h2>
          <ul className="space-y-3">
            {myReports.map(rep => {
              const rs = REPORT_STATUS[rep.status] ?? REPORT_STATUS.PENDING;
              return (
                <li key={rep.id} className="p-4 rounded-xl bg-black/40 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{rep.equipmentName}</span>
                      <span className="text-[11px] font-mono text-zinc-500">{formatDateId(rep.date, 'short')}</span>
                    </div>
                    <p className="text-zinc-400 leading-relaxed">{rep.issueDescription}</p>
                    {rep.adminNotes && <p className="text-[11px] text-amber-400">Catatan tim: {rep.adminNotes}</p>}
                  </div>
                  <span className={`self-start px-2.5 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap ${rs.cls}`}>{rs.label}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Modal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} label="Lapor kendala alat" maxWidth="max-w-md">
        <form onSubmit={submit} className="p-6 space-y-5" noValidate>
          <div className="pr-8">
            <h2 className="text-base font-bold text-white">Lapor kendala alat</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Bantu kami menjaga kenyamanan dan keselamatan bersama.</p>
          </div>
          <div>
            <label htmlFor="eq-select" className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Pilih alat
            </label>
            <select
              id="eq-select"
              value={equipId}
              onChange={e => setEquipId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-line-strong text-sm text-white focus:outline-none focus:border-white"
            >
              {gymEquipment.map(eq => (
                <option key={eq.id} value={eq.id}>
                  {eq.name} ({eq.location})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="eq-issue" className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Deskripsi kendala
            </label>
            <textarea
              id="eq-issue"
              rows={4}
              maxLength={400}
              value={issueText}
              onChange={e => setIssueText(e.target.value)}
              placeholder="Contoh: kabel pulley sisi kanan terasa seret"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-line-strong text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white resize-none"
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-rose-400">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsReportOpen(false)} className="px-4 py-2.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white">
              Batal
            </button>
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors">
              Kirim laporan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
