# Rule: Kejujuran Status & Alur Rilis

## Definisi Selesai (jujur)

Review manual bukan pengganti compiler. Perubahan dianggap **benar-benar selesai** hanya setelah:
- `npm test` hijau (untuk perubahan yang menyentuh logic murni),
- build CI GitHub Actions hijau (TypeScript + Gradle sungguhan jalan),
- idealnya, diuji di perangkat fisik untuk perubahan UI/native.

Sampai itu terpenuhi, tandai jujur "belum tervalidasi di device" di CHANGELOG & PR. Jangan pernah
mengklaim sesuatu "selesai/berfungsi" kalau baru lolos review baca kode. Lingkungan pengembangan
scaffold ini tidak punya Android SDK/Gradle — log CI adalah sumber kebenaran.

## Commit & CHANGELOG

- Conventional Commits: `feat`, `fix`, `security`, `refactor`, `perf`, `test`, `docs`, `chore`,
  `audit`. Jelaskan **kenapa** di body, bukan cuma apa.
- Setiap perubahan besar wajib dicatat di `CHANGELOG.md` bagian `[Unreleased]`.
- Saat rilis: perbarui CHANGELOG, tulis catatan rilis ramah-pengguna di `docs/RELEASES.md`, naikkan
  versi di `package.json` (SemVer), tag git, lampirkan APK CI. Lihat `CONTRIBUTING.md`.

## Migrasi database

Migrasi DB berupa **entri baru** di daftar migrasi — jangan pernah mengubah migrasi lama yang sudah
pernah rilis (akan merusak DB pengguna yang sudah ada).
