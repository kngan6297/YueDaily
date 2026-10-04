// ============================================================
// P2.2 — Native ReportRepository (wraps SQLite reportQueries)
// ============================================================

import {
  getDailyExpenseTotals as getDailyNative,
  getExpenseAudienceTotals as getAudienceNative,
  getExpenseCategoryTotals as getCategoryNative,
  getExpenseSourceTotals as getSourceNative,
  getExpenseSummary as getSummaryNative,
  getExpenseTransactions as getTxnsNative,
  type DailyAmount,
  type ExpenseSummary,
  type NamedAmount,
  type ReportFilters as NativeReportFilters,
  type ReportRange,
} from '../database/reportQueries';
import { mapNativeTransaction, requireNativeId } from './mappers';
import type { EntityId, FinanceTransaction } from './types';
import type { ExpenseAudience } from '../types';

export type { DailyAmount, ExpenseSummary, NamedAmount, ReportRange };

export interface ReportFilters {
  sourceId?: EntityId | 'all' | null;
  audience?: ExpenseAudience | 'all';
  search?: string;
}

function toNativeFilters(filters?: ReportFilters): NativeReportFilters | undefined {
  if (!filters) return undefined;
  let sourceId: number | 'all' | null | undefined;
  if (filters.sourceId === 'all' || filters.sourceId == null) {
    sourceId = filters.sourceId;
  } else {
    sourceId = requireNativeId(filters.sourceId);
  }
  return {
    sourceId,
    audience: filters.audience,
    search: filters.search,
  };
}

export async function getExpenseTransactions(
  range: ReportRange,
  filters?: ReportFilters,
): Promise<FinanceTransaction[]> {
  const rows = await getTxnsNative(range, toNativeFilters(filters));
  return rows.map((row) => mapNativeTransaction(row as Parameters<typeof mapNativeTransaction>[0]));
}

export async function getExpenseSummary(
  range: ReportRange,
  filters?: ReportFilters,
): Promise<ExpenseSummary> {
  return getSummaryNative(range, toNativeFilters(filters));
}

export async function getDailyExpenseTotals(
  range: ReportRange,
  filters?: ReportFilters,
): Promise<DailyAmount[]> {
  return getDailyNative(range, toNativeFilters(filters));
}

export async function getExpenseSourceTotals(
  range: ReportRange,
  filters?: ReportFilters,
): Promise<NamedAmount[]> {
  return getSourceNative(range, toNativeFilters(filters));
}

export async function getExpenseAudienceTotals(
  range: ReportRange,
  filters?: ReportFilters,
): Promise<NamedAmount[]> {
  return getAudienceNative(range, toNativeFilters(filters));
}

export async function getExpenseCategoryTotals(
  range: ReportRange,
  filters?: ReportFilters,
): Promise<NamedAmount[]> {
  return getCategoryNative(range, toNativeFilters(filters));
}
