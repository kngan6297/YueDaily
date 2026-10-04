import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SOURCE_KEY = '@yuedaily/last_source_id';

/**
 * Nguồn chi chọn gần nhất — convenience, không phải AI inference.
 * Stores opaque id string (native integer as decimal string, or UUID).
 */
export async function getLastSelectedSourceId(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SOURCE_KEY);
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export async function setLastSelectedSourceId(id: string | number): Promise<void> {
  const raw = String(id).trim();
  if (!raw) return;
  try {
    await AsyncStorage.setItem(LAST_SOURCE_KEY, raw);
  } catch {
    // ignore storage failures — form vẫn lưu được
  }
}

/** Clear on sign-out so Web User B never inherits User A's source id. */
export async function clearLastSelectedSourceId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_SOURCE_KEY);
  } catch {
    // ignore
  }
}
