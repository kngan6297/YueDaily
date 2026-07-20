import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { AmountKeyboard, formatAmount } from '../components/form/AmountKeyboard';
import { BottomSheetModal } from '../components/ui/BottomSheetModal';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../constants/theme';
import { getAllPayers, getAllSources, getCategoriesByType, updateStreak } from '../database/categories';
import {
  getTransactionById,
  insertTransaction,
  updateTransaction,
} from '../database/transactions';
import { useGemini } from '../hooks/useGemini';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Category, Payer, PayerRecord, Source, TransactionFormData, TransactionType } from '../types';
import {
  dateFromCreatedAt,
  formatDateVi,
  formatLocalDate,
  parseLocalDate,
} from '../utils/date';

// ─── Dropdown Picker ──────────────────────────────────────────────────────────

interface PickerOption {
  id: number | string;
  label: string;
  icon?: string;
  color?: string;
}

interface DropdownPickerProps {
  value: number | string | null;
  placeholder: string;
  options: PickerOption[];
  onSelect: (id: number | string) => void;
  accentColor?: string;
}

function DropdownPicker({ value, placeholder, options, onSelect, accentColor }: DropdownPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <>
      <TouchableOpacity
        style={[styles.pill, selected && { borderColor: selected.color ?? accentColor ?? Colors.pink[300] }]}
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
          <Text style={styles.sheetTitle}>{placeholder}</Text>
          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            {options.map((opt) => {
              const isActive = opt.id === value;
              return (
                <TouchableOpacity
                  key={String(opt.id)}
                  style={[styles.sheetOption, isActive && styles.sheetOptionActive]}
                  onPress={() => { onSelect(opt.id); setOpen(false); }}
                >
                  {opt.icon && (
                    <View style={[styles.sheetOptionIcon, { backgroundColor: (opt.color ?? Colors.pink[300]) + '22' }]}>
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
    </>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export default function TransactionForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    imageUri?: string;
    transactionId?: string;
    isEdit?: string;
    transactionDate?: string;
  }>();

  const imageUri = params.imageUri ?? null;
  const transactionId = params.transactionId ? parseInt(params.transactionId, 10) : null;
  const isEdit = params.isEdit === 'true';
  const initialDate = params.transactionDate?.slice(0, 10) ?? formatLocalDate(new Date());

  type FormMode = 'create-complete' | 'edit-complete';
  const formMode: FormMode =
    isEdit && transactionId ? 'edit-complete' : 'create-complete';

  const [formData, setFormData] = useState<TransactionFormData>({
    amount: '',
    type: 'chi',
    category_id: null,
    source_id: null,
    payer: 'Vợ',
    image_uri: imageUri,
    location: '',
    note: '',
    transaction_date: initialDate,
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [payers, setPayers] = useState<PayerRecord[]>([]);
  const [systemKeyboardVisible, setSystemKeyboardVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const noteRef = useRef<TextInput>(null);
  const hasAutoScanned = useRef(false);
  // Ref luôn giữ bản categories mới nhất — tránh stale closure khi AI scan async
  const categoriesRef = useRef<Category[]>([]);

  const { analyze, isLoading: isAiLoading } = useGemini();

  // Tải danh mục theo loại, auto-chọn danh mục đầu tiên nếu chưa có
  useEffect(() => {
    getCategoriesByType(formData.type).then((cats) => {
      categoriesRef.current = cats;
      setCategories(cats);
      if (formMode === 'create-complete') {
        setFormData((p) => ({
          ...p,
          category_id: p.category_id ?? (cats[0]?.id ?? null),
        }));
      }
    }).catch(console.error);
  }, [formData.type, formMode]);

  // Tải nguồn tiền và người trả
  useEffect(() => {
    getAllSources().then((srcs) => {
      setSources(srcs);
      if (formMode === 'create-complete') {
        setFormData((p) => {
          if (p.source_id !== null) return p;
          const defaultSrc = srcs.find((s) => s.name === 'Chuyển khoản') ?? srcs[0];
          return defaultSrc ? { ...p, source_id: defaultSrc.id } : p;
        });
      }
    }).catch(console.error);

    getAllPayers().then((pays) => {
      setPayers(pays);
      if (formMode === 'create-complete' && pays.length > 0) {
        setFormData((p) => (p.payer ? p : { ...p, payer: pays[0].name }));
      }
    }).catch(console.error);
  }, [formMode]);

  // Load existing transaction when editing
  useEffect(() => {
    if (formMode === 'create-complete' || !transactionId) return;
    getTransactionById(transactionId).then((txn) => {
      if (!txn) return;
      setFormData({
        amount: String(txn.amount),
        type: txn.type,
        category_id: txn.category_id,
        source_id: txn.source_id,
        payer: txn.payer,
        image_uri: txn.image_uri,
        note: txn.note?.trim() || txn.location?.trim() || '',
        location: '',
        transaction_date: dateFromCreatedAt(txn.created_at),
      });
    }).catch(console.error);
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

  // ── Web helper: blob URL → base64 ──
  const blobUriToBase64 = useCallback(async (uri: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        // strip "data:image/...;base64," prefix
        resolve(dataUrl.split(',')[1] ?? '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  const imageToBase64 = useCallback(async (uri: string): Promise<string> => {
    if (Platform.OS === 'web') {
      return blobUriToBase64(uri);
    }
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    return compressed.base64 ?? '';
  }, [blobUriToBase64]);

  const findCategoryByName = useCallback((cats: Category[], categoryName: string) => {
    return cats.find((c) =>
      c.name.toLowerCase().includes(categoryName.toLowerCase()) ||
      categoryName.toLowerCase().includes(c.name.toLowerCase())
    );
  }, []);

  const applyScanResult = useCallback(async (result: Awaited<ReturnType<typeof analyze>>) => {
    const summary = result.description || result.note || '';
    const resultType: TransactionType = result.type === 'thu' ? 'thu' : 'chi';

    const cats = await getCategoriesByType(resultType);
    categoriesRef.current = cats;
    setCategories(cats);

    let categoryId: number | null = cats[0]?.id ?? null;
    if (result.category) {
      const matched = findCategoryByName(cats, result.category);
      if (matched) categoryId = matched.id;
    }

    if (result.is_receipt === false) {
      setFormData((prev) => ({
        ...prev,
        note: summary || prev.note,
        location: '',
        type: resultType,
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
      type: resultType,
      category_id: categoryId,
    }));
    const lines: string[] = [];
    if (result.amount && result.amount > 0) lines.push(`💰 ${result.amount.toLocaleString('vi-VN')}đ`);
    if (summary) lines.push(`📝 ${summary}`);
    Alert.alert('Quét hoá đơn xong! ✨', lines.join('\n') || 'Kiểm tra lại và sửa nếu cần nhé!');
  }, [findCategoryByName]);

  // ── AI scan ──
  const handleAiScan = useCallback(async () => {
    if (!imageUri) { Alert.alert('Chưa có ảnh', 'Hãy chụp hoặc chọn ảnh trước!'); return; }
    try {
      const base64 = await imageToBase64(imageUri);
      const result = await analyze(base64);
      await applyScanResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể phân tích ảnh.';
      Alert.alert(
        'Lỗi AI 🤖',
        `${msg}\n\nBạn vẫn có thể nhập tay.`
      );
    }
  }, [imageUri, analyze, imageToBase64, applyScanResult]);

  // Tự quét khi mở form với ảnh mới (không phải chỉnh sửa)
  useEffect(() => {
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
      Alert.alert('Thiếu nguồn tiền', 'Chọn nguồn tiền trước nhé! 💳');
      return false;
    }
    if (!formData.payer || !formData.payer.trim()) {
      Alert.alert('Thiếu người trả', 'Chọn người trả trước nhé! 👤');
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
    setIsSaving(true);
    try {
      if (formMode === 'create-complete') {
        if (!validateCompleteTransaction()) return;
        await insertTransaction(formData);
        await updateStreak();
        router.dismissAll();
        return;
      }

      if (!transactionId) return;
      if (!validateCompleteTransaction()) return;
      await updateTransaction(transactionId, formData);
      await updateStreak();
      router.dismissAll();
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu. Thử lại nhé!');
    } finally {
      setIsSaving(false);
    }
  }, [formMode, transactionId, formData, router, isSaving]);

  const primaryButtonLabel = formMode === 'create-complete'
    ? 'Lưu giao dịch 🍓'
    : 'Cập nhật giao dịch ✏️';

  const displayAmount = formatAmount(formData.amount);
  const isChi = formData.type === 'chi';
  const accentColor = isChi ? Colors.pink[400] : Colors.mint[400];
  const maxDate = new Date();
  const isBackdated = formData.transaction_date !== formatLocalDate(new Date());
  const { bottom: screenBottomInset } = useSafeAreaInsets();

  const handleDateChange = useCallback((event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'dismissed' || !date) return;
    setFormData((p) => ({ ...p, transaction_date: formatLocalDate(date) }));
  }, []);

  const categoryOptions: PickerOption[] = categories.map((c) => ({
    id: c.id, label: c.name, icon: c.icon, color: c.color,
  }));

  const payerOptions: PickerOption[] = payers.map((p) => ({
    id: p.name,
    label: p.name,
    icon: p.icon,
    color: p.color,
  }));

  const sourceOptions: PickerOption[] = sources.map((s) => ({
    id: s.id,
    label: s.name,
    icon: s.name === 'Tiền mặt' ? '💵' : s.name === 'Chuyển khoản' ? '🏦' : '💳',
  }));

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
      >

        {/* ═══ TOP: IMAGE BG + AMOUNT OVERLAY ═══ */}
        <View style={styles.topSection}>
          {/* Background image or gradient */}
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.bgImage} blurRadius={18} />
          ) : null}
          <View style={[styles.bgOverlay, { backgroundColor: isChi ? 'rgba(255,100,130,0.55)' : 'rgba(70,190,150,0.55)' }]} />

          {/* Close + Type toggle */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[styles.typeBtn, !isChi && styles.typeBtnActive]}
                onPress={() => setFormData((p) => ({ ...p, type: 'thu', category_id: null }))}
              >
                <Text style={[styles.typeBtnText, !isChi && styles.typeBtnTextActive]}>Thu</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, isChi && styles.typeBtnActive]}
                onPress={() => setFormData((p) => ({ ...p, type: 'chi', category_id: null }))}
              >
                <Text style={[styles.typeBtnText, isChi && styles.typeBtnTextActive]}>Chi</Text>
              </TouchableOpacity>
            </View>

            {/* Quét lại */}
            {imageUri ? (
              <TouchableOpacity
                style={[styles.aiBtn, isAiLoading && styles.aiBtnLoading]}
                onPress={handleAiScan}
                disabled={isAiLoading}
              >
                {isAiLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.aiBtnText}>✨ Quét</Text>}
              </TouchableOpacity>
            ) : <View style={{ width: 60 }} />}
          </View>

          {/* Amount */}
          <View style={styles.amountWrap}>
            <Text style={styles.amountSign}>{isChi ? '-' : '+'}</Text>
            <Text style={[styles.amountValue, !formData.amount && styles.amountEmpty]}>
              {displayAmount || '0'}
            </Text>
            <Text style={styles.amountUnit}>đ</Text>
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
              placeholderTextColor="rgba(255,255,255,0.55)"
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
          {/* Dropdown row 1: Category + Payer */}
          <View style={styles.pillRow}>
            <View style={styles.pillFlex}>
              <DropdownPicker
                value={formData.category_id}
                placeholder="Danh mục"
                options={categoryOptions}
                onSelect={(id) => setFormData((p) => ({ ...p, category_id: id as number }))}
                accentColor={accentColor}
              />
            </View>
            <View style={styles.pillFlex}>
              <DropdownPicker
                value={formData.payer}
                placeholder="Ai trả"
                options={payerOptions}
                onSelect={(id) => setFormData((p) => ({ ...p, payer: id as Payer }))}
                accentColor={accentColor}
              />
            </View>
          </View>

          {/* Dropdown row 2: Source + Date */}
          <View style={styles.pillRow}>
            <View style={styles.pillFlex}>
              <DropdownPicker
                value={formData.source_id}
                placeholder="Nguồn tiền"
                options={sourceOptions}
                onSelect={(id) => setFormData((p) => ({ ...p, source_id: id as number }))}
                accentColor={accentColor}
              />
            </View>
            <TouchableOpacity
              style={[styles.pill, styles.datePill, isBackdated && styles.datePillBackdated]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.pillIcon}>📅</Text>
              <Text style={[styles.pillText, isBackdated && styles.datePillTextBackdated]} numberOfLines={1}>
                {formatDateVi(formData.transaction_date)}
              </Text>
              <Text style={styles.pillChevron}>▾</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bàn phím số luôn hiển thị; tạm ẩn khi gõ mô tả để nhường chỗ bàn phím hệ thống */}
        {!systemKeyboardVisible && (
          <View style={styles.keypadSection}>
            <AmountKeyboard
              value={formData.amount}
              onChange={(val) => setFormData((p) => ({ ...p, amount: val }))}
            />
          </View>
        )}

        {/* ═══ SAVE BUTTON ═══ */}
        <View style={[styles.bottomBar, { paddingBottom: Spacing.base + screenBottomInset }]}>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: accentColor }, isSaving && { opacity: 0.6 }]}
            onPress={handlePrimarySave}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            {isSaving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.saveBtnText}>{primaryButtonLabel}</Text>
            }
          </TouchableOpacity>
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
                style={[styles.doneBtn, { backgroundColor: accentColor, marginHorizontal: Spacing.base }]}
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background.primary },
  container: { flex: 1 },
  webDateInput: {
    fontSize: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    width: '100%',
  },

  // ── Top image section ──
  topSection: {
    minHeight: 200,
    overflow: 'hidden',
    backgroundColor: Colors.pink[400],
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
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: BorderRadius.full,
    padding: 3,
    gap: 2,
  },
  typeBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  typeBtnActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  typeBtnText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  typeBtnTextActive: { color: '#fff' },
  aiBtn: {
    width: 60,
    height: 30,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  aiBtnLoading: { backgroundColor: 'rgba(255,255,255,0.15)' },
  aiBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

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
    color: 'rgba(255,255,255,0.85)',
  },
  amountValue: {
    fontSize: 46,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  amountEmpty: { color: 'rgba(255,255,255,0.45)' },
  amountUnit: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
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
    color: '#FFFFFF',
    fontWeight: '500',
    paddingVertical: 4,
    minHeight: 36,
    maxHeight: 56,
    textAlignVertical: 'top',
  },

  // ── Body ──
  body: { flex: 1 },
  bodyContent: {
    padding: Spacing.base,
    gap: Spacing.md,
  },

  // Pill rows
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  pillFlex: { flex: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background.surface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    ...Shadows.soft,
  },
  datePill: {
    flex: 1,
    borderColor: Colors.neutral[200],
  },
  datePillBackdated: {
    borderColor: Colors.pink[300],
    backgroundColor: Colors.pink[50],
  },
  datePillTextBackdated: {
    color: Colors.pink[500],
    fontWeight: '700',
  },
  dateSheetWeb: {
    backgroundColor: Colors.background.surface,
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
    color: Colors.neutral[700],
  },
  pillPlaceholder: { color: Colors.neutral[400] },
  pillChevron: {
    fontSize: 11,
    color: Colors.neutral[400],
    marginLeft: 2,
  },

  // Keypad — luôn hiển thị (trừ khi bàn phím hệ thống mở)
  keypadSection: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
  },
  doneBtn: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontSize: Typography.fontSize.base, fontWeight: '700' },

  // Save
  bottomBar: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
  },
  saveBtn: {
    alignSelf: 'stretch',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.xl,
    ...Shadows.medium,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.md,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Bottom sheet (nội dung bên trong BottomSheetModal)
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.neutral[300],
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: Colors.neutral[600],
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },
  sheetScroll: { paddingHorizontal: Spacing.base },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
  },
  sheetOptionActive: { backgroundColor: Colors.pink[50] },
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
    color: Colors.neutral[700],
  },
  sheetOptionTextActive: { fontWeight: '700', color: Colors.pink[500] },
  sheetCheck: {
    fontSize: Typography.fontSize.base,
    color: Colors.pink[400],
    fontWeight: '800',
  },
});
