import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Users, Search, ShieldCheck, AlertTriangle, Trophy } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { ChatThread } from '../common/ChatThread';
import { formatDateId, getDaysRemaining } from '../../lib/membership';

type ClientTab = 'overview' | 'workouts' | 'checkins' | 'photos' | 'chat';

const STATUS_CHIP = {
  ACTIVE: { label: 'Aktif', cls: 'bg-emerald-950 text-emerald-300 border-emerald-800' },
  EXPIRING_SOON: { label: 'Segera habis', cls: 'bg-amber-950 text-amber-300 border-amber-800' },
  EXPIRED: { label: 'Kedaluwarsa', cls: 'bg-rose-950 text-rose-300 border-rose-800' },
} as const;

const replyInput =
  'flex-1 bg-surface-2 border border-line-strong rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white';

export const CoachClients: React.FC = () => {
  const {
    currentUser,
    memberProfiles,
    users,
    workoutLogs,
    weeklyCheckIns,
    progressPhotos,
    chatMessages,
    sendChatMessage,
    addCoachCommentToWorkout,
    replyWeeklyCheckIn,
    showToast,
  } = useApp();

  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [tab, setTab] = useState<ClientTab>('overview');
  const [workoutComment, setWorkoutComment] = useState<Record<string, string>>({});
  const [checkInReply, setCheckInReply] = useState<Record<string, string>>({});

  // Strictly the clients assigned to this coach
  const allClients = useMemo(
    () =>
      Object.values(memberProfiles)
        .filter(p => p.assignedCoachId === currentUser?.id)
        .map(p => ({ profile: p, user: users.find(u => u.id === p.userId) }))
        .filter(c => c.user),
    [memberProfiles, users, currentUser?.id]
  );
  const visibleClients = allClients.filter(c => c.user!.name.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = allClients.find(c => c.profile.userId === selectedClientId) ?? allClients[0];
  const clientId = selected?.profile.userId ?? '';

  // Keep the selection valid when the coach changes or clients change
  useEffect(() => {
    if (!allClients.some(c => c.profile.userId === selectedClientId)) setSelectedClientId(allClients[0]?.profile.userId ?? '');
  }, [allClients, selectedClientId]);

  const logs = useMemo(() => workoutLogs.filter(l => l.memberId === clientId).toSorted((a, b) => b.date.localeCompare(a.date)), [workoutLogs, clientId]);
  const checkins = useMemo(() => weeklyCheckIns.filter(c => c.memberId === clientId).toSorted((a, b) => b.date.localeCompare(a.date)), [weeklyCheckIns, clientId]);
  const photos = useMemo(() => progressPhotos.filter(p => p.memberId === clientId).toSorted((a, b) => b.date.localeCompare(a.date)), [progressPhotos, clientId]);
  const thread = useMemo(
    () => chatMessages.filter(m => m.threadMemberId === clientId).toSorted((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [chatMessages, clientId]
  );

  const sendWorkoutFeedback = (logId: string) => {
    const text = workoutComment[logId]?.trim();
    if (!text) return;
    addCoachCommentToWorkout(logId, text);
    setWorkoutComment(prev => ({ ...prev, [logId]: '' }));
    showToast('Komentar disimpan dan tampil di aplikasi klien.', 'success');
  };

  const sendCheckInReply = (id: string) => {
    const text = checkInReply[id]?.trim();
    if (!text) return;
    replyWeeklyCheckIn(id, text);
    setCheckInReply(prev => ({ ...prev, [id]: '' }));
    showToast('Balasan check-in terkirim.', 'success');
  };

  const tabs: { id: ClientTab; label: string }[] = [
    { id: 'overview', label: 'Ringkasan' },
    { id: 'workouts', label: `Workout (${logs.length})` },
    { id: 'checkins', label: `Check-in (${checkins.length})` },
    { id: 'photos', label: `Foto (${photos.length})` },
    { id: 'chat', label: 'Chat' },
  ];

  if (allClients.length === 0) {
    return (
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-extrabold uppercase text-white mb-6">Manajemen klien</h1>
        <div className="bg-surface rounded-2xl border border-line p-12 text-center">
          <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h2 className="text-sm font-bold text-white mb-1">Belum ada klien asuhan</h2>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">Klien akan muncul di sini setelah member membooking sesi PT dengan Anda.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold uppercase text-white">Manajemen klien</h1>
        <p className="text-xs text-zinc-400 mt-1">Data fisik dan foto progres bersifat privat: hanya coach dan klien yang bersangkutan.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden />
            <input
              type="search"
              aria-label="Cari klien"
              placeholder="Cari klien"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-surface border border-line rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white"
            />
          </div>

          <ul className="space-y-2">
            {visibleClients.length === 0 && <li className="text-xs text-zinc-500 text-center py-6">Tidak ada klien yang cocok.</li>}
            {visibleClients.map(c => {
              const isSelected = clientId === c.profile.userId;
              const chip = STATUS_CHIP[c.profile.status];
              return (
                <li key={c.profile.userId}>
                  <button
                    onClick={() => setSelectedClientId(c.profile.userId)}
                    aria-current={isSelected ? 'true' : undefined}
                    className={`w-full text-left p-3.5 rounded-xl border transition-colors ${
                      isSelected ? 'bg-surface-2 border-white' : 'bg-surface border-line hover:border-line-strong'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar name={c.user!.name} src={c.user!.avatarUrl} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-white truncate">{c.user!.name}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${chip.cls}`}>{chip.label}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate">{c.profile.fitnessGoal}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                      <span>{c.profile.visitsThisMonth}x kunjungan</span>
                      <span>{c.profile.ptSessionsRemaining} sesi PT</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {selected && (
          <div className="md:col-span-2 space-y-6 min-w-0">
            <div className="bg-surface rounded-2xl border border-line p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-line">
                <div>
                  <h2 className="text-lg font-bold text-white">{selected.user!.name}</h2>
                  <p className="text-xs text-zinc-400">{selected.profile.fitnessGoal}</p>
                </div>
                <div className="text-right font-mono text-xs">
                  <span className="text-zinc-500 block">Sisa sesi PT</span>
                  <span className="text-white font-bold text-sm">{selected.profile.ptSessionsRemaining}</span>
                </div>
              </div>

              {selected.profile.healthNotes && (
                <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-200 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-amber-300 mb-0.5">Catatan kesehatan / batasan gerak</strong>
                    {selected.profile.healthNotes}
                  </div>
                </div>
              )}

              <div role="tablist" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                {tabs.map(t => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${tab === t.id ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {tab === 'overview' && (
              <div className="bg-surface rounded-2xl border border-line p-6 space-y-4 text-xs">
                <h3 className="font-bold text-white text-sm">Kebugaran & kehadiran</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-tabular">
                  {[
                    { l: 'Streak latihan', v: `${selected.profile.workoutStreak} hari` },
                    { l: 'Kunjungan bulan ini', v: `${selected.profile.visitsThisMonth} kali` },
                    { l: 'Paket membership', v: selected.profile.planName },
                    {
                      l: 'Berlaku hingga',
                      v: `${formatDateId(selected.profile.endDate)}${selected.profile.status === 'EXPIRED' ? '' : ` (${getDaysRemaining(selected.profile.endDate)} hari)`}`,
                    },
                  ].map(i => (
                    <div key={i.l} className="p-3.5 rounded-xl bg-surface-2 border border-line">
                      <span className="text-zinc-500 block text-[10px] uppercase font-bold tracking-wider">{i.l}</span>
                      <span className="text-sm font-bold text-white">{i.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'workouts' && (
              <div className="space-y-4">
                {logs.length === 0 && <p className="text-xs text-zinc-500 text-center py-10 bg-surface rounded-2xl border border-line">Klien belum mencatat latihan.</p>}
                {logs.map(log => (
                  <article key={log.id} className="p-5 rounded-2xl bg-surface border border-line space-y-3 text-xs">
                    <div className="flex items-start justify-between gap-3 pb-2 border-b border-line">
                      <div>
                        <span className="font-bold text-sm text-white">{log.title}</span>
                        <div className="text-[11px] text-zinc-400">
                          {formatDateId(log.date)} · {log.durationMinutes} menit · <strong className="text-white font-mono">{log.totalVolumeKg.toLocaleString('id-ID')} kg</strong>
                        </div>
                      </div>
                      {log.prAchieved && (
                        <span className="px-2 py-0.5 rounded bg-amber-400 text-black font-extrabold text-[10px] inline-flex items-center gap-1 shrink-0">
                          <Trophy className="w-3 h-3" /> PR
                        </span>
                      )}
                    </div>
                    <ul className="space-y-1.5">
                      {log.exercises.map((e, idx) => (
                        <li key={idx} className="flex items-center justify-between gap-3 text-zinc-300">
                          <span>{e.exerciseName}</span>
                          <span className="font-mono text-zinc-400 shrink-0">
                            {e.sets.length} set · maks {e.sets.length ? Math.max(...e.sets.map(s => s.weightKg)) : 0} kg
                          </span>
                        </li>
                      ))}
                    </ul>
                    {log.coachFeedback ? (
                      <div className="p-3 rounded-xl bg-surface-2 border border-line-strong text-zinc-200">
                        <strong>Feedback Anda:</strong> "{log.coachFeedback}"
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-line flex items-center gap-2">
                        <input
                          type="text"
                          aria-label="Komentar untuk sesi ini"
                          placeholder="Komentar atau tips perbaikan form"
                          value={workoutComment[log.id] || ''}
                          onChange={e => setWorkoutComment({ ...workoutComment, [log.id]: e.target.value })}
                          className={replyInput}
                        />
                        <button onClick={() => sendWorkoutFeedback(log.id)} disabled={!workoutComment[log.id]?.trim()} className="px-4 py-2 rounded-lg bg-white text-black font-bold text-xs disabled:opacity-40">
                          Kirim
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}

            {tab === 'checkins' && (
              <div className="space-y-4">
                {checkins.length === 0 && <p className="text-xs text-zinc-500 text-center py-10 bg-surface rounded-2xl border border-line">Belum ada check-in mingguan.</p>}
                {checkins.map(ci => (
                  <article key={ci.id} className="p-5 rounded-2xl bg-surface border border-line space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-line">
                      <span className="font-bold text-white text-sm">Laporan {formatDateId(ci.date)}</span>
                      <div className="font-mono text-zinc-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>BB <strong className="text-white">{ci.weightKg} kg</strong></span>
                        <span>Energi {ci.energyScore}/5</span>
                        <span>Tidur {ci.sleepHours} j</span>
                        <span>Diet {ci.dietAdherencePercent}%</span>
                      </div>
                    </div>
                    {ci.notes && <p className="text-zinc-300 leading-relaxed italic">"{ci.notes}"</p>}
                    {ci.coachReply ? (
                      <div className="p-3 rounded-xl bg-surface-2 border border-line-strong text-zinc-200">
                        <strong>Balasan Anda:</strong> {ci.coachReply}
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-line flex items-center gap-2">
                        <input
                          type="text"
                          aria-label="Balasan check-in"
                          placeholder="Evaluasi, saran penyesuaian beban atau kalori"
                          value={checkInReply[ci.id] || ''}
                          onChange={e => setCheckInReply({ ...checkInReply, [ci.id]: e.target.value })}
                          className={replyInput}
                        />
                        <button onClick={() => sendCheckInReply(ci.id)} disabled={!checkInReply[ci.id]?.trim()} className="px-4 py-2 rounded-lg bg-white text-black font-bold text-xs disabled:opacity-40">
                          Balas
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}

            {tab === 'photos' && (
              <div className="bg-surface rounded-2xl border border-line p-6 space-y-4">
                <div className="flex items-center gap-2 text-xs text-zinc-300 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-zinc-400" /> Foto privat khusus coach dan klien
                </div>
                {photos.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-8">Klien belum mengunggah foto progres.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {photos.map(p => (
                      <figure key={p.id} className="rounded-xl overflow-hidden border border-line bg-surface-2">
                        <div className="h-52 overflow-hidden">
                          <img src={p.photoUrl} alt={`Foto progres ${formatDateId(p.date)}`} loading="lazy" className="w-full h-full object-cover object-top" />
                        </div>
                        <figcaption className="p-3 text-[11px] text-zinc-300">
                          <span className="font-mono text-white font-bold block">
                            {formatDateId(p.date, 'short')}
                            {p.weightKg ? ` · ${p.weightKg} kg` : ''}
                          </span>
                          {p.notes && <p className="mt-1 text-zinc-400">{p.notes}</p>}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'chat' && (
              <ChatThread
                messages={thread}
                meId={currentUser?.id ?? ''}
                partnerName={selected.user!.name}
                partnerPhoto={selected.user!.avatarUrl}
                onSend={text => sendChatMessage(text, clientId)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
