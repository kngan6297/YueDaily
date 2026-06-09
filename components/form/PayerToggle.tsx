// ============================================================
// NÚT TOGGLE CHỌN NGƯỜI CHI - VỢ / CHỒNG
// Thiết kế rõ ràng, dễ bấm, trực quan
// ============================================================

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';
import type { Payer } from '../../types';

interface PayerToggleProps {
  value: Payer;
  onChange: (payer: Payer) => void;
}

export function PayerToggle({ value, onChange }: PayerToggleProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Ai chi? 💳</Text>
      <View style={styles.toggle}>
        {/* Nút Vợ */}
        <Pressable
          onPress={() => onChange('Vợ')}
          style={[
            styles.option,
            value === 'Vợ' && styles.optionActiveWife,
          ]}
        >
          <Text style={styles.optionEmoji}>👩‍🦰</Text>
          <Text
            style={[
              styles.optionText,
              value === 'Vợ' && styles.optionTextActive,
            ]}
          >
            Vợ chi
          </Text>
        </Pressable>

        {/* Đường phân cách */}
        <View style={styles.divider} />

        {/* Nút Chồng */}
        <Pressable
          onPress={() => onChange('Chồng')}
          style={[
            styles.option,
            value === 'Chồng' && styles.optionActiveHusband,
          ]}
        >
          <Text style={styles.optionEmoji}>👨‍🦱</Text>
          <Text
            style={[
              styles.optionText,
              value === 'Chồng' && styles.optionTextActive,
            ]}
          >
            Chồng chi
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: Colors.neutral[500],
    letterSpacing: 0.3,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: Colors.neutral[100],
    borderRadius: BorderRadius.xl,
    padding: 4,
    gap: 0,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
  },
  divider: {
    width: 1,
    backgroundColor: Colors.neutral[200],
    marginVertical: 8,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  optionActiveWife: {
    backgroundColor: Colors.pink[300],
    // Shadow hồng nhẹ
    shadowColor: Colors.pink[400],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  optionActiveHusband: {
    backgroundColor: Colors.mint[300],
    shadowColor: Colors.mint[400],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  optionEmoji: {
    fontSize: 20,
  },
  optionText: {
    fontSize: Typography.fontSize.base,
    fontWeight: '600',
    color: Colors.neutral[500],
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
});
