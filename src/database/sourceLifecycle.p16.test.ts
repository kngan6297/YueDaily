import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldRunLegacyTrustedBackfillAfterRestore,
  shouldRunP16TrustedBackfillOnStartup,
} from './p16MigrationLifecycle.ts';
import {
  shouldClassifyTrustedSpendingGroupsAfterRestore,
} from './sourceLifecycle.ts';

describe('restore lifecycle flags P1.6', () => {
  it('v1/v2 classify spending groups; v3 does not full reclassify', () => {
    assert.equal(shouldClassifyTrustedSpendingGroupsAfterRestore('1'), true);
    assert.equal(shouldClassifyTrustedSpendingGroupsAfterRestore('2'), true);
    assert.equal(shouldClassifyTrustedSpendingGroupsAfterRestore('3'), false);
    assert.equal(shouldClassifyTrustedSpendingGroupsAfterRestore('4'), false);
  });

  it('legacy trusted backfill runs for v1–v3 restore only', () => {
    assert.equal(shouldRunLegacyTrustedBackfillAfterRestore('1'), true);
    assert.equal(shouldRunLegacyTrustedBackfillAfterRestore('3'), true);
    assert.equal(shouldRunLegacyTrustedBackfillAfterRestore('4'), false);
  });

  it('normal startup skips trusted backfill once marker is complete', () => {
    assert.equal(shouldRunP16TrustedBackfillOnStartup(false), true);
    assert.equal(shouldRunP16TrustedBackfillOnStartup(true), false);
  });
});
