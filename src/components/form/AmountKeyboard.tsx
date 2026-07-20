// ============================================================
// BÀN PHÍM SỐ CUSTOM PASTEL ĐỂ NHẬP SỐ TIỀN
// ============================================================

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';

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
  const handleKey = (key: string) => {
    const raw = value.replace(/\D/g, '');

    if (key === '⌫') {
      // Xoá 1 ký tự cuối
      onChange(raw.slice(0, -1));
      return;
    }

    // Giới hạn tối đa 12 chữ số (999 tỷ VNĐ)
    const next = raw + key;
    if (next.length > 12) return;

    // Bỏ số 0 đứng đầu
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
                pressed && styles.keyPressed,
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

const styles = StyleSheet.create({
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
    backgroundColor: Colors.pink[50],
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.pink[100],
  },
  keyDelete: {
    backgroundColor: Colors.lavender[50],
    borderColor: Colors.lavender[100],
  },
  keyPressed: {
    backgroundColor: Colors.pink[200],
    transform: [{ scale: 0.95 }],
  },
  keyText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '600',
    color: Colors.neutral[700],
  },
  keyDeleteText: {
    color: Colors.lavender[400],
    fontSize: Typography.fontSize.xl,
  },
});
