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
  canEditSourceSpendingGroup,
  isSourceActive,
  sourceHasTransactionRefs,
  validateNewSourceDraft,
} from '../../database/sourceLifecycle';
import { BACKUP_UI_ENABLED } from '../../platform/backupUiEnabled';
import { confirmDestructive } from '../../platform/confirmDestructive';
import { getSourceGroupLabels } from '../../platform/sourceGroupLabels';
import { useWebSignOut } from '../../platform/webSignOut';
import {
  deleteCategory,
  insertCategory,
  listCategories,
  updateCategory,
} from '../../repositories/categories';
import { userMessageForDataError } from '../../repositories/errors';
import {
  deleteSource,
  insertSource,
  listSourcesWithReferenceCounts,
  setSourceActive,
  updateSource,
} from '../../repositories/sources';
import type {
  EntityId,
  FinanceCategory,
  FinanceSourceWithRefs,
} from '../../repositories/types';
import type { SourceSpendingGroup } from '../../types';
import {
  SOURCE_SPENDING_GROUP_CHOICES,
  UNCLASSIFIED_SPENDING_GROUP_LABEL,
} from '../../types';


type EditKind = 'source' | 'category';

const APPEARANCE_OPTIONS: { id: AppearanceMode; label: string; hint: string }[] = [
  { id: 'system', label: 'Theo hệ thống', hint: 'Tự theo chế độ máy' },
  { id: 'light', label: 'Sáng', hint: 'Moonlit Sakura dịu' },
  { id: 'dark', label: 'Tối', hint: 'Hoàng hôn sakura' },
];

interface EditState {
  kind: EditKind;
  id?: EntityId;
  name: string;
  icon: string;
  color: string;
  spending_group: SourceSpendingGroup | null;
  groupLocked: boolean;
}

function emptyEdit(kind: EditKind): EditState {
  return {
    kind,
    name: '',
    icon: kind === 'category' ? '✨' : '💳',
    color: CategoryColors[0],
    spending_group: null,
    groupLocked: false,
  };
}

export default function SettingsScreen() {
  const { colors, shadows, appearanceMode, setAppearanceMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);
  const sourceGroupLabels = getSourceGroupLabels();
  const sourceGroupLabel = (group: SourceSpendingGroup | null): string =>
    group ? sourceGroupLabels[group] : UNCLASSIFIED_SPENDING_GROUP_LABEL;
  const webSignOut = useWebSignOut();
  const [signingOut, setSigningOut] = useState(false);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [sources, setSources] = useState<FinanceSourceWithRefs[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [cats, srcs] = await Promise.all([
        listCategories(),
        listSourcesWithReferenceCounts(),
      ]);
      setCategories(cats);
      setSources(srcs);
    } catch (err) {
      setLoadError(userMessageForDataError(err, 'settings'));
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

  const openAdd = (kind: EditKind) => {
    setEditError(null);
    setEdit(emptyEdit(kind));
  };

  const openEditSource = (s: FinanceSourceWithRefs) => {
    setEditError(null);
    setEdit({
      kind: 'source',
      id: s.id,
      name: s.name,
      icon: '💳',
      color: CategoryColors[0],
      spending_group: s.spending_group,
      groupLocked: !canEditSourceSpendingGroup(s.reference_count),
    });
  };

  const openEditCategory = (c: FinanceCategory) => {
    setEditError(null);
    setEdit({
      kind: 'category',
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      spending_group: null,
      groupLocked: false,
    });
  };

  const showEditValidation = (title: string, message: string) => {
    // RN Web Alert.alert is a no-op — keep inline error as the Web-visible signal.
    setEditError(message);
    Alert.alert(title, message);
  };

  const handleSaveEdit = async () => {
    if (!edit) return;

    if (edit.kind === 'source' && !edit.id) {
      const draft = validateNewSourceDraft(edit.name, edit.spending_group);
      if (!draft.ok) {
        if (draft.code === 'missing_name') {
          showEditValidation('Thiếu tên', 'Nhập tên trước nhé!');
        } else {
          showEditValidation(
            'Thiếu nhóm theo dõi',
            `Chọn ${sourceGroupLabels.personal_yue} hoặc ${sourceGroupLabels.household}.`,
          );
        }
        return;
      }

      setSaving(true);
      setEditError(null);
      try {
        await insertSource(draft.name, draft.spending_group);
        setEdit(null);
        await loadData();
      } catch (err) {
        const nativeUnique = err instanceof Error && err.message.includes('UNIQUE');
        const message = nativeUnique
          ? 'Tên này đã tồn tại. Hãy chọn tên khác.'
          : userMessageForDataError(err, 'settings');
        showEditValidation('Không lưu được', message);
      } finally {
        setSaving(false);
      }
      return;
    }

    const trimmed = edit.name.trim();
    if (!trimmed) {
      showEditValidation('Thiếu tên', 'Nhập tên trước nhé!');
      return;
    }

    setSaving(true);
    setEditError(null);
    try {
      if (edit.kind === 'source') {
        await updateSource(edit.id!, trimmed, edit.spending_group);
      } else {
        if (edit.id) await updateCategory(edit.id, trimmed, 'chi', edit.icon, edit.color);
        else await insertCategory(trimmed, 'chi', edit.icon, edit.color);
      }
      setEdit(null);
      await loadData();
    } catch (err) {
      const nativeUnique = err instanceof Error && err.message.includes('UNIQUE');
      const message = nativeUnique
        ? 'Tên này đã tồn tại. Hãy chọn tên khác.'
        : userMessageForDataError(err, 'settings');
      showEditValidation('Không lưu được', message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (
    title: string,
    message: string,
    onConfirm: () => Promise<void>,
  ) => {
    const confirmed = await confirmDestructive({
      title,
      message,
      confirmLabel: 'Xoá',
      cancelLabel: 'Huỷ',
    });
    if (!confirmed) return;
    try {
      await onConfirm();
    } catch (err) {
      const text = userMessageForDataError(err, 'settings');
      setLoadError(text);
      Alert.alert('Không xoá được', text);
    }
  };

  const handleArchiveSource = async (s: FinanceSourceWithRefs) => {
    const nextActive = !isSourceActive(s);
    const title = nextActive ? 'Dùng lại nguồn chi?' : 'Lưu trữ nguồn chi?';
    const message = nextActive
      ? `「${s.name}」sẽ hiện lại trên form giao dịch mới. Lịch sử không đổi.`
      : `「${s.name}」ẩn khỏi form giao dịch mới. Giao dịch cũ vẫn giữ nguồn này.`;
    const confirmed = await confirmDestructive({
      title,
      message,
      confirmLabel: nextActive ? 'Dùng lại' : 'Lưu trữ',
      cancelLabel: 'Huỷ',
    });
    if (!confirmed) return;
    try {
      await setSourceActive(s.id, nextActive);
      await loadData();
    } catch (err) {
      const text = userMessageForDataError(err, 'sources');
      setLoadError(text);
      Alert.alert('Không cập nhật được', text);
    }
  };

  const handleDeleteSource = (s: FinanceSourceWithRefs) => {
    void confirmDelete(
      'Xoá nguồn chi?',
      `Xoá 「${s.name}」? Chỉ xoá được nguồn chưa có giao dịch.`,
      async () => {
        const result = await deleteSource(s.id);
        if (!result.ok) {
          setLoadError(result.reason);
          Alert.alert('Không thể xoá', result.reason);
          return;
        }
        await loadData();
      },
    );
  };

  const handleDeleteCategory = (c: FinanceCategory) => {
    void confirmDelete(
      'Xoá danh mục?',
      `Xoá 「${c.name}」? Giao dịch cũ sẽ mất liên kết danh mục.`,
      async () => {
        const result = await deleteCategory(c.id);
        if (!result.ok) {
          setLoadError(result.reason);
          Alert.alert('Không thể xoá', result.reason);
          return;
        }
        await loadData();
      },
    );
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

  const handleWebSignOut = async () => {
    if (!webSignOut || signingOut) return;
    setSigningOut(true);
    try {
      await webSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  const editTitle =
    edit?.kind === 'source'
      ? edit.id ? 'Sửa nguồn chi' : 'Thêm nguồn chi'
      : edit?.id ? 'Sửa danh mục' : 'Thêm danh mục';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>⚙️ Cài đặt</Text>
          <Text style={styles.headerSub}>Quản lý nguồn chi và danh mục</Text>
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
            <Text style={styles.statEmoji}>🔒</Text>
            <Text style={styles.statValue}>100%</Text>
            <Text style={styles.statLabel}>Bảo mật</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.blue[400]} style={{ paddingVertical: 40 }} />
        ) : loadError ? (
          <View style={styles.section}>
            <View style={[styles.card, styles.cardPadded]}>
              <Text style={styles.emptyText}>{loadError}</Text>
              <TouchableOpacity style={styles.saveEditBtn} onPress={loadData} activeOpacity={0.85}>
                <Text style={styles.saveEditBtnText}>Thử lại</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* ── Nguồn chi ── */}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>💳 Nguồn chi</Text>
                <TouchableOpacity style={styles.addChip} onPress={() => openAdd('source')}>
                  <Text style={styles.addChipText}>+ Thêm</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.card}>
                {sources.length === 0 ? (
                  <Text style={styles.emptyText}>Chưa có nguồn chi</Text>
                ) : (
                  sources.map((s, idx) => {
                    const active = isSourceActive(s);
                    const referenced = sourceHasTransactionRefs(s.reference_count);
                    return (
                  <View key={s.id}>
                    <View style={styles.itemRow}>
                      <View style={[styles.itemIcon, { backgroundColor: colors.blue[100] }]}>
                        <Text style={styles.itemIconText}>
                          {s.name === 'Tiền mặt' || s.name.includes('Tiền mặt') ? '💵' : '💳'}
                        </Text>
                      </View>
                      <View style={styles.itemInfo}>
                        <Text style={[styles.itemName, !active && styles.itemNameArchived]}>{s.name}</Text>
                        <Text style={styles.itemMeta}>
                          {[
                            sourceGroupLabel(s.spending_group),
                            !active ? 'Đã lưu trữ' : null,
                          ].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <View style={styles.itemActions}>
                        <TouchableOpacity style={styles.actionChipEdit} onPress={() => openEditSource(s)}>
                          <Text style={styles.actionChipEditText}>Sửa</Text>
                        </TouchableOpacity>
                        {referenced ? (
                          <TouchableOpacity style={styles.actionChipEdit} onPress={() => handleArchiveSource(s)}>
                            <Text style={styles.actionChipEditText}>
                              {active ? 'Lưu trữ' : 'Dùng lại'}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <>
                            {!active ? (
                              <TouchableOpacity style={styles.actionChipEdit} onPress={() => handleArchiveSource(s)}>
                                <Text style={styles.actionChipEditText}>Dùng lại</Text>
                              </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity style={styles.actionChipDanger} onPress={() => handleDeleteSource(s)}>
                              <Text style={styles.actionChipDangerText}>Xoá</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                    {idx < sources.length - 1 && <View style={styles.divider} />}
                  </View>
                    );
                  })
                )}
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
                        <View style={styles.itemActions}>
                          <TouchableOpacity style={styles.actionChipEdit} onPress={() => openEditCategory(c)}>
                            <Text style={styles.actionChipEditText}>Sửa</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.actionChipDanger} onPress={() => handleDeleteCategory(c)}>
                            <Text style={styles.actionChipDangerText}>Xoá</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      {idx < expenseCategories.length - 1 && <View style={styles.divider} />}
                    </View>
                  ))
                )}
              </View>
            </View>
          </>
        )}

        {/* ── Backup (Android SQLite v8; hidden on Web P2.2) ── */}
        {BACKUP_UI_ENABLED ? (
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
        ) : null}

        {webSignOut ? (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.signOutBtn, signingOut && { opacity: 0.6 }]}
              onPress={handleWebSignOut}
              disabled={signingOut}
              activeOpacity={0.85}
            >
              {signingOut ? (
                <ActivityIndicator size="small" color={colors.action.destructiveText} />
              ) : (
                <Text style={styles.signOutBtnText}>Đăng xuất</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Modal thêm/sửa */}
      <BottomSheetModal
        visible={edit !== null}
        onClose={() => {
          setEditError(null);
          setEdit(null);
        }}
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
                onChangeText={(name) => {
                  setEditError(null);
                  setEdit((p) => p && { ...p, name });
                }}
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

            {edit.kind === 'source' && (
              <>
                <Text style={styles.editLabel}>Nhóm theo dõi</Text>
                {edit.groupLocked ? (
                  <Text style={styles.groupLockedHint}>
                    {sourceGroupLabel(edit.spending_group)} — đã có giao dịch, không đổi nhóm. Đổi ý nghĩa tài chính thì lưu trữ nguồn này và tạo nguồn mới.
                  </Text>
                ) : (
                  <View style={styles.typeRow}>
                    {SOURCE_SPENDING_GROUP_CHOICES.map((id) => {
                      const active = edit.spending_group === id;
                      return (
                        <TouchableOpacity
                          key={id}
                          style={[styles.typeChip, active && styles.typeChipActive]}
                          onPress={() => {
                            setEditError(null);
                            setEdit((p) => p && { ...p, spending_group: id });
                          }}
                        >
                          <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                            {sourceGroupLabels[id]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            )}

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

            {editError ? <Text style={styles.editErrorText}>{editError}</Text> : null}

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
    borderColor: colors.ui.cardBorder,
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
    fontSize: Typography.fontSize.base,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  itemNameArchived: {
    color: colors.neutral[400],
  },
  itemMeta: {
    fontSize: Typography.fontSize.xs,
    color: colors.neutral[400],
    fontWeight: '500',
  },
  itemActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
    maxWidth: '58%',
  },
  actionChipEdit: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.action.secondaryBackground,
    borderWidth: 1,
    borderColor: colors.action.secondaryBorder,
  },
  actionChipEditText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: colors.action.secondaryText,
  },
  actionChipDanger: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.action.destructiveBackground,
    borderWidth: 1,
    borderColor: colors.pink[200],
  },
  actionChipDangerText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
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
    borderColor: colors.ui.cardBorder,
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
  infoDivider: {
    height: 1,
    backgroundColor: colors.neutral[100],
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
    borderColor: colors.ui.fieldBorder,
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
    borderColor: colors.ui.fieldBorder,
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
  groupLockedHint: {
    fontSize: Typography.fontSize.xs,
    color: colors.neutral[400],
    fontWeight: '500',
    lineHeight: 18,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
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
  editErrorText: {
    color: colors.action.destructiveText,
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.sm,
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
  signOutBtn: {
    backgroundColor: colors.action.destructiveBackground,
    borderWidth: 1,
    borderColor: colors.pink[200],
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  signOutBtnText: {
    color: colors.action.destructiveText,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  saveEditBtnText: {
    color: colors.action.primaryText,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
});
}
