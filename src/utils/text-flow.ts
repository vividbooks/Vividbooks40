import { WorksheetBlock, generateBlockId } from '../types/worksheet';
import { preventOrphansInHtml } from '../components/worksheet-editor/LatexRenderer';

const FLOW_CONTENT_SELECTOR = '[data-text-flow-content="true"]';

function debugTextFlow(scope: string, payload: Record<string, unknown>) {
  if (!import.meta.env.DEV || typeof window === 'undefined' || (window as any).__VB_TEXT_FLOW_DEBUG !== true) return;
  console.log(`[text-flow] ${scope}`, payload);
}

export function supportsTextFlow(block: WorksheetBlock): boolean {
  if (block.type === 'infobox') return true;
  if (block.type !== 'paragraph') return false;
  const mt = (block.content as any)?.miniApp?.type;
  if (mt === 'compare-counts' || mt === 'pisanka') return false;
  return !(block.content as any)?.imageUrl;
}

export function hasTextFlowFrame(block: WorksheetBlock): boolean {
  return supportsTextFlow(block) && typeof block.textFlowFrameHeight === 'number' && block.textFlowFrameHeight > 0;
}

export function getTextFlowFrameMode(block: WorksheetBlock): 'auto' | 'manual' {
  return block.textFlowFrameMode === 'manual' ? 'manual' : 'auto';
}

export function isTextFlowLinked(block: WorksheetBlock): boolean {
  return !!(block.textFlowPrevBlockId || block.textFlowNextBlockId || block.textFlowChainId);
}

export function getTextFlowHtml(block: WorksheetBlock): string {
  if (!supportsTextFlow(block)) return '';
  return String((block.content as any)?.html ?? '');
}

export function isTextFlowHtmlEmpty(html: string): boolean {
  if (!html) return true;
  if (typeof document === 'undefined') {
    return !html.replace(/<[^>]*>/g, '').trim();
  }
  const root = document.createElement('div');
  root.innerHTML = html;
  return !(root.textContent || '').trim();
}

function normalizeTextFlowHtml(html: string): string {
  if (typeof document === 'undefined') return html;
  if (!html) return '';

  const root = document.createElement('div');
  root.innerHTML = html;
  const pieces: string[] = [];
  const children = Array.from(root.childNodes);

  children.forEach((node, index) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pieces.push(node.textContent ?? '');
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'div' || tag === 'p') {
      pieces.push(el.innerHTML);
      if (index < children.length - 1) pieces.push('<br>');
      return;
    }

    pieces.push(el.outerHTML);
  });

  return preventOrphansInHtml(
    pieces.join('').replace(/(?:<br>\s*)+$/i, '')
  );
}

export function setTextFlowHtml<T extends WorksheetBlock>(block: T, html: string): T {
  return {
    ...block,
    content: { ...(block.content as any), html: normalizeTextFlowHtml(html) },
  } as T;
}

export function joinTextFlowHtml(parts: string[]): string {
  if (typeof document === 'undefined') return parts.join('');
  const root = document.createElement('div');
  for (const part of parts) {
    if (!part) continue;
    const range = document.createRange();
    root.appendChild(range.createContextualFragment(part));
  }
  return normalizeTextFlowHtml(root.innerHTML);
}

function getFrameEl(blockId: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(`[data-text-flow-frame-for="${blockId}"]`);
}

function getElementScale(el: HTMLElement | null): number {
  if (!el) return 1;
  const rect = el.getBoundingClientRect();
  const offsetH = el.offsetHeight || el.clientHeight || 0;
  if (!offsetH) return 1;
  const scale = rect.height / offsetH;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

export function getTextFlowAvailableFrameHeight(blockId: string): number | undefined {
  const frame = getFrameEl(blockId);
  if (!frame) return undefined;
  const contentGrid = frame.closest<HTMLElement>('[data-page-content-grid="true"]');
  if (!contentGrid) return undefined;

  const scale = getElementScale(contentGrid);
  const frameTop = frame.getBoundingClientRect().top;
  const gridRect = contentGrid.getBoundingClientRect();

  // Grid has bottom padding (contentPadBot) — frame must not extend into it.
  const gridPadBot = parseFloat(window.getComputedStyle(contentGrid).paddingBottom) || 0;
  // Frame sits inside EditableBlock wrapper with py-1 (4px bottom padding).
  const blockWrapper = frame.closest<HTMLElement>('[data-block-id]');
  const wrapperPadBot = blockWrapper
    ? (parseFloat(window.getComputedStyle(blockWrapper).paddingBottom) || 0)
    : 0;

  const effectiveBottom = gridRect.bottom - (gridPadBot * scale) - (wrapperPadBot * scale);
  const availableHeight = Math.floor((effectiveBottom - frameTop) / scale);

  if (!Number.isFinite(availableHeight) || availableHeight < 36) return undefined;
  debugTextFlow('available-frame-height', {
    blockId,
    availableHeight,
    scale,
    frameTop: Math.round(frameTop),
    gridBottom: Math.round(gridRect.bottom),
    gridPadBot: Math.round(gridPadBot),
    wrapperPadBot: Math.round(wrapperPadBot),
    effectiveBottom: Math.round(effectiveBottom),
  });
  return availableHeight;
}

export type TextFlowDebugMetrics = {
  blockId: string;
  frameHeight: number;
  availableHeight?: number;
  scrollHeight: number;
  clientHeight: number;
  contentHeight: number;
  lineHeight: number;
  estimatedAvailableLines: number;
  estimatedRenderedLines: number;
  estimatedVisibleLines: number;
  overflowPx: number;
};

export function getTextFlowDebugMetrics(blockId: string): TextFlowDebugMetrics | null {
  if (typeof window === 'undefined') return null;
  const frame = getFrameEl(blockId);
  if (!frame) return null;
  const content = frame.querySelector<HTMLElement>(FLOW_CONTENT_SELECTOR);
  const target = content ? getHtmlMeasureTarget(content) : null;
  const lineHeight = content ? getTextFlowLineStep(blockId, 24) : 24;
  const frameHeight = Math.round(frame.clientHeight || frame.offsetHeight || 0);
  const scrollHeight = Math.round(frame.scrollHeight || 0);
  const clientHeight = Math.round(frame.clientHeight || 0);
  const contentHeight = Math.round(target?.scrollHeight || target?.clientHeight || 0);
  const availableHeight = getTextFlowAvailableFrameHeight(blockId);
  const estimatedAvailableLines = Math.max(0, Math.round((availableHeight ?? 0) / Math.max(1, lineHeight)));
  const estimatedRenderedLines = Math.max(0, Math.round(contentHeight / Math.max(1, lineHeight)));
  const estimatedVisibleLines = Math.max(0, Math.round(clientHeight / Math.max(1, lineHeight)));
  const overflowPx = Math.max(0, scrollHeight - clientHeight);

  return {
    blockId,
    frameHeight,
    availableHeight,
    scrollHeight,
    clientHeight,
    contentHeight,
    lineHeight,
    estimatedAvailableLines,
    estimatedRenderedLines,
    estimatedVisibleLines,
    overflowPx,
  };
}

export function getTextFlowNaturalFrameHeight(blockId: string, fallback = 180): number {
  const frame = getFrameEl(blockId);
  if (!frame) return fallback;
  return Math.max(36, Math.round(frame.scrollHeight || frame.clientHeight || frame.offsetHeight || fallback));
}

export function getTextFlowLineStep(blockId: string, fallback = 24): number {
  const frame = getFrameEl(blockId);
  const content = frame?.querySelector<HTMLElement>(FLOW_CONTENT_SELECTOR);
  if (!content || typeof window === 'undefined') return fallback;

  const computed = window.getComputedStyle(content);
  let lineHeight = Number.parseFloat(computed.lineHeight);
  if (!Number.isFinite(lineHeight)) {
    const fontSize = Number.parseFloat(computed.fontSize) || 16;
    lineHeight = fontSize * 1.5;
  }

  return Math.max(8, Math.round(lineHeight));
}

export function resolveTextFlowCombinedHeight(
  targetCombinedHeight: number,
  naturalHeight: number,
  lineStep: number,
  options?: { snapToLine?: boolean },
): { frameHeight?: number; marginBottom: number } {
  const safeNaturalHeight = Math.max(36, Math.round(naturalHeight || 180));
  const safeLineStep = Math.max(8, Math.round(lineStep || 24));
  const safeTargetCombinedHeight = Math.max(36, Math.round(targetCombinedHeight));
  const snapToLine = options?.snapToLine ?? true;

  if (safeTargetCombinedHeight <= safeNaturalHeight) {
    if (!snapToLine) {
      return {
        frameHeight: safeTargetCombinedHeight < safeNaturalHeight ? safeTargetCombinedHeight : undefined,
        marginBottom: 0,
      };
    }

    const reduction = safeNaturalHeight - safeTargetCombinedHeight;
    const lineCount = Math.floor(reduction / safeLineStep);
    const snappedFrameHeight = Math.max(36, safeNaturalHeight - lineCount * safeLineStep);

    return {
      frameHeight: snappedFrameHeight < safeNaturalHeight ? snappedFrameHeight : undefined,
      marginBottom: 0,
    };
  }

  return {
    frameHeight: undefined,
    marginBottom: safeTargetCombinedHeight - safeNaturalHeight,
  };
}

function cloneFrameForMeasurement(blockId: string): { frame: HTMLElement; content: HTMLElement; sourceFrame: HTMLElement } | null {
  const sourceFrame = getFrameEl(blockId);
  if (!sourceFrame) return null;
  const clone = sourceFrame.cloneNode(true) as HTMLElement;
  clone.style.position = 'fixed';
  clone.style.left = '-99999px';
  clone.style.top = '0';
  clone.style.visibility = 'hidden';
  clone.style.pointerEvents = 'none';
  clone.style.height = 'auto';
  clone.style.minHeight = '0';
  clone.style.maxHeight = 'none';
  clone.style.overflow = 'visible';
  clone.style.width = `${Math.round(sourceFrame.clientWidth || sourceFrame.offsetWidth || sourceFrame.getBoundingClientRect().width)}px`;
  clone.removeAttribute('data-text-flow-frame-for');
  const content = clone.querySelector<HTMLElement>(FLOW_CONTENT_SELECTOR);
  if (!content) return null;
  document.body.appendChild(clone);
  return { frame: clone, content, sourceFrame };
}

function cleanupMeasuredFrame(frame: HTMLElement | null) {
  frame?.remove();
}

function collectTextNodes(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

function locateTextPosition(root: HTMLElement, charIndex: number): { node: Text; offset: number } | null {
  const textNodes = collectTextNodes(root);
  if (textNodes.length === 0) return null;
  let remaining = charIndex;
  for (const node of textNodes) {
    const len = node.textContent?.length ?? 0;
    if (remaining <= len) {
      return { node, offset: remaining };
    }
    remaining -= len;
  }
  const last = textNodes[textNodes.length - 1];
  return { node: last, offset: last.textContent?.length ?? 0 };
}

function rangeHtml(root: HTMLElement, startChar: number, endChar: number): string {
  const totalChars = root.textContent?.length ?? 0;
  if (totalChars === 0 || endChar <= startChar) return '';
  const startPos = locateTextPosition(root, startChar);
  const endPos = locateTextPosition(root, endChar);
  if (!startPos || !endPos) return root.innerHTML;

  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);
  const wrapper = document.createElement('div');
  wrapper.appendChild(range.cloneContents());
  return wrapper.innerHTML;
}

function splitHtmlAtCharIndex(html: string, charIndex: number): { beforeHtml: string; afterHtml: string } {
  const sourceRoot = document.createElement('div');
  sourceRoot.innerHTML = html || '';
  const fullText = sourceRoot.textContent ?? '';
  const safeIndex = Math.max(0, Math.min(fullText.length, Math.round(charIndex)));
  return {
    beforeHtml: rangeHtml(sourceRoot, 0, safeIndex),
    afterHtml: rangeHtml(sourceRoot, safeIndex, fullText.length),
  };
}

function isWordChar(char: string | undefined): boolean {
  if (!char) return false;
  return /[\p{L}\p{N}\p{M}]/u.test(char);
}

function getSafeBoundaryBefore(text: string, index: number): number {
  const safeIndex = Math.max(0, Math.min(text.length, index));
  if (safeIndex <= 0 || safeIndex >= text.length) return safeIndex;

  try {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const segmenter = new Intl.Segmenter('cs', { granularity: 'word' });
      let previousBoundary = 0;
      for (const segment of segmenter.segment(text)) {
        const boundary = segment.index;
        if (boundary >= safeIndex) break;
        previousBoundary = boundary;
      }
      if (previousBoundary < safeIndex) {
        const candidate = trimBoundaryWhitespace(text, safeIndex);
        if (isSafeSplitBoundary(text, candidate)) return candidate;
        if (isSafeSplitBoundary(text, previousBoundary)) return trimBoundaryWhitespace(text, previousBoundary);
      }
    }
  } catch {
    // Fallback below
  }

  let candidate = safeIndex;
  while (candidate > 0 && !isSafeSplitBoundary(text, candidate)) {
    candidate -= 1;
  }
  return trimBoundaryWhitespace(text, candidate);
}

function isSafeSplitBoundary(text: string, index: number): boolean {
  if (index <= 0 || index >= text.length) return true;
  return !(isWordChar(text[index - 1]) && isWordChar(text[index]));
}

function trimBoundaryWhitespace(text: string, index: number): number {
  let nextIndex = index;
  while (nextIndex > 0 && /\s/u.test(text[nextIndex - 1] || '')) {
    nextIndex -= 1;
  }
  return nextIndex;
}

function getHtmlMeasureTarget(content: HTMLElement): HTMLElement {
  return content.querySelector<HTMLElement>('.worksheet-rich-html-content') ?? content;
}

function cleanupSplitHtml(html: string, mode: 'start' | 'end'): string {
  if (typeof document === 'undefined' || !html) return html;
  const root = document.createElement('div');
  root.innerHTML = html;

  const isEmptyInline = (node: ChildNode | null): boolean => {
    if (!node) return true;
    if (node.nodeType === Node.TEXT_NODE) return !(node.textContent || '').trim();
    if (node.nodeType !== Node.ELEMENT_NODE) return true;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'br') return true;
    if ((el.textContent || '').trim()) return false;
    return Array.from(el.childNodes).every((child) => isEmptyInline(child));
  };

  const trimEdge = () => {
    const node = mode === 'end' ? root.lastChild : root.firstChild;
    if (!node) return false;
    if (!isEmptyInline(node)) return false;
    node.remove();
    return true;
  };

  while (trimEdge()) {
    // keep trimming
  }

  return root.innerHTML;
}

function htmlHeightForPrefix(measureFrame: HTMLElement, measureContent: HTMLElement, prefixHtml: string): number {
  const target = getHtmlMeasureTarget(measureContent);
  target.innerHTML = prefixHtml || '<span></span>';
  return Math.ceil(measureFrame.offsetHeight || measureFrame.scrollHeight || measureFrame.getBoundingClientRect().height);
}

export function measureTextFlowHtmlNaturalHeight(blockId: string, html: string, fallback = 180): number {
  if (typeof document === 'undefined') return fallback;
  const measured = cloneFrameForMeasurement(blockId);
  if (!measured) return fallback;

  try {
    const target = getHtmlMeasureTarget(measured.content);
    target.innerHTML = html || '<span></span>';
    return Math.max(36, Math.ceil(measured.frame.offsetHeight || measured.frame.scrollHeight || fallback));
  } finally {
    cleanupMeasuredFrame(measured.frame);
  }
}

function htmlFromTopLevelNodes(nodes: ChildNode[]): string {
  const wrapper = document.createElement('div');
  nodes.forEach((node) => wrapper.appendChild(node.cloneNode(true)));
  return wrapper.innerHTML;
}

function trySplitByTopLevelNodes(
  sourceRoot: HTMLElement,
  measureFrame: HTMLElement,
  measureContent: HTMLElement,
  maxHeight: number,
): { fitHtml: string; overflowHtml: string } | null {
  const nodes = Array.from(sourceRoot.childNodes);
  if (nodes.length <= 1) return null;

  let low = 0;
  let high = nodes.length;
  let best = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const prefixHtml = htmlFromTopLevelNodes(nodes.slice(0, mid));
    const h = htmlHeightForPrefix(measureFrame, measureContent, prefixHtml);
    if (h <= maxHeight) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (best <= 0 || best >= nodes.length) return null;
  return {
    fitHtml: htmlFromTopLevelNodes(nodes.slice(0, best)),
    overflowHtml: htmlFromTopLevelNodes(nodes.slice(best)),
  };
}

const MAX_SPLIT_BACKWARD_CHARS = 28;
const MAX_SPLIT_BACKWARD_SLACK_LINES = 1;

function normalizeSplitChars(fullText: string, fitChars: number): number {
  if (fitChars <= 0 || fitChars >= fullText.length) return fitChars;
  if (isSafeSplitBoundary(fullText, fitChars)) {
    return trimBoundaryWhitespace(fullText, fitChars);
  }
  const safe = getSafeBoundaryBefore(fullText, fitChars);
  if (fitChars - safe > MAX_SPLIT_BACKWARD_CHARS) {
    return trimBoundaryWhitespace(fullText, fitChars);
  }
  return trimBoundaryWhitespace(fullText, safe);
}

function getMeasuredLineHeight(content: HTMLElement, fallback = 24): number {
  if (typeof window === 'undefined') return fallback;
  const target = getHtmlMeasureTarget(content);
  const computed = window.getComputedStyle(target);
  let lineHeight = Number.parseFloat(computed.lineHeight);
  if (!Number.isFinite(lineHeight)) {
    const fontSize = Number.parseFloat(computed.fontSize) || 16;
    lineHeight = fontSize * 1.5;
  }
  return Math.max(8, Math.round(lineHeight));
}

export function splitHtmlForFrame(blockId: string, html: string, availableHeight?: number): { fitHtml: string; overflowHtml: string } {
  if (typeof document === 'undefined') return { fitHtml: html, overflowHtml: '' };
  const measured = cloneFrameForMeasurement(blockId);
  if (!measured) return { fitHtml: html, overflowHtml: '' };

  try {
    const { frame, content, sourceFrame } = measured;
    const maxHeight = availableHeight ?? Math.round(sourceFrame.clientHeight || sourceFrame.offsetHeight || sourceFrame.getBoundingClientRect().height);
    if (!maxHeight || maxHeight <= 0) return { fitHtml: html, overflowHtml: '' };

    const sourceRoot = document.createElement('div');
    sourceRoot.innerHTML = html || '';
    const fullText = sourceRoot.textContent ?? '';

    const measureTarget = getHtmlMeasureTarget(content);
    measureTarget.innerHTML = html || '<span></span>';
    if (Math.ceil(frame.offsetHeight || frame.scrollHeight || frame.getBoundingClientRect().height) <= maxHeight) {
      debugTextFlow('split-fit-all', {
        blockId,
        maxHeight,
        measuredHeight: Math.ceil(frame.offsetHeight || frame.scrollHeight || frame.getBoundingClientRect().height),
        textLength: fullText.length,
      });
      return { fitHtml: html, overflowHtml: '' };
    }
    if (!fullText.length) {
      debugTextFlow('split-empty-text', {
        blockId,
        maxHeight,
        htmlLength: html.length,
      });
      return { fitHtml: '', overflowHtml: html };
    }

    const topLevelSplit = trySplitByTopLevelNodes(sourceRoot, frame, content, maxHeight);
    if (topLevelSplit) {
      const fitHeight = htmlHeightForPrefix(frame, content, topLevelSplit.fitHtml);
      const remainingSlack = Math.max(0, maxHeight - fitHeight);
      const overflowRoot = document.createElement('div');
      overflowRoot.innerHTML = topLevelSplit.overflowHtml;
      const overflowText = (overflowRoot.textContent || '').trim();

      if (!overflowText || remainingSlack <= 2) {
        debugTextFlow('split-top-level', {
          blockId,
          maxHeight,
          fitTextLength: (topLevelSplit.fitHtml.replace(/<[^>]*>/g, '') || '').length,
          overflowTextLength: overflowText.length,
          remainingSlack,
        });
        return topLevelSplit;
      }
    }

    let low = 0;
    let high = fullText.length;
    let best = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const prefixHtml = rangeHtml(sourceRoot, 0, mid);
      const h = htmlHeightForPrefix(frame, content, prefixHtml);
      if (h <= maxHeight) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const rawFitChars = trimBoundaryWhitespace(fullText, best);
    const safeFitChars = normalizeSplitChars(fullText, best);
    let fitChars = safeFitChars;

    if (safeFitChars !== rawFitChars) {
      const rawFitHeight = htmlHeightForPrefix(frame, content, rangeHtml(sourceRoot, 0, rawFitChars));
      const safeFitHeight = htmlHeightForPrefix(frame, content, rangeHtml(sourceRoot, 0, safeFitChars));
      const lineHeight = getMeasuredLineHeight(content, 24);
      const safeSlack = Math.max(0, maxHeight - safeFitHeight);

      // Keep nice word boundaries, but not at the cost of leaving visibly empty rows.
      if (rawFitHeight <= maxHeight && safeSlack > lineHeight * MAX_SPLIT_BACKWARD_SLACK_LINES) {
        fitChars = rawFitChars;
      }
    }

    const fitHtml = cleanupSplitHtml(rangeHtml(sourceRoot, 0, fitChars), 'end');
    const overflowHtml = cleanupSplitHtml(rangeHtml(sourceRoot, fitChars, fullText.length), 'start');
    debugTextFlow('split-char-level', {
      blockId,
      maxHeight,
      fullTextLength: fullText.length,
      fitChars,
      fitTextLength: (fitHtml.replace(/<[^>]*>/g, '') || '').length,
      overflowTextLength: (overflowHtml.replace(/<[^>]*>/g, '') || '').length,
    });
    return {
      fitHtml,
      overflowHtml,
    };
  } finally {
    cleanupMeasuredFrame(measured.frame);
  }
}

export function getOrderedTextFlowChain(blocks: WorksheetBlock[], blockId: string): WorksheetBlock[] {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const start = byId.get(blockId);
  if (!start || !supportsTextFlow(start)) return [];

  const visited = new Set<string>();
  let head = start;
  while (head.textFlowPrevBlockId && !visited.has(head.id)) {
    visited.add(head.id);
    const prev = byId.get(head.textFlowPrevBlockId);
    if (!prev || !supportsTextFlow(prev)) break;
    head = prev;
  }

  const ordered: WorksheetBlock[] = [];
  const chainedVisited = new Set<string>();
  let current: WorksheetBlock | undefined = head;
  while (current && !chainedVisited.has(current.id) && supportsTextFlow(current)) {
    ordered.push(current);
    chainedVisited.add(current.id);
    current = current.textFlowNextBlockId ? byId.get(current.textFlowNextBlockId) : undefined;
  }

  if (ordered.length === 0) ordered.push(start);
  return ordered;
}

export function reflowTextFlowChain(blocks: WorksheetBlock[], blockId: string, combinedHtmlOverride?: string): WorksheetBlock[] {
  const chain = getOrderedTextFlowChain(blocks, blockId);
  if (chain.length === 0) return blocks;

  const chainIds = new Set(chain.map((b) => b.id));
  let remainingHtml = combinedHtmlOverride ?? joinTextFlowHtml(chain.map(getTextFlowHtml));
  const updated = new Map<string, WorksheetBlock>();

  chain.forEach((block, index) => {
    const isLast = index === chain.length - 1;
    if (!hasTextFlowFrame(block) || isLast) {
      const nextHtmlBlock = setTextFlowHtml(block, remainingHtml);
      const nextFrameHeight = (
        isLast
        && hasTextFlowFrame(block)
        && getTextFlowFrameMode(block) === 'auto'
      )
        ? (() => {
            const naturalHeight = measureTextFlowHtmlNaturalHeight(block.id, remainingHtml, block.textFlowFrameHeight || 180);
            const availableHeight = getTextFlowAvailableFrameHeight(block.id);
            return Math.min(naturalHeight, availableHeight ?? naturalHeight);
          })()
        : block.textFlowFrameHeight;
      debugTextFlow('reflow-pass-through', {
        blockId,
        targetBlockId: block.id,
        index,
        isLast,
        hasFrame: hasTextFlowFrame(block),
        remainingTextLength: (remainingHtml.replace(/<[^>]*>/g, '') || '').length,
        frameHeight: block.textFlowFrameHeight,
        nextFrameHeight,
      });
      updated.set(block.id, {
        ...nextHtmlBlock,
        ...(typeof nextFrameHeight === 'number' ? { textFlowFrameHeight: nextFrameHeight } : {}),
      });
      remainingHtml = '';
      return;
    }

    const { fitHtml, overflowHtml } = splitHtmlForFrame(block.id, remainingHtml, block.textFlowFrameHeight);
    debugTextFlow('reflow-split', {
      blockId,
      targetBlockId: block.id,
      index,
      frameHeight: block.textFlowFrameHeight,
      fitTextLength: (fitHtml.replace(/<[^>]*>/g, '') || '').length,
      overflowTextLength: (overflowHtml.replace(/<[^>]*>/g, '') || '').length,
      marginBottom: block.marginBottom || 0,
    });
    updated.set(block.id, {
      ...setTextFlowHtml(block, fitHtml),
      textFlowFrameHeight: block.textFlowFrameHeight,
      marginBottom: overflowHtml ? 0 : (block.marginBottom || 0),
    });
    remainingHtml = overflowHtml;
  });

  return blocks.map((block) => (chainIds.has(block.id) ? (updated.get(block.id) ?? block) : block));
}

export function detectTextFlowOverflow(blockId: string): boolean {
  const frame = getFrameEl(blockId);
  if (!frame) return false;
  return frame.scrollHeight > frame.clientHeight + 1;
}

export function createTextFlowContinuation(blocks: WorksheetBlock[], blockId: string): { blocks: WorksheetBlock[]; newBlockId: string | null } {
  const sourceIndex = blocks.findIndex((b) => b.id === blockId);
  const source = sourceIndex >= 0 ? blocks[sourceIndex] : null;
  if (!source || !supportsTextFlow(source)) return { blocks, newBlockId: null };
  if (source.textFlowNextBlockId) return { blocks, newBlockId: source.textFlowNextBlockId };

  const chainId = source.textFlowChainId || `flow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const newBlockId = generateBlockId();
  const newBlock = JSON.parse(JSON.stringify(source)) as WorksheetBlock;
  newBlock.id = newBlockId;
  newBlock.order = source.order + 1;
  newBlock.marginBottom = 0;
  newBlock.textFlowFrameMode = 'auto';
  newBlock.textFlowChainId = chainId;
  newBlock.textFlowPrevBlockId = source.id;
  newBlock.textFlowNextBlockId = undefined;
  newBlock.textFlowFrameHeight = source.textFlowFrameHeight || Math.round(getFrameEl(source.id)?.clientHeight || getFrameEl(source.id)?.offsetHeight || 180);
  newBlock.image = undefined;
  if (newBlock.type === 'infobox') {
    (newBlock.content as any).title = '';
  }
  (newBlock.content as any).html = '';

  const updatedBlocks = blocks.map((block) => {
    if (block.id !== source.id) return block;
    return {
      ...block,
      textFlowFrameMode: block.textFlowFrameMode ?? 'auto',
      textFlowChainId: chainId,
      textFlowNextBlockId: newBlockId,
      textFlowFrameHeight: block.textFlowFrameHeight || Math.round(getFrameEl(block.id)?.clientHeight || getFrameEl(block.id)?.offsetHeight || 180),
    };
  });

  const inserted = [
    ...updatedBlocks.slice(0, sourceIndex + 1),
    newBlock,
    ...updatedBlocks.slice(sourceIndex + 1),
  ].map((block, index) => ({ ...block, order: index }));

  return {
    blocks: reflowTextFlowChain(inserted, source.id),
    newBlockId,
  };
}

export function splitTextFlowAtChar(
  blocks: WorksheetBlock[],
  blockId: string,
  charIndex: number,
  currentHtmlOverride?: string,
): WorksheetBlock[] {
  const source = blocks.find((block) => block.id === blockId);
  if (!source || !supportsTextFlow(source)) return blocks;

  const ensured = source.textFlowNextBlockId ? { blocks, newBlockId: source.textFlowNextBlockId } : createTextFlowContinuation(blocks, blockId);
  const seededBlocks = currentHtmlOverride
    ? ensured.blocks.map((block) => (
      block.id === blockId ? setTextFlowHtml(block, currentHtmlOverride) : block
    ))
    : ensured.blocks;

  const chain = getOrderedTextFlowChain(seededBlocks, blockId);
  if (chain.length === 0) return seededBlocks;

  const target = chain.find((block) => block.id === blockId);
  if (!target) return seededBlocks;

  const currentHtml = currentHtmlOverride ?? getTextFlowHtml(target);
  const { beforeHtml, afterHtml } = splitHtmlAtCharIndex(currentHtml, charIndex);
  if (!afterHtml.trim()) return seededBlocks;

  const combinedHtml = joinTextFlowHtml(chain.map((block) => (
    block.id === blockId ? currentHtml : getTextFlowHtml(block)
  )));

  const updatedBlocks = seededBlocks.map((block) => {
    if (block.id !== blockId) return block;
    return {
      ...setTextFlowHtml(block, beforeHtml),
      textFlowFrameHeight: block.textFlowFrameHeight,
      marginBottom: 0,
    };
  });

  return reflowTextFlowChain(updatedBlocks, blockId, combinedHtml);
}

export function removeTextFlowBlock(blocks: WorksheetBlock[], blockId: string): WorksheetBlock[] {
  const target = blocks.find((block) => block.id === blockId);
  if (!target || !supportsTextFlow(target) || !isTextFlowLinked(target)) {
    return blocks.filter((block) => block.id !== blockId).map((block, index) => ({ ...block, order: index }));
  }

  const chain = getOrderedTextFlowChain(blocks, blockId);
  const combinedHtml = joinTextFlowHtml(chain.map(getTextFlowHtml));
  const remainingChain = chain.filter((block) => block.id !== blockId);
  const remainingIds = new Set(remainingChain.map((block) => block.id));

  const pruned = blocks
    .filter((block) => block.id !== blockId)
    .map((block) => {
      if (!remainingIds.has(block.id)) return block;

      let updated = { ...block };
      if (updated.textFlowPrevBlockId === blockId) {
        updated.textFlowPrevBlockId = undefined;
      }
      if (updated.textFlowNextBlockId === blockId) {
        updated.textFlowNextBlockId = undefined;
      }

      return updated;
    })
    .map((block, index) => ({ ...block, order: index }));

  if (remainingChain.length === 0) return pruned;
  if (remainingChain.length === 1) {
    const solo = remainingChain[0];
    return pruned.map((block) => (
      block.id === solo.id
        ? {
          ...setTextFlowHtml(block, combinedHtml),
          textFlowChainId: undefined,
          textFlowPrevBlockId: undefined,
          textFlowNextBlockId: undefined,
        }
        : block
    ));
  }

  return reflowTextFlowChain(pruned, remainingChain[0].id, combinedHtml);
}

export function trimTrailingEmptyTextFlowBlocks(blocks: WorksheetBlock[], chainBlockId: string): WorksheetBlock[] {
  const chain = getOrderedTextFlowChain(blocks, chainBlockId);
  if (chain.length <= 1) return blocks;

  const toRemove = new Set<string>();
  for (let i = chain.length - 1; i > 0; i--) {
    const block = chain[i];
    if (isTextFlowHtmlEmpty(getTextFlowHtml(block))) {
      toRemove.add(block.id);
    } else {
      break;
    }
  }

  if (toRemove.size === 0) return blocks;

  const remaining = chain.filter((block) => !toRemove.has(block.id));
  const lastRemaining = remaining[remaining.length - 1];

  return blocks
    .filter((block) => !toRemove.has(block.id))
    .map((block) => {
      if (block.id === lastRemaining?.id) {
        return { ...block, textFlowNextBlockId: undefined };
      }
      return block;
    })
    .map((block, index) => ({ ...block, order: index }));
}
