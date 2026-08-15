# ✅ Checklist Validasi Device — Scrola

**Perangkat uji:** Samsung SM-X706B (Android 16). **Prasyarat:** build CI hijau, APK terpasang,
izin notifikasi (baca) aktif, akun Last.fm `zeewl`/akunmu tersambung.

Legenda prioritas: 🔴 kritis (data/koreksi inti) · 🟡 penting · ⚪ pelengkap.
Bukti: centang bila lolos; simpan **screenshot layar** atau **Log Peristiwa** (Pengaturan → Log) yang diminta.

> **Progres (screenshot 02.46):** UI ketiga tab render mulus & estetika konsisten; **H4/H5/H6** lolos
> (deteksi, log, antrean jujur); **A3** sebagian (jam berurutan wajar); UI **Cadangan Data** & kartu
> akun tampil benar; teks **CJK** render benar di Riwayat (`F4 香港紅磡演唱會全紀錄`). Yang belum:
> semua uji **perilaku dinamis** (siklus backup, backoff, share zine, tulis-tag encoding, pemutar internal).

---

## 🔴 A. Scrobble inti

- [ ] **A1 · Real-time (Spotify)** — putar 1 lagu penuh di Spotify. → Muncul di Riwayat & profil Last.fm.
- [x] **A2 · Latar → batch utuh** — ✅ *(log 17:01)* **23 track latar (terkumpul ~2 hari, lintas
  YouTube Music + Spotify) ter-drain jadi SATU `KIRIM: 23`, 23/23 diterima, 23 baris.** Bersih, tak
  terpecah. Reliabilitas pending-store lintas-hari juga terbukti. *(Catatan: split kadang muncul dari
  flush real-time menyela drain — kosmetik, tak merugikan data.)*
- [~] **A3 · Timestamp asli** — SEBAGIAN ✅ *(screenshot Riwayat 02.46)*: jam tampil berurutan &
  wajar (19.17→19.18→19.22…, lagu pendek berjarak 1 mnt), TIDAK menumpuk di satu jam drain. Cek
  silang ke profil Last.fm masih disarankan untuk konfirmasi penuh.
- [ ] **A4 · Backoff** — putuskan internet saat ada scrobble tertahan. → Log: jeda retry **membesar** (`flush error → backoff ~40s`, lalu `~80s`…), **bukan** spam tiap 20 dtk. Sambungkan lagi → satu flush sukses, cadence normal. *(uji backoff)*
- [ ] **A5 · Ulang lagu** — putar lagu, lalu ulang dari awal. → Tercatat **dua kali**. *(deteksi repeat)*
- [ ] **A6 · Lintas-pemutar** — scrobble dari **YouTube Music**. → Terdeteksi & tercatat, tak terasa lambat.

## 🟡 B. Pemutar internal

- [ ] **B1 · Putar file lokal** — putar MP3 lokal sampai ambang. → Tercatat (tanpa dobel).
- [ ] **B2 · Seek-bar adaptif** — saat playing bar bergerak halus; **pause → resume** → bar lanjut dalam ≤2 dtk (tak beku). *(uji position-poll adaptif)*
- [ ] **B3 · Idle** — buka app tanpa memakai pemutar internal, diamkan. → Tak ada emit `playerPositionChanged` beruntun di Log.
- [ ] **B4 · Timeline geser** — geser ke bagian favorit, putar ulang bagian itu.

## 🔴 C. Backup & restore (data tak tergantikan)

- [ ] **C1 · Buat cadangan** — buat beberapa catatan + favorit → Pengaturan → **Buat cadangan** → simpan file `.json`.
- [ ] **C2 · Restore setelah wipe** — Clear data / uninstall→install → **Pulihkan dari file**. → Catatan & favorit **kembali**; ringkasan benar ("X catatan dipulihkan…").
- [ ] **C3 · Idempoten** — impor file yang sama **dua kali**. → Tidak ada duplikat; ringkasan kedua menunjukkan 0 catatan baru / konflik dipertahankan.
- [ ] **C4 · File rusak** — impor JSON asal-asalan. → Ditolak dengan **pesan jelas**, **tidak crash**.

## 🟡 D. Ekspor zine Sisi B

- [ ] **D1 · Bagikan** — Sisi B → **Bagikan sebagai zine** → share sheet muncul dengan PNG mirip mockup; font (Fraunces/Manrope/IBM Plex Mono) benar.
- [ ] **D2 · Kasus ekstrem** — minggu dgn judul lagu **sangat panjang** & minggu **tanpa scrobble**. → Tak ada teks ketimpa/terpotong; serial `SB-…` tampil.
- [ ] **D3 · Serial stabil** — bagikan zine minggu yang sama dua kali. → Serial **identik**.

## 🔴 E. Editor tag MP3 (korektnes teks)

- [ ] **E1 · Edit dasar** — ubah judul/artist/album/album-artist/tahun/genre + ganti art → simpan. → Perubahan **persisten** (buka ulang file).
- [ ] **E2 · Encoding Unicode** — tulis nama Indonesia berkarakter khusus, judul ber-**emoji**, dan teks **CJK** → baca balik di Scrola **dan** pemutar lain. → **Tidak mojibake**. *(risiko tertinggi editor tag)*
- [ ] **E3 · Art tampil** — art tersimpan tampil benar di pemutar lain (tipe front-cover/MIME).

## 🟡 F. Interaksi riwayat (v0.2.0)

- [ ] **F1 · Toggle loved** — tekan hati di tiket riwayat → status berubah (optimistic), tetap setelah refresh; tap ganda tak merusak.
- [ ] **F2 · Edit/hapus scrobble** — edit lalu hapus satu entri. → UI jujur: hanya menyentuh riwayat **lokal** (Last.fm tak berubah).

## ⚪ G. Statistik & koleksi

- [ ] **G1 · Bab/Album** — buka statistik bulanan "Bab" & tahunan "Album" → angka & tampilan wajar.
- [ ] **G2 · Tiket Koleksi** — layar tiket bernomor seri tampil benar.
- [ ] **G3 · Penemuan** — *(catatan: layar kurasi "Penemuan" v0.3.0 BELUM dibuat — jangan diuji)*.

## 🟡 H. Sistem, memori & diagnosis

- [ ] **H1 · Foreground service** — notifikasi persist muncul, tipe `dataSync`, tak crash.
- [ ] **H2 · Cabut izin saat aktif** — cabut izin notifikasi saat ada timer eligibility jalan. → Tak crash, tak ada kerja pasca-teardown. *(uji fix leak eligibilityRunnable)*
- [ ] **H3 · Sesi panjang** — biarkan app hidup lama sambil memutar. → Tak ada pembengkakan memori/lag mencolok. *(audit RAM)*
- [x] **H4 · Sumber terdeteksi** — ✅ *(screenshot 02.46)* menampilkan Spotify + YouTube Music. Paket
  non-musik (`honeyboard` keyboard) kini **disaring** dari daftar (fix `isLikelyMusicSource`).
- [x] **H5 · Log Peristiwa** — ✅ *(screenshot 02.46)* terbaca, rapi, tak dipenuhi flush kosong.
- [x] **H6 · Antrean Scrobble** — ✅ *(screenshot 02.46)* "Antrean kosong" — status jujur, tak tersangkut.

---

### Prioritas kalau waktumu terbatas
Uji dulu yang menyentuh **data & inti**: **A2, A3, A4** (scrobble latar/timestamp/backoff), **C1–C4**
(backup/restore), **E2** (encoding). Lima ini paling berisiko & paling menentukan kepercayaan.

### Cara pakai hasilnya
Untuk tiap item: kalau **lolos**, itu boleh dinaikkan statusnya dari "belum tervalidasi" di CHANGELOG
dan siap dipotong jadi rilis (v0.2.0/0.3.0). Kalau **gagal**, kirim screenshot/Log-nya — itu jadi
titik awal debug ("device is the final truth").
