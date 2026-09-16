// ============================================================
// SQLite connection singleton — no schema/migration imports
// Keeps budgetPeriods / initDb free of require cycles
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
