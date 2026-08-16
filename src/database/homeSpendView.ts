// ============================================================
// Home monitoring views — grouping theo sources.spending_group
// Không dùng expense_audience. Không persist trên transaction.
// ============================================================

import type { SourceSpendingGroup } from '../types';

export type HomeSpendView = 'all' | 'personal_yue' | 'household';

export const HOME_SPEND_VIEW_OPTIONS: { id: HomeSpendView; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'personal_yue', label: 'Cá nhân Yue' },
  { id: 'household', label: 'Quỹ chung' },
];

/** `all` → không filter. Grouped views → exact spending_group. */
export function spendingGroupForHomeSpendView(
  view: HomeSpendView,
): SourceSpendingGroup | null {
  if (view === 'all') return null;
  return view;
}

export function matchesHomeSpendView(
  spendingGroup: SourceSpendingGroup | null,
  view: HomeSpendView,
): boolean {
  if (view === 'all') return true;
  return spendingGroup === view;
}

export function sumHomeSpendView(
  rows: readonly { spending_group: SourceSpendingGroup | null; amount: number }[],
  view: HomeSpendView,
): number {
  let total = 0;
  for (const row of rows) {
    if (matchesHomeSpendView(row.spending_group, view)) total += row.amount;
  }
  return total;
}

/**
 * SQL equality với bound param. `column` là identifier nội bộ (không lấy từ user input).
 * `null` group = Tất cả → không thêm clause (giữ unclassified + null source_id).
 */
export function spendingGroupEqualsClause(
  group: SourceSpendingGroup | null | undefined,
  column: string,
): { clause: string; params: string[] } {
  if (!group) return { clause: '', params: [] };
  return { clause: ` AND ${column} = ?`, params: [group] };
}
