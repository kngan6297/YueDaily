/**
 * P2.3 — Web receipt scan via Supabase Edge Function `analyze-receipt`.
 * Browser holds NO provider keys; auth is the user's Supabase session JWT
 * attached by supabase-js. Do not send user_id.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ANALYZE_RECEIPT_FUNCTION,
  ANALYZE_RECEIPT_IMAGE_FIELD,
  EDGE_ERROR_AI_MALFORMED_RESPONSE,
} from './edgeErrorCodes';
import { ReceiptAiError } from './errors';
import { parseReceiptAiJson } from './prompt';
import type { GeminiAnalysisResult } from './resultTypes';
import {
  extractEdgeErrorCode,
  genericReceiptAiError,
  networkReceiptAiError,
  receiptAiErrorFromEdgeCode,
  receiptAiErrorFromInvokeError,
} from './webClientErrors';

/** Validate + normalize the edge payload `{ result: {...} }`. */
export function parseEdgeAnalyzeResponse(data: unknown): GeminiAnalysisResult {
  const code = extractEdgeErrorCode(data);
  if (code) throw receiptAiErrorFromEdgeCode(code);

  const raw =
    data && typeof data === 'object'
      ? (data as Record<string, unknown>).result
      : undefined;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw receiptAiErrorFromEdgeCode(EDGE_ERROR_AI_MALFORMED_RESPONSE);
  }

  const r = raw as Record<string, unknown>;
  // Must carry at least one recognizable field — avoid treating `{}` as a valid scan.
  const hasShape =
    typeof r.is_receipt === 'boolean' ||
    typeof r.amount === 'number' ||
    typeof r.description === 'string' ||
    typeof r.note === 'string';
  if (!hasShape) {
    throw receiptAiErrorFromEdgeCode(EDGE_ERROR_AI_MALFORMED_RESPONSE);
  }

  try {
    // Reuse the shared sanitizer so category/amount rules match native.
    return parseReceiptAiJson(JSON.stringify(raw));
  } catch {
    throw receiptAiErrorFromEdgeCode(EDGE_ERROR_AI_MALFORMED_RESPONSE);
  }
}

export async function analyzeReceiptViaEdge(
  blob: Blob,
  client: SupabaseClient,
): Promise<GeminiAnalysisResult> {
  const formData = new FormData();
  formData.append(ANALYZE_RECEIPT_IMAGE_FIELD, blob, 'receipt.jpg');

  let response: { data: unknown; error: unknown };
  try {
    response = await client.functions.invoke(ANALYZE_RECEIPT_FUNCTION, {
      body: formData,
    });
  } catch (err) {
    if (err instanceof ReceiptAiError) throw err;
    throw networkReceiptAiError();
  }

  if (response.error) {
    throw await receiptAiErrorFromInvokeError(response.error);
  }
  if (response.data == null) throw genericReceiptAiError();

  return parseEdgeAnalyzeResponse(response.data);
}
