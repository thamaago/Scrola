# CLAUDE.md — Konteks Proyek Scrola

Berkas ini adalah konteks utama untuk Claude Code saat mengembangkan Scrola. Baca ini lebih dulu.

## Apa itu Scrola

Scrobbler Last.fm untuk Android — **open source (GPL-3.0), ringan, tanpa iklan, tanpa telemetri**.
Punya player musik internal + deteksi now-playing dari aplikasi lain (Spotify, YouTube Music) +
antrean scrobble offline + riwayat bergaya "tiket cerita" + editor metadata MP3.

**Positioning:** bukan music player serba bisa (bukan pesaing Poweramp). Pesaing sebenarnya adalah
Pano Scrobbler. Pembeda Scrola: desain indah + player internal + editor tag + privasi. Lihat
`docs/DESIGN.md`.

## Stack

React 18 + Vite + TypeScript + Tailwind + Capacitor 6 (WebView) + Kotlin (plugin native Android).
Deploy via GitHub Actions. Target: Android 6.0+ (minSdk 23, disyaratkan Keystore).

## Batasan lingkungan (PENTING)

Lingkungan pengembangan scaffold ini **tidak punya Android SDK / Gradle / kadang npm+network**.
Artinya kode TIDAK bisa dikompilasi/diuji di sini — semua validasi lewat pembacaan kode manual +
sanity check ringan. **Log CI GitHub Actions & uji perangkat fisik adalah satu-satunya sumber
kebenaran.** Jujur soal ini: jangan pernah mengklaim sesuatu "berfungsi/selesai" hanya karena lolos
review baca kode. Lihat `.claude/rules/kejujuran-dan-rilis.md`.

## Peta arsitektur

```
src/screens/    Layar (Login, NowPlaying, History, Settings, EditMetadata)
src/components/  StoryTicket (signature UI), ErrorBoundary
src/hooks/       usePlayer, useNowPlaying, useMp3Editor, useScrobbleHistory
src/lib/
  scrobbleLogic.ts   FUNGSI MURNI (eligibility, parsing, signature) — DITEST OTOMATIS
  lastfm.ts          Client API Last.fm
  scrobbleEngine.ts  Orkestrasi antrean + pengiriman
  secureStore.ts     Wrapper penyimpanan terenkripsi
  db/                SQLite: koneksi, skema/migrasi, query
native-overlay/  File Kotlin + resource, DIGABUNG ke android/ via scripts/apply-native-overlay.cjs
```

## Aturan tak-boleh-dilanggar

- Logic rawan bug WAJIB jadi fungsi murni di `scrobbleLogic.ts` (atau file pure lain) + ditest.
- Player internal & deteksi eksternal berbagi SATU pipeline scrobble (poin arsitektur
  `MediaSessionService`) — jangan buat jalur terpisah.
- File native baru masuk `native-overlay/`, bukan `android/` (yang di-generate ulang).
- Migrasi DB = entri baru, jangan ubah migrasi lama yang sudah rilis.

## Rules (selalu ditegakkan)

- `.claude/rules/security.md` — keamanan
- `.claude/rules/review-5-putaran.md` — ritual review untuk perubahan besar
- `.claude/rules/ringan-dan-fokus.md` — prinsip ringan & fokus produk
- `.claude/rules/kejujuran-dan-rilis.md` — kejujuran status, commit, CHANGELOG, migrasi

## Commands

- `/audit` — review 5 putaran
- `/sanity-check` — pemeriksaan cepat tanpa toolchain penuh
- `/feature` — alur menambah fitur baru (5 fase)
- `/release` — menyiapkan rilis versi baru

## Agents

Dipetakan ke tahapan kerja `CONTRIBUTING.md` dan proses sistem app:

- `feature-architect` — Fase 1-2 (scope & arsitektur): rancang sebelum kode, tolak scope creep
- `native-android-specialist` — Fase 3 (implementasi lapisan native): Kotlin, plugin, service, manifest
- `ui-craftsman` — Fase 3 (implementasi lapisan UI): React/Tailwind, penjaga sistem desain Hutan Malam
- `code-reviewer` — Fase 4 (review): kualitas & korektnes
- `security-reviewer` — Fase 4 (review): keamanan
- `test-engineer` — Fase 5 (validasi): unit test logic murni + simulasi Node
- `scribe` — penutup setiap pekerjaan: mencatat perubahan agen lain ke CHANGELOG & menjaga
  seluruh dokumentasi GitHub tetap sinkron dengan kode. Panggil TERAKHIR.

Alur lengkap satu fitur: feature-architect → (native-android-specialist / ui-craftsman) →
code-reviewer + security-reviewer → test-engineer → scribe.

## Dokumen kunci

- `CONTRIBUTING.md` — alur kerja lengkap & Definisi Selesai
- `CHANGELOG.md` — riwayat teknis (wajib diperbarui tiap perubahan besar)
- `docs/RELEASES.md` — catatan rilis ramah-pengguna + roadmap + kelebihan app
- `docs/GITHUB_SETUP.md` — checklist langkah manual di GitHub UI (secrets, branch protection)
- `docs/DESIGN.md` — arah desain sebagai pembeda kompetitif
- `README.md` — panduan setup & build

## Alur kerja singkat untuk perubahan besar

Scope → Arsitektur → Implementasi bertahap → `/audit` (review 5 putaran) → validasi jujur →
perbarui CHANGELOG. Detail: `CONTRIBUTING.md`.
