/**
 * Platform-neutral stub. The real implementation lives in `webClient.web.ts`
 * (Metro picks it on web). Native must never call the Edge receipt proxy.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GeminiAnalysisResult } from './resultTypes';

export async function analyzeReceiptViaEdge(
  _blob: Blob,
  _client: SupabaseClient,
): Promise<GeminiAnalysisResult> {
  throw new Error('Web only');
}
