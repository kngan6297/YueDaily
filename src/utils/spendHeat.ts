// Calendar heatmap — daily spend tiers and compact amounts (pure, testable).

export type SpendTier = 'none' | 'low' | 'mid' | 'high';

export interface SpendThresholds {
  /** Below this (đ) is "low". */
  low: number;
  /** Above this (đ) is "high"; between is "mid". */
  high: number;
}

export const DEFAULT_SPEND_THRESHOLDS: SpendThresholds = { low: 100_000, high: 500_000 };

export function spendTier(amount: number, t: SpendThresholds): SpendTier {
  if (!(amount > 0)) return 'none';
  if (amount < t.low) return 'low';
  if (amount <= t.high) return 'mid';
  return 'high';
}

export function isValidThresholds(t: SpendThresholds): boolean {
  return Number.isFinite(t.low) && Number.isFinite(t.high) && t.low > 0 && t.high > t.low;
}

function trimDecimal(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '');
}

/** 31_000 → "31k", 1_250_000 → "1.3M", 12_000_000 → "12M". Max ~4 chars for calendar cells. */
export function formatCompactVnd(amount: number): string {
  const n = Math.max(0, Math.round(amount));
  if (n < 1_000) return String(n);
  const k = Math.round(n / 1_000);
  if (k < 1_000) return `${k}k`;
  const m = n / 1_000_000;
  if (m < 10) return `${trimDecimal(m)}M`;
  return `${Math.round(m)}M`;
}
