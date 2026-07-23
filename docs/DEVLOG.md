# Devlog — Redesign UI "Hutan Malam"

> Log pengembangan desain Scrola. Cocok ditaruh di `docs/DEVLOG.md` — entri terbaru di atas.
> Entri CHANGELOG siap pakai ada di bagian bawah file ini.

---

## Juli 2026 — Redesign UI: palet Hutan Malam, mesin cetak tiket, animasi

### Latar belakang
UI v0.1 fungsional tapi punya beberapa masalah yang teridentifikasi lewat audit menyeluruh 4 layar:

- **Now Playing** — progres scrobble (fitur inti app!) hanya berupa satu baris teks kecil; disc vinyl dan kartu StoryTicket saling berebut fokus; kontrol seek −10s/+10s terlalu kecil untuk jempol (< 44px).
- **Riwayat** — daftar datar tanpa ritme; tiket ke-1 dan ke-100 terlihat identik, tidak ada rasa waktu berjalan.
- **Login** — layar pertama yang dilihat pengguna justru paling polos; tidak ada satu pun elemen signature (tiket/vinyl).
- **Pengaturan** — kartu abu generik yang bisa milik app mana pun; identitas akun tidak terasa spesial.

### Proses
1. **Rekonstruksi** — keempat layar direkonstruksi 1:1 di HTML sebagai baseline pembanding.
2. **Eksplorasi** — 3 variasi ide per layar (12 konsep) + 1 konsep layar baru, mengeksplorasi polish visual, UX baru, dan motion.
3. **Keputusan** — dipilih arah "tiket sebagai bahasa utama":
   - Login: **Tiket Masuk** — brand hero berbentuk tiket "ADMIT ONE" miring 1,5°
   - Now Playing: **Mesin Cetak Tiket** — progres scrobble divisualkan sebagai tiket yang tercetak keluar dari slot printer; saat lolos ambang 50%, tiket "sobek" dan meluncur ke Riwayat
   - Riwayat: **Jurnal Hari** — grup per hari dengan header mono + jumlah lagu; pil "Bab" per bulan
   - Pengaturan: **Backstage Pass** — kartu akun bertiket (username, total scrobble, tahun bergabung) + toggle baru "Scrobble dari app lain"
   - Layar baru: **Sisi B** — rekap mingguan naratif (Tiket Emas, jam emas, irama minggu) dari data SQLite lokal, tanpa server
4. **Eksplorasi palet** — 4 kandidat dites pada layar Now Playing final: Plum Amber (existing), Kopi Tubruk (espresso+karamel), Hutan Malam (hijau lumut+kuningan), Tinta Tengah Malam (biru tinta+aprikot).
5. **Terpilih: Hutan Malam** — premium ala lounge jazz/perpustakaan tua, paling berbeda dari app musik lain yang serba ungu/hitam, tetap "premium & hangat".
6. **Prototipe interaktif** — semua layar + navigasi + animasi diuji dalam satu prototipe HTML (lihat `Scrola Prototype.dc.html`).

### Keputusan desain tercatat
| Keputusan | Alasan |
|---|---|
| Nama token Tailwind dipertahankan (`ink`, `amber`, dst) walau nilainya berubah | Zero perubahan className di seluruh codebase; cukup edit `tailwind.config.js` |
| Progres scrobble = tinggi tiket yang tercetak, bukan progress bar | Metafora fisik menjelaskan mekanik scrobble tanpa teks; sejalan prinsip DESIGN.md "statistik sebagai cerita" |
| Kontrol seek dibesarkan ke 56px, play 72px | Standar hit target sentuh ≥ 44px |
| Tanggal dipindah dari tiket ke header grup hari | Tiket lebih bersih; data grouping sudah tersedia dari SQLite |
| Rekap Sisi B dihitung lokal | Konsisten dengan prinsip tanpa-telemetri; semua data sudah ada di DB |
| Transisi tab slide 40px + fade 0.4s, bukan crossfade penuh | Memberi arah spasial antar tab tanpa terasa lambat |
| `prefers-reduced-motion` menonaktifkan semua animasi | Aksesibilitas; sudah ada globalnya di `index.css`, dipertahankan |

### Palet Hutan Malam (final)
| Token | Lama | Baru |
|---|---|---|
| ink (latar) | `#1C1420` | `#121A15` |
| surface | `#251A2C` | `#1A251E` |
| surfaceRaised | `#2E2035` | `#223026` |
| amber (aksen) | `#E8B04B` | `#D6A756` |
| coral (suka) | `#FF6B7A` | `#FF7A6B` |
| paper (teks) | `#F4EDE4` | `#EFEDE0` |
| muted | `#9C8CA3` | `#8FA394` |

### Yang belum masuk scope (backlog)
- [ ] Share "Bagikan sebagai tiket" di Sisi B (render tiket → gambar → share sheet)
- [ ] Regenerasi ikon launcher & splash dengan palet baru (`branding/generate_icons.py` masih memakai warna lama)
- [ ] Shared-element transition tiket Now Playing → Riwayat
- [ ] Ide yang ditunda: Riwayat "Gulungan Struk" (satu roll per hari), Now Playing "Panggung Vinyl" (ring progres conic), Login "Sampul Buku" (onboarding 3 langkah)

### Artefak
- `Scrola Prototype.dc.html` — prototipe interaktif final
- `Scrola UI Review.dc.html` — kanvas audit + 12 konsep + eksplorasi palet
- `README.md` (folder ini) — spec implementasi per file
- `screenshots/` — 5 layar final

---

## Entri CHANGELOG siap pakai

Salin ke `CHANGELOG.md` di bawah `## [Unreleased]` (atau versi berikutnya):

```markdown
### Changed
- **Redesign UI "Hutan Malam"** — palet baru hijau lumut + emas kuningan menggantikan
  plum/amber (nilai token di `tailwind.config.js`; nama token tidak berubah).
- Now Playing: progres scrobble kini divisualkan sebagai tiket yang "tercetak" keluar
  dari slot printer; tiket "sobek" + toast saat resmi tercatat. Kontrol seek 56px,
  play 72px.
- Riwayat: dikelompokkan per hari (header + jumlah lagu); entri baru beranimasi masuk.
- Pengaturan: kartu akun "Backstage Pass" (total scrobble, tahun bergabung).
- Login: brand hero berbentuk tiket "ADMIT ONE" dengan animasi sobek saat berhasil masuk.
- Navigasi tab kini beranimasi (slide + fade, indikator amber di nav bar).

### Added
- Layar "Sisi B": rekap mingguan naratif (lagu teratas, jam emas, artis baru,
  irama minggu) — dihitung sepenuhnya dari SQLite lokal.
- Pengaturan: toggle "Scrobble dari app lain" untuk membatasi sumber scrobble
  ke player internal tanpa mencabut izin notifikasi.
```
