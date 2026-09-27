import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RECEIPT_AI_MAX_OUTPUT_TOKENS } from './config.ts';
import {
  parseReceiptAiJson,
  receiptAiPromptAudit,
  SYSTEM_INSTRUCTION,
  USER_SCAN_PROMPT,
} from './prompt.ts';

describe('receipt AI prompt performance budget', () => {
  it('keeps user turn short; system includes extraction rules', () => {
    const audit = receiptAiPromptAudit();
    assert.ok(audit.systemLen > 200, `systemLen=${audit.systemLen}`);
    assert.ok(audit.systemLen < 2000, `systemLen=${audit.systemLen}`);
    assert.ok(audit.userLen < 80, `userLen=${audit.userLen}`);
    assert.ok(audit.schemaJsonLen < 500, `schemaJsonLen=${audit.schemaJsonLen}`);
    assert.equal(audit.maxOutputTokens, RECEIPT_AI_MAX_OUTPUT_TOKENS);
    assert.ok(RECEIPT_AI_MAX_OUTPUT_TOKENS <= 160);
    assert.ok(RECEIPT_AI_MAX_OUTPUT_TOKENS >= 64);
  });

  it('requires verbatim description and specialized category priority', () => {
    assert.match(SYSTEM_INSTRUCTION, /chép nguyên văn/);
    assert.match(SYSTEM_INSTRUCTION, /Ưu tiên nhóm chuyên biệt/);
    assert.match(SYSTEM_INSTRUCTION, /Trà & Cà phê/);
  });

  it('does not ask for chain-of-thought or verbose prose', () => {
    const blob = `${SYSTEM_INSTRUCTION}\n${USER_SCAN_PROMPT}`.toLowerCase();
    assert.doesNotMatch(blob, /giải thích chi tiết|reason step|chain.of.thought|suy nghĩ từng bước/);
  });

  it('maxOutputTokens fits a realistic receipt JSON', () => {
    const sample = JSON.stringify({
      is_receipt: true,
      amount: 1_250_000,
      description: 'Ăn tối tại Haidilao Quận 1 Hà Nội dài một chút',
      category: 'Ăn uống',
    });
    // Rough char→token upper bound for Vietnamese JSON (~1 token / 2 chars).
    const approxTokens = Math.ceil(sample.length / 2);
    assert.ok(
      approxTokens <= RECEIPT_AI_MAX_OUTPUT_TOKENS,
      `approxTokens=${approxTokens} limit=${RECEIPT_AI_MAX_OUTPUT_TOKENS}`,
    );
    const parsed = parseReceiptAiJson(sample);
    assert.equal(parsed.amount, 1_250_000);
    assert.equal(parsed.category, 'Ăn uống');
  });
});
