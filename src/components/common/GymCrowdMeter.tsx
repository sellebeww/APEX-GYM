import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Users, Clock, Flame, Activity, Wrench, Sliders } from 'lucide-react';


interface GymCrowdMeterProps {
  /** Front-desk control to correct the turnstile count (walk-ins, early exits) */
  showAdminControls?: boolean;
  compact?: boolean;
}


function getStatus(percentage: number) {
  if (percentage >= 75) {
    return {
      label: 'Sangat ramai',
      desc: 'Banyak member berlatih, disarankan berbagi set alat.',
      tone: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
      bar: 'bg-rose-400',
      dot: 'bg-rose-400',
    };
  }
  if (percentage >= 50) {
    return {
      label: 'Kepadatan sedang',
      desc: 'Gym cukup aktif, beberapa platform terisi.',
      tone: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
      bar: 'bg-amber-400',
      dot: 'bg-amber-400',
    };
  }
  return {
    label: 'Nyaman',
    desc: 'Bebas latihan tanpa antre alat beban maupun kardio.',
    tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
    bar: 'bg-emerald-400',
    dot: 'bg-emerald-400',
  };
}

export const GymCrowdMeter: React.FC<GymCrowdMeterProps> = ({ showAdminControls = false, compact = false }) => {
  const { liveGymOccupancy, setLiveGymOccupancy, gymEquipment, occupancy, showToast } = useApp();
  const GYM_CAPACITY = occupancy.capacity;
  const OCCUPANCY_WINDOW_MIN = occupancy.windowMinutes;
  const percentage = Math.min(100, Math.round((liveGymOccupancy / GYM_CAPACITY) * 100));
  // Slider value while dragging; committed to the server on release
  const [draft, setDraft] = useState<number | null>(null);
  const profile = occupancy.hourlyProfile;
  const maxEntries = profile ? Math.max(...profile.map(p => p.avgEntries), 1) : 1;
  const peakHours = profile ? [...profile].toSorted((a, b) => b.avgEntries - a.avgEntries).slice(0, 2).map(p => p.hour).toSorted() : [];
  const quietHours = profile ? [...profile].toSorted((a, b) => a.avgEntries - b.avgEntries).slice(0, 2).map(p => p.hour).toSorted() : [];

  const commit = async (value: number) => {
    const res = await setLiveGymOccupancy(value);
    setDraft(null);
    if (!res.success) showToast(res.message, 'error');
  };
  const status = getStatus(percentage);

  const operational = gymEquipment.filter(e => e.status === 'OPERATIONAL').length;
  const attention = gymEquipment.length - operational;

  if (compact) {
    return (
      <div className="p-5 rounded-2xl bg-surface border border-line space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status.dot} animate-pulse`} />
            <h4 className="text-[11px] font-bold text-white uppercase tracking-[0.2em]">Kepadatan gym</h4>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${status.tone}`}>{status.label}</span>
        </div>

        <div>
          <div className="text-2xl font-black font-mono text-white tracking-tight">
            {liveGymOccupancy} <span className="text-xs font-normal text-zinc-400 font-sans">/ {GYM_CAPACITY} orang</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">{status.desc}</p>
        </div>

        <div
          role="progressbar"
          aria-label="Kepadatan gym"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-line"
        >
          <div className={`h-full ${status.bar} transition-all duration-500 rounded-full`} style={{ width: `${percentage}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 rounded-3xl bg-surface border border-line space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-surface-2 border border-line-strong flex items-center justify-center text-white">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Kepadatan gym saat ini</h3>
            <p className="text-xs text-zinc-400">
              Dihitung dari check-in turnstile dalam {OCCUPANCY_WINDOW_MIN / 60} jam terakhir
            </p>
          </div>
        </div>
        <span className={`self-start sm:self-auto px-3 py-1 rounded-full text-xs font-bold border ${status.tone} flex items-center gap-1.5`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-black/40 border border-line">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span>Member di gym</span>
            <Users className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="text-4xl font-black font-mono text-white tracking-tight">
            {liveGymOccupancy}
            <span className="text-xs font-sans font-normal text-zinc-400 ml-2">/ {GYM_CAPACITY} kapasitas</span>
          </div>
          <div
            role="progressbar"
            aria-label="Kepadatan gym"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden mt-4 border border-line"
          >
            <div className={`h-full ${status.bar} transition-all duration-700 rounded-full`} style={{ width: `${percentage}%` }} />
          </div>
          <p className="text-[11px] text-zinc-400 mt-2">{percentage}% kapasitas terpakai</p>
        </div>

        <div className="p-5 rounded-2xl bg-black/40 border border-line">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span>Jam tersibuk (28 hari terakhir)</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          {profile ? (
            <>
              <div className="text-xl font-bold font-mono text-white">{peakHours.join(' & ')} WIB</div>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Paling lengang sekitar <span className="text-white font-medium">{quietHours.join(' & ')}</span>.
              </p>
            </>
          ) : (
            <p className="text-xs text-zinc-400 leading-relaxed">Belum cukup data check-in untuk menghitung jam sibuk. Angka muncul otomatis setelah data terkumpul.</p>
          )}
        </div>

        <div className="p-5 rounded-2xl bg-black/40 border border-line">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span>Kondisi alat</span>
            <Wrench className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {operational}
            <span className="text-xs font-sans font-normal text-zinc-400"> / {gymEquipment.length} unit normal</span>
          </div>
          <p className={`text-xs mt-2 ${attention > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {attention > 0 ? `${attention} unit dalam servis atau perlu perhatian` : 'Semua alat beroperasi normal'}
          </p>
        </div>
      </div>

      {profile && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              Rata-rata check-in per jam
            </div>
            <span className="text-[11px] text-zinc-500">Dari data turnstile 28 hari terakhir</span>
          </div>
          <div className="flex items-end gap-1.5 pt-2 overflow-x-auto no-scrollbar" role="img" aria-label={`Jam tersibuk ${peakHours.join(' dan ')} WIB`}>
            {profile.map(slot => {
              const isPeak = peakHours.includes(slot.hour);
              return (
                <div key={slot.hour} className="flex flex-col items-center gap-1.5 min-w-7 flex-1">
                  <div className="w-full h-24 bg-black/50 rounded-lg p-1 flex flex-col justify-end border border-line" title={`${slot.hour}: rata-rata ${slot.avgEntries} check-in`}>
                    <div className={`w-full rounded-md ${isPeak ? 'bg-white' : 'bg-zinc-500'}`} style={{ height: `${Math.max(4, (slot.avgEntries / maxEntries) * 100)}%` }} />
                  </div>
                  <span className={`text-[10px] font-mono ${isPeak ? 'text-white font-bold' : 'text-zinc-500'}`}>{slot.hour.slice(0, 2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showAdminControls && (
        <div className="p-4 rounded-2xl bg-black/60 border border-amber-500/30 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="occupancy-adjust" className="flex items-center gap-2 text-amber-400 text-xs font-bold">
              <Sliders className="w-4 h-4" />
              Koreksi manual resepsionis
            </label>
            <span className="font-mono text-xs text-white font-bold">{draft ?? liveGymOccupancy} orang</span>
          </div>
          <input
            id="occupancy-adjust"
            type="range"
            min="0"
            max={GYM_CAPACITY}
            value={draft ?? liveGymOccupancy}
            onChange={e => setDraft(parseInt(e.target.value, 10))}
            onPointerUp={e => void commit(parseInt((e.target as HTMLInputElement).value, 10))}
            onKeyUp={e => void commit(parseInt((e.target as HTMLInputElement).value, 10))}
            className="w-full accent-white cursor-pointer"
          />
          <p className="text-[11px] text-zinc-500">
            Gunakan untuk tamu day-pass atau member yang sudah pulang. Koreksi berlaku sampai akhir hari ini dan tercatat di audit log.
          </p>
        </div>
      )}
    </div>
  );
};
