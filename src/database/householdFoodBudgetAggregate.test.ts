import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  breakdownQualifyingHouseholdFoodBudgetTransactions,
  filterQualifyingHouseholdFoodBudgetTransactions,
  sumQualifyingHouseholdFoodBudgetTransactions,
} from './householdFoodBudgetAggregate.ts';
import { computeBudgetAmountSummary } from './householdFoodBudgetCalculations.ts';
import { isHouseholdFoodBudgetTransaction } from './householdFoodBudget.ts';

const period = { period_start: '2026-09-05', period_end: '2026-10-04' };

const rows = [
  {
    id: 1,
    amount: 100_000,
    type: 'chi',
    status: 'complete',
    category_id: 1,
    category_name: 'Ăn uống',
    category_budget_group: 'household_food' as const,
    source_spending_group: 'household' as const,
    transaction_date: '2026-09-10',
  },
  {
    id: 2,
    amount: 200_000,
    type: 'chi',
    status: 'complete',
    category_id: 2,
    category_name: 'Trà & Cà phê',
    category_budget_group: 'household_food' as const,
    source_spending_group: 'household' as const,
    transaction_date: '2026-09-15',
  },
  {
    id: 3,
    amount: 300_000,
    type: 'chi',
    status: 'complete',
    category_id: 1,
    category_name: 'Ăn uống',
    category_budget_group: 'household_food' as const,
    source_spending_group: 'household' as const,
    transaction_date: '2026-10-04',
  },
  {
    id: 4,
    amount: 999_000,
    type: 'chi',
    status: 'complete',
    category_id: 1,
    category_name: 'Ăn uống',
    category_budget_group: 'household_food' as const,
    source_spending_group: 'personal_yue' as const,
    transaction_date: '2026-09-10',
  },
  {
    id: 5,
    amount: 50_000,
    type: 'chi',
    status: 'complete',
    category_id: 3,
    category_name: 'Mua sắm',
    category_budget_group: null,
    source_spending_group: 'household' as const,
    transaction_date: '2026-09-10',
  },
  {
    id: 6,
    amount: 80_000,
    type: 'chi',
    status: 'complete',
    category_id: 1,
    category_name: 'Ăn uống',
    category_budget_group: 'household_food' as const,
    source_spending_group: 'household' as const,
    transaction_date: '2026-09-04',
  },
];

describe('Household Food Budget membership + consistency', () => {
  it('membership cases', () => {
    assert.equal(
      isHouseholdFoodBudgetTransaction({
        type: 'chi',
        status: 'complete',
        category_budget_group: 'household_food',
        source_spending_group: 'household',
        transaction_date: '2026-09-10',
        period,
      }),
      true,
    );
    assert.equal(
      isHouseholdFoodBudgetTransaction({
        type: 'chi',
        status: 'complete',
        category_budget_group: 'household_food',
        source_spending_group: 'personal_yue',
        transaction_date: '2026-09-10',
        period,
      }),
      false,
    );
    assert.equal(
      isHouseholdFoodBudgetTransaction({
        type: 'chi',
        status: 'complete',
        category_budget_group: null,
        source_spending_group: 'household',
        transaction_date: '2026-09-10',
        period,
      }),
      false,
    );
    assert.equal(
      isHouseholdFoodBudgetTransaction({
        type: 'chi',
        status: 'complete',
        category_budget_group: 'household_food',
        source_spending_group: 'household',
        transaction_date: '2026-09-04',
        period,
      }),
      false,
    );
  });

  it('audience-only change does not affect membership predicate inputs', () => {
    const base = {
      type: 'chi',
      status: 'complete',
      category_budget_group: 'household_food' as const,
      source_spending_group: 'personal_yue' as const,
      transaction_date: '2026-09-10',
      period,
    };
    assert.equal(isHouseholdFoodBudgetTransaction(base), false);
  });

  it('summary, detail, and breakdown totals agree', () => {
    const qualifying = filterQualifyingHouseholdFoodBudgetTransactions(period, rows);
    const spent = sumQualifyingHouseholdFoodBudgetTransactions(period, rows);
    const breakdown = breakdownQualifyingHouseholdFoodBudgetTransactions(period, rows);

    assert.equal(spent, 600_000);
    assert.equal(
      qualifying.reduce((sum, row) => sum + row.amount, 0),
      spent,
    );
    assert.equal(
      breakdown.reduce((sum, row) => sum + row.amount, 0),
      spent,
    );

    const summary = computeBudgetAmountSummary(7_500_000, spent);
    assert.equal(summary.spentAmount, spent);
  });

  it('date boundary — 04/10 included, 05/10 excluded from stored period', () => {
    assert.equal(
      isHouseholdFoodBudgetTransaction({
        type: 'chi',
        status: 'complete',
        category_budget_group: 'household_food',
        source_spending_group: 'household',
        transaction_date: '2026-10-04',
        period,
      }),
      true,
    );
    assert.equal(
      isHouseholdFoodBudgetTransaction({
        type: 'chi',
        status: 'complete',
        category_budget_group: 'household_food',
        source_spending_group: 'household',
        transaction_date: '2026-10-05',
        period,
      }),
      false,
    );
  });

  it('edit transaction date across period boundary changes membership (created_at domain date)', () => {
    const insidePeriod = {
      id: 10,
      amount: 120_000,
      type: 'chi',
      status: 'complete',
      category_id: 1,
      category_name: 'Ăn uống',
      category_budget_group: 'household_food' as const,
      source_spending_group: 'household' as const,
      transaction_date: '2026-10-04',
    };
    const editedOutside = { ...insidePeriod, transaction_date: '2026-10-05' };

    assert.equal(sumQualifyingHouseholdFoodBudgetTransactions(period, [insidePeriod]), 120_000);
    assert.equal(sumQualifyingHouseholdFoodBudgetTransactions(period, [editedOutside]), 0);
  });
});
