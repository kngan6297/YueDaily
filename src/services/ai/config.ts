// ============================================================
// Shared text AI provider configuration (P1.8A spending chat)
// ============================================================

export const GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** P1.8A text chain: Groq Qwen → Gemini Flash-Lite → Gemini Flash */
export const GROQ_TEXT_MODEL = 'qwen/qwen3.8-27b' as const;

export const GEMINI_TEXT_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
] as const;

export type GeminiTextModel = (typeof GEMINI_TEXT_MODELS)[number];

/** Chat answers need more room than receipt JSON extraction (128). */
export const TEXT_AI_MAX_OUTPUT_TOKENS = 1024;
export const TEXT_AI_TIMEOUT_MS = 25_000;
export const GROQ_TEXT_TIMEOUT_MS = 12_000;
export const TEXT_AI_RETRY_DELAY_MS = 3_500;

export const TEXT_AI_PROVIDER_ORDER: 'groq_first' = 'groq_first';

export const ENV_GEMINI_KEY = 'EXPO_PUBLIC_GEMINI_API_KEY';
export const ENV_GROQ_KEY = 'EXPO_PUBLIC_GROQ_API_KEY';
