/** Edge receipt env shape — keys come from Deno.env secrets, not EXPO_PUBLIC. */

export const METRO_ENV_RESTART_HINT =
  'Cấu hình lại Edge secrets GROQ_API_KEY / GEMINI_API_KEY rồi thử lại.';

export interface ReceiptAiEnvKeys {
  geminiKey: string;
  groqKey: string;
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

export function loadReceiptAiEnvFromDenoEnv(
  getEnv: (name: string) => string | undefined = (n) => Deno.env.get(n),
): ReceiptAiEnvKeys {
  const sanitize = (raw: string | undefined) => {
    if (raw == null) return '';
    const trimmed = raw.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return '';
    return trimmed;
  };
  return {
    groqKey: sanitize(getEnv('GROQ_API_KEY')),
    geminiKey: sanitize(getEnv('GEMINI_API_KEY')),
  };
}
