// ============================================================
// P1.6 trusted backfill lifecycle — pure decision helpers (Node-testable)
// ============================================================

export const P16_TRUSTED_BACKFILL_MARKER = 'p16_trusted_backfill_v1';

/** Whether normal startup should run legacy trusted backfill */
export function shouldRunP16TrustedBackfillOnStartup(backfillComplete: boolean): boolean {
  return !backfillComplete;
}

/** v4 restore is authoritative; legacy backfill hooks must not run */
export function shouldRunLegacyTrustedBackfillAfterRestore(backupVersion: string): boolean {
  return backupVersion === '1' || backupVersion === '2' || backupVersion === '3';
}
