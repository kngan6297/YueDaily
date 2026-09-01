// ============================================================
// Household Food Budget — UI format helpers
// ============================================================

export function formatPeriodRangeShort(periodStart: string, periodEnd: string): string {
  const start = `${periodStart.slice(8, 10)}/${periodStart.slice(5, 7)}`;
  const end = `${periodEnd.slice(8, 10)}/${periodEnd.slice(5, 7)}`;
  return `${start} – ${end}`;
}

export const fmtVnd = (amount: number) => amount.toLocaleString('vi-VN');
