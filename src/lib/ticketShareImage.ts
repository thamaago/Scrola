import { SHARE_WIDTH, SHARE_HEIGHT } from './shareCardLayout';
import { emblemSeed, ticketEarnedLine } from './ticketShareLayout';
import type { CollectibleTicket } from './ticketSerialLogic';

/**
 * ticketShareImage.ts — render SATU tiket koleksi jadi PNG 9:16 yang bisa dibagikan (base64 tanpa
 * prefiks data URI). Format Story/Status. Atribusi (wordmark + URL + tagline) menyatu → tiap tiket
 * yang dibagikan jadi iklan Scrola. Pola guilloche unik-per-serial (deterministik) memberi kesan
 * "keaslian" seperti uang kertas — pembeda yang sulit ditiru. Melempar bila canvas tak tersedia.
 */

const INK = '#121A15';
const SURFACE = '#1A251E';
const SURFACE_RAISED = '#223026';
const AMBER = '#D6A756';
const CORAL = '#FF7A6B';
const PAPER = '#EFEDE0';
const MUTED = '#8FA394';

const KIND_LABEL: Record<CollectibleTicket['kind'], string> = {
  jejak: 'JEJAK',
  penemuan: 'PENEMUAN',
  setia: 'SETIA',
  beruntun: 'BERUNTUN',
  trofi: 'TROFI',
};

function formatEarned(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Bungkus teks ke beberapa baris agar muat di lebar maksimum. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function centerText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number) {
  ctx.textAlign = 'center';
  ctx.fillText(text, cx, y);
}

const TAU = Math.PI * 2;

/** PRNG deterministik (mulberry32) dari seed — untuk tinggi batang spektrum yang unik tapi stabil. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ikon musik generatif — "audio bloom": spektrum equalizer radial dengan tinggi batang ter-seed dari
 * LAGU, dibingkai seperti stempel (cincin + notch), dalam palet Hutan Malam. Jelas bertema musik,
 * UNIK per lagu, terasa cetak/segel — album-art khas Scrola tanpa jaringan/cover asli. Aksen berganti
 * amber/coral berdasar seed -> keluarga visual seragam, tiap lagu beda.
 */
/** Bingkai stempel bersama semua jenis: cincin luar + dalam + titik notch. */
function drawStampFrame(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.strokeStyle = 'rgba(214,167,86,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(214,167,86,0.22)';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.9, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = 'rgba(214,167,86,0.35)';
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95, 1.7, 0, TAU);
    ctx.fill();
  }
}

/** JEJAK — spektrum equalizer radial ("audio bloom"): perjalanan scrobble menumpuk. */
function drawSpectrum(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number, accent: string) {
  const rnd = mulberry32(seed);
  const bars = 56;
  const baseR = r * 0.3;
  const maxBar = r * 0.46;
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  for (let i = 0; i < bars; i++) {
    const h = baseR + (0.22 + 0.78 * rnd()) * maxBar;
    const a = (i / bars) * TAU - Math.PI / 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const isPaper = i % 7 === 0;
    ctx.strokeStyle = isPaper ? PAPER : accent;
    ctx.globalAlpha = isPaper ? 0.7 : 0.92;
    ctx.beginPath();
    ctx.moveTo(cx + cos * baseR, cy + sin * baseR);
    ctx.lineTo(cx + cos * h, cy + sin * h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, baseR * 0.58, 0, TAU);
  ctx.fillStyle = SURFACE_RAISED;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.05, 0, TAU);
  ctx.fillStyle = accent;
  ctx.fill();
}

/** PENEMUAN — konstelasi: bintang berjarak dihubungkan garis, seperti menemukan bintang baru. */
function drawConstellation(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number, accent: string) {
  const rnd = mulberry32(seed);
  const n = 8 + Math.floor(rnd() * 5);
  const stars: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    const ang = rnd() * TAU;
    const rad = (0.18 + rnd() * 0.6) * r;
    stars.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, 2 + rnd() * 3.5]);
  }
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  stars.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.globalAlpha = 1;
  stars.forEach(([x, y, sr], i) => {
    ctx.fillStyle = i % 3 === 0 ? PAPER : accent;
    ctx.beginPath();
    ctx.arc(x, y, sr, 0, TAU);
    ctx.fill();
    if (sr > 3.6) {
      ctx.strokeStyle = PAPER;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - sr * 2.2, y);
      ctx.lineTo(x + sr * 2.2, y);
      ctx.moveTo(x, y - sr * 2.2);
      ctx.lineTo(x, y + sr * 2.2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  });
}

/** SETIA — riak/mandala: busur konsentris berjeda, "kembali berputar". */
function drawRipple(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number, accent: string) {
  const rnd = mulberry32(seed);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  for (let ring = 1; ring <= 6; ring++) {
    const rr = (ring / 6.5) * r;
    const segs = 3 + Math.floor(rnd() * 5);
    const off = rnd() * TAU;
    ctx.globalAlpha = 0.3 + 0.5 * (ring / 6);
    for (let s = 0; s < segs; s++) {
      const a0 = off + (s / segs) * TAU;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, a0, a0 + (TAU / segs) * 0.62);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.05, 0, TAU);
  ctx.fillStyle = accent;
  ctx.fill();
}

/** BERUNTUN — gelombang mendatar: momentum tak putus. */
function drawWaveform(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number, accent: string) {
  const rnd = mulberry32(seed);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.88, 0, TAU);
  ctx.clip();
  const pts = 40;
  const amp = r * 0.5;
  const vals: number[] = [];
  for (let i = 0; i <= pts; i++) vals.push(rnd() * 2 - 1);
  const drawWave = (alpha: number, dy: number) => {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= pts; i++) {
      const x = cx - r * 0.88 + (i / pts) * r * 1.76;
      const y = cy + dy + vals[i] * amp * (0.35 + 0.65 * Math.sin((i / pts) * Math.PI));
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  };
  drawWave(0.9, 0);
  drawWave(0.3, r * 0.12);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** TROFI — medali berbintang: rays + bintang tengah, kesan lencana/piala game. */
function drawMedallion(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number, accent: string) {
  const rnd = mulberry32(seed);
  const rays = 24 + Math.floor(rnd() * 16);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.8;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * TAU;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.66, cy + Math.sin(a) * r * 0.66);
    ctx.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.58, 0, TAU);
  ctx.fillStyle = SURFACE_RAISED;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.stroke();
  const points = 5 + Math.floor(rnd() * 4);
  const outer = r * 0.44;
  const inner = outer * 0.45;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * TAU - Math.PI / 2;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Ikon musik generatif per JENIS tiket — tiap jenis punya bentuk berkarakter (JEJAK=spektrum,
 * PENEMUAN=konstelasi, SETIA=riak, BERUNTUN=gelombang), tetap UNIK per lagu (seed), tetap keluarga
 * Scrola (bingkai stempel + palet Hutan Malam + aksen amber/coral). Album-art khas tanpa jaringan.
 */
function drawTicketEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  seed: number,
  kind: CollectibleTicket['kind']
) {
  const accent = seed & 1 ? CORAL : AMBER;
  ctx.save();
  drawStampFrame(ctx, cx, cy, r);
  if (kind === 'penemuan') drawConstellation(ctx, cx, cy, r * 0.82, seed, accent);
  else if (kind === 'setia') drawRipple(ctx, cx, cy, r * 0.82, seed, accent);
  else if (kind === 'beruntun') drawWaveform(ctx, cx, cy, r, seed, accent);
  else if (kind === 'trofi') drawMedallion(ctx, cx, cy, r, seed, accent);
  else drawSpectrum(ctx, cx, cy, r, seed, accent);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderTicketShareImage(ticket: CollectibleTicket): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia');

  // Latar tinta + glow atas
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  const glow = ctx.createRadialGradient(SHARE_WIDTH / 2, 140, 0, SHARE_WIDTH / 2, 140, 900);
  glow.addColorStop(0, 'rgba(214,167,86,0.10)');
  glow.addColorStop(1, 'rgba(214,167,86,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);

  const cardX = 70;
  const cardY = 300;
  const cardW = SHARE_WIDTH - cardX * 2;
  const cardH = 1180;
  const cx = SHARE_WIDTH / 2;

  // Kartu
  roundRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fillStyle = SURFACE;
  ctx.fill();

  ctx.strokeStyle = 'rgba(214,167,86,0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.stroke();

  // Header
  ctx.fillStyle = AMBER;
  ctx.font = '500 26px "IBM Plex Mono", monospace';
  centerText(ctx, 'K O L E K S I · S C R O L A', cx, cardY + 78);
  ctx.font = '600 30px "IBM Plex Mono", monospace';
  centerText(ctx, KIND_LABEL[ticket.kind], cx, cardY + 150);

  // Judul milestone (wrap)
  ctx.fillStyle = PAPER;
  ctx.font = '600 82px Fraunces, Georgia, serif';
  const titleLines = wrapText(ctx, ticket.label, cardW - 120);
  let y = cardY + 250;
  for (const ln of titleLines) {
    centerText(ctx, ln, cx, y);
    y += 92;
  }
  y += 20;

  // Emblem generatif (album-art khas Scrola) — pusat visual, unik per lagu
  const emblemR = 178;
  const emblemCy = y + emblemR;
  drawTicketEmblem(ctx, cx, emblemCy, emblemR, emblemSeed(ticket), ticket.kind);
  y = emblemCy + emblemR + 56;

  // Subjek (artis penemuan)
  if (ticket.subject) {
    ctx.fillStyle = PAPER;
    ctx.font = '600 46px Fraunces, Georgia, serif';
    centerText(ctx, ticket.subject, cx, y);
    y += 62;
  }

  // Lagu pemicu
  const earned = ticketEarnedLine(ticket);
  if (earned) {
    ctx.fillStyle = MUTED;
    ctx.font = 'italic 400 36px Fraunces, Georgia, serif';
    for (const ln of wrapText(ctx, earned, cardW - 140)) {
      centerText(ctx, ln, cx, y);
      y += 50;
    }
    y += 4;
  }

  // Tanggal
  ctx.fillStyle = MUTED;
  ctx.font = '400 28px "IBM Plex Mono", monospace';
  centerText(ctx, formatEarned(ticket.earnedAtSec), cx, y + 8);

  // Perforasi stub
  const stubY = cardY + cardH - 250;
  ctx.fillStyle = INK;
  for (let px = cardX + 30; px <= cardX + cardW - 30; px += 26) {
    ctx.beginPath();
    ctx.arc(px, stubY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cap serial (hero) — kotak kuningan sedikit miring
  ctx.save();
  ctx.translate(cx, stubY + 120);
  ctx.rotate((-2 * Math.PI) / 180);
  ctx.font = '600 46px "IBM Plex Mono", monospace';
  const serialText = `№ ${ticket.serial}`;
  const sw = ctx.measureText(serialText).width;
  const boxW = sw + 68;
  const boxH = 96;
  roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 12);
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = AMBER;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(serialText, 0, 4);
  ctx.restore();
  ctx.textBaseline = 'alphabetic';

  // Atribusi = iklan
  ctx.fillStyle = PAPER;
  ctx.font = '600 62px Fraunces, Georgia, serif';
  centerText(ctx, 'Scrola', cx, cardY + cardH + 80);
  ctx.fillStyle = MUTED;
  ctx.font = 'italic 400 34px Fraunces, Georgia, serif';
  centerText(ctx, 'Every song leaves a story.', cx, cardY + cardH + 140);
  ctx.fillStyle = AMBER;
  ctx.font = '500 26px "IBM Plex Mono", monospace';
  centerText(ctx, 'scrola.app · scrobbler Last.fm', cx, cardY + cardH + 196);

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.split(',')[1] ?? '';
}
