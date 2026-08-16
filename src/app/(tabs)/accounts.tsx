import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BorderRadius,
  Spacing,
  ThemeColors,
  ThemeShadows,
  Typography,
} from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';
import { getAccountSummary, getSourceBalances } from '../../database/transactions';

type Period = 'month' | 'year' | 'all';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'month', label: 'Tháng này' },
  { id: 'year',  label: 'Năm nay'   },
  { id: 'all',   label: 'Tất cả'    },
];

const fmt = (n: number) => Math.abs(n).toLocaleString('vi-VN');

export default function AccountsScreen() {
  const router = useRouter();
  const { colors, shadows } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);
  const [period, setPeriod] = useState<Period>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState({ chi: 0 });
  const [sources, setSources] = useState<
    Array<{ source_id: number | null; source_name: string; chi: number }>
  >([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [s, src] = await Promise.all([
        getAccountSummary(period),
        getSourceBalances(period),
      ]);
      setSummary(s);
      setSources(src);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const periodLabel = PERIODS.find((p) => p.id === period)?.label ?? '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>💳 Chi theo nguồn chi</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/camera')}
            activeOpacity={0.85}
          >
            <Text style={styles.addBtnText}>+ Thêm</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.periodTab, period === p.id && styles.periodTabActive]}
              onPress={() => setPeriod(p.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.periodTabText, period === p.id && styles.periodTabTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Tổng chi · {periodLabel}</Text>
          {isLoading ? (
            <ActivityIndicator color={colors.blue[400]} style={{ paddingVertical: 16 }} />
          ) : (
            <Text style={[styles.summaryAmount, styles.expenseAmount]}>
              {fmt(summary.chi)}đ
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nguồn chi</Text>
          {isLoading ? (
            <ActivityIndicator color={colors.blue[400]} style={{ paddingVertical: 20 }} />
          ) : sources.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>💸</Text>
              <Text style={styles.emptyText}>Chưa có dữ liệu chi tiêu</Text>
            </View>
          ) : (
            <View style={styles.sourcesCard}>
              {sources.map((src, idx) => {
                return (
                  <View key={String(src.source_id ?? idx)}>
                    <View style={styles.sourceRow}>
                      <View style={[styles.sourceIcon, { backgroundColor: colors.pink[100] }]}>
                        <Text style={styles.sourceIconText}>💳</Text>
                      </View>

                      <View style={styles.sourceInfo}>
                        <Text style={styles.sourceName}>{src.source_name}</Text>
                        <Text style={styles.sourceDetailText}>Đã chi trong kỳ</Text>
                      </View>

                      <Text style={[styles.sourceAmount, styles.expenseAmount]}>
                        {fmt(src.chi)}đ
                      </Text>
                    </View>
                    {idx < sources.length - 1 && <View style={styles.sourceDivider} />}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors, shadows: ThemeShadows) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    scroll: { padding: Spacing.base, gap: Spacing.base },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.sm,
    },
    headerTitle: {
      fontSize: Typography.fontSize.lg,
      fontWeight: '800',
      color: colors.neutral[700],
    },
    addBtn: {
      backgroundColor: colors.action.primaryBackground,
      borderRadius: BorderRadius.full,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 7,
      ...shadows.soft,
    },
    addBtnText: {
      color: colors.action.primaryText,
      fontSize: Typography.fontSize.sm,
      fontWeight: '700',
    },

    periodRow: {
      flexDirection: 'row',
      backgroundColor: colors.neutral[100],
      borderRadius: BorderRadius.xl,
      padding: 4,
      gap: 4,
    },
    periodTab: {
      flex: 1,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
    },
    periodTabActive: {
      backgroundColor: colors.action.selectedBackground,
      borderWidth: 1,
      borderColor: colors.action.selectedBorder,
      ...shadows.soft,
    },
    periodTabText: {
      fontSize: Typography.fontSize.xs,
      fontWeight: '600',
      color: colors.neutral[400],
    },
    periodTabTextActive: {
      color: colors.action.selectedText,
    },

    summaryCard: {
      backgroundColor: colors.background.surface,
      borderRadius: BorderRadius['2xl'],
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.ui.cardBorder,
      gap: Spacing.sm,
    },
    summaryLabel: {
      fontSize: Typography.fontSize.sm,
      color: colors.neutral[400],
      fontWeight: '600',
    },
    summaryAmount: {
      fontSize: Typography.fontSize['3xl'],
      fontWeight: '800',
      letterSpacing: -1,
    },

    section: { gap: Spacing.sm },
    sectionTitle: {
      fontSize: Typography.fontSize.base,
      fontWeight: '700',
      color: colors.neutral[700],
    },
    sourcesCard: {
      backgroundColor: colors.background.surface,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: colors.ui.cardBorder,
      overflow: 'hidden',
    },
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.md,
      gap: Spacing.md,
    },
    sourceIcon: {
      width: 46,
      height: 46,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sourceIconText: { fontSize: 22 },
    sourceInfo: { flex: 1, gap: 3 },
    sourceName: {
      fontSize: Typography.fontSize.base,
      fontWeight: '700',
      color: colors.neutral[700],
    },
    sourceDetailText: {
      fontSize: Typography.fontSize.xs,
      fontWeight: '500',
      color: colors.neutral[400],
    },
    sourceAmount: {
      fontSize: Typography.fontSize.base,
      fontWeight: '800',
    },
    sourceDivider: {
      height: 1,
      backgroundColor: colors.neutral[100],
      marginLeft: 46 + Spacing.base + Spacing.md,
    },

    emptyCard: {
      backgroundColor: colors.background.surface,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: colors.ui.cardBorder,
      alignItems: 'center',
      paddingVertical: Spacing['2xl'],
      gap: Spacing.sm,
    },
    emptyIcon: { fontSize: 40 },
    emptyText: {
      fontSize: Typography.fontSize.sm,
      color: colors.neutral[400],
      textAlign: 'center',
      lineHeight: 20,
    },

    expenseAmount: { color: colors.pink[500] },
  });
}
