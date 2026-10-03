// ============================================================
// P2.1 — Web-only Supabase browser client (anon key + RLS)
// Never import this module from Android runtime paths.
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, loadSupabaseEnvFromProcess } from './env';

let cached: SupabaseClient | null = null;

/**
 * Returns a browser Supabase client when public env is configured.
 * Missing config → null (UI shows configuration-required; no throw).
 */
export function getSupabaseClient(): SupabaseClient | null {
  const env = loadSupabaseEnvFromProcess();
  if (!isSupabaseConfigured(env)) {
    cached = null;
    return null;
  }

  if (!cached) {
    cached = createClient(env.url, env.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return cached;
}

/** Test helper — clears module singleton between cases. */
export function __resetSupabaseClientForTests(): void {
  cached = null;
}
