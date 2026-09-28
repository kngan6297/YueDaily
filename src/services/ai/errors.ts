// ============================================================
// Shared AI provider error classification (text + reusable by receipt)
// ============================================================

import { METRO_ENV_RESTART_HINT } from './env';

/** Provider/transport failure kinds shared across receipt + spending chat. */
export type AiProviderErrorKind =
  | 'missing_key'
  | 'invalid_key'
  | 'permission_denied'
  | 'model_unavailable'
  | 'rate_limited'
  | 'quota_or_billing'
  | 'server_error'
  | 'network_error'
  | 'timeout'
  | 'invalid_response'
  | 'all_providers_failed';

export interface ProviderAttemptFailure {
  provider: string;
  model?: string;
  kind: AiProviderErrorKind;
  httpStatus?: number;
}

export class TextAiError extends Error {
  readonly kind: AiProviderErrorKind;

  constructor(kind: AiProviderErrorKind, message: string) {
    super(message);
    this.name = 'TextAiError';
    this.kind = kind;
  }
}

/** Recoverable failures allow trying the next provider/model (text path). */
export function isRecoverableProviderFailure(kind: AiProviderErrorKind): boolean {
  if (kind === 'missing_key' || kind === 'network_error' || kind === 'timeout') {
    return false;
  }
  return (
    kind === 'invalid_key' ||
    kind === 'permission_denied' ||
    kind === 'model_unavailable' ||
    kind === 'rate_limited' ||
    kind === 'quota_or_billing' ||
    kind === 'server_error' ||
    kind === 'invalid_response'
  );
}

export function classifyHttpFailure(
  status: number,
  errorMessage: string,
): AiProviderErrorKind {
  const msg = errorMessage.toLowerCase();

  if (status === 401) return 'invalid_key';

  if (status === 403) {
    if (
      msg.includes('api key') ||
      msg.includes('invalid') ||
      msg.includes('unauthorized')
    ) {
      return 'invalid_key';
    }
    return 'permission_denied';
  }

  if (
    status === 404 ||
    msg.includes('not found') ||
    msg.includes('does not exist') ||
    msg.includes('unsupported') ||
    msg.includes('modality')
  ) {
    return 'model_unavailable';
  }

  if (status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
    return 'rate_limited';
  }

  if (
    msg.includes('quota') ||
    msg.includes('billing') ||
    msg.includes('exceeded') ||
    msg.includes('resource exhausted')
  ) {
    return 'quota_or_billing';
  }

  if (status === 413) return 'model_unavailable';

  if (status >= 500 || status === 503) return 'server_error';

  return 'invalid_response';
}

export function userMessageForProviderKind(
  kind: AiProviderErrorKind,
  opts: { dev?: boolean; feature?: 'receipt' | 'chat' } = {},
): string {
  const { dev = false, feature = 'chat' } = opts;
  switch (kind) {
    case 'missing_key':
      return dev
        ? `Chưa cấu hình AI cho môi trường này.\n\n(Dev: ${METRO_ENV_RESTART_HINT})`
        : 'Chưa cấu hình AI cho môi trường này.';
    case 'invalid_key':
      return 'API key AI không hợp lệ hoặc không còn quyền truy cập.';
    case 'permission_denied':
      return 'API key hoặc quyền truy cập API đang bị từ chối.';
    case 'model_unavailable':
      return 'Dịch vụ AI hiện chưa hỗ trợ model được cấu hình.';
    case 'rate_limited':
    case 'quota_or_billing':
      return 'AI đang tạm hết lượt hoặc quá tải. Thử lại sau nhé.';
    case 'network_error':
    case 'timeout':
      return 'Không kết nối được dịch vụ AI. Kiểm tra mạng rồi thử lại.';
    case 'server_error':
    case 'invalid_response':
    case 'all_providers_failed':
    default:
      return feature === 'receipt'
        ? 'Chưa thể đọc bill bằng AI lúc này. Bạn vẫn có thể nhập tay.'
        : 'Chưa thể trả lời bằng AI lúc này. Dữ liệu chi tiêu vẫn xem được bình thường.';
  }
}

/** Pick the most actionable message when every provider/model failed. */
export function finalFailureMessage(
  failures: ProviderAttemptFailure[],
  opts: { dev?: boolean; feature?: 'receipt' | 'chat' } = {},
): string {
  const { dev = false, feature = 'chat' } = opts;
  if (failures.length === 0) {
    return userMessageForProviderKind('missing_key', { dev, feature });
  }

  const kinds = failures.map((f) => f.kind);

  if (kinds.every((k) => k === 'missing_key')) {
    return userMessageForProviderKind('missing_key', { dev, feature });
  }

  if (kinds.some((k) => k === 'network_error' || k === 'timeout')) {
    return userMessageForProviderKind('network_error', { dev, feature });
  }

  if (kinds.every((k) => k === 'rate_limited' || k === 'quota_or_billing')) {
    return userMessageForProviderKind('rate_limited', { dev, feature });
  }

  if (kinds.some((k) => k === 'rate_limited' || k === 'quota_or_billing')) {
    return userMessageForProviderKind('rate_limited', { dev, feature });
  }

  if (kinds.every((k) => k === 'model_unavailable')) {
    return userMessageForProviderKind('model_unavailable', { dev, feature });
  }

  const authKinds = new Set<AiProviderErrorKind>(['invalid_key', 'permission_denied']);
  if (kinds.every((k) => authKinds.has(k))) {
    if (kinds.includes('permission_denied') && !kinds.includes('invalid_key')) {
      return userMessageForProviderKind('permission_denied', { dev, feature });
    }
    return userMessageForProviderKind('invalid_key', { dev, feature });
  }

  if (kinds.some((k) => authKinds.has(k))) {
    return userMessageForProviderKind('invalid_key', { dev, feature });
  }

  return userMessageForProviderKind('all_providers_failed', { dev, feature });
}

export function textAiErrorFromKind(
  kind: AiProviderErrorKind,
  opts: { dev?: boolean; feature?: 'receipt' | 'chat' } = {},
): TextAiError {
  return new TextAiError(kind, userMessageForProviderKind(kind, opts));
}
