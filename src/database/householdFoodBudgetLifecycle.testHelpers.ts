/** Pure helper mirroring findBudgetPeriodContainingDate SQL semantics for tests */
export function findBudgetPeriodContainingDatePure(
  periods: readonly { period_start: string; period_end: string }[],
  date: string,
): { period_start: string; period_end: string } | null {
  const matches = periods.filter((p) => p.period_start <= date && p.period_end >= date);
  if (matches.length === 0) return null;
  return matches.sort((a, b) => (a.period_start < b.period_start ? 1 : -1))[0];
}
