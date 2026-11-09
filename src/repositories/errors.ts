// ============================================================
// Normalize SQLite data-layer errors → safe Vietnamese UI copy
// Never surface raw SQLite constraint strings to users.
// ============================================================

export type DataErrorCode =
  | 'duplicate'
  | 'referenced'
  | 'validation'
  | 'unknown';

export class DataError extends Error {
  readonly code: DataErrorCode;
  readonly domain: string;

  constructor(code: DataErrorCode, domain: string, message: string) {
    super(message);
    this.name = 'DataError';
    this.code = code;
    this.domain = domain;
  }
}

const FRIENDLY: Record<DataErrorCode, string> = {
  duplicate: 'Tên này đã tồn tại. Hãy chọn tên khác.',
  referenced: 'Không thể xoá vì đang được giao dịch sử dụng.',
  validation: 'Dữ liệu không hợp lệ. Kiểm tra lại và thử lại.',
  unknown: 'Có lỗi xảy ra. Thử lại sau giây lát.',
};

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return '';
}

/** Map expo-sqlite constraint failures / unknown errors → DataError with safe UI copy. */
export function normalizeDataError(err: unknown, domain: string): DataError {
  if (err instanceof DataError) return err;

  const msg = errorMessage(err);
  if (msg.includes('UNIQUE constraint failed')) {
    return new DataError('duplicate', domain, FRIENDLY.duplicate);
  }
  if (msg.includes('FOREIGN KEY constraint failed')) {
    return new DataError('referenced', domain, FRIENDLY.referenced);
  }
  if (msg.includes('NOT NULL constraint failed') || msg.includes('CHECK constraint failed')) {
    return new DataError('validation', domain, FRIENDLY.validation);
  }

  return new DataError('unknown', domain, FRIENDLY.unknown);
}

export function userMessageForDataError(err: unknown, domain = 'data'): string {
  return normalizeDataError(err, domain).message;
}
