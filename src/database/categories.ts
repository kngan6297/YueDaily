// ============================================================
// CÁC HÀM THAO TÁC VỚI CATEGORIES, SOURCES, PAYERS
// ============================================================

import { getDatabase } from './initDb';
import { CATEGORY_USAGE_JOIN } from './categoryUsage';
import { canEditSourceSpendingGroup, sourceDeleteGuard } from './sourceLifecycle';
import type { Category, PayerRecord, Source, SourceSpendingGroup } from '../types';
import { normalizeBudgetGroup, normalizeSourceSpendingGroup, TRANSACTION_STATUS_COMPLETE } from '../types';

type DeleteResult = { ok: true } | { ok: false; reason: string };

function mapCategoryRow(row: Category): Category {
  return {
    ...row,
    budget_group: normalizeBudgetGroup(row.budget_group),
  };
}

/** Lấy tất cả danh mục */
export async function getAllCategories(): Promise<Category[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Category>(
    'SELECT * FROM categories ORDER BY type, name;'
  );
  return rows.map(mapCategoryRow);
}

/** Lấy danh mục chi tiêu (chi + both; loại thu legacy) — alphabetical, Settings */
export async function getExpenseCategories(): Promise<Category[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Category>(
    `SELECT * FROM categories WHERE type = 'chi' OR type = 'both' ORDER BY name;`,
  );
  return rows.map(mapCategoryRow);
}

/** Form picker: completed expense usage DESC, then name ASC. Zero-use last. */
export async function getExpenseCategoriesByUsage(): Promise<Category[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Category>(
    `SELECT c.id, c.name, c.type, c.icon, c.color, c.budget_group
     FROM categories c
     ${CATEGORY_USAGE_JOIN}
     WHERE c.type = 'chi' OR c.type = 'both'
     GROUP BY c.id, c.name, c.type, c.icon, c.color, c.budget_group
     ORDER BY COUNT(t.id) DESC, c.name ASC;`,
  ).then((rows) => rows.map(mapCategoryRow));
}

/** Lấy danh mục theo loại giao dịch */
export async function getCategoriesByType(type: 'thu' | 'chi'): Promise<Category[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Category>(
    `SELECT * FROM categories WHERE type = ? OR type = 'both' ORDER BY name;`,
    [type]
  );
  return rows.map(mapCategoryRow);
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
    'INSERT INTO categories (name, type, icon, color, budget_group) VALUES (?, ?, ?, ?, NULL);',
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

function mapSourceRow(row: Source): Source {
  return {
    ...row,
    spending_group: normalizeSourceSpendingGroup(row.spending_group),
  };
}

/** Lấy tất cả nguồn chi (kể cả archived — Settings / Thống kê / backup) */
export async function getAllSources(): Promise<Source[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Source>('SELECT * FROM sources ORDER BY id;');
  return rows.map(mapSourceRow);
}

/** Nguồn đang dùng — form tạo giao dịch mới */
export async function getActiveSources(): Promise<Source[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Source>(
    'SELECT * FROM sources WHERE is_active = 1 ORDER BY id;',
  );
  return rows.map(mapSourceRow);
}

/** Thêm nguồn chi — bắt buộc chọn nhóm theo dõi */
export async function insertSource(name: string, spendingGroup: SourceSpendingGroup): Promise<number> {
  const group = normalizeSourceSpendingGroup(spendingGroup);
  if (!group) {
    throw new Error('Chọn nhóm theo dõi: Cá nhân Yue hoặc Quỹ chung.');
  }
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO sources (name, is_active, spending_group) VALUES (?, 1, ?);',
    [name.trim(), group],
  );
  return result.lastInsertRowId;
}

/** Cập nhật tên; spending_group chỉ khi chưa có giao dịch tham chiếu */
export async function updateSource(
  id: number,
  name: string,
  spendingGroup: SourceSpendingGroup | null,
): Promise<void> {
  const db = await getDatabase();
  const refs = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transactions WHERE source_id = ?;',
    [id],
  );
  const trimmed = name.trim();
  if (!canEditSourceSpendingGroup(refs?.count ?? 0)) {
    await db.runAsync('UPDATE sources SET name = ? WHERE id = ?;', [trimmed, id]);
    return;
  }
  await db.runAsync(
    'UPDATE sources SET name = ?, spending_group = ? WHERE id = ?;',
    [trimmed, normalizeSourceSpendingGroup(spendingGroup), id],
  );
}

export async function setSourceActive(id: number, active: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE sources SET is_active = ? WHERE id = ?;', [active ? 1 : 0, id]);
}

/** Nguồn chi kèm số giao dịch tham chiếu (Settings — quyết định Xóa vs Lưu trữ) */
export interface SourceWithRefs extends Source {
  reference_count: number;
}

export async function getSourcesWithReferenceCounts(): Promise<SourceWithRefs[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SourceWithRefs>(
    `SELECT s.id, s.name, s.is_active, s.spending_group, COUNT(t.id) as reference_count
     FROM sources s
     LEFT JOIN transactions t ON t.source_id = s.id
     GROUP BY s.id, s.name, s.is_active, s.spending_group
     ORDER BY s.id;`,
  );
  return rows.map((row) => ({
    ...mapSourceRow(row),
    reference_count: Number(row.reference_count) || 0,
  }));
}

/** Xoá nguồn chi — chỉ khi không còn giao dịch / budget envelope tham chiếu; không cascade */
export async function deleteSource(id: number): Promise<DeleteResult> {
  const db = await getDatabase();
  const count = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM sources;'
  );
  if ((count?.count ?? 0) <= 1) {
    return { ok: false, reason: 'Cần giữ ít nhất một nguồn chi.' };
  }

  const refs = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transactions WHERE source_id = ?;',
    [id],
  );
  const budgetRefs = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM budget_periods WHERE envelope_source_id = ?;',
    [id],
  );
  const gate = sourceDeleteGuard(refs?.count ?? 0, budgetRefs?.count ?? 0);
  if (!gate.ok) return gate;

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

