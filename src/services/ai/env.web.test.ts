import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadAiEnvFromProcess } from './env.web.ts';

describe('ai/env.web', () => {
  it('does not expose provider keys on web', () => {
    const env = loadAiEnvFromProcess();
    assert.equal(env.groqKey, '');
    assert.equal(env.geminiKey, '');
  });
});
