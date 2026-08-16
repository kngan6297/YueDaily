import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Source } from '../types/index.ts';
import {
  LEGACY_SEEDED_SOURCE_NAMES,
  canEditSourceSpendingGroup,
  isSourceActive,
  normalizeSourceIsActive,
  pickerSources,
  resolveCreateSourceId,
  shouldArchiveLegacySeedsAfterRestore,
  shouldClassifyTrustedSpendingGroupsAfterRestore,
  sourceDeleteGuard,
  sourceHasTransactionRefs,
  sourceIdsToArchiveOnUpgrade,
} from './sourceLifecycle.ts';

function src(id: number, name: string, is_active: number): Source {
  return { id, name, is_active, spending_group: null };
}

const WOORI = src(1, 'Woori · Quỹ ăn', 1);
const VPBANK = src(2, 'VPBank', 1);
const CASH_YUE = src(3, 'Tiền mặt Yue', 1);
const CASH_KAI = src(4, 'Tiền mặt Kai', 1);
const VCB = src(5, 'VCB Shop', 0);
const CASH_LEGACY = src(6, 'Tiền mặt', 0);
const TRANSFER = src(7, 'Chuyển khoản', 0);

const ALL: Source[] = [WOORI, VPBANK, CASH_YUE, CASH_KAI, VCB, CASH_LEGACY, TRANSFER];

describe('P1.5.2 source archive', () => {
  it('A — active source appears in new transaction source list', () => {
    const create = pickerSources(ALL, 'create', null);
    assert.ok(create.some((s) => s.name === 'Woori · Quỹ ăn'));
    assert.ok(create.some((s) => s.name === 'VPBank'));
  });

  it('B — archived source does not appear in new transaction source list', () => {
    const create = pickerSources(ALL, 'create', null);
    assert.equal(create.some((s) => s.name === 'VCB Shop'), false);
    assert.equal(create.some((s) => s.name === 'Tiền mặt'), false);
    assert.equal(create.some((s) => s.name === 'Chuyển khoản'), false);
  });

  it('C — historical transaction using archived VCB Shop still resolves', () => {
    const all = ALL;
    const vcb = all.find((s) => s.id === VCB.id);
    assert.ok(vcb);
    assert.equal(vcb?.name, 'VCB Shop');
    assert.equal(isSourceActive(vcb!), false);
  });

  it('D — editing historical transaction keeps VCB Shop in picker and does not swap source', () => {
    const edit = pickerSources(ALL, 'edit', VCB.id);
    assert.equal(edit[0]?.id, VCB.id);
    assert.equal(edit[0]?.name, 'VCB Shop');
    assert.ok(edit.some((s) => s.name === 'Woori · Quỹ ăn'));
    assert.equal(edit.filter((s) => s.name === 'Tiền mặt').length, 0);
    assert.equal(edit.filter((s) => !isSourceActive(s)).length, 1);
  });

  it('E — last-selected archived source does not become default for new transaction', () => {
    const active = pickerSources(ALL, 'create', null);
    const next = resolveCreateSourceId(active, VCB.id);
    assert.notEqual(next, VCB.id);
    assert.equal(next, WOORI.id);
  });

  it('F — Tiền mặt Yue and Tiền mặt Kai remain separate active sources', () => {
    const create = pickerSources(ALL, 'create', null);
    const yue = create.find((s) => s.name === 'Tiền mặt Yue');
    const kai = create.find((s) => s.name === 'Tiền mặt Kai');
    assert.ok(yue && kai);
    assert.notEqual(yue!.id, kai!.id);
    assert.equal(isSourceActive(yue!), true);
    assert.equal(isSourceActive(kai!), true);
  });

  it('G — current-version backup preserves archived is_active', () => {
    assert.equal(normalizeSourceIsActive(0), 0);
    assert.equal(normalizeSourceIsActive(1), 1);
    assert.equal(shouldArchiveLegacySeedsAfterRestore('2'), false);
    assert.equal(shouldArchiveLegacySeedsAfterRestore('3'), false);
    assert.equal(shouldClassifyTrustedSpendingGroupsAfterRestore('1'), true);
    assert.equal(shouldClassifyTrustedSpendingGroupsAfterRestore('2'), true);
    assert.equal(shouldClassifyTrustedSpendingGroupsAfterRestore('3'), false);
  });

  it('H — old backup without is_active restores active then archives exact legacy seeds', () => {
    assert.equal(normalizeSourceIsActive(undefined), 1);
    assert.equal(shouldArchiveLegacySeedsAfterRestore('1'), true);
    const restored = [
      { id: 1, name: 'VCB Shop' },
      { id: 2, name: 'Tiền mặt Yue' },
      { id: 3, name: 'Tiền mặt Extra' },
    ];
    assert.deepEqual(sourceIdsToArchiveOnUpgrade(restored), [1]);
  });

  it('archives only exact legacy seed names — no fuzzy match', () => {
    const ids = sourceIdsToArchiveOnUpgrade([
      { id: 1, name: 'Tiền mặt' },
      { id: 2, name: 'Tiền mặt Yue' },
      { id: 3, name: 'VCB Shop' },
      { id: 4, name: 'VCB Shop 2' },
      { id: 5, name: 'Chuyển khoản' },
    ]);
    assert.deepEqual(ids, [1, 3, 5]);
    assert.deepEqual([...LEGACY_SEEDED_SOURCE_NAMES], ['Tiền mặt', 'Chuyển khoản', 'VCB Shop']);
  });

  it('last-selected active source is kept for new transactions', () => {
    const active = pickerSources(ALL, 'create', null);
    assert.equal(resolveCreateSourceId(active, CASH_YUE.id), CASH_YUE.id);
  });

  it('unused source may be deleted; referenced source must archive', () => {
    assert.equal(sourceDeleteGuard(0).ok, true);
    assert.equal(sourceHasTransactionRefs(0), false);
    const blocked = sourceDeleteGuard(3);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.match(blocked.reason, /lưu trữ/i);
    }
    assert.equal(sourceHasTransactionRefs(1), true);
    assert.equal(canEditSourceSpendingGroup(0), true);
    assert.equal(canEditSourceSpendingGroup(1), false);
  });
});
