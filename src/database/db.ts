// ============================================================
// SQLite connection singleton — no schema/migration imports
// Keeps budgetPeriods / initDb free of require cycles
// ============================================================

import * as SQLite from 'expo-sqlite';

// Cache the open promise so concurrent first callers share one connection
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  dbPromise = SQLite.openDatabaseAsync('yozakura.db').catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

/** Lấy instance database (singleton, tự phục hồi nếu native object bị giải phóng) */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) return openDatabase();
  const db = await dbPromise;
  // Native object chỉ bị giải phóng khi hot reload (dev) — production bỏ qua ping mỗi truy vấn
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    try {
      await db.getFirstAsync('SELECT 1;');
    } catch {
      return openDatabase();
    }
  }
  return db;
}
