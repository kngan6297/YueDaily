import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateByAudience,
  aggregateBySource,
  buildReportFilterClauses,
  EXPENSE_DISPLAY_LIMIT,
  matchesReportFilters,
  reportFromMatchingTransactions,
  sumNamedAmounts,
  transactionInRange,
  type InMemoryTransaction,
} from './reportCalculations.ts';
import { EXPENSE_AUDIENCE_LABELS } from '../types/index.ts';

const WOORI = { source_id: 1, source_name: 'Woori · Quỹ ăn' };
const VPBANK = { source_id: 2, source_name: 'VPBank' };
const CASH_YUE = { source_id: 3, source_name: 'Tiền mặt Yue' };
const CASH_KAI = { source_id: 4, source_name: 'Tiền mặt Kai' };
const VCB = { source_id: 5, source_name: 'VCB Shop' };

function tx(
  partial: Partial<InMemoryTransaction> & { amount: number },
): InMemoryTransaction {
  return {
    source_id: null,
    created_at: '2026-08-16 12:00:00',
    expense_audience: 'couple',
    ...partial,
  };
}

function amountNamed(rows: { name: string; amount: number }[], name: string): number {
  return rows.find((r) => r.name === name)?.amount ?? 0;
}

describe('P1.5 attribution acceptance', () => {
  it('A — Yue + Kai / Woori aggregates to source and couple audience', () => {
    const rows = [
      tx({ amount: 280000, ...WOORI, expense_audience: 'couple' }),
    ];
    assert.equal(amountNamed(aggregateBySource(rows), 'Woori · Quỹ ăn'), 280000);
    assert.equal(amountNamed(aggregateByAudience(rows), EXPENSE_AUDIENCE_LABELS.couple), 280000);
    assert.equal(amountNamed(aggregateByAudience(rows), EXPENSE_AUDIENCE_LABELS.wife), 0);
  });

  it('B — Yue only / Woori is valid and does not become personal-only policy', () => {
    const rows = [
      tx({ amount: 70000, ...WOORI, expense_audience: 'wife' }),
    ];
    assert.equal(amountNamed(aggregateBySource(rows), 'Woori · Quỹ ăn'), 70000);
    assert.equal(amountNamed(aggregateByAudience(rows), EXPENSE_AUDIENCE_LABELS.wife), 70000);
  });

  it('C — Yue + Meo / VPBank is not reported as Yue-only', () => {
    const rows = [
      tx({ amount: 600000, ...VPBANK, expense_audience: 'wife_and_sister' }),
    ];
    assert.equal(amountNamed(aggregateBySource(rows), 'VPBank'), 600000);
    assert.equal(
      amountNamed(aggregateByAudience(rows), EXPENSE_AUDIENCE_LABELS.wife_and_sister),
      600000,
    );
    assert.equal(amountNamed(aggregateByAudience(rows), EXPENSE_AUDIENCE_LABELS.wife), 0);
  });

  it('D — Yue + Kai + Meo / Woori', () => {
    const rows = [
      tx({ amount: 850000, ...WOORI, expense_audience: 'couple_and_sister' }),
    ];
    assert.equal(amountNamed(aggregateBySource(rows), 'Woori · Quỹ ăn'), 850000);
    assert.equal(
      amountNamed(aggregateByAudience(rows), EXPENSE_AUDIENCE_LABELS.couple_and_sister),
      850000,
    );
  });

  it('E — Tiền mặt Yue and Tiền mặt Kai stay separate', () => {
    const rows = [
      tx({ amount: 100000, ...CASH_YUE, expense_audience: 'wife' }),
      tx({ amount: 300000, ...CASH_KAI, expense_audience: 'couple' }),
    ];
    const bySource = aggregateBySource(rows);
    assert.equal(bySource.length, 2);
    assert.equal(amountNamed(bySource, 'Tiền mặt Yue'), 100000);
    assert.equal(amountNamed(bySource, 'Tiền mặt Kai'), 300000);
    assert.equal(amountNamed(bySource, 'Tiền mặt'), 0);

    const yueOnly = rows.filter((t) =>
      matchesReportFilters(t, { sourceId: CASH_YUE.source_id }),
    );
    const kaiOnly = rows.filter((t) =>
      matchesReportFilters(t, { sourceId: CASH_KAI.source_id }),
    );
    assert.equal(yueOnly.reduce((s, t) => s + t.amount, 0), 100000);
    assert.equal(kaiOnly.reduce((s, t) => s + t.amount, 0), 300000);
  });

  it('F — historical VCB Shop is not remapped to Woori', () => {
    const rows = [
      tx({ amount: 800000, ...VCB, expense_audience: 'couple' }),
    ];
    const bySource = aggregateBySource(rows);
    assert.equal(amountNamed(bySource, 'VCB Shop'), 800000);
    assert.equal(amountNamed(bySource, 'Woori · Quỹ ăn'), 0);
  });

  it('G — legacy payer value is independent of source/audience aggregation', () => {
    const rows = [
      tx({
        amount: 50000,
        ...WOORI,
        expense_audience: 'couple',
        payer: 'Chồng',
        note: 'old',
      }),
    ];
    assert.equal(rows[0].payer, 'Chồng');
    assert.equal(amountNamed(aggregateBySource(rows), 'Woori · Quỹ ăn'), 50000);
    assert.equal(amountNamed(aggregateByAudience(rows), EXPENSE_AUDIENCE_LABELS.couple), 50000);
  });

  it('H — backup-shaped dataset keeps all audiences, sources, and payers', () => {
    const rows = [
      tx({ amount: 1, ...WOORI, expense_audience: 'wife', payer: 'Vợ' }),
      tx({ amount: 2, ...VPBANK, expense_audience: 'husband', payer: 'Chồng' }),
      tx({ amount: 3, ...CASH_YUE, expense_audience: 'couple', payer: 'Vợ' }),
      tx({ amount: 4, ...CASH_KAI, expense_audience: 'wife_and_sister', payer: 'Vợ' }),
      tx({ amount: 5, ...VCB, expense_audience: 'couple_and_sister', payer: 'Chồng' }),
    ];
    const restored = rows.map((t) => ({ ...t }));
    assert.deepEqual(
      restored.map((t) => t.expense_audience),
      ['wife', 'husband', 'couple', 'wife_and_sister', 'couple_and_sister'],
    );
    assert.deepEqual(
      restored.map((t) => t.source_name),
      ['Woori · Quỹ ăn', 'VPBank', 'Tiền mặt Yue', 'Tiền mặt Kai', 'VCB Shop'],
    );
    assert.deepEqual(
      restored.map((t) => t.payer),
      ['Vợ', 'Chồng', 'Vợ', 'Vợ', 'Chồng'],
    );
    assert.equal(aggregateBySource(restored).length, 5);
    assert.equal(aggregateByAudience(restored).length, 5);
  });

  it('I — filter combinations agree with list totals', () => {
    const rows = [
      tx({
        amount: 280000,
        ...WOORI,
        expense_audience: 'couple',
        note: ' steamboat',
        category_name: 'Ăn uống',
        created_at: '2026-08-10 18:00:00',
      }),
      tx({
        amount: 600000,
        ...VPBANK,
        expense_audience: 'wife_and_sister',
        note: 'meo dinner',
        category_name: 'Ăn uống',
        created_at: '2026-08-16 19:00:00',
      }),
      tx({
        amount: 100000,
        ...CASH_YUE,
        expense_audience: 'wife',
        note: 'bánh mì',
        category_name: 'Ăn uống',
        created_at: '2026-07-20 08:00:00',
      }),
    ];

    const sourceOnly = rows.filter((t) => matchesReportFilters(t, { sourceId: WOORI.source_id }));
    assert.equal(sourceOnly.reduce((s, t) => s + t.amount, 0), 280000);

    const audienceOnly = rows.filter((t) =>
      matchesReportFilters(t, { audience: 'wife_and_sister' }),
    );
    assert.equal(audienceOnly.reduce((s, t) => s + t.amount, 0), 600000);

    const sourceAndAudience = rows.filter((t) =>
      matchesReportFilters(t, { sourceId: WOORI.source_id, audience: 'couple' }),
    );
    assert.equal(sourceAndAudience.reduce((s, t) => s + t.amount, 0), 280000);

    const sourceAndMonth = rows.filter(
      (t) =>
        matchesReportFilters(t, { sourceId: VPBANK.source_id }) &&
        transactionInRange(t.created_at, '2026-08-01', '2026-08-16'),
    );
    assert.equal(sourceAndMonth.reduce((s, t) => s + t.amount, 0), 600000);

    const sourceAndRange = rows.filter(
      (t) =>
        matchesReportFilters(t, { sourceId: CASH_YUE.source_id }) &&
        transactionInRange(t.created_at, '2026-07-01', '2026-07-31'),
    );
    assert.equal(sourceAndRange.reduce((s, t) => s + t.amount, 0), 100000);

    const sourceAndSearch = rows.filter((t) =>
      matchesReportFilters(t, { sourceId: VPBANK.source_id, search: 'meo' }),
    );
    assert.equal(sourceAndSearch.reduce((s, t) => s + t.amount, 0), 600000);

    const audienceAndSearch = rows.filter((t) =>
      matchesReportFilters(t, { audience: 'wife', search: 'bánh' }),
    );
    assert.equal(audienceAndSearch.reduce((s, t) => s + t.amount, 0), 100000);
  });
});

describe('buildReportFilterClauses', () => {
  it('combines source_id and expense_audience independently', () => {
    const { clause, params } = buildReportFilterClauses({
      sourceId: 1,
      audience: 'couple',
    });
    assert.match(clause, /t\.source_id = \?/);
    assert.match(clause, /t\.expense_audience = \?/);
    assert.deepEqual(params, [1, 'couple']);
  });

  it('omits source clause for Tất cả', () => {
    const { clause, params } = buildReportFilterClauses({ sourceId: 'all', audience: 'all' });
    assert.equal(clause, '');
    assert.deepEqual(params, []);
  });
});

function repeatTx(
  count: number,
  spec: Partial<InMemoryTransaction> & { amount: number },
): InMemoryTransaction[] {
  return Array.from({ length: count }, () => tx(spec));
}

describe('reporting totals independent of display LIMIT', () => {
  const UNIT = 1000;
  const dataset: InMemoryTransaction[] = [
    ...repeatTx(30, { amount: UNIT, ...WOORI, expense_audience: 'couple', created_at: '2026-08-10 12:00:00' }),
    ...repeatTx(20, { amount: UNIT, ...VPBANK, expense_audience: 'wife', created_at: '2026-08-11 12:00:00' }),
    ...repeatTx(15, { amount: UNIT, ...WOORI, expense_audience: 'couple_and_sister', created_at: '2026-08-12 12:00:00' }),
    ...repeatTx(5, { amount: UNIT, ...CASH_YUE, expense_audience: 'wife_and_sister', created_at: '2026-08-13 12:00:00' }),
    ...repeatTx(5, { amount: UNIT, ...CASH_YUE, expense_audience: 'wife_and_sister', created_at: '2026-07-20 12:00:00' }),
  ];

  it('has 75 transactions and display list stays at LIMIT 50', () => {
    assert.equal(dataset.length, 75);
    const view = reportFromMatchingTransactions(dataset);
    assert.equal(view.displayList.length, EXPENSE_DISPLAY_LIMIT);
    assert.equal(EXPENSE_DISPLAY_LIMIT, 50);
    assert.ok(view.displayList.length < dataset.length);
  });

  it('overall / source / audience totals use all 75, not the display list', () => {
    const view = reportFromMatchingTransactions(dataset);
    assert.equal(view.overallTotal, 75 * UNIT);
    assert.equal(amountNamed(view.sourceTotals, 'Woori · Quỹ ăn'), 45 * UNIT);
    assert.equal(amountNamed(view.sourceTotals, 'VPBank'), 20 * UNIT);
    assert.equal(amountNamed(view.sourceTotals, 'Tiền mặt Yue'), 10 * UNIT);
    assert.equal(amountNamed(view.audienceTotals, EXPENSE_AUDIENCE_LABELS.couple), 30 * UNIT);
    assert.equal(amountNamed(view.audienceTotals, EXPENSE_AUDIENCE_LABELS.wife), 20 * UNIT);
    assert.equal(amountNamed(view.audienceTotals, EXPENSE_AUDIENCE_LABELS.couple_and_sister), 15 * UNIT);
    assert.equal(amountNamed(view.audienceTotals, EXPENSE_AUDIENCE_LABELS.wife_and_sister), 10 * UNIT);

    assert.equal(sumNamedAmounts(view.sourceTotals), view.overallTotal);
    assert.equal(sumNamedAmounts(view.audienceTotals), view.overallTotal);

    const fromList = aggregateBySource(view.displayList);
    assert.notEqual(sumNamedAmounts(fromList), view.overallTotal);
  });

  it('combined filters on dataset >50 still total the matching subset', () => {
    const sourceOnly = dataset.filter((t) => matchesReportFilters(t, { sourceId: WOORI.source_id }));
    const sourceView = reportFromMatchingTransactions(sourceOnly);
    assert.equal(sourceOnly.length, 45);
    assert.equal(sourceView.overallTotal, 45 * UNIT);
    assert.equal(sumNamedAmounts(sourceView.sourceTotals), sourceView.overallTotal);
    assert.equal(sumNamedAmounts(sourceView.audienceTotals), sourceView.overallTotal);

    const audienceOnly = dataset.filter((t) => matchesReportFilters(t, { audience: 'wife' }));
    const audienceView = reportFromMatchingTransactions(audienceOnly);
    assert.equal(audienceOnly.length, 20);
    assert.equal(audienceView.overallTotal, 20 * UNIT);
    assert.equal(sumNamedAmounts(audienceView.sourceTotals), audienceView.overallTotal);

    const both = dataset.filter((t) =>
      matchesReportFilters(t, { sourceId: WOORI.source_id, audience: 'couple' }),
    );
    const bothView = reportFromMatchingTransactions(both);
    assert.equal(both.length, 30);
    assert.equal(bothView.overallTotal, 30 * UNIT);
    assert.equal(sumNamedAmounts(bothView.sourceTotals), bothView.overallTotal);
    assert.equal(sumNamedAmounts(bothView.audienceTotals), bothView.overallTotal);

    const august = dataset.filter((t) => transactionInRange(t.created_at, '2026-08-01', '2026-08-16'));
    const augustView = reportFromMatchingTransactions(august);
    assert.equal(august.length, 70);
    assert.equal(augustView.overallTotal, 70 * UNIT);
    assert.equal(sumNamedAmounts(augustView.sourceTotals), augustView.overallTotal);
    assert.ok(augustView.displayList.length <= EXPENSE_DISPLAY_LIMIT);

    const july = dataset.filter((t) => transactionInRange(t.created_at, '2026-07-01', '2026-07-31'));
    const julyView = reportFromMatchingTransactions(july);
    assert.equal(july.length, 5);
    assert.equal(julyView.overallTotal, 5 * UNIT);
    assert.equal(sumNamedAmounts(julyView.sourceTotals), julyView.overallTotal);
    assert.equal(amountNamed(julyView.sourceTotals, 'Tiền mặt Yue'), 5 * UNIT);
  });
});
