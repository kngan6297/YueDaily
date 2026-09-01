// ============================================================
// Household Food Budget period — pure date domain (local YYYY-MM-DD)
// Payday cycle 05/MM → 04/(MM+1); calendar-month reporting unchanged elsewhere
// ============================================================

import { FIRST_HOUSEHOLD_FOOD_PERIOD, HOUSEHOLD_FOOD_CYCLE_START_DAY } from '../constants/budget';
import { formatLocalDate, parseLocalDate } from '../utils/date';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface BudgetPeriodBounds {
  period_start: string;
  period_end: string;
}

export function isValidDateOnlyString(value: string): boolean {
  if (!DATE_ONLY_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const parsed = parseLocalDate(value);
  return (
    parsed.getFullYear() === y &&
    parsed.getMonth() === m - 1 &&
    parsed.getDate() === d
  );
}

export function compareDateOnly(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function isDateInsideBudgetPeriod(
  date: string,
  period: BudgetPeriodBounds,
): boolean {
  return date >= period.period_start && date <= period.period_end;
}

/** Natural cycle start (day 5) containing `date` — local calendar, no UTC shift */
export function computeCycleStartContainingDate(date: string): string {
  if (!isValidDateOnlyString(date)) {
    throw new Error(`Invalid date: ${date}`);
  }
  const [y, m, d] = date.split('-').map(Number);
  if (d >= HOUSEHOLD_FOOD_CYCLE_START_DAY) {
    return formatLocalDate(new Date(y, m - 1, HOUSEHOLD_FOOD_CYCLE_START_DAY));
  }
  return formatLocalDate(new Date(y, m - 2, HOUSEHOLD_FOOD_CYCLE_START_DAY));
}

/** End date (day 4 next month) for a period that starts on day 5 */
export function periodEndFromCycleStart(periodStart: string): string {
  if (!isValidDateOnlyString(periodStart)) {
    throw new Error(`Invalid period start: ${periodStart}`);
  }
  const [, mStr, dStr] = periodStart.split('-');
  const m = Number(mStr);
  const d = Number(dStr);
  if (d !== HOUSEHOLD_FOOD_CYCLE_START_DAY) {
    throw new Error(`Period start must be day ${HOUSEHOLD_FOOD_CYCLE_START_DAY}: ${periodStart}`);
  }
  const start = parseLocalDate(periodStart);
  return formatLocalDate(new Date(start.getFullYear(), start.getMonth() + 1, 4));
}

export function getHouseholdFoodPeriodBounds(date: string): BudgetPeriodBounds {
  const period_start = computeCycleStartContainingDate(date);
  return {
    period_start,
    period_end: periodEndFromCycleStart(period_start),
  };
}

/** Before the first configured P1.6 period — transition days (e.g. 01–04/09/2026) */
export function isBeforeFirstConfiguredHouseholdFoodPeriod(date: string): boolean {
  return compareDateOnly(date, FIRST_HOUSEHOLD_FOOD_PERIOD.period_start) < 0;
}

/** Next cycle after an existing period_start (always day 5) */
export function getNextHouseholdFoodPeriodStart(currentPeriodStart: string): string {
  const start = parseLocalDate(currentPeriodStart);
  return formatLocalDate(
    new Date(start.getFullYear(), start.getMonth() + 1, HOUSEHOLD_FOOD_CYCLE_START_DAY),
  );
}

export function getNextHouseholdFoodPeriodBounds(
  current: BudgetPeriodBounds,
): BudgetPeriodBounds {
  const period_start = getNextHouseholdFoodPeriodStart(current.period_start);
  return {
    period_start,
    period_end: periodEndFromCycleStart(period_start),
  };
}

export function validateBudgetPeriodBounds(
  periodStart: string,
  periodEnd: string,
  limitAmount: number,
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
  if (!Number.isInteger(limitAmount) || limitAmount < 0) {
    throw new Error('limit_amount must be a non-negative integer');
  }
  const startDay = Number(periodStart.slice(8, 10));
  if (startDay !== HOUSEHOLD_FOOD_CYCLE_START_DAY) {
    throw new Error(`period_start must fall on day ${HOUSEHOLD_FOOD_CYCLE_START_DAY}`);
  }
  const expectedEnd = periodEndFromCycleStart(periodStart);
  if (periodEnd !== expectedEnd) {
    throw new Error(`period_end must be ${expectedEnd} for start ${periodStart}`);
  }
  if (compareDateOnly(periodStart, FIRST_HOUSEHOLD_FOOD_PERIOD.period_start) < 0) {
    throw new Error('period_start must not be before first configured household food period');
  }
}
