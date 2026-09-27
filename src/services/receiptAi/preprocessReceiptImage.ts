import {
  ReceiptAiError,
  receiptAiErrorFromKind,
} from './errors';
import {
  receiptAiDevLog,
  sanitizeErrorCategory,
} from './devLog';
import {
  RECEIPT_AI_JPEG_QUALITY,
  RECEIPT_AI_RESIZE_WIDTH,
} from './config';
import type { copyReceiptUriToPrepCache } from './normalizeReceiptUri';

export interface ReceiptImagePrepResult {
  base64: string;
  mimeType: 'image/jpeg';
  width?: number;
  height?: number;
  timing?: {
    normalizeMs: number;
    manipulateMs: number;
    totalMs: number;
  };
}

type ManipulateAsyncFn = (
  uri: string,
  actions: Array<{ resize: { width: number } }>,
  options: {
    compress: number;
    format: 'jpeg' | 'png' | 'webp';
    base64: boolean;
  },
) => Promise<{
  uri: string;
  width: number;
  height: number;
  base64?: string;
}>;

export type PrepFileCheckResult = {
  exists: boolean;
  size: number | null;
};

export interface PreprocessReceiptImageDeps {
  manipulateAsync?: ManipulateAsyncFn;
  copyToPrepCache?: typeof copyReceiptUriToPrepCache;
  blobToBase64?: (uri: string) => Promise<string>;
  sourceExists?: (uri: string) => boolean;
  checkPrepFile?: (uri: string) => PrepFileCheckResult | Promise<PrepFileCheckResult>;
  platformOS?: typeof import('react-native').Platform.OS;
  deletePrepFile?: (uri: string) => void;
  /** Override resize for controlled A/B (default: RECEIPT_AI_RESIZE_WIDTH). */
  resizeWidth?: number;
}

async function defaultBlobToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function defaultManipulateAsync(
  uri: string,
  actions: Array<{ resize: { width: number } }>,
  options: {
    compress: number;
    format: 'jpeg' | 'png' | 'webp';
    base64: boolean;
  },
) {
  const ImageManipulator = await import('expo-image-manipulator');
  return ImageManipulator.manipulateAsync(uri, actions, {
    compress: options.compress,
    format: options.format as never,
    base64: options.base64,
  });
}

/** Exported for pure unit tests — maps native manipulator failures. */
export function classifyManipulatorError(err: unknown): ReceiptAiError {
  if (err instanceof ReceiptAiError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes('loading bitmap') ||
    lower.includes('could not load') ||
    lower.includes('decode') ||
    lower.includes('renderasync')
  ) {
    return receiptAiErrorFromKind('image_decode_failed');
  }
  return receiptAiErrorFromKind('image_processing_failed');
}

/**
 * Contract: local image URI → JPEG base64 (resize + quality from config).
 * TEMP AI-prep cache only — does not change transactions.image_uri (not P1.7B).
 */
export async function preprocessReceiptImage(
  imageUri: string,
  deps: PreprocessReceiptImageDeps = {},
): Promise<ReceiptImagePrepResult> {
  const totalStarted = Date.now();
  let normalizeMs = 0;
  let manipulateMs = 0;
  const resizeWidth = deps.resizeWidth ?? RECEIPT_AI_RESIZE_WIDTH;

  if (!imageUri) {
    throw receiptAiErrorFromKind('image_load_failed');
  }

  const platformOS =
    deps.platformOS ??
    (await import('react-native')).Platform.OS;

  if (platformOS === 'web') {
    const blobToBase64 = deps.blobToBase64 ?? defaultBlobToBase64;
    const base64 = await blobToBase64(imageUri);
    if (!base64) throw receiptAiErrorFromKind('image_processing_failed');
    return {
      base64,
      mimeType: 'image/jpeg',
      timing: { normalizeMs: 0, manipulateMs: 0, totalMs: Date.now() - totalStarted },
    };
  }

  const manipulateAsync = deps.manipulateAsync ?? defaultManipulateAsync;

  let workingUri = imageUri;
  let createdPrepCopy = false;
  let reachedManipulator = false;

  try {
    const alreadyPrep = imageUri.includes('receipt-ai-prep');
    const normStarted = Date.now();

    if (!alreadyPrep) {
      try {
        const copyToPrep =
          deps.copyToPrepCache ??
          (await import('./normalizeReceiptUri')).copyReceiptUriToPrepCache;
        const copied = await copyToPrep(imageUri);
        workingUri = copied.uri;
        createdPrepCopy = true;
      } catch (err) {
        receiptAiDevLog('preprocess_fail', {
          step: 'copy_to_prep',
          ...sanitizeErrorCategory(err),
        });
        if (err instanceof ReceiptAiError) throw err;
        throw receiptAiErrorFromKind('image_load_failed');
      }
    }

    let check: PrepFileCheckResult;
    try {
      if (deps.checkPrepFile) {
        check = await deps.checkPrepFile(workingUri);
      } else if (deps.sourceExists) {
        check = { exists: deps.sourceExists(workingUri), size: null };
      } else {
        const checkPrepFileNative = (await import('./normalizeReceiptUri'))
          .checkReceiptPrepFile;
        check = await checkPrepFileNative(workingUri);
      }
    } catch (err) {
      receiptAiDevLog('preprocess_fail', {
        step: 'file_check',
        ...sanitizeErrorCategory(err),
      });
      if (err instanceof ReceiptAiError) throw err;
      throw receiptAiErrorFromKind('image_load_failed');
    }

    if (!check.exists) {
      throw receiptAiErrorFromKind('image_load_failed');
    }
    normalizeMs = Date.now() - normStarted;

    reachedManipulator = true;
    const manipStarted = Date.now();
    let result: {
      uri: string;
      width: number;
      height: number;
      base64?: string;
    };
    try {
      result = await manipulateAsync(
        workingUri,
        [{ resize: { width: resizeWidth } }],
        {
          compress: RECEIPT_AI_JPEG_QUALITY,
          format: 'jpeg',
          base64: true,
        },
      );
    } catch (err) {
      receiptAiDevLog('preprocess_fail', {
        step: 'manipulator',
        ...sanitizeErrorCategory(err),
      });
      throw classifyManipulatorError(err);
    }
    manipulateMs = Date.now() - manipStarted;

    const base64 = result.base64 ?? '';
    if (!base64) {
      throw receiptAiErrorFromKind('image_processing_failed');
    }

    const timing = {
      normalizeMs,
      manipulateMs,
      totalMs: Date.now() - totalStarted,
    };

    return {
      base64,
      mimeType: 'image/jpeg',
      width: result.width,
      height: result.height,
      timing,
    };
  } catch (err) {
    receiptAiDevLog('preprocess_fail', {
      ...sanitizeErrorCategory(err),
    });
    if (err instanceof ReceiptAiError) throw err;
    if (reachedManipulator) throw classifyManipulatorError(err);
    throw receiptAiErrorFromKind('image_load_failed');
  } finally {
    if (createdPrepCopy && workingUri !== imageUri) {
      try {
        if (deps.deletePrepFile) {
          deps.deletePrepFile(workingUri);
        } else {
          const deletePrepFile = (await import('./normalizeReceiptUri'))
            .deletePrepCacheFile;
          deletePrepFile(workingUri);
        }
      } catch {
        // best-effort cleanup
      }
    }
  }
}
