// ============================================================
// ĐỊNH NGHĨA KIỂU DỮ LIỆU CHO TOÀN BỘ ỨNG DỤNG YOZAKURA
// ============================================================

/** Trạng thái giao dịch */
export type TransactionStatus = 'complete' | 'pending';

export const TRANSACTION_STATUS_COMPLETE: TransactionStatus = 'complete';
export const TRANSACTION_STATUS_PENDING: TransactionStatus = 'pending';

/** Loại giao dịch — legacy DB column; app chỉ ghi `chi` */
export type TransactionType = 'thu' | 'chi';

/** Ai được hưởng khoản chi */
export type ExpenseAudience =
  | 'wife'
  | 'husband'
  | 'couple'
  | 'couple_and_sister'
  | 'unspecified';

export const EXPENSE_AUDIENCE_LABELS: Record<ExpenseAudience, string> = {
  wife: 'Vợ',
  husband: 'Chồng',
  couple: '2 vợ chồng',
  couple_and_sister: '2 vợ chồng + em gái',
  unspecified: 'Chưa phân loại',
};

/** 4 lựa chọn khi tạo/sửa (không gồm unspecified) */
export const EXPENSE_AUDIENCE_CHOICES: Exclude<ExpenseAudience, 'unspecified'>[] = [
  'wife',
  'husband',
  'couple',
  'couple_and_sister',
];

export const DEFAULT_EXPENSE_AUDIENCE: ExpenseAudience = 'couple';

/** Người chi tiêu — tên lưu trong giao dịch, danh sách quản lý ở bảng payers */
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

/** Cấu trúc bảng nguồn tiền */
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
  payer: Payer;
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
