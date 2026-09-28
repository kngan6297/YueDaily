// ============================================================
// Shared Groq text completion (JSON object responses)
// ============================================================

import { GROQ_BASE_URL, GROQ_TEXT_MODEL, GROQ_TEXT_TIMEOUT_MS, TEXT_AI_MAX_OUTPUT_TOKENS } from './config';
import {
  classifyHttpFailure,
  TextAiError,
  textAiErrorFromKind,
} from './errors';
import { fetchWithTimeout } from './fetchWithTimeout';

export interface TextCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqTextCallResult {
  text: string;
  durationMs: number;
  model: string;
  provider: 'groq';
}

export function buildGroqTextBody(
  messages: TextCompletionMessage[],
  opts: { maxTokens?: number; temperature?: number; model?: string } = {},
): string {
  return JSON.stringify({
    model: opts.model ?? GROQ_TEXT_MODEL,
    messages,
    temperature: opts.temperature ?? 0.2,
    max_completion_tokens: opts.maxTokens ?? TEXT_AI_MAX_OUTPUT_TOKENS,
    stream: false,
    reasoning_effort: 'none',
    response_format: { type: 'json_object' },
  });
}

async function readGroqError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as {
      error?: { message?: string };
    };
    if (typeof j?.error?.message === 'string') return j.error.message;
  } catch {
    /* ignore */
  }
  return `HTTP ${res.status}`;
}

export async function callGroqTextModel(
  fetchFn: typeof fetch,
  messages: TextCompletionMessage[],
  apiKey: string,
  opts: {
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
    model?: string;
    dev?: boolean;
  } = {},
): Promise<GroqTextCallResult> {
  const model = opts.model ?? GROQ_TEXT_MODEL;
  const timeoutMs = opts.timeoutMs ?? GROQ_TEXT_TIMEOUT_MS;
  const body = buildGroqTextBody(messages, {
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
    model,
  });

  let res: Response;
  let durationMs: number;
  try {
    const fetched = await fetchWithTimeout(
      fetchFn,
      GROQ_BASE_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
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

  if (!res.ok) {
    const msg = await readGroqError(res);
    const kind = classifyHttpFailure(res.status, msg);
    throw new TextAiError(kind, msg);
  }

  let data: {
    choices?: Array<{ message?: { content?: string } }>;
  };
  try {
    data = await res.json();
  } catch {
    throw textAiErrorFromKind('invalid_response', { feature: 'chat', dev: opts.dev });
  }

  const text = data?.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) {
    throw textAiErrorFromKind('invalid_response', { feature: 'chat', dev: opts.dev });
  }

  return { text, durationMs, model, provider: 'groq' };
}
