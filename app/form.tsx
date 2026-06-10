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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AmountKeyboard, formatAmount } from '../components/form/AmountKeyboard';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../constants/theme';
import { getAllSources, getCategoriesByType, updateStreak } from '../database/categories';
import { completePendingTransaction, getTransactionById, insertTransaction, updateTransaction } from '../database/transactions';
import { useGemini } from '../hooks/useGemini';
import type { Category, Payer, Source, TransactionFormData, TransactionType } from '../types';

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

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity style={styles.backdrop} onPress={() => setOpen(false)} activeOpacity={1} />
        <View style={styles.sheet}>
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
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export default function TransactionForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    imageUri?: string;
    transactionId?: string;
    isFromPending?: string;
    isEdit?: string;
  }>();

  const imageUri = params.imageUri ?? null;
  const transactionId = params.transactionId ? parseInt(params.transactionId, 10) : null;
  const isFromPending = params.isFromPending === 'true';
  const isEdit = params.isEdit === 'true';

  const [formData, setFormData] = useState<TransactionFormData>({
    amount: '',
    type: 'chi',
    category_id: null,
    source_id: null,
    payer: 'Vợ',
    image_uri: imageUri,
    location: '',
    note: '',
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [showKeyboard, setShowKeyboard] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const noteRef = useRef<TextInput>(null);
  const hasAutoScanned = useRef(false);

  const { analyze, isLoading: isAiLoading } = useGemini();

  useEffect(() => {
    getCategoriesByType(formData.type).then(setCategories).catch(console.error);
    getAllSources().then(setSources).catch(console.error);
  }, [formData.type]);

  // Load existing transaction when editing
  useEffect(() => {
    if (!isEdit || !transactionId) return;
    getTransactionById(transactionId).then((txn) => {
      if (!txn) return;
      setFormData({
        amount: String(txn.amount),
        type: txn.type,
        category_id: txn.category_id,
        source_id: txn.source_id,
        payer: txn.payer,
        image_uri: txn.image_uri,
        location: txn.location ?? '',
        note: txn.note ?? '',
      });
      setShowKeyboard(false);
    }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, transactionId]);

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

  const matchCategory = useCallback((categoryName: string) => {
    return categories.find((c) =>
      c.name.toLowerCase().includes(categoryName.toLowerCase()) ||
      categoryName.toLowerCase().includes(c.name.toLowerCase())
    );
  }, [categories]);

  const applyScanResult = useCallback((result: Awaited<ReturnType<typeof analyze>>) => {
    if (result.is_receipt === false) {
      setFormData((prev) => ({
        ...prev,
        location: result.location || prev.location,
        note: result.note || prev.note,
        type: (result.type as TransactionType) || prev.type,
      }));
      if (result.category) {
        const matched = matchCategory(result.category);
        if (matched) setFormData((prev) => ({ ...prev, category_id: matched.id }));
      }
      setShowKeyboard(true);
      const lines: string[] = [];
      if (result.note) lines.push(`🍽️ ${result.note}`);
      if (result.location) lines.push(`📍 ${result.location}`);
      Alert.alert(
        'Nhận diện món/sản phẩm ✨',
        (lines.join('\n') || 'Đã phân tích ảnh.') + '\n\nNhập số tiền thủ công nhé!',
      );
      return;
    }

    setFormData((prev) => ({
      ...prev,
      amount: result.amount && result.amount > 0 ? String(result.amount) : prev.amount,
      location: result.location || prev.location,
      note: result.note || prev.note,
      type: (result.type as TransactionType) || prev.type,
    }));
    if (result.category) {
      const matched = matchCategory(result.category);
      if (matched) setFormData((prev) => ({ ...prev, category_id: matched.id }));
    }
    setShowKeyboard(false);
    const lines: string[] = [];
    if (result.amount && result.amount > 0) lines.push(`💰 ${result.amount.toLocaleString('vi-VN')}đ`);
    if (result.location) lines.push(`📍 ${result.location}`);
    Alert.alert('Quét hoá đơn xong! ✨', lines.join('\n') || 'Kiểm tra lại và sửa nếu cần nhé!');
  }, [matchCategory]);

  // ── AI scan ──
  const handleAiScan = useCallback(async () => {
    if (!imageUri) { Alert.alert('Chưa có ảnh', 'Hãy chụp hoặc chọn ảnh trước!'); return; }
    try {
      const base64 = await imageToBase64(imageUri);
      const result = await analyze(base64);
      applyScanResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể phân tích ảnh.';
      Alert.alert('Lỗi AI 🤖', msg);
    }
  }, [imageUri, analyze, imageToBase64, applyScanResult]);

  // Tự quét khi mở form với ảnh mới (không phải chỉnh sửa)
  useEffect(() => {
    if (!imageUri || isEdit || hasAutoScanned.current) return;
    hasAutoScanned.current = true;
    handleAiScan();
  }, [imageUri, isEdit, handleAiScan]);

  // ── Save ──
  const handleSave = useCallback(async () => {
    if (!formData.amount || formData.amount === '0') {
      Alert.alert('Thiếu số tiền', 'Nhập số tiền trước nhé! 💰'); return;
    }
    setIsSaving(true);
    try {
      if (isEdit && transactionId) {
        await updateTransaction(transactionId, formData);
      } else if (isFromPending && transactionId) {
        await completePendingTransaction(transactionId, formData);
      } else {
        await insertTransaction(formData);
      }
      await updateStreak();
      router.dismissAll();
    } catch (err) {
      Alert.alert('Lỗi', 'Không thể lưu. Thử lại nhé!');
    } finally {
      setIsSaving(false);
    }
  }, [formData, isFromPending, transactionId, router]);

  const displayAmount = formatAmount(formData.amount);
  const isChi = formData.type === 'chi';
  const accentColor = isChi ? Colors.pink[400] : Colors.mint[400];

  const todayLabel = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const categoryOptions: PickerOption[] = categories.map((c) => ({
    id: c.id, label: c.name, icon: c.icon, color: c.color,
  }));

  const payerOptions: PickerOption[] = [
    { id: 'Vợ', label: 'Vợ', icon: '👩‍🦰', color: Colors.pink[400] },
    { id: 'Chồng', label: 'Chồng', icon: '👨‍🦱', color: Colors.mint[400] },
  ];

  const sourceOptions: PickerOption[] = sources.map((s) => ({
    id: s.id,
    label: s.name,
    icon: s.name === 'Tiền mặt' ? '💵' : s.name === 'Chuyển khoản' ? '🏦' : '💳',
  }));

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
          <Pressable style={styles.amountWrap} onPress={() => setShowKeyboard(true)}>
            <Text style={styles.amountSign}>{isChi ? '-' : '+'}</Text>
            <Text style={[styles.amountValue, !formData.amount && styles.amountEmpty]}>
              {displayAmount || '0'}
            </Text>
            <Text style={styles.amountUnit}>đ</Text>
          </Pressable>

          {/* Note hint */}
          <TouchableOpacity
            style={styles.noteHint}
            onPress={() => { setShowKeyboard(false); setTimeout(() => noteRef.current?.focus(), 100); }}
          >
            <Text style={styles.noteHintIcon}>✏️</Text>
            <Text style={styles.noteHintText} numberOfLines={1}>
              {formData.note || formData.location || 'Thêm chi tiết...'}
            </Text>
          </TouchableOpacity>
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
            <View style={[styles.pill, styles.datePill]}>
              <Text style={styles.pillIcon}>📅</Text>
              <Text style={styles.pillText} numberOfLines={1}>{todayLabel}</Text>
            </View>
          </View>

          {/* Note + Location inputs */}
          <View style={styles.inputsCard}>
            <View style={styles.inputRow}>
              <Text style={styles.inputRowIcon}>📍</Text>
              <TextInput
                style={styles.inputField}
                value={formData.location}
                onChangeText={(t) => setFormData((p) => ({ ...p, location: t }))}
                placeholder="Địa điểm..."
                placeholderTextColor={Colors.neutral[400]}
                returnKeyType="next"
              />
            </View>
            <View style={styles.inputSep} />
            <View style={styles.inputRow}>
              <Text style={styles.inputRowIcon}>📝</Text>
              <TextInput
                ref={noteRef}
                style={[styles.inputField, styles.inputFieldNote]}
                value={formData.note}
                onChangeText={(t) => setFormData((p) => ({ ...p, note: t }))}
                placeholder="Ghi chú..."
                placeholderTextColor={Colors.neutral[400]}
                multiline
                numberOfLines={2}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>
          </View>

          {/* Numpad */}
          {showKeyboard && (
            <View style={styles.keypadSection}>
              <AmountKeyboard
                value={formData.amount}
                onChange={(val) => setFormData((p) => ({ ...p, amount: val }))}
              />
              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: accentColor }]}
                onPress={() => setShowKeyboard(false)}
              >
                <Text style={styles.doneBtnText}>Xong ✓</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* ═══ SAVE BUTTON ═══ */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: accentColor }, isSaving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            {isSaving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.saveBtnText}>
                  {isEdit ? 'Cập nhật giao dịch ✏️' : isFromPending ? 'Hoàn thành giao dịch ✓' : 'Lưu giao dịch 🍓'}
                </Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background.primary },
  container: { flex: 1 },

  // ── Top image section ──
  topSection: {
    height: 200,
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

  noteHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.base,
  },
  noteHintIcon: { fontSize: 14 },
  noteHintText: {
    fontSize: Typography.fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
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

  // Inputs card
  inputsCard: {
    backgroundColor: Colors.background.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    overflow: 'hidden',
    ...Shadows.soft,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: 2,
    gap: Spacing.sm,
  },
  inputSep: { height: 1, backgroundColor: Colors.neutral[100], marginLeft: 44 },
  inputRowIcon: { fontSize: 17, width: 24, textAlign: 'center' },
  inputField: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    color: Colors.neutral[700],
    paddingVertical: Spacing.md,
  },
  inputFieldNote: {
    minHeight: 44,
    textAlignVertical: 'top',
  },

  // Keypad
  keypadSection: { gap: Spacing.sm },
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

  // Bottom sheet
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: Colors.background.surface,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    paddingTop: Spacing.md,
    maxHeight: '70%',
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
