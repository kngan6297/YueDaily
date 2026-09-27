// P1.7A — centralized receipt AI provider configuration

export const RECEIPT_AI_TIMEOUT_MS = 20_000;
export const RECEIPT_AI_RETRY_DELAY_MS = 3_500;

/**
 * Preprocess resize width. Keep 1024 until live A/B proves 768 is equal-accuracy
 * and materially faster. Flip to 768 only for controlled benchmarks.
 */
export const RECEIPT_AI_RESIZE_WIDTH = 1024 as 768 | 1024;
export const RECEIPT_AI_JPEG_QUALITY = 0.7;

/** Tight ceiling for compact JSON: is_receipt, amount, description≤50, category. */
export const RECEIPT_AI_MAX_OUTPUT_TOKENS = 128;

export const GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';

/** Verified image-capable models (primary → fallback) */
export const GEMINI_RECEIPT_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
] as const;

export type GeminiReceiptModel = (typeof GEMINI_RECEIPT_MODELS)[number];

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Groq Qwen 3.8 vision — live-probed 200 with valid JPEG + reasoning_effort none.
 * Do NOT use qwen/qwen3.6-27b (preview volatility / 404).
 */
export const GROQ_RECEIPT_MODEL = 'qwen/qwen3.8-27b' as const;

/** Groq is expected to be fast; fail sooner so Gemini fallback stays usable. */
export const GROQ_RECEIPT_TIMEOUT_MS = 8_000;
export const GROQ_RECEIPT_MAX_COMPLETION_TOKENS = 128;

/**
 * Vision path is implemented and probed. Keep enabled so fallback/benchmark can use it.
 * Production order is controlled separately below.
 */
export const GROQ_RECEIPT_VISION_ENABLED = true;

/**
 * Production order: Groq Qwen 3.8 Vision → Gemini Flash-Lite → Gemini Flash.
 * Groq failures fall through to Gemini when configured.
 */
export const RECEIPT_AI_PROVIDER_ORDER: 'gemini_first' | 'groq_first' =
  'groq_first';

export const ENV_GEMINI_KEY = 'EXPO_PUBLIC_GEMINI_API_KEY';
export const ENV_GROQ_KEY = 'EXPO_PUBLIC_GROQ_API_KEY';
