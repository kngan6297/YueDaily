// ============================================================
// P1.6 one-time trusted source migrations (not Settings edits)
// ============================================================

import type * as SQLite from 'expo-sqlite';

export const VCB_SHOP_EXACT_NAME = 'VCB Shop';

/**
 * Authorized one-time migration: VCB Shop with NULL spending_group → household.
 * Idempotent; does not overwrite non-null classifications.
 */
export async function migrateVcbShopSpendingGroupIfNull(
  database: SQLite.SQLiteDatabase,
): Promise<number> {
  const result = await database.runAsync(
    `UPDATE sources
     SET spending_group = 'household'
     WHERE name = ?
       AND spending_group IS NULL;`,
    [VCB_SHOP_EXACT_NAME],
  );
  return result.changes;
}
