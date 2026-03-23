/**
 * ProImportPanel - Import agent panel integrovaný do Pro Editoru
 * 
 * Kompaktní verze Import Agent Studia pro sidebar (300px).
 * Nahraje screenshot → AI analyzuje → bloky se přidají přímo do worksheetu.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, Send, Loader2, X, Sparkles, ImageIcon,
  ChevronUp, ChevronDown, AlertCircle, Settings, RotateCcw,
  Check, FileText, CheckCircle2, PenLine, HelpCircle,
  BookOpen, Info, ImageUp, Code, Copy
} from 'lucide-react';
import { WorksheetBlock, generateBlockId } from '../../types/worksheet';
import { supabase } from '../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { uploadBase64ToStorage } from '../../utils/supabase/upload-image';
import { convertLegacyLayoutsToLayoutSections } from '../../utils/layout-sections';

// ============================================
// DEFAULT SYSTEM PROMPT
// ============================================

const PROMPT_VERSION = 9;

const DEFAULT_SYSTEM_PROMPT = `Jsi AI agent pro konverzi vizuálních pracovních listů do strukturovaného JSON formátu.

TVŮJ ÚKOL:
Analyzuj screenshot/obrázek pracovního listu a převeď ho na pole bloků.

DOSTUPNÉ TYPY BLOKŮ:

1. heading - content: { text: string, level: "h1"|"h2"|"h3", align?: "left"|"center"|"right", textColor?: string, highlightColor?: string, isBold?: boolean, headingStyle?: "plain"|"pill"|"underline"|"left-border" }
2. paragraph - content: { html: string, columns?: 1|2|3 }
3. infobox - content: { title?: string, html: string, variant: "blue"|"green"|"yellow"|"purple" }
   POZOR: infobox je blok s informačním textem (definice, pravidlo, poznámka). NEPOUŽÍVEJ infobox pro nadpisy sekcí!
4. multiple-choice - content: { question: string, options: [{id: "opt-1", text: string}], correctAnswers: string[], allowMultiple: boolean }
5. fill-blank - content: { instruction?: string, segments: [{ type: "text", content: string } | { type: "blank", id: "blank-1", correctAnswer: string }] }
6. free-answer - content: { question: string, lines: number, hint?: string, sampleAnswer?: string, subQuestions?: [{id: "sq-1", text: string, lines: number, sampleAnswer?: string}], subColumns?: 1|2|3, subLabelType?: "letters"|"numbers"|"none", subQuestionColors?: string[], subShowBackground?: boolean, subShowLines?: boolean, subLabelStyle?: "text"|"circle"|"circle-outline", subLabelColors?: string[], subAnswerStyle?: "dotted"|"solid"|"space"|"none", subIndent?: boolean }
7. image - JEDEN obrázek: content: { url: "", alt: string, caption?: string, size: 100, alignment: "center", gallery: [""], galleryCaptions: ["popisek"], gridColumns: 1, _cropBox: { x: number, y: number, w: number, h: number } }
   image - GALERIE (více obrázků vedle sebe): content: { url: "", alt: string, caption?: string, size: 100, alignment: "center", gallery: ["","","",""], galleryCaptions: ["popisek1","popisek2","popisek3","popisek4"], gridColumns: 4, _galleryCropBoxes: [{ x: 0.0, y: 0.3, w: 0.22, h: 0.2 }, { x: 0.25, y: 0.3, w: 0.22, h: 0.2 }, { x: 0.5, y: 0.3, w: 0.22, h: 0.2 }, { x: 0.75, y: 0.3, w: 0.22, h: 0.2 }] }
   DŮLEŽITÉ - GALERIE: Pokud vidíš na screenshotu VÍCE obrázků vedle sebe (např. 4 fotky v řadě), vytvoř JEDEN image blok s:
   - gallery: pole prázdných URL (systém je doplní) – počet = počet obrázků
   - galleryCaptions: popisky pod každým obrázkem (pokud jsou viditelné)
   - gridColumns: počet sloupců (2 = 2 vedle sebe, 4 = 4 vedle sebe)
   - _galleryCropBoxes: pole cropBox souřadnic pro každý obrázek zvlášť
   - _cropBox NEVYPLŇUJ pro galerie (jen _galleryCropBoxes)
8. table - content: { html: "<table>...</table>", rows: number, columns: number, hasHeader: boolean, hasBorder: true, hasRoundedCorners: true, colorStyle?: "default"|"blue"|"green"|"purple"|"yellow"|"red"|"pink"|"cyan" }
   POZOR: Barvu tabulky řeš VÝHRADNĚ přes colorStyle, NIKDY nepřidávej barvy do inline stylů v HTML! HTML tabulky musí mít ČISTÝ HTML bez jakýchkoli style atributů. Příklad správného html: "<table><thead><tr><th></th><th>1</th></tr></thead><tbody><tr><td>565</td><td></td></tr></tbody></table>"
9. connect-pairs - content: { instruction?: string, pairs: [{id, left: {id,type:"text",content}, right: {id,type:"text",content}}], shuffleSides: true }
10. examples - content: { sampleExample: string, examples: [{id, expression, answer, difficulty}], examplesCount: number, columns: 1|2|3, labelType: "none", answerBoxStyle: "line" }
11. spacer - content: { height: number, style: "empty"|"dotted"|"lined" }
12. header-footer - content: { variant: "header", columns: 1, showName: true, showSurname: true, showClass: true, showGrade: true }

VÝSTUPNÍ FORMÁT (vrať POUZE JSON, žádný markdown):
{ "title": "název listu", "blocks": [{ "type": "heading", "content": { ... } }, ...] }

PRAVIDLA:
- Rozpoznej typ každé sekce (nadpis, otázka, text, tabulka...)
- Zachovej přesný textový obsah
- NIKDY NEPOUŽÍVEJ HTML v polích "question" a "text" u free-answer bloků! Jsou to PLAIN TEXT pole. Žádné <span>, <b>, HTML tagy. Jen čistý text.
- NEPIŠ číslo úlohy (např. "1.", "19.") do pole question! Číslování se přidává automaticky kroužkem.
- Otázky s A/B/C/D → "multiple-choice", mezery k doplnění → "fill-blank"
- Matematické příklady → "examples", tabulky → "table", spojovačky → "connect-pairs"

NADPISY (DŮLEŽITÉ!):
- Krátké nadpisy sekcí jako "Procvičuj", "Opakování", "Úkoly" → VŽDY type "heading", NIKDY "infobox"!
- Pokud má nadpis barevné pozadí ve tvaru pill/ovál → headingStyle: "pill", highlightColor: barva pozadí (např. "#dcfce7" zelená, "#dbeafe" modrá)
- Pokud má nadpis levou barevnou lištu → headingStyle: "left-border", highlightColor: barva lišty
- Pokud je podtržený → headingStyle: "underline"
- Prostý nadpis → headingStyle: "plain" nebo vynech

TABULKY (DŮLEŽITÉ!):
- HTML tabulky MUSÍ být ČISTÉ bez inline stylů! Žádné style="..." atributy v tagu <table>, <th>, <td>, <tr>!
- Barvu tabulky řeš POUZE pomocí colorStyle: "green"|"blue"|"purple"|"yellow"|"red"|"pink"|"cyan"|"default"
- Zelené okraje/záhlaví → colorStyle: "green", modré → "blue", atd.
- Špatně: <th style="border: 1px solid #15803d; background-color: #dcfce7;">
- Správně: <th>obsah</th> + colorStyle: "green"

ČÍSLOVÁNÍ AKTIVIT (DŮLEŽITÉ!):
- Bloky typu "free-answer", "multiple-choice", "fill-blank" se AUTOMATICKY číslují kroužkem (1, 2, 3...).
- NEPIŠ číslo cvičení (např. "1.", "2.") do textu question! Číslo se přidá automaticky.
- Pokud má cvičení instrukci a za ní tabulku, NEJDŘÍVE vytvoř free-answer blok s question (BEZ čísla!) a lines: 0, a ZA ním table blok.
- Příklad: text "1. U každého z čísel..." → question: "U každého z čísel..." (bez "1."), lines: 0
- Blok "paragraph" se NEČÍSLUJE - nepoužívej paragraph pro zadání cvičení!

- Odhadni správné odpovědi kde je to zřejmé

OBRÁZKY V PRACOVNÍM LISTU (DŮLEŽITÉ!):
- Pokud na screenshotu vidíš OBRÁZKY (fotky, ilustrace, ikony, schémata, grafy, mapy – cokoliv co není text/tabulka), vytvoř pro ně blok "image".
- U každého image bloku MUSÍŠ uvést _cropBox nebo _galleryCropBoxes s PŘESNÝMI relativními souřadnicemi.
  Souřadnice jsou relativní k celému screenshotu: x, y = levý horní roh (0–1), w, h = šířka a výška (0–1).

- JEDEN obrázek: použij _cropBox: { x, y, w, h }
  Příklad: _cropBox: { x: 0.05, y: 0.32, w: 0.4, h: 0.25 }

- VÍCE OBRÁZKŮ VEDLE SEBE (galerie): použij JEDEN image blok s _galleryCropBoxes!
  NIKDY nevytvárej samostatné image bloky pro každý obrázek v řadě!
  Příklad pro 4 obrázky vedle sebe:
  { "type": "image", "content": { "url": "", "alt": "Typy buněk", "gallery": ["","","",""], "galleryCaptions": ["řez kořenem","řez kloubem myši","řez kostí","řez potní žlázou"], "gridColumns": 4, "size": 100, "_galleryCropBoxes": [{"x":0.02,"y":0.3,"w":0.22,"h":0.25},{"x":0.27,"y":0.3,"w":0.22,"h":0.25},{"x":0.52,"y":0.3,"w":0.22,"h":0.25},{"x":0.77,"y":0.3,"w":0.22,"h":0.25}] } }

- alt: krátký popis (česky), url nech prázdné "" – systém nahraje automaticky
- size: odhadni velikost (50–100)
- Pokud obrázek patří k bloku (ilustrace u otázky), přidej do bloku "_blockImage": { cropBox: {x,y,w,h}, alt: "popis", position: "beside-right"|"beside-left"|"before"|"after", widthPercent: 30–100 }
- POZORNĚ se podívej na screenshot a IDENTIFIKUJ VŠECHNY obrázky!

- DŮLEŽITÉ: Pokud je jedno zadání/cvičení s více pod-úkoly (např. "Zapiš číslo..." + 8 pod-otázek a-h), použij JEDEN free-answer blok s polem subQuestions místo 8 samostatných bloků!
  - subColumns: počet sloupců gridu (typicky 1 pro jeden sloupec, 2 pro dva sloupce)
  - subLabelType: "letters" (A, B, C...) nebo "numbers" (1, 2, 3...) nebo "none"
  - subQuestionColors: barvy pozadí karet (jen pokud subShowBackground je true). Příklad: ["#dbeafe","#dbeafe","#dbeafe","#dbeafe","#dbeafe","#dbeafe","#fef3c7","#fef3c7"]
  - subShowBackground: POZORNĚ SE PODÍVEJ NA OBRÁZEK! Pokud pod-otázky NEMAJÍ barevné pozadí (jsou na bílém pozadí), nastav FALSE. Default je true.
  - subShowLines: Pokud pod-otázkami NEJSOU čáry/linky na psaní, nastav FALSE. Default je true.
  - subLabelStyle: "circle" pro plný barevný kroužek, "circle-outline" pro obrysový kroužek, "text" pro prosté "A)" (default). POZORNĚ SE PODÍVEJ na styl označení v obrázku.
  - subLabelColors: barvy kroužků (pro styl "circle" a "circle-outline"), cyklicky opakované, např. ["#e11d48","#e11d48","#e11d48","#e11d48","#e11d48","#e11d48","#ea580c","#ea580c"]
  - Každá pod-otázka má: id (unikátní), text (BEZ písmena/čísla, to přidá renderer), lines (1-3), sampleAnswer (volitelně)
  - NEPIŠ do textu pod-otázky označení typu "A)" - to se přidá automaticky podle subLabelType

POKUD UŽIVATEL POSÍLÁ ZPRÁVU BEZ OBRÁZKU:
Upravuj předchozí výstup. Vrať upravený kompletní JSON.`;

// ============================================
// TYPES
// ============================================

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp: number;
}

interface ProImportPanelProps {
  onAddBlocks: (blocks: WorksheetBlock[]) => void;
  onReplaceBlocks?: (blocks: WorksheetBlock[]) => void;
  onClose?: () => void;
}

// ============================================
// HELPERS
// ============================================

function parseAgentResponse(response: string): { title: string; blocks: any[] } | null {
  try {
    let jsonStr = response.trim();
    if (jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
    }
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      const parsed = JSON.parse(objectMatch[0]);
      if (parsed.blocks && Array.isArray(parsed.blocks)) {
        return { title: parsed.title || 'Importovaný list', blocks: parsed.blocks };
      }
    }
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { title: 'Importovaný list', blocks: parsed };
      }
    }
    return null;
  } catch { return null; }
}

// Fields that belong inside `content` for each block type
const CONTENT_FIELDS: Record<string, string[]> = {
  'heading': ['text', 'level', 'align', 'textColor', 'highlightColor', 'isBold', 'headingStyle'],
  'infobox': ['html', 'variant', 'title', '_blockImage'],
  'paragraph': ['html', 'displayMode', 'columns', '_blockImage'],
  'free-answer': ['question', 'lines', 'hint', 'sampleAnswer', 'subQuestions', 'subColumns', 'subLabelType', 'subQuestionColors', 'subShowBackground', 'subShowLines', 'subLabelStyle', 'subLabelColors', 'subAnswerStyle', 'subIndent', '_blockImage'],
  'multiple-choice': ['question', 'options', 'correctAnswers', 'allowMultiple', '_blockImage'],
  'fill-blank': ['instruction', 'segments'],
  'image': ['url', 'alt', 'caption', 'size', 'alignment', 'gallery', 'galleryCaptions', 'gridColumns', '_cropBox', '_galleryCropBoxes'],
  'table': ['html', 'rows', 'columns', 'hasHeader', 'hasBorder', 'hasRoundedCorners', 'colorStyle'],
  'connect-pairs': ['instruction', 'pairs', 'shuffleSides'],
  'examples': ['sampleExample', 'examples', 'examplesCount', 'columns', 'labelType', 'answerBoxStyle'],
  'spacer': ['height', 'style'],
  'header-footer': ['variant', 'columns', 'showName', 'showSurname', 'showClass', 'showGrade'],
};

function normalizeCropBox(cropBox: any): { x: number; y: number; w: number; h: number } | undefined {
  if (!cropBox || typeof cropBox !== 'object') return undefined;
  let { x = 0, y = 0, w = 1, h = 1 } = cropBox;
  // Auto-detect 0-100 range and normalize to 0.0-1.0
  if (x > 1 || y > 1 || w > 1 || h > 1) {
    x /= 100; y /= 100; w /= 100; h /= 100;
  }
  // Clamp to valid range
  x = Math.max(0, Math.min(1, x));
  y = Math.max(0, Math.min(1, y));
  w = Math.max(0.01, Math.min(1 - x, w));
  h = Math.max(0.01, Math.min(1 - y, h));
  return { x, y, w, h };
}

function normalizeBlockImages(block: any): any {
  if (!block?.content) return block;
  const c = block.content;
  // Fix _blockImage.cropBox
  if (c._blockImage?.cropBox) {
    c._blockImage.cropBox = normalizeCropBox(c._blockImage.cropBox);
  }
  // Fix top-level _cropBox (image block)
  if (c._cropBox) {
    c._cropBox = normalizeCropBox(c._cropBox);
  }
  // Fix gallery cropBoxes
  if (Array.isArray(c._galleryCropBoxes)) {
    c._galleryCropBoxes = c._galleryCropBoxes.map(normalizeCropBox).filter(Boolean);
  }
  return block;
}

const COLOR_STYLE_MAP: Record<string, string> = {
  'orange': 'red',
  'gray': 'default',
  'grey': 'default',
  'white': 'default',
  'navy': 'blue',
  'teal': 'cyan',
  'violet': 'purple',
  'lime': 'green',
};
const VALID_COLOR_STYLES = new Set(['default','blue','green','purple','yellow','red','pink','cyan']);

function autoFixBlockContent(block: any): any {
  // If content already exists and is an object, return as-is
  if (block.content && typeof block.content === 'object') {
    // Fix invalid colorStyle in table blocks
    if (block.type === 'table' && block.content.colorStyle) {
      const cs = block.content.colorStyle?.toLowerCase();
      if (!VALID_COLOR_STYLES.has(cs)) {
        block.content.colorStyle = COLOR_STYLE_MAP[cs] || 'default';
      }
    }
    return block;
  }

  // Try to reconstruct content from top-level fields
  const fields = CONTENT_FIELDS[block.type] || [];
  const content: Record<string, any> = {};
  const topLevel: Record<string, any> = {};

  for (const [key, val] of Object.entries(block)) {
    if (key === 'type' || key === 'id' || key === 'order' || key === 'content') continue;
    if (fields.includes(key)) {
      content[key] = val;
    } else {
      topLevel[key] = val;
    }
  }

  // If we found any content fields, reconstruct
  if (Object.keys(content).length > 0) {
    // Fix invalid colorStyle
    if (content.colorStyle) {
      const cs = content.colorStyle.toLowerCase();
      if (!VALID_COLOR_STYLES.has(cs)) content.colorStyle = COLOR_STYLE_MAP[cs] || 'default';
    }
    console.log(`[processRawBlocks] Auto-fixed content for "${block.type}":`, content);
    return { ...topLevel, type: block.type, content };
  }

  return block;
}

function processRawBlocks(rawBlocks: any[]): WorksheetBlock[] {
  console.log('[processRawBlocks] Input:', rawBlocks.length, 'blocks');
  return rawBlocks
    .map(block => autoFixBlockContent(block))
    .filter(block => {
      if (!block || typeof block !== 'object') { console.warn('[processRawBlocks] Not object:', block); return false; }
      if (!block.type || typeof block.type !== 'string') { console.warn('[processRawBlocks] Missing type:', block); return false; }
      if (block.content === undefined || block.content === null) {
        console.warn('[processRawBlocks] Missing content after auto-fix:', JSON.stringify(block));
        return false;
      }
      if (typeof block.content !== 'object') {
        console.warn('[processRawBlocks] Non-object content:', block);
        return false;
      }
      return true;
    })
    .map((block, index) => {
      const base: any = {
    ...block,
    id: block.id || generateBlockId(),
    order: index,
    width: block.width || 'full',
        gridSpan: block.gridSpan || 12,
      };
      // Convert free-answer lines → marginBottom (no dotted lines in Pro editor)
      if (base.type === 'free-answer' && base.content?.lines) {
        const lines = Number(base.content.lines) || 0;
        if (lines > 0) {
          base.marginBottom = (base.marginBottom || 0) + lines * 28;
          base.content = { ...base.content, lines: 0 };
        }
      }
      return base;
    }) as WorksheetBlock[];
}

/**
 * Merge consecutive image blocks that AI incorrectly split into a single gallery block.
 * Runs AFTER image extraction (URLs are already uploaded).
 * Groups of 2+ consecutive image blocks with a URL become one gallery block.
 */
function mergeConsecutiveImageBlocks(blocks: WorksheetBlock[]): WorksheetBlock[] {
  const result: WorksheetBlock[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    // Look for a run of consecutive image blocks
    if (block.type === 'image') {
      const run: WorksheetBlock[] = [block];
      let j = i + 1;
      while (j < blocks.length && blocks[j].type === 'image') {
        run.push(blocks[j]);
        j++;
      }

      if (run.length >= 2) {
        // Merge into one gallery block
        const urls = run.map(b => (b.content as any).url || '').filter(Boolean);
        const captions = run.map(b => (b.content as any).caption || (b.content as any).alt || '');
        const gridColumns = Math.min(run.length, 4) as 1 | 2 | 3 | 4;
        const merged: WorksheetBlock = {
          ...run[0],
          id: generateBlockId(),
          content: {
            ...(run[0].content as any),
            url: urls[0] || '',
            gallery: urls,
            galleryCaptions: captions,
            gridColumns,
            caption: '', // clear individual caption; per-image captions are in galleryCaptions
          },
        };
        result.push(merged);
        i = j;
        continue;
      }
    }

    result.push(block);
    i++;
  }

  // Re-assign order
  return result.map((b, idx) => ({ ...b, order: idx }));
}

/**
 * Extract a region from a screenshot using Canvas API
 * @param screenshotDataUrl - The full screenshot as data URL
 * @param cropBox - Relative coordinates {x, y, w, h} where values are 0-1
 * @returns base64 data URL of the cropped image
 */
function cropImageFromScreenshot(
  screenshotDataUrl: string,
  cropBox: { x: number; y: number; w: number; h: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject('Canvas not supported'); return; }

      const sx = Math.round(cropBox.x * img.width);
      const sy = Math.round(cropBox.y * img.height);
      const sw = Math.round(cropBox.w * img.width);
      const sh = Math.round(cropBox.h * img.height);

      canvas.width = sw;
      canvas.height = sh;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject('Failed to load image');
    img.src = screenshotDataUrl;
  });
}

/**
 * Compress and resize a data URL image for Gemini API.
 * - Always outputs JPEG regardless of input format (PNG, JPEG, WebP, etc.)
 *   This ensures mimeType is always 'image/jpeg' and avoids PNG-extension-but-JPEG-content mismatches.
 * - Resizes to max 1600px on the longest side.
 * - Gemini API inline image limit is 20MB; JPEG quality 0.88 keeps most screenshots well under.
 */
function compressImageForApi(dataUrl: string, maxDim = 1600, quality = 0.88): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      // White background for PNG transparency (JPEG doesn't support transparency)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      // Always output JPEG – fixes mismatch when file has .png extension but contains JPEG data
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Process blocks from AI response - extract images from screenshot and upload to storage
 */
async function extractAndUploadImages(
  blocks: WorksheetBlock[],
  screenshotDataUrl: string,
  onProgress?: (msg: string) => void,
): Promise<WorksheetBlock[]> {
  const result: WorksheetBlock[] = [];
  let imageCount = 0;

  for (const block of blocks) {
    const content = block.content as any;

    // Handle gallery image blocks with _galleryCropBoxes
    if (block.type === 'image' && Array.isArray(content?._galleryCropBoxes) && content._galleryCropBoxes.length > 0) {
      const cropBoxes: { x: number; y: number; w: number; h: number }[] = content._galleryCropBoxes;
      const uploadedUrls: string[] = [];
      for (let gi = 0; gi < cropBoxes.length; gi++) {
        imageCount++;
        onProgress?.(`Extrahování obrázku ${imageCount} (galerie ${gi + 1}/${cropBoxes.length})...`);
        try {
          const cropped = await cropImageFromScreenshot(screenshotDataUrl, cropBoxes[gi]);
          const url = await uploadBase64ToStorage(cropped, `imported-gallery-${imageCount}-${gi}`, 'imported-images');
          uploadedUrls.push(url || '');
        } catch (err) {
          console.error('[ImageExtract] Failed to crop/upload gallery image:', gi, err);
          uploadedUrls.push('');
        }
      }
      const { _galleryCropBoxes, _cropBox, ...cleanContent } = content;
      result.push({
        ...block,
        content: {
          ...cleanContent,
          url: uploadedUrls[0] || '',
          gallery: uploadedUrls,
        },
      });
      continue;
    }

    // Handle image blocks with _cropBox
    if (block.type === 'image' && content?._cropBox) {
      imageCount++;
      onProgress?.(`Extrahování obrázku ${imageCount}...`);
      try {
        const cropped = await cropImageFromScreenshot(screenshotDataUrl, content._cropBox);
        console.log(`[ImageExtract] Cropped img ${imageCount}, size=${cropped.length}, cropBox=`, content._cropBox);
        const url = await uploadBase64ToStorage(cropped, `imported-img-${imageCount}`, 'imported-images');
        console.log(`[ImageExtract] Upload result img ${imageCount}:`, url);
        if (url) {
          const gallery = [url];
          result.push({
            ...block,
            content: { ...content, url, gallery, gridColumns: content.gridColumns || 1, _cropBox: undefined },
          });
          continue;
        }
        onProgress?.(`⚠️ Obrázek ${imageCount}: upload selhal (zkontroluj konzoli)`);
      } catch (err) {
        console.error('[ImageExtract] Failed to crop/upload image block:', err);
        onProgress?.(`⚠️ Obrázek ${imageCount}: chyba – ${(err as Error).message || err}`);
      }
      // If failed, keep block but without URL
      result.push({ ...block, content: { ...content, _cropBox: undefined } });
      continue;
    }

    // Handle blocks with _blockImage (image attached to a non-image block)
    if (content?._blockImage?.cropBox) {
      imageCount++;
      onProgress?.(`Extrahování obrázku ${imageCount} (příloha bloku)...`);
      try {
        const cropped = await cropImageFromScreenshot(screenshotDataUrl, content._blockImage.cropBox);
        console.log(`[ImageExtract] Cropped blockImg ${imageCount}, size=${cropped.length}, cropBox=`, content._blockImage.cropBox);
        const url = await uploadBase64ToStorage(cropped, `imported-blockimg-${imageCount}`, 'imported-images');
        console.log(`[ImageExtract] Upload result blockImg ${imageCount}:`, url);
        if (url) {
          const { _blockImage, ...cleanContent } = content;
          // Map both old format (size) and new format (widthPercent)
          const widthPercent = _blockImage.widthPercent
            ?? (_blockImage.size === 'small' ? 25 : _blockImage.size === 'large' ? 45 : 35);
          result.push({
            ...block,
            content: cleanContent,
            image: {
              url,
              alt: _blockImage.alt || _blockImage.caption || 'Obrázek',
              position: _blockImage.position || 'beside-right',
              widthPercent,
              caption: _blockImage.caption || '',
              ...(_blockImage.maxHeightPx ? { maxHeightPx: _blockImage.maxHeightPx } : {}),
            },
          } as any);
          continue;
        }
        onProgress?.(`⚠️ Příloha bloku ${imageCount}: upload selhal`);
      } catch (err) {
        console.error('[ImageExtract] Failed to crop/upload block image:', err);
        onProgress?.(`⚠️ Příloha bloku ${imageCount}: chyba – ${(err as Error).message || err}`);
      }
    }

    // Remove _blockImage if present but failed
    if (content?._blockImage) {
      const { _blockImage, ...cleanContent } = content;
      result.push({ ...block, content: cleanContent });
      continue;
    }

    result.push(block);
  }

  if (imageCount > 0) {
    onProgress?.(`Hotovo: ${imageCount} obrázků extrahováno.`);
  }
  return result;
}

async function callImportAgent(
  systemPrompt: string,
  conversationHistory: { role: string; content: string; image?: string }[],
  options: { thinking_level?: 'minimal' | 'low' | 'medium' | 'high'; max_tokens?: number } = {},
): Promise<string> {
  let authToken = publicAnonKey;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) authToken = data.session.access_token;
  } catch {}

  const messages: any[] = [{ role: 'system', content: systemPrompt }];

  for (const msg of conversationHistory) {
    if (msg.image) {
      // Compress image before sending to avoid Gemini API 20MB inline limit
      // compressImageForApi always outputs JPEG (canvas.toDataURL('image/jpeg')),
      // so mimeType after compression is always image/jpeg regardless of original format.
      const compressedImage = await compressImageForApi(msg.image);
      const [, base64Data] = compressedImage.split(',');
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: [
          { type: 'image', data: base64Data, mimeType: 'image/jpeg' },
          { type: 'text', text: msg.content },
        ],
      });
    } else {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000);

  // Try Gemini 3 Pro first, fallback to Gemini 3 Flash
  const tryModel = async (model: string): Promise<string | null> => {
    const res = await fetch(`https://${projectId}.supabase.co/functions/v1/ai-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
    body: JSON.stringify({
      messages,
        model,
      temperature: 0.3,
        // 65536 = safe ceiling: Gemini 3 'high' thinking uses up to 32k tokens just for thinking,
        // so we need at least 32k+ headroom for the actual answer on complex worksheets
        max_tokens: options.max_tokens ?? 65536,
        thinking_level: options.thinking_level ?? 'low',
    }),
    signal: controller.signal,
  });
    const d = await res.json();
    if (!d.success) throw new Error(d.error || `Model ${model} error`);
    return d.content || null;
  };

  let content: string | null = null;
  // Primary: Gemini 3 Pro (best reasoning for layout analysis)
  // Fallback: Gemini 3 Flash (fast, still very capable)
  const modelsToTry = ['gemini-3-pro', 'gemini-3-flash'];
  let lastError: string | null = null;
  for (const model of modelsToTry) {
    try {
      content = await tryModel(model);
      if (content) break;
      lastError = `Model ${model} vrátil prázdnou odpověď`;
    } catch (e: any) {
      lastError = e.message;
      if (e.name === 'AbortError') throw e;
    }
  }

  clearTimeout(timeoutId);
  if (!content) throw new Error(`Prázdná odpověď od AI. (${lastError})`);
  return content;
}

// ============================================
// 3-AGENT PIPELINE PROMPTS + FEATURE CARDS
// ============================================

const VISUAL_ANALYST_PROMPT = `Jsi vizuální analytik pracovních listů. Tvůj úkol je POUZE POPSAT co vidíš na screenshotu – NEVYTVÁŘEJ JSON ani instrukce.

POPIŠ DETAILNĚ (pro každou sekci od shora dolů):

1. ROZLOŽENÍ STRÁNKY – NEJDŮLEŽITĚJŠÍ:
   Jako první popiš CELKOVÉ rozložení stránky. Hledej tyto vzory:
   a) BOČNÍ SLOUPEC: Vidím VELKÝ obrázek/galerii po straně (vlevo nebo vpravo) který výškou překrývá 2 nebo více textových bloků napravo/nalevo?
      → Popiš: "BOČNÍ SLOUPEC [vlevo/vpravo]: obrázek/galerie, odhadovaná šířka XX%, překrývá N bloků textu"
   b) DVA SLOUPCE VEDLE SEBE: Obrázek a text jsou na jednom řádku (přibližně stejná výška)?
      → Popiš: "DVA SLOUPCE: [levý popis] [šířka%] + [pravý popis] [šířka%]"
   c) TEXT VE VÍCE SLOUPCÍCH: Textový odstavec rozdělený do 2 nebo 3 sloupců?
      → Popiš: "TEXT VE 2 SLOUPCÍCH" nebo "TEXT VE 3 SLOUPCÍCH"
   d) PLNÁ ŠÍŘKA + BOX VEDLE: Odstavec zabírá 2/3 šířky a vedle něj infobox 1/3?
      → Popiš: "2/3 text + 1/3 box vedle sebe"
   e) CELÁ ŠÍŘKA: Blok přes celou šířku stránky.

2. TYP PRVKU (pro každý blok): Nadpis / text odstavce / zvýrazněný box (barva) / tabulka / číslovaná otázka / obrázek / prázdný prostor pro odpověď

3. TEXTY: Přepiš PŘESNĚ celý text každého prvku – žádné zkratky, žádné "...". Doslova, celé věty, celé odstavce.

4. OBRÁZKY: Popiš co je na obrázku. Je obrázek VEDLE textu (sdílí řádek) nebo sám na řádku? 
   ⚠️ DŮLEŽITÉ: Jsou v jedné oblasti/sloupci 2 nebo více obrázků pod sebou? Pokud ANO, popiš je jako "2 obrázky pod sebou ve stejném sloupci" – to je galerie!
   Pokud je pod obrázkem text (popisek), popiš ho. Obrázek + popisek = jeden "image" prvek, NENÍ to odstavec.
   Odhadni kde každý obrázek na screenshotu leží (x, y, šířka, výška jako podíl 0.0–1.0).

5. PRÁZDNÉ PROSTORY: Pokud vidíš prázdné řádky nebo obdélníky pro odpověď, odhadni jejich výšku (malé ≈ 1 řádek, střední ≈ 3, velké ≈ 6+ řádků).
   ⚠️ Pokud vidíš podotázky (A), B), C) nebo 1., 2., 3.) – spočítej řádky ZA KAŽDOU podotázkou zvlášť (např. "A) má 2 řádky, B) má 3 řádky, C) má 0 řádků").
   ⚠️ ROZLIŠ: jsou to tečky (. . . . . .) nebo plné linky/čáry (_____)? Uveď přesně!
   ⚠️ Podotázky – jsou odsazeny od levého okraje (odsazení)? Nebo začínají přímo na levém okraji bez odsazení?

6. BARVY: Box – žlutý/modrý/zelený/fialový/oranžový rámeček? Tabulka – jaká barva záhlaví?

7. TUČNÉ/KURZÍVA: Popiš formátování textu.

FORMÁT: Začni sekcí "CELKOVÉ ROZLOŽENÍ:", pak popiš každý blok shora dolů. Žádné instrukce, žádné návrhy bloků.`;

// ============================================
// FEATURE CARDS – samostatné dokumentační kartičky
// Každá popisuje jeden typ prvku editoru do detailu.
// Dynamicky se vyberou jen ty relevantní pro daný list.
// ============================================

const FEATURE_CARDS: Record<string, string> = {

  grid: `### KARTA: MŘÍŽKA (grid)
Editor má 12-sloupcový grid. Každý blok má gridSpan (1–12):
- gridSpan 12 = celá šířka stránky
- gridSpan 6 = polovina (dva bloky vedle sebe)
- gridSpan 8 + 4 = 66 % + 33 %
- gridSpan 7 + 5 = 58 % + 42 %
- gridSpan 9 + 3 = 75 % + 25 %
- gridSpan 4 + 4 + 4 = tři stejné sloupce
Bloky se řadí zleva doprava v pořadí v poli. gridSpan je POVINNÝ u každého bloku.`,

  heading: `### KARTA: HEADING (nadpis)
Použij pro: názvy pracovního listu, nadpisy sekcí, tučné barevné titulky.
Parametry:
- text: prostý text nadpisu
- level: "h1" (velký, hlavní název) | "h2" (střední, sekce) | "h3" (malý, podnadpis)
- textColor: hex barva textu (např. "#D97706" pro oranžovou)
- align: "left" | "center" | "right" (výchozí left)
Příklad: "VYUŽITÍ BAKTERIÍ" → level: "h1", textColor: "#D97706"`,

  paragraph: `### KARTA: PARAGRAPH (odstavec)
Použij pro: výkladový text, delší odstavce, text s formátováním.
⚠️ POUŽIJ paragraph (NE infobox) pro: delší výkladové texty, příběhový text, kontinuální odstavce bez rámečku
⚠️ POUŽIJ paragraph (NE infobox) i když je text v rámečku se světlým pozadím – pokud je to jen ozdobný rámeček bez jasné barevné identifikace

Parametry:
- html: HTML obsah odstavce – používej <p>, <strong> (tučné), <em> (kurzíva), <a> pro odkaz
- columns: 1 (výchozí) | 2 | 3 – počet sloupců textu (použij 2 nebo 3 pokud je text fyzicky ve více sloupcích!)
- Může mít _blockImage (viz karta blockImage)
Příklad: "<p>Bakterie se <strong>množí dělením</strong> a jsou všudypřítomné.</p>"
POZOR: html pole = POUZE HTML tagy, žádný prostý text bez tagů.`,

  infobox: `### KARTA: INFOBOX (zvýrazněný box)
Použij VÝHRADNĚ pro: výrazně barevné orámované boxy s informačním obsahem – EXPERIMENT, TIP, POZOR, definice, pravidla, zvýrazněné poznámky.
⚠️ NEPOUŽÍVEJ infobox pro: delší výkladové texty, příběhy, kontinuální odstavce – ty patří do paragraph!

DETEKCE BARVY (variant) – POVINNÉ:
🟡 Žlutý/béžový/zlatý rámeček nebo pozadí → variant: "yellow"
🟠 Oranžový rámeček → variant: "orange"
🔵 Modrý rámeček → variant: "blue"
🟢 Zelený rámeček → variant: "green"
🟣 Fialový rámeček → variant: "purple"
🔴 Červený rámeček → variant: "red"
⬜ Šedý/neutrální rámeček → variant: "gray"
❓ Nejasná barva → "blue" jako výchozí

DETEKCE STYLU – fill vs outline:
⚠️ Výrazné barevné pozadí (plná výplň) → použij infobox s daným variant
⚠️ Světlý/průhledný box jen s OBRYSEM (outline) bez výrazné výplně → použij paragraph s visualStyles: { borderColor: "#hex", borderRadius: 12 }
⚠️ Světle zelený/modrý outline bez výrazného fill → NENÍ infobox! Je to paragraph s okrajem!

Parametry:
- variant: POVINNÉ – viz detekce barvy výše
- title: nadpis uvnitř boxu (prostý text, např. "EXPERIMENT" nebo "PROJEKT")
- html: obsah boxu jako HTML (<p>, <strong>, <em>)
- Může mít _blockImage (viz karta blockImage)

⚠️ DŮLEŽITÉ: Pokud je v rámečku otázka + obrázek pod ní → použij infobox s _blockImage position "after"!
Příklad: variant: "orange", title: "", html: "<p>Otázka 4: ...</p><p>Otázka 5: ...</p>", _blockImage: {position:"after", widthPercent:100, cropBox:{...}}`,

  'free-answer': `### KARTA: FREE-ANSWER (otázka s prostorem pro odpověď)
Použij pro: otevřené otázky kde žák píše odpověď do prázdného prostoru (tečkované nebo linky).

DETEKCE PROSTORU PRO ODPOVĚĎ (hlavní blok):
- Vidíš tečkované řádky nebo linky pod otázkou → "lines" = přesný počet řad teček
- Vidíš prázdné bílé místo bez teček/linek → marginBottom místo lines: 0
- ⚠️ lines: 0 = ŽÁDNÉ tečky! Použij 0 pouze pokud žák nikam nepíše

Základní parametry:
- question: text otázky (prostý text, bez HTML tagů)
- lines: počet řádků pro odpověď – PŘESNĚ odhadni z teček/linek na screenshotu (0 = žádné tečky)
- marginBottom: extra mezera pod blokem v px (když je velký bílý prostor bez teček)

DETEKCE ODSAZENÍ PODOTÁZEK:
- subIndent: true → podotázky jsou ODSAZENY doprava pod číslem aktivity (výchozí, nejčastější)
- subIndent: false → podotázky začínají od LEVÉHO okraje bloku, bez odsazení

DETEKCE ŘÁDKŮ NA ODPOVĚĎ (v subQuestions):
⚠️ Každá podotázka MÁ VLASTNÍ počet řádků (pole "lines" v subQuestion objektu)!
- Spočítej tečkované řádky BEZPROSTŘEDNĚ ZA každou podotázkou
- Nastav "lines" v každém subQuestion objektu individuálně
- Výchozí: lines: 2 pokud vidíš prostor pro odpověď
- lines: 0 POUZE pokud za danou podotázkou OPRAVDU nejsou žádné tečky/linky

VÍCE OTÁZEK POHROMADĚ → existují DVA VZORY:

📋 VZOR A – SKUPINA OTÁZEK:
Použij když vidíš: 2–5 číslovaných otázek pod sebou (1., 2., 3.) které jsou SAMOSTATNÉ a NESDÍLEJÍ společnou nadřazenou otázku.
→ question: "" (prázdné)
→ subQuestions: [{id: "sq-1", text: "text první otázky", lines: 2}, ...]
→ subLabelType: "numbers", subLabelStyle: "circle-outline", subLabelColors: ["#3b82f6"]
→ subShowBackground: false, subColumns: 1, subAnswerStyle: "dotted"

📦 VZOR B – PODOTÁZKY (pod hlavní otázkou):
Použij když vidíš: HLAVNÍ otázku nahoře a pod ní dílčí otázky A), B), C).
→ question: "text hlavní otázky" (nikdy jen "PROJEKT" nebo jiné nadpisové slovo – to dej do heading bloku)
→ subQuestions: [{id: "sq-1", text: "text bez označení", lines: 2}, ...]
→ subLabelType: "letters"
→ subAnswerStyle: "solid" pokud vidíš plné linky/čáry; "dotted" pokud vidíš tečky; "space" pokud jen bílý prostor
→ subColumns: 1 ← POVINNÉ! Vždy nastav explicitně!
→ subIndent: false pokud podotázky jdou od levého okraje; true pokud jsou odsazeny pod číslem

⚠️ SEKCE "PROJEKT" / "CVIČENÍ" / "AKTIVITA":
Pokud vidíš barevný nadpis sekce (např. "PROJEKT" oranžově, "CVIČENÍ" modře) NAD nebo UVNITŘ rámečku:
→ Nadpis sekce patří do HEADING bloku (type:"heading", textColor:"#hex"), NIKDY ne do question pole free-answer!
→ question pole free-answer = OTÁZKA nebo instrukce (co má žák dělat), nikdy nadpis sekce

⚠️ Text subQuestion NESMÍ obsahovat označení ("1." ani "A)") – renderer ho přidá automaticky!
⚠️ Text subQuestion SMÍ obsahovat <strong>tučný text</strong> nebo <em>kurzívu</em> – renderer HTML tagy správně zobrazí!
⚠️ JEDNA OTÁZKA SAMA = prostý free-answer blok BEZ subQuestions! SubQuestions = pouze pokud jsou 2+ otázek v jedné skupině!`,

  'free-answer-style': `### KARTA: VIZUÁLNÍ STYL PODOTÁZEK (subQuestions styling)
Použij SPOLU s kartou free-answer. VŽDY specifikuj všechny parametry – nevynechávej!

⚠️ VÝCHOZÍ HODNOTY podle vzoru:

Pro SKUPINU OTÁZEK (vzor A – číslované bez nadřazené):
- subLabelType: "numbers", subLabelStyle: "circle-outline", subLabelColors: ["#3b82f6"]
- subShowBackground: false, subColumns: 1, subShowLines: true

Pro PODOTÁZKY (vzor B – pod hlavní otázkou):
- subLabelType: "letters", subLabelStyle: "text"
- subColumns: 1 ← VŽDY nastav explicitně!
- subShowBackground: dle vizuálního stylu (true pokud vidíš barevné karty)

PRAVIDLO PRO question POLE:
- Pro SKUPINU OTÁZEK (vzor A): question: "" (prázdné – žádný nadpis)
- Pro PODOTÁZKY (vzor B): question = text hlavní otázky (nikdy prázdné!)
- Číslo cvičení/aktivity (např. "19", "20") NEPATŘÍ do question – editor ho generuje automaticky.

--- DETEKCE VIZUÁLNÍHO STYLU ---

subAnswerStyle – STYL PROSTORU PRO ODPOVĚĎ:
🔵 "dotted" → tečkované řádky (řada teček . . . . . . ) – POUZE pokud vidíš tečky!
➖ "solid" → plné čáry (podtržítka _____) – pokud vidíš plné linky/čáry
◻️ "space" → prázdný prostor bez čar ani teček – pokud je jen bílý prostor
⚠️ DETEKUJ PŘESNĚ – tečky ≠ linky! Plné linky v originále → "solid", tečky → "dotted"

subIndent – ODSAZENÍ PODOTÁZEK:
👉 true → podotázky jsou odsazeny doprava (výchozí pokud vidíš odsazení pod číslem aktivity)
⬅️ false → podotázky začínají od levého okraje, bez odsazení

subShowBackground – BAREVNÉ KARTY:
✅ true POUZE pokud jasně vidíš barevné obdélníkové KARTY za každou podotázkou
❌ false pokud otázky jsou na bílém/průhledném pozadí (prostý seznam) – TOTO JE NEJČASTĚJŠÍ PŘÍPAD!
Příklad: "1. Otázka..." na bílém papíře → subShowBackground: false

subColumns – POČET SLOUPCŮ:
⚠️ VŽDY EXPLICITNĚ NASTAV subColumns!
✅ subColumns: 1 → VÝCHOZÍ – použij vždy pokud otázky jsou pod sebou (i když je jich hodně)
✅ subColumns: 2 POUZE pokud otázky jsou FYZICKY VE DVOU SLOUPCÍCH vedle sebe na screenshotu
Příklad: a), b), c) pod sebou → subColumns: 1 (VŽDY nastav, i když to vypadá jako samozřejmé!)
Příklad: 2 otázky vedle sebe (vlevo/vpravo) → subColumns: 2

subLabelType – TYP OZNAČENÍ:
- "numbers" → označení čísly: 1., 2., 3. nebo 1), 2), 3)
- "letters" → označení písmeny: A), B), C) nebo a), b), c)
- "none" → bez označení

subLabelStyle – STYL OZNAČENÍ:
- "text" → prosté číslo/písmeno jako text (VÝCHOZÍ, nejčastější)
- "circle" → plný BAREVNÝ kruh – POUZE pokud vidíš vyplněná barevná kolečka s čísly
- "circle-outline" → OBRYSOVÝ kroužek – POUZE pokud vidíš kroužky s průhledným středem

subQuestionColors – jen pokud subShowBackground: true:
- Modrá: ["#dbeafe"] | Žlutá: ["#fef3c7"] | Fialová: ["#f3e8ff"] | Zelená: ["#dcfce7"]

subLabelColors – jen pro circle/circle-outline:
- Příklad: ["#2563eb"] pro modré kruhy

--- PŘÍKLADY ---

VZOR 1 – Prostý číslovaný seznam (nejčastější v učebnicích):
Vidíš: "1. Otázka text... [linky]  2. Otázka text... [linky]  3. Otázka text... [linky]"
→ subLabelType:"numbers", subLabelStyle:"text", subShowBackground:false, subShowLines:true, subColumns:1

VZOR 2 – Modré karty s písmeny (stylizované otázky):
Vidíš: modrý obdélník "A) text...", modrý obdélník "B) text..."
→ subLabelType:"letters", subLabelStyle:"text", subShowBackground:true, subQuestionColors:["#dbeafe"], subShowLines:true, subColumns:1

VZOR 3 – Dvě skupiny otázek vedle sebe:
Vidíš: levý sloupec "1., 2." a pravý sloupec "3., 4."
→ subColumns:2, subLabelType:"numbers", subLabelStyle:"text", subShowBackground:false

VZOR 4 – Barevné kruhy s čísly:
Vidíš: plná červená/modrá kolečka s čísly 1, 2, 3
→ subLabelType:"numbers", subLabelStyle:"circle", subLabelColors:["#e11d48"], subShowBackground:false`,

  'image-single': `### KARTA: IMAGE – JEDEN OBRÁZEK
Použij pro: fotografie, diagramy, mapy, grafy – samostatný blok na celém nebo části řádku.
⚠️ OBRÁZEK + text pod ním = image blok s caption! NIKDY ne paragraph blok!
⚠️ Pokud jsou ve stejné oblasti 2+ obrázků → použij místo toho GALERII (karta image-gallery)!
Parametry:
- alt: stručný popis obrázku (prostý text)
- caption: popisek pod obrázkem – VŽDY PROSTÝ TEXT, BEZ HTML tagů!
- size: 100 (šířka v % uvnitř bloku, většinou 100)
- alignment: "center" | "left" | "right"
- _cropBox: {x, y, w, h} – souřadnice v screenshotu jako podíl 0.0–1.0
  x,y = levý horní roh, w = šířka, h = výška
POVINNÉ: _cropBox musí být vždy přítomen!`,

  'image-gallery': `### KARTA: IMAGE GALERIE – VÍCE OBRÁZKŮ DOHROMADY
Použij pro: 2+ obrázků které patří do stejného sloupce/oblasti – ať jsou vedle sebe NEBO pod sebou.
⚠️ VŽDY použij JEDEN image blok s galerií, NIKDY ne samostatné image bloky!

DETEKCE LAYOUTU:
🔲 Obrázky vedle sebe (v řadě) → gridColumns: 2, 3 nebo 4
📋 Obrázky pod sebou (ve sloupci) → gridColumns: 1
Smíšené → gridColumns: počet sloupců mřížky

Parametry:
- gallery: ["", ""] – prázdná URL pro každý obrázek (systém doplní)
- galleryCaptions: ["popisek 1", "popisek 2"] – PROSTÝ TEXT pod každým obrázkem, bez HTML!
- gridColumns: 1 (pod sebou) | 2 | 3 | 4 (vedle sebe)
- containerHeight: POVINNÉ! Výška každého obrázku v px – odhadni z vizuální výšky na screenshotu.
  Typické hodnoty: 150 (malé), 220 (střední), 300 (velké)
- _galleryCropBoxes: [{x,y,w,h}, {x,y,w,h}] – souřadnice každého obrázku
POVINNÉ: _galleryCropBoxes musí mít PŘESNĚ stejný počet položek jako gallery!

PŘÍKLAD – 2 obrázky pod sebou v pravém sloupci:
{ "type": "image", "gridSpan": 4, "content": { "gallery": ["",""], "galleryCaptions": ["Ruduchy, červené řasy...", "korálový útes"], "gridColumns": 1, "containerHeight": 220, "_galleryCropBoxes": [{"x":0.55,"y":0.05,"w":0.42,"h":0.28}, {"x":0.05,"y":0.72,"w":0.3,"h":0.22}] } }`,

  blockImage: `### KARTA: _blockImage – OBRÁZEK UVNITŘ BLOKU
Použij pro: obrázek VEDLE/NAD/POD textem – sdílí blok s paragraph, infobox nebo free-answer.
(Nezakládej samostatný image blok, přidej _blockImage DO content existujícího bloku.)
Parametry (uvnitř content bloku):
- _blockImage.cropBox: {x, y, w, h} – souřadnice v screenshotu (0.0–1.0), POVINNÉ
- _blockImage.position: "beside-right" | "beside-left" | "before" (nad textem) | "after" (pod textem)
- _blockImage.widthPercent: pro beside: 20–70 (% šířky vedle textu), pro before/after: 20–100 (max-šířka obrázku)
- _blockImage.maxHeightPx: MAX. VÝŠKA v px – POVINNÉ! Odhadni z vizuální výšky obrázku na screenshotu.
  Pokud screenshot je cca 1000px vysoký a obrázek zabírá 25% výšky → maxHeightPx ≈ 250
  Typické hodnoty: 150 (malý), 200 (střední), 300 (velký), 400 (velmi velký)
- _blockImage.caption: popisek pod obrázkem – PROSTÝ TEXT, bez HTML!
📐 DETEKCE POZICE:
  - Obrázek VLEVO od textu → "beside-left"
  - Obrázek VPRAVO od textu → "beside-right"
  - Obrázek NAD textem (text patří ke stejné otázce/bloku) → "before"
  - Obrázek POD textem (text patří ke stejné otázce/bloku) → "after"
⚠️ Pokud je obrázek ZCELA samostatný bez přilehlého textu → samostatný image blok!`,

  table: `### KARTA: TABLE (tabulka)
Použij pro: srovnávací tabulky, tabulky s daty, vyplňovací tabulky se záhlavím.
Parametry:
- html: kompletní HTML tabulky – <table><thead><tr><th>...</th></tr></thead><tbody>...</tbody></table>
  POZOR: html nesmí obsahovat style atributy – barvy řeš přes colorStyle!
- rows: počet řádků (číslo)
- columns: počet sloupců (číslo)
- hasHeader: true pokud má tabulka záhlaví (první řádek tučně)
- hasBorder: true (téměř vždy)
- hasRoundedCorners: true (téměř vždy)
- colorStyle: barva záhlaví tabulky:
  "orange" | "blue" | "green" | "purple" | "gray" | "red" | "yellow"
  → Vyber barvu podle barvy záhlaví na screenshotu`,

  'connect-pairs': `### KARTA: CONNECT-PAIRS (spojování dvojic)
Použij pro: přiřazování pojmů k definicím, obrázků k názvům, pravý a levý sloupec.
Parametry:
- instruction: zadání cvičení (prostý text)
- pairs: [{left: "pojem", right: "definice"}, ...] – dvojice k přiřazení
- shuffleSides: false (pro zobrazení v původním pořadí)`,

  'fill-blank': `### KARTA: FILL-BLANK (doplňování do mezer)
Použij pro: věty s mezerami kde žák doplňuje slovo nebo výraz.
Parametry:
- instruction: zadání (prostý text, volitelné)
- segments: střídavě text a mezery:
  [{type:"text", content:"Bakterie se množí "}, {type:"blank", id:"b1", correctAnswer:"dělením"}, {type:"text", content:" a jsou..."}]
Poznámka: id mezer musí být unikátní (b1, b2, b3...)`,

  visualStyles: `### KARTA: VIZUÁLNÍ STYLY BLOKŮ
Každý blok může mít visualStyles (na úrovni bloku, ne uvnitř content):
- backgroundColor: hex barva pozadí bloku (např. "#FFF9E6" pro světle žlutou)
- borderColor: hex barva rámečku (např. "#D97706" pro oranžovou)
- borderRadius: zaoblení rohů v px (8 = mírné, 16 = výrazné)
- color: barva textu v bloku
Příklad: { backgroundColor: "#EFF6FF", borderColor: "#3B82F6", borderRadius: 8 }`,

  'float-layout': `### KARTA: LAYOUTY A PLOVOUCÍ SLOUPCE

Editor používá 12-sloupcový grid. Bloky s gridSpan < 12 se řadí vedle sebe (zleva doprava).

## POJMENOVANÉ LAYOUTY – kdy co použít

### LAYOUT A – Text vlevo + Obrázek vpravo (50/50)
Vizuální vzor: nadpis přes celou šířku, pod ním odstavec vlevo a obrázek vpravo vedle sebe.
JSON: heading (gridSpan:12) → paragraph (gridSpan:6) → image (gridSpan:6)

### LAYOUT A2 – Obrázek vlevo + Text vpravo (50/50)
JSON: heading (gridSpan:12) → image (gridSpan:6) → paragraph (gridSpan:6)

### LAYOUT B – Boční obrázek vlevo, text vpravo (plovoucí panel)
Vizuální vzor: VELKÝ obrázek stojí vlevo a překrývá výšku DVOU nebo VÍCE bloků textu napravo.
Kotva (obrázek): { "gridSpan": 5, "floatSide": "left", "floatSpanBlocks": 2, "floatGridSpan": 5 }
Bloky vpravo (heading + paragraph): gridSpan: 7 každý, BEZ floatSide

### LAYOUT B2 – Boční obrázek vpravo, text vlevo (plovoucí panel)
Kotva (obrázek): { "gridSpan": 5, "floatSide": "right", "floatSpanBlocks": 2, "floatGridSpan": 5 }
Bloky vlevo: gridSpan: 7 každý, BEZ floatSide

### LAYOUT C – 2 sloupce textu přes celou šířku
heading (gridSpan:12) → paragraph (gridSpan:12, columns:2)

### LAYOUT C+I – 2/3 text + 1/3 infobox vedle sebe
heading (gridSpan:12) → paragraph (gridSpan:8) → infobox (gridSpan:4)

### LAYOUT D+I – Galerie 2/3 + infobox 1/3
heading (gridSpan:12) → image galerie (gridSpan:8, gridColumns:2) → infobox (gridSpan:4)

### LAYOUT B+G+I – Galerie vlevo + text + box vpravo (plovoucí galerie)
Vizuální vzor: 2 obrázky pod sebou vlevo, vedle nich nadpis + odstavec + infobox.
Kotva (galerie): { "gridSpan": 5, "floatSide": "left", "floatSpanBlocks": 3, "floatGridSpan": 5 }
Bloky vpravo: heading (gridSpan:7) + paragraph (gridSpan:7) + infobox (gridSpan:7)

### LAYOUT B2+G+I – Text + box vlevo, galerie vpravo (plovoucí galerie)
Kotva (galerie): { "gridSpan": 5, "floatSide": "right", "floatSpanBlocks": 3, "floatGridSpan": 5 }

## PLOVOUCÍ SLOUPCE (floatSide) – vlastní layout

Použij když vidíš: sloupec s obrázkem/galerií po straně, který výškou překrývá 2+ textových bloků napravo/nalevo.

Kotva (obrázek nebo galerie) – PRVNÍ blok skupiny:
- "floatSide": "left" nebo "right" (na které straně stojí)
- "floatSpanBlocks": počet bloků textu vedle kterých kotva stojí (typicky 2–4)
- "floatGridSpan": šířka kotvy ve sloupcích (typicky 4–6)
- "gridSpan": stejná hodnota jako floatGridSpan

Hlavní bloky (text vedle kotvy) – BEZPROSTŘEDNĚ NÁSLEDUJÍ po kotvě:
- gridSpan = 12 minus floatGridSpan (např. 12 - 5 = 7)
- Normální bloky heading/paragraph/infobox BEZ floatSide

⚠️ Pokud je obrázek jen vedle JEDNOHO textového bloku → použij gridSpan 6+6, NEpoužívej floatSide!
⚠️ floatSide použij jen tehdy, pokud obrázek opravdu překrývá výšku 2+ bloků vedle sebe!

## DETEKCE – jak poznat layout ze screenshotu
- Vidím BOČNÍ SLOUPEC s obrázkem co sahá přes 2+ řádků textu → LAYOUT B nebo B2 (floatSide)
- Vidím obrázek a text vedle sebe na jednom řádku → LAYOUT A nebo A2 (gridSpan 6+6)
- Vidím text ve 2 sloupcích → LAYOUT C (columns:2 uvnitř paragraph)
- Vidím text vlevo + rámečkový box vpravo → LAYOUT C+I (gridSpan 8+4)
- Vidím galerie 4 obrázků v řadě → LAYOUT D (gridColumns:4)
- Vidím galerii vlevo + text + box vpravo → LAYOUT B+G+I (floatSide + galerie)`,

};

// ============================================
// Výběr feature karet na základě Agent 1 výstupu
// ============================================

function selectFeatureCards(agent1Output: string): string {
  const text = agent1Output.toLowerCase();
  const selected: string[] = ['grid']; // grid je vždy potřeba

  // Heading
  if (/nadpis|titulek|název|heading|velké písmeno|h1|h2/.test(text)) {
    selected.push('heading');
  }

  // Paragraph
  if (/odstavec|text|výklad|věta|html|tučn|kurzív|formátování/.test(text)) {
    selected.push('paragraph');
  }

  // Infobox
  if (/box|rámeček|zvýrazněn|infobox|experiment|tip|pozor|projekt|barevný ohraničen/.test(text)) {
    selected.push('infobox');
  }

  // Free-answer + styling
  const hasFreeAnswer = /otázk|cvičení|úkol|diskut|odpověď|řádky|prázdný prostor|zapiš|popiš|vysvětli/.test(text);
  if (hasFreeAnswer) {
    selected.push('free-answer');
    // Přidej kartu stylu pokud vidíme víc otázek nebo vizuální indikátory
    // Skupina otázek = číslované otázky bez nadřazené → vždy přidej styl kartu
    if (/\d\.|1\)|2\)|3\)|a\)|b\)|c\)|A\)|B\)|C\)|více otázek|skupina|podotázk|kroužek|barevn|karta|seznam otázek|numbered/.test(text)) {
      selected.push('free-answer-style');
    }
  }

  // Image – single vs gallery
  const hasImages = /obrázek|fotografi|diagram|schéma|mapa|ilustrace|foto/.test(text);
  if (hasImages) {
    selected.push('image-single');
    // Galerie – více obrázků vedle sebe NEBO pod sebou
    if (/vedle sebe|galerie|více obrázků|2 obrázky|3 obrázky|4 obrázky|řada|sloupec obrázků|pod sebou|stacked|dva obrázky|dvě fotografi|pravém sloupci.*obrázk|obrázk.*pravém sloupci/.test(text)) {
      selected.push('image-gallery');
    }
    // Block image – obrázek vedle textu
    if (/vedle textu|sdílí řádek|vpravo od|vlevo od|obrázek.*text|text.*obrázek/.test(text)) {
      selected.push('blockImage');
    }
  }

  // Table
  if (/tabulk|záhlaví|řádek|sloupec|buňka|thead|tbody/.test(text)) {
    selected.push('table');
  }

  // Connect pairs
  if (/spoj|přiřaď|dvojic|levý.*pravý|matching/.test(text)) {
    selected.push('connect-pairs');
  }

  // Fill blank
  if (/doplň|mezera|\_+|chybějíc|blank/.test(text)) {
    selected.push('fill-blank');
  }

  // Visual styles
  if (/barva pozadí|rámeček|ohraničen|visualstyle|zaoblení/.test(text)) {
    selected.push('visualStyles');
  }

  // Float layouts / side columns
  if (/boční sloupec|plovoucí|float|dva sloupce|vedle sebe|text ve 2|text ve 3|2\/3|1\/3|překrývá.*blok|sloupec.*obrázek|obrázek.*sloupec|galerie.*vlevo|galerie.*vpravo|obrázek.*vlevo|obrázek.*vpravo|boční panel|postranní/.test(text)) {
    selected.push('float-layout');
  }

  // Deduplicate and build the documentation block
  const uniqueCards = [...new Set(selected)];
  const cardDocs = uniqueCards
    .filter(key => FEATURE_CARDS[key])
    .map(key => FEATURE_CARDS[key])
    .join('\n\n');

  return cardDocs;
}

// Base prompt pro Agent 2 – feature karty se přidají dynamicky
const LAYOUT_STRATEGIST_BASE = `Jsi expert na editor vzdělávacích pracovních listů VividBooks. Dostaneš vizuální popis pracovního listu a rozhodneš, které editorské nástroje použít pro jeho věrnou rekonstrukci.

Na základě popisu jsem pro tebe vybral DOKUMENTACI relevantních nástrojů (níže). Ostatní nástroje editoru ignoruj – na tomto listu nejsou potřeba.

## GLOBÁLNÍ PRAVIDLA (platí vždy)
- caption, galleryCaptions, alt, question, title u infoboxu = VŽDY PROSTÝ TEXT, BEZ HTML tagů!
- HTML tagy (<strong>, <em>, <p>) patří VÝHRADNĚ do pole "html" u paragraph a infobox bloků
- Obrázky VEDLE textu → _blockImage uvnitř existujícího bloku (ne samostatný blok)
- Obrázky POD textem → samostatný image blok na dalším řádku
- 2+ otázky pod sebou → VŽDY jeden free-answer blok se subQuestions, nikdy separátní bloky!
- Pro podotázky: spočítej řádky teček ZA KAŽDOU podotázkou individuálně (každá má vlastní "lines")
- Pro podotázky: detekuj odsazení – subIndent: true pokud jsou odsazeny, false pokud od levého okraje

## PRAVIDLA PRO LAYOUTY – KRITICKÉ!

JAKO PRVNÍ KROK: Identifikuj layout každé sekce podle popisu od Agent 1 (sekce "CELKOVÉ ROZLOŽENÍ:").

Pro každou sekci zvol SPRÁVNÝ typ layoutu:
1. Boční sloupec (obrázek překrývá výšku 2+ bloků textu) → POUŽIJ floatSide na kotvu
2. Dva sloupce vedle sebe (jedna výška) → gridSpan 6+6 nebo jiný poměr
3. Text ve 2 sloupcích → paragraph s columns:2
4. 2/3 text + 1/3 box → gridSpan 8 + gridSpan 4
5. Plovoucí galerie vedle textu → floatSide na image blok

V plánu EXPLICITNĚ uveď pro každý blok:
- gridSpan hodnotu
- pokud je kotva plovoucího sloupce: floatSide, floatSpanBlocks, floatGridSpan

## DOKUMENTACE NÁSTROJŮ PRO TENTO LIST

{{FEATURE_CARDS}}

## TVŮJ VÝSTUP

Napiš přesný plán rekonstrukce. Začni sekcí "## LAYOUTOVÁ ANALÝZA" kde shrň jaké layouty jsi detekoval.
Pak pro každou sekci/blok napiš:
BLOK [číslo]: [TYP] | gridSpan: [číslo] [případně floatSide:"left/right" floatSpanBlocks:N floatGridSpan:N]
  → parametry: [přesné hodnoty všech relevantních parametrů]
  → text/html: "[přesný obsah doslova]"
  → obrázek: [pokud _blockImage nebo _cropBox: souřadnice {x,y,w,h}]
  → styl: [pokud vizuální styly nebo subQuestion styl: přesné hodnoty]

Piš v češtině. Buď konkrétní – uvádej skutečné hodnoty, ne "střední velikost" nebo "přibližně".
Nepřeskakuj žádnou sekci viditelnou na screenshotu.
Nepřidávej bloky, které na screenshotu nejsou.`;

const JSON_BUILDER_PROMPT = `Jsi JSON builder. Dostaneš plán rekonstrukce pracovního listu (od editorského stratéga) a přeložíš ho PŘESNĚ do JSON.

VÝSTUPNÍ FORMÁT (vrať POUZE JSON, žádný markdown, žádné komentáře):
{ "title": "název listu", "blocks": [...] }

STRUKTURA KAŽDÉHO BLOKU:
{ "type": "TYP", "gridSpan": ČÍSLO, "content": { ...pole bloku... } }

PLOVOUCÍ SLOUPCE – pokud blok je kotva bočního sloupce, přidej na úrovni bloku (vedle "content"):
{ "type": "image", "gridSpan": 5, "floatSide": "left"|"right", "floatSpanBlocks": 2, "floatGridSpan": 5, "content": {...} }
- floatSide: "left" = kotva vlevo, "right" = kotva vpravo
- floatSpanBlocks: počet bloků textu vedle kterých kotva stojí (obvykle 2–3)
- floatGridSpan: šířka kotvy ve sloupcích (stejné jako gridSpan)
Bloky textu vedle kotvy mají gridSpan = 12 - floatGridSpan (BEZ floatSide!).

POVINNÉ PRAVIDLO: Data VŽDY uvnitř "content". Nikdy ne přímo na úrovni bloku! (výjimka: floatSide, floatSpanBlocks, floatGridSpan, visualStyles, marginBottom)

TYPY A content POLE:
1. heading → content: { text, level: "h1"|"h2"|"h3", align?: "left"|"center"|"right", textColor?: "#hex" }
2. paragraph → content: { html: "<p>...</p>", columns?: 1|2|3 }
   ⚠️ Dlouhý výkladový text, příběh, odstavce BEZ výrazného barevného rámečku → VŽDY paragraph, nikdy infobox!
   ⚠️ Text fyzicky ve 2 sloupcích → columns: 2; ve 3 sloupcích → columns: 3
   ⚠️ Box jen s outline/obrysem (světlý, průhledný) → paragraph s visualStyles: { borderColor: "#hex", borderRadius: 12 }
3. infobox → content: { title?: "nadpis", html: "<p>...</p>", variant: "blue"|"green"|"yellow"|"purple"|"orange"|"red"|"gray" }
   ⚠️ variant POVINNÉ – nastav podle barvy rámečku: žlutý/béžový→"yellow", oranžový→"orange", modrý→"blue", šedý→"gray"
   ⚠️ POUZE pro výrazně barevné info boxy (TIP, POZOR, EXPERIMENT, definice) – NE pro výkladový text!
4. free-answer → content: { question: "text", lines: N, hint?: "nápověda", subQuestions?: [{id:"sq-1",text:"text bez označení",lines:2},...], subColumns?: 1|2|3, subLabelType?: "numbers"|"letters"|"none", subLabelStyle?: "text"|"circle"|"circle-outline", subShowBackground?: true|false, subShowLines?: true|false, subQuestionColors?: ["#hex",...], subLabelColors?: ["#hex",...], subAnswerStyle?: "dotted"|"solid"|"space"|"none", subIndent?: boolean }, marginBottom?: N
   ⚠️ Více otázek pod sebou = VŽDY jeden free-answer blok s subQuestions! Nikdy ne více samostatných free-answer bloků!
   ⚠️ JEDNA SAMOSTATNÁ otázka = prostý free-answer blok BEZ subQuestions! Nepoužívej subQuestions pro jednotlivé otázky!
   ⚠️ Text subQuestion NESMÍ obsahovat označení (ne "1. text" ani "A) text") – renderer ho přidá automaticky!
   ⚠️ Text subQuestion SMÍ obsahovat HTML formátování (<strong>, <em>) pro tučný/kurzívní text – renderer to správně zobrazí!
   ⚠️ LINES V SUBQUESTIONS: každá podotázka má vlastní "lines" = počet teček BEZPROSTŘEDNĚ ZA danou podotázkou. Spočítej je individuálně! Výchozí = 2 pokud vidíš prostor pro odpověď.
   ⚠️ subIndent: false pokud podotázky začínají od levého okraje (bez odsazení); true (výchozí) pokud jsou odsazeny pod číslem aktivity
   ⚠️ subColumns: VŽDY EXPLICITNĚ NASTAV! Výchozí = 1 (pod sebou)!
   ⚠️ question pole = NIKDY nadpis sekce (PROJEKT, CVIČENÍ, atd.)! Nadpis sekce = heading blok před free-answer!
   📋 SKUPINA OTÁZEK (1., 2., 3. bez nadřazené otázky): question: "", subLabelType: "numbers", subLabelStyle: "circle-outline", subLabelColors: ["#3b82f6"], subShowBackground: false, subColumns: 1, subAnswerStyle: "dotted"
   📦 PODOTÁZKY (A), B), C) pod hlavní otázkou): question: "text hlavní otázky", subLabelType: "letters", subShowBackground: false, subColumns: 1, subAnswerStyle: [detekuj: "solid"=plné linky, "dotted"=tečky, "space"=prázdný prostor], subIndent: [detekuj: false=od levého okraje, true=odsazeno]
5. multiple-choice → content: { question: "text", options: [{id:"opt-1",text:"..."},...], correctAnswers: [], allowMultiple: false }
6. fill-blank → content: { instruction?: "text", segments: [{type:"text",content:"..."},{type:"blank",id:"b1",correctAnswer:"..."},...] }
7. image → content: { url: "", alt: "popis", caption?: "popisek", size: 100, alignment: "center", containerHeight: N, _cropBox: {x,y,w,h} }
   - containerHeight: výška obrázku/galerie v pixelech – POVINNÉ pro galerie! Odhadni z výšky obrázků na screenshotu (typicky 150–350px)
   - Pro galerii: containerHeight = odhadovaná výška každého políčka, gridColumns = počet sloupců
8. table → content: { html: "<table>...</table>", rows: N, columns: N, hasHeader: true, hasBorder: true, hasRoundedCorners: true, colorStyle?: "orange"|"blue"|"green"|"purple"|"gray" }
9. connect-pairs → content: { instruction?: "text", pairs: [{left:"...",right:"..."},...], shuffleSides: false }

_blockImage uvnitř content (když je obrázek součástí bloku – vedle, nad nebo pod textem):
"_blockImage": { "cropBox": {"x":0.35,"y":0.05,"w":0.25,"h":0.20}, "position": "beside-right"|"beside-left"|"before"|"after", "widthPercent": 30, "maxHeightPx": 220, "caption": "popisek" }
  - beside-right / beside-left: obrázek je vlevo/vpravo od textu, widthPercent = 20–70
  - before: obrázek je NAD textem, widthPercent = max-šířka obrázku (20–100)
  - after: obrázek je POD textem, widthPercent = max-šířka obrázku (20–100)
  - maxHeightPx: POVINNÉ! Odhadni výšku obrázku v px z jeho vizuální výšky na screenshotu (typicky 150–400px)

visualStyles (volitelné, na úrovni bloku vedle "content"):
"visualStyles": { "backgroundColor": "#hex", "borderColor": "#hex", "borderRadius": 8, "color": "#hex" }

KRITICKÁ PRAVIDLA PRO OBRÁZKY:
- Každý "image" blok MUSÍ mít _cropBox se souřadnicemi (x,y,w,h jako čísla 0.0–1.0)
- Pro galerii (více obrázků dohromady):
  → vedle sebe: gridColumns: 2/3/4
  → pod sebou (ve sloupci): gridColumns: 1
  → vždy: gallery: ["",""], galleryCaptions: ["text1","text2"], _galleryCropBoxes: [{x,y,w,h}, ...]
- Každý _blockImage MUSÍ mít cropBox se souřadnicemi
- Pokud stratég uvedl souřadnice slovně (např. "horní pravý roh"), převeď je na čísla podle screenshotu
- Pokud souřadnice chybí, odhadni je sám z přiloženého screenshotu
- NIKDY nevynechej _cropBox nebo cropBox u obrázků!
- ⚠️ OBRÁZEK S POPISKEM = "image" blok (caption pole), NIKDY ne "paragraph" blok!
  Pokud vidíš fotografii/obrázek s textem pod ním → vždy image blok, text dej do caption!
- ⚠️ 2+ obrázků ve stejném sloupci/oblasti = galerie s gridColumns:1, NIKDY ne separate bloky!

KRITICKÁ PRAVIDLA PRO TEXT:
- "caption" u image bloků = VŽDY prostý text bez HTML tagů! Např. "Trepka velká žije ve znečištěných vodách." (ne <strong>Trepka</strong>)
- "galleryCaptions" = pole prostých textů, žádné HTML
- "alt" = prostý text
- "question" u free-answer = prostý text (formátování dělej jen v html polích paragraph/infobox)
- HTML tagy (<strong>, <em>, <p>) patří VÝHRADNĚ do pole "html" u bloků paragraph a infobox
- "title" u infobox = prostý text

gridSpan je POVINNÝ v každém bloku.
Vrať POUZE JSON. Žádný text před ani za.`;

// ============================================
// SCAN OVERLAY ANIMATION
// ============================================

const SCAN_COLS = 14;
const SCAN_ROWS = 10;

function ScanOverlay({ agentStep }: { agentStep: string }) {
  const dots = Array.from({ length: SCAN_COLS * SCAN_ROWS }, (_, i) => i);
  const phaseColor =
    agentStep === 'analyzing' ? '#6366f1' :
    agentStep === 'strategizing' ? '#f59e0b' :
    agentStep === 'building' ? '#10b981' :
    '#a78bfa';

  return (
    <div style={{
      position: 'absolute', inset: 0, borderRadius: 6, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      {/* Dot grid */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'grid',
        gridTemplateColumns: `repeat(${SCAN_COLS}, 1fr)`,
        gridTemplateRows: `repeat(${SCAN_ROWS}, 1fr)`,
        padding: '6px',
        gap: 2,
      }}>
        {dots.map((i) => {
          const col = i % SCAN_COLS;
          const row = Math.floor(i / SCAN_COLS);
          const cx = SCAN_COLS / 2;
          const cy = SCAN_ROWS / 2;
          const dist = Math.sqrt((col - cx) ** 2 + (row - cy) ** 2);
          const delay = (dist * 0.12).toFixed(2);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                width: 3, height: 3,
                borderRadius: '50%',
                background: phaseColor,
                opacity: 0,
                flexShrink: 0,
                animation: `scanDotPulse 1.8s ease-in-out ${delay}s infinite`,
              }} />
            </div>
          );
        })}
      </div>

      {/* Center label */}
      <div style={{
        position: 'relative', zIndex: 2,
        background: 'rgba(2,6,23,0.82)',
        border: `1px solid ${phaseColor}66`,
        borderRadius: 20,
        padding: '6px 18px',
        fontSize: 15,
        fontWeight: 700,
        color: phaseColor,
        letterSpacing: '0.06em',
        backdropFilter: 'blur(4px)',
        animation: 'scanLabelPulse 1.4s ease-in-out infinite',
      }}>
        {agentStep === 'analyzing' && '● ANALYZUJI'}
        {agentStep === 'strategizing' && '● PLÁNUJI'}
        {agentStep === 'building' && '● GENERUJI'}
        {agentStep === 'images' && '● EXTRAHUJI'}
        {(agentStep === 'idle' || agentStep === 'done') && '● SPOUŠTÍM'}
      </div>

      <style>{`
        @keyframes scanDotPulse {
          0%, 100% { opacity: 0; transform: scale(0.4); }
          50% { opacity: 0.85; transform: scale(1); }
        }
        @keyframes scanLabelPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================

export function ProImportPanel({ onAddBlocks, onReplaceBlocks, onClose }: ProImportPanelProps) {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageName, setUploadedImageName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(() => {
    const savedVersion = localStorage.getItem('import-agent-prompt-version');
    if (!savedVersion || parseInt(savedVersion) < PROMPT_VERSION) {
      localStorage.setItem('import-agent-prompt-version', String(PROMPT_VERSION));
      localStorage.setItem('import-agent-system-prompt', DEFAULT_SYSTEM_PROMPT);
      return DEFAULT_SYSTEM_PROMPT;
    }
    return localStorage.getItem('import-agent-system-prompt') || DEFAULT_SYSTEM_PROMPT;
  });
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedBlocks, setGeneratedBlocks] = useState<WorksheetBlock[]>([]);
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showImage, setShowImage] = useState(true);
  const [showJson, setShowJson] = useState(false);
  const [rawResponse, setRawResponse] = useState('');
  const [agentStep, setAgentStep] = useState<'idle'|'analyzing'|'strategizing'|'building'|'images'|'done'>('idle');
  const [agent1Output, setAgent1Output] = useState<string | null>(null);
  const [showAgent1Output, setShowAgent1Output] = useState(false);
  const [agent2Output, setAgent2Output] = useState<string | null>(null);
  const [showAgent2Output, setShowAgent2Output] = useState(false);
  const [agent3Output, setAgent3Output] = useState<string | null>(null);
  const [showAgent3Output, setShowAgent3Output] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMessages, isLoading]);

  useEffect(() => {
    localStorage.setItem('import-agent-system-prompt', systemPrompt);
  }, [systemPrompt]);

  const handleFileUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) { setError('Pouze obrázky (PNG, JPG, WEBP).'); return; }
    if (file.size > 20 * 1024 * 1024) { setError('Max 20 MB.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
      setUploadedImageName(file.name);
      setError(null);
      setShowImage(true);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleAnalyze = async () => {
    if (!uploadedImage) return;
    setError(null); setIsLoading(true);

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`, role: 'user',
      content: 'Analyzuj tento pracovní list a převeď ho na bloky.',
      image: uploadedImage, timestamp: Date.now(),
    };
    setChatMessages([userMsg]);

    try {
      const response = await callImportAgent(systemPrompt, [
        { role: 'user', content: userMsg.content, image: uploadedImage },
      ]);
      setRawResponse(response);
      const parsed = parseAgentResponse(response);
      if (parsed) {
        let blocks = processRawBlocks(parsed.blocks);
        // Extract and upload images from screenshot
        const hasImages = blocks.some(b => 
          (b.content as any)?._cropBox || (b.content as any)?._blockImage?.cropBox || Array.isArray((b.content as any)?._galleryCropBoxes)
        );
        if (hasImages && uploadedImage) {
          setChatMessages(prev => [...prev, {
            id: `msg-${Date.now()}-img`, role: 'assistant',
            content: `🖼️ Extrahování obrázků ze screenshotu...`,
            timestamp: Date.now(),
          }]);
          blocks = await extractAndUploadImages(blocks, uploadedImage);
        }
        blocks = convertLegacyLayoutsToLayoutSections(mergeConsecutiveImageBlocks(blocks));
        setGeneratedBlocks(blocks);
        setGeneratedTitle(parsed.title);
        setChatMessages(prev => [...prev, {
          id: `msg-${Date.now()}-r`, role: 'assistant',
          content: `✓ ${blocks.length} bloků${hasImages ? ' (vč. obrázků)' : ''}. Klikni "Vložit" nebo dolaď chatem.`,
          timestamp: Date.now(),
        }]);
      } else {
        setError('Nepodařilo se rozparsovat odpověď.');
        setChatMessages(prev => [...prev, {
          id: `msg-${Date.now()}-r`, role: 'assistant',
          content: `Chyba parsování. Zkus to znovu nebo uprav system prompt.`,
          timestamp: Date.now(),
        }]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally { setIsLoading(false); }
  };

  const handleAnalyzePipeline = async () => {
    if (!uploadedImage) return;
    setError(null); setIsLoading(true); setAgentStep('analyzing');
    setChatMessages([]);
    setGeneratedBlocks([]);
    setAgent1Output(null); setAgent2Output(null); setAgent3Output(null);

    const addMsg = (content: string) => {
      setChatMessages(prev => [...prev, { id: `msg-${Date.now()}-${Math.random()}`, role: 'assistant', content, timestamp: Date.now() }]);
    };

    try {
      // ── AGENT 1: Visual Analyst ──────────────────────────────────────
      // Just describes what it sees – no editor knowledge needed, fast model
      addMsg('🔍 Agent 1: Popisuji co vidím na screenshotu...');
      const visualDescription = await callImportAgent(VISUAL_ANALYST_PROMPT, [
        { role: 'user', content: 'Popiš detailně vše co vidíš na tomto pracovním listu.', image: uploadedImage },
      ], { thinking_level: 'low', max_tokens: 8192 });
      setAgent1Output(visualDescription);
      addMsg(`📋 Agent 1 hotov.`);

      // ── AGENT 2: Layout Strategist ───────────────────────────────────
      // Expert on the editor – decides which blocks and settings to use
      // This is the "brain" – most training happens here
      // Dynamically select only relevant feature cards based on what Agent 1 detected
      setAgentStep('strategizing');
      const selectedCards = selectFeatureCards(visualDescription);
      const agent2Prompt = LAYOUT_STRATEGIST_BASE.replace('{{FEATURE_CARDS}}', selectedCards);
      addMsg('🧠 Agent 2: Rozhoduji jaké editorské nástroje použít...');
      const editorialStrategy = await callImportAgent(agent2Prompt, [
        {
          role: 'user',
          content: `Vizuální analytik (Agent 1) popsal tento pracovní list takto:\n\n${visualDescription}\n\nRozhodni, které editorské nástroje a bloky použít pro věrnou rekonstrukci. Podívej se také na přiložený screenshot pro ověření.`,
          image: uploadedImage,
        },
      ], { thinking_level: 'medium', max_tokens: 32768 });
      setAgent2Output(editorialStrategy);
      addMsg(`🧠 Agent 2 hotov.`);

      // ── AGENT 3: JSON Builder ────────────────────────────────────────
      // Translates the strategy to JSON. Also gets the image so it can verify/fill crop coordinates
      // if Agent 2 missed them or wrote them in a vague way.
      setAgentStep('building');
      addMsg('🏗️ Agent 3: Překládám strategii do JSON...');
      const jsonResponse = await callImportAgent(JSON_BUILDER_PROMPT, [
        {
          role: 'user',
          content: `Editorský stratég (Agent 2) připravil tento plán rekonstrukce:\n\n${editorialStrategy}\n\nNa přiloženém screenshotu vidíš originál. Přelož plán PŘESNĚ do JSON. KRITICKY DŮLEŽITÉ: pro každý obrázek (image blok nebo _blockImage) MUSÍŠ uvést _cropBox nebo cropBox se souřadnicemi. Pokud je stratég neuvádí přesně, odhadni je sám z přiloženého screenshotu.`,
          image: uploadedImage,
        },
      ], { thinking_level: 'low', max_tokens: 32768 });

      setRawResponse(jsonResponse);
      setAgent3Output(jsonResponse);
      console.log('[Agent3] Raw response:', jsonResponse);
      const parsed = parseAgentResponse(jsonResponse);
      if (!parsed) {
        setError('Agent 3 nevrátil validní JSON. Zkus znovu.');
        return;
      }
      console.log('[Agent3] Parsed blocks:', parsed.blocks.length, parsed.blocks);

      let blocks = processRawBlocks(parsed.blocks).map(normalizeBlockImages);
      const hasImages = blocks.some(b =>
        (b.content as any)?._cropBox || (b.content as any)?._blockImage?.cropBox || Array.isArray((b.content as any)?._galleryCropBoxes)
      );

      if (hasImages) {
        setAgentStep('images');
        addMsg('🖼️ Extrahuji obrázky ze screenshotu...');
        blocks = await extractAndUploadImages(blocks, uploadedImage, (msg) => addMsg(msg));
      }

      blocks = convertLegacyLayoutsToLayoutSections(mergeConsecutiveImageBlocks(blocks));

      // Debug: log image blocks to verify URLs
      const imgBlocks = blocks.filter(b => b.type === 'image');
      console.log('[ImportAgent] Final image blocks:', imgBlocks.map(b => ({
        id: b.id,
        gridSpan: b.gridSpan,
        url: (b.content as any).url,
        gallery: (b.content as any).gallery,
        floatSide: (b as any).floatSide,
      })));

      setGeneratedBlocks(blocks);
      setGeneratedTitle(parsed.title);
      setAgentStep('done');
      addMsg(`✅ Hotovo! ${blocks.length} bloků${hasImages ? ' (vč. obrázků)' : ''}. Klikni "Vložit" nebo dolaď chatem.`);
    } catch (err: any) {
      setError(err.message);
      setAgentStep('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isLoading) return;
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`, role: 'user',
      content: chatInput.trim(), timestamp: Date.now(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput(''); setIsLoading(true); setError(null);

    try {
      const history: { role: string; content: string; image?: string }[] = [];
      if (uploadedImage) {
        history.push({ role: 'user', content: 'Analyzuj tento pracovní list.', image: uploadedImage });
      }
      if (generatedBlocks.length > 0) {
        history.push({
          role: 'assistant',
          content: JSON.stringify({ title: generatedTitle, blocks: generatedBlocks.map(b => ({ type: b.type, content: b.content })) }, null, 2),
        });
      }
      history.push({ role: 'user', content: userMsg.content });

      const response = await callImportAgent(systemPrompt, history);
      setRawResponse(response);
      const parsed = parseAgentResponse(response);
      if (parsed) {
        let blocks = processRawBlocks(parsed.blocks);
        const hasImages = blocks.some(b => 
          (b.content as any)?._cropBox || (b.content as any)?._blockImage?.cropBox || Array.isArray((b.content as any)?._galleryCropBoxes)
        );
        if (hasImages && uploadedImage) {
          blocks = await extractAndUploadImages(blocks, uploadedImage);
        }
        blocks = convertLegacyLayoutsToLayoutSections(mergeConsecutiveImageBlocks(blocks));
        setGeneratedBlocks(blocks);
        setGeneratedTitle(parsed.title);
        setChatMessages(prev => [...prev, {
          id: `msg-${Date.now()}-r`, role: 'assistant',
          content: `✓ Aktualizováno – ${blocks.length} bloků${hasImages ? ' (vč. obrázků)' : ''}.`,
          timestamp: Date.now(),
        }]);
      } else {
        setChatMessages(prev => [...prev, {
          id: `msg-${Date.now()}-r`, role: 'assistant',
          content: response.substring(0, 500),
          timestamp: Date.now(),
        }]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally { setIsLoading(false); }
  };

  const handleInsertBlocks = () => {
    if (generatedBlocks.length === 0) return;
    console.log('[ImportAgent] Inserting blocks:', generatedBlocks.map(b => ({
      type: b.type,
      gridSpan: b.gridSpan,
      floatSide: (b as any).floatSide,
      url: (b.content as any)?.url,
      gallery: (b.content as any)?.gallery,
    })));
    onAddBlocks(generatedBlocks);
    setChatMessages(prev => [...prev, {
      id: `msg-${Date.now()}-ok`, role: 'assistant',
      content: `✓ ${generatedBlocks.length} bloků vloženo do listu!`,
      timestamp: Date.now(),
    }]);
    setGeneratedBlocks([]);
    setGeneratedTitle('');
  };

  const handleReplaceAll = () => {
    if (generatedBlocks.length === 0 || !onReplaceBlocks) return;
    onReplaceBlocks(generatedBlocks);
    setChatMessages(prev => [...prev, {
      id: `msg-${Date.now()}-ok`, role: 'assistant',
      content: `✓ List nahrazen – ${generatedBlocks.length} bloků.`,
      timestamp: Date.now(),
    }]);
    setGeneratedBlocks([]);
    setGeneratedTitle('');
  };

  const handleReset = () => {
    setUploadedImage(null); setUploadedImageName('');
    setChatMessages([]); setGeneratedBlocks([]);
    setGeneratedTitle(''); setError(null); setChatInput('');
    setRawResponse(''); setShowJson(false);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#1e293b' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid #334155',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ImageUp style={{ width: 16, height: 16, color: '#f59e0b' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>Import Agent</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setShowJson(!showJson)}
            style={{ background: 'none', border: 'none', color: showJson ? '#f59e0b' : '#64748b', cursor: 'pointer', padding: 4 }}
            title="Zobrazit JSON"
          >
            <Code style={{ width: 14, height: 14 }} />
          </button>
          <button
            onClick={() => setShowSystemPrompt(!showSystemPrompt)}
            style={{ background: 'none', border: 'none', color: showSystemPrompt ? '#f59e0b' : '#64748b', cursor: 'pointer', padding: 4 }}
            title="System Prompt"
          >
            <Settings style={{ width: 14, height: 14 }} />
          </button>
          <button
            onClick={handleReset}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
            title="Reset"
          >
            <RotateCcw style={{ width: 14, height: 14 }} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      </div>

      {/* System Prompt (collapsible) */}
      {showSystemPrompt && (
        <div style={{ padding: 12, borderBottom: '1px solid #334155', maxHeight: 200 }}>
          <textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            style={{
              width: '100%', height: 140,
              backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: 6,
              color: '#94a3b8', fontFamily: 'monospace', fontSize: 10, lineHeight: 1.4,
              padding: 8, resize: 'none', outline: 'none',
            }}
          />
          <button
            onClick={() => { setSystemPrompt(DEFAULT_SYSTEM_PROMPT); localStorage.setItem('import-agent-prompt-version', String(PROMPT_VERSION)); }}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 10, marginTop: 4 }}
          >
            Reset na výchozí
          </button>
        </div>
      )}

      {/* Upload Area */}
      <div style={{ padding: 12, borderBottom: '1px solid #334155', flexShrink: 0 }}>
        {!uploadedImage ? (
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #334155', borderRadius: 10, padding: 20,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              cursor: 'pointer', backgroundColor: '#020617',
            }}
          >
            <Upload style={{ width: 24, height: 24, color: '#475569', marginBottom: 8 }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>Přetáhni screenshot</span>
            <span style={{ fontSize: 11, color: '#475569' }}>nebo klikni (PNG, JPG)</span>
            <input ref={fileInputRef} type="file" accept="image/*"
              onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              style={{ display: 'none' }}
            />
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <ImageIcon style={{ width: 12, height: 12, color: '#4ade80' }} />
                <span style={{ fontSize: 11, color: '#94a3b8', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadedImageName}</span>
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                <button onClick={() => setShowImage(!showImage)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 2 }}>
                  {showImage ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />}
                </button>
                <button onClick={() => { setUploadedImage(null); setUploadedImageName(''); }}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 2 }}>
                  <X style={{ width: 12, height: 12 }} />
                </button>
              </div>
            </div>
            {showImage && (
              <div style={{ position: 'relative', width: '100%', marginBottom: 6 }}>
                <img src={uploadedImage} alt="Screenshot"
                  style={{
                    width: '100%', objectFit: 'contain', borderRadius: 6,
                    backgroundColor: '#020617',
                    filter: isLoading ? 'blur(5px)' : 'none',
                    transition: 'filter 0.4s ease',
                    display: 'block',
                  }}
                />
                {isLoading && <ScanOverlay agentStep={agentStep} />}
              </div>
            )}
            <button
              onClick={() => { setChatMessages([]); setGeneratedBlocks([]); setAgent1Output(null); setAgent2Output(null); setShowAgent1Output(false); setShowAgent2Output(false); setAgentStep('idle'); setTimeout(() => handleAnalyzePipeline(), 50); }}
              disabled={isLoading}
                style={{
                width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none',
                background: isLoading ? '#1e293b' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white', fontWeight: 700, fontSize: 13,
                  cursor: isLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 6, opacity: isLoading ? 0.6 : 1,
                boxShadow: isLoading ? 'none' : '0 2px 12px rgba(99,102,241,0.35)',
                marginBottom: 6,
                }}>
                {isLoading ? (
                <>
                  <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                  {agentStep === 'analyzing' && 'Agent 1: Popisuji screenshot...'}
                  {agentStep === 'strategizing' && 'Agent 2: Plánuji bloky...'}
                  {agentStep === 'building' && 'Agent 3: Generuji JSON...'}
                  {agentStep === 'images' && 'Extrahuji obrázky...'}
                  {(agentStep === 'idle' || agentStep === 'done') && 'Spouštím...'}
                </>
              ) : (
                <><Sparkles style={{ width: 14, height: 14 }} /> Analyzovat (3-agent)</>
                )}
              </button>
            {agent1Output && (
              <div style={{ marginTop: 4 }}>
                <button onClick={() => setShowAgent1Output(v => !v)} style={{
                  width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #334155',
                  background: 'none', color: '#94a3b8', fontSize: 11, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>🔍 Agent 1 – vizuální popis</span>
                  {showAgent1Output ? <ChevronUp style={{ width: 10, height: 10 }} /> : <ChevronDown style={{ width: 10, height: 10 }} />}
                </button>
                {showAgent1Output && (
                  <div style={{
                    marginTop: 4, padding: '8px 10px', borderRadius: 6, border: '1px solid #1e3a5f',
                    backgroundColor: '#0f172a', fontSize: 10, color: '#94a3b8',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflowY: 'auto', lineHeight: 1.5,
                  }}>{agent1Output}</div>
                )}
              </div>
            )}
            {agent2Output && (
              <div style={{ marginTop: 4 }}>
                <button onClick={() => setShowAgent2Output(v => !v)} style={{
                  width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #334155',
                  background: 'none', color: '#fbbf24', fontSize: 11, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>🧠 Agent 2 – editorská strategie</span>
                  {showAgent2Output ? <ChevronUp style={{ width: 10, height: 10 }} /> : <ChevronDown style={{ width: 10, height: 10 }} />}
                </button>
                {showAgent2Output && (
                  <div style={{
                    marginTop: 4, padding: '8px 10px', borderRadius: 6, border: '1px solid #3a2e00',
                    backgroundColor: '#0f172a', fontSize: 10, color: '#fbbf24',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 250, overflowY: 'auto', lineHeight: 1.5,
                  }}>{agent2Output}</div>
                )}
              </div>
            )}
            {agent3Output && (
              <div style={{ marginTop: 4 }}>
                <button onClick={() => setShowAgent3Output(v => !v)} style={{
                  width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #334155',
                  background: 'none', color: '#4ade80', fontSize: 11, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>🏗️ Agent 3 – JSON výstup</span>
                  {showAgent3Output ? <ChevronUp style={{ width: 10, height: 10 }} /> : <ChevronDown style={{ width: 10, height: 10 }} />}
                </button>
                {showAgent3Output && (
                  <div style={{
                    marginTop: 4, padding: '8px 10px', borderRadius: 6, border: '1px solid #1e3a1e',
                    backgroundColor: '#0f172a', fontSize: 10, color: '#4ade80',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 250, overflowY: 'auto',
                    lineHeight: 1.5, fontFamily: 'monospace',
                  }}>{agent3Output}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          margin: '0 12px', marginTop: 8, padding: '6px 10px',
          backgroundColor: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 6,
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#fca5a5', flexShrink: 0,
        }}>
          <AlertCircle style={{ width: 12, height: 12, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: 2 }}>
            <X style={{ width: 10, height: 10 }} />
          </button>
        </div>
      )}

      {/* Insert buttons */}
      {generatedBlocks.length > 0 && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #334155', display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={handleInsertBlocks}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 6, border: 'none',
              backgroundColor: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 12,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
            <Check style={{ width: 14, height: 14 }} />
            Vložit ({generatedBlocks.length})
          </button>
          {onReplaceBlocks && (
            <button onClick={handleReplaceAll}
              style={{
                padding: '8px 12px', borderRadius: 6, border: '1px solid #334155',
                backgroundColor: 'transparent', color: '#94a3b8', fontSize: 12,
                cursor: 'pointer',
              }}>
              Nahradit vše
            </button>
          )}
        </div>
      )}

      {/* JSON View */}
      {showJson && generatedBlocks.length > 0 && (
        <div style={{
          flex: 1, overflowY: 'auto', padding: 8, borderBottom: '1px solid #334155',
          backgroundColor: '#020617', position: 'relative',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>JSON výstup</span>
            <button
              onClick={() => {
                const json = JSON.stringify({ title: generatedTitle, blocks: generatedBlocks.map(b => ({ type: b.type, content: b.content })) }, null, 2);
                navigator.clipboard.writeText(json);
              }}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}
            >
              <Copy style={{ width: 10, height: 10 }} /> Kopírovat
            </button>
          </div>
          <pre style={{
            fontSize: 9, lineHeight: 1.3, color: '#94a3b8', fontFamily: 'monospace',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0,
          }}>
            {JSON.stringify({ title: generatedTitle, blocks: generatedBlocks.map(b => ({ type: b.type, content: b.content })) }, null, 2)}
          </pre>
        </div>
      )}

      {/* Raw AI Response (if JSON view is on and no blocks parsed) */}
      {showJson && generatedBlocks.length === 0 && rawResponse && (
        <div style={{
          flex: 1, overflowY: 'auto', padding: 8, borderBottom: '1px solid #334155',
          backgroundColor: '#020617',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Raw odpověď (nerozparsováno)</span>
            <button
              onClick={() => navigator.clipboard.writeText(rawResponse)}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}
            >
              <Copy style={{ width: 10, height: 10 }} /> Kopírovat
            </button>
          </div>
          <pre style={{
            fontSize: 9, lineHeight: 1.3, color: '#fca5a5', fontFamily: 'monospace',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0,
          }}>
            {rawResponse}
          </pre>
        </div>
      )}

      {/* Chat Messages */}
      <div ref={chatRef}
        style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {chatMessages.length === 0 && !uploadedImage && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', color: '#475569', textAlign: 'center', padding: 16,
          }}>
            <ImageUp style={{ width: 32, height: 32, marginBottom: 12, color: '#334155' }} />
            <div style={{ fontSize: 12, lineHeight: 1.5 }}>
              Nahraj screenshot pracovního listu.<br />Agent ho převede na bloky.
            </div>
          </div>
        )}

        {chatMessages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '90%', padding: '6px 10px', borderRadius: 10, fontSize: 12, lineHeight: 1.4,
              ...(msg.role === 'user'
                ? { backgroundColor: '#1d4ed8', color: '#dbeafe' }
                : { backgroundColor: '#0f172a', color: '#cbd5e1', border: '1px solid #334155' }),
            }}>
              {msg.image && (
                <div style={{ marginBottom: 4, fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <ImageIcon style={{ width: 10, height: 10 }} /> Screenshot
                </div>
              )}
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '6px 12px', borderRadius: 10, backgroundColor: '#0f172a',
              border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Loader2 style={{ width: 12, height: 12, color: '#f59e0b', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Agent pracuje...</span>
            </div>
          </div>
        )}
      </div>

      {/* Chat Input */}
      {chatMessages.length > 0 && (
        <div style={{ padding: 10, borderTop: '1px solid #334155', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
              placeholder="Uprav výstup..."
              disabled={isLoading}
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #334155',
                backgroundColor: '#020617', color: '#e2e8f0', fontSize: 12, outline: 'none',
              }}
            />
            <button onClick={handleSendMessage}
              disabled={!chatInput.trim() || isLoading}
              style={{
                width: 34, height: 34, borderRadius: 6, border: 'none',
                backgroundColor: chatInput.trim() && !isLoading ? '#2563eb' : '#1e293b',
                color: chatInput.trim() && !isLoading ? '#fff' : '#475569',
                cursor: chatInput.trim() && !isLoading ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <Send style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
