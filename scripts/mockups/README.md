# scripts/mockups/

Skrip pembuat **mockup gambar** (Python/Pillow) untuk eksplorasi desain — bukan bagian dari build
aplikasi. Dipisah dari `scripts/apply-native-overlay.cjs` (script build native yang dipakai CI).

| Skrip | Menghasilkan |
|---|---|
| `mockup_sisib_zine.py` | Pratinjau "zine" rekap mingguan layar Sisi B (`/mnt/user-data/outputs/sisib-zine-mockup.png`). |
| `mockup_ticket_share.py` | Pratinjau kartu tiket bagikan (Jejak / Penemuan / Momen). |

Keduanya standalone — jalankan dengan `python3 <nama_skrip>.py` (butuh Pillow + font DejaVu).
Path output di-hardcode di dalam masing-masing skrip.
