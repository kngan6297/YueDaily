import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isArchivedReceiptUri } from './receiptStoragePaths.ts';

const DIR = 'file:///data/user/0/com.app/files/receipts';

describe('isArchivedReceiptUri', () => {
  it('matches files inside the archive dir, with or without trailing slash', () => {
    assert.equal(isArchivedReceiptUri(`${DIR}/r-1.jpg`, DIR), true);
    assert.equal(isArchivedReceiptUri(`${DIR}/r-1.jpg`, `${DIR}/`), true);
  });

  it('rejects cache files, sibling dirs and empty values', () => {
    assert.equal(
      isArchivedReceiptUri('file:///data/user/0/com.app/cache/receipt-ai-prep/src-1.jpg', DIR),
      false,
    );
    assert.equal(isArchivedReceiptUri(`${DIR}-old/r-1.jpg`, DIR), false);
    assert.equal(isArchivedReceiptUri(null, DIR), false);
    assert.equal(isArchivedReceiptUri('', DIR), false);
  });
});
