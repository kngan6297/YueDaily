import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BorderRadius, Spacing, Typography } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';

/** Shared deferred-feature screen for Web-only gated routes. */
export function WebDeferredFeature({
  title,
  phase,
  body,
}: {
  title: string;
  phase: string;
  body: string;
}) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.box}>
      <Text style={styles.badge}>{phase}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/');
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>Quay lại</Text>
      </TouchableOpacity>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    box: {
      flex: 1,
      justifyContent: 'center',
      padding: Spacing.xl,
      gap: Spacing.sm,
      backgroundColor: colors.background.primary,
    },
    badge: {
      fontSize: Typography.fontSize.xs,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: colors.action.primaryBackground,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: Typography.fontSize.xl,
      fontWeight: '800',
      color: colors.neutral[800],
    },
    body: {
      fontSize: Typography.fontSize.sm,
      color: colors.neutral[600],
      lineHeight: 20,
      marginBottom: Spacing.md,
    },
    button: {
      alignSelf: 'flex-start',
      backgroundColor: colors.action.primaryBackground,
      borderRadius: BorderRadius.full,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    buttonText: {
      color: colors.action.primaryText,
      fontWeight: '700',
      fontSize: Typography.fontSize.sm,
    },
  });
}
