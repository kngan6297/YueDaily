/** Kết quả phân tích AI cho bill (dùng chung native + web, không phụ thuộc UI/DB). */
export interface GeminiAnalysisResult {
  is_receipt?: boolean;
  amount?: number;
  /** Một câu ngắn dạng "[Hành động] tại [Tên quán]" */
  description?: string;
  location?: string;
  category?: string;
  note?: string;
}
