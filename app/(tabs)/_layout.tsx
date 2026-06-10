import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BorderRadius, Colors, Spacing } from '../../constants/theme';

const TAB_BAR_HEIGHT = 60;
const TAB_BAR_FLOAT_GAP = 12;

function CameraTabButton() {
  const router = useRouter();
  return (
    <View style={styles.cameraFabSlot}>
      <TouchableOpacity
        style={styles.cameraFab}
        onPress={() => router.push('/camera')}
        activeOpacity={0.85}
      >
        <Text style={styles.cameraFabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function TabIcon({ emoji, label, focused, badge }: {
  emoji: string;
  label: string;
  focused: boolean;
  badge?: number;
}) {
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
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        sceneStyle: {
          paddingBottom: TAB_BAR_HEIGHT + insets.bottom + TAB_BAR_FLOAT_GAP,
        },
        tabBarItemStyle: styles.tabBarItem,
        tabBarStyle: [
          styles.tabBar,
          {
            position: 'absolute',
            bottom: insets.bottom + TAB_BAR_FLOAT_GAP,
            left: Spacing.base,
            right: Spacing.base,
            height: TAB_BAR_HEIGHT,
          },
        ],
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
          tabBarButton: () => <CameraTabButton />,
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
            <TabIcon emoji="👤" label="Cá nhân" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.pink[50],
    borderTopWidth: 0,
    borderRadius: BorderRadius['2xl'],
    shadowColor: Colors.neutral[700],
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  tabBarItem: {
    height: TAB_BAR_HEIGHT,
    justifyContent: 'center',
  },
  tabItem: {
    alignItems: 'center',
    gap: 3,
    width: 64,
  },
  tabEmoji: {
    fontSize: 22,
    opacity: 0.45,
  },
  tabEmojiActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.neutral[400],
  },
  tabLabelActive: {
    color: Colors.pink[400],
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -8,
    backgroundColor: Colors.pink[400],
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  cameraFabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: TAB_BAR_HEIGHT,
  },
  cameraFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.pink[400],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.pink[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  cameraFabIcon: {
    fontSize: 30,
    color: '#FFFFFF',
    fontWeight: '300',
    lineHeight: 34,
    marginTop: -2,
  },
});
