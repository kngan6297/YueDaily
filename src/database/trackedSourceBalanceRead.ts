// ============================================================
// Tracked-source balance — read repository (VPBank Home card)
// ============================================================

import {
  accumulateTrackedSourceAdjustment,
  computeTrackedSourceBalance,
  type TrackedSourceBalanceAmounts,
} from './trackedSourceBalanceCalculations';
import { formatCalendarMonthLabel } from './calendarMonthPeriodDomain';
import { getDatabase } from './initDb';
import { trackedSourcePeriodMembershipWhere } from './trackedSourcePeriodSql';
import {
  ensureVpBankTrackedSourcePeriod,
  findTrackedSourcePeriodContainingDate,
  getTrackedSourcePeriodById,
  resolveVpBankTrackedSourceId,
  setTrackedSourcePeriodAdjustmentAmount,
  setTrackedSourcePeriodOpeningBalance,
} from './trackedSourcePeriods';
import type { TrackedSourcePeriod } from '../types';
import { EXPENSE_AUDIENCE_LABELS, type ExpenseAudience } from '../types';
import { dateFromCreatedAt } from '../utils/date';

export interface TrackedSourceBalanceTransactionRow {
  id: number;
  amount: number;
  type: 'thu' | 'chi';
  transaction_date: string;
  category_name: string;
  category_icon: string;
  source_name: string;
  expense_audience_label: string;
  note: string | null;
}

export interface VpBankBalanceHomeCardData {
  referenceDate: string;
  sourceId: number;
  sourceName: string;
  period: TrackedSourcePeriod;
  monthLabel: string;
  /** null when opening_balance not entered */
  amounts: TrackedSourceBalanceAmounts | null;
  needsOpeningBalance: boolean;
}

export interface VpBankBalanceDetailData {
  sourceId: number;
  sourceName: string;
  period: TrackedSourcePeriod;
  monthLabel: string;
  amounts: TrackedSourceBalanceAmounts | null;
  needsOpeningBalance: boolean;
  transactions: TrackedSourceBalanceTransactionRow[];
}

const membership = trackedSourcePeriodMembershipWhere();

function membershipParams(period: TrackedSourcePeriod): (number | string)[] {
  return [period.source_id, period.period_start, period.period_end];
}

async function sumIncomeExpenseForPeriod(
  period: TrackedSourcePeriod,
): Promise<{ incomeAmount: number; expenseAmount: number }> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ income: number; expense: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN t.type = 'thu' THEN t.amount ELSE 0 END), 0) AS income,
       COALESCE(SUM(CASE WHEN t.type = 'chi' THEN t.amount ELSE 0 END), 0) AS expense
     FROM transactions t
     WHERE ${membership};`,
    membershipParams(period),
  );
  return {
    incomeAmount: row?.income ?? 0,
    expenseAmount: row?.expense ?? 0,
  };
}

async function loadSourceName(sourceId: number): Promise<string> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ name: string }>(
    'SELECT name FROM sources WHERE id = ?;',
    [sourceId],
  );
  return row?.name ?? 'VPBank';
}

/** Explicit lifecycle — may persist one calendar-month period; never aggregates */
export async function ensureVpBankBalancePeriod(
  referenceDate: string,
): Promise<TrackedSourcePeriod | null> {
  return ensureVpBankTrackedSourcePeriod(referenceDate);
}

/** Read-only card loader — caller should ensure period first */
export async function loadVpBankBalanceHomeCard(
  referenceDate: string,
): Promise<VpBankBalanceHomeCardData | null> {
  const sourceId = await resolveVpBankTrackedSourceId();
  if (sourceId == null) return null;

  const period = await findTrackedSourcePeriodContainingDate(sourceId, referenceDate);
  if (!period) return null;

  const sourceName = await loadSourceName(sourceId);
  const { incomeAmount, expenseAmount } = await sumIncomeExpenseForPeriod(period);
  const amounts = computeTrackedSourceBalance(
    period.opening_balance,
    incomeAmount,
    expenseAmount,
    period.adjustment_amount,
  );

  return {
    referenceDate,
    sourceId,
    sourceName,
    period,
    monthLabel: formatCalendarMonthLabel(period.period_start),
    amounts,
    needsOpeningBalance: period.opening_balance == null,
  };
}

export async function getVpBankBalanceTransactionsForPeriod(
  periodId: number,
): Promise<TrackedSourceBalanceTransactionRow[]> {
  const period = await getTrackedSourcePeriodById(periodId);
  if (!period) return [];

  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    amount: number;
    type: string;
    created_at: string;
    category_name: string | null;
    category_icon: string | null;
    source_name: string | null;
    expense_audience: ExpenseAudience;
    note: string | null;
  }>(
    `SELECT t.id,
            t.amount,
            t.type,
            t.created_at,
            c.name AS category_name,
            c.icon AS category_icon,
            COALESCE(s.name, 'Không rõ nguồn') AS source_name,
            t.expense_audience,
            t.note
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN sources s ON s.id = t.source_id
     WHERE ${membership}
     ORDER BY t.created_at DESC, t.id DESC;`,
    membershipParams(period),
  );

  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    type: row.type === 'thu' ? 'thu' : 'chi',
    transaction_date: dateFromCreatedAt(row.created_at),
    category_name: row.category_name ?? 'Không rõ',
    category_icon: row.category_icon ?? '💰',
    source_name: row.source_name ?? 'Không rõ nguồn',
    expense_audience_label:
      EXPENSE_AUDIENCE_LABELS[row.expense_audience] ?? EXPENSE_AUDIENCE_LABELS.unspecified,
    note: row.note,
  }));
}

export async function loadVpBankBalanceDetail(
  periodId: number,
): Promise<VpBankBalanceDetailData | null> {
  const period = await getTrackedSourcePeriodById(periodId);
  if (!period) return null;

  const sourceName = await loadSourceName(period.source_id);
  const { incomeAmount, expenseAmount } = await sumIncomeExpenseForPeriod(period);
  const amounts = computeTrackedSourceBalance(
    period.opening_balance,
    incomeAmount,
    expenseAmount,
    period.adjustment_amount,
  );
  const transactions = await getVpBankBalanceTransactionsForPeriod(periodId);

  return {
    sourceId: period.source_id,
    sourceName,
    period,
    monthLabel: formatCalendarMonthLabel(period.period_start),
    amounts,
    needsOpeningBalance: period.opening_balance == null,
    transactions,
  };
}

/** Replace opening_balance (edit, not accumulate). */
export async function updateVpBankPeriodOpeningBalance(
  periodId: number,
  openingBalance: number,
): Promise<TrackedSourcePeriod | null> {
  if (!Number.isInteger(openingBalance) || openingBalance < 0) {
    throw new Error('opening_balance must be a non-negative integer');
  }
  const existing = await getTrackedSourcePeriodById(periodId);
  if (!existing) return null;
  await setTrackedSourcePeriodOpeningBalance(periodId, openingBalance);
  return getTrackedSourcePeriodById(periodId);
}

/** Add a signed delta to adjustment_amount (does not replace). */
export async function addVpBankPeriodAdjustment(
  periodId: number,
  delta: number,
): Promise<TrackedSourcePeriod | null> {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error('adjustment delta must be a non-zero integer');
  }
  const existing = await getTrackedSourcePeriodById(periodId);
  if (!existing) return null;
  const next = accumulateTrackedSourceAdjustment(existing.adjustment_amount, delta);
  await setTrackedSourcePeriodAdjustmentAmount(periodId, next);
  return getTrackedSourcePeriodById(periodId);
}

/** Reset adjustment_amount to 0. */
export async function resetVpBankPeriodAdjustment(
  periodId: number,
): Promise<TrackedSourcePeriod | null> {
  const existing = await getTrackedSourcePeriodById(periodId);
  if (!existing) return null;
  await setTrackedSourcePeriodAdjustmentAmount(periodId, 0);
  return getTrackedSourcePeriodById(periodId);
}
