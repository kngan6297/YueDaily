import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BorderRadius, Spacing, ThemeColors, ThemeShadows, Typography } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';
import type { VpBankBalanceHomeCardData } from '../../database/trackedSourceBalanceRead';
import { fmtVnd } from '../../database/trackedSourceBalanceUi';

interface VpBankBalanceCardProps {
  data: VpBankBalanceHomeCardData | null;
  loading?: boolean;
  onPress?: () => void;
  onEnterOpeningBalance?: () => void;
}

function formatSignedVnd(amount: number): string {
  if (amount > 0) return `+${fmtVnd(amount)}đ`;
  if (amount < 0) return `−${fmtVnd(Math.abs(amount))}đ`;
  return `${fmtVnd(0)}đ`;
}

export function VpBankBalanceCard({
  data,
  loading,
  onPress,
  onEnterOpeningBalance,
}: VpBankBalanceCardProps) {
  const { colors, shadows } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);

  if (loading || !data) {
    return (
      <View style={[styles.card, styles.cardMuted]}>
        <Text style={styles.label}>VPBANK</Text>
        <Text style={styles.mutedText}>Đang tải...</Text>
      </View>
    );
  }

  if (data.needsOpeningBalance || !data.amounts) {
    const content = (
      <>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{data.sourceName}</Text>
          <Text style={styles.range}>{data.monthLabel}</Text>
        </View>
        <Text style={styles.missingOpening}>Chưa nhập số dư đầu kỳ</Text>
        <Text style={styles.missingHint}>
          Số dư đầu tháng 01 — nhập để theo dõi số dư trong kỳ.
        </Text>
        {onEnterOpeningBalance ? (
          <TouchableOpacity
            style={styles.enterBtn}
            onPress={onEnterOpeningBalance}
            activeOpacity={0.85}
          >
            <Text style={styles.enterBtnText}>Nhập số dư</Text>
          </TouchableOpacity>
        ) : null}
      </>
    );

    if (onPress) {
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
    return <View style={[styles.card, styles.cardMuted]}>{content}</View>;
  }

  const { amounts, period } = data;
  const content = (
    <>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{data.sourceName}</Text>
        <Text style={styles.range}>{data.monthLabel}</Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Số dư đầu kỳ</Text>
        <Text style={styles.summaryValue}>{fmtVnd(amounts.openingBalance)}đ</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Thu vào</Text>
        <Text style={[styles.summaryValue, styles.incomeText]}>
          +{fmtVnd(amounts.incomeAmount)}đ
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Đã chi</Text>
        <Text style={[styles.summaryValue, styles.expenseText]}>
          −{fmtVnd(amounts.expenseAmount)}đ
        </Text>
      </View>
      {period.adjustment_amount !== 0 ? (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Điều chỉnh</Text>
          <Text style={[styles.summaryValue, styles.adjustText]}>
            {formatSignedVnd(period.adjustment_amount)}
          </Text>
        </View>
      ) : null}
      <View style={[styles.summaryRow, styles.currentRow]}>
        <Text style={styles.currentLabel}>Số dư hiện tại</Text>
        <Text style={styles.currentValue}>{fmtVnd(amounts.currentBalance)}đ</Text>
      </View>
    </>
  );

  if (onPress) {
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

  return <View style={styles.card}>{content}</View>;
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
    cardMuted: {
      backgroundColor: colors.neutral[50],
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: 2,
    },
    label: {
      fontSize: Typography.fontSize.xs,
      fontWeight: '800',
      color: colors.neutral[500],
      letterSpacing: 0.4,
    },
    title: {
      fontSize: Typography.fontSize.base,
      fontWeight: '800',
      color: colors.neutral[800],
    },
    range: {
      fontSize: Typography.fontSize.sm,
      fontWeight: '700',
      color: colors.neutral[700],
    },
    missingOpening: {
      fontSize: Typography.fontSize.sm,
      fontWeight: '600',
      color: colors.neutral[500],
      marginTop: 2,
    },
    missingHint: {
      fontSize: Typography.fontSize.xs,
      fontWeight: '600',
      color: colors.neutral[400],
      marginTop: 2,
    },
    enterBtn: {
      alignSelf: 'flex-start',
      marginTop: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs + 2,
      borderRadius: BorderRadius.lg,
      backgroundColor: colors.blue[500],
    },
    enterBtnText: {
      fontSize: Typography.fontSize.sm,
      fontWeight: '800',
      color: '#fff',
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    summaryLabel: {
      fontSize: Typography.fontSize.sm,
      color: colors.neutral[500],
      fontWeight: '600',
    },
    summaryValue: {
      fontSize: Typography.fontSize.sm,
      fontWeight: '800',
      color: colors.neutral[800],
    },
    incomeText: { color: colors.success },
    expenseText: { color: colors.pink[500] },
    adjustText: { color: colors.info },
    currentRow: {
      marginTop: Spacing.xs,
      paddingTop: Spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.neutral[100],
    },
    currentLabel: {
      fontSize: Typography.fontSize.base,
      fontWeight: '800',
      color: colors.neutral[800],
    },
    currentValue: {
      fontSize: Typography.fontSize.lg,
      fontWeight: '800',
      color: colors.neutral[800],
    },
    mutedText: {
      fontSize: Typography.fontSize.sm,
      color: colors.neutral[400],
      fontWeight: '600',
    },
  });
}
