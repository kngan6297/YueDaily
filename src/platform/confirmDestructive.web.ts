/**
 * Web destructive confirmation — Promise resolved by ConfirmDestructiveHost.web.
 * RN Web Alert.alert is a no-op for button callbacks; do not use it here.
 */

export type ConfirmDestructiveOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export type PendingConfirmDestructive = ConfirmDestructiveOptions & {
  resolve: (ok: boolean) => void;
};

let pending: PendingConfirmDestructive | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Test/helpers: current pending request, if any. */
export function getPendingConfirmDestructive(): PendingConfirmDestructive | null {
  return pending;
}

export function subscribeConfirmDestructive(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Resolve the active confirmation (used by ConfirmDestructiveHost). */
export function answerConfirmDestructive(ok: boolean): void {
  const current = pending;
  pending = null;
  notify();
  current?.resolve(ok);
}

export function confirmDestructive(options: ConfirmDestructiveOptions): Promise<boolean> {
  // Replace any prior unanswered prompt (should not happen in normal UI).
  if (pending) {
    const stale = pending;
    pending = null;
    stale.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    pending = {
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? 'Xoá',
      cancelLabel: options.cancelLabel ?? 'Huỷ',
      resolve,
    };
    notify();
  });
}
