// ============================================================
// NÚT CHỤP ẢNH TO TRÒN DỄ THƯƠNG - TRUNG TÂM MÀN HÌNH CAMERA
// ============================================================

import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Colors } from '../../constants/theme';

interface CaptureButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export function CaptureButton({ onPress, disabled = false }: CaptureButtonProps) {
  // Animation nhấn nút - scale nhẹ khi bấm
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
      {/* Vòng ngoài - hiệu ứng glow */}
      <View style={styles.outerRing}>
        {/* Thân nút chính */}
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
          {/* Vòng trắng bên trong */}
          <View style={styles.innerRing} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.camera.captureRing,
    alignItems: 'center',
    justifyContent: 'center',
    // Hiệu ứng viền pastel mờ
    borderWidth: 3,
    borderColor: 'rgba(255, 143, 171, 0.3)',
  },
  button: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.camera.captureButton,
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow nhẹ
    shadowColor: '#FF8FAB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonPressed: {
    backgroundColor: Colors.pink[500],
  },
  buttonDisabled: {
    backgroundColor: Colors.neutral[300],
    shadowOpacity: 0,
  },
  innerRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: Colors.camera.captureButtonInner,
    backgroundColor: 'transparent',
  },
});
