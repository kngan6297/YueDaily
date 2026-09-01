// ============================================================
// Household Food Budget — period continuation lifecycle (pure)
// Cycle math describes a possible period; budget_periods records existence
// ============================================================

import { FIRST_HOUSEHOLD_FOOD_PERIOD } from '../constants/budget';
import {
  compareDateOnly,
  computeCycleStartContainingDate,
  periodEndFromCycleStart,
} from './budgetPeriodDomain';
import type { BudgetPeriod } from '../types';

export interface ContinuingPeriodDecision {
  shouldCreate: boolean;
  targetPeriodStart: string | null;
  targetPeriodEnd: string | null;
}

/**
 * Decide whether to auto-create exactly one continuing stored period for referenceDate.
 * Returns shouldCreate=false when no prior configured lineage exists (v4 empty guard).
 */
export function decideContinuingPeriodCreation(
  referenceDate: string,
  hasContainingPeriod: boolean,
  latestConfiguredPeriod: Pick<BudgetPeriod, 'period_start' | 'period_end' | 'limit_amount'> | null,
): ContinuingPeriodDecision {
  const none: ContinuingPeriodDecision = {
    shouldCreate: false,
    targetPeriodStart: null,
    targetPeriodEnd: null,
  };

  if (hasContainingPeriod) return none;
  if (!latestConfiguredPeriod) return none;
  if (compareDateOnly(referenceDate, FIRST_HOUSEHOLD_FOOD_PERIOD.period_start) < 0) {
    return none;
  }

  const targetPeriodStart = computeCycleStartContainingDate(referenceDate);
  if (compareDateOnly(targetPeriodStart, FIRST_HOUSEHOLD_FOOD_PERIOD.period_start) < 0) {
    return none;
  }
  if (compareDateOnly(targetPeriodStart, latestConfiguredPeriod.period_start) <= 0) {
    return none;
  }

  return {
    shouldCreate: true,
    targetPeriodStart,
    targetPeriodEnd: periodEndFromCycleStart(targetPeriodStart),
  };
}

export type BudgetCardPhase = 'no_period' | 'upcoming' | 'active' | 'over';

export function resolveBudgetCardPhase(
  referenceDate: string,
  activePeriod: Pick<BudgetPeriod, 'period_start' | 'period_end' | 'limit_amount'> | null,
  upcomingPeriod: Pick<BudgetPeriod, 'period_start' | 'period_end' | 'limit_amount'> | null,
  amounts: { overAmount: number; spentAmount: number } | null,
): BudgetCardPhase {
  if (activePeriod) {
    if (amounts && amounts.overAmount > 0) return 'over';
    return 'active';
  }
  if (upcomingPeriod && compareDateOnly(referenceDate, upcomingPeriod.period_start) < 0) {
    return 'upcoming';
  }
  return 'no_period';
}
