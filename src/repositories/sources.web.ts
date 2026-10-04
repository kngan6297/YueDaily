// ============================================================
// P2.2 — Web SourceRepository (Supabase + RLS)
// ============================================================

import type { SourceSpendingGroup } from '../types';
import { logDataErrorDev, normalizeDataError } from './errors';
import { mapCloudSource, type CloudSourceRow } from './mappers';
import { requireSupabaseClient } from './requireClient.web';
import type { DeleteResult, EntityId, FinanceSource, FinanceSourceWithRefs } from './types';

export async function listSources(): Promise<FinanceSource[]> {
  const client = requireSupabaseClient();
  try {
    const { data, error } = await client
      .from('sources')
      .select('id, name, is_active, spending_group')
      .order('name');
    if (error) throw error;
    return (data ?? []).map((row) => mapCloudSource(row as CloudSourceRow));
  } catch (err) {
    logDataErrorDev('list', 'sources', err);
    throw normalizeDataError(err, 'sources');
  }
}

export async function listSourcesWithReferenceCounts(): Promise<FinanceSourceWithRefs[]> {
  const client = requireSupabaseClient();
  try {
    const { data: sources, error } = await client
      .from('sources')
      .select('id, name, is_active, spending_group')
      .order('name');
    if (error) throw error;

    const { data: txns, error: tErr } = await client
      .from('transactions')
      .select('source_id')
      .not('source_id', 'is', null);
    if (tErr) throw tErr;

    const counts = new Map<string, number>();
    for (const row of txns ?? []) {
      const sid = row.source_id as string;
      counts.set(sid, (counts.get(sid) ?? 0) + 1);
    }

    return (sources ?? []).map((row) => {
      const mapped = mapCloudSource(row as CloudSourceRow);
      return { ...mapped, reference_count: counts.get(mapped.id) ?? 0 };
    });
  } catch (err) {
    logDataErrorDev('listWithRefs', 'sources', err);
    throw normalizeDataError(err, 'sources');
  }
}

export async function insertSource(name: string, spendingGroup: SourceSpendingGroup): Promise<EntityId> {
  const client = requireSupabaseClient();
  const trimmed = name.trim();
  if (!trimmed) throw normalizeDataError({ code: '23514' }, 'sources');
  try {
    const { data, error } = await client
      .from('sources')
      .insert({
        name: trimmed,
        spending_group: spendingGroup,
        is_active: true,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  } catch (err) {
    logDataErrorDev('insert', 'sources', err);
    throw normalizeDataError(err, 'sources');
  }
}

export async function updateSource(
  id: EntityId,
  name: string,
  spendingGroup: SourceSpendingGroup | null,
): Promise<void> {
  const client = requireSupabaseClient();
  const trimmed = name.trim();
  if (!trimmed) throw normalizeDataError({ code: '23514' }, 'sources');
  try {
    const { error } = await client
      .from('sources')
      .update({ name: trimmed, spending_group: spendingGroup })
      .eq('id', id);
    if (error) throw error;
  } catch (err) {
    logDataErrorDev('update', 'sources', err);
    throw normalizeDataError(err, 'sources');
  }
}

export async function setSourceActive(id: EntityId, active: boolean): Promise<void> {
  const client = requireSupabaseClient();
  try {
    const { error } = await client.from('sources').update({ is_active: active }).eq('id', id);
    if (error) throw error;
  } catch (err) {
    logDataErrorDev('setActive', 'sources', err);
    throw normalizeDataError(err, 'sources');
  }
}

export async function deleteSource(id: EntityId): Promise<DeleteResult> {
  const client = requireSupabaseClient();
  try {
    const { count, error: cErr } = await client
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('source_id', id);
    if (cErr) throw cErr;
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        reason: 'Nguồn tiền đang được giao dịch sử dụng — không thể xoá. Hãy lưu trữ thay vì xoá.',
      };
    }

    const { error } = await client.from('sources').delete().eq('id', id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    logDataErrorDev('delete', 'sources', err);
    const normalized = normalizeDataError(err, 'sources');
    if (normalized.code === 'referenced') {
      return { ok: false, reason: normalized.message };
    }
    throw normalized;
  }
}
