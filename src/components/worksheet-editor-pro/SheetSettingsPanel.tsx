/**
 * SheetSettingsPanel - Dark mode panel for sheet settings in PRO editor
 * 
 * Figma-inspired dark theme with grid system settings.
 */

import { useState } from 'react';
import { LayoutGrid, Eye, EyeOff, Layers, Move, Palette, X, ChevronDown, ChevronRight, FileText, MessageSquare, Hash, Type as TypeIcon } from 'lucide-react';
import { GridColumns, GridGap, GRID_GAP_VALUES, GlobalFontSize, PageHeaderConfig, PageFooterConfig, FooterFeedbackStyle } from '../../types/worksheet';
import { DEFAULT_HEADER, DEFAULT_FOOTER } from './PageHeaderFooter';

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

interface SheetSettingsPanelProps {
  gridColumns: GridColumns;
  gridGap: GridGap;
  globalFontSize: GlobalFontSize;
  pageFormat: 'a4' | 'b5' | 'a5';
  showGridOverlay: boolean;
  layoutMode: LayoutMode;
  pageBackgroundColor?: string;
  pageHeader?: PageHeaderConfig;
  pageFooter?: PageFooterConfig;
  onGridColumnsChange: (columns: GridColumns) => void;
  onGridGapChange: (gap: GridGap) => void;
  onGlobalFontSizeChange: (size: GlobalFontSize) => void;
  onShowGridOverlayChange: (show: boolean) => void;
  onLayoutModeChange: (mode: LayoutMode) => void;
  onPageBackgroundColorChange: (color: string | undefined) => void;
  onPageHeaderChange: (config: PageHeaderConfig) => void;
  onPageFooterChange: (config: PageFooterConfig) => void;
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

// Font size options  
const FONT_SIZE_OPTIONS: { value: GlobalFontSize; label: string }[] = [
  { value: 'small', label: 'S' },
  { value: 'normal', label: 'M' },
  { value: 'large', label: 'L' },
];

export function SheetSettingsPanel({
  gridColumns,
  gridGap,
  globalFontSize,
  pageFormat,
  showGridOverlay,
  layoutMode,
  pageBackgroundColor,
  pageHeader,
  pageFooter,
  onGridColumnsChange,
  onGridGapChange,
  onGlobalFontSizeChange,
  onShowGridOverlayChange,
  onLayoutModeChange,
  onPageBackgroundColorChange,
  onPageHeaderChange,
  onPageFooterChange,
}: SheetSettingsPanelProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [footerOpen, setFooterOpen] = useState(false);
  
  const hdr = { ...DEFAULT_HEADER, ...pageHeader };
  const ftr = { ...DEFAULT_FOOTER, ...pageFooter };
  
  const updateHeader = (updates: Partial<PageHeaderConfig>) => {
    onPageHeaderChange({ ...hdr, ...updates });
  };
  const updateFooter = (updates: Partial<PageFooterConfig>) => {
    onPageFooterChange({ ...ftr, ...updates });
  };
  
  return (
    <div style={{ 
      padding: '12px',
      height: '100%',
      overflowY: 'auto',
      backgroundColor: '#1e293b',
      color: '#E5E5E5',
    }}>
      {/* Header */}
      <div style={{ 
        fontSize: '11px', 
        fontWeight: 600, 
        color: '#808080', 
        marginBottom: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <LayoutGrid size={14} style={{ color: '#5C5CFF' }} />
        Nastavení listu
      </div>

      {/* Layout Mode Toggle */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ 
          display: 'block', 
          fontSize: '11px', 
          fontWeight: 500, 
          color: '#808080', 
          marginBottom: '6px' 
        }}>
          Režim
        </label>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => onLayoutModeChange('grid')}
            style={{
              flex: 1,
              padding: '8px 6px',
              backgroundColor: layoutMode === 'grid' ? '#5C5CFF' : '#334155',
              color: layoutMode === 'grid' ? 'white' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 500,
              transition: 'all 0.1s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Layers size={16} />
            Grid
          </button>
          <button
            onClick={() => onLayoutModeChange('freeform')}
            style={{
              flex: 1,
              padding: '8px 6px',
              backgroundColor: layoutMode === 'freeform' ? '#5C5CFF' : '#334155',
              color: layoutMode === 'freeform' ? 'white' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 500,
              transition: 'all 0.1s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Move size={16} />
            Freeform
          </button>
        </div>
      </div>

      {/* Page Format Info */}
      <div style={{ 
        marginBottom: '16px', 
        padding: '10px', 
        backgroundColor: '#334155', 
        borderRadius: '6px',
      }}>
        <label style={{ fontSize: '10px', color: '#808080', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Formát
        </label>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#E5E5E5', marginTop: '2px' }}>
          {pageFormat.toUpperCase()}
          <span style={{ fontSize: '11px', fontWeight: 400, color: '#808080', marginLeft: '6px' }}>
            {pageFormat === 'a4' ? '210×297' : pageFormat === 'b5' ? '176×250' : '148×210'}
          </span>
        </div>
      </div>

      {/* Page Background Color */}
      <div style={{ marginBottom: '16px', position: 'relative' }}>
        <label style={{ 
          display: 'block', 
          fontSize: '10px', 
          fontWeight: 500, 
          color: '#808080', 
          marginBottom: '6px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Barva stránky
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Color preview button */}
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              border: pageBackgroundColor ? 'none' : '2px dashed #5C5C5C',
              backgroundColor: pageBackgroundColor || '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: pageBackgroundColor ? '0 1px 3px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {!pageBackgroundColor && <Palette size={14} style={{ color: '#808080' }} />}
          </button>
          
          {/* Color name/value */}
          <span style={{ fontSize: '11px', color: '#94a3b8', flex: 1 }}>
            {pageBackgroundColor 
              ? PAGE_COLORS.find(c => c.value === pageBackgroundColor)?.label || pageBackgroundColor
              : 'Bílá (výchozí)'}
          </span>
          
          {/* Clear button */}
          {pageBackgroundColor && pageBackgroundColor !== '#FFFFFF' && (
            <button
              onClick={() => onPageBackgroundColorChange(undefined)}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: '#334155',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Obnovit výchozí"
            >
              <X size={12} style={{ color: '#808080' }} />
            </button>
          )}
        </div>

        {/* Color picker dropdown */}
        {showColorPicker && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '8px',
              padding: '12px',
              backgroundColor: '#1e293b',
              borderRadius: '8px',
              border: '1px solid #334155',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              zIndex: 1000,
            }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '6px',
              marginBottom: '10px',
            }}>
              {PAGE_COLORS.map((color) => (
                <div
                  key={color.value}
                  title={color.label}
                  onClick={() => {
                    onPageBackgroundColorChange(color.value);
                    setShowColorPicker(false);
                  }}
                  style={{
                    width: '24px',
                    height: '24px',
                    backgroundColor: color.value,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    border: pageBackgroundColor === color.value 
                      ? '2px solid #5C5CFF' 
                      : color.value === '#FFFFFF' ? '1px solid #475569' : 'none',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
                />
              ))}
            </div>
            <div
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'color';
                input.value = pageBackgroundColor || '#FFFFFF';
                input.onchange = (e) => {
                  onPageBackgroundColorChange((e.target as HTMLInputElement).value);
                  setShowColorPicker(false);
                };
                input.click();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '6px',
                backgroundColor: '#334155',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '10px',
                color: '#E5E5E5',
              }}
            >
              <Palette size={12} />
              Vlastní barva...
            </div>
          </div>
        )}
      </div>

      {/* Grid Settings Group */}
      <div style={{ 
        marginBottom: '16px',
        padding: '10px',
        backgroundColor: '#1e293b',
        borderRadius: '6px',
        border: '1px solid #334155',
      }}>
        {/* Grid Columns */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '10px', 
            fontWeight: 500, 
            color: '#808080', 
            marginBottom: '6px' 
          }}>
            Sloupce
          </label>
          <div style={{ display: 'flex', gap: '3px' }}>
            {GRID_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onGridColumnsChange(option.value)}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  backgroundColor: gridColumns === option.value ? '#5C5CFF' : '#334155',
                  color: gridColumns === option.value ? 'white' : '#94a3b8',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  transition: 'all 0.1s ease',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Gap */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '10px', 
            fontWeight: 500, 
            color: '#808080', 
            marginBottom: '6px' 
          }}>
            Mezera
          </label>
          <div style={{ display: 'flex', gap: '3px' }}>
            {GAP_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onGridGapChange(option.value)}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  backgroundColor: gridGap === option.value ? '#5C5CFF' : '#334155',
                  color: gridGap === option.value ? 'white' : '#94a3b8',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  transition: 'all 0.1s ease',
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
            width: '100%',
            padding: '6px 8px',
            backgroundColor: showGridOverlay ? '#5C5CFF' : '#334155',
            color: showGridOverlay ? 'white' : '#94a3b8',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '10px',
            fontWeight: 500,
            transition: 'all 0.1s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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

      {/* Font Size */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ 
          display: 'block', 
          fontSize: '10px', 
          fontWeight: 500, 
          color: '#808080', 
          marginBottom: '6px' 
        }}>
          Velikost textu
        </label>
        <div style={{ display: 'flex', gap: '3px' }}>
          {FONT_SIZE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onGlobalFontSizeChange(option.value)}
              style={{
                flex: 1,
                padding: '6px 0',
                backgroundColor: globalFontSize === option.value ? '#5C5CFF' : '#334155',
                color: globalFontSize === option.value ? 'white' : '#94a3b8',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.1s ease',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* ============ HLAVIČKA ============ */}
      <div style={{
        marginBottom: '12px',
        border: '1px solid #334155',
        borderRadius: '6px',
        overflow: 'hidden',
      }}>
        {/* Collapsible header */}
        <button
          onClick={() => setHeaderOpen(!headerOpen)}
          style={{
            width: '100%',
            padding: '10px 12px',
            backgroundColor: '#1e293b',
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
        border: '1px solid #334155',
        borderRadius: '6px',
        overflow: 'hidden',
      }}>
        {/* Collapsible header */}
        <button
          onClick={() => setFooterOpen(!footerOpen)}
          style={{
            width: '100%',
            padding: '10px 12px',
            backgroundColor: '#1e293b',
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
