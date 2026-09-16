// ============================================================
// Household Food Budget — pure aggregate helpers
// ============================================================

import { isHouseholdFoodBudgetTransaction } from './householdFoodBudget';

export interface BudgetQualifyingTransactionInput {
  id: number;
  amount: number;
  type: string;
  status: string;
  category_id: number;
  category_name: string;
  source_id: number | null;
  transaction_date: string;
}

export function filterQualifyingHouseholdFoodBudgetTransactions(
  period: {
    period_start: string;
    period_end: string;
    envelope_source_id: number | null;
  },
  rows: readonly BudgetQualifyingTransactionInput[],
): BudgetQualifyingTransactionInput[] {
  return rows.filter((row) =>
    isHouseholdFoodBudgetTransaction({
      type: row.type,
      status: row.status,
      source_id: row.source_id,
      envelope_source_id: period.envelope_source_id,
      transaction_date: row.transaction_date,
      period,
    }),
  );
}

export function sumQualifyingHouseholdFoodBudgetTransactions(
  period: {
    period_start: string;
    period_end: string;
    envelope_source_id: number | null;
  },
  rows: readonly BudgetQualifyingTransactionInput[],
): number {
  return filterQualifyingHouseholdFoodBudgetTransactions(period, rows).reduce(
    (sum, row) => sum + row.amount,
    0,
  );
}

export function breakdownQualifyingHouseholdFoodBudgetTransactions(
  period: {
    period_start: string;
    period_end: string;
    envelope_source_id: number | null;
  },
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
  return [...map.values()].sort(
    (a, b) => b.amount - a.amount || a.category_name.localeCompare(b.category_name),
  );
}
