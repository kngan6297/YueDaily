// ============================================================
// P1.8A — Spending chat orchestrator (planner → tools → answer)
// ============================================================

import { loadAiEnvFromProcess } from '../ai/env';
import { TextAiError } from '../ai/errors';
import { runTextProviderChain } from '../ai/runTextProviderChain';
import type { TextCompletionMessage } from '../ai/groqText';
import type { AiChatContextState } from '../../database/aiChatTypes';
import { buildPresetToolPlan, findPresetByBody, findPresetById } from './presets';
import {
  MAX_TOOL_CALLS_PER_TURN,
  validateToolCalls,
  type ToolCallRequest,
} from './tools/allowlist';
import type { ToolResult } from './tools/types';
import { spendingChatDevLog } from './telemetry';

export type { ToolResult } from './tools/types';

export interface SpendingChatTurnInput {
  question: string;
  year: number;
  month: number;
  context: AiChatContextState;
  /** Recent messages for model context (already limited by caller). */
  recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  presetId?: string;
  fetchFn?: typeof fetch;
  /** Test injection — skip live AI */
  runText?: typeof runTextProviderChain;
  /** Test injection — skip live SQLite tools */
  executeTools?: (calls: ToolCallRequest[]) => Promise<ToolResult[]>;
}

export interface SpendingChatTurnResult {
  kind: 'answer' | 'clarify' | 'readonly_blocked' | 'error';
  answer: string;
  evidenceTransactionIds: number[];
  followUps: string[];
  clarificationQuestion?: string;
  context: AiChatContextState;
  toolNames: string[];
  skippedPlanner: boolean;
  errorCategory?: 'ai' | 'data';
}

const WRITE_INTENT_RE =
  /(đổi|sửa|xóa|xoá|thêm|ghi|cập nhật|chuyển sang|đổi sang|delete|update|insert|modify)\b/i;

const MUTATION_EXAMPLES_RE =
  /(đổi khoản|xóa khoản|xoá khoản|sửa giao dịch|chuyển .* sang)/i;

function isLikelyWriteRequest(question: string): boolean {
  return WRITE_INTENT_RE.test(question) && MUTATION_EXAMPLES_RE.test(question);
}

function collectEvidenceIds(results: ToolResult[]): Set<number> {
  const ids = new Set<number>();
  for (const r of results) {
    if (!r.ok || r.data == null || typeof r.data !== 'object') continue;
    const data = r.data as Record<string, unknown>;
    const txs = data.transactions;
    if (Array.isArray(txs)) {
      for (const t of txs) {
        if (t && typeof t === 'object' && typeof (t as { id?: unknown }).id === 'number') {
          ids.add((t as { id: number }).id);
        }
      }
    }
    const largest = data.largestVsAverage;
    if (Array.isArray(largest)) {
      for (const t of largest) {
        if (t && typeof t === 'object' && typeof (t as { id?: unknown }).id === 'number') {
          ids.add((t as { id: number }).id);
        }
      }
    }
  }
  return ids;
}

function filterEvidenceIds(candidate: unknown, allowed: Set<number>): number[] {
  if (!Array.isArray(candidate)) return [];
  return candidate.filter(
    (id): id is number =>
      typeof id === 'number' && Number.isInteger(id) && allowed.has(id),
  );
}

function mergeContextFromTools(
  prev: AiChatContextState,
  results: ToolResult[],
  year: number,
  month: number,
): AiChatContextState {
  const next: AiChatContextState = { ...prev };
  const evidence = [...collectEvidenceIds(results)];
  if (evidence.length > 0) {
    next.lastReferencedTransactionIds = evidence;
    next.lastEvidenceTransactionIds = evidence;
  }
  for (const r of results) {
    if (!r.ok || r.data == null || typeof r.data !== 'object') continue;
    const data = r.data as Record<string, unknown>;
    if (r.tool === 'getBreakdown' && typeof data.dimension === 'string') {
      if (
        data.dimension === 'category' ||
        data.dimension === 'source' ||
        data.dimension === 'audience'
      ) {
        next.lastBreakdownDimension = data.dimension;
      }
    }
    if (r.tool === 'comparePeriods') {
      const comparison = data.comparison as { year?: number; month?: number } | undefined;
      if (
        comparison &&
        typeof comparison.year === 'number' &&
        typeof comparison.month === 'number'
      ) {
        next.comparisonMonth = { year: comparison.year, month: comparison.month };
      }
    }
  }
  // Keep anchor month implicit via thread; comparisonMonth only when compare ran.
  void year;
  void month;
  return next;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

function buildPlannerMessages(
  input: SpendingChatTurnInput,
): TextCompletionMessage[] {
  const system = `You are a planner for YueDaily spending chat. Return ONLY JSON:
{"action":"tools"|"clarify","toolCalls":[{"name":"...","args":{...}}],"clarificationQuestion":"..."?}
Allowed tools: getPeriodSummary, getBreakdown, getTransactions, getLargestTransactions, comparePeriods, getWooriBudget, getTrackedSourceBalance, getUnusualSpendingFacts.
Max ${MAX_TOOL_CALLS_PER_TURN} tool calls. No SQL. No writes.
Calendar month = day 01→last day. Woori budget_cycle = payday 05→04. Do NOT confuse audience (Yue/Kai) with source (VPBank/Woori).
If "tiền của mình" / "riêng mình" is ambiguous between audience=Yue vs personal source funds, action=clarify.`;

  const contextBlob = JSON.stringify({
    year: input.year,
    month: input.month,
    context: input.context,
  });

  return [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `Anchor month: ${input.month}/${input.year}\nContext: ${contextBlob}\nQuestion: ${input.question}`,
    },
  ];
}

function buildAnswerMessages(
  input: SpendingChatTurnInput,
  toolResults: ToolResult[],
): TextCompletionMessage[] {
  const system = `You are YueDaily's read-only spending analyst. Explain tool results in concise Vietnamese.
Never invent totals — only use tool result numbers. Never claim formal anomaly detection.
Return ONLY JSON: {"answer":"string","evidenceTransactionIds":number[],"followUps":string[]}
followUps max 3. evidenceTransactionIds only from tool-returned transaction ids.
If tools say needsOpeningBalance, say clearly opening balance is missing — do not invent 0.
Woori budget_cycle remaining ≠ calendar-month Woori spend.`;

  const recent = (input.recentMessages ?? []).slice(-10).map((m) => ({
    role: m.role,
    content: m.content.slice(0, 500),
  }));

  const messages: TextCompletionMessage[] = [
    { role: 'system', content: system },
    ...recent.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    {
      role: 'user',
      content: JSON.stringify({
        question: input.question,
        year: input.year,
        month: input.month,
        toolResults: toolResults.map((r) => ({
          tool: r.tool,
          ok: r.ok,
          data: r.data,
          error: r.error,
        })),
      }),
    },
  ];
  return messages;
}

function applyFollowUpContextHints(
  question: string,
  context: AiChatContextState,
  year: number,
  month: number,
): { filtersExtra: Record<string, unknown>; toolHint?: ToolCallRequest[] } {
  const q = question.toLowerCase();
  const filtersExtra: Record<string, unknown> = {
    ...(context.activeFilters ?? {}),
  };
  if (context.excludedTransactionIds?.length) {
    filtersExtra.excludedTransactionIds = context.excludedTransactionIds;
  }

  // "bỏ khoản ... ra" — keep exclusions already in context
  if (
    (q.includes('bỏ khoản') || q.includes('loại khoản') || q.includes('trừ khoản')) &&
    context.lastReferencedTransactionIds?.length
  ) {
    const exclude = [
      ...(context.excludedTransactionIds ?? []),
      ...context.lastReferencedTransactionIds,
    ];
    filtersExtra.excludedTransactionIds = [...new Set(exclude)];
    return {
      filtersExtra,
      toolHint: [
        {
          name: 'getPeriodSummary',
          args: { year, month, filters: filtersExtra },
        },
        {
          name: 'getBreakdown',
          args: {
            year,
            month,
            dimension: context.lastBreakdownDimension ?? 'category',
            filters: filtersExtra,
          },
        },
      ],
    };
  }

  if (q.includes('riêng mình') || q.includes('riêng yue') || q.includes('chi cho riêng')) {
    filtersExtra.audience = 'wife';
  }

  if (q.includes('mấy khoản đó') || q.includes('các khoản đó')) {
    if (context.lastReferencedTransactionIds?.length) {
      return {
        filtersExtra,
        toolHint: [
          {
            name: 'getTransactions',
            args: {
              year,
              month,
              transactionIds: context.lastReferencedTransactionIds,
              filters: filtersExtra,
            },
          },
        ],
      };
    }
  }

  if (q.includes('so với tháng trước')) {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return {
      filtersExtra,
      toolHint: [
        {
          name: 'comparePeriods',
          args: {
            primaryYear: year,
            primaryMonth: month,
            comparisonYear: prevYear,
            comparisonMonth: prevMonth,
            filters: filtersExtra,
          },
        },
      ],
    };
  }

  if (q.includes('woori') && (q.includes('kỳ') || q.includes('còn'))) {
    return {
      filtersExtra,
      toolHint: [{ name: 'getWooriBudget', args: { mode: 'budget_cycle', year, month } }],
    };
  }

  return { filtersExtra };
}

/**
 * Run one spending-chat turn. Presets skip planner. Never writes transactions.
 */
export async function runSpendingChatTurn(
  input: SpendingChatTurnInput,
): Promise<SpendingChatTurnResult> {
  const started = Date.now();
  const runText = input.runText ?? runTextProviderChain;
  const fetchFn = input.fetchFn ?? globalThis.fetch;
  const env = loadAiEnvFromProcess();

  if (isLikelyWriteRequest(input.question)) {
    return {
      kind: 'readonly_blocked',
      answer:
        'AI Chat P1.8A chỉ đọc dữ liệu — không sửa/xóa/đổi giao dịch. Bạn có thể mở chi tiết giao dịch trong app để chỉnh tay.',
      evidenceTransactionIds: [],
      followUps: ['Tóm tắt tháng này', 'Top giao dịch lớn nhất'],
      context: input.context,
      toolNames: [],
      skippedPlanner: true,
    };
  }

  let skippedPlanner = false;
  let toolCalls: ToolCallRequest[] = [];
  let clarificationQuestion: string | undefined;

  const preset =
    (input.presetId ? findPresetById(input.presetId) : undefined) ??
    findPresetByBody(input.question);

  if (preset) {
    skippedPlanner = true;
    const plan = buildPresetToolPlan(preset.id, input.year, input.month);
    if (!plan) {
      return {
        kind: 'error',
        answer: 'Preset chưa có tool plan.',
        evidenceTransactionIds: [],
        followUps: [],
        context: input.context,
        toolNames: [],
        skippedPlanner: true,
        errorCategory: 'data',
      };
    }
    toolCalls = plan;
  } else {
    const hints = applyFollowUpContextHints(
      input.question,
      input.context,
      input.year,
      input.month,
    );
    if (hints.toolHint) {
      skippedPlanner = true;
      toolCalls = hints.toolHint;
    } else {
      try {
        const plannerStarted = Date.now();
        const plannerResult = await runText(buildPlannerMessages(input), env, {
          fetch: fetchFn,
          maxTokens: 512,
          temperature: 0.1,
        }, 'SpendingChat');
        spendingChatDevLog('planner', {
          provider: plannerResult.provider,
          model: plannerResult.model,
          aiMs: plannerResult.aiMs,
          fallback: plannerResult.fallbackUsed,
          phase: 'planner',
        });
        const parsed = parseJsonObject(plannerResult.text);
        if (!parsed) {
          throw new TextAiError('invalid_response', 'Planner JSON invalid');
        }
        if (parsed.action === 'clarify') {
          const q =
            typeof parsed.clarificationQuestion === 'string'
              ? parsed.clarificationQuestion
              : 'Bạn muốn lọc theo người hưởng (Yue/Kai) hay theo nguồn tiền (VPBank/Woori)?';
          spendingChatDevLog('clarify', {
            totalMs: Date.now() - started,
            plannerMs: Date.now() - plannerStarted,
          });
          return {
            kind: 'clarify',
            answer: q,
            clarificationQuestion: q,
            evidenceTransactionIds: [],
            followUps: ['Chi cho riêng Yue', 'VPBank tháng này'],
            context: input.context,
            toolNames: [],
            skippedPlanner: false,
          };
        }
        const validated = validateToolCalls(parsed.toolCalls ?? []);
        if (!validated.ok) {
          throw new TextAiError('invalid_response', validated.error);
        }
        toolCalls = validated.calls;
      } catch (err) {
        const message =
          err instanceof TextAiError
            ? err.message
            : 'Chưa thể trả lời bằng AI lúc này. Thử lại nhé.';
        spendingChatDevLog('planner_fail', {
          kind: err instanceof TextAiError ? err.kind : 'unknown',
          totalMs: Date.now() - started,
        });
        return {
          kind: 'error',
          answer: message,
          evidenceTransactionIds: [],
          followUps: [],
          context: input.context,
          toolNames: [],
          skippedPlanner: false,
          errorCategory: 'ai',
        };
      }
    }
  }

  let toolResults: ToolResult[];
  try {
    const exec =
      input.executeTools ??
      (await import('./tools/index')).executeToolCalls;
    toolResults = await exec(toolCalls);
  } catch {
    return {
      kind: 'error',
      answer: 'Không đọc được dữ liệu chi tiêu lúc này. Thử lại nhé.',
      evidenceTransactionIds: [],
      followUps: [],
      context: input.context,
      toolNames: toolCalls.map((c) => c.name),
      skippedPlanner,
      errorCategory: 'data',
    };
  }

  const toolNames = toolResults.map((r) => r.tool);
  const dataFailed = toolResults.length > 0 && toolResults.every((r) => !r.ok);
  if (dataFailed) {
    return {
      kind: 'error',
      answer: 'Không đọc được dữ liệu chi tiêu lúc này. Thử lại nhé.',
      evidenceTransactionIds: [],
      followUps: [],
      context: input.context,
      toolNames,
      skippedPlanner,
      errorCategory: 'data',
    };
  }

  const allowedEvidence = collectEvidenceIds(toolResults);
  let nextContext = mergeContextFromTools(
    input.context,
    toolResults,
    input.year,
    input.month,
  );

  // Persist exclusions if follow-up asked to exclude last refs
  const qLower = input.question.toLowerCase();
  if (
    (qLower.includes('bỏ khoản') || qLower.includes('loại khoản')) &&
    input.context.lastReferencedTransactionIds?.length
  ) {
    nextContext = {
      ...nextContext,
      excludedTransactionIds: [
        ...new Set([
          ...(input.context.excludedTransactionIds ?? []),
          ...input.context.lastReferencedTransactionIds,
        ]),
      ],
    };
  }

  try {
    const answerResult = await runText(
      buildAnswerMessages(input, toolResults),
      env,
      { fetch: fetchFn, maxTokens: 1024, temperature: 0.2 },
      'SpendingChat',
    );
    spendingChatDevLog('answer', {
      provider: answerResult.provider,
      model: answerResult.model,
      aiMs: answerResult.aiMs,
      fallback: answerResult.fallbackUsed,
      phase: 'answer',
      toolCount: toolNames.length,
      toolNames,
      totalMs: Date.now() - started,
      skippedPlanner,
    });

    const parsed = parseJsonObject(answerResult.text);
    const answer =
      typeof parsed?.answer === 'string' && parsed.answer.trim()
        ? parsed.answer.trim()
        : answerResult.text.trim();
    const evidenceTransactionIds = filterEvidenceIds(
      parsed?.evidenceTransactionIds,
      allowedEvidence,
    );
    const followUps = Array.isArray(parsed?.followUps)
      ? parsed.followUps
          .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
          .slice(0, 3)
      : [];

    nextContext = {
      ...nextContext,
      lastEvidenceTransactionIds: evidenceTransactionIds,
      lastFollowUps: followUps,
    };

    return {
      kind: 'answer',
      answer,
      evidenceTransactionIds,
      followUps,
      context: nextContext,
      toolNames,
      skippedPlanner,
    };
  } catch (err) {
    spendingChatDevLog('answer_fail', {
      kind: err instanceof TextAiError ? err.kind : 'unknown',
      toolCount: toolNames.length,
      toolNames,
      totalMs: Date.now() - started,
    });
    return {
      kind: 'error',
      answer:
        err instanceof TextAiError
          ? err.message
          : 'Chưa thể trả lời bằng AI lúc này. Thử lại nhé.',
      evidenceTransactionIds: [],
      followUps: [],
      context: nextContext,
      toolNames,
      skippedPlanner,
      errorCategory: 'ai',
    };
  }
}

/** Test helpers */
export const spendingChatOrchestratorTestUtils = {
  isLikelyWriteRequest,
  filterEvidenceIds,
  collectEvidenceIds,
  validateToolCalls,
  MAX_TOOL_CALLS_PER_TURN,
};
