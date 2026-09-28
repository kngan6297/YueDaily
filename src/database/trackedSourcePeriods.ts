// ============================================================
// tracked_source_periods — persisted monthly opening + adjustment
// Balance derived from transactions — not stored here
// ============================================================

import type * as SQLite from 'expo-sqlite';
import {
  getCalendarMonthBounds,
  validateCalendarMonthPeriodBounds,
} from './calendarMonthPeriodDomain';
import { getDatabase } from './db';
import { VPBANK_TRACKED_SOURCE_NAME } from './sourceSeed';
import type { TrackedSourcePeriod } from '../types';

const TRACKED_SOURCE_PERIOD_COLUMNS =
  'id, source_id, period_start, period_end, opening_balance, adjustment_amount, created_at, updated_at';

function mapTrackedSourcePeriodRow(row: TrackedSourcePeriod): TrackedSourcePeriod {
  return {
    id: row.id,
    source_id: row.source_id,
    period_start: row.period_start,
    period_end: row.period_end,
    opening_balance: row.opening_balance ?? null,
    adjustment_amount: row.adjustment_amount ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Resolve VPBank seed name → source id. Ensure/lazy only — not runtime membership. */
export async function resolveVpBankTrackedSourceId(
  db?: SQLite.SQLiteDatabase,
): Promise<number | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<{ id: number }>(
    'SELECT id FROM sources WHERE name = ? LIMIT 1;',
    [VPBANK_TRACKED_SOURCE_NAME],
  );
  return row?.id ?? null;
}

export async function getTrackedSourcePeriodById(
  id: number,
  db?: SQLite.SQLiteDatabase,
): Promise<TrackedSourcePeriod | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<TrackedSourcePeriod>(
    `SELECT ${TRACKED_SOURCE_PERIOD_COLUMNS}
     FROM tracked_source_periods
     WHERE id = ?;`,
    [id],
  );
  return row ? mapTrackedSourcePeriodRow(row) : null;
}

export async function getTrackedSourcePeriodByStart(
  sourceId: number,
  periodStart: string,
  db?: SQLite.SQLiteDatabase,
): Promise<TrackedSourcePeriod | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<TrackedSourcePeriod>(
    `SELECT ${TRACKED_SOURCE_PERIOD_COLUMNS}
     FROM tracked_source_periods
     WHERE source_id = ? AND period_start = ?;`,
    [sourceId, periodStart],
  );
  return row ? mapTrackedSourcePeriodRow(row) : null;
}

export async function findTrackedSourcePeriodContainingDate(
  sourceId: number,
  date: string,
  db?: SQLite.SQLiteDatabase,
): Promise<TrackedSourcePeriod | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<TrackedSourcePeriod>(
    `SELECT ${TRACKED_SOURCE_PERIOD_COLUMNS}
     FROM tracked_source_periods
     WHERE source_id = ?
       AND period_start <= ?
       AND period_end >= ?
     ORDER BY period_start DESC
     LIMIT 1;`,
    [sourceId, date, date],
  );
  return row ? mapTrackedSourcePeriodRow(row) : null;
}

export async function insertTrackedSourcePeriod(
  input: {
    source_id: number;
    period_start: string;
    period_end: string;
    opening_balance?: number | null;
    adjustment_amount?: number;
  },
  db?: SQLite.SQLiteDatabase,
): Promise<TrackedSourcePeriod> {
  validateCalendarMonthPeriodBounds(input.period_start, input.period_end);
  if (!Number.isInteger(input.source_id) || input.source_id <= 0) {
    throw new Error('source_id must be a positive integer');
  }
  const opening =
    input.opening_balance === undefined ? null : input.opening_balance;
  if (opening != null && (!Number.isInteger(opening) || opening < 0)) {
    throw new Error('opening_balance must be a non-negative integer or null');
  }
  const adjustment = input.adjustment_amount ?? 0;
  if (!Number.isInteger(adjustment)) {
    throw new Error('adjustment_amount must be an integer');
  }

  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    `INSERT INTO tracked_source_periods
       (source_id, period_start, period_end, opening_balance, adjustment_amount)
     VALUES (?, ?, ?, ?, ?);`,
    [input.source_id, input.period_start, input.period_end, opening, adjustment],
  );
  const created = await getTrackedSourcePeriodById(result.lastInsertRowId, database);
  if (!created) throw new Error('Failed to read inserted tracked_source_period');
  return created;
}

/**
 * Ensure a calendar-month period row exists for the source.
 * New months always start with opening_balance = null and adjustment = 0.
 * Does NOT carry previous month closing/opening.
 */
export async function ensureTrackedSourcePeriodForDate(
  sourceId: number,
  referenceDate: string,
  db?: SQLite.SQLiteDatabase,
): Promise<TrackedSourcePeriod> {
  const database = db ?? (await getDatabase());
  const bounds = getCalendarMonthBounds(referenceDate);
  const existing = await getTrackedSourcePeriodByStart(
    sourceId,
    bounds.period_start,
    database,
  );
  if (existing) return existing;

  return insertTrackedSourcePeriod(
    {
      source_id: sourceId,
      period_start: bounds.period_start,
      period_end: bounds.period_end,
      opening_balance: null,
      adjustment_amount: 0,
    },
    database,
  );
}

/** Ensure VPBank calendar-month period for referenceDate (lazy create). */
export async function ensureVpBankTrackedSourcePeriod(
  referenceDate: string,
  db?: SQLite.SQLiteDatabase,
): Promise<TrackedSourcePeriod | null> {
  const database = db ?? (await getDatabase());
  const sourceId = await resolveVpBankTrackedSourceId(database);
  if (sourceId == null) return null;
  return ensureTrackedSourcePeriodForDate(sourceId, referenceDate, database);
}

/** Replace opening_balance (does not accumulate). */
export async function setTrackedSourcePeriodOpeningBalance(
  periodId: number,
  openingBalance: number,
  db?: SQLite.SQLiteDatabase,
): Promise<void> {
  if (!Number.isInteger(openingBalance) || openingBalance < 0) {
    throw new Error('opening_balance must be a non-negative integer');
  }
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE tracked_source_periods
     SET opening_balance = ?, updated_at = datetime('now', 'localtime')
     WHERE id = ?;`,
    [openingBalance, periodId],
  );
}

export async function setTrackedSourcePeriodAdjustmentAmount(
  periodId: number,
  adjustmentAmount: number,
  db?: SQLite.SQLiteDatabase,
): Promise<void> {
  if (!Number.isInteger(adjustmentAmount)) {
    throw new Error('adjustment_amount must be an integer');
  }
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE tracked_source_periods
     SET adjustment_amount = ?, updated_at = datetime('now', 'localtime')
     WHERE id = ?;`,
    [adjustmentAmount, periodId],
  );
}
