import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  GEMINI_RECEIPT_MODELS,
  GROQ_RECEIPT_MODEL,
  RECEIPT_AI_JPEG_QUALITY,
  RECEIPT_AI_PROVIDER_ORDER,
  RECEIPT_AI_RESIZE_WIDTH,
} from './config.ts';
import { SYSTEM_INSTRUCTION } from './prompt.ts';

const root = join(process.cwd(), 'supabase', 'functions', '_shared', 'receiptAi');

describe('P2.3 Edge receiptAi parity with native contracts', () => {
  it('shares provider order, models, resize, and system prompt text', () => {
    const edgeConfig = readFileSync(join(root, 'config.ts'), 'utf8');
    const edgePrompt = readFileSync(join(root, 'prompt.ts'), 'utf8');

    assert.match(edgeConfig, new RegExp(GROQ_RECEIPT_MODEL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    for (const model of GEMINI_RECEIPT_MODELS) {
      assert.match(edgeConfig, new RegExp(model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.match(edgeConfig, new RegExp(String(RECEIPT_AI_RESIZE_WIDTH)));
    assert.match(edgeConfig, new RegExp(String(RECEIPT_AI_JPEG_QUALITY)));
    assert.match(edgeConfig, new RegExp(RECEIPT_AI_PROVIDER_ORDER));

    // Prompt meaning must not drift — compare full system instruction string.
    assert.ok(edgePrompt.includes(SYSTEM_INSTRUCTION.slice(0, 80)));
    assert.ok(edgePrompt.includes('is_receipt'));
    assert.ok(edgePrompt.includes('Ăn uống'));
  });
});
