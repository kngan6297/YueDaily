// ============================================================
// Household Food Budget transaction membership (pure — P1.6A foundation)
// expense_audience does NOT participate
// ============================================================

import type { BudgetGroup, SourceSpendingGroup } from '../types';
import { TRANSACTION_STATUS_COMPLETE } from '../types';
import { isDateInsideBudgetPeriod, type BudgetPeriodBounds } from './budgetPeriodDomain';

export interface HouseholdFoodBudgetMembershipInput {
  type: string;
  status: string;
  category_budget_group: BudgetGroup | null;
  source_spending_group: SourceSpendingGroup | null;
  transaction_date: string;
  period: BudgetPeriodBounds | null;
}

export function isHouseholdFoodBudgetTransaction(
  input: HouseholdFoodBudgetMembershipInput,
): boolean {
  if (input.type !== 'chi' || input.status !== TRANSACTION_STATUS_COMPLETE) return false;
  if (input.category_budget_group !== 'household_food') return false;
  if (input.source_spending_group !== 'household') return false;
  if (!input.period) return false;
  return isDateInsideBudgetPeriod(input.transaction_date, input.period);
}
