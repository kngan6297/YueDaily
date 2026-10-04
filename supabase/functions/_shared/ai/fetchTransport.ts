// ============================================================
// Shared fetch transport classification (never log response bodies)
// ============================================================

/** Safe classification of a fetch() throw — never includes message text. */
export function describeFetchThrow(err: unknown): {
  errorName: string;
  category: string;
  aborted: boolean;
  messageLen: number;
} {
  const name =
    err && typeof err === 'object' && 'name' in err && (err as { name?: unknown }).name != null
      ? String((err as { name: unknown }).name)
      : 'Error';
  const messageLen =
    err instanceof Error
      ? err.message.length
      : typeof err === 'string'
        ? err.length
        : 0;
  const aborted = name === 'AbortError';
  let category = 'unknown';
  if (aborted) category = 'abort';
  else if (name === 'TypeError') category = 'type_error';
  else if (name === 'DOMException') category = 'dom_exception';
  else if (name === 'Error') category = 'error';
  return { errorName: name, category, aborted, messageLen };
}

/**
 * RN may throw TypeError after AbortController fires instead of AbortError.
 * Treat near-timeout + abort flag as timeout, not network_error.
 */
export function classifyTransportFailure(opts: {
  err: unknown;
  durationMs: number;
  abortedByTimeout: boolean;
  timeoutMs: number;
}): 'timeout' | 'network_error' {
  const desc = describeFetchThrow(opts.err);
  if (opts.abortedByTimeout || desc.aborted) return 'timeout';
  if (opts.durationMs >= opts.timeoutMs - 500) return 'timeout';
  return 'network_error';
}
