/** Chiều cao nội dung tab bar app (do app quy định, không gồm navbar hệ thống) */
export const TAB_BAR_CONTENT_HEIGHT = 62;

/** Fallback navbar Android 3 nút (~48dp) khi Safe Area chưa báo inset */
export const SYSTEM_NAV_BAR_FALLBACK = 48;

/** Home day-detail sheet — cap viewport, list scrolls inside */
export const DAY_SHEET_MAX_HEIGHT_RATIO = 0.85;
export const DAY_SHEET_MIN_LIST_HEIGHT = 96;
export const BOTTOM_SHEET_PADDING_TOP = 12;

/**
 * Max height for the day-sheet transaction ScrollView.
 * Chrome = handle + date/summary + sticky footer (not the list).
 * Sheet bottom inset is applied by BottomSheetModal — subtract so the list
 * does not push the CTA below the sheet max height.
 */
export function daySheetListMaxHeight(
  windowHeight: number,
  chromeHeight: number,
  sheetBottomInset: number,
  sheetTopPadding: number = BOTTOM_SHEET_PADDING_TOP,
): number {
  const sheetMax = windowHeight * DAY_SHEET_MAX_HEIGHT_RATIO;
  const available = sheetMax - sheetTopPadding - sheetBottomInset - chromeHeight;
  return Math.max(DAY_SHEET_MIN_LIST_HEIGHT, Math.round(available));
}
