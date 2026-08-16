import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ExpenseAudience, SourceSpendingGroup } from '../types/index.ts';
import {
  HOME_SPEND_VIEW_OPTIONS,
  matchesHomeSpendView,
  spendingGroupEqualsClause,
  spendingGroupForHomeSpendView,
  sumHomeSpendView,
  type HomeSpendView,
} from './homeSpendView.ts';

function row(
  amount: number,
  spending_group: SourceSpendingGroup | null,
  audience: ExpenseAudience,
  extra?: { month?: number; day?: number; is_active?: number; name?: string },
) {
  return {
    amount,
    spending_group,
    expense_audience: audience,
    month: extra?.month ?? 8,
    day: extra?.day ?? 1,
    is_active: extra?.is_active ?? 1,
    name: extra?.name ?? 'src',
  };
}

const SAMPLE = [
  row(100_000, 'personal_yue', 'wife', { name: 'VPBank' }),
  row(200_000, 'household', 'wife', { name: 'Woori' }),
  row(300_000, 'personal_yue', 'wife_and_sister', { name: 'VPBank' }),
  row(400_000, 'household', 'couple', { name: 'Woori' }),
  row(500_000, 'household', 'husband', { name: 'Woori' }),
  row(600_000, 'household', 'couple_and_sister', { name: 'Tiền mặt Kai' }),
  row(700_000, 'personal_yue', 'couple', { name: 'VPBank' }),
  row(800_000, null, 'wife', { name: 'VCB Shop' }),
];

describe('Home spend monitoring — source spending_group', () => {
  it('tabs are Tất cả / Cá nhân Yue / Quỹ chung', () => {
    assert.deepEqual(
      HOME_SPEND_VIEW_OPTIONS.map((o) => o.id),
      ['all', 'personal_yue', 'household'],
    );
    assert.equal(spendingGroupForHomeSpendView('all'), null);
    assert.equal(spendingGroupForHomeSpendView('personal_yue'), 'personal_yue');
    assert.equal(spendingGroupForHomeSpendView('household'), 'household');
  });

  it('required dataset: Tất cả 3.600k, Cá nhân 1.100k, Quỹ chung 1.700k', () => {
    assert.equal(sumHomeSpendView(SAMPLE, 'all'), 3_600_000);
    assert.equal(sumHomeSpendView(SAMPLE, 'personal_yue'), 1_100_000);
    assert.equal(sumHomeSpendView(SAMPLE, 'household'), 1_700_000);
  });

  it('A — Yue + VPBank is personal, not household', () => {
    const a = [row(100_000, 'personal_yue', 'wife')];
    assert.equal(sumHomeSpendView(a, 'personal_yue'), 100_000);
    assert.equal(sumHomeSpendView(a, 'household'), 0);
  });

  it('B — Yue + Woori is household, not personal (audience cannot decide)', () => {
    const b = [row(200_000, 'household', 'wife')];
    assert.equal(sumHomeSpendView(b, 'household'), 200_000);
    assert.equal(sumHomeSpendView(b, 'personal_yue'), 0);
  });

  it('C — Yue + Meo + VPBank is personal because source is personal', () => {
    const c = [row(300_000, 'personal_yue', 'wife_and_sister')];
    assert.equal(sumHomeSpendView(c, 'personal_yue'), 300_000);
  });

  it('D/E — Yue+Kai / Yue+Kai+Meo + Woori is household', () => {
    const d = [row(400_000, 'household', 'couple')];
    const e = [row(600_000, 'household', 'couple_and_sister')];
    assert.equal(sumHomeSpendView(d, 'household'), 400_000);
    assert.equal(sumHomeSpendView(e, 'household'), 600_000);
  });

  it('F — Kai + Woori is household (Kai-only is not excluded)', () => {
    const f = [row(500_000, 'household', 'husband')];
    assert.equal(sumHomeSpendView(f, 'household'), 500_000);
    assert.equal(sumHomeSpendView(f, 'personal_yue'), 0);
    assert.equal(sumHomeSpendView(f, 'all'), 500_000);
  });

  it('G — audience does not override source group', () => {
    const coupleOnPersonal = [row(700_000, 'personal_yue', 'couple')];
    const meoOnHousehold = [row(200_000, 'household', 'wife_and_sister')];
    assert.equal(sumHomeSpendView(coupleOnPersonal, 'personal_yue'), 700_000);
    assert.equal(sumHomeSpendView(coupleOnPersonal, 'household'), 0);
    assert.equal(sumHomeSpendView(meoOnHousehold, 'household'), 200_000);
    assert.equal(sumHomeSpendView(meoOnHousehold, 'personal_yue'), 0);
  });

  it('unclassified VCB Shop appears only in Tất cả', () => {
    const vcb = [row(800_000, null, 'wife', { name: 'VCB Shop' })];
    assert.equal(sumHomeSpendView(vcb, 'all'), 800_000);
    assert.equal(sumHomeSpendView(vcb, 'personal_yue'), 0);
    assert.equal(sumHomeSpendView(vcb, 'household'), 0);
  });

  it('archived personal/household sources still group historically; is_active ignored', () => {
    const archivedPersonal = [row(50_000, 'personal_yue', 'wife', { is_active: 0, name: 'VPBank' })];
    const archivedHousehold = [row(80_000, 'household', 'couple', { is_active: 0, name: 'Woori' })];
    assert.equal(sumHomeSpendView(archivedPersonal, 'personal_yue'), 50_000);
    assert.equal(sumHomeSpendView(archivedHousehold, 'household'), 80_000);
    assert.equal(matchesHomeSpendView('personal_yue', 'personal_yue'), true);
  });

  it('source rename does not change grouping (uses spending_group, not name)', () => {
    const renamed = [row(100_000, 'personal_yue', 'wife', { name: 'VPBank Yue' })];
    assert.equal(sumHomeSpendView(renamed, 'personal_yue'), 100_000);
    assert.equal(sumHomeSpendView(renamed, 'household'), 0);
  });

  it('month navigation keeps grouping; totals are per-month subset', () => {
    const mixed = [
      row(100_000, 'personal_yue', 'wife', { month: 8 }),
      row(200_000, 'household', 'wife', { month: 8 }),
      row(50_000, 'personal_yue', 'wife', { month: 7 }),
      row(80_000, 'household', 'couple', { month: 7 }),
      row(20_000, null, 'husband', { month: 7 }),
    ];
    const august = mixed.filter((r) => r.month === 8);
    const july = mixed.filter((r) => r.month === 7);
    const view: HomeSpendView = 'personal_yue';
    assert.equal(sumHomeSpendView(august, view), 100_000);
    assert.equal(sumHomeSpendView(july, view), 50_000);
    assert.equal(sumHomeSpendView(july, 'household'), 80_000);
    assert.equal(sumHomeSpendView(july, 'all'), 150_000);
  });

  it('selected-day total equals sum of filtered visible day transactions', () => {
    const day10 = [
      row(100_000, 'personal_yue', 'wife', { day: 10 }),
      row(200_000, 'household', 'wife', { day: 10 }),
      row(800_000, null, 'couple', { day: 10 }),
    ];
    const day11 = [row(400_000, 'household', 'couple', { day: 11 })];
    assert.equal(sumHomeSpendView(day10, 'all'), 1_100_000);
    assert.equal(sumHomeSpendView(day10, 'personal_yue'), 100_000);
    assert.equal(sumHomeSpendView(day10, 'household'), 200_000);
    assert.equal(sumHomeSpendView(day11, 'personal_yue'), 0);
    assert.equal(sumHomeSpendView(day11, 'household'), 400_000);
  });

  it('empty matching set is 0', () => {
    const onlyUnclassified = [row(800_000, null, 'wife')];
    assert.equal(sumHomeSpendView(onlyUnclassified, 'personal_yue'), 0);
    assert.equal(sumHomeSpendView(onlyUnclassified, 'household'), 0);
    assert.equal(sumHomeSpendView([], 'all'), 0);
  });

  it('builds bound equality clause; Tất cả adds no filter', () => {
    const grouped = spendingGroupEqualsClause('personal_yue', 's.spending_group');
    assert.equal(grouped.clause, ' AND s.spending_group = ?');
    assert.deepEqual(grouped.params, ['personal_yue']);
    const all = spendingGroupEqualsClause(null, 's.spending_group');
    assert.equal(all.clause, '');
    assert.deepEqual(all.params, []);
  });
});
