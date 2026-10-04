import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateByAudience,
  aggregateBySource,
  computeExpenseSummaryMetrics,
  resolveReportRange,
} from '../database/reportCalculations.ts';

describe('P2.2 report pure calculations with cloud-shaped rows', () => {
  it('resolves calendar month bounds without UTC shift', () => {
    const resolved = resolveReportRange({ kind: 'month', year: 2026, month: 10 });
    assert.equal(resolved.fromDate, '2026-10-01');
    assert.ok(resolved.toDate.startsWith('2026-10-'));
    assert.ok(resolved.calendarDays >= 1);
  });

  it('aggregates by source using UUID ids without merging distinct sources', () => {
    const totals = aggregateBySource([
      { source_id: 'src-a', source_name: 'Cash', amount: 1000 },
      { source_id: 'src-b', source_name: 'Cash', amount: 2000 },
      { source_id: 'src-a', source_name: 'Cash', amount: 500 },
    ]);
    assert.equal(totals.length, 2);
    const a = totals.find((t) => t.name === 'Cash' && t.amount === 1500);
    const b = totals.find((t) => t.name === 'Cash' && t.amount === 2000);
    assert.ok(a);
    assert.ok(b);
  });

  it('keeps audience totals independent from source', () => {
    const totals = aggregateByAudience([
      { expense_audience: 'wife', amount: 1000 },
      { expense_audience: 'couple', amount: 3000 },
      { expense_audience: 'wife', amount: 500 },
    ]);
    const wife = totals.find((t) => t.name === 'Yue');
    const couple = totals.find((t) => t.name === 'Yue + Kai');
    assert.equal(wife?.amount, 1500);
    assert.equal(couple?.amount, 3000);
  });

  it('summary metrics match existing pure helper', () => {
    const metrics = computeExpenseSummaryMetrics(30_000, 3, 10);
    assert.equal(metrics.averagePerTransaction, 10_000);
    assert.equal(metrics.averagePerDay, 3_000);
  });
});
