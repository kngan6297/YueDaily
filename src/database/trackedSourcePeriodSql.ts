// ============================================================
// Tracked-source period — shared SQL membership predicate
// ============================================================

import { TRANSACTION_STATUS_COMPLETE } from '../types';

/**
 * Parameterized membership filter for tracked-source balance.
 * Bind order: source_id, period_start, period_end.
 * Does NOT filter by source name, category, audience, payer, or is_active.
 * Includes both thu and chi.
 */
export function trackedSourcePeriodMembershipWhere(
  sourceIdParam = '?',
  periodStartParam = '?',
  periodEndParam = '?',
): string {
  return `
      t.status = '${TRANSACTION_STATUS_COMPLETE}'
      AND t.source_id = ${sourceIdParam}
      AND (t.type = 'thu' OR t.type = 'chi')
      AND substr(t.created_at, 1, 10) >= ${periodStartParam}
      AND substr(t.created_at, 1, 10) <= ${periodEndParam}
    `;
}
