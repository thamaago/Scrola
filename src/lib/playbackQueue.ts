/**
 * playbackQueue.ts — logika antrean pemutar (MURNI, tanpa Android → bisa diuji penuh).
 *
 * "Pemutar sungguhan" Tahap 2. Antrean ini adalah SUMBER KEBENARAN urutan main di sisi JS; native
 * (Tahap 4) tinggal memutar `orderedUris(q)` lewat `setMediaItems` (gapless otomatis Media3) dan
 * melompat ke `position`. Semua transisi (next/prev/shuffle/repeat/tambah/hapus/pindah) dihitung di
 * sini supaya konsisten & teruji, lepas dari native.
 *
 * Model: `items` = urutan ASLI; `playOrder` = permutasi indeks item (identitas saat shuffle mati,
 * acak saat menyala); `position` = posisi saat ini DI DALAM playOrder.
 */

export type RepeatMode = 'off' | 'all' | 'one';

export interface QueueState {
  items: string[]; // id/uri track dalam urutan asli
  playOrder: number[]; // permutasi indeks ke items
  position: number; // indeks ke playOrder; -1 bila antrean kosong
  repeat: RepeatMode;
  shuffle: boolean;
}

export type ShuffleFn = (indices: number[]) => number[];

/** Fisher–Yates default (memakai Math.random). Untuk tes, suntik shuffle deterministik. */
export function defaultShuffle(indices: number[]): number[] {
  const a = [...indices];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createQueue(items: string[], startIndex = 0): QueueState {
  const n = items.length;
  const pos = n === 0 ? -1 : Math.min(Math.max(startIndex, 0), n - 1);
  return {
    items: [...items],
    playOrder: items.map((_, i) => i),
    position: pos,
    repeat: 'off',
    shuffle: false,
  };
}

/** Indeks item saat ini (ke `items`), atau -1. */
export function currentItemIndex(q: QueueState): number {
  if (q.position < 0 || q.position >= q.playOrder.length) return -1;
  return q.playOrder[q.position];
}

/** Track yang sedang diputar (id/uri), atau null. */
export function currentTrack(q: QueueState): string | null {
  const i = currentItemIndex(q);
  return i < 0 ? null : q.items[i];
}

/** Urutan uri/id sesuai playOrder — inilah yang diberikan ke native setMediaItems. */
export function orderedUris(q: QueueState): string[] {
  return q.playOrder.map((i) => q.items[i]);
}

/** Apakah sudah di track terakhir dari urutan main. */
export function isAtEnd(q: QueueState): boolean {
  return q.position >= 0 && q.position === q.playOrder.length - 1;
}

/**
 * Maju satu track sesuai mode. repeat 'one' -> tetap. Di ujung: 'all' -> balik ke awal, 'off' ->
 * tetap (pemutar berhenti). `auto` menandai apakah ini kemajuan otomatis (lagu habis) atau tekan
 * tombol — dipakai untuk repeat 'one' yang hanya berlaku pada auto-advance.
 */
export function next(q: QueueState, auto = false): QueueState {
  if (q.position < 0) return q;
  if (q.repeat === 'one' && auto) return q; // ulangi lagu yang sama saat habis
  if (!isAtEnd(q)) return { ...q, position: q.position + 1 };
  if (q.repeat === 'all') return { ...q, position: 0 };
  return q; // ujung + repeat off: tetap (berhenti)
}

/** Mundur satu track. Di awal: 'all' -> ke akhir, selain itu tetap di 0. */
export function prev(q: QueueState): QueueState {
  if (q.position < 0) return q;
  if (q.position > 0) return { ...q, position: q.position - 1 };
  if (q.repeat === 'all') return { ...q, position: q.playOrder.length - 1 };
  return q;
}

/** Lompat ke sebuah indeks ITEM (bukan playOrder). */
export function jumpToItem(q: QueueState, itemIndex: number): QueueState {
  const pos = q.playOrder.indexOf(itemIndex);
  if (pos < 0) return q;
  return { ...q, position: pos };
}

export function setRepeat(q: QueueState, repeat: RepeatMode): QueueState {
  return { ...q, repeat };
}

/** Siklus mode repeat: off -> all -> one -> off. */
export function cycleRepeat(q: QueueState): QueueState {
  const nextMode: RepeatMode = q.repeat === 'off' ? 'all' : q.repeat === 'all' ? 'one' : 'off';
  return { ...q, repeat: nextMode };
}

/**
 * Nyalakan/matikan shuffle. Saat MENYALA: track saat ini tetap diputar (jadi elemen pertama
 * playOrder baru), sisanya diacak, position -> 0. Saat MATI: kembali ke urutan asli, position
 * menunjuk indeks asli track saat ini (pemutaran mulus, tidak melompat).
 */
export function toggleShuffle(q: QueueState, shuffle: ShuffleFn = defaultShuffle): QueueState {
  if (q.position < 0) return { ...q, shuffle: !q.shuffle };
  const curItem = currentItemIndex(q);
  if (!q.shuffle) {
    const rest = q.items.map((_, i) => i).filter((i) => i !== curItem);
    const shuffledRest = shuffle(rest);
    return { ...q, shuffle: true, playOrder: [curItem, ...shuffledRest], position: 0 };
  }
  return {
    ...q,
    shuffle: false,
    playOrder: q.items.map((_, i) => i),
    position: curItem,
  };
}

/** Tambah track ke akhir antrean (mempertahankan track & posisi saat ini). */
export function addToQueue(q: QueueState, newItems: string[]): QueueState {
  if (newItems.length === 0) return q;
  const startIdx = q.items.length;
  const items = [...q.items, ...newItems];
  const newIndices = newItems.map((_, k) => startIdx + k);
  const playOrder = [...q.playOrder, ...newIndices];
  const position = q.position < 0 ? 0 : q.position;
  return { ...q, items, playOrder, position };
}

/**
 * Hapus track pada indeks ITEM. Menyesuaikan playOrder + position (indeks yang lebih besar digeser).
 * Bila yang dihapus adalah track saat ini, position tetap menunjuk slot yang sama (track berikutnya).
 */
export function removeItem(q: QueueState, itemIndex: number): QueueState {
  if (itemIndex < 0 || itemIndex >= q.items.length) return q;
  const items = q.items.filter((_, i) => i !== itemIndex);
  // Buang dari playOrder + geser indeks > itemIndex turun 1.
  const removedPos = q.playOrder.indexOf(itemIndex);
  const playOrder = q.playOrder
    .filter((i) => i !== itemIndex)
    .map((i) => (i > itemIndex ? i - 1 : i));
  let position = q.position;
  if (playOrder.length === 0) position = -1;
  else if (removedPos < q.position) position = q.position - 1; // yang dihapus sebelum current
  else if (removedPos === q.position) position = Math.min(q.position, playOrder.length - 1);
  return { ...q, items, playOrder, position };
}
