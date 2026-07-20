// ============================================================
// KHỞI TẠO DATABASE SQLITE CHO YOZAKURA
// Tự động tạo bảng và chèn dữ liệu mặc định khi app lần đầu chạy
// ============================================================

import * as SQLite from 'expo-sqlite';

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

  // Tạo bảng sources (nguồn tiền)
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS sources (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT    NOT NULL UNIQUE
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
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      amount      INTEGER NOT NULL DEFAULT 0,
      type        TEXT    NOT NULL DEFAULT 'chi',
      category_id INTEGER,
      source_id   INTEGER,
      payer       TEXT    NOT NULL DEFAULT 'Vợ',
      image_uri   TEXT,
      location    TEXT,
      note        TEXT,
      status      TEXT    NOT NULL DEFAULT 'complete',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (source_id)   REFERENCES sources(id)
    );
  `);

  // Tạo index để tăng tốc truy vấn theo ngày và loại
  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_transactions_created_at
      ON transactions (created_at);
    CREATE INDEX IF NOT EXISTS idx_transactions_status
      ON transactions (status);
  `);

  // Tạo bảng streaks (ngày ghi chép liên tiếp)
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS streaks (
      id               INTEGER PRIMARY KEY,
      current_streak   INTEGER NOT NULL DEFAULT 0,
      last_logged_date TEXT
    );
  `);

  // Chèn dữ liệu mặc định nếu chưa có
  await seedDefaultData(database);
}

/** Chèn dữ liệu mặc định vào database */
async function seedDefaultData(database: SQLite.SQLiteDatabase): Promise<void> {
  // Kiểm tra đã có dữ liệu categories chưa
  const catCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories;'
  );

  if (!catCount || catCount.count === 0) {
    // Danh mục mặc định dễ thương, phân loại cho cả thu và chi
    const defaultCategories = [
      // Danh mục chi tiêu (chi)
      { name: 'Ăn uống',     type: 'chi',  icon: '🍜', color: '#FF8FAB' },
      { name: 'Trà & Cà phê', type: 'chi', icon: '🧋', color: '#FBBAD3' },
      { name: 'Mua sắm',     type: 'chi',  icon: '🛍️', color: '#B882FF' },
      { name: 'Di chuyển',   type: 'chi',  icon: '🛵', color: '#82C0FF' },
      { name: 'Làm đẹp',    type: 'chi',   icon: '💄', color: '#F990B6' },
      { name: 'Sức khoẻ',   type: 'chi',   icon: '💊', color: '#6FCBA0' },
      { name: 'Giải trí',   type: 'chi',   icon: '🎮', color: '#FFD966' },
      { name: 'Giáo dục',   type: 'chi',   icon: '📚', color: '#FFAA75' },
      { name: 'Gia đình',   type: 'chi',   icon: '🏠', color: '#A8E6D3' },
      { name: 'Điện - Nước', type: 'chi',  icon: '💡', color: '#FFE9A0' },
      { name: 'Thú cưng',   type: 'chi',   icon: '🐱', color: '#D4AEFF' },
      { name: 'Khác',       type: 'chi',   icon: '✨', color: '#EBD9FF' },
      // Danh mục thu nhập (thu)
      { name: 'Lương',      type: 'thu',   icon: '💵', color: '#6FCBA0' },
      { name: 'Thưởng',     type: 'thu',   icon: '🎁', color: '#FFD966' },
      { name: 'Bán hàng',   type: 'thu',   icon: '🏪', color: '#82C0FF' },
      { name: 'Đầu tư',     type: 'thu',   icon: '📈', color: '#B882FF' },
      { name: 'Thu nhập khác', type: 'thu', icon: '🌟', color: '#FFAA75' },
    ];

    for (const cat of defaultCategories) {
      await database.runAsync(
        'INSERT INTO categories (name, type, icon, color) VALUES (?, ?, ?, ?);',
        [cat.name, cat.type, cat.icon, cat.color]
      );
    }
  }

  // Seed nguồn tiền nếu chưa có
  const srcCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM sources;'
  );

  if (!srcCount || srcCount.count === 0) {
    const defaultSources = ['Tiền mặt', 'Chuyển khoản'];
    for (const src of defaultSources) {
      await database.runAsync(
        'INSERT INTO sources (name) VALUES (?);',
        [src]
      );
    }
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

  // Khởi tạo streak nếu chưa có
  const streakCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM streaks;'
  );

  if (!streakCount || streakCount.count === 0) {
    await database.runAsync(
      'INSERT INTO streaks (id, current_streak, last_logged_date) VALUES (1, 0, NULL);'
    );
  }
}
