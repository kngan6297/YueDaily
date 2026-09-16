// ============================================================
// BACKUP & RESTORE DỮ LIỆU YOZAKURA
// Xuất dữ liệu ra file JSON — nhập lại từ file JSON
// ============================================================

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type * as SQLite from 'expo-sqlite';

import { getDatabase, archiveExactLegacySeededSources, classifyTrustedExistingSources } from './initDb';
import {
  markP16TrustedBackfillComplete,
  runLegacyTrustedBackfillAfterRestore,
} from './p16Migration';
import {
  markFirstPeriodBudgetSeedsComplete,
  runFirstPeriodBudgetSeedsIfNeeded,
} from './budgetPeriods';
import {
  CURRENT_BACKUP_VERSION,
  validateBackupPayload,
  type BackupVersion,
  type ValidatedBackup,
} from './backupValidation';
import {
  shouldArchiveLegacySeedsAfterRestore,
  shouldClassifyTrustedSpendingGroupsAfterRestore,
  shouldRunFirstPeriodBudgetSeedsAfterRestore,
} from './sourceLifecycle';

export type { BackupVersion, ValidatedBackup } from './backupValidation';
export { CURRENT_BACKUP_VERSION, validateBackupPayload } from './backupValidation';

/** Legacy v1–v3 restore may still write streak rows; v4 restore leaves streak table untouched */
async function ensureLegacyStreakTable(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS streaks (
      id               INTEGER PRIMARY KEY,
      current_streak   INTEGER NOT NULL DEFAULT 0,
      last_logged_date TEXT
    );
  `);
}

async function restoreLegacyStreak(
  db: SQLite.SQLiteDatabase,
  streak: ValidatedBackup['streak'],
): Promise<void> {
  await ensureLegacyStreakTable(db);
  await db.execAsync('DELETE FROM streaks;');
  if (streak) {
    await db.runAsync(
      'INSERT INTO streaks (id, current_streak, last_logged_date) VALUES (?, ?, ?);',
      [streak.id, streak.current_streak, streak.last_logged_date],
    );
  } else {
    await db.runAsync(
      'INSERT INTO streaks (id, current_streak, last_logged_date) VALUES (1, 0, NULL);',
    );
  }
}

export interface BackupData {
  appVersion: string;
  backupVersion: BackupVersion;
  created_at: string;
  transactions: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  sources: Record<string, unknown>[];
  payers?: Record<string, unknown>[];
  budget_periods?: Record<string, unknown>[];
  /** v1–v3 legacy; v4 export omits product streak state */
  streak?: Record<string, unknown> | null;
}

// ── Xuất backup ──────────────────────────────────────────────

export async function exportBackup(): Promise<void> {
  const db = await getDatabase();

  const transactions = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM transactions ORDER BY id;'
  );
  const categories = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM categories ORDER BY id;'
  );
  const sources = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM sources ORDER BY id;'
  );
  const payers = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM payers ORDER BY id;'
  );
  const budget_periods = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM budget_periods ORDER BY id;'
  );

  const backup: BackupData = {
    appVersion: '1.0.0',
    backupVersion: CURRENT_BACKUP_VERSION,
    created_at: new Date().toISOString(),
    transactions,
    categories,
    sources,
    payers,
    budget_periods,
  };

  const json = JSON.stringify(backup, null, 2);
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `yozakura-backup-${dateStr}.json`;
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.write(json);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Thiết bị không hỗ trợ chia sẻ file');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Lưu file backup Yozakura',
    UTI: 'public.json',
  });
}

export async function applyValidatedBackupRestore(
  db: SQLite.SQLiteDatabase,
  backup: ValidatedBackup,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM transactions;');
    await db.execAsync('DELETE FROM categories;');
    await db.execAsync('DELETE FROM sources;');
    await db.execAsync('DELETE FROM payers;');
    await db.execAsync('DELETE FROM budget_periods;');

    if (backup.backupVersion !== '4' && backup.backupVersion !== '5') {
      await restoreLegacyStreak(db, backup.streak);
    }

    for (const cat of backup.categories) {
      await db.runAsync(
        'INSERT INTO categories (id, name, type, icon, color, budget_group) VALUES (?, ?, ?, ?, ?, ?);',
        [cat.id, cat.name, cat.type, cat.icon, cat.color, cat.budget_group],
      );
    }

    for (const src of backup.sources) {
      await db.runAsync(
        'INSERT INTO sources (id, name, is_active, spending_group) VALUES (?, ?, ?, ?);',
        [src.id, src.name, src.is_active, src.spending_group],
      );
    }

    if (backup.payers && backup.payers.length > 0) {
      for (const p of backup.payers) {
        await db.runAsync(
          'INSERT INTO payers (id, name, icon, color) VALUES (?, ?, ?, ?);',
          [p.id, p.name, p.icon, p.color],
        );
      }
    } else {
      await db.runAsync(
        'INSERT INTO payers (name, icon, color) VALUES (?, ?, ?), (?, ?, ?);',
        ['Vợ', '👩‍🦰', '#FF8FAB', 'Chồng', '👨‍🦱', '#4BBFA0'],
      );
    }

    for (const period of backup.budget_periods) {
      await db.runAsync(
        `INSERT INTO budget_periods
           (id, budget_key, period_start, period_end, limit_amount, carryover_amount,
            envelope_source_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          period.id,
          period.budget_key,
          period.period_start,
          period.period_end,
          period.limit_amount,
          period.carryover_amount,
          period.envelope_source_id,
          period.created_at,
          period.updated_at,
        ],
      );
    }

    for (const tx of backup.transactions) {
      await db.runAsync(
        `INSERT INTO transactions
           (id, amount, type, category_id, source_id, payer, expense_audience,
            image_uri, location, note, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          tx.id,
          tx.amount,
          tx.type,
          tx.category_id,
          tx.source_id,
          tx.payer,
          tx.expense_audience,
          tx.image_uri,
          tx.location,
          tx.note,
          tx.status,
          tx.created_at,
        ],
      );
    }

    if (shouldArchiveLegacySeedsAfterRestore(backup.backupVersion)) {
      await archiveExactLegacySeededSources(db);
    }
    if (shouldClassifyTrustedSpendingGroupsAfterRestore(backup.backupVersion)) {
      await classifyTrustedExistingSources(db);
    }
    await runLegacyTrustedBackfillAfterRestore(db, backup.backupVersion);
    await markP16TrustedBackfillComplete(db);

    if (shouldRunFirstPeriodBudgetSeedsAfterRestore(backup.backupVersion)) {
      // v1–v4: may apply one-time carryover + envelope_source_id for 2026-09-05
      await runFirstPeriodBudgetSeedsIfNeeded(db);
    } else if (backup.backupVersion === '5') {
      // v5 authoritative — never let startup seeds overwrite restored values
      await markFirstPeriodBudgetSeedsComplete(db);
    }
  });
}

// ── Nhập backup ──────────────────────────────────────────────

export interface RestoreResult {
  success: boolean;
  message: string;
  count?: number;
}

export async function importBackup(): Promise<RestoreResult> {
  // Mở file picker
  const pickerResult = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });

  if (pickerResult.canceled) {
    return { success: false, message: 'Đã hủy' };
  }

  const asset = pickerResult.assets[0];
  if (!asset?.uri) {
    return { success: false, message: 'Không thể đọc file' };
  }

  // Đọc nội dung file
  let json: string;
  try {
    json = await new File(asset.uri).text();
  } catch {
    return { success: false, message: 'Không thể đọc file. Hãy thử lại.' };
  }

  // Parse JSON
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { success: false, message: 'File không hợp lệ (không phải JSON)' };
  }

  // Validate toàn bộ trước khi chạm database
  let backup: ValidatedBackup;
  try {
    backup = validateBackupPayload(raw);
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'File backup không hợp lệ',
    };
  }

  const db = await getDatabase();

  try {
    await applyValidatedBackupRestore(db, backup);

    return {
      success: true,
      message: `Đã khôi phục ${backup.transactions.length} giao dịch thành công! 🌸`,
      count: backup.transactions.length,
    };
  } catch (err) {
    return {
      success: false,
      message: `Lỗi khi khôi phục: ${String(err)}`,
    };
  }
}
