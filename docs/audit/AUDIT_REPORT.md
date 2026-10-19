# Laporan Audit APEX Gym — 19 Okt 2026

Branch: `chore/audit-20261019` (dari `main` @ `c4e9d7e`). Tidak ada push/merge.

## 1. Ringkasan eksekutif

Sebelum: di Vercel, **ganti user (pemilih akun demo) gagal / langsung keluar lagi**, karena sesi disimpan di SQLite `/tmp` per-instance, dan POST dari alias deployment yang tidak terdaftar ditolak sebagai lintas-origin. Halaman statis di Vercel juga tidak dapat header keamanan (CSP dll.).
Sesudah: kedua penyebab diperbaiki dan dibuktikan dengan tes + uji bundle Vercel asli; header keamanan dipasang di CDN; 4 helper mati dihapus; `rolldown` dideklarasikan. Kode aplikasi sudah dalam kondisi baik (keamanan, a11y, responsif lulus otomatis), jadi tidak ada refactor besar.
Angka: 0 file dihapus, 4 ekspor mati dihapus, 3 temuan keamanan diperbaiki, tes 96 → 101, e2e 20/20, ukuran `dist/` 2,4 MB (tidak berubah).

## 2. Bug "ganti user tidak bisa" di Vercel

| # | Penyebab | Bukti | Perbaikan | Status |
|---|---|---|---|---|
| 1 | Sesi = baris di SQLite `/tmp` per-instance. Request berikutnya yang jatuh ke instance lain / setelah cold start tidak mengenali cookie → `me: null` → kembali ke halaman publik. | `server/vercel.ts:14` (komentar "not shared between instances"); tes `tests/server/serverless.test.ts` gagal sebelum perbaikan. | Demo-only `SESSION_SECRET`: token `nonce.userId.expiry.hmac`. Token yang tidak dikenal DB lokal diverifikasi (HMAC timing-safe, belum kedaluwarsa, user aktif) lalu didaftarkan ulang. `server/services/auth.ts`, `server/config.ts`. | [TERVERIFIKASI] |
| 2 | CSRF hanya mengizinkan `ALLOWED_ORIGINS` = 3 host dari env Vercel. Membuka situs lewat alias lain (mis. `apex-gym-vassels-projects.vercel.app` atau domain kustom) → semua POST, termasuk `login-as`, ditolak 403. | Tes "accepts a POST whose Origin matches the host" gagal sebelum perbaikan. | Origin yang host-nya sama dengan host request sendiri dianggap same-origin. Origin asing tetap 403. `server/app.ts:75-78`. | [TERVERIFIKASI] |
| 3 | `QR_SIGNING_SECRET` acak per-instance → QR dari instance A ditolak di B. | `server/config.ts:46-48`. | Secret stabil dari env atau turunan deterministik. `server/vercel.ts`. | [TERVERIFIKASI] build, [TIDAK DIUJI] lintas-instance QR di Vercel nyata |

Uji bundle `.vercel/output/functions/api.func` lokal (Host = alias tim): login-as admin → coach → member semua `200` dan `/api/state` mengembalikan user yang benar; setelah DB `/tmp` dihapus + restart (simulasi cold start/instance lain) sesi member tetap valid; Origin `https://evil.example` → `403`.

Tidak bisa diuji langsung di deployment: semua alias `*.vassels-projects.vercel.app` mengembalikan `302` (Vercel Deployment Protection), dan API log/deployments Vercel menolak akses (403 scope). Lihat `MANUAL_ACTIONS.md`.

**Batasan tersisa (by design demo):** data yang ditulis di satu instance (booking, check-in, chat) tetap tidak terlihat di instance lain dan hilang saat cold start. Solusi permanen = database terkelola (keputusan manual).

## 3. Temuan keamanan

| Keparahan | Lokasi | Deskripsi | Status |
|---|---|---|---|
| Tinggi (fungsional) | `server/vercel.ts`, `server/services/auth.ts` | Sesi hilang lintas instance (di atas) | Diperbaiki |
| Sedang | `scripts/vercel-build.ts` | Halaman SPA di CDN Vercel tanpa CSP, X-Frame-Options, nosniff, Referrer/Permissions-Policy | Diperbaiki: route `^/(.*)$` memakai `securityHeaders(true)` yang sama dengan server Node. Dicek `dist/index.html` hanya punya `<script src>` same-origin, jadi CSP tidak memblokir. |
| Sedang | `server/lib/rateLimit.ts` | Rate limit in-memory → per-instance di Vercel (brute-force bisa dibagi ke beberapa instance) | Keputusan manual (butuh store bersama, mis. Redis/Upstash) |
| Rendah | `server/vercel.ts` | Fallback secret bisa ditebak bila env tidak di-set | Diterima untuk demo (siapa pun sudah bisa login-as admin). Set env → `MANUAL_ACTIONS.md` |
| Rendah | `server/services/auth.ts` (`adoptSignedSession`) | Token bertanda tangan tidak bisa dicabut lintas instance (logout/ganti password di instance lain) | Hanya aktif saat `demoMode`; produksi menolak `DEMO_MODE`. Ditandai `shortcut:` di kode |
| Info | `tests/server/payments.test.ts:6` | `SB-Mid-server-TESTKEY` | Dummy, bukan secret nyata |

Yang diperiksa dan tidak bermasalah (cara cek): secret di kode + seluruh riwayat git (regex kunci umum, private key, JWT) — tidak ada; file sensitif ter-track (`git ls-files`) — tidak ada; `.gitignore` mencakup `.env*`, `data/`, `.vercel/`; SQL — semua query berparameter, interpolasi hanya `placeholders(n)`; tidak ada `dangerouslySetInnerHTML`/`innerHTML`/`eval`; password scrypt + dummy-verify anti-enumerasi + lockout; cookie `__Host-`, HttpOnly, Secure, SameSite=Lax; upload foto: regex MIME + magic-byte sniff + strip EXIF + batas ukuran; `npm audit`: 0 kerentanan (sebelum & sesudah).

## 4. Pembersihan kode & dependensi

| Item | Bukti tak terpakai | Aksi |
|---|---|---|
| `hasValidAccess` (`shared/membership.ts`) | knip + `grep -w` = 1 (definisi saja) | Dihapus |
| `assertPayable` (`server/services/payments.ts`) + import `badRequest` | idem | Dihapus |
| `sumRupiah` (`shared/money.ts`) | idem | Dihapus |
| `GYM_NAME` (`src/config/gym.ts`) | idem | Dihapus |
| `rolldown` | dipakai `scripts/vercel-build.ts`, hanya ada sebagai transitif `vite` | Ditambah ke devDependencies, pin `1.2.13` (versi terpasang) |

Tidak dihapus: `LOGO_GYM`/`LOGO_FULL` (data vektor brand, README melarang menggambar ulang), 34 ekspor lain yang dipakai di file sendiri (hanya `export` berlebih, nilai kecil), `server/vercel.ts` (false positive knip: entry build).

## 5. Aset visual

`assets-original/` (12 file, ±10 MB) = sumber asli; versi teroptimasi WebP (43–160 KB) di `src/assets/images/`. Tidak ikut build (bukan di `public/`/`src/`). Dipertahankan sesuai aturan "simpan sumber asli bila kompresi lossy". Nama snake_case tidak diubah (lihat `DECISIONS.md`).

## 6. Struktur & penamaan

Struktur sudah rapi (`server/{routes,services,lib,db}`, `shared/`, `src/{components/{admin,coach,member,common,public},context,lib,config}`). Tidak diubah. Komponen PascalCase, hooks/fungsi camelCase, konstanta UPPER_SNAKE — sudah konsisten.

## 7. UI/UX & aksesibilitas

E2E Playwright (`tests/e2e/responsive.spec.ts`) desktop + mobile untuk landing dan portal member/coach/admin: tidak ada scroll horizontal, error konsol, atau pelanggaran axe-core. Tidak ada perubahan UI (tidak ada regresi yang perlu diperbaiki). Pemeriksaan kontras/keyboard manual di luar axe: [TIDAK DIUJI].

## 8. Hasil verifikasi

| Perintah | Baseline | Sesudah |
|---|---|---|
| `npm ci` | OK | OK |
| `npm run typecheck` | exit 0 | exit 0 |
| `npm run lint` (oxlint) | 0 error, 28 warning | 0 error, 28 warning |
| `npm test` (vitest) | 96/96 | 101/101 (+5 tes serverless/origin) |
| `npm run build` | OK, dist 2,4 MB | OK, dist 2,4 MB |
| `node scripts/vercel-build.ts` | — | OK |
| `npx playwright test` | — | 20/20 |
| `npm audit` | 0 | 0 |

## 9. Masalah tersisa (urut prioritas)

1. Database terkelola (Turso/libSQL atau Postgres) agar data demo konsisten antar-instance — perlu migrasi dari `better-sqlite3` sinkron; perubahan besar, keputusan kamu.
2. Rate limiter bersama (Upstash Redis) bila Vercel dipakai untuk akun sungguhan.
3. 28 warning React Compiler di komponen admin/coach (memoization) — tidak berbahaya, perbaiki bertahap.

## 10. Cara membatalkan

Lihat `ROLLBACK.md`.
