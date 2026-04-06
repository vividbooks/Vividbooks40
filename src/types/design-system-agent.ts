/**
 * Fáze 0 — hranice AI agenta pro generování / úpravu design systému.
 * Kanonický model zůstává `DesignSystem`; agent posílá jen `DesignSystemAgentPatch`.
 *
 * Později i **vision** (screenshot stránky): stejný patch typ — vstup jen přes obrázek
 * (Storage URL) v edge funkci, ne jiný JSON tvar.
 *
 * @see docs/design-system-ai-canvas-phase0.md
 */

import type {
  ColorGroup,
  ColorSwatch,
  DesignSystem,
  DesignSystemAIPrompts,
  DesignSystemBlockPreferences,
  DesignSystemPageDefaults,
  DesignSystemPageLayoutGroup,
  DesignSystemReferenceAssetBinding,
  DesignSystemTypography,
  DesignSystemVisualStyleNotes,
  LayoutSeriesGroup,
  ReferenceAssetInforms,
  TypoStyleOverride,
} from './design-system';
import { PAGE_LAYOUT_PREVIEW_KINDS, REFERENCE_ASSET_INFORMS } from './design-system';
import type { BlockType, BlockVisualStyles, GlobalFontSize, GridColumns, GridGap } from './worksheet';
import { createEmptyDesignSystem } from './design-system';
import type { SeriesSlot } from '../utils/design-system-layout-from-slots';
import { worksheetBlocksFromLayoutSlots } from '../utils/design-system-layout-from-slots';

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

const ALLOWED_BLOCK_TYPES = new Set<BlockType>([
  'heading',
  'paragraph',
  'infobox',
  'layout-section',
  'multiple-choice',
  'fill-blank',
  'free-answer',
  'spacer',
  'examples',
  'image',
  'table',
  'connect-pairs',
  'image-hotspots',
  'video-quiz',
  'qr-code',
  'header-footer',
  'free-canvas',
  'chart',
]);

const GRID_COLS: GridColumns[] = [1, 2, 3, 6, 12];
const GRID_GAPS: GridGap[] = ['none', 'small', 'medium', 'large'];
const BASE_SIZES: GlobalFontSize[] = ['small', 'normal', 'large'];

// ── Patch (povolené pole) ───────────────────────────────────────────────────

export type TypographyStylesPatch = {
  h1?: TypoStyleOverride;
  h2?: TypoStyleOverride;
  h3?: TypoStyleOverride;
  body?: TypoStyleOverride;
  caption?: TypoStyleOverride;
};

/**
 * Částečná typografie — `styles` se sloučí do existujícího objektu.
 */
export type TypographyPatch = {
  headingFont?: string;
  bodyFont?: string;
  baseFontSize?: GlobalFontSize;
  styles?: TypographyStylesPatch;
};

/**
 * Vše, co smí agent poslat v jednom kroku (kromě identity a časových razítek).
 */
export type DesignSystemAgentPatch = {
  name?: string;
  description?: string;
  thumbnail_color?: string;
  /** Celá paleta (agent typicky pošle kompletní nahrazení). */
  colors?: ColorGroup[];
  typography?: TypographyPatch;
  pageDefaults?: Partial<DesignSystemPageDefaults>;
  aiPrompts?: Partial<DesignSystemAIPrompts>;
  blockPreferences?: Pick<
    DesignSystemBlockPreferences,
    | 'preferred'
    | 'generationBlockTypes'
    | 'defaultVisualStyles'
    | 'visualStyleNotes'
    | 'referenceAssetBindings'
    | 'pageLayoutGroups'
  >;
  /**
   * Návrhy stránkových layoutů (3–8) — po merge se uloží jako `blockPreferences.customLayouts`
   * (při generování z briefu nahradí předchozí AI layouty).
   */
  suggestedLayouts?: SuggestedLayoutTemplate[];
};

/** Mezivýsledek sanitizace — neukládá se do DB jako kořenový klíč. */
export type SuggestedLayoutTemplate = {
  layoutGroup?: LayoutSeriesGroup;
  name: string;
  description?: string;
  slots: SeriesSlot[];
};

/** Kořenové klíče JSONu, které agent nikdy nesmí nastavovat. */
export const AGENT_FORBIDDEN_ROOT_KEYS = ['id', 'teacher_id', 'created_at', 'updated_at'] as const;

// ── Bezpečný merge do existujícího záznamu ───────────────────────────────────

function mergeTypography(base: DesignSystemTypography, patch: TypographyPatch): DesignSystemTypography {
  const styles: NonNullable<DesignSystemTypography['styles']> = { ...(base.styles ?? {}) };
  if (patch.styles) {
    for (const key of Object.keys(patch.styles) as (keyof TypographyStylesPatch)[]) {
      const p = patch.styles[key];
      if (p) styles[key] = { ...styles[key], ...p };
    }
  }
  const hasAnyStyle = Object.keys(styles).length > 0;
  return {
    ...base,
    ...(patch.headingFont !== undefined ? { headingFont: patch.headingFont } : {}),
    ...(patch.bodyFont !== undefined ? { bodyFont: patch.bodyFont } : {}),
    ...(patch.baseFontSize !== undefined ? { baseFontSize: patch.baseFontSize } : {}),
    ...(hasAnyStyle ? { styles } : {}),
  };
}

/**
 * Aplikuje patch na existující `DesignSystem` (např. po parsování odpovědi z LLM).
 * Nemění `id`, `teacher_id`, `created_at`, `updated_at`.
 */
export function applyDesignSystemAgentPatch(base: DesignSystem, patch: DesignSystemAgentPatch): DesignSystem {
  const next: DesignSystem = { ...base };

  if (patch.name !== undefined) next.name = patch.name;
  if (patch.description !== undefined) next.description = patch.description;
  if (patch.thumbnail_color !== undefined) next.thumbnail_color = patch.thumbnail_color;
  if (patch.colors !== undefined) next.colors = patch.colors;

  if (patch.typography !== undefined) {
    next.typography = mergeTypography(base.typography, patch.typography);
  }

  if (patch.pageDefaults !== undefined) {
    next.pageDefaults = { ...base.pageDefaults, ...patch.pageDefaults };
  }

  if (patch.aiPrompts !== undefined) {
    next.aiPrompts = { ...base.aiPrompts, ...patch.aiPrompts };
  }

  if (patch.blockPreferences !== undefined) {
    const bp: DesignSystemBlockPreferences = { ...base.blockPreferences };
    if (patch.blockPreferences.preferred !== undefined) {
      bp.preferred = patch.blockPreferences.preferred.filter((t): t is BlockType => typeof t === 'string');
    }
    if (patch.blockPreferences.generationBlockTypes !== undefined) {
      const g = patch.blockPreferences.generationBlockTypes.filter(
        (t): t is BlockType => typeof t === 'string' && ALLOWED_BLOCK_TYPES.has(t as BlockType),
      );
      if (g.length > 0) bp.generationBlockTypes = g;
    }
    if (patch.blockPreferences.defaultVisualStyles !== undefined) {
      const d = patch.blockPreferences.defaultVisualStyles;
      if (d && Object.keys(d).length > 0) {
        bp.defaultVisualStyles = { ...(bp.defaultVisualStyles ?? {}), ...d };
      }
    }
    if (patch.blockPreferences.visualStyleNotes !== undefined) {
      bp.visualStyleNotes = {
        ...(bp.visualStyleNotes ?? {}),
        ...patch.blockPreferences.visualStyleNotes,
      };
    }
    if (patch.blockPreferences.referenceAssetBindings !== undefined) {
      bp.referenceAssetBindings = patch.blockPreferences.referenceAssetBindings;
    }
    if (patch.blockPreferences.pageLayoutGroups !== undefined) {
      bp.pageLayoutGroups = patch.blockPreferences.pageLayoutGroups;
    }
    next.blockPreferences = bp;
  }

  return next;
}

/**
 * Odstraní z plain objektu zakázané klíče (ochrana při `JSON.parse` z modelu).
 */
export function stripForbiddenKeysFromAgentPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const o = { ...raw };
  for (const k of AGENT_FORBIDDEN_ROOT_KEYS) {
    delete o[k];
  }
  return o;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function sanitizeHex(s: unknown, fallback: string): string {
  if (typeof s !== 'string' || !HEX_RE.test(s)) return fallback;
  return s;
}

/** Modely často pošlou `hex` / `color` místo `value`, nebo RRGGBB bez `#`. */
function normalizeHexString(s: string): string | null {
  const t = s.trim();
  if (HEX_RE.test(t)) return t;
  if (/^[0-9A-Fa-f]{6}$/i.test(t)) return `#${t.toLowerCase()}`;
  if (/^[0-9A-Fa-f]{3}$/i.test(t)) {
    const a = t.toLowerCase().split('');
    return `#${a.map((c) => c + c).join('')}`;
  }
  return null;
}

function pickHexFromSwatchRecord(x: Record<string, unknown>): string | undefined {
  for (const key of ['value', 'hex', 'color', 'hexColor'] as const) {
    const v = x[key];
    if (typeof v !== 'string') continue;
    const n = normalizeHexString(v);
    if (n) return n;
  }
  return undefined;
}

function sanitizeColorSwatch(x: unknown): ColorSwatch | null {
  if (!isRecord(x)) return null;
  const id = typeof x.id === 'string' && x.id.trim() ? x.id.trim() : `sw-${Math.random().toString(36).slice(2, 9)}`;
  const name = typeof x.name === 'string' ? x.name : 'Barva';
  const picked = pickHexFromSwatchRecord(x);
  const value = picked ? sanitizeHex(picked, '#64748b') : sanitizeHex(x.value, '#64748b');
  return { id, name, value };
}

function sanitizeColorGroup(x: unknown): ColorGroup | null {
  if (!isRecord(x)) return null;
  const id = typeof x.id === 'string' && x.id.trim() ? x.id.trim() : `grp-${Math.random().toString(36).slice(2, 9)}`;
  const name = typeof x.name === 'string' ? x.name : 'Skupina';
  const rawSw = x.swatches;
  if (!Array.isArray(rawSw)) return null;
  const swatches = rawSw.map(sanitizeColorSwatch).filter((s): s is NonNullable<typeof s> => s !== null);
  if (swatches.length === 0) return null;
  return { id, name, swatches };
}

function sanitizeTypographyPatch(x: unknown): TypographyPatch | undefined {
  if (!isRecord(x)) return undefined;
  const out: TypographyPatch = {};
  if (typeof x.headingFont === 'string' && x.headingFont.trim()) out.headingFont = x.headingFont.trim();
  if (typeof x.bodyFont === 'string' && x.bodyFont.trim()) out.bodyFont = x.bodyFont.trim();
  if (typeof x.baseFontSize === 'string' && (BASE_SIZES as string[]).includes(x.baseFontSize)) {
    out.baseFontSize = x.baseFontSize as GlobalFontSize;
  }
  if (isRecord(x.styles)) {
    const styles: TypographyStylesPatch = {};
    for (const key of ['h1', 'h2', 'h3', 'body', 'caption'] as const) {
      const st = x.styles[key];
      if (isRecord(st)) {
        const o: TypoStyleOverride = {};
        if (typeof st.fontFamily === 'string') o.fontFamily = st.fontFamily;
        if (typeof st.fontSize === 'number' && Number.isFinite(st.fontSize)) o.fontSize = st.fontSize;
        if (typeof st.fontWeight === 'number') o.fontWeight = st.fontWeight;
        if (typeof st.lineHeight === 'number') o.lineHeight = st.lineHeight;
        if (typeof st.letterSpacing === 'number') o.letterSpacing = st.letterSpacing;
        if (st.textAlign === 'left' || st.textAlign === 'center' || st.textAlign === 'right') o.textAlign = st.textAlign;
        if (typeof st.textColor === 'string') o.textColor = sanitizeHex(st.textColor, '#1E293B');
        if (typeof st.isBold === 'boolean') o.isBold = st.isBold;
        if (typeof st.isItalic === 'boolean') o.isItalic = st.isItalic;
        if (typeof st.isUnderline === 'boolean') o.isUnderline = st.isUnderline;
        if (Object.keys(o).length) styles[key] = o;
      }
    }
    if (Object.keys(styles).length) out.styles = styles;
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizeDefaultVisualStyles(x: unknown): BlockVisualStyles | undefined {
  if (!isRecord(x)) return undefined;
  const out: BlockVisualStyles = {};
  const dp = x.displayPreset;
  if (dp === 'normal' || dp === 'infobox' || dp === 'highlight' || dp === 'custom') {
    out.displayPreset = dp;
  }
  if (typeof x.backgroundColor === 'string' && HEX_RE.test(x.backgroundColor.trim())) {
    out.backgroundColor = sanitizeHex(x.backgroundColor.trim(), '#FFFFFF');
  }
  if (typeof x.borderColor === 'string' && HEX_RE.test(x.borderColor.trim())) {
    out.borderColor = sanitizeHex(x.borderColor.trim(), '#374151');
  }
  if (typeof x.borderWidth === 'number' && Number.isFinite(x.borderWidth)) {
    const w = Math.round(x.borderWidth);
    if (w >= 0 && w <= 16) out.borderWidth = w;
  }
  if (x.borderStyle === 'solid' || x.borderStyle === 'dashed' || x.borderStyle === 'dotted') {
    out.borderStyle = x.borderStyle;
  }
  if (typeof x.borderRadius === 'number' && Number.isFinite(x.borderRadius)) {
    const r = Math.round(x.borderRadius);
    if (r >= 0 && r <= 64) out.borderRadius = r;
  }
  if (x.shadow === 'none' || x.shadow === 'small' || x.shadow === 'medium' || x.shadow === 'large') {
    out.shadow = x.shadow;
  }
  if (typeof x.padding === 'number' && Number.isFinite(x.padding)) {
    const p = Math.round(x.padding);
    if (p >= 0 && p <= 64) out.padding = p;
  }
  if (x.textColumns === 1 || x.textColumns === 2 || x.textColumns === 3) {
    out.textColumns = x.textColumns;
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizePageDefaults(x: unknown): Partial<DesignSystemPageDefaults> | undefined {
  if (!isRecord(x)) return undefined;
  const out: Partial<DesignSystemPageDefaults> = {};
  if (x.pageFormat === 'a4' || x.pageFormat === 'b5' || x.pageFormat === 'a5') out.pageFormat = x.pageFormat;
  if (typeof x.pageBackgroundColor === 'string') out.pageBackgroundColor = sanitizeHex(x.pageBackgroundColor, '#ffffff');
  if (typeof x.gridColumns === 'number' && (GRID_COLS as number[]).includes(x.gridColumns)) {
    out.gridColumns = x.gridColumns as GridColumns;
  }
  if (typeof x.gridColumns === 'string') {
    const n = parseInt(x.gridColumns, 10);
    if ((GRID_COLS as number[]).includes(n)) out.gridColumns = n as GridColumns;
  }
  if (typeof x.gridGap === 'string' && (GRID_GAPS as string[]).includes(x.gridGap)) {
    out.gridGap = x.gridGap as GridGap;
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizeLayoutSeriesGroup(x: unknown): LayoutSeriesGroup | undefined {
  if (x === 'column' || x === 'half' || x === 'twothirds') return x;
  return undefined;
}

const SLOT_TYPES = new Set(['heading', 'paragraph', 'image', 'infobox', 'gallery']);

type CanonicalSlotType = 'heading' | 'paragraph' | 'image' | 'infobox' | 'gallery';

/** Modely často pošlou synonymum místo kanonického typu — bez mapování se celý layout vyhodí. */
const SLOT_TYPE_ALIASES: Record<string, CanonicalSlotType> = {
  text: 'paragraph',
  body: 'paragraph',
  content: 'paragraph',
  prose: 'paragraph',
  copy: 'paragraph',
  p: 'paragraph',
  title: 'heading',
  subtitle: 'heading',
  headline: 'heading',
  heading_text: 'heading',
  photo: 'image',
  picture: 'image',
  figure: 'image',
  img: 'image',
  illustration: 'image',
  callout: 'infobox',
  note: 'infobox',
  tip: 'infobox',
  alert: 'infobox',
  box: 'infobox',
  images: 'gallery',
  carousel: 'gallery',
  grid: 'gallery',
};

function normalizeSeriesSlotType(raw: string): { type: string; levelFromType?: 'h1' | 'h2' | 'h3' } | null {
  const t = raw.trim().toLowerCase();
  if (t === 'h1' || t === 'h2' || t === 'h3') return { type: 'heading', levelFromType: t };
  const mapped = (SLOT_TYPE_ALIASES[t] ?? t) as string;
  if (!SLOT_TYPES.has(mapped)) return null;
  return { type: mapped };
}

function sanitizeSeriesSlot(x: unknown): SeriesSlot | null {
  if (!isRecord(x)) return null;
  const rawType = typeof x.type === 'string' ? x.type : '';
  if (!rawType.trim()) return null;
  const norm = normalizeSeriesSlotType(rawType);
  if (!norm) return null;
  const spanRaw = x.span;
  let span = 12;
  if (typeof spanRaw === 'number' && Number.isFinite(spanRaw)) {
    span = Math.min(12, Math.max(1, Math.round(spanRaw)));
  } else if (typeof spanRaw === 'string' && /^\d{1,2}$/.test(spanRaw.trim())) {
    span = Math.min(12, Math.max(1, parseInt(spanRaw.trim(), 10)));
  }
  const slot: SeriesSlot = { type: norm.type, span };
  const level =
    norm.levelFromType ??
    (typeof x.level === 'string' && ['h1', 'h2', 'h3'].includes(x.level) ? (x.level as 'h1' | 'h2' | 'h3') : undefined);
  if (level) slot.level = level;
  if (x.columns === 1 || x.columns === 2 || x.columns === 3) slot.columns = x.columns;
  if (typeof x.galleryColumns === 'number' && x.galleryColumns >= 1 && x.galleryColumns <= 6) {
    slot.galleryColumns = Math.round(x.galleryColumns);
  }
  if (typeof x.galleryCount === 'number' && x.galleryCount >= 1 && x.galleryCount <= 8) {
    slot.galleryCount = Math.round(x.galleryCount);
  }
  if (x.floatSide === 'left' || x.floatSide === 'right') slot.floatSide = x.floatSide;
  if (typeof x.floatSpanBlocks === 'number' && x.floatSpanBlocks >= 1 && x.floatSpanBlocks <= 6) {
    slot.floatSpanBlocks = Math.round(x.floatSpanBlocks);
  }
  if (typeof x.floatGridSpan === 'number' && x.floatGridSpan >= 1 && x.floatGridSpan <= 12) {
    slot.floatGridSpan = Math.round(x.floatGridSpan);
  }
  return slot;
}

function collectLayoutSlotsFromTemplate(x: Record<string, unknown>): unknown[] | null {
  if (Array.isArray(x.slots) && x.slots.length > 0) return x.slots;
  if (Array.isArray(x.layout) && x.layout.length > 0) return x.layout;
  if (Array.isArray(x.rowSlots) && x.rowSlots.length > 0) return x.rowSlots;
  if (Array.isArray(x.rows) && x.rows.length > 0) {
    const flat: unknown[] = [];
    for (const row of x.rows) {
      if (Array.isArray(row)) for (const cell of row) flat.push(cell);
      else flat.push(row);
    }
    return flat.length ? flat : null;
  }
  return null;
}

function sanitizeSuggestedLayoutTemplate(x: unknown): SuggestedLayoutTemplate | null {
  if (!isRecord(x)) return null;
  const name = typeof x.name === 'string' ? x.name.trim().slice(0, 200) : '';
  if (!name) return null;
  const rawSlots = collectLayoutSlotsFromTemplate(x);
  if (!rawSlots || rawSlots.length === 0) return null;
  const slots = rawSlots.map(sanitizeSeriesSlot).filter((s): s is SeriesSlot => s !== null);
  if (slots.length === 0) return null;
  const layoutGroup = sanitizeLayoutSeriesGroup(x.group ?? x.layoutGroup);
  const description = typeof x.description === 'string' ? x.description.trim().slice(0, 500) : undefined;
  return {
    layoutGroup,
    name,
    ...(description ? { description } : {}),
    slots,
  };
}

function sanitizeAiPrompts(x: unknown): Partial<DesignSystemAIPrompts> | undefined {
  if (!isRecord(x)) return undefined;
  const out: Partial<DesignSystemAIPrompts> = {};
  if (typeof x.imageStyle === 'string') out.imageStyle = x.imageStyle;
  if (typeof x.negativePrompt === 'string') out.negativePrompt = x.negativePrompt;
  if (typeof x.characterStyle === 'string') out.characterStyle = x.characterStyle;
  return Object.keys(out).length ? out : undefined;
}

const VISUAL_STYLE_NOTE_KEYS = [
  'pageBackground',
  'paragraphText',
  'contentBlocks',
  'embeddedImage',
  'padding',
] as const satisfies readonly (keyof DesignSystemVisualStyleNotes)[];

function sanitizeVisualStyleNotes(x: unknown): DesignSystemVisualStyleNotes | undefined {
  if (!isRecord(x)) return undefined;
  const out: DesignSystemVisualStyleNotes = {};
  for (const k of VISUAL_STYLE_NOTE_KEYS) {
    const v = x[k];
    if (typeof v === 'string') {
      const t = v.trim().slice(0, 4000);
      if (t) (out as Record<string, string>)[k] = t;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

const INFORMS_WHITELIST = new Set<string>(REFERENCE_ASSET_INFORMS);

function sanitizeReferenceAssetBindings(x: unknown): DesignSystemReferenceAssetBinding[] | undefined {
  if (!Array.isArray(x) || x.length === 0) return undefined;
  const out: DesignSystemReferenceAssetBinding[] = [];
  for (const item of x) {
    if (!isRecord(item)) continue;
    const idx = item.catalogIndex;
    if (typeof idx !== 'number' || !Number.isFinite(idx) || idx < 1 || idx > 64) continue;
    const rawInf = item.informs;
    if (!Array.isArray(rawInf) || rawInf.length === 0) continue;
    const informs: ReferenceAssetInforms[] = [];
    for (const inf of rawInf) {
      if (typeof inf === 'string' && INFORMS_WHITELIST.has(inf)) informs.push(inf as ReferenceAssetInforms);
    }
    if (informs.length === 0) continue;
    const rationale =
      typeof item.rationale === 'string' ? item.rationale.trim().slice(0, 800) : undefined;
    out.push({
      catalogIndex: Math.floor(idx),
      informs: [...new Set(informs)],
      ...(rationale ? { rationale } : {}),
    });
    if (out.length >= 32) break;
  }
  return out.length ? out : undefined;
}

const PREVIEW_KIND_WHITELIST = new Set<string>(PAGE_LAYOUT_PREVIEW_KINDS);

function sanitizePageLayoutPreviewKind(raw: unknown): DesignSystemPageLayoutGroup['previewKind'] | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim();
  return PREVIEW_KIND_WHITELIST.has(t) ? (t as DesignSystemPageLayoutGroup['previewKind']) : undefined;
}

function sanitizePageLayoutGroups(x: unknown): DesignSystemPageLayoutGroup[] | undefined {
  if (!Array.isArray(x) || x.length === 0) return undefined;
  const out: DesignSystemPageLayoutGroup[] = [];
  let nonce = 0;
  for (const item of x) {
    if (!isRecord(item)) continue;
    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 200) : '';
    const rulesRaw = Array.isArray(item.rules) ? item.rules : [];
    const rules = rulesRaw
      .filter((r): r is string => typeof r === 'string')
      .map((r) => r.trim().slice(0, 2000))
      .filter(Boolean);
    if (!title || rules.length === 0) continue;
    const id =
      typeof item.id === 'string' && item.id.trim()
        ? item.id.trim().slice(0, 80)
        : `plg-${Date.now()}-${nonce++}`;
    const src = Array.isArray(item.sourceCatalogIndices) ? item.sourceCatalogIndices : undefined;
    const sourceCatalogIndices =
      src && src.length > 0
        ? src
            .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 99)
            .map((n) => Math.floor(n))
            .slice(0, 8)
        : undefined;
    const previewKind = sanitizePageLayoutPreviewKind(item.previewKind);
    out.push({
      id,
      title,
      rules,
      ...(previewKind ? { previewKind } : {}),
      ...(sourceCatalogIndices && sourceCatalogIndices.length > 0 ? { sourceCatalogIndices } : {}),
    });
    if (out.length >= 8) break;
  }
  return out.length ? out : undefined;
}

/**
 * Vytažení JSON objektu z odpovědi modelu (kódový blok nebo surový `{...}`).
 */
export function extractJsonObjectFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1].trim() : trimmed;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('V odpovědi AI nebyl nalezen JSON objekt.');
  }
  return JSON.parse(raw.slice(start, end + 1));
}

/**
 * Převod parsovaného JSON na bezpečný patch (vyhození neznámých klíčů, validace polí).
 */
export function sanitizeDesignSystemAgentPatch(raw: unknown): DesignSystemAgentPatch {
  if (!isRecord(raw)) {
    throw new Error('AI nevrátila JSON objekt.');
  }
  const cleaned = stripForbiddenKeysFromAgentPayload(raw) as Record<string, unknown>;
  const patch: DesignSystemAgentPatch = {};

  if (typeof cleaned.name === 'string' && cleaned.name.trim()) patch.name = cleaned.name.trim().slice(0, 200);
  if (typeof cleaned.description === 'string') patch.description = cleaned.description.slice(0, 2000);
  if (typeof cleaned.thumbnail_color === 'string') patch.thumbnail_color = sanitizeHex(cleaned.thumbnail_color, '#5C5CFF');

  if (Array.isArray(cleaned.colors)) {
    const groups = cleaned.colors.map(sanitizeColorGroup).filter((g): g is ColorGroup => g !== null);
    if (groups.length) patch.colors = groups;
  }

  const typo = sanitizeTypographyPatch(cleaned.typography);
  if (typo) patch.typography = typo;

  const pd = sanitizePageDefaults(cleaned.pageDefaults);
  if (pd) patch.pageDefaults = pd;

  const ai = sanitizeAiPrompts(cleaned.aiPrompts);
  if (ai) patch.aiPrompts = ai;

  const bpSource = isRecord(cleaned.blockPreferences) ? cleaned.blockPreferences : {};
  const referenceBindingsRaw =
    bpSource.referenceAssetBindings ??
    (Array.isArray((cleaned as Record<string, unknown>).referenceAssetBindings)
      ? (cleaned as Record<string, unknown>).referenceAssetBindings
      : undefined);
  const visualNotesRaw =
    bpSource.visualStyleNotes ??
    (isRecord((cleaned as Record<string, unknown>).visualStyleNotes)
      ? (cleaned as Record<string, unknown>).visualStyleNotes
      : undefined);
  const pageLayoutGroupsRaw =
    bpSource.pageLayoutGroups ??
    (Array.isArray((cleaned as Record<string, unknown>).pageLayoutGroups)
      ? (cleaned as Record<string, unknown>).pageLayoutGroups
      : undefined);

  if (
    isRecord(cleaned.blockPreferences) ||
    referenceBindingsRaw !== undefined ||
    visualNotesRaw !== undefined ||
    pageLayoutGroupsRaw !== undefined
  ) {
    const bp: Pick<
      DesignSystemBlockPreferences,
      | 'preferred'
      | 'generationBlockTypes'
      | 'defaultVisualStyles'
      | 'visualStyleNotes'
      | 'referenceAssetBindings'
      | 'pageLayoutGroups'
    > = {};
    if (Array.isArray(bpSource.preferred)) {
      const preferred = bpSource.preferred.filter(
        (t): t is BlockType => typeof t === 'string' && ALLOWED_BLOCK_TYPES.has(t as BlockType),
      );
      if (preferred.length) bp.preferred = preferred;
    }
    if (Array.isArray(bpSource.generationBlockTypes)) {
      const g = bpSource.generationBlockTypes.filter(
        (t): t is BlockType => typeof t === 'string' && ALLOWED_BLOCK_TYPES.has(t as BlockType),
      );
      if (g.length) bp.generationBlockTypes = g;
    }
    const dvs = sanitizeDefaultVisualStyles(bpSource.defaultVisualStyles);
    if (dvs) bp.defaultVisualStyles = dvs;
    const vsn = sanitizeVisualStyleNotes(visualNotesRaw);
    if (vsn) bp.visualStyleNotes = vsn;
    const rab = sanitizeReferenceAssetBindings(referenceBindingsRaw);
    if (rab) bp.referenceAssetBindings = rab;
    const plg = sanitizePageLayoutGroups(pageLayoutGroupsRaw);
    if (plg) bp.pageLayoutGroups = plg;
    if (
      bp.preferred !== undefined ||
      bp.generationBlockTypes !== undefined ||
      bp.defaultVisualStyles !== undefined ||
      bp.visualStyleNotes !== undefined ||
      bp.referenceAssetBindings !== undefined ||
      bp.pageLayoutGroups !== undefined
    ) {
      patch.blockPreferences = bp;
    }
  }

  const rawSuggestedLayouts = Array.isArray(cleaned.suggestedLayouts)
    ? cleaned.suggestedLayouts
    : Array.isArray(cleaned.layoutTemplates)
      ? cleaned.layoutTemplates
      : Array.isArray(cleaned.suggestedPageLayouts)
        ? cleaned.suggestedPageLayouts
        : null;
  if (rawSuggestedLayouts) {
    const sl = rawSuggestedLayouts
      .map(sanitizeSuggestedLayoutTemplate)
      .filter((t): t is SuggestedLayoutTemplate => t !== null);
    if (rawSuggestedLayouts.length > 0 && sl.length === 0) {
      console.warn(
        '[design-system-agent] suggestedLayouts: AI poslalo šablony, ale žádná neprošla validací slotů (typy musí být heading|paragraph|image|infobox|gallery nebo běžná synonyma).',
      );
    }
    if (sl.length) patch.suggestedLayouts = sl.slice(0, 8);
  }

  const hasSomething =
    patch.name ||
    patch.description ||
    patch.thumbnail_color ||
    patch.colors?.length ||
    patch.typography ||
    patch.pageDefaults ||
    patch.aiPrompts ||
    patch.blockPreferences?.preferred?.length ||
    patch.blockPreferences?.generationBlockTypes?.length ||
    (patch.blockPreferences?.defaultVisualStyles &&
      Object.keys(patch.blockPreferences.defaultVisualStyles).length > 0) ||
    (patch.blockPreferences?.visualStyleNotes &&
      Object.keys(patch.blockPreferences.visualStyleNotes).length > 0) ||
    (patch.blockPreferences?.referenceAssetBindings &&
      patch.blockPreferences.referenceAssetBindings.length > 0) ||
    (patch.blockPreferences?.pageLayoutGroups && patch.blockPreferences.pageLayoutGroups.length > 0) ||
    patch.suggestedLayouts?.length;

  if (!hasSomething) {
    throw new Error('AI vrátila prázdný nebo neplatný patch — zkus upřesnit zadání.');
  }

  return patch;
}

/** Sloučení s výchozím systémem pro nový záznam (bez DB id). */
export function buildDesignSystemForSave(
  patch: DesignSystemAgentPatch,
  existing: DesignSystem | null,
  options?: { preMergedDesignSystem?: DesignSystem },
): Omit<DesignSystem, 'id' | 'teacher_id' | 'created_at' | 'updated_at'> & { id?: string } {
  const base: DesignSystem = existing ?? {
    ...createEmptyDesignSystem(patch.name || 'Design systém'),
    id: '__new__',
    teacher_id: '__pending__',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const merged = options?.preMergedDesignSystem ?? applyDesignSystemAgentPatch(base, patch);
  let withLayouts = merged;
  if (patch.suggestedLayouts && patch.suggestedLayouts.length > 0) {
    const ts = Date.now();
    const customs = patch.suggestedLayouts.map((t, i) => ({
      id: `ai-layout-${ts}-${i}`,
      name: t.name,
      ...(t.description ? { description: t.description } : {}),
      ...(t.layoutGroup ? { layoutGroup: t.layoutGroup } : {}),
      blocks: worksheetBlocksFromLayoutSlots(t.slots, merged.typography) as any[],
    }));
    withLayouts = {
      ...merged,
      blockPreferences: {
        ...merged.blockPreferences,
        customLayouts: customs,
      },
    };
  }
  const { id, teacher_id, created_at, updated_at, ...rest } = withLayouts;
  return existing?.id ? { ...rest, id: existing.id } : { ...rest };
}
