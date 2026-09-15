import { METRO_ENV_RESTART_HINT } from './env';

export type ReceiptAiErrorKind =
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
  kind: ReceiptAiErrorKind;
  httpStatus?: number;
}

export class ReceiptAiError extends Error {
  readonly kind: ReceiptAiErrorKind;

  constructor(kind: ReceiptAiErrorKind, message: string) {
    super(message);
    this.name = 'ReceiptAiError';
    this.kind = kind;
  }
}

/** Recoverable failures allow trying the next provider/model. */
export function isRecoverableFailure(kind: ReceiptAiErrorKind): boolean {
  return (
    kind === 'invalid_key' ||
    kind === 'permission_denied' ||
    kind === 'model_unavailable' ||
    kind === 'rate_limited' ||
    kind === 'quota_or_billing' ||
    kind === 'server_error' ||
    kind === 'timeout' ||
    kind === 'invalid_response'
  );
}

export function classifyHttpFailure(
  status: number,
  errorMessage: string,
): ReceiptAiErrorKind {
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

export function userMessageForKind(
  kind: ReceiptAiErrorKind,
  dev = false,
): string {
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
      return 'Không kết nối được dịch vụ AI. Kiểm tra mạng rồi thử lại.';
    case 'timeout':
      return 'Không kết nối được dịch vụ AI. Kiểm tra mạng rồi thử lại.';
    case 'server_error':
    case 'invalid_response':
    case 'all_providers_failed':
    default:
      return 'Chưa thể đọc bill bằng AI lúc này. Bạn vẫn có thể nhập tay.';
  }
}

/** Pick the most actionable message when every provider/model failed. */
export function finalFailureMessage(
  failures: ProviderAttemptFailure[],
  dev = false,
): string {
  if (failures.length === 0) {
    return userMessageForKind('missing_key', dev);
  }

  const kinds = failures.map((f) => f.kind);

  if (kinds.every((k) => k === 'missing_key')) {
    return userMessageForKind('missing_key', dev);
  }

  if (kinds.some((k) => k === 'network_error' || k === 'timeout')) {
    return userMessageForKind('network_error', dev);
  }

  if (kinds.every((k) => k === 'rate_limited' || k === 'quota_or_billing')) {
    return userMessageForKind('rate_limited', dev);
  }

  if (kinds.some((k) => k === 'rate_limited' || k === 'quota_or_billing')) {
    return userMessageForKind('rate_limited', dev);
  }

  if (kinds.every((k) => k === 'model_unavailable')) {
    return userMessageForKind('model_unavailable', dev);
  }

  const authKinds = new Set<ReceiptAiErrorKind>(['invalid_key', 'permission_denied']);
  if (kinds.every((k) => authKinds.has(k))) {
    if (kinds.includes('permission_denied') && !kinds.includes('invalid_key')) {
      return userMessageForKind('permission_denied', dev);
    }
    return userMessageForKind('invalid_key', dev);
  }

  if (kinds.some((k) => authKinds.has(k))) {
    return userMessageForKind('invalid_key', dev);
  }

  return userMessageForKind('all_providers_failed', dev);
}

export function receiptAiErrorFromKind(
  kind: ReceiptAiErrorKind,
  dev = false,
): ReceiptAiError {
  return new ReceiptAiError(kind, userMessageForKind(kind, dev));
}
