/**
 * Vodící tečky u písanky — měření přes DOM Range + opakování vzoru po řádku.
 * Musí být v prohlížeči (fonty); vrstva se vkládá do .vb-pisanka-trace-wrap.
 */

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { PisankaGuideAnchor, PisankaMiniAppContent } from '../../types/worksheet';
import { buildGuideUnits } from '../../utils/mini-apps/pisanka-guide-dots';
import {
  loadResolvedGuideDotsDevForRow,
  PISANKA_GUIDE_DOTS_DEV_CHANGED,
} from '../../utils/mini-apps/pisanka-guide-dots-dev';

const LAYER_CLASS = 'vb-pisanka-guide-dots-layer';
const DOT_CLASS = 'vb-pisanka-guide-dot';

/** První textový uzel uvnitř předpisu (kvůli případnému značkování). */
function getTraceTextNode(trace: HTMLElement): Text | null {
  const w = document.createTreeWalker(trace, NodeFilter.SHOW_TEXT);
  const n = w.nextNode();
  return n as Text | null;
}

function yForAnchor(traceWrap: HTMLElement, rowCore: HTMLElement, anchor: PisankaGuideAnchor): number {
  const w = traceWrap.getBoundingClientRect();
  const pick = (el: Element | null, part: 'c' | 't' | 'b') => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const y = part === 'c' ? r.top + r.height / 2 : part === 't' ? r.top : r.bottom;
    return y - w.top;
  };
  const baselineRule = rowCore.querySelector('.vb-pisanka-rule--baseline');
  const zoneStredni = rowCore.querySelector('.vb-pisanka-zone--stredni');
  const zoneHorni = rowCore.querySelector('.vb-pisanka-zone--horni');
  const hairTop = rowCore.querySelector('.vb-pisanka-hair--top');

  switch (anchor) {
    case 'baseline':
      return pick(baselineRule, 'c') ?? w.height * 0.22;
    case 'bandTop':
      return pick(zoneStredni, 't') ?? w.height * 0.42;
    case 'ascender':
      return pick(zoneHorni, 'b') ?? w.height * 0.58;
    case 'capTop':
      return pick(hairTop, 'b') ?? pick(zoneHorni, 't') ?? w.height * 0.78;
    default:
      return w.height * 0.22;
  }
}

function rangeLeftInWrap(traceWrap: HTMLElement, textNode: Text, offset: number): number {
  const len = textNode.length;
  const o = Math.max(0, Math.min(offset, len));
  const range = document.createRange();
  range.setStart(textNode, o);
  range.setEnd(textNode, o);
  const r = range.getBoundingClientRect();
  const w = traceWrap.getBoundingClientRect();
  return r.left - w.left;
}

/**
 * U vázaného písma se obvykle „nástřikuje“ těsně před viditelný začátek tahu (vstupní bod na lince,
 * mírně vlevo od tělesa glyfu) — tečku posuneme doleva úměrně velikosti předpisu.
 */
function strokeLeadInPx(traceEl: HTMLElement): number {
  const fs = parseFloat(getComputedStyle(traceEl).fontSize);
  if (!Number.isFinite(fs) || fs <= 0) return 8;
  return Math.max(5, Math.min(18, fs * 0.09));
}

function paintLayer(root: HTMLElement, mini: PisankaMiniAppContent) {
  root.querySelectorAll(`.${LAYER_CLASS}`).forEach((el) => el.remove());

  const rowEls = root.querySelectorAll<HTMLElement>('.vb-pisanka-row');
  rowEls.forEach((rowEl, rowIndex) => {
    const row = mini.rows[rowIndex];
    if (!row?.text?.trim() || row.guideDots !== 'on') return;

    const core = rowEl.querySelector('.vb-pisanka-row-core') as HTMLElement | null;
    const wrap = rowEl.querySelector('.vb-pisanka-trace-wrap') as HTMLElement | null;
    const trace = rowEl.querySelector('.vb-pisanka-trace:not(.vb-pisanka-trace--empty)') as HTMLElement | null;
    if (!core || !wrap || !trace) return;

    const textNode = getTraceTextNode(trace);
    if (!textNode || !textNode.length) return;
    const norm = (s: string) => s.replace(/\u00a0/g, ' ').normalize('NFC');
    if (norm(textNode.textContent ?? '') !== norm(row.text)) {
      return;
    }

    const units = buildGuideUnits(row.text);
    if (units.length === 0) return;

    const layer = document.createElement('div');
    layer.className = LAYER_CLASS;
    layer.setAttribute('aria-hidden', 'true');
    wrap.appendChild(layer);

    const maxX = wrap.clientWidth - 4;
    const yCache = new Map<PisankaGuideAnchor, number>();

    const yOf = (a: PisankaGuideAnchor) => {
      if (!yCache.has(a)) yCache.set(a, yForAnchor(wrap, core, a));
      return yCache.get(a)!;
    };

    const dev = loadResolvedGuideDotsDevForRow(row.text);
    const leadIn = strokeLeadInPx(trace) * dev.leadInMul;
    const xs0 = units.map((u) => rangeLeftInWrap(wrap, textNode, u.startIndex) - leadIn);

    let xStart = rangeLeftInWrap(wrap, textNode, 0);
    let xEnd = rangeLeftInWrap(wrap, textNode, row.text.length);
    if (!Number.isFinite(xEnd - xStart) || xEnd - xStart < 2) {
      const tr = trace.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      xStart = tr.left - wr.left;
      xEnd = xStart + tr.width;
    }
    const cycleW = Math.max(8, xEnd - xStart);
    const gap = Math.max(6, cycleW * 0.1);
    /** Mezera mezi opakováními o ~20 % větší než dřív; dev.stepMul dál násobí. */
    const step = (cycleW + gap) * 1.2 * dev.stepMul;

    const minX = 2;
    for (let k = 0; k < 400; k++) {
      let placed = 0;
      for (let i = 0; i < units.length; i++) {
        const x = Math.max(minX, xs0[i] + k * step + dev.offsetXPx);
        if (x > maxX) continue;
        placed++;
        const dot = document.createElement('span');
        dot.className = `${DOT_CLASS} ${DOT_CLASS}--${units[i].anchor}`;
        dot.style.left = `${x}px`;
        dot.style.top = `${yOf(units[i].anchor) + dev.offsetYPx}px`;
        layer.appendChild(dot);
      }
      if (placed === 0) break;
    }
  });
}

export function PisankaGuideDotsLayer({
  rootRef,
  mini,
}: {
  rootRef: React.RefObject<HTMLElement | null>;
  mini: PisankaMiniAppContent;
}) {
  const miniKey = JSON.stringify(
    mini.rows.map(
      (r) =>
        [r.text, r.guideDots === 'on', r.traceFont, r.showMascot === true, r.showStartPencil === true] as const,
    ),
  );
  const rafRef = useRef<number>(0);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const run = () => {
      paintLayer(root, mini);
    };

    run();
    rafRef.current = requestAnimationFrame(() => {
      run();
    });

    const ro = new ResizeObserver(() => run());
    ro.observe(root);

    const onDevChanged = () => run();
    window.addEventListener(PISANKA_GUIDE_DOTS_DEV_CHANGED, onDevChanged);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener(PISANKA_GUIDE_DOTS_DEV_CHANGED, onDevChanged);
      root.querySelectorAll(`.${LAYER_CLASS}`).forEach((el) => el.remove());
    };
  }, [rootRef, miniKey, mini]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof document === 'undefined' || !document.fonts?.ready) return;
    let alive = true;
    void document.fonts.ready.then(() => {
      if (alive) paintLayer(root, mini);
    });
    return () => {
      alive = false;
    };
  }, [rootRef, miniKey, mini]);

  return null;
}
