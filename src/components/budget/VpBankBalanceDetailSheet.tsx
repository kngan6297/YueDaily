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
  addVpBankPeriodAdjustment,
  loadVpBankBalanceDetail,
  resetVpBankPeriodAdjustment,
  updateVpBankPeriodOpeningBalance,
  type VpBankBalanceDetailData,
} from '../../database/trackedSourceBalanceRead';
import { fmtVnd } from '../../database/trackedSourceBalanceUi';

function formatSignedVnd(amount: number): string {
  if (amount > 0) return `+${fmtVnd(amount)}đ`;
  if (amount < 0) return `−${fmtVnd(Math.abs(amount))}đ`;
  return `${fmtVnd(0)}đ`;
}

interface VpBankBalanceDetailSheetProps {
  visible: boolean;
  periodId: number | null;
  /** When true, open immediately into opening-balance editor */
  preferOpeningEdit?: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function VpBankBalanceDetailSheet({
  visible,
  periodId,
  preferOpeningEdit = false,
  onClose,
  onUpdated,
}: VpBankBalanceDetailSheetProps) {
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
  const [detail, setDetail] = useState<VpBankBalanceDetailData | null>(null);
  const [showEditOpening, setShowEditOpening] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustDigits, setAdjustDigits] = useState('');
  const [adjustSign, setAdjustSign] = useState<1 | -1>(1);
  const [saving, setSaving] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!periodId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    try {
      const data = await loadVpBankBalanceDetail(periodId);
      setDetail(data);
      if (data) {
        setEditAmount(
          data.period.opening_balance != null
            ? String(data.period.opening_balance)
            : '',
        );
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
      if (preferOpeningEdit) {
        setShowEditOpening(true);
      }
    }
    if (!visible) {
      setShowEditOpening(false);
      setShowAdjust(false);
      setAdjustDigits('');
      setAdjustSign(1);
    }
  }, [visible, periodId, loadDetail, preferOpeningEdit]);

  const listMaxHeight = daySheetListMaxHeight(windowHeight, chromeH, sheetBottomInset);
  const sheetStyle = useMemo(
    () => ({ maxHeight: `${Math.round(DAY_SHEET_MAX_HEIGHT_RATIO * 100)}%` as const }),
    [],
  );

  const handleSaveOpening = async () => {
    if (!periodId) return;
    const parsed = parseInt(editAmount.replace(/\D/g, ''), 10);
    if (!Number.isInteger(parsed) || parsed < 0) {
      Alert.alert('Không hợp lệ', 'Số dư đầu kỳ phải là số nguyên ≥ 0.');
      return;
    }
    setSaving(true);
    try {
      await updateVpBankPeriodOpeningBalance(periodId, parsed);
      setShowEditOpening(false);
      await loadDetail();
      onUpdated?.();
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu số dư đầu kỳ. Hãy thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdjustment = async () => {
    if (!periodId) return;
    const digits = adjustDigits.replace(/\D/g, '');
    const magnitude = parseInt(digits, 10);
    if (!Number.isInteger(magnitude) || magnitude <= 0) {
      Alert.alert('Không hợp lệ', 'Nhập số tiền điều chỉnh. Dùng + / − để chọn dấu.');
      return;
    }
    const delta = adjustSign * magnitude;
    setSaving(true);
    try {
      await addVpBankPeriodAdjustment(periodId, delta);
      setShowAdjust(false);
      setAdjustDigits('');
      setAdjustSign(1);
      await loadDetail();
      onUpdated?.();
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu điều chỉnh. Hãy thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetAdjustment = () => {
    if (!periodId || !detail) return;
    Alert.alert(
      'Đặt lại điều chỉnh?',
      'Điều chỉnh sẽ về 0đ. Số dư đầu kỳ không đổi.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Đặt lại',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await resetVpBankPeriodAdjustment(periodId);
              await loadDetail();
              onUpdated?.();
            } catch {
              Alert.alert('Lỗi', 'Không thể đặt lại điều chỉnh.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const amounts = detail?.amounts;

  return (
    <>
      <BottomSheetModal
        visible={visible && !showEditOpening && !showAdjust}
        onClose={onClose}
        sheetStyle={sheetStyle}
      >
        <View
          onLayout={(e) => {
            headerH.current = e.nativeEvent.layout.height;
            syncChrome();
          }}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{detail?.sourceName ?? 'VPBank'}</Text>
            {detail ? <Text style={styles.subtitle}>{detail.monthLabel}</Text> : null}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading || !detail ? (
            <ActivityIndicator color={colors.blue[400]} style={{ paddingVertical: Spacing.lg }} />
          ) : detail.needsOpeningBalance || !amounts ? (
            <View style={styles.summaryBlock}>
              <Text style={styles.missingOpening}>Chưa nhập số dư đầu kỳ</Text>
              <Text style={styles.missingHint}>
                Số dư đầu kỳ là số dư lúc bắt đầu ngày 01 của tháng này. Nhập để theo dõi số dư
                VPBank — chưa nhập thì không tính số dư hiện tại.
              </Text>
            </View>
          ) : (
            <View style={styles.summaryBlock}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Số dư đầu kỳ</Text>
                <Text style={styles.summaryValue}>{fmtVnd(amounts.openingBalance)}đ</Text>
              </View>
              <Text style={styles.openingCaption}>Số dư lúc bắt đầu ngày 01 tháng này</Text>
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
              {detail.period.adjustment_amount !== 0 ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Điều chỉnh</Text>
                  <Text style={[styles.summaryValue, styles.adjustText]}>
                    {formatSignedVnd(detail.period.adjustment_amount)}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.summaryRow, styles.currentRow]}>
                <Text style={styles.currentLabel}>Số dư hiện tại</Text>
                <Text style={styles.currentValue}>{fmtVnd(amounts.currentBalance)}đ</Text>
              </View>
            </View>
          )}
        </View>

        <ScrollView
          style={[styles.scroll, { maxHeight: listMaxHeight }]}
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Giao dịch VPBank trong tháng</Text>
            {detail && detail.transactions.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có giao dịch trong tháng này</Text>
            ) : (
              detail?.transactions.map((txn) => (
                <View key={txn.id} style={styles.txnRow}>
                  <View style={styles.txnLeft}>
                    <Text style={styles.txnCategory}>
                      {txn.category_icon} {txn.category_name}
                    </Text>
                    <Text style={styles.txnMeta}>
                      {txn.transaction_date.slice(8, 10)}/{txn.transaction_date.slice(5, 7)} ·{' '}
                      {txn.type === 'thu' ? 'Thu' : 'Chi'} · {txn.expense_audience_label}
                    </Text>
                    {txn.note ? <Text style={styles.txnNote}>{txn.note}</Text> : null}
                  </View>
                  <Text
                    style={[
                      styles.txnAmount,
                      txn.type === 'thu' ? styles.incomeText : styles.expenseText,
                    ]}
                  >
                    {txn.type === 'thu' ? '+' : '−'}
                    {fmtVnd(txn.amount)}đ
                  </Text>
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
            onPress={() => {
              setEditAmount(
                detail?.period.opening_balance != null
                  ? String(detail.period.opening_balance)
                  : '',
              );
              setShowEditOpening(true);
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.editBtnText}>
              {detail?.needsOpeningBalance ? 'Nhập số dư đầu kỳ' : 'Sửa số dư đầu kỳ'}
            </Text>
          </TouchableOpacity>
          {detail && !detail.needsOpeningBalance ? (
            <TouchableOpacity
              style={styles.editBtnSecondary}
              onPress={() => {
                setAdjustDigits('');
                setAdjustSign(1);
                setShowAdjust(true);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.editBtnSecondaryText}>Điều chỉnh số dư</Text>
            </TouchableOpacity>
          ) : null}
          {detail && detail.period.adjustment_amount !== 0 ? (
            <TouchableOpacity
              style={[styles.resetAdjustBtn, saving && styles.editBtnDisabled]}
              disabled={saving}
              onPress={handleResetAdjustment}
              activeOpacity={0.85}
            >
              <Text style={styles.resetAdjustBtnText}>Đặt lại điều chỉnh</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </BottomSheetModal>

      <BottomSheetModal
        visible={showAdjust}
        onClose={() => setShowAdjust(false)}
        keyboardAvoiding
        sheetStyle={sheetStyle}
      >
        <View style={styles.handle} />
        <Text style={styles.title}>Điều chỉnh số dư</Text>
        <Text style={styles.adjustHint}>
          Cộng dồn vào điều chỉnh hiện tại (
          {formatSignedVnd(detail?.period.adjustment_amount ?? 0)}). Ví dụ: lãi +138, sửa −500.
        </Text>
        <View style={styles.signRow}>
          <TouchableOpacity
            style={[styles.signBtn, adjustSign === 1 && styles.signBtnActivePlus]}
            onPress={() => setAdjustSign(1)}
            activeOpacity={0.85}
          >
            <Text style={[styles.signBtnText, adjustSign === 1 && styles.signBtnTextActive]}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.signBtn, adjustSign === -1 && styles.signBtnActiveMinus]}
            onPress={() => setAdjustSign(-1)}
            activeOpacity={0.85}
          >
            <Text style={[styles.signBtnText, adjustSign === -1 && styles.signBtnTextActive]}>−</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.editPreview}>
          {adjustSign < 0 ? '−' : '+'}
          {formatAmount(adjustDigits) || '0'}đ
        </Text>
        <AmountKeyboard value={adjustDigits} onChange={setAdjustDigits} />
        <View style={{ paddingBottom: Math.max(Spacing.sm, sheetBottomInset) }}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSaveAdjustment}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Đang lưu...' : 'Lưu'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => setShowAdjust(false)}
            activeOpacity={0.85}
          >
            <Text style={styles.cancelBtnText}>Huỷ</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>

      <BottomSheetModal
        visible={showEditOpening}
        onClose={() => setShowEditOpening(false)}
        keyboardAvoiding
        sheetStyle={sheetStyle}
      >
        <View style={styles.handle} />
        <Text style={styles.title}>Số dư đầu kỳ</Text>
        <Text style={styles.adjustHint}>
          Số dư lúc bắt đầu ngày 01 của tháng này. Lưu sẽ thay thế giá trị hiện tại (không cộng
          dồn). Tháng sau bắt đầu lại với chưa nhập.
        </Text>
        <Text style={styles.editPreview}>{formatAmount(editAmount) || '0'}đ</Text>
        <AmountKeyboard value={editAmount} onChange={setEditAmount} />
        <View style={{ paddingBottom: Math.max(Spacing.sm, sheetBottomInset) }}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSaveOpening}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Đang lưu...' : 'Lưu số dư'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => setShowEditOpening(false)}
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
    missingOpening: {
      fontSize: Typography.fontSize.base,
      fontWeight: '700',
      color: colors.neutral[600],
    },
    missingHint: {
      fontSize: Typography.fontSize.sm,
      color: colors.neutral[400],
      fontWeight: '600',
      lineHeight: 20,
    },
    openingCaption: {
      fontSize: Typography.fontSize.xs,
      color: colors.neutral[400],
      fontWeight: '600',
      marginTop: -2,
      marginBottom: 2,
    },
    adjustHint: {
      fontSize: Typography.fontSize.sm,
      color: colors.neutral[500],
      fontWeight: '600',
      paddingHorizontal: Spacing.base,
      marginBottom: Spacing.sm,
      lineHeight: 20,
    },
    signRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.base,
      marginBottom: Spacing.xs,
    },
    signBtn: {
      width: 56,
      height: 44,
      borderRadius: BorderRadius.lg,
      borderWidth: 1.5,
      borderColor: colors.neutral[200],
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.neutral[50],
    },
    signBtnActivePlus: {
      borderColor: colors.success,
      backgroundColor: colors.success + '18',
    },
    signBtnActiveMinus: {
      borderColor: colors.danger,
      backgroundColor: colors.danger + '18',
    },
    signBtnText: {
      fontSize: Typography.fontSize.xl,
      fontWeight: '800',
      color: colors.neutral[500],
    },
    signBtnTextActive: {
      color: colors.neutral[800],
    },
    editBtnSecondary: {
      marginTop: Spacing.sm,
      borderRadius: BorderRadius.xl,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.neutral[200],
      backgroundColor: colors.neutral[50],
    },
    editBtnSecondaryText: {
      color: colors.neutral[700],
      fontWeight: '800',
      fontSize: Typography.fontSize.base,
    },
    resetAdjustBtn: {
      marginTop: Spacing.sm,
      borderRadius: BorderRadius.xl,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    resetAdjustBtnText: {
      color: colors.danger,
      fontWeight: '700',
      fontSize: Typography.fontSize.sm,
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
