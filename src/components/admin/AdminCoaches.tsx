import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import { rupiah } from '../../lib/finance';
import { toDateKey } from '../../lib/membership';

const field = 'bg-surface-2 border border-line-strong rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white';

export const AdminCoaches: React.FC = () => {
  const { coachProfiles, updateCoach, memberProfiles, updateMember, users, trainingSessions, showToast } = useApp();

  const coaches = Object.values(coachProfiles);
  const [selectedId, setSelectedId] = useState(coaches[0]?.userId ?? '');
  const selected = coachProfiles[selectedId] ?? coaches[0];
  // Drafts are tied to the coach they were typed for, so switching coach resets them without an effect
  const [commissionDraft, setCommissionDraft] = useState<{ id: string; value: string } | null>(null);
  const [assignDraft, setAssignDraft] = useState<{ id: string; value: string } | null>(null);
  const commission = commissionDraft?.id === selected?.userId ? commissionDraft.value : String(selected?.commissionRatePercent ?? 40);
  const assignId = assignDraft?.id === selected?.userId ? assignDraft.value : '';
  const setCommission = (value: string) => setCommissionDraft({ id: selected.userId, value });
  const setAssignId = (value: string) => setAssignDraft({ id: selected.userId, value });

  const assigned = useMemo(() => Object.values(memberProfiles).filter(p => p.assignedCoachId === selected?.userId), [memberProfiles, selected?.userId]);
  const candidates = useMemo(
    () => Object.values(memberProfiles).filter(p => p.assignedCoachId !== selected?.userId),
    [memberProfiles, selected?.userId]
  );
  const nameOf = (id: string) => users.find(u => u.id === id)?.name ?? id;

  if (!selected) return <p className="text-sm text-zinc-400">Belum ada coach terdaftar.</p>;

  const monthKey = toDateKey().slice(0, 7);
  const completedThisMonth = trainingSessions.filter(s => s.coachId === selected.userId && s.status === 'COMPLETED' && s.date.startsWith(monthKey)).length;
  const commissionNum = parseFloat(commission);
  const commissionValid = Number.isFinite(commissionNum) && commissionNum >= 10 && commissionNum <= 90;

  const report = (res: { success: boolean; message: string }, okMessage: string, type: 'success' | 'info' = 'success') =>
    showToast(res.success ? okMessage : res.message, res.success ? type : 'error');

  const saveCommission = async () => {
    if (!commissionValid) return showToast('Komisi harus antara 10% dan 90%.', 'error');
    const res = await updateCoach(selected.userId, { commissionRatePercent: Math.round(commissionNum), version: selected.version });
    report(res, `Komisi ${selected.fullName.split(',')[0]} menjadi ${Math.round(commissionNum)}%.`);
  };

  const togglePublic = async () => {
    const next = !selected.isPublicApproved;
    const res = await updateCoach(selected.userId, { isPublicApproved: next, version: selected.version });
    report(res, next ? 'Profil coach tampil di situs publik.' : 'Profil coach disembunyikan dari situs publik.', 'info');
  };

  const assign = async () => {
    if (!assignId) return;
    const res = await updateMember(assignId, { assignedCoachId: selected.userId, version: memberProfiles[assignId]?.version });
    report(res, `${nameOf(assignId)} ditugaskan ke ${selected.fullName.split(',')[0]}.`);
    if (res.success) setAssignDraft(null);
  };

  const unassign = async (memberId: string) => {
    const res = await updateMember(memberId, { assignedCoachId: null, version: memberProfiles[memberId]?.version });
    report(res, `${nameOf(memberId)} dilepas dari coach.`, 'info');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold uppercase text-white">Manajemen coach</h1>
        <p className="text-xs text-zinc-400 mt-1">Atur komisi bagi hasil, penugasan klien 1-on-1, dan tampilan profil di situs publik.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ul className="space-y-3">
          {coaches.map(c => {
            const isSel = selected.userId === c.userId;
            const count = Object.values(memberProfiles).filter(p => p.assignedCoachId === c.userId).length;
            return (
              <li key={c.userId}>
                <button
                  onClick={() => setSelectedId(c.userId)}
                  aria-current={isSel ? 'true' : undefined}
                  className={`w-full text-left p-3.5 rounded-xl border transition-colors flex items-center gap-3 ${isSel ? 'bg-surface-2 border-white' : 'bg-surface border-line hover:border-line-strong'}`}
                >
                  <img src={c.photoUrl} alt="" className="w-12 h-12 rounded-xl object-cover object-top bg-zinc-800 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="font-bold text-white text-xs truncate block">{c.fullName}</span>
                    <span className="text-[10px] text-zinc-400 truncate block">{c.title}</span>
                    <span className="flex items-center justify-between text-[10px] text-zinc-500 mt-1 font-mono">
                      <span>{count} klien</span>
                      <span>Komisi {c.commissionRatePercent}%</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="md:col-span-2 space-y-6 min-w-0">
          <section className="bg-surface rounded-2xl border border-line p-6 space-y-5 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
              <div>
                <h2 className="text-lg font-bold text-white">{selected.fullName}</h2>
                <p className="text-xs text-zinc-400">{selected.title}</p>
              </div>
              <button
                onClick={togglePublic}
                aria-pressed={selected.isPublicApproved}
                className={`px-3.5 py-2 rounded-lg border text-[11px] font-bold transition-colors self-start ${
                  selected.isPublicApproved ? 'bg-emerald-950 text-emerald-300 border-emerald-800 hover:border-emerald-600' : 'bg-surface-2 text-zinc-300 border-line-strong hover:border-white'
                }`}
              >
                {selected.isPublicApproved ? 'Tampil di situs publik' : 'Disembunyikan dari publik'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { l: 'Rating', v: selected.rating === null ? 'Belum ada' : `${selected.rating} (${selected.reviewCount})` },
                { l: 'Sesi selesai bulan ini', v: String(completedThisMonth) },
                { l: 'Tarif / sesi', v: rupiah(selected.pricePerSession) },
              ].map(i => (
                <div key={i.l} className="p-3 rounded-xl bg-surface-2 border border-line">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">{i.l}</span>
                  <span className="text-sm font-bold text-white">{i.v}</span>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-surface-2 border border-line space-y-2">
              <label htmlFor="commission" className="font-bold text-white block">
                Komisi personal training
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input id="commission" type="number" min="10" max="90" value={commission} onChange={e => setCommission(e.target.value)} className={`${field} w-24 font-mono font-bold`} aria-invalid={!commissionValid} />
                <span className="text-zinc-400">% dari tarif sesi</span>
                <button onClick={saveCommission} disabled={!commissionValid || commissionNum === selected.commissionRatePercent} className="px-4 py-2.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Simpan
                </button>
              </div>
              {!commissionValid && <p role="alert" className="text-rose-400">Isi angka antara 10 dan 90.</p>}
            </div>

            <div className="space-y-3 pt-1">
              <h3 className="font-bold text-white">Klien yang ditangani ({assigned.length})</h3>
              {assigned.length === 0 ? (
                <p className="text-zinc-500 py-2">Belum ada klien yang ditugaskan.</p>
              ) : (
                <ul className="space-y-2">
                  {assigned.map(m => {
                    const u = users.find(x => x.id === m.userId);
                    return (
                      <li key={m.userId} className="p-3 rounded-lg bg-surface-2 border border-line flex items-center justify-between gap-3">
                        <span className="flex items-center gap-3 min-w-0">
                          <Avatar name={u?.name ?? '?'} src={u?.avatarUrl} size={30} />
                          <span className="min-w-0">
                            <span className="font-bold text-white block truncate">{u?.name}</span>
                            <span className="text-[11px] text-zinc-400 block truncate">
                              {m.fitnessGoal} · {m.ptSessionsRemaining} sesi sisa
                            </span>
                          </span>
                        </span>
                        <button onClick={() => unassign(m.userId)} className="text-xs text-rose-400 hover:underline shrink-0">
                          Lepas
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="pt-4 border-t border-line space-y-2">
              <label htmlFor="assign-member" className="font-bold text-white block">
                Tugaskan klien ke coach ini
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select id="assign-member" value={assignId} onChange={e => setAssignId(e.target.value)} className={`${field} flex-1`}>
                  <option value="">Pilih member…</option>
                  {candidates.map(m => {
                    const current = m.assignedCoachId ? coachProfiles[m.assignedCoachId]?.fullName : null;
                    return (
                      <option key={m.userId} value={m.userId}>
                        {nameOf(m.userId)}
                        {current ? ` (saat ini: ${current})` : ''}
                      </option>
                    );
                  })}
                </select>
                <button onClick={assign} disabled={!assignId} className="px-5 py-2.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Tugaskan
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
