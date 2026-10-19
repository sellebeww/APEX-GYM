import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { TrainingSession } from '../../types';
import { Calendar, Star, X, AlertCircle } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Modal } from '../common/Modal';
import { Avatar } from '../common/Avatar';
import { PT_BOOKING_HORIZON_DAYS, PT_CANCEL_WINDOW_HOURS } from '../../../shared/rules';
import { gymInstant } from '../../../shared/time';
import { api } from '../../lib/api';
import { addDaysToKey, formatDateId, toDateKey } from '../../lib/membership';

const fieldClass =
  'w-full bg-surface-2 border border-line-strong rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white';

const STATUS_UI: Record<TrainingSession['status'], { label: string; cls: string }> = {
  SCHEDULED: { label: 'Terjadwal', cls: 'bg-sky-950 text-sky-300 border-sky-800' },
  COMPLETED: { label: 'Selesai', cls: 'bg-emerald-950 text-emerald-300 border-emerald-800' },
  CANCELLED: { label: 'Batal', cls: 'bg-rose-950 text-rose-300 border-rose-800' },
  NO_SHOW: { label: 'Tidak hadir', cls: 'bg-amber-950 text-amber-300 border-amber-800' },
};

export const MemberCoachBooking: React.FC = () => {
  const {
    coachProfiles,
    currentUser,
    memberProfiles,
    trainingSessions,
    bookTrainingSession,
    cancelTrainingSession,
    submitSessionRating,
    setMemberTab,
    showToast,
  } = useApp();

  const memberId = currentUser?.id ?? '';
  const profile = memberProfiles[memberId];
  const sessionsRemaining = profile?.ptSessionsRemaining || 0;
  const coaches = Object.values(coachProfiles).filter(c => c.isPublicApproved);

  const [selectedCoachId, setSelectedCoachId] = useState<string>(profile?.assignedCoachId ?? coaches[0]?.userId ?? '');
  const [bookingDate, setBookingDate] = useState(() => addDaysToKey(toDateKey(), 1));
  const [bookingTime, setBookingTime] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [isBooking, setIsBooking] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<TrainingSession | null>(null);
  const [ratingSessionId, setRatingSessionId] = useState<string | null>(null);
  const [stars, setStars] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const selectedCoach = coachProfiles[selectedCoachId];
  const memberSessions = useMemo(
    () => trainingSessions.filter(s => s.memberId === memberId).toSorted((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)),
    [trainingSessions, memberId]
  );

  // Slot availability comes from the server, which sees every booking (without revealing who made it)
  type Slot = { time: string; available: boolean; reason: 'AVAILABLE' | 'PAST' | 'OFF' | 'TAKEN' | 'CLASS' | 'MINE' };
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [slotsVersion, setSlotsVersion] = useState(0);
  useEffect(() => {
    if (!selectedCoachId || !bookingDate) return;
    let cancelled = false;
    setSlots(null);
    api<{ slots: Slot[] }>('GET', `/api/coaches/${encodeURIComponent(selectedCoachId)}/slots?date=${bookingDate}`)
      .then(r => {
        if (cancelled) return;
        setSlots(r.slots);
        setSlotError(null);
      })
      .catch(err => !cancelled && setSlotError(err instanceof Error ? err.message : 'Gagal memuat jadwal coach.'));
    return () => {
      cancelled = true;
    };
  }, [selectedCoachId, bookingDate, slotsVersion]);

  const SLOT_HINT: Record<Slot['reason'], string | undefined> = {
    AVAILABLE: undefined,
    PAST: 'Jam sudah lewat',
    OFF: 'Coach tidak bertugas',
    TAKEN: 'Slot sudah terisi',
    CLASS: 'Coach sedang mengajar kelas',
    MINE: 'Anda sudah punya sesi di jam ini',
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedCoach || isBooking) return;
    if (!bookingTime) return showToast('Pilih jam sesi terlebih dahulu.', 'error');
    setIsBooking(true);
    const result = await bookTrainingSession({
      coachId: selectedCoachId,
      date: bookingDate,
      time: bookingTime,
      notes: bookingNotes.trim() || undefined,
    });
    setIsBooking(false);
    showToast(result.message, result.success ? 'success' : 'error');
    setSlotsVersion(v => v + 1);
    if (result.success) {
      setBookingTime('');
      setBookingNotes('');
    }
  };

  const hoursUntil = (s: TrainingSession) => (gymInstant(s.date, s.time).getTime() - Date.now()) / 3_600_000;

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    const res = await cancelTrainingSession(cancelTarget.id);
    setCancelTarget(null);
    setSlotsVersion(v => v + 1);
    showToast(res.message, res.success ? (res.data?.refunded ? 'success' : 'info') : 'error');
  };

  const saveRating = async () => {
    if (!ratingSessionId) return;
    const res = await submitSessionRating(ratingSessionId, stars, reviewComment.trim());
    showToast(res.message, res.success ? 'success' : 'error');
    if (!res.success) return;
    setRatingSessionId(null);
    setReviewComment('');
    setStars(5);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="bg-surface rounded-2xl border border-line p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.2em]">Kuota sesi Anda</span>
          <h1 className="text-2xl font-extrabold uppercase text-white mt-0.5">Personal training 1-on-1</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Sisa sesi: <strong className="text-white font-mono text-sm">{sessionsRemaining}</strong>
          </p>
        </div>
        {sessionsRemaining <= 1 && (
          <button onClick={() => setMemberTab('membership')} className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-colors shrink-0">
            Top-up kuota sesi PT
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-surface rounded-2xl border border-line p-6 space-y-6">
          <h2 className="text-base font-bold text-white">Booking jadwal sesi baru</h2>

          {sessionsRemaining <= 0 && (
            <div role="alert" className="p-3 rounded-lg bg-amber-950/40 border border-amber-800 text-xs text-amber-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              Anda belum punya kuota sesi PT. Beli paket PT untuk membuka booking.
            </div>
          )}

          <form onSubmit={handleBooking} className="space-y-5" noValidate>
            <fieldset>
              <legend className="block text-xs text-zinc-400 font-semibold mb-2">Pilih personal trainer</legend>
              <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {coaches.map(c => {
                  const isSelected = selectedCoachId === c.userId;
                  return (
                    <button
                      key={c.userId}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        setSelectedCoachId(c.userId);
                        setBookingTime('');
                      }}
                      className={`p-3 rounded-xl border text-left transition-colors flex items-center gap-3 ${
                        isSelected ? 'bg-surface-2 border-white' : 'bg-surface-2 border-line hover:border-line-strong'
                      }`}
                    >
                      <Avatar name={c.fullName} src={c.photoUrl} size={36} />
                      <span className="min-w-0">
                        <span className="font-bold text-white truncate block text-xs">{c.fullName}</span>
                        <span className="text-[10px] text-zinc-400 truncate block">
                          {c.rating !== null ? `★ ${c.rating} (${c.reviewCount})` : 'Belum ada ulasan'} · {c.experienceYears} thn
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor="pt-date" className="block text-xs text-zinc-400 font-semibold mb-1.5">
                Tanggal sesi
              </label>
              <input
                id="pt-date"
                type="date"
                required
                min={toDateKey()}
                max={addDaysToKey(toDateKey(), PT_BOOKING_HORIZON_DAYS)}
                value={bookingDate}
                onChange={e => {
                  setBookingDate(e.target.value);
                  setBookingTime('');
                }}
                className={`${fieldClass} sm:max-w-xs`}
              />
            </div>

            <fieldset>
              <legend className="block text-xs text-zinc-400 font-semibold mb-2">Jam sesi (60 menit, WIB)</legend>
              <div role="radiogroup" className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots === null && !slotError && <p className="col-span-full text-[11px] text-zinc-500">Memuat jadwal coach…</p>}
                {slots?.map(st => {
                  const selected = bookingTime === st.time;
                  return (
                    <button
                      key={st.time}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!st.available}
                      onClick={() => setBookingTime(st.time)}
                      title={SLOT_HINT[st.reason]}
                      aria-label={`${st.time}${SLOT_HINT[st.reason] ? `, ${SLOT_HINT[st.reason]}` : ', tersedia'}`}
                      className={`py-2.5 rounded-lg border text-xs font-mono font-bold transition-colors ${
                        selected
                          ? 'bg-white text-black border-white'
                          : !st.available
                          ? 'bg-surface-2/50 border-line text-zinc-600 line-through cursor-not-allowed'
                          : 'bg-surface-2 border-line text-zinc-200 hover:border-white'
                      }`}
                    >
                      {st.time}
                    </button>
                  );
                })}
              </div>
              {slotError && (
                <p role="alert" className="text-[11px] text-rose-300 mt-2">
                  {slotError}{' '}
                  <button type="button" onClick={() => setSlotsVersion(v => v + 1)} className="underline">
                    Coba lagi
                  </button>
                </p>
              )}
              {slots && slots.every(st => !st.available) && (
                <p className="text-[11px] text-amber-400 mt-2">Tidak ada slot tersedia pada tanggal ini (penuh, lewat, atau coach libur). Pilih tanggal lain.</p>
              )}
            </fieldset>

            <div>
              <label htmlFor="pt-notes" className="block text-xs text-zinc-400 font-semibold mb-1.5">
                Fokus atau catatan sesi <span className="text-zinc-600 font-normal">(opsional)</span>
              </label>
              <input
                id="pt-notes"
                type="text"
                maxLength={150}
                placeholder="Misal: latihan dada, pengenalan deadlift, koreksi lutut"
                value={bookingNotes}
                onChange={e => setBookingNotes(e.target.value)}
                className={fieldClass}
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-[11px] text-zinc-500">Pembatalan gratis hingga {PT_CANCEL_WINDOW_HOURS} jam sebelum sesi; setelah itu kuota hangus.</span>
              <button
                type="submit"
                disabled={sessionsRemaining <= 0 || isBooking || !bookingTime}
                className="px-6 py-3 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-sm transition-colors whitespace-nowrap"
              >
                {isBooking ? 'Memproses…' : sessionsRemaining > 0 && !bookingTime ? 'Pilih jam dulu' : 'Konfirmasi booking'}
              </button>
            </div>
          </form>
        </div>

        {selectedCoach && (
          <aside className="bg-surface rounded-2xl border border-line p-6 space-y-4 text-xs self-start">
            <div className="w-full h-44 rounded-xl overflow-hidden bg-zinc-800">
              <img src={selectedCoach.photoUrl} alt={selectedCoach.fullName} className="w-full h-full object-cover object-top" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{selectedCoach.fullName}</h3>
              <p className="text-[11px] text-zinc-400">{selectedCoach.title}</p>
            </div>
            <p className="text-zinc-400 leading-relaxed text-[11px]">{selectedCoach.bio}</p>
            <div className="space-y-1.5 pt-3 border-t border-line">
              <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-wider block">Spesialisasi</span>
              <div className="flex flex-wrap gap-1.5">
                {selectedCoach.specialties.map(s => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-zinc-200">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-zinc-400" /> Jadwal sesi PT saya
          </h2>
          <span className="text-xs text-zinc-400">{memberSessions.length} sesi</span>
        </div>

        {memberSessions.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">Belum ada sesi PT yang dijadwalkan.</p>
        ) : (
          <ul className="divide-y divide-line">
            {memberSessions.map(session => {
              const ui = STATUS_UI[session.status];
              return (
                <li key={session.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">
                        {formatDateId(session.date)} · {session.time} WIB
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${ui.cls}`}>{ui.label}</span>
                    </div>
                    <div className="text-zinc-400 mt-0.5">
                      Coach <strong className="text-zinc-200">{session.coachName}</strong> · {session.durationMinutes} menit
                    </div>
                    {session.notes && <p className="text-[11px] text-zinc-500 mt-0.5 italic">Catatan: {session.notes}</p>}
                    {session.coachFeedback && <p className="text-[11px] text-zinc-300 mt-0.5">Feedback coach: {session.coachFeedback}</p>}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {session.status === 'SCHEDULED' && (
                      <button
                        onClick={() => setCancelTarget(session)}
                        className="px-3 py-2 rounded-lg border border-line hover:border-rose-500/50 hover:text-rose-300 text-zinc-300 text-xs transition-colors"
                      >
                        Batalkan sesi
                      </button>
                    )}
                    {session.status === 'COMPLETED' && !session.rating && (
                      <button
                        onClick={() => setRatingSessionId(session.id)}
                        className="px-3 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-colors flex items-center gap-1.5"
                      >
                        <Star className="w-3.5 h-3.5 fill-black" /> Beri rating
                      </button>
                    )}
                    {session.rating && (
                      <div className="sm:text-right">
                        <div className="flex items-center gap-0.5" role="img" aria-label={`Rating ${session.rating} dari 5`}>
                          {Array.from({ length: session.rating }).map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                        <span className="text-[10px] text-zinc-500">Rating tersimpan</span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        isOpen={!!cancelTarget}
        title="Batalkan sesi PT?"
        danger
        confirmLabel="Ya, batalkan"
        cancelLabel="Tetap jadwalkan"
        message={
          cancelTarget &&
          (hoursUntil(cancelTarget) < PT_CANCEL_WINDOW_HOURS
            ? `Sesi ${formatDateId(cancelTarget.date)} pukul ${cancelTarget.time} kurang dari ${PT_CANCEL_WINDOW_HOURS} jam lagi. Jika dibatalkan, kuota sesi akan hangus.`
            : `Sesi ${formatDateId(cancelTarget.date)} pukul ${cancelTarget.time} akan dibatalkan dan kuota sesi dikembalikan ke akun Anda.`)
        }
        onConfirm={() => void confirmCancel()}
        onCancel={() => setCancelTarget(null)}
      />

      <Modal isOpen={!!ratingSessionId} onClose={() => setRatingSessionId(null)} label="Beri rating sesi coach" maxWidth="max-w-md" hideClose>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <h2 className="text-base font-bold text-white">Beri rating sesi</h2>
            <button onClick={() => setRatingSessionId(null)} aria-label="Tutup" className="p-1 text-zinc-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div role="radiogroup" aria-label="Rating bintang" className="flex items-center justify-center gap-2 py-3">
            {[1, 2, 3, 4, 5].map(st => (
              <button key={st} type="button" role="radio" aria-checked={stars === st} aria-label={`${st} bintang`} onClick={() => setStars(st)} className="p-1 transition-transform hover:scale-110">
                <Star className={`w-8 h-8 ${st <= stars ? 'fill-amber-400 text-amber-400' : 'text-zinc-600'}`} />
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="review" className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Ulasan untuk coach <span className="text-zinc-600 font-normal">(opsional)</span>
            </label>
            <textarea
              id="review"
              rows={3}
              maxLength={300}
              placeholder="Ceritakan bagaimana sesi tadi membantu performa Anda"
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              className={`${fieldClass} resize-none`}
            />
          </div>
          <button onClick={() => void saveRating()} className="w-full py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm">
            Simpan ulasan
          </button>
        </div>
      </Modal>
    </div>
  );
};
