/**
 * Maps `analyze-receipt` Edge errors to user-safe ReceiptAiError.
 * Never surfaces raw provider bodies or server-supplied message text.
 */

import {
  EDGE_ERROR_AI_MALFORMED_RESPONSE,
  EDGE_ERROR_AI_UNAVAILABLE,
  EDGE_ERROR_IMAGE_TOO_LARGE,
  EDGE_ERROR_INTERNAL_ERROR,
  EDGE_ERROR_INVALID_IMAGE,
  EDGE_ERROR_RATE_LIMITED,
  EDGE_ERROR_UNAUTHENTICATED,
  isEdgeErrorCode,
  type EdgeErrorCode,
} from './edgeErrorCodes';
import { ReceiptAiError, type ReceiptAiErrorKind } from './errors';

const GENERIC_MESSAGE = 'Chưa thể đọc bill bằng AI lúc này. Bạn vẫn có thể nhập tay.';

const EDGE_ERROR_MAP: Record<EdgeErrorCode, { kind: ReceiptAiErrorKind; message: string }> = {
  [EDGE_ERROR_UNAUTHENTICATED]: {
    kind: 'permission_denied',
    message: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại rồi quét bill nhé.',
  },
  [EDGE_ERROR_INVALID_IMAGE]: {
    kind: 'image_processing_failed',
    message: 'Ảnh không hợp lệ. Thử chọn lại ảnh hoặc chụp lại bill nhé.',
  },
  [EDGE_ERROR_IMAGE_TOO_LARGE]: {
    kind: 'image_processing_failed',
    message: 'Ảnh quá lớn. Thử chụp lại gần hơn hoặc chọn ảnh khác nhé.',
  },
  [EDGE_ERROR_AI_UNAVAILABLE]: {
    kind: 'server_error',
    message: 'Dịch vụ AI tạm thời chưa sẵn sàng. Bạn vẫn có thể nhập tay.',
  },
  [EDGE_ERROR_AI_MALFORMED_RESPONSE]: {
    kind: 'invalid_response',
    message: GENERIC_MESSAGE,
  },
  [EDGE_ERROR_RATE_LIMITED]: {
    kind: 'rate_limited',
    message: 'AI đang tạm hết lượt hoặc quá tải. Thử lại sau nhé.',
  },
  [EDGE_ERROR_INTERNAL_ERROR]: {
    kind: 'server_error',
    message: GENERIC_MESSAGE,
  },
};

export function receiptAiErrorFromEdgeCode(code: EdgeErrorCode): ReceiptAiError {
  const entry = EDGE_ERROR_MAP[code];
  return new ReceiptAiError(entry.kind, entry.message);
}

export function networkReceiptAiError(): ReceiptAiError {
  return new ReceiptAiError(
    'network_error',
    'Không kết nối được dịch vụ AI. Kiểm tra mạng rồi thử lại.',
  );
}

export function genericReceiptAiError(): ReceiptAiError {
  return new ReceiptAiError('server_error', GENERIC_MESSAGE);
}

/**
 * Extract a known edge error code from a response body. Accepts:
 * `{ error: { code } }`, `{ error: "CODE" }`, `{ code: "CODE" }`.
 * Unknown codes → null (caller falls back to a generic message).
 */
export function extractEdgeErrorCode(body: unknown): EdgeErrorCode | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (isEdgeErrorCode(b.code)) return b.code;
  const err = b.error;
  if (isEdgeErrorCode(err)) return err;
  if (err && typeof err === 'object') {
    const code = (err as Record<string, unknown>).code;
    if (isEdgeErrorCode(code)) return code;
  }
  return null;
}

function codeFromHttpStatus(status: unknown): EdgeErrorCode | null {
  if (status === 401 || status === 403) return EDGE_ERROR_UNAUTHENTICATED;
  if (status === 413) return EDGE_ERROR_IMAGE_TOO_LARGE;
  if (status === 429) return EDGE_ERROR_RATE_LIMITED;
  return null;
}

function looksLikeAuthFailure(error: unknown): boolean {
  const e = (error ?? {}) as { message?: unknown; name?: unknown };
  const message = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  const name = typeof e.name === 'string' ? e.name : '';
  if (name === 'AuthSessionMissingError') return true;
  if (name === 'AuthApiError') {
    return /session|jwt|token|expired|refresh|authenticated/i.test(message);
  }
  return /jwt|session.*(expired|missing)|not authenticated|invalid claim|refresh.?token/i.test(
    message,
  );
}

/** Convert a supabase-js `functions.invoke` error into ReceiptAiError. */
export async function receiptAiErrorFromInvokeError(
  error: unknown,
): Promise<ReceiptAiError> {
  if (error instanceof ReceiptAiError) return error;

  const e = (error ?? {}) as { name?: unknown; context?: unknown };

  if (e.name === 'FunctionsFetchError') return networkReceiptAiError();
  if (looksLikeAuthFailure(error)) {
    return receiptAiErrorFromEdgeCode(EDGE_ERROR_UNAUTHENTICATED);
  }

  const ctx = e.context as
    | { status?: unknown; json?: () => Promise<unknown> }
    | undefined;
  if (ctx && typeof ctx === 'object') {
    if (typeof ctx.json === 'function') {
      try {
        const code = extractEdgeErrorCode(await ctx.json());
        if (code) return receiptAiErrorFromEdgeCode(code);
      } catch {
        /* body not JSON — fall through to status */
      }
    }
    const byStatus = codeFromHttpStatus(ctx.status);
    if (byStatus) return receiptAiErrorFromEdgeCode(byStatus);
  }

  return genericReceiptAiError();
}
