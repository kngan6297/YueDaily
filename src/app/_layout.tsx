// ============================================================
// ROOT LAYOUT - KHỞI TẠO DATABASE VÀ THIẾT LẬP NAVIGATION
// ============================================================

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { BottomSheetPortalProvider } from '../components/ui/BottomSheetPortal';
import { Typography } from '../constants/theme';
import { ThemeProvider, useAppTheme } from '../context/ThemeContext';
import { useDatabase } from '../hooks/useDatabase';

// Giữ màn hình splash trong khi database khởi tạo
SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { isReady, error, isInitializing, retryDatabase } = useDatabase();
  const { colors, resolvedColorScheme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (isReady || error) {
      SplashScreen.hideAsync();
    }
  }, [isReady, error]);

  if (!isReady && isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar
          barStyle={resolvedColorScheme === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background.primary}
        />
        <Image source={require('../../assets/icon.png')} style={styles.loadingIcon} />
        <ActivityIndicator size="large" color={colors.action.primaryBackground} />
        <Text style={styles.loadingText}>Đang khởi động YueDaily...</Text>
      </View>
    );
  }

  if (error && !isReady) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar
          barStyle={resolvedColorScheme === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background.primary}
        />
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
      <StatusBar
        barStyle={resolvedColorScheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background.primary}
      />
      <BottomSheetPortalProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background.primary },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="form"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
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

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background.primary,
      gap: 16,
    },
    loadingIcon: {
      width: 96,
      height: 96,
      borderRadius: 24,
    },
    loadingText: {
      fontSize: Typography.fontSize.base,
      color: colors.neutral[500],
      fontWeight: '500',
    },
    loadingEmoji: { fontSize: 48 },
    errorText: {
      fontSize: Typography.fontSize.lg,
      color: colors.neutral[700],
      fontWeight: '700',
      textAlign: 'center',
      paddingHorizontal: 32,
    },
    errorDetail: {
      fontSize: Typography.fontSize.sm,
      color: colors.neutral[400],
      textAlign: 'center',
      paddingHorizontal: 32,
    },
    retryBtn: {
      marginTop: 8,
      backgroundColor: colors.action.primaryBackground,
      paddingHorizontal: 28,
      paddingVertical: 12,
      borderRadius: 24,
    },
    retryBtnDisabled: {
      opacity: 0.6,
    },
    retryBtnText: {
      color: colors.action.primaryText,
      fontSize: Typography.fontSize.base,
      fontWeight: '700',
    },
  });
}
