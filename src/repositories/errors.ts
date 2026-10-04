// ============================================================
// P2.2 — Normalize data-layer errors for Web (and shared callers)
// Never surface raw PostgREST / Postgres strings to users.
// ============================================================

export type DataErrorCode =
  | 'unauthorized'
  | 'duplicate'
  | 'referenced'
  | 'validation'
  | 'network'
  | 'not_found'
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

function looksLikeNetwork(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { message?: string; name?: string; status?: number };
  const msg = (e.message ?? '').toLowerCase();
  return (
    e.name === 'TypeError' ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('failed to fetch') ||
    e.status === 0
  );
}

function postgresCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as { code?: string; details?: string };
  return typeof e.code === 'string' ? e.code : null;
}

function authLike(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; code?: string; message?: string };
  const msg = (e.message ?? '').toLowerCase();
  return (
    e.status === 401 ||
    e.status === 403 ||
    e.code === 'PGRST301' ||
    msg.includes('jwt') ||
    msg.includes('not authenticated') ||
    msg.includes('session')
  );
}

const FRIENDLY: Record<DataErrorCode, string> = {
  unauthorized: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  duplicate: 'Tên này đã tồn tại. Hãy chọn tên khác.',
  referenced: 'Không thể xoá vì đang được giao dịch sử dụng.',
  validation: 'Dữ liệu không hợp lệ. Kiểm tra lại và thử lại.',
  network: 'Không kết nối được. Kiểm tra mạng và thử lại.',
  not_found: 'Không tìm thấy dữ liệu.',
  unknown: 'Có lỗi xảy ra. Thử lại sau giây lát.',
};

/**
 * Map Supabase / PostgREST / unknown errors → DataError with safe UI copy.
 * __DEV__ callers may log code + domain only — never JWT / notes / payloads.
 */
export function normalizeDataError(err: unknown, domain: string): DataError {
  if (err instanceof DataError) return err;

  if (looksLikeNetwork(err)) {
    return new DataError('network', domain, FRIENDLY.network);
  }
  if (authLike(err)) {
    return new DataError('unauthorized', domain, FRIENDLY.unauthorized);
  }

  const code = postgresCode(err);
  if (code === '23505') {
    return new DataError('duplicate', domain, FRIENDLY.duplicate);
  }
  if (code === '23503') {
    return new DataError('referenced', domain, FRIENDLY.referenced);
  }
  if (code === '23514' || code === '22P02') {
    return new DataError('validation', domain, FRIENDLY.validation);
  }
  if (code === 'PGRST116') {
    return new DataError('not_found', domain, FRIENDLY.not_found);
  }

  return new DataError('unknown', domain, FRIENDLY.unknown);
}

export function userMessageForDataError(err: unknown, domain = 'data'): string {
  return normalizeDataError(err, domain).message;
}

/** Safe __DEV__ log — operation + domain + code only. */
export function logDataErrorDev(operation: string, domain: string, err: unknown): void {
  if (!__DEV__) return;
  const normalized = normalizeDataError(err, domain);
  console.warn(`[data] ${domain}.${operation} → ${normalized.code}`);
}
