// ============================================================
// ĐỊNH NGHĨA KIỂU DỮ LIỆU CHO TOÀN BỘ ỨNG DỤNG YOZAKURA
// ============================================================

/** Trạng thái giao dịch */
export type TransactionStatus = 'complete' | 'pending';

/** Loại giao dịch */
export type TransactionType = 'thu' | 'chi';

/** Người chi tiêu */
export type Payer = 'Vợ' | 'Chồng';

/** Cấu trúc bảng giao dịch */
export interface Transaction {
  id: number;
  amount: number;
  type: TransactionType;
  category_id: number | null;
  source_id: number | null;
  payer: Payer;
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
  amount?: number;
  location?: string;
  category?: string;
  note?: string;
  type?: TransactionType;
}

/** Dữ liệu form nhập liệu giao dịch */
export interface TransactionFormData {
  amount: string;
  type: TransactionType;
  category_id: number | null;
  source_id: number | null;
  payer: Payer;
  image_uri: string | null;
  location: string;
  note: string;
}

/** Ảnh chờ xử lý trong Hộp Thư Chờ */
export interface PendingImage {
  id: string;        // UUID tạm thời
  image_uri: string;
  created_at: string;
}
