// ============================================================
// HỆ MÀU YOZAKURA — Sakura · Moonlight · Lavender · Cream
// ============================================================
//
//  Bộ tứ màu gốc của thiết kế:
//  🌸 Sakura Pink      #FFD1DC / #FFB7C5  — nút bấm chính, viền ảnh
//  🌙 Moonlight Yellow #FFF4D0 / #FEF1B7  — streak, icon nổi bật, thu nhập
//  💜 Dreamy Lavender  #E8DFF5            — nền thẻ (cards)
//  🤍 Soft Cream       #FFFBFB            — nền app chính

export const Colors = {

  // ── 🌸 Sakura Pink ──────────────────────────────────────────
  // Nút bấm chính, viền ảnh Locket, chip chi tiêu
  pink: {
    50:  '#FFF5F7',  // Sakura trắng — nền hover rất nhạt
    100: '#FFE8EE',  // Sakura phấn — nền chip nhạt
    200: '#FFD1DC',  // Sakura nhạt ✨ (spec)
    300: '#FFC4D0',  // Sakura vừa — viền, icon
    400: '#FFB7C5',  // Sakura chủ đạo ✨ (spec) — nút bấm chính
    500: '#FF8FA8',  // Sakura đậm — pressed state
    600: '#E0607A',  // Sakura sâu — text trên nền trắng
  },

  // ── 🌙 Moonlight Yellow ─────────────────────────────────────
  // Streak badge, thu nhập highlight, icon nổi bật
  yellow: {
    50:  '#FEFFF5',  // Trăng trắng — nền hover rất nhạt
    100: '#FFF4D0',  // Moonlight nhạt ✨ (spec) — nền badge streak
    200: '#FEF1B7',  // Moonlight vừa ✨ (spec) — highlight thu nhập
    300: '#F9DC6A',  // Vàng vừa — icon streak, accent
    400: '#F0C020',  // Vàng đậm — text trên nền sáng
  },

  // ── 💜 Dreamy Lavender ──────────────────────────────────────
  // Nền thẻ (Cards), ví chồng, danh mục mua sắm
  lavender: {
    50:  '#F7F4FF',  // Tím trắng — nền rất nhạt
    100: '#EDE5F8',  // Tím siêu nhạt — hover chip
    200: '#E8DFF5',  // Dreamy Lavender ✨ (spec) — nền thẻ
    300: '#C5B0E8',  // Lavender vừa — viền, icon
    400: '#9B7FD0',  // Lavender đậm — text accent, today marker
  },

  // ── 🌿 Mint (giữ lại cho trạng thái thu nhập / thành công) ──
  mint: {
    50:  '#F0FBF8',
    100: '#D4F4EC',
    200: '#A8E6D3',
    300: '#7DD4B8',
    400: '#4BBFA0',  // Xanh mint chủ đạo — số tiền thu nhập
  },

  // ── 🍑 Peach (accent danh mục) ──────────────────────────────
  peach: {
    100: '#FFE8D9',
    200: '#FFCBA8',
    300: '#FFAA75',
  },

  // ── ⚪ Neutral (trung tính — warm undertone rất nhẹ) ─────────
  neutral: {
    0:   '#FFFFFF',  // Trắng tinh — surface input, modal sheet
    50:  '#FFFBFB',  // Soft Cream ✨ (spec) — nền app chính
    100: '#F4EFF6',  // Nền chip / tag / row separator bg
    200: '#E6DEEC',  // Viền nhạt — border card
    300: '#CCBFD8',  // Viền vừa — divider, disabled border
    400: '#9E8EAE',  // Text phụ nhạt — placeholder, meta
    500: '#7A6490',  // Text phụ — caption, subtitle
    600: '#584470',  // Text vừa — label, secondary text
    700: '#3A2855',  // Text đậm — heading, primary text
    800: '#201540',  // Text rất đậm — title lớn
  },

  // ── Màu ngữ nghĩa ────────────────────────────────────────────
  success: '#4BBFA0',   // Mint — thu nhập, hoàn thành
  danger:  '#FF8FA8',   // Sakura đậm — chi tiêu (không dùng đỏ)
  warning: '#F9DC6A',   // Moonlight vừa — cảnh báo, chú ý
  info:    '#82C0FF',   // Xanh dương pastel — thông tin

  // ── Màu nền ──────────────────────────────────────────────────
  background: {
    primary:  '#FFFBFB',  // Soft Cream — nền app ✨ (spec)
    card:     '#E8DFF5',  // Dreamy Lavender — nền thẻ ✨ (spec)
    surface:  '#FFFFFF',  // Trắng tinh — input, modal sheet, bottom sheet
    modal:    '#FFFFFF',
    overlay:  'rgba(58, 40, 85, 0.45)',
  },

  // ── Camera ───────────────────────────────────────────────────
  camera: {
    overlay:            'rgba(0, 0, 0, 0.12)',
    captureButton:      '#FFB7C5',
    captureButtonInner: '#FFFFFF',
    captureRing:        'rgba(255, 183, 197, 0.45)',
  },

} as const;

// ── Màu danh mục mặc định (đồng bộ với palette mới) ─────────
export const CategoryColors = [
  '#FFB7C5',  // Sakura — Ăn uống
  '#82C0FF',  // Sky    — Di chuyển
  '#C5B0E8',  // Lavender — Mua sắm
  '#4BBFA0',  // Mint   — Sức khoẻ
  '#FEF1B7',  // Moonlight — Giải trí  (nên dùng icon đậm màu)
  '#FFAA75',  // Peach  — Giáo dục
  '#A8E6D3',  // Mint nhạt — Gia đình
  '#FFD1DC',  // Sakura nhạt — Làm đẹp
  '#EDE5F8',  // Lavender nhạt — Thú cưng
  '#E6DEEC',  // Neutral — Khác
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
    xl:   24,
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

// ── Shadows (tông màu đồng bộ palette mới) ───────────────────
export const Shadows = {
  // Đổ bóng nhẹ — card thông thường
  soft: {
    shadowColor: '#C5B0E8',      // Lavender shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
  },
  // Đổ bóng vừa — nút bấm, modal trigger
  medium: {
    shadowColor: '#FFB7C5',      // Sakura shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 6,
  },
  // Đổ bóng mạnh — floating button, bottom sheet
  strong: {
    shadowColor: '#3A2855',      // Deep purple shadow
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
} as const;
