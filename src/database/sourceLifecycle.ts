// ============================================================
// Source lifecycle — active vs archived (generic, không hardcode form theo tên)
// ============================================================

import type { Source } from '../types/index';

/**
 * Exact names of sources this app historically seeded.
 * Migration archives by exact match only — no fuzzy, no rename, no merge.
 * Custom user sources with similar names are left untouched.
 */
export const LEGACY_SEEDED_SOURCE_NAMES = [
  'Tiền mặt',
  'Chuyển khoản',
  'VCB Shop',
] as const;

export function isSourceActive(source: { is_active?: unknown }): boolean {
  return source.is_active !== 0 && source.is_active !== false;
}

/** SQLite INTEGER 1/0. Missing/invalid backup field → active. */
export function normalizeSourceIsActive(value: unknown): number {
  if (value === undefined || value === null) return 1;
  if (value === 0 || value === false || value === '0') return 0;
  if (value === 1 || value === true || value === '1') return 1;
  return 1;
}

export function sourceIdsToArchiveOnUpgrade(
  sources: readonly { id: number; name: string }[],
): number[] {
  const legacy = new Set<string>(LEGACY_SEEDED_SOURCE_NAMES);
  return sources.filter((s) => legacy.has(s.name.trim())).map((s) => s.id);
}

/**
 * Create: active only.
 * Edit: current archived source (if any) + all active — so history stays representable.
 */
export function pickerSources(
  sources: readonly Source[],
  mode: 'create' | 'edit',
  currentSourceId: number | null,
): Source[] {
  const active = sources.filter(isSourceActive);
  if (mode === 'create' || currentSourceId == null) return active;
  const current = sources.find((s) => s.id === currentSourceId);
  if (!current || isSourceActive(current)) return active;
  return [current, ...active.filter((s) => s.id !== current.id)];
}

/** Last-selected archived source must not become the default for a new transaction. */
export function resolveCreateSourceId(
  activeSources: readonly Source[],
  lastSelectedId: number | null,
): number | null {
  if (
    lastSelectedId != null &&
    activeSources.some((s) => s.id === lastSelectedId && isSourceActive(s))
  ) {
    return lastSelectedId;
  }
  return activeSources[0]?.id ?? null;
}

/** v1 backups have no is_active; archive exact legacy seeds after restore. v2+ preserves stored state. */
export function shouldArchiveLegacySeedsAfterRestore(backupVersion: string): boolean {
  return backupVersion === '1';
}

/** v1/v2 không có spending_group — classify exact trusted names. v3 preserves stored value. */
export function shouldClassifyTrustedSpendingGroupsAfterRestore(backupVersion: string): boolean {
  return backupVersion === '1' || backupVersion === '2';
}

/** v1–v3: one-time VCB Shop NULL → household after restore */
export function shouldMigrateVcbShopAfterRestore(backupVersion: string): boolean {
  return backupVersion === '1' || backupVersion === '2' || backupVersion === '3';
}

/** v1–v3: classify trusted category budget_group after restore */
export function shouldClassifyCategoryBudgetGroupsAfterRestore(backupVersion: string): boolean {
  return backupVersion === '1' || backupVersion === '2' || backupVersion === '3';
}

/** v1–v3: no stored budget periods — init first/current period after restore */
export function shouldEnsureInitialBudgetPeriodAfterRestore(backupVersion: string): boolean {
  return backupVersion === '1' || backupVersion === '2' || backupVersion === '3';
}

export type SourceDeleteGuard = { ok: true } | { ok: false; reason: string };

/**
 * Hard-delete chỉ khi không còn giao dịch tham chiếu `source_id`.
 * Nguồn đã dùng trong lịch sử → Lưu trữ, không xoá (giữ attribution).
 */
export function sourceDeleteGuard(referenceCount: number): SourceDeleteGuard {
  if (referenceCount > 0) {
    return {
      ok: false,
      reason: 'Nguồn chi này đã có giao dịch nên chỉ có thể lưu trữ.',
    };
  }
  return { ok: true };
}

export function sourceHasTransactionRefs(referenceCount: number): boolean {
  return referenceCount > 0;
}

/** spending_group chỉ sửa khi chưa có giao dịch — tránh đổi nhóm lịch sử. */
export function canEditSourceSpendingGroup(referenceCount: number): boolean {
  return referenceCount === 0;
}
