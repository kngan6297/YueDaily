import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIRST_HOUSEHOLD_FOOD_PERIOD,
  HOUSEHOLD_FOOD_CYCLE_START_DAY,
  plannedContributionAmounts,
  PLANNED_CONTRIBUTION_RATIOS,
} from './budget.ts';

describe('budget constants', () => {
  it('cycle start day is 5 (household_food only)', () => {
    assert.equal(HOUSEHOLD_FOOD_CYCLE_START_DAY, 5);
  });

  it('planned contribution amounts for 7.5m', () => {
    const amounts = plannedContributionAmounts(FIRST_HOUSEHOLD_FOOD_PERIOD.limit_amount);
    assert.equal(amounts.kai, 6_000_000);
    assert.equal(amounts.yue, 1_500_000);
    assert.equal(amounts.kai + amounts.yue, FIRST_HOUSEHOLD_FOOD_PERIOD.limit_amount);
    assert.equal(PLANNED_CONTRIBUTION_RATIOS.kai, 0.8);
    assert.equal(PLANNED_CONTRIBUTION_RATIOS.yue, 0.2);
  });

  it('planned contribution amounts for 8m with integer remainder on Yue side', () => {
    const amounts = plannedContributionAmounts(8_000_000);
    assert.equal(amounts.kai, 6_400_000);
    assert.equal(amounts.yue, 1_600_000);
    assert.equal(amounts.kai + amounts.yue, 8_000_000);
  });

  it('kai + yue always equals limit for odd limits', () => {
    const limit = 7_500_001;
    const amounts = plannedContributionAmounts(limit);
    assert.equal(amounts.kai + amounts.yue, limit);
  });
});
