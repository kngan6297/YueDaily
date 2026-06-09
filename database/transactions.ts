// ============================================================
// CÁC HÀM THAO TÁC VỚI BẢNG TRANSACTIONS
// ============================================================

import { getDatabase } from './initDb';
import type { Transaction, TransactionFormData, TransactionStatus } from '../types';

/** Thêm giao dịch mới vào database */
export async function insertTransaction(data: TransactionFormData): Promise<number> {
  const db = await getDatabase();

  const result = await db.runAsync(
    `INSERT INTO transactions
      (amount, type, category_id, source_id, payer, image_uri, location, note, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'complete');`,
    [
      parseInt(data.amount.replace(/\D/g, ''), 10) || 0,
      data.type,
      data.category_id,
      data.source_id,
      data.payer,
      data.image_uri,
      data.location,
      data.note,
    ]
  );

  return result.lastInsertRowId;
}

/** Lưu ảnh tạm vào hộp thư chờ (status = 'pending') */
export async function insertPendingTransaction(imageUri: string): Promise<number> {
  const db = await getDatabase();

  const result = await db.runAsync(
    `INSERT INTO transactions
      (amount, type, payer, image_uri, status)
     VALUES (0, 'chi', 'Vợ', ?, 'pending');`,
    [imageUri]
  );

  return result.lastInsertRowId;
}

/** Hoàn thành giao dịch đang chờ (cập nhật từ pending -> complete) */
export async function completePendingTransaction(
  id: number,
  data: TransactionFormData
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE transactions
     SET amount = ?, type = ?, category_id = ?, source_id = ?,
         payer = ?, location = ?, note = ?, status = 'complete'
     WHERE id = ?;`,
    [
      parseInt(data.amount.replace(/\D/g, ''), 10) || 0,
      data.type,
      data.category_id,
      data.source_id,
      data.payer,
      data.location,
      data.note,
      id,
    ]
  );
}

/** Lấy danh sách giao dịch đang chờ xử lý */
export async function getPendingTransactions(): Promise<Transaction[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Transaction>(
    `SELECT * FROM transactions WHERE status = 'pending' ORDER BY created_at DESC;`
  );
}

/** Đếm số giao dịch đang chờ */
export async function countPendingTransactions(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM transactions WHERE status = 'pending';`
  );
  return result?.count ?? 0;
}

/** Lấy giao dịch theo tháng */
export async function getTransactionsByMonth(
  year: number,
  month: number
): Promise<Transaction[]> {
  const db = await getDatabase();
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  return await db.getAllAsync<Transaction>(
    `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
            s.name as source_name
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN sources s    ON t.source_id   = s.id
     WHERE t.status = 'complete'
       AND strftime('%Y-%m', t.created_at) = ?
     ORDER BY t.created_at DESC;`,
    [monthStr]
  );
}

/** Lấy giao dịch theo id */
export async function getTransactionById(id: number): Promise<Transaction | null> {
  const db = await getDatabase();
  return await db.getFirstAsync<Transaction>(
    `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
            s.name as source_name
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN sources s    ON t.source_id   = s.id
     WHERE t.id = ?;`,
    [id]
  );
}

/** Cập nhật giao dịch đã hoàn thành */
export async function updateTransaction(id: number, data: TransactionFormData): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE transactions
     SET amount = ?, type = ?, category_id = ?, source_id = ?,
         payer = ?, location = ?, note = ?
     WHERE id = ?;`,
    [
      parseInt(data.amount.replace(/\D/g, ''), 10) || 0,
      data.type,
      data.category_id,
      data.source_id,
      data.payer,
      data.location,
      data.note,
      id,
    ]
  );
}

/** Xoá giao dịch */
export async function deleteTransaction(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM transactions WHERE id = ?;', [id]);
}

/** Tổng thu/chi hôm nay */
export async function getTodaySummary(): Promise<{ chi: number; thu: number; count: number }> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ type: string; total: number; cnt: number }>(
    `SELECT type, SUM(amount) as total, COUNT(*) as cnt
     FROM transactions
     WHERE status = 'complete' AND date(created_at) = date('now', 'localtime')
     GROUP BY type;`
  );
  let chi = 0, thu = 0, count = 0;
  for (const r of rows) {
    if (r.type === 'chi') chi = r.total;
    if (r.type === 'thu') thu = r.total;
    count += r.cnt;
  }
  return { chi, thu, count };
}

/** Tổng thu/chi tháng hiện tại */
export async function getMonthSummary(): Promise<{ chi: number; thu: number }> {
  const db = await getDatabase();
  const monthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  const rows = await db.getAllAsync<{ type: string; total: number }>(
    `SELECT type, SUM(amount) as total
     FROM transactions
     WHERE status = 'complete' AND strftime('%Y-%m', created_at) = ?
     GROUP BY type;`,
    [monthStr]
  );
  let chi = 0, thu = 0;
  for (const r of rows) {
    if (r.type === 'chi') chi = r.total;
    if (r.type === 'thu') thu = r.total;
  }
  return { chi, thu };
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

/** Tổng thu/chi/số dư theo kỳ */
export async function getAccountSummary(
  period: Period = 'month'
): Promise<{ thu: number; chi: number; balance: number }> {
  const db = await getDatabase();
  const { clause, params } = periodWhere(period);
  const rows = await db.getAllAsync<{ type: string; total: number }>(
    `SELECT type, SUM(amount) as total
     FROM transactions
     WHERE status = 'complete' ${clause}
     GROUP BY type;`,
    params
  );
  let chi = 0, thu = 0;
  for (const r of rows) {
    if (r.type === 'chi') chi = r.total;
    if (r.type === 'thu') thu = r.total;
  }
  return { thu, chi, balance: thu - chi };
}

/** Số dư theo từng nguồn tiền */
export async function getSourceBalances(period: Period = 'month'): Promise<
  Array<{ source_id: number | null; source_name: string; thu: number; chi: number; balance: number }>
> {
  const db = await getDatabase();
  const { clause, params } = periodWhere(period);
  const rows = await db.getAllAsync<{
    source_id: number | null;
    source_name: string;
    type: string;
    total: number;
  }>(
    `SELECT t.source_id,
            COALESCE(s.name, 'Không rõ') as source_name,
            t.type,
            SUM(t.amount) as total
     FROM transactions t
     LEFT JOIN sources s ON t.source_id = s.id
     WHERE t.status = 'complete' ${clause}
     GROUP BY t.source_id, t.type;`,
    params
  );

  const map = new Map<string, { source_id: number | null; source_name: string; thu: number; chi: number }>();
  for (const r of rows) {
    const key = String(r.source_id ?? 'null');
    if (!map.has(key)) {
      map.set(key, { source_id: r.source_id, source_name: r.source_name, thu: 0, chi: 0 });
    }
    const entry = map.get(key)!;
    if (r.type === 'thu') entry.thu += r.total;
    if (r.type === 'chi') entry.chi += r.total;
  }

  return Array.from(map.values()).map((e) => ({
    ...e,
    balance: e.thu - e.chi,
  })).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
}

/** Lấy giao dịch theo năm */
export async function getTransactionsByYear(year: number): Promise<Transaction[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Transaction>(
    `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
            s.name as source_name
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN sources s    ON t.source_id   = s.id
     WHERE t.status = 'complete'
       AND strftime('%Y', t.created_at) = ?
     ORDER BY t.created_at DESC;`,
    [String(year)]
  );
}

/** Lấy tất cả giao dịch đã hoàn thành */
export async function getAllTransactionsComplete(): Promise<Transaction[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Transaction>(
    `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
            s.name as source_name
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN sources s    ON t.source_id   = s.id
     WHERE t.status = 'complete'
     ORDER BY t.created_at DESC;`
  );
}

/** Giao dịch gần đây nhất */
export async function getRecentTransactions(limit = 20): Promise<Transaction[]> {
  const db = await getDatabase();
  return db.getAllAsync<Transaction>(
    `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE t.status = 'complete'
     ORDER BY t.created_at DESC
     LIMIT ?;`,
    [limit]
  );
}
