// ============================================================
// Household Food Budget — shared SQL membership predicate
// Matches t.source_id to budget_periods.envelope_source_id
// ============================================================

import { TRANSACTION_STATUS_COMPLETE } from '../types';

/** Canonical chi type stored in DB */
export const HOUSEHOLD_FOOD_TX_TYPE = 'chi' as const;

/**
 * Parameterized membership filter.
 * Bind order: envelope_source_id, period_start, period_end.
 * Does NOT filter by source name, category, audience, payer, or is_active.
 */
export function householdFoodBudgetMembershipWhere(
  envelopeSourceIdParam = '?',
  periodStartParam = '?',
  periodEndParam = '?',
): string {
  return `
      t.type = '${HOUSEHOLD_FOOD_TX_TYPE}'
      AND t.status = '${TRANSACTION_STATUS_COMPLETE}'
      AND t.source_id = ${envelopeSourceIdParam}
      AND substr(t.created_at, 1, 10) >= ${periodStartParam}
      AND substr(t.created_at, 1, 10) <= ${periodEndParam}
    `;
}
