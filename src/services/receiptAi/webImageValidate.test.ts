import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertProcessedJpegSize,
  isLikelyImageFile,
  MAX_PROCESSED_JPEG_BYTES,
} from './webImageValidate.ts';

describe('isLikelyImageFile', () => {
  it('accepts image MIME types', () => {
    assert.equal(isLikelyImageFile({ type: 'image/jpeg', name: 'a.jpg' }), true);
    assert.equal(isLikelyImageFile({ type: 'image/heic' }), true);
    assert.equal(isLikelyImageFile({ type: 'IMAGE/PNG' }), true);
  });

  it('falls back to extension when MIME is empty or generic', () => {
    assert.equal(isLikelyImageFile({ type: '', name: 'IMG_1.HEIC' }), true);
    assert.equal(isLikelyImageFile({ type: 'application/octet-stream', name: 'x.png' }), true);
    assert.equal(isLikelyImageFile({ type: '', name: 'notes.txt' }), false);
    assert.equal(isLikelyImageFile({ type: '' }), false);
  });

  it('rejects non-image MIME types even with image extension', () => {
    assert.equal(isLikelyImageFile({ type: 'application/pdf', name: 'a.jpg' }), false);
    assert.equal(isLikelyImageFile({ type: 'text/plain', name: 'a.png' }), false);
  });
});

describe('assertProcessedJpegSize', () => {
  it('allows sizes within the limit', () => {
    assert.doesNotThrow(() => assertProcessedJpegSize(1));
    assert.doesNotThrow(() => assertProcessedJpegSize(MAX_PROCESSED_JPEG_BYTES));
  });

  it('throws ReceiptAiError with Vietnamese message when too large', () => {
    assert.throws(
      () => assertProcessedJpegSize(MAX_PROCESSED_JPEG_BYTES + 1),
      (err: unknown) => {
        const e = err as { kind?: string; message?: string };
        assert.equal(e.kind, 'image_processing_failed');
        assert.match(String(e.message), /quá lớn/);
        return true;
      },
    );
  });

  it('throws for empty or invalid sizes', () => {
    assert.throws(() => assertProcessedJpegSize(0));
    assert.throws(() => assertProcessedJpegSize(Number.NaN));
  });
});
