// ============================================================
// ROOT LAYOUT - KHỞI TẠO DATABASE VÀ THIẾT LẬP NAVIGATION
// ============================================================

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors, Typography } from '../constants/theme';
import { useDatabase } from '../hooks/useDatabase';

// Giữ màn hình splash trong khi database khởi tạo
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isReady, error } = useDatabase();

  useEffect(() => {
    if (isReady || error) {
      // Ẩn splash screen khi database đã sẵn sàng
      SplashScreen.hideAsync();
    }
  }, [isReady, error]);

  // Hiển thị loading trong khi khởi tạo database
  if (!isReady && !error) {
    return (
      <View style={styles.loadingContainer}>
        <Image source={require('../assets/icon.png')} style={styles.loadingIcon} />
        <ActivityIndicator size="large" color={Colors.pink[400]} />
        <Text style={styles.loadingText}>Đang khởi động Yozakura...</Text>
      </View>
    );
  }

  // Hiển thị lỗi nếu database không khởi động được
  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingEmoji}>😢</Text>
        <Text style={styles.errorText}>Oops! Có lỗi xảy ra</Text>
        <Text style={styles.errorDetail}>{error.message}</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
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
  errorText: {
    fontSize: Typography.fontSize.lg,
    color: Colors.neutral[700],
    fontWeight: '700',
  },
  errorDetail: {
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[400],
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
