import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sortCategoriesByUsage } from './categoryUsage.ts';

describe('P1.5.2 category usage ordering', () => {
  it('orders by usage_count DESC then name ASC, zero-use last', () => {
    const rows = [
      { name: 'Gia đình', usage_count: 0, amount: 0 },
      { name: 'Giáo dục', usage_count: 0, amount: 0 },
      { name: 'Di chuyển', usage_count: 1, amount: 9_000_000 },
      { name: 'Giải trí', usage_count: 3, amount: 50_000 },
      { name: 'Mua sắm', usage_count: 8, amount: 200_000 },
      { name: 'Ăn uống', usage_count: 20, amount: 10_000 },
    ];
    const ordered = sortCategoriesByUsage(rows).map((r) => r.name);
    assert.deepEqual(ordered, [
      'Ăn uống',
      'Mua sắm',
      'Giải trí',
      'Di chuyển',
      'Gia đình',
      'Giáo dục',
    ]);
  });

  it('does not sort by amount', () => {
    const rows = [
      { name: 'High amount once', usage_count: 1, amount: 5_000_000 },
      { name: 'Low amount often', usage_count: 10, amount: 15_000 },
    ];
    const ordered = sortCategoriesByUsage(rows).map((r) => r.name);
    assert.deepEqual(ordered, ['Low amount often', 'High amount once']);
  });

  it('ties on usage_count sort by name', () => {
    const rows = [
      { name: 'Category B', usage_count: 5 },
      { name: 'Category A', usage_count: 5 },
    ];
    const ordered = sortCategoriesByUsage(rows).map((r) => r.name);
    assert.deepEqual(ordered, ['Category A', 'Category B']);
  });
});
