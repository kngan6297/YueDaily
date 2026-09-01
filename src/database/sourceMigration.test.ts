import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VCB_SHOP_EXACT_NAME } from './sourceMigration.ts';
import { spendingGroupForExactSourceName } from './sourceSeed.ts';

describe('P1.6 VCB Shop migration semantics', () => {
  it('runtime trusted-name map does not include VCB Shop (migration-only)', () => {
    assert.equal(spendingGroupForExactSourceName(VCB_SHOP_EXACT_NAME), null);
    assert.equal(spendingGroupForExactSourceName('VPBank'), 'personal_yue');
    assert.equal(spendingGroupForExactSourceName('Tiền mặt Kai'), 'household');
  });

  it('documents conservative SQL predicate for one-time migration', () => {
    const sql =
      "UPDATE sources SET spending_group = 'household' WHERE name = 'VCB Shop' AND spending_group IS NULL";
    assert.match(sql, /spending_group IS NULL/);
    assert.match(sql, /VCB Shop/);
  });
});
