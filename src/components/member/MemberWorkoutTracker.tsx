import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { Exercise, LoggedExercise, WorkoutSet } from '../../types';
import { Plus, Trash2, Trophy, Play, Check, Flame, MessageSquare, X, Copy, Timer, Search } from 'lucide-react';
import confetti from 'canvas-confetti';
import { MemberPostWorkoutModal } from './MemberPostWorkoutModal';
import { Modal } from '../common/Modal';
import { formatDateId, toDateKey } from '../../lib/membership';

const CATEGORIES = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];
const REST_PRESETS = [60, 90, 120];

const volumeOf = (sets: WorkoutSet[]) => sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);

const inputClass =
  'bg-zinc-900 border border-line-strong rounded px-2 py-1.5 text-white font-bold text-xs focus:outline-none focus:border-white';

export const MemberWorkoutTracker: React.FC = () => {
  const {
    workoutLogs,
    exercises,
    workoutPrograms,
    logWorkoutSession,
    currentUser,
    justFinishedWorkout,
    setJustFinishedWorkout,
    showToast,
    suggestedProgramId,
  } = useApp();

  const [isLoggingActive, setIsLoggingActive] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('Sesi Latihan');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [moodRating, setMoodRating] = useState(4);
  const [sessionNotes, setSessionNotes] = useState('');
  const [activeExercises, setActiveExercises] = useState<LoggedExercise[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');

  // In-session rest timer (deadline based, so it stays accurate in background tabs)
  const [restLeft, setRestLeft] = useState(0);
  const restEndRef = useRef(0);
  useEffect(() => {
    if (restLeft <= 0) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((restEndRef.current - Date.now()) / 1000));
      setRestLeft(left);
    }, 250);
    return () => clearInterval(id);
  }, [restLeft > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const startRest = (seconds: number) => {
    restEndRef.current = Date.now() + seconds * 1000;
    setRestLeft(seconds);
  };

  const memberId = currentUser?.id;
  // Programs: ones assigned to this member, plus general (unassigned) templates
  const myPrograms = useMemo(
    () => workoutPrograms.filter(p => !p.assignedToMemberId || p.assignedToMemberId === memberId),
    [workoutPrograms, memberId]
  );
  const program =
    myPrograms.find(p => p.id === suggestedProgramId) ?? myPrograms.find(p => p.assignedToMemberId === memberId) ?? myPrograms[0];

  const memberLogs = useMemo(
    () => workoutLogs.filter(l => l.memberId === memberId).toSorted((a, b) => b.date.localeCompare(a.date)),
    [workoutLogs, memberId]
  );

  /** Last weight/reps the member used for an exercise, to pre-fill progressive overload */
  const lastSetFor = (exerciseId: string, name: string): WorkoutSet | undefined => {
    for (const log of memberLogs) {
      const ex = log.exercises.find(e => e.exerciseId === exerciseId || e.exerciseName === name);
      if (ex && ex.sets.length) return ex.sets[ex.sets.length - 1];
    }
    return undefined;
  };

  const newExercise = (id: string, name: string, setCount: number): LoggedExercise => {
    const last = lastSetFor(id, name);
    return {
      exerciseId: id,
      exerciseName: name,
      sets: Array.from({ length: setCount }, (_, i) => ({
        setNumber: i + 1,
        weightKg: last?.weightKg ?? 20,
        reps: last?.reps ?? 10,
        rpe: last?.rpe ?? 7,
      })),
    };
  };

  const beginSession = (title: string, list: { id: string; name: string }[]) => {
    setSessionTitle(title);
    setActiveExercises(list.map(item => newExercise(item.id, item.name, 3)));
    setDurationMinutes(60);
    setSessionNotes('');
    setIsLoggingActive(true);
  };

  const addExercise = (ex: Exercise) => {
    setActiveExercises(prev => [...prev, newExercise(ex.id, ex.name, 3)]);
    setShowPicker(false);
  };

  // All updates are immutable (mutating nested state breaks under StrictMode and double-adds sets)
  const updateExercise = (exIdx: number, fn: (sets: WorkoutSet[]) => WorkoutSet[]) =>
    setActiveExercises(prev =>
      prev.map((ex, i) => (i === exIdx ? { ...ex, sets: fn(ex.sets).map((s, n) => ({ ...s, setNumber: n + 1 })) } : ex))
    );

  const addSet = (exIdx: number) =>
    updateExercise(exIdx, sets => [...sets, { ...(sets[sets.length - 1] ?? { weightKg: 20, reps: 10, rpe: 7 }), isPr: false, setNumber: 0 }]);

  const duplicateSet = (exIdx: number, setIdx: number) =>
    updateExercise(exIdx, sets => [...sets, { ...sets[setIdx], isPr: false }]);

  const removeSet = (exIdx: number, setIdx: number) => updateExercise(exIdx, sets => sets.filter((_, i) => i !== setIdx));

  const removeExercise = (exIdx: number) => setActiveExercises(prev => prev.filter((_, i) => i !== exIdx));

  const updateSet = <K extends keyof WorkoutSet>(exIdx: number, setIdx: number, field: K, value: WorkoutSet[K]) => {
    if (field === 'isPr' && value === true) {
      try {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.65 }, colors: ['#F5F5F5', '#FFFFFF', '#22C55E'] });
      } catch {
        /* cosmetic */
      }
    }
    updateExercise(exIdx, sets => sets.map((s, i) => (i === setIdx ? { ...s, [field]: value } : s)));
  };

  const totalVolume = activeExercises.reduce((acc, ex) => acc + volumeOf(ex.sets), 0);
  const hasPr = activeExercises.some(ex => ex.sets.some(s => s.isPr));

  const finishSession = async () => {
    if (!currentUser) return;
    if (activeExercises.length === 0) {
      showToast('Tambahkan minimal 1 latihan sebelum menyimpan sesi.', 'error');
      return;
    }
    if (!sessionTitle.trim()) {
      showToast('Beri nama sesi latihan Anda.', 'error');
      return;
    }
    const res = await logWorkoutSession({
      date: toDateKey(),
      title: sessionTitle.trim(),
      durationMinutes: Math.max(1, durationMinutes),
      moodRating,
      notes: sessionNotes.trim(),
      exercises: activeExercises,
    });
    if (!res.success) {
      showToast(res.message, 'error');
      return;
    }
    if (hasPr) {
      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } catch {
        /* cosmetic */
      }
    }
    setIsLoggingActive(false);
    setActiveExercises([]);
    setSessionNotes('');
    setRestLeft(0);
  };

  const filteredLibrary = exercises.filter(
    e =>
      (category === 'All' || e.category === category) &&
      (!query.trim() || `${e.name} ${e.primaryMuscle} ${e.equipment}`.toLowerCase().includes(query.trim().toLowerCase()))
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {justFinishedWorkout && <MemberPostWorkoutModal session={justFinishedWorkout} onClose={() => setJustFinishedWorkout(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold uppercase text-white">Workout tracker</h1>
          <p className="text-xs text-zinc-400 mt-1">Catat beban, repetisi, dan RPE untuk menerapkan progressive overload.</p>
        </div>
        {!isLoggingActive && (
          <button
            onClick={() => beginSession('Freestyle Workout', [])}
            className="px-6 py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-black" />
            Mulai sesi baru
          </button>
        )}
      </div>

      {!isLoggingActive && program && (
        <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-white">
              Mulai cepat dari program: <span className="text-zinc-300">{program.title}</span>
            </h2>
            <span className="text-xs text-zinc-500 hidden sm:inline">Beban terisi dari catatan terakhir Anda</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {program.days.map(d => (
              <button
                key={d.dayNumber}
                onClick={() => beginSession(`${program.title} - ${d.dayName}`, d.exercises.map(e => ({ id: e.exerciseId, name: e.exerciseName })))}
                className="p-4 rounded-xl bg-surface-2 border border-line hover:border-white text-left transition-colors"
              >
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Hari {d.dayNumber}</div>
                <div className="text-sm font-bold text-white">{d.dayName}</div>
                <div className="text-[11px] text-zinc-400 mt-1 line-clamp-1">
                  {d.focus} · {d.exercises.length} latihan
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {isLoggingActive && (
        <section className="bg-surface rounded-2xl border border-white/60 p-4 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
            <div className="flex-1 min-w-0">
              <label htmlFor="session-title" className="sr-only">
                Nama sesi latihan
              </label>
              <input
                id="session-title"
                type="text"
                value={sessionTitle}
                maxLength={80}
                onChange={e => setSessionTitle(e.target.value)}
                className="text-lg sm:text-xl font-bold text-white bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-white focus:outline-none w-full"
                placeholder="Nama sesi latihan"
              />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 mt-1">
                <span>
                  Total volume: <strong className="text-white font-mono">{totalVolume.toLocaleString('id-ID')} kg</strong>
                </span>
                <span>{activeExercises.length} latihan</span>
              </div>
            </div>

            <div
              className={`p-3 rounded-xl bg-surface-2 border flex items-center gap-3 ${restLeft > 0 ? 'border-white' : 'border-line'}`}
              role="group"
              aria-label="Timer istirahat"
            >
              <div className="text-center font-mono min-w-14">
                <div className="text-[9px] uppercase tracking-wider text-zinc-400 flex items-center justify-center gap-1">
                  <Timer className="w-3 h-3" /> Istirahat
                </div>
                <div className={`text-base font-black tabular-nums ${restLeft > 0 ? 'text-white' : 'text-zinc-500'}`}>
                  {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {REST_PRESETS.map(sec => (
                  <button
                    key={sec}
                    onClick={() => startRest(sec)}
                    className="px-2.5 py-1.5 rounded bg-white/10 hover:bg-white hover:text-black text-[11px] font-bold text-zinc-200 transition-colors"
                  >
                    {sec}s
                  </button>
                ))}
                {restLeft > 0 && (
                  <button onClick={() => setRestLeft(0)} aria-label="Hentikan timer istirahat" className="p-1.5 rounded bg-rose-950/40 text-rose-300 hover:bg-rose-900/60">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {activeExercises.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-6">Belum ada latihan. Pilih gerakan dari pustaka untuk mulai mencatat.</p>
          )}

          <div className="space-y-5">
            {activeExercises.map((ex, exIdx) => (
              <div key={`${ex.exerciseId}-${exIdx}`} className="p-4 rounded-xl bg-surface-2 border border-line space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-white text-black font-extrabold text-xs flex items-center justify-center shrink-0">{exIdx + 1}</span>
                    <h3 className="text-sm font-bold text-white truncate">{ex.exerciseName}</h3>
                  </div>
                  <button onClick={() => removeExercise(exIdx)} aria-label={`Hapus ${ex.exerciseName}`} className="p-1.5 rounded text-zinc-400 hover:text-rose-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-zinc-500 font-semibold border-b border-line">
                        <th className="py-1.5 w-10 text-center">Set</th>
                        <th className="py-1.5">Beban (kg)</th>
                        <th className="py-1.5">Reps</th>
                        <th className="py-1.5">RPE</th>
                        <th className="py-1.5 text-center">PR</th>
                        <th className="py-1.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line font-tabular">
                      {ex.sets.map((s, sIdx) => (
                        <tr key={sIdx}>
                          <td className="py-2 text-center font-bold text-zinc-400">{s.setNumber}</td>
                          <td className="py-2">
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.5"
                              aria-label={`Beban set ${s.setNumber}`}
                              value={s.weightKg}
                              onChange={e => updateSet(exIdx, sIdx, 'weightKg', Math.max(0, parseFloat(e.target.value) || 0))}
                              className={`w-20 ${inputClass}`}
                            />
                          </td>
                          <td className="py-2">
                            <input
                              type="number"
                              inputMode="numeric"
                              min="1"
                              aria-label={`Repetisi set ${s.setNumber}`}
                              value={s.reps}
                              onChange={e => updateSet(exIdx, sIdx, 'reps', Math.max(1, parseInt(e.target.value, 10) || 1))}
                              className={`w-16 ${inputClass}`}
                            />
                          </td>
                          <td className="py-2">
                            <input
                              type="number"
                              inputMode="decimal"
                              min="1"
                              max="10"
                              step="0.5"
                              aria-label={`RPE set ${s.setNumber}`}
                              value={s.rpe ?? ''}
                              placeholder="7-10"
                              onChange={e => {
                                const v = parseFloat(e.target.value);
                                updateSet(exIdx, sIdx, 'rpe', isNaN(v) ? undefined : Math.min(10, Math.max(1, v)));
                              }}
                              className={`w-16 ${inputClass} font-normal`}
                            />
                          </td>
                          <td className="py-2 text-center">
                            <button
                              type="button"
                              onClick={() => updateSet(exIdx, sIdx, 'isPr', !s.isPr)}
                              aria-pressed={!!s.isPr}
                              aria-label={`Tandai set ${s.setNumber} sebagai rekor`}
                              className={`p-1.5 rounded transition-colors ${s.isPr ? 'text-amber-300 bg-amber-500/15' : 'text-zinc-600 hover:text-zinc-300'}`}
                            >
                              <Trophy className="w-4 h-4" />
                            </button>
                          </td>
                          <td className="py-2 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <button type="button" onClick={() => duplicateSet(exIdx, sIdx)} aria-label="Salin set" title="Salin set" className="p-1.5 rounded text-zinc-400 hover:text-white">
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => removeSet(exIdx, sIdx)} aria-label="Hapus set" title="Hapus set" className="p-1.5 rounded text-zinc-500 hover:text-rose-400">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => addSet(exIdx)} className="text-xs font-semibold text-white hover:underline flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Tambah set
                  </button>
                  <span className="text-[11px] text-zinc-500 font-mono">Volume: {volumeOf(ex.sets).toLocaleString('id-ID')} kg</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowPicker(true)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-dashed border-line-strong hover:border-white text-xs font-bold text-zinc-300 hover:text-white flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tambah latihan dari pustaka ({exercises.length} gerakan)
          </button>

          <div className="pt-4 border-t border-line grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label htmlFor="duration" className="block text-zinc-400 font-semibold mb-1">
                Durasi (menit)
              </label>
              <input
                id="duration"
                type="number"
                min="1"
                value={durationMinutes}
                onChange={e => setDurationMinutes(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-surface-2 border border-line-strong rounded-lg px-3 py-2 text-white focus:outline-none focus:border-white"
              />
            </div>
            <div>
              <label htmlFor="mood" className="block text-zinc-400 font-semibold mb-1">
                Mood & energi
              </label>
              <select
                id="mood"
                value={moodRating}
                onChange={e => setMoodRating(parseInt(e.target.value, 10))}
                className="w-full bg-surface-2 border border-line-strong rounded-lg px-3 py-2 text-white focus:outline-none focus:border-white"
              >
                <option value={5}>5 – Sangat bertenaga</option>
                <option value={4}>4 – Bagus & fokus</option>
                <option value={3}>3 – Standar</option>
                <option value={2}>2 – Agak lelah</option>
                <option value={1}>1 – Drop / pemulihan kurang</option>
              </select>
            </div>
            <div>
              <label htmlFor="notes" className="block text-zinc-400 font-semibold mb-1">
                Catatan
              </label>
              <input
                id="notes"
                type="text"
                maxLength={200}
                placeholder="Misal: squat terasa ringan, lutut aman"
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
                className="w-full bg-surface-2 border border-line-strong rounded-lg px-3 py-2 text-white focus:outline-none focus:border-white"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-line flex items-center justify-end gap-3">
            <button
              onClick={() => {
                setIsLoggingActive(false);
                setActiveExercises([]);
                setRestLeft(0);
              }}
              className="px-4 py-2.5 rounded-xl bg-surface-2 border border-line hover:border-line-strong text-xs font-semibold text-zinc-300 transition-colors"
            >
              Batalkan
            </button>
            <button
              onClick={finishSession}
              className="px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              Selesaikan & simpan
            </button>
          </div>
        </section>
      )}

      {/* Exercise picker */}
      <Modal isOpen={showPicker} onClose={() => setShowPicker(false)} label="Pilih latihan dari pustaka" maxWidth="max-w-2xl">
        <div className="p-6 space-y-4 flex flex-col max-h-[85vh]">
          <div className="pb-3 border-b border-line pr-8">
            <h2 className="text-base font-bold text-white">Pilih latihan</h2>
            <p className="text-xs text-zinc-400">{filteredLibrary.length} dari {exercises.length} gerakan</p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cari nama gerakan, otot, atau alat"
              aria-label="Cari latihan"
              className="w-full bg-surface-2 border border-line rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                aria-pressed={category === cat}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  category === cat ? 'bg-white text-black' : 'bg-surface-2 border border-line text-zinc-300 hover:border-line-strong'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <ul className="overflow-y-auto space-y-2 pr-1 flex-1 min-h-40">
            {filteredLibrary.length === 0 && <li className="text-xs text-zinc-500 text-center py-8">Tidak ada gerakan yang cocok.</li>}
            {filteredLibrary.map(ex => (
              <li key={ex.id}>
                <button
                  onClick={() => addExercise(ex)}
                  className="w-full p-3 rounded-xl bg-surface-2 border border-line hover:border-white text-left transition-colors flex items-center justify-between gap-3 group"
                >
                  <span>
                    <span className="text-xs font-bold text-white block">{ex.name}</span>
                    <span className="text-[11px] text-zinc-400">
                      {ex.primaryMuscle} · {ex.equipment} · {ex.difficulty}
                    </span>
                  </span>
                  <span className="p-1 rounded bg-white/10 text-white group-hover:bg-white group-hover:text-black transition-colors">
                    <Plus className="w-4 h-4" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Modal>

      {/* History */}
      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Flame className="w-4 h-4 text-zinc-400" />
            Riwayat sesi latihan
          </h2>
          <span className="text-xs text-zinc-400 font-mono">{memberLogs.length} sesi</span>
        </div>

        {memberLogs.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">Belum ada catatan latihan. Mulai sesi pertama Anda untuk memantau beban.</p>
        ) : (
          <div className="space-y-4">
            {memberLogs.map(log => (
              <article key={log.id} className="p-4 rounded-xl bg-surface-2 border border-line space-y-3 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-white">{log.title}</h3>
                      {log.prAchieved && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-400 text-black flex items-center gap-1">
                          <Trophy className="w-3 h-3" /> Rekor PR
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                      {formatDateId(log.date)} · {log.durationMinutes} menit · Mood {log.moodRating}/5
                    </div>
                  </div>
                  <div className="font-tabular sm:text-right">
                    <div className="text-sm font-black text-white">{log.totalVolumeKg.toLocaleString('id-ID')} kg</div>
                    <div className="text-[10px] text-zinc-500">Total volume</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
                  {log.exercises.map((e, i) => (
                    <span key={i} className="text-[11px] px-2.5 py-1 rounded-md bg-white/5 border border-line text-zinc-300">
                      <strong>{e.exerciseName}</strong>: {e.sets.length} set, maks {e.sets.length ? Math.max(...e.sets.map(s => s.weightKg)) : 0} kg
                    </span>
                  ))}
                </div>

                {log.notes && <p className="text-[11px] text-zinc-400 italic">"{log.notes}"</p>}

                {log.coachFeedback && (
                  <div className="p-3 rounded-lg bg-black/40 border border-line flex items-start gap-2.5">
                    <MessageSquare className="w-4 h-4 text-zinc-300 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Komentar coach</span>
                      <p className="text-xs text-zinc-200 mt-0.5">{log.coachFeedback}</p>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
