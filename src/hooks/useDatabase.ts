// ============================================================
// HOOK KHỞI TẠO DATABASE KHI APP KHỞI ĐỘNG
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { initializeDatabase } from '../database/initDb';

interface UseDatabaseResult {
  isReady: boolean;
  error: Error | null;
  isInitializing: boolean;
  retryDatabase: () => Promise<void>;
}

/**
 * Hook này phải được gọi ở root layout để đảm bảo
 * database đã sẵn sàng trước khi render các màn hình
 */
export function useDatabase(): UseDatabaseResult {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const runInit = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    if (mountedRef.current) {
      setError(null);
      setIsInitializing(true);
    }

    try {
      await initializeDatabase();
      if (mountedRef.current) {
        setIsReady(true);
        setError(null);
      }
    } catch (err) {
      console.error('Lỗi khởi tạo database:', err);
      if (mountedRef.current) {
        setIsReady(false);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setIsInitializing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    runInit();
    return () => {
      mountedRef.current = false;
    };
  }, [runInit]);

  const retryDatabase = useCallback(async () => {
    await runInit();
  }, [runInit]);

  return { isReady, error, isInitializing, retryDatabase };
}
