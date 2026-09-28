// ============================================================
// Tracked-source balance — pure amount calculations
// current = opening + income − expense + adjustment
// Opening null → balance unknown (do not assume 0)
// ============================================================

export interface TrackedSourceBalanceAmounts {
  openingBalance: number;
  incomeAmount: number;
  expenseAmount: number;
  adjustmentAmount: number;
  currentBalance: number;
}

function safeNonNegativeInt(value: number): number {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

/** Signed integer adjustment. Invalid → 0. */
function safeAdjustmentInt(value: number): number {
  return Number.isInteger(value) ? value : 0;
}

/** Accumulate a signed delta onto the current adjustment (pure). Same semantics as Woori. */
export function accumulateTrackedSourceAdjustment(
  currentAdjustment: number,
  delta: number,
): number {
  const current = safeAdjustmentInt(currentAdjustment);
  if (!Number.isInteger(delta)) {
    throw new Error('adjustment delta must be an integer');
  }
  return current + delta;
}

/**
 * Compute balance when opening is known.
 * Returns null when opening_balance is null/undefined (UI: "Chưa nhập số dư đầu kỳ").
 */
export function computeTrackedSourceBalance(
  openingBalance: number | null | undefined,
  incomeAmount: number,
  expenseAmount: number,
  adjustmentAmount = 0,
): TrackedSourceBalanceAmounts | null {
  if (openingBalance == null || !Number.isInteger(openingBalance)) {
    return null;
  }
  const income = safeNonNegativeInt(incomeAmount);
  const expense = safeNonNegativeInt(expenseAmount);
  const adjust = safeAdjustmentInt(adjustmentAmount);
  return {
    openingBalance,
    incomeAmount: income,
    expenseAmount: expense,
    adjustmentAmount: adjust,
    currentBalance: openingBalance + income - expense + adjust,
  };
}
