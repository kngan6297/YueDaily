// ============================================================
// Household Food Budget — read repository + lifecycle orchestration (P1.6B)
// Stored budget_periods rows are the only aggregation authority
// ============================================================

import { plannedContributionAmounts, HOUSEHOLD_FOOD_BUDGET_KEY } from '../constants/budget';
import {
  computeBudgetAmountSummary,
  type BudgetAmountSummary,
} from './householdFoodBudgetCalculations';
import {
  decideContinuingPeriodCreation,
  resolveBudgetCardPhase,
  type BudgetCardPhase,
} from './householdFoodBudgetLifecycle';
import { householdFoodBudgetMembershipWhere } from './householdFoodBudgetSql';
import {
  ensureHouseholdFoodPeriodForStart,
  findBudgetPeriodContainingDate,
  findNextBudgetPeriodAfterDate,
  getBudgetPeriodById,
  getBudgetPeriodByStart,
  getLatestConfiguredBudgetPeriod,
  updateBudgetPeriodLimit,
} from './budgetPeriods';
import { getDatabase } from './initDb';
import type { BudgetPeriod } from '../types';
import { EXPENSE_AUDIENCE_LABELS, type ExpenseAudience } from '../types';
import { dateFromCreatedAt } from '../utils/date';

export interface HouseholdFoodBudgetCategoryBreakdownRow {
  category_id: number;
  category_name: string;
  category_icon: string;
  amount: number;
  shareOfSpent: number;
}

export interface HouseholdFoodBudgetTransactionRow {
  id: number;
  amount: number;
  transaction_date: string;
  category_name: string;
  category_icon: string;
  source_name: string;
  expense_audience_label: string;
  note: string | null;
}

export interface HouseholdFoodBudgetDetailData {
  period: BudgetPeriod;
  amounts: BudgetAmountSummary;
  plannedContribution: ReturnType<typeof plannedContributionAmounts>;
  breakdown: HouseholdFoodBudgetCategoryBreakdownRow[];
  transactions: HouseholdFoodBudgetTransactionRow[];
}

export interface HouseholdFoodBudgetHomeCardData {
  referenceDate: string;
  phase: BudgetCardPhase;
  period: BudgetPeriod | null;
  upcomingPeriod: BudgetPeriod | null;
  amounts: BudgetAmountSummary | null;
  plannedContribution: ReturnType<typeof plannedContributionAmounts> | null;
}

const membership = householdFoodBudgetMembershipWhere();

function membershipParams(period: BudgetPeriod): number[] | string[] | (number | string)[] {
  return [period.envelope_source_id as number, period.period_start, period.period_end];
}

async function sumSpentForStoredPeriod(period: BudgetPeriod): Promise<number> {
  if (period.envelope_source_id == null) return 0;
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(t.amount), 0) AS total
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN sources s ON s.id = t.source_id
     WHERE ${membership};`,
    membershipParams(period),
  );
  return row?.total ?? 0;
}

export async function getHouseholdFoodBudgetSummaryForPeriod(
  periodId: number,
): Promise<{ period: BudgetPeriod; amounts: BudgetAmountSummary } | null> {
  const period = await getBudgetPeriodById(periodId);
  if (!period) return null;
  const spentAmount = await sumSpentForStoredPeriod(period);
  return {
    period,
    amounts: computeBudgetAmountSummary(
      period.limit_amount,
      spentAmount,
      period.carryover_amount,
    ),
  };
}

export async function getHouseholdFoodBudgetBreakdownForPeriod(
  periodId: number,
): Promise<HouseholdFoodBudgetCategoryBreakdownRow[]> {
  const period = await getBudgetPeriodById(periodId);
  if (!period || period.envelope_source_id == null) return [];

  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    category_id: number;
    category_name: string;
    category_icon: string;
    total: number;
  }>(
    `SELECT COALESCE(c.id, 0) AS category_id,
            COALESCE(c.name, 'Không rõ') AS category_name,
            COALESCE(c.icon, '💰') AS category_icon,
            COALESCE(SUM(t.amount), 0) AS total
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN sources s ON s.id = t.source_id
     WHERE ${membership}
     GROUP BY c.id, c.name, c.icon
     ORDER BY total DESC, category_name ASC;`,
    membershipParams(period),
  );

  const spentTotal = rows.reduce((sum, row) => sum + row.total, 0);
  return rows.map((row) => ({
    category_id: row.category_id,
    category_name: row.category_name,
    category_icon: row.category_icon,
    amount: row.total,
    shareOfSpent: spentTotal > 0 ? row.total / spentTotal : 0,
  }));
}

export async function getHouseholdFoodBudgetTransactionsForPeriod(
  periodId: number,
): Promise<HouseholdFoodBudgetTransactionRow[]> {
  const period = await getBudgetPeriodById(periodId);
  if (!period || period.envelope_source_id == null) return [];

  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    amount: number;
    created_at: string;
    category_name: string | null;
    category_icon: string | null;
    source_name: string | null;
    expense_audience: ExpenseAudience;
    note: string | null;
  }>(
    `SELECT t.id,
            t.amount,
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
    transaction_date: dateFromCreatedAt(row.created_at),
    category_name: row.category_name ?? 'Không rõ',
    category_icon: row.category_icon ?? '💰',
    source_name: row.source_name ?? 'Không rõ nguồn',
    expense_audience_label:
      EXPENSE_AUDIENCE_LABELS[row.expense_audience] ?? EXPENSE_AUDIENCE_LABELS.unspecified,
    note: row.note,
  }));
}

export async function loadHouseholdFoodBudgetDetail(
  periodId: number,
): Promise<HouseholdFoodBudgetDetailData | null> {
  const summary = await getHouseholdFoodBudgetSummaryForPeriod(periodId);
  if (!summary) return null;

  const [breakdown, transactions] = await Promise.all([
    getHouseholdFoodBudgetBreakdownForPeriod(periodId),
    getHouseholdFoodBudgetTransactionsForPeriod(periodId),
  ]);

  return {
    period: summary.period,
    amounts: summary.amounts,
    plannedContribution: plannedContributionAmounts(summary.period.limit_amount),
    breakdown,
    transactions,
  };
}

export type BudgetContinuationResult =
  | { action: 'none' }
  | { action: 'existing'; period: BudgetPeriod }
  | { action: 'created'; period: BudgetPeriod };

/** Explicit lifecycle step — may persist one continuing period; never aggregates */
export async function ensureContinuingHouseholdFoodBudgetPeriod(
  referenceDate: string,
): Promise<BudgetContinuationResult> {
  const active = await findBudgetPeriodContainingDate(
    HOUSEHOLD_FOOD_BUDGET_KEY,
    referenceDate,
  );
  if (active) {
    return { action: 'existing', period: active };
  }

  const latest = await getLatestConfiguredBudgetPeriod(HOUSEHOLD_FOOD_BUDGET_KEY);
  const decision = decideContinuingPeriodCreation(referenceDate, false, latest);
  if (!decision.shouldCreate || !decision.targetPeriodStart) {
    return { action: 'none' };
  }

  const before = await getBudgetPeriodByStart(
    HOUSEHOLD_FOOD_BUDGET_KEY,
    decision.targetPeriodStart,
  );
  const period = await ensureHouseholdFoodPeriodForStart(decision.targetPeriodStart);
  return before ? { action: 'existing', period } : { action: 'created', period };
}

/** Read-only card loader — does not mutate budget_periods */
export async function loadHouseholdFoodBudgetHomeCard(
  referenceDate: string,
): Promise<HouseholdFoodBudgetHomeCardData> {
  const activePeriod = await findBudgetPeriodContainingDate(
    HOUSEHOLD_FOOD_BUDGET_KEY,
    referenceDate,
  );
  const upcomingPeriod = activePeriod
    ? null
    : await findNextBudgetPeriodAfterDate(HOUSEHOLD_FOOD_BUDGET_KEY, referenceDate);

  if (activePeriod) {
    const spentAmount = await sumSpentForStoredPeriod(activePeriod);
    const amounts = computeBudgetAmountSummary(
      activePeriod.limit_amount,
      spentAmount,
      activePeriod.carryover_amount,
    );
    return {
      referenceDate,
      phase: resolveBudgetCardPhase(referenceDate, activePeriod, null, amounts),
      period: activePeriod,
      upcomingPeriod: null,
      amounts,
      plannedContribution: plannedContributionAmounts(activePeriod.limit_amount),
    };
  }

  if (upcomingPeriod) {
    return {
      referenceDate,
      phase: resolveBudgetCardPhase(referenceDate, null, upcomingPeriod, null),
      period: null,
      upcomingPeriod,
      amounts: null,
      plannedContribution: plannedContributionAmounts(upcomingPeriod.limit_amount),
    };
  }

  return {
    referenceDate,
    phase: 'no_period',
    period: null,
    upcomingPeriod: null,
    amounts: null,
    plannedContribution: null,
  };
}

export async function updateHouseholdFoodBudgetPeriodLimit(
  periodId: number,
  limitAmount: number,
): Promise<BudgetPeriod | null> {
  if (!Number.isInteger(limitAmount) || limitAmount < 0) {
    throw new Error('limit_amount must be a non-negative integer');
  }
  const existing = await getBudgetPeriodById(periodId);
  if (!existing) return null;
  await updateBudgetPeriodLimit(periodId, limitAmount);
  return getBudgetPeriodById(periodId);
}
