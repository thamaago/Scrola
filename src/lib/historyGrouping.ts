import type { HistoryRow } from './db/queries';
import { translate, DEFAULT_LOCALE, type Locale } from './i18n';
import { formatDate, formatMonth } from './i18nFormat';

export interface DayGroup {
  /** Kunci unik untuk React key, format Y-M-D lokal (bukan untuk ditampilkan) */
  key: string;
  /** Label yang ditampilkan: "Hari ini" / "Kemarin" / "05 Jul" (sudah sesuai locale) */
  label: string;
  /** True untuk grup "hari ini" — dipakai UI untuk menyorot tanpa membandingkan string label. */
  isToday?: boolean;
  items: HistoryRow[];
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Kelompokkan riwayat scrobble per hari (waktu lokal perangkat), dengan label khusus untuk
 * hari ini dan kemarin. Sengaja dilakukan di JS (bukan query SQL GROUP BY) — jumlah baris yang
 * realistis ditampilkan sekaligus di Riwayat kecil (dibatasi `getHistory(limit)`), jadi
 * pengelompokan di sini jauh lebih murah risikonya untuk diverifikasi lewat unit test murni
 * dibanding menambah kerumitan SQL yang harus benar tanpa bisa dikompilasi & dites di sini.
 *
 * PENTING: `items` harus SUDAH terurut DESC by timestamp (seperti hasil `getHistory()`) —
 * fungsi ini tidak mengurutkan ulang, hanya mengelompokkan sambil mempertahankan urutan asli.
 */
export function groupHistoryByDay(
  items: HistoryRow[],
  now: Date = new Date(),
  locale: Locale = DEFAULT_LOCALE
): DayGroup[] {
  const todayKey = dayKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = dayKey(yesterday);

  const groups: DayGroup[] = [];
  const indexByKey = new Map<string, number>();

  for (const item of items) {
    const d = new Date(item.timestamp * 1000);
    const key = dayKey(d);
    let idx = indexByKey.get(key);
    if (idx === undefined) {
      let label: string;
      let isToday = false;
      if (key === todayKey) {
        label = translate(locale, 'hg.today');
        isToday = true;
      } else if (key === yesterdayKey) {
        label = translate(locale, 'hg.yesterday');
      } else {
        label = formatDate(locale, d, { day: '2-digit', month: 'short' });
      }
      idx = groups.length;
      groups.push({ key, label, isToday, items: [] });
      indexByKey.set(key, idx);
    }
    groups[idx].items.push(item);
  }
  return groups;
}

import { startOfIsoWeek } from './sisiBLogic';
import { weekRangeLabel } from './sisiBZineLayout';

export type HistoryPeriod = 'day' | 'week' | 'month';

/**
 * Kelompokkan riwayat per PERIODE: hari (delegasi ke groupHistoryByDay), minggu (Senin–Minggu, label
 * "Minggu ini"/"Minggu lalu"/rentang), atau bulan ("Bulan ini"/"Bulan lalu"/"Nama Tahun"). Bentuk
 * hasil identik dengan groupHistoryByDay (DayGroup) supaya rendering Riwayat tak berubah. `items`
 * diasumsikan sudah DESC by timestamp; urutan grup mengikuti kemunculan pertama (terbaru dulu).
 */
export function groupHistoryByPeriod(
  items: HistoryRow[],
  period: HistoryPeriod,
  now: Date = new Date(),
  locale: Locale = DEFAULT_LOCALE
): DayGroup[] {
  if (period === 'day') return groupHistoryByDay(items, now, locale);

  const groups = new Map<string, DayGroup>();
  const nowWeekStart = startOfIsoWeek(now).getTime();
  const prevWeekStart = nowWeekStart - 7 * 86400 * 1000;

  for (const item of items) {
    const d = new Date(item.timestamp * 1000);
    let key: string;
    let label: string;

    if (period === 'week') {
      const weekStart = startOfIsoWeek(d);
      const ws = weekStart.getTime();
      key = `w-${ws}`;
      if (ws === nowWeekStart) label = translate(locale, 'hg.thisWeek');
      else if (ws === prevWeekStart) label = translate(locale, 'hg.lastWeek');
      else label = weekRangeLabel(Math.floor(ws / 1000), locale);
    } else {
      key = `m-${d.getFullYear()}-${d.getMonth()}`;
      const sameMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const isPrevMonth = d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth();
      if (sameMonth) label = translate(locale, 'hg.thisMonth');
      else if (isPrevMonth) label = translate(locale, 'hg.lastMonth');
      else label = translate(locale, 'hg.monthYear', { month: formatMonth(locale, d.getMonth(), 'long'), year: d.getFullYear() });
    }

    if (!groups.has(key)) groups.set(key, { key, label, items: [] });
    groups.get(key)!.items.push(item);
  }
  return Array.from(groups.values());
}

/** Hanya baris yang punya catatan non-kosong (untuk mode "Catatan" di Riwayat). */
export function filterHistoryWithNotes(items: HistoryRow[]): HistoryRow[] {
  return items.filter((i) => (i.note ?? '').trim().length > 0);
}

/** N baris pertama (default 10) — mode "Terbaru". Mempertahankan urutan (DESC). */
export function recentHistory(items: HistoryRow[], max = 10): HistoryRow[] {
  return items.slice(0, max);
}

export interface HistoryPage {
  pageItems: HistoryRow[];
  page: number; // sudah di-clamp ke rentang valid [0, totalPages-1]
  totalPages: number;
  total: number;
  pageSize: number;
}

/**
 * Potong daftar riwayat jadi halaman berukuran `pageSize` (default 10). `page` yang di luar rentang
 * di-clamp ke halaman valid terakhir (atau 0) — aman saat mode berganti / item berkurang. Daftar
 * kosong tetap menghasilkan 1 halaman (tanpa item).
 */
export function paginateHistory(items: HistoryRow[], page: number, pageSize = 10): HistoryPage {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clamped = Math.min(Math.max(0, Math.trunc(page) || 0), totalPages - 1);
  const start = clamped * pageSize;
  return { pageItems: items.slice(start, start + pageSize), page: clamped, totalPages, total, pageSize };
}
