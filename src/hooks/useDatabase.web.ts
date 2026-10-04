// ============================================================
// P2.2 — Web bootstrap: no browser SQLite; app mounts after Auth gate.
// Android keeps useDatabase.ts → initializeDatabase() unchanged.
// ============================================================

import { useCallback, useMemo } from 'react';
import type { UseDatabaseResult } from './useDatabaseTypes';

/**
 * Web is ready without SQLite. Auth gate lives in WebAppShell.
 * Finance data comes from Supabase repositories (RLS).
 */
export function useDatabase(): UseDatabaseResult {
  const retryDatabase = useCallback(async () => {
    // No local DB to retry — cloud session/repos handle recovery.
  }, []);

  return useMemo(
    () => ({
      isReady: true,
      error: null,
      isInitializing: false,
      retryDatabase,
      // P2.2: do not short-circuit to foundation placeholder — show real tabs.
      webFoundation: undefined,
    }),
    [retryDatabase],
  );
}
