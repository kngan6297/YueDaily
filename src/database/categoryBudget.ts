// ============================================================
// Category budget_group — trusted exact-name classification (migration only)
// Runtime reads persisted categories.budget_group — no name branching
// ============================================================

import type * as SQLite from 'expo-sqlite';
import type { BudgetGroup } from '../types';

export const TRUSTED_CATEGORY_BUDGET_GROUPS: Readonly<Record<string, BudgetGroup>> = {
  'Ăn uống': 'household_food',
  'Trà & Cà phê': 'household_food',
};

export function budgetGroupForExactCategoryName(name: string): BudgetGroup | null {
  return TRUSTED_CATEGORY_BUDGET_GROUPS[name] ?? null;
}

export function classifyTrustedCategoryBudgetGroups(
  categories: readonly { id: number; name: string }[],
): { id: number; budget_group: BudgetGroup }[] {
  const out: { id: number; budget_group: BudgetGroup }[] = [];
  for (const cat of categories) {
    const group = budgetGroupForExactCategoryName(cat.name);
    if (group) out.push({ id: cat.id, budget_group: group });
  }
  return out;
}

/** Exact trusted names → budget_group where still NULL (legacy backfill only) */
export async function classifyTrustedCategoryBudgetGroupsWhereNull(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  const existing = await database.getAllAsync<{ id: number; name: string }>(
    'SELECT id, name FROM categories WHERE budget_group IS NULL;',
  );
  for (const row of classifyTrustedCategoryBudgetGroups(existing)) {
    await database.runAsync(
      'UPDATE categories SET budget_group = ? WHERE id = ? AND budget_group IS NULL;',
      [row.budget_group, row.id],
    );
  }
}
