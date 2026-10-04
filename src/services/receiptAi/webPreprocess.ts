/**
 * P2.3 — Browser-only receipt preprocess: File -> resized JPEG Blob.
 * DOM access is injectable so the pipeline can be unit-tested in Node.
 */

import { RECEIPT_AI_JPEG_QUALITY, RECEIPT_AI_RESIZE_WIDTH } from './config';
import { ReceiptAiError } from './errors';
import { assertProcessedJpegSize, isLikelyImageFile } from './webImageValidate';

export interface DecodedImage {
  width: number;
  height: number;
  /** Opaque drawable (HTMLImageElement in the browser). */
  source: unknown;
}

export interface WebPreprocessDeps {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  loadImage: (url: string) => Promise<DecodedImage>;
  renderJpeg: (
    image: DecodedImage,
    width: number,
    height: number,
    quality: number,
  ) => Promise<Blob>;
}

export const WEB_DECODE_FAILED_MESSAGE =
  'Không đọc được ảnh này. Ảnh HEIC có thể chưa được trình duyệt hỗ trợ — hãy chọn ảnh JPG/PNG hoặc chụp lại bằng camera nhé.';

/** Scale down so the long edge <= maxLongEdge. Never upscales; keeps aspect ratio. */
export function computeTargetSize(
  width: number,
  height: number,
  maxLongEdge: number,
): { width: number; height: number } {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new ReceiptAiError(
      'image_decode_failed',
      WEB_DECODE_FAILED_MESSAGE,
    );
  }
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function defaultLoadImage(url: string): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        source: img,
      });
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = url;
  });
}

function defaultRenderJpeg(
  image: DecodedImage,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('canvas unavailable'));
      return;
    }
    // JPEG has no alpha — avoid black background for transparent PNG/WebP.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image.source as CanvasImageSource, 0, 0, width, height);
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
      'image/jpeg',
      quality,
    );
  });
}

function defaultDeps(): WebPreprocessDeps {
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    loadImage: defaultLoadImage,
    renderJpeg: defaultRenderJpeg,
  };
}

export async function preprocessReceiptFile(
  file: File,
  deps: Partial<WebPreprocessDeps> = {},
): Promise<Blob> {
  if (!isLikelyImageFile(file)) {
    throw new ReceiptAiError(
      'image_load_failed',
      'Tệp đã chọn không phải ảnh. Hãy chọn ảnh bill (JPG/PNG) nhé.',
    );
  }

  const d: WebPreprocessDeps = { ...defaultDeps(), ...deps };
  const url = d.createObjectURL(file);
  try {
    let decoded: DecodedImage;
    try {
      decoded = await d.loadImage(url);
    } catch {
      throw new ReceiptAiError('image_decode_failed', WEB_DECODE_FAILED_MESSAGE);
    }

    const target = computeTargetSize(
      decoded.width,
      decoded.height,
      RECEIPT_AI_RESIZE_WIDTH,
    );

    let blob: Blob;
    try {
      blob = await d.renderJpeg(
        decoded,
        target.width,
        target.height,
        RECEIPT_AI_JPEG_QUALITY,
      );
    } catch {
      throw new ReceiptAiError(
        'image_processing_failed',
        'Không xử lý được ảnh bill này. Thử chọn lại ảnh hoặc chụp lại nhé.',
      );
    }

    assertProcessedJpegSize(blob.size);
    return blob;
  } finally {
    d.revokeObjectURL(url);
  }
}
