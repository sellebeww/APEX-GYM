import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Apple, Check, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

export const MacroCalculator: React.FC = () => {
  const { currentUser, updateDailyNutritionTargets, showToast } = useApp();
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE');
  // Raw text state lets the user clear a field while typing; values are clamped to realistic ranges for the maths
  const [ageStr, setAgeStr] = useState('27');
  const [heightStr, setHeightStr] = useState('175');
  const [weightStr, setWeightStr] = useState('75');
  const clamp = (raw: string, min: number, max: number, fallback: number) => {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const age = clamp(ageStr, 14, 90, 27);
  const heightCm = clamp(heightStr, 120, 230, 175);
  const weightKg = clamp(weightStr, 30, 250, 75);
  const [activity, setActivity] = useState<number>(1.55); // 1.2 = Sedentary, 1.375 = Light, 1.55 = Moderate, 1.725 = High, 1.9 = Athlete
  const [goal, setGoal] = useState<'FAT_LOSS' | 'MAINTENANCE' | 'MUSCLE_GAIN'>('FAT_LOSS');
  const [isApplied, setIsApplied] = useState(false);

  // BMR via Mifflin-St Jeor
  const bmr = Math.round(
    gender === 'MALE'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161
  );

  // TDEE
  const tdee = Math.round(bmr * activity);

  // Calorie Target based on goal
  let targetCalories = tdee;
  if (goal === 'FAT_LOSS') {
    targetCalories = Math.round(tdee * 0.8); // 20% deficit
  } else if (goal === 'MUSCLE_GAIN') {
    targetCalories = Math.round(tdee * 1.15); // 15% surplus
  }

  // Macro calculation:
  // Protein: 2.0g per kg of bodyweight
  const targetProtein = Math.round(weightKg * 2.0);
  const proteinCalories = targetProtein * 4;

  // Fat: 25% of total calories
  const fatCalories = Math.round(targetCalories * 0.25);
  const targetFat = Math.round(fatCalories / 9);

  // Carbs: remainder
  const carbsCalories = Math.max(0, targetCalories - proteinCalories - fatCalories);
  const targetCarbs = Math.round(carbsCalories / 4);

  const handleApplyToProfile = async () => {
    if (!currentUser) return;
    const res = await updateDailyNutritionTargets(targetCalories, targetProtein, targetCarbs, targetFat);
    if (!res.success) return showToast(res.message, 'error');
    setIsApplied(true);
    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#F5F5F5', '#38BDF8', '#F97316'],
    });
    setTimeout(() => setIsApplied(false), 3000);
  };

  return (
    <div className="p-6 rounded-3xl bg-surface border border-line shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand">
            <Apple className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Kalkulator Kalori & Makronutrisi Presisi (TDEE)</h3>
            <p className="text-xs text-zinc-400">Formula ilmiah Mifflin-St Jeor untuk pembagian makro atlet</p>
          </div>
        </div>

        <button
          onClick={handleApplyToProfile}
          disabled={isApplied || !currentUser}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
            isApplied
              ? 'bg-emerald-500 text-black'
              : 'bg-brand text-black hover:bg-brand-hover shadow-brand/20'
          }`}
        >
          {isApplied ? (
            <>
              <Check className="w-4 h-4" />
              <span>Target Berhasil Diterapkan!</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              <span>Terapkan ke Target Harian Saya</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Inputs (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Gender & Age */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span id="mc-gender-label" className="block text-xs font-semibold text-zinc-400 mb-1">Jenis Kelamin</span>
              <div role="group" aria-labelledby="mc-gender-label" className="grid grid-cols-2 gap-1.5 p-1 bg-black/50 rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setGender('MALE')}
                  aria-pressed={gender === 'MALE'}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    gender === 'MALE' ? 'bg-brand text-black' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Pria
                </button>
                <button
                  type="button"
                  onClick={() => setGender('FEMALE')}
                  aria-pressed={gender === 'FEMALE'}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    gender === 'FEMALE' ? 'bg-brand text-black' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Wanita
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="mc-age" className="block text-xs font-semibold text-zinc-400 mb-1">Usia (Tahun)</label>
              <input
                type="number"
                id="mc-age"
                value={ageStr}
                min={14}
                max={90}
                inputMode="numeric"
                onChange={e => setAgeStr(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-black/50 border border-zinc-800 text-sm font-mono text-white focus:outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* Height & Weight */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="mc-height" className="block text-xs font-semibold text-zinc-400 mb-1">Tinggi Badan (cm)</label>
              <input
                type="number"
                id="mc-height"
                value={heightStr}
                min={120}
                max={230}
                inputMode="numeric"
                onChange={e => setHeightStr(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-black/50 border border-zinc-800 text-sm font-mono text-white focus:outline-none focus:border-brand"
              />
            </div>
            <div>
              <label htmlFor="mc-weight" className="block text-xs font-semibold text-zinc-400 mb-1">Berat Badan (kg)</label>
              <input
                type="number"
                id="mc-weight"
                value={weightStr}
                min={30}
                max={250}
                inputMode="decimal"
                onChange={e => setWeightStr(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-black/50 border border-zinc-800 text-sm font-mono text-white focus:outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* Activity Level */}
          <div>
            <label htmlFor="mc-activity" className="block text-xs font-semibold text-zinc-400 mb-1.5">Tingkat Aktivitas Fisik</label>
            <select
              id="mc-activity"
                value={activity}
              onChange={e => setActivity(parseFloat(e.target.value))}
              className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-xs text-white focus:outline-none focus:border-brand"
            >
              <option value={1.2} className="bg-zinc-900">Sedentari (Kerja Meja, Minim Olahraga)</option>
              <option value={1.375} className="bg-zinc-900">Ringan (Olahraga 1 - 3 hari/minggu)</option>
              <option value={1.55} className="bg-zinc-900">Moderat (Latihan Beban 3 - 5 hari/minggu)</option>
              <option value={1.725} className="bg-zinc-900">Tinggi (Latihan Berat 6 - 7 hari/minggu)</option>
              <option value={1.9} className="bg-zinc-900">Atletik (Latihan 2x sehari / Kompetisi)</option>
            </select>
          </div>

          {/* Goal Selector */}
          <div>
            <span id="mc-goal-label" className="block text-xs font-semibold text-zinc-400 mb-1.5">Target Kebugaran Utama</span>
            <div role="group" aria-labelledby="mc-goal-label" className="grid grid-cols-3 gap-1.5 p-1 bg-black/50 rounded-2xl border border-zinc-800">
              <button
                type="button"
                onClick={() => setGoal('FAT_LOSS')}
                aria-pressed={goal === 'FAT_LOSS'}
                className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
                  goal === 'FAT_LOSS' ? 'bg-brand text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Fat Loss (-20%)
              </button>
              <button
                type="button"
                onClick={() => setGoal('MAINTENANCE')}
                aria-pressed={goal === 'MAINTENANCE'}
                className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
                  goal === 'MAINTENANCE' ? 'bg-brand text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Maintenance
              </button>
              <button
                type="button"
                onClick={() => setGoal('MUSCLE_GAIN')}
                aria-pressed={goal === 'MUSCLE_GAIN'}
                className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
                  goal === 'MUSCLE_GAIN' ? 'bg-brand text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Bulking (+15%)
              </button>
            </div>
          </div>
        </div>

        {/* Right Output Dashboard (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main Calorie Output Card */}
          <div className="p-5 rounded-2xl bg-linear-to-br from-black/80 to-surface-2 border border-brand/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
                  Target Asupan Kalori Harian
                </span>
                <div className="text-4xl sm:text-5xl font-black font-mono text-brand tracking-tight mt-1">
                  {targetCalories} <span className="text-base font-normal font-sans text-zinc-300">kkal / hari</span>
                </div>
                <div className="text-xs text-zinc-400 mt-1">
                  BMR: <span className="font-mono text-white">{bmr} kkal</span> | TDEE Pemeliharaan:{' '}
                  <span className="font-mono text-white">{tdee} kkal</span>
                </div>
              </div>

              <div className="sm:text-right">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Strategi</span>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-brand/10 border border-brand/30 text-brand">
                  {goal === 'FAT_LOSS' ? 'Defisit Kalori Terkontrol' : goal === 'MAINTENANCE' ? 'Rekomposisi Tubuh' : 'Surplus Massa Otot'}
                </span>
              </div>
            </div>

            {/* Macro Breakdown Strip */}
            <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-zinc-800 text-center">
              {/* Protein */}
              <div className="p-3 rounded-xl bg-black/40 border border-sky-500/20">
                <span className="text-[10px] font-mono text-sky-400 uppercase tracking-wider block">Protein (4 kkal)</span>
                <span className="text-xl font-black font-mono text-white">{targetProtein} g</span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">{proteinCalories} kkal</span>
              </div>

              {/* Karbohidrat */}
              <div className="p-3 rounded-xl bg-black/40 border border-brand/20">
                <span className="text-[10px] font-mono text-brand uppercase tracking-wider block">Karbohidrat (4 kkal)</span>
                <span className="text-xl font-black font-mono text-white">{targetCarbs} g</span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">{carbsCalories} kkal</span>
              </div>

              {/* Lemak */}
              <div className="p-3 rounded-xl bg-black/40 border border-amber-500/20">
                <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider block">Lemak Sehat (9 kkal)</span>
                <span className="text-xl font-black font-mono text-white">{targetFat} g</span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">{fatCalories} kkal</span>
              </div>
            </div>
          </div>

          {/* Meal Portions Advice */}
          <div className="p-4 rounded-2xl bg-black/40 border border-zinc-800/80 space-y-2">
            <h4 className="text-xs font-bold text-zinc-300">Rekomendasi Pembagian 4 Waktu Makan</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">Sarapan (25%)</span>
                <span className="font-mono font-bold text-white">{Math.round(targetCalories * 0.25)} kkal</span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">Makan Siang (35%)</span>
                <span className="font-mono font-bold text-white">{Math.round(targetCalories * 0.35)} kkal</span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">Pre/Post Workout (15%)</span>
                <span className="font-mono font-bold text-white">{Math.round(targetCalories * 0.15)} kkal</span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">Makan Malam (25%)</span>
                <span className="font-mono font-bold text-white">{Math.round(targetCalories * 0.25)} kkal</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
