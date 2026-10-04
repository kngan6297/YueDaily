import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeReceiptViaEdge } from './webClient.web.ts';
import {
  EDGE_ERROR_CODES,
  EDGE_ERROR_RATE_LIMITED,
  EDGE_ERROR_UNAUTHENTICATED,
} from './edgeErrorCodes.ts';
import {
  extractEdgeErrorCode,
  receiptAiErrorFromEdgeCode,
  receiptAiErrorFromInvokeError,
} from './webClientErrors.ts';

type InvokeResult = { data: unknown; error: unknown };

function fakeClient(
  impl: (name: string, opts: { body: FormData }) => Promise<InvokeResult>,
) {
  const calls: Array<{ name: string; body: FormData }> = [];
  const client = {
    functions: {
      invoke: async (name: string, opts: { body: FormData }) => {
        calls.push({ name, body: opts.body });
        return impl(name, opts);
      },
    },
  };
  return { client: client as never, calls };
}

const blob = new Blob([new Uint8Array(10)], { type: 'image/jpeg' });

describe('analyzeReceiptViaEdge', () => {
  it('posts FormData field "image" to analyze-receipt without user_id', async () => {
    const { client, calls } = fakeClient(async () => ({
      data: {
        result: { is_receipt: true, amount: 45000, description: 'Cà phê', category: 'Trà & Cà phê' },
      },
      error: null,
    }));
    const result = await analyzeReceiptViaEdge(blob, client);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'analyze-receipt');
    assert.ok(calls[0].body instanceof FormData);
    assert.ok(calls[0].body.get('image') instanceof Blob);
    assert.equal(calls[0].body.get('user_id'), null);
    assert.equal(result.amount, 45000);
    assert.equal(result.category, 'Trà & Cà phê');
    assert.equal(result.note, 'Cà phê');
  });

  it('normalizes unknown category to Khác', async () => {
    const { client } = fakeClient(async () => ({
      data: { result: { is_receipt: true, amount: 1000, description: 'x', category: 'Lạ' } },
      error: null,
    }));
    const result = await analyzeReceiptViaEdge(blob, client);
    assert.equal(result.category, 'Khác');
  });

  it('rejects malformed payloads', async () => {
    for (const data of [{}, { result: null }, { result: [] }, { result: {} }, 'oops']) {
      const { client } = fakeClient(async () => ({ data, error: null }));
      await assert.rejects(
        () => analyzeReceiptViaEdge(blob, client),
        (err: unknown) => (err as { kind?: string }).kind === 'invalid_response',
      );
    }
  });

  it('maps edge error body from FunctionsHttpError context', async () => {
    const { client } = fakeClient(async () => ({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        context: {
          status: 429,
          json: async () => ({ error: { code: 'RATE_LIMITED', message: 'provider raw body' } }),
        },
      },
    }));
    await assert.rejects(
      () => analyzeReceiptViaEdge(blob, client),
      (err: unknown) => {
        const e = err as { kind?: string; message?: string };
        assert.equal(e.kind, 'rate_limited');
        assert.doesNotMatch(String(e.message), /provider raw body/);
        return true;
      },
    );
  });

  it('maps fetch failure to network_error', async () => {
    const { client } = fakeClient(async () => ({
      data: null,
      error: { name: 'FunctionsFetchError', context: new Error('Failed to fetch') },
    }));
    await assert.rejects(
      () => analyzeReceiptViaEdge(blob, client),
      (err: unknown) => (err as { kind?: string }).kind === 'network_error',
    );
  });

  it('maps thrown invoke errors to network_error', async () => {
    const { client } = fakeClient(async () => {
      throw new Error('boom');
    });
    await assert.rejects(
      () => analyzeReceiptViaEdge(blob, client),
      (err: unknown) => (err as { kind?: string }).kind === 'network_error',
    );
  });
});

describe('webClientErrors', () => {
  it('maps every edge code to a Vietnamese ReceiptAiError', () => {
    for (const code of EDGE_ERROR_CODES) {
      const err = receiptAiErrorFromEdgeCode(code);
      assert.equal(err.name, 'ReceiptAiError');
      assert.match(err.message, /[ăâđêôơưáàạảãéèẹẻẽíìịỉĩóòọỏõúùụủũýỳỵỷỹ]/i);
    }
  });

  it('extracts codes from supported body shapes', () => {
    assert.equal(extractEdgeErrorCode({ error: { code: 'UNAUTHENTICATED' } }), EDGE_ERROR_UNAUTHENTICATED);
    assert.equal(extractEdgeErrorCode({ error: 'RATE_LIMITED' }), EDGE_ERROR_RATE_LIMITED);
    assert.equal(extractEdgeErrorCode({ code: 'RATE_LIMITED' }), EDGE_ERROR_RATE_LIMITED);
    assert.equal(extractEdgeErrorCode({ error: { code: 'SOMETHING_ELSE' } }), null);
    assert.equal(extractEdgeErrorCode(null), null);
  });

  it('falls back to HTTP status when body has no known code', async () => {
    const err = await receiptAiErrorFromInvokeError({
      name: 'FunctionsHttpError',
      context: { status: 401, json: async () => ({ message: 'Invalid JWT' }) },
    });
    assert.equal(err.kind, 'permission_denied');
    assert.doesNotMatch(err.message, /JWT/);
  });

  it('returns generic message for unknown failures', async () => {
    const err = await receiptAiErrorFromInvokeError({ name: 'Weird' });
    assert.equal(err.kind, 'server_error');
  });
});
