import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Circle, G, Rect, Svg, Text as SvgText } from 'react-native-svg';
import { BottomSheetModal } from '../../components/ui/BottomSheetModal';
import { TAB_BAR_CONTENT_HEIGHT } from '../../constants/layout';
import { BorderRadius, Spacing, ThemeColors, ThemeShadows, Typography } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';
import {
  buildMonthDailySeries,
  getDailyExpenseTotals,
  getExpenseAudienceTotals,
  getExpenseCategoryTotals,
  getExpenseSourceTotals,
  getExpenseSummary,
  getExpenseTransactions,
  highestSpendingDay,
  type DailyAmount,
  type ExpenseSummary,
  type NamedAmount,
  type ReportRange,
  type TransactionWithMeta,
} from '../../database/reportQueries';
import { getAllSources } from '../../database/categories';
import type { ExpenseAudience } from '../../types';
import {
  EXPENSE_AUDIENCE_CHOICES,
  EXPENSE_AUDIENCE_LABELS,
  EXPENSE_AUDIENCE_SHORT,
} from '../../types';
import {
  formatDateVi,
  formatLocalDate,
  clampDateToToday,
  normalizeCustomRange,
  parseLocalDate,
  todayLocal,
} from '../../utils/date';

// ─── Types ───────────────────────────────────────────────────
type PeriodKind = 'day' | 'month' | 'custom';
type SourceFilter = 'all' | number;
type AudienceFilter = 'all' | ExpenseAudience;

interface FilterOption {
  id: string;
  shortLabel: string;
  fullLabel: string;
  icon?: string;
}

const AUDIENCE_SHORT: Record<ExpenseAudience | 'all', string> = {
  all: 'Tất cả',
  wife: EXPENSE_AUDIENCE_SHORT.wife,
  husband: EXPENSE_AUDIENCE_SHORT.husband,
  couple: EXPENSE_AUDIENCE_SHORT.couple,
  wife_and_sister: EXPENSE_AUDIENCE_SHORT.wife_and_sister,
  couple_and_sister: EXPENSE_AUDIENCE_SHORT.couple_and_sister,
  unspecified: EXPENSE_AUDIENCE_SHORT.unspecified,
};

const MONTH_NAMES = [
  '', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

// ─── Filter dropdown ─────────────────────────────────────────
function FilterDropdown({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onSelect: (id: string) => void;
}) {
  const { colors, shadows } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <View style={styles.filterField}>
      <Text style={styles.filterLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.filterPill, open && styles.filterPillFocused]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        {selected?.icon ? <Text style={styles.filterPillIcon}>{selected.icon}</Text> : null}
        <Text style={styles.filterPillText} numberOfLines={1}>
          {selected?.shortLabel ?? 'Tất cả'}
        </Text>
        <Text style={styles.filterPillChevron}>▾</Text>
      </TouchableOpacity>
      <BottomSheetModal visible={open} onClose={() => setOpen(false)}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>{label}</Text>
        <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          {options.map((opt) => {
            const isActive = opt.id === value;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.sheetOption, isActive && styles.sheetOptionActive]}
                onPress={() => { onSelect(opt.id); setOpen(false); }}
              >
                {opt.icon ? (
                  <View style={styles.sheetOptionIcon}>
                    <Text style={{ fontSize: 18 }}>{opt.icon}</Text>
                  </View>
                ) : null}
                <Text style={[styles.sheetOptionText, isActive && styles.sheetOptionTextActive]}>
                  {opt.fullLabel}
                </Text>
                {isActive ? <Text style={styles.sheetCheck}>✓</Text> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheetModal>
    </View>
  );
}

// ─── Donut chart ─────────────────────────────────────────────
const SCREEN_W = Dimensions.get('window').width;
const DONUT_SCALE = SCREEN_W < 360 ? 0.82 : SCREEN_W < 400 ? 0.92 : 1;
const DONUT_R = Math.round(58 * DONUT_SCALE);
const DONUT_STROKE = Math.round(22 * DONUT_SCALE);
const DONUT_SIZE = (DONUT_R + DONUT_STROKE) * 2 + 4;
const CIRC = 2 * Math.PI * DONUT_R;
const CX = DONUT_SIZE / 2;
const CY = DONUT_SIZE / 2;
const LEGEND_BELOW = SCREEN_W < 380;

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
  const { colors } = useAppTheme();
  return (
    <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
      <Circle cx={CX} cy={CY} r={DONUT_R} fill="none" stroke={colors.neutral[100]} strokeWidth={DONUT_STROKE} />
      {segments.map((seg, i) => (
        <Circle
          key={i}
          cx={CX} cy={CY} r={DONUT_R}
          fill="none"
          stroke={seg.color}
          strokeWidth={DONUT_STROKE}
          strokeDasharray={`${seg.pct * CIRC / 100} ${CIRC - seg.pct * CIRC / 100}`}
          strokeDashoffset={((CIRC / 4 - seg.offset * CIRC / 100) % CIRC + CIRC) % CIRC}
          strokeLinecap="butt"
        />
      ))}
      <G>
        <SvgText x={CX} y={CY - 6} textAnchor="middle" fill={colors.neutral[700]} fontSize={12} fontWeight="800">
          {centerLabel}
        </SvgText>
        <SvgText x={CX} y={CY + 10} textAnchor="middle" fill={colors.neutral[400]} fontSize={9} fontWeight="600">
          {centerSub}
        </SvgText>
      </G>
    </Svg>
  );
}

// ─── Daily bar chart (month) ─────────────────────────────────
function DailyBarChart({ series, color }: { series: DailyAmount[]; color: string }) {
  const chartW = SCREEN_W - Spacing.base * 4;
  const chartH = 88;
  const maxAmount = Math.max(...series.map((d) => d.amount), 1);
  const gap = series.length > 20 ? 1 : 2;
  const barW = Math.max(2, (chartW - gap * series.length) / series.length);

  return (
    <Svg width={chartW} height={chartH + 16}>
      {series.map((d, i) => {
        const h = d.amount > 0 ? Math.max(2, (d.amount / maxAmount) * chartH) : 0;
        const x = i * (barW + gap);
        return (
          <Rect
            key={d.date}
            x={x}
            y={chartH - h}
            width={barW}
            height={h}
            fill={d.amount > 0 ? color : 'transparent'}
            rx={2}
          />
        );
      })}
    </Svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ';

function fmtOneDecimal(v: number): string {
  const rounded = Math.round(v * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1).replace('.', ',');
}

const fmtShort = (n: number) => {
  if (n >= 1_000_000) return fmtOneDecimal(n / 1_000_000) + 'tr';
  if (n >= 1_000) return fmtOneDecimal(n / 1_000) + 'k';
  return String(Math.round(n));
};

const fmtPct = (pct: number) => {
  const rounded = Math.round(pct * 10) / 10;
  if (Number.isInteger(rounded)) return `${rounded}%`;
  return `${rounded.toFixed(1).replace('.', ',')}%`;
};

function BreakdownSection({
  title,
  rows,
  total,
}: {
  title: string;
  rows: NamedAmount[];
  total: number;
}) {
  const { colors, shadows } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);
  if (rows.length === 0) return null;

  return (
    <View style={styles.breakdownCard}>
      <Text style={styles.breakdownTitle}>{title}</Text>
      {rows.map((row, idx) => {
        const pct = total > 0 ? (row.amount / total) * 100 : 0;
        return (
          <View key={row.name}>
            <View style={styles.breakdownRow}>
              {row.icon ? <Text style={styles.breakdownIcon}>{row.icon}</Text> : null}
              <Text style={styles.breakdownLabel} numberOfLines={1}>{row.name}</Text>
              <Text style={[styles.breakdownAmt, styles.expenseText]}>{fmt(row.amount)}</Text>
              <Text style={styles.breakdownPct}>{fmtPct(pct)}</Text>
            </View>
            {idx < rows.length - 1 && <View style={styles.breakdownDivider} />}
          </View>
        );
      })}
    </View>
  );
}

function TransactionList({
  items,
  emptyMessage = 'Không có giao dịch phù hợp',
}: {
  items: TransactionWithMeta[];
  emptyMessage?: string;
}) {
  const { colors, shadows } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🌸</Text>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.txnList}>
      {items.map((item, idx) => (
        <View key={item.id}>
          <View style={styles.txnRow}>
            <View style={[
              styles.txnIcon,
              { backgroundColor: (item.category_color ?? colors.pink[300]) + '22' },
            ]}>
              <Text style={styles.txnIconText}>{item.category_icon ?? '💸'}</Text>
            </View>
            <View style={styles.txnInfo}>
              <Text style={styles.txnName} numberOfLines={1}>
                {item.category_name ?? 'Chi tiêu'}
              </Text>
              {(item.note || item.location) ? (
                <Text style={styles.txnNote} numberOfLines={1}>
                  {item.note || item.location}
                </Text>
              ) : null}
              <Text style={styles.txnMeta} numberOfLines={1}>
                Chi cho: {AUDIENCE_SHORT[item.expense_audience ?? 'unspecified']}
                {' · '}
                Nguồn: {item.source_name || 'Không rõ nguồn'}
              </Text>
            </View>
            <View style={styles.txnRight}>
              <Text style={[styles.txnAmt, styles.expenseText]}>{fmt(item.amount)}</Text>
              <Text style={styles.txnDate}>
                {formatDateVi(item.created_at.slice(0, 10))}
              </Text>
            </View>
          </View>
          {idx < items.length - 1 && <View style={styles.txnDivider} />}
        </View>
      ))}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────
export default function ReportsScreen() {
  const { colors, shadows } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);
  const now = new Date();
  const insets = useSafeAreaInsets();
  const scrollBottomPad = TAB_BAR_CONTENT_HEIGHT + insets.bottom + Spacing.base;
  const today = todayLocal();

  const [period, setPeriod] = useState<PeriodKind>('month');
  const [navDate, setNavDate] = useState(today);
  const [navMonth, setNavMonth] = useState(now.getMonth() + 1);
  const [navYear, setNavYear] = useState(now.getFullYear());
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return formatLocalDate(d);
  });
  const [customTo, setCustomTo] = useState(today);
  const [sourceId, setSourceId] = useState<SourceFilter>('all');
  const [audience, setAudience] = useState<AudienceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionWithMeta[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [dailySeries, setDailySeries] = useState<DailyAmount[]>([]);
  const [sourceStats, setSourceStats] = useState<NamedAmount[]>([]);
  const [audienceStats, setAudienceStats] = useState<NamedAmount[]>([]);
  const [categoryRows, setCategoryRows] = useState<NamedAmount[]>([]);
  const [sources, setSources] = useState<Array<{ id: number; name: string }>>([]);
  const [datePicker, setDatePicker] = useState<'day' | 'from' | 'to' | null>(null);

  const customRange = useMemo(
    () => normalizeCustomRange(customFrom, customTo),
    [customFrom, customTo],
  );

  useEffect(() => {
    if (customFrom !== customRange.fromDate || customTo !== customRange.toDate) {
      setCustomFrom(customRange.fromDate);
      setCustomTo(customRange.toDate);
    }
  }, [customRange, customFrom, customTo]);

  const applyCustomRange = useCallback((from: string, to: string) => {
    const normalized = normalizeCustomRange(from, to);
    setCustomFrom(normalized.fromDate);
    setCustomTo(normalized.toDate);
  }, []);

  const reportRange = useMemo((): ReportRange => {
    if (period === 'day') return { kind: 'day', date: navDate };
    if (period === 'month') return { kind: 'month', year: navYear, month: navMonth };
    return { kind: 'custom', fromDate: customRange.fromDate, toDate: customRange.toDate };
  }, [period, navDate, navYear, navMonth, customRange]);

  const filters = useMemo(() => ({
    sourceId,
    audience,
    search: searchQuery,
  }), [sourceId, audience, searchQuery]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [txns, sum, bySource, byAudience, byCategory] = await Promise.all([
        getExpenseTransactions(reportRange, filters),
        getExpenseSummary(reportRange, filters),
        getExpenseSourceTotals(reportRange, filters),
        getExpenseAudienceTotals(reportRange, filters),
        getExpenseCategoryTotals(reportRange, filters),
      ]);
      setTransactions(txns);
      setSummary(sum);
      setSourceStats(bySource);
      setAudienceStats(byAudience);
      setCategoryRows(byCategory);

      if (period === 'month') {
        const daily = await getDailyExpenseTotals(reportRange, filters);
        setDailySeries(buildMonthDailySeries(navYear, navMonth, daily));
      } else {
        setDailySeries([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [reportRange, filters, period, navYear, navMonth]);

  useFocusEffect(useCallback(() => {
    getAllSources().then((s) =>
      setSources(s.map(({ id, name }) => ({ id, name })))
    ).catch(console.error);
  }, []));

  useEffect(() => {
    loadData();
  }, [loadData]);

  const prevPeriod = () => {
    if (period === 'day') {
      const d = parseLocalDate(navDate);
      d.setDate(d.getDate() - 1);
      setNavDate(formatLocalDate(d));
    } else if (period === 'month') {
      if (navMonth === 1) { setNavMonth(12); setNavYear((y) => y - 1); }
      else setNavMonth((m) => m - 1);
    }
  };

  const nextPeriod = () => {
    if (period === 'day') {
      const d = parseLocalDate(navDate);
      d.setDate(d.getDate() + 1);
      const next = formatLocalDate(d);
      if (next <= today) setNavDate(next);
    } else if (period === 'month') {
      if (navYear === now.getFullYear() && navMonth === now.getMonth() + 1) return;
      if (navMonth === 12) { setNavMonth(1); setNavYear((y) => y + 1); }
      else setNavMonth((m) => m + 1);
    }
  };

  const isAtLatest = period === 'day'
    ? navDate >= today
    : period === 'month'
      ? (navYear === now.getFullYear() && navMonth === now.getMonth() + 1)
      : true;

  const navLabel = period === 'day'
    ? formatDateVi(navDate)
    : period === 'month'
      ? `${MONTH_NAMES[navMonth]} ${navYear}`
      : `${formatDateVi(customRange.fromDate)} – ${formatDateVi(customRange.toDate)}`;

  const totalChi = summary?.totalChi ?? 0;
  const categoryStats = useMemo(() => {
    return categoryRows.map((s) => ({
      ...s,
      pct: totalChi > 0 ? (s.amount / totalChi) * 100 : 0,
    }));
  }, [categoryRows, totalChi]);
  const peakDay = useMemo(() => highestSpendingDay(dailySeries), [dailySeries]);

  const hasActiveFilters =
    sourceId !== 'all' || audience !== 'all' || searchQuery.trim().length > 0;
  const filteredEmptyMessage = 'Không có giao dịch phù hợp';
  const periodEmptyMessage = 'Chưa có chi tiêu nào\n trong kỳ này';

  const donutSegments: DonutSegment[] = useMemo(() => {
    let offset = 0;
    return categoryStats.slice(0, 6).map((s) => {
      const seg = { color: s.color ?? colors.pink[300], pct: s.pct, offset };
      offset += s.pct;
      return seg;
    });
  }, [categoryStats, colors.pink]);

  const sourceOptions: FilterOption[] = useMemo(() => [
    { id: 'all', shortLabel: 'Tất cả', fullLabel: 'Tất cả', icon: '🗂' },
    ...sources.map((s) => ({
      id: String(s.id),
      shortLabel: s.name,
      fullLabel: s.name,
      icon: '💳',
    })),
  ], [sources]);

  const audienceOptions: FilterOption[] = useMemo(() => [
    { id: 'all', shortLabel: AUDIENCE_SHORT.all, fullLabel: 'Tất cả' },
    ...EXPENSE_AUDIENCE_CHOICES.map((id) => ({
      id,
      shortLabel: AUDIENCE_SHORT[id],
      fullLabel: EXPENSE_AUDIENCE_LABELS[id],
    })),
    {
      id: 'unspecified',
      shortLabel: AUDIENCE_SHORT.unspecified,
      fullLabel: EXPENSE_AUDIENCE_LABELS.unspecified,
    },
  ], []);

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setDatePicker(null);
    if (event.type === 'dismissed' || !date || !datePicker) return;
    const picked = clampDateToToday(formatLocalDate(date));
    if (datePicker === 'day') setNavDate(picked);
    if (datePicker === 'from') applyCustomRange(picked, customRange.toDate);
    if (datePicker === 'to') applyCustomRange(customRange.fromDate, picked);
  };

  const handleWebDatePick = (value: string) => {
    if (!value || !datePicker) return;
    const picked = clampDateToToday(value);
    if (datePicker === 'day') setNavDate(picked);
    if (datePicker === 'from') applyCustomRange(picked, customRange.toDate);
    if (datePicker === 'to') applyCustomRange(customRange.fromDate, picked);
    setDatePicker(null);
  };

  const webPickerValue = datePicker === 'day'
    ? navDate
    : datePicker === 'from'
      ? customRange.fromDate
      : customRange.toDate;

  const pickerValue = datePicker === 'day'
    ? parseLocalDate(navDate)
    : datePicker === 'from'
      ? parseLocalDate(customRange.fromDate)
      : parseLocalDate(customRange.toDate);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPad }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Kỳ */}
        <View style={styles.periodRow}>
          {(['day', 'month', 'custom'] as PeriodKind[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodTab, period === p && styles.periodTabActive]}
              onPress={() => setPeriod(p)}
              activeOpacity={0.8}
            >
              <Text style={[styles.periodTabText, period === p && styles.periodTabTextActive]}>
                {p === 'day' ? 'Ngày' : p === 'month' ? 'Tháng' : 'Khoảng'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Điều hướng / chọn ngày */}
        {period === 'custom' ? (
          <View style={styles.customRangeRow}>
            <TouchableOpacity
              style={[styles.datePill, datePicker === 'from' && styles.fieldFocused]}
              onPress={() => setDatePicker('from')}
            >
              <Text style={styles.datePillLabel}>Từ</Text>
              <Text style={styles.datePillValue}>{formatDateVi(customRange.fromDate)}</Text>
            </TouchableOpacity>
            <Text style={styles.customRangeArrow}>→</Text>
            <TouchableOpacity
              style={[styles.datePill, datePicker === 'to' && styles.fieldFocused]}
              onPress={() => setDatePicker('to')}
            >
              <Text style={styles.datePillLabel}>Đến</Text>
              <Text style={styles.datePillValue}>{formatDateVi(customRange.toDate)}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.navArrow} onPress={prevPeriod}>
              <Text style={styles.navArrowText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navLabelBtn}
              onPress={() => period === 'day' && setDatePicker('day')}
              disabled={period !== 'day'}
            >
              <Text style={styles.navLabel}>{navLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navArrow, isAtLatest && styles.navArrowDisabled]}
              onPress={nextPeriod}
              disabled={isAtLatest}
            >
              <Text style={[styles.navArrowText, isAtLatest && { opacity: 0.3 }]}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Search */}
        <View style={[styles.searchWrap, searchFocused && styles.fieldFocused]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm mô tả, số tiền, danh mục..."
            placeholderTextColor={colors.neutral[400]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.blue[400]} style={{ paddingVertical: 28 }} />
        ) : (
          <>
            {/* Summary */}
            <View style={[styles.summaryCard, styles.summaryChi]}>
              <Text style={styles.summaryCardLabel}>Tổng chi</Text>
              <Text style={[styles.summaryCardAmt, styles.expenseText]}>{fmt(totalChi)}</Text>
              <View style={styles.summaryMetaRow}>
                <Text style={styles.summaryMeta}>
                  {summary?.transactionCount ?? 0} giao dịch
                </Text>
                {(summary?.transactionCount ?? 0) > 0 && (
                  <Text style={styles.summaryMeta}>
                    · TB {fmt(Math.round(summary?.averagePerTransaction ?? 0))}/GD
                  </Text>
                )}
                {period !== 'day' && (
                  <Text style={styles.summaryMeta}>
                    · TB {fmt(Math.round(summary?.averagePerDay ?? 0))}/ngày
                  </Text>
                )}
              </View>
            </View>

            {/* Filters */}
            <View style={styles.filterRow}>
              <FilterDropdown
                label="Nguồn chi"
                value={sourceId === 'all' ? 'all' : String(sourceId)}
                options={sourceOptions}
                onSelect={(id) => setSourceId(id === 'all' ? 'all' : Number(id))}
              />
              <FilterDropdown
                label="Chi cho"
                value={audience}
                options={audienceOptions}
                onSelect={(id) => setAudience(id as AudienceFilter)}
              />
            </View>

            {/* Month: daily chart + insights */}
            {period === 'month' && dailySeries.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Chi tiêu theo ngày</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <DailyBarChart series={dailySeries} color={colors.pink[400]} />
                </ScrollView>
                {peakDay && peakDay.amount > 0 && (
                  <Text style={styles.chartInsight}>
                    Ngày cao nhất: {peakDay.day}/{navMonth} · {fmt(peakDay.amount)}
                  </Text>
                )}
              </View>
            )}

            {/* Day: breakdowns */}
            {period === 'day' && (
              <>
                <BreakdownSection title="Chi theo danh mục" rows={categoryStats} total={totalChi} />
                <BreakdownSection title="Chi theo nguồn" rows={sourceStats} total={totalChi} />
                <BreakdownSection title="Chi cho ai" rows={audienceStats} total={totalChi} />
              </>
            )}

            {/* Month/custom: category donut */}
            {period !== 'day' && (
              categoryStats.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>📊</Text>
                  <Text style={styles.emptyText}>
                    {hasActiveFilters ? filteredEmptyMessage : periodEmptyMessage}
                  </Text>
                </View>
              ) : (
                <View style={styles.catSection}>
                  <View style={[styles.donutWrap, LEGEND_BELOW && styles.donutWrapStacked]}>
                    <DonutChart
                      segments={donutSegments}
                      centerLabel={fmtShort(totalChi)}
                      centerSub={`${categoryStats.length} danh mục`}
                    />
                    <View style={[styles.legendCol, LEGEND_BELOW && styles.legendColBelow]}>
                      {categoryStats.slice(0, 4).map((s) => (
                        <View key={s.name} style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: s.color ?? colors.pink[300] }]} />
                          <Text style={styles.legendName} numberOfLines={1}>{s.name}</Text>
                          <Text style={styles.legendPct}>{s.pct.toFixed(0)}%</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={styles.catList}>
                    {categoryStats.map((s, idx) => (
                      <View key={s.name}>
                        <View style={styles.catRow}>
                          <View style={[styles.catIcon, { backgroundColor: (s.color ?? colors.pink[300]) + '22' }]}>
                            <Text style={styles.catIconText}>{s.icon ?? '✨'}</Text>
                          </View>
                          <View style={styles.catInfo}>
                            <View style={styles.catTop}>
                              <Text style={styles.catName}>{s.name}</Text>
                              <Text style={[styles.catAmt, styles.expenseText]}>{fmt(s.amount)}</Text>
                            </View>
                            <View style={styles.barBg}>
                              <View style={[styles.barFill, { width: `${s.pct}%`, backgroundColor: s.color ?? colors.pink[300] }]} />
                            </View>
                          </View>
                          <Text style={styles.catPct} numberOfLines={1}>{fmtPct(s.pct)}</Text>
                        </View>
                        {idx < categoryStats.length - 1 && <View style={styles.catDivider} />}
                      </View>
                    ))}
                  </View>
                </View>
              )
            )}

            {period !== 'day' && (sourceStats.length > 0 || audienceStats.length > 0) && (
              <>
                <BreakdownSection title="Chi theo nguồn" rows={sourceStats} total={totalChi} />
                <BreakdownSection title="Chi cho ai" rows={audienceStats} total={totalChi} />
              </>
            )}

            {/* Transaction list */}
            <Text style={styles.listHeading}>Giao dịch</Text>
            <TransactionList
              items={transactions}
              emptyMessage={hasActiveFilters ? filteredEmptyMessage : periodEmptyMessage}
            />
          </>
        )}
      </ScrollView>

      {/* Date picker */}
      {datePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          maximumDate={new Date()}
          onChange={handleDateChange}
        />
      )}
      {datePicker && Platform.OS === 'ios' && (
        <BottomSheetModal visible onClose={() => setDatePicker(null)}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Chọn ngày</Text>
          <DateTimePicker
            value={pickerValue}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            locale="vi-VN"
            onChange={handleDateChange}
          />
          <TouchableOpacity style={styles.dateDoneBtn} onPress={() => setDatePicker(null)}>
            <Text style={styles.dateDoneBtnText}>Xong ✓</Text>
          </TouchableOpacity>
        </BottomSheetModal>
      )}
      {datePicker && Platform.OS === 'web' && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setDatePicker(null)}>
          <TouchableOpacity
            style={styles.webBackdrop}
            onPress={() => setDatePicker(null)}
            activeOpacity={1}
          />
          <View style={styles.webDateSheet}>
            <Text style={styles.sheetTitle}>Chọn ngày</Text>
            {/* @ts-ignore — input web */}
            <input
              type="date"
              title="Chọn ngày"
              aria-label="Chọn ngày"
              value={webPickerValue}
              max={today}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                if (e.target.value) handleWebDatePick(e.target.value);
              }}
            />
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors, shadows: ThemeShadows) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  scroll: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },

  periodRow: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[100],
    borderRadius: BorderRadius.xl,
    padding: 3,
    gap: 3,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  periodTabActive: {
    backgroundColor: colors.action.primaryBackground,
    ...shadows.soft,
  },
  periodTabText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: colors.neutral[500],
  },
  periodTabTextActive: { color: colors.action.primaryText },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: {
    width: 40, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  navArrowDisabled: {},
  navArrowText: {
    fontSize: 26,
    color: colors.blue[500],
    fontWeight: '600',
  },
  navLabelBtn: { flex: 1, alignItems: 'center' },
  navLabel: {
    textAlign: 'center',
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
    color: colors.neutral[700],
  },

  customRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  customRangeArrow: {
    fontSize: Typography.fontSize.sm,
    color: colors.neutral[400],
    fontWeight: '700',
  },
  datePill: {
    flex: 1,
    backgroundColor: colors.background.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: colors.ui.fieldBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 2,
  },
  datePillLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[400],
  },
  datePillValue: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: colors.neutral[700],
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.ui.fieldBorder,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  fieldFocused: {
    borderColor: colors.action.selectedBorder,
    backgroundColor: colors.action.selectedBackground,
  },
  searchIcon: { fontSize: 14 },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: colors.neutral[700],
    paddingVertical: Spacing.sm + 2,
  },

  summaryCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    ...shadows.soft,
  },
  summaryChi: {
    backgroundColor: colors.background.surface,
    borderColor: colors.ui.cardBorder,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: 2,
  },
  summaryCardLabel: {
    fontSize: Typography.fontSize.xs,
    color: colors.neutral[400],
    fontWeight: '600',
  },
  summaryCardAmt: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
  },
  summaryMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  summaryMeta: {
    fontSize: Typography.fontSize.xs,
    color: colors.neutral[400],
    fontWeight: '600',
  },
  expenseText: { color: colors.pink[500] },

  filterRow: { flexDirection: 'row', gap: Spacing.sm },
  filterField: { flex: 1, minWidth: 0, gap: 4 },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.lavender[400],
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.ui.fieldBorder,
    ...shadows.soft,
  },
  filterPillFocused: {
    borderColor: colors.action.selectedBorder,
    backgroundColor: colors.action.selectedBackground,
  },
  filterPillIcon: { fontSize: 13 },
  filterPillText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  filterPillChevron: { fontSize: 10, color: colors.neutral[400] },

  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.metallic.whiteGold,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: colors.neutral[600],
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },
  sheetScroll: { paddingHorizontal: Spacing.base, maxHeight: 360 },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sheetOptionActive: {
    backgroundColor: colors.action.selectedBackground,
    borderColor: colors.action.selectedBorder,
  },
  sheetOptionIcon: {
    width: 36, height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.action.secondaryBackground,
  },
  sheetOptionText: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontWeight: '500',
    color: colors.neutral[700],
  },
  sheetOptionTextActive: { fontWeight: '700', color: colors.action.selectedText },
  sheetCheck: {
    fontSize: Typography.fontSize.base,
    color: colors.action.selectedText,
    fontWeight: '800',
  },

  chartCard: {
    backgroundColor: colors.background.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.ui.cardBorder,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...shadows.soft,
  },
  chartTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  chartInsight: {
    fontSize: Typography.fontSize.xs,
    color: colors.neutral[400],
    fontWeight: '600',
  },

  breakdownCard: {
    backgroundColor: colors.background.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.ui.cardBorder,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: 4,
    ...shadows.soft,
  },
  breakdownTitle: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: colors.neutral[500],
    marginBottom: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 6,
  },
  breakdownIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  breakdownLabel: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  breakdownAmt: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
  },
  breakdownPct: {
    minWidth: 40,
    textAlign: 'right',
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: colors.neutral[400],
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginLeft: 30,
  },

  listHeading: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
    color: colors.neutral[600],
    marginTop: Spacing.xs,
  },

  catSection: { gap: Spacing.sm },
  donutWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.ui.cardBorder,
    ...shadows.soft,
  },
  donutWrapStacked: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  legendCol: { flex: 1, gap: 6, paddingLeft: Spacing.sm, minWidth: 0 },
  legendColBelow: {
    width: '100%',
    paddingLeft: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  legendName: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    color: colors.neutral[600],
    minWidth: 0,
  },
  legendPct: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: colors.neutral[400],
  },

  catList: {
    backgroundColor: colors.background.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.ui.cardBorder,
    overflow: 'hidden',
    ...shadows.soft,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  catDivider: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginLeft: 40 + Spacing.base + Spacing.sm,
  },
  catIcon: {
    width: 40, height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  catIconText: { fontSize: 20 },
  catInfo: { flex: 1, gap: 4, minWidth: 0 },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  catName: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: colors.neutral[700], flexShrink: 1 },
  catAmt: { fontSize: Typography.fontSize.sm, fontWeight: '800' },
  barBg: {
    height: 4,
    backgroundColor: colors.neutral[100],
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: BorderRadius.full },
  catPct: {
    minWidth: 44,
    flexShrink: 0,
    textAlign: 'right',
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: colors.neutral[400],
  },

  txnList: {
    backgroundColor: colors.background.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.ui.cardBorder,
    overflow: 'hidden',
    ...shadows.soft,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  txnDivider: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginLeft: 40 + Spacing.base + Spacing.sm,
  },
  txnIcon: {
    width: 40, height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  txnIconText: { fontSize: 18 },
  txnInfo: { flex: 1, minWidth: 0 },
  txnName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  txnNote: {
    fontSize: Typography.fontSize.xs,
    color: colors.neutral[400],
    marginTop: 1,
  },
  txnMeta: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.lavender[400],
    marginTop: 2,
  },
  txnRight: { alignItems: 'flex-end', gap: 2 },
  txnAmt: { fontSize: Typography.fontSize.sm, fontWeight: '800' },
  txnDate: { fontSize: Typography.fontSize.xs, color: colors.neutral[400] },

  empty: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyIcon: { fontSize: 36 },
  emptyText: {
    fontSize: Typography.fontSize.sm,
    color: colors.neutral[400],
    textAlign: 'center',
    lineHeight: 20,
  },

  dateDoneBtn: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    backgroundColor: colors.action.primaryBackground,
  },
  dateDoneBtnText: {
    color: colors.action.primaryText,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },

  webBackdrop: {
    flex: 1,
    backgroundColor: colors.background.overlay,
  },
  webDateSheet: {
    backgroundColor: colors.background.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginHorizontal: Spacing['2xl'],
    alignSelf: 'center',
    width: '100%',
    maxWidth: 320,
    marginTop: '30%',
  },
});
}
