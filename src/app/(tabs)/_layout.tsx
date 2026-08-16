import { Tabs, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BorderRadius, ThemeColors, ThemeShadows, Typography } from '../../constants/theme';
import { TAB_BAR_CONTENT_HEIGHT } from '../../constants/layout';
import { useAppTheme } from '../../context/ThemeContext';

function TabBarBackground() {
  const { colors, shadows } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);
  return <View style={styles.tabBarBackground} />;
}

function CameraTabButton() {
  const router = useRouter();
  const { colors, shadows } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);
  return (
    <TouchableOpacity
      style={styles.cameraFab}
      onPress={() => router.push('/camera')}
      activeOpacity={0.85}
    >
      <Text style={styles.cameraFabIcon}>+</Text>
    </TouchableOpacity>
  );
}

function TabIcon({ emoji, label, focused, badge }: {
  emoji: string;
  label: string;
  focused: boolean;
  badge?: number;
}) {
  const { colors, shadows } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);
  return (
    <View style={styles.tabItem}>
      <View>
        <Text style={[styles.tabEmoji, focused && styles.tabEmojiActive]}>{emoji}</Text>
        {(badge ?? 0) > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);
  const { colors, shadows } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        sceneStyle: { backgroundColor: colors.background.primary },
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: {
          ...styles.tabBar,
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
          paddingBottom: bottomInset,
          overflow: 'visible',
        },
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" label="Trang chủ" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📊" label="Thống kê" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="camera-tab"
        options={{
          tabBarButton: ({ style }) => (
            <View style={[style, styles.cameraFabSlot]}>
              <CameraTabButton />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="💳" label="Tài khoản" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="⚙️" label="Cài đặt" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

function createStyles(colors: ThemeColors, shadows: ThemeShadows) {
  return StyleSheet.create({
    tabBar: {
      backgroundColor: 'transparent',
      borderTopWidth: 0,
      paddingTop: 10,
      elevation: 0,
      shadowOpacity: 0,
    },
    tabBarBackground: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.background.surface,
      shadowColor: shadows.medium.shadowColor,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.10,
      shadowRadius: 10,
      elevation: 8,
    },
    tabBarItem: {
      gap: 2,
    },
    tabBarLabel: {
      fontSize: Typography.fontSize.xs,
      fontWeight: '600',
    },
    tabItem: {
      alignItems: 'center',
      gap: 2,
      width: 64,
    },
    tabEmoji: {
      fontSize: 22,
      opacity: 0.4,
    },
    tabEmojiActive: {
      opacity: 1,
    },
    tabLabel: {
      fontSize: Typography.fontSize.xs,
      fontWeight: '600',
      color: colors.neutral[400],
    },
    tabLabelActive: {
      color: colors.action.selectedText,
    },
    badge: {
      position: 'absolute',
      top: -3,
      right: -8,
      backgroundColor: colors.action.primaryBackground,
      borderRadius: 999,
      minWidth: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: {
      color: colors.action.primaryText,
      fontSize: 9,
      fontWeight: '800',
    },
    cameraFabSlot: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: 4,
    },
    cameraFab: {
      width: 48,
      height: 48,
      marginTop: -20,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.action.fabBackground,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: shadows.medium.shadowColor,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
      elevation: 5,
    },
    cameraFabIcon: {
      fontSize: 28,
      color: colors.action.fabIcon,
      fontWeight: '300',
      lineHeight: 32,
      marginTop: -1,
    },
  });
}
