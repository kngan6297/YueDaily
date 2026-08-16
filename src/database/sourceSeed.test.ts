import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SOURCE_SEED_NAMES,
  DEFAULT_SOURCE_SEEDS,
  classifyTrustedSourceNames,
  missingSourceNames,
  missingSourceSeeds,
  spendingGroupForExactSourceName,
} from './sourceSeed.ts';

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

  it('does not seed VCB Shop / Tiền mặt / Chuyển khoản on fresh install', () => {
    const names = DEFAULT_SOURCE_SEED_NAMES as readonly string[];
    assert.ok(!names.includes('VCB Shop'));
    assert.ok(!names.includes('Tiền mặt'));
    assert.ok(!names.includes('Chuyển khoản'));
    assert.ok(!missingSourceNames([]).includes('VCB Shop'));
  });

  it('fresh seed includes spending_group for current sources', () => {
    const byName = Object.fromEntries(DEFAULT_SOURCE_SEEDS.map((s) => [s.name, s.spending_group]));
    assert.equal(byName['Woori · Quỹ ăn'], 'household');
    assert.equal(byName.VPBank, 'personal_yue');
    assert.equal(byName['Tiền mặt Yue'], 'personal_yue');
    assert.equal(byName['Tiền mặt Kai'], 'household');
    const fresh = missingSourceSeeds([]);
    assert.equal(fresh.length, 4);
    assert.ok(fresh.every((s) => s.spending_group === 'personal_yue' || s.spending_group === 'household'));
  });

  it('is idempotent — second pass inserts nothing', () => {
    const first = missingSourceNames([]);
    assert.deepEqual(first, [...DEFAULT_SOURCE_SEED_NAMES]);
    const second = missingSourceNames(first);
    assert.deepEqual(second, []);
  });

  it('classifies only exact trusted names — no fuzzy, no legacy seeds', () => {
    const classified = classifyTrustedSourceNames([
      { id: 1, name: 'VPBank' },
      { id: 2, name: 'VPBank Yue' },
      { id: 3, name: 'Tiền mặt Yue' },
      { id: 4, name: 'Tiền mặt' },
      { id: 5, name: 'Woori · Quỹ ăn' },
      { id: 6, name: 'Tiền mặt Kai' },
      { id: 7, name: 'VCB Shop' },
      { id: 8, name: 'Chuyển khoản' },
    ]);
    assert.deepEqual(
      classified.map((c) => [c.id, c.spending_group]),
      [
        [1, 'personal_yue'],
        [3, 'personal_yue'],
        [5, 'household'],
        [6, 'household'],
      ],
    );
    assert.equal(spendingGroupForExactSourceName('VCB Shop'), null);
    assert.equal(spendingGroupForExactSourceName('Tiền mặt'), null);
    assert.equal(spendingGroupForExactSourceName('Chuyển khoản'), null);
    assert.equal(spendingGroupForExactSourceName('VPBank Yue'), null);
  });

  it('v3 preserves stored group; v1/v2 would reclassify exact names only', () => {
    const renamedPersonal = { id: 1, name: 'VPBank Yue', spending_group: 'personal_yue' as const };
    assert.equal(spendingGroupForExactSourceName(renamedPersonal.name), null);
    assert.equal(renamedPersonal.spending_group, 'personal_yue');
    const v2Rows = [
      { id: 1, name: 'VPBank' },
      { id: 2, name: 'VCB Shop' },
    ];
    assert.deepEqual(classifyTrustedSourceNames(v2Rows), [{ id: 1, spending_group: 'personal_yue' }]);
  });
});
