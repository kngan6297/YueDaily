import Ionicons from '@expo/vector-icons/Ionicons';
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
      accessibilityRole="button"
      accessibilityLabel="Thêm chi tiêu"
    >
      <Ionicons name="add" size={30} color={colors.action.fabIcon} />
    </TouchableOpacity>
  );
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ icon, label, focused, badge }: {
  icon: IoniconName;
  label: string;
  focused: boolean;
  badge?: number;
}) {
  const { colors, shadows } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);
  return (
    <View style={styles.tabItem}>
      <View>
        <Ionicons
          name={focused ? icon : (`${icon}-outline` as IoniconName)}
          size={24}
          color={focused ? colors.action.selectedText : colors.neutral[400]}
        />
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
            <TabIcon icon="home" label="Trang chủ" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="stats-chart" label="Thống kê" focused={focused} />
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
            <TabIcon icon="wallet" label="Quỹ" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="settings" label="Cài đặt" focused={focused} />
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
      ...StyleSheet.absoluteFill,
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
    tabLabel: {
      fontSize: Typography.fontSize.xs,
      fontWeight: '600',
      color: colors.neutral[400],
    },
    tabLabelActive: {
      color: colors.action.selectedText,
      fontWeight: '700',
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
      fontSize: Typography.fontSize['2xs'],
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
  });
}
