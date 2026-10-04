/** Error codes returned by the `analyze-receipt` Edge Function (P2.3). */
export const EDGE_ERROR_UNAUTHENTICATED = 'UNAUTHENTICATED';
export const EDGE_ERROR_INVALID_IMAGE = 'INVALID_IMAGE';
export const EDGE_ERROR_IMAGE_TOO_LARGE = 'IMAGE_TOO_LARGE';
export const EDGE_ERROR_AI_UNAVAILABLE = 'AI_UNAVAILABLE';
export const EDGE_ERROR_AI_MALFORMED_RESPONSE = 'AI_MALFORMED_RESPONSE';
export const EDGE_ERROR_RATE_LIMITED = 'RATE_LIMITED';
export const EDGE_ERROR_INTERNAL_ERROR = 'INTERNAL_ERROR';

export const EDGE_ERROR_CODES = [
  EDGE_ERROR_UNAUTHENTICATED,
  EDGE_ERROR_INVALID_IMAGE,
  EDGE_ERROR_IMAGE_TOO_LARGE,
  EDGE_ERROR_AI_UNAVAILABLE,
  EDGE_ERROR_AI_MALFORMED_RESPONSE,
  EDGE_ERROR_RATE_LIMITED,
  EDGE_ERROR_INTERNAL_ERROR,
] as const;

export type EdgeErrorCode = (typeof EDGE_ERROR_CODES)[number];

export function isEdgeErrorCode(value: unknown): value is EdgeErrorCode {
  return (
    typeof value === 'string' &&
    (EDGE_ERROR_CODES as readonly string[]).includes(value)
  );
}

export const ANALYZE_RECEIPT_FUNCTION = 'analyze-receipt';
/** Multipart field name expected by the Edge Function. */
export const ANALYZE_RECEIPT_IMAGE_FIELD = 'image';
