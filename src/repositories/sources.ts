// ============================================================
// P2.2 — Native SourceRepository (wraps SQLite DAO)
// ============================================================

import {
  deleteSource as deleteNative,
  getAllSources as getAllNative,
  getSourcesWithReferenceCounts as getWithRefsNative,
  insertSource as insertNative,
  setSourceActive as setActiveNative,
  updateSource as updateNative,
} from '../database/categories';
import type { SourceSpendingGroup } from '../types';
import { mapNativeSource, requireNativeId } from './mappers';
import type { DeleteResult, EntityId, FinanceSource, FinanceSourceWithRefs } from './types';

export async function listSources(): Promise<FinanceSource[]> {
  const rows = await getAllNative();
  return rows.map((row) => mapNativeSource(row) as FinanceSource);
}

export async function listSourcesWithReferenceCounts(): Promise<FinanceSourceWithRefs[]> {
  const rows = await getWithRefsNative();
  return rows.map((row) => mapNativeSource(row) as FinanceSourceWithRefs);
}

export async function insertSource(name: string, spendingGroup: SourceSpendingGroup): Promise<EntityId> {
  const id = await insertNative(name, spendingGroup);
  return String(id);
}

export async function updateSource(
  id: EntityId,
  name: string,
  spendingGroup: SourceSpendingGroup | null,
): Promise<void> {
  await updateNative(requireNativeId(id), name, spendingGroup);
}

export async function setSourceActive(id: EntityId, active: boolean): Promise<void> {
  await setActiveNative(requireNativeId(id), active);
}

export async function deleteSource(id: EntityId): Promise<DeleteResult> {
  return deleteNative(requireNativeId(id));
}
