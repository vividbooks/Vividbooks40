/**
 * Sdílený blok „DALŠÍ NASTAVENÍ“ pro typografické styly design systému.
 * Použití: DesignSystemPanel (sidebar) + DesignSystemCanvasWorkspace (popup).
 */

import { useState, useMemo } from 'react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  ArrowUpToLine,
  ArrowDownToLine,
  AlignVerticalJustifyCenter,
  ChevronDown,
} from 'lucide-react';
import type { DesignSystem, TypoStyleOverride } from '../../types/design-system';
import { buildDesignSystemFontPickList, extractFontFamilyName } from '../../types/design-system';
import { inputStyle, labelStyle, buttonStyle, FONT_SIZES } from './block-settings/shared';
import { FontFamilySelect } from './block-settings/FontFamilySelect';

export type TypographyStyleId = 'h1' | 'h2' | 'h3' | 'body' | 'caption';

const BASE_PT: Record<TypographyStyleId, number> = { h1: 36, h2: 24, h3: 18, body: 12, caption: 9 };
const BASE_WEIGHT: Record<TypographyStyleId, number> = { h1: 700, h2: 700, h3: 600, body: 400, caption: 400 };

/** `variant: 'dialog'` — bez skládací hlavičky (popup na design plátně). */
export function TypoStyleSettings({
  styleId,
  typography,
  onChange,
  variant = 'panel',
}: {
  styleId: TypographyStyleId;
  typography: DesignSystem['typography'];
  onChange: (v: DesignSystem['typography']) => void;
  variant?: 'panel' | 'dialog';
}) {
  const [showCustomStyles, setShowCustomStyles] = useState(true);
  const overrides = typography.styles?.[styleId] ?? {};
  const patch = (p: Partial<TypoStyleOverride>) =>
    onChange({ ...typography, styles: { ...typography.styles, [styleId]: { ...overrides, ...p } } });

  const fontPickList = useMemo(() => buildDesignSystemFontPickList(typography), [typography]);
  const defaultForStyle = useMemo(() => {
    const isHeading = styleId === 'h1' || styleId === 'h2' || styleId === 'h3';
    return isHeading
      ? `'${typography.headingFont}', serif`
      : `'${typography.bodyFont}', sans-serif`;
  }, [styleId, typography.headingFont, typography.bodyFont]);
  const fontFamily = overrides.fontFamily ?? defaultForStyle;
  const fontFamilyOptions = useMemo(() => {
    const list = [...fontPickList];
    if (!list.some((o) => o.value === fontFamily)) {
      list.unshift({
        label: `${extractFontFamilyName(fontFamily)} (vlastní)`,
        value: fontFamily,
      });
    }
    return list;
  }, [fontPickList, fontFamily]);
  const fontWeight = overrides.fontWeight ?? BASE_WEIGHT[styleId];
  const fontSize = overrides.fontSize ?? BASE_PT[styleId];
  const lineHeight = overrides.lineHeight ?? 1.5;
  const letterSpacing = overrides.letterSpacing ?? 0;
  const align = overrides.textAlign ?? 'left';
  const textColor = overrides.textColor ?? '#1E293B';
  const verticalAlign = 'top';
  const isBold = overrides.isBold ?? false;
  const isItalic = overrides.isItalic ?? false;
  const isUnderline = overrides.isUnderline ?? false;

  const ChevronDownIcon = ChevronDown;

  const weightSelectValue =
    fontWeight === 400 ? 'normal' : fontWeight === 700 ? 'bold' : String(fontWeight);

  const settingsForm = (
    <div style={{ marginTop: variant === 'dialog' ? 0 : '12px' }}>
      <div style={{ marginBottom: '10px' }}>
        <FontFamilySelect
          value={fontFamily}
          options={fontFamilyOptions}
          onChange={(v) => patch({ fontFamily: v })}
          triggerStyle={{ ...inputStyle, cursor: 'pointer' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <select
            value={weightSelectValue}
            onChange={(e) =>
              patch({
                fontWeight:
                  e.target.value === 'normal'
                    ? 400
                    : e.target.value === 'bold'
                      ? 700
                      : Number(e.target.value),
              })
            }
            style={{ ...inputStyle, appearance: 'none', paddingRight: '28px', cursor: 'pointer' }}
          >
            <option value="normal">Regular</option>
            <option value="500">Medium</option>
            <option value="600">Semibold</option>
            <option value="bold">Bold</option>
          </select>
          <ChevronDownIcon
            size={14}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: '#808080',
            }}
          />
        </div>

        <div style={{ width: '70px', position: 'relative' }}>
          <select
            value={fontSize}
            onChange={(e) => patch({ fontSize: parseInt(e.target.value, 10) })}
            style={{ ...inputStyle, appearance: 'none', paddingRight: '24px', cursor: 'pointer' }}
          >
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <ChevronDownIcon
            size={14}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: '#808080',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ ...labelStyle, marginBottom: '2px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 500 }}>A</span>
              <span style={{ fontSize: '10px' }}>{lineHeight}</span>
            </span>
          </label>
          <input
            type="range"
            min="1"
            max="2.5"
            step="0.1"
            value={lineHeight}
            onChange={(e) => patch({ lineHeight: parseFloat(e.target.value) })}
            style={{
              width: '100%',
              height: '4px',
              appearance: 'none',
              backgroundColor: '#475569',
              borderRadius: '2px',
              cursor: 'pointer',
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ ...labelStyle, marginBottom: '2px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px' }}>|A|</span>
              <span style={{ fontSize: '10px' }}>{letterSpacing}%</span>
            </span>
          </label>
          <input
            type="range"
            min="-5"
            max="20"
            step="1"
            value={letterSpacing}
            onChange={(e) => patch({ letterSpacing: parseInt(e.target.value, 10) })}
            style={{
              width: '100%',
              height: '4px',
              appearance: 'none',
              backgroundColor: '#475569',
              borderRadius: '2px',
              cursor: 'pointer',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
        <button
          type="button"
          onClick={() => patch({ textAlign: 'left' })}
          style={{
            ...buttonStyle,
            flex: 1,
            justifyContent: 'center',
            backgroundColor: (align || 'left') === 'left' ? '#5C5CFF' : '#334155',
            color: (align || 'left') === 'left' ? 'white' : '#94a3b8',
          }}
        >
          <AlignLeft size={14} />
        </button>
        <button
          type="button"
          onClick={() => patch({ textAlign: 'center' })}
          style={{
            ...buttonStyle,
            flex: 1,
            justifyContent: 'center',
            backgroundColor: align === 'center' ? '#5C5CFF' : '#334155',
            color: align === 'center' ? 'white' : '#94a3b8',
          }}
        >
          <AlignCenter size={14} />
        </button>
        <button
          type="button"
          onClick={() => patch({ textAlign: 'right' })}
          style={{
            ...buttonStyle,
            flex: 1,
            justifyContent: 'center',
            backgroundColor: align === 'right' ? '#5C5CFF' : '#334155',
            color: align === 'right' ? 'white' : '#94a3b8',
          }}
        >
          <AlignRight size={14} />
        </button>
        <div style={{ width: '1px', backgroundColor: '#475569', margin: '0 4px' }} />
        <button
          type="button"
          style={{
            ...buttonStyle,
            flex: 1,
            justifyContent: 'center',
            backgroundColor: verticalAlign === 'top' ? '#5C5CFF' : '#334155',
            color: verticalAlign === 'top' ? 'white' : '#94a3b8',
          }}
          title="Zarovnat nahoru"
        >
          <ArrowUpToLine size={14} />
        </button>
        <button
          type="button"
          style={{
            ...buttonStyle,
            flex: 1,
            justifyContent: 'center',
            backgroundColor: verticalAlign === 'center' ? '#5C5CFF' : '#334155',
            color: verticalAlign === 'center' ? 'white' : '#94a3b8',
          }}
          title="Zarovnat na střed"
        >
          <AlignVerticalJustifyCenter size={14} />
        </button>
        <button
          type="button"
          style={{
            ...buttonStyle,
            flex: 1,
            justifyContent: 'center',
            backgroundColor: verticalAlign === 'bottom' ? '#5C5CFF' : '#334155',
            color: verticalAlign === 'bottom' ? 'white' : '#94a3b8',
          }}
          title="Zarovnat dolů"
        >
          <ArrowDownToLine size={14} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
        <button
          type="button"
          onClick={() => patch({ isBold: !isBold })}
          style={{
            ...buttonStyle,
            flex: 1,
            justifyContent: 'center',
            backgroundColor: isBold ? '#5C5CFF' : '#334155',
            color: isBold ? 'white' : '#94a3b8',
          }}
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          onClick={() => patch({ isItalic: !isItalic })}
          style={{
            ...buttonStyle,
            flex: 1,
            justifyContent: 'center',
            backgroundColor: isItalic ? '#5C5CFF' : '#334155',
            color: isItalic ? 'white' : '#94a3b8',
          }}
        >
          <Italic size={14} />
        </button>
        <button
          type="button"
          onClick={() => patch({ isUnderline: !isUnderline })}
          style={{
            ...buttonStyle,
            flex: 1,
            justifyContent: 'center',
            backgroundColor: isUnderline ? '#5C5CFF' : '#334155',
            color: isUnderline ? 'white' : '#94a3b8',
          }}
        >
          <Underline size={14} />
        </button>
      </div>

      <div>
        <label style={{ ...labelStyle, marginBottom: '6px', textTransform: 'uppercase' }}>Barva textu</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                (e.currentTarget as HTMLDivElement).click();
              }
            }}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'color';
              input.value = textColor.startsWith('#') && textColor.length >= 4 ? textColor : '#1E293B';
              input.oninput = (e) => patch({ textColor: (e.target as HTMLInputElement).value });
              input.click();
            }}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: textColor,
              border: '2px solid #475569',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
            }}
            title="Vybrat barvu textu"
          />
          <input
            type="text"
            value={textColor}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) patch({ textColor: v });
            }}
            style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '11px', flex: 1 }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          {[
            '#1E293B',
            '#334155',
            '#6B7280',
            '#ffffff',
            '#EF4444',
            '#F97316',
            '#EAB308',
            '#22C55E',
            '#3B82F6',
            '#8B5CF6',
          ].map((c) => (
            <div
              key={c}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  patch({ textColor: c });
                }
              }}
              onClick={() => patch({ textColor: c })}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: c,
                cursor: 'pointer',
                flexShrink: 0,
                border: textColor === c ? '2px solid #5C5CFF' : '1px solid #475569',
                boxShadow: textColor === c ? '0 0 0 2px #5C5CFF44' : 'none',
                transition: 'box-shadow 0.12s',
              }}
              title={c}
            />
          ))}
        </div>
      </div>
    </div>
  );

  if (variant === 'dialog') {
    return <div style={{ padding: 0 }}>{settingsForm}</div>;
  }

  return (
    <div
      style={{
        borderTop: '1px solid #333',
        paddingTop: '8px',
        marginTop: '8px',
        paddingLeft: '8px',
        paddingRight: '8px',
      }}
    >
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setShowCustomStyles(!showCustomStyles)}
        style={{
          ...buttonStyle,
          width: '100%',
          justifyContent: 'space-between',
          backgroundColor: 'transparent',
          padding: '4px 0',
        }}
      >
        <span style={{ fontSize: '10px', color: '#808080' }}>DALŠÍ NASTAVENÍ</span>
        <ChevronDownIcon size={12} style={{ transform: showCustomStyles ? 'rotate(180deg)' : 'none' }} />
      </button>
      {showCustomStyles && settingsForm}
    </div>
  );
}
