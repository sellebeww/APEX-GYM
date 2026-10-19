import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, Download, KeyRound, Users } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Modal } from '../common/Modal';
import { downloadCsv } from '../../lib/finance';
import { formatDateId, getDaysRemaining, toDateKey } from '../../lib/membership';
import type { MembershipStatus, User } from '../../types';

const FILTERS: { id: 'ALL' | MembershipStatus; label: string }[] = [
  { id: 'ALL', label: 'Semua' },
  { id: 'ACTIVE', label: 'Aktif' },
  { id: 'EXPIRING_SOON', label: 'Segera habis' },
  { id: 'EXPIRED', label: 'Kedaluwarsa' },
];

const STATUS_CHIP: Record<MembershipStatus, { label: string; cls: string }> = {
  ACTIVE: { label: 'Aktif', cls: 'bg-emerald-950 text-emerald-300 border-emerald-800' },
  EXPIRING_SOON: { label: 'Segera habis', cls: 'bg-amber-950 text-amber-300 border-amber-800' },
  EXPIRED: { label: 'Kedaluwarsa', cls: 'bg-rose-950 text-rose-300 border-rose-800' },
};

const actionBtn = 'px-3 py-2 rounded-lg border border-line-strong hover:border-white text-zinc-200 hover:text-white font-semibold text-[11px] transition-colors';

export const AdminMembers: React.FC = () => {
  const { users, memberProfiles, updateMember, resetUserPassword, coachProfiles, showToast } = useApp();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | MembershipStatus>('ALL');
  const [suspendTarget, setSuspendTarget] = useState<User | null>(null);
  const [extendTarget, setExtendTarget] = useState<User | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [tempPassword, setTempPassword] = useState<{ name: string; password: string } | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busy, setBusy] = useState(false);

  const q = search.trim().toLowerCase();
  const members = useMemo(
    () =>
      users
        .filter(u => u.role === 'MEMBER')
        .filter(u => {
          const p = memberProfiles[u.id];
          const matchesSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '§');
          return matchesSearch && (filter === 'ALL' || p?.status === filter);
        })
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [users, memberProfiles, q, filter]
  );
  const counts = useMemo(() => {
    const all = users.filter(u => u.role === 'MEMBER');
    const by = (s: MembershipStatus) => all.filter(u => memberProfiles[u.id]?.status === s).length;
    return { ALL: all.length, ACTIVE: by('ACTIVE'), EXPIRING_SOON: by('EXPIRING_SOON'), EXPIRED: by('EXPIRED') };
  }, [users, memberProfiles]);

  const report = (res: { success: boolean; message: string }, okType: 'success' | 'info' = 'success') => showToast(res.message, res.success ? okType : 'error');

  const submitExtend = async () => {
    if (!extendTarget) return;
    const p = memberProfiles[extendTarget.id];
    if (reason.trim().length < 3) return setReasonError('Tuliskan alasan (min. 3 karakter) untuk catatan audit.');
    setBusy(true);
    const res = await updateMember(extendTarget.id, { extendDays: 30, reason: reason.trim(), version: p?.version });
    setBusy(false);
    report(res);
    if (res.success) {
      setExtendTarget(null);
      setReason('');
      setReasonError('');
    }
  };

  const toggleSuspend = async (user: User) => {
    const p = memberProfiles[user.id];
    if (!p) return;
    const res = await updateMember(user.id, { suspended: !p.suspended, version: p.version });
    report(res, 'info');
    setSuspendTarget(null);
  };

  const assignCoach = async (user: User, coachId: string) => {
    const res = await updateMember(user.id, { assignedCoachId: coachId || null, version: memberProfiles[user.id]?.version });
    report(res);
  };

  const resetPassword = async (user: User) => {
    const res = await resetUserPassword(user.id);
    if (res.success && res.data) setTempPassword({ name: user.name, password: res.data.temporaryPassword });
    else report(res);
    setResetTarget(null);
  };

  const exportCsv = () => {
    downloadCsv(`daftar-member-apex-${toDateKey()}.csv`, [
      ['ID', 'Nama', 'Email', 'Telepon', 'Status', 'Paket', 'Berlaku s/d', 'Sisa sesi PT', 'Coach'],
      ...members.map(m => {
        const p = memberProfiles[m.id];
        return [m.id, m.name, m.email, m.phone, p?.status ?? '-', p?.planName ?? '-', p?.endDate ?? '-', p?.ptSessionsRemaining ?? 0, p?.assignedCoachId ? coachProfiles[p.assignedCoachId]?.fullName ?? '-' : 'Mandiri'];
      }),
    ]);
    showToast(`${members.length} member diekspor.`, 'success');
  };

  const coaches = Object.values(coachProfiles);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold uppercase text-white">Manajemen member</h1>
          <p className="text-xs text-zinc-400 mt-1">Kelola masa aktif, penangguhan, penugasan coach, dan ekspor data.</p>
        </div>
        <button onClick={exportCsv} disabled={members.length === 0} className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-xs font-bold text-black transition-colors flex items-center gap-1.5 self-start disabled:opacity-40">
          <Download className="w-4 h-4" /> Ekspor CSV ({members.length})
        </button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden />
          <input
            type="search"
            aria-label="Cari member"
            placeholder="Cari nama, email, atau nomor HP"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-surface border border-line rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter status">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${filter === f.id ? 'bg-white text-black border-white' : 'bg-surface border-line text-zinc-400 hover:text-white hover:border-line-strong'}`}
            >
              {f.label} <span className="opacity-80 font-mono">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-line overflow-hidden">
        <div className="p-4 border-b border-line text-xs text-zinc-400">
          {members.length} member · diurutkan dari pendaftar terbaru
        </div>

        {members.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-9 h-9 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-400">Tidak ada member yang cocok dengan pencarian atau filter.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {members.map(m => {
              const p = memberProfiles[m.id];
              const chip = p ? STATUS_CHIP[p.status] : STATUS_CHIP.EXPIRED;
              return (
                <li key={m.id} className="p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 text-xs">
                  <div className="flex items-start gap-3 min-w-0">
                    <Avatar name={m.name} src={m.avatarUrl} size={38} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm truncate">{m.name}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${chip.cls}`}>{p?.suspended ? 'Ditangguhkan' : chip.label}</span>
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5 break-all">
                        {m.email} · {m.phone}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-1">
                        {p?.planName ?? 'Tanpa paket'}
                        {p && p.status !== 'EXPIRED' && ` · ${getDaysRemaining(p.endDate)} hari lagi`} · berlaku s/d {formatDateId(p?.endDate, 'short')} · sesi PT {p?.ptSessionsRemaining ?? 0}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <label className="sr-only" htmlFor={`coach-${m.id}`}>Coach untuk {m.name}</label>
                    <select
                      id={`coach-${m.id}`}
                      value={p?.assignedCoachId ?? ''}
                      onChange={e => assignCoach(m, e.target.value)}
                      className="bg-surface-2 border border-line-strong rounded-lg px-2.5 py-2 text-[11px] text-white focus:outline-none focus:border-white max-w-[11rem]"
                    >
                      <option value="">Mandiri (tanpa coach)</option>
                      {coaches.map(c => (
                        <option key={c.userId} value={c.userId}>
                          {c.fullName}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => setExtendTarget(m)} className={actionBtn} title="Perpanjang 30 hari">
                      +30 hari
                    </button>
                    <button onClick={() => (p?.suspended ? toggleSuspend(m) : setSuspendTarget(m))} className={actionBtn}>
                      {p?.suspended ? 'Aktifkan' : 'Tangguhkan'}
                    </button>
                    <button onClick={() => setResetTarget(m)} aria-label={`Reset password ${m.name}`} title="Reset password" className={`${actionBtn} !px-2.5`}>
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!suspendTarget}
        title="Tangguhkan keanggotaan?"
        danger
        confirmLabel="Ya, tangguhkan"
        message={suspendTarget && `${suspendTarget.name} tidak akan bisa masuk gym dan booking kelas/sesi sampai Anda mengaktifkannya kembali. Sisa masa aktif tidak berubah.`}
        onConfirm={() => suspendTarget && toggleSuspend(suspendTarget)}
        onCancel={() => setSuspendTarget(null)}
      />

      <ConfirmDialog
        isOpen={!!resetTarget}
        title="Reset password?"
        confirmLabel="Ya, buat password sementara"
        message={resetTarget && `Password lama ${resetTarget.name} langsung tidak berlaku dan semua sesi login dikeluarkan. Password sementara hanya ditampilkan sekali.`}
        onConfirm={() => resetTarget && resetPassword(resetTarget)}
        onCancel={() => setResetTarget(null)}
      />

      <Modal isOpen={!!extendTarget} onClose={() => setExtendTarget(null)} label="Perpanjang masa aktif" maxWidth="max-w-sm">
        <form
          className="p-6 space-y-4"
          onSubmit={e => {
            e.preventDefault();
            void submitExtend();
          }}
        >
          <h2 className="text-base font-bold text-white">Perpanjang 30 hari</h2>
          <p className="text-xs text-zinc-400">{extendTarget?.name}. Perpanjangan gratis dicatat di audit log beserta alasannya.</p>
          <div>
            <label htmlFor="extend-reason" className="block text-zinc-400 text-xs font-semibold mb-1.5">Alasan</label>
            <input id="extend-reason" value={reason} maxLength={300} onChange={e => setReason(e.target.value)} aria-invalid={!!reasonError} className="w-full bg-surface-2 border border-line-strong rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white" />
            {reasonError && <p role="alert" className="text-xs text-rose-400 mt-1.5">{reasonError}</p>}
          </div>
          <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-white text-black text-xs font-bold hover:bg-zinc-200 disabled:opacity-40">
            {busy ? 'Menyimpan…' : 'Perpanjang'}
          </button>
        </form>
      </Modal>

      <Modal isOpen={!!tempPassword} onClose={() => setTempPassword(null)} label="Password sementara" maxWidth="max-w-sm">
        <div className="p-6 space-y-4">
          <h2 className="text-base font-bold text-white">Password sementara</h2>
          <p className="text-xs text-zinc-400">Berikan ke {tempPassword?.name} secara langsung. Password ini tidak akan ditampilkan lagi dan wajib diganti saat login.</p>
          <p className="font-mono text-lg text-white bg-surface-2 border border-line-strong rounded-lg px-3 py-3 select-all break-all">{tempPassword?.password}</p>
        </div>
      </Modal>
    </div>
  );
};
