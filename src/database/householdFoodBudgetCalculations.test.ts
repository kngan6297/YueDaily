import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBudgetAmountSummary,
  budgetDisplayStatus,
  budgetProgressBarFill,
  formatBudgetProgressLabel,
} from './householdFoodBudgetCalculations.ts';
import { plannedContributionAmounts } from '../constants/budget.ts';

describe('Household Food Budget calculations', () => {
  it('limit 7.5m spent 0 → remaining 7.5m', () => {
    const s = computeBudgetAmountSummary(7_500_000, 0);
    assert.equal(s.remainingAmount, 7_500_000);
    assert.equal(s.overAmount, 0);
    assert.equal(s.progressPercent, 0);
  });

  it('spent 5m → remaining 2.5m', () => {
    const s = computeBudgetAmountSummary(7_500_000, 5_000_000);
    assert.equal(s.remainingAmount, 2_500_000);
    assert.equal(s.overAmount, 0);
  });

  it('spent 7.5m → 100%', () => {
    const s = computeBudgetAmountSummary(7_500_000, 7_500_000);
    assert.equal(s.remainingAmount, 0);
    assert.equal(s.progressPercent, 100);
    assert.equal(s.status, 'over');
  });

  it('spent 8m → over 0.5m and >100%', () => {
    const s = computeBudgetAmountSummary(7_500_000, 8_000_000);
    assert.equal(s.overAmount, 500_000);
    assert.equal(s.remainingAmount, 0);
    assert.equal(s.progressPercent, 106.7);
    assert.equal(s.status, 'over');
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

  it('planned contribution amounts', () => {
    assert.deepEqual(plannedContributionAmounts(7_500_000), { kai: 6_000_000, yue: 1_500_000 });
    assert.deepEqual(plannedContributionAmounts(8_000_000), { kai: 6_400_000, yue: 1_600_000 });
  });

  it('status thresholds', () => {
    assert.equal(budgetDisplayStatus(100, 69), 'normal');
    assert.equal(budgetDisplayStatus(100, 70), 'attention');
    assert.equal(budgetDisplayStatus(100, 90), 'near_limit');
    assert.equal(budgetDisplayStatus(100, 100), 'over');
  });
});
