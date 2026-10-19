import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Camera, Award, Lock, Scale, Trophy, Flame, Dumbbell, Target, ImagePlus, type LucideIcon } from 'lucide-react';
import { Modal } from '../common/Modal';
import { formatDateId, toDateKey } from '../../lib/membership';
import type { BodyMeasurement } from '../../types';

const fieldClass =
  'w-full bg-surface-2 border border-line-strong rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white';

const MAX_PHOTO_PX = 900;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** Downscale a chosen image so it stays light enough to keep in app state. */
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_PHOTO_PX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gambar tidak dapat dibaca'));
    };
    img.src = url;
  });
}

/** Minimal dependency-free line chart (one series, labelled axes) */
const TrendChart: React.FC<{ title: string; unit: string; points: { date: string; value: number }[] }> = ({ title, unit, points }) => {
  const W = 320;
  const H = 120;
  const pad = { l: 34, r: 10, t: 10, b: 22 };
  const values = points.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <figure className="p-4 rounded-xl bg-surface border border-line">
      <figcaption className="flex items-baseline justify-between mb-2">
        <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{title}</span>
        <span className="text-sm font-black text-white font-mono">
          {last.value} {unit}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: dari ${points[0].value} ke ${last.value} ${unit}`} className="w-full h-auto">
        {[min, (min + max) / 2, max].map((v, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#232325" strokeWidth="1" />
            <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#71717A" fontFamily="monospace">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="#F5F5F5" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={p.date + i} cx={x(i)} cy={y(p.value)} r="3" fill="#050505" stroke="#F5F5F5" strokeWidth="1.5">
            <title>{`${formatDateId(p.date, 'short')}: ${p.value} ${unit}`}</title>
          </circle>
        ))}
        <text x={pad.l} y={H - 5} fontSize="9" fill="#71717A" fontFamily="monospace">
          {formatDateId(points[0].date, 'short')}
        </text>
        <text x={W - pad.r} y={H - 5} textAnchor="end" fontSize="9" fill="#71717A" fontFamily="monospace">
          {formatDateId(last.date, 'short')}
        </text>
      </svg>
    </figure>
  );
};

const delta = (cur?: number, first?: number, unit = '') => {
  if (cur === undefined || first === undefined) return null;
  const d = Math.round((cur - first) * 10) / 10;
  if (d === 0) return { text: 'Tidak berubah sejak awal', cls: 'text-zinc-400' };
  return { text: `${d > 0 ? '+' : ''}${d} ${unit} sejak awal`, cls: 'text-zinc-300' };
};

export const MemberProgressBody: React.FC = () => {
  const { currentUser, bodyMeasurements, addBodyMeasurement, progressPhotos, addProgressPhoto, workoutLogs, memberProfiles, showToast } = useApp();

  const memberId = currentUser?.id ?? '';
  const profile = memberProfiles[memberId];

  const measurements = useMemo(
    () => bodyMeasurements.filter(m => m.memberId === memberId).toSorted((a, b) => a.date.localeCompare(b.date)),
    [bodyMeasurements, memberId]
  );
  const photos = useMemo(
    () => progressPhotos.filter(p => p.memberId === memberId).toSorted((a, b) => b.date.localeCompare(a.date)),
    [progressPhotos, memberId]
  );
  const logs = useMemo(() => workoutLogs.filter(l => l.memberId === memberId), [workoutLogs, memberId]);

  const latest = measurements[measurements.length - 1];
  const first = measurements[0];

  // Measurement form (blank by default; no pre-filled sample values)
  const [showMeasure, setShowMeasure] = useState(false);
  const [form, setForm] = useState({ weightKg: '', chestCm: '', waistCm: '', armCm: '', thighCm: '' });
  const [measureError, setMeasureError] = useState('');

  const openMeasure = () => {
    setForm({
      weightKg: latest?.weightKg?.toString() ?? '',
      chestCm: latest?.chestCm?.toString() ?? '',
      waistCm: latest?.waistCm?.toString() ?? '',
      armCm: latest?.armCm?.toString() ?? '',
      thighCm: latest?.thighCm?.toString() ?? '',
    });
    setMeasureError('');
    setShowMeasure(true);
  };

  const saveMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = (v: string) => (v.trim() === '' ? undefined : parseFloat(v));
    const weight = num(form.weightKg);
    if (weight === undefined || !(weight >= 30 && weight <= 300)) return setMeasureError('Berat badan wajib diisi (30–300 kg).');
    const parts: Pick<BodyMeasurement, 'chestCm' | 'waistCm' | 'armCm' | 'thighCm'> = {
      chestCm: num(form.chestCm),
      waistCm: num(form.waistCm),
      armCm: num(form.armCm),
      thighCm: num(form.thighCm),
    };
    if (Object.values(parts).some(v => v !== undefined && !(v > 10 && v < 250))) return setMeasureError('Ukuran lingkar tubuh harus antara 10 dan 250 cm.');
    const res = await addBodyMeasurement({ date: toDateKey(), weightKg: weight, ...parts });
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) setShowMeasure(false);
  };

  // Photo upload
  const [showPhoto, setShowPhoto] = useState(false);
  const [photoData, setPhotoData] = useState('');
  const [photoNotes, setPhotoNotes] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file?: File) => {
    if (!file) return;
    setPhotoError('');
    if (!file.type.startsWith('image/')) return setPhotoError('File harus berupa gambar (JPG, PNG, atau WebP).');
    if (file.size > MAX_PHOTO_BYTES) return setPhotoError('Ukuran foto maksimal 8 MB.');
    setPhotoBusy(true);
    try {
      setPhotoData(await resizeImage(file));
    } catch {
      setPhotoError('Foto tidak dapat diproses. Coba file lain.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const savePhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoData) return setPhotoError('Pilih foto terlebih dahulu.');
    const res = await addProgressPhoto({ dataUrl: photoData, notes: photoNotes.trim(), weightKg: latest?.weightKg });
    showToast(res.message, res.success ? 'success' : 'error');
    if (!res.success) return;
    setShowPhoto(false);
    setPhotoData('');
    setPhotoNotes('');
  };

  // Achievements are computed from the member's real activity
  const hasPr = logs.some(l => l.prAchieved);
  const heaviestSquat = Math.max(
    0,
    ...logs.flatMap(l => l.exercises.filter(e => /squat/i.test(e.exerciseName)).flatMap(e => e.sets.map(s => s.weightKg)))
  );
  const badges: { title: string; desc: string; unlocked: boolean; icon: LucideIcon }[] = [
    { title: 'Konsistensi 10 sesi', desc: `${Math.min(logs.length, 10)}/10 sesi latihan tercatat`, unlocked: logs.length >= 10, icon: Dumbbell },
    { title: 'Rekor pribadi (PR)', desc: 'Catat setidaknya satu rekor angkatan baru', unlocked: hasPr, icon: Trophy },
    { title: 'Streak 4 hari', desc: `Streak saat ini ${profile?.workoutStreak ?? 0} hari`, unlocked: (profile?.workoutStreak ?? 0) >= 4, icon: Flame },
    { title: 'Club 100 kg squat', desc: `Squat terberat tercatat ${heaviestSquat} kg`, unlocked: heaviestSquat >= 100, icon: Target },
  ];

  const series = (pick: (m: BodyMeasurement) => number | undefined) =>
    measurements.filter(m => pick(m) !== undefined).map(m => ({ date: m.date, value: pick(m) as number }));
  const weightSeries = series(m => m.weightKg);
  const waistSeries = series(m => m.waistCm);

  const stat = (label: string, value: number | undefined, unit: string, firstValue: number | undefined) => {
    const d = delta(value, firstValue, unit);
    return (
      <div className="p-4 rounded-xl bg-surface border border-line" key={label}>
        <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">{label}</span>
        <span className="text-2xl font-black text-white mt-1 block font-tabular">{value !== undefined ? `${value} ${unit}` : '–'}</span>
        <span className={`text-[11px] font-semibold ${d?.cls ?? 'text-zinc-500'}`}>{measurements.length > 1 && d ? d.text : 'Belum ada pembanding'}</span>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="bg-surface rounded-2xl border border-line p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-semibold mb-1">
            <Lock className="w-3.5 h-3.5" />
            Data pribadi, hanya Anda dan coach Anda
          </div>
          <h1 className="text-2xl font-extrabold uppercase text-white">Ukuran tubuh & foto progres</h1>
          <p className="text-xs text-zinc-400 mt-1">Data fisik dan foto bersifat sensitif. Bagikan hanya jika Anda nyaman.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={openMeasure} className="px-4 py-2.5 rounded-xl bg-surface-2 border border-line-strong hover:border-white text-xs font-bold text-white transition-colors flex items-center gap-1.5">
            <Scale className="w-4 h-4" /> Catat ukuran
          </button>
          <button onClick={() => setShowPhoto(true)} className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-xs font-bold text-black transition-colors flex items-center gap-1.5">
            <Camera className="w-4 h-4" /> Unggah foto
          </button>
        </div>
      </div>

      {measurements.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-line p-12 text-center">
          <Scale className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <h2 className="text-sm font-bold text-white mb-1">Belum ada data ukuran</h2>
          <p className="text-xs text-zinc-400 mb-4">Catat berat dan lingkar tubuh pertama Anda untuk melihat tren perubahan.</p>
          <button onClick={openMeasure} className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-zinc-200">
            Catat ukuran pertama
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stat('Berat badan', latest?.weightKg, 'kg', first?.weightKg)}
            {stat('Lingkar dada', latest?.chestCm, 'cm', first?.chestCm)}
            {stat('Lingkar pinggang', latest?.waistCm, 'cm', first?.waistCm)}
            {stat('Lingkar lengan', latest?.armCm, 'cm', first?.armCm)}
          </div>

          {weightSeries.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TrendChart title="Tren berat badan" unit="kg" points={weightSeries} />
              {waistSeries.length > 1 && <TrendChart title="Tren lingkar pinggang" unit="cm" points={waistSeries} />}
            </div>
          )}
        </>
      )}

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h2 className="text-sm font-bold text-white">Galeri foto progres</h2>
            <p className="text-[11px] text-zinc-400">Bandingkan perubahan postur dan komposisi otot dari waktu ke waktu.</p>
          </div>
          <span className="text-xs text-zinc-400 font-mono">{photos.length} foto</span>
        </div>

        {photos.length === 0 ? (
          <div className="text-center py-10">
            <ImagePlus className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-xs text-zinc-400 mb-4">Belum ada foto. Unggah foto pertama sebagai titik awal.</p>
            <button onClick={() => setShowPhoto(true)} className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-zinc-200">
              Unggah foto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {photos.map(photo => (
              <figure key={photo.id} className="rounded-xl overflow-hidden border border-line bg-surface-2">
                <div className="h-64 overflow-hidden relative">
                  <img src={photo.photoUrl} alt={`Foto progres ${formatDateId(photo.date)}`} loading="lazy" className="w-full h-full object-cover object-top" />
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm text-[10px] font-mono text-white">
                    {formatDateId(photo.date, 'short')}
                    {photo.weightKg ? ` · ${photo.weightKg} kg` : ''}
                  </span>
                </div>
                {photo.notes && <figcaption className="p-3 text-[11px] text-zinc-300 leading-relaxed">{photo.notes}</figcaption>}
              </figure>
            ))}
          </div>
        )}
      </section>

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Award className="w-4 h-4 text-zinc-400" /> Lencana pencapaian
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {badges.map(b => {
            const Icon = b.icon;
            return (
              <div
                key={b.title}
                className={`p-4 rounded-xl border flex items-start gap-3 ${b.unlocked ? 'bg-surface-2 border-line-strong' : 'bg-surface border-line border-dashed'}`}
              >
                <span className={`p-2 rounded-lg shrink-0 ${b.unlocked ? 'bg-white text-black' : 'bg-white/10 text-zinc-500'}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <div>
                  <span className={`text-xs font-bold block ${b.unlocked ? 'text-white' : 'text-zinc-300'}`}>
                    {b.title} {b.unlocked && <span className="text-emerald-400 font-semibold">· tercapai</span>}
                  </span>
                  <span className="text-[11px] text-zinc-400 mt-0.5 block">{b.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Modal isOpen={showMeasure} onClose={() => setShowMeasure(false)} label="Catat ukuran tubuh" maxWidth="max-w-md">
        <form onSubmit={saveMeasurement} className="p-6 space-y-4 text-xs" noValidate>
          <h2 className="text-base font-bold text-white pr-8">Catat ukuran tubuh baru</h2>
          <div>
            <label htmlFor="m-weight" className="block text-zinc-400 mb-1.5 font-semibold">Berat badan (kg) *</label>
            <input id="m-weight" type="number" inputMode="decimal" step="0.1" required value={form.weightKg} onChange={e => setForm({ ...form, weightKg: e.target.value })} className={fieldClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['chestCm', 'Lingkar dada (cm)'],
                ['waistCm', 'Lingkar pinggang (cm)'],
                ['armCm', 'Lingkar lengan (cm)'],
                ['thighCm', 'Lingkar paha (cm)'],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label htmlFor={`m-${key}`} className="block text-zinc-400 mb-1.5 font-semibold">{label}</label>
                <input id={`m-${key}`} type="number" inputMode="decimal" step="0.5" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className={fieldClass} />
              </div>
            ))}
          </div>
          {measureError && <p role="alert" className="text-rose-400">{measureError}</p>}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={() => setShowMeasure(false)} className="px-4 py-2.5 rounded-lg border border-line-strong text-zinc-300 hover:text-white">Batal</button>
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-white text-black font-bold hover:bg-zinc-200">Simpan</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showPhoto} onClose={() => setShowPhoto(false)} label="Unggah foto progres" maxWidth="max-w-md">
        <form onSubmit={savePhoto} className="p-6 space-y-4 text-xs" noValidate>
          <h2 className="text-base font-bold text-white pr-8">Unggah foto progres</h2>
          <div>
            <input ref={fileRef} id="photo-file" type="file" accept="image/*" className="sr-only" onChange={e => onFile(e.target.files?.[0])} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-xl border border-dashed border-line-strong hover:border-white transition-colors overflow-hidden"
            >
              {photoData ? (
                <img src={photoData} alt="Pratinjau foto" className="w-full h-56 object-cover object-top" />
              ) : (
                <span className="flex flex-col items-center gap-2 py-10 text-zinc-400">
                  <ImagePlus className="w-7 h-7" />
                  {photoBusy ? 'Memproses foto…' : 'Pilih foto dari perangkat'}
                </span>
              )}
            </button>
            <p className="text-[10px] text-zinc-500 mt-1.5">Foto diperkecil otomatis dan hanya disimpan di sesi ini.</p>
          </div>
          <div>
            <label htmlFor="photo-notes" className="block text-zinc-400 mb-1.5 font-semibold">Keterangan pose <span className="font-normal text-zinc-600">(opsional)</span></label>
            <input id="photo-notes" type="text" maxLength={120} value={photoNotes} onChange={e => setPhotoNotes(e.target.value)} placeholder="Misal: tampak depan, 3 bulan latihan" className={fieldClass} />
          </div>
          {photoError && <p role="alert" className="text-rose-400">{photoError}</p>}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={() => setShowPhoto(false)} className="px-4 py-2.5 rounded-lg border border-line-strong text-zinc-300 hover:text-white">Batal</button>
            <button type="submit" disabled={photoBusy} className="px-5 py-2.5 rounded-lg bg-white text-black font-bold hover:bg-zinc-200 disabled:opacity-50">Simpan foto</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
