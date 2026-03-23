/**
 * DesignSystemPanel
 *
 * Left sidebar (220px): DS selector, save/load, category nav (Typografie expandable)
 * Right canvas: selected category content
 *
 * Typography canvas: A4 paper at EXACT editor dimensions + style sub-settings
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Plus, Trash2, Save, Copy, ChevronDown, Palette,
  Type, LayoutGrid, Sparkles, Layers, Check, X,
  Edit2, RefreshCw, Loader2, Star,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline,
  ArrowUpToLine, ArrowDownToLine, AlignVerticalJustifyCenter,
} from 'lucide-react';
import { toast } from 'sonner';
import { ProBlockSettingsPanel } from './ProBlockSettingsPanel';
import {
  DesignSystem, ColorGroup, ColorSwatch, TypoStyleOverride, CustomLayout,
  CURATED_FONTS, createEmptyDesignSystem, getGoogleFontsUrl,
} from '../../types/design-system';
import type { BlockType, GridColumns, GridGap, WorksheetBlock } from '../../types/worksheet';
import { inputStyle, labelStyle, buttonStyle, FONT_FAMILIES, FONT_SIZES } from './block-settings/shared';
import {
  getDesignSystems, saveDesignSystem,
  duplicateDesignSystem, deleteDesignSystem,
} from '../../utils/supabase/design-system-storage';
import { GridCanvas } from './GridCanvas';

// ── Theme ─────────────────────────────────────────────────────────────────────

const C = {
  bg: '#0d1117',
  sidebar: '#0d1117',
  sidebarBorder: '#21262d',
  canvas: '#161b22',
  card: '#1c2128',
  border: '#30363d',
  text: '#e6edf3',
  muted: '#7d8590',
  accent: '#5C5CFF',
  accentDim: '#1a1f3c',
  green: '#3fb950',
  greenDim: '#12261e',
  yellow: '#e3b341',
};

// ── Shared micro-styles ───────────────────────────────────────────────────────

const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
  width: '100%', padding: '7px 10px',
  backgroundColor: '#21262d', border: `1px solid ${C.border}`,
  borderRadius: '7px', color: C.text, fontSize: '12px', outline: 'none',
  ...extra,
});

const btnBase = (extra?: React.CSSProperties): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '5px',
  padding: '5px 10px', border: `1px solid ${C.border}`,
  borderRadius: '7px', cursor: 'pointer',
  fontSize: '11px', fontWeight: 500, color: C.muted,
  backgroundColor: '#21262d',
  ...extra,
});

const label11 = (): React.CSSProperties => ({
  fontSize: '10px', fontWeight: 600, color: C.muted,
  textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px',
  display: 'block',
});

// ── Typography sub-items ──────────────────────────────────────────────────────

type TypographyStyleId = 'h1' | 'h2' | 'h3' | 'body' | 'caption';

const TYPO_STYLES: { id: TypographyStyleId; tag: string; label: string }[] = [
  { id: 'h1', tag: 'H1', label: 'Nadpis 1' },
  { id: 'h2', tag: 'H2', label: 'Nadpis 2' },
  { id: 'h3', tag: 'H3', label: 'Nadpis 3' },
  { id: 'body', tag: 'P', label: 'Odstavec' },
  { id: 'caption', tag: 'SM', label: 'Popis / Caption' },
];

// ── Category nav ──────────────────────────────────────────────────────────────

export type Category = 'system' | 'colors' | 'typography' | 'layout' | 'ai' | 'blocks';

const CATEGORIES: { id: Category; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'colors', label: 'Barvy', icon: Palette },
  { id: 'typography', label: 'Typografie', icon: Type },
  { id: 'layout', label: 'Layout', icon: LayoutGrid },
  { id: 'ai', label: 'AI Styl', icon: Sparkles },
  { id: 'blocks', label: 'Bloky', icon: Layers },
];

// ── Block meta ────────────────────────────────────────────────────────────────

const BLOCK_META: { type: BlockType; label: string; emoji: string }[] = [
  { type: 'heading', label: 'Nadpis', emoji: 'T' },
  { type: 'paragraph', label: 'Odstavec', emoji: '¶' },
  { type: 'infobox', label: 'Infobox', emoji: 'ℹ' },
  { type: 'image', label: 'Obrázek', emoji: '🖼' },
  { type: 'table', label: 'Tabulka', emoji: '⊞' },
  { type: 'multiple-choice', label: 'Výběr', emoji: '☑' },
  { type: 'fill-blank', label: 'Doplnění', emoji: '✏' },
  { type: 'free-answer', label: 'Volná', emoji: '✍' },
  { type: 'connect-pairs', label: 'Spojovačka', emoji: '↔' },
  { type: 'image-hotspots', label: 'Poznávačka', emoji: '📍' },
  { type: 'examples', label: 'Příklady', emoji: '∑' },
  { type: 'spacer', label: 'Prostor', emoji: '—' },
  { type: 'qr-code', label: 'QR kód', emoji: '▦' },
  { type: 'free-canvas', label: 'Figma blok', emoji: '⬡' },
  { type: 'chart', label: 'Graf', emoji: '📊' },
];

// ── Quick color palette ───────────────────────────────────────────────────────

const QUICK_COLORS = [
  '#EF4444','#F97316','#F59E0B','#22C55E','#10B981','#06B6D4','#3B82F6','#6366F1','#8B5CF6',
  '#EC4899','#000000','#374151','#6B7280','#D1D5DB','#F8FAFC','#FFFFFF','#1E40AF','#065F46',
];

// ── ColorPopover ──────────────────────────────────────────────────────────────

function ColorPopover({ swatch, onSave, onClose }: {
  swatch: ColorSwatch;
  onSave: (p: Partial<ColorSwatch>) => void;
  onClose: () => void;
}) {
  const [val, setVal] = useState(swatch.value);
  const [name, setName] = useState(swatch.name);
  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'absolute', zIndex: 9999, top: 'calc(100% + 8px)', left: 0,
        width: '240px', backgroundColor: '#1c2128',
        border: `1px solid ${C.border}`, borderRadius: '12px', padding: '14px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
      }}
    >
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <input type="color" value={val} onChange={e => setVal(e.target.value)}
          style={{ width: '42px', height: '42px', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: 0 }} />
        <input value={val} onChange={e => setVal(e.target.value)}
          style={inp({ flex: 1, fontFamily: 'monospace', fontSize: '11px' })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '4px', marginBottom: '10px' }}>
        {QUICK_COLORS.map(q => (
          <div key={q} onClick={() => setVal(q)} style={{
            aspectRatio: '1/1', borderRadius: '4px', backgroundColor: q, cursor: 'pointer',
            border: val === q ? `2px solid ${C.accent}` : '1px solid #333',
          }} />
        ))}
      </div>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Název barvy"
        style={inp({ marginBottom: '10px' })} />
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={onClose} style={btnBase({ flex: 1, justifyContent: 'center', backgroundColor: 'transparent', border: 'none' })}>Zrušit</button>
        <button onClick={() => { onSave({ value: val, name }); onClose(); }}
          style={btnBase({ flex: 1, justifyContent: 'center', backgroundColor: C.accent, color: 'white', border: 'none' })}>OK</button>
      </div>
    </div>
  );
}

// ── FontPicker ────────────────────────────────────────────────────────────────

const FONT_BY_CAT = CURATED_FONTS.reduce((acc, f) => {
  if (!acc[f.category]) acc[f.category] = [];
  acc[f.category].push(f); return acc;
}, {} as Record<string, typeof CURATED_FONTS>);

const CAT_LABELS: Record<string, string> = {
  'sans-serif': 'Bezpatkové', serif: 'Patkové', display: 'Dekorativní', mono: 'Kódové',
};

function FontPicker({ label: roleLabel, value, onSelect }: {
  label: string; value: string; onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const font = CURATED_FONTS.find(f => f.value === value);
  return (
    <div style={{ position: 'relative' }}>
      {roleLabel && <div style={{ ...label11(), marginBottom: '6px' }}>{roleLabel}</div>}
      <button onClick={() => setOpen(o => !o)}
        style={btnBase({ width: '100%', justifyContent: 'space-between', padding: '9px 12px', backgroundColor: '#21262d', borderRadius: '8px' })}>
        <span style={{ fontFamily: `'${value}', sans-serif`, fontSize: '13px', color: C.text, fontWeight: 500 }}>{font?.label || value}</span>
        <ChevronDown size={12} style={{ color: C.muted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 300, top: 'calc(100% + 4px)', left: 0, right: 0,
          backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: '10px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.8)', maxHeight: '260px', overflowY: 'auto',
        }}>
          {Object.entries(FONT_BY_CAT).map(([cat, fonts]) => (
            <div key={cat}>
              <div style={{ padding: '8px 14px 2px', ...label11() }}>{CAT_LABELS[cat] || cat}</div>
              {fonts.map(f => (
                <div key={f.value} onClick={() => { onSelect(f.value); setOpen(false); }}
                  style={{ padding: '9px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: value === f.value ? C.accentDim : 'transparent' }}
                  onMouseEnter={e => { if (value !== f.value) (e.currentTarget as HTMLElement).style.backgroundColor = '#21262d'; }}
                  onMouseLeave={e => { if (value !== f.value) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
                  <span style={{ fontFamily: `'${f.value}', sans-serif`, fontSize: '14px', color: C.text }}>{f.label}</span>
                  {value === f.value && <Check size={13} style={{ color: C.accent }} />}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── COLORS canvas ─────────────────────────────────────────────────────────────

function ColorsCanvas({ colors, onChange }: { colors: ColorGroup[]; onChange: (g: ColorGroup[]) => void }) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);

  const updateSwatch = (gid: string, sid: string, patch: Partial<ColorSwatch>) =>
    onChange(colors.map(g => g.id === gid ? { ...g, swatches: g.swatches.map(s => s.id === sid ? { ...s, ...patch } : s) } : g));
  const removeSwatch = (gid: string, sid: string) =>
    onChange(colors.map(g => g.id === gid ? { ...g, swatches: g.swatches.filter(s => s.id !== sid) } : g));
  const addSwatch = (gid: string) => {
    const s: ColorSwatch = { id: `sw-${Date.now()}`, name: 'Barva', value: '#3B82F6' };
    onChange(colors.map(g => g.id === gid ? { ...g, swatches: [...g.swatches, s] } : g));
    setTimeout(() => setEditId(s.id), 50);
  };
  const addGroup = () => onChange([...colors, { id: `g-${Date.now()}`, name: 'Skupina', swatches: [] }]);
  const removeGroup = (gid: string) => onChange(colors.filter(g => g.id !== gid));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {colors.map(group => (
        <div key={group.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            {editGroupId === group.id ? (
              <input autoFocus value={group.name}
                onChange={e => onChange(colors.map(g => g.id === group.id ? { ...g, name: e.target.value } : g))}
                onBlur={() => setEditGroupId(null)}
                onKeyDown={e => e.key === 'Enter' && setEditGroupId(null)}
                style={inp({ fontWeight: 700, fontSize: '13px', padding: '4px 8px', flex: 1 })}
              />
            ) : (
              <>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: C.text }}>{group.name}</span>
                <button onClick={() => setEditGroupId(group.id)} style={btnBase({ padding: '3px 6px', backgroundColor: 'transparent', border: 'none' })}><Edit2 size={12} /></button>
                <button onClick={() => removeGroup(group.id)} style={btnBase({ padding: '3px 6px', backgroundColor: 'transparent', border: 'none', color: '#EF4444' })}><Trash2 size={12} /></button>
              </>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {group.swatches.map(sw => {
              const [hov, setHov] = useState(false);
              return (
                <div key={sw.id} style={{ position: 'relative', width: '64px' }}
                  onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
                  <div onClick={() => setEditId(editId === sw.id ? null : sw.id)}
                    style={{
                      width: '64px', height: '64px', borderRadius: '10px', backgroundColor: sw.value, cursor: 'pointer',
                      border: editId === sw.id ? `2px solid ${C.accent}` : `1px solid rgba(255,255,255,0.08)`,
                      boxShadow: hov ? `0 0 0 3px ${C.accent}55` : '0 3px 10px rgba(0,0,0,0.5)',
                      transform: hov ? 'translateY(-3px)' : 'none', transition: 'transform 0.12s, box-shadow 0.12s',
                    }} />
                  <div style={{ fontSize: '10px', color: C.text, textAlign: 'center', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{sw.name}</div>
                  <div style={{ fontSize: '9px', color: C.muted, textAlign: 'center', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sw.value.toUpperCase()}</div>
                  {hov && (
                    <button onClick={e => { e.stopPropagation(); removeSwatch(group.id, sw.id); }}
                      style={{ position: 'absolute', top: '-7px', right: '-7px', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#EF4444', border: `2px solid ${C.canvas}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <X size={9} style={{ color: 'white' }} />
                    </button>
                  )}
                  {editId === sw.id && (
                    <ColorPopover swatch={sw} onSave={p => updateSwatch(group.id, sw.id, p)} onClose={() => setEditId(null)} />
                  )}
                </div>
              );
            })}
            <div onClick={() => addSwatch(group.id)}
              style={{ width: '64px', height: '64px', borderRadius: '10px', border: `2px dashed ${C.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Plus size={20} style={{ color: C.muted }} />
            </div>
          </div>
        </div>
      ))}
      <button onClick={addGroup}
        style={btnBase({ alignSelf: 'flex-start', padding: '8px 16px', border: `1px dashed ${C.border}`, backgroundColor: 'transparent', fontSize: '12px' })}>
        <Plus size={13} /> Přidat skupinu barev
      </button>
    </div>
  );
}

// ── TYPOGRAPHY canvas ─────────────────────────────────────────────────────────

const BASE_PT: Record<TypographyStyleId, number> = { h1: 36, h2: 24, h3: 18, body: 12, caption: 9 };
const BASE_WEIGHT: Record<TypographyStyleId, number> = { h1: 700, h2: 700, h3: 600, body: 400, caption: 400 };

const FONT_WEIGHTS = [
  { value: 300, label: 'Light' }, { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' }, { value: 600, label: 'SemiBold' }, { value: 700, label: 'Bold' },
];

/** Verbatim copy of the "DALŠÍ NASTAVENÍ" block from TextSectionSettings.tsx (lines 966-1267).
 *  Only change: onUpdateBlock(block.id, { content: {..., X: val} }) → patch({ X: val })
 */
function TypoStyleSettings({ styleId, typography, onChange }: {
  styleId: TypographyStyleId;
  typography: DesignSystem['typography'];
  onChange: (v: DesignSystem['typography']) => void;
}) {
  const [showCustomStyles, setShowCustomStyles] = useState(true);
  const overrides = typography.styles?.[styleId] ?? {};
  const patch = (p: Partial<TypoStyleOverride>) =>
    onChange({ ...typography, styles: { ...typography.styles, [styleId]: { ...overrides, ...p } } });

  const fontFamily    = overrides.fontFamily    ?? FONT_FAMILIES[0].value;
  const fontWeight    = overrides.fontWeight    ?? BASE_WEIGHT[styleId];
  const fontSize      = overrides.fontSize      ?? BASE_PT[styleId];
  const lineHeight    = overrides.lineHeight    ?? 1.5;
  const letterSpacing = overrides.letterSpacing ?? 0;
  const align         = overrides.textAlign     ?? 'left';
  const textColor     = overrides.textColor     ?? '#1E293B';
  const verticalAlign = 'top';
  const isBold        = overrides.isBold        ?? false;
  const isItalic      = overrides.isItalic      ?? false;
  const isUnderline   = overrides.isUnderline   ?? false;

  const ChevronDownIcon = ChevronDown;

  return (
    <div style={{ borderTop: '1px solid #333', paddingTop: '8px', marginTop: '8px', paddingLeft: '8px', paddingRight: '8px' }}>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setShowCustomStyles(!showCustomStyles)}
        style={{ ...buttonStyle, width: '100%', justifyContent: 'space-between', backgroundColor: 'transparent', padding: '4px 0' }}
      >
        <span style={{ fontSize: '10px', color: '#808080' }}>DALŠÍ NASTAVENÍ</span>
        <ChevronDownIcon size={12} style={{ transform: showCustomStyles ? 'rotate(180deg)' : 'none' }} />
      </button>

      {showCustomStyles && (
        <div style={{ marginTop: '12px' }}>
          {/* Font Family */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ position: 'relative' }}>
              <select
                value={fontFamily}
                onChange={(e) => patch({ fontFamily: e.target.value })}
                style={{ ...inputStyle, appearance: 'none', paddingRight: '28px', cursor: 'pointer' }}
              >
                {FONT_FAMILIES.map((font) => (
                  <option key={font.value} value={font.value}>{font.label}</option>
                ))}
              </select>
              <ChevronDownIcon size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#808080' }} />
            </div>
          </div>

          {/* Font Size and Weight Row */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            {/* Font Weight */}
            <div style={{ flex: 1, position: 'relative' }}>
              <select
                value={String(fontWeight)}
                onChange={(e) => patch({ fontWeight: e.target.value === 'normal' ? 400 : e.target.value === 'bold' ? 700 : Number(e.target.value) })}
                style={{ ...inputStyle, appearance: 'none', paddingRight: '28px', cursor: 'pointer' }}
              >
                <option value="normal">Regular</option>
                <option value="500">Medium</option>
                <option value="600">Semibold</option>
                <option value="bold">Bold</option>
              </select>
              <ChevronDownIcon size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#808080' }} />
            </div>

            {/* Font Size */}
            <div style={{ width: '70px', position: 'relative' }}>
              <select
                value={fontSize}
                onChange={(e) => patch({ fontSize: parseInt(e.target.value) })}
                style={{ ...inputStyle, appearance: 'none', paddingRight: '24px', cursor: 'pointer' }}
              >
                {FONT_SIZES.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <ChevronDownIcon size={14} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#808080' }} />
            </div>
          </div>

          {/* Line Height and Letter Spacing */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, marginBottom: '2px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 500 }}>A</span>
                  <span style={{ fontSize: '10px' }}>{lineHeight}</span>
                </span>
              </label>
              <input type="range" min="1" max="2.5" step="0.1" value={lineHeight}
                onChange={(e) => patch({ lineHeight: parseFloat(e.target.value) })}
                style={{ width: '100%', height: '4px', appearance: 'none', backgroundColor: '#475569', borderRadius: '2px', cursor: 'pointer' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, marginBottom: '2px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12px' }}>|A|</span>
                  <span style={{ fontSize: '10px' }}>{letterSpacing}%</span>
                </span>
              </label>
              <input type="range" min="-5" max="20" step="1" value={letterSpacing}
                onChange={(e) => patch({ letterSpacing: parseInt(e.target.value) })}
                style={{ width: '100%', height: '4px', appearance: 'none', backgroundColor: '#475569', borderRadius: '2px', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Text Alignment - Horizontal + Vertical */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
            <button onClick={() => patch({ textAlign: 'left' })}
              style={{ ...buttonStyle, flex: 1, justifyContent: 'center', backgroundColor: (align || 'left') === 'left' ? '#5C5CFF' : '#334155', color: (align || 'left') === 'left' ? 'white' : '#94a3b8' }}>
              <AlignLeft size={14} />
            </button>
            <button onClick={() => patch({ textAlign: 'center' })}
              style={{ ...buttonStyle, flex: 1, justifyContent: 'center', backgroundColor: align === 'center' ? '#5C5CFF' : '#334155', color: align === 'center' ? 'white' : '#94a3b8' }}>
              <AlignCenter size={14} />
            </button>
            <button onClick={() => patch({ textAlign: 'right' })}
              style={{ ...buttonStyle, flex: 1, justifyContent: 'center', backgroundColor: align === 'right' ? '#5C5CFF' : '#334155', color: align === 'right' ? 'white' : '#94a3b8' }}>
              <AlignRight size={14} />
            </button>
            <div style={{ width: '1px', backgroundColor: '#475569', margin: '0 4px' }} />
            <button style={{ ...buttonStyle, flex: 1, justifyContent: 'center', backgroundColor: verticalAlign === 'top' ? '#5C5CFF' : '#334155', color: verticalAlign === 'top' ? 'white' : '#94a3b8' }} title="Zarovnat nahoru">
              <ArrowUpToLine size={14} />
            </button>
            <button style={{ ...buttonStyle, flex: 1, justifyContent: 'center', backgroundColor: verticalAlign === 'center' ? '#5C5CFF' : '#334155', color: verticalAlign === 'center' ? 'white' : '#94a3b8' }} title="Zarovnat na střed">
              <AlignVerticalJustifyCenter size={14} />
            </button>
            <button style={{ ...buttonStyle, flex: 1, justifyContent: 'center', backgroundColor: verticalAlign === 'bottom' ? '#5C5CFF' : '#334155', color: verticalAlign === 'bottom' ? 'white' : '#94a3b8' }} title="Zarovnat dolů">
              <ArrowDownToLine size={14} />
            </button>
          </div>

          {/* B / I / U */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
            <button onClick={() => patch({ isBold: !isBold })}
              style={{ ...buttonStyle, flex: 1, justifyContent: 'center', backgroundColor: isBold ? '#5C5CFF' : '#334155', color: isBold ? 'white' : '#94a3b8' }}>
              <Bold size={14} />
            </button>
            <button onClick={() => patch({ isItalic: !isItalic })}
              style={{ ...buttonStyle, flex: 1, justifyContent: 'center', backgroundColor: isItalic ? '#5C5CFF' : '#334155', color: isItalic ? 'white' : '#94a3b8' }}>
              <Italic size={14} />
            </button>
            <button onClick={() => patch({ isUnderline: !isUnderline })}
              style={{ ...buttonStyle, flex: 1, justifyContent: 'center', backgroundColor: isUnderline ? '#5C5CFF' : '#334155', color: isUnderline ? 'white' : '#94a3b8' }}>
              <Underline size={14} />
            </button>
          </div>

          {/* Text Color */}
          <div>
            <label style={{ ...labelStyle, marginBottom: '6px' }}>Barva textu</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Big swatch — opens native color picker */}
              <div
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'color';
                  input.value = textColor;
                  input.oninput = (e) => patch({ textColor: (e.target as HTMLInputElement).value });
                  input.click();
                }}
                style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  backgroundColor: textColor,
                  border: '2px solid #475569', cursor: 'pointer', flexShrink: 0,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                }}
                title="Vybrat barvu textu"
              />
              {/* Hex input */}
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
            {/* Preset circles */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              {['#1E293B', '#334155', '#6B7280', '#ffffff', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6'].map(c => (
                <div
                  key={c}
                  onClick={() => patch({ textColor: c })}
                  style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    backgroundColor: c, cursor: 'pointer', flexShrink: 0,
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
      )}
    </div>
  );
}

/** Maps typography style ID → sample block ID in GridCanvas */
const STYLE_TO_BLOCK_ID: Record<TypographyStyleId, string> = {
  h1: 'ds-h1',
  h2: 'ds-h2',
  h3: 'ds-h3',
  body: 'ds-body1',
  caption: 'ds-caption',
};

function TypographyCanvas({ typography, onChange, activeStyle, onActiveStyleChange }: {
  typography: DesignSystem['typography'];
  onChange: (v: DesignSystem['typography']) => void;
  activeStyle: TypographyStyleId;
  onActiveStyleChange: (s: TypographyStyleId) => void;
}) {
  useEffect(() => {
    const extractFontName = (css: string) => {
      const m = css.match(/['"]([^'"]+)['"]/);
      return m ? m[1] : css.split(',')[0].trim();
    };
    const overrideFonts = typography.styles
      ? Object.values(typography.styles).map(s => s?.fontFamily).filter(Boolean) as string[]
      : [];
    const allFonts = [
      typography.headingFont,
      typography.bodyFont,
      ...overrideFonts.map(extractFontName),
    ].filter((f, i, arr) => Boolean(f) && arr.indexOf(f) === i);
    const url = getGoogleFontsUrl(allFonts);
    if (!url) return;
    const id = 'ds-canvas-fonts';
    let el = document.getElementById(id) as HTMLLinkElement | null;
    if (!el) { el = document.createElement('link'); el.id = id; el.rel = 'stylesheet'; document.head.appendChild(el); }
    el.href = url;
  }, [typography]);

  const ov = (id: TypographyStyleId) => typography.styles?.[id] ?? {};

  const resolveFont = (id: TypographyStyleId, isHeading: boolean) =>
    ov(id).fontFamily || (isHeading
      ? `'${typography.headingFont}', serif`
      : `'${typography.bodyFont}', sans-serif`);

  const sampleBlocks: WorksheetBlock[] = useMemo(() => {
    const h1ov = ov('h1');
    const h2ov = ov('h2');
    const h3ov = ov('h3');
    const bodyOv = ov('body');
    const captionOv = ov('caption');

    return [
      {
        id: 'ds-h1', order: 0, type: 'heading' as const, width: 'full' as const, gridSpan: 12,
        content: {
          text: 'Nadpis pracovního listu', level: 'h1' as const,
          align: h1ov.textAlign || 'left',
          fontSize: h1ov.fontSize,
          isBold: h1ov.isBold,
          isItalic: h1ov.isItalic,
          isUnderline: h1ov.isUnderline,
          fontFamily: resolveFont('h1', true),
          lineHeight: h1ov.lineHeight,
          letterSpacing: h1ov.letterSpacing,
          textColor: h1ov.textColor,
        } as any,
      },
      {
        id: 'ds-caption', order: 1, type: 'paragraph' as const, width: 'full' as const, gridSpan: 12,
        content: {
          html: 'Předmět · Ročník · Kapitola',
          fontSize: captionOv.fontSize || 9,
          fontFamily: resolveFont('caption', false),
          align: captionOv.textAlign || 'left',
          lineHeight: captionOv.lineHeight || 1.5,
          letterSpacing: captionOv.letterSpacing,
          isBold: captionOv.isBold,
          isItalic: captionOv.isItalic,
          isUnderline: captionOv.isUnderline,
          textColor: captionOv.textColor || '#888888',
        } as any,
      },
      {
        id: 'ds-h2', order: 2, type: 'heading' as const, width: 'full' as const, gridSpan: 12,
        content: {
          text: 'Nadpis sekce', level: 'h2' as const,
          align: h2ov.textAlign || 'left',
          fontSize: h2ov.fontSize,
          isBold: h2ov.isBold,
          isItalic: h2ov.isItalic,
          isUnderline: h2ov.isUnderline,
          fontFamily: resolveFont('h2', true),
          lineHeight: h2ov.lineHeight,
          letterSpacing: h2ov.letterSpacing,
          textColor: h2ov.textColor,
        } as any,
      },
      {
        id: 'ds-body1', order: 3, type: 'paragraph' as const, width: 'full' as const, gridSpan: 12,
        content: {
          html: 'Zde začněte psát text k tématu. Tento blok je nastaven na plnou šířku stránky. Fonty se mění v reálném čase jak upravujete nastavení. Příliš žluťoučký kůň úpěl ďábelské ódy.',
          fontFamily: resolveFont('body', false),
          align: bodyOv.textAlign || 'left',
          fontSize: bodyOv.fontSize,
          lineHeight: bodyOv.lineHeight || 1.5,
          letterSpacing: bodyOv.letterSpacing,
          isBold: bodyOv.isBold,
          isItalic: bodyOv.isItalic,
          isUnderline: bodyOv.isUnderline,
          textColor: bodyOv.textColor,
        } as any,
      },
      {
        id: 'ds-h3', order: 4, type: 'heading' as const, width: 'full' as const, gridSpan: 12,
        content: {
          text: 'Podnadpis H3', level: 'h3' as const,
          align: h3ov.textAlign || 'left',
          fontSize: h3ov.fontSize,
          isBold: h3ov.isBold,
          isItalic: h3ov.isItalic,
          isUnderline: h3ov.isUnderline,
          fontFamily: resolveFont('h3', true),
          lineHeight: h3ov.lineHeight,
          letterSpacing: h3ov.letterSpacing,
          textColor: h3ov.textColor,
        } as any,
      },
      {
        id: 'ds-body2', order: 5, type: 'paragraph' as const, width: 'full' as const, gridSpan: 12,
        content: {
          html: 'Text odstavce pod podnadpisem. Toto je ukázka jak vypadá běžný odstavec v pracovním listu.',
          fontFamily: resolveFont('body', false),
          align: bodyOv.textAlign || 'left',
          fontSize: bodyOv.fontSize,
          lineHeight: bodyOv.lineHeight || 1.5,
          letterSpacing: bodyOv.letterSpacing,
          isBold: bodyOv.isBold,
          isItalic: bodyOv.isItalic,
          isUnderline: bodyOv.isUnderline,
          textColor: bodyOv.textColor,
        } as any,
      },
      {
        id: 'ds-infobox', order: 6, type: 'paragraph' as const, width: 'full' as const, gridSpan: 12,
        content: {
          html: 'Toto je infobox — zvýrazněný blok pro důležité informace nebo zajímavosti.',
          displayMode: 'infobox',
          bgColor: 'blue',
          hasBorder: true,
          fontFamily: resolveFont('body', false),
          fontSize: bodyOv.fontSize,
          lineHeight: bodyOv.lineHeight || 1.5,
        } as any,
      },
      {
        id: 'ds-fill', order: 7, type: 'fill-blank' as const, width: 'full' as const, gridSpan: 12,
        content: {
          instruction: 'Doplňte správnou odpověď:',
          segments: [
            { type: 'text' as const, value: 'Hlavní město České republiky je ' },
            { type: 'blank' as const, answer: 'Praha', id: 'b1' },
            { type: 'text' as const, value: '.' },
          ],
        },
      },
    ];
  }, [typography]);

  const [zoom, setZoom] = useState(0.83);
  const zoomIn = useCallback(() => setZoom(z => Math.min(2, Math.round((z + 0.1) * 10) / 10)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(0.3, Math.round((z - 0.1) * 10) / 10)), []);

  const noop = useCallback(() => {}, []);
  const noopStrAny = useCallback((_id: string, _v: any) => {}, []);
  const noopStrNum = useCallback((_id: string, _v: number) => {}, []);
  const noopType = useCallback((_type: any) => {}, []);

  // When user clicks a block in the preview, sync back the active style
  const handleSelectBlock = useCallback((blockId: string | null) => {
    if (!blockId) return;
    const entry = Object.entries(STYLE_TO_BLOCK_ID).find(([, bid]) => bid === blockId);
    if (entry) onActiveStyleChange(entry[0] as TypographyStyleId);
  }, [onActiveStyleChange]);

  const selectedBlockId = STYLE_TO_BLOCK_ID[activeStyle];

  return (
    <div style={{
      flex: 1, padding: '24px', backgroundColor: '#0f172a',
      overflowY: 'auto', overflowX: 'hidden',
      color: '#e2e8f0', position: 'relative',
    }}>
      {/* Zoom panel — same as ProEditorLayout */}
      <div style={{
        position: 'absolute', top: 12, right: 24,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        zIndex: 100,
        backgroundColor: '#1e293b', padding: '4px',
        borderRadius: '8px', border: '1px solid #334155',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>
        <button onClick={zoomIn} title="Přiblížit"
          style={{ padding: '6px', background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#334155')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, minWidth: 32, textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={zoomOut} title="Oddálit"
          style={{ padding: '6px', background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#334155')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
      </div>

      {/* Canvas with zoom */}
      <div style={{
        transform: `scale(${zoom})`,
        transformOrigin: 'top center',
        marginBottom: zoom < 1 ? `-${(1 - zoom) * 100}%` : 0,
      }}>
        <GridCanvas
          blocks={sampleBlocks}
          selectedBlockId={selectedBlockId}
          hoveredBlockId={null}
          onSelectBlock={handleSelectBlock}
          onUpdateBlock={noopStrAny}
          onUpdateBlockMargin={noopStrNum}
          onAddBlock={noopType}
          onSwitchToAI={noop}
          onOpenAddPanel={noop}
          globalFontSize={typography.baseFontSize}
          pageFormat="a4"
          gridColumns={12}
          gridGapPx={16}
        />
      </div>
    </div>
  );
}

// ── LAYOUT canvas ─────────────────────────────────────────────────────────────

type SeriesSlot = {
  type: string;
  span: number;
  level?: string;
  columns?: 1 | 2 | 3;
  galleryColumns?: number;
  galleryCount?: number;
  floatSide?: 'left' | 'right';
  floatSpanBlocks?: number;
  floatGridSpan?: number;
};

type SeriesGroup = 'column' | 'half' | 'twothirds';

const LAYOUT_SERIES: Record<string, { label: string; description: string; group: SeriesGroup; slots: SeriesSlot[] }> = {
  C:        { group: 'column',     label: '2 sloupce',          description: 'Nadpis + odstavec ve dvou sloupcích', slots: [
    { type: 'heading', span: 12, level: 'h2' },
    { type: 'paragraph', span: 12, columns: 2 },
  ]},
  D:        { group: 'column',     label: 'Galerie 4×',          description: 'Nadpis + galerie celá šířka (4 sloupce, 4 obrázky)', slots: [
    { type: 'heading', span: 12, level: 'h2' },
    { type: 'gallery', span: 12, galleryColumns: 4, galleryCount: 4 },
  ]},
  G:        { group: 'column',     label: 'Odstavec',            description: 'Jen odstavec přes celou šířku', slots: [
    { type: 'paragraph', span: 12 },
  ]},
  A:        { group: 'half',       label: 'Text + Obr →',        description: 'Nadpis (H1), odstavec vlevo, obrázek vpravo', slots: [
    { type: 'heading', span: 12, level: 'h1' },
    { type: 'paragraph', span: 6 },
    { type: 'image', span: 6 },
  ]},
  A2:       { group: 'half',       label: '← Obr + Text',        description: 'Nadpis (H1), obrázek vlevo, odstavec vpravo', slots: [
    { type: 'heading', span: 12, level: 'h1' },
    { type: 'image', span: 6 },
    { type: 'paragraph', span: 6 },
  ]},
  B:        { group: 'half',       label: 'Boční obr →',         description: 'Obrázek vlevo jako panel, H2 + odstavec vpravo', slots: [
    { type: 'image', span: 6, floatSide: 'left', floatSpanBlocks: 2, floatGridSpan: 6 },
    { type: 'heading', span: 6, level: 'h2' },
    { type: 'paragraph', span: 6 },
  ]},
  B2:       { group: 'half',       label: '← Boční obr',         description: 'H2 + odstavec vlevo, obrázek vpravo jako panel', slots: [
    { type: 'image', span: 6, floatSide: 'right', floatSpanBlocks: 2, floatGridSpan: 6 },
    { type: 'heading', span: 6, level: 'h2' },
    { type: 'paragraph', span: 6 },
  ]},
  'B+G+I':  { group: 'twothirds', label: 'Gal + text + box →',  description: 'Galerie vlevo (2 foto), H2 + odstavec + infobox vpravo', slots: [
    { type: 'gallery', span: 5, floatSide: 'left', floatSpanBlocks: 3, floatGridSpan: 5, galleryColumns: 1, galleryCount: 2 },
    { type: 'heading', span: 7, level: 'h2' },
    { type: 'paragraph', span: 7 },
    { type: 'infobox', span: 7 },
  ]},
  'B2+G+I': { group: 'twothirds', label: '← Gal + text + box',  description: 'H2 + odstavec + infobox vlevo, galerie vpravo (2 foto)', slots: [
    { type: 'gallery', span: 5, floatSide: 'right', floatSpanBlocks: 3, floatGridSpan: 5, galleryColumns: 1, galleryCount: 2 },
    { type: 'heading', span: 7, level: 'h2' },
    { type: 'paragraph', span: 7 },
    { type: 'infobox', span: 7 },
  ]},
  'C+I':    { group: 'twothirds', label: '2/3 text + 1/3 box',  description: 'Nadpis + odstavec 2/3 šířky + infobox 1/3', slots: [
    { type: 'heading', span: 12, level: 'h2' },
    { type: 'paragraph', span: 8 },
    { type: 'infobox', span: 4 },
  ]},
  'D+I':    { group: 'twothirds', label: 'Gal 2× + box',        description: 'Nadpis + galerie 2/3 (2 sloupce, 2 obrázky) + infobox 1/3', slots: [
    { type: 'heading', span: 12, level: 'h2' },
    { type: 'gallery', span: 8, galleryColumns: 2, galleryCount: 2 },
    { type: 'infobox', span: 4 },
  ]},
};

const SERIES_GROUPS: { id: SeriesGroup; label: string }[] = [
  { id: 'column', label: 'Jeden sloupec' },
  { id: 'half', label: 'Polovina stránky 1/2 + 1/2' },
  { id: 'twothirds', label: 'Dvě třetiny 2/3 + 1/3' },
];

function generateLayoutSVG(slots: SeriesSlot[]): string {
  const W = 76; const H = 60; const PAD = 3; const GAP = 2;
  const COLORS: Record<string, string> = {
    heading: '#6366f1', paragraph: '#334155', image: '#0ea5e9', gallery: '#0284c7', infobox: '#059669',
  };
  const rects: string[] = [];
  const innerW = W - PAD * 2;
  const firstSlot = slots[0];
  const isFloat = !!firstSlot?.floatSide;

  if (isFloat) {
    const anchor = firstSlot;
    const mainSlots = slots.slice(1, 1 + (anchor.floatSpanBlocks ?? 2));
    const anchorW = Math.round(innerW * (anchor.floatGridSpan ?? 6) / 12);
    const mainW = innerW - anchorW - GAP;
    const contentH = H - PAD * 2;
    const anchorColor = COLORS[anchor.type] || '#475569';
    const anchorX = anchor.floatSide === 'left' ? PAD : PAD + mainW + GAP;
    const mainX = anchor.floatSide === 'left' ? PAD + anchorW + GAP : PAD;
    rects.push(`<rect x="${anchorX}" y="${PAD}" width="${anchorW}" height="${contentH}" rx="2" fill="${anchorColor}" opacity="0.85"/>`);
    if (anchor.type === 'image' || anchor.type === 'gallery') {
      if (anchor.type === 'gallery') {
        const imgH = (contentH - GAP) / 2;
        [0, imgH + GAP].forEach(dy => {
          rects.push(`<rect x="${anchorX + 1}" y="${PAD + dy}" width="${anchorW - 2}" height="${imgH}" rx="2" fill="white" opacity="0.1"/>`);
          const cx2 = anchorX + anchorW / 2; const cy2 = PAD + dy + imgH / 2;
          rects.push(`<circle cx="${cx2}" cy="${cy2 - 2}" r="2.5" fill="white" opacity="0.2"/>`);
        });
      } else {
        const cx = anchorX + anchorW / 2; const cy = PAD + contentH / 2;
        rects.push(`<circle cx="${cx}" cy="${cy - 4}" r="4" fill="white" opacity="0.25"/>`);
        rects.push(`<path d="M${anchorX + 2} ${PAD + contentH - 6} L${anchorX + anchorW * 0.35} ${PAD + contentH / 2 + 2} L${anchorX + anchorW * 0.65} ${PAD + contentH - 10} L${anchorX + anchorW - 2} ${PAD + contentH - 4}" fill="white" opacity="0.2"/>`);
      }
    }
    const eachH = mainSlots.length > 0 ? (contentH - GAP * (mainSlots.length - 1)) / mainSlots.length : contentH;
    mainSlots.forEach((slot, i) => {
      const y = PAD + i * (eachH + GAP);
      const color = COLORS[slot.type] || '#475569';
      rects.push(`<rect x="${mainX}" y="${y}" width="${mainW}" height="${eachH}" rx="2" fill="${color}" opacity="${slot.type === 'heading' ? '0.9' : '0.6'}"/>`);
      if (slot.type === 'heading') rects.push(`<rect x="${mainX + 2}" y="${y + eachH / 2 - 1}" width="${mainW * 0.6}" height="2" rx="1" fill="white" opacity="0.5"/>`);
    });
  } else {
    const rows: SeriesSlot[][] = [];
    let currentRow: SeriesSlot[] = []; let rowSpan = 0;
    for (const slot of slots) {
      const span = slot.span || 12;
      if (rowSpan + span > 12 && currentRow.length > 0) { rows.push(currentRow); currentRow = [slot]; rowSpan = span; }
      else { currentRow.push(slot); rowSpan += span; }
    }
    if (currentRow.length > 0) rows.push(currentRow);
    const rowH = rows.length > 0 ? (H - PAD * 2 - GAP * (rows.length - 1)) / rows.length : H - PAD * 2;
    rows.forEach((row, ri) => {
      const y = PAD + ri * (rowH + GAP);
      const totalSpan = row.reduce((s, sl) => s + (sl.span || 12), 0);
      let xCursor = PAD;
      row.forEach(slot => {
        const slotW = Math.round(innerW * (slot.span || 12) / totalSpan) - (row.length > 1 ? GAP / row.length : 0);
        const color = COLORS[slot.type] || '#475569';
        rects.push(`<rect x="${xCursor}" y="${y}" width="${slotW}" height="${rowH}" rx="2" fill="${color}" opacity="${slot.type === 'heading' ? '0.9' : '0.6'}"/>`);
        if (slot.type === 'heading') {
          rects.push(`<rect x="${xCursor + 2}" y="${y + rowH / 2 - 1}" width="${slotW * 0.55}" height="2" rx="1" fill="white" opacity="0.5"/>`);
        } else if (slot.type === 'gallery') {
          const cols = slot.galleryColumns ?? 2; const count = slot.galleryCount ?? cols;
          const gRows = Math.ceil(count / cols);
          const cellW = (slotW - (cols - 1) * 1.5) / cols; const cellH = (rowH - (gRows - 1) * 1.5) / gRows;
          for (let r = 0; r < gRows; r++) for (let c = 0; c < cols; c++) {
            if (r * cols + c >= count) break;
            const cx2 = xCursor + c * (cellW + 1.5); const cy2 = y + r * (cellH + 1.5);
            rects.push(`<rect x="${cx2}" y="${cy2}" width="${cellW}" height="${cellH}" rx="1.5" fill="white" opacity="0.12"/>`);
            rects.push(`<circle cx="${cx2 + cellW / 2}" cy="${cy2 + cellH / 2 - 1}" r="${Math.min(cellW, cellH) * 0.18}" fill="white" opacity="0.2"/>`);
          }
        } else if (slot.type === 'image') {
          const cx = xCursor + slotW / 2; const cy = y + rowH / 2;
          rects.push(`<circle cx="${cx}" cy="${cy - 3}" r="3" fill="white" opacity="0.25"/>`);
          rects.push(`<path d="M${xCursor + 2} ${y + rowH - 3} L${xCursor + slotW * 0.4} ${y + rowH / 2 + 2} L${xCursor + slotW - 2} ${y + rowH - 3}" fill="white" opacity="0.2"/>`);
        } else {
          const cols = slot.columns ?? 1; const colW = (slotW - (cols - 1) * 2) / cols;
          for (let c = 0; c < cols; c++) {
            const cx = xCursor + c * (colW + 2);
            [0.2, 0.45, 0.7].forEach(frac => {
              if (y + frac * rowH + 1 < y + rowH - 1) rects.push(`<rect x="${cx + 1}" y="${y + frac * rowH}" width="${colW * 0.85}" height="1.5" rx="0.75" fill="white" opacity="0.2"/>`);
            });
          }
        }
        xCursor += slotW + GAP;
      });
    });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" rx="4" fill="#0f172a"/>${rects.join('')}</svg>`;
}

function makeLayoutBlocks(slots: SeriesSlot[], typography?: DesignSystem['typography']): WorksheetBlock[] {
  let idCounter = 0;
  const nextId = () => `ds-layout-${++idCounter}`;

  // Resolve typography overrides for a given style key
  const ov = (id: TypographyStyleId) => typography?.styles?.[id] ?? {};
  const resolveFont = (id: TypographyStyleId, isHeading: boolean) =>
    ov(id).fontFamily || (isHeading
      ? `'${typography?.headingFont ?? 'Inter'}', serif`
      : `'${typography?.bodyFont ?? 'Inter'}', sans-serif`);

  const applyTypo = (slot: SeriesSlot, base: any): any => {
    if (!typography) return base;
    if (slot.type === 'heading') {
      const styleId = (slot.level as TypographyStyleId) ?? 'h2';
      const o = ov(styleId);
      return {
        ...base,
        fontFamily: resolveFont(styleId, true),
        fontSize: o.fontSize,
        lineHeight: o.lineHeight,
        letterSpacing: o.letterSpacing,
        align: o.textAlign || base.align,
        isBold: o.isBold,
        isItalic: o.isItalic,
        isUnderline: o.isUnderline,
        textColor: o.textColor,
      };
    }
    if (slot.type === 'paragraph') {
      const o = ov('body');
      return {
        ...base,
        fontFamily: resolveFont('body', false),
        fontSize: o.fontSize,
        lineHeight: o.lineHeight || 1.5,
        letterSpacing: o.letterSpacing,
        align: o.textAlign || base.align,
        isBold: o.isBold,
        isItalic: o.isItalic,
        isUnderline: o.isUnderline,
        textColor: o.textColor,
      };
    }
    return base;
  };

  const makePlaceholderContent = (slot: SeriesSlot): any => {
    if (slot.type === 'heading') return applyTypo(slot, { text: 'Název kapitoly nebo sekce', level: slot.level || 'h2' });
    if (slot.type === 'infobox') return { title: 'Shrnutí', html: '<p>Klíčové pojmy a závěry sekce.</p>', variant: 'green' as const };
    if (slot.type === 'paragraph') return applyTypo(slot, { html: '<p>Sem vložte hlavní text sekce. Popište téma srozumitelně a přehledně. Příliš žluťoučký kůň úpěl ďábelské ódy.</p>' });
    if (slot.type === 'gallery') return {
      url: '', alt: '', caption: '', alignment: 'center' as const, size: 100,
      gallery: Array(slot.galleryCount ?? 2).fill(''),
      galleryLayout: 'grid' as const, gridColumns: slot.galleryColumns ?? 1,
    };
    return { url: '', alt: '', caption: '', size: 100, alignment: 'center' as const };
  };

  return slots.map((slot, i) => {
    const blockType = (slot.type === 'gallery' ? 'image' : slot.type) as any;
    const block: any = {
      id: nextId(),
      type: blockType,
      order: i,
      gridSpan: slot.span,
      width: slot.span < 12 ? 'half' : 'full',
      content: makePlaceholderContent(slot),
    };
    if (slot.floatSide) {
      block.floatSide = slot.floatSide;
      block.floatSpanBlocks = slot.floatSpanBlocks;
      block.floatGridSpan = slot.floatGridSpan;
    }
    if (slot.columns && blockType === 'paragraph') block.content = { ...block.content, columns: slot.columns };
    return block as WorksheetBlock;
  });
}

// Lean presentational canvas — all state managed in DesignSystemPanel
function LayoutCanvas({ blocks, selectedBlockId, hoveredBlockId, isDirty, showSaveInput, saveName,
  onSelectBlock, onHoverBlock, onUpdateBlock, onUpdateBlockMargin, onUpdateBlockGridSpan,
  onDeleteBlock, onDuplicateBlock, onMoveBlockUp, onMoveBlockDown, onAddBlock,
  onSaveClick, onConfirmSave, onCancelSave, onSaveNameChange,
  activeCustomId, activeSeriesKey, pageDefaults,
}: {
  blocks: WorksheetBlock[];
  selectedBlockId: string | null;
  hoveredBlockId: string | null;
  isDirty: boolean;
  showSaveInput: boolean;
  saveName: string;
  onSelectBlock: (id: string | null) => void;
  onHoverBlock: (id: string | null) => void;
  onUpdateBlock: (id: string, content: any) => void;
  onUpdateBlockMargin: (id: string, margin: number) => void;
  onUpdateBlockGridSpan: (id: string, gridSpan: number, gridStart: number) => void;
  onDeleteBlock: (id: string) => void;
  onDuplicateBlock: (id: string) => void;
  onMoveBlockUp: (id: string) => void;
  onMoveBlockDown: (id: string) => void;
  onAddBlock: (type: BlockType) => void;
  onSaveClick: () => void;
  onConfirmSave: () => void;
  onCancelSave: () => void;
  onSaveNameChange: (name: string) => void;
  activeCustomId: string | null;
  activeSeriesKey: string;
  pageDefaults: DesignSystem['pageDefaults'];
}) {
  const [zoom, setZoom] = useState(0.75);
  const zoomIn = useCallback(() => setZoom(z => Math.min(2, Math.round((z + 0.1) * 10) / 10)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(0.3, Math.round((z - 0.1) * 10) / 10)), []);
  const noop = useCallback(() => {}, []);

  return (
    <div style={{ flex: 1, backgroundColor: '#0f172a', overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>

      {/* Floating zoom */}
      <div style={{
        position: 'absolute', top: 12, right: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        zIndex: 100, backgroundColor: '#1e293b', padding: '4px', borderRadius: '8px', border: '1px solid #334155', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>
        <button onClick={zoomIn} style={{ padding: '6px', background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#94a3b8', display: 'flex' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#334155')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, minWidth: 32, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button onClick={zoomOut} style={{ padding: '6px', background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#94a3b8', display: 'flex' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#334155')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
      </div>

      {/* Floating save button */}
      {isDirty && !showSaveInput && (
        <button onClick={onSaveClick} style={{
          position: 'absolute', bottom: 24, right: 24, zIndex: 100,
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '9px 18px', backgroundColor: '#3B82F6', border: 'none',
          borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'white',
          boxShadow: '0 4px 16px rgba(59,130,246,0.5)',
        }}>
          <Save size={14} />
          {activeCustomId ? 'Uložit změny' : 'Uložit jako layout'}
        </button>
      )}

      {/* Floating save name input */}
      {showSaveInput && (
        <div style={{
          position: 'absolute', bottom: 24, right: 24, zIndex: 100,
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 10px', backgroundColor: '#1e293b',
          border: '1px solid #334155', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          <input autoFocus value={saveName} onChange={e => onSaveNameChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onConfirmSave(); if (e.key === 'Escape') onCancelSave(); }}
            placeholder="Název layoutu…"
            style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#e2e8f0', fontSize: '12px', width: '160px', outline: 'none' }} />
          <button onClick={onConfirmSave} style={{ padding: '6px 14px', backgroundColor: '#3B82F6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'white' }}>Uložit</button>
          <button onClick={onCancelSave} style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={14} /></button>
        </div>
      )}

      {/* GridCanvas */}
      <div style={{ padding: '24px', transform: `scale(${zoom})`, transformOrigin: 'top center', marginBottom: zoom < 1 ? `-${(1 - zoom) * 100}%` : 0 }}>
        <GridCanvas
          blocks={blocks}
          selectedBlockId={selectedBlockId}
          hoveredBlockId={hoveredBlockId}
          onSelectBlock={onSelectBlock}
          onHoverBlock={onHoverBlock}
          onUpdateBlock={onUpdateBlock}
          onUpdateBlockMargin={onUpdateBlockMargin}
          onUpdateBlockGridSpan={onUpdateBlockGridSpan}
          onDeleteBlock={onDeleteBlock}
          onDuplicateBlock={onDuplicateBlock}
          onMoveBlockUp={onMoveBlockUp}
          onMoveBlockDown={onMoveBlockDown}
          onAddBlock={onAddBlock}
          onSwitchToAI={noop}
          onOpenAddPanel={noop}
          pageFormat={pageDefaults.pageFormat}
          pageBackgroundColor={pageDefaults.pageBackgroundColor}
          gridColumns={12}
          gridGapPx={16}
        />
      </div>
    </div>
  );
}

// ── AI canvas ─────────────────────────────────────────────────────────────────

function AICanvas({ aiPrompts, onChange }: { aiPrompts: DesignSystem['aiPrompts']; onChange: (v: DesignSystem['aiPrompts']) => void }) {
  const PRESETS = [
    { label: 'Akvarel', desc: 'Měkké, ručně malované', value: 'watercolor illustration, warm educational tones, hand-painted, soft colors' },
    { label: 'Flat vector', desc: 'Čisté plochy, moderní', value: 'flat vector illustration, clean lines, bright colors, modern educational style' },
    { label: 'Čárová kresba', desc: 'Minimalistická skica', value: 'line art illustration, black outlines, minimal color fills, sketch style' },
    { label: 'Realistický', desc: 'Fotografický styl', value: 'realistic photography, natural lighting, educational environment' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <div style={label11()}>Rychlé styly</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
          {PRESETS.map(p => {
            const active = aiPrompts.imageStyle === p.value;
            return (
              <button key={p.label} onClick={() => onChange({ ...aiPrompts, imageStyle: p.value })}
                style={btnBase({ flexDirection: 'column', alignItems: 'flex-start', padding: '14px 16px', gap: '4px',
                  backgroundColor: active ? C.accentDim : C.card, border: `1px solid ${active ? C.accent : C.border}`, borderRadius: '10px', position: 'relative' })}>
                <span style={{ fontSize: '13px', color: C.text, fontWeight: 700 }}>{p.label}</span>
                <span style={{ fontSize: '11px', color: C.muted }}>{p.desc}</span>
                {active && <Check size={13} style={{ position: 'absolute', top: '12px', right: '12px', color: C.accent }} />}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <div style={label11()}>Vlastní styl obrázků</div>
        <div style={{ fontSize: '11px', color: C.muted, marginBottom: '8px' }}>Automaticky přidán ke každému AI promptu na obrázek.</div>
        <textarea value={aiPrompts.imageStyle} onChange={e => onChange({ ...aiPrompts, imageStyle: e.target.value })}
          placeholder="např. watercolor, warm tones, educational, soft colors..."
          rows={3} style={{ ...inp({ resize: 'vertical', lineHeight: 1.6, fontSize: '12px' }) }} />
      </div>
      <div>
        <div style={label11()}>Negativní prompt</div>
        <textarea value={aiPrompts.negativePrompt || ''} onChange={e => onChange({ ...aiPrompts, negativePrompt: e.target.value })}
          placeholder="např. photorealistic, blurry, ugly, watermark..."
          rows={2} style={{ ...inp({ resize: 'vertical', lineHeight: 1.6, fontSize: '12px' }) }} />
      </div>
      <div>
        <div style={label11()}>Konzistentní postavy / vizuální svět</div>
        <textarea value={aiPrompts.characterStyle || ''} onChange={e => onChange({ ...aiPrompts, characterStyle: e.target.value })}
          placeholder="např. friendly cartoon robot, blue metallic body, round eyes, warm smile..."
          rows={3} style={{ ...inp({ resize: 'vertical', lineHeight: 1.6, fontSize: '12px' }) }} />
      </div>
    </div>
  );
}

// ── Blocks canvas ─────────────────────────────────────────────────────────────

function BlocksCanvas({ blockPreferences, onChange }: { blockPreferences: DesignSystem['blockPreferences']; onChange: (v: DesignSystem['blockPreferences']) => void }) {
  const toggle = (type: BlockType) => {
    const p = blockPreferences.preferred;
    onChange({ ...blockPreferences, preferred: p.includes(type) ? p.filter(t => t !== type) : [...p, type] });
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ fontSize: '13px', color: C.muted, lineHeight: 1.6 }}>
        Bloky označené ★ budou zvýrazněné v panelu přidávání obsahu.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
        {BLOCK_META.map(({ type, label, emoji }) => {
          const on = blockPreferences.preferred.includes(type);
          return (
            <button key={type} onClick={() => toggle(type)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px 8px',
                backgroundColor: on ? C.greenDim : C.card, border: `1px solid ${on ? C.green + '60' : C.border}`,
                borderRadius: '12px', cursor: 'pointer', position: 'relative', transition: 'background-color 0.12s, border-color 0.12s' }}>
              <span style={{ fontSize: '24px', lineHeight: 1 }}>{emoji}</span>
              <span style={{ fontSize: '11px', color: on ? C.green : C.muted, textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
              {on && <Star size={10} style={{ position: 'absolute', top: '7px', right: '9px', color: C.yellow, fill: C.yellow }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── DS Dropdown ───────────────────────────────────────────────────────────────

function DSDropdown({ systems, activeId, onSelect, onClose }: {
  systems: DesignSystem[]; activeId?: string;
  onSelect: (ds: DesignSystem) => void; onClose: () => void;
}) {
  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 500,
      backgroundColor: '#1c2128', border: `1px solid ${C.border}`, borderRadius: '10px',
      boxShadow: '0 16px 48px rgba(0,0,0,0.8)', maxHeight: '200px', overflowY: 'auto',
    }}>
      {systems.length === 0
        ? <div style={{ padding: '14px', textAlign: 'center', fontSize: '12px', color: C.muted }}>Žádné systémy — vytvoř první!</div>
        : systems.map(ds => (
          <button key={ds.id} onClick={() => { onSelect(ds); onClose(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '9px 12px',
              backgroundColor: activeId === ds.id ? C.accentDim : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            onMouseEnter={e => { if (activeId !== ds.id) (e.currentTarget as HTMLElement).style.backgroundColor = '#21262d'; }}
            onMouseLeave={e => { if (activeId !== ds.id) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
            <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: ds.thumbnail_color || C.accent, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '12px', color: C.text }}>{ds.name}</span>
            {activeId === ds.id && <Check size={11} style={{ color: C.accent }} />}
          </button>
        ))
      }
    </div>
  );
}

// ── Dataset canvas ────────────────────────────────────────────────────────────

// ── Main panel ────────────────────────────────────────────────────────────────

interface DesignSystemPanelProps {
  activeDesignSystem: DesignSystem | null;
  onDesignSystemChange: (ds: DesignSystem | null) => void;
  onApplyToProject: (ds: DesignSystem) => void;
  /** Controlled from outside (mini sidebar icons) */
  activeCategory?: Category;
  onCategoryChange?: (cat: Category) => void;
}

function CustomLayoutItem({ layout, isActive, onSelect, onRename }: {
  layout: CustomLayout;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(layout.name);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '5px 6px', borderRadius: '7px',
      border: `2px solid ${isActive ? C.accent : 'transparent'}`,
      backgroundColor: isActive ? C.accentDim : 'transparent',
    }}>
      {editing ? (
        <input autoFocus value={editName}
          onChange={e => setEditName(e.target.value)}
          onBlur={() => { onRename(editName); setEditing(false); }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { onRename(editName); setEditing(false); } }}
          style={{ flex: 1, fontSize: '11px', padding: '2px 6px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#e2e8f0', outline: 'none' }}
        />
      ) : (
        <button onClick={onSelect}
          style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
            fontSize: '11px', color: isActive ? C.accent : C.text, fontWeight: isActive ? 700 : 400,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: 0 }}>
          {layout.name}
        </button>
      )}
      <button onClick={() => { setEditName(layout.name); setEditing(true); }}
        style={{ padding: '2px', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, flexShrink: 0 }}>
        <Edit2 size={10} />
      </button>
    </div>
  );
}

export function DesignSystemPanel({ activeDesignSystem, onDesignSystemChange, onApplyToProject, activeCategory: activeCategoryProp, onCategoryChange }: DesignSystemPanelProps) {
  const [allSystems, setAllSystems] = useState<DesignSystem[]>([]);
  const [draft, setDraft] = useState<DesignSystem | null>(activeDesignSystem);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [_activeCategory, _setActiveCategory] = useState<Category>('system');
  const activeCategory = activeCategoryProp ?? _activeCategory;
  const setActiveCategory = (cat: Category) => { _setActiveCategory(cat); onCategoryChange?.(cat); };
  // Typography sub-item
  const [typographyStyle, setTypographyStyle] = useState<TypographyStyleId>('h1');
  // Layout active preset key and custom layout
  const [activeLayoutKey, setActiveLayoutKey] = useState<string>('A');
  const [activeCustomLayoutId, setActiveCustomLayoutId] = useState<string | null>(null);
  const [layoutEditingMode, setLayoutEditingMode] = useState(false);

  // ── Layout editor state (lifted from LayoutCanvas) ──
  const [layoutBlocks, setLayoutBlocks] = useState<WorksheetBlock[]>([]);
  const [layoutSelectedId, setLayoutSelectedId] = useState<string | null>(null);
  const [layoutHoveredId, setLayoutHoveredId] = useState<string | null>(null);
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [layoutShowSave, setLayoutShowSave] = useState(false);
  const [layoutSaveName, setLayoutSaveName] = useState('');
  const [showAddBlockPicker, setShowAddBlockPicker] = useState(false);

  // Load blocks when layout preset / custom selection changes
  useEffect(() => {
    if (!draft) return;
    if (activeCustomLayoutId) {
      const custom = (draft.blockPreferences.customLayouts ?? []).find(l => l.id === activeCustomLayoutId);
      setLayoutBlocks(custom ? [...custom.blocks] : []);
    } else if (activeLayoutKey) {
      setLayoutBlocks(makeLayoutBlocks(LAYOUT_SERIES[activeLayoutKey]?.slots ?? [], draft.typography));
    }
    setLayoutSelectedId(null);
    setLayoutDirty(false);
    setLayoutShowSave(false);
  }, [activeLayoutKey, activeCustomLayoutId]);

  // Re-apply typography to preset blocks when typography changes
  useEffect(() => {
    if (activeCustomLayoutId || !draft || !activeLayoutKey) return;
    setLayoutBlocks(makeLayoutBlocks(LAYOUT_SERIES[activeLayoutKey]?.slots ?? [], draft.typography));
  }, [draft?.typography]);

  const layoutUpdateBlock = useCallback((id: string, content: any) => {
    setLayoutBlocks(prev => prev.map(b => b.id === id ? { ...b, content: { ...(b as any).content, ...content } } : b));
    setLayoutDirty(true);
  }, []);

  const layoutUpdateBlockFull = useCallback((id: string, updates: Partial<WorksheetBlock>) => {
    setLayoutBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    setLayoutDirty(true);
  }, []);

  const layoutUpdateMargin = useCallback((id: string, margin: number) => {
    setLayoutBlocks(prev => prev.map(b => b.id === id ? { ...b, marginBottom: margin } : b));
    setLayoutDirty(true);
  }, []);

  const layoutUpdateGridSpan = useCallback((id: string, gridSpan: number, gridStart: number) => {
    setLayoutBlocks(prev => prev.map(b => b.id === id ? { ...b, gridSpan, gridStart, width: gridSpan < 12 ? 'half' as const : 'full' as const } : b));
    setLayoutDirty(true);
  }, []);

  const layoutDeleteBlock = useCallback((id: string) => {
    setLayoutBlocks(prev => prev.filter(b => b.id !== id).map((b, i) => ({ ...b, order: i })));
    setLayoutSelectedId(null);
    setLayoutDirty(true);
  }, []);

  const layoutDuplicateBlock = useCallback((id: string) => {
    setLayoutBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx < 0) return prev;
      const copy = { ...prev[idx], id: `ds-dup-${Date.now()}` };
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)].map((b, i) => ({ ...b, order: i }));
    });
    setLayoutDirty(true);
  }, []);

  const layoutMoveUp = useCallback((id: string) => {
    setLayoutBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((b, i) => ({ ...b, order: i }));
    });
    setLayoutDirty(true);
  }, []);

  const layoutMoveDown = useCallback((id: string) => {
    setLayoutBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((b, i) => ({ ...b, order: i }));
    });
    setLayoutDirty(true);
  }, []);

  const layoutAddBlock = useCallback((type: BlockType) => {
    const id = `ds-new-${Date.now()}`;
    const contentMap: Record<string, any> = {
      heading: { text: 'Nový nadpis', level: 'h2' },
      paragraph: { html: '<p>Nový odstavec</p>' },
      image: { url: '', alt: '', caption: '', size: 100, alignment: 'center' },
      infobox: { title: 'Shrnutí', html: '<p>Text</p>', variant: 'blue' },
      'fill-blank': { instruction: 'Doplňte:', segments: [{ type: 'text', value: 'Text ' }, { type: 'blank', answer: '', id: 'b1' }] },
      'free-answer': { question: 'Otázka', lines: 3 },
      'multiple-choice': { question: 'Otázka', options: [{ id: 'o1', text: 'Možnost A' }, { id: 'o2', text: 'Možnost B' }] },
      spacer: { style: 'empty', height: 40 },
    };
    const newBlock: any = { id, type, order: layoutBlocks.length, gridSpan: 12, width: 'full', content: contentMap[type] ?? { html: '' } };
    setLayoutBlocks(prev => [...prev, newBlock]);
    setLayoutSelectedId(id);
    setLayoutDirty(true);
    setShowAddBlockPicker(false);
  }, [layoutBlocks.length]);

  useEffect(() => {
    getDesignSystems().then(sys => { setAllSystems(sys); setLoading(false); });
  }, []);

  useEffect(() => { setDraft(activeDesignSystem); setIsDirty(false); }, [activeDesignSystem]);

  const update = useCallback(<K extends keyof DesignSystem>(key: K, val: DesignSystem[K]) => {
    setDraft(prev => prev ? { ...prev, [key]: val } : null);
    setIsDirty(true);
  }, []);

  const layoutHandleSaveClick = useCallback(() => {
    if (activeCustomLayoutId && draft) {
      const updated = (draft.blockPreferences.customLayouts ?? []).map(l => l.id === activeCustomLayoutId ? { ...l, blocks: layoutBlocks } : l);
      update('blockPreferences', { ...draft.blockPreferences, customLayouts: updated });
      setLayoutDirty(false);
      toast.success('Layout uložen');
    } else {
      setLayoutSaveName(LAYOUT_SERIES[activeLayoutKey]?.label ?? 'Nový layout');
      setLayoutShowSave(true);
    }
  }, [activeCustomLayoutId, activeLayoutKey, layoutBlocks, draft, update]);

  const layoutConfirmSave = useCallback(() => {
    if (!layoutSaveName.trim() || !draft) return;
    const newLayout: CustomLayout = { id: `cl-${Date.now()}`, name: layoutSaveName.trim(), blocks: layoutBlocks };
    const updated = [...(draft.blockPreferences.customLayouts ?? []), newLayout];
    update('blockPreferences', { ...draft.blockPreferences, customLayouts: updated });
    setActiveCustomLayoutId(newLayout.id);
    setLayoutShowSave(false);
    setLayoutDirty(false);
    toast.success(`Layout "${layoutSaveName}" uložen`);
  }, [layoutSaveName, layoutBlocks, draft, update]);

  const handleNew = () => {
    const empty = createEmptyDesignSystem('Nový design systém');
    setDraft({ ...empty, id: `local-${Date.now()}`, teacher_id: '', created_at: '', updated_at: '' });
    setIsDirty(true);
    onDesignSystemChange(null);
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    const saved = await saveDesignSystem({
      id: draft.id.startsWith('local-') ? undefined : draft.id,
      name: draft.name, description: draft.description, thumbnail_color: draft.thumbnail_color,
      colors: draft.colors, typography: draft.typography, pageDefaults: draft.pageDefaults,
      aiPrompts: draft.aiPrompts, blockPreferences: draft.blockPreferences,
    });
    setSaving(false);
    if (saved) {
      setDraft(saved); setIsDirty(false);
      setAllSystems(prev => { const i = prev.findIndex(s => s.id === saved.id); return i >= 0 ? prev.map(s => s.id === saved.id ? saved : s) : [saved, ...prev]; });
      onDesignSystemChange(saved);
      toast.success('Uloženo');
    } else {
      toast.error('Chyba při ukládání');
    }
  };

  // Auto-save — debounced 1.5s after any change
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isDirty || saving) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { handleSave(); }, 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, draft]);

  const handleDuplicate = async () => {
    if (!draft || draft.id.startsWith('local-')) { toast.info('Nejprve uložte'); return; }
    const copy = await duplicateDesignSystem(draft.id, `${draft.name} – kopie`);
    if (copy) { setAllSystems(p => [copy, ...p]); setDraft(copy); onDesignSystemChange(copy); setIsDirty(false); toast.success('Duplikováno'); }
  };

  const handleDelete = async () => {
    if (!draft || draft.id.startsWith('local-')) return;
    if (!confirm(`Smazat "${draft.name}"?`)) return;
    await deleteDesignSystem(draft.id);
    setAllSystems(p => p.filter(s => s.id !== draft.id));
    setDraft(null); onDesignSystemChange(null); toast.success('Smazáno');
  };

  // Custom layout handlers
  const handleSaveLayout = useCallback((name: string, blocks: WorksheetBlock[]) => {
    if (!draft) return;
    const newLayout: CustomLayout = { id: `cl-${Date.now()}`, name, blocks };
    const updated: CustomLayout[] = [...(draft.blockPreferences.customLayouts ?? []), newLayout];
    update('blockPreferences', { ...draft.blockPreferences, customLayouts: updated });
    setActiveCustomLayoutId(newLayout.id);
    setIsDirty(true);
  }, [draft, update]);

  const handleUpdateLayout = useCallback((id: string, blocks: WorksheetBlock[]) => {
    if (!draft) return;
    const updated = (draft.blockPreferences.customLayouts ?? []).map(l => l.id === id ? { ...l, blocks } : l);
    update('blockPreferences', { ...draft.blockPreferences, customLayouts: updated });
    setIsDirty(true);
  }, [draft, update]);

  const handleDeleteLayout = useCallback((id: string) => {
    if (!draft) return;
    const updated = (draft.blockPreferences.customLayouts ?? []).filter(l => l.id !== id);
    update('blockPreferences', { ...draft.blockPreferences, customLayouts: updated });
    setActiveCustomLayoutId(null);
    setIsDirty(true);
  }, [draft, update]);

  const handleRenameLayout = useCallback((id: string, name: string) => {
    if (!draft) return;
    const updated = (draft.blockPreferences.customLayouts ?? []).map(l => l.id === id ? { ...l, name } : l);
    update('blockPreferences', { ...draft.blockPreferences, customLayouts: updated });
    setIsDirty(true);
  }, [draft, update]);

  const handleAddNewLayout = useCallback(() => {
    if (!draft) return;
    const newLayout: CustomLayout = { id: `cl-${Date.now()}`, name: `Layout ${(draft.blockPreferences.customLayouts?.length ?? 0) + 1}`, blocks: [] };
    const updated = [...(draft.blockPreferences.customLayouts ?? []), newLayout];
    update('blockPreferences', { ...draft.blockPreferences, customLayouts: updated });
    setActiveCustomLayoutId(newLayout.id);
    setActiveLayoutKey('');
    setLayoutEditingMode(true);
    setIsDirty(true);
  }, [draft, update]);

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', backgroundColor: C.bg }}>

      {/* ── LEFT SIDEBAR — same width as editor aside panel (300px) ── */}
      <div style={{
        width: '300px', minWidth: '300px', flexShrink: 0,
        backgroundColor: '#1e293b', borderRight: '1px solid #334155',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Minimal DS indicator — always visible (name + dirty dot) */}
        {activeCategory !== 'system' && (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #334155', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '7px' }}>
            {draft && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: draft.thumbnail_color || C.accent, flexShrink: 0 }} />}
            <span style={{ fontSize: '12px', color: draft ? '#E5E5E5' : '#64748b', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {loading ? 'Načítám…' : (draft?.name || 'Žádný design systém')}
            </span>
            {saving && <Loader2 size={12} className="animate-spin" style={{ color: '#3B82F6', flexShrink: 0 }} />}
            {isDirty && !saving && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b', flexShrink: 0 }} title="Neuloženo" />}
          </div>
        )}

        {/* DS selector panel — shown only in 'system' tab */}
        {activeCategory === 'system' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Top action bar */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #334155', display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button onClick={handleNew}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '7px', backgroundColor: '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#94a3b8', fontSize: '11px', fontWeight: 500 }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#475569')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#334155')}>
                <Plus size={13} /> Nový
              </button>
              {draft && (
                <button onClick={handleDuplicate}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '7px', backgroundColor: '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#94a3b8', fontSize: '11px', fontWeight: 500 }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#475569')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#334155')}>
                  <Copy size={13} /> Kopie
                </button>
              )}
              {draft && !draft.id.startsWith('local-') && (
                <button onClick={handleDelete}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px 10px', backgroundColor: '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#EF4444', fontSize: '11px' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#475569')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#334155')}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            {/* System list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', color: '#64748b', fontSize: '12px' }}>
                  <Loader2 size={13} className="animate-spin" /> Načítám…
                </div>
              )}
              {!loading && allSystems.length === 0 && (
                <div style={{ padding: '20px 12px', textAlign: 'center', color: '#475569', fontSize: '12px' }}>
                  Žádný design systém.<br/>Klikni na + Nový.
                </div>
              )}
              {allSystems.map(ds => {
                const isSelected = ds.id === draft?.id;
                const isApplied = ds.id === activeDesignSystem?.id;
                return (
                  <button
                    key={ds.id}
                    onClick={() => { setDraft(ds); onDesignSystemChange(ds); setIsDirty(false); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                      border: `2px solid ${isSelected ? C.accent : 'transparent'}`,
                      backgroundColor: isSelected ? 'rgba(92,92,255,0.1)' : 'transparent',
                      textAlign: 'left', marginBottom: '2px',
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = '#263348'; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <div style={{ width: '28px', height: '28px', borderRadius: '7px', backgroundColor: ds.thumbnail_color || C.accent, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#f1f5f9' : '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ds.name}
                      </div>
                      {isApplied && (
                        <div style={{ fontSize: '10px', color: '#22c55e', fontWeight: 600, marginTop: '2px' }}>
                          ✓ Aplikováno
                        </div>
                      )}
                    </div>
                    {isSelected && <Check size={14} style={{ color: C.accent, flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>

            {/* Edit strip for selected system */}
            {draft && (
              <div style={{ padding: '10px 12px', borderTop: '1px solid #334155', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    onClick={() => { const i = document.createElement('input'); i.type = 'color'; i.value = draft.thumbnail_color || C.accent; i.onchange = e => update('thumbnail_color', (e.target as HTMLInputElement).value); i.click(); }}
                    style={{ width: '30px', height: '30px', borderRadius: '6px', backgroundColor: draft.thumbnail_color || C.accent, cursor: 'pointer', flexShrink: 0, border: '1px solid #475569' }}
                    title="Barva systému"
                  />
                  <input
                    value={draft.name}
                    onChange={e => update('name', e.target.value)}
                    style={{ ...inputStyle, flex: 1, fontWeight: 600, padding: '6px 10px', fontSize: '13px' }}
                    placeholder="Název systému"
                  />
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={handleSave} disabled={!isDirty || saving}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '7px', backgroundColor: isDirty ? '#3B82F6' : '#334155', border: 'none', borderRadius: '6px', cursor: isDirty && !saving ? 'pointer' : 'default', color: isDirty ? 'white' : '#475569', fontSize: '12px', fontWeight: 600 }}>
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    {isDirty ? 'Uložit' : 'Uloženo'}
                  </button>
                  <button onClick={() => { onApplyToProject(draft); toast.success('Aplikováno na projekt'); }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '7px 14px', backgroundColor: '#0c2a1a', border: '1px solid #22c55e40', borderRadius: '6px', cursor: 'pointer', color: '#22c55e', fontSize: '12px', fontWeight: 500 }}>
                    <RefreshCw size={12} /> Aplikovat
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Layout editing panel — full sidebar replacement */}
        {draft && activeCategory === 'layout' && layoutEditingMode && (() => {
          const layoutName = activeCustomLayoutId
            ? (draft.blockPreferences.customLayouts ?? []).find(l => l.id === activeCustomLayoutId)?.name ?? 'Vlastní layout'
            : LAYOUT_SERIES[activeLayoutKey]?.label ?? 'Layout';
          const selectedBlock = layoutBlocks.find(b => b.id === layoutSelectedId);
          const selectedIdx = layoutBlocks.findIndex(b => b.id === layoutSelectedId);
          return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* Sticky header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 10px', flexShrink: 0,
                backgroundColor: '#172033',
                borderBottom: '1px solid #334155',
              }}>
                <button
                  onClick={() => { setLayoutEditingMode(false); setLayoutSelectedId(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '4px 8px', backgroundColor: '#334155', border: 'none', borderRadius: '5px', cursor: 'pointer', color: '#94a3b8', fontSize: '11px', fontWeight: 500, flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#475569')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#334155')}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                  Zpět
                </button>
                <span style={{ flex: 1, fontSize: '11px', fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {layoutName}
                </span>
                <button onClick={layoutHandleSaveClick}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '3px',
                    padding: '4px 10px', border: 'none', borderRadius: '5px', cursor: 'pointer',
                    fontSize: '11px', fontWeight: 600, flexShrink: 0,
                    backgroundColor: layoutDirty ? '#3B82F6' : '#334155',
                    color: layoutDirty ? 'white' : '#475569',
                  }}>
                  <Save size={11} /> Uložit
                </button>
              </div>

              {/* Scrollable content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>

                {/* + Přidat blok */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={label11()}>Bloky v layoutu</div>
                  <button onClick={() => setShowAddBlockPicker(p => !p)}
                    style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 8px', backgroundColor: showAddBlockPicker ? C.accent : '#334155', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', color: showAddBlockPicker ? 'white' : '#94a3b8', fontWeight: 600 }}>
                    <Plus size={10} /> Přidat
                  </button>
                </div>

                {/* Block type picker */}
                {showAddBlockPicker && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '10px', padding: '8px', backgroundColor: '#172033', borderRadius: '8px', border: '1px solid #334155' }}>
                    {([
                      ['heading', 'Nadpis', Type],
                      ['paragraph', 'Odstavec', AlignLeft],
                      ['image', 'Obrázek', Layers],
                      ['infobox', 'Infobox', Sparkles],
                      ['free-answer', 'Volná odpověď', Type],
                      ['multiple-choice', 'Výběr', Check],
                      ['fill-blank', 'Doplňování', Type],
                      ['spacer', 'Mezera', LayoutGrid],
                    ] as [BlockType, string, any][]).map(([t, lbl, Ico]) => (
                      <button key={t} onClick={() => layoutAddBlock(t)}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 7px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontSize: '10px', color: '#94a3b8', fontWeight: 500, textAlign: 'left' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#263348'; (e.currentTarget as HTMLElement).style.color = '#e2e8f0'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1e293b'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}>
                        <Ico size={10} /> {lbl}
                      </button>
                    ))}
                  </div>
                )}

                {/* Block list */}
                {layoutBlocks.length === 0 ? (
                  <div style={{ fontSize: '11px', color: C.muted, textAlign: 'center', padding: '16px 0', opacity: 0.6 }}>Žádné bloky. Klikni + Přidat.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '12px' }}>
                    {layoutBlocks.map((block, idx) => {
                      const isSel = layoutSelectedId === block.id;
                      const lbl = (() => {
                        if (block.type === 'heading') return (block as any).content?.text || 'Nadpis';
                        if (block.type === 'paragraph') return ((block as any).content?.html || '').replace(/<[^>]+>/g, '').trim().slice(0, 30) || 'Odstavec';
                        if (block.type === 'infobox') return (block as any).content?.title || 'Infobox';
                        if (block.type === 'free-answer') return (block as any).content?.question || 'Volná odpověď';
                        if (block.type === 'multiple-choice') return (block as any).content?.question || 'Výběr';
                        return block.type;
                      })();
                      return (
                        <div key={block.id} onClick={() => setLayoutSelectedId(isSel ? null : block.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 6px', borderRadius: '6px', cursor: 'pointer', backgroundColor: isSel ? C.accentDim : 'transparent', border: `1px solid ${isSel ? C.accent : 'transparent'}` }}
                          onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.backgroundColor = '#263348'; }}
                          onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
                          <span style={{ flex: 1, fontSize: '11px', color: isSel ? C.accent : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isSel ? 600 : 400 }}>{lbl}</span>
                          <button onClick={e => { e.stopPropagation(); layoutMoveUp(block.id); }} disabled={idx === 0}
                            style={{ padding: '2px', background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#334155' : C.muted, display: 'flex' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                          </button>
                          <button onClick={e => { e.stopPropagation(); layoutMoveDown(block.id); }} disabled={idx === layoutBlocks.length - 1}
                            style={{ padding: '2px', background: 'none', border: 'none', cursor: idx === layoutBlocks.length - 1 ? 'default' : 'pointer', color: idx === layoutBlocks.length - 1 ? '#334155' : C.muted, display: 'flex' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                          <button onClick={e => { e.stopPropagation(); layoutDeleteBlock(block.id); }}
                            style={{ padding: '2px', background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', display: 'flex' }}>
                            <X size={10} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ProBlockSettingsPanel for selected block */}
                {selectedBlock && (
                  <div style={{ borderTop: '1px solid #334155', paddingTop: '4px' }}>
                    <ProBlockSettingsPanel
                      block={selectedBlock}
                      allBlocks={layoutBlocks}
                      onClose={() => setLayoutSelectedId(null)}
                      onUpdateBlock={(id, updates) => layoutUpdateBlockFull(id, updates)}
                      onDeleteBlock={layoutDeleteBlock}
                      onDuplicateBlock={layoutDuplicateBlock}
                      onMoveUp={layoutMoveUp}
                      onMoveDown={layoutMoveDown}
                      canMoveUp={selectedIdx > 0}
                      canMoveDown={selectedIdx < layoutBlocks.length - 1}
                      gridColumns={12}
                      designSystem={draft}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Category sidebar content — controlled by mini sidebar icons */}
        {draft && !(activeCategory === 'layout' && layoutEditingMode) && (
          <div style={{ flex: 1, overflowY: 'auto' }}>

                  {/* Typografie sub-items + settings */}
                  {activeCategory === 'typography' && (
                    <div>
                      {TYPO_STYLES.map(style => {
                        const styleActive = typographyStyle === style.id;
                        return (
                          <button
                            key={style.id}
                            onClick={() => setTypographyStyle(style.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                              padding: '8px 16px 8px 20px', border: 'none', cursor: 'pointer', textAlign: 'left',
                              backgroundColor: styleActive ? '#1e3a5f' : 'transparent',
                            }}
                            onMouseEnter={e => { if (!styleActive) (e.currentTarget as HTMLElement).style.backgroundColor = '#263348'; }}
                            onMouseLeave={e => { if (!styleActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                          >
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              minWidth: '28px', height: '18px', padding: '0 4px',
                              backgroundColor: styleActive ? '#1e40af' : '#334155',
                              borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                              color: styleActive ? '#93c5fd' : '#94a3b8', fontFamily: 'monospace',
                            }}>
                              {style.tag}
                            </span>
                            <span style={{ fontSize: '12px', color: styleActive ? '#E5E5E5' : '#94a3b8', fontWeight: styleActive ? 600 : 400 }}>
                              {style.label}
                            </span>
                          </button>
                        );
                      })}
                      {draft && (
                        <TypoStyleSettings
                          styleId={typographyStyle}
                          typography={draft.typography}
                          onChange={v => update('typography', v)}
                        />
                      )}
                    </div>
                  )}

                  {/* Layout sub-items: page settings + presets */}
                  {activeCategory === 'layout' && draft && (
                    <div style={{ backgroundColor: '#172033', padding: '10px 12px 12px' }}>
                      {/* Page format */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={label11()}>Formát stránky</div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {(['a4', 'b5', 'a5'] as const).map(f => (
                            <button key={f} onClick={() => update('pageDefaults', { ...draft.pageDefaults, pageFormat: f })}
                              style={{ flex: 1, padding: '5px 4px', border: `1px solid ${draft.pageDefaults.pageFormat === f ? C.accent : C.border}`,
                                backgroundColor: draft.pageDefaults.pageFormat === f ? C.accentDim : 'transparent',
                                borderRadius: '6px', cursor: 'pointer', fontSize: '10px', fontWeight: 600,
                                color: draft.pageDefaults.pageFormat === f ? C.accent : C.muted }}>
                              {f.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Background color */}
                      <div style={{ marginBottom: '14px' }}>
                        <div style={label11()}>Barva pozadí</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          {['#ffffff','#F8FAFC','#F1F5F9','#E2E8F0','#FFFBEB','#FEF3C7','#F0FDF4','#EFF6FF','#FAF5FF','#FDF2F8'].map(bg => (
                            <div key={bg} onClick={() => update('pageDefaults', { ...draft.pageDefaults, pageBackgroundColor: bg })}
                              style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: bg, cursor: 'pointer',
                                border: draft.pageDefaults.pageBackgroundColor === bg ? `2px solid ${C.accent}` : '1px solid #475569',
                                boxShadow: draft.pageDefaults.pageBackgroundColor === bg ? `0 0 0 2px ${C.accent}44` : 'none' }} />
                          ))}
                          <div onClick={() => {
                            const i = document.createElement('input'); i.type = 'color'; i.value = draft.pageDefaults.pageBackgroundColor;
                            i.onchange = e => update('pageDefaults', { ...draft.pageDefaults, pageBackgroundColor: (e.target as HTMLInputElement).value }); i.click();
                          }} style={{ width: '20px', height: '20px', borderRadius: '50%', cursor: 'pointer',
                            border: `1px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Palette size={9} style={{ color: C.muted }} />
                          </div>
                        </div>
                      </div>

                      {/* Add new layout button */}
                      <button onClick={handleAddNewLayout}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
                          padding: '7px 10px', marginBottom: '12px',
                          backgroundColor: '#172033', border: '1px dashed #334155',
                          borderRadius: '7px', cursor: 'pointer', fontSize: '11px',
                          color: '#64748b', fontWeight: 500,
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3B82F6'; (e.currentTarget as HTMLElement).style.color = '#3B82F6'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#334155'; (e.currentTarget as HTMLElement).style.color = '#64748b'; }}>
                        <Plus size={12} /> Přidat layout
                      </button>

                      {/* Moje layouty */}
                      {(draft.blockPreferences.customLayouts ?? []).length > 0 && (
                        <div style={{ marginBottom: '14px' }}>
                          <div style={label11()}>Moje layouty</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {(draft.blockPreferences.customLayouts ?? []).map(cl => (
                              <CustomLayoutItem
                                key={cl.id}
                                layout={cl}
                                isActive={activeCustomLayoutId === cl.id}
                                onSelect={() => { setActiveCustomLayoutId(cl.id); setActiveLayoutKey(''); setLayoutEditingMode(true); }}
                                onRename={(name) => handleRenameLayout(cl.id, name)}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Layout presets */}
                      <div style={{ marginBottom: '16px' }}>
                        <div style={label11()}>Přednastavené layouty</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {SERIES_GROUPS.map(grp => {
                            const items = Object.entries(LAYOUT_SERIES).filter(([, v]) => v.group === grp.id);
                            return (
                              <div key={grp.id}>
                                <div style={{ fontSize: '9px', fontWeight: 700, color: C.muted, textTransform: 'uppercase',
                                  letterSpacing: '0.5px', marginBottom: '5px' }}>{grp.label}</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  {items.map(([key, series]) => {
                                    const isActive = activeLayoutKey === key && !activeCustomLayoutId;
                                    const svgStr = generateLayoutSVG(series.slots);
                                    return (
                                      <button key={key} onClick={() => { setActiveLayoutKey(key); setActiveCustomLayoutId(null); setLayoutEditingMode(true); }} title={series.description}
                                        style={{
                                          padding: '5px 8px 5px 5px', borderRadius: '7px', cursor: 'pointer',
                                          border: `2px solid ${isActive ? C.accent : 'transparent'}`,
                                          backgroundColor: isActive ? C.accentDim : 'transparent',
                                          display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left',
                                        }}
                                        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = '#263348'; }}
                                        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                                      >
                                        <div dangerouslySetInnerHTML={{ __html: svgStr }} style={{ lineHeight: 0, flexShrink: 0, transform: 'scale(0.7)', transformOrigin: 'left center', width: '53px', height: '42px', overflow: 'hidden' }} />
                                        <span style={{ fontSize: '11px', color: isActive ? C.accent : C.text, fontWeight: isActive ? 700 : 400,
                                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {series.label}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  )}
          </div>
        )}
      </div>

      {/* ── RIGHT CANVAS ─────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        backgroundColor: (activeCategory === 'typography' || activeCategory === 'layout') ? '#0f172a' : C.canvas,
        overflowY: (activeCategory === 'typography' || activeCategory === 'layout') ? 'hidden' : 'auto',
        overflowX: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {!draft ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Palette size={56} style={{ color: C.muted, marginBottom: '18px', opacity: 0.2 }} />
            <div style={{ fontSize: '18px', fontWeight: 600, color: C.muted, marginBottom: '8px' }}>Žádný design systém</div>
            <div style={{ fontSize: '13px', color: C.muted, opacity: 0.6, marginBottom: '28px', textAlign: 'center', maxWidth: '340px', lineHeight: 1.7 }}>
              Design systém definuje barvy, fonty a styl pro celou učebnici.
            </div>
            <button onClick={handleNew}
              style={btnBase({ backgroundColor: C.accent, color: 'white', border: 'none', padding: '13px 28px', borderRadius: '10px', fontSize: '14px', fontWeight: 600 })}>
              <Plus size={16} /> Vytvořit design systém
            </button>
          </div>
        ) : activeCategory === 'typography' ? (
          <TypographyCanvas
            typography={draft.typography}
            onChange={v => update('typography', v)}
            activeStyle={typographyStyle}
            onActiveStyleChange={setTypographyStyle}
          />
        ) : activeCategory === 'layout' ? (
          <LayoutCanvas
            blocks={layoutBlocks}
            selectedBlockId={layoutSelectedId}
            hoveredBlockId={layoutHoveredId}
            isDirty={layoutDirty}
            showSaveInput={layoutShowSave}
            saveName={layoutSaveName}
            onSelectBlock={setLayoutSelectedId}
            onHoverBlock={setLayoutHoveredId}
            onUpdateBlock={layoutUpdateBlock}
            onUpdateBlockMargin={layoutUpdateMargin}
            onUpdateBlockGridSpan={layoutUpdateGridSpan}
            onDeleteBlock={layoutDeleteBlock}
            onDuplicateBlock={layoutDuplicateBlock}
            onMoveBlockUp={layoutMoveUp}
            onMoveBlockDown={layoutMoveDown}
            onAddBlock={layoutAddBlock}
            onSaveClick={layoutHandleSaveClick}
            onConfirmSave={layoutConfirmSave}
            onCancelSave={() => setLayoutShowSave(false)}
            onSaveNameChange={setLayoutSaveName}
            activeCustomId={activeCustomLayoutId}
            activeSeriesKey={activeLayoutKey}
            pageDefaults={draft.pageDefaults}
          />
        ) : activeCategory === 'system' ? null : (
          <div style={{ padding: '36px 40px', maxWidth: '960px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
              {(() => { const cat = CATEGORIES.find(c => c.id === activeCategory); if (!cat) return null; const Icon = cat.icon; return <Icon size={20} style={{ color: C.accent }} />; })()}
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: C.text, margin: 0 }}>
                {CATEGORIES.find(c => c.id === activeCategory)?.label}
              </h1>
            </div>
            {activeCategory === 'colors' && (
              <ColorsCanvas colors={draft.colors} onChange={v => update('colors', v)} />
            )}
            {activeCategory === 'ai' && (
              <AICanvas aiPrompts={draft.aiPrompts} onChange={v => update('aiPrompts', v)} />
            )}
            {activeCategory === 'blocks' && (
              <BlocksCanvas blockPreferences={draft.blockPreferences} onChange={v => update('blockPreferences', v)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
