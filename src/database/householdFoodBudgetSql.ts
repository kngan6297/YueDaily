// ============================================================
// Household Food Budget — shared SQL membership predicate
// Uses persisted category.budget_group + source.spending_group only
// ============================================================

import { TRANSACTION_STATUS_COMPLETE } from '../types';

/** Canonical chi type stored in DB */
export const HOUSEHOLD_FOOD_TX_TYPE = 'chi' as const;

/**
 * Parameterized membership filter — always pair with stored period_start/end bounds.
 * Does NOT filter expense_audience, payer, source name, category name, or is_active.
 */
export function householdFoodBudgetMembershipWhere(
  periodStartParam = '?',
  periodEndParam = '?',
): string {
  return `
      t.type = '${HOUSEHOLD_FOOD_TX_TYPE}'
      AND t.status = '${TRANSACTION_STATUS_COMPLETE}'
      AND c.budget_group = 'household_food'
      AND s.spending_group = 'household'
      AND substr(t.created_at, 1, 10) >= ${periodStartParam}
      AND substr(t.created_at, 1, 10) <= ${periodEndParam}
    `;
}
