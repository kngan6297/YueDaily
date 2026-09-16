// ============================================================
// Household Food Budget — pure amount / status calculations
// available = limit_amount + carryover_amount; contribution uses limit only
// ============================================================

export type BudgetDisplayStatus = 'normal' | 'attention' | 'near_limit' | 'over';

export interface BudgetAmountSummary {
  limitAmount: number;
  carryoverAmount: number;
  availableAmount: number;
  spentAmount: number;
  remainingAmount: number;
  overAmount: number;
  progressRatio: number;
  progressPercent: number;
  status: BudgetDisplayStatus;
}

export function computeAvailableAmount(
  limitAmount: number,
  carryoverAmount = 0,
): number {
  const safeLimit = Number.isInteger(limitAmount) && limitAmount >= 0 ? limitAmount : 0;
  const safeCarry =
    Number.isInteger(carryoverAmount) && carryoverAmount >= 0 ? carryoverAmount : 0;
  return safeLimit + safeCarry;
}

export function computeBudgetAmountSummary(
  limitAmount: number,
  spentAmount: number,
  carryoverAmount = 0,
): BudgetAmountSummary {
  const safeLimit = Number.isInteger(limitAmount) && limitAmount >= 0 ? limitAmount : 0;
  const safeCarry =
    Number.isInteger(carryoverAmount) && carryoverAmount >= 0 ? carryoverAmount : 0;
  const availableAmount = safeLimit + safeCarry;
  const safeSpent = Number.isInteger(spentAmount) && spentAmount >= 0 ? spentAmount : 0;
  const delta = availableAmount - safeSpent;

  const remainingAmount = delta >= 0 ? delta : 0;
  const overAmount = delta < 0 ? Math.abs(delta) : 0;

  let progressRatio = 0;
  if (availableAmount > 0) {
    progressRatio = safeSpent / availableAmount;
  } else if (safeSpent > 0) {
    progressRatio = Number.POSITIVE_INFINITY;
  }

  const progressPercent =
    progressRatio === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : Math.round(progressRatio * 1000) / 10;

  return {
    limitAmount: safeLimit,
    carryoverAmount: safeCarry,
    availableAmount,
    spentAmount: safeSpent,
    remainingAmount,
    overAmount,
    progressRatio,
    progressPercent,
    status: budgetDisplayStatus(availableAmount, safeSpent),
  };
}

export function budgetDisplayStatus(
  availableAmount: number,
  spentAmount: number,
): BudgetDisplayStatus {
  if (availableAmount <= 0 && spentAmount > 0) return 'over';
  if (availableAmount <= 0) return 'normal';

  const ratio = spentAmount / availableAmount;
  if (ratio >= 1) return 'over';
  if (ratio >= 0.9) return 'near_limit';
  if (ratio >= 0.7) return 'attention';
  return 'normal';
}

/** Visual progress bar fill — clamped 0..1 for rendering only */
export function budgetProgressBarFill(progressRatio: number): number {
  if (!Number.isFinite(progressRatio)) return 1;
  if (progressRatio <= 0) return 0;
  if (progressRatio >= 1) return 1;
  return progressRatio;
}

export function formatBudgetProgressLabel(progressPercent: number): string {
  if (progressPercent === Number.POSITIVE_INFINITY) return '∞%';
  if (!Number.isFinite(progressPercent)) return '0%';
  return `${progressPercent.toLocaleString('vi-VN')}%`;
}
