/**
 * PrintGridCanvas – pixel-perfect read-only render of a Worksheet for PDF export.
 *
 * Uses the EXACT same components as the live editor (EditableBlock, PageHeader,
 * PageFooter, same CSS Grid logic and pagination) but without any interactivity.
 *
 * The `onStable` callback fires once the ResizeObserver measurements have
 * stabilised (two consecutive identical height maps), signalling that the layout
 * is ready for PDF capture.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Worksheet, WorksheetBlock, GlobalFontSize, GridColumns, PageHeaderConfig, PageFooterConfig } from '../../types/worksheet';
import { EditableBlock } from '../worksheet-editor/EditableBlock';
import { PageHeader, PageFooter } from './PageHeaderFooter';
import {
  PAGE_DIMENSIONS,
  CONTENT_PADDING_H,
  getContentHeight,
  getContentPaddingV,
  getGridGapPx,
  type PageFormat,
} from '../../utils/page-layout';

interface PrintGridCanvasProps {
  worksheet: Worksheet;
  onStable?: () => void;
}

export function PrintGridCanvas({ worksheet, onStable }: PrintGridCanvasProps) {
  const blocks         = worksheet.blocks || [];
  const pageFormat     = (worksheet.metadata?.pageFormat as PageFormat) || 'a4';
  const gridColumns    = (worksheet.metadata?.gridColumns as GridColumns) || 12;
  const globalFontSize = (worksheet.metadata?.globalFontSize as GlobalFontSize) || 'normal';
  const pageBackgroundColor = (worksheet.metadata?.pageBackgroundColor as string) || '#FFFFFF';
  const pageHeader: PageHeaderConfig | undefined = worksheet.metadata?.pageHeader as PageHeaderConfig | undefined;
  const pageFooter: PageFooterConfig | undefined = worksheet.metadata?.pageFooter as PageFooterConfig | undefined;

  const gridGapPx = getGridGapPx(worksheet.metadata?.gridGap as string);

  const pageWidth  = PAGE_DIMENSIONS[pageFormat]?.width  || PAGE_DIMENSIONS.a4.width;
  const pageHeight = PAGE_DIMENSIONS[pageFormat]?.height || PAGE_DIMENSIONS.a4.height;
  const contentHeight = getContentHeight(pageFormat, pageHeader, pageFooter);
  const { top: padTop, bottom: padBot } = getContentPaddingV(pageHeader, pageFooter);

  // ── Measure block heights with robust ResizeObserver ────────────────────────
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    observerRef.current = new ResizeObserver((entries) => {
      setBlockHeights((prev) => {
        let changed = false;
        const next = { ...prev };
        entries.forEach((entry) => {
          const blockId = (entry.target as HTMLElement).dataset.blockId;
          if (blockId) {
            let h = 0;
            if (entry.borderBoxSize && entry.borderBoxSize.length > 0) {
              h = entry.borderBoxSize[0].blockSize;
            } else {
              h = entry.contentRect.height;
            }
            if (next[blockId] !== h) {
              next[blockId] = h;
              changed = true;
            }
          }
        });
        return changed ? next : prev;
      });
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  const blockRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (node && observerRef.current) {
      observerRef.current.observe(node);
    }
  }, []);

  // ── Stabilisation detection ───────────────────────────────────────────────
  // Uses a debounce timer: after each blockHeights change, wait 400 ms. If no
  // further change occurs, the layout is considered stable. This handles both
  // single-render and multi-render scenarios correctly.
  const didSignalRef    = useRef(false);
  const onStableRef     = useRef(onStable);
  onStableRef.current   = onStable;
  const timerRef        = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (didSignalRef.current) return;
    const hasBlocks = Object.keys(blockHeights).length > 0 || blocks.length === 0;
    if (!hasBlocks) return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!didSignalRef.current) {
        didSignalRef.current = true;
        onStableRef.current?.();
      }
    }, 400);

    return () => clearTimeout(timerRef.current);
  }, [blockHeights, blocks.length]);

  // ── Activity numbers ──────────────────────────────────────────────────────
  const activityNumbers = useMemo(() => {
    const nums: Record<string, number> = {};
    let counter = 1;
    blocks.forEach((block) => {
      if (
        ['multiple-choice', 'fill-blank', 'free-answer', 'matching', 'ordering', 'free-canvas'].includes(block.type) &&
        !block.noActivityNumber
      ) {
        nums[block.id] = counter++;
      }
    });
    return nums;
  }, [blocks]);

  // ── Pagination (identical algorithm to GridCanvas) ────────────────────────
  const pagesData = useMemo(() => {
    // Krok 1: Seskupit bloky do řádků
    const rows: { blocks: WorksheetBlock[]; height: number }[] = [];
    let currentRow: WorksheetBlock[] = [];
    let currentRowSpan = 0;
    let currentRowHeight = 0;

    blocks.forEach((block) => {
      // marginBottom je již započítán ve fyzické výšce bloku z ResizeObserveru
      // (EditableBlock si sám renderuje spacer pro marginBottom)
      const blockHeight = blockHeights[block.id] || 100;
      const isFullscreenFigma = block.type === 'free-canvas' && (block.content as any).fullscreen;
      const blockGridSpan = isFullscreenFigma ? gridColumns : (block.gridSpan || gridColumns);
      
      if (currentRowSpan + blockGridSpan > gridColumns) {
        if (currentRow.length > 0) {
          rows.push({ blocks: currentRow, height: currentRowHeight });
        }
        currentRow = [];
        currentRowSpan = 0;
        currentRowHeight = 0;
      }

      currentRow.push(block);
      currentRowSpan += blockGridSpan;
      currentRowHeight = Math.max(currentRowHeight, blockHeight);
    });
    if (currentRow.length > 0) {
      rows.push({ blocks: currentRow, height: currentRowHeight });
    }

    // Krok 2: Stránkování podle řádků
    const pages: { blocks: WorksheetBlock[]; pageNumber: number }[] = [];
    let currentPageBlocks: WorksheetBlock[] = [];
    let currentHeight = 0;
    let pageNumber = 1;

    rows.forEach((row) => {
      if (currentHeight + row.height > contentHeight && currentPageBlocks.length > 0) {
        pages.push({ blocks: currentPageBlocks, pageNumber });
        currentPageBlocks = [];
        currentHeight = 0;
        pageNumber++;
      }

      currentPageBlocks.push(...row.blocks);
      currentHeight += row.height + gridGapPx;
    });

    if (currentPageBlocks.length > 0 || blocks.length === 0) {
      pages.push({ blocks: currentPageBlocks, pageNumber });
    }

    return pages;
  }, [blocks, blockHeights, contentHeight, gridColumns, gridGapPx]);

  // Noop handlers for read-only EditableBlock
  const noop = useCallback(() => {}, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ width: `${pageWidth}px`, margin: '0 auto' }}>
      {pagesData.map((page, pageIndex) => (
        <div
          key={pageIndex}
          className="a4-page"
          style={{
            width:           `${pageWidth}px`,
            height:          `${pageHeight}px`,
            backgroundColor: pageBackgroundColor,
            overflow:        'hidden',
            display:         'flex',
            flexDirection:   'column',
            boxShadow:       'none',
            pageBreakAfter:  pageIndex < pagesData.length - 1 ? 'always' : 'auto',
            breakAfter:      pageIndex < pagesData.length - 1 ? 'page' as any : 'auto',
          }}
        >
          {/* Header */}
          <PageHeader config={pageHeader} padding={CONTENT_PADDING_H} style={{ flexShrink: 0 }} />

          {/* Content grid */}
          <div
            style={{
              paddingLeft:         CONTENT_PADDING_H,
              paddingRight:        CONTENT_PADDING_H,
              paddingTop:          padTop,
              paddingBottom:       padBot,
              flex:                1,
              minHeight:           0,
              overflow:            'hidden',
              display:             'grid',
              gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
              gap:                 `${gridGapPx}px`,
              alignItems:          'start',
              alignContent:        'start',
            }}
          >
            {page.blocks.map((block) => {
              const isFullscreenFigma = block.type === 'free-canvas' && (block.content as any).fullscreen;
              const blockGridSpan     = isFullscreenFigma ? gridColumns : (block.gridSpan || gridColumns);
              const blockForRender    = isFullscreenFigma
                ? { ...block, content: { ...(block.content as any), canvasHeight: contentHeight } }
                : block;

              return (
                <div
                  key={block.id}
                  data-block-id={block.id}
                  ref={blockRefCallback}
                  style={{
                    gridColumn:   `span ${blockGridSpan}`,
                    minWidth:     0,
                  }}
                >
                  <EditableBlock
                    block={blockForRender}
                    isSelected={false}
                    onSelect={noop}
                    onUpdate={noop}
                    activityNumber={activityNumbers[block.id]}
                    globalFontSize={globalFontSize}
                  />
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <PageFooter
            config={pageFooter}
            pageNumber={page.pageNumber}
            totalPages={pagesData.length}
            padding={CONTENT_PADDING_H}
            style={{ flexShrink: 0 }}
          />
        </div>
      ))}
    </div>
  );
}
