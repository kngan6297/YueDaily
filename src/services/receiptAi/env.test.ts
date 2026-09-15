import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasAnyReceiptAiKey,
  hasGeminiReceiptKey,
  sanitizeExpoPublicValue,
} from './env.ts';

describe('sanitizeExpoPublicValue', () => {
  it('returns empty for undefined', () => {
    assert.equal(sanitizeExpoPublicValue(undefined), '');
  });

  it('returns empty for literal undefined/null', () => {
    assert.equal(sanitizeExpoPublicValue('undefined'), '');
    assert.equal(sanitizeExpoPublicValue('null'), '');
  });

  it('trims whitespace', () => {
    assert.equal(sanitizeExpoPublicValue('  dummy-key  '), 'dummy-key');
  });

  it('rejects empty after trim', () => {
    assert.equal(sanitizeExpoPublicValue('   '), '');
  });
});

describe('receipt AI env keys', () => {
  it('detects missing keys', () => {
    const env = { geminiKey: '', groqKey: '' };
    assert.equal(hasAnyReceiptAiKey(env), false);
    assert.equal(hasGeminiReceiptKey(env), false);
  });

  it('detects gemini key present', () => {
    const env = { geminiKey: 'dummy-gemini', groqKey: '' };
    assert.equal(hasAnyReceiptAiKey(env), true);
    assert.equal(hasGeminiReceiptKey(env), true);
  });
});
