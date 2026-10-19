import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { Announcement } from '../../types';
import { Bell, Plus, Pin, Trash2, Megaphone } from 'lucide-react';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { addDaysToKey, formatDateId, toDateKey } from '../../lib/membership';

const TYPE_LABEL: Record<Announcement['type'], string> = {
  INFO: 'Info',
  GYM_TUTUP: 'Gym tutup',
  PENTING: 'Penting',
  PROMO: 'Promo',
};
const TYPE_CHIP: Record<Announcement['type'], string> = {
  INFO: 'bg-white/10 text-zinc-200',
  GYM_TUTUP: 'bg-amber-500 text-black',
  PENTING: 'bg-rose-900 text-rose-200',
  PROMO: 'bg-white text-black',
};
const TARGET_LABEL: Record<Announcement['targetRole'], string> = { ALL: 'Semua pengunjung & member', MEMBER: 'Member saja', COACH: 'Coach & staf' };

const field = 'w-full bg-surface-2 border border-line-strong rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white';
const label = 'block text-zinc-400 text-xs font-semibold mb-1.5';

/** Where an announcement is in its lifecycle right now */
function phaseOf(a: Announcement, today: string): { label: string; cls: string } {
  if (!a.isPublished) return { label: 'Draft', cls: 'bg-surface text-zinc-400 border-line-strong' };
  if (today < a.startDate) return { label: 'Terjadwal', cls: 'bg-sky-950 text-sky-300 border-sky-800' };
  if (today > a.endDate) return { label: 'Berakhir', cls: 'bg-surface text-zinc-500 border-line' };
  return { label: 'Tayang', cls: 'bg-emerald-950 text-emerald-300 border-emerald-800' };
}

export const AdminAnnouncements: React.FC = () => {
  const { announcements, addAnnouncement, toggleAnnouncementPublish, deleteAnnouncement, showToast } = useApp();
  const today = toDateKey();

  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [form, setForm] = useState({
    title: '',
    content: '',
    type: 'INFO' as Announcement['type'],
    targetRole: 'ALL' as Announcement['targetRole'],
    startDate: today,
    endDate: addDaysToKey(today, 14),
    isPinned: false,
  });
  const [error, setError] = useState('');

  const sorted = useMemo(() => [...announcements].toSorted((a, b) => b.startDate.localeCompare(a.startDate)), [announcements]);

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.title.trim().length < 3) return setError('Judul minimal 3 karakter.');
    if (form.content.trim().length < 10) return setError('Isi pesan minimal 10 karakter.');
    if (form.endDate < form.startDate) return setError('Tanggal berakhir tidak boleh sebelum tanggal mulai.');
    addAnnouncement({ ...form, title: form.title.trim(), content: form.content.trim(), isPublished: true });
    showToast(form.startDate > today ? 'Pengumuman dijadwalkan dan akan tayang otomatis.' : 'Pengumuman diterbitkan dan langsung tampil di banner.', 'success');
    setShowCreate(false);
    setError('');
    setForm({ ...form, title: '', content: '', isPinned: false });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold uppercase text-white">Pengumuman & banner</h1>
          <p className="text-xs text-zinc-400 mt-1">Siarkan libur, maintenance, atau promo. Banner mengikuti periode tayang dan target audiens.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-5 py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm transition-colors flex items-center justify-center gap-2 self-start">
          <Plus className="w-4 h-4" /> Buat pengumuman
        </button>
      </div>

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Bell className="w-4 h-4 text-zinc-400" /> Semua pengumuman ({sorted.length})
        </h2>

        {sorted.length === 0 ? (
          <div className="py-12 text-center">
            <Megaphone className="w-9 h-9 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-400 mb-4">Belum ada pengumuman.</p>
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-zinc-200">
              Buat pengumuman pertama
            </button>
          </div>
        ) : (
          <ul className="space-y-4">
            {sorted.map(ann => {
              const phase = phaseOf(ann, today);
              return (
                <li key={ann.id} className={`p-5 rounded-2xl border text-xs space-y-3 ${ann.type === 'GYM_TUTUP' ? 'bg-amber-950/15 border-amber-800/50' : 'bg-surface-2 border-line'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${TYPE_CHIP[ann.type]}`}>{TYPE_LABEL[ann.type]}</span>
                      <h3 className="font-bold text-sm text-white">{ann.title}</h3>
                      {ann.isPinned && (
                        <span className="text-[10px] text-zinc-300 font-semibold inline-flex items-center gap-1">
                          <Pin className="w-3 h-3" /> Disematkan
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold ${phase.cls}`}>{phase.label}</span>
                      <button
                        onClick={() => {
                          toggleAnnouncementPublish(ann.id);
                          showToast(ann.isPublished ? 'Pengumuman ditarik ke draft.' : 'Pengumuman diterbitkan.', 'info');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-line-strong hover:border-white text-zinc-200 font-semibold transition-colors"
                      >
                        {ann.isPublished ? 'Tarik ke draft' : 'Terbitkan'}
                      </button>
                      <button onClick={() => setDeleteTarget(ann)} aria-label={`Hapus ${ann.title}`} className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-zinc-300 leading-relaxed">{ann.content}</p>
                  <div className="pt-2 border-t border-line text-[11px] text-zinc-500 font-mono">
                    {TARGET_LABEL[ann.targetRole]} · {formatDateId(ann.startDate, 'short')} s/d {formatDateId(ann.endDate, 'short')}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} label="Buat pengumuman baru" maxWidth="max-w-lg">
        <form onSubmit={create} className="p-6 space-y-4" noValidate>
          <h2 className="text-base font-bold text-white pr-8">Buat pengumuman baru</h2>
          <div>
            <label htmlFor="ann-title" className={label}>Judul</label>
            <input id="ann-title" type="text" maxLength={100} placeholder="Mis. Gym tutup libur nasional" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={field} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ann-type" className={label}>Tipe</label>
              <select id="ann-type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Announcement['type'] })} className={field}>
                <option value="INFO">Info operasional</option>
                <option value="GYM_TUTUP">Gym tutup / libur (banner)</option>
                <option value="PENTING">Penting / mendesak (banner)</option>
                <option value="PROMO">Promo & diskon</option>
              </select>
            </div>
            <div>
              <label htmlFor="ann-target" className={label}>Target audiens</label>
              <select id="ann-target" value={form.targetRole} onChange={e => setForm({ ...form, targetRole: e.target.value as Announcement['targetRole'] })} className={field}>
                {(Object.keys(TARGET_LABEL) as Announcement['targetRole'][]).map(k => (
                  <option key={k} value={k}>{TARGET_LABEL[k]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="ann-content" className={label}>Isi pesan</label>
            <textarea id="ann-content" rows={4} maxLength={500} placeholder="Jelaskan tanggal, jam, dan dampaknya bagi jadwal member" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className={`${field} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ann-start" className={label}>Mulai tayang</label>
              <input id="ann-start" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className={`${field} font-mono`} />
            </div>
            <div>
              <label htmlFor="ann-end" className={label}>Berakhir</label>
              <input id="ann-end" type="date" min={form.startDate} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className={`${field} font-mono`} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-zinc-300 text-xs">
            <input type="checkbox" checked={form.isPinned} onChange={e => setForm({ ...form, isPinned: e.target.checked })} className="w-4 h-4 accent-white" />
            Sematkan sebagai banner utama
          </label>
          {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
          <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2.5 rounded-lg border border-line-strong text-zinc-300 hover:text-white text-xs">Batal</button>
            <button type="submit" className="px-6 py-2.5 rounded-lg bg-white text-black font-bold hover:bg-zinc-200 text-xs">Terbitkan</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Hapus pengumuman?"
        danger
        confirmLabel="Ya, hapus"
        message={deleteTarget && `"${deleteTarget.title}" akan dihapus permanen dan hilang dari semua banner.`}
        onConfirm={() => {
          if (deleteTarget) deleteAnnouncement(deleteTarget.id);
          showToast('Pengumuman dihapus.', 'info');
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
