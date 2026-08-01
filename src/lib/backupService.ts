import {
  serializeBackup,
  parseBackup,
  mergeBackup,
} from './backupData';
import {
  getAllHistoryForBackup,
  insertBackupRows,
  setHistoryNote,
  setLoved,
} from './db/queries';

/**
 * backupService.ts — orkestrasi tipis antara DB dan logika backup MURNI (backupData.ts).
 * Semua keputusan yang berisiko (validasi, merge non-destruktif) ada di modul murni yang teruji;
 * di sini hanya baca/tulis DB.
 */

export interface RestoreSummary {
  inserted: number;
  notesRestored: number;
  favoritesRestored: number;
  conflicts: number;
  exportedAt: number;
}

/** Bangun isi file backup JSON dari seluruh riwayat saat ini. */
export async function buildBackupJson(nowSec: number = Math.floor(Date.now() / 1000)): Promise<string> {
  const rows = await getAllHistoryForBackup();
  return serializeBackup(rows, nowSec);
}

/**
 * Terapkan restore dari isi file JSON. NON-DESTRUKTIF (lihat mergeBackup): tidak pernah menimpa
 * catatan lokal yang ada atau meng-unfavorite. Melempar kalau file bukan backup Scrola yang valid.
 */
export async function restoreFromJson(json: string): Promise<RestoreSummary> {
  const parsed = parseBackup(json); // melempar kalau tak valid — biarkan pemanggil menangkap
  const local = await getAllHistoryForBackup();
  const plan = mergeBackup(local, parsed.rows);

  if (plan.toInsert.length > 0) await insertBackupRows(plan.toInsert);
  for (const { id, note } of plan.noteRestores) await setHistoryNote(id, note);
  for (const id of plan.favoriteRestores) await setLoved(id, true);

  return {
    inserted: plan.toInsert.length,
    notesRestored: plan.noteRestores.length,
    favoritesRestored: plan.favoriteRestores.length,
    conflicts: plan.noteConflicts,
    exportedAt: parsed.exportedAt,
  };
}
