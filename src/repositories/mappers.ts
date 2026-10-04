// ============================================================
// P2.2 — Map native rows / Supabase rows → Finance* DTOs
// ============================================================

import {
  normalizeBudgetGroup,
  normalizeExpenseAudience,
  normalizeSourceSpendingGroup,
  type TransactionStatus,
  type TransactionType,
} from '../types';
import { normalizeSourceIsActive } from '../database/sourceLifecycle';
import { dateFromCreatedAt } from '../utils/date';
import type {
  EntityId,
  FinanceCategory,
  FinanceSource,
  FinanceSourceWithRefs,
  FinanceTransaction,
} from './types';

export function entityIdFromNative(id: number | string | null | undefined): EntityId | null {
  if (id === null || id === undefined) return null;
  return String(id);
}

export function requireNativeId(id: EntityId): number {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('Invalid native entity id');
  }
  return n;
}

/** YYYY-MM-DD local calendar date — reject UTC-shifted ISO forms. */
export function isLocalYmd(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function requireLocalYmd(value: string): string {
  if (!isLocalYmd(value)) {
    throw new Error('Invalid local transaction_date');
  }
  return value;
}

type NativeTxnRow = {
  id: number;
  amount: number;
  type: TransactionType;
  category_id: number | null;
  source_id: number | null;
  payer: string;
  expense_audience: unknown;
  image_uri: string | null;
  location: string | null;
  note: string | null;
  status: TransactionStatus;
  created_at: string;
  category_name?: string | null;
  category_icon?: string | null;
  category_color?: string | null;
  source_name?: string | null;
};

export function mapNativeTransaction(row: NativeTxnRow): FinanceTransaction {
  return {
    id: String(row.id),
    amount: row.amount,
    type: row.type,
    category_id: entityIdFromNative(row.category_id),
    source_id: entityIdFromNative(row.source_id),
    payer: row.payer,
    expense_audience: normalizeExpenseAudience(row.expense_audience),
    image_uri: row.image_uri,
    location: row.location,
    note: row.note,
    status: row.status,
    // Native schema: created_at TEXT carries the calendar domain (unchanged).
    transaction_date: dateFromCreatedAt(row.created_at),
    created_at: row.created_at,
    category_name: row.category_name ?? null,
    category_icon: row.category_icon ?? null,
    category_color: row.category_color ?? null,
    source_name: row.source_name ?? null,
  };
}

export function mapNativeCategory(row: {
  id: number;
  name: string;
  type: TransactionType | 'both';
  icon: string;
  color: string;
  budget_group?: unknown;
}): FinanceCategory {
  return {
    id: String(row.id),
    name: row.name,
    type: row.type,
    icon: row.icon,
    color: row.color,
    budget_group: normalizeBudgetGroup(row.budget_group),
  };
}

export function mapNativeSource(row: {
  id: number;
  name: string;
  is_active?: unknown;
  spending_group?: unknown;
  reference_count?: number;
}): FinanceSource | FinanceSourceWithRefs {
  const base: FinanceSource = {
    id: String(row.id),
    name: row.name,
    is_active: normalizeSourceIsActive(row.is_active),
    spending_group: normalizeSourceSpendingGroup(row.spending_group),
  };
  if (typeof row.reference_count === 'number') {
    return { ...base, reference_count: row.reference_count };
  }
  return base;
}

/** Supabase / PostgREST transaction row (snake_case) */
export type CloudTransactionRow = {
  id: string;
  amount: number;
  type: string;
  category_id: string | null;
  source_id: string | null;
  payer: string;
  expense_audience: string;
  image_uri: string | null;
  location: string | null;
  note: string | null;
  status: string;
  transaction_date?: string | null;
  created_at: string;
  categories?: { name?: string; icon?: string; color?: string } | null;
  sources?: { name?: string } | null;
};

export function mapCloudTransaction(row: CloudTransactionRow): FinanceTransaction {
  const transactionDate = isLocalYmd(row.transaction_date)
    ? row.transaction_date
    : dateFromCreatedAt(row.created_at);
  return {
    id: row.id,
    amount: row.amount,
    type: (row.type === 'thu' ? 'thu' : 'chi') as TransactionType,
    category_id: row.category_id,
    source_id: row.source_id,
    payer: row.payer,
    expense_audience: normalizeExpenseAudience(row.expense_audience),
    image_uri: row.image_uri,
    location: row.location,
    note: row.note,
    status: (row.status === 'pending' ? 'pending' : 'complete') as TransactionStatus,
    transaction_date: transactionDate,
    created_at: row.created_at,
    category_name: row.categories?.name ?? null,
    category_icon: row.categories?.icon ?? null,
    category_color: row.categories?.color ?? null,
    source_name: row.sources?.name ?? null,
  };
}

export type CloudCategoryRow = {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
  budget_group: string | null;
};

export function mapCloudCategory(row: CloudCategoryRow): FinanceCategory {
  return {
    id: row.id,
    name: row.name,
    type: row.type === 'thu' || row.type === 'both' ? row.type : 'chi',
    icon: row.icon,
    color: row.color,
    budget_group: normalizeBudgetGroup(row.budget_group),
  };
}

export type CloudSourceRow = {
  id: string;
  name: string;
  is_active: boolean;
  spending_group: string | null;
};

export function mapCloudSource(row: CloudSourceRow): FinanceSource {
  return {
    id: row.id,
    name: row.name,
    is_active: row.is_active ? 1 : 0,
    spending_group: normalizeSourceSpendingGroup(row.spending_group),
  };
}

export function parseAmountInteger(amount: string): number {
  const n = parseInt(amount.replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}
