import type { CSSProperties } from 'react';

// Shared constants for ProBlockSettingsPanel and extracted block-settings components

export const FONT_FAMILIES = [
  { value: "'Fenomen Sans', sans-serif", label: 'Fenomen Sans' },
  { value: "'Visby Round', sans-serif", label: 'Visby Round' },
  { value: "'Vividbooks Script', cursive", label: 'Vividbooks Script' },
  { value: 'Cooper Light, serif', label: 'Cooper' },
  { value: "'Inter', sans-serif", label: 'Inter' },
  { value: "'Roboto', sans-serif", label: 'Roboto' },
  { value: "'Open Sans', sans-serif", label: 'Open Sans' },
  { value: "'Lato', sans-serif", label: 'Lato' },
  { value: "'Comic Neue', cursive", label: 'Comic Neue' },
];

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64];

export const TEXT_COLORS = [
  // Row 1 - Blacks & Grays
  { value: '#000000', label: 'Černá' },
  { value: '#1F2937', label: 'Antracit' },
  { value: '#374151', label: 'Tmavě šedá' },
  { value: '#6B7280', label: 'Šedá' },
  { value: '#9CA3AF', label: 'Světle šedá' },
  { value: '#D1D5DB', label: 'Stříbrná' },
  // Row 2 - Warm colors
  { value: '#EF4444', label: 'Červená' },
  { value: '#F97316', label: 'Oranžová' },
  { value: '#F59E0B', label: 'Žlutá' },
  { value: '#EAB308', label: 'Zlatá' },
  { value: '#84CC16', label: 'Limetka' },
  { value: '#22C55E', label: 'Zelená' },
  // Row 3 - Cool colors
  { value: '#10B981', label: 'Smaragdová' },
  { value: '#14B8A6', label: 'Tyrkysová' },
  { value: '#06B6D4', label: 'Azurová' },
  { value: '#3B82F6', label: 'Modrá' },
  { value: '#6366F1', label: 'Indigová' },
  { value: '#8B5CF6', label: 'Fialová' },
  // Row 4 - Pastels & Special
  { value: '#A855F7', label: 'Purpurová' },
  { value: '#EC4899', label: 'Růžová' },
  { value: '#F43F5E', label: 'Malinová' },
  { value: '#78350F', label: 'Hnědá' },
  { value: '#FFFFFF', label: 'Bílá' },
  { value: '#1E40AF', label: 'Královská modrá' },
];

export const SIDEBAR_COLORS = {
  panelBg: '#1e293b',
  panelAlt: '#0f172a',
  panelSoft: '#334155',
  panelBorder: '#334155',
  controlBorder: '#475569',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textSubtle: '#64748b',
  label: '#808080',
  accent: '#5C5CFF',
  accentSoft: '#7c7cff',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
} as const;

export const SIDEBAR_RADIUS = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
} as const;

export const sidebarPanelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: SIDEBAR_COLORS.panelBg,
  color: SIDEBAR_COLORS.text,
};

export const sidebarHeaderStyle: CSSProperties = {
  padding: '18px 16px 14px',
  borderBottom: `1px solid ${SIDEBAR_COLORS.panelBorder}`,
  backgroundColor: '#182235',
  flexShrink: 0,
};

export const sidebarHeaderTitleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
};

export const sidebarHeaderTitleStyle: CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  color: '#f8fafc',
  lineHeight: 1.05,
  margin: 0,
};

export const sidebarHeaderSubtitleStyle: CSSProperties = {
  fontSize: '12px',
  color: SIDEBAR_COLORS.textMuted,
  marginTop: 4,
};

export const sidebarContentStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '16px',
};

export const sectionTitleStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#CCCCCC',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

export const sectionHeaderRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  marginBottom: 12,
};

export const sectionBlockStyle: CSSProperties = {
  marginTop: '16px',
  paddingTop: '16px',
  borderTop: `1px solid ${SIDEBAR_COLORS.panelBorder}`,
};

export const subtleCardStyle: CSSProperties = {
  backgroundColor: SIDEBAR_COLORS.panelAlt,
  border: `1px solid ${SIDEBAR_COLORS.panelBorder}`,
  borderRadius: SIDEBAR_RADIUS.lg,
  padding: '12px',
};

export const emphasisCardStyle: CSSProperties = {
  backgroundColor: '#182235',
  border: `1px solid ${SIDEBAR_COLORS.controlBorder}`,
  borderRadius: SIDEBAR_RADIUS.xl,
  padding: '12px',
};

export const inputStyle: CSSProperties = {
  width: '100%',
  height: '34px',
  padding: '0 10px',
  backgroundColor: SIDEBAR_COLORS.panelSoft,
  border: `1px solid ${SIDEBAR_COLORS.controlBorder}`,
  borderRadius: `${SIDEBAR_RADIUS.md}px`,
  color: SIDEBAR_COLORS.text,
  fontSize: '12px',
  outline: 'none',
};

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  height: 'auto',
  minHeight: '72px',
  padding: '8px 10px',
  resize: 'vertical',
};

export const selectStyle: CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};

export const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 600,
  color: SIDEBAR_COLORS.label,
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

export const buttonStyle: CSSProperties = {
  minHeight: '32px',
  padding: '6px 10px',
  backgroundColor: SIDEBAR_COLORS.panelSoft,
  border: `1px solid transparent`,
  borderRadius: `${SIDEBAR_RADIUS.md}px`,
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: 600,
  color: SIDEBAR_COLORS.textMuted,
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  transition: 'all 0.1s ease',
};

export const iconButtonStyle: CSSProperties = {
  ...buttonStyle,
  width: '34px',
  minWidth: '34px',
  padding: 0,
  justifyContent: 'center',
};

export const segmentedRowStyle: CSSProperties = {
  display: 'flex',
  gap: '6px',
};

export const segmentedGridStyle: CSSProperties = {
  display: 'grid',
  gap: '6px',
};

export function getButtonVariantStyle(
  active = false,
  variant: 'default' | 'accent' | 'success' | 'warning' | 'danger' = 'default'
): CSSProperties {
  if (!active) {
    return {
      backgroundColor: SIDEBAR_COLORS.panelSoft,
      border: `1px solid transparent`,
      color: SIDEBAR_COLORS.textMuted,
    };
  }

  if (variant === 'success') {
    return { backgroundColor: SIDEBAR_COLORS.success, color: 'white', border: '1px solid transparent' };
  }
  if (variant === 'warning') {
    return { backgroundColor: SIDEBAR_COLORS.warning, color: '#111827', border: '1px solid transparent' };
  }
  if (variant === 'danger') {
    return { backgroundColor: SIDEBAR_COLORS.danger, color: 'white', border: '1px solid transparent' };
  }

  return {
    backgroundColor: SIDEBAR_COLORS.accent,
    color: 'white',
    border: `1px solid ${SIDEBAR_COLORS.accentSoft}`,
  };
}

export function getSegmentedButtonStyle(
  active = false,
  variant: 'default' | 'accent' | 'success' | 'warning' | 'danger' = 'accent'
): CSSProperties {
  return {
    ...buttonStyle,
    flex: 1,
    justifyContent: 'center',
    ...getButtonVariantStyle(active, variant),
  };
}

export const sliderValueLabelStyle: CSSProperties = {
  fontWeight: 700,
  color: SIDEBAR_COLORS.accent,
};
