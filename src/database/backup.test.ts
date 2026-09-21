import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_BACKUP_VERSION,
  validateBackupPayload,
} from './backupValidation.ts';
import { FIRST_HOUSEHOLD_FOOD_PERIOD } from '../constants/budget.ts';
import { shouldRunFirstPeriodBudgetSeedsAfterRestore } from './sourceLifecycle.ts';

function minimalV3Backup(overrides: Record<string, unknown> = {}) {
  return {
    appVersion: '1.0.0',
    backupVersion: '3',
    created_at: new Date().toISOString(),
    transactions: [],
    categories: [
      {
        id: 1,
        name: 'Ăn uống',
        type: 'chi',
        icon: '🍜',
        color: '#FF8FAB',
      },
    ],
    sources: [
      {
        id: 1,
        name: 'VCB Shop',
        is_active: 0,
        spending_group: null,
      },
    ],
    streak: null,
    ...overrides,
  };
}

function minimalV4Backup(overrides: Record<string, unknown> = {}) {
  return {
    appVersion: '1.0.0',
    backupVersion: '4',
    created_at: new Date().toISOString(),
    transactions: [],
    categories: [
      {
        id: 1,
        name: 'Ăn uống',
        type: 'chi',
        icon: '🍜',
        color: '#FF8FAB',
        budget_group: 'household_food',
      },
    ],
    sources: [
      {
        id: 1,
        name: 'Woori · Quỹ ăn',
        is_active: 1,
        spending_group: 'household',
      },
    ],
    budget_periods: [
      {
        id: 1,
        budget_key: 'household_food',
        period_start: FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
        period_end: FIRST_HOUSEHOLD_FOOD_PERIOD.period_end,
        limit_amount: FIRST_HOUSEHOLD_FOOD_PERIOD.limit_amount,
        carryover_amount: FIRST_HOUSEHOLD_FOOD_PERIOD.carryover_amount,
        created_at: '2026-09-01 00:00:00',
        updated_at: '2026-09-01 00:00:00',
      },
    ],
    ...overrides,
  };
}

function minimalV5Backup(overrides: Record<string, unknown> = {}) {
  return {
    appVersion: '1.0.0',
    backupVersion: '5',
    created_at: new Date().toISOString(),
    transactions: [],
    categories: [
      {
        id: 1,
        name: 'Ăn uống',
        type: 'chi',
        icon: '🍜',
        color: '#FF8FAB',
        budget_group: 'household_food',
      },
    ],
    sources: [
      {
        id: 7,
        name: 'Woori · Quỹ ăn',
        is_active: 1,
        spending_group: 'household',
      },
    ],
    budget_periods: [
      {
        id: 1,
        budget_key: 'household_food',
        period_start: FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
        period_end: FIRST_HOUSEHOLD_FOOD_PERIOD.period_end,
        limit_amount: FIRST_HOUSEHOLD_FOOD_PERIOD.limit_amount,
        carryover_amount: FIRST_HOUSEHOLD_FOOD_PERIOD.carryover_amount,
        envelope_source_id: 7,
        created_at: '2026-09-01 00:00:00',
        updated_at: '2026-09-01 00:00:00',
      },
    ],
    ...overrides,
  };
}

function minimalV6Backup(overrides: Record<string, unknown> = {}) {
  return {
    appVersion: '1.0.0',
    backupVersion: '6',
    created_at: new Date().toISOString(),
    transactions: [],
    categories: [
      {
        id: 1,
        name: 'Ăn uống',
        type: 'chi',
        icon: '🍜',
        color: '#FF8FAB',
        budget_group: 'household_food',
      },
    ],
    sources: [
      {
        id: 7,
        name: 'Woori · Quỹ ăn',
        is_active: 1,
        spending_group: 'household',
      },
    ],
    budget_periods: [
      {
        id: 1,
        budget_key: 'household_food',
        period_start: FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
        period_end: FIRST_HOUSEHOLD_FOOD_PERIOD.period_end,
        limit_amount: FIRST_HOUSEHOLD_FOOD_PERIOD.limit_amount,
        carryover_amount: FIRST_HOUSEHOLD_FOOD_PERIOD.carryover_amount,
        adjustment_amount: 138,
        envelope_source_id: 7,
        created_at: '2026-09-01 00:00:00',
        updated_at: '2026-09-01 00:00:00',
      },
    ],
    ...overrides,
  };
}

describe('backup validation v6', () => {
  it('CURRENT_BACKUP_VERSION is 6', () => {
    assert.equal(CURRENT_BACKUP_VERSION, '6');
  });

  it('accepts v1/v2/v3 without budget_periods', () => {
    const v1 = validateBackupPayload(minimalV3Backup({ backupVersion: '1' }));
    assert.equal(v1.backupVersion, '1');
    assert.deepEqual(v1.budget_periods, []);
    const v2 = validateBackupPayload(minimalV3Backup({ backupVersion: '2' }));
    assert.equal(v2.backupVersion, '2');
    const v3 = validateBackupPayload(minimalV3Backup());
    assert.equal(v3.backupVersion, '3');
  });

  it('v4 still parses; defaults missing envelope_source_id to null and adjustment to 0', () => {
    const parsed = validateBackupPayload(minimalV4Backup());
    assert.equal(parsed.budget_periods[0].carryover_amount, 223_550);
    assert.equal(parsed.budget_periods[0].envelope_source_id, null);
    assert.equal(parsed.budget_periods[0].adjustment_amount, 0);
  });

  it('v5 round-trip preserves carryover and envelope_source_id; adjustment defaults to 0', () => {
    const parsed = validateBackupPayload(minimalV5Backup());
    const period = parsed.budget_periods[0];
    assert.equal(period.period_start, '2026-09-05');
    assert.equal(period.period_end, '2026-10-04');
    assert.equal(period.limit_amount, 7_500_000);
    assert.equal(period.carryover_amount, 223_550);
    assert.equal(period.envelope_source_id, 7);
    assert.equal(period.adjustment_amount, 0);
  });

  it('v5 ignores stray adjustment_amount and restores as 0', () => {
    const parsed = validateBackupPayload(
      minimalV5Backup({
        budget_periods: [
          {
            id: 1,
            budget_key: 'household_food',
            period_start: FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
            period_end: FIRST_HOUSEHOLD_FOOD_PERIOD.period_end,
            limit_amount: 7_500_000,
            carryover_amount: 223_550,
            adjustment_amount: 999,
            envelope_source_id: 7,
            created_at: '2026-09-01 00:00:00',
            updated_at: '2026-09-01 00:00:00',
          },
        ],
      }),
    );
    assert.equal(parsed.budget_periods[0].adjustment_amount, 0);
    assert.equal(parsed.budget_periods[0].carryover_amount, 223_550);
  });

  it('v6 preserves adjustment_amount exactly', () => {
    const parsed = validateBackupPayload(minimalV6Backup());
    const period = parsed.budget_periods[0];
    assert.equal(period.adjustment_amount, 138);
    assert.equal(period.carryover_amount, 223_550);
    assert.equal(period.envelope_source_id, 7);
    assert.equal(period.limit_amount, 7_500_000);
  });

  it('v6 preserves negative adjustment', () => {
    const parsed = validateBackupPayload(
      minimalV6Backup({
        budget_periods: [
          {
            id: 1,
            budget_key: 'household_food',
            period_start: FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
            period_end: FIRST_HOUSEHOLD_FOOD_PERIOD.period_end,
            limit_amount: 7_500_000,
            carryover_amount: 223_550,
            adjustment_amount: -500,
            envelope_source_id: 7,
            created_at: '2026-09-01 00:00:00',
            updated_at: '2026-09-01 00:00:00',
          },
        ],
      }),
    );
    assert.equal(parsed.budget_periods[0].adjustment_amount, -500);
  });

  it('v6 requires adjustment_amount field', () => {
    assert.throws(() =>
      validateBackupPayload(
        minimalV6Backup({
          budget_periods: [
            {
              id: 1,
              budget_key: 'household_food',
              period_start: '2026-09-05',
              period_end: '2026-10-04',
              limit_amount: 7_500_000,
              carryover_amount: 223_550,
              envelope_source_id: 7,
              created_at: '2026-09-01 00:00:00',
              updated_at: '2026-09-01 00:00:00',
            },
          ],
        }),
      ),
    );
  });

  it('v5 explicit carryover 0 is preserved (never coerced to 223550 by validation)', () => {
    const parsed = validateBackupPayload(
      minimalV5Backup({
        budget_periods: [
          {
            id: 1,
            budget_key: 'household_food',
            period_start: FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
            period_end: FIRST_HOUSEHOLD_FOOD_PERIOD.period_end,
            limit_amount: 7_500_000,
            carryover_amount: 0,
            envelope_source_id: 7,
            created_at: '2026-09-01 00:00:00',
            updated_at: '2026-09-01 00:00:00',
          },
        ],
      }),
    );
    assert.equal(parsed.budget_periods[0].carryover_amount, 0);
    assert.equal(parsed.budget_periods[0].envelope_source_id, 7);
  });

  it('v5 requires envelope_source_id field', () => {
    assert.throws(() =>
      validateBackupPayload(
        minimalV5Backup({
          budget_periods: [
            {
              id: 1,
              budget_key: 'household_food',
              period_start: '2026-09-05',
              period_end: '2026-10-04',
              limit_amount: 7_500_000,
              carryover_amount: 0,
              created_at: '2026-09-01 00:00:00',
              updated_at: '2026-09-01 00:00:00',
            },
          ],
        }),
      ),
    );
  });

  it('v1–v4 may run first-period seeds after restore; v5/v6 must not', () => {
    assert.equal(shouldRunFirstPeriodBudgetSeedsAfterRestore('1'), true);
    assert.equal(shouldRunFirstPeriodBudgetSeedsAfterRestore('4'), true);
    assert.equal(shouldRunFirstPeriodBudgetSeedsAfterRestore('5'), false);
    assert.equal(shouldRunFirstPeriodBudgetSeedsAfterRestore('6'), false);
  });

  it('v5 rejects duplicate budget_key + period_start', () => {
    assert.throws(() =>
      validateBackupPayload(
        minimalV5Backup({
          budget_periods: [
            {
              id: 1,
              budget_key: 'household_food',
              period_start: '2026-09-05',
              period_end: '2026-10-04',
              limit_amount: 7_500_000,
              carryover_amount: 223_550,
              envelope_source_id: 7,
            },
            {
              id: 2,
              budget_key: 'household_food',
              period_start: '2026-09-05',
              period_end: '2026-10-04',
              limit_amount: 8_000_000,
              carryover_amount: 0,
              envelope_source_id: 7,
            },
          ],
        }),
      ),
    );
  });
});
