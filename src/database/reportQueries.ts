// ============================================================
// TRUY VẤN BÁO CÁO CHI TIÊU — dùng chung Home + Thống kê
// ============================================================

import {
  buildMonthDailySeries,
  buildSearchFilter,
  computeExpenseSummaryMetrics,
  highestSpendingDay,
  resolveReportRange,
  type DailyAmount,
  type ReportPeriodKind,
  type ReportRange,
  type ResolvedReportRange,
} from './reportCalculations';
import { getDatabase } from './initDb';
import { normalizeExpenseAudience } from './transactions';
import type { ExpenseAudience, Transaction } from '../types';
import { EXPENSE_AUDIENCE_LABELS, TRANSACTION_STATUS_COMPLETE } from '../types';

export type { ReportPeriodKind, ReportRange, ResolvedReportRange, DailyAmount };
export {
  buildMonthDailySeries,
  buildSearchFilter,
  computeExpenseSummaryMetrics,
  highestSpendingDay,
  isExpenseTransaction,
  parseVndAmountFromSearch,
  resolveReportRange,
} from './reportCalculations';

export interface ReportFilters {
  payer?: string;
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

export interface NamedAmount {
  name: string;
  amount: number;
  icon?: string;
  color?: string;
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
  let clause = '';
  const params: (string | number)[] = [];

  if (filters.payer && filters.payer !== 'all') {
    clause += ' AND t.payer = ?';
    params.push(filters.payer);
  }

  if (filters.audience && filters.audience !== 'all') {
    clause += ' AND t.expense_audience = ?';
    params.push(filters.audience);
  }

  const search = filters.search?.trim() ?? '';
  if (search) {
    const { clause: searchCl, params: searchParams } = buildSearchFilter(search);
    clause += searchCl;
    params.push(...searchParams);
  }

  return { clause, params };
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
     LIMIT 50;`,
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

export function aggregateByPayer(transactions: TransactionWithMeta[]): NamedAmount[] {
  const map = new Map<string, NamedAmount>();
  for (const t of transactions) {
    const existing = map.get(t.payer) ?? { name: t.payer, amount: 0 };
    existing.amount += t.amount;
    map.set(t.payer, existing);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export function aggregateByAudience(transactions: TransactionWithMeta[]): NamedAmount[] {
  const map = new Map<string, NamedAmount>();
  for (const t of transactions) {
    const key = t.expense_audience ?? 'unspecified';
    const name = EXPENSE_AUDIENCE_LABELS[key] ?? key;
    const existing = map.get(key) ?? { name, amount: 0 };
    existing.amount += t.amount;
    map.set(key, existing);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}
