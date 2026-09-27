import { Directory, File, Paths } from 'expo-file-system';

import { receiptAiDevLog, sanitizeErrorCategory } from './devLog';
import { ReceiptAiError, receiptAiErrorFromKind } from './errors';

const PREP_DIR_NAME = 'receipt-ai-prep';

function ensurePrepDir(): Directory {
  const dir = new Directory(Paths.cache, PREP_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

/**
 * Copy a picker/camera URI into an app-owned cache file with an ASCII-safe path.
 * TEMP AI-prep only — NOT the P1.7B persistent receipt archive.
 */
export async function copyReceiptUriToPrepCache(
  sourceUri: string,
): Promise<{ uri: string; size: number | null }> {
  try {
    const source = new File(sourceUri);
    if (!source.exists) {
      throw receiptAiErrorFromKind('image_load_failed');
    }

    const size = typeof source.size === 'number' ? source.size : null;
    if (size === 0) {
      throw receiptAiErrorFromKind('image_load_failed');
    }

    const dir = ensurePrepDir();
    const dest = new File(dir, `src-${Date.now()}-${Math.floor(Math.random() * 1e6)}.jpg`);

    await source.copy(dest, { overwrite: true });

    if (!dest.exists) {
      throw receiptAiErrorFromKind('image_processing_failed');
    }

    const destSize = typeof dest.size === 'number' ? dest.size : size;
    return { uri: dest.uri, size: destSize };
  } catch (err) {
    if (err instanceof ReceiptAiError) throw err;
    receiptAiDevLog('preprocess_fail', {
      step: 'copy_to_prep',
      ...sanitizeErrorCategory(err),
    });
    throw receiptAiErrorFromKind('image_load_failed');
  }
}

/** Best-effort delete of a TEMP prep file. Never throws. */
export function deletePrepCacheFile(uri: string | null | undefined): void {
  if (!uri || !uri.includes(PREP_DIR_NAME)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    /* ignore */
  }
}

/** Form-side existence check using SDK 57 File API. */
export async function checkReceiptPrepFile(uri: string): Promise<{
  exists: boolean;
  size: number | null;
}> {
  try {
    const file = new File(uri);
    const exists = file.exists;
    const size = typeof file.size === 'number' ? file.size : null;
    return { exists, size };
  } catch (err) {
    receiptAiDevLog('preprocess_fail', {
      step: 'file_check',
      ...sanitizeErrorCategory(err),
    });
    throw err;
  }
}
