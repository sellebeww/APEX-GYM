import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { TrainingSession, CoachAvailability } from '../../types';
import { Calendar, Check, Clock, Save } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { formatDateId } from '../../lib/membership';

type Filter = 'ALL' | TrainingSession['status'];

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'ALL', label: 'Semua' },
  { id: 'SCHEDULED', label: 'Terjadwal' },
  { id: 'COMPLETED', label: 'Selesai' },
  { id: 'CANCELLED', label: 'Batal' },
  { id: 'NO_SHOW', label: 'Tidak hadir' },
];

const STATUS_UI: Record<TrainingSession['status'], { label: string; cls: string }> = {
  SCHEDULED: { label: 'Terjadwal', cls: 'bg-sky-950 text-sky-300 border-sky-800' },
  COMPLETED: { label: 'Selesai', cls: 'bg-emerald-950 text-emerald-300 border-emerald-800' },
  CANCELLED: { label: 'Batal', cls: 'bg-rose-950 text-rose-300 border-rose-800' },
  NO_SHOW: { label: 'Tidak hadir', cls: 'bg-amber-950 text-amber-300 border-amber-800' },
};

const TIME_OPTIONS = Array.from({ length: 16 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`); // 06:00–21:00
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const startOf = (s: TrainingSession) => new Date(`${s.date}T${s.time}:00`).getTime();

const selectClass = 'bg-surface-2 border border-line-strong rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-white disabled:opacity-40';

export const CoachSchedule: React.FC = () => {
  const { currentUser, trainingSessions, closeTrainingSession, cancelTrainingSession, coachAvailability, setCoachAvailability, showToast } = useApp();

  const [filter, setFilter] = useState<Filter>('ALL');
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [cancelTarget, setCancelTarget] = useState<TrainingSession | null>(null);

  const coachId = currentUser?.id ?? '';
  const savedAvailability = coachAvailability[coachId] ?? [];
  const [draft, setDraft] = useState<CoachAvailability[]>(savedAvailability);
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedAvailability);

  const sessions = useMemo(
    () =>
      trainingSessions
        .filter(s => s.coachId === coachId && (filter === 'ALL' || s.status === filter))
        .toSorted((a, b) => (a.status === 'SCHEDULED' && b.status === 'SCHEDULED' ? startOf(a) - startOf(b) : startOf(b) - startOf(a))),
    [trainingSessions, coachId, filter]
  );

  const complete = async (s: TrainingSession) => {
    const res = await closeTrainingSession(s.id, 'COMPLETED', feedback[s.id]?.trim() || 'Sesi selesai dengan baik.');
    if (res.success) setFeedback(prev => ({ ...prev, [s.id]: '' }));
    showToast(res.success ? 'Sesi ditandai selesai. Komisi dihitung otomatis.' : res.message, res.success ? 'success' : 'error');
  };

  const noShow = async (s: TrainingSession) => {
    const res = await closeTrainingSession(s.id, 'NO_SHOW', 'Klien tidak hadir tanpa pemberitahuan.');
    showToast(res.success ? 'Sesi ditandai tidak hadir.' : res.message, res.success ? 'info' : 'error');
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    const res = await cancelTrainingSession(cancelTarget.id);
    showToast(res.success ? 'Sesi dibatalkan. Kuota klien dikembalikan.' : res.message, res.success ? 'info' : 'error');
    setCancelTarget(null);
  };

  const updateDay = (dow: number, patch: Partial<CoachAvailability>) =>
    setDraft(prev => prev.map(a => (a.dayOfWeek === dow ? { ...a, ...patch } : a)));

  const saveAvailability = async () => {
    const invalid = draft.find(a => a.isAvailable && a.startTime >= a.endTime);
    if (invalid) return showToast(`Jam selesai ${invalid.dayName} harus setelah jam mulai.`, 'error');
    const res = await setCoachAvailability(draft);
    showToast(res.success ? 'Jam ketersediaan disimpan. Member hanya bisa booking pada jam ini.' : res.message, res.success ? 'success' : 'error');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold uppercase text-white">Jadwal & ketersediaan</h1>
        <p className="text-xs text-zinc-400 mt-1">Atur jam kerja mingguan, lalu kelola sesi 1-on-1 klien Anda.</p>
      </div>

      {/* Weekly availability */}
      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-400" /> Jam ketersediaan mingguan
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">Slot booking untuk member dibuat dari jam ini.</p>
          </div>
          <button
            onClick={saveAvailability}
            disabled={!dirty}
            className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Save className="w-3.5 h-3.5" /> Simpan perubahan
          </button>
        </div>
        <ul className="divide-y divide-line">
          {DISPLAY_ORDER.map(dow => {
            const a = draft.find(x => x.dayOfWeek === dow);
            if (!a) return null;
            return (
              <li key={dow} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <label className="flex items-center gap-2.5 w-28 cursor-pointer">
                  <input type="checkbox" checked={a.isAvailable} onChange={e => updateDay(dow, { isAvailable: e.target.checked })} className="w-4 h-4 accent-white" />
                  <span className={`font-bold ${a.isAvailable ? 'text-white' : 'text-zinc-500'}`}>{a.dayName}</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`start-${dow}`}>
                    Jam mulai {a.dayName}
                  </label>
                  <select id={`start-${dow}`} value={a.startTime} disabled={!a.isAvailable} onChange={e => updateDay(dow, { startTime: e.target.value })} className={selectClass}>
                    {TIME_OPTIONS.map(t => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <span className="text-zinc-500">sampai</span>
                  <label className="sr-only" htmlFor={`end-${dow}`}>
                    Jam selesai {a.dayName}
                  </label>
                  <select id={`end-${dow}`} value={a.endTime} disabled={!a.isAvailable} onChange={e => updateDay(dow, { endTime: e.target.value })} className={selectClass}>
                    {TIME_OPTIONS.map(t => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                {!a.isAvailable && <span className="text-zinc-500">Libur</span>}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Sessions */}
      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-zinc-400" /> Booking sesi klien
          </h2>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="Filter status sesi">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap transition-colors ${
                  filter === f.id ? 'bg-white text-black border-white' : 'bg-surface-2 border-line text-zinc-400 hover:text-white hover:border-line-strong'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {sessions.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-10">Tidak ada sesi dengan status ini.</p>
        ) : (
          <ul className="divide-y divide-line">
            {sessions.map(session => {
              const ui = STATUS_UI[session.status];
              const started = startOf(session) <= Date.now();
              return (
                <li key={session.id} className="py-4 space-y-3 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white">{session.memberName}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${ui.cls}`}>{ui.label}</span>
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1">
                        {formatDateId(session.date)} · {session.time} WIB · {session.durationMinutes} menit
                      </div>
                      {session.notes && <p className="text-[11px] text-zinc-400 mt-1 italic">Catatan klien: "{session.notes}"</p>}
                      {session.coachFeedback && session.status !== 'SCHEDULED' && <p className="text-[11px] text-zinc-300 mt-1">Evaluasi: {session.coachFeedback}</p>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {session.status === 'SCHEDULED' && (
                        <>
                          <button
                            onClick={() => complete(session)}
                            disabled={!started}
                            title={started ? undefined : 'Tersedia setelah sesi dimulai'}
                            className="px-3.5 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black font-bold transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Check className="w-3.5 h-3.5" /> Selesai
                          </button>
                          <button
                            onClick={() => noShow(session)}
                            disabled={!started}
                            title={started ? undefined : 'Tersedia setelah sesi dimulai'}
                            className="px-3 py-2 rounded-lg border border-line-strong text-amber-300 hover:border-amber-500/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Tidak hadir
                          </button>
                          <button onClick={() => setCancelTarget(session)} className="px-3 py-2 rounded-lg border border-line-strong text-rose-300 hover:border-rose-500/60 transition-colors">
                            Batalkan
                          </button>
                        </>
                      )}
                      {session.rating && (
                        <span className="text-[11px] text-zinc-300">
                          Rating klien: <strong className="text-white">{session.rating}/5</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {session.status === 'SCHEDULED' && started && (
                    <div className="pt-1">
                      <label htmlFor={`fb-${session.id}`} className="sr-only">
                        Evaluasi sesi
                      </label>
                      <input
                        id={`fb-${session.id}`}
                        type="text"
                        maxLength={300}
                        placeholder="Evaluasi atau beban tercapai (disimpan di profil klien)"
                        value={feedback[session.id] || ''}
                        onChange={e => setFeedback({ ...feedback, [session.id]: e.target.value })}
                        className="w-full bg-surface-2 border border-line-strong rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        isOpen={!!cancelTarget}
        title="Batalkan sesi klien?"
        danger
        confirmLabel="Ya, batalkan"
        cancelLabel="Kembali"
        message={cancelTarget && `Sesi ${cancelTarget.memberName} pada ${formatDateId(cancelTarget.date)} pukul ${cancelTarget.time} akan dibatalkan dan kuota sesi klien dikembalikan.`}
        onConfirm={confirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
};
