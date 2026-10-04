import { ReceiptAiError } from './errors';

/** Conservative ceiling for a 1024px / q0.7 JPEG receipt. */
export const MAX_PROCESSED_JPEG_BYTES = 1_500_000;

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i;

/**
 * Cheap pre-check before decoding. Some browsers report an empty or generic MIME
 * for camera/HEIC files, so fall back to the file extension.
 */
export function isLikelyImageFile(file: { type: string; name?: string }): boolean {
  const type = (file.type ?? '').toLowerCase().trim();
  if (type.startsWith('image/')) return true;
  if (type === '' || type === 'application/octet-stream') {
    return IMAGE_EXTENSIONS.test(file.name ?? '');
  }
  return false;
}

export function assertProcessedJpegSize(bytes: number): void {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new ReceiptAiError(
      'image_processing_failed',
      'Không xử lý được ảnh bill này. Thử chọn lại ảnh hoặc chụp lại nhé.',
    );
  }
  if (bytes > MAX_PROCESSED_JPEG_BYTES) {
    throw new ReceiptAiError(
      'image_processing_failed',
      'Ảnh sau khi xử lý vẫn quá lớn. Thử chụp lại gần hơn hoặc chọn ảnh khác nhé.',
    );
  }
}
