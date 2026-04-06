/**
 * Po nahrání referenčního obrázku: uloží **celý soubor** jako referenci (bez automatických výřezů).
 * Výřezy ilustrací ze stránek běží až při **generování** design systému — viz `expandDatasetWithLayoutIllustrationCrops`.
 *
 * Vision řetězec (`analyzeLayoutAndBoxes`, import-styl) se používá jen u `appendIllustrationCropsFromLayoutPageUrl` při tomto kroku.
 * Přehled: `docs/design-system-ai-pipeline.md`
 */

import { chatWithAIProxy, type ChatMessageContentPart } from '../ai-chat-proxy';
import type { DatasetFile, DesignSystemDataset } from '../../types/design-system';
import { extractJsonObjectFromModelText } from '../../types/design-system-agent';
import { cropNormalizedRegionToPngDataUrl, type NormalizedBox } from '../image-crop';
import { processImageUrl } from '../supabase/upload-image';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUTO_CROPS = 6;
/** Min. šířka/výška boxu jako zlomek stránky — malé vložené fotky na učebnici. */
const MIN_BOX_FRAC = 0.022;

export const REF_NOTE_LAYOUT_DEFAULT = 'referenční layout (screenshot stránky)';
export const REF_NOTE_ILLUSTRATION_CROP = 'výřez ilustrace ze stránky (auto)';
export const REF_NOTE_ILLUSTRATION_STANDALONE = 'referenční styl ilustrace';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.byteLength; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(binary);
}

async function fetchUrlAsImagePart(url: string): Promise<ChatMessageContentPart | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size > MAX_IMAGE_BYTES) return null;
    const mimeType = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';
    const buf = await blob.arrayBuffer();
    return { type: 'image', data: arrayBufferToBase64(buf), mimeType };
  } catch {
    return null;
  }
}

const ANALYZE_SYSTEM = `You classify one image for a textbook / worksheet design-system tool (Vividbooks, often Czech pages).

Return ONE JSON object only. No markdown fences.

Shape:
{
  "kind": "layout_screenshot" | "illustration_only" | "mixed",
  "illustrationBoxes": [
    { "x": number, "y": number, "w": number, "h": number, "label": string }
  ]
}

kind:
- layout_screenshot: full page with columns of text, headings, educational layout.
- illustration_only: almost only one drawing/photo/texture — no real „page“ structure.
- mixed: like layout but you also clearly see separable figures.

CRITICAL — illustrationBoxes for pages (layout_screenshot or mixed):
You MUST output a separate tight box for EACH distinct non-text visual on the page so they can be cropped out as reference images:
  inset photographs (even small), diagrams / cross-sections / maps, cartoon characters or mascots, decorative lesson art.
Do NOT use one box for the whole page. Do NOT box large blank margins or pure text blocks.
If the page truly has zero photos/diagrams/illustrations (text-only), use [].

illustration_only: usually illustrationBoxes: [] (the full upload is the style reference). Use one box only if one clear figure sits in large empty margin.

Maximum 6 boxes, ordered by importance (largest narrative visuals first). Normalized 0–1 (x,y top-left; w,h fractions of image). Minimum box ~2.2% of width and height. 3 decimal places.`;

const EXTRACT_ILLUSTRATIONS_SYSTEM = `Educational page image (textbook, worksheet, slide — may be Czech).

Return ONE JSON object only. No markdown.

{ "illustrationBoxes": [ { "x", "y", "w", "h", "label" } ] }

List EVERY separable visual that is not running body text:
photos, diagrams, charts, cross-sections, maps, cartoon/mascot characters, standalone decorative illustrations.

Tight boxes; normalized 0–1; up to 6; min ~2% width and height per box; no whole-page box.
Text-only page → []. 3 decimal places.`;

type AnalyzeKind = 'layout_screenshot' | 'illustration_only' | 'mixed';

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Stejná normalizace souřadnic jako u záložky AI import (ProImportPanel). */
function normalizeCropBoxLikeImport(cropBox: unknown): NormalizedBox | null {
  if (!cropBox || typeof cropBox !== 'object') return null;
  const o = cropBox as Record<string, unknown>;
  let x = Number(o.x ?? 0);
  let y = Number(o.y ?? 0);
  let w = Number(o.w ?? 1);
  let h = Number(o.h ?? 1);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
  if (x > 1 || y > 1 || w > 1 || h > 1) {
    x /= 100;
    y /= 100;
    w /= 100;
    h /= 100;
  }
  x = Math.max(0, Math.min(1, x));
  y = Math.max(0, Math.min(1, y));
  w = Math.max(0.01, Math.min(1 - x, w));
  h = Math.max(0.01, Math.min(1 - y, h));
  return { x, y, w, h };
}

/**
 * Druhý kanál detekce — stejná sémantika jako „AI import“: model vrací JSON s image bloky a _cropBox / _galleryCropBoxes.
 * Používá gemini-3.1-pro (fallback flash), protože u jednoduchého „jen boxy“ promptu často selhával ořez.
 */
const IMPORT_STYLE_ILLUSTRATION_SYSTEM = `Jsi stejný analytik jako při záložce „AI import“ v editoru Vividbooks (import pracovního listu ze screenshotu).

Vrať POUZE platný JSON, žádný markdown, žádný komentář.

Formát (povinný tvar):
{ "blocks": [ ... ] }

Každý prvek v "blocks" musí být typu "image" — žádné heading, paragraph ani jiné typy.
Úkolem je najít každý samostatný vizuální prvek na stránce (fotka, ilustrace, maskot, schéma, mapa, graf, ikona…), který NENÍ souvislý běžný text.

Pravidla souřadnic (stejná jako u AI importu):
- _cropBox: { "x", "y", "w", "h" } — relativní k CELOÉMU obrázku stránky, x,y = levý horní roh (0–1), w,h = šířka a výška (0–1).
- Pokud je vedle sebe více obrázků v jedné řadě/sloupci, použij JEDEN blok "image" s "gallery": [""] (prázdné řetězce) a "_galleryCropBoxes": [ {...}, {...} ] — stejný počet položek.
- Každý výřez musí být těsný kolem vizuálu, ne celá stránka (max. výjimka: jediný obrázek přes celý snímek).
- Maximálně 6 výřezů celkem (počítají se jednotlivé boxy v _galleryCropBoxes jako samostatné výřezy).

Příklad jednoho obrázku:
{ "type": "image", "content": { "url": "", "alt": "popis", "size": 100, "_cropBox": { "x": 0.05, "y": 0.32, "w": 0.4, "h": 0.25 } } }

Příklad galerie čtyř fotek v řadě:
{ "type": "image", "content": { "url": "", "alt": "řada", "gallery": ["","","",""], "gridColumns": 4, "_galleryCropBoxes": [{"x":0.02,"y":0.3,"w":0.22,"h":0.25},{"x":0.27,"y":0.3,"w":0.22,"h":0.25},{"x":0.52,"y":0.3,"w":0.22,"h":0.25},{"x":0.77,"y":0.3,"w":0.22,"h":0.25}] } }`;

function parseImportStyleBlocksToBoxes(json: unknown): NormalizedBox[] {
  if (typeof json !== 'object' || json === null) return [];
  const o = json as Record<string, unknown>;
  const blocks = o.blocks;
  if (!Array.isArray(blocks)) return [];
  const out: NormalizedBox[] = [];
  for (const block of blocks) {
    if (typeof block !== 'object' || block === null) continue;
    const b = block as Record<string, unknown>;
    if (b.type !== 'image') continue;
    const content = b.content;
    if (typeof content !== 'object' || content === null) continue;
    const c = content as Record<string, unknown>;
    const single = normalizeCropBoxLikeImport(c._cropBox);
    if (single) out.push(single);
    const galleryBoxes = c._galleryCropBoxes;
    if (Array.isArray(galleryBoxes)) {
      for (const gb of galleryBoxes) {
        const box = normalizeCropBoxLikeImport(gb);
        if (box) out.push(box);
      }
    }
    const blockImg = c._blockImage;
    if (typeof blockImg === 'object' && blockImg !== null) {
      const bi = (blockImg as Record<string, unknown>).cropBox;
      const box = normalizeCropBoxLikeImport(bi);
      if (box) out.push(box);
    }
  }
  return sanitizeBoxes(out);
}

async function runImportStyleIllustrationExtractor(imageUrl: string): Promise<NormalizedBox[]> {
  const img = await fetchUrlAsImagePart(imageUrl);
  if (!img) return [];

  const userContent: ChatMessageContentPart[] = [
    {
      type: 'text',
      text: 'Analyzuj tento snímek stránky z učebnice / pracovního listu. Vrať JSON pouze s image bloky a crop boxy podle systémového zadání.',
    },
    img,
  ];

  const models = ['gemini-3.1-pro', 'gemini-3-flash'] as const;
  for (const model of models) {
    try {
      const raw = await chatWithAIProxy(
        [
          { role: 'system', content: IMPORT_STYLE_ILLUSTRATION_SYSTEM },
          { role: 'user', content: userContent },
        ],
        model,
        { temperature: 0.22, max_tokens: 8192, thinking_level: 'low' },
      );
      const json = extractJsonObjectFromModelText(raw);
      const boxes = parseImportStyleBlocksToBoxes(json);
      if (boxes.length > 0) return boxes;
    } catch {
      /* try next model */
    }
  }
  return [];
}

function sanitizeBoxes(raw: unknown): NormalizedBox[] {
  if (!Array.isArray(raw)) return [];
  const out: NormalizedBox[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    const x = clamp01(Number(o.x));
    const y = clamp01(Number(o.y));
    let w = clamp01(Number(o.w));
    let h = clamp01(Number(o.h));
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) continue;
    if (w < MIN_BOX_FRAC || h < MIN_BOX_FRAC) continue;
    if (x + w > 1) w = 1 - x;
    if (y + h > 1) h = 1 - y;
    if (w < MIN_BOX_FRAC || h < MIN_BOX_FRAC) continue;
    out.push({ x, y, w, h });
  }
  out.sort((a, b) => b.w * b.h - a.w * a.h);
  return out.slice(0, MAX_AUTO_CROPS);
}

async function runVisionAnalyze(imageUrl: string): Promise<{ kind: AnalyzeKind; boxes: NormalizedBox[] } | null> {
  const img = await fetchUrlAsImagePart(imageUrl);
  if (!img) return null;

  const userContent: ChatMessageContentPart[] = [
    {
      type: 'text',
      text: 'Analyze this single image and return the JSON object as specified.',
    },
    img,
  ];

  const models = ['gemini-3.1-pro', 'gemini-3-flash'] as const;
  for (const model of models) {
    try {
      const raw = await chatWithAIProxy(
        [
          { role: 'system', content: ANALYZE_SYSTEM },
          { role: 'user', content: userContent },
        ],
        model,
        { temperature: 0.2, max_tokens: 4096, thinking_level: 'low' },
      );
      const json = extractJsonObjectFromModelText(raw);
      if (typeof json !== 'object' || json === null || Array.isArray(json)) continue;
      const o = json as Record<string, unknown>;
      const kindRaw = o.kind;
      const kind: AnalyzeKind =
        kindRaw === 'illustration_only' || kindRaw === 'mixed' || kindRaw === 'layout_screenshot'
          ? kindRaw
          : 'layout_screenshot';
      const boxes = sanitizeBoxes(o.illustrationBoxes);
      return { kind, boxes };
    } catch {
      /* next model */
    }
  }
  return null;
}

/** Druhý průchod: jen boxy, když první krok vrátil layout bez výřezů. */
async function runVisionExtractIllustrationsOnly(imageUrl: string): Promise<NormalizedBox[]> {
  const img = await fetchUrlAsImagePart(imageUrl);
  if (!img) return [];

  const userContent: ChatMessageContentPart[] = [
    {
      type: 'text',
      text: 'Return only the JSON object with illustrationBoxes for this page.',
    },
    img,
  ];

  const models = ['gemini-3.1-pro', 'gemini-3-flash'] as const;
  for (const model of models) {
    try {
      const raw = await chatWithAIProxy(
        [
          { role: 'system', content: EXTRACT_ILLUSTRATIONS_SYSTEM },
          { role: 'user', content: userContent },
        ],
        model,
        { temperature: 0.15, max_tokens: 4096, thinking_level: 'low' },
      );
      const json = extractJsonObjectFromModelText(raw);
      if (typeof json !== 'object' || json === null || Array.isArray(json)) continue;
      const o = json as Record<string, unknown>;
      const boxes = sanitizeBoxes(o.illustrationBoxes);
      if (boxes.length > 0) return boxes;
    } catch {
      /* next model */
    }
  }
  return [];
}

async function analyzeLayoutAndBoxes(imageUrl: string): Promise<{ kind: AnalyzeKind; boxes: NormalizedBox[] } | null> {
  const first = await runVisionAnalyze(imageUrl);
  if (!first) {
    const importBoxes = await runImportStyleIllustrationExtractor(imageUrl);
    if (importBoxes.length === 0) return null;
    return { kind: 'layout_screenshot', boxes: importBoxes };
  }
  let { kind, boxes } = first;
  if ((kind === 'layout_screenshot' || kind === 'mixed') && boxes.length === 0) {
    boxes = await runVisionExtractIllustrationsOnly(imageUrl);
  }
  if (boxes.length === 0) {
    boxes = await runImportStyleIllustrationExtractor(imageUrl);
  }
  return { kind, boxes };
}

/**
 * Po úspěšném uploadu: jedna položka — **celá stránka / obrázek** jako vizuální reference k design systému.
 * Automatické výřezy se nedělají (nepleteme nahrání s krokem „výřezy“ při generování).
 */
export async function enrichUploadedDesignSystemReference(
  base: DatasetFile,
  slotsRemaining: number,
): Promise<DatasetFile[]> {
  if (!base.url?.startsWith('http') || base.kind !== 'image') {
    return [base];
  }
  if (slotsRemaining < 1) {
    return [base];
  }

  return [
    {
      ...base,
      referenceRole: 'layout',
      referenceNote: base.referenceNote?.trim() || REF_NOTE_LAYOUT_DEFAULT,
    },
  ];
}

/** Max. počet referenčních obrázků v datasetu (layout, styly, AI náhledy) — sjednoceno s DesignSystemCanvasWorkspace. */
export const DESIGN_SYSTEM_MAX_REFERENCE_IMAGES = 24;

/**
 * Před generováním: odstraní staré auto-výřezy a z aktuálních **layout** stránek doplní nové výřezy (stejná logika jako „Vyříznout ilustrace“).
 */
export async function expandDatasetWithLayoutIllustrationCrops(
  dataset: DesignSystemDataset,
  options?: { maxTotalImages?: number },
): Promise<DesignSystemDataset> {
  const maxTotal = options?.maxTotalImages ?? DESIGN_SYSTEM_MAX_REFERENCE_IMAGES;
  let files = [...(dataset.files ?? [])].filter(
    (f) => !(f.kind === 'image' && f.referenceNote === REF_NOTE_ILLUSTRATION_CROP),
  );

  const layoutPages = files.filter(
    (f) =>
      f.kind === 'image' &&
      Boolean(f.url?.startsWith('http')) &&
      f.referenceRole !== 'illustration',
  );

  let imageCount = files.filter((f) => f.kind === 'image').length;

  for (const page of layoutPages) {
    const slots = maxTotal - imageCount;
    if (slots < 1) break;
    const url = page.url;
    if (!url) continue;
    const newCrops = await appendIllustrationCropsFromLayoutPageUrl(url, page.name, slots);
    if (newCrops.length === 0) continue;
    files = [...files, ...newCrops];
    imageCount += newCrops.length;
  }

  return {
    ...dataset,
    files,
  };
}

/**
 * Jen výřezy z už uložené layout stránky (bez duplikace layout záznamu).
 * Pro doplnění referencí u starších uploadů nebo po selhání ořezu.
 */
export async function appendIllustrationCropsFromLayoutPageUrl(
  layoutUrl: string,
  layoutBaseName: string,
  maxToAdd: number,
): Promise<DatasetFile[]> {
  if (!layoutUrl.startsWith('http') || maxToAdd < 1) return [];

  const analyzed = await analyzeLayoutAndBoxes(layoutUrl);
  if (!analyzed) return [];
  const { boxes } = analyzed;
  if (boxes.length === 0) return [];

  const crops: DatasetFile[] = [];
  const n = Math.min(boxes.length, MAX_AUTO_CROPS, maxToAdd);
  const safeBase = layoutBaseName.replace(/\.[^.]+$/, '').slice(0, 80);

  for (let i = 0; i < n; i++) {
    const box = boxes[i];
    const dataUrl = await cropNormalizedRegionToPngDataUrl(layoutUrl, box);
    if (!dataUrl) continue;
    const url = await processImageUrl(dataUrl, `ds-crop-retry-${Date.now()}-${i}`, 'design-system-refs');
    if (!url) continue;
    crops.push({
      id: `ds-crop-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      name: `${safeBase}-vyřez-${i + 1}.png`,
      kind: 'image',
      url,
      mimeType: 'image/png',
      uploadedAt: new Date().toISOString(),
      referenceRole: 'illustration',
      referenceNote: REF_NOTE_ILLUSTRATION_CROP,
    });
  }

  return crops;
}
