# Keputusan

| Keputusan | Alasan | Alternatif ditolak |
|---|---|---|
| Sesi demo bertanda tangan HMAC, di-adopsi ke DB lokal saat tak dikenal | Memperbaiki ganti user lintas instance tanpa mengganti database; ID user seed deterministik | Database terkelola (terlalu besar, keputusan bisnis); sesi stateless penuh (hilang revokasi di mode non-demo) |
| `sessionSecret` hanya aktif bila `demoMode` | Produksi tetap memakai sesi DB yang bisa dicabut | Aktif di semua mode |
| Fallback secret turunan `VERCEL_PROJECT_ID` | Demo jalan tanpa konfigurasi; demo sudah membuka semua akun lewat login-as | Gagal start tanpa env (demo jadi rusak) |
| CSRF: Origin sama dengan host request = same-origin | Benar secara definisi; berlaku untuk semua alias/domain kustom | Menambahkan alias satu per satu ke `ALLOWED_ORIGINS` |
| Header keamanan di route CDN Vercel memakai `securityHeaders()` yang sama | Satu sumber kebenaran | Menyalin daftar header |
| Tidak mengganti nama aset snake_case | Hanya kosmetik, banyak referensi, risiko > manfaat | Rename ke kebab-case |
| Tidak menghapus `export` berlebih (34) | Bukan kode mati; churn tanpa manfaat | Hapus semua |
| `assets-original/` dipertahankan | Sumber asli dari aset WebP lossy | Hapus |
