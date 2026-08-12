import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme, View } from 'react-native';
import {
  APPEARANCE_STORAGE_KEY,
  AppearanceMode,
  BorderRadius,
  palettes,
  ResolvedColorScheme,
  shadowPalettes,
  Spacing,
  ThemeColors,
  ThemeShadows,
  Typography,
} from '../constants/theme';

export interface AppTheme {
  colors: ThemeColors;
  typography: typeof Typography;
  spacing: typeof Spacing;
  borderRadius: typeof BorderRadius;
  shadows: ThemeShadows;
  appearanceMode: AppearanceMode;
  resolvedColorScheme: ResolvedColorScheme;
  setAppearanceMode: (mode: AppearanceMode) => void;
}

const ThemeContext = createContext<AppTheme | null>(null);

function resolveScheme(
  mode: AppearanceMode,
  system: string | null | undefined,
): ResolvedColorScheme {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return system === 'dark' ? 'dark' : 'light';
}

function isAppearanceMode(value: string | null): value is AppearanceMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [appearanceMode, setAppearanceModeState] = useState<AppearanceMode>('system');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(APPEARANCE_STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (isAppearanceMode(stored)) {
          setAppearanceModeState(stored);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setAppearanceMode = useCallback((mode: AppearanceMode) => {
    setAppearanceModeState(mode);
    AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, mode).catch(() => {});
  }, []);

  const resolvedColorScheme = resolveScheme(appearanceMode, systemScheme);

  const value = useMemo<AppTheme>(() => ({
    colors: palettes[resolvedColorScheme],
    typography: Typography,
    spacing: Spacing,
    borderRadius: BorderRadius,
    shadows: shadowPalettes[resolvedColorScheme],
    appearanceMode,
    resolvedColorScheme,
    setAppearanceMode,
  }), [appearanceMode, resolvedColorScheme, setAppearanceMode]);

  // Placeholder nền theo scheme đã resolve — tránh flash trắng khi dark
  if (!hydrated) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palettes[resolveScheme(appearanceMode, systemScheme)].background.primary,
        }}
      />
    );
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme(): AppTheme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }
  return ctx;
}
