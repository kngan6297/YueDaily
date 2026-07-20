import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SYSTEM_NAV_BAR_FALLBACK } from '../constants/layout';

/**
 * Padding đáy cho bottom sheet — chỉ navbar hệ thống (Safe Area / Window Insets).
 * Không cộng chiều cao tab bar app (tab bar bị modal che hoàn toàn).
 */
export function useModalBottomInset(): number {
  const insets = useSafeAreaInsets();

  if (insets.bottom > 0) {
    return insets.bottom;
  }

  return Platform.OS === 'android' ? SYSTEM_NAV_BAR_FALLBACK : 8;
}
