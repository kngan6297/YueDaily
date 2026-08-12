import React, { useEffect, useId, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  ModalProps,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { BorderRadius, ThemeColors } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';
import { useModalBottomInset } from '../../hooks/useModalBottomInset';
import { useBottomSheetPortal } from './BottomSheetPortal';

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  sheetStyle?: ViewStyle;
  animationType?: ModalProps['animationType'];
  /** Bật khi sheet có TextInput (modal thêm danh mục…) */
  keyboardAvoiding?: boolean;
}

function BottomSheetModalContent({
  onClose,
  children,
  sheetStyle,
  animationType = 'slide',
  keyboardAvoiding = false,
}: Omit<BottomSheetModalProps, 'visible'>) {
  const bottomInset = useModalBottomInset();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const sheet = (
    <View style={[styles.sheet, { paddingBottom: bottomInset }, sheetStyle]}>
      {children}
    </View>
  );

  return (
    <Modal
      visible
      transparent
      animationType={animationType}
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.container}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        {keyboardAvoiding ? (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            {sheet}
          </KeyboardAvoidingView>
        ) : (
          sheet
        )}
      </View>
    </Modal>
  );
}

/** Bottom sheet root-level — che tab bar, padding đáy = navbar hệ thống */
export function BottomSheetModal({
  visible,
  onClose,
  children,
  sheetStyle,
  animationType,
  keyboardAvoiding,
}: BottomSheetModalProps) {
  const portal = useBottomSheetPortal();
  const id = useId();

  useEffect(() => {
    if (!visible) {
      portal?.unmount(id);
      return;
    }

    if (portal) {
      portal.mount(
        id,
        <BottomSheetModalContent
          onClose={onClose}
          sheetStyle={sheetStyle}
          animationType={animationType}
          keyboardAvoiding={keyboardAvoiding}
        >
          {children}
        </BottomSheetModalContent>,
      );
      return () => portal.unmount(id);
    }
  }, [visible, id, portal, onClose, children, sheetStyle, animationType, keyboardAvoiding]);

  if (portal) return null;

  if (!visible) return null;

  return (
    <BottomSheetModalContent
      onClose={onClose}
      sheetStyle={sheetStyle}
      animationType={animationType}
      keyboardAvoiding={keyboardAvoiding}
    >
      {children}
    </BottomSheetModalContent>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.background.overlay,
    },
    sheet: {
      backgroundColor: colors.background.modal,
      borderTopLeftRadius: BorderRadius['2xl'],
      borderTopRightRadius: BorderRadius['2xl'],
      paddingTop: 12,
      maxHeight: '70%',
    },
  });
}
