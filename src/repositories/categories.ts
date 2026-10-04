// ============================================================
// P2.2 — Native CategoryRepository (wraps SQLite DAO)
// ============================================================

import {
  deleteCategory as deleteNative,
  getAllCategories as getAllNative,
  getExpenseCategoriesByUsage as getByUsageNative,
  insertCategory as insertNative,
  updateCategory as updateNative,
} from '../database/categories';
import { mapNativeCategory, requireNativeId } from './mappers';
import type { DeleteResult, EntityId, FinanceCategory } from './types';

export async function listCategories(): Promise<FinanceCategory[]> {
  const rows = await getAllNative();
  return rows.map(mapNativeCategory);
}

export async function listExpenseCategoriesByUsage(): Promise<FinanceCategory[]> {
  const rows = await getByUsageNative();
  return rows.map(mapNativeCategory);
}

export async function insertCategory(
  name: string,
  type: 'chi' | 'thu' | 'both',
  icon: string,
  color: string,
): Promise<EntityId> {
  const id = await insertNative(name, type, icon, color);
  return String(id);
}

export async function updateCategory(
  id: EntityId,
  name: string,
  type: 'chi' | 'thu' | 'both',
  icon: string,
  color: string,
): Promise<void> {
  await updateNative(requireNativeId(id), name, type, icon, color);
}

export async function deleteCategory(id: EntityId): Promise<DeleteResult> {
  return deleteNative(requireNativeId(id));
}
