// ============================================================
// Household Food Budget — P1.6 domain constants (informational + period seed)
// cycle_start_day applies ONLY to budget_key = household_food
// ============================================================

export const HOUSEHOLD_FOOD_BUDGET_KEY = 'household_food' as const;

/** Kai salary / household food fund day — budget periods only, not general reporting */
export const HOUSEHOLD_FOOD_CYCLE_START_DAY = 5;

/** First explicitly configured P1.6 period (not August, not 01–04/09) */
export const FIRST_HOUSEHOLD_FOOD_PERIOD = {
  period_start: '2026-09-05',
  period_end: '2026-10-04',
  limit_amount: 7_500_000,
} as const;

/** Planned contribution ratios — display only; no ledger in P1.6A */
export const PLANNED_CONTRIBUTION_RATIOS = {
  kai: 0.8,
  yue: 0.2,
} as const;

export function plannedContributionAmounts(limitAmount: number): {
  kai: number;
  yue: number;
} {
  const kai = Math.round(limitAmount * PLANNED_CONTRIBUTION_RATIOS.kai);
  return {
    kai,
    yue: limitAmount - kai,
  };
}
