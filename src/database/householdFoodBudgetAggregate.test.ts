import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  breakdownQualifyingHouseholdFoodBudgetTransactions,
  filterQualifyingHouseholdFoodBudgetTransactions,
  sumQualifyingHouseholdFoodBudgetTransactions,
} from './householdFoodBudgetAggregate.ts';
import { computeBudgetAmountSummary } from './householdFoodBudgetCalculations.ts';
import { isHouseholdFoodBudgetTransaction } from './householdFoodBudget.ts';
import { FIRST_HOUSEHOLD_FOOD_PERIOD } from '../constants/budget.ts';

const WOORI_ID = 7;
const OTHER_ID = 99;

const period = {
  period_start: '2026-09-05',
  period_end: '2026-10-04',
  envelope_source_id: WOORI_ID,
};

const rows = [
  {
    id: 1,
    amount: 100_000,
    type: 'chi',
    status: 'complete',
    category_id: 1,
    category_name: 'Ăn uống',
    source_id: WOORI_ID,
    transaction_date: '2026-09-10',
  },
  {
    id: 2,
    amount: 200_000,
    type: 'chi',
    status: 'complete',
    category_id: 2,
    category_name: 'Trà & Cà phê',
    source_id: WOORI_ID,
    transaction_date: '2026-09-15',
  },
  {
    id: 3,
    amount: 300_000,
    type: 'chi',
    status: 'complete',
    category_id: 1,
    category_name: 'Ăn uống',
    source_id: WOORI_ID,
    transaction_date: '2026-10-04',
  },
  {
    id: 4,
    amount: 999_000,
    type: 'chi',
    status: 'complete',
    category_id: 1,
    category_name: 'Ăn uống',
    source_id: OTHER_ID,
    transaction_date: '2026-09-10',
  },
  {
    id: 5,
    amount: 50_000,
    type: 'chi',
    status: 'complete',
    category_id: 3,
    category_name: 'Mua sắm',
    source_id: WOORI_ID,
    transaction_date: '2026-09-10',
  },
  {
    id: 6,
    amount: 80_000,
    type: 'chi',
    status: 'complete',
    category_id: 1,
    category_name: 'Ăn uống',
    source_id: WOORI_ID,
    transaction_date: '2026-09-04',
  },
  {
    id: 7,
    amount: 40_000,
    type: 'chi',
    status: 'complete',
    category_id: 4,
    category_name: 'Di chuyển',
    source_id: WOORI_ID,
    transaction_date: '2026-09-12',
  },
  {
    id: 8,
    amount: 70_000,
    type: 'chi',
    status: 'complete',
    category_id: 1,
    category_name: 'Ăn uống',
    source_id: 3, // Tiền mặt Kai id
    transaction_date: '2026-09-10',
  },
];

describe('Household Food Budget membership + consistency', () => {
  it('Woori source ID + any category counts; other IDs do not', () => {
    assert.equal(
      isHouseholdFoodBudgetTransaction({
        type: 'chi',
        status: 'complete',
        source_id: WOORI_ID,
        envelope_source_id: WOORI_ID,
        transaction_date: '2026-09-10',
        period,
      }),
      true,
    );
    assert.equal(
      isHouseholdFoodBudgetTransaction({
        type: 'chi',
        status: 'complete',
        source_id: OTHER_ID,
        envelope_source_id: WOORI_ID,
        transaction_date: '2026-09-10',
        period,
      }),
      false,
    );
  });

  it('summary, detail, and breakdown totals agree', () => {
    const qualifying = filterQualifyingHouseholdFoodBudgetTransactions(period, rows);
    const spent = sumQualifyingHouseholdFoodBudgetTransactions(period, rows);
    const breakdown = breakdownQualifyingHouseholdFoodBudgetTransactions(period, rows);

    assert.equal(spent, 690_000);
    assert.equal(
      qualifying.reduce((sum, row) => sum + row.amount, 0),
      spent,
    );
    assert.equal(
      breakdown.reduce((sum, row) => sum + row.amount, 0),
      spent,
    );
    assert.ok(breakdown.some((b) => b.category_name === 'Mua sắm'));
    assert.ok(breakdown.some((b) => b.category_name === 'Di chuyển'));

    const summary = computeBudgetAmountSummary(
      FIRST_HOUSEHOLD_FOOD_PERIOD.limit_amount,
      spent,
      FIRST_HOUSEHOLD_FOOD_PERIOD.carryover_amount,
    );
    assert.equal(summary.availableAmount, 7_723_550);
    assert.equal(summary.remainingAmount, 7_723_550 - spent);
  });

  it('current-period verified math: spent 4_434_700 → remaining 3_288_850', () => {
    const summary = computeBudgetAmountSummary(
      7_500_000,
      4_434_700,
      223_550,
    );
    assert.equal(summary.limitAmount, 7_500_000);
    assert.equal(summary.carryoverAmount, 223_550);
    assert.equal(summary.availableAmount, 7_723_550);
    assert.equal(summary.spentAmount, 4_434_700);
    assert.equal(summary.remainingAmount, 3_288_850);
    assert.equal(summary.overAmount, 0);
  });

  it('date boundary — 04/10 included, 05/10 excluded', () => {
    assert.equal(
      isHouseholdFoodBudgetTransaction({
        type: 'chi',
        status: 'complete',
        source_id: WOORI_ID,
        envelope_source_id: WOORI_ID,
        transaction_date: '2026-10-04',
        period,
      }),
      true,
    );
    assert.equal(
      isHouseholdFoodBudgetTransaction({
        type: 'chi',
        status: 'complete',
        source_id: WOORI_ID,
        envelope_source_id: WOORI_ID,
        transaction_date: '2026-10-05',
        period,
      }),
      false,
    );
  });
});
