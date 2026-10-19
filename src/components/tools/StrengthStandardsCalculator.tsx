import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Trophy, Check, Zap, Target } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ExerciseBenchmark {
  name: string;
  category: string;
  noviceMultiplier: number;
  intermediateMultiplier: number;
  advancedMultiplier: number;
  eliteMultiplier: number;
}

const EXERCISE_BENCHMARKS: ExerciseBenchmark[] = [
  {
    name: 'Barbell Back Squat',
    category: 'Lower Body Quad & Hip',
    noviceMultiplier: 1.0,
    intermediateMultiplier: 1.5,
    advancedMultiplier: 1.9,
    eliteMultiplier: 2.3,
  },
  {
    name: 'Barbell Bench Press',
    category: 'Upper Body Push',
    noviceMultiplier: 0.8,
    intermediateMultiplier: 1.15,
    advancedMultiplier: 1.5,
    eliteMultiplier: 1.85,
  },
  {
    name: 'Conventional Deadlift',
    category: 'Posterior Chain',
    noviceMultiplier: 1.2,
    intermediateMultiplier: 1.75,
    advancedMultiplier: 2.2,
    eliteMultiplier: 2.65,
  },
  {
    name: 'Standing Overhead Press',
    category: 'Shoulder & Core Stability',
    noviceMultiplier: 0.5,
    intermediateMultiplier: 0.75,
    advancedMultiplier: 0.95,
    eliteMultiplier: 1.2,
  },
  {
    name: 'Barbell Bent-over Row',
    category: 'Upper Body Pull',
    noviceMultiplier: 0.65,
    intermediateMultiplier: 0.95,
    advancedMultiplier: 1.25,
    eliteMultiplier: 1.5,
  },
];

export const StrengthStandardsCalculator: React.FC = () => {
  const { currentUser, savePersonalRecord, showToast } = useApp();
  const [selectedExercise, setSelectedExercise] = useState<string>('Barbell Back Squat');
  const [weightKg, setWeightKg] = useState<number>(100);
  const [reps, setReps] = useState<number>(5);
  const [bodyweightKg, setBodyweightKg] = useState<number>(75);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // 1RM Formulas
  // Epley: w * (1 + r / 30)
  const epley1RM = Math.round(weightKg * (1 + reps / 30));
  // Brzycki: w * (36 / (37 - r))
  const brzycki1RM = reps === 1 ? weightKg : Math.round(weightKg * (36 / (37 - reps)));
  // Lombardi: w * (r ^ 0.10)
  const lombardi1RM = Math.round(weightKg * Math.pow(reps, 0.1));
  // Consensus average
  const estimated1RM = reps === 1 ? weightKg : Math.round((epley1RM + brzycki1RM + lombardi1RM) / 3);

  // Relative strength ratio to bodyweight
  const ratio = (estimated1RM / (bodyweightKg || 75)).toFixed(2);

  // Determine standard
  const bench = EXERCISE_BENCHMARKS.find(b => b.name === selectedExercise) || EXERCISE_BENCHMARKS[0];
  let strengthLevel = { label: 'Pemula (Novice)', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
  const floatRatio = parseFloat(ratio);
  if (floatRatio >= bench.eliteMultiplier) {
    strengthLevel = { label: 'Elite (Atlet Nasional)', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
  } else if (floatRatio >= bench.advancedMultiplier) {
    strengthLevel = { label: 'Lanjutan (Advanced)', color: 'text-brand bg-brand/10 border-brand/30' };
  } else if (floatRatio >= bench.intermediateMultiplier) {
    strengthLevel = { label: 'Menengah (Intermediate)', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
  }

  // Percentage table
  const percentages = [
    { percent: 95, reps: '2 reps', focus: 'Kekuatan Maksimal' },
    { percent: 90, reps: '3 - 4 reps', focus: 'Kekuatan & Tenaga' },
    { percent: 85, reps: '5 - 6 reps', focus: 'Kekuatan Fungsional' },
    { percent: 80, reps: '7 - 8 reps', focus: 'Hipertrofi Berat' },
    { percent: 75, reps: '9 - 10 reps', focus: 'Hipertrofi Klasik' },
    { percent: 70, reps: '11 - 12 reps', focus: 'Hipertrofi & Volume' },
    { percent: 65, reps: '13 - 15 reps', focus: 'Endurans Otot' },
  ];

  const handleSaveToPr = async () => {
    const res = await savePersonalRecord(selectedExercise, weightKg, reps);
    if (!res.success) return showToast(res.message, 'error');
    setIsSaved(true);
    confetti({
      particleCount: 75,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#F5F5F5', '#FFFFFF', '#F59E0B'],
    });
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="p-6 rounded-3xl bg-surface border border-line shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Kalkulator 1-Rep Max (1RM) & Standar Kekuatan</h3>
            <p className="text-xs text-zinc-400">Prediksi beban maksimum dan matriks latihan persentase</p>
          </div>
        </div>

        <button
          onClick={handleSaveToPr}
          disabled={isSaved || !currentUser}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
            isSaved
              ? 'bg-emerald-500 text-black'
              : 'bg-brand text-black hover:bg-brand-hover shadow-brand/20'
          }`}
        >
          {isSaved ? (
            <>
              <Check className="w-4 h-4" />
              <span>Tersimpan di PR!</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              <span>Simpan ke Rekor Pribadi (PR)</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Inputs (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Exercise Selection */}
          <div>
            <label htmlFor="sc-exercise" className="block text-xs font-semibold text-zinc-400 mb-1.5">Gerakan Angkatan Utama</label>
            <select
              id="sc-exercise"
              value={selectedExercise}
              onChange={e => setSelectedExercise(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-zinc-800 text-sm text-white focus:outline-none focus:border-brand"
            >
              {EXERCISE_BENCHMARKS.map(b => (
                <option key={b.name} value={b.name} className="bg-zinc-900 text-white">
                  {b.name}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-zinc-500 mt-1 block">{bench.category}</span>
          </div>

          {/* Weight Input */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="sc-weight" className="text-xs font-semibold text-zinc-400">Beban yang Diangkat</label>
              <span className="text-sm font-mono font-bold text-brand">{weightKg} kg</span>
            </div>
            <input
              type="range"
              id="sc-weight"
              min="20"
              max="300"
              step="2.5"
              value={weightKg}
              onChange={e => setWeightKg(parseFloat(e.target.value))}
              className="w-full accent-brand cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono mt-0.5">
              <span>20 kg</span>
              <span>150 kg</span>
              <span>300 kg</span>
            </div>
          </div>

          {/* Reps Input */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="sc-reps" className="text-xs font-semibold text-zinc-400">Repetisi yang Selesai</label>
              <span className="text-sm font-mono font-bold text-white">{reps} reps</span>
            </div>
            <input
              type="range"
              id="sc-reps"
              min="1"
              max="12"
              value={reps}
              onChange={e => setReps(parseInt(e.target.value, 10))}
              className="w-full accent-brand cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono mt-0.5">
              <span>1 (Single)</span>
              <span>5 (Strength)</span>
              <span>12 (Hypertrophy)</span>
            </div>
          </div>

          {/* Bodyweight */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="sc-bw" className="text-xs font-semibold text-zinc-400">Berat Badan Anda</label>
              <span className="text-sm font-mono font-bold text-zinc-300">{bodyweightKg} kg</span>
            </div>
            <input
              type="range"
              id="sc-bw"
              min="45"
              max="130"
              value={bodyweightKg}
              onChange={e => setBodyweightKg(parseInt(e.target.value, 10))}
              className="w-full accent-brand cursor-pointer"
            />
          </div>
        </div>

        {/* Right Output Dashboard (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main 1RM Hero Card */}
          <div className="p-5 rounded-2xl bg-linear-to-br from-black/80 to-surface-2 border border-brand/30 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
                  Estimasi 1-Rep Max (1RM)
                </span>
                <div className="text-4xl sm:text-5xl font-black font-mono text-brand tracking-tight mt-1">
                  {estimated1RM} <span className="text-base font-normal font-sans text-zinc-300">kg</span>
                </div>
                <div className="text-xs text-zinc-400 mt-1">
                  Rasio Kekuatan Relatif: <span className="font-mono text-white font-bold">{ratio}x</span> berat badan
                </div>
              </div>

              <div className="sm:text-right">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Klasifikasi Anda</span>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${strengthLevel.color}`}>
                  {strengthLevel.label}
                </span>
              </div>
            </div>

            {/* Formula Breakdown */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-zinc-800 text-center text-xs">
              <div className="p-2 rounded-xl bg-black/40 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 block">Epley Formula</span>
                <span className="font-mono font-bold text-zinc-200">{epley1RM} kg</span>
              </div>
              <div className="p-2 rounded-xl bg-black/40 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 block">Brzycki Formula</span>
                <span className="font-mono font-bold text-zinc-200">{brzycki1RM} kg</span>
              </div>
              <div className="p-2 rounded-xl bg-black/40 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 block">Lombardi Formula</span>
                <span className="font-mono font-bold text-zinc-200">{lombardi1RM} kg</span>
              </div>
            </div>
          </div>

          {/* Percentage Matrix Table */}
          <div className="p-4 rounded-2xl bg-black/40 border border-zinc-800/80 space-y-2">
            <h4 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-brand" />
              <span>Matriks Beban Program (% dari 1RM)</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {percentages.slice(0, 4).map(p => {
                const targetWeight = Math.round((estimated1RM * p.percent) / 100);
                return (
                  <div key={p.percent} className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center">
                    <span className="text-[10px] font-mono text-brand font-bold block">{p.percent}% 1RM</span>
                    <span className="text-base font-black font-mono text-white">{targetWeight} kg</span>
                    <span className="text-[10px] text-zinc-400 block">{p.reps}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
