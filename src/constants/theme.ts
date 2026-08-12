// ============================================================
// HỆ MÀU YOZAKURA — Moonlit Sakura
// Cute magical girl × dreamy thanh lịch
// Baby blue · Sakura pink · Celestial lavender · Soft cream · Platinum
// Light / Dark token sets — cùng semantic keys
// ============================================================

export type AppearanceMode = 'system' | 'light' | 'dark';
export type ResolvedColorScheme = 'light' | 'dark';

const lightColors = {
  // ── 🌸 Sakura Pink ──────────────────────────────────────────
  pink: {
    50:  '#FFF6F9',
    100: '#FFEAF1',
    200: '#FFD5E2',
    300: '#FFC0D2',
    400: '#FFA6C1',
    500: '#F484A8',
    600: '#D9638B',
  },

  // ── 🌙 Moonlight Yellow ─────────────────────────────────────
  yellow: {
    50:  '#FEFFF5',
    100: '#FFF4D0',
    200: '#FEF1B7',
    300: '#F9DC6A',
    400: '#F0C020',
  },

  // ── 💜 Celestial Lavender ───────────────────────────────────
  lavender: {
    50:  '#F8F6FF',
    100: '#EEE9FF',
    200: '#E1DAFA',
    300: '#C8BCF2',
    400: '#AAA0E2',
    500: '#8980CA',
  },

  // ── 🌙 Moonlight Blue ───────────────────────────────────────
  blue: {
    50:  '#F5FAFF',
    100: '#EAF4FF',
    200: '#D9ECFF',
    300: '#BFDEFF',
    400: '#9CCBFF',
    500: '#78B5F2',
    600: '#548ED1',
  },

  // ── ✨ Platinum / White Gold ────────────────────────────────
  metallic: {
    platinum:  '#E8ECF3',
    whiteGold: '#D8DCE5',
    roseGold:  '#DDA8AF',
  },

  // ── 🌿 Mint (thành công / accent) ───────────────────────────
  mint: {
    50:  '#F0FBF8',
    100: '#D4F4EC',
    200: '#A8E6D3',
    300: '#7DD4B8',
    400: '#4BBFA0',
  },

  // ── 🍑 Peach (accent danh mục) ──────────────────────────────
  peach: {
    100: '#FFE8D9',
    200: '#FFCBA8',
    300: '#FFAA75',
  },

  // ── ⚪ Neutral — soft blue-lavender grey ────────────────────
  neutral: {
    0:   '#FFFFFF',
    50:  '#FAFBFD',
    100: '#F0F1F6',
    200: '#DFE2EB',
    300: '#C5CAD8',
    400: '#929BAF',
    500: '#6E7890',
    600: '#4F5870',
    700: '#30384F',
    800: '#192036',
  },

  success: '#4BBFA0',
  danger:  '#F484A8',
  warning: '#F9DC6A',
  info:    '#78B5F2',

  background: {
    primary:  '#F4F5FA',
    card:     '#F0F1F7',
    surface:  '#FAFBFD',
    modal:    '#FCFCFF',
    overlay:  'rgba(25, 31, 52, 0.48)',
  },

  camera: {
    overlay:            'rgba(0, 0, 0, 0.12)',
    captureButton:      '#FFA6C1',
    captureButtonInner: '#FFFFFF',
    captureRing:        'rgba(156, 203, 255, 0.45)',
  },

  // ── Action — Moonlight Blue interaction ─────────────────────
  action: {
    primaryBackground: '#78B5F2',
    primaryPressed:    '#548ED1',
    primaryText:       '#FFFFFF',

    secondaryBackground: '#EAF4FF',
    secondaryPressed:    '#D9ECFF',
    secondaryText:       '#4F6F9E',
    secondaryBorder:     '#BFDEFF',

    selectedBackground: '#D9ECFF',
    selectedBorder:     '#9CCBFF',
    selectedText:       '#426FAD',

    destructiveBackground: '#FFF0F4',
    destructivePressed:    '#FFD5E2',
    destructiveText:       '#C85A7E',

    fabBackground: '#78B5F2',
    fabPressed:    '#548ED1',
    fabIcon:       '#FFFFFF',
  },
} as const;

const darkColors = {
  pink: {
    50:  '#241922',
    100: '#3D2633',
    200: '#623548',
    300: '#A85E7B',
    400: '#EE93B4',
    500: '#FFB3CB',
    600: '#FFD0DD',
  },

  yellow: {
    50:  '#1F1C12',
    100: '#3A3418',
    200: '#5C5220',
    300: '#E8CF72',
    400: '#F0C020',
  },

  lavender: {
    50:  '#191724',
    100: '#29253F',
    200: '#3B345A',
    300: '#71689C',
    400: '#AAA0E2',
    500: '#CAC2F2',
  },

  blue: {
    50:  '#151F30',
    100: '#1D304A',
    200: '#29496E',
    300: '#527EAE',
    400: '#87B8EE',
    500: '#A9CEFA',
    600: '#C4DEFC',
  },

  metallic: {
    platinum:  '#758096',
    whiteGold: '#ADB6C8',
    roseGold:  '#CE929D',
  },

  mint: {
    50:  '#12201C',
    100: '#1A332C',
    200: '#2A5246',
    300: '#4A9E88',
    400: '#72D5BA',
  },

  peach: {
    100: '#3A2820',
    200: '#6B4A38',
    300: '#E8A078',
  },

  neutral: {
    0:   '#FFFFFF',
    50:  '#151A28',
    100: '#252D40',
    200: '#303A50',
    300: '#46516A',
    400: '#8490AA',
    500: '#AAB4CA',
    600: '#CBD3E3',
    700: '#E8ECF5',
    800: '#F8FAFF',
  },

  success: '#72D5BA',
  danger:  '#EE93B4',
  warning: '#E8CF72',
  info:    '#87B8EE',

  background: {
    primary:  '#101421',
    card:     '#181E2D',
    surface:  '#1E2536',
    modal:    '#20283A',
    overlay:  'rgba(3, 6, 16, 0.72)',
  },

  camera: {
    overlay:            'rgba(0, 0, 0, 0.28)',
    captureButton:      '#D77F9D',
    captureButtonInner: '#FFFFFF',
    captureRing:        'rgba(135, 184, 238, 0.38)',
  },

  // ── Action — Moonlight Blue interaction (muted, no neon) ────
  action: {
    primaryBackground: '#527EAE',
    primaryPressed:    '#3E668F',
    primaryText:       '#F8FAFF',

    secondaryBackground: '#1D304A',
    secondaryPressed:    '#29496E',
    secondaryText:       '#A9CEFA',
    secondaryBorder:     '#3F6288',

    selectedBackground: '#29496E',
    selectedBorder:     '#527EAE',
    selectedText:       '#C4DEFC',

    destructiveBackground: '#4A2937',
    destructivePressed:    '#623548',
    destructiveText:       '#FFB3CB',

    fabBackground: '#527EAE',
    fabPressed:    '#3E668F',
    fabIcon:       '#F8FAFF',
  },
} as const;

export type ThemeColors = typeof lightColors | typeof darkColors;

export const lightShadows = {
  soft: {
    shadowColor: '#BFDEFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  medium: {
    shadowColor: '#C8BCF2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  strong: {
    shadowColor: '#32284A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },
} as const;

export const darkShadows = {
  soft: {
    shadowColor: '#0A0E18',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 1,
  },
  medium: {
    shadowColor: '#080B14',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 2,
  },
  strong: {
    shadowColor: '#05070E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.36,
    shadowRadius: 10,
    elevation: 3,
  },
} as const;

export type ThemeShadows = typeof lightShadows | typeof darkShadows;

export const palettes = {
  light: lightColors,
  dark: darkColors,
} as const;

export const shadowPalettes = {
  light: lightShadows,
  dark: darkShadows,
} as const;

/** @deprecated Dùng useAppTheme().colors — giữ alias light cho bootstrap sớm */
export const Colors = lightColors;

/** @deprecated Dùng useAppTheme().shadows */
export const Shadows = lightShadows;

// ── Màu danh mục (cân bằng blue · pink · lavender · mint · peach · yellow) ─
export const CategoryColors = [
  '#FFA6C1',  // Sakura — Ăn uống
  '#9CCBFF',  // Moonlight Blue — Di chuyển
  '#C8BCF2',  // Celestial Lavender — Mua sắm
  '#4BBFA0',  // Mint — Sức khoẻ
  '#F9DC6A',  // Moonlight Yellow — Giải trí
  '#FFAA75',  // Peach — Giáo dục
  '#78B5F2',  // Blue mid — Gia đình
  '#FFC0D2',  // Sakura soft — Làm đẹp
  '#AAA0E2',  // Lavender mid — Thú cưng
  '#D8DCE5',  // Platinum — Khác
] as const;

// ── Typography ───────────────────────────────────────────────
export const Typography = {
  fontFamily: {
    regular: undefined,
    medium:  undefined,
    bold:    undefined,
  },
  fontSize: {
    xs:   11,
    sm:   13,
    base: 15,
    md:   17,
    lg:   20,
    xl:  24,
    '2xl': 28,
    '3xl': 34,
    '4xl': 42,
  },
  lineHeight: {
    tight:   1.2,
    normal:  1.5,
    relaxed: 1.7,
  },
} as const;

// ── Spacing ──────────────────────────────────────────────────
export const Spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

// ── Border Radius ────────────────────────────────────────────
export const BorderRadius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
} as const;

export const APPEARANCE_STORAGE_KEY = 'yuedaily_appearance_mode';
