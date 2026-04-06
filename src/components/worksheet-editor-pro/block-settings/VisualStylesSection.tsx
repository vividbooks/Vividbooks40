import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus, ChevronDown as ChevronDownIcon, Palette, Check,
  Blend, RectangleHorizontal, SquareRoundCorner,
  ArrowUpToLine, ArrowDownToLine, AlignVerticalJustifyCenter,
  Layers,
} from 'lucide-react';
import type { WorksheetBlock } from '../../../types/worksheet';
import { flattenDesignSystemSwatchesForPicker, type DesignSystem } from '../../../types/design-system';
import {
  SIDEBAR_COLORS,
  sectionTitleStyle,
  sectionHeaderRowStyle,
  subtleCardStyle,
  labelStyle,
  buttonStyle,
  iconButtonStyle,
  getSegmentedButtonStyle,
  TEXT_COLORS,
} from './shared';
import { ColorPickerField } from './ColorPickerField';

const STYLE_PRESETS = [
  { id: 'none', label: 'Žádný', styles: { backgroundColor: undefined, borderColor: undefined, borderWidth: undefined, borderStyle: undefined, borderRadius: undefined, shadow: undefined } },
  { id: 'border', label: 'Rámeček', styles: { backgroundColor: undefined, borderColor: '#374151', borderWidth: 1, borderStyle: 'solid' as const, borderRadius: 8, shadow: undefined } },
  { id: 'card', label: 'Karta', styles: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', borderWidth: 1, borderStyle: 'solid' as const, borderRadius: 12, shadow: 'medium' as const } },
  { id: 'highlight', label: 'Zvýraznění', styles: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 2, borderStyle: 'dashed' as const, borderRadius: 8, shadow: undefined } },
  { id: 'info', label: 'Info', styles: { backgroundColor: '#DBEAFE', borderColor: '#3B82F6', borderWidth: 2, borderStyle: 'solid' as const, borderRadius: 8, shadow: undefined } },
];

/** Sdílené presety pro Design systém (výchozí vzhled bloku). */
export const BLOCK_VISUAL_STYLE_PRESETS = STYLE_PRESETS;


interface VisualStylesSectionProps {
  block: WorksheetBlock;
  onUpdateBlock: (id: string, patch: any) => void;
  showVisualAdvanced: boolean;
  setShowVisualAdvanced: (v: boolean) => void;
  designSystem?: DesignSystem | null;
  compact?: boolean;
  isSectionOpen?: boolean;
}

export function VisualStylesSection({
  block,
  onUpdateBlock,
  showVisualAdvanced,
  setShowVisualAdvanced,
  designSystem,
  compact = false,
  isSectionOpen = true,
}: VisualStylesSectionProps) {
  const dsSwatches = useMemo(
    () => flattenDesignSystemSwatchesForPicker(designSystem?.colors),
    [designSystem?.colors],
  );
  const useDsColors = dsSwatches.length > 0;
  const getCurrentPreset = () => {
    const vs = block.visualStyles;
    if (!vs || (!vs.backgroundColor && !vs.borderColor && !vs.shadow)) return 'none';
    for (const preset of STYLE_PRESETS) {
      if (preset.id === 'none') continue;
      const ps = preset.styles;
      if (vs.backgroundColor === ps.backgroundColor && 
          vs.borderColor === ps.borderColor && 
          vs.borderWidth === ps.borderWidth &&
          vs.borderRadius === ps.borderRadius &&
          vs.shadow === ps.shadow) {
        return preset.id;
      }
    }
    return 'custom';
  };

  const currentPreset = getCurrentPreset();

  if (compact && !isSectionOpen) {
    return null;
  }

  return (
    <>
        {/* Visual Styles Section */}
        <div style={compact ? { marginBottom: '16px' } : { marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${SIDEBAR_COLORS.panelBorder}` }}>
          {!compact && (
            <div style={sectionHeaderRowStyle}>
              <span style={sectionTitleStyle}>Vzhled bloku</span>
              <button
                onClick={() => {
                  const name = prompt('Název vzhledu bloku:');
                  if (name) {
                    toast.success(`Vzhled "${name}" byl uložen do knihovny.`);
                  }
                }}
                style={{
                  ...iconButtonStyle,
                  backgroundColor: 'transparent',
                  color: '#808080',
                }}
                title="Uložit vzhled bloku"
              >
                <Plus size={14} />
              </button>
            </div>
          )}
                  
          {/* Style Presets Grid - Minimalist Squares (hidden for infobox – has its own preset grid above) */}
        {block.type !== 'infobox' && <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(6, 1fr)', 
            gap: '6px',
            marginBottom: '16px' 
          }}>
              {STYLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    onUpdateBlock(block.id, { visualStyles: { ...block.visualStyles, ...preset.styles } });
                    setShowVisualAdvanced(false);
                  }}
                title={preset.label}
                  style={{
                    ...buttonStyle,
                    width: '100%',
                    aspectRatio: '1/1',
                    padding: '4px',
                      backgroundColor: SIDEBAR_COLORS.panelAlt,
                    border: currentPreset === preset.id ? '2px solid #5C5CFF' : '1px solid #334155',
                    borderRadius: '6px',
                    justifyContent: 'center',
                    position: 'relative',
                }}
              >
                <div style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: preset.styles.backgroundColor || '#334155',
                  border: preset.styles.borderColor ? `${Math.min(2, preset.styles.borderWidth ?? 1)}px ${preset.styles.borderStyle || 'solid'} ${preset.styles.borderColor}` : 'none',
                  borderRadius: '3px',
                  boxShadow: preset.styles.shadow === 'medium' ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
                }} />
                </button>
              ))}
            
            {/* Custom Style Button */}
              <button
              onClick={() => setShowVisualAdvanced(!showVisualAdvanced)}
              title="Vlastní nastavení"
                style={{
                  ...buttonStyle,
                width: '100%',
                aspectRatio: '1/1',
                padding: '4px',
                backgroundColor: SIDEBAR_COLORS.panelAlt,
                border: (currentPreset === 'custom' || showVisualAdvanced) ? '2px solid #5C5CFF' : '1px solid #334155',
                borderRadius: '6px',
                  justifyContent: 'center',
              }}
            >
              <div style={{
                width: '100%',
                height: '100%',
                border: '1px dashed #475569',
                borderRadius: '3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Palette size={12} style={{ color: '#808080' }} />
              </div>
              </button>
          </div>}

          {/* Collapsible Advanced Visual Settings */}
          <div 
            style={{
              borderTop: `1px solid ${SIDEBAR_COLORS.panelBorder}`,
              paddingTop: '8px',
              marginTop: '8px',
            }}
          >
            <button
              onClick={() => setShowVisualAdvanced(!showVisualAdvanced)}
              style={{
                ...buttonStyle,
                width: '100%',
                justifyContent: 'space-between',
                backgroundColor: 'transparent',
                padding: '4px 0',
              }}
            >
              <span style={{ ...labelStyle, marginBottom: 0 }}>Další nastavení</span>
              <ChevronDownIcon size={12} style={{ transform: (showVisualAdvanced || currentPreset === 'custom') ? 'rotate(180deg)' : 'none' }} />
            </button>

            {(showVisualAdvanced || currentPreset === 'custom') && (
              <div style={{ marginTop: '12px' }}>
              {/* ROW 1: Background & Border Colors */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  {/* Background Color */}
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Pozadí</span>
                    <ColorPickerField
                      value={block.visualStyles?.backgroundColor}
                      placeholder="Vlastní barva"
                      designSystemSwatches={dsSwatches}
                      palette={useDsColors ? [] : TEXT_COLORS}
                      designSystemOnly={useDsColors}
                      defaultCustomColor="#ffffff"
                      onChange={(color) => onUpdateBlock(block.id, {
                        visualStyles: { ...block.visualStyles, backgroundColor: color }
                      })}
                      onClear={() => onUpdateBlock(block.id, {
                        visualStyles: { ...block.visualStyles, backgroundColor: undefined }
                      })}
                    />
              </div>

              {/* Border Color */}
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Ohraničení</span>
                <ColorPickerField
                  value={block.visualStyles?.borderColor}
                  placeholder="Vlastní barva"
                  designSystemSwatches={dsSwatches}
                  palette={useDsColors ? [] : TEXT_COLORS}
                  designSystemOnly={useDsColors}
                  defaultCustomColor="#3b82f6"
                  swatchStyle="border"
                  borderStyle={block.visualStyles?.borderStyle || 'solid'}
                  onChange={(color) =>                   onUpdateBlock(block.id, {
                    visualStyles: {
                      ...block.visualStyles,
                      borderColor: color,
                      borderWidth: block.visualStyles?.borderWidth ?? 2,
                      borderStyle: block.visualStyles?.borderStyle || 'solid',
                    }
                  })}
                  onClear={() => onUpdateBlock(block.id, {
                    visualStyles: { ...block.visualStyles, borderColor: undefined, borderWidth: undefined, borderStyle: undefined }
                  })}
                />
              </div>
            </div>
          </div>

          {/* ROW 2: Border Width, Style, and Border Radius - only show if border color is set */}
          {block.visualStyles?.borderColor && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                {/* Border Width Dropdown */}
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Tloušťka</span>
                  <select
                    value={block.visualStyles?.borderWidth ?? 2}
                    onChange={(e) => onUpdateBlock(block.id, {
                      visualStyles: { ...block.visualStyles, borderWidth: parseInt(e.target.value) }
                    })}
                    style={{
                      width: '100%',
                      padding: '8px 6px',
                      backgroundColor: '#334155',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#E5E5E5',
                      fontSize: '11px',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 8].map((w) => (
                      <option key={w} value={w}>{w}px</option>
                    ))}
                  </select>
                </div>

                {/* Border Style */}
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Styl</span>
                  <select
                    value={block.visualStyles?.borderStyle || 'solid'}
                    onChange={(e) => onUpdateBlock(block.id, {
                      visualStyles: { ...block.visualStyles, borderStyle: e.target.value as 'solid' | 'dashed' | 'dotted' }
                    })}
                    style={{
                      width: '100%',
                      padding: '8px 6px',
                      backgroundColor: '#334155',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#E5E5E5',
                      fontSize: '11px',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="solid">Plná</option>
                    <option value="dashed">Přerušovaná</option>
                    <option value="dotted">Tečkovaná</option>
                  </select>
                </div>

                {/* Border Radius */}
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Zaoblení</span>
                  <select
                    value={block.visualStyles?.borderRadius || 0}
                    onChange={(e) => onUpdateBlock(block.id, {
                      visualStyles: { ...block.visualStyles, borderRadius: parseInt(e.target.value) }
                    })}
                    style={{
                      width: '100%',
                      padding: '8px 6px',
                      backgroundColor: '#334155',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#E5E5E5',
                      fontSize: '11px',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    {[0, 4, 8, 12, 16, 24, 32].map((r) => (
                      <option key={r} value={r}>{r}px</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

              {!block.visualStyles?.borderColor && (
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>
                    Zaoblení rohů
                  </span>
                  <select
                    value={block.visualStyles?.borderRadius ?? 0}
                    onChange={(e) => onUpdateBlock(block.id, {
                      visualStyles: { ...block.visualStyles, borderRadius: parseInt(e.target.value, 10) }
                    })}
                    style={{
                      width: '100%',
                      padding: '8px 6px',
                      backgroundColor: '#334155',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#E5E5E5',
                      fontSize: '11px',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    {[0, 4, 8, 12, 16, 24, 32].map((r) => (
                      <option key={r} value={r}>{r}px</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Shadow */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#CCCCCC' }}>Stín</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['none', 'small', 'medium', 'large'] as const).map((shadowType) => (
                    <button
                      key={shadowType}
                      onClick={() => onUpdateBlock(block.id, {
                        visualStyles: { ...block.visualStyles, shadow: shadowType }
                      })}
                      style={{
                        ...buttonStyle,
                        flex: 1,
                        justifyContent: 'center',
                        backgroundColor: (block.visualStyles?.shadow || 'none') === shadowType ? '#5C5CFF' : '#334155',
                        color: (block.visualStyles?.shadow || 'none') === shadowType ? 'white' : '#94a3b8',
                        padding: '6px 4px',
                        fontSize: '10px',
                      }}
                    >
                      {shadowType === 'none' ? 'Žádný' : 
                       shadowType === 'small' ? 'S' : 
                       shadowType === 'medium' ? 'M' : 'L'}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}
              </div>

        </div>

    </>
  );
}
