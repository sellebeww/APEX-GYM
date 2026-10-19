import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { GroupClass } from '../../types';
import { Calendar, Users, Plus, Trash2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const CATEGORIES: GroupClass['category'][] = ['Strength', 'HIIT', 'Pilates', 'Mobility', 'Powerlifting', 'Agility'];
const INTENSITIES: GroupClass['intensity'][] = ['Sedang', 'Tinggi', 'Intens'];

const field = 'w-full bg-surface-2 border border-line-strong rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white';
const label = 'block text-zinc-400 text-xs font-semibold mb-1.5';

const emptyForm = {
  name: '',
  category: 'Strength' as GroupClass['category'],
  day: 'Senin',
  start: '07:00',
  end: '08:00',
  coachId: '',
  room: '',
  maxCapacity: '16',
  intensity: 'Sedang' as GroupClass['intensity'],
  description: '',
};

export const AdminClassSchedule: React.FC = () => {
  const { groupClasses, removeClassEnrollment, addGroupClass, deleteGroupClass, coachProfiles, users, showToast } = useApp();

  const [rosterId, setRosterId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, coachId: Object.keys(coachProfiles)[0] ?? '' });
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<GroupClass | null>(null);

  // The roster is derived from live data so removals show immediately
  const rosterClass = groupClasses.find(c => c.id === rosterId) ?? null;
  const totalEnrollments = groupClasses.reduce((acc, c) => acc + c.enrolledMemberIds.length, 0);
  const sorted = useMemo(() => [...groupClasses].toSorted((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.time.localeCompare(b.time)), [groupClasses]);
  const nameOf = (id: string) => users.find(u => u.id === id)?.name ?? id;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const capacity = parseInt(form.maxCapacity, 10);
    const coach = coachProfiles[form.coachId];
    if (form.name.trim().length < 3) return setError('Nama kelas minimal 3 karakter.');
    if (!coach) return setError('Pilih instruktur.');
    if (form.room.trim().length < 2) return setError('Isi ruangan kelas.');
    if (form.end <= form.start) return setError('Jam selesai harus setelah jam mulai.');
    if (!(capacity >= 1 && capacity <= 60)) return setError('Kapasitas harus 1–60 peserta.');
    const clash = groupClasses.find(c => c.day === form.day && c.room.toLowerCase() === form.room.trim().toLowerCase() && c.time === `${form.start} - ${form.end}`);
    if (clash) return setError(`Ruangan sudah dipakai kelas "${clash.name}" pada waktu yang sama.`);

    const res = await addGroupClass({
      name: form.name.trim(),
      category: form.category,
      dayOfWeek: (DAYS.indexOf(form.day) + 1) % 7, // DAYS starts on Monday; the API uses 0 = Sunday
      startTime: form.start,
      endTime: form.end,
      coachId: form.coachId,
      room: form.room.trim(),
      maxCapacity: capacity,
      intensity: form.intensity,
      description: form.description.trim() || 'Kelas komunitas APEX Gym.',
    });
    if (!res.success) return setError(res.message);
    showToast('Kelas baru ditambahkan ke jadwal.', 'success');
    setShowCreate(false);
    setError('');
    setForm({ ...emptyForm, coachId: form.coachId });
  };

  const removeMember = async (cls: GroupClass, memberId: string) => {
    const res = await removeClassEnrollment(cls.id, memberId);
    showToast(res.success ? `${nameOf(memberId)} dikeluarkan dari kelas.` : res.message, res.success ? 'info' : 'error');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-zinc-400" />
            <h1 className="text-2xl font-extrabold uppercase text-white">Jadwal kelas studio</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">Kelola jadwal, ruangan, instruktur, kuota, dan roster peserta.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2.5 rounded-xl bg-surface border border-line text-xs">
            <span className="text-zinc-400">Total pendaftar: </span>
            <span className="font-mono font-bold text-white">{totalEnrollments}</span>
          </div>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-colors flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Tambah kelas
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="py-16 text-center bg-surface border border-line rounded-2xl">
          <Calendar className="w-9 h-9 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-400 mb-4">Belum ada kelas terjadwal.</p>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-zinc-200">
            Tambah kelas pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sorted.map(cls => {
            const filled = cls.enrolledMemberIds.length;
            const pct = Math.round((filled / cls.maxCapacity) * 100);
            return (
              <article key={cls.id} className="p-5 rounded-2xl bg-surface border border-line flex flex-col justify-between gap-4 hover:border-line-strong transition-colors">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white uppercase tracking-wider">{cls.category}</span>
                    <span className="text-xs font-mono font-bold text-white">{cls.day}, {cls.time}</span>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">{cls.name}</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">{cls.room} · {cls.coachName}</p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Kapasitas</span>
                      <span className="font-mono text-white font-bold">{filled}/{cls.maxCapacity} ({pct}%)</span>
                    </div>
                    <div role="progressbar" aria-label="Kapasitas kelas" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-line">
                      <div className={`h-full rounded-full ${pct >= 100 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-400' : 'bg-white'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-2 border-t border-line">
                    {cls.enrolledMemberIds.slice(0, 3).map(id => (
                      <span key={id} className="px-2 py-0.5 rounded-lg bg-black/40 border border-line text-[10px] text-zinc-300">{nameOf(id)}</span>
                    ))}
                    {filled > 3 && <span className="px-2 py-0.5 rounded-lg bg-white/10 text-[10px] text-zinc-300 font-bold">+{filled - 3}</span>}
                    {filled === 0 && <span className="text-[11px] text-zinc-500">Belum ada peserta</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-3 border-t border-line">
                  <button onClick={() => setRosterId(cls.id)} className="flex-1 py-2.5 px-3 rounded-xl bg-surface-2 border border-line-strong text-xs font-bold text-white hover:border-white flex items-center justify-center gap-1.5 transition-colors">
                    <Users className="w-3.5 h-3.5" /> Roster
                  </button>
                  <button onClick={() => setDeleteTarget(cls)} aria-label={`Hapus kelas ${cls.name}`} className="p-2.5 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal isOpen={!!rosterClass} onClose={() => setRosterId(null)} label="Roster kelas studio" maxWidth="max-w-md">
        {rosterClass && (
          <div className="p-6 space-y-5">
            <div className="pr-8">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.2em] block">Roster kelas</span>
              <h2 className="text-base font-bold text-white mt-1">{rosterClass.name}</h2>
              <p className="text-xs text-zinc-400 mt-0.5">{rosterClass.day}, {rosterClass.time} · {rosterClass.coachName}</p>
            </div>
            <ul className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
              {rosterClass.enrolledMemberIds.length === 0 && <li className="text-xs text-zinc-500 py-6 text-center">Belum ada peserta.</li>}
              {rosterClass.enrolledMemberIds.map(memberId => (
                <li key={memberId} className="p-3 rounded-xl bg-black/40 border border-line flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-white text-black font-extrabold flex items-center justify-center text-xs">{nameOf(memberId).charAt(0)}</span>
                    <span>
                      <span className="font-bold text-white block">{nameOf(memberId)}</span>
                      <span className="text-[10px] font-mono text-zinc-500">{memberId}</span>
                    </span>
                  </span>
                  <button onClick={() => removeMember(rosterClass, memberId)} aria-label={`Keluarkan ${nameOf(memberId)}`} className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => setRosterId(null)} className="w-full py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors">Tutup</button>
          </div>
        )}
      </Modal>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} label="Tambah kelas baru" maxWidth="max-w-lg">
        <form onSubmit={create} className="p-6 space-y-4" noValidate>
          <h2 className="text-base font-bold text-white pr-8">Tambah kelas baru</h2>
          <div>
            <label htmlFor="cl-name" className={label}>Nama kelas</label>
            <input id="cl-name" type="text" maxLength={80} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Mis. Barbell Basics" className={field} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cl-cat" className={label}>Kategori</label>
              <select id="cl-cat" value={form.category} onChange={e => setForm({ ...form, category: e.target.value as GroupClass['category'] })} className={field}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="cl-int" className={label}>Intensitas</label>
              <select id="cl-int" value={form.intensity} onChange={e => setForm({ ...form, intensity: e.target.value as GroupClass['intensity'] })} className={field}>
                {INTENSITIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="cl-day" className={label}>Hari</label>
              <select id="cl-day" value={form.day} onChange={e => setForm({ ...form, day: e.target.value })} className={field}>
                {DAYS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="cl-start" className={label}>Mulai</label>
              <input id="cl-start" type="time" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} className={`${field} font-mono`} />
            </div>
            <div>
              <label htmlFor="cl-end" className={label}>Selesai</label>
              <input id="cl-end" type="time" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} className={`${field} font-mono`} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label htmlFor="cl-coach" className={label}>Instruktur</label>
              <select id="cl-coach" value={form.coachId} onChange={e => setForm({ ...form, coachId: e.target.value })} className={field}>
                {Object.values(coachProfiles).map(c => <option key={c.userId} value={c.userId}>{c.fullName}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="cl-room" className={label}>Ruangan</label>
              <input id="cl-room" type="text" maxLength={40} value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} placeholder="Studio A" className={field} />
            </div>
            <div>
              <label htmlFor="cl-cap" className={label}>Kapasitas</label>
              <input id="cl-cap" type="number" min="1" max="60" value={form.maxCapacity} onChange={e => setForm({ ...form, maxCapacity: e.target.value })} className={`${field} font-mono`} />
            </div>
          </div>
          <div>
            <label htmlFor="cl-desc" className={label}>Deskripsi <span className="font-normal text-zinc-600">(opsional)</span></label>
            <textarea id="cl-desc" rows={2} maxLength={250} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={`${field} resize-none`} />
          </div>
          {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
          <div className="pt-3 border-t border-line flex justify-end gap-2">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2.5 rounded-lg border border-line-strong text-zinc-300 hover:text-white text-xs">Batal</button>
            <button type="submit" className="px-6 py-2.5 rounded-lg bg-white text-black font-bold hover:bg-zinc-200 text-xs">Simpan kelas</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Hapus kelas?"
        danger
        confirmLabel="Ya, hapus kelas"
        message={deleteTarget && `"${deleteTarget.name}" akan dihapus${deleteTarget.enrolledMemberIds.length ? ` dan ${deleteTarget.enrolledMemberIds.length} peserta terdaftar dibatalkan` : ''}.`}
        onConfirm={async () => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (!target) return;
          const res = await deleteGroupClass(target.id);
          showToast(res.message || 'Kelas dihapus.', res.success ? 'info' : 'error');
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
