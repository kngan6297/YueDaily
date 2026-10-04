import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../services/supabase/client.web';
import { DataError } from './errors';

export function requireSupabaseClient(): SupabaseClient {
  const client = getSupabaseClient();
  if (!client) {
    throw new DataError('unauthorized', 'supabase', 'Chưa cấu hình Supabase.');
  }
  return client;
}
