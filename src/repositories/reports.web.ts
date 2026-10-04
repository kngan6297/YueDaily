// ============================================================
// P2.2 — Web ReportRepository
// Fetch date-bounded rows via Supabase, reuse pure calculations.
// ============================================================

import {
  aggregateByAudience,
  aggregateBySource,
  computeExpenseSummaryMetrics,
  EXPENSE_DISPLAY_LIMIT,
  resolveReportRange,
  type DailyAmount,
  type NamedAmount,
  type ReportRange,
} from '../database/reportCalculations';
import { parseVndAmountFromSearch } from '../database/reportCalculations';
import type { ExpenseAudience } from '../types';
import { normalizeExpenseAudience } from '../types';
import { logDataErrorDev, normalizeDataError } from './errors';
import { mapCloudTransaction, type CloudTransactionRow } from './mappers';
import { requireSupabaseClient } from './requireClient.web';
import type { EntityId, FinanceTransaction } from './types';

export type { DailyAmount, NamedAmount, ReportRange };

export interface ReportFilters {
  sourceId?: EntityId | 'all' | null;
  audience?: ExpenseAudience | 'all';
  search?: string;
}

export interface ExpenseSummary {
  totalChi: number;
  transactionCount: number;
  averagePerTransaction: number;
  averagePerDay: number;
  calendarDays: number;
}

const TXN_SELECT = `
  id, amount, type, category_id, source_id, payer, expense_audience,
  image_uri, location, note, status, transaction_date, created_at,
  categories ( name, icon, color ),
  sources ( name )
`;

function matchesSearch(txn: FinanceTransaction, search: string): boolean {
  const trimmed = search.trim();
  if (!trimmed) return true;
  const amount = parseVndAmountFromSearch(trimmed);
  if (amount !== null) return txn.amount === amount;
  const q = trimmed.toLowerCase();
  return (
    (txn.note ?? '').toLowerCase().includes(q) ||
    (txn.location ?? '').toLowerCase().includes(q) ||
    (txn.category_name ?? '').toLowerCase().includes(q) ||
    txn.payer.toLowerCase().includes(q)
  );
}

function applyFilters(rows: FinanceTransaction[], filters?: ReportFilters): FinanceTransaction[] {
  if (!filters) return rows;
  return rows.filter((t) => {
    if (filters.sourceId && filters.sourceId !== 'all' && t.source_id !== filters.sourceId) {
      return false;
    }
    if (filters.audience && filters.audience !== 'all') {
      if (normalizeExpenseAudience(t.expense_audience) !== filters.audience) return false;
    }
    if (filters.search && !matchesSearch(t, filters.search)) return false;
    return true;
  });
}

async function fetchPeriodTransactions(range: ReportRange): Promise<FinanceTransaction[]> {
  const client = requireSupabaseClient();
  const resolved = resolveReportRange(range);
  // Inclusive local calendar bounds on transaction_date (YYYY-MM-DD)
  const { data, error } = await client
    .from('transactions')
    .select(TXN_SELECT)
    .eq('status', 'complete')
    .eq('type', 'chi')
    .gte('transaction_date', resolved.fromDate)
    .lte('transaction_date', resolved.toDate)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapCloudTransaction(row as unknown as CloudTransactionRow));
}

async function loadFiltered(
  range: ReportRange,
  filters?: ReportFilters,
): Promise<{ rows: FinanceTransaction[]; calendarDays: number }> {
  const resolved = resolveReportRange(range);
  const rows = applyFilters(await fetchPeriodTransactions(range), filters);
  return { rows, calendarDays: resolved.calendarDays };
}

export async function getExpenseTransactions(
  range: ReportRange,
  filters?: ReportFilters,
): Promise<FinanceTransaction[]> {
  try {
    const { rows } = await loadFiltered(range, filters);
    return rows.slice(0, EXPENSE_DISPLAY_LIMIT);
  } catch (err) {
    logDataErrorDev('getExpenseTransactions', 'reports', err);
    throw normalizeDataError(err, 'reports');
  }
}

export async function getExpenseSummary(
  range: ReportRange,
  filters?: ReportFilters,
): Promise<ExpenseSummary> {
  try {
    const { rows, calendarDays } = await loadFiltered(range, filters);
    const totalChi = rows.reduce((s, t) => s + t.amount, 0);
    const transactionCount = rows.length;
    const metrics = computeExpenseSummaryMetrics(totalChi, transactionCount, calendarDays);
    return { totalChi, transactionCount, ...metrics };
  } catch (err) {
    logDataErrorDev('getExpenseSummary', 'reports', err);
    throw normalizeDataError(err, 'reports');
  }
}

export async function getDailyExpenseTotals(
  range: ReportRange,
  filters?: ReportFilters,
): Promise<DailyAmount[]> {
  try {
    const { rows } = await loadFiltered(range, filters);
    const map = new Map<string, number>();
    for (const t of rows) {
      const date = t.transaction_date;
      map.set(date, (map.get(date) ?? 0) + t.amount);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({
        date,
        day: Number(date.slice(8, 10)),
        amount,
      }));
  } catch (err) {
    logDataErrorDev('getDailyExpenseTotals', 'reports', err);
    throw normalizeDataError(err, 'reports');
  }
}

export async function getExpenseSourceTotals(
  range: ReportRange,
  filters?: ReportFilters,
): Promise<NamedAmount[]> {
  try {
    const { rows } = await loadFiltered(range, filters);
    return aggregateBySource(
      rows.map((t) => ({
        source_id: t.source_id,
        source_name: t.source_name,
        amount: t.amount,
      })),
    );
  } catch (err) {
    logDataErrorDev('getExpenseSourceTotals', 'reports', err);
    throw normalizeDataError(err, 'reports');
  }
}

export async function getExpenseAudienceTotals(
  range: ReportRange,
  filters?: ReportFilters,
): Promise<NamedAmount[]> {
  try {
    const { rows } = await loadFiltered(range, filters);
    return aggregateByAudience(
      rows.map((t) => ({
        expense_audience: t.expense_audience,
        amount: t.amount,
      })),
    );
  } catch (err) {
    logDataErrorDev('getExpenseAudienceTotals', 'reports', err);
    throw normalizeDataError(err, 'reports');
  }
}

export async function getExpenseCategoryTotals(
  range: ReportRange,
  filters?: ReportFilters,
): Promise<NamedAmount[]> {
  try {
    const { rows } = await loadFiltered(range, filters);
    const map = new Map<string, NamedAmount>();
    for (const t of rows) {
      const key = t.category_id ?? 'null';
      const name = t.category_name ?? 'Không rõ danh mục';
      const existing = map.get(key) ?? {
        name,
        amount: 0,
        icon: t.category_icon ?? undefined,
        color: t.category_color ?? undefined,
      };
      existing.amount += t.amount;
      map.set(key, existing);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  } catch (err) {
    logDataErrorDev('getExpenseCategoryTotals', 'reports', err);
    throw normalizeDataError(err, 'reports');
  }
}
