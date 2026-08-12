import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarDaysInMonthPeriod,
  clampDateToToday,
  daysInclusive,
  daysInMonth,
  formatLocalDate,
  normalizeCustomRange,
  parseLocalDate,
  todayLocal,
} from './date.ts';

const FIXED_NOW = new Date(2026, 7, 12, 10, 0, 0);

describe('date helpers', () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: FIXED_NOW });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('todayLocal uses local calendar date', () => {
    assert.equal(todayLocal(), '2026-08-12');
  });

  it('parseLocalDate avoids UTC shift', () => {
    const d = parseLocalDate('2026-02-28');
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 1);
    assert.equal(d.getDate(), 28);
    assert.equal(formatLocalDate(d), '2026-02-28');
  });

  it('daysInMonth handles leap year February', () => {
    assert.equal(daysInMonth(2024, 2), 29);
    assert.equal(daysInMonth(2025, 2), 28);
  });

  it('calendarDaysInMonthPeriod for current month excludes future days', () => {
    assert.equal(calendarDaysInMonthPeriod(2026, 8), 12);
  });

  it('calendarDaysInMonthPeriod for past full month', () => {
    assert.equal(calendarDaysInMonthPeriod(2026, 7), 31);
  });

  it('daysInclusive counts calendar days inclusive', () => {
    assert.equal(daysInclusive('2026-08-01', '2026-08-12'), 12);
    assert.equal(daysInclusive('2026-08-05', '2026-08-05'), 1);
  });

  it('clampDateToToday rejects future dates', () => {
    assert.equal(clampDateToToday('2026-12-01'), '2026-08-12');
    assert.equal(clampDateToToday('2026-08-05'), '2026-08-05');
  });

  it('normalizeCustomRange swaps reversed range and clamps future', () => {
    const r = normalizeCustomRange('2026-08-20', '2026-08-10');
    assert.equal(r.fromDate, '2026-08-10');
    assert.equal(r.toDate, '2026-08-12');
  });

  it('normalizeCustomRange allows single day', () => {
    const r = normalizeCustomRange('2026-08-05', '2026-08-05');
    assert.equal(r.fromDate, '2026-08-05');
    assert.equal(r.toDate, '2026-08-05');
  });

  it('normalizeCustomRange clamps future end date', () => {
    const r = normalizeCustomRange('2026-08-01', '2026-09-01');
    assert.equal(r.toDate, '2026-08-12');
  });

  it('month/year boundary in daysInclusive', () => {
    assert.equal(daysInclusive('2025-12-31', '2026-01-02'), 3);
  });
});
