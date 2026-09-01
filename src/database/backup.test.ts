import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_BACKUP_VERSION,
  validateBackupPayload,
} from './backupValidation.ts';
import { FIRST_HOUSEHOLD_FOOD_PERIOD } from '../constants/budget.ts';

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
        name: 'VCB Shop',
        is_active: 0,
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
        created_at: '2026-09-01 00:00:00',
        updated_at: '2026-09-01 00:00:00',
      },
    ],
    ...overrides,
  };
}

describe('backup v4 validation', () => {
  it('CURRENT_BACKUP_VERSION is 4', () => {
    assert.equal(CURRENT_BACKUP_VERSION, '4');
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

  it('v4 requires budget_periods and category budget_group', () => {
    const parsed = validateBackupPayload(minimalV4Backup());
    assert.equal(parsed.budget_periods.length, 1);
    assert.equal(parsed.categories[0].budget_group, 'household_food');
    assert.equal(parsed.streak, null);
  });

  it('v4 round-trip shape preserves period boundaries', () => {
    const parsed = validateBackupPayload(minimalV4Backup());
    const period = parsed.budget_periods[0];
    assert.equal(period.period_start, '2026-09-05');
    assert.equal(period.period_end, '2026-10-04');
    assert.equal(period.limit_amount, 7_500_000);
  });

  it('v4 rejects malformed budget period', () => {
    assert.throws(() =>
      validateBackupPayload(
        minimalV4Backup({
          budget_periods: [
            {
              id: 1,
              budget_key: 'household_food',
              period_start: '2026-10-04',
              period_end: '2026-09-05',
              limit_amount: 100,
            },
          ],
        }),
      ),
    );
    assert.throws(() =>
      validateBackupPayload(
        minimalV4Backup({
          budget_periods: [
            {
              id: 1,
              budget_key: 'unknown',
              period_start: '2026-09-05',
              period_end: '2026-10-04',
              limit_amount: 100,
            },
          ],
        }),
      ),
    );
    assert.throws(() =>
      validateBackupPayload(
        minimalV4Backup({
          budget_periods: [
            {
              id: 1,
              budget_key: 'household_food',
              period_start: '2026-09-05',
              period_end: '2026-10-04',
              limit_amount: -1,
            },
          ],
        }),
      ),
    );
  });

  it('v4 rejects duplicate budget_key + period_start', () => {
    const dup = minimalV4Backup({
      budget_periods: [
        {
          id: 1,
          budget_key: 'household_food',
          period_start: '2026-09-05',
          period_end: '2026-10-04',
          limit_amount: 7_500_000,
        },
        {
          id: 2,
          budget_key: 'household_food',
          period_start: '2026-09-05',
          period_end: '2026-10-04',
          limit_amount: 8_000_000,
        },
      ],
    });
    assert.throws(() => validateBackupPayload(dup));
  });

  it('v4 export omits streak — legacy streak in v3 still parses but is optional', () => {
    const v3WithStreak = minimalV3Backup({
      streak: { id: 1, current_streak: 5, last_logged_date: '2026-08-01' },
    });
    const parsed = validateBackupPayload(v3WithStreak);
    assert.equal(parsed.streak?.current_streak, 5);
    const v4 = validateBackupPayload(minimalV4Backup());
    assert.equal(v4.streak, null);
  });
});
