import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isHouseholdFoodBudgetTransaction } from './householdFoodBudget.ts';
import { FIRST_HOUSEHOLD_FOOD_PERIOD } from '../constants/budget.ts';

const period = {
  period_start: FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
  period_end: FIRST_HOUSEHOLD_FOOD_PERIOD.period_end,
};

describe('Household Food Budget membership (source-based, no audience)', () => {
  it('includes household source + household_food in period', () => {
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
  });

  it('excludes VPBank + Yue+Kai semantic (personal source)', () => {
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
  });

  it('excludes dates before first configured period even if household food', () => {
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

  it('excludes non-food category on household source', () => {
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
  });

  it('audience changes alone do not affect membership rule (no audience field)', () => {
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
});
