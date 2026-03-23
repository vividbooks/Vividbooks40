/**
 * Material Generators from DataSet
 * 
 * NOVÝ PŘÍSTUP: Generuje TEXT místo JSON, pak parsuje lokálně.
 * To je spolehlivější a méně náchylné na chyby.
 */

import { TopicDataSet, ValidatedImage, IllustrationPrompt, ImageGroup, ImageGroupSubject } from '../../types/topic-dataset';
import { SectionMediaItem } from '../../types/section-media';
import { Quiz, QuizSlide, createABCSlide, createInfoSlide, createOpenSlide, createVotingSlide, createBoardSlide, createConnectPairsSlide, createFillBlanksSlide } from '../../types/quiz';
import { Worksheet, WorksheetBlock, FillBlankSegment, generateBlockId } from '../../types/worksheet';
import { worksheetToPresentation } from '../worksheet-to-presentation';
import { saveQuiz, syncQuizDirectToSupabase } from '../quiz-storage';
import { saveWorksheet } from '../worksheet-storage';
import { saveDocument, syncDocumentDirectToSupabase } from '../document-storage';
import { chatWithAIProxy } from '../ai-chat-proxy';
import { searchRagExamples, formatRagExamplesForPrompt, formatRagAsLayoutTemplate, type RagExample, type ContentPlan } from '../worksheet-rag';
import { TEXTBOOK_LAYOUTS, layoutsToAgent2Prompt, buildSlotPrompt, type TemplateSlot } from '../textbook-layouts';
import { supabase } from '../supabase/client';
import { convertLegacyLayoutsToLayoutSections } from '../layout-sections';

/**
 * Přeloží title a description obrázků z webu do češtiny pomocí Gemini Flash.
 * Zpracuje dávkově až 20 obrázků najednou.
 */
export { translateImageCaptions } from './translate-captions';

/**
 * Načte HTML obsah učebního textu (typ 'text') z localStorage nebo Supabase.
 * Vrátí plain text (bez HTML tagů) pro použití jako kontext v AI promptech.
 */
export async function loadSourceTextContent(docId: string): Promise<string | null> {
  try {
    const local = localStorage.getItem(`vivid-doc-${docId}`);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed?.content) {
        return parsed.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }
  } catch { /* ignore */ }

  try {
    const { data } = await supabase
      .from('teacher_documents')
      .select('content')
      .eq('id', docId)
      .single();
    if (data?.content) {
      const html = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
      return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * Načte HTML obsah učebního textu a převede ho přímo na WorksheetBlock[].
 * Pravidla layoutu:
 *   - H1 → nadpis celá šířka
 *   - H2/H3 → nadpis celá šířka
 *   - Odstavec pod H2/H3 + dostupný obrázek → odstavec levá půlka + obrázek pravá půlka
 *   - Odstavec bez obrázku → celá šířka
 */
export async function loadSourceTextAsBlocks(docId: string, dataSet: TopicDataSet): Promise<WorksheetBlock[] | null> {
  let html: string | null = null;

  try {
    const local = localStorage.getItem(`vivid-doc-${docId}`);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed?.content) html = parsed.content;
    }
  } catch { /* ignore */ }

  if (!html) {
    try {
      const { data } = await supabase
        .from('teacher_documents')
        .select('content')
        .eq('id', docId)
        .single();
      if (data?.content) {
        html = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
      }
    } catch { /* ignore */ }
  }

  if (!html) return null;

  // Load sectionImages from document (H2 → image mapping set by user/AI)
  let docSectionImages: any[] = [];
  try {
    const local = localStorage.getItem(`vivid-doc-${docId}`);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed?.sectionImages)) docSectionImages = parsed.sectionImages;
    }
  } catch { /* ignore */ }

  // Build lookup: normalized H2 heading text → first image URL + caption from sectionImages
  const h2ImageMap = new Map<string, { url: string; title: string; caption: string; imageSteps?: any[] }>();
  for (const si of docSectionImages) {
    const key = (si.heading || '').toLowerCase().trim();
    if (!key) continue;
    const firstUrl = si.imageSteps?.[0]?.url || si.imageUrl || '';
    if (!firstUrl) continue;
    h2ImageMap.set(key, {
      url: firstUrl,
      title: si.heading || '',
      caption: si.imageSteps?.[0]?.description || si.heading || '',
      imageSteps: si.imageSteps,
    });
  }

  // Collect all available images from dataset (fallback for sections without explicit mapping)
  const allImages: { url: string; title: string; caption: string }[] = [
    ...(dataSet.media?.generatedIllustrations || []).map((m: any) => ({
      url: m.url || '', title: m.name || m.title || '', caption: m.name || m.title || '',
    })),
    ...(dataSet.media?.generatedPhotos || []).map((m: any) => ({
      url: m.url || '', title: m.name || m.title || '', caption: m.name || m.title || '',
    })),
    ...(dataSet.media?.images || []).map((m: any) => {
      const licenseStr = [m.source, m.license].filter(Boolean).join(' • ');
      return {
        url: m.url || '',
        title: m.title || '',
        caption: licenseStr ? `${m.title || ''}\n${licenseStr}` : (m.title || ''),
      };
    }),
  ].filter(m => !!m.url);

  // Parse HTML into raw block list
  type RawBlock = { tag: string; html: string; text: string };
  const raw: RawBlock[] = [];
  const blockPattern = /<(h1|h2|h3|h4|p|ul|ol|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = blockPattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const inner = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!inner) continue;
    raw.push({ tag, html: match[0], text: inner });
  }

  if (raw.length === 0) return null;

  // Keywords for infobox-type paragraphs (Shrnutí, Věděli jste?, Pozor, Tip, ...)
  const INFOBOX_KW = /^(shrnut[ií]|v[eě]d[eě]li jste|pozor|tip\b|poznámka|zajímavost|důležit[eé] pojm)/i;
  // Infobox color map
  const INFOBOX_VARIANT: Record<string, 'green'|'blue'|'yellow'|'purple'> = {
    shrnutí: 'green', shrnutí2: 'green',
    věděli: 'blue', věděli2: 'blue',
    pozor: 'yellow',
    tip: 'purple',
  };
  const getInfoboxVariant = (text: string): 'green'|'blue'|'yellow'|'purple' => {
    const t = text.toLowerCase();
    if (/shrnut/.test(t)) return 'green';
    if (/v[eě]d[eě]li/.test(t)) return 'blue';
    if (/pozor/.test(t)) return 'yellow';
    if (/tip/.test(t)) return 'purple';
    return 'blue';
  };

  // Classify each raw block
  type BlockKind = 'h1' | 'h2' | 'h3' | 'infobox-heading' | 'section-heading' | 'paragraph' | 'list' | 'blockquote';
  const classify = (rb: { tag: string; text: string }): BlockKind => {
    if (rb.tag === 'h1') return 'h1';
    if (rb.tag === 'h2') return 'h2';
    if (rb.tag === 'h3' || rb.tag === 'h4') return 'h3';
    if (rb.tag === 'blockquote') return 'blockquote';
    if (rb.tag === 'ul' || rb.tag === 'ol') return 'list';
    // For <p>: heuristic detection
    const t = rb.text.trim();
    if (INFOBOX_KW.test(t)) return 'infobox-heading';
    // Short paragraph without sentence-ending punctuation → section heading
    if (t.length <= 80 && !/[.!?;]$/.test(t) && !t.startsWith('📚')) return 'section-heading';
    return 'paragraph';
  };

  // ── Group raw blocks into sections ──────────────────────────────────────
  type InfoboxData = { title: string; html: string; variant: 'green'|'blue'|'yellow'|'purple' };
  type Section = {
    headingText: string | null;
    headingLevel: 'h1'|'h2'|'h3';
    paragraphs: RawBlock[];
    infoboxes: InfoboxData[];
    lists: RawBlock[];
  };

  const sections: Section[] = [];
  let cur: Section = { headingText: null, headingLevel: 'h2', paragraphs: [], infoboxes: [], lists: [] };

  const pushSection = () => {
    if (cur.headingText !== null || cur.paragraphs.length > 0 || cur.infoboxes.length > 0) {
      sections.push(cur);
    }
  };

  for (let i = 0; i < raw.length; i++) {
    const rb = raw[i];
    const kind = classify(rb);

    if (kind === 'h1' || kind === 'h2' || kind === 'h3' || kind === 'section-heading') {
      pushSection();
      const level: 'h1'|'h2'|'h3' = kind === 'h1' ? 'h1' : kind === 'h3' || kind === 'section-heading' ? 'h3' : 'h2';
      cur = { headingText: rb.text, headingLevel: level, paragraphs: [], infoboxes: [], lists: [] };
    } else if (kind === 'infobox-heading') {
      const variant = getInfoboxVariant(rb.text);
      const nextRb = raw[i + 1];
      const contentHtml = nextRb && classify(nextRb) === 'paragraph' ? nextRb.html : '';
      if (contentHtml) i++;
      cur.infoboxes.push({ title: rb.text, html: contentHtml, variant });
    } else if (kind === 'blockquote') {
      cur.infoboxes.push({ title: '', html: rb.html, variant: 'blue' });
    } else if (kind === 'list') {
      cur.lists.push(rb);
    } else if (kind === 'paragraph') {
      cur.paragraphs.push(rb);
    }
  }
  pushSection();

  if (sections.length === 0) return null;

  // ── Distribute images to content sections ─────────────────────────────
  // Priority 1: sections with H2 heading that has a mapped image in sectionImages
  // Priority 2: evenly distribute remaining dataset images to remaining content sections
  const contentSections = sections.filter(s => s.paragraphs.length > 0);
  const sectionGetsImage = new Set<number>();
  // Track which global images are already claimed by h2ImageMap
  const usedGlobalImageUrls = new Set<string>(Array.from(h2ImageMap.values()).map(v => v.url));
  const remainingImages = allImages.filter(m => !usedGlobalImageUrls.has(m.url));
  // Mark sections that will use fallback images (those without an h2 mapping)
  const sectionsNeedingFallback = contentSections.filter(s => !h2ImageMap.has((s.headingText || '').toLowerCase().trim()));
  if (remainingImages.length > 0 && sectionsNeedingFallback.length > 0) {
    const step = Math.max(1, Math.ceil(sectionsNeedingFallback.length / remainingImages.length));
    let used = 0;
    for (let si = 0; si < sectionsNeedingFallback.length && used < remainingImages.length; si += step) {
      sectionGetsImage.add(sections.indexOf(sectionsNeedingFallback[si]));
      used++;
    }
  }

  // ── Layout heuristics ─────────────────────────────────────────────────
  type LayoutType = 'A'|'A2'|'B'|'B2'|'C'|'C+I'|'B+G+I'|'B2+G+I'|'G';
  let layoutCounter = 0;

  const pickLayout = (s: Section, hasImg: boolean): LayoutType => {
    if (s.headingLevel === 'h1') return 'G'; // H1 sections handled separately
    const hasInfobox = s.infoboxes.length > 0;
    const textLen = s.paragraphs.reduce((sum, p) => sum + p.text.length, 0);

    if (hasImg && hasInfobox) return layoutCounter % 2 === 0 ? 'B+G+I' : 'B2+G+I';
    if (hasImg) {
      const variants: LayoutType[] = ['A', 'B', 'A2', 'B2'];
      return variants[layoutCounter % 4];
    }
    if (hasInfobox) return 'C+I';
    if (textLen > 350) return 'C';
    return 'G';
  };

  // ── Block builder helpers ─────────────────────────────────────────────
  /** Nahradí mezeru za nezlomitelnou mezeru po jednoznakových předložkách/spojkách (česká typografie) */
  const fixWidows = (text: string): string =>
    text.replace(/(\s|^)([aiouvzksAIOUVZKS])\s+/g, (_m, pre, letter) => `${pre}${letter}\u00A0`);

  let order = 0;
  let globalImgIdx = 0;
  const blocks: WorksheetBlock[] = [];

  const mk = {
    heading: (text: string, level: 'h1'|'h2'|'h3', span = 12): WorksheetBlock => ({
      id: generateBlockId(), type: 'heading', order: order++,
      width: span < 12 ? 'half' : 'full', gridSpan: span,
      content: { text: fixWidows(text), level },
    }),
    para: (html: string, span = 12, columns?: 1|2): WorksheetBlock => ({
      id: generateBlockId(), type: 'paragraph', order: order++,
      width: span < 12 ? 'half' : 'full', gridSpan: span,
      content: columns ? { html, columns } : { html },
    }),
    img: (img: { url: string; title: string; caption: string }, span = 6): WorksheetBlock => ({
      id: generateBlockId(), type: 'image', order: order++,
      width: span < 12 ? 'half' : 'full', gridSpan: span,
      content: { url: img.url, alt: img.title, caption: img.caption, alignment: 'center' as const, size: 100 },
    }),
    floatImg: (img: { url: string; title: string; caption: string }, side: 'left'|'right', gridSpan: number, spanBlocks: number): WorksheetBlock => ({
      id: generateBlockId(), type: 'image', order: order++,
      width: 'half', gridSpan,
      floatSide: side, floatSpanBlocks: spanBlocks, floatGridSpan: gridSpan,
      content: { url: img.url, alt: img.title, caption: img.caption, alignment: 'center' as const, size: 100 },
    } as WorksheetBlock),
    gallery: (urls: string[], side: 'left'|'right', gridSpan: number, spanBlocks: number, cols: number): WorksheetBlock => ({
      id: generateBlockId(), type: 'image', order: order++,
      width: 'half', gridSpan,
      floatSide: side, floatSpanBlocks: spanBlocks, floatGridSpan: gridSpan,
      content: { url: urls[0] || '', alt: '', caption: '', alignment: 'center' as const, size: 100,
        gallery: urls, galleryLayout: 'grid' as const, gridColumns: cols },
    } as WorksheetBlock),
    infobox: (ib: InfoboxData, span = 12): WorksheetBlock => ({
      id: generateBlockId(), type: 'infobox', order: order++,
      width: span < 12 ? 'half' : 'full', gridSpan: span,
      content: { title: ib.title, html: ib.html, variant: ib.variant },
    }),
    inlineGallery: (urls: string[], captions: string[], cols: number, span = 12): WorksheetBlock => ({
      id: generateBlockId(), type: 'image', order: order++,
      width: 'full', gridSpan: span,
      content: {
        url: urls[0] || '',
        alt: captions[0] || '',
        caption: '',
        alignment: 'center' as const,
        size: 100,
        gallery: urls,
        galleryCaptions: captions,
        galleryLayout: 'grid' as const,
        gridColumns: Math.min(cols, urls.length),
      },
    }),
  };

  // ── Prepend H1 title if HTML doesn't contain one ─────────────────────
  const hasH1InSections = sections.some(s => s.headingLevel === 'h1');
  if (!hasH1InSections && dataSet.topic) {
    blocks.push(mk.heading(dataSet.topic, 'h1', 12));
  }

  // ── Generate blocks per section ───────────────────────────────────────
  sections.forEach((s, sIdx) => {
    // First check if there's a direct H2→image mapping, then fall back to even distribution
    const mappedImg = h2ImageMap.get((s.headingText || '').toLowerCase().trim()) || null;
    const hasImg = !!mappedImg || sectionGetsImage.has(sIdx);
    const img = mappedImg || (sectionGetsImage.has(sIdx) && globalImgIdx < remainingImages.length ? remainingImages[globalImgIdx] : null);

    // Detect multi-image group (imageSteps with 2+ valid URLs)
    const imageSteps: any[] = mappedImg?.imageSteps?.filter((st: any) => !!st.url) || [];
    const isMultiImage = imageSteps.length >= 2;

    // H1 title sections: always full width, no layout transformation
    if (s.headingLevel === 'h1') {
      if (s.headingText) blocks.push(mk.heading(s.headingText, 'h1', 12));
      for (const p of s.paragraphs) blocks.push(mk.para(p.html, 12));
      for (const l of s.lists) blocks.push(mk.para(l.html, 12));
      for (const ib of s.infoboxes) blocks.push(mk.infobox(ib, 12));
      return;
    }

    // Multi-image group: H2 + full-width text + gallery below
    if (isMultiImage) {
      if (s.headingText) blocks.push(mk.heading(s.headingText, s.headingLevel, 12));
      for (const p of s.paragraphs) blocks.push(mk.para(p.html, 12));
      for (const l of s.lists) blocks.push(mk.para(l.html, 12));
      for (const ib of s.infoboxes) blocks.push(mk.infobox(ib, 12));
      const urls = imageSteps.map((st: any) => st.url);
      const captions = imageSteps.map((st: any) => st.description || st.name || '');
      blocks.push(mk.inlineGallery(urls, captions, Math.min(imageSteps.length, 4)));
      layoutCounter++;
      return;
    }

    const layout = pickLayout(s, !!img);
    if (img) {
      if (!mappedImg) globalImgIdx++; // only increment for fallback images
      layoutCounter++;
    } else if (s.paragraphs.length > 0) layoutCounter++;

    const level = s.headingLevel;
    const mainPara = s.paragraphs[0];
    const extraParas = s.paragraphs.slice(1);
    const firstIb = s.infoboxes[0];
    const extraIbs = s.infoboxes.slice(1);

    switch (layout) {
      case 'A': // H2(12) + para(6) + img(6)
        if (s.headingText) blocks.push(mk.heading(s.headingText, level, 12));
        if (mainPara && img) { blocks.push(mk.para(mainPara.html, 6)); blocks.push(mk.img(img, 6)); }
        else if (mainPara) blocks.push(mk.para(mainPara.html, 12));
        break;

      case 'A2': // H2(12) + img(6) + para(6)
        if (s.headingText) blocks.push(mk.heading(s.headingText, level, 12));
        if (mainPara && img) { blocks.push(mk.img(img, 6)); blocks.push(mk.para(mainPara.html, 6)); }
        else if (mainPara) blocks.push(mk.para(mainPara.html, 12));
        break;

      case 'B': // floatImg(left,6) + H2(6) + para(6)
        if (img) {
          blocks.push(mk.floatImg(img, 'left', 6, s.headingText ? 2 : 1));
          if (s.headingText) blocks.push(mk.heading(s.headingText, level, 6));
          if (mainPara) blocks.push(mk.para(mainPara.html, 6));
        } else {
          if (s.headingText) blocks.push(mk.heading(s.headingText, level, 12));
          if (mainPara) blocks.push(mk.para(mainPara.html, 12));
        }
        break;

      case 'B2': // floatImg(right,6) + H2(6) + para(6)
        if (img) {
          blocks.push(mk.floatImg(img, 'right', 6, s.headingText ? 2 : 1));
          if (s.headingText) blocks.push(mk.heading(s.headingText, level, 6));
          if (mainPara) blocks.push(mk.para(mainPara.html, 6));
        } else {
          if (s.headingText) blocks.push(mk.heading(s.headingText, level, 12));
          if (mainPara) blocks.push(mk.para(mainPara.html, 12));
        }
        break;

      case 'C': // H2(12) + para(12, 2 cols)
        if (s.headingText) blocks.push(mk.heading(s.headingText, level, 12));
        if (mainPara) blocks.push(mk.para(mainPara.html, 12, 2));
        break;

      case 'C+I': // H2(12) + para(8) + infobox(4)
        if (s.headingText) blocks.push(mk.heading(s.headingText, level, 12));
        if (mainPara) blocks.push(mk.para(mainPara.html, 8));
        if (firstIb) blocks.push(mk.infobox(firstIb, 4));
        break;

      case 'B+G+I': { // gallery(float left,5) + H2(7) + para(7) + infobox(7)
        const galleryUrls = [img?.url || '', ''];
        blocks.push(mk.gallery(galleryUrls, 'left', 5, 3, 1));
        if (s.headingText) blocks.push(mk.heading(s.headingText, level, 7));
        if (mainPara) blocks.push(mk.para(mainPara.html, 7));
        blocks.push(mk.infobox(firstIb || { title: 'Klíčové pojmy', html: '<p>Doplňte klíčové pojmy...</p>', variant: 'blue' }, 7));
        break;
      }

      case 'B2+G+I': { // gallery(float right,5) + H2(7) + para(7) + infobox(7)
        const galleryUrls = [img?.url || '', ''];
        blocks.push(mk.gallery(galleryUrls, 'right', 5, 3, 1));
        if (s.headingText) blocks.push(mk.heading(s.headingText, level, 7));
        if (mainPara) blocks.push(mk.para(mainPara.html, 7));
        blocks.push(mk.infobox(firstIb || { title: 'Klíčové pojmy', html: '<p>Doplňte klíčové pojmy...</p>', variant: 'blue' }, 7));
        break;
      }

      default: // G: H2(12) + para(12)
        if (s.headingText) blocks.push(mk.heading(s.headingText, level, 12));
        if (mainPara) blocks.push(mk.para(mainPara.html, 12));
        break;
    }

    // Append remaining content full-width
    for (const p of extraParas) blocks.push(mk.para(p.html, 12));
    for (const l of s.lists) blocks.push(mk.para(l.html, 12));
    const remainingIbs = layout === 'C+I' ? extraIbs : (firstIb ? extraIbs : s.infoboxes);
    for (const ib of remainingIbs) blocks.push(mk.infobox(ib, 12));
  });

  // ── Append saved charts at the end ─────────────────────────────────────────
  const savedCharts: any[] = dataSet.media?.charts || [];
  for (const ch of savedCharts) {
    if (!ch.columns || !ch.rows || ch.rows.length === 0) continue;
    const chartBlock: WorksheetBlock = {
      id: `chart-${ch.id || Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'chart',
      order: blocks.length,
      width: 'full',
      gridSpan: 12,
      content: {
        chartType: ch.chartType || 'bar',
        chartTitle: ch.title || '',
        chartColumns: ch.columns,
        chartRows: ch.rows,
        chartHeight: 320,
      },
    };
    blocks.push(chartBlock);
  }

  // Skupiny obrázků → H2 nadpis + galerie
  const imageGroups: any[] = dataSet.media?.imageGroups || [];
  for (const group of imageGroups) {
    const doneSubjects = (group.subjects || []).filter((s: any) => s.status === 'done' && s.imageUrl);
    if (doneSubjects.length === 0) continue;
    blocks.push(mk.heading(group.title, 'h2', 12));
    const galleryBlock: WorksheetBlock = {
      id: `ig-${group.id}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'image',
      order: blocks.length,
      width: 'full',
      gridSpan: 12,
      content: {
        url: doneSubjects[0].imageUrl,
        gallery: doneSubjects.map((s: any) => s.imageUrl),
        galleryCaptions: doneSubjects.map((s: any) => s.name),
        gridColumns: Math.min(doneSubjects.length, 4),
        containerHeight: 220,
      },
    };
    blocks.push(galleryBlock);
  }

  const finalBlocks = convertLegacyLayoutsToLayoutSections(blocks);
  console.log(`[loadSourceTextAsBlocks] ${sections.length} sekcí → ${finalBlocks.length} bloků, ${h2ImageMap.size} H2→img mapování, ${globalImgIdx}/${remainingImages.length} fallback obrázků, ${savedCharts.length} grafů, ${imageGroups.length} skupin`);
  return finalBlocks.length > 0 ? finalBlocks : null;
}

// =====================================================
// MAIN EXPORT
// =====================================================

export interface GenerateResult {
  success: boolean;
  id?: string;
  error?: string;
  preview?: string;
  generationMethod?: 'two-agent' | 'legacy';
  contentPlan?: ContentPlan;
  /** ID propojeného boardu (pouze pro language aktivity) */
  linkedBoardId?: string;
}

export type ProgressCallback = (step: string, detail?: string, payload?: unknown) => void;

// Module-level folderId context – nastaví se před každým generováním a sdílí se
// se všemi interními generátory bez nutnosti předávat parametr přes každou funkci.
let _activeFolderId: string | null = null;

function _saveWs(worksheet: Parameters<typeof saveWorksheet>[0]): void {
  saveWorksheet({
    ...worksheet,
    blocks: convertLegacyLayoutsToLayoutSections(worksheet.blocks || []),
  }, _activeFolderId);
}
function _saveQz(quiz: Parameters<typeof saveQuiz>[0]): void {
  saveQuiz(quiz, _activeFolderId);
}
function _syncQz(quiz: Parameters<typeof syncQuizDirectToSupabase>[0]): Promise<boolean> {
  return syncQuizDirectToSupabase(quiz, _activeFolderId);
}
function _saveDoc(doc: Parameters<typeof saveDocument>[0], content?: Parameters<typeof saveDocument>[1]): void {
  saveDocument({ ...doc, folderId: _activeFolderId }, content);
}

export async function generateFromDataSet(
  dataSet: TopicDataSet,
  materialType: string,
  onProgress?: ProgressCallback,
  folderId?: string | null
): Promise<GenerateResult> {
  console.log(`[Generator] Generating ${materialType} from DataSet:`, dataSet.topic, 'folder:', folderId);
  _activeFolderId = folderId ?? null;

  switch (materialType) {
    case 'text':
      return generateText(dataSet);
    case 'board-easy':
      return generateBoard(dataSet, 'easy');
    case 'board-hard':
      return generateBoard(dataSet, 'hard');
    case 'worksheet':
      return generateWorksheet(dataSet, onProgress);
    case 'textbook-page': {
      // Pokud existuje učební text pro tento dataset, použij ho jako zdroj
      const textMat = (dataSet.generatedMaterials ?? []).find((m: any) => m.type === 'text');
      const sourceTextContent = textMat?.id ? await loadSourceTextContent(textMat.id) : null;
      if (sourceTextContent) {
        console.log('[Generator] Nalezen učební text, použiji ho jako zdroj pro list učebnice');
        onProgress?.('source-text', 'Načten učební text jako zdroj obsahu...');
      }
      return generateTextbookPage(dataSet, onProgress, sourceTextContent ?? undefined);
    }
    case 'test':
      return generateTest(dataSet);
    case 'lesson':
      return generateLesson(dataSet);
    case 'lessons':
      return generateMultipleLessons(dataSet);
    case 'methodology':
      return generateMethodology(dataSet);
    case 'hodnoceni':
      return generateHodnoceni(dataSet);
    // ── Language-specific generators ──────────────────────────
    case 'vocabulary-set':
      return generateLanguageVocabularySet(dataSet, onProgress);
    case 'grammar-lesson':
      return generateLanguageGrammarLesson(dataSet, onProgress);
    case 'reading-activity':
      return generateLanguageReadingActivity(dataSet, onProgress);
    case 'writing-activity':
      return generateLanguageWritingActivity(dataSet, onProgress);
    case 'speaking-activity':
      return generateLanguageSpeakingActivity(dataSet, onProgress);
    case 'language-quiz':
      return generateLanguageQuiz(dataSet, onProgress);
    case 'listening-activity':
      return generateListeningActivity(dataSet, onProgress);
    case 'unit-plan':
      return generateUnitPlan(dataSet);
    default:
      return { success: false, error: `Neznámý typ materiálu: ${materialType}` };
  }
}

/**
 * Pouze Agent 1 — vrátí ContentPlan bez generování bloků.
 * Použij pro dvoustupňové generování kde uživatel plán schvaluje.
 */
export async function generateContentPlanOnly(
  dataSet: TopicDataSet,
  onProgress?: ProgressCallback
): Promise<{ success: boolean; contentPlan?: ContentPlan; ragCount?: number; error?: string }> {
  onProgress?.('rag', 'Hledám podobné pracovní listy v RAG databázi...');
  const keyTerms = dataSet.content?.keyTerms?.map((t: any) => t.term) ?? [];
  const ragExamples = await searchRagExamples({
    topic: dataSet.topic,
    subject: dataSet.subjectCode,
    grade: dataSet.grade,
    keyTerms,
    matchCount: 3,
  });
  const ragSection = formatRagExamplesForPrompt(ragExamples);
  onProgress?.('rag-done', `Nalezeno ${ragExamples.length} podobných listů v RAG databázi`, { examples: ragExamples, ragSection });

  onProgress?.('agent1', 'Agent 1: Plánuji obsah pracovního listu...');
  const contentPlan = await runContentAgent(dataSet, ragSection);
  if (!contentPlan) {
    return { success: false, error: 'Agent 1 selhal — nepodařilo se sestavit plán obsahu' };
  }
  onProgress?.('agent1-done', `Agent 1 hotovo — ${contentPlan.sections.length} sekcí, obtížnost: ${contentPlan.difficulty}, ${contentPlan.estimatedTimeMinutes} min`);

  return { success: true, contentPlan, ragCount: ragExamples.length };
}

/**
 * Pouze Agent 2 — vezme hotový ContentPlan a vygeneruje bloky.
 * Použij po schválení plánu uživatelem.
 */
export async function generateFromContentPlan(
  dataSet: TopicDataSet,
  contentPlan: ContentPlan,
  onProgress?: ProgressCallback,
  folderId?: string | null
): Promise<GenerateResult> {
  _activeFolderId = folderId ?? _activeFolderId;
  onProgress?.('rag', 'Načítám RAG příklady pro layout...');
  const keyTerms = dataSet.content?.keyTerms?.map((t: any) => t.term) ?? [];
  const ragExamples = await searchRagExamples({
    topic: dataSet.topic,
    subject: dataSet.subjectCode,
    grade: dataSet.grade,
    keyTerms,
    matchCount: 3,
  });
  const ragSection = formatRagExamplesForPrompt(ragExamples);
  onProgress?.('rag-done', `RAG: nalezeno ${ragExamples.length} příkladů pro Agent 2`, { examples: ragExamples, ragSection });

  onProgress?.('agent2', 'Agent 2: Navrhuji layout a rozmísťuji bloky...');
  const { text: layoutText } = await runLayoutAgent(dataSet, contentPlan, ragSection, 'worksheet', ragExamples, onProgress);
  if (!layoutText) {
    onProgress?.('error', 'Agent 2 selhal');
    return { success: false, error: 'Agent 2 selhal — nepodařilo se vygenerovat layout' };
  }
  onProgress?.('agent2-done', `Agent 2 hotovo — layout připraven`);

  onProgress?.('saving', 'Ukládám pracovní list...');
  const blocks = parseTextToWorksheetBlocks(layoutText, dataSet);
  const worksheetId = `worksheet-${Date.now()}`;
  const worksheet: Worksheet = {
    id: worksheetId,
    title: contentPlan.title || `${dataSet.topic} - Pracovní list`,
    blocks,
    settings: { showAnswerKey: true, pageSize: 'A4', margins: 'normal' },
    metadata: {
      subject: dataSet.subjectCode,
      grade: dataSet.grade,
      topic: dataSet.topic,
      estimatedTime: contentPlan.estimatedTimeMinutes,
      sourceDatasetId: dataSet.id,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  _saveWs(worksheet);
  onProgress?.('done', `Uloženo (${blocks.length} bloků)`);

  return { success: true, id: worksheetId, preview: layoutText, generationMethod: 'two-agent', contentPlan };
}

// =====================================================
// POMOCNÉ FUNKCE
// =====================================================

function buildContext(dataSet: TopicDataSet): string {
  const parts: string[] = [];
  
  // RVP očekávané výstupy (pokud existují)
  if (dataSet.rvp?.expectedOutcomes?.length > 0) {
    parts.push(`🎯 OČEKÁVANÉ VÝSTUPY RVP:`);
    dataSet.rvp.expectedOutcomes.forEach(o => {
      parts.push(`• ${o}`);
    });
    parts.push('');
  }
  
  // Klíčové kompetence RVP
  const competencies = (dataSet.rvp as any)?.competencies;
  if (competencies?.length > 0) {
    parts.push(`🔑 KLÍČOVÉ KOMPETENCE:`);
    competencies.forEach((c: string) => {
      parts.push(`• ${c}`);
    });
    parts.push('');
  }
  
  // Klíčové pojmy
  if (dataSet.content?.keyTerms?.length > 0) {
    parts.push(`📖 KLÍČOVÉ POJMY:`);
    dataSet.content.keyTerms.forEach(t => {
      parts.push(`• ${t.term} — ${t.definition}`);
    });
    parts.push('');
  }
  
  // Klíčová fakta
  if (dataSet.content?.keyFacts?.length > 0) {
    parts.push(`✓ KLÍČOVÁ FAKTA:`);
    dataSet.content.keyFacts.forEach(f => {
      parts.push(`• ${f}`);
    });
    parts.push('');
  }
  
  // Časová osa
  if (dataSet.content?.timeline && dataSet.content.timeline.length > 0) {
    parts.push(`📅 ČASOVÁ OSA:`);
    dataSet.content.timeline.forEach((e: any) => {
      parts.push(`• ${e.year || e.date || ''}: ${e.event || e.description || ''}`);
    });
    parts.push('');
  }
  
  // Osobnosti
  if (dataSet.content?.personalities && dataSet.content.personalities.length > 0) {
    parts.push(`👤 OSOBNOSTI:`);
    dataSet.content.personalities.forEach((p: any) => {
      parts.push(`• ${p.name} — ${p.description}`);
    });
    parts.push('');
  }
  
  // Obrázky a ilustrace
  const images = dataSet.media?.images || [];
  const illustrations = dataSet.media?.generatedIllustrations || [];
  
  if (images.length > 0 || illustrations.length > 0) {
    parts.push(`🖼️ DOSTUPNÉ VIZUÁLY:`);
    images.forEach((img, i) => {
      parts.push(`  - Obrázek: "${img.title}"`);
    });
    illustrations.forEach((ill, i) => {
      parts.push(`  - Ilustrace: "${ill.name}"`);
    });
  }
  
  // User feedback for regeneration
  if ((dataSet.content as any)?.userFeedback) {
    parts.push('');
    parts.push(`⚠️ DŮLEŽITÉ POKYNY OD UŽIVATELE (musíš je respektovat!):`);
    parts.push((dataSet.content as any).userFeedback);
    parts.push('');
  }

  return parts.join('\n');
}

// Načíst uložený feedback pro daný typ generátoru
function getFeedbackForType(type: string): string {
  try {
    const saved = localStorage.getItem('generator_feedback');
    console.log('[Feedback] Raw localStorage:', saved);
    if (!saved) {
      console.log('[Feedback] No feedback found in localStorage');
      return '';
    }
    
    const feedbackHistory = JSON.parse(saved);
    console.log('[Feedback] Parsed history:', feedbackHistory);
    const feedbackList = feedbackHistory[type] || [];
    console.log(`[Feedback] For type "${type}":`, feedbackList);
    
    if (feedbackList.length === 0) {
      console.log('[Feedback] No feedback for this type');
      return '';
    }
    
    const result = `\n\nDŮLEŽITÉ POKYNY OD UŽIVATELE (musíš je respektovat!):\n${feedbackList.map((f: string) => `- ${f}`).join('\n')}`;
    console.log('[Feedback] Adding to prompt:', result);
    return result;
  } catch (e) {
    console.error('[Feedback] Error:', e);
    return '';
  }
}

function getImage(dataSet: TopicDataSet, index: number = 0): string | undefined {
  const images = dataSet.media?.images || [];
  if (images.length === 0) return undefined;
  return images[index % images.length]?.url;
}

/**
 * Robustní normalizace AI výstupu na náš formát bloků
 */
function normalizeWorksheetResponse(text: string): string {
  const output: string[] = [];
  const lines = text.split('\n');
  
  let i = 0;
  let hasHeader = false;
  
  // Přidej HEADER na začátek
  output.push('HEADER:');
  output.push('');
  hasHeader = true;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Prázdný řádek - přeskočit
    if (!line) {
      i++;
      continue;
    }
    
    // Už má správný formát - ponechat
    if (/^(HEADER|FOOTER|HEADING|PARAGRAPH|INFOBOX|OBRÁZEK|IMAGE|MULTIPLE-CHOICE|FILL-BLANK|FREE-ANSWER|CONNECT-PAIRS|TABLE):/i.test(line)) {
      // Přeskočit HEADER pokud už máme
      if (line.toUpperCase().startsWith('HEADER:') && hasHeader) {
        i++;
        continue;
      }
      output.push('');
      output.push(line);
      i++;
      continue;
    }
    
    // # Nadpis -> HEADING:
    if (line.startsWith('#')) {
      const headingText = line.replace(/^#+\s*/, '').trim();
      output.push('');
      output.push(`HEADING: ${headingText}`);
      i++;
      continue;
    }
    
    // ❓ Otázka -> MULTIPLE-CHOICE:
    if (line.startsWith('❓') || /^[0-9]+\.\s*❓/.test(line)) {
      const question = line.replace(/^[0-9]*\.?\s*❓\s*/, '').trim();
      output.push('');
      output.push('MULTIPLE-CHOICE:');
      output.push(question);
      i++;
      
      // Načíst možnosti A) B) C) D)
      while (i < lines.length) {
        const optLine = lines[i].trim();
        if (/^[A-D]\)/.test(optLine)) {
          output.push(optLine);
          i++;
        } else {
          break;
        }
      }
      continue;
    }
    
    // 📝 Doplň -> FILL-BLANK:
    if (line.startsWith('📝') || line.toLowerCase().includes('doplň:')) {
      let fillText = line.replace(/^[0-9]*\.?\s*📝\s*(Doplň:?\s*)?/i, '').trim();
      fillText = fillText.replace(/^Doplň:?\s*/i, '').trim();
      
      // Pokud obsahuje ___ a =, je to kompletní
      if (fillText.includes('___') && fillText.includes('=')) {
        output.push('');
        output.push('FILL-BLANK:');
        output.push(fillText);
      } else if (fillText.includes('___')) {
        // Bez odpovědi - zkusíme najít odpověď v závorce
        const match = fillText.match(/\(([^)]+)\)/);
        if (match) {
          const answer = match[1];
          fillText = fillText.replace(/\([^)]+\)/, '');
          output.push('');
          output.push('FILL-BLANK:');
          output.push(`${fillText.trim()} = ${answer}`);
        } else {
          output.push('');
          output.push('FILL-BLANK:');
          output.push(`${fillText} = ???`);
        }
      } else {
        // Text obsahuje mezeru na doplnění v závorkách?
        output.push('');
        output.push('FILL-BLANK:');
        output.push(fillText.includes('=') ? fillText : `${fillText} = ???`);
      }
      i++;
      continue;
    }
    
    // ✍️ Otázka -> FREE-ANSWER:
    if (line.startsWith('✍️')) {
      const question = line.replace(/^[0-9]*\.?\s*✍️\s*/, '').trim();
      output.push('');
      output.push('FREE-ANSWER:');
      output.push(question);
      i++;
      continue;
    }
    
    // **Pojem:** Definice -> INFOBOX:
    if (line.startsWith('**') && line.includes(':**')) {
      const infoText = line.replace(/\*\*/g, '').replace(/:/, ' - ');
      output.push('');
      output.push('INFOBOX:');
      output.push(infoText);
      i++;
      continue;
    }
    
    // Zpětná vazba -> FOOTER:
    if (line.toLowerCase().includes('zpětná vazba') || line.includes('😊') || line.includes('😐') || line.includes('☹️')) {
      output.push('');
      output.push('FOOTER:');
      output.push(line);
      i++;
      // Načíst další řádky patřící k footeru
      while (i < lines.length) {
        const nextLine = lines[i].trim();
        if (!nextLine) break;
        output.push(nextLine);
        i++;
      }
      continue;
    }
    
    // Jméno/Třída/Známka -> přeskočit (už máme HEADER)
    if (line.toLowerCase().includes('jméno') && line.includes('třída')) {
      i++;
      continue;
    }
    
    // Pojem: Definice (na samostatném řádku, krátký) -> INFOBOX:
    if (/^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž\s]+:/.test(line) && line.length < 150 && !line.toLowerCase().includes('poznámky')) {
      output.push('');
      output.push('INFOBOX:');
      output.push(line.replace(':', ' -'));
      i++;
      continue;
    }
    
    // Dlouhý text (>80 znaků) -> PARAGRAPH:
    if (line.length > 80) {
      output.push('');
      output.push('PARAGRAPH:');
      output.push(line);
      i++;
      
      // Přidat následující řádky dokud nenarazíme na nový blok
      while (i < lines.length) {
        const nextLine = lines[i].trim();
        if (!nextLine) break;
        if (/^(#|❓|📝|✍️|\*\*|[A-D]\)|HEADER|FOOTER|HEADING|PARAGRAPH)/i.test(nextLine)) break;
        if (nextLine.length < 30) break; // Krátký řádek = konec odstavce
        output.push(nextLine);
        i++;
      }
      continue;
    }
    
    // Krátký text - přeskočit nebo přidat k předchozímu
    i++;
  }
  
  // Přidej FOOTER na konec
  output.push('');
  output.push('FOOTER:');
  
  return output.join('\n');
}

// =====================================================
// BOARD GENERATOR - Textový přístup
// =====================================================

async function generateBoard(dataSet: TopicDataSet, difficulty: 'easy' | 'hard'): Promise<GenerateResult> {
  console.log(`[Generator] Generating board (${difficulty})...`);
  
  const context = buildContext(dataSet);
  const questionCount = difficulty === 'easy' ? 5 : 6;
  
  const feedback = getFeedbackForType(difficulty === 'easy' ? 'board-easy' : 'board-hard');
  
  // Připravit seznamy obrázků a ilustrací
  const images = dataSet.media?.images || [];
  const illustrations = dataSet.media?.generatedIllustrations || [];
  
  let mediaSection = '';
  if (images.length > 0) {
    mediaSection += `\n🖼️ DOSTUPNÉ OBRÁZKY:\n${images.map((img, i) => `  ${i + 1}. "${img.title}"`).join('\n')}`;
  }
  if (illustrations.length > 0) {
    mediaSection += `\n🎨 DOSTUPNÉ ILUSTRACE:\n${illustrations.map((ill, i) => `  ${i + 1}. "${ill.name}"`).join('\n')}`;
  }
  
  console.log(`[Generator] Board media: ${images.length} images, ${illustrations.length} illustrations`);
  
  // Pokud je feedback, přidej ho jako prioritní instrukce
  const prompt = `Vytvoř interaktivní procvičování k tématu "${dataSet.topic}" pro ${dataSet.grade}. třídu.
Obtížnost: ${difficulty === 'easy' ? 'lehká' : 'těžší'}

${context}
${feedback ? feedback : ''}
${mediaSection}

===== STRUKTURA PROCVIČOVÁNÍ =====
Vygeneruj mix aktivit v tomto pořadí:
1. ${questionCount - 2}x ABC OTÁZKA (většina)
2. 1x SPOJOVAČKA (propojování dvojic)
3. 1x DOPLŇOVAČKA (doplnění slov do mezer)

===== FORMÁTY =====

ABC OTÁZKA:
OTÁZKA: Text otázky?
A) možnost
B) správná odpověď *
C) možnost
D) možnost

${(images.length > 0 || illustrations.length > 0) ? `ABC OTÁZKA S OBRÁZKEM (použij název z 🖼️ OBRÁZKY nebo 🎨 ILUSTRACE):
OTÁZKA: Co je na tomto obrázku?
OBRÁZEK: Řecká helma hoplíta
A) Špatná odpověď
B) Správná odpověď *
C) Špatná odpověď
D) Špatná odpověď` : ''}

SPOJOVAČKA (4 dvojice):
SPOJOVAČKA: Spoj správné dvojice
Pojem1 | Význam1
Pojem2 | Význam2
Pojem3 | Význam3
Pojem4 | Význam4

DOPLŇOVAČKA (2-3 věty):
DOPLŇOVAČKA: Doplň chybějící slova
Text věty s ___ mezerou. = správná odpověď
Další věta s ___. = odpověď

===== PRAVIDLA PRO OBRÁZKY =====
${(images.length > 0 || illustrations.length > 0) ? `- K 1-2 ABC otázkám SMÍŠ přidat obrázek — použij PŘESNÝ název ze seznamu výše
- Můžeš použít obrázky (🖼️) i ilustrace (🎨)
- Formát: OBRÁZEK: Přesný název ze seznamu` : `- ŽÁDNÉ obrázky nejsou k dispozici — ABSOLUTNĚ ZAKAZUJI:
  - Nepiš "na tomto obrázku", "na ilustraci", "co vidíš na obrázku"
  - Nepoužívej formát OBRÁZEK: ...
  - Pátej POUZE textové otázky bez jakéhokoliv odkazu na vizuální materiály`}

ZAČNI GENEROVAT:`;

  console.log('[Generator] Board prompt:', prompt);

  try {
    const response = await chatWithAIProxy(
      [{ role: 'user', content: prompt }],
      'gemini-3-flash',
      { temperature: 0.7, max_tokens: 4096 }
    );
    
    // Parsovat textovou odpověď na slidy
    const slides = parseTextToSlides(response, dataSet, difficulty);
    
    if (slides.length === 0) {
      throw new Error('Nepodařilo se parsovat otázky z odpovědi');
    }
    
    const quizId = `quiz-${Date.now()}`;
    
    const quiz: Quiz = {
      id: quizId,
      title: `${dataSet.topic} - ${difficulty === 'easy' ? 'Lehké' : 'Těžké'} procvičování`,
      slides,
      settings: {
        showPoints: true,
        allowBack: true,
        shuffleSlides: false,
        shuffleOptions: difficulty === 'hard',
        timeLimit: null,
        passingScore: 60,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceDatasetId: dataSet.id,
    };
    
    // Uložit - localStorage může selhat, proto přímý sync do Supabase
    try {
      _saveQz(quiz);
    } catch (e) {
      console.warn(`[Generator] localStorage failed for board ${quizId}:`, e);
    }
    
    // Přímý sync do Supabase (nezávisí na localStorage)
    const synced = await _syncQz(quiz);
    if (!synced) {
      console.warn(`[Generator] Supabase sync failed for board ${quizId}`);
    }
    
    // Vytvořit textový náhled
    const preview = slides.map((slide, i) => {
      const s = slide as any;
      
      // ABC otázka
      if (s.activityType === 'abc' && s.question && s.options) {
        const imageUrl = s.media?.url;
        const imageText = imageUrl ? `\n🖼️ Obrázek: ${imageUrl.split('/').pop()?.split('?')[0] || 'přiložen'}` : '';
        const optionsText = s.options.map((o: any) => 
          `${o.label}) ${o.content}${o.isCorrect ? ' ✓' : ''}`
        ).join('\n');
        return `**ABC otázka ${i + 1}:** ${s.question}${imageText}\n${optionsText}`;
      }
      
      // Spojovačka
      if (s.activityType === 'connect-pairs' && s.pairs) {
        const pairsText = s.pairs.map((p: any) => 
          `${p.left?.content || ''} ↔ ${p.right?.content || ''}`
        ).join('\n');
        return `**🔗 Spojovačka:** ${s.instruction || 'Spoj dvojice'}\n${pairsText}`;
      }
      
      // Doplňovačka
      if (s.activityType === 'fill-blanks' && s.sentences) {
        const sentencesText = s.sentences.map((sent: any) => {
          const answer = sent.blanks?.[0]?.text || '';
          return `${sent.text?.replace(/\[.*?\]/g, '___')} = ${answer}`;
        }).join('\n');
        return `**✏️ Doplňovačka:** ${s.instruction || 'Doplň slova'}\n${sentencesText}`;
      }
      
      return '';
    }).filter(Boolean).join('\n\n');
    
    console.log('[Generator] Board saved:', quizId, 'with', slides.length, 'slides');
    return { success: true, id: quizId, preview };
  } catch (err) {
    console.error('[Generator] Board error:', err);
    return { success: false, error: String(err) };
  }
}

function parseTextToSlides(text: string, dataSet: TopicDataSet, difficulty: string): QuizSlide[] {
  const slides: QuizSlide[] = [];
  
  // Rozdělit na bloky podle typu aktivity
  const blocks = text.split(/(?=OTÁZKA:|SPOJOVAČKA:|DOPLŇOVAČKA:)/i).filter(block => block.trim());
  
  blocks.forEach((block) => {
    const lines = block.trim().split('\n').filter(line => line.trim());
    if (lines.length < 2) return;
    
    const firstLine = lines[0].trim();
    
    // === SPOJOVAČKA ===
    if (firstLine.match(/^SPOJOVAČKA:/i)) {
      const instruction = firstLine.replace(/^SPOJOVAČKA:\s*/i, '').trim() || 'Spoj správné dvojice';
      const pairs: { id: string; left: { id: string; type: 'text'; content: string }; right: { id: string; type: 'text'; content: string } }[] = [];
      
      lines.slice(1).forEach((line, i) => {
        const pairMatch = line.match(/^(.+?)\s*\|\s*(.+)$/);
        if (pairMatch) {
          pairs.push({
            id: `pair-${i + 1}`,
            left: { id: `left-${i + 1}`, type: 'text', content: pairMatch[1].trim() },
            right: { id: `right-${i + 1}`, type: 'text', content: pairMatch[2].trim() },
          });
        }
      });
      
      if (pairs.length >= 2) {
        slides.push({
          ...createConnectPairsSlide(slides.length),
          instruction,
          pairs,
        });
        console.log('[Parser] ✅ Created connect-pairs slide with', pairs.length, 'pairs');
      }
      return;
    }
    
    // === DOPLŇOVAČKA ===
    if (firstLine.match(/^DOPLŇOVAČKA:/i)) {
      const instruction = firstLine.replace(/^DOPLŇOVAČKA:\s*/i, '').trim() || 'Doplň chybějící slova';
      const sentences: { id: string; text: string; blanks: { id: string; text: string; position: number }[] }[] = [];
      
      lines.slice(1).forEach((line, i) => {
        // Formát: "Věta s ___ mezerou. = odpověď"
        const sentenceMatch = line.match(/^(.+?___.*?)\s*=\s*(.+)$/);
        if (sentenceMatch) {
          const originalText = sentenceMatch[1].trim();
          const answer = sentenceMatch[2].trim();
          const blankId = `blank-${i + 1}`;
          
          // Najít pozici ___
          const position = originalText.indexOf('___');
          
          // Nahradit ___ za [blank_id]
          const textWithBlanks = originalText.replace(/___/, `[${blankId}]`);
          
          sentences.push({
            id: `sentence-${i + 1}`,
            text: textWithBlanks,
            blanks: [{ id: blankId, text: answer, position }],
          });
        }
      });
      
      if (sentences.length >= 1) {
        slides.push({
          ...createFillBlanksSlide(slides.length),
          instruction,
          sentences,
          distractors: [],
        });
        console.log('[Parser] ✅ Created fill-blanks slide with', sentences.length, 'sentences');
      }
      return;
    }
    
    // === ABC OTÁZKA ===
    if (firstLine.match(/^OTÁZKA:/i)) {
      const questionText = firstLine.replace(/^OTÁZKA:\s*/i, '').trim();
      let questionImage: string | undefined = undefined;
      const options: { id: string; label: string; content: string; isCorrect: boolean }[] = [];
      
      // Hledat obrázek nebo ilustraci v bloku
      for (const line of lines) {
        const imageMatch = line.match(/^OBRÁZEK:\s*(.+)/i);
        if (imageMatch) {
          const imageName = imageMatch[1].trim().toLowerCase();
          
          // Hledat v obrázcích
          const foundImage = dataSet.media?.images?.find(img => {
            const imgTitle = (img.title || '').toLowerCase();
            return imgTitle === imageName ||
                   imgTitle.includes(imageName) ||
                   imageName.includes(imgTitle) ||
                   imgTitle.replace(/[^a-z0-9]/g, '').includes(imageName.replace(/[^a-z0-9]/g, '')) ||
                   imageName.replace(/[^a-z0-9]/g, '').includes(imgTitle.replace(/[^a-z0-9]/g, ''));
          });
          
          if (foundImage?.url) {
            questionImage = foundImage.url;
            console.log('[Parser] ✅ Found image:', imageName);
          } else {
            // Hledat v ilustracích
            const foundIll = dataSet.media?.generatedIllustrations?.find(ill => {
              const illName = (ill.name || '').toLowerCase();
              return illName === imageName ||
                     illName.includes(imageName) ||
                     imageName.includes(illName) ||
                     illName.replace(/[^a-z0-9]/g, '').includes(imageName.replace(/[^a-z0-9]/g, '')) ||
                     imageName.replace(/[^a-z0-9]/g, '').includes(illName.replace(/[^a-z0-9]/g, ''));
            });
            
            if (foundIll?.url) {
              questionImage = foundIll.url;
              console.log('[Parser] ✅ Found illustration:', imageName, '->', foundIll.name);
            }
          }
        }
      }
      
      // Parsovat možnosti A) B) C) D)
      lines.forEach((line) => {
        const match = line.match(/^([A-D])\)\s*(.+)/i);
        if (match) {
          const label = match[1].toUpperCase();
          let content = match[2].trim();
          const isCorrect = content.endsWith('*');
          if (isCorrect) {
            content = content.slice(0, -1).trim();
          }
          options.push({
            id: label.toLowerCase(),
            label,
            content,
            isCorrect,
          });
        }
      });
      
      // Pokud nejsou žádné správné odpovědi, označit první jako správnou
      if (options.length > 0 && !options.some(o => o.isCorrect)) {
        options[0].isCorrect = true;
      }
      
      if (options.length >= 2) {
        slides.push({
          ...createABCSlide(slides.length),
          question: questionText,
          options,
          points: difficulty === 'easy' ? 1 : 2,
          ...(questionImage ? { media: { type: 'image' as const, url: questionImage } } : {}),
        });
        console.log('[Parser] ✅ Created ABC slide:', questionText.substring(0, 30));
      }
    }
  });
  
  return slides;
}

// =====================================================
// WORKSHEET GENERATOR - Dvou-agentní pipeline
// Agent 1: Obsahový (ContentPlan) → Agent 2: Designový (bloky)
// =====================================================

async function generateWorksheet(dataSet: TopicDataSet, onProgress?: ProgressCallback): Promise<GenerateResult> {
  console.log('[Generator] Starting two-agent worksheet pipeline...');

  // ── 0. RAG vyhledávání ──────────────────────────────────────────────────
  onProgress?.('rag', 'Hledám podobné pracovní listy v RAG databázi...');
  const keyTerms = dataSet.content?.keyTerms?.map((t: any) => t.term) ?? [];
  const ragExamples = await searchRagExamples({
    topic: dataSet.topic,
    subject: dataSet.subjectCode,
    grade: dataSet.grade,
    keyTerms,
    matchCount: 3,
  });
  const ragSection = formatRagExamplesForPrompt(ragExamples);
  console.log(`[Generator] RAG: ${ragExamples.length} examples found`);
  onProgress?.('rag-done', `RAG: nalezeno ${ragExamples.length} podobných listů`, { examples: ragExamples, ragSection });

  // ── 1. Agent 1: Obsahový planer ─────────────────────────────────────────
  onProgress?.('agent1', 'Agent 1: Plánuji obsah (sekce, cvičení, obrázky)...');
  const contentPlan = await runContentAgent(dataSet, ragSection);
  if (!contentPlan) {
    console.warn('[Generator] Agent 1 failed, falling back to legacy generator');
    onProgress?.('fallback', 'Agent 1 selhal → záložní generátor');
    return { ...(await generateWorksheetLegacy(dataSet)), generationMethod: 'legacy' };
  }
  console.log('[Generator] Agent 1 done, sections:', contentPlan.sections.length);
  onProgress?.('agent1-done', `Agent 1 ✅ — ${contentPlan.sections.length} sekcí, obtížnost: ${contentPlan.difficulty}, ${contentPlan.estimatedTimeMinutes} min`);

  // ── 2. Agent 2: Designový ────────────────────────────────────────────────
  onProgress?.('agent2', 'Agent 2: Navrhuji layout a rozmísťuji bloky...');
  const { text: layoutText } = await runLayoutAgent(dataSet, contentPlan, ragSection, 'worksheet', ragExamples, onProgress);
  if (!layoutText) {
    console.warn('[Generator] Agent 2 failed, falling back to legacy generator');
    onProgress?.('fallback', 'Agent 2 selhal → záložní generátor');
    return { ...(await generateWorksheetLegacy(dataSet)), generationMethod: 'legacy' };
  }
  console.log('[Generator] Agent 2 done, layout text length:', layoutText.length);
  onProgress?.('agent2-done', `Agent 2 ✅ — layout připraven (${layoutText.length} znaků)`);

  // ── 3. Parsuj bloky a ulož ───────────────────────────────────────────────
  const blocks = parseTextToWorksheetBlocks(layoutText, dataSet);
  const worksheetId = `worksheet-${Date.now()}`;

  const worksheet: Worksheet = {
    id: worksheetId,
    title: contentPlan.title || `${dataSet.topic} - Pracovní list`,
    blocks,
    settings: {
      showAnswerKey: true,
      pageSize: 'A4',
      margins: 'normal',
    },
    metadata: {
      subject: dataSet.subjectCode,
      grade: dataSet.grade,
      topic: dataSet.topic,
      estimatedTime: contentPlan.estimatedTimeMinutes,
      sourceDatasetId: dataSet.id,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  onProgress?.('saving', 'Ukládám pracovní list...');
  _saveWs(worksheet);
  console.log('[Generator] Worksheet saved:', worksheetId);
  onProgress?.('done', `Hotovo ✅ — uloženo ${blocks.length} bloků`);
  return { success: true, id: worksheetId, preview: layoutText, generationMethod: 'two-agent', contentPlan };
}

// ── Agent 1: Obsahový planer ─────────────────────────────────────────────────
async function runContentAgent(
  dataSet: TopicDataSet,
  ragSection: string,
  mode: 'worksheet' | 'textbook' = 'worksheet',
  sourceTextContent?: string
): Promise<ContentPlan | null> {
  const context = buildContext(dataSet);

  const images = dataSet.media?.images ?? [];
  const illustrations = dataSet.media?.generatedIllustrations ?? [];
  const imageList = [
    ...images.map((img: any, i: number) =>
      `[OBRAZ-${i}] url="${img.url}" title="${img.title}" popis="${img.description || ''}"`
    ),
    ...illustrations.map((ill: any, i: number) =>
      `[ILUSTRACE-${i}] url="${ill.url || ''}" title="${ill.name || ill.title || ''}" popis="${ill.description || ''}"`
    ),
  ].join('\n');

  const modeInstructions = mode === 'textbook' ? `
## PRAVIDLA PRO LIST UČEBNICE
- Toto je UČEBNÍ TEXT (stránka z učebnice), NE pracovní list s úkoly
- Hlavní obsah: čtivé výkladové texty, vysvětlení pojmů, příběhy osobností, zajímavosti
- Obrázky: POVINNĚ vyber 2-4 obrázky z datasetu — jsou klíčové pro učebnicový styl
- Cvičení: MAX 1-2 krátká cvičení na konci (connect-pairs nebo fill-blank), zbytek je text
- Sekce: 5-8 sekcí, převaha "reading", "intro", "timeline", "vocabulary"
- Styl: přístupný, zajímavý, jako dobrá učebnice — ne suchý výčet faktů
- Délka textů: obsáhlejší odstavce (8-15 vět), ne krátké bullet pointy
- Konec: "summary" sekce s klíčovými poznatky
- Vyber VŠECHNY dobré obrázky z datasetu — čím více, tím lepší (priorita: historické fotky, mapy, portréty osobností)
` : `
## PRAVIDLA PRO PRACOVNÍ LIST
- Vždy začni s "intro" sekcí (shrnutí tématu)
- Zahrni sekci "vocabulary" pro klíčové pojmy
- Mix cvičení: alespoň 2 různé typy (multiple-choice, fill-blank, connect-pairs, free-answer)
- Konec: "summary" sekce
- Obrázky z datasetu jsou primární zdroj
- Pro selectedImages použij přesné url z dostupných obrázků
`;

  const docLabel = mode === 'textbook' ? 'stránky učebnice' : 'pracovního listu';

  const sourceTextSection = (mode === 'textbook' && sourceTextContent)
    ? `\n## ⭐ ZDROJOVÝ UČEBNÍ TEXT (PRIORITNÍ ZDROJ)\nNíže je učební text který byl pro toto téma vygenerován. Použij ho jako HLAVNÍ ZDROJ obsahu — zachovej stejná fakta, stejnou terminologii, stejnou strukturu výkladu. Jen uprav formát do podoby vizuálně bohaté stránky učebnice.\n\n${sourceTextContent.substring(0, 6000)}\n`
    : '';

  const prompt = `Jsi pedagogický expert. Vytvoř plán obsahu ${docLabel} pro žáky.

${ragSection}

## VSTUPNÍ DATA
Téma: ${dataSet.topic}
Předmět: ${dataSet.subjectCode || 'Dějepis'}
Ročník: ${dataSet.grade}. třída
${sourceTextSection}
## OBSAH Z DATASETU
${context}

## DOSTUPNÉ OBRÁZKY A ILUSTRACE
${imageList || 'Žádné obrázky nejsou dostupné.'}

${modeInstructions}

## ÚKOL
⚠️ ZÁVAZNÉ: Pokud jsou výše uvedeny vzory (VZOR 1, VZOR 2...), plán MUSÍ odpovídat jejich rozsahu a struktuře. Počet sekcí, typy cvičení a výběr obrázků kopíruj ze vzorů!

Vytvoř ContentPlan jako JSON:
1. title — hlavní název
2. learningGoal — co žák po přečtení/vyplnění umí
3. difficulty — "easy" | "medium" | "hard"
4. estimatedTimeMinutes — odhadovaný čas
5. selectedImages — ${mode === 'textbook' ? '2-4 obrázky' : '1-3 obrázky'} z dostupných (přesné URL)
6. sections — ${mode === 'textbook' ? '5-8' : '6-10'} sekcí (podle vzorů výše)

Pro každou sekci:
- type: "intro" | "vocabulary" | "exercise-multiple-choice" | "exercise-fill-blank" | "exercise-free-answer" | "exercise-connect-pairs" | "timeline" | "reading" | "summary"
- title, content, items (pole), layoutHint (nápověda pro designéra — odvoď z layoutu vzorů)

Výstup: POUZE validní JSON, žádný jiný text.

\`\`\`json
{
  "title": "...",
  "learningGoal": "...",
  "difficulty": "medium",
  "estimatedTimeMinutes": 45,
  "selectedImages": [
    {
      "url": "...",
      "title": "...",
      "description": "...",
      "suggestedPlacement": "intro",
      "sectionIndex": 0,
      "sectionHint": "..."
    }
  ],
  "sections": [
    {
      "type": "intro",
      "title": "...",
      "content": "...",
      "items": [],
      "layoutHint": "..."
    }
  ]
}
\`\`\``;

  try {
    const response = await chatWithAIProxy(
      [
        { role: 'system', content: 'Jsi expert na tvorbu vzdělávacích materiálů. Odpovídáš VÝHRADNĚ validním JSON objektem dle zadané struktury. Žádný jiný text.' },
        { role: 'user', content: prompt },
      ],
      'gemini-3-pro',
      { temperature: 0.4, max_tokens: 8192 }
    );

    // Robustní extrakce JSON — Gemini občas přidá text před/za JSON
    let jsonStr = response.trim();

    // 1. zkus ```json ... ```
    const fencedMatch = jsonStr.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (fencedMatch) {
      jsonStr = fencedMatch[1].trim();
    } else {
      // 2. najdi první { a poslední } — vezmi vše mezi nimi
      const start = jsonStr.indexOf('{');
      const end = jsonStr.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        jsonStr = jsonStr.slice(start, end + 1);
      }
    }

    console.log('[Agent 1] Parsing JSON, length:', jsonStr.length, 'preview:', jsonStr.substring(0, 200));
    const plan = JSON.parse(jsonStr) as ContentPlan;

    // Validace minimální struktury
    if (!plan.sections || !Array.isArray(plan.sections) || plan.sections.length === 0) {
      console.error('[Agent 1] ContentPlan has no sections');
      return null;
    }

    return plan;
  } catch (err) {
    console.error('[Agent 1] Failed to parse ContentPlan:', err);
    console.error('[Agent 1] Raw response (first 500):', response?.substring(0, 500));
    return null;
  }
}

// ── Agent 2: Designový / Layout Designer ────────────────────────────────────

/**
 * Returns the selected template (first matching layout) or null.
 * Checks both built-in TEXTBOOK_LAYOUTS and custom layouts from localStorage.
 */
function getSelectedTemplate(selectedLayoutIds: string[]): import('../textbook-layouts').TextbookLayout | null {
  if (selectedLayoutIds.length === 0) return null;
  const targetId = selectedLayoutIds[0];
  // Built-in layouts
  const builtIn = TEXTBOOK_LAYOUTS.find(l => l.id === targetId);
  if (builtIn) return builtIn;
  // Custom layouts from localStorage
  try {
    const custom: import('../textbook-layouts').TextbookLayout[] = JSON.parse(localStorage.getItem('vividbooks_custom_layouts') || '[]');
    return custom.find(l => l.id === targetId) ?? null;
  } catch { return null; }
}

async function runLayoutAgent(
  dataSet: TopicDataSet,
  contentPlan: ContentPlan,
  ragSection: string,
  mode: 'worksheet' | 'textbook' = 'worksheet',
  ragExamples: RagExample[] = [],
  onProgress?: ProgressCallback,
  selectedLayoutIds: string[] = []
): Promise<{ blocks?: WorksheetBlock[]; text?: string; template: import('../textbook-layouts').TemplateSlot[] | null }> {

  // ── Template-fill mode: a layout is selected ────────────────────────────
  const selectedLayout = getSelectedTemplate(selectedLayoutIds);
  console.log('[Agent 2] selectedLayoutIds:', selectedLayoutIds, '→ template:', selectedLayout?.id ?? 'none (free-form)');

  if (selectedLayout && mode === 'textbook') {
    console.log('[Agent 2] ✅ Template-fill mode — layout:', selectedLayout.name, `(${selectedLayout.template.length} slotů)`);
    const { blocks, template } = await runTemplateFillAgent(dataSet, contentPlan, selectedLayout, onProgress);
    return { blocks, template };
  }

  // ── Free-form mode (existing logic) ───────────────────────────────────────
  console.log('[Agent 2] 🔄 Free-form mode (no template selected or worksheet mode)');
  const freeFormText = await runFreeFormLayoutAgent(
    dataSet, contentPlan, ragSection, mode, ragExamples, onProgress, selectedLayoutIds
  );
  return { text: freeFormText ?? '', template: null };
}

/**
 * Template-fill mode: structure is 100% from the template, AI only returns JSON content.
 *
 * Steps:
 * 1. Build all WorksheetBlocks from the template (structure guaranteed).
 * 2. Ask AI to fill just the text/URL content for each non-fixed slot (JSON response).
 * 3. Merge AI content into the pre-built blocks.
 *
 * Returns blocks directly — no text parsing needed.
 */
async function runTemplateFillAgent(
  dataSet: TopicDataSet,
  contentPlan: ContentPlan,
  layout: import('../textbook-layouts').TextbookLayout,
  onProgress?: ProgressCallback
): Promise<{ blocks: WorksheetBlock[]; template: import('../textbook-layouts').TemplateSlot[] }> {

  // ── Collect media ──────────────────────────────────────────────────────────
  const allMedia = [
    ...(dataSet.media?.generatedIllustrations || []),
    ...(dataSet.media?.generatedPhotos || []),
    ...(dataSet.media?.images || []),
  ];

  const imageList = allMedia.length > 0
    ? allMedia.map((m: any) => `- ${m.url || ''} (${m.title || m.name || 'bez názvu'})`).join('\n')
    : '(žádné obrázky)';

  // ── Full content from ContentPlan (no truncation!) ─────────────────────────
  const contentSummary = contentPlan.sections.map((s, i) =>
    `${i + 1}. [${s.type}] "${s.title}"\nObsah: ${s.content}`
  ).join('\n\n');

  // ── Build slot list for AI (only non-fixed slots) ──────────────────────────
  const fillableSlots = layout.template.filter(s => !s.fixed);
  const slotList = fillableSlots.map(s => {
    const typeHint = s.type.toUpperCase();
    const widthHint = s.width === 'half' ? ' [polovina šíře]' : '';
    const imgHint = s.imageSlot ? ' → vrať URL obrázku z datasetu' : '';
    const formatHint: Record<string, string> = {
      'connect-pairs': ' → formát: "Pojem | Definice" (každý pár na nový řádek)',
      'fill-blank':    ' → formát: "věta s ___ mezerou = odpověď"',
      'multiple-choice': ' → formát: "Otázka?\\nA) možnost\\nB) správná *\\nC) možnost"',
      'table':         ' → formát: "Záhlaví A | Záhlaví B\\nHodnota 1 | Hodnota 2"',
      'free-answer':   ' → vrať text otázky',
      'heading-h1':    ' → 2-5 slov',
      'heading':       ' → 3-6 slov',
    };
    const extra = imgHint || formatHint[s.type] || '';
    return `  "${s.id}": "${typeHint}${widthHint} — ${s.role}${extra}"`;
  }).join(',\n');

  const prompt = `Vyplňuješ stránku učebnice "${dataSet.topic}" (${dataSet.subjectCode}, ${dataSet.grade}. třída).

## UČEBNÍ TEXT — použij tento obsah v plném rozsahu:
${contentSummary}

## DOSTUPNÉ OBRÁZKY (pro IMAGE sloty vrať přesné URL):
${imageList}

## ÚKOL
Rozděl výše uvedený učební text do slotů šablony. NEKRAŤ, NEPŘEPISUJ — použij přímo dodaný obsah.
Pro odstavce (PARAGRAPH) použij celé pasáže z učebního textu, ne jen shrnutí.
Pro nadpisy (HEADING) použij nadpisy z učebního textu.
Pro infobox, connect-pairs atd. extrahuj relevantní data z textu.

Vrať POUZE validní JSON (bez markdown backticks):
{
${slotList}
}

PRAVIDLA:
- Použij přesně dodaný text, nevymýšlej vlastní
- Pro PARAGRAPH sloty: plné odstavce (5–10 vět), ne zkráceniny
- Pro IMAGE sloty: vrať přesné URL ze seznamu výše
- Nevynechej žádný klíč
- Piš v češtině`;

  onProgress?.('agent2-prompt', `Template-fill JSON prompt (${prompt.length} znaků)`, { prompt });

  // ── Ask AI for JSON content ────────────────────────────────────────────────
  let contentMap: Record<string, string> = {};
  try {
    const response = await chatWithAIProxy(
      [
        {
          role: 'system',
          content: 'Jsi asistent vyplňující obsah do šablon učebnic. Vrať POUZE čistý JSON bez markdown. Žádný jiný text. Použij CELÝ dodaný obsah — nepřepisuj ho vlastními slovy, ale využij ho v plném rozsahu.',
        },
        { role: 'user', content: prompt },
      ],
      'gemini-3-pro',
      { temperature: 0.4, max_tokens: 8192 }
    );

    onProgress?.('agent2-raw', `JSON odpověď (${response.length} znaků)`, { raw: response });

    // Strip markdown fences if present
    const cleaned = response.replace(/```json?\s*/gi, '').replace(/```\s*/g, '').trim();
    contentMap = JSON.parse(cleaned);
    console.log('[Agent 2 Template] AI JSON parsed OK, keys:', Object.keys(contentMap).join(', '));
  } catch (err) {
    console.error('[Agent 2 Template] JSON parse failed:', err);
    // Fallback: build blocks from template with placeholder content
  }

  // ── Build blocks from template + AI content ────────────────────────────────
  const resolveImageUrl = (raw: string): { url: string; caption: string } => {
    const s = raw.trim();
    if (s.startsWith('http://') || s.startsWith('https://')) return { url: s, caption: '' };
    const nameLower = s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = allMedia.find((m: any) => {
      const title = ((m as any).title || (m as any).name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return title && (title.includes(nameLower) || nameLower.includes(title));
    });
    if (found) return { url: (found as any).url || '', caption: s };
    if (allMedia.length > 0) return { url: (allMedia[0] as any).url || '', caption: s };
    return { url: '', caption: s };
  };

  const blocks: WorksheetBlock[] = [];
  let order = 0;
  let i = 0;

  while (i < layout.template.length) {
    const slot = layout.template[i];
    const content = String(contentMap[String(slot.id)] ?? '');

    // Check if consecutive half-width slots → side-by-side
    const nextSlot = layout.template[i + 1];
    const isPair = slot.width === 'half' && nextSlot?.width === 'half';

    if (isPair) {
      const content2 = String(contentMap[String(nextSlot.id)] ?? '');
      blocks.push(makeTemplateBlock(slot, content, order++, 'half', dataSet, resolveImageUrl));
      blocks.push(makeTemplateBlock(nextSlot, content2, order++, 'half', dataSet, resolveImageUrl));
      i += 2;
    } else {
      blocks.push(makeTemplateBlock(slot, content, order++, slot.width, dataSet, resolveImageUrl));
      i++;
    }
  }

  console.log('[Agent 2 Template] Built', blocks.length, 'blocks from template:', layout.id);
  return { blocks, template: layout.template };
}

/**
 * Original free-form layout generation (existing logic, renamed).
 */
async function runFreeFormLayoutAgent(
  dataSet: TopicDataSet,
  contentPlan: ContentPlan,
  ragSection: string,
  mode: 'worksheet' | 'textbook' = 'worksheet',
  ragExamples: RagExample[] = [],
  onProgress?: ProgressCallback,
  selectedLayoutIds: string[] = []
): Promise<string | null> {

  // Sestavíme popis dostupných bloků pro designéra
  const blocksGuide = `
DOSTUPNÉ TYPY BLOKŮ (použij PŘESNĚ tato klíčová slova):

HEADER:
Jméno: ________________ Třída: ________ Datum: ________

HEADING-H1:
Hlavní nadpis (pouze jeden, na začátku)

HEADING:
Podnadpis sekce (H2)

PARAGRAPH:
Odstavec textu.

PARAGRAPH: HALF LAYOUT
Text na půl šířky (vedle obrázku nebo infoboxu).

INFOBOX:
Zvýrazněný rámeček s důležitou informací.

INFOBOX: HALF LAYOUT
Infobox na půl šířky.

OBRÁZEK: url obrázku nebo název
(Používej pro obrázky z datasetu)

TABLE:
Sloupec A | Sloupec B
Hodnota 1 | Hodnota 2

MULTIPLE-CHOICE:
Otázka?
A) možnost
B) správná odpověď *
C) možnost
D) možnost

FILL-BLANK:
Věta s ___ mezerou pro doplnění. = správná odpověď

FREE-ANSWER:
Otevřená otázka pro žáka?

CONNECT-PAIRS:
Pojem 1 | Definice 1
Pojem 2 | Definice 2
Pojem 3 | Definice 3

FOOTER:
Zpětná vazba: 😊 😐 ☹️

PRAVIDLA FORMÁTU:
- Typ bloku VŽDY VELKÝMI PÍSMENY + dvojtečka
- Obsah VŽDY na nových řádcích (nikoli na stejném jako typ)
- Prázdný řádek mezi bloky
- HEADING-H1 pouze jednou na začátku
- Začni VŽDY s "HEADER:"
`.trim();

  // Shrnutí ContentPlan pro designéra
  const contentSummary = contentPlan.sections.map((s, i) => {
    const imgForSection = contentPlan.selectedImages?.filter(img => img.sectionIndex === i) ?? [];
    const imgNote = imgForSection.length > 0
      ? `\n    → Obrázek: ${imgForSection.map(img => img.url).join(', ')} (${imgForSection[0].sectionHint || ''})`
      : '';
    return `${i + 1}. [${s.type}] "${s.title}"
   Obsah: ${s.content.substring(0, 200)}${s.content.length > 200 ? '...' : ''}
   ${s.items && s.items.length > 0 ? `Položky (${s.items.length}x): ${s.items.slice(0, 3).join(' | ')}${s.items.length > 3 ? '...' : ''}` : ''}
   Hint designu: ${s.layoutHint || '–'}${imgNote}`;
  }).join('\n\n');

  const layoutTemplate = formatRagAsLayoutTemplate(ragExamples);

  // Vybrané layout typy uživatelem
  const chosenLayouts = selectedLayoutIds.length > 0
    ? TEXTBOOK_LAYOUTS.filter(l => selectedLayoutIds.includes(l.id))
    : [];
  const selectedLayoutsSection = chosenLayouts.length > 0
    ? `## 🎯 UŽIVATELEM VYBRANÉ TYPY LAYOUTU — POVINNĚ POUŽIJ TYTO SEKVENCE BLOKŮ

Uživatel vybral ${chosenLayouts.length} typů layoutu. MUSÍŠ je zapracovat do stránky v tomto pořadí:
${layoutsToAgent2Prompt(chosenLayouts)}

⚠️ KAŽDÝ vybraný layout musí být na stránce zastoupen alespoň jednou.
⚠️ Bloky z každé sekce naplň obsahem z ContentPlan výše.
---`
    : '';

  const prompt = `Jsi expert na design vzdělávacích pracovních listů. Převeď ContentPlan do formátu bloků.

${ragSection}

${layoutTemplate}

${selectedLayoutsSection}

## OBSAH (od Agenta 1 — obsahového planera)
Název: ${contentPlan.title}
Cíl: ${contentPlan.learningGoal}
Obtížnost: ${contentPlan.difficulty}
Čas: ${contentPlan.estimatedTimeMinutes} minut

SEKCE:
${contentSummary}

## DOSTUPNÉ BLOKY A JEJICH FORMÁT
${blocksGuide}

## TVŮJ ÚKOL
Přepiš CELÝ ContentPlan do formátu bloků.

⚠️ PRIORITY (seřazeno od nejdůležitějšího):
1. STRUKTURÁLNÍ ŠABLONA výše — dodržuj počet a pořadí bloků
2. VZORY výše — pokud mají HALF LAYOUT, INFOBOX, cvičení, MUSÍŠ je také použít
3. Níže uvedená pravidla jsou jen doplňková — NESMÍ omezovat co říkají vzory

${mode === 'textbook' ? `### PRAVIDLA PRO LIST UČEBNICE (platí jen tam kde vzory neurčují jinak)
- Toto je STRÁNKA UČEBNICE — důraz na čtivý výklad, vizuální bohatost
- intro sekce → HEADING-H1 + PARAGRAPH (delší, 8-12 vět)
- reading sekce → střídej PARAGRAPH a PARAGRAPH: HALF LAYOUT + OBRÁZEK: HALF LAYOUT naproti
- Každá reading sekce by měla mít alespoň 1 PARAGRAPH: HALF LAYOUT + OBRÁZEK: HALF LAYOUT pár
- vocabulary sekce → TABLE (Pojem | Vysvětlení) nebo INFOBOX: HALF LAYOUT pro každý pojem
- timeline sekce → TABLE s roky nebo INFOBOX: HALF LAYOUT pro každou událost
- Obrázky: POVINNĚ umísti VŠECHNY obrázky z ContentPlan.selectedImages — VŽDY jako OBRÁZEK: HALF LAYOUT vedle textu
- Cvičení: zahrň TOLIK cvičení kolik ukazují vzory (CONNECT-PAIRS, FILL-BLANK, FREE-ANSWER, MULTIPLE-CHOICE)
- Přidej INFOBOX bloky pro zajímavosti — "Věděl jsi, že...", tipy, citáty
- summary sekce → INFOBOX se shrnutím klíčových poznatků
- Styl: vizuálně bohatý, jako moderní učebnice — NIKDY ne jednoduchý seznam odstavců` : `### PRAVIDLA PRO PRACOVNÍ LIST
- intro sekce → PARAGRAPH (nebo PARAGRAPH: HALF LAYOUT + OBRÁZEK vedle sebe)
- vocabulary sekce → TABLE (2 sloupce: Pojem | Definice)
- timeline sekce → TABLE nebo PARAGRAPH s chronologickým seznamem
- exercise-multiple-choice → MULTIPLE-CHOICE blok
- exercise-fill-blank → FILL-BLANK blok
- exercise-connect-pairs → CONNECT-PAIRS blok
- exercise-free-answer → FREE-ANSWER blok
- Pokud má sekce layoutHint "dvousloupec" → použij PARAGRAPH: HALF LAYOUT + INFOBOX: HALF LAYOUT
- Pokud má sekce layoutHint "infobox" → INFOBOX blok
- Pro obrázky: OBRÁZEK: [url z ContentPlan.selectedImages]
- Obrázky umísti vedle textu (PARAGRAPH: HALF LAYOUT + OBRÁZEK: ...)`}

Dodržuj přesný formát. Začni s HEADER:, konči FOOTER:.`;

  // Send the full prompt to UI for debugging
  onProgress?.('agent2-prompt', `Prompt Agent 2 (${prompt.length} znaků)`, { prompt });

  try {
    const response = await chatWithAIProxy(
      [
        {
          role: 'system',
          content: `Jsi designér ${mode === 'textbook' ? 'stránek učebnice' : 'pracovních listů'}. MUSÍŠ dodržet PŘESNÝ formát bloků.
ABSOLUTNÍ PRAVIDLA:
1. Každý blok MUSÍ začínat klíčovým slovem VELKÝMI PÍSMENY + dvojtečka
2. Obsah VŽDY na NOVÝCH ŘÁDCÍCH, prázdný řádek mezi bloky
3. Žádný Markdown (žádné #, **, _)
4. Začni VŽDY s "HEADER:"
5. HALF LAYOUT: "PARAGRAPH: HALF LAYOUT" a "OBRÁZEK: HALF LAYOUT" jsou vždy páry vedle sebe — použij je pro vizuální bohatost
6. Dodržuj STRUKTURÁLNÍ ŠABLONU a vzory — jsou závazné${mode === 'textbook' ? '\n7. Umísti KAŽDÝ obrázek z ContentPlan.selectedImages — žádný nevynechej\n8. NIKDY negeneruj méně než 18 bloků pro list učebnice' : ''}`,
        },
        { role: 'user', content: prompt },
      ],
      'gemini-3-pro',
      { temperature: 0.5, max_tokens: 8192 }
    );

    // Send raw response to UI for debugging
    onProgress?.('agent2-raw', `Raw výstup Agent 2 (${response.length} znaků)`, { raw: response });

    if (!response.trim().startsWith('HEADER:')) {
      return normalizeWorksheetResponse(response);
    }
    return response;
  } catch (err) {
    console.error('[Agent 2] Layout generation failed:', err);
    return null;
  }
}

// =====================================================
// TEXTBOOK PAGE GENERATOR - Dvou-agentní pipeline
// Jako worksheet, ale: více textu, více obrázků, méně úkolů
// =====================================================

async function generateTextbookPage(dataSet: TopicDataSet, onProgress?: ProgressCallback, sourceTextContent?: string): Promise<GenerateResult> {
  console.log('[Generator] Starting textbook page two-agent pipeline...');

  onProgress?.('rag', 'Hledám podobné listy učebnice v RAG databázi...');
  const keyTerms = dataSet.content?.keyTerms?.map((t: any) => t.term) ?? [];
  const ragExamples = await searchRagExamples({
    topic: dataSet.topic,
    subject: dataSet.subjectCode,
    grade: dataSet.grade,
    keyTerms,
    matchCount: 3,
  });
  const ragSection = formatRagExamplesForPrompt(ragExamples, 'textbook');
  onProgress?.('rag-done', `RAG: nalezeno ${ragExamples.length} podobných listů`, { examples: ragExamples, ragSection });

  onProgress?.('agent1', 'Agent 1: Plánuji obsah stránky učebnice...');
  const contentPlan = await runContentAgent(dataSet, ragSection, 'textbook', sourceTextContent);
  if (!contentPlan) {
    onProgress?.('fallback', 'Agent 1 selhal → záložní generátor');
    return { ...(await generateWorksheetLegacy(dataSet)), generationMethod: 'legacy' };
  }
  onProgress?.('agent1-done', `Agent 1 ✅ — ${contentPlan.sections.length} sekcí, ${contentPlan.estimatedTimeMinutes} min`);

  onProgress?.('agent2', 'Agent 2: Navrhuji vizuální layout stránky učebnice...');
  const layoutResult = await runLayoutAgent(dataSet, contentPlan, ragSection, 'textbook', ragExamples, onProgress);
  onProgress?.('agent2-done', `Agent 2 ✅ — layout připraven`);

  onProgress?.('saving', 'Ukládám list učebnice...');
  let blocks: WorksheetBlock[];
  if (layoutResult.blocks) {
    // Template-fill mode: blocks already built from template
    blocks = layoutResult.blocks;
  } else if (layoutResult.text) {
    // Free-form mode: parse text response
    const text = layoutResult.text;
    blocks = layoutResult.template
      ? fillTemplateWithContent(layoutResult.template, text, dataSet)
      : parseTextToWorksheetBlocks(text, dataSet);
  } else {
    onProgress?.('fallback', 'Agent 2 selhal → záložní generátor');
    return { ...(await generateWorksheetLegacy(dataSet)), generationMethod: 'legacy' };
  }
  const worksheetId = `worksheet-${Date.now()}`;

  const worksheet: Worksheet = {
    id: worksheetId,
    title: contentPlan.title || `${dataSet.topic} - List učebnice`,
    blocks,
    settings: { showAnswerKey: false, pageSize: 'A4', margins: 'normal' },
    metadata: {
      subject: dataSet.subjectCode,
      grade: dataSet.grade,
      topic: dataSet.topic,
      estimatedTime: contentPlan.estimatedTimeMinutes,
      sourceDatasetId: dataSet.id,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  _saveWs(worksheet);
  onProgress?.('done', `Hotovo ✅ — uloženo ${blocks.length} bloků`);
  return { success: true, id: worksheetId, preview: layoutResult.text || '', generationMethod: 'two-agent', contentPlan };
}

export async function generateTextbookPlanOnly(
  dataSet: TopicDataSet,
  onProgress?: ProgressCallback,
  sourceTextContent?: string
): Promise<{ success: boolean; contentPlan?: ContentPlan; ragCount?: number; error?: string }> {
  onProgress?.('rag', 'Hledám podobné listy učebnice v RAG databázi...');
  const keyTerms = dataSet.content?.keyTerms?.map((t: any) => t.term) ?? [];
  const ragExamples = await searchRagExamples({
    topic: dataSet.topic,
    subject: dataSet.subjectCode,
    grade: dataSet.grade,
    keyTerms,
    matchCount: 3,
  });
  const ragSection = formatRagExamplesForPrompt(ragExamples, 'textbook');
  onProgress?.('rag-done', `Nalezeno ${ragExamples.length} podobných listů v RAG databázi`, { examples: ragExamples, ragSection });

  if (sourceTextContent) {
    onProgress?.('source-text', '📄 Učební text načten — použiji ho jako zdroj obsahu...');
  }

  onProgress?.('agent1', 'Agent 1: Plánuji obsah stránky učebnice...');
  const contentPlan = await runContentAgent(dataSet, ragSection, 'textbook', sourceTextContent);
  if (!contentPlan) {
    return { success: false, error: 'Agent 1 selhal — nepodařilo se sestavit plán obsahu' };
  }
  onProgress?.('agent1-done', `Agent 1 hotovo — ${contentPlan.sections.length} sekcí, ${contentPlan.estimatedTimeMinutes} min`);
  return { success: true, contentPlan, ragCount: ragExamples.length };
}

export async function generateTextbookFromContentPlan(
  dataSet: TopicDataSet,
  contentPlan: ContentPlan,
  onProgress?: ProgressCallback,
  _selectedLayoutIds: string[] = [],
  folderId?: string
): Promise<GenerateResult> {
  if (folderId) _activeFolderId = folderId;

  onProgress?.('agent2', 'Skládám obsah do bloků...');

  const blocks: WorksheetBlock[] = [];
  let order = 0;

  // Build section→image map from Agent 1's selectedImages (which have sectionIndex)
  const imagesBySectionIndex = new Map<number, { url: string; title: string }>();
  console.log('[TextbookGen] selectedImages from plan:', JSON.stringify(contentPlan.selectedImages?.map((i: any) => ({ url: i.url?.substring(0, 40), sectionIndex: i.sectionIndex }))));
  for (const img of (contentPlan.selectedImages || [])) {
    const url = (img as any).url;
    const idx = (img as any).sectionIndex;
    if (url && idx !== undefined && idx !== null && !imagesBySectionIndex.has(idx)) {
      imagesBySectionIndex.set(idx, { url, title: (img as any).title || '' });
    }
  }
  console.log('[TextbookGen] imagesBySectionIndex keys:', [...imagesBySectionIndex.keys()]);

  const INFOBOX_TYPES = new Set(['vocabulary', 'summary']);
  const isInfobox = (type: string) => INFOBOX_TYPES.has(type);

  // H1 — hlavní nadpis, celá šířka
  blocks.push({
    id: generateBlockId(),
    type: 'heading',
    order: order++,
    width: 'full',
    gridSpan: 12,
    content: { text: contentPlan.title || dataSet.topic, level: 'h1' },
  });

  for (let si = 0; si < contentPlan.sections.length; si++) {
    const section = contentPlan.sections[si];
    const img = imagesBySectionIndex.get(si);
    const useInfobox = isInfobox(section.type);

    // H2 nadpis — vždy celá šířka
    blocks.push({
      id: generateBlockId(),
      type: 'heading',
      order: order++,
      width: 'full',
      gridSpan: 12,
      content: { text: section.title, level: 'h2' },
    });

    if (useInfobox) {
      // Vocabulary / summary → infobox styl, celá šířka
      blocks.push({
        id: generateBlockId(),
        type: 'paragraph',
        order: order++,
        width: 'full',
        gridSpan: 12,
        content: { html: `<p>${section.content || ''}</p>` },
        visualStyles: {
          displayPreset: 'infobox',
          backgroundColor: section.type === 'summary' ? '#f0fdf4' : '#dbeafe',
          borderColor: section.type === 'summary' ? '#22c55e' : '#3b82f6',
          borderRadius: 12,
        },
      } as WorksheetBlock);
    } else if (img) {
      // Sekce s obrázkem → text na levou půlku, obrázek na pravou půlku
      blocks.push({
        id: generateBlockId(),
        type: 'paragraph',
        order: order++,
        width: 'half',
        gridSpan: 6,
        content: { html: `<p>${section.content || ''}</p>` },
      });
      blocks.push({
        id: generateBlockId(),
        type: 'image',
        order: order++,
        width: 'half',
        gridSpan: 6,
        content: { url: img.url, alt: img.title, caption: img.title, alignment: 'center', size: 100 },
      });
    } else {
      // Sekce bez obrázku → text na celou šířku
      blocks.push({
        id: generateBlockId(),
        type: 'paragraph',
        order: order++,
        width: 'full',
        gridSpan: 12,
        content: { html: `<p>${section.content || ''}</p>` },
      });
    }
  }

  console.log('[TextbookGen] Built', blocks.length, 'blocks (rule-based layout)');

  // ── Append saved charts ──────────────────────────────────────────────────────
  const savedCharts: any[] = dataSet.media?.charts || [];
  for (const ch of savedCharts) {
    if (!ch.columns || !ch.rows || ch.rows.length === 0) continue;
    blocks.push({
      id: generateBlockId(),
      type: 'chart',
      order: order++,
      width: 'full',
      gridSpan: 12,
      content: {
        chartType: ch.chartType || 'bar',
        chartTitle: ch.title || '',
        chartColumns: ch.columns,
        chartRows: ch.rows,
        chartHeight: 320,
      },
    } as WorksheetBlock);
  }
  // ── Append image groups ───────────────────────────────────────────────────────
  const imageGroupsDoc: any[] = dataSet.media?.imageGroups || [];
  for (const group of imageGroupsDoc) {
    const doneSubjects = (group.subjects || []).filter((s: any) => s.status === 'done' && s.imageUrl);
    if (doneSubjects.length === 0) continue;
    blocks.push({
      id: generateBlockId(), type: 'heading', order: order++, width: 'full', gridSpan: 12,
      content: { text: group.title, level: 'h2' },
    } as WorksheetBlock);
    blocks.push({
      id: generateBlockId(), type: 'image', order: order++, width: 'full', gridSpan: 12,
      content: {
        url: doneSubjects[0].imageUrl,
        gallery: doneSubjects.map((s: any) => s.imageUrl),
        galleryCaptions: doneSubjects.map((s: any) => s.name),
        gridColumns: Math.min(doneSubjects.length, 4),
        containerHeight: 220,
      },
    } as WorksheetBlock);
  }

  if (savedCharts.length > 0 || imageGroupsDoc.length > 0) {
    onProgress?.('agent2-done', `✅ Obsah poskládán (${blocks.length} bloků, ${savedCharts.filter((c: any) => c.columns).length} grafů, ${imageGroupsDoc.length} skupin)`);
  } else {
    onProgress?.('agent2-done', `✅ Obsah poskládán (${blocks.length} bloků)`);
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  onProgress?.('saving', `Ukládám list učebnice (${blocks.length} bloků)...`);
  const worksheetId = `worksheet-${Date.now()}`;
  const worksheet: Worksheet = {
    id: worksheetId,
    title: contentPlan.title || `${dataSet.topic} - List učebnice`,
    blocks,
    settings: { showAnswerKey: false, pageSize: 'A4', margins: 'normal' },
    metadata: {
      subject: dataSet.subjectCode,
      grade: dataSet.grade,
      topic: dataSet.topic,
      estimatedTime: contentPlan.estimatedTimeMinutes,
      sourceDatasetId: dataSet.id,
      layoutMode: 'grid' as const,
      gridColumns: 12 as const,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  _saveWs(worksheet);
  onProgress?.('done', `Uloženo (${blocks.length} bloků)`);
  return { success: true, id: worksheetId, preview: '', generationMethod: 'two-agent', contentPlan };
}

// =====================================================
// WORKSHEET GENERATOR - Legacy (záloha)
// =====================================================

async function generateWorksheetLegacy(dataSet: TopicDataSet): Promise<GenerateResult> {
  console.log('[Generator] Using legacy worksheet generator...');
  
  const context = buildContext(dataSet);
  const feedback = getFeedbackForType('worksheet');
  
  const prompt = `PROMPT PRO VYTVOŘENÍ TEXTOVÉHO PRACOVNÍHO LISTU

Vytvořte komplexní textový pracovní list podle vstupních informací v přesném formátu pro parser.

VSTUPNÍ INFORMACE:
📌 TÉMA: ${dataSet.topic}
🎓 ROČNÍK: ${dataSet.grade}. třída
📚 PŘEDMĚT: ${dataSet.subjectCode || 'Dějepis'}

${context}

---

KRITICKÁ PRAVIDLA PRO FORMÁT

ZÁKLADNÍ SYNTAXE (POVINNÁ!)
Každý blok má tento formát:
TYP_BLOKU:
obsah na dalších řádcích

DŮLEŽITÉ:
- Typ bloku VŽDY VELKÝMI PÍSMENY následovaný dvojtečkou
- Obsah VŽDY na NOVÝCH ŘÁDCÍCH (nikdy ne na stejném řádku jako typ)
- HALF LAYOUT se píše za dvojtečku: PARAGRAPH: HALF LAYOUT
- Prázdný řádek mezi bloky pro čitelnost

TYPY BLOKŮ A JEJICH FORMÁT:

HEADER:
Jméno: ________________ Třída: ________ Známka: ________

HEADING-H1:
Hlavní nadpis pracovního listu (pouze jeden, na začátku)

HEADING:
Název sekce nebo podkapitoly (H2)

PARAGRAPH:
Text odstavce s vysvětlením tématu. Může mít více vět.

PARAGRAPH: HALF LAYOUT
Text, který bude vedle obrázku.

INFOBOX:
Důležitá informace nebo zvýraznění klíčového faktu.

INFOBOX: HALF LAYOUT
Informace vedle obrázku.

OBRÁZEK: Přesný název obrázku ze seznamu

TABLE:
Sloupec 1 | Sloupec 2 | Sloupec 3
Hodnota 1 | Hodnota 2 | Hodnota 3

MULTIPLE-CHOICE:
Znění otázky?
A) nesprávná možnost
B) správná odpověď *
C) nesprávná možnost
D) nesprávná možnost
(Správná odpověď končí hvězdičkou *)

FILL-BLANK:
Text s ___ mezerou pro doplnění. = správná odpověď
(Formát: text s ___ = odpověď)

FREE-ANSWER:
Otevřená otázka pro žáka, na kterou napíše vlastní odpověď?

CONNECT-PAIRS:
Pojem 1 | Definice 1
Pojem 2 | Definice 2
Pojem 3 | Definice 3
Pojem 4 | Definice 4
(Formát: pojem | definice)

FOOTER:
Zpětná vazba: 😊 😐 ☹️
Poznámky učitele: _______________________

POŽADAVKY NA OBSAH:
✅ 6-10 sekcí s logickou návazností (učební linka)
✅ Minimálně 3 různé typy aktivit rozložené rovnoměrně
✅ Pokryj všechny klíčové pojmy ze vstupních informací
✅ Zahrň osobnosti a časovou osu (pokud jsou ve vstupu)
✅ Header na začátku + Footer na konci
✅ NEPOUŽÍVEJ obrázky (OBRÁZEK:) - pracovní list je pouze textový

STRUKTURA PRACOVNÍHO LISTU:

1. HEADER (jméno, třída, známka)

2. HEADING-H1 (název tématu)

3. ÚVODNÍ TEXT (1-2 obsáhlé odstavce)
   - Shrň celé téma v 8-12 větách
   - Zahrň všechny klíčové pojmy a fakta
   - Zmiň důležité osobnosti a události
   - Tento text slouží jako podklad pro aktivity

4. AKTIVITY (zbytek pracovního listu)
   - 8-12 různých aktivit
   - Střídej typy: MULTIPLE-CHOICE, FILL-BLANK, CONNECT-PAIRS, FREE-ANSWER
   - NEPOUŽÍVEJ HEADING před aktivitami - typ aktivity je dostatečný
   - Aktivity ověřují pochopení úvodního textu

5. FOOTER (zpětná vazba)

PŘÍKLAD SPRÁVNÉHO FORMÁTU:

HEADER:
Jméno: ________________ Třída: ________ Známka: ________

HEADING-H1:
Starověké Řecko

PARAGRAPH:
Starověké Řecko se rozkládalo na Balkánském poloostrově a mnoha ostrovech. Řekové byli vynikající mořeplavci a obchodníci. Nežili v jednom velkém státě, ale v samostatných městských státech zvaných polis. Dva nejmocnější byly Athény (centrum umění a demokracie) a Sparta (vojenský stát). V Athénách vznikla demokracie – vláda lidu. Řekové věřili v mnoho bohů, kteří sídlili na hoře Olymp. Nejvyšší byl Zeus. Na jeho počest se konaly olympijské hry. Řekové vymysleli divadlo a položili základy evropské kultury. Mezi slavné osobnosti patří filosof Sókratés, básník Homér a vojevůdce Alexandr Veliký.

MULTIPLE-CHOICE:
Jak se nazývaly řecké městské státy?
A) Kolonie
B) Polis *
C) Provincie
D) Království

FILL-BLANK:
Vláda lidu se nazývá ___ a vznikla v Athénách. = demokracie
Nejvyšší řecký bůh se jmenoval ___. = Zeus
Sportovní hry na počest Dia se nazývaly ___. = olympijské hry

CONNECT-PAIRS:
Athény | demokracie a umění
Sparta | vojenský stát
Sókratés | filosof
Homér | básník

MULTIPLE-CHOICE:
Kdo nikdy neprohrál bitvu a rozšířil řeckou kulturu až do Indie?
A) Periklés
B) Homér
C) Alexandr Veliký *
D) Zeus

FREE-ANSWER:
Co z odkazu starověkého Řecka používáme dodnes? Uveď alespoň dva příklady.

FOOTER:
Zpětná vazba: 😊 😐 ☹️

PRAVIDLA PRO OTÁZKY:
- NIKDY nedávej otázku přímo na informaci, která je v textu TĚSNĚ PŘED ní
- Otázky ověřují pochopení, ne mechanické opakování
- Otázky dávej na konec sekce nebo na začátek další sekce
- Otázka může odkazovat na informace z PŘEDCHOZÍCH sekcí (opakování)

Špatně:
PARAGRAPH: Řecko leží na Balkánském poloostrově.
MULTIPLE-CHOICE: Kde leží Řecko? ❌

Správně:
PARAGRAPH: Řecko leží na Balkánském poloostrově.
PARAGRAPH: Bylo rozděleno na městské státy...
MULTIPLE-CHOICE: Co bylo typické pro organizaci Řecka? ✓

CHECKLIST:
✅ Typy bloků VELKÝMI PÍSMENY s dvojtečkou
✅ Obsah na nových řádcích
✅ HEADING-H1: pouze jeden (hlavní nadpis na začátku)
✅ HEADING: pro všechny ostatní podnadpisy (H2)
✅ Multiple-choice: * u správné odpovědi
✅ Fill-blank: ___ = odpověď
✅ Connect-pairs: pojem | definice
✅ NEPOUŽÍVEJ obrázky - pracovní list je textový
✅ Sekce čísluj a dodržuj logickou návaznost
✅ Otázky NIKDY přímo na předchozí text

${feedback}`;
  
  const systemPrompt = `Jsi přísný generátor pracovních listů. MUSÍŠ dodržet PŘESNÝ formát výstupu.

ABSOLUTNÍ PRAVIDLA:
1. KAŽDÝ blok MUSÍ začínat klíčovým slovem VELKÝMI PÍSMENY následovaným dvojtečkou
2. NIKDY nepiš prostý text bez označení typu bloku
3. NIKDY nepoužívej Markdown formátování (žádné #, **, _)
4. Začni VŽDY s "HEADER:" jako první řádek

POVOLENÉ TYPY BLOKŮ (použij PŘESNĚ takto):
HEADER:
HEADING:
PARAGRAPH:
PARAGRAPH: HALF LAYOUT
INFOBOX:
INFOBOX: HALF LAYOUT
OBRÁZEK: [název]
TABLE:
MULTIPLE-CHOICE:
FILL-BLANK:
FREE-ANSWER:
CONNECT-PAIRS:
FOOTER:

PŘÍKLAD SPRÁVNÉHO VÝSTUPU:
HEADER:
Jméno: ___ Třída: ___ Známka: ___

HEADING:
Název sekce

PARAGRAPH:
Text odstavce.

MULTIPLE-CHOICE:
Otázka?
A) možnost
B) správná *
C) možnost

FOOTER:
Zpětná vazba: 😊 😐 ☹️

ZAČNI ODPOVĚĎ PŘESNĚ TAKTO: "HEADER:"
`;

  console.log('[Generator] Worksheet prompt:', prompt);

  console.log('[Generator] Full prompt being sent:', prompt.substring(0, 500) + '...');
  
  try {
    const response = await chatWithAIProxy(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      'gemini-3-flash',
      { temperature: 0.5, max_tokens: 8192 }
    );
    
    console.log('[Generator] Raw worksheet response:', response);
    
    const startsWithHeader = response.trim().startsWith('HEADER:');
    const finalResponse = startsWithHeader ? response : normalizeWorksheetResponse(response);
    console.log('[Generator] Using normalization:', !startsWithHeader);
    console.log('[Generator] Final response:', finalResponse.substring(0, 500) + '...');
    
    const blocks = parseTextToWorksheetBlocks(finalResponse, dataSet);
    
    const worksheetId = `worksheet-${Date.now()}`;
    
    const worksheet: Worksheet = {
      id: worksheetId,
      title: `${dataSet.topic} - Pracovní list`,
      blocks,
      settings: {
        showAnswerKey: true,
        pageSize: 'A4',
        margins: 'normal',
      },
      metadata: {
        subject: dataSet.subjectCode,
        grade: dataSet.grade,
        topic: dataSet.topic,
        sourceDatasetId: dataSet.id,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    _saveWs(worksheet);
    
    const preview = response;
    
    console.log('[Generator] Worksheet saved:', worksheetId);
    return { success: true, id: worksheetId, preview };
  } catch (err) {
    console.error('[Generator] Worksheet error:', err);
    return { success: false, error: String(err) };
  }
}

// =====================================================
// TEMPLATE-FILL PARSER
// Fills a TemplateSlot[] with AI-generated content.
// The structure is deterministic — AI only provides text for each slot.
// =====================================================

/**
 * Parses AI output with [SLOT N] tags and builds WorksheetBlock[] from template + content.
 * The template defines ALL structural decisions (type, width, order).
 * The AI only fills in text/content for each slot.
 */
function fillTemplateWithContent(
  template: TemplateSlot[],
  aiOutput: string,
  dataSet: TopicDataSet
): WorksheetBlock[] {
  // ── 1. Parse [SLOT N] sections from AI output ──────────────────────────
  const slotContents = new Map<number, string>();
  // Match [SLOT N] followed by content until next [SLOT N] or end
  const slotPattern = /\[SLOT\s+(\d+)\]\s*\n?([\s\S]*?)(?=\[SLOT\s+\d+\]|$)/g;
  let match;
  while ((match = slotPattern.exec(aiOutput)) !== null) {
    const slotId = parseInt(match[1], 10);
    const content = match[2].trim();
    slotContents.set(slotId, content);
  }

  console.log('[TemplateParser] Parsed slots:', slotContents.size, 'of', template.length, 'template slots');
  console.log('[TemplateParser] Slot IDs found:', Array.from(slotContents.keys()).join(', '));

  // ── 2. Build blocks from template + content ────────────────────────────
  const blocks: WorksheetBlock[] = [];
  let order = 0;

  // Collect all available images from the dataset for image slot resolution
  const allMedia = [
    ...(dataSet.media?.generatedIllustrations || []),
    ...(dataSet.media?.generatedPhotos || []),
    ...(dataSet.media?.images || []),
  ];

  let imageIndex = 0; // rotating fallback for image slots

  const resolveImageUrl = (content: string): { url: string; caption: string } => {
    const raw = content.trim();
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return { url: raw, caption: '' };
    }
    // Try name-based lookup
    if (raw.length > 0) {
      const nameLower = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
      const found = allMedia.find(m => {
        const title = ((m as any).title || (m as any).name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return title && (title.includes(nameLower) || nameLower.includes(title));
      });
      if (found) return { url: (found as any).url || '', caption: raw };
    }
    // Fallback: use next available image
    if (allMedia.length > 0) {
      const img = allMedia[imageIndex % allMedia.length];
      imageIndex++;
      return { url: (img as any).url || '', caption: raw };
    }
    return { url: '', caption: raw };
  };

  // Process template slots in order (pairing consecutive half-width slots)
  let i = 0;
  while (i < template.length) {
    const slot = template[i];
    const content = slotContents.get(slot.id) || '';

    // Check if this slot + next slot form a half-width pair
    const isHalfPair =
      slot.width === 'half' &&
      i + 1 < template.length &&
      template[i + 1].width === 'half';

    if (isHalfPair) {
      const slot2 = template[i + 1];
      const content2 = slotContents.get(slot2.id) || '';
      blocks.push(makeTemplateBlock(slot, content, order++, 'half', dataSet, resolveImageUrl));
      blocks.push(makeTemplateBlock(slot2, content2, order++, 'half', dataSet, resolveImageUrl));
      i += 2;
    } else {
      blocks.push(makeTemplateBlock(slot, content, order++, 'full', dataSet, resolveImageUrl));
      i++;
    }
  }

  console.log('[TemplateParser] Built', blocks.length, 'blocks');
  return blocks;
}

/**
 * Converts a single TemplateSlot + AI content string into a WorksheetBlock.
 */
function makeTemplateBlock(
  slot: TemplateSlot,
  content: string,
  order: number,
  width: 'full' | 'half',
  dataSet: TopicDataSet,
  resolveImageUrl: (content: string) => { url: string; caption: string }
): WorksheetBlock {
  // Pro editor uses a 12-column CSS grid → half-width = gridSpan 6
  const base = {
    id: generateBlockId(),
    order,
    width,
    ...(width === 'half' ? { widthPercent: 50, gridSpan: 6 } : {}),
  };

  switch (slot.type) {
    case 'header':
      return {
        ...base,
        width: 'full',
        type: 'header-footer',
        content: {
          variant: 'header',
          columns: 1,
          showName: true,
          showSurname: true,
          showClass: true,
          showGrade: true,
        },
      };

    case 'footer':
      return {
        ...base,
        width: 'full',
        type: 'header-footer',
        content: {
          variant: 'footer',
          columns: 1,
          showFeedback: true,
          feedbackType: 'smileys',
          feedbackCount: 3,
          feedbackText: 'Zpětná vazba:',
        },
      };

    case 'heading-h1':
      return {
        ...base,
        width: 'full',
        type: 'heading',
        content: { text: content || dataSet.topic, level: 'h1' as const },
      };

    case 'heading':
      return {
        ...base,
        type: 'heading',
        content: { text: content || 'Sekce', level: 'h2' as const },
      };

    case 'paragraph': {
      const html = content.startsWith('<') ? content : `<p>${content}</p>`;
      return {
        ...base,
        type: 'paragraph',
        content: { html },
      };
    }

    case 'image': {
      const { url, caption } = resolveImageUrl(content);
      return {
        ...base,
        type: 'image',
        content: {
          url,
          alt: caption,
          caption,
          size: 100,
          alignment: 'center' as const,
          showCaption: !!caption,
        },
      };
    }

    case 'infobox': {
      const html = content.startsWith('<') ? content : `<p>${content}</p>`;
      return {
        ...base,
        type: 'paragraph',
        content: { html },
        visualStyles: {
          displayPreset: 'infobox',
          backgroundColor: '#dbeafe',
          borderColor: '#3b82f6',
          borderRadius: 12,
        },
      } as WorksheetBlock;
    }

    case 'table': {
      // Build TipTap-compatible HTML table from "Col A | Col B\nVal 1 | Val 2"
      const tableRows = content
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => l.split('|').map(c => c.trim()));

      if (tableRows.length === 0) {
        return { ...base, type: 'paragraph', content: { html: `<p>${content}</p>` } };
      }

      const headerRow = tableRows[0];
      const dataRows = tableRows.slice(1);

      const thCells = headerRow.map(c => `<th><p>${c}</p></th>`).join('');
      const tdRows = dataRows.map(row => {
        const cells = row.map((c, ci) => `<td><p>${c || headerRow[ci] ? c : ''}</p></td>`).join('');
        return `<tr>${cells}</tr>`;
      }).join('');

      const html = `<table><tbody><tr>${thCells}</tr>${tdRows}</tbody></table>`;

      return {
        ...base,
        type: 'table',
        content: {
          html,
          rows: tableRows.length,
          columns: headerRow.length,
          hasHeader: true,
          hasBorder: true,
          hasRoundedCorners: true,
        },
      };
    }

    case 'connect-pairs': {
      const pairLines = content.split('\n').filter(l => l.includes('|'));
      const pairs = pairLines.map((line, i) => {
        const [left, right] = line.split('|').map(s => s.trim());
        return {
          id: `pair-${order}-${i}`,
          left: { id: `left-${order}-${i}`, type: 'text' as const, content: left || '' },
          right: { id: `right-${order}-${i}`, type: 'text' as const, content: right || '' },
        };
      });
      if (pairs.length === 0) {
        return { ...base, type: 'paragraph', content: { html: `<p>${content}</p>` } };
      }
      return {
        ...base,
        type: 'connect-pairs',
        content: {
          instruction: 'Spoj správné dvojice',
          pairs,
          shuffleSides: true,
        },
      };
    }

    case 'fill-blank': {
      // Format: "věta s ___ mezerou = správná odpověď"
      const eqMatch = content.match(/^([\s\S]+?)\s*=\s*(.+)$/);
      if (eqMatch) {
        const textPart = eqMatch[1].trim();
        const answer = eqMatch[2].trim();
        const parts = textPart.split(/_{2,}/);
        const segments: any[] = [];
        parts.forEach((part, idx) => {
          if (part) segments.push({ type: 'text', content: part });
          if (idx < parts.length - 1) {
            segments.push({
              type: 'blank',
              id: `blank-${order}-${idx}`,
              correctAnswer: answer,
              acceptedAnswers: [answer],
            });
          }
        });
        return {
          ...base,
          type: 'fill-blank',
          content: { instruction: '', segments },
        };
      }
      // Fallback: treat whole content as a paragraph
      return { ...base, type: 'paragraph', content: { html: `<p>${content}</p>` } };
    }

    case 'free-answer':
      return {
        ...base,
        type: 'free-answer',
        content: { question: content, lines: 3 },
      };

    case 'multiple-choice': {
      const mcLines = content.split('\n').map(l => l.trim()).filter(Boolean);
      const question = mcLines[0] || '';
      const options: { id: string; text: string }[] = [];
      const correctAnswers: string[] = [];

      mcLines.slice(1).forEach((line, idx) => {
        const m = line.match(/^([A-Da-d])\)\s*(.+)/);
        if (m) {
          let text = m[2].trim();
          const isCorrect = text.endsWith('*');
          if (isCorrect) text = text.slice(0, -1).trim();
          const optId = `opt-${order}-${idx}`;
          options.push({ id: optId, text });
          if (isCorrect) correctAnswers.push(optId);
        }
      });

      if (question && options.length > 0) {
        return {
          ...base,
          type: 'multiple-choice',
          content: {
            question,
            options,
            correctAnswers: correctAnswers.length > 0 ? correctAnswers : [options[0]?.id || 'opt-0'],
            allowMultiple: false,
          },
        };
      }
      return { ...base, type: 'paragraph', content: { html: `<p>${content}</p>` } };
    }

    default:
      return { ...base, type: 'paragraph', content: { html: `<p>${content}</p>` } };
  }
}

function parseTextToWorksheetBlocks(text: string, dataSet: TopicDataSet): WorksheetBlock[] {
  const blocks: WorksheetBlock[] = [];
  let order = 0;
  
  console.log('[Worksheet Parser] Input text length:', text?.length || 0);
  console.log('[Worksheet Parser] First 500 chars:', text?.substring(0, 500));
  
  if (!text || text.trim().length < 50) {
    console.error('[Worksheet Parser] Text is empty or too short!');
    // Vrátit fallback bloky
    return [{
      id: generateBlockId(),
      type: 'heading',
      order: 0,
      width: 'full',
      content: { text: `${dataSet.topic} - Pracovní list`, level: 'h1' },
    }, {
      id: generateBlockId(),
      type: 'paragraph',
      order: 1,
      width: 'full',
      content: { html: '<p>Generování pracovního listu selhalo. Zkuste to prosím znovu.</p>' },
    }];
  }
  
  // Rozdělíme text podle typů bloků
  const lines = text.split('\n');
  let currentType = '';
  let currentContent: string[] = [];
  let isHalfLayout = false;
  
  const processBlock = () => {
    if (!currentType || currentContent.length === 0) return;
    
    const content = currentContent.join('\n').trim();
    const width = isHalfLayout ? 'half' : 'full';
    
    switch (currentType.toUpperCase()) {
      case 'HEADER':
        blocks.push({
          id: generateBlockId(),
          type: 'header-footer',
          order: order++,
          width: 'full',
          content: {
            variant: 'header',
            columns: 1,
            showName: true,
            showSurname: true,
            showClass: true,
            showGrade: true,
          },
        });
        break;
        
      case 'FOOTER':
        blocks.push({
          id: generateBlockId(),
          type: 'header-footer',
          order: order++,
          width: 'full',
          content: {
            variant: 'footer',
            columns: 1,
            showFeedback: true,
            feedbackType: 'smileys',
            feedbackCount: 3,
            feedbackText: 'Zpětná vazba:',
          },
        });
        break;
        
      case 'HEADING-H1':
        blocks.push({
          id: generateBlockId(),
          type: 'heading',
          order: order++,
          width: 'full',
          content: { text: content, level: 'h1' },
        });
        break;
        
      case 'HEADING':
        blocks.push({
          id: generateBlockId(),
          type: 'heading',
          order: order++,
          width: 'full',
          content: { text: content, level: 'h2' },
        });
        break;
        
      case 'PARAGRAPH':
        blocks.push({
          id: generateBlockId(),
          type: 'paragraph',
          order: order++,
          width,
          widthPercent: isHalfLayout ? 50 : undefined,
          content: { html: `<p>${content}</p>` },
        });
        break;
        
      case 'INFOBOX':
        blocks.push({
          id: generateBlockId(),
          type: 'paragraph',
          order: order++,
          width,
          widthPercent: isHalfLayout ? 50 : undefined,
          content: { html: `<p>${content}</p>` },
          visualStyles: {
            displayPreset: 'infobox',
            backgroundColor: '#dbeafe',
            borderColor: '#3b82f6',
            borderRadius: 12,
          },
        });
        break;
        
      case 'OBRÁZEK':
      case 'IMAGE': {
        // Resolve image: content may be a direct URL or a name to look up
        const imgRaw = content.replace(/- HALF LAYOUT/i, '').trim();
        let resolvedUrl = '';
        let resolvedCaption = imgRaw;

        if (imgRaw.startsWith('http://') || imgRaw.startsWith('https://')) {
          // AI already output a URL directly — use it as-is
          resolvedUrl = imgRaw;
          resolvedCaption = '';
        } else {
          // Name-based lookup across all media sources
          const nameLower = imgRaw.toLowerCase().replace(/[^a-z0-9]/g, '');

          const matchFn = (candidate: string) => {
            const c = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
            return c === nameLower || c.includes(nameLower) || nameLower.includes(c);
          };

          const webImg = (dataSet.media?.images || []).find((i: any) => matchFn(i.title || ''));
          const ill = (dataSet.media?.generatedIllustrations || []).find((i: any) => matchFn(i.name || i.title || ''));
          const photo = (dataSet.media?.generatedPhotos || []).find((i: any) => matchFn(i.name || i.title || ''));

          const found = webImg || ill || photo;
          resolvedUrl = found?.url || '';

          // If still not found, use any available image as fallback
          if (!resolvedUrl) {
            const allMedia = [
              ...(dataSet.media?.generatedIllustrations || []),
              ...(dataSet.media?.generatedPhotos || []),
              ...(dataSet.media?.images || []),
            ];
            resolvedUrl = allMedia[0]?.url || '';
            console.log('[Parser] Image not matched by name, using first available:', resolvedUrl ? 'found' : 'none');
          } else {
            console.log('[Parser] ✅ Image resolved by name:', imgRaw, '->', resolvedUrl.slice(0, 60));
          }
        }

        blocks.push({
          id: generateBlockId(),
          type: 'image',
          order: order++,
          width: 'half',
          widthPercent: 50,
          content: {
            url: resolvedUrl,
            alt: resolvedCaption,
            caption: resolvedCaption,
            size: 100,
            alignment: 'center',
          },
        });
        break;
      }
        
      case 'MULTIPLE-CHOICE':
        const mcLines = content.split('\n').filter(l => l.trim());
        const question = mcLines[0]?.trim() || '';
        const options: any[] = [];
        const correctAnswers: string[] = [];
        
        mcLines.slice(1).forEach((line, i) => {
          const match = line.match(/^([A-D])\)\s*(.+)/i);
          if (match) {
            let optText = match[2].trim();
            const isCorrect = optText.endsWith('*');
            if (isCorrect) {
              optText = optText.slice(0, -1).trim();
            }
            const optId = `opt-${i}`;
            options.push({ id: optId, text: optText });
            if (isCorrect) correctAnswers.push(optId);
          }
        });
        
        if (question && options.length > 0) {
          blocks.push({
            id: generateBlockId(),
            type: 'multiple-choice',
            order: order++,
            width: 'full',
            content: {
              question,
              options,
              correctAnswers: correctAnswers.length > 0 ? correctAnswers : ['opt-0'],
              allowMultiple: false,
            },
          });
        }
        break;
        
      case 'FILL-BLANK':
        // Parsuj fill-blank: text s ___ = odpověď
        const fbMatch = content.match(/(.+?)=\s*(.+)/);
        if (fbMatch) {
          const textPart = fbMatch[1].trim();
          const answer = fbMatch[2].trim();
          // Rozděl text podle ___
          const parts = textPart.split(/___+/);
          const segments: any[] = [];
          parts.forEach((part, i) => {
            if (part) segments.push({ type: 'text', content: part });
            if (i < parts.length - 1) {
              segments.push({ type: 'blank', id: `blank-${order}-${i}`, correctAnswer: answer, acceptedAnswers: [answer] });
            }
          });
          blocks.push({
            id: generateBlockId(),
            type: 'fill-blank',
            order: order++,
            width: 'full',
            content: { instruction: '', segments },
          });
        }
        break;
        
      case 'FREE-ANSWER':
        blocks.push({
          id: generateBlockId(),
          type: 'free-answer',
          order: order++,
          width: 'full',
          content: { question: content, lines: 3 },
        });
        break;
        
      case 'CONNECT-PAIRS':
        const pairs: any[] = [];
        content.split('\n').forEach((line, i) => {
          const pairMatch = line.match(/(.+?)\s*\|\s*(.+)/);
          if (pairMatch) {
            pairs.push({
              id: `pair-${i}`,
              left: { id: `left-${i}`, type: 'text', content: pairMatch[1].trim() },
              right: { id: `right-${i}`, type: 'text', content: pairMatch[2].trim() },
            });
          }
        });
        if (pairs.length > 0) {
          blocks.push({
            id: generateBlockId(),
            type: 'connect-pairs',
            order: order++,
            width: 'full',
            content: { instruction: 'Spoj správné dvojice', pairs, shuffleSides: true },
          });
        }
        break;
    }
    
    currentContent = [];
    isHalfLayout = false;
  };
  
  // Parsuj řádek po řádku
  for (const line of lines) {
    // Detekuj typ bloku
    const typeMatch = line.match(/^(HEADER|FOOTER|HEADING-H1|HEADING|PARAGRAPH|INFOBOX|OBRÁZEK|IMAGE|MULTIPLE-CHOICE|FILL-BLANK|FREE-ANSWER|CONNECT-PAIRS|TABLE):\s*(.*)/i);
    
    if (typeMatch) {
      // Zpracuj předchozí blok
      processBlock();
      
      // Nový blok
      currentType = typeMatch[1];
      const rest = typeMatch[2]?.trim() || '';
      isHalfLayout = rest.toUpperCase().includes('HALF LAYOUT') || line.toUpperCase().includes('HALF LAYOUT');
      const cleanRest = rest.replace(/- HALF LAYOUT/i, '').replace(/HALF LAYOUT/i, '').trim();
      if (cleanRest) currentContent.push(cleanRest);
    } else if (line.trim() && currentType) {
      // Pokračování obsahu
      currentContent.push(line.trim());
    }
  }
  
  // Zpracuj poslední blok
  processBlock();
  
  // Pokud nejsou žádné bloky, přidej výchozí
  if (blocks.length === 0) {
    console.warn('[Worksheet Parser] No blocks parsed! Adding fallback.');
    blocks.push({
      id: generateBlockId(),
      type: 'heading',
      order: order++,
      width: 'full',
      content: { text: `${dataSet.topic} - Pracovní list`, level: 'h1' },
    });
  }
  
  console.log('[Worksheet Parser] Generated', blocks.length, 'blocks');
  console.log('[Worksheet Parser] Block types:', blocks.map(b => b.type).join(', '));
  
  return blocks;
}

// =====================================================
// TEXT GENERATOR
// =====================================================

async function generateText(dataSet: TopicDataSet): Promise<GenerateResult> {
  console.log('[Generator] Generating text...');
  
  const context = buildContext(dataSet);
  
  const feedback = getFeedbackForType('text');
  
  // Připravit seznam obrázků pro prompt - FILTROVAT VYLOUČENÉ a SEŘADIT PRIORITNÍ NA ZAČÁTEK
  const sortByPriority = (a: any, b: any) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0);
  
  const availableWebImages = (dataSet.media?.images || [])
    .filter((img: any) => !img.excluded)
    .sort(sortByPriority);
  const availableIllustrations = (dataSet.media?.generatedIllustrations || [])
    .filter((ill: any) => !ill.excluded)
    .sort(sortByPriority);
  const availablePhotos = (dataSet.media?.generatedPhotos || [])
    .filter((photo: any) => !photo.excluded)
    .sort(sortByPriority);
  
  // Prioritní položky označit hvězdičkou
  const formatItem = (item: any, nameKey: string) => {
    const name = item[nameKey] || 'Bez názvu';
    return item.priority ? `⭐ "${name}" (PRIORITNÍ - POUŽIJ!)` : `"${name}"`;
  };
  
  const imageList = availableWebImages.length > 0 
    ? `\n🖼️ DOSTUPNÉ OBRÁZKY Z WEBU (vyber 2-3 relevantní):\n${availableWebImages.map((img: any, i: number) => `  ${i + 1}. ${formatItem(img, 'title')}`).join('\n')}`
    : '';
    
  const illustrationList = availableIllustrations.length > 0
    ? `\n🎨 DOSTUPNÉ ILUSTRACE (preferuj tyto! vyber 3-4):\n${availableIllustrations.map((ill: any, i: number) => `  ${i + 1}. ${formatItem(ill, 'name')}`).join('\n')}`
    : '';
    
  const photoList = availablePhotos.length > 0
    ? `\n📷 DOSTUPNÉ FOTKY (vyber 1-2 relevantní):\n${availablePhotos.map((photo: any, i: number) => `  ${i + 1}. ${formatItem(photo, 'name')}`).join('\n')}`
    : '';

  const availableImageGroups = (dataSet.media?.imageGroups || [])
    .filter((g: any) => (g.subjects || []).some((s: any) => s.status === 'done' && s.imageUrl));
  const imageGroupList = availableImageGroups.length > 0
    ? `\n🖼️ SKUPINY OBRÁZKŮ (GALERIE) - pod vhodné H2 přidej SkupinaH2: Název skupiny:\n${availableImageGroups.map((g: any, i: number) => `  ${i + 1}. "${g.title}" (${(g.subjects || []).filter((s: any) => s.status === 'done' && s.imageUrl).length} obrázků)`).join('\n')}`
    : '';
  
  const prompt = `Napiš PODROBNÝ výukový text k tématu "${dataSet.topic}" pro ${dataSet.grade}. třídu ZŠ.

${context}${feedback}${illustrationList}${photoList}${imageList}${imageGroupList}

FORMÁT TEXTU (NEZAČÍNEJ H1 nadpisem - ten je automaticky z názvu dokumentu):

## Podnadpis sekce 1
IlustraceH2: Název ilustrace ze seznamu (PREFERUJ - pro vygenerované ikony/ilustrace)
FotkaH2: Název fotky ze seznamu (pro vygenerované fotografie)
ObrázekH2: Název obrázku ze seznamu (pro fotky z webu - POUZE pokud nejsou lepší ilustrace/fotky)
SkupinaH2: Název skupiny ze seznamu skupin (pro galerii více obrázků najednou)
Text odstavce (3-5 vět s konkrétními fakty a příklady)...

INFOBOX modrý: Věděli jste?
Zajímavost nebo překvapivý fakt.

## Podnadpis sekce 2
ObrázekH2: Název jiného obrázku
Další text odstavce s detaily...

## ... další sekce ...

## 📚 Důležité pojmy
- **Pojem 1** – stručná definice
- **Pojem 2** – stručná definice
- **Pojem 3** – stručná definice
(5-8 klíčových pojmů k tématu)

## 📅 Důležitá data
- **Rok/období** – co se stalo
- **Rok/období** – co se stalo
(3-5 důležitých dat, pokud jsou k tématu relevantní)

## 👤 Důležité osobnosti
- **Jméno** – kdo to byl a proč je důležitý (1 věta)
- **Jméno** – kdo to byl a proč je důležitý (1 věta)
(2-4 osobnosti, pokud jsou k tématu relevantní)

PRAVIDLA:
- 500-800 slov celkem (PODROBNĚJI!)
- 5-7 hlavních sekcí + 3 závěrečné sekce (pojmy, data, osobnosti)
- PREFERUJ ILUSTRACE (50%), pak FOTKY (30%), pak OBRÁZKY Z WEBU (20%)!
- IlustraceH2: [přesný název z 🎨 DOSTUPNÉ ILUSTRACE] - PŘEDNOSTNĚ POD H2 nadpis
- FotkaH2: [přesný název z 📷 DOSTUPNÉ FOTKY] - pro AI fotografie
- ObrázekH2: [přesný název z 🖼️ DOSTUPNÉ OBRÁZKY Z WEBU] - pouze jako doplněk
- SkupinaH2: [přesný název ze 🖼️ SKUPINY OBRÁZKŮ] - použij pro H2 kde se hodí zobrazit galerii více obrázků
- U většiny H2 použij ilustraci nebo fotku, obrázky z webu jen výjimečně
- INFOBOX modrý: pro zajímavosti, "věděli jste?" (info)
- INFOBOX zelený: pro tipy a rady (tip)
- INFOBOX oranžový: pro upozornění (warning)
- INFOBOX fialový: pro shrnutí (summary)
- Srozumitelný jazyk pro ${dataSet.grade}. třídu
- Každý obrázek/ilustraci použij MAX 1x
- INFOBOX musí mít nadpis a text na dalším řádku
- VŽDY přidej závěrečné sekce: Důležité pojmy, Důležitá data, Důležité osobnosti`;

  try {
    const response = await chatWithAIProxy(
      [{ role: 'user', content: prompt }],
      'gemini-3-flash',
      { temperature: 0.7, max_tokens: 4096 }
    );
    
    console.log('[Generator] Raw text response:', response.substring(0, 500));
    
    // Extrahovat přiřazení obrázků k H2 nadpisům (nový formát: ObrázekH2: Název)
    const sectionImages: SectionMediaItem[] = [];
    const lines = response.split('\n');
    let currentH2 = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Najít H2 nadpis
      const h2Match = line.match(/^##\s*(.+)/);
      if (h2Match) {
        currentH2 = h2Match[1].trim();
      }
      
      // Najít ObrázekH2:, FotkaH2:, IlustraceH2:, SkupinaH2: pod nadpisem
      const imgMatch = line.match(/^ObrázekH2:\s*(.+)/i);
      const illMatch = line.match(/^IlustraceH2:\s*(.+)/i);
      const photoMatch = line.match(/^FotkaH2:\s*(.+)/i);
      const groupMatch = line.match(/^SkupinaH2:\s*(.+)/i);
      
      if (imgMatch && currentH2) {
        const imageName = imgMatch[1].trim().toLowerCase();
        // Filtrovat vyloučené obrázky
        const foundImage = dataSet.media?.images?.filter((img: any) => !img.excluded)?.find((img: any) => {
          const imgTitle = (img.title || '').toLowerCase();
          return imgTitle === imageName ||
                 imgTitle.includes(imageName) ||
                 imageName.includes(imgTitle) ||
                 imgTitle.replace(/[^a-z0-9]/g, '').includes(imageName.replace(/[^a-z0-9]/g, ''));
        });
        
        if (foundImage?.url) {
          sectionImages.push({
            id: crypto.randomUUID(),
            heading: currentH2,
            type: 'image',
            imageUrl: foundImage.url,
            imageSteps: [{ id: crypto.randomUUID(), url: foundImage.url, description: foundImage.title }],
          });
          console.log('[Generator] Found image for H2:', currentH2, '->', foundImage.title);
        }
      } else if (illMatch && currentH2) {
        const illName = illMatch[1].trim().toLowerCase();
        // Filtrovat vyloučené ilustrace
        const foundIll = dataSet.media?.generatedIllustrations?.filter((ill: any) => !ill.excluded)?.find((ill: any) => {
          const name = (ill.name || '').toLowerCase();
          return name === illName ||
                 name.includes(illName) ||
                 illName.includes(name) ||
                 name.replace(/[^a-z0-9]/g, '').includes(illName.replace(/[^a-z0-9]/g, ''));
        });
        
        if (foundIll?.url) {
          sectionImages.push({
            id: crypto.randomUUID(),
            heading: currentH2,
            type: 'image',
            imageUrl: foundIll.url,
            imageSteps: [{ id: crypto.randomUUID(), url: foundIll.url, description: foundIll.name }],
          });
          console.log('[Generator] Found illustration for H2:', currentH2, '->', foundIll.name);
        }
      } else if (photoMatch && currentH2) {
        const photoName = photoMatch[1].trim().toLowerCase();
        // Filtrovat vyloučené fotky
        const foundPhoto = dataSet.media?.generatedPhotos?.filter((photo: any) => !photo.excluded)?.find((photo: any) => {
          const name = (photo.name || '').toLowerCase();
          return name === photoName ||
                 name.includes(photoName) ||
                 photoName.includes(name) ||
                 name.replace(/[^a-z0-9]/g, '').includes(photoName.replace(/[^a-z0-9]/g, ''));
        });
        
        if (foundPhoto?.url) {
          sectionImages.push({
            id: crypto.randomUUID(),
            heading: currentH2,
            type: 'image',
            imageUrl: foundPhoto.url,
            imageSteps: [{ id: crypto.randomUUID(), url: foundPhoto.url, description: foundPhoto.name }],
          });
          console.log('[Generator] Found photo for H2:', currentH2, '->', foundPhoto.name);
        }
      } else if (groupMatch && currentH2) {
        const groupName = groupMatch[1].trim().toLowerCase();
        const foundGroup = (dataSet.media?.imageGroups || []).find((g: any) => {
          const title = (g.title || '').toLowerCase();
          return title === groupName ||
                 title.includes(groupName) ||
                 groupName.includes(title) ||
                 title.replace(/[^a-z0-9]/g, '').includes(groupName.replace(/[^a-z0-9]/g, ''));
        });
        if (foundGroup) {
          const doneSubjects = (foundGroup.subjects || []).filter((s: any) => s.status === 'done' && s.imageUrl);
          if (doneSubjects.length > 0) {
            sectionImages.push({
              id: crypto.randomUUID(),
              heading: currentH2,
              type: 'image',
              imageUrl: doneSubjects[0].imageUrl,
              imageSteps: doneSubjects.map((s: any) => ({ id: crypto.randomUUID(), url: s.imageUrl, description: s.name })),
            });
            console.log('[Generator] Found image group for H2:', currentH2, '->', foundGroup.title, `(${doneSubjects.length} subjects)`);
          }
        }
      }
    }
    
    // Odstranit řádky s ObrázekH2:, IlustraceH2:, FotkaH2:, SkupinaH2: z textu (obrázky jsou v sidebaru a galerii)
    let cleanedResponse = response.replace(/^ObrázekH2:.*$/gm, '');
    cleanedResponse = cleanedResponse.replace(/^IlustraceH2:.*$/gm, '');
    cleanedResponse = cleanedResponse.replace(/^FotkaH2:.*$/gm, '');
    cleanedResponse = cleanedResponse.replace(/^SkupinaH2:.*$/gm, '');
    
    // Odstranit H1 nadpis (název je v title dokumentu)
    cleanedResponse = cleanedResponse.replace(/^#\s+.+$/gm, '');
    
    // Převést INFOBOX na HTML callout (formát pro TipTap editor)
    // Mapování barev na typy callout
    const calloutTypeMap: Record<string, string> = {
      'modrý': 'info',
      'červený': 'danger',
      'zelený': 'tip',
      'oranžový': 'warning',
      'fialový': 'summary',
    };
    
    cleanedResponse = cleanedResponse.replace(
      /INFOBOX (modrý|červený|zelený|oranžový|fialový):\s*(.+?)(?:\n([^\n#]*))?(?=\n\n|\n##|$)/gim,
      (match, color, title, content) => {
        const calloutType = calloutTypeMap[color.toLowerCase()] || 'info';
        const contentText = content ? content.trim() : '';
        return `\n<div data-type="callout" data-callout-type="${calloutType}" class="callout callout-${calloutType}"><p><strong>${title.trim()}</strong></p>${contentText ? `<p>${contentText}</p>` : ''}</div>\n`;
      }
    );
    
    // Převést Markdown na HTML
    let html = markdownToHtml(cleanedResponse);
    
    // Přidat VŠECHNY obrázky, ilustrace a fotky do galerie na konec (s fullscreen možností)
    // Filtrovat vyloučené a seřadit prioritní na začátek
    const sortByPriorityGallery = (a: any, b: any) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0);
    
    const allImages = (dataSet.media?.images || [])
      .filter((img: any) => !img.excluded)
      .sort(sortByPriorityGallery);
    const allIllustrations = (dataSet.media?.generatedIllustrations || [])
      .filter((ill: any) => !ill.excluded)
      .sort(sortByPriorityGallery);
    const allPhotos = (dataSet.media?.generatedPhotos || [])
      .filter((photo: any) => !photo.excluded)
      .sort(sortByPriorityGallery);
    
    console.log('[Generator] Adding gallery with', allImages.length, 'web images,', allIllustrations.length, 'illustrations, and', allPhotos.length, 'photos');
    
    if (allImages.length > 0 || allIllustrations.length > 0 || allPhotos.length > 0) {
      html += '\n<h2>🖼️ Galerie</h2>\n';
      html += '<div class="image-gallery not-prose" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px;">';
      
      // Přidat všechny ilustrace PRVNÍ (prioritní)
      for (const ill of allIllustrations) {
        html += `<figure data-gallery-image data-image-url="${ill.url}" data-image-title="🎨 ${ill.name}" style="margin: 0; text-align: center; cursor: pointer;">`;
        html += `<img src="${ill.url}" alt="${ill.name}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />`;
        html += `<figcaption style="font-size: 12px; color: #666; margin-top: 4px;">🎨 ${ill.name}</figcaption>`;
        html += `</figure>`;
        
        if (!sectionImages.find(si => si.imageUrl === ill.url)) {
          sectionImages.push({
            id: crypto.randomUUID(),
            heading: '🖼️ Galerie',
            type: 'image',
            imageUrl: ill.url,
            imageSteps: [{ id: crypto.randomUUID(), url: ill.url, description: ill.name }],
          });
        }
      }
      
      // Přidat všechny AI fotky DRUHÉ
      for (const photo of allPhotos) {
        html += `<figure data-gallery-image data-image-url="${photo.url}" data-image-title="📷 ${photo.name}" style="margin: 0; text-align: center; cursor: pointer;">`;
        html += `<img src="${photo.url}" alt="${photo.name}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />`;
        html += `<figcaption style="font-size: 12px; color: #666; margin-top: 4px;">📷 ${photo.name}</figcaption>`;
        html += `</figure>`;
        
        if (!sectionImages.find(si => si.imageUrl === photo.url)) {
          sectionImages.push({
            id: crypto.randomUUID(),
            heading: '🖼️ Galerie',
            type: 'image',
            imageUrl: photo.url,
            imageSteps: [{ id: crypto.randomUUID(), url: photo.url, description: photo.name }],
          });
        }
      }
      
      // Přidat obrázky z webu POSLEDNÍ
      for (const img of allImages) {
        html += `<figure data-gallery-image data-image-url="${img.url}" data-image-title="🌐 ${img.title}" style="margin: 0; text-align: center; cursor: pointer;">`;
        html += `<img src="${img.url}" alt="${img.title}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />`;
        html += `<figcaption style="font-size: 12px; color: #666; margin-top: 4px;">🌐 ${img.title}</figcaption>`;
        html += `</figure>`;
        
        if (!sectionImages.find(si => si.imageUrl === img.url)) {
          sectionImages.push({
            id: crypto.randomUUID(),
            heading: '🖼️ Galerie',
            type: 'image',
            imageUrl: img.url,
            imageSteps: [{ id: crypto.randomUUID(), url: img.url, description: img.title }],
          });
        }
      }
      
      html += '</div>';
      
      // Jednoduchý CSS bez náročných transform efektů
      html += `<style>.image-gallery figure:hover { opacity: 0.9; }</style>`;
    }
    
    const docId = dataSet.id + '-text';
    
    // Vytvořit náhled pro okamžité zobrazení v DataSetu
    const newMaterial = {
      type: 'text',
      id: docId,
      title: dataSet.topic + ' - Učební text',
      status: 'draft',
      createdAt: new Date().toISOString()
    };
    
    const docData = {
      id: docId,
      title: dataSet.topic,
      content: html,
      documentType: 'lesson',
      sectionImages,
    };
    
    // Uložit pomocí standardní saveDocument funkce (stejně jako boardy používají saveQuiz)
    console.log('[Generator] 💾 Saving document:', { id: docId, title: docData.title, contentLength: docData.content?.length });
    
    try {
      // 1. Uložit do localStorage pro okamžitý přístup
      _saveDoc(
        {
          id: docId,
          title: dataSet.topic,
          name: dataSet.topic,
          type: 'document',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        docData // content s sectionImages
      );
      
      console.log(`[Generator] ✅ Document saved to localStorage: ${docId}`);
      
      // 2. KRITICKÉ: Synchronně uložit do Supabase (nepoléhat na queue!)
      const syncResult = await syncDocumentDirectToSupabase({
        id: docId,
        title: dataSet.topic,
        content: html,
        documentType: 'lesson',
        sectionImages: sectionImages,
      });
      
      if (syncResult) {
        console.log(`[Generator] ✅ Document synced to Supabase: ${docId}`);
    } else {
        console.warn(`[Generator] ⚠️ Supabase sync failed for ${docId}, will retry via queue`);
      }
      
      // Ověřit localStorage
      const verification = localStorage.getItem(`vivid-doc-${docId}`);
      console.log('[Generator] 💾 localStorage verification:', verification ? 'SUCCESS' : 'FAILED');
    } catch (e) {
      console.error(`[Generator] ❌ saveDocument failed for ${docId}:`, e);
      
      // Fallback: přímé uložení do localStorage
      try {
        localStorage.setItem(`vivid-doc-${docId}`, JSON.stringify(docData));
        console.log(`[Generator] ✅ Fallback localStorage save OK for ${docId}`);
      } catch (e2) {
        console.error(`[Generator] ❌ Fallback also failed:`, e2);
      }
    }
    
    console.log('[Generator] Text saved with', sectionImages.length, 'sectionImages (including gallery)');
    
    // Vytvořit textový náhled - zachovat strukturu
    const preview = response
      .replace(/^ObrázekH2:\s*(.+)$/gm, '🖼️ [$1]')
      .replace(/INFOBOX (modrý|červený):\s*/gi, '📦 INFOBOX: ');
    
    console.log('[Generator] Text saved:', docId);
    return { success: true, id: docId, preview };
  } catch (err) {
    console.error('[Generator] Text error:', err);
    return { success: false, error: String(err) };
  }
}

function markdownToHtml(markdown: string): string {
  return markdown
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    // Nepřevádět řádky které už jsou HTML (začínají na <)
    .replace(/^(?!<[a-z])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
    // Odstranit prázdné <p> tagy okolo figure a div elementů
    .replace(/<p>(<figure.*?<\/figure>)<\/p>/gs, '$1')
    .replace(/<p>(<div.*?<\/div>)<\/p>/gs, '$1');
}

// =====================================================
// TEST GENERATOR
// =====================================================

async function generateTest(dataSet: TopicDataSet): Promise<GenerateResult> {
  console.log('[Generator] Generating test...');
  
  const context = buildContext(dataSet);
  
  const feedback = getFeedbackForType('test');
  
  // Připravit seznamy obrázků a ilustrací
  const images = dataSet.media?.images || [];
  const illustrations = dataSet.media?.generatedIllustrations || [];
  
  let mediaSection = '';
  if (images.length > 0) {
    mediaSection += `\n🖼️ DOSTUPNÉ OBRÁZKY:\n${images.map((img, i) => `  ${i + 1}. "${img.title}"`).join('\n')}`;
  }
  if (illustrations.length > 0) {
    mediaSection += `\n🎨 DOSTUPNÉ ILUSTRACE:\n${illustrations.map((ill, i) => `  ${i + 1}. "${ill.name}"`).join('\n')}`;
  }
  
  console.log(`[Generator] Test media: ${images.length} images, ${illustrations.length} illustrations`);
  
  // Pokud je feedback, použij ho jako hlavní instrukci
  const defaultInstructions = feedback 
    ? '' // Nechť feedback určí typ otázek
    : `\nVytvoř:
- 3 ABC otázky
- 2 otevřené otázky`;
  
  const prompt = `Vytvoř písemku k tématu "${dataSet.topic}" pro ${dataSet.grade}. třídu.

${context}
${feedback ? feedback : ''}
${mediaSection}
${defaultInstructions}

Formát odpovědi:
Pro ABC otázku:
OTÁZKA X (ABC):
[text otázky]
OBRÁZEK: [název obrázku/ilustrace ze seznamu - volitelné]
A) [možnost]
B) [možnost *pokud správná]
C) [možnost]

Pro ABC otázku s obrázkem (Co je na obrázku?):
OTÁZKA X (ABC):
Co je na tomto obrázku?
OBRÁZEK: Řecká helma hoplíta
A) Špatná odpověď
B) Správná odpověď *
C) Špatná odpověď
D) Špatná odpověď

Pro otevřenou otázku:
OTÁZKA X (OTEVŘENÁ):
[otázka vyžadující zamyšlení a vlastní odpověď]

PRAVIDLA PRO OBRÁZKY:
- Používej PŘESNÉ názvy obrázků (🖼️) nebo ilustrací (🎨) ze seznamu výše
- Přidej obrázek/ilustraci k 1-2 ABC otázkám
- Minimálně 1 otázka by měla být typu "Co je na tomto obrázku?" nebo "Co vidíš na ilustraci?"
- U otevřených otázek obrázky nepoužívej`;

  console.log('[Generator] Test prompt:', prompt);

  try {
    const response = await chatWithAIProxy(
      [{ role: 'user', content: prompt }],
      'gemini-3-flash',
      { temperature: 0.7, max_tokens: 2048 }
    );
    
    const slides = parseTextToTestSlides(response, dataSet);
    
    const quizId = `test-${Date.now()}`;
    
    const quiz: Quiz = {
      id: quizId,
      title: `Písemka: ${dataSet.topic}`,
      slides,
      settings: {
        showPoints: true,
        allowBack: false,
        shuffleSlides: false,
        shuffleOptions: true,
        timeLimit: 30,
        passingScore: 50,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceDatasetId: dataSet.id,
    };
    
    // Uložit - localStorage může selhat, proto přímý sync do Supabase
    try {
      _saveQz(quiz);
    } catch (e) {
      console.warn(`[Generator] localStorage failed for test ${quizId}:`, e);
    }
    
    // Přímý sync do Supabase
    const synced = await _syncQz(quiz);
    if (!synced) {
      console.warn(`[Generator] Supabase sync failed for test ${quizId}`);
    }
    
    // Vytvořit textový náhled
    const preview = slides.slice(1).map((slide, i) => {
      const s = slide as any;
      const imageUrl = s.media?.url;
      const imageText = imageUrl ? `\n🖼️ Obrázek: ${imageUrl.split('/').pop()?.split('?')[0] || 'přiložen'}` : '';
      
      if (s.question && s.options) {
        const optionsText = s.options.map((o: any) => 
          `${o.label}) ${o.content}${o.isCorrect ? ' ✓' : ''}`
        ).join('\n');
        return `**Otázka ${i + 1}:** ${s.question}${imageText}\n${optionsText}`;
      } else if (s.question) {
        return `**Otázka ${i + 1} (otevřená):** ${s.question}`;
      }
      return '';
    }).filter(Boolean).join('\n\n');
    
    console.log('[Generator] Test saved:', quizId);
    return { success: true, id: quizId, preview };
  } catch (err) {
    console.error('[Generator] Test error:', err);
    return { success: false, error: String(err) };
  }
}

function parseTextToTestSlides(text: string, dataSet: TopicDataSet): QuizSlide[] {
  const slides: QuizSlide[] = [];
  
  // Header slide
  slides.push({
    ...createInfoSlide(0, 'title-content'),
    title: `✏️ Písemka: ${dataSet.topic}`,
    content: `<p><strong>Jméno:</strong> _________________</p><p><strong>Třída:</strong> ${dataSet.grade}._____</p>`,
  } as any);
  
  // Parsovat otázky
  const questionBlocks = text.split(/OTÁZKA\s*\d+/i).filter(block => block.trim());
  
  questionBlocks.forEach((block, index) => {
    const lines = block.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return;
    
    const firstLine = lines[0].toLowerCase();
    
    // Hledat obrázek nebo ilustraci v bloku
    let questionImage: string | undefined = undefined;
    for (const line of lines) {
      const imageMatch = line.match(/^OBRÁZEK:\s*(.+)/i);
      if (imageMatch) {
        const imageName = imageMatch[1].trim().toLowerCase();
        
        // Hledat v obrázcích
        const foundImage = dataSet.media?.images?.find(img => {
          const imgTitle = (img.title || '').toLowerCase();
          return imgTitle === imageName ||
                 imgTitle.includes(imageName) ||
                 imageName.includes(imgTitle) ||
                 imgTitle.replace(/[^a-z0-9]/g, '').includes(imageName.replace(/[^a-z0-9]/g, '')) ||
                 imageName.replace(/[^a-z0-9]/g, '').includes(imgTitle.replace(/[^a-z0-9]/g, ''));
        });
        
        if (foundImage?.url) {
          questionImage = foundImage.url;
          console.log('[Parser] ✅ Test found image:', imageName);
        } else {
          // Hledat v ilustracích
          const foundIll = dataSet.media?.generatedIllustrations?.find(ill => {
            const illName = (ill.name || '').toLowerCase();
            return illName === imageName ||
                   illName.includes(imageName) ||
                   imageName.includes(illName) ||
                   illName.replace(/[^a-z0-9]/g, '').includes(imageName.replace(/[^a-z0-9]/g, '')) ||
                   imageName.replace(/[^a-z0-9]/g, '').includes(illName.replace(/[^a-z0-9]/g, ''));
          });
          
          if (foundIll?.url) {
            questionImage = foundIll.url;
            console.log('[Parser] ✅ Test found illustration:', imageName, '->', foundIll.name);
          }
        }
      }
    }
    
    if (firstLine.includes('abc') || firstLine.includes('vyber')) {
      // ABC otázka
      const questionText = lines[1]?.trim() || '';
      const options: { id: string; label: string; content: string; isCorrect: boolean }[] = [];
      
      lines.slice(2).forEach((line) => {
        const match = line.match(/^([A-D])\)\s*(.+)/i);
        if (match) {
          let content = match[2].trim();
          const isCorrect = content.endsWith('*');
          if (isCorrect) content = content.slice(0, -1).trim();
          options.push({
            id: match[1].toLowerCase(),
            label: match[1].toUpperCase(),
            content,
            isCorrect,
          });
        }
      });
      
      if (!options.some(o => o.isCorrect) && options.length > 0) {
        options[0].isCorrect = true;
      }
      
      if (questionText && options.length >= 2) {
        slides.push({
          ...createABCSlide(slides.length),
          question: questionText,
          options,
          points: 1,
          // Přidat obrázek pokud byl nalezen
          ...(questionImage ? { media: { type: 'image' as const, url: questionImage } } : {}),
        });
      }
    } else if (firstLine.includes('otevřen') || firstLine.includes('odpověz')) {
      // Otevřená otázka
      const questionText = lines[1]?.trim() || lines[0].replace(/\([^)]+\)/g, '').trim();
      if (questionText) {
        slides.push({
          ...createOpenSlide(slides.length),
          question: questionText,
          correctAnswers: [],
          points: 3,
        });
      }
    }
  });
  
  return slides;
}

// =====================================================
// LESSON GENERATOR - E-U-R
// =====================================================

async function generateLesson(dataSet: TopicDataSet): Promise<GenerateResult> {
  console.log('[Generator] Generating E-U-R lesson...');
  
  const context = buildContext(dataSet);
  
  const feedback = getFeedbackForType('lesson');
  
  // Připravit seznamy obrázků a ilustrací - více vizuálů
  const images = dataSet.media?.images || [];
  const illustrations = dataSet.media?.generatedIllustrations || [];
  const allVisuals = [
    ...images.slice(0, 8).map(i => `🖼️ "${i.title}"`),
    ...illustrations.slice(0, 5).map(i => `🎨 "${i.name}"`)
  ];
  
  // Extrahovat klíčové pojmy pro návrh metodického tématu
  const keyTermsList = dataSet.content?.keyTerms?.slice(0, 5).map(t => t.term).join(', ') || '';
  const factsList = dataSet.content?.keyFacts?.slice(0, 3).join('; ') || '';
  
  const prompt = `Vytvoř BADATELSKOU E-U-R lekci o tématu "${dataSet.topic}" pro ${dataSet.grade}. třídu.

PRVNÍ KROK - VYBER JEDNO SILNÉ METODICKÉ TÉMA:
Na základě kontextu níže vyber JEDNO konkrétní metodické/badatelské téma, které:
- Je relevantní k "${dataSet.topic}" (NE obecné téma jako "demokracie" pokud to není přímo součást látky!)
- Umožňuje badatelský přístup (žáci mohou něco objevit, zjistit, přijít na to)
- Je zajímavé a provokuje k diskuzi
- Vychází z konkrétních pojmů/faktů: ${keyTermsList}

KONTEXT:
${context}${feedback}

POVINNÁ STRUKTURA (10 slidů):

INFO: 🎯 [Název lekce vycházející z vybraného metodického tématu]
OBRÁZEK: [vyber z dostupných vizuálů]
[1-2 motivační věty - proč je TOTO téma zajímavé pro žáky]

HLASOVÁNÍ: [Provokativní otázka kde žáci TIPUJÍ odpověď - musí se vztahovat k metodickému tématu]

NÁSTĚNKA: [Brainstorming otázka k metodickému tématu]

INFO: 📚 [Nadpis první části - souvisí s metodickým tématem]
OBRÁZEK: [vyber z dostupných vizuálů]
[2-3 věty s klíčovými informacemi]

ABC: [Otázka ověřující porozumění]
OBRÁZEK: [volitelně - pro vizuální otázku]
A) [možnost]
B) [správná odpověď] *
C) [možnost]
D) [možnost]

NÁSTĚNKA: [Diskuzní otázka k tématu]

INFO: 💡 [Zajímavost nebo překvapivý fakt]
OBRÁZEK: [vyber z dostupných vizuálů]
[2-3 věty]

HLASOVÁNÍ: [Názorová otázka]
MOŽNOSTI: Určitě ano | Spíše ano | Spíše ne | Určitě ne

ABC: [Další otázka]
OBRÁZEK: [vyber z dostupných vizuálů]
A) [možnost]
B) [možnost]
C) [správná odpověď] *
D) [možnost]

NÁSTĚNKA: [Reflexe - co jsme zjistili?]

INFO: ✅ Shrnutí
OBRÁZEK: [volitelně]
[3 klíčové body]

DOSTUPNÉ VIZUÁLY (použij 5-7 z nich!):
${allVisuals.join('\n')}

PRAVIDLA:
- Každý slide MUSÍ začínat: INFO: nebo HLASOVÁNÍ: nebo NÁSTĚNKA: nebo ABC:
- OBRÁZEK: přidej ke 4-5 slidům (INFO i ABC) - použij PŘESNÝ název z výše!
- Lekce musí být o konkrétním tématu "${dataSet.topic}", NE o obecných pojmech!
- Metodické téma vyber na základě faktů: ${factsList}
- MOŽNOSTI: jen u HLASOVÁNÍ kde chceš vlastní odpovědi
- ABC musí mít 4 možnosti, správná má * na konci`;

  try {
    const response = await chatWithAIProxy(
      [{ role: 'user', content: prompt }],
      'gemini-3-flash',
      { temperature: 0.7, max_tokens: 2048 }
    );
    
    const slides = parseTextToLessonSlides(response, dataSet);
    
    const quizId = `lesson-${Date.now()}`;
    
    const quiz: Quiz = {
      id: quizId,
      title: `Lekce: ${dataSet.topic}`,
      slides,
      settings: {
        showPoints: false,
        allowBack: true,
        shuffleSlides: false,
        shuffleOptions: false,
        timeLimit: null,
        passingScore: null,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Uložit - localStorage může selhat, proto přímý sync do Supabase
    try {
      _saveQz(quiz);
    } catch (e) {
      console.warn(`[Generator] localStorage failed for lesson ${quizId}:`, e);
    }
    
    // Přímý sync do Supabase
    const synced = await _syncQz(quiz);
    if (!synced) {
      console.warn(`[Generator] Supabase sync failed for lesson ${quizId}`);
    }
    
    // Vytvořit textový náhled
    const preview = slides.map((slide, i) => {
      const s = slide as any;
      const phaseLabel = i < 3 ? '🔵 EVOKACE' : (i < slides.length - 2 ? '🟢 UVĚDOMĚNÍ' : '🟣 REFLEXE');
      
      if (s.type === 'info') {
        const hasImage = s.layout?.blocks?.some((b: any) => b.type === 'image');
        const imgIcon = hasImage ? ' 🖼️' : '';
        const bgIcon = s.background ? ' 🎨' : '';
        return `${phaseLabel} | 📚 **${s.title || 'Info'}**${imgIcon}${bgIcon}\n${s.content?.replace(/<[^>]+>/g, '') || ''}`;
      } else if (s.activityType === 'voting') {
        return `${phaseLabel} | 📊 **Hlasování:** ${s.question}\n${s.options?.map((o: any) => `   ${o.label}) ${o.content}`).join('\n') || ''}`;
      } else if (s.activityType === 'board') {
        const imgIcon = s.questionImage ? ' 🖼️' : '';
        return `${phaseLabel} | 💬 **Nástěnka:**${imgIcon} ${s.question}`;
      } else if (s.activityType === 'abc') {
        const imgIcon = s.media?.url ? ' 🖼️' : '';
        return `${phaseLabel} | ❓ **ABC:**${imgIcon} ${s.question}\n${s.options?.map((o: any) => `   ${o.label}) ${o.content}${o.isCorrect ? ' ✓' : ''}`).join('\n') || ''}`;
      } else if (s.question) {
        return `${phaseLabel} | 💬 ${s.question}`;
      }
      return '';
    }).filter(Boolean).join('\n\n');
    
    console.log('[Generator] Lesson saved:', quizId);
    return { success: true, id: quizId, preview };
  } catch (err) {
    console.error('[Generator] Lesson error:', err);
    return { success: false, error: String(err) };
  }
}

function parseTextToLessonSlides(text: string, dataSet: TopicDataSet): QuizSlide[] {
  const slides: QuizSlide[] = [];
  
  // Předčistit text - odstranit SLIDE markery, markdown, HTML tagy
  let cleanedText = text
    // Odstranit SLIDE markery ve všech formátech
    .replace(/\*\*SLIDE\s*\d+[^*]*\*\*/gi, '\n')
    .replace(/SLIDE\s*\d+[:\-–]\s*[^\n]*/gi, '\n')
    // Odstranit markdown bold/italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // Odstranit HTML tagy
    .replace(/<\/?p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    // Odstranit separátory
    .replace(/---+/g, '\n')
    // Odstranit emoji před OBRÁZEK
    .replace(/🎨\s*OBRÁZEK:/gi, 'OBRÁZEK:')
    .replace(/🖼️\s*OBRÁZEK:/gi, 'OBRÁZEK:')
    // Vyčistit prázdné řádky
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  console.log('[Lesson Parser] Cleaned text preview:', cleanedText.substring(0, 300));
  
  // Rozdělit na bloky – delší varianty první (NÁSTĚNKA PRO A PROTI před NÁSTĚNKA, HLASOVÁNÍ OD-DO před HLASOVÁNÍ)
  const blockPattern = /(?=^INFO:|^NÁSTĚNKA PRO A PROTI:|^NÁSTĚNKA ÚKOL:|^NÁSTĚNKA:|^HLASOVÁNÍ OD-DO:|^HLASOVÁNÍ ZPĚTNÁ VAZBA:|^HLASOVÁNÍ:|^ABC:|^KVÍZ-VÝBĚR:|^KVÍZ:)/mi;
  const blocks = cleanedText.split(blockPattern).filter(block => block.trim());
  
  console.log('[Lesson Parser] Found', blocks.length, 'blocks');
  
  // Mapování barev pozadí
  const backgroundColors: Record<string, string> = {
    'blue': '#E3F2FD',
    'green': '#E8F5E9',
    'purple': '#F3E5F5',
    'orange': '#FFF3E0',
    'pink': '#FCE4EC',
    'yellow': '#FFFDE7',
  };
  
  blocks.forEach((block) => {
    const lines = block.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return;
    
    const firstLine = lines[0].trim();
    
    // Extrahovat metadata z bloku
    let imageUrl: string | undefined;
    let bgColor: string | undefined;
    let customOptions: string[] = [];
    
    for (const line of lines) {
      // Obrázek nebo ilustrace
      const imgMatch = line.match(/^OBRÁZEK:\s*(.+)/i);
      if (imgMatch) {
        const imageName = imgMatch[1].trim().toLowerCase();
        
        // Hledat v obrázcích
        const foundImage = dataSet.media?.images?.find(img => {
          const imgTitle = (img.title || '').toLowerCase();
          return imgTitle.includes(imageName) || imageName.includes(imgTitle) ||
                 imgTitle.replace(/[^a-z0-9]/g, '').includes(imageName.replace(/[^a-z0-9]/g, ''));
        });
        
        if (foundImage?.url) {
          imageUrl = foundImage.url;
        } else {
          // Hledat v ilustracích
          const foundIll = dataSet.media?.generatedIllustrations?.find(ill => {
            const illName = (ill.name || '').toLowerCase();
            return illName.includes(imageName) || imageName.includes(illName) ||
                   illName.replace(/[^a-z0-9]/g, '').includes(imageName.replace(/[^a-z0-9]/g, ''));
          });
          
          if (foundIll?.url) {
            imageUrl = foundIll.url;
            console.log('[Parser] ✅ Lesson found illustration:', imageName, '->', foundIll.name);
          }
        }
      }
      
      // Pozadí
      const bgMatch = line.match(/^POZADÍ:\s*(.+)/i);
      if (bgMatch) {
        const colorName = bgMatch[1].trim().toLowerCase();
        bgColor = backgroundColors[colorName] || colorName;
      }
      
      // Vlastní možnosti pro hlasování
      const optMatch = line.match(/^MOŽNOSTI:\s*(.+)/i);
      if (optMatch) {
        customOptions = optMatch[1].split('|').map(o => o.trim());
      }
    }
    
    // === INFO ===
    if (firstLine.match(/^INFO:/i)) {
      const title = firstLine.replace(/^INFO:\s*/i, '').trim();
      let content = '';
      
      for (let j = 1; j < lines.length; j++) {
        if (!lines[j].match(/^(OBRÁZEK|POZADÍ|MOŽNOSTI):/i)) {
          content += lines[j].trim() + ' ';
        }
      }
      
      console.log('[Lesson Parser] Creating INFO slide:', title, imageUrl ? '(with image)' : '');
      
      // Vytvořit slide - s 2 sloupci pokud je obrázek
      const layoutType = imageUrl ? 'title-2cols' : 'title-content';
      const slide: any = createInfoSlide(slides.length, layoutType as any);
      
      // Nastavit title a content do bloků
      if (slide.layout?.blocks) {
        // Blok 0 = title
        if (slide.layout.blocks[0]) {
          slide.layout.blocks[0].content = title || dataSet.topic;
        }
        // Blok 1 = content (text)
        if (slide.layout.blocks[1]) {
          slide.layout.blocks[1].content = content.trim();
        }
        // Blok 2 = obrázek (pokud je 2 sloupce)
        if (imageUrl && slide.layout.blocks[2]) {
          slide.layout.blocks[2].type = 'image';
          slide.layout.blocks[2].content = imageUrl;
        }
      }
      
      slide.title = title || dataSet.topic;
      slide.content = content.trim();
      
      if (bgColor) {
        slide.background = { type: 'color', value: bgColor };
      }
      
      slides.push(slide);
      return;
    }
    
    // === HLASOVÁNÍ ZPĚTNÁ VAZBA === (na konec lekce)
    if (firstLine.match(/^HLASOVÁNÍ ZPĚTNÁ VAZBA:/i)) {
      const question = firstLine.replace(/^HLASOVÁNÍ ZPĚTNÁ VAZBA:\s*/i, '').trim();
      console.log('[Lesson Parser] Creating VOTING feedback slide:', question);
      slides.push({
        ...createVotingSlide(slides.length, 'feedback'),
        question: question || 'Jak se vám v této lekci dařilo?',
        showResultsToStudents: true,
        feedbackStyle: 'emoji',
      } as any);
      return;
    }
    
    // === HLASOVÁNÍ OD-DO === (škála)
    if (firstLine.match(/^HLASOVÁNÍ OD-DO:/i)) {
      const question = firstLine.replace(/^HLASOVÁNÍ OD-DO:\s*/i, '').trim();
      let scaleMinLabel = 'Určitě ne';
      let scaleMaxLabel = 'Určitě ano';
      for (const line of lines.slice(1)) {
        const odMatch = line.match(/^Od:\s*(.+)/i);
        const doMatch = line.match(/^Do:\s*(.+)/i);
        if (odMatch) scaleMinLabel = odMatch[1].trim();
        if (doMatch) scaleMaxLabel = doMatch[1].trim();
      }
      console.log('[Lesson Parser] Creating VOTING scale slide:', question);
      const scaleSlide = createVotingSlide(slides.length, 'scale');
      slides.push({
        ...scaleSlide,
        question: question || 'Jak byste ohodnotili?',
        scaleMinLabel,
        scaleMaxLabel,
        showResultsToStudents: true,
      } as any);
      return;
    }
    
    // === HLASOVÁNÍ === (klasické A/B/C – možnosti musí odpovídat otázce!)
    if (firstLine.match(/^HLASOVÁNÍ:/i)) {
      const question = firstLine.replace(/^HLASOVÁNÍ:\s*/i, '').trim();
      // Parsovat možnosti z řádků A) B) C) D) (stejně jako u KVÍZ)
      const votingOptions: { id: string; label: string; content: string }[] = [];
      for (const line of lines) {
        const match = line.match(/^([A-D])\)\s*(.+)/i);
        if (match) {
          const content = match[2].trim().replace(/\*/g, '').trim();
          votingOptions.push({
            id: match[1].toLowerCase(),
            label: match[1].toUpperCase(),
            content,
          });
        }
      }
      const options =
        votingOptions.length >= 2
          ? votingOptions
          : customOptions.length >= 2
            ? customOptions.map((opt, i) => ({
                id: String.fromCharCode(97 + i),
                label: String.fromCharCode(65 + i),
                content: opt,
              }))
            : [
                { id: 'a', label: 'A', content: 'Ano' },
                { id: 'b', label: 'B', content: 'Ne' },
                { id: 'c', label: 'C', content: 'Nevím' },
              ];
      console.log('[Lesson Parser] Creating VOTING slide:', question, 'options:', options.length);
      slides.push({
        ...createVotingSlide(slides.length, 'single'),
        question,
        options,
        showResultsToStudents: true,
      } as any);
      return;
    }
    
    // === NÁSTĚNKA PRO A PROTI ===
    if (firstLine.match(/^NÁSTĚNKA PRO A PROTI:/i)) {
      const question = firstLine.replace(/^NÁSTĚNKA PRO A PROTI:\s*/i, '').trim();
      console.log('[Lesson Parser] Creating BOARD pros-cons slide:', question);
      slides.push({
        ...createBoardSlide(slides.length),
        question: question || 'Argumenty pro a proti',
        boardType: 'pros-cons',
        leftColumnLabel: 'Pro',
        rightColumnLabel: 'Proti',
        allowMedia: true,
        allowAnonymous: false,
      } as any);
      return;
    }
    
    // === NÁSTĚNKA ÚKOL === (krátký úkol, společná prezentace)
    if (firstLine.match(/^NÁSTĚNKA ÚKOL:/i)) {
      const question = firstLine.replace(/^NÁSTĚNKA ÚKOL:\s*/i, '').trim();
      console.log('[Lesson Parser] Creating BOARD presentation slide:', question);
      slides.push({
        ...createBoardSlide(slides.length),
        question: question || 'Krátký úkol – výsledky na nástěnku',
        boardType: 'presentation',
        allowMedia: true,
        allowAnonymous: false,
      } as any);
      return;
    }
    
    // === NÁSTĚNKA === (diskuze / brainstorming)
    if (firstLine.match(/^NÁSTĚNKA:/i)) {
      const question = firstLine.replace(/^NÁSTĚNKA:\s*/i, '').trim();
      console.log('[Lesson Parser] Creating BOARD slide:', question);
      
      slides.push({
        ...createBoardSlide(slides.length),
        question,
        boardType: 'text',
        allowMedia: true,
        allowAnonymous: false,
      } as any);
      return;
    }
    
    // === ABC / KVÍZ-VÝBĚR / KVÍZ ===
    if (firstLine.match(/^(ABC|KVÍZ-VÝBĚR|KVÍZ):/i)) {
      const question = firstLine.replace(/^(ABC|KVÍZ-VÝBĚR|KVÍZ):\s*/i, '').trim();
      console.log('[Lesson Parser] Creating ABC/KVÍZ slide:', question);
      const options: { id: string; label: string; content: string; isCorrect: boolean }[] = [];
      
      for (const line of lines) {
        const match = line.match(/^([A-D])\)\s*(.+)/i);
        if (match) {
          let content = match[2].trim();
          // Správná odpověď: hvězdička * NEBO text (správně), (správná), - správně, correct
          const hasStar = content.endsWith('*') || content.includes('*');
          const hasCorrectLabel = /\s*\(správn[áeě]\)|\s*-\s*správn[áeě]|\s*\(correct\)/i.test(content) || /správná odpověď/i.test(content);
          const isCorrect = hasStar || hasCorrectLabel;
          content = content
            .replace(/\*/g, '')
            .replace(/\s*\(správn[áeě]\)/gi, '')
            .replace(/\s*-\s*správn[áeě]/gi, '')
            .replace(/\s*\(correct\)/gi, '')
            .replace(/správná odpověď/gi, '')
            .trim();
          options.push({
            id: match[1].toLowerCase(),
            label: match[1].toUpperCase(),
            content,
            isCorrect,
          });
        }
      }
      
      // Pokud žádná možnost není označená jako správná, neoznačuj automaticky A – nech žádnou (nebo poslední s isCorrect)
      const anyCorrect = options.some(o => o.isCorrect);
      if (!anyCorrect && options.length > 0) {
        // Žádný fallback na A – necháme všechny false (v UI se pak může zobrazit jako bez správné odpovědi),
        // nebo můžeme označit prostřední jako „pravděpodobně“ – raději neoznačovat, aby bylo vidět, že AI neoznačila.
        // Pro zobrazení v kvízu musí být právě jedna true: některé systémy to vyžadují. Označíme první jen jako last resort.
        options[0].isCorrect = true;
        console.warn('[Lesson Parser] ABC: žádná správná odpověď označená (* nebo správně), použita A jako fallback');
      }
      // Pokud je označených víc než jedna, nech jen první označenou
      const correctCount = options.filter(o => o.isCorrect).length;
      if (correctCount > 1) {
        let first = true;
        for (const o of options) {
          if (o.isCorrect) {
            if (!first) o.isCorrect = false;
            first = false;
          }
        }
      }
      
      if (question && options.length >= 2) {
        slides.push({
          ...createABCSlide(slides.length),
          question,
          options,
          points: 1,
          ...(imageUrl ? { media: { type: 'image' as const, url: imageUrl } } : {}),
        });
      }
    }
  });
  
  // Pokud nejsou žádné slidy, vytvořit základní E-U-R strukturu
  if (slides.length === 0) {
    // Evokace - úvodní slide
    const introSlide: any = createInfoSlide(0, 'title-content');
    if (introSlide.layout?.blocks) {
      introSlide.layout.blocks[0].content = `🎯 ${dataSet.topic}`;
      introSlide.layout.blocks[1].content = `<p>Vítejte v badatelské lekci! Dnes společně objevíme téma: ${dataSet.topic}.</p>`;
    }
    introSlide.title = `🎯 ${dataSet.topic}`;
    introSlide.content = `<p>Vítejte v badatelské lekci! Dnes společně objevíme téma: ${dataSet.topic}.</p>`;
    slides.push(introSlide);
    
    // Evokace - hlasování
    slides.push({
      ...createVotingSlide(1, 'single'),
      question: `Co už víte o tématu ${dataSet.topic}?`,
      options: [
        { id: 'a', label: 'A', content: 'Hodně toho vím' },
        { id: 'b', label: 'B', content: 'Něco vím' },
        { id: 'c', label: 'C', content: 'Skoro nic' },
      ],
      showResults: true,
    } as any);
    
    // Evokace - nástěnka
    slides.push({
      ...createBoardSlide(2),
      question: `Co vás napadá, když se řekne "${dataSet.topic}"? 🤔`,
      boardType: 'text',
      allowMedia: true,
    } as any);
    
    // Uvědomění - klíčové informace
    if (dataSet.content?.keyFacts?.[0]) {
      const infoSlide: any = createInfoSlide(3, 'title-content');
      if (infoSlide.layout?.blocks) {
        infoSlide.layout.blocks[0].content = `📚 Klíčové informace`;
        infoSlide.layout.blocks[1].content = `<p>${dataSet.content.keyFacts.slice(0, 3).join(' ')}</p>`;
      }
      infoSlide.title = `📚 Klíčové informace`;
      infoSlide.content = `<p>${dataSet.content.keyFacts.slice(0, 3).join(' ')}</p>`;
      infoSlide.background = { type: 'color', value: '#E3F2FD' };
      slides.push(infoSlide);
    }
    
    // Reflexe - nástěnka
    slides.push({
      ...createBoardSlide(slides.length),
      question: `Co nového jste se dnes dozvěděli? Co vás překvapilo?`,
      boardType: 'text',
      allowMedia: false,
    } as any);
    
    // Reflexe - shrnutí
    const summarySlide: any = createInfoSlide(slides.length, 'title-content');
    if (summarySlide.layout?.blocks) {
      summarySlide.layout.blocks[0].content = '✅ Shrnutí';
      summarySlide.layout.blocks[1].content = `<p>Dnes jsme společně prozkoumali téma ${dataSet.topic}. Skvělá práce!</p>`;
    }
    summarySlide.title = '✅ Shrnutí';
    summarySlide.content = `<p>Dnes jsme společně prozkoumali téma ${dataSet.topic}. Skvělá práce!</p>`;
    slides.push(summarySlide);
  }
  
  return slides;
}

// =====================================================
// MULTIPLE LESSONS GENERATOR - Více lekcí na podtémata
// =====================================================

async function generateMultipleLessons(dataSet: TopicDataSet): Promise<GenerateResult> {
  console.log('[Generator] Generating multiple E-U-R lessons...');
  
  const context = buildContext(dataSet);
  const content = dataSet.content as any;
  const userTopics: string[] = content?.lessonTopics || [];
  const userBrief: string = (content?.lessonBrief || '').trim();

  let subtopics: string[] = [];

  // Režim podle zadání autora: jedna lekce na vybraná témata + popis
  if (userTopics.length > 0 || userBrief) {
    const singleTopic = userTopics.length > 0 ? userTopics[0] : dataSet.topic;
    subtopics = [singleTopic];
    console.log('[Generator] User-directed lesson, topic:', singleTopic, 'brief:', userBrief ? 'yes' : 'no');
  }

  // Když nemáme zadání od autora, AI navrhne podtémata
  if (subtopics.length === 0) {
    const subtopicsPrompt = `Pro téma "${dataSet.topic}" (${dataSet.grade}. třída) navrhni 2-3 konkrétní PODTÉMATA vhodná pro badatelské lekce.

KONTEXT:
${context}

Každé podtéma by mělo:
- Být specifické a zajímavé
- Umožňovat badatelský přístup
- Mít potenciál pro diskuzi a objevování

PŘÍKLADY pro "${dataSet.topic}":
${dataSet.topic.toLowerCase().includes('egypt') ? `
- "Společnost starověkého Egypta a podobnost s dnešní dobou"
- "Hieroglyfy - jejich význam a rozluštění"  
- "Nil a význam řek pro vznik civilizací"` : `
- První specifické podtéma související s ${dataSet.topic}
- Druhé specifické podtéma
- Třetí specifické podtéma`}

Vrať POUZE JSON pole s 2-3 podtématy:
["Podtéma 1", "Podtéma 2", "Podtéma 3"]`;

    try {
      const response = await chatWithAIProxy(
        [{ role: 'user', content: subtopicsPrompt }],
        'gemini-3-flash',
        { temperature: 0.7, max_tokens: 500 }
      );
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        subtopics = JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      console.error('[Generator] Failed to get subtopics:', err);
      subtopics = [dataSet.topic];
    }
    if (subtopics.length === 0) {
      subtopics = [dataSet.topic];
    }
  }

  console.log('[Generator] Subtopics:', subtopics);
  
  // 2. Pro každé podtéma vygenerovat lekci
  const lessons: any[] = [];
  const images = dataSet.media?.images || [];
  const illustrations = dataSet.media?.generatedIllustrations || [];
  
  for (let i = 0; i < subtopics.length; i++) {
    const subtopic = subtopics[i];
    console.log(`[Generator] Generating lesson ${i + 1}/${subtopics.length}: ${subtopic}`);
    
    // Rozdělit vizuály mezi lekce
    const startIdx = Math.floor(i * images.length / subtopics.length);
    const endIdx = Math.floor((i + 1) * images.length / subtopics.length);
    const lessonImages = images.slice(startIdx, endIdx);
    const lessonIllustrations = illustrations.slice(
      Math.floor(i * illustrations.length / subtopics.length),
      Math.floor((i + 1) * illustrations.length / subtopics.length)
    );
    
    const allVisuals = [
      ...lessonImages.map(img => `🖼️ "${img.title}"`),
      ...lessonIllustrations.map(ill => `🎨 "${ill.name}"`)
    ];
    
    const lessonPrompt = `Vytvoř BADATELSKOU E-U-R lekci na podtéma: "${subtopic}"
(Součást většího tématu: ${dataSet.topic}, ${dataSet.grade}. třída)

${userBrief ? `\n⚠️ ZADÁNÍ AUTORA (dodržuj přesně!):\n${userBrief}\n\n` : ''}

KONTEXT:
${context}

${allVisuals.length > 0 ? `🖼️ DOSTUPNÉ VIZUÁLY (použij 3-5):\n${allVisuals.join('\n')}` : ''}

STRUKTURA LEKCE (E-U-R metoda – důsledně dodržuj):
1. EVOKACE (5–7 min): Aktivace předchozích znalostí, provokativní otázka. Použij NÁSTĚNKU (brainstorming) a/nebo HLASOVÁNÍ (tipování).
2. UVĚDOMĚNÍ (20–25 min): Hlavní badatelská aktivita, práce s materiály. Střídej INFO (výklad), KVÍZ (ověření), NÁSTĚNKU (diskuze, krátké úkoly, pro a proti) a HLASOVÁNÍ (názor, škála od–do).
3. REFLEXE (8–10 min): Shrnutí, diskuze, propojení s dneškem. NÁSTĚNKA (co jsme zjistili), na závěr HLASOVÁNÍ ZPĚTNÁ VAZBA (jak se vám dařilo).

PRAVIDLA:
- Více diskuzních a samostatných aktivit: nástěnky (diskuze, krátké úkoly, pro a proti), hlasování v různých typech.
- Rozmanitost: použij alespoň 2× NÁSTĚNKA (různé typy), 2× HLASOVÁNÍ (různé typy), 1–2× KVÍZ, zbytek INFO. Celkem 10–14 slidů.
- Na konec lekce vždy zařaď HLASOVÁNÍ ZPĚTNÁ VAZBA (zpětná vazba žáků).

DOSTUPNÉ TYPY SLIDŮ (piš přesně tyto značky):

INFO: Nadpis
Obsah jako prostý text. Bez markdown, bez HTML.
OBRÁZEK: název obrázku

KVÍZ: Otázka?
A) Odpověď 1
B) Odpověď 2 *
C) Odpověď 3
(Správná odpověď = ta s hvězdičkou * na konci. Může být A, B, C nebo D – vždy označ skutečně správnou!)

NÁSTĚNKA: Otázka k diskuzi? (brainstorming, žáci píší nápady)

NÁSTĚNKA PRO A PROTI: Otázka k argumentaci?
(žáci píší argumenty do sloupců Pro / Proti)

NÁSTĚNKA ÚKOL: Krátký úkol – např. Připravte jeden slide na téma X. Společná prezentace.
(úkol pro skupiny, výsledek na nástěnku)

HLASOVÁNÍ: Názorová otázka? (VŽDY napiš konkrétní možnosti A) B) C) odpovídající otázce – nikdy ne Ano/Ne/Nevím!)
A) Konkrétní odpověď 1
B) Konkrétní odpověď 2
C) Konkrétní odpověď 3

HLASOVÁNÍ OD-DO: Otázka se škálou?
Od: Určitě ne
Do: Určitě ano

HLASOVÁNÍ ZPĚTNÁ VAZBA: Jak se vám v této lekci dařilo?
(použij na konec lekce – emoji reakce)

DŮLEŽITÉ:
- Každý slide začíná typem (INFO / KVÍZ / NÁSTĚNKA / … / HLASOVÁNÍ / …). Žádné "SLIDE 1:", markdown ani HTML.
- U HLASOVÁNÍ (ne OD-DO, ne ZPĚTNÁ VAZBA) vždy napiš A) B) C) s konkrétními možnostmi. Nikdy Ano/Ne/Nevím.
- U KVÍZ: Správná odpověď musí být označená hvězdičkou * na konci řádku. Správná může být kterákoli z A/B/C/D – podle skutečnosti, ne vždy A!
- Střídej výklad (INFO) s interaktivními slidy. E-U-R fáze dodržuj v pořadí.`;

    try {
      const response = await chatWithAIProxy(
        [{ role: 'user', content: lessonPrompt }],
        'gemini-3-flash',
        { temperature: 0.7, max_tokens: 3000 }
      );
      
      // Parse response do slidů
      const slides = parseTextToLessonSlides(response, {
        ...dataSet,
        media: {
          ...dataSet.media,
          images: lessonImages,
          generatedIllustrations: lessonIllustrations
        }
      });
      
      if (slides.length > 0) {
        lessons.push({
          subtopic,
          slides,
          rawResponse: response
        });
      }
    } catch (err) {
      console.error(`[Generator] Failed to generate lesson for ${subtopic}:`, err);
    }
  }
  
  if (lessons.length === 0) {
    return { success: false, error: 'Nepodařilo se vygenerovat žádnou lekci' };
  }
  
  // 3. Uložit všechny lekce pomocí saveQuiz (do IndexedDB/Supabase)
  const savedIds: string[] = [];
  
  for (const lesson of lessons) {
    const quizId = `lesson-${dataSet.id}-${crypto.randomUUID().slice(0, 8)}`;
    
    const quiz: Quiz = {
      id: quizId,
      title: `Interaktivní lekce: ${lesson.subtopic}`,
      slides: lesson.slides,
      settings: {
        showProgress: true,
        showScore: true,
        allowSkip: true,
        allowBack: true,
        shuffleQuestions: false,
        shuffleOptions: false,
        showExplanations: 'immediately',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Přímý sync do Supabase (localStorage má quota limit)
    // saveQuiz může selhat, proto ukládáme přímo do Supabase
    try {
      _saveQz(quiz); // Pokus o localStorage (může selhat)
    } catch (e) {
      console.warn(`[Generator] localStorage failed for ${quizId}:`, e);
    }
    
    // Přímý sync do Supabase s quiz objektem (nezávisí na localStorage)
    const synced = await _syncQz(quiz);
    if (synced) {
      console.log(`[Generator] ✅ Lesson synced to Supabase: ${quizId}`);
      savedIds.push(quizId);
    } else {
      console.error(`[Generator] ❌ Failed to sync lesson to Supabase: ${quizId}`);
    }
    
    console.log(`[Generator] Lesson saved: ${quizId} - ${lesson.subtopic}`);
  }
  
  // Vrátit info o všech lekcích
  const preview = lessons.map((l, i) => `${i + 1}. ${l.subtopic} (${l.slides.length} slidů)`).join('\n');
  
  // Přeskočit localStorage (quota exceeded) - data jsou v Supabase
  console.log('[Generator] Lessons saved to Supabase:', savedIds);
  
  return { 
    success: true, 
    id: savedIds[0], // První jako hlavní
    preview: `Vytvořeno ${lessons.length} lekcí:\n${preview}`
  };
}

// =====================================================
// METHODOLOGY GENERATOR - Metodická inspirace
// =====================================================

async function generateMethodology(dataSet: TopicDataSet): Promise<GenerateResult> {
  console.log('[Generator] Generating methodology...');
  
  const feedback = getFeedbackForType('methodology');
  
  // Připravit strukturovaná data z datasetu
  const rvpOutputs = dataSet.rvp?.expectedOutcomes?.join('\n- ') || 'Nejsou specifikovány';
  const keyTermsList = dataSet.content?.keyTerms?.map(t => `**${t.term}** – ${t.definition}`).join('\n') || '';
  const keyFactsList = dataSet.content?.keyFacts?.join('\n- ') || '';
  const personalitiesList = dataSet.content?.personalities?.map((p: any) => `**${p.name}** – ${p.description}`).join('\n') || '';
  const timelineList = dataSet.content?.timeline?.map((e: any) => `**${e.year || e.date}** – ${e.event || e.description}`).join('\n') || '';
  
  const prompt = `Napiš METODICKOU INSPIRACI pro učitele k tématu "${dataSet.topic}" pro ${dataSet.grade}. třídu.

${feedback}

Toto je přehled pro učitele - jak téma uchopit, na co se zaměřit, jaké aktivity zařadit.

POVINNÁ STRUKTURA:

## 📋 Anotace tématu
Stručný přehled tématu (3-4 věty). Proč je téma důležité? Jak se pojí s dalším učivem?

## 🎯 Očekávané výstupy dle RVP
${rvpOutputs ? `Relevantní výstupy z RVP:\n- ${rvpOutputs}` : 'Formuluj 3-4 konkrétní výstupy, co žáci budou umět.'}

## 📚 Klíčové pojmy
${keyTermsList || 'Vypiš 5-8 klíčových pojmů s definicemi.'}

## 📖 Faktografický přehled
Základní fakta k tématu, která by měl učitel znát:
${keyFactsList ? `- ${keyFactsList}` : '- Vypiš 8-10 klíčových faktů'}

${personalitiesList ? `### Významné osobnosti\n${personalitiesList}\n` : ''}
${timelineList ? `### Časová osa\n${timelineList}\n` : ''}

## 🎓 Didaktické poznámky
INFOBOX zelený: Jak téma uchopit
Napiš 2-3 věty o tom, jak téma představit žákům zajímavě.

INFOBOX oranžový: Na co si dát pozor
Uveď typické miskoncepce nebo obtížná místa.

## 💡 Náměty na aktivity
Navrhni 3-4 konkrétní aktivity:
1. **Evokace** – aktivita na začátek hodiny
2. **Hlavní aktivita** – práce s učivem
3. **Reflexe** – závěrečná aktivita
4. **Rozšíření** – pro rychlejší žáky

## 🔗 Mezipředmětové vztahy
Jak téma souvisí s jinými předměty (zeměpis, výtvarná výchova, český jazyk...)?

## 📎 Materiály Vividbooks
K tomuto tématu máte k dispozici tyto materiály:
- 📖 **Učební text** – Výkladový text pro žáky s obrázky a infoboxy
- 🎮 **Procvičování (lehké)** – Interaktivní kvíz pro slabší žáky
- 🎯 **Procvičování (těžké)** – Náročnější kvíz pro pokročilé
- 📝 **Pracovní list** – Tisknutelný pracovní list s aktivitami
- ✏️ **Písemka** – Test pro ověření znalostí
- 🎓 **Lekce E-U-R** – Kompletní interaktivní lekce podle metody E-U-R

Všechny materiály najdete v knihovně Vividbooks pod tématem "${dataSet.topic}".

PRAVIDLA:
- Piš profesionálně, ale přístupně
- INFOBOX zelený/oranžový pro zvýraznění tipů a upozornění
- Využij data z podkladů (pojmy, fakta, osobnosti, časová osa)
- Zaměř se na praktické využití v hodině`;

  try {
    const response = await chatWithAIProxy(
      [{ role: 'user', content: prompt }],
      'gemini-3-flash',
      { temperature: 0.7, max_tokens: 3000 }
    );
    
    console.log('[Generator] Methodology raw response:', response.substring(0, 500));
    
    // Převést INFOBOX na HTML callout
    const calloutTypeMap: Record<string, string> = {
      'modrý': 'info',
      'červený': 'danger',
      'zelený': 'tip',
      'oranžový': 'warning',
      'fialový': 'summary',
    };
    
    let processedResponse = response.replace(
      /INFOBOX (modrý|červený|zelený|oranžový|fialový):\s*(.+?)(?:\n([^\n#]*))?(?=\n\n|\n##|$)/gim,
      (match, color, title, content) => {
        const calloutType = calloutTypeMap[color.toLowerCase()] || 'info';
        const contentText = content ? content.trim() : '';
        return `\n<div data-type="callout" data-callout-type="${calloutType}" class="callout callout-${calloutType}"><p><strong>${title.trim()}</strong></p>${contentText ? `<p>${contentText}</p>` : ''}</div>\n`;
      }
    );
    
    // Převést Markdown na HTML
    const html = markdownToHtml(processedResponse);
    
    const docId = crypto.randomUUID();
    
    const docData = {
      id: docId,
      title: `${dataSet.topic} – Metodická inspirace`,
      content: html,
      documentType: 'methodology',
      sectionImages: [],
    };
    
    // Uložit - localStorage může selhat, proto přímý sync do Supabase
    try {
      localStorage.setItem(`vivid-doc-${docId}`, JSON.stringify(docData));
    } catch (e) {
      console.warn(`[Generator] localStorage failed for methodology ${docId}:`, e);
    }
    
    // Přímý sync do Supabase
    const synced = await syncDocumentDirectToSupabase(docData);
    if (!synced) {
      console.warn(`[Generator] Supabase sync failed for methodology ${docId}`);
    }
    
    // Náhled
    const preview = processedResponse
      .replace(/INFOBOX (modrý|červený|zelený|oranžový):\s*/gi, '📦 ')
      .replace(/<[^>]+>/g, '');
    
    console.log('[Generator] Methodology saved:', docId);
    return { success: true, id: docId, preview };
  } catch (err) {
    console.error('[Generator] Methodology error:', err);
    return { success: false, error: String(err) };
  }
}

// =====================================================
// HODNOCENÍ GENERATOR – Výstupní dokument uzávěru
// "Co se žáci naučili" – jednoduchý přehled pro učitele
// =====================================================

async function generateHodnoceni(dataSet: TopicDataSet): Promise<GenerateResult> {
  console.log('[Generator] Generating hodnoceni...');

  // coveredTopics jsou uloženy jako keyFacts v buildDataSetObject pro milestone
  const coveredTopics = (dataSet.content?.keyFacts || [])
    .map((f: any) => (typeof f === 'string' ? f.replace(/^Téma:\s*/i, '') : f.topic || f))
    .filter(Boolean);

  const rvpOutputs = dataSet.rvp?.expectedOutcomes?.join('\n- ') || '';
  const keyTermsList = (dataSet.content?.keyTerms || [])
    .map((t: any) => typeof t === 'string' ? t : t.term)
    .filter(Boolean)
    .join(', ');

  const topicsBlock = coveredTopics.length > 0
    ? coveredTopics.map((t: string) => `- ${t}`).join('\n')
    : `- ${dataSet.topic}`;

  const prompt = `Napiš VÝSTUPNÍ HODNOCENÍ uzávěru tematického bloku "${dataSet.topic}" pro ${dataSet.grade}. třídu.

Tematický blok zahrnoval tato témata:
${topicsBlock}

${rvpOutputs ? `Očekávané výstupy dle RVP:\n- ${rvpOutputs}\n` : ''}
${keyTermsList ? `Klíčové pojmy: ${keyTermsList}\n` : ''}

POVINNÁ STRUKTURA:

## ✅ Co žáci po absolvování bloku znají a umí

Napiš 6–10 konkrétních bodů. Každý začíná "Žák..."
Příklady: "Žák vysvětlí...", "Žák popíše...", "Žák rozlišuje...", "Žák ukáže na mapě..."

## 📝 Kritéria hodnocení

Pro KAŽDÝ ze 3 typů škol napiš hodnocení pro stupně 1–5.
Struktura pro každý typ školy:

### 🏫 ZŠ praktická / speciální
**1 – Výborný:** Co přesně žák zvládne (jednodušší nároky, základní pojmy)
**2 – Chvalitebný:** ...
**3 – Dobrý:** ...
**4 – Dostatečný:** ...
**5 – Nedostatečný:** Co žák nezvládl

### 🏫 ZŠ standardní
**1 – Výborný:** Co přesně žák zvládne (standardní nároky RVP)
**2 – Chvalitebný:** ...
**3 – Dobrý:** ...
**4 – Dostatečný:** ...
**5 – Nedostatečný:** Co žák nezvládl

### 🏫 Gymnázium
**1 – Výborný:** Co přesně žák zvládne (rozšiřující nároky, aplikace, analýza)
**2 – Chvalitebný:** ...
**3 – Dobrý:** ...
**4 – Dostatečný:** ...
**5 – Nedostatečný:** Co žák nezvládl

## 🔑 Klíčové pojmy

Vypiš 8–12 nejdůležitějších pojmů které žák musí znát.

INFOBOX oranžový: Na co si dát pozor
Typické chyby nebo obtížná místa v tomto bloku.

PRAVIDLA:
- Každé kritérium = 1–2 konkrétní věty, ne obecné fráze
- Kritéria musí být MĚŘITELNÁ ("žák vyjmenuje 3 planety" ne "žák chápe")
- Liš obtížnost mezi typy škol (speciální = základní pojmy, gymnázium = analýza, vztahy, aplikace)`;

  try {
    const response = await chatWithAIProxy(
      [{ role: 'user', content: prompt }],
      'gemini-3-pro',
      { temperature: 0.5, max_tokens: 6000 }
    );

    const calloutTypeMap: Record<string, string> = {
      'modrý': 'info', 'červený': 'danger', 'zelený': 'tip', 'oranžový': 'warning', 'fialový': 'summary',
    };
    let processedResponse = response.replace(
      /INFOBOX (modrý|červený|zelený|oranžový|fialový):\s*(.+?)(?:\n([^\n#]*))?(?=\n\n|\n##|$)/gim,
      (_match, color, title, content) => {
        const calloutType = calloutTypeMap[color.toLowerCase()] || 'info';
        const contentText = content ? content.trim() : '';
        return `\n<div data-type="callout" data-callout-type="${calloutType}" class="callout callout-${calloutType}"><p><strong>${title.trim()}</strong></p>${contentText ? `<p>${contentText}</p>` : ''}</div>\n`;
      }
    );

    const html = markdownToHtml(processedResponse);
    const docId = crypto.randomUUID();
    const docData = {
      id: docId,
      title: `${dataSet.topic} – Výstupní dokument`,
      content: html,
      documentType: 'hodnoceni',
      sectionImages: [],
    };

    try { localStorage.setItem(`vivid-doc-${docId}`, JSON.stringify(docData)); } catch (e) { /* ignore */ }
    const synced = await syncDocumentDirectToSupabase(docData);
    if (!synced) console.warn(`[Generator] Supabase sync failed for hodnoceni ${docId}`);

    const preview = processedResponse.replace(/<[^>]+>/g, '').substring(0, 200);
    console.log('[Generator] Hodnoceni saved:', docId);
    return { success: true, id: docId, preview };
  } catch (err) {
    console.error('[Generator] Hodnoceni error:', err);
    return { success: false, error: String(err) };
  }
}

// =====================================================
// ILLUSTRATION PROMPT GENERATOR
// =====================================================

// Styl pro všechny ilustrace - Ligne Claire (Tintin style)
export const ILLUSTRATION_STYLE = `Create educational illustration in Ligne Claire style (like Tintin comics):

LINE ART:
- Dead line technique - consistent line weight, no pressure variation
- Clean, technical, organized appearance
- Every object clearly outlined with black or dark gray contour
- Closed shapes with clear boundaries

COLORS & SHADING:
- Limited pastel palette with vibrant, professional colors
- Flat design - no gradients, large areas of single color
- Minimal hard-edged shadows only (sharply defined darker blocks, no blur)
- Often no shading at all for clarity

COMPOSITION:
- Stylized anatomy - simplified features but proportional
- Static, calm poses - frontal or slight profile view
- Icon/infographic feel
- Pure white background (negative space)
- Clean, clear, aesthetically pleasing

TECHNICAL:
- 800x800 pixels
- Educational and professional look
- Suitable for school materials

TEXT:
- If the subject or description includes any text, labels, numbers, or annotations — include them in the image
- Render all text in a simple geometric grotesque sans-serif typeface (like Futura or Avenir)
- Text must be clean, minimal, and clearly legible — no decorative or serif fonts`;

// =====================================================
// PHOTO GENERATION (Fotorealistické fotky + historická selfie)
// =====================================================

const PHOTO_STYLE = `Generate a REAL PHOTOGRAPH that looks like it was taken by a regular person with a good camera, NOT a studio production.

LOOK & FEEL:
- Candid, authentic, unstaged — like a travel blog or school textbook photo
- Natural ambient lighting (sunlight, overcast sky, indoor daylight from windows)
- Slight imperfections: minor lens flare, soft vignetting, gentle noise/grain in shadows
- Warm, natural color palette — no oversaturated colors, no HDR look
- Shallow-to-medium depth of field (f/2.8–f/5.6), gentle background bokeh

CAMERA CHARACTERISTICS:
- Shot on a mirrorless camera or quality smartphone (natural perspective, ~35-50mm equivalent)
- Slightly off-center or rule-of-thirds composition — NOT perfectly centered or symmetrical
- Natural white balance (slightly warm in golden hour, slightly cool in shade)
- NO studio lighting, NO ring light reflections in eyes, NO perfectly even illumination

REALISM MARKERS:
- Real textures: dust, weathering, patina, fabric creases, skin texture with pores and fine lines
- Environmental context: background tells a story (other people, furniture, landscape, buildings)
- Motion hints where appropriate: slight motion blur on moving hands, wind in hair/clothes
- Realistic scale relationships between objects

STRICTLY FORBIDDEN:
- Illustration, drawing, cartoon, anime, digital art, painting, vector art
- Plastic/waxy skin, uncanny valley faces, symmetrical perfection
- Hyper-sharpened details, HDR tone mapping, neon-bright colors
- Studio backdrop, isolated subjects on plain backgrounds
- Stock photo poses (pointing at camera, corporate handshake, thumbs up)`;

const SELFIE_STYLE = `Generate a GROUP SELFIE photograph from the camera's point of view.
COMPOSITION:
- Camera POV: We ARE the camera/phone - looking directly at the group
- 3-5 historical people gathered together, smiling at the camera
- Close-up framing: faces fill most of the frame
- Slight wide-angle distortion typical of phone selfies
- Some people slightly cut off at edges (natural selfie cropping)
- One person's arm may be partially visible at bottom edge (holding the invisible camera)

STYLE:
- Photorealistic, natural lighting, candid feel
- Happy expressions, looking directly at camera
- Authentic historical clothing and environment visible behind them
- NO phone or device visible anywhere in the image

FORBIDDEN: visible phone, visible camera, illustration, cartoon, third-person view`;

export interface PhotoPrompt {
  id: string;
  name: string;
  category: 'selfie' | 'scene' | 'portrait' | 'artifact' | 'location';
  keywords: string[];
  description: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  generatedUrl?: string;
}

export async function generatePhotoPrompts(dataSet: TopicDataSet): Promise<PhotoPrompt[]> {
  console.log('[Generator] Generating photo prompts for:', dataSet.topic);
  
  const keyTerms = dataSet.content?.keyTerms?.map(t => t.term).join(', ') || '';
  const personalities = dataSet.content?.personalities?.map((p: any) => p.name).join(', ') || '';
  const keyFacts = dataSet.content?.keyFacts?.slice(0, 5).join('; ') || '';
  
  const prompt = `Pro vzdělávací materiály k tématu "${dataSet.topic}" (${dataSet.grade}. třída) navrhni 5-8 fotorealistických fotografií.

KONTEXT TÉMATU:
- Klíčové pojmy: ${keyTerms}
- Osobnosti: ${personalities}
- Fakta: ${keyFacts}

DŮLEŽITÉ: PRVNÍ FOTKA MUSÍ BÝT "HISTORICKÉ SELFIE"!
= Fotorealistická fotka kde si typický člověk z té doby dělá selfie mobilem.
= Ukazuje autentické oblečení, účes, prostředí té doby.
= Je to vtipný anachronismus ale vzdělávací - žáci uvidí jak lidé vypadali.

Pro každou fotku uveď:
FOTKA: [název česky]
KATEGORIE: [selfie/scene/portrait/artifact/location]
KLÍČOVÁ SLOVA: [3-5 slov česky]
POPIS: [detailní popis česky - co přesně má být na fotce, jaké detaily]

TYPY FOTOGRAFIÍ:
1. **Selfie** (selfie) - POVINNÉ! Člověk z doby si dělá selfie telefonem
2. **Scéna** (scene) - autentická scéna z každodenního života
3. **Portrét** (portrait) - fotorealistický portrét osobnosti nebo typické osoby
4. **Artefakt** (artifact) - detailní fotka historického předmětu
5. **Místo** (location) - rekonstrukce historického místa/architektury

PŘÍKLAD PRO STAROVĚKÝ EGYPT:
FOTKA: Selfie egyptského písaře
KATEGORIE: selfie
KLÍČOVÁ SLOVA: písař, papyrus, hieroglyfy, bílá suknice
POPIS: Mladý egyptský písař si dělá selfie. Má oholenou hlavu, na sobě bílou lněnou suknici. V pozadí je vidět chrám s hieroglyfy. Drží smartphone a usmívá se do kamery.

FOTKA: Denní trh v Memphisu
KATEGORIE: scene
KLÍČOVÁ SLOVA: trh, obchodníci, ovoce, Nil
POPIS: Rušný trh ve starověkém egyptském městě. Obchodníci prodávají ovoce a látky. V pozadí palmy a pohled na Nil.

Navrhni 5-8 fotek (první MUSÍ být selfie):`;

  try {
    const response = await chatWithAIProxy(
      [{ role: 'user', content: prompt }],
      'gemini-3-flash',
      { temperature: 0.8, max_tokens: 2048 }
    );
    
    console.log('[Generator] Photo prompts raw:', response.substring(0, 400));
    
    const prompts: PhotoPrompt[] = [];

    // Pokus 1: parsovat textový formát FOTKA:/KATEGORIE:/POPIS:
    const blocks = response.split(/(?=FOTKA:)/gi).filter(b => b.trim());
    for (const block of blocks) {
      const nameMatch = block.match(/FOTKA:\s*\*{0,2}(.+?)\*{0,2}\s*\n/i);
      const categoryMatch = block.match(/KATEGORIE:\s*\*{0,2}(.+?)\*{0,2}\s*\n/i);
      const keywordsMatch = block.match(/KL[IÍ][CČ]OV[AÁ]\s+SLOVA:\s*(.+)/i);
      const descMatch = block.match(/POPIS:\s*([\s\S]+?)(?=FOTKA:|$)/i);
      
      if (nameMatch && descMatch) {
        const categoryRaw = (categoryMatch?.[1] ?? '').trim().toLowerCase();
        const category = (['selfie', 'scene', 'portrait', 'artifact', 'location'] as const).includes(categoryRaw as any)
          ? categoryRaw as PhotoPrompt['category']
          : 'scene';
        prompts.push({
          id: crypto.randomUUID(),
          name: nameMatch[1].trim(),
          category,
          keywords: keywordsMatch?.[1]?.split(',').map((k: string) => k.trim()).filter(Boolean) || [],
          description: descMatch[1].trim(),
          status: 'pending',
        });
      }
    }

    // Pokus 2: fallback – pokud AI vrátilo JSON pole
    if (prompts.length === 0) {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const arr = JSON.parse(jsonMatch[0]);
          for (const item of arr) {
            if (item.name || item.title || item.description) {
              prompts.push({
                id: crypto.randomUUID(),
                name: item.name || item.title || 'Fotka',
                category: (['selfie', 'scene', 'portrait', 'artifact', 'location'] as const).includes(item.category)
                  ? item.category : 'scene',
                keywords: Array.isArray(item.keywords) ? item.keywords : [],
                description: item.description || item.popis || '',
                status: 'pending',
              });
            }
          }
        } catch { /* silent */ }
      }
    }

    // Pokus 3: fallback – vygenerovat znovu jako JSON
    if (prompts.length === 0) {
      console.warn('[Generator] Text parsing failed, retrying as JSON...');
      const jsonPrompt = `Navrhni 6 fotorealistických fotografií pro vzdělávací téma "${dataSet.topic}" (${dataSet.grade}. třída).
Vrať POUZE JSON pole:
[{"name":"název","category":"selfie|scene|portrait|artifact|location","keywords":["slovo1","slovo2"],"description":"detailní popis fotky"}]
První fotka musí být "selfie" – člověk z tématu si dělá selfie s mobilem. POUZE JSON.`;
      const jsonResp = await chatWithAIProxy([{ role: 'user', content: jsonPrompt }], 'gemini-3-flash');
      const jm = jsonResp.match(/\[[\s\S]*\]/);
      if (jm) {
        try {
          const arr = JSON.parse(jm[0]);
          for (const item of arr) {
            prompts.push({
              id: crypto.randomUUID(),
              name: item.name || item.title || 'Fotka',
              category: (['selfie', 'scene', 'portrait', 'artifact', 'location'] as const).includes(item.category)
                ? item.category : 'scene',
              keywords: Array.isArray(item.keywords) ? item.keywords : [],
              description: item.description || '',
              status: 'pending',
            });
          }
        } catch { /* silent */ }
      }
    }
    
    console.log('[Generator] Generated photo prompts:', prompts.length);
    return prompts;
    
  } catch (err) {
    console.error('[Generator] Photo prompts error:', err);
    return [];
  }
}

export async function generatePhoto(prompt: PhotoPrompt, dataSet: TopicDataSet, model: 'pro' | 'flash' = 'flash'): Promise<string | null> {
  console.log('[Generator] Generating photo:', prompt.name);
  
  const { generateImageWithImagen } = await import('../ai-chat-proxy');
  
  // Vybrat správný styl podle kategorie
  const stylePrompt = prompt.category === 'selfie' ? SELFIE_STYLE : PHOTO_STYLE;
  
  // DŮLEŽITÉ: Použít POUZE styl pro fotky, nepoužívat ILLUSTRATION_STYLE
  const fullPrompt = `${stylePrompt}

SUBJECT: ${prompt.name}
CONTEXT: ${dataSet.topic}
SCENE: ${prompt.description}
DETAILS: ${prompt.keywords.join(', ')}

OUTPUT: Ultra-realistic 8K photograph, documentary style. NO illustration, NO cartoon, NO digital art.`;

  try {
    const result = await generateImageWithImagen(fullPrompt, {
      aspectRatio: '1:1',
      numberOfImages: 1,
      dataSetId: dataSet.id,
      illustrationName: `📷 ${prompt.name}`,
      model,
    });
    
    if (result.success && (result.url || result.images?.[0]?.base64)) {
      let rawImageUrl = result.url || `data:${result.images?.[0]?.mimeType || 'image/png'};base64,${result.images?.[0]?.base64}`;
      
      // Upload do Storage místo ukládání base64 do DB
      const { processImageUrl } = await import('../supabase/upload-image');
      const imageUrl = await processImageUrl(rawImageUrl, `${dataSet.id}-${prompt.id}`, 'photos');
      
      // Kontrola - pokud upload selhal, nevrátit nic
      if (!imageUrl) {
        console.error('[Generator] Photo upload to storage failed');
        return null;
      }
      
      console.log('[Generator] Photo generated successfully:', imageUrl.substring(0, 100) + '...');
      return imageUrl;
    } else {
      console.error('[Generator] Photo generation failed:', result.error || 'No image data returned');
      return null;
    }
  } catch (err) {
    console.error('[Generator] Photo generation error:', err);
    return null;
  }
}

// =====================================================
// ILLUSTRATION PROMPTS
// =====================================================

export async function generateIllustrationPrompts(dataSet: TopicDataSet, withLabels: boolean = false): Promise<IllustrationPrompt[]> {
  console.log('[Generator] Generating illustration prompts for:', dataSet.topic);
  
  // Připravit kontext z datasetu
  const keyTerms = dataSet.content?.keyTerms?.map(t => t.term).join(', ') || '';
  const personalities = dataSet.content?.personalities?.map((p: any) => p.name).join(', ') || '';
  const keyFacts = dataSet.content?.keyFacts?.slice(0, 5).join('; ') || '';
  
  const prompt = `Pro vzdělávací materiály k tématu "${dataSet.topic}" (${dataSet.grade}. třída) navrhni 8-12 ilustrací.

KONTEXT TÉMATU:
- Klíčové pojmy: ${keyTerms}
- Osobnosti: ${personalities}
- Fakta: ${keyFacts}

Pro každou ilustraci uveď:
ILUSTRACE: [název česky]
KATEGORIE: [icon/portrait/object/scene/map]
KLÍČOVÁ SLOVA: [3-5 slov česky]
POPIS: [detailní popis česky - 2-3 věty]

TYPY ILUSTRACÍ:
1. **Ikony** (icon) - jednoduché symboly: helma, štít, váza, sloup, mince
2. **Portréty** (portrait) - stylizované postavy: filosof, válečník, panovník
3. **Objekty** (object) - artefakty: zbraně, nástroje, šperky, architektura
4. **Scény** (scene) - situace: bitva, agora, obchod, škola
5. **Mapy** (map) - stylizované mapy území

PŘÍKLAD:
ILUSTRACE: Řecká helma hoplíta
KATEGORIE: icon
KLÍČOVÁ SLOVA: helma, hoplít, válečník, bronz
POPIS: Bronzová korintská přilba řeckého hoplíty zobrazená z boku, s červeným chocholem z koňských žíní, čistá minimalistická ilustrace.

Navrhni ilustrace pokrývající různé aspekty tématu. Soustřeď se na vizuálně zajímavé a edukativně hodnotné náměty. Vše piš v češtině.`;

  const buildPrompt = (name: string, description: string, category: string): IllustrationPrompt => {
    const labelInstruction = withLabels
      ? `\n\nTEXT LABEL: Add a clean, short Czech label directly on the illustration. Use simple sans-serif font, bold, dark color, placed at the bottom or beside the main element. Label text: "${name}"`
      : `\n\nNO TEXT: Do not include any text, words, letters or labels in the illustration.`;
    return {
      id: crypto.randomUUID(),
      name,
      prompt: `${description}${labelInstruction}\n\nStyle requirements:\n${ILLUSTRATION_STYLE}`,
      category: (['icon', 'portrait', 'object', 'scene', 'map'] as const).includes(category as any)
        ? category as IllustrationPrompt['category'] : 'icon',
      keywords: [],
      status: 'pending',
    };
  };

  try {
    const response = await chatWithAIProxy(
      [{ role: 'user', content: prompt }],
      'gemini-3-flash',
      { temperature: 0.8, max_tokens: 2500 }
    );
    
    console.log('[Generator] Illustration prompts raw:', response.substring(0, 500));
    
    const prompts: IllustrationPrompt[] = [];

    // Pokus 1: textový formát ILUSTRACE:/KATEGORIE:/POPIS:
    const blocks = response.split(/(?=ILUSTRACE:)/i).filter(b => b.trim());
    for (const block of blocks) {
      const nameMatch = block.match(/ILUSTRACE:\s*\*{0,2}(.+?)\*{0,2}\s*\n/i);
      const categoryMatch = block.match(/KATEGORIE:\s*\*{0,2}(\w+)\*{0,2}/i);
      const keywordsMatch = block.match(/KL[IÍ][CČ]OV[AÁ]\s+SLOVA:\s*(.+)/i);
      const descMatch = block.match(/POPIS:\s*([\s\S]+?)(?=ILUSTRACE:|$)/i);

      if (nameMatch && descMatch) {
        const name = nameMatch[1].trim();
        const description = descMatch[1].trim().split('\n').filter(l => l.trim()).join(' ');
        const category = (categoryMatch?.[1] ?? 'icon').toLowerCase();
        const item = buildPrompt(name, description, category);
        item.keywords = keywordsMatch?.[1]?.split(',').map((k: string) => k.trim()).filter(Boolean) || [];
        prompts.push(item);
      }
    }

    // Pokus 2: JSON fallback
    if (prompts.length === 0) {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const arr = JSON.parse(jsonMatch[0]);
          for (const item of arr) {
            if (item.name || item.title) {
              prompts.push(buildPrompt(
                item.name || item.title,
                item.description || item.popis || '',
                item.category || 'icon',
              ));
            }
          }
        } catch { /* silent */ }
      }
    }

    // Pokus 3: nový dotaz přímo jako JSON
    if (prompts.length === 0) {
      console.warn('[Generator] Text parsing failed, retrying as JSON...');
      const jsonPrompt = `Navrhni 8 ilustrací pro vzdělávací téma "${dataSet.topic}" (${dataSet.grade}. třída).
Vrať POUZE JSON pole:
[{"name":"název česky","category":"icon|portrait|object|scene|map","description":"detailní popis co zobrazit (2-3 věty)"}]
POUZE JSON, žádný jiný text.`;
      const jsonResp = await chatWithAIProxy([{ role: 'user', content: jsonPrompt }], 'gemini-3-flash');
      const jm = jsonResp.match(/\[[\s\S]*\]/);
      if (jm) {
        try {
          const arr = JSON.parse(jm[0]);
          for (const item of arr) {
            prompts.push(buildPrompt(
              item.name || item.title || 'Ilustrace',
              item.description || '',
              item.category || 'icon',
            ));
          }
        } catch { /* silent */ }
      }
    }
    
    console.log('[Generator] Generated prompts:', prompts.length);
    return prompts;
    
  } catch (err) {
    console.error('[Generator] Illustration prompts error:', err);
    return [];
  }
}

// Funkce pro generování jedné ilustrace (připraveno pro napojení na Imagen/DALL-E)
export async function generateIllustration(
  promptData: IllustrationPrompt,
  apiType: 'imagen' | 'dalle' = 'imagen'
): Promise<{ success: boolean; url?: string; error?: string }> {
  console.log('[Generator] Generating illustration:', promptData.name);
  
  // TODO: Napojit na skutečné API (Imagen 3, DALL-E, atd.)
  // Pro teď vrátíme placeholder
  
  try {
    // Simulace - v budoucnu nahradit skutečným API voláním
    // const response = await fetch('https://api.imagen.google.com/generate', {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${API_KEY}` },
    //   body: JSON.stringify({ prompt: promptData.prompt, style: 'illustration' })
    // });
    
    return {
      success: false,
      error: 'Image generation API not yet connected. Prompts are ready for manual generation.',
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// =====================================================
// SUGGEST IMAGE GROUPS
// =====================================================
export async function suggestImageGroups(dataSet: TopicDataSet): Promise<ImageGroup[]> {
  console.log('[suggestImageGroups] START for topic:', dataSet.topic);
  const keyTerms = dataSet.content?.keyTerms?.map(t => t.term).join(', ') || '';
  const keyFacts = dataSet.content?.keyFacts?.slice(0, 6).join('; ') || '';

  const prompt = `Jsi pedagog navrhující vizuální materiály pro učebnici.
Téma: "${dataSet.topic}" (${dataSet.grade}. třída, ${dataSet.subjectCode || (dataSet as any).subject_code || ''})

Klíčové pojmy: ${keyTerms}
Fakta: ${keyFacts}

Navrhni 2–4 SKUPINY OBRÁZKŮ kde má smysl mít sérii obrázků se stejným stylem (např. "Typy řeckých sloupů" → 3 druhy, "Fáze měsíce" → 8 fází, "Světové náboženské symboly" → 5–6 symbolů).

PRAVIDLO PRO POČET SUBJEKTŮ: Zvol přesně tolik kolik jich téma přirozeně má.
- Pokud jsou to diskrétní kategorie (druhy, typy, fáze): přesný počet (2, 3, 4, 5, 6, 7, 8...)
- Nekrát uměle doplňuj ani nezkracuj — "4 roční období" = právě 4, "3 typy hornin" = právě 3
- Min 2, max 8 subjektů na skupinu

Vrať POUZE validní JSON pole (žádný markdown, žádné bloky kódu, čistý JSON):
[
  {
    "title": "Název skupiny česky",
    "description": "Vzdělávací záměr 1 věta",
    "type": "illustration",
    "stylePrompt": "detailed educational illustration, white background, same scale and composition, consistent line weight",
    "layout": "gallery",
    "subjects": [
      { "name": "Přesný název subjektu 1" },
      { "name": "Přesný název subjektu 2" }
    ]
  }
]`;

  try {
    const raw = await chatWithAIProxy(
      [{ role: 'user', content: prompt }],
      'gemini-3-flash',
      { temperature: 0.7, max_tokens: 1500 }
    );

    console.log('[suggestImageGroups] raw response (first 600):', raw.substring(0, 600));

    // Strip possible markdown code fences
    const stripped = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const jsonMatch = stripped.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('[suggestImageGroups] no JSON array found in response');
      return [];
    }

    const parsed: any[] = JSON.parse(jsonMatch[0]);
    console.log('[suggestImageGroups] parsed', parsed.length, 'groups');

    const now = new Date().toISOString();
    return parsed.map((g: any): ImageGroup => ({
      id: `ig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: g.title || 'Skupina obrázků',
      description: g.description || '',
      type: (['illustration', 'photo', 'diagram'] as const).includes(g.type) ? g.type : 'illustration',
      stylePrompt: g.stylePrompt || 'educational illustration, white background, consistent style',
      layout: 'gallery',
      subjects: (g.subjects || []).map((s: any): ImageGroupSubject => ({
        id: `subj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: typeof s === 'string' ? s : s.name,
        status: 'pending',
      })),
      createdAt: now,
      updatedAt: now,
    }));
  } catch (e) {
    console.error('[suggestImageGroups] error:', e);
    return [];
  }
}

// =====================================================
// LANGUAGE MATERIAL GENERATORS
// =====================================================

/**
 * Detects CEFR level from grade for language subjects.
 * Czech school mapping: 6→A1+, 7→A2, 8→A2+/B1, 9→B1, secondary→B1+
 */
function gradeToLevel(grade: number): string {
  if (grade <= 6) return 'A1';
  if (grade === 7) return 'A2';
  if (grade === 8) return 'B1';
  if (grade >= 9) return 'B1';
  return 'A2';
}

/**
 * Vocabulary Set Generator
 * Generates a VividBoard with 15-20 flashcard slides + a companion quiz board.
 * Also saves a printable worksheet HTML for the vocabulary list.
 */
async function generateLanguageVocabularySet(
  dataSet: TopicDataSet,
  onProgress?: ProgressCallback
): Promise<GenerateResult> {
  onProgress?.('plan', 'Generuji slovní zásobu pro téma...');

  const level = gradeToLevel(dataSet.grade);
  const subject = dataSet.subjectCode?.includes('nemcin') ? 'němčina'
    : dataSet.subjectCode?.includes('francouz') ? 'francouzština'
    : 'angličtina';
  const langCode = dataSet.subjectCode?.includes('nemcin') ? 'German'
    : dataSet.subjectCode?.includes('francouz') ? 'French'
    : 'English';

  const prompt = `You are an EFL/EFL material designer. Generate a structured vocabulary set for Czech school students.

TOPIC: "${dataSet.topic}"
LANGUAGE: ${langCode}
CEFR LEVEL: ${level}
GRADE: ${dataSet.grade}. ročník (Czech school)

Generate exactly 16 vocabulary items relevant to this topic at the ${level} level.

Return ONLY this JSON (no markdown fences):
{
  "title": "string — e.g. 'Food & Restaurants - Vocabulary'",
  "cefrLevel": "${level}",
  "items": [
    {
      "word": "string — ${langCode} word or phrase",
      "translation": "string — Czech translation",
      "phonetic": "string — IPA transcription e.g. /pɔːʃ.ən/",
      "exampleSentence": "string — simple example sentence at ${level} level",
      "exampleTranslation": "string — Czech translation of the example"
    }
  ]
}

Rules:
- Items must be thematically coherent with the topic
- Example sentences must be at ${level} level (simple grammar, common vocabulary)
- Czech translations must be natural, not overly formal
- Phonetics in IPA for all items
- Mix: nouns, verbs, adjectives, useful phrases
`;

  const response = await chatWithAIProxy([{ role: 'user', content: prompt }], 'gemini-3.1-pro', { max_tokens: 8192 });
  if (!response) return { success: false, error: 'AI neodpovědělo' };

  let vocab: any;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Žádný JSON v odpovědi');
    vocab = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return { success: false, error: `Chyba parsování: ${e}` };
  }

  onProgress?.('build', 'Přiřazuji obrázky z datasetu...');

  // Use only images already present in the dataset — no auto-generation.
  // Priority: illustrations (manually generated) → imageGroups → web images
  const items: any[] = vocab.items || [];

  // Collect all available dataset image URLs with their searchable text
  const datasetImages: Array<{ url: string; text: string }> = [];

  // 1. Illustrations (from DatasetContextPanel, manually generated)
  (dataSet.media?.illustrations || []).forEach((ill: any) => {
    if (ill.url) {
      datasetImages.push({ url: ill.url, text: (ill.prompt || ill.subject || '').toLowerCase() });
    }
  });

  // 2. ImageGroup subjects (generated via imageGroups panel)
  (dataSet.media?.imageGroups || []).forEach((group: any) => {
    (group.subjects || []).forEach((subj: any) => {
      if (subj.imageUrl && subj.status === 'done') {
        datasetImages.push({ url: subj.imageUrl, text: (subj.name || subj.subject || '').toLowerCase() });
      }
    });
  });

  // 3. Web images (ValidatedImage[])
  (dataSet.media?.images || []).forEach((img: any) => {
    if (img.url) {
      datasetImages.push({
        url: img.url,
        text: [img.title, img.description, img.query, img.alt].filter(Boolean).join(' ').toLowerCase(),
      });
    }
  });

  // Match each vocabulary word to the best dataset image (by substring match)
  const imageUrls: (string | null)[] = items.map((item: any) => {
    const word = (item.word || '').toLowerCase();
    const translation = (item.translation || '').toLowerCase();
    const found = datasetImages.find(
      img => img.text.includes(word) || img.text.includes(translation)
    );
    return found?.url ?? null;
  });

  onProgress?.('build', 'Sestavuji flashcard board...');

  // Build flashcard VividBoard
  const { createFlashcardSlide, createInfoSlide } = await import('../../types/quiz');
  const slides: any[] = [];

  // Title info slide
  const titleSlide = createInfoSlide(0, 'title-only');
  titleSlide.title = vocab.title || `${dataSet.topic} – Vocabulary`;
  (titleSlide as any).backgroundColor = '#6366f1';
  slides.push(titleSlide);

  // Flashcard slides — with generated images
  items.forEach((item: any, idx: number) => {
    const card = createFlashcardSlide(idx + 1);
    card.word = item.word || '';
    card.translation = item.translation || '';
    card.phonetic = item.phonetic || '';
    card.exampleSentence = item.exampleSentence || '';
    card.exampleTranslation = item.exampleTranslation || '';
    card.audioLang = langCode === 'German' ? 'en-US' : langCode === 'French' ? 'en-US' : 'en-US';
    card.mode = 'language';
    if (imageUrls[idx]) {
      card.image = imageUrls[idx]!;
    }
    slides.push(card);
  });

  const quiz = {
    id: `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: vocab.title || `${dataSet.topic} – Slovní zásoba`,
    slides,
    settings: {
      showProgress: true,
      showScore: false,
      allowSkip: true,
      allowBack: true,
      shuffleQuestions: false,
      shuffleOptions: false,
      showExplanations: 'immediately' as const,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const { stripBase64FromObject } = await import('../supabase/upload-image');
  const safeQuiz = stripBase64FromObject(quiz) as typeof quiz;
  saveQuiz(safeQuiz);

  onProgress?.('save', 'Ukládám do Supabase...');
  await _syncQz(safeQuiz);

  return {
    success: true,
    id: quiz.id,
    preview: `Kartičky: ${(vocab.items || []).length} slov | Téma: ${dataSet.topic} | Úroveň: ${level}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers for language activity generators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves a language activity as both a worksheet AND a linked board (presentation).
 * Returns the IDs of both created items.
 */
async function _saveLangMaterial(
  blocks: WorksheetBlock[],
  title: string,
  dataSet: TopicDataSet,
): Promise<{ worksheetId: string; boardId: string }> {
  const { stripBase64FromObject } = await import('../supabase/upload-image');

  const worksheetId = `worksheet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const boardId = `board-${Date.now() + 1}-${Math.random().toString(36).slice(2, 6)}`;

  const worksheet: Worksheet = {
    id: worksheetId,
    title,
    blocks,
    settings: { showAnswerKey: true, pageSize: 'A4', margins: 'normal' },
    metadata: {
      subject: dataSet.subjectCode as any,
      grade: dataSet.grade as any,
      topic: dataSet.topic,
    },
    linkedBoardId: boardId,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  _saveWs(worksheet);

  // Strip worksheetOnly blocks before converting to board
  const boardWorksheet = { ...worksheet, blocks: blocks.filter(b => !b.worksheetOnly) };
  const quiz = worksheetToPresentation(boardWorksheet);
  quiz.id = boardId;
  (quiz as any).linkedWorksheetId = worksheetId;
  quiz.title = title;

  const safeQuiz = stripBase64FromObject(quiz) as typeof quiz;
  _saveQz(safeQuiz);
  await _syncQz(safeQuiz);

  return { worksheetId, boardId };
}

/**
 * Generates a single topic illustration for a language activity.
 * Returns a public Storage URL, or null if generation fails.
 */
async function _generateLangIllustration(
  topic: string,
  activityType: string,
  grade: number,
): Promise<string | null> {
  try {
    const { generateImageWithImagen } = await import('../ai-chat-proxy');
    const { processImageUrl } = await import('../supabase/upload-image');

    const imgPrompt = `Educational illustration for an English language learning activity.
Topic: "${topic}"
Activity: ${activityType}
Style: Clean, bright, flat illustration. White background. No text, no letters. Suitable for grade ${grade} students.`;

    const imgResult = await generateImageWithImagen(imgPrompt, {
      aspectRatio: '16:9',
      numberOfImages: 1,
      model: 'flash',
    });

    if (imgResult.success && (imgResult.url || imgResult.images?.[0]?.base64)) {
      const rawUrl = imgResult.url
        || `data:${imgResult.images![0].mimeType || 'image/png'};base64,${imgResult.images![0].base64}`;
      const slug = topic.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 30);
      return await processImageUrl(rawUrl, `lang-${activityType}-${slug}`, 'illustrations');
    }
  } catch (err) {
    console.warn('[LangGen] Illustration failed:', err);
  }
  return null;
}

/**
 * Converts a sentence with a ___ blank marker into FillBlankSegment[].
 * E.g. "I ___ (go) to school." + answer "go" → [text, blank, text]
 */
function _parseFillBlankSentence(
  sentence: string,
  answer: string,
  blankId: string,
): FillBlankSegment[] {
  const parts = sentence.split('___');
  if (parts.length < 2) {
    return [{ type: 'text', content: sentence }];
  }
  const segments: FillBlankSegment[] = [];
  segments.push({ type: 'text', content: parts[0] });
  segments.push({ type: 'blank', id: blankId, correctAnswer: answer.trim() });
  segments.push({ type: 'text', content: parts.slice(1).join('___') });
  return segments;
}

// ─────────────────────────────────────────────────────────────────────────────
// Grammar Lesson Generator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Grammar Lesson Generator
 * PPP structure: Presentation → Practice → Production
 * Generates: WorksheetBlock[] → worksheet (teacher_worksheets) + board (teacher_boards)
 */
async function generateLanguageGrammarLesson(
  dataSet: TopicDataSet,
  onProgress?: ProgressCallback
): Promise<GenerateResult> {
  onProgress?.('plan', 'Generuji gramatickou lekci (PPP struktura)...');

  const level = gradeToLevel(dataSet.grade);

  // Ilustrace se generují manuálně v panelu datasetu — zde jen reservujeme slot
  const imageUrl: string | null = null;

  onProgress?.('agent1', 'Generuji obsah lekce...');
  const prompt = `You are an EFL teacher creating a grammar lesson for Czech students (grade ${dataSet.grade}, CEFR ${level}).

TOPIC/GRAMMAR POINT: "${dataSet.topic}"
CEFR LEVEL: ${level}

Return ONLY this JSON (no markdown, no code fences):
{
  "title": "string — grammar topic in English, e.g. 'Present Simple – Habits & Routines'",
  "grammarPoint": "string — short grammar name, e.g. 'Present Simple'",
  "contextText": "string — short dialogue or 4-6 sentences showcasing the grammar. Use **word** to bold target structures.",
  "noticeNote": "string — Czech: brief observation, e.g. 'Všimni si, jak tvoříme přítomný čas...'",
  "ruleExplanation": "string — Czech: clear concise rule explanation (1-3 sentences)",
  "ruleAffirmative": "string — English affirmative example sentence",
  "ruleNegative": "string — English negative example sentence",
  "ruleQuestion": "string — English question example sentence",
  "examples": [
    "string — English example 1",
    "string — English example 2",
    "string — English example 3"
  ],
  "fillBlanks": [
    { "sentence": "I ___ (go) to school every day.", "answer": "go" },
    { "sentence": "She ___ (not/like) vegetables.", "answer": "doesn't like" },
    { "sentence": "We ___ (have) English on Mondays.", "answer": "have" },
    { "sentence": "My sister ___ (study) hard.", "answer": "studies" },
    { "sentence": "They ___ (not/be) at home.", "answer": "aren't" },
    { "sentence": "___ he ___ (play) football every week?", "answer": "Does / play" }
  ],
  "productionTask": "string — Czech production task, e.g. 'Napiš 4-5 vět o svém denním programu pomocí přítomného času.'"
}

Rules:
- Czech for explanations and instructions, English for all examples
- Fill-blank sentences MUST use ___ as the blank marker — exactly one ___ per sentence
- Exactly 6 fill-blank sentences, exactly 3 examples
- CEFR ${level} appropriate difficulty throughout`;

  const response = await chatWithAIProxy([{ role: 'user', content: prompt }], 'gemini-3.1-pro', { max_tokens: 4096 });
  if (!response) return { success: false, error: 'AI neodpovědělo' };

  let data: any;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Žádný JSON v odpovědi');
    data = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return { success: false, error: `Chyba parsování JSON: ${e}` };
  }

  onProgress?.('build', 'Sestavuji pracovní list...');

  const title = data.title || `${dataSet.topic} – Gramatická lekce`;
  let order = 0;
  const blocks: WorksheetBlock[] = [];

  // 1. Title heading
  blocks.push({
    id: generateBlockId(), order: order++, type: 'heading', width: 'full',
    content: { text: title, level: 'h1', headingStyle: 'left-border' },
  });

  // 2. Topic illustration (half) + context text (half)
  if (imageUrl) {
    blocks.push({
      id: generateBlockId(), order: order++, type: 'image', width: 'half',
      content: { url: imageUrl, alt: dataSet.topic, size: 100, alignment: 'center' },
    });
  }
  blocks.push({
    id: generateBlockId(), order: order++, type: 'paragraph',
    width: imageUrl ? 'half' : 'full',
    content: {
      html: `<h3>🔍 Gramatika v kontextu</h3><p>${
        (data.contextText || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')
      }</p><p><em>${data.noticeNote || ''}</em></p>`,
    },
  });

  // 3. Grammar rule infobox
  blocks.push({
    id: generateBlockId(), order: order++, type: 'infobox', width: 'full',
    content: {
      title: `📋 Pravidlo: ${data.grammarPoint || ''}`,
      html: `<p>${data.ruleExplanation || ''}</p>
<table style="width:100%;border-collapse:collapse;margin-top:8px">
<tr><td style="padding:4px 8px;border:1px solid #ccc"><strong>(+)</strong></td><td style="padding:4px 8px;border:1px solid #ccc">${data.ruleAffirmative || ''}</td></tr>
<tr><td style="padding:4px 8px;border:1px solid #ccc"><strong>(−)</strong></td><td style="padding:4px 8px;border:1px solid #ccc">${data.ruleNegative || ''}</td></tr>
<tr><td style="padding:4px 8px;border:1px solid #ccc"><strong>(?)</strong></td><td style="padding:4px 8px;border:1px solid #ccc">${data.ruleQuestion || ''}</td></tr>
</table>`,
      variant: 'blue',
    },
  });

  // 4. Examples paragraph
  const examplesHtml = (data.examples || []).map((ex: string) => `<li>${ex}</li>`).join('');
  blocks.push({
    id: generateBlockId(), order: order++, type: 'paragraph', width: 'full',
    content: { html: `<h3>✏️ Příklady</h3><ul>${examplesHtml}</ul>` },
  });

  // 5. Fill-blank practice
  const fillBlanks: Array<{ sentence: string; answer: string }> = data.fillBlanks || [];
  if (fillBlanks.length > 0) {
    blocks.push({
      id: generateBlockId(), order: order++, type: 'heading', width: 'full',
      content: { text: 'Cvičení – Doplň správný tvar', level: 'h2' },
    });
    const allSegments: FillBlankSegment[] = [];
    fillBlanks.forEach((fb, i) => {
      if (i > 0) allSegments.push({ type: 'text', content: '   ' });
      allSegments.push({ type: 'text', content: `${i + 1}. ` });
      const segs = _parseFillBlankSentence(fb.sentence || '', fb.answer || '', `gram-blank-${i + 1}`);
      allSegments.push(...segs);
    });
    blocks.push({
      id: generateBlockId(), order: order++, type: 'fill-blank', width: 'full',
      content: { instruction: 'Doplň správný tvar slovesa do mezer.', segments: allSegments },
    });
  }

  // 6. Production free-answer
  blocks.push({
    id: generateBlockId(), order: order++, type: 'heading', width: 'full',
    content: { text: '🗣️ Volné použití (Production)', level: 'h2' },
  });
  blocks.push({
    id: generateBlockId(), order: order++, type: 'free-answer', width: 'full',
    content: { question: data.productionTask || 'Napiš 4-5 vět pomocí nové gramatiky.', lines: 5 },
  });

  onProgress?.('save', 'Ukládám lekci jako pracovní list a board...');
  const { worksheetId, boardId } = await _saveLangMaterial(blocks, title, dataSet);

  return {
    success: true,
    id: worksheetId,
    linkedBoardId: boardId,
    preview: `Gramatická lekce (PPP) | ${level} | ${dataSet.grade}. ročník | + Board`,
  };
}

/**
 * Reading Activity Generator
 * Creates a reading text at the right CEFR level with graduated comprehension tasks.
 * Generates: WorksheetBlock[] → worksheet (teacher_worksheets) + board (teacher_boards)
 */
async function generateLanguageReadingActivity(
  dataSet: TopicDataSet,
  onProgress?: ProgressCallback
): Promise<GenerateResult> {
  onProgress?.('plan', 'Generuji čtecí aktivitu...');

  const level = gradeToLevel(dataSet.grade);
  const wordCount = level === 'A1' ? '100-150' : level === 'A2' ? '150-220' : '250-350';

  const imageUrl: string | null = null;

  onProgress?.('agent1', 'Generuji čtecí text a úkoly...');
  const prompt = `You are an EFL material designer. Create a reading activity for Czech students (grade ${dataSet.grade}, CEFR ${level}).

TOPIC: "${dataSet.topic}"
CEFR LEVEL: ${level}
TEXT LENGTH: ${wordCount} words

Return ONLY this JSON (no markdown, no code fences):
{
  "title": "string — title of the reading text in English, e.g. 'Life in the City'",
  "preReadingVocab": [
    { "word": "string — English word/phrase", "translation": "string — Czech translation" }
  ],
  "predictionQuestion": "string — Czech prediction question to think about before reading",
  "text": "string — the reading text in English, ${wordCount} words. Use \\n\\n for paragraph breaks.",
  "trueFalseStatements": [
    { "statement": "string — English statement about the text", "answer": "T or F or NM" }
  ],
  "comprehensionQuestions": [
    "string — Czech question, student answers in English"
  ],
  "discussionQuestion": "string — Czech personal response question connecting text to student's life",
  "answerKey": "string — compact answer key for T/F, e.g. '1-T, 2-F, 3-NM, 4-T, 5-F, 6-T'"
}

Rules:
- Exactly 4-5 pre-reading vocabulary items
- Text strictly at ${level} level (simple grammar and common vocabulary for A1/A2, more varied for B1)
- Exactly 6 True/False/NM statements
- Exactly 3 comprehension questions
- Czech for instructions and questions, English for the reading text
- Engaging scenario connected to "${dataSet.topic}"`;

  const response = await chatWithAIProxy([{ role: 'user', content: prompt }], 'gemini-3.1-pro', { max_tokens: 6144 });
  if (!response) return { success: false, error: 'AI neodpovědělo' };

  let data: any;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Žádný JSON v odpovědi');
    data = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return { success: false, error: `Chyba parsování JSON: ${e}` };
  }

  onProgress?.('build', 'Sestavuji pracovní list...');

  const title = data.title ? `${data.title}` : `${dataSet.topic} – Čtení`;
  let order = 0;
  const blocks: WorksheetBlock[] = [];

  // 1. Title heading
  blocks.push({
    id: generateBlockId(), order: order++, type: 'heading', width: 'full',
    content: { text: `📖 ${title}`, level: 'h1', headingStyle: 'left-border' },
  });

  // 2. Topic illustration (full width for reading — big visual context)
  if (imageUrl) {
    blocks.push({
      id: generateBlockId(), order: order++, type: 'image', width: 'full',
      content: { url: imageUrl, alt: dataSet.topic, size: 60, alignment: 'center' },
    });
  }

  // 3. Pre-reading vocabulary infobox
  const vocabRows = (data.preReadingVocab || [])
    .map((v: any) => `<tr><td style="padding:4px 8px;border:1px solid #ccc"><strong>${v.word || ''}</strong></td><td style="padding:4px 8px;border:1px solid #ccc">${v.translation || ''}</td></tr>`)
    .join('');
  blocks.push({
    id: generateBlockId(), order: order++, type: 'infobox', width: 'full',
    content: {
      title: '📚 Před čtením – Nová slovíčka',
      html: `<table style="width:100%;border-collapse:collapse">${vocabRows}</table>
<p style="margin-top:8px"><strong>Přemýšlej:</strong> ${data.predictionQuestion || ''}</p>`,
      variant: 'green',
    },
  });

  // 4. Reading text paragraph
  const textHtml = (data.text || '').replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
  blocks.push({
    id: generateBlockId(), order: order++, type: 'paragraph', width: 'full',
    content: { html: `<h3>📖 Text</h3><p>${textHtml}</p>` },
  });

  // 5. True/False/NM as free-answer subquestions
  const tfStatements: Array<{ statement: string; answer: string }> = data.trueFalseStatements || [];
  if (tfStatements.length > 0) {
    blocks.push({
      id: generateBlockId(), order: order++, type: 'heading', width: 'full',
      content: { text: 'Úkol 1 – Pravda / Nepravda / Nezmíněno', level: 'h2' },
    });
    blocks.push({
      id: generateBlockId(), order: order++, type: 'free-answer', width: 'full',
      content: {
        question: 'Označ každé tvrzení: T (True) / F (False) / NM (Not Mentioned)',
        lines: 1,
        subQuestions: tfStatements.map((tf, i) => ({
          id: `tf-${i + 1}`,
          text: `${i + 1}. ${tf.statement || ''}`,
          lines: 1,
          sampleAnswer: tf.answer || '',
        })),
        subColumns: 1,
      },
    });
  }

  // 6. Comprehension questions as free-answer subquestions
  const compQs: string[] = data.comprehensionQuestions || [];
  if (compQs.length > 0) {
    blocks.push({
      id: generateBlockId(), order: order++, type: 'heading', width: 'full',
      content: { text: 'Úkol 2 – Otázky s porozuměním', level: 'h2' },
    });
    blocks.push({
      id: generateBlockId(), order: order++, type: 'free-answer', width: 'full',
      content: {
        question: 'Odpověz na otázky anglicky.',
        lines: 2,
        subQuestions: compQs.map((q, i) => ({
          id: `comp-${i + 1}`,
          text: `${i + 1}. ${q}`,
          lines: 2,
        })),
        subColumns: 1,
      },
    });
  }

  // 7. Answer key infobox
  if (data.answerKey) {
    blocks.push({
      id: generateBlockId(), order: order++, type: 'infobox', width: 'full',
      content: { title: '✔️ Klíč k odpovědím', html: `<p>${data.answerKey}</p>`, variant: 'yellow' },
    });
  }

  // 8. Discussion free-answer
  blocks.push({
    id: generateBlockId(), order: order++, type: 'free-answer', width: 'full',
    content: { question: `💬 Diskuse: ${data.discussionQuestion || 'Co si myslíš o tématu textu?'}`, lines: 3 },
  });

  onProgress?.('save', 'Ukládám čtecí aktivitu jako pracovní list a board...');
  const { worksheetId, boardId } = await _saveLangMaterial(blocks, title, dataSet);

  return {
    success: true,
    id: worksheetId,
    linkedBoardId: boardId,
    preview: `Čtení s porozuměním | ${level} | ${wordCount} slov | ${dataSet.grade}. ročník | + Board`,
  };
}

/**
 * Writing Activity Generator
 * Creates a guided writing task with model text, language bank, and writing frame.
 * Generates: WorksheetBlock[] → worksheet (teacher_worksheets) + board (teacher_boards)
 */
async function generateLanguageWritingActivity(
  dataSet: TopicDataSet,
  onProgress?: ProgressCallback,
): Promise<GenerateResult> {
  onProgress?.('plan', 'Generuji aktivitu pro psaní...');

  const level = gradeToLevel(dataSet.grade);
  const wordTarget = level === 'A1' ? '40-60' : level === 'A2' ? '60-100' : '100-150';

  const imageUrl: string | null = null;

  onProgress?.('agent1', 'Generuji zadání a vzorový text...');
  const prompt = `Create a guided writing activity for Czech EFL students (grade ${dataSet.grade}, CEFR ${level}).

TOPIC: "${dataSet.topic}"
WRITING TARGET: ${wordTarget} words

Return ONLY this JSON (no markdown, no code fences):
{
  "title": "string — writing task title in English, e.g. 'My Favourite Place'",
  "task": "string — Czech: clear writing task (who, why, what to include). End with: Napiš ${wordTarget} slov.",
  "modelText": "string — model text in English (${wordTarget} words). Use **phrase** to bold key phrases. Use \\n\\n for paragraphs.",
  "languageBank": [
    { "phrase": "string — English phrase/connector", "translation": "string — Czech translation" }
  ],
  "writingFrame": "string — writing frame with sentence starters, e.g. 'My favourite place is ___.\\nI like it because ___.\\nEvery time I go there, I ___.'",
  "checklist": [
    "string — self-assessment item, e.g. 'Did I write ${wordTarget} words?'"
  ]
}

Rules:
- Exactly 8-10 language bank phrases
- Exactly 5 checklist items
- Model text strictly at ${level} level
- Czech for task and checklist; English for model text, language bank phrases, and writing frame`;

  const response = await chatWithAIProxy([{ role: 'user', content: prompt }], 'gemini-3.1-pro', { max_tokens: 4096 });
  if (!response) return { success: false, error: 'AI neodpovědělo' };

  let data: any;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Žádný JSON v odpovědi');
    data = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return { success: false, error: `Chyba parsování JSON: ${e}` };
  }

  onProgress?.('build', 'Sestavuji pracovní list...');

  const title = data.title || `${dataSet.topic} – Psaní`;
  let order = 0;
  const blocks: WorksheetBlock[] = [];

  // 1. Title heading
  blocks.push({
    id: generateBlockId(), order: order++, type: 'heading', width: 'full',
    content: { text: `✍️ ${title}`, level: 'h1', headingStyle: 'left-border' },
  });

  // 2. Illustration (half) + task (half)
  if (imageUrl) {
    blocks.push({
      id: generateBlockId(), order: order++, type: 'image', width: 'half',
      content: { url: imageUrl, alt: dataSet.topic, size: 100, alignment: 'center' },
    });
  }
  blocks.push({
    id: generateBlockId(), order: order++, type: 'infobox',
    width: imageUrl ? 'half' : 'full',
    content: {
      title: '📝 Zadání',
      html: `<p>${(data.task || '').replace(/\n/g, '<br>')}</p>`,
      variant: 'blue',
    },
  });

  // 3. Model text
  const modelHtml = (data.modelText || '')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  blocks.push({
    id: generateBlockId(), order: order++, type: 'paragraph', width: 'full',
    content: { html: `<h3>📄 Vzorový text</h3><p>${modelHtml}</p>` },
  });

  // 4. Language bank infobox
  const langRows = (data.languageBank || [])
    .map((lb: any) => `<tr><td style="padding:4px 8px;border:1px solid #ccc"><em>${lb.phrase || ''}</em></td><td style="padding:4px 8px;border:1px solid #ccc">${lb.translation || ''}</td></tr>`)
    .join('');
  blocks.push({
    id: generateBlockId(), order: order++, type: 'infobox', width: 'full',
    content: {
      title: '💡 Užitečné fráze',
      html: `<table style="width:100%;border-collapse:collapse">${langRows}</table>`,
      variant: 'green',
    },
  });

  // 5. Writing frame paragraph
  blocks.push({
    id: generateBlockId(), order: order++, type: 'paragraph', width: 'full',
    content: {
      html: `<h3>🗂️ Šablona pro psaní</h3><p style="font-style:italic">${
        (data.writingFrame || '').replace(/\n/g, '<br>')
      }</p>`,
    },
  });

  // 6. Writing space free-answer
  blocks.push({
    id: generateBlockId(), order: order++, type: 'free-answer', width: 'full',
    content: { question: `Napiš svůj text (${wordTarget} slov):`, lines: 8 },
  });

  // 7. Self-assessment checklist infobox
  const checklistHtml = (data.checklist || [])
    .map((item: string) => `<li>☐ ${item}</li>`)
    .join('');
  blocks.push({
    id: generateBlockId(), order: order++, type: 'infobox', width: 'full',
    content: { title: '✅ Sebehodnocení', html: `<ul>${checklistHtml}</ul>`, variant: 'yellow' },
  });

  onProgress?.('save', 'Ukládám aktivitu psaní jako pracovní list a board...');
  const { worksheetId, boardId } = await _saveLangMaterial(blocks, title, dataSet);

  return {
    success: true,
    id: worksheetId,
    linkedBoardId: boardId,
    preview: `Řízené psaní | ${level} | ${wordTarget} slov | ${dataSet.grade}. ročník | + Board`,
  };
}

/**
 * Speaking Activity Generator
 * Creates printable speaking cards: discussion questions, role-play, useful language.
 * Generates: WorksheetBlock[] → worksheet (teacher_worksheets) + board (teacher_boards)
 */
async function generateLanguageSpeakingActivity(
  dataSet: TopicDataSet,
  onProgress?: ProgressCallback,
): Promise<GenerateResult> {
  onProgress?.('plan', 'Generuji aktivitu pro mluvení...');

  const level = gradeToLevel(dataSet.grade);

  const imageUrl: string | null = null;

  onProgress?.('agent1', 'Generuji diskusní otázky a role-play...');
  const prompt = `Create a speaking activity for Czech EFL students (grade ${dataSet.grade}, CEFR ${level}).

TOPIC: "${dataSet.topic}"

Return ONLY this JSON (no markdown, no code fences):
{
  "title": "string — speaking activity title in English, e.g. 'Talking About Food'",
  "discussionQuestions": [
    "string — English discussion question suitable for ${level}"
  ],
  "rolePlayA": "string — Student A role: Czech role description + English conversation prompts. Use \\n for line breaks.",
  "rolePlayB": "string — Student B role: Czech role description + English conversation prompts. Use \\n for line breaks.",
  "usefulLanguage": [
    { "phrase": "string — English phrase", "translation": "string — Czech translation" }
  ],
  "selfAssessment": [
    "string — Czech 'Can I...' self-assessment statement"
  ]
}

Rules:
- Exactly 8 discussion questions (vary difficulty slightly: start easier, get harder)
- Exactly 8-10 useful language phrases (include: agreeing, disagreeing, giving opinion, asking for opinion)
- Exactly 3-4 self-assessment items (Can I...? statements)
- English for discussion questions and useful phrases; Czech for role descriptions and self-assessment`;

  const response = await chatWithAIProxy([{ role: 'user', content: prompt }], 'gemini-3.1-pro', { max_tokens: 4096 });
  if (!response) return { success: false, error: 'AI neodpovědělo' };

  let data: any;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Žádný JSON v odpovědi');
    data = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return { success: false, error: `Chyba parsování JSON: ${e}` };
  }

  onProgress?.('build', 'Sestavuji pracovní list...');

  const title = data.title || `${dataSet.topic} – Mluvení`;
  let order = 0;
  const blocks: WorksheetBlock[] = [];

  // 1. Title heading
  blocks.push({
    id: generateBlockId(), order: order++, type: 'heading', width: 'full',
    content: { text: `🗣️ ${title}`, level: 'h1', headingStyle: 'left-border' },
  });

  // 2. Illustration (half) + discussion questions (half)
  if (imageUrl) {
    blocks.push({
      id: generateBlockId(), order: order++, type: 'image', width: 'half',
      content: { url: imageUrl, alt: dataSet.topic, size: 100, alignment: 'center' },
    });
  }
  const questionsHtml = (data.discussionQuestions || [])
    .map((q: string, i: number) => `<li>${i + 1}. ${q}</li>`)
    .join('');
  blocks.push({
    id: generateBlockId(), order: order++, type: 'paragraph',
    width: imageUrl ? 'half' : 'full',
    content: { html: `<h3>💬 Diskusní otázky</h3><ol>${questionsHtml}</ol>` },
  });

  // 3. Role-play cards (two infoboxes side by side)
  blocks.push({
    id: generateBlockId(), order: order++, type: 'heading', width: 'full',
    content: { text: '🎭 Role-play', level: 'h2' },
  });
  blocks.push({
    id: generateBlockId(), order: order++, type: 'infobox', width: 'half',
    content: {
      title: 'Student A',
      html: `<p>${(data.rolePlayA || '').replace(/\n/g, '<br>')}</p>`,
      variant: 'blue',
    },
  });
  blocks.push({
    id: generateBlockId(), order: order++, type: 'infobox', width: 'half',
    content: {
      title: 'Student B',
      html: `<p>${(data.rolePlayB || '').replace(/\n/g, '<br>')}</p>`,
      variant: 'green',
    },
  });

  // 4. Useful language infobox
  const langRows = (data.usefulLanguage || [])
    .map((ul: any) => `<tr><td style="padding:4px 8px;border:1px solid #ccc"><em>${ul.phrase || ''}</em></td><td style="padding:4px 8px;border:1px solid #ccc">${ul.translation || ''}</td></tr>`)
    .join('');
  blocks.push({
    id: generateBlockId(), order: order++, type: 'infobox', width: 'full',
    content: {
      title: '💬 Užitečný jazyk',
      html: `<table style="width:100%;border-collapse:collapse">${langRows}</table>`,
      variant: 'purple',
    },
  });

  // 5. Self-assessment infobox
  const selfHtml = (data.selfAssessment || [])
    .map((item: string) => `<li>☐ ${item}</li>`)
    .join('');
  blocks.push({
    id: generateBlockId(), order: order++, type: 'infobox', width: 'full',
    content: { title: '⭐ Sebehodnocení', html: `<ul>${selfHtml}</ul>`, variant: 'yellow' },
  });

  onProgress?.('save', 'Ukládám aktivitu mluvení jako pracovní list a board...');
  const { worksheetId, boardId } = await _saveLangMaterial(blocks, title, dataSet);

  return {
    success: true,
    id: worksheetId,
    linkedBoardId: boardId,
    preview: `Konverzační aktivita | ${level} | Role-play + diskuse | ${dataSet.grade}. ročník | + Board`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Language Quiz Generator
// VividBoard with ABC vocabulary, fill-blanks grammar, connect-pairs matching
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Language Quiz Generator
 *
 * Generates an interactive VividBoard quiz with:
 * - ABC vocabulary questions (choose correct translation)
 * - Connect-pairs slides (match word ↔ translation)
 * - Fill-blanks grammar sentences
 * - ABC grammar form questions (choose the correct verb form / preposition)
 */
async function generateLanguageQuiz(
  dataSet: TopicDataSet,
  onProgress?: ProgressCallback
): Promise<GenerateResult> {
  onProgress?.('plan', 'Generuji jazykový kvíz (slovní zásoba + gramatika)...');

  const level = gradeToLevel(dataSet.grade);
  const langCode = dataSet.subjectCode?.includes('nemcin') ? 'German'
    : dataSet.subjectCode?.includes('francouz') ? 'French'
    : 'English';

  const prompt = `You are an EFL assessment designer. Create a language quiz for Czech students (grade ${dataSet.grade}, CEFR ${level}).

TOPIC: "${dataSet.topic}"
LANGUAGE: ${langCode}
CEFR LEVEL: ${level}

Return ONLY this JSON (no markdown fences, no extra text):
{
  "title": "string — e.g. 'Food & Restaurants – Language Quiz'",
  "sections": [
    {
      "sectionTitle": "🔤 Slovní zásoba",
      "abcVocab": [
        {
          "question": "string — e.g. 'What does \\"portion\\" mean?'",
          "options": ["string (correct)", "string (wrong)", "string (wrong)", "string (wrong)"],
          "correctIndex": 0
        }
      ],
      "connectPairs": [
        { "english": "string — English word", "czech": "string — Czech translation" }
      ]
    },
    {
      "sectionTitle": "📐 Gramatika",
      "fillBlanks": [
        {
          "sentence": "string — sentence with [BLANK] marker, e.g. 'She [BLANK] to school every day.'",
          "answer": "string — correct answer, e.g. 'goes'"
        }
      ],
      "abcGrammar": [
        {
          "question": "string — e.g. 'Choose the correct form: She ___ happy.'",
          "options": ["is (correct)", "are (wrong)", "am (wrong)", "be (wrong)"],
          "correctIndex": 0
        }
      ]
    }
  ]
}

Rules:
- abcVocab: exactly 5 questions. Each has 4 options (1 correct Czech translation + 3 plausible distractors).
- connectPairs: exactly 6 word-translation pairs (different words from abcVocab).
- fillBlanks: exactly 6 sentences. Each has exactly one [BLANK] marker. Answer is 1-2 words.
- abcGrammar: exactly 4 questions. Cover grammar typical for ${level} level.
- All questions must relate to topic "${dataSet.topic}".
- Difficulty appropriate for CEFR ${level}.
- Options in abcVocab and abcGrammar are plain strings WITHOUT "(correct)" labels — correctIndex specifies which is correct.
`;

  const response = await chatWithAIProxy([{ role: 'user', content: prompt }], 'gemini-3.1-pro', { max_tokens: 8192 });
  if (!response) return { success: false, error: 'AI neodpovědělo' };

  let quizData: any;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Žádný JSON v odpovědi');
    quizData = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return { success: false, error: `Chyba parsování JSON: ${e}` };
  }

  onProgress?.('build', 'Sestavuji VividBoard kvíz...');

  const {
    createInfoSlide,
    createABCSlide,
    createFillBlanksSlide,
    createConnectPairsSlide,
  } = await import('../../types/quiz');

  const slides: any[] = [];
  let order = 0;

  // Title slide
  const titleSlide = createInfoSlide(order++, 'title-only');
  titleSlide.title = quizData.title || `${dataSet.topic} – Jazykový kvíz`;
  (titleSlide as any).backgroundColor = '#4f46e5';
  slides.push(titleSlide);

  for (const section of (quizData.sections || [])) {
    // Section header slide
    const sectionSlide = createInfoSlide(order++, 'title-only');
    sectionSlide.title = section.sectionTitle || 'Sekce';
    (sectionSlide as any).backgroundColor = '#7c3aed';
    slides.push(sectionSlide);

    // ABC vocabulary questions
    for (const q of (section.abcVocab || [])) {
      const slide = createABCSlide(order++);
      slide.question = q.question || '';
      const opts = (q.options || []).slice(0, 4);
      slide.options = opts.map((opt: string, i: number) => ({
        id: ['a', 'b', 'c', 'd'][i] || `opt-${i}`,
        label: ['A', 'B', 'C', 'D'][i] || String(i + 1),
        content: opt,
        isCorrect: i === (q.correctIndex ?? 0),
      }));
      slides.push(slide);
    }

    // ABC grammar questions
    for (const q of (section.abcGrammar || [])) {
      const slide = createABCSlide(order++);
      slide.question = q.question || '';
      const opts = (q.options || []).slice(0, 4);
      slide.options = opts.map((opt: string, i: number) => ({
        id: ['a', 'b', 'c', 'd'][i] || `opt-${i}`,
        label: ['A', 'B', 'C', 'D'][i] || String(i + 1),
        content: opt,
        isCorrect: i === (q.correctIndex ?? 0),
      }));
      slides.push(slide);
    }

    // Connect pairs (word ↔ translation matching)
    const pairs = (section.connectPairs || []).slice(0, 6);
    if (pairs.length >= 2) {
      const pairSlide = createConnectPairsSlide(order++);
      pairSlide.instruction = `Spoj ${langCode === 'English' ? 'anglické' : langCode === 'German' ? 'německé' : 'francouzské'} slovo s českým překladem`;
      pairSlide.pairs = pairs.map((p: any, i: number) => ({
        id: `pair-${i + 1}`,
        left: { id: `left-${i + 1}`, type: 'text', content: p.english || '' },
        right: { id: `right-${i + 1}`, type: 'text', content: p.czech || '' },
      }));
      pairSlide.countAsMultiple = true;
      pairSlide.shuffleSides = true;
      slides.push(pairSlide);
    }

    // Fill-blanks grammar sentences
    const fbSentences = (section.fillBlanks || []).slice(0, 6);
    if (fbSentences.length > 0) {
      const fbSlide = createFillBlanksSlide(order++);
      fbSlide.instruction = 'Doplň správný tvar slova';
      fbSlide.sentences = fbSentences.map((fb: any, i: number) => {
        const rawText: string = fb.sentence || '';
        const answer: string = fb.answer || '';
        const blankId = `blank-${i + 1}-1`;
        // Replace [BLANK] with placeholder reference
        const text = rawText.replace('[BLANK]', `[${blankId}]`);
        // Find character position of the blank placeholder
        const position = text.indexOf(`[${blankId}]`);
        return {
          id: `sentence-${i + 1}`,
          text,
          blanks: [{ id: blankId, text: answer, position: position >= 0 ? position : 0 }],
        };
      });
      fbSlide.distractors = [];
      fbSlide.shuffleOptions = true;
      slides.push(fbSlide);
    }
  }

  const quiz = {
    id: `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: quizData.title || `${dataSet.topic} – Jazykový kvíz`,
    slides,
    settings: {
      showProgress: true,
      showScore: true,
      allowSkip: false,
      allowBack: false,
      shuffleQuestions: false,
      shuffleOptions: true,
      showExplanations: 'after-all' as const,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const { stripBase64FromObject } = await import('../supabase/upload-image');
  const safeQuiz = stripBase64FromObject(quiz) as typeof quiz;
  saveQuiz(safeQuiz);

  onProgress?.('save', 'Ukládám kvíz do Supabase...');
  await _syncQz(safeQuiz);

  const slideCount = slides.length - 1; // exclude title
  return {
    success: true,
    id: quiz.id,
    preview: `Jazykový kvíz | ${slideCount} slides | ABC + Spojovačka + Doplňování | ${level} | ${dataSet.grade}. ročník`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Listening Activity Generator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Listening Activity Generator
 *
 * Creates a listening task with audio script, pre/while/post-listening tasks.
 * Generates: WorksheetBlock[] → worksheet (teacher_worksheets) + board (teacher_boards)
 */
async function generateListeningActivity(
  dataSet: TopicDataSet,
  onProgress?: ProgressCallback
): Promise<GenerateResult> {
  onProgress?.('plan', 'Generuji poslechovou aktivitu...');

  const level = gradeToLevel(dataSet.grade);
  const wordCount = level === 'A1' ? '80-120' : level === 'A2' ? '130-190' : '200-280';

  onProgress?.('build', 'Generuji ilustraci tématu...');
  const imageUrl: string | null = null;

  onProgress?.('agent1', 'Generuji audioskript a úkoly...');
  const prompt = `Create a listening activity for Czech EFL students (grade ${dataSet.grade}, CEFR ${level}).

TOPIC: "${dataSet.topic}"
SCRIPT LENGTH: ${wordCount} words

Return ONLY this JSON (no markdown, no code fences):
{
  "title": "string — listening activity title in English, e.g. 'A Day at the Market'",
  "preListeningVocab": [
    { "word": "string — English word/phrase", "translation": "string — Czech translation" }
  ],
  "predictionQuestion": "string — Czech prediction question to think about before listening",
  "script": "string — the listening script in English, ${wordCount} words. Natural dialogue or monologue. Use 'Speaker: ' labels for dialogues. Use \\n\\n for paragraph breaks.",
  "orderingEvents": [
    "string — English sentence describing an event from the script (scrambled order)"
  ],
  "correctOrder": [1, 2, 3, 4, 5],
  "trueFalseStatements": [
    { "statement": "string — English statement about the script", "answer": "T or F" }
  ],
  "comprehensionQuestions": [
    "string — Czech comprehension question, student answers in English"
  ],
  "discussionQuestions": [
    "string — Czech personal discussion question"
  ],
  "answerKey": "string — compact key, e.g. 'Ordering: 3-1-4-2-5 | T/F: T-F-T-T-F'"
}

Rules:
- Exactly 5 pre-listening vocabulary items
- Exactly 5 ordering events (scrambled) + correctOrder array with numbers 1-5
- Exactly 5 True/False statements
- Exactly 3 comprehension questions
- Exactly 2 discussion questions
- Script at CEFR ${level} level — short sentences for A1/A2, varied for B1
- Czech for instructions and questions, English for the script`;

  const response = await chatWithAIProxy([{ role: 'user', content: prompt }], 'gemini-3.1-pro', { max_tokens: 6144 });
  if (!response) return { success: false, error: 'AI neodpovědělo' };

  let data: any;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Žádný JSON v odpovědi');
    data = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return { success: false, error: `Chyba parsování JSON: ${e}` };
  }

  onProgress?.('build', 'Sestavuji pracovní list...');

  const title = data.title || `${dataSet.topic} – Poslech`;
  let order = 0;
  const blocks: WorksheetBlock[] = [];

  // 1. Title heading
  blocks.push({
    id: generateBlockId(), order: order++, type: 'heading', width: 'full',
    content: { text: `🎧 ${title}`, level: 'h1', headingStyle: 'left-border' },
  });

  // 2. Illustration (half) + pre-listening vocab (half)
  if (imageUrl) {
    blocks.push({
      id: generateBlockId(), order: order++, type: 'image', width: 'half',
      content: { url: imageUrl, alt: dataSet.topic, size: 100, alignment: 'center' },
    });
  }
  const vocabRows = (data.preListeningVocab || [])
    .map((v: any) => `<tr><td style="padding:4px 8px;border:1px solid #ccc"><strong>${v.word || ''}</strong></td><td style="padding:4px 8px;border:1px solid #ccc">${v.translation || ''}</td></tr>`)
    .join('');
  blocks.push({
    id: generateBlockId(), order: order++, type: 'infobox',
    width: imageUrl ? 'half' : 'full',
    content: {
      title: '📚 Před poslechem – Klíčová slovíčka',
      html: `<table style="width:100%;border-collapse:collapse">${vocabRows}</table>
<p style="margin-top:8px"><strong>Přemýšlej:</strong> ${data.predictionQuestion || ''}</p>`,
      variant: 'green',
    },
  });

  // 3a. Teacher instruction (worksheet only — not shown in board)
  blocks.push({
    id: generateBlockId(), order: order++, type: 'paragraph', width: 'full',
    worksheetOnly: true,
    content: {
      html: `<p><em>📌 Pro učitele: Přečtěte text nahlas nebo přehrajte nahrávku. Tempo: přirozené pro ${level}. Speaker: viz audioskript níže.</em></p>`,
    },
  } as any);

  // 3b. Audio script — clean text for board (with TTS), full HTML for worksheet
  const scriptHtml = (data.script || '')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  blocks.push({
    id: generateBlockId(), order: order++, type: 'infobox', width: 'full',
    content: {
      title: '🎧 Audioskript',
      html: `<p>${scriptHtml}</p>`,
      variant: 'blue',
      // TTS hint stored in metadata — picked up by board conversion
      ttsText: data.script || '',
      ttsLang: 'en-US',
    },
  });

  // 4. Ordering events free-answer
  const events: string[] = data.orderingEvents || [];
  const correctOrder: number[] = data.correctOrder || [];
  if (events.length > 0) {
    blocks.push({
      id: generateBlockId(), order: order++, type: 'heading', width: 'full',
      content: { text: 'Úkol 1 – Seřaď události', level: 'h2' },
    });
    const eventsHtml = events
      .map((ev: string, i: number) => `${String.fromCharCode(65 + i)}. ${ev}`)
      .join('<br>');
    const keyStr = correctOrder.length > 0
      ? ` (Správné pořadí: ${correctOrder.map((n: number) => String.fromCharCode(64 + n)).join(' → ')})`
      : '';
    blocks.push({
      id: generateBlockId(), order: order++, type: 'paragraph', width: 'full',
      content: { html: `<p>Seřaď tyto události ve správném pořadí (1–${events.length}) podle poslechu:</p><p>${eventsHtml}</p><p style="color:#666;font-size:0.85em">${keyStr}</p>` },
    });
    blocks.push({
      id: generateBlockId(), order: order++, type: 'free-answer', width: 'full',
      content: { question: 'Moje pořadí: ___ → ___ → ___ → ___ → ___', lines: 1 },
    });
  }

  // 5. True/False — one multiple-choice block per statement
  //    → in the board these become ABC slides with True / False bubbles
  const tfStatements: Array<{ statement: string; answer: string }> = data.trueFalseStatements || [];
  if (tfStatements.length > 0) {
    blocks.push({
      id: generateBlockId(), order: order++, type: 'heading', width: 'full',
      content: { text: 'Úkol 2 – Pravda / Nepravda', level: 'h2' },
    });
    for (let i = 0; i < tfStatements.length; i++) {
      const tf = tfStatements[i];
      const isTrue = (tf.answer || '').toUpperCase().startsWith('T');
      blocks.push({
        id: generateBlockId(), order: order++, type: 'multiple-choice', width: 'full',
        content: {
          question: `${i + 1}. ${tf.statement || ''}`,
          options: [
            { id: 'T', text: '✅ True' },
            { id: 'F', text: '❌ False' },
          ],
          correctAnswers: [isTrue ? 'T' : 'F'],
          allowMultiple: false,
          layout: 'horizontal',
          visualStyle: 'playful',
        },
      });
    }
  }

  // 6. Comprehension questions
  const compQs: string[] = data.comprehensionQuestions || [];
  if (compQs.length > 0) {
    blocks.push({
      id: generateBlockId(), order: order++, type: 'heading', width: 'full',
      content: { text: 'Úkol 3 – Otázky s porozuměním', level: 'h2' },
    });
    blocks.push({
      id: generateBlockId(), order: order++, type: 'free-answer', width: 'full',
      content: {
        question: 'Odpověz na otázky anglicky.',
        lines: 2,
        subQuestions: compQs.map((q, i) => ({
          id: `comp-${i + 1}`,
          text: `${i + 1}. ${q}`,
          lines: 2,
        })),
        subColumns: 1,
      },
    });
  }

  // 7. Answer key infobox
  if (data.answerKey) {
    blocks.push({
      id: generateBlockId(), order: order++, type: 'infobox', width: 'full',
      content: { title: '✔️ Klíč', html: `<p>${data.answerKey}</p>`, variant: 'yellow' },
    });
  }

  // 8. Discussion free-answer
  const discQs: string[] = data.discussionQuestions || [];
  if (discQs.length > 0) {
    const discHtml = discQs.map((q, i) => `${i + 1}. ${q}`).join('<br>');
    blocks.push({
      id: generateBlockId(), order: order++, type: 'free-answer', width: 'full',
      content: { question: `💬 Diskuse:\n${discHtml}`, lines: 3 },
    });
  }

  onProgress?.('save', 'Ukládám poslechovou aktivitu jako pracovní list a board...');
  const { worksheetId, boardId } = await _saveLangMaterial(blocks, title, dataSet);

  return {
    success: true,
    id: worksheetId,
    linkedBoardId: boardId,
    preview: `Poslechová aktivita | ${level} | ${wordCount} slov | ${dataSet.grade}. ročník | + Board`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit Plan Generator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unit Plan Generator
 *
 * Creates a comprehensive teacher-facing lesson plan HTML document covering
 * learning objectives, lesson sequence, assessment criteria, and extension tasks.
 */
async function generateUnitPlan(dataSet: TopicDataSet): Promise<GenerateResult> {
  const level = gradeToLevel(dataSet.grade);
  const langCode = dataSet.subjectCode?.includes('nemcin') ? 'German'
    : dataSet.subjectCode?.includes('francouz') ? 'French'
    : 'English';

  const prompt = `Create a complete language unit plan for a Czech EFL teacher (grade ${dataSet.grade}, CEFR ${level}).

TOPIC: "${dataSet.topic}"
LANGUAGE: ${langCode}
LEVEL: ${level}

Return ONLY HTML (no markdown fences, no extra text). This is a TEACHER document — formal language, Czech, professional layout.

<h1>📋 Plán jazykové lekce</h1>
<h2>${dataSet.topic}</h2>
<p class="meta-info">Ročník: ${dataSet.grade}. | CEFR: ${level} | Jazyk: ${langCode}</p>

<h2>🎯 Výukové cíle</h2>
<p><strong>Po skončení lekce žák:</strong></p>
<ul>
  [4-5 CEFR-based "Can do" statements in Czech, specific to the topic]
  [e.g. "... dokáže pojmenovat 10 klíčových slov z tématu ..."]
  [e.g. "... dokáže napsat krátký text (50 slov) o tématu ..."]
</ul>

<h2>📚 Jazykový obsah</h2>
<table>
  <tr><th>Složka</th><th>Obsah</th></tr>
  <tr><td>Slovní zásoba</td><td>[15 key lexical items for this topic and level]</td></tr>
  <tr><td>Gramatika</td><td>[2-3 grammar structures relevant to topic + level]</td></tr>
  <tr><td>Funkce jazyka</td><td>[Communicative functions: describing, comparing, asking about...]</td></tr>
</table>

<h2>⏱️ Plán lekcí (4 × 45 minut)</h2>

<h3>Lekce 1 – Úvod do tématu + slovní zásoba</h3>
[Detailed lesson plan: warm-up (5 min), main activities (35 min), closure (5 min)]
[Include: materials needed, grouping (individual/pairs/groups), instructions in Czech]

<h3>Lekce 2 – Čtení a gramatika</h3>
[Detailed plan for lesson 2]

<h3>Lekce 3 – Poslech a mluvení</h3>
[Detailed plan for lesson 3]

<h3>Lekce 4 – Psaní + zopakování + test</h3>
[Detailed plan with revision and assessment]

<h2>📊 Hodnocení</h2>
<table>
  <tr><th>Aktivita</th><th>Typ hodnocení</th><th>Váha</th></tr>
  <tr><td>Slovní zásoba (kvíz)</td><td>Formativní</td><td>—</td></tr>
  <tr><td>Psaní</td><td>Sumativní</td><td>40 %</td></tr>
  <tr><td>Mluvení (role-play)</td><td>Sumativní</td><td>30 %</td></tr>
  <tr><td>Gramatický test</td><td>Sumativní</td><td>30 %</td></tr>
</table>

<h2>📎 Materiály</h2>
<ul>
  [List of all materials the teacher needs: worksheets, VividBoard quizzes, printouts, etc.]
  [Include digital tools suggestions]
</ul>

<h2>🔧 Diferenciace</h2>
<p><strong>Pro slabší žáky:</strong></p>
[2-3 scaffolding strategies]
<p><strong>Pro rychlejší žáky:</strong></p>
[2-3 extension tasks]

<h2>🔗 Mezipředmětové vztahy</h2>
[2-3 connections to other school subjects]

Rules:
- Professional teacher-facing document in Czech
- Practical, specific, actionable (not generic advice)
- Timing should be realistic for a 45-minute lesson
- Activities should match CEFR ${level} and grade ${dataSet.grade}
`;

  const response = await chatWithAIProxy([{ role: 'user', content: prompt }], 'gemini-3.1-pro', { max_tokens: 8192 });
  if (!response) return { success: false, error: 'AI neodpovědělo' };


  const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const title = `${dataSet.topic} – Plán lekce`;

  saveDocument({ id: docId, title, content: response, type: 'lesson' });
  await syncDocumentDirectToSupabase({ id: docId, title, content: response, documentType: 'lesson' });

  return {
    success: true,
    id: docId,
    preview: `Plán lekce | 4 × 45 min | Cíle, aktivity, hodnocení, diferenciace | ${level} | ${dataSet.grade}. ročník`,
  };
}
