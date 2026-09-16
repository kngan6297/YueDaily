import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isHouseholdFoodBudgetTransaction } from './householdFoodBudget.ts';
import { FIRST_HOUSEHOLD_FOOD_PERIOD } from '../constants/budget.ts';

const period = {
  period_start: FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
  period_end: FIRST_HOUSEHOLD_FOOD_PERIOD.period_end,
};

const WOORI_ID = 7;

function membership(
  overrides: Partial<{
    type: string;
    status: string;
    source_id: number | null;
    envelope_source_id: number | null;
    transaction_date: string;
  }> = {},
) {
  return isHouseholdFoodBudgetTransaction({
    type: 'chi',
    status: 'complete',
    source_id: WOORI_ID,
    envelope_source_id: WOORI_ID,
    transaction_date: '2026-09-10',
    period,
    ...overrides,
  });
}

describe('Household Food Budget membership (envelope_source_id)', () => {
  it('Woori source ID + any category counts (category not an input)', () => {
    assert.equal(membership(), true);
  });

  it('source rename does not affect membership — only source_id vs envelope_source_id', () => {
    // Membership never reads source name; rename cannot change this predicate
    assert.equal(membership({ source_id: WOORI_ID, envelope_source_id: WOORI_ID }), true);
    // Simulate rename: name changed elsewhere, IDs unchanged → still counts
    assert.equal(
      isHouseholdFoodBudgetTransaction({
        type: 'chi',
        status: 'complete',
        source_id: WOORI_ID,
        envelope_source_id: WOORI_ID,
        transaction_date: '2026-09-20',
        period,
      }),
      true,
    );
  });

  it('archive (is_active) does not break membership — activity is not an input', () => {
    // Historical/current txs keep matching envelope_source_id regardless of archive flag
    assert.equal(membership({ source_id: WOORI_ID, envelope_source_id: WOORI_ID }), true);
  });

  it('another source id does not count even if it would share a similar name', () => {
    assert.equal(membership({ source_id: 99, envelope_source_id: WOORI_ID }), false);
  });

  it('null envelope_source_id excludes all', () => {
    assert.equal(membership({ envelope_source_id: null }), false);
  });

  it('excludes dates before first configured period', () => {
    assert.equal(membership({ transaction_date: '2026-09-04' }), false);
  });

  it('audience is not an input — predicate ignores it entirely', () => {
    assert.equal(membership(), true);
    assert.equal(membership({ source_id: 3 }), false);
  });

  it('excludes draft / thu', () => {
    assert.equal(membership({ status: 'draft' }), false);
    assert.equal(membership({ type: 'thu' }), false);
  });
});
