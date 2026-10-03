import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Spacing, Typography } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';
import {
  ENV_SUPABASE_ANON_KEY,
  ENV_SUPABASE_URL,
} from '../../services/supabase/env';

export function WebConfigRequired({
  reason,
}: {
  reason: 'missing_url' | 'missing_anon_key' | 'missing_both';
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const detail =
    reason === 'missing_both'
      ? `Thiếu ${ENV_SUPABASE_URL} và ${ENV_SUPABASE_ANON_KEY}.`
      : reason === 'missing_url'
        ? `Thiếu ${ENV_SUPABASE_URL}.`
        : `Thiếu ${ENV_SUPABASE_ANON_KEY}.`;

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Supabase chưa được cấu hình</Text>
      <Text style={styles.body}>
        Bản Web cần biến môi trường công khai để đăng nhập. Không dùng service-role key trong
        client.
      </Text>
      <Text style={styles.detail}>{detail}</Text>
      <Text style={styles.hint}>
        Thêm vào `.env` rồi chạy lại Metro (`npx expo start --clear`). Migration SQL trong
        `supabase/migrations/` chưa được apply remote trong P2.1.
      </Text>
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
    detail: {
      fontSize: Typography.fontSize.sm,
      fontWeight: '600',
      color: colors.neutral[700],
    },
    hint: {
      fontSize: Typography.fontSize.xs,
      color: colors.neutral[500],
      lineHeight: 18,
    },
  });
}
