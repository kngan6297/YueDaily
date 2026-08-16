import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SOURCE_SEED_NAMES, missingSourceNames } from './sourceSeed.ts';

describe('source seed P1.5', () => {
  it('keeps Tiền mặt Yue and Tiền mặt Kai as distinct names', () => {
    assert.ok(DEFAULT_SOURCE_SEED_NAMES.includes('Tiền mặt Yue'));
    assert.ok(DEFAULT_SOURCE_SEED_NAMES.includes('Tiền mặt Kai'));
    assert.equal(
      DEFAULT_SOURCE_SEED_NAMES.filter((n) => n === 'Tiền mặt').length,
      0,
    );
  });

  it('does not merge or rename historical sources on existing DB', () => {
    const existing = ['Tiền mặt', 'Chuyển khoản', 'VCB Shop'];
    const toAdd = missingSourceNames(existing);
    assert.ok(!toAdd.includes('VCB Shop'));
    assert.ok(toAdd.includes('Woori · Quỹ ăn'));
    assert.ok(toAdd.includes('Tiền mặt Yue'));
    assert.ok(toAdd.includes('Tiền mặt Kai'));
    assert.ok(toAdd.includes('VPBank'));
    assert.deepEqual(existing, ['Tiền mặt', 'Chuyển khoản', 'VCB Shop']);
  });

  it('is idempotent — second pass inserts nothing', () => {
    const first = missingSourceNames([]);
    assert.deepEqual(first, [...DEFAULT_SOURCE_SEED_NAMES]);
    const second = missingSourceNames(first);
    assert.deepEqual(second, []);
  });
});
