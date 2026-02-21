/**
 * Vividbooks Sync – Figma Plugin Sandbox (code.ts)
 *
 * Runs inside Figma's sandboxed JS environment.
 * Has access to Figma API but NO network access.
 * All data arrives via postMessage from the UI iframe.
 */

// ── Types shared with ui.ts ──────────────────────────────────────────────────

interface VividBlock {
  id: string;
  type: string;
  order?: number;
  width?: number;
  content: Record<string, any>;
}

interface VividWorksheet {
  id: string;
  name: string;
  blocks: VividBlock[];
}

interface SyncMessage {
  type: 'SYNC';
  worksheets: VividWorksheet[];
  // key = image URL, value = Uint8Array bytes (transferred as number[])
  imageCache: Record<string, number[]>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_WIDTH = 800;
const BLOCK_GAP = 0;            // gap between blocks inside a section
const SECTION_GAP = 80;         // horizontal gap between sections
const SECTION_PADDING = 32;     // padding inside section around frames
const FONT_BODY: FontName = { family: 'Inter', style: 'Regular' };
const FONT_BOLD: FontName = { family: 'Inter', style: 'Bold' };
const FONT_SEMI: FontName = { family: 'Inter', style: 'SemiBold' };

// ── Entry point ──────────────────────────────────────────────────────────────

figma.showUI(__html__, { width: 380, height: 580, title: 'Vividbooks Sync' });

figma.ui.onmessage = async (msg: SyncMessage | { type: string }) => {
  if (msg.type === 'CANCEL') {
    figma.closePlugin();
    return;
  }
  if (msg.type !== 'SYNC') return;

  const syncMsg = msg as SyncMessage;

  // Pre-load fonts
  await Promise.all([
    figma.loadFontAsync(FONT_BODY),
    figma.loadFontAsync(FONT_BOLD),
    figma.loadFontAsync(FONT_SEMI),
  ]);

  // Convert imageCache number[] back to Uint8Array
  const imageCache: Record<string, Uint8Array> = {};
  for (const [url, bytes] of Object.entries(syncMsg.imageCache)) {
    imageCache[url] = new Uint8Array(bytes);
  }

  const page = figma.currentPage;
  let sectionX = 0;

  for (const ws of syncMsg.worksheets) {
    const section = await buildWorksheetSection(ws, imageCache, sectionX);
    page.appendChild(section);
    sectionX += section.width + SECTION_GAP;
  }

  figma.viewport.scrollAndZoomIntoView(page.children);
  figma.ui.postMessage({ type: 'DONE', count: syncMsg.worksheets.length });
};

// ── Section builder ──────────────────────────────────────────────────────────

async function buildWorksheetSection(
  ws: VividWorksheet,
  imageCache: Record<string, Uint8Array>,
  xPos: number,
): Promise<SectionNode> {
  const section = figma.createSection();
  section.name = ws.name;
  section.x = xPos;
  section.y = 0;

  const sorted = [...ws.blocks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  let yOffset = SECTION_PADDING;

  for (const block of sorted) {
    const frame = await buildBlock(block, imageCache);
    frame.x = SECTION_PADDING;
    frame.y = yOffset;
    section.appendChild(frame);
    yOffset += frame.height + BLOCK_GAP;
  }

  section.resizeWithoutConstraints(
    PAGE_WIDTH + SECTION_PADDING * 2,
    yOffset + SECTION_PADDING,
  );

  return section;
}

// ── Block dispatcher ─────────────────────────────────────────────────────────

async function buildBlock(
  block: VividBlock,
  imageCache: Record<string, Uint8Array>,
): Promise<FrameNode> {
  switch (block.type) {
    case 'heading':      return buildHeading(block);
    case 'paragraph':    return buildParagraph(block, imageCache);
    case 'image':        return buildImage(block, imageCache);
    case 'free-answer':  return buildFreeAnswer(block);
    case 'multiple-choice': return buildMultipleChoice(block);
    case 'table':        return buildTable(block);
    case 'spacer':       return buildSpacer(block);
    case 'infobox':      return buildInfobox(block);
    default:             return buildFallback(block);
  }
}

// ── Heading ──────────────────────────────────────────────────────────────────

async function buildHeading(block: VividBlock): Promise<FrameNode> {
  const c = block.content;
  const frame = makeFrame(`[heading] ${block.id}`, PAGE_WIDTH, 64);
  frame.fills = [solidFill('#f8fafc')];

  const text = makeText(
    c.text || 'Nadpis',
    { family: 'Inter', style: c.fontWeight === 'bold' ? 'Bold' : 'SemiBold' },
    clamp(c.fontSize ? c.fontSize * 1.33 : 28, 18, 48),
    '#1e293b',
  );
  text.x = 0;
  text.y = 16;
  text.resize(PAGE_WIDTH, text.height);
  frame.appendChild(text);
  frame.resize(PAGE_WIDTH, text.height + 32);
  return frame;
}

// ── Paragraph ────────────────────────────────────────────────────────────────

async function buildParagraph(
  block: VividBlock,
  imageCache: Record<string, Uint8Array>,
): Promise<FrameNode> {
  const c = block.content;
  const frame = makeFrame(`[paragraph] ${block.id}`, PAGE_WIDTH, 80);
  frame.fills = [{ type: 'SOLID', color: hexToRgb('#ffffff'), opacity: 0 }];

  let x = 0;
  if (c.imageUrl && imageCache[c.imageUrl]) {
    const imgNode = makeImageRect(imageCache[c.imageUrl], 160, 120);
    imgNode.x = c.imagePosition === 'right' ? PAGE_WIDTH - 160 : 0;
    imgNode.y = 0;
    frame.appendChild(imgNode);
    x = c.imagePosition === 'left' || !c.imagePosition ? 176 : 0;
  }

  const text = makeText(
    stripHtml(c.text || ''),
    FONT_BODY,
    c.fontSize ? c.fontSize * 1.33 : 14,
    '#334155',
  );
  text.x = x;
  text.y = 0;
  text.resize(PAGE_WIDTH - x, text.height);
  text.textAutoResize = 'HEIGHT';
  frame.appendChild(text);
  frame.resize(PAGE_WIDTH, Math.max(text.height, 120) + 8);
  return frame;
}

// ── Image / Gallery ──────────────────────────────────────────────────────────

async function buildImage(
  block: VividBlock,
  imageCache: Record<string, Uint8Array>,
): Promise<FrameNode> {
  const c = block.content;
  const gallery: string[] = c.gallery?.length ? c.gallery : (c.url ? [c.url] : []);
  const cols = Math.min(c.gridColumns || 1, gallery.length || 1);
  const cellW = Math.floor((PAGE_WIDTH - (cols - 1) * 12) / cols);
  const cellH = c.height || 200;
  const rows = Math.ceil(gallery.length / cols);
  const totalH = rows * cellH + (rows - 1) * 12;

  const frame = makeFrame(`[image] ${block.id}`, PAGE_WIDTH, totalH || 200);
  frame.fills = [{ type: 'SOLID', color: hexToRgb('#ffffff'), opacity: 0 }];

  gallery.forEach((url, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const bytes = imageCache[url];
    const cell = bytes
      ? makeImageRect(bytes, cellW, cellH)
      : makePlaceholderRect(cellW, cellH, `Obrázek ${i + 1}`);
    cell.x = col * (cellW + 12);
    cell.y = row * (cellH + 12);
    frame.appendChild(cell);
  });

  if (gallery.length === 0) {
    const ph = makePlaceholderRect(PAGE_WIDTH, 200, 'Obrázek');
    frame.appendChild(ph);
  }

  return frame;
}

// ── Free Answer ──────────────────────────────────────────────────────────────

async function buildFreeAnswer(block: VividBlock): Promise<FrameNode> {
  const c = block.content;
  const frame = makeFrame(`[free-answer] ${block.id}`, PAGE_WIDTH, 120);
  frame.fills = [{ type: 'SOLID', color: hexToRgb('#ffffff'), opacity: 0 }];

  let y = 0;

  if (c.question) {
    const q = makeText(stripHtml(c.question), FONT_SEMI, 14, '#1e293b');
    q.x = 0; q.y = y;
    q.resize(PAGE_WIDTH, q.height);
    q.textAutoResize = 'HEIGHT';
    frame.appendChild(q);
    y += q.height + 8;
  }

  // Sub-questions
  if (c.subQuestions?.length) {
    const cols = c.subColumns || 2;
    const cellW = Math.floor((PAGE_WIDTH - (cols - 1) * 12) / cols);
    let maxRowH = 0;
    let col = 0;
    let rowY = y;

    for (const sq of c.subQuestions) {
      const sqFrame = makeFrame(`sq-${sq.id}`, cellW, 80);
      sqFrame.fills = [solidFill('#dbeafe')];
      sqFrame.cornerRadius = 10;
      sqFrame.x = col * (cellW + 12);
      sqFrame.y = rowY;

      const sqText = makeText(sq.text || '...', FONT_BODY, 12, '#1e293b');
      sqText.x = 10; sqText.y = 10;
      sqText.resize(cellW - 20, sqText.height);
      sqText.textAutoResize = 'HEIGHT';
      sqFrame.appendChild(sqText);

      // Answer lines
      const lineY = sqText.height + 20;
      const lines = sq.lines || 2;
      for (let l = 0; l < lines; l++) {
        const line = figma.createLine();
        line.x = 10; line.y = lineY + l * 24;
        line.resize(cellW - 20, 0);
        line.strokes = [{ type: 'SOLID', color: hexToRgb('#cbd5e1') }];
        line.strokeWeight = 1;
        sqFrame.appendChild(line);
      }

      sqFrame.resize(cellW, lineY + lines * 24 + 10);
      maxRowH = Math.max(maxRowH, sqFrame.height);
      frame.appendChild(sqFrame);

      col++;
      if (col >= cols) {
        col = 0;
        rowY += maxRowH + 12;
        maxRowH = 0;
      }
    }
    y = rowY + maxRowH + 8;
  } else {
    // Simple answer lines
    const lines = c.lines || 3;
    for (let l = 0; l < lines; l++) {
      const line = figma.createLine();
      line.x = 0; line.y = y + l * 32;
      line.resize(PAGE_WIDTH, 0);
      line.strokes = [{ type: 'SOLID', color: hexToRgb('#cbd5e1') }];
      line.strokeWeight = 1;
      line.dashPattern = [4, 4];
      frame.appendChild(line);
    }
    y += lines * 32 + 8;
  }

  frame.resize(PAGE_WIDTH, Math.max(y, 80));
  return frame;
}

// ── Multiple Choice ───────────────────────────────────────────────────────────

async function buildMultipleChoice(block: VividBlock): Promise<FrameNode> {
  const c = block.content;
  const frame = makeFrame(`[multiple-choice] ${block.id}`, PAGE_WIDTH, 100);
  frame.fills = [{ type: 'SOLID', color: hexToRgb('#ffffff'), opacity: 0 }];

  let y = 0;

  if (c.question) {
    const q = makeText(stripHtml(c.question), FONT_SEMI, 14, '#1e293b');
    q.x = 0; q.y = y;
    q.resize(PAGE_WIDTH, q.height);
    q.textAutoResize = 'HEIGHT';
    frame.appendChild(q);
    y += q.height + 10;
  }

  const opts: any[] = c.options || [];
  for (const opt of opts) {
    const optFrame = makeFrame(`opt-${opt.id}`, PAGE_WIDTH, 36);
    optFrame.fills = [solidFill('#f1f5f9')];
    optFrame.cornerRadius = 8;
    optFrame.x = 0;
    optFrame.y = y;

    const circle = figma.createEllipse();
    circle.x = 10; circle.y = 8;
    circle.resize(20, 20);
    circle.fills = [{ type: 'SOLID', color: hexToRgb('#ffffff'), opacity: 0 }];
    circle.strokes = [{ type: 'SOLID', color: hexToRgb('#94a3b8') }];
    circle.strokeWeight = 2;
    optFrame.appendChild(circle);

    const optText = makeText(opt.text || '', FONT_BODY, 13, '#334155');
    optText.x = 38; optText.y = 8;
    optText.resize(PAGE_WIDTH - 48, optText.height);
    optText.textAutoResize = 'HEIGHT';
    optFrame.appendChild(optText);

    optFrame.resize(PAGE_WIDTH, Math.max(optText.height + 16, 36));
    frame.appendChild(optFrame);
    y += optFrame.height + 6;
  }

  frame.resize(PAGE_WIDTH, Math.max(y, 80));
  return frame;
}

// ── Table ─────────────────────────────────────────────────────────────────────

async function buildTable(block: VividBlock): Promise<FrameNode> {
  const c = block.content;
  const rows: string[][] = c.rows || [['', ''], ['', '']];
  const cols = rows[0]?.length || 2;
  const cellW = Math.floor(PAGE_WIDTH / cols);
  const cellH = 40;

  const frame = makeFrame(`[table] ${block.id}`, PAGE_WIDTH, rows.length * cellH);
  frame.fills = [{ type: 'SOLID', color: hexToRgb('#ffffff'), opacity: 0 }];

  rows.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      const cellFrame = makeFrame(`cell-${ri}-${ci}`, cellW, cellH);
      cellFrame.fills = [solidFill(ri === 0 ? '#e2e8f0' : '#ffffff')];
      cellFrame.strokes = [{ type: 'SOLID', color: hexToRgb('#cbd5e1') }];
      cellFrame.strokeWeight = 1;
      cellFrame.x = ci * cellW;
      cellFrame.y = ri * cellH;

      const t = makeText(cell, ri === 0 ? FONT_SEMI : FONT_BODY, 12, '#1e293b');
      t.x = 8; t.y = 10;
      t.resize(cellW - 16, t.height);
      cellFrame.appendChild(t);
      frame.appendChild(cellFrame);
    });
  });

  return frame;
}

// ── Spacer ────────────────────────────────────────────────────────────────────

async function buildSpacer(block: VividBlock): Promise<FrameNode> {
  const h = block.content?.height || 40;
  const frame = makeFrame(`[spacer] ${block.id}`, PAGE_WIDTH, h);
  frame.fills = [{ type: 'SOLID', color: hexToRgb('#ffffff'), opacity: 0 }];
  return frame;
}

// ── Infobox ───────────────────────────────────────────────────────────────────

async function buildInfobox(block: VividBlock): Promise<FrameNode> {
  const c = block.content;
  const frame = makeFrame(`[infobox] ${block.id}`, PAGE_WIDTH, 80);
  frame.fills = [solidFill('#eff6ff')];
  frame.cornerRadius = 12;
  frame.strokeWeight = 1;
  frame.strokes = [{ type: 'SOLID', color: hexToRgb('#bfdbfe') }];

  const text = makeText(stripHtml(c.text || ''), FONT_BODY, 13, '#1e40af');
  text.x = 16; text.y = 16;
  text.resize(PAGE_WIDTH - 32, text.height);
  text.textAutoResize = 'HEIGHT';
  frame.appendChild(text);
  frame.resize(PAGE_WIDTH, text.height + 32);
  return frame;
}

// ── Fallback ──────────────────────────────────────────────────────────────────

async function buildFallback(block: VividBlock): Promise<FrameNode> {
  const frame = makeFrame(`[${block.type}] ${block.id}`, PAGE_WIDTH, 48);
  frame.fills = [solidFill('#fef3c7')];
  frame.cornerRadius = 8;

  const text = makeText(`Blok typu "${block.type}"`, FONT_BODY, 12, '#92400e');
  text.x = 12; text.y = 14;
  frame.appendChild(text);
  return frame;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFrame(name: string, w: number, h: number): FrameNode {
  const frame = figma.createFrame();
  frame.name = name;
  frame.resize(w, Math.max(h, 1));
  frame.clipsContent = false;
  frame.fills = [];
  return frame;
}

function makeText(
  content: string,
  font: FontName,
  size: number,
  color: string,
): TextNode {
  const text = figma.createText();
  text.fontName = font;
  text.fontSize = clamp(size, 10, 60);
  text.characters = content || ' ';
  text.fills = [solidFill(color)];
  text.textAutoResize = 'HEIGHT';
  return text;
}

function makeImageRect(bytes: Uint8Array, w: number, h: number): RectangleNode {
  const rect = figma.createRectangle();
  rect.resize(Math.max(w, 1), Math.max(h, 1));
  rect.cornerRadius = 8;
  try {
    const img = figma.createImage(bytes);
    rect.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: img.hash }];
  } catch {
    rect.fills = [solidFill('#e2e8f0')];
  }
  return rect;
}

function makePlaceholderRect(w: number, h: number, label: string): RectangleNode {
  const rect = figma.createRectangle();
  rect.resize(Math.max(w, 1), Math.max(h, 1));
  rect.cornerRadius = 8;
  rect.fills = [solidFill('#e2e8f0')];
  rect.name = label;
  return rect;
}

function solidFill(hex: string): SolidPaint {
  return { type: 'SOLID', color: hexToRgb(hex) };
}

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return { r, g, b };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}
