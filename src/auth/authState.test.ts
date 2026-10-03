import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deriveWebAuthUiState, maskEmail } from './authState.ts';

describe('web auth UI state', () => {
  it('requires config when env missing', () => {
    const ui = deriveWebAuthUiState({
      env: { status: 'missing_both' },
      sessionLoading: true,
      session: null,
    });
    assert.deepEqual(ui, { kind: 'config_required', reason: 'missing_both' });
  });

  it('shows loading then signed_out / signed_in', () => {
    const loading = deriveWebAuthUiState({
      env: { status: 'configured', url: 'https://x', anonKey: 'y' },
      sessionLoading: true,
      session: null,
    });
    assert.equal(loading.kind, 'loading');

    const out = deriveWebAuthUiState({
      env: { status: 'configured', url: 'https://x', anonKey: 'y' },
      sessionLoading: false,
      session: null,
    });
    assert.equal(out.kind, 'signed_out');

    const inn = deriveWebAuthUiState({
      env: { status: 'configured', url: 'https://x', anonKey: 'y' },
      sessionLoading: false,
      session: { userId: 'u1', email: 'meo@example.com' },
    });
    assert.equal(inn.kind, 'signed_in');
    if (inn.kind === 'signed_in') {
      assert.equal(inn.userId, 'u1');
      assert.equal(inn.email, 'meo@example.com');
    }
  });

  it('masks email identity', () => {
    assert.equal(maskEmail('meo@example.com'), 'm***@example.com');
    assert.equal(maskEmail(null), '(không có email)');
  });
});
