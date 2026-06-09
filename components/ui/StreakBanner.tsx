// ============================================================
// BANNER HIỂN THỊ STREAK NGÀY GHI CHÉP LIÊN TIẾP
// ============================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';

interface StreakBannerProps {
  streakCount: number;
}

export function StreakBanner({ streakCount }: StreakBannerProps) {
  const getMessage = () => {
    if (streakCount === 0) return 'Hãy bắt đầu ghi chép hôm nay! 🌱';
    if (streakCount === 1) return '1 ngày đầu tiên! 🌸';
    if (streakCount < 7) return `${streakCount} ngày chăm chỉ 🔥`;
    if (streakCount < 30) return `${streakCount} ngày siêu năng suất! 🔥`;
    return `${streakCount} ngày - Bạn thật tuyệt vời! 🏆`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{getMessage()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    alignSelf: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
