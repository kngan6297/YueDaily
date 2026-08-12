// ============================================================
// BÀN PHÍM SỐ CUSTOM PASTEL ĐỂ NHẬP SỐ TIỀN
// ============================================================

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BorderRadius, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';

interface AmountKeyboardProps {
  value: string;
  onChange: (value: string) => void;
}

// Layout phím số theo kiểu điện thoại
const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['000', '0', '⌫'],
];

/** Định dạng số tiền cho đẹp (thêm dấu phẩy phân cách nghìn) */
export function formatAmount(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return parseInt(digits, 10).toLocaleString('vi-VN');
}

export function AmountKeyboard({ value, onChange }: AmountKeyboardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleKey = (key: string) => {
    const raw = value.replace(/\D/g, '');

    if (key === '⌫') {
      onChange(raw.slice(0, -1));
      return;
    }

    const next = raw + key;
    if (next.length > 12) return;

    const cleaned = next.replace(/^0+/, '') || '0';
    onChange(cleaned === '0' ? '' : cleaned);
  };

  return (
    <View style={styles.container}>
      {KEYS.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.row}>
          {row.map((key) => (
            <Pressable
              key={key}
              onPress={() => handleKey(key)}
              style={({ pressed }) => [
                styles.key,
                key === '⌫' && styles.keyDelete,
                pressed && (key === '⌫' ? styles.keyDeletePressed : styles.keyPressed),
              ]}
            >
              <Text style={[styles.keyText, key === '⌫' && styles.keyDeleteText]}>
                {key}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: Spacing.xs,
    },
    row: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    key: {
      flex: 1,
      height: 52,
      backgroundColor: colors.action.secondaryBackground,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.action.secondaryBorder,
    },
    keyDelete: {
      backgroundColor: colors.action.secondaryBackground,
      borderColor: colors.action.secondaryBorder,
    },
    keyPressed: {
      backgroundColor: colors.action.secondaryPressed,
      transform: [{ scale: 0.95 }],
    },
    keyDeletePressed: {
      backgroundColor: colors.action.secondaryPressed,
      transform: [{ scale: 0.95 }],
    },
    keyText: {
      fontSize: Typography.fontSize.lg,
      fontWeight: '600',
      color: colors.action.secondaryText,
    },
    keyDeleteText: {
      color: colors.action.secondaryText,
      fontSize: Typography.fontSize.xl,
    },
  });
}
