// ============================================================
// First-period carryover + envelope source seed — pure decisions
// ============================================================

import { FIRST_HOUSEHOLD_FOOD_PERIOD } from '../constants/budget';

/**
 * Marker-guarded seed for 2026-09-05 carryover.
 * Only writes when existing carryover is exactly 0.
 */
export function decideFirstPeriodCarryoverSeed(input: {
  markerComplete: boolean;
  existingCarryover: number | null;
}): {
  shouldUpdate: boolean;
  carryoverToWrite: number | null;
  shouldMark: boolean;
} {
  if (input.markerComplete) {
    return { shouldUpdate: false, carryoverToWrite: null, shouldMark: false };
  }
  if (input.existingCarryover === 0) {
    return {
      shouldUpdate: true,
      carryoverToWrite: FIRST_HOUSEHOLD_FOOD_PERIOD.carryover_amount,
      shouldMark: true,
    };
  }
  return { shouldUpdate: false, carryoverToWrite: null, shouldMark: true };
}

/**
 * Marker-guarded seed: persist resolved Woori source id onto first period
 * when envelope_source_id is still NULL. Name resolution happens once outside.
 */
export function decideFirstPeriodEnvelopeSourceSeed(input: {
  markerComplete: boolean;
  existingEnvelopeSourceId: number | null;
  resolvedSourceId: number | null;
}): {
  shouldUpdate: boolean;
  envelopeSourceIdToWrite: number | null;
  shouldMark: boolean;
} {
  if (input.markerComplete) {
    return { shouldUpdate: false, envelopeSourceIdToWrite: null, shouldMark: false };
  }
  if (
    input.existingEnvelopeSourceId == null &&
    input.resolvedSourceId != null &&
    Number.isInteger(input.resolvedSourceId) &&
    input.resolvedSourceId > 0
  ) {
    return {
      shouldUpdate: true,
      envelopeSourceIdToWrite: input.resolvedSourceId,
      shouldMark: true,
    };
  }
  return { shouldUpdate: false, envelopeSourceIdToWrite: null, shouldMark: true };
}

/** Future periods inherit envelope_source_id; never inherit carryover. */
export function decideContinuingPeriodDefaults(latest: {
  limit_amount: number;
  envelope_source_id: number | null;
} | null): {
  limit_amount: number;
  carryover_amount: number;
  envelope_source_id: number | null;
} {
  return {
    limit_amount: latest?.limit_amount ?? FIRST_HOUSEHOLD_FOOD_PERIOD.limit_amount,
    carryover_amount: 0,
    envelope_source_id: latest?.envelope_source_id ?? null,
  };
}
