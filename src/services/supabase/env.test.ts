import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveSupabaseEnv } from './env.ts';

describe('supabase env contract', () => {
  it('accepts configured url + anon key', () => {
    const env = resolveSupabaseEnv({
      url: ' https://example.supabase.co ',
      anonKey: ' anon-key ',
    });
    assert.equal(env.status, 'configured');
    if (env.status === 'configured') {
      assert.equal(env.url, 'https://example.supabase.co');
      assert.equal(env.anonKey, 'anon-key');
    }
  });

  it('detects missing both', () => {
    assert.equal(resolveSupabaseEnv({}).status, 'missing_both');
    assert.equal(resolveSupabaseEnv({ url: 'null', anonKey: 'undefined' }).status, 'missing_both');
  });

  it('detects missing url only', () => {
    const env = resolveSupabaseEnv({ anonKey: 'anon' });
    assert.equal(env.status, 'missing_url');
    if (env.status === 'missing_url') assert.equal(env.anonKeyPresent, true);
  });

  it('detects missing anon key only', () => {
    const env = resolveSupabaseEnv({ url: 'https://example.supabase.co' });
    assert.equal(env.status, 'missing_anon_key');
    if (env.status === 'missing_anon_key') assert.equal(env.urlPresent, true);
  });

  it('treats publishable-key-shaped value as configured client key', () => {
    const env = resolveSupabaseEnv({
      url: 'https://example.supabase.co',
      anonKey: 'sb_publishable_example',
    });
    assert.equal(env.status, 'configured');
  });
});
