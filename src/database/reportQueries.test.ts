import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthDailySeries,
  buildSearchFilter,
  computeExpenseSummaryMetrics,
  highestSpendingDay,
  isExpenseTransaction,
  parseVndAmountFromSearch,
  resolveReportRange,
} from './reportCalculations.ts';

const FIXED_NOW = new Date(2026, 7, 12, 10, 0, 0);

describe('reportQueries pure helpers', () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: FIXED_NOW });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  describe('parseVndAmountFromSearch', () => {
    it('parses amount formats', () => {
      assert.equal(parseVndAmountFromSearch('150000'), 150000);
      assert.equal(parseVndAmountFromSearch('150.000'), 150000);
      assert.equal(parseVndAmountFromSearch('150,000'), 150000);
      assert.equal(parseVndAmountFromSearch('150000đ'), 150000);
      assert.equal(parseVndAmountFromSearch('  150000  '), 150000);
    });

    it('returns null for text or empty', () => {
      assert.equal(parseVndAmountFromSearch('cafe'), null);
      assert.equal(parseVndAmountFromSearch('cafe 150000'), null);
      assert.equal(parseVndAmountFromSearch(''), null);
      assert.equal(parseVndAmountFromSearch('   '), null);
    });
  });

  describe('buildSearchFilter', () => {
    it('uses exact amount match for numeric query', () => {
      const { clause, params } = buildSearchFilter('150.000');
      assert.match(clause, /t\.amount = \?/);
      assert.deepEqual(params, [150000]);
      assert.doesNotMatch(clause, /LIKE/);
    });

    it('uses text fields for text query', () => {
      const { clause, params } = buildSearchFilter('cafe');
      assert.match(clause, /LIKE/);
      assert.equal(params[0], '%cafe%');
      assert.doesNotMatch(clause, /t\.amount/);
    });

    it('returns empty clause for blank search', () => {
      const { clause, params } = buildSearchFilter('   ');
      assert.equal(clause, '');
      assert.deepEqual(params, []);
    });
  });

  describe('resolveReportRange', () => {
    it('resolves and clamps day range', () => {
      assert.deepEqual(resolveReportRange({ kind: 'day', date: '2026-08-05' }), {
        fromDate: '2026-08-05',
        toDate: '2026-08-05',
        calendarDays: 1,
      });
      assert.equal(resolveReportRange({ kind: 'day', date: '2026-12-01' }).fromDate, '2026-08-12');
    });

    it('current month uses elapsed calendar days only', () => {
      const r = resolveReportRange({ kind: 'month', year: 2026, month: 8 });
      assert.equal(r.calendarDays, 12);
      assert.equal(r.fromDate, '2026-08-01');
      assert.equal(r.toDate, '2026-08-12');
    });

    it('past full month uses all days', () => {
      const r = resolveReportRange({ kind: 'month', year: 2026, month: 7 });
      assert.equal(r.calendarDays, 31);
    });

    it('custom range normalization', () => {
      const single = resolveReportRange({
        kind: 'custom',
        fromDate: '2026-08-05',
        toDate: '2026-08-05',
      });
      assert.equal(single.calendarDays, 1);

      const reversed = resolveReportRange({
        kind: 'custom',
        fromDate: '2026-08-20',
        toDate: '2026-08-10',
      });
      assert.equal(reversed.fromDate, '2026-08-10');
      assert.equal(reversed.toDate, '2026-08-12');
    });
  });

  describe('computeExpenseSummaryMetrics', () => {
    it('handles zero and averages', () => {
      const zero = computeExpenseSummaryMetrics(0, 0, 12);
      assert.equal(zero.averagePerTransaction, 0);
      assert.equal(zero.averagePerDay, 0);

      const one = computeExpenseSummaryMetrics(50000, 1, 12);
      assert.equal(one.averagePerTransaction, 50000);
      assert.equal(one.averagePerDay, 50000 / 12);

      const multi = computeExpenseSummaryMetrics(120000, 2, 12);
      assert.equal(multi.averagePerDay, 10000);
    });
  });

  describe('buildMonthDailySeries + highestSpendingDay', () => {
    it('fills zero days and finds peak', () => {
      const series = buildMonthDailySeries(2026, 8, [
        { date: '2026-08-05', day: 5, amount: 10000 },
        { date: '2026-08-12', day: 12, amount: 50000 },
      ]);
      assert.equal(series.length, 12);
      assert.equal(series[0].amount, 0);
      assert.equal(series[4].amount, 10000);
      assert.equal(highestSpendingDay(series)?.day, 12);
    });
  });

  describe('legacy expense filter', () => {
    it('isExpenseTransaction excludes thu', () => {
      assert.equal(isExpenseTransaction('chi'), true);
      assert.equal(isExpenseTransaction('thu'), false);
    });
  });
});
