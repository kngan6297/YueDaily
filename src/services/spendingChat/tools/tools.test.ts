import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAllowedToolName,
  MAX_TOOL_CALLS_PER_TURN,
  parseFilters,
  parseYearMonth,
  validateToolCalls,
} from './allowlist.ts';
import {
  compareSummaries,
  needsCustomQuery,
  previousMonth,
  vpBankNullOpeningSemantics,
} from './pureHelpers.ts';
import { assertNoSensitiveFields, toSafeTransactionDto } from '../safeDto.ts';

describe('spending chat tool allowlist', () => {
  it('accepts known tools only', () => {
    assert.equal(isAllowedToolName('getPeriodSummary'), true);
    assert.equal(isAllowedToolName('dropTable'), false);
    assert.equal(isAllowedToolName('insertTransaction'), false);
  });

  it('rejects invalid tool and caps call count', () => {
    const bad = validateToolCalls([{ name: 'runSql', args: {} }]);
    assert.equal(bad.ok, false);

    const tooMany = validateToolCalls(
      Array.from({ length: MAX_TOOL_CALLS_PER_TURN + 1 }, () => ({
        name: 'getPeriodSummary',
        args: { year: 2026, month: 9 },
      })),
    );
    assert.equal(tooMany.ok, false);

    const ok = validateToolCalls([
      { name: 'getPeriodSummary', args: { year: 2026, month: 9 } },
      { name: 'getBreakdown', args: { year: 2026, month: 9, dimension: 'category' } },
    ]);
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.calls.length, 2);
  });

  it('parses year/month and filters including exclusions', () => {
    assert.deepEqual(parseYearMonth({ year: 2026, month: 9 }), { year: 2026, month: 9 });
    assert.equal(parseYearMonth({ year: 2026, month: 13 }), null);
    const filters = parseFilters({
      audience: 'wife',
      categoryNames: ['Mua sắm'],
      excludedTransactionIds: [1, 2, 2],
    });
    assert.equal(filters.audience, 'wife');
    assert.deepEqual(filters.categoryNames, ['Mua sắm']);
    assert.deepEqual(filters.excludedTransactionIds, [1, 2, 2]);
    assert.equal(needsCustomQuery(filters), true);
  });
});

describe('spending chat tool pure semantics', () => {
  it('comparePeriods deltas from authoritative summaries', () => {
    const delta = compareSummaries(
      {
        totalChi: 1_000_000,
        transactionCount: 10,
        averagePerTransaction: 100_000,
        averagePerDay: 33_333,
        calendarDays: 30,
      },
      {
        totalChi: 800_000,
        transactionCount: 8,
        averagePerTransaction: 100_000,
        averagePerDay: 25_806,
        calendarDays: 31,
      },
    );
    assert.equal(delta.deltaTotalChi, 200_000);
    assert.equal(delta.deltaTransactionCount, 2);
  });

  it('previous month for compare presets', () => {
    assert.deepEqual(previousMonth(2026, 9), { year: 2026, month: 8 });
    assert.deepEqual(previousMonth(2026, 1), { year: 2025, month: 12 });
  });

  it('VPBank NULL opening keeps current_balance null and never invents 0', () => {
    const result = vpBankNullOpeningSemantics(null, 100, 50);
    assert.equal(result.opening_balance, null);
    assert.equal(result.current_balance, null);
    assert.equal(result.needsOpeningBalance, true);
    assert.equal(result.income, 100);
    assert.equal(result.expense, 50);
  });

  it('VPBank opening 0 is valid', () => {
    const result = vpBankNullOpeningSemantics(0, 100, 40);
    assert.equal(result.opening_balance, 0);
    assert.equal(result.current_balance, 60);
    assert.equal(result.needsOpeningBalance, false);
  });

  it('safe DTO strips image_uri and location', () => {
    const dto = toSafeTransactionDto({
      id: 1,
      amount: 50_000,
      type: 'chi',
      created_at: '2026-09-10 12:00:00',
      expense_audience: 'wife',
      note: 'cafe',
      category_name: 'Trà & Cà phê',
      source_name: 'VPBank',
      image_uri: 'file:///secret.jpg',
      location: 'HN',
      payer: 'Vợ',
    });
    assert.equal(dto.id, 1);
    assert.equal(dto.date, '2026-09-10');
    assert.equal(dto.note, 'cafe');
    assert.equal('image_uri' in dto, false);
    assert.equal('location' in dto, false);
    assert.equal('payer' in dto, false);
    assertNoSensitiveFields(dto as unknown as Record<string, unknown>);
  });
});
