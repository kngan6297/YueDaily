// ============================================================
// P1.8A — Safe transaction DTO (never image_uri / location / secrets)
// ============================================================

import type { ExpenseAudience, TransactionType } from '../../types';

export interface SafeTransactionDto {
  id: number;
  date: string;
  amount: number;
  type: TransactionType;
  categoryName: string | null;
  sourceName: string | null;
  expenseAudience: ExpenseAudience;
  note: string | null;
}

export interface SafeTransactionInput {
  id: number;
  amount: number;
  type: string;
  created_at: string;
  expense_audience: ExpenseAudience | string;
  note?: string | null;
  category_name?: string | null;
  source_name?: string | null;
  /** Explicitly ignored if present */
  image_uri?: string | null;
  location?: string | null;
  payer?: string;
}

export function toSafeTransactionDto(row: SafeTransactionInput): SafeTransactionDto {
  return {
    id: row.id,
    date: row.created_at.slice(0, 10),
    amount: row.amount,
    type: row.type === 'thu' ? 'thu' : 'chi',
    categoryName: row.category_name ?? null,
    sourceName: row.source_name ?? null,
    expenseAudience: (row.expense_audience as ExpenseAudience) ?? 'unspecified',
    note: row.note ?? null,
  };
}

/** Strip any accidental sensitive keys from a DTO-like object. */
export function assertNoSensitiveFields(dto: Record<string, unknown>): void {
  if ('image_uri' in dto) throw new Error('image_uri must not appear in safe DTO');
  if ('location' in dto) throw new Error('location must not appear in safe DTO by default');
  if ('base64' in dto) throw new Error('base64 must not appear in safe DTO');
}
