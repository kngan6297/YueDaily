import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SPEND_THRESHOLDS as T,
  formatCompactVnd,
  isValidThresholds,
  spendTier,
} from './spendHeat.ts';

describe('spendTier', () => {
  it('maps amounts to Monii-style tiers', () => {
    assert.equal(spendTier(0, T), 'none');
    assert.equal(spendTier(-5, T), 'none');
    assert.equal(spendTier(99_999, T), 'low');
    assert.equal(spendTier(100_000, T), 'mid');
    assert.equal(spendTier(500_000, T), 'mid');
    assert.equal(spendTier(500_001, T), 'high');
  });
});

describe('isValidThresholds', () => {
  it('requires 0 < low < high', () => {
    assert.equal(isValidThresholds(T), true);
    assert.equal(isValidThresholds({ low: 0, high: 10 }), false);
    assert.equal(isValidThresholds({ low: 500, high: 500 }), false);
    assert.equal(isValidThresholds({ low: NaN, high: 10 }), false);
  });
});

describe('formatCompactVnd', () => {
  it('keeps calendar labels short', () => {
    assert.equal(formatCompactVnd(500), '500');
    assert.equal(formatCompactVnd(31_000), '31k');
    assert.equal(formatCompactVnd(218_400), '218k');
    assert.equal(formatCompactVnd(999_600), '1M');
    assert.equal(formatCompactVnd(1_000_000), '1M');
    assert.equal(formatCompactVnd(1_250_000), '1.3M');
    assert.equal(formatCompactVnd(5_000_000), '5M');
    assert.equal(formatCompactVnd(12_400_000), '12M');
  });
});
