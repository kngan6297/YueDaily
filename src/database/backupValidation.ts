// ============================================================
// Backup payload validation — pure Node-testable (no Expo/SQLite)
// ============================================================

import { validateBudgetPeriodBounds } from './budgetPeriodDomain';
import { validateCalendarMonthPeriodBounds } from './calendarMonthPeriodDomain';
import { HOUSEHOLD_FOOD_BUDGET_KEY } from '../constants/budget';
import {
  normalizeBudgetGroup,
  normalizeExpenseAudience,
  normalizeSourceSpendingGroup,
  type BudgetGroup,
  type BudgetKey,
  type ExpenseAudience,
  type SourceSpendingGroup,
} from '../types';
import { normalizeSourceIsActive } from './sourceLifecycle';

export type BackupVersion = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export const CURRENT_BACKUP_VERSION: BackupVersion = '8';

/** Versions that require category.budget_group */
function hasBudgetGroupField(v: BackupVersion): boolean {
  return v === '4' || v === '5' || v === '6' || v === '7' || v === '8';
}

/** Versions that require carryover + envelope_source_id on budget_periods */
function hasCarryoverEnvelopeFields(v: BackupVersion): boolean {
  return v === '5' || v === '6' || v === '7' || v === '8';
}

/** Versions that require adjustment_amount on budget_periods */
function hasBudgetAdjustmentField(v: BackupVersion): boolean {
  return v === '6' || v === '7' || v === '8';
}

/** Versions that require tracked_source_periods array */
function hasTrackedSourcePeriods(v: BackupVersion): boolean {
  return v === '7' || v === '8';
}

/** Versions that require AI chat tables */
function hasAiChatTables(v: BackupVersion): boolean {
  return v === '8';
}

interface ValidCategory {
  id: number;
  name: string;
  type: string;
  icon: string;
  color: string;
  budget_group: BudgetGroup | null;
}

interface ValidBudgetPeriod {
  id: number;
  budget_key: BudgetKey;
  period_start: string;
  period_end: string;
  limit_amount: number;
  carryover_amount: number;
  adjustment_amount: number;
  envelope_source_id: number | null;
  created_at: string;
  updated_at: string;
}

interface ValidTrackedSourcePeriod {
  id: number;
  source_id: number;
  period_start: string;
  period_end: string;
  opening_balance: number | null;
  adjustment_amount: number;
  created_at: string;
  updated_at: string;
}

interface ValidSource {
  id: number;
  name: string;
  is_active: number;
  spending_group: SourceSpendingGroup | null;
}

interface ValidPayer {
  id: number;
  name: string;
  icon: string;
  color: string;
}

interface ValidTransaction {
  id: number;
  amount: number;
  type: string;
  category_id: number | null;
  source_id: number | null;
  payer: string;
  expense_audience: ExpenseAudience;
  image_uri: string | null;
  location: string | null;
  note: string | null;
  status: string;
  created_at: string;
}

interface ValidStreak {
  id: number;
  current_streak: number;
  last_logged_date: string | null;
}

interface ValidAiChatThread {
  id: number;
  title: string | null;
  anchor_year: number;
  anchor_month: number;
  context_json: string | null;
  created_at: string;
  updated_at: string;
}

interface ValidAiChatMessage {
  id: number;
  thread_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface ValidAiSavedPrompt {
  id: number;
  title: string;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ValidatedBackup {
  backupVersion: BackupVersion;
  transactions: ValidTransaction[];
  categories: ValidCategory[];
  sources: ValidSource[];
  payers: ValidPayer[] | null;
  budget_periods: ValidBudgetPeriod[];
  tracked_source_periods: ValidTrackedSourcePeriod[];
  ai_chat_threads: ValidAiChatThread[];
  ai_chat_messages: ValidAiChatMessage[];
  ai_saved_prompts: ValidAiSavedPrompt[];
  streak: ValidStreak | null;
}

const CREATED_AT_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TX_TYPES = new Set(['thu', 'chi']);
const CAT_TYPES = new Set(['thu', 'chi', 'both']);
const TX_STATUSES = new Set(['complete', 'pending']);

function fail(path: string): never {
  throw new Error(`Backup không hợp lệ: ${path}`);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function assertFiniteNumber(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(path);
  return v;
}

function assertIntegerId(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) fail(path);
  return v;
}

function assertString(v: unknown, path: string): string {
  if (typeof v !== 'string') fail(path);
  return v;
}

function assertNullableString(v: unknown, path: string): string | null {
  if (v === null) return null;
  if (typeof v !== 'string') fail(path);
  return v;
}

function assertNullableId(v: unknown, path: string): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) fail(path);
  return v;
}

function assertUniqueIds(ids: number[], collection: string): void {
  const seen = new Set<number>();
  for (let i = 0; i < ids.length; i++) {
    if (seen.has(ids[i])) fail(`${collection}[${i}].id`);
    seen.add(ids[i]);
  }
}

function validateCategory(row: unknown, index: number, backupVersion: BackupVersion): ValidCategory {
  const p = `categories[${index}]`;
  if (!isPlainObject(row)) fail(p);
  const type = assertString(row.type, `${p}.type`);
  if (!CAT_TYPES.has(type)) fail(`${p}.type`);

  let budget_group: BudgetGroup | null = null;
  if (hasBudgetGroupField(backupVersion)) {
    if (!('budget_group' in row)) fail(`${p}.budget_group`);
    if (row.budget_group !== null && row.budget_group !== undefined) {
      budget_group = normalizeBudgetGroup(row.budget_group);
      if (row.budget_group !== budget_group) fail(`${p}.budget_group`);
    }
  } else if (row.budget_group !== undefined && row.budget_group !== null) {
    budget_group = normalizeBudgetGroup(row.budget_group);
    if (row.budget_group !== budget_group) fail(`${p}.budget_group`);
  }

  return {
    id: assertIntegerId(row.id, `${p}.id`),
    name: assertString(row.name, `${p}.name`),
    type,
    icon: assertString(row.icon, `${p}.icon`),
    color: assertString(row.color, `${p}.color`),
    budget_group,
  };
}

function validateBudgetPeriod(
  row: unknown,
  index: number,
  backupVersion: BackupVersion,
): ValidBudgetPeriod {
  const p = `budget_periods[${index}]`;
  if (!isPlainObject(row)) fail(p);

  const budget_key = assertString(row.budget_key, `${p}.budget_key`);
  if (budget_key !== HOUSEHOLD_FOOD_BUDGET_KEY) fail(`${p}.budget_key`);

  const period_start = assertString(row.period_start, `${p}.period_start`);
  const period_end = assertString(row.period_end, `${p}.period_end`);
  if (!DATE_ONLY_RE.test(period_start)) fail(`${p}.period_start`);
  if (!DATE_ONLY_RE.test(period_end)) fail(`${p}.period_end`);

  const limit_amount = assertFiniteNumber(row.limit_amount, `${p}.limit_amount`);
  if (!Number.isInteger(limit_amount) || limit_amount < 0) fail(`${p}.limit_amount`);

  let carryover_amount = 0;
  if (hasCarryoverEnvelopeFields(backupVersion)) {
    if (!('carryover_amount' in row)) fail(`${p}.carryover_amount`);
    carryover_amount = assertFiniteNumber(row.carryover_amount, `${p}.carryover_amount`);
    if (!Number.isInteger(carryover_amount) || carryover_amount < 0) {
      fail(`${p}.carryover_amount`);
    }
  } else if (row.carryover_amount !== undefined && row.carryover_amount !== null) {
    carryover_amount = assertFiniteNumber(row.carryover_amount, `${p}.carryover_amount`);
    if (!Number.isInteger(carryover_amount) || carryover_amount < 0) {
      fail(`${p}.carryover_amount`);
    }
  }

  let adjustment_amount = 0;
  if (hasBudgetAdjustmentField(backupVersion)) {
    if (!('adjustment_amount' in row)) fail(`${p}.adjustment_amount`);
    adjustment_amount = assertFiniteNumber(row.adjustment_amount, `${p}.adjustment_amount`);
    if (!Number.isInteger(adjustment_amount)) fail(`${p}.adjustment_amount`);
  }
  // v1–v5: always default adjustment_amount to 0 (ignore any stray field)

  let envelope_source_id: number | null = null;
  if (hasCarryoverEnvelopeFields(backupVersion)) {
    if (!('envelope_source_id' in row)) fail(`${p}.envelope_source_id`);
    if (row.envelope_source_id !== null && row.envelope_source_id !== undefined) {
      envelope_source_id = assertFiniteNumber(row.envelope_source_id, `${p}.envelope_source_id`);
      if (!Number.isInteger(envelope_source_id) || envelope_source_id <= 0) {
        fail(`${p}.envelope_source_id`);
      }
    }
  } else if (row.envelope_source_id !== undefined && row.envelope_source_id !== null) {
    envelope_source_id = assertFiniteNumber(row.envelope_source_id, `${p}.envelope_source_id`);
    if (!Number.isInteger(envelope_source_id) || envelope_source_id <= 0) {
      fail(`${p}.envelope_source_id`);
    }
  }

  try {
    validateBudgetPeriodBounds(period_start, period_end, limit_amount);
  } catch {
    fail(`${p}.bounds`);
  }

  const created_at =
    row.created_at === undefined || row.created_at === null
      ? '1970-01-01 00:00:00'
      : assertString(row.created_at, `${p}.created_at`);
  const updated_at =
    row.updated_at === undefined || row.updated_at === null
      ? created_at
      : assertString(row.updated_at, `${p}.updated_at`);

  return {
    id: assertIntegerId(row.id, `${p}.id`),
    budget_key: HOUSEHOLD_FOOD_BUDGET_KEY,
    period_start,
    period_end,
    limit_amount,
    carryover_amount,
    adjustment_amount,
    envelope_source_id,
    created_at,
    updated_at,
  };
}

function validateTrackedSourcePeriod(
  row: unknown,
  index: number,
): ValidTrackedSourcePeriod {
  const p = `tracked_source_periods[${index}]`;
  if (!isPlainObject(row)) fail(p);

  const period_start = assertString(row.period_start, `${p}.period_start`);
  const period_end = assertString(row.period_end, `${p}.period_end`);
  if (!DATE_ONLY_RE.test(period_start)) fail(`${p}.period_start`);
  if (!DATE_ONLY_RE.test(period_end)) fail(`${p}.period_end`);

  let opening_balance: number | null = null;
  if (row.opening_balance !== null && row.opening_balance !== undefined) {
    opening_balance = assertFiniteNumber(row.opening_balance, `${p}.opening_balance`);
    if (!Number.isInteger(opening_balance)) fail(`${p}.opening_balance`);
  }

  if (!('adjustment_amount' in row)) fail(`${p}.adjustment_amount`);
  const adjustment_amount = assertFiniteNumber(
    row.adjustment_amount,
    `${p}.adjustment_amount`,
  );
  if (!Number.isInteger(adjustment_amount)) fail(`${p}.adjustment_amount`);

  try {
    validateCalendarMonthPeriodBounds(period_start, period_end);
  } catch {
    fail(`${p}.bounds`);
  }

  const created_at =
    row.created_at === undefined || row.created_at === null
      ? '1970-01-01 00:00:00'
      : assertString(row.created_at, `${p}.created_at`);
  const updated_at =
    row.updated_at === undefined || row.updated_at === null
      ? created_at
      : assertString(row.updated_at, `${p}.updated_at`);

  return {
    id: assertIntegerId(row.id, `${p}.id`),
    source_id: assertIntegerId(row.source_id, `${p}.source_id`),
    period_start,
    period_end,
    opening_balance,
    adjustment_amount,
    created_at,
    updated_at,
  };
}

function validateSource(row: unknown, index: number): ValidSource {
  const p = `sources[${index}]`;
  if (!isPlainObject(row)) fail(p);
  return {
    id: assertIntegerId(row.id, `${p}.id`),
    name: assertString(row.name, `${p}.name`),
    is_active: normalizeSourceIsActive(row.is_active),
    spending_group: normalizeSourceSpendingGroup(row.spending_group),
  };
}

function validatePayer(row: unknown, index: number): ValidPayer {
  const p = `payers[${index}]`;
  if (!isPlainObject(row)) fail(p);
  return {
    id: assertIntegerId(row.id, `${p}.id`),
    name: assertString(row.name, `${p}.name`),
    icon: assertString(row.icon, `${p}.icon`),
    color: assertString(row.color, `${p}.color`),
  };
}

function validateTransaction(row: unknown, index: number): ValidTransaction {
  const p = `transactions[${index}]`;
  if (!isPlainObject(row)) fail(p);

  const amount = assertFiniteNumber(row.amount, `${p}.amount`);
  if (!Number.isInteger(amount) || amount < 0) fail(`${p}.amount`);

  const type = assertString(row.type, `${p}.type`);
  if (!TX_TYPES.has(type)) fail(`${p}.type`);

  const status = assertString(row.status, `${p}.status`);
  if (!TX_STATUSES.has(status)) fail(`${p}.status`);

  const createdAt = assertString(row.created_at, `${p}.created_at`);
  if (!CREATED_AT_RE.test(createdAt)) fail(`${p}.created_at`);

  let expenseAudience: ExpenseAudience = 'unspecified';
  if (row.expense_audience !== undefined && row.expense_audience !== null) {
    const rawAudience = assertString(row.expense_audience, `${p}.expense_audience`);
    expenseAudience = normalizeExpenseAudience(rawAudience);
    if (rawAudience !== expenseAudience) fail(`${p}.expense_audience`);
  }

  return {
    id: assertIntegerId(row.id, `${p}.id`),
    amount,
    type,
    category_id: assertNullableId(row.category_id, `${p}.category_id`),
    source_id: assertNullableId(row.source_id, `${p}.source_id`),
    payer: assertString(row.payer, `${p}.payer`),
    expense_audience: expenseAudience,
    image_uri: assertNullableString(row.image_uri, `${p}.image_uri`),
    location: assertNullableString(row.location, `${p}.location`),
    note: assertNullableString(row.note, `${p}.note`),
    status,
    created_at: createdAt,
  };
}

function validateStreak(row: unknown): ValidStreak {
  if (!isPlainObject(row)) fail('streak');
  const current = assertFiniteNumber(row.current_streak, 'streak.current_streak');
  if (!Number.isInteger(current) || current < 0) fail('streak.current_streak');

  let lastLogged: string | null = null;
  if (row.last_logged_date !== null && row.last_logged_date !== undefined) {
    lastLogged = assertString(row.last_logged_date, 'streak.last_logged_date');
    if (!DATE_ONLY_RE.test(lastLogged)) fail('streak.last_logged_date');
  }

  return {
    id: assertIntegerId(row.id ?? 1, 'streak.id'),
    current_streak: current,
    last_logged_date: lastLogged,
  };
}

function validateAiChatThread(row: unknown, index: number): ValidAiChatThread {
  const p = `ai_chat_threads[${index}]`;
  if (!isPlainObject(row)) fail(p);

  const anchor_year = assertFiniteNumber(row.anchor_year, `${p}.anchor_year`);
  if (!Number.isInteger(anchor_year) || anchor_year < 2000 || anchor_year > 2100) {
    fail(`${p}.anchor_year`);
  }
  const anchor_month = assertFiniteNumber(row.anchor_month, `${p}.anchor_month`);
  if (!Number.isInteger(anchor_month) || anchor_month < 1 || anchor_month > 12) {
    fail(`${p}.anchor_month`);
  }

  const created_at =
    row.created_at === undefined || row.created_at === null
      ? '1970-01-01 00:00:00'
      : assertString(row.created_at, `${p}.created_at`);
  const updated_at =
    row.updated_at === undefined || row.updated_at === null
      ? created_at
      : assertString(row.updated_at, `${p}.updated_at`);

  // context_json: references only — reject huge dumps / obvious secrets
  let context_json: string | null = assertNullableString(row.context_json, `${p}.context_json`);
  if (context_json != null) {
    if (context_json.length > 20_000) fail(`${p}.context_json`);
    const lower = context_json.toLowerCase();
    if (
      lower.includes('api_key') ||
      lower.includes('apikey') ||
      lower.includes('image_uri') ||
      lower.includes('base64')
    ) {
      fail(`${p}.context_json`);
    }
  }

  return {
    id: assertIntegerId(row.id, `${p}.id`),
    title: assertNullableString(row.title, `${p}.title`),
    anchor_year,
    anchor_month,
    context_json,
    created_at,
    updated_at,
  };
}

function validateAiChatMessage(row: unknown, index: number): ValidAiChatMessage {
  const p = `ai_chat_messages[${index}]`;
  if (!isPlainObject(row)) fail(p);
  const role = assertString(row.role, `${p}.role`);
  if (role !== 'user' && role !== 'assistant') fail(`${p}.role`);
  const created_at =
    row.created_at === undefined || row.created_at === null
      ? '1970-01-01 00:00:00'
      : assertString(row.created_at, `${p}.created_at`);
  return {
    id: assertIntegerId(row.id, `${p}.id`),
    thread_id: assertIntegerId(row.thread_id, `${p}.thread_id`),
    role,
    content: assertString(row.content, `${p}.content`),
    created_at,
  };
}

function validateAiSavedPrompt(row: unknown, index: number): ValidAiSavedPrompt {
  const p = `ai_saved_prompts[${index}]`;
  if (!isPlainObject(row)) fail(p);
  const sort_order = assertFiniteNumber(row.sort_order, `${p}.sort_order`);
  if (!Number.isInteger(sort_order)) fail(`${p}.sort_order`);
  const created_at =
    row.created_at === undefined || row.created_at === null
      ? '1970-01-01 00:00:00'
      : assertString(row.created_at, `${p}.created_at`);
  const updated_at =
    row.updated_at === undefined || row.updated_at === null
      ? created_at
      : assertString(row.updated_at, `${p}.updated_at`);
  return {
    id: assertIntegerId(row.id, `${p}.id`),
    title: assertString(row.title, `${p}.title`),
    body: assertString(row.body, `${p}.body`),
    sort_order,
    created_at,
    updated_at,
  };
}

/** Validate toàn bộ backup — throw trước khi chạm database */
export function validateBackupPayload(raw: unknown): ValidatedBackup {
  if (!isPlainObject(raw)) fail('root');

  if (
    raw.backupVersion !== '1' &&
    raw.backupVersion !== '2' &&
    raw.backupVersion !== '3' &&
    raw.backupVersion !== '4' &&
    raw.backupVersion !== '5' &&
    raw.backupVersion !== '6' &&
    raw.backupVersion !== '7' &&
    raw.backupVersion !== '8'
  ) {
    fail('backupVersion');
  }
  const backupVersion = raw.backupVersion;

  if (!Array.isArray(raw.transactions)) fail('transactions');
  if (!Array.isArray(raw.categories)) fail('categories');
  if (!Array.isArray(raw.sources)) fail('sources');

  if (raw.payers !== undefined && raw.payers !== null && !Array.isArray(raw.payers)) {
    fail('payers');
  }

  if (hasBudgetGroupField(backupVersion)) {
    if (!Array.isArray(raw.budget_periods)) fail('budget_periods');
  } else if (raw.budget_periods !== undefined && raw.budget_periods !== null && !Array.isArray(raw.budget_periods)) {
    fail('budget_periods');
  }

  if (hasTrackedSourcePeriods(backupVersion)) {
    if (!Array.isArray(raw.tracked_source_periods)) fail('tracked_source_periods');
  } else if (
    raw.tracked_source_periods !== undefined &&
    raw.tracked_source_periods !== null &&
    !Array.isArray(raw.tracked_source_periods)
  ) {
    fail('tracked_source_periods');
  }

  if (hasAiChatTables(backupVersion)) {
    if (!Array.isArray(raw.ai_chat_threads)) fail('ai_chat_threads');
    if (!Array.isArray(raw.ai_chat_messages)) fail('ai_chat_messages');
    if (!Array.isArray(raw.ai_saved_prompts)) fail('ai_saved_prompts');
  } else {
    if (
      raw.ai_chat_threads !== undefined &&
      raw.ai_chat_threads !== null &&
      !Array.isArray(raw.ai_chat_threads)
    ) {
      fail('ai_chat_threads');
    }
    if (
      raw.ai_chat_messages !== undefined &&
      raw.ai_chat_messages !== null &&
      !Array.isArray(raw.ai_chat_messages)
    ) {
      fail('ai_chat_messages');
    }
    if (
      raw.ai_saved_prompts !== undefined &&
      raw.ai_saved_prompts !== null &&
      !Array.isArray(raw.ai_saved_prompts)
    ) {
      fail('ai_saved_prompts');
    }
  }

  const categories = raw.categories.map((row, i) => validateCategory(row, i, backupVersion));
  const sources = raw.sources.map(validateSource);
  const transactions = raw.transactions.map(validateTransaction);

  assertUniqueIds(categories.map((c) => c.id), 'categories');
  assertUniqueIds(sources.map((s) => s.id), 'sources');
  assertUniqueIds(transactions.map((t) => t.id), 'transactions');

  let budget_periods: ValidBudgetPeriod[] = [];
  if (hasBudgetGroupField(backupVersion)) {
    budget_periods = (raw.budget_periods as unknown[]).map((row, i) =>
      validateBudgetPeriod(row, i, backupVersion),
    );
    assertUniqueIds(budget_periods.map((b) => b.id), 'budget_periods');
    const periodKeys = new Set<string>();
    for (let i = 0; i < budget_periods.length; i++) {
      const key = `${budget_periods[i].budget_key}\0${budget_periods[i].period_start}`;
      if (periodKeys.has(key)) fail(`budget_periods[${i}].duplicate`);
      periodKeys.add(key);
    }
  }

  let tracked_source_periods: ValidTrackedSourcePeriod[] = [];
  if (hasTrackedSourcePeriods(backupVersion)) {
    tracked_source_periods = (raw.tracked_source_periods as unknown[]).map((row, i) =>
      validateTrackedSourcePeriod(row, i),
    );
    assertUniqueIds(tracked_source_periods.map((b) => b.id), 'tracked_source_periods');
    const periodKeys = new Set<string>();
    for (let i = 0; i < tracked_source_periods.length; i++) {
      const key = `${tracked_source_periods[i].source_id}\0${tracked_source_periods[i].period_start}`;
      if (periodKeys.has(key)) fail(`tracked_source_periods[${i}].duplicate`);
      periodKeys.add(key);
    }
  }

  let ai_chat_threads: ValidAiChatThread[] = [];
  let ai_chat_messages: ValidAiChatMessage[] = [];
  let ai_saved_prompts: ValidAiSavedPrompt[] = [];
  if (hasAiChatTables(backupVersion)) {
    ai_chat_threads = (raw.ai_chat_threads as unknown[]).map(validateAiChatThread);
    ai_chat_messages = (raw.ai_chat_messages as unknown[]).map(validateAiChatMessage);
    ai_saved_prompts = (raw.ai_saved_prompts as unknown[]).map(validateAiSavedPrompt);
    assertUniqueIds(ai_chat_threads.map((t) => t.id), 'ai_chat_threads');
    assertUniqueIds(ai_chat_messages.map((m) => m.id), 'ai_chat_messages');
    assertUniqueIds(ai_saved_prompts.map((p) => p.id), 'ai_saved_prompts');
    const threadIds = new Set(ai_chat_threads.map((t) => t.id));
    for (let i = 0; i < ai_chat_messages.length; i++) {
      if (!threadIds.has(ai_chat_messages[i].thread_id)) {
        fail(`ai_chat_messages[${i}].thread_id`);
      }
    }
  }

  let payers: ValidPayer[] | null = null;
  if (Array.isArray(raw.payers) && raw.payers.length > 0) {
    payers = raw.payers.map(validatePayer);
    assertUniqueIds(payers.map((p) => p.id), 'payers');
  }

  let streak: ValidStreak | null = null;
  if (raw.streak != null) {
    streak = validateStreak(raw.streak);
  }

  return {
    backupVersion,
    transactions,
    categories,
    sources,
    payers,
    budget_periods,
    tracked_source_periods,
    ai_chat_threads,
    ai_chat_messages,
    ai_saved_prompts,
    streak,
  };
}
