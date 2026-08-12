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

/** YYYY-MM-DD hôm nay (local) */
export function todayLocal(): string {
  return formatLocalDate(new Date());
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Số ngày lịch trong kỳ tháng (tháng hiện tại: 1 → hôm nay) */
export function calendarDaysInMonthPeriod(year: number, month: number): number {
  const now = new Date();
  if (year === now.getFullYear() && month === now.getMonth() + 1) {
    return now.getDate();
  }
  return daysInMonth(year, month);
}

/** Số ngày inclusive giữa hai YYYY-MM-DD (local) */
export function daysInclusive(fromDate: string, toDate: string): number {
  const from = parseLocalDate(fromDate);
  const to = parseLocalDate(toDate);
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / 86_400_000) + 1;
}

/** Clamp date string — không cho vượt hôm nay */
export function clampDateToToday(dateStr: string): string {
  const today = todayLocal();
  return dateStr > today ? today : dateStr;
}

/** Swap nếu from > to; clamp future về hôm nay */
export function normalizeCustomRange(
  fromDate: string,
  toDate: string,
): { fromDate: string; toDate: string } {
  let from = clampDateToToday(fromDate);
  let to = clampDateToToday(toDate);
  if (from > to) {
    [from, to] = [to, from];
  }
  return { fromDate: from, toDate: to };
}
