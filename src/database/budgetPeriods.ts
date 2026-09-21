// ============================================================
// budget_periods — persisted limit + carryover + envelope_source_id
// Spent/remaining derived — not stored here
// ============================================================

import type * as SQLite from 'expo-sqlite';
import {
  FIRST_HOUSEHOLD_FOOD_PERIOD,
  HOUSEHOLD_FOOD_BUDGET_KEY,
} from '../constants/budget';
import {
  getNextHouseholdFoodPeriodBounds,
  compareDateOnly,
  periodEndFromCycleStart,
  validateBudgetPeriodBounds,
} from './budgetPeriodDomain';
import {
  decideContinuingPeriodDefaults,
  decideFirstPeriodCarryoverSeed,
  decideFirstPeriodEnvelopeSourceSeed,
} from './householdFoodCarryoverSeed';
import { getDatabase } from './db';
import { HOUSEHOLD_FOOD_ENVELOPE_SOURCE_NAME } from './sourceSeed';
import type { BudgetKey, BudgetPeriod } from '../types';

const BUDGET_PERIOD_COLUMNS =
  'id, budget_key, period_start, period_end, limit_amount, carryover_amount, adjustment_amount, envelope_source_id, created_at, updated_at';

/** One-time seed markers — never re-apply after first successful run */
export const FIRST_PERIOD_CARRYOVER_SEED_MARKER =
  'household_food_first_period_carryover_v1' as const;
export const FIRST_PERIOD_ENVELOPE_SOURCE_SEED_MARKER =
  'household_food_first_period_envelope_source_v1' as const;

async function ensureAppMetaSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function mapBudgetPeriodRow(row: BudgetPeriod): BudgetPeriod {
  return {
    id: row.id,
    budget_key: row.budget_key,
    period_start: row.period_start,
    period_end: row.period_end,
    limit_amount: row.limit_amount,
    carryover_amount: row.carryover_amount ?? 0,
    adjustment_amount: row.adjustment_amount ?? 0,
    envelope_source_id: row.envelope_source_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Resolve Woori seed name → source id. Migration/seed only — not runtime membership. */
export async function resolveHouseholdFoodEnvelopeSourceId(
  db?: SQLite.SQLiteDatabase,
): Promise<number | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<{ id: number }>(
    'SELECT id FROM sources WHERE name = ? LIMIT 1;',
    [HOUSEHOLD_FOOD_ENVELOPE_SOURCE_NAME],
  );
  return row?.id ?? null;
}

export async function getBudgetPeriodByStart(
  budgetKey: BudgetKey,
  periodStart: string,
  db?: SQLite.SQLiteDatabase,
): Promise<BudgetPeriod | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<BudgetPeriod>(
    `SELECT ${BUDGET_PERIOD_COLUMNS}
     FROM budget_periods
     WHERE budget_key = ? AND period_start = ?;`,
    [budgetKey, periodStart],
  );
  return row ? mapBudgetPeriodRow(row) : null;
}

export async function getBudgetPeriodById(
  id: number,
  db?: SQLite.SQLiteDatabase,
): Promise<BudgetPeriod | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<BudgetPeriod>(
    `SELECT ${BUDGET_PERIOD_COLUMNS}
     FROM budget_periods
     WHERE id = ?;`,
    [id],
  );
  return row ? mapBudgetPeriodRow(row) : null;
}

export async function findNextBudgetPeriodAfterDate(
  budgetKey: BudgetKey,
  date: string,
  db?: SQLite.SQLiteDatabase,
): Promise<BudgetPeriod | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<BudgetPeriod>(
    `SELECT ${BUDGET_PERIOD_COLUMNS}
     FROM budget_periods
     WHERE budget_key = ?
       AND period_start > ?
     ORDER BY period_start ASC
     LIMIT 1;`,
    [budgetKey, date],
  );
  return row ? mapBudgetPeriodRow(row) : null;
}

export async function findBudgetPeriodContainingDate(
  budgetKey: BudgetKey,
  date: string,
  db?: SQLite.SQLiteDatabase,
): Promise<BudgetPeriod | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<BudgetPeriod>(
    `SELECT ${BUDGET_PERIOD_COLUMNS}
     FROM budget_periods
     WHERE budget_key = ?
       AND period_start <= ?
       AND period_end >= ?
     ORDER BY period_start DESC
     LIMIT 1;`,
    [budgetKey, date, date],
  );
  return row ? mapBudgetPeriodRow(row) : null;
}

export async function getLatestConfiguredBudgetPeriod(
  budgetKey: BudgetKey,
  db?: SQLite.SQLiteDatabase,
): Promise<BudgetPeriod | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<BudgetPeriod>(
    `SELECT ${BUDGET_PERIOD_COLUMNS}
     FROM budget_periods
     WHERE budget_key = ?
     ORDER BY period_start DESC
     LIMIT 1;`,
    [budgetKey],
  );
  return row ? mapBudgetPeriodRow(row) : null;
}

export async function getAllBudgetPeriods(
  db?: SQLite.SQLiteDatabase,
): Promise<BudgetPeriod[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<BudgetPeriod>(
    `SELECT ${BUDGET_PERIOD_COLUMNS}
     FROM budget_periods
     ORDER BY budget_key, period_start;`,
  );
  return rows.map(mapBudgetPeriodRow);
}

export async function createBudgetPeriod(
  input: {
    budget_key: BudgetKey;
    period_start: string;
    period_end: string;
    limit_amount: number;
    carryover_amount?: number;
    adjustment_amount?: number;
    envelope_source_id?: number | null;
  },
  db?: SQLite.SQLiteDatabase,
): Promise<number> {
  if (input.budget_key !== HOUSEHOLD_FOOD_BUDGET_KEY) {
    throw new Error(`Unsupported budget_key: ${input.budget_key}`);
  }
  const carryover_amount = input.carryover_amount ?? 0;
  if (!Number.isInteger(carryover_amount) || carryover_amount < 0) {
    throw new Error('carryover_amount must be a non-negative integer');
  }
  const adjustment_amount = input.adjustment_amount ?? 0;
  if (!Number.isInteger(adjustment_amount)) {
    throw new Error('adjustment_amount must be an integer');
  }
  const envelope_source_id =
    input.envelope_source_id === undefined ? null : input.envelope_source_id;
  if (
    envelope_source_id != null &&
    (!Number.isInteger(envelope_source_id) || envelope_source_id <= 0)
  ) {
    throw new Error('envelope_source_id must be a positive integer or null');
  }
  validateBudgetPeriodBounds(input.period_start, input.period_end, input.limit_amount);
  const database = db ?? (await getDatabase());

  const overlap = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM budget_periods
     WHERE budget_key = ?
       AND period_start <= ?
       AND period_end >= ?;`,
    [input.budget_key, input.period_end, input.period_start],
  );
  if (overlap && overlap.count > 0) {
    throw new Error('budget period overlaps an existing household_food period');
  }

  const result = await database.runAsync(
    `INSERT INTO budget_periods
       (budget_key, period_start, period_end, limit_amount, carryover_amount,
        adjustment_amount, envelope_source_id)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      input.budget_key,
      input.period_start,
      input.period_end,
      input.limit_amount,
      carryover_amount,
      adjustment_amount,
      envelope_source_id,
    ],
  );
  return result.lastInsertRowId;
}

export async function updateBudgetPeriodLimit(
  id: number,
  limitAmount: number,
  db?: SQLite.SQLiteDatabase,
): Promise<void> {
  if (!Number.isInteger(limitAmount) || limitAmount < 0) {
    throw new Error('limit_amount must be a non-negative integer');
  }
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE budget_periods
     SET limit_amount = ?, updated_at = datetime('now', 'localtime')
     WHERE id = ?;`,
    [limitAmount, id],
  );
}

/** Set absolute adjustment_amount (signed integer). */
export async function setBudgetPeriodAdjustmentAmount(
  id: number,
  adjustmentAmount: number,
  db?: SQLite.SQLiteDatabase,
): Promise<void> {
  if (!Number.isInteger(adjustmentAmount)) {
    throw new Error('adjustment_amount must be an integer');
  }
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE budget_periods
     SET adjustment_amount = ?, updated_at = datetime('now', 'localtime')
     WHERE id = ?;`,
    [adjustmentAmount, id],
  );
}

/** Mark first-period seeds complete without writing values (v5 restore guard). */
export async function markFirstPeriodBudgetSeedsComplete(
  db?: SQLite.SQLiteDatabase,
): Promise<void> {
  const database = db ?? (await getDatabase());
  await ensureAppMetaSchema(database);
  for (const key of [
    FIRST_PERIOD_CARRYOVER_SEED_MARKER,
    FIRST_PERIOD_ENVELOPE_SOURCE_SEED_MARKER,
  ]) {
    await database.runAsync(
      `INSERT INTO app_meta (key, value) VALUES (?, '1')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
      [key],
    );
  }
}

/** First P1.6 configured period — insert only if absent; never overwrite edited values */
export async function ensureInitialHouseholdFoodPeriod(
  db?: SQLite.SQLiteDatabase,
): Promise<void> {
  const database = db ?? (await getDatabase());
  const existing = await getBudgetPeriodByStart(
    HOUSEHOLD_FOOD_BUDGET_KEY,
    FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
    database,
  );
  if (existing) return;

  const envelope_source_id = await resolveHouseholdFoodEnvelopeSourceId(database);
  await createBudgetPeriod(
    {
      budget_key: HOUSEHOLD_FOOD_BUDGET_KEY,
      period_start: FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
      period_end: FIRST_HOUSEHOLD_FOOD_PERIOD.period_end,
      limit_amount: FIRST_HOUSEHOLD_FOOD_PERIOD.limit_amount,
      carryover_amount: FIRST_HOUSEHOLD_FOOD_PERIOD.carryover_amount,
      envelope_source_id,
    },
    database,
  );
}

/**
 * One-time: if the first configured period exists with carryover 0, set 223_550.
 * Marker-guarded — never rewrites a non-zero carryover on restart.
 */
export async function seedFirstPeriodCarryoverOnce(
  db?: SQLite.SQLiteDatabase,
): Promise<boolean> {
  const database = db ?? (await getDatabase());
  await ensureAppMetaSchema(database);

  const marker = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?;',
    [FIRST_PERIOD_CARRYOVER_SEED_MARKER],
  );
  if (marker?.value === '1') return false;

  const existing = await getBudgetPeriodByStart(
    HOUSEHOLD_FOOD_BUDGET_KEY,
    FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
    database,
  );
  const decision = decideFirstPeriodCarryoverSeed({
    markerComplete: false,
    existingCarryover: existing ? existing.carryover_amount : null,
  });

  if (decision.shouldUpdate && decision.carryoverToWrite != null) {
    await database.runAsync(
      `UPDATE budget_periods
       SET carryover_amount = ?, updated_at = datetime('now', 'localtime')
       WHERE budget_key = ?
         AND period_start = ?
         AND carryover_amount = 0;`,
      [
        decision.carryoverToWrite,
        HOUSEHOLD_FOOD_BUDGET_KEY,
        FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
      ],
    );
  }

  if (decision.shouldMark) {
    await database.runAsync(
      `INSERT INTO app_meta (key, value) VALUES (?, '1')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
      [FIRST_PERIOD_CARRYOVER_SEED_MARKER],
    );
  }
  return decision.shouldUpdate;
}

/**
 * One-time: resolve Woori seed name → id and persist on first period when NULL.
 * Also backfills other household_food periods that still have NULL envelope_source_id.
 */
export async function seedFirstPeriodEnvelopeSourceOnce(
  db?: SQLite.SQLiteDatabase,
): Promise<boolean> {
  const database = db ?? (await getDatabase());
  await ensureAppMetaSchema(database);

  const marker = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?;',
    [FIRST_PERIOD_ENVELOPE_SOURCE_SEED_MARKER],
  );
  if (marker?.value === '1') return false;

  const existing = await getBudgetPeriodByStart(
    HOUSEHOLD_FOOD_BUDGET_KEY,
    FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
    database,
  );
  const resolvedSourceId = await resolveHouseholdFoodEnvelopeSourceId(database);
  const decision = decideFirstPeriodEnvelopeSourceSeed({
    markerComplete: false,
    existingEnvelopeSourceId: existing ? existing.envelope_source_id : null,
    resolvedSourceId,
  });

  if (decision.shouldUpdate && decision.envelopeSourceIdToWrite != null) {
    await database.runAsync(
      `UPDATE budget_periods
       SET envelope_source_id = ?, updated_at = datetime('now', 'localtime')
       WHERE budget_key = ?
         AND period_start = ?
         AND envelope_source_id IS NULL;`,
      [
        decision.envelopeSourceIdToWrite,
        HOUSEHOLD_FOOD_BUDGET_KEY,
        FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
      ],
    );
    // Backfill any other periods still missing envelope (pre-upgrade rows)
    await database.runAsync(
      `UPDATE budget_periods
       SET envelope_source_id = ?, updated_at = datetime('now', 'localtime')
       WHERE budget_key = ?
         AND envelope_source_id IS NULL;`,
      [decision.envelopeSourceIdToWrite, HOUSEHOLD_FOOD_BUDGET_KEY],
    );
  }

  if (decision.shouldMark) {
    await database.runAsync(
      `INSERT INTO app_meta (key, value) VALUES (?, '1')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
      [FIRST_PERIOD_ENVELOPE_SOURCE_SEED_MARKER],
    );
  }
  return decision.shouldUpdate;
}

/** Run both first-period seeds (carryover + envelope). Used on startup and v1–v4 restore. */
export async function runFirstPeriodBudgetSeedsIfNeeded(
  db?: SQLite.SQLiteDatabase,
): Promise<void> {
  const database = db ?? (await getDatabase());
  await seedFirstPeriodCarryoverOnce(database);
  await seedFirstPeriodEnvelopeSourceOnce(database);
}

/**
 * Future cycle: inherit latest limit + envelope_source_id; carryover always 0.
 */
export async function ensureHouseholdFoodPeriodForStart(
  periodStart: string,
  db?: SQLite.SQLiteDatabase,
): Promise<BudgetPeriod> {
  const database = db ?? (await getDatabase());
  const existing = await getBudgetPeriodByStart(
    HOUSEHOLD_FOOD_BUDGET_KEY,
    periodStart,
    database,
  );
  if (existing) return existing;

  if (compareDateOnly(periodStart, FIRST_HOUSEHOLD_FOOD_PERIOD.period_start) < 0) {
    throw new Error('Cannot create household food period before first configured period');
  }

  const latest = await getLatestConfiguredBudgetPeriod(HOUSEHOLD_FOOD_BUDGET_KEY, database);
  const defaults = decideContinuingPeriodDefaults(
    latest
      ? {
          limit_amount: latest.limit_amount,
          envelope_source_id: latest.envelope_source_id,
        }
      : null,
  );
  const period_end = periodEndFromCycleStart(periodStart);

  const id = await createBudgetPeriod(
    {
      budget_key: HOUSEHOLD_FOOD_BUDGET_KEY,
      period_start: periodStart,
      period_end,
      limit_amount: defaults.limit_amount,
      carryover_amount: defaults.carryover_amount,
      adjustment_amount: 0,
      envelope_source_id: defaults.envelope_source_id,
    },
    database,
  );

  const created = await database.getFirstAsync<BudgetPeriod>(
    `SELECT ${BUDGET_PERIOD_COLUMNS}
     FROM budget_periods WHERE id = ?;`,
    [id],
  );
  if (!created) throw new Error('Failed to create budget period');
  return mapBudgetPeriodRow(created);
}

export function nextHouseholdFoodPeriodAfter(
  current: Pick<BudgetPeriod, 'period_start' | 'period_end'>,
): { period_start: string; period_end: string } {
  return getNextHouseholdFoodPeriodBounds(current);
}
