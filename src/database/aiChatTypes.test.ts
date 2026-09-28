import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_CHAT_MESSAGES_FK_SQL,
  decodeAssistantContent,
  deriveThreadTitleFromQuestion,
  encodeAssistantContent,
  parseAiChatContextJson,
  serializeAiChatContextJson,
} from './aiChatTypes.ts';

describe('ai chat types / context', () => {
  it('persists context refs without inventing fields', () => {
    const json = serializeAiChatContextJson({
      excludedTransactionIds: [3, 3, 5],
      lastReferencedTransactionIds: [9],
      lastBreakdownDimension: 'category',
      comparisonMonth: { year: 2026, month: 8 },
      activeFilters: { audience: 'wife', categoryNames: ['Mua sắm'] },
    });
    const parsed = parseAiChatContextJson(json);
    assert.deepEqual(parsed.excludedTransactionIds, [3, 5]);
    assert.deepEqual(parsed.lastReferencedTransactionIds, [9]);
    assert.equal(parsed.lastBreakdownDimension, 'category');
    assert.deepEqual(parsed.comparisonMonth, { year: 2026, month: 8 });
    assert.equal(parsed.activeFilters?.audience, 'wife');
    assert.deepEqual(parsed.activeFilters?.categoryNames, ['Mua sắm']);
    assert.equal(json.includes('amount'), false);
    assert.equal(json.includes('image_uri'), false);
  });

  it('ignores invalid context_json', () => {
    assert.deepEqual(parseAiChatContextJson('not-json'), {});
    assert.deepEqual(parseAiChatContextJson('[]'), {});
    assert.deepEqual(parseAiChatContextJson(null), {});
  });

  it('assistant envelope round-trips evidence + followUps', () => {
    const encoded = encodeAssistantContent({
      answer: 'Mua sắm nhiều nhất.',
      evidenceTransactionIds: [10, 11],
      followUps: ['So với tháng trước?', 'Riêng Yue?'],
    });
    const decoded = decodeAssistantContent(encoded);
    assert.equal(decoded.answer, 'Mua sắm nhiều nhất.');
    assert.deepEqual(decoded.evidenceTransactionIds, [10, 11]);
    assert.equal(decoded.followUps.length, 2);
  });

  it('plain assistant text still decodes', () => {
    const decoded = decodeAssistantContent('Trả lời thường');
    assert.equal(decoded.answer, 'Trả lời thường');
    assert.deepEqual(decoded.evidenceTransactionIds, []);
  });

  it('derives truncated thread title locally', () => {
    const short = deriveThreadTitleFromQuestion('Tóm tắt tháng này');
    assert.equal(short, 'Tóm tắt tháng này');
    const long = deriveThreadTitleFromQuestion('a'.repeat(80), 48);
    assert.ok(long.endsWith('…'));
    assert.ok(long.length <= 48);
  });

  it('messages FK uses ON DELETE CASCADE', () => {
    assert.match(AI_CHAT_MESSAGES_FK_SQL, /ON DELETE CASCADE/);
  });
});
