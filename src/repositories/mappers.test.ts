import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapCloudCategory,
  mapCloudSource,
  mapCloudTransaction,
  mapNativeCategory,
  mapNativeSource,
  mapNativeTransaction,
  parseAmountInteger,
} from './mappers.ts';

describe('repository mappers', () => {
  it('maps native transaction ids to opaque strings', () => {
    const mapped = mapNativeTransaction({
      id: 42,
      amount: 15000,
      type: 'chi',
      category_id: 3,
      source_id: 7,
      payer: 'Vợ',
      expense_audience: 'couple',
      image_uri: null,
      location: null,
      note: 'cà phê',
      status: 'complete',
      created_at: '2026-10-03 12:00:00',
      category_name: 'Ăn uống',
      source_name: 'VPBank',
    });
    assert.equal(mapped.id, '42');
    assert.equal(mapped.category_id, '3');
    assert.equal(mapped.source_id, '7');
    assert.equal(mapped.expense_audience, 'couple');
    assert.equal(mapped.transaction_date, '2026-10-03');
    assert.equal(mapped.created_at, '2026-10-03 12:00:00');
  });

  it('maps cloud transaction_date without UTC shift or user_id leak', () => {
    const mapped = mapCloudTransaction({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      amount: 20000,
      type: 'chi',
      category_id: 'cat-1',
      source_id: 'src-1',
      payer: 'Vợ',
      expense_audience: 'wife',
      image_uri: null,
      location: null,
      note: null,
      status: 'complete',
      transaction_date: '2026-01-31',
      created_at: '2026-01-31 12:00:00',
      categories: { name: 'Di chuyển', icon: '🛵', color: '#82C0FF' },
      sources: { name: 'Tiền mặt' },
    });
    assert.equal(mapped.id, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    assert.equal(mapped.transaction_date, '2026-01-31');
    assert.equal(mapped.category_name, 'Di chuyển');
    assert.equal(mapped.source_name, 'Tiền mặt');
    assert.equal('user_id' in mapped, false);
  });

  it('preserves month-boundary dates exactly', () => {
    const jan31 = mapCloudTransaction({
      id: 'a',
      amount: 1,
      type: 'chi',
      category_id: null,
      source_id: null,
      payer: 'Vợ',
      expense_audience: 'couple',
      image_uri: null,
      location: null,
      note: null,
      status: 'complete',
      transaction_date: '2026-01-31',
      created_at: '2026-01-31 12:00:00',
    });
    const feb1 = mapCloudTransaction({
      id: 'b',
      amount: 1,
      type: 'chi',
      category_id: null,
      source_id: null,
      payer: 'Vợ',
      expense_audience: 'couple',
      image_uri: null,
      location: null,
      note: null,
      status: 'complete',
      transaction_date: '2026-02-01',
      created_at: '2026-02-01 12:00:00',
    });
    assert.equal(jan31.transaction_date, '2026-01-31');
    assert.equal(feb1.transaction_date, '2026-02-01');
  });

  it('maps cloud source boolean is_active to 0/1', () => {
    const active = mapCloudSource({
      id: 's1',
      name: 'Cash',
      is_active: true,
      spending_group: 'personal_yue',
    });
    const archived = mapCloudSource({
      id: 's2',
      name: 'Old',
      is_active: false,
      spending_group: null,
    });
    assert.equal(active.is_active, 1);
    assert.equal(archived.is_active, 0);
    assert.equal(archived.spending_group, null);
  });

  it('maps native category budget_group', () => {
    const mapped = mapNativeCategory({
      id: 1,
      name: 'Ăn uống',
      type: 'chi',
      icon: '🍜',
      color: '#FF8FAB',
      budget_group: 'household_food',
    });
    assert.equal(mapped.id, '1');
    assert.equal(mapped.budget_group, 'household_food');
  });

  it('maps cloud category', () => {
    const mapped = mapCloudCategory({
      id: 'c1',
      name: 'Khác',
      type: 'both',
      icon: '✨',
      color: '#EBD9FF',
      budget_group: null,
    });
    assert.equal(mapped.type, 'both');
    assert.equal(mapped.budget_group, null);
  });

  it('maps native source reference counts', () => {
    const mapped = mapNativeSource({
      id: 9,
      name: 'Woori',
      is_active: 1,
      spending_group: 'household',
      reference_count: 4,
    });
    assert.equal(mapped.id, '9');
    assert.equal('reference_count' in mapped && mapped.reference_count, 4);
  });

  it('parses VND amount as integer without floats', () => {
    assert.equal(parseAmountInteger('15.000đ'), 15000);
    assert.equal(parseAmountInteger('abc'), 0);
  });
});
