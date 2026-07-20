// ============================================================
// ROOT LAYOUT - KHỞI TẠO DATABASE VÀ THIẾT LẬP NAVIGATION
// ============================================================

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { BottomSheetPortalProvider } from '../components/ui/BottomSheetPortal';
import { Colors, Typography } from '../constants/theme';
import { useDatabase } from '../hooks/useDatabase';

// Giữ màn hình splash trong khi database khởi tạo
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isReady, error, isInitializing, retryDatabase } = useDatabase();

  useEffect(() => {
    if (isReady || error) {
      // Ẩn splash screen khi database đã sẵn sàng hoặc lỗi
      SplashScreen.hideAsync();
    }
  }, [isReady, error]);

  // Hiển thị loading trong khi khởi tạo / retry database
  if (!isReady && isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <Image source={require('../../assets/icon.png')} style={styles.loadingIcon} />
        <ActivityIndicator size="large" color={Colors.pink[400]} />
        <Text style={styles.loadingText}>Đang khởi động YueDaily...</Text>
      </View>
    );
  }

  // Hiển thị lỗi nếu database không khởi động được
  if (error && !isReady) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingEmoji}>😢</Text>
        <Text style={styles.errorText}>Không thể mở dữ liệu của ứng dụng.</Text>
        {__DEV__ ? (
          <Text style={styles.errorDetail}>{error.message}</Text>
        ) : null}
        <TouchableOpacity
          style={[styles.retryBtn, isInitializing && styles.retryBtnDisabled]}
          onPress={() => {
            retryDatabase();
          }}
          disabled={isInitializing}
          activeOpacity={0.8}
        >
          <Text style={styles.retryBtnText}>
            {isInitializing ? 'Đang thử lại...' : 'Thử lại'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <BottomSheetPortalProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Tabs - màn hình chính */}
        <Stack.Screen name="(tabs)" />

        {/* Màn hình Form Nhập Liệu - modal */}
        <Stack.Screen
          name="form"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />

        {/* Camera - full screen modal */}
        <Stack.Screen
          name="camera"
          options={{
            presentation: 'fullScreenModal',
            animation: 'fade',
          }}
        />

      </Stack>
      </BottomSheetPortalProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.pink[50],
    gap: 16,
  },
  loadingIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
  },
  loadingText: {
    fontSize: Typography.fontSize.base,
    color: Colors.neutral[500],
    fontWeight: '500',
  },
  loadingEmoji: { fontSize: 48 },
  errorText: {
    fontSize: Typography.fontSize.lg,
    color: Colors.neutral[700],
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  errorDetail: {
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[400],
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: Colors.pink[400],
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryBtnDisabled: {
    opacity: 0.6,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
});
