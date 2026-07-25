import { registerPlugin } from '@capacitor/core';

export interface DiagnosticsPluginInterface {
  getLastCrashLog(): Promise<{ log: string | null }>;
  clearLastCrashLog(): Promise<void>;
  appendLog(options: { line: string }): Promise<void>;
  readEventLog(): Promise<{ log: string }>;
  clearEventLog(): Promise<void>;
}

export const Diagnostics = registerPlugin<DiagnosticsPluginInterface>('Diagnostics');

/**
 * Tulis satu baris ke log peristiwa on-device. Sengaja "fire and forget" — logging TIDAK BOLEH
 * menjatuhkan alur scrobble, jadi kegagalannya ditelan diam-diam. Dipakai untuk melacak jejak
 * nyata scrobble di perangkat, karena UI menampilkan status optimistis yang menyesatkan.
 */
export function diag(line: string): void {
  Diagnostics.appendLog({ line }).catch(() => {
    // di web preview plugin native tidak ada — abaikan
  });
}
