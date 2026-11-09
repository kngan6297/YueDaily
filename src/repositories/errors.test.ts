import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DataError, normalizeDataError, userMessageForDataError } from './errors.ts';

describe('normalizeDataError', () => {
  it('maps SQLite unique violation to duplicate', () => {
    const err = normalizeDataError(
      new Error('Call to function NativeStatement.finalizeAsync has been rejected. Caused by: UNIQUE constraint failed: sources.name'),
      'sources',
    );
    assert.equal(err.code, 'duplicate');
    assert.match(err.message, /tên/i);
  });

  it('maps SQLite FK violation to referenced', () => {
    const err = normalizeDataError(new Error('FOREIGN KEY constraint failed'), 'sources');
    assert.equal(err.code, 'referenced');
  });

  it('maps NOT NULL violation to validation', () => {
    const err = normalizeDataError(new Error('NOT NULL constraint failed: categories.name'), 'categories');
    assert.equal(err.code, 'validation');
  });

  it('falls back to unknown for other errors', () => {
    assert.equal(normalizeDataError('boom', 'reports').code, 'unknown');
  });

  it('preserves DataError instances', () => {
    const original = new DataError('validation', 'transactions', 'bad');
    assert.equal(normalizeDataError(original, 'other'), original);
  });

  it('userMessageForDataError never returns raw SQLite text', () => {
    const msg = userMessageForDataError(new Error('UNIQUE constraint failed: sources.name'), 'sources');
    assert.doesNotMatch(msg, /constraint/i);
    assert.doesNotMatch(msg, /sources\.name/);
  });
});
