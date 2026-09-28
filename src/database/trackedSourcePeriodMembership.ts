// ============================================================
// Tracked-source period transaction membership (pure)
// Matches t.source_id to tracked_source_periods.source_id
// ============================================================

import { TRANSACTION_STATUS_COMPLETE } from '../types';
import { isDateInsideBudgetPeriod, type BudgetPeriodBounds } from './budgetPeriodDomain';

export interface TrackedSourceMembershipInput {
  type: string;
  status: string;
  /** Transaction source_id — compared to period.source_id only */
  source_id: number | null;
  /** Persisted on tracked_source_periods — never resolved by source name at runtime */
  tracked_source_id: number | null;
  transaction_date: string;
  period: BudgetPeriodBounds | null;
  /** category / expense_audience intentionally absent — ignored for membership */
}

/** Complete thu/chi against tracked source_id inside the calendar month */
export function isTrackedSourcePeriodTransaction(
  input: TrackedSourceMembershipInput,
): boolean {
  if (input.type !== 'thu' && input.type !== 'chi') return false;
  if (input.status !== TRANSACTION_STATUS_COMPLETE) return false;
  if (input.source_id == null || input.tracked_source_id == null) return false;
  if (input.source_id !== input.tracked_source_id) return false;
  if (!input.period) return false;
  return isDateInsideBudgetPeriod(input.transaction_date, input.period);
}
