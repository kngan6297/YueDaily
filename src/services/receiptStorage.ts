// ============================================================
// Persistent receipt image archive (native only)
// Camera/picker images land in Paths.cache, which Android may evict.
// Saved transactions point at a compressed copy in Paths.document/receipts.
// ============================================================

import { Directory, File, Paths } from 'expo-file-system';
import { RECEIPT_ARCHIVE_DIR, isArchivedReceiptUri } from './receiptStoragePaths';

const ARCHIVE_MAX_WIDTH = 1600;
const ARCHIVE_JPEG_QUALITY = 0.8;

function archiveDir(): Directory {
  const dir = new Directory(Paths.document, RECEIPT_ARCHIVE_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function isArchivedReceipt(uri: string | null | undefined): boolean {
  return isArchivedReceiptUri(uri, archiveDir().uri);
}

/**
 * Copy a receipt image into the archive and return the new URI.
 * Already-archived or missing URIs are returned unchanged; failures fall back
 * to the original URI so saving a transaction never fails because of the image.
 */
export async function persistReceiptImage(
  uri: string | null | undefined,
): Promise<string | null> {
  if (!uri) return null;
  const dir = archiveDir();
  if (isArchivedReceiptUri(uri, dir.uri)) return uri;

  const source = new File(uri);
  if (!source.exists) return uri;

  const dest = new File(dir, `r-${Date.now()}-${Math.floor(Math.random() * 1e6)}.jpg`);
  try {
    const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
    const image = await ImageManipulator.manipulate(uri)
      .resize({ width: ARCHIVE_MAX_WIDTH })
      .renderAsync();
    const result = await image.saveAsync({
      compress: ARCHIVE_JPEG_QUALITY,
      format: SaveFormat.JPEG,
    });
    await new File(result.uri).move(dest);
    return dest.uri;
  } catch {
    try {
      await source.copy(dest);
      return dest.uri;
    } catch {
      return uri;
    }
  }
}

/** Best-effort delete of an archived receipt. Never throws; ignores non-archive URIs. */
export function deleteArchivedReceipt(uri: string | null | undefined): void {
  if (!uri || !isArchivedReceipt(uri)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // best-effort cleanup
  }
}
