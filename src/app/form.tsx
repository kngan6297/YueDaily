import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
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
import { AmountKeyboard, formatAmount } from '../components/form/AmountKeyboard';
import { BottomSheetModal } from '../components/ui/BottomSheetModal';
import { BorderRadius, Spacing, ThemeColors, ThemeShadows, Typography } from '../constants/theme';
import { useAppTheme } from '../context/ThemeContext';
import { isSourceActive, pickerSources, resolveCreateSourceId } from '../database/sourceLifecycle';
import { useGemini } from '../hooks/useGemini';
import { useModalBottomInset } from '../hooks/useModalBottomInset';
import { RECEIPT_SCAN_ENABLED } from '../platform/receiptScanEnabled';
import { listExpenseCategoriesByUsage } from '../repositories/categories';
import { userMessageForDataError } from '../repositories/errors';
import { listSources } from '../repositories/sources';
import {
  getTransactionById,
  insertTransaction,
  updateTransaction,
} from '../repositories/transactions';
import type {
  EntityId,
  FinanceCategory,
  FinanceSource,
  FinanceTransactionInput,
} from '../repositories/types';
import { ReceiptAiError } from '../services/receiptAi/errors';
import { preprocessReceiptImage } from '../services/receiptAi/preprocessReceiptImage';
import {
  receiptAiDevLog,
  sanitizeErrorCategory,
} from '../services/receiptAi/devLog';
import {
  consumePendingReceiptImage,
} from '../services/receiptAi/pendingReceiptImage';
import type { ExpenseAudience } from '../types';
import {
  DEFAULT_EXPENSE_AUDIENCE,
  EXPENSE_AUDIENCE_CHOICES,
  EXPENSE_AUDIENCE_ICONS,
  EXPENSE_AUDIENCE_LABELS,
} from '../types';
import {
  formatDateVi,
  formatLocalDate,
  parseLocalDate,
} from '../utils/date';
import { getLastSelectedSourceId, setLastSelectedSourceId } from '../utils/lastSource';

// ─── Dropdown Picker ──────────────────────────────────────────────────────────

interface PickerOption {
  id: string;
  label: string;
  icon?: string;
  color?: string;
}

interface DropdownPickerProps {
  value: string | null;
  label: string;
  placeholder?: string;
  options: PickerOption[];
  onSelect: (id: string) => void;
  accentColor?: string;
}

const AUDIENCE_ICONS: Record<Exclude<ExpenseAudience, 'unspecified'>, string> = {
  wife: EXPENSE_AUDIENCE_ICONS.wife,
  husband: EXPENSE_AUDIENCE_ICONS.husband,
  couple: EXPENSE_AUDIENCE_ICONS.couple,
  wife_and_sister: EXPENSE_AUDIENCE_ICONS.wife_and_sister,
  couple_and_sister: EXPENSE_AUDIENCE_ICONS.couple_and_sister,
};

function DropdownPicker({
  value,
  label,
  placeholder = 'Chọn',
  options,
  onSelect,
  accentColor,
}: DropdownPickerProps) {
  const { colors, shadows, resolvedColorScheme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, shadows, resolvedColorScheme), [colors, shadows, resolvedColorScheme]);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => String(o.id) === String(value));

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.pill, open && styles.pillSelected]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        {selected?.icon && <Text style={styles.pillIcon}>{selected.icon}</Text>}
        <Text style={[styles.pillText, !selected && styles.pillPlaceholder]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Text style={styles.pillChevron}>▾</Text>
      </TouchableOpacity>

      <BottomSheetModal visible={open} onClose={() => setOpen(false)}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>{label}</Text>
        <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          {options.map((opt) => {
            const isActive = String(opt.id) === String(value);
            return (
              <TouchableOpacity
                key={String(opt.id)}
                style={[styles.sheetOption, isActive && styles.sheetOptionActive]}
                onPress={() => { onSelect(opt.id); setOpen(false); }}
              >
                {opt.icon && (
                  <View style={[styles.sheetOptionIcon, { backgroundColor: (opt.color ?? colors.pink[300]) + '22' }]}>
                    <Text style={{ fontSize: 20 }}>{opt.icon}</Text>
                  </View>
                )}
                <Text style={[styles.sheetOptionText, isActive && styles.sheetOptionTextActive]}>
                  {opt.label}
                </Text>
                {isActive && <Text style={styles.sheetCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheetModal>
    </View>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export default function TransactionForm() {
  const { colors, shadows, resolvedColorScheme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, shadows, resolvedColorScheme), [colors, shadows, resolvedColorScheme]);
  const router = useRouter();
  const params = useLocalSearchParams<{
    imageUri?: string | string[];
    imageHandoff?: string | string[];
    transactionId?: string | string[];
    isEdit?: string;
    transactionDate?: string;
  }>();

  const paramImageUriRaw = params.imageUri;
  const paramImageUri = Array.isArray(paramImageUriRaw)
    ? paramImageUriRaw[0] ?? null
    : paramImageUriRaw ?? null;

  const [handoff] = useState(() => consumePendingReceiptImage());

  const imageUri = handoff?.uri ?? paramImageUri;
  const rawTransactionId = params.transactionId;
  const transactionIdParam: string | undefined =
    typeof rawTransactionId === 'string'
      ? rawTransactionId
      : Array.isArray(rawTransactionId)
        ? rawTransactionId[0]
        : undefined;
  const transactionId: EntityId | null =
    transactionIdParam && transactionIdParam.trim() ? transactionIdParam.trim() : null;
  const isEdit = (Array.isArray(params.isEdit) ? params.isEdit[0] : params.isEdit) === 'true';
  const initialDateParam = Array.isArray(params.transactionDate)
    ? params.transactionDate[0]
    : params.transactionDate;
  const initialDate = initialDateParam?.slice(0, 10) ?? formatLocalDate(new Date());

  type FormMode = 'create-complete' | 'edit-complete';
  const formMode: FormMode =
    isEdit && transactionId ? 'edit-complete' : 'create-complete';

  const [formData, setFormData] = useState<FinanceTransactionInput>({
    amount: '',
    type: 'chi',
    category_id: null,
    source_id: null,
    expense_audience: DEFAULT_EXPENSE_AUDIENCE,
    image_uri: imageUri,
    location: '',
    note: '',
    transaction_date: initialDate,
  });

  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [sources, setSources] = useState<FinanceSource[]>([]);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [systemKeyboardVisible, setSystemKeyboardVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const noteRef = useRef<TextInput>(null);
  const hasAutoScanned = useRef(false);
  const scanGenerationRef = useRef(0);
  // Ref luôn giữ bản categories mới nhất — tránh stale closure khi AI scan async
  const categoriesRef = useRef<FinanceCategory[]>([]);

  const { analyze, isLoading: isAiLoading } = useGemini();

  // Tải danh mục chi tiêu theo tần suất dùng; auto-chọn đầu danh sách nếu tạo mới
  useEffect(() => {
    listExpenseCategoriesByUsage().then((cats) => {
      categoriesRef.current = cats;
      setCategories(cats);
      if (formMode === 'create-complete') {
        setFormData((p) => ({
          ...p,
          category_id: p.category_id ?? (cats[0]?.id ?? null),
        }));
      }
    }).catch((err) => {
      Alert.alert('Không tải được danh mục', userMessageForDataError(err, 'categories'));
    });
  }, [formMode]);

  // Tải nguồn chi — tạo mới: active + last-selected nếu còn active
  useEffect(() => {
    listSources().then(async (srcs) => {
      setSources(srcs);
      setSourcesLoaded(true);
      if (formMode !== 'create-complete') return;
      const lastId = await getLastSelectedSourceId();
      setFormData((p) => {
        if (p.source_id !== null) return p;
        const nextId = resolveCreateSourceId(pickerSources(srcs, 'create', null), lastId);
        return nextId != null ? { ...p, source_id: nextId } : p;
      });
    }).catch((err) => {
      setSourcesLoaded(true);
      Alert.alert('Không tải được nguồn chi', userMessageForDataError(err, 'sources'));
    });
  }, [formMode]);

  // Load existing transaction when editing
  useEffect(() => {
    if (formMode === 'create-complete' || !transactionId) return;
    getTransactionById(transactionId).then((txn) => {
      if (!txn) {
        Alert.alert('Không tìm thấy giao dịch', 'Giao dịch này có thể đã bị xoá.');
        return;
      }
      setFormData({
        amount: String(txn.amount),
        type: txn.type,
        category_id: txn.category_id,
        source_id: txn.source_id,
        expense_audience: txn.expense_audience ?? 'unspecified',
        image_uri: txn.image_uri,
        note: txn.note?.trim() || txn.location?.trim() || '',
        location: '',
        transaction_date: txn.transaction_date,
      });
    }).catch((err) => {
      Alert.alert('Không tải được giao dịch', userMessageForDataError(err, 'transactions'));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formMode, transactionId]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setSystemKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setSystemKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ── Web helper kept only for preprocess dependency injection path ──
  const blobUriToBase64 = useCallback(async (uri: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(',')[1] ?? '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  const findCategoryByName = useCallback((cats: FinanceCategory[], categoryName: string) => {
    return cats.find((c) =>
      c.name.toLowerCase().includes(categoryName.toLowerCase()) ||
      categoryName.toLowerCase().includes(c.name.toLowerCase())
    );
  }, []);

  const applyScanResult = useCallback(async (
    result: Awaited<ReturnType<typeof analyze>>,
    scanGeneration: number,
  ) => {
    if (scanGeneration !== scanGenerationRef.current) return;

    const summary = result.description || result.note || '';

    const cats = await listExpenseCategoriesByUsage();
    if (scanGeneration !== scanGenerationRef.current) return;
    categoriesRef.current = cats;
    setCategories(cats);

    let categoryId: EntityId | null = cats[0]?.id ?? null;
    if (result.category) {
      const matched = findCategoryByName(cats, result.category);
      if (matched) categoryId = matched.id;
    }

    if (result.is_receipt === false) {
      setFormData((prev) => ({
        ...prev,
        note: summary || prev.note,
        location: '',
        type: 'chi',
        category_id: categoryId,
      }));
      Alert.alert(
        'Nhận diện món/sản phẩm ✨',
        (summary ? `🍽️ ${summary}` : 'Đã phân tích ảnh.') + '\n\nNhập số tiền thủ công nhé!',
      );
      return;
    }

    setFormData((prev) => ({
      ...prev,
      amount: result.amount && result.amount > 0 ? String(result.amount) : prev.amount,
      note: summary || prev.note,
      location: '',
      type: 'chi',
      category_id: categoryId,
    }));
    const lines: string[] = [];
    if (result.amount && result.amount > 0) lines.push(`💰 ${result.amount.toLocaleString('vi-VN')}đ`);
    if (summary) lines.push(`📝 ${summary}`);
    Alert.alert('Quét hoá đơn xong! ✨', lines.join('\n') || 'Kiểm tra lại và sửa nếu cần nhé!');
  }, [findCategoryByName]);

  // ── AI scan ──
  const handleAiScan = useCallback(async () => {
    if (!RECEIPT_SCAN_ENABLED) return;
    if (!imageUri) { Alert.alert('Chưa có ảnh', 'Hãy chụp hoặc chọn ảnh trước!'); return; }
    const scanGeneration = ++scanGenerationRef.current;
    const totalStarted = Date.now();
    try {
      const prepared = await preprocessReceiptImage(imageUri, {
        blobToBase64: blobUriToBase64,
      });
      const aiStarted = Date.now();
      const result = await analyze(prepared.base64);
      const aiMs = Date.now() - aiStarted;
      await applyScanResult(result, scanGeneration);
      receiptAiDevLog('scan_ok', {
        aiMs,
        totalMs: Date.now() - totalStarted,
      });
    } catch (err) {
      if (scanGeneration !== scanGenerationRef.current) return;
      receiptAiDevLog('scan_fail', {
        totalMs: Date.now() - totalStarted,
        ...sanitizeErrorCategory(err),
      });
      const isImageErr =
        err instanceof ReceiptAiError &&
        (err.kind === 'image_load_failed' ||
          err.kind === 'image_decode_failed' ||
          err.kind === 'image_processing_failed');
      const msg = err instanceof Error ? err.message : 'Không thể phân tích ảnh.';
      Alert.alert(
        isImageErr ? 'Lỗi ảnh 📷' : 'Lỗi AI 🤖',
        `${msg}\n\nBạn vẫn có thể nhập tay.`,
      );
    }
  }, [imageUri, analyze, blobUriToBase64, applyScanResult]);

  // Tự quét khi mở form với ảnh mới (không phải chỉnh sửa)
  useEffect(() => {
    if (!RECEIPT_SCAN_ENABLED) return;
    if (!imageUri || formMode !== 'create-complete' || hasAutoScanned.current) return;
    hasAutoScanned.current = true;
    handleAiScan();
  }, [imageUri, formMode, handleAiScan]);

  // ── Validation + Save (3 modes) ─────────────────────────────────────────
  const validateCompleteTransaction = (): boolean => {
    const amountNum = parseInt(formData.amount.replace(/\D/g, ''), 10) || 0;
    if (amountNum <= 0) {
      Alert.alert('Thiếu số tiền', 'Nhập số tiền trước nhé! 💰');
      return false;
    }
    if (formData.category_id === null) {
      Alert.alert('Thiếu danh mục', 'Chọn danh mục trước nhé! 🏷️');
      return false;
    }
    if (formData.source_id === null) {
      Alert.alert('Thiếu nguồn chi', 'Chọn nguồn chi trước nhé! 💳');
      return false;
    }
    if (!formData.transaction_date) {
      Alert.alert('Thiếu ngày', 'Chọn ngày giao dịch trước nhé! 📅');
      return false;
    }
    const today = formatLocalDate(new Date());
    if (formData.transaction_date > today) {
      Alert.alert('Ngày giao dịch không được ở tương lai.');
      return false;
    }
    return true;
  };

  const handlePrimarySave = useCallback(async () => {
    if (isSaving) return;
    if (!validateCompleteTransaction()) return;

    setIsSaving(true);
    try {
      if (formMode === 'create-complete') {
        await insertTransaction(formData);
        if (formData.source_id != null) {
          await setLastSelectedSourceId(formData.source_id);
        }
        router.dismissAll();
        return;
      }

      if (!transactionId) return;
      await updateTransaction(transactionId, formData);
      if (formData.source_id != null) {
        await setLastSelectedSourceId(formData.source_id);
      }
      router.dismissAll();
    } catch (err) {
      Alert.alert('Không lưu được', userMessageForDataError(err, 'transactions'));
    } finally {
      setIsSaving(false);
    }
  }, [formMode, transactionId, formData, router, isSaving]);

  const primaryButtonLabel = formMode === 'create-complete'
    ? 'Lưu giao dịch 🍓'
    : 'Cập nhật giao dịch ✏️';

  const displayAmount = formatAmount(formData.amount);
  const isDark = resolvedColorScheme === 'dark';
  const accentColor = colors.pink[400];
  const maxDate = new Date();
  const isBackdated = formData.transaction_date !== formatLocalDate(new Date());
  const { bottom: screenBottomInset } = useSafeAreaInsets();
  const footerBottomPad = Math.max(useModalBottomInset(), Spacing.base);

  const handleDateChange = useCallback((event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'dismissed' || !date) return;
    setFormData((p) => ({ ...p, transaction_date: formatLocalDate(date) }));
  }, []);

  const categoryOptions: PickerOption[] = categories.map((c) => ({
    id: c.id, label: c.name, icon: c.icon, color: c.color,
  }));

  const sourceOptions: PickerOption[] = pickerSources(
    sources,
    formMode === 'edit-complete' ? 'edit' : 'create',
    formData.source_id,
  ).map((s) => ({
    id: s.id,
    label: s.name,
    icon: '💳',
  }));

  const showNoSourcesHint =
    sourcesLoaded &&
    formMode === 'create-complete' &&
    sources.filter(isSourceActive).length === 0;

  const audienceOptions: PickerOption[] = [
    ...EXPENSE_AUDIENCE_CHOICES.map((key) => ({
      id: key,
      label: EXPENSE_AUDIENCE_LABELS[key],
      icon: AUDIENCE_ICONS[key],
    })),
    ...(formData.expense_audience === 'unspecified'
      ? [{ id: 'unspecified' as const, label: EXPENSE_AUDIENCE_LABELS.unspecified, icon: '❔' }]
      : []),
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
      >

        {/* ═══ TOP: IMAGE BG + AMOUNT OVERLAY ═══ */}
        <View style={[
          styles.topSection,
          { backgroundColor: isDark ? colors.pink[100] : colors.pink[400] },
        ]}>
          {/* Background image or gradient */}
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.bgImage} blurRadius={18} />
          ) : null}
          <View style={[
            styles.bgOverlay,
            {
              backgroundColor: isDark ? 'rgba(36, 25, 34, 0.42)' : 'rgba(244,132,168,0.52)',
            },
          ]} />

          {/* Close + Quét lại */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            {imageUri && RECEIPT_SCAN_ENABLED ? (
              <TouchableOpacity
                style={[styles.aiBtn, isAiLoading && styles.aiBtnLoading]}
                onPress={handleAiScan}
                disabled={isAiLoading || isSaving}
              >
                {isAiLoading
                  ? <ActivityIndicator size="small" color={isDark ? colors.neutral[700] : '#fff'} />
                  : <Text style={styles.aiBtnText}>✨ Quét</Text>}
              </TouchableOpacity>
            ) : <View style={{ width: 34 }} />}
          </View>

          {RECEIPT_SCAN_ENABLED && isAiLoading ? (
            <Text style={styles.aiLoadingHint}>Đang đọc bill...</Text>
          ) : null}

          {/* Amount */}
          <View style={styles.amountWrap}>
            <Text style={[styles.amountSign, styles.amountAccent]}>
              -
            </Text>
            <Text style={[
              styles.amountValue,
              !formData.amount && styles.amountEmpty,
              formData.amount ? styles.amountAccent : null,
            ]}>
              {displayAmount || '0'}
            </Text>
            <Text style={[styles.amountUnit, styles.amountAccent]}>đ</Text>
          </View>

          {/* Mô tả — nằm cao trên màn hình để không bị bàn phím che */}
          <View style={styles.noteInputWrap}>
            <Text style={styles.noteInputIcon}>✏️</Text>
            <TextInput
              ref={noteRef}
              style={styles.noteInput}
              value={formData.note}
              onChangeText={(t) => setFormData((p) => ({ ...p, note: t, location: '' }))}
              placeholder="Thêm mô tả..."
              placeholderTextColor={isDark ? colors.neutral[400] : 'rgba(255,255,255,0.55)'}
              multiline
              numberOfLines={2}
              maxLength={200}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>
        </View>

        {/* ═══ FORM BODY ═══ */}
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {/* Hàng 1: Danh mục | Chi cho ai */}
          <View style={styles.pillRow}>
            <View style={styles.pillFlex}>
              <DropdownPicker
                value={formData.category_id}
                label="Danh mục"
                options={categoryOptions}
                onSelect={(id) => setFormData((p) => ({ ...p, category_id: id }))}
                accentColor={accentColor}
              />
            </View>
            <View style={styles.pillFlex}>
              <DropdownPicker
                value={formData.expense_audience}
                label="Chi cho ai"
                options={audienceOptions}
                onSelect={(id) =>
                  setFormData((p) => ({ ...p, expense_audience: id as ExpenseAudience }))
                }
                accentColor={accentColor}
              />
            </View>
          </View>

          {showNoSourcesHint ? (
            <View style={styles.noSourceBox}>
              <Text style={styles.noSourceText}>
                Bạn chưa có nguồn chi nào. Hãy tạo nguồn chi trong Cài đặt trước khi lưu giao dịch.
              </Text>
              <TouchableOpacity
                style={styles.noSourceBtn}
                onPress={() => router.push('/settings')}
                activeOpacity={0.85}
              >
                <Text style={styles.noSourceBtnText}>Mở Cài đặt</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Hàng 2: Nguồn chi | Ngày giao dịch */}
          <View style={styles.pillRow}>
            <View style={styles.pillFlex}>
              <DropdownPicker
                value={formData.source_id}
                label="Nguồn chi"
                options={sourceOptions}
                onSelect={(id) => setFormData((p) => ({ ...p, source_id: id }))}
                accentColor={accentColor}
              />
            </View>
            <View style={styles.pillFlex}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Ngày giao dịch</Text>
                <TouchableOpacity
                  style={[
                    styles.pill,
                    isBackdated && styles.datePillBackdated,
                    showDatePicker && styles.pillSelected,
                  ]}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pillIcon}>📅</Text>
                  <Text
                    style={[styles.pillText, isBackdated && styles.datePillTextBackdated]}
                    numberOfLines={1}
                  >
                    {formatDateVi(formData.transaction_date)}
                  </Text>
                  <Text style={styles.pillChevron}>▾</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Bàn phím số + CTA — padding đáy theo safe area, không dính navbar */}
        <View style={[styles.formFooter, { paddingBottom: footerBottomPad }]}>
          {!systemKeyboardVisible && (
            <View style={styles.keypadSection}>
              <AmountKeyboard
                value={formData.amount}
                onChange={(val) => setFormData((p) => ({ ...p, amount: val }))}
              />
            </View>
          )}

          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
              onPress={handlePrimarySave}
              disabled={isSaving}
              activeOpacity={0.85}
            >
            {isSaving
              ? <ActivityIndicator size="small" color={colors.action.primaryText} />
              : <Text style={styles.saveBtnText}>{primaryButtonLabel}</Text>
            }
            </TouchableOpacity>
          </View>
        </View>

        {/* Chọn ngày giao dịch */}
        {showDatePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={parseLocalDate(formData.transaction_date)}
            mode="date"
            maximumDate={maxDate}
            onChange={handleDateChange}
          />
        )}

        {Platform.OS === 'ios' && (
          <BottomSheetModal visible={showDatePicker} onClose={() => setShowDatePicker(false)}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Chọn ngày giao dịch</Text>
              <DateTimePicker
                value={parseLocalDate(formData.transaction_date)}
                mode="date"
                display="spinner"
                maximumDate={maxDate}
                locale="vi-VN"
                onChange={handleDateChange}
              />
              <TouchableOpacity
                style={[styles.doneBtn, { marginHorizontal: Spacing.base }]}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.doneBtnText}>Xong ✓</Text>
              </TouchableOpacity>
          </BottomSheetModal>
        )}

        {showDatePicker && Platform.OS === 'web' && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
            <TouchableOpacity style={styles.backdrop} onPress={() => setShowDatePicker(false)} activeOpacity={1} />
            <View style={[styles.dateSheetWeb, { marginBottom: screenBottomInset }]}>
              <Text style={styles.sheetTitle}>Chọn ngày giao dịch</Text>
              {/* @ts-ignore — input web */}
              <input
                type="date"
                title="Chọn ngày giao dịch"
                aria-label="Chọn ngày giao dịch"
                value={formData.transaction_date}
                max={formatLocalDate(maxDate)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  if (e.target.value) {
                    setFormData((p) => ({ ...p, transaction_date: e.target.value }));
                  }
                  setShowDatePicker(false);
                }}
              />
            </View>
          </Modal>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(
  colors: ThemeColors,
  shadows: ThemeShadows,
  scheme: 'light' | 'dark',
) {
  const isDark = scheme === 'dark';
  return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.primary },
  container: { flex: 1 },
  webDateInput: {
    fontSize: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ui.fieldBorder,
    width: '100%',
  },

  // ── Top image section ──
  topSection: {
    minHeight: 200,
    overflow: 'hidden',
    backgroundColor: colors.pink[400],
    justifyContent: 'space-between',
  },
  bgImage: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bgOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: isDark ? colors.background.surface : 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: isDark ? colors.neutral[700] : '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  aiBtn: {
    width: 60,
    height: 30,
    borderRadius: BorderRadius.full,
    backgroundColor: isDark ? colors.background.surface : 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: isDark ? colors.ui.fieldBorder : 'rgba(255,255,255,0.3)',
  },
  aiBtnLoading: {
    backgroundColor: isDark ? colors.background.card : 'rgba(255,255,255,0.15)',
  },
  aiBtnText: {
    color: isDark ? colors.neutral[700] : '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  aiLoadingHint: {
    textAlign: 'center',
    fontSize: Typography.fontSize.sm,
    color: colors.neutral[500],
    marginBottom: Spacing.sm,
  },

  amountWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
    paddingBottom: Spacing.sm,
  },
  amountSign: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '700',
    color: isDark ? colors.pink[400] : 'rgba(255,255,255,0.85)',
  },
  amountValue: {
    fontSize: 46,
    fontWeight: '800',
    color: isDark ? colors.pink[400] : '#FFFFFF',
    letterSpacing: -1,
  },
  amountEmpty: {
    color: isDark ? colors.neutral[400] : 'rgba(255,255,255,0.45)',
  },
  amountUnit: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '700',
    color: isDark ? colors.pink[400] : 'rgba(255,255,255,0.8)',
  },
  amountAccent: {
    color: isDark ? colors.pink[400] : '#FFFFFF',
  },

  noteInputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
  },
  noteInputIcon: { fontSize: 14, marginTop: 4 },
  noteInput: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: isDark ? colors.neutral[600] : '#FFFFFF',
    fontWeight: '500',
    paddingVertical: 4,
    minHeight: 36,
    maxHeight: 56,
    textAlignVertical: 'top',
  },

  // ── Body ──
  body: { flex: 1 },
  bodyContent: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },

  // Pill rows
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  pillFlex: { flex: 1, minWidth: 0 },
  noSourceBox: {
    backgroundColor: colors.pink[50],
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: colors.pink[100],
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  noSourceText: {
    fontSize: Typography.fontSize.sm,
    color: colors.neutral[600],
    lineHeight: 20,
  },
  noSourceBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.action.secondaryBackground,
    borderWidth: 1,
    borderColor: colors.action.secondaryBorder,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  noSourceBtnText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: colors.action.secondaryText,
  },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    backgroundColor: colors.background.surface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.ui.fieldBorder,
  },
  pillSelected: {
    borderColor: colors.action.selectedBorder,
    backgroundColor: colors.action.selectedBackground,
  },
  datePillBackdated: {
    borderColor: colors.lavender[300],
    backgroundColor: colors.lavender[50],
  },
  datePillTextBackdated: {
    color: colors.lavender[400],
    fontWeight: '700',
  },
  dateSheetWeb: {
    backgroundColor: colors.background.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginHorizontal: Spacing['2xl'],
    alignSelf: 'center',
    width: '100%',
    maxWidth: 320,
  },
  pillIcon: { fontSize: 16 },
  pillText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  pillPlaceholder: { color: colors.neutral[400] },
  pillChevron: {
    fontSize: 11,
    color: colors.neutral[400],
    marginLeft: 2,
  },

  // Keypad — luôn hiển thị (trừ khi bàn phím hệ thống mở)
  formFooter: {
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  keypadSection: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    backgroundColor: colors.background.primary,
  },
  doneBtn: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    backgroundColor: colors.action.primaryBackground,
  },
  doneBtnText: {
    color: colors.action.primaryText,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },

  // Save
  bottomBar: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    paddingTop: Spacing.sm,
    backgroundColor: colors.background.primary,
  },
  saveBtn: {
    alignSelf: 'stretch',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.xl,
    backgroundColor: colors.action.primaryBackground,
    ...shadows.medium,
  },
  saveBtnText: {
    color: colors.action.primaryText,
    fontSize: Typography.fontSize.md,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Bottom sheet (nội dung bên trong BottomSheetModal)
  backdrop: {
    flex: 1,
    backgroundColor: colors.background.overlay,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
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
  sheetScroll: { paddingHorizontal: Spacing.base },
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
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
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
});
}
