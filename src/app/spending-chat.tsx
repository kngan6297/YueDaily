// ============================================================
// P1.8A — AI Spending Chat (read-only conversational analyst)
// ============================================================

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { Spacing, ThemeColors, ThemeShadows, Typography } from '../constants/theme';
import { useAppTheme } from '../context/ThemeContext';
import {
  appendAiChatMessage,
  createAiChatThread,
  createAiSavedPrompt,
  decodeAssistantContent,
  deleteAiChatThread,
  deleteAiSavedPrompt,
  encodeAssistantContent,
  getAiChatThreadById,
  getAiChatThreadContext,
  listAiChatMessages,
  listAiChatThreads,
  listAiSavedPrompts,
  listRecentAiChatMessages,
  updateAiChatThreadAnchor,
  updateAiChatThreadContext,
  updateAiSavedPrompt,
  type AiChatThread,
  type AiSavedPrompt,
} from '../database/aiChatRepository';
import { getDatabase } from '../database/initDb';
import { TRANSACTION_STATUS_COMPLETE } from '../types';
import { toSafeTransactionDto, type SafeTransactionDto } from '../services/spendingChat/safeDto';
import { SPENDING_CHAT_PRESETS } from '../services/spendingChat/presets';
import { runSpendingChatTurn } from '../services/spendingChat/orchestrator';

const MONTH_NAMES = [
  '',
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

type ChatBubble = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  evidenceTransactionIds?: number[];
  followUps?: string[];
  pending?: boolean;
  error?: boolean;
};

function fmt(n: number): string {
  return n.toLocaleString('vi-VN') + '₫';
}

export default function SpendingChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ year?: string; month?: string }>();
  const { colors, shadows } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatBubble>>(null);

  const initialYear = Number(params.year) || new Date().getFullYear();
  const initialMonth = Number(params.month) || new Date().getMonth() + 1;

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [threadId, setThreadId] = useState<number | null>(null);
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMorePresets, setShowMorePresets] = useState(false);
  const [showPins, setShowPins] = useState(false);
  const [threads, setThreads] = useState<AiChatThread[]>([]);
  const [savedPrompts, setSavedPrompts] = useState<AiSavedPrompt[]>([]);
  const [evidenceIds, setEvidenceIds] = useState<number[] | null>(null);
  const [evidenceRows, setEvidenceRows] = useState<SafeTransactionDto[]>([]);
  const [pinDraftTitle, setPinDraftTitle] = useState('');
  const [pinDraftBody, setPinDraftBody] = useState('');

  const monthLabel = `${MONTH_NAMES[month]}/${year}`;

  const ensureThread = useCallback(async (): Promise<number> => {
    if (threadId != null) return threadId;
    const thread = await createAiChatThread({
      anchorYear: year,
      anchorMonth: month,
      context: {},
    });
    setThreadId(thread.id);
    return thread.id;
  }, [threadId, year, month]);

  const reloadPins = useCallback(async () => {
    setSavedPrompts(await listAiSavedPrompts());
  }, []);

  const reloadHistory = useCallback(async () => {
    setThreads(await listAiChatThreads(40));
  }, []);

  useEffect(() => {
    reloadPins();
  }, [reloadPins]);

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
    if (threadId != null) {
      updateAiChatThreadAnchor(threadId, y, m).catch(() => undefined);
    }
  };

  const openThread = async (id: number) => {
    const thread = await getAiChatThreadById(id);
    if (!thread) return;
    setThreadId(thread.id);
    setYear(thread.anchor_year);
    setMonth(thread.anchor_month);
    const messages = await listAiChatMessages(thread.id);
    setBubbles(
      messages.map((m) => {
        if (m.role === 'assistant') {
          const decoded = decodeAssistantContent(m.content);
          return {
            id: String(m.id),
            role: 'assistant' as const,
            text: decoded.answer,
            evidenceTransactionIds: decoded.evidenceTransactionIds,
            followUps: decoded.followUps,
          };
        }
        return { id: String(m.id), role: 'user' as const, text: m.content };
      }),
    );
    setShowHistory(false);
  };

  const startNewChat = async () => {
    const thread = await createAiChatThread({
      anchorYear: year,
      anchorMonth: month,
      context: {},
    });
    setThreadId(thread.id);
    setBubbles([]);
    setShowHistory(false);
  };

  const confirmDeleteThread = (id: number) => {
    Alert.alert('Xóa hội thoại?', 'Không thể hoàn tác.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          await deleteAiChatThread(id);
          if (threadId === id) {
            setThreadId(null);
            setBubbles([]);
          }
          reloadHistory();
        },
      },
    ]);
  };

  const loadEvidence = async (ids: number[]) => {
    if (ids.length === 0) return;
    const db = await getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    const rows = await db.getAllAsync<{
      id: number;
      amount: number;
      type: string;
      created_at: string;
      expense_audience: string;
      note: string | null;
      category_name: string | null;
      source_name: string | null;
    }>(
      `SELECT t.id, t.amount, t.type, t.created_at, t.expense_audience, t.note,
              c.name AS category_name, s.name AS source_name
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN sources s ON t.source_id = s.id
       WHERE t.id IN (${placeholders})
         AND t.status = '${TRANSACTION_STATUS_COMPLETE}'
       ORDER BY t.amount DESC, t.id DESC;`,
      ids,
    );
    setEvidenceRows(rows.map(toSafeTransactionDto));
    setEvidenceIds(ids);
  };

  const sendQuestion = async (question: string, presetId?: string) => {
    const trimmed = question.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setInput('');
    const tempUserId = `u-${Date.now()}`;
    const tempAssistantId = `a-${Date.now()}`;
    setBubbles((prev) => [
      ...prev,
      { id: tempUserId, role: 'user', text: trimmed },
      { id: tempAssistantId, role: 'assistant', text: 'Đang phân tích…', pending: true },
    ]);

    try {
      const tid = await ensureThread();
      await appendAiChatMessage({
        threadId: tid,
        role: 'user',
        content: trimmed,
        setTitleFromUserQuestion: true,
      });

      const context = await getAiChatThreadContext(tid);
      const recent = await listRecentAiChatMessages(tid, 12);
      const recentForModel = recent
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role,
          content:
            m.role === 'assistant' ? decodeAssistantContent(m.content).answer : m.content,
        }));

      const result = await runSpendingChatTurn({
        question: trimmed,
        year,
        month,
        context,
        recentMessages: recentForModel,
        presetId,
      });

      await updateAiChatThreadContext(tid, result.context);

      const encoded = encodeAssistantContent({
        answer: result.answer,
        evidenceTransactionIds: result.evidenceTransactionIds,
        followUps: result.followUps,
      });
      const saved = await appendAiChatMessage({
        threadId: tid,
        role: 'assistant',
        content: encoded,
      });

      setBubbles((prev) =>
        prev
          .filter((b) => b.id !== tempAssistantId)
          .map((b) => (b.id === tempUserId ? b : b))
          .concat([
            {
              id: String(saved.id),
              role: 'assistant',
              text: result.answer,
              evidenceTransactionIds: result.evidenceTransactionIds,
              followUps: result.followUps,
              error: result.kind === 'error',
            },
          ]),
      );
    } catch {
      setBubbles((prev) =>
        prev.map((b) =>
          b.id === tempAssistantId
            ? {
                ...b,
                pending: false,
                error: true,
                text: 'Có lỗi khi trả lời. Câu hỏi của bạn vẫn được giữ — thử lại nhé.',
              }
            : b,
        ),
      );
    } finally {
      setSending(false);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  };

  const renderBubble = ({ item }: { item: ChatBubble }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubbleWrap, isUser ? styles.bubbleWrapUser : styles.bubbleWrapAi]}>
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAi,
            item.error && styles.bubbleError,
          ]}
        >
          {item.pending ? (
            <ActivityIndicator color={colors.action.primaryBackground} />
          ) : (
            <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.text}</Text>
          )}
          {!isUser && !item.pending && (item.evidenceTransactionIds?.length ?? 0) > 0 && (
            <TouchableOpacity
              style={styles.evidenceChip}
              onPress={() => loadEvidence(item.evidenceTransactionIds!)}
            >
              <Text style={styles.evidenceChipText}>Xem giao dịch</Text>
            </TouchableOpacity>
          )}
          {!isUser && !item.pending && (item.followUps?.length ?? 0) > 0 && (
            <View style={styles.followUpRow}>
              {item.followUps!.slice(0, 3).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={styles.followUpChip}
                  onPress={() => sendQuestion(f)}
                  disabled={sending}
                >
                  <Text style={styles.followUpText}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Đóng</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>AI Phân tích chi tiêu</Text>
            <View style={styles.monthRow}>
              <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={12}>
                <Text style={styles.monthArrow}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{monthLabel}</Text>
              <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={12}>
                <Text style={styles.monthArrow}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={async () => {
                await reloadHistory();
                setShowHistory(true);
              }}
              style={styles.headerBtn}
            >
              <Text style={styles.headerBtnText}>Lịch sử</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={startNewChat} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>Mới</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetRow}
          style={styles.presetScroll}
        >
          {SPENDING_CHAT_PRESETS.slice(0, 5).map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.presetChip}
              onPress={() => sendQuestion(p.body, p.id)}
              disabled={sending}
            >
              <Text style={styles.presetChipText}>{p.title}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.presetChipMuted}
            onPress={() => setShowMorePresets(true)}
          >
            <Text style={styles.presetChipText}>Xem thêm</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetChipMuted}
            onPress={async () => {
              await reloadPins();
              setShowPins(true);
            }}
          >
            <Text style={styles.presetChipText}>Đã ghim</Text>
          </TouchableOpacity>
        </ScrollView>

        <FlatList
          ref={listRef}
          data={bubbles}
          keyExtractor={(item) => item.id}
          renderItem={renderBubble}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Hỏi về chi tiêu tháng này</Text>
              <Text style={styles.emptySub}>
                AI chỉ đọc số liệu từ báo cáo / quỹ — không tự cộng tay giao dịch.
              </Text>
            </View>
          }
        />

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput
            style={styles.input}
            placeholder="Hỏi về chi tiêu…"
            placeholderTextColor={colors.neutral[400]}
            value={input}
            onChangeText={setInput}
            multiline
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={() => sendQuestion(input)}
            disabled={!input.trim() || sending}
          >
            <Text style={styles.sendBtnText}>Gửi</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* More presets */}
      <Modal visible={showMorePresets} animationType="slide" transparent>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Câu hỏi gợi ý</Text>
            <ScrollView>
              {SPENDING_CHAT_PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.sheetRow}
                  onPress={() => {
                    setShowMorePresets(false);
                    sendQuestion(p.body, p.id);
                  }}
                >
                  <Text style={styles.sheetRowTitle}>{p.title}</Text>
                  <Text style={styles.sheetRowBody} numberOfLines={2}>
                    {p.body}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.sheetClose} onPress={() => setShowMorePresets(false)}>
              <Text style={styles.sheetCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Pinned prompts */}
      <Modal visible={showPins} animationType="slide" transparent>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Đã ghim</Text>
            <ScrollView>
              {savedPrompts.length === 0 && (
                <Text style={styles.emptySub}>Chưa có câu hỏi ghim.</Text>
              )}
              {savedPrompts.map((p) => (
                <View key={p.id} style={styles.sheetRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowPins(false);
                      sendQuestion(p.body);
                    }}
                  >
                    <Text style={styles.sheetRowTitle}>{p.title}</Text>
                    <Text style={styles.sheetRowBody} numberOfLines={2}>
                      {p.body}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.pinActions}>
                    <TouchableOpacity
                      onPress={() => {
                        setPinDraftTitle(p.title);
                        setPinDraftBody(p.body);
                      }}
                    >
                      <Text style={styles.pinActionText}>Sửa vào form</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        Alert.alert('Xóa ghim?', undefined, [
                          { text: 'Hủy', style: 'cancel' },
                          {
                            text: 'Xóa',
                            style: 'destructive',
                            onPress: async () => {
                              await deleteAiSavedPrompt(p.id);
                              reloadPins();
                            },
                          },
                        ])
                      }
                    >
                      <Text style={[styles.pinActionText, { color: colors.pink[400] }]}>
                        Xóa
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <Text style={styles.sheetSection}>Ghim câu hỏi mới</Text>
              <TextInput
                style={styles.pinInput}
                placeholder="Tiêu đề"
                placeholderTextColor={colors.neutral[400]}
                value={pinDraftTitle}
                onChangeText={setPinDraftTitle}
              />
              <TextInput
                style={[styles.pinInput, { minHeight: 64 }]}
                placeholder="Nội dung câu hỏi"
                placeholderTextColor={colors.neutral[400]}
                value={pinDraftBody}
                onChangeText={setPinDraftBody}
                multiline
              />
              <TouchableOpacity
                style={styles.sheetClose}
                onPress={async () => {
                  if (!pinDraftTitle.trim() || !pinDraftBody.trim()) return;
                  const existing = savedPrompts.find(
                    (p) => p.title === pinDraftTitle.trim() || p.body === pinDraftBody.trim(),
                  );
                  if (existing) {
                    await updateAiSavedPrompt(existing.id, {
                      title: pinDraftTitle.trim(),
                      body: pinDraftBody.trim(),
                    });
                  } else {
                    await createAiSavedPrompt({
                      title: pinDraftTitle.trim(),
                      body: pinDraftBody.trim(),
                    });
                  }
                  setPinDraftTitle('');
                  setPinDraftBody('');
                  reloadPins();
                }}
              >
                <Text style={styles.sheetCloseText}>Lưu ghim (không chạy)</Text>
              </TouchableOpacity>
            </ScrollView>
            <TouchableOpacity style={styles.sheetClose} onPress={() => setShowPins(false)}>
              <Text style={styles.sheetCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* History */}
      <Modal visible={showHistory} animationType="slide" transparent>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Hội thoại gần đây</Text>
            <ScrollView>
              {threads.map((t) => (
                <View key={t.id} style={styles.sheetRow}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => openThread(t.id)}>
                    <Text style={styles.sheetRowTitle}>{t.title ?? 'Chat chi tiêu'}</Text>
                    <Text style={styles.sheetRowBody}>
                      {MONTH_NAMES[t.anchor_month]}/{t.anchor_year}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDeleteThread(t.id)}>
                    <Text style={[styles.pinActionText, { color: colors.pink[400] }]}>Xóa</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.sheetClose} onPress={() => setShowHistory(false)}>
              <Text style={styles.sheetCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Evidence drill-down */}
      <Modal visible={evidenceIds != null} animationType="slide" transparent>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Giao dịch liên quan</Text>
            <ScrollView>
              {evidenceRows.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.sheetRow}
                  onPress={() => {
                    setEvidenceIds(null);
                    router.push({ pathname: '/form', params: { id: String(t.id) } });
                  }}
                >
                  <Text style={styles.sheetRowTitle}>
                    {t.categoryName ?? 'Không rõ'} · {fmt(t.amount)}
                  </Text>
                  <Text style={styles.sheetRowBody}>
                    {t.date} · {t.sourceName ?? '—'} · {t.note ?? ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.sheetClose} onPress={() => setEvidenceIds(null)}>
              <Text style={styles.sheetCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors, shadows: ThemeShadows) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background.primary },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: Spacing.base,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
      gap: 8,
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: {
      fontSize: Typography.fontSize.base,
      fontWeight: '700',
      color: colors.neutral[800],
    },
    monthRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
    monthLabel: { fontSize: Typography.fontSize.sm, color: colors.neutral[500], fontWeight: '600' },
    monthArrow: { fontSize: 22, color: colors.action.primaryBackground, fontWeight: '700' },
    headerActions: { gap: 4 },
    headerBtn: { paddingVertical: 4, paddingHorizontal: 6 },
    headerBtnText: { color: colors.action.primaryBackground, fontWeight: '600', fontSize: 13 },
    presetScroll: { maxHeight: 44 },
    presetRow: { paddingHorizontal: Spacing.base, gap: 8, alignItems: 'center' },
    presetChip: {
      backgroundColor: colors.background.surface,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.ui.cardBorder,
    },
    presetChipMuted: {
      backgroundColor: colors.background.primary,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.ui.cardBorder,
    },
    presetChipText: { fontSize: 12, color: colors.neutral[700], fontWeight: '600' },
    listContent: { padding: Spacing.base, paddingBottom: 24, flexGrow: 1 },
    empty: { paddingTop: 48, alignItems: 'center', gap: 8 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral[700] },
    emptySub: {
      fontSize: 13,
      color: colors.neutral[400],
      textAlign: 'center',
      paddingHorizontal: 24,
    },
    bubbleWrap: { marginBottom: 12, maxWidth: '92%' },
    bubbleWrapUser: { alignSelf: 'flex-end' },
    bubbleWrapAi: { alignSelf: 'flex-start' },
    bubble: {
      borderRadius: 16,
      padding: 12,
      ...shadows.soft,
    },
    bubbleUser: { backgroundColor: colors.action.primaryBackground },
    bubbleAi: {
      backgroundColor: colors.background.surface,
      borderWidth: 1,
      borderColor: colors.ui.cardBorder,
    },
    bubbleError: { borderColor: colors.pink[400] },
    bubbleText: { fontSize: 14, color: colors.neutral[800], lineHeight: 20 },
    bubbleTextUser: { color: colors.action.primaryText },
    evidenceChip: {
      marginTop: 10,
      alignSelf: 'flex-start',
      backgroundColor: colors.background.primary,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.ui.cardBorder,
    },
    evidenceChipText: { fontSize: 12, fontWeight: '700', color: colors.action.primaryBackground },
    followUpRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    followUpChip: {
      backgroundColor: colors.background.primary,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.ui.cardBorder,
    },
    followUpText: { fontSize: 12, color: colors.neutral[600] },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: Spacing.base,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.ui.cardBorder,
      backgroundColor: colors.background.primary,
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.ui.cardBorder,
      backgroundColor: colors.background.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.neutral[800],
      fontSize: 14,
    },
    sendBtn: {
      backgroundColor: colors.action.primaryBackground,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    sendBtnDisabled: { opacity: 0.45 },
    sendBtnText: { color: colors.action.primaryText, fontWeight: '700' },
    sheetBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      maxHeight: '78%',
      backgroundColor: colors.background.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: Spacing.base,
      gap: 8,
    },
    sheetTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.neutral[800],
      marginBottom: 4,
    },
    sheetSection: {
      marginTop: 12,
      marginBottom: 6,
      fontWeight: '700',
      color: colors.neutral[600],
    },
    sheetRow: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.ui.cardBorder,
      gap: 4,
    },
    sheetRowTitle: { fontSize: 14, fontWeight: '600', color: colors.neutral[800] },
    sheetRowBody: { fontSize: 12, color: colors.neutral[500] },
    sheetClose: {
      marginTop: 8,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.action.primaryBackground,
    },
    sheetCloseText: { color: colors.action.primaryText, fontWeight: '700' },
    pinActions: { flexDirection: 'row', gap: 16, marginTop: 6 },
    pinActionText: { fontSize: 12, fontWeight: '600', color: colors.action.primaryBackground },
    pinInput: {
      borderWidth: 1,
      borderColor: colors.ui.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: colors.neutral[800],
      marginBottom: 8,
    },
  });
}
