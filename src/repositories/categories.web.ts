// ============================================================
// P2.2 — Web CategoryRepository (Supabase + RLS)
// ============================================================

import { logDataErrorDev, normalizeDataError } from './errors';
import { mapCloudCategory, type CloudCategoryRow } from './mappers';
import { requireSupabaseClient } from './requireClient.web';
import type { DeleteResult, EntityId, FinanceCategory } from './types';

export async function listCategories(): Promise<FinanceCategory[]> {
  const client = requireSupabaseClient();
  try {
    const { data, error } = await client
      .from('categories')
      .select('id, name, type, icon, color, budget_group')
      .order('type')
      .order('name');
    if (error) throw error;
    return (data ?? []).map((row) => mapCloudCategory(row as CloudCategoryRow));
  } catch (err) {
    logDataErrorDev('list', 'categories', err);
    throw normalizeDataError(err, 'categories');
  }
}

export async function listExpenseCategoriesByUsage(): Promise<FinanceCategory[]> {
  // P2.2: alphabetical expense categories (usage-order needs aggregation RPC — deferred)
  const client = requireSupabaseClient();
  try {
    const { data, error } = await client
      .from('categories')
      .select('id, name, type, icon, color, budget_group')
      .in('type', ['chi', 'both'])
      .order('name');
    if (error) throw error;
    return (data ?? []).map((row) => mapCloudCategory(row as CloudCategoryRow));
  } catch (err) {
    logDataErrorDev('listByUsage', 'categories', err);
    throw normalizeDataError(err, 'categories');
  }
}

export async function insertCategory(
  name: string,
  type: 'chi' | 'thu' | 'both',
  icon: string,
  color: string,
): Promise<EntityId> {
  const client = requireSupabaseClient();
  const trimmed = name.trim();
  if (!trimmed) throw normalizeDataError({ code: '23514' }, 'categories');
  try {
    const { data, error } = await client
      .from('categories')
      .insert({ name: trimmed, type, icon, color, budget_group: null })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  } catch (err) {
    logDataErrorDev('insert', 'categories', err);
    throw normalizeDataError(err, 'categories');
  }
}

export async function updateCategory(
  id: EntityId,
  name: string,
  type: 'chi' | 'thu' | 'both',
  icon: string,
  color: string,
): Promise<void> {
  const client = requireSupabaseClient();
  const trimmed = name.trim();
  if (!trimmed) throw normalizeDataError({ code: '23514' }, 'categories');
  try {
    const { error } = await client
      .from('categories')
      .update({ name: trimmed, type, icon, color })
      .eq('id', id);
    if (error) throw error;
  } catch (err) {
    logDataErrorDev('update', 'categories', err);
    throw normalizeDataError(err, 'categories');
  }
}

export async function deleteCategory(id: EntityId): Promise<DeleteResult> {
  const client = requireSupabaseClient();
  try {
    // Match native: unlink transactions first, then delete
    const { error: unlinkErr } = await client
      .from('transactions')
      .update({ category_id: null })
      .eq('category_id', id);
    if (unlinkErr) throw unlinkErr;

    const { error } = await client.from('categories').delete().eq('id', id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    logDataErrorDev('delete', 'categories', err);
    const normalized = normalizeDataError(err, 'categories');
    if (normalized.code === 'referenced') {
      return { ok: false, reason: normalized.message };
    }
    throw normalized;
  }
}
