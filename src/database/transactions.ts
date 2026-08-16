// ============================================================
// CÁC HÀM THAO TÁC VỚI BẢNG TRANSACTIONS
// ============================================================

import { buildCreatedAt } from '../utils/date';
import { getDatabase } from './initDb';
import { spendingGroupEqualsClause } from './homeSpendView';
import type { ExpenseAudience, SourceSpendingGroup, Transaction, TransactionFormData } from '../types';
import {
  DEFAULT_EXPENSE_AUDIENCE,
  normalizeExpenseAudience,
  resolvePayerForInsert,
  TRANSACTION_STATUS_COMPLETE,
  TRANSACTION_STATUS_PENDING,
} from '../types';

export { normalizeExpenseAudience };

function resolveExpenseAudienceForSave(value: ExpenseAudience): ExpenseAudience {
  return normalizeExpenseAudience(value);
}

function mapTransactionRow(row: Transaction): Transaction {
  return {
    ...row,
    expense_audience: normalizeExpenseAudience(row.expense_audience),
  };
}

/** Thêm giao dịch mới vào database */
export async function insertTransaction(data: TransactionFormData): Promise<number> {
  const db = await getDatabase();
  const createdAt = buildCreatedAt(data.transaction_date);
  const expenseAudience = resolveExpenseAudienceForSave(data.expense_audience);
  const payerToSave = resolvePayerForInsert(data.payer);

  const result = await db.runAsync(
    `INSERT INTO transactions
      (amount, type, category_id, source_id, payer, expense_audience, image_uri, location, note, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '${TRANSACTION_STATUS_COMPLETE}', ?);`,
    [
      parseInt(data.amount.replace(/\D/g, ''), 10) || 0,
      'chi',
      data.category_id,
      data.source_id,
      payerToSave,
      expenseAudience,
      data.image_uri,
      data.location,
      data.note,
      createdAt,
    ]
  );

  return result.lastInsertRowId;
}

/** Lưu ảnh tạm vào hộp thư chờ (status = 'pending') */
export async function insertPendingTransaction(imageUri: string): Promise<number> {
  const db = await getDatabase();

  const result = await db.runAsync(
    `INSERT INTO transactions
      (amount, type, payer, expense_audience, image_uri, status)
     VALUES (0, 'chi', 'Vợ', ?, ?, '${TRANSACTION_STATUS_PENDING}');`,
    [DEFAULT_EXPENSE_AUDIENCE, imageUri]
  );

  return result.lastInsertRowId;
}

/** Lấy giao dịch theo tháng — optional filter sources.spending_group (Home monitoring) */
export async function getTransactionsByMonth(
  year: number,
  month: number,
  spendingGroup?: SourceSpendingGroup | null,
): Promise<Transaction[]> {
  const db = await getDatabase();
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const groupSql = spendingGroupEqualsClause(spendingGroup, 's.spending_group');

  const rows = await db.getAllAsync<Transaction>(
    `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
            s.name as source_name
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN sources s    ON t.source_id   = s.id
     WHERE t.status = '${TRANSACTION_STATUS_COMPLETE}'
       AND strftime('%Y-%m', t.created_at) = ?
       ${groupSql.clause}
     ORDER BY t.created_at DESC;`,
    [monthStr, ...groupSql.params]
  );
  return rows.map(mapTransactionRow);
}

/** Lấy giao dịch theo id */
export async function getTransactionById(id: number): Promise<Transaction | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Transaction>(
    `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
            s.name as source_name
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN sources s    ON t.source_id   = s.id
     WHERE t.id = ?;`,
    [id]
  );
  return row ? mapTransactionRow(row) : null;
}

/** Cập nhật giao dịch đã hoàn thành — giữ nguyên type legacy khi sửa */
export async function updateTransaction(id: number, data: TransactionFormData): Promise<void> {
  const db = await getDatabase();
  const existing = await getTransactionById(id);
  if (!existing) return;

  const createdAt = buildCreatedAt(data.transaction_date);
  const expenseAudience = resolveExpenseAudienceForSave(data.expense_audience);
  const typeToSave = existing.type;

  // Không ghi đè payer: form P1.5 không expose field này.
  await db.runAsync(
    `UPDATE transactions
     SET amount = ?, type = ?, category_id = ?, source_id = ?,
         expense_audience = ?, location = ?, note = ?, created_at = ?
     WHERE id = ?;`,
    [
      parseInt(data.amount.replace(/\D/g, ''), 10) || 0,
      typeToSave,
      data.category_id,
      data.source_id,
      expenseAudience,
      data.location,
      data.note,
      createdAt,
      id,
    ]
  );
}

/** Xoá giao dịch */
export async function deleteTransaction(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM transactions WHERE id = ?;', [id]);
}

/** Tổng chi hôm nay */
export async function getTodaySummary(): Promise<{ chi: number; count: number }> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number; cnt: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt
     FROM transactions
     WHERE status = '${TRANSACTION_STATUS_COMPLETE}'
       AND type = 'chi'
       AND date(created_at) = date('now', 'localtime');`
  );
  return { chi: row?.total ?? 0, count: row?.cnt ?? 0 };
}

/** Tổng chi theo tháng (month 1-based: 1=Jan … 12=Dec). Mặc định: tháng hiện tại theo local time. */
export async function getMonthSummary(
  year?: number,
  month?: number,
  spendingGroup?: SourceSpendingGroup | null,
): Promise<{ chi: number }> {
  const db = await getDatabase();
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1; // 1-based, khớp getTransactionsByMonth
  const monthStr = `${y}-${String(m).padStart(2, '0')}`;
  const groupSql = spendingGroupEqualsClause(spendingGroup, 's.spending_group');
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(t.amount), 0) as total
     FROM transactions t
     LEFT JOIN sources s ON s.id = t.source_id
     WHERE t.status = '${TRANSACTION_STATUS_COMPLETE}'
       AND t.type = 'chi'
       AND strftime('%Y-%m', t.created_at) = ?
       ${groupSql.clause};`,
    [monthStr, ...groupSql.params]
  );
  return { chi: row?.total ?? 0 };
}

// ── Period filter helper ─────────────────────────────────────
type Period = 'month' | 'year' | 'all';

function periodWhere(period: Period): { clause: string; params: string[] } {
  const now = new Date();
  if (period === 'month') {
    const m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return { clause: `AND strftime('%Y-%m', created_at) = ?`, params: [m] };
  }
  if (period === 'year') {
    return { clause: `AND strftime('%Y', created_at) = ?`, params: [String(now.getFullYear())] };
  }
  return { clause: '', params: [] };
}

/** Tổng chi theo kỳ (báo cáo nguồn chi) */
export async function getAccountSummary(
  period: Period = 'month'
): Promise<{ chi: number }> {
  const db = await getDatabase();
  const { clause, params } = periodWhere(period);
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM transactions
     WHERE status = '${TRANSACTION_STATUS_COMPLETE}' AND type = 'chi' ${clause};`,
    params
  );
  return { chi: row?.total ?? 0 };
}

/** Chi theo từng nguồn chi trong kỳ */
export async function getSourceBalances(period: Period = 'month'): Promise<
  Array<{ source_id: number | null; source_name: string; chi: number }>
> {
  const db = await getDatabase();
  const { clause, params } = periodWhere(period);
  const rows = await db.getAllAsync<{
    source_id: number | null;
    source_name: string;
    total: number;
  }>(
    `SELECT t.source_id,
            COALESCE(s.name, 'Không rõ nguồn') as source_name,
            SUM(t.amount) as total
     FROM transactions t
     LEFT JOIN sources s ON t.source_id = s.id
     WHERE t.status = '${TRANSACTION_STATUS_COMPLETE}' AND t.type = 'chi' ${clause}
     GROUP BY t.source_id
     ORDER BY total DESC;`,
    params
  );

  return rows.map((r) => ({
    source_id: r.source_id,
    source_name: r.source_name,
    chi: r.total,
  }));
}

/** Lấy giao dịch theo năm */
export async function getTransactionsByYear(year: number): Promise<Transaction[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Transaction>(
    `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
            s.name as source_name
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN sources s    ON t.source_id   = s.id
     WHERE t.status = '${TRANSACTION_STATUS_COMPLETE}'
       AND strftime('%Y', t.created_at) = ?
     ORDER BY t.created_at DESC;`,
    [String(year)]
  );
  return rows.map(mapTransactionRow);
}

/** Lấy tất cả giao dịch đã hoàn thành */
export async function getAllTransactionsComplete(): Promise<Transaction[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Transaction>(
    `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
            s.name as source_name
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN sources s    ON t.source_id   = s.id
     WHERE t.status = '${TRANSACTION_STATUS_COMPLETE}'
     ORDER BY t.created_at DESC;`
  );
  return rows.map(mapTransactionRow);
}

/** Giao dịch gần đây nhất */
export async function getRecentTransactions(limit = 20): Promise<Transaction[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Transaction>(
    `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE t.status = '${TRANSACTION_STATUS_COMPLETE}'
     ORDER BY t.created_at DESC
     LIMIT ?;`,
    [limit]
  );
  return rows.map(mapTransactionRow);
}
