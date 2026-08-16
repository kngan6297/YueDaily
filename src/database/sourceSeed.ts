// ============================================================
// Seed nguồn chi — idempotent, không merge / không rename lịch sử
// Tên dưới đây là example/default cho installation của Yue, không phải product enum.
// ============================================================

export const DEFAULT_SOURCE_SEED_NAMES = [
  'Woori · Quỹ ăn',
  'VPBank',
  'Tiền mặt Yue',
  'Tiền mặt Kai',
  'VCB Shop',
] as const;

/** Tên nguồn còn thiếu so với seed — không đụng source đã có (kể cả "Tiền mặt"). */
export function missingSourceNames(existingNames: readonly string[]): string[] {
  const have = new Set(existingNames.map((n) => n.trim()).filter(Boolean));
  return DEFAULT_SOURCE_SEED_NAMES.filter((name) => !have.has(name));
}
