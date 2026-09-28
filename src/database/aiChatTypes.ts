// ============================================================
// P1.8A — AI spending chat types (DB + context, no transaction snapshots)
// ============================================================

import type { ExpenseAudience } from '../types';

export type AiChatRole = 'user' | 'assistant';

export interface AiChatThread {
  id: number;
  title: string | null;
  anchor_year: number;
  anchor_month: number;
  context_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiChatMessage {
  id: number;
  thread_id: number;
  role: AiChatRole;
  content: string;
  created_at: string;
}

export interface AiSavedPrompt {
  id: number;
  title: string;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** References/state only — never raw transaction rows or secrets. */
export interface AiChatContextState {
  activeFilters?: {
    sourceId?: number | 'all' | null;
    audience?: ExpenseAudience | 'all';
    search?: string;
    categoryNames?: string[];
  };
  lastReferencedTransactionIds?: number[];
  excludedTransactionIds?: number[];
  lastBreakdownDimension?: 'category' | 'source' | 'audience';
  comparisonMonth?: { year: number; month: number };
  lastReferencedCategory?: string;
  lastReferencedSource?: string;
  lastReferencedAudience?: ExpenseAudience;
  lastEvidenceTransactionIds?: number[];
  lastFollowUps?: string[];
}

export interface AssistantMessagePayload {
  answer: string;
  evidenceTransactionIds: number[];
  followUps: string[];
}

const ASSISTANT_ENVELOPE_V = 1;

/** Encode structured assistant metadata into message.content without schema drift. */
export function encodeAssistantContent(payload: AssistantMessagePayload): string {
  return JSON.stringify({
    v: ASSISTANT_ENVELOPE_V,
    answer: payload.answer,
    evidenceTransactionIds: payload.evidenceTransactionIds,
    followUps: payload.followUps,
  });
}

export function decodeAssistantContent(content: string): AssistantMessagePayload {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) {
    return { answer: content, evidenceTransactionIds: [], followUps: [] };
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed.v !== ASSISTANT_ENVELOPE_V || typeof parsed.answer !== 'string') {
      return { answer: content, evidenceTransactionIds: [], followUps: [] };
    }
    const evidence = Array.isArray(parsed.evidenceTransactionIds)
      ? parsed.evidenceTransactionIds.filter(
          (id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0,
        )
      : [];
    const followUps = Array.isArray(parsed.followUps)
      ? parsed.followUps
          .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
          .slice(0, 3)
      : [];
    return {
      answer: parsed.answer,
      evidenceTransactionIds: evidence,
      followUps,
    };
  } catch {
    return { answer: content, evidenceTransactionIds: [], followUps: [] };
  }
}

export function parseAiChatContextJson(raw: string | null | undefined): AiChatContextState {
  if (raw == null || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return sanitizeAiChatContext(parsed as Record<string, unknown>);
  } catch {
    return {};
  }
}

export function serializeAiChatContextJson(ctx: AiChatContextState): string {
  return JSON.stringify(sanitizeAiChatContext(ctx as unknown as Record<string, unknown>));
}

function sanitizePositiveIntIds(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = value.filter(
    (id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0,
  );
  return ids.length > 0 ? [...new Set(ids)] : undefined;
}

function sanitizeAiChatContext(raw: Record<string, unknown>): AiChatContextState {
  const out: AiChatContextState = {};

  if (raw.activeFilters && typeof raw.activeFilters === 'object' && !Array.isArray(raw.activeFilters)) {
    const f = raw.activeFilters as Record<string, unknown>;
    const activeFilters: AiChatContextState['activeFilters'] = {};
    if (f.sourceId === 'all' || f.sourceId === null) activeFilters.sourceId = f.sourceId;
    else if (typeof f.sourceId === 'number' && Number.isInteger(f.sourceId)) {
      activeFilters.sourceId = f.sourceId;
    }
    if (typeof f.audience === 'string') {
      activeFilters.audience = f.audience as ExpenseAudience | 'all';
    }
    if (typeof f.search === 'string') activeFilters.search = f.search;
    if (Array.isArray(f.categoryNames)) {
      activeFilters.categoryNames = f.categoryNames.filter(
        (n): n is string => typeof n === 'string' && n.trim().length > 0,
      );
    }
    if (Object.keys(activeFilters).length > 0) out.activeFilters = activeFilters;
  }

  const lastReferenced = sanitizePositiveIntIds(raw.lastReferencedTransactionIds);
  if (lastReferenced) out.lastReferencedTransactionIds = lastReferenced;

  const excluded = sanitizePositiveIntIds(raw.excludedTransactionIds);
  if (excluded) out.excludedTransactionIds = excluded;

  if (
    raw.lastBreakdownDimension === 'category' ||
    raw.lastBreakdownDimension === 'source' ||
    raw.lastBreakdownDimension === 'audience'
  ) {
    out.lastBreakdownDimension = raw.lastBreakdownDimension;
  }

  if (
    raw.comparisonMonth &&
    typeof raw.comparisonMonth === 'object' &&
    !Array.isArray(raw.comparisonMonth)
  ) {
    const cm = raw.comparisonMonth as Record<string, unknown>;
    if (
      typeof cm.year === 'number' &&
      Number.isInteger(cm.year) &&
      typeof cm.month === 'number' &&
      Number.isInteger(cm.month) &&
      cm.month >= 1 &&
      cm.month <= 12
    ) {
      out.comparisonMonth = { year: cm.year, month: cm.month };
    }
  }

  if (typeof raw.lastReferencedCategory === 'string') {
    out.lastReferencedCategory = raw.lastReferencedCategory;
  }
  if (typeof raw.lastReferencedSource === 'string') {
    out.lastReferencedSource = raw.lastReferencedSource;
  }
  if (typeof raw.lastReferencedAudience === 'string') {
    out.lastReferencedAudience = raw.lastReferencedAudience as ExpenseAudience;
  }

  const evidence = sanitizePositiveIntIds(raw.lastEvidenceTransactionIds);
  if (evidence) out.lastEvidenceTransactionIds = evidence;

  if (Array.isArray(raw.lastFollowUps)) {
    const followUps = raw.lastFollowUps
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .slice(0, 3);
    if (followUps.length > 0) out.lastFollowUps = followUps;
  }

  return out;
}

export function deriveThreadTitleFromQuestion(question: string, maxLen = 48): string {
  const cleaned = question.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Chat chi tiêu';
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1).trimEnd()}…`;
}

/** Schema contract for cascade tests (no live SQLite in unit runner). */
export const AI_CHAT_MESSAGES_FK_SQL =
  'FOREIGN KEY (thread_id) REFERENCES ai_chat_threads(id) ON DELETE CASCADE';

