import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeReceiptImage } from './analyzeReceiptImage.ts';
import { ReceiptAiError } from './errors.ts';

const VALID_JSON = JSON.stringify({
  is_receipt: true,
  amount: 120000,
  description: 'Ăn tối tại WinMart',
  category: 'Mua sắm',
});

function geminiSuccessBody(text = VALID_JSON) {
  return {
    candidates: [{
      finishReason: 'STOP',
      content: { parts: [{ text }] },
    }],
  };
}

function mockFetch(handlers: Array<(url: string, init?: RequestInit) => Promise<Response>>) {
  let call = 0;
  return async (url: string, init?: RequestInit) => {
    const handler = handlers[call] ?? handlers[handlers.length - 1];
    call += 1;
    return handler(url, init);
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('analyzeReceiptImage orchestration', () => {
  const env = { geminiKey: 'dummy-gemini-key', groqKey: 'dummy-groq-key' };
  const base64 = '/9j/4AAQTest';

  it('primary model success → no fallback call', async () => {
    let calls = 0;
    const fetchFn = mockFetch([
      async () => {
        calls += 1;
        return jsonResponse(200, geminiSuccessBody());
      },
    ]);

    const result = await analyzeReceiptImage(base64, env, { fetch: fetchFn, dev: false });
    assert.equal(calls, 1);
    assert.equal(result.amount, 120000);
  });

  it('primary model 404 → fallback model succeeds', async () => {
    let calls = 0;
    const fetchFn = mockFetch([
      async () => {
        calls += 1;
        return jsonResponse(404, { error: { message: 'Model not found' } });
      },
      async () => {
        calls += 1;
        return jsonResponse(200, geminiSuccessBody());
      },
    ]);

    const result = await analyzeReceiptImage(base64, env, { fetch: fetchFn, dev: false });
    assert.equal(calls, 2);
    assert.equal(result.amount, 120000);
  });

  it('primary rate limited → fallback succeeds', async () => {
    const fetchFn = mockFetch([
      async () => jsonResponse(429, { error: { message: 'Rate limit' } }),
      async () => jsonResponse(200, geminiSuccessBody()),
    ]);

    const result = await analyzeReceiptImage(base64, env, { fetch: fetchFn, dev: false });
    assert.equal(result.amount, 120000);
  });

  it('all models rate limited → quota message not key invalid', async () => {
    const fetchFn = mockFetch([
      async () => jsonResponse(429, { error: { message: 'Rate limit' } }),
      async () => jsonResponse(429, { error: { message: 'Rate limit' } }),
      async () => jsonResponse(429, { error: { message: 'Rate limit' } }),
      async () => jsonResponse(429, { error: { message: 'Rate limit' } }),
    ]);

    await assert.rejects(
      () => analyzeReceiptImage(base64, env, { fetch: fetchFn, dev: false }),
      (err: unknown) => {
        assert.ok(err instanceof ReceiptAiError);
        assert.match(err.message, /hết lượt|quá tải/i);
        assert.doesNotMatch(err.message, /API key không hợp lệ/i);
        return true;
      },
    );
  });

  it('network failure → network message not key invalid', async () => {
    const fetchFn = async () => {
      throw new TypeError('fetch failed');
    };

    await assert.rejects(
      () => analyzeReceiptImage(base64, env, { fetch: fetchFn, dev: false }),
      (err: unknown) => {
        assert.ok(err instanceof ReceiptAiError);
        assert.match(err.message, /mạng/i);
        assert.doesNotMatch(err.message, /API key/i);
        return true;
      },
    );
  });

  it('missing gemini key → missing config message', async () => {
    await assert.rejects(
      () => analyzeReceiptImage(base64, { geminiKey: '', groqKey: '' }, {
        fetch: async () => jsonResponse(200, {}),
        dev: false,
      }),
      (err: unknown) => {
        assert.ok(err instanceof ReceiptAiError);
        assert.match(err.message, /Chưa cấu hình AI/i);
        return true;
      },
    );
  });

  it('401 on all models → auth message', async () => {
    const fetchFn = mockFetch([
      async () => jsonResponse(401, { error: { message: 'API key not valid' } }),
      async () => jsonResponse(401, { error: { message: 'API key not valid' } }),
    ]);

    await assert.rejects(
      () => analyzeReceiptImage(base64, env, { fetch: fetchFn, dev: false }),
      (err: unknown) => {
        assert.ok(err instanceof ReceiptAiError);
        assert.match(err.message, /API key AI không hợp lệ/i);
        return true;
      },
    );
  });

  it('timeout (AbortError) → network-class message', async () => {
    const fetchFn = async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    };

    await assert.rejects(
      () => analyzeReceiptImage(base64, env, { fetch: fetchFn, dev: false }),
      (err: unknown) => {
        assert.ok(err instanceof ReceiptAiError);
        assert.match(err.message, /mạng/i);
        return true;
      },
    );
  });
});
