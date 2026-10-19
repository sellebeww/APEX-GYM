import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, Play, Pause, Radio } from 'lucide-react';

type BeatStyle = 'SYNTHWAVE' | 'PHONK' | 'FOCUS_DRONE' | 'RECOVERY';

interface BeatOption {
  id: BeatStyle;
  label: string;
  short: string;
  tag: string;
  description: string;
}

const BEAT_OPTIONS: BeatOption[] = [
  {
    id: 'SYNTHWAVE',
    label: 'Cyber Synthwave Beats',
    short: 'Synthwave',
    tag: '128 BPM',
    description: 'Ketukan ritmis bertenaga untuk cardio & conditioning.',
  },
  {
    id: 'PHONK',
    label: 'Hardstyle Power Pulse',
    short: 'Hardstyle',
    tag: '140 BPM',
    description: 'Detak agresif untuk dorongan adrenalin saat angkatan maksimal.',
  },
  {
    id: 'FOCUS_DRONE',
    label: 'Deep Focus Binaural 50Hz',
    short: 'Deep Focus',
    tag: 'Focus Tone',
    description: 'Frekuensi rendah untuk konsentrasi saat set berat.',
  },
  {
    id: 'RECOVERY',
    label: 'Post-Workout Zen 432Hz',
    short: 'Zen Recovery',
    tag: '432 Hz',
    description: 'Harmoni tenang untuk menurunkan detak jantung setelah latihan.',
  },
];

type StoppableNode = AudioNode & { stop?: () => void };

/**
 * Synthesised (no audio files) rhythm / tone generator.
 * Every voice routes through one master gain so the volume slider works live.
 */
export const WorkoutFocusAudio: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<BeatStyle>('SYNTHWAVE');
  const [volume, setVolume] = useState(0.6);

  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nodesRef = useRef<StoppableNode[]>([]);

  const stopAudio = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    nodesRef.current.forEach(node => {
      try {
        node.stop?.();
        node.disconnect();
      } catch {
        /* node already stopped */
      }
    });
    nodesRef.current = [];
  }, []);

  const startAudio = useCallback(
    (style: BeatStyle) => {
      stopAudio();
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        if (!ctxRef.current || ctxRef.current.state === 'closed') {
          ctxRef.current = new AudioCtx();
          masterRef.current = null;
        }
        const ctx = ctxRef.current;
        if (ctx.state === 'suspended') void ctx.resume();
        if (!masterRef.current) {
          masterRef.current = ctx.createGain();
          masterRef.current.connect(ctx.destination);
        }
        const master = masterRef.current;

        if (style === 'FOCUS_DRONE') {
          const gain = ctx.createGain();
          gain.gain.value = 0.25;
          gain.connect(master);
          const oscs = [50, 54].map(f => {
            const o = ctx.createOscillator();
            o.type = 'sine';
            o.frequency.value = f;
            o.connect(gain);
            o.start();
            return o;
          });
          nodesRef.current = [...oscs, gain];
        } else if (style === 'RECOVERY') {
          const gain = ctx.createGain();
          gain.gain.value = 0.15;
          gain.connect(master);
          const oscs = [216, 288, 432].map(f => {
            const o = ctx.createOscillator();
            o.type = 'triangle';
            o.frequency.value = f;
            o.connect(gain);
            o.start();
            return o;
          });
          nodesRef.current = [...oscs, gain];
        } else {
          const bpm = style === 'PHONK' ? 140 : 128;
          let step = 0;
          const trigger = () => {
            const now = ctx.currentTime;
            if (step % 2 === 0) {
              const kick = ctx.createOscillator();
              const kickGain = ctx.createGain();
              kick.type = 'sine';
              kick.frequency.setValueAtTime(style === 'PHONK' ? 130 : 110, now);
              kick.frequency.exponentialRampToValueAtTime(35, now + 0.14);
              kickGain.gain.setValueAtTime(0.35, now);
              kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
              kick.connect(kickGain);
              kickGain.connect(master);
              kick.start(now);
              kick.stop(now + 0.14);
            }
            const len = Math.floor(ctx.sampleRate * 0.04);
            const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = style === 'PHONK' ? 7000 : 5000;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.08, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(master);
            noise.start(now);
            noise.stop(now + 0.04);
            step = (step + 1) % 4;
          };
          trigger();
          intervalRef.current = setInterval(trigger, (60 / bpm) * 1000);
        }
      } catch (e) {
        console.warn('Audio synthesis unavailable.', e);
      }
    },
    [stopAudio]
  );

  // Live volume control
  useEffect(() => {
    if (masterRef.current && ctxRef.current) {
      masterRef.current.gain.setTargetAtTime(volume, ctxRef.current.currentTime, 0.02);
    }
  }, [volume, isPlaying]);

  // Release the audio engine when leaving the page
  useEffect(
    () => () => {
      stopAudio();
      void ctxRef.current?.close().catch(() => undefined);
      ctxRef.current = null;
      masterRef.current = null;
    },
    [stopAudio]
  );

  const togglePlay = () => {
    if (isPlaying) {
      stopAudio();
      setIsPlaying(false);
    } else {
      startAudio(selectedStyle);
      if (masterRef.current && ctxRef.current) masterRef.current.gain.value = volume;
      setIsPlaying(true);
    }
  };

  const selectStyle = (style: BeatStyle) => {
    setSelectedStyle(style);
    if (isPlaying) startAudio(style);
  };

  const active = BEAT_OPTIONS.find(b => b.id === selectedStyle) ?? BEAT_OPTIONS[0];

  return (
    <section className="p-5 rounded-2xl bg-surface border border-line space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-2 border border-line-strong flex items-center justify-center text-white shrink-0">
            <Radio className={`w-5 h-5 ${isPlaying ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">Focus Beats</h2>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-zinc-300">{active.tag}</span>
            </div>
            <p className="text-[11px] text-zinc-400">{active.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:shrink-0">
          <label className="flex items-center gap-2 text-zinc-400">
            <Volume2 className="w-4 h-4" aria-hidden />
            <span className="sr-only">Volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className="w-24 accent-white cursor-pointer"
            />
          </label>
          <button
            onClick={togglePlay}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
              isPlaying ? 'bg-rose-600 text-white hover:bg-rose-500' : 'bg-white text-black hover:bg-zinc-200'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? 'Jeda' : 'Mulai'}
          </button>
        </div>
      </div>

      <div role="radiogroup" aria-label="Pilih irama" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {BEAT_OPTIONS.map(opt => {
          const selected = selectedStyle === opt.id;
          return (
            <button
              key={opt.id}
              role="radio"
              aria-checked={selected}
              onClick={() => selectStyle(opt.id)}
              className={`px-3 py-2.5 rounded-xl text-left border text-xs transition-colors ${
                selected ? 'bg-white text-black border-white' : 'bg-surface-2 border-line text-zinc-300 hover:border-line-strong'
              }`}
            >
              <span className="font-bold block truncate">{opt.short}</span>
              <span className={`text-[10px] font-mono ${selected ? 'text-zinc-700' : 'text-zinc-500'}`}>{opt.tag}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
