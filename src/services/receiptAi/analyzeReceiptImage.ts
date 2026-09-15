import type { GeminiAnalysisResult } from '../../types';
import {
  GEMINI_BASE_URL,
  GEMINI_RECEIPT_MODELS,
  GROQ_RECEIPT_VISION_ENABLED,
  RECEIPT_AI_RETRY_DELAY_MS,
  RECEIPT_AI_TIMEOUT_MS,
} from './config';
import type { ReceiptAiEnvKeys } from './env';
import { hasGeminiReceiptKey } from './env';
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

export interface ReceiptAiDeps {
  fetch: typeof fetch;
  dev?: boolean;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function fetchWithTimeout(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RECEIPT_AI_TIMEOUT_MS);
  try {
    return await fetchFn(url, { ...init, signal: ctrl.signal });
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

function logDevConfig(env: ReceiptAiEnvKeys, dev: boolean): void {
  if (!dev) return;
  console.log('[AI CONFIG]', {
    geminiKeyPresent: Boolean(env.geminiKey),
    groqKeyPresent: Boolean(env.groqKey),
    groqReceiptVision: GROQ_RECEIPT_VISION_ENABLED ? 'enabled' : 'disabled',
    geminiModels: [...GEMINI_RECEIPT_MODELS],
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
      temperature: 0.1,
      maxOutputTokens: 256,
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
): Promise<GeminiAnalysisResult> {
  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = buildGeminiBody(base64);

  let res: Response;
  try {
    res = await fetchWithTimeout(fetchFn, url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw receiptAiErrorFromKind('timeout', dev);
    }
    throw receiptAiErrorFromKind('network_error', dev);
  }

  if (res.status === 503 || res.status === 429) {
    await sleep(RECEIPT_AI_RETRY_DELAY_MS);
    try {
      res = await fetchWithTimeout(fetchFn, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw receiptAiErrorFromKind('timeout', dev);
      }
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

  const data = await res.json();
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

  try {
    return parseReceiptAiJson(text);
  } catch (err) {
    if (err instanceof ReceiptAiParseError) {
      throw receiptAiErrorFromKind('invalid_response', dev);
    }
    throw err;
  }
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

/**
 * P1.7A provider order: Gemini Flash-Lite → Gemini Flash.
 * Groq receipt vision disabled — no verified image-capable model on account.
 */
export async function analyzeReceiptImage(
  imageBase64: string,
  env: ReceiptAiEnvKeys,
  deps: ReceiptAiDeps = { fetch: globalThis.fetch },
): Promise<GeminiAnalysisResult> {
  const dev = deps.dev ?? (typeof __DEV__ !== 'undefined' && __DEV__);
  logDevConfig(env, dev);

  const failures: ProviderAttemptFailure[] = [];

  if (!hasGeminiReceiptKey(env)) {
    recordFailure(failures, 'gemini', undefined, 'missing_key');
    throw new ReceiptAiError(
      'missing_key',
      finalFailureMessage(failures, dev),
    );
  }

  for (const model of GEMINI_RECEIPT_MODELS) {
    try {
      return await callGeminiModel(
        deps.fetch,
        imageBase64,
        env.geminiKey,
        model,
        dev,
      );
    } catch (err) {
      if (err instanceof ReceiptAiError) {
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
