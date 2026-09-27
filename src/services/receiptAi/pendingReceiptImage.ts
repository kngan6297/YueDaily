/**
 * In-memory camera/gallery URI handoff.
 * Avoids expo-router param corruption of file:// URIs.
 * Module-scoped only — not persistent receipt storage (P1.7B).
 */

interface PendingReceiptImage {
  uri: string;
  size: number | null;
  createdAt: number;
}

let pending: PendingReceiptImage | null = null;

/** Store TEMP prep URI before router navigation. */
export function setPendingReceiptImage(input: {
  uri: string;
  size: number | null;
}): void {
  pending = {
    uri: input.uri,
    size: input.size,
    createdAt: Date.now(),
  };
}

/** Consume handoff once in Form. Returns null if missing/expired. */
export function consumePendingReceiptImage(): PendingReceiptImage | null {
  const value = pending;
  pending = null;
  if (!value) return null;
  // 5 minutes — safety against stale handoffs after abandoned flows
  if (Date.now() - value.createdAt > 5 * 60_000) return null;
  return value;
}
