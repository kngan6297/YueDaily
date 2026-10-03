import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BorderRadius, Spacing, Typography } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';

export function WebSignInForm({
  onSubmit,
  busy,
}: {
  onSubmit: (email: string, password: string) => Promise<string | null>;
  busy: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const message = await onSubmit(email, password);
    if (message) setError(message);
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Đăng nhập YueDaily Web</Text>
      <Text style={styles.subtitle}>
        Tài khoản riêng tư — mỗi người chỉ thấy dữ liệu của mình. Không mở đăng ký công khai.
      </Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
        editable={!busy}
        placeholder="ban@email.com"
        placeholderTextColor={colors.neutral[400]}
      />

      <Text style={styles.label}>Mật khẩu</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        textContentType="password"
        value={password}
        onChangeText={setPassword}
        editable={!busy}
        placeholder="••••••••"
        placeholderTextColor={colors.neutral[400]}
        onSubmitEditing={() => {
          void handleSubmit();
        }}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={() => {
          void handleSubmit();
        }}
        disabled={busy}
        activeOpacity={0.85}
      >
        {busy ? (
          <ActivityIndicator color={colors.action.primaryText} />
        ) : (
          <Text style={styles.buttonText}>Đăng nhập</Text>
        )}
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
    title: {
      fontSize: Typography.fontSize.lg,
      fontWeight: '800',
      color: colors.neutral[800],
    },
    subtitle: {
      fontSize: Typography.fontSize.sm,
      color: colors.neutral[600],
      lineHeight: 20,
      marginBottom: Spacing.xs,
    },
    label: {
      fontSize: Typography.fontSize.xs,
      fontWeight: '700',
      color: colors.neutral[500],
      marginTop: Spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.neutral[200],
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.base,
      paddingVertical: 12,
      fontSize: Typography.fontSize.base,
      color: colors.neutral[800],
      backgroundColor: colors.background.primary,
    },
    error: {
      fontSize: Typography.fontSize.sm,
      color: colors.danger,
      marginTop: Spacing.xs,
    },
    button: {
      marginTop: Spacing.sm,
      backgroundColor: colors.action.primaryBackground,
      borderRadius: BorderRadius.full,
      paddingVertical: 14,
      alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.7 },
    buttonText: {
      color: colors.action.primaryText,
      fontWeight: '700',
      fontSize: Typography.fontSize.base,
    },
  });
}
