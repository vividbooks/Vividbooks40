/**
 * ScaledHtmlBlock
 *
 * Renders captured worksheet HTML at its natural capture width (read from
 * data-capture-width on the root element) and scales it uniformly so it fills
 * the available container as much as possible — exactly like a presentation
 * slide engine (PowerPoint, Google Slides).
 *
 * mode="contain"  → scale to fit all content, centred (default, for preview &
 *                   playback — shows 100 % of content, maximises size)
 * mode="scroll"   → fill width, scroll vertically (for editor panels)
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';

/** Fallback when data-capture-width is not present in the HTML. */
const FALLBACK_WIDTH = 700;

/** Extra padding (px) inside the container in contain mode. */
const DEFAULT_PADDING = 16;

interface ScaledHtmlBlockProps {
  html: string;
  mode?: 'contain' | 'scroll';
  padding?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function ScaledHtmlBlock({
  html,
  mode = 'contain',
  padding = DEFAULT_PADDING,
  className = '',
  style,
}: ScaledHtmlBlockProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [scrollHeight, setScrollHeight] = useState<number | null>(null);
  // The natural reference width — read from data-capture-width; tracked in both ref and state
  const refWidthRef = useRef<number>(FALLBACK_WIDTH);
  const [refWidth, setRefWidth] = useState<number>(FALLBACK_WIDTH);

  /** Read capture width from root element's data attribute and sync to state. */
  const readRefWidth = useCallback(() => {
    if (!contentRef.current) return;
    const root = contentRef.current.firstElementChild as HTMLElement | null;
    const w = root ? parseInt(root.getAttribute('data-capture-width') || '0', 10) : 0;
    const resolved = w > 0 ? w : FALLBACK_WIDTH;
    refWidthRef.current = resolved;
    setRefWidth(resolved);
  }, []);

  const recalculate = useCallback(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;

    // Ensure refWidth is populated
    readRefWidth();

    const refW = refWidthRef.current;
    const cW = wrapper.clientWidth;
    const cH = wrapper.clientHeight;
    if (!cW) return;
    // In contain mode, wait for a real container height — fallback ratios are unreliable
    if (mode === 'contain' && !cH) return;

    // Temporarily pin content to refW so scrollHeight measures correctly
    const inner = content.firstElementChild as HTMLElement | null;
    if (inner) inner.style.width = `${refW}px`;

    const naturalH = content.scrollHeight;
    if (!naturalH) return;

    if (mode === 'scroll') {
      const s = cW / refW;
      setScale(s);
      setOffsetX(0);
      setOffsetY(0);
      setScrollHeight(naturalH * s);
    } else {
      // Contain: maximise scale while keeping all content visible
      const usableW = cW - padding * 2;
      const usableH = cH - padding * 2;
      const scaleByW = usableW / refW;
      const scaleByH = usableH / naturalH;
      const s = Math.min(scaleByW, scaleByH);

      const scaledW = refW * s;
      const scaledH = naturalH * s;

      setScale(s);
      setOffsetX((cW - scaledW) / 2);
      setOffsetY(Math.max(padding, (cH - scaledH) / 2));
      setScrollHeight(null);
    }
  }, [mode, padding, readRefWidth]);

  // Recalculate whenever the container resizes
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => recalculate());
    ro.observe(el);
    return () => ro.disconnect();
  }, [recalculate]);

  // Recalculate when HTML or fonts change (fonts affect text metrics)
  useEffect(() => {
    recalculate();
    document.fonts.ready.then(() => recalculate());
  }, [html, recalculate]);

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: mode === 'scroll' ? 'auto' : 'hidden',
        ...style,
      }}
    >
      {/* Scroll-mode height spacer */}
      {mode === 'scroll' && scrollHeight !== null && (
        <div style={{ height: scrollHeight, width: 1, pointerEvents: 'none' }} />
      )}

      {/* Content: rendered at capture width, then scaled + positioned */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: refWidth,
          transformOrigin: 'top left',
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          pointerEvents: 'none',
        }}
      >
        <div
          ref={contentRef}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
