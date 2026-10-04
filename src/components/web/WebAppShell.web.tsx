// ============================================================
// P2.2 — Web auth gate around the real Expo Router app shell
// ============================================================

import React, { useMemo } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebAuthProvider, useWebAuth } from '../../auth/WebAuthProvider.web';
import { ConfirmDestructiveHost } from '../../components/ui/ConfirmDestructiveHost.web';
import { BorderRadius, Spacing, Typography } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';
import { WebConfigRequired } from './WebConfigRequired';
import { WebSignInForm } from './WebSignInForm';

function WebAuthGate({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { ui, signIn, signingIn } = useWebAuth();

  if (ui.kind === 'signed_in') {
    return <>{children}</>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Image
          source={require('../../../assets/icon.png')}
          style={styles.icon}
          accessibilityLabel="YueDaily"
        />
        <Text style={styles.phase}>P2.2</Text>
        <Text style={styles.title}>YueDaily Web</Text>

        {ui.kind === 'config_required' ? <WebConfigRequired reason={ui.reason} /> : null}

        {ui.kind === 'loading' ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.action.primaryBackground} />
            <Text style={styles.loadingText}>Đang kiểm tra phiên đăng nhập…</Text>
          </View>
        ) : null}

        {ui.kind === 'signed_out' ? (
          <WebSignInForm
            busy={signingIn}
            onSubmit={async (email, password) => {
              const result = await signIn(email, password);
              return result.ok ? null : result.message;
            }}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

export function WebAppShell({ children }: { children: React.ReactNode }) {
  return (
    <WebAuthProvider>
      <ConfirmDestructiveHost />
      <WebAuthGate>{children}</WebAuthGate>
    </WebAuthProvider>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
      gap: Spacing.sm,
    },
    icon: {
      width: 88,
      height: 88,
      borderRadius: BorderRadius.xl,
      marginBottom: Spacing.sm,
    },
    phase: {
      fontSize: Typography.fontSize.xs,
      fontWeight: '700',
      letterSpacing: 1,
      color: colors.action.primaryBackground,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: Typography.fontSize.xl,
      fontWeight: '800',
      color: colors.neutral[800],
      textAlign: 'center',
      marginBottom: Spacing.sm,
    },
    loadingBox: {
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.lg,
    },
    loadingText: {
      fontSize: Typography.fontSize.sm,
      color: colors.neutral[500],
    },
  });
}
