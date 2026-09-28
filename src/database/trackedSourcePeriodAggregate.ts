// ============================================================
// Tracked-source period — pure aggregate helpers
// ============================================================

import { isTrackedSourcePeriodTransaction } from './trackedSourcePeriodMembership';

export interface TrackedSourceQualifyingTransactionInput {
  id: number;
  amount: number;
  type: string;
  status: string;
  category_id: number | null;
  category_name?: string;
  expense_audience?: string;
  source_id: number | null;
  transaction_date: string;
}

export function filterQualifyingTrackedSourceTransactions(
  period: {
    period_start: string;
    period_end: string;
    source_id: number;
  },
  rows: readonly TrackedSourceQualifyingTransactionInput[],
): TrackedSourceQualifyingTransactionInput[] {
  return rows.filter((row) =>
    isTrackedSourcePeriodTransaction({
      type: row.type,
      status: row.status,
      source_id: row.source_id,
      tracked_source_id: period.source_id,
      transaction_date: row.transaction_date,
      period,
    }),
  );
}

export function sumTrackedSourceIncomeExpense(
  period: {
    period_start: string;
    period_end: string;
    source_id: number;
  },
  rows: readonly TrackedSourceQualifyingTransactionInput[],
): { incomeAmount: number; expenseAmount: number } {
  let incomeAmount = 0;
  let expenseAmount = 0;
  for (const row of filterQualifyingTrackedSourceTransactions(period, rows)) {
    if (row.type === 'thu') incomeAmount += row.amount;
    else if (row.type === 'chi') expenseAmount += row.amount;
  }
  return { incomeAmount, expenseAmount };
}
