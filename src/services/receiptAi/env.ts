import { ENV_GEMINI_KEY, ENV_GROQ_KEY } from './config';

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

export function loadReceiptAiEnvFromProcess(): ReceiptAiEnvKeys {
  return {
    geminiKey: sanitizeExpoPublicValue(process.env[ENV_GEMINI_KEY]),
    groqKey: sanitizeExpoPublicValue(process.env[ENV_GROQ_KEY]),
  };
}

export function hasAnyReceiptAiKey(env: ReceiptAiEnvKeys): boolean {
  return Boolean(env.geminiKey || env.groqKey);
}

export function hasGeminiReceiptKey(env: ReceiptAiEnvKeys): boolean {
  return Boolean(env.geminiKey);
}

export const METRO_ENV_RESTART_HINT =
  'Dừng Metro rồi chạy lại: npx expo start --clear (EXPO_PUBLIC_* chỉ cập nhật khi bundle được build lại).';
