import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { AmountKeyboard, formatAmount } from '../form/AmountKeyboard';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import {
  DAY_SHEET_MAX_HEIGHT_RATIO,
  daySheetListMaxHeight,
} from '../../constants/layout';
import { BorderRadius, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';
import { useModalBottomInset } from '../../hooks/useModalBottomInset';
import {
  budgetProgressBarFill,
  formatBudgetProgressLabel,
} from '../../database/householdFoodBudgetCalculations';
import {
  loadHouseholdFoodBudgetDetail,
  updateHouseholdFoodBudgetPeriodLimit,
  type HouseholdFoodBudgetDetailData,
} from '../../database/householdFoodBudgetRead';
import { fmtVnd, formatPeriodRangeShort } from '../../database/householdFoodBudgetUi';

interface HouseholdFoodBudgetDetailSheetProps {
  visible: boolean;
  periodId: number | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export function HouseholdFoodBudgetDetailSheet({
  visible,
  periodId,
  onClose,
  onUpdated,
}: HouseholdFoodBudgetDetailSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { height: windowHeight } = useWindowDimensions();
  const sheetBottomInset = useModalBottomInset();
  const headerH = useRef(0);
  const footerH = useRef(0);
  const [chromeH, setChromeH] = useState(260);
  const syncChrome = useCallback(() => {
    const next = headerH.current + footerH.current;
    setChromeH((prev) => (prev === next ? prev : next));
  }, []);

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<HouseholdFoodBudgetDetailData | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!periodId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    try {
      const data = await loadHouseholdFoodBudgetDetail(periodId);
      setDetail(data);
      if (data) {
        setEditAmount(String(data.period.limit_amount));
      }
    } catch (err) {
      console.error(err);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  React.useEffect(() => {
    if (visible && periodId) {
      loadDetail();
    }
    if (!visible) {
      setShowEdit(false);
    }
  }, [visible, periodId, loadDetail]);

  const listMaxHeight = daySheetListMaxHeight(windowHeight, chromeH, sheetBottomInset);
  const sheetStyle = useMemo(
    () => ({ maxHeight: `${Math.round(DAY_SHEET_MAX_HEIGHT_RATIO * 100)}%` as const }),
    [],
  );

  const handleSaveLimit = async () => {
    if (!periodId) return;
    const parsed = parseInt(editAmount.replace(/\D/g, ''), 10);
    if (!Number.isInteger(parsed) || parsed < 0) {
      Alert.alert('Không hợp lệ', 'Ngân sách phải là số nguyên ≥ 0.');
      return;
    }
    setSaving(true);
    try {
      await updateHouseholdFoodBudgetPeriodLimit(periodId, parsed);
      setShowEdit(false);
      await loadDetail();
      onUpdated?.();
    } catch {
      Alert.alert('Lỗi', 'Không thể cập nhật ngân sách. Hãy thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const amounts = detail?.amounts;
  const progressFill = amounts ? budgetProgressBarFill(amounts.progressRatio) : 0;
  const statusColor =
    amounts?.overAmount
      ? colors.danger
      : amounts?.status === 'near_limit'
        ? colors.warning
        : amounts?.status === 'attention'
          ? colors.info
          : colors.success;

  return (
    <>
      <BottomSheetModal visible={visible && !showEdit} onClose={onClose} sheetStyle={sheetStyle}>
        <View
          onLayout={(e) => {
            headerH.current = e.nativeEvent.layout.height;
            syncChrome();
          }}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Quỹ ăn</Text>
            {detail ? (
              <Text style={styles.subtitle}>
                {formatPeriodRangeShort(detail.period.period_start, detail.period.period_end)}
              </Text>
            ) : null}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading || !detail ? (
            <ActivityIndicator color={colors.blue[400]} style={{ paddingVertical: Spacing.lg }} />
          ) : (
            <View style={styles.summaryBlock}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ngân sách</Text>
                <Text style={styles.summaryValue}>{fmtVnd(detail.period.limit_amount)}đ</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Đã dùng</Text>
                <Text style={[styles.summaryValue, styles.spentText]}>
                  {fmtVnd(amounts?.spentAmount ?? 0)}đ
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {amounts && amounts.overAmount > 0 ? 'Vượt' : 'Còn lại'}
                </Text>
                <Text
                  style={[
                    styles.summaryValue,
                    amounts && amounts.overAmount > 0 ? styles.overText : styles.remainingText,
                  ]}
                >
                  {fmtVnd(
                    amounts && amounts.overAmount > 0
                      ? amounts.overAmount
                      : amounts?.remainingAmount ?? 0,
                  )}đ
                </Text>
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
                {amounts ? formatBudgetProgressLabel(amounts.progressPercent) : '0%'} đã dùng
              </Text>
              <Text style={styles.contributionTitle}>Dự kiến góp</Text>
              <Text style={styles.contributionLine}>
                Kai 80% · {fmtVnd(detail.plannedContribution.kai)}đ
              </Text>
              <Text style={styles.contributionLine}>
                Yue 20% · {fmtVnd(detail.plannedContribution.yue)}đ
              </Text>
            </View>
          )}
        </View>

        <ScrollView
          style={[styles.scroll, { maxHeight: listMaxHeight }]}
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {detail && detail.breakdown.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Theo danh mục</Text>
              {detail.breakdown.map((row) => (
                <View key={row.category_id} style={styles.breakdownRow}>
                  <Text style={styles.breakdownIcon}>{row.category_icon}</Text>
                  <View style={styles.breakdownMeta}>
                    <Text style={styles.breakdownName}>{row.category_name}</Text>
                    <Text style={styles.breakdownShare}>
                      {Math.round(row.shareOfSpent * 1000) / 10}% chi tiêu kỳ
                    </Text>
                  </View>
                  <Text style={styles.breakdownAmount}>{fmtVnd(row.amount)}đ</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Giao dịch trong kỳ</Text>
            {detail && detail.transactions.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có giao dịch trong kỳ này</Text>
            ) : (
              detail?.transactions.map((txn) => (
                <View key={txn.id} style={styles.txnRow}>
                  <View style={styles.txnLeft}>
                    <Text style={styles.txnCategory}>
                      {txn.category_icon} {txn.category_name}
                    </Text>
                    <Text style={styles.txnMeta}>
                      {txn.transaction_date.slice(8, 10)}/{txn.transaction_date.slice(5, 7)} ·{' '}
                      {txn.source_name} · {txn.expense_audience_label}
                    </Text>
                    {txn.note ? <Text style={styles.txnNote}>{txn.note}</Text> : null}
                  </View>
                  <Text style={styles.txnAmount}>-{fmtVnd(txn.amount)}đ</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        <View
          style={[styles.footer, { paddingBottom: Math.max(Spacing.sm, sheetBottomInset) }]}
          onLayout={(e) => {
            footerH.current = e.nativeEvent.layout.height;
            syncChrome();
          }}
        >
          <TouchableOpacity
            style={[styles.editBtn, !detail && styles.editBtnDisabled]}
            disabled={!detail}
            onPress={() => setShowEdit(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.editBtnText}>Chỉnh ngân sách kỳ này</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>

      <BottomSheetModal
        visible={showEdit}
        onClose={() => setShowEdit(false)}
        keyboardAvoiding
        sheetStyle={sheetStyle}
      >
        <View style={styles.handle} />
        <Text style={styles.title}>Chỉnh ngân sách kỳ này</Text>
        <Text style={styles.editPreview}>{formatAmount(editAmount) || '0'}đ</Text>
        <AmountKeyboard value={editAmount} onChange={setEditAmount} />
        <View style={{ paddingBottom: Math.max(Spacing.sm, sheetBottomInset) }}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSaveLimit}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Đang lưu...' : 'Lưu ngân sách'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => setShowEdit(false)}
            activeOpacity={0.85}
          >
            <Text style={styles.cancelBtnText}>Huỷ</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.neutral[200],
      alignSelf: 'center',
      marginBottom: Spacing.sm,
    },
    header: {
      paddingHorizontal: Spacing.base,
      paddingBottom: Spacing.sm,
    },
    title: {
      fontSize: Typography.fontSize.lg,
      fontWeight: '800',
      color: colors.neutral[800],
    },
    subtitle: {
      fontSize: Typography.fontSize.sm,
      fontWeight: '700',
      color: colors.neutral[500],
      marginTop: 2,
    },
    closeBtn: {
      position: 'absolute',
      right: Spacing.base,
      top: 0,
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeText: {
      fontSize: Typography.fontSize.lg,
      color: colors.neutral[400],
      fontWeight: '700',
    },
    summaryBlock: {
      paddingHorizontal: Spacing.base,
      paddingBottom: Spacing.sm,
      gap: 6,
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
      fontSize: Typography.fontSize.base,
      fontWeight: '800',
      color: colors.neutral[800],
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
    contributionTitle: {
      marginTop: Spacing.sm,
      fontSize: Typography.fontSize.xs,
      fontWeight: '800',
      color: colors.neutral[500],
    },
    contributionLine: {
      fontSize: Typography.fontSize.sm,
      color: colors.neutral[600],
      fontWeight: '600',
    },
    scroll: {
      paddingHorizontal: Spacing.base,
    },
    scrollContent: {
      paddingBottom: Spacing.md,
      gap: Spacing.md,
    },
    section: {
      gap: Spacing.sm,
    },
    sectionTitle: {
      fontSize: Typography.fontSize.sm,
      fontWeight: '800',
      color: colors.neutral[700],
    },
    breakdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    breakdownIcon: { fontSize: 20 },
    breakdownMeta: { flex: 1, gap: 2 },
    breakdownName: {
      fontSize: Typography.fontSize.sm,
      fontWeight: '700',
      color: colors.neutral[700],
    },
    breakdownShare: {
      fontSize: Typography.fontSize.xs,
      color: colors.neutral[400],
    },
    breakdownAmount: {
      fontSize: Typography.fontSize.sm,
      fontWeight: '800',
      color: colors.neutral[800],
    },
    txnRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.ui.cardBorder,
    },
    txnLeft: { flex: 1, gap: 2 },
    txnCategory: {
      fontSize: Typography.fontSize.sm,
      fontWeight: '700',
      color: colors.neutral[700],
    },
    txnMeta: {
      fontSize: Typography.fontSize.xs,
      color: colors.neutral[400],
    },
    txnNote: {
      fontSize: Typography.fontSize.xs,
      color: colors.neutral[500],
    },
    txnAmount: {
      fontSize: Typography.fontSize.sm,
      fontWeight: '800',
      color: colors.pink[500],
    },
    emptyText: {
      fontSize: Typography.fontSize.sm,
      color: colors.neutral[400],
      fontStyle: 'italic',
    },
    footer: {
      paddingHorizontal: Spacing.base,
      paddingTop: Spacing.sm,
    },
    editBtn: {
      backgroundColor: colors.action.primaryBackground,
      borderRadius: BorderRadius.xl,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    editBtnDisabled: { opacity: 0.5 },
    editBtnText: {
      color: colors.action.primaryText,
      fontWeight: '800',
      fontSize: Typography.fontSize.base,
    },
    editPreview: {
      fontSize: Typography.fontSize['2xl'],
      fontWeight: '800',
      color: colors.neutral[800],
      textAlign: 'center',
      marginVertical: Spacing.md,
    },
    saveBtn: {
      marginHorizontal: Spacing.base,
      marginTop: Spacing.sm,
      backgroundColor: colors.action.primaryBackground,
      borderRadius: BorderRadius.xl,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: {
      color: colors.action.primaryText,
      fontWeight: '800',
      fontSize: Typography.fontSize.base,
    },
    cancelBtn: {
      marginHorizontal: Spacing.base,
      marginTop: Spacing.sm,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    cancelBtnText: {
      color: colors.neutral[500],
      fontWeight: '700',
      fontSize: Typography.fontSize.base,
    },
  });
}
