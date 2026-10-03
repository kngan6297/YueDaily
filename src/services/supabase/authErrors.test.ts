import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  authErrorMessageVi,
  classifyAuthError,
  normalizeAuthErrorMessage,
} from './authErrors.ts';

describe('supabase auth error normalization', () => {
  it('classifies invalid credentials', () => {
    assert.equal(
      classifyAuthError({ message: 'Invalid login credentials', status: 400 }),
      'invalid_credentials',
    );
    assert.match(normalizeAuthErrorMessage({ message: 'Invalid login credentials' }), /Email/);
  });

  it('classifies network and rate limit', () => {
    assert.equal(classifyAuthError(new Error('Failed to fetch')), 'network');
    assert.equal(classifyAuthError({ message: 'Too many requests', status: 429 }), 'rate_limited');
  });

  it('never echoes raw payloads in VI messages', () => {
    const msg = authErrorMessageVi('unknown');
    assert.equal(msg.includes('stack'), false);
    assert.equal(msg.includes('JWT'), false);
  });
});
