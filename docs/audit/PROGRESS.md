# Progres

- [x] Fase 0: pemetaan, baseline (typecheck, lint, 96 tes, build, audit)
- [x] Bug ganti user di Vercel: reproduksi tes → perbaikan → uji bundle Vercel lokal
- [x] Fase 1 keamanan: secret scan + riwayat git, header CDN, review auth/CSRF/upload/SQL
- [x] Fase 2 pembersihan: knip, 4 ekspor mati, `rolldown`
- [x] Fase 3–6: aset, struktur, kualitas, UI (e2e + axe 20/20) — tanpa perubahan yang perlu
- [x] Fase 7 dokumentasi: README Vercel, `.env.example`, `docs/audit/*`
- [x] Fase 8 verifikasi akhir dari install bersih

Blocker: verifikasi di deployment Vercel nyata (SSO 302, MCP 403) → `MANUAL_ACTIONS.md`.
