// ============================================================
// P2.2 — Native TransactionRepository (wraps SQLite DAO)
// ============================================================

import {
  deleteTransaction as deleteNative,
  getTransactionById as getNativeById,
  getTransactionsByMonth as getNativeByMonth,
  insertTransaction as insertNative,
  updateTransaction as updateNative,
} from '../database/transactions';
import type { SourceSpendingGroup, TransactionFormData } from '../types';
import { mapNativeTransaction, requireNativeId } from './mappers';
import type { EntityId, FinanceTransaction, FinanceTransactionInput } from './types';

function toNativeForm(data: FinanceTransactionInput): TransactionFormData {
  return {
    amount: data.amount,
    type: data.type,
    category_id: data.category_id != null ? requireNativeId(data.category_id) : null,
    source_id: data.source_id != null ? requireNativeId(data.source_id) : null,
    payer: data.payer,
    expense_audience: data.expense_audience,
    image_uri: data.image_uri,
    location: data.location,
    note: data.note,
    transaction_date: data.transaction_date,
  };
}

export async function getTransactionById(id: EntityId): Promise<FinanceTransaction | null> {
  const row = await getNativeById(requireNativeId(id));
  return row ? mapNativeTransaction(row as Parameters<typeof mapNativeTransaction>[0]) : null;
}

export async function getTransactionsByMonth(
  year: number,
  month: number,
  spendingGroup?: SourceSpendingGroup | null,
): Promise<FinanceTransaction[]> {
  const rows = await getNativeByMonth(year, month, spendingGroup);
  return rows.map((row) => mapNativeTransaction(row as Parameters<typeof mapNativeTransaction>[0]));
}

export async function insertTransaction(data: FinanceTransactionInput): Promise<EntityId> {
  const id = await insertNative(toNativeForm(data));
  return String(id);
}

export async function updateTransaction(id: EntityId, data: FinanceTransactionInput): Promise<void> {
  await updateNative(requireNativeId(id), toNativeForm(data));
}

export async function deleteTransaction(id: EntityId): Promise<void> {
  await deleteNative(requireNativeId(id));
}
