import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapNativeCategory,
  mapNativeSource,
  mapNativeTransaction,
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
});
