/**
 * SheetSettingsPanel - Dark mode panel for sheet settings in PRO editor
 * 
 * Figma-inspired dark theme with grid system settings.
 */

import { useEffect, useState } from 'react';
import { LayoutGrid, Eye, EyeOff, Layers, ChevronDown, ChevronRight, FileText, MessageSquare, Hash, Type as TypeIcon, Save, BookTemplate } from 'lucide-react';
import { GridColumns, GridGap, GRID_GAP_VALUES, GlobalFontSize, PageHeaderConfig, PageFooterConfig, FooterFeedbackStyle, WorksheetBlock, PageFormat } from '../../types/worksheet';
import { DEFAULT_HEADER, DEFAULT_FOOTER } from './PageHeaderFooter';
import { TEXTBOOK_LAYOUTS, type TextbookLayout } from '../../utils/textbook-layouts';
import {
  SIDEBAR_COLORS,
  sidebarContentStyle,
  sectionTitleStyle,
  sectionHeaderRowStyle,
  subtleCardStyle,
  inputStyle,
  labelStyle,
  buttonStyle,
  iconButtonStyle,
  getButtonVariantStyle,
  getSegmentedButtonStyle,
} from './block-settings/shared';
import { ColorPickerField } from './block-settings/ColorPickerField';

type LayoutMode = 'grid' | 'freeform';

// Color palette for page background
const PAGE_COLORS = [
  { value: '#FFFFFF', label: 'Bílá' },
  { value: '#F8F9FA', label: 'Šedá 50' },
  { value: '#F1F3F5', label: 'Šedá 100' },
  { value: '#E9ECEF', label: 'Šedá 200' },
  { value: '#FFFBEB', label: 'Žlutá 50' },
  { value: '#FEF3C7', label: 'Žlutá 100' },
  { value: '#FDE68A', label: 'Žlutá 200' },
  { value: '#FEF2F2', label: 'Červená 50' },
  { value: '#FEE2E2', label: 'Červená 100' },
  { value: '#FECACA', label: 'Červená 200' },
  { value: '#F0FDF4', label: 'Zelená 50' },
  { value: '#DCFCE7', label: 'Zelená 100' },
  { value: '#BBF7D0', label: 'Zelená 200' },
  { value: '#EFF6FF', label: 'Modrá 50' },
  { value: '#DBEAFE', label: 'Modrá 100' },
  { value: '#BFDBFE', label: 'Modrá 200' },
  { value: '#F5F3FF', label: 'Fialová 50' },
  { value: '#EDE9FE', label: 'Fialová 100' },
  { value: '#DDD6FE', label: 'Fialová 200' },
  { value: '#FDF4FF', label: 'Růžová 50' },
  { value: '#FAE8FF', label: 'Růžová 100' },
  { value: '#F5D0FE', label: 'Růžová 200' },
  { value: '#ECFEFF', label: 'Tyrkys 50' },
  { value: '#CFFAFE', label: 'Tyrkys 100' },
];

interface PageOverride {
  pageColumnLayout?: 'single' | 'two-columns';
  twoColumnASpan?: number;
}

interface SheetSettingsPanelProps {
  gridColumns: GridColumns;
  gridGap: GridGap;
  globalFontSize: GlobalFontSize;
  pageFormat: PageFormat;
  showGridOverlay: boolean;
  layoutMode: LayoutMode;
  pageColumnLayout?: 'single' | 'two-columns';
  twoColumnASpan?: number;
  pageBackgroundColor?: string;
  pageHeader?: PageHeaderConfig;
  pageFooter?: PageFooterConfig;
  /** Index právě viditelné stránky (0-based) */
  currentPageIndex?: number;
  /** Per-stránkové overrides */
  pageOverrides?: Record<number, PageOverride>;
  onGridColumnsChange: (columns: GridColumns) => void;
  onGridGapChange: (gap: GridGap) => void;
  onGlobalFontSizeChange: (size: GlobalFontSize) => void;
  onPageFormatChange: (format: PageFormat) => void;
  onShowGridOverlayChange: (show: boolean) => void;
  onLayoutModeChange: (mode: LayoutMode) => void;
  onPageColumnLayoutChange: (layout: 'single' | 'two-columns') => void;
  onTwoColumnASpanChange: (span: number) => void;
  onPageBackgroundColorChange: (color: string | undefined) => void;
  onPageHeaderChange: (config: PageHeaderConfig) => void;
  onPageFooterChange: (config: PageFooterConfig) => void;
  onPageOverrideChange: (pageIndex: number, override: PageOverride | null) => void;
  /** Apply a template: rearranges gridSpan of existing blocks to match the chosen layout */
  onApplyTemplate?: (templateId: string) => void;
  /** Save current page structure as a named custom template */
  onSavePageAsTemplate?: (name: string) => void;
  /** Current page blocks (for save-as-template) */
  currentPageBlocks?: WorksheetBlock[];
  /** Smart Layout: AI pairs dataset images with paragraphs and arranges them side-by-side */
  onSmartLayout?: () => void;
  smartLayoutLoading?: boolean;
  /** AI Text Formatter: bold important terms in paragraphs, highlight in headings */
  onFormatText?: () => void;
  formatTextLoading?: boolean;
  /** Block Series: apply named series pattern to current page */
  onApplySeries?: (seriesKeys: string[]) => void;
  blockSeriesConfig?: Record<string, { label: string; emoji: string; description: string; group?: string; svgPreview?: string }>;
  /** Active design system — when set, shows "Z design systému" buttons to load defaults */
  designSystem?: import('../../types/design-system').DesignSystem | null;
  /** Apply design system defaults to the worksheet */
  onApplyDesignSystem?: (ds: import('../../types/design-system').DesignSystem) => void;
}

// Grid column options
const GRID_OPTIONS: { value: GridColumns; label: string }[] = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 6, label: '6' },
  { value: 12, label: '12' },
];

// Gap options
const GAP_OPTIONS: { value: GridGap; label: string; px: number }[] = [
  { value: 'none', label: 'Žádná', px: 0 },
  { value: 'small', label: 'Malá', px: 8 },
  { value: 'medium', label: 'Střední', px: 16 },
  { value: 'large', label: 'Velká', px: 24 },
];

const PAGE_FORMAT_OPTIONS: { value: PageFormat; label: string; size: string }[] = [
  { value: 'a4', label: 'A4', size: '210×297' },
  { value: 'a5', label: 'A5', size: '148×210' },
  { value: 'b5', label: 'B5', size: '176×250' },
];

// ── Custom templates persisted in localStorage ─────────────────────────────
const CUSTOM_LAYOUTS_KEY = 'vividbooks_custom_layouts';

function loadCustomLayouts(): TextbookLayout[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_LAYOUTS_KEY) || '[]');
  } catch { return []; }
}

function saveCustomLayouts(layouts: TextbookLayout[]) {
  localStorage.setItem(CUSTOM_LAYOUTS_KEY, JSON.stringify(layouts));
}

const sidebarShellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: SIDEBAR_COLORS.panelBg,
  color: SIDEBAR_COLORS.text,
};

const cardStyle: React.CSSProperties = {
  ...subtleCardStyle,
  marginBottom: '16px',
};

export function SheetSettingsPanel({
  gridColumns,
  gridGap,
  globalFontSize,
  pageFormat,
  showGridOverlay,
  layoutMode,
  pageColumnLayout = 'single',
  twoColumnASpan,
  pageBackgroundColor,
  pageHeader,
  pageFooter,
  currentPageIndex,
  pageOverrides,
  onGridColumnsChange,
  onGridGapChange,
  onGlobalFontSizeChange,
  onPageFormatChange,
  onShowGridOverlayChange,
  onLayoutModeChange,
  onPageColumnLayoutChange,
  onTwoColumnASpanChange,
  onPageBackgroundColorChange,
  onPageHeaderChange,
  onPageFooterChange,
  onPageOverrideChange,
  onApplyTemplate,
  onSavePageAsTemplate,
  currentPageBlocks,
  onSmartLayout,
  smartLayoutLoading,
  onFormatText,
  formatTextLoading,
  onApplySeries,
  blockSeriesConfig,
  designSystem,
  onApplyDesignSystem,
}: SheetSettingsPanelProps) {
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [footerOpen, setFooterOpen] = useState(false);
  const [smartOpen, setSmartOpen] = useState(false);
  const [customLayouts, setCustomLayouts] = useState<TextbookLayout[]>(() => loadCustomLayouts());
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  
  const hdr = { ...DEFAULT_HEADER, ...pageHeader };
  const ftr = { ...DEFAULT_FOOTER, ...pageFooter };

  useEffect(() => {
    if (layoutMode !== 'grid') {
      onLayoutModeChange('grid');
    }
  }, [layoutMode, onLayoutModeChange]);
  
  const updateHeader = (updates: Partial<PageHeaderConfig>) => {
    onPageHeaderChange({ ...hdr, ...updates });
  };
  const updateFooter = (updates: Partial<PageFooterConfig>) => {
    onPageFooterChange({ ...ftr, ...updates });
  };
  
  const allLayouts = [...TEXTBOOK_LAYOUTS, ...customLayouts];

  const handleSaveTemplate = () => {
    const name = saveTemplateName.trim();
    if (!name || !currentPageBlocks) return;
    // Ignorovat hlavičku a patičku při ukládání šablony
    const contentBlocks = currentPageBlocks.filter(b => b.type !== 'header-footer');
    const slots = contentBlocks.map((b, i) => ({
      id: i + 1,
      type: b.type as any,
      width: (b.gridSpan && b.gridSpan <= 6 ? 'half' : 'full') as 'full' | 'half',
      role: b.type,
    }));
    const newLayout: TextbookLayout = {
      id: `custom-${Date.now()}`,
      name,
      description: `Uloženo z editoru (${slots.length} bloků)`,
      category: 'text',
      template: slots,
      svgPreview: '',
    };
    // Dynamically generate SVG preview
    import('../../utils/textbook-layouts').then(({ TEXTBOOK_LAYOUTS: _ }) => {
      // Just import to trigger side effects; we build SVG via a hidden svg function
    });
    const updated = [...customLayouts, newLayout];
    saveCustomLayouts(updated);
    setCustomLayouts(updated);
    setSaveTemplateName('');
    setShowSaveInput(false);
  };

  return (
    <div style={sidebarShellStyle}>
      <div style={sidebarContentStyle}>
      {/* Header */}
      <div style={{ ...sectionHeaderRowStyle, marginBottom: '12px' }}>
        <LayoutGrid size={14} style={{ color: '#5C5CFF' }} />
        <span style={sectionTitleStyle}>Nastavení listu</span>
      </div>

      {/* ── Smart úpravy accordion ───────────────────────────────────────────── */}
      {(onSmartLayout || onFormatText || (onApplySeries && blockSeriesConfig)) && (
        <div style={{ marginBottom: '16px', borderBottom: `1px solid ${SIDEBAR_COLORS.panelBorder}`, paddingBottom: '16px' }}>
          {/* Accordion header */}
          <button
            onClick={() => setSmartOpen(o => !o)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px 0',
            }}
          >
            <span style={{ ...sectionTitleStyle, color: SIDEBAR_COLORS.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
              ✨ Smart úpravy
            </span>
            {smartOpen
              ? <ChevronDown size={14} style={{ color: '#64748b' }} />
              : <ChevronRight size={14} style={{ color: '#64748b' }} />
            }
          </button>

          {smartOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Quick action buttons */}
              {(onSmartLayout || onFormatText) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {onSmartLayout && (
                    <button
                      onClick={onSmartLayout}
                      disabled={smartLayoutLoading}
                      style={{
                        width: '100%', padding: '8px 0',
                        background: smartLayoutLoading ? '#1e293b' : 'linear-gradient(135deg, #5C5CFF 0%, #a855f7 100%)',
                        border: 'none', borderRadius: 7, cursor: smartLayoutLoading ? 'not-allowed' : 'pointer',
                        color: '#fff', fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        opacity: smartLayoutLoading ? 0.7 : 1,
                      }}
                    >
                      {smartLayoutLoading ? <>⏳ Páruju obrázky...</> : <>🖼 Doplnit obrázky vedle textu</>}
                    </button>
                  )}
                  {onFormatText && (
                    <button
                      onClick={onFormatText}
                      disabled={formatTextLoading}
                      style={{
                        width: '100%', padding: '8px 0',
                        background: formatTextLoading ? '#1e293b' : 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                        border: 'none', borderRadius: 7, cursor: formatTextLoading ? 'not-allowed' : 'pointer',
                        color: '#fff', fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        opacity: formatTextLoading ? 0.7 : 1,
                      }}
                    >
                      {formatTextLoading ? <>⏳ Formátuji text...</> : <>✨ Zvýraznit pojmy v textu</>}
                    </button>
                  )}
                </div>
              )}

              {/* Block Series Picker */}
              {onApplySeries && blockSeriesConfig && (
                <div>
                  <div style={{ ...labelStyle, marginBottom: 8 }}>
                    Série bloků
                  </div>

                  {([
                    { id: 'column',    title: 'Jeden sloupec' },
                    { id: 'half',      title: 'Polovina 1/2 + 1/2' },
                    { id: 'twothirds', title: 'Dvě třetiny 2/3 + 1/3' },
                  ] as { id: string; title: string }[]).map(grp => {
                    const entries = Object.entries(blockSeriesConfig).filter(([, cfg]) => cfg.group === grp.id);
                    if (entries.length === 0) return null;
                    return (
                      <div key={grp.id} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                          {grp.title}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 5 }}>
                          {entries.map(([key, cfg]) => {
                            const isSelected = selectedSeries.includes(key);
                            return (
                              <button
                                key={key}
                                title={cfg.description}
                                onClick={() => setSelectedSeries(prev =>
                                  isSelected ? prev.filter(k => k !== key) : [...prev, key]
                                )}
                                style={{
                                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                                  padding: '8px 6px', borderRadius: 8,
                                  border: isSelected ? '2px solid #f59e0b' : '1px solid #334155',
                                  background: isSelected ? '#f59e0b11' : '#0f172a',
                                  cursor: 'pointer', transition: 'all 0.12s', outline: 'none',
                                }}
                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = '#5C5CFF'; }}
                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = '#334155'; }}
                              >
                                {cfg.svgPreview ? (
                                  <div style={{ width: 76, height: 60, borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}
                                    dangerouslySetInnerHTML={{ __html: cfg.svgPreview }} />
                                ) : (
                                  <div style={{ width: 76, height: 60, background: '#1e293b', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: 18 }}>{cfg.emoji}</span>
                                  </div>
                                )}
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: isSelected ? '#f59e0b' : '#e2e8f0', lineHeight: 1.2 }}>{key}</div>
                                  <div style={{ fontSize: 8, color: '#64748b', lineHeight: 1.3, marginTop: 1 }}>{cfg.label}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {selectedSeries.length > 0 && (
                    <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6, padding: '4px 8px', background: '#1e293b', borderRadius: 5 }}>
                      Vzor: {selectedSeries.join(' → ')}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 5 }}>
                    <button
                      onClick={() => { onApplySeries(selectedSeries); setSelectedSeries([]); }}
                      disabled={selectedSeries.length === 0}
                      style={{
                        flex: 1, padding: '7px 0', borderRadius: 6, border: 'none',
                        background: selectedSeries.length > 0 ? '#5C5CFF' : '#334155',
                        color: '#fff', fontSize: 11, fontWeight: 700,
                        cursor: selectedSeries.length > 0 ? 'pointer' : 'not-allowed',
                      }}
                    >
                      ✓ Aplikovat
                    </button>
                    <button
                      onClick={() => setSelectedSeries([])}
                      style={{
                        padding: '7px 10px', borderRadius: 6, border: '1px solid #334155',
                        background: 'transparent', color: '#64748b', fontSize: 11, cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Layout Mode Toggle */}
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>
          Režim
        </label>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => onLayoutModeChange('grid')}
            style={{
              ...getSegmentedButtonStyle(true),
              padding: '8px 6px',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Layers size={16} />
            Grid
          </button>
        </div>
      </div>

      {/* Page Format */}
      <div style={cardStyle}>
        <label style={labelStyle}>
          Formát
        </label>
        <div style={{ display: 'flex', gap: '4px' }}>
          {PAGE_FORMAT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onPageFormatChange(option.value)}
              style={{
                ...getSegmentedButtonStyle(pageFormat === option.value),
                flexDirection: 'column',
                gap: 2,
                padding: '10px 6px',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 700 }}>{option.label}</span>
              <span style={{ fontSize: '10px', opacity: 0.8 }}>{option.size}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Design System quick-apply banner */}
      {designSystem && onApplyDesignSystem && (
        <div style={{
          marginBottom: '16px', padding: '10px 12px',
          backgroundColor: '#0f1a2e', borderRadius: '8px',
          border: '1px solid #1e3a5f',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: designSystem.thumbnail_color || '#5C5CFF', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 600, marginBottom: '2px' }}>Design systém</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{designSystem.name}</div>
          </div>
          <button
            onClick={() => onApplyDesignSystem(designSystem)}
            style={{
              padding: '5px 10px', backgroundColor: '#1e3a5f', border: '1px solid #3b82f6',
              borderRadius: '6px', cursor: 'pointer', fontSize: '10px', fontWeight: 600,
              color: '#60a5fa', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            Použít
          </button>
        </div>
      )}

      {/* Page Background Color */}
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>
          Barva stránky
        </label>
        <ColorPickerField
          value={pageBackgroundColor || '#FFFFFF'}
          palette={PAGE_COLORS}
          placeholder="Bílá (výchozí)"
          defaultCustomColor="#FFFFFF"
          onChange={(color) => onPageBackgroundColorChange(color)}
          onClear={pageBackgroundColor && pageBackgroundColor !== '#FFFFFF'
            ? () => onPageBackgroundColorChange(undefined)
            : undefined}
        />
      </div>

      {/* Grid Settings Group */}
      <div style={cardStyle}>
        {/* Grid Columns */}
        <div style={{ marginBottom: '12px' }}>
          <label style={labelStyle}>
            Sloupce
          </label>
          <div style={{ display: 'flex', gap: '3px' }}>
            {GRID_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onGridColumnsChange(option.value)}
                style={{
                  ...getSegmentedButtonStyle(gridColumns === option.value),
                  flex: 1,
                  padding: '6px 0',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Gap */}
        <div style={{ marginBottom: '12px' }}>
          <label style={labelStyle}>
            Mezera
          </label>
          <div style={{ display: 'flex', gap: '3px' }}>
            {GAP_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onGridGapChange(option.value)}
                style={{
                  ...getSegmentedButtonStyle(gridGap === option.value),
                  flex: 1,
                  padding: '6px 0',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {option.px}
              </button>
            ))}
          </div>
        </div>

        {/* Show Grid Toggle */}
        <button
          onClick={() => onShowGridOverlayChange(!showGridOverlay)}
          style={{
            ...buttonStyle,
            ...getButtonVariantStyle(showGridOverlay),
            width: '100%',
            justifyContent: 'center',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {showGridOverlay ? <Eye size={12} /> : <EyeOff size={12} />}
          {showGridOverlay ? 'Grid ON' : 'Grid OFF'}
        </button>

        {/* Grid Preview */}
        <div 
          style={{ 
            display: 'grid',
            gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
            gap: `${Math.min(GRID_GAP_VALUES[gridGap], 3)}px`,
            padding: '6px',
            marginTop: '10px',
            backgroundColor: '#1e293b',
            borderRadius: '4px',
          }}
        >
          {Array.from({ length: gridColumns }).map((_, i) => (
            <div 
              key={i}
              style={{
                height: '12px',
                backgroundColor: '#5C5CFF33',
                borderRadius: '2px',
                border: '1px dashed #5C5CFF66',
              }}
            />
          ))}
        </div>
      </div>

      {/* Two-Column Page Layout */}
      {/* FEATURE_TWO_COLUMNS – dočasně skryto; pro obnovení změň false na true */}
      {false && <div style={{
        marginBottom: '16px',
        padding: '10px',
        backgroundColor: '#1e293b',
        borderRadius: '6px',
        border: '1px solid #334155',
      }}>
        <label style={{ display: 'block', fontSize: '10px', fontWeight: 500, color: '#808080', marginBottom: '8px' }}>
          Rozložení stránky (globální)
        </label>
        <div style={{ display: 'flex', gap: '4px', marginBottom: pageColumnLayout === 'two-columns' ? '10px' : 0 }}>
          {(['single', 'two-columns'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => onPageColumnLayoutChange(opt)}
              style={{
                flex: 1,
                padding: '7px 4px',
                backgroundColor: pageColumnLayout === opt ? '#5C5CFF' : '#334155',
                color: pageColumnLayout === opt ? 'white' : '#94a3b8',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
              }}
            >
              {opt === 'single' ? (
                <><span style={{ fontSize: '13px' }}>▭</span> Jeden sloupec</>
              ) : (
                <><span style={{ fontSize: '13px' }}>⬛⬛</span> Dva sloupce</>
              )}
            </button>
          ))}
        </div>

        {pageColumnLayout === 'two-columns' && (() => {
          const aSpan = twoColumnASpan ?? Math.round(gridColumns / 2);
          const bSpan = gridColumns - aSpan;
          return (
            <>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 500, color: '#808080', marginBottom: '6px' }}>
                <span>Sloupce A : B</span>
                <span style={{ color: '#5C5CFF', fontWeight: 700 }}>{aSpan} : {bSpan}</span>
              </label>
              <input
                type="range" min={1} max={gridColumns - 1} step={1}
                value={aSpan}
                onChange={e => onTwoColumnASpanChange(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#5C5CFF', marginBottom: '8px' }}
              />
              {/* Visual preview — grid column boxes */}
              <div style={{ display: 'flex', gap: '2px', height: '18px' }}>
                {Array.from({ length: gridColumns }).map((_, i) => (
                  <div key={i} style={{
                    flex: 1,
                    borderRadius: '2px',
                    backgroundColor: i < aSpan ? '#5C5CFF44' : '#10b98144',
                    border: `1px solid ${i < aSpan ? '#5C5CFF88' : '#10b98188'}`,
                  }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '9px', fontWeight: 700 }}>
                <span style={{ color: '#5C5CFF' }}>A ({aSpan} sl.)</span>
                <span style={{ color: '#10b981' }}>B ({bSpan} sl.)</span>
              </div>
            </>
          );
        })()}
      </div>}

      {/* FEATURE_TWO_COLUMNS per-page – dočasně skryto; pro obnovení změň false na true */}
      {false && currentPageIndex !== undefined && (
        <div style={{
          marginBottom: '16px',
          padding: '10px',
          backgroundColor: '#1e293b',
          borderRadius: '6px',
          border: `1px solid ${pageOverrides?.[currentPageIndex] ? '#5C5CFF' : '#334155'}`,
        }}>
          {/* Header row with toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label style={{ fontSize: '10px', fontWeight: 500, color: pageOverrides?.[currentPageIndex] ? '#a5b4fc' : '#808080' }}>
              Stránka {currentPageIndex + 1} — vlastní rozložení
            </label>
            <ToggleSwitch
              checked={!!pageOverrides?.[currentPageIndex]}
              onChange={(enabled) => {
                if (enabled) {
                  // Inherit current global setting as starting point
                  onPageOverrideChange(currentPageIndex, {
                    pageColumnLayout: pageColumnLayout,
                    twoColumnASpan: twoColumnASpan,
                  });
                } else {
                  onPageOverrideChange(currentPageIndex, null);
                }
              }}
            />
          </div>

          {/* Override controls — only when override is active */}
          {pageOverrides?.[currentPageIndex] && (() => {
            const ov = pageOverrides[currentPageIndex];
            const ovLayout = ov.pageColumnLayout ?? pageColumnLayout;
            const ovASpan = ov.twoColumnASpan ?? twoColumnASpan ?? Math.round(gridColumns / 2);
            return (
              <>
                <div style={{ display: 'flex', gap: '4px', marginBottom: ovLayout === 'two-columns' ? '10px' : 0 }}>
                  {(['single', 'two-columns'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => onPageOverrideChange(currentPageIndex, { ...ov, pageColumnLayout: opt })}
                      style={{
                        flex: 1, padding: '7px 4px',
                        backgroundColor: ovLayout === opt ? '#5C5CFF' : '#334155',
                        color: ovLayout === opt ? 'white' : '#94a3b8',
                        border: 'none', borderRadius: '5px', cursor: 'pointer',
                        fontSize: '11px', fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                      }}
                    >
                      {opt === 'single'
                        ? <><span style={{ fontSize: '13px' }}>▭</span> Jeden</>
                        : <><span style={{ fontSize: '13px' }}>⬛⬛</span> Dva</>}
                    </button>
                  ))}
                </div>
                {ovLayout === 'two-columns' && (
                  <>
                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 500, color: '#808080', marginBottom: '6px' }}>
                      <span>Sloupce A : B</span>
                      <span style={{ color: '#5C5CFF', fontWeight: 700 }}>{ovASpan} : {gridColumns - ovASpan}</span>
                    </label>
                    <input
                      type="range" min={1} max={gridColumns - 1} step={1}
                      value={ovASpan}
                      onChange={e => onPageOverrideChange(currentPageIndex, { ...ov, twoColumnASpan: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: '#5C5CFF', marginBottom: '8px' }}
                    />
                    <div style={{ display: 'flex', gap: '2px', height: '18px' }}>
                      {Array.from({ length: gridColumns }).map((_, i) => (
                        <div key={i} style={{
                          flex: 1, borderRadius: '2px',
                          backgroundColor: i < ovASpan ? '#5C5CFF44' : '#10b98144',
                          border: `1px solid ${i < ovASpan ? '#5C5CFF88' : '#10b98188'}`,
                        }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '9px', fontWeight: 700 }}>
                      <span style={{ color: '#5C5CFF' }}>A ({ovASpan} sl.)</span>
                      <span style={{ color: '#10b981' }}>B ({gridColumns - ovASpan} sl.)</span>
                    </div>
                  </>
                )}
              </>
            );
          })()}

          {/* Hint when no override */}
          {!pageOverrides?.[currentPageIndex] && (
            <p style={{ fontSize: '10px', color: '#475569', margin: 0 }}>
              Dědí globální nastavení ({pageColumnLayout === 'two-columns' ? 'Dva sloupce' : 'Jeden sloupec'})
            </p>
          )}
        </div>
      )}

      {/* ============ HLAVIČKA ============ */}
      <div style={{
        marginBottom: '12px',
        border: `1px solid ${SIDEBAR_COLORS.panelBorder}`,
        borderRadius: '6px',
        overflow: 'hidden',
      }}>
        {/* Collapsible header */}
        <button
          onClick={() => setHeaderOpen(!headerOpen)}
          style={{
            width: '100%',
            padding: '10px 12px',
            backgroundColor: SIDEBAR_COLORS.panelAlt,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#E5E5E5',
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          {headerOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <FileText size={14} style={{ color: '#5C5CFF' }} />
          Hlavička stránky
          <div style={{ marginLeft: 'auto' }}>
            <ToggleSwitch
              checked={hdr.enabled}
              onChange={(v) => updateHeader({ enabled: v })}
            />
          </div>
        </button>

        {headerOpen && hdr.enabled && (
          <div style={{ padding: '12px', borderTop: '1px solid #334155' }}>
            {/* Field toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              <SettingToggle
                label="Jméno a příjmení"
                checked={hdr.showName !== false}
                onChange={(v) => updateHeader({ showName: v })}
              />
              <SettingToggle
                label="Třída"
                checked={hdr.showClass !== false}
                onChange={(v) => updateHeader({ showClass: v })}
              />
              <SettingToggle
                label="Známka"
                checked={hdr.showGrade !== false}
                onChange={(v) => updateHeader({ showGrade: v })}
              />
            </div>

            {/* Custom labels */}
            <label style={sectionLabelStyle}>Vlastní popisky</label>
            {hdr.showName !== false && (
              <input
                type="text"
                value={hdr.nameLabel || ''}
                onChange={(e) => updateHeader({ nameLabel: e.target.value })}
                placeholder="Jméno a příjmení"
                style={{ ...darkInputStyle, marginBottom: '6px' }}
              />
            )}
            {hdr.showClass !== false && (
              <input
                type="text"
                value={hdr.classLabel || ''}
                onChange={(e) => updateHeader({ classLabel: e.target.value })}
                placeholder="Třída"
                style={{ ...darkInputStyle, marginBottom: '6px' }}
              />
            )}
            {hdr.showGrade !== false && (
              <input
                type="text"
                value={hdr.gradeLabel || ''}
                onChange={(e) => updateHeader({ gradeLabel: e.target.value })}
                placeholder="Známka"
                style={{ ...darkInputStyle, marginBottom: '6px' }}
              />
            )}

            {/* Line color */}
            <label style={{ ...sectionLabelStyle, marginTop: '8px' }}>Barva linky</label>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {HEADER_LINE_COLORS.map((c) => (
                <div
                  key={c.value}
                  onClick={() => updateHeader({ lineColor: c.value })}
                  title={c.label}
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    backgroundColor: c.value,
                    cursor: 'pointer',
                    border: (hdr.lineColor || '#94a3b8') === c.value ? '2px solid #5C5CFF' : '1px solid #475569',
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ============ PATIČKA ============ */}
      <div style={{
        marginBottom: '12px',
        border: `1px solid ${SIDEBAR_COLORS.panelBorder}`,
        borderRadius: '6px',
        overflow: 'hidden',
      }}>
        {/* Collapsible header */}
        <button
          onClick={() => setFooterOpen(!footerOpen)}
          style={{
            width: '100%',
            padding: '10px 12px',
            backgroundColor: SIDEBAR_COLORS.panelAlt,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#E5E5E5',
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          {footerOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <FileText size={14} style={{ color: '#5C5CFF' }} />
          Patička stránky
          <div style={{ marginLeft: 'auto' }}>
            <ToggleSwitch
              checked={ftr.enabled}
              onChange={(v) => updateFooter({ enabled: v })}
            />
          </div>
        </button>

        {footerOpen && ftr.enabled && (
          <div style={{ padding: '12px', borderTop: '1px solid #334155' }}>
            {/* Separator toggle */}
            <SettingToggle
              label="Oddělovací čára"
              checked={ftr.showSeparator !== false}
              onChange={(v) => updateFooter({ showSeparator: v })}
            />

            {/* Left content */}
            <label style={{ ...sectionLabelStyle, marginTop: '12px' }}>Levý sloupec</label>
            <div style={{ display: 'flex', gap: '3px', marginBottom: '8px' }}>
              {FOOTER_LEFT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateFooter({ leftType: opt.value as any })}
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    backgroundColor: (ftr.leftType || 'branding') === opt.value ? '#5C5CFF' : '#334155',
                    color: (ftr.leftType || 'branding') === opt.value ? 'white' : '#94a3b8',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: 500,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {ftr.leftType === 'text' && (
              <textarea
                value={ftr.leftText || ''}
                onChange={(e) => updateFooter({ leftText: e.target.value })}
                placeholder="Text patičky..."
                rows={2}
                style={{ ...darkInputStyle, resize: 'vertical', marginBottom: '8px' }}
              />
            )}

            {/* Right content */}
            <label style={sectionLabelStyle}>Pravý sloupec</label>
            <div style={{ display: 'flex', gap: '3px', marginBottom: '8px' }}>
              {FOOTER_RIGHT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateFooter({ rightType: opt.value as any })}
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    backgroundColor: (ftr.rightType || 'feedback') === opt.value ? '#5C5CFF' : '#334155',
                    color: (ftr.rightType || 'feedback') === opt.value ? 'white' : '#94a3b8',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: 500,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Feedback settings */}
            {(ftr.rightType === 'feedback' || ftr.rightType === undefined) && (
              <div style={{ marginBottom: '8px' }}>
                <label style={sectionLabelStyle}>Styl zpětné vazby</label>
                <div style={{ display: 'flex', gap: '3px', marginBottom: '6px' }}>
                  {FEEDBACK_STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateFooter({ feedbackStyle: opt.value })}
                      style={{
                        flex: 1,
                        padding: '6px 4px',
                        backgroundColor: (ftr.feedbackStyle || 'faces') === opt.value ? '#5C5CFF' : '#334155',
                        color: (ftr.feedbackStyle || 'faces') === opt.value ? 'white' : '#94a3b8',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                      }}
                    >
                      {opt.icon}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={ftr.feedbackText || ''}
                  onChange={(e) => updateFooter({ feedbackText: e.target.value })}
                  placeholder="Jak se ti odpovídalo na tento pracovní list?"
                  style={darkInputStyle}
                />
              </div>
            )}

            {/* Custom text for right column */}
            {ftr.rightType === 'text' && (
              <textarea
                value={ftr.rightText || ''}
                onChange={(e) => updateFooter({ rightText: e.target.value })}
                placeholder="Text..."
                rows={2}
                style={{ ...darkInputStyle, resize: 'vertical' }}
              />
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

// ============================================
// SHARED UI HELPERS
// ============================================

const sectionLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 500,
  color: '#808080',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const darkInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  backgroundColor: '#334155',
  border: '1px solid #475569',
  borderRadius: '4px',
  color: '#E5E5E5',
  fontSize: '11px',
  outline: 'none',
};

const HEADER_LINE_COLORS = [
  { value: '#94a3b8', label: 'Šedá' },
  { value: '#3b82f6', label: 'Modrá' },
  { value: '#22c55e', label: 'Zelená' },
  { value: '#f59e0b', label: 'Žlutá' },
  { value: '#ef4444', label: 'Červená' },
  { value: '#a855f7', label: 'Fialová' },
  { value: '#ec4899', label: 'Růžová' },
  { value: '#06b6d4', label: 'Tyrkys' },
  { value: '#f97316', label: 'Oranžová' },
  { value: '#1e293b', label: 'Tmavá' },
];

const FOOTER_LEFT_OPTIONS = [
  { value: 'branding', label: 'Logo' },
  { value: 'text', label: 'Text' },
  { value: 'none', label: 'Nic' },
];

const FOOTER_RIGHT_OPTIONS = [
  { value: 'feedback', label: 'Zpětná vazba' },
  { value: 'pageNumber', label: 'Strana' },
  { value: 'text', label: 'Text' },
  { value: 'none', label: 'Nic' },
];

const FEEDBACK_STYLE_OPTIONS: { value: FooterFeedbackStyle; icon: string }[] = [
  { value: 'faces', icon: '😊😐😞' },
  { value: 'smileys', icon: '😢🙁😐🙂😊' },
  { value: 'hearts', icon: '💔🖤🤍🩷❤️' },
  { value: 'stars', icon: '☆☆☆☆★' },
];

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      style={{
        width: '32px',
        height: '18px',
        borderRadius: '9px',
        backgroundColor: checked ? '#5C5CFF' : '#475569',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background-color 0.15s ease',
      }}
    >
      <div style={{
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        backgroundColor: 'white',
        position: 'absolute',
        top: '2px',
        left: checked ? '16px' : '2px',
        transition: 'left 0.15s ease',
      }} />
    </div>
  );
}

function SettingToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
      }}
      onClick={() => onChange(!checked)}
    >
      <span style={{ fontSize: '11px', color: '#E5E5E5' }}>{label}</span>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );
}
