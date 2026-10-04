import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BorderRadius, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';
import {
  answerConfirmDestructive,
  getPendingConfirmDestructive,
  subscribeConfirmDestructive,
  type PendingConfirmDestructive,
} from '../../platform/confirmDestructive.web';
import { BottomSheetModal } from './BottomSheetModal';

/**
 * Mount once under WebAuthProvider. Renders the in-app confirm sheet for
 * `confirmDestructive()` on Web.
 */
export function ConfirmDestructiveHost() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [pending, setPending] = useState<PendingConfirmDestructive | null>(
    () => getPendingConfirmDestructive(),
  );

  useEffect(() => {
    return subscribeConfirmDestructive(() => {
      setPending(getPendingConfirmDestructive());
    });
  }, []);

  const visible = pending != null;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={() => answerConfirmDestructive(false)}
      animationType="fade"
    >
      {pending ? (
        <View style={styles.body}>
          <Text style={styles.title}>{pending.title}</Text>
          <Text style={styles.message}>{pending.message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => answerConfirmDestructive(false)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={pending.cancelLabel ?? 'Huỷ'}
            >
              <Text style={styles.cancelText}>{pending.cancelLabel ?? 'Huỷ'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => answerConfirmDestructive(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={pending.confirmLabel ?? 'Xoá'}
            >
              <Text style={styles.confirmText}>{pending.confirmLabel ?? 'Xoá'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </BottomSheetModal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    body: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.lg,
      gap: Spacing.md,
    },
    title: {
      fontSize: Typography.fontSize.lg,
      fontWeight: '800',
      color: colors.neutral[800],
    },
    message: {
      fontSize: Typography.fontSize.base,
      color: colors.neutral[600],
      lineHeight: 22,
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    cancelBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: colors.neutral[100],
    },
    cancelText: {
      fontSize: Typography.fontSize.base,
      color: colors.neutral[800],
      fontWeight: '600',
    },
    confirmBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: colors.action.destructiveBackground,
    },
    confirmText: {
      fontSize: Typography.fontSize.base,
      color: colors.action.destructiveText,
      fontWeight: '700',
    },
  });
}
