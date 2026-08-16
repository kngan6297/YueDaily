import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheetModal } from '../../components/ui/BottomSheetModal';
import {
  AppearanceMode,
  BorderRadius,
  CategoryColors,
  Spacing,
  ThemeColors,
  ThemeShadows,
  Typography,
} from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';
import { exportBackup, importBackup } from '../../database/backup';
import {
  deleteCategory,
  deletePayer,
  deleteSource,
  getAllCategories,
  getAllPayers,
  getAllSources,
  insertCategory,
  insertPayer,
  insertSource,
  updateCategory,
  updatePayer,
  updateSource,
} from '../../database/categories';
import { useStreak } from '../../hooks/useStreak';
import type { Category, PayerRecord, Source } from '../../types';

const APP_INFO_ROWS = [
  { label: 'Tên ứng dụng', value: 'YueDaily' },
  { label: 'Phiên bản', value: '1.0.0' },
  { label: 'Lưu trữ', value: '100% trên thiết bị' },
  { label: 'Server', value: 'Không có' },
];

type EditKind = 'payer' | 'source' | 'category';

const APPEARANCE_OPTIONS: { id: AppearanceMode; label: string; hint: string }[] = [
  { id: 'system', label: 'Theo hệ thống', hint: 'Tự theo chế độ máy' },
  { id: 'light', label: 'Sáng', hint: 'Moonlit Sakura dịu' },
  { id: 'dark', label: 'Tối', hint: 'Đêm xanh pha tím' },
];

interface EditState {
  kind: EditKind;
  id?: number;
  name: string;
  icon: string;
  color: string;
}

function emptyEdit(kind: EditKind): EditState {
  return {
    kind,
    name: '',
    icon: kind === 'category' ? '✨' : kind === 'payer' ? '👤' : '💳',
    color: CategoryColors[0],
  };
}

export default function SettingsScreen() {
  const { colors, shadows, appearanceMode, setAppearanceMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);
  const { streak } = useStreak();
  const [categories, setCategories] = useState<Category[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [payers, setPayers] = useState<PayerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, srcs, pays] = await Promise.all([
        getAllCategories(),
        getAllSources(),
        getAllPayers(),
      ]);
      setCategories(cats);
      setSources(srcs);
      setPayers(pays);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  const expenseCategories = categories.filter(
    (c) => c.type === 'chi' || c.type === 'both'
  );

  const openAdd = (kind: EditKind) => setEdit(emptyEdit(kind));

  const openEditPayer = (p: PayerRecord) =>
    setEdit({ kind: 'payer', id: p.id, name: p.name, icon: p.icon, color: p.color });

  const openEditSource = (s: Source) =>
    setEdit({ kind: 'source', id: s.id, name: s.name, icon: '💳', color: CategoryColors[0] });

  const openEditCategory = (c: Category) =>
    setEdit({
      kind: 'category',
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
    });

  const handleSaveEdit = async () => {
    if (!edit) return;
    const trimmed = edit.name.trim();
    if (!trimmed) {
      Alert.alert('Thiếu tên', 'Nhập tên trước nhé!');
      return;
    }

    setSaving(true);
    try {
      if (edit.kind === 'payer') {
        if (edit.id) await updatePayer(edit.id, trimmed, edit.icon, edit.color);
        else await insertPayer(trimmed, edit.icon, edit.color);
      } else if (edit.kind === 'source') {
        if (edit.id) await updateSource(edit.id, trimmed);
        else await insertSource(trimmed);
      } else {
        if (edit.id) await updateCategory(edit.id, trimmed, 'chi', edit.icon, edit.color);
        else await insertCategory(trimmed, 'chi', edit.icon, edit.color);
      }
      setEdit(null);
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Lỗi', msg.includes('UNIQUE') ? 'Tên này đã tồn tại.' : 'Không thể lưu. Thử lại nhé!');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (title: string, message: string, onConfirm: () => Promise<void>) => {
    Alert.alert(title, message, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => { onConfirm().catch(console.error); } },
    ]);
  };

  const handleDeletePayer = (p: PayerRecord) => {
    confirmDelete('Xoá người trả?', `Xoá 「${p.name}」?`, async () => {
      const result = await deletePayer(p.id);
      if (!result.ok) Alert.alert('Không thể xoá', result.reason);
      else await loadData();
    });
  };

  const handleDeleteSource = (s: Source) => {
    confirmDelete('Xoá nguồn chi?', `Xoá 「${s.name}」? Giao dịch cũ sẽ mất liên kết nguồn.`, async () => {
      const result = await deleteSource(s.id);
      if (!result.ok) Alert.alert('Không thể xoá', result.reason);
      else await loadData();
    });
  };

  const handleDeleteCategory = (c: Category) => {
    confirmDelete('Xoá danh mục?', `Xoá 「${c.name}」? Giao dịch cũ sẽ mất liên kết danh mục.`, async () => {
      const result = await deleteCategory(c.id);
      if (!result.ok) Alert.alert('Không thể xoá', result.reason);
      else await loadData();
    });
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportBackup();
    } catch (err) {
      Alert.alert('Xuất thất bại', String(err));
    } finally {
      setExporting(false);
    }
  };

  const handleImport = () => {
    Alert.alert(
      'Khôi phục dữ liệu',
      'Toàn bộ dữ liệu hiện tại sẽ bị xoá và thay thế bằng file backup.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Khôi phục',
          style: 'destructive',
          onPress: async () => {
            try {
              setImporting(true);
              const result = await importBackup();
              if (result.success) {
                Alert.alert('Thành công! 🌸', result.message);
                await loadData();
              } else if (result.message !== 'Đã hủy') {
                Alert.alert('Khôi phục thất bại', result.message);
              }
            } catch (err) {
              Alert.alert('Lỗi', String(err));
            } finally {
              setImporting(false);
            }
          },
        },
      ]
    );
  };

  const editTitle =
    edit?.kind === 'payer'
      ? edit.id ? 'Sửa người trả' : 'Thêm người trả'
      : edit?.kind === 'source'
        ? edit.id ? 'Sửa nguồn chi' : 'Thêm nguồn chi'
        : edit?.id ? 'Sửa danh mục' : 'Thêm danh mục';

  const streakCount = streak?.current_streak ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>⚙️ Cài đặt</Text>
          <Text style={styles.headerSub}>Quản lý nguồn chi và danh mục</Text>
        </View>

        {/* ── Thông tin app ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ℹ️ Về ứng dụng</Text>
          <View style={[styles.card, styles.cardPadded]}>
            {APP_INFO_ROWS.map((row, idx) => (
              <View key={row.label}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </View>
                {idx < APP_INFO_ROWS.length - 1 && <View style={styles.infoDivider} />}
              </View>
            ))}
          </View>
        </View>

        {/* ── Giao diện ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎨 Giao diện</Text>
          <View style={styles.card}>
            {APPEARANCE_OPTIONS.map((opt, idx) => {
              const active = appearanceMode === opt.id;
              return (
                <View key={opt.id}>
                  <TouchableOpacity
                    style={[styles.appearanceRow, active && styles.appearanceRowActive]}
                    onPress={() => setAppearanceMode(opt.id)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.appearanceInfo}>
                      <Text style={[styles.appearanceLabel, active && styles.appearanceLabelActive]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.appearanceHint}>{opt.hint}</Text>
                    </View>
                    <View style={[styles.appearanceRadio, active && styles.appearanceRadioActive]}>
                      {active ? <View style={styles.appearanceRadioDot} /> : null}
                    </View>
                  </TouchableOpacity>
                  {idx < APPEARANCE_OPTIONS.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Tóm tắt nhanh ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statValue}>{streakCount}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🔒</Text>
            <Text style={styles.statValue}>100%</Text>
            <Text style={styles.statLabel}>Bảo mật</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>📱</Text>
            <Text style={styles.statValue}>v1.0</Text>
            <Text style={styles.statLabel}>Phiên bản</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.blue[400]} style={{ paddingVertical: 40 }} />
        ) : (
          <>
            {/* ── Người trả ── */}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>👥 Người trả</Text>
                <TouchableOpacity style={styles.addChip} onPress={() => openAdd('payer')}>
                  <Text style={styles.addChipText}>+ Thêm</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.card}>
                {payers.map((p, idx) => (
                  <View key={p.id}>
                    <View style={styles.itemRow}>
                      <View style={[styles.itemIcon, { backgroundColor: p.color + '22' }]}>
                        <Text style={styles.itemIconText}>{p.icon}</Text>
                      </View>
                      <Text style={styles.itemName}>{p.name}</Text>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => openEditPayer(p)}>
                        <Text style={styles.actionEdit}>Sửa</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeletePayer(p)}>
                        <Text style={styles.actionDelete}>Xoá</Text>
                      </TouchableOpacity>
                    </View>
                    {idx < payers.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            </View>

            {/* ── Nguồn chi ── */}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>💳 Nguồn chi</Text>
                <TouchableOpacity style={styles.addChip} onPress={() => openAdd('source')}>
                  <Text style={styles.addChipText}>+ Thêm</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.card}>
                {sources.map((s, idx) => (
                  <View key={s.id}>
                    <View style={styles.itemRow}>
                      <View style={[styles.itemIcon, { backgroundColor: colors.blue[100] }]}>
                        <Text style={styles.itemIconText}>
                          {s.name === 'Tiền mặt' || s.name.includes('Tiền mặt') ? '💵' : '💳'}
                        </Text>
                      </View>
                      <Text style={styles.itemName}>{s.name}</Text>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => openEditSource(s)}>
                        <Text style={styles.actionEdit}>Sửa</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteSource(s)}>
                        <Text style={styles.actionDelete}>Xoá</Text>
                      </TouchableOpacity>
                    </View>
                    {idx < sources.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            </View>

            {/* ── Danh mục ── */}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>🏷️ Danh mục</Text>
                <TouchableOpacity style={styles.addChip} onPress={() => openAdd('category')}>
                  <Text style={styles.addChipText}>+ Thêm</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.card}>
                {expenseCategories.length === 0 ? (
                  <Text style={styles.emptyText}>Chưa có danh mục nào</Text>
                ) : (
                  expenseCategories.map((c, idx) => (
                    <View key={c.id}>
                      <View style={styles.itemRow}>
                        <View style={[styles.itemIcon, { backgroundColor: c.color + '22' }]}>
                          <Text style={styles.itemIconText}>{c.icon}</Text>
                        </View>
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName}>{c.name}</Text>
                        </View>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => openEditCategory(c)}>
                          <Text style={styles.actionEdit}>Sửa</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteCategory(c)}>
                          <Text style={styles.actionDelete}>Xoá</Text>
                        </TouchableOpacity>
                      </View>
                      {idx < expenseCategories.length - 1 && <View style={styles.divider} />}
                    </View>
                  ))
                )}
              </View>
            </View>
          </>
        )}

        {/* ── Backup ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💾 Sao lưu & Khôi phục</Text>
          <View style={[styles.card, styles.cardPadded]}>
            <Text style={styles.backupHint}>
              Xuất dữ liệu ra file JSON để lưu vào Google Drive, máy tính, hoặc bất kỳ đâu. Khi cần, nhập lại để khôi phục toàn bộ giao dịch, danh mục, nguồn chi và dữ liệu lịch sử.
            </Text>

            <View style={styles.infoDivider} />

            <TouchableOpacity
              style={[styles.backupBtn, styles.backupBtnExport]}
              onPress={handleExport}
              disabled={exporting || importing}
              activeOpacity={0.75}
            >
              {exporting ? (
                <ActivityIndicator size="small" color={colors.action.primaryText} />
              ) : (
                <Text style={styles.backupBtnIcon}>📤</Text>
              )}
              <View style={styles.backupBtnText}>
                <Text style={styles.backupBtnLabel}>Xuất backup</Text>
                <Text style={styles.backupBtnSub}>Lưu file JSON ra ngoài</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.backupBtn, styles.backupBtnImport]}
              onPress={handleImport}
              disabled={exporting || importing}
              activeOpacity={0.75}
            >
              {importing ? (
                <ActivityIndicator size="small" color={colors.neutral[700]} />
              ) : (
                <Text style={styles.backupBtnIcon}>📥</Text>
              )}
              <View style={styles.backupBtnText}>
                <Text style={[styles.backupBtnLabel, styles.backupBtnLabelDark]}>Nhập backup</Text>
                <Text style={styles.backupBtnSub}>Khôi phục từ file JSON</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Modal thêm/sửa */}
      <BottomSheetModal
        visible={edit !== null}
        onClose={() => setEdit(null)}
        keyboardAvoiding
      >
        {edit && (
          <>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{editTitle}</Text>

            <View style={styles.editPreview}>
              {edit.kind !== 'source' && (
                <View style={[styles.editPreviewChip, { backgroundColor: edit.color + '33' }]}>
                  <Text style={styles.editPreviewIcon}>{edit.icon}</Text>
                  <Text style={styles.editPreviewName}>{edit.name || 'Tên mới'}</Text>
                </View>
              )}
            </View>

            <View style={styles.editRow}>
              <TextInput
                style={[styles.editInput, edit.kind === 'source' && { flex: 1 }]}
                placeholder="Tên..."
                placeholderTextColor={colors.neutral[400]}
                value={edit.name}
                onChangeText={(name) => setEdit((p) => p && { ...p, name })}
                maxLength={30}
                autoFocus
              />
              {edit.kind !== 'source' && (
                <TextInput
                  style={styles.editIconInput}
                  value={edit.icon}
                  onChangeText={(icon) => setEdit((p) => p && { ...p, icon })}
                  maxLength={4}
                  textAlign="center"
                />
              )}
            </View>

            {edit.kind === 'category' && (
              <>
                <Text style={styles.editLabel}>Màu sắc</Text>
                <View style={styles.colorRow}>
                  {(CategoryColors as readonly string[]).map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.colorDot, { backgroundColor: c }, edit.color === c && styles.colorDotOn]}
                      onPress={() => setEdit((p) => p && { ...p, color: c })}
                    />
                  ))}
                </View>
              </>
            )}

            {edit.kind === 'payer' && (
              <>
                <Text style={styles.editLabel}>Màu nhãn</Text>
                <View style={styles.colorRow}>
                  {(CategoryColors as readonly string[]).map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.colorDot, { backgroundColor: c }, edit.color === c && styles.colorDotOn]}
                      onPress={() => setEdit((p) => p && { ...p, color: c })}
                    />
                  ))}
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.saveEditBtn, saving && { opacity: 0.6 }]}
              onPress={handleSaveEdit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveEditBtnText}>Lưu</Text>
              )}
            </TouchableOpacity>
            <View style={{ height: 16 }} />
          </>
        )}
      </BottomSheetModal>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors, shadows: ThemeShadows) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  scroll: { padding: Spacing.base, gap: Spacing.lg },

  header: { gap: 4, paddingVertical: Spacing.sm },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
    color: colors.neutral[700],
  },
  headerSub: {
    fontSize: Typography.fontSize.sm,
    color: colors.neutral[400],
  },

  section: { gap: Spacing.sm },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  appearanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  appearanceRowActive: {
    backgroundColor: colors.action.selectedBackground,
  },
  appearanceInfo: { flex: 1, gap: 2 },
  appearanceLabel: {
    fontSize: Typography.fontSize.base,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  appearanceLabelActive: {
    color: colors.action.selectedText,
    fontWeight: '700',
  },
  appearanceHint: {
    fontSize: Typography.fontSize.xs,
    color: colors.neutral[400],
    fontWeight: '500',
  },
  appearanceRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  appearanceRadioActive: {
    borderColor: colors.action.selectedBorder,
  },
  appearanceRadioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.action.selectedBorder,
  },
  addChip: {
    backgroundColor: colors.action.secondaryBackground,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.action.secondaryBorder,
  },
  addChipText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: colors.action.secondaryText,
  },

  card: {
    backgroundColor: colors.background.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.metallic.platinum,
    overflow: 'hidden',
  },
  cardPadded: {
    padding: Spacing.base,
    gap: Spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconText: { fontSize: 20 },
  itemInfo: { flex: 1, gap: 2 },
  itemName: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  itemMeta: {
    fontSize: Typography.fontSize.xs,
    color: colors.neutral[400],
    fontWeight: '500',
  },
  actionBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  actionEdit: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: colors.action.selectedText,
  },
  actionDelete: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: colors.action.destructiveText,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginLeft: 40 + Spacing.base + Spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.lg,
    color: colors.neutral[400],
    fontSize: Typography.fontSize.sm,
  },

  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.neutral[100],
  },
  filterChipActive: {
    backgroundColor: colors.action.selectedBackground,
    borderWidth: 1,
    borderColor: colors.action.selectedBorder,
  },
  filterChipText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    color: colors.neutral[400],
  },
  filterChipTextActive: { color: colors.action.selectedText },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  infoLabel: {
    fontSize: Typography.fontSize.sm,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  infoValue: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.neutral[100],
  },

  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.metallic.platinum,
  },
  statEmoji: { fontSize: 22 },
  statValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: '800',
    color: colors.neutral[700],
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    color: colors.neutral[400],
    fontWeight: '500',
  },

  backupHint: {
    fontSize: Typography.fontSize.sm,
    color: colors.neutral[500],
    lineHeight: 20,
  },
  backupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderWidth: 1,
  },
  backupBtnExport: {
    backgroundColor: colors.action.primaryBackground,
    borderColor: colors.action.primaryPressed,
    ...shadows.medium,
  },
  backupBtnImport: {
    backgroundColor: colors.action.secondaryBackground,
    borderColor: colors.action.secondaryBorder,
    ...shadows.soft,
  },
  backupBtnIcon: { fontSize: 22 },
  backupBtnText: { flex: 1, gap: 2 },
  backupBtnLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: colors.action.primaryText,
  },
  backupBtnLabelDark: { color: colors.action.secondaryText },
  backupBtnSub: {
    fontSize: Typography.fontSize.xs,
    color: colors.neutral[600],
    fontWeight: '500',
  },

  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[300],
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
  editPreview: { alignItems: 'center', paddingVertical: Spacing.sm },
  editPreviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  editPreviewIcon: { fontSize: 22 },
  editPreviewName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  editRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    alignItems: 'center',
  },
  editInput: {
    flex: 1,
    backgroundColor: colors.background.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: colors.metallic.platinum,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.base,
    color: colors.neutral[700],
  },
  editIconInput: {
    width: 52,
    height: 52,
    backgroundColor: colors.background.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: colors.metallic.platinum,
    fontSize: 24,
    color: colors.neutral[700],
  },
  editLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: colors.neutral[500],
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  typeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  typeChip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  typeChipActive: {
    backgroundColor: colors.action.selectedBackground,
    borderColor: colors.action.selectedBorder,
  },
  typeChipText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  typeChipTextActive: { color: colors.action.selectedText },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  colorDotOn: {
    borderColor: colors.neutral[700],
    transform: [{ scale: 1.15 }],
  },
  saveEditBtn: {
    backgroundColor: colors.action.primaryBackground,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginHorizontal: Spacing.base,
    marginTop: Spacing.md,
    ...shadows.medium,
  },
  saveEditBtnText: {
    color: colors.action.primaryText,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
});
}
