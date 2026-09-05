import type { HistoryRow } from './db/queries';

export interface DayGroup {
  /** Kunci unik untuk React key, format Y-M-D lokal (bukan untuk ditampilkan) */
  key: string;
  /** Label yang ditampilkan: "Hari ini" / "Kemarin" / "05 Jul" */
  label: string;
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
export function groupHistoryByDay(items: HistoryRow[], now: Date = new Date()): DayGroup[] {
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
      if (key === todayKey) label = 'Hari ini';
      else if (key === yesterdayKey) label = 'Kemarin';
      else label = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      idx = groups.length;
      groups.push({ key, label, items: [] });
      indexByKey.set(key, idx);
    }
    groups[idx].items.push(item);
  }
  return groups;
}
