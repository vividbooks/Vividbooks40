/**
 * Syntetické pracovní listy pro náhledy design systému na canvasu (Design systém 2).
 * Reuse: WorkbookLivePagePreview → PrintGridCanvas (stejný renderer jako kniha / editor).
 */

import type { DesignSystem } from '../types/design-system';
import { collectGoogleFontsForPrint } from '../types/design-system';
import type { Worksheet, WorksheetBlock } from '../types/worksheet';
import { createEmptyBlock, DEFAULT_WORKSHEET_METADATA, mergeBlockWithDefaultVisualStyles } from '../types/worksheet';
import type { SeriesSlot } from './design-system-layout-from-slots';
import {
  worksheetBlocksFromLayoutSlots,
  worksheetBlocksFromPageLayoutPreviewKind,
} from './design-system-layout-from-slots';
import { buildStashedWorksheetEditorUrl } from './worksheet-editor-runtime';

export type DesignSystemPreviewPageSpec = {
  key: string;
  label: string;
  worksheet: Worksheet;
};

/** Vzorová stránka: nadpis + odstavec + podsekce + text + infobox (12sl. mřížka). */
const DEMO_CHAPTER_SLOTS: SeriesSlot[] = [
  { type: 'heading', span: 12, level: 'h1' },
  { type: 'paragraph', span: 12 },
  { type: 'heading', span: 12, level: 'h2' },
  { type: 'paragraph', span: 8 },
  { type: 'infobox', span: 4 },
];

function escapeForHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function baseMetadata(ds: DesignSystem): Worksheet['metadata'] {
  return {
    ...DEFAULT_WORKSHEET_METADATA,
    subject: 'prirodopis',
    grade: 6,
    pageFormat: ds.pageDefaults.pageFormat,
    gridColumns: ds.pageDefaults.gridColumns,
    gridGap: ds.pageDefaults.gridGap,
    pageBackgroundColor: ds.pageDefaults.pageBackgroundColor,
    globalFontSize: ds.typography.baseFontSize,
    layoutMode: 'grid',
    designSystemId: ds.id,
    designFonts: { heading: ds.typography.headingFont, body: ds.typography.bodyFont },
    printGoogleFontFamilies: collectGoogleFontsForPrint(ds.typography),
  };
}

function makePreviewWorksheet(
  ds: DesignSystem,
  suffix: string,
  title: string,
  blocks: WorksheetBlock[],
): Worksheet {
  const stamp = `${ds.updated_at}#${suffix}`;
  return {
    id: `ds2-preview-${ds.id}-${suffix}`,
    title,
    description: '',
    blocks,
    metadata: baseMetadata(ds),
    createdAt: ds.created_at,
    updatedAt: stamp,
    status: 'draft',
  };
}

/** Jeden list pro mini náhled karty „skupina layoutu“ — stejný renderer jako kniha (`PrintGridCanvas`). */
export function buildSinglePagePreviewWorksheetFromBlocks(
  ds: DesignSystem,
  blocks: WorksheetBlock[],
  idSuffix: string,
): Worksheet {
  const raw = JSON.parse(JSON.stringify(blocks)) as WorksheetBlock[];
  raw.forEach((b, i) => {
    b.order = i;
  });
  const withVisual = raw.map((b) => mergeBlockWithDefaultVisualStyles(b, ds.blockPreferences.defaultVisualStyles));
  const stamp = `${ds.updated_at}#layout-mini#${idSuffix}`;
  return {
    id: `ds2-preview-layout-mini-${ds.id}-${idSuffix}`,
    title: 'Náhled — skupina layoutu',
    description: '',
    blocks: withVisual,
    metadata: {
      ...baseMetadata(ds),
      pageCount: 1,
    },
    createdAt: ds.created_at,
    updatedAt: stamp,
    status: 'draft',
  };
}

function buildDemoChapterBlocks(ds: DesignSystem): WorksheetBlock[] {
  const blocks = worksheetBlocksFromLayoutSlots(DEMO_CHAPTER_SLOTS, ds.typography) as WorksheetBlock[];
  const h1 = blocks[0];
  if (h1?.type === 'heading' && h1.content && typeof h1.content === 'object') {
    (h1.content as { text?: string }).text = ds.name?.trim() || 'Název kapitoly';
  }
  const p1 = blocks[1];
  if (p1?.type === 'paragraph' && p1.content && typeof p1.content === 'object') {
    const raw =
      ds.description?.trim() ||
      'Tento odstavec ukazuje běžný text učebnice. Klidné řádkování a srozumitelné věty pomáhají žákům číst bez únavy.';
    (p1.content as { html?: string }).html = `<p>${escapeForHtmlText(raw)}</p>`;
  }
  const h2 = blocks[2];
  if (h2?.type === 'heading' && h2.content && typeof h2.content === 'object') {
    (h2.content as { text?: string }).text = 'Podnadpis sekce';
  }
  const p2 = blocks[3];
  if (p2?.type === 'paragraph' && p2.content && typeof p2.content === 'object') {
    (p2.content as { html?: string }).html =
      '<p>Text v hlavní části stránky — zarovnání a font odpovídají nastavení design systému. Příliš žluťoučký kůň úpěl ďábelské ódy.</p>';
  }
  const ib = blocks[4];
  if (ib?.type === 'infobox' && ib.content && typeof ib.content === 'object') {
    const c = ib.content as { title?: string; html?: string };
    c.title = 'Klíčové pojmy';
    c.html = '<p>Infobox doplňuje stránku — barvy můžete ladit v klasickém editoru.</p>';
  }
  return blocks;
}

/**
 * Jedna „ukázka kapitoly“ + až N stránek z AI layoutů (bloky 1:1 z customLayouts).
 */
export function buildDesignSystemPreviewPages(
  ds: DesignSystem,
  options?: { maxLayoutPages?: number },
): DesignSystemPreviewPageSpec[] {
  const maxL = options?.maxLayoutPages ?? 6;
  const out: DesignSystemPreviewPageSpec[] = [];

  out.push({
    key: 'chapter-demo',
    label: 'Ukázka kapitoly',
    worksheet: makePreviewWorksheet(ds, 'chapter', 'Náhled — ukázka kapitoly', buildDemoChapterBlocks(ds)),
  });

  const layouts = ds.blockPreferences.customLayouts ?? [];
  layouts.slice(0, maxL).forEach((cl, i) => {
    let blocks: WorksheetBlock[] = [];
    try {
      blocks = JSON.parse(JSON.stringify(cl.blocks)) as WorksheetBlock[];
    } catch {
      blocks = [];
    }
    blocks.forEach((b, j) => {
      b.order = j;
    });
    out.push({
      key: `layout-${cl.id}`,
      label: clipLabel(cl.name, 42),
      worksheet: makePreviewWorksheet(ds, `layout-${i}-${cl.id}`, cl.name, blocks),
    });
  });

  return out;
}

function clipLabel(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

// ── Flow náhled: jeden list, náhodný obsah, obrázky z referencí / AI příkladu ──

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const HEADLINES = [
  'Co se skrývá v korunách stromů',
  'Cesta vody krajinou',
  'Malí vědci v laboratoři',
  'Příběh jednoho semínka',
  'Svět pod mikroskopem',
  'Energie kolem nás',
  'Mapa nebeských těles',
  'Život ve městě a na venkově',
  'Barvy a tvary v přírodě',
  'Bezpečně na cestách',
  'Tajemství starých ruin',
  'Rytmus ročních dob',
];

const INFOBOX_TITLES = ['Víš že…?', 'Zkus si zapamatovat', 'Na okraj', 'Pro učitele', 'Tip pro zkoušení'];

const BODY_PARAS = [
  'Učebnice má žákům pomáhat chápat souvislosti, ne jen přečíst definice. Když propojíme obrázek, krátký text a jednu aktivitu, pamatují si látku mnohem snáz než po suchém výčtu pojmů.',
  'Dlouhý odstavec by měl mít jasnou myšlenku hned v první větě. Další věty rozvádějí příklady, srovnání nebo jednoduché experimenty, které lze zvládnout i v běžné třídě bez speciálního vybavení.',
  'Čtení na monitoru i v tisku by mělo šetřit oči: dostatečný kontrast, klidné řádkování a rozumná délka řádku. Žáci často čtou diagonálně — struktura nadpisů a odrážek jim výrazně pomůže.',
  'Přírodopis a zeměpis nabízejí spoustu míst, kde ilustrace není jen výzdoba. Dobrý obrázek ukáže poměry, barvy biotopu nebo postup v čase, který by text popisoval dlouze a méně názorně.',
  'Motivace roste, když téma souvisí s každodenním životem: doprava, jídlo, počasí, sport. Krátké úvahy nebo diskusní otázky na konci odstavce podnítí žáky k vlastním nápadům.',
  'Opakování je součást učení, ale nemusí být nudné. Střídání forem — text, infobox, obrázek s popiskem, mini kvíz — udrží pozornost a dá prostor různým stylům učení.',
  'Hodnocení může být jemné: ne jen správně/špatně, ale i „co bys doplnil?“. Takový přístup podporuje metakognici a žáci lépe pochopí, co ještě neumí.',
  'Jazyk učebnice by měl být přesný, ale ne chladný. Krátká věta v druhé osobě („Zkus si představit…“) dokáže stránku výrazně zpřístupnit mladším ročníkům.',
  'Mezi kapitolami pomáhá vizuální oddech: bílá plocha, menší nadpis nebo jednoduchá ikona. Čtenář pak lépe oddělí bloky informací a neunaví se u dlouhých souvislých textů.',
  'Technologie ve výuce má smysl, když má jasný cíl: ověřit hypotézu, změřit data nebo sdílet výsledek skupiny. Jinak riskujeme, že zařízení odvádí pozornost od obsahu.',
  'Různorodá třída potřebuje různé vstupy: někdo potřebuje více vizuálních podnětů, někdo klidnější tempo. Dobře nastavená šablona stránky umožní učiteli obsah doplnit bez boje s rozložením.',
  'Propojení s reálnými lokacemi — park u školy, řeka za městem — dělá z látky zážitek. Stručný popis výletu nebo pozorování v terénu často víc zafunguje než abstraktní kapitola z učebnice.',
];

function pickMany<T>(arr: T[], count: number, rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

export function collectDesignSystemPreviewImageUrls(
  ds: DesignSystem,
  styleExampleUrl?: string | null,
): string[] {
  const out: string[] = [];
  const push = (u: string | undefined | null) => {
    const t = u?.trim();
    if (t) out.push(t);
  };
  push(styleExampleUrl);
  for (const f of ds.dataset?.files ?? []) {
    if (f.kind === 'image') push(f.url);
  }
  return [...new Set(out)];
}

function fallbackPreviewImageUrls(seed: number): string[] {
  const s = seed >>> 0;
  return [
    `https://picsum.photos/seed/dsflow${s}a/720/480`,
    `https://picsum.photos/seed/dsflow${s}b/680/460`,
    `https://picsum.photos/seed/dsflow${s}c/640/420`,
  ];
}

function cloneBlocksWithNewIds(blocks: WorksheetBlock[], prefix: string): WorksheetBlock[] {
  const raw = JSON.parse(JSON.stringify(blocks)) as WorksheetBlock[];
  const idMap = new Map<string, string>();
  raw.forEach((b, i) => {
    idMap.set(b.id, `${prefix}-${i}`);
  });
  return raw.map((b) => ({
    ...b,
    id: idMap.get(b.id)!,
    layoutSectionId: b.layoutSectionId ? idMap.get(b.layoutSectionId) ?? b.layoutSectionId : undefined,
  }));
}

function makeUrlPicker(urls: string[]): () => string {
  let i = 0;
  return () => {
    if (!urls.length) return '';
    const u = urls[i % urls.length];
    i++;
    return u;
  };
}

function paragraphsHtml(rng: () => number, min: number, max: number): string {
  const n = min + Math.floor(rng() * (max - min + 1));
  return pickMany(BODY_PARAS, n, rng)
    .map((p) => `<p>${escapeForHtmlText(p)}</p>`)
    .join('');
}

function enrichBlocksForPreview(blocks: WorksheetBlock[], rng: () => number, pickUrl: () => string): void {
  const pickHeadline = () => HEADLINES[Math.floor(rng() * HEADLINES.length)]!;
  const pickInfoTitle = () => INFOBOX_TITLES[Math.floor(rng() * INFOBOX_TITLES.length)]!;

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const c = block.content as { text?: string };
        c.text = pickHeadline();
        break;
      }
      case 'paragraph': {
        const vs = block.visualStyles as { displayPreset?: string } | undefined;
        const c = block.content as { html?: string; title?: string };
        if (vs?.displayPreset === 'infobox') {
          c.html = paragraphsHtml(rng, 1, 2);
          if (!c.title) (c as { title?: string }).title = pickInfoTitle();
        } else {
          c.html = paragraphsHtml(rng, 2, 5);
        }
        break;
      }
      case 'infobox': {
        const c = block.content as { title?: string; html?: string };
        c.title = pickInfoTitle();
        c.html = paragraphsHtml(rng, 1, 3);
        break;
      }
      case 'image': {
        const c = block.content as {
          url?: string;
          alt?: string;
          gallery?: string[];
          caption?: string;
        };
        if (Array.isArray(c.gallery) && c.gallery.length > 0) {
          c.gallery = c.gallery.map(() => pickUrl() || c.url || '');
          if (!c.url && c.gallery[0]) c.url = c.gallery[0];
        } else {
          const u = pickUrl();
          if (u) {
            c.url = u;
            c.alt = c.alt?.trim() || 'Ilustrace k tématu';
            c.caption = c.caption?.trim() || 'Ukázkový obrázek pro náhled stylu.';
          }
        }
        break;
      }
      case 'multiple-choice': {
        const c = block.content as {
          question?: string;
          questionHtml?: string;
          options?: { id: string; text: string }[];
        };
        c.question = pickHeadline();
        c.questionHtml = '';
        const opts = c.options ?? [];
        const words = ['list', 'kořen', 'voda', 'půda', 'vítr', 'slunce', 'semeno', 'květ'];
        opts.forEach((o, i) => {
          o.text = words[i % words.length] ?? `Možnost ${i + 1}`;
        });
        break;
      }
      case 'free-answer': {
        const c = block.content as { question?: string; questionHtml?: string };
        c.question = `Krátce vysvětli: ${pickHeadline().toLowerCase()}?`;
        c.questionHtml = '';
        break;
      }
      default:
        break;
    }
  }
}

function buildFlowOpeningBlocks(ds: DesignSystem, rng: () => number, pickUrl: () => string): WorksheetBlock[] {
  const blocks = worksheetBlocksFromLayoutSlots(DEMO_CHAPTER_SLOTS, ds.typography) as WorksheetBlock[];
  const h1 = blocks[0];
  if (h1?.type === 'heading' && h1.content && typeof h1.content === 'object') {
    (h1.content as { text?: string }).text = ds.name?.trim() || 'Název kapitoly';
  }
  const p1 = blocks[1];
  if (p1?.type === 'paragraph' && p1.content && typeof p1.content === 'object') {
    const extra =
      ds.description?.trim() ||
      'Tento blok ukazuje, jak působí souvislý text v design systému — řádkování, font a barvy odpovídají tvému nastavení.';
    const paras = pickMany(BODY_PARAS, 3, rng);
    paras.unshift(extra);
    (p1.content as { html?: string }).html = paras.map((p) => `<p>${escapeForHtmlText(p)}</p>`).join('');
  }
  const h2 = blocks[2];
  if (h2?.type === 'heading' && h2.content && typeof h2.content === 'object') {
    (h2.content as { text?: string }).text = HEADLINES[Math.floor(rng() * HEADLINES.length)]!;
  }
  const p2 = blocks[3];
  if (p2?.type === 'paragraph' && p2.content && typeof p2.content === 'object') {
    (p2.content as { html?: string }).html = paragraphsHtml(rng, 3, 5);
  }
  const ib = blocks[4];
  if (ib?.type === 'infobox' && ib.content && typeof ib.content === 'object') {
    const c = ib.content as { title?: string; html?: string };
    c.title = INFOBOX_TITLES[Math.floor(rng() * INFOBOX_TITLES.length)]!;
    c.html = paragraphsHtml(rng, 1, 2);
  }

  const u = pickUrl();
  if (u) {
    const img = createEmptyBlock('image', 2);
    img.gridSpan = 12;
    img.order = 2;
    if (img.type === 'image') {
      img.content.url = u;
      img.content.alt = 'Ukázka ilustrace';
      img.content.caption = 'Obrázek z referencí nebo z AI stylu (náhled).';
    }
    blocks.splice(2, 0, img);
  }

  blocks.forEach((b, i) => {
    b.order = i;
  });

  return blocks;
}

export type DesignSystemFlowPreviewOptions = {
  /** Změna při kliknutí na „Aktualizovat“ — jiný obsah / pořadí odstavců */
  refreshKey: number;
  maxLayoutPages?: number;
  /** Poslední vygenerovaný příklad z karty AI STYL (data URL nebo veřejná URL) */
  styleExampleUrl?: string | null;
};

/**
 * Jeden pracovní list: úvod + šablony layoutů za sebou → PrintGridCanvas stránkuje jako souvislý dokument.
 *
 * Pořadí a zdroje:
 * - `blockPreferences.customLayouts` — AI `suggestedLayouts` uložené jako slotové bloky (primární).
 * - Pokud je ještě místo v limitu `maxLayoutPages`, doplní se **jedinečné** `previewKind` z
 *   `blockPreferences.pageLayoutGroups` (stejná skladba jako karty na canvasu / `worksheetBlocksFromPageLayoutPreviewKind`).
 * - Když `customLayouts` chybí, náhled toku staví stránky jen ze skupin (fallback).
 * Barvy a typografie vždy z design tokenů DS (`typography`, `defaultVisualStyles`, `pageDefaults`).
 */
export function buildDesignSystemFlowPreviewWorksheet(
  ds: DesignSystem,
  options: DesignSystemFlowPreviewOptions,
): Worksheet {
  const maxL = options.maxLayoutPages ?? 8;
  const seed = (hashStr(ds.id) ^ (options.refreshKey * 2654435761)) >>> 0;
  const rng = mulberry32(seed);

  let urls = collectDesignSystemPreviewImageUrls(ds, options.styleExampleUrl);
  if (urls.length === 0) urls = fallbackPreviewImageUrls(seed);
  const pickUrl = makeUrlPicker(urls);

  const merged: WorksheetBlock[] = [];

  const opening = buildFlowOpeningBlocks(ds, rng, pickUrl);
  merged.push(...opening);

  const layouts = ds.blockPreferences.customLayouts ?? [];
  const groups = ds.blockPreferences.pageLayoutGroups ?? [];
  let estimatedPageCount = 1;
  let sectionsUsed = 0;

  layouts.forEach((cl, li) => {
    if (sectionsUsed >= maxL) return;
    let raw: WorksheetBlock[] = [];
    try {
      raw = JSON.parse(JSON.stringify(cl.blocks)) as WorksheetBlock[];
    } catch {
      raw = [];
    }
    if (raw.length === 0) return;
    sectionsUsed += 1;
    estimatedPageCount += 1;
    const cloned = cloneBlocksWithNewIds(raw, `L${li}`);
    enrichBlocksForPreview(cloned, rng, pickUrl);
    merged.push(...cloned);
  });

  const seenGroupKinds = new Set<string>();
  for (let gi = 0; gi < groups.length && sectionsUsed < maxL; gi++) {
    const g = groups[gi]!;
    const kind = g.previewKind ?? 'heading_row_infobox_image';
    if (seenGroupKinds.has(kind)) continue;
    seenGroupKinds.add(kind);
    sectionsUsed += 1;
    estimatedPageCount += 1;
    const raw = worksheetBlocksFromPageLayoutPreviewKind(ds, kind);
    const cloned = cloneBlocksWithNewIds(raw, `G${gi}`);
    enrichBlocksForPreview(cloned, rng, pickUrl);
    merged.push(...cloned);
  }

  merged.forEach((b, i) => {
    b.order = i;
  });

  const withVisual = merged.map((b) => mergeBlockWithDefaultVisualStyles(b, ds.blockPreferences.defaultVisualStyles));

  const stamp = `${ds.updated_at}#flow#${options.refreshKey}#${seed}`;
  return {
    id: `ds2-preview-flow-${ds.id}`,
    title: 'Náhled — souvislý tok stránek',
    description: '',
    blocks: withVisual,
    metadata: {
      ...baseMetadata(ds),
      pageCount: Math.max(1, estimatedPageCount),
    },
    createdAt: ds.created_at,
    updatedAt: stamp,
    status: 'draft',
  };
}

/**
 * URL do Pro editoru (`/admin/worksheet-pro/…`) s jednou stránkou = vlastní layout v design systému.
 * Stejný mechanismus jako náhled toku stránek (`stashWorksheetForEditorSession`).
 */
export function buildStashedProEditorUrlForDesignSystemCustomLayout(
  ds: DesignSystem,
  customLayoutId: string,
  ctx: { pageFormat: string; bookId: string; workbookId: string },
): string | null {
  const cl = ds.blockPreferences.customLayouts?.find((l) => l.id === customLayoutId);
  if (!cl) return null;
  const ws = buildSinglePagePreviewWorksheetFromBlocks(ds, (cl.blocks ?? []) as WorksheetBlock[], cl.id);
  const titled = { ...ws, title: cl.name?.trim() || ws.title };
  return buildStashedWorksheetEditorUrl(titled, {
    pageIndex: 0,
    pageFormat: ctx.pageFormat,
    bookId: ctx.bookId,
    workbookId: ctx.workbookId,
  });
}
