import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../constants/theme';
import { BottomSheetModal } from '../../components/ui/BottomSheetModal';
import { getAllPayers, updateStreak } from '../../database/categories';
import {
  deleteTransaction,
  getMonthSummary,
  getTransactionsByMonth,
} from '../../database/transactions';
import { useStreak } from '../../hooks/useStreak';
import type { Transaction } from '../../types';

const { width: SCREEN_W } = Dimensions.get('window');
const CELL_SIZE = Math.floor((SCREEN_W - Spacing.base * 2 - Spacing.xs * 6) / 7);

const fmt = (n: number) => n.toLocaleString('vi-VN');
const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

type FilterTab = 'all' | string;
type TxnWithMeta = Transaction & {
  category_name?: string;
  category_icon?: string;
  category_color?: string;
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 6) return 'Thức khuya thế 🌙';
  if (h < 12) return 'Chào buổi sáng ☀️';
  if (h < 18) return 'Buổi chiều vui vẻ 🌸';
  return 'Buổi tối ấm áp 🌙';
};

export default function HomeScreen() {
  const router = useRouter();
  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());
  const [showDayModal, setShowDayModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [monthTxns, setMonthTxns] = useState<TxnWithMeta[]>([]);
  const [monthSummary, setMonthSummary] = useState({ chi: 0, thu: 0 });
  const [payers, setPayers] = useState<Array<{ name: string; icon: string; color: string }>>([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [txns, summary] = await Promise.all([
        getTransactionsByMonth(calYear, calMonth),
        getMonthSummary(calYear, calMonth),
      ]);
      setMonthTxns(txns as TxnWithMeta[]);
      setMonthSummary(summary);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [calYear, calMonth]);

  const { streak, refreshStreak } = useStreak();

  useFocusEffect(
    useCallback(() => {
      loadData();
      refreshStreak();
      getAllPayers().then((p) =>
        setPayers(p.map(({ name, icon, color }) => ({ name, icon, color })))
      ).catch(console.error);
    }, [loadData, refreshStreak])
  );

  const payerColor = useCallback((name: string) => {
    return payers.find((p) => p.name === name)?.color ?? Colors.pink[300];
  }, [payers]);

  // --- Calendar helpers ---
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const firstDow = new Date(calYear, calMonth - 1, 1).getDay(); // 0=Sun
  const offsetMon = firstDow === 0 ? 6 : firstDow - 1; // 0=Mon

  // Group txns by calendar day number — đã lọc theo activeFilter
  // Dùng string slice thay vì new Date() để tránh Hermes parse sai timezone
  // với format "YYYY-MM-DD HH:MM:SS" của SQLite localtime
  const txnsByDay = useMemo(() => {
    const source = activeFilter === 'all'
      ? monthTxns
      : monthTxns.filter((t) => t.payer === activeFilter);
    const map: Record<number, TxnWithMeta[]> = {};
    for (const t of source) {
      const dateStr = t.created_at.slice(0, 10); // "YYYY-MM-DD"
      const [yr, mo, dy] = dateStr.split('-').map(Number);
      if (yr === calYear && mo === calMonth) {
        if (!map[dy]) map[dy] = [];
        map[dy].push(t);
      }
    }
    return map;
  }, [monthTxns, calYear, calMonth, activeFilter]);

  // Giao dịch của ngày được chọn (đã được lọc sẵn trong txnsByDay)
  const selectedTxns = useMemo(() => {
    if (!selectedDay) return [];
    return txnsByDay[selectedDay] ?? [];
  }, [txnsByDay, selectedDay]);

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

  const handleDeleteTxn = useCallback((id: number) => {
    Alert.alert(
      'Xoá giao dịch?',
      'Giao dịch này sẽ bị xoá vĩnh viễn.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: async () => {
            await deleteTransaction(id);
            await updateStreak();
            await loadData();
            refreshStreak();
          },
        },
      ]
    );
  }, [loadData, refreshStreak]);

  // Build calendar cells array
  const calCells: (number | null)[] = [
    ...Array(offsetMon).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full rows
  while (calCells.length % 7 !== 0) calCells.push(null);

  const renderDayCell = (day: number | null, idx: number) => {
    if (!day) return <View key={`empty-${idx}`} style={[styles.dayCell, styles.dayCellEmpty]} />;

    const txns = txnsByDay[day] ?? [];
    const isToday = isCurrentMonth && day === now.getDate();
    const isSelected = day === selectedDay;
    const imgTxn = txns.find((t) => t.image_uri);
    const hasTxns = txns.length > 0;
    const totalAmt = txns.reduce((s, t) => s + (t.type === 'chi' ? t.amount : 0), 0);

    return (
      <TouchableOpacity
        key={day}
        style={styles.dayCell}
        onPress={() => {
          setSelectedDay(day);
          setShowDayModal(true);
        }}
        activeOpacity={0.75}
      >
        <View style={[
          styles.dayCircle,
          hasTxns && styles.dayCircleHasTxn,
          isSelected && styles.dayCircleSelected,
          isToday && !isSelected && styles.dayCircleToday,
        ]}>
          {imgTxn?.image_uri ? (
            <Image
              source={{ uri: imgTxn.image_uri }}
              style={styles.dayThumb}
            />
          ) : hasTxns ? (
            <Text style={styles.dayCategoryIcon}>
              {txns[0].category_icon ?? '💸'}
            </Text>
          ) : null}

          {/* txn count badge */}
          {txns.length > 1 && (
            <View style={styles.dayBadge}>
              <Text style={styles.dayBadgeText}>+{txns.length - 1}</Text>
            </View>
          )}
        </View>

        <Text style={[
          styles.dayNum,
          isToday && styles.dayNumToday,
          isSelected && styles.dayNumSelected,
        ]}>
          {day}
        </Text>

        {isToday && <View style={styles.todayDot} />}
      </TouchableOpacity>
    );
  };

  const renderTxn = (item: TxnWithMeta, withActions = false) => {
    const isIncome = item.type === 'thu';
    const bgColor = item.category_color ? item.category_color + '22' : Colors.pink[100];
    return (
      <View>
        <View style={styles.txnRow}>
          <View style={[styles.txnIcon, { backgroundColor: bgColor, overflow: 'hidden' }]}>
            {item.image_uri ? (
              <Image source={{ uri: item.image_uri }} style={styles.txnThumb} />
            ) : (
              <Text style={styles.txnIconEmoji}>
                {item.category_icon ?? (isIncome ? '💰' : '💸')}
              </Text>
            )}
          </View>
          <View style={styles.txnInfo}>
            <Text style={styles.txnName} numberOfLines={1}>
              {item.category_name ?? (isIncome ? 'Thu nhập' : 'Chi tiêu')}
            </Text>
            <Text style={styles.txnNote} numberOfLines={1}>
              {item.note || item.location || item.payer}
            </Text>
          </View>
          <View style={styles.txnRight}>
            <Text style={[styles.txnAmount, isIncome ? styles.incomeText : styles.expenseText]}>
              {isIncome ? '+' : '-'}{fmt(item.amount)}đ
            </Text>
            <View style={[styles.payerChip, { backgroundColor: payerColor(item.payer) + '33' }]}>
              <Text style={styles.payerChipText}>{item.payer}</Text>
            </View>
          </View>
        </View>

        {withActions && (
          <View style={styles.txnActionBar}>
            <TouchableOpacity
              style={styles.txnEditBtn}
              onPress={() => handleEditTxn(item)}
              activeOpacity={0.75}
            >
              <Text style={styles.txnEditBtnText}>✏️  Sửa</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.txnDeleteBtn}
              onPress={() => handleDeleteTxn(item.id)}
              activeOpacity={0.75}
            >
              <Text style={styles.txnDeleteBtnText}>🗑  Xoá</Text>
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
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          {(streak?.current_streak ?? 0) > 0 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>🔥 {streak?.current_streak} ngày liên tiếp</Text>
            </View>
          )}
        </View>
        <View style={styles.summaryCards}>
          <View style={[styles.summaryCard, styles.summaryCardChi]}>
            <Text style={styles.summaryCardLabel}>Chi</Text>
            <Text style={[styles.summaryCardAmt, styles.expenseText]}>{fmt(monthSummary.chi)}đ</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardThu]}>
            <Text style={styles.summaryCardLabel}>Thu</Text>
            <Text style={[styles.summaryCardAmt, styles.incomeText]}>{fmt(monthSummary.thu)}đ</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* === FILTER TABS === */}
        <View style={styles.filterRow}>
          {([
            { id: 'all', emoji: '🗂', label: 'Tất cả' },
            ...payers.map((p) => ({ id: p.name, emoji: p.icon, label: p.name })),
          ] as { id: FilterTab; emoji: string; label: string }[]).map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.filterTab, activeFilter === tab.id && styles.filterTabActive]}
              onPress={() => setActiveFilter(tab.id)}
            >
              <Text style={styles.filterTabEmoji}>{tab.emoji}</Text>
              <Text style={[styles.filterTabText, activeFilter === tab.id && styles.filterTabTextActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* === CALENDAR === */}
        <View style={styles.calendarCard}>
          {/* Month nav */}
          <View style={styles.calHeader}>
            <TouchableOpacity style={styles.calArrow} onPress={prevMonth}>
              <Text style={styles.calArrowText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.calMonthLabel}>
              tháng {calMonth} {calYear}
            </Text>
            <TouchableOpacity
              style={[styles.calArrow, isCurrentMonth && styles.calArrowDisabled]}
              onPress={nextMonth}
              disabled={isCurrentMonth}
            >
              <Text style={[styles.calArrowText, isCurrentMonth && styles.calArrowTextDisabled]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={styles.calDayHeaders}>
            {DAY_LABELS.map((d) => (
              <View key={d} style={styles.dayCell}>
                <Text style={[styles.dayHeaderText, d === 'CN' && styles.dayHeaderSun]}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          {isLoading ? (
            <ActivityIndicator color={Colors.pink[400]} style={{ paddingVertical: 40 }} />
          ) : (
            <View style={styles.calGrid}>
              {calCells.map((day, idx) => renderDayCell(day, idx))}
            </View>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* === DAY DETAIL MODAL === */}
      <BottomSheetModal
        visible={showDayModal && selectedDay !== null}
        onClose={() => setShowDayModal(false)}
      >
          <View style={styles.modalHandle} />

          {/* Modal header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>
                Ngày {selectedDay}/{calMonth}
              </Text>
              <Text style={styles.modalSubtitle}>
                {selectedTxns.length > 0
                  ? `${selectedTxns.length} giao dịch`
                  : 'Chưa có giao dịch'}
              </Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowDayModal(false)}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Transaction list */}
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {selectedTxns.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>📭</Text>
                <Text style={styles.emptyStateText}>Ngày này chưa ghi giao dịch nào</Text>
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

          {/* Add transaction CTA */}
          <View style={styles.modalFooter}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.primary },
  scroll: { paddingBottom: 8 },

  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  greeting: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
    color: Colors.neutral[700],
  },
  streakBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.yellow[100],
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderColor: Colors.yellow[300],
    marginTop: 4,
  },
  streakText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.neutral[600],
  },
  summaryCards: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  summaryCard: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: 3,
    ...Shadows.soft,
  },
  summaryCardChi: {
    backgroundColor: Colors.pink[50],
    borderWidth: 1.5,
    borderColor: Colors.pink[100],
  },
  summaryCardThu: {
    backgroundColor: Colors.mint[50],
    borderWidth: 1.5,
    borderColor: Colors.mint[100],
  },
  summaryCardLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.neutral[400],
    fontWeight: '600',
  },
  summaryCardAmt: {
    fontSize: Typography.fontSize.md,
    fontWeight: '800',
  },
  expenseText: { color: Colors.pink[500] },
  incomeText: { color: Colors.mint[400] },

  // Filter
  filterRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    backgroundColor: Colors.neutral[100],
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
    fontSize: 13,
  },
  filterTabActive: {
    backgroundColor: Colors.background.surface,
    ...Shadows.soft,
  },
  filterTabText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    color: Colors.neutral[400],
  },
  filterTabTextActive: {
    color: Colors.pink[500],
  },

  // Calendar
  calendarCard: {
    marginHorizontal: Spacing.base,
    backgroundColor: Colors.background.card,
    borderRadius: BorderRadius['2xl'],
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    marginBottom: Spacing.base,
    ...Shadows.soft,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  calArrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calArrowDisabled: { opacity: 0.3 },
  calArrowText: {
    fontSize: 26,
    color: Colors.pink[400],
    fontWeight: '600',
  },
  calArrowTextDisabled: { color: Colors.neutral[400] },
  calMonthLabel: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: Colors.neutral[700],
    textTransform: 'capitalize',
  },
  calDayHeaders: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayHeaderText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.neutral[400],
    textAlign: 'center',
  },
  dayHeaderSun: { color: Colors.pink[400] },

  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  // Day cell
  dayCell: {
    width: CELL_SIZE,
    alignItems: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  dayCellEmpty: {},
  dayCircle: {
    width: CELL_SIZE - 6,
    height: CELL_SIZE - 6,
    borderRadius: (CELL_SIZE - 6) / 2,
    backgroundColor: Colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dayCircleHasTxn: {
    borderWidth: 2.5,
    borderColor: Colors.pink[200],
  },
  dayCircleSelected: {
    borderColor: Colors.pink[400],
    borderWidth: 2.5,
    ...Shadows.soft,
  },
  dayCircleToday: {
    borderColor: Colors.lavender[300],
    borderWidth: 2,
  },
  dayThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  dayCategoryIcon: {
    fontSize: CELL_SIZE > 42 ? 18 : 14,
  },
  dayBadge: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    backgroundColor: Colors.pink[400],
    borderRadius: 6,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  dayBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#fff',
  },
  dayNum: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.neutral[500],
  },
  dayNumToday: {
    color: Colors.lavender[400],
    fontWeight: '800',
  },
  dayNumSelected: {
    color: Colors.pink[500],
    fontWeight: '800',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.lavender[300],
    position: 'absolute',
    bottom: 2,
  },

  // Day modal (sheet styles — container do BottomSheetModal)
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.neutral[300],
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
  },
  modalTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: '800',
    color: Colors.neutral[700],
  },
  modalSubtitle: {
    fontSize: Typography.fontSize.xs,
    color: Colors.neutral[400],
    fontWeight: '500',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.neutral[500],
  },
  modalScroll: { flexGrow: 0 },
  modalScrollContent: {
    padding: Spacing.base,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyStateIcon: { fontSize: 40 },
  emptyStateText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[400],
    fontWeight: '500',
  },
  modalFooter: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[100],
  },
  modalAddBtn: {
    backgroundColor: Colors.pink[400],
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.soft,
  },
  modalAddBtnText: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: '#fff',
  },
  txnCard: {
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
  },
  txnDivider: {
    height: 1,
    backgroundColor: Colors.neutral[100],
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
  txnIconEmoji: { fontSize: 20 },
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
    flex: 1,
    paddingVertical: 7,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    backgroundColor: Colors.neutral[100],
  },
  txnEditBtnText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.neutral[600],
  },
  txnDeleteBtn: {
    paddingVertical: 7,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    backgroundColor: Colors.pink[50],
    borderWidth: 1,
    borderColor: Colors.pink[100],
  },
  txnDeleteBtnText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.pink[500],
  },
  txnInfo: { flex: 1 },
  txnName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: Colors.neutral[700],
  },
  txnNote: {
    fontSize: Typography.fontSize.xs,
    color: Colors.neutral[400],
    marginTop: 2,
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
  payerWife: { backgroundColor: Colors.pink[100] },
  payerHusband: { backgroundColor: Colors.mint[100] },
  payerChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.neutral[600],
  },
});
