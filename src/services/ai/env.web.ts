// ============================================================
// Web AI env — never read EXPO_PUBLIC_GROQ/GEMINI (Edge holds secrets).
// Native `env.ts` keeps P1.7A EXPO_PUBLIC_* for Android.
// ============================================================

export interface AiEnvKeys {
  geminiKey: string;
  groqKey: string;
}

/** Sanitize EXPO_PUBLIC value — never log the result. */
export function sanitizeExpoPublicValue(raw: string | undefined): string {
  if (raw == null) return '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return '';
  return trimmed;
}

/**
 * Web must not inline provider keys. Receipt AI uses Supabase Edge (P2.3).
 * Spending Chat cloud is deferred (P2.4).
 */
export function loadAiEnvFromProcess(): AiEnvKeys {
  return { geminiKey: '', groqKey: '' };
}

/** __DEV__ presence check only — never log values/lengths. */
export function logAiKeyPresence(env: AiEnvKeys, tag = '[AI CONFIG]'): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  console.log(tag, {
    groqKeyPresent: Boolean(env.groqKey),
    geminiKeyPresent: Boolean(env.geminiKey),
    webEdgeProxy: true,
  });
}

export function hasAnyAiKey(env: AiEnvKeys): boolean {
  return Boolean(env.geminiKey || env.groqKey);
}

export function hasGeminiAiKey(env: AiEnvKeys): boolean {
  return Boolean(env.geminiKey);
}

export function hasGroqAiKey(env: AiEnvKeys): boolean {
  return Boolean(env.groqKey);
}

export const METRO_ENV_RESTART_HINT =
  'Web dùng Edge Function analyze-receipt — không cần EXPO_PUBLIC_GROQ/GEMINI trên browser.';
