// ============================================================
// NÚT CHỤP ẢNH TO TRÒN DỄ THƯƠNG - TRUNG TÂM MÀN HÌNH CAMERA
// ============================================================

import React, { useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { ThemeColors } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';

interface CaptureButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export function CaptureButton({ onPress, disabled = false }: CaptureButtonProps) {
  const { colors, resolvedColorScheme } = useAppTheme();
  const styles = useMemo(
    () => createStyles(colors, resolvedColorScheme),
    [colors, resolvedColorScheme],
  );
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 30,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.outerRing}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            disabled && styles.buttonDisabled,
          ]}
        >
          <View style={styles.innerRing} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function createStyles(colors: ThemeColors, scheme: 'light' | 'dark') {
  const isDark = scheme === 'dark';
  return StyleSheet.create({
    wrapper: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    outerRing: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.camera.captureRing,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: colors.blue[300] + '4D',
    },
    button: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.camera.captureButton,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: isDark ? '#0A0E18' : colors.blue[600],
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.28 : 0.14,
      shadowRadius: isDark ? 6 : 8,
      elevation: isDark ? 3 : 4,
    },
    buttonPressed: {
      // Muted darker — không sáng hơn nền
      backgroundColor: isDark ? colors.pink[200] : colors.pink[500],
    },
    buttonDisabled: {
      backgroundColor: colors.neutral[300],
      shadowOpacity: 0,
    },
    innerRing: {
      width: 52,
      height: 52,
      borderRadius: 26,
      borderWidth: 3,
      borderColor: colors.camera.captureButtonInner,
      backgroundColor: 'transparent',
    },
  });
}
