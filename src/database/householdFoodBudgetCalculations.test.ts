import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBudgetAmountSummary,
  computeAvailableAmount,
  budgetDisplayStatus,
  budgetProgressBarFill,
  formatBudgetProgressLabel,
} from './householdFoodBudgetCalculations.ts';
import {
  FIRST_HOUSEHOLD_FOOD_PERIOD,
  plannedContributionAmounts,
} from '../constants/budget.ts';

describe('Household Food Budget calculations', () => {
  it('available = limit + carryover', () => {
    assert.equal(computeAvailableAmount(7_500_000, 223_550), 7_723_550);
    const s = computeBudgetAmountSummary(7_500_000, 0, 223_550);
    assert.equal(s.availableAmount, 7_723_550);
    assert.equal(s.remainingAmount, 7_723_550);
    assert.equal(s.limitAmount, 7_500_000);
    assert.equal(s.carryoverAmount, 223_550);
  });

  it('current first period constants: 7.5m + 223_550', () => {
    assert.equal(FIRST_HOUSEHOLD_FOOD_PERIOD.limit_amount, 7_500_000);
    assert.equal(FIRST_HOUSEHOLD_FOOD_PERIOD.carryover_amount, 223_550);
    const s = computeBudgetAmountSummary(
      FIRST_HOUSEHOLD_FOOD_PERIOD.limit_amount,
      0,
      FIRST_HOUSEHOLD_FOOD_PERIOD.carryover_amount,
    );
    assert.equal(s.availableAmount, 7_723_550);
  });

  it('limit 7.5m spent 0 → remaining 7.5m (no carryover)', () => {
    const s = computeBudgetAmountSummary(7_500_000, 0);
    assert.equal(s.remainingAmount, 7_500_000);
    assert.equal(s.overAmount, 0);
    assert.equal(s.progressPercent, 0);
  });

  it('spent 5m with carryover → remaining from available', () => {
    const s = computeBudgetAmountSummary(7_500_000, 5_000_000, 223_550);
    assert.equal(s.remainingAmount, 2_723_550);
    assert.equal(s.overAmount, 0);
  });

  it('spent equals available → 100% over', () => {
    const s = computeBudgetAmountSummary(7_500_000, 7_723_550, 223_550);
    assert.equal(s.remainingAmount, 0);
    assert.equal(s.progressPercent, 100);
    assert.equal(s.status, 'over');
  });

  it('spent above available → over amount', () => {
    const s = computeBudgetAmountSummary(7_500_000, 8_000_000, 223_550);
    assert.equal(s.overAmount, 276_450);
    assert.equal(s.remainingAmount, 0);
  });

  it('limit 0 spent 0 → no NaN', () => {
    const s = computeBudgetAmountSummary(0, 0);
    assert.equal(Number.isNaN(s.progressRatio), false);
    assert.equal(s.progressPercent, 0);
    assert.equal(s.status, 'normal');
  });

  it('limit 0 spent > 0 → over', () => {
    const s = computeBudgetAmountSummary(0, 100_000);
    assert.equal(s.status, 'over');
    assert.equal(formatBudgetProgressLabel(s.progressPercent), '∞%');
    assert.equal(budgetProgressBarFill(s.progressRatio), 1);
  });

  it('planned contribution uses limit only — ignores carryover', () => {
    assert.deepEqual(plannedContributionAmounts(7_500_000), {
      kai: 6_000_000,
      yue: 1_500_000,
    });
    assert.deepEqual(
      plannedContributionAmounts(FIRST_HOUSEHOLD_FOOD_PERIOD.limit_amount),
      { kai: 6_000_000, yue: 1_500_000 },
    );
    // Carryover must not inflate contribution base
    assert.notEqual(
      plannedContributionAmounts(7_500_000).kai + plannedContributionAmounts(7_500_000).yue,
      7_723_550,
    );
  });

  it('status thresholds vs available', () => {
    assert.equal(budgetDisplayStatus(100, 69), 'normal');
    assert.equal(budgetDisplayStatus(100, 70), 'attention');
    assert.equal(budgetDisplayStatus(100, 90), 'near_limit');
    assert.equal(budgetDisplayStatus(100, 100), 'over');
  });
});
