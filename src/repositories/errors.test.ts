import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DataError, normalizeDataError, userMessageForDataError } from './errors.ts';

describe('normalizeDataError', () => {
  it('maps unique violation to duplicate', () => {
    const err = normalizeDataError({ code: '23505', message: 'duplicate key' }, 'sources');
    assert.equal(err.code, 'duplicate');
    assert.match(err.message, /tên/i);
    assert.doesNotMatch(err.message, /duplicate key/i);
  });

  it('maps FK violation to referenced', () => {
    const err = normalizeDataError({ code: '23503' }, 'sources');
    assert.equal(err.code, 'referenced');
  });

  it('maps auth/session failures', () => {
    const err = normalizeDataError({ status: 401, message: 'JWT expired' }, 'transactions');
    assert.equal(err.code, 'unauthorized');
    assert.doesNotMatch(err.message, /JWT/i);
  });

  it('maps network TypeError', () => {
    const err = normalizeDataError(Object.assign(new TypeError('Failed to fetch'), { name: 'TypeError' }), 'reports');
    assert.equal(err.code, 'network');
  });

  it('preserves DataError instances', () => {
    const original = new DataError('validation', 'transactions', 'bad');
    assert.equal(normalizeDataError(original, 'other'), original);
  });

  it('userMessageForDataError never returns raw postgres text', () => {
    const msg = userMessageForDataError({ code: '23505', message: 'unique_violation sources_user_id_name_key' }, 'sources');
    assert.doesNotMatch(msg, /unique_violation/);
    assert.doesNotMatch(msg, /sources_user_id/);
  });
});
