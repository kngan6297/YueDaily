// ============================================================
// CÁC HÀM THAO TÁC VỚI CATEGORIES, SOURCES, PAYERS
// ============================================================

import { getDatabase } from './initDb';
import type { Category, PayerRecord, Source, Streak } from '../types';
import { TRANSACTION_STATUS_COMPLETE } from '../types';

type DeleteResult = { ok: true } | { ok: false; reason: string };

/** Lấy tất cả danh mục */
export async function getAllCategories(): Promise<Category[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Category>(
    'SELECT * FROM categories ORDER BY type, name;'
  );
}

/** Lấy danh mục chi tiêu (chi + both; loại thu legacy) */
export async function getExpenseCategories(): Promise<Category[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Category>(
    `SELECT * FROM categories WHERE type = 'chi' OR type = 'both' ORDER BY name;`,
  );
}

/** Lấy danh mục theo loại giao dịch */
export async function getCategoriesByType(type: 'thu' | 'chi'): Promise<Category[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Category>(
    `SELECT * FROM categories WHERE type = ? OR type = 'both' ORDER BY name;`,
    [type]
  );
}

/** Thêm danh mục mới */
export async function insertCategory(
  name: string,
  type: 'chi' | 'thu' | 'both',
  icon: string,
  color: string
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO categories (name, type, icon, color) VALUES (?, ?, ?, ?);',
    [name, type, icon, color]
  );
  return result.lastInsertRowId;
}

/** Cập nhật danh mục */
export async function updateCategory(
  id: number,
  name: string,
  type: 'chi' | 'thu' | 'both',
  icon: string,
  color: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE categories SET name = ?, type = ?, icon = ?, color = ? WHERE id = ?;',
    [name, type, icon, color, id]
  );
}

/** Xoá danh mục — gỡ liên kết giao dịch trước */
export async function deleteCategory(id: number): Promise<DeleteResult> {
  const db = await getDatabase();
  await db.runAsync('UPDATE transactions SET category_id = NULL WHERE category_id = ?;', [id]);
  await db.runAsync('DELETE FROM categories WHERE id = ?;', [id]);
  return { ok: true };
}

/** Lấy tất cả nguồn tiền */
export async function getAllSources(): Promise<Source[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Source>('SELECT * FROM sources ORDER BY id;');
}

/** Thêm nguồn tiền */
export async function insertSource(name: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync('INSERT INTO sources (name) VALUES (?);', [name.trim()]);
  return result.lastInsertRowId;
}

/** Cập nhật nguồn tiền */
export async function updateSource(id: number, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE sources SET name = ? WHERE id = ?;', [name.trim(), id]);
}

/** Xoá nguồn tiền — gỡ liên kết giao dịch trước */
export async function deleteSource(id: number): Promise<DeleteResult> {
  const db = await getDatabase();
  const count = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM sources;'
  );
  if ((count?.count ?? 0) <= 1) {
    return { ok: false, reason: 'Cần giữ ít nhất một nguồn tiền.' };
  }
  await db.runAsync('UPDATE transactions SET source_id = NULL WHERE source_id = ?;', [id]);
  await db.runAsync('DELETE FROM sources WHERE id = ?;', [id]);
  return { ok: true };
}

/** Lấy tất cả người trả */
export async function getAllPayers(): Promise<PayerRecord[]> {
  const db = await getDatabase();
  return await db.getAllAsync<PayerRecord>('SELECT * FROM payers ORDER BY id;');
}

/** Thêm người trả */
export async function insertPayer(name: string, icon: string, color: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO payers (name, icon, color) VALUES (?, ?, ?);',
    [name.trim(), icon.trim() || '👤', color]
  );
  return result.lastInsertRowId;
}

/** Cập nhật người trả — đồng bộ tên trong giao dịch cũ */
export async function updatePayer(
  id: number,
  name: string,
  icon: string,
  color: string
): Promise<void> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<PayerRecord>('SELECT * FROM payers WHERE id = ?;', [id]);
  if (!existing) return;

  const trimmed = name.trim();
  if (existing.name !== trimmed) {
    await db.runAsync('UPDATE transactions SET payer = ? WHERE payer = ?;', [trimmed, existing.name]);
  }
  await db.runAsync(
    'UPDATE payers SET name = ?, icon = ?, color = ? WHERE id = ?;',
    [trimmed, icon.trim() || '👤', color, id]
  );
}

/** Xoá người trả */
export async function deletePayer(id: number): Promise<DeleteResult> {
  const db = await getDatabase();
  const count = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM payers;'
  );
  if ((count?.count ?? 0) <= 1) {
    return { ok: false, reason: 'Cần giữ ít nhất một người trả.' };
  }

  const payer = await db.getFirstAsync<PayerRecord>('SELECT * FROM payers WHERE id = ?;', [id]);
  if (!payer) return { ok: false, reason: 'Không tìm thấy người trả.' };

  const txCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transactions WHERE payer = ?;',
    [payer.name]
  );
  if ((txCount?.count ?? 0) > 0) {
    return {
      ok: false,
      reason: `「${payer.name}」đang có ${txCount?.count} giao dịch. Đổi tên thay vì xoá, hoặc xoá giao dịch trước.`,
    };
  }

  await db.runAsync('DELETE FROM payers WHERE id = ?;', [id]);
  return { ok: true };
}

/** Lấy và cập nhật streak */
export async function getStreak(): Promise<Streak | null> {
  const db = await getDatabase();
  return await db.getFirstAsync<Streak>('SELECT * FROM streaks WHERE id = 1;');
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Tính lại streak từ các ngày đã ghi giao dịch — hỗ trợ nhập bù ngày cũ */
export async function updateStreak(): Promise<void> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{ d: string }>(
    `SELECT DISTINCT date(created_at) as d
     FROM transactions
     WHERE status = '${TRANSACTION_STATUS_COMPLETE}'
       AND type = 'chi'
     ORDER BY d DESC;`,
  );

  if (rows.length === 0) {
    await db.runAsync(
      'UPDATE streaks SET current_streak = 0, last_logged_date = NULL WHERE id = 1;',
    );
    return;
  }

  const loggedDates = new Set(rows.map((r) => r.d));
  const lastLogged = rows[0].d;

  const countFrom = (start: Date): number => {
    let count = 0;
    const cursor = new Date(start);
    while (loggedDates.has(formatLocalDate(cursor))) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  };

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  let streakCount = 0;
  if (loggedDates.has(formatLocalDate(today))) {
    streakCount = countFrom(today);
  } else if (loggedDates.has(formatLocalDate(yesterday))) {
    streakCount = countFrom(yesterday);
  }

  await db.runAsync(
    'UPDATE streaks SET current_streak = ?, last_logged_date = ? WHERE id = 1;',
    [streakCount, lastLogged],
  );
}
