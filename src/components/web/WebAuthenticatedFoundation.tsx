import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BorderRadius, Spacing, Typography } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';
import { maskEmail } from '../../auth/authState';

export function WebAuthenticatedFoundation({
  email,
  onSignOut,
}: {
  email: string | null;
  onSignOut: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.box}>
      <Text style={styles.badge}>P2.1 · Đã đăng nhập</Text>
      <Text style={styles.title}>Tài khoản riêng tư sẵn sàng</Text>
      <Text style={styles.body}>
        Bạn đã đăng nhập với danh tính riêng. Dữ liệu chi tiêu trên Web sẽ dùng Supabase theo từng
        người (RLS) — chưa mở màn hình ghi chi ở P2.1.
      </Text>
      <Text style={styles.identity}>Tài khoản: {maskEmail(email)}</Text>
      <Text style={styles.next}>
        Tiếp theo: P2.2 — Core Web expense UI trên cloud repositories. Android vẫn dùng SQLite
        local-first, không upload tự động.
      </Text>
      <TouchableOpacity style={styles.button} onPress={onSignOut} activeOpacity={0.85}>
        <Text style={styles.buttonText}>Đăng xuất</Text>
      </TouchableOpacity>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    box: {
      width: '100%',
      maxWidth: 420,
      gap: Spacing.sm,
      padding: Spacing.lg,
      borderRadius: 16,
      backgroundColor: colors.background.surface,
    },
    badge: {
      fontSize: Typography.fontSize.xs,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: colors.action.primaryBackground,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: Typography.fontSize.lg,
      fontWeight: '800',
      color: colors.neutral[800],
    },
    body: {
      fontSize: Typography.fontSize.sm,
      color: colors.neutral[600],
      lineHeight: 20,
    },
    identity: {
      fontSize: Typography.fontSize.sm,
      fontWeight: '700',
      color: colors.neutral[700],
      marginTop: Spacing.xs,
    },
    next: {
      fontSize: Typography.fontSize.xs,
      color: colors.neutral[500],
      lineHeight: 18,
    },
    button: {
      marginTop: Spacing.sm,
      alignSelf: 'flex-start',
      backgroundColor: colors.neutral[100],
      borderRadius: BorderRadius.full,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    buttonText: {
      color: colors.neutral[700],
      fontWeight: '700',
      fontSize: Typography.fontSize.sm,
    },
  });
}
