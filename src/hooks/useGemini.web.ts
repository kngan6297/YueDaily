// ============================================================
// Web stub — receipt AI goes through Edge (camera.web → webClient).
// Avoids bundling native EXPO_PUBLIC provider key reads on Web.
// ============================================================

import { useCallback, useState } from 'react';
import type { GeminiAnalysisResult } from '../types';

interface UseGeminiResult {
  analyze: (imageBase64: string) => Promise<GeminiAnalysisResult>;
  isLoading: boolean;
  error: string | null;
}

export function useGemini(): UseGeminiResult {
  const [isLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (_imageBase64: string): Promise<GeminiAnalysisResult> => {
    const msg =
      'Trên Web, hãy dùng Quét bill (Chụp bill / Chọn ảnh). AI chạy qua Edge, không gọi provider trực tiếp từ trình duyệt.';
    setError(msg);
    throw new Error(msg);
  }, []);

  return { analyze, isLoading, error };
}
