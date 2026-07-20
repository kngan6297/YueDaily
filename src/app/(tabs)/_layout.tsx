import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BorderRadius, Colors, Typography } from '../../constants/theme';
import { TAB_BAR_CONTENT_HEIGHT } from '../../constants/layout';

function TabBarBackground() {
  return <View style={styles.tabBarBackground} />;
}

function CameraTabButton() {
  const router = useRouter();
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

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        sceneStyle: { backgroundColor: Colors.background.primary },
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

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    paddingTop: 10,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBarBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background.surface,
    shadowColor: Colors.pink[400],
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
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
    color: Colors.neutral[400],
  },
  tabLabelActive: {
    color: Colors.pink[500],
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
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  cameraFab: {
    width: 48,
    height: 48,
    marginTop: -20,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.pink[400],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.pink[500],
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 6,
  },
  cameraFabIcon: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
    lineHeight: 32,
    marginTop: -1,
  },
});
