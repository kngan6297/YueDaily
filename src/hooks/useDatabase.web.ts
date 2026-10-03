// ============================================================
// P2.0 — Web bootstrap: do NOT open browser SQLite as system of record.
// Android keeps useDatabase.ts → initializeDatabase() unchanged.
// ============================================================

import { useCallback, useMemo, useState } from 'react';
import { createWebFoundationBootstrap } from '../platform/webFoundation';
import type { UseDatabaseResult } from './useDatabaseTypes';

/**
 * Web foundation bootstrap — app shell may render, but finance data waits for P2.1+.
 * Intentionally does not call expo-sqlite / initializeDatabase.
 */
export function useDatabase(): UseDatabaseResult {
  const [bootstrap] = useState(() => createWebFoundationBootstrap());

  const retryDatabase = useCallback(async () => {
    // No-op: cloud data layer arrives in P2.1; retrying cannot open a production web DB yet.
  }, []);

  return useMemo(
    () => ({
      isReady: true,
      error: null,
      isInitializing: false,
      retryDatabase,
      webFoundation: bootstrap,
    }),
    [bootstrap, retryDatabase],
  );
}
