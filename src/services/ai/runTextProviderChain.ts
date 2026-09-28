// ============================================================
// Shared text provider chain: Groq → Gemini Flash-Lite → Flash
// ============================================================

import { GEMINI_TEXT_MODELS, GROQ_TEXT_MODEL, TEXT_AI_PROVIDER_ORDER } from './config';
import { aiDevLog } from './devLog';
import type { AiEnvKeys } from './env';
import { hasGeminiAiKey, hasGroqAiKey } from './env';
import {
  finalFailureMessage,
  isRecoverableProviderFailure,
  TextAiError,
  type ProviderAttemptFailure,
} from './errors';
import { callGeminiTextModel } from './geminiText';
import { callGroqTextModel, type TextCompletionMessage } from './groqText';

export interface TextProviderChainDeps {
  fetch: typeof fetch;
  dev?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Test override */
  providerOrder?: 'groq_first';
}

export interface TextProviderChainResult {
  text: string;
  provider: 'groq' | 'gemini';
  model: string;
  aiMs: number;
  fallbackUsed: boolean;
}

function recordFailure(
  failures: ProviderAttemptFailure[],
  provider: string,
  model: string | undefined,
  kind: ProviderAttemptFailure['kind'],
): void {
  failures.push({ provider, model, kind });
}

/**
 * Run Groq → Gemini Flash-Lite → Gemini Flash for JSON text completions.
 * Does not log message content or API keys.
 */
export async function runTextProviderChain(
  messages: TextCompletionMessage[],
  env: AiEnvKeys,
  deps: TextProviderChainDeps,
  scope = 'TextAI',
): Promise<TextProviderChainResult> {
  const dev = deps.dev ?? (typeof __DEV__ !== 'undefined' && __DEV__);
  const failures: ProviderAttemptFailure[] = [];
  const canGroq = hasGroqAiKey(env);
  const canGemini = hasGeminiAiKey(env);
  let fallbackUsed = false;
  let aiMs = 0;

  if (!canGroq && !canGemini) {
    recordFailure(failures, 'gemini', undefined, 'missing_key');
    throw new TextAiError(
      'missing_key',
      finalFailureMessage(failures, { dev, feature: 'chat' }),
    );
  }

  if ((deps.providerOrder ?? TEXT_AI_PROVIDER_ORDER) === 'groq_first' && canGroq) {
    try {
      const result = await callGroqTextModel(deps.fetch, messages, env.groqKey, {
        maxTokens: deps.maxTokens,
        temperature: deps.temperature,
        dev,
      });
      aiMs += result.durationMs;
      aiDevLog(scope, 'provider_ok', {
        provider: 'groq',
        model: result.model,
        phase: 'text',
        aiMs: result.durationMs,
      });
      return {
        text: result.text,
        provider: 'groq',
        model: result.model,
        aiMs,
        fallbackUsed: false,
      };
    } catch (err) {
      if (err instanceof TextAiError) {
        aiDevLog(scope, 'provider_fail', {
          provider: 'groq',
          model: GROQ_TEXT_MODEL,
          kind: err.kind,
        });
        recordFailure(failures, 'groq', GROQ_TEXT_MODEL, err.kind);
      } else {
        recordFailure(failures, 'groq', GROQ_TEXT_MODEL, 'network_error');
      }
      if (!canGemini) {
        throw new TextAiError(
          'all_providers_failed',
          finalFailureMessage(failures, { dev, feature: 'chat' }),
        );
      }
      fallbackUsed = true;
      aiDevLog(scope, 'provider_fallback', { from: 'groq', to: 'gemini' });
    }
  }

  if (!canGemini) {
    throw new TextAiError(
      'all_providers_failed',
      finalFailureMessage(failures, { dev, feature: 'chat' }),
    );
  }

  for (const model of GEMINI_TEXT_MODELS) {
    try {
      const result = await callGeminiTextModel(
        deps.fetch,
        messages,
        env.geminiKey,
        model,
        {
          maxTokens: deps.maxTokens,
          temperature: deps.temperature,
          dev,
        },
      );
      aiMs += result.durationMs;
      aiDevLog(scope, 'provider_ok', {
        provider: 'gemini',
        model: result.model,
        phase: 'text',
        aiMs: result.durationMs,
        fallbackUsed,
      });
      return {
        text: result.text,
        provider: 'gemini',
        model: result.model,
        aiMs,
        fallbackUsed,
      };
    } catch (err) {
      if (err instanceof TextAiError) {
        aiDevLog(scope, 'provider_fail', {
          provider: 'gemini',
          model,
          kind: err.kind,
        });
        if (err.kind === 'network_error' || err.kind === 'timeout') {
          throw err;
        }
        if (isRecoverableProviderFailure(err.kind)) {
          recordFailure(failures, 'gemini', model, err.kind);
          fallbackUsed = true;
          continue;
        }
        throw err;
      }
      throw err;
    }
  }

  throw new TextAiError(
    'all_providers_failed',
    finalFailureMessage(failures, { dev, feature: 'chat' }),
  );
}
