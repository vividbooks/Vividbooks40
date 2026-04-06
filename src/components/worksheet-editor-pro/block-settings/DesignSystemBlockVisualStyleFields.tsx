/**
 * Stejné pole jako „Další nastavení“ u vzhledu bloku v Pro editoru (Pozadí, Ohraničení, stín, odsazení).
 * Obsahuje i Sloupce textu (jako u odstavce v editoru) — uplatní se u nových odstavců z výchozího stylu DS.
 * Zaoblení rohů je vždy vidět (u ohraničení i samostatně bez rámu).
 */

import { useMemo, useState, type CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';
import type { BlockVisualStyles } from '../../../types/worksheet';
import { flattenDesignSystemSwatchesForPicker, type DesignSystem } from '../../../types/design-system';
import { labelStyle, subtleCardStyle, buttonStyle, TEXT_COLORS } from './shared';
import { ColorPickerField } from './ColorPickerField';

const selectBase: CSSProperties = {
  width: '100%',
  padding: '8px 6px',
  backgroundColor: '#334155',
  border: 'none',
  borderRadius: '6px',
  color: '#E5E5E5',
  fontSize: '11px',
  cursor: 'pointer',
  outline: 'none',
};

export function DesignSystemBlockVisualStyleFields({
  styles,
  onChange,
  designSystem,
}: {
  styles: BlockVisualStyles;
  onChange: (next: BlockVisualStyles) => void;
  designSystem: DesignSystem | null;
}) {
  const [showAdvanced, setShowAdvanced] = useState(true);

  const dsSwatches = useMemo(
    () => flattenDesignSystemSwatchesForPicker(designSystem?.colors),
    [designSystem?.colors],
  );
  const useDsColors = dsSwatches.length > 0;

  const patch = (p: Partial<BlockVisualStyles>) => {
    onChange({ ...styles, ...p });
  };

  const pad = typeof styles.padding === 'number' && Number.isFinite(styles.padding) ? styles.padding : 0;
  const hasBorder = Boolean(styles.borderColor);

  const textCols = styles.textColumns ?? 1;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <span style={{ ...labelStyle, display: 'block', marginBottom: 8 }}>SLOUPCE TEXTU</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {([1, 2, 3] as const).map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => patch({ textColumns: col === 1 ? undefined : col })}
              style={{
                ...buttonStyle,
                flex: 1,
                justifyContent: 'center',
                padding: '8px 4px',
                fontSize: 12,
                backgroundColor: textCols === col ? '#3b82f6' : '#334155',
                color: textCols === col ? 'white' : '#e5e7eb',
              }}
            >
              {col === 1 ? '▌ 1 sloupec' : col === 2 ? '▌▌ 2 sloupce' : '▌▌▌ 3 sloupce'}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        style={{
          ...buttonStyle,
          width: '100%',
          justifyContent: 'space-between',
          backgroundColor: 'transparent',
          padding: '4px 0',
          marginBottom: showAdvanced ? 12 : 0,
        }}
      >
        <span style={{ ...labelStyle, marginBottom: 0 }}>Další nastavení</span>
        <ChevronDown
          size={12}
          style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', color: '#94a3b8' }}
        />
      </button>

      {showAdvanced && (
        <div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Pozadí</span>
                <ColorPickerField
                  value={styles.backgroundColor}
                  placeholder="Vlastní barva"
                  designSystemSwatches={dsSwatches}
                  palette={useDsColors ? [] : TEXT_COLORS}
                  designSystemOnly={useDsColors}
                  defaultCustomColor="#ffffff"
                  onChange={(color) => patch({ backgroundColor: color })}
                  onClear={() => patch({ backgroundColor: undefined })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Ohraničení</span>
                <ColorPickerField
                  value={styles.borderColor}
                  placeholder="Vlastní barva"
                  designSystemSwatches={dsSwatches}
                  palette={useDsColors ? [] : TEXT_COLORS}
                  designSystemOnly={useDsColors}
                  defaultCustomColor="#3b82f6"
                  swatchStyle="border"
                  borderStyle={styles.borderStyle || 'solid'}
                  onChange={(color) =>
                    patch({
                      borderColor: color,
                      borderWidth: styles.borderWidth ?? 2,
                      borderStyle: styles.borderStyle || 'solid',
                    })
                  }
                  onClear={() => patch({ borderColor: undefined, borderWidth: undefined, borderStyle: undefined })}
                />
              </div>
            </div>
          </div>

          {hasBorder && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Tloušťka</span>
                  <select
                    value={styles.borderWidth ?? 2}
                    onChange={(e) => patch({ borderWidth: parseInt(e.target.value, 10) })}
                    style={selectBase}
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 8].map((w) => (
                      <option key={w} value={w}>
                        {w}px
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Styl</span>
                  <select
                    value={styles.borderStyle || 'solid'}
                    onChange={(e) =>
                      patch({ borderStyle: e.target.value as 'solid' | 'dashed' | 'dotted' })
                    }
                    style={selectBase}
                  >
                    <option value="solid">Plná</option>
                    <option value="dashed">Přerušovaná</option>
                    <option value="dotted">Tečkovaná</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Zaoblení</span>
                  <select
                    value={styles.borderRadius ?? 0}
                    onChange={(e) => patch({ borderRadius: parseInt(e.target.value, 10) })}
                    style={selectBase}
                  >
                    {[0, 4, 8, 12, 16, 24, 32].map((r) => (
                      <option key={r} value={r}>
                        {r}px
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {!hasBorder && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>
                Zaoblení rohů
              </span>
              <select
                value={styles.borderRadius ?? 0}
                onChange={(e) => patch({ borderRadius: parseInt(e.target.value, 10) })}
                style={{ ...selectBase, width: '100%' }}
              >
                {[0, 4, 8, 12, 16, 24, 32].map((r) => (
                  <option key={r} value={r}>
                    {r}px
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: '12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#CCCCCC' }}>Stín</span>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['none', 'small', 'medium', 'large'] as const).map((shadowType) => (
                <button
                  key={shadowType}
                  type="button"
                  onClick={() => patch({ shadow: shadowType })}
                  style={{
                    ...buttonStyle,
                    flex: 1,
                    justifyContent: 'center',
                    backgroundColor: (styles.shadow || 'none') === shadowType ? '#5C5CFF' : '#334155',
                    color: (styles.shadow || 'none') === shadowType ? 'white' : '#94a3b8',
                    padding: '6px 4px',
                    fontSize: '10px',
                  }}
                >
                  {shadowType === 'none' ? 'Žádný' : shadowType === 'small' ? 'S' : shadowType === 'medium' ? 'M' : 'L'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <span style={{ ...labelStyle, display: 'block', marginBottom: '8px' }}>Odsazení obsahu</span>
            <div style={{ ...subtleCardStyle, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '70px',
                    height: '50px',
                    backgroundColor: '#475569',
                    borderRadius: '6px',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: '#5C5CFF',
                      opacity: 0.3,
                      transition: 'all 0.15s ease',
                    }}
                  />
                  <div
                    style={{
                      backgroundColor: '#1e293b',
                      borderRadius: '3px',
                      transition: 'all 0.15s ease',
                      width: `${Math.max(20, 100 - pad * 1.5)}%`,
                      height: `${Math.max(20, 100 - pad * 2)}%`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '60%',
                        height: '3px',
                        backgroundColor: '#808080',
                        borderRadius: '2px',
                      }}
                    />
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '4px',
                    }}
                  >
                    <span style={{ fontSize: '9px', color: '#94a3b8' }}>Okraje</span>
                    <span style={{ fontSize: '10px', color: '#EEEEEE', fontWeight: 600 }}>{pad}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={48}
                    step={1}
                    value={pad}
                    onChange={(e) => patch({ padding: parseInt(e.target.value, 10) })}
                    style={{
                      width: '100%',
                      height: '4px',
                      appearance: 'none',
                      backgroundColor: '#475569',
                      borderRadius: '2px',
                      cursor: 'pointer',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '3px', marginTop: '6px' }}>
                    {[0, 8, 16, 24, 32, 48].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => patch({ padding: val })}
                        style={{
                          ...buttonStyle,
                          flex: 1,
                          padding: '3px 1px',
                          fontSize: '8px',
                          backgroundColor: pad === val ? '#5C5CFF' : '#334155',
                          color: pad === val ? 'white' : '#94a3b8',
                          justifyContent: 'center',
                        }}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
