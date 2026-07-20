import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../constants/theme';
import { getAccountSummary, getSourceBalances } from '../../database/transactions';

type Period = 'month' | 'year' | 'all';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'month', label: 'Tháng này' },
  { id: 'year',  label: 'Năm nay'   },
  { id: 'all',   label: 'Tất cả'    },
];

const SOURCE_ICONS: Record<string, string> = {
  'Tiền mặt':    '💵',
  'Chuyển khoản': '🏦',
};

const fmt = (n: number) => Math.abs(n).toLocaleString('vi-VN');

export default function AccountsScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState({ thu: 0, chi: 0, balance: 0 });
  const [sources, setSources] = useState<
    Array<{ source_id: number | null; source_name: string; thu: number; chi: number; balance: number }>
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

  const isNegative = summary.balance < 0;
  const periodLabel = PERIODS.find((p) => p.id === period)?.label ?? '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* === HEADER === */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>💳 Tài khoản</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/camera')}
            activeOpacity={0.85}
          >
            <Text style={styles.addBtnText}>+ Thêm</Text>
          </TouchableOpacity>
        </View>

        {/* === PERIOD FILTER === */}
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

        {/* === BALANCE CARD === */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Tổng số dư · {periodLabel}</Text>
          {isLoading ? (
            <ActivityIndicator color={Colors.pink[400]} style={{ paddingVertical: 16 }} />
          ) : (
            <>
              <Text style={[styles.balanceAmount, isNegative ? styles.negative : styles.positive]}>
                {isNegative ? '-' : '+'}{fmt(summary.balance)}đ
              </Text>

              <View style={styles.balanceDivider} />

              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <View style={[styles.summaryDot, { backgroundColor: Colors.mint[400] }]} />
                  <View>
                    <Text style={styles.summaryItemLabel}>Thu nhập</Text>
                    <Text style={[styles.summaryItemAmt, styles.positive]}>
                      +{fmt(summary.thu)}đ
                    </Text>
                  </View>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <View style={[styles.summaryDot, { backgroundColor: Colors.pink[400] }]} />
                  <View>
                    <Text style={styles.summaryItemLabel}>Chi tiêu</Text>
                    <Text style={[styles.summaryItemAmt, styles.negative]}>
                      -{fmt(summary.chi)}đ
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>

        {/* === NGUỒN TIỀN === */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nguồn tiền</Text>
          {isLoading ? (
            <ActivityIndicator color={Colors.pink[400]} style={{ paddingVertical: 20 }} />
          ) : sources.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>💸</Text>
              <Text style={styles.emptyText}>Chưa có giao dịch nào{'\n'}trong kỳ này</Text>
            </View>
          ) : (
            <View style={styles.sourcesCard}>
              {sources.map((src, idx) => {
                const icon = SOURCE_ICONS[src.source_name] ?? '💳';
                const neg = src.balance < 0;
                return (
                  <View key={String(src.source_id ?? idx)}>
                    <View style={styles.sourceRow}>
                      <View style={[
                        styles.sourceIcon,
                        { backgroundColor: neg ? Colors.pink[100] : Colors.mint[50] },
                      ]}>
                        <Text style={styles.sourceIconText}>{icon}</Text>
                      </View>

                      <View style={styles.sourceInfo}>
                        <Text style={styles.sourceName}>{src.source_name}</Text>
                        <View style={styles.sourceDetail}>
                          <Text style={[styles.sourceDetailText, styles.positive]}>
                            +{fmt(src.thu)}
                          </Text>
                          <Text style={styles.sourceDetailSep}> / </Text>
                          <Text style={[styles.sourceDetailText, styles.negative]}>
                            -{fmt(src.chi)}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.sourceBalance, neg ? styles.negative : styles.positive]}>
                        {neg ? '-' : '+'}{fmt(src.balance)}đ
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.primary },
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
    color: Colors.neutral[700],
  },
  addBtn: {
    backgroundColor: Colors.pink[400],
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 7,
    ...Shadows.soft,
  },
  addBtnText: {
    color: '#fff',
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },

  // Period filter
  periodRow: {
    flexDirection: 'row',
    backgroundColor: Colors.neutral[100],
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
    backgroundColor: Colors.background.surface,
    ...Shadows.soft,
  },
  periodTabText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    color: Colors.neutral[400],
  },
  periodTabTextActive: {
    color: Colors.pink[500],
  },

  // Balance card
  balanceCard: {
    backgroundColor: Colors.background.card,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.pink[200],
    gap: Spacing.md,
    ...Shadows.medium,
  },
  balanceLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[400],
    fontWeight: '600',
  },
  balanceAmount: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: '800',
    letterSpacing: -1,
  },
  balanceDivider: {
    height: 1,
    backgroundColor: Colors.neutral[100],
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  summaryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  summaryItemLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.neutral[400],
    fontWeight: '500',
  },
  summaryItemAmt: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.neutral[100],
    marginHorizontal: Spacing.md,
  },

  // Sources
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: Colors.neutral[700],
  },
  sourcesCard: {
    backgroundColor: Colors.background.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    overflow: 'hidden',
    ...Shadows.soft,
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
    color: Colors.neutral[700],
  },
  sourceDetail: { flexDirection: 'row', alignItems: 'center' },
  sourceDetailText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
  },
  sourceDetailSep: {
    fontSize: Typography.fontSize.xs,
    color: Colors.neutral[300],
  },
  sourceBalance: {
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
  },
  sourceDivider: {
    height: 1,
    backgroundColor: Colors.neutral[100],
    marginLeft: 46 + Spacing.base + Spacing.md,
  },

  // Empty
  emptyCard: {
    backgroundColor: Colors.background.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
    gap: Spacing.sm,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[400],
    textAlign: 'center',
    lineHeight: 20,
  },

  // Colors
  positive: { color: Colors.mint[400] },
  negative: { color: Colors.pink[500] },
});
