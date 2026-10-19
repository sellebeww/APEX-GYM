import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import QRCode from 'qrcode';
import { RefreshCw, AlertCircle, CheckCircle, Clock, History } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { formatDateId, formatDateTimeId, getDaysRemaining } from '../../lib/membership';

/** Ask for a fresh token this many seconds before the current one expires. */
const REFRESH_MARGIN_S = 10;

export const MemberQrCard: React.FC = () => {
  const { currentUser, memberProfiles, getQrToken, checkIns, setMemberTab, showToast } = useApp();

  const profile = currentUser ? memberProfiles[currentUser.id] : null;
  const isExpired = !profile || profile.status === 'EXPIRED';
  const isExpiringSoon = profile?.status === 'EXPIRING_SOON';
  const daysLeft = getDaysRemaining(profile?.endDate);

  const [qrDataUrl, setQrDataUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [ttl, setTtl] = useState(60);
  const [now, setNow] = useState(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const userId = currentUser?.id;

  const generateQr = useCallback(async () => {
    if (!userId || isExpired) return;
    setIsRefreshing(true);
    try {
      const { token, expiresAt: exp, ttlSeconds } = await getQrToken();
      const url = await QRCode.toDataURL(token, {
        width: 280,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#FFFFFF' }, // maximum contrast for scanner reliability
      });
      setQrDataUrl(url);
      setExpiresAt(Date.parse(exp));
      setTtl(ttlSeconds);
      setTokenError(null);
    } catch (err) {
      // Never keep showing a code that is about to stop working
      setQrDataUrl('');
      setExpiresAt(null);
      setTokenError(err instanceof Error ? err.message : 'Gagal membuat kode QR.');
    } finally {
      setIsRefreshing(false);
    }
  }, [userId, isExpired, getQrToken]);

  // Initial token, then renew shortly before expiry. The 1 s tick drives the countdown.
  useEffect(() => {
    void generateQr();
    // generateQr identity changes with getQrToken on every render; userId/isExpired are the real triggers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isExpired]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const secondsLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0;
  useEffect(() => {
    if (expiresAt && secondsLeft <= REFRESH_MARGIN_S && !isRefreshing && !tokenError) void generateQr();
  }, [expiresAt, secondsLeft, isRefreshing, tokenError, generateQr]);

  const handleManualRefresh = () => {
    void generateQr();
    showToast('Kode QR dimuat ulang.', 'info');
  };

  const memberCheckins = useMemo(
    () => checkIns.filter(c => c.memberId === userId).toSorted((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [checkIns, userId]
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold uppercase text-white">Kartu member & QR akses</h1>
          <p className="text-xs text-zinc-400 mt-1">Tunjukkan kode QR ini ke scanner turnstile atau resepsionis di lobi.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400">Status akses</span>
          {isExpired ? (
            <span className="font-bold px-2.5 py-1 rounded-md bg-rose-950/60 border border-rose-800 text-rose-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {profile?.suspended ? 'Ditangguhkan' : 'Kedaluwarsa'}
            </span>
          ) : isExpiringSoon ? (
            <span className="font-bold px-2.5 py-1 rounded-md bg-amber-950/60 border border-amber-800 text-amber-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Segera habis ({daysLeft} hari)
            </span>
          ) : (
            <span className="font-bold px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-800 text-emerald-300 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              Aktif & valid
            </span>
          )}
        </div>
      </div>

      {isExpired && (
        <div role="alert" className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-rose-200">
                {profile?.suspended ? 'Keanggotaan Anda ditangguhkan.' : 'Membership Anda telah berakhir.'}
              </p>
              <p className="text-[11px] text-rose-300/80 mt-0.5">
                {profile?.suspended
                  ? 'Hubungi resepsionis APEX Gym untuk mengaktifkan kembali.'
                  : 'Scanner turnstile akan menolak QR ini hingga paket diperpanjang.'}
              </p>
            </div>
          </div>
          {!profile?.suspended && (
            <button
              onClick={() => setMemberTab('membership')}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 transition-colors"
            >
              Perpanjang sekarang
            </button>
          )}
        </div>
      )}

      {/* Digital member card */}
      <section className="relative rounded-3xl overflow-hidden bg-linear-to-br from-surface-2 via-surface to-ink border border-line-strong p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex-1 space-y-6 w-full text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <BrandLogo variant="horizontal" size="sm" subtitleText="OFFICIAL ACCESS" />
              <span className="text-[10px] font-mono font-bold tracking-widest text-white px-2.5 py-1 rounded-full bg-black/60 border border-line-strong uppercase">
                Member pass
              </span>
            </div>

            <div>
              <div className="text-[10px] uppercase font-semibold tracking-[0.2em] text-zinc-500 mb-1">Nama pemilik kartu</div>
              <h2 className="text-2xl font-bold text-white">{currentUser?.name}</h2>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                {currentUser?.email} · {currentUser?.phone}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-4 max-w-sm mx-auto md:mx-0 pt-4 border-t border-line text-left">
              {[
                { l: 'Paket aktif', v: profile?.planName || 'Tanpa paket' },
                { l: 'Berlaku hingga', v: formatDateId(profile?.endDate, 'short') },
                { l: 'Kunjungan bulan ini', v: `${profile?.visitsThisMonth || 0}x` },
                { l: 'Sisa sesi PT', v: `${profile?.ptSessionsRemaining || 0} sesi` },
              ].map(i => (
                <div key={i.l}>
                  <dt className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">{i.l}</dt>
                  <dd className="text-xs font-bold text-zinc-100 mt-0.5">{i.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex flex-col items-center">
            <div
              className={`relative p-3.5 rounded-2xl bg-white flex items-center justify-center overflow-hidden transition-transform ${
                isRefreshing ? 'scale-95' : 'scale-100'
              }`}
            >
              {qrDataUrl ? (
                <div className="relative">
                  <img src={qrDataUrl} alt="Kode QR masuk gym" className="w-48 h-48 sm:w-56 sm:h-56 rounded-lg" />
                  {!isExpired && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
                      <div className="absolute left-0 right-0 h-0.5 bg-black/70 shadow-[0_0_10px_rgba(0,0,0,0.6)] animate-laser-scan" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-48 h-48 sm:w-56 sm:h-56 bg-zinc-200 flex flex-col items-center justify-center gap-2 p-4 text-center text-xs text-zinc-700">
                  {tokenError && !isExpired ? (
                    <>
                      <span role="alert">{tokenError}</span>
                      <button onClick={handleManualRefresh} className="px-3 py-1.5 rounded bg-black text-white font-bold">
                        Coba lagi
                      </button>
                    </>
                  ) : isExpired ? (
                    'QR tidak tersedia'
                  ) : (
                    'Memuat QR…'
                  )}
                </div>
              )}

              {isExpired && (
                <div className="absolute inset-0 bg-black/90 rounded-2xl flex flex-col items-center justify-center text-center p-4">
                  <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
                  <span className="text-sm font-extrabold text-white">AKSES NONAKTIF</span>
                  <span className="text-[11px] text-zinc-400 mt-1">
                    {profile?.suspended ? 'Keanggotaan ditangguhkan' : 'Paket telah kedaluwarsa'}
                  </span>
                </div>
              )}
            </div>

            <div className="w-full max-w-[230px] mt-4 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                <span className="flex items-center gap-1">
                  <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Token refresh
                </span>
                <span className="font-bold text-white tabular-nums">{secondsLeft}s</span>
              </div>
              <div
                role="progressbar"
                aria-label="Waktu hingga token baru"
                aria-valuenow={secondsLeft}
                aria-valuemin={0}
                aria-valuemax={ttl}
                className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden"
              >
                <div className="h-full bg-white rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${(secondsLeft / ttl) * 100}%` }} />
              </div>
              <button
                onClick={handleManualRefresh}
                className="w-full py-2 rounded-lg bg-black/50 hover:bg-black/80 border border-line-strong hover:border-white text-[11px] font-semibold text-zinc-300 hover:text-white transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" />
                Muat ulang kode
              </button>
              <p className="text-[10px] text-zinc-500 text-center pt-1">Setiap kode hanya berlaku sekali dan diperbarui otomatis, sehingga tangkapan layar tidak bisa dipakai ulang.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Visit history */}
      <section className="bg-surface rounded-2xl border border-line p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-bold text-white">Riwayat kunjungan terakhir</h2>
          </div>
          <span className="text-xs text-zinc-400 font-mono">{memberCheckins.length} catatan</span>
        </div>

        {memberCheckins.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-6">Belum ada log kunjungan. Pindai QR di gerbang untuk mencatat kehadiran pertama.</p>
        ) : (
          <ul className="divide-y divide-line">
            {memberCheckins.map(chk => (
              <li key={chk.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 text-xs">
                <div>
                  <div className="font-medium text-zinc-200">{chk.method === 'QR' ? 'Pindai QR di gerbang' : 'Dicatat resepsionis'}</div>
                  <div className="text-[11px] text-zinc-500 font-mono">
                    {formatDateTimeId(chk.timestamp, { weekday: 'long' })} WIB
                  </div>
                </div>
                {chk.status === 'GRANTED' ? (
                  <span className="self-start text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 rounded">
                    Berhasil masuk
                  </span>
                ) : (
                  <span className="self-start text-[11px] font-semibold text-rose-400 bg-rose-950/40 border border-rose-800/60 px-2 py-0.5 rounded max-w-md">
                    Ditolak{chk.reason ? `: ${chk.reason}` : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
