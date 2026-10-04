/**
 * In-memory one-shot handoff of a scanned receipt RESULT (Web P2.3).
 * Camera screen -> Form. Stores text fields only — never image/blob/base64.
 * Module-scoped; not persisted.
 */

import type { GeminiAnalysisResult } from './resultTypes';

interface PendingReceiptResult {
  result: GeminiAnalysisResult;
  createdAt: number;
}

/** 5 minutes — safety against stale handoffs after abandoned flows. */
export const PENDING_RECEIPT_RESULT_TTL_MS = 5 * 60_000;

let pending: PendingReceiptResult | null = null;

export function setPendingReceiptResult(
  result: GeminiAnalysisResult,
  now: number = Date.now(),
): void {
  pending = { result: { ...result }, createdAt: now };
}

/** Consume once. Returns null if missing or expired. */
export function consumePendingReceiptResult(
  now: number = Date.now(),
): GeminiAnalysisResult | null {
  const value = pending;
  pending = null;
  if (!value) return null;
  if (now - value.createdAt > PENDING_RECEIPT_RESULT_TTL_MS) return null;
  return value.result;
}

export function clearPendingReceiptResult(): void {
  pending = null;
}
