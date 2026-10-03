// ============================================================
// P2.1 — Supabase public env contract (names only; never log values)
// ============================================================

export const ENV_SUPABASE_URL = 'EXPO_PUBLIC_SUPABASE_URL';
export const ENV_SUPABASE_ANON_KEY = 'EXPO_PUBLIC_SUPABASE_ANON_KEY';
/** Dashboard "publishable" key alias — same public client role as anon key. */
export const ENV_SUPABASE_PUBLISHABLE_KEY = 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY';

export type SupabaseEnvStatus =
  | { status: 'configured'; url: string; anonKey: string }
  | { status: 'missing_url'; anonKeyPresent: boolean }
  | { status: 'missing_anon_key'; urlPresent: boolean }
  | { status: 'missing_both' };

/** Sanitize EXPO_PUBLIC value — never log the result. */
export function sanitizeExpoPublicValue(raw: string | undefined): string {
  if (raw == null) return '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return '';
  return trimmed;
}

/**
 * Pure resolver for unit tests and process.env loading.
 * Expo inlines only static `process.env.EXPO_PUBLIC_*` property access.
 */
export function resolveSupabaseEnv(raw: {
  url?: string;
  anonKey?: string;
}): SupabaseEnvStatus {
  const url = sanitizeExpoPublicValue(raw.url);
  const anonKey = sanitizeExpoPublicValue(raw.anonKey);
  const urlPresent = Boolean(url);
  const anonKeyPresent = Boolean(anonKey);

  if (urlPresent && anonKeyPresent) {
    return { status: 'configured', url, anonKey };
  }
  if (!urlPresent && !anonKeyPresent) return { status: 'missing_both' };
  if (!urlPresent) return { status: 'missing_url', anonKeyPresent };
  return { status: 'missing_anon_key', urlPresent };
}

export function loadSupabaseEnvFromProcess(): SupabaseEnvStatus {
  // Expo inlines only static EXPO_PUBLIC_* property access.
  // Prefer ANON_KEY; accept PUBLISHABLE_KEY as dashboard-compatible alias.
  const anonKey =
    sanitizeExpoPublicValue(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) ||
    sanitizeExpoPublicValue(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return resolveSupabaseEnv({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey,
  });
}

export function isSupabaseConfigured(
  env: SupabaseEnvStatus,
): env is Extract<SupabaseEnvStatus, { status: 'configured' }> {
  return env.status === 'configured';
}
