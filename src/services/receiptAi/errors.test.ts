import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyHttpFailure,
  finalFailureMessage,
  isRecoverableFailure,
  userMessageForKind,
} from './errors.ts';

describe('classifyHttpFailure', () => {
  it('401 → invalid_key', () => {
    assert.equal(classifyHttpFailure(401, 'Unauthorized'), 'invalid_key');
  });

  it('403 permission → permission_denied', () => {
    assert.equal(
      classifyHttpFailure(403, 'Permission denied for project'),
      'permission_denied',
    );
  });

  it('403 api key wording → invalid_key', () => {
    assert.equal(
      classifyHttpFailure(403, 'API key not valid'),
      'invalid_key',
    );
  });

  it('404 → model_unavailable', () => {
    assert.equal(
      classifyHttpFailure(404, 'Model not found'),
      'model_unavailable',
    );
  });

  it('429 → rate_limited', () => {
    assert.equal(classifyHttpFailure(429, 'Rate limit exceeded'), 'rate_limited');
  });

  it('503 → server_error', () => {
    assert.equal(classifyHttpFailure(503, 'Overloaded'), 'server_error');
  });

  it('500 → server_error', () => {
    assert.equal(classifyHttpFailure(500, 'Internal error'), 'server_error');
  });

  it('quota message → quota_or_billing', () => {
    assert.equal(
      classifyHttpFailure(400, 'You exceeded your current quota'),
      'quota_or_billing',
    );
  });
});

describe('userMessageForKind', () => {
  it('never mentions API key for rate limit', () => {
    const msg = userMessageForKind('rate_limited');
    assert.match(msg, /hết lượt|quá tải/i);
    assert.doesNotMatch(msg, /API key không hợp lệ/i);
  });

  it('network message is distinct from auth', () => {
    const msg = userMessageForKind('network_error');
    assert.match(msg, /mạng/i);
    assert.doesNotMatch(msg, /API key/i);
  });
});

describe('finalFailureMessage', () => {
  it('model unavailable only → model message', () => {
    const msg = finalFailureMessage([
      { provider: 'groq', kind: 'model_unavailable', httpStatus: 404 },
    ]);
    assert.match(msg, /model/i);
    assert.doesNotMatch(msg, /API key không hợp lệ/i);
  });

  it('rate limit only → quota message not key invalid', () => {
    const msg = finalFailureMessage([
      { provider: 'gemini', model: 'gemini-2.5-flash-lite', kind: 'rate_limited' },
      { provider: 'gemini', model: 'gemini-2.5-flash', kind: 'rate_limited' },
    ]);
    assert.match(msg, /hết lượt|quá tải/i);
    assert.doesNotMatch(msg, /API key không hợp lệ/i);
  });

  it('network failure → network message', () => {
    const msg = finalFailureMessage([
      { provider: 'gemini', kind: 'network_error' },
    ]);
    assert.match(msg, /mạng/i);
  });

  it('all auth failures → auth message', () => {
    const msg = finalFailureMessage([
      { provider: 'gemini', kind: 'invalid_key', httpStatus: 401 },
    ]);
    assert.match(msg, /API key AI không hợp lệ/i);
  });
});

describe('isRecoverableFailure', () => {
  it('model_unavailable is recoverable', () => {
    assert.equal(isRecoverableFailure('model_unavailable'), true);
  });

  it('missing_key is not recoverable via fallback', () => {
    assert.equal(isRecoverableFailure('missing_key'), false);
  });
});
