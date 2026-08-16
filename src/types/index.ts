// ============================================================
// ĐỊNH NGHĨA KIỂU DỮ LIỆU CHO TOÀN BỘ ỨNG DỤNG YOZAKURA
// ============================================================

/** Trạng thái giao dịch */
export type TransactionStatus = 'complete' | 'pending';

export const TRANSACTION_STATUS_COMPLETE: TransactionStatus = 'complete';
export const TRANSACTION_STATUS_PENDING: TransactionStatus = 'pending';

/** Loại giao dịch — legacy DB column; app chỉ ghi `chi` */
export type TransactionType = 'thu' | 'chi';

/** Ai được hưởng khoản chi — identifier nội bộ giữ nguyên để migration an toàn */
export type ExpenseAudience =
  | 'wife'
  | 'husband'
  | 'couple'
  | 'wife_and_sister'
  | 'couple_and_sister'
  | 'unspecified';

/** Label UI P1.5 — Yue / Kai / Meo. Không đổi identifier nội bộ. */
export const EXPENSE_AUDIENCE_LABELS: Record<ExpenseAudience, string> = {
  wife: 'Yue',
  husband: 'Kai',
  couple: 'Yue + Kai',
  wife_and_sister: 'Yue + Meo',
  couple_and_sister: 'Yue + Kai + Meo',
  unspecified: 'Chưa phân loại',
};

export const EXPENSE_AUDIENCE_SHORT: Record<ExpenseAudience, string> = {
  ...EXPENSE_AUDIENCE_LABELS,
};

export const EXPENSE_AUDIENCE_ICONS: Record<ExpenseAudience, string> = {
  wife: '🌸',
  husband: '🌿',
  couple: '💑',
  wife_and_sister: '👭',
  couple_and_sister: '👨‍👩‍👧',
  unspecified: '❔',
};

/** Lựa chọn khi tạo giao dịch mới (không gồm unspecified) */
export const EXPENSE_AUDIENCE_CHOICES: Exclude<ExpenseAudience, 'unspecified'>[] = [
  'wife',
  'husband',
  'couple',
  'wife_and_sister',
  'couple_and_sister',
];

export const DEFAULT_EXPENSE_AUDIENCE: ExpenseAudience = 'couple';

export function isExpenseAudience(value: unknown): value is ExpenseAudience {
  return typeof value === 'string' && value in EXPENSE_AUDIENCE_LABELS;
}

/** NULL/giá trị lạ → unspecified. Không suy wife → wife_and_sister. */
export function normalizeExpenseAudience(value: unknown): ExpenseAudience {
  return isExpenseAudience(value) ? value : 'unspecified';
}

/**
 * Schema `payer` TEXT NOT NULL DEFAULT 'Vợ'.
 * Form P1.5 không nhập field này; giá trị mặc định khớp cột DB / user Yue.
 */
export const LEGACY_DEFAULT_PAYER = 'Vợ';

export function resolvePayerForInsert(payer: string | null | undefined): string {
  const trimmed = payer?.trim();
  return trimmed ? trimmed : LEGACY_DEFAULT_PAYER;
}

/** Người chi tiêu — legacy DB; không còn primary UX */
export type Payer = string;

/** Bản ghi người trả trong cài đặt */
export interface PayerRecord {
  id: number;
  name: string;
  icon: string;
  color: string;
}

/** Cấu trúc bảng giao dịch */
export interface Transaction {
  id: number;
  amount: number;
  type: TransactionType;
  category_id: number | null;
  source_id: number | null;
  payer: Payer;
  expense_audience: ExpenseAudience;
  image_uri: string | null;
  location: string | null;
  note: string | null;
  status: TransactionStatus;
  created_at: string; // ISO timestamp
}

/** Cấu trúc bảng danh mục */
export interface Category {
  id: number;
  name: string;
  type: TransactionType | 'both';
  icon: string;     // tên emoji hoặc icon
  color: string;    // mã màu HEX
}

/** Cấu trúc bảng nguồn chi (master data generic — không hardcode ngân hàng) */
export interface Source {
  id: number;
  name: string;
}

/** Cấu trúc bảng streak */
export interface Streak {
  id: number;
  current_streak: number;
  last_logged_date: string; // YYYY-MM-DD
}

/** Kết quả phân tích AI từ Gemini */
export interface GeminiAnalysisResult {
  is_receipt?: boolean;
  amount?: number;
  /** Một câu ngắn dạng "[Hành động] tại [Tên quán]" */
  description?: string;
  location?: string;
  category?: string;
  note?: string;
}

/** Dữ liệu form nhập liệu giao dịch */
export interface TransactionFormData {
  amount: string;
  type: TransactionType;
  category_id: number | null;
  source_id: number | null;
  /** Legacy — form P1.5 không gửi; insert dùng LEGACY_DEFAULT_PAYER */
  payer?: Payer;
  expense_audience: ExpenseAudience;
  image_uri: string | null;
  location: string;
  note: string;
  /** Ngày ghi sổ — YYYY-MM-DD (mặc định hôm nay) */
  transaction_date: string;
}

/** Ảnh chờ xử lý trong Hộp Thư Chờ */
export interface PendingImage {
  id: string;        // UUID tạm thời
  image_uri: string;
  created_at: string;
}
