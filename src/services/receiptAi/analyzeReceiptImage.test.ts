import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeReceiptImage,
  classifyTransportFailure,
  describeFetchThrow,
} from './analyzeReceiptImage.ts';
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

describe('describeFetchThrow', () => {
  it('maps TypeError to type_error not abort', () => {
    const d = describeFetchThrow(new TypeError('fetch failed'));
    assert.equal(d.errorName, 'TypeError');
    assert.equal(d.category, 'type_error');
    assert.equal(d.aborted, false);
  });

  it('maps AbortError to abort', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    const d = describeFetchThrow(err);
    assert.equal(d.aborted, true);
    assert.equal(d.category, 'abort');
  });
});

describe('classifyTransportFailure', () => {
  it('near-timeout TypeError → timeout even when aborted=false', () => {
    const kind = classifyTransportFailure({
      err: new TypeError('Network request failed'),
      durationMs: 20_031,
      abortedByTimeout: false,
      timeoutMs: 20_000,
    });
    assert.equal(kind, 'timeout');
  });

  it('abortedByTimeout → timeout', () => {
    const kind = classifyTransportFailure({
      err: new TypeError('Network request failed'),
      durationMs: 19_800,
      abortedByTimeout: true,
      timeoutMs: 20_000,
    });
    assert.equal(kind, 'timeout');
  });

  it('fast TypeError → network_error', () => {
    const kind = classifyTransportFailure({
      err: new TypeError('Network request failed'),
      durationMs: 120,
      abortedByTimeout: false,
      timeoutMs: 20_000,
    });
    assert.equal(kind, 'network_error');
  });
});

describe('analyzeReceiptImage orchestration', () => {
  const env = { geminiKey: 'dummy-gemini-key', groqKey: 'dummy-groq-key' };
  const base64 = '/9j/4AAQTest';
  const geminiOnly = {
    providerOrder: 'gemini_first' as const,
    groqVisionEnabled: false,
  };

  it('primary model success → no fallback call', async () => {
    let calls = 0;
    const fetchFn = mockFetch([
      async () => {
        calls += 1;
        return jsonResponse(200, geminiSuccessBody());
      },
    ]);

    const result = await analyzeReceiptImage(base64, env, { fetch: fetchFn, dev: false, ...geminiOnly });
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

    const result = await analyzeReceiptImage(base64, env, { fetch: fetchFn, dev: false, ...geminiOnly });
    assert.equal(calls, 2);
    assert.equal(result.amount, 120000);
  });

  it('primary rate limited → fallback succeeds', async () => {
    const fetchFn = mockFetch([
      async () => jsonResponse(429, { error: { message: 'Rate limit' } }),
      async () => jsonResponse(200, geminiSuccessBody()),
    ]);

    const result = await analyzeReceiptImage(base64, env, { fetch: fetchFn, dev: false, ...geminiOnly });
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
      () => analyzeReceiptImage(base64, env, { fetch: fetchFn, dev: false, ...geminiOnly }),
      (err: unknown) => {
        assert.ok(err instanceof ReceiptAiError);
        assert.match(err.message, /hết lượt|quá tải/i);
        assert.doesNotMatch(err.message, /API key không hợp lệ/i);
        return true;
      },
    );
  });

  it('network failure → network message not key invalid', async () => {
    let calls = 0;
    const fetchFn = async () => {
      calls += 1;
      throw new TypeError('fetch failed');
    };

    await assert.rejects(
      () => analyzeReceiptImage(base64, env, { fetch: fetchFn, dev: false, ...geminiOnly }),
      (err: unknown) => {
        assert.ok(err instanceof ReceiptAiError);
        assert.equal(err.kind, 'network_error');
        assert.match(err.message, /mạng/i);
        assert.doesNotMatch(err.message, /API key/i);
        return true;
      },
    );
    // Transport failure must not fall through to gemini-2.5-flash
    assert.equal(calls, 1);
  });

  it('missing gemini key → missing config message', async () => {
    await assert.rejects(
      () => analyzeReceiptImage(base64, { geminiKey: '', groqKey: '' }, {
        fetch: async () => jsonResponse(200, {}),
        dev: false,
        ...geminiOnly,
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
      () => analyzeReceiptImage(base64, env, { fetch: fetchFn, dev: false, ...geminiOnly }),
      (err: unknown) => {
        assert.ok(err instanceof ReceiptAiError);
        assert.match(err.message, /API key AI không hợp lệ/i);
        return true;
      },
    );
  });

  it('timeout (AbortError) → timeout kind, no model fallback', async () => {
    let calls = 0;
    const fetchFn = async () => {
      calls += 1;
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    };

    await assert.rejects(
      () => analyzeReceiptImage(base64, env, { fetch: fetchFn, dev: false, ...geminiOnly }),
      (err: unknown) => {
        assert.ok(err instanceof ReceiptAiError);
        assert.equal(err.kind, 'timeout');
        assert.match(err.message, /mạng/i);
        return true;
      },
    );
    assert.equal(calls, 1);
  });

  it('HTTP 500 is not network_error', async () => {
    const fetchFn = mockFetch([
      async () => jsonResponse(500, { error: { message: 'boom' } }),
      async () => jsonResponse(500, { error: { message: 'boom' } }),
    ]);

    await assert.rejects(
      () => analyzeReceiptImage(base64, env, { fetch: fetchFn, dev: false, ...geminiOnly }),
      (err: unknown) => {
        assert.ok(err instanceof ReceiptAiError);
        assert.notEqual(err.kind, 'network_error');
        return true;
      },
    );
  });
});

describe('Groq orchestration (providerOrder=groq_first)', () => {
  const env = { geminiKey: 'dummy-gemini-key', groqKey: 'dummy-groq-key' };
  const base64 = '/9j/4AAQTest';

  function isGroqUrl(url: string): boolean {
    return url.includes('api.groq.com');
  }

  function groqSuccess(): Response {
    return jsonResponse(200, {
      choices: [{ message: { content: VALID_JSON } }],
      usage: { prompt_tokens: 100, completion_tokens: 40 },
    });
  }

  it('Groq success → Gemini not called', async () => {
    let groqCalls = 0;
    let geminiCalls = 0;
    const fetchFn = async (url: string) => {
      if (isGroqUrl(url)) {
        groqCalls += 1;
        return groqSuccess();
      }
      geminiCalls += 1;
      return jsonResponse(200, geminiSuccessBody());
    };

    const result = await analyzeReceiptImage(base64, env, {
      fetch: fetchFn,
      dev: false,
      providerOrder: 'groq_first',
      groqVisionEnabled: true,
    });
    assert.equal(result.amount, 120000);
    assert.equal(groqCalls, 1);
    assert.equal(geminiCalls, 0);
  });

  it('gemini_first → Groq not called', async () => {
    let groqCalls = 0;
    const fetchFn = async (url: string) => {
      if (isGroqUrl(url)) {
        groqCalls += 1;
        return groqSuccess();
      }
      return jsonResponse(200, geminiSuccessBody());
    };

    await analyzeReceiptImage(base64, env, {
      fetch: fetchFn,
      dev: false,
      providerOrder: 'gemini_first',
      groqVisionEnabled: true,
    });
    assert.equal(groqCalls, 0);
  });

  for (const [label, status, body] of [
    ['404', 404, { error: { message: 'model_not_found', code: 'model_not_found' } }],
    ['400', 400, { error: { type: 'invalid_request_error', message: 'invalid image data' } }],
    ['403', 403, { error: { message: 'Permission denied' } }],
    ['429', 429, { error: { message: 'Rate limit', type: 'tokens', code: 'rate_limit_exceeded' } }],
    ['500', 500, { error: { message: 'server boom' } }],
    ['401', 401, { error: { message: 'Invalid API Key' } }],
  ] as const) {
    it(`Groq ${label} → Gemini fallback succeeds`, async () => {
      let geminiCalls = 0;
      const fetchFn = async (url: string) => {
        if (isGroqUrl(url)) {
          return jsonResponse(status, body);
        }
        geminiCalls += 1;
        return jsonResponse(200, geminiSuccessBody());
      };

      const result = await analyzeReceiptImage(base64, env, {
        fetch: fetchFn,
        dev: false,
        providerOrder: 'groq_first',
        groqVisionEnabled: true,
      });
      assert.equal(result.amount, 120000);
      assert.equal(geminiCalls, 1);
    });
  }

  it('Groq malformed JSON → Gemini fallback', async () => {
    let geminiCalls = 0;
    const fetchFn = async (url: string) => {
      if (isGroqUrl(url)) {
        return jsonResponse(200, {
          choices: [{ message: { content: 'not-json{{{' } }],
        });
      }
      geminiCalls += 1;
      return jsonResponse(200, geminiSuccessBody());
    };

    const result = await analyzeReceiptImage(base64, env, {
      fetch: fetchFn,
      dev: false,
      providerOrder: 'groq_first',
      groqVisionEnabled: true,
    });
    assert.equal(result.amount, 120000);
    assert.equal(geminiCalls, 1);
  });

  it('default production order is groq_first (Groq succeeds without Gemini)', async () => {
    let groqCalls = 0;
    let geminiCalls = 0;
    const fetchFn = async (url: string) => {
      if (isGroqUrl(url)) {
        groqCalls += 1;
        return groqSuccess();
      }
      geminiCalls += 1;
      return jsonResponse(200, geminiSuccessBody());
    };

    const result = await analyzeReceiptImage(base64, env, {
      fetch: fetchFn,
      dev: false,
      groqVisionEnabled: true,
    });
    assert.equal(result.amount, 120000);
    assert.equal(groqCalls, 1);
    assert.equal(geminiCalls, 0);
  });
});
