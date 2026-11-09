// ============================================================
// Map native SQLite rows → Finance* DTOs
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
