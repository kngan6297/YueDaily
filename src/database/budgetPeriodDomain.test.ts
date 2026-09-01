import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCycleStartContainingDate,
  getHouseholdFoodPeriodBounds,
  getNextHouseholdFoodPeriodStart,
  isBeforeFirstConfiguredHouseholdFoodPeriod,
  isDateInsideBudgetPeriod,
  isValidDateOnlyString,
  periodEndFromCycleStart,
  validateBudgetPeriodBounds,
} from './budgetPeriodDomain.ts';
import { FIRST_HOUSEHOLD_FOOD_PERIOD } from '../constants/budget.ts';

describe('Household Food Budget period domain (05→04)', () => {
  it('validates YYYY-MM-DD without UTC shift', () => {
    assert.equal(isValidDateOnlyString('2026-09-05'), true);
    assert.equal(isValidDateOnlyString('2024-02-29'), true);
    assert.equal(isValidDateOnlyString('2026-02-29'), false);
    assert.equal(isValidDateOnlyString('2025-02-29'), false);
    assert.equal(isValidDateOnlyString('2026-09-5'), false);
  });

  it('04/09/2026 is before first configured period', () => {
    assert.equal(isBeforeFirstConfiguredHouseholdFoodPeriod('2026-09-04'), true);
    assert.equal(isBeforeFirstConfiguredHouseholdFoodPeriod('2026-09-05'), false);
  });

  it('first configured period boundaries', () => {
    const period = FIRST_HOUSEHOLD_FOOD_PERIOD;
    assert.equal(period.period_start, '2026-09-05');
    assert.equal(period.period_end, '2026-10-04');
    assert.equal(period.limit_amount, 7_500_000);
  });

  it('resolves cycle bounds for authoritative dates', () => {
    const cases: [string, string, string][] = [
      ['2026-09-05', '2026-09-05', '2026-10-04'],
      ['2026-09-30', '2026-09-05', '2026-10-04'],
      ['2026-10-01', '2026-09-05', '2026-10-04'],
      ['2026-10-04', '2026-09-05', '2026-10-04'],
      ['2026-10-05', '2026-10-05', '2026-11-04'],
    ];
    for (const [date, start, end] of cases) {
      const bounds = getHouseholdFoodPeriodBounds(date);
      assert.equal(bounds.period_start, start, date);
      assert.equal(bounds.period_end, end, date);
    }
  });

  it('04/09 natural cycle start is August but before configured period', () => {
    assert.equal(computeCycleStartContainingDate('2026-09-04'), '2026-08-05');
    assert.equal(isBeforeFirstConfiguredHouseholdFoodPeriod('2026-09-04'), true);
  });

  it('month-length boundaries Jan/Feb and Dec/Jan', () => {
    assert.equal(periodEndFromCycleStart('2026-01-05'), '2026-02-04');
    assert.equal(periodEndFromCycleStart('2026-02-05'), '2026-03-04');
    assert.equal(periodEndFromCycleStart('2026-12-05'), '2027-01-04');
    assert.equal(getNextHouseholdFoodPeriodStart('2026-12-05'), '2027-01-05');
  });

  it('leap-year February end date', () => {
    assert.equal(periodEndFromCycleStart('2024-01-05'), '2024-02-04');
    assert.equal(isValidDateOnlyString('2024-02-29'), true);
  });

  it('isDateInsideBudgetPeriod uses inclusive bounds', () => {
    const period = { period_start: '2026-09-05', period_end: '2026-10-04' };
    assert.equal(isDateInsideBudgetPeriod('2026-09-04', period), false);
    assert.equal(isDateInsideBudgetPeriod('2026-09-05', period), true);
    assert.equal(isDateInsideBudgetPeriod('2026-10-04', period), true);
    assert.equal(isDateInsideBudgetPeriod('2026-10-05', period), false);
  });

  it('rejects period before first configured household food period', () => {
    assert.throws(() => validateBudgetPeriodBounds('2026-08-05', '2026-09-04', 7_500_000));
  });

  it('rejects period_end that does not match 05→04 cycle', () => {
    assert.throws(() =>
      validateBudgetPeriodBounds('2026-09-05', '2026-10-05', 7_500_000),
    );
  });
});
