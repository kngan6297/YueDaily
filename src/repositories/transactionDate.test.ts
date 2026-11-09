import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCreatedAt, dateFromCreatedAt } from '../utils/date.ts';

describe('transaction_date local calendar semantics', () => {
  it('buildCreatedAt keeps local date prefix for backdated days', () => {
    assert.equal(dateFromCreatedAt(buildCreatedAt('2026-01-31')), '2026-01-31');
    assert.equal(dateFromCreatedAt(buildCreatedAt('2026-02-01')), '2026-02-01');
  });

  it('month boundary dates are distinct calendar days', () => {
    const a = '2026-01-31';
    const b = '2026-02-01';
    assert.notEqual(a, b);
    assert.ok(a < b);
  });
});
