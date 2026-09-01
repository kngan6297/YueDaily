// ============================================================
// Household Food Budget — pure aggregate helpers for tests + consistency
// ============================================================

import { isHouseholdFoodBudgetTransaction } from './householdFoodBudget';
import type { BudgetGroup, SourceSpendingGroup } from '../types';

export interface BudgetQualifyingTransactionInput {
  id: number;
  amount: number;
  type: string;
  status: string;
  category_id: number;
  category_name: string;
  category_budget_group: BudgetGroup | null;
  source_spending_group: SourceSpendingGroup | null;
  transaction_date: string;
}

export function filterQualifyingHouseholdFoodBudgetTransactions(
  period: { period_start: string; period_end: string },
  rows: readonly BudgetQualifyingTransactionInput[],
): BudgetQualifyingTransactionInput[] {
  return rows.filter((row) =>
    isHouseholdFoodBudgetTransaction({
      type: row.type,
      status: row.status,
      category_budget_group: row.category_budget_group,
      source_spending_group: row.source_spending_group,
      transaction_date: row.transaction_date,
      period,
    }),
  );
}

export function sumQualifyingHouseholdFoodBudgetTransactions(
  period: { period_start: string; period_end: string },
  rows: readonly BudgetQualifyingTransactionInput[],
): number {
  return filterQualifyingHouseholdFoodBudgetTransactions(period, rows).reduce(
    (sum, row) => sum + row.amount,
    0,
  );
}

export function breakdownQualifyingHouseholdFoodBudgetTransactions(
  period: { period_start: string; period_end: string },
  rows: readonly BudgetQualifyingTransactionInput[],
): Array<{ category_id: number; category_name: string; amount: number }> {
  const qualifying = filterQualifyingHouseholdFoodBudgetTransactions(period, rows);
  const map = new Map<number, { category_id: number; category_name: string; amount: number }>();
  for (const row of qualifying) {
    const existing = map.get(row.category_id);
    if (existing) {
      existing.amount += row.amount;
    } else {
      map.set(row.category_id, {
        category_id: row.category_id,
        category_name: row.category_name,
        amount: row.amount,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount || a.category_name.localeCompare(b.category_name));
}
