// ============================================================
// Category picker order — usage_count DESC, name ASC
// Frequency = completed expense transactions, not amount.
// ============================================================

import { TRANSACTION_STATUS_COMPLETE } from '../types/index';

export interface CategoryUsageRow {
  name: string;
  usage_count: number;
}

export function compareCategoriesByUsage(a: CategoryUsageRow, b: CategoryUsageRow): number {
  if (b.usage_count !== a.usage_count) return b.usage_count - a.usage_count;
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  return 0;
}

export function sortCategoriesByUsage<T extends CategoryUsageRow>(rows: readonly T[]): T[] {
  return [...rows].sort(compareCategoriesByUsage);
}

/** Completed expense rows only — matches form picker SQL. */
export const CATEGORY_USAGE_JOIN = `
  LEFT JOIN transactions t
    ON t.category_id = c.id
   AND t.status = '${TRANSACTION_STATUS_COMPLETE}'
   AND t.type = 'chi'
`;
