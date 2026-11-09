// ============================================================
// Finance DTOs for screens (opaque string IDs over SQLite integer ids)
// ============================================================

import type {
  BudgetGroup,
  ExpenseAudience,
  SourceSpendingGroup,
  TransactionStatus,
  TransactionType,
} from '../types';

/** Opaque entity id — SQLite integer as string */
export type EntityId = string;

export interface FinanceTransaction {
  id: EntityId;
  amount: number;
  type: TransactionType;
  category_id: EntityId | null;
  source_id: EntityId | null;
  payer: string;
  expense_audience: ExpenseAudience;
  image_uri: string | null;
  location: string | null;
  note: string | null;
  status: TransactionStatus;
  /**
   * Business/calendar date — YYYY-MM-DD local.
   * Cloud: transactions.transaction_date
   * Native: derived from created_at TEXT (Android schema unchanged)
   */
  transaction_date: string;
  /** Local-datetime TEXT (native calendar carrier) */
  created_at: string;
  category_name?: string | null;
  category_icon?: string | null;
  category_color?: string | null;
  source_name?: string | null;
}

export interface FinanceTransactionInput {
  amount: string;
  type: TransactionType;
  category_id: EntityId | null;
  source_id: EntityId | null;
  payer?: string;
  expense_audience: ExpenseAudience;
  image_uri: string | null;
  location: string;
  note: string;
  transaction_date: string;
}

export interface FinanceCategory {
  id: EntityId;
  name: string;
  type: TransactionType | 'both';
  icon: string;
  color: string;
  budget_group: BudgetGroup | null;
}

export interface FinanceSource {
  id: EntityId;
  name: string;
  /** 1 = active (form create), 0 = archived */
  is_active: number;
  spending_group: SourceSpendingGroup | null;
}

export interface FinanceSourceWithRefs extends FinanceSource {
  reference_count: number;
}

export type DeleteResult = { ok: true } | { ok: false; reason: string };
