import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp, type CheckInResult } from '../../context/AppContext';
import { QrCode, CheckCircle, AlertTriangle, Clock, Camera, CameraOff } from 'lucide-react';
import { toDateKey } from '../../lib/membership';

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

const field = 'flex-1 bg-surface-2 border border-line-strong rounded-xl px-3.5 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors';

export const AdminQrScanner: React.FC = () => {
  const { processCheckIn, checkIns, users, memberProfiles } = useApp();

  const [inputCode, setInputCode] = useState('');
  const [scanResult, setScanResult] = useState<CheckInResult | null>(null);

  // ---- Camera scanning (progressive enhancement via the BarcodeDetector API) ----
  const BarcodeDetectorImpl = (typeof window !== 'undefined' ? (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector : undefined) ?? null;
  // getUserMedia only exists in secure contexts (HTTPS); iOS Safari also lacks BarcodeDetector, so jsQR is the fallback
  const canCamera = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  const handleProcessScan = useCallback(
    (code: string) => {
      if (!code.trim()) return;
      void processCheckIn(code.trim()).then(setScanResult);
      setInputCode('');
    },
    [processCheckIn]
  );

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  useEffect(() => {
    if (!cameraOn) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const detector = BarcodeDetectorImpl ? new BarcodeDetectorImpl({ formats: ['qr_code'] }) : null;
    const canvas = document.createElement('canvas');

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) return stream.getTracks().forEach(t => t.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const jsQR = detector ? null : (await import('jsqr')).default;
        const read = async (video: HTMLVideoElement): Promise<string | null> => {
          if (detector) return (await detector.detect(video))[0]?.rawValue ?? null;
          if (!video.videoWidth) return null;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx || !jsQR) return null;
          ctx.drawImage(video, 0, 0);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          return jsQR(img.data, img.width, img.height)?.data ?? null;
        };
        const loop = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const value = await read(videoRef.current);
            const now = Date.now();
            // Ignore the same code for 4 s so one QR doesn't register repeatedly
            if (value && (value !== lastScanRef.current.code || now - lastScanRef.current.at > 4000)) {
              lastScanRef.current = { code: value, at: now };
              handleProcessScan(value);
            }
          } catch {
            /* frame not ready */
          }
          timer = setTimeout(loop, 350);
        };
        loop();
      } catch {
        setCameraError('Kamera tidak dapat diakses. Izinkan akses kamera atau gunakan input manual.');
        setCameraOn(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [cameraOn, BarcodeDetectorImpl, handleProcessScan]);

  // Quick test scenarios built from real members (one per membership state) so they never go stale
  const scenarios = useMemo(() => {
    const pick = (status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED') => {
      const p = Object.values(memberProfiles).find(x => x.status === status);
      const u = p && users.find(x => x.id === p.userId);
      return u ? { id: u.id, name: u.name } : null;
    };
    return [
      { label: 'Member aktif', tone: 'neutral', m: pick('ACTIVE') },
      { label: 'Segera habis', tone: 'warn', m: pick('EXPIRING_SOON') },
      { label: 'Kedaluwarsa (ditolak)', tone: 'danger', m: pick('EXPIRED') },
    ].filter(s => s.m) as { label: string; tone: 'neutral' | 'warn' | 'danger'; m: { id: string; name: string } }[];
  }, [memberProfiles, users]);

  const today = toDateKey();
  const todayLog = useMemo(
    () => checkIns.filter(c => toDateKey(new Date(c.timestamp)) === today).toSorted((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [checkIns, today]
  );
  const olderCount = checkIns.length - todayLog.length;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold uppercase text-white">Scanner check-in gerbang</h1>
        <p className="text-xs text-zinc-400 mt-1">Validasi QR dinamis dan ID member: masa aktif, kedaluwarsa token, dan pencegahan double check-in (20 menit).</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-surface rounded-2xl border border-line p-6 space-y-6">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <QrCode className="w-4 h-4 text-zinc-400" /> Input QR atau ID member
          </h2>

          {canCamera ? (
            <div className="space-y-3">
              {cameraOn ? (
                <div className="relative rounded-xl overflow-hidden border border-line-strong bg-black aspect-video">
                  <video ref={videoRef} muted playsInline className="w-full h-full object-cover" aria-label="Pratinjau kamera scanner" />
                  <div className="absolute left-0 right-0 h-0.5 bg-white shadow-[0_0_12px_#FFFFFF] animate-laser-scan opacity-70 pointer-events-none" />
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setCameraError('');
                  if (cameraOn) stopCamera();
                  else setCameraOn(true);
                }}
                className="w-full py-2.5 rounded-xl border border-line-strong hover:border-white text-xs font-bold text-white transition-colors flex items-center justify-center gap-2"
              >
                {cameraOn ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                {cameraOn ? 'Matikan kamera' : 'Pindai dengan kamera'}
              </button>
              {cameraError && (
                <p role="alert" className="text-[11px] text-rose-400">
                  {cameraError}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-400">Kamera tidak tersedia di browser atau koneksi ini (membutuhkan HTTPS). Gunakan barcode reader atau input manual di bawah.</p>
          )}

          <form
            onSubmit={e => {
              e.preventDefault();
              handleProcessScan(inputCode);
            }}
            className="space-y-2"
          >
            <label htmlFor="scan-input" className="block text-xs font-semibold text-zinc-400">
              Barcode reader atau input manual
            </label>
            <div className="flex gap-2">
              <input id="scan-input" type="text" autoComplete="off" placeholder="Tempel payload QR, ID, atau email member" value={inputCode} onChange={e => setInputCode(e.target.value)} className={field} />
              <button type="submit" disabled={!inputCode.trim()} className="px-5 py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Proses
              </button>
            </div>
          </form>

          {scenarios.length > 0 && (
            <div className="pt-4 border-t border-line space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 block">Simulasi cepat</span>
              <div className="grid grid-cols-1 gap-2">
                {scenarios.map(s => (
                  <button
                    key={s.label}
                    onClick={() => handleProcessScan(s.m.id)}
                    className={`w-full p-2.5 rounded-lg border text-left text-xs font-medium transition-colors flex items-center justify-between gap-3 ${
                      s.tone === 'danger'
                        ? 'bg-rose-950/20 border-rose-800/40 hover:bg-rose-950/40 text-rose-300'
                        : s.tone === 'warn'
                        ? 'bg-amber-950/20 border-amber-800/40 hover:bg-amber-950/40 text-amber-300'
                        : 'bg-surface-2 border-line hover:border-white text-zinc-200'
                    }`}
                  >
                    <span>
                      {s.m.name} <span className="text-zinc-400">· {s.label}</span>
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono shrink-0">Pindai →</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="bg-surface rounded-2xl border border-line p-6 flex flex-col justify-between">
          <div aria-live="assertive">
            <h2 className="text-sm font-bold text-white mb-4">Hasil validasi turnstile</h2>
            {scanResult ? (
              <div
                key={scanResult.checkIn?.id ?? scanResult.message}
                className={`p-6 rounded-2xl border text-center space-y-4 ${scanResult.success ? 'bg-emerald-950/30 border-emerald-700' : 'bg-rose-950/40 border-rose-700'}`}
              >
                <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${scanResult.success ? 'bg-emerald-500 text-black' : 'bg-rose-600 text-white'}`}>
                  {scanResult.success ? <CheckCircle className="w-10 h-10 stroke-[2.5]" /> : <AlertTriangle className="w-10 h-10 stroke-[2.5]" />}
                </div>
                <div>
                  <h3 className={`text-xl font-extrabold uppercase ${scanResult.success ? 'text-emerald-200' : 'text-rose-100'}`}>{scanResult.success ? 'Akses diterima' : 'Akses ditolak'}</h3>
                  <p className="text-sm font-bold text-zinc-100 mt-1">{scanResult.checkIn?.memberName ?? ''}</p>
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{scanResult.message}</p>
                </div>
                {scanResult.success && scanResult.checkIn && (
                  <div className="p-2.5 rounded-xl bg-black/40 text-xs font-mono text-white inline-block font-bold border border-line-strong">Sisa masa aktif: {scanResult.checkIn.remainingDays} hari</div>
                )}
              </div>
            ) : (
              <div className="relative h-64 rounded-2xl border border-dashed border-line-strong flex flex-col items-center justify-center text-center p-6 text-zinc-500 overflow-hidden bg-black/20">
                <div className="absolute left-0 right-0 h-0.5 bg-white/60 animate-laser-scan pointer-events-none" />
                <QrCode className="w-12 h-12 mb-2 stroke-[1.5] text-zinc-600" />
                <span className="text-xs font-semibold text-zinc-300">Menunggu pemindaian QR</span>
                <span className="text-[11px] text-zinc-500 mt-0.5">Arahkan scanner ke layar ponsel member</span>
              </div>
            )}
          </div>
          <div className="pt-4 mt-4 border-t border-line text-[11px] text-zinc-500">
            Token QR berlaku ±2 menit. Hasil scan langsung mencatat check-in dan menambah hitungan kepadatan gym.
          </div>
        </section>
      </div>

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" /> Log gerbang hari ini
          </h2>
          <span className="text-xs text-zinc-400 font-mono">{todayLog.length} percobaan</span>
        </div>

        {todayLog.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">Belum ada check-in hari ini{olderCount > 0 ? ` (${olderCount} catatan hari sebelumnya tersimpan)` : ''}.</p>
        ) : (
          <ul className="divide-y divide-line">
            {todayLog.map(chk => (
              <li key={chk.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold text-white text-sm">{chk.memberName}</span>
                  <div className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                    {new Date(chk.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB · {chk.memberId}
                  </div>
                  {chk.reason && <p className="text-[11px] text-rose-400 mt-0.5">{chk.reason}</p>}
                </div>
                {chk.status === 'GRANTED' ? (
                  <span className="self-start px-2.5 py-1 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold">Masuk · {chk.remainingDays} hari sisa</span>
                ) : (
                  <span className="self-start px-2.5 py-1 rounded bg-rose-950/60 border border-rose-800 text-rose-300 font-bold">Ditolak</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
