import { registerPlugin } from '@capacitor/core';

export interface DiagnosticsPluginInterface {
  getLastCrashLog(): Promise<{ log: string | null }>;
  clearLastCrashLog(): Promise<void>;
}

export const Diagnostics = registerPlugin<DiagnosticsPluginInterface>('Diagnostics');
