import React, { useState } from 'react';
import type { WorkoutSessionLog } from '../../types';
import { Droplets, Utensils, Moon, ShieldAlert, HeartPulse, CheckSquare, Trophy, type LucideIcon } from 'lucide-react';
import { Modal } from '../common/Modal';

interface PostWorkoutModalProps {
  session: WorkoutSessionLog;
  onClose: () => void;
}

const RECOVERY_ITEMS: { id: string; label: string; desc: string; icon: LucideIcon }[] = [
  { id: 'cooldown', label: 'Cooldown & stretching statis 5–10 menit', desc: 'Menurunkan detak jantung bertahap dan mencegah kekakuan sendi.', icon: HeartPulse },
  { id: 'water', label: 'Rehidrasi minimal 500–750 ml air mineral', desc: 'Gantikan cairan dan elektrolit yang hilang lewat keringat.', icon: Droplets },
  { id: 'protein', label: 'Protein 20–30 g & karbohidrat bersih', desc: 'Contoh: 1 scoop whey + pisang, atau 100 g dada ayam + nasi putih.', icon: Utensils },
  { id: 'shower', label: 'Mandi air hangat & ganti baju kering', desc: 'Mencegah iritasi kulit dan merilekskan sistem saraf.', icon: CheckSquare },
  { id: 'sleep', label: 'Tidur berkualitas 7–9 jam malam ini', desc: 'Sintesis protein otot memuncak saat tidur nyenyak.', icon: Moon },
];

const MUSCLE_RULES: [string[], string][] = [
  [['bench', 'press', 'chest', 'fly'], 'Dada & bahu depan'],
  [['squat', 'leg', 'quad', 'lunge'], 'Paha depan (quadriceps)'],
  [['deadlift', 'rdl', 'hamstring', 'hip thrust'], 'Paha belakang & gluteus'],
  [['lat', 'pull', 'row'], 'Punggung (lats & trapezius)'],
  [['biceps', 'curl'], 'Bisep'],
  [['triceps', 'pushdown', 'dip'], 'Trisep'],
];

export const MemberPostWorkoutModal: React.FC<PostWorkoutModalProps> = ({ session, onClose }) => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const trainedMuscles = new Set<string>();
  session.exercises.forEach(e => {
    const name = e.exerciseName.toLowerCase();
    MUSCLE_RULES.forEach(([keys, label]) => keys.some(k => name.includes(k)) && trainedMuscles.add(label));
  });

  return (
    <Modal isOpen onClose={onClose} label="Sesi latihan selesai" maxWidth="max-w-xl">
      <div className="p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2 pr-6">
          <div className="inline-flex p-3 rounded-full bg-white/10 border border-line-strong text-white mb-1">
            <Trophy className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-extrabold uppercase text-white">Sesi selesai</h2>
          <p className="text-xs text-zinc-400 font-mono">
            {session.title} · {session.totalVolumeKg.toLocaleString('id-ID')} kg · {session.durationMinutes} menit
            {session.prAchieved && ' · Rekor baru (PR)'}
          </p>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-400 mb-3">Checklist pemulihan cepat</legend>
          {RECOVERY_ITEMS.map(item => {
            const on = !!checked[item.id];
            const Icon = item.icon;
            return (
              <label
                key={item.id}
                className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-start gap-3 focus-within:outline-2 focus-within:outline-white ${
                  on ? 'bg-surface-2 border-line-strong' : 'bg-surface-2 border-line hover:border-line-strong'
                }`}
              >
                <span className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${on ? 'bg-white text-black' : 'bg-white/10 text-zinc-400'}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`text-xs font-bold block ${on ? 'text-white' : 'text-zinc-300'}`}>{item.label}</span>
                  <span className="text-[11px] text-zinc-400 leading-relaxed block mt-0.5">{item.desc}</span>
                </span>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => setChecked(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                  className="mt-1 accent-white w-4 h-4"
                />
              </label>
            );
          })}
        </fieldset>

        <div className="p-4 rounded-xl bg-surface-2 border border-line space-y-2">
          <div className="text-xs font-bold text-white uppercase tracking-[0.15em]">Peregangan untuk sesi ini</div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            {trainedMuscles.size > 0 ? (
              <>
                Otot yang baru bekerja keras: <strong className="text-white">{Array.from(trainedMuscles).join(', ')}</strong>. Lakukan
                peregangan statis 30 detik per sisi tanpa memantul.
              </>
            ) : (
              'Lakukan peregangan seluruh tubuh ringan dan pernapasan diafragma 4-7-8 untuk menurunkan stres.'
            )}
          </p>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-black/40 border border-line text-[11px] text-zinc-500">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-zinc-400" />
          <span>
            <strong>Disclaimer:</strong> Panduan ini bersifat edukasi kebugaran umum, bukan saran medis. Segera konsultasikan ke dokter bila
            mengalami nyeri sendi tajam atau cedera akut.
          </span>
        </div>

        <button onClick={onClose} className="w-full py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm transition-colors">
          Selesai
        </button>
      </div>
    </Modal>
  );
};
