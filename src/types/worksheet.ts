/**
 * Typy pro AI Editor pracovních listů
 * 
 * Pracovní list se skládá z bloků různých typů.
 * Každý blok má svůj specifický obsah podle typu.
 */

// ============================================
// ZÁKLADNÍ TYPY
// ============================================

/**
 * Dostupné typy bloků v pracovním listu
 */
export type BlockType = 
  | 'heading'
  | 'paragraph'
  | 'infobox'
  | 'multiple-choice'
  | 'fill-blank'
  | 'free-answer'
  | 'spacer'
  | 'examples'
  | 'image'
  | 'table'
  | 'connect-pairs'     // Spojovačka - connect matching pairs
  | 'image-hotspots'    // Poznávačka - identify points on image
  | 'video-quiz';       // Video quiz with questions at timestamps

/**
 * Pozice obrázku v bloku
 */
export type ImagePosition = 'before' | 'beside-left' | 'beside-right';

/**
 * Velikost obrázku
 */
export type ImageSize = 'small' | 'medium' | 'large' | 'full';

/**
 * Nastavení obrázku pro blok
 */
export interface BlockImage {
  /** URL obrázku */
  url: string;
  /** Alternativní text / popisek */
  alt?: string;
  /** Pozice obrázku vůči obsahu */
  position: ImagePosition;
  /** Velikost obrázku */
  size: ImageSize;
  /** Šířka v procentech (10-90) při position: beside-* */
  widthPercent?: number;
}

/**
 * Styl volného prostoru
 */
export type SpacerStyle = 'empty' | 'dotted' | 'lined';

/**
 * Úroveň nadpisu
 */
export type HeadingLevel = 'h1' | 'h2' | 'h3';

/**
 * Varianta infoboxu (barva)
 */
export type InfoboxVariant = 'blue' | 'green' | 'yellow' | 'purple';

/**
 * Předmět pro který je pracovní list určen
 */
export type Subject = 
  | 'fyzika'
  | 'chemie'
  | 'matematika'
  | 'prirodopis'
  | 'zemepis'
  | 'dejepis'
  | 'cestina'
  | 'anglictina'
  | 'other';

/**
 * Ročník ZŠ
 */
export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

// ============================================
// OBSAH BLOKŮ
// ============================================

/**
 * Obsah bloku s nadpisem
 */
export interface HeadingContent {
  /** Text nadpisu */
  text: string;
  /** Úroveň nadpisu (h1, h2, h3) */
  level: HeadingLevel;
}

/**
 * Obsah bloku s odstavcem
 */
export interface ParagraphContent {
  /** HTML obsah odstavce (může obsahovat formátování) */
  html: string;
}

/**
 * Obsah infoboxu
 */
export interface InfoboxContent {
  /** Titulek infoboxu (volitelný) */
  title?: string;
  /** HTML obsah infoboxu */
  html: string;
  /** Barevná varianta */
  variant: InfoboxVariant;
}

/**
 * Možnost odpovědi v multiple-choice otázce
 */
export interface ChoiceOption {
  /** Unikátní ID možnosti */
  id: string;
  /** Text možnosti */
  text: string;
}

/**
 * Obsah multiple-choice otázky
 */
export interface MultipleChoiceContent {
  /** Text otázky */
  question: string;
  /** Seznam možností */
  options: ChoiceOption[];
  /** ID správných odpovědí */
  correctAnswers: string[];
  /** Povolit výběr více odpovědí */
  allowMultiple: boolean;
  /** Vysvětlení správné odpovědi (zobrazí se po vyplnění) */
  explanation?: string;
}

/**
 * Segment textu v fill-blank - buď běžný text nebo mezera k doplnění
 */
export type FillBlankSegment = 
  | { type: 'text'; content: string }
  | { type: 'blank'; id: string; correctAnswer: string; acceptedAnswers?: string[] };

/**
 * Obsah fill-blank (doplňování do textu)
 */
export interface FillBlankContent {
  /** Instrukce k úloze (volitelné) */
  instruction?: string;
  /** Segmenty textu a mezer */
  segments: FillBlankSegment[];
}

/**
 * Obsah otázky s volnou odpovědí
 */
export interface FreeAnswerContent {
  /** Text otázky */
  question: string;
  /** Počet řádků pro odpověď */
  lines: number;
  /** Nápověda pro žáka (volitelná) */
  hint?: string;
  /** Vzorová odpověď pro učitele (volitelná) */
  sampleAnswer?: string;
}

/**
 * Obsah volného prostoru
 */
export interface SpacerContent {
  /** Výška v pixelech */
  height: number;
  /** Styl prostoru */
  style: SpacerStyle;
}

/**
 * Obsah bloku s obrázkem
 */
export interface ImageContent {
  /** URL obrázku */
  url: string;
  /** Alternativní text / popisek */
  alt?: string;
  /** Titulek pod obrázkem */
  caption?: string;
  /** Zobrazit popisek (default: true) */
  showCaption?: boolean;
  /** Velikost obrázku */
  size: ImageSize;
  /** Zarovnání (left, center, right) */
  alignment?: 'left' | 'center' | 'right';
}

/**
 * Obsah bloku s tabulkou
 */
export interface TableContent {
  /** HTML obsah tabulky (TipTap table format) */
  html: string;
  /** Počet řádků */
  rows: number;
  /** Počet sloupců */
  columns: number;
  /** Má záhlaví */
  hasHeader: boolean;
  /** Má ohraničení */
  hasBorder: boolean;
  /** Má zaoblené rohy */
  hasRoundedCorners: boolean;
  /** Barevný styl (volitelný) */
  colorStyle?: 'default' | 'blue' | 'green' | 'purple' | 'yellow' | 'red' | 'pink' | 'cyan';
}

// ============================================
// ACTIVITY BLOCK CONTENT TYPES
// ============================================

/**
 * Item in a connect-pairs activity (can be text or image)
 */
export interface ConnectPairItemContent {
  id: string;
  type: 'text' | 'image';
  content: string; // Text or image URL
}

/**
 * A pair to connect in the worksheet
 */
export interface ConnectPairContent {
  id: string;
  left: ConnectPairItemContent;
  right: ConnectPairItemContent;
}

/**
 * Obsah bloku spojovačky (Connect Pairs)
 */
export interface ConnectPairsContent {
  /** Instrukce k úloze */
  instruction?: string;
  /** Dvojice k propojení */
  pairs: ConnectPairContent[];
  /** Zamíchat strany */
  shuffleSides: boolean;
}

/**
 * Hotspot marker style for worksheet
 */
export type WorksheetHotspotMarkerStyle = 'circle' | 'pin' | 'question-mark';

/**
 * Single hotspot on an image for worksheet
 */
export interface WorksheetHotspot {
  id: string;
  x: number; // Percentage position (0-100)
  y: number; // Percentage position (0-100)
  label: string; // The correct answer/label for the hotspot
  options?: { id: string; text: string; isCorrect: boolean }[]; // ABC options if any
}

/**
 * Obsah bloku poznávačky (Image Hotspots)
 */
export interface ImageHotspotsContent {
  /** Instrukce k úloze */
  instruction?: string;
  /** URL obrázku */
  imageUrl: string;
  /** Body na obrázku */
  hotspots: WorksheetHotspot[];
  /** Styl markeru */
  markerStyle: WorksheetHotspotMarkerStyle;
  /** Velikost markeru (procenta, 100 = normální) */
  markerSize: number;
  /** Typ odpovědi: abc, numeric, text */
  answerType: 'abc' | 'numeric' | 'text';
}

/**
 * Video question for worksheet
 */
export interface WorksheetVideoQuestion {
  id: string;
  timestamp: number; // Seconds from start
  question: string;
  options: {
    id: string;
    label: string; // A, B, C, D
    content: string;
    isCorrect: boolean;
  }[];
}

/**
 * Obsah bloku video kvízu
 */
export interface VideoQuizContent {
  /** Instrukce k úloze */
  instruction?: string;
  /** URL videa (YouTube) */
  videoUrl: string;
  /** Extrahované YouTube ID */
  videoId?: string;
  /** Otázky k videu */
  questions: WorksheetVideoQuestion[];
}

/**
 * Typ označení příkladů
 */
export type ExamplesLabelType = 'letters' | 'numbers' | 'none';

/**
 * Obtížnost příkladu
 */
export type ExampleDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Jednotlivý příklad
 */
export interface MathExample {
  /** ID příkladu */
  id: string;
  /** Text příkladu (např. "0,4 + 0,5 =") */
  expression: string;
  /** Správná odpověď */
  answer: string;
  /** Obtížnost (pro barevné rozlišení) */
  difficulty: ExampleDifficulty;
}

/**
 * Styl pole pro odpovědi
 */
export type AnswerBoxStyle = 'block' | 'line' | 'none';

/**
 * Obsah bloku s příklady
 */
export interface ExamplesContent {
  /** Vzorový příklad ze kterého AI vychází */
  sampleExample: string;
  /** AI detekované téma/operace */
  topic?: string;
  /** Vygenerované příklady */
  examples: MathExample[];
  /** Počet příkladů k vygenerování */
  examplesCount: number;
  /** Počet sloupců (1, 2 nebo 3) */
  columns: 1 | 2 | 3;
  /** Typ označení (písmena, čísla, bez označení) */
  labelType: ExamplesLabelType;
  /** Řadit od jednoduchého ke složitému */
  difficultyProgression: boolean;
  /** Zobrazit barevné podbarvení podle obtížnosti */
  showDifficultyColors: boolean;
  /** Styl pole pro odpovědi (blok, linka, žádný) */
  answerBoxStyle: AnswerBoxStyle;
  /** Rozestupy mezi řádky v px */
  rowSpacing?: number;
  /** Velikost fontu v px */
  fontSize?: number;
}

// ============================================
// BLOKY
// ============================================

/**
 * Šířka bloku v layoutu
 */
export type BlockWidth = 'full' | 'half';

/**
 * Základní vlastnosti společné pro všechny bloky
 */
interface BaseBlock {
  /** Unikátní ID bloku */
  id: string;
  /** Pořadí bloku v pracovním listu */
  order: number;
  /** Šířka bloku (plná nebo poloviční) */
  width: BlockWidth;
  /** Procentuální šířka při half-width (10-90, default 50) */
  widthPercent?: number;
  /** Spodní odsazení v pixelech */
  marginBottom?: number;
  /** Styl spodního odsazení */
  marginStyle?: SpacerStyle;
  /** Volitelný obrázek připojený k bloku */
  image?: BlockImage;
}

/**
 * Blok s nadpisem
 */
export interface HeadingBlock extends BaseBlock {
  type: 'heading';
  content: HeadingContent;
}

/**
 * Blok s odstavcem
 */
export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  content: ParagraphContent;
}

/**
 * Blok s infoboxem
 */
export interface InfoboxBlock extends BaseBlock {
  type: 'infobox';
  content: InfoboxContent;
}

/**
 * Blok s multiple-choice otázkou
 */
export interface MultipleChoiceBlock extends BaseBlock {
  type: 'multiple-choice';
  content: MultipleChoiceContent;
}

/**
 * Blok s doplňováním do textu
 */
export interface FillBlankBlock extends BaseBlock {
  type: 'fill-blank';
  content: FillBlankContent;
}

/**
 * Blok s volnou odpovědí
 */
export interface FreeAnswerBlock extends BaseBlock {
  type: 'free-answer';
  content: FreeAnswerContent;
}

/**
 * Blok s volným prostorem
 */
export interface SpacerBlock extends BaseBlock {
  type: 'spacer';
  content: SpacerContent;
}

/**
 * Blok s příklady (matematika)
 */
export interface ExamplesBlock extends BaseBlock {
  type: 'examples';
  content: ExamplesContent;
}

/**
 * Blok s obrázkem
 */
export interface ImageBlock extends BaseBlock {
  type: 'image';
  content: ImageContent;
}

/**
 * Blok s tabulkou
 */
export interface TableBlock extends BaseBlock {
  type: 'table';
  content: TableContent;
}

/**
 * Blok se spojovačkou (Connect Pairs)
 */
export interface ConnectPairsBlock extends BaseBlock {
  type: 'connect-pairs';
  content: ConnectPairsContent;
}

/**
 * Blok s poznávačkou (Image Hotspots)
 */
export interface ImageHotspotsBlock extends BaseBlock {
  type: 'image-hotspots';
  content: ImageHotspotsContent;
}

/**
 * Blok s video kvízem
 */
export interface VideoQuizBlock extends BaseBlock {
  type: 'video-quiz';
  content: VideoQuizContent;
}

/**
 * Union type pro všechny typy bloků
 */
export type WorksheetBlock = 
  | HeadingBlock
  | ParagraphBlock
  | InfoboxBlock
  | MultipleChoiceBlock
  | FillBlankBlock
  | FreeAnswerBlock
  | SpacerBlock
  | ExamplesBlock
  | ImageBlock
  | TableBlock
  | ConnectPairsBlock
  | ImageHotspotsBlock
  | VideoQuizBlock;

// ============================================
// METADATA A PRACOVNÍ LIST
// ============================================

/**
 * Počet sloupců na stránce
 */
export type ColumnCount = 1 | 2;

/**
 * Metadata pracovního listu
 */
/**
 * Globální velikost písma
 */
export type GlobalFontSize = 'small' | 'normal' | 'large';

export interface WorksheetMetadata {
  /** Předmět */
  subject: Subject;
  /** Ročník (1-9) */
  grade: Grade;
  /** Odhadovaná časová náročnost v minutách */
  estimatedTime?: number;
  /** Klíčová slova pro vyhledávání */
  keywords?: string[];
  /** Téma/kapitola */
  topic?: string;
  /** Počet sloupců (1 nebo 2) */
  columns?: ColumnCount;
  /** Globální velikost písma */
  globalFontSize?: GlobalFontSize;
}

/**
 * Hlavní typ pro pracovní list
 */
export interface Worksheet {
  /** Unikátní ID pracovního listu */
  id: string;
  /** Název pracovního listu */
  title: string;
  /** Popis pracovního listu (volitelný) */
  description?: string;
  /** Seznam bloků */
  blocks: WorksheetBlock[];
  /** Metadata */
  metadata: WorksheetMetadata;
  /** Datum vytvoření (ISO string) */
  createdAt: string;
  /** Datum poslední úpravy (ISO string) */
  updatedAt: string;
  /** ID autora (pro budoucí použití) */
  authorId?: string;
  /** Stav publikace */
  status: 'draft' | 'published';
  /** Náhledový obrázek (URL) */
  thumbnailUrl?: string;
}

// ============================================
// POMOCNÉ TYPY
// ============================================

/**
 * Typ pro vytvoření nového bloku (bez id a order)
 */
export type NewBlockContent<T extends WorksheetBlock> = T['content'];

/**
 * Extrahuje content type podle block type
 */
export type BlockContentByType = {
  'heading': HeadingContent;
  'paragraph': ParagraphContent;
  'infobox': InfoboxContent;
  'multiple-choice': MultipleChoiceContent;
  'fill-blank': FillBlankContent;
  'free-answer': FreeAnswerContent;
  'spacer': SpacerContent;
  'examples': ExamplesContent;
  'image': ImageContent;
  'table': TableContent;
  'connect-pairs': ConnectPairsContent;
  'image-hotspots': ImageHotspotsContent;
  'video-quiz': VideoQuizContent;
};

/**
 * Výchozí hodnoty pro nový pracovní list
 */
export const DEFAULT_WORKSHEET_METADATA: WorksheetMetadata = {
  subject: 'fyzika',
  grade: 6,
  estimatedTime: 15,
  keywords: [],
};

/**
 * Výchozí data pro worksheet view (prázdný worksheet)
 */
export const DEFAULT_WORKSHEET_DATA: Worksheet = {
  id: 'default',
  title: 'Nový pracovní list',
  description: '',
  blocks: [],
  metadata: DEFAULT_WORKSHEET_METADATA,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: 'draft',
};

/**
 * Vytvoří prázdný pracovní list
 */
export function createEmptyWorksheet(id: string): Worksheet {
  const now = new Date().toISOString();
  return {
    id,
    title: 'Nový pracovní list',
    description: '',
    blocks: [],
    metadata: { ...DEFAULT_WORKSHEET_METADATA },
    createdAt: now,
    updatedAt: now,
    status: 'draft',
  };
}

/**
 * Generuje unikátní ID pro blok
 */
export function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Vytvoří nový blok daného typu s výchozím obsahem
 */
export function createEmptyBlock(type: BlockType, order: number): WorksheetBlock {
  const id = generateBlockId();
  
  switch (type) {
    case 'heading':
      return {
        id,
        type: 'heading',
        order,
        width: 'full',
        content: { text: '', level: 'h2' },
      };
    case 'paragraph':
      return {
        id,
        type: 'paragraph',
        order,
        width: 'full',
        content: { html: '' },
      };
    case 'infobox':
      return {
        id,
        type: 'infobox',
        order,
        width: 'full',
        content: { html: '', variant: 'blue' },
      };
    case 'multiple-choice':
      return {
        id,
        type: 'multiple-choice',
        order,
        width: 'full',
        content: {
          question: '',
          options: [
            { id: 'opt-1', text: '' },
            { id: 'opt-2', text: '' },
          ],
          correctAnswers: [],
          allowMultiple: false,
        },
      };
    case 'fill-blank':
      return {
        id,
        type: 'fill-blank',
        order,
        width: 'full',
        content: {
          segments: [{ type: 'text', content: '' }],
        },
      };
    case 'free-answer':
      return {
        id,
        type: 'free-answer',
        order,
        width: 'full',
        content: {
          question: '',
          lines: 3,
        },
      };
    case 'spacer':
      return {
        id,
        type: 'spacer',
        order,
        width: 'full',
        content: {
          height: 100,
          style: 'empty',
        },
      };
    case 'examples':
      return {
        id,
        type: 'examples',
        order,
        width: 'full',
        content: {
          sampleExample: '',
          examples: [],
          examplesCount: 15,
          columns: 3,
          labelType: 'none',
          difficultyProgression: true,
          showDifficultyColors: true,
          answerBoxStyle: 'block',
        },
      };
    case 'image':
      return {
        id,
        type: 'image',
        order,
        width: 'full',
        content: {
          url: '',
          alt: '',
          caption: '',
          size: 'medium',
          alignment: 'center',
        },
      };
    case 'table':
      return {
        id,
        type: 'table',
        order,
        width: 'full',
        content: {
          html: '<table><thead><tr><th></th><th></th><th></th></tr></thead><tbody><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></tbody></table>',
          rows: 3,
          columns: 3,
          hasHeader: true,
          hasBorder: true,
          hasRoundedCorners: true,
        },
      };
    case 'connect-pairs':
      return {
        id,
        type: 'connect-pairs',
        order,
        width: 'full',
        content: {
          instruction: 'Spoj správné dvojice',
          pairs: [
            {
              id: 'pair-1',
              left: { id: 'left-1', type: 'text', content: '' },
              right: { id: 'right-1', type: 'text', content: '' },
            },
            {
              id: 'pair-2',
              left: { id: 'left-2', type: 'text', content: '' },
              right: { id: 'right-2', type: 'text', content: '' },
            },
          ],
          shuffleSides: true,
        },
      };
    case 'image-hotspots':
      return {
        id,
        type: 'image-hotspots',
        order,
        width: 'full',
        content: {
          instruction: 'Označ správné místo na obrázku',
          imageUrl: '',
          hotspots: [],
          markerStyle: 'circle',
          markerSize: 100,
          answerType: 'text',
        },
      };
    case 'video-quiz':
      return {
        id,
        type: 'video-quiz',
        order,
        width: 'full',
        content: {
          instruction: 'Sleduj video a odpověz na otázky',
          videoUrl: '',
          questions: [],
        },
      };
  }
}
