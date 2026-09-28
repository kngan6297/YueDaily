import type { AiEnvKeys } from '../ai/env';
import {
  hasAnyAiKey,
  hasGeminiAiKey,
  hasGroqAiKey,
  loadAiEnvFromProcess,
  logAiKeyPresence,
  METRO_ENV_RESTART_HINT,
  sanitizeExpoPublicValue,
} from '../ai/env';

export { sanitizeExpoPublicValue, METRO_ENV_RESTART_HINT };

export type ReceiptAiEnvKeys = AiEnvKeys;

export function loadReceiptAiEnvFromProcess(): ReceiptAiEnvKeys {
  return loadAiEnvFromProcess();
}

export function logReceiptAiKeyPresence(env: ReceiptAiEnvKeys): void {
  logAiKeyPresence(env, '[AI CONFIG]');
}

export function hasAnyReceiptAiKey(env: ReceiptAiEnvKeys): boolean {
  return hasAnyAiKey(env);
}

export function hasGeminiReceiptKey(env: ReceiptAiEnvKeys): boolean {
  return hasGeminiAiKey(env);
}

export function hasGroqReceiptKey(env: ReceiptAiEnvKeys): boolean {
  return hasGroqAiKey(env);
}
