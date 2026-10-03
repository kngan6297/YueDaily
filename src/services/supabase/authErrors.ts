// ============================================================
// P2.1 — Normalize Supabase Auth errors for Vietnamese UI
// Never surface raw provider payloads to end users.
// ============================================================

export type AuthUserFacingErrorKind =
  | 'invalid_credentials'
  | 'network'
  | 'rate_limited'
  | 'not_configured'
  | 'unknown';

export function classifyAuthError(err: unknown): AuthUserFacingErrorKind {
  if (err == null) return 'unknown';

  const message =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message?: unknown }).message ?? '')
      : err instanceof Error
        ? err.message
        : String(err);
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: unknown }).status)
      : NaN;
  const lower = message.toLowerCase();

  if (
    lower.includes('not configured') ||
    lower.includes('missing supabase') ||
    lower.includes('supabase chưa')
  ) {
    return 'not_configured';
  }
  if (
    status === 400 ||
    lower.includes('invalid login') ||
    lower.includes('invalid credentials') ||
    lower.includes('email not confirmed') ||
    lower.includes('invalid_grant')
  ) {
    return 'invalid_credentials';
  }
  if (status === 429 || lower.includes('rate limit') || lower.includes('too many')) {
    return 'rate_limited';
  }
  if (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('failed to fetch') ||
    lower.includes('timeout')
  ) {
    return 'network';
  }
  return 'unknown';
}

export function authErrorMessageVi(kind: AuthUserFacingErrorKind): string {
  switch (kind) {
    case 'invalid_credentials':
      return 'Email hoặc mật khẩu không đúng.';
    case 'network':
      return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
    case 'rate_limited':
      return 'Thử quá nhiều lần. Đợi một lát rồi thử lại.';
    case 'not_configured':
      return 'Supabase chưa được cấu hình cho bản Web.';
    default:
      return 'Không thể đăng nhập lúc này. Thử lại sau.';
  }
}

export function normalizeAuthErrorMessage(err: unknown): string {
  return authErrorMessageVi(classifyAuthError(err));
}
