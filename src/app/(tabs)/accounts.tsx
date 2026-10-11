import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HouseholdFoodBudgetCard } from '../../components/budget/HouseholdFoodBudgetCard';
import { HouseholdFoodBudgetDetailSheet } from '../../components/budget/HouseholdFoodBudgetDetailSheet';
import { VpBankBalanceCard } from '../../components/budget/VpBankBalanceCard';
import { VpBankBalanceDetailSheet } from '../../components/budget/VpBankBalanceDetailSheet';
import { Spacing, ThemeColors, ThemeShadows, Typography } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';
import {
  ensureContinuingHouseholdFoodBudgetPeriod,
  loadHouseholdFoodBudgetHomeCard,
  type HouseholdFoodBudgetHomeCardData,
} from '../../database/householdFoodBudgetRead';
import {
  ensureVpBankBalancePeriod,
  loadVpBankBalanceHomeCard,
  type VpBankBalanceHomeCardData,
} from '../../database/trackedSourceBalanceRead';
import { todayLocal } from '../../utils/date';

export default function AccountsScreen() {
  const { colors, shadows } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);
  const [budgetCard, setBudgetCard] = useState<HouseholdFoodBudgetHomeCardData | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [budgetDetailVisible, setBudgetDetailVisible] = useState(false);
  const [budgetDetailPeriodId, setBudgetDetailPeriodId] = useState<number | null>(null);
  const [vpBankCard, setVpBankCard] = useState<VpBankBalanceHomeCardData | null>(null);
  const [vpBankLoading, setVpBankLoading] = useState(true);
  const [vpBankDetailVisible, setVpBankDetailVisible] = useState(false);
  const [vpBankDetailPeriodId, setVpBankDetailPeriodId] = useState<number | null>(null);
  const [vpBankPreferOpeningEdit, setVpBankPreferOpeningEdit] = useState(false);

  const loadBudgetCard = useCallback(async () => {
    setBudgetLoading(true);
    try {
      const referenceDate = todayLocal();
      await ensureContinuingHouseholdFoodBudgetPeriod(referenceDate);
      const card = await loadHouseholdFoodBudgetHomeCard(referenceDate);
      setBudgetCard(card);
    } catch (err) {
      console.error(err);
      setBudgetCard(null);
    } finally {
      setBudgetLoading(false);
    }
  }, []);

  const loadVpBankCard = useCallback(async () => {
    setVpBankLoading(true);
    try {
      const referenceDate = todayLocal();
      await ensureVpBankBalancePeriod(referenceDate);
      const card = await loadVpBankBalanceHomeCard(referenceDate);
      setVpBankCard(card);
    } catch (err) {
      console.error(err);
      setVpBankCard(null);
    } finally {
      setVpBankLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBudgetCard();
      loadVpBankCard();
    }, [loadBudgetCard, loadVpBankCard])
  );

  const openBudgetDetail = useCallback(() => {
    const periodId = budgetCard?.period?.id ?? budgetCard?.upcomingPeriod?.id ?? null;
    if (!periodId) return;
    setBudgetDetailPeriodId(periodId);
    setBudgetDetailVisible(true);
  }, [budgetCard]);

  const openVpBankDetail = useCallback((preferOpening = false) => {
    const periodId = vpBankCard?.period?.id ?? null;
    if (!periodId) return;
    setVpBankDetailPeriodId(periodId);
    setVpBankPreferOpeningEdit(preferOpening);
    setVpBankDetailVisible(true);
  }, [vpBankCard]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Quỹ</Text>
          <Text style={styles.headerSub}>Ngân sách ăn uống và số dư tài khoản theo dõi</Text>
        </View>

        <View style={styles.fundSection}>
          <HouseholdFoodBudgetCard
            data={budgetCard}
            loading={budgetLoading}
            onPress={
              budgetCard?.period || budgetCard?.upcomingPeriod ? openBudgetDetail : undefined
            }
          />
          <VpBankBalanceCard
            data={vpBankCard}
            loading={vpBankLoading}
            onPress={vpBankCard?.period ? () => openVpBankDetail(false) : undefined}
            onEnterOpeningBalance={
              vpBankCard?.period ? () => openVpBankDetail(true) : undefined
            }
          />
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      <HouseholdFoodBudgetDetailSheet
        visible={budgetDetailVisible}
        periodId={budgetDetailPeriodId}
        onClose={() => setBudgetDetailVisible(false)}
        onUpdated={loadBudgetCard}
      />
      <VpBankBalanceDetailSheet
        visible={vpBankDetailVisible}
        periodId={vpBankDetailPeriodId}
        preferOpeningEdit={vpBankPreferOpeningEdit}
        onClose={() => {
          setVpBankDetailVisible(false);
          setVpBankPreferOpeningEdit(false);
        }}
        onUpdated={loadVpBankCard}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors, shadows: ThemeShadows) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    scroll: { padding: Spacing.base, gap: Spacing.base },

    header: {
      paddingVertical: Spacing.sm,
      gap: 2,
    },
    headerTitle: {
      fontSize: Typography.fontSize.lg,
      fontWeight: '800',
      color: colors.neutral[700],
    },
    headerSub: {
      fontSize: Typography.fontSize.sm,
      fontWeight: '500',
      color: colors.neutral[500],
    },

    fundSection: {
      gap: Spacing.sm,
    },
  });
}
