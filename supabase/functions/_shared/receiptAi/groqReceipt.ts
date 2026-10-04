import type { GeminiAnalysisResult } from './resultTypes.ts';
import {
  GROQ_BASE_URL,
  GROQ_RECEIPT_MAX_COMPLETION_TOKENS,
  GROQ_RECEIPT_MODEL,
  GROQ_RECEIPT_TIMEOUT_MS,
} from './config.ts';
import {
  classifyHttpFailure,
  ReceiptAiError,
  receiptAiErrorFromKind,
  type ReceiptAiErrorKind,
} from './errors.ts';
import {
  detectMimeType,
  parseReceiptAiJson,
  ReceiptAiParseError,
  SYSTEM_INSTRUCTION,
  USER_SCAN_PROMPT,
} from './prompt.ts';
import {
  classifyTransportFailure,
} from './fetchTransport.ts';

export type GroqReceiptCallResult = {
  result: GeminiAnalysisResult;
  durationMs: number;
  requestBodyLen: number;
  usage?: {
    prompt_tokens: number | null;
    completion_tokens: number | null;
  };
};

function nowMs(): number {
  return Date.now();
}

/**
 * Groq Qwen 3.8 receipt request:
 * reasoning_effort: "none"
 * response_format: json_object
 * temperature: 0.1
 * max_completion_tokens: 128
 * timeout: 8s (caller AbortController)
 */
export function buildGroqReceiptBody(base64: string): string {
  const mimeType = detectMimeType(base64);
  return JSON.stringify({
    model: GROQ_RECEIPT_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      {
        role: 'user',
        content: [
          { type: 'text', text: USER_SCAN_PROMPT },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
        ],
      },
    ],
    temperature: 0.1,
    max_completion_tokens: GROQ_RECEIPT_MAX_COMPLETION_TOKENS,
    stream: false,
    reasoning_effort: 'none',
    response_format: { type: 'json_object' },
  });
}

async function readGroqError(res: Response): Promise<{
  message: string;
  type?: string;
  code?: string;
  param?: string;
}> {
  try {
    const j = (await res.json()) as {
      error?: { message?: string; type?: string; code?: string; param?: string };
    };
    return {
      message: j?.error?.message ?? `HTTP ${res.status}`,
      type: typeof j?.error?.type === 'string' ? j.error.type : undefined,
      code: typeof j?.error?.code === 'string' ? j.error.code : undefined,
      param: typeof j?.error?.param === 'string' ? j.error.param : undefined,
    };
  } catch {
    return { message: `HTTP ${res.status}` };
  }
}

function mapGroqHttpKind(status: number, message: string): ReceiptAiErrorKind {
  if (status === 404 || /model_not_found|does not exist/i.test(message)) {
    return 'model_unavailable';
  }
  return classifyHttpFailure(status, message);
}

export async function callGroqReceiptModel(
  fetchFn: typeof fetch,
  base64: string,
  apiKey: string,
  dev: boolean,
): Promise<GroqReceiptCallResult> {
  const body = buildGroqReceiptBody(base64);

  const ctrl = new AbortController();
  let abortedByTimeout = false;
  const started = nowMs();
  const timer = setTimeout(() => {
    abortedByTimeout = true;
    ctrl.abort();
  }, GROQ_RECEIPT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetchFn(GROQ_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
      signal: ctrl.signal,
    });
  } catch (err) {
    const durationMs = nowMs() - started;
    const kind = classifyTransportFailure({
      err,
      durationMs,
      abortedByTimeout,
      timeoutMs: GROQ_RECEIPT_TIMEOUT_MS,
    });
    throw receiptAiErrorFromKind(kind, dev);
  } finally {
    clearTimeout(timer);
  }

  const durationMs = nowMs() - started;

  if (!res.ok) {
    const groqErr = await readGroqError(res);
    const kind = mapGroqHttpKind(res.status, groqErr.message);
    if (dev) {
      console.warn('[ReceiptAI] provider failed', {
        provider: 'groq',
        model: GROQ_RECEIPT_MODEL,
        httpStatus: res.status,
        kind,
      });
    }
    throw new ReceiptAiError(kind, groqErr.message);
  }

  let data: {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  try {
    data = await res.json();
  } catch {
    throw receiptAiErrorFromKind('invalid_response', dev);
  }

  const text = data?.choices?.[0]?.message?.content ?? '';
  if (!text) {
    throw receiptAiErrorFromKind('invalid_response', dev);
  }

  let result: GeminiAnalysisResult;
  try {
    result = parseReceiptAiJson(text);
  } catch (err) {
    if (err instanceof ReceiptAiParseError) {
      throw receiptAiErrorFromKind('invalid_response', dev);
    }
    throw err;
  }

  return {
    result,
    durationMs,
    requestBodyLen: body.length,
    usage: {
      prompt_tokens: data.usage?.prompt_tokens ?? null,
      completion_tokens: data.usage?.completion_tokens ?? null,
    },
  };
}
