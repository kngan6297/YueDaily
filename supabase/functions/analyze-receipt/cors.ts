/** Explicit CORS for analyze-receipt — never use wildcard "*". */

/**
 * DEV fallback when WEB_ALLOWED_ORIGINS secret is unset.
 * Prefer setting WEB_ALLOWED_ORIGINS explicitly (localhost + EAS preview origin).
 */
const DEV_DEFAULT_ORIGINS = [
  'http://localhost:8082',
  'http://localhost:8084',
  'https://yozakura--g5k9ewj06k.expo.app',
  'https://yozakura--gn4cjgf5za.expo.app',
] as const;

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) {
    return [...DEV_DEFAULT_ORIGINS];
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== '*');
}

export function resolveCorsOrigin(
  requestOrigin: string | null,
  allowed: readonly string[],
): string | null {
  if (!requestOrigin) return null;
  return allowed.includes(requestOrigin) ? requestOrigin : null;
}

export function corsHeaders(
  allowOrigin: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
  }
  return headers;
}
