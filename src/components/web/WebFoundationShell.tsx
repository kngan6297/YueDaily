// ============================================================
// P2.0 — Temporary web shell (no finance data / no browser SQLite)
// ============================================================

import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BorderRadius, Spacing, Typography } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';
import {
  WEB_FOUNDATION_BODY,
  WEB_FOUNDATION_HEADLINE,
  WEB_FOUNDATION_NEXT_STEPS,
  WEB_FOUNDATION_PHASE,
  WEB_FOUNDATION_TITLE,
} from '../../platform/webFoundation';

export function WebFoundationShell() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Image
          source={require('../../../assets/icon.png')}
          style={styles.icon}
          accessibilityLabel="YueDaily"
        />
        <Text style={styles.phase}>{WEB_FOUNDATION_PHASE}</Text>
        <Text style={styles.title}>{WEB_FOUNDATION_TITLE}</Text>
        <Text style={styles.headline}>{WEB_FOUNDATION_HEADLINE}</Text>
        <Text style={styles.body}>{WEB_FOUNDATION_BODY}</Text>
        <View style={styles.list}>
          {WEB_FOUNDATION_NEXT_STEPS.map((step) => (
            <Text key={step} style={styles.listItem}>
              • {step}
            </Text>
          ))}
        </View>
      </View>
    </SafeAreaView>
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
    },
    headline: {
      fontSize: Typography.fontSize.base,
      fontWeight: '600',
      color: colors.neutral[700],
      textAlign: 'center',
      marginTop: Spacing.xs,
    },
    body: {
      fontSize: Typography.fontSize.sm,
      color: colors.neutral[500],
      textAlign: 'center',
      lineHeight: 20,
      marginTop: Spacing.xs,
    },
    list: {
      marginTop: Spacing.lg,
      alignSelf: 'stretch',
      gap: 6,
      paddingHorizontal: Spacing.sm,
    },
    listItem: {
      fontSize: Typography.fontSize.sm,
      color: colors.neutral[600],
      lineHeight: 20,
    },
  });
}
