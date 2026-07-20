/** YYYY-MM-DD theo giờ local */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD HH:MM:SS theo giờ local */
export function formatLocalDateTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${formatLocalDate(d)} ${h}:${min}:${s}`;
}

/** Lấy YYYY-MM-DD từ created_at SQLite */
export function dateFromCreatedAt(createdAt: string): string {
  return createdAt.slice(0, 10);
}

/** Parse YYYY-MM-DD → Date local (tránh lệch timezone) */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** created_at cho INSERT/UPDATE — hôm nay giữ giờ thực, ngày cũ dùng 12:00 */
export function buildCreatedAt(transactionDate: string): string {
  const today = formatLocalDate(new Date());
  if (transactionDate === today) return formatLocalDateTime(new Date());
  return `${transactionDate} 12:00:00`;
}

export function formatDateVi(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
