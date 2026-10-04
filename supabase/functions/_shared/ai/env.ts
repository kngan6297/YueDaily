// Edge-safe stub — no EXPO_PUBLIC / process.env Metro inlining.
export const METRO_ENV_RESTART_HINT =
  'Cấu hình lại Edge secrets GROQ_API_KEY / GEMINI_API_KEY rồi thử lại.';

export function sanitizeExpoPublicValue(raw: string | undefined): string {
  if (raw == null) return '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return '';
  return trimmed;
}
