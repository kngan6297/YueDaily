// ============================================================
// P2.2 — Web TransactionRepository (Supabase + RLS)
// Calendar filters use transaction_date (YYYY-MM-DD).
// Never accepts user_id from UI — DB default / session only.
// ============================================================

import { buildCreatedAt } from '../utils/date';
import { resolvePayerForInsert } from '../types';
import type { SourceSpendingGroup } from '../types';
import { logDataErrorDev, normalizeDataError } from './errors';
import {
  mapCloudTransaction,
  parseAmountInteger,
  requireLocalYmd,
  type CloudTransactionRow,
} from './mappers';
import { requireSupabaseClient } from './requireClient.web';
import type { EntityId, FinanceTransaction, FinanceTransactionInput } from './types';

const TXN_SELECT = `
  id, amount, type, category_id, source_id, payer, expense_audience,
  image_uri, location, note, status, transaction_date, created_at,
  categories ( name, icon, color ),
  sources ( name )
`;

function monthDateBounds(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

export async function getTransactionById(id: EntityId): Promise<FinanceTransaction | null> {
  const client = requireSupabaseClient();
  try {
    const { data, error } = await client
      .from('transactions')
      .select(TXN_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return mapCloudTransaction(data as unknown as CloudTransactionRow);
  } catch (err) {
    logDataErrorDev('getById', 'transactions', err);
    throw normalizeDataError(err, 'transactions');
  }
}

export async function getTransactionsByMonth(
  year: number,
  month: number,
  spendingGroup?: SourceSpendingGroup | null,
): Promise<FinanceTransaction[]> {
  const client = requireSupabaseClient();
  const { from, to } = monthDateBounds(year, month);
  try {
    let sourceIds: string[] | null = null;
    if (spendingGroup) {
      const { data: sources, error: sErr } = await client
        .from('sources')
        .select('id')
        .eq('spending_group', spendingGroup);
      if (sErr) throw sErr;
      sourceIds = (sources ?? []).map((s) => s.id as string);
      if (sourceIds.length === 0) return [];
    }

    let query = client
      .from('transactions')
      .select(TXN_SELECT)
      .eq('status', 'complete')
      .gte('transaction_date', from)
      .lte('transaction_date', to)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (sourceIds) {
      query = query.in('source_id', sourceIds);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) =>
      mapCloudTransaction(row as unknown as CloudTransactionRow),
    );
  } catch (err) {
    logDataErrorDev('getByMonth', 'transactions', err);
    throw normalizeDataError(err, 'transactions');
  }
}

export async function insertTransaction(data: FinanceTransactionInput): Promise<EntityId> {
  const client = requireSupabaseClient();
  const amount = parseAmountInteger(data.amount);
  if (amount <= 0 || !data.category_id || !data.source_id) {
    throw normalizeDataError({ code: '23514' }, 'transactions');
  }
  let transactionDate: string;
  try {
    transactionDate = requireLocalYmd(data.transaction_date);
  } catch {
    throw normalizeDataError({ code: '23514' }, 'transactions');
  }

  try {
    const { data: row, error } = await client
      .from('transactions')
      .insert({
        amount,
        type: 'chi',
        category_id: data.category_id,
        source_id: data.source_id,
        payer: resolvePayerForInsert(data.payer),
        expense_audience: data.expense_audience,
        image_uri: data.image_uri,
        location: data.location || null,
        note: data.note || null,
        status: 'complete',
        transaction_date: transactionDate,
        // Keep local-datetime TEXT for P2.5 mapping parity with native created_at.
        created_at: buildCreatedAt(transactionDate),
      })
      .select('id')
      .single();
    if (error) throw error;
    return row.id as string;
  } catch (err) {
    logDataErrorDev('insert', 'transactions', err);
    throw normalizeDataError(err, 'transactions');
  }
}

export async function updateTransaction(id: EntityId, data: FinanceTransactionInput): Promise<void> {
  const client = requireSupabaseClient();
  const amount = parseAmountInteger(data.amount);
  if (amount <= 0 || !data.category_id || !data.source_id) {
    throw normalizeDataError({ code: '23514' }, 'transactions');
  }
  let transactionDate: string;
  try {
    transactionDate = requireLocalYmd(data.transaction_date);
  } catch {
    throw normalizeDataError({ code: '23514' }, 'transactions');
  }

  try {
    const existing = await getTransactionById(id);
    if (!existing) {
      throw normalizeDataError({ code: 'PGRST116' }, 'transactions');
    }

    const { error } = await client
      .from('transactions')
      .update({
        amount,
        type: existing.type,
        category_id: data.category_id,
        source_id: data.source_id,
        expense_audience: data.expense_audience,
        location: data.location || null,
        note: data.note || null,
        transaction_date: transactionDate,
        created_at: buildCreatedAt(transactionDate),
      })
      .eq('id', id);
    if (error) throw error;
  } catch (err) {
    logDataErrorDev('update', 'transactions', err);
    throw normalizeDataError(err, 'transactions');
  }
}

export async function deleteTransaction(id: EntityId): Promise<void> {
  const client = requireSupabaseClient();
  try {
    const { error } = await client.from('transactions').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    logDataErrorDev('delete', 'transactions', err);
    throw normalizeDataError(err, 'transactions');
  }
}
