// ============================================================
// Shared AI env — EXPO_PUBLIC_* sanitization (never log values)
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
 * Expo inlines only static `process.env.EXPO_PUBLIC_*` property access.
 * Bracket / destructuring / dynamic names are NOT replaced in production bundles.
 */
export function loadAiEnvFromProcess(): AiEnvKeys {
  return {
    geminiKey: sanitizeExpoPublicValue(process.env.EXPO_PUBLIC_GEMINI_API_KEY),
    groqKey: sanitizeExpoPublicValue(process.env.EXPO_PUBLIC_GROQ_API_KEY),
  };
}

/** __DEV__ presence check only — never log values/lengths. */
export function logAiKeyPresence(env: AiEnvKeys, tag = '[AI CONFIG]'): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  console.log(tag, {
    groqKeyPresent: Boolean(env.groqKey),
    geminiKeyPresent: Boolean(env.geminiKey),
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
  'Dừng Metro rồi chạy lại: npx expo start --clear (EXPO_PUBLIC_* chỉ cập nhật khi bundle được build lại).';
