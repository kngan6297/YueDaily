/** Edge-safe telemetry — never log secrets, image bytes, or financial fields. */

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

export function receiptAiDevLog(
  stage: string,
  payload: Record<string, unknown> = {},
): void {
  // Safe categories only — callers must not pass image/base64/financial content.
  console.log(`[ReceiptAI] ${stage}`, payload);
}
