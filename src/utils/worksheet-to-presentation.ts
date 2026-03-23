/**
 * worksheet-to-presentation.ts
 *
 * Smart conversion from a Worksheet to a Vividboard Quiz/Presentation.
 *
 * Philosophy:
 *  - Texts and images stay 1:1 (no AI rewriting)
 *  - The algorithm decides HOW to lay things out visually
 *  - Activity blocks (ABC, open, fill-blank, examples…) stay as quiz activities
 *  - Info blocks (heading, paragraph, infobox, image) become beautiful info slides
 *  - A consistent color theme is applied throughout
 */

import {
  Worksheet,
  WorksheetBlock,
  HeadingContent,
  ParagraphContent,
  InfoboxContent,
  ImageContent,
  MultipleChoiceContent,
  FreeAnswerContent,
  FillBlankContent,
  ExamplesContent,
} from '../types/worksheet';

import {
  Quiz,
  QuizSlide,
  InfoSlide,
  SlideBlock,
  SlideLayout,
  BackgroundSettings,
  createSlideBlock,
  createABCSlide,
  createOpenSlide,
  createExampleSlide,
  createEmptyQuiz,
} from '../types/quiz';

// ── Types ─────────────────────────────────────────────────────────────────────

/** A logical "slide group" — one or more worksheet blocks that go on one slide */
interface SlideGroup {
  blocks: WorksheetBlock[];
  /** Detected semantic role of this group */
  role: 'title' | 'content' | 'image-only' | 'activity';
}

/** A visual color theme for the presentation */
export interface PresentationTheme {
  id: string;
  name: string;
  /** Slide background */
  slideBg: BackgroundSettings;
  /** Title/heading block style */
  titleBlock: { bg: string; textColor: string };
  /** Main content block style */
  contentBlock: { bg: string; textColor: string };
  /** Secondary content block style (for multi-column) */
  altBlock: { bg: string; textColor: string };
  /** Image block background (shown behind image) */
  imageBg: string;
  /** Block border radius */
  blockRadius: number;
  /** Gap between blocks */
  blockGap: number;
}

// ── Color Themes ─────────────────────────────────────────────────────────────

export const PRESENTATION_THEMES: PresentationTheme[] = [
  {
    id: 'ocean',
    name: 'Ocean',
    slideBg: { type: 'color', color: '#0f172a' },
    titleBlock:   { bg: '#1e40af', textColor: '#ffffff' },
    contentBlock: { bg: '#1e293b', textColor: '#e2e8f0' },
    altBlock:     { bg: '#172554', textColor: '#bfdbfe' },
    imageBg: '#0f172a',
    blockRadius: 12,
    blockGap: 10,
  },
  {
    id: 'forest',
    name: 'Forest',
    slideBg: { type: 'color', color: '#052e16' },
    titleBlock:   { bg: '#166534', textColor: '#ffffff' },
    contentBlock: { bg: '#14532d', textColor: '#dcfce7' },
    altBlock:     { bg: '#15803d', textColor: '#f0fdf4' },
    imageBg: '#052e16',
    blockRadius: 12,
    blockGap: 10,
  },
  {
    id: 'warm',
    name: 'Warm',
    slideBg: { type: 'color', color: '#431407' },
    titleBlock:   { bg: '#c2410c', textColor: '#ffffff' },
    contentBlock: { bg: '#7c2d12', textColor: '#fed7aa' },
    altBlock:     { bg: '#9a3412', textColor: '#ffedd5' },
    imageBg: '#431407',
    blockRadius: 12,
    blockGap: 10,
  },
  {
    id: 'slate',
    name: 'Slate',
    slideBg: { type: 'color', color: '#0f172a' },
    titleBlock:   { bg: '#334155', textColor: '#ffffff' },
    contentBlock: { bg: '#1e293b', textColor: '#e2e8f0' },
    altBlock:     { bg: '#475569', textColor: '#f1f5f9' },
    imageBg: '#1e293b',
    blockRadius: 8,
    blockGap: 8,
  },
  {
    id: 'violet',
    name: 'Violet',
    slideBg: { type: 'color', color: '#1e1b4b' },
    titleBlock:   { bg: '#4c1d95', textColor: '#ffffff' },
    contentBlock: { bg: '#2e1065', textColor: '#ede9fe' },
    altBlock:     { bg: '#5b21b6', textColor: '#f5f3ff' },
    imageBg: '#1e1b4b',
    blockRadius: 12,
    blockGap: 10,
  },
  {
    id: 'light',
    name: 'Light',
    slideBg: { type: 'color', color: '#f8fafc' },
    titleBlock:   { bg: '#5C5CFF', textColor: '#ffffff' },
    contentBlock: { bg: '#ffffff', textColor: '#1e293b' },
    altBlock:     { bg: '#e2e8f0', textColor: '#334155' },
    imageBg: '#f1f5f9',
    blockRadius: 12,
    blockGap: 10,
  },
];

/** Pick a theme by id, or return the default (ocean) */
export function getTheme(id?: string): PresentationTheme {
  return PRESENTATION_THEMES.find(t => t.id === id) ?? PRESENTATION_THEMES[0];
}

// ── Activity block types ──────────────────────────────────────────────────────

const ACTIVITY_TYPES = new Set([
  'multiple-choice',
  'free-answer',
  'fill-blank',
  'examples',
  'connect-pairs',
  'image-hotspots',
  'video-quiz',
]);

const INFO_TYPES = new Set([
  'heading',
  'paragraph',
  'infobox',
  'image',
  'table',
  'spacer',
]);

// ── Main Entry Point ──────────────────────────────────────────────────────────

/**
 * Convert a Worksheet into a Vividboard Quiz / Presentation.
 * Texts and images are kept 1:1; only the visual layout and color theme are added.
 */
export function worksheetToPresentation(
  worksheet: Worksheet,
  themeId?: string,
): Quiz {
  const theme = getTheme(themeId);
  const quiz = createEmptyQuiz(`board-${Date.now()}`);
  quiz.title = worksheet.title || 'Prezentace';
  quiz.description = worksheet.description;
  quiz.subject = worksheet.metadata.subject as any;
  quiz.grade = worksheet.metadata.grade as any;
  quiz.createdAt = new Date().toISOString();
  quiz.updatedAt = new Date().toISOString();

  // 1. Build a title slide from the worksheet title
  const titleSlide = buildTitleSlide(worksheet, theme, 0);
  const slides: QuizSlide[] = [titleSlide];

  // 2. Group blocks
  const groups = groupBlocks(worksheet.blocks);

  // 3. Convert each group to one or more slides
  let order = 1;
  for (const group of groups) {
    const newSlides = groupToSlides(group, theme, order);
    for (const s of newSlides) {
      s.order = order++;
      slides.push(s);
    }
  }

  quiz.slides = slides;
  return quiz;
}

// ── Block Grouping ────────────────────────────────────────────────────────────

/**
 * Group consecutive worksheet blocks into logical slide groups.
 *
 * Rules:
 * 1. Activity blocks are always standalone (one group = one activity slide)
 * 2. A `heading` block starts a new info group
 * 3. `paragraph` / `infobox` blocks that follow a heading join that group
 * 4. An `image` block joins the current group if there is one; otherwise standalone
 * 5. Max 3 info blocks per group (to avoid overloaded slides)
 * 6. `spacer` blocks are dropped
 */
function groupBlocks(blocks: WorksheetBlock[]): SlideGroup[] {
  const groups: SlideGroup[] = [];
  let current: WorksheetBlock[] | null = null;

  const flushCurrent = () => {
    if (current && current.length > 0) {
      groups.push(classifyGroup(current));
      current = null;
    }
  };

  for (const block of blocks) {
    // Skip spacers and blocks with no meaningful content
    if (block.type === 'spacer') continue;
    if (!ACTIVITY_TYPES.has(block.type) && !blockHasContent(block)) continue;

    // Activity blocks are always standalone
    if (ACTIVITY_TYPES.has(block.type)) {
      flushCurrent();
      groups.push({ blocks: [block], role: 'activity' });
      continue;
    }

    // Heading: flush previous, start fresh
    if (block.type === 'heading') {
      flushCurrent();
      current = [block];
      continue;
    }

    // Image standalone (no current group)
    if (block.type === 'image' && !current) {
      groups.push({ blocks: [block], role: 'image-only' });
      continue;
    }

    // Join current group
    if (current) {
      current.push(block);
      // Flush when group is "full" (heading + 2 content blocks max)
      const headingCount = current.filter(b => b.type === 'heading').length;
      const nonHeading = current.length - headingCount;
      if (nonHeading >= 2) {
        flushCurrent();
      }
    } else {
      // No current group — start one
      current = [block];
    }
  }

  flushCurrent();
  return groups;
}

function classifyGroup(blocks: WorksheetBlock[]): SlideGroup {
  if (blocks.every(b => b.type === 'image')) return { blocks, role: 'image-only' };
  if (blocks.length === 0) return { blocks, role: 'content' };
  return { blocks, role: 'content' };
}

/** Returns true when a block has at least some non-whitespace text or a valid image URL */
function blockHasContent(block: WorksheetBlock): boolean {
  if (block.type === 'image') {
    const c = block.content as ImageContent;
    return !!(c.url || (c.gallery && c.gallery.length > 0));
  }
  const text = extractText(block);
  return text.trim().length > 2; // at least 3 real characters
}

// ── Title Slide ───────────────────────────────────────────────────────────────

function buildTitleSlide(
  worksheet: Worksheet,
  theme: PresentationTheme,
  order: number,
): InfoSlide {
  const slide = makeInfoSlide(order, theme);

  slide.layout = {
    type: 'single',
    blocks: [
      {
        ...createSlideBlock('text'),
        content: worksheet.title || 'Prezentace',
        fontSize: 'xxlarge',
        fontWeight: 'bold',
        textAlign: 'center',
        verticalAlign: 'middle',
        textColor: theme.titleBlock.textColor,
        background: { type: 'color', color: theme.titleBlock.bg },
        textPadding: 48,
      },
    ],
  };

  return slide;
}

// ── Group → Slides ────────────────────────────────────────────────────────────

function groupToSlides(
  group: SlideGroup,
  theme: PresentationTheme,
  startOrder: number,
): QuizSlide[] {
  if (group.role === 'activity') {
    return activityBlockToSlides(group.blocks[0], startOrder);
  }
  if (group.role === 'image-only') {
    return [buildImageOnlySlide(group.blocks[0], theme, startOrder)];
  }

  // Skip info-slide groups where every block is empty
  if (group.blocks.every(b => !blockHasContent(b))) return [];

  return [buildInfoSlide(group.blocks, theme, startOrder)];
}

// ── Info Slide Builder ────────────────────────────────────────────────────────

function buildInfoSlide(
  blocks: WorksheetBlock[],
  theme: PresentationTheme,
  order: number,
): InfoSlide {
  const slide = makeInfoSlide(order, theme);

  const heading = blocks.find(b => b.type === 'heading');
  const rest = blocks.filter(b => b.type !== 'heading');

  const imageBlocks = rest.filter(b => b.type === 'image');
  const textBlocks  = rest.filter(b => b.type !== 'image');

  const hasImage = imageBlocks.length > 0;
  const textCount = textBlocks.length;

  // ── heading only ──────────────────────────────────────────────────────────
  if (heading && textCount === 0 && !hasImage) {
    slide.layout = {
      type: 'single',
      blocks: [titleBlock(heading, theme)],
    };
    return slide;
  }

  // ── heading + image (no text) ─────────────────────────────────────────────
  if (heading && textCount === 0 && hasImage) {
    const imgUrl = extractFirstImageUrl(imageBlocks[0]);
    slide.layout = {
      type: 'title-content',
      titleHeight: 20,
      blocks: [
        titleBlock(heading, theme),
        imgUrl
          ? imageBlock(imgUrl, theme)
          : { ...createSlideBlock('text'), content: '', background: { type: 'color', color: theme.imageBg } },
      ],
    };
    return slide;
  }

  // ── heading + 1 text, no image ────────────────────────────────────────────
  if (heading && textCount === 1 && !hasImage) {
    slide.layout = {
      type: 'title-content',
      titleHeight: 22,
      blocks: [
        titleBlock(heading, theme),
        contentBlock(textBlocks[0], theme, 'content'),
      ],
    };
    return slide;
  }

  // ── heading + 1 text + image ──────────────────────────────────────────────
  if (heading && textCount === 1 && hasImage) {
    const imgUrl = extractFirstImageUrl(imageBlocks[0]);
    slide.layout = {
      type: 'right-large-left-split',
      columnRatios: [42, 58],
      splitRatio: 25,
      blocks: [
        titleBlock(heading, theme),         // left-top (split top)
        contentBlock(textBlocks[0], theme, 'content'), // left-bottom (split bottom)
        imgUrl
          ? imageBlock(imgUrl, theme)       // right large
          : { ...createSlideBlock('text'), content: '', background: { type: 'color', color: theme.imageBg } },
      ],
    };
    return slide;
  }

  // ── heading + 2 texts ─────────────────────────────────────────────────────
  if (heading && textCount === 2 && !hasImage) {
    slide.layout = {
      type: 'title-2cols',
      titleHeight: 22,
      columnRatios: [50, 50],
      blocks: [
        titleBlock(heading, theme),
        contentBlock(textBlocks[0], theme, 'content'),
        contentBlock(textBlocks[1], theme, 'alt'),
      ],
    };
    return slide;
  }

  // ── heading + 2 texts + image ─────────────────────────────────────────────
  if (heading && textCount === 2 && hasImage) {
    const imgUrl = extractFirstImageUrl(imageBlocks[0]);
    slide.layout = {
      type: 'title-3cols',
      titleHeight: 22,
      columnRatios: [35, 35, 30],
      blocks: [
        titleBlock(heading, theme),
        contentBlock(textBlocks[0], theme, 'content'),
        contentBlock(textBlocks[1], theme, 'alt'),
        imgUrl
          ? imageBlock(imgUrl, theme)
          : { ...createSlideBlock('text'), content: '', background: { type: 'color', color: theme.imageBg } },
      ],
    };
    return slide;
  }

  // ── no heading, 1 text block ──────────────────────────────────────────────
  if (!heading && textCount === 1 && !hasImage) {
    slide.layout = {
      type: 'single',
      blocks: [contentBlock(textBlocks[0], theme, 'content')],
    };
    return slide;
  }

  // ── no heading, 2 texts ───────────────────────────────────────────────────
  if (!heading && textCount === 2) {
    slide.layout = {
      type: '2cols',
      columnRatios: [50, 50],
      blocks: [
        contentBlock(textBlocks[0], theme, 'content'),
        contentBlock(textBlocks[1], theme, 'alt'),
      ],
    };
    return slide;
  }

  // ── image only (but ended up here) ───────────────────────────────────────
  if (hasImage && textCount === 0 && !heading) {
    return buildImageOnlySlide(imageBlocks[0], theme, order);
  }

  // ── fallback: title-content with concatenated text ────────────────────────
  const allText = blocks
    .map(b => extractText(b))
    .filter(Boolean)
    .join('\n\n');

  slide.layout = {
    type: 'single',
    blocks: [
      {
        ...createSlideBlock('text'),
        content: allText,
        fontSize: 'medium',
        textColor: theme.contentBlock.textColor,
        background: { type: 'color', color: theme.contentBlock.bg },
        textPadding: 32,
        verticalAlign: 'middle',
      },
    ],
  };

  return slide;
}

// ── Image-only Slide ──────────────────────────────────────────────────────────

function buildImageOnlySlide(
  block: WorksheetBlock,
  theme: PresentationTheme,
  order: number,
): InfoSlide {
  const slide = makeInfoSlide(order, theme);
  const imgContent = block.content as ImageContent;

  // Gallery with multiple images → 2cols or grid-2x2
  const gallery: string[] = imgContent.gallery?.length
    ? imgContent.gallery
    : imgContent.url ? [imgContent.url] : [];

  if (gallery.length >= 4) {
    slide.layout = {
      type: 'grid-2x2',
      blocks: gallery.slice(0, 4).map(url => imageBlock(url, theme)),
    };
  } else if (gallery.length >= 2) {
    slide.layout = {
      type: '2cols',
      columnRatios: [50, 50],
      blocks: gallery.slice(0, 2).map(url => imageBlock(url, theme)),
    };
  } else {
    const url = gallery[0] || '';
    const caption = imgContent.caption || imgContent.alt || '';
    slide.layout = {
      type: 'single',
      blocks: [
        {
          ...imageBlock(url, theme),
          imageCaption: caption || undefined,
        },
      ],
    };
  }

  return slide;
}

// ── Activity Blocks → Activity Slides ─────────────────────────────────────────

function activityBlockToSlides(block: WorksheetBlock, order: number): QuizSlide[] {
  switch (block.type) {
    case 'multiple-choice': {
      const c = block.content as MultipleChoiceContent;
      const slide = createABCSlide(order);
      slide.question = c.question || '';
      slide.options = c.options.map((opt, idx) => ({
        id: opt.id,
        label: String.fromCharCode(65 + idx),
        content: opt.text,
        isCorrect: c.correctAnswers.includes(opt.id),
      }));
      slide.explanation = c.explanation;
      return [slide];
    }

    case 'free-answer': {
      const c = block.content as FreeAnswerContent;

      // When the block has subQuestions, create one open slide per subquestion
      if (c.subQuestions && c.subQuestions.length > 0) {
        return c.subQuestions.map((sq, i) => {
          const s = createOpenSlide(order + i);
          // Show parent instruction as context above the actual question
          s.question = c.question ? `${c.question}\n\n${sq.text}` : sq.text;
          if (sq.sampleAnswer) s.correctAnswers = [sq.sampleAnswer];
          return s;
        });
      }

      const slide = createOpenSlide(order);
      slide.question = c.question || '';
      if (c.sampleAnswer) slide.correctAnswers = [c.sampleAnswer];
      slide.explanation = c.hint;
      return [slide];
    }

    case 'fill-blank': {
      const c = block.content as FillBlankContent;
      const slide = createOpenSlide(order);
      let q = c.instruction ? c.instruction + '\n\n' : '';
      const answers: string[] = [];
      for (const seg of c.segments) {
        if (seg.type === 'text') q += seg.content;
        else { q += '_____'; answers.push(seg.correctAnswer); }
      }
      slide.question = q;
      slide.correctAnswers = answers;
      return [slide];
    }

    case 'examples': {
      const c = block.content as ExamplesContent;
      return (c.examples || []).map((ex, i) => {
        const slide = createExampleSlide(order + i);
        slide.title = c.topic || `Příklad ${i + 1}`;
        slide.problem = ex.expression;
        slide.finalAnswer = ex.answer;
        return slide;
      });
    }

    default:
      return [];
  }
}

// ── SlideBlock factory helpers ────────────────────────────────────────────────

function titleBlock(block: WorksheetBlock, theme: PresentationTheme): SlideBlock {
  const text = extractText(block);
  return {
    ...createSlideBlock('text'),
    content: text,
    fontSize: 'xlarge',
    fontWeight: 'bold',
    textAlign: 'left',
    verticalAlign: 'middle',
    textColor: theme.titleBlock.textColor,
    background: { type: 'color', color: theme.titleBlock.bg },
    textPadding: 28,
  };
}

function contentBlock(
  block: WorksheetBlock,
  theme: PresentationTheme,
  variant: 'content' | 'alt',
): SlideBlock {
  const text = extractText(block);
  const style = variant === 'alt' ? theme.altBlock : theme.contentBlock;

  // Propagate TTS settings stored in infobox content (e.g. audioscript)
  const c = block.content as any;
  const ttsProps = c?.ttsText
    ? { ttsEnabled: true, ttsText: c.ttsText as string, ttsLang: (c.ttsLang as string) || 'cs-CZ' }
    : {};

  return {
    ...createSlideBlock('text'),
    content: text,
    fontSize: 'small',
    fontWeight: 'normal',
    textAlign: 'left',
    verticalAlign: 'top',
    textColor: style.textColor,
    background: { type: 'color', color: style.bg },
    textPadding: 24,
    lineHeight: 1.6,
    ...ttsProps,
  };
}

function imageBlock(url: string, theme: PresentationTheme): SlideBlock {
  return {
    ...createSlideBlock('image'),
    content: url,
    imageFit: 'cover',
    imagePositionX: 50,
    imagePositionY: 50,
    background: { type: 'color', color: theme.imageBg },
  };
}

// ── Base InfoSlide ────────────────────────────────────────────────────────────

function makeInfoSlide(order: number, theme: PresentationTheme): InfoSlide {
  return {
    id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'info',
    order,
    title: '',
    content: '',
    slideBackground: theme.slideBg,
    blockRadius: theme.blockRadius,
    blockGap: theme.blockGap,
    layout: { type: 'single', blocks: [] },
  };
}

// ── Text extraction ───────────────────────────────────────────────────────────

function extractText(block: WorksheetBlock): string {
  switch (block.type) {
    case 'heading': {
      const c = block.content as HeadingContent;
      return c.text || '';
    }
    case 'paragraph': {
      const c = block.content as ParagraphContent;
      return stripHtml(c.html || c.text || '');
    }
    case 'infobox': {
      const c = block.content as InfoboxContent;
      const title = c.title ? c.title + '\n' : '';
      return title + stripHtml(c.html || c.text || '');
    }
    default:
      return '';
  }
}

function extractFirstImageUrl(block: WorksheetBlock): string {
  const c = block.content as ImageContent;
  if (c.gallery?.length) return c.gallery[0];
  return c.url || '';
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    // Table cells: add tab between cells, newline after each row
    .replace(/<\/th>/gi, '\t')
    .replace(/<\/td>/gi, '\t')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Normalise runs of tabs/spaces into single space, but keep newlines
    .replace(/[ \t]+/g, ' ')
    .replace(/ \n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
