import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { MealPlanItem } from '../../types';
import { Calculator, Trash2, Save, Apple } from 'lucide-react';

const MEAL_TIMES: MealPlanItem['mealTime'][] = ['Sarapan', 'Makan Siang', 'Snack Sore', 'Makan Malam', 'Pre/Post Workout'];
const DEFAULT_DISCLAIMER =
  'Panduan gizi olahraga umum untuk klien tanpa kontraindikasi medis. Konsultasikan dengan dokter gizi jika memiliki alergi atau riwayat penyakit ginjal.';

const field =
  'w-full bg-surface-2 border border-line-strong rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white';
const label = 'block text-zinc-400 text-xs font-semibold mb-1.5';
const macroInput = 'w-full bg-transparent text-xl font-black text-white border-b border-line-strong focus:border-white focus:outline-none tabular-nums';

export const CoachNutritionPlanner: React.FC = () => {
  const { foodDatabase, mealPlans, updateMealPlan, currentUser, memberProfiles, users, bodyMeasurements, showToast } = useApp();

  const clients = useMemo(
    () =>
      Object.values(memberProfiles)
        .filter(p => p.assignedCoachId === currentUser?.id)
        .map(p => users.find(u => u.id === p.userId))
        .filter((u): u is NonNullable<typeof u> => !!u),
    [memberProfiles, users, currentUser?.id]
  );

  const [clientId, setClientId] = useState('');
  const [planTitle, setPlanTitle] = useState('');
  const [targets, setTargets] = useState({ cal: '2200', protein: '150', carbs: '250', fat: '65' });
  const [meals, setMeals] = useState<MealPlanItem[]>([]);
  const [supplements, setSupplements] = useState('Creatine 5 g/hari, whey protein setelah latihan, multivitamin pagi.');
  const [hydration, setHydration] = useState('3');
  const [newMealTime, setNewMealTime] = useState<MealPlanItem['mealTime']>('Makan Siang');

  // Calculator (Mifflin-St Jeor)
  const [calc, setCalc] = useState({ weight: '70', height: '170', age: '25', gender: 'male', activity: '1.55', goal: 'maintain' });

  // Load the selected client's current plan (or a blank draft) and their latest weight
  useEffect(() => {
    if (!clientId) return;
    const plan = mealPlans[clientId];
    const name = users.find(u => u.id === clientId)?.name ?? '';
    setPlanTitle(plan?.title ?? `Meal Plan ${name.split(' ')[0]}`);
    setTargets(
      plan
        ? { cal: String(plan.targetCalories), protein: String(plan.targetProtein), carbs: String(plan.targetCarbs), fat: String(plan.targetFat) }
        : { cal: '2200', protein: '150', carbs: '250', fat: '65' }
    );
    setMeals(plan?.meals ?? []);
    setSupplements(plan?.supplementsAdvice ?? 'Creatine 5 g/hari, whey protein setelah latihan, multivitamin pagi.');
    setHydration(String(plan?.hydrationTargetLiters ?? 3));
    const latest = bodyMeasurements.filter(m => m.memberId === clientId).toSorted((a, b) => b.date.localeCompare(a.date))[0];
    if (latest) setCalc(c => ({ ...c, weight: String(latest.weightKg) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    if (!clientId && clients[0]) setClientId(clients[0].id);
  }, [clients, clientId]);

  const num = (v: string, fallback = 0) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const weight = num(calc.weight, 70);
  const bmr = 10 * weight + 6.25 * num(calc.height, 170) - 5 * num(calc.age, 25) + (calc.gender === 'male' ? 5 : -161);
  const tdee = Math.round(bmr * num(calc.activity, 1.55));

  const applyCalculator = () => {
    const finalCal = calc.goal === 'cut' ? tdee - 450 : calc.goal === 'bulk' ? tdee + 350 : tdee;
    const protein = Math.round(weight * 2.1);
    const fat = Math.round((finalCal * 0.25) / 9);
    const carbs = Math.max(0, Math.round((finalCal - protein * 4 - fat * 9) / 4));
    setTargets({ cal: String(finalCal), protein: String(protein), carbs: String(carbs), fat: String(fat) });
    showToast('Target makro diperbarui dari kalkulator.', 'info');
  };

  const addFood = (foodId: string) => {
    const food = foodDatabase.find(f => f.id === foodId);
    if (!food) return;
    setMeals(prev => [
      ...prev,
      { mealTime: newMealTime, foodName: food.indonesianName, portion: food.servingSize, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat },
    ]);
  };

  const planned = meals.reduce(
    (t, m) => ({ cal: t.cal + m.calories, protein: t.protein + m.protein, carbs: t.carbs + m.carbs, fat: t.fat + m.fat }),
    { cal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const calGap = planned.cal - num(targets.cal);

  const save = () => {
    if (!clientId) return showToast('Pilih klien terlebih dahulu.', 'error');
    if (planTitle.trim().length < 3) return showToast('Beri nama meal plan.', 'error');
    if (meals.length === 0) return showToast('Tambahkan minimal satu menu makanan.', 'error');
    const existing = mealPlans[clientId];
    updateMealPlan({
      id: existing?.id ?? `mp-${Date.now()}`,
      title: planTitle.trim(),
      memberId: clientId,
      coachId: currentUser?.id ?? '',
      targetCalories: Math.round(num(targets.cal)),
      targetProtein: Math.round(num(targets.protein)),
      targetCarbs: Math.round(num(targets.carbs)),
      targetFat: Math.round(num(targets.fat)),
      meals,
      // A rewritten menu keeps the client's existing weekly adherence ticks; new plans start empty
      dailyChecked: existing?.dailyChecked ?? Array(7).fill(false),
      hydrationTargetLiters: Math.min(8, Math.max(1, num(hydration, 3))),
      shoppingList: Array.from(new Set(meals.map(m => `${m.foodName} (${m.portion})`))),
      supplementsAdvice: supplements.trim(),
      disclaimer: DEFAULT_DISCLAIMER,
    });
    const name = clients.find(c => c.id === clientId)?.name ?? 'klien';
    showToast(`Meal plan tersimpan. ${name} langsung melihat menu ini di aplikasinya.`, 'success');
  };

  if (clients.length === 0) {
    return (
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-extrabold uppercase text-white mb-6">Nutrisi & meal planner</h1>
        <div className="bg-surface rounded-2xl border border-line p-12 text-center">
          <Apple className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h2 className="text-sm font-bold text-white mb-1">Belum ada klien asuhan</h2>
          <p className="text-xs text-zinc-400">Meal plan disusun untuk klien yang ditugaskan kepada Anda.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold uppercase text-white">Nutrisi & meal planner</h1>
          <p className="text-xs text-zinc-400 mt-1">Hitung kebutuhan energi (Mifflin-St Jeor) dan susun menu makanan lokal untuk klien.</p>
        </div>
        <button onClick={save} className="px-6 py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm transition-colors flex items-center justify-center gap-2">
          <Save className="w-4 h-4" /> Simpan & tugaskan
        </button>
      </div>

      <section className="bg-surface rounded-2xl border border-line p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="np-client" className={label}>Klien</label>
          <select id="np-client" value={clientId} onChange={e => setClientId(e.target.value)} className={field}>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="np-title" className={label}>Nama meal plan</label>
          <input id="np-title" type="text" maxLength={80} value={planTitle} onChange={e => setPlanTitle(e.target.value)} className={field} />
        </div>
      </section>

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 pb-3 border-b border-line">
          <Calculator className="w-4 h-4 text-zinc-400" /> Kalkulator kebutuhan energi
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(
            [
              ['weight', 'Berat (kg)'],
              ['height', 'Tinggi (cm)'],
              ['age', 'Usia'],
            ] as const
          ).map(([k, l]) => (
            <div key={k}>
              <label htmlFor={`calc-${k}`} className={label}>{l}</label>
              <input id={`calc-${k}`} type="number" inputMode="decimal" value={calc[k]} onChange={e => setCalc({ ...calc, [k]: e.target.value })} className={field} />
            </div>
          ))}
          <div>
            <label htmlFor="calc-gender" className={label}>Jenis kelamin</label>
            <select id="calc-gender" value={calc.gender} onChange={e => setCalc({ ...calc, gender: e.target.value })} className={field}>
              <option value="male">Pria</option>
              <option value="female">Wanita</option>
            </select>
          </div>
          <div>
            <label htmlFor="calc-act" className={label}>Aktivitas</label>
            <select id="calc-act" value={calc.activity} onChange={e => setCalc({ ...calc, activity: e.target.value })} className={field}>
              <option value="1.2">Sedentari</option>
              <option value="1.375">Ringan (1–3x)</option>
              <option value="1.55">Moderat (3–5x)</option>
              <option value="1.725">Sangat aktif (6–7x)</option>
            </select>
          </div>
        </div>
        <div className="pt-3 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-tabular">
          <div className="flex items-center gap-8">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase font-bold block">BMR</span>
              <span className="text-base font-bold text-white">{Math.round(bmr)} kkal</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase font-bold block">Maintenance (TDEE)</span>
              <span className="text-base font-bold text-white">{tdee} kkal/hari</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="calc-goal" className="sr-only">Tujuan</label>
            <select id="calc-goal" value={calc.goal} onChange={e => setCalc({ ...calc, goal: e.target.value })} className="bg-surface-2 border border-line-strong rounded-lg px-3 py-2 text-white text-xs">
              <option value="bulk">Lean bulk (+350 kkal)</option>
              <option value="maintain">Maintenance</option>
              <option value="cut">Fat loss (−450 kkal)</option>
            </select>
            <button type="button" onClick={applyCalculator} className="px-4 py-2 rounded-lg bg-white text-black font-bold text-xs hover:bg-zinc-200">
              Terapkan makro
            </button>
          </div>
        </div>
      </section>

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <h2 className="font-bold text-white text-sm">Target nutrisi harian</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-tabular">
          {(
            [
              ['cal', 'Kalori', 'kkal', 'text-zinc-300'],
              ['protein', 'Protein', 'gram', 'text-sky-400'],
              ['carbs', 'Karbohidrat', 'gram', 'text-amber-400'],
              ['fat', 'Lemak', 'gram', 'text-rose-400'],
            ] as const
          ).map(([k, l, unit, tone]) => (
            <div key={k} className="p-3.5 rounded-xl bg-surface-2 border border-line">
              <label htmlFor={`t-${k}`} className={`text-[10px] uppercase font-bold block mb-1 ${tone}`}>{l}</label>
              <input id={`t-${k}`} type="number" min="0" inputMode="numeric" value={targets[k]} onChange={e => setTargets({ ...targets, [k]: e.target.value })} className={macroInput} />
              <span className="text-[10px] text-zinc-500 mt-1 block font-sans">{unit} / hari</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-line">
          <h2 className="font-bold text-white text-sm">Menu makanan</h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <label className="sr-only" htmlFor="np-mealtime">Waktu makan</label>
            <select id="np-mealtime" value={newMealTime} onChange={e => setNewMealTime(e.target.value as MealPlanItem['mealTime'])} className="bg-surface-2 border border-line-strong rounded-lg px-3 py-2 text-white text-xs">
              {MEAL_TIMES.map(t => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="np-food">Tambah makanan</label>
            <select
              id="np-food"
              value=""
              onChange={e => e.target.value && addFood(e.target.value)}
              className="bg-surface-2 border border-line-strong rounded-lg px-3 py-2 text-white text-xs"
            >
              <option value="">+ Tambah makanan ({foodDatabase.length} bahan)…</option>
              {foodDatabase.map(f => (
                <option key={f.id} value={f.id}>
                  {f.indonesianName} ({f.calories} kkal · P {f.protein}g)
                </option>
              ))}
            </select>
          </div>
        </div>

        {meals.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-6">Belum ada menu. Pilih waktu makan lalu tambahkan makanan dari database.</p>
        ) : (
          <ul className="divide-y divide-line text-xs">
            {meals.map((m, idx) => (
              <li key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-zinc-400 text-[10px] uppercase tracking-wider block">{m.mealTime}</span>
                  <span className="font-semibold text-white">{m.foodName}</span>
                  <span className="text-[11px] text-zinc-400 block mt-0.5">{m.portion}</span>
                </div>
                <div className="flex items-center gap-4 font-mono text-zinc-300">
                  <span className="font-bold text-white">{m.calories} kkal</span>
                  <span className="text-zinc-400">P {m.protein} · K {m.carbs} · L {m.fat}</span>
                  <button onClick={() => setMeals(prev => prev.filter((_, i) => i !== idx))} aria-label={`Hapus ${m.foodName}`} className="p-1.5 text-zinc-500 hover:text-rose-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {meals.length > 0 && (
          <div className="pt-3 border-t border-line grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-sans font-bold">Total menu</span>
              <span className={`font-bold ${Math.abs(calGap) > 150 ? 'text-amber-400' : 'text-emerald-400'}`}>{Math.round(planned.cal)} kkal</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-sans font-bold">Protein</span>
              <span className="text-white">{Math.round(planned.protein)} g</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-sans font-bold">Karbo</span>
              <span className="text-white">{Math.round(planned.carbs)} g</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-sans font-bold">Lemak</span>
              <span className="text-white">{Math.round(planned.fat)} g</span>
            </div>
            {Math.abs(calGap) > 150 && (
              <p className="col-span-full text-[11px] text-amber-400 font-sans">
                Total menu {calGap > 0 ? 'melebihi' : 'kurang dari'} target kalori sebesar {Math.abs(Math.round(calGap))} kkal.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="bg-surface rounded-2xl border border-line p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor="np-supp" className={label}>Saran suplementasi</label>
          <input id="np-supp" type="text" maxLength={200} value={supplements} onChange={e => setSupplements(e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="np-hyd" className={label}>Target air (liter)</label>
          <input id="np-hyd" type="number" step="0.5" min="1" max="8" value={hydration} onChange={e => setHydration(e.target.value)} className={field} />
        </div>
      </section>
    </div>
  );
};
