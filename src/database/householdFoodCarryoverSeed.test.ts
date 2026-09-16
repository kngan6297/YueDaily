import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  decideContinuingPeriodDefaults,
  decideFirstPeriodCarryoverSeed,
  decideFirstPeriodEnvelopeSourceSeed,
} from './householdFoodCarryoverSeed.ts';
import { FIRST_HOUSEHOLD_FOOD_PERIOD } from '../constants/budget.ts';

describe('first-period carryover seed idempotency', () => {
  it('applies 223550 once when carryover is 0', () => {
    const d = decideFirstPeriodCarryoverSeed({
      markerComplete: false,
      existingCarryover: 0,
    });
    assert.equal(d.shouldUpdate, true);
    assert.equal(d.carryoverToWrite, FIRST_HOUSEHOLD_FOOD_PERIOD.carryover_amount);
    assert.equal(d.shouldMark, true);
  });

  it('does not overwrite non-zero carryover (restore / edit preserve)', () => {
    const d = decideFirstPeriodCarryoverSeed({
      markerComplete: false,
      existingCarryover: 999_000,
    });
    assert.equal(d.shouldUpdate, false);
    assert.equal(d.shouldMark, true);
  });

  it('explicit carryover 0 with marker complete is never changed', () => {
    const d = decideFirstPeriodCarryoverSeed({
      markerComplete: true,
      existingCarryover: 0,
    });
    assert.equal(d.shouldUpdate, false);
    assert.equal(d.shouldMark, false);
  });

  it('marks even when period row is missing', () => {
    const d = decideFirstPeriodCarryoverSeed({
      markerComplete: false,
      existingCarryover: null,
    });
    assert.equal(d.shouldUpdate, false);
    assert.equal(d.shouldMark, true);
  });
});

describe('first-period envelope_source_id seed', () => {
  it('writes resolved source id when envelope is null', () => {
    const d = decideFirstPeriodEnvelopeSourceSeed({
      markerComplete: false,
      existingEnvelopeSourceId: null,
      resolvedSourceId: 7,
    });
    assert.equal(d.shouldUpdate, true);
    assert.equal(d.envelopeSourceIdToWrite, 7);
    assert.equal(d.shouldMark, true);
  });

  it('does not overwrite existing envelope_source_id', () => {
    const d = decideFirstPeriodEnvelopeSourceSeed({
      markerComplete: false,
      existingEnvelopeSourceId: 7,
      resolvedSourceId: 7,
    });
    assert.equal(d.shouldUpdate, false);
    assert.equal(d.shouldMark, true);
  });

  it('restart with marker is a no-op', () => {
    const d = decideFirstPeriodEnvelopeSourceSeed({
      markerComplete: true,
      existingEnvelopeSourceId: null,
      resolvedSourceId: 7,
    });
    assert.equal(d.shouldUpdate, false);
    assert.equal(d.shouldMark, false);
  });
});

describe('future period defaults', () => {
  it('inherits envelope_source_id but carryover = 0', () => {
    const d = decideContinuingPeriodDefaults({
      limit_amount: 7_500_000,
      envelope_source_id: 7,
    });
    assert.equal(d.limit_amount, 7_500_000);
    assert.equal(d.carryover_amount, 0);
    assert.equal(d.envelope_source_id, 7);
    assert.notEqual(d.carryover_amount, FIRST_HOUSEHOLD_FOOD_PERIOD.carryover_amount);
  });

  it('does not invent envelope id when latest has none', () => {
    const d = decideContinuingPeriodDefaults({
      limit_amount: 8_000_000,
      envelope_source_id: null,
    });
    assert.equal(d.envelope_source_id, null);
    assert.equal(d.carryover_amount, 0);
  });
});
