import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { preprocessReceiptImage } from './preprocessReceiptImage.ts';

describe('preprocessReceiptImage', () => {
  it('maps Loading bitmap failed to image_decode_failed and does not invent auth error', async () => {
    await assert.rejects(
      () =>
        preprocessReceiptImage('file:///tmp/receipt.jpeg', {
          platformOS: 'android',
          deletePrepFile: () => {},
          checkPrepFile: async () => ({ exists: true, size: 100 }),
          copyToPrepCache: async () => ({ uri: 'file:///tmp/prep.jpg', size: 100 }),
          manipulateAsync: async () => {
            throw new Error(
              "Call to function 'Context.renderAsync' has been rejected. Caused by: Loading bitmap failed",
            );
          },
        }),
      (err: unknown) => {
        const e = err as { kind?: string; message?: string; name?: string };
        assert.equal(e.kind, 'image_decode_failed');
        assert.match(String(e.message), /Không đọc được ảnh bill/i);
        assert.doesNotMatch(String(e.message), /API key/i);
        return true;
      },
    );
  });

  it('returns base64 after successful manipulate', async () => {
    const result = await preprocessReceiptImage('file:///tmp/receipt.jpeg', {
      platformOS: 'android',
      deletePrepFile: () => {},
      checkPrepFile: async () => ({ exists: true, size: 2048 }),
      copyToPrepCache: async () => ({ uri: 'file:///tmp/prep.jpg', size: 2048 }),
      manipulateAsync: async () => ({
        uri: 'file:///tmp/out.jpg',
        width: 1024,
        height: 768,
        base64: 'dGVzdA==',
      }),
    });
    assert.equal(result.base64, 'dGVzdA==');
    assert.equal(result.mimeType, 'image/jpeg');
    assert.equal(result.width, 1024);
  });

  it('throws image_load_failed when form-side file check fails before manipulator', async () => {
    await assert.rejects(
      () =>
        preprocessReceiptImage('file:///cache/receipt-ai-prep/src-1.jpg', {
          platformOS: 'android',
          deletePrepFile: () => {},
          checkPrepFile: async () => ({ exists: false, size: null }),
          manipulateAsync: async () => {
            throw new Error('manipulator should not run');
          },
        }),
      (err: unknown) => {
        assert.equal((err as { kind?: string }).kind, 'image_load_failed');
        return true;
      },
    );
  });

  it('skips second copy when URI already under receipt-ai-prep', async () => {
    let copyCalls = 0;
    const result = await preprocessReceiptImage(
      'file:///cache/receipt-ai-prep/src-1.jpg',
      {
        platformOS: 'android',
        deletePrepFile: () => {},
        checkPrepFile: async () => ({ exists: true, size: 2048 }),
        copyToPrepCache: async () => {
          copyCalls += 1;
          return { uri: 'file:///cache/receipt-ai-prep/src-2.jpg', size: 1 };
        },
        manipulateAsync: async (uri: string) => {
          assert.match(uri, /receipt-ai-prep\/src-1\.jpg/);
          return {
            uri: 'file:///tmp/out.jpg',
            width: 800,
            height: 600,
            base64: 'abc',
          };
        },
      },
    );
    assert.equal(copyCalls, 0);
    assert.equal(result.base64, 'abc');
  });
});
