// ============================================================
// Household Food Budget — pure amount / status calculations (P1.6B)
// ============================================================

export type BudgetDisplayStatus = 'normal' | 'attention' | 'near_limit' | 'over';

export interface BudgetAmountSummary {
  limitAmount: number;
  spentAmount: number;
  remainingAmount: number;
  overAmount: number;
  progressRatio: number;
  progressPercent: number;
  status: BudgetDisplayStatus;
}

export function computeBudgetAmountSummary(
  limitAmount: number,
  spentAmount: number,
): BudgetAmountSummary {
  const safeLimit = Number.isInteger(limitAmount) && limitAmount >= 0 ? limitAmount : 0;
  const safeSpent = Number.isInteger(spentAmount) && spentAmount >= 0 ? spentAmount : 0;
  const delta = safeLimit - safeSpent;

  const remainingAmount = delta >= 0 ? delta : 0;
  const overAmount = delta < 0 ? Math.abs(delta) : 0;

  let progressRatio = 0;
  if (safeLimit > 0) {
    progressRatio = safeSpent / safeLimit;
  } else if (safeSpent > 0) {
    progressRatio = Number.POSITIVE_INFINITY;
  }

  const progressPercent =
    progressRatio === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : Math.round(progressRatio * 1000) / 10;

  return {
    limitAmount: safeLimit,
    spentAmount: safeSpent,
    remainingAmount,
    overAmount,
    progressRatio,
    progressPercent,
    status: budgetDisplayStatus(safeLimit, safeSpent),
  };
}

export function budgetDisplayStatus(limitAmount: number, spentAmount: number): BudgetDisplayStatus {
  if (limitAmount <= 0 && spentAmount > 0) return 'over';
  if (limitAmount <= 0) return 'normal';

  const ratio = spentAmount / limitAmount;
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
