// ============================================================
// P2.3 — Web "Quét bill": pick/capture photo → resize → Edge AI → Form
// No provider keys in browser. Image never stored or put in router params.
// ============================================================

import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BorderRadius, Spacing, ThemeColors, Typography } from '../constants/theme';
import { useAppTheme } from '../context/ThemeContext';
import { requireSupabaseClient } from '../repositories/requireClient.web';
import { ReceiptAiError } from '../services/receiptAi/errors';
import {
  clearPendingReceiptResult,
  setPendingReceiptResult,
} from '../services/receiptAi/pendingReceiptResult';
import { analyzeReceiptViaEdge } from '../services/receiptAi/webClient';
import { preprocessReceiptFile } from '../services/receiptAi/webPreprocess';

type ScanPhase = 'idle' | 'processing' | 'reading' | 'error';

const GENERIC_ERROR = 'Chưa thể đọc bill lúc này. Bạn vẫn có thể nhập tay.';

function errorMessage(err: unknown): string {
  if (err instanceof ReceiptAiError) return err.message;
  // DataError (missing Supabase config) etc. already carry user-safe Vietnamese text.
  if (err instanceof Error && err.name === 'DataError' && err.message) return err.message;
  return GENERIC_ERROR;
}

export default function CameraWeb() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const pickInputRef = useRef<HTMLInputElement | null>(null);
  const lastFileRef = useRef<File | null>(null);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const replacePreview = useCallback((file: File | null) => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runIdRef.current += 1;
    };
  }, []);

  // Revoke any outstanding preview URL on unmount.
  const previewRef = useRef<string | null>(null);
  previewRef.current = previewUrl;
  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const scanFile = useCallback(
    async (file: File) => {
      const runId = ++runIdRef.current;
      const stale = () => !mountedRef.current || runId !== runIdRef.current;

      setError(null);
      setPhase('processing');
      try {
        const blob = await preprocessReceiptFile(file);
        if (stale()) return;
        setPhase('reading');
        const result = await analyzeReceiptViaEdge(blob, requireSupabaseClient());
        if (stale()) return;
        // Result text only — no image/base64 in handoff or params.
        setPendingReceiptResult(result);
        router.replace({ pathname: '/form', params: { fromReceipt: '1' } });
      } catch (err) {
        if (stale()) return;
        setError(errorMessage(err));
        setPhase('error');
      }
    },
    [router],
  );

  const onFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const file = input.files?.[0] ?? null;
      // Allow re-selecting the same file afterwards.
      input.value = '';
      if (!file) return; // cancel = no-op
      lastFileRef.current = file;
      replacePreview(file);
      void scanFile(file);
    },
    [replacePreview, scanFile],
  );

  const openCapture = useCallback(() => captureInputRef.current?.click(), []);
  const openPicker = useCallback(() => pickInputRef.current?.click(), []);

  const retry = useCallback(() => {
    if (lastFileRef.current) void scanFile(lastFileRef.current);
  }, [scanFile]);

  const goManual = useCallback(() => {
    clearPendingReceiptResult();
    router.replace('/form');
  }, [router]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const busy = phase === 'processing' || phase === 'reading';
  const statusText =
    phase === 'processing'
      ? 'Đang xử lý ảnh...'
      : phase === 'reading'
        ? 'Đang đọc bill...'
        : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={goBack}
          disabled={busy}
          accessibilityLabel="Đóng"
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Quét bill</Text>
        <View style={styles.closeBtn} />
      </View>

      <View style={styles.body}>
        {/* Hidden inputs — click() is invoked synchronously from button presses. */}
        <input
          ref={captureInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFileChange}
          style={hiddenInputStyle}
          data-testid="receipt-capture-input"
        />
        <input
          ref={pickInputRef}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          style={hiddenInputStyle}
          data-testid="receipt-pick-input"
        />

        {previewUrl ? (
          <Image
            source={{ uri: previewUrl }}
            style={styles.preview}
            resizeMode="contain"
            accessibilityLabel="Xem trước bill"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderEmoji}>🧾</Text>
            <Text style={styles.placeholderText}>
              Chụp hoặc chọn ảnh bill để tự điền số tiền và ghi chú.
            </Text>
          </View>
        )}

        {statusText ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={colors.action.primaryBackground} />
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        ) : null}

        {phase === 'error' && error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {phase === 'error' ? (
          <View style={styles.actions}>
            {lastFileRef.current ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={retry} activeOpacity={0.85}>
                <Text style={styles.primaryBtnText}>Thử lại</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.secondaryBtn} onPress={openPicker} activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>Chọn ảnh khác</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkBtn} onPress={goManual} activeOpacity={0.85}>
              <Text style={styles.linkBtnText}>Nhập thủ công</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primaryBtn, busy && styles.btnDisabled]}
              onPress={openCapture}
              disabled={busy}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Chụp bill</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, busy && styles.btnDisabled]}
              onPress={openPicker}
              disabled={busy}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBtnText}>Chọn ảnh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.linkBtn, busy && styles.btnDisabled]}
              onPress={goManual}
              disabled={busy}
              activeOpacity={0.85}
            >
              <Text style={styles.linkBtnText}>Nhập thủ công</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const hiddenInputStyle: React.CSSProperties = {
  display: 'none',
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: BorderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeText: {
      fontSize: Typography.fontSize.lg,
      color: colors.neutral[600],
    },
    title: {
      fontSize: Typography.fontSize.lg,
      fontWeight: '800',
      color: colors.neutral[800],
    },
    body: {
      flex: 1,
      width: '100%',
      maxWidth: 480,
      alignSelf: 'center',
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.lg,
      gap: Spacing.md,
    },
    placeholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.neutral[300],
      backgroundColor: colors.background.surface,
      padding: Spacing.lg,
    },
    placeholderEmoji: {
      fontSize: 40,
    },
    placeholderText: {
      fontSize: Typography.fontSize.sm,
      color: colors.neutral[600],
      textAlign: 'center',
      lineHeight: 20,
    },
    preview: {
      flex: 1,
      borderRadius: BorderRadius.lg,
      backgroundColor: colors.background.surface,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    statusText: {
      fontSize: Typography.fontSize.sm,
      fontWeight: '600',
      color: colors.neutral[700],
    },
    errorBox: {
      borderRadius: BorderRadius.md,
      backgroundColor: colors.background.surface,
      borderWidth: 1,
      borderColor: colors.danger,
      padding: Spacing.md,
    },
    errorText: {
      fontSize: Typography.fontSize.sm,
      color: colors.neutral[700],
      lineHeight: 20,
    },
    actions: {
      gap: Spacing.sm,
    },
    primaryBtn: {
      alignItems: 'center',
      borderRadius: BorderRadius.full,
      backgroundColor: colors.action.primaryBackground,
      paddingVertical: 14,
    },
    primaryBtnText: {
      color: colors.action.primaryText,
      fontWeight: '700',
      fontSize: Typography.fontSize.md,
    },
    secondaryBtn: {
      alignItems: 'center',
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: colors.action.primaryBackground,
      backgroundColor: colors.background.surface,
      paddingVertical: 13,
    },
    secondaryBtnText: {
      color: colors.action.selectedText,
      fontWeight: '700',
      fontSize: Typography.fontSize.md,
    },
    linkBtn: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    linkBtnText: {
      color: colors.neutral[600],
      fontWeight: '600',
      fontSize: Typography.fontSize.sm,
    },
    btnDisabled: {
      opacity: 0.5,
    },
  });
}
