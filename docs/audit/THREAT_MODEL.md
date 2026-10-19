# Threat Model (ringkas)

**Aset:** akun & sesi (admin paling kritis), data member (PII, foto progres, pembayaran), token QR masuk gym, `MIDTRANS_SERVER_KEY`, `QR_SIGNING_SECRET`, `SESSION_SECRET`.

**Titik masuk:** `/api/auth/*` (login/register), `/api/member|coach|admin/*`, upload foto, webhook `/api/payments/webhooks/*`, scanner QR, `/api/dev/*` (hanya demo), build/rilis Vercel.

**Batas kepercayaan:** browser ↔ API (cookie + CSRF header + Origin); Midtrans → webhook (signature); antar-instance Vercel (tidak berbagi state).

**Ancaman teratas:**
1. Endpoint demo (`/api/dev/login-as`) aktif di produksi → dicegah `loadConfig` + cek ulang di `app.ts`.
2. Sesi hilang/terbelah antar-instance serverless → diperbaiki (sesi bertanda tangan).
3. Brute-force login tersebar ke banyak instance (limiter in-memory) → terbuka di Vercel.
4. CSRF lewat alias/domain → cek Origin = host + header `X-APEX-CSRF`.
5. Clickjacking/XSS di halaman CDN tanpa header → diperbaiki.
6. IDOR member ↔ member → dicakup `tests/server/authorization.test.ts`, e2e "data isolation".
7. Replay QR → dicakup `tests/server/checkin.test.ts`.
8. Webhook pembayaran palsu → signature Midtrans, `tests/server/payments.test.ts`.
9. Upload file berbahaya → sniff magic-byte + strip metadata + batas ukuran.

**Lingkungan uji tersedia:** Node 22+, vitest (in-memory SQLite), Playwright Chromium + axe, bundle Vercel dijalankan lokal. Tidak tersedia: akses ke deployment Vercel (SSO 302) dan log Vercel.
