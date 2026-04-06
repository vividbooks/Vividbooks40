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
  Edit2, RefreshCw, Loader2, Star, Library,
  AlignLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { ProBlockSettingsPanel } from './ProBlockSettingsPanel';
import {
  DesignSystem, ColorGroup, ColorSwatch, CustomLayout,
  CURATED_FONTS, createEmptyDesignSystem,
  buildDesignSystemFontPickList, extractFontFamilyName,
} from '../../types/design-system';
import {
  mergeBlockWithDefaultVisualStyles,
  type BlockType,
  type BlockVisualStyles,
  type GridColumns,
  type GridGap,
  type WorksheetBlock,
} from '../../types/worksheet';
import { inputStyle } from './block-settings/shared';
import { FontFamilySelect } from './block-settings/FontFamilySelect';
import { ColorSwatchEditForm } from './block-settings/ColorSwatchEditForm';
import {
  getDesignSystems, saveDesignSystem,
  duplicateDesignSystem, deleteDesignSystem,
} from '../../utils/supabase/design-system-storage';
import { GridCanvas } from './GridCanvas';
import type { TypographyStyleId } from './TypoStyleSettingsForm';
import { TypoStyleSettings } from './TypoStyleSettingsForm';
import type { SeriesSlot } from '../../utils/design-system-layout-from-slots';
import { generateLayoutSvgFromSlots, worksheetBlocksFromLayoutSlots } from '../../utils/design-system-layout-from-slots';
import { BLOCK_VISUAL_STYLE_PRESETS } from './block-settings/VisualStylesSection';

function matchDefaultBlockPresetId(vs: BlockVisualStyles | undefined): string {
  if (!vs) return 'none';
  const { padding: _pad, ...rest } = vs;
  if (!rest.backgroundColor && !rest.borderColor && !rest.shadow) return 'none';
  for (const preset of BLOCK_VISUAL_STYLE_PRESETS) {
    if (preset.id === 'none') continue;
    const ps = preset.styles;
    if (
      rest.backgroundColor === ps.backgroundColor &&
      rest.borderColor === ps.borderColor &&
      rest.borderWidth === ps.borderWidth &&
      rest.borderStyle === ps.borderStyle &&
      rest.borderRadius === ps.borderRadius &&
      rest.shadow === ps.shadow
    ) {
      return preset.id;
    }
  }
  return 'custom';
}

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

export type { TypographyStyleId };

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

/** Horní záložky včetně knihovny systémů (v knize Laiout nebyl propojen mini-sidebar → kategorie se nedaly přepnout). */
const TOP_CATEGORY_TABS: { id: Category; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'system', label: 'Systémy', icon: Library },
  ...CATEGORIES,
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
                    <div
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        zIndex: 9999,
                        top: 'calc(100% + 8px)',
                        left: 0,
                        width: '240px',
                        backgroundColor: '#1c2128',
                        border: `1px solid ${C.border}`,
                        borderRadius: '12px',
                        padding: '14px',
                        boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
                      }}
                    >
                      <ColorSwatchEditForm
                        swatch={sw}
                        onSave={(p) => updateSwatch(group.id, sw.id, p)}
                        onClose={() => setEditId(null)}
                      />
                    </div>
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

function cssStackForBaseFamily(
  shortName: string,
  kind: 'heading' | 'body',
  pickList: { label: string; value: string }[],
): string {
  const hit = pickList.find((o) => extractFontFamilyName(o.value) === shortName);
  if (hit) return hit.value;
  const fallback = kind === 'heading' ? 'serif' : 'sans-serif';
  return `'${shortName}', ${fallback}`;
}

function fontSelectOptionsWithCurrent(
  pickList: { label: string; value: string }[],
  currentCssValue: string,
  orphanShortName: string,
) {
  const list = [...pickList];
  if (!list.some((o) => o.value === currentCssValue)) {
    list.unshift({ label: `${orphanShortName} (mimo katalog)`, value: currentCssValue });
  }
  return list;
}

function TypographyBaseFontsRow({
  typography,
  onChange,
}: {
  typography: DesignSystem['typography'];
  onChange: (v: DesignSystem['typography']) => void;
}) {
  const pickList = useMemo(() => buildDesignSystemFontPickList(typography), [typography]);
  const headingVal = cssStackForBaseFamily(typography.headingFont, 'heading', pickList);
  const bodyVal = cssStackForBaseFamily(typography.bodyFont, 'body', pickList);
  const headingOptions = useMemo(
    () => fontSelectOptionsWithCurrent(pickList, headingVal, typography.headingFont),
    [pickList, headingVal, typography.headingFont],
  );
  const bodyOptions = useMemo(
    () => fontSelectOptionsWithCurrent(pickList, bodyVal, typography.bodyFont),
    [pickList, bodyVal, typography.bodyFont],
  );

  return (
    <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.sidebarBorder}` }}>
      <p style={{ fontSize: '10px', color: C.muted, margin: '0 0 10px', lineHeight: 1.45 }}>
        Google fonty se v náhledu editoru nemusí shodovat s tiskem — načtou se až v PDF / tisku.
      </p>
      <div style={label11()}>Základní rodiny</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div>
          <div style={{ ...label11(), marginBottom: '4px' }}>Nadpisy</div>
          <FontFamilySelect
            value={headingVal}
            options={headingOptions}
            onChange={(v) => onChange({ ...typography, headingFont: extractFontFamilyName(v) })}
            triggerStyle={{ ...inputStyle, width: '100%', cursor: 'pointer' }}
          />
        </div>
        <div>
          <div style={{ ...label11(), marginBottom: '4px' }}>Tělo textu</div>
          <FontFamilySelect
            value={bodyVal}
            options={bodyOptions}
            onChange={(v) => onChange({ ...typography, bodyFont: extractFontFamilyName(v) })}
            triggerStyle={{ ...inputStyle, width: '100%', cursor: 'pointer' }}
          />
        </div>
      </div>
    </div>
  );
}

// ── TYPOGRAPHY canvas ─────────────────────────────────────────────────────────

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
  /** Z canvasu — přepne na Layout a otevře vlastní layout v editoru */
  focusCustomLayoutId?: string | null;
  onConsumedFocusCustomLayout?: () => void;
  /** Workbook: vlastní layout otevřít v Pro editoru (`/admin/worksheet-pro/`) místo zjednodušeného plátna vlevo */
  openLayoutInProEditor?: (customLayoutId: string, dsSnapshot?: DesignSystem | null) => void;
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

export function DesignSystemPanel({
  activeDesignSystem,
  onDesignSystemChange,
  onApplyToProject,
  activeCategory: activeCategoryProp,
  onCategoryChange,
  focusCustomLayoutId,
  onConsumedFocusCustomLayout,
  openLayoutInProEditor,
}: DesignSystemPanelProps) {
  const [allSystems, setAllSystems] = useState<DesignSystem[]>([]);
  const [draft, setDraft] = useState<DesignSystem | null>(activeDesignSystem);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [systemPickerOpen, setSystemPickerOpen] = useState(false);
  const systemPickerRef = useRef<HTMLDivElement>(null);
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
      setLayoutBlocks(worksheetBlocksFromLayoutSlots(LAYOUT_SERIES[activeLayoutKey]?.slots ?? [], draft.typography));
    }
    setLayoutSelectedId(null);
    setLayoutDirty(false);
    setLayoutShowSave(false);
  }, [activeLayoutKey, activeCustomLayoutId]);

  // Re-apply typography to preset blocks when typography changes
  useEffect(() => {
    if (activeCustomLayoutId || !draft || !activeLayoutKey) return;
    setLayoutBlocks(worksheetBlocksFromLayoutSlots(LAYOUT_SERIES[activeLayoutKey]?.slots ?? [], draft.typography));
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

  /** Stejné jako náhled na plátně DS (`buildSinglePagePreviewWorksheetFromBlocks`) — výchozí vizuální styly se promítnou do canvasu. */
  const layoutBlocksForCanvas = useMemo(() => {
    const defaults = draft?.blockPreferences.defaultVisualStyles;
    if (!defaults || Object.keys(defaults).length === 0) return layoutBlocks;
    return layoutBlocks.map((b) => mergeBlockWithDefaultVisualStyles(b, defaults));
  }, [layoutBlocks, draft?.blockPreferences.defaultVisualStyles]);

  /** Panel musí ukazovat sloučené styly, aby pole odpovídala tomu, co je na mřížce. */
  const selectedLayoutBlockForPanel = useMemo(() => {
    if (!layoutSelectedId || !draft) return null;
    const raw = layoutBlocks.find((b) => b.id === layoutSelectedId);
    if (!raw) return null;
    return mergeBlockWithDefaultVisualStyles(raw, draft.blockPreferences.defaultVisualStyles ?? undefined);
  }, [layoutSelectedId, layoutBlocks, draft?.blockPreferences.defaultVisualStyles]);

  useEffect(() => {
    getDesignSystems().then(sys => { setAllSystems(sys); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!systemPickerOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (systemPickerRef.current && !systemPickerRef.current.contains(e.target as Node)) {
        setSystemPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [systemPickerOpen]);

  useEffect(() => { setDraft(activeDesignSystem); setIsDirty(false); }, [activeDesignSystem]);

  useEffect(() => {
    if (!focusCustomLayoutId || !activeDesignSystem) return;
    // `draft` může o jeden tick zaostávat za prop — nový layout z plátna musí projít podle `activeDesignSystem`
    const exists = activeDesignSystem.blockPreferences.customLayouts?.some((l) => l.id === focusCustomLayoutId);
    if (!exists) {
      onConsumedFocusCustomLayout?.();
      return;
    }
    setActiveCustomLayoutId(focusCustomLayoutId);
    setActiveLayoutKey('');
    if (openLayoutInProEditor) {
      setLayoutEditingMode(false);
      openLayoutInProEditor(focusCustomLayoutId, activeDesignSystem);
    } else {
      setLayoutEditingMode(true);
    }
    setActiveCategory('layout');
    onConsumedFocusCustomLayout?.();
  }, [focusCustomLayoutId, activeDesignSystem, onConsumedFocusCustomLayout, openLayoutInProEditor]);

  const update = useCallback(<K extends keyof DesignSystem>(key: K, val: DesignSystem[K]) => {
    setDraft(prev => prev ? { ...prev, [key]: val } : null);
    setIsDirty(true);
  }, []);

  /** Uložení do knihovny + propagace do rodiče (kniha / canvas). */
  const persistDesignSystemToLibrary = useCallback(async (ds: DesignSystem): Promise<DesignSystem | null> => {
    setSaving(true);
    const saved = await saveDesignSystem({
      id: ds.id.startsWith('local-') ? undefined : ds.id,
      name: ds.name,
      description: ds.description,
      thumbnail_color: ds.thumbnail_color,
      colors: ds.colors,
      typography: ds.typography,
      pageDefaults: ds.pageDefaults,
      aiPrompts: ds.aiPrompts,
      blockPreferences: ds.blockPreferences,
      ...(ds.dataset != null ? { dataset: ds.dataset } : {}),
    });
    setSaving(false);
    if (saved) {
      setDraft(saved);
      setIsDirty(false);
      setAllSystems((prev) => {
        const i = prev.findIndex((s) => s.id === saved.id);
        return i >= 0 ? prev.map((s) => (s.id === saved.id ? saved : s)) : [saved, ...prev];
      });
      onDesignSystemChange(saved);
    }
    return saved;
  }, [onDesignSystemChange]);

  const layoutHandleSaveClick = useCallback(async () => {
    if (activeCustomLayoutId && draft) {
      const updated = (draft.blockPreferences.customLayouts ?? []).map((l) =>
        l.id === activeCustomLayoutId ? { ...l, blocks: layoutBlocks } : l,
      );
      const nextDs: DesignSystem = {
        ...draft,
        blockPreferences: { ...draft.blockPreferences, customLayouts: updated },
      };
      setDraft(nextDs);
      onDesignSystemChange(nextDs);
      setLayoutDirty(false);
      toast.success('Layout uložen');
      if (nextDs.id && !nextDs.id.startsWith('local-')) {
        const saved = await persistDesignSystemToLibrary(nextDs);
        if (!saved) toast.error('Chyba při ukládání');
      } else {
        setIsDirty(true);
      }
    } else {
      setLayoutSaveName(LAYOUT_SERIES[activeLayoutKey]?.label ?? 'Nový layout');
      setLayoutShowSave(true);
    }
  }, [
    activeCustomLayoutId,
    activeLayoutKey,
    layoutBlocks,
    draft,
    onDesignSystemChange,
    persistDesignSystemToLibrary,
  ]);

  const layoutConfirmSave = useCallback(async () => {
    const name = layoutSaveName.trim();
    if (!name || !draft) return;
    const newLayout: CustomLayout = { id: `cl-${Date.now()}`, name, blocks: layoutBlocks };
    const updated = [...(draft.blockPreferences.customLayouts ?? []), newLayout];
    const nextDs: DesignSystem = {
      ...draft,
      blockPreferences: { ...draft.blockPreferences, customLayouts: updated },
    };
    setDraft(nextDs);
    onDesignSystemChange(nextDs);
    setActiveCustomLayoutId(newLayout.id);
    setLayoutShowSave(false);
    setLayoutDirty(false);
    toast.success(`Layout „${name}“ uložen`);
    if (nextDs.id && !nextDs.id.startsWith('local-')) {
      const saved = await persistDesignSystemToLibrary(nextDs);
      if (!saved) toast.error('Chyba při ukládání');
    } else {
      setIsDirty(true);
    }
  }, [layoutSaveName, layoutBlocks, draft, onDesignSystemChange, persistDesignSystemToLibrary]);

  const handleNew = () => {
    const empty = createEmptyDesignSystem('Nový design systém');
    setDraft({ ...empty, id: `local-${Date.now()}`, teacher_id: '', created_at: '', updated_at: '' });
    setIsDirty(true);
    onDesignSystemChange(null);
  };

  const handleSave = async () => {
    if (!draft) return;
    const saved = await persistDesignSystemToLibrary(draft);
    if (saved) toast.success('Uloženo');
    else toast.error('Chyba při ukládání');
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
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: C.bg,
        minHeight: 0,
      }}
    >
      {/* Přepínání sekcí — nutné mimo Pro editor s mini-sidebar ikonami (např. editor knihy). */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 10px',
          borderBottom: `1px solid ${C.sidebarBorder}`,
          backgroundColor: '#161b22',
        }}
      >
        <div
          ref={systemPickerRef}
          style={{ position: 'relative', flexShrink: 1, minWidth: 0, maxWidth: 'min(300px, 46vw)' }}
        >
          <button
            type="button"
            onClick={() => setSystemPickerOpen((o) => !o)}
            aria-expanded={systemPickerOpen}
            aria-haspopup="listbox"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              minWidth: 0,
              padding: '5px 8px 5px 6px',
              borderRadius: '8px',
              border: `1px solid ${systemPickerOpen ? C.accent : C.border}`,
              backgroundColor: systemPickerOpen ? C.accentDim : '#21262d',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '10px', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
              Vybraný
            </span>
            {draft ? (
              <>
                <div
                  style={{
                    width: '11px',
                    height: '11px',
                    borderRadius: '3px',
                    backgroundColor: draft.thumbnail_color || C.accent,
                    flexShrink: 0,
                    border: `1px solid ${C.border}`,
                  }}
                />
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: C.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {loading ? 'Načítám…' : draft.name}
                </span>
                {saving && <Loader2 size={12} className="animate-spin" style={{ color: '#3B82F6', flexShrink: 0 }} />}
                {isDirty && !saving && (
                  <div
                    style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b', flexShrink: 0 }}
                    title="Neuložené změny"
                  />
                )}
              </>
            ) : (
              <span style={{ fontSize: '12px', color: C.muted, fontStyle: 'italic', flex: 1 }}>{loading ? 'Načítám…' : 'Vyberte nebo vytvořte'}</span>
            )}
            <ChevronDown
              size={14}
              style={{
                color: C.muted,
                flexShrink: 0,
                transform: systemPickerOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s',
              }}
            />
          </button>

          {systemPickerOpen && (
            <div
              role="listbox"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                width: 'min(320px, 92vw)',
                maxHeight: 'min(380px, 55vh)',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#1c2128',
                border: `1px solid ${C.border}`,
                borderRadius: '10px',
                boxShadow: '0 16px 48px rgba(0,0,0,0.75)',
                zIndex: 400,
                overflow: 'hidden',
              }}
            >
              <div style={{ flex: 1, overflowY: 'auto', padding: '6px', minHeight: 0 }}>
                {loading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', color: C.muted, fontSize: '12px' }}>
                    <Loader2 size={13} className="animate-spin" /> Načítám…
                  </div>
                )}
                {!loading && allSystems.length === 0 && (
                  <div style={{ padding: '14px 10px', textAlign: 'center', color: C.muted, fontSize: '12px', lineHeight: 1.5 }}>
                    Zatím žádný systém.
                  </div>
                )}
                {!loading &&
                  allSystems.map((ds) => {
                    const isSelected = ds.id === draft?.id;
                    const isApplied = ds.id === activeDesignSystem?.id;
                    return (
                      <button
                        key={ds.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setDraft(ds);
                          onDesignSystemChange(ds);
                          setIsDirty(false);
                          setSystemPickerOpen(false);
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '9px 10px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          border: `2px solid ${isSelected ? C.accent : 'transparent'}`,
                          backgroundColor: isSelected ? 'rgba(92,92,255,0.12)' : 'transparent',
                          textAlign: 'left',
                          marginBottom: '2px',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = '#262c36';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                        }}
                      >
                        <div
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            backgroundColor: ds.thumbnail_color || C.accent,
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isSelected ? C.text : '#cbd5e1',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {ds.name}
                          </div>
                          {isApplied && (
                            <div style={{ fontSize: '10px', color: '#22c55e', fontWeight: 600, marginTop: '2px' }}>✓ Aplikováno</div>
                          )}
                        </div>
                        {isSelected && <Check size={14} style={{ color: C.accent, flexShrink: 0 }} />}
                      </button>
                    );
                  })}
              </div>

              <div style={{ borderTop: `1px solid ${C.border}`, padding: '8px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    handleNew();
                    setSystemPickerOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: `1px dashed ${C.border}`,
                    backgroundColor: '#21262d',
                    color: C.text,
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={14} /> Přidat nový
                </button>
                {draft && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={async () => {
                        await handleDuplicate();
                        setSystemPickerOpen(false);
                      }}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: `1px solid ${C.border}`,
                        backgroundColor: 'transparent',
                        color: C.muted,
                        fontSize: '11px',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      <Copy size={12} /> Kopie
                    </button>
                    {draft && !draft.id.startsWith('local-') && (
                      <button
                        type="button"
                        onClick={async () => {
                          await handleDelete();
                          setSystemPickerOpen(false);
                        }}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: `1px solid ${C.border}`,
                          backgroundColor: 'transparent',
                          color: '#EF4444',
                          fontSize: '11px',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={12} /> Smazat
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ width: '1px', height: '22px', backgroundColor: C.border, flexShrink: 0 }} aria-hidden />

        <div
          role="tablist"
          aria-label="Sekce design systému"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', flex: 1, minWidth: 'min(100%, 200px)' }}
        >
          {TOP_CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveCategory(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${active ? C.accent : C.border}`,
                  backgroundColor: active ? C.accentDim : 'transparent',
                  color: active ? C.accent : C.muted,
                  fontSize: '11px',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={14} style={{ flexShrink: 0, opacity: active ? 1 : 0.85 }} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, backgroundColor: C.bg }}>

      {activeCategory !== 'system' && (
      <div style={{
        width: '300px', minWidth: '300px', flexShrink: 0,
        backgroundColor: '#1e293b', borderRight: '1px solid #334155',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Levý panel: typografie / layout (záložka Systémy = jen dropdown nahoře + hlavní plocha) */}
        {/* Minimal DS indicator */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #334155', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '7px' }}>
          {draft && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: draft.thumbnail_color || C.accent, flexShrink: 0 }} />}
          <span style={{ fontSize: '12px', color: draft ? '#E5E5E5' : '#64748b', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {loading ? 'Načítám…' : (draft?.name || 'Žádný design systém')}
          </span>
          {saving && <Loader2 size={12} className="animate-spin" style={{ color: '#3B82F6', flexShrink: 0 }} />}
          {isDirty && !saving && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b', flexShrink: 0 }} title="Neuloženo" />}
        </div>

        {/* Layout editing panel — full sidebar replacement */}
        {draft && activeCategory === 'layout' && layoutEditingMode && (() => {
          const layoutName = activeCustomLayoutId
            ? (draft.blockPreferences.customLayouts ?? []).find(l => l.id === activeCustomLayoutId)?.name ?? 'Vlastní layout'
            : LAYOUT_SERIES[activeLayoutKey]?.label ?? 'Layout';
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
                {selectedLayoutBlockForPanel && (
                  <div style={{ borderTop: '1px solid #334155', paddingTop: '4px' }}>
                    <ProBlockSettingsPanel
                      block={selectedLayoutBlockForPanel}
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
                      {draft && (
                        <TypographyBaseFontsRow
                          typography={draft.typography}
                          onChange={(v) => update('typography', v)}
                        />
                      )}
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

                      {/* Default block visual — kopíruje se do listu při „Aplikovat na projekt“ */}
                      <div style={{ marginBottom: '14px' }}>
                        <div style={label11()}>Výchozí vzhled bloku</div>
                        <div style={{ fontSize: '9px', color: C.muted, marginBottom: '8px', lineHeight: 1.4 }}>
                          Nové obsahové bloky (ne hlavička, rozložení, mezera). V editoru listu po aplikaci design systému.
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                          {BLOCK_VISUAL_STYLE_PRESETS.map((preset) => {
                            const activeId = matchDefaultBlockPresetId(draft.blockPreferences.defaultVisualStyles);
                            const isActive = activeId === preset.id;
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                title={preset.label}
                                onClick={() => {
                                  const curVs = draft.blockPreferences.defaultVisualStyles ?? {};
                                  const keepPad =
                                    typeof curVs.padding === 'number' && Number.isFinite(curVs.padding)
                                      ? Math.min(64, Math.max(0, Math.round(curVs.padding)))
                                      : 12;
                                  if (preset.id === 'none') {
                                    update('blockPreferences', {
                                      ...draft.blockPreferences,
                                      defaultVisualStyles: { padding: keepPad },
                                    });
                                  } else {
                                    update('blockPreferences', {
                                      ...draft.blockPreferences,
                                      defaultVisualStyles: {
                                        ...(preset.styles as BlockVisualStyles),
                                        padding: keepPad,
                                      },
                                    });
                                  }
                                }}
                                style={{
                                  padding: '6px 4px',
                                  borderRadius: '6px',
                                  border: `1px solid ${isActive ? C.accent : C.border}`,
                                  backgroundColor: isActive ? C.accentDim : 'transparent',
                                  cursor: 'pointer',
                                  fontSize: '9px',
                                  fontWeight: isActive ? 700 : 500,
                                  color: isActive ? C.accent : C.muted,
                                  textAlign: 'center',
                                  lineHeight: 1.2,
                                }}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                        {matchDefaultBlockPresetId(draft.blockPreferences.defaultVisualStyles) === 'custom' ? (
                          <div style={{ fontSize: '9px', color: C.yellow, marginTop: '6px' }}>
                            Vlastní vzhled zůstává z uložených dat — vyber preset pro přepsání.
                          </div>
                        ) : null}
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
                                onSelect={() => {
                                  setActiveCustomLayoutId(cl.id);
                                  setActiveLayoutKey('');
                                  if (openLayoutInProEditor) {
                                    setLayoutEditingMode(false);
                                    openLayoutInProEditor(cl.id, draft);
                                  } else {
                                    setLayoutEditingMode(true);
                                  }
                                }}
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
                                    const svgStr = generateLayoutSvgFromSlots(series.slots);
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
      )}

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
            blocks={layoutBlocksForCanvas}
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
        ) : activeCategory === 'system' ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px 24px',
              textAlign: 'center',
              minHeight: 0,
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '480px',
                marginBottom: '20px',
                padding: '14px 16px',
                borderRadius: '12px',
                border: `1px solid ${C.border}`,
                backgroundColor: C.card,
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    const i = document.createElement('input');
                    i.type = 'color';
                    i.value = draft.thumbnail_color || C.accent;
                    i.onchange = (e) => update('thumbnail_color', (e.target as HTMLInputElement).value);
                    i.click();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).click();
                    }
                  }}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: draft.thumbnail_color || C.accent,
                    cursor: 'pointer',
                    flexShrink: 0,
                    border: '1px solid #475569',
                  }}
                  title="Barva systému"
                />
                <input
                  value={draft.name}
                  onChange={(e) => update('name', e.target.value)}
                  style={{ ...inputStyle, flex: 1, fontWeight: 600, padding: '8px 12px', fontSize: '14px' }}
                  placeholder="Název systému"
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!isDirty || saving}
                  style={{
                    flex: 1,
                    minWidth: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    backgroundColor: isDirty ? '#3B82F6' : '#334155',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: isDirty && !saving ? 'pointer' : 'default',
                    color: isDirty ? 'white' : '#64748b',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {isDirty ? 'Uložit' : 'Uloženo'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onApplyToProject(draft);
                    toast.success('Aplikováno na projekt');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    backgroundColor: '#0c2a1a',
                    border: '1px solid #22c55e40',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: '#22c55e',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  <RefreshCw size={14} /> Aplikovat
                </button>
              </div>
            </div>

            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                backgroundColor: draft.thumbnail_color || C.accent,
                marginBottom: '16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
              }}
            />
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>{draft.name}</h2>
            <p style={{ fontSize: '13px', color: C.muted, maxWidth: '420px', lineHeight: 1.65, margin: '0 0 24px' }}>
              Vyberte záložku výše (Barvy, Typografie, Layout…) nebo dlaždici níže. Jiný systém zvolíte kliknutím na výběr &quot;Vybraný&quot; nahoře.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '10px',
                width: '100%',
                maxWidth: '520px',
              }}
            >
              {CATEGORIES.map((c) => {
                const Ico = c.icon;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveCategory(c.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '16px 12px',
                      borderRadius: '10px',
                      border: `1px solid ${C.border}`,
                      backgroundColor: C.card,
                      cursor: 'pointer',
                      color: C.text,
                    }}
                  >
                    <Ico size={22} style={{ color: C.accent }} />
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
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
    </div>
  );
}
