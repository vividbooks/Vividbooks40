/**
 * Přednastavené ilustrační styly pro školní produkci (1. stupeň ZŠ, první čtení, pracovní sešity).
 * Používá se v design systému — výběr doplňuje `dataset.illustrationStyles` a `aiPrompts`.
 */

export interface PresetIllustrationStyleDefinition {
  id: string;
  /** Krátký název v UI (česky) */
  name: string;
  /** Popis pro učitele — kdy styl použít */
  description: string;
  /** Směr pro generátor obrázků (anglicky) */
  promptHint: string;
  /** Co spíš vynechat (anglicky) */
  negativePromptHint?: string;
  /** Dvě barvy pro záložní gradient (když se náhledovka nenačte) */
  thumbGradient: readonly [string, string];
  /**
   * Volitelná URL náhledu (jinak `presetCatalogThumbnailUrl(id)` — deterministické foto z picsum).
   */
  thumbnailUrl?: string;
}

/** Deterministický náhled „fotky“ pro dlaždici katalogu (stejné id = stejný obrázek). */
export function presetCatalogThumbnailUrl(presetId: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(presetId)}/320/320`;
}

export const PRESET_ILLUSTRATION_STYLES: PresetIllustrationStyleDefinition[] = [
  {
    id: 'watercolor-storybook',
    name: 'Měkká akvarel',
    description:
      'Mokrý akvarel, jemné přechody, světlé papírové pozadí. Hodí se na pohádky, prvou četbu a citlivé příběhy.',
    promptHint:
      'Soft watercolor illustration for children’s educational books, gentle wet-on-wet washes, visible paper texture, warm and cool pastel tones, rounded friendly shapes, subtle pencil underdrawing, white margins, calm classroom-safe mood.',
    negativePromptHint: 'harsh outlines, neon, photorealistic, scary, cluttered, text overlays',
    thumbGradient: ['#bfdbfe', '#fef3c7'],
  },
  {
    id: 'flat-vector-icons',
    name: 'Plochý vektor',
    description:
      'Čisté ploché tvary, syté ale ne křiklavé barvy. Ideální na pravidla, ikony pojmů a přehledné infografiky.',
    promptHint:
      'Flat vector illustration for primary school materials, bold simple shapes, limited harmonious palette, crisp edges, no gradients or soft airbrush, friendly rounded geometry, consistent stroke weight, plenty of white space.',
    negativePromptHint: '3D, photorealism, sketchy pencil, heavy texture, messy details',
    thumbGradient: ['#6366f1', '#34d399'],
  },
  {
    id: 'chalk-pastel-board',
    name: 'Křída na tabuli',
    description:
      'Jako kresba křídou na zelené nebo černé tabuli — hravé, školní, dobře čitelné z dálky.',
    promptHint:
      'Chalk pastel style on dark green blackboard texture, dusty chalk strokes, hand-drawn classroom doodles, simple diagrams, limited chalk colors (yellow, white, pink, light blue), educational poster look.',
    negativePromptHint: 'digital polish, glossy, photo background, tiny illegible text',
    thumbGradient: ['#14532d', '#fde68a'],
  },
  {
    id: 'clean-line-fill',
    name: 'Čistá linka a výplň',
    description:
      'Konturované obrázky s plochou výplní — skvělé na pracovní listy a tisk se slabým barevným tonerem.',
    promptHint:
      'Clean line art with flat color fills for worksheets, medium-weight outlines, simple cel-shading, high contrast readable at small size, friendly proportions, white or very light background.',
    negativePromptHint: 'heavy shadows, painterly blur, photographic, complex textures',
    thumbGradient: ['#fef9c3', '#93c5fd'],
  },
  {
    id: 'risograph-retro',
    name: 'Retro risograph',
    description:
      'Tisková textura, mírný posun barev, nostalgická knižní estetika — vhodné pro dějepis a literaturu.',
    promptHint:
      'Risograph print aesthetic for textbooks, limited spot colors, slight misregistration texture, grainy ink, mid-century children’s book feel, simple compositions, paper tooth visible.',
    negativePromptHint: 'smooth digital gradient, HDR, hyperrealistic, neon cyber',
    thumbGradient: ['#fda4af', '#fcd34d'],
  },
  {
    id: 'paper-collage',
    name: 'Papírová koláž',
    description:
      'Vystřižené tvary, lepené vrstvy — výtvarné projekty a environmentální témata.',
    promptHint:
      'Paper collage illustration, cut-out colored paper shapes, visible layered edges, soft shadows between layers, craft project look, tactile kindergarten aesthetic, simple narrative scene.',
    negativePromptHint: 'single flat digital layer, airbrush, photo collage of real faces',
    thumbGradient: ['#fecaca', '#86efac'],
  },
  {
    id: 'ink-wash',
    name: 'Tuš a šedá škála',
    description:
      'Jedna barva + šedé tóny, klidné a „vážnější“ — přírodopis, dějepis, starší žáci.',
    promptHint:
      'Ink wash illustration with restrained palette, soft grey tonal washes, occasional single accent color, elegant linework, textbook gravitas, clear silhouettes, subtle paper grain.',
    negativePromptHint: 'rainbow palette, cute kawaii overload, glossy 3D',
    thumbGradient: ['#e2e8f0', '#475569'],
  },
  {
    id: 'pixel-playful',
    name: 'Hráčské pixely',
    description:
      'Pixel art větší zrnitosti, čitelné — informatika, logika, hry vzdělávání.',
    promptHint:
      'Large-pixel friendly pixel art for educational use, clear readable forms, limited palette, no dithering noise, chunky sprites, cheerful but not chaotic, white or simple backdrop.',
    negativePromptHint: 'tiny illegible pixels, photorealistic, anti-aliased painterly',
    thumbGradient: ['#312e81', '#f472b6'],
  },
  {
    id: 'constructivist-geo',
    name: 'Geometrické bloky',
    description:
      'Konstruktivistické tvary, matematika, prostorová představivost, diagramy.',
    promptHint:
      'Constructivist geometric illustration, bold rectangles circles and triangles, primary-ish colors with muted tones, Bauhaus-light educational diagrams, clear spatial relationships, minimal decoration.',
    negativePromptHint: 'organic messy sketch, photorealistic, ornate frames',
    thumbGradient: ['#dc2626', '#fbbf24'],
  },
  {
    id: 'pencil-nature-sketch',
    name: 'Tužková příroda',
    description:
      'Grafitová skica — přírodopis, pozorování, terénní deník.',
    promptHint:
      'Graphite pencil sketch style for nature study, light hatching, accurate but simplified forms, natural history textbook plates, off-white sketchbook paper, educational labeling-friendly negative space.',
    negativePromptHint: 'heavy ink black, saturated color blocks, cartoon exaggeration',
    thumbGradient: ['#d6d3d1', '#78716c'],
  },
  {
    id: 'simple-diagram',
    name: 'Jednoduchá infografika',
    description:
      'Šipky, výřezy, schémata — fyzika, vlastivěda, zdraví.',
    promptHint:
      'Simple educational diagram illustration, clear arrows and labels space, isometric-lite objects, soft flat colors, infographic clarity, consistent icon language, plenty of breathing room for captions.',
    negativePromptHint: 'artistic chaos, painterly, dark moody lighting',
    thumbGradient: ['#e0f2fe', '#0ea5e9'],
  },
  {
    id: 'clay-soft-3d',
    name: 'Měkká plastelína',
    description:
      'Zaoblené „hmotné“ 3D tvary — bezpečný vzhled pro nejmladší, sociální výchova.',
    promptHint:
      'Soft claymation / plasticine look illustration, rounded organic forms, matte surface, gentle studio lighting, saturated but friendly colors, toy-like proportions, no creepy uncanny faces.',
    negativePromptHint: 'sharp edges, hyperreal skin, horror, glossy anime',
    thumbGradient: ['#fbcfe8', '#a7f3d0'],
  },
  {
    id: 'paper-cut',
    name: 'Vystřižený papír',
    description:
      'Stínové vrstvy jako u papírového řezu — výtvarná výchova, příběhy s vrstvami.',
    promptHint:
      'Paper cut-out silhouette style, layered colored paper, long soft drop shadows, storytelling composition, craft illustration, bold shapes, limited palette, children’s book cover feel.',
    negativePromptHint: 'gradient mesh, photo, noisy texture everywhere',
    thumbGradient: ['#7c3aed', '#fbbf24'],
  },
  {
    id: 'comic-clear',
    name: 'Čistý komiks',
    description:
      'Silné obrysy, jasné výrazy — dialogy, jazyk, dramatická četba zjednodušená.',
    promptHint:
      'Clear-line comic illustration for young readers, readable facial expressions, simple backgrounds, bold outlines, limited screentone optional, educational tone not superhero violence, panel-friendly composition.',
    negativePromptHint: 'gore, dark noir, overcrowded panels, tiny details',
    thumbGradient: ['#fef08a', '#38bdf8'],
  },
  {
    id: 'minimal-line-art',
    name: 'Minimalistická linka',
    description:
      'Tenká černá linka, hodně bílé — pracovní sešity s vlastním vybarvením.',
    promptHint:
      'Minimal line art illustration, single-weight black lines on white, generous whitespace, coloring-book friendly, simple icons and scenes, no gray fills unless very light, crisp print reproduction.',
    negativePromptHint: 'heavy blacks, watercolor, photorealistic shading',
    thumbGradient: ['#ffffff', '#cbd5e1'],
  },
  {
    id: 'warm-pastel-story',
    name: 'Teplý pastelový příběh',
    description:
      'Teplé béžové a broskvové tóny — čtenářská gramotnost, empatické příběhy.',
    promptHint:
      'Warm pastel storybook illustration, peach cream and soft terracotta palette, gentle gradients, cozy classroom-safe scenes, rounded characters, emotional warmth without sentimentality overload.',
    negativePromptHint: 'cold neon, harsh contrast, horror, empty void',
    thumbGradient: ['#ffedd5', '#fdba74'],
  },
  {
    id: 'nature-realistic-soft',
    name: 'Jemná přírodní realistika',
    description:
      'Rostliny a živočichové věrně ale zjednodušeně — přírodopis 2. stupně light.',
    promptHint:
      'Soft naturalistic educational illustration, accurate proportions simplified, gentle lighting, botanical textbook clarity, muted greens and earth tones, white background plate style, no gore.',
    negativePromptHint: 'cartoon giant eyes, fantasy creatures unless asked, macro noise',
    thumbGradient: ['#bbf7d0', '#166534'],
  },
  {
    id: 'map-hand-drawn',
    name: 'Ručně kreslená mapa',
    description:
      'Dobové mapy, vlastivěda, orientace — styl pergamen / inkoust.',
    promptHint:
      'Hand-drawn map illustration style for school, parchment or off-white paper, ink coastlines, soft watercolor land tints, decorative compass rose optional, legible simplified geography, antique textbook charm.',
    negativePromptHint: 'satellite photo, GIS sharpness, modern UI map',
    thumbGradient: ['#fde68a', '#92400e'],
  },
  {
    id: 'sticker-kawaii-lite',
    name: 'Samolepky (jemné)',
    description:
      'Zaoblené „nálepky“ s jemným obrysem — motivace, odměny, prvňáci.',
    promptHint:
      'Sticker-style cute illustration, thick white outer outline, glossy highlight spots subtle, friendly kawaii-lite (no overload), simple props, bright but not neon, white background, icon-like clarity.',
    negativePromptHint: 'scary, grotesque, hyper-anime detail, busy patterns',
    thumbGradient: ['#fce7f3', '#c084fc'],
  },
  {
    id: 'textbook-realist-line-color',
    name: 'Učebnicová linka + barva',
    description:
      'Klasická učebnicová ilustrace — kontura + realistická ale zjednodušená výplň.',
    promptHint:
      'Classic textbook illustration, controlled line work plus restrained watercolor or gouache fill, accurate educational subject matter, neutral lighting, white background, professional publisher quality for schools.',
    negativePromptHint: 'fantasy exaggeration, messy sketch, dark gritty',
    thumbGradient: ['#f1f5f9', '#3b82f6'],
  },
  // ── Další styly (včetně fotografie) ─────────────────────────────
  {
    id: 'photo-bright-classroom',
    name: 'Foto: světlá výuka',
    description:
      'Jasná realistická fotografie výuky — jako stock pro metodické materiály, katalogy škol.',
    promptHint:
      'Bright realistic educational photography for school publications, natural daylight, clean modern classroom or learning space, shallow depth of field, neutral optimistic colors, professional stock-photo look, no legible text, no logos.',
    negativePromptHint: 'illustration, cartoon, CGI, dark moody, cluttered, watermark, faces in sharp portrait detail',
    thumbGradient: ['#e0f2fe', '#fef9c3'],
  },
  {
    id: 'photo-documentary-reportage',
    name: 'Foto: dokument / reportáž',
    description:
      'Reportážní tón — školní akce, exkurze, „živý“ pocit z materiálu.',
    promptHint:
      'Documentary-style educational photography, candid moment, natural color grading, slight grain, journalistic composition, authentic school context, respectful distance, editorial textbook supplement feel.',
    negativePromptHint: 'studio illustration, heavy HDR, glam retouch, violent content',
    thumbGradient: ['#d6d3d1', '#78716c'],
  },
  {
    id: 'photo-macro-nature',
    name: 'Foto: makro příroda',
    description:
      'Detail rostlin, hmyzu, textur — přírodopis a pozorování.',
    promptHint:
      'Macro nature photography for biology education, sharp subject, soft blurred background, natural outdoor light, scientific clarity, specimen or plant detail, educational plate aesthetic.',
    negativePromptHint: 'cartoon, diagram overlay, fake microscope UI',
    thumbGradient: ['#dcfce7', '#14532d'],
  },
  {
    id: 'photo-museum-archive',
    name: 'Foto: muzejní předmět',
    description:
      'Artefakt, exponát, historie — klidné osvětlení vitríny.',
    promptHint:
      'Museum archive photography for history lessons, soft even lighting, neutral grey or warm gallery background, artifact or old object centered, educational catalog style, no harsh flash.',
    negativePromptHint: 'cartoon reconstruction, fantasy, busy tourists',
    thumbGradient: ['#f5f5f4', '#a8a29e'],
  },
  {
    id: 'photo-sports-gym',
    name: 'Foto: sport a pohyb',
    description:
      'Tělocvik, hřiště, dynamika — bez agresivních motivů.',
    promptHint:
      'Youth-friendly sports photography for PE textbooks, outdoor or gym, motion implied but clear subject, bright energetic colors, safety gear where appropriate, editorial school-safe framing.',
    negativePromptHint: 'violence, injuries, pro league branding, dark gritty fight',
    thumbGradient: ['#bae6fd', '#22c55e'],
  },
  {
    id: 'photo-science-lab',
    name: 'Foto: laboratoř',
    description:
      'Věda v akci — skla, měření (bez čitelných štítků chemie).',
    promptHint:
      'Clean science lab photography for chemistry/physics education, glassware and equipment, bright neutral lab lighting, shallow depth of field, professional textbook stock, no readable labels or brands.',
    negativePromptHint: 'cartoon lab, explosion, horror, illegible hazard jokes',
    thumbGradient: ['#f0f9ff', '#94a3b8'],
  },
  {
    id: 'photo-library-reading',
    name: 'Foto: čtení a knihy',
    description:
      'Čtenářská gramotnost, knihovna, klidné soustředění.',
    promptHint:
      'Warm editorial photography of books and reading environment for literacy materials, soft window light, shallow depth of field, cozy but institutional, hands or silhouettes optional, no readable book covers.',
    negativePromptHint: 'cartoon books, neon, messy hoarder',
    thumbGradient: ['#fef3c7', '#b45309'],
  },
  {
    id: 'photo-outdoor-lesson',
    name: 'Foto: výuka venku',
    description:
      'Škola v přírodě, stezka, pozorování — prostor a světlo.',
    promptHint:
      'Outdoor environmental education photography, field trip mood, natural daylight, trees or trail context, wide angle friendly, National Geographic school edition tone, respectful nature learning.',
    negativePromptHint: 'studio backdrop, illustration, extreme weather danger',
    thumbGradient: ['#ecfccb', '#3f6212'],
  },
  {
    id: 'photo-still-life-objects',
    name: 'Foto: zátiší pomůcek',
    description:
      'Školní pomůcky naskládané čistě — obálky, pomůcky, přehled.',
    promptHint:
      'Top-down or ¾ still-life product-style photography of school supplies on solid pastel background, soft shadow, catalog clarity for worksheets and covers, minimal props, no brand logos.',
    negativePromptHint: 'messy desk, illustration, chaotic clutter',
    thumbGradient: ['#fce7f3', '#f9a8d4'],
  },
  {
    id: 'photo-warm-portrait-bust',
    name: 'Foto: portrét (bez detailu)',
    description:
      'Jemný portrétní tón z dálky — spíš atmosféra než identita (vhodné jen kde dává smysl).',
    promptHint:
      'Distant soft-focus portrait photography for educational context only, warm natural light, subject not identifiable, back view or silhouette acceptable, inclusive and respectful, school brochure aesthetic.',
    negativePromptHint: 'sharp facial recognition detail, glamour retouch, cartoon',
    thumbGradient: ['#ffedd5', '#fb923c'],
  },
];

export function presetStyleDatasetId(presetId: string): string {
  return `preset-${presetId}`;
}
