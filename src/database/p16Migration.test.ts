import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  budgetGroupForExactCategoryName,
  classifyTrustedCategoryBudgetGroups,
} from './categoryBudget.ts';
import { FIRST_HOUSEHOLD_FOOD_PERIOD } from '../constants/budget.ts';
import { validateBudgetPeriodBounds } from './budgetPeriodDomain.ts';
import {
  shouldRunLegacyTrustedBackfillAfterRestore,
  shouldRunP16TrustedBackfillOnStartup,
} from './p16MigrationLifecycle.ts';
import { spendingGroupForExactSourceName } from './sourceSeed.ts';
import { VCB_SHOP_EXACT_NAME } from './sourceMigration.ts';

type CategoryRow = { id: number; name: string; budget_group: string | null };
type SourceRow = { id: number; name: string; spending_group: string | null };
type PeriodRow = {
  budget_key: string;
  period_start: string;
  period_end: string;
  limit_amount: number;
  carryover_amount: number;
  envelope_source_id: number | null;
};

function applyLegacyCategoryBackfill(categories: CategoryRow[]): CategoryRow[] {
  const updates = classifyTrustedCategoryBudgetGroups(categories);
  return categories.map((cat) => {
    const hit = updates.find((u) => u.id === cat.id);
    return hit && cat.budget_group == null
      ? { ...cat, budget_group: hit.budget_group }
      : cat;
  });
}

function applyVcbShopBackfill(sources: SourceRow[]): SourceRow[] {
  return sources.map((src) =>
    src.name === VCB_SHOP_EXACT_NAME && src.spending_group == null
      ? { ...src, spending_group: 'household' }
      : src,
  );
}

function simulateLegacyRestoreBackfill(
  backupVersion: string,
  categories: CategoryRow[],
  sources: SourceRow[],
  periods: PeriodRow[],
): { categories: CategoryRow[]; sources: SourceRow[]; periods: PeriodRow[] } {
  if (!shouldRunLegacyTrustedBackfillAfterRestore(backupVersion)) {
    return { categories, sources, periods };
  }
  let nextCategories = applyLegacyCategoryBackfill(categories);
  let nextSources = applyVcbShopBackfill(sources);
  let nextPeriods = [...periods];
  const hasFirst = nextPeriods.some(
    (p) =>
      p.budget_key === 'household_food' &&
      p.period_start === FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
  );
  if (!hasFirst) {
    nextPeriods.push({
      budget_key: 'household_food',
      period_start: FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
      period_end: FIRST_HOUSEHOLD_FOOD_PERIOD.period_end,
      limit_amount: FIRST_HOUSEHOLD_FOOD_PERIOD.limit_amount,
      carryover_amount: FIRST_HOUSEHOLD_FOOD_PERIOD.carryover_amount,
      envelope_source_id: null,
    });
  }
  return { categories: nextCategories, sources: nextSources, periods: nextPeriods };
}

function simulateStartupAfterMarker(
  backfillComplete: boolean,
  categories: CategoryRow[],
  sources: SourceRow[],
  periods: PeriodRow[],
): { categories: CategoryRow[]; sources: SourceRow[]; periods: PeriodRow[] } {
  if (!shouldRunP16TrustedBackfillOnStartup(backfillComplete)) {
    return { categories, sources, periods };
  }
  let nextCategories = applyLegacyCategoryBackfill(categories);
  let nextSources = applyVcbShopBackfill(sources);
  let nextPeriods = [...periods];
  const hasFirst = nextPeriods.some(
    (p) =>
      p.budget_key === 'household_food' &&
      p.period_start === FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
  );
  if (!hasFirst) {
    nextPeriods.push({
      budget_key: 'household_food',
      period_start: FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
      period_end: FIRST_HOUSEHOLD_FOOD_PERIOD.period_end,
      limit_amount: FIRST_HOUSEHOLD_FOOD_PERIOD.limit_amount,
      carryover_amount: FIRST_HOUSEHOLD_FOOD_PERIOD.carryover_amount,
      envelope_source_id: null,
    });
  }
  return { categories: nextCategories, sources: nextSources, periods: nextPeriods };
}

describe('P1.6 migration lifecycle (pure restore + restart semantics)', () => {
  it('1. legacy v3 restore: Ăn uống without budget_group → household_food', () => {
    const restored = simulateLegacyRestoreBackfill(
      '3',
      [{ id: 1, name: 'Ăn uống', budget_group: null }],
      [],
      [],
    );
    assert.equal(restored.categories[0].budget_group, 'household_food');
  });

  it('2. legacy v3 restore: VCB Shop NULL → household', () => {
    const restored = simulateLegacyRestoreBackfill(
      '3',
      [],
      [{ id: 2, name: VCB_SHOP_EXACT_NAME, spending_group: null }],
      [],
    );
    assert.equal(restored.sources[0].spending_group, 'household');
  });

  it('3. v4 restore: Ăn uống budget_group = NULL remains NULL after restore + restart', () => {
    const categories: CategoryRow[] = [{ id: 1, name: 'Ăn uống', budget_group: null }];
    const afterRestore = simulateLegacyRestoreBackfill('4', categories, [], []);
    assert.equal(afterRestore.categories[0].budget_group, null);

    const afterRestart = simulateStartupAfterMarker(true, afterRestore.categories, [], []);
    assert.equal(afterRestart.categories[0].budget_group, null);
  });

  it('4. v4 restore: VCB Shop spending_group = NULL remains NULL after restore + restart', () => {
    const sources: SourceRow[] = [{ id: 2, name: VCB_SHOP_EXACT_NAME, spending_group: null }];
    const afterRestore = simulateLegacyRestoreBackfill('4', [], sources, []);
    assert.equal(afterRestore.sources[0].spending_group, null);

    const afterRestart = simulateStartupAfterMarker(true, [], afterRestore.sources, []);
    assert.equal(afterRestart.sources[0].spending_group, null);
  });

  it('5. v4 restore preserves explicit budget periods exactly', () => {
    const periods: PeriodRow[] = [
      {
        budget_key: 'household_food',
        period_start: '2026-10-05',
        period_end: '2026-11-04',
        limit_amount: 8_000_000,
        carryover_amount: 0,
        envelope_source_id: 7,
      },
    ];
    const afterRestore = simulateLegacyRestoreBackfill('4', [], [], periods);
    assert.deepEqual(afterRestore.periods, periods);

    const afterRestart = simulateStartupAfterMarker(true, [], [], afterRestore.periods);
    assert.deepEqual(afterRestart.periods, periods);
  });

  it('6. edited initial period 7.5m → 8m survives restart once backfill marker is set', () => {
    const periods: PeriodRow[] = [
      {
        budget_key: 'household_food',
        period_start: FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
        period_end: FIRST_HOUSEHOLD_FOOD_PERIOD.period_end,
        limit_amount: 8_000_000,
        carryover_amount: 100_000,
        envelope_source_id: 7,
      },
    ];
    const afterRestart = simulateStartupAfterMarker(true, [], [], periods);
    assert.equal(afterRestart.periods[0].limit_amount, 8_000_000);
    assert.equal(afterRestart.periods[0].carryover_amount, 100_000);
    assert.equal(afterRestart.periods[0].envelope_source_id, 7);
  });

  it('7. repeated normal init does not mutate after first P1.6 migration marker', () => {
    let categories: CategoryRow[] = [
      { id: 1, name: 'Ăn uống', budget_group: null },
      { id: 2, name: 'Mua sắm', budget_group: null },
    ];
    let sources: SourceRow[] = [{ id: 2, name: VCB_SHOP_EXACT_NAME, spending_group: null }];
    let periods: PeriodRow[] = [];

    const first = simulateStartupAfterMarker(false, categories, sources, periods);
    categories = first.categories;
    sources = first.sources;
    periods = first.periods;

    categories = categories.map((c) =>
      c.id === 1 ? { ...c, budget_group: null } : c,
    );
    sources = sources.map((s) =>
      s.name === VCB_SHOP_EXACT_NAME ? { ...s, spending_group: null } : s,
    );

    const second = simulateStartupAfterMarker(true, categories, sources, periods);
    assert.equal(second.categories.find((c) => c.id === 1)?.budget_group, null);
    assert.equal(
      second.sources.find((s) => s.name === VCB_SHOP_EXACT_NAME)?.spending_group,
      null,
    );
    assert.equal(second.periods.length, 1);
  });

  it('8. no budget period auto-created before 2026-09-05', () => {
    assert.throws(() =>
      validateBudgetPeriodBounds('2026-08-05', '2026-09-04', 7_500_000),
    );
  });

  it('trusted-name helpers remain migration-only (not runtime seed policy)', () => {
    assert.equal(budgetGroupForExactCategoryName('Ăn uống'), 'household_food');
    assert.equal(spendingGroupForExactSourceName(VCB_SHOP_EXACT_NAME), null);
  });
});
