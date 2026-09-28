import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCalendarMonthLabel,
  getCalendarMonthBounds,
  getCalendarMonthBoundsForYearMonth,
  getNextCalendarMonthBounds,
  validateCalendarMonthPeriodBounds,
} from './calendarMonthPeriodDomain.ts';

describe('calendar month period domain', () => {
  it('September 2026 is 01→30', () => {
    const b = getCalendarMonthBounds('2026-09-15');
    assert.equal(b.period_start, '2026-09-01');
    assert.equal(b.period_end, '2026-09-30');
  });

  it('April (30 days) is 01→30', () => {
    const b = getCalendarMonthBoundsForYearMonth(2026, 4);
    assert.equal(b.period_start, '2026-04-01');
    assert.equal(b.period_end, '2026-04-30');
  });

  it('January (31 days) is 01→31', () => {
    const b = getCalendarMonthBoundsForYearMonth(2026, 1);
    assert.equal(b.period_start, '2026-01-01');
    assert.equal(b.period_end, '2026-01-31');
  });

  it('February non-leap is 01→28', () => {
    const b = getCalendarMonthBoundsForYearMonth(2026, 2);
    assert.equal(b.period_start, '2026-02-01');
    assert.equal(b.period_end, '2026-02-28');
  });

  it('leap February → 01→29', () => {
    const b = getCalendarMonthBounds('2024-02-10');
    assert.equal(b.period_start, '2024-02-01');
    assert.equal(b.period_end, '2024-02-29');
  });

  it('bounds use local calendar constructors (no UTC midnight shift)', () => {
    // new Date(y, m-1, d) is local; formatLocalDate must match input calendar day
    const b = getCalendarMonthBounds('2026-02-01');
    assert.equal(b.period_start, '2026-02-01');
    assert.equal(b.period_end, '2026-02-28');
    const parsedStart = b.period_start.split('-').map(Number);
    assert.deepEqual(parsedStart, [2026, 2, 1]);
  });

  it('day 01 and last day are inside the month', () => {
    const b = getCalendarMonthBounds('2026-09-01');
    assert.equal(b.period_start, '2026-09-01');
    assert.equal(b.period_end, '2026-09-30');
    const endDay = getCalendarMonthBounds('2026-09-30');
    assert.deepEqual(endDay, b);
  });

  it('next month does not inherit prior bounds', () => {
    const sep = getCalendarMonthBounds('2026-09-15');
    const oct = getNextCalendarMonthBounds(sep);
    assert.equal(oct.period_start, '2026-10-01');
    assert.equal(oct.period_end, '2026-10-31');
  });

  it('December rolls to January next year', () => {
    const dec = getCalendarMonthBounds('2026-12-20');
    const jan = getNextCalendarMonthBounds(dec);
    assert.equal(jan.period_start, '2027-01-01');
    assert.equal(jan.period_end, '2027-01-31');
  });

  it('rejects non day-01 starts', () => {
    assert.throws(() => validateCalendarMonthPeriodBounds('2026-09-05', '2026-10-04'));
  });

  it('formatCalendarMonthLabel', () => {
    assert.equal(formatCalendarMonthLabel('2026-09-01'), 'Tháng 09/2026');
  });
});
