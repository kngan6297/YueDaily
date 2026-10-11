export const RECEIPT_ARCHIVE_DIR = 'receipts';

/** True when `uri` lives inside the archive directory `archiveDirUri`. */
export function isArchivedReceiptUri(
  uri: string | null | undefined,
  archiveDirUri: string,
): boolean {
  if (!uri) return false;
  const base = archiveDirUri.endsWith('/') ? archiveDirUri : `${archiveDirUri}/`;
  return uri.startsWith(base);
}
