import { WorksheetBlock, generateBlockId } from '../types/worksheet';
import { preventOrphansInHtml } from '../components/worksheet-editor/LatexRenderer';

const FLOW_FRAME_SELECTOR = '[data-text-flow-frame-for]';
const FLOW_CONTENT_SELECTOR = '[data-text-flow-content="true"]';

export function supportsTextFlow(block: WorksheetBlock): boolean {
  if (block.type === 'infobox') return true;
  if (block.type !== 'paragraph') return false;
  // Miniaplikace v odstavci — bez ořezu a bez červeného bobánku (text flow)
  const mt = (block.content as any)?.miniApp?.type;
  if (mt === 'compare-counts' || mt === 'pisanka') return false;
  return !(block.content as any)?.imageUrl;
}

export function hasTextFlowFrame(block: WorksheetBlock): boolean {
  return supportsTextFlow(block) && typeof block.textFlowFrameHeight === 'number' && block.textFlowFrameHeight > 0;
}

export function isTextFlowLinked(block: WorksheetBlock): boolean {
  return !!(block.textFlowPrevBlockId || block.textFlowNextBlockId || block.textFlowChainId);
}

export function getTextFlowHtml(block: WorksheetBlock): string {
  if (!supportsTextFlow(block)) return '';
  return String((block.content as any)?.html ?? '');
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

export function getTextFlowNaturalFrameHeight(blockId: string, fallback = 180): number {
  const frame = getFrameEl(blockId);
  if (!frame) return fallback;
  return Math.max(36, Math.round(frame.scrollHeight || frame.getBoundingClientRect().height || fallback));
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
  clone.style.width = `${Math.round(sourceFrame.getBoundingClientRect().width)}px`;
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
  measureContent.innerHTML = prefixHtml || '<span></span>';
  return Math.ceil(measureFrame.getBoundingClientRect().height);
}

function measureHtmlHeightForFrame(blockId: string, html: string, fallback = 36): number {
  const measured = cloneFrameForMeasurement(blockId);
  if (!measured) return fallback;
  try {
    return Math.max(fallback, htmlHeightForPrefix(measured.frame, measured.content, html));
  } finally {
    cleanupMeasuredFrame(measured.frame);
  }
}

function measureContentLineStep(measureContent: HTMLElement, fallback = 24): number {
  if (typeof window === 'undefined') return fallback;
  const computed = window.getComputedStyle(measureContent);
  let lineHeight = Number.parseFloat(computed.lineHeight);
  if (!Number.isFinite(lineHeight)) {
    const fontSize = Number.parseFloat(computed.fontSize) || 16;
    lineHeight = fontSize * 1.5;
  }
  return Math.max(8, Math.round(lineHeight));
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

function normalizeSplitChars(fullText: string, fitChars: number): number {
  if (fitChars <= 0 || fitChars >= fullText.length) return fitChars;
  if (isSafeSplitBoundary(fullText, fitChars)) {
    return trimBoundaryWhitespace(fullText, fitChars);
  }
  return getSafeBoundaryBefore(fullText, fitChars);
}

export function splitHtmlForFrame(blockId: string, html: string, availableHeight?: number): { fitHtml: string; overflowHtml: string } {
  if (typeof document === 'undefined') return { fitHtml: html, overflowHtml: '' };
  const measured = cloneFrameForMeasurement(blockId);
  if (!measured) return { fitHtml: html, overflowHtml: '' };

  try {
    const { frame, content, sourceFrame } = measured;
    const maxHeight = availableHeight ?? Math.round(sourceFrame.getBoundingClientRect().height);
    if (!maxHeight || maxHeight <= 0) return { fitHtml: html, overflowHtml: '' };

    const sourceRoot = document.createElement('div');
    sourceRoot.innerHTML = html || '';
    const fullText = sourceRoot.textContent ?? '';

    content.innerHTML = html || '<span></span>';
    if (Math.ceil(frame.getBoundingClientRect().height) <= maxHeight) {
      return { fitHtml: html, overflowHtml: '' };
    }
    if (!fullText.length) {
      return { fitHtml: '', overflowHtml: html };
    }

    const topLevelSplit = trySplitByTopLevelNodes(sourceRoot, frame, content, maxHeight);
    if (topLevelSplit) {
      const fitHeight = htmlHeightForPrefix(frame, content, topLevelSplit.fitHtml);
      const remainingSlack = Math.max(0, maxHeight - fitHeight);
      const lineStep = measureContentLineStep(content);
      const overflowRoot = document.createElement('div');
      overflowRoot.innerHTML = topLevelSplit.overflowHtml;
      const overflowText = (overflowRoot.textContent || '').trim();

      // Keep block-level splitting only when it already fills the frame closely.
      // Otherwise continue with char-level fitting so we don't leave large empty
      // space just because the next paragraph doesn't fit as a whole.
      if (!overflowText || remainingSlack <= Math.max(12, Math.round(lineStep * 0.75))) {
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

    const fitChars = normalizeSplitChars(fullText, best);
    const fitHtml = cleanupSplitHtml(rangeHtml(sourceRoot, 0, fitChars), 'end');
    const overflowHtml = cleanupSplitHtml(rangeHtml(sourceRoot, fitChars, fullText.length), 'start');
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
      updated.set(block.id, setTextFlowHtml(block, remainingHtml));
      remainingHtml = '';
      return;
    }

    const { fitHtml, overflowHtml } = splitHtmlForFrame(block.id, remainingHtml, block.textFlowFrameHeight);
    updated.set(block.id, {
      ...setTextFlowHtml(block, fitHtml),
      textFlowFrameHeight: measureHtmlHeightForFrame(block.id, fitHtml, 36),
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
  newBlock.textFlowChainId = chainId;
  newBlock.textFlowPrevBlockId = source.id;
  newBlock.textFlowNextBlockId = undefined;
  newBlock.textFlowFrameHeight = source.textFlowFrameHeight || Math.round(getFrameEl(source.id)?.getBoundingClientRect().height || 180);
  newBlock.image = undefined;
  if (newBlock.type === 'infobox') {
    (newBlock.content as any).title = '';
  }
  (newBlock.content as any).html = '';

  const updatedBlocks = blocks.map((block) => {
    if (block.id !== source.id) return block;
    return {
      ...block,
      textFlowChainId: chainId,
      textFlowNextBlockId: newBlockId,
      textFlowFrameHeight: block.textFlowFrameHeight || Math.round(getFrameEl(block.id)?.getBoundingClientRect().height || 180),
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
      textFlowFrameHeight: measureHtmlHeightForFrame(block.id, beforeHtml || '<span></span>', 36),
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
      const currentIndex = remainingChain.findIndex((item) => item.id === block.id);
      const prev = remainingChain[currentIndex - 1];
      const next = remainingChain[currentIndex + 1];
      return {
        ...block,
        textFlowPrevBlockId: prev?.id,
        textFlowNextBlockId: next?.id,
        textFlowChainId: remainingChain.length > 1 ? (block.textFlowChainId || remainingChain[0]?.textFlowChainId) : undefined,
      };
    })
    .map((block, index) => ({ ...block, order: index }));

  if (remainingChain.length === 0) return pruned;
  if (remainingChain.length === 1) {
    const soleId = remainingChain[0].id;
    return pruned.map((block) => {
      if (block.id !== soleId) return block;
      return setTextFlowHtml({
        ...block,
        textFlowPrevBlockId: undefined,
        textFlowNextBlockId: undefined,
        textFlowChainId: undefined,
      }, combinedHtml);
    });
  }

  return reflowTextFlowChain(pruned, remainingChain[0].id, combinedHtml);
}
