// ============================================================
// P1.6 trusted backfill lifecycle — one-time legacy migration marker
// Schema setup stays idempotent; name-based backfill runs once per DB lineage
// ============================================================

import type * as SQLite from 'expo-sqlite';
import { classifyTrustedCategoryBudgetGroupsWhereNull } from './categoryBudget';
import { ensureInitialHouseholdFoodPeriod } from './budgetPeriods';
import { migrateVcbShopSpendingGroupIfNull } from './sourceMigration';
import {
  P16_TRUSTED_BACKFILL_MARKER,
  shouldRunLegacyTrustedBackfillAfterRestore,
} from './p16MigrationLifecycle';

export {
  P16_TRUSTED_BACKFILL_MARKER,
  shouldRunLegacyTrustedBackfillAfterRestore,
  shouldRunP16TrustedBackfillOnStartup,
} from './p16MigrationLifecycle';

export async function ensureAppMetaSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export async function isP16TrustedBackfillComplete(
  database: SQLite.SQLiteDatabase,
): Promise<boolean> {
  await ensureAppMetaSchema(database);
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?;',
    [P16_TRUSTED_BACKFILL_MARKER],
  );
  return row?.value === '1';
}

export async function markP16TrustedBackfillComplete(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  await ensureAppMetaSchema(database);
  await database.runAsync(
    `INSERT INTO app_meta (key, value) VALUES (?, '1')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [P16_TRUSTED_BACKFILL_MARKER],
  );
}

/** One-time trusted backfill for pre-P1.6 DB upgrades — skipped after marker or v4 restore */
export async function runP16TrustedBackfillIfNeeded(
  database: SQLite.SQLiteDatabase,
): Promise<boolean> {
  if (await isP16TrustedBackfillComplete(database)) return false;

  await classifyTrustedCategoryBudgetGroupsWhereNull(database);
  await migrateVcbShopSpendingGroupIfNull(database);
  await ensureInitialHouseholdFoodPeriod(database);
  await markP16TrustedBackfillComplete(database);
  return true;
}

/** v1–v3 restore hooks — not used for v4 authoritative restore */
export async function runLegacyTrustedBackfillAfterRestore(
  database: SQLite.SQLiteDatabase,
  backupVersion: string,
): Promise<void> {
  if (!shouldRunLegacyTrustedBackfillAfterRestore(backupVersion)) return;

  await classifyTrustedCategoryBudgetGroupsWhereNull(database);
  await migrateVcbShopSpendingGroupIfNull(database);
  await ensureInitialHouseholdFoodPeriod(database);
}
