import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Droplet, CheckCircle2, Circle, Flame, Award, Plus, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { readJson, writeJson } from '../../lib/storage';
import { toDateKey } from '../../lib/membership';

type HabitCategory = 'Latihan' | 'Nutrisi' | 'Pemulihan';

interface Habit {
  id: string;
  label: string;
  category: HabitCategory;
}

const WATER_TARGET_ML = 3000;

const HABITS: Habit[] = [
  { id: 'h-1', label: 'Minum air putih minimal 3 liter', category: 'Nutrisi' },
  { id: 'h-2', label: 'Tuntaskan target repetisi & latihan harian', category: 'Latihan' },
  { id: 'h-3', label: 'Capai target protein harian', category: 'Nutrisi' },
  { id: 'h-4', label: 'Suplemen creatine 5 g & multivitamin', category: 'Nutrisi' },
  { id: 'h-5', label: 'Tidur berkualitas 7–8 jam', category: 'Pemulihan' },
  { id: 'h-6', label: 'Peregangan / mobilitas 10 menit', category: 'Pemulihan' },
];

interface DailyState {
  date: string;
  waterMl: number;
  done: string[];
}

const storageKey = (userId: string) => `apex.daily.${userId}`;

/** Per-member, per-day checklist state; resets automatically when the date changes. */
function loadState(userId: string): DailyState {
  const today = toDateKey();
  const saved = readJson<DailyState | null>(storageKey(userId), null);
  return saved && saved.date === today ? saved : { date: today, waterMl: 0, done: [] };
}

const chip = 'text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-400 shrink-0 font-mono';

export const MemberDailyHabits: React.FC = () => {
  const { currentUser, showToast } = useApp();
  const userId = currentUser?.id ?? 'guest';
  const [state, setState] = useState<DailyState>(() => loadState(userId));

  // Reload when the signed-in member changes
  useEffect(() => {
    setState(loadState(userId));
  }, [userId]);

  useEffect(() => {
    writeJson(storageKey(userId), state);
  }, [state, userId]);

  const celebrate = (colors: string[], particleCount: number) => {
    try {
      confetti({ particleCount, spread: 60, origin: { y: 0.7 }, colors });
    } catch {
      /* cosmetic */
    }
  };

  const addWater = (amount: number) => {
    const next = Math.min(state.waterMl + amount, 5000);
    setState({ ...state, waterMl: next });
    if (state.waterMl < WATER_TARGET_ML && next >= WATER_TARGET_ML) {
      showToast('Target hidrasi harian tercapai. Pertahankan!', 'success');
      celebrate(['#38BDF8', '#F5F5F5', '#FFFFFF'], 60);
    } else {
      showToast(`+${amount} ml air dicatat`, 'info');
    }
  };

  const resetWater = () => {
    setState({ ...state, waterMl: 0 });
    showToast('Pelacak air diatur ulang ke 0 ml.', 'info');
  };

  const toggleHabit = (id: string) => {
    const done = state.done.includes(id) ? state.done.filter(x => x !== id) : [...state.done, id];
    setState({ ...state, done });
    if (done.length === HABITS.length && state.done.length < HABITS.length) {
      showToast(`Seluruh ${HABITS.length} rutinitas hari ini selesai!`, 'success');
      celebrate(['#F5F5F5', '#38BDF8', '#F59E0B'], 90);
    }
  };

  const waterPercent = Math.min(Math.round((state.waterMl / WATER_TARGET_ML) * 100), 100);
  const habitPercent = Math.round((state.done.length / HABITS.length) * 100);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      {/* Hydration */}
      <section className="p-6 rounded-2xl bg-surface border border-line flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Droplet className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-white">Hidrasi harian</h2>
                <p className="text-[10px] text-zinc-400">Target {WATER_TARGET_ML.toLocaleString('id-ID')} ml / hari</p>
              </div>
            </div>
            <button
              onClick={resetWater}
              aria-label="Atur ulang pelacak air"
              title="Atur ulang"
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-4 flex items-end justify-between font-tabular">
            <div>
              <span className="text-3xl font-black text-white">{state.waterMl.toLocaleString('id-ID')}</span>
              <span className="text-xs text-zinc-400 ml-1">/ {WATER_TARGET_ML} ml</span>
            </div>
            <span
              className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                waterPercent >= 100 ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'bg-white/10 text-zinc-300'
              }`}
            >
              {waterPercent}%
            </span>
          </div>

          <div
            role="progressbar"
            aria-label="Progres hidrasi"
            aria-valuenow={waterPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-full h-2.5 rounded-full bg-black/60 overflow-hidden mt-3 border border-line"
          >
            <div className="h-full rounded-full bg-sky-400 transition-all duration-500" style={{ width: `${waterPercent}%` }} />
          </div>
        </div>

        <div className="pt-3 border-t border-line flex items-center gap-2">
          {[
            { ml: 250, label: 'Gelas' },
            { ml: 500, label: 'Shaker' },
            { ml: 750, label: 'Botol' },
          ].map(b => (
            <button
              key={b.ml}
              onClick={() => addWater(b.ml)}
              className="flex-1 py-2 px-2 rounded-xl bg-surface-2 border border-line hover:border-sky-500/60 hover:text-sky-300 text-xs font-semibold text-zinc-200 transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {b.ml} ml <span className="hidden lg:inline text-zinc-500">({b.label})</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Daily checklist */}
      <section className="p-6 rounded-2xl bg-surface border border-line flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/10 border border-line-strong flex items-center justify-center text-white">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-white">Rutinitas harian</h2>
                <p className="text-[10px] text-zinc-400">Disiplin membangun hasil nyata</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold font-mono text-white">
                {state.done.length} / {HABITS.length}
              </span>
              <span className="text-[10px] text-zinc-500 block">{habitPercent}% selesai</span>
            </div>
          </div>

          <ul className="mt-3 space-y-2">
            {HABITS.map(habit => {
              const completed = state.done.includes(habit.id);
              return (
                <li key={habit.id}>
                  <button
                    onClick={() => toggleHabit(habit.id)}
                    aria-pressed={completed}
                    className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 border transition-colors ${
                      completed
                        ? 'bg-surface-2 border-line-strong text-zinc-300'
                        : 'bg-surface-2 border-line text-zinc-400 hover:text-zinc-200 hover:border-line-strong'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-zinc-600 shrink-0" />
                      )}
                      <span className={`truncate ${completed ? 'line-through text-zinc-500' : 'font-medium'}`}>{habit.label}</span>
                    </span>
                    <span className={chip}>{habit.category}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {habitPercent === 100 && (
          <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800 text-[11px] text-emerald-300 flex items-center gap-2">
            <Award className="w-4 h-4 shrink-0" />
            <span className="font-semibold">Semua target hari ini selesai. Istirahat cukup untuk pemulihan optimal.</span>
          </div>
        )}
      </section>
    </div>
  );
};
