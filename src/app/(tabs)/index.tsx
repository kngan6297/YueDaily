import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  DAY_SHEET_MAX_HEIGHT_RATIO,
  daySheetListMaxHeight,
} from '../../constants/layout';
import { BorderRadius, Spacing, ThemeColors, ThemeShadows, Typography } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from '../../components/ui/BottomSheetModal';
import { useModalBottomInset } from '../../hooks/useModalBottomInset';
import {
  HOME_SPEND_VIEW_OPTIONS,
  spendingGroupForHomeSpendView,
  type HomeSpendView,
} from '../../database/homeSpendView';
import { confirmDestructive } from '../../platform/confirmDestructive';
import { userMessageForDataError } from '../../repositories/errors';
import {
  deleteTransaction,
  getTransactionsByMonth,
} from '../../repositories/transactions';
import type { EntityId, FinanceTransaction } from '../../repositories/types';
import { EXPENSE_AUDIENCE_LABELS } from '../../types';
import { formatDateVi } from '../../utils/date';
import {
  DEFAULT_SPEND_THRESHOLDS,
  formatCompactVnd,
  isValidThresholds,
  spendTier,
  type SpendThresholds,
} from '../../utils/spendHeat';
import { getSpendThresholds, setSpendThresholds } from '../../utils/spendHeatSettings';

const CELL_GAP = 4;
const CAL_PAD_X = Spacing.sm;

function cellWidthFor(windowWidth: number): number {
  return Math.floor((windowWidth - Spacing.base * 2 - CAL_PAD_X * 2 - CELL_GAP * 6) / 7);
}

const fmt = (n: number) => n.toLocaleString('vi-VN');
const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

type TxnWithMeta = FinanceTransaction;

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 6) return 'Thức khuya thế 🌙';
  if (h < 12) return 'Chào buổi sáng ☀️';
  if (h < 18) return 'Buổi chiều vui vẻ 🌸';
  return 'Buổi tối ấm áp 🌙';
};

export default function HomeScreen() {
  const { colors, shadows } = useAppTheme();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const cellW = cellWidthFor(windowWidth);
  const styles = useMemo(() => createStyles(colors, shadows, cellW), [colors, shadows, cellW]);
  const sheetBottomInset = useModalBottomInset();
  const daySheetHeaderH = useRef(0);
  const daySheetFooterH = useRef(0);
  const [daySheetChromeH, setDaySheetChromeH] = useState(200);
  const syncDaySheetChrome = useCallback(() => {
    const next = daySheetHeaderH.current + daySheetFooterH.current;
    setDaySheetChromeH((prev) => (prev === next ? prev : next));
  }, []);
  const daySheetStyle = useMemo(
    () => ({ maxHeight: `${Math.round(DAY_SHEET_MAX_HEIGHT_RATIO * 100)}%` as const }),
    [],
  );
  const dayListMaxHeight = daySheetListMaxHeight(
    windowHeight,
    daySheetChromeH,
    sheetBottomInset,
  );
  const router = useRouter();
  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());
  const [showDayModal, setShowDayModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [monthTxns, setMonthTxns] = useState<TxnWithMeta[]>([]);
  const [spendView, setSpendView] = useState<HomeSpendView>('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const [thresholds, setThresholds] = useState<SpendThresholds>(DEFAULT_SPEND_THRESHOLDS);
  const [showHeatSettings, setShowHeatSettings] = useState(false);
  const [draftLow, setDraftLow] = useState('');
  const [draftHigh, setDraftHigh] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const group = spendingGroupForHomeSpendView(spendView);
      const txns = await getTransactionsByMonth(calYear, calMonth, group);
      setMonthTxns(txns);
    } catch (err) {
      Alert.alert('Không tải được giao dịch', userMessageForDataError(err, 'transactions'));
    } finally {
      setIsLoading(false);
    }
  }, [calYear, calMonth, spendView]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    getSpendThresholds().then(setThresholds);
  }, []);

  const openHeatSettings = () => {
    setDraftLow(String(thresholds.low / 1000));
    setDraftHigh(String(thresholds.high / 1000));
    setShowHeatSettings(true);
  };

  const saveHeatSettings = () => {
    const next = {
      low: (parseInt(draftLow.replace(/\D/g, ''), 10) || 0) * 1000,
      high: (parseInt(draftHigh.replace(/\D/g, ''), 10) || 0) * 1000,
    };
    if (!isValidThresholds(next)) {
      Alert.alert('Mức chưa hợp lệ', 'Mức thấp phải lớn hơn 0 và nhỏ hơn mức cao.');
      return;
    }
    setThresholds(next);
    setSpendThresholds(next);
    setShowHeatSettings(false);
  };

  const monthSummary = useMemo(() => ({
    chi: monthTxns.filter((t) => t.type === 'chi').reduce((s, t) => s + t.amount, 0),
  }), [monthTxns]);

  // --- Calendar helpers ---
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const firstDow = new Date(calYear, calMonth - 1, 1).getDay(); // 0=Sun
  const offsetMon = firstDow === 0 ? 6 : firstDow - 1; // 0=Mon

  // Group txns by calendar day number — đã lọc theo activeFilter
  // Dùng string slice thay vì new Date() để tránh Hermes parse sai timezone
  // với format "YYYY-MM-DD HH:MM:SS" của SQLite localtime
  const txnsByDay = useMemo(() => {
    const source = monthTxns.filter((t) => t.type === 'chi');
    const map: Record<number, TxnWithMeta[]> = {};
    for (const t of source) {
      const dateStr = t.transaction_date; // YYYY-MM-DD calendar domain
      const [yr, mo, dy] = dateStr.split('-').map(Number);
      if (yr === calYear && mo === calMonth) {
        if (!map[dy]) map[dy] = [];
        map[dy].push(t);
      }
    }
    return map;
  }, [monthTxns, calYear, calMonth]);

  const dayTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    for (const [day, txns] of Object.entries(txnsByDay)) {
      totals[Number(day)] = txns.reduce((s, t) => s + t.amount, 0);
    }
    return totals;
  }, [txnsByDay]);

  // Giao dịch của ngày được chọn (đã được lọc sẵn trong txnsByDay)
  const selectedTxns = useMemo(() => {
    if (!selectedDay) return [];
    return txnsByDay[selectedDay] ?? [];
  }, [txnsByDay, selectedDay]);

  const selectedDaySummary = useMemo(() => ({
    totalChi: selectedTxns.reduce((s, t) => s + t.amount, 0),
    count: selectedTxns.length,
  }), [selectedTxns]);

  const selectedDayLabel = useMemo(() => {
    if (!selectedDay) return '';
    const m = String(calMonth).padStart(2, '0');
    const d = String(selectedDay).padStart(2, '0');
    return formatDateVi(`${calYear}-${m}-${d}`);
  }, [selectedDay, calMonth, calYear]);

  // Month nav
  const prevMonth = () => {
    if (calMonth === 1) { setCalMonth(12); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    const today = new Date();
    if (calYear === today.getFullYear() && calMonth === today.getMonth() + 1) return;
    if (calMonth === 12) { setCalMonth(1); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
    setSelectedDay(null);
  };

  const isCurrentMonth =
    calYear === now.getFullYear() && calMonth === now.getMonth() + 1;

  const handleEditTxn = useCallback((item: TxnWithMeta) => {
    setShowDayModal(false);
    router.push({
      pathname: '/form',
      params: {
        transactionId: String(item.id),
        isEdit: 'true',
        ...(item.image_uri ? { imageUri: item.image_uri } : {}),
      },
    });
  }, [router]);

  const handleDeleteTxn = useCallback(async (id: EntityId) => {
    setActionError(null);
    const confirmed = await confirmDestructive({
      title: 'Xoá giao dịch?',
      message: 'Giao dịch này sẽ bị xoá vĩnh viễn.',
      confirmLabel: 'Xoá',
      cancelLabel: 'Huỷ',
    });
    if (!confirmed) return;
    try {
      await deleteTransaction(id);
      await loadData();
    } catch (err) {
      const message = userMessageForDataError(err, 'transactions');
      setActionError(message);
      Alert.alert('Không xoá được', message);
    }
  }, [loadData]);

  // Build calendar cells array
  const calCells: (number | null)[] = [
    ...Array(offsetMon).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full rows
  while (calCells.length % 7 !== 0) calCells.push(null);

  const renderDayCell = (day: number | null, idx: number) => {
    if (!day) return <View key={`empty-${idx}`} style={styles.dayCellEmpty} />;

    const txns = txnsByDay[day] ?? [];
    const total = dayTotals[day] ?? 0;
    const tier = spendTier(total, thresholds);
    const heat = tier === 'none' ? null : colors.heat[tier];
    const isToday = isCurrentMonth && day === now.getDate();
    const imgTxn = txns.find((t) => t.image_uri);

    return (
      <TouchableOpacity
        key={day}
        style={[
          styles.dayCell,
          heat && { backgroundColor: heat.bg, borderColor: heat.border },
          isToday && styles.dayCellToday,
        ]}
        onPress={() => {
          setSelectedDay(day);
          setShowDayModal(true);
        }}
        activeOpacity={0.75}
        accessibilityLabel={`Ngày ${day}${total > 0 ? `, đã chi ${fmt(total)} đồng` : ''}`}
      >
        <Text style={[styles.dayNum, heat && { color: heat.text }, isToday && styles.dayNumToday]}>
          {day}
        </Text>
        {total > 0 ? (
          <Text
            style={[styles.dayAmount, heat && { color: heat.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatCompactVnd(total)}
          </Text>
        ) : null}
        {heat ? <View style={[styles.dayDot, { backgroundColor: heat.dot }]} /> : null}

        {imgTxn?.image_uri ? (
          <Image source={{ uri: imgTxn.image_uri }} style={styles.dayThumb} />
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderTxn = (item: TxnWithMeta, withActions = false) => {
    const bgColor = item.category_color ? item.category_color + '22' : colors.pink[100];
    return (
      <View>
        <View style={styles.txnRow}>
          <View style={[styles.txnIcon, { backgroundColor: bgColor, overflow: 'hidden' }]}>
            {item.image_uri ? (
              <Image source={{ uri: item.image_uri }} style={styles.txnThumb} />
            ) : (
              <Text style={styles.txnIconEmoji}>
                {item.category_icon ?? '💸'}
              </Text>
            )}
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
            <Text style={styles.txnAudience} numberOfLines={1}>
              Chi cho: {EXPENSE_AUDIENCE_LABELS[item.expense_audience] ?? 'Chưa phân loại'}
            </Text>
            <Text style={styles.txnAudience} numberOfLines={1}>
              Nguồn: {item.source_name || 'Không rõ nguồn'}
            </Text>
          </View>
          <View style={styles.txnRight}>
            <Text style={[styles.txnAmount, styles.expenseText]}>
              -{fmt(item.amount)}đ
            </Text>
          </View>
        </View>

        {withActions && (
          <View style={styles.txnActionBar}>
            <TouchableOpacity
              style={styles.txnEditBtn}
              onPress={() => handleEditTxn(item)}
              activeOpacity={0.75}
            >
              <Ionicons name="create-outline" style={styles.txnEditBtnText} />
              <Text style={styles.txnEditBtnText}>Sửa</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.txnDeleteBtn}
              onPress={() => handleDeleteTxn(item.id)}
              activeOpacity={0.75}
            >
              <Ionicons name="trash-outline" style={styles.txnDeleteBtnText} />
              <Text style={styles.txnDeleteBtnText}>Xoá</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* === HEADER === */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTotal}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.monthTotalLabel}>Đã chi tháng {calMonth}</Text>
            <Text style={styles.monthTotal} numberOfLines={1} adjustsFontSizeToFit>
              {fmt(monthSummary.chi)}đ
            </Text>
          </View>
          <View style={styles.monthNav}>
            <TouchableOpacity
              style={styles.calArrow}
              onPress={prevMonth}
              hitSlop={6}
              accessibilityLabel="Tháng trước"
            >
              <Ionicons name="chevron-back" style={styles.calArrowText} />
            </TouchableOpacity>
            <Text style={styles.calMonthLabel}>
              T{calMonth}/{calYear}
            </Text>
            <TouchableOpacity
              style={[styles.calArrow, isCurrentMonth && styles.calArrowDisabled]}
              onPress={nextMonth}
              disabled={isCurrentMonth}
              hitSlop={6}
              accessibilityLabel="Tháng sau"
            >
              <Ionicons
                name="chevron-forward"
                style={[styles.calArrowText, isCurrentMonth && styles.calArrowTextDisabled]}
              />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.filterRow}>
          {HOME_SPEND_VIEW_OPTIONS.map((opt) => {
            const active = spendView === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.filterTab, active && styles.filterTabActive]}
                onPress={() => setSpendView(opt.id)}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.filterTabText, active && styles.filterTabTextActive]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* === CALENDAR === */}
        <View style={styles.calendarCard}>
          {/* Day headers */}
          <View style={styles.calDayHeaders}>
            {DAY_LABELS.map((d) => (
              <View key={d} style={styles.dayHeaderCell}>
                <Text style={[styles.dayHeaderText, d === 'CN' && styles.dayHeaderSun]}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          {isLoading ? (
            <ActivityIndicator color={colors.blue[400]} style={{ paddingVertical: 40 }} />
          ) : (
            <View style={styles.calGrid}>
              {calCells.map((day, idx) => renderDayCell(day, idx))}
            </View>
          )}

          <View style={styles.legendRow}>
            <Text style={styles.legendLabel}>Mức chi:</Text>
            {([
              ['low', `<${formatCompactVnd(thresholds.low)}`],
              ['mid', `${formatCompactVnd(thresholds.low)}–${formatCompactVnd(thresholds.high)}`],
              ['high', `>${formatCompactVnd(thresholds.high)}`],
            ] as const).map(([tier, label]) => (
              <View
                key={tier}
                style={[
                  styles.legendChip,
                  { backgroundColor: colors.heat[tier].bg, borderColor: colors.heat[tier].border },
                ]}
              >
                <View style={[styles.dayDot, { backgroundColor: colors.heat[tier].dot }]} />
                <Text style={[styles.legendChipText, { color: colors.heat[tier].text }]}>{label}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.legendGear}
              onPress={openHeatSettings}
              hitSlop={8}
              accessibilityLabel="Chỉnh mức chi"
            >
              <Ionicons name="options-outline" style={styles.legendGearText} />
            </TouchableOpacity>
          </View>
        </View>

        {!isLoading && monthTxns.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>🌸</Text>
            <Text style={styles.emptyStateText}>
              Tháng này chưa có khoản chi nào. Chạm vào một ngày để thêm giao dịch nhé!
            </Text>
          </View>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* === DAY DETAIL MODAL === */}
      <BottomSheetModal
        visible={showDayModal && selectedDay !== null}
        onClose={() => {
          setActionError(null);
          setShowDayModal(false);
        }}
        sheetStyle={daySheetStyle}
      >
          <View
            onLayout={(e) => {
              daySheetHeaderH.current = e.nativeEvent.layout.height;
              syncDaySheetChrome();
            }}
          >
            <View style={styles.modalHandle} />
            <View style={styles.sheetHeaderSection}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedDayLabel}</Text>
                <TouchableOpacity
                  hitSlop={8}
                  accessibilityLabel="Đóng"
                  style={styles.modalCloseBtn}
                  onPress={() => {
                    setActionError(null);
                    setShowDayModal(false);
                  }}
                >
                  <Ionicons name="close" style={styles.modalCloseText} />
                </TouchableOpacity>
              </View>

              <View style={styles.daySummaryRow}>
                <View style={styles.daySummaryItem}>
                  <Text style={styles.daySummaryLabel}>Tổng chi</Text>
                  <Text style={[styles.daySummaryAmt, styles.expenseText]}>
                    {fmt(selectedDaySummary.totalChi)}đ
                  </Text>
                </View>
                <View style={styles.daySummaryDivider} />
                <View style={styles.daySummaryItem}>
                  <Text style={styles.daySummaryLabel}>Giao dịch</Text>
                  <Text style={styles.daySummaryAmt}>{selectedDaySummary.count}</Text>
                </View>
              </View>
              {actionError ? (
                <Text style={styles.actionErrorText}>{actionError}</Text>
              ) : null}
            </View>
          </View>

          <ScrollView
            style={[styles.modalScroll, { maxHeight: dayListMaxHeight }]}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={selectedTxns.length > 2}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {selectedTxns.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>📭</Text>
                <Text style={styles.emptyStateText}>Chưa có khoản chi trong ngày này</Text>
              </View>
            ) : (
              <View style={styles.txnCard}>
                {selectedTxns.map((item, idx) => (
                  <View key={item.id}>
                    {renderTxn(item, true)}
                    {idx < selectedTxns.length - 1 && <View style={styles.txnDivider} />}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View
            style={styles.modalFooter}
            onLayout={(e) => {
              daySheetFooterH.current = e.nativeEvent.layout.height;
              syncDaySheetChrome();
            }}
          >
            <TouchableOpacity
              style={styles.modalAddBtn}
              onPress={() => {
                if (!selectedDay) return;
                setShowDayModal(false);
                const m = String(calMonth).padStart(2, '0');
                const d = String(selectedDay).padStart(2, '0');
                router.push({
                  pathname: '/camera',
                  params: { transactionDate: `${calYear}-${m}-${d}` },
                });
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalAddBtnText}>+ Thêm giao dịch</Text>
            </TouchableOpacity>
          </View>
      </BottomSheetModal>

      {/* === HEATMAP THRESHOLDS === */}
      <BottomSheetModal visible={showHeatSettings} onClose={() => setShowHeatSettings(false)}>
        <View style={styles.modalHandle} />
        <View style={styles.heatSheet}>
          <Text style={styles.modalTitle}>Mức chi theo ngày</Text>
          <Text style={styles.heatHint}>
            Đơn vị: nghìn đồng. Ngày chi dưới mức thấp tô xanh, trên mức cao tô hồng.
          </Text>
          <View style={styles.heatInputRow}>
            <View style={styles.heatInputBox}>
              <Text style={styles.daySummaryLabel}>Mức thấp (k)</Text>
              <TextInput
                style={styles.heatInput}
                value={draftLow}
                onChangeText={setDraftLow}
                keyboardType="number-pad"
                selectTextOnFocus
              />
            </View>
            <View style={styles.heatInputBox}>
              <Text style={styles.daySummaryLabel}>Mức cao (k)</Text>
              <TextInput
                style={styles.heatInput}
                value={draftHigh}
                onChangeText={setDraftHigh}
                keyboardType="number-pad"
                selectTextOnFocus
              />
            </View>
          </View>
          <TouchableOpacity style={styles.modalAddBtn} onPress={saveHeatSettings} activeOpacity={0.85}>
            <Text style={styles.modalAddBtnText}>Lưu</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors, shadows: ThemeShadows, cellW: number) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  scroll: { paddingBottom: 8 },

  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  headerTotal: { flex: 1, minWidth: 0 },
  greeting: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: colors.neutral[500],
    marginBottom: Spacing.sm,
  },
  monthTotalLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  monthTotal: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
    color: colors.neutral[700],
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: colors.ui.cardBorder,
    paddingHorizontal: 2,
  },
  expenseText: { color: colors.expense },

  // Filter
  filterRow: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[100],
    borderRadius: BorderRadius.xl,
    padding: 4,
    gap: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  filterTabEmoji: {
    fontSize: Typography.fontSize.sm,
  },
  filterTabActive: {
    backgroundColor: colors.action.selectedBackground,
    borderWidth: 1,
    borderColor: colors.action.selectedBorder,
    ...shadows.soft,
  },
  filterTabText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    color: colors.neutral[400],
  },
  filterTabTextActive: {
    color: colors.action.selectedText,
  },

  // Calendar
  calendarCard: {
    marginHorizontal: Spacing.base,
    backgroundColor: colors.background.surface,
    borderRadius: BorderRadius['2xl'],
    paddingVertical: Spacing.md,
    paddingHorizontal: CAL_PAD_X,
    borderWidth: 1,
    borderColor: colors.ui.cardBorder,
    marginBottom: Spacing.base,
  },
  calArrow: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calArrowDisabled: { opacity: 0.3 },
  calArrowText: {
    fontSize: Typography.fontSize.lg,
    color: colors.action.selectedText,
    fontWeight: '600',
  },
  calArrowTextDisabled: { color: colors.neutral[400] },
  calMonthLabel: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: colors.neutral[700],
    textTransform: 'capitalize',
  },
  calDayHeaders: {
    flexDirection: 'row',
    gap: CELL_GAP,
    marginBottom: 6,
  },
  dayHeaderText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: colors.neutral[400],
    textAlign: 'center',
  },
  dayHeaderSun: { color: colors.blue[400] },

  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CELL_GAP,
  },

  // Day cell — heatmap tile
  dayHeaderCell: {
    width: cellW,
    alignItems: 'center',
  },
  dayCellEmpty: {
    width: cellW,
    height: Math.round(cellW * 1.15),
  },
  dayCell: {
    width: cellW,
    height: Math.round(cellW * 1.15),
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.ui.cardBorder,
    backgroundColor: colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  dayCellToday: {
    borderWidth: 2,
    borderColor: colors.neutral[700],
  },
  dayNum: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: colors.neutral[500],
  },
  dayNumToday: {
    color: colors.neutral[700],
  },
  dayAmount: {
    fontSize: cellW > 44 ? 11 : 10,
    fontWeight: '700',
    color: colors.neutral[500],
    maxWidth: cellW - 4,
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  dayThumb: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.background.surface,
  },

  // Legend
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  legendLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    color: colors.neutral[400],
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  legendChipText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
  },
  legendGear: {
    marginLeft: 'auto',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
  legendGearText: { fontSize: Typography.fontSize.base, color: colors.neutral[500] },

  // Heat settings sheet
  heatSheet: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
    gap: Spacing.md,
  },
  heatHint: {
    fontSize: Typography.fontSize.xs,
    color: colors.neutral[400],
    fontWeight: '500',
  },
  heatInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  heatInputBox: { flex: 1, gap: 4 },
  heatInput: {
    borderWidth: 1,
    borderColor: colors.ui.fieldBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: colors.neutral[700],
    backgroundColor: colors.background.surface,
  },

  // Day modal (sheet styles — container do BottomSheetModal)
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.metallic.whiteGold,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  sheetHeaderSection: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  modalTitle: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    fontWeight: '800',
    color: colors.neutral[700],
  },
  daySummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.pink[50],
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: colors.pink[100],
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  daySummaryItem: { flex: 1, gap: 2 },
  daySummaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.pink[200],
    marginHorizontal: Spacing.sm,
  },
  daySummaryLabel: {
    fontSize: Typography.fontSize.xs,
    color: colors.neutral[400],
    fontWeight: '600',
  },
  daySummaryAmt: {
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
    color: colors.neutral[700],
  },
  actionErrorText: {
    marginTop: Spacing.sm,
    fontSize: Typography.fontSize.sm,
    color: colors.danger,
    fontWeight: '600',
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: colors.neutral[500],
  },
  modalScroll: {
    flexGrow: 0,
    paddingHorizontal: Spacing.base,
  },
  modalScrollContent: {
    paddingBottom: Spacing.sm,
    flexGrow: 0,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyStateIcon: { fontSize: 40 },
  emptyStateText: {
    fontSize: Typography.fontSize.sm,
    color: colors.neutral[400],
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: Spacing.base,
  },
  modalFooter: {
    flexShrink: 0,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  modalAddBtn: {
    backgroundColor: colors.action.primaryBackground,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...shadows.soft,
  },
  modalAddBtnText: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: colors.action.primaryText,
  },
  txnCard: {
    backgroundColor: colors.background.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.ui.cardBorder,
    overflow: 'hidden',
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  txnDivider: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginLeft: 52 + Spacing.base,
  },
  txnIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  txnIconEmoji: { fontSize: Typography.fontSize.lg },
  txnThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  txnActionBar: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  txnEditBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
    paddingVertical: 7,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    backgroundColor: colors.action.secondaryBackground,
    borderWidth: 1,
    borderColor: colors.action.secondaryBorder,
  },
  txnEditBtnText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: colors.action.secondaryText,
  },
  txnDeleteBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    backgroundColor: colors.pink[50],
    borderWidth: 1,
    borderColor: colors.pink[100],
  },
  txnDeleteBtnText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: colors.expense,
  },
  txnInfo: { flex: 1, minWidth: 0 },
  txnName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  txnNote: {
    fontSize: Typography.fontSize.xs,
    color: colors.neutral[400],
    marginTop: 2,
  },
  txnAudience: {
    fontSize: Typography.fontSize['2xs'],
    color: colors.neutral[400],
    marginTop: 1,
    fontWeight: '600',
  },
  txnRight: { alignItems: 'flex-end', gap: 4 },
  txnAmount: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  payerChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  payerWife: { backgroundColor: colors.pink[100] },
  payerHusband: { backgroundColor: colors.mint[100] },
  payerChipText: {
    fontSize: Typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.neutral[600],
  },
});
}
