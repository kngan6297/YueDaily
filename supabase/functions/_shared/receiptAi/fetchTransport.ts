import { RECEIPT_AI_TIMEOUT_MS } from './config.ts';
import {
  classifyTransportFailure as classifySharedTransportFailure,
  describeFetchThrow,
} from '../ai/fetchTransport.ts';

export { describeFetchThrow };

/**
 * RN may throw TypeError after AbortController fires instead of AbortError.
 * Treat near-timeout + abort flag as timeout, not network_error.
 */
export function classifyTransportFailure(opts: {
  err: unknown;
  durationMs: number;
  abortedByTimeout: boolean;
  timeoutMs?: number;
}): 'timeout' | 'network_error' {
  return classifySharedTransportFailure({
    err: opts.err,
    durationMs: opts.durationMs,
    abortedByTimeout: opts.abortedByTimeout,
    timeoutMs: opts.timeoutMs ?? RECEIPT_AI_TIMEOUT_MS,
  });
}
