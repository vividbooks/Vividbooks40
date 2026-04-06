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
  getLayoutSectionChildren,
  getLayoutSectionColumnBlocks,
  getLayoutSectionColumnIds,
  isLayoutSectionBlock,
  normalizeLayoutSectionContent,
  type LayoutSectionColumnId,
} from '../../utils/layout-sections';
import {
  PAGE_DIMENSIONS,
  CONTENT_PADDING_H,
  MM_TO_PX,
  getContentHeight,
  getContentPaddingV,
  getGridGapPx,
  PISANKA_PAGE_OUTER_INSET_PX,
  type PageFormat,
} from '../../utils/page-layout';
import { getGoogleFontsUrl } from '../../types/design-system';

interface PrintGridCanvasProps {
  worksheet: Worksheet;
  onStable?: () => void;
  /** Volá se spolu s onStable — počet vykreslených stránek (tisk / náhled toku). */
  onStableMeta?: (meta: { pageCount: number }) => void;
  bleed?: boolean;
  renderOnlyPageIndex?: number;
  hideAttributions?: boolean;
}

const worksheetBlockHeightCache = new Map<string, Record<string, number>>();

const BLEED_MM = 3;
const BLEED_PX = BLEED_MM * MM_TO_PX;
const CROP_MARK_LENGTH_PX = 4 * MM_TO_PX;
const CROP_MARK_THICKNESS_PX = 1;
const debugPrintGridCanvas = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log('[PrintGridCanvas]', ...args);
  }
};

function CropMarks({ pageWidth, pageHeight, bleedPx }: { pageWidth: number; pageHeight: number; bleedPx: number }) {
  const trimLeft = bleedPx;
  const trimTop = bleedPx;
  const trimRight = bleedPx + pageWidth;
  const trimBottom = bleedPx + pageHeight;

  const marks: React.CSSProperties[] = [
    { left: trimLeft, top: 0, width: CROP_MARK_THICKNESS_PX, height: CROP_MARK_LENGTH_PX },
    { left: trimLeft, top: trimBottom + bleedPx - CROP_MARK_LENGTH_PX, width: CROP_MARK_THICKNESS_PX, height: CROP_MARK_LENGTH_PX },
    { left: trimRight, top: 0, width: CROP_MARK_THICKNESS_PX, height: CROP_MARK_LENGTH_PX },
    { left: trimRight, top: trimBottom + bleedPx - CROP_MARK_LENGTH_PX, width: CROP_MARK_THICKNESS_PX, height: CROP_MARK_LENGTH_PX },
    { left: 0, top: trimTop, width: CROP_MARK_LENGTH_PX, height: CROP_MARK_THICKNESS_PX },
    { left: trimRight + bleedPx - CROP_MARK_LENGTH_PX, top: trimTop, width: CROP_MARK_LENGTH_PX, height: CROP_MARK_THICKNESS_PX },
    { left: 0, top: trimBottom, width: CROP_MARK_LENGTH_PX, height: CROP_MARK_THICKNESS_PX },
    { left: trimRight + bleedPx - CROP_MARK_LENGTH_PX, top: trimBottom, width: CROP_MARK_LENGTH_PX, height: CROP_MARK_THICKNESS_PX },
  ];

  return (
    <>
      {marks.map((style, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            backgroundColor: '#111827',
            pointerEvents: 'none',
            ...style,
          }}
        />
      ))}
    </>
  );
}

export function PrintGridCanvas({
  worksheet,
  onStable,
  onStableMeta,
  bleed = false,
  renderOnlyPageIndex,
  hideAttributions = false,
}: PrintGridCanvasProps) {
  const worksheetCacheKey = `${worksheet.id ?? 'worksheet'}:${worksheet.updatedAt ?? 'unknown'}`;

  const printGoogleFontFamilies = useMemo(() => {
    const explicit = worksheet.metadata?.printGoogleFontFamilies as string[] | undefined;
    if (explicit && explicit.length > 0) return explicit;
    const df = worksheet.metadata?.designFonts;
    if (df?.heading || df?.body) {
      return [...new Set([df.heading, df.body].filter(Boolean))] as string[];
    }
    return [];
  }, [
    worksheet.metadata?.printGoogleFontFamilies,
    worksheet.metadata?.designFonts?.heading,
    worksheet.metadata?.designFonts?.body,
  ]);

  const googleFontsStylesheetUrl = useMemo(
    () => getGoogleFontsUrl(printGoogleFontFamilies),
    [printGoogleFontFamilies]
  );

  const [fontsReady, setFontsReady] = useState(() => !googleFontsStylesheetUrl);
  const pageFormat     = (worksheet.metadata?.pageFormat as PageFormat) || 'a4';
  const gridColumns    = (worksheet.metadata?.gridColumns as GridColumns) || 12;
  const globalFontSize = (worksheet.metadata?.globalFontSize as GlobalFontSize) || 'normal';
  const pageBackgroundColor = (worksheet.metadata?.pageBackgroundColor as string) || '#FFFFFF';
  const pageHeader: PageHeaderConfig | undefined = worksheet.metadata?.pageHeader as PageHeaderConfig | undefined;
  const pageFooter: PageFooterConfig | undefined = worksheet.metadata?.pageFooter as PageFooterConfig | undefined;

  // Strip legacy header-footer blocks from the PDF render entirely.
  // Headers and footers are handled by the PageHeader / PageFooter components
  // (rendered outside the content grid, controlled by worksheet.metadata.pageHeader/pageFooter).
  // Keeping header-footer blocks would cause them to appear twice when the global
  // config is enabled, or appear in the thumbnail even when the user turned them off.
  const blocks = (worksheet.blocks || []).filter(b => b.type !== 'header-footer');

  const gridGapPx = getGridGapPx(worksheet.metadata?.gridGap as string);
  const pageColumnLayout: 'single' | 'two-columns' = (worksheet.metadata?.pageColumnLayout as 'single' | 'two-columns') || 'single';
  const twoColumnASpan: number = (worksheet.metadata?.twoColumnASpan as number) ?? Math.round(gridColumns / 2);
  const pageOverrides = worksheet.metadata?.pageOverrides as Record<number, {
    pageColumnLayout?: 'single' | 'two-columns';
    twoColumnASpan?: number;
  }> | undefined;

  const pageWidth  = PAGE_DIMENSIONS[pageFormat]?.width  || PAGE_DIMENSIONS.a4.width;
  const pageHeight = PAGE_DIMENSIONS[pageFormat]?.height || PAGE_DIMENSIONS.a4.height;
  const bleedPx = bleed ? BLEED_PX : 0;
  const sheetWidth = pageWidth + bleedPx * 2;
  const sheetHeight = pageHeight + bleedPx * 2;
  const PAGINATION_SAFETY_BUFFER = 1;
  const LAYOUT_SECTION_PAGINATION_OVERHEAD = 16;
  const contentHeight = getContentHeight(pageFormat, pageHeader, pageFooter);
  const paginationContentHeight = Math.max(1, contentHeight - PAGINATION_SAFETY_BUFFER);
  const { top: padTop, bottom: padBot } = getContentPaddingV(pageHeader, pageFooter);
  const contentWidth = pageWidth - 2 * CONTENT_PADDING_H;
  const columnWidth  = (contentWidth - (gridColumns - 1) * gridGapPx) / gridColumns;

  const containerRef = useRef<HTMLDivElement>(null);
  const didSignalRef = useRef(false);
  /** Aktuální počet stránek pro onStableMeta (čte se po renderu). */
  const totalPagesRef = useRef(1);

  const [blockHeights, setBlockHeights] = useState<Record<string, number>>(
    () => worksheetBlockHeightCache.get(worksheetCacheKey) ?? {}
  );

  const paginationHeights = useMemo(() => {
    const next = { ...blockHeights };
    if (typeof document !== 'undefined') {
      blocks.forEach((block) => {
        const liveWrapper = containerRef.current?.querySelector<HTMLElement>(`[data-grid-block-wrapper="${block.id}"]`);
        const liveHeight = liveWrapper?.offsetHeight ?? 0;
        if (liveHeight > 0) {
          next[block.id] = liveHeight;
        }
      });
    }
    return next;
  }, [blockHeights, blocks]);

  useEffect(() => {
    const cached = worksheetBlockHeightCache.get(worksheetCacheKey) ?? {};
    setBlockHeights(prev => {
      if (Object.keys(cached).length === 0) return prev;
      return { ...prev, ...cached };
    });
    didSignalRef.current = false;
  }, [worksheetCacheKey]);

  useEffect(() => {
    if (!fontsReady) return;
    if (Object.keys(blockHeights).length === 0) return;
    worksheetBlockHeightCache.set(worksheetCacheKey, blockHeights);
  }, [blockHeights, fontsReady, worksheetCacheKey]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (!googleFontsStylesheetUrl) {
      setFontsReady(true);
      return;
    }

    setFontsReady(false);
    const linkId = `print-grid-google-fonts-${worksheet.id ?? 'anon'}`;
    let link = document.getElementById(linkId) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = googleFontsStylesheetUrl;

    let cancelled = false;
    const finish = () => {
      if (cancelled) return;
      if ('fonts' in document) {
        void document.fonts.ready.then(() => {
          if (!cancelled) setFontsReady(true);
        });
        window.setTimeout(() => {
          if (!cancelled) setFontsReady(true);
        }, 6000);
      } else {
        setFontsReady(true);
      }
    };

    link.onload = () => finish();
    link.onerror = () => finish();
    const fallbackTimer = window.setTimeout(finish, 3000);

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, [googleFontsStylesheetUrl, worksheet.id]);

  // ── Measure block heights with robust ResizeObserver ────────────────────────
  // Observer is created lazily in blockRefCallback (not in useEffect) so that
  // blocks rendered in the very first React pass are immediately observed.
  const observerRef = useRef<ResizeObserver | null>(null);

  const getOrCreateObserver = useCallback((): ResizeObserver => {
    if (!observerRef.current) {
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
    }
    return observerRef.current;
  }, []);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  const blockRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      getOrCreateObserver().observe(node);
    }
  }, [getOrCreateObserver]);

  // ── Stabilisation detection ───────────────────────────────────────────────
  // Uses a debounce timer: after each blockHeights change, wait 400 ms. If no
  // further change occurs, the layout is considered stable. This handles both
  // single-render and multi-render scenarios correctly.
  const onStableRef = useRef(onStable);
  onStableRef.current = onStable;
  const onStableMetaRef = useRef(onStableMeta);
  onStableMetaRef.current = onStableMeta;
  const timerRef        = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (didSignalRef.current) return;
    if (!fontsReady) return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!didSignalRef.current) {
        didSignalRef.current = true;
        debugPrintGridCanvas('stable', {
          worksheetId: worksheet.id ?? null,
          updatedAt: worksheet.updatedAt ?? null,
          renderOnlyPageIndex,
        });
        onStableRef.current?.();
        onStableMetaRef.current?.({ pageCount: totalPagesRef.current });
      }
    }, 400);

    return () => clearTimeout(timerRef.current);
  }, [blockHeights, blocks.length, fontsReady]);

  /** Když ResizeObserver neohlásí výšky (např. skryté vnořené stromy), stejně dokončíme náhled. */
  useEffect(() => {
    if (didSignalRef.current) return;
    if (!fontsReady) return;
    if (blocks.length === 0) return;

    const t = window.setTimeout(() => {
      if (didSignalRef.current) return;
      didSignalRef.current = true;
      debugPrintGridCanvas('stable-fallback-timeout', { worksheetId: worksheet.id ?? null });
      onStableRef.current?.();
      onStableMetaRef.current?.({ pageCount: totalPagesRef.current });
    }, 2800);

    return () => window.clearTimeout(t);
  }, [blocks.length, fontsReady, worksheet.id, worksheetCacheKey]);

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

  // Noop handlers for read-only EditableBlock
  const noop = useCallback(() => {}, []);

  const renderPrintBlock = useCallback((block: WorksheetBlock) => {
    const isFullscreenFigma = block.type === 'free-canvas' && (block.content as any).fullscreen;
    const blockGridSpan = isFullscreenFigma ? gridColumns : (block.gridSpan || gridColumns);
    const blockForRender = isFullscreenFigma
      ? { ...block, content: { ...(block.content as any), canvasHeight: contentHeight } }
      : block;
    return (
      <div
        key={block.id}
        data-block-id={block.id}
        data-grid-block-wrapper={block.id}
        ref={blockRefCallback}
        style={{ gridColumn: `span ${blockGridSpan}`, minWidth: 0 }}
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
  }, [activityNumbers, blockRefCallback, contentHeight, globalFontSize, gridColumns, noop]);

  // ── Render units: flat blocks → normal rows + float groups ──────────────────
  type RenderUnit =
    | { type: 'normal'; blocks: WorksheetBlock[]; height: number }
    | { type: 'float'; anchor: WorksheetBlock; side: 'left' | 'right'; anchorPx: number; mainBlocks: WorksheetBlock[]; height: number }
    | {
        type: 'layout-section';
        unitId: string;
        section: WorksheetBlock;
        columnIds: LayoutSectionColumnId[];
        columns: Partial<Record<LayoutSectionColumnId, WorksheetBlock[]>>;
        minHeight: number;
        segmentIndex: number;
        segmentCount: number;
        height: number;
      };

  const buildRenderUnits = (flatBlocks: WorksheetBlock[]): RenderUnit[] => {
    const units: RenderUnit[] = [];
    const consumedIds = new Set<string>();
    const layoutSectionIds = new Set(flatBlocks.filter(isLayoutSectionBlock).map((candidate) => candidate.id));
    let i = 0;
    while (i < flatBlocks.length) {
      const block = flatBlocks[i];
      if (consumedIds.has(block.id)) {
        i++;
        continue;
      }

      if (isLayoutSectionBlock(block)) {
        const content = normalizeLayoutSectionContent(block.content);
        const columnIds = getLayoutSectionColumnIds(content.columns);
        const availableLayoutContentHeight = Math.max(120, paginationContentHeight - LAYOUT_SECTION_PAGINATION_OVERHEAD);
        const paginatedColumns = columnIds.reduce((acc, columnId) => {
          const columnBlocks = getLayoutSectionColumnBlocks(flatBlocks, block.id, columnId);
          const pages: WorksheetBlock[][] = [];
          let currentPage: WorksheetBlock[] = [];
          let currentHeight = 0;

          columnBlocks.forEach((childBlock) => {
            const blockHeight = paginationHeights[childBlock.id] || 100;
            const nextHeight = currentPage.length > 0 ? currentHeight + gridGapPx + blockHeight : blockHeight;
            if (currentPage.length > 0 && nextHeight > availableLayoutContentHeight) {
              pages.push(currentPage);
              currentPage = [childBlock];
              currentHeight = blockHeight;
            } else {
              currentPage.push(childBlock);
              currentHeight = nextHeight;
            }
          });

          if (currentPage.length > 0 || pages.length === 0) {
            pages.push(currentPage);
          }

          acc[columnId] = pages;
          return acc;
        }, {} as Partial<Record<LayoutSectionColumnId, WorksheetBlock[][]>>);

        consumedIds.add(block.id);
        getLayoutSectionChildren(flatBlocks, block.id).forEach((childBlock) => consumedIds.add(childBlock.id));
        const segmentCount = Math.max(1, ...columnIds.map((columnId) => paginatedColumns[columnId]?.length ?? 0));

        for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
          const columns = columnIds.reduce((acc, columnId) => {
            acc[columnId] = paginatedColumns[columnId]?.[segmentIndex] ?? [];
            return acc;
          }, {} as Partial<Record<LayoutSectionColumnId, WorksheetBlock[]>>);

          const segmentMinHeight = segmentIndex === 0 ? (content.minHeight ?? 180) : 0;
          const maxColumnHeight = Math.max(
            segmentMinHeight,
            ...columnIds.map((columnId) => (
              (columns[columnId] || []).reduce((sum, childBlock, index) => (
                sum + (paginationHeights[childBlock.id] || 100) + (index > 0 ? gridGapPx : 0)
              ), 0)
            )),
          );

          units.push({
            type: 'layout-section',
            unitId: `${block.id}-segment-${segmentIndex}`,
            section: block,
            columnIds,
            columns,
            minHeight: segmentMinHeight,
            segmentIndex,
            segmentCount,
            height: LAYOUT_SECTION_PAGINATION_OVERHEAD + maxColumnHeight,
          });
        }
        i++;
        continue;
      }

      if (block.layoutSectionId && layoutSectionIds.has(block.layoutSectionId)) {
        consumedIds.add(block.id);
        i++;
        continue;
      }

      if (block.floatSide) {
        const spanCount = block.floatSpanBlocks ?? 3;
        const mainBlocks = flatBlocks.slice(i + 1, i + 1 + spanCount);
        const anchorH = paginationHeights[block.id] || 100;
        const mainH = mainBlocks.reduce((sum, b, idx) => sum + (paginationHeights[b.id] || 100) + (idx > 0 ? gridGapPx : 0), 0);
        // Compute anchor pixel width from floatGridSpan (grid-aligned) with fallback to floatWidthPercent
        const floatSpan: number = (block as any).floatGridSpan
          ?? Math.max(1, Math.round(((block as any).floatWidthPercent ?? 35) / 100 * gridColumns));
        const anchorPx = floatSpan * columnWidth + (floatSpan - 1) * gridGapPx;
        units.push({ type: 'float', anchor: block, side: block.floatSide, anchorPx, mainBlocks, height: Math.max(anchorH, mainH) });
        i += 1 + mainBlocks.length;
      } else {
        const isFF = (b: WorksheetBlock) => b.type === 'free-canvas' && (b.content as any).fullscreen;
        const span = (b: WorksheetBlock) => isFF(b) ? gridColumns : (b.gridSpan || gridColumns);
        const rowBlocks: WorksheetBlock[] = [block];
        let rowSpan = span(block);
        let rowH = paginationHeights[block.id] || 100;
        let j = i + 1;
        while (
          j < flatBlocks.length
          && !flatBlocks[j].floatSide
          && !isLayoutSectionBlock(flatBlocks[j])
          && !flatBlocks[j].layoutSectionId
        ) {
          const nb = flatBlocks[j];
          const ns = span(nb);
          if (rowSpan + ns > gridColumns) break;
          rowBlocks.push(nb);
          rowSpan += ns;
          rowH = Math.max(rowH, paginationHeights[nb.id] || 100);
          j++;
        }
        units.push({ type: 'normal', blocks: rowBlocks, height: rowH });
        i = j;
      }
    }
    return units;
  };

  const renderUnits = useMemo(() => buildRenderUnits(blocks), [
    blocks,
    paginationHeights,
    paginationContentHeight,
    gridColumns,
    gridGapPx,
  ]);

  const getUnitColumnAssignment = useCallback((unit: RenderUnit): 'A' | 'B' => {
    if (unit.type === 'layout-section') {
      const childAssignments = unit.columnIds.flatMap((columnId) => (
        (unit.columns[columnId] || []).map((block) => block.columnAssignment ?? 'A')
      ));
      return (unit.section.columnAssignment ?? childAssignments[0] ?? 'A') as 'A' | 'B';
    }

    if (unit.type === 'float') {
      const assignments = [unit.anchor, ...unit.mainBlocks].map((block) => block.columnAssignment ?? 'A');
      return (unit.anchor.columnAssignment ?? assignments[0] ?? 'A') as 'A' | 'B';
    }

    return (unit.blocks[0]?.columnAssignment ?? 'A') as 'A' | 'B';
  }, []);

  // ── Pagination ────────────────────────────────────────────────────────────
  const hasAnyTwoCol = useMemo(() => {
    if (pageColumnLayout === 'two-columns') return true;
    if (pageOverrides) {
      return Object.values(pageOverrides).some((override) => override.pageColumnLayout === 'two-columns');
    }
    return false;
  }, [pageColumnLayout, pageOverrides]);

  const twoColPagesData = useMemo(() => {
    if (!hasAnyTwoCol) return null;

    const colAUnits = renderUnits.filter((unit) => getUnitColumnAssignment(unit) === 'A');
    const colBUnits = renderUnits.filter((unit) => getUnitColumnAssignment(unit) === 'B');

    const paginateCol = (colUnits: RenderUnit[]): RenderUnit[][] => {
      const pages: RenderUnit[][] = [];
      let current: RenderUnit[] = [];
      let height = 0;

      for (const unit of colUnits) {
        const unitHeight = unit.height;
        const nextHeight = current.length > 0 ? height + gridGapPx + unitHeight : unitHeight;
        if (current.length > 0 && nextHeight > paginationContentHeight) {
          pages.push(current);
          current = [];
          height = 0;
        }
        current.push(unit);
        height = current.length > 1 ? height + gridGapPx + unitHeight : unitHeight;
      }

      if (current.length > 0 || pages.length === 0) pages.push(current);
      return pages;
    };

    const colAPages = paginateCol(colAUnits);
    const colBPages = paginateCol(colBUnits);
    const numPages = Math.max(colAPages.length, colBPages.length, 1);

    return Array.from({ length: numPages }, (_, index) => ({
      colA: colAPages[index] ?? [],
      colB: colBPages[index] ?? [],
      pageNumber: index + 1,
    }));
  }, [getUnitColumnAssignment, gridGapPx, hasAnyTwoCol, paginationContentHeight, renderUnits]);

  const pagesData = useMemo(() => {
    const pages: { units: RenderUnit[]; pageNumber: number }[] = [];
    let currentPageUnits: RenderUnit[] = [];
    let currentHeight = 0;
    let pageNumber = 1;

    renderUnits.forEach((unit) => {
      const nextHeight = currentPageUnits.length > 0 ? currentHeight + gridGapPx + unit.height : unit.height;
      if (nextHeight > paginationContentHeight && currentPageUnits.length > 0) {
        pages.push({ units: currentPageUnits, pageNumber });
        currentPageUnits = [];
        currentHeight = 0;
        pageNumber++;
      }
      currentPageUnits.push(unit);
      currentHeight = currentPageUnits.length > 1 ? currentHeight + gridGapPx + unit.height : unit.height;
    });

    if (currentPageUnits.length > 0 || blocks.length === 0) {
      pages.push({ units: currentPageUnits, pageNumber });
    }

    return pages;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks.length, gridGapPx, paginationContentHeight, renderUnits]);

  // ── Collect image attributions from all blocks ────────────────────────────
  const imageAttributions: { title: string; caption: string }[] = [];
  for (const block of blocks) {
    if (block.type === 'image') {
      const c = block.content as any;
      const caption: string = c.caption || '';
      // Only include captions that contain license info (have a newline with source info)
      if (caption.includes('\n') || /wikimedia|cc by|creative common/i.test(caption)) {
        const title = c.alt || c.caption?.split('\n')[0] || '';
        imageAttributions.push({ title, caption });
      }
    }
  }

  const totalPages = (twoColPagesData ?? pagesData).length;
  totalPagesRef.current = totalPages;
  const renderedPageIndices = renderOnlyPageIndex === undefined
    ? Array.from({ length: totalPages }, (_, index) => index)
    : Array.from({ length: totalPages }, (_, index) => index);

  useEffect(() => {
    debugPrintGridCanvas('page-source', {
      worksheetId: worksheet.id ?? null,
      updatedAt: worksheet.updatedAt ?? null,
      renderOnlyPageIndex,
      pageColumnLayout,
      hasAnyTwoCol,
      pagesDataLength: pagesData.length,
      twoColPagesLength: twoColPagesData?.length ?? 0,
      totalPages,
      renderedPageIndices,
      fontsReady,
      measuringFullWorksheet: renderOnlyPageIndex !== undefined,
    });
  }, [
    worksheet.id,
    worksheet.updatedAt,
    renderOnlyPageIndex,
    pageColumnLayout,
    hasAnyTwoCol,
    pagesData.length,
    twoColPagesData?.length,
    totalPages,
    renderedPageIndices,
    fontsReady,
    renderOnlyPageIndex,
  ]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ width: `${sheetWidth}px`, margin: '0 auto' }}>
      {renderedPageIndices.map((pageIndex, renderIdx) => {
        const page = pagesData[pageIndex] ?? { units: [] as RenderUnit[], pageNumber: pageIndex + 1 };
        const tcPage = twoColPagesData?.[pageIndex];
        const effectivePageColumnLayout = pageOverrides?.[pageIndex]?.pageColumnLayout ?? pageColumnLayout;
        const effectiveTwoColumnASpan = pageOverrides?.[pageIndex]?.twoColumnASpan ?? twoColumnASpan;
        const pageNumber = tcPage?.pageNumber ?? page.pageNumber ?? pageIndex + 1;
        const allowPageBreak = renderOnlyPageIndex === undefined && renderIdx < renderedPageIndices.length - 1;
        const isOffscreenMeasurePage = renderOnlyPageIndex !== undefined && pageIndex !== renderOnlyPageIndex;
        const isPageEmpty = effectivePageColumnLayout === 'two-columns'
          ? ((tcPage?.colA.length ?? 0) === 0 && (tcPage?.colB.length ?? 0) === 0)
          : page.units.length === 0;
        return (
        <div
          key={pageIndex}
          className="print-sheet"
          style={{
            width: `${sheetWidth}px`,
            height: `${sheetHeight}px`,
            position: isOffscreenMeasurePage ? 'absolute' : 'relative',
            left: isOffscreenMeasurePage ? '-200000px' : undefined,
            top: isOffscreenMeasurePage ? '0' : undefined,
            /* visibility:hidden může v některých prohlížečích zabránit ResizeObserveru u bloků na „neaktivních“ stránkách */
            opacity: isOffscreenMeasurePage ? 0 : 1,
            pointerEvents: isOffscreenMeasurePage ? 'none' : 'auto',
            overflow: 'hidden',
            display: 'block',
            boxShadow: 'none',
            pageBreakAfter: allowPageBreak ? 'always' : 'auto',
            breakAfter: allowPageBreak ? 'page' as any : 'auto',
          }}
        >
          {bleed && <CropMarks pageWidth={pageWidth} pageHeight={pageHeight} bleedPx={bleedPx} />}
          <div
            className="a4-page"
            style={{
              position: 'absolute',
              left: `${bleedPx}px`,
              top: `${bleedPx}px`,
              width: `${pageWidth}px`,
              height: `${pageHeight}px`,
              backgroundColor: pageBackgroundColor,
              overflow: 'visible',
              display: 'flex',
              flexDirection: 'column',
          }}
        >
          {/* Header */}
          <PageHeader config={pageHeader} padding={CONTENT_PADDING_H} style={{ flexShrink: 0 }} />

          {/* Content grid */}
          <div
            data-page-content-grid="true"
            data-page-index={pageIndex}
            style={{
                paddingLeft: CONTENT_PADDING_H,
              paddingRight: CONTENT_PADDING_H,
                paddingTop: padTop,
              paddingBottom: padBot,
                flex: 1,
                minHeight: 0,
                position: 'relative',
                zIndex: 20,
                overflow: 'visible',
                ...({
                  '--vb-pisanka-page-outer-inset': `${PISANKA_PAGE_OUTER_INSET_PX}px`,
                  '--vb-pisanka-page-inner-min-height': `${Math.max(0, contentHeight - 2 * PISANKA_PAGE_OUTER_INSET_PX)}px`,
                } as React.CSSProperties),
                ...(effectivePageColumnLayout === 'two-columns'
                ? { display: 'flex', gap: `${gridGapPx}px`, alignItems: 'flex-start' }
                : { display: 'grid', gridTemplateColumns: `repeat(${gridColumns}, 1fr)`, gap: `${gridGapPx}px`, alignItems: 'start', alignContent: 'start' }),
            }}
          >
              {isPageEmpty && pageIndex === 0 ? (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    height: '100%',
                  }}
                />
              ) : effectivePageColumnLayout === 'two-columns' ? (
              /* ── Two-column print layout ── */
              (() => {
                  const fallbackUnits = page.units.filter((unit) => getUnitColumnAssignment(unit) === 'A');
                  const fallbackUnitsB = page.units.filter((unit) => getUnitColumnAssignment(unit) === 'B');
                  const colA = tcPage ? tcPage.colA : fallbackUnits;
                  const colB = tcPage ? tcPage.colB : fallbackUnitsB;
                  const aSpan = effectiveTwoColumnASpan ?? Math.round(gridColumns / 2);
                  const bSpan = gridColumns - aSpan;
                const colStyle = (col: 'A' | 'B'): React.CSSProperties => ({
                    flex: col === 'A' ? aSpan : bSpan,
                  minWidth: 0,
                  display: 'grid',
                    gridTemplateColumns: `repeat(${col === 'A' ? aSpan : bSpan}, 1fr)`,
                  gap: `${gridGapPx}px`,
                  alignContent: 'start',
                  alignItems: 'start',
                });
                  const renderCol = (columnUnits: RenderUnit[], col: 'A' | 'B') => {
                    const colSpan = col === 'A' ? aSpan : bSpan;
                    const outerColumnWidth = ((contentWidth - gridGapPx) * colSpan) / gridColumns;
                    const columnWidthForColumn = (outerColumnWidth - (colSpan - 1) * gridGapPx) / colSpan;
                    return (
                      <div key={col} style={colStyle(col)}>
                        {columnUnits.map((unit) => {
                          if (unit.type === 'layout-section') {
                            const sectionContent = normalizeLayoutSectionContent(unit.section.content);
                            const columnRatios = sectionContent.columnRatios ?? (sectionContent.columns === 3 ? [34, 33, 33] : [50, 50]);
                            const columnTemplate = columnRatios.map((ratio) => `minmax(0, ${ratio}fr)`).join(' ');
                            const layoutGapPx = sectionContent.columnGap ?? gridGapPx;

                            return (
                              <div
                                key={unit.unitId}
                                style={{
                                  gridColumn: '1 / -1',
                                  padding: 0,
                                }}
                              >
                                <div
                                  style={{
                                    position: 'relative',
                                    display: 'grid',
                                    gridTemplateColumns: columnTemplate,
                                    gap: `${layoutGapPx}px`,
                                    alignItems: 'stretch',
                                  }}
                                >
                                  {unit.columnIds.map((columnId) => {
                                    const columnBlocks = unit.columns[columnId] || [];
                                    return (
                                      <div
                                        key={columnId}
                                        style={{
                                          minWidth: 0,
                                          minHeight: unit.minHeight,
                                          borderRadius: 0,
                                          border: 'none',
                                          background: 'transparent',
                                          padding: 0,
                                          display: 'flex',
                                          flexDirection: 'column',
                                          height: '100%',
                                        }}
                                      >
                                        {columnBlocks.length === 0 && (
                                          <div
                                            style={{
                                              flex: 1,
                                              minHeight: 120,
                                            }}
                                          />
                                        )}

                                        {columnBlocks.map((block) => renderPrintBlock({
                                          ...block,
                                          width: 'full',
                                          widthPercent: undefined,
                                          gridSpan: colSpan,
                                        }))}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          }

                          if (unit.type === 'float') {
                            const isLeft = unit.side === 'left';
                            const floatSpan = unit.anchor.floatGridSpan
                              ?? Math.max(1, Math.round(((unit.anchor.floatWidthPercent ?? 35) / 100) * colSpan));
                            const anchorSpan = Math.max(1, Math.min(colSpan - 1, floatSpan));
                            const anchorPx = anchorSpan * columnWidthForColumn + (anchorSpan - 1) * gridGapPx;

                            return (
                              <div
                                key={unit.anchor.id}
                                style={{
                                  gridColumn: '1 / -1',
                                  display: 'flex',
                                  gap: `${gridGapPx}px`,
                                  alignItems: 'flex-start',
                                  flexDirection: isLeft ? 'row' : 'row-reverse',
                                }}
                              >
                                <div style={{ width: `${anchorPx}px`, flexShrink: 0 }}>
                                  {renderPrintBlock(unit.anchor)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: `${gridGapPx}px` }}>
                                  {unit.mainBlocks.map((block) => renderPrintBlock(block))}
                                </div>
                              </div>
                            );
                          }

                          return unit.blocks.map((block) => {
                            const origSpan = block.gridSpan || gridColumns;
                            const remappedSpan = origSpan >= gridColumns ? colSpan : Math.min(origSpan, colSpan);
                            const adjustedBlock: WorksheetBlock = remappedSpan === origSpan ? block : { ...block, gridSpan: remappedSpan };
                            return renderPrintBlock(adjustedBlock);
                          });
                        })}
                      </div>
                    );
                  };
                return (
                  <>
                      {renderCol(colA, 'A')}
                      {renderCol(colB, 'B')}
                  </>
                );
              })()
            ) : (
              /* ── Normal grid ── */
              page.units.map((unit) => {
                  if (unit.type === 'layout-section') {
                    const sectionContent = normalizeLayoutSectionContent(unit.section.content);
                    const layoutGridSpan = Math.min(gridColumns, unit.section.gridSpan || gridColumns);
                    const columnRatios = sectionContent.columnRatios ?? (sectionContent.columns === 3 ? [34, 33, 33] : [50, 50]);
                    const columnTemplate = columnRatios.map((ratio) => `minmax(0, ${ratio}fr)`).join(' ');
                    const layoutGapPx = sectionContent.columnGap ?? gridGapPx;

                    return (
                      <div
                        key={unit.unitId}
                        style={{
                          gridColumn: `span ${layoutGridSpan}`,
                          padding: 0,
                        }}
                      >
                        <div
                          style={{
                            position: 'relative',
                            display: 'grid',
                            gridTemplateColumns: columnTemplate,
                            gap: `${layoutGapPx}px`,
                            alignItems: 'stretch',
                          }}
                        >
                          {unit.columnIds.map((columnId) => {
                            const columnBlocks = unit.columns[columnId] || [];
                            return (
                              <div
                                key={columnId}
                                style={{
                                  minWidth: 0,
                                  minHeight: unit.minHeight,
                                  borderRadius: 0,
                                  border: 'none',
                                  background: 'transparent',
                                  padding: 0,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  height: '100%',
                                }}
                              >
                                {columnBlocks.length === 0 && (
                                  <div
                                    style={{
                                      flex: 1,
                                      minHeight: 120,
                                    }}
                                  />
                                )}

                                {columnBlocks.map((block) => renderPrintBlock({
                                  ...block,
                                  width: 'full',
                                  widthPercent: undefined,
                                  gridSpan: layoutGridSpan,
                                }))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  if (unit.type === 'float') {
                    const isLeft = unit.side === 'left';
                  return (
                    <div key={unit.anchor.id} style={{ gridColumn: '1 / -1', display: 'flex', gap: `${gridGapPx}px`, alignItems: 'flex-start', flexDirection: isLeft ? 'row' : 'row-reverse' }}>
                      <div style={{ width: `${unit.anchorPx}px`, flexShrink: 0 }}>{renderPrintBlock(unit.anchor)}</div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: `${gridGapPx}px` }}>
                        {unit.mainBlocks.map(b => renderPrintBlock(b))}
                      </div>
                    </div>
                  );
                }
                  return unit.blocks.map((block) => renderPrintBlock(block));
              })
            )}
          </div>

          {/* Footer */}
          <PageFooter
            config={pageFooter}
              pageNumber={pageNumber}
              totalPages={totalPages}
            padding={CONTENT_PADDING_H}
            style={{ flexShrink: 0 }}
          />
        </div>
        </div>
      )})}

      {/* ── Creative Commons attribution footer ────────────────────────────── */}
      {!hideAttributions && imageAttributions.length > 0 && (
        <div
          style={{
            width: `${sheetWidth}px`,
            paddingLeft: CONTENT_PADDING_H,
            paddingRight: CONTENT_PADDING_H,
            paddingTop: 12,
            paddingBottom: 16,
            borderTop: '1px solid #e2e8f0',
            marginTop: 4,
          }}
        >
          <p style={{ fontSize: 8, color: '#94a3b8', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Zdroje obrázků
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {imageAttributions.map((attr, i) => (
              <p key={i} style={{ fontSize: 7.5, color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                {attr.caption.replace('\n', ' • ')}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
