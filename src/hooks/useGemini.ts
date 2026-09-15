// ============================================================
// HOOK PHÂN TÍCH ẢNH AI — P1.7A receipt scan orchestration
// Provider order: Gemini Flash-Lite → Gemini Flash
// ============================================================

import { useCallback, useState } from 'react';
import { analyzeReceiptImage } from '../services/receiptAi/analyzeReceiptImage';
import { hasAnyReceiptAiKey, loadReceiptAiEnvFromProcess } from '../services/receiptAi/env';
import { finalFailureMessage, ReceiptAiError } from '../services/receiptAi/errors';
import type { GeminiAnalysisResult } from '../types';

interface UseGeminiResult {
  analyze: (imageBase64: string) => Promise<GeminiAnalysisResult>;
  isLoading: boolean;
  error: string | null;
}

export function useGemini(): UseGeminiResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (imageBase64: string): Promise<GeminiAnalysisResult> => {
    const env = loadReceiptAiEnvFromProcess();
    const dev = typeof __DEV__ !== 'undefined' && __DEV__;

    if (!hasAnyReceiptAiKey(env)) {
      const msg = finalFailureMessage(
        [{ provider: 'gemini', kind: 'missing_key' }],
        dev,
      );
      setError(msg);
      throw new Error(msg);
    }

    setIsLoading(true);
    setError(null);

    try {
      return await analyzeReceiptImage(imageBase64, env, {
        fetch: globalThis.fetch,
        dev,
      });
    } catch (err) {
      const msg =
        err instanceof ReceiptAiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Có lỗi xảy ra khi phân tích ảnh';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { analyze, isLoading, error };
}
