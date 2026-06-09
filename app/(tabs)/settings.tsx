import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { YozakuraLogo } from '../../components/YozakuraLogo';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStreak } from '../../hooks/useStreak';

export default function SettingsScreen() {
  const { streak } = useStreak();

  const streakCount = streak?.current_streak ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* === PROFILE HERO === */}
        <View style={styles.profileSection}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <YozakuraLogo size={72} bgColor={Colors.background.primary} />
            </View>
            {streakCount > 0 && (
              <View style={styles.streakRing}>
                <Text style={styles.streakRingText}>🔥</Text>
              </View>
            )}
          </View>
          <Text style={styles.profileName}>Yozakura</Text>
          <Text style={styles.profileTagline}>夜桜 · Quản lý chi tiêu dễ thương 🌸</Text>

          {streakCount > 0 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakBadgeText}>🔥 {streakCount} ngày liên tiếp</Text>
            </View>
          )}
        </View>

        {/* === STATS OVERVIEW === */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statValue}>{streakCount}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🔒</Text>
            <Text style={styles.statValue}>100%</Text>
            <Text style={styles.statLabel}>Bảo mật</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>📱</Text>
            <Text style={styles.statValue}>v1.0</Text>
            <Text style={styles.statLabel}>Phiên bản</Text>
          </View>
        </View>

        {/* === APP INFO === */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ℹ️ Về ứng dụng</Text>
          <View style={styles.card}>
            {[
              { label: 'Tên ứng dụng', value: 'Yozakura' },
              { label: 'Phiên bản', value: '1.0.0' },
              { label: 'Lưu trữ', value: '100% trên thiết bị' },
              { label: 'Server', value: 'Không có' },
            ].map((row, idx, arr) => (
              <View key={row.label}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </View>
                {idx < arr.length - 1 && <View style={styles.infoDivider} />}
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.primary },
  scroll: { padding: Spacing.base, gap: Spacing.lg },

  profileSection: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  avatarWrap: { position: 'relative', marginBottom: 4 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.pink[100],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.pink[200],
    ...Shadows.medium,
  },
  avatarEmoji: { fontSize: 44 },
  streakRing: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.yellow[100],
    borderWidth: 2,
    borderColor: Colors.yellow[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakRingText: { fontSize: 14 },
  profileName: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
    color: Colors.neutral[700],
  },
  profileTagline: {
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[400],
  },
  streakBadge: {
    backgroundColor: Colors.yellow[100],
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: Colors.yellow[200],
  },
  streakBadgeText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.neutral[600],
  },

  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.background.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    ...Shadows.soft,
  },
  statEmoji: { fontSize: 22 },
  statValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: '800',
    color: Colors.neutral[700],
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.neutral[400],
    fontWeight: '500',
  },

  section: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: Colors.neutral[700],
  },
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    ...Shadows.soft,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  infoLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[500],
    fontWeight: '500',
  },
  infoValue: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.neutral[700],
  },
  infoDivider: {
    height: 1,
    backgroundColor: Colors.neutral[100],
  },
});
