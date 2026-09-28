import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  accumulateTrackedSourceAdjustment,
  computeTrackedSourceBalance,
} from './trackedSourceBalanceCalculations.ts';
import { isTrackedSourcePeriodTransaction } from './trackedSourcePeriodMembership.ts';
import {
  filterQualifyingTrackedSourceTransactions,
  sumTrackedSourceIncomeExpense,
} from './trackedSourcePeriodAggregate.ts';

const VPBANK_ID = 2;
const PERIOD = {
  period_start: '2026-09-01',
  period_end: '2026-09-30',
  source_id: VPBANK_ID,
};

function membership(
  overrides: Partial<Parameters<typeof isTrackedSourcePeriodTransaction>[0]> = {},
) {
  return isTrackedSourcePeriodTransaction({
    type: 'chi',
    status: 'complete',
    source_id: VPBANK_ID,
    tracked_source_id: VPBANK_ID,
    transaction_date: '2026-09-15',
    period: PERIOD,
    ...overrides,
  });
}

describe('tracked source balance calculations', () => {
  it('returns null when opening_balance is null (do not assume 0)', () => {
    assert.equal(computeTrackedSourceBalance(null, 100, 50, 0), null);
    assert.equal(computeTrackedSourceBalance(undefined, 100, 50, 0), null);
  });

  it('opening 0 is valid and yields a balance', () => {
    const s = computeTrackedSourceBalance(0, 100_000, 40_000, 0);
    assert.ok(s);
    assert.equal(s.currentBalance, 60_000);
  });

  it('expense subtracts; income adds; adjustment ± works', () => {
    const base = computeTrackedSourceBalance(1_000_000, 200_000, 300_000, 0);
    assert.equal(base?.currentBalance, 900_000);

    const withAdj = computeTrackedSourceBalance(1_000_000, 200_000, 300_000, 50_000);
    assert.equal(withAdj?.currentBalance, 950_000);

    const negAdj = computeTrackedSourceBalance(1_000_000, 200_000, 300_000, -10_000);
    assert.equal(negAdj?.currentBalance, 890_000);
  });

  it('adjustments accumulate like Woori', () => {
    assert.equal(accumulateTrackedSourceAdjustment(0, 138), 138);
    assert.equal(accumulateTrackedSourceAdjustment(138, -50), 88);
  });
});

describe('tracked source membership', () => {
  it('includes complete chi/thu for matching source_id in month', () => {
    assert.equal(membership({ type: 'chi' }), true);
    assert.equal(membership({ type: 'thu' }), true);
  });

  it('excludes incomplete transactions', () => {
    assert.equal(membership({ status: 'pending' }), false);
  });

  it('excludes outside calendar month boundaries', () => {
    assert.equal(membership({ transaction_date: '2026-08-31' }), false);
    assert.equal(membership({ transaction_date: '2026-10-01' }), false);
    assert.equal(membership({ transaction_date: '2026-09-01' }), true);
    assert.equal(membership({ transaction_date: '2026-09-30' }), true);
  });

  it('rename/archive does not break — only source_id vs tracked_source_id', () => {
    assert.equal(membership({ source_id: VPBANK_ID, tracked_source_id: VPBANK_ID }), true);
    assert.equal(membership({ source_id: 99, tracked_source_id: VPBANK_ID }), false);
  });

  it('category and audience are ignored (not part of membership input)', () => {
    // Aggregate filter must still include rows regardless of category/audience fields
    const rows = [
      {
        id: 1,
        amount: 50_000,
        type: 'chi',
        status: 'complete',
        category_id: 1,
        category_name: 'Ăn uống',
        expense_audience: 'wife_and_sister',
        source_id: VPBANK_ID,
        transaction_date: '2026-09-10',
      },
      {
        id: 2,
        amount: 100_000,
        type: 'thu',
        status: 'complete',
        category_id: 99,
        category_name: 'Khác',
        expense_audience: 'couple',
        source_id: VPBANK_ID,
        transaction_date: '2026-09-12',
      },
      {
        id: 3,
        amount: 999,
        type: 'chi',
        status: 'pending',
        category_id: 1,
        source_id: VPBANK_ID,
        transaction_date: '2026-09-12',
      },
      {
        id: 4,
        amount: 10_000,
        type: 'chi',
        status: 'complete',
        category_id: 1,
        source_id: 7, // Woori
        transaction_date: '2026-09-12',
      },
    ];
    const filtered = filterQualifyingTrackedSourceTransactions(PERIOD, rows);
    assert.equal(filtered.length, 2);
    const sums = sumTrackedSourceIncomeExpense(PERIOD, rows);
    assert.equal(sums.incomeAmount, 100_000);
    assert.equal(sums.expenseAmount, 50_000);
  });

  it('next month does not inherit opening — balance null until entered', () => {
    const nextMonthOpening = null;
    assert.equal(
      computeTrackedSourceBalance(nextMonthOpening, 0, 0, 0),
      null,
    );
  });
});
