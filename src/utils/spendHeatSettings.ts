import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_SPEND_THRESHOLDS,
  isValidThresholds,
  type SpendThresholds,
} from './spendHeat';

const SPEND_THRESHOLDS_KEY = '@yuedaily/spend_heat_thresholds';

export async function getSpendThresholds(): Promise<SpendThresholds> {
  try {
    const raw = await AsyncStorage.getItem(SPEND_THRESHOLDS_KEY);
    if (!raw) return DEFAULT_SPEND_THRESHOLDS;
    const parsed = JSON.parse(raw) as SpendThresholds;
    return isValidThresholds(parsed) ? parsed : DEFAULT_SPEND_THRESHOLDS;
  } catch {
    return DEFAULT_SPEND_THRESHOLDS;
  }
}

export async function setSpendThresholds(t: SpendThresholds): Promise<void> {
  try {
    await AsyncStorage.setItem(SPEND_THRESHOLDS_KEY, JSON.stringify(t));
  } catch {
    // ignore — lịch vẫn dùng giá trị trong bộ nhớ
  }
}
