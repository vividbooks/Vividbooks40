import { PageHeaderConfig, PageFooterConfig } from '../types/worksheet';
import { getHeaderHeight, getFooterHeight } from '../components/worksheet-editor-pro/PageHeaderFooter';

export const MM_TO_PX = 96 / 25.4;
export const SAFE_ZONE_MM = 5;
export const SAFE_ZONE_PX = Math.round(SAFE_ZONE_MM * MM_TO_PX); // 19px

export const PAGE_DIMENSIONS = {
  a4: { width: Math.round(210 * MM_TO_PX), height: Math.round(297 * MM_TO_PX) }, // 794 x 1123
  b5: { width: Math.round(176 * MM_TO_PX), height: Math.round(250 * MM_TO_PX) },
  a5: { width: Math.round(148 * MM_TO_PX), height: Math.round(210 * MM_TO_PX) },
} as const;

export type PageFormat = 'a4' | 'b5' | 'a5';

export const CONTENT_PADDING_H = 24;
export const CONTENT_PADDING_V_TOP = 16;
export const CONTENT_PADDING_V_BOTTOM = 35; // increased to prevent bottom handle (bobanek) clipping

const GRID_GAP_MAP: Record<string, number> = {
  none: 0,
  small: 8,
  medium: 16,
  large: 24,
};

export function getGridGapPx(gridGap?: string): number {
  return GRID_GAP_MAP[gridGap || 'medium'] ?? 16;
}

/**
 * When header/footer is disabled their height is 0 – in that case we need at
 * least SAFE_ZONE_PX of vertical padding so content doesn't reach the paper
 * edge.  When they ARE enabled the header (60 px ≈ 16 mm) and footer (56 px ≈
 * 15 mm) already exceed the 5 mm safe zone, so the normal padding is fine.
 */
export function getContentPaddingV(
  headerConfig?: PageHeaderConfig,
  footerConfig?: PageFooterConfig,
): { top: number; bottom: number } {
  const headerH = getHeaderHeight(headerConfig);
  const footerH = getFooterHeight(footerConfig);
  return {
    top: headerH > 0 ? CONTENT_PADDING_V_TOP : Math.max(CONTENT_PADDING_V_TOP, SAFE_ZONE_PX),
    bottom: footerH > 0 ? CONTENT_PADDING_V_BOTTOM : Math.max(CONTENT_PADDING_V_BOTTOM, SAFE_ZONE_PX),
  };
}

export function getContentHeight(
  pageFormat: PageFormat,
  headerConfig?: PageHeaderConfig,
  footerConfig?: PageFooterConfig,
): number {
  const { height: pageHeight } = PAGE_DIMENSIONS[pageFormat] || PAGE_DIMENSIONS.a4;
  const headerH = getHeaderHeight(headerConfig);
  const footerH = getFooterHeight(footerConfig);
  const { top, bottom } = getContentPaddingV(headerConfig, footerConfig);
  return pageHeight - headerH - footerH - top - bottom;
}
