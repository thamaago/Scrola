# Panduan Pengembangan Scrola

Dokumen ini adalah **rujukan proses tetap** untuk mengembangkan Scrola. Tujuannya: setiap
perubahan besar mengikuti alur yang sama dan konsisten, dan riwayatnya tercatat rapi supaya mudah
ditelusuri kembali berbulan-bulan kemudian.

Baca ini setiap kali akan melakukan **perubahan atau perbaikan besar**. Untuk perubahan kecil
(perbaikan teks, penyesuaian styling minor), cukup ikuti bagian "Konvensi commit" dan "CHANGELOG".

---

## 1. Filosofi proyek

Tiga prinsip yang memandu setiap keputusan teknis di Scrola. Kalau sebuah perubahan bertentangan
dengan salah satunya, pikirkan ulang:

1. **Ringan.** Scrola berjalan di WebView (Capacitor) yang sudah punya overhead baseline. Jangan
   memperparah: batasi buffer, downscale gambar sebelum decode, batasi query, hindari dependensi
   yang tidak dipakai. Setiap dependensi baru harus dibenarkan.
2. **Aman & privat.** Data sensitif (session key) selalu terenkripsi via Keystore, tidak pernah di
   plaintext. Tanpa telemetri pihak ketiga. Minta permission sesempit mungkin (Storage Access
   Framework, bukan permission storage lebar).
3. **Jujur soal status.** Kode yang belum dikompilasi/diuji di device TIDAK diklaim "selesai".
   Lihat "Definisi Selesai" di bawah.

---

## 2. Arsitektur singkat (peta mental)

```
src/
  screens/       Layar utama (Login, NowPlaying, History, Settings, EditMetadata)
  components/    Komponen dipakai ulang (StoryTicket, ErrorBoundary)
  hooks/         Logic stateful React (usePlayer, useNowPlaying, useMp3Editor, useScrobbleHistory)
  lib/
    lastfm.ts        Client API Last.fm (auth, signing, scrobble)
    scrobbleLogic.ts FUNGSI MURNI (eligibility, parsing, signature) — DITEST OTOMATIS
    scrobbleEngine.ts Orkestrasi antrean + pengiriman
    secureStore.ts   Wrapper penyimpanan terenkripsi
    player.ts / mp3Metadata.ts  Wrapper JS untuk plugin native
    db/          SQLite: koneksi, skema/migrasi, query
native-overlay/  File native Android (Kotlin) + resource, DIGABUNG ke android/ lewat script
```

**Aturan arsitektur yang tidak boleh dilanggar tanpa alasan kuat:**

- **Logic murni yang rawan bug WAJIB ditaruh di `scrobbleLogic.ts`** (atau file pure lain) dan
  ditest — bukan dikubur di dalam hook/komponen yang sulit ditest. Kalau menambah aturan baru
  (mis. logika retry, format data), tanya dulu: "bisakah ini jadi fungsi murni yang ditest?"
- **Player internal & deteksi eksternal berbagi satu pipeline scrobble.** Jangan buat jalur
  scrobble terpisah untuk sumber internal — itu justru poin arsitektur `MediaSessionService`.
- **File native baru masuk ke `native-overlay/`**, bukan langsung ke `android/` (yang di-generate
  ulang). Script `apply-native-overlay.cjs` yang menggabungkannya.

---

## 3. Alur kerja untuk perubahan besar

Ikuti lima fase ini secara berurutan. Ini pola yang sudah dipakai konsisten selama pengembangan
Scrola dan terbukti menangkap banyak bug sebelum sampai ke device.

### Fase 1 — Scope
Tulis dulu (di deskripsi PR atau issue): apa yang berubah, kenapa, dan apa yang SENGAJA TIDAK
termasuk. Batasi cakupan. Kalau sebuah perubahan menyentuh >5 file di lapisan berbeda, pertimbangkan
memecahnya.

### Fase 2 — Arsitektur
Sebelum menulis kode: di lapisan mana perubahan ini hidup (UI / hook / lib / native)? Apakah butuh
fungsi murni baru yang bisa ditest? Apakah menambah dependensi (kalau ya, benarkan sesuai prinsip
"ringan")? Apakah butuh migrasi database (kalau ya, tambah entri baru di `MIGRATIONS`, JANGAN ubah
migrasi lama yang sudah pernah rilis)?

### Fase 3 — Implementasi bertahap
Bangun per bagian, dari lapisan terdalam ke terluar (native → wrapper JS → hook → UI). Setiap file
baru/berubah: sertakan komentar yang menjelaskan **kenapa**, bukan cuma apa — terutama untuk
keputusan yang tidak jelas dari kodenya (mis. "kenapa hapus antrean dulu baru simpan history").

### Fase 4 — Review 5 putaran (WAJIB untuk perubahan besar)
Ini ritual inti Scrola. Setelah implementasi, periksa ulang **lima kali**, tiap putaran fokus ke
lapisan/aspek berbeda. Cari bug, error, dan celah keamanan; perbaiki; baru lanjut putaran
berikutnya. Fokus tiap putaran (sesuaikan dengan perubahan):

1. **Korektnes logic** — apakah fungsi murni & aturan bisnis benar di semua edge case?
2. **Concurrency & state** — race condition, mutex, promise yang tidak di-await, guard sinkron
   untuk aksi yang tidak boleh dobel.
3. **Penanganan error** — apakah kegagalan (jaringan, plugin native, DB) ditangani tanpa
   mengunci/crash app? Apakah ada promise tanpa `.catch()`?
4. **Native Android** — NPE, lifecycle service/listener, `OutOfMemoryError` (ingat: itu `Error`,
   bukan `Exception`, tidak tertangkap `catch(Exception)`), kompatibilitas API level.
5. **Keamanan** — permission, data sensitif, atomicity penyimpanan, validasi input, apa yang
   terjadi kalau data korup/diutak-atik.

Setelah tiap putaran, jalankan sanity check (lihat bagian 5).

Kalau sebuah putaran menemukan bug, catat singkat apa yang ditemukan — ini jadi bahan entri
CHANGELOG dan bukti bahwa review-nya bekerja.

### Fase 5 — Validasi nyata (Definisi Selesai)
Review manual ada batasnya — ia tidak menggantikan compiler. Perubahan baru dianggap **benar-benar
selesai** hanya setelah:
- `npm test` hijau (untuk perubahan yang menyentuh logic murni),
- build CI di GitHub Actions hijau (compiler TypeScript + Gradle yang sesungguhnya jalan),
- dan idealnya, dijalankan di perangkat fisik untuk perubahan yang menyentuh UI/native.

Sampai tiga hal itu terpenuhi, di CHANGELOG dan PR tandai statusnya "belum tervalidasi di device".

---

## 4. Konvensi commit

Gunakan [Conventional Commits](https://www.conventionalcommits.org/id/):

```
<tipe>(<scope opsional>): <ringkasan singkat, huruf kecil, tanpa titik>

<body opsional: jelaskan KENAPA, bukan cuma apa>
```

Tipe yang dipakai: `feat` (fitur), `fix` (perbaikan bug), `security` (perbaikan keamanan),
`refactor`, `perf` (performa), `test`, `docs`, `chore` (tooling/config), `audit` (putaran review).

Contoh:
```
fix(scrobble): balik urutan hapus-antrean & simpan-history

Mencegah scrobble duplikat di profil Last.fm user kalau removeFromQueue
gagal setelah history tersimpan. Kegagalan parsial terburuk sekarang cuma
kehilangan history lokal, bukan mengotori data publik user.
```

---

## 5. Sanity check sebelum commit

Karena lingkungan pengembangan tidak selalu punya toolchain penuh, minimal jalankan pemeriksaan
ringan ini (semuanya cepat, tanpa perlu network/emulator):

```bash
# 1. Keseimbangan kurung semua file (menangkap potongan kode yang tidak sengaja rusak)
find src -name "*.ts" -o -name "*.tsx" | xargs -I{} node -e "const fs=require('fs');const c=fs.readFileSync('{}','utf8');let d=0,p=0;for(const ch of c){if(ch==='{')d++;if(ch==='}')d--;if(ch==='(')p++;if(ch===')')p--;}if(d||p)console.log('MISMATCH {}');"

# 2. Validasi JSON & YAML
python3 -c "import json; json.load(open('package.json'))"
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build.yml'))"

# 3. Test logic murni (kalau vitest sudah terinstall)
npm test

# 4. Pastikan referensi kelas di manifest cocok dengan file Kotlin yang ada
grep -o 'android:name="\.[A-Za-z]*"' native-overlay/android/app/src/main/AndroidManifest.xml | sort -u
```

Ini **bukan pengganti** build CI — hanya jaring pengaman awal. Build CI tetap sumber kebenaran.

---

## 6. CHANGELOG — wajib diperbarui

Setiap perubahan besar (fitur, perbaikan signifikan, putaran audit) **wajib** dicatat di
`CHANGELOG.md` di bawah bagian `[Unreleased]`, mengelompokkannya ke `Added` / `Changed` / `Fixed`
/ `Security` / `Removed` / `Internal`.

Saat merilis versi:
1. Ganti `[Unreleased]` jadi nomor versi + tanggal.
2. Tambahkan `[Unreleased]` kosong yang baru di atasnya.
3. Naikkan versi di `package.json` sesuai Semantic Versioning (lihat CHANGELOG bagian "Cara
   membaca versi").
4. Tulis catatan rilis ramah-pengguna di `docs/RELEASES.md` (pakai template di sana), lalu salin ke
   deskripsi rilis GitHub — ini versi manusiawi dari CHANGELOG untuk pengguna app.
5. Tag rilis di git: `git tag v0.2.0 && git push origin v0.2.0`.
6. Lampirkan APK hasil build CI sebagai aset unduhan di halaman rilis GitHub.

---

## 7. Checklist ringkas (salin ke deskripsi PR untuk perubahan besar)

```
- [ ] Scope ditulis jelas (termasuk apa yang sengaja TIDAK termasuk)
- [ ] Logic baru yang rawan bug dipisah jadi fungsi murni + ada test-nya
- [ ] Review 5 putaran selesai (korektnes / concurrency / error / native / keamanan)
- [ ] Sanity check lolos (kurung, JSON/YAML, npm test)
- [ ] Tidak ada dependensi baru tanpa alasan (prinsip "ringan")
- [ ] Migrasi DB (kalau ada) berupa entri baru, tidak mengubah migrasi lama
- [ ] CHANGELOG.md diperbarui di bagian [Unreleased]
- [ ] Status validasi jujur dicatat (build CI hijau? diuji di device?)
```
