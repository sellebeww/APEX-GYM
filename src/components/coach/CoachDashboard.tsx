import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Calendar, AlertTriangle, Star, Wallet, CheckCircle2 } from 'lucide-react';
import { addDaysToKey, formatDateId, getDaysRemaining, toDateKey } from '../../lib/membership';
import { Avatar } from '../common/Avatar';

const tile = 'p-5 rounded-xl bg-surface border border-line';
const tileLabel = 'text-[10px] text-zinc-500 uppercase font-bold tracking-wider block';

export const CoachDashboard: React.FC = () => {
  const { currentUser, coachProfiles, memberProfiles, trainingSessions, users, setCoachTab } = useApp();

  const coach = currentUser ? coachProfiles[currentUser.id] : null;
  const today = toDateKey();
  const month = today.slice(0, 7);
  const weekEnd = addDaysToKey(today, 7);

  const assignedClients = useMemo(
    () =>
      Object.values(memberProfiles)
        .filter(p => p.assignedCoachId === currentUser?.id)
        .map(p => ({ profile: p, user: users.find(u => u.id === p.userId) })),
    [memberProfiles, users, currentUser?.id]
  );

  const coachSessions = useMemo(() => trainingSessions.filter(s => s.coachId === currentUser?.id), [trainingSessions, currentUser?.id]);
  const upcoming = useMemo(
    () =>
      coachSessions
        .filter(s => s.status === 'SCHEDULED' && s.date >= today)
        .toSorted((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
    [coachSessions, today]
  );
  const thisWeek = upcoming.filter(s => s.date <= weekEnd);
  const completedThisMonth = coachSessions.filter(s => s.status === 'COMPLETED' && s.date.startsWith(month));

  // Retention watchlist: one entry per client with every reason that applies
  const watchlist = assignedClients
    .map(c => {
      const reasons: string[] = [];
      const days = getDaysRemaining(c.profile.endDate);
      if (c.profile.status === 'EXPIRED') reasons.push('Membership telah kedaluwarsa.');
      else if (c.profile.status === 'EXPIRING_SOON') reasons.push(`Membership berakhir dalam ${days} hari. Kirim pengingat perpanjangan.`);
      if (c.profile.status !== 'EXPIRED' && c.profile.visitsThisMonth < 5) reasons.push(`Kunjungan rendah (${c.profile.visitsThisMonth}x bulan ini). Hubungi untuk jadwalkan sesi.`);
      return { ...c, reasons };
    })
    .filter(c => c.reasons.length > 0);

  // Commission = completed sessions this month × coach rate × (commission %). Values come from the coach profile.
  const commissionRate = coach ? coach.commissionRatePercent / 100 : 0;
  const estimatedCommission = completedThisMonth.length * (coach?.pricePerSession ?? 0) * commissionRate;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="bg-surface rounded-2xl border border-line p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-surface-2 shrink-0 border border-line-strong">
            {coach?.photoUrl && <img src={coach.photoUrl} alt={coach.fullName} className="w-full h-full object-cover object-top" />}
          </div>
          <div>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.2em] block">Panel personal trainer</span>
            <h1 className="text-xl font-extrabold uppercase text-white mt-0.5">Halo, {(coach?.fullName ?? currentUser?.name ?? 'Coach').split(',')[0]}</h1>
            <p className="text-xs text-zinc-400 mt-1 flex flex-wrap items-center gap-x-2">
              <span>{coach?.title}</span>
              {coach && (
                <span className="inline-flex items-center gap-1 text-zinc-200">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {coach.rating} ({coach.reviewCount} ulasan)
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => setCoachTab('schedule')}
          className="px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm transition-colors self-start md:self-auto"
        >
          Buka kalender sesi
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-tabular">
        <div className={tile}>
          <span className={tileLabel}>Klien aktif</span>
          <div className="text-3xl font-black text-white mt-1">
            {assignedClients.filter(c => c.profile.status !== 'EXPIRED').length}
            <span className="text-xs font-normal text-zinc-500 ml-1 font-sans">dari {assignedClients.length}</span>
          </div>
        </div>
        <div className={tile}>
          <span className={tileLabel}>Sesi 7 hari ke depan</span>
          <div className="text-3xl font-black text-white mt-1">
            {thisWeek.length}
            <span className="text-xs font-normal text-zinc-500 ml-1 font-sans">sesi</span>
          </div>
        </div>
        <div className={tile}>
          <span className={tileLabel}>Selesai bulan ini</span>
          <div className="text-3xl font-black text-white mt-1">
            {completedThisMonth.length}
            <span className="text-xs font-normal text-zinc-500 ml-1 font-sans">sesi</span>
          </div>
        </div>
        <div className={tile}>
          <span className={tileLabel}>Estimasi komisi bulan ini</span>
          <div className="text-xl font-black text-white mt-2 inline-flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-zinc-500" />
            Rp {Math.round(estimatedCommission).toLocaleString('id-ID')}
          </div>
          <span className="text-[10px] text-zinc-500 font-sans block mt-1">Tarif komisi {coach?.commissionRatePercent ?? 0}%</span>
        </div>
      </div>

      <section className="bg-surface rounded-2xl border border-amber-900/40 p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Klien yang perlu perhatian
          </h2>
          <span className="text-xs text-zinc-400">{watchlist.length} klien</span>
        </div>

        {watchlist.length === 0 ? (
          <p className="text-xs text-zinc-400 py-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {assignedClients.length === 0 ? 'Belum ada klien yang ditugaskan.' : 'Semua klien aktif dan berprogres baik.'}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {watchlist.map(c => (
              <li key={c.profile.userId} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-3">
                  <Avatar name={c.user?.name ?? '?'} src={c.user?.avatarUrl} size={32} />
                  <div>
                    <div className="font-bold text-white">{c.user?.name}</div>
                    <ul className="text-[11px] text-amber-300/90 mt-0.5 space-y-0.5">
                      {c.reasons.map(r => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <button
                  onClick={() => setCoachTab('clients')}
                  className="px-3 py-2 rounded-lg border border-line-strong hover:border-white text-xs font-semibold text-zinc-200 self-start sm:self-auto transition-colors"
                >
                  Buka profil klien
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-zinc-400" /> Sesi mendatang
          </h2>
          <button onClick={() => setCoachTab('schedule')} className="text-xs text-zinc-400 hover:text-white">
            Buka kalender →
          </button>
        </div>

        {upcoming.length === 0 ? (
          <p className="text-xs text-zinc-500 py-4 text-center">Belum ada booking sesi yang akan datang.</p>
        ) : (
          <ul className="divide-y divide-line">
            {upcoming.slice(0, 6).map(s => (
              <li key={s.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-white">{s.memberName}</span>
                  <div className="text-[11px] text-zinc-400">
                    {formatDateId(s.date)} · {s.time} WIB · {s.durationMinutes} menit
                  </div>
                  {s.notes && <p className="text-[11px] text-zinc-500 italic mt-0.5">Fokus: {s.notes}</p>}
                </div>
                <button onClick={() => setCoachTab('schedule')} className="px-3 py-2 rounded-lg bg-white text-black font-bold text-xs hover:bg-zinc-200 shrink-0 transition-colors">
                  Kelola
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
