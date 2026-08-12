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

const { width: SW, height: SH } = Dimensions.get('window');
const PREVIEW_W = SW - Spacing.base * 2;
const PREVIEW_H = PREVIEW_W * 1.15;

// ─── Web: chọn file từ máy ────────────────────────────────────────────────────
function WebImagePicker() {
  const { colors } = useAppTheme();
  const webStyles = useMemo(() => createWebStyles(colors), [colors]);
  const router = useRouter();
  const { transactionDate } = useLocalSearchParams<{ transactionDate?: string }>();
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const formParams = {
    isFromPending: 'false',
    ...(transactionDate ? { transactionDate } : {}),
  };

  const navigateToForm = useCallback((uri: string) => {
    router.push({ pathname: '/form', params: { imageUri: uri, ...formParams } });
  }, [router, formParams]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    navigateToForm(url);
  }, [navigateToForm]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    navigateToForm(url);
  }, [navigateToForm]);

  const handleSkip = useCallback(() => {
    router.push({ pathname: '/form', params: formParams });
  }, [router, formParams]);

  return (
    <View style={webStyles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <SafeAreaView edges={['top']} style={webStyles.header}>
        <TouchableOpacity style={webStyles.cancelBtn} onPress={() => router.back()}>
          <Text style={webStyles.cancelText}>Hủy</Text>
        </TouchableOpacity>
        <Text style={webStyles.headerTitle}>Chọn ảnh hoá đơn</Text>
        <View style={{ width: 52 }} />
      </SafeAreaView>

      {/* Drop zone */}
      <View style={webStyles.body}>
        {/* @ts-ignore - web-only div props */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 32,
            padding: 24,
          }}
          onDragOver={(e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {/* Drop zone card */}
          {/* @ts-ignore */}
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              minHeight: 240,
              borderRadius: 24,
              border: `2px dashed ${isDragging ? colors.action.primaryPressed : colors.action.primaryBackground + '73'}`,
              backgroundColor: isDragging ? colors.action.primaryBackground + '14' : 'rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onClick={() => inputRef.current?.click()}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="preview"
                style={{ width: '100%', height: 240, objectFit: 'contain', borderRadius: 20 }}
              />
            ) : (
              <>
                <Text style={webStyles.dropIcon}>🖼️</Text>
                <Text style={webStyles.dropTitle}>
                  {isDragging ? 'Thả ảnh vào đây' : 'Kéo & thả ảnh vào đây'}
                </Text>
                <Text style={webStyles.dropSub}>hoặc bấm để chọn từ máy tính</Text>
                <Text style={webStyles.dropHint}>Hỗ trợ: JPG, PNG, WEBP, HEIC</Text>
              </>
            )}
          </div>

          {/* Nút chọn file */}
          <TouchableOpacity style={webStyles.selectBtn} onPress={() => inputRef.current?.click()} activeOpacity={0.8}>
            <Text style={webStyles.selectBtnText}>📂 Chọn ảnh từ máy tính</Text>
          </TouchableOpacity>

          {/* Skip */}
          <TouchableOpacity style={webStyles.skipBtn} onPress={handleSkip} activeOpacity={0.8}>
            <Text style={webStyles.skipText}>Bỏ qua, nhập thủ công</Text>
          </TouchableOpacity>
        </div>
      </View>

      {/* Hidden file input */}
      {/* @ts-ignore */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        aria-label="Chọn ảnh từ máy tính"
        title="Chọn ảnh từ máy tính"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </View>
  );
}

// ─── Native: camera ───────────────────────────────────────────────────────────
export default function CameraScreen() {
  // Render web UI on web
  if (Platform.OS === 'web') {
    return <WebImagePicker />;
  }
  return <NativeCameraScreen />;
}

function NativeCameraScreen() {
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
        setLastThumb(photo.uri);
        router.push({ pathname: '/form', params: { imageUri: photo.uri, ...formParams } });
      }
    } catch (err) {
      console.error('Lỗi chụp ảnh:', err);
    } finally {
      setIsTakingPhoto(false);
    }
  }, [isTakingPhoto, router, formParams]);

  const handleGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setLastThumb(uri);
      router.push({ pathname: '/form', params: { imageUri: uri, ...formParams } });
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

function createWebStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  cancelBtn: { paddingVertical: Spacing.sm, paddingRight: Spacing.sm, minWidth: 52 },
  cancelText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.base,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  body: { flex: 1 },
  dropIcon: { fontSize: 56 },
  dropTitle: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  dropSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
  },
  dropHint: {
    color: colors.action.secondaryText,
    fontSize: Typography.fontSize.xs,
    textAlign: 'center',
  },
  selectBtn: {
    backgroundColor: colors.action.primaryBackground,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: BorderRadius.full,
  },
  selectBtnText: {
    color: colors.action.primaryText,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  skipBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  skipText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: Typography.fontSize.sm,
    textDecorationLine: 'underline',
  },
});
}

// ─── Native styles ────────────────────────────────────────────────────────────
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
  iconBtnText: { fontSize: 16 },

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
    fontSize: 12,
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
