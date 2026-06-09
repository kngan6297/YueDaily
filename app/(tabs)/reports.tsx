import { useFocusEffect } from 'expo-router';
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
import { Circle, G, Svg, Text as SvgText } from 'react-native-svg';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../constants/theme';
import {
  getAllTransactionsComplete,
  getTransactionsByMonth,
  getTransactionsByYear,
} from '../../database/transactions';
import type { Transaction } from '../../types';

// ─── Types ───────────────────────────────────────────────────
type Period  = 'month' | 'year' | 'all';
type Person  = 'all' | 'Vợ' | 'Chồng';
type ViewTab = 'danh-muc' | 'giao-dich';

// ─── Donut chart ─────────────────────────────────────────────
const DONUT_R    = 70;
const DONUT_STROKE = 28;
const DONUT_SIZE = (DONUT_R + DONUT_STROKE) * 2 + 8;
const CIRC       = 2 * Math.PI * DONUT_R;
const CX         = DONUT_SIZE / 2;
const CY         = DONUT_SIZE / 2;

interface DonutSegment { color: string; pct: number; offset: number }

function DonutChart({
  segments,
  centerLabel,
  centerSub,
}: {
  segments: DonutSegment[];
  centerLabel: string;
  centerSub: string;
}) {
  return (
    <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
      {/* Background track */}
      <Circle
        cx={CX} cy={CY} r={DONUT_R}
        fill="none"
        stroke={Colors.neutral[100]}
        strokeWidth={DONUT_STROKE}
      />
      {segments.map((seg, i) => (
        <Circle
          key={i}
          cx={CX} cy={CY} r={DONUT_R}
          fill="none"
          stroke={seg.color}
          strokeWidth={DONUT_STROKE}
          strokeDasharray={`${seg.pct * CIRC / 100} ${CIRC}`}
          strokeDashoffset={CIRC * (1 - seg.offset / 100) + CIRC / 4}
          strokeLinecap="butt"
        />
      ))}
      {/* Center text */}
      <G>
        <SvgText
          x={CX} y={CY - 8}
          textAnchor="middle"
          fill={Colors.neutral[700]}
          fontSize={13}
          fontWeight="800"
        >
          {centerLabel}
        </SvgText>
        <SvgText
          x={CX} y={CY + 10}
          textAnchor="middle"
          fill={Colors.neutral[400]}
          fontSize={10}
          fontWeight="600"
        >
          {centerSub}
        </SvgText>
      </G>
    </Svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────
const fmt      = (n: number) => n.toLocaleString('vi-VN') + 'đ';
const fmtShort = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'tr';
  if (n >= 1_000) return Math.round(n / 1_000) + 'k';
  return String(n);
};

const MONTH_NAMES = [
  '', 'Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12',
];

// ─── Main Screen ─────────────────────────────────────────────
export default function ReportsScreen() {
  const now = new Date();

  const [period,       setPeriod]       = useState<Period>('month');
  const [navMonth,     setNavMonth]     = useState(now.getMonth() + 1);
  const [navYear,      setNavYear]      = useState(now.getFullYear());
  const [person,       setPerson]       = useState<Person>('all');
  const [viewTab,      setViewTab]      = useState<ViewTab>('danh-muc');
  const [isLoading,    setIsLoading]    = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Load data based on period
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      let txns: Transaction[] = [];
      if (period === 'month')     txns = await getTransactionsByMonth(navYear, navMonth);
      else if (period === 'year') txns = await getTransactionsByYear(navYear);
      else                        txns = await getAllTransactionsComplete();
      setTransactions(txns);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  }, [period, navYear, navMonth]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Navigation
  const prevPeriod = () => {
    if (period === 'month') {
      if (navMonth === 1) { setNavMonth(12); setNavYear((y) => y - 1); }
      else setNavMonth((m) => m - 1);
    } else if (period === 'year') {
      setNavYear((y) => y - 1);
    }
  };
  const nextPeriod = () => {
    if (period === 'month') {
      if (navYear === now.getFullYear() && navMonth === now.getMonth() + 1) return;
      if (navMonth === 12) { setNavMonth(1); setNavYear((y) => y + 1); }
      else setNavMonth((m) => m + 1);
    } else if (period === 'year') {
      if (navYear >= now.getFullYear()) return;
      setNavYear((y) => y + 1);
    }
  };
  const isAtLatest = period === 'month'
    ? (navYear === now.getFullYear() && navMonth === now.getMonth() + 1)
    : (period === 'year' ? navYear >= now.getFullYear() : true);

  const navLabel = period === 'month'
    ? `${MONTH_NAMES[navMonth]} ${navYear}`
    : period === 'year' ? `Năm ${navYear}` : 'Toàn bộ';

  // Derived stats
  const filtered = useMemo(() =>
    person === 'all' ? transactions : transactions.filter((t) => t.payer === person),
    [transactions, person]
  );

  const totalChi = useMemo(() =>
    filtered.filter((t) => t.type === 'chi').reduce((s, t) => s + t.amount, 0),
    [filtered]
  );
  const totalThu = useMemo(() =>
    filtered.filter((t) => t.type === 'thu').reduce((s, t) => s + t.amount, 0),
    [filtered]
  );
  const balance = totalThu - totalChi;

  // Category stats
  type CatStat = {
    id: number; name: string; icon: string; color: string;
    amount: number; pct: number;
  };
  const categoryStats: CatStat[] = useMemo(() => {
    const map = new Map<number, CatStat>();
    for (const t of filtered) {
      if (t.type !== 'chi' || !t.category_id) continue;
      const existing = map.get(t.category_id);
      if (existing) { existing.amount += t.amount; }
      else {
        map.set(t.category_id, {
          id:     t.category_id,
          name:   (t as any).category_name  ?? 'Khác',
          icon:   (t as any).category_icon  ?? '✨',
          color:  (t as any).category_color ?? Colors.pink[300],
          amount: t.amount,
          pct:    0,
        });
      }
    }
    const arr = Array.from(map.values()).sort((a, b) => b.amount - a.amount);
    return arr.map((s) => ({ ...s, pct: totalChi > 0 ? (s.amount / totalChi) * 100 : 0 }));
  }, [filtered, totalChi]);

  // Donut segments (cumulative offset)
  const donutSegments: DonutSegment[] = useMemo(() => {
    let offset = 0;
    return categoryStats.slice(0, 6).map((s) => {
      const seg = { color: s.color, pct: s.pct, offset };
      offset += s.pct;
      return seg;
    });
  }, [categoryStats]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* === PERIOD TABS === */}
        <View style={styles.periodRow}>
          {(['month', 'year', 'all'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodTab, period === p && styles.periodTabActive]}
              onPress={() => setPeriod(p)}
              activeOpacity={0.8}
            >
              <Text style={[styles.periodTabText, period === p && styles.periodTabTextActive]}>
                {p === 'month' ? 'Tháng' : p === 'year' ? 'Năm' : 'Tất cả'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* === NAVIGATION === */}
        {period !== 'all' && (
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.navArrow} onPress={prevPeriod}>
              <Text style={styles.navArrowText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.navLabel}>{navLabel}</Text>
            <TouchableOpacity
              style={[styles.navArrow, isAtLatest && styles.navArrowDisabled]}
              onPress={nextPeriod}
              disabled={isAtLatest}
            >
              <Text style={[styles.navArrowText, isAtLatest && { opacity: 0.3 }]}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* === PERSON FILTER === */}
        <View style={styles.personRow}>
          {([
            { id: 'all',    label: '🗂 Tất cả' },
            { id: 'Vợ',    label: '🌸 Vợ'     },
            { id: 'Chồng', label: '🌿 Chồng'  },
          ] as { id: Person; label: string }[]).map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.personChip, person === p.id && styles.personChipActive]}
              onPress={() => setPerson(p.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.personChipText, person === p.id && styles.personChipTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <ActivityIndicator color={Colors.pink[400]} style={{ paddingVertical: 40 }} />
        ) : (
          <>
            {/* === SUMMARY CARDS === */}
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, styles.summaryThu]}>
                <View style={styles.summaryCardInner}>
                  <Text style={styles.summaryCardLabel}>Thu nhập</Text>
                  <Text style={[styles.summaryCardAmt, styles.incomeText]}>
                    +{fmt(totalThu)}
                  </Text>
                </View>
              </View>
              <View style={[styles.summaryCard, styles.summaryChi]}>
                <View style={styles.summaryCardInner}>
                  <Text style={styles.summaryCardLabel}>Chi tiêu</Text>
                  <Text style={[styles.summaryCardAmt, styles.expenseText]}>
                    -{fmt(totalChi)}
                  </Text>
                </View>
              </View>
            </View>

            {/* === BALANCE === */}
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Số dư</Text>
              <Text style={[styles.balanceAmt, balance >= 0 ? styles.incomeText : styles.expenseText]}>
                {balance >= 0 ? '+' : ''}{fmt(balance)}
              </Text>
            </View>

            {/* === VIEW TOGGLE === */}
            <View style={styles.viewToggle}>
              {(['danh-muc', 'giao-dich'] as ViewTab[]).map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.viewTab, viewTab === v && styles.viewTabActive]}
                  onPress={() => setViewTab(v)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.viewTabText, viewTab === v && styles.viewTabTextActive]}>
                    {v === 'danh-muc' ? 'Danh mục' : 'Giao dịch'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {viewTab === 'danh-muc' ? (
              /* === DANH MỤC VIEW === */
              categoryStats.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>📊</Text>
                  <Text style={styles.emptyText}>Chưa có chi tiêu nào{'\n'}trong kỳ này</Text>
                </View>
              ) : (
                <View style={styles.catSection}>
                  {/* Donut + legend */}
                  <View style={styles.donutWrap}>
                    <DonutChart
                      segments={donutSegments}
                      centerLabel={fmtShort(totalChi) + 'đ'}
                      centerSub={`${categoryStats.length} danh mục`}
                    />
                    {/* Top 3 labels */}
                    <View style={styles.legendCol}>
                      {categoryStats.slice(0, 4).map((s) => (
                        <View key={s.id} style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                          <Text style={styles.legendName} numberOfLines={1}>{s.name}</Text>
                          <Text style={styles.legendPct}>{s.pct.toFixed(0)}%</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Category list */}
                  <View style={styles.catList}>
                    {categoryStats.map((s, idx) => (
                      <View key={s.id}>
                        <View style={styles.catRow}>
                          <View style={[styles.catIcon, { backgroundColor: s.color + '22' }]}>
                            <Text style={styles.catIconText}>{s.icon}</Text>
                          </View>
                          <View style={styles.catInfo}>
                            <View style={styles.catTop}>
                              <Text style={styles.catName}>{s.name}</Text>
                              <Text style={[styles.catAmt, styles.expenseText]}>{fmt(s.amount)}</Text>
                            </View>
                            <View style={styles.barBg}>
                              <View style={[styles.barFill, { width: `${s.pct}%`, backgroundColor: s.color }]} />
                            </View>
                          </View>
                          <Text style={styles.catPct}>{s.pct.toFixed(1)}%</Text>
                        </View>
                        {idx < categoryStats.length - 1 && <View style={styles.catDivider} />}
                      </View>
                    ))}
                  </View>
                </View>
              )
            ) : (
              /* === GIAO DỊCH VIEW === */
              filtered.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>🌸</Text>
                  <Text style={styles.emptyText}>Chưa có giao dịch nào</Text>
                </View>
              ) : (
                <View style={styles.txnList}>
                  {filtered.slice(0, 50).map((item, idx) => (
                    <View key={item.id}>
                      <View style={styles.txnRow}>
                        <View style={[
                          styles.txnIcon,
                          { backgroundColor: ((item as any).category_color ?? Colors.pink[300]) + '22' },
                        ]}>
                          <Text style={styles.txnIconText}>
                            {(item as any).category_icon ?? (item.type === 'thu' ? '💰' : '💸')}
                          </Text>
                        </View>
                        <View style={styles.txnInfo}>
                          <Text style={styles.txnName} numberOfLines={1}>
                            {(item as any).category_name ?? (item.type === 'thu' ? 'Thu nhập' : 'Chi tiêu')}
                          </Text>
                          <Text style={styles.txnNote} numberOfLines={1}>
                            {item.note || item.location || item.payer}
                          </Text>
                        </View>
                        <View style={styles.txnRight}>
                          <Text style={[styles.txnAmt, item.type === 'chi' ? styles.expenseText : styles.incomeText]}>
                            {item.type === 'chi' ? '-' : '+'}{fmt(item.amount)}
                          </Text>
                          <Text style={styles.txnDate}>
                            {new Date(item.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                          </Text>
                        </View>
                      </View>
                      {idx < Math.min(filtered.length, 50) - 1 && <View style={styles.txnDivider} />}
                    </View>
                  ))}
                </View>
              )
            )}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.primary },
  scroll: { padding: Spacing.base, gap: Spacing.md },

  // Period tabs
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
    backgroundColor: Colors.pink[400],
    ...Shadows.soft,
  },
  periodTabText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.neutral[500],
  },
  periodTabTextActive: { color: '#fff' },

  // Navigation
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  navArrow: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  navArrowDisabled: {},
  navArrowText: {
    fontSize: 30,
    color: Colors.pink[400],
    fontWeight: '600',
  },
  navLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.fontSize.md,
    fontWeight: '800',
    color: Colors.neutral[700],
  },

  // Person chips
  personRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  personChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.neutral[100],
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
  },
  personChipActive: {
    backgroundColor: Colors.pink[100],
    borderColor: Colors.pink[300],
  },
  personChipText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.neutral[500],
  },
  personChipTextActive: { color: Colors.pink[600] },

  // Summary cards
  summaryRow: { flexDirection: 'row', gap: Spacing.sm },
  summaryCard: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    ...Shadows.soft,
  },
  summaryCardInner: { padding: Spacing.md, gap: 4 },
  summaryThu: {
    backgroundColor: Colors.mint[50],
    borderColor: Colors.mint[100],
  },
  summaryChi: {
    backgroundColor: Colors.pink[50],
    borderColor: Colors.pink[200],
  },
  summaryCardLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.neutral[400],
    fontWeight: '600',
  },
  summaryCardAmt: {
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
  },
  incomeText:  { color: Colors.mint[400] },
  expenseText: { color: Colors.pink[500] },

  // Balance
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.card,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    ...Shadows.soft,
  },
  balanceLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.neutral[500],
  },
  balanceAmt: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },

  // View toggle
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.neutral[100],
    borderRadius: BorderRadius.xl,
    padding: 4,
    gap: 4,
  },
  viewTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  viewTabActive: {
    backgroundColor: Colors.background.card,
    ...Shadows.soft,
  },
  viewTabText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: Colors.neutral[400],
  },
  viewTabTextActive: { color: Colors.neutral[700] },

  // Category donut section
  catSection: { gap: Spacing.md },
  donutWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    ...Shadows.soft,
  },
  legendCol: { flex: 1, gap: 8, paddingLeft: Spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  legendName: { flex: 1, fontSize: Typography.fontSize.xs, fontWeight: '600', color: Colors.neutral[600] },
  legendPct:  { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.neutral[400] },

  catList: {
    backgroundColor: Colors.background.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    overflow: 'hidden',
    ...Shadows.soft,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  catDivider: { height: 1, backgroundColor: Colors.neutral[100], marginLeft: 44 + Spacing.base + Spacing.md },
  catIcon: {
    width: 44, height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  catIconText: { fontSize: 22 },
  catInfo: { flex: 1, gap: 6 },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catName: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neutral[700] },
  catAmt:  { fontSize: Typography.fontSize.sm, fontWeight: '800' },
  barBg: {
    height: 5,
    backgroundColor: Colors.neutral[100],
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: BorderRadius.full },
  catPct: {
    width: 38,
    textAlign: 'right',
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.neutral[400],
  },

  // Transaction list
  txnList: {
    backgroundColor: Colors.background.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    overflow: 'hidden',
    ...Shadows.soft,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  txnDivider: { height: 1, backgroundColor: Colors.neutral[100], marginLeft: 44 + Spacing.base + Spacing.md },
  txnIcon: {
    width: 44, height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  txnIconText: { fontSize: 20 },
  txnInfo: { flex: 1 },
  txnName: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neutral[700] },
  txnNote: { fontSize: Typography.fontSize.xs, color: Colors.neutral[400], marginTop: 2 },
  txnRight: { alignItems: 'flex-end', gap: 3 },
  txnAmt:  { fontSize: Typography.fontSize.sm, fontWeight: '800' },
  txnDate: { fontSize: Typography.fontSize.xs, color: Colors.neutral[400] },

  // Empty state
  empty: { alignItems: 'center', paddingVertical: Spacing['2xl'], gap: Spacing.sm },
  emptyIcon: { fontSize: 40 },
  emptyText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[400],
    textAlign: 'center',
    lineHeight: 20,
  },
});
