// ============================================================
// P1.8A — Read-only spending tools (wrap existing report/budget APIs)
// ============================================================

import { HOUSEHOLD_FOOD_BUDGET_KEY } from '../../../constants/budget';
import {
  findBudgetPeriodContainingDate,
  getBudgetPeriodById,
} from '../../../database/budgetPeriods';
import { getHouseholdFoodBudgetSummaryForPeriod } from '../../../database/householdFoodBudgetRead';
import {
  getExpenseAudienceTotals,
  getExpenseCategoryTotals,
  getExpenseSourceTotals,
  getExpenseSummary,
  type ExpenseSummary,
  type NamedAmount,
  type ReportFilters,
  type ReportRange,
} from '../../../database/reportQueries';
import { resolveReportRange } from '../../../database/reportCalculations';
import { getDatabase } from '../../../database/initDb';
import {
  ensureVpBankBalancePeriod,
  loadVpBankBalanceHomeCard,
} from '../../../database/trackedSourceBalanceRead';
import { TRANSACTION_STATUS_COMPLETE } from '../../../types';
import { daysInMonth } from '../../../utils/date';
import {
  parseFilters,
  parseYearMonth,
  type SpendingChatFilters,
  type SpendingChatToolName,
  type ToolCallRequest,
} from './allowlist';
import { needsCustomQuery } from './pureHelpers';
import type { ToolResult } from './types';
import {
  toSafeTransactionDto,
  type SafeTransactionDto,
} from '../safeDto';

export type { ToolResult } from './types';
export { needsCustomQuery, previousMonth, compareSummaries, vpBankNullOpeningSemantics } from './pureHelpers';
export type { SpendingChatFilters, SpendingChatToolName, ToolCallRequest } from './allowlist';
export {
  isAllowedToolName,
  MAX_TOOL_CALLS_PER_TURN,
  parseFilters,
  parseYearMonth,
  validateToolCalls,
  SPENDING_CHAT_TOOL_NAMES,
} from './allowlist';

function monthRange(year: number, month: number): ReportRange {
  return { kind: 'month', year, month };
}

function toReportFilters(filters: SpendingChatFilters): ReportFilters {
  return {
    sourceId: filters.sourceId,
    audience: filters.audience,
    search: filters.search,
  };
}

async function querySafeTransactions(opts: {
  year: number;
  month: number;
  filters: SpendingChatFilters;
  orderBy?: 'amount_desc' | 'date_desc';
  limit?: number;
}): Promise<SafeTransactionDto[]> {
  const db = await getDatabase();
  const resolved = resolveReportRange(monthRange(opts.year, opts.month));
  const params: (string | number)[] = [resolved.fromDate, resolved.toDate];
  let where = `t.status = '${TRANSACTION_STATUS_COMPLETE}' AND t.type = 'chi'
    AND date(t.created_at) >= date(?) AND date(t.created_at) <= date(?)`;

  const rf = toReportFilters(opts.filters);
  if (typeof rf.sourceId === 'number') {
    where += ' AND t.source_id = ?';
    params.push(rf.sourceId);
  }
  if (rf.audience && rf.audience !== 'all') {
    where += ' AND t.expense_audience = ?';
    params.push(rf.audience);
  }
  if (opts.filters.categoryNames && opts.filters.categoryNames.length > 0) {
    const placeholders = opts.filters.categoryNames.map(() => '?').join(',');
    where += ` AND c.name IN (${placeholders})`;
    params.push(...opts.filters.categoryNames);
  }
  if (opts.filters.transactionIds && opts.filters.transactionIds.length > 0) {
    const placeholders = opts.filters.transactionIds.map(() => '?').join(',');
    where += ` AND t.id IN (${placeholders})`;
    params.push(...opts.filters.transactionIds);
  }
  if (opts.filters.excludedTransactionIds && opts.filters.excludedTransactionIds.length > 0) {
    const placeholders = opts.filters.excludedTransactionIds.map(() => '?').join(',');
    where += ` AND t.id NOT IN (${placeholders})`;
    params.push(...opts.filters.excludedTransactionIds);
  }
  if (rf.search?.trim()) {
    const q = `%${rf.search.trim().toLowerCase()}%`;
    where += ` AND (
      lower(COALESCE(t.note,'')) LIKE ? OR
      lower(COALESCE(c.name,'')) LIKE ?
    )`;
    params.push(q, q);
  }

  const order =
    opts.orderBy === 'amount_desc'
      ? 'ORDER BY t.amount DESC, t.created_at DESC, t.id DESC'
      : 'ORDER BY t.created_at DESC, t.id DESC';

  const limitClause =
    typeof opts.limit === 'number' && opts.limit > 0 ? ` LIMIT ${Math.min(opts.limit, 200)}` : '';

  const rows = await db.getAllAsync<{
    id: number;
    amount: number;
    type: string;
    created_at: string;
    expense_audience: string;
    note: string | null;
    category_name: string | null;
    source_name: string | null;
  }>(
    `SELECT t.id, t.amount, t.type, t.created_at, t.expense_audience, t.note,
            c.name AS category_name, s.name AS source_name
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN sources s ON t.source_id = s.id
     WHERE ${where}
     ${order}${limitClause};`,
    params,
  );

  return rows.map(toSafeTransactionDto);
}

async function summaryWithExclusions(
  year: number,
  month: number,
  filters: SpendingChatFilters,
): Promise<ExpenseSummary> {
  if (!needsCustomQuery(filters)) {
    return getExpenseSummary(monthRange(year, month), toReportFilters(filters));
  }
  const txs = await querySafeTransactions({ year, month, filters });
  const totalChi = txs.reduce((s, t) => s + t.amount, 0);
  const transactionCount = txs.length;
  const resolved = resolveReportRange(monthRange(year, month));
  const averagePerTransaction =
    transactionCount > 0 ? Math.round(totalChi / transactionCount) : 0;
  const averagePerDay =
    resolved.calendarDays > 0 ? Math.round(totalChi / resolved.calendarDays) : 0;
  return {
    totalChi,
    transactionCount,
    averagePerTransaction,
    averagePerDay,
    calendarDays: resolved.calendarDays,
  };
}

export async function executeGetPeriodSummary(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const ym = parseYearMonth(args);
  if (!ym) return { tool: 'getPeriodSummary', ok: false, error: 'invalid year/month' };
  const filters = parseFilters(args.filters);
  const summary = await summaryWithExclusions(ym.year, ym.month, filters);
  return {
    tool: 'getPeriodSummary',
    ok: true,
    data: {
      year: ym.year,
      month: ym.month,
      ...summary,
      periodStart: `${ym.year}-${String(ym.month).padStart(2, '0')}-01`,
      periodEnd: `${ym.year}-${String(ym.month).padStart(2, '0')}-${String(daysInMonth(ym.year, ym.month)).padStart(2, '0')}`,
    },
  };
}

export async function executeGetBreakdown(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const ym = parseYearMonth(args);
  if (!ym) return { tool: 'getBreakdown', ok: false, error: 'invalid year/month' };
  const dimension = args.dimension;
  if (dimension !== 'category' && dimension !== 'source' && dimension !== 'audience') {
    return { tool: 'getBreakdown', ok: false, error: 'invalid dimension' };
  }
  const filters = parseFilters(args.filters);
  const range = monthRange(ym.year, ym.month);
  const rf = toReportFilters(filters);

  let rows: NamedAmount[];
  if (needsCustomQuery(filters)) {
    const txs = await querySafeTransactions({ year: ym.year, month: ym.month, filters });
    const map = new Map<string, number>();
    for (const t of txs) {
      const key =
        dimension === 'category'
          ? t.categoryName ?? 'Không rõ danh mục'
          : dimension === 'source'
            ? t.sourceName ?? 'Không rõ nguồn'
            : t.expenseAudience;
      map.set(key, (map.get(key) ?? 0) + t.amount);
    }
    rows = [...map.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  } else if (dimension === 'category') {
    rows = await getExpenseCategoryTotals(range, rf);
  } else if (dimension === 'source') {
    rows = await getExpenseSourceTotals(range, rf);
  } else {
    rows = await getExpenseAudienceTotals(range, rf);
  }

  return {
    tool: 'getBreakdown',
    ok: true,
    data: { year: ym.year, month: ym.month, dimension, rows },
  };
}

export async function executeGetTransactions(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const ym = parseYearMonth(args);
  if (!ym) return { tool: 'getTransactions', ok: false, error: 'invalid year/month' };
  const filters = parseFilters(args.filters);
  if (Array.isArray(args.transactionIds)) {
    filters.transactionIds = args.transactionIds.filter(
      (id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0,
    );
  }
  if (Array.isArray(args.excludedTransactionIds)) {
    filters.excludedTransactionIds = args.excludedTransactionIds.filter(
      (id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0,
    );
  }
  if (typeof args.search === 'string') filters.search = args.search;
  const limit =
    typeof args.limit === 'number' && Number.isInteger(args.limit) && args.limit > 0
      ? Math.min(args.limit, 100)
      : 30;

  const transactions = await querySafeTransactions({
    year: ym.year,
    month: ym.month,
    filters,
    orderBy: 'date_desc',
    limit,
  });

  return {
    tool: 'getTransactions',
    ok: true,
    data: { year: ym.year, month: ym.month, transactions, count: transactions.length },
  };
}

export async function executeGetLargestTransactions(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const ym = parseYearMonth(args);
  if (!ym) {
    return { tool: 'getLargestTransactions', ok: false, error: 'invalid year/month' };
  }
  const filters = parseFilters(args.filters);
  const limit =
    typeof args.limit === 'number' && Number.isInteger(args.limit) && args.limit > 0
      ? Math.min(args.limit, 50)
      : 10;

  // Authoritative complete-month read ordered by amount — not the LIMIT-50 display list.
  const transactions = await querySafeTransactions({
    year: ym.year,
    month: ym.month,
    filters,
    orderBy: 'amount_desc',
    limit,
  });

  return {
    tool: 'getLargestTransactions',
    ok: true,
    data: { year: ym.year, month: ym.month, transactions, limit },
  };
}

export async function executeComparePeriods(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const primary = parseYearMonth({
    year: args.primaryYear ?? args.year,
    month: args.primaryMonth ?? args.month,
  });
  const comparison = parseYearMonth({
    year: args.comparisonYear,
    month: args.comparisonMonth,
  });
  if (!primary || !comparison) {
    return { tool: 'comparePeriods', ok: false, error: 'invalid periods' };
  }
  const filters = parseFilters(args.filters);
  const a = await summaryWithExclusions(primary.year, primary.month, filters);
  const b = await summaryWithExclusions(comparison.year, comparison.month, filters);
  return {
    tool: 'comparePeriods',
    ok: true,
    data: {
      primary: { year: primary.year, month: primary.month, ...a },
      comparison: { year: comparison.year, month: comparison.month, ...b },
      deltaTotalChi: a.totalChi - b.totalChi,
      deltaTransactionCount: a.transactionCount - b.transactionCount,
    },
  };
}

export async function executeGetWooriBudget(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const mode = args.mode;
  if (mode !== 'budget_cycle' && mode !== 'calendar_month') {
    return { tool: 'getWooriBudget', ok: false, error: 'invalid mode' };
  }

  if (mode === 'budget_cycle') {
    let referenceDate: string;
    if (typeof args.referenceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.referenceDate)) {
      referenceDate = args.referenceDate;
    } else {
      const ym = parseYearMonth(args);
      if (!ym) {
        return { tool: 'getWooriBudget', ok: false, error: 'invalid reference' };
      }
      // Mid-month date is safely inside a typical 05→04 cycle for that calendar month.
      referenceDate = `${ym.year}-${String(ym.month).padStart(2, '0')}-15`;
    }

    const period = await findBudgetPeriodContainingDate(
      HOUSEHOLD_FOOD_BUDGET_KEY,
      referenceDate,
    );
    if (!period) {
      return {
        tool: 'getWooriBudget',
        ok: true,
        data: {
          mode: 'budget_cycle',
          found: false,
          referenceDate,
          message: 'No Woori budget period for this reference date.'
        },
      };
    }
    const summary = await getHouseholdFoodBudgetSummaryForPeriod(period.id);
    if (!summary) {
      return { tool: 'getWooriBudget', ok: false, error: 'period summary missing' };
    }
    return {
      tool: 'getWooriBudget',
      ok: true,
      data: {
        mode: 'budget_cycle',
        found: true,
        period_start: summary.period.period_start,
        period_end: summary.period.period_end,
        limit: summary.period.limit_amount,
        carryover: summary.period.carryover_amount,
        adjustment: summary.period.adjustment_amount,
        available: summary.amounts.availableAmount,
        spent: summary.amounts.spentAmount,
        remaining: summary.amounts.remainingAmount,
        envelope_source_id: summary.period.envelope_source_id,
      },
    };
  }

  // calendar_month: spending from persisted Woori envelope source ID inside 01→last day
  const ym = parseYearMonth(args);
  if (!ym) return { tool: 'getWooriBudget', ok: false, error: 'invalid year/month' };

  const mid = `${ym.year}-${String(ym.month).padStart(2, '0')}-15`;
  let envelopeSourceId: number | null = null;
  const containing = await findBudgetPeriodContainingDate(HOUSEHOLD_FOOD_BUDGET_KEY, mid);
  if (containing?.envelope_source_id != null) {
    envelopeSourceId = containing.envelope_source_id;
  } else if (containing) {
    const refreshed = await getBudgetPeriodById(containing.id);
    envelopeSourceId = refreshed?.envelope_source_id ?? null;
  }

  if (envelopeSourceId == null) {
    return {
      tool: 'getWooriBudget',
      ok: true,
      data: {
        mode: 'calendar_month',
        found: false,
        year: ym.year,
        month: ym.month,
        message: 'Chưa có envelope_source_id Woori để tính chi lịch tháng.',
      },
    };
  }

  const summary = await getExpenseSummary(monthRange(ym.year, ym.month), {
    sourceId: envelopeSourceId,
  });

  return {
    tool: 'getWooriBudget',
    ok: true,
    data: {
      mode: 'calendar_month',
      found: true,
      year: ym.year,
      month: ym.month,
      envelope_source_id: envelopeSourceId,
      spent: summary.totalChi,
      transactionCount: summary.transactionCount,
      periodStart: `${ym.year}-${String(ym.month).padStart(2, '0')}-01`,
      periodEnd: `${ym.year}-${String(ym.month).padStart(2, '0')}-${String(daysInMonth(ym.year, ym.month)).padStart(2, '0')}`,
    },
  };
}

export async function executeGetTrackedSourceBalance(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const ym = parseYearMonth(args);
  if (!ym) {
    return { tool: 'getTrackedSourceBalance', ok: false, error: 'invalid year/month' };
  }
  const referenceDate = `${ym.year}-${String(ym.month).padStart(2, '0')}-15`;
  await ensureVpBankBalancePeriod(referenceDate);
  const card = await loadVpBankBalanceHomeCard(referenceDate);
  if (!card) {
    return {
      tool: 'getTrackedSourceBalance',
      ok: true,
      data: {
        found: false,
        year: ym.year,
        month: ym.month,
        message: 'Không tìm thấy VPBank tracked source.',
      },
    };
  }

  const opening = card.period.opening_balance;
  const needsOpeningBalance = opening == null;

  let income = card.amounts?.incomeAmount ?? null;
  let expense = card.amounts?.expenseAmount ?? null;

  // When opening is NULL, amounts is null — still return membership income/expense.
  if (needsOpeningBalance) {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ income: number; expense: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN t.type = 'thu' THEN t.amount ELSE 0 END), 0) AS income,
         COALESCE(SUM(CASE WHEN t.type = 'chi' THEN t.amount ELSE 0 END), 0) AS expense
       FROM transactions t
       WHERE t.status = '${TRANSACTION_STATUS_COMPLETE}'
         AND t.source_id = ?
         AND date(t.created_at) >= date(?)
         AND date(t.created_at) <= date(?);`,
      [card.sourceId, card.period.period_start, card.period.period_end],
    );
    income = row?.income ?? 0;
    expense = row?.expense ?? 0;
  }

  return {
    tool: 'getTrackedSourceBalance',
    ok: true,
    data: {
      found: true,
      year: ym.year,
      month: ym.month,
      sourceName: card.sourceName,
      period_start: card.period.period_start,
      period_end: card.period.period_end,
      opening_balance: opening,
      income,
      expense,
      adjustment: card.period.adjustment_amount,
      current_balance: needsOpeningBalance ? null : card.amounts?.currentBalance ?? null,
      needsOpeningBalance,
    },
  };
}

/**
 * App-side unusual spending facts — not formal anomaly detection.
 * AI may describe as "đáng chú ý" / "tăng mạnh" only from these facts.
 */
export async function executeGetUnusualSpendingFacts(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const ym = parseYearMonth(args);
  if (!ym) {
    return { tool: 'getUnusualSpendingFacts', ok: false, error: 'invalid year/month' };
  }
  const filters = parseFilters(args.filters);
  const prevMonth = ym.month === 1 ? 12 : ym.month - 1;
  const prevYear = ym.month === 1 ? ym.year - 1 : ym.year;

  const [catNow, catPrev, largest, summary] = await Promise.all([
    executeGetBreakdown({
      year: ym.year,
      month: ym.month,
      dimension: 'category',
      filters,
    }),
    executeGetBreakdown({
      year: prevYear,
      month: prevMonth,
      dimension: 'category',
      filters,
    }),
    executeGetLargestTransactions({
      year: ym.year,
      month: ym.month,
      filters,
      limit: 5,
    }),
    summaryWithExclusions(ym.year, ym.month, filters),
  ]);

  const nowRows = (catNow.data as { rows?: NamedAmount[] } | undefined)?.rows ?? [];
  const prevRows = (catPrev.data as { rows?: NamedAmount[] } | undefined)?.rows ?? [];
  const prevMap = new Map(prevRows.map((r) => [r.name, r.amount]));

  const categoryDeltas = nowRows.slice(0, 8).map((r) => {
    const prev = prevMap.get(r.name) ?? 0;
    return {
      category: r.name,
      amount: r.amount,
      priorMonthAmount: prev,
      delta: r.amount - prev,
    };
  });

  const avg =
    summary.transactionCount > 0
      ? summary.totalChi / summary.transactionCount
      : 0;
  const largestTxs =
    (largest.data as { transactions?: SafeTransactionDto[] } | undefined)?.transactions ??
    [];
  const vsAverage = largestTxs.map((t) => ({
    id: t.id,
    amount: t.amount,
    categoryName: t.categoryName,
    note: t.note,
    ratioToMonthAverage: avg > 0 ? Number((t.amount / avg).toFixed(2)) : null,
  }));

  return {
    tool: 'getUnusualSpendingFacts',
    ok: true,
    data: {
      year: ym.year,
      month: ym.month,
      comparison: { year: prevYear, month: prevMonth },
      monthAveragePerTransaction: Math.round(avg),
      categoryDeltas,
      largestVsAverage: vsAverage,
      note: 'Heuristic facts only — not formal anomaly detection.',
    },
  };
}

export async function executeToolCall(call: ToolCallRequest): Promise<ToolResult> {
  switch (call.name) {
    case 'getPeriodSummary':
      return executeGetPeriodSummary(call.args);
    case 'getBreakdown':
      return executeGetBreakdown(call.args);
    case 'getTransactions':
      return executeGetTransactions(call.args);
    case 'getLargestTransactions':
      return executeGetLargestTransactions(call.args);
    case 'comparePeriods':
      return executeComparePeriods(call.args);
    case 'getWooriBudget':
      return executeGetWooriBudget(call.args);
    case 'getTrackedSourceBalance':
      return executeGetTrackedSourceBalance(call.args);
    case 'getUnusualSpendingFacts':
      return executeGetUnusualSpendingFacts(call.args);
    default:
      return {
        tool: call.name,
        ok: false,
        error: 'unknown tool',
      };
  }
}

export async function executeToolCalls(calls: ToolCallRequest[]): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  for (const call of calls) {
    try {
      results.push(await executeToolCall(call));
    } catch (err) {
      results.push({
        tool: call.name,
        ok: false,
        error: err instanceof Error ? err.message : 'tool failed',
      });
    }
  }
  return results;
}
