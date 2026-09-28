/** Concise __DEV__ telemetry for shared AI. Never log secrets, chat content, or payloads. */

export function aiDevLog(
  scope: string,
  stage: string,
  payload: Record<string, unknown> = {},
): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  console.log(`[${scope}] ${stage}`, payload);
}

export function sanitizeErrorCategory(err: unknown): {
  name: string;
  kind?: string;
  messageLen: number;
} {
  if (err && typeof err === 'object' && 'kind' in err) {
    const e = err as { name?: string; kind?: string; message?: string };
    return {
      name: e.name ?? 'Error',
      kind: typeof e.kind === 'string' ? e.kind : undefined,
      messageLen: typeof e.message === 'string' ? e.message.length : 0,
    };
  }
  if (err instanceof Error) {
    return { name: err.name, messageLen: err.message.length };
  }
  return { name: 'unknown', messageLen: 0 };
}
