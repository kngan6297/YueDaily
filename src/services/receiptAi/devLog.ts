/** Concise __DEV__ telemetry for receipt AI. Never log secrets, URIs, or base64. */

import { aiDevLog, sanitizeErrorCategory } from '../ai/devLog';

export { sanitizeErrorCategory };

export function receiptAiDevLog(
  stage: string,
  payload: Record<string, unknown> = {},
): void {
  aiDevLog('ReceiptAI', stage, payload);
}
