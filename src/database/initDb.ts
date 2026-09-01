// ============================================================
// KHỞI TẠO DATABASE SQLITE CHO YOZAKURA
// Tự động tạo bảng và chèn dữ liệu mặc định khi app lần đầu chạy
// ============================================================

import * as SQLite from 'expo-sqlite';
import { sourceIdsToArchiveOnUpgrade } from './sourceLifecycle';
import { classifyTrustedSourceNames, missingSourceSeeds } from './sourceSeed';
import { runP16TrustedBackfillIfNeeded } from './p16Migration';
import type { BudgetGroup } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

/** Lấy instance database (singleton, tự phục hồi nếu native object bị giải phóng) */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    try {
      await db.getFirstAsync('SELECT 1;');
      return db;
    } catch {
      // Native object đã bị giải phóng (hot reload / process restart) — mở lại
      db = null;
    }
  }
  db = await SQLite.openDatabaseAsync('yozakura.db');
  return db;
}

/** Khởi tạo toàn bộ schema database */
export async function initializeDatabase(): Promise<void> {
  const database = await getDatabase();
  await initializeDatabaseOn(database);
}

/** Schema migrations + P1.6 backfill without default seed (verification / isolated DB) */
export async function runSchemaMigrationsOn(database: SQLite.SQLiteDatabase): Promise<void> {
  await migrateTransactionsSchema(database);
  await migrateSourcesSchema(database);
  await migrateCategoriesBudgetGroupSchema(database);
  await migrateBudgetPeriodsSchema(database);
  await runP16TrustedBackfillIfNeeded(database);
  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_transactions_created_at
      ON transactions (created_at);
    CREATE INDEX IF NOT EXISTS idx_transactions_status
      ON transactions (status);
  `);
}

export async function initializeDatabaseOn(database: SQLite.SQLiteDatabase): Promise<void> {
  // Bật WAL mode để tăng hiệu suất đọc/ghi
  await database.execAsync('PRAGMA journal_mode = WAL;');
  await database.execAsync('PRAGMA foreign_keys = ON;');

  // Tạo bảng categories (danh mục)
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT    NOT NULL,
      type      TEXT    NOT NULL DEFAULT 'both',
      icon      TEXT    NOT NULL DEFAULT '💰',
      color     TEXT    NOT NULL DEFAULT '#FF8FAB'
    );
  `);

  // Tạo bảng sources (nguồn chi)
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS sources (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT    NOT NULL UNIQUE,
      is_active      INTEGER NOT NULL DEFAULT 1,
      spending_group TEXT
    );
  `);

  // Tạo bảng payers (người trả)
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS payers (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT    NOT NULL UNIQUE,
      icon  TEXT    NOT NULL DEFAULT '👤',
      color TEXT    NOT NULL DEFAULT '#FF8FAB'
    );
  `);

  // Tạo bảng transactions (giao dịch) - bảng chính
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS transactions (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      amount            INTEGER NOT NULL DEFAULT 0,
      type              TEXT    NOT NULL DEFAULT 'chi',
      category_id       INTEGER,
      source_id         INTEGER,
      payer             TEXT    NOT NULL DEFAULT 'Vợ',
      expense_audience  TEXT    NOT NULL DEFAULT 'couple',
      image_uri         TEXT,
      location          TEXT,
      note              TEXT,
      status            TEXT    NOT NULL DEFAULT 'complete',
      created_at        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (source_id)   REFERENCES sources(id)
    );
  `);

  // Migration an toàn cho DB cũ (expense_audience / is_active / spending_group)
  await migrateTransactionsSchema(database);
  await migrateSourcesSchema(database);
  await migrateCategoriesBudgetGroupSchema(database);
  await migrateBudgetPeriodsSchema(database);

  // P1.6A one-time trusted backfill for pre-P1.6 DB lineage (marker-guarded)
  await runP16TrustedBackfillIfNeeded(database);

  // Tạo index để tăng tốc truy vấn theo ngày và loại
  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_transactions_created_at
      ON transactions (created_at);
    CREATE INDEX IF NOT EXISTS idx_transactions_status
      ON transactions (status);
  `);

  // Chèn dữ liệu mặc định nếu chưa có
  await seedDefaultData(database);
}

/**
 * Thêm cột expense_audience nếu thiếu.
 * Giao dịch cũ nhận DEFAULT 'unspecified' — không tự gán 'couple'.
 */
async function migrateTransactionsSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  const cols = await database.getAllAsync<{ name: string }>(
    'PRAGMA table_info(transactions);'
  );
  if (cols.some((c) => c.name === 'expense_audience')) return;

  await database.execAsync(
    `ALTER TABLE transactions
     ADD COLUMN expense_audience TEXT NOT NULL DEFAULT 'unspecified';`
  );
}

/**
 * Thêm is_active nếu thiếu (DEFAULT 1), rồi spending_group nếu thiếu.
 * is_active: chỉ khi vừa thêm cột mới archive exact legacy seeds.
 * spending_group: classify exact trusted current names; legacy seeds stay NULL.
 */
async function migrateSourcesSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  const cols = await database.getAllAsync<{ name: string }>(
    'PRAGMA table_info(sources);'
  );
  const names = new Set(cols.map((c) => c.name));

  if (!names.has('is_active')) {
    await database.execAsync(
      `ALTER TABLE sources ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;`
    );
    await archiveExactLegacySeededSources(database);
  }

  if (!names.has('spending_group')) {
    await database.execAsync(`ALTER TABLE sources ADD COLUMN spending_group TEXT;`);
    await classifyTrustedExistingSources(database);
  }
}

async function migrateCategoriesBudgetGroupSchema(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  const cols = await database.getAllAsync<{ name: string }>(
    'PRAGMA table_info(categories);',
  );
  if (cols.some((c) => c.name === 'budget_group')) return;
  await database.execAsync(`ALTER TABLE categories ADD COLUMN budget_group TEXT;`);
}

async function migrateBudgetPeriodsSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS budget_periods (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      budget_key   TEXT    NOT NULL,
      period_start TEXT    NOT NULL,
      period_end   TEXT    NOT NULL,
      limit_amount INTEGER NOT NULL,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE (budget_key, period_start)
    );
  `);
}

/** Exact-name spending_group for known current sources. Safe after v1/v2 restore. */
export async function classifyTrustedExistingSources(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  const existing = await database.getAllAsync<{ id: number; name: string }>(
    'SELECT id, name FROM sources;'
  );
  for (const row of classifyTrustedSourceNames(existing)) {
    await database.runAsync(
      'UPDATE sources SET spending_group = ? WHERE id = ?;',
      [row.spending_group, row.id],
    );
  }
}

/** Exact-name archive of known historical seeds. Safe to call after v1 backup restore. */
export async function archiveExactLegacySeededSources(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  const existing = await database.getAllAsync<{ id: number; name: string }>(
    'SELECT id, name FROM sources;'
  );
  const ids = sourceIdsToArchiveOnUpgrade(existing);
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  await database.runAsync(
    `UPDATE sources SET is_active = 0 WHERE id IN (${placeholders});`,
    ids,
  );
}

/** Chèn dữ liệu mặc định vào database */
async function seedDefaultData(database: SQLite.SQLiteDatabase): Promise<void> {
  // Kiểm tra đã có dữ liệu categories chưa
  const catCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories;'
  );

  if (!catCount || catCount.count === 0) {
    // Danh mục chi tiêu mặc định
    const defaultCategories: {
      name: string;
      type: 'chi';
      icon: string;
      color: string;
      budget_group: BudgetGroup | null;
    }[] = [
      { name: 'Ăn uống', type: 'chi', icon: '🍜', color: '#FF8FAB', budget_group: 'household_food' },
      { name: 'Trà & Cà phê', type: 'chi', icon: '🧋', color: '#FBBAD3', budget_group: 'household_food' },
      { name: 'Mua sắm', type: 'chi', icon: '🛍️', color: '#B882FF', budget_group: null },
      { name: 'Di chuyển', type: 'chi', icon: '🛵', color: '#82C0FF', budget_group: null },
      { name: 'Làm đẹp', type: 'chi', icon: '💄', color: '#F990B6', budget_group: null },
      { name: 'Sức khoẻ', type: 'chi', icon: '💊', color: '#6FCBA0', budget_group: null },
      { name: 'Giải trí', type: 'chi', icon: '🎮', color: '#FFD966', budget_group: null },
      { name: 'Giáo dục', type: 'chi', icon: '📚', color: '#FFAA75', budget_group: null },
      { name: 'Gia đình', type: 'chi', icon: '🏠', color: '#A8E6D3', budget_group: null },
      { name: 'Điện - Nước', type: 'chi', icon: '💡', color: '#FFE9A0', budget_group: null },
      { name: 'Thú cưng', type: 'chi', icon: '🐱', color: '#D4AEFF', budget_group: null },
      { name: 'Khác', type: 'chi', icon: '✨', color: '#EBD9FF', budget_group: null },
    ];

    for (const cat of defaultCategories) {
      await database.runAsync(
        'INSERT INTO categories (name, type, icon, color, budget_group) VALUES (?, ?, ?, ?, ?);',
        [cat.name, cat.type, cat.icon, cat.color, cat.budget_group],
      );
    }
  }

  // Seed nguồn chi: fresh install nhận example config; DB cũ chỉ thêm tên còn thiếu.
  // Không rename / merge / remap source lịch sử (Tiền mặt, VCB Shop, …).
  const existingSources = await database.getAllAsync<{ name: string }>(
    'SELECT name FROM sources;'
  );
  for (const seed of missingSourceSeeds(existingSources.map((s) => s.name))) {
    await database.runAsync(
      'INSERT OR IGNORE INTO sources (name, is_active, spending_group) VALUES (?, 1, ?);',
      [seed.name, seed.spending_group],
    );
  }

  const payerCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM payers;'
  );

  if (!payerCount || payerCount.count === 0) {
    const defaultPayers = [
      { name: 'Vợ', icon: '👩‍🦰', color: '#FF8FAB' },
      { name: 'Chồng', icon: '👨‍🦱', color: '#4BBFA0' },
    ];
    for (const p of defaultPayers) {
      await database.runAsync(
        'INSERT INTO payers (name, icon, color) VALUES (?, ?, ?);',
        [p.name, p.icon, p.color]
      );
    }
  }

}
