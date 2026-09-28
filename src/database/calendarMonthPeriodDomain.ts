// ============================================================
// Calendar-month period domain (local YYYY-MM-DD)
// Day 01 → last day of month — distinct from household food 05→04 cycle
// ============================================================

import { daysInMonth, formatLocalDate, parseLocalDate } from '../utils/date';
import {
  compareDateOnly,
  isValidDateOnlyString,
  type BudgetPeriodBounds,
} from './budgetPeriodDomain';

export type CalendarMonthPeriodBounds = BudgetPeriodBounds;

/** Calendar month containing `date` — local, no UTC shift */
export function getCalendarMonthBounds(date: string): CalendarMonthPeriodBounds {
  if (!isValidDateOnlyString(date)) {
    throw new Error(`Invalid date: ${date}`);
  }
  const [y, m] = date.split('-').map(Number);
  return getCalendarMonthBoundsForYearMonth(y, m);
}

export function getCalendarMonthBoundsForYearMonth(
  year: number,
  month: number,
): CalendarMonthPeriodBounds {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid year/month: ${year}-${month}`);
  }
  const lastDay = daysInMonth(year, month);
  return {
    period_start: formatLocalDate(new Date(year, month - 1, 1)),
    period_end: formatLocalDate(new Date(year, month - 1, lastDay)),
  };
}

/** Next calendar month after an existing period_start (always day 01) */
export function getNextCalendarMonthBounds(
  current: CalendarMonthPeriodBounds,
): CalendarMonthPeriodBounds {
  const start = parseLocalDate(current.period_start);
  const next = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return getCalendarMonthBoundsForYearMonth(next.getFullYear(), next.getMonth() + 1);
}

export function validateCalendarMonthPeriodBounds(
  periodStart: string,
  periodEnd: string,
): void {
  if (!isValidDateOnlyString(periodStart)) {
    throw new Error('period_start must be YYYY-MM-DD');
  }
  if (!isValidDateOnlyString(periodEnd)) {
    throw new Error('period_end must be YYYY-MM-DD');
  }
  if (compareDateOnly(periodStart, periodEnd) > 0) {
    throw new Error('period_start must be <= period_end');
  }
  const startDay = Number(periodStart.slice(8, 10));
  if (startDay !== 1) {
    throw new Error(`period_start must fall on day 01: ${periodStart}`);
  }
  const [y, m] = periodStart.split('-').map(Number);
  const expected = getCalendarMonthBoundsForYearMonth(y, m);
  if (periodStart !== expected.period_start || periodEnd !== expected.period_end) {
    throw new Error(
      `period bounds must be ${expected.period_start}→${expected.period_end}, got ${periodStart}→${periodEnd}`,
    );
  }
}

/** UI label e.g. "Tháng 09/2026" from period_start */
export function formatCalendarMonthLabel(periodStart: string): string {
  const mm = periodStart.slice(5, 7);
  const yyyy = periodStart.slice(0, 4);
  return `Tháng ${mm}/${yyyy}`;
}
