// One-time-ish move of legacy cache receipt images into the persistent archive.
// Runs on every launch but only touches rows whose image is still outside it.

import { isArchivedReceipt, persistReceiptImage } from '../services/receiptStorage';
import { getDatabase } from './db';

export async function migrateCachedReceiptImages(): Promise<number> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: number; image_uri: string }>(
    `SELECT id, image_uri FROM transactions WHERE image_uri IS NOT NULL AND image_uri != '';`,
  );

  let moved = 0;
  for (const row of rows) {
    if (isArchivedReceipt(row.image_uri)) continue;
    const next = await persistReceiptImage(row.image_uri);
    if (next && next !== row.image_uri) {
      await db.runAsync('UPDATE transactions SET image_uri = ? WHERE id = ?;', [next, row.id]);
      moved += 1;
    }
  }
  return moved;
}
