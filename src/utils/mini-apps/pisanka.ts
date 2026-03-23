/**
 * Miniaplikace: česká písanka (odstavec + miniApp + generované HTML).
 * Vázané psaní — linky dle šablony, předepsaný text (Vividbooks Script), volitelný nadpis (Cooper Light).
 */

import type {
  ParagraphContent,
  PisankaLinePattern,
  PisankaLineTemplate,
  PisankaMiniAppContent,
  PisankaRowItem,
  PisankaTraceFont,
  PisankaScriptMode,
  WorksheetBlock,
} from '../../types/worksheet';
import { generateBlockId } from '../../types/worksheet';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Každá ze 3 částí řádku (horní / střední / spodní): 0,8 cm nebo 0,6 cm */
function templateToSegmentHeight(template: PisankaLineTemplate): string {
  return template === '3x06' ? '0.6cm' : '0.8cm';
}

const DEFAULT_THIN = '#93c5fd';
const DEFAULT_THICK = '#2563eb';
const DEFAULT_BAND = 'rgba(147, 197, 253, 0.35)';
/** Předepsaný text — 100 % krytí, tmavě modrá (sladěno s tlustými linkami) */
const DEFAULT_TRACE = '#1e40af';

/** Zajistí plnou neprůhlednost: rgba/hsla se čtvrtou složkou alpha menší než 1 → DEFAULT_TRACE. */
function normalizePisankaTraceColor(input: string): string {
  const s = input.trim();
  if (!s) return DEFAULT_TRACE;

  if (/^rgba\s*\(/i.test(s)) {
    const inner = s.slice(s.indexOf('(') + 1, s.lastIndexOf(')'));
    const parts = inner.split(',').map((p) => p.trim());
    if (parts.length >= 4) {
      const a = parseFloat(parts[3]);
      if (!Number.isNaN(a) && a < 1) return DEFAULT_TRACE;
    }
  }

  if (/^hsla\s*\(/i.test(s)) {
    const inner = s.slice(s.indexOf('(') + 1, s.lastIndexOf(')'));
    const parts = inner.split(',').map((p) => p.trim());
    if (parts.length >= 4) {
      const last = parts[3];
      let a = parseFloat(last);
      if (last.includes('%')) a = a / 100;
      if (!Number.isNaN(a) && a < 1) return DEFAULT_TRACE;
    }
  }

  // rgb( r g b / a )
  if (/^rgba?\s*\(/i.test(s) && s.includes('/')) {
    const m = s.match(/\/\s*([\d.]+)\s*\)/);
    if (m) {
      const a = parseFloat(m[1]);
      if (!Number.isNaN(a) && a < 1) return DEFAULT_TRACE;
    }
  }

  // #RRGGBBAA
  if (/^#[0-9a-f]{8}$/i.test(s)) {
    const aByte = parseInt(s.slice(7, 9), 16);
    if (!Number.isNaN(aByte) && aByte < 255) return `#${s.slice(1, 7)}`;
  }

  return s;
}

const DEFAULT_ROW_GAP_PX = 56;
const DEFAULT_PAGE_INSET_PX = 0;

function normalizeTraceFont(raw: unknown): PisankaTraceFont {
  return raw === 'cooper' ? 'cooper' : 'vividbooks';
}

/** Bez base64 / javascript: v URL obrázku řádku */
export function sanitizePisankaRowImageUrl(url: string | undefined | null): string | undefined {
  if (url == null) return undefined;
  const u = String(url).trim();
  if (!u) return undefined;
  if (u.startsWith('data:') || /^\s*javascript:/i.test(u)) return undefined;
  if (/^https?:\/\//i.test(u) || u.startsWith('/')) return u;
  return undefined;
}

function normalizePisankaRowEntry(raw: unknown): PisankaRowItem {
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const text = o.text !== undefined ? String(o.text) : '';
    const traceFont = normalizeTraceFont(o.traceFont);
    const imageUrl = sanitizePisankaRowImageUrl(
      o.imageUrl !== undefined && o.imageUrl !== null ? String(o.imageUrl) : undefined
    );
    const base: PisankaRowItem = { text, traceFont };
    if (o.allowRowImage === false) {
      base.allowRowImage = false;
    } else if (o.allowRowImage === true || imageUrl) {
      base.allowRowImage = true;
    }
    if (imageUrl) {
      base.imageUrl = imageUrl;
      if (o.imageEnabled === false) base.imageEnabled = false;
      else if (o.imageEnabled === true) base.imageEnabled = true;
    }
    if (o.showMascot === true) base.showMascot = true;
    else if (o.showMascot === false) base.showMascot = false;
    if (o.showStartPencil === true) base.showStartPencil = true;
    else if (o.showStartPencil === false) base.showStartPencil = false;
    if (
      o.guideDots === 'on' ||
      o.guideDots === 'letters' ||
      o.guideDots === 'syllables' ||
      o.guideDots === 'words'
    ) {
      base.guideDots = 'on';
    }
    return base;
  }
  return { text: String(raw ?? ''), traceFont: 'vividbooks' };
}

/** Veřejná cesta k SVG panáčka (s ohledem na Vite BASE_URL). */
export function getPisankaMascotSrc(): string {
  const base =
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL != null
      ? String(import.meta.env.BASE_URL)
      : '/';
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return `${normalized}pisanka-mascot.svg`;
}

/** Veřejná cesta k SVG tužky „začni psát tady“. */
export function getPisankaStartPencilSrc(): string {
  const base =
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL != null
      ? String(import.meta.env.BASE_URL)
      : '/';
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return `${normalized}pisanka-start-pencil.svg`;
}

function rowShowsBackgroundImage(row: PisankaRowItem): boolean {
  const url = row.imageUrl ? sanitizePisankaRowImageUrl(row.imageUrl) : undefined;
  if (!url) return false;
  return row.imageEnabled !== false;
}

type PisankaTraceTuning = {
  traceFontMul: number;
  tracePadExtraPx: number;
};

/** Výchozí ladění předpisu podle šablony (3×0,8 cm vs 3×0,6 cm). */
function traceTuningForTemplate(template: PisankaLineTemplate): PisankaTraceTuning {
  if (template === '3x06') {
    return { traceFontMul: 2.95, tracePadExtraPx: -16 };
  }
  return { traceFontMul: 2.95, tracePadExtraPx: -21 };
}

function normalizeLinePattern(raw: unknown): PisankaLinePattern {
  if (raw === '2' || raw === 2) return '2';
  if (raw === '3' || raw === 3) return '3';
  return '1';
}

/**
 * Vzor 2 nemá spodní část řádku — padding předpisu musí dorovnat odpovídající výšku,
 * aby text seděl na základní lince (stejně jako u plného vzoru).
 */
function traceTuningWithPattern(
  template: PisankaLineTemplate,
  pattern: PisankaLinePattern
): PisankaTraceTuning {
  const base = traceTuningForTemplate(template);
  if (pattern !== '2') return base;
  const bump = template === '3x06' ? 26 : 32;
  return { ...base, tracePadExtraPx: base.tracePadExtraPx + bump };
}

export function normalizePisankaMiniApp(
  raw: Partial<PisankaMiniAppContent> & Record<string, unknown>
): PisankaMiniAppContent {
  const scriptMode: PisankaScriptMode =
    raw.scriptMode === 'nevazane' ? 'nevazane' : 'vazane';
  const lineTemplate: PisankaLineTemplate =
    raw.lineTemplate === '3x06' ? '3x06' : '3x08';
  const linePattern = normalizeLinePattern(raw.linePattern);

  let rows: PisankaRowItem[] = [];
  if (Array.isArray(raw.rows)) {
    rows = raw.rows.slice(0, 40).map((r) => normalizePisankaRowEntry(r));
  } else if (typeof raw.rows === 'string') {
    rows = String(raw.rows)
      .split(/\n/)
      .slice(0, 40)
      .map((line) => ({ text: line, traceFont: 'vividbooks' as const }));
  }
  if (rows.length === 0) {
    rows = [
      { text: 'dává', traceFont: 'vividbooks' },
      { text: 'dusí', traceFont: 'vividbooks' },
      { text: '', traceFont: 'vividbooks' },
      { text: 'dáma', traceFont: 'vividbooks' },
      { text: 'dupe', traceFont: 'vividbooks' },
    ];
  }

  let rowGapPx = DEFAULT_ROW_GAP_PX;
  if (typeof raw.rowGapPx === 'number' && Number.isFinite(raw.rowGapPx)) {
    rowGapPx = Math.min(200, Math.max(8, Math.round(raw.rowGapPx)));
  }
  let pageInsetPx = DEFAULT_PAGE_INSET_PX;
  if (typeof raw.pageInsetPx === 'number' && Number.isFinite(raw.pageInsetPx)) {
    pageInsetPx = Math.min(48, Math.max(0, Math.round(raw.pageInsetPx)));
  }

  const base: PisankaMiniAppContent = {
    type: 'pisanka',
    scriptMode,
    lineTemplate,
    linePattern,
    rows,
    title: raw.title !== undefined ? String(raw.title) : '',
    lineThin: String(raw.lineThin ?? DEFAULT_THIN),
    lineThick: String(raw.lineThick ?? DEFAULT_THICK),
    bandFill: String(raw.bandFill ?? DEFAULT_BAND),
    traceColor: normalizePisankaTraceColor(String(raw.traceColor ?? DEFAULT_TRACE)),
    rowGapPx,
    pageInsetPx,
  };
  return base;
}

export function mergePisankaMiniApp(
  prev: PisankaMiniAppContent | undefined,
  patch: Partial<PisankaMiniAppContent>
): PisankaMiniAppContent {
  return normalizePisankaMiniApp({
    ...(prev ?? {}),
    ...patch,
  } as Record<string, unknown>);
}

export function isPisankaParagraphBlock(block: WorksheetBlock): boolean {
  if (block.type !== 'paragraph') return false;
  const mini = (block.content as ParagraphContent)?.miniApp;
  return mini?.type === 'pisanka';
}

function traceFontStack(traceFont: PisankaTraceFont): string {
  return traceFont === 'cooper' ? `'Cooper Light', serif` : `'Vividbooks Script', cursive`;
}

function buildPisankaRow(
  row: PisankaRowItem,
  segmentHeight: string,
  thin: string,
  thick: string,
  band: string,
  trace: string,
  tuning: PisankaTraceTuning
): string {
  const lineText = row.text;
  const fontTrace = traceFontStack(row.traceFont);
  const traceClass =
    row.traceFont === 'cooper'
      ? 'vb-pisanka-trace vb-pisanka-trace--cooper'
      : 'vb-pisanka-trace vb-pisanka-trace--vividbooks';
  const safeText = escapeHtml(lineText);
  const isEmpty = !lineText.trim();
  const mul = tuning.traceFontMul;
  const padPx = tuning.tracePadExtraPx;
  const vars = `--pisanka-seg:${segmentHeight};--pisanka-thin:${escapeHtml(thin)};--pisanka-thick:${escapeHtml(thick)};--pisanka-band:${escapeHtml(band)};--pisanka-trace:${escapeHtml(trace)};--pisanka-trace-mul:${mul};--pisanka-trace-pad-extra:${padPx}px;`;

  const safeImg = row.imageUrl ? sanitizePisankaRowImageUrl(row.imageUrl) : undefined;
  const showBg = rowShowsBackgroundImage(row);
  const bgHtml =
    showBg && safeImg
      ? `<div class="vb-pisanka-row-bg" aria-hidden="true"><img class="vb-pisanka-row-bg-img" src="${escapeHtml(safeImg)}" alt="" loading="lazy" decoding="async" /></div>`
      : '';

  const traceSpan = isEmpty
    ? `<span class="vb-pisanka-trace vb-pisanka-trace--empty">&nbsp;</span>`
    : `<span class="${traceClass}" style="font-family:${fontTrace};color:var(--pisanka-trace);">${safeText}</span>`;

  const mascotSrc = escapeHtml(getPisankaMascotSrc());
  const mascotHtml =
    row.showMascot === true
      ? `<div class="vb-pisanka-row-mascot" aria-hidden="true"><img class="vb-pisanka-mascot-img" src="${mascotSrc}" width="31" height="75" alt="" /></div>`
      : '';
  const pencilSrc = escapeHtml(getPisankaStartPencilSrc());
  const showPencil = row.showStartPencil === true;
  const pencilHtml = showPencil
    ? `<div class="vb-pisanka-start-pencil" aria-hidden="true"><img class="vb-pisanka-start-pencil-img" src="${pencilSrc}" width="41" height="41" alt="" /></div>`
    : '';
  const rowMod = [
    row.showMascot === true ? 'vb-pisanka-row--mascot' : '',
    showPencil ? 'vb-pisanka-row--start-pencil' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const rowClassMod = rowMod ? ` ${rowMod}` : '';

  return `<div class="vb-pisanka-row${rowClassMod}" style="${vars}">
  ${mascotHtml}
  <div class="vb-pisanka-row-core">
  ${bgHtml}
  <div class="vb-pisanka-rail" aria-hidden="true">
    <div class="vb-pisanka-hair vb-pisanka-hair--top"></div>
    <div class="vb-pisanka-zone vb-pisanka-zone--horni" title="Horní část"></div>
    <div class="vb-pisanka-rule vb-pisanka-rule--thick"></div>
    <div class="vb-pisanka-zone vb-pisanka-zone--stredni" title="Střední část"></div>
    <div class="vb-pisanka-rule vb-pisanka-rule--thick vb-pisanka-rule--baseline"></div>
    <div class="vb-pisanka-zone vb-pisanka-zone--spodni" title="Spodní část"></div>
    <div class="vb-pisanka-hair vb-pisanka-hair--bottom"></div>
  </div>
  <div class="vb-pisanka-trace-wrap">
    ${pencilHtml}
    ${traceSpan}
  </div>
  </div>
</div>`;
}

export function buildPisankaHtml(miniRaw: Partial<PisankaMiniAppContent> | undefined): string {
  const mini = normalizePisankaMiniApp((miniRaw ?? {}) as PisankaMiniAppContent);
  const seg = templateToSegmentHeight(mini.lineTemplate);
  const thin = mini.lineThin;
  const thick = mini.lineThick;
  const band = mini.bandFill;
  const trace = mini.traceColor;
  const tuning = traceTuningWithPattern(mini.lineTemplate, mini.linePattern ?? '1');

  const rowsHtml = mini.rows.map((r) => buildPisankaRow(r, seg, thin, thick, band, trace, tuning)).join('');

  const title = mini.title?.trim();
  const titleHtml = title
    ? `<div class="vb-pisanka-heading" style="font-family:'Cooper Light',serif;font-size:clamp(18px,2.8vw,26px);font-weight:400;color:#1e3a5f;margin:0 0 14px 0;line-height:1.2;">${escapeHtml(title)}</div>`
    : '';

  const rowGapPx = mini.rowGapPx ?? DEFAULT_ROW_GAP_PX;
  const pageInsetPx = mini.pageInsetPx ?? DEFAULT_PAGE_INSET_PX;
  const layoutVars = `--pisanka-rows-gap:${rowGapPx}px;--pisanka-page-pad-x:${pageInsetPx}px;`;

  const pat = mini.linePattern ?? '1';
  return `<div class="vb-miniapp vb-pisanka" data-miniapp="pisanka" data-pisanka-template="${mini.lineTemplate}" data-pisanka-line-pattern="${pat}" data-pisanka-mode="${mini.scriptMode}" style="${layoutVars}">
  <div class="vb-pisanka-page">
    ${titleHtml}
    <div class="vb-pisanka-rows">${rowsHtml}</div>
  </div>
</div>`;
}

export function createPisankaParagraphBlock(gridSpan: number): WorksheetBlock {
  const miniApp = normalizePisankaMiniApp({
    type: 'pisanka',
    scriptMode: 'vazane',
    lineTemplate: '3x08',
    rows: [
      { text: 'dává', traceFont: 'vividbooks' },
      { text: 'dusí', traceFont: 'vividbooks' },
      { text: '', traceFont: 'vividbooks' },
      { text: 'dáma', traceFont: 'vividbooks' },
      { text: 'dupe', traceFont: 'vividbooks' },
    ],
    title: 'Písanka — vázané',
  });
  return {
    id: generateBlockId(),
    type: 'paragraph',
    order: 0,
    width: 'full',
    gridSpan,
    content: {
      html: buildPisankaHtml(miniApp),
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
    padding: 0,
  } as WorksheetBlock;
}
