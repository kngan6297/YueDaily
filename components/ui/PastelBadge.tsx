// ============================================================
// BADGE SỐ LƯỢNG DẠNG PASTEL - DÙNG CHO HỘP THƯ CHỜ
// ============================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../constants/theme';

interface PastelBadgeProps {
  count: number;
}

export function PastelBadge({ count }: PastelBadgeProps) {
  if (count === 0) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.pink[400],
    borderRadius: 9999,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  text: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    lineHeight: 14,
  },
});
