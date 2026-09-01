import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideContinuingPeriodCreation } from './householdFoodBudgetLifecycle.ts';
import { findBudgetPeriodContainingDatePure } from './householdFoodBudgetLifecycle.testHelpers.ts';

describe('Household Food Budget period continuation', () => {
  const latest = {
    period_start: '2026-09-05',
    period_end: '2026-10-04',
    limit_amount: 7_500_000,
  };

  it('does not create when prior lineage missing (v4 empty guard)', () => {
    const d = decideContinuingPeriodCreation('2026-10-05', false, null);
    assert.equal(d.shouldCreate, false);
  });

  it('creates 05/10 period when latest is 05/09 and date is 05/10', () => {
    const d = decideContinuingPeriodCreation('2026-10-05', false, latest);
    assert.equal(d.shouldCreate, true);
    assert.equal(d.targetPeriodStart, '2026-10-05');
    assert.equal(d.targetPeriodEnd, '2026-11-04');
  });

  it('does not create before first configured period', () => {
    const d = decideContinuingPeriodCreation('2026-09-04', false, latest);
    assert.equal(d.shouldCreate, false);
  });

  it('does not create when active period already contains date', () => {
    const d = decideContinuingPeriodCreation('2026-09-10', true, latest);
    assert.equal(d.shouldCreate, false);
  });

  it('long gap creates only relevant cycle start', () => {
    const d = decideContinuingPeriodCreation('2027-01-06', false, latest);
    assert.equal(d.shouldCreate, true);
    assert.equal(d.targetPeriodStart, '2027-01-05');
    assert.equal(d.targetPeriodEnd, '2027-02-04');
  });

  it('stored period resolution uses DB bounds only', () => {
    const stored = [
      { period_start: '2026-09-05', period_end: '2026-10-04' },
      { period_start: '2026-10-05', period_end: '2026-11-04' },
    ];
    assert.equal(findBudgetPeriodContainingDatePure(stored, '2026-09-04'), null);
    assert.equal(findBudgetPeriodContainingDatePure(stored, '2026-09-05')?.period_start, '2026-09-05');
    assert.equal(findBudgetPeriodContainingDatePure(stored, '2026-10-04')?.period_start, '2026-09-05');
    assert.equal(findBudgetPeriodContainingDatePure(stored, '2026-10-05')?.period_start, '2026-10-05');
    assert.equal(findBudgetPeriodContainingDatePure(stored, '2026-09-02'), null);
  });
});
