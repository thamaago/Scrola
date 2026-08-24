import { SHARE_WIDTH, SHARE_HEIGHT } from './shareCardLayout';
import { weekRangeLabel, dayBarHeights, peakHourLabel, zineSerial } from './sisiBZineLayout';
import { formatDurationHuman, type SisiBStats } from './sisiBLogic';
import { getActiveLocale, tActive } from './i18n';
import { formatWeekday } from './i18nFormat';

/**
 * sisiBZineImage.ts — merender recap Sisi B mingguan jadi PNG "zine" untuk dibagikan.
 *
 * Pola & alasan teknis identik dengan shareImage.ts: Canvas API bawaan (nol dependensi, kontrol
 * penuh atas motif cetak: perforasi, garis putus, bar chart), tunggu document.fonts.ready supaya
 * font kustom benar-benar terpakai, kembalikan base64 PNG tanpa prefiks data URI. Semua keputusan
 * label/normalisasi berasal dari sisiBZineLayout.ts (murni, sudah diunit-test).
 */

const INK = '#121A15';
const SURFACE = '#1A251E';
const SURFACE_RAISED = '#223026';
const AMBER = '#D6A756';
const PAPER = '#EFEDE0';
const MUTED = '#8FA394';

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

function dashedLine(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number) {
  ctx.strokeStyle = 'rgba(239,237,224,0.15)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Render zine Sisi B -> PNG base64 (tanpa prefiks data URI). Melempar kalau canvas tak tersedia.
 */
export async function renderSisiBZine(stats: SisiBStats, weekStartUnixSec: number): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia di perangkat ini');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* font fallback lebih baik daripada gagal total */
    }
  }

  // ===== Latar =====
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);

  // Sorot hangat dari atas (sama seperti kartu tiket)
  const glow = ctx.createRadialGradient(SHARE_WIDTH / 2, 120, 0, SHARE_WIDTH / 2, 120, 900);
  glow.addColorStop(0, 'rgba(214,167,86,0.16)');
  glow.addColorStop(1, 'rgba(214,167,86,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);

  // Butiran halus (tekstur kertas)
  ctx.fillStyle = 'rgba(239,237,224,0.035)';
  for (let y = 0; y < SHARE_HEIGHT; y += 18) {
    for (let x = 0; x < SHARE_WIDTH; x += 18) ctx.fillRect(x, y, 2, 2);
  }

  // ===== Kartu tiket =====
  const cardX = 90;
  const cardW = SHARE_WIDTH - cardX * 2;
  const cardY = 250;
  const cardH = 1440;
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

  const cx0 = cardX + perfW + 46;
  const cxR = cardX + cardW - 56;
  const cxMid = (cx0 + cxR) / 2;
  const cW = cxR - cx0;

  // ===== Header =====
  ctx.textAlign = 'left';
  ctx.fillStyle = AMBER;
  ctx.font = '600 26px "IBM Plex Mono", monospace';
  ctx.letterSpacing = '6px';
  ctx.fillText('SCROLA', cx0, cardY + 74);
  ctx.textAlign = 'right';
  ctx.fillStyle = MUTED;
  ctx.fillText(tActive('share.zine.sideB'), cxR, cardY + 74);
  ctx.letterSpacing = '0px';

  // ===== Masthead: rentang minggu =====
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.font = '400 24px "IBM Plex Mono", monospace';
  ctx.letterSpacing = '3px';
  ctx.fillText(tActive('share.zine.weeklyRecap'), cx0, cardY + 140);
  ctx.letterSpacing = '0px';

  ctx.textAlign = 'center';
  ctx.fillStyle = PAPER;
  ctx.font = '600 76px Fraunces, Georgia, serif';
  ctx.fillText(weekRangeLabel(weekStartUnixSec, getActiveLocale()), cxMid, cardY + 218, cW);

  dashedLine(ctx, cx0, cardY + 268, cxR);

  // ===== Lagu minggu ini =====
  ctx.textAlign = 'left';
  ctx.fillStyle = AMBER;
  ctx.font = '600 24px "IBM Plex Mono", monospace';
  ctx.letterSpacing = '3px';
  ctx.fillText(tActive('share.zine.songOfWeek'), cx0, cardY + 320);
  ctx.letterSpacing = '0px';

  ctx.textAlign = 'center';
  if (stats.topTrack) {
    ctx.fillStyle = PAPER;
    ctx.font = '600 60px Fraunces, Georgia, serif';
    ctx.fillText(stats.topTrack.track, cxMid, cardY + 392, cW);
    ctx.fillStyle = MUTED;
    ctx.font = '400 34px Manrope, system-ui, sans-serif';
    ctx.fillText(stats.topTrack.artist, cxMid, cardY + 446, cW);
  } else {
    ctx.fillStyle = MUTED;
    ctx.font = '400 40px Fraunces, Georgia, serif';
    ctx.fillText(tActive('share.zine.noScrobbles'), cxMid, cardY + 410, cW);
  }

  // ===== Bar chart mingguan =====
  const chartTop = cardY + 500;
  const chartH = 200;
  const heights = dayBarHeights(stats.dayCounts, chartH - 40);
  const peakIdx = stats.dayCounts.indexOf(Math.max(...stats.dayCounts, 0));
  const slot = cW / 7;
  const barW = 46;
  for (let i = 0; i < 7; i++) {
    const bx = cx0 + slot * i + slot / 2;
    const bh = heights[i];
    const isPeak = i === peakIdx && stats.dayCounts[i] > 0;
    if (bh > 0) {
      ctx.fillStyle = isPeak ? AMBER : SURFACE_RAISED;
      roundRect(ctx, bx - barW / 2, chartTop + chartH - bh, barW, bh, 8);
      ctx.fill();
    }
    // jumlah di atas bar
    if (stats.dayCounts[i] > 0) {
      ctx.fillStyle = MUTED;
      ctx.font = '400 20px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(stats.dayCounts[i]), bx, chartTop + chartH - bh - 12);
    }
    // label hari
    ctx.fillStyle = isPeak ? AMBER : MUTED;
    ctx.font = '400 22px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(formatWeekday(getActiveLocale(), i, 'short'), bx, chartTop + chartH + 34);
  }

  // ===== Grid statistik =====
  const gridTop = chartTop + chartH + 110;
  const colL = cx0;
  const colR = cx0 + cW / 2 + 10;
  const stat = (x: number, y: number, big: string, small: string, bigColor = PAPER) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = bigColor;
    ctx.font = '600 54px Fraunces, Georgia, serif';
    ctx.fillText(big, x, y);
    ctx.fillStyle = MUTED;
    ctx.font = '400 28px Manrope, system-ui, sans-serif';
    ctx.fillText(small, x, y + 44);
  };
  stat(colL, gridTop, String(stats.totalTracks), tActive('share.zine.stat.tracks'));
  stat(colR, gridTop, String(stats.totalArtists), tActive('share.zine.stat.artists'));
  stat(colL, gridTop + 150, formatDurationHuman(stats.totalDurationSec, getActiveLocale()), tActive('share.zine.stat.totalHeard'));
  stat(colR, gridTop + 150, String(stats.newArtistCount), tActive('share.zine.stat.newDiscoveries'), AMBER);

  // ===== Strip jam puncak =====
  const stripY = gridTop + 300;
  ctx.fillStyle = SURFACE_RAISED;
  roundRect(ctx, cx0, stripY, cW, 92, 14);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.font = '400 26px "IBM Plex Mono", monospace';
  ctx.letterSpacing = '3px';
  ctx.fillText(tActive('share.zine.peakHour'), cx0 + 30, stripY + 58);
  ctx.textAlign = 'right';
  ctx.fillStyle = AMBER;
  ctx.font = '600 34px "IBM Plex Mono", monospace';
  ctx.fillText(peakHourLabel(stats.peakHour), cxR - 30, stripY + 58);
  ctx.letterSpacing = '0px';

  // ===== Serial (bawah kartu) =====
  dashedLine(ctx, cx0, cardY + cardH - 150, cxR);
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.font = '400 22px "IBM Plex Mono", monospace';
  ctx.letterSpacing = '3px';
  ctx.fillText(tActive('share.zine.serial'), cx0, cardY + cardH - 108);
  ctx.textAlign = 'right';
  ctx.font = '400 26px "IBM Plex Mono", monospace';
  ctx.fillText(zineSerial(weekStartUnixSec), cxR, cardY + cardH - 108);
  ctx.letterSpacing = '0px';

  // ===== Tagline (luar kartu) =====
  ctx.textAlign = 'center';
  ctx.fillStyle = PAPER;
  ctx.font = '600 42px Fraunces, Georgia, serif';
  ctx.fillText('Every song leaves a story.', SHARE_WIDTH / 2, cardY + cardH + 66);
  ctx.fillStyle = MUTED;
  ctx.font = '400 24px "IBM Plex Mono", monospace';
  ctx.letterSpacing = '4px';
  ctx.fillText('SCROLA · SISI B · SCROBBLER LAST.FM', SHARE_WIDTH / 2, cardY + cardH + 128);
  ctx.letterSpacing = '0px';

  return canvas.toDataURL('image/png').split(',')[1];
}
