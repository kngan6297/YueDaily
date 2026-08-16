// ============================================================
// TRUY VẤN BÁO CÁO CHI TIÊU — dùng chung Home + Thống kê
// ============================================================

import {
  aggregateByAudience,
  aggregateBySource,
  buildMonthDailySeries,
  buildReportFilterClauses,
  computeExpenseSummaryMetrics,
  EXPENSE_DISPLAY_LIMIT,
  highestSpendingDay,
  resolveReportRange,
  type DailyAmount,
  type NamedAmount,
  type ReportPeriodKind,
  type ReportRange,
  type ResolvedReportRange,
} from './reportCalculations';
import { getDatabase } from './initDb';
import { normalizeExpenseAudience } from '../types';
import type { ExpenseAudience, Transaction } from '../types';
import { TRANSACTION_STATUS_COMPLETE } from '../types';

export type { ReportPeriodKind, ReportRange, ResolvedReportRange, DailyAmount, NamedAmount };
export {
  aggregateByAudience,
  aggregateBySource,
  buildMonthDailySeries,
  buildSearchFilter,
  computeExpenseSummaryMetrics,
  EXPENSE_DISPLAY_LIMIT,
  highestSpendingDay,
  isExpenseTransaction,
  parseVndAmountFromSearch,
  resolveReportRange,
} from './reportCalculations';

export interface ReportFilters {
  sourceId?: number | 'all' | null;
  audience?: ExpenseAudience | 'all';
  search?: string;
  /** Legacy — UI P1.5 không dùng làm primary filter */
  payer?: string;
}

export interface ExpenseSummary {
  totalChi: number;
  transactionCount: number;
  averagePerTransaction: number;
  averagePerDay: number;
  calendarDays: number;
}

export type TransactionWithMeta = Transaction & {
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  source_name?: string;
};

const EXPENSE_BASE = `t.status = '${TRANSACTION_STATUS_COMPLETE}' AND t.type = 'chi'`;

function mapRow(row: TransactionWithMeta): TransactionWithMeta {
  return {
    ...row,
    expense_audience: normalizeExpenseAudience(row.expense_audience),
  };
}

function buildFilterClauses(filters: ReportFilters): { clause: string; params: (string | number)[] } {
  return buildReportFilterClauses(filters);
}

function rangeClause(resolved: ResolvedReportRange): { clause: string; params: string[] } {
  return {
    clause: ' AND date(t.created_at) >= date(?) AND date(t.created_at) <= date(?)',
    params: [resolved.fromDate, resolved.toDate],
  };
}

export async function getExpenseTransactions(
  range: ReportRange,
  filters: ReportFilters = {},
): Promise<TransactionWithMeta[]> {
  const db = await getDatabase();
  const resolved = resolveReportRange(range);
  const { clause: rangeCl, params: rangeParams } = rangeClause(resolved);
  const { clause: filterCl, params: filterParams } = buildFilterClauses(filters);

  const rows = await db.getAllAsync<TransactionWithMeta>(
    `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
            s.name as source_name
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN sources s ON t.source_id = s.id
     WHERE ${EXPENSE_BASE}${rangeCl}${filterCl}
     ORDER BY t.created_at DESC
     LIMIT ${EXPENSE_DISPLAY_LIMIT};`,
    [...rangeParams, ...filterParams],
  );

  return rows.map(mapRow);
}

export async function getExpenseSummary(
  range: ReportRange,
  filters: ReportFilters = {},
): Promise<ExpenseSummary> {
  const db = await getDatabase();
  const resolved = resolveReportRange(range);
  const { clause: rangeCl, params: rangeParams } = rangeClause(resolved);
  const { clause: filterCl, params: filterParams } = buildFilterClauses(filters);

  const row = await db.getFirstAsync<{ total: number; cnt: number }>(
    `SELECT COALESCE(SUM(t.amount), 0) as total, COUNT(*) as cnt
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE ${EXPENSE_BASE}${rangeCl}${filterCl};`,
    [...rangeParams, ...filterParams],
  );

  const totalChi = row?.total ?? 0;
  const transactionCount = row?.cnt ?? 0;
  const metrics = computeExpenseSummaryMetrics(totalChi, transactionCount, resolved.calendarDays);

  return {
    totalChi,
    transactionCount,
    ...metrics,
  };
}

export async function getDailyExpenseTotals(
  range: ReportRange,
  filters: ReportFilters = {},
): Promise<DailyAmount[]> {
  const db = await getDatabase();
  const resolved = resolveReportRange(range);
  const { clause: rangeCl, params: rangeParams } = rangeClause(resolved);
  const { clause: filterCl, params: filterParams } = buildFilterClauses(filters);

  const rows = await db.getAllAsync<{ date: string; day: number; amount: number }>(
    `SELECT date(t.created_at) as date,
            CAST(strftime('%d', t.created_at) AS INTEGER) as day,
            SUM(t.amount) as amount
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE ${EXPENSE_BASE}${rangeCl}${filterCl}
     GROUP BY date(t.created_at)
     ORDER BY date ASC;`,
    [...rangeParams, ...filterParams],
  );

  return rows.map((r) => ({ date: r.date, day: r.day, amount: r.amount }));
}

function scopedExpenseQuery(range: ReportRange, filters: ReportFilters) {
  const resolved = resolveReportRange(range);
  const { clause: rangeCl, params: rangeParams } = rangeClause(resolved);
  const { clause: filterCl, params: filterParams } = buildFilterClauses(filters);
  return {
    where: `${EXPENSE_BASE}${rangeCl}${filterCl}`,
    params: [...rangeParams, ...filterParams],
  };
}

/** Chi theo nguồn — toàn bộ giao dịch khớp filter, không LIMIT list. */
export async function getExpenseSourceTotals(
  range: ReportRange,
  filters: ReportFilters = {},
): Promise<NamedAmount[]> {
  const db = await getDatabase();
  const { where, params } = scopedExpenseQuery(range, filters);
  const rows = await db.getAllAsync<{
    source_id: number | null;
    source_name: string;
    amount: number;
  }>(
    `SELECT t.source_id,
            COALESCE(s.name, 'Không rõ nguồn') as source_name,
            COALESCE(SUM(t.amount), 0) as amount
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN sources s ON t.source_id = s.id
     WHERE ${where}
     GROUP BY t.source_id
     ORDER BY amount DESC;`,
    params,
  );
  return aggregateBySource(rows);
}

/** Chi cho ai — toàn bộ giao dịch khớp filter, không LIMIT list. */
export async function getExpenseAudienceTotals(
  range: ReportRange,
  filters: ReportFilters = {},
): Promise<NamedAmount[]> {
  const db = await getDatabase();
  const { where, params } = scopedExpenseQuery(range, filters);
  const rows = await db.getAllAsync<{
    expense_audience: string | null;
    amount: number;
  }>(
    `SELECT t.expense_audience,
            COALESCE(SUM(t.amount), 0) as amount
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE ${where}
     GROUP BY t.expense_audience
     ORDER BY amount DESC;`,
    params,
  );
  return aggregateByAudience(rows);
}

/** Chi theo danh mục — cùng semantics unlimited như source/audience. */
export async function getExpenseCategoryTotals(
  range: ReportRange,
  filters: ReportFilters = {},
): Promise<NamedAmount[]> {
  const db = await getDatabase();
  const { where, params } = scopedExpenseQuery(range, filters);
  const rows = await db.getAllAsync<{
    name: string;
    icon: string | null;
    color: string | null;
    amount: number;
  }>(
    `SELECT COALESCE(c.name, 'Không rõ danh mục') as name,
            c.icon as icon,
            c.color as color,
            COALESCE(SUM(t.amount), 0) as amount
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE ${where}
     GROUP BY t.category_id
     ORDER BY amount DESC;`,
    params,
  );
  return rows.map((r) => ({
    name: r.name,
    amount: r.amount,
    icon: r.icon ?? undefined,
    color: r.color ?? undefined,
  }));
}

export function aggregateByCategory(transactions: TransactionWithMeta[]): NamedAmount[] {
  const map = new Map<string, NamedAmount>();
  for (const t of transactions) {
    const name = t.category_name ?? 'Không rõ danh mục';
    const existing = map.get(name) ?? {
      name,
      amount: 0,
      icon: t.category_icon,
      color: t.category_color,
    };
    existing.amount += t.amount;
    map.set(name, existing);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}
