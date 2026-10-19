# APEX Gym

Aplikasi web gym: **situs publik**, **area member**, **area coach**, dan **panel admin**.
Frontend React 19 + Vite 8 + Tailwind v4; backend Hono (Node) dengan database SQLite (`better-sqlite3`).

> **Status:** siap diuji dan siap staging. **Belum terbukti siap untuk pelanggan nyata**: pembayaran Midtrans belum pernah diuji terhadap akun sandbox/produksi sungguhan, Safari/iOS belum diuji di perangkat, dan belum ada penetration test independen. Lihat [Batasan](#batasan-dan-yang-belum-terbukti).

## Persyaratan

- Node.js **>= 22.18** (server dijalankan langsung dari TypeScript, tanpa langkah kompilasi)
- npm (package manager yang dipakai; satu-satunya lockfile adalah `package-lock.json`)

## Menjalankan untuk development

```bash
npm install
npm run dev:server      # API di http://127.0.0.1:8787 (membuat DB demo sintetis di ./data pada run pertama)
npm run dev             # frontend di http://127.0.0.1:3000, /api diteruskan ke server
```

Semua variabel environment opsional di development (lihat `.env.example`). Untuk mulai dari data kosong lagi, hentikan server lalu hapus folder `data/`.

### Akun demo (khusus development)

`DEMO_MODE` aktif otomatis di development: DB kosong diisi data sintetis dan tombol **Akun Demo** muncul di header. Password semua akun demo: `ApexDemo2026` (ubah dengan `SEED_PASSWORD` sebelum run pertama). Server **menolak start** di production jika `DEMO_MODE=true`.

| Peran | Email |
|---|---|
| Admin | `admin@gym.test` |
| Coach | `hendra@gym.test`, `sarah@gym.test`, ... |
| Member | `reza@gym.test` (aktif), `nadia@gym.test` (segera habis), `siti@gym.test` (kedaluwarsa) |

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run typecheck` | `tsc` strict untuk frontend, server, dan tes E2E |
| `npm run lint` | oxlint |
| `npm test` | unit + integrasi (vitest; server diuji lewat `app.request` dengan DB in-memory) |
| `npm run test:e2e` | build lalu Playwright (Chromium; server + DB sementara di `test-results/`). Pertama kali: `npx playwright install chromium` |
| `npm run build` | build produksi frontend ke `dist/` |
| `npm run check` | typecheck + lint + test + build |
| `npm audit` | audit dependensi (butuh internet) |

## Fitur: nyata (server) vs simulasi

Nyata, divalidasi dan disimpan server (SQLite, transaksi, versi optimistik untuk edit bersamaan, audit log):

- Login/registrasi/logout, sesi cookie `HttpOnly` + `SameSite=Lax` (`__Host-` di HTTPS), password di-hash scrypt, kunci akun setelah 8 kegagalan, rate limit login.
- Otorisasi per peran di setiap endpoint; member hanya menerima datanya sendiri (profil, pembayaran, chat, dll.).
- QR check-in: token bertanda tangan HMAC, berlaku 60 detik, sekali pakai (anti-replay), pencatatan check-in atomik, anti double check-in 20 menit.
- Pembayaran: harga selalu dari server; tunai tetap **PENDING** sampai admin mengonfirmasi; konfirmasi ganda tidak memperpanjang dua kali; webhook Midtrans memverifikasi signature dan idempoten; refund.
- Booking PT (slot, kuota, aturan batal 12 jam, zona waktu WIB), kelas studio (bentrok coach/ruangan), referral, meal plan, workout tracker, progres tubuh + foto (validasi isi file, metadata JPEG dibuang), chat coach, survei, tiket, pengumuman, keuangan + ekspor CSV (aman dari formula injection), audit log.
- Header keamanan (CSP ketat, HSTS di production, `frame-ancestors 'none'`), CSRF (origin + header khusus), batas ukuran body.

Simulasi / belum terbukti:

- **Simulator pembayaran** (`PAYMENT_PROVIDER=simulator`): hanya development. Tidak ada uang sungguhan.
- **Midtrans**: kode dan tes memakai Midtrans palsu; belum pernah diuji dengan kredensial sandbox sungguhan.
- **Notifikasi WhatsApp/email tidak ada.** Reset password dilakukan admin (password sementara ditampilkan sekali, wajib diganti saat login).

## Konfigurasi production (wajib dilakukan pemilik)

Salin `.env.example`, isi di server (jangan commit). Di production server menolak start jika konfigurasi tidak aman.

| Variabel | Keterangan |
|---|---|
| `NODE_ENV=production` | mengaktifkan aturan ketat |
| `PUBLIC_URL` | URL HTTPS situs, mis. `https://apexgym.example.com` |
| `QR_SIGNING_SECRET` | 32+ karakter acak (`openssl rand -hex 32`). Mengganti nilai ini membatalkan semua QR yang sedang aktif |
| `PAYMENT_PROVIDER=midtrans` | `simulator` dilarang di production |
| `MIDTRANS_SERVER_KEY` | dari dashboard Midtrans (Settings → Access Keys); `MIDTRANS_IS_PRODUCTION=true` untuk produksi |
| `DATABASE_PATH`, `UPLOAD_DIR` | arahkan ke disk persisten |
| `TRUST_PROXY=true` | hanya jika di belakang reverse proxy yang mengisi `X-Forwarded-For` |

Langkah:

1. `npm ci && npm run build`
2. Buat admin pertama (password tidak masuk riwayat shell):
   `ADMIN_NAME="Nama" ADMIN_EMAIL=owner@domain.com ADMIN_PHONE=0812xxxxxxxx ADMIN_PASSWORD='...' NODE_ENV=production npm run admin:create`
   (perintah ini juga membutuhkan `QR_SIGNING_SECRET`, `PUBLIC_URL`, dan `MIDTRANS_SERVER_KEY` karena memakai validasi konfigurasi yang sama).
3. `npm start` (server API + file statis `dist/` pada port `PORT`, default 8787). Pasang reverse proxy HTTPS di depannya (Caddy/nginx) dan teruskan `X-Forwarded-For`.
4. Di Midtrans, set **Payment Notification URL** ke `https://<domain>/api/payments/webhooks/midtrans`.
5. Jalankan **satu instance saja**: SQLite dan rate limiter berada di memori/berkas lokal proses.

Backup/restore: salin DB dengan `sqlite3 data/apex.db ".backup 'backup.db'"` (aman saat server berjalan) beserta folder `UPLOAD_DIR`. Restore: hentikan server, ganti file, start. Pasang cron untuk backup harian dan simpan di luar server. Log ditulis ke stdout/stderr; simpan lewat process manager (systemd/pm2/Docker) dan pantau `GET /api/health`.

Checklist deployment: typecheck/lint/test/E2E hijau → env production terisi → backup dibuat → deploy → `/api/health` OK → login admin → pembelian uji kecil di sandbox Midtrans → webhook sampai → QR check-in uji. Rollback: kembalikan kode dan `dist/` versi sebelumnya; restore backup DB bila rilis baru menambah migrasi (`server/db/migrations/*.sql`).

## Demo di Vercel

`npm run vercel-build` membuat bundle Build Output API: SPA statis + seluruh API sebagai satu Node Function (`server/vercel.ts`), dalam mode demo di SQLite sementara `/tmp`.

- Data **reset** setiap cold start dan **tidak dibagi** antar-instance. Cocok untuk demo, bukan untuk member sungguhan (butuh database terkelola).
- Sesi demo ditandatangani HMAC (`SESSION_SECRET`) sehingga tetap valid saat request jatuh ke instance lain atau setelah cold start; ganti akun lewat pemilih demo tetap jalan.
- Set `SESSION_SECRET` dan `QR_SIGNING_SECRET` (masing-masing `openssl rand -hex 32`) di Environment Variables Vercel. Tanpa itu dipakai nilai turunan yang bisa ditebak, aman hanya karena mode demo memang membuka semua akun.

## Batasan dan yang belum terbukti

- Safari/iOS **belum diuji di perangkat**. Scanner memakai `BarcodeDetector` bila ada, jika tidak memakai `jsqr` (decode diuji unit, bukan dengan kamera nyata); kamera butuh HTTPS. Input manual/barcode reader selalu tersedia dan divalidasi server.
- Tes E2E hanya di Chromium (desktop dan emulasi Pixel 7). Firefox/WebKit belum dijalankan.
- Cakupan E2E UI: login/registrasi, hak akses, scanner admin, kelas, ekspor keuangan, manajemen member, dan rute portal terpilih (axe WCAG A/AA, overflow, console). Alur UI member (booking PT, meal planner, workout tracker, upload foto) diuji di tingkat API/server, belum lewat klik UI.
- axe tidak membuktikan seluruh aksesibilitas; belum ada uji screen reader manual.
- Font dimuat dari Google Fonts (diizinkan di CSP). Untuk privasi/ketersediaan, pertimbangkan self-host.
- `npm audit` perlu dijalankan di jaringan yang bisa menjangkau registry npm.

## Identitas visual

Hitam `#050505`, putih logo `#F5F5F5`, abu netral; warna lain hanya untuk status. Tipografi Archivo (judul), Plus Jakarta Sans (teks), JetBrains Mono (angka). Logo vektor di `src/assets/brand/logoPaths.ts` (jangan digambar ulang). Aset asli ada di `assets-original/`.

## Struktur

```
server/        Hono API: routes/, services/ (aturan bisnis), db/ (migrasi + seed), payments/, lib/
shared/        aturan murni dipakai server dan frontend (uang, waktu, CSV, aturan bisnis)
src/           frontend React (components/, context/AppContext.tsx, lib/)
scripts/       create-admin.ts
tests/server/  tes integrasi API    tests/e2e/  tes Playwright
```
