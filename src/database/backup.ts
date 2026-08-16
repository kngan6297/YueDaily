// ============================================================
// BACKUP & RESTORE DỮ LIỆU YOZAKURA
// Xuất dữ liệu ra file JSON — nhập lại từ file JSON
// ============================================================

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getDatabase, archiveExactLegacySeededSources, classifyTrustedExistingSources } from './initDb';
import { normalizeExpenseAudience, normalizeSourceSpendingGroup, type ExpenseAudience, type SourceSpendingGroup } from '../types';
import {
  normalizeSourceIsActive,
  shouldArchiveLegacySeedsAfterRestore,
  shouldClassifyTrustedSpendingGroupsAfterRestore,
} from './sourceLifecycle';

export type BackupVersion = '1' | '2' | '3';
export const CURRENT_BACKUP_VERSION: BackupVersion = '3';

export interface BackupData {
  appVersion: string;
  backupVersion: BackupVersion;
  created_at: string;
  transactions: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  sources: Record<string, unknown>[];
  payers?: Record<string, unknown>[];
  streak: Record<string, unknown> | null;
}

// ── Validated row shapes (runtime-checked) ───────────────────

interface ValidCategory {
  id: number;
  name: string;
  type: string;
  icon: string;
  color: string;
}

interface ValidSource {
  id: number;
  name: string;
  is_active: number;
  spending_group: SourceSpendingGroup | null;
}

interface ValidPayer {
  id: number;
  name: string;
  icon: string;
  color: string;
}

interface ValidTransaction {
  id: number;
  amount: number;
  type: string;
  category_id: number | null;
  source_id: number | null;
  payer: string;
  expense_audience: ExpenseAudience;
  image_uri: string | null;
  location: string | null;
  note: string | null;
  status: string;
  created_at: string;
}

interface ValidStreak {
  id: number;
  current_streak: number;
  last_logged_date: string | null;
}

interface ValidatedBackup {
  backupVersion: BackupVersion;
  transactions: ValidTransaction[];
  categories: ValidCategory[];
  sources: ValidSource[];
  payers: ValidPayer[] | null;
  streak: ValidStreak | null;
}

// ── Validation helpers ───────────────────────────────────────

const CREATED_AT_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TX_TYPES = new Set(['thu', 'chi']);
const CAT_TYPES = new Set(['thu', 'chi', 'both']);
const TX_STATUSES = new Set(['complete', 'pending']);

function fail(path: string): never {
  throw new Error(`Backup không hợp lệ: ${path}`);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function assertFiniteNumber(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(path);
  return v;
}

function assertIntegerId(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) fail(path);
  return v;
}

function assertString(v: unknown, path: string): string {
  if (typeof v !== 'string') fail(path);
  return v;
}

function assertNullableString(v: unknown, path: string): string | null {
  if (v === null) return null;
  if (typeof v !== 'string') fail(path);
  return v;
}

function assertNullableId(v: unknown, path: string): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) fail(path);
  return v;
}

function assertUniqueIds(ids: number[], collection: string): void {
  const seen = new Set<number>();
  for (let i = 0; i < ids.length; i++) {
    if (seen.has(ids[i])) fail(`${collection}[${i}].id`);
    seen.add(ids[i]);
  }
}

function validateCategory(row: unknown, index: number): ValidCategory {
  const p = `categories[${index}]`;
  if (!isPlainObject(row)) fail(p);
  const type = assertString(row.type, `${p}.type`);
  if (!CAT_TYPES.has(type)) fail(`${p}.type`);
  return {
    id: assertIntegerId(row.id, `${p}.id`),
    name: assertString(row.name, `${p}.name`),
    type,
    icon: assertString(row.icon, `${p}.icon`),
    color: assertString(row.color, `${p}.color`),
  };
}

function validateSource(row: unknown, index: number): ValidSource {
  const p = `sources[${index}]`;
  if (!isPlainObject(row)) fail(p);
  return {
    id: assertIntegerId(row.id, `${p}.id`),
    name: assertString(row.name, `${p}.name`),
    is_active: normalizeSourceIsActive(row.is_active),
    spending_group: normalizeSourceSpendingGroup(row.spending_group),
  };
}

function validatePayer(row: unknown, index: number): ValidPayer {
  const p = `payers[${index}]`;
  if (!isPlainObject(row)) fail(p);
  return {
    id: assertIntegerId(row.id, `${p}.id`),
    name: assertString(row.name, `${p}.name`),
    icon: assertString(row.icon, `${p}.icon`),
    color: assertString(row.color, `${p}.color`),
  };
}

function validateTransaction(row: unknown, index: number): ValidTransaction {
  const p = `transactions[${index}]`;
  if (!isPlainObject(row)) fail(p);

  const amount = assertFiniteNumber(row.amount, `${p}.amount`);
  // Nghiệp vụ: số tiền lưu INTEGER ≥ 0 (pending = 0 được phép)
  if (!Number.isInteger(amount) || amount < 0) fail(`${p}.amount`);

  const type = assertString(row.type, `${p}.type`);
  if (!TX_TYPES.has(type)) fail(`${p}.type`);

  const status = assertString(row.status, `${p}.status`);
  if (!TX_STATUSES.has(status)) fail(`${p}.status`);

  const createdAt = assertString(row.created_at, `${p}.created_at`);
  if (!CREATED_AT_RE.test(createdAt)) fail(`${p}.created_at`);

  // Backup cũ thiếu field → unspecified (không crash)
  let expenseAudience: ExpenseAudience = 'unspecified';
  if (row.expense_audience !== undefined && row.expense_audience !== null) {
    const rawAudience = assertString(row.expense_audience, `${p}.expense_audience`);
    expenseAudience = normalizeExpenseAudience(rawAudience);
    if (rawAudience !== expenseAudience) fail(`${p}.expense_audience`);
  }

  return {
    id: assertIntegerId(row.id, `${p}.id`),
    amount,
    type,
    category_id: assertNullableId(row.category_id, `${p}.category_id`),
    source_id: assertNullableId(row.source_id, `${p}.source_id`),
    payer: assertString(row.payer, `${p}.payer`),
    expense_audience: expenseAudience,
    image_uri: assertNullableString(row.image_uri, `${p}.image_uri`),
    location: assertNullableString(row.location, `${p}.location`),
    note: assertNullableString(row.note, `${p}.note`),
    status,
    created_at: createdAt,
  };
}

function validateStreak(row: unknown): ValidStreak {
  if (!isPlainObject(row)) fail('streak');
  const current = assertFiniteNumber(row.current_streak, 'streak.current_streak');
  if (!Number.isInteger(current) || current < 0) fail('streak.current_streak');

  let lastLogged: string | null = null;
  if (row.last_logged_date !== null && row.last_logged_date !== undefined) {
    lastLogged = assertString(row.last_logged_date, 'streak.last_logged_date');
    if (!DATE_ONLY_RE.test(lastLogged)) fail('streak.last_logged_date');
  }

  return {
    id: assertIntegerId(row.id ?? 1, 'streak.id'),
    current_streak: current,
    last_logged_date: lastLogged,
  };
}

/** Validate toàn bộ backup — throw trước khi chạm database */
function assertValidBackup(raw: unknown): ValidatedBackup {
  if (!isPlainObject(raw)) fail('root');

  if (raw.backupVersion !== '1' && raw.backupVersion !== '2' && raw.backupVersion !== '3') fail('backupVersion');
  const backupVersion = raw.backupVersion;

  if (!Array.isArray(raw.transactions)) fail('transactions');
  if (!Array.isArray(raw.categories)) fail('categories');
  if (!Array.isArray(raw.sources)) fail('sources');

  if (raw.payers !== undefined && raw.payers !== null && !Array.isArray(raw.payers)) {
    fail('payers');
  }

  const categories = raw.categories.map(validateCategory);
  const sources = raw.sources.map(validateSource);
  const transactions = raw.transactions.map(validateTransaction);

  assertUniqueIds(categories.map((c) => c.id), 'categories');
  assertUniqueIds(sources.map((s) => s.id), 'sources');
  assertUniqueIds(transactions.map((t) => t.id), 'transactions');

  let payers: ValidPayer[] | null = null;
  if (Array.isArray(raw.payers) && raw.payers.length > 0) {
    payers = raw.payers.map(validatePayer);
    assertUniqueIds(payers.map((p) => p.id), 'payers');
  }

  let streak: ValidStreak | null = null;
  if (raw.streak != null) {
    streak = validateStreak(raw.streak);
  }

  return { backupVersion, transactions, categories, sources, payers, streak };
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
  const streak = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM streaks WHERE id = 1;'
  );

  const backup: BackupData = {
    appVersion: '1.0.0',
    backupVersion: CURRENT_BACKUP_VERSION,
    created_at: new Date().toISOString(),
    transactions,
    categories,
    sources,
    payers,
    streak: streak ?? null,
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
    backup = assertValidBackup(raw);
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'File backup không hợp lệ',
    };
  }

  const db = await getDatabase();

  try {
    await db.withTransactionAsync(async () => {
      await db.execAsync('DELETE FROM transactions;');
      await db.execAsync('DELETE FROM categories;');
      await db.execAsync('DELETE FROM sources;');
      await db.execAsync('DELETE FROM payers;');
      await db.execAsync('DELETE FROM streaks;');

      for (const cat of backup.categories) {
        await db.runAsync(
          'INSERT INTO categories (id, name, type, icon, color) VALUES (?, ?, ?, ?, ?);',
          [cat.id, cat.name, cat.type, cat.icon, cat.color]
        );
      }

      for (const src of backup.sources) {
        await db.runAsync(
          'INSERT INTO sources (id, name, is_active, spending_group) VALUES (?, ?, ?, ?);',
          [src.id, src.name, src.is_active, src.spending_group]
        );
      }

      if (backup.payers && backup.payers.length > 0) {
        for (const p of backup.payers) {
          await db.runAsync(
            'INSERT INTO payers (id, name, icon, color) VALUES (?, ?, ?, ?);',
            [p.id, p.name, p.icon, p.color]
          );
        }
      } else {
        await db.runAsync(
          'INSERT INTO payers (name, icon, color) VALUES (?, ?, ?), (?, ?, ?);',
          ['Vợ', '👩‍🦰', '#FF8FAB', 'Chồng', '👨‍🦱', '#4BBFA0']
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
          ]
        );
      }

      if (backup.streak) {
        await db.runAsync(
          'INSERT INTO streaks (id, current_streak, last_logged_date) VALUES (?, ?, ?);',
          [
            backup.streak.id,
            backup.streak.current_streak,
            backup.streak.last_logged_date,
          ]
        );
      } else {
        await db.runAsync(
          'INSERT INTO streaks (id, current_streak, last_logged_date) VALUES (1, 0, NULL);'
        );
      }

      if (shouldArchiveLegacySeedsAfterRestore(backup.backupVersion)) {
        await archiveExactLegacySeededSources(db);
      }
      if (shouldClassifyTrustedSpendingGroupsAfterRestore(backup.backupVersion)) {
        await classifyTrustedExistingSources(db);
      }
    });

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
