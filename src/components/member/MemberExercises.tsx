import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { Exercise, WorkoutProgram } from '../../types';
import { Search, Zap, ArrowRight } from 'lucide-react';
import { Modal } from '../common/Modal';

const CATEGORIES = ['Semua', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];
const GOALS = ['Hipertrofi', 'Fat Loss', 'Kekuatan', 'Kebugaran Umum'] as const;
const LEVELS = ['Pemula', 'Menengah', 'Lanjutan'] as const;
const FREQUENCIES = [2, 3, 4, 5];

type Goal = (typeof GOALS)[number];
type Level = (typeof LEVELS)[number];

const choice = (active: boolean) =>
  `p-2.5 rounded-lg border text-center text-xs font-semibold transition-colors ${
    active ? 'bg-white text-black border-white' : 'bg-surface-2 border-line text-zinc-300 hover:border-line-strong'
  }`;

/** Score every program against the quiz answers; the best score wins. */
function recommend(programs: WorkoutProgram[], goal: Goal, level: Level, days: number): WorkoutProgram | null {
  let best: WorkoutProgram | null = null;
  let bestScore = -1;
  programs.forEach(p => {
    const score = (p.target === goal ? 4 : 0) + (p.level === level ? 2 : 0) + Math.max(0, 2 - Math.abs(p.frequencyPerWeek - days));
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  });
  return best;
}

export const MemberExercises: React.FC = () => {
  const { exercises, workoutPrograms, setMemberTab, setSuggestedProgramId, currentUser } = useApp();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Semua');
  const [detail, setDetail] = useState<Exercise | null>(null);

  const [showQuiz, setShowQuiz] = useState(false);
  const [goal, setGoal] = useState<Goal>('Hipertrofi');
  const [level, setLevel] = useState<Level>('Pemula');
  const [days, setDays] = useState(3);

  // Only programs this member may use: their own plus general templates
  const available = useMemo(
    () => workoutPrograms.filter(p => !p.assignedToMemberId || p.assignedToMemberId === currentUser?.id),
    [workoutPrograms, currentUser?.id]
  );
  const recommended = useMemo(() => recommend(available, goal, level, days), [available, goal, level, days]);

  const q = search.trim().toLowerCase();
  const filtered = exercises.filter(
    e =>
      (category === 'Semua' || e.category === category) &&
      (!q || `${e.name} ${e.primaryMuscle} ${e.equipment}`.toLowerCase().includes(q))
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="bg-surface rounded-2xl border border-line p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.2em]">Pustaka & panduan gerakan</span>
          <h1 className="text-2xl font-extrabold uppercase text-white mt-0.5">Database latihan</h1>
          <p className="text-xs text-zinc-400 mt-1">{exercises.length} gerakan lengkap dengan tips form dan kesalahan umum.</p>
        </div>
        <button
          onClick={() => setShowQuiz(true)}
          className="px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-colors flex items-center gap-2 shrink-0 self-start md:self-auto"
        >
          <Zap className="w-4 h-4" />
          Kuis rekomendasi program
        </button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden />
          <input
            type="search"
            aria-label="Cari gerakan atau otot"
            placeholder="Cari gerakan, otot, atau alat (mis. bench press, lat, dumbbell)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-surface border border-line rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter kategori">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              aria-pressed={category === cat}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                category === cat ? 'bg-white text-black border-white' : 'bg-surface border-line text-zinc-400 hover:text-white hover:border-line-strong'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-14 border border-dashed border-line rounded-2xl">
          <p className="text-sm text-zinc-400 mb-3">Tidak ada gerakan yang cocok dengan pencarian Anda.</p>
          <button
            onClick={() => {
              setSearch('');
              setCategory('Semua');
            }}
            className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-zinc-200"
          >
            Atur ulang filter
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(ex => (
            <li key={ex.id}>
              <button
                onClick={() => setDetail(ex)}
                className="w-full h-full text-left p-5 rounded-2xl bg-surface border border-line hover:border-white transition-colors flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-[11px] font-bold text-zinc-300">{ex.category}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-zinc-300">{ex.difficulty}</span>
                  </div>
                  <h2 className="text-sm font-bold text-white mb-2">{ex.name}</h2>
                  <div className="space-y-1 text-xs text-zinc-400 mb-4">
                    <div>
                      Otot utama: <strong className="text-zinc-200">{ex.primaryMuscle}</strong>
                    </div>
                    <div>
                      Alat: <span className="text-zinc-300">{ex.equipment}</span>
                    </div>
                  </div>
                </div>
                <div className="pt-3 border-t border-line flex items-center justify-between text-xs text-zinc-400">
                  <span>{ex.instructions.length} langkah form</span>
                  <span className="text-white font-bold inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Detail <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} label={detail?.name ?? 'Detail latihan'} maxWidth="max-w-lg">
        {detail && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="pb-3 border-b border-line pr-8">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                {detail.category} · {detail.difficulty}
              </span>
              <h2 className="text-xl font-extrabold text-white mt-0.5">{detail.name}</h2>
            </div>
            <div className="text-xs space-y-5">
              <p className="text-zinc-300">
                Otot: <strong className="text-white">{detail.primaryMuscle}</strong> · Alat: {detail.equipment}
              </p>
              <div>
                <h3 className="text-zinc-500 font-bold uppercase text-[10px] tracking-wider mb-2">Langkah gerakan</h3>
                <ol className="space-y-1.5 list-decimal list-inside text-zinc-300 leading-relaxed">
                  {detail.instructions.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-2 border border-line-strong space-y-1">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">Kunci form sempurna</h3>
                <p className="text-zinc-200 leading-relaxed">{detail.formTips}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/40 space-y-1">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-rose-300">Kesalahan yang sering terjadi</h3>
                <p className="text-rose-200/90 leading-relaxed">{detail.commonMistakes}</p>
              </div>
            </div>
            <button onClick={() => setDetail(null)} className="w-full py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm">
              Tutup
            </button>
          </div>
        )}
      </Modal>

      <Modal isOpen={showQuiz} onClose={() => setShowQuiz(false)} label="Kuis rekomendasi program latihan" maxWidth="max-w-lg">
        <div className="p-6 sm:p-8 space-y-6">
          <div className="pb-3 border-b border-line pr-8">
            <h2 className="text-lg font-extrabold uppercase text-white">Kuis rekomendasi program</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Jawab tiga pertanyaan untuk menemukan split terbaik.</p>
          </div>

          <div className="space-y-5 text-xs">
            <fieldset>
              <legend className="block text-zinc-400 font-semibold mb-2">Tujuan utama</legend>
              <div className="grid grid-cols-2 gap-2">
                {GOALS.map(g => (
                  <button key={g} type="button" aria-pressed={goal === g} onClick={() => setGoal(g)} className={choice(goal === g)}>
                    {g}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="block text-zinc-400 font-semibold mb-2">Level pengalaman</legend>
              <div className="grid grid-cols-3 gap-2">
                {LEVELS.map(l => (
                  <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)} className={choice(level === l)}>
                    {l}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="block text-zinc-400 font-semibold mb-2">Hari latihan per minggu</legend>
              <div className="grid grid-cols-4 gap-2">
                {FREQUENCIES.map(d => (
                  <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={choice(days === d)}>
                    {d}x
                  </button>
                ))}
              </div>
            </fieldset>

            {recommended ? (
              <div className="p-4 rounded-xl bg-surface-2 border border-white/60 space-y-2" aria-live="polite">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.2em] block">Paling cocok untuk Anda</span>
                <h3 className="text-sm font-bold text-white">{recommended.title}</h3>
                <p className="text-zinc-300 text-[11px] leading-relaxed">{recommended.description}</p>
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                  <span className="text-zinc-400">
                    {recommended.target} · {recommended.level} · {recommended.frequencyPerWeek}x / minggu
                  </span>
                  <button
                    onClick={() => {
                      setSuggestedProgramId(recommended.id);
                      setShowQuiz(false);
                      setMemberTab('workout-log');
                    }}
                    className="px-3.5 py-2 rounded-lg bg-white text-black font-bold hover:bg-zinc-200"
                  >
                    Mulai dengan program ini
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-zinc-500">Belum ada program yang tersedia.</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
