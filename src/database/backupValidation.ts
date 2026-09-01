// ============================================================
// Backup payload validation — pure Node-testable (no Expo/SQLite)
// ============================================================

import { validateBudgetPeriodBounds } from './budgetPeriodDomain';
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

export type BackupVersion = '1' | '2' | '3' | '4';
export const CURRENT_BACKUP_VERSION: BackupVersion = '4';

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

export interface ValidatedBackup {
  backupVersion: BackupVersion;
  transactions: ValidTransaction[];
  categories: ValidCategory[];
  sources: ValidSource[];
  payers: ValidPayer[] | null;
  budget_periods: ValidBudgetPeriod[];
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
  if (backupVersion === '4') {
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

function validateBudgetPeriod(row: unknown, index: number): ValidBudgetPeriod {
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

/** Validate toàn bộ backup — throw trước khi chạm database */
export function validateBackupPayload(raw: unknown): ValidatedBackup {
  if (!isPlainObject(raw)) fail('root');

  if (
    raw.backupVersion !== '1' &&
    raw.backupVersion !== '2' &&
    raw.backupVersion !== '3' &&
    raw.backupVersion !== '4'
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

  if (backupVersion === '4') {
    if (!Array.isArray(raw.budget_periods)) fail('budget_periods');
  } else if (raw.budget_periods !== undefined && raw.budget_periods !== null && !Array.isArray(raw.budget_periods)) {
    fail('budget_periods');
  }

  const categories = raw.categories.map((row, i) => validateCategory(row, i, backupVersion));
  const sources = raw.sources.map(validateSource);
  const transactions = raw.transactions.map(validateTransaction);

  assertUniqueIds(categories.map((c) => c.id), 'categories');
  assertUniqueIds(sources.map((s) => s.id), 'sources');
  assertUniqueIds(transactions.map((t) => t.id), 'transactions');

  let budget_periods: ValidBudgetPeriod[] = [];
  if (backupVersion === '4') {
    budget_periods = (raw.budget_periods as unknown[]).map(validateBudgetPeriod);
    assertUniqueIds(budget_periods.map((b) => b.id), 'budget_periods');
    const periodKeys = new Set<string>();
    for (let i = 0; i < budget_periods.length; i++) {
      const key = `${budget_periods[i].budget_key}\0${budget_periods[i].period_start}`;
      if (periodKeys.has(key)) fail(`budget_periods[${i}].duplicate`);
      periodKeys.add(key);
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

  return { backupVersion, transactions, categories, sources, payers, budget_periods, streak };
}
