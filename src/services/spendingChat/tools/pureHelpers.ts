// ============================================================
// Pure helpers for spending-chat tool tests (no Expo/SQLite)
// ============================================================

import type { SpendingChatFilters } from './allowlist';

export interface SummaryLike {
  totalChi: number;
  transactionCount: number;
}

export function needsCustomQuery(filters: SpendingChatFilters): boolean {
  return (
    (filters.categoryNames?.length ?? 0) > 0 ||
    (filters.excludedTransactionIds?.length ?? 0) > 0 ||
    (filters.transactionIds?.length ?? 0) > 0
  );
}

export function previousMonth(
  year: number,
  month: number,
): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function compareSummaries(a: SummaryLike, b: SummaryLike) {
  return {
    deltaTotalChi: a.totalChi - b.totalChi,
    deltaTransactionCount: a.transactionCount - b.transactionCount,
  };
}

export function vpBankNullOpeningSemantics(
  opening: number | null,
  income: number,
  expense: number,
) {
  const needsOpeningBalance = opening == null;
  return {
    opening_balance: opening,
    income,
    expense,
    current_balance: needsOpeningBalance
      ? null
      : (opening as number) + income - expense,
    needsOpeningBalance,
  };
}
