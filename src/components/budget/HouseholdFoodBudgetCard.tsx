import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BorderRadius, Spacing, ThemeColors, ThemeShadows, Typography } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';
import {
  budgetProgressBarFill,
  formatBudgetProgressLabel,
} from '../../database/householdFoodBudgetCalculations';
import type { HouseholdFoodBudgetHomeCardData } from '../../database/householdFoodBudgetRead';
import { fmtVnd, formatPeriodRangeShort } from '../../database/householdFoodBudgetUi';
import { formatDateVi } from '../../utils/date';

interface HouseholdFoodBudgetCardProps {
  data: HouseholdFoodBudgetHomeCardData | null;
  loading?: boolean;
  onPress?: () => void;
}

export function HouseholdFoodBudgetCard({ data, loading, onPress }: HouseholdFoodBudgetCardProps) {
  const { colors, shadows } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);

  if (loading || !data) {
    return (
      <View style={[styles.card, styles.cardMuted]}>
        <Text style={styles.label}>QUỸ ĂN</Text>
        <Text style={styles.mutedText}>Đang tải...</Text>
      </View>
    );
  }

  if (data.phase === 'no_period') {
    return (
      <View style={[styles.card, styles.cardMuted]}>
        <Text style={styles.label}>QUỸ ĂN</Text>
        <Text style={styles.mutedText}>Chưa có kỳ ngân sách</Text>
      </View>
    );
  }

  const period = data.period ?? data.upcomingPeriod;
  if (!period) {
    return (
      <View style={[styles.card, styles.cardMuted]}>
        <Text style={styles.label}>QUỸ ĂN</Text>
        <Text style={styles.mutedText}>Chưa có kỳ ngân sách</Text>
      </View>
    );
  }

  const range = formatPeriodRangeShort(period.period_start, period.period_end);
  const isUpcoming = data.phase === 'upcoming';
  const isOver = data.phase === 'over';
  const amounts = data.amounts;
  const progressFill = amounts
    ? budgetProgressBarFill(amounts.progressRatio)
    : 0;
  const statusColor =
    isOver || amounts?.status === 'over'
      ? colors.danger
      : amounts?.status === 'near_limit'
        ? colors.warning
        : amounts?.status === 'attention'
          ? colors.info
          : colors.success;

  const content = (
    <>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{isUpcoming ? 'QUỸ ĂN KỲ TIẾP THEO' : 'QUỸ ĂN'}</Text>
        <Text style={styles.range}>{range}</Text>
      </View>

      <Text style={styles.limitLine}>
        Ngân sách: {fmtVnd(period.limit_amount)}đ
      </Text>
      {period.carryover_amount > 0 ? (
        <Text style={styles.carryoverLine}>
          Dư đầu kỳ: +{fmtVnd(period.carryover_amount)}đ
        </Text>
      ) : null}
      {amounts || period.carryover_amount > 0 ? (
        <Text style={styles.availableLine}>
          Tổng khả dụng: {fmtVnd(
            amounts?.availableAmount ?? period.limit_amount + period.carryover_amount,
          )}đ
        </Text>
      ) : null}

      {isUpcoming ? (
        <Text style={styles.upcomingText}>
          Bắt đầu {formatDateVi(period.period_start)}
        </Text>
      ) : amounts ? (
        <>
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Đã dùng</Text>
              <Text style={[styles.metricValue, styles.spentText]}>
                {fmtVnd(amounts.spentAmount)}đ
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>
                {amounts.overAmount > 0 ? 'Vượt' : 'Còn lại'}
              </Text>
              <Text style={[styles.metricValue, amounts.overAmount > 0 ? styles.overText : styles.remainingText]}>
                {fmtVnd(amounts.overAmount > 0 ? amounts.overAmount : amounts.remainingAmount)}đ
              </Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(progressFill * 100)}%`, backgroundColor: statusColor },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {formatBudgetProgressLabel(amounts.progressPercent)} đã dùng
          </Text>
        </>
      ) : null}

      {data.plannedContribution ? (
        <Text style={styles.contributionLine}>
          Dự kiến góp · Kai 80% · Yue 20%
        </Text>
      ) : null}
    </>
  );

  if (onPress && !isUpcoming) {
    return (
      <TouchableOpacity
        style={[styles.card, styles.cardInteractive]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {content}
      </TouchableOpacity>
    );
  }

  if (onPress && isUpcoming) {
    return (
      <TouchableOpacity
        style={[styles.card, styles.cardUpcoming]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.card, isUpcoming ? styles.cardUpcoming : styles.cardActive]}>{content}</View>;
}

function createStyles(colors: ThemeColors, shadows: ThemeShadows) {
  return StyleSheet.create({
    card: {
      borderRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.md,
      gap: Spacing.xs,
      borderWidth: 1,
      borderColor: colors.ui.cardBorder,
      backgroundColor: colors.background.surface,
    },
    cardInteractive: {
      ...shadows.soft,
    },
    cardActive: {
      backgroundColor: colors.background.surface,
    },
    cardUpcoming: {
      backgroundColor: colors.lavender[50],
      borderColor: colors.lavender[200],
    },
    cardMuted: {
      backgroundColor: colors.neutral[50],
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    label: {
      fontSize: Typography.fontSize.xs,
      fontWeight: '800',
      color: colors.neutral[500],
      letterSpacing: 0.4,
    },
    range: {
      fontSize: Typography.fontSize.sm,
      fontWeight: '700',
      color: colors.neutral[700],
    },
    limitLine: {
      fontSize: Typography.fontSize.lg,
      fontWeight: '800',
      color: colors.neutral[800],
    },
    carryoverLine: {
      fontSize: Typography.fontSize.sm,
      fontWeight: '700',
      color: colors.neutral[600],
    },
    availableLine: {
      fontSize: Typography.fontSize.base,
      fontWeight: '800',
      color: colors.neutral[800],
    },
    upcomingText: {
      fontSize: Typography.fontSize.sm,
      fontWeight: '600',
      color: colors.neutral[500],
    },
    metricsRow: {
      flexDirection: 'row',
      gap: Spacing.base,
      marginTop: Spacing.xs,
    },
    metric: {
      flex: 1,
      gap: 2,
    },
    metricLabel: {
      fontSize: Typography.fontSize.xs,
      color: colors.neutral[400],
      fontWeight: '600',
    },
    metricValue: {
      fontSize: Typography.fontSize.base,
      fontWeight: '800',
    },
    spentText: { color: colors.pink[500] },
    remainingText: { color: colors.success },
    overText: { color: colors.danger },
    progressTrack: {
      height: 8,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.neutral[100],
      overflow: 'hidden',
      marginTop: Spacing.xs,
    },
    progressFill: {
      height: '100%',
      borderRadius: BorderRadius.full,
    },
    progressLabel: {
      fontSize: Typography.fontSize.xs,
      color: colors.neutral[400],
      fontWeight: '600',
    },
    contributionLine: {
      fontSize: Typography.fontSize.xs,
      color: colors.neutral[400],
      fontWeight: '600',
      marginTop: 2,
    },
    mutedText: {
      fontSize: Typography.fontSize.sm,
      color: colors.neutral[400],
      fontWeight: '600',
    },
  });
}
