/**
 * Design systém 2 — nekonečné plátno + vstupní chat (MVP před napojením AI).
 * Klasický editor zůstává pod samostatnou ikonou, dokud nebude tento tok odladěný.
 *
 * Karty na plátně se zobrazí, jakmile je aktivní design systém (včetně načteného z uložené knihy).
 */

import { useState, useMemo, useCallback, useRef, useEffect, memo, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowUp,
  Plus,
  ImagePlus,
  Loader2,
  X,
  PenLine,
  ChevronDown,
  Check,
  RefreshCw,
  Palette,
  Save,
  Star,
  Trash2,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type CustomLayout,
  type DatasetFile,
  type DatasetIllustrationStyle,
  type IllustrationStyleProposal,
  type DesignSystem,
  type DesignSystemDataset,
  type DesignSystemAIPrompts,
  type DesignSystemVisualStyleNotes,
  type DesignSystemPageLayoutGroup,
  type DesignSystemPageLayoutPreviewKind,
  DEFAULT_GENERATION_BLOCK_TYPES_BOOK,
  DEFAULT_GENERATION_BLOCK_TYPES_WORKSHEET,
  GENERATION_BLOCK_TYPE_OPTIONS,
  type LayoutSeriesGroup,
  resolveGenerationBlockTypes,
  type TypoStyleOverride,
  buildDesignSystemFontPickList,
  extractFontFamilyName,
  type ColorSwatch,
} from '../../types/design-system';
import type { BlockType, BlockVisualStyles, GridColumns, GridGap, Worksheet, WorksheetBlock } from '../../types/worksheet';
import { BLOCK_VISUAL_STYLE_PRESETS } from '../worksheet-editor-pro/block-settings/VisualStylesSection';
import {
  ensurePageLayoutGroupCustomLayout,
  layoutPreviewSvgFromBlocks,
  pageLayoutGroupCustomLayoutId,
} from '../../utils/design-system-layout-from-slots';
import {
  generateAndSaveDesignSystemFromBrief,
  DESIGN_SYSTEM_BRIEF_MIN_CHARS,
} from '../../utils/ai/design-system-from-brief';
import type { DesignSystemPipelineEvent } from '../../utils/ai/design-system-pipeline-types';
import { getDesignSystems, saveDesignSystem } from '../../utils/supabase/design-system-storage';
import {
  getTeacherIllustrationReferenceLibrary,
  saveTeacherIllustrationReferenceLibrary,
} from '../../utils/supabase/teacher-illustration-reference-library';
import { processImageUrl } from '../../utils/supabase/upload-image';
import {
  appendIllustrationCropsFromLayoutPageUrl,
  enrichUploadedDesignSystemReference,
  DESIGN_SYSTEM_MAX_REFERENCE_IMAGES,
  REF_NOTE_ILLUSTRATION_CROP,
} from '../../utils/ai/design-system-reference-upload-analyze';
import { assignIllustrationStylesFromDatasetImages } from '../../utils/ai/design-system-auto-illustration-styles';
import { generateImageWithImagen } from '../../utils/ai-chat-proxy';
import {
  PRESET_ILLUSTRATION_STYLES,
  presetStyleDatasetId,
  type PresetIllustrationStyleDefinition,
} from '../../data/preset-illustration-styles';
import {
  recommendPresetIllustrationStylesFromPrompt,
  type PresetStyleRecommendation,
} from '../../utils/ai/recommend-preset-illustration-style-from-prompt';
import { IllustrationStyleThumb, PresetIllustrationStylesPicker } from './PresetIllustrationStylesPicker';
import { DesignSystemAgentLogPanel } from './DesignSystemAgentLogPanel';
import { InfiniteCanvas } from './InfiniteCanvas';
import { WorkbookLiveFlowPreview } from './WorkbookLiveFlowPreview';
import { WorkbookLivePagePreview } from './WorkbookLivePagePreview';
import { TypoStyleSettings, type TypographyStyleId } from '../worksheet-editor-pro/TypoStyleSettingsForm';
import { DesignSystemBlockVisualStyleFields } from '../worksheet-editor-pro/block-settings/DesignSystemBlockVisualStyleFields';
import { FontFamilySelect } from '../worksheet-editor-pro/block-settings/FontFamilySelect';
import { ColorSwatchEditForm } from '../worksheet-editor-pro/block-settings/ColorSwatchEditForm';
import {
  buildDesignSystemFlowPreviewWorksheet,
  buildSinglePagePreviewWorksheetFromBlocks,
} from '../../utils/design-system-preview-worksheets';
import { buildStashedWorksheetEditorUrl } from '../../utils/worksheet-editor-runtime';
import { PAGE_DIMENSIONS, type PageFormat } from '../../utils/page-layout';
import {
  resolveBlockVisualStylePresets,
  syncBlockPreferencesDefaultVisualWithPresets,
  newBlockVisualPresetId,
  defaultBlockVisualPresetIdForLegacy,
} from '../../utils/design-system-block-visual-presets';

/** Nový DS — jeden composer uprostřed plátna (chat / prompt styl). */
const ONBOARDING_CENTER_STACK: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 200,
  width: 'min(680px, calc(100vw - 32px))',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
};

const ONBOARDING_COMPOSER_BOX: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 12,
  overflow: 'hidden',
  boxShadow: '0 0 0 1px rgba(51, 65, 85, 0.55), 0 24px 56px rgba(0, 0, 0, 0.5)',
  backgroundColor: '#1e293b',
};

const CARD: CSSProperties = {
  position: 'absolute',
  width: 280,
  padding: 16,
  borderRadius: 16,
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 24px rgba(15, 23, 42, 0.07)',
};

/** Karta „Zadání“ — tmavý panel (ostatní karty na plátně zůstávají světlé). */
const CARD_ZADANI: CSSProperties = {
  ...CARD,
  backgroundColor: 'rgba(30, 41, 59, 0.95)',
  border: '1px solid rgba(71, 85, 105, 0.9)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
};

/** Šířka karty AI styl (2× původních 300 px). */
const CANVAS_AI_STYL_CARD_W = 600;

const CARD_WIDE: CSSProperties = {
  ...CARD,
  width: CANVAS_AI_STYL_CARD_W,
};

/** Sloupec „Skupiny layoutů / Typografie / …“ — širší kvůli živým náhledům stránek */
const CANVAS_TYPO_COLUMN_W = 440;
/** Vnitřní box náhledu stránky — téměř šířka sloupce, aby text v živém náhledu nebyl oříznutý z boků. */
const PAGE_LAYOUT_GROUP_LIVE_PREVIEW_W = Math.round((CANVAS_TYPO_COLUMN_W - 52) * 0.92);
/** Horní část stránky v náhledu — menší = ostřejší ořez zespodu. */
const PAGE_LAYOUT_GROUP_PAGE_TOP_FRACTION = 0.32;
/** 1 = šířka náhledu přesně „na šířku“ stránky; vyšší hodnota zbytečně ořezává obsah z boků. */
const PAGE_LAYOUT_GROUP_CLIP_ZOOM = 1;

/** Zmenšení náhledů v kartě „Layouty“ (primární + sekundární). */
const LAYOUT_PREVIEW_COMPACT_ZOOM = 0.5;

/** Karta typografie — širší kvůli přehledu stylů h1–caption (stejný „papír“ jako CARD) */
const CARD_TYPO: CSSProperties = {
  ...CARD,
  width: CANVAS_TYPO_COLUMN_W,
};

/** Karta „Layouty“ — o 40 % užší než předchozí (~398 px), tj. 0,6 × 0,7 × 568. */
const CARD_PAGE_AND_LAYOUTS_W = Math.round(568 * 0.7 * 0.6);

/** Výchozí stránka + skupiny layoutů v jedné kartě */
const CARD_PAGE_AND_LAYOUTS: CSSProperties = {
  ...CARD,
  width: CARD_PAGE_AND_LAYOUTS_W,
};

const CARD_PAGE_PREVIEWS: CSSProperties = {
  ...CARD,
  width: 300,
};

/** Typy bloků pro publikaci — pod kartou referenčních ilustrací (stejný sloupec jako AI STYL) */
const CARD_GENERATION_BLOCKS: CSSProperties = {
  ...CARD,
  width: CANVAS_AI_STYL_CARD_W,
};

/** Horizontální rozvržení karet na plátně: Zadání → sloupec (aktivní systém + paleta, typografie) → reference → … */
const CANVAS_COL_GAP = 40;
/** Vertikální mezera mezi kartami ve sloupci (typografie / reference). */
const CANVAS_STACK_GAP = 20;
const CANVAS_ZADANI_LEFT = 80;
/** Za „Zadáním“ — sloupec typografie; nahoře karta aktivní systém + paleta (dříve samostatný sloupec). */
const CANVAS_TYPO_LEFT = CANVAS_ZADANI_LEFT + 280 + CANVAS_COL_GAP;
/** Za sloupcem typografie — stejná mezera jako mezi ostatními bloky */
const CANVAS_REF_IMAGES_COL_LEFT = CANVAS_TYPO_LEFT + CANVAS_TYPO_COLUMN_W + CANVAS_COL_GAP;
const CANVAS_PAGE_LAYOUTS_LEFT = CANVAS_REF_IMAGES_COL_LEFT + CANVAS_AI_STYL_CARD_W + CANVAS_COL_GAP;
const CANVAS_PAGE_PREVIEWS_LEFT = CANVAS_PAGE_LAYOUTS_LEFT + CARD_PAGE_AND_LAYOUTS_W + CANVAS_COL_GAP;

/** Vertikální pozice řádku karet (pod velkým nadpisem „Design systém: …“ na plátně). */
const CANVAS_BLOCKS_TOP = 220;
const CANVAS_REF_IMAGES_CARD_TOP = CANVAS_BLOCKS_TOP;
/** Dříve pevná výška karty referencí — ponecháno jen pro případné budoucí výpočty */
const CANVAS_REF_IMAGES_MAX_H = 580;

const GEN_BLOCK_CATEGORY_ORDER = ['content', 'layout', 'activities', 'other'] as const;
const GEN_BLOCK_CATEGORY_LABEL: Record<(typeof GEN_BLOCK_CATEGORY_ORDER)[number], string> = {
  content: 'Obsah',
  layout: 'Rozvržení stránky',
  activities: 'Aktivity a úlohy',
  other: 'Ostatní',
};

const LAYOUT_BUCKET_ORDER: (LayoutSeriesGroup | 'other')[] = ['column', 'half', 'twothirds', 'other'];
const LAYOUT_BUCKET_LABELS: Record<LayoutSeriesGroup | 'other', string> = {
  column: 'Jeden sloupec',
  half: 'Polovina · ½ + ½',
  twothirds: 'Dvě třetiny · ⅔ + ⅓',
  other: 'Další rozložení',
};

type TypoLevelId = 'h1' | 'h2' | 'h3' | 'body' | 'caption';

/** Pole karty „Vizuální styl“ — ukládá se do `blockPreferences.visualStyleNotes`. */
const VISUAL_STYLE_NOTE_FIELDS: {
  key: keyof DesignSystemVisualStyleNotes;
  label: string;
  placeholder: string;
}[] = [
  {
    key: 'pageBackground',
    label: 'Barva pozadí',
    placeholder: 'Např. hex, teplý/studený odstín, jemná textura papíru…',
  },
  {
    key: 'paragraphText',
    label: 'Odstavec textu',
    placeholder: 'Barva, řádkování, zarovnání, první řádek, max. šířka řádku…',
  },
  {
    key: 'contentBlocks',
    label: 'Infobox a další bloky',
    placeholder: 'Vzhled infoboxu, tabulky, odrážek — rámeček, stín, výplň, zaoblení…',
  },
  {
    key: 'embeddedImage',
    label: 'Vložený obrázek',
    placeholder: 'Kulaté vs. ostré rohy, odsazení, popisek (styl, pozice, font)…',
  },
  {
    key: 'padding',
    label: 'Padding',
    placeholder: 'Odsazení stránky, bloků od okrajů, mezery mezi bloky…',
  },
];

const PAGE_BG_SWATCHES = [
  '#ffffff',
  '#F8FAFC',
  '#F1F5F9',
  '#E2E8F0',
  '#FFFBEB',
  '#FEF3C7',
  '#F0FDF4',
  '#EFF6FF',
  '#FAF5FF',
  '#FDF2F8',
];

const GRID_GAP_LABEL_CS: Record<GridGap, string> = {
  none: 'bez mezery',
  small: 'malá',
  medium: 'střední',
  large: 'velká',
};

function matchDsDefaultBlockPresetId(vs: BlockVisualStyles | undefined): string {
  if (!vs) return 'none';
  const { padding: _pad, textColumns: _tc, ...rest } = vs;
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

function blockShadowCss(shadow?: BlockVisualStyles['shadow']): string {
  if (!shadow || shadow === 'none') return 'none';
  if (shadow === 'small') return '0 1px 3px rgba(0,0,0,0.18)';
  if (shadow === 'medium') return '0 4px 14px rgba(0,0,0,0.22)';
  return '0 10px 28px rgba(0,0,0,0.28)';
}

const TYPO_LEVELS: { id: TypoLevelId; label: string; sample: string; defaultPx: number; useBodyFont: boolean }[] = [
  { id: 'h1', label: 'Nadpis 1', sample: 'Hravá kapitola o přírodě', defaultPx: 24, useBodyFont: false },
  { id: 'h2', label: 'Nadpis 2', sample: 'Co uvidíš v této části', defaultPx: 18, useBodyFont: false },
  { id: 'h3', label: 'Nadpis 3', sample: 'Krátký podnadpis', defaultPx: 15, useBodyFont: false },
  {
    id: 'body',
    label: 'Odstavec',
    sample:
      'Text učebnice pro žáky je čitelný a klidný. Druhá věta ukazuje zalamování na více řádcích a skutečné řádkování při delším výkladu. Třetí věta dokresluje typickou hustotu odstavce na stránce učebnice.',
    defaultPx: 13,
    useBodyFont: true,
  },
  { id: 'caption', label: 'Popisek', sample: 'Obr. 3 — detail listu', defaultPx: 11, useBodyFont: true },
];

function typoPreviewStyle(
  headingFont: string,
  bodyFont: string,
  level: (typeof TYPO_LEVELS)[number],
  st?: TypoStyleOverride,
): CSSProperties {
  const baseFam = level.useBodyFont ? bodyFont : headingFont;
  const fam = st?.fontFamily?.trim() || baseFam;
  let weight = st?.fontWeight;
  if (weight === undefined && st?.isBold) weight = 700;
  if (weight === undefined) weight = level.id.startsWith('h') ? 600 : 400;
  return {
    fontFamily: `'${fam}', sans-serif`,
    fontSize: st?.fontSize != null ? `${st.fontSize}px` : `${level.defaultPx}px`,
    fontWeight: weight,
    color: st?.textColor ?? (level.id === 'caption' ? '#94a3b8' : '#f1f5f9'),
    lineHeight: st?.lineHeight ?? (level.id === 'body' ? 1.5 : 1.25),
    letterSpacing: st?.letterSpacing != null ? `${st.letterSpacing}em` : undefined,
    fontStyle: st?.isItalic ? 'italic' : undefined,
    textDecoration: st?.isUnderline ? 'underline' : undefined,
    textAlign: st?.textAlign,
  };
}

function typoMetaLine(st: TypoStyleOverride | undefined): string | null {
  if (!st || Object.keys(st).length === 0) return null;
  const parts: string[] = [];
  if (st.fontSize != null) parts.push(`${st.fontSize} px`);
  if (st.fontWeight != null) parts.push(`řez ${st.fontWeight}`);
  else if (st.isBold) parts.push('tučné');
  if (st.textColor) parts.push(st.textColor);
  if (st.fontFamily) parts.push(st.fontFamily);
  if (st.lineHeight != null) parts.push(`řádkování ${st.lineHeight}`);
  if (st.letterSpacing != null) parts.push(`mez.písm. ${st.letterSpacing} em`);
  if (st.textAlign) parts.push(st.textAlign);
  if (st.isItalic) parts.push('kurzíva');
  if (st.isUnderline) parts.push('podtržení');
  return parts.length ? parts.join(' · ') : null;
}

/** Ukázkový text pro velký náhled výchozího stylu bloku na plátně design systému. */
const DEFAULT_BLOCK_STYLE_PREVIEW_TEXT =
  'Text uvnitř širokého bloku s odsazením od okrajů. Pokračování odstavce ukazuje delší výklad vedle menší figury — několik řádků, aby byl náhled výš a lépe odpovídal reálné stránce.';

function defaultBlockChromePaddingPx(dvs: BlockVisualStyles): number {
  const p = dvs.padding;
  if (typeof p === 'number' && Number.isFinite(p) && p >= 0) return Math.min(64, Math.round(p));
  return 12;
}

/** Náhled jako na stránce — bílé pozadí, bez šedého rámu kolem (jen tokeny bloku). */
function renderBlockVisualStackCardPreview(ds: DesignSystem, dvs: BlockVisualStyles): ReactNode {
  const bodySt = ds.typography.styles?.body;
  const hf = ds.typography.headingFont;
  const bf = ds.typography.bodyFont;
  const bodyLevel = TYPO_LEVELS.find((l) => l.id === 'body')!;
  const bodyPreview = typoPreviewStyle(hf, bf, bodyLevel, bodySt);
  const pad = defaultBlockChromePaddingPx(dvs);
  const hasBg = !!(dvs.backgroundColor && dvs.backgroundColor !== 'transparent');
  const hasBorder = !!(dvs.borderColor && dvs.borderColor !== 'transparent');
  const tc = dvs.textColumns ?? 1;
  const textEl = (
    <div
      style={{
        ...bodyPreview,
        fontSize: 10,
        lineHeight: 1.45,
        color: bodySt?.textColor ?? '#334155',
        ...(tc > 1 ? { columnCount: tc, columnGap: '10px' } : {}),
      }}
    >
      {DEFAULT_BLOCK_STYLE_PREVIEW_TEXT}
    </div>
  );
  return (
    <div style={{ padding: 6, backgroundColor: '#ffffff', borderRadius: 8, border: 'none' }}>
      <div
        style={{
          borderRadius: dvs.borderRadius ?? 10,
          padding: pad,
          backgroundColor: hasBg ? dvs.backgroundColor : '#ffffff',
          border: hasBorder
            ? `${dvs.borderWidth ?? 2}px ${dvs.borderStyle ?? 'solid'} ${dvs.borderColor}`
            : undefined,
          boxShadow: blockShadowCss(dvs.shadow),
        }}
      >
        {textEl}
      </div>
    </div>
  );
}

function clipText(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Po změně globálního primárního / sekundárního fontu odstraní vlastní `fontFamily` u příslušných úrovní, ať dědí nový základ. */
function stripFontFamilyFromStyleLevels(
  styles: DesignSystem['typography']['styles'],
  levelIds: readonly TypographyStyleId[],
): DesignSystem['typography']['styles'] {
  if (!styles) return undefined;
  const next: NonNullable<DesignSystem['typography']['styles']> = { ...styles };
  for (const id of levelIds) {
    const s = next[id];
    if (!s?.fontFamily) continue;
    const { fontFamily: _f, ...rest } = s;
    if (Object.keys(rest).length === 0) delete next[id];
    else next[id] = rest;
  }
  return Object.keys(next).length ? next : undefined;
}

/** Texty z uloženého vlastního layoutu — přepíšou ukázku, vizuální styl zůstává z tokenů DS. */
type PageLayoutDraftOverride = {
  heading?: string;
  body?: string;
  bodyCol?: string;
  bodyCol2?: string;
  caption?: string;
};

function stripHtmlToPlainPreview(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractTwoColumnPlain(html: string): [string, string] {
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  const parts: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && parts.length < 2) {
    parts.push(clipText(stripHtmlToPlainPreview(m[1]), 400));
  }
  if (parts.length >= 2) return [parts[0], parts[1]];
  const plain = clipText(stripHtmlToPlainPreview(html), 520);
  const mid = Math.floor(plain.length / 2) || plain.length;
  return [plain.slice(0, mid), plain.slice(mid)];
}

function extractPageLayoutDraftFromBlocks(
  kind: DesignSystemPageLayoutPreviewKind,
  blocks: any[],
): PageLayoutDraftOverride | null {
  if (!blocks?.length) return null;
  const headings = blocks.filter((b) => b.type === 'heading');
  const paras = blocks.filter((b) => b.type === 'paragraph');
  const images = blocks.filter((b) => b.type === 'image');
  const h = (i: number) =>
    headings[i]?.content?.text != null ? String(headings[i].content.text) : undefined;
  const pHtml = (i: number) => paras[i]?.content?.html;
  const imgCap = (i: number) =>
    images[i]?.content?.caption != null ? String(images[i].content.caption) : undefined;

  switch (kind) {
    case 'heading_row_infobox_image':
      return {
        heading: h(0),
        body: pHtml(0) ? clipText(stripHtmlToPlainPreview(String(pHtml(0))), 800) : undefined,
        caption: imgCap(0),
      };
    case 'wide_infobox_with_figure':
      return {
        heading: h(0),
        body: pHtml(0) ? clipText(stripHtmlToPlainPreview(String(pHtml(0))), 800) : undefined,
      };
    case 'heading_body_full_width':
      return {
        heading: h(0),
        body: pHtml(0) ? clipText(stripHtmlToPlainPreview(String(pHtml(0))), 800) : undefined,
      };
    case 'full_width_text':
      return {
        body: pHtml(0) ? clipText(stripHtmlToPlainPreview(String(pHtml(0))), 800) : undefined,
      };
    case 'full_width_image':
      return { caption: imgCap(0) };
    case 'two_column_text': {
      const html = pHtml(0) ? String(pHtml(0)) : '';
      const [a, b] = extractTwoColumnPlain(html);
      return { bodyCol: a || undefined, bodyCol2: b || undefined };
    }
    case 'vertical_stack':
      return {
        heading: h(0),
        caption: imgCap(0),
        body: pHtml(0) ? clipText(stripHtmlToPlainPreview(String(pHtml(0))), 800) : undefined,
      };
    default:
      return null;
  }
}

/**
 * Náhled karty skupiny layoutu: vždy stejný vizuální styl jako tokenový náhled (DS).
 * Pokud existuje propojený layout `page-layout-group-{id}`, přepíšou se ukázkové texty z bloků editoru.
 */
function renderPageLayoutGroupCardPreview(ds: DesignSystem, group: DesignSystemPageLayoutGroup): ReactNode {
  const linkedId = pageLayoutGroupCustomLayoutId(group.id);
  const linked = ds.blockPreferences.customLayouts?.find((l) => l.id === linkedId);
  const kind = group.previewKind ?? 'heading_row_infobox_image';
  const draft =
    linked?.blocks?.length ? extractPageLayoutDraftFromBlocks(kind, linked.blocks) : null;
  return renderPageLayoutPatternPreview(ds, group, draft);
}

/** Stejný renderer jako náhled stránky (`PrintGridCanvas`), pokud už existuje uložený layout skupiny. */
const PageLayoutGroupCardPreview = memo(function PageLayoutGroupCardPreview({
  ds,
  group,
  compact = false,
}: {
  ds: DesignSystem;
  group: DesignSystemPageLayoutGroup;
  /** Zmenší celý náhled na plátně (karta layoutů) — viz `LAYOUT_PREVIEW_COMPACT_ZOOM`. */
  compact?: boolean;
}) {
  const linkedId = pageLayoutGroupCustomLayoutId(group.id);
  const linked = ds.blockPreferences.customLayouts?.find((l) => l.id === linkedId);
  const worksheet = useMemo(() => {
    if (!linked?.blocks?.length) return null;
    return buildSinglePagePreviewWorksheetFromBlocks(ds, linked.blocks as WorksheetBlock[], group.id);
  }, [ds, group.id, linked?.blocks]);

  const inner = (() => {
    if (worksheet) {
      const pageFormat = (worksheet.metadata?.pageFormat as PageFormat | undefined) || 'a4';
      const dims = PAGE_DIMENSIONS[pageFormat] || PAGE_DIMENSIONS.a4;
      const scale = (PAGE_LAYOUT_GROUP_LIVE_PREVIEW_W / dims.width) * PAGE_LAYOUT_GROUP_CLIP_ZOOM;
      const clipH = Math.max(120, Math.round(dims.height * scale * PAGE_LAYOUT_GROUP_PAGE_TOP_FRACTION));

      return (
        <div
          style={{
            width: '100%',
            borderRadius: 10,
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            background: '#fff',
          }}
        >
          <div
            style={{
              width: PAGE_LAYOUT_GROUP_LIVE_PREVIEW_W,
              height: clipH,
              position: 'relative',
              margin: '0 auto',
            }}
          >
            <WorkbookLivePagePreview
              worksheet={worksheet}
              pageIndex={0}
              width={PAGE_LAYOUT_GROUP_LIVE_PREVIEW_W}
              height={clipH}
              borderRadius="0"
              forceVisible
              clipPageHeightFraction={PAGE_LAYOUT_GROUP_PAGE_TOP_FRACTION}
              clipPreviewZoom={PAGE_LAYOUT_GROUP_CLIP_ZOOM}
            />
          </div>
        </div>
      );
    }
    return <>{renderPageLayoutGroupCardPreview(ds, group)}</>;
  })();

  if (compact) {
    return (
      <div
        style={{
          zoom: LAYOUT_PREVIEW_COMPACT_ZOOM,
          width: `${100 / LAYOUT_PREVIEW_COMPACT_ZOOM}%`,
        }}
      >
        {inner}
      </div>
    );
  }

  return <>{inner}</>;
});

/** Z `page-layout-group-{groupId}` → `groupId` (stejné id jako v `pageLayoutGroups[]`). */
function pageLayoutGroupIdFromCustomLayoutId(layoutId: string): string | null {
  const PREFIX = 'page-layout-group-';
  if (!layoutId.startsWith(PREFIX)) return null;
  return layoutId.slice(PREFIX.length);
}

/** Mini náhled (legacy / úzké použití). */
const STRANKA_LAYOUTY_THUMB_W = 88;
const STRANKA_LAYOUTY_THUMB_H = 69;
/** Náhled v kartě layoutů (50 % oproti dřívějším 360×200). */
const STRANKA_LAYOUTY_CARD_PREVIEW_W = 180;
const STRANKA_LAYOUTY_CARD_PREVIEW_H = 100;

/** Rámeček mini náhledu stránky / layoutu na plátně (bez tmavého „letterboxu“). */
const LAYOUT_THUMB_FRAME: CSSProperties = {
  border: '1px solid #e2e8f0',
  backgroundColor: '#ffffff',
};

/** Výplň místo obrázku v tokenových náhledech vzorů stránky. */
const LAYOUT_PATTERN_FIGURE_PLACEHOLDER: CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px dashed #cbd5e1',
  boxSizing: 'border-box',
};

const StrankaLayoutyThumbnail = memo(function StrankaLayoutyThumbnail({
  ds,
  blocks,
  worksheetSuffix,
  maxWidthPx = STRANKA_LAYOUTY_THUMB_W,
  maxHeightPx = STRANKA_LAYOUTY_THUMB_H,
}: {
  ds: DesignSystem;
  blocks: WorksheetBlock[];
  /** Stejné jako u `PageLayoutGroupCardPreview`: `group.id` pro layouty ze skupin, jinak id layoutu. */
  worksheetSuffix: string;
  /** Výchozí 88×69; pro kartu „Stránka a layouty“ větší plocha. */
  maxWidthPx?: number;
  maxHeightPx?: number;
}) {
  const worksheet = useMemo(
    () => buildSinglePagePreviewWorksheetFromBlocks(ds, blocks, worksheetSuffix),
    [ds, blocks, worksheetSuffix],
  );
  const pageFormat = (worksheet.metadata?.pageFormat as PageFormat | undefined) || 'a4';
  const dims = PAGE_DIMENSIONS[pageFormat] || PAGE_DIMENSIONS.a4;
  const scale = (PAGE_LAYOUT_GROUP_LIVE_PREVIEW_W / dims.width) * PAGE_LAYOUT_GROUP_CLIP_ZOOM;
  const clipH = Math.max(120, Math.round(dims.height * scale * PAGE_LAYOUT_GROUP_PAGE_TOP_FRACTION));
  const fit = Math.min(
    maxWidthPx / PAGE_LAYOUT_GROUP_LIVE_PREVIEW_W,
    maxHeightPx / clipH,
  );

  return (
    <div
      title="Náhled jako na plátně"
      style={{
        position: 'relative',
        width: maxWidthPx,
        height: maxHeightPx,
        overflow: 'hidden',
        borderRadius: 8,
        ...LAYOUT_THUMB_FRAME,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: PAGE_LAYOUT_GROUP_LIVE_PREVIEW_W,
          height: clipH,
          transform: `translate(-50%, -50%) scale(${fit})`,
        }}
      >
        <WorkbookLivePagePreview
          worksheet={worksheet}
          pageIndex={0}
          width={PAGE_LAYOUT_GROUP_LIVE_PREVIEW_W}
          height={clipH}
          borderRadius="0"
          forceVisible
          clipPageHeightFraction={PAGE_LAYOUT_GROUP_PAGE_TOP_FRACTION}
          clipPreviewZoom={PAGE_LAYOUT_GROUP_CLIP_ZOOM}
        />
      </div>
    </div>
  );
});

/** Složený náhled z tokenů — podle `previewKind` jiná skladba (jinak by všechny vzory vypadaly stejně). */
function renderPageLayoutPatternPreview(
  ds: DesignSystem,
  group: DesignSystemPageLayoutGroup,
  draft?: PageLayoutDraftOverride | null,
): ReactNode {
  const kind: DesignSystemPageLayoutPreviewKind = group.previewKind ?? 'heading_row_infobox_image';
  switch (kind) {
    case 'wide_infobox_with_figure':
      return renderWideInfoboxWithFigurePreview(ds, draft ?? undefined);
    case 'heading_body_full_width':
      return renderHeadingBodyFullWidthPreview(ds, draft ?? undefined);
    case 'full_width_text':
      return renderFullWidthTextPreview(ds, draft ?? undefined);
    case 'full_width_image':
      return renderFullWidthImagePreview(ds, draft ?? undefined);
    case 'two_column_text':
      return renderTwoColumnTextPreview(ds, draft ?? undefined);
    case 'vertical_stack':
      return renderVerticalStackPreview(ds, draft ?? undefined);
    case 'heading_row_infobox_image':
    default:
      return renderHeadingRowInfoboxImagePreview(ds, draft ?? undefined);
  }
}

function renderHeadingRowInfoboxImagePreview(ds: DesignSystem, draft?: PageLayoutDraftOverride): ReactNode {
  const pd = ds.pageDefaults;
  const dvs = ds.blockPreferences.defaultVisualStyles ?? {};
  const infoboxPad = defaultBlockChromePaddingPx(dvs);
  const h2St = ds.typography.styles?.h2;
  const bodySt = ds.typography.styles?.body;
  const capSt = ds.typography.styles?.caption;
  const hf = ds.typography.headingFont;
  const bf = ds.typography.bodyFont;
  const h2Level = TYPO_LEVELS.find((l) => l.id === 'h2')!;
  const bodyLevel = TYPO_LEVELS.find((l) => l.id === 'body')!;
  const capLevel = TYPO_LEVELS.find((l) => l.id === 'caption')!;
  const h2Preview = typoPreviewStyle(hf, bf, h2Level, h2St);
  const bodyPreview = typoPreviewStyle(hf, bf, bodyLevel, bodySt);
  const capPreview = typoPreviewStyle(hf, bf, capLevel, capSt);
  const h2Px = Math.round(Math.min(12, (h2St?.fontSize ?? h2Level.defaultPx) * 0.52));
  return (
    <div
      style={{
        backgroundColor: pd.pageBackgroundColor,
        borderRadius: 10,
        padding: '8px 10px',
        border: '1px solid #e2e8f0',
      }}
    >
      <div
        style={{
          ...h2Preview,
          fontSize: h2Px,
          lineHeight: 1.2,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {clipText(draft?.heading ?? 'Ukázkový nadpis sekce', 28)}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'stretch', minHeight: 112 }}>
        <div
          style={{
            flex: '2 1 0',
            minWidth: 0,
            padding: infoboxPad,
            borderRadius: dvs.borderRadius ?? 8,
            backgroundColor: dvs.backgroundColor ?? 'rgba(254, 243, 199, 0.95)',
            border: dvs.borderColor
              ? `${Math.min(dvs.borderWidth ?? 2, 2)}px ${dvs.borderStyle ?? 'solid'} ${dvs.borderColor}`
              : '1px solid rgba(245, 209, 126, 0.85)',
            boxShadow: blockShadowCss(dvs.shadow),
          }}
        >
          <div
            style={{
              ...bodyPreview,
              fontSize: '9px',
              lineHeight: 1.45,
              color: bodySt?.textColor ?? (typeof bodyPreview.color === 'string' ? bodyPreview.color : '#334155'),
            }}
          >
            {clipText(
              draft?.body ??
                'Odstavec textu v rámečku podle pravidel u tohoto vzoru. Druhý odstavec ukazuje zalamování a odsazení vůči obrázku vpravo — typický úvodní blok kapitoly s ilustrací.',
              380,
            )}
          </div>
        </div>
        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              width: '100%',
              flex: 1,
              minHeight: 88,
              borderRadius: dvs.borderRadius ?? 8,
              ...LAYOUT_PATTERN_FIGURE_PLACEHOLDER,
            }}
          />
          <div style={{ ...capPreview, fontSize: '8px', lineHeight: 1.35 }}>
            {clipText(
              draft?.caption ??
                'Popisek pod obrázkem — delší řádek, aby bylo vidět zarovnání a mezeru pod ilustrací.',
              90,
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Široký panel (infobox), lišta s nadpisem uvnitř, text + figura vedle sebe — jiná skladba než řádek nadpis + ⅔+⅓. */
function renderWideInfoboxWithFigurePreview(ds: DesignSystem, draft?: PageLayoutDraftOverride): ReactNode {
  const pd = ds.pageDefaults;
  const dvs = ds.blockPreferences.defaultVisualStyles ?? {};
  const innerPad = defaultBlockChromePaddingPx(dvs);
  const h3St = ds.typography.styles?.h3;
  const bodySt = ds.typography.styles?.body;
  const hf = ds.typography.headingFont;
  const bf = ds.typography.bodyFont;
  const h3Level = TYPO_LEVELS.find((l) => l.id === 'h3')!;
  const bodyLevel = TYPO_LEVELS.find((l) => l.id === 'body')!;
  const h3Preview = typoPreviewStyle(hf, bf, h3Level, h3St);
  const bodyPreview = typoPreviewStyle(hf, bf, bodyLevel, bodySt);
  const barPx = Math.round(Math.min(9, (h3St?.fontSize ?? h3Level.defaultPx) * 0.5));
  const borderCol = dvs.borderColor ?? 'rgba(245, 209, 126, 0.85)';
  return (
    <div
      style={{
        backgroundColor: pd.pageBackgroundColor,
        borderRadius: 10,
        padding: '8px 10px',
        border: '1px solid #e2e8f0',
      }}
    >
      <div
        style={{
          borderRadius: Math.max(8, (dvs.borderRadius ?? 8) - 2),
          overflow: 'hidden',
          border: dvs.borderColor
            ? `${Math.min(dvs.borderWidth ?? 2, 2)}px ${dvs.borderStyle ?? 'solid'} ${dvs.borderColor}`
            : `1px solid ${borderCol}`,
          backgroundColor: dvs.backgroundColor ?? 'rgba(254, 243, 199, 0.95)',
          boxShadow: blockShadowCss(dvs.shadow),
        }}
      >
        <div
          style={{
            ...h3Preview,
            fontSize: barPx,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '5px 8px',
            borderBottom: `1px solid ${dvs.borderColor ? `${dvs.borderColor}55` : 'rgba(0,0,0,0.08)'}`,
            backgroundColor: 'rgba(255,255,255,0.25)',
          }}
        >
          {clipText(draft?.heading ?? 'Lišta s nadpisem uvnitř bloku', 36)}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: innerPad, alignItems: 'stretch', minHeight: 104 }}>
          <div
            style={{
              flex: '1 1 0',
              minWidth: 0,
              ...bodyPreview,
              fontSize: '9px',
              lineHeight: 1.45,
              color: bodySt?.textColor ?? (typeof bodyPreview.color === 'string' ? bodyPreview.color : '#334155'),
            }}
          >
            {clipText(
              draft?.body ??
                'Text uvnitř širokého bloku s odsazením od okrajů. Pokračování odstavce ukazuje delší výklad vedle menší figury — několik řádků, aby byl náhled výš a lépe odpovídal reálné stránce.',
              340,
            )}
          </div>
          <div
            style={{
              width: 48,
              flexShrink: 0,
              minHeight: 92,
              alignSelf: 'stretch',
              borderRadius: dvs.borderRadius ?? 8,
              ...LAYOUT_PATTERN_FIGURE_PLACEHOLDER,
            }}
            title="Místo pro ilustraci / postavu"
          />
        </div>
      </div>
    </div>
  );
}

function renderHeadingBodyFullWidthPreview(ds: DesignSystem, draft?: PageLayoutDraftOverride): ReactNode {
  const pd = ds.pageDefaults;
  const h2St = ds.typography.styles?.h2;
  const bodySt = ds.typography.styles?.body;
  const hf = ds.typography.headingFont;
  const bf = ds.typography.bodyFont;
  const h2Level = TYPO_LEVELS.find((l) => l.id === 'h2')!;
  const bodyLevel = TYPO_LEVELS.find((l) => l.id === 'body')!;
  const h2Preview = typoPreviewStyle(hf, bf, h2Level, h2St);
  const bodyPreview = typoPreviewStyle(hf, bf, bodyLevel, bodySt);
  const h2Px = Math.round(Math.min(11, (h2St?.fontSize ?? h2Level.defaultPx) * 0.5));
  const bodyColor =
    bodySt?.textColor ?? (typeof bodyPreview.color === 'string' ? bodyPreview.color : '#334155');
  return (
    <div
      style={{
        backgroundColor: pd.pageBackgroundColor,
        borderRadius: 10,
        padding: '8px 10px',
        border: '1px solid #e2e8f0',
      }}
    >
      <div style={{ ...h2Preview, fontSize: h2Px, lineHeight: 1.2, marginBottom: 6 }}>
        {clipText(draft?.heading ?? 'Nadpis kapitoly nebo podsekce', 36)}
      </div>
      <div style={{ ...bodyPreview, fontSize: '9px', color: bodyColor, lineHeight: 1.45 }}>
        {clipText(
          draft?.body ??
            'Souvislý výkladový text přes celou šířku textové oblasti — několik vět, bez obrázku vedle v jednom řádku. Druhý odstavec doplňuje kontext: běžné řádkování, mezery mezi odstavci a jak vypadá delší blok učebnicového textu. Třetí odstavec zarovnává náhled s reálnou výškou stránky.',
          420,
        )}
      </div>
    </div>
  );
}

function renderFullWidthTextPreview(ds: DesignSystem, draft?: PageLayoutDraftOverride): ReactNode {
  const pd = ds.pageDefaults;
  const bodySt = ds.typography.styles?.body;
  const hf = ds.typography.headingFont;
  const bf = ds.typography.bodyFont;
  const bodyLevel = TYPO_LEVELS.find((l) => l.id === 'body')!;
  const bodyPreview = typoPreviewStyle(hf, bf, bodyLevel, bodySt);
  const bodyColor =
    bodySt?.textColor ?? (typeof bodyPreview.color === 'string' ? bodyPreview.color : '#334155');
  return (
    <div
      style={{
        backgroundColor: pd.pageBackgroundColor,
        borderRadius: 10,
        padding: '8px 10px',
        border: '1px solid #e2e8f0',
      }}
    >
      <div style={{ ...bodyPreview, fontSize: '9px', color: bodyColor, lineHeight: 1.5 }}>
        {clipText(
          draft?.body ??
            'Čistý text přes šířku stránky — odstavce výkladu, příběhu nebo instrukcí, bez velkého nadpisu sekce nebo dominantního obrázku v rozložení. Druhý odstavec ukazuje, jak se text skládá při delším obsahu a jak působí prázdná mřížka kolem. Třetí odstavec a čtvrtý zarovnávají výšku náhledu s typickou stránkou plnou souvislého čtení.',
          520,
        )}
      </div>
    </div>
  );
}

function renderFullWidthImagePreview(ds: DesignSystem, draft?: PageLayoutDraftOverride): ReactNode {
  const pd = ds.pageDefaults;
  const dvs = ds.blockPreferences.defaultVisualStyles ?? {};
  const capSt = ds.typography.styles?.caption;
  const hf = ds.typography.headingFont;
  const bf = ds.typography.bodyFont;
  const capLevel = TYPO_LEVELS.find((l) => l.id === 'caption')!;
  const capPreview = typoPreviewStyle(hf, bf, capLevel, capSt);
  return (
    <div
      style={{
        backgroundColor: pd.pageBackgroundColor,
        borderRadius: 10,
        padding: '8px 10px',
        border: '1px solid #e2e8f0',
      }}
    >
      <div
        style={{
          width: '100%',
          height: 92,
          borderRadius: dvs.borderRadius ?? 8,
          backgroundColor: '#f8fafc',
          border: '1px dashed #cbd5e1',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ ...capPreview, fontSize: '8px', marginTop: 6, textAlign: 'left', lineHeight: 1.35 }}>
        {clipText(
          draft?.caption ??
            'Popisek pod dominantním obrázkem přes šířku — delší vysvětlení ilustrace, zdroje nebo kontextu k obrázku.',
          120,
        )}
      </div>
    </div>
  );
}

function renderTwoColumnTextPreview(ds: DesignSystem, draft?: PageLayoutDraftOverride): ReactNode {
  const pd = ds.pageDefaults;
  const bodySt = ds.typography.styles?.body;
  const hf = ds.typography.headingFont;
  const bf = ds.typography.bodyFont;
  const bodyLevel = TYPO_LEVELS.find((l) => l.id === 'body')!;
  const bodyPreview = typoPreviewStyle(hf, bf, bodyLevel, bodySt);
  const bodyColor =
    bodySt?.textColor ?? (typeof bodyPreview.color === 'string' ? bodyPreview.color : '#334155');
  const col = {
    ...bodyPreview,
    fontSize: '8px' as const,
    color: bodyColor,
    lineHeight: 1.45,
  };
  return (
    <div
      style={{
        backgroundColor: pd.pageBackgroundColor,
        borderRadius: 10,
        padding: '8px 10px',
        border: '1px solid #e2e8f0',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', minHeight: 96 }}>
        <div style={{ flex: 1, minWidth: 0, ...col }}>
          {clipText(
            draft?.bodyCol ??
              'Levý sloupec souvislého textu — výklad pokračuje v druhé kolonce vedle. Doplňující věty ukazují zalamování a výšku sloupce při delším obsahu, aby byl náhled srovnatelný se skutečnou dvousloupcovou stránkou.',
            280,
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, ...col }}>
          {clipText(
            draft?.bodyCol2 ??
              'Pravý sloupec — druhá část odstavce nebo pokračování textu. Zde může být druhá myšlenka, příklad nebo poznámka pod čarou ve stejné výšce jako vlevo.',
            260,
          )}
        </div>
      </div>
    </div>
  );
}

function renderVerticalStackPreview(ds: DesignSystem, draft?: PageLayoutDraftOverride): ReactNode {
  const pd = ds.pageDefaults;
  const dvs = ds.blockPreferences.defaultVisualStyles ?? {};
  const h2St = ds.typography.styles?.h2;
  const bodySt = ds.typography.styles?.body;
  const capSt = ds.typography.styles?.caption;
  const hf = ds.typography.headingFont;
  const bf = ds.typography.bodyFont;
  const h2Level = TYPO_LEVELS.find((l) => l.id === 'h2')!;
  const bodyLevel = TYPO_LEVELS.find((l) => l.id === 'body')!;
  const capLevel = TYPO_LEVELS.find((l) => l.id === 'caption')!;
  const h2Preview = typoPreviewStyle(hf, bf, h2Level, h2St);
  const bodyPreview = typoPreviewStyle(hf, bf, bodyLevel, bodySt);
  const capPreview = typoPreviewStyle(hf, bf, capLevel, capSt);
  const h2Px = Math.round(Math.min(10, (h2St?.fontSize ?? h2Level.defaultPx) * 0.45));
  const bodyColor =
    bodySt?.textColor ?? (typeof bodyPreview.color === 'string' ? bodyPreview.color : '#334155');
  return (
    <div
      style={{
        backgroundColor: pd.pageBackgroundColor,
        borderRadius: 10,
        padding: '8px 10px',
        border: '1px solid #e2e8f0',
      }}
    >
      <div style={{ ...h2Preview, fontSize: h2Px, marginBottom: 6 }}>
        {clipText(draft?.heading ?? 'Nadpis (1. blok)', 22)}
      </div>
      <div
        style={{
          height: 72,
          borderRadius: dvs.borderRadius ?? 8,
          marginBottom: 6,
          ...LAYOUT_PATTERN_FIGURE_PLACEHOLDER,
        }}
      />
      <div style={{ ...capPreview, fontSize: '7px', marginBottom: 6, lineHeight: 1.35 }}>
        {clipText(
          draft?.caption ??
            'Popisek k obrázku (2. blok) — delší vysvětlení nebo odkaz na zdroj pod ilustrací.',
          85,
        )}
      </div>
      <div style={{ ...bodyPreview, fontSize: '8px', color: bodyColor, lineHeight: 1.4 }}>
        {clipText(
          draft?.body ??
            'Textový blok pod obrázkem (3. blok) — pořadí a počet bloků popiš v pravidlech. Druhý odstavec ukazuje souvislý text až pod celým obrázkem; třetí odstavec simuluje delší závěr sekce nebo úkol pro žáka.',
          320,
        )}
      </div>
    </div>
  );
}

/** Společné rozbalovací menu knihovny (historie design systémů). */
function DesignSystemLibraryMenuList({
  libraryLoading,
  libraryList,
  activeDesignSystem,
  selectDesignSystemFromLibrary,
}: {
  libraryLoading: boolean;
  libraryList: DesignSystem[];
  activeDesignSystem: DesignSystem | null;
  selectDesignSystemFromLibrary: (ds: DesignSystem | null) => void;
}) {
  return (
    <div
      role="listbox"
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: 8,
        minWidth: '100%',
        width: 'max-content',
        maxWidth: 'min(360px, calc(100vw - 48px))',
        maxHeight: 'min(52vh, 420px)',
        overflowY: 'auto',
        borderRadius: 12,
        border: '1px solid rgba(71, 85, 105, 0.95)',
        backgroundColor: 'rgba(15, 23, 42, 0.98)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
        padding: 6,
        zIndex: 230,
      }}
    >
      <button
        type="button"
        role="option"
        aria-selected={!activeDesignSystem}
        onClick={() => selectDesignSystemFromLibrary(null)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '10px 10px',
          borderRadius: 8,
          border: 'none',
          backgroundColor: !activeDesignSystem ? 'rgba(99, 102, 241, 0.22)' : 'transparent',
          color: '#f8fafc',
          cursor: 'pointer',
          textAlign: 'left',
        }}
        onMouseEnter={(e) => {
          if (activeDesignSystem) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(51, 65, 85, 0.55)';
        }}
        onMouseLeave={(e) => {
          if (activeDesignSystem) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: 'linear-gradient(135deg, #22d3ee, #6366f1)',
            flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>Nový</span>
          <span style={{ display: 'block', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Prázdné plátno</span>
        </span>
        {!activeDesignSystem ? <Check size={16} style={{ flexShrink: 0, color: '#818cf8' }} /> : null}
      </button>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: '#64748b',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '10px 10px 6px',
          marginTop: 2,
          borderTop: '1px solid rgba(51, 65, 85, 0.75)',
        }}
      >
        Historie
      </div>
      {libraryLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, color: '#94a3b8' }}>
          <Loader2 size={18} className="animate-spin" />
          <span style={{ fontSize: 12 }}>Načítám…</span>
        </div>
      ) : libraryList.length === 0 ? (
        <p style={{ margin: 0, padding: '8px 12px 12px', fontSize: 12, lineHeight: 1.45, color: '#64748b' }}>
          Zatím nic v knihovně — uloží se po vygenerování nebo v klasickém editoru.
        </p>
      ) : (
        libraryList.map((ds) => {
          const active = activeDesignSystem?.id === ds.id;
          const dot = ds.thumbnail_color || '#5C5CFF';
          const dateLabel = ds.updated_at ? String(ds.updated_at).slice(0, 10) : '';
          return (
            <button
              key={ds.id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => selectDesignSystemFromLibrary(ds)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '9px 10px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: active ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                color: '#e2e8f0',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(51, 65, 85, 0.55)';
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: dot,
                  flexShrink: 0,
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ds.name}
                </span>
                {dateLabel ? (
                  <span style={{ display: 'block', fontSize: 10, color: '#64748b', marginTop: 2 }}>Upraveno {dateLabel}</span>
                ) : null}
              </span>
              {active ? <Check size={16} style={{ flexShrink: 0, color: '#818cf8' }} /> : null}
            </button>
          );
        })
      )}
    </div>
  );
}

/** Vite */
const IS_DEV = typeof import.meta !== 'undefined' && !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;

const MAX_REFERENCE_IMAGES = DESIGN_SYSTEM_MAX_REFERENCE_IMAGES;

/**
 * Ruční / preset styly nesmí smazat auto-seskupení (jinak zmizí i náhledy z „Náhodná ilustrace“).
 */
function shouldPreserveManualIllustrationStyles(ds: DesignSystem | undefined): boolean {
  if (!ds?.dataset) return false;
  if (ds.dataset.illustrationStylesUserPinned) return true;
  const styles = ds.dataset.illustrationStyles ?? [];
  return styles.some(
    (s) =>
      s.source === 'user' ||
      (typeof s.id === 'string' &&
        (s.id.startsWith('preset-') || s.id.startsWith('style-from-proposal-'))),
  );
}

/** Sjednocení URL pro porovnání (Storage někdy vrací mezery / odlišné escapování). */
function normalizeDatasetImageUrl(u: string | undefined): string {
  return typeof u === 'string' ? u.trim() : '';
}

/** Textové přílohy v datasetu — obrázky jsou v učitelské knihovně, ne v design_systems.dataset. */
function datasetTextFilesOnly(dataset: DesignSystemDataset | undefined): DatasetFile[] {
  return (dataset?.files ?? []).filter((f) => f.kind === 'text');
}

/** Přidá id do `referenceImageIds` jen u DS se zapnutým scope (pole definované); legacy `undefined` nemění. */
function mergeScopedReferenceImageIds(
  dataset: DesignSystemDataset | undefined,
  ids: string[],
): string[] | undefined {
  const prev = dataset?.referenceImageIds;
  if (prev === undefined) return undefined;
  return [...new Set([...prev, ...ids])];
}

/** Zachovat jen náhledy, jejichž styl pořád existuje (po přeskupení). */
function mergeIllustrationStyleSpotPreviews(
  prev: DesignSystemDataset['illustrationStyleSpotPreviews'] | undefined,
  styles: DatasetIllustrationStyle[] | undefined,
): DesignSystemDataset['illustrationStyleSpotPreviews'] | undefined {
  if (!styles?.length) return prev;
  const ids = new Set(styles.map((s) => s.id));
  if (!prev) return undefined;
  const out: NonNullable<typeof prev> = {};
  for (const [id, entry] of Object.entries(prev)) {
    if (!ids.has(id)) continue;
    if (entry && typeof entry === 'object' && typeof entry.url === 'string' && entry.url.startsWith('http')) {
      out[id] = entry;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/** Generování náhledů / příkladů v design systému — Gemini image „lite“ (Nano Banana Flash, edge: gemini-3.1-flash-image-preview). */
const DS_IMAGE_GEN_MODEL = 'lite' as const;

/** Náhodné motivy pro rychlý test stylu ilustrací (česky — model i prompt rozumí). */
const STYLE_EXAMPLE_SUBJECTS_CZ = [
  'Jezdec na koni v lehkém trysku',
  'Auto ucpané v městské zácpě',
  'Učitel ukazuje mapu žákům ve třídě',
  'Dítě pozoruje motýla na květu',
  'Vědec u mikroskopu v laboratoři',
  'Říční vlna a bobr u hráze',
  'Hvězdná obloha nad kempem',
  'Kuchař krájí zeleninu ve školní jídelně',
  'Žák staví model mostu z knížek',
  'Záchranář s lékárničkou u sportoviště',
  'Starý maják na skalnatém pobřeží',
  'Rodina na výletě u informační tabule v lese',
  'Včela na úlu a úly na louce',
  'Řidič elektrobusu na zastávce',
  'Archeolog štětcem u keramického střepu',
  'Dva kamarádi pouštějí draka',
  'Zimní stadion — děti na bruslích',
  'Hasič s hadicí u stromu',
  'Plachetnice na jezeře při západu slunce',
  'Robotická ruka skládá puzzle',
];

/** Náhodný anglický „brief“ pro náhled stylu — kompozice / světlo / rámování (k českému motivu scény). */
const STYLE_SPOT_RANDOM_DIRECTIVES_EN = [
  'Single clear focal subject; uncluttered composition; readable at textbook size.',
  'Close-up on the main subject; shallow depth of field; soft background blur.',
  'Wide establishing shot; distinct foreground, midground, and background.',
  'Action moment frozen mid-motion; dynamic but easy to read.',
  'Eye-level perspective; natural proportions; calm neutral mood.',
  'Slight low angle for subtle emphasis; balanced framing.',
  'Soft diffused daylight; gentle shadows; no harsh contrast.',
  'Warm side light like golden hour; soft long shadows.',
  'Even overcast daylight; no blown highlights; natural colors.',
  'Centered subject with comfortable margins; textbook-friendly framing.',
  'Rule of thirds; subject slightly off-center; intentional negative space.',
  'Environmental context visible but secondary to the main subject.',
  'Hands and a key object in frame; clear gesture; story in one glance.',
  'Symmetrical composition; quiet formal mood.',
  'Diagonal flow leading the eye toward the main subject.',
  'High detail on the subject; softer treatment in the surroundings.',
  'Minimal background; isolate the subject for clarity.',
  'Candid documentary feel; natural poses; no stiff staging.',
  'Quiet contemplative moment; still atmosphere.',
  'Small group of figures; clear spatial relationships between them.',
  'Single figure as hero; supporting elements kept simple.',
  'Texture and material detail visible on the main subject.',
  'Outdoor scene with natural sky and horizon line for depth.',
  'Indoor scene with soft ambient light from a window.',
  'Bird’s-eye overview; clear layout of elements from above.',
] as const;

type StyleExamplePromptVariant = 'default' | 'alternate' | 'sameReference';

function buildExampleIllustrationPrompt(
  subject: string,
  ai: DesignSystemAIPrompts,
  variant: StyleExamplePromptVariant = 'default',
): string {
  const lines = [
    `Educational textbook illustration, single clear focal scene: ${subject}.`,
    `Visual style and technique: ${ai.imageStyle?.trim() || 'clean, readable illustration for students, consistent lighting.'}.`,
  ];
  if (ai.characterStyle?.trim()) {
    lines.push(`Figures and characters: ${ai.characterStyle.trim()}.`);
  }
  if (ai.negativePrompt?.trim()) {
    lines.push(`Strictly avoid: ${ai.negativePrompt.trim()}.`);
  }
  if (variant === 'alternate') {
    lines.push(
      'Use a clearly different visual treatment than a typical textbook: change medium, texture, or color handling while keeping clarity for young readers.',
      'Pick one distinct direction: soft watercolor, bold flat vector shapes, ink line art with flat fills, gouache, or paper-cut collage — avoid looking like the previous sample.',
    );
  }
  if (variant === 'sameReference') {
    lines.push(
      'Match the illustration style, palette, line quality, and rendering of the provided reference image closely; keep the same visual language and change only the scene content to depict the new subject above.',
    );
  }
  lines.push(
    'No readable text, letters, or watermarks in the image. One cohesive composition, suitable for print in a school book.',
  );
  return lines.join('\n');
}

/**
 * Náhled ověření jednoho stylu: náhodný motiv scény + náhodný brief (kompozice/světlo) + promptHint klastru.
 * Globální aiPrompts design systému sem nepatří — styl drží výhradně promptHint a reference z `designSystemReferenceFiles`.
 */
function buildStyleCategorySpotPrompt(
  subject: string,
  stylePromptHint: string,
  randomDirectiveEn: string,
): string {
  const hint = stylePromptHint.trim();
  const dir = randomDirectiveEn.trim();
  const parts: string[] = [`Scene: ${subject}`];
  if (dir) {
    parts.push(`Generation brief (how to frame and light the scene): ${dir}`);
  }
  if (hint) {
    parts.push(hint);
  }
  return parts.join('\n\n');
}

/** První dvě věty (anglické interpunkční oddělení) pro zkrácený náhled promptu. */
function getFirstTwoSentencesEn(text: string): string {
  const t = text.trim();
  if (!t) return '';
  const parts = t.split(/(?<=[.!?])\s+/).filter((p) => p.trim().length > 0);
  if (parts.length <= 2) return t;
  return `${parts[0]} ${parts[1]}`.trim();
}

function hasMoreThanTwoSentencesEn(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const parts = t.split(/(?<=[.!?])\s+/).filter((p) => p.trim().length > 0);
  return parts.length > 2;
}

const labelCap: CSSProperties = {
  fontSize: 14.3,
  fontWeight: 700,
  color: '#64748b',
  letterSpacing: '0.06em',
  marginBottom: 10,
};

const bodyMuted: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: '#64748b',
};

/** Jedna náhledová buňka v kartě referencí (sdílená plochá mřížka vs. mřížka pod stylem). */
function DsIllustrationRefCell({
  f,
  onRemove,
  onNoteChange,
  layoutExtractBusyId,
  referenceUploading,
  onExtractLayout,
}: {
  f: DatasetFile;
  onRemove: () => void;
  onNoteChange: (note: string) => void;
  layoutExtractBusyId: string | null;
  referenceUploading: boolean;
  onExtractLayout: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div
        title={f.referenceNote || f.name}
        style={{
          position: 'relative',
          aspectRatio: '1',
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid rgba(71, 85, 105, 0.85)',
          backgroundColor: '#0f172a',
          backgroundImage: f.url ? `url(${f.url})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <button
          type="button"
          title="Odebrat"
          onClick={onRemove}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 26,
            height: 26,
            borderRadius: 8,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            color: '#e2e8f0',
            cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>
        {f.referenceRole ? (
          <div
            style={{
              position: 'absolute',
              bottom: 4,
              left: 4,
              fontSize: 8,
              fontWeight: 700,
              padding: '2px 5px',
              borderRadius: 4,
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              color: f.referenceRole === 'layout' ? '#a5b4fc' : '#5eead4',
              letterSpacing: '0.04em',
              pointerEvents: 'none',
            }}
          >
            {f.referenceRole === 'layout' ? 'LAYOUT' : 'ILUSTR.'}
          </div>
        ) : null}
      </div>
      <input
        type="text"
        value={f.referenceNote ?? ''}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Katalog…"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '5px 6px',
          borderRadius: 6,
          border: '1px solid #e2e8f0',
          fontSize: 9,
          color: '#0f172a',
          backgroundColor: '#f8fafc',
          outline: 'none',
        }}
      />
      {f.illustrationTags && f.illustrationTags.length > 0 ? (
        <div
          style={{
            fontSize: 8,
            color: '#94a3b8',
            lineHeight: 1.25,
            wordBreak: 'break-word',
          }}
        >
          AI tagy: {f.illustrationTags.join(' · ')}
        </div>
      ) : null}
      {f.referenceRole !== 'illustration' ? (
        <button
          type="button"
          disabled={layoutExtractBusyId !== null || referenceUploading}
          onClick={onExtractLayout}
          style={{
            alignSelf: 'stretch',
            padding: '4px 6px',
            borderRadius: 6,
            border: '1px solid rgba(99, 102, 241, 0.45)',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            color: '#a5b4fc',
            fontSize: 9,
            fontWeight: 600,
            cursor: layoutExtractBusyId !== null || referenceUploading ? 'not-allowed' : 'pointer',
            opacity: layoutExtractBusyId !== null || referenceUploading ? 0.5 : 1,
          }}
        >
          {layoutExtractBusyId === f.id ? '…' : 'Vyříznout ilustrace'}
        </button>
      ) : null}
    </div>
  );
}

export function DesignSystemCanvasWorkspace({
  activeDesignSystem,
  onDesignSystemChange,
  onOpenClassicEditor,
  bookEditorContext,
  onApplyToBook,
}: {
  activeDesignSystem: DesignSystem | null;
  onDesignSystemChange: (ds: DesignSystem | null) => void;
  /**
   * Otevření vlastního layoutu v Pro editoru (`/admin/worksheet-pro/`).
   * Druhý argument = snapshot DS po `ensurePageLayoutGroupCustomLayout` (nový záznam v knihovně ještě nemusí být v rodiči).
   */
  onOpenClassicEditor: (customLayoutId?: string, designSystemSnapshot?: DesignSystem | null) => void;
  /** Kontext knihy pro „Otevřít v editoru“ u náhledu toku stránek. */
  bookEditorContext?: { bookId: string; workbookId: string; pageFormat: PageFormat };
  /** Uloží vybraný design systém jako styl knihy (`teacher_books.design_system_id`) a propíše do existujících stran. */
  onApplyToBook?: (ds: DesignSystem) => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const [brief, setBrief] = useState('');
  const [generating, setGenerating] = useState(false);
  /** Kroky agentů při generování z briefu (bobánky vpravo). */
  const [pipelineLog, setPipelineLog] = useState<DesignSystemPipelineEvent[]>([]);
  /** `new` = nový řádek v design_systems; `update` = merge + upsert podle activeDesignSystem.id */
  const [saveMode, setSaveMode] = useState<'new' | 'update'>('new');
  /** Po úspěchu AI nebo dev dvojkliku — karty tokenů na plátně. */
  /** Úprava jednoho písmového stylu (h1–caption) v popupu. */
  const [typoPopupLevel, setTypoPopupLevel] = useState<TypoLevelId | null>(null);
  /** Výběr globálního primárního (nadpisy) nebo sekundárního (text) fontu na kartě typografie. */
  const [typoBaseFontOpen, setTypoBaseFontOpen] = useState<'heading' | 'body' | null>(null);
  /** Úprava jednoho vizuálního typu bloku (stejný dialogový vzor jako font). */
  const [blockVisualPresetEditId, setBlockVisualPresetEditId] = useState<string | null>(null);
  /** Úprava barvy z náhledu palety u karty Barvy. */
  const [paletteSwatchEdit, setPaletteSwatchEdit] = useState<{ groupId: string; swatch: ColorSwatch } | null>(null);
  /** Detail karty „Vizuální styl“ (náhled + úpravy jako u písmových stylů). */
  const [visualStylePopupKey, setVisualStylePopupKey] = useState<keyof DesignSystemVisualStyleNotes | null>(null);
  const openTypoPopup = useCallback((level: TypoLevelId) => {
    setTypoBaseFontOpen(null);
    setBlockVisualPresetEditId(null);
    setPaletteSwatchEdit(null);
    setVisualStylePopupKey(null);
    setTypoPopupLevel(level);
  }, []);
  const openPageLayoutGroupInEditor = useCallback(
    (group: DesignSystemPageLayoutGroup) => {
      if (!activeDesignSystem) return;
      const next = ensurePageLayoutGroupCustomLayout(activeDesignSystem, group);
      if (next !== activeDesignSystem) {
        onDesignSystemChange(next);
      }
      onOpenClassicEditor(pageLayoutGroupCustomLayoutId(group.id), next);
    },
    [activeDesignSystem, onDesignSystemChange, onOpenClassicEditor],
  );
  const generateBusyRef = useRef(false);
  const exampleImageBusyRef = useRef(false);
  const dsPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDsForPersistRef = useRef<DesignSystem | null>(null);
  const [libraryDropdownOpen, setLibraryDropdownOpen] = useState(false);
  const [libraryList, setLibraryList] = useState<DesignSystem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const libraryDropdownRef = useRef<HTMLDivElement>(null);
  const onboardingLibraryRef = useRef<HTMLDivElement>(null);
  const [onboardingLibraryOpen, setOnboardingLibraryOpen] = useState(false);
  const referenceFileInputRef = useRef<HTMLInputElement>(null);
  /** Referenční obrázky před prvním uložením design systému (žádný řádek v knihovně). */
  const [orphanRefImages, setOrphanRefImages] = useState<DatasetFile[]>([]);
  const [referenceUploading, setReferenceUploading] = useState(false);
  const [layoutExtractBusyId, setLayoutExtractBusyId] = useState<string | null>(null);
  /** Automatické seskupení referencí do stylů (Gemini Flash + vision). */
  const [styleClusterBusy, setStyleClusterBusy] = useState(false);
  const [styleClusterError, setStyleClusterError] = useState<string | null>(null);
  /** Rozbalený detail jednoho AI stylu (náhledová dlaždice → klik). */
  const [aiStyleDetailOpenId, setAiStyleDetailOpenId] = useState<string | null>(null);
  const [styleSpotLoadingStyleId, setStyleSpotLoadingStyleId] = useState<string | null>(null);
  /** Rozbalení dlouhého promptu u kategorie stylu. */
  const [expandedPromptStyleIds, setExpandedPromptStyleIds] = useState<Record<string, boolean>>({});
  const styleSpotBusyRef = useRef(false);
  const styleExtraFileInputRef = useRef<HTMLInputElement>(null);
  const styleUploadTargetIdRef = useRef<string | null>(null);
  const [styleExampleLoading, setStyleExampleLoading] = useState(false);
  const [styleExampleImageUrl, setStyleExampleImageUrl] = useState<string | null>(null);
  const [styleExampleSubject, setStyleExampleSubject] = useState<string | null>(null);
  /** Celý prompt posledního běhu (pro uložení do datasetu). */
  const [styleExamplePrompt, setStyleExamplePrompt] = useState<string | null>(null);
  /** Náhodný obsah v náhledu stránek („Aktualizovat“). */
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  /** Přílohy u zadání — defaultně sbalené („Více“). */
  const [zadaniPrilohyOpen, setZadaniPrilohyOpen] = useState(false);
  /** Výběr přednastaveného ilustračního stylu (modal). */
  const [presetStylesPickerOpen, setPresetStylesPickerOpen] = useState(false);
  /** Doporučení AI stylu podle textu zadání. */
  const [presetFromPromptBusy, setPresetFromPromptBusy] = useState(false);
  const [presetFromPromptResult, setPresetFromPromptResult] = useState<{
    recommendations: PresetStyleRecommendation[];
    summaryCz: string;
  } | null>(null);
  /**
   * Sdílená knihovna referenčních obrázků učitele (tabulka teacher_illustration_reference_library),
   * ne vázaná na jeden design systém.
   */
  const [teacherIllustrationRefFiles, setTeacherIllustrationRefFiles] = useState<DatasetFile[]>([]);
  const [teacherIllustrationRefReady, setTeacherIllustrationRefReady] = useState(false);
  const lastDatasetImageMigrationSigRef = useRef<string>('');

  /**
   * Veškeré obrázky pro rozlišení podle id (knihovna + případně `dataset.files`) — styly, náhledy, seskupení.
   * Není totéž co přílohy u zadání (viz `zadaniBriefAttachmentFiles`).
   */
  const referenceResolutionFiles = useMemo((): DatasetFile[] => {
    if (!activeDesignSystem) return orphanRefImages;
    if (!teacherIllustrationRefReady) {
      return (activeDesignSystem.dataset?.files ?? []).filter((f) => f.kind === 'image');
    }
    const fromDs = (activeDesignSystem.dataset?.files ?? []).filter((f) => f.kind === 'image');
    const scopedIds = activeDesignSystem.dataset?.referenceImageIds;
    const sourcePool =
      scopedIds != null
        ? teacherIllustrationRefFiles.filter((f) => scopedIds.includes(f.id))
        : teacherIllustrationRefFiles;
    const byId = new Map(sourcePool.map((f) => [f.id, f]));
    for (const im of fromDs) {
      if (!byId.has(im.id)) byId.set(im.id, im);
    }
    return Array.from(byId.values());
  }, [activeDesignSystem, orphanRefImages, teacherIllustrationRefReady, teacherIllustrationRefFiles]);

  /**
   * Přílohy u „Zadání“ — jen výslovně přidané id (`briefReferenceImageIds`) nebo legacy obrázky v `dataset.files`.
   * Nikdy celá sdílená knihovna (ta by se po migraci omylem zobrazila jako 20+ příloh).
   */
  const zadaniBriefAttachmentFiles = useMemo((): DatasetFile[] => {
    if (!activeDesignSystem) return orphanRefImages;
    const poolById = new Map(referenceResolutionFiles.map((f) => [f.id, f]));
    const fromDs = (activeDesignSystem.dataset?.files ?? []).filter((f) => f.kind === 'image');
    const briefIds = activeDesignSystem.dataset?.briefReferenceImageIds;
    if (briefIds != null) {
      return briefIds.map((id) => poolById.get(id)).filter((f): f is DatasetFile => Boolean(f));
    }
    if (fromDs.length > 0) {
      return fromDs.map((f) => poolById.get(f.id) ?? f).filter((f): f is DatasetFile => Boolean(f));
    }
    return [];
  }, [activeDesignSystem, referenceResolutionFiles, orphanRefImages]);

  const referenceResolutionFilesRef = useRef(referenceResolutionFiles);
  referenceResolutionFilesRef.current = referenceResolutionFiles;
  const styleClusterGenRef = useRef(0);

  /** Jen obrázky pro AI seskupení — bez layoutů; volitelně bez auto-výřezů ze stránek (viz `styleClusterIncludeAutoCrops`). */
  const illustrationClusterImageIdsKey = useMemo(() => {
    const includeAuto = activeDesignSystem?.dataset?.styleClusterIncludeAutoCrops === true;
    return referenceResolutionFiles
      .filter((f) => {
        if (f.kind !== 'image' || !f.url?.startsWith('http') || f.referenceRole === 'layout') return false;
        if (!includeAuto && f.referenceNote === REF_NOTE_ILLUSTRATION_CROP) return false;
        return true;
      })
      .map((f) => f.id)
      .sort()
      .join('|');
  }, [referenceResolutionFiles, activeDesignSystem?.dataset?.styleClusterIncludeAutoCrops]);

  const hasAutoLayoutCropsInLibrary = useMemo(
    () =>
      referenceResolutionFiles.some(
        (f) => f.kind === 'image' && f.referenceNote === REF_NOTE_ILLUSTRATION_CROP,
      ),
    [referenceResolutionFiles],
  );

  /** Obrázky pro kartu ilustračních stylů — layout stránky zde vůbec neukazujeme (jen v přílohách u zadání). */
  const illustrationReferenceFilesForStyleCard = useMemo(
    () => referenceResolutionFiles.filter((f) => f.referenceRole !== 'layout'),
    [referenceResolutionFiles],
  );

  const referenceFileById = useMemo(() => {
    const m = new Map<string, DatasetFile>();
    for (const f of referenceResolutionFiles) {
      m.set(f.id, f);
    }
    return m;
  }, [referenceResolutionFiles]);

  const illustrationStylesFromDataset = activeDesignSystem?.dataset?.illustrationStyles ?? [];

  /** Které přednastavené styly (katalogová id) už jsou v datasetu */
  const appliedPresetCatalogIds = useMemo(() => {
    const out = new Set<string>();
    for (const s of illustrationStylesFromDataset) {
      if (s.id.startsWith('preset-')) out.add(s.id.slice('preset-'.length));
    }
    return out;
  }, [illustrationStylesFromDataset]);

  /**
   * Náhled dlaždice u přednastaveného stylu — jen obrázky uložené u daného stylu v datasetu (`imageIds`),
   * ne spot náhled (ten bývá vizuálně stejný jako nezařazené výřezy z knihovny).
   * Preferuje id, které nepoužívá jiný ilustrační styl (žádné „půjčené“ fotky).
   */
  const presetPickerDatasetThumbnails = useMemo(() => {
    const out = new Map<string, string>();
    const ds = activeDesignSystem?.dataset;
    if (!ds) return out;
    const byId = new Map<string, DatasetFile>();
    for (const f of referenceResolutionFiles) {
      if (f.kind === 'image' && f.url?.startsWith('http')) {
        byId.set(f.id, f);
      }
    }
    const allStyles = ds.illustrationStyles ?? [];
    for (const st of allStyles) {
      if (!st.id.startsWith('preset-')) continue;
      const catalogId = st.id.slice('preset-'.length);
      const otherStyleIds = new Set(allStyles.filter((s) => s.id !== st.id).flatMap((s) => s.imageIds));
      let found: string | undefined;
      for (const imgId of st.imageIds) {
        if (otherStyleIds.has(imgId)) continue;
        const f = byId.get(imgId);
        const u = f?.url;
        if (typeof u === 'string' && u.startsWith('http')) {
          found = normalizeDatasetImageUrl(u);
          break;
        }
      }
      if (found) out.set(catalogId, found);
    }
    return out;
  }, [referenceResolutionFiles, activeDesignSystem?.dataset?.illustrationStyles]);

  const orphanReferenceFilesForStyles = useMemo(() => {
    const styles = activeDesignSystem?.dataset?.illustrationStyles;
    if (!styles?.length) return [];
    const assigned = new Set(styles.flatMap((s) => s.imageIds));
    return referenceResolutionFiles.filter(
      (f) => !assigned.has(f.id) && f.referenceRole !== 'layout',
    );
  }, [activeDesignSystem?.dataset?.illustrationStyles, referenceResolutionFiles]);

  const hasIllustrationStyleCategories = illustrationStylesFromDataset.length > 0;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const lib = await getTeacherIllustrationReferenceLibrary();
        if (cancelled) return;
        setTeacherIllustrationRefFiles(lib);
      } catch {
        if (!cancelled) setTeacherIllustrationRefFiles([]);
      } finally {
        if (!cancelled) setTeacherIllustrationRefReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const ids = new Set((activeDesignSystem?.dataset?.illustrationStyles ?? []).map((s) => s.id));
    setAiStyleDetailOpenId((open) => (open && ids.has(open) ? open : null));
  }, [activeDesignSystem?.dataset?.illustrationStyles]);

  useEffect(() => {
    if (activeDesignSystem) setOrphanRefImages([]);
  }, [activeDesignSystem?.id]);

  useEffect(() => {
    setStyleExampleImageUrl(null);
    setStyleExampleSubject(null);
    setExpandedPromptStyleIds({});
  }, [activeDesignSystem?.id]);

  useEffect(() => {
    setPresetFromPromptResult(null);
  }, [activeDesignSystem?.id]);

  useEffect(() => {
    if (!activeDesignSystem) setSaveMode('new');
  }, [activeDesignSystem]);

  useEffect(() => {
    if (
      !typoPopupLevel &&
      !visualStylePopupKey &&
      !typoBaseFontOpen &&
      !blockVisualPresetEditId &&
      !paletteSwatchEdit
    )
      return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTypoPopupLevel(null);
        setVisualStylePopupKey(null);
        setTypoBaseFontOpen(null);
        setBlockVisualPresetEditId(null);
        setPaletteSwatchEdit(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [typoPopupLevel, visualStylePopupKey, typoBaseFontOpen, blockVisualPresetEditId, paletteSwatchEdit]);

  useEffect(() => {
    if (!libraryDropdownOpen && !onboardingLibraryOpen) return;
    let cancelled = false;
    setLibraryLoading(true);
    void getDesignSystems().then((list) => {
      if (!cancelled) {
        setLibraryList(list);
        setLibraryLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [libraryDropdownOpen, onboardingLibraryOpen]);

  useEffect(() => {
    if (!libraryDropdownOpen && !onboardingLibraryOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (libraryDropdownRef.current?.contains(t)) return;
      if (onboardingLibraryRef.current?.contains(t)) return;
      setLibraryDropdownOpen(false);
      setOnboardingLibraryOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [libraryDropdownOpen, onboardingLibraryOpen]);

  useEffect(() => {
    if (!activeDesignSystem) {
      setBrief('');
      return;
    }
    setBrief(activeDesignSystem.dataset?.generationBrief ?? '');
  }, [activeDesignSystem?.id, activeDesignSystem?.dataset?.generationBrief]);

  useEffect(
    () => () => {
      if (dsPersistTimerRef.current) clearTimeout(dsPersistTimerRef.current);
    },
    [],
  );

  /** Uložení celého záznamu design systému (dataset, stránka, vzhled bloků…) po úpravách na plátně. */
  const schedulePersistDesignSystemToSupabase = useCallback(
    (ds: DesignSystem) => {
      const id = ds.id;
      if (!id || id.startsWith('local-')) return;
      latestDsForPersistRef.current = ds;
      if (dsPersistTimerRef.current) clearTimeout(dsPersistTimerRef.current);
      dsPersistTimerRef.current = setTimeout(async () => {
        dsPersistTimerRef.current = null;
        const toSave = latestDsForPersistRef.current;
        if (!toSave?.id || toSave.id.startsWith('local-')) return;
        const saved = await saveDesignSystem({
          id: toSave.id,
          name: toSave.name,
          description: toSave.description,
          thumbnail_color: toSave.thumbnail_color,
          colors: toSave.colors,
          typography: toSave.typography,
          pageDefaults: toSave.pageDefaults,
          aiPrompts: toSave.aiPrompts,
          blockPreferences: toSave.blockPreferences,
          dataset: toSave.dataset ?? { files: [] },
        });
        if (!saved) {
          toast.error('Design systém se nepodařilo uložit do knihovny.');
          return;
        }
        /** Odpověď ze Supabase může mít neúplný `dataset`, klient musí přepsat uloženým stavem (files, imageIds, …). */
        const mergedDataset: DesignSystemDataset = {
          ...(saved.dataset ?? { files: [] }),
          ...(toSave.dataset ?? {}),
          illustrationStyleSpotPreviews: {
            ...(saved.dataset?.illustrationStyleSpotPreviews ?? {}),
            ...(toSave.dataset?.illustrationStyleSpotPreviews ?? {}),
          },
        };
        onDesignSystemChange({
          ...saved,
          dataset: mergedDataset,
        });
      }, 700);
    },
    [onDesignSystemChange],
  );

  const applyDesignSystemPatch = useCallback(
    (mutate: (ds: DesignSystem) => DesignSystem) => {
      if (!activeDesignSystem) return;
      const merged = mutate(activeDesignSystem);
      onDesignSystemChange(merged);
      schedulePersistDesignSystemToSupabase(merged);
    },
    [activeDesignSystem, onDesignSystemChange, schedulePersistDesignSystemToSupabase],
  );

  /** Starší uložené DS měly obrázky v dataset.files — přesuneme je do sdílené knihovny a v DS necháme jen text. */
  useEffect(() => {
    if (!activeDesignSystem?.id || String(activeDesignSystem.id).startsWith('local-')) return;
    if (!teacherIllustrationRefReady) return;
    const imgs = (activeDesignSystem.dataset?.files ?? []).filter((f) => f.kind === 'image');
    if (imgs.length === 0) return;
    const sig = `${activeDesignSystem.id}:${imgs.map((i) => i.id).sort().join(',')}`;
    if (lastDatasetImageMigrationSigRef.current === sig) return;
    lastDatasetImageMigrationSigRef.current = sig;
    let cancelled = false;
    void (async () => {
      const byId = new Map(teacherIllustrationRefFiles.map((f) => [f.id, f]));
      for (const im of imgs) {
        if (!byId.has(im.id)) byId.set(im.id, im);
      }
      const merged = Array.from(byId.values());
      const ok = await saveTeacherIllustrationReferenceLibrary(merged);
      if (cancelled || !ok) {
        lastDatasetImageMigrationSigRef.current = '';
        return;
      }
      setTeacherIllustrationRefFiles(merged);
      const imgIds = imgs.map((i) => i.id);
      applyDesignSystemPatch((ds) => ({
        ...ds,
        dataset: {
          ...ds.dataset,
          topic: ds.dataset?.topic,
          generationBrief: ds.dataset?.generationBrief,
          files: datasetTextFilesOnly(ds.dataset),
          ...(ds.dataset?.referenceImageIds != null
            ? { referenceImageIds: [...new Set([...ds.dataset.referenceImageIds, ...imgIds])] }
            : {}),
        },
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, [
    activeDesignSystem?.id,
    activeDesignSystem?.dataset?.files,
    teacherIllustrationRefReady,
    teacherIllustrationRefFiles,
    applyDesignSystemPatch,
  ]);

  const patchPaletteSwatch = useCallback(
    (groupId: string, swatchId: string, patch: Partial<ColorSwatch>) => {
      applyDesignSystemPatch((ds) => ({
        ...ds,
        colors: ds.colors.map((g) =>
          g.id === groupId
            ? { ...g, swatches: g.swatches.map((s) => (s.id === swatchId ? { ...s, ...patch } : s)) }
            : g,
        ),
      }));
    },
    [applyDesignSystemPatch],
  );

  const applyBaseFontFromPicklist = useCallback(
    (mode: 'heading' | 'body', cssFontValue: string) => {
      const name = extractFontFamilyName(cssFontValue);
      if (!name) return;
      if (mode === 'heading') {
        applyDesignSystemPatch((ds) => ({
          ...ds,
          typography: {
            ...ds.typography,
            headingFont: name,
            styles: stripFontFamilyFromStyleLevels(ds.typography.styles ?? {}, ['h1', 'h2', 'h3']),
          },
        }));
      } else {
        applyDesignSystemPatch((ds) => ({
          ...ds,
          typography: {
            ...ds.typography,
            bodyFont: name,
            styles: stripFontFamilyFromStyleLevels(ds.typography.styles ?? {}, ['body', 'caption']),
          },
        }));
      }
    },
    [applyDesignSystemPatch],
  );

  const fontPickListOptions = useMemo(
    () => (activeDesignSystem ? buildDesignSystemFontPickList(activeDesignSystem.typography) : []),
    [activeDesignSystem?.typography],
  );

  const headingFontSelectValue = useMemo(() => {
    if (!activeDesignSystem) return '';
    const hf = activeDesignSystem.typography.headingFont;
    const m = fontPickListOptions.find((o) => extractFontFamilyName(o.value) === hf);
    return m?.value ?? fontPickListOptions[0]?.value ?? `'${hf}', sans-serif`;
  }, [activeDesignSystem, fontPickListOptions]);

  const bodyFontSelectValue = useMemo(() => {
    if (!activeDesignSystem) return '';
    const bf = activeDesignSystem.typography.bodyFont;
    const m = fontPickListOptions.find((o) => extractFontFamilyName(o.value) === bf);
    return m?.value ?? fontPickListOptions[0]?.value ?? `'${bf}', sans-serif`;
  }, [activeDesignSystem, fontPickListOptions]);

  const blockVisualPresetsList = useMemo(
    () => (activeDesignSystem ? resolveBlockVisualStylePresets(activeDesignSystem) : []),
    [activeDesignSystem],
  );

  useEffect(() => {
    if (!blockVisualPresetEditId) return;
    if (!blockVisualPresetsList.some((p) => p.id === blockVisualPresetEditId)) {
      setBlockVisualPresetEditId(null);
    }
  }, [blockVisualPresetEditId, blockVisualPresetsList]);

  const setDefaultBlockVisualPreset = useCallback(
    (presetId: string) => {
      if (!activeDesignSystem) return;
      applyDesignSystemPatch((ds) => {
        const list = resolveBlockVisualStylePresets(ds);
        const bp = syncBlockPreferencesDefaultVisualWithPresets(
          { ...ds.blockPreferences, defaultBlockVisualPresetId: presetId, blockVisualStylePresets: list },
          list,
          ds,
        );
        return { ...ds, blockPreferences: bp };
      });
    },
    [activeDesignSystem, applyDesignSystemPatch],
  );

  const patchBlockVisualPreset = useCallback(
    (presetId: string, styles: BlockVisualStyles, name?: string) => {
      if (!activeDesignSystem) return;
      applyDesignSystemPatch((ds) => {
        const list = resolveBlockVisualStylePresets(ds).map((p) => {
          if (p.id !== presetId) return p;
          const nextName = name !== undefined ? name.trim() || p.name : p.name;
          return { ...p, styles, name: nextName };
        });
        const bp = syncBlockPreferencesDefaultVisualWithPresets(
          { ...ds.blockPreferences, blockVisualStylePresets: list },
          list,
          ds,
        );
        return { ...ds, blockPreferences: bp };
      });
    },
    [activeDesignSystem, applyDesignSystemPatch],
  );

  const addBlockVisualPreset = useCallback(() => {
    if (!activeDesignSystem) return;
    const highlight = BLOCK_VISUAL_STYLE_PRESETS.find((p) => p.id === 'highlight')!;
    applyDesignSystemPatch((ds) => {
      const list = [
        ...resolveBlockVisualStylePresets(ds),
        {
          id: newBlockVisualPresetId(),
          role: 'custom' as const,
          name: 'Nový styl',
          styles: { ...(highlight.styles as BlockVisualStyles), padding: 12 },
        },
      ];
      const bp = syncBlockPreferencesDefaultVisualWithPresets(
        { ...ds.blockPreferences, blockVisualStylePresets: list },
        list,
        ds,
      );
      return { ...ds, blockPreferences: bp };
    });
  }, [activeDesignSystem, applyDesignSystemPatch]);

  const removeBlockVisualPreset = useCallback(
    (presetId: string) => {
      if (!activeDesignSystem) return;
      applyDesignSystemPatch((ds) => {
        const cur = resolveBlockVisualStylePresets(ds);
        const target = cur.find((x) => x.id === presetId);
        if (!target || target.role !== 'custom') return ds;
        const list = cur.filter((x) => x.id !== presetId);
        let nextBp: DesignSystem['blockPreferences'] = { ...ds.blockPreferences, blockVisualStylePresets: list };
        if (nextBp.defaultBlockVisualPresetId === presetId) {
          nextBp = { ...nextBp, defaultBlockVisualPresetId: list[0]?.id };
        }
        const bp = syncBlockPreferencesDefaultVisualWithPresets(nextBp, list, ds);
        return { ...ds, blockPreferences: bp };
      });
    },
    [activeDesignSystem, applyDesignSystemPatch],
  );

  const patchVisualStyleNote = useCallback(
    (key: keyof DesignSystemVisualStyleNotes, value: string) => {
      if (!activeDesignSystem) return;
      applyDesignSystemPatch((ds) => ({
        ...ds,
        blockPreferences: {
          ...ds.blockPreferences,
          visualStyleNotes: {
            ...(ds.blockPreferences.visualStyleNotes ?? {}),
            [key]: value,
          },
        },
      }));
    },
    [activeDesignSystem, applyDesignSystemPatch],
  );

  const toggleGenerationBlockType = useCallback(
    (blockType: BlockType) => {
      if (!activeDesignSystem) return;
      const resolved = resolveGenerationBlockTypes(activeDesignSystem.blockPreferences);
      const next = new Set(resolved);
      if (next.has(blockType)) {
        next.delete(blockType);
        if (next.size === 0) {
          toast.message('Ponech aspoň jeden typ bloku.');
          return;
        }
      } else {
        next.add(blockType);
      }
      applyDesignSystemPatch((ds) => ({
        ...ds,
        blockPreferences: {
          ...ds.blockPreferences,
          generationBlockTypes: [...next],
        },
      }));
    },
    [activeDesignSystem, applyDesignSystemPatch],
  );

  const hasVisionForGenerate = useMemo(
    () => zadaniBriefAttachmentFiles.some((f) => f.kind === 'image' && Boolean(f.url?.startsWith('http'))),
    [zadaniBriefAttachmentFiles],
  );
  const canGenerate =
    !generating &&
    (brief.trim().length >= DESIGN_SYSTEM_BRIEF_MIN_CHARS || hasVisionForGenerate);

  /** Merge do existujícího záznamu vždy, když už máme uložené id (i hned po prvním vytvoření, kdy `saveMode` ještě může být `new`). */
  const existingForApi =
    activeDesignSystem?.id && !String(activeDesignSystem.id).startsWith('local-') ? activeDesignSystem : null;

  const updateReferenceImages = useCallback(
    (nextImages: DatasetFile[], opts?: { mergeBriefIds?: string[]; mergeReferenceIds?: string[] }) => {
      if (!activeDesignSystem) {
        setOrphanRefImages(nextImages);
        return;
      }
      setTeacherIllustrationRefFiles(nextImages);
      void saveTeacherIllustrationReferenceLibrary(nextImages);
      const texts = datasetTextFilesOnly(activeDesignSystem.dataset);
      const prevBrief = activeDesignSystem.dataset?.briefReferenceImageIds;
      let nextBrief: string[] | undefined;
      if (opts?.mergeBriefIds?.length) {
        const s = new Set([
          ...(prevBrief ?? []).filter((id) => nextImages.some((f) => f.id === id)),
          ...opts.mergeBriefIds.filter((id) => nextImages.some((f) => f.id === id)),
        ]);
        nextBrief = [...s];
      } else if (prevBrief != null) {
        nextBrief = prevBrief.filter((id) => nextImages.some((f) => f.id === id));
      }
      const prevRefIds = activeDesignSystem.dataset?.referenceImageIds;
      let nextRefIds: string[] | undefined;
      if (prevRefIds != null) {
        const merged = new Set(prevRefIds.filter((id) => nextImages.some((f) => f.id === id)));
        const toAdd = [...(opts?.mergeBriefIds ?? []), ...(opts?.mergeReferenceIds ?? [])];
        for (const id of toAdd) {
          if (nextImages.some((f) => f.id === id)) merged.add(id);
        }
        nextRefIds = [...merged];
      }
      const merged: DesignSystem = {
        ...activeDesignSystem,
        dataset: {
          ...activeDesignSystem.dataset,
          topic: activeDesignSystem.dataset?.topic,
          generationBrief: activeDesignSystem.dataset?.generationBrief,
          files: [...texts],
          ...(nextBrief !== undefined ? { briefReferenceImageIds: nextBrief } : {}),
          ...(nextRefIds !== undefined ? { referenceImageIds: nextRefIds } : {}),
        },
      };
      onDesignSystemChange(merged);
      schedulePersistDesignSystemToSupabase(merged);
    },
    [activeDesignSystem, onDesignSystemChange, schedulePersistDesignSystemToSupabase],
  );

  const runAutoIllustrationStyleClustering = useCallback(async () => {
    if (!activeDesignSystem) return;
    const includeAuto = activeDesignSystem.dataset?.styleClusterIncludeAutoCrops === true;
    const imgs = referenceResolutionFilesRef.current.filter((f) => {
      if (f.kind !== 'image' || !f.url?.startsWith('http') || f.referenceRole === 'layout') return false;
      if (!includeAuto && f.referenceNote === REF_NOTE_ILLUSTRATION_CROP) return false;
      return true;
    });
    const gen = ++styleClusterGenRef.current;

    if (imgs.length === 0) {
      setStyleClusterError(null);
      const hasAnyNonLayoutImage = referenceResolutionFilesRef.current.some(
        (f) =>
          f.kind === 'image' && Boolean(f.url?.startsWith('http')) && f.referenceRole !== 'layout',
      );
      if (hasAnyNonLayoutImage) {
        return;
      }
      const lib = referenceResolutionFilesRef.current;
      const nextLib = lib.map((f) => {
          if (f.kind !== 'image') return f;
          const { illustrationTags: _drop, ...rest } = f;
          return rest;
        });
      setTeacherIllustrationRefFiles(nextLib);
      void saveTeacherIllustrationReferenceLibrary(nextLib);
      applyDesignSystemPatch((ds) => {
        const filesOnlyText = datasetTextFilesOnly(ds.dataset);
        if (shouldPreserveManualIllustrationStyles(ds)) {
        return {
          ...ds,
          dataset: {
            ...ds.dataset,
            topic: ds.dataset?.topic,
            generationBrief: ds.dataset?.generationBrief,
              files: filesOnlyText,
            },
          };
        }
        return {
          ...ds,
          dataset: {
            ...ds.dataset,
            topic: ds.dataset?.topic,
            generationBrief: ds.dataset?.generationBrief,
            files: filesOnlyText,
            illustrationStyles: undefined,
            illustrationStylesFingerprint: undefined,
            illustrationStylesUserPinned: undefined,
            illustrationStyleSpotPreviews: undefined,
          },
        };
      });
      return;
    }

    setStyleClusterBusy(true);
    setStyleClusterError(null);
    try {
      const res = await assignIllustrationStylesFromDatasetImages({ images: imgs });
      if (gen !== styleClusterGenRef.current) return;
      if (!res.ok) {
        setStyleClusterError(res.message);
        return;
      }
      const fingerprint = imgs
        .map((f) => f.id)
        .sort()
        .join('|');
        const idToTags = res.imageTags;
      setTeacherIllustrationRefFiles((prev) => {
        const next = prev.map((f) => {
          if (f.kind !== 'image') return f;
          const tags = idToTags[f.id];
          const n: DatasetFile = { ...f };
          if (tags && tags.length) n.illustrationTags = tags;
          else delete (n as { illustrationTags?: string[] }).illustrationTags;
          return n;
        });
        void saveTeacherIllustrationReferenceLibrary(next);
          return next;
        });
      applyDesignSystemPatch((ds) => ({
          ...ds,
          dataset: {
            ...ds.dataset,
            topic: ds.dataset?.topic,
            generationBrief: ds.dataset?.generationBrief,
          files: datasetTextFilesOnly(ds.dataset),
            illustrationStyles: res.styles,
            illustrationStylesFingerprint: fingerprint,
            illustrationStylesUserPinned: false,
          illustrationStyleSpotPreviews: mergeIllustrationStyleSpotPreviews(
            ds.dataset?.illustrationStyleSpotPreviews,
            res.styles,
          ),
          },
      }));
    } catch (e: unknown) {
      if (gen !== styleClusterGenRef.current) return;
      setStyleClusterError(e instanceof Error ? e.message : String(e));
    } finally {
      if (gen === styleClusterGenRef.current) setStyleClusterBusy(false);
    }
  }, [activeDesignSystem, applyDesignSystemPatch, activeDesignSystem?.dataset?.styleClusterIncludeAutoCrops]);

  useEffect(() => {
    if (!activeDesignSystem) return;
    if (activeDesignSystem.dataset?.illustrationStylesUserPinned) return;
    if (
      illustrationClusterImageIdsKey.length === 0 &&
      shouldPreserveManualIllustrationStyles(activeDesignSystem)
    ) {
      return;
    }
    if (
      illustrationClusterImageIdsKey.length > 0 &&
      activeDesignSystem.dataset?.illustrationStylesFingerprint === illustrationClusterImageIdsKey &&
      (activeDesignSystem.dataset?.illustrationStyles?.length ?? 0) > 0
    ) {
      return;
    }
    const t = setTimeout(() => {
      void runAutoIllustrationStyleClustering();
    }, 1200);
    return () => clearTimeout(t);
  }, [
    activeDesignSystem?.id,
    activeDesignSystem?.dataset?.illustrationStylesFingerprint,
    activeDesignSystem?.dataset?.illustrationStyles?.length,
    activeDesignSystem?.dataset?.illustrationStylesUserPinned,
    illustrationClusterImageIdsKey,
    activeDesignSystem?.dataset?.styleClusterIncludeAutoCrops,
    runAutoIllustrationStyleClustering,
  ]);

  /** Odstraní ze stylů odkazy na soubory označené jako layout (oprava starších dat po chybném seskupení). */
  useEffect(() => {
    if (!activeDesignSystem?.dataset?.illustrationStyles?.length) return;
    const styles = activeDesignSystem.dataset.illustrationStyles;
    const hasLayoutInStyle = styles.some((st) =>
      st.imageIds.some((id) => referenceFileById.get(id)?.referenceRole === 'layout'),
    );
    if (!hasLayoutInStyle) return;
    const nextStyles = styles
      .map((st) => ({
        ...st,
        imageIds: st.imageIds.filter((id) => referenceFileById.get(id)?.referenceRole !== 'layout'),
      }))
      .filter((st) => st.imageIds.length > 0);
    applyDesignSystemPatch((ds) => ({
      ...ds,
      dataset: {
        ...ds.dataset,
        topic: ds.dataset?.topic,
        generationBrief: ds.dataset?.generationBrief,
        files: [...datasetTextFilesOnly(ds.dataset)],
        illustrationStyles: nextStyles.length ? nextStyles : undefined,
        illustrationStylesFingerprint: nextStyles.length ? illustrationClusterImageIdsKey : undefined,
        illustrationStyleSpotPreviews: mergeIllustrationStyleSpotPreviews(
          ds.dataset?.illustrationStyleSpotPreviews,
          nextStyles.length ? nextStyles : [],
        ),
      },
    }));
  }, [
    activeDesignSystem?.dataset?.illustrationStyles,
    referenceFileById,
    applyDesignSystemPatch,
    illustrationClusterImageIdsKey,
  ]);

  const buildDatasetForGenerate = useCallback((): DesignSystemDataset => {
    const texts = (activeDesignSystem?.dataset?.files ?? []).filter((f) => f.kind === 'text');
    const images = activeDesignSystem
      ? teacherIllustrationRefReady
        ? zadaniBriefAttachmentFiles
        : (activeDesignSystem.dataset?.files ?? []).filter((f) => f.kind === 'image')
      : orphanRefImages;
    return {
      files: [...texts, ...images],
      topic: activeDesignSystem?.dataset?.topic,
      generationBrief: activeDesignSystem?.dataset?.generationBrief,
      briefReferenceImageIds: activeDesignSystem?.dataset?.briefReferenceImageIds,
      styleClusterIncludeAutoCrops: activeDesignSystem?.dataset?.styleClusterIncludeAutoCrops,
      referenceImageIds: activeDesignSystem?.dataset?.referenceImageIds,
      illustrationStyles: activeDesignSystem?.dataset?.illustrationStyles,
      illustrationStylesFingerprint: activeDesignSystem?.dataset?.illustrationStylesFingerprint,
      illustrationStylesUserPinned: activeDesignSystem?.dataset?.illustrationStylesUserPinned,
      illustrationStyleSpotPreviews: activeDesignSystem?.dataset?.illustrationStyleSpotPreviews,
      illustrationStyleProposals: activeDesignSystem?.dataset?.illustrationStyleProposals,
    };
  }, [activeDesignSystem, orphanRefImages, teacherIllustrationRefReady, zadaniBriefAttachmentFiles]);

  const handleReferenceFilesChosen = useCallback(
    async (list: FileList | null) => {
      if (!list?.length) return;
      if (teacherIllustrationRefFiles.length >= MAX_REFERENCE_IMAGES) {
        toast.error(`Nejvýše ${MAX_REFERENCE_IMAGES} referenčních obrázků.`);
        return;
      }
      setReferenceUploading(true);
      try {
        let next = [...teacherIllustrationRefFiles];
        const mergeBriefIds: string[] = [];
        for (const file of Array.from(list)) {
          if (next.length >= MAX_REFERENCE_IMAGES) break;
          if (!file.type.startsWith('image/')) continue;
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('read'));
            reader.readAsDataURL(file);
          });
          const url = await processImageUrl(dataUrl, `ds-ref-${Date.now()}`, 'design-system-refs');
          if (!url) {
            toast.error(`Nahrání „${file.name}“ selhalo.`);
            continue;
          }
          const baseEntry: DatasetFile = {
            id: `ds-img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            name: file.name.slice(0, 120),
            kind: 'image',
            url,
            mimeType: file.type,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            referenceNote: '',
          };
          const slotsRemaining = MAX_REFERENCE_IMAGES - next.length;
          if (slotsRemaining < 1) break;
          const enriched = await enrichUploadedDesignSystemReference(baseEntry, slotsRemaining);
          for (const f of enriched) {
            if (next.length >= MAX_REFERENCE_IMAGES) break;
            next.push(f);
            mergeBriefIds.push(f.id);
          }
        }
        if (mergeBriefIds.length > 0) updateReferenceImages(next, { mergeBriefIds });
      } catch {
        toast.error('Načtení souboru se nezdařilo.');
      } finally {
        setReferenceUploading(false);
        if (referenceFileInputRef.current) referenceFileInputRef.current.value = '';
      }
    },
    [teacherIllustrationRefFiles, updateReferenceImages],
  );

  const removeOnboardingAttachment = useCallback(
    (id: string) => {
      if (!activeDesignSystem) return;
      const briefIds = activeDesignSystem.dataset?.briefReferenceImageIds;
      const fromDs = (activeDesignSystem.dataset?.files ?? []).filter((f) => f.kind === 'image');
      if (briefIds != null) {
        applyDesignSystemPatch((ds) => ({
          ...ds,
          dataset: {
            ...ds.dataset,
            topic: ds.dataset?.topic,
            generationBrief: ds.dataset?.generationBrief,
            files: ds.dataset?.files ?? [],
            briefReferenceImageIds: (ds.dataset?.briefReferenceImageIds ?? []).filter((x) => x !== id),
          },
        }));
        return;
      }
      if (fromDs.length > 0) {
        const nextFiles = (activeDesignSystem.dataset?.files ?? []).filter((f) => f.id !== id);
        applyDesignSystemPatch((ds) => ({
          ...ds,
          dataset: {
            ...ds.dataset,
            topic: ds.dataset?.topic,
            generationBrief: ds.dataset?.generationBrief,
            files: nextFiles,
          },
        }));
        updateReferenceImages(referenceResolutionFiles.filter((f) => f.id !== id));
        return;
      }
      updateReferenceImages(referenceResolutionFiles.filter((f) => f.id !== id));
    },
    [activeDesignSystem, applyDesignSystemPatch, referenceResolutionFiles, updateReferenceImages],
  );

  const openOnboardingFilePicker = useCallback(() => {
    if (referenceUploading || referenceResolutionFiles.length >= MAX_REFERENCE_IMAGES) return;
    referenceFileInputRef.current?.click();
  }, [referenceUploading, referenceResolutionFiles.length]);

  const handleExtractIllustrationsFromLayout = useCallback(
    async (f: DatasetFile) => {
      if (!f.url?.startsWith('http')) return;
      if (f.referenceRole === 'illustration') return;
      const slots = MAX_REFERENCE_IMAGES - referenceResolutionFiles.length;
      if (slots < 1) {
        toast.error(`Nejvýše ${MAX_REFERENCE_IMAGES} referenčních obrázků — smaž některé.`);
        return;
      }
      setLayoutExtractBusyId(f.id);
      try {
        const newCrops = await appendIllustrationCropsFromLayoutPageUrl(f.url, f.name, slots);
        if (newCrops.length === 0) {
          toast.message('Žádné ilustrace k výřezu, nebo ořez selhal.');
          return;
        }
        updateReferenceImages([...referenceResolutionFiles, ...newCrops], {
          mergeReferenceIds: newCrops.map((c) => c.id),
        });
        toast.success(`Přidáno ${newCrops.length} referenčních výřezů.`);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Výřez ilustrací selhal.');
      } finally {
        setLayoutExtractBusyId(null);
      }
    },
    [referenceResolutionFiles, updateReferenceImages],
  );

  const runStyleExampleGeneration = useCallback(
    async (mode: StyleExamplePromptVariant) => {
      if (!activeDesignSystem || exampleImageBusyRef.current) return;
      if (mode === 'sameReference' && !styleExampleImageUrl?.startsWith('http')) {
        toast.error('Nejdřív vygeneruj příklad — chybí referenční obrázek.');
        return;
      }
    exampleImageBusyRef.current = true;
    setStyleExampleLoading(true);
    try {
      const subject =
        STYLE_EXAMPLE_SUBJECTS_CZ[Math.floor(Math.random() * STYLE_EXAMPLE_SUBJECTS_CZ.length)] ?? 'Výjev z přírody';
        const promptVariant: StyleExamplePromptVariant =
          mode === 'sameReference' ? 'sameReference' : mode === 'alternate' ? 'alternate' : 'default';
        const prompt = buildExampleIllustrationPrompt(subject, activeDesignSystem.aiPrompts, promptVariant);

        const baseOpts = {
          aspectRatio: '4:3' as const,
        numberOfImages: 1,
        model: DS_IMAGE_GEN_MODEL,
        illustrationName: `ds-style-example-${Date.now()}`,
        referencePickerPrompt: subject,
        };

        const result = await generateImageWithImagen(
          prompt,
          mode === 'sameReference'
            ? {
                ...baseOpts,
                referenceImageUrl: styleExampleImageUrl!,
              }
            : mode === 'alternate'
              ? {
                  ...baseOpts,
                }
              : {
                  ...baseOpts,
                  designSystemReferenceFiles: referenceResolutionFiles.length ? referenceResolutionFiles : undefined,
                },
        );
      const url = result.url || result.imageUrl;
      if (!result.success || !url) {
        toast.error(result.error || 'Generování příkladu se nezdařilo.');
        return;
      }
        setStyleExampleSubject(subject);
        setStyleExamplePrompt(prompt);
      setStyleExampleImageUrl(url);
        toast.success(
          mode === 'alternate'
            ? `Příklad v jiném stylu: ${subject}`
            : mode === 'sameReference'
              ? `Nová scéna ve stejném stylu: ${subject}`
              : `Příklad: ${subject}`,
        );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || 'Generování příkladu selhalo.');
    } finally {
      exampleImageBusyRef.current = false;
      setStyleExampleLoading(false);
    }
    },
    [activeDesignSystem, referenceResolutionFiles, styleExampleImageUrl],
  );

  const handleGenerateStyleExample = useCallback(async () => {
    await runStyleExampleGeneration('default');
  }, [runStyleExampleGeneration]);

  const handleSaveStyleExampleToDataset = useCallback(() => {
    if (!activeDesignSystem || !styleExampleImageUrl?.startsWith('http')) {
      toast.error('Není co uložit — vygeneruj nejdřív příklad.');
      return;
    }
    if (referenceResolutionFiles.length >= MAX_REFERENCE_IMAGES) {
      toast.error(`Nejvýše ${MAX_REFERENCE_IMAGES} referenčních obrázků.`);
      return;
    }
    const dup = referenceResolutionFiles.some(
      (f) => f.kind === 'image' && normalizeDatasetImageUrl(f.url) === normalizeDatasetImageUrl(styleExampleImageUrl),
    );
    if (dup) {
      toast.message('Tento obrázek už v datasetu je.');
      return;
    }
    const safeBase = (styleExampleSubject ?? 'priklad-ai').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().slice(0, 60);
    const noteLines = [
      styleExampleSubject ? `Motiv: ${styleExampleSubject}` : null,
      styleExamplePrompt ? `--- prompt ---\n${styleExamplePrompt}` : null,
    ].filter(Boolean);
    const referenceNote = noteLines.join('\n\n').slice(0, 4000);
    const added: DatasetFile = {
      id: `ds-img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: `${safeBase || 'ai-priklad'}.png`,
      kind: 'image',
      url: styleExampleImageUrl,
      mimeType: 'image/png',
      uploadedAt: new Date().toISOString(),
      referenceRole: 'illustration',
      referenceNote: referenceNote || 'AI příklad — bez uloženého promptu',
    };
    const stylesNow = activeDesignSystem.dataset?.illustrationStyles ?? [];
    const targetStyleId =
      aiStyleDetailOpenId && stylesNow.some((s) => s.id === aiStyleDetailOpenId)
        ? aiStyleDetailOpenId
        : stylesNow[0]?.id;

    setTeacherIllustrationRefFiles((prev) => {
      const next = [...prev, added];
      void saveTeacherIllustrationReferenceLibrary(next);
      return next;
    });
    applyDesignSystemPatch((ds) => {
      const texts = datasetTextFilesOnly(ds.dataset);
      const styles = ds.dataset?.illustrationStyles ?? [];
      let nextStyles = styles;
      if (targetStyleId) {
        nextStyles = styles.map((s) =>
          s.id === targetStyleId ? { ...s, imageIds: [...new Set([...s.imageIds, added.id])] } : s,
        );
      }
      const nextRef = mergeScopedReferenceImageIds(ds.dataset, [added.id]);
      return {
        ...ds,
        dataset: {
          ...ds.dataset,
          topic: ds.dataset?.topic,
          generationBrief: ds.dataset?.generationBrief,
          files: [...texts],
          illustrationStyles: nextStyles,
          ...(targetStyleId ? { illustrationStylesUserPinned: true } : {}),
          ...(nextRef !== undefined ? { referenceImageIds: nextRef } : {}),
        },
      };
    });
    toast.success(
      targetStyleId
        ? 'Příklad uložen a připojen k ilustračnímu stylu (náhled v mřížce).'
        : 'Příklad s promptem uložen do datasetu — přidej ilustrační styl, aby se obrázek ukázal v mřížce stylů.',
    );
  }, [
    activeDesignSystem,
    referenceResolutionFiles,
    styleExampleImageUrl,
    styleExamplePrompt,
    styleExampleSubject,
    aiStyleDetailOpenId,
    applyDesignSystemPatch,
  ]);

  const handleGenerateStyleSpotPreview = useCallback(
    async (st: DatasetIllustrationStyle) => {
      if (!activeDesignSystem || styleSpotBusyRef.current) return;
      const hint = st.promptHint?.trim();
      if (!hint) {
        toast.message('U tohoto stylu zatím chybí prompt — počkej na dokončení AI nebo obnov seskupení.');
        return;
      }
      styleSpotBusyRef.current = true;
      setStyleSpotLoadingStyleId(st.id);
      try {
        const subject =
          STYLE_EXAMPLE_SUBJECTS_CZ[Math.floor(Math.random() * STYLE_EXAMPLE_SUBJECTS_CZ.length)] ??
          'Výjev z přírody';
        const randomDirectiveEn =
          STYLE_SPOT_RANDOM_DIRECTIVES_EN[
            Math.floor(Math.random() * STYLE_SPOT_RANDOM_DIRECTIVES_EN.length)
          ] ?? '';
        const filesInStyle = st.imageIds
          .map((id) => referenceFileById.get(id))
          .filter((x): x is DatasetFile => Boolean(x))
          .filter((f) => f.referenceRole !== 'layout');
        const prompt = buildStyleCategorySpotPrompt(subject, hint, randomDirectiveEn);
        const result = await generateImageWithImagen(prompt, {
          aspectRatio: '4:3',
          numberOfImages: 1,
          model: DS_IMAGE_GEN_MODEL,
          illustrationName: `ds-style-spot-${st.id}-${Date.now()}`,
          designSystemReferenceFiles: filesInStyle.length ? filesInStyle : undefined,
          referencePickerPrompt: `${subject}\n${randomDirectiveEn}`,
        });
        const urlRaw = result.url || result.imageUrl;
        const url = typeof urlRaw === 'string' && urlRaw.startsWith('http') ? urlRaw.trim() : '';
        if (!result.success || !url) {
          toast.error(result.error || 'Generování náhledu se nezdařilo.');
          return;
        }
        const imageFiles = referenceResolutionFilesRef.current;
        const nextSpotPreviews = {
          ...((activeDesignSystem.dataset?.illustrationStyleSpotPreviews ?? {}) as NonNullable<
            DesignSystemDataset['illustrationStyleSpotPreviews']
          >),
          [st.id]: { url, subject, randomDirectiveEn },
        };
        let nextStyles = (activeDesignSystem.dataset?.illustrationStyles ?? []).map((s) => ({ ...s }));

        const existingByUrl = imageFiles.find(
          (f) => f.kind === 'image' && normalizeDatasetImageUrl(f.url) === normalizeDatasetImageUrl(url),
        );
        let addedNewReferenceId: string | undefined;
        if (existingByUrl) {
          nextStyles = nextStyles.map((s) =>
            s.id === st.id
              ? { ...s, imageIds: [...new Set([...s.imageIds, existingByUrl.id])] }
              : s,
          );
        } else if (imageFiles.length < MAX_REFERENCE_IMAGES) {
          const newId = `ds-img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          addedNewReferenceId = newId;
          const baseName = st.name.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().slice(0, 40) || 'styl';
          const newFile: DatasetFile = {
            id: newId,
            name: `${baseName}-nahled.png`,
            kind: 'image',
            url,
            mimeType: 'image/png',
            uploadedAt: new Date().toISOString(),
            referenceRole: 'illustration',
            referenceNote: `náhled stylu — ${subject}`.slice(0, 4000),
          };
          const nextLib = [...imageFiles, newFile];
          setTeacherIllustrationRefFiles(nextLib);
          void saveTeacherIllustrationReferenceLibrary(nextLib);
          nextStyles = nextStyles.map((s) =>
            s.id === st.id ? { ...s, imageIds: [...new Set([...s.imageIds, newId])] } : s,
          );
        }

        applyDesignSystemPatch((ds) => {
          const d0 = ds.dataset ?? { files: [] };
          const texts = d0.files.filter((f) => f.kind === 'text');
          const nextRef =
            addedNewReferenceId != null
              ? mergeScopedReferenceImageIds(ds.dataset, [addedNewReferenceId])
              : undefined;
          return {
          ...ds,
          dataset: {
              ...d0,
              files: [...texts],
              illustrationStyles: nextStyles,
              illustrationStyleSpotPreviews: nextSpotPreviews,
              illustrationStylesUserPinned: true,
              ...(nextRef !== undefined ? { referenceImageIds: nextRef } : {}),
            },
          };
        });
        toast.success(`Náhled „${st.name}“ uložen: ${subject}`);
        const preImages = referenceResolutionFilesRef.current.filter((f) => f.kind === 'image');
        const hadSameUrl = preImages.some(
          (f) => normalizeDatasetImageUrl(f.url) === normalizeDatasetImageUrl(url),
        );
        if (preImages.length >= MAX_REFERENCE_IMAGES && !hadSameUrl) {
          toast.message(
            `V datasetu je už ${MAX_REFERENCE_IMAGES} obrázků — náhled se neuložil mezi reference (limit). Smaž jeden referenční obrázek v přílohách u zadání, pak klepni „Uložit do stylu (dataset)“.`,
            { duration: 10000 },
          );
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(msg || 'Generování náhledu selhalo.');
      } finally {
        styleSpotBusyRef.current = false;
        setStyleSpotLoadingStyleId(null);
      }
    },
    [activeDesignSystem, referenceFileById, applyDesignSystemPatch],
  );

  const handleUnpinAndReclusterIllustrationStyles = useCallback(() => {
    if (!activeDesignSystem) return;
    applyDesignSystemPatch((ds) => ({
      ...ds,
      dataset: {
        ...ds.dataset,
        topic: ds.dataset?.topic,
        generationBrief: ds.dataset?.generationBrief,
        files: datasetTextFilesOnly(ds.dataset),
        illustrationStylesUserPinned: false,
        illustrationStylesFingerprint: undefined,
      },
    }));
    toast.message('Za ~1 s znovu přiřadí styly AI.');
  }, [activeDesignSystem, applyDesignSystemPatch]);

  const handleAddImageToIllustrationStyle = useCallback(
    async (styleId: string, list: FileList | null) => {
      if (!styleId || !list?.length || !activeDesignSystem) return;
      if (!(activeDesignSystem.dataset?.illustrationStyles ?? []).some((s) => s.id === styleId)) {
        toast.error('Styl neexistuje.');
        return;
      }
      const file = list[0];
      if (!file.type.startsWith('image/')) {
        toast.error('Vyber obrázek.');
        return;
      }
      if (referenceResolutionFiles.length >= MAX_REFERENCE_IMAGES) {
        toast.error(`Nejvýše ${MAX_REFERENCE_IMAGES} referenčních obrázků.`);
        return;
      }
      setReferenceUploading(true);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('read'));
          reader.readAsDataURL(file);
        });
        const url = await processImageUrl(dataUrl, `ds-ref-style-${Date.now()}`, 'design-system-refs');
        if (!url) {
          toast.error('Nahrání selhalo.');
          return;
        }
        const baseEntry: DatasetFile = {
          id: `ds-img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: file.name.slice(0, 120),
          kind: 'image',
          url,
          mimeType: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          referenceNote: '',
        };
        const slotsRemaining = MAX_REFERENCE_IMAGES - referenceResolutionFiles.length;
        const enriched = await enrichUploadedDesignSystemReference(baseEntry, slotsRemaining);
        const raw = enriched[0];
        if (!raw) return;
        const added: DatasetFile = {
          ...raw,
          referenceRole: 'illustration',
          referenceNote: raw.referenceNote?.trim() || 'reference doplněná ke stylu',
        };
        setTeacherIllustrationRefFiles((prev) => {
          const next = [...prev, added];
          void saveTeacherIllustrationReferenceLibrary(next);
          return next;
        });
        applyDesignSystemPatch((ds) => {
          const texts = datasetTextFilesOnly(ds.dataset);
          const styles = (ds.dataset?.illustrationStyles ?? []).map((s) =>
            s.id === styleId ? { ...s, imageIds: [...s.imageIds, added.id] } : s,
          );
          const nextRef = mergeScopedReferenceImageIds(ds.dataset, [added.id]);
          return {
            ...ds,
            dataset: {
              ...ds.dataset,
              topic: ds.dataset?.topic,
              generationBrief: ds.dataset?.generationBrief,
              files: [...texts],
              illustrationStyles: styles,
              illustrationStylesUserPinned: true,
              ...(nextRef !== undefined ? { referenceImageIds: nextRef } : {}),
            },
          };
        });
        toast.success('Obrázek přidán ke stylu.');
      } catch {
        toast.error('Nahrání se nezdařilo.');
      } finally {
        setReferenceUploading(false);
      }
    },
    [activeDesignSystem, applyDesignSystemPatch, referenceResolutionFiles.length],
  );

  const openStyleImageUpload = useCallback((styleId: string) => {
    styleUploadTargetIdRef.current = styleId;
    styleExtraFileInputRef.current?.click();
  }, []);

  const handleAddIllustrationProposalAsStyle = useCallback(
    (p: IllustrationStyleProposal) => {
      if (!activeDesignSystem) return;
      const hint = [p.promptHint, p.negativePromptHint ? `Avoid: ${p.negativePromptHint}` : ''].filter(Boolean).join('\n\n');
      const newStyle: DatasetIllustrationStyle = {
        id: `style-from-proposal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: p.name,
        promptHint: hint,
        imageIds: [],
        source: 'user',
      };
      applyDesignSystemPatch((ds) => {
        const proposals = (ds.dataset?.illustrationStyleProposals ?? []).filter((x) => x.id !== p.id);
        const nextDataset: DesignSystemDataset = {
          ...ds.dataset,
          topic: ds.dataset?.topic,
          generationBrief: ds.dataset?.generationBrief,
          files: ds.dataset?.files ?? [],
          illustrationStyles: [...(ds.dataset?.illustrationStyles ?? []), newStyle],
          illustrationStylesUserPinned: true,
        };
        if (proposals.length > 0) nextDataset.illustrationStyleProposals = proposals;
        else delete nextDataset.illustrationStyleProposals;
        return { ...ds, dataset: nextDataset };
      });
      toast.success('Styl přidán mezi ilustrační styly — můžeš doplnit referenční obrázky.');
    },
    [activeDesignSystem, applyDesignSystemPatch],
  );

  const handleApplyPresetIllustrationStyle = useCallback(
    (preset: PresetIllustrationStyleDefinition) => {
      if (!activeDesignSystem) return;
      const sid = presetStyleDatasetId(preset.id);
      const hint = [preset.promptHint, preset.negativePromptHint ? `Avoid: ${preset.negativePromptHint}` : '']
        .filter(Boolean)
        .join('\n\n');
      const newStyle: DatasetIllustrationStyle = {
        id: sid,
        name: preset.name,
        promptHint: hint,
        imageIds: [],
        source: 'user',
      };
      applyDesignSystemPatch((ds) => {
        const existing = ds.dataset?.illustrationStyles ?? [];
        const withoutDup = existing.filter((s) => s.id !== sid);
        return {
          ...ds,
          aiPrompts: {
            ...ds.aiPrompts,
            imageStyle: preset.promptHint,
            negativePrompt: preset.negativePromptHint ?? ds.aiPrompts.negativePrompt ?? '',
            characterStyle: ds.aiPrompts.characterStyle,
          },
          dataset: {
            ...ds.dataset,
            topic: ds.dataset?.topic,
            generationBrief: ds.dataset?.generationBrief,
            files: ds.dataset?.files ?? [],
            illustrationStyles: [...withoutDup, newStyle],
            illustrationStylesUserPinned: true,
          },
        };
      });
      toast.success(`Styl „${preset.name}“ je nastaven a přidán mezi ilustrační styly.`);
      setPresetStylesPickerOpen(false);
      setAiStyleDetailOpenId(sid);
    },
    [activeDesignSystem, applyDesignSystemPatch],
  );

  const handleRecommendPresetFromBrief = useCallback(async () => {
    const t = brief.trim();
    if (t.length < 15) {
      toast.message('Napiš krátký popis knihy nebo vizuálu (aspoň 15 znaků).');
      return;
    }
    if (!activeDesignSystem) return;
    setPresetFromPromptBusy(true);
    setPresetFromPromptResult(null);
    try {
      const r = await recommendPresetIllustrationStylesFromPrompt(t);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setPresetFromPromptResult({
        recommendations: r.recommendations,
        summaryCz: r.summaryCz,
      });
      if (r.summaryCz) {
        toast.message(r.summaryCz);
      } else {
        toast.success('Vyber styl z nabídky níže.');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setPresetFromPromptBusy(false);
    }
  }, [brief, activeDesignSystem]);

  const applyRecommendedPresetById = useCallback(
    (presetId: string) => {
      const def = PRESET_ILLUSTRATION_STYLES.find((p) => p.id === presetId);
      if (def) handleApplyPresetIllustrationStyle(def);
    },
    [handleApplyPresetIllustrationStyle],
  );

  /** Přidá aktuální náhled ověření stylu (URL ze Storage) mezi reference daného stylu. */
  const handleSaveSpotPreviewToStyleDataset = useCallback(
    (styleId: string) => {
      if (!activeDesignSystem) return;
      const spot = activeDesignSystem.dataset?.illustrationStyleSpotPreviews?.[styleId];
      if (!spot?.url?.startsWith('http')) {
        toast.error('Žádný uložitelný náhled — nejdřív vygeneruj náhodnou ilustraci.');
        return;
      }
      const allFiles = referenceResolutionFilesRef.current;
      const spotNorm = normalizeDatasetImageUrl(spot.url);
      const existingByUrl = allFiles.find(
        (f) => f.kind === 'image' && normalizeDatasetImageUrl(f.url) === spotNorm,
      );
      const styleRow = (activeDesignSystem.dataset?.illustrationStyles ?? []).find((s) => s.id === styleId);
      const alreadyLinked = existingByUrl && styleRow?.imageIds.includes(existingByUrl.id);

      if (existingByUrl && alreadyLinked) {
        toast.message('Tento obrázek už u tohoto stylu v datasetu je.');
        return;
      }

      if (existingByUrl && !alreadyLinked) {
        applyDesignSystemPatch((ds) => ({
          ...ds,
          dataset: {
            ...ds.dataset,
            topic: ds.dataset?.topic,
            generationBrief: ds.dataset?.generationBrief,
            files: ds.dataset?.files ?? [],
            illustrationStyles: (ds.dataset?.illustrationStyles ?? []).map((s) =>
              s.id === styleId
                ? { ...s, imageIds: [...new Set([...s.imageIds, existingByUrl.id])] }
                : s,
            ),
            illustrationStylesUserPinned: true,
          },
        }));
        toast.success('Obrázek připojen ke stylu (už byl v datasetu).');
        return;
      }

      if (referenceResolutionFiles.length >= MAX_REFERENCE_IMAGES) {
        toast.error(
          `Dosáhl jsi ${MAX_REFERENCE_IMAGES} referenčních obrázků — smaž jeden v přílohách nebo u stylu, pak ulož náhled znovu.`,
        );
        return;
      }

      const newId = `ds-img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const safeBase = spot.subject.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().slice(0, 60);
      const added: DatasetFile = {
        id: newId,
        name: `${safeBase || 'nahled-stylu'}.png`,
        kind: 'image',
        url: spot.url,
        mimeType: 'image/png',
        uploadedAt: new Date().toISOString(),
        referenceRole: 'illustration',
        referenceNote: spot.randomDirectiveEn
          ? `náhled ověření stylu — ${spot.subject} | ${spot.randomDirectiveEn}`
          : `náhled ověření stylu — ${spot.subject}`,
      };
      setTeacherIllustrationRefFiles((prev) => {
        const next = [...prev, added];
        void saveTeacherIllustrationReferenceLibrary(next);
        return next;
      });
      applyDesignSystemPatch((ds) => {
        const texts = datasetTextFilesOnly(ds.dataset);
        const styles = (ds.dataset?.illustrationStyles ?? []).map((s) =>
          s.id === styleId ? { ...s, imageIds: [...s.imageIds, added.id] } : s,
        );
        const nextRef = mergeScopedReferenceImageIds(ds.dataset, [added.id]);
        return {
          ...ds,
          dataset: {
            ...ds.dataset,
            topic: ds.dataset?.topic,
            generationBrief: ds.dataset?.generationBrief,
            files: [...texts],
            illustrationStyles: styles,
            illustrationStylesUserPinned: true,
            ...(nextRef !== undefined ? { referenceImageIds: nextRef } : {}),
          },
        };
      });
      toast.success('Náhled uložen do referencí stylu.');
    },
    [activeDesignSystem, applyDesignSystemPatch, referenceResolutionFiles.length],
  );

  const handlePipelineEvent = useCallback((e: DesignSystemPipelineEvent) => {
    setPipelineLog((prev) => {
      const i = prev.findIndex((s) => s.stepId === e.stepId);
      if (i === -1) return [...prev, { ...e }];
      const next = [...prev];
      next[i] = { ...next[i], ...e };
      return next;
    });
  }, []);

  const persistBriefToDataset = useCallback(() => {
    if (!activeDesignSystem) return;
    const next = brief.trim();
    const prev = (activeDesignSystem.dataset?.generationBrief ?? '').trim();
    if (next === prev) return;
    applyDesignSystemPatch((ds) => ({
      ...ds,
      dataset: {
        ...ds.dataset,
        topic: ds.dataset?.topic,
        files: [...datasetTextFilesOnly(ds.dataset)],
        generationBrief: next,
      },
    }));
  }, [activeDesignSystem, brief, applyDesignSystemPatch]);

  const handleGenerate = useCallback(async () => {
    const trimmed = brief.trim();
    const hasVision = zadaniBriefAttachmentFiles.some((f) => f.kind === 'image' && Boolean(f.url?.startsWith('http')));
    if ((!hasVision && trimmed.length < DESIGN_SYSTEM_BRIEF_MIN_CHARS) || generateBusyRef.current) return;
    generateBusyRef.current = true;
    setGenerating(true);
    setPipelineLog([]);
    try {
      const r = await generateAndSaveDesignSystemFromBrief(trimmed, existingForApi, {
        dataset: buildDatasetForGenerate(),
        onPipelineEvent: handlePipelineEvent,
      });
      if (r.ok === false) {
        toast.error(r.message);
        return;
      }
      onDesignSystemChange(r.designSystem);
      setSaveMode('update');
      toast.success(
        saveMode === 'update'
          ? `Uloženo do „${r.designSystem.name}“ — náhled na plátně.`
          : `Nový design systém „${r.designSystem.name}“ vytvořen.`,
      );
    } finally {
      generateBusyRef.current = false;
      setGenerating(false);
    }
  }, [
    brief,
    buildDatasetForGenerate,
    existingForApi,
    handlePipelineEvent,
    onDesignSystemChange,
    zadaniBriefAttachmentFiles,
    saveMode,
  ]);

  const palettePreview = useMemo(() => {
    if (!activeDesignSystem?.colors?.length) return null;
    const items: { groupId: string; swatch: ColorSwatch }[] = [];
    for (const g of activeDesignSystem.colors) {
      for (const s of g.swatches ?? []) {
        items.push({ groupId: g.id, swatch: s });
      }
    }
    if (!items.length) return null;
    return items.slice(0, 8);
  }, [activeDesignSystem]);

  /** Layouty navázané na `pageLayoutGroups` — v sekundárním seznamu je nezobrazovat znovu. */
  const primaryLinkedCustomLayoutIds = useMemo(
    () =>
      new Set(
        (activeDesignSystem?.blockPreferences?.pageLayoutGroups ?? []).map((g) =>
          pageLayoutGroupCustomLayoutId(g.id),
        ),
      ),
    [activeDesignSystem],
  );

  const layoutBucketsSecondary = useMemo(() => {
    const list = (activeDesignSystem?.blockPreferences?.customLayouts ?? []).filter(
      (cl) => !primaryLinkedCustomLayoutIds.has(cl.id),
    );
    const buckets: Record<LayoutSeriesGroup | 'other', CustomLayout[]> = {
      column: [],
      half: [],
      twothirds: [],
      other: [],
    };
    for (const cl of list) {
      const g =
        cl.layoutGroup === 'column' || cl.layoutGroup === 'half' || cl.layoutGroup === 'twothirds'
          ? cl.layoutGroup
          : 'other';
      buckets[g].push(cl);
    }
    return buckets;
  }, [activeDesignSystem, primaryLinkedCustomLayoutIds]);

  const flowPreviewWorksheet = useMemo(
    () =>
      activeDesignSystem
        ? buildDesignSystemFlowPreviewWorksheet(activeDesignSystem, {
            refreshKey: previewRefreshKey,
            maxLayoutPages: 8,
            styleExampleUrl: styleExampleImageUrl,
          })
        : null,
    [activeDesignSystem, previewRefreshKey, styleExampleImageUrl],
  );

  const handleOpenFlowPageInEditor = useCallback(
    (worksheet: Worksheet, pageIndex: number) => {
      if (!bookEditorContext) return;
      navigate(
        buildStashedWorksheetEditorUrl(worksheet, {
          pageIndex,
          pageFormat: bookEditorContext.pageFormat,
          bookId: bookEditorContext.bookId,
          workbookId: bookEditorContext.workbookId,
        }),
      );
    },
    [bookEditorContext, navigate],
  );

  const selectDesignSystemFromLibrary = useCallback(
    (ds: DesignSystem | null) => {
      onDesignSystemChange(ds);
      if (ds) setSaveMode('update');
      else setSaveMode('new');
      setLibraryDropdownOpen(false);
      setOnboardingLibraryOpen(false);
    },
    [onDesignSystemChange],
  );

  const handleApplyDesignSystemToBook = useCallback(() => {
    if (!activeDesignSystem || !onApplyToBook) return;
    if (!activeDesignSystem.id || String(activeDesignSystem.id).startsWith('local-')) {
      toast.info('Nejprve design systém ulož do knihovny (Uložit).');
      return;
    }
    void Promise.resolve(onApplyToBook(activeDesignSystem)).catch(() => {
      /* toast z parent */
    });
  }, [activeDesignSystem, onApplyToBook]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ backgroundColor: '#0a0e14' }}>
      <input
        ref={referenceFileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => void handleReferenceFilesChosen(e.target.files)}
      />
      <DesignSystemAgentLogPanel visible={generating || pipelineLog.length > 0} steps={pipelineLog} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {activeDesignSystem ? (
            <div
              ref={libraryDropdownRef}
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                zIndex: 220,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 8,
                maxWidth: 'min(100%, calc(100vw - 24px))',
              }}
            >
              <button
                type="button"
                aria-expanded={libraryDropdownOpen}
                aria-haspopup="listbox"
                onClick={() => setLibraryDropdownOpen((o) => !o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 200,
                  maxWidth: 'min(320px, calc(100vw - 100px))',
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(71, 85, 105, 0.95)',
                  backgroundColor: 'rgba(30, 41, 59, 0.96)',
                  color: '#f1f5f9',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
                }}
              >
                <span style={{ flex: 1, minWidth: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {clipText(activeDesignSystem.name, 36)}
                </span>
                <ChevronDown
                  size={16}
                  style={{
                    flexShrink: 0,
                    color: '#94a3b8',
                    transform: libraryDropdownOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
                  }}
                />
              </button>
              {bookEditorContext && onApplyToBook ? (
                <button
                  type="button"
                  onClick={handleApplyDesignSystemToBook}
                  title="Nastaví tento design systém jako styl knihy a propíše ho do stránek"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(34, 197, 94, 0.45)',
                    backgroundColor: 'rgba(15, 42, 26, 0.92)',
                    color: '#4ade80',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Check size={14} strokeWidth={2.5} />
                  Aplikovat na knihu
                </button>
              ) : null}
              {libraryDropdownOpen ? (
                <DesignSystemLibraryMenuList
                  libraryLoading={libraryLoading}
                  libraryList={libraryList}
                  activeDesignSystem={activeDesignSystem}
                  selectDesignSystemFromLibrary={selectDesignSystemFromLibrary}
                />
              ) : null}
            </div>
          ) : null}

          <div className="relative min-h-0 flex-1">
            <InfiniteCanvas initialZoom={0.72} showControls showDotGrid dotGridSize={22}>
        <div style={{ position: 'relative', width: 3200, minHeight: 2200, height: 4800 }}>
          {activeDesignSystem ? (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: CANVAS_ZADANI_LEFT,
                  top: -72,
                  right: 80,
                  zIndex: 50,
                  pointerEvents: 'none',
                  maxWidth: 3000,
                }}
              >
                <h1
                  style={{
                    margin: 0,
                    padding: 0,
                    fontFamily: `'${activeDesignSystem.typography.headingFont}', sans-serif`,
                    fontSize: 'min(91px, 9.1vw)',
                    fontWeight: 700,
                    color: '#f8fafc',
                    lineHeight: 1.08,
                    letterSpacing: '-0.03em',
                    textShadow: '0 2px 28px rgba(0, 0, 0, 0.35)',
                    opacity: 0.5,
                  }}
                >
                  Design systém: {activeDesignSystem.name}
                </h1>
              </div>
              <div
                style={{
                  ...CARD_ZADANI,
                  left: CANVAS_ZADANI_LEFT,
                  top: CANVAS_BLOCKS_TOP,
                  maxHeight: 'none',
                  overflow: 'visible',
                }}
              >
                <div style={{ ...labelCap, color: '#94a3b8' }}>ZADÁNÍ</div>
                <p style={{ margin: '0 0 10px', fontSize: 10, lineHeight: 1.45, color: '#94a3b8' }}>
                  Text zadání (včetně původního promptu) můžete upravit. Do příloh u zadání patří jen obrázky, které
                  tady výslovně přidáš („Přidat obrázky“) — sdílená knihovna referencí pro styly se sem automaticky
                  nepřidává. Přegenerování znovu navrhne paletu, typografii a layouty podle zadání. Klepnutím na
                  „Doporučit AI styl“ dostaneš z textu návrh 1–3 přednastavených ilustračních stylů.
                </p>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  onBlur={() => persistBriefToDataset()}
                  placeholder="Detailně popište váš vizuální styl pro knihu nebo nahrajte vzorové stránky"
                  rows={5}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    marginBottom: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid rgba(71, 85, 105, 0.75)',
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    color: '#f1f5f9',
                    fontSize: 12,
                    lineHeight: 1.5,
                    resize: 'vertical',
                    minHeight: 88,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={openOnboardingFilePicker}
                    disabled={referenceUploading || referenceResolutionFiles.length >= MAX_REFERENCE_IMAGES}
                    title="Přidat referenční obrázky"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid rgba(71, 85, 105, 0.9)',
                      backgroundColor: 'rgba(51, 65, 85, 0.45)',
                      color: '#e2e8f0',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor:
                        referenceUploading || referenceResolutionFiles.length >= MAX_REFERENCE_IMAGES ? 'not-allowed' : 'pointer',
                      opacity: referenceUploading || referenceResolutionFiles.length >= MAX_REFERENCE_IMAGES ? 0.45 : 1,
                    }}
                  >
                    {referenceUploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                    Přidat obrázky
                  </button>
                  <button
                    type="button"
                    disabled={!canGenerate || generating}
                    onClick={() => void handleGenerate()}
                    title={
                      canGenerate
                        ? 'Znovu spustit AI (název, barvy, typografie, layouty…)'
                        : `Napiš aspoň ${DESIGN_SYSTEM_BRIEF_MIN_CHARS} znaků, nebo nahraj obrázek.`
                    }
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: 'none',
                      backgroundColor: '#6366f1',
                      color: '#f8fafc',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: !canGenerate || generating ? 'not-allowed' : 'pointer',
                      opacity: !canGenerate || generating ? 0.45 : 1,
                    }}
                  >
                    {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Přegenerovat
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRecommendPresetFromBrief()}
                    disabled={presetFromPromptBusy || brief.trim().length < 15}
                    title="Podle textu zadání navrhne 1–3 přednastavené ilustrační styly (Gemini)"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid rgba(129, 140, 248, 0.45)',
                      backgroundColor: 'rgba(99, 102, 241, 0.12)',
                      color: '#c7d2fe',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor:
                        presetFromPromptBusy || brief.trim().length < 15 ? 'not-allowed' : 'pointer',
                      opacity: presetFromPromptBusy || brief.trim().length < 15 ? 0.45 : 1,
                    }}
                  >
                    {presetFromPromptBusy ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} strokeWidth={2} />
                    )}
                    Doporučit AI styl
                  </button>
                </div>
                {presetFromPromptResult ? (
                  <div
                    style={{
                      marginBottom: 10,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid rgba(129, 140, 248, 0.35)',
                      backgroundColor: 'rgba(49, 46, 129, 0.25)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#a5b4fc',
                        letterSpacing: '0.06em',
                        marginBottom: 8,
                        textTransform: 'uppercase',
                      }}
                    >
                      Doporučení podle zadání
                    </div>
                    {presetFromPromptResult.summaryCz ? (
                      <p style={{ margin: '0 0 10px', fontSize: 11, color: '#e2e8f0', lineHeight: 1.45 }}>
                        {presetFromPromptResult.summaryCz}
                      </p>
                    ) : null}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {presetFromPromptResult.recommendations.map((rec, i) => {
                        const preset = PRESET_ILLUSTRATION_STYLES.find((p) => p.id === rec.presetId);
                        const label = preset?.name ?? rec.presetId;
                        return (
                          <div
                            key={`${rec.presetId}-${i}`}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 8,
                              backgroundColor: 'rgba(15, 23, 42, 0.45)',
                              border: '1px solid rgba(51, 65, 85, 0.65)',
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
                              {i + 1}. {label}
                            </div>
                            <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4, marginBottom: 8 }}>
                              {rec.reasonCz}
                            </div>
                            <button
                              type="button"
                              onClick={() => applyRecommendedPresetById(rec.presetId)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '5px 10px',
                                borderRadius: 8,
                                border: '1px solid rgba(129, 140, 248, 0.5)',
                                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                                color: '#e0e7ff',
                                fontSize: 10,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              <Check size={12} strokeWidth={2.5} />
                              Použít tento styl
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {(() => {
                  const texts = (activeDesignSystem.dataset?.files ?? []).filter((f) => f.kind === 'text');
                  const nImg = zadaniBriefAttachmentFiles.length;
                  const nTxt = texts.length;
                  const nTotal = nImg + nTxt;
                  const summary =
                    nTotal === 0
                      ? 'žádné'
                      : [nImg > 0 ? `${nImg} obr.` : null, nTxt > 0 ? `${nTxt} text` : null]
                          .filter(Boolean)
                          .join(' · ');
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => setZadaniPrilohyOpen((o) => !o)}
                        aria-expanded={zadaniPrilohyOpen}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '8px 10px',
                          marginTop: 2,
                          borderRadius: 10,
                          border: '1px solid rgba(71, 85, 105, 0.65)',
                          backgroundColor: 'rgba(15, 23, 42, 0.45)',
                          color: '#e2e8f0',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ minWidth: 0 }}>
                          Přílohy
                          <span style={{ fontWeight: 500, color: '#94a3b8', marginLeft: 6 }}>({summary})</span>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, color: '#94a3b8' }}>
                          {zadaniPrilohyOpen ? 'Skrýt' : 'Více'}
                          <ChevronDown
                            size={16}
                            strokeWidth={2}
                            style={{
                              transform: zadaniPrilohyOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.15s ease',
                            }}
                          />
                        </span>
                      </button>
                      {zadaniPrilohyOpen ? (
                        <div style={{ marginTop: 10 }}>
                          {nTotal === 0 ? (
                            <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', lineHeight: 1.45 }}>
                              Žádné přílohy — použijte „Přidat obrázky“ nebo nahrajte soubory v klasickém editoru.
                            </p>
                          ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {nImg > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                                  {zadaniBriefAttachmentFiles.map((f) => (
                            <div key={f.id} style={{ position: 'relative', minWidth: 0 }}>
                              <div
                                title={f.referenceNote || f.name}
                                style={{
                                  aspectRatio: '1',
                                  borderRadius: 8,
                                  border: '1px solid rgba(71, 85, 105, 0.75)',
                                  backgroundColor: '#0f172a',
                                  backgroundImage: f.url ? `url(${f.url})` : undefined,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                }}
                              />
                              <button
                                type="button"
                                title="Odebrat"
                                onClick={() => removeOnboardingAttachment(f.id)}
                                style={{
                                  position: 'absolute',
                                  top: 4,
                                  right: 4,
                                  width: 22,
                                  height: 22,
                                  borderRadius: 6,
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: 'rgba(15, 23, 42, 0.88)',
                                  color: '#e2e8f0',
                                  cursor: 'pointer',
                                }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {texts.map((f) => (
                        <div
                          key={f.id}
                          style={{
                            fontSize: 10,
                                    color: '#cbd5e1',
                            padding: '6px 8px',
                            borderRadius: 8,
                            border: '1px solid rgba(51, 65, 85, 0.65)',
                            backgroundColor: 'rgba(15, 23, 42, 0.55)',
                          }}
                        >
                                  <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>{f.name}</div>
                          <div style={{ lineHeight: 1.35, maxHeight: 56, overflow: 'hidden' }}>
                            {(f.content ?? '').slice(0, 200)}
                            {(f.content ?? '').length > 200 ? '…' : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                          )}
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </div>

              <div
                style={{
                  position: 'absolute',
                  left: CANVAS_TYPO_LEFT,
                  top: CANVAS_BLOCKS_TOP,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: CANVAS_STACK_GAP,
                  width: CANVAS_TYPO_COLUMN_W,
                }}
              >
                <div style={{ ...CARD_TYPO, position: 'relative', left: 0, top: 0 }}>
                  <div style={{ ...labelCap, color: '#64748b' }}>BARVY</div>
                  {palettePreview && palettePreview.length > 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 14,
                        marginTop: 4,
                        alignItems: 'center',
                      }}
                    >
                      {palettePreview.map(({ groupId, swatch: s }) => (
                        <button
                        key={s.id}
                          type="button"
                          title={`${s.name} ${s.value} — upravit barvu`}
                          onClick={() => {
                            setTypoPopupLevel(null);
                            setVisualStylePopupKey(null);
                            setTypoBaseFontOpen(null);
                            setBlockVisualPresetEditId(null);
                            setPaletteSwatchEdit({ groupId, swatch: s });
                          }}
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: '50%',
                          backgroundColor: s.value,
                            border: '2px solid rgba(15, 23, 42, 0.12)',
                            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25)',
                            flexShrink: 0,
                            padding: 0,
                            cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                ) : (
                    <p style={{ margin: '12px 0 0', fontSize: 12, color: '#64748b' }}>Žádné barvy v paletě</p>
                )}
              </div>

                <div style={{ ...CARD_TYPO, position: 'relative', left: 0, top: 0 }}>
                <div style={{ ...labelCap, color: '#64748b' }}>TYPOGRAFIE</div>
              <div
                style={{
                  display: 'flex',
                    gap: 12,
                    alignItems: 'stretch',
                  }}
                >
                  <div style={{ flex: '1 1 0', minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: '#64748b', letterSpacing: '0.04em', marginBottom: 6 }}>
                      Primární font
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTypoPopupLevel(null);
                        setVisualStylePopupKey(null);
                        setBlockVisualPresetEditId(null);
                        setTypoBaseFontOpen('heading');
                      }}
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        maxHeight: 128,
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 8,
                        boxSizing: 'border-box',
                      }}
                      title="Změnit primární font (nadpisy H1–H3)"
                    >
                      <span
                  style={{
                    fontFamily: `'${activeDesignSystem.typography.headingFont}', sans-serif`,
                          fontSize: 56,
                    fontWeight: 700,
                          color: '#0f172a',
                          lineHeight: 1,
                  }}
                >
                  Aa
                      </span>
                    </button>
                <div
                  style={{
                        marginTop: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#0f172a',
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {activeDesignSystem.typography.headingFont}
                    </div>
                  </div>
                  <div style={{ flex: '1 1 0', minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: '#64748b', letterSpacing: '0.04em', marginBottom: 6 }}>
                      Sekundární font
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTypoPopupLevel(null);
                        setVisualStylePopupKey(null);
                        setBlockVisualPresetEditId(null);
                        setTypoBaseFontOpen('body');
                      }}
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        maxHeight: 128,
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 8,
                        boxSizing: 'border-box',
                      }}
                      title="Změnit sekundární font (odstavec, popisek)"
                    >
                      <span
                        style={{
                    fontFamily: `'${activeDesignSystem.typography.bodyFont}', sans-serif`,
                          fontSize: 56,
                          fontWeight: 600,
                          color: '#0f172a',
                          lineHeight: 1,
                        }}
                      >
                        Aa
                      </span>
                    </button>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#0f172a',
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {activeDesignSystem.typography.bodyFont}
                </div>
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: '#64748b' }}>
                  Velikost řezu: {activeDesignSystem.typography.baseFontSize}
                </div>

                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ ...labelCap, marginBottom: 4, color: '#64748b' }}>PÍSMOVÉ STYLY</div>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 10, lineHeight: 1.35 }}>
                    Kliknutím otevřete úpravu (font, řez, barva, zarovnání…).
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {TYPO_LEVELS.map((level) => {
                      const st = activeDesignSystem.typography.styles?.[level.id];
                      const meta = typoMetaLine(st);
                      const sampleColor =
                        st?.textColor ?? (level.id === 'caption' ? '#64748b' : '#0f172a');
                      return (
                        <div
                          key={level.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openTypoPopup(level.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openTypoPopup(level.id);
                            }
                          }}
                          style={{
                            borderRadius: 10,
                            padding: '10px 10px 10px 10px',
                            cursor: 'pointer',
                            outline: 'none',
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#f8fafc',
                          }}
                          title={`Upravit styl: ${level.label}`}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.45)';
                            e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.06)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.backgroundColor = '#f8fafc';
                          }}
                        >
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                            {level.label}
                          </div>
                          <div
                            style={{
                              ...typoPreviewStyle(
                              activeDesignSystem.typography.headingFont,
                              activeDesignSystem.typography.bodyFont,
                              level,
                              st,
                              ),
                              color: sampleColor,
                              ...(level.id === 'body'
                                ? { maxWidth: '100%', whiteSpace: 'normal' as const }
                                : {}),
                            }}
                          >
                            {level.id === 'body'
                              ? level.sample
                              : clipText(level.sample, level.id === 'caption' ? 36 : 42)}
                          </div>
                          {meta ? (
                            <div style={{ fontSize: 10, color: '#475569', marginTop: 3, lineHeight: 1.35 }}>{meta}</div>
                          ) : (
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, fontStyle: 'italic' }}>
                              výchozí řez ze základních fontů
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                </div>

                <div style={{ ...CARD_TYPO, position: 'relative', left: 0, top: 0 }}>
                  <div style={{ ...labelCap, color: '#64748b' }}>VIZUÁLNÍ STYLY BLOKŮ</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {blockVisualPresetsList.map((preset) => {
                      const isDefault =
                        (activeDesignSystem.blockPreferences.defaultBlockVisualPresetId ??
                          defaultBlockVisualPresetIdForLegacy(activeDesignSystem)) === preset.id;
                      return (
                        <div key={preset.id}>
                        <div
                          style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              marginBottom: 6,
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', minWidth: 0, flex: 1 }}>
                              {preset.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDefaultBlockVisualPreset(preset.id);
                                }}
                                title="Nové bloky budou používat tento styl"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                            fontSize: 9,
                                  fontWeight: 600,
                                  padding: '4px 8px',
                                  borderRadius: 8,
                                  border: isDefault ? '1px solid #6366f1' : '1px solid #e2e8f0',
                                  backgroundColor: isDefault ? 'rgba(99, 102, 241, 0.08)' : '#ffffff',
                                  color: isDefault ? '#4338ca' : '#64748b',
                                  cursor: 'pointer',
                                }}
                              >
                                <Star size={12} fill={isDefault ? 'currentColor' : 'none'} strokeWidth={2} />
                                Výchozí
                              </button>
                              {preset.role === 'custom' ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeBlockVisualPreset(preset.id);
                                    setBlockVisualPresetEditId((id) => (id === preset.id ? null : id));
                                  }}
                                  title="Odstranit"
                                  style={{
                                    padding: 6,
                                    borderRadius: 8,
                                    border: '1px solid #fecaca',
                                    backgroundColor: '#fff',
                                    color: '#b91c1c',
                                    cursor: 'pointer',
                                    display: 'flex',
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              ) : null}
                        </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setTypoPopupLevel(null);
                              setVisualStylePopupKey(null);
                              setTypoBaseFontOpen(null);
                              setBlockVisualPresetEditId(preset.id);
                            }}
                          style={{
                            width: '100%',
                              padding: 0,
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              borderRadius: 12,
                              textAlign: 'left',
                            }}
                          >
                            {renderBlockVisualStackCardPreview(activeDesignSystem, preset.styles)}
                          </button>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setTypoPopupLevel(null);
                        setVisualStylePopupKey(null);
                        setTypoBaseFontOpen(null);
                        addBlockVisualPreset();
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: '1px dashed #cbd5e1',
                        backgroundColor: '#f8fafc',
                        color: '#64748b',
                            fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <Plus size={16} />
                      Přidat další typ
                    </button>
                  </div>
                </div>
              </div>

              <div
                style={{
                  position: 'absolute',
                  left: CANVAS_REF_IMAGES_COL_LEFT,
                  top: CANVAS_REF_IMAGES_CARD_TOP,
                  width: CANVAS_AI_STYL_CARD_W,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: CANVAS_STACK_GAP,
                }}
              >
              <div
                style={{
                  ...CARD_WIDE,
                  position: 'relative',
                  left: 0,
                  top: 0,
                  maxHeight: 'none',
                  overflow: 'visible',
                }}
              >
                <div style={labelCap}>AI STYL (ILUSTRACE)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => setPresetStylesPickerOpen(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid rgba(129, 140, 248, 0.45)',
                      backgroundColor: 'rgba(79, 70, 229, 0.12)',
                      color: '#a5b4fc',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Layers size={15} strokeWidth={2} />
                    Vybrat další styl
                  </button>
                  <span style={{ fontSize: 10, color: '#64748b', lineHeight: 1.35, maxWidth: 420 }}>
                    30 přednastavených směrů (ilustrace i foto) — v modalu jsou náhledové fotky; po výběru se uloží styl a nastaví hlavní prompt.
                    „Uložit do data setu“ u příkladu připojí obrázek k otevřenému nebo prvnímu stylu (mřížka). Ověření stylu: „Náhodná ilustrace“.
                  </span>
                </div>
                <input
                  ref={styleExtraFileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const sid = styleUploadTargetIdRef.current;
                    styleUploadTargetIdRef.current = null;
                    const files = e.target.files;
                    e.target.value = '';
                    void handleAddImageToIllustrationStyle(sid ?? '', files);
                  }}
                />
                {(activeDesignSystem?.dataset?.illustrationStyleProposals ?? []).length > 0 ? (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: '10px 10px',
                      borderRadius: 12,
                      border: '1px solid rgba(129, 140, 248, 0.45)',
                      backgroundColor: 'rgba(79, 70, 229, 0.12)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#a5b4fc',
                        letterSpacing: '0.06em',
                        marginBottom: 8,
                      }}
                    >
                      NÁVRHY PROMPTŮ (AI)
                    </div>
                    <p style={{ margin: '0 0 10px', fontSize: 10, lineHeight: 1.45, color: '#94a3b8' }}>
                      Vyber variantu a přidej ji mezi styly — pak můžeš přiřadit referenční obrázky nebo generovat náhledy.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(activeDesignSystem.dataset?.illustrationStyleProposals ?? []).map((prop: IllustrationStyleProposal) => (
                        <div
                          key={prop.id}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 10,
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            gap: 10,
                            alignItems: 'flex-start',
                          }}
                        >
                          <div
                            style={{
                              width: 88,
                              flexShrink: 0,
                              aspectRatio: '1',
                              borderRadius: 8,
                              overflow: 'hidden',
                              position: 'relative',
                              backgroundColor: '#e2e8f0',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            <IllustrationStyleThumb styleId={prop.id} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{prop.name}</div>
                          {prop.rationale ? (
                            <div style={{ fontSize: 9, color: '#64748b', marginBottom: 6, lineHeight: 1.35 }}>{prop.rationale}</div>
                          ) : null}
                          <div
                            style={{
                              fontSize: 10,
                              color: '#475569',
                              lineHeight: 1.45,
                              marginBottom: 8,
                              maxHeight: 72,
                              overflow: 'hidden',
                            }}
                          >
                            {prop.promptHint.slice(0, 280)}
                            {prop.promptHint.length > 280 ? '…' : ''}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddIllustrationProposalAsStyle(prop)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 8,
                              border: '1px solid #c7d2fe',
                              background: 'rgba(99, 102, 241, 0.1)',
                              color: '#4338ca',
                              fontSize: 10,
                              fontWeight: 600,
                              cursor: 'pointer',
                              width: '100%',
                            }}
                          >
                            Přidat do stylů
                          </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {hasAutoLayoutCropsInLibrary ? (
                  <div
                    style={{
                      marginBottom: 10,
                      padding: '8px 10px',
                      borderRadius: 10,
                      backgroundColor: 'rgba(30, 58, 138, 0.12)',
                      border: '1px solid rgba(99, 102, 241, 0.35)',
                      fontSize: 10,
                      color: '#c7d2fe',
                      lineHeight: 1.45,
                    }}
                  >
                    <strong style={{ color: '#e0e7ff' }}>Odkud jsou „auto“ výřezy:</strong> nejsou to cizí obrázky z
                    internetu. Aplikace je vyřízla z nahraných <strong>screenshotů celých stránek</strong> (referenční
                    layout) při generování design systému nebo po klepnutí na „Vyříznout ilustrace“. Navíc můžeš v
                    knihovně vidět starší soubory ze sdíleného úložiště učitele napříč projekty.
                  </div>
                ) : null}
                {!activeDesignSystem?.dataset?.illustrationStylesUserPinned ? (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      marginBottom: 10,
                      fontSize: 10,
                      color: '#94a3b8',
                      lineHeight: 1.45,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={activeDesignSystem?.dataset?.styleClusterIncludeAutoCrops === true}
                      onChange={(e) => {
                        applyDesignSystemPatch((ds) => ({
                          ...ds,
                          dataset: {
                            ...ds.dataset,
                            topic: ds.dataset?.topic,
                            generationBrief: ds.dataset?.generationBrief,
                            files: ds.dataset?.files ?? [],
                            styleClusterIncludeAutoCrops: e.target.checked,
                          },
                        }));
                      }}
                      style={{ marginTop: 2, flexShrink: 0 }}
                    />
                    <span>
                      Zahrnout do AI seskupení ilustračních stylů i{' '}
                      <strong>automatické výřezy</strong> ze stránek („výřez ilustrace ze stránky (auto)“). Vypnuto =
                      seskupuje se jen z ručních referencí a ostatních obrázků bez tohoto tagu.
                    </span>
                  </label>
                ) : null}
                {styleClusterBusy ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 10,
                      fontSize: 10,
                      color: '#94a3b8',
                    }}
                  >
                    <Loader2 size={12} className="animate-spin" />
                    Seskupuji styly z referenčních obrázků…
                  </div>
                ) : null}
                {styleClusterError ? (
                  <div style={{ fontSize: 10, color: '#f87171', marginBottom: 8, lineHeight: 1.35 }}>
                    {styleClusterError}
                  </div>
                ) : null}
                {activeDesignSystem?.dataset?.illustrationStylesUserPinned ? (
                  <div
                    style={{
                      marginBottom: 10,
                      padding: '8px 10px',
                      borderRadius: 10,
                      backgroundColor: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      fontSize: 10,
                      color: '#92400e',
                      lineHeight: 1.4,
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 8,
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Doplnil jsi obrázky ke stylu ručně — automatické přeskupení je vypnuté.</span>
                    <button
                      type="button"
                      onClick={() => handleUnpinAndReclusterIllustrationStyles()}
                      style={{
                        flexShrink: 0,
                        padding: '4px 10px',
                        borderRadius: 8,
                        border: '1px solid rgba(217, 119, 6, 0.45)',
                        background: '#fffbeb',
                        color: '#b45309',
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Obnovit styly AI
                    </button>
                  </div>
                ) : null}

                {hasIllustrationStyleCategories ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))',
                        gap: 12,
                      }}
                    >
                    {illustrationStylesFromDataset.map((st) => {
                        const filesInStyle = st.imageIds
                          .map((id) => referenceFileById.get(id))
                          .filter((x): x is DatasetFile => Boolean(x))
                          .filter((f) => f.referenceRole !== 'layout');
                        const spotPreview = activeDesignSystem?.dataset?.illustrationStyleSpotPreviews?.[st.id];
                        const idsUsedByOtherStyles = new Set(
                          illustrationStylesFromDataset
                            .filter((s) => s.id !== st.id)
                            .flatMap((s) => s.imageIds),
                        );
                        const exclusiveStyleFile = filesInStyle.find((f) => !idsUsedByOtherStyles.has(f.id));
                        const isPresetCatalogStyle = st.id.startsWith('preset-');
                        const catalogPresetDef = isPresetCatalogStyle
                          ? PRESET_ILLUSTRATION_STYLES.find((p) => st.id === presetStyleDatasetId(p.id))
                          : undefined;
                        const spotUrl =
                          typeof spotPreview?.url === 'string' && spotPreview.url.startsWith('http')
                            ? spotPreview.url
                            : undefined;
                        /** U presetů: výhradní soubor, jinak spot / první obrázek ve stylu (dřív jen výhradní → prázdná dlaždice). */
                        const datasetThumbPreset =
                          exclusiveStyleFile?.url ?? spotUrl ?? filesInStyle[0]?.url;
                        const datasetThumbNonPreset = spotUrl ?? filesInStyle[0]?.url;
                        const isOpen = aiStyleDetailOpenId === st.id;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setAiStyleDetailOpenId((id) => (id === st.id ? null : st.id))}
                            title={st.name}
                            style={{
                              position: 'relative',
                              aspectRatio: '1',
                              width: '100%',
                              borderRadius: 12,
                              border: isOpen ? '2px solid #6366f1' : '1px solid #e2e8f0',
                              overflow: 'hidden',
                              padding: 0,
                              cursor: 'pointer',
                              backgroundColor: '#f1f5f9',
                              display: 'block',
                              boxSizing: 'border-box',
                            }}
                          >
                            {catalogPresetDef ? (
                              <IllustrationStyleThumb
                                preset={catalogPresetDef}
                                datasetThumbnailUrl={datasetThumbPreset}
                              />
                            ) : (
                              <IllustrationStyleThumb
                                styleId={st.id}
                                datasetThumbnailUrl={datasetThumbNonPreset}
                              />
                            )}
                            <div
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                padding: '8px 8px 6px',
                                background: 'linear-gradient(transparent, rgba(15, 23, 42, 0.78))',
                                color: '#f8fafc',
                                fontSize: 11,
                                fontWeight: 700,
                                lineHeight: 1.25,
                                textAlign: 'left',
                                maxHeight: 44,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                              } as CSSProperties}
                            >
                              {st.name}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {aiStyleDetailOpenId
                      ? (() => {
                          const st = illustrationStylesFromDataset.find((s) => s.id === aiStyleDetailOpenId);
                          if (!st) return null;
                      const filesInStyle = st.imageIds
                        .map((id) => referenceFileById.get(id))
                        .filter((x): x is DatasetFile => Boolean(x))
                        .filter((f) => f.referenceRole !== 'layout');
                      const promptFull = st.promptHint ?? '';
                      const promptShort = getFirstTwoSentencesEn(promptFull);
                      const promptExpandable = hasMoreThanTwoSentencesEn(promptFull);
                      const promptTextExpanded = expandedPromptStyleIds[st.id];
                      const spotPreview = activeDesignSystem?.dataset?.illustrationStyleSpotPreviews?.[st.id];
                          const spotPreviewUrl = spotPreview?.url;
                          const spotUrlNorm = normalizeDatasetImageUrl(
                            typeof spotPreviewUrl === 'string' ? spotPreviewUrl : undefined,
                          );
                          const spotImageAlreadyInFiles =
                            spotUrlNorm.startsWith('http') &&
                            referenceResolutionFiles.some(
                              (f) => f.kind === 'image' && normalizeDatasetImageUrl(f.url) === spotUrlNorm,
                            );
                          /** Při plném limitu lze pořád „jen připojit“ URL, která už v datasetu je. */
                          const saveSpotDisabledByLimit =
                            referenceResolutionFiles.length >= MAX_REFERENCE_IMAGES && !spotImageAlreadyInFiles;
                      return (
                        <div
                          style={{
                                border: '1px solid #e2e8f0',
                            borderRadius: 12,
                            overflow: 'visible',
                                backgroundColor: '#ffffff',
                                padding: '12px 14px 14px',
                              }}
                            >
                              <div
                            style={{
                              display: 'flex',
                                  alignItems: 'flex-start',
                                  justifyContent: 'space-between',
                                  gap: 10,
                                  marginBottom: 12,
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <div
                              style={{
                                      fontSize: 9,
                                      fontWeight: 700,
                                      color: '#64748b',
                                      letterSpacing: '0.06em',
                                      marginBottom: 4,
                                    }}
                                  >
                                    Nastavení stylu
                                  </div>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                                    {st.name}
                                  </div>
                                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
                                    {filesInStyle.length} obr. v datasetu (přiřazených ke stylu)
                                    {spotPreview && filesInStyle.length === 0 ? (
                                      <span style={{ display: 'block', marginTop: 4, color: '#b45309' }}>
                                        Máš náhled níže — klepni „Uložit do stylu (dataset)“, aby se započítal. Pokud nic
                                        nestane, je pravděpodobně plný limit {MAX_REFERENCE_IMAGES} referenčních obrázků
                                        (smaž jeden v přílohách u zadání).
                            </span>
                                    ) : null}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setAiStyleDetailOpenId(null)}
                                  title="Zavřít"
                                  style={{
                                    flexShrink: 0,
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    background: '#fff',
                                    color: '#64748b',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <X size={16} />
                          </button>
                              </div>
                              {promptFull ? (
                                <div
                                  style={{
                                    fontSize: 9,
                                    color: '#334155',
                                    marginBottom: 10,
                                    lineHeight: 1.45,
                                    padding: '8px 10px',
                                    borderRadius: 8,
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                  }}
                                >
                                  <span
                                    style={{
                                      display: 'block',
                                      fontSize: 8,
                                      color: '#64748b',
                                      marginBottom: 4,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.06em',
                                    }}
                                  >
                                    Prompt (AI)
                                  </span>
                                  <div
                                    style={{
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {promptExpandable && !promptTextExpanded ? promptShort : promptFull}
                                  </div>
                                  {promptExpandable ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedPromptStyleIds((p) => ({
                                          ...p,
                                          [st.id]: !p[st.id],
                                        }))
                                      }
                                      style={{
                                        marginTop: 8,
                                        padding: 0,
                                        border: 'none',
                                        background: 'none',
                                        color: '#818cf8',
                                        fontSize: 10,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                      }}
                                    >
                                      {promptTextExpanded ? 'Méně' : 'Více'}
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 8,
                                  marginBottom: 10,
                                  alignItems: 'center',
                                }}
                              >
                                <button
                                  type="button"
                                  disabled={
                                    styleSpotLoadingStyleId !== null ||
                                    referenceUploading ||
                                    !st.promptHint?.trim()
                                  }
                                  onClick={() => void handleGenerateStyleSpotPreview(st)}
                                  title="Náhodný motiv — ověření vizuálního stylu této kategorie"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    border: '1px solid rgba(99, 102, 241, 0.35)',
                                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                                    color: '#4338ca',
                                    fontSize: 10,
                                    fontWeight: 600,
                                    cursor:
                                      styleSpotLoadingStyleId !== null ||
                                      referenceUploading ||
                                      !st.promptHint?.trim()
                                        ? 'not-allowed'
                                        : 'pointer',
                                    opacity:
                                      styleSpotLoadingStyleId !== null ||
                                      referenceUploading ||
                                      !st.promptHint?.trim()
                                        ? 0.45
                                        : 1,
                                  }}
                                >
                                  {styleSpotLoadingStyleId === st.id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Sparkles size={14} />
                                  )}
                                  Náhodná ilustrace
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    referenceUploading || referenceResolutionFiles.length >= MAX_REFERENCE_IMAGES
                                  }
                                  onClick={() => openStyleImageUpload(st.id)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    backgroundColor: '#ffffff',
                                    color: '#334155',
                                    fontSize: 10,
                                    fontWeight: 600,
                                    cursor:
                                      referenceUploading || referenceResolutionFiles.length >= MAX_REFERENCE_IMAGES
                                        ? 'not-allowed'
                                        : 'pointer',
                                    opacity:
                                      referenceUploading || referenceResolutionFiles.length >= MAX_REFERENCE_IMAGES
                                        ? 0.45
                                        : 1,
                                  }}
                                >
                                  <Plus size={14} strokeWidth={2} />
                                  Přidat obrázek ke stylu
                                </button>
                              </div>
                              {spotPreview ? (
                                <div style={{ marginBottom: 10 }}>
                                  <div
                                    style={{
                                      fontSize: 8,
                                      color: '#64748b',
                                      marginBottom: 4,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.06em',
                                    }}
                                  >
                                    Náhled ověření stylu
                                  </div>
                                  <img
                                    src={spotPreview.url}
                                    alt=""
                                    referrerPolicy="no-referrer"
                                    style={{
                                      width: '100%',
                                      maxHeight: 200,
                                      objectFit: 'contain',
                                      borderRadius: 8,
                                      border: '1px solid #e2e8f0',
                                      backgroundColor: '#f8fafc',
                                    }}
                                  />
                                  <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 4, lineHeight: 1.3 }}>
                                    <div>{spotPreview.subject}</div>
                                    {spotPreview.randomDirectiveEn ? (
                                      <div
                                        style={{
                                          marginTop: 4,
                                          fontSize: 8,
                                          color: '#64748b',
                                          fontStyle: 'italic',
                                          lineHeight: 1.35,
                                        }}
                                      >
                                        {spotPreview.randomDirectiveEn}
                                      </div>
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveSpotPreviewToStyleDataset(st.id)}
                                    disabled={referenceUploading || saveSpotDisabledByLimit}
                                    title={
                                      saveSpotDisabledByLimit
                                        ? `Dosáhl jsi ${MAX_REFERENCE_IMAGES} referenčních obrázků — smaž jeden v přílohách u zadání (nebo použij náhled, který už v souborech je, a připoj ho ke stylu).`
                                        : 'Přidat tento obrázek mezi reference karty stylu (stejně jako nahrání)'
                                    }
                                    style={{
                                      marginTop: 8,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      padding: '6px 12px',
                                      borderRadius: 8,
                                      border: '1px solid rgba(22, 163, 74, 0.35)',
                                      backgroundColor: 'rgba(22, 163, 74, 0.08)',
                                      color: '#15803d',
                                      fontSize: 10,
                                      fontWeight: 600,
                                      cursor:
                                        referenceUploading || saveSpotDisabledByLimit ? 'not-allowed' : 'pointer',
                                      opacity: referenceUploading || saveSpotDisabledByLimit ? 0.45 : 1,
                                    }}
                                  >
                                    <Save size={14} strokeWidth={2} />
                                    Uložit do stylu (dataset)
                                  </button>
                                </div>
                              ) : null}
                              <div
                                style={{
                                  fontSize: 9,
                                  fontWeight: 600,
                                  color: '#64748b',
                                  marginBottom: 8,
                                  letterSpacing: '0.04em',
                                }}
                              >
                                Obrázky v datasetu (přehled)
                              </div>
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(3, 1fr)',
                                  gap: 8,
                                }}
                              >
                                {filesInStyle.map((f) => (
                                  <DsIllustrationRefCell
                                    key={f.id}
                                    f={f}
                                    onRemove={() =>
                                      updateReferenceImages(referenceResolutionFiles.filter((x) => x.id !== f.id))
                                    }
                                    onNoteChange={(note) =>
                                      updateReferenceImages(
                                        referenceResolutionFiles.map((x) =>
                                          x.id === f.id ? { ...x, referenceNote: note } : x,
                                        ),
                                      )
                                    }
                                    layoutExtractBusyId={layoutExtractBusyId}
                                    referenceUploading={referenceUploading}
                                    onExtractLayout={() => void handleExtractIllustrationsFromLayout(f)}
                                  />
                                ))}
                              </div>
                        </div>
                      );
                        })()
                      : null}
                    {orphanReferenceFilesForStyles.length > 0 ? (
                      <div
                        style={{
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          borderRadius: 12,
                          padding: '10px 12px',
                          backgroundColor: '#fffbeb',
                        }}
                      >
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#b45309', marginBottom: 4 }}>
                          Nezařazené do stylu
                        </div>
                        <p
                          style={{
                            margin: '0 0 10px',
                            fontSize: 9,
                            lineHeight: 1.45,
                            color: '#92400e',
                          }}
                        >
                          Jsou to všechny ilustrační soubory v knihovně, které ještě nejsou u žádného stylu v sekci
                          „Obrázky v datasetu“ výše — typicky výřezy ze stránek (auto), starší nahrávky nebo náhledy,
                          které jsi nepřipojil tlačítkem „Uložit do stylu“. Sekce se objeví, jakmile v datasetu existuje
                          aspoň jeden styl; nový styl sem nic „nedodává“, jen se tento přehled začne zobrazovat.
                        </p>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 8,
                          }}
                        >
                          {orphanReferenceFilesForStyles.map((f) => (
                            <DsIllustrationRefCell
                              key={f.id}
                              f={f}
                              onRemove={() =>
                                updateReferenceImages(referenceResolutionFiles.filter((x) => x.id !== f.id))
                              }
                              onNoteChange={(note) =>
                                updateReferenceImages(
                                  referenceResolutionFiles.map((x) =>
                                    x.id === f.id ? { ...x, referenceNote: note } : x,
                                  ),
                                )
                              }
                              layoutExtractBusyId={layoutExtractBusyId}
                              referenceUploading={referenceUploading}
                              onExtractLayout={() => void handleExtractIllustrationsFromLayout(f)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {referenceResolutionFiles.length < MAX_REFERENCE_IMAGES ? (
                      <button
                        type="button"
                        disabled={referenceUploading}
                        onClick={() => referenceFileInputRef.current?.click()}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: '1px dashed rgba(99, 102, 241, 0.45)',
                          backgroundColor: 'rgba(99, 102, 241, 0.06)',
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          cursor: referenceUploading ? 'wait' : 'pointer',
                          color: '#4f46e5',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {referenceUploading ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <ImagePlus size={18} strokeWidth={2} />
                        )}
                        Přidat reference (AI znovu roztřídí po nahrání)
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    {illustrationReferenceFilesForStyleCard.length === 0 && referenceResolutionFiles.length > 0 ? (
                      <div
                        style={{
                          fontSize: 10,
                          lineHeight: 1.45,
                          color: '#64748b',
                          padding: '8px 10px',
                          borderRadius: 10,
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#f8fafc',
                        }}
                      >
                        V přílohách máš jen layout stránky — ty se v této kartě neukazují. Přidej ilustrační obrázky
                        vpravo u zadání, případně z layoutu vyřízni ilustrace (tlačítko u přílohy layoutu).
                      </div>
                    ) : null}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 8,
                      }}
                    >
                      {illustrationReferenceFilesForStyleCard.map((f) => (
                        <DsIllustrationRefCell
                          key={f.id}
                          f={f}
                          onRemove={() =>
                            updateReferenceImages(referenceResolutionFiles.filter((x) => x.id !== f.id))
                          }
                          onNoteChange={(note) =>
                            updateReferenceImages(
                              referenceResolutionFiles.map((x) =>
                                x.id === f.id ? { ...x, referenceNote: note } : x,
                              ),
                            )
                          }
                          layoutExtractBusyId={layoutExtractBusyId}
                          referenceUploading={referenceUploading}
                          onExtractLayout={() => void handleExtractIllustrationsFromLayout(f)}
                        />
                      ))}
                    </div>
                    {referenceResolutionFiles.length < MAX_REFERENCE_IMAGES ? (
                      <button
                        type="button"
                        disabled={referenceUploading}
                        onClick={() => referenceFileInputRef.current?.click()}
                        style={{
                          aspectRatio: '1',
                          minHeight: 0,
                          borderRadius: 10,
                          border: '1px dashed rgba(99, 102, 241, 0.45)',
                          backgroundColor: 'rgba(99, 102, 241, 0.06)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          cursor: referenceUploading ? 'wait' : 'pointer',
                          color: '#4f46e5',
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      >
                        {referenceUploading ? (
                          <Loader2 size={20} className="animate-spin" />
                        ) : (
                          <ImagePlus size={22} strokeWidth={2} />
                        )}
                        Přidat
                      </button>
                    ) : null}
                  </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <button
                    type="button"
                    disabled={styleExampleLoading}
                    onClick={() => void handleGenerateStyleExample()}
                    title="Náhodný motiv + uložené prompty stylu a volitelná reference z galerie (Gemini image lite — Nano Banana Flash)."
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 10px',
                      borderRadius: 10,
                      border: '1px solid rgba(14, 116, 144, 0.35)',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: styleExampleLoading ? 'wait' : 'pointer',
                      opacity: styleExampleLoading ? 0.55 : 1,
                      backgroundColor: 'rgba(34, 211, 238, 0.1)',
                      color: '#0e7490',
                    }}
                  >
                    {styleExampleLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Vygenerovat příklad
                  </button>
                </div>

                {styleExampleSubject ? (
                  <p style={{ margin: '0 0 8px', fontSize: 10, lineHeight: 1.4, color: '#94a3b8' }}>
                    Poslední motiv: <span style={{ color: '#0f172a' }}>{styleExampleSubject}</span>
                  </p>
                ) : null}
                {styleExampleImageUrl ? (
                  <div style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        marginBottom: 10,
                        borderRadius: 12,
                        overflow: 'hidden',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f1f5f9',
                      }}
                    >
                      <img
                        src={styleExampleImageUrl}
                        alt={styleExampleSubject ?? 'Ukázka stylu'}
                        style={{ width: '100%', height: 'auto', display: 'block', verticalAlign: 'top' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                        disabled={styleExampleLoading}
                        onClick={() => handleSaveStyleExampleToDataset()}
                        title="Přidá obrázek mezi referenční soubory datasetu včetně celého promptu."
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                          padding: '6px 10px',
                      borderRadius: 10,
                          border: '1px solid rgba(34, 197, 94, 0.45)',
                      fontSize: 11,
                      fontWeight: 600,
                          cursor: styleExampleLoading ? 'wait' : 'pointer',
                          opacity: styleExampleLoading ? 0.55 : 1,
                          backgroundColor: 'rgba(34, 197, 94, 0.1)',
                          color: '#15803d',
                        }}
                      >
                        <Save size={14} />
                        Uložit do data setu
                  </button>
                    <button
                      type="button"
                        disabled={styleExampleLoading}
                        onClick={() => void runStyleExampleGeneration('alternate')}
                        title="Nový náhodný motiv; záměrně jiný vizuální přístup (bez referencí z galerie)."
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                          padding: '6px 10px',
                        borderRadius: 10,
                          border: '1px solid rgba(251, 191, 36, 0.45)',
                        fontSize: 11,
                        fontWeight: 600,
                          cursor: styleExampleLoading ? 'wait' : 'pointer',
                          opacity: styleExampleLoading ? 0.55 : 1,
                          backgroundColor: 'rgba(251, 191, 36, 0.12)',
                          color: '#b45309',
                        }}
                      >
                        <Sparkles size={14} />
                        Zkusit jiný styl
                    </button>
                  <button
                    type="button"
                    disabled={styleExampleLoading}
                        onClick={() => void runStyleExampleGeneration('sameReference')}
                        title="Použije tento obrázek jako referenci a vygeneruje novou scénu ve stejném stylu."
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                          padding: '6px 10px',
                      borderRadius: 10,
                          border: '1px solid rgba(96, 165, 250, 0.5)',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: styleExampleLoading ? 'wait' : 'pointer',
                      opacity: styleExampleLoading ? 0.55 : 1,
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          color: '#1d4ed8',
                    }}
                  >
                        <ImagePlus size={14} />
                        Zkusit další v tomto stylu
                  </button>
                </div>
                  </div>
                ) : null}
              </div>

              <div
                style={{
                  ...CARD_GENERATION_BLOCKS,
                  position: 'relative',
                  left: 0,
                  top: 0,
                  maxHeight: 'none',
                  overflow: 'visible',
                }}
              >
                <div style={labelCap}>TYPY BLOKŮ PRO PUBLIKACI</div>
                <p style={{ margin: '0 0 10px', fontSize: 10, lineHeight: 1.45, color: '#64748b' }}>
                  AI při generování z briefu navrhne sadu podle typu knihy (učebnice bez cvičení × pracovní sešit). Tady to
                  můžeš upravit — ovlivní to doporučení a kontext pro AI.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() =>
                      applyDesignSystemPatch((ds) => ({
                        ...ds,
                        blockPreferences: {
                          ...ds.blockPreferences,
                          generationBlockTypes: [...DEFAULT_GENERATION_BLOCK_TYPES_BOOK],
                        },
                      }))
                    }
                    style={{
                      padding: '5px 8px',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                      color: '#334155',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Předloha učebnice
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyDesignSystemPatch((ds) => ({
                        ...ds,
                        blockPreferences: {
                          ...ds.blockPreferences,
                          generationBlockTypes: [...DEFAULT_GENERATION_BLOCK_TYPES_WORKSHEET],
                        },
                      }))
                    }
                    style={{
                      padding: '5px 8px',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                      color: '#334155',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Včetně aktivit (sešit)
                  </button>
                </div>
                {GEN_BLOCK_CATEGORY_ORDER.map((cat) => {
                  const opts = GENERATION_BLOCK_TYPE_OPTIONS.filter((o) => o.category === cat);
                  if (!opts.length) return null;
                  const selected = resolveGenerationBlockTypes(activeDesignSystem.blockPreferences);
                  return (
                    <div key={cat} style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#64748b',
                          letterSpacing: '0.05em',
                          marginBottom: 6,
                        }}
                      >
                        {GEN_BLOCK_CATEGORY_LABEL[cat].toUpperCase()}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {opts.map((o) => (
                          <label
                            key={o.type}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              cursor: 'pointer',
                              fontSize: 11,
                              color: '#0f172a',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selected.includes(o.type)}
                              onChange={() => toggleGenerationBlockType(o.type)}
                              style={{ width: 14, height: 14, accentColor: '#818cf8', flexShrink: 0 }}
                            />
                            <span>{o.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>

              <div
                style={{
                  ...CARD_PAGE_AND_LAYOUTS,
                  position: 'absolute',
                  left: CANVAS_PAGE_LAYOUTS_LEFT,
                  top: CANVAS_BLOCKS_TOP,
                  maxHeight: 'none',
                  overflow: 'visible',
                }}
              >
                <div style={labelCap}>LAYOUTY</div>
                <p style={{ margin: '0 0 12px', fontSize: 10, lineHeight: 1.45, color: '#64748b' }}>
                  Design tokeny v tomto systému — při generování knihy z něj se používají výchozí stránka (
                  <code style={{ fontSize: 9, color: '#94a3b8' }}>pageDefaults</code>), vzory stránek z AI (
                  <code style={{ fontSize: 9, color: '#94a3b8' }}>pageLayoutGroups</code>) a uložené šablony bloků (
                  <code style={{ fontSize: 9, color: '#94a3b8' }}>customLayouts</code>).
                </p>

                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', marginBottom: 8 }}>
                  VÝCHOZÍ STRÁNKA
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div
                    title={activeDesignSystem.pageDefaults.pageBackgroundColor}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      backgroundColor: activeDesignSystem.pageDefaults.pageBackgroundColor,
                      border: '1px solid #e2e8f0',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                      {String(activeDesignSystem.pageDefaults.pageFormat).toUpperCase()}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Pozadí · {activeDesignSystem.pageDefaults.pageBackgroundColor}
                    </div>
                  </div>
                </div>
                <p style={{ ...bodyMuted, fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>
                  Mřížka: {activeDesignSystem.pageDefaults.gridColumns} sloupců · mezera{' '}
                  {activeDesignSystem.pageDefaults.gridGap}. Výchozí vzhled nových bloků v{' '}
                  <code style={{ fontSize: 9, color: '#94a3b8' }}>defaultVisualStyles</code> — úpravy v klasickém panelu
                  Design systém.
                </p>

                <div
                  style={{
                    borderTop: '1px solid #e2e8f0',
                    paddingTop: 14,
                    marginTop: 4,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#64748b',
                      letterSpacing: '0.04em',
                      marginBottom: 2,
                    }}
                  >
                    Primární layouty
                  </div>
                  <div style={{ fontSize: 9, color: '#64748b', marginBottom: 10, lineHeight: 1.35 }}>
                    Skupiny layoutů na stránce — AI vzory a pravidla; kliknutím otevřeš propojený layout v editoru.
                  </div>
                  {activeDesignSystem.blockPreferences.pageLayoutGroups &&
                  activeDesignSystem.blockPreferences.pageLayoutGroups.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {activeDesignSystem.blockPreferences.pageLayoutGroups.map((g: DesignSystemPageLayoutGroup) => {
                        const linkedId = pageLayoutGroupCustomLayoutId(g.id);
                        const linked = activeDesignSystem.blockPreferences.customLayouts?.find(
                          (l) => l.id === linkedId,
                        );
                        const hasBlocks = Boolean(linked?.blocks?.length);
                        return (
                          <div
                            key={g.id}
                            style={{
                              borderRadius: 12,
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#f8fafc',
                              padding: 10,
                            }}
                          >
                            <div
                              style={{
                                width: '100%',
                                borderRadius: 10,
                                overflow: 'hidden',
                                marginBottom: 8,
                                display: 'flex',
                                justifyContent: 'center',
                              }}
                            >
                              {hasBlocks ? (
                                <StrankaLayoutyThumbnail
                                  ds={activeDesignSystem}
                                  blocks={linked!.blocks as WorksheetBlock[]}
                                  worksheetSuffix={g.id}
                                  maxWidthPx={STRANKA_LAYOUTY_CARD_PREVIEW_W}
                                  maxHeightPx={STRANKA_LAYOUTY_CARD_PREVIEW_H}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: STRANKA_LAYOUTY_CARD_PREVIEW_W,
                                    height: STRANKA_LAYOUTY_CARD_PREVIEW_H,
                                    overflow: 'hidden',
                                    borderRadius: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    ...LAYOUT_THUMB_FRAME,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: '100%',
                                      overflow: 'hidden',
                                      display: 'flex',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <PageLayoutGroupCardPreview
                                      ds={activeDesignSystem}
                                      group={g}
                                      compact
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: '#0f172a',
                                    lineHeight: 1.25,
                                  }}
                                >
                                  {g.title}
                                </div>
                              </div>
                              <button
                                type="button"
                                title="Upravit v editoru"
                                aria-label="Upravit v editoru"
                                onClick={() => openPageLayoutGroupInEditor(g)}
                                style={{
                                  flexShrink: 0,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 32,
                                  height: 32,
                                  padding: 0,
                                  borderRadius: 8,
                                  border: '1px solid #e2e8f0',
                                  backgroundColor: '#ffffff',
                                  color: '#475569',
                                  cursor: 'pointer',
                                }}
                              >
                                <PenLine size={15} strokeWidth={2} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ margin: '0 0 14px', fontSize: 10, lineHeight: 1.45, color: '#64748b' }}>
                      Zatím žádné primární vzory — po generování design systému z briefu se doplní.
                    </p>
                  )}
                </div>

                <div
                  style={{
                    borderTop: '1px solid #e2e8f0',
                    paddingTop: 14,
                    marginTop: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#64748b',
                      letterSpacing: '0.04em',
                      marginBottom: 2,
                    }}
                  >
                    Sekundární layouty
                  </div>
                  <div style={{ fontSize: 9, color: '#64748b', marginBottom: 10, lineHeight: 1.35 }}>
                    Další uložené šablony (12sloupcová mřížka), které nejsou duplicitou primárních — úpravy v klasickém
                    editoru → záložka Layout.
                  </div>
                {LAYOUT_BUCKET_ORDER.every((b) => layoutBucketsSecondary[b].length === 0) ? (
                  <p style={{ margin: 0, fontSize: 10, lineHeight: 1.5, color: '#64748b' }}>
                    Zatím žádné další — po vygenerování nebo po přidání vlastního layoutu se objeví zde.
                  </p>
                ) : (
                  LAYOUT_BUCKET_ORDER.map((bucket) => {
                    const items = layoutBucketsSecondary[bucket];
                    if (items.length === 0) return null;
                    return (
                      <div key={bucket} style={{ marginBottom: 14 }}>
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: '#64748b',
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            marginBottom: 8,
                          }}
                        >
                          {LAYOUT_BUCKET_LABELS[bucket]}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {items.map((cl) => {
                            const svg =
                              cl.blocks?.length ? null : layoutPreviewSvgFromBlocks(cl.blocks ?? []);
                            const thumbSuffix =
                              pageLayoutGroupIdFromCustomLayoutId(cl.id) ?? cl.id;
                            return (
                              <div
                                key={cl.id}
                                style={{
                                  borderRadius: 12,
                                  border: '1px solid #e2e8f0',
                                  backgroundColor: '#f8fafc',
                                  padding: 10,
                                }}
                              >
                                  <div
                                    style={{
                                    width: '100%',
                                    borderRadius: 10,
                                    overflow: 'hidden',
                                    marginBottom: 8,
                                    display: 'flex',
                                    justifyContent: 'center',
                                  }}
                                >
                                  {cl.blocks?.length ? (
                                    <StrankaLayoutyThumbnail
                                      ds={activeDesignSystem}
                                      blocks={cl.blocks as WorksheetBlock[]}
                                      worksheetSuffix={thumbSuffix}
                                      maxWidthPx={STRANKA_LAYOUTY_CARD_PREVIEW_W}
                                      maxHeightPx={STRANKA_LAYOUTY_CARD_PREVIEW_H}
                                    />
                                  ) : svg ? (
                                    <div
                                      style={{
                                        width: STRANKA_LAYOUTY_CARD_PREVIEW_W,
                                        height: STRANKA_LAYOUTY_CARD_PREVIEW_H,
                                      borderRadius: 8,
                                      overflow: 'hidden',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                        ...LAYOUT_THUMB_FRAME,
                                    }}
                                    title="Náhled rozložení"
                                  >
                                      <div
                                        style={{
                                          transform: 'scale(1.08)',
                                          transformOrigin: 'center center',
                                          lineHeight: 0,
                                        }}
                                        dangerouslySetInnerHTML={{ __html: svg }}
                                      />
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        width: STRANKA_LAYOUTY_CARD_PREVIEW_W,
                                        height: STRANKA_LAYOUTY_CARD_PREVIEW_H,
                                        borderRadius: 8,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        ...LAYOUT_THUMB_FRAME,
                                      }}
                                      title="Náhled rozložení"
                                    >
                                      <span style={{ fontSize: 9, color: '#94a3b8' }}>—</span>
                                    </div>
                                    )}
                                  </div>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 8,
                                  }}
                                >
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                      <div
                                        style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: '#0f172a',
                                        lineHeight: 1.25,
                                      }}
                                    >
                                      {cl.name}
                                      </div>
                                  </div>
                                    <button
                                      type="button"
                                    title="Upravit v editoru"
                                    aria-label="Upravit v editoru"
                                      onClick={() => onOpenClassicEditor(cl.id, activeDesignSystem)}
                                      style={{
                                      flexShrink: 0,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                      justifyContent: 'center',
                                      width: 32,
                                      height: 32,
                                      padding: 0,
                                        borderRadius: 8,
                                      border: '1px solid #e2e8f0',
                                      backgroundColor: '#ffffff',
                                      color: '#475569',
                                        cursor: 'pointer',
                                      }}
                                    >
                                    <PenLine size={15} strokeWidth={2} />
                                    </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
                </div>
              </div>

              <div
                style={{
                  ...CARD_PAGE_PREVIEWS,
                  position: 'absolute',
                  left: CANVAS_PAGE_PREVIEWS_LEFT,
                  top: CANVAS_BLOCKS_TOP,
                  maxHeight: 'none',
                  overflow: 'visible',
                }}
              >
                <div style={labelCap}>NÁHLEDY STRÁNEK</div>
                <p style={{ margin: '0 0 10px', fontSize: 11, lineHeight: 1.45, color: '#64748b' }}>
                  Jeden souvislý dokument: úvod + všechny AI layouty pod sebou (PrintGridCanvas jako v knize). Delší
                  náhodný text; obrázky z referencí, případně z „Vygenerovat příklad“. Bez obrázků se použije neutrální
                  výplň.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => setPreviewRefreshKey((k) => k + 1)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 12px',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      backgroundColor: '#f8fafc',
                      color: '#334155',
                    }}
                  >
                    <RefreshCw size={14} />
                    Aktualizovat
                  </button>
                </div>
                <div
                  style={{
                    width: 248,
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
                  }}
                >
                  {flowPreviewWorksheet ? (
                    <WorkbookLiveFlowPreview
                      worksheet={flowPreviewWorksheet}
                      containerWidth={248}
                      borderRadius="0"
                      maxScrollHeight={880}
                      onOpenPageInEditor={bookEditorContext ? handleOpenFlowPageInEditor : undefined}
                    />
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </InfiniteCanvas>
      {!activeDesignSystem ? (
        <div style={ONBOARDING_CENTER_STACK}>
          <div style={ONBOARDING_COMPOSER_BOX}>
            <div style={{ padding: '14px 16px 10px' }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#64748b',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                Nový design systém
              </div>
              {zadaniBriefAttachmentFiles.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  {zadaniBriefAttachmentFiles.map((f) => (
                    <div
                      key={f.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '4px 10px 4px 4px',
                        borderRadius: 8,
                        border: '1px solid rgba(71, 85, 105, 0.95)',
                        backgroundColor: 'rgba(15, 23, 42, 0.55)',
                        maxWidth: '100%',
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          flexShrink: 0,
                          overflow: 'hidden',
                          backgroundColor: '#0f172a',
                          backgroundImage: f.url ? `url(${f.url})` : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      />
                      <span
                        style={{
                          fontSize: 12,
                          color: '#e2e8f0',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 200,
                        }}
                        title={f.name}
                      >
                        {clipText(f.name, 28)}
                      </span>
                      <button
                        type="button"
                        aria-label="Odebrat přílohu"
                        onClick={() => removeOnboardingAttachment(f.id)}
                        style={{
                          padding: 4,
                          border: 'none',
                          borderRadius: 6,
                          background: 'transparent',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Detailně popište váš vizuální styl pro knihu nebo nahrajte vzorové stránky"
                rows={4}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  resize: 'none',
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: '#f8fafc',
                  minHeight: 96,
                  padding: '4px 2px',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            <div
              style={{
                borderTop: '1px solid rgba(51, 65, 85, 0.75)',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                backgroundColor: 'rgba(15, 23, 42, 0.35)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  onClick={openOnboardingFilePicker}
                  disabled={referenceUploading || referenceResolutionFiles.length >= MAX_REFERENCE_IMAGES}
                  title="Přidat obrázek"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(51, 65, 85, 0.55)',
                    color: '#cbd5e1',
                    cursor:
                      referenceUploading || referenceResolutionFiles.length >= MAX_REFERENCE_IMAGES ? 'not-allowed' : 'pointer',
                    opacity: referenceUploading || referenceResolutionFiles.length >= MAX_REFERENCE_IMAGES ? 0.45 : 1,
                  }}
                >
                  {referenceUploading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={20} strokeWidth={2} />}
                </button>
                <button
                  type="button"
                  onClick={openOnboardingFilePicker}
                  disabled={referenceUploading || referenceResolutionFiles.length >= MAX_REFERENCE_IMAGES}
                  title="Nahrát stránky / screenshot (vějíř)"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(51, 65, 85, 0.55)',
                    color: '#cbd5e1',
                    cursor:
                      referenceUploading || referenceResolutionFiles.length >= MAX_REFERENCE_IMAGES ? 'not-allowed' : 'pointer',
                    opacity: referenceUploading || referenceResolutionFiles.length >= MAX_REFERENCE_IMAGES ? 0.45 : 1,
                  }}
                >
                  <span
                    style={{
                      position: 'relative',
                      display: 'inline-block',
                      width: 22,
                      height: 20,
                    }}
                  >
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        style={{
                          position: 'absolute',
                          left: i * 4,
                          bottom: 0,
                          width: 13,
                          height: 17,
                          borderRadius: 2,
                          border: '1px solid rgba(148, 163, 184, 0.5)',
                          backgroundColor: i === 2 ? 'rgba(30, 41, 59, 0.95)' : 'rgba(30, 41, 59, 0.35)',
                          transform: `rotate(${-8 + i * 5}deg)`,
                          transformOrigin: 'bottom left',
                          zIndex: i,
                        }}
                      />
                    ))}
                  </span>
                </button>
              </div>
              <button
                type="button"
                disabled={!canGenerate}
                onClick={() => void handleGenerate()}
                title={
                  canGenerate
                    ? hasVisionForGenerate && brief.trim().length < DESIGN_SYSTEM_BRIEF_MIN_CHARS
                      ? 'Vytvořit design systém'
                      : 'Vytvořit design systém'
                    : `Napiš aspoň ${DESIGN_SYSTEM_BRIEF_MIN_CHARS} znaků, nebo nahraj obrázek.`
                }
                style={{
                  width: 40,
                  height: 40,
                  flexShrink: 0,
                  borderRadius: 8,
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canGenerate ? 'pointer' : 'not-allowed',
                  opacity: canGenerate ? 1 : 0.4,
                  backgroundColor: '#6366f1',
                  color: '#f8fafc',
                }}
              >
                {generating ? <Loader2 size={20} className="animate-spin" /> : <ArrowUp size={20} strokeWidth={2.5} />}
              </button>
            </div>
          </div>
          <div
            style={{
              width: '100%',
              marginTop: 14,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <p
              style={{
                margin: '0 0 8px',
                fontSize: 12,
                fontWeight: 500,
                color: '#94a3b8',
                lineHeight: 1.4,
                textAlign: 'center',
                width: '100%',
                maxWidth: 360,
              }}
            >
              Nebo vyberte styl z knihovny
            </p>
            <div ref={onboardingLibraryRef} style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
              <button
                type="button"
                aria-expanded={onboardingLibraryOpen}
                aria-haspopup="listbox"
                onClick={() => setOnboardingLibraryOpen((o) => !o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(71, 85, 105, 0.9)',
                  backgroundColor: 'rgba(30, 41, 59, 0.85)',
                  color: '#e2e8f0',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Hotový styl z knihovny
                </span>
                <ChevronDown
                  size={16}
                  style={{
                    flexShrink: 0,
                    color: '#94a3b8',
                    transform: onboardingLibraryOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
                  }}
                />
              </button>
              {onboardingLibraryOpen ? (
                <DesignSystemLibraryMenuList
                  libraryLoading={libraryLoading}
                  libraryList={libraryList}
                  activeDesignSystem={activeDesignSystem}
                  selectDesignSystemFromLibrary={selectDesignSystemFromLibrary}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
          </div>
        </div>
      </div>

      {typoPopupLevel && activeDesignSystem ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 400,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setTypoPopupLevel(null)}
        >
          <div
            role="dialog"
            aria-modal
            aria-labelledby="ds-typo-popup-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(380px, calc(100vw - 32px))',
              maxHeight: 'min(88vh, 680px)',
              overflowY: 'auto',
              borderRadius: 16,
              backgroundColor: '#1e293b',
              border: '1px solid rgba(71, 85, 105, 0.95)',
              boxShadow: '0 24px 56px rgba(0, 0, 0, 0.55)',
              padding: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div id="ds-typo-popup-title">
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#94a3b8',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  Písmový styl
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>
                  {TYPO_LEVELS.find((l) => l.id === typoPopupLevel)?.label ?? typoPopupLevel}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTypoPopupLevel(null)}
                aria-label="Zavřít"
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: '1px solid #475569',
                  backgroundColor: '#334155',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                }}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <div
              style={{
                paddingTop: 4,
                borderTop: '1px solid rgba(51, 65, 85, 0.85)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#94a3b8',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}
              >
                Další nastavení
              </div>
              <TypoStyleSettings
                variant="dialog"
                styleId={typoPopupLevel}
                typography={activeDesignSystem.typography}
                onChange={(ty) => applyDesignSystemPatch((ds) => ({ ...ds, typography: ty }))}
              />
            </div>
          </div>
        </div>
      ) : null}

      {typoBaseFontOpen && activeDesignSystem ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 400,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setTypoBaseFontOpen(null)}
        >
          <div
            role="dialog"
            aria-modal
            aria-labelledby="ds-base-font-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(420px, calc(100vw - 32px))',
              borderRadius: 16,
              backgroundColor: '#1e293b',
              border: '1px solid rgba(71, 85, 105, 0.95)',
              boxShadow: '0 24px 56px rgba(0, 0, 0, 0.55)',
              padding: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div id="ds-base-font-title">
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#94a3b8',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  {typoBaseFontOpen === 'heading' ? 'Primární font' : 'Sekundární font'}
    </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.45, maxWidth: 320 }}>
                  {typoBaseFontOpen === 'heading'
                    ? 'Nastaví font pro nadpisy a zruší vlastní výběr písma u stylů Nadpis 1–3, aby všechny nadpisy použily tento základ.'
                    : 'Nastaví font pro text a zruší vlastní výběr písma u Odstavec a Popisek, pokud dědily sekundární font.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTypoBaseFontOpen(null)}
                aria-label="Zavřít"
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: '1px solid #475569',
                  backgroundColor: '#334155',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                }}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <label
              id="ds-base-font-label"
              htmlFor="ds-base-font-select"
              style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}
            >
              Rodina písma
            </label>
            <FontFamilySelect
              id="ds-base-font-select"
              aria-labelledby="ds-base-font-label"
              value={typoBaseFontOpen === 'heading' ? headingFontSelectValue : bodyFontSelectValue}
              options={fontPickListOptions}
              onChange={(v) => {
                applyBaseFontFromPicklist(typoBaseFontOpen, v);
                setTypoBaseFontOpen(null);
              }}
              triggerStyle={{
                padding: '10px 12px',
                minHeight: 44,
                borderRadius: 10,
                border: '1px solid #475569',
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                fontSize: 13,
              }}
              listBoxStyle={{
                backgroundColor: '#0f172a',
                border: '1px solid #475569',
              }}
              chevronColor="#94a3b8"
              listMaxHeight={320}
            />
          </div>
        </div>
      ) : null}

      <PresetIllustrationStylesPicker
        open={presetStylesPickerOpen}
        onClose={() => setPresetStylesPickerOpen(false)}
        onSelect={handleApplyPresetIllustrationStyle}
        appliedPresetIds={appliedPresetCatalogIds}
        datasetThumbnailByPresetCatalogId={presetPickerDatasetThumbnails}
      />

      {paletteSwatchEdit && activeDesignSystem ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 400,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setPaletteSwatchEdit(null)}
        >
          <div
            role="dialog"
            aria-modal
            aria-labelledby="ds-palette-color-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(300px, calc(100vw - 32px))',
              borderRadius: 16,
              backgroundColor: '#1e293b',
              border: '1px solid rgba(71, 85, 105, 0.95)',
              boxShadow: '0 24px 56px rgba(0, 0, 0, 0.55)',
              padding: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div id="ds-palette-color-title">
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#94a3b8',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  Barva palety
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.45 }}>
                  Upraví hodnotu v paletě design systému (stejně jako v sekci Barvy).
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaletteSwatchEdit(null)}
                aria-label="Zavřít"
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: '1px solid #475569',
                  backgroundColor: '#334155',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                }}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <div
              style={{
                backgroundColor: '#1c2128',
                border: '1px solid #30363d',
                borderRadius: 12,
                padding: 14,
              }}
            >
              <ColorSwatchEditForm
                swatch={paletteSwatchEdit.swatch}
                onSave={(p) => {
                  patchPaletteSwatch(paletteSwatchEdit.groupId, paletteSwatchEdit.swatch.id, p);
                  setPaletteSwatchEdit(null);
                }}
                onClose={() => setPaletteSwatchEdit(null)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {blockVisualPresetEditId &&
      activeDesignSystem &&
      blockVisualPresetsList.some((p) => p.id === blockVisualPresetEditId) ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 400,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setBlockVisualPresetEditId(null)}
        >
          <div
            role="dialog"
            aria-modal
            aria-labelledby="ds-block-visual-preset-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(440px, calc(100vw - 32px))',
              maxHeight: 'min(88vh, 720px)',
              overflowY: 'auto',
              borderRadius: 16,
              backgroundColor: '#1e293b',
              border: '1px solid rgba(71, 85, 105, 0.95)',
              boxShadow: '0 24px 56px rgba(0, 0, 0, 0.55)',
              padding: 18,
            }}
          >
            {(() => {
              const pr = blockVisualPresetsList.find((p) => p.id === blockVisualPresetEditId);
              if (!pr) return null;
              return (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div id="ds-block-visual-preset-title">
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: '#94a3b8',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          marginBottom: 4,
                        }}
                      >
                        Vizuální styl bloku
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{pr.name}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBlockVisualPresetEditId(null)}
                      aria-label="Zavřít"
                      style={{
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        border: '1px solid #475569',
                        backgroundColor: '#334155',
                        color: '#e2e8f0',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={18} strokeWidth={2} />
                    </button>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label
                      htmlFor="ds-bvs-name"
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: '#94a3b8',
                        letterSpacing: '0.06em',
                        display: 'block',
                        marginBottom: 6,
                      }}
                    >
                      Název
                    </label>
                    <input
                      id="ds-bvs-name"
                      value={pr.name}
                      onChange={(e) => patchBlockVisualPreset(pr.id, pr.styles, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid #475569',
                        backgroundColor: '#0f172a',
                        color: '#e2e8f0',
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      paddingTop: 4,
                      borderTop: '1px solid rgba(51, 65, 85, 0.85)',
                    }}
                  >
                    <DesignSystemBlockVisualStyleFields
                      styles={pr.styles}
                      onChange={(next) => patchBlockVisualPreset(pr.id, next)}
                      designSystem={activeDesignSystem}
                    />
                  </div>
                  <p style={{ margin: '12px 0 0', fontSize: 10, lineHeight: 1.45, color: '#64748b' }}>
                    Stejné nastavení jako v editoru listu (Další nastavení u vzhledu bloku). Výchozí typ pro nové bloky
                    nastavíš u náhledu na kartě.
                  </p>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

      {visualStylePopupKey && activeDesignSystem ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 401,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setVisualStylePopupKey(null)}
        >
          <div
            role="dialog"
            aria-modal
            aria-labelledby="ds-visual-style-popup-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(420px, calc(100vw - 32px))',
              maxHeight: 'min(88vh, 720px)',
              overflowY: 'auto',
              borderRadius: 16,
              backgroundColor: '#1e293b',
              border: '1px solid rgba(71, 85, 105, 0.95)',
              boxShadow: '0 24px 56px rgba(0, 0, 0, 0.55)',
              padding: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div id="ds-visual-style-popup-title">
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#94a3b8',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  Vizuální styl
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>
                  {VISUAL_STYLE_NOTE_FIELDS.find((f) => f.key === visualStylePopupKey)?.label ?? visualStylePopupKey}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVisualStylePopupKey(null)}
                aria-label="Zavřít"
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: '1px solid #475569',
                  backgroundColor: '#334155',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                }}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <div style={{ paddingTop: 4, borderTop: '1px solid rgba(51, 65, 85, 0.85)' }}>
              {visualStylePopupKey === 'pageBackground' ? (
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#94a3b8',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      marginBottom: 10,
                    }}
                  >
                    Barva pozadí stránky
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                    {PAGE_BG_SWATCHES.map((bg) => (
                      <button
                        key={bg}
                        type="button"
                        title={bg}
                        onClick={() =>
                          applyDesignSystemPatch((ds) => ({
                            ...ds,
                            pageDefaults: { ...ds.pageDefaults, pageBackgroundColor: bg },
                          }))
                        }
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          backgroundColor: bg,
                          border:
                            activeDesignSystem.pageDefaults.pageBackgroundColor === bg
                              ? '2px solid #818cf8'
                              : '1px solid #475569',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      />
                    ))}
                    <button
                      type="button"
                      title="Vlastní barva"
                      onClick={() => {
                        const i = document.createElement('input');
                        i.type = 'color';
                        i.value = activeDesignSystem.pageDefaults.pageBackgroundColor;
                        i.onchange = (e) => {
                          applyDesignSystemPatch((ds) => ({
                            ...ds,
                            pageDefaults: {
                              ...ds.pageDefaults,
                              pageBackgroundColor: (e.target as HTMLInputElement).value,
                            },
                          }));
                        };
                        i.click();
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: '1px dashed #64748b',
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        color: '#94a3b8',
                      }}
                    >
                      <Palette size={14} strokeWidth={2} />
                    </button>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.4 }}>
                    Formát stránky ({activeDesignSystem.pageDefaults.pageFormat.toUpperCase()}) upravíš v klasickém
                    editoru Design systém → záložka Layout.
                  </div>
                </div>
              ) : null}

              {visualStylePopupKey === 'paragraphText' ? (
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#94a3b8',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      marginBottom: 12,
                    }}
                  >
                    Typografie odstavce
                  </div>
                  <TypoStyleSettings
                    variant="dialog"
                    styleId="body"
                    typography={activeDesignSystem.typography}
                    onChange={(ty) => applyDesignSystemPatch((ds) => ({ ...ds, typography: ty }))}
                  />
                </div>
              ) : null}

              {visualStylePopupKey === 'contentBlocks' ? (
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#94a3b8',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    Výchozí vzhled obsahových bloků
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: 10, lineHeight: 1.45, color: '#64748b' }}>
                    Nové bloky (kromě layoutu, hlavičky, mezery) dostanou tento styl.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {BLOCK_VISUAL_STYLE_PRESETS.map((preset) => {
                      const activeId = matchDsDefaultBlockPresetId(activeDesignSystem.blockPreferences.defaultVisualStyles);
                      const isActive = activeId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            const curVs = activeDesignSystem.blockPreferences.defaultVisualStyles ?? {};
                            const keepPad =
                              typeof curVs.padding === 'number' && Number.isFinite(curVs.padding)
                                ? Math.min(64, Math.max(0, Math.round(curVs.padding)))
                                : 12;
                            if (preset.id === 'none') {
                              applyDesignSystemPatch((ds) => ({
                                ...ds,
                                blockPreferences: {
                                  ...ds.blockPreferences,
                                  defaultVisualStyles: { padding: keepPad },
                                },
                              }));
                            } else {
                              applyDesignSystemPatch((ds) => ({
                                ...ds,
                                blockPreferences: {
                                  ...ds.blockPreferences,
                                  defaultVisualStyles: {
                                    ...(preset.styles as BlockVisualStyles),
                                    padding: keepPad,
                                  },
                                },
                              }));
                            }
                          }}
                          style={{
                            padding: '8px 6px',
                            borderRadius: 8,
                            border: `1px solid ${isActive ? '#818cf8' : '#475569'}`,
                            backgroundColor: isActive ? 'rgba(129, 140, 248, 0.2)' : 'rgba(30, 41, 59, 0.85)',
                            cursor: 'pointer',
                            fontSize: 10,
                            fontWeight: isActive ? 700 : 500,
                            color: isActive ? '#e0e7ff' : '#94a3b8',
                            textAlign: 'center',
                            lineHeight: 1.25,
                          }}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                  {matchDsDefaultBlockPresetId(activeDesignSystem.blockPreferences.defaultVisualStyles) === 'custom' ? (
                    <p style={{ margin: '10px 0 0', fontSize: 10, color: '#fcd34d', lineHeight: 1.35 }}>
                      Je uložen vlastní vzhled — výběrem presetu ho přepíšeš.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {visualStylePopupKey === 'embeddedImage' ? (
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#94a3b8',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      marginBottom: 12,
                    }}
                  >
                    Popisek pod obrázkem
                  </div>
                  <TypoStyleSettings
                    variant="dialog"
                    styleId="caption"
                    typography={activeDesignSystem.typography}
                    onChange={(ty) => applyDesignSystemPatch((ds) => ({ ...ds, typography: ty }))}
                  />
                  <p style={{ margin: '12px 0 0', fontSize: 10, lineHeight: 1.45, color: '#64748b' }}>
                    Zaoblení rámečku náhledu bereš z výchozího vzhledu bloku (Infobox…) výše.
                  </p>
                </div>
              ) : null}

              {visualStylePopupKey === 'padding' ? (
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#94a3b8',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      marginBottom: 10,
                    }}
                  >
                    Mřížka listu
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Sloupce</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                    {([1, 2, 3, 6, 12] as GridColumns[]).map((c) => {
                      const on = activeDesignSystem.pageDefaults.gridColumns === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() =>
                            applyDesignSystemPatch((ds) => ({
                              ...ds,
                              pageDefaults: { ...ds.pageDefaults, gridColumns: c },
                            }))
                          }
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: `1px solid ${on ? '#818cf8' : '#475569'}`,
                            backgroundColor: on ? 'rgba(129, 140, 248, 0.25)' : 'rgba(30, 41, 59, 0.85)',
                            color: '#e2e8f0',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Mezera mezi bloky</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(['none', 'small', 'medium', 'large'] as GridGap[]).map((g) => {
                      const on = activeDesignSystem.pageDefaults.gridGap === g;
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() =>
                            applyDesignSystemPatch((ds) => ({
                              ...ds,
                              pageDefaults: { ...ds.pageDefaults, gridGap: g },
                            }))
                          }
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: `1px solid ${on ? '#818cf8' : '#475569'}`,
                            backgroundColor: on ? 'rgba(129, 140, 248, 0.25)' : 'rgba(30, 41, 59, 0.85)',
                            color: '#e2e8f0',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {GRID_GAP_LABEL_CS[g]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div
                style={{
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: '1px solid rgba(51, 65, 85, 0.85)',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#94a3b8',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Poznámka pro AI (nepovinná)
                </div>
                <textarea
                  value={activeDesignSystem.blockPreferences.visualStyleNotes?.[visualStylePopupKey] ?? ''}
                  onChange={(e) => patchVisualStyleNote(visualStylePopupKey, e.target.value)}
                  placeholder={
                    VISUAL_STYLE_NOTE_FIELDS.find((f) => f.key === visualStylePopupKey)?.placeholder ?? ''
                  }
                  rows={3}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid rgba(71, 85, 105, 0.75)',
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    color: '#f1f5f9',
                    fontSize: 11,
                    lineHeight: 1.45,
                    resize: 'vertical',
                    minHeight: 56,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
