export interface ReceiptAiEnvKeys {
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
 * Bracket / destructuring / dynamic names are NOT replaced in production bundles
 * (Expo Go still works because dotenv fills process.env at runtime).
 */
export function loadReceiptAiEnvFromProcess(): ReceiptAiEnvKeys {
  return {
    geminiKey: sanitizeExpoPublicValue(process.env.EXPO_PUBLIC_GEMINI_API_KEY),
    groqKey: sanitizeExpoPublicValue(process.env.EXPO_PUBLIC_GROQ_API_KEY),
  };
}

/** __DEV__ presence check only — never log values/lengths. */
export function logReceiptAiKeyPresence(env: ReceiptAiEnvKeys): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  console.log('[AI CONFIG]', {
    groqKeyPresent: Boolean(env.groqKey),
    geminiKeyPresent: Boolean(env.geminiKey),
  });
}

export function hasAnyReceiptAiKey(env: ReceiptAiEnvKeys): boolean {
  return Boolean(env.geminiKey || env.groqKey);
}

export function hasGeminiReceiptKey(env: ReceiptAiEnvKeys): boolean {
  return Boolean(env.geminiKey);
}

export function hasGroqReceiptKey(env: ReceiptAiEnvKeys): boolean {
  return Boolean(env.groqKey);
}

export const METRO_ENV_RESTART_HINT =
  'Dừng Metro rồi chạy lại: npx expo start --clear (EXPO_PUBLIC_* chỉ cập nhật khi bundle được build lại).';
