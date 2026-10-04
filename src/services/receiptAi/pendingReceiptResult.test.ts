import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearPendingReceiptResult,
  consumePendingReceiptResult,
  PENDING_RECEIPT_RESULT_TTL_MS,
  setPendingReceiptResult,
} from './pendingReceiptResult.ts';

describe('pendingReceiptResult', () => {
  it('is one-shot', () => {
    setPendingReceiptResult({ amount: 100 });
    assert.equal(consumePendingReceiptResult()?.amount, 100);
    assert.equal(consumePendingReceiptResult(), null);
  });

  it('expires after TTL', () => {
    setPendingReceiptResult({ amount: 1 }, 1000);
    assert.equal(consumePendingReceiptResult(1000 + PENDING_RECEIPT_RESULT_TTL_MS + 1), null);
  });

  it('clear drops pending value', () => {
    setPendingReceiptResult({ amount: 1 });
    clearPendingReceiptResult();
    assert.equal(consumePendingReceiptResult(), null);
  });
});
