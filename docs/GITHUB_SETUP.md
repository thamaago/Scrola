# Setup GitHub — Checklist Manual

Berkas ini mendaftar **semua langkah yang HANYA bisa dilakukan lewat akun/UI GitHub asli** —
tidak ada satu pun yang bisa saya (Claude) lakukan dari sini karena environment ini tanpa akses
GitHub API/network. Ikuti urut dari atas ke bawah saat pertama kali mempublikasikan Scrola.

## 1. Buat repositori

```bash
cd scrola
git init
git add .
git commit -m "chore: initial commit — Scrola v0.1.0 scaffold"
git branch -M main
git remote add origin https://github.com/<username>/scrola.git
git push -u origin main
```

Setelah push pertama, **ganti `<username>`** di dua tempat:
- Badge Build Status di `README.md` (baris ke-4)
- `CODEOWNERS` (ganti `@yudha` dengan username GitHub aslimu)

## 2. Isi metadata repositori (Settings → General)

| Kolom | Nilai yang disarankan |
|---|---|
| Description | `Scrobbler Last.fm untuk Android — ringan, indah, open source. Setiap lagu meninggalkan cerita.` |
| Website | (opsional) link Play Store setelah rilis, atau kosongkan |
| Topics | `android`, `lastfm`, `scrobbler`, `kotlin`, `capacitor`, `react`, `typescript`, `music`, `open-source` |

**Social preview image**: Settings → General → Social preview → upload
`branding/preview/play_store_icon_512.png` (regenerate dulu via `python3 branding/generate_icons.py`
kalau folder preview belum ada — lihat catatan `.gitignore`).

## 3. GitHub Secrets (wajib agar CI bisa build)

Settings → Secrets and variables → Actions → **New repository secret**:

| Nama | Nilai |
|---|---|
| `LASTFM_API_KEY` | Dari https://www.last.fm/api/account/create |
| `LASTFM_API_SECRET` | Dari halaman yang sama |

Tanpa ini, step "Build web assets" di `build.yml`/`release.yml` akan gagal.

## 4. Aktifkan fitur repositori (Settings → General → Features)

- ✅ **Issues** — sudah ada template di `.github/ISSUE_TEMPLATE/`
- ✅ **Discussions** (opsional, tapi disarankan) — tempat tanya-jawab pengguna di luar bug/fitur
- ⬜ **Wiki** — tidak perlu, dokumentasi sudah lengkap di `docs/` + README
- ✅ **Private vulnerability reporting** (Settings → Security) — wajib aktif, dirujuk dari
  `SECURITY.md`

## 5. Branch protection untuk `main` (Settings → Branches → Add rule)

Disarankan untuk `main`, terutama begitu ada kontributor lain:
- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging → pilih job `build` dari `build.yml`
- ✅ Require branches to be up to date before merging
- ⬜ Require approvals — opsional untuk solo dev, aktifkan begitu ada kontributor lain

## 6. Label issue (opsional, rapikan default GitHub)

Default GitHub sudah cukup (`bug`, `enhancement`, `documentation`). Tambahan yang relevan untuk
Scrola: `security`, `native-android`, `needs-device-testing` (label khusus untuk menandai temuan
yang baru bisa dikonfirmasi di perangkat fisik — relevan karena status validasi selalu dicatat
jujur di proyek ini).

## 7. Sebelum rilis pertama (`v0.1.0`)

- [ ] Ganti isi `LICENSE` dengan teks GPL-3.0 penuh:
  `curl -sL https://www.gnu.org/licenses/gpl-3.0.txt -o LICENSE`
- [ ] Isi nama/kontak asli di `SECURITY.md` dan `CODE_OF_CONDUCT.md` (saat ini masih generik)
- [ ] Pastikan `npm install` sudah pernah dijalankan lokal & `package-lock.json` ter-commit
  (lihat catatan di README bagian Build Android)
- [ ] Jalankan `git tag v0.1.0 && git push origin v0.1.0` — ini memicu `.github/workflows/release.yml`
  otomatis membuat **draft** release + APK terlampir
- [ ] Buka draft release di GitHub, salin bagian `v0.1.0` dari `docs/RELEASES.md` ke deskripsi,
  baru **Publish** manual (workflow sengaja membuat draft, bukan auto-publish — lihat komentar di
  `release.yml`)

## 8. Signing key untuk build release (di luar cakupan v0.1.0)

Workflow saat ini hanya membuat APK **debug** (belum ditandatangani untuk Play Store). Saat siap
submit ke Play Store nanti:
1. Buat keystore: `keytool -genkey -v -keystore scrola-release.keystore -alias scrola -keyalg RSA -keysize 2048 -validity 10000`
2. Simpan keystore **di luar repo** (jangan pernah commit — sudah di-`.gitignore`)
3. Tambah GitHub Secrets: `KEYSTORE_BASE64` (hasil `base64 scrola-release.keystore`), `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`
4. Update `android/app/build.gradle` dengan konfigurasi `signingConfigs` + ubah workflow ke
  `assembleRelease`

Ini langkah terpisah yang sengaja belum dikerjakan sekarang — v0.1.0 masih tahap pra-rilis/testing,
signing key baru relevan saat benar-benar submit ke Play Store.
