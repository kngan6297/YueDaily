// ============================================================
// CÁC HÀM THAO TÁC VỚI BẢNG CATEGORIES VÀ SOURCES
// ============================================================

import { getDatabase } from './initDb';
import type { Category, Source, Streak } from '../types';

/** Lấy tất cả danh mục */
export async function getAllCategories(): Promise<Category[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Category>(
    'SELECT * FROM categories ORDER BY type, name;'
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

/** Lấy tất cả nguồn tiền */
export async function getAllSources(): Promise<Source[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Source>('SELECT * FROM sources ORDER BY id;');
}

/** Lấy và cập nhật streak */
export async function getStreak(): Promise<Streak | null> {
  const db = await getDatabase();
  return await db.getFirstAsync<Streak>('SELECT * FROM streaks WHERE id = 1;');
}

/** Cập nhật streak sau khi ghi giao dịch */
export async function updateStreak(): Promise<void> {
  const db = await getDatabase();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const streak = await db.getFirstAsync<Streak>('SELECT * FROM streaks WHERE id = 1;');

  if (!streak) return;

  if (streak.last_logged_date === today) {
    // Đã ghi hôm nay rồi, không tăng streak
    return;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (streak.last_logged_date === yesterdayStr) {
    // Ghi liên tiếp từ hôm qua, tăng streak
    await db.runAsync(
      'UPDATE streaks SET current_streak = current_streak + 1, last_logged_date = ? WHERE id = 1;',
      [today]
    );
  } else {
    // Bị ngắt quãng, reset về 1
    await db.runAsync(
      'UPDATE streaks SET current_streak = 1, last_logged_date = ? WHERE id = 1;',
      [today]
    );
  }
}
