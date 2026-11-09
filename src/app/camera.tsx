import { CameraType, CameraView, FlashMode, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  Dimensions,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaptureButton } from '../components/camera/CaptureButton';
import { BorderRadius, Spacing, ThemeColors, Typography } from '../constants/theme';
import { useAppTheme } from '../context/ThemeContext';
import { copyReceiptUriToPrepCache } from '../services/receiptAi/normalizeReceiptUri';
import {
  setPendingReceiptImage,
} from '../services/receiptAi/pendingReceiptImage';
import { receiptAiDevLog } from '../services/receiptAi/devLog';

const { width: SW, height: SH } = Dimensions.get('window');
const PREVIEW_W = SW - Spacing.base * 2;
const PREVIEW_H = PREVIEW_W * 1.15;

// ─── Native: camera ───────────────────────────────────────────────────────────
export default function CameraScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { transactionDate } = useLocalSearchParams<{ transactionDate?: string }>();
  const cameraRef = useRef<CameraView>(null);

  const formParams = {
    isFromPending: 'false' as const,
    ...(transactionDate ? { transactionDate } : {}),
  };

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraFacing, setCameraFacing] = useState<CameraType>('back');
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [lastThumb, setLastThumb] = useState<string | null>(null);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isTakingPhoto) return;
    setIsTakingPhoto(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: false,
        skipProcessing: false,
        shutterSound: false,
      });
      if (photo?.uri) {
        let navUri = photo.uri;
        try {
          const copied = await copyReceiptUriToPrepCache(photo.uri);
          navUri = copied.uri;
          setPendingReceiptImage({ uri: copied.uri, size: copied.size });
          receiptAiDevLog('prep_ready', { source: 'camera' });
        } catch (copyErr) {
          receiptAiDevLog('prep_fail', { source: 'camera' });
          console.warn('[ReceiptAI] camera prep copy failed; using source URI');
        }
        setLastThumb(navUri);
        router.push({
          pathname: '/form',
          params: { imageUri: navUri, imageHandoff: '1', ...formParams },
        });
      }
    } catch (err) {
      console.error('Lỗi chụp ảnh:', err);
    } finally {
      setIsTakingPhoto(false);
    }
  }, [isTakingPhoto, router, formParams]);

  const handleGallery = useCallback(async () => {
    // System photo picker — no media permission needed (expo-image-picker docs).
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.uri;
      let navUri = uri;
      try {
        const copied = await copyReceiptUriToPrepCache(uri);
        navUri = copied.uri;
        setPendingReceiptImage({ uri: copied.uri, size: copied.size });
        receiptAiDevLog('prep_ready', { source: 'gallery' });
      } catch {
        receiptAiDevLog('prep_fail', { source: 'gallery' });
        console.warn('[ReceiptAI] gallery prep copy failed; using source URI');
      }
      setLastThumb(navUri);
      router.push({
        pathname: '/form',
        params: { imageUri: navUri, imageHandoff: '1', ...formParams },
      });
    }
  }, [router, formParams]);

  const handleSkip = useCallback(() => {
    router.push({ pathname: '/form', params: formParams });
  }, [router, formParams]);

  const flashLabel = flashMode === 'on' ? '⚡' : flashMode === 'auto' ? '🌟' : '💡';

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permContainer}>
        <TouchableOpacity style={styles.closeTop} onPress={() => router.back()}>
          <Text style={styles.closeTopText}>Hủy</Text>
        </TouchableOpacity>
        <Text style={styles.permEmoji}>📷</Text>
        <Text style={styles.permTitle}>Cần quyền Camera</Text>
        <Text style={styles.permDesc}>Để chụp ảnh hoá đơn nhanh chóng!</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Cấp quyền Camera</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* === TOP BAR === */}
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Hủy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, flashMode !== 'off' && styles.iconBtnActive]}
          onPress={() => setFlashMode((p) => p === 'off' ? 'on' : p === 'on' ? 'auto' : 'off')}
        >
          <Text style={styles.iconBtnText}>{flashLabel}</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* === CAMERA PREVIEW — rounded rect === */}
      <View style={styles.previewWrap}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={cameraFacing}
          flash={flashMode}
          mute
          animateShutter={false}
        />
        {/* Guide frame — absolute, outside CameraView */}
        <View style={styles.guideWrap} pointerEvents="none">
          <View style={styles.guide}>
            <View style={[styles.corner, styles.cTL]} />
            <View style={[styles.corner, styles.cTR]} />
            <View style={[styles.corner, styles.cBL]} />
            <View style={[styles.corner, styles.cBR]} />
          </View>
          <Text style={styles.guideHint}>Đặt hoá đơn vào đây</Text>
        </View>
      </View>

      {/* === BOTTOM CONTROLS === */}
      <SafeAreaView edges={['bottom']} style={styles.bottomArea}>
        {/* Flip camera + Shutter + Gallery */}
        <View style={styles.shutterRow}>
          <TouchableOpacity
            style={styles.sideBtn}
            onPress={() => setCameraFacing((p) => p === 'back' ? 'front' : 'back')}
            activeOpacity={0.8}
          >
            <Text style={styles.sideBtnIcon}>🔄</Text>
          </TouchableOpacity>

          <CaptureButton onPress={handleCapture} disabled={isTakingPhoto} />

          <TouchableOpacity style={styles.sideBtn} onPress={handleGallery} activeOpacity={0.8}>
            {lastThumb ? (
              <Image source={{ uri: lastThumb }} style={styles.thumbImage} />
            ) : (
              <Text style={styles.sideBtnIcon}>🖼️</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Skip button */}
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.8}>
          <Text style={styles.skipText}>Bỏ qua ảnh</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
  },
  cancelBtn: { paddingVertical: Spacing.sm, paddingRight: Spacing.sm },
  cancelText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.base,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  iconBtnActive: {
    backgroundColor: colors.action.selectedBackground,
    borderColor: colors.action.selectedBorder,
  },
  iconBtnText: { fontSize: Typography.fontSize.base },

  // Camera preview
  previewWrap: {
    position: 'absolute',
    top: SH * 0.1,
    left: Spacing.base,
    right: Spacing.base,
    height: PREVIEW_H,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  camera: { flex: 1 },

  // Guide frame — absolute overlay on top of CameraView
  guideWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  guide: {
    width: 200,
    height: 200,
    borderRadius: 20,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: colors.blue[400],
    borderWidth: 3,
  },
  cTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 10 },
  cTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 10 },
  cBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 10 },
  cBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 10 },
  guideHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Bottom
  bottomArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['3xl'],
    width: '100%',
  },
  sideBtn: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  sideBtnIcon: { fontSize: 24 },
  thumbImage: { width: '100%', height: '100%', resizeMode: 'cover' },

  skipBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  skipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
  },

  // Permission
  permContainer: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['2xl'],
    gap: Spacing.base,
  },
  closeTop: {
    position: 'absolute',
    top: Spacing['2xl'],
    left: Spacing.base,
    padding: Spacing.sm,
  },
  closeTopText: { color: '#fff', fontSize: Typography.fontSize.base, fontWeight: '600' },
  permEmoji: { fontSize: 64 },
  permTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  permDesc: {
    fontSize: Typography.fontSize.base,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 24,
  },
  permBtn: {
    backgroundColor: colors.action.primaryBackground,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  permBtnText: {
    color: colors.action.primaryText,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
});
}
