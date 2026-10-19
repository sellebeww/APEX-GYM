import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Droplets, MessageSquare, ShoppingCart, UserCheck, Dumbbell, Apple, ClipboardList } from 'lucide-react';
import { ChatThread } from '../common/ChatThread';
import { formatDateId } from '../../lib/membership';

type SubTab = 'workout' | 'nutrition' | 'checkin' | 'chat';

const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const fieldClass =
  'w-full bg-surface-2 border border-line-strong rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white';
const labelClass = 'block text-zinc-400 text-xs font-semibold mb-1.5';
const card = 'bg-surface rounded-2xl border border-line p-6';

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }> = ({ icon, title, text, action }) => (
  <div className={`${card} text-center py-12`}>
    <div className="mx-auto w-12 h-12 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-zinc-500 mb-4">{icon}</div>
    <h2 className="text-sm font-bold text-white mb-1">{title}</h2>
    <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-4">{text}</p>
    {action}
  </div>
);

export const MemberProgramNutrition: React.FC = () => {
  const {
    currentUser,
    workoutPrograms,
    mealPlans,
    updateMealPlanChecked,
    weeklyCheckIns,
    submitWeeklyCheckIn,
    bodyMeasurements,
    coachProfiles,
    memberProfiles,
    chatMessages,
    sendChatMessage,
    showToast,
    setMemberTab,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('workout');

  const memberId = currentUser?.id ?? '';
  const memberProf = memberProfiles[memberId];
  const coachProf = memberProf?.assignedCoachId ? coachProfiles[memberProf.assignedCoachId] : null;
  const coachFirstName = coachProf?.fullName.split(' ')[0] ?? 'Coach';
  const currentMealPlan = mealPlans[memberId] ?? null;
  const currentProgram = useMemo(
    () => workoutPrograms.find(p => p.assignedToMemberId === memberId) ?? workoutPrograms.find(p => !p.assignedToMemberId),
    [workoutPrograms, memberId]
  );

  const latestWeight = useMemo(
    () => bodyMeasurements.filter(m => m.memberId === memberId).toSorted((a, b) => b.date.localeCompare(a.date))[0]?.weightKg,
    [bodyMeasurements, memberId]
  );

  // Weekly check-in form (weight pre-filled from the latest measurement)
  const [weightKg, setWeightKg] = useState<string>(latestWeight ? String(latestWeight) : '');
  const [energyScore, setEnergyScore] = useState(4);
  const [sleepHours, setSleepHours] = useState('7');
  const [stressScore, setStressScore] = useState(2);
  const [adherence, setAdherence] = useState('80');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const thread = useMemo(
    () => chatMessages.filter(m => m.threadMemberId === memberId).toSorted((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [chatMessages, memberId]
  );
  const memberCheckins = useMemo(
    () => weeklyCheckIns.filter(c => c.memberId === memberId).toSorted((a, b) => b.date.localeCompare(a.date)),
    [weeklyCheckIns, memberId]
  );

  const [submitting, setSubmitting] = useState(false);
  const submitCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const w = parseFloat(weightKg);
    const sleep = parseFloat(sleepHours);
    const adh = parseInt(adherence, 10);
    if (!(w >= 25 && w <= 350)) return setFormError('Berat badan harus antara 25 dan 350 kg.');
    if (!(sleep >= 0 && sleep <= 16)) return setFormError('Jam tidur harus antara 0 dan 16 jam.');
    if (!(adh >= 0 && adh <= 100)) return setFormError('Kepatuhan diet harus antara 0 dan 100%.');
    setFormError('');
    setSubmitting(true);
    const res = await submitWeeklyCheckIn({
      weightKg: w,
      energyScore,
      sleepHours: sleep,
      stressScore,
      dietAdherencePercent: adh,
      notes: notes.trim(),
    });
    setSubmitting(false);
    if (!res.success) return setFormError(res.message);
    setNotes('');
    showToast(coachProf ? 'Check-in mingguan terkirim. Coach akan membalas di sini.' : 'Check-in tersimpan.', 'success');
  };

  const tabs: { id: SubTab; label: string }[] = [
    { id: 'workout', label: 'Program latihan' },
    { id: 'nutrition', label: 'Rencana makan & makro' },
    { id: 'checkin', label: 'Check-in mingguan' },
    { id: 'chat', label: 'Chat coach' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Coach banner */}
      <div className={`${card} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-surface-2 shrink-0 border border-line-strong flex items-center justify-center">
            {coachProf?.photoUrl ? (
              <img src={coachProf.photoUrl} alt={coachProf.fullName} className="w-full h-full object-cover object-top" />
            ) : (
              <UserCheck className="w-6 h-6 text-zinc-500" />
            )}
          </div>
          <div>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.2em] block">Personal trainer Anda</span>
            <h1 className="text-lg font-bold text-white">{coachProf ? coachProf.fullName : 'Belum ada coach'}</h1>
            <p className="text-xs text-zinc-400">
              {coachProf
                ? `${coachProf.title}${coachProf.rating !== null ? ` · Rating ${coachProf.rating}` : ''}`
                : 'Pilih coach untuk mendapat program & meal plan personal'}
            </p>
          </div>
        </div>
        <button
          onClick={() => (coachProf ? setActiveSubTab('chat') : setMemberTab('coaching'))}
          className="px-4 py-2.5 rounded-xl bg-surface-2 border border-line-strong hover:border-white text-xs font-bold text-white transition-colors flex items-center gap-2"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {coachProf ? 'Chat 1-on-1' : 'Cari coach'}
        </button>
      </div>

      <div role="tablist" className="flex items-center gap-2 border-b border-line pb-2 overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeSubTab === t.id}
            onClick={() => setActiveSubTab(t.id)}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeSubTab === t.id ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. Workout program */}
      {activeSubTab === 'workout' &&
        (currentProgram ? (
          <div className="space-y-6">
            <div className={`${card} space-y-4`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.2em]">
                    {currentProgram.assignedToMemberId ? 'Program khusus Anda' : 'Program umum APEX'}
                  </span>
                  <h2 className="text-xl font-bold text-white mt-0.5">{currentProgram.title}</h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Target <strong className="text-zinc-200">{currentProgram.target}</strong> · {currentProgram.level} · {currentProgram.frequencyPerWeek}x / minggu
                  </p>
                </div>
                <span className="text-xs font-mono px-3 py-1 rounded bg-white/10 text-zinc-200 shrink-0">{currentProgram.durationWeeks} minggu</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed border-t border-line pt-3">{currentProgram.description}</p>
            </div>

            {currentProgram.days.map(d => (
              <section key={d.dayNumber} className={`${card} space-y-4`}>
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white">{d.dayName}</h3>
                    <span className="text-xs text-zinc-400">{d.focus}</span>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">{d.exercises.length} gerakan</span>
                </div>
                <div className="divide-y divide-line">
                  {d.exercises.map(e => (
                    <div key={`${d.dayNumber}-${e.exerciseId}`} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="font-bold text-white text-sm">{e.exerciseName}</div>
                        {e.notes && <p className="text-[11px] text-zinc-400 mt-0.5">{e.notes}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 font-tabular text-zinc-300">
                        <span className="px-2 py-1 rounded bg-surface-2 border border-line font-bold text-white">
                          {e.sets} × {e.reps}
                        </span>
                        {e.targetRpe && <span className="text-zinc-400">RPE {e.targetRpe}</span>}
                        <span className="text-zinc-500">Istirahat {e.restSeconds}s</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Dumbbell className="w-5 h-5" />}
            title="Belum ada program latihan"
            text="Coach Anda akan menyusun program personal. Sementara itu, catat latihan bebas di Workout Tracker."
            action={
              <button onClick={() => setMemberTab('workout-log')} className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-zinc-200">
                Buka Workout Tracker
              </button>
            }
          />
        ))}

      {/* 2. Nutrition */}
      {activeSubTab === 'nutrition' &&
        (currentMealPlan ? (
          <div className="space-y-6">
            <div className={`${card} space-y-6`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
                <div>
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.2em]">Meal plan dari coach</span>
                  <h2 className="text-xl font-bold text-white mt-0.5">{currentMealPlan.title}</h2>
                  <p className="text-xs text-zinc-400 mt-1">Disesuaikan dengan bahan makanan lokal Indonesia.</p>
                </div>
                <div className="sm:text-right">
                  <div className="text-3xl font-black font-tabular text-white">{currentMealPlan.targetCalories.toLocaleString('id-ID')}</div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Target kalori / hari</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center font-tabular">
                {[
                  { l: 'Protein', g: currentMealPlan.targetProtein, kcal: currentMealPlan.targetProtein * 4, c: 'text-sky-400' },
                  { l: 'Karbohidrat', g: currentMealPlan.targetCarbs, kcal: currentMealPlan.targetCarbs * 4, c: 'text-amber-400' },
                  { l: 'Lemak', g: currentMealPlan.targetFat, kcal: currentMealPlan.targetFat * 9, c: 'text-rose-400' },
                ].map(m => (
                  <div key={m.l} className="p-3 rounded-xl bg-surface-2 border border-line">
                    <span className={`text-[10px] uppercase font-bold block mb-1 ${m.c}`}>{m.l}</span>
                    <span className="text-xl font-black text-white">{m.g}g</span>
                    <span className="text-[10px] text-zinc-500 block">≈ {m.kcal.toLocaleString('id-ID')} kkal</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-line">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-white">Kepatuhan pola makan minggu ini</h3>
                  <span className="text-[11px] text-zinc-400">{currentMealPlan.dailyChecked.filter(Boolean).length} / 7 hari</span>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {DAY_NAMES.map((d, idx) => {
                    const done = currentMealPlan.dailyChecked[idx];
                    return (
                      <button
                        key={d}
                        onClick={() => void updateMealPlanChecked(idx, !done).then(r => !r.success && showToast(r.message, 'error'))}
                        aria-pressed={!!done}
                        aria-label={`${d}: ${done ? 'tercapai' : 'belum'}`}
                        className={`py-2.5 rounded-xl border text-center transition-colors ${
                          done ? 'bg-white text-black border-white' : 'bg-surface-2 border-line text-zinc-400 hover:border-line-strong'
                        }`}
                      >
                        <span className="text-[10px] font-bold block">{d.slice(0, 3)}</span>
                        <span className="text-sm leading-none">{done ? '✓' : '·'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <section className={`${card} space-y-4`}>
              <h3 className="text-sm font-bold text-white pb-3 border-b border-line">Menu harian yang direkomendasikan</h3>
              <div className="space-y-3">
                {currentMealPlan.meals.map(m => (
                  <div key={`${m.mealTime}-${m.foodName}`} className="p-4 rounded-xl bg-surface-2 border border-line space-y-1.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-bold text-zinc-300 uppercase tracking-wide">{m.mealTime}</span>
                      <span className="font-mono text-zinc-400">
                        {m.calories} kkal · P {m.protein}g · K {m.carbs}g · L {m.fat}g
                      </span>
                    </div>
                    <div className="font-semibold text-white text-sm">{m.foodName}</div>
                    <div className="text-[11px] text-zinc-400">Porsi: {m.portion}</div>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className={`${card} space-y-3`}>
                <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-zinc-400" /> Daftar belanja mingguan
                </h3>
                <ul className="space-y-2 text-xs text-zinc-300">
                  {currentMealPlan.shoppingList.map(item => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-zinc-500">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className={`${card} space-y-3`}>
                <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-zinc-400" /> Hidrasi & suplementasi
                </h3>
                <p className="text-xs text-zinc-300">
                  Target air: <strong className="text-white">{currentMealPlan.hydrationTargetLiters} liter</strong> per hari.
                </p>
                <p className="text-xs text-zinc-400 leading-relaxed">{currentMealPlan.supplementsAdvice}</p>
                <div className="p-3 rounded-lg bg-black/40 border border-line text-[10px] text-zinc-500 leading-snug">{currentMealPlan.disclaimer}</div>
              </section>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<Apple className="w-5 h-5" />}
            title="Belum ada meal plan"
            text="Meal plan personal disusun oleh coach. Anda tetap bisa menghitung kebutuhan kalori dan makro sendiri di Kalkulator."
            action={
              <button onClick={() => setMemberTab('tools')} className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-zinc-200">
                Buka Kalkulator Gizi
              </button>
            }
          />
        ))}

      {/* 3. Weekly check-in */}
      {activeSubTab === 'checkin' && (
        <div className="space-y-6">
          <div className={`${card} space-y-6`}>
            <div>
              <h2 className="text-base font-bold text-white">Form check-in mingguan</h2>
              <p className="text-xs text-zinc-400 mt-1">
                {coachProf ? `Kirim data mingguan Anda untuk direviu oleh Coach ${coachFirstName}.` : 'Data tersimpan di riwayat Anda dan bisa dilihat coach setelah Anda memilih coach.'}
              </p>
            </div>

            <form onSubmit={submitCheckin} className="space-y-4" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="ci-weight" className={labelClass}>Berat badan pagi (kg)</label>
                  <input id="ci-weight" type="number" inputMode="decimal" step="0.1" required value={weightKg} onChange={e => setWeightKg(e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label htmlFor="ci-sleep" className={labelClass}>Rata-rata jam tidur</label>
                  <input id="ci-sleep" type="number" inputMode="decimal" step="0.5" required value={sleepHours} onChange={e => setSleepHours(e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label htmlFor="ci-adh" className={labelClass}>Kepatuhan diet (0–100%)</label>
                  <input id="ci-adh" type="number" inputMode="numeric" min="0" max="100" required value={adherence} onChange={e => setAdherence(e.target.value)} className={fieldClass} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ci-energy" className={labelClass}>Level energi (1–5)</label>
                  <select id="ci-energy" value={energyScore} onChange={e => setEnergyScore(parseInt(e.target.value, 10))} className={fieldClass}>
                    <option value={5}>5 – Sangat tinggi & segar</option>
                    <option value={4}>4 – Bagus</option>
                    <option value={3}>3 – Cukup</option>
                    <option value={2}>2 – Rendah</option>
                    <option value={1}>1 – Sangat lelah</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="ci-stress" className={labelClass}>Level stres (1–5)</label>
                  <select id="ci-stress" value={stressScore} onChange={e => setStressScore(parseInt(e.target.value, 10))} className={fieldClass}>
                    <option value={1}>1 – Tenang & santai</option>
                    <option value={2}>2 – Terkendali</option>
                    <option value={3}>3 – Sedang</option>
                    <option value={4}>4 – Cukup tinggi</option>
                    <option value={5}>5 – Sangat tinggi</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="ci-notes" className={labelClass}>Kendala, cerita angkatan, atau pertanyaan</label>
                <textarea
                  id="ci-notes"
                  rows={3}
                  maxLength={500}
                  placeholder="Progres angkatan, pegal di otot tertentu, atau jadwal minggu depan"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className={`${fieldClass} resize-none`}
                />
              </div>

              {formError && (
                <p role="alert" className="text-xs text-rose-400">
                  {formError}
                </p>
              )}

              <button type="submit" disabled={submitting} className="px-6 py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm transition-colors disabled:opacity-60">
                Kirim check-in
              </button>
            </form>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em]">Riwayat check-in & balasan coach</h3>
            {memberCheckins.length === 0 && (
              <EmptyState icon={<ClipboardList className="w-5 h-5" />} title="Belum ada check-in" text="Kirim check-in pertama Anda untuk mulai memantau tren mingguan." />
            )}
            {memberCheckins.map(ci => (
              <div key={ci.id} className="p-5 rounded-2xl bg-surface border border-line space-y-3 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-line">
                  <span className="font-bold text-white">Check-in {formatDateId(ci.date)}</span>
                  <div className="flex flex-wrap items-center gap-3 font-mono text-zinc-300">
                    <span>Berat <strong className="text-white">{ci.weightKg} kg</strong></span>
                    <span>Tidur {ci.sleepHours} jam</span>
                    <span>Diet {ci.dietAdherencePercent}%</span>
                  </div>
                </div>
                {ci.notes && <p className="text-zinc-300 leading-relaxed italic">"{ci.notes}"</p>}
                {ci.coachReply && (
                  <div className="p-3.5 rounded-xl bg-surface-2 border border-line-strong space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Balasan coach{coachProf ? ` ${coachFirstName}` : ''}</span>
                    <p className="text-xs text-zinc-200 leading-relaxed">{ci.coachReply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Chat */}
      {activeSubTab === 'chat' &&
        (coachProf ? (
          <ChatThread
            messages={thread}
            meId={memberId}
            partnerName={coachProf.fullName}
            partnerPhoto={coachProf.photoUrl}
            onSend={text => sendChatMessage(text)}
          />
        ) : (
          <EmptyState
            icon={<MessageSquare className="w-5 h-5" />}
            title="Belum ada coach untuk diajak chat"
            text="Booking sesi dengan seorang personal trainer untuk membuka percakapan 1-on-1."
            action={
              <button onClick={() => setMemberTab('coaching')} className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-zinc-200">
                Lihat daftar coach
              </button>
            }
          />
        ))}
    </div>
  );
};
