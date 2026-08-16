// Pure report calculations — no SQLite imports (testable in Node)

import {
  calendarDaysInMonthPeriod,
  daysInclusive,
  normalizeCustomRange,
  todayLocal,
} from '../utils/date';
import type { ExpenseAudience } from '../types/index';
import { EXPENSE_AUDIENCE_LABELS, normalizeExpenseAudience } from '../types/index';

export type ReportPeriodKind = 'day' | 'month' | 'custom';

export interface ReportRange {
  kind: ReportPeriodKind;
  date?: string;
  year?: number;
  month?: number;
  fromDate?: string;
  toDate?: string;
}

export interface ResolvedReportRange {
  fromDate: string;
  toDate: string;
  calendarDays: number;
}

export interface DailyAmount {
  date: string;
  day: number;
  amount: number;
}

export interface ExpenseSummaryMetrics {
  averagePerTransaction: number;
  averagePerDay: number;
  calendarDays: number;
}

/** Giải mã kỳ báo cáo → from/to + số ngày lịch */
export function resolveReportRange(range: ReportRange): ResolvedReportRange {
  const today = todayLocal();

  if (range.kind === 'day') {
    const date = range.date ?? today;
    const safe = date > today ? today : date;
    return { fromDate: safe, toDate: safe, calendarDays: 1 };
  }

  if (range.kind === 'month') {
    const now = new Date();
    const year = range.year ?? now.getFullYear();
    const month = range.month ?? now.getMonth() + 1;
    const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = calendarDaysInMonthPeriod(year, month);
    const toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { fromDate, toDate, calendarDays: lastDay };
  }

  const { fromDate, toDate } = normalizeCustomRange(
    range.fromDate ?? today,
    range.toDate ?? today,
  );
  return {
    fromDate,
    toDate,
    calendarDays: daysInclusive(fromDate, toDate),
  };
}

export function parseVndAmountFromSearch(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withoutCurrency = trimmed.replace(/đ/gi, '').trim();
  const core = withoutCurrency.replace(/[\s.,]/g, '');

  if (!/^\d+$/.test(core)) return null;

  const amount = parseInt(core, 10);
  return amount > 0 ? amount : null;
}

export function buildSearchFilter(rawSearch: string): {
  clause: string;
  params: (string | number)[];
} {
  const trimmedSearch = rawSearch.trim();
  if (!trimmedSearch) {
    return { clause: '', params: [] };
  }

  const amount = parseVndAmountFromSearch(trimmedSearch);
  if (amount !== null) {
    return { clause: ' AND t.amount = ?', params: [amount] };
  }

  const like = `%${trimmedSearch.toLowerCase()}%`;
  return {
    clause: ` AND (
      LOWER(COALESCE(t.note, '')) LIKE ?
      OR LOWER(COALESCE(t.location, '')) LIKE ?
      OR LOWER(COALESCE(c.name, '')) LIKE ?
      OR LOWER(t.payer) LIKE ?
    )`,
    params: [like, like, like, like],
  };
}

export function isExpenseTransaction(type: string): boolean {
  return type === 'chi';
}

export function computeExpenseSummaryMetrics(
  totalChi: number,
  transactionCount: number,
  calendarDays: number,
): ExpenseSummaryMetrics {
  const days = Math.max(calendarDays, 1);
  return {
    calendarDays: days,
    averagePerTransaction: transactionCount > 0 ? totalChi / transactionCount : 0,
    averagePerDay: totalChi / days,
  };
}

export function buildMonthDailySeries(
  year: number,
  month: number,
  daily: DailyAmount[],
): DailyAmount[] {
  const elapsed = calendarDaysInMonthPeriod(year, month);
  const byDay = new Map(daily.map((d) => [d.day, d.amount]));
  const series: DailyAmount[] = [];
  for (let day = 1; day <= elapsed; day++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    series.push({ date, day, amount: byDay.get(day) ?? 0 });
  }
  return series;
}

export function highestSpendingDay(series: DailyAmount[]): DailyAmount | null {
  if (series.length === 0) return null;
  return series.reduce((best, cur) => (cur.amount > best.amount ? cur : best));
}

/** List hiển thị trên Thống kê — aggregation báo cáo KHÔNG dùng limit này. */
export const EXPENSE_DISPLAY_LIMIT = 50;

export function limitExpenseDisplayList<T>(rows: T[], limit = EXPENSE_DISPLAY_LIMIT): T[] {
  return rows.slice(0, limit);
}

export function sumNamedAmounts(rows: NamedAmount[]): number {
  return rows.reduce((s, r) => s + r.amount, 0);
}

export interface ReportFilterInput {
  sourceId?: number | 'all' | null;
  audience?: ExpenseAudience | 'all';
  /** Legacy — UI P1.5 không gửi; giữ để query layer tương thích */
  payer?: string;
  search?: string;
}

export interface NamedAmount {
  name: string;
  amount: number;
  icon?: string;
  color?: string;
}

/** SQL filter clauses — source + audience độc lập, có thể cross-filter. */
export function buildReportFilterClauses(filters: ReportFilterInput): {
  clause: string;
  params: (string | number)[];
} {
  let clause = '';
  const params: (string | number)[] = [];

  if (typeof filters.sourceId === 'number') {
    clause += ' AND t.source_id = ?';
    params.push(filters.sourceId);
  }

  if (filters.audience && filters.audience !== 'all') {
    clause += ' AND t.expense_audience = ?';
    params.push(filters.audience);
  }

  if (filters.payer && filters.payer !== 'all') {
    clause += ' AND t.payer = ?';
    params.push(filters.payer);
  }

  const search = filters.search?.trim() ?? '';
  if (search) {
    const { clause: searchCl, params: searchParams } = buildSearchFilter(search);
    clause += searchCl;
    params.push(...searchParams);
  }

  return { clause, params };
}

export interface SourceAmountRow {
  source_id: number | null;
  source_name?: string | null;
  amount: number;
}

export interface AudienceAmountRow {
  expense_audience?: ExpenseAudience | string | null;
  amount: number;
}

/** Gom theo source_id — không merge hai source khác id dù tên giống. */
export function aggregateBySource(transactions: SourceAmountRow[]): NamedAmount[] {
  const map = new Map<string, NamedAmount>();
  for (const t of transactions) {
    const key = t.source_id == null ? 'null' : String(t.source_id);
    const name = t.source_name?.trim() || 'Không rõ nguồn';
    const existing = map.get(key) ?? { name, amount: 0 };
    existing.amount += t.amount;
    map.set(key, existing);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

/** Một transaction thuộc đúng một audience — không split, không double-count. */
export function aggregateByAudience(transactions: AudienceAmountRow[]): NamedAmount[] {
  const map = new Map<string, NamedAmount>();
  for (const t of transactions) {
    const key = normalizeExpenseAudience(t.expense_audience);
    const name = EXPENSE_AUDIENCE_LABELS[key];
    const existing = map.get(key) ?? { name, amount: 0 };
    existing.amount += t.amount;
    map.set(key, existing);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export interface InMemoryTransaction {
  amount: number;
  source_id: number | null;
  source_name?: string | null;
  expense_audience?: ExpenseAudience | string | null;
  payer?: string;
  note?: string | null;
  location?: string | null;
  category_name?: string | null;
  created_at: string;
}

function dateOnly(createdAt: string): string {
  return createdAt.slice(0, 10);
}

export function transactionInRange(
  createdAt: string,
  fromDate: string,
  toDate: string,
): boolean {
  const d = dateOnly(createdAt);
  return d >= fromDate && d <= toDate;
}

/** In-memory filter — cùng semantics với SQL clauses (dùng cho test). */
export function matchesReportFilters(
  t: InMemoryTransaction,
  filters: ReportFilterInput,
): boolean {
  if (typeof filters.sourceId === 'number' && t.source_id !== filters.sourceId) {
    return false;
  }
  if (filters.audience && filters.audience !== 'all') {
    if (normalizeExpenseAudience(t.expense_audience) !== filters.audience) {
      return false;
    }
  }
  if (filters.payer && filters.payer !== 'all' && t.payer !== filters.payer) {
    return false;
  }
  const search = filters.search?.trim() ?? '';
  if (!search) return true;

  const amount = parseVndAmountFromSearch(search);
  if (amount !== null) return t.amount === amount;

  const q = search.toLowerCase();
  return (
    (t.note ?? '').toLowerCase().includes(q) ||
    (t.location ?? '').toLowerCase().includes(q) ||
    (t.category_name ?? '').toLowerCase().includes(q) ||
    (t.payer ?? '').toLowerCase().includes(q)
  );
}

/**
 * Reporting view: list có thể cắt LIMIT, totals/breakdown luôn trên toàn bộ matching set.
 * SQL layer (getExpenseSummary / getExpenseSourceTotals / getExpenseAudienceTotals) phải
 * cùng semantics — không aggregate từ display list.
 */
export function reportFromMatchingTransactions(matching: InMemoryTransaction[]): {
  displayList: InMemoryTransaction[];
  overallTotal: number;
  sourceTotals: NamedAmount[];
  audienceTotals: NamedAmount[];
} {
  const overallTotal = matching.reduce((s, t) => s + t.amount, 0);
  return {
    displayList: limitExpenseDisplayList(matching),
    overallTotal,
    sourceTotals: aggregateBySource(matching),
    audienceTotals: aggregateByAudience(matching),
  };
}
