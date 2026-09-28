// ============================================================
// Shared fetchWithTimeout — AbortController + transport classify
// ============================================================

import { classifyTransportFailure } from './fetchTransport';
import { textAiErrorFromKind, type AiProviderErrorKind } from './errors';

export interface FetchWithTimeoutResult {
  response: Response;
  durationMs: number;
}

export class TransportTimeoutError extends Error {
  readonly kind: AiProviderErrorKind;

  constructor(kind: 'timeout' | 'network_error', message?: string) {
    super(message ?? kind);
    this.name = 'TransportTimeoutError';
    this.kind = kind;
  }
}

/**
 * Fetch with AbortController timeout.
 * Throws TextAiError-compatible TransportTimeoutError on transport failure.
 */
export async function fetchWithTimeout(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<FetchWithTimeoutResult> {
  const ctrl = new AbortController();
  let abortedByTimeout = false;
  const started = Date.now();
  const timer = setTimeout(() => {
    abortedByTimeout = true;
    ctrl.abort();
  }, timeoutMs);
  try {
    const response = await fetchFn(url, { ...init, signal: ctrl.signal });
    return { response, durationMs: Date.now() - started };
  } catch (err) {
    const durationMs = Date.now() - started;
    const kind = classifyTransportFailure({
      err,
      durationMs,
      abortedByTimeout,
      timeoutMs,
    });
    throw textAiErrorFromKind(kind, { feature: 'chat' });
  } finally {
    clearTimeout(timer);
  }
}
