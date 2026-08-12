// Pure report calculations — no SQLite imports (testable in Node)

import {
  calendarDaysInMonthPeriod,
  daysInclusive,
  normalizeCustomRange,
  todayLocal,
} from '../utils/date';

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
