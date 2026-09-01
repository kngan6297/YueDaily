// ============================================================
// budget_periods — persisted limit configuration (P1.6A)
// Spent/remaining derived later in P1.6B — not stored here
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
import { getDatabase } from './initDb';
import type { BudgetKey, BudgetPeriod } from '../types';

function mapBudgetPeriodRow(row: BudgetPeriod): BudgetPeriod {
  return {
    id: row.id,
    budget_key: row.budget_key,
    period_start: row.period_start,
    period_end: row.period_end,
    limit_amount: row.limit_amount,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getBudgetPeriodByStart(
  budgetKey: BudgetKey,
  periodStart: string,
  db?: SQLite.SQLiteDatabase,
): Promise<BudgetPeriod | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<BudgetPeriod>(
    `SELECT id, budget_key, period_start, period_end, limit_amount, created_at, updated_at
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
    `SELECT id, budget_key, period_start, period_end, limit_amount, created_at, updated_at
     FROM budget_periods
     WHERE id = ?;`,
    [id],
  );
  return row ? mapBudgetPeriodRow(row) : null;
}

/** Next stored period whose period_start is strictly after `date` */
export async function findNextBudgetPeriodAfterDate(
  budgetKey: BudgetKey,
  date: string,
  db?: SQLite.SQLiteDatabase,
): Promise<BudgetPeriod | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<BudgetPeriod>(
    `SELECT id, budget_key, period_start, period_end, limit_amount, created_at, updated_at
     FROM budget_periods
     WHERE budget_key = ?
       AND period_start > ?
     ORDER BY period_start ASC
     LIMIT 1;`,
    [budgetKey, date],
  );
  return row ? mapBudgetPeriodRow(row) : null;
}

/** Period where period_start <= date <= period_end (stored boundaries authoritative) */
export async function findBudgetPeriodContainingDate(
  budgetKey: BudgetKey,
  date: string,
  db?: SQLite.SQLiteDatabase,
): Promise<BudgetPeriod | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<BudgetPeriod>(
    `SELECT id, budget_key, period_start, period_end, limit_amount, created_at, updated_at
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
    `SELECT id, budget_key, period_start, period_end, limit_amount, created_at, updated_at
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
    `SELECT id, budget_key, period_start, period_end, limit_amount, created_at, updated_at
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
  },
  db?: SQLite.SQLiteDatabase,
): Promise<number> {
  if (input.budget_key !== HOUSEHOLD_FOOD_BUDGET_KEY) {
    throw new Error(`Unsupported budget_key: ${input.budget_key}`);
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
    `INSERT INTO budget_periods (budget_key, period_start, period_end, limit_amount)
     VALUES (?, ?, ?, ?);`,
    [input.budget_key, input.period_start, input.period_end, input.limit_amount],
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

/** First P1.6 configured period — insert only if absent; never overwrite edited limits */
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

  await createBudgetPeriod(
    {
      budget_key: HOUSEHOLD_FOOD_BUDGET_KEY,
      period_start: FIRST_HOUSEHOLD_FOOD_PERIOD.period_start,
      period_end: FIRST_HOUSEHOLD_FOOD_PERIOD.period_end,
      limit_amount: FIRST_HOUSEHOLD_FOOD_PERIOD.limit_amount,
    },
    database,
  );
}

/**
 * Future cycle foundation: create target period if missing, inherit latest configured limit.
 * Does not backfill every skipped intermediate cycle.
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
  const limit_amount = latest?.limit_amount ?? FIRST_HOUSEHOLD_FOOD_PERIOD.limit_amount;
  const period_end = periodEndFromCycleStart(periodStart);

  const id = await createBudgetPeriod(
    {
      budget_key: HOUSEHOLD_FOOD_BUDGET_KEY,
      period_start: periodStart,
      period_end,
      limit_amount,
    },
    database,
  );

  const created = await database.getFirstAsync<BudgetPeriod>(
    `SELECT id, budget_key, period_start, period_end, limit_amount, created_at, updated_at
     FROM budget_periods WHERE id = ?;`,
    [id],
  );
  if (!created) throw new Error('Failed to create budget period');
  return mapBudgetPeriodRow(created);
}

/** Resolve next period bounds after a stored period (pure + optional persist helper) */
export function nextHouseholdFoodPeriodAfter(
  current: Pick<BudgetPeriod, 'period_start' | 'period_end'>,
): { period_start: string; period_end: string } {
  return getNextHouseholdFoodPeriodBounds(current);
}
