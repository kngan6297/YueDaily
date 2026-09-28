// ============================================================
// Shared Gemini text completion (JSON object responses)
// ============================================================

import {
  GEMINI_BASE_URL,
  GEMINI_TEXT_MODELS,
  TEXT_AI_MAX_OUTPUT_TOKENS,
  TEXT_AI_RETRY_DELAY_MS,
  TEXT_AI_TIMEOUT_MS,
} from './config';
import {
  classifyHttpFailure,
  TextAiError,
  textAiErrorFromKind,
} from './errors';
import { fetchWithTimeout } from './fetchWithTimeout';
import type { TextCompletionMessage } from './groqText';

export interface GeminiTextCallResult {
  text: string;
  durationMs: number;
  model: string;
  provider: 'gemini';
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function buildGeminiTextBody(
  messages: TextCompletionMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): string {
  const systemParts = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  return JSON.stringify({
    ...(systemParts
      ? { systemInstruction: { parts: [{ text: systemParts }] } }
      : {}),
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens: opts.maxTokens ?? TEXT_AI_MAX_OUTPUT_TOKENS,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
}

async function readGeminiApiError(res: Response): Promise<string> {
  try {
    const rawText = await res.text();
    const trimmed = rawText.trim();
    if (!trimmed) return `HTTP ${res.status}`;
    try {
      const j = JSON.parse(trimmed) as Record<string, unknown>;
      const err = (j?.error ?? {}) as Record<string, unknown>;
      if (typeof err.message === 'string') return err.message;
    } catch {
      /* ignore */
    }
    return trimmed;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function callGeminiTextModel(
  fetchFn: typeof fetch,
  messages: TextCompletionMessage[],
  apiKey: string,
  model: string,
  opts: {
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
    dev?: boolean;
  } = {},
): Promise<GeminiTextCallResult> {
  const timeoutMs = opts.timeoutMs ?? TEXT_AI_TIMEOUT_MS;
  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = buildGeminiTextBody(messages, {
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
  });

  let res: Response;
  let durationMs: number;
  try {
    const fetched = await fetchWithTimeout(
      fetchFn,
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      },
      timeoutMs,
    );
    res = fetched.response;
    durationMs = fetched.durationMs;
  } catch (err) {
    if (err instanceof TextAiError) throw err;
    throw textAiErrorFromKind('network_error', { feature: 'chat', dev: opts.dev });
  }

  if (res.status === 503 || res.status === 429) {
    await sleep(TEXT_AI_RETRY_DELAY_MS);
    try {
      const fetched = await fetchWithTimeout(
        fetchFn,
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        },
        timeoutMs,
      );
      res = fetched.response;
      durationMs += fetched.durationMs;
    } catch (err) {
      if (err instanceof TextAiError) throw err;
      throw textAiErrorFromKind('network_error', { feature: 'chat', dev: opts.dev });
    }
  }

  if (!res.ok) {
    const msg = await readGeminiApiError(res);
    const kind = classifyHttpFailure(res.status, msg);
    throw new TextAiError(kind, msg);
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
    throw textAiErrorFromKind('invalid_response', { feature: 'chat', dev: opts.dev });
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text.trim()) {
    throw textAiErrorFromKind('invalid_response', { feature: 'chat', dev: opts.dev });
  }

  return { text, durationMs, model, provider: 'gemini' };
}

export { GEMINI_TEXT_MODELS };
