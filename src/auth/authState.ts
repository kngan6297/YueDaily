// ============================================================
// P2.1 — Pure Web auth UI state derivation (no network)
// ============================================================

import type { SupabaseEnvStatus } from '../services/supabase/env';

export type WebAuthUiState =
  | {
      kind: 'config_required';
      reason: 'missing_url' | 'missing_anon_key' | 'missing_both';
    }
  | { kind: 'loading' }
  | { kind: 'signed_out' }
  | { kind: 'signed_in'; email: string | null; userId: string };

export interface WebAuthSessionSnapshot {
  userId: string;
  email: string | null;
}

/**
 * Map env + session bootstrap into a single UI state for the Web foundation shell.
 */
export function deriveWebAuthUiState(input: {
  env: SupabaseEnvStatus;
  sessionLoading: boolean;
  session: WebAuthSessionSnapshot | null;
}): WebAuthUiState {
  if (input.env.status === 'missing_both') {
    return { kind: 'config_required', reason: 'missing_both' };
  }
  if (input.env.status === 'missing_url') {
    return { kind: 'config_required', reason: 'missing_url' };
  }
  if (input.env.status === 'missing_anon_key') {
    return { kind: 'config_required', reason: 'missing_anon_key' };
  }

  if (input.sessionLoading) return { kind: 'loading' };
  if (!input.session) return { kind: 'signed_out' };

  return {
    kind: 'signed_in',
    userId: input.session.userId,
    email: input.session.email,
  };
}

/** Mask email for UI — never show raw tokens. */
export function maskEmail(email: string | null | undefined): string {
  const value = (email ?? '').trim();
  if (!value) return '(không có email)';
  const at = value.indexOf('@');
  if (at <= 0) return '***';
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const head = local.slice(0, 1);
  return `${head}***@${domain}`;
}
