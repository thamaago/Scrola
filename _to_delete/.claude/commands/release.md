# /release

Siapkan rilis versi baru Scrola. Gunakan saat `[Unreleased]` di CHANGELOG sudah final untuk sebuah
versi.

## Langkah

1. Tentukan nomor versi baru sesuai SemVer (lihat `CHANGELOG.md` bagian "Cara membaca versi"):
   - MAJOR: memutus kompatibilitas (mis. format DB berubah tanpa migrasi)
   - MINOR: fitur baru kompatibel ke belakang
   - PATCH: perbaikan bug saja
2. `CHANGELOG.md`: ganti `[Unreleased]` jadi `[X.Y.Z] — <tanggal>`, tambah `[Unreleased]` kosong
   baru di atasnya.
3. `package.json`: naikkan `version`.
4. `docs/RELEASES.md`: tulis catatan rilis ramah-pengguna pakai template di sana (fitur, perbaikan,
   keamanan, keterbatasan, cara pasang). Ini versi manusiawi dari CHANGELOG.
5. Ingatkan langkah manual yang harus dilakukan user di komputer (tidak bisa dari scaffold ini):
   - `git tag vX.Y.Z && git push origin vX.Y.Z`
   - Build APK via CI, lampirkan sebagai aset rilis GitHub.
6. **Cek kejujuran status:** kalau versi ini belum pernah di-build CI/diuji device, tandai sebagai
   pra-rilis/release candidate — jangan sebut "stabil".

## Audit rahasia pra-rilis

Sebelum rilis publik, jalankan cek: tidak ada secret ter-commit, `.env.local` ter-gitignore,
`.env.example` ada tanpa nilai asli.
