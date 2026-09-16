// ============================================================
// Household Food Budget transaction membership (pure)
// Envelope = persisted budget_periods.envelope_source_id
// ============================================================

import { TRANSACTION_STATUS_COMPLETE } from '../types';
import { isDateInsideBudgetPeriod, type BudgetPeriodBounds } from './budgetPeriodDomain';

export interface HouseholdFoodBudgetMembershipInput {
  type: string;
  status: string;
  /** Transaction source_id — compared to period.envelope_source_id only */
  source_id: number | null;
  /** Persisted on budget_periods — never resolved by source name at runtime */
  envelope_source_id: number | null;
  transaction_date: string;
  period: BudgetPeriodBounds | null;
}

export function isHouseholdFoodBudgetTransaction(
  input: HouseholdFoodBudgetMembershipInput,
): boolean {
  if (input.type !== 'chi' || input.status !== TRANSACTION_STATUS_COMPLETE) return false;
  if (input.source_id == null || input.envelope_source_id == null) return false;
  if (input.source_id !== input.envelope_source_id) return false;
  if (!input.period) return false;
  return isDateInsideBudgetPeriod(input.transaction_date, input.period);
}
