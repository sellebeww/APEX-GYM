import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  QrCode,
  Dumbbell,
  Calendar,
  Apple,
  Flame,
  Clock,
  ArrowRight,
  AlertCircle,
  Bell,
  Ticket,
  Calculator,
  Gift,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { GymCrowdMeter } from '../common/GymCrowdMeter';
import { MemberDailyHabits } from './MemberDailyHabits';
import { WorkoutFocusAudio } from '../common/WorkoutFocusAudio';
import { formatDateId, getDaysRemaining, toDateKey } from '../../lib/membership';
import { isAnnouncementVisible } from '../../lib/announcements';

const MONTHLY_VISIT_TARGET = 16;

const cardClass = 'p-6 rounded-2xl bg-surface border border-line hover:border-line-strong transition-colors';
const labelClass = 'text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500';

export const MemberDashboard: React.FC = () => {
  const {
    currentUser,
    currentRole,
    memberProfiles,
    membershipPlans,
    workoutLogs,
    trainingSessions,
    announcements,
    setMemberTab,
  } = useApp();

  const profile = currentUser ? memberProfiles[currentUser.id] : null;
  const isExpired = !profile || profile.status === 'EXPIRED';
  const isExpiringSoon = profile?.status === 'EXPIRING_SOON';
  const daysRemaining = getDaysRemaining(profile?.endDate);
  const renewPlan = membershipPlans.find(p => p.id === profile?.planId) ?? membershipPlans.find(p => p.id === 'plan-1m');

  const todayKey = toDateKey();
  const monthLabel = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const visits = profile?.visitsThisMonth || 0;
  const visitPct = Math.min(100, Math.round((visits / MONTHLY_VISIT_TARGET) * 100));

  const latestLog = useMemo(
    () =>
      workoutLogs
        .filter(l => l.memberId === currentUser?.id)
        .toSorted((a, b) => b.date.localeCompare(a.date))[0],
    [workoutLogs, currentUser?.id]
  );
  const nextSession = useMemo(
    () =>
      trainingSessions
        .filter(s => s.memberId === currentUser?.id && s.status === 'SCHEDULED' && s.date >= todayKey)
        .toSorted((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0],
    [trainingSessions, currentUser?.id, todayKey]
  );
  const activeAnnouncements = announcements.filter(a => isAnnouncementVisible(a, currentRole));

  const firstName = currentUser?.name.split(' ')[0] ?? 'Member';

  const quickActions: { tab: string; label: string; hint: string; icon: LucideIcon }[] = [
    { tab: 'qr', label: 'Kartu QR', hint: 'Masuk gym', icon: QrCode },
    { tab: 'classes', label: 'Kelas Studio', hint: 'Booking slot', icon: Ticket },
    { tab: 'workout-log', label: 'Catat Beban', hint: 'Log repetisi', icon: Dumbbell },
    { tab: 'tools', label: 'Kalkulator 1RM', hint: 'Hitung beban', icon: Calculator },
    { tab: 'program', label: 'Menu Diet', hint: 'Target makro', icon: Apple },
    { tab: 'referral', label: 'Poin Hadiah', hint: 'Klaim reward', icon: Gift },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className={labelClass}>
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold uppercase text-white mt-1">Halo, {firstName}</h1>
        </div>
        <button
          onClick={() => setMemberTab('qr')}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black text-sm font-bold hover:bg-zinc-200 transition-colors"
        >
          <QrCode className="w-4 h-4" />
          Buka QR Masuk
        </button>
      </header>

      {isExpired && (
        <div role="alert" className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800 text-rose-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">{profile?.suspended ? 'Keanggotaan Anda ditangguhkan' : 'Membership Anda telah kedaluwarsa'}</p>
              <p className="text-xs text-rose-200/80">
                {profile?.suspended
                  ? 'Akses QR dinonaktifkan. Hubungi resepsionis APEX Gym untuk mengaktifkan kembali.'
                  : 'Akses QR gym dinonaktifkan. Perpanjang sekarang untuk terus berlatih.'}
              </p>
            </div>
          </div>
          {!profile?.suspended && (
            <button
              onClick={() => setMemberTab('membership')}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 transition-colors"
            >
              Perpanjang Paket
            </button>
          )}
        </div>
      )}

      {isExpiringSoon && (
        <div role="alert" className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800 text-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">
                {daysRemaining === 0 ? 'Masa aktif berakhir hari ini' : `Masa aktif berakhir dalam ${daysRemaining} hari`}
              </p>
              <p className="text-xs text-amber-200/80">Perpanjang sebelum habis, sisa hari aktif akan otomatis ditambahkan.</p>
            </div>
          </div>
          <button
            onClick={() => setMemberTab('membership')}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shrink-0 transition-colors"
          >
            Perpanjang{renewPlan ? ` (Rp ${renewPlan.price.toLocaleString('id-ID')})` : ''}
          </button>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${cardClass} sm:col-span-2 flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className={labelClass}>Status membership</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  isExpired
                    ? 'bg-rose-950 text-rose-300 border-rose-800'
                    : isExpiringSoon
                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                }`}
              >
                {isExpired ? 'Kedaluwarsa' : isExpiringSoon ? 'Segera habis' : 'Aktif'}
              </span>
            </div>
            <h3 className="text-xl font-bold text-white">{profile?.planName || 'Belum ada paket'}</h3>
            <p className="text-xs text-zinc-400 mt-1">
              {isExpired ? 'Berakhir' : 'Berlaku s/d'}{' '}
              <strong className="text-zinc-200 font-mono">{formatDateId(profile?.endDate)}</strong>
              {!isExpired && <span> ({daysRemaining} hari lagi)</span>}
            </p>
          </div>
          <div className="pt-4 border-t border-line flex items-center justify-between mt-5 text-xs">
            <button onClick={() => setMemberTab('qr')} className="font-bold text-white hover:underline inline-flex items-center gap-1.5">
              <QrCode className="w-4 h-4" /> QR gerbang masuk
            </button>
            <button onClick={() => setMemberTab('membership')} className="text-zinc-400 hover:text-white inline-flex items-center gap-1">
              Detail paket <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className={`${cardClass} flex flex-col justify-between`}>
          <div>
            <span className={`${labelClass} block`}>Kunjungan gym</span>
            <div className="text-3xl font-black text-white mt-2 font-tabular">
              {visits}
              <span className="text-xs font-normal text-zinc-500 ml-1.5 font-sans">dari {MONTHLY_VISIT_TARGET}x</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 capitalize">{monthLabel}</p>
          </div>
          <div className="mt-4">
            <div
              role="progressbar"
              aria-label="Progres target kunjungan bulanan"
              aria-valuenow={visitPct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1.5 rounded-full bg-black/60 border border-line overflow-hidden"
            >
              <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${visitPct}%` }} />
            </div>
            <p className="text-[11px] text-zinc-500 mt-2">{visitPct}% dari target bulanan</p>
          </div>
        </div>

        <div className={`${cardClass} flex flex-col justify-between`}>
          <div>
            <span className={`${labelClass} block`}>Workout streak</span>
            <div className="text-3xl font-black text-white mt-2 flex items-center gap-2 font-tabular">
              <Flame className="w-6 h-6 text-amber-400 fill-amber-400/30 animate-flame" aria-hidden />
              {profile?.workoutStreak || 0}
              <span className="text-xs font-normal text-zinc-500 font-sans">hari</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              {(profile?.workoutStreak || 0) > 0 ? 'Konsistensi terjaga' : 'Mulai latihan hari ini'}
            </p>
          </div>
          <div className="pt-3 mt-4 border-t border-line text-[11px] text-zinc-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Sisa sesi PT: <strong className="text-white">{profile?.ptSessionsRemaining ?? 0}</strong>
          </div>
        </div>
      </div>

      <GymCrowdMeter compact />

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {quickActions.map(a => {
          const Icon = a.icon;
          return (
            <button
              key={a.tab}
              onClick={() => setMemberTab(a.tab)}
              className="p-3.5 rounded-xl bg-surface border border-line hover:border-white transition-colors flex items-center gap-3 text-left group"
            >
              <span className="p-2 rounded-lg bg-white/10 text-white group-hover:bg-white group-hover:text-black transition-colors">
                <Icon className="w-4 h-4" />
              </span>
              <span className="min-w-0">
                <span className="text-xs font-bold text-white block truncate">{a.label}</span>
                <span className="text-[10px] text-zinc-500 block truncate">{a.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <MemberDailyHabits />
      <WorkoutFocusAudio />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className={`${cardClass} space-y-3`}>
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-300 flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-zinc-400" />
              Sesi latihan terakhir
            </h2>
            <button onClick={() => setMemberTab('workout-log')} className="text-[11px] text-zinc-400 hover:text-white">
              Lihat semua
            </button>
          </div>
          {latestLog ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-white text-sm">{latestLog.title}</span>
                <span className="font-mono text-white font-bold shrink-0">{latestLog.totalVolumeKg.toLocaleString('id-ID')} kg</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                {formatDateId(latestLog.date)} · {latestLog.durationMinutes} menit
              </p>
              {latestLog.coachFeedback && (
                <div className="p-3 rounded-lg bg-surface-2 border border-line text-[11px] text-zinc-300">
                  <strong className="text-white">Komentar coach:</strong> {latestLog.coachFeedback}
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-xs text-zinc-400 mb-3">Belum ada latihan yang dicatat.</p>
              <button onClick={() => setMemberTab('workout-log')} className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-zinc-200">
                Catat latihan pertama
              </button>
            </div>
          )}
        </section>

        <section className={`${cardClass} space-y-3`}>
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-300 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-zinc-400" />
              Sesi PT berikutnya
            </h2>
            <button onClick={() => setMemberTab('coaching')} className="text-[11px] text-zinc-400 hover:text-white">
              Booking baru
            </button>
          </div>
          {nextSession ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-white text-sm">
                  {new Date(`${nextSession.date}T00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
                </span>
                <span className="font-mono text-white font-bold bg-white/10 px-2 py-0.5 rounded">{nextSession.time} WIB</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Bersama <strong className="text-zinc-200">{nextSession.coachName}</strong> · 60 menit
              </p>
              {nextSession.notes && <p className="text-[11px] text-zinc-500 italic">"{nextSession.notes}"</p>}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-xs text-zinc-400 mb-3">Tidak ada sesi PT terjadwal.</p>
              <button onClick={() => setMemberTab('coaching')} className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-zinc-200">
                Pilih slot coach
              </button>
            </div>
          )}
        </section>
      </div>

      {activeAnnouncements.length > 0 && (
        <section className={`${cardClass} space-y-4`}>
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-300 flex items-center gap-2">
            <Bell className="w-4 h-4 text-zinc-400" />
            Pengumuman dari manajemen gym
          </h2>
          <div className="space-y-3">
            {activeAnnouncements.slice(0, 3).map(ann => (
              <div key={ann.id} className="p-4 rounded-xl bg-surface-2 border border-line text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-white">{ann.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 shrink-0">{ann.type.replace('_', ' ')}</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">{ann.content}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
