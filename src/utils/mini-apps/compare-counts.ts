/**
 * Miniaplikace: porovnávání počtů — paragraph blok s miniApp + generovaným HTML.
 * Podporuje až 9 příkladů (mřížka max 3 sloupce), sdílený vzhled karty,
 * volitelný číselný řádek a více typů objektů na straně (+ v zápisu).
 */

import type {
  CompareCountsExample,
  CompareCountsItemGroup,
  CompareCountsMiniAppContent,
  ParagraphContent,
  WorksheetBlock,
} from '../../types/worksheet';
import { generateBlockId } from '../../types/worksheet';

export const MAX_COMPARE_COUNTS_EXAMPLES = 9;
export const MAX_COMPARE_GROUPS_PER_SIDE = 6;
export const COMPARE_COUNTS_GRID_COLUMNS = 3;
/** Výchozí výška obou polí se symboly (px) — pole má pevnou výšku, symboly a mezery se přizpůsobí dovnitř. */
export const COMPARE_COUNTS_DEFAULT_FIELD_HEIGHT = 105;

export function createEmptyGroup(): CompareCountsItemGroup {
  return { count: 0 };
}

export function createEmptyExample(): CompareCountsExample {
  return {
    id: generateBlockId(),
    leftGroups: [createEmptyGroup()],
    rightGroups: [createEmptyGroup()],
  };
}

/** Minimální tvar položky z katalogu nálepek pro náhodný výběr */
export type CompareStickerPoolItem = { id: string; url: string };

export interface ApplyCountDraftOptions {
  /** Když je zapnuto a pool neprázdný, každá skupina dostane náhodnou nálepku z poolu (počty z draftu). */
  useRandomStickers?: boolean;
  stickerPool?: CompareStickerPoolItem[];
}

/**
 * Nový příklad podle šablony: počty z AI draftu; nálepky buď zkopírované ze šablony, nebo náhodné z poolu.
 */
export function applyCountDraftToExample(
  template: CompareCountsExample,
  draft: { leftGroups?: { count?: unknown }[]; rightGroups?: { count?: unknown }[] },
  options?: ApplyCountDraftOptions
): CompareCountsExample {
  const pool = options?.stickerPool?.filter((s) => sanitizeStickerUrl(s.url)) ?? [];
  const useRandom = Boolean(options?.useRandomStickers && pool.length > 0);

  const pickSticker = (): Pick<CompareCountsItemGroup, 'stickerUrl' | 'stickerId'> => {
    const s = pool[Math.floor(Math.random() * pool.length)]!;
    return { stickerUrl: s.url, stickerId: s.id };
  };

  return {
    id: generateBlockId(),
    leftGroups: template.leftGroups.map((g, i) => {
      const count = clampInt(Number(draft.leftGroups?.[i]?.count ?? g.count), 0, 40);
      if (useRandom) {
        return { count, ...pickSticker() };
      }
      return { ...g, count };
    }),
    rightGroups: template.rightGroups.map((g, i) => {
      const count = clampInt(Number(draft.rightGroups?.[i]?.count ?? g.count), 0, 40);
      if (useRandom) {
        return { count, ...pickSticker() };
      }
      return { ...g, count };
    }),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Pouze https URL bez mezer (nálepky ze Storage). */
function sanitizeStickerUrl(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!/^https:\/\//i.test(t)) return null;
  if (/[\s"'<>]/.test(t)) return null;
  return t;
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** FNV-1a — stabilní „náhoda“ z řetězce (stejné HTML při stejných datech). */
function hash32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededInt(seed: string, salt: string, min: number, max: number): number {
  const h = hash32(`${seed}\0${salt}`);
  const span = max - min + 1;
  return min + (h % span);
}

interface CompareCountsSymbolLayoutOpts {
  randomPositions: boolean;
  exampleId: string;
  side: 'L' | 'R';
  groupIndex: number;
  symbolIndexStart: number;
}

/** Jitter škálovaný podle velikosti buňky — držíme malý, ať se vejdou i se zakulaceným overflow na rámečku. */
function randomTransformStyle(seedBase: string, indexInGroup: number, iconPx: number): string {
  const seed = `${seedBase}|i${indexInGroup}`;
  const tMax = Math.max(0, Math.min(4, Math.floor(iconPx * 0.14)));
  const rMax = Math.max(0, Math.min(6, Math.floor(iconPx * 0.22)));
  const tx = tMax > 0 ? seededInt(seed, 'tx', -tMax, tMax) : 0;
  const ty = tMax > 0 ? seededInt(seed, 'ty', -tMax, tMax) : 0;
  const rot = rMax > 0 ? seededInt(seed, 'rot', -rMax, rMax) : 0;
  if (tx === 0 && ty === 0 && rot === 0) return '';
  return `transform:translate(${tx}px,${ty}px) rotate(${rot}deg);transform-origin:center center;`;
}

function normalizeGroup(g: Partial<CompareCountsItemGroup> | undefined): CompareCountsItemGroup {
  const stickerUrl = sanitizeStickerUrl(g?.stickerUrl) ?? undefined;
  const base: CompareCountsItemGroup = {
    count: clampInt(Number(g?.count), 0, 40),
  };
  if (stickerUrl) {
    base.stickerUrl = stickerUrl;
    if (typeof g?.stickerId === 'string' && g.stickerId.trim()) {
      base.stickerId = g.stickerId.trim().slice(0, 200);
    }
  }
  return base;
}

function normalizeExample(ex: Partial<CompareCountsExample> | undefined): CompareCountsExample {
  const id = ex?.id && String(ex.id).trim() ? String(ex.id) : generateBlockId();
  let leftGroups = Array.isArray(ex?.leftGroups) ? ex.leftGroups.map(normalizeGroup) : [createEmptyGroup()];
  let rightGroups = Array.isArray(ex?.rightGroups) ? ex.rightGroups.map(normalizeGroup) : [createEmptyGroup()];
  leftGroups = leftGroups.slice(0, MAX_COMPARE_GROUPS_PER_SIDE);
  rightGroups = rightGroups.slice(0, MAX_COMPARE_GROUPS_PER_SIDE);
  if (leftGroups.length === 0) leftGroups = [createEmptyGroup()];
  if (rightGroups.length === 0) rightGroups = [createEmptyGroup()];
  return { id, leftGroups, rightGroups };
}

/**
 * Sjednotí uložená data (včetně starého formátu leftEmoji / leftCount).
 */
export function normalizeCompareCountsMiniApp(
  raw: Partial<CompareCountsMiniAppContent> & Record<string, unknown>
): CompareCountsMiniAppContent {
  const examplesIn = raw.examples;
  let examples: CompareCountsExample[];

  if (Array.isArray(examplesIn) && examplesIn.length > 0) {
    examples = examplesIn.slice(0, MAX_COMPARE_COUNTS_EXAMPLES).map((e) => normalizeExample(e as CompareCountsExample));
  } else {
    examples = [
      normalizeExample({
        id: generateBlockId(),
        leftGroups: [{ count: Number(raw.leftCount) || 0 }],
        rightGroups: [{ count: Number(raw.rightCount) || 0 }],
      }),
    ];
  }

  if (examples.length === 0) {
    examples = [createEmptyExample()];
  }

  return {
    type: 'compare-counts',
    examples,
    showCenterSlot: raw.showCenterSlot !== false,
    showNumericRow: Boolean(raw.showNumericRow),
    showNumericSolution: raw.showNumericSolution !== false,
    combineMultipleTypesPerSide: Boolean(raw.combineMultipleTypesPerSide),
    innerBorderColor: String(raw.innerBorderColor ?? '#c4b5fd'),
    innerBackground: String(raw.innerBackground ?? '#ffffff'),
    ...(() => {
      const maxS = clampInt(Number(raw.emojiSizePx), 16, 96) || 32;
      let minS = clampInt(Number(raw.emojiMinSizePx ?? 14), 12, 96);
      if (!Number.isFinite(minS)) minS = 14;
      if (minS > maxS) minS = maxS;
      return { emojiSizePx: maxS, emojiMinSizePx: minS };
    })(),
    minHeightPx: clampInt(Number(raw.minHeightPx), 64, 400) || COMPARE_COUNTS_DEFAULT_FIELD_HEIGHT,
    centerSlotSizePx: clampInt(Number(raw.centerSlotSizePx), 24, 120) || 34,
    textColor: String(raw.textColor ?? '#1e293b'),
    numericCompareHighlight: raw.numericCompareHighlight
      ? String(raw.numericCompareHighlight)
      : '#ede9fe',
    question: String(raw.question ?? ''),
    questionHtml: raw.questionHtml !== undefined ? String(raw.questionHtml) : undefined,
    circleColor: raw.circleColor !== undefined ? String(raw.circleColor) : '#1e293b',
    circleSize: raw.circleSize !== undefined ? clampInt(Number(raw.circleSize), 16, 40) : 21,
    qFontFamily: raw.qFontFamily !== undefined ? String(raw.qFontFamily) : undefined,
    qFontSize: raw.qFontSize !== undefined ? clampInt(Number(raw.qFontSize), 8, 36) : undefined,
    qFontWeight: raw.qFontWeight !== undefined ? String(raw.qFontWeight) : undefined,
    qTextColor: raw.qTextColor !== undefined ? String(raw.qTextColor) : '#1e293b',
    qLineHeight: raw.qLineHeight !== undefined ? Number(raw.qLineHeight) : 1.2,
    qLetterSpacing: raw.qLetterSpacing !== undefined ? Number(raw.qLetterSpacing) : undefined,
    qAlign: raw.qAlign as CompareCountsMiniAppContent['qAlign'],
    qIsBold: Boolean(raw.qIsBold),
    qIsItalic: Boolean(raw.qIsItalic),
    qIsUnderline: Boolean(raw.qIsUnderline),
    randomSymbolPositions: Boolean(raw.randomSymbolPositions),
  };
}

export const DEFAULT_COMPARE_COUNTS_MINI_APP: CompareCountsMiniAppContent = normalizeCompareCountsMiniApp({
  type: 'compare-counts',
  examples: [createEmptyExample()],
  showCenterSlot: true,
  showNumericRow: false,
  combineMultipleTypesPerSide: false,
  randomSymbolPositions: false,
  innerBorderColor: '#c4b5fd',
  innerBackground: '#ffffff',
  emojiSizePx: 32,
  emojiMinSizePx: 14,
  minHeightPx: COMPARE_COUNTS_DEFAULT_FIELD_HEIGHT,
  centerSlotSizePx: 34,
  textColor: '#1e293b',
  question: '',
  circleColor: '#1e293b',
  circleSize: 21,
  qTextColor: '#1e293b',
  qLineHeight: 1.2,
});

/** Odstavec s miniaplikací „porovnávání počtů“ se počítá jako aktivita (číslo v kroužku). */
export function isCompareCountsParagraphBlock(block: WorksheetBlock): boolean {
  if (block.type !== 'paragraph') return false;
  const mini = (block.content as ParagraphContent)?.miniApp;
  return mini?.type === 'compare-counts';
}

/** Horní mez vykresleného symbolu (px). */
const COMPARE_ICON_PX_CAP = 160;

/**
 * Horní odhad šířky „poloviny karty“ pro výpočet (px). Vyšší = větší symboly (užší padding + menší gap v packeru).
 */
const COMPARE_SIDE_OUTER_WIDTH_ESTIMATE_PX = 108;

/** Tvrdé minimum velikosti symbolu, když je potřeba vměstnat hodně kusů (pod uživatelským min). */
const COMPARE_PACK_HARD_MIN_PX = 8;

interface ComputePackedIconLayoutOptions {
  /** Rezerva kvůli náhodnému posunu/rotaci symbolů */
  randomJitter?: boolean;
}

/**
 * Velikost symbolu a mezera — všechny kusy se musí vejít do boxW×boxH (flex-wrap).
 * Snižuje s až na COMPARE_PACK_HARD_MIN_PX, aby se nic neořezávalo.
 */
function computePackedIconLayout(
  symbolCount: number,
  boxW: number,
  boxH: number,
  maxPx: number,
  minPx: number,
  options?: ComputePackedIconLayoutOptions
): { iconPx: number; gapPx: number } {
  const hi = Math.min(clampInt(maxPx, 16, 96), COMPARE_ICON_PX_CAP);
  void minPx; // preferované minimum ze slideru — při nutnosti vměstnat všechny symboly může být ikona menší

  if (symbolCount <= 0) {
    return { iconPx: hi, gapPx: 1 };
  }

  const jitterReserve = options?.randomJitter ? 4 : 0;
  const SAFETY = 2;
  const w = Math.max(36, boxW - jitterReserve - SAFETY / 2);
  const h = Math.max(28, boxH - jitterReserve - SAFETY / 2);

  /** Co nejmenší mezery mezi symboly → větší ikony při stejném počtu. Náhodně jen 1 px, jinak 1–2 px. */
  const GAP_MAX = options?.randomJitter ? 1 : 2;

  for (let s = hi; s >= COMPARE_PACK_HARD_MIN_PX; s--) {
    for (let gap = 1; gap <= GAP_MAX; gap++) {
      const maxCols = Math.max(1, Math.floor((w + gap) / (s + gap)));
      for (let cols = 1; cols <= maxCols; cols++) {
        const rows = Math.ceil(symbolCount / cols);
        const needW = cols * s + (cols - 1) * gap;
        const needH = rows * s + (rows - 1) * gap;
        if (needW <= w && needH <= h) {
          return { iconPx: s, gapPx: gap };
        }
      }
    }
  }
  return { iconPx: COMPARE_PACK_HARD_MIN_PX, gapPx: 1 };
}

function placeholderHtml(
  w: number,
  borderColorRaw: string,
  extraStyle: string
): string {
  const border = escapeHtml(borderColorRaw);
  const wn = clampInt(w, COMPARE_PACK_HARD_MIN_PX, COMPARE_ICON_PX_CAP);
  const extra = extraStyle ? extraStyle : '';
  return `<span class="vb-compare-sticker-cell vb-compare-symbol-placeholder" style="display:inline-flex;width:${wn}px;height:${wn}px;flex:0 0 auto;box-sizing:border-box;vertical-align:middle;align-items:center;justify-content:center;margin:0;padding:0;line-height:0;${extra}"><span style="display:block;width:100%;height:100%;border:1px solid ${border};border-radius:8px;opacity:0.22;box-sizing:border-box;background:rgba(148,163,184,0.06);"></span></span>`;
}

function spansForGroup(
  group: CompareCountsItemGroup,
  iconPx: number,
  placeholderBorderRaw: string,
  layout?: CompareCountsSymbolLayoutOpts
): string {
  const count = clampInt(group.count, 0, 40);
  if (count <= 0) return '';
  const stickerUrl = sanitizeStickerUrl(group.stickerUrl);
  const w = clampInt(iconPx, COMPARE_PACK_HARD_MIN_PX, COMPARE_ICON_PX_CAP);
  const seedBase =
    layout?.randomPositions && layout.exampleId
      ? `${layout.exampleId}|${layout.side}|g${layout.groupIndex}|s${layout.symbolIndexStart}`
      : '';

  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const jitter =
      layout?.randomPositions && seedBase ? randomTransformStyle(seedBase, i, w) : '';
    if (stickerUrl) {
      const safe = escapeHtml(stickerUrl);
      parts.push(
        `<span class="vb-compare-sticker-cell" style="display:inline-flex;width:${w}px;height:${w}px;flex:0 0 auto;box-sizing:border-box;vertical-align:middle;align-items:center;justify-content:center;margin:0;padding:0;line-height:0;${jitter}"><img src="${safe}" alt="" class="vb-compare-sticker" style="width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;display:block;margin:0;border:0;vertical-align:top;" loading="lazy" decoding="async" /></span>`
      );
    } else {
      parts.push(placeholderHtml(w, placeholderBorderRaw, jitter));
    }
  }
  return parts.join('');
}

function effectiveGroups(groups: CompareCountsItemGroup[], combine: boolean): CompareCountsItemGroup[] {
  if (combine) return groups.length ? groups : [createEmptyGroup()];
  const first = groups[0] ?? createEmptyGroup();
  return [first];
}

/**
 * Jedna svislice přesně uprostřed karty; bílý střední čtverec ji v pásu zakryje (linka jde od horního okraje k horní hraně čtverce a od spodní k dolnímu okraji).
 */
function buildCompareCenterAxisLine(border: string): string {
  return `<div class="vb-compare-center-axis" aria-hidden="true" style="position:absolute;left:50%;top:0;bottom:0;width:1px;margin-left:-0.5px;background:${border};z-index:0;pointer-events:none;"></div>`;
}

/** Bez středního čtverce: jedna plná svislice mezi dvěma polovinami (spolehlivě viditelná). */
function buildCompareVerticalSeparator(border: string): string {
  return `<div class="vb-compare-vertical-sep" aria-hidden="true" style="flex:0 0 1px;width:1px;min-width:1px;align-self:stretch;background:${border};"></div>`;
}

/**
 * Vlastní sloupec uprostřed — čtverec nepřekrývá symboly (ne absolute přes flex).
 */
function buildCenterSlotColumn(show: boolean, slot: number, border: string): string {
  if (!show) return '';
  const r = Math.max(7, Math.min(13, Math.round(slot * 0.34)));
  const box = `<div style="box-sizing:border-box;width:${slot}px;height:${slot}px;border-radius:${r}px;border:2px solid ${border};background:#ffffff;flex-shrink:0;box-shadow:0 1px 4px rgba(15,23,42,0.08);position:relative;z-index:1;" contenteditable="false" data-compare-slot="1" aria-label="Zápis větší menší rovná se"></div>`;
  return `<div class="vb-compare-center-slot-col" style="flex:0 0 ${slot}px;width:${slot}px;min-width:${slot}px;max-width:${slot}px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;align-self:center;padding:4px 0;position:relative;z-index:1;">
    ${box}
  </div>`;
}

function buildNumericRow(
  ex: CompareCountsExample,
  mini: CompareCountsMiniAppContent,
  border: string,
  color: string
): string {
  const combine = mini.combineMultipleTypesPerSide;
  const left = effectiveGroups(ex.leftGroups, combine);
  const right = effectiveGroups(ex.rightGroups, combine);
  const highlight = escapeHtml(mini.numericCompareHighlight || '#ede9fe');
  const b = border;
  const showSolution = mini.showNumericSolution !== false;
  const valueOpacity = showSolution ? 1 : 0;
  /** +10 % výška řádku / šířka „polí“ proti předchozímu základu */
  const NUM_FONT_PX = Math.round(24 * 1.1);
  const padNumV = Math.max(4, Math.round(4 * 1.1));
  const padNumH = Math.max(5, Math.round(6 * 1.1));
  const padOpV = Math.max(3, Math.round(3 * 1.1));
  const padOpH = Math.max(4, Math.round(5 * 1.1));
  const slotMinW = Math.round(36 * 1.1);
  const slotPadV = Math.max(4, Math.round(4 * 1.1));
  const slotPadH = Math.max(5, Math.round(6 * 1.1));
  const qPadV = padNumV;
  const qPadH = Math.max(6, Math.round(8 * 1.1));

  const font = `'Vividbooks Script','Comic Sans MS','Segoe Print',cursive`;
  const cellFont = `font-family:${font};font-size:${NUM_FONT_PX}px;line-height:1.1;font-weight:400;color:${color};`;
  const baseCellCore =
    `flex:0 0 auto;min-width:0;box-sizing:border-box;display:flex;align-items:center;justify-content:center;white-space:nowrap;${cellFont}`;
  const borderSep = `border-right:1px solid ${b};`;

  const valueSpan = (n: string) =>
    `<span class="vb-compare-num-value" style="opacity:${valueOpacity};transition:opacity 0.2s ease" aria-hidden="${showSolution ? 'false' : 'true'}">${escapeHtml(n)}</span>`;

  const numCell = (n: string, isOp: boolean | undefined, withRightSep: boolean) => {
    const pad = isOp ? `${padOpV}px ${padOpH}px` : `${padNumV}px ${padNumH}px`;
    const sep = withRightSep ? borderSep : '';
    return `<div class="vb-compare-num-cell${withRightSep ? '' : ' vb-compare-num-cell--last'}" style="${baseCellCore}${sep}padding:${pad};background:#ffffff;">${valueSpan(n)}</div>`;
  };

  type CellPiece =
    | { kind: 'num'; n: string; isOp?: boolean }
    | { kind: 'slot' }
    | { kind: 'q' };

  const pieces: CellPiece[] = [];
  left.forEach((g, i) => {
    pieces.push({ kind: 'num', n: String(clampInt(g.count, 0, 40)) });
    if (i < left.length - 1) pieces.push({ kind: 'num', n: '+', isOp: true });
  });
  if (mini.showCenterSlot) {
    pieces.push({ kind: 'slot' });
  } else {
    pieces.push({ kind: 'q' });
  }
  right.forEach((g, i) => {
    pieces.push({ kind: 'num', n: String(clampInt(g.count, 0, 40)) });
    if (i < right.length - 1) pieces.push({ kind: 'num', n: '+', isOp: true });
  });

  const parts = pieces.map((piece, idx) => {
    const withRightSep = idx < pieces.length - 1;
    if (piece.kind === 'num') {
      return numCell(piece.n, piece.isOp, withRightSep);
    }
    if (piece.kind === 'slot') {
      const sep = withRightSep ? borderSep : '';
      return `<div class="vb-compare-num-cell vb-compare-num-slot${withRightSep ? '' : ' vb-compare-num-cell--last'}" style="${baseCellCore}${sep}min-width:${slotMinW}px;padding:${slotPadV}px ${slotPadH}px;background:${highlight};" contenteditable="false" data-compare-slot="1" aria-label="Porovnání">&nbsp;</div>`;
    }
    const sep = withRightSep ? borderSep : '';
    return `<div class="vb-compare-num-cell${withRightSep ? '' : ' vb-compare-num-cell--last'}" style="${baseCellCore}${sep}padding:${qPadV}px ${qPadH}px;background:#f8fafc;">${valueSpan('?')}</div>`;
  });

  const rowInner = `<div class="vb-compare-numeric-row" data-vb-numeric-solution="${showSolution ? '1' : '0'}" style="display:inline-flex;flex-flow:row nowrap;align-items:stretch;width:max-content;max-width:100%;border:1px solid ${b};border-radius:10px;overflow:hidden;box-sizing:border-box;">${parts.join('')}</div>`;
  return `<div class="vb-compare-numeric-row-outer" style="margin-top:12px;display:flex;justify-content:center;width:100%;min-width:0;box-sizing:border-box;">${rowInner}</div>`;
}

function buildOneExampleCard(ex: CompareCountsExample, mini: CompareCountsMiniAppContent): string {
  const border = escapeHtml(mini.innerBorderColor);
  const bg = escapeHtml(mini.innerBackground);
  const color = escapeHtml(mini.textColor);
  const maxSymbolPx = clampInt(mini.emojiSizePx, 16, 96);
  const minSymbolPx = clampInt(mini.emojiMinSizePx ?? 14, 12, 96);
  const minH = clampInt(mini.minHeightPx, 64, 400);
  const slot = clampInt(mini.centerSlotSizePx, 24, 120);
  const combine = mini.combineMultipleTypesPerSide;
  const borderRaw = mini.innerBorderColor;

  const leftEff = effectiveGroups(ex.leftGroups, combine);
  const rightEff = effectiveGroups(ex.rightGroups, combine);

  const leftTotal = leftEff.reduce((s, g) => s + clampInt(g.count, 0, 40), 0);
  const rightTotal = rightEff.reduce((s, g) => s + clampInt(g.count, 0, 40), 0);

  const rand = !!mini.randomSymbolPositions;
  const gapFromCenter = 3;
  const sidePadOuter = 5;
  const sidePadVert = 3;
  /** Šířka obsahu v polovině karty po odečtení paddingu panu (konzervativní odhad vnější šířky). */
  const usableContentW = Math.max(
    36,
    COMPARE_SIDE_OUTER_WIDTH_ESTIMATE_PX - sidePadOuter - gapFromCenter
  );
  /** Rámeček pole 4px + svislý padding panu (sidePadVert×2); při náhodě menší rezerva na jitter */
  const innerBoxVerticalChrome = 4 + sidePadVert * 2;
  const innerBoxH = Math.max(28, minH - innerBoxVerticalChrome - (rand ? 4 : 0));

  const packOpts: ComputePackedIconLayoutOptions = { randomJitter: rand };
  const leftPack = computePackedIconLayout(
    leftTotal,
    usableContentW,
    innerBoxH,
    maxSymbolPx,
    minSymbolPx,
    packOpts
  );
  const rightPack = computePackedIconLayout(
    rightTotal,
    usableContentW,
    innerBoxH,
    maxSymbolPx,
    minSymbolPx,
    packOpts
  );
  const leftIconPx = leftPack.iconPx;
  const rightIconPx = rightPack.iconPx;
  let leftSym = 0;
  const leftSpans = leftEff
    .map((g, gi) => {
      const opts: CompareCountsSymbolLayoutOpts = {
        randomPositions: rand,
        exampleId: ex.id,
        side: 'L',
        groupIndex: gi,
        symbolIndexStart: leftSym,
      };
      const html = spansForGroup(g, leftIconPx, borderRaw, opts);
      leftSym += clampInt(g.count, 0, 40);
      return html;
    })
    .join('');

  let rightSym = 0;
  const rightSpans = rightEff
    .map((g, gi) => {
      const opts: CompareCountsSymbolLayoutOpts = {
        randomPositions: rand,
        exampleId: ex.id,
        side: 'R',
        groupIndex: gi,
        symbolIndexStart: rightSym,
      };
      const html = spansForGroup(g, rightIconPx, borderRaw, opts);
      rightSym += clampInt(g.count, 0, 40);
      return html;
    })
    .join('');

  const centerCol = buildCenterSlotColumn(mini.showCenterSlot, slot, border);

  /**
   * Boční panely: náhodné uskupení = center (těsný shluk, jen flex gap); jinak space-evenly přes polovinu.
   * Rohy panu sladěné s vnějším rámečkem (viz fieldBoxStyle overflow + radius).
   */
  const paneJustifyMain = rand ? 'center' : 'space-evenly';
  const INNER_RADIUS = 14;
  const sidePaneBase = (gapPx: number, cornerLeft: boolean) => {
    const rad = cornerLeft
      ? `border-top-left-radius:${INNER_RADIUS}px;border-bottom-left-radius:${INNER_RADIUS}px;`
      : `border-top-right-radius:${INNER_RADIUS}px;border-bottom-right-radius:${INNER_RADIUS}px;`;
    return `flex:1;min-width:0;height:100%;display:flex;flex-wrap:wrap;align-content:center;align-items:center;gap:${gapPx}px;row-gap:${gapPx}px;column-gap:${gapPx}px;box-sizing:border-box;min-height:0;position:relative;z-index:1;background:${bg};overflow:hidden;${rad}`;
  };
  const leftPaneWithSlot = `${sidePaneBase(leftPack.gapPx, true)}justify-content:${paneJustifyMain};padding:${sidePadVert}px ${gapFromCenter}px ${sidePadVert}px ${sidePadOuter}px;`;
  const rightPaneWithSlot = `${sidePaneBase(rightPack.gapPx, false)}justify-content:${paneJustifyMain};padding:${sidePadVert}px ${sidePadOuter}px ${sidePadVert}px ${gapFromCenter}px;`;
  const sidePaneNoSlotPlain = (gapPx: number, cornerLeft: boolean) =>
    `${sidePaneBase(gapPx, cornerLeft)}justify-content:${paneJustifyMain};padding:${sidePadVert}px ${sidePadOuter}px;`;

  const centerAxis = buildCompareCenterAxisLine(border);
  const verticalSep = buildCompareVerticalSeparator(border);

  /* overflow:hidden + border-radius — ostré rohy výplně uvnitř fialového rámečku; panely mají vlastní zaoblení boků */
  const fieldBoxStyle = `height:${minH}px;min-height:${minH}px;max-height:${minH}px;border-radius:16px;border:2px solid ${border};background:${bg};overflow:hidden;box-sizing:border-box;`;
  const visual = mini.showCenterSlot
    ? `<div class="vb-compare-counts-field" style="position:relative;display:flex;flex-direction:row;align-items:stretch;${fieldBoxStyle}">
    ${centerAxis}
    <div class="vb-compare-side-pane vb-compare-side-pane--left" style="${leftPaneWithSlot}">
      ${leftSpans}
    </div>
    ${centerCol}
    <div class="vb-compare-side-pane vb-compare-side-pane--right" style="${rightPaneWithSlot}">
      ${rightSpans}
    </div>
  </div>`
    : `<div class="vb-compare-counts-field" style="display:flex;flex-direction:row;align-items:stretch;${fieldBoxStyle}">
    <div class="vb-compare-side-pane vb-compare-side-pane--left" style="${sidePaneNoSlotPlain(leftPack.gapPx, true)}">
      ${leftSpans}
    </div>
    ${verticalSep}
    <div class="vb-compare-side-pane vb-compare-side-pane--right" style="${sidePaneNoSlotPlain(rightPack.gapPx, false)}">
      ${rightSpans}
    </div>
  </div>`;

  const numeric = mini.showNumericRow ? buildNumericRow(ex, mini, border, color) : '';

  return `<div class="vb-compare-counts-card" style="width:100%;min-width:0;">${visual}${numeric}</div>`;
}

/** Sestaví HTML z uložené konfigurace miniaplikace. */
export function buildCompareCountsHtml(miniRaw: Partial<CompareCountsMiniAppContent> | undefined): string {
  const mini = normalizeCompareCountsMiniApp((miniRaw ?? {}) as CompareCountsMiniAppContent);
  const cards = mini.examples.map((ex) => buildOneExampleCard(ex, mini)).join('');
  const grid = `<div class="vb-compare-counts-grid" style="display:grid;grid-template-columns:repeat(${COMPARE_COUNTS_GRID_COLUMNS},minmax(0,1fr));gap:16px;width:100%;align-items:start;">${cards}</div>`;
  return `<div class="vb-miniapp vb-compare-counts" style="color:${escapeHtml(mini.textColor)};" data-miniapp="compare-counts">${grid}</div>`;
}

/** Nový prázdný blok — jeden prázdný příklad. */
export function createCompareCountsParagraphBlock(gridSpan: number): WorksheetBlock {
  const miniApp = normalizeCompareCountsMiniApp({
    type: 'compare-counts',
    examples: [createEmptyExample()],
    showCenterSlot: true,
    showNumericRow: false,
    combineMultipleTypesPerSide: false,
    innerBorderColor: '#c4b5fd',
    innerBackground: '#ffffff',
    emojiSizePx: 32,
    emojiMinSizePx: 14,
    minHeightPx: COMPARE_COUNTS_DEFAULT_FIELD_HEIGHT,
    centerSlotSizePx: 34,
    textColor: '#1e293b',
    question: '',
    circleColor: '#1e293b',
    circleSize: 21,
    qTextColor: '#1e293b',
    qLineHeight: 1.2,
  });
  return {
    id: generateBlockId(),
    type: 'paragraph',
    order: 0,
    width: 'full',
    gridSpan,
    content: {
      html: buildCompareCountsHtml(miniApp),
      miniApp,
    },
    visualStyles: {
      displayPreset: 'custom',
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
      borderStyle: 'solid',
      borderRadius: 12,
      shadow: 'none',
    },
    marginBottom: 16,
    padding: 12,
  } as WorksheetBlock;
}

export function mergeCompareCountsMiniApp(
  prev: CompareCountsMiniAppContent | undefined,
  patch: Partial<CompareCountsMiniAppContent>
): CompareCountsMiniAppContent {
  return normalizeCompareCountsMiniApp({
    ...(prev ?? {}),
    ...patch,
  } as Record<string, unknown>);
}
