import type { BlockType, BlockVisualStyles, GridColumns, GridGap, GlobalFontSize } from './worksheet';
import { GOOGLE_FONTS_CATALOG } from '../data/google-fonts-catalog';

// ============================================================
// COLOR PALETTE
// ============================================================

export interface ColorSwatch {
  id: string;
  name: string;
  value: string; // hex color, e.g. '#3B82F6'
}

export interface ColorGroup {
  id: string;
  name: string;
  swatches: ColorSwatch[];
}

/** Unikátní swatche z design systému pro color picker (deduplikace podle hodnoty). */
export function flattenDesignSystemSwatchesForPicker(
  groups: ColorGroup[] | undefined,
): Array<{ id: string; name: string; value: string }> {
  if (!groups?.length) return [];
  const out: Array<{ id: string; name: string; value: string }> = [];
  const seen = new Set<string>();
  for (const g of groups) {
    for (const s of g.swatches ?? []) {
      const raw = (s.value ?? '').trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: s.id || `${g.id}-${raw}`,
        name: s.name || raw,
        value: raw,
      });
    }
  }
  return out;
}

// ============================================================
// TYPOGRAPHY
// ============================================================

export interface TypoStyleOverride {
  fontFamily?: string;
  fontSize?: number;       // pt, e.g. 36 for H1
  fontWeight?: number;     // 400 | 500 | 600 | 700
  lineHeight?: number;     // e.g. 1.5
  letterSpacing?: number;  // em, e.g. 0
  textAlign?: 'left' | 'center' | 'right';
  textColor?: string;      // hex color, e.g. '#1E293B'
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
}

export interface DesignSystemTypography {
  headingFont: string;
  bodyFont: string;
  baseFontSize: GlobalFontSize;
  /**
   * @deprecated Uložené starší projekty; UI už pole nepoužívá — výběr je z celého katalogu.
   */
  enabledGoogleFonts?: string[];
  /** Per-style overrides — optional, backward-compatible */
  styles?: {
    h1?: TypoStyleOverride;
    h2?: TypoStyleOverride;
    h3?: TypoStyleOverride;
    body?: TypoStyleOverride;
    caption?: TypoStyleOverride;
  };
}

/** Curated font list suitable for educational books */
export const CURATED_FONTS: { label: string; value: string; stack: string; category: 'serif' | 'sans-serif' | 'display' | 'mono' }[] = [
  // Sans-serif
  { label: 'Inter', value: 'Inter', stack: "'Inter', sans-serif", category: 'sans-serif' },
  { label: 'Nunito', value: 'Nunito', stack: "'Nunito', sans-serif", category: 'sans-serif' },
  { label: 'Poppins', value: 'Poppins', stack: "'Poppins', sans-serif", category: 'sans-serif' },
  { label: 'Raleway', value: 'Raleway', stack: "'Raleway', sans-serif", category: 'sans-serif' },
  { label: 'DM Sans', value: 'DM Sans', stack: "'DM Sans', sans-serif", category: 'sans-serif' },
  { label: 'Outfit', value: 'Outfit', stack: "'Outfit', sans-serif", category: 'sans-serif' },
  { label: 'Source Sans Pro', value: 'Source Sans 3', stack: "'Source Sans 3', sans-serif", category: 'sans-serif' },
  { label: 'Open Sans', value: 'Open Sans', stack: "'Open Sans', sans-serif", category: 'sans-serif' },
  // Serif
  { label: 'Lora', value: 'Lora', stack: "'Lora', serif", category: 'serif' },
  { label: 'Merriweather', value: 'Merriweather', stack: "'Merriweather', serif", category: 'serif' },
  { label: 'Playfair Display', value: 'Playfair Display', stack: "'Playfair Display', serif", category: 'serif' },
  { label: 'PT Serif', value: 'PT Serif', stack: "'PT Serif', serif", category: 'serif' },
  { label: 'Georgia', value: 'Georgia', stack: "Georgia, serif", category: 'serif' },
  // Display
  { label: 'Fraunces', value: 'Fraunces', stack: "'Fraunces', serif", category: 'display' },
  { label: 'Space Grotesk', value: 'Space Grotesk', stack: "'Space Grotesk', sans-serif", category: 'display' },
  { label: 'Sora', value: 'Sora', stack: "'Sora', sans-serif", category: 'display' },
  // Mono
  { label: 'JetBrains Mono', value: 'JetBrains Mono', stack: "'JetBrains Mono', monospace", category: 'mono' },
  // System fallbacks
  { label: 'Arial', value: 'Arial', stack: "Arial, sans-serif", category: 'sans-serif' },
  { label: 'Helvetica', value: 'Helvetica Neue', stack: "'Helvetica Neue', Helvetica, sans-serif", category: 'sans-serif' },
];

// ============================================================
// PAGE DEFAULTS
// ============================================================

export type PageFormat = 'a4' | 'b5' | 'a5';

export interface DesignSystemPageDefaults {
  pageFormat: PageFormat;
  pageBackgroundColor: string;
  gridColumns: GridColumns;
  gridGap: GridGap;
}

// ============================================================
// AI PROMPTS
// ============================================================

export interface DesignSystemAIPrompts {
  /** Style prompt auto-injected into all AI image generation calls */
  imageStyle: string;
  /** What to avoid in AI generated images */
  negativePrompt?: string;
  /** Consistent character/style description */
  characterStyle?: string;
}

// ============================================================
// BLOCK PREFERENCES
// ============================================================

/** Skupina na náhledu canvasu / v editoru (AI nebo ručně). */
export type LayoutSeriesGroup = 'column' | 'half' | 'twothirds';

export interface CustomLayout {
  id: string;
  name: string;
  /** Kdy layout použít (AI / poznámka) */
  description?: string;
  layoutGroup?: LayoutSeriesGroup;
  /** Serialized WorksheetBlock[] */
  blocks: any[];
}

/**
 * Poznámky k vizuálnímu stylu stránky a bloků (plátno design systému).
 * Doplňuje strukturovaná `pageDefaults` a `defaultVisualStyles` — vhodné pro lidský popis a AI kontext.
 */
export interface DesignSystemVisualStyleNotes {
  /** Barva pozadí stránky (hex, odstín, vztah k paletě…) */
  pageBackground?: string;
  /** Jak má vypadat běžný odstavec textu */
  paragraphText?: string;
  /** Infobox, tabulka a další obsahové bloky — rámeček, stín, pozadí… */
  contentBlocks?: string;
  /** Vložený obrázek — kulaté/ostré rohy, popisek, zarovnání… */
  embeddedImage?: string;
  /** Odsazení (stránka, bloky, mřížka) */
  padding?: string;
}

/**
 * Co z referenčního obrázku agent promítl do design tokenů (Design systém 2 — generování z briefu).
 * `catalogIndex` = pořadí v katalogu v uživatelské zprávě k AI (1 = první soubor).
 */
export const REFERENCE_ASSET_INFORMS = [
  'page_background',
  'page_grid',
  'typography',
  'color_palette',
  'content_block_chrome',
  'figure_and_caption',
  'illustration_style',
  'layout_templates',
] as const;

export type ReferenceAssetInforms = (typeof REFERENCE_ASSET_INFORMS)[number];

export interface DesignSystemReferenceAssetBinding {
  catalogIndex: number;
  informs: ReferenceAssetInforms[];
  /** Krátké zdůvodnění česky (proč tato reference pro tyto části) */
  rationale?: string;
}

/**
 * Jak složit mini-náhled na plátně — každý vzor má jinou skladbu, stejné tokeny vypadají jinak.
 * Doplňuje AI podle toho, co na stránce skutečně je.
 */
export const PAGE_LAYOUT_PREVIEW_KINDS = [
  /** Nadpis sekce nahoře, pod ním řádek cca ⅔ textový panel + ⅓ obrázek s popiskem. */
  'heading_row_infobox_image',
  /** Jeden široký infobox (výplň z tokenů), často lišta s nadpisem uvnitř, text + figura/ilustrace vedle sebe. */
  'wide_infobox_with_figure',
  /** Nadpis a pod ním souvislý text přes šířku — bez vedlejšího sloupce s obrázkem v jednom řádku. */
  'heading_body_full_width',
  /** Jen souvislý odstavcový text přes šířku (výklad, článek) — bez výrazného nadpisu sekce nebo dominantního obrázku. */
  'full_width_text',
  /** Dominantní fotka / ilustrace přes šířku (pás, hero, téměř celá stránka) + typicky popisek. */
  'full_width_image',
  /** Dva sloupce souvislého textu (novinová sazba). */
  'two_column_text',
  /** Bloky pod sebou v pevném pořadí (např. nadpis → obrázek → text, nebo obrázek → nadpis → text) — popiš pořadí v pravidlech. */
  'vertical_stack',
] as const;

export type DesignSystemPageLayoutPreviewKind = (typeof PAGE_LAYOUT_PREVIEW_KINDS)[number];

/**
 * Vzor „skupinového layoutu“ na stránce — pravidla vyčtená z referenčních screenshotů (AI).
 * Náhled v UI je složený z aktuálních design tokenů (ne z výřezů obrázků).
 */
export interface DesignSystemPageLayoutGroup {
  id: string;
  /**
   * Která skladba náhledu odpovídá tomuto vzoru (jinak by všechny karty vypadaly stejně).
   * Bez hodnoty se použije `heading_row_infobox_image`.
   */
  previewKind?: DesignSystemPageLayoutPreviewKind;
  /** Krátký název vzoru (česky), např. „Řádek: nadpis + infobox + obrázek“. */
  title: string;
  /**
   * Číslovaná pravidla (každý řádek = jeden bod; text bez nebo s vlastním číslováním).
   * Např. „Modrý nadpis vlevo nahoře“, „Infobox zabírá cca 2/3 šířky…“.
   */
  rules: string[];
  /** Které položky katalogu referencí (1-based) tento vzor nejvíc popisují. */
  sourceCatalogIndices?: number[];
}

/**
 * Jedna položka v seznamu „Vizuální styly bloků“ na plátně design systému (bez výplně, infobox, vlastní…).
 * Ukládá se v `block_preferences` (JSON).
 */
export interface DesignSystemBlockVisualStylePreset {
  id: string;
  /** Vestavěné: plain = bez rámečku, infobox = typický zvýrazněný box; vlastní = custom. */
  role?: 'plain' | 'infobox' | 'custom';
  name: string;
  styles: BlockVisualStyles;
}

export interface DesignSystemBlockPreferences {
  /** Block types highlighted with ★ in the Add Content panel */
  preferred: BlockType[];
  /**
   * Typy bloků povolené pro tuto publikaci (učebnice vs pracovní sešit).
   * AI je při generování z briefu navrhne podle zadání; uživatel může upravit checkboxy na canvasu.
   * Pokud chybí, použije se výchozí sada pro učebnici (bez cvičení).
   */
  generationBlockTypes?: BlockType[];
  /** User-created custom layout presets */
  customLayouts?: CustomLayout[];
  /**
   * Výchozí vzhled pro nově vkládané obsahové bloky (po aplikaci design systému na list).
   * Neaplikuje se na layout-section, header-footer, spacer.
   * Mělo by odpovídat položce s id `defaultBlockVisualPresetId` v `blockVisualStylePresets`.
   */
  defaultVisualStyles?: BlockVisualStyles;
  /**
   * Náhledy a nastavení typů bloků (bez výplně, infobox, …). Když chybí, UI odvodí výchozí stav z `defaultVisualStyles`.
   */
  blockVisualStylePresets?: DesignSystemBlockVisualStylePreset[];
  /** Který preset z `blockVisualStylePresets` se použije jako výchozí pro nové bloky. */
  defaultBlockVisualPresetId?: string;
  /** Textové poznámky ke kartě „Vizuální styl“ na plátně */
  visualStyleNotes?: DesignSystemVisualStyleNotes;
  /**
   * Po generování z briefu: který soubor z katalogu referencí ovlivnil které části designu.
   * Plní agent (`referenceAssetBindings` v JSON); UI může zobrazit u vizuálního stylu.
   */
  referenceAssetBindings?: DesignSystemReferenceAssetBinding[];
  /**
   * Skupiny layoutů na stránce — opakující se vzory z nahraných stránek (nadpis + řádky, infobox + obrázek…).
   * Plní AI při generování z briefu; náhled v editoru skládá tokeny.
   */
  pageLayoutGroups?: DesignSystemPageLayoutGroup[];
}

/** Volby pro UI / výchozí hodnoty — které bloky patří do „učebnice“ vs aktivit. */
export const GENERATION_BLOCK_TYPE_OPTIONS: {
  type: BlockType;
  label: string;
  category: 'content' | 'activities' | 'layout' | 'other';
  /** Výchozí pro narrative učebnici (bez pracovních listů) */
  defaultForBook: boolean;
}[] = [
  { type: 'heading', label: 'Nadpis', category: 'content', defaultForBook: true },
  { type: 'paragraph', label: 'Odstavec', category: 'content', defaultForBook: true },
  { type: 'infobox', label: 'Infobox', category: 'content', defaultForBook: true },
  { type: 'image', label: 'Obrázek / galerie', category: 'content', defaultForBook: true },
  { type: 'table', label: 'Tabulka', category: 'content', defaultForBook: true },
  { type: 'chart', label: 'Graf', category: 'content', defaultForBook: true },
  { type: 'layout-section', label: 'Rozložení (sloupce)', category: 'layout', defaultForBook: true },
  { type: 'spacer', label: 'Mezera', category: 'layout', defaultForBook: true },
  { type: 'header-footer', label: 'Hlavička / patička', category: 'layout', defaultForBook: true },
  { type: 'qr-code', label: 'QR kód', category: 'other', defaultForBook: true },
  { type: 'free-canvas', label: 'Volné plátno', category: 'other', defaultForBook: false },
  { type: 'multiple-choice', label: 'Výběr odpovědi', category: 'activities', defaultForBook: false },
  { type: 'fill-blank', label: 'Doplňování do textu', category: 'activities', defaultForBook: false },
  { type: 'free-answer', label: 'Otevřená otázka', category: 'activities', defaultForBook: false },
  { type: 'examples', label: 'Příklady (matematika)', category: 'activities', defaultForBook: false },
  { type: 'connect-pairs', label: 'Spojovačka', category: 'activities', defaultForBook: false },
  { type: 'image-hotspots', label: 'Poznávačka (hotspots)', category: 'activities', defaultForBook: false },
  { type: 'video-quiz', label: 'Video kvíz', category: 'activities', defaultForBook: false },
];

/** Výchozí sada pro učebnici / beletrii — bez cvičení jako v pracovním sešitě. */
export const DEFAULT_GENERATION_BLOCK_TYPES_BOOK: BlockType[] = GENERATION_BLOCK_TYPE_OPTIONS.filter(
  (o) => o.defaultForBook,
).map((o) => o.type);

/** Všechny typy v editoru (plný pracovní sešit). */
export const DEFAULT_GENERATION_BLOCK_TYPES_WORKSHEET: BlockType[] = GENERATION_BLOCK_TYPE_OPTIONS.map((o) => o.type);

export function resolveGenerationBlockTypes(prefs: DesignSystemBlockPreferences | undefined): BlockType[] {
  const raw = prefs?.generationBlockTypes;
  if (Array.isArray(raw) && raw.length > 0) {
    const allowed = new Set(GENERATION_BLOCK_TYPE_OPTIONS.map((o) => o.type));
    const filtered = raw.filter((t): t is BlockType => typeof t === 'string' && allowed.has(t as BlockType));
    if (filtered.length > 0) return [...new Set(filtered)];
  }
  return [...DEFAULT_GENERATION_BLOCK_TYPES_BOOK];
}

// ============================================================
// DATASET
// ============================================================

export type DatasetFileKind = 'text' | 'image';

/** Obrázek v datasetu: layout stránky vs čistá reference stylu ilustrace (včetně auto-výřezů). */
export type DatasetImageReferenceRole = 'layout' | 'illustration';

export interface DatasetFile {
  id: string;
  name: string;
  kind: DatasetFileKind;
  /** Public URL in Supabase Storage (empty for inline text entries) */
  url: string;
  /** File size in bytes */
  size?: number;
  /** MIME type */
  mimeType?: string;
  uploadedAt: string;
  /** Inline text content — set for manually pasted/typed entries */
  content?: string;
  /**
   * U referenčních obrázků: krátký katalogový popis (koho/co ukazuje, typ záběru…).
   * Používá se při generování design systému (vision) a pro heuristický výběr reference při generování ilustrací.
   */
  referenceNote?: string;
  /**
   * Obrázek jako struktura stránky (screenshot) vs výřez / samostatná reference stylu ilustrace.
   * Neuvedeno = starší záznamy; chová se jako dřív (obojí).
   */
  referenceRole?: DatasetImageReferenceRole;
  /**
   * Dílčí kategorie vizuálu v rámci stylu (např. postavy, scéna, schéma) — typicky z automatického agenta.
   */
  illustrationTags?: string[];
}

/** Skupina referencí se stejným ilustračním „look & feel“ (agent nebo uživatel). */
export interface DatasetIllustrationStyle {
  id: string;
  name: string;
  /** Krátký anglický hint pro image model, odvozený z referencí ve skupině */
  promptHint?: string;
  imageIds: string[];
  source?: 'auto' | 'user';
}

/**
 * Návrhy stylů ilustrací z generování design systému z briefu — uživatel si vybere a přidá do `illustrationStyles`.
 */
export interface IllustrationStyleProposal {
  id: string;
  /** Krátký název varianty (česky), např. „Měkká akvarel“ */
  name: string;
  /** Anglický prompt / směr pro generátor obrázků */
  promptHint: string;
  /** Co se má spíš vyhnout (anglicky), volitelné */
  negativePromptHint?: string;
  /** Jedna věta česky — komu styl sedí */
  rationale?: string;
}

export interface DesignSystemDataset {
  files: DatasetFile[];
  /** Optional short description / topic for AI context */
  topic?: string;
  /** Text zadání z posledního generování design systému (pro panel Zadání). */
  generationBrief?: string;
  /**
   * Id obrázků ze sdílené knihovny, které mají být u „Zadání“ jako přílohy pro vision / generování.
   * Bez pole (a bez obrázků v `files`) se v panelu neukazuje celá knihovna — jen výslovně přidané.
   */
  briefReferenceImageIds?: string[];
  /**
   * Které soubory ze sdílené knihovny `teacher_illustration_reference_library` patří k tomuto design systému.
   * `undefined` = starší projekty: UI slučuje celou knihovnu učitele (jako dřív).
   * `[]` nebo výčet id = jen tyto položky (+ obrázky v `dataset.files`, dokud existují).
   */
  referenceImageIds?: string[];
  /**
   * Pokud true, AI seskupování ilustračních stylů zahrnuje i soubory s poznámkou „výřez ilustrace ze stránky (auto)“
   * (vygenerované z nahraného layoutu stránky). Jinak se do seskupení tyto výřezy neberou — méně překvapení.
   */
  styleClusterIncludeAutoCrops?: boolean;
  /**
   * Automatické (AI) seskupení referenčních obrázků podle vizuálního stylu ze screenshotů.
   */
  illustrationStyles?: DatasetIllustrationStyle[];
  /**
   * Návrhy promptů na styly ilustrací (z generování z briefu) — přidá se do `illustrationStyles` tlačítkem v UI.
   */
  illustrationStyleProposals?: IllustrationStyleProposal[];
  /**
   * `referenceImageIdsKey` po posledním úspěšném běhu — stejná sada obrázků = znovu nevolat seskupení.
   */
  illustrationStylesFingerprint?: string;
  /**
   * Uživatel doplnil obrázek ke stylu ručně — nespouštět automatické přeskupení, dokud se neobnoví AI.
   */
  illustrationStylesUserPinned?: boolean;
  /**
   * Náhled „náhodná ilustrace“ per styl (URL ve Storage), aby přežil obnovení stránky.
   */
  illustrationStyleSpotPreviews?: Record<
    string,
    { url: string; subject: string; randomDirectiveEn?: string }
  >;
}

// ============================================================
// DESIGN SYSTEM (main interface)
// ============================================================

export interface DesignSystem {
  id: string;
  teacher_id: string;
  name: string;
  description?: string;
  /** Accent color used for visual identification in lists */
  thumbnail_color?: string;
  colors: ColorGroup[];
  typography: DesignSystemTypography;
  pageDefaults: DesignSystemPageDefaults;
  aiPrompts: DesignSystemAIPrompts;
  blockPreferences: DesignSystemBlockPreferences;
  dataset?: DesignSystemDataset;
  created_at: string;
  updated_at: string;
}

// ============================================================
// DEFAULTS
// ============================================================

export function createEmptyDesignSystem(name: string): Omit<DesignSystem, 'id' | 'teacher_id' | 'created_at' | 'updated_at'> {
  return {
    name,
    thumbnail_color: '#5C5CFF',
    colors: [
      {
        id: 'primary',
        name: 'Primární barvy',
        swatches: [
          { id: 'p1', name: 'Primární', value: '#5C5CFF' },
          { id: 'p2', name: 'Primární světlá', value: '#818CF8' },
          { id: 'p3', name: 'Primární tmavá', value: '#3730A3' },
          { id: 'p4', name: 'Akcent', value: '#F59E0B' },
        ],
      },
      {
        id: 'muted',
        name: 'Tlumené barvy',
        swatches: [
          { id: 'm1', name: 'Nadpis / text', value: '#1E293B' },
          { id: 'm2', name: 'Text sekundární', value: '#475569' },
          { id: 'm3', name: 'Pozadí', value: '#F8FAFC' },
          { id: 'm4', name: 'Rámeček / linie', value: '#E2E8F0' },
        ],
      },
    ],
    typography: {
      headingFont: 'Poppins',
      bodyFont: 'Inter',
      baseFontSize: 'normal',
    },
    pageDefaults: {
      pageFormat: 'a4',
      pageBackgroundColor: '#ffffff',
      gridColumns: 12,
      gridGap: 'medium',
    },
    aiPrompts: {
      imageStyle: '',
      negativePrompt: '',
      characterStyle: '',
    },
    blockPreferences: {
      preferred: [],
      generationBlockTypes: [...DEFAULT_GENERATION_BLOCK_TYPES_BOOK],
    },
    dataset: {
      files: [],
      referenceImageIds: [],
    },
  };
}

// ── Google Fonts: pouze tisk / PDF (viz PrintGridCanvas) ─────────────────────

const SYSTEM_FONT_NAMES = new Set(['Georgia', 'Arial', 'Helvetica Neue', 'Times New Roman', 'Helvetica']);

function isBundledProductFont(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes('fenomen') ||
    n.includes('visby') ||
    n.includes('vividbooks script') ||
    n.includes('cooper light') ||
    n === 'cooper'
  );
}

/** První rodina z CSS hodnoty, např. "'Inter', sans-serif" → "Inter" */
export function extractFontFamilyName(cssFontValue: string): string {
  if (!cssFontValue) return '';
  const m = cssFontValue.match(/['"]([^'"]+)['"]/);
  if (m) return m[1].trim();
  return cssFontValue.split(',')[0].trim();
}

/** Rodina, která má jít přes Google Fonts API (ne systém / vlastní Vividbooks) */
export function isGoogleHostedFamily(familyName: string): boolean {
  const f = familyName.trim();
  if (!f) return false;
  if (SYSTEM_FONT_NAMES.has(f)) return false;
  if (isBundledProductFont(f)) return false;
  if (f === 'system-ui' || f.startsWith('-')) return false;
  return true;
}

const LOCAL_FONT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Helvetica Neue', value: "'Helvetica Neue', Helvetica, sans-serif" },
];

/**
 * Možnosti pro select fontu v design systému: systémové + celý katalog Google Fonts.
 * Parametr `typography` zůstává kvůli stabilnímu API volajícím; Google CSS se v editoru nenačítá.
 */
export function buildDesignSystemFontPickList(_typography: DesignSystemTypography): { label: string; value: string }[] {
  const seen = new Set<string>();
  for (const o of LOCAL_FONT_OPTIONS) {
    seen.add(extractFontFamilyName(o.value));
  }
  const fromCatalog: { label: string; value: string }[] = [];
  for (const meta of GOOGLE_FONTS_CATALOG) {
    const fam = meta.family;
    if (seen.has(fam) || SYSTEM_FONT_NAMES.has(fam) || isBundledProductFont(fam)) continue;
    seen.add(fam);
    const fallback =
      meta.category === 'serif' ? 'serif' : meta.category === 'mono' ? 'monospace' : 'sans-serif';
    fromCatalog.push({ label: meta.label, value: `'${fam}', ${fallback}` });
  }
  fromCatalog.sort((a, b) => a.label.localeCompare(b.label, 'cs'));
  return [...LOCAL_FONT_OPTIONS, ...fromCatalog];
}

/** Rodiny k načtení v tisku z typografie design systému */
export function collectGoogleFontsForPrint(typography: DesignSystemTypography): string[] {
  const names = new Set<string>();
  names.add(typography.headingFont);
  names.add(typography.bodyFont);
  for (const st of Object.values(typography.styles ?? {})) {
    const ff = st?.fontFamily;
    if (ff) names.add(extractFontFamilyName(ff));
  }
  return [...names].filter((n) => isGoogleHostedFamily(n));
}

/** URL stylesheetu Google Fonts pro dané názvy rodin (krátké názvy, ne CSS stack) */
export function getGoogleFontsUrl(fontFamilyNames: string[]): string {
  const unique = [...new Set(fontFamilyNames.map((x) => x.trim()).filter(Boolean))].filter((f) =>
    isGoogleHostedFamily(f)
  );
  if (unique.length === 0) return '';
  const families = unique
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
