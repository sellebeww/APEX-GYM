import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Timer, X, Maximize2, Minimize2, Flag } from 'lucide-react';
import { Modal } from './Modal';

type TimerMode = 'REST' | 'TABATA' | 'EMOM' | 'STOPWATCH';
type SegmentKind = 'rest' | 'work' | 'tabata-rest' | 'minute';

interface Segment {
  kind: SegmentKind;
  seconds: number;
  /** Round (Tabata) or minute number (EMOM) */
  round?: number;
}

interface WorkoutAudioTimerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRestSeconds?: number;
}

const TABATA_ROUNDS = 8;
const REST_PRESETS = [30, 60, 90, 120, 180];
const EMOM_OPTIONS = [5, 10, 15, 20];

const formatTime = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

function buildPlan(mode: Exclude<TimerMode, 'STOPWATCH'>, restSeconds: number, emomMinutes: number): Segment[] {
  if (mode === 'REST') return [{ kind: 'rest', seconds: restSeconds }];
  if (mode === 'TABATA') {
    const plan: Segment[] = [];
    for (let r = 1; r <= TABATA_ROUNDS; r++) {
      plan.push({ kind: 'work', seconds: 20, round: r });
      if (r < TABATA_ROUNDS) plan.push({ kind: 'tabata-rest', seconds: 10, round: r });
    }
    return plan;
  }
  return Array.from({ length: emomMinutes }, (_, i) => ({ kind: 'minute' as const, seconds: 60, round: i + 1 }));
}

const MODE_LABEL: Record<TimerMode, string> = { REST: 'Rest Set', TABATA: 'Tabata', EMOM: 'EMOM', STOPWATCH: 'Stopwatch' };

/**
 * Interval timer (rest / Tabata / EMOM / stopwatch) with synthesised beeps.
 * Timing is deadline-based (Date.now), so it stays accurate when the tab is throttled
 * and never double-fires under React StrictMode.
 */
export const WorkoutAudioTimer: React.FC<WorkoutAudioTimerProps> = ({ isOpen, onClose, defaultRestSeconds = 90 }) => {
  const [mode, setMode] = useState<TimerMode>('REST');
  const [restSeconds, setRestSeconds] = useState(defaultRestSeconds);
  const [emomMinutes, setEmomMinutes] = useState(10);
  const [isRunning, setIsRunning] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const plan = useMemo(
    () => (mode === 'STOPWATCH' ? [] : buildPlan(mode, restSeconds, emomMinutes)),
    [mode, restSeconds, emomMinutes]
  );

  const [segIndex, setSegIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(plan[0]?.seconds ?? 0);
  const [finished, setFinished] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);

  // Mutable timing state (kept out of React state so ticks never read stale closures)
  const idxRef = useRef(0);
  const endRef = useRef(0);
  const lastShownRef = useRef(-1);
  const pausedMsRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const elapsedBaseRef = useRef(0);
  const mutedRef = useRef(isMuted);
  mutedRef.current = isMuted;
  const ctxRef = useRef<AudioContext | null>(null);

  const playSound = useCallback((type: 'beep' | 'start' | 'finish') => {
    if (mutedRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!ctxRef.current || ctxRef.current.state === 'closed') ctxRef.current = new AudioCtx();
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime;
      const dur = type === 'beep' ? 0.12 : type === 'start' ? 0.35 : 0.5;
      osc.type = type === 'start' ? 'triangle' : 'sine';
      if (type === 'finish') {
        osc.frequency.setValueAtTime(659.25, t);
        osc.frequency.setValueAtTime(880, t + 0.15);
      } else {
        osc.frequency.setValueAtTime(type === 'beep' ? 800 : 1200, t);
      }
      gain.gain.setValueAtTime(type === 'beep' ? 0.2 : 0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
    } catch {
      /* audio blocked or unavailable */
    }
  }, []);

  /** Reset to the first segment of the current plan without running */
  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setFinished(false);
    pausedMsRef.current = null;
    idxRef.current = 0;
    lastShownRef.current = -1;
    setSegIndex(0);
    setSecondsLeft(plan[0]?.seconds ?? 0);
    elapsedBaseRef.current = 0;
    setElapsed(0);
    setLaps([]);
  }, [plan]);

  // Re-initialise whenever the mode or its settings change
  useEffect(() => {
    resetTimer();
  }, [resetTimer]);

  // Closing the timer stops it so it can never beep invisibly in the background
  useEffect(() => {
    if (!isOpen) {
      resetTimer();
      setIsMinimized(false);
    }
  }, [isOpen, resetTimer]);

  // Release audio engine on unmount
  useEffect(
    () => () => {
      void ctxRef.current?.close().catch(() => undefined);
    },
    []
  );

  // Main tick
  useEffect(() => {
    if (!isRunning) return;

    if (mode === 'STOPWATCH') {
      startedAtRef.current = Date.now();
      const id = setInterval(() => {
        setElapsed(elapsedBaseRef.current + Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
      return () => {
        elapsedBaseRef.current += Math.floor((Date.now() - startedAtRef.current) / 1000);
        clearInterval(id);
      };
    }

    const segMs = (i: number) => plan[i].seconds * 1000;
    // Resume from pause, or start the current segment fresh
    endRef.current = Date.now() + (pausedMsRef.current ?? segMs(idxRef.current));
    pausedMsRef.current = null;

    const tick = () => {
      const now = Date.now();
      let remaining = endRef.current - now;
      while (remaining <= 0) {
        if (idxRef.current >= plan.length - 1) {
          setSecondsLeft(0);
          setFinished(true);
          setIsRunning(false);
          playSound('finish');
          return;
        }
        idxRef.current += 1;
        endRef.current += segMs(idxRef.current);
        remaining = endRef.current - now;
        setSegIndex(idxRef.current);
        playSound(plan[idxRef.current].kind === 'tabata-rest' ? 'beep' : 'start');
      }
      const sec = Math.ceil(remaining / 1000);
      if (sec !== lastShownRef.current) {
        lastShownRef.current = sec;
        setSecondsLeft(sec);
        if (sec <= 3 && sec >= 1) playSound('beep');
      }
    };

    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [isRunning, mode, plan, playSound]);

  const segment = plan[segIndex];
  const isStopwatch = mode === 'STOPWATCH';
  const display = isStopwatch ? elapsed : secondsLeft;

  const toggleRun = () => {
    if (finished) {
      resetTimer();
      setTimeout(() => setIsRunning(true), 0);
      return;
    }
    if (isRunning && !isStopwatch) {
      // Remember what was left so resuming continues exactly where it stopped
      pausedMsRef.current = Math.max(0, endRef.current - Date.now());
    }
    setIsRunning(r => !r);
  };

  const phaseBadge =
    mode === 'TABATA' ? (
      <span
        className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
          segment?.kind === 'work'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
        }`}
      >
        {segment?.kind === 'work' ? 'KERJA' : 'ISTIRAHAT'}
      </span>
    ) : null;

  const subtitle = finished
    ? 'Selesai. Kerja bagus!'
    : mode === 'REST'
    ? 'Waktu istirahat optimal untuk pemulihan antar set'
    : mode === 'TABATA'
    ? '20 detik kerja maksimal + 10 detik jeda napas'
    : mode === 'EMOM'
    ? 'Mulai repetisi target tepat di awal tiap menit'
    : 'Catat waktu plank atau total durasi sesi';

  const modeLabelShort =
    mode === 'TABATA' ? `Tabata R${segment?.round ?? 1}` : mode === 'EMOM' ? `EMOM ${segment?.round ?? 1}/${emomMinutes}` : MODE_LABEL[mode];

  // Minimised floating widget (sits above the mobile bottom bar)
  if (isOpen && isMinimized) {
    return (
      <div
        role="timer"
        aria-label="Timer latihan"
        className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-60 bg-surface border border-line-strong rounded-2xl shadow-2xl shadow-black/60 p-3 flex items-center gap-3"
      >
        <button
          onClick={toggleRun}
          aria-label={isRunning ? 'Jeda timer' : 'Mulai timer'}
          className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center"
        >
          {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        <div>
          <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block">{modeLabelShort}</span>
          <span className="text-xl font-mono font-black text-white tabular-nums">{formatTime(display)}</span>
        </div>
        <button onClick={() => setIsMinimized(false)} aria-label="Perbesar timer" className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5">
          <Maximize2 className="w-4 h-4" />
        </button>
        <button onClick={onClose} aria-label="Tutup timer" className="p-2 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-white/5">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const iconBtn = 'p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors';

  return (
    <Modal isOpen={isOpen} onClose={onClose} label="Timer latihan" maxWidth="max-w-md" hideClose>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-white" />
            <h2 className="text-base font-bold text-white">Timer latihan</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMuted(m => !m)}
              aria-pressed={isMuted}
              aria-label={isMuted ? 'Nyalakan suara' : 'Bisukan suara'}
              className={iconBtn}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button onClick={() => setIsMinimized(true)} aria-label="Perkecil ke widget" className={iconBtn}>
              <Minimize2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} aria-label="Tutup timer" className={iconBtn}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div role="tablist" aria-label="Mode timer" className="grid grid-cols-4 gap-1 p-1 bg-black/50 rounded-2xl border border-line">
          {(['REST', 'TABATA', 'EMOM', 'STOPWATCH'] as TimerMode[]).map(m => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`py-2 text-xs font-bold rounded-xl transition-colors ${
                mode === m ? 'bg-white text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        {mode === 'REST' && (
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Durasi istirahat">
            {REST_PRESETS.map(s => (
              <button
                key={s}
                onClick={() => setRestSeconds(s)}
                aria-pressed={restSeconds === s}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-colors ${
                  restSeconds === s ? 'bg-white/10 border-white text-white' : 'bg-black/30 border-line text-zinc-400 hover:text-white'
                }`}
              >
                {s}s
              </button>
            ))}
          </div>
        )}

        {mode === 'EMOM' && (
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Durasi EMOM">
            {EMOM_OPTIONS.map(m => (
              <button
                key={m}
                onClick={() => setEmomMinutes(m)}
                aria-pressed={emomMinutes === m}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-colors ${
                  emomMinutes === m ? 'bg-white/10 border-white text-white' : 'bg-black/30 border-line text-zinc-400 hover:text-white'
                }`}
              >
                {m} menit
              </button>
            ))}
          </div>
        )}

        <div className="text-center py-6 bg-black/40 rounded-3xl border border-line">
          {mode === 'TABATA' && (
            <div className="mb-2 flex items-center justify-center gap-2">
              {phaseBadge}
              <span className="text-xs font-mono text-zinc-400">
                Ronde {segment?.round ?? 1} / {TABATA_ROUNDS}
              </span>
            </div>
          )}
          {mode === 'EMOM' && (
            <div className="mb-2 text-xs font-mono text-zinc-300">
              Menit ke-{segment?.round ?? 1} dari {emomMinutes}
            </div>
          )}

          <div
            role="timer"
            aria-live="off"
            className="text-6xl sm:text-7xl font-black font-mono tracking-tight text-white tabular-nums"
          >
            {formatTime(display)}
          </div>
          <p className="text-xs text-zinc-500 mt-2 px-4">{subtitle}</p>
        </div>

        {isStopwatch && laps.length > 0 && (
          <ul className="max-h-28 overflow-y-auto no-scrollbar space-y-1 p-3 bg-black/30 rounded-xl border border-line text-xs font-mono">
            {laps.map((lap, idx) => (
              <li key={idx} className="flex justify-between text-zinc-400">
                <span>Lap {laps.length - idx}</span>
                <span className="text-white font-bold">{formatTime(lap)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={resetTimer}
            aria-label="Reset"
            className="w-12 h-12 rounded-2xl bg-black/60 border border-line text-zinc-400 hover:text-white hover:border-line-strong flex items-center justify-center transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={toggleRun}
            className={`px-8 h-12 rounded-2xl font-bold flex items-center gap-2 transition-colors ${
              isRunning ? 'bg-amber-400 text-black hover:bg-amber-300' : 'bg-white text-black hover:bg-zinc-200'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-5 h-5" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-5 h-5 ml-0.5" />
                {finished ? 'Ulangi' : 'Mulai'}
              </>
            )}
          </button>

          {isStopwatch && (
            <button
              onClick={() => setLaps(prev => [elapsed, ...prev])}
              disabled={!isRunning}
              aria-label="Catat lap"
              className="w-12 h-12 rounded-2xl bg-black/60 border border-line text-zinc-400 hover:text-white disabled:opacity-30 flex items-center justify-center transition-colors"
            >
              <Flag className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
