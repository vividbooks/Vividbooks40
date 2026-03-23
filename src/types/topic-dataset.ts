/**
 * Topic Data Set - shromážděná data pro generování vzdělávacích materiálů
 */

export interface TopicDataSet {
  id: string;
  
  // Základní info
  topic: string;              // "Starověký Egypt"
  subjectCode: string;        // "dejepis"
  grade: number;              // 6
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'ready' | 'published';
  
  // RVP informace
  rvp: RvpInfo;
  
  // Cílová skupina
  targetGroup: TargetGroupInfo;
  
  // Obsahová data
  content: ContentInfo;
  
  // Média a vizuály
  media: MediaInfo;
  
  // Vygenerované materiály (reference)
  generatedMaterials: GeneratedMaterialRef[];

  // Uzlový bod (milestone) – uzavření tematického celku
  milestone?: boolean;
  milestoneData?: MilestoneData;
  milestone_data?: MilestoneData;
}

// =====================================================
// MILESTONE / UZLOVÝ BOD TYPES
// =====================================================

export interface MilestoneData {
  topicGroupName: string;        // "Starověké Řecko"
  coveredWeekNumbers: number[];  // [14, 15, 16, 17]
  coveredTopics: string[];       // ["Vznik demokracie", "Athény vs. Sparta"]
  test?: MilestoneTest;
  pisemka?: MilestonePisemka;
  hodnoceni?: MilestoneHodnoceni;
}

/** Souhrnný test – otázky různých typů */
export interface MilestoneTest {
  title: string;
  totalPoints: number;
  timeMinutes: number;
  questions: MilestoneQuestion[];
}

export interface MilestoneQuestion {
  id: string;
  type: 'multiple-choice' | 'open' | 'matching' | 'true-false' | 'fill-blank';
  text: string;
  points: number;
  options?: string[];          // pro multiple-choice
  correctAnswer?: string | string[];
  matchPairs?: { left: string; right: string }[];  // pro matching
}

/** Souhrnná písemka – psané úlohy */
export interface MilestonePisemka {
  title: string;
  totalPoints: number;
  timeMinutes: number;
  tasks: MilestonePisemkaTask[];
}

export interface MilestonePisemkaTask {
  id: string;
  title: string;
  instruction: string;
  points: number;
  hint?: string;
}

/** Hodnocení – doporučená kritéria pro 3 typy škol × 5 stupňů */
export interface MilestoneHodnoceni {
  outcomes: string[];           // Očekávané výstupy z RVP
  levels: MilestoneHodnoceniLevel[];
}

export interface MilestoneHodnoceniLevel {
  schoolType: string;           // "ZŠ standardní" | "Gymnázium" | "ZŠ praktická/speciální"
  grades: MilestoneGradeCriteria[];
}

export interface MilestoneGradeCriteria {
  grade: 1 | 2 | 3 | 4 | 5;
  label: string;                // "Výborný" | "Chvalitebný" | "Dobrý" | "Dostatečný" | "Nedostatečný"
  criteria: string[];           // "Žák dokáže pojmenovat principy demokracie..."
}

export interface RvpInfo {
  thematicArea: string;           // "Starověk"
  expectedOutcomes: string[];     // ["Žák charakterizuje...", ...]
  competencies: string[];         // ["kompetence k učení", ...]
  hoursAllocated: number;         // 6
  crossCurricular: string[];      // ["Výchova k občanství", ...]
}

export interface TargetGroupInfo {
  ageRange: string;               // "11-12 let"
  gradeLevel: string;             // "6. třída ZŠ"
  cognitiveLevel: string;         // "konkrétní operace → formální operace"
  priorKnowledge: string[];       // ["základy pravěku", "čtení mapy"]
  specialNeeds?: string;          // poznámky k diferenciaci
}

export interface ContentInfo {
  // Klíčové pojmy s definicemi
  keyTerms: KeyTerm[];
  
  // Hlavní fakta a informace
  keyFacts: string[];
  
  // Časová osa (pokud relevantní)
  timeline?: TimelineEvent[];
  
  // Osobnosti
  personalities?: Personality[];
  
  // Propojení s dneškem
  modernConnections: string[];
  
  // Zajímavosti pro motivaci
  funFacts: string[];
  
  // Zdroje a reference
  sources: string[];
}

export interface KeyTerm {
  term: string;                   // "faraon"
  definition: string;             // "panovník starověkého Egypta"
  emoji?: string;                 // "👑"
}

export interface TimelineEvent {
  date: string;                   // "3000 př.n.l."
  event: string;                  // "sjednocení Egypta"
  importance: 'high' | 'medium' | 'low';
}

export interface Personality {
  name: string;                   // "Cheops"
  role: string;                   // "faraon"
  description: string;            // "nechal postavit největší pyramidu"
}

export interface MediaInfo {
  // Validované obrázky
  images: ValidatedImage[];
  
  // Emoji pro téma
  emojis: string[];               // ["🏺", "📜", "👑", "🐫"]
  
  // Doporučené barvy
  themeColors: string[];          // ["#D4A574", "#8B4513"]
  
  // Prompty pro generování ilustrací
  illustrationPrompts?: IllustrationPrompt[];
  
  // Vygenerované ilustrace
  generatedIllustrations?: GeneratedIllustration[];

  // Mapy
  mapSuggestions?: MapSuggestion[];
  savedMaps?: SavedMap[];

  // Skupiny obrázků (série se sdíleným stylem)
  imageGroups?: ImageGroup[];

  // Grafy
  charts?: any[];
}

// =====================================================
// IMAGE GROUPS – série obrázků se sdíleným stylem
// =====================================================

export type ImageGroupType = 'illustration' | 'photo' | 'diagram';
export type ImageGroupLayout = 'gallery' | 'grid' | 'row';

export interface ImageGroupSubject {
  id: string;
  name: string;           // "Bez černý"
  extraPrompt?: string;   // doplněk k základnímu promptu pro tento subjekt
  imageUrl?: string;      // URL vygenerovaného obrázku
  status: 'pending' | 'generating' | 'done' | 'error';
  error?: string;
}

export interface ImageGroup {
  id: string;
  title: string;                  // "Druhy listnatých keřů"
  description?: string;
  type: ImageGroupType;           // illustration / photo / diagram
  stylePrompt: string;            // sdílený styl: "botanical illustration, white bg, same scale"
  layout: ImageGroupLayout;       // jak zobrazit v dokumentu
  subjects: ImageGroupSubject[];
  createdAt: string;
  updatedAt: string;
}

export interface IllustrationPrompt {
  id: string;
  name: string;                   // "Řecký válečník"
  prompt: string;                 // Full prompt pro AI
  category: 'icon' | 'scene' | 'portrait' | 'object' | 'map';
  keywords: string[];             // ["hoplít", "helma", "štít"]
  status: 'pending' | 'generating' | 'done' | 'error';
}

export interface GeneratedIllustration {
  id: string;
  promptId: string;
  url: string;
  thumbnailUrl?: string;
  name: string;
  generatedAt: string;
}

export interface ValidatedImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  title: string;
  description?: string;
  source: string;                 // "Wikimedia Commons"
  license: string;                // "CC BY-SA"
  relevanceScore: number;         // 0-100
  keywords: string[];
}

export interface GeneratedMaterialRef {
  type: 'text' | 'board' | 'worksheet' | 'test' | 'lesson';
  id: string;
  title: string;
  status: 'draft' | 'published';
  createdAt: string;
}

// =====================================================
// FORMÁT SPECIFIKACE PRO JEDNOTLIVÉ GENERÁTORY
// =====================================================

export interface TextGeneratorInput {
  dataSet: TopicDataSet;
  options: {
    length: 'short' | 'medium' | 'long';  // 200/400/600 slov
    includeInfoboxes: boolean;
    includeTimeline: boolean;
    includeKeyTerms: boolean;
  };
}

export interface BoardGeneratorInput {
  dataSet: TopicDataSet;
  options: {
    type: 'procvicovani' | 'pisemka' | 'lekce';
    difficulty: 'easy' | 'medium' | 'hard';
    questionCount: number;
    questionTypes: ('abc' | 'open' | 'voting' | 'board')[];
    useEUR?: boolean;  // pro lekce - E-U-R metoda
  };
}

export interface WorksheetGeneratorInput {
  dataSet: TopicDataSet;
  options: {
    blockCount: number;
    blockTypes: ('heading' | 'paragraph' | 'fill-blank' | 'multiple-choice' | 'free-answer' | 'image')[];
    difficulty: 'easy' | 'medium' | 'hard';
  };
}

// =====================================================
// MAP TYPES
// =====================================================

/** Região mapy – jakou oblast zobrazit */
export type MapRegionId =
  | 'world'
  | 'europe'
  | 'central-europe'
  | 'mediterranean'
  | 'middle-east'
  | 'africa'
  | 'asia'
  | 'americas'
  | 'czech-republic'
  | 'italy'
  | 'greece'
  | 'france'
  | 'germany'
  | 'custom';

/** Styl mapy */
export type MapStyle =
  | 'political'    // barevné státy
  | 'physical'     // terén, výšky
  | 'blank'        // slepá – ESRI Gray (bez silnic)
  | 'blank_pure'   // čistá slepá – GeoJSON pevnina, nulový detail
  | 'historical'   // historické hranice/barvy
  | 'satellite'    // Esri World Imagery
  | 'dark';        // CartoDB tmavá

/** Typ cvičení s mapou */
export type MapExerciseType =
  | 'identify'     // klikni na správný stát/oblast
  | 'label'        // přetáhni název na správné místo
  | 'color'        // obarvi regiony dle kategorie
  | 'info'         // pouze informativní (ne cvičení)
  | 'route';       // zakresli trasu

/** Bod zájmu na mapě */
export interface MapMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'city' | 'battle' | 'landmark' | 'capital' | 'river' | 'mountain' | 'custom';
  color?: string;
  icon?: string;      // emoji
  description?: string;
  year?: string;      // pro historické události
}

/** Barevné zvýraznění oblasti/státu */
export interface MapHighlight {
  id: string;
  name: string;
  isoCode?: string;   // ISO 3166-1 alpha-3 pro státy (ITA, FRA, ...)
  color: string;
  label?: string;
  description?: string;
  era?: string;       // "218 př. Kr." pro historické mapy
}

/** Vlastní vybarvená oblast (polygon) – sféra vlivu, historické hranice atd. */
export interface MapArea {
  id: string;
  name: string;
  color: string;
  opacity?: number;           // 0–1, default 0.35
  coords: [number, number][]; // polygon – body [lng, lat]
  label?: string;             // popisek uvnitř oblasti
  era?: string;               // historické období
  pattern?: 'solid' | 'hatch' | 'dots'; // výplň
}

/** Trasa / cesta na mapě */
export interface MapRoute {
  id: string;
  name: string;
  points: [number, number][];  // [lng, lat] pairs
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
  arrow?: boolean;
  description?: string;
}

/** Jedna kategorie choroplethové mapy (forma vlády, vegetace, ...) */
export interface ChoroplethCategory {
  id: string;
  label: string;    // "Prezidentská republika"
  color: string;    // hex barva
  isoCodes: string[]; // ISO A3 kódy států v kategorii (ITA, FRA, ...)
}

/** Choropleth konfigurace pro mapu */
export interface MapChoropleth {
  title?: string;               // "Forma vlády"
  valueLabel?: string;          // pro gradient škálu (např. "t/1000 ob./rok")
  type: 'category' | 'gradient'; // kategorie vs. číselná škála
  categories: ChoroplethCategory[];
}

/**
 * Tematická vrstva – barví geografické regiony dle NAME_EN z Natural Earth datasetu.
 * AI vybírá regiony jménem (Sahara, Himalayas, Amazon basin…) a přiřazuje barvy.
 * Výsledek vypadá jako Mapy.cz atlas – přesné hranice, ne AI-generované čtverce.
 *
 * Dostupné datasety:
 *   'ne_regions'  → ne_50m_geography_regions_polys (pouště, pohoří, roviny, tajga…)
 *   'ne_glaciers' → ne_50m_glaciated_areas (ledovce, zaledněné oblasti)
 */
export interface ThematicCategory {
  color: string;       // hex barva pro tuto kategorii
  label: string;       // český název kategorie (zobrazí se v legendě)
  featureNames: string[]; // NAME_EN hodnoty z GeoJSON (Sahara, Gobi Desert, Himalayas…)
}

export interface ThematicLayer {
  title: string;               // název tematické vrstvy (zobrazí se v legendě)
  dataset: 'ne_regions' | 'ne_glaciers' | string;
  categories: ThematicCategory[];
}

/** AI návrh mapy pro dataset */
export interface MapSuggestion {
  id: string;
  title: string;
  description: string;
  region: MapRegionId;
  style: MapStyle;
  exerciseType: MapExerciseType;
  dataHint: string;   // co by AI mělo vygenerovat
}

/** Vrstva/přepínač nastavení mapy (persistentní, uložené spolu s mapou) */
export interface SavedMapOverlays {
  // ── Politika / hranice ─────────────────────────────────────────────────────
  showBorders?: boolean;     // GeoJSON hranice (Natural Earth — jen pro blank_pure)
  showTimezones?: boolean;   // Časové zóny — ne_10m_time_zones

  // ── Hydrografie ────────────────────────────────────────────────────────────
  showRivers?: boolean;      // Řeky — ne_10m_rivers_lake_centerlines
  showLakes?: boolean;       // Jezera — ne_10m_lakes
  showOceans?: boolean;      // Oceány, moře, zálivy — ne_10m_geography_marine_polys

  // ── Reliéf / fyzická geografie ─────────────────────────────────────────────
  showPhysical?: boolean;    // Fyzickogeografické regiony — ne_10m_geography_regions_polys
  showClimate?: boolean;     // Klimatické pásy (Köppen-Geiger)
  showBiomes?: boolean;      // Biomy a ekoregiony (Resolve 2017)

  // ── Geologie ───────────────────────────────────────────────────────────────
  showTectonics?: boolean;   // Tektonické desky — fraxen/tectonicplates
  showVolcanoes?: boolean;   // Vulkány — Smithsonian GVP
  showEarthquakes?: boolean; // Zemětřesení M5.5+ — USGS API

  // ── Lidská geografie ───────────────────────────────────────────────────────
  showCities?: boolean;      // Sídla jako body (QuizMap)
  showAirports?: boolean;    // Letiště — ne_10m_airports
  showRailroads?: boolean;   // Železnice — ne_10m_railroads

  // ── Styl ───────────────────────────────────────────────────────────────────
  showTerrain?: boolean;     // hillshade/relief overlay
  labelMode?: 'none' | 'countries' | 'capitals' | 'cities' | 'all';
  borderColor?: string;
  borderOpacity?: number;
}

/** Uložená mapa s daty */
export interface SavedMap {
  id: string;
  title: string;
  region: MapRegionId;
  style: MapStyle;
  exerciseType: MapExerciseType;
  markers: MapMarker[];
  highlights: MapHighlight[];
  routes: MapRoute[];
  areas?: MapArea[];                 // vlastní vybarvené oblasti (polygony)
  choropleth?: MapChoropleth;        // choropleth – barvení států dle kategorie/hodnoty
  thematicLayer?: ThematicLayer;     // tematická vrstva z NE datasetu (pouště, pohoří…)
  overlays?: SavedMapOverlays;       // persistentní nastavení vrstev (odpovídá MapOverlays v VividMap)
  description?: string;
  correctAnswers?: string[];
  /**
   * Historický rok pro QuizMap – klíč do historical-basemaps datasetu.
   * Formát: "1914", "bc500", "bc1" atd.
   * Pokud je nastaven, QuizMap zobrazí historické hranice místo moderních.
   */
  historicalYear?: string;
  createdAt: string;
}
