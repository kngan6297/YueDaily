// P1.7A — centralized receipt AI provider configuration

export const RECEIPT_AI_TIMEOUT_MS = 20_000;
export const RECEIPT_AI_RETRY_DELAY_MS = 3_500;

export const GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';

/** Verified image-capable models (primary → fallback) */
export const GEMINI_RECEIPT_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
] as const;

export type GeminiReceiptModel = (typeof GEMINI_RECEIPT_MODELS)[number];

/**
 * Groq receipt vision is disabled (P1.7A).
 * Account model list (2026-03) has no image-capable model; qwen/qwen3.6-27b → HTTP 404.
 */
export const GROQ_RECEIPT_VISION_ENABLED = false;

export const ENV_GEMINI_KEY = 'EXPO_PUBLIC_GEMINI_API_KEY';
export const ENV_GROQ_KEY = 'EXPO_PUBLIC_GROQ_API_KEY';
