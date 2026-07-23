# Arah Desain Scrola

Dokumen ini menetapkan **desain sebagai pembeda kompetitif utama** Scrola, dan jadi rujukan tetap
setiap kali membangun atau mengubah UI. Baca bersama `CONTRIBUTING.md` (proses) dan `README.md`
(arsitektur).

## Kenapa desain adalah senjata utama

Dari analisis kompetitif: pasar scrobbler Android dikuasai **Pano Scrobbler** — matang, kaya
fitur, open source, tapi **utilitarian secara visual**. Simple Last.fm Scrobbler bahkan lebih
polos lagi. Tidak ada satu pun scrobbler populer yang terasa *indah* atau *premium*.

Scrola tidak akan memenangkan perlombaan jumlah fitur melawan Pano (8+ tahun, lintas platform).
Tapi ada celah kosong yang nyata: **scrobbler yang terasa seperti produk premium yang dirancang
dengan cinta.** Itulah medan tempur yang bisa dimenangi indie solo. Setiap keputusan desain harus
memperkuat kesan itu.

## Identitas inti: "Setiap lagu meninggalkan cerita"

Metafora sentral: riwayat dengar bukan sekadar daftar (seperti pesaing), tapi **kumpulan tiket
cerita** — tiap lagu jadi artefak yang layak disimpan. Ini bukan gimmick; ini alasan emosional
seseorang memilih Scrola alih-alih daftar teks polos Pano.

### Elemen signature (jangan diencerkan)
- **Story ticket** — kartu dengan tepi perforasi (lubang + garis putus), isi bergaya struk/tiket.
  Ini DNA visual Scrola. Muncul di riwayat & now-playing. Jangan diganti kartu generik.
- **Disc vinyl berputar** di Now Playing — album art sebagai piringan hitam yang berputar saat
  playing, berhenti saat pause. Sentuhan taktil yang mengikat pemutaran ke nostalgia fisik.
- **Palet plum-ink + amber + coral** — gelap, hangat, tidak "techy dingin" seperti kebanyakan app.

### Token desain (sumber kebenaran di `tailwind.config.js`)
| Token | Nilai | Peran |
|---|---|---|
| ink | `#1C1420` | Latar utama (plum-ink gelap hangat) |
| surface | `#251A2C` | Permukaan kartu |
| surfaceRaised | `#2E2035` | Permukaan terangkat (disc, tiket aktif) |
| amber | `#E8B04B` | Aksen utama (label vinyl, CTA) |
| coral | `#FF6B7A` | Aksen loved / destruktif |
| paper | `#F4EDE4` | Teks utama |
| muted | `#9C8CA3` | Teks sekunder |

Font: **Fraunces** (display, berkarakter), **Manrope** (body, bersih), **IBM Plex Mono** (data —
memperkuat kesan "struk/tiket").

## Prinsip desain

1. **Hormati keheningan.** Jangan penuhi layar. Ruang kosong membuat elemen signature bernapas
   dan terasa premium. Bandingkan dengan Pano yang padat data.
2. **Gerakan yang bermakna, bukan dekoratif.** Disc berputar = status playing. Tiket "dicetak"
   (fade-in) = scrobble baru tercatat. Setiap animasi mengomunikasikan sesuatu. Hormati
   `prefers-reduced-motion` (sudah ada di `index.css`).
3. **Data terasa personal, bukan statistik dingin.** Saat nanti menambah statistik (lihat
   roadmap), sajikan sebagai "cerita perjalanan dengarmu", bukan tabel angka ala dashboard.
4. **Konsisten lintas layar.** Tiket, disc, palet, dan tipografi yang sama di mana pun. Konsistensi
   inilah yang membuat app terasa "dirancang", bukan dirakit.
5. **Ringan tetap nomor satu.** Desain indah TIDAK boleh mengorbankan prinsip ringan (lihat
   README). Animasi CSS murni, bukan library berat; gambar di-downscale; tanpa aset raksasa.

## Yang HARUS dihindari

- Menambahkan UI ala music player serba bisa (equalizer, playlist rumit) — itu mengencerkan fokus
  dan menyeret Scrola ke pertarungan melawan Poweramp yang tak bisa dimenangkan.
- Kepadatan informasi ala dashboard analitik. Itu wilayah Pano; Scrola bermain di sisi emosional.
- Tema/skin yang bisa dikustomisasi berlebihan di tahap awal — justru mengencerkan identitas yang
  sedang dibangun. Satu identitas kuat > banyak tema lemah.

## Cara mengevaluasi keputusan desain

Sebelum menambah/mengubah elemen UI, tanyakan:
1. Apakah ini memperkuat kesan "scrobbler yang indah & premium", atau sekadar meniru pesaing?
2. Apakah ini konsisten dengan identitas tiket/vinyl/palet?
3. Apakah ini menjaga (atau melanggar) prinsip ringan?
4. Apakah gerakannya bermakna, atau dekorasi kosong?

Kalau sebuah ide tidak lolos pertanyaan-pertanyaan ini, kemungkinan besar ia bukan untuk Scrola.

---

**Catatan validasi (jujur):** Arah desain di dokumen ini dirancang, tapi belum diuji dengan
pengguna nyata di perangkat fisik. Screenshot yang ada sejauh ini adalah mockup HTML yang meniru
komponen, bukan render dari app yang benar-benar berjalan. Keputusan desain final harus divalidasi
setelah build berjalan di device — lihat "Definisi Selesai" di `CONTRIBUTING.md`.
