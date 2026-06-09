// ============================================================
// HOOK KHỞI TẠO DATABASE KHI APP KHỞI ĐỘNG
// ============================================================

import { useEffect, useState } from 'react';
import { initializeDatabase } from '../database/initDb';

interface UseDatabaseResult {
  isReady: boolean;
  error: Error | null;
}

/**
 * Hook này phải được gọi ở root layout để đảm bảo
 * database đã sẵn sàng trước khi render các màn hình
 */
export function useDatabase(): UseDatabaseResult {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    initializeDatabase()
      .then(() => {
        if (mounted) setIsReady(true);
      })
      .catch((err) => {
        console.error('Lỗi khởi tạo database:', err);
        if (mounted) setError(err as Error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { isReady, error };
}
