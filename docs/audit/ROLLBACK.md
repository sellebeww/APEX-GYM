# Rollback

Semua perubahan ada di branch `chore/audit-20261019`; `main` tidak disentuh.

- Buang semuanya: `git checkout main && git branch -D chore/audit-20261019`
- Batalkan satu commit (setelah merge): `git revert <sha>`

| Commit | Isi |
|---|---|
| `2bf833c` | fix(vercel): sesi demo valid lintas instance & alias |
| `efa1499` | fix(vercel): header keamanan di halaman CDN |
| `439e8e0` | chore: hapus helper mati, deklarasi `rolldown` |
| (berikutnya) | docs: laporan audit, README Vercel, `.env.example` |
