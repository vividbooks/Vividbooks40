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
  | 'layout-section'
  | 'multiple-choice'
  | 'fill-blank'
  | 'free-answer'
  | 'spacer'
  | 'examples'
  | 'image'
  | 'table'
  | 'connect-pairs'     // Spojovačka - connect matching pairs
  | 'image-hotspots'    // Poznávačka - identify points on image
  | 'video-quiz'        // Video quiz with questions at timestamps
  | 'qr-code'           // QR kód s popiskem
  | 'header-footer'     // Hlavička a patička
  | 'free-canvas'       // Volné plátno - mini Figma canvas
  | 'chart';            // Graf a data – interaktivní Recharts vizualizace

/**
 * Pozice obrázku v bloku
 */
export type ImagePosition = 'before' | 'after' | 'beside-left' | 'beside-right';

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
  /** Maximální výška obrázku v px (omezí výšku při zachování aspect ratio) */
  maxHeightPx?: number;
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
  /** Zarovnání textu */
  align?: 'left' | 'center' | 'right';
  /** Vlastní velikost písma (přepíše výchozí velikost podle úrovně) */
  fontSize?: number;
  /** Tučné písmo */
  isBold?: boolean;
  /** Kurzíva */
  isItalic?: boolean;
  /** Podtržení */
  isUnderline?: boolean;
  /** Barva textu */
  textColor?: string;
  /** Barva zvýraznění */
  highlightColor?: string;
  /** Vizuální styl nadpisu */
  headingStyle?: 'plain' | 'pill' | 'underline' | 'left-border';
}

/**
 * Pozice obrázku v odstavci
 */
export type ParagraphImagePosition = 'left' | 'right' | 'top' | 'bottom' | 'none';

/**
 * Tvar obrázku v odstavci
 */
export type ParagraphImageShape = 'square' | 'circle' | 'rounded';

/**
 * Skupina symbolů na jedné straně příkladu — nálepka ze Vividboardu + počet.
 */
export interface CompareCountsItemGroup {
  count: number;
  /** Veřejná https URL nálepky (Supabase Storage, katalog jako u anotací). */
  stickerUrl?: string;
  /** ID z katalogu nálepek (volitelné). */
  stickerId?: string;
}

/**
 * Jeden pod-příklad v rámci jedné aktivity „porovnávání počtů“ (max 9 na aktivitu).
 */
export interface CompareCountsExample {
  id: string;
  leftGroups: CompareCountsItemGroup[];
  rightGroups: CompareCountsItemGroup[];
}

/**
 * Miniaplikace v odstavci — nastavení v pravém panelu, HTML se generuje z dat.
 */
export interface CompareCountsMiniAppContent {
  type: 'compare-counts';
  /** 1–9 příkladů; společné je jen vzhled karty (rámeček, střed, barvy). */
  examples: CompareCountsExample[];
  showCenterSlot: boolean;
  /** Řádek s číselným zápisem pod vizuálem (např. 4 + 2 … 3 + 2). */
  showNumericRow?: boolean;
  /** Když je vypnuto, čísla a znaménka v číselném řádku jsou neviditelná (opacity 0), zůstane prostor na zápis. */
  showNumericSolution?: boolean;
  /** Více typů v jednom poli — emoji se skládají ze všech skupin, v číselném řádku je + mezi počty. */
  combineMultipleTypesPerSide?: boolean;
  /** Náhodné (deterministické) posuny a mírná rotace symbolů v polích — stejné pořád pro daný příklad. */
  randomSymbolPositions?: boolean;
  innerBorderColor: string;
  innerBackground: string;
  emojiSizePx: number;
  /** Spodní hranice velikosti symbolu při velkém počtu kusů na straně (px). */
  emojiMinSizePx: number;
  minHeightPx: number;
  centerSlotSizePx: number;
  textColor: string;
  /** Pozadí buňky pro zápis &gt;, &lt;, = v číselném řádku */
  numericCompareHighlight?: string;
  /** Zadání úlohy (jako otázka u klasické otázky) */
  question: string;
  questionHtml?: string;
  /** Kroužek s číslem aktivity */
  circleColor?: string;
  circleSize?: number;
  /** Typografie zadání (stejná logika jako u multiple-choice otázky) */
  qFontFamily?: string;
  qFontSize?: number;
  qFontWeight?: string;
  qTextColor?: string;
  qLineHeight?: number;
  qLetterSpacing?: number;
  qAlign?: 'left' | 'center' | 'right' | 'justify';
  qIsBold?: boolean;
  qIsItalic?: boolean;
  qIsUnderline?: boolean;
}

/** Režim písanky — zatím v UI primárně vázané. */
export type PisankaScriptMode = 'vazane' | 'nevazane';

/**
 * Typ linkování (vázané): řádek = horní / střední / spodní část, každá stejně vysoká
 * — buď 0,8 cm (3x08), nebo 0,6 cm (3x06). Mezi částmi jsou tlusté linky; střední pás je světle modrý.
 */
export type PisankaLineTemplate = '3x08' | '3x06';

/**
 * Vzor linek na řádku (globálně pro celou písanku).
 * 1 = klasická plná (šatečky + horní/spodní část + modrý pás)
 * 2 = kompaktní — jen střední pásmo (x-výška) se dvěma tlustými linkami
 * 3 = jako 1, ale bez vybarveného středního pásu
 */
export type PisankaLinePattern = '1' | '2' | '3';

/** Písmo předepsaného textu na řádku písanky */
export type PisankaTraceFont = 'vividbooks' | 'cooper';

/** Vodící tečky: výška podle prvního písmene řádku, opakování podle šířky celého předpisu. */
export type PisankaGuideDotsMode = 'off' | 'on';

/** Odhadovaná výška začátku tahu pro tečku (viz geometrie řádku písanky). */
export type PisankaGuideAnchor = 'baseline' | 'bandTop' | 'ascender' | 'capTop';

/** Jedna linkovaná řádka — text, písmo a volitelný obrázek vzadu (URL, ne base64). */
export interface PisankaRowItem {
  text: string;
  traceFont: PisankaTraceFont;
  /** Vodící tečky: zapnuto = podle prvního písmene a šířky celého předpisu. */
  guideDots?: PisankaGuideDotsMode;
  /** V editoru: zobrazit sekci „Vybrat obrázek“ (povolí se v Nastavení řádku). */
  allowRowImage?: boolean;
  imageUrl?: string;
  /** Pokud je false, obrázek se nevykreslí i při uložené URL (např. dočasně vypnuto). Výchozí true při imageUrl. */
  imageEnabled?: boolean;
  /** Panáček vlevo na začátku linky (vizuální vodítko výšky řádku). */
  showMascot?: boolean;
  /** Tužka mířící na začátek předpisu na tomto řádku (viz public/pisanka-start-pencil.svg). */
  showStartPencil?: boolean;
}

export interface PisankaMiniAppContent {
  type: 'pisanka';
  scriptMode: PisankaScriptMode;
  lineTemplate: PisankaLineTemplate;
  /** Vzor linek (1–3), výchozí 1. */
  linePattern?: PisankaLinePattern;
  /** Každý prvek = jeden řádek; prázdný text = jen linky. */
  rows: PisankaRowItem[];
  /** Nadpis nad stránkou (Cooper Light v HTML). */
  title?: string;
  lineThin?: string;
  lineThick?: string;
  bandFill?: string;
  traceColor?: string;
  /** Svislý proklad mezi řádky linkování (px). */
  rowGapPx?: number;
  /** Vodorovný „odsazení“ obsahu stránky písanky od okrajů (px); 0 = linky/pás až k okraji bloku. */
  pageInsetPx?: number;
}

export type ParagraphMiniApp = CompareCountsMiniAppContent | PisankaMiniAppContent;

/**
 * Obsah bloku s odstavcem
 */
export interface ParagraphContent {
  /** HTML obsah odstavce (může obsahovat formátování) */
  html: string;
  /** Volitelná miniaplikace (např. porovnávání počtů) — při nastavení upravuj html synchronně */
  miniApp?: ParagraphMiniApp;
  /** URL obrázku (volitelný) */
  imageUrl?: string;
  /** Pozice obrázku vzhledem k textu */
  imagePosition?: ParagraphImagePosition;
  /** Tvar obrázku */
  imageShape?: ParagraphImageShape;
  /** Velikost obrázku v pixelech */
  imageSize?: number;
  /** Počet textových sloupců (1 = výchozí, 2 nebo 3 = vícekolumnový layout) */
  columns?: 1 | 2 | 3;
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

export type LayoutSectionStyle = 'equal' | 'sidebar-left' | 'sidebar-right' | 'custom';

export interface LayoutSectionContent {
  columns: 2 | 3;
  layoutStyle?: LayoutSectionStyle;
  columnRatios?: number[];
  columnGap?: number;
  minHeight?: number;
}

/**
 * Možnost odpovědi v multiple-choice otázce
 */
export interface ChoiceOption {
  /** Unikátní ID možnosti */
  id: string;
  /** Text možnosti */
  text: string;
  /** Rich HTML varianta textu možnosti */
  textHtml?: string;
  /** URL obrázku (pro obrázkovou variantu) */
  imageUrl?: string;
}

/**
 * Tvar odpovědi pro "Hravé ABC" vizuální styl
 * - circle, square, pill: základní tvary
 * - star, heart, hexagon, diamond, cloud: speciální tvary
 * - mix: náhodná kombinace všech tvarů
 */
export type PlayfulAnswerShape = 'circle' | 'square' | 'pill' | 'bubble' | 'heart' | 'hexagon' | 'diamond' | 'cloud' | 'mix';

/**
 * Styl vykreslení tvaru (obrys nebo výplň)
 */
export type PlayfulAnswerStyle = 'stroke' | 'fill';

/**
 * Pozice a rotace jedné odpovědi v "Hravém ABC" režimu
 */
export interface PlayfulAnswerPosition {
  /** X pozice v procentech (0-100) */
  x: number;
  /** Y pozice v procentech (0-100) */
  y: number;
  /** Rotace ve stupních (-15 až +15) */
  rotation: number;
  /** Velikost v procentech (80-120) */
  scale: number;
  /** Konkrétní tvar pro tuto odpověď (pro 'mix' režim) */
  shape?: PlayfulAnswerShape;
  /** Konkrétní barva pro tuto odpověď (pro 'randomColors' režim) */
  color?: string;
}

/**
 * Nastavení pro "Hravé ABC" vizuální styl
 */
export interface PlayfulAnswerSettings {
  /** Tvar odpovědí */
  shape: PlayfulAnswerShape;
  /** Styl vykreslení (obrys nebo výplň) */
  style: PlayfulAnswerStyle;
  /** Primární barva (obrys nebo výplň podle style) */
  primaryColor: string;
  /** Barva textu */
  textColor: string;
  /** Tloušťka obrysu v px (pro style: 'stroke') */
  strokeWidth: number;
  /** Předgenerované pozice odpovědí (pro konzistenci) */
  positions: PlayfulAnswerPosition[];
  /** Použít náhodnou barvu pro každý tvar */
  randomColors?: boolean;
}

/**
 * Obsah multiple-choice otázky
 */
export interface MultipleChoiceContent {
  /** Text otázky */
  question: string;
  /** Rich HTML reprezentace otázky */
  questionHtml?: string;
  /** Seznam možností */
  options: ChoiceOption[];
  /** ID správných odpovědí */
  correctAnswers: string[];
  /** Povolit výběr více odpovědí */
  allowMultiple: boolean;
  /** Vysvětlení správné odpovědi (zobrazí se po vyplnění) */
  explanation?: string;
  /** Rich HTML reprezentace vysvětlení */
  explanationHtml?: string;
  /** Varianta zobrazení (textová / obrázková) */
  variant?: 'text' | 'image';
  /** Počet sloupců pro obrázkovou variantu */
  gridColumns?: number;
  /** Rozložení odpovědí pro textovou variantu */
  layout?: 'vertical' | 'horizontal' | 'grid';
  /** Vizuální styl odpovědí */
  visualStyle?: 'list' | 'playful' | 'playful-image';
  /** Nastavení pro "Hravé ABC" vizuální styl */
  playfulSettings?: PlayfulAnswerSettings;
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
 * Pod-otázka ve free-answer bloku
 */
export interface FreeAnswerSubQuestion {
  /** Unikátní ID pod-otázky */
  id: string;
  /** Text pod-otázky */
  text: string;
  /** Rich HTML reprezentace textu pod-otázky */
  textHtml?: string;
  /** Počet řádků pro odpověď (1-5) */
  lines: number;
  /** Vzorová odpověď (volitelná) */
  sampleAnswer?: string;
  /** Individuální barva kroužku/označení (přepíše globální subLabelColors) */
  labelColor?: string;
  /** URL obrázku u pod-otázky */
  imageUrl?: string;
  /** Pozice obrázku: 'below' pod textem, 'beside' vedle textu */
  imagePosition?: 'below' | 'beside';
  /** Šířka podotázky v procentech (default závisí na počtu sloupců) */
  widthPercent?: number;
}

/**
 * Typ označení pod-otázek
 */
export type SubQuestionLabelType = 'letters' | 'numbers' | 'roman' | 'none';

/**
 * Styl označení pod-otázek
 * - text: prosté "A)"
 * - circle: plný barevný kroužek s bílým písmem
 * - circle-outline: obrysový kroužek s barevným písmem
 */
export type SubQuestionLabelStyle = 'text' | 'circle' | 'circle-outline';

/**
 * Obsah otázky s volnou odpovědí
 */
export interface FreeAnswerContent {
  /** Text otázky */
  question: string;
  /** Rich HTML reprezentace otázky */
  questionHtml?: string;
  /** Počet řádků pro odpověď */
  lines: number;
  /** Nápověda pro žáka (volitelná) */
  hint?: string;
  /** Rich HTML reprezentace nápovědy */
  hintHtml?: string;
  /** Vzorová odpověď pro učitele (volitelná) */
  sampleAnswer?: string;
  /** Rich HTML reprezentace vzorové odpovědi */
  sampleAnswerHtml?: string;
  
  // === POD-OTÁZKY (volitelné) ===
  /** Pole pod-otázek – pokud existuje, renderuje se grid místo jednoduchých řádků */
  subQuestions?: FreeAnswerSubQuestion[];
  /** Počet sloupců pro grid pod-otázek (1, 2, 3) */
  subColumns?: 1 | 2 | 3;
  /** Typ označení pod-otázek */
  subLabelType?: SubQuestionLabelType;
  /** Barvy pozadí pod-otázek (cyklicky se opakují) – např. ["#dbeafe", "#fef3c7"] */
  subQuestionColors?: string[];
  
  // === VIZUÁLNÍ STYL POD-OTÁZEK ===
  /** Zobrazit barevné pozadí karet (default: true) */
  subShowBackground?: boolean;
  /** Zobrazit linkované řádky na odpověď (default: true) – DEPRECATED, use subAnswerStyle */
  subShowLines?: boolean;
  /** Styl označení: 'text' = "A)", 'circle' = písmeno v kroužku (default: 'text') */
  subLabelStyle?: SubQuestionLabelStyle;
  /** Barvy kroužků/označení (cyklicky se opakují) – např. ["#e11d48", "#f59e0b"] */
  subLabelColors?: string[];
  
  // === GLOBÁLNÍ NASTAVENÍ ODPOVĚDÍ POD-OTÁZEK ===
  /** Globální počet řádků/prostoru pro odpověď u pod-otázek (1-5, default: 1) */
  subAnswerLines?: number;
  /** Styl odpovědního prostoru: 'dotted' = tečkované linky, 'solid' = plné linky, 'space' = prázdný prostor, 'none' = nic, 'inline-line' = linka vedle textu */
  subAnswerStyle?: 'dotted' | 'solid' | 'space' | 'none' | 'inline-line';
  /** Odsadit pod-otázky od levého kraje (default: true – odsazeny pod číslem aktivity) */
  subIndent?: boolean;
  
  // === FONT NASTAVENÍ POD-OTÁZEK ===
  /** Velikost fontu pod-otázek v pt (default: dědí z bloku) */
  subFontSize?: number;
  /** Tloušťka fontu pod-otázek (default: 'normal') */
  subFontWeight?: string;
  /** Font family pod-otázek (default: dědí z bloku) */
  subFontFamily?: string;
  
  // === VIZUÁLNÍ STYL KARET POD-OTÁZEK ===
  /** Režim pozadí: 'fill' = plná výplň, 'outline' = jen obrys (default: 'fill') */
  subBackgroundMode?: 'fill' | 'outline';
  /** Zapnout obrys nezávisle na výplni */
  subOutlineEnabled?: boolean;
  /** Barvy obrysu (pole barev, cykluje se jako subQuestionColors) */
  subOutlineColors?: string[];
  /** Stín pod-otázek: 'none' | 'sm' | 'md' (default: 'none') */
  subShadow?: 'none' | 'sm' | 'md';
  /** Zakulacení rohů pod-otázek v px (default: 10) */
  subBorderRadius?: number;
  /** Poměr šířky sloupců v procentech pro 1. sloupec (default: 50 = rovnoměrně) */
  subColumnRatio?: number;

  // === VIZUÁLNÍ STYL OBRÁZKŮ POD-OTÁZEK (přenáší se z galerie při konverzi) ===
  /** Tvar výřezu obrázků u pod-otázek */
  subImageShape?: 'rectangle' | 'circle' | 'triangle' | 'star' | 'heart' | 'speech-bubble';
  /** Zakulacení rohů obrázků u pod-otázek (px) */
  subImageBorderRadius?: number;
  /** Barva stroke obrázků u pod-otázek */
  subImageStrokeColor?: string;
  /** Šířka stroke obrázků u pod-otázek (px, 0 = vypnuto) */
  subImageStrokeWidth?: number;
  /** Náhodné natočení obrázků u pod-otázek */
  subImageRotate?: boolean;
  /** Max stupňů natočení obrázků u pod-otázek (1–15) */
  subImageRotateMax?: number;
  /** Výška obrázků u pod-otázek (px) */
  subImageHeight?: number;

  // === STYL KROUŽKU S ČÍSLEM AKTIVITY ===
  /** Barva kroužku s číslem aktivity (výchozí: #1e293b) */
  circleColor?: string;
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
  /** Velikost obrázku (0-100% velikost, 100-200% ořez) */
  size: number;
  /** Zarovnání (left, center, right) */
  alignment?: 'left' | 'center' | 'right';
  /** Galerie obrázků */
  gallery?: string[];
  /** Popisky pro jednotlivé obrázky v galerii */
  galleryCaptions?: string[];
  /** Rozložení galerie (vždy grid) */
  galleryLayout?: 'grid' | 'row';
  /** Počet sloupců v mřížce */
  gridColumns?: number;
  /** Typ aktivity na obrázcích */
  imageActivityType?: 'none' | 'text-input' | 'checkbox-circle' | 'checkbox-square';
  /** Výška kontejneru pro ořez (v px) */
  containerHeight?: number;
  /** Tvar výřezu jednotlivých obrázků v galerii */
  galleryItemShape?: 'rectangle' | 'circle' | 'triangle' | 'star' | 'heart' | 'speech-bubble';
  /** Zakulacení rohů (px, jen pro rectangle) */
  galleryBorderRadius?: number;
  /** Barva stroke/obrysu */
  galleryStrokeColor?: string;
  /** Šířka stroke (px, 0 = vypnuto) */
  galleryStrokeWidth?: number;
  /** Náhodné natočení obrázků */
  galleryRotate?: boolean;
  /** Max stupňů natočení (1–15) */
  galleryRotateMax?: number;
  /** Typ štítku (A/B/C nebo 1/2/3 nebo I/II/III) */
  galleryLabelType?: 'none' | 'letters' | 'numbers' | 'roman';
  /** Barva pozadí štítku */
  galleryLabelColor?: string;
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
  /** Velikost textu v buňkách */
  fontSize?: 'xs' | 'sm' | 'base' | 'lg';
  /** Hustota — určuje padding buněk a layout tabulky */
  density?: 'compact' | 'normal' | 'spacious';
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
  /** Rozložení aktivity */
  layout?: 'stacked' | 'side-by-side';
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

/**
 * Typ zpětné vazby pro patičku
 */
export type FeedbackType = 'smileys' | 'hearts' | 'stars' | 'none';

/**
 * Obsah bloku s QR kódem
 */
export interface QRCodeContent {
  /** URL nebo text pro QR kód */
  url: string;
  /** Popisek k QR kódu */
  caption: string;
  /** Pozice popisku (under nebo left) */
  captionPosition: 'under' | 'left';
  /** Velikost QR kódu v px */
  size?: number;
}

/**
 * Obsah bloku hlavička/patička
 */
export interface HeaderFooterContent {
  /** Typ: hlavička nebo patička */
  variant: 'header' | 'footer';
  /** Rozložení: 1 nebo 2 sloupce */
  columns: 1 | 2;
  
  // === HLAVIČKA ===
  /** Zobrazit pole pro jméno */
  showName?: boolean;
  /** Zobrazit pole pro příjmení */
  showSurname?: boolean;
  /** Zobrazit pole pro třídu */
  showClass?: boolean;
  /** Zobrazit pole pro známku */
  showGrade?: boolean;
  /** Vlastní label pro jméno */
  nameLabel?: string;
  /** Vlastní label pro příjmení */
  surnameLabel?: string;
  /** Vlastní label pro třídu */
  classLabel?: string;
  /** Vlastní label pro známku */
  gradeLabel?: string;
  /** Další vlastní info text */
  customInfo?: string;
  
  // === PATIČKA ===
  /** Zobrazit text zpětné vazby */
  showFeedback?: boolean;
  /** Text zpětné vazby */
  feedbackText?: string;
  /** Typ zpětné vazby */
  feedbackType?: FeedbackType;
  /** Počet možností zpětné vazby (např. 5 smajlíků) */
  feedbackCount?: number;
  /** Zobrazit doplňující info v patičce */
  showFooterInfo?: boolean;
  /** Další info text v patičce */
  footerInfo?: string;
  
  // === QR KÓD (pro hlavičku i patičku) ===
  /** URL pro QR kód */
  qrCodeUrl?: string;
  /** Zobrazit QR kód */
  showQrCode?: boolean;
  
  // === ČÍSLO STRÁNKY (pro hlavičku i patičku) ===
  /** Zobrazit číslo stránky */
  showPageNumber?: boolean;
}

// ============================================
// VOLNÉ PLÁTNO - TYPY OBJEKTŮ
// ============================================

/**
 * Typy objektů na volném plátně
 */
export type CanvasObjectType = 'rectangle' | 'ellipse' | 'line' | 'text' | 'image' | 'arrow' | 'group';

/**
 * Základní objekt na plátně
 */
export interface CanvasObjectBase {
  /** Unikátní ID objektu */
  id: string;
  /** Typ objektu */
  type: CanvasObjectType;
  /** X pozice */
  x: number;
  /** Y pozice */
  y: number;
  /** Šířka */
  width: number;
  /** Výška */
  height: number;
  /** Rotace ve stupních */
  rotation?: number;
  /** Z-index pro vrstvení */
  zIndex: number;
  /** Je objekt zamčený? */
  locked?: boolean;
}

/**
 * Obdélník na plátně
 */
export interface CanvasRectangle extends CanvasObjectBase {
  type: 'rectangle';
  /** Barva výplně */
  fill?: string;
  /** Barva ohraničení */
  stroke?: string;
  /** Tloušťka ohraničení */
  strokeWidth?: number;
  /** Zaoblení rohů */
  borderRadius?: number;
}

/**
 * Elipsa/kruh na plátně
 */
export interface CanvasEllipse extends CanvasObjectBase {
  type: 'ellipse';
  /** Barva výplně */
  fill?: string;
  /** Barva ohraničení */
  stroke?: string;
  /** Tloušťka ohraničení */
  strokeWidth?: number;
}

/**
 * Čára na plátně
 */
export interface CanvasLine extends CanvasObjectBase {
  type: 'line';
  /** Barva čáry */
  stroke: string;
  /** Tloušťka čáry */
  strokeWidth: number;
  /** Styl čáry */
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  /** Koncové body (relativní k x,y) */
  points: { x: number; y: number }[];
}

/**
 * Šipka na plátně
 */
export interface CanvasArrow extends CanvasObjectBase {
  type: 'arrow';
  /** Barva šipky */
  stroke: string;
  /** Tloušťka čáry */
  strokeWidth: number;
  /** Typ šipky (na začátku, na konci, obě) */
  arrowType: 'end' | 'start' | 'both';
}

/**
 * Text na plátně
 */
export interface CanvasText extends CanvasObjectBase {
  type: 'text';
  /** Obsah textu */
  text: string;
  /** Velikost písma */
  fontSize: number;
  /** Rodina písma */
  fontFamily?: string;
  /** Barva textu */
  fill: string;
  /** Tučné */
  bold?: boolean;
  /** Kurzíva */
  italic?: boolean;
  /** Zarovnání */
  align?: 'left' | 'center' | 'right';
}

/**
 * Obrázek na plátně
 */
export interface CanvasImage extends CanvasObjectBase {
  type: 'image';
  /** URL obrázku */
  url: string;
  /** Alternativní text */
  alt?: string;
  /** Způsob vyplnění */
  objectFit?: 'contain' | 'cover' | 'fill';
}

/**
 * Skupina objektů na plátně
 */
export interface CanvasGroup extends CanvasObjectBase {
  type: 'group';
  /** ID objektů ve skupině */
  children: string[];
}

/**
 * Union type pro všechny objekty na plátně
 */
export type CanvasObject = 
  | CanvasRectangle 
  | CanvasEllipse 
  | CanvasLine 
  | CanvasArrow 
  | CanvasText 
  | CanvasImage
  | CanvasGroup;

/**
 * Obsah bloku s grafem (chart)
 */
export interface ChartContent {
  /** Typ grafu */
  chartType: 'bar' | 'line' | 'area' | 'pie' | 'radar' | 'timeline';
  /** Název grafu */
  chartTitle?: string;
  /** Hlavičky sloupců – první je popisek/osa X, ostatní jsou datové řady */
  chartColumns: string[];
  /** Řádky dat – odpovídají chartColumns */
  chartRows: string[][];
  /** Výška grafu v px (default 300) */
  chartHeight?: number;
}

/**
 * Obsah bloku s volným plátnem
 */
export interface FreeCanvasContent {
  /** Zadání aktivity */
  instruction?: string;
  /** Objekty na plátně */
  objects: CanvasObject[];
  /** Barva pozadí plátna */
  backgroundColor?: string;
  /** Šířka plátna v px (default = šířka bloku) */
  canvasWidth?: number;
  /** Výška plátna v px */
  canvasHeight: number;
  /** Zobrazit mřížku */
  showGrid?: boolean;
  /** Velikost mřížky v px */
  gridSize?: number;
  /** Styl kroužku s číslem */
  circleColor?: string;
  circleSize?: number;
  /** Figma integrace */
  figmaFileId?: string;       // ID Figma souboru (z URL)
  figmaNodeId?: string;       // ID konkrétního frame/node
  figmaFrameName?: string;    // Jméno frame ve Figmě
  figmaSvgUrl?: string;       // URL synchronizovaného SVG v Supabase Storage
  figmaSyncedAt?: string;     // ISO timestamp poslední synchronizace
  /** Zobrazit blok přes celou šířku stránky (fullscreen) */
  fullscreen?: boolean;
}

// ============================================
// BLOKY
// ============================================

/**
 * Šířka bloku v layoutu (legacy)
 */
export type BlockWidth = 'full' | 'half';

/**
 * PRO: Počet sloupců gridu
 */
export type GridColumns = 1 | 2 | 3 | 6 | 12;

/**
 * PRO: Mezera mezi sloupci gridu
 */
export type GridGap = 'none' | 'small' | 'medium' | 'large';

/**
 * PRO: Hodnoty mezer v pixelech
 */
export const GRID_GAP_VALUES: Record<GridGap, number> = {
  none: 0,
  small: 8,
  medium: 16,
  large: 24,
};

/**
 * Vizuální styly aplikovatelné na jakýkoliv blok
 */
/** Preset zobrazení bloku */
export type DisplayPreset = 'normal' | 'infobox' | 'highlight' | 'custom';

export interface BlockVisualStyles {
  /** Preset zobrazení (normal, infobox, highlight, custom) */
  displayPreset?: DisplayPreset;
  /** Barva pozadí */
  backgroundColor?: string;
  /** Barva ohraničení */
  borderColor?: string;
  /** Šířka ohraničení v pixelech */
  borderWidth?: number;
  /** Styl ohraničení */
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  /** Zaoblení rohů v pixelech */
  borderRadius?: number;
  /** Stín (none, small, medium, large) */
  shadow?: 'none' | 'small' | 'medium' | 'large';
}

/**
 * Základní vlastnosti společné pro všechny bloky
 */
interface BaseBlock {
  /** Unikátní ID bloku */
  id: string;
  /** Pořadí bloku v pracovním listu */
  order: number;
  /** Šířka bloku (plná nebo poloviční) - legacy */
  width: BlockWidth;
  /** Procentuální šířka při half-width (10-90, default 50) - legacy */
  widthPercent?: number;
  /** PRO: Kolik sloupců gridu blok zabírá (1-12) */
  gridSpan?: number;
  /** PRO: Na kterém sloupci gridu blok začíná (1-12) */
  gridStart?: number;
  
  /**
   * Když true, blok se zobrazí pouze v pracovním listu (tisk/PDF).
   * Při konverzi na VividBoard board bude vynechán.
   */
  worksheetOnly?: boolean;

  // ========== FREEFORM CANVAS PROPERTIES ==========
  /** Freeform: X position on canvas in pixels */
  posX?: number;
  /** Freeform: Y position on canvas in pixels */
  posY?: number;
  /** Freeform: Width of block in pixels (null = auto based on content) */
  blockWidth?: number;
  /** Freeform: Height of block in pixels (null = auto based on content) */
  blockHeight?: number;
  /** Freeform: Which page this block belongs to (0-indexed) */
  pageIndex?: number;
  /** Freeform: Z-index for layering */
  zIndex?: number;
  
  /** Spodní odsazení v pixelech */
  marginBottom?: number;
  /** Pokud true, blok se nepočítá jako aktivita (bez čísla) */
  noActivityNumber?: boolean;
  /** Styl spodního odsazení */
  marginStyle?: SpacerStyle;
  /** Vnitřní odsazení bloku v pixelech */
  padding?: number;
  /** Volitelný obrázek připojený k bloku */
  image?: BlockImage;
  /** Vizuální styly bloku */
  visualStyles?: BlockVisualStyles;
  /**
   * PRO two-column layout: přiřazení bloku do sloupce A nebo B.
   * Aktivní pouze když `worksheet.metadata.pageColumnLayout === 'two-columns'`.
   * Bloky bez přiřazení jdou do sloupce A.
   */
  columnAssignment?: 'A' | 'B';

  /** ID layout sekce, do které blok patří. */
  layoutSectionId?: string;
  /** ID sloupce uvnitř layout sekce. */
  layoutColumnId?: string;
  /** Pořadí uvnitř sloupce layout sekce. */
  layoutOrder?: number;

  /** Pokud nastaveno, blok se stane "kotevním" bočním sloupcem vedle následujících bloků */
  floatSide?: 'left' | 'right';
  /**
   * Šířka bočního sloupce vyjádřená v počtu gridových sloupců (výchozí 4).
   * Nahrazuje starší floatWidthPercent — šířka se počítá jako
   * floatGridSpan * columnWidth + (floatGridSpan - 1) * gridGapPx.
   */
  floatGridSpan?: number;
  /** @deprecated Použij floatGridSpan. Šířka bočního sloupce v procentech (výchozí 35) */
  floatWidthPercent?: number;
  /** Kolik následujících bloků bude vedle bočního sloupce (výchozí 3) */
  floatSpanBlocks?: number;

  /** Nastavení jak se blok zobrazí v propojeném boardu */
  boardSettings?: {
    /** Přeskočit blok — nevkládat do boardu (interní, nelze nastavit z UI) */
    skip?: boolean;
    /**
     * Jak zobrazit podotázky (A, B, C…) v boardu:
     *  'single' — všechny v jednom slidu
     *  'each'   — každá podotázka jako samostatný slide
     *  'html'   — zachytit jako HTML obrázek (složitý layout)
     */
    subQuestionsMode?: 'single' | 'each' | 'html';
    /** Skrýt správnou odpověď v boardu */
    hideAnswer?: boolean;
    /** Zobrazit nápovědu v boardu (interní, nelze nastavit z UI) */
    showHint?: boolean;
    /**
     * Seskupit tento blok s N následujícími bloky na jeden slide.
     * 0 = žádné seskupení, 1 = tento + 1 další, 2 = tento + 2 další, atd.
     */
    mergeCount?: number;
    /** @deprecated Použij mergeCount místo mergeWithNext */
    mergeWithNext?: boolean;
  };

  /** Fixed visible frame height for linked text flow blocks (paragraph / infobox). */
  textFlowFrameHeight?: number;
  /** Shared chain identifier for linked text frames. */
  textFlowChainId?: string;
  /** Previous block in the linked text flow chain. */
  textFlowPrevBlockId?: string;
  /** Next block in the linked text flow chain. */
  textFlowNextBlockId?: string;
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

export interface LayoutSectionBlock extends BaseBlock {
  type: 'layout-section';
  content: LayoutSectionContent;
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
 * Blok s QR kódem
 */
export interface QRCodeBlock extends BaseBlock {
  type: 'qr-code';
  content: QRCodeContent;
}

/**
 * Blok s hlavičkou/patičkou
 */
export interface HeaderFooterBlock extends BaseBlock {
  type: 'header-footer';
  content: HeaderFooterContent;
}

/**
 * Blok s volným plátnem (mini Figma canvas)
 */
export interface FreeCanvasBlock extends BaseBlock {
  type: 'free-canvas';
  content: FreeCanvasContent;
}

/**
 * Blok s grafem (Recharts)
 */
export interface ChartBlock extends BaseBlock {
  type: 'chart';
  content: ChartContent;
}

/**
 * Union type pro všechny typy bloků
 */
export type WorksheetBlock = 
  | HeadingBlock
  | ParagraphBlock
  | InfoboxBlock
  | LayoutSectionBlock
  | MultipleChoiceBlock
  | FillBlankBlock
  | FreeAnswerBlock
  | SpacerBlock
  | ExamplesBlock
  | ImageBlock
  | TableBlock
  | ConnectPairsBlock
  | ImageHotspotsBlock
  | VideoQuizBlock
  | QRCodeBlock
  | HeaderFooterBlock
  | FreeCanvasBlock
  | ChartBlock;

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
export type PageFormat = 'a4' | 'b5' | 'a5';

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
  /** Počet sloupců (1 nebo 2) - legacy */
  columns?: ColumnCount;
  /** Globální velikost písma */
  globalFontSize?: GlobalFontSize;
  /** Formát stránky */
  pageFormat?: PageFormat;
  
  // === PRO GRID SYSTEM ===
  /** PRO: Počet sloupců gridu (default: 12) */
  gridColumns?: GridColumns;
  /** PRO: Mezera mezi sloupci */
  gridGap?: GridGap;
  
  // === PRO LAYOUT MODE ===
  /** PRO: Režim layoutu - grid (pro AI) nebo freeform (pro ruční úpravy) */
  layoutMode?: 'grid' | 'freeform';

  // === PRO TWO-COLUMN PAGE LAYOUT ===
  /**
   * Stránkové rozložení do dvou sloupců.
   * 'single'      — normální grid (výchozí)
   * 'two-columns' — stránka je rozdělena na sloupec A (vlevo) a B (vpravo);
   *                 každý blok si zvolí A nebo B pomocí `columnAssignment`.
   */
  pageColumnLayout?: 'single' | 'two-columns';
  /**
   * Počet grid sloupců pro sloupec A (1 až gridColumns-1, výchozí gridColumns/2).
   * Sloupec B dostane zbytek: `gridColumns - twoColumnASpan`.
   * Nahrazuje původní `twoColumnRatio`.
   */
  twoColumnASpan?: number;
  /** @deprecated Použij twoColumnASpan. Zachováno pro zpětnou kompatibilitu. */
  twoColumnRatio?: number;
  /**
   * Per-stránkový override pro rozložení do dvou sloupců.
   * Klíč = index stránky (0-based). Pokud stránka override nemá, dědí globální pageColumnLayout.
   */
  pageOverrides?: Record<number, {
    pageColumnLayout?: 'single' | 'two-columns';
    twoColumnASpan?: number;
  }>;

  // === PRO PAGE STYLING ===
  /** PRO: Barva pozadí stránky (default: bílá) */
  pageBackgroundColor?: string;
  
  // === PRO HEADER & FOOTER ===
  /** PRO: Konfigurace hlavičky stránky */
  pageHeader?: PageHeaderConfig;
  /** PRO: Konfigurace patičky stránky */
  pageFooter?: PageFooterConfig;

  // === DESIGN SYSTEM ===
  /** ID aktivního design systému z tabulky design_systems */
  designSystemId?: string;
  /** Fonty z aktivního design systému (cached pro offline rendering) */
  designFonts?: { heading: string; body: string };

  // === PAGE COUNT ===
  /**
   * Počet stránek naposledy zjištěný při renderování/uložení.
   * Aktualizuje se automaticky při každém save z ProEditorLayout.
   * Slouží pro WorkbookProLayout k zobrazení správné délky kapitoly.
   */
  pageCount?: number;
}

// ============================================
// HLAVIČKA & PATIČKA STRÁNKY
// ============================================

export interface PageHeaderConfig {
  enabled: boolean;
  showName?: boolean;
  showClass?: boolean;
  showGrade?: boolean;
  nameLabel?: string;
  classLabel?: string;
  gradeLabel?: string;
  lineColor?: string;
}

export type FooterFeedbackStyle = 'faces' | 'smileys' | 'stars' | 'hearts';

export interface PageFooterConfig {
  enabled: boolean;
  showSeparator?: boolean;
  /** Left column content type */
  leftType?: 'branding' | 'text' | 'none';
  /** Custom text for left column */
  leftText?: string;
  /** Right column content type */
  rightType?: 'feedback' | 'pageNumber' | 'text' | 'none';
  /** Feedback visual style */
  feedbackStyle?: FooterFeedbackStyle;
  /** Feedback question text */
  feedbackText?: string;
  /** Custom text for right column */
  rightText?: string;
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
  /** ID propojeného boardu (quiz), pokud byl board vytvořen/synchronizován */
  linkedBoardId?: string;
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
  'layout-section': LayoutSectionContent;
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
  'qr-code': QRCodeContent;
  'free-canvas': FreeCanvasContent;
  'chart': ChartContent;
};

// ============================================
// WORKSHEET DATA (pro WorksheetView - zobrazení importovaných PL)
// ============================================

/**
 * Odkaz na procvičování s úrovní obtížnosti
 */
export interface PracticeLink {
  id: string;
  label: string;
  url: string;
  level: 1 | 2 | 3;
}

/**
 * Obecný odkaz (pro testy, písemky, bonusy atd.)
 */
export interface LinkItem {
  id: string;
  label: string;
  url: string;
  type?: 'pdf' | 'link' | 'interactive';
}

/**
 * Data pro zobrazení pracovního listu (WorksheetView)
 * Používá se pro importované pracovní listy z legacy API
 */
export interface WorksheetData {
  /** URL náhledového obrázku */
  previewImageUrl?: string;
  /** URL náhledového obrázku (alias pro zpětnou kompatibilitu) */
  previewUrl?: string;
  /** URL hlavního PDF pracovního listu */
  pdfUrl?: string;
  /** URL nebo board:// odkaz na interaktivní verzi (VividBoard) */
  interactiveUrl?: string;
  /** URL řešení (PDF) */
  solutionPdfUrl?: string;
  /** URL učebního textu */
  textbookUrl?: string;
  /** URL metodiky */
  methodologyUrl?: string;
  /** Interaktivní pracovní listy (VividBoard) */
  interactiveWorksheets?: LinkItem[];
  /** Interaktivní řešení */
  interactiveSolutions?: LinkItem[];
  /** Seznam procvičování */
  exercises?: PracticeLink[];
  /** Seznam miniher */
  minigames?: LinkItem[];
  /** Seznam testů */
  tests?: LinkItem[];
  /** Seznam písemek */
  exams?: LinkItem[];
  /** Seznam bonusů a příloh */
  bonuses?: LinkItem[];
}

/**
 * Výchozí hodnoty pro nový pracovní list
 */
export const DEFAULT_WORKSHEET_METADATA: WorksheetMetadata = {
  subject: 'fyzika',
  grade: 6,
  estimatedTime: 15,
  keywords: [],
  globalFontSize: 'small',
  pageFormat: 'a4',
  // PRO defaults
  gridColumns: 12,
  gridGap: 'medium',
  layoutMode: 'grid',
};

/**
 * Výchozí data pro worksheet view (prázdný worksheet s placeholder bloky)
 */
export const DEFAULT_WORKSHEET_DATA: Worksheet = {
  id: 'default',
  title: 'Nový pracovní list',
  description: '',
  blocks: [
    {
      id: 'default-header',
      type: 'header-footer',
      order: 0,
      width: 'full',
      content: {
        variant: 'header',
        columns: 1,
        showName: true,
        showSurname: true,
        showClass: true,
        showGrade: true,
        showPageNumber: false,
        showQrCode: false,
        nameLabel: 'Jméno',
        surnameLabel: 'Příjmení',
        classLabel: 'Třída',
        gradeLabel: 'Známka',
        showFeedback: false,
        showFooterInfo: false,
      },
    },
    {
      id: 'default-h1',
      type: 'heading',
      order: 1,
      width: 'full',
      content: { text: 'Nadpis pracovního listu', level: 'h1', align: 'left' }
    },
    {
      id: 'default-p1',
      type: 'paragraph',
      order: 2,
      width: 'half',
      widthPercent: 50,
      content: { html: '<p>Zde začněte psát text k tématu...</p>' }
    },
    {
      id: 'default-q1',
      type: 'multiple-choice',
      order: 3,
      width: 'half',
      widthPercent: 50,
      content: {
        question: 'Zde zadejte otázku k textu...',
        options: [
          { id: 'opt-1', text: 'Možnost A' },
          { id: 'opt-2', text: 'Možnost B' },
        ],
        correctAnswers: [],
        allowMultiple: false,
      }
    }
  ],
  metadata: DEFAULT_WORKSHEET_METADATA,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: 'draft',
};

/**
 * Vytvoří prázdný pracovní list s výchozími placeholder bloky
 */
export function createEmptyWorksheet(id: string): Worksheet {
  const now = new Date().toISOString();
  
  // Create default placeholder blocks
  const blocks: WorksheetBlock[] = [
    {
      id: generateBlockId(),
      type: 'header-footer',
      order: 0,
      width: 'full',
      content: {
        variant: 'header',
        columns: 1,
        showName: true,
        showSurname: true,
        showClass: true,
        showGrade: true,
        showPageNumber: false,
        showQrCode: false,
        nameLabel: 'Jméno',
        surnameLabel: 'Příjmení',
        classLabel: 'Třída',
        gradeLabel: 'Známka',
        showFeedback: false,
        showFooterInfo: false,
      },
    },
    {
      id: generateBlockId(),
      type: 'heading',
      order: 1,
      width: 'full',
      content: { 
        text: 'Nadpis pracovního listu', 
        level: 'h1',
        align: 'left'
      }
    },
    {
      id: generateBlockId(),
      type: 'paragraph',
      order: 2,
      width: 'half',
      widthPercent: 50,
      content: { 
        html: '<p>Zde začněte psát text k tématu. Tento blok je nastaven na polovinu šířky stránky, aby mohl být vedle něj další obsah.</p>' 
      }
    },
    {
      id: generateBlockId(),
      type: 'multiple-choice',
      order: 3,
      width: 'half',
      widthPercent: 50,
      content: {
        question: 'Zde zadejte otázku, která se vztahuje k textu vlevo...',
        options: [
          { id: generateBlockId() + '-opt1', text: 'Možnost A' },
          { id: generateBlockId() + '-opt2', text: 'Možnost B' },
        ],
        correctAnswers: [],
        allowMultiple: false,
      }
    }
  ];

  return {
    id,
    title: 'Nový pracovní list',
    description: '',
    blocks,
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
        content: { text: '', level: 'h1' },
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
      // Infobox is now a paragraph with displayPreset 'infobox'
      return {
        id,
        type: 'paragraph',
        order,
        width: 'full',
        content: { html: '' },
        visualStyles: {
          displayPreset: 'infobox',
          backgroundColor: '#dbeafe',
          borderColor: '#3b82f6',
          borderRadius: 12,
          shadow: 'none',
        },
      };
    case 'multiple-choice':
      return {
        id,
        type: 'multiple-choice',
        order,
        width: 'full',
        content: {
          question: '',
          questionHtml: '',
          options: [
            { id: 'opt-1', text: '' },
            { id: 'opt-2', text: '' },
          ],
          correctAnswers: [],
          allowMultiple: false,
          variant: 'text',
          gridColumns: 4,
        },
      };
    case 'layout-section':
      return {
        id,
        type: 'layout-section',
        order,
        width: 'full',
        gridSpan: 12,
        noActivityNumber: true,
        content: {
          columns: 2,
          layoutStyle: 'equal',
          columnRatios: [50, 50],
          columnGap: 16,
          minHeight: 180,
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
          questionHtml: '',
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
          style: 'dotted',
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
          size: 100,
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
          layout: 'stacked',
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
    case 'qr-code':
      return {
        id,
        type: 'qr-code',
        order,
        width: 'full',
        content: {
          url: '',
          caption: '',
          captionPosition: 'under',
          size: 150,
        },
      };
    case 'header-footer':
      return {
        id,
        type: 'header-footer',
        order,
        width: 'full',
        content: {
          variant: 'header',
          columns: 1,
          showName: true,
          showSurname: true,
          showClass: true,
          showGrade: true,
          showPageNumber: false,
          showQrCode: false,
          nameLabel: 'Jméno',
          surnameLabel: 'Příjmení',
          classLabel: 'Třída',
          gradeLabel: 'Známka',
          showFeedback: true,
          feedbackType: 'smileys',
          feedbackCount: 5,
          feedbackText: 'Tento pracovní list se mi vyplňoval:',
          showFooterInfo: true,
        },
      };
    case 'chart':
      return {
        id,
        type: 'chart',
        order,
        width: 'full',
        content: {
          chartType: 'bar',
          chartTitle: '',
          chartColumns: ['Kategorie', 'Hodnota'],
          chartRows: [
            ['Leden', '42'],
            ['Únor', '67'],
            ['Březen', '53'],
            ['Duben', '88'],
            ['Květen', '74'],
          ],
          chartHeight: 320,
        } satisfies ChartContent,
      };
    case 'free-canvas':
      return {
        id,
        type: 'free-canvas',
        order,
        width: 'full',
        content: {
          instruction: '',
          objects: [],
          canvasWidth: 750,  // A4 width minus margins
          canvasHeight: 400,
          backgroundColor: '#ffffff',
          showGrid: true,
          gridSize: 20,
          circleColor: '#1e293b',
          circleSize: 21,
        },
      };
  }
}
