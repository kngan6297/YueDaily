import type { GeminiAnalysisResult } from '../../types';
import {
  GEMINI_BASE_URL,
  GEMINI_RECEIPT_MODELS,
  GROQ_RECEIPT_MODEL,
  GROQ_RECEIPT_VISION_ENABLED,
  RECEIPT_AI_MAX_OUTPUT_TOKENS,
  RECEIPT_AI_PROVIDER_ORDER,
  RECEIPT_AI_RETRY_DELAY_MS,
  RECEIPT_AI_TIMEOUT_MS,
} from './config';
import type { ReceiptAiEnvKeys } from './env';
import { hasGeminiReceiptKey, hasGroqReceiptKey } from './env';
import { callGroqReceiptModel } from './groqReceipt';
import {
  classifyHttpFailure,
  finalFailureMessage,
  isRecoverableFailure,
  ReceiptAiError,
  receiptAiErrorFromKind,
  type ProviderAttemptFailure,
  type ReceiptAiErrorKind,
} from './errors';
import {
  detectMimeType,
  GEMINI_RESPONSE_SCHEMA,
  parseReceiptAiJson,
  ReceiptAiParseError,
  SYSTEM_INSTRUCTION,
  USER_SCAN_PROMPT,
} from './prompt';
import { receiptAiDevLog } from './devLog';
import {
  classifyTransportFailure,
  describeFetchThrow,
} from './fetchTransport';

export { classifyTransportFailure, describeFetchThrow } from './fetchTransport';

export interface ReceiptAiDeps {
  fetch: typeof fetch;
  dev?: boolean;
  /** Test override for provider order. */
  providerOrder?: 'gemini_first' | 'groq_first';
  /** Test override — force Groq vision on/off. */
  groqVisionEnabled?: boolean;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function nowMs(): number {
  return Date.now();
}

async function fetchWithTimeout(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<{ response: Response; durationMs: number }> {
  const ctrl = new AbortController();
  let abortedByTimeout = false;
  const started = nowMs();
  const timer = setTimeout(() => {
    abortedByTimeout = true;
    ctrl.abort();
  }, RECEIPT_AI_TIMEOUT_MS);
  try {
    const response = await fetchFn(url, { ...init, signal: ctrl.signal });
    return { response, durationMs: nowMs() - started };
  } catch (err) {
    const durationMs = nowMs() - started;
    const kind = classifyTransportFailure({
      err,
      durationMs,
      abortedByTimeout,
    });
    throw receiptAiErrorFromKind(kind);
  } finally {
    clearTimeout(timer);
  }
}

interface GeminiApiErrorBody {
  errorCode?: string;
  errorStatus?: string;
  errorMessage: string;
}

async function readGeminiApiError(res: Response): Promise<GeminiApiErrorBody> {
  let rawText = '';
  try {
    rawText = await res.text();
  } catch {
    return { errorMessage: `HTTP ${res.status}` };
  }

  const trimmed = rawText.trim();
  if (!trimmed) return { errorMessage: `HTTP ${res.status}` };

  try {
    const j = JSON.parse(trimmed) as Record<string, unknown>;
    const err = (j?.error ?? {}) as Record<string, unknown>;
    const nested = (err?.error ?? {}) as Record<string, unknown>;
    const message =
      (typeof err.message === 'string' && err.message) ||
      (typeof nested.message === 'string' && nested.message) ||
      trimmed;

    return {
      errorCode: typeof err.code === 'string' ? err.code : undefined,
      errorStatus: typeof err.status === 'string' ? err.status : undefined,
      errorMessage: message,
    };
  } catch {
    return { errorMessage: trimmed };
  }
}

function logDevFailure(
  dev: boolean,
  provider: string,
  model: string,
  httpStatus: number,
  kind: ReceiptAiErrorKind,
): void {
  if (!dev) return;
  console.warn('[ReceiptAI] provider failed', { provider, model, httpStatus, kind });
}

function logDevConfig(env: ReceiptAiEnvKeys, dev: boolean, order: string): void {
  if (!dev) return;
  console.log('[AI CONFIG]', {
    geminiKeyPresent: Boolean(env.geminiKey),
    groqKeyPresent: Boolean(env.groqKey),
    providerOrder: order,
  });
}

function buildGeminiBody(base64: string): string {
  return JSON.stringify({
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [{
      role: 'user',
      parts: [
        { inline_data: { mime_type: detectMimeType(base64), data: base64 } },
        { text: USER_SCAN_PROMPT },
      ],
    }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: RECEIPT_AI_MAX_OUTPUT_TOKENS,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
}

async function callGeminiModel(
  fetchFn: typeof fetch,
  base64: string,
  apiKey: string,
  model: string,
  dev: boolean,
): Promise<{ result: GeminiAnalysisResult; aiMs: number }> {
  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let body: string;
  try {
    body = buildGeminiBody(base64);
  } catch {
    throw receiptAiErrorFromKind('invalid_response', dev);
  }

  let res: Response;
  let aiMs: number;
  try {
    const fetched = await fetchWithTimeout(fetchFn, url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    res = fetched.response;
    aiMs = fetched.durationMs;
  } catch (err) {
    if (err instanceof ReceiptAiError) throw err;
    throw receiptAiErrorFromKind('network_error', dev);
  }

  // Transient HTTP: one same-model retry after delay, then model fallback if recoverable.
  if (res.status === 503 || res.status === 429) {
    await sleep(RECEIPT_AI_RETRY_DELAY_MS);
    try {
      const fetched = await fetchWithTimeout(fetchFn, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      res = fetched.response;
      aiMs += fetched.durationMs;
    } catch (err) {
      if (err instanceof ReceiptAiError) throw err;
      throw receiptAiErrorFromKind('network_error', dev);
    }
  }

  if (!res.ok) {
    const geminiErr = await readGeminiApiError(res);
    const kind = classifyHttpFailure(res.status, geminiErr.errorMessage);
    logDevFailure(dev, 'gemini', model, res.status, kind);

    if (isRecoverableFailure(kind)) {
      throw new ReceiptAiError(kind, geminiErr.errorMessage);
    }

    throw receiptAiErrorFromKind(kind, dev);
  }

  let data: {
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  try {
    data = await res.json();
  } catch {
    throw receiptAiErrorFromKind('invalid_response', dev);
  }

  const candidate = data?.candidates?.[0];
  const finishReason: string = candidate?.finishReason ?? '';
  const text: string = candidate?.content?.parts?.[0]?.text ?? '';

  if (finishReason === 'SAFETY') {
    throw new ReceiptAiError(
      'invalid_response',
      'Ảnh bị bộ lọc an toàn của Gemini từ chối. Thử ảnh khác nhé!',
    );
  }

  if (!text) {
    throw new ReceiptAiError(
      'invalid_response',
      `${model} không trả về text (${finishReason})`,
    );
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

  return { result, aiMs };
}

function recordFailure(
  failures: ProviderAttemptFailure[],
  provider: string,
  model: string | undefined,
  kind: ReceiptAiErrorKind,
  httpStatus?: number,
): void {
  failures.push({ provider, model, kind, httpStatus });
}

function isTransportFailure(kind: ReceiptAiErrorKind): boolean {
  return kind === 'network_error' || kind === 'timeout';
}

async function runGeminiChain(
  imageBase64: string,
  env: ReceiptAiEnvKeys,
  deps: ReceiptAiDeps,
  failures: ProviderAttemptFailure[],
  dev: boolean,
): Promise<GeminiAnalysisResult> {
  if (!hasGeminiReceiptKey(env)) {
    recordFailure(failures, 'gemini', undefined, 'missing_key');
    throw new ReceiptAiError('missing_key', finalFailureMessage(failures, dev));
  }

  for (const model of GEMINI_RECEIPT_MODELS) {
    try {
      const { result, aiMs } = await callGeminiModel(
        deps.fetch,
        imageBase64,
        env.geminiKey,
        model,
        dev,
      );
      receiptAiDevLog('provider_ok', {
        provider: 'gemini',
        model,
        aiMs,
      });
      return result;
    } catch (err) {
      if (err instanceof ReceiptAiError) {
        receiptAiDevLog('provider_fail', {
          provider: 'gemini',
          model,
          kind: err.kind,
        });

        if (isTransportFailure(err.kind)) {
          throw new ReceiptAiError(err.kind, err.message);
        }

        if (isRecoverableFailure(err.kind)) {
          recordFailure(failures, 'gemini', model, err.kind);
          continue;
        }
        throw new ReceiptAiError(err.kind, err.message);
      }
      throw err;
    }
  }

  throw new ReceiptAiError(
    'all_providers_failed',
    finalFailureMessage(failures, dev),
  );
}

/**
 * Try Groq once. On any failure, record and return null so caller can fall back.
 */
async function tryGroqOnce(
  imageBase64: string,
  env: ReceiptAiEnvKeys,
  deps: ReceiptAiDeps,
  failures: ProviderAttemptFailure[],
  dev: boolean,
): Promise<GeminiAnalysisResult | null> {
  const groqEnabled = deps.groqVisionEnabled ?? GROQ_RECEIPT_VISION_ENABLED;
  if (!groqEnabled || !hasGroqReceiptKey(env)) {
    return null;
  }

  try {
    const { result, durationMs } = await callGroqReceiptModel(
      deps.fetch,
      imageBase64,
      env.groqKey,
      dev,
    );
    receiptAiDevLog('provider_ok', {
      provider: 'groq',
      model: GROQ_RECEIPT_MODEL,
      aiMs: durationMs,
    });
    return result;
  } catch (err) {
    if (err instanceof ReceiptAiError) {
      receiptAiDevLog('provider_fail', {
        provider: 'groq',
        model: GROQ_RECEIPT_MODEL,
        kind: err.kind,
      });
      recordFailure(failures, 'groq', GROQ_RECEIPT_MODEL, err.kind);
      return null;
    }
    recordFailure(failures, 'groq', GROQ_RECEIPT_MODEL, 'network_error');
    return null;
  }
}

/**
 * P1.7A provider orchestration.
 * Default: Groq Qwen 3.8 → Gemini Flash-Lite → Gemini Flash.
 * Groq failures fall through to Gemini when Gemini is configured.
 * No automatic full-chain second retry.
 */
export async function analyzeReceiptImage(
  imageBase64: string,
  env: ReceiptAiEnvKeys,
  deps: ReceiptAiDeps = { fetch: globalThis.fetch },
): Promise<GeminiAnalysisResult> {
  const dev = deps.dev ?? (typeof __DEV__ !== 'undefined' && __DEV__);
  const order = deps.providerOrder ?? RECEIPT_AI_PROVIDER_ORDER;
  logDevConfig(env, dev, order);

  const failures: ProviderAttemptFailure[] = [];
  const groqEnabled = deps.groqVisionEnabled ?? GROQ_RECEIPT_VISION_ENABLED;
  const canGroq = groqEnabled && hasGroqReceiptKey(env);
  const canGemini = hasGeminiReceiptKey(env);

  if (!canGroq && !canGemini) {
    recordFailure(failures, 'gemini', undefined, 'missing_key');
    throw new ReceiptAiError('missing_key', finalFailureMessage(failures, dev));
  }

  if (order === 'groq_first' && canGroq) {
    const groqResult = await tryGroqOnce(imageBase64, env, deps, failures, dev);
    if (groqResult) return groqResult;
    if (!canGemini) {
      throw new ReceiptAiError(
        'all_providers_failed',
        finalFailureMessage(failures, dev),
      );
    }
    receiptAiDevLog('provider_fallback', {
      from: 'groq',
      to: 'gemini',
    });
    return runGeminiChain(imageBase64, env, deps, failures, dev);
  }

  if (!canGemini && canGroq) {
    const groqResult = await tryGroqOnce(imageBase64, env, deps, failures, dev);
    if (groqResult) return groqResult;
    throw new ReceiptAiError(
      'all_providers_failed',
      finalFailureMessage(failures, dev),
    );
  }

  return runGeminiChain(imageBase64, env, deps, failures, dev);
}
