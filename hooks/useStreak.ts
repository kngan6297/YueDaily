// ============================================================
// HOOK QUẢN LÝ STREAK (SỐ NGÀY GHI CHÉP LIÊN TIẾP)
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { getStreak } from '../database/categories';
import type { Streak } from '../types';

interface UseStreakResult {
  streak: Streak | null;
  refreshStreak: () => Promise<void>;
}

export function useStreak(): UseStreakResult {
  const [streak, setStreak] = useState<Streak | null>(null);

  const refreshStreak = useCallback(async () => {
    try {
      const data = await getStreak();
      setStreak(data);
    } catch (err) {
      console.error('Lỗi tải streak:', err);
    }
  }, []);

  useEffect(() => {
    refreshStreak();
  }, [refreshStreak]);

  return { streak, refreshStreak };
}
