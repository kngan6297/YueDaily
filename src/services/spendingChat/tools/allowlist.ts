// ============================================================
// P1.8A — Tool allowlist + arg schemas
// ============================================================

import type { ExpenseAudience } from '../../../types';

export const SPENDING_CHAT_TOOL_NAMES = [
  'getPeriodSummary',
  'getBreakdown',
  'getTransactions',
  'getLargestTransactions',
  'comparePeriods',
  'getWooriBudget',
  'getTrackedSourceBalance',
  'getUnusualSpendingFacts',
] as const;

export type SpendingChatToolName = (typeof SPENDING_CHAT_TOOL_NAMES)[number];

export const MAX_TOOL_CALLS_PER_TURN = 4;

export interface SpendingChatFilters {
  sourceId?: number | 'all' | null;
  audience?: ExpenseAudience | 'all';
  search?: string;
  categoryNames?: string[];
  excludedTransactionIds?: number[];
  transactionIds?: number[];
}

export interface ToolCallRequest {
  name: SpendingChatToolName;
  args: Record<string, unknown>;
}

export function isAllowedToolName(name: unknown): name is SpendingChatToolName {
  return (
    typeof name === 'string' &&
    (SPENDING_CHAT_TOOL_NAMES as readonly string[]).includes(name)
  );
}

export function validateToolCalls(
  raw: unknown,
): { ok: true; calls: ToolCallRequest[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'toolCalls must be an array' };
  }
  if (raw.length > MAX_TOOL_CALLS_PER_TURN) {
    return {
      ok: false,
      error: `max ${MAX_TOOL_CALLS_PER_TURN} tool calls per turn`,
    };
  }
  const calls: ToolCallRequest[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (item == null || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: `toolCalls[${i}] invalid` };
    }
    const rec = item as Record<string, unknown>;
    if (!isAllowedToolName(rec.name)) {
      return { ok: false, error: `toolCalls[${i}].name not allowed` };
    }
    if (rec.args != null && (typeof rec.args !== 'object' || Array.isArray(rec.args))) {
      return { ok: false, error: `toolCalls[${i}].args invalid` };
    }
    calls.push({
      name: rec.name,
      args: (rec.args as Record<string, unknown>) ?? {},
    });
  }
  return { ok: true, calls };
}

export function parseYearMonth(args: Record<string, unknown>): {
  year: number;
  month: number;
} | null {
  const year = args.year;
  const month = args.month;
  if (
    typeof year !== 'number' ||
    !Number.isInteger(year) ||
    typeof month !== 'number' ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }
  return { year, month };
}

export function parseFilters(raw: unknown): SpendingChatFilters {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const f = raw as Record<string, unknown>;
  const out: SpendingChatFilters = {};
  if (f.sourceId === 'all' || f.sourceId === null) out.sourceId = f.sourceId;
  else if (typeof f.sourceId === 'number' && Number.isInteger(f.sourceId)) {
    out.sourceId = f.sourceId;
  }
  if (typeof f.audience === 'string') {
    out.audience = f.audience as ExpenseAudience | 'all';
  }
  if (typeof f.search === 'string') out.search = f.search;
  if (Array.isArray(f.categoryNames)) {
    out.categoryNames = f.categoryNames.filter(
      (n): n is string => typeof n === 'string' && n.trim().length > 0,
    );
  }
  if (Array.isArray(f.excludedTransactionIds)) {
    out.excludedTransactionIds = f.excludedTransactionIds.filter(
      (id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0,
    );
  }
  if (Array.isArray(f.transactionIds)) {
    out.transactionIds = f.transactionIds.filter(
      (id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0,
    );
  }
  return out;
}
