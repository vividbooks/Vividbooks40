/**
 * Content Converter
 * 
 * Utility functions to convert between Worksheet blocks and Quiz slides
 * Enables bidirectional conversion between the two editor formats
 */

import { 
  Worksheet, 
  WorksheetBlock, 
  BlockType,
  generateBlockId,
  MultipleChoiceContent,
  FreeAnswerContent,
  HeadingContent,
  ParagraphContent,
  InfoboxContent,
  FillBlankContent,
  ExamplesContent,
  ImageContent,
  TableContent,
  BlockVisualStyles,
} from '../types/worksheet';
import { getOptionTextHtml, getQuestionHtml, getSubQuestionTextHtml, legacyQuestionStringToHtml } from './worksheet-text';

import {
  Quiz,
  QuizSlide,
  ABCActivitySlide,
  OpenActivitySlide,
  ExampleActivitySlide,
  ExampleKeyboardType,
  InfoSlide,
  SlideBlock,
  FillBlanksActivitySlide,
  ConnectPairsActivitySlide,
  ImageHotspotsActivitySlide,
  VideoQuizActivitySlide,
  VotingActivitySlide,
  BoardActivitySlide,
  createEmptyQuiz,
  createABCSlide,
  createOpenSlide,
  createExampleSlide,
  createInfoSlide,
  createSlideLayout,
  createSlideBlock,
} from '../types/quiz';

// ============================================
// WORKSHEET → BOARD CONVERSION
// ============================================

/**
 * Options for per-block export customisation during worksheetToBoard conversion.
 */
export interface WorksheetToBoardOptions {
  /** Per-block sub-question export mode. Defaults to 'single' for unspecified blocks. */
  blockSubqModes?: Record<string, SubQuestionsExportMode>;
  /** Pre-captured HTML strings for blocks that should be embedded as HTML slides. */
  htmlCaptures?: Record<string, string>;
  /**
   * When true, each block's boardSettings field is respected:
   *  - skip: block is omitted entirely
   *  - subQuestionsMode: 'single'|'each'|'html' overrides blockSubqModes for free-answer blocks
   *  - hideAnswer: strips correct answers from the generated slide
   *  - showHint: controls whether explanation/hint is included
   */
  useBoardSettings?: boolean;
  /**
   * Additional block IDs to skip entirely during slide generation.
   * Used for blocks absorbed into a merge group (mergeWithNext) — their content
   * is already embedded in the preceding block's combined HTML capture.
   */
  skipBlockIds?: string[];
}

/**
 * Convert a Worksheet to a Quiz/Board
 */
export interface WorksheetToBoardResult {
  quiz: Quiz;
  /** Maps each source block ID to the index of its first generated slide */
  blockIdToSlideIndex: Record<string, number>;
}

export function worksheetToBoard(worksheet: Worksheet, options: WorksheetToBoardOptions = {}): WorksheetToBoardResult {
  const { blockSubqModes = {}, htmlCaptures = {}, useBoardSettings = false, skipBlockIds = [] } = options;
  const gridColumns: number = (worksheet.metadata?.gridColumns as number) || 12;
  const skipSet = new Set(skipBlockIds);
  const quiz = createEmptyQuiz(`board-${Date.now()}`);
  
  quiz.title = `${worksheet.title} (Board)`;
  quiz.description = worksheet.description;
  quiz.subject = worksheet.metadata.subject;
  quiz.grade = worksheet.metadata.grade;
  quiz.createdAt = new Date().toISOString();
  quiz.updatedAt = new Date().toISOString();
  
  // Convert blocks to slides — with smart heading+subheading merging
  let order = 0;
  const slides: QuizSlide[] = [];
  const blocks = worksheet.blocks;
  const blockIdToSlideIndex: Record<string, number> = {};

  let i = 0;
  while (i < blocks.length) {
    const cur = blocks[i];
    const next = blocks[i + 1];

    // Skip blocks that are absorbed into a merge group, or explicitly skipped via boardSettings
    if (skipSet.has(cur.id) || (useBoardSettings && cur.boardSettings?.skip)) {
      i++;
      continue;
    }

    // ── Boční panel (float) block: auto-pair with the next floatSpanBlocks siblings ──
    // Float blocks visually sit beside adjacent blocks — map to a 2-col slide automatically.
    if ((cur as any).floatSide && INFORMATIONAL_BLOCK_TYPES.has(cur.type)) {
      const spanCount: number = (cur as any).floatSpanBlocks ?? 1;
      const chain: WorksheetBlock[] = [cur];
      let j = i + 1;
      let added = 0;
      while (j < blocks.length && added < spanCount) {
        const candidate = blocks[j];
        if (skipSet.has(candidate.id) || (useBoardSettings && candidate.boardSettings?.skip)) { j++; continue; }
        chain.push(candidate);
        added++;
        j++;
      }
      if (chain.length > 1) {
        const mergedSlide = buildMergeGroupSlide(chain, order, gridColumns);
        if (mergedSlide) {
          for (const b of chain) blockIdToSlideIndex[b.id] = order;
          slides.push(mergedSlide);
          order++;
        }
        i = j;
        continue;
      }
      // No siblings found — fall through and emit as standalone image slide
    }

    // ── Merge chain: collect N following blocks defined by mergeCount (or legacy mergeWithNext) ──
    const curMergeCount = cur.boardSettings?.mergeCount
      ?? (cur.boardSettings?.mergeWithNext ? 1 : 0);
    if (useBoardSettings && curMergeCount > 0 && INFORMATIONAL_BLOCK_TYPES.has(cur.type)) {
      const chain: WorksheetBlock[] = [cur];
      let j = i + 1;
      let added = 0;
      while (j < blocks.length && added < curMergeCount) {
        const candidate = blocks[j];
        // Skip explicitly skipped blocks but don't count them against the limit
        if (skipSet.has(candidate.id) || candidate.boardSettings?.skip) { j++; continue; }
        chain.push(candidate);
        added++;
        j++;
      }

      if (chain.length > 1) {
        const mergedSlide = buildMergeGroupSlide(chain, order, gridColumns);
        if (mergedSlide) {
          for (const b of chain) blockIdToSlideIndex[b.id] = order;
          slides.push(mergedSlide);
          order++;
        }
        i = j;
        continue;
      }
      // Single-block chain (next block wasn't informational or didn't exist) — fall through
    }

    // If this block has a pre-captured HTML, embed it as a link-html info slide
    if (htmlCaptures[cur.id]) {
      blockIdToSlideIndex[cur.id] = order;
      const slide = createInfoSlide(order);
      const layout = createSlideLayout('single');
      layout.blocks[0] = { ...createSlideBlock('link'), linkMode: 'html', content: htmlCaptures[cur.id] };
      slide.layout = layout;
      slides.push(slide);
      order++;
      i++;
      continue;
    }

    // Merge heading h1 + heading h2/h3 into one title-content slide
    if (
      cur.type === 'heading' && next?.type === 'heading' &&
      !(useBoardSettings && next.boardSettings?.skip) &&
      (cur.content as HeadingContent).level === 'h1' &&
      ((next.content as HeadingContent).level === 'h2' || (next.content as HeadingContent).level === 'h3')
    ) {
      const h1 = cur.content as HeadingContent;
      const h2 = next.content as HeadingContent;
      blockIdToSlideIndex[cur.id] = order;
      blockIdToSlideIndex[next.id] = order;
      const slide = createInfoSlide(order);
      slide.title = h1.text;
      slide.content = h2.text;
      slide.layout = {
        type: 'title-content',
        blocks: [
          buildHeadingBlock(h1),
          buildHeadingBlock(h2),
        ],
        titleHeight: 30,
      };
      slides.push(slide);
      order++;
      i += 2;
      continue;
    }

    // Determine sub-question mode — boardSettings.subQuestionsMode overrides blockSubqModes
    let blockSubqMode: SubQuestionsExportMode = blockSubqModes[cur.id] ?? 'single';
    if (useBoardSettings && cur.boardSettings?.subQuestionsMode) {
      blockSubqMode = cur.boardSettings.subQuestionsMode; // 'single' | 'each' | 'html'
    }

    const converted = blockToSlides(cur, order, blockSubqMode);

    // Apply boardSettings.hideAnswer and showHint post-conversion
    if (useBoardSettings && converted.length > 0) {
      for (const slide of converted) {
        if (cur.boardSettings?.hideAnswer) {
          if ('correctAnswers' in slide) (slide as any).correctAnswers = [];
          if ('options' in slide && Array.isArray((slide as any).options)) {
            (slide as any).options = (slide as any).options.map((o: any) => ({ ...o, isCorrect: false }));
          }
        }
        if (cur.boardSettings?.showHint === false) {
          if ('explanation' in slide) (slide as any).explanation = undefined;
        }
      }
    }

    if (converted.length > 0) {
      blockIdToSlideIndex[cur.id] = order;
    }
    for (const slide of converted) {
      slides.push(slide);
      order++;
    }
    i++;
  }
  
  // Re-assign order numbers
  slides.forEach((slide, idx) => {
    slide.order = idx;
  });
  
  quiz.slides = slides;
  return { quiz, blockIdToSlideIndex };
}

/**
 * Convert a single WorksheetBlock to quiz slides.
 * Used by the export panel for per-block exports.
 */
export function blockToSlidesPublic(block: WorksheetBlock, subqMode: SubQuestionsExportMode = 'single'): QuizSlide[] {
  return blockToSlides(block, 0, subqMode);
}

// ── Informational block types that can be merged ──────────────────────────────
const INFORMATIONAL_BLOCK_TYPES = new Set<BlockType>([
  'heading', 'paragraph', 'infobox', 'image', 'table', 'spacer', 'qr-code', 'header-footer',
]);

// ── Infobox variant → colors ──────────────────────────────────────────────────
const INFOBOX_COLORS: Record<string, { bg: string; text: string }> = {
  blue:   { bg: '#dbeafe', text: '#1e40af' },
  green:  { bg: '#dcfce7', text: '#166534' },
  yellow: { bg: '#fef9c3', text: '#854d0e' },
  purple: { bg: '#f3e8ff', text: '#6b21a8' },
  pink:   { bg: '#fce7f3', text: '#9d174d' },
};

/** Strip HTML tags from a string, converting block elements to newlines. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Returns true when HTML contains inline formatting (bold, italic, highlight marks…). */
function hasHtmlFormatting(html: string): boolean {
  return /<(strong|em|b|i|u|s|mark)\b|class="[^"]*highlight/i.test(html);
}

/**
 * Wrap arbitrary paragraph HTML with a CSS style block so inline formatting
 * (bold, marks, highlights…) renders correctly inside the board's text block.
 * The resulting string is stored in `content` with `contentFormat:'html'`.
 */
function wrapHtmlForBoard(html: string, _bgColor?: string, _textColor?: string): string {
  return `<style>
strong,b{font-weight:600}
em,i{font-style:italic}
mark,.highlight-yellow{background:#fef08a;padding:.1em .25em;border-radius:3px}
.highlight-green{background:#bbf7d0;padding:.1em .25em;border-radius:3px}
.highlight-blue{background:#bfdbfe;padding:.1em .25em;border-radius:3px}
.highlight-pink{background:#fbcfe8;padding:.1em .25em;border-radius:3px}
.highlight-purple{background:#e9d5ff;padding:.1em .25em;border-radius:3px}
p{margin:0 0 .5em}p:last-child{margin-bottom:0}
ul,ol{margin:.5em 0;padding-left:1.5em}li{margin:.2em 0}
h2,h3{font-weight:600;margin:0 0 .4em}
</style>${html}`;
}

/**
 * Convert one informational WorksheetBlock to a native SlideBlock.
 * Paragraphs / infoboxes with rich HTML formatting are converted to linkMode:'html'
 * so the board preserves bold, italic, highlights etc.
 */
function blockToSlideBlock(block: WorksheetBlock): SlideBlock | null {
  switch (block.type) {
    case 'heading': {
      const content = block.content as HeadingContent;
      return {
        ...createSlideBlock('text'),
        content: stripHtml(content.text || ''),
        fontSize: content.level === 'h1' ? 'xlarge' : content.level === 'h2' ? 'large' : 'medium',
        fontWeight: 'bold',
        textAlign: 'left',
        verticalAlign: 'middle',
      };
    }
    case 'paragraph': {
      const content = block.content as ParagraphContent;
      const vs: BlockVisualStyles | undefined = block.visualStyles;
      const rawHtml = content.html || '';
      if (hasHtmlFormatting(rawHtml)) {
        const sb: SlideBlock = {
          ...createSlideBlock('text'),
          content: wrapHtmlForBoard(rawHtml),
          contentFormat: 'html',
          textAlign: 'left',
          verticalAlign: 'top',
          textOverflow: 'scroll',
        };
        if (vs?.backgroundColor) sb.background = { type: 'color', color: vs.backgroundColor };
        return sb;
      }
      const sb: SlideBlock = {
        ...createSlideBlock('text'),
        content: stripHtml(rawHtml),
        textAlign: 'left',
        verticalAlign: 'top',
        textOverflow: 'scroll',
      };
      if (vs?.backgroundColor) sb.background = { type: 'color', color: vs.backgroundColor };
      return sb;
    }
    case 'infobox': {
      const content = block.content as InfoboxContent;
      const colors = INFOBOX_COLORS[(content as { variant?: string }).variant ?? ''] ?? INFOBOX_COLORS.blue;
      const rawHtml = content.html || '';
      const titleLine = content.title ? `<p><strong>${content.title}</strong></p>` : '';
      if (hasHtmlFormatting(rawHtml) || content.title) {
        return {
          ...createSlideBlock('text'),
          content: wrapHtmlForBoard(titleLine + rawHtml),
          contentFormat: 'html',
          textAlign: 'left',
          verticalAlign: 'top',
          textOverflow: 'scroll',
          background: { type: 'color', color: colors.bg },
          textColor: colors.text,
        };
      }
      const titlePrefix = content.title ? `${content.title}\n` : '';
      return {
        ...createSlideBlock('text'),
        content: titlePrefix + stripHtml(rawHtml),
        textAlign: 'left',
        verticalAlign: 'top',
        textOverflow: 'scroll',
        background: { type: 'color', color: colors.bg },
        textColor: colors.text,
      };
    }
    case 'image': {
      const content = block.content as ImageContent;
      const galleryUrls = (content.gallery && content.gallery.length > 0) ? content.gallery : (content.url ? [content.url] : []);
      if (!galleryUrls.length) return null;
      const sb: SlideBlock = {
        ...createSlideBlock('image'),
        content: galleryUrls[0],
        title: content.alt || '',
      };
      if (galleryUrls.length > 1) {
        sb.gallery = galleryUrls;
        sb.galleryDisplayMode = 'grid';
        sb.galleryGridColumns = content.gridColumns ?? 2;
        sb.galleryCaptions = content.galleryCaptions;
      }
      return sb;
    }
    case 'table': {
      const content = block.content as TableContent;
      if (!content.html) return null;
      return {
        ...createSlideBlock('table'),
        content: content.html,
        tableData: { html: content.html, hasBorder: content.hasBorder ?? true, hasRoundedCorners: content.hasRoundedCorners ?? true },
      };
    }
    default:
      return null;
  }
}

/**
 * Convert a WorksheetBlock to a plain-text string for combining multiple blocks
 * into one SlideBlock. Preserves block heading as a bold prefix line.
 */
function blockToPlainText(block: WorksheetBlock): string {
  switch (block.type) {
    case 'heading': {
      const content = block.content as HeadingContent;
      return stripHtml(content.text || '');
    }
    case 'paragraph': {
      const content = block.content as ParagraphContent;
      return stripHtml(content.html || '');
    }
    case 'infobox': {
      const content = block.content as InfoboxContent;
      const title = content.title ? `${content.title}\n` : '';
      return title + stripHtml(content.html || '');
    }
    default:
      return '';
  }
}

/**
 * Get block width as a percentage (0–100) for layout row-grouping purposes.
 * For float (boční panel) blocks, uses floatGridSpan relative to gridColumns.
 */
function blockWidthPercent(block: WorksheetBlock, gridColumns = 12): number {
  // Explicit widthPercent overrides everything
  if (block.widthPercent) return block.widthPercent;
  // Float block: use floatGridSpan (grid-aligned) with fallback to floatWidthPercent
  if (block.floatSide) {
    if (block.floatGridSpan) return Math.round(block.floatGridSpan / gridColumns * 100);
    if (block.floatWidthPercent) return block.floatWidthPercent;
    return 33; // safe default (~4/12)
  }
  switch (block.width) {
    case 'half':          return 50;
    case 'third':         return 33;
    case 'two-thirds':    return 67;
    case 'quarter':       return 25;
    case 'three-quarters':return 75;
    default:              return 100; // 'full' or undefined
  }
}

/**
 * Group consecutive blocks into visual "rows" — blocks wrap to a new row
 * when accumulated width exceeds ~100%.
 *
 * Handles floatSide (boční panel) blocks:
 *   - The floated block has a grid-span-based width (floatGridSpan).
 *   - The block immediately following it fills the remaining space.
 */
function groupBlocksIntoRows(chain: WorksheetBlock[], gridColumns = 12): WorksheetBlock[][] {
  const rows: WorksheetBlock[][] = [];
  let currentRow: WorksheetBlock[] = [];
  let rowWidth = 0;
  // Width % of the active floated block so the next block fills the remainder
  let prevFloatWidthPct = 0;

  for (const block of chain) {
    let bw: number;
    if (block.widthPercent) {
      bw = block.widthPercent;
    } else if (block.floatSide) {
      bw = blockWidthPercent(block, gridColumns);
    } else if (prevFloatWidthPct > 0 && (!block.width || block.width === 'full')) {
      // This block occupies the space beside the previous float
      bw = 100 - prevFloatWidthPct;
    } else {
      bw = blockWidthPercent(block, gridColumns);
    }

    // Track the float width for the next iteration
    prevFloatWidthPct = block.floatSide ? blockWidthPercent(block, gridColumns) : 0;

    if (rowWidth + bw > 105 && currentRow.length > 0) {
      rows.push(currentRow);
      currentRow = [block];
      rowWidth = bw;
    } else {
      currentRow.push(block);
      rowWidth += bw;
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);
  return rows;
}

/** Pick slide layout type for a row of side-by-side blocks. */
function colsLayout(count: number): 'single' | '2cols' | '3cols' | 'grid-2x2' {
  if (count >= 4) return 'grid-2x2';
  if (count === 3) return '3cols';
  if (count === 2) return '2cols';
  return 'single';
}

/**
 * Return the raw HTML string for a text-like block (heading, paragraph, infobox).
 * Used when building a combined HTML SlideBlock from multiple worksheet blocks.
 */
function blockToHtmlPart(block: WorksheetBlock): string {
  switch (block.type) {
    case 'heading': {
      const content = block.content as HeadingContent;
      const tag = content.level || 'h2';
      return `<${tag} style="font-weight:600;margin:0 0 .4em">${content.text || ''}</${tag}>`;
    }
    case 'paragraph': {
      const content = block.content as ParagraphContent;
      return content.html || '';
    }
    case 'infobox': {
      const content = block.content as InfoboxContent;
      const title = content.title ? `<p><strong>${content.title}</strong></p>` : '';
      return title + (content.html || '');
    }
    default:
      return '';
  }
}

/**
 * Combine multiple text-like blocks into a single SlideBlock.
 * Uses linkMode:'html' when any block has rich HTML formatting;
 * otherwise produces a plain native text block.
 */
function combineTextBlocks(blocks: WorksheetBlock[]): SlideBlock {
  const anyHtml = blocks.some(b => {
    if (b.type === 'paragraph') return hasHtmlFormatting((b.content as ParagraphContent).html || '');
    if (b.type === 'infobox') return hasHtmlFormatting((b.content as InfoboxContent).html || '');
    return false;
  });

  if (anyHtml) {
    const combined = blocks.map(b => blockToHtmlPart(b)).filter(Boolean).join('<br>');
    return {
      ...createSlideBlock('text'),
      content: wrapHtmlForBoard(combined),
      contentFormat: 'html',
      textAlign: 'left',
      verticalAlign: 'top',
      textOverflow: 'scroll',
    };
  }

  const combinedText = blocks.map(b => blockToPlainText(b)).filter(Boolean).join('\n\n');
  return {
    ...createSlideBlock('text'),
    content: combinedText,
    textAlign: 'left',
    verticalAlign: 'top',
    textOverflow: 'scroll',
  };
}

/**
 * Build a single InfoSlide from a group of merged informational blocks.
 *
 * Layout is determined by the visual arrangement in the worksheet:
 *   • All in one row (half/third widths) → 2cols / 3cols / grid-2x2
 *   • Heading row + single content row   → title-content
 *   • Heading row + 2-col content row    → title-2cols
 *   • Heading row + 3-col content row    → title-3cols
 *   • 2 full-width rows (no heading)     → 2cols (side by side)
 *   • 3+ full-width rows (no heading)   → single combined text block
 */
function buildMergeGroupSlide(chain: WorksheetBlock[], order: number, gridColumns = 12): QuizSlide | null {
  const rows = groupBlocksIntoRows(chain, gridColumns);
  if (rows.length === 0) return null;

  // ── Case 1: everything in one row ────────────────────────────────────────────
  if (rows.length === 1) {
    const sbs = rows[0].map(b => blockToSlideBlock(b)).filter((s): s is SlideBlock => s !== null);
    if (sbs.length === 0) return null;

    const slide = createInfoSlide(order, 'single');
    const layout = createSlideLayout(colsLayout(sbs.length));
    for (let k = 0; k < Math.min(sbs.length, layout.blocks.length); k++) layout.blocks[k] = sbs[k];
    slide.layout = layout;
    return slide;
  }

  // ── Case 2: heading row + content row(s) ────────────────────────────────────
  const firstRow = rows[0];
  const isFirstRowHeading = firstRow.length === 1 && firstRow[0].type === 'heading';

  if (isFirstRowHeading) {
    const titleSb = blockToSlideBlock(firstRow[0]);
    if (!titleSb) return null;
    // Ensure title block looks like a title
    titleSb.fontWeight = 'bold';
    titleSb.textAlign = 'left';
    titleSb.verticalAlign = 'middle';

    const contentRows = rows.slice(1);

    // Single content row
    if (contentRows.length === 1) {
      const contentBlocks = contentRows[0];
      const contentSbs = contentBlocks.map(b => blockToSlideBlock(b)).filter((s): s is SlideBlock => s !== null);
      if (contentSbs.length === 0) return null;

      const layoutType = contentSbs.length >= 3 ? 'title-3cols'
        : contentSbs.length === 2 ? 'title-2cols'
        : 'title-content';
      const slide = createInfoSlide(order, 'single');
      const layout = createSlideLayout(layoutType);
      layout.blocks[0] = titleSb;
      for (let k = 0; k < contentSbs.length; k++) layout.blocks[k + 1] = contentSbs[k];
      slide.layout = layout;
      return slide;
    }

    // Multiple content rows → combine into one native text block
    const combinedText = contentRows.flat()
      .map(b => blockToPlainText(b))
      .filter(Boolean)
      .join('\n\n');
    const bodySb: SlideBlock = { ...createSlideBlock('text'), content: combinedText, textAlign: 'left', verticalAlign: 'top', textOverflow: 'scroll' };

    const slide = createInfoSlide(order, 'single');
    const layout = createSlideLayout('title-content');
    layout.blocks[0] = titleSb;
    layout.blocks[1] = bodySb;
    slide.layout = layout;
    return slide;
  }

  // ── Case 3: multiple stacked full-width rows without a heading first ─────────
  const allSbs = chain.map(b => blockToSlideBlock(b)).filter((s): s is SlideBlock => s !== null);
  if (allSbs.length === 0) return null;

  if (allSbs.length === 2) {
    // Two non-heading merged blocks → place side by side (2cols).
    const slide = createInfoSlide(order, 'single');
    const layout = createSlideLayout('2cols');
    layout.blocks[0] = allSbs[0];
    layout.blocks[1] = allSbs[1];
    slide.layout = layout;
    return slide;
  }

  // ── Case 3b: image + text blocks ────────────────────────────────────────────
  // If the chain contains an image block, put it on the left and combine
  // the remaining text blocks on the right. This preserves the image instead
  // of collapsing the whole chain into plain text.
  const imageIdx = chain.findIndex(b => b.type === 'image');
  if (imageIdx !== -1) {
    const imageSb = blockToSlideBlock(chain[imageIdx]);
    const textBlocks = chain.filter((_, idx) => idx !== imageIdx);

    if (imageSb && textBlocks.length > 0) {
      const textSb = combineTextBlocks(textBlocks);
      const slide = createInfoSlide(order, 'single');
      const layout = createSlideLayout('2cols');
      layout.blocks[0] = imageIdx === 0 ? imageSb : textSb;
      layout.blocks[1] = imageIdx === 0 ? textSb : imageSb;
      slide.layout = layout;
      return slide;
    }
    if (imageSb) {
      const slide = createInfoSlide(order, 'single');
      const layout = createSlideLayout('single');
      layout.blocks[0] = imageSb;
      slide.layout = layout;
      return slide;
    }
  }

  // Fallback: 3+ stacked text blocks → combine into single block (HTML if needed)
  const slide = createInfoSlide(order, 'single');
  const layout = createSlideLayout('single');
  layout.blocks[0] = combineTextBlocks(chain);
  slide.layout = layout;
  return slide;
}

// ── Build a styled SlideBlock from HeadingContent ────────────────────────────
function buildHeadingBlock(content: HeadingContent): SlideBlock {
  const level = content.level || 'h1';
  const style = content.headingStyle || 'plain';
  const highlightColor = content.highlightColor || '#e0f2fe';

  const fontSizeMap: Record<string, SlideBlock['fontSize']> = {
    h1: 'xxlarge', h2: 'xlarge', h3: 'large',
  };

  // Cooper Light is a display font — never apply bold (it's always light weight)
  const useCooper = level === 'h1' && style === 'plain';

  const block: SlideBlock = {
    id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'text',
    content: stripHtml(content.text || ''),
    textAlign: (content.align as SlideBlock['textAlign']) || 'center',
    verticalAlign: 'middle',
    fontSize: fontSizeMap[level] ?? 'xlarge',
    fontWeight: useCooper ? 'normal' : (content.isBold !== false ? 'bold' : 'normal'),
    fontStyle: content.isItalic ? 'italic' : 'normal',
    fontFamily: useCooper ? 'cooper' : undefined,
    textColor: content.textColor || undefined,
    textOverflow: 'fit',
    // Store the heading style so the editor UI can show & edit it
    headingStyle: (style !== 'plain' ? style : undefined) as SlideBlock['headingStyle'],
    headingStyleColor: content.highlightColor || undefined,
  };

  return block;
}

/**
 * Detect whether a question/sub-question text is mathematical.
 * Checks for LaTeX syntax, math operators paired with digits, math symbols, and Czech math keywords.
 */
function isMathQuestion(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  // LaTeX inline math
  if (/\$[^$]+\$/.test(text)) return true;
  // LaTeX commands
  if (/\\(frac|sqrt|sum|int|times|div|cdot|pm|leq|geq|neq|alpha|beta|pi|infty)/.test(text)) return true;
  // Arithmetic operators with numbers on both sides
  if (/\d\s*[+\-×÷]\s*\d/.test(text)) return true;
  if (/\d\s*[*\/]\s*\d/.test(text)) return true;
  // Equations with = and numbers
  if (/\d\s*=\s*\d/.test(text)) return true;
  // Math symbols
  if (/[²³⁴⁵√π∞½¼¾⅓⅔⅛⅜⅝⅞]/.test(text)) return true;
  // Czech math keywords
  if (/\b(vypočítej|vypočti|spočítej|spočti|výsledek|výpočet|rovnice|příklad|doplň\s+číslo|seřaď|porovnej|zaokrouhli|zlomek|násobek|dělení|sčítání|odčítání|kolik\s+je|o\s+kolik|kolikrát)\b/.test(t)) return true;
  return false;
}

/**
 * Infer the best Vividboard keyboard type from the math question text.
 */
function detectKeyboardType(text: string): ExampleKeyboardType {
  if (!text) return 'simple';
  const t = text.toLowerCase();
  // Fractions → fraction keyboard
  if (/\\frac|[½¼¾⅓⅔⅛⅜⅝⅞]/.test(text)) return 'fraction';
  // Comparison / ordering → comparison keyboard
  if (/[<>≤≥]|\\leq|\\geq|\b(menší|větší|porovnej|seřaď|který|co\s+je\s+víc)\b/.test(t)) return 'comparison';
  // Integer-only arithmetic (no variable, no fraction) → number-only
  if (/\d+\s*[+\-×÷*\/]\s*\d+/.test(text) && !/[a-zA-Z=]/.test(text.replace(/[0-9\s+\-×÷*\/=.]/g, ''))) return 'number-only';
  // Algebraic or complex → full keyboard
  if (/[a-wyzA-WYZ]\s*=|\\sum|\\int|\b(rovnice|nerovnice|algebra)\b/.test(t)) return 'full';
  return 'simple';
}

/**
 * Convert the hybrid markdown+HTML format stored in worksheet questions to pure HTML.
 * Worksheet question text uses: **bold**, *italic*, <u>underline</u>, <mark style="...">highlight</mark>
 * MathText in Vividboard only processes HTML tags, not asterisk markdown.
 */
function worksheetRichTextToHtml(text: string): string {
  return legacyQuestionStringToHtml(text);
}

export type SubQuestionsExportMode = 'each' | 'single';

/**
 * Convert a single worksheet block to quiz slides (can return multiple for examples)
 * @param subqMode - for free-answer blocks with subQuestions: 'each' = one slide per sub-question, 'single' = one open slide
 */
function blockToSlides(block: WorksheetBlock, startOrder: number, subqMode: SubQuestionsExportMode = 'single'): QuizSlide[] {
  switch (block.type) {
    case 'multiple-choice': {
      const content = block.content as MultipleChoiceContent;
      const slide = createABCSlide(startOrder);
      slide.question = getQuestionHtml(content);
      slide.options = content.options.map((opt, idx) => ({
        id: opt.id,
        label: String.fromCharCode(65 + idx), // A, B, C, D...
        content: getOptionTextHtml(opt),
        isCorrect: content.correctAnswers.includes(opt.id),
      }));
      slide.explanation = content.explanation;
      return [slide];
    }
    
    case 'free-answer': {
      const content = block.content as FreeAnswerContent;

      // Sub-questions: main question as text slide, then each sub-question as its own slide
      if (subqMode === 'each' && content.subQuestions && content.subQuestions.length > 0) {
        const slides: QuizSlide[] = [];

        // First slide: main question text as an info slide
        if (getQuestionHtml(content)) {
          const mainSlide = createInfoSlide(startOrder);
          const textBlock = createSlideBlock('text');
          textBlock.content = getQuestionHtml(content);
          textBlock.fontSize = 'large';
          textBlock.fontWeight = 'medium';
          textBlock.textAlign = 'left';
          mainSlide.layout = { type: 'single', blocks: [textBlock] };
          slides.push(mainSlide);
        }

        // Then one slide per sub-question
        content.subQuestions.forEach((sq, i) => {
          const questionText = sq.text || '';
          const htmlText = getSubQuestionTextHtml(sq);
          const media = sq.imageUrl ? { type: 'image' as const, url: sq.imageUrl } : undefined;
          const order = startOrder + slides.length;

          if (isMathQuestion(questionText)) {
            const slide = createExampleSlide(order);
            slide.problem = htmlText;
            slide.keyboardType = detectKeyboardType(questionText);
            if (sq.sampleAnswer) slide.finalAnswer = sq.sampleAnswer;
            if (media) slide.media = media;
            slides.push(slide);
          } else {
            const slide = createOpenSlide(order);
            slide.question = htmlText;
            if (sq.sampleAnswer) slide.correctAnswers = [sq.sampleAnswer];
            if (media) slide.media = media;
            slides.push(slide);
          }
        });

        return slides;
      }

      // Default: single open slide with the main question
      const slide = createOpenSlide(startOrder);
      slide.question = getQuestionHtml(content);
      if (content.sampleAnswer) {
        slide.correctAnswers = [content.sampleAnswer];
      }
      slide.explanation = content.hint;
      return [slide];
    }
    
    case 'fill-blank': {
      const content = block.content as FillBlankContent;
      // Convert fill-blank to open question with the full text
      const slide = createOpenSlide(startOrder);
      
      // Build question text and collect answers
      let questionText = content.instruction ? content.instruction + '\n\n' : '';
      const answers: string[] = [];
      
      for (const segment of content.segments) {
        if (segment.type === 'text') {
          questionText += segment.content;
        } else {
          questionText += '_____';
          answers.push(segment.correctAnswer);
          if (segment.acceptedAnswers) {
            answers.push(...segment.acceptedAnswers);
          }
        }
      }
      
      slide.question = questionText;
      slide.correctAnswers = answers;
      return [slide];
    }
    
    case 'heading': {
      const content = block.content as HeadingContent;
      const slide = createInfoSlide(startOrder);
      slide.title = content.text || '';
      slide.content = '';
      slide.layout = {
        type: 'single',
        blocks: [buildHeadingBlock(content)],
      };
      return [slide];
    }
    
    case 'paragraph': {
      const content = block.content as ParagraphContent;
      const slide = createInfoSlide(startOrder);
      slide.title = '';
      slide.content = content.html || '';
      const rawHtml = content.html || '';
      let paragraphSlideBlock: SlideBlock;
      if (hasHtmlFormatting(rawHtml)) {
        paragraphSlideBlock = {
          ...createSlideBlock('text'),
          content: wrapHtmlForBoard(rawHtml),
          contentFormat: 'html',
          textAlign: 'left',
          verticalAlign: 'top',
          textOverflow: 'scroll',
        };
        if (block.visualStyles?.backgroundColor) {
          paragraphSlideBlock.background = { type: 'color', color: block.visualStyles.backgroundColor };
        }
      } else {
        paragraphSlideBlock = {
          ...createSlideBlock('text'),
          content: stripHtml(rawHtml),
          textAlign: 'left',
          verticalAlign: 'top',
          textOverflow: 'scroll',
        };
        if (block.visualStyles?.backgroundColor) {
          paragraphSlideBlock.background = { type: 'color', color: block.visualStyles.backgroundColor };
        }
      }
      slide.layout = { type: 'single', blocks: [paragraphSlideBlock] };
      return [slide];
    }
    
    case 'infobox': {
      const content = block.content as InfoboxContent;
      const colors = INFOBOX_COLORS[(content as { variant?: string }).variant ?? ''] ?? INFOBOX_COLORS.blue;
      const slide = createInfoSlide(startOrder);
      slide.title = content.title || '';
      slide.content = content.html || '';

      const rawHtml = content.html || '';
      const titleLine = content.title ? `<p><strong>${content.title}</strong></p>` : '';

      // Always use HTML mode for infoboxes to preserve formatting and background
      const infoHtmlBlock: SlideBlock = {
        ...createSlideBlock('text'),
        content: wrapHtmlForBoard(titleLine + rawHtml),
        contentFormat: 'html',
        textAlign: 'left',
        verticalAlign: 'top',
        textOverflow: 'scroll',
        background: { type: 'color', color: colors.bg },
        textColor: colors.text,
      };

      slide.layout = {
        type: 'single',
        blocks: [infoHtmlBlock],
      };
      return [slide];
    }
    
    case 'examples': {
      const content = block.content as ExamplesContent;
      const slides: QuizSlide[] = [];
      
      // Each math example becomes its own Example activity slide
      content.examples.forEach((example, idx) => {
        const slide = createExampleSlide(startOrder + idx);
        slide.title = content.topic || `Příklad ${idx + 1}`;
        slide.problem = example.expression;
        slide.steps = []; // Student solves it themselves
        slide.finalAnswer = example.answer;
        slides.push(slide);
      });
      
      // If no examples but has sample, create one slide from it
      if (slides.length === 0 && content.sampleExample) {
        const slide = createExampleSlide(startOrder);
        slide.title = content.topic || 'Příklad';
        slide.problem = content.sampleExample;
        slide.steps = [];
        slide.finalAnswer = '';
        slides.push(slide);
      }
      
      return slides;
    }
    
    case 'image': {
      const content = block.content as ImageContent;
      const slide = createInfoSlide(startOrder);
      slide.title = '';
      slide.content = '';

      // Build gallery array: prefer content.gallery, fallback to single URL
      const galleryUrls = (content.gallery && content.gallery.length > 0)
        ? content.gallery
        : (content.url ? [content.url] : []);

      if (galleryUrls.length === 0) return [];

      const isMulti = galleryUrls.length > 1;

      slide.layout = {
        type: 'single',
        blocks: [{
          id: generateBlockId(),
          type: 'image',
          content: galleryUrls[0],
          // Multi-image → pass as gallery array with worksheet styling
          ...(isMulti ? {
            gallery: galleryUrls,
            galleryDisplayMode: 'grid' as const, // explicit grid — shows columns setting in board UI
            galleryCaptions: content.galleryCaptions,
            galleryItemShape: content.galleryItemShape,
            galleryBorderRadius: content.galleryBorderRadius,
            galleryStrokeColor: content.galleryStrokeColor,
            galleryStrokeWidth: content.galleryStrokeWidth,
            galleryRotate: content.galleryRotate,
            galleryRotateMax: content.galleryRotateMax,
            galleryLabelType: content.galleryLabelType,
            galleryLabelColor: content.galleryLabelColor,
            galleryGridColumns: content.gridColumns ?? 2,
            galleryContainerHeight: content.containerHeight,
          } : {
            // Single image — preserve shape/stroke styling too
            galleryItemShape: content.galleryItemShape,
            galleryBorderRadius: content.galleryBorderRadius ?? 8,
            galleryStrokeColor: content.galleryStrokeColor,
            galleryStrokeWidth: content.galleryStrokeWidth,
          }),
          imageFit: 'cover',
          imageCaption: content.caption,
        }],
      };

      return [slide];
    }

    case 'table': {
      const content = block.content as TableContent;
      const tableHtml = content.html || '';
      if (!tableHtml) return [];
      const slide = createInfoSlide(startOrder);
      const layout = createSlideLayout('single');
      layout.blocks[0] = {
        ...createSlideBlock('table'),
        tableData: {
          html: tableHtml,
          hasBorder: content.hasBorder ?? true,
          hasRoundedCorners: content.hasRoundedCorners ?? true,
          colorStyle: content.colorStyle || 'default',
        },
      };
      slide.layout = layout;
      return [slide];
    }

    case 'connect-pairs': {
      const content = block.content as import('../types/worksheet').ConnectPairsContent;
      const slide: ConnectPairsActivitySlide = {
        id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'activity',
        activityType: 'connect-pairs',
        order: startOrder,
        instruction: content.instruction || 'Spoj správné dvojice',
        pairs: content.pairs.map(p => ({
          id: p.id,
          left: { id: p.left.id, type: p.left.type, content: p.left.content },
          right: { id: p.right.id, type: p.right.type, content: p.right.content },
        })),
        countAsMultiple: true,
        shuffleSides: content.shuffleSides ?? true,
      };
      return [slide];
    }

    case 'image-hotspots': {
      const content = block.content as import('../types/worksheet').ImageHotspotsContent;
      const slide: ImageHotspotsActivitySlide = {
        id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'activity',
        activityType: 'image-hotspots',
        order: startOrder,
        instruction: content.instruction || 'Označ správná místa na obrázku',
        imageUrl: content.imageUrl,
        hotspots: content.hotspots.map(h => ({
          id: h.id,
          x: h.x,
          y: h.y,
          label: h.label,
          markerStyle: 'circle' as const,
        })),
        countAsMultiple: true,
        randomizeOrder: false,
        showAllHotspots: true,
        markerStyle: 'circle' as const,
        markerSize: (content.markerSize ?? 100) / 100,
        answerType: content.answerType ?? 'text',
      };
      return [slide];
    }

    case 'video-quiz': {
      const content = block.content as import('../types/worksheet').VideoQuizContent;
      const slide: VideoQuizActivitySlide = {
        id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'activity',
        activityType: 'video-quiz',
        order: startOrder,
        instruction: content.instruction || 'Sleduj video a odpovídej na otázky',
        videoUrl: content.videoUrl,
        videoId: content.videoId,
        questions: content.questions.map(q => ({
          id: q.id,
          timestamp: q.timestamp,
          question: q.question,
          options: q.options.map(o => ({
            id: o.id,
            label: o.label,
            content: o.content,
            isCorrect: o.isCorrect,
          })),
        })),
        countAsMultiple: true,
        mustAnswerToProgress: false,
      };
      return [slide];
    }

    case 'qr-code': {
      const content = block.content as import('../types/worksheet').QRCodeContent;
      if (!content.url) return [];
      const slide = createInfoSlide(startOrder);
      const layout = createSlideLayout('single');
      layout.blocks[0] = {
        ...createSlideBlock('link'),
        linkMode: 'qr',
        content: content.url,
        linkText: content.caption || '',
      };
      slide.layout = layout;
      return [slide];
    }

    case 'chart': {
      const content = block.content as import('../types/worksheet').ChartContent;
      const slide = createInfoSlide(startOrder);
      const layout = createSlideLayout('single');
      layout.blocks[0] = {
        ...createSlideBlock('chart'),
        chartType: content.chartType,
        chartTitle: content.chartTitle,
        chartColumns: content.chartColumns,
        chartRows: content.chartRows,
        content: '',
      };
      slide.layout = layout;
      return [slide];
    }

    case 'header-footer':
    case 'free-canvas':
    case 'spacer':
      return [];
    
    default:
      return [];
  }
}

// ============================================
// BOARD → WORKSHEET CONVERSION
// ============================================

/**
 * Convert a Quiz/Board to a Worksheet
 */
export function boardToWorksheet(quiz: Quiz): Worksheet {
  const now = new Date().toISOString();
  
  const worksheet: Worksheet = {
    id: `worksheet-${Date.now()}`,
    title: `${quiz.title} (Pracovní list)`,
    description: quiz.description,
    blocks: [],
    metadata: {
      subject: (quiz.subject as any) || 'other',
      grade: (quiz.grade as any) || 6,
      columns: 1,
    },
    createdAt: now,
    updatedAt: now,
    status: 'draft',
  };
  
  // Add title as heading
  const titleBlock: WorksheetBlock = {
    id: generateBlockId(),
    type: 'heading',
    order: 0,
    width: 'full',
    content: {
      text: quiz.title,
      level: 'h1' as const,
    },
  };
  worksheet.blocks.push(titleBlock);
  
  // Convert slides to blocks
  let order = 1;
  for (const slide of quiz.slides) {
    const converted = slideToBlocks(slide, order);
    for (const block of converted) {
      worksheet.blocks.push(block);
      order++;
    }
  }
  
  return worksheet;
}

/**
 * Convert a single quiz slide to worksheet blocks
 */
function slideToBlocks(slide: QuizSlide, startOrder: number): WorksheetBlock[] {
  const blocks: WorksheetBlock[] = [];
  let order = startOrder;
  
  switch (slide.type) {
    case 'activity': {
      const activitySlide = slide as ABCActivitySlide | OpenActivitySlide | ExampleActivitySlide;
      
      if ('activityType' in activitySlide) {
        switch (activitySlide.activityType) {
          case 'abc': {
            const abcSlide = activitySlide as ABCActivitySlide;
            const block: WorksheetBlock = {
              id: generateBlockId(),
              type: 'multiple-choice',
              order: order++,
              width: 'full',
              content: {
                question: abcSlide.question || '',
                options: abcSlide.options.map(opt => ({
                  id: opt.id,
                  text: opt.content,
                })),
                correctAnswers: abcSlide.options
                  .filter(opt => opt.isCorrect)
                  .map(opt => opt.id),
                allowMultiple: abcSlide.options.filter(opt => opt.isCorrect).length > 1,
                explanation: abcSlide.explanation,
              },
            };
            blocks.push(block);
            break;
          }
          
          case 'open': {
            const openSlide = activitySlide as OpenActivitySlide;
            const block: WorksheetBlock = {
              id: generateBlockId(),
              type: 'free-answer',
              order: order++,
              width: 'full',
              content: {
                question: openSlide.question || '',
                lines: 3,
                hint: openSlide.explanation,
                sampleAnswer: openSlide.correctAnswers?.[0],
              },
            };
            blocks.push(block);
            break;
          }
          
          case 'example': {
            const exampleSlide = activitySlide as ExampleActivitySlide;
            
            // Add title as heading
            if (exampleSlide.title) {
              blocks.push({
                id: generateBlockId(),
                type: 'heading',
                order: order++,
                width: 'full',
                content: {
                  text: exampleSlide.title,
                  level: 'h2' as const,
                },
              });
            }
            
            // Add problem as paragraph
            if (exampleSlide.problem) {
              blocks.push({
                id: generateBlockId(),
                type: 'paragraph',
                order: order++,
                width: 'full',
                content: {
                  html: `<p><strong>Zadání:</strong> ${exampleSlide.problem}</p>`,
                },
              });
            }
            
            // Add steps as infobox
            if (exampleSlide.steps.length > 0) {
              const stepsHtml = exampleSlide.steps
                .map((step, idx) => `<p>${idx + 1}. ${step.content}</p>`)
                .join('');
              
              blocks.push({
                id: generateBlockId(),
                type: 'infobox',
                order: order++,
                width: 'full',
                content: {
                  title: 'Postup řešení',
                  html: stepsHtml,
                  variant: 'blue',
                },
              });
            }
            
            // Add final answer
            if (exampleSlide.finalAnswer) {
              blocks.push({
                id: generateBlockId(),
                type: 'paragraph',
                order: order++,
                width: 'full',
                content: {
                  html: `<p><strong>Výsledek:</strong> ${exampleSlide.finalAnswer}</p>`,
                },
              });
            }
            break;
          }
          
          case 'fill-blanks': {
            const fillSlide = activitySlide as FillBlanksActivitySlide;
            
            // Convert each sentence to a fill-blank block
            for (const sentence of fillSlide.sentences) {
              // Build segments from text and blanks
              const segments: any[] = [];
              let remainingText = sentence.text;
              
              // Sort blanks by their position in text (assuming they're marked as [blank_id])
              const sortedBlanks = [...sentence.blanks].sort((a, b) => {
                const posA = remainingText.indexOf(`[${a.id}]`);
                const posB = remainingText.indexOf(`[${b.id}]`);
                return posA - posB;
              });
              
              for (const blank of sortedBlanks) {
                const blankMarker = `[${blank.id}]`;
                const markerPos = remainingText.indexOf(blankMarker);
                
                if (markerPos > 0) {
                  // Add text before blank
                  segments.push({
                    type: 'text',
                    content: remainingText.substring(0, markerPos),
                  });
                }
                
                // Add blank - BlankItem uses 'text' for the correct answer
                segments.push({
                  type: 'blank',
                  id: blank.id,
                  correctAnswer: blank.text,
                  acceptedAnswers: [],
                });
                
                remainingText = remainingText.substring(markerPos + blankMarker.length);
              }
              
              // Add remaining text
              if (remainingText) {
                segments.push({
                  type: 'text',
                  content: remainingText,
                });
              }
              
              blocks.push({
                id: generateBlockId(),
                type: 'fill-blank',
                order: order++,
                width: 'full',
                content: {
                  instruction: fillSlide.instruction || 'Doplň chybějící slova',
                  segments: segments.length > 0 ? segments : [{ type: 'text', content: sentence.text }],
                },
              });
            }
            break;
          }
          
          case 'connect-pairs': {
            const pairsSlide = activitySlide as ConnectPairsActivitySlide;
            
            // Create native connect-pairs block
            blocks.push({
              id: generateBlockId(),
              type: 'connect-pairs',
              order: order++,
              width: 'full',
              content: {
                instruction: pairsSlide.instruction || 'Spoj správné dvojice',
                pairs: pairsSlide.pairs.map(pair => ({
                  id: pair.id,
                  left: {
                    id: pair.left.id,
                    type: pair.left.type,
                    content: pair.left.content,
                  },
                  right: {
                    id: pair.right.id,
                    type: pair.right.type,
                    content: pair.right.content,
                  },
                })),
                shuffleSides: pairsSlide.shuffleSides,
              },
            });
            break;
          }
          
          case 'image-hotspots': {
            const hotspotsSlide = activitySlide as ImageHotspotsActivitySlide;
            
            // Create native image-hotspots block
            blocks.push({
              id: generateBlockId(),
              type: 'image-hotspots',
              order: order++,
              width: 'full',
              content: {
                instruction: hotspotsSlide.instruction || 'Označ správná místa na obrázku',
                imageUrl: hotspotsSlide.imageUrl || '',
                hotspots: hotspotsSlide.hotspots.map(hotspot => ({
                  id: hotspot.id,
                  x: hotspot.x,
                  y: hotspot.y,
                  label: hotspot.label,
                  options: (hotspot as any).options || undefined,
                })),
                markerStyle: hotspotsSlide.markerStyle === 'pin' ? 'pin' 
                  : hotspotsSlide.markerStyle === 'question-mark' ? 'question-mark' 
                  : 'circle',
                markerSize: Math.round((hotspotsSlide.markerSize || 1) * 100),
                answerType: hotspotsSlide.answerType || 'text',
              },
            });
            break;
          }
          
          case 'video-quiz': {
            const videoSlide = activitySlide as VideoQuizActivitySlide;
            
            // Create native video-quiz block
            blocks.push({
              id: generateBlockId(),
              type: 'video-quiz',
              order: order++,
              width: 'full',
              content: {
                instruction: videoSlide.instruction || 'Video kvíz',
                videoUrl: videoSlide.videoUrl || '',
                videoId: videoSlide.videoId,
                questions: videoSlide.questions.map(q => ({
                  id: q.id,
                  timestamp: q.timestamp,
                  question: q.question,
                  options: q.options.map(opt => ({
                    id: opt.id,
                    label: opt.label,
                    content: opt.content,
                    isCorrect: opt.isCorrect,
                  })),
                })),
              },
            });
            break;
          }
          
          case 'voting': {
            const votingSlide = activitySlide as VotingActivitySlide;
            
            // Convert voting to paragraph with options
            blocks.push({
              id: generateBlockId(),
              type: 'heading',
              order: order++,
              width: 'full',
              content: {
                text: votingSlide.question || 'Hlasování',
                level: 'h3' as const,
              },
            });
            
            if (votingSlide.options && votingSlide.options.length > 0) {
              const optionsHtml = votingSlide.options
                .map((opt, idx) => `<p>${String.fromCharCode(65 + idx)}) ${opt.content || opt.label || ''}</p>`)
                .join('');
              
              blocks.push({
                id: generateBlockId(),
                type: 'paragraph',
                order: order++,
                width: 'full',
                content: {
                  html: optionsHtml,
                },
              });
            }
            break;
          }
          
          case 'board': {
            const boardSlide = activitySlide as BoardActivitySlide;
            
            // Convert board to instruction paragraph
            blocks.push({
              id: generateBlockId(),
              type: 'infobox',
              order: order++,
              width: 'full',
              content: {
                title: 'Nástěnka',
                html: `<p>${boardSlide.question || 'Sdílejte své odpovědi s třídou.'}</p>`,
                variant: 'yellow',
              },
            });
            break;
          }
        }
      }
      break;
    }
    
    case 'info': {
      const infoSlide = slide as InfoSlide;
      
      // First check if there's a layout with blocks (new format)
      if (infoSlide.layout && infoSlide.layout.blocks && infoSlide.layout.blocks.length > 0) {
        for (const block of infoSlide.layout.blocks) {
          // Text blocks become paragraphs or headings based on font size
          if (block.type === 'text' && block.content) {
            if (block.fontSize === 'xlarge' || block.fontWeight === 'bold') {
              blocks.push({
                id: generateBlockId(),
                type: 'heading',
                order: order++,
                width: 'full',
                content: {
                  text: block.content,
                  level: 'h2' as const,
                },
              });
            } else {
              blocks.push({
                id: generateBlockId(),
                type: 'paragraph',
                order: order++,
                width: 'full',
                content: {
                  html: `<p>${block.content}</p>`,
                },
              });
            }
          }
          // Image blocks
          else if (block.type === 'image' && block.content) {
            blocks.push({
              id: generateBlockId(),
              type: 'image',
              order: order++,
              width: 'full',
              content: {
                url: block.content,
                alt: block.imageCaption || '',
                caption: block.imageCaption || '',
                size: 'medium',
                alignment: 'center',
              },
            });
          }
        }
      } else {
        // Legacy format - use title and content fields
        // Add title as heading if present
        if (infoSlide.title) {
          blocks.push({
            id: generateBlockId(),
            type: 'heading',
            order: order++,
            width: 'full',
            content: {
              text: infoSlide.title,
              level: 'h2' as const,
            },
          });
        }
        
        // Add content as paragraph
        if (infoSlide.content) {
          blocks.push({
            id: generateBlockId(),
            type: 'paragraph',
            order: order++,
            width: 'full',
            content: {
              html: infoSlide.content,
            },
          });
        }
      }
      
      // Add media if present
      if (infoSlide.media && infoSlide.media.url) {
        blocks.push({
          id: generateBlockId(),
          type: 'image',
          order: order++,
          width: 'full',
          content: {
            url: infoSlide.media.url,
            alt: infoSlide.media.caption || '',
            caption: infoSlide.media.caption || '',
            size: 'medium',
            alignment: 'center',
          },
        });
      }
      break;
    }
    
    default:
      // Skip unsupported types
      break;
  }
  
  return blocks;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Count convertible blocks in a worksheet
 */
export function countConvertibleBlocks(worksheet: Worksheet): number {
  let count = 0;
  for (const block of worksheet.blocks) {
    if (block.type === 'examples') {
      const content = block.content as ExamplesContent;
      count += content.examples?.length || 1;
    } else if (['multiple-choice', 'free-answer', 'fill-blank', 'heading', 'paragraph', 'infobox'].includes(block.type)) {
      count++;
    }
  }
  return count;
}

/**
 * Count convertible slides in a quiz
 */
export function countConvertibleSlides(quiz: Quiz): number {
  return quiz.slides.length;
}

/**
 * Preview conversion summary
 */
export function getConversionSummary(source: Worksheet | Quiz, direction: 'toBoard' | 'toWorksheet'): {
  totalItems: number;
  convertibleItems: number;
  questions: number;
  infoItems: number;
} {
  if (direction === 'toBoard') {
    const worksheet = source as Worksheet;
    let questions = 0;
    let info = 0;
    
    for (const block of worksheet.blocks) {
      if (['multiple-choice', 'free-answer', 'fill-blank'].includes(block.type)) {
        questions++;
      } else if (block.type === 'examples') {
        // Each example becomes a separate activity
        const content = block.content as ExamplesContent;
        questions += content.examples?.length || 1;
      } else if (['heading', 'paragraph', 'infobox'].includes(block.type)) {
        info++;
      }
    }
    
    return {
      totalItems: worksheet.blocks.length,
      convertibleItems: questions + info,
      questions,
      infoItems: info,
    };
  } else {
    const quiz = source as Quiz;
    let questions = 0;
    let info = 0;
    
    for (const slide of quiz.slides) {
      if (slide.type === 'activity') {
        questions++;
      } else if (slide.type === 'info') {
        info++;
      }
    }
    
    return {
      totalItems: quiz.slides.length,
      convertibleItems: questions + info,
      questions,
      infoItems: info,
    };
  }
}

