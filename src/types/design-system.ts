import type { BlockType, GridColumns, GridGap, GlobalFontSize } from './worksheet';

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

export interface CustomLayout {
  id: string;
  name: string;
  /** Serialized WorksheetBlock[] */
  blocks: any[];
}

export interface DesignSystemBlockPreferences {
  /** Block types highlighted with ★ in the Add Content panel */
  preferred: BlockType[];
  /** User-created custom layout presets */
  customLayouts?: CustomLayout[];
}

// ============================================================
// DATASET
// ============================================================

export type DatasetFileKind = 'text' | 'image';

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
}

export interface DesignSystemDataset {
  files: DatasetFile[];
  /** Optional short description / topic for AI context */
  topic?: string;
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
        ],
      },
      {
        id: 'secondary',
        name: 'Sekundární barvy',
        swatches: [
          { id: 's1', name: 'Sekundární', value: '#F59E0B' },
          { id: 's2', name: 'Akcent', value: '#10B981' },
        ],
      },
      {
        id: 'neutral',
        name: 'Texty a pozadí',
        swatches: [
          { id: 'n1', name: 'Nadpis', value: '#1E293B' },
          { id: 'n2', name: 'Text', value: '#475569' },
          { id: 'n3', name: 'Pozadí', value: '#F8FAFC' },
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
    },
  };
}

/** Returns Google Fonts import URL for the given font names */
export function getGoogleFontsUrl(fonts: string[]): string {
  const googleFonts = CURATED_FONTS.filter(
    f => !['Georgia', 'Arial', 'Helvetica Neue'].includes(f.value) && fonts.includes(f.value)
  );
  if (googleFonts.length === 0) return '';
  const families = googleFonts
    .map(f => `family=${encodeURIComponent(f.value)}:wght@400;500;600;700`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
