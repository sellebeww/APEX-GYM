import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { WorkoutProgram, ProgramDay } from '../../types';
import { Plus, Trash2, Save, ClipboardList } from 'lucide-react';

const field =
  'w-full bg-surface-2 border border-line-strong rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white';
const label = 'block text-zinc-400 text-xs font-semibold mb-1.5';
const mini = 'w-full bg-zinc-900 border border-line-strong rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-white';

const emptyDay = (n: number): ProgramDay => ({ dayNumber: n, dayName: `Hari ${n}`, focus: '', exercises: [] });

export const CoachProgramBuilder: React.FC = () => {
  const { exercises, addCoachProgram, assignProgram, workoutPrograms, memberProfiles, users, currentUser, showToast } = useApp();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState<WorkoutProgram['target']>('Hipertrofi');
  const [level, setLevel] = useState<WorkoutProgram['level']>('Menengah');
  const [frequency, setFrequency] = useState('4');
  const [durationWeeks, setDurationWeeks] = useState('8');
  const [assignTo, setAssignTo] = useState('');
  const [days, setDays] = useState<ProgramDay[]>([emptyDay(1)]);
  const [errors, setErrors] = useState<string[]>([]);

  const clients = useMemo(
    () =>
      Object.values(memberProfiles)
        .filter(p => p.assignedCoachId === currentUser?.id)
        .map(p => users.find(u => u.id === p.userId))
        .filter((u): u is NonNullable<typeof u> => !!u),
    [memberProfiles, users, currentUser?.id]
  );
  const myPrograms = workoutPrograms.filter(p => p.createdByCoachId === currentUser?.id);

  // Immutable editing helpers (mutating nested state double-applies under StrictMode)
  const patchDay = (i: number, patch: Partial<ProgramDay>) => setDays(prev => prev.map((d, di) => (di === i ? { ...d, ...patch } : d)));
  const addDay = () => setDays(prev => [...prev, emptyDay(prev.length + 1)]);
  const removeDay = (i: number) => setDays(prev => prev.filter((_, di) => di !== i).map((d, n) => ({ ...d, dayNumber: n + 1 })));
  const addExercise = (dayIdx: number, exerciseId: string) => {
    const found = exercises.find(e => e.id === exerciseId);
    if (!found) return;
    setDays(prev =>
      prev.map((d, di) =>
        di === dayIdx
          ? { ...d, exercises: [...d.exercises, { exerciseId: found.id, exerciseName: found.name, sets: 3, reps: '8-10', targetRpe: 8, restSeconds: 90 }] }
          : d
      )
    );
  };
  const patchExercise = (dayIdx: number, exIdx: number, patch: Partial<ProgramDay['exercises'][number]>) =>
    setDays(prev => prev.map((d, di) => (di === dayIdx ? { ...d, exercises: d.exercises.map((e, ei) => (ei === exIdx ? { ...e, ...patch } : e)) } : d)));
  const removeExercise = (dayIdx: number, exIdx: number) =>
    setDays(prev => prev.map((d, di) => (di === dayIdx ? { ...d, exercises: d.exercises.filter((_, ei) => ei !== exIdx) } : d)));

  const save = async () => {
    const problems: string[] = [];
    if (title.trim().length < 3) problems.push('Nama program minimal 3 karakter.');
    if (days.every(d => d.exercises.length === 0)) problems.push('Tambahkan setidaknya satu latihan.');
    days.forEach(d => {
      if (!d.dayName.trim()) problems.push(`Hari ${d.dayNumber} perlu nama.`);
    });
    setErrors(problems);
    if (problems.length) return;

    const res = await addCoachProgram({
      title: title.trim(),
      description: description.trim() || 'Program latihan terstruktur dari coach.',
      target,
      level,
      frequencyPerWeek: Math.min(7, Math.max(1, parseInt(frequency, 10) || 3)),
      durationWeeks: Math.min(24, Math.max(1, parseInt(durationWeeks, 10) || 8)),
      assignedToMemberId: assignTo || undefined,
      days: days.filter(d => d.exercises.length > 0),
    });
    if (!res.success) return showToast(res.message, 'error');
    showToast(assignTo ? 'Program disimpan dan ditugaskan ke klien.' : 'Program disimpan sebagai template.', 'success');
    setTitle('');
    setDescription('');
    setAssignTo('');
    setDays([emptyDay(1)]);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold uppercase text-white">Program builder</h1>
          <p className="text-xs text-zinc-400 mt-1">Rancang split latihan dengan volume, intensitas (RPE), dan waktu istirahat, lalu tugaskan ke klien.</p>
        </div>
        <button onClick={save} className="px-6 py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm transition-colors flex items-center justify-center gap-2">
          <Save className="w-4 h-4" /> Simpan program
        </button>
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/60 text-xs text-rose-300 space-y-1 list-disc list-inside">
          {errors.map(e => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="pb-title" className={label}>Nama program *</label>
            <input id="pb-title" type="text" maxLength={80} value={title} onChange={e => setTitle(e.target.value)} placeholder="Mis. Upper Lower 4 Hari (8 Minggu)" className={field} />
          </div>
          <div>
            <label htmlFor="pb-assign" className={label}>Tugaskan ke klien</label>
            <select id="pb-assign" value={assignTo} onChange={e => setAssignTo(e.target.value)} className={field}>
              <option value="">Template umum (tidak ditugaskan)</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label htmlFor="pb-target" className={label}>Target</label>
            <select id="pb-target" value={target} onChange={e => setTarget(e.target.value as WorkoutProgram['target'])} className={field}>
              <option value="Hipertrofi">Hipertrofi</option>
              <option value="Fat Loss">Fat Loss</option>
              <option value="Kekuatan">Kekuatan</option>
              <option value="Kebugaran Umum">Kebugaran umum</option>
            </select>
          </div>
          <div>
            <label htmlFor="pb-level" className={label}>Level</label>
            <select id="pb-level" value={level} onChange={e => setLevel(e.target.value as WorkoutProgram['level'])} className={field}>
              <option value="Pemula">Pemula</option>
              <option value="Menengah">Menengah</option>
              <option value="Lanjutan">Lanjutan</option>
            </select>
          </div>
          <div>
            <label htmlFor="pb-freq" className={label}>Hari / minggu</label>
            <input id="pb-freq" type="number" min="1" max="7" value={frequency} onChange={e => setFrequency(e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor="pb-weeks" className={label}>Durasi (minggu)</label>
            <input id="pb-weeks" type="number" min="1" max="24" value={durationWeeks} onChange={e => setDurationWeeks(e.target.value)} className={field} />
          </div>
        </div>

        <div>
          <label htmlFor="pb-desc" className={label}>Deskripsi & catatan progresi</label>
          <textarea id="pb-desc" rows={2} maxLength={300} value={description} onChange={e => setDescription(e.target.value)} placeholder="Fokus program dan cara menaikkan beban tiap minggu" className={`${field} resize-none`} />
        </div>
      </section>

      <div className="space-y-5">
        {days.map((day, dIdx) => (
          <section key={dIdx} className="bg-surface rounded-2xl border border-line p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-line">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="w-7 h-7 rounded bg-white text-black font-extrabold flex items-center justify-center text-xs shrink-0">{day.dayNumber}</span>
                <label className="sr-only" htmlFor={`day-name-${dIdx}`}>Nama hari {day.dayNumber}</label>
                <input
                  id={`day-name-${dIdx}`}
                  type="text"
                  value={day.dayName}
                  maxLength={60}
                  onChange={e => patchDay(dIdx, { dayName: e.target.value })}
                  className="bg-transparent text-white font-bold text-sm border-b border-line focus:border-white focus:outline-none flex-1 min-w-0 py-1"
                />
                <label className="sr-only" htmlFor={`day-focus-${dIdx}`}>Fokus hari {day.dayNumber}</label>
                <input
                  id={`day-focus-${dIdx}`}
                  type="text"
                  value={day.focus}
                  maxLength={60}
                  placeholder="Fokus (mis. dada & trisep)"
                  onChange={e => patchDay(dIdx, { focus: e.target.value })}
                  className="bg-transparent text-zinc-300 text-xs border-b border-line focus:border-white focus:outline-none flex-1 min-w-0 py-1 hidden sm:block"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`add-ex-${dIdx}`}>Tambah latihan ke hari {day.dayNumber}</label>
                <select
                  id={`add-ex-${dIdx}`}
                  value=""
                  onChange={e => e.target.value && addExercise(dIdx, e.target.value)}
                  className="bg-surface-2 border border-line-strong rounded-lg px-3 py-2 text-white text-xs max-w-[16rem]"
                >
                  <option value="">+ Tambah latihan…</option>
                  {exercises.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.name} ({ex.category})</option>
                  ))}
                </select>
                {days.length > 1 && (
                  <button onClick={() => removeDay(dIdx)} aria-label={`Hapus hari ${day.dayNumber}`} className="p-2 text-zinc-500 hover:text-rose-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {day.exercises.length === 0 ? (
              <p className="text-zinc-500 py-3 text-xs text-center">Belum ada latihan pada hari ini.</p>
            ) : (
              <ul className="divide-y divide-line">
                {day.exercises.map((ex, exIdx) => (
                  <li key={`${ex.exerciseId}-${exIdx}`} className="py-3 grid grid-cols-2 sm:grid-cols-[1fr_repeat(4,5rem)_auto] items-center gap-2 text-xs">
                    <span className="font-bold text-white col-span-2 sm:col-span-1">{ex.exerciseName}</span>
                    {(
                      [
                        ['Set', 'sets', ex.sets],
                        ['Reps', 'reps', ex.reps],
                        ['RPE', 'targetRpe', ex.targetRpe ?? ''],
                        ['Rest (s)', 'restSeconds', ex.restSeconds],
                      ] as const
                    ).map(([lab, key, val]) => (
                      <label key={key} className="block">
                        <span className="sr-only">{lab}</span>
                        <input
                          value={val}
                          placeholder={lab}
                          aria-label={`${lab} ${ex.exerciseName}`}
                          onChange={e => {
                            const v = e.target.value;
                            patchExercise(dIdx, exIdx, {
                              [key]: key === 'reps' ? v : v === '' ? undefined : Math.max(0, parseInt(v, 10) || 0),
                            } as Partial<typeof ex>);
                          }}
                          className={mini}
                        />
                      </label>
                    ))}
                    <button onClick={() => removeExercise(dIdx, exIdx)} aria-label={`Hapus ${ex.exerciseName}`} className="p-1.5 text-zinc-500 hover:text-rose-400 justify-self-end">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <button onClick={addDay} className="w-full py-3.5 rounded-2xl border border-dashed border-line-strong hover:border-white text-zinc-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> Tambah hari latihan
        </button>
      </div>

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-zinc-400" /> Program yang pernah Anda buat ({myPrograms.length})
        </h2>
        {myPrograms.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-6">Belum ada program. Program yang disimpan akan muncul di sini.</p>
        ) : (
          <ul className="divide-y divide-line">
            {myPrograms.map(p => (
              <li key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-white text-sm">{p.title}</span>
                  <p className="text-zinc-400 mt-0.5">
                    {p.target} · {p.level} · {p.days.length} hari · {p.durationWeeks} minggu
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`assign-${p.id}`}>Ditugaskan ke</label>
                  <select
                    id={`assign-${p.id}`}
                    value={p.assignedToMemberId ?? ''}
                    onChange={e => {
                      assignProgram(p.id, e.target.value || null);
                      showToast(e.target.value ? 'Program ditugaskan.' : 'Program dijadikan template umum.', 'success');
                    }}
                    className="bg-surface-2 border border-line-strong rounded-lg px-3 py-2 text-white text-xs"
                  >
                    <option value="">Template umum</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
