import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EXPENSE_AUDIENCE,
  EXPENSE_AUDIENCE_CHOICES,
  EXPENSE_AUDIENCE_LABELS,
  LEGACY_DEFAULT_PAYER,
  normalizeExpenseAudience,
  resolvePayerForInsert,
} from './index.ts';

describe('expense audience P1.5', () => {
  it('maps internal ids to Yue / Kai / Meo labels', () => {
    assert.equal(EXPENSE_AUDIENCE_LABELS.wife, 'Yue');
    assert.equal(EXPENSE_AUDIENCE_LABELS.husband, 'Kai');
    assert.equal(EXPENSE_AUDIENCE_LABELS.couple, 'Yue + Kai');
    assert.equal(EXPENSE_AUDIENCE_LABELS.wife_and_sister, 'Yue + Meo');
    assert.equal(EXPENSE_AUDIENCE_LABELS.couple_and_sister, 'Yue + Kai + Meo');
    assert.equal(EXPENSE_AUDIENCE_LABELS.unspecified, 'Chưa phân loại');
  });

  it('create choices include Yue + Meo and exclude unspecified', () => {
    assert.deepEqual(EXPENSE_AUDIENCE_CHOICES, [
      'wife',
      'husband',
      'couple',
      'wife_and_sister',
      'couple_and_sister',
    ]);
    assert.equal(DEFAULT_EXPENSE_AUDIENCE, 'couple');
  });

  it('preserves known audiences and does not infer wife_and_sister', () => {
    assert.equal(normalizeExpenseAudience('wife'), 'wife');
    assert.equal(normalizeExpenseAudience('husband'), 'husband');
    assert.equal(normalizeExpenseAudience('couple'), 'couple');
    assert.equal(normalizeExpenseAudience('wife_and_sister'), 'wife_and_sister');
    assert.equal(normalizeExpenseAudience('couple_and_sister'), 'couple_and_sister');
    assert.equal(normalizeExpenseAudience('unspecified'), 'unspecified');
    assert.equal(normalizeExpenseAudience('wife'), 'wife');
    assert.notEqual(normalizeExpenseAudience('wife'), 'wife_and_sister');
    assert.equal(normalizeExpenseAudience('unknown'), 'unspecified');
    assert.equal(normalizeExpenseAudience(null), 'unspecified');
  });

  it('insert payer defaults to schema-compatible Yue value without UI', () => {
    assert.equal(LEGACY_DEFAULT_PAYER, 'Vợ');
    assert.equal(resolvePayerForInsert(undefined), 'Vợ');
    assert.equal(resolvePayerForInsert(''), 'Vợ');
    assert.equal(resolvePayerForInsert('  '), 'Vợ');
    assert.equal(resolvePayerForInsert('Chồng'), 'Chồng');
  });
});
