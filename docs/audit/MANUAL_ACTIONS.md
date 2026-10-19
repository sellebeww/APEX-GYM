# Tindakan Manual

Urut prioritas. **[BLOK]** = perlu sebelum demo dianggap beres.

## 1. [BLOK] Merge & deploy perbaikan (±5 menit)
Kenapa: perbaikan ada di branch lokal `chore/audit-20261019`, belum di Vercel.
```bash
git checkout main && git merge --ff-only chore/audit-20261019 && git push
```
(atau push branch lalu buat PR). Vercel akan build ulang otomatis.
Laporkan balik: apakah ganti Admin → Coach → Member di pemilih akun demo sekarang tetap masuk.

## 2. Set secret di Vercel (±3 menit)
Kenapa: tanpa ini dipakai secret turunan yang bisa ditebak (aman hanya untuk demo).
1. Jalankan dua kali: `openssl rand -hex 32`
2. Vercel → project **apex-gym** → Settings → Environment Variables → tambah `SESSION_SECRET` dan `QR_SIGNING_SECRET` (Production + Preview).
3. Redeploy.
Laporkan balik: sudah di-set (jangan kirim nilainya).

## 3. Izinkan akses verifikasi (opsional, ±2 menit)
Kenapa: semua alias `*.vassels-projects.vercel.app` mengembalikan 302 (Deployment Protection) dan akses MCP Vercel ke scope `vassels-projects` ditolak 403, jadi saya tidak bisa menguji deployment langsung.
Pilihan: kirim URL produksi publik, atau Settings → Deployment Protection → buat "Protection Bypass for Automation", atau re-autentikasi koneksi Vercel di claude.ai ke tim `vassels-projects`.

## 4. Keputusan: database terkelola (bila demo akan dipakai orang sungguhan)
Kenapa: data yang ditulis (booking, check-in, chat) tetap per-instance dan hilang saat cold start.
Pilih: Turso/libSQL (paling dekat SQLite) atau Postgres. Perkiraan kerja: besar (semua query sinkron `better-sqlite3`).
