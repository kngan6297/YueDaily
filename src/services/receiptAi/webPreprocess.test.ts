import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RECEIPT_AI_JPEG_QUALITY } from './config.ts';
import { computeTargetSize, preprocessReceiptFile } from './webPreprocess.ts';

function fakeFile(type: string, name = 'bill.jpg'): File {
  return { type, name, size: 10 } as unknown as File;
}

describe('computeTargetSize', () => {
  it('downsizes landscape preserving aspect ratio', () => {
    assert.deepEqual(computeTargetSize(4000, 3000, 1024), { width: 1024, height: 768 });
  });

  it('downsizes portrait by the long (height) edge', () => {
    assert.deepEqual(computeTargetSize(3000, 4000, 1024), { width: 768, height: 1024 });
  });

  it('does not upscale small images', () => {
    assert.deepEqual(computeTargetSize(800, 600, 1024), { width: 800, height: 600 });
  });

  it('keeps at least 1px on extreme aspect ratios', () => {
    const r = computeTargetSize(10000, 2, 1024);
    assert.equal(r.width, 1024);
    assert.equal(r.height, 1);
  });

  it('rejects invalid dimensions', () => {
    assert.throws(() => computeTargetSize(0, 100, 1024));
    assert.throws(() => computeTargetSize(Number.NaN, 100, 1024));
  });
});

describe('preprocessReceiptFile', () => {
  it('resizes, renders JPEG with configured quality and revokes URL', async () => {
    const calls: string[] = [];
    let rendered: { w: number; h: number; q: number } | null = null;
    const blob = await preprocessReceiptFile(fakeFile('image/png', 'a.png'), {
      createObjectURL: () => {
        calls.push('create');
        return 'blob:test';
      },
      revokeObjectURL: (u) => calls.push(`revoke:${u}`),
      loadImage: async () => ({ width: 2048, height: 1024, source: {} }),
      renderJpeg: async (_img, w, h, q) => {
        rendered = { w, h, q };
        return new Blob([new Uint8Array(1000)], { type: 'image/jpeg' });
      },
    });
    assert.equal(blob.size, 1000);
    assert.deepEqual(rendered, { w: 1024, h: 512, q: RECEIPT_AI_JPEG_QUALITY });
    assert.deepEqual(calls, ['create', 'revoke:blob:test']);
  });

  it('rejects non-image files before decoding', async () => {
    let created = false;
    await assert.rejects(
      () =>
        preprocessReceiptFile(fakeFile('application/pdf', 'a.pdf'), {
          createObjectURL: () => {
            created = true;
            return 'blob:x';
          },
        }),
      (err: unknown) => (err as { kind?: string }).kind === 'image_load_failed',
    );
    assert.equal(created, false);
  });

  it('maps decode failure to friendly HEIC message and still revokes URL', async () => {
    let revoked = false;
    await assert.rejects(
      () =>
        preprocessReceiptFile(fakeFile('image/heic', 'a.heic'), {
          createObjectURL: () => 'blob:h',
          revokeObjectURL: () => {
            revoked = true;
          },
          loadImage: async () => {
            throw new Error('decode');
          },
        }),
      (err: unknown) => {
        const e = err as { kind?: string; message?: string };
        assert.equal(e.kind, 'image_decode_failed');
        assert.match(String(e.message), /HEIC/);
        return true;
      },
    );
    assert.equal(revoked, true);
  });

  it('maps render failure to image_processing_failed', async () => {
    await assert.rejects(
      () =>
        preprocessReceiptFile(fakeFile('image/jpeg'), {
          createObjectURL: () => 'blob:r',
          revokeObjectURL: () => {},
          loadImage: async () => ({ width: 100, height: 100, source: {} }),
          renderJpeg: async () => {
            throw new Error('toBlob null');
          },
        }),
      (err: unknown) => (err as { kind?: string }).kind === 'image_processing_failed',
    );
  });

  it('rejects oversized processed output', async () => {
    await assert.rejects(
      () =>
        preprocessReceiptFile(fakeFile('image/jpeg'), {
          createObjectURL: () => 'blob:b',
          revokeObjectURL: () => {},
          loadImage: async () => ({ width: 100, height: 100, source: {} }),
          renderJpeg: async () => new Blob([new Uint8Array(1_600_000)]),
        }),
      (err: unknown) => (err as { kind?: string }).kind === 'image_processing_failed',
    );
  });
});
