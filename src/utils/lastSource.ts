import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SOURCE_KEY = '@yuedaily/last_source_id';

/** Nguồn chi chọn gần nhất — convenience, không phải AI inference. */
export async function getLastSelectedSourceId(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SOURCE_KEY);
    if (!raw) return null;
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export async function setLastSelectedSourceId(id: number): Promise<void> {
  if (!Number.isInteger(id) || id < 1) return;
  try {
    await AsyncStorage.setItem(LAST_SOURCE_KEY, String(id));
  } catch {
    // ignore storage failures — form vẫn lưu được
  }
}
