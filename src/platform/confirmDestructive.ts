/**
 * Destructive confirmation — Alert.alert with Promise API.
 */

import { Alert } from 'react-native';

export type ConfirmDestructiveOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function confirmDestructive(options: ConfirmDestructiveOptions): Promise<boolean> {
  const {
    title,
    message,
    confirmLabel = 'Xoá',
    cancelLabel = 'Huỷ',
  } = options;

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
