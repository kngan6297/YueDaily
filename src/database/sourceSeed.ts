// ============================================================
// Seed nguồn chi — idempotent, không merge / không rename lịch sử
// Tên dưới đây là example/default cho installation của Yue, không phải product enum.
// ============================================================

import type { SourceSpendingGroup } from '../types';

export const DEFAULT_SOURCE_SEEDS: readonly {
  name: string;
  spending_group: SourceSpendingGroup;
}[] = [
  { name: 'Woori · Quỹ ăn', spending_group: 'household' },
  { name: 'VPBank', spending_group: 'personal_yue' },
  { name: 'Tiền mặt Yue', spending_group: 'personal_yue' },
  { name: 'Tiền mặt Kai', spending_group: 'household' },
] as const;

/** Active example sources for a Yue installation. VCB Shop is historical — not seeded on fresh install. */
export const DEFAULT_SOURCE_SEED_NAMES = DEFAULT_SOURCE_SEEDS.map((s) => s.name);

/**
 * Exact-name classification for known current sources.
 * Legacy Tiền mặt / Chuyển khoản / VCB Shop are intentionally absent → stay unclassified.
 */
export const TRUSTED_SOURCE_SPENDING_GROUPS: Readonly<Record<string, SourceSpendingGroup>> = {
  VPBank: 'personal_yue',
  'Tiền mặt Yue': 'personal_yue',
  'Woori · Quỹ ăn': 'household',
  'Tiền mặt Kai': 'household',
};

export function spendingGroupForExactSourceName(name: string): SourceSpendingGroup | null {
  return TRUSTED_SOURCE_SPENDING_GROUPS[name.trim()] ?? null;
}

export function classifyTrustedSourceNames(
  sources: readonly { id: number; name: string }[],
): { id: number; spending_group: SourceSpendingGroup }[] {
  const out: { id: number; spending_group: SourceSpendingGroup }[] = [];
  for (const source of sources) {
    const group = spendingGroupForExactSourceName(source.name);
    if (group) out.push({ id: source.id, spending_group: group });
  }
  return out;
}

export function missingSourceSeeds(
  existingNames: readonly string[],
): { name: string; spending_group: SourceSpendingGroup }[] {
  const have = new Set(existingNames.map((n) => n.trim()).filter(Boolean));
  return DEFAULT_SOURCE_SEEDS.filter((s) => !have.has(s.name)).map((s) => ({
    name: s.name,
    spending_group: s.spending_group,
  }));
}

/** Tên nguồn còn thiếu so với seed — không đụng source đã có (kể cả "Tiền mặt"). */
export function missingSourceNames(existingNames: readonly string[]): string[] {
  return missingSourceSeeds(existingNames).map((s) => s.name);
}
