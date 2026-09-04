import {
  SHARE_WIDTH,
  SHARE_HEIGHT,
  truncateForCard,
  titleFontSize,
  formatDurationForCard,
  ticketNumber,
} from './shareCardLayout';
import { tActive } from './i18n';

/**
 * shareImage.ts — merender tiket cerita jadi gambar PNG untuk dibagikan ke WhatsApp Status /
 * Instagram Story.
 *
 * Digambar dengan Canvas API BAWAAN browser — sengaja TANPA library seperti html2canvas
 * (≈200KB, dan hasilnya sering meleset untuk efek kustom seperti perforasi kita). Menggambar
 * manual justru memberi kontrol penuh atas hasil akhir, dan nol dependensi baru — sesuai
 * .claude/rules/ringan-dan-fokus.md.
 *
 * Album art datang sebagai data URI base64 dari PlayerPlugin, jadi menggambarnya ke canvas TIDAK
 * membuat canvas ter-taint (beda dengan gambar dari URL lintas-domain) — toDataURL() tetap boleh
 * dipanggil.
 */

const INK = '#121A15';
const SURFACE = '#1A251E';
const SURFACE_RAISED = '#223026';
const AMBER = '#D6A756';
const PAPER = '#EFEDE0';
const MUTED = '#8FA394';

export interface ShareCardInput {
  title: string;
  artist: string;
  album?: string;
  albumArt?: string | null;
  durationSec?: number;
  timestampSec: number;
}

/** Muat data URI jadi HTMLImageElement. Gagal (data korup) -> null, bukan melempar. */
function loadImage(dataUri: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // album art rusak bukan alasan membatalkan share
    img.src = dataUri;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Render kartu tiket -> PNG base64 (tanpa prefiks data URI).
 * Melempar Error kalau canvas tidak tersedia — pemanggil wajib menangani.
 */
export async function renderShareCard(input: ShareCardInput): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia di perangkat ini');

  // Kualitas penskalaan gambar. Default browser untuk imageSmoothingQuality adalah 'low' —
  // artinya album art yang diperbesar/diperkecil ke ukuran disc akan tampak kasar & bergerigi
  // padahal sumbernya tajam. Menyetel 'high' memakai algoritma interpolasi yang jauh lebih baik;
  // biayanya hanya beberapa milidetik untuk satu gambar, dan ini SATU-SATUNYA pengaturan yang
  // paling terasa dampaknya pada ketajaman hasil akhir.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Tunggu font kustom benar-benar siap. Tanpa ini, canvas bisa menggambar dengan font fallback
  // (Times/Arial) walau CSS-nya sudah memuat Fraunces — karena canvas TIDAK menunggu font seperti
  // DOM. Gejalanya: gambar hasil share terlihat "salah font" padahal di layar benar.
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Kalau API font gagal, lanjut saja — font fallback lebih baik daripada gagal total.
    }
  }

  // Album art dimuat DI AWAL karena kini dipakai dua kali: sebagai latar buram seluruh kanvas,
  // dan sebagai disc di tengah tiket.
  const art = input.albumArt ? await loadImage(input.albumArt) : null;

  // ===== Latar =====
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);

  // Latar buram dari album art — membuat setiap tiket terasa "milik lagu itu", bukan template
  // seragam. Warna dominan sampul meresap ke seluruh gambar.
  //
  // TEKNIK: sengaja TIDAK memakai ctx.filter = 'blur(...)'. Dukungan filter di WebView Android
  // tidak merata antar versi/vendor, dan kalau tidak didukung ia gagal DIAM-DIAM — hasilnya
  // album art tergambar penuh tanpa blur, teks jadi tak terbaca, dan kita tidak akan tahu sampai
  // ada yang mengeluh. Sebagai gantinya: gambar art ke kanvas mungil (36×64) lalu perbesar ke
  // ukuran penuh dengan interpolasi kualitas tinggi. Pembesaran ekstrem itu SENDIRI menghasilkan
  // gradasi lembut yang menyerupai blur — bekerja di mana pun canvas bekerja, dan jauh lebih
  // murah secara komputasi daripada blur sungguhan.
  if (art) {
    const tiny = document.createElement('canvas');
    tiny.width = 36;
    tiny.height = 64; // rasio 9:16 mengikuti kanvas utama
    const tctx = tiny.getContext('2d');
    if (tctx) {
      // Gambar art memenuhi kanvas mungil dengan pola cover (jaga aspek rasio).
      const s = Math.max(tiny.width / art.width, tiny.height / art.height);
      tctx.drawImage(
        art,
        (tiny.width - art.width * s) / 2,
        (tiny.height - art.height * s) / 2,
        art.width * s,
        art.height * s
      );
      ctx.drawImage(tiny, 0, 0, SHARE_WIDTH, SHARE_HEIGHT);
    }

    // Tirai gelap di atas latar buram. WAJIB: tanpa ini, sampul yang terang membuat teks putih
    // dan tiket hijau gelap tidak terbaca sama sekali. Dibuat gradien — sedikit lebih tembus di
    // tengah (tempat disc berada, supaya warna sampul terasa) dan pekat di tepi atas/bawah tempat
    // teks berada.
    const scrim = ctx.createLinearGradient(0, 0, 0, SHARE_HEIGHT);
    scrim.addColorStop(0, 'rgba(18,26,21,0.94)');
    scrim.addColorStop(0.42, 'rgba(18,26,21,0.80)');
    scrim.addColorStop(1, 'rgba(18,26,21,0.95)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  }

  // Sorot hangat dari atas (meniru gradien radial di app)
  const glow = ctx.createRadialGradient(SHARE_WIDTH / 2, 120, 0, SHARE_WIDTH / 2, 120, 900);
  glow.addColorStop(0, 'rgba(214,167,86,0.16)');
  glow.addColorStop(1, 'rgba(214,167,86,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);

  // Butiran halus — sama seperti latar app, memberi tekstur kertas
  ctx.fillStyle = 'rgba(239,237,224,0.035)';
  for (let y = 0; y < SHARE_HEIGHT; y += 18) {
    for (let x = 0; x < SHARE_WIDTH; x += 18) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // ===== Kartu tiket =====
  const cardX = 90;
  const cardW = SHARE_WIDTH - cardX * 2;
  const cardY = 380;
  const cardH = 1080;
  const perfW = 34;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = SURFACE;
  roundRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(214,167,86,0.3)';
  ctx.lineWidth = 2;
  roundRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.stroke();

  // Perforasi kiri — signature Scrola
  ctx.fillStyle = INK;
  const holeGap = 40;
  for (let y = cardY + holeGap / 2; y < cardY + cardH - 8; y += holeGap) {
    ctx.beginPath();
    ctx.arc(cardX + perfW / 2, y, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  const contentX = cardX + perfW + 46;
  const contentW = cardW - perfW - 46 - 56;

  // Label atas
  ctx.fillStyle = AMBER;
  ctx.font = '600 26px "IBM Plex Mono", monospace';
  ctx.letterSpacing = '6px';
  ctx.textAlign = 'left';
  ctx.fillText('SCROLA', contentX, cardY + 78);

  ctx.fillStyle = MUTED;
  ctx.textAlign = 'right';
  ctx.fillText(tActive('share.card.ticketNo', { n: ticketNumber(input.timestampSec) }), cardX + cardW - 56, cardY + 78);
  ctx.letterSpacing = '0px';

  // ===== Album art (disc) =====
  // Diameter 520px (48% lebar kanvas) — diperbesar dari 420px agar artwork jadi bintang utama
  // gambar yang dibagikan. Posisi vertikal (cardY + 380) dihitung agar tepi atas disc menyisakan
  // 42px dari label "SCROLA" dan tepi bawah menyisakan 136px ke garis putus setelah judul+artis.
  // Jangan mengubah discR tanpa menghitung ulang keduanya — tata letak ini rapat.
  const discR = 260;
  const discCX = cardX + cardW / 2;
  const discCY = cardY + 380;

  ctx.save();
  ctx.beginPath();
  ctx.arc(discCX, discCY, discR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // `art` sudah dimuat di awal fungsi (dipakai juga untuk latar buram) — jangan muat ulang.
  if (art) {
    // Gambar dengan pola "cover": pertahankan aspek rasio asli, ambil bagian tengahnya.
    //
    // Sebelumnya album art diregangkan paksa ke kotak (drawImage dengan lebar=tinggi=diameter).
    // Untuk artwork persegi — mayoritas kasus — itu kebetulan benar. Tapi artwork yang TIDAK
    // persegi (mis. sampul single 1000×800, atau scan piringan) jadi penyok/gepeng di gambar
    // hasil share, dan itu langsung terlihat di mata orang yang menerimanya.
    const scale = Math.max((discR * 2) / art.width, (discR * 2) / art.height);
    const drawW = art.width * scale;
    const drawH = art.height * scale;
    ctx.drawImage(art, discCX - drawW / 2, discCY - drawH / 2, drawW, drawH);
  } else {
    const g = ctx.createLinearGradient(discCX - discR, discCY - discR, discCX + discR, discCY + discR);
    g.addColorStop(0, SURFACE_RAISED);
    g.addColorStop(1, INK);
    ctx.fillStyle = g;
    ctx.fillRect(discCX - discR, discCY - discR, discR * 2, discR * 2);
    ctx.fillStyle = MUTED;
    ctx.font = '400 90px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('♪', discCX, discCY + 32);
  }
  ctx.restore();

  // Alur vinyl + label tengah
  ctx.strokeStyle = 'rgba(239,237,224,0.07)';
  ctx.lineWidth = 2;
  [discR - 30, discR - 72, discR - 114].forEach((r) => {
    ctx.beginPath();
    ctx.arc(discCX, discCY, r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.arc(discCX, discCY, 57, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(discCX, discCY, 57, 0, Math.PI * 2);
  ctx.stroke();

  // ===== Judul & artis =====
  const safeTitle = truncateForCard(input.title, 34);
  const safeArtist = truncateForCard(input.artist, 40);

  ctx.textAlign = 'center';
  ctx.fillStyle = PAPER;
  ctx.font = `600 ${titleFontSize(safeTitle)}px Fraunces, Georgia, serif`;
  ctx.fillText(safeTitle, discCX, discCY + discR + 130, contentW);

  ctx.fillStyle = MUTED;
  ctx.font = '400 34px Manrope, system-ui, sans-serif';
  ctx.fillText(safeArtist, discCX, discCY + discR + 186, contentW);

  // ===== Garis putus + meta bawah =====
  const dashY = cardY + cardH - 118;
  ctx.strokeStyle = 'rgba(239,237,224,0.15)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(contentX, dashY);
  ctx.lineTo(cardX + cardW - 56, dashY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = '400 24px "IBM Plex Mono", monospace';
  ctx.letterSpacing = '3px';
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.fillText(tActive('share.card.nowPlaying'), contentX, dashY + 52);
  ctx.textAlign = 'right';
  ctx.fillStyle = AMBER;
  ctx.fillText(formatDurationForCard(input.durationSec ?? 0), cardX + cardW - 56, dashY + 52);
  ctx.letterSpacing = '0px';

  // ===== Tagline bawah =====
  ctx.textAlign = 'center';
  ctx.fillStyle = PAPER;
  ctx.font = '600 40px Fraunces, Georgia, serif';
  ctx.fillText('Every song leaves a story.', SHARE_WIDTH / 2, cardY + cardH + 130);

  ctx.fillStyle = MUTED;
  ctx.font = '400 26px "IBM Plex Mono", monospace';
  ctx.letterSpacing = '4px';
  ctx.fillText('SCROLA · SCROBBLER LAST.FM', SHARE_WIDTH / 2, cardY + cardH + 186);
  ctx.letterSpacing = '0px';

  // toDataURL -> buang prefiks "data:image/png;base64," karena sisi native hanya butuh base64-nya
  return canvas.toDataURL('image/png').split(',')[1];
}
