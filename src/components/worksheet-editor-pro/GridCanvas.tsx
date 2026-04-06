/**
 * GridCanvas - Grid layout pro PRO worksheet editor
 * 
 * Bloky jsou v lineárním pořadí (flow) s možností:
 * - Změna gridSpan pomocí bobánků (levý/pravý)
 * - Změna marginBottom pomocí spodního bobánku
 * - Stejný vzhled papíru jako FreeformCanvas
 * - Ideální pro AI generování (jednoduchý JSON output)
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { WorksheetBlock, BlockType, GlobalFontSize, GridColumns, PageHeaderConfig, PageFooterConfig } from '../../types/worksheet';
import { isCompareCountsParagraphBlock } from '../../utils/mini-apps/compare-counts';
import { isPisankaParagraphBlock } from '../../utils/mini-apps/pisanka';
import { Plus, Sparkles, Type, ImageIcon, Info, CheckSquare, PenLine, MessageSquare, PlusCircle, QrCode, Scissors, Palette, Figma, BarChart2, Link2 } from 'lucide-react';
import { EditableBlock } from '../worksheet-editor/EditableBlock';
import { PageHeader, PageFooter, getHeaderHeight, getFooterHeight } from './PageHeaderFooter';
import {
  PAGE_DIMENSIONS,
  MM_TO_PX,
  CONTENT_PADDING_H as PADDING,
  getContentHeight,
  getContentPaddingV,
  PISANKA_PAGE_OUTER_INSET_PX,
  type PageFormat,
} from '../../utils/page-layout';
import {
  detectTextFlowOverflow,
  getTextFlowAvailableFrameHeight,
  getTextFlowDebugMetrics,
  getOrderedTextFlowChain,
  getTextFlowLineStep,
  resolveTextFlowCombinedHeight,
  supportsTextFlow,
} from '../../utils/text-flow';
import {
  getLayoutSectionChildren,
  getLayoutSectionColumnBlocks,
  getLayoutSectionColumnIds,
  isLayoutSectionBlock,
  LayoutSectionColumnId,
  normalizeLayoutSectionContent,
} from '../../utils/layout-sections';

type LayoutDropPlacement = {
  layoutSectionId: string;
  layoutColumnId: LayoutSectionColumnId;
  insertBeforeId?: string | null;
};

interface GridCanvasProps {
  blocks: WorksheetBlock[];
  selectedBlockId: string | null;
  hoveredBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onHoverBlock?: (id: string | null) => void;
  onUpdateBlock: (id: string, content: any) => void;
  onUpdateBlockMargin: (id: string, margin: number) => void;
  onUpdateBlockGridSpan?: (id: string, gridSpan: number, gridStart: number) => void;
  onUpdateTextFlowFrameHeight?: (id: string, height?: number, options?: { reflow?: boolean; mode?: 'auto' | 'manual' }) => void;
  onCreateTextFlowContinuation?: (id: string) => void;
  onSplitTextFlowAtCaret?: (id: string, charIndex: number, currentHtml?: string) => void;
  onCommitTextFlow?: (id: string) => void;
  onDeleteBlock?: (id: string) => void;
  onDuplicateBlock?: (id: string) => void;
  onMoveBlockLeft?: (id: string) => void;
  onMoveBlockRight?: (id: string) => void;
  onMoveBlockUp?: (id: string) => void;
  onMoveBlockDown?: (id: string) => void;
  onAddBlock: (type: BlockType) => void;
  onSwitchToAI: () => void;
  onOpenAddPanel: () => void;
  onOpenAI?: () => void;
  globalFontSize?: GlobalFontSize;
  pageFormat?: PageFormat;
  gridColumns?: GridColumns;
  gridGapPx?: number;
  showGridOverlay?: boolean;
  pendingInsertType?: BlockType | null;
  onInsertBefore?: (targetBlockId: string) => void;
  // Drag and drop from add panel
  isDraggingFromPanel?: boolean;
  onDropBlock?: (type: BlockType, insertBeforeId: string | null, placement?: LayoutDropPlacement) => void;
  // Page styling
  pageBackgroundColor?: string;
  // Header / Footer
  pageHeader?: PageHeaderConfig;
  pageFooter?: PageFooterConfig;
  // Page visibility callback for AI panel
  onPageChange?: (pageIndex: number, blockIds: string[]) => void;
  // Two-column page layout
  pageColumnLayout?: 'single' | 'two-columns';
  /** Počet grid sloupců pro sloupec A (B = gridColumns - twoColumnASpan) */
  twoColumnASpan?: number;
  /** Per-stránkový override pro rozložení; klíč = pageIndex */
  pageOverrides?: Record<number, { pageColumnLayout?: 'single' | 'two-columns'; twoColumnASpan?: number }>;
}

// Drop Zone component for drag and drop from panel
function DropZone({ 
  zoneId, 
  isActive, 
  onDragEnter, 
  onDragLeave, 
  onDrop,
  gridColumns,
}: { 
  zoneId: string;
  isActive: boolean; 
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  gridColumns: number;
}) {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        height: isActive ? '48px' : '16px',
        position: 'relative',
        transition: 'height 0.15s ease',
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        onDragEnter();
      }}
      onDragLeave={(e) => {
        // Only trigger if actually leaving the element
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          onDragLeave();
        }
      }}
      onDrop={onDrop}
    >
      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: '4px',
            backgroundColor: '#3B82F6',
            borderRadius: '2px',
            transform: 'translateY(-50%)',
            boxShadow: '0 0 12px rgba(59, 130, 246, 0.6)',
          }}
        >
          {/* Plus indicator in the middle */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '24px',
              height: '24px',
              backgroundColor: '#3B82F6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.5)',
            }}
          >
            <Plus size={14} color="white" />
          </div>
        </div>
      )}
    </div>
  );
}

function LayoutColumnDropZone({
  isActive,
  onDragEnter,
  onDragLeave,
  onDrop,
}: {
  isActive: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      style={{
        height: isActive ? '36px' : '10px',
        position: 'relative',
        transition: 'height 0.15s ease',
        flexShrink: 0,
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        onDragEnter();
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          onDragLeave();
        }
      }}
      onDrop={onDrop}
    >
      {isActive && (
        <div
          style={{
            position: 'absolute',
            inset: '50% 0 auto 0',
            height: '3px',
            backgroundColor: '#3B82F6',
            borderRadius: 999,
            transform: 'translateY(-50%)',
            boxShadow: '0 0 10px rgba(59,130,246,0.45)',
          }}
        />
      )}
    </div>
  );
}

// Grid overlay component
function GridOverlay({ 
  columns, 
  gap, 
  pageWidth,
  headerHeight,
  footerHeight,
}: { 
  columns: number; 
  gap: number;
  pageWidth: number;
  headerHeight: number;
  footerHeight: number;
}) {
  const contentWidth = pageWidth - (PADDING * 2);

  return (
    <div 
      className="absolute pointer-events-none print:hidden"
      style={{
        top: headerHeight,
        left: PADDING,
        right: PADDING,
        bottom: footerHeight,
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap}px`,
      }}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <div 
          key={i}
          style={{
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            border: '1px dashed rgba(99, 102, 241, 0.3)',
            borderRadius: '4px',
          }}
        />
      ))}
    </div>
  );
}

// Quick add bar
function QuickAddBar({ 
  onAddBlock, 
  onSwitchToAI, 
  onOpenAddPanel 
}: { 
  onAddBlock: (type: BlockType) => void;
  onSwitchToAI: () => void;
  onOpenAddPanel: () => void;
}) {
  const Item = ({ 
    icon: Icon, 
    label, 
    onClick, 
    variant = 'default' 
  }: { 
    icon: any; 
    label: string; 
    onClick: () => void;
    variant?: 'default' | 'ai' | 'more';
  }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex flex-col items-center justify-start gap-1.5 group transition-all shrink-0 py-2 px-2.5"
    >
      <div className="w-10 h-10 flex items-center justify-center">
        <Icon 
          size={27} 
          strokeWidth={1.5} 
          className={`transition-colors ${
            variant === 'ai' ? 'text-blue-500 group-hover:text-blue-600' : 
            variant === 'more' ? 'text-slate-500 group-hover:text-slate-600' : 
            'text-slate-400 group-hover:text-slate-500'
          }`}
        />
      </div>
      <span className={`font-normal text-center leading-tight transition-colors ${
        variant === 'ai' ? 'text-blue-500 group-hover:text-blue-600' : 'text-slate-400 group-hover:text-slate-500'
      }`} style={{ fontSize: '13px' }}>
        {label}
      </span>
    </button>
  );

  const Divider = () => <div className="w-px h-9 bg-slate-200 self-center" />;

  return (
    <div 
      className="bg-slate-50 rounded-xl py-2 px-3 print:hidden"
      data-print-hide="true"
    >
      <div className="text-[8px] font-medium text-slate-400 mb-1.5 px-1">Přidat:</div>
      <div className="flex items-center justify-center gap-1">
        <Item icon={Sparkles} label="Podle AI" onClick={onSwitchToAI} variant="ai" />
        <Divider />
        <Item icon={Type} label="Odstavec" onClick={() => onAddBlock('paragraph')} />
        <Item icon={ImageIcon} label="Obrázek" onClick={() => onAddBlock('image')} />
        <Item icon={Info} label="Infobox" onClick={() => onAddBlock('infobox')} />
        <Item icon={QrCode} label="QR kód" onClick={() => onAddBlock('qr-code')} />
        <Divider />
        <Item icon={CheckSquare} label="Výběr" onClick={() => onAddBlock('multiple-choice')} />
        <Item icon={PenLine} label="Doplnění" onClick={() => onAddBlock('fill-blank')} />
        <Item icon={MessageSquare} label="Volná" onClick={() => onAddBlock('free-answer')} />
        <Item icon={Figma} label="Figma" onClick={() => onAddBlock('free-canvas')} />
        <Item icon={BarChart2} label="Graf" onClick={() => onAddBlock('chart')} />
        <Divider />
        <Item icon={PlusCircle} label="Více" onClick={onOpenAddPanel} variant="more" />
      </div>
    </div>
  );
}

// Page break indicator
function PageBreak({ pageNumber }: { pageNumber: number }) {
  return (
    <div 
      className="w-full py-6 relative flex items-center justify-center print:hidden"
      data-print-hide="true"
      style={{ zIndex: 1 }}
    >
      <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-slate-300" />
      <div className="relative flex items-center gap-2 px-4 bg-slate-300">
        <Scissors className="h-4 w-4 text-slate-400 rotate-90" />
        <span className="text-xs font-medium text-slate-500">
          Konec strany {pageNumber}
        </span>
        <Scissors className="h-4 w-4 text-slate-400 -rotate-90" />
      </div>
    </div>
  );
}

// ── Float resize handle component ──────────────────────────────────────────
function FloatResizeHandle({
  currentSpan,
  columnWidth,
  gridGapPx,
  gridColumns,
  isLeft,
  onSpanChange,
}: {
  side: 'left';
  currentSpan: number;
  columnWidth: number;
  gridGapPx: number;
  gridColumns: number;
  /** true = anchor is on the left side, false = anchor is on the right side */
  isLeft: boolean;
  onSpanChange: (span: number) => void;
}) {
  const startXRef = useRef<number>(0);
  const startSpanRef = useRef<number>(currentSpan);
  const [dragging, setDragging] = useState(false);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startXRef.current = e.clientX;
    startSpanRef.current = currentSpan;
    setDragging(true);

    const onMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startXRef.current;
      const colDelta = Math.round(dx / (columnWidth + gridGapPx));
      // When anchor is left: drag right → wider (+), drag left → narrower (-)
      // When anchor is right: drag right → narrower (-), drag left → wider (+)
      const dir = isLeft ? colDelta : -colDelta;
      const newSpan = Math.min(gridColumns - 2, Math.max(2, startSpanRef.current + dir));
      onSpanChange(newSpan);
    };
    const onMouseUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        ...(isLeft
          ? { right: -14, boxShadow: '2px 0 8px rgba(0,0,0,0.25)' }
          : { left: -14, boxShadow: '-2px 0 8px rgba(0,0,0,0.25)' }),
        borderRadius: 8,
        width: 14,
        height: 58,
        background: dragging ? '#ea580c' : '#f97316',
        cursor: 'ew-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 40,
        transition: dragging ? 'none' : 'background 0.15s',
      }}
      title="Táhni pro změnu šířky bočního panelu"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.85)' }} />
        ))}
      </div>
    </div>
  );
}

function LayoutRatioHandle({
  left,
  columns,
  columnGapPx,
  boundaryIndex,
  ratios,
  onChange,
}: {
  left: string;
  columns: 2 | 3;
  columnGapPx: number;
  boundaryIndex: number;
  ratios: number[];
  onChange: (nextRatios: number[]) => void;
}) {
  const startXRef = useRef(0);
  const startRatiosRef = useRef<number[]>(ratios);
  const [dragging, setDragging] = useState(false);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const container = e.currentTarget.parentElement;
    if (!container) return;

    startXRef.current = e.clientX;
    startRatiosRef.current = [...ratios];
    const containerWidth = container.getBoundingClientRect().width;
    const effectiveWidth = Math.max(80, containerWidth - (columns - 1) * columnGapPx);
    const minRatio = columns === 3 ? 15 : 25;
    setDragging(true);

    const onMouseMove = (ev: MouseEvent) => {
      const deltaPercent = ((ev.clientX - startXRef.current) / effectiveWidth) * 100;
      const nextRatios = [...startRatiosRef.current];
      let leftRatio = nextRatios[boundaryIndex] + deltaPercent;
      let rightRatio = nextRatios[boundaryIndex + 1] - deltaPercent;

      if (leftRatio < minRatio) {
        rightRatio -= (minRatio - leftRatio);
        leftRatio = minRatio;
      }
      if (rightRatio < minRatio) {
        leftRatio -= (minRatio - rightRatio);
        rightRatio = minRatio;
      }

      nextRatios[boundaryIndex] = leftRatio;
      nextRatios[boundaryIndex + 1] = rightRatio;
      onChange(nextRatios);
    };

    const onMouseUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        top: '50%',
        left,
        transform: 'translate(-50%, -50%)',
        borderRadius: 8,
        width: 14,
        height: 58,
        background: dragging ? '#ea580c' : '#f97316',
        cursor: 'ew-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 45,
        boxShadow: '0 3px 10px rgba(0,0,0,0.18)',
        transition: dragging ? 'none' : 'background 0.15s',
      }}
      title="Táhni pro změnu poměru sloupců"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.88)' }} />
        ))}
      </div>
    </div>
  );
}


export function GridCanvas({
  blocks: propBlocks,
  selectedBlockId,
  hoveredBlockId,
  onSelectBlock,
  onHoverBlock,
  onUpdateBlock,
  onUpdateBlockMargin,
  onUpdateBlockGridSpan,
  onUpdateTextFlowFrameHeight,
  onCreateTextFlowContinuation,
  onSplitTextFlowAtCaret,
  onCommitTextFlow,
  onDeleteBlock,
  onDuplicateBlock,
  onMoveBlockLeft,
  onMoveBlockRight,
  onMoveBlockUp,
  onMoveBlockDown,
  onAddBlock,
  onSwitchToAI,
  onOpenAddPanel,
  onOpenAI,
  globalFontSize = 'normal',
  pageFormat = 'a4',
  gridColumns = 12,
  gridGapPx = 16,
  showGridOverlay = false,
  pendingInsertType,
  onInsertBefore,
  isDraggingFromPanel,
  onDropBlock,
  pageBackgroundColor,
  pageHeader,
  pageFooter,
  onPageChange,
  pageColumnLayout = 'single',
  twoColumnASpan,
  pageOverrides,
}: GridCanvasProps) {
  const HEADER_HEIGHT = getHeaderHeight(pageHeader);
  const FOOTER_HEIGHT = getFooterHeight(pageFooter);

  // Filter out header-footer blocks suppressed by the global page config.
  // When pageHeader.enabled=false the legacy header-footer block must also be
  // hidden so the editor view stays consistent with the PDF / board thumbnail.
  const blocks = propBlocks.filter(block => {
    if (block.type !== 'header-footer') return true;
    const content = block.content as { variant?: string };
    if (content.variant === 'header' && pageHeader?.enabled === false) return false;
    if (content.variant === 'footer' && pageFooter?.enabled === false) return false;
    return true;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const textFlowCommitTimersRef = useRef<Record<string, number>>({});
  const [blockHeights, setBlockHeights] = useState<Record<string, number>>({});
  const [dropZoneActive, setDropZoneActive] = useState<string | null>(null); // 'before-{blockId}' or 'end'
  const PAGINATION_SAFETY_BUFFER = 1;
  const LAYOUT_SECTION_PAGINATION_OVERHEAD = 16;

  // ── Pagination heights for two-column mode ───────────────────────────────────
  // Prefer the actual live wrapper height when available so pagination reacts
  // immediately during resize / text-flow reflow and does not allow blocks to
  // visually slip into the safe zone before ResizeObserver catches up.
  const paginationHeights = useMemo(() => {
    const next = { ...blockHeights };
    if (typeof document !== 'undefined') {
      blocks.forEach((block) => {
        const liveWrapper = document.querySelector<HTMLElement>(`[data-grid-block-wrapper="${block.id}"]`);
        const liveHeight = liveWrapper?.offsetHeight ?? 0;
        if (liveHeight > 0) {
          next[block.id] = liveHeight;
        }
      });
    }
    return next;
  }, [blockHeights, blocks]);

  // Page dimensions – shared with PrintGridCanvas via page-layout.ts
  const pageWidth = PAGE_DIMENSIONS[pageFormat]?.width || PAGE_DIMENSIONS.a4.width;
  const pageHeight = PAGE_DIMENSIONS[pageFormat]?.height || PAGE_DIMENSIONS.a4.height;
  const contentWidth = pageWidth - PADDING * 2;
  const contentHeight = getContentHeight(pageFormat, pageHeader, pageFooter);
  const paginationContentHeight = Math.max(1, contentHeight - PAGINATION_SAFETY_BUFFER);
  const { top: contentPadTop, bottom: contentPadBot } = getContentPaddingV(pageHeader, pageFooter);
  const columnWidth = (contentWidth - (gridColumns - 1) * gridGapPx) / gridColumns;

  // Resize state for bobánky
  const [resizeState, setResizeState] = useState<{
    blockId: string;
    type: 'right' | 'bottom';
    startX: number;
    startY: number;
    startGridSpan: number;
    startMarginBottom: number;
    startCanvasHeight?: number;
    startTextFlowFrameHeight?: number;
    startNaturalFrameHeight?: number;
  } | null>(null);
  const [textFlowOverflowMap, setTextFlowOverflowMap] = useState<Record<string, boolean>>({});

  // Activity numbers
  const activityNumbers = useMemo(() => {
    const numbers: Record<string, number> = {};
    let counter = 1;
    blocks.forEach((block) => {
      if (
        !block.noActivityNumber &&
        (['multiple-choice', 'fill-blank', 'free-answer', 'matching', 'ordering', 'free-canvas'].includes(block.type) ||
          isCompareCountsParagraphBlock(block) || isPisankaParagraphBlock(block))
      ) {
        numbers[block.id] = counter++;
      }
    });
    return numbers;
  }, [blocks]);

  // ── Measure block heights with robust ResizeObserver ────────────────────────
  // IMPORTANT: The observer is created lazily inside blockRefCallback instead of
  // in a useEffect. This fixes a race condition on page refresh: when a worksheet
  // is loaded from localStorage all blocks are rendered in the FIRST React pass,
  // BEFORE any useEffect fires. If the observer were created in useEffect it would
  // be null when the first blockRefCallback runs, meaning blocks would never be
  // observed and blockHeights would stay {} permanently (defaulting to 100px).
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
              // borderBoxSize gives the true layout height, unaffected by CSS transform: scale()
              // getBoundingClientRect() would return the scaled (visual) height which is wrong here.
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

  // Disconnect observer on unmount
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      Object.values(textFlowCommitTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      textFlowCommitTimersRef.current = {};
    };
  }, []);

  const blockRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      getOrCreateObserver().observe(node);
    }
  }, [getOrCreateObserver]);

  // ── Track current visible page for AI panel (refs, registered after pagesData) ─
  const pageObserverRef = useRef<IntersectionObserver | null>(null);
  const pageRefsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const registerPageRef = useCallback((node: HTMLDivElement | null, pageIndex: number) => {
    if (node) {
      pageRefsRef.current.set(pageIndex, node);
    }
  }, []);

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

  const buildRenderUnits = (flatBlocks: WorksheetBlock[], heights: Record<string, number>): RenderUnit[] => {
    const units: RenderUnit[] = [];
    const consumedIds = new Set<string>();
    const layoutSectionIds = new Set(flatBlocks.filter(isLayoutSectionBlock).map((block) => block.id));
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
            const blockHeight = heights[childBlock.id] || 100;
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
        const segmentCount = Math.max(
          1,
          ...columnIds.map((columnId) => paginatedColumns[columnId]?.length ?? 0),
        );

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
                sum + (heights[childBlock.id] || 100) + (index > 0 ? gridGapPx : 0)
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
        const anchorH = heights[block.id] || 100;
        const mainH = mainBlocks.reduce((sum, b, idx) => sum + (heights[b.id] || 100) + (idx > 0 ? gridGapPx : 0), 0);
        // Compute anchor pixel width from floatGridSpan (grid-aligned) with fallback to floatWidthPercent
        const floatSpan: number = (block as any).floatGridSpan
          ?? Math.max(1, Math.round(((block as any).floatWidthPercent ?? 35) / 100 * gridColumns));
        const anchorPx = floatSpan * columnWidth + (floatSpan - 1) * gridGapPx;
        units.push({ type: 'float', anchor: block, side: block.floatSide, anchorPx, mainBlocks, height: Math.max(anchorH, mainH) });
        i += 1 + mainBlocks.length;
      } else {
        // Collect blocks in the same CSS grid row
        const isFF = (b: WorksheetBlock) => b.type === 'free-canvas' && (b.content as any).fullscreen;
        const span = (b: WorksheetBlock) => isFF(b) ? gridColumns : (b.gridSpan || gridColumns);
        const rowBlocks: WorksheetBlock[] = [block];
        let rowSpan = span(block);
        let rowH = heights[block.id] || 100;
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
          rowH = Math.max(rowH, heights[nb.id] || 100);
          j++;
        }
        units.push({ type: 'normal', blocks: rowBlocks, height: rowH });
        i = j;
      }
    }
    return units;
  };

  // ── Check if any page uses two-column layout ────────────────────────────────
  const hasAnyTwoCol = useMemo(() => {
    if (pageColumnLayout === 'two-columns') return true;
    if (pageOverrides) {
      return Object.values(pageOverrides).some(o => o.pageColumnLayout === 'two-columns');
    }
    return false;
  }, [pageColumnLayout, pageOverrides]);

  // ── Per-column pagination for two-column mode ────────────────────────────────
  // In two-column mode colA and colB run in PARALLEL. Page height = max(colA height, colB height).
  // Sequential pagination (old approach) incorrectly sums colA + colB heights, causing
  // premature page breaks. We paginate each column independently instead.
  const twoColPagesData = useMemo(() => {
    if (!hasAnyTwoCol) return null;

    const colABlocks = blocks.filter(b => (b.columnAssignment ?? 'A') === 'A');
    const colBBlocks = blocks.filter(b => b.columnAssignment === 'B');

    const paginateCol = (colBlocks: WorksheetBlock[]): WorksheetBlock[][] => {
      const pages: WorksheetBlock[][] = [];
      let current: WorksheetBlock[] = [];
      let height = 0;
      for (const block of colBlocks) {
        const h = paginationHeights[block.id] || 100;
        const nextHeight = current.length > 0 ? height + gridGapPx + h : h;
        if (current.length > 0 && nextHeight > paginationContentHeight) {
          pages.push(current);
          current = [];
          height = 0;
        }
        current.push(block);
        height = current.length > 1 ? height + gridGapPx + h : h;
      }
      if (current.length > 0 || pages.length === 0) pages.push(current);
      return pages;
    };

    const colAPages = paginateCol(colABlocks);
    const colBPages = paginateCol(colBBlocks);
    const numPages = Math.max(colAPages.length, colBPages.length, 1);

    return Array.from({ length: numPages }, (_, i) => ({
      colA: colAPages[i] ?? [],
      colB: colBPages[i] ?? [],
      pageNumber: i + 1,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, paginationHeights, paginationContentHeight, gridGapPx, hasAnyTwoCol]);

  // ── Calculate pages based on render units (single-column mode) ───────────────
  const pagesData = useMemo(() => {
    // When two-column mode is active, twoColPagesData drives the page count.
    // pagesData is only used for single-column rendering (effectiveLayout === 'single').
    const units = buildRenderUnits(blocks, paginationHeights);
    const pages: { units: RenderUnit[]; pageNumber: number }[] = [];
    let currentPageUnits: RenderUnit[] = [];
    let currentHeight = 0;
    let pageNumber = 1;

    units.forEach((unit) => {
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
  }, [blocks, paginationHeights, paginationContentHeight, gridColumns, gridGapPx]);

  // ── IntersectionObserver for visible page detection ──────────────────────────
  useEffect(() => {
    if (!onPageChange) return;
    pageObserverRef.current?.disconnect();
    const ratioMap = new Map<number, number>();

    pageObserverRef.current = new IntersectionObserver(
      (obsEntries) => {
        obsEntries.forEach(entry => {
          const idx = Number((entry.target as HTMLElement).dataset.pageIndex);
          ratioMap.set(idx, entry.intersectionRatio);
        });
        let bestIdx = 0;
        let bestRatio = -1;
        ratioMap.forEach((ratio, idx) => {
          if (ratio > bestRatio) { bestRatio = ratio; bestIdx = idx; }
        });
        if (bestRatio > 0) {
          const ids: string[] = [];
          if (twoColPagesData) {
            const tcPage = twoColPagesData[bestIdx];
            if (tcPage) {
              tcPage.colA.forEach(b => ids.push(b.id));
              tcPage.colB.forEach(b => ids.push(b.id));
            }
          } else {
            const pageUnits = pagesData[bestIdx]?.units || [];
            pageUnits.forEach(unit => {
              if (unit.type === 'normal') unit.blocks.forEach(b => ids.push(b.id));
              else if (unit.type === 'float') { ids.push(unit.anchor.id); unit.mainBlocks.forEach(b => ids.push(b.id)); }
              else { ids.push(unit.section.id); unit.columnIds.forEach((columnId) => (unit.columns[columnId] || []).forEach((b) => ids.push(b.id))); }
            });
          }
          onPageChange(bestIdx, ids);
        }
      },
      { threshold: [0, 0.1, 0.5, 1.0] }
    );

    pageRefsRef.current.forEach(el => pageObserverRef.current!.observe(el));
    return () => pageObserverRef.current?.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPageChange, pagesData]);

  // Handle resize drag
  useEffect(() => {
    if (!resizeState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeState.startX;
      const deltaY = e.clientY - resizeState.startY;

      if (resizeState.type === 'right' && onUpdateBlockGridSpan) {
        // Resize from right - change span only
        const columnsDelta = Math.round(deltaX / (columnWidth + gridGapPx));
        const newSpan = Math.max(1, Math.min(gridColumns, resizeState.startGridSpan + columnsDelta));
        onUpdateBlockGridSpan(resizeState.blockId, newSpan, 1); // gridStart is always 1 (auto-flow)
      } else if (resizeState.type === 'bottom') {
        const resizedBlock = blocks.find(b => b.id === resizeState.blockId);
        if (resizedBlock?.type === 'free-canvas' && resizeState.startCanvasHeight !== undefined) {
          // For Figma blocks: resize canvas height instead of margin
          const newH = Math.max(100, Math.min(1200, resizeState.startCanvasHeight + deltaY));
          onUpdateBlock(resizeState.blockId, { content: { ...(resizedBlock.content as any), canvasHeight: newH } });
        } else if (resizedBlock && supportsTextFlow(resizedBlock) && onUpdateTextFlowFrameHeight) {
          const currentFrameHeight = resizeState.startTextFlowFrameHeight
            ?? resizeState.startNaturalFrameHeight
            ?? 180;
          const startCombinedHeight = currentFrameHeight + (resizeState.startMarginBottom || 0);
          const maxAvailableHeight = getTextFlowAvailableFrameHeight(resizeState.blockId) ?? 1500;
          const nextCombinedHeight = Math.max(36, Math.min(maxAvailableHeight, Math.round(startCombinedHeight + deltaY)));

          // During live drag keep a literal frame height and no extra bottom margin.
          // Converting part of the drag into marginBottom causes visible jumps when
          // a clipped text block grows past its current fitted content height.
          onUpdateTextFlowFrameHeight(resizeState.blockId, nextCombinedHeight, { reflow: false, mode: 'manual' });
          onUpdateBlockMargin(resizeState.blockId, 0);
        } else {
          const newMargin = Math.max(0, Math.min(300, resizeState.startMarginBottom + deltaY));
          onUpdateBlockMargin(resizeState.blockId, newMargin);
        }
      }
    };

    const handleMouseUp = () => {
      if (resizeState.type === 'bottom' && onCommitTextFlow) {
        const resizedBlock = blocks.find((block) => block.id === resizeState.blockId);
        if (resizedBlock && supportsTextFlow(resizedBlock)) {
          onCommitTextFlow(resizeState.blockId);
        }
      }
      setResizeState(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeState, columnWidth, gridGapPx, gridColumns, onUpdateBlockGridSpan, onUpdateBlockMargin, blocks, onUpdateBlock, onUpdateTextFlowFrameHeight, onCommitTextFlow]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const next: Record<string, boolean> = {};
      blocks.forEach((block) => {
        if (supportsTextFlow(block) && block.textFlowFrameHeight) {
          next[block.id] = detectTextFlowOverflow(block.id);
        }
      });
      setTextFlowOverflowMap(next);
    });
    return () => cancelAnimationFrame(id);
  }, [blocks, selectedBlockId, hoveredBlockId]);

  const selectedTextFlowIds = useMemo(() => {
    if (!selectedBlockId) return new Set<string>();
    const chain = getOrderedTextFlowChain(blocks, selectedBlockId);
    return new Set(chain.map((block) => block.id));
  }, [blocks, selectedBlockId]);

  // Start resize
  const startResize = useCallback((
    e: React.MouseEvent,
    blockId: string,
    type: 'right' | 'bottom',
    block: WorksheetBlock
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const frameEl = document.querySelector<HTMLElement>(`[data-text-flow-frame-for="${blockId}"]`);
    setResizeState({
      blockId,
      type,
      startX: e.clientX,
      startY: e.clientY,
      startGridSpan: block.gridSpan || gridColumns,
      startMarginBottom: block.marginBottom || 0,
      startCanvasHeight: block.type === 'free-canvas' ? ((block.content as any).canvasHeight || 400) : undefined,
      startTextFlowFrameHeight: frameEl
        ? Math.round(frameEl.getBoundingClientRect().height)
        : block.textFlowFrameHeight,
      startNaturalFrameHeight: frameEl ? Math.round(frameEl.scrollHeight) : undefined,
    });
    
    onSelectBlock(blockId);
  }, [gridColumns, onSelectBlock]);

  // Render block with bobánky
  const renderBlock = (block: WorksheetBlock, inFlex = false) => {
    const isSelected = selectedBlockId === block.id;
    const isHovered = hoveredBlockId === block.id;
    const isTextFlowSiblingSelected = !isSelected && selectedTextFlowIds.has(block.id);
    // fullscreen Figma blocks always span all columns
    const isFullscreenFigma = block.type === 'free-canvas' && (block.content as any).fullscreen;
    const blockGridSpan = isFullscreenFigma ? gridColumns : (block.gridSpan || gridColumns);
    
    // Can resize? (not in flex mode)
    const canShrinkRight = !inFlex && !isFullscreenFigma && blockGridSpan > 1;
    const canGrowRight = !inFlex && !isFullscreenFigma && blockGridSpan < gridColumns;
    const supportsFlow = supportsTextFlow(block);
    const hasFlowFrame = !!block.textFlowFrameHeight;
    const isFlowOverflowing = textFlowOverflowMap[block.id] ?? false;
    const showFlowChainButton = isSelected && supportsFlow && hasFlowFrame && !block.textFlowNextBlockId;
    const flowDebugMetrics = import.meta.env.DEV && supportsFlow ? getTextFlowDebugMetrics(block.id) : null;

    // For fullscreen Figma blocks, derive canvas height from the page format constants
    // so the block always fills exactly one A4/B5/A5 page regardless of user settings.
    // contentHeight = pageHeight - HEADER_HEIGHT - FOOTER_HEIGHT (already computed above)
    const blockForRender: WorksheetBlock = isFullscreenFigma
      ? { ...block, content: { ...(block.content as any), canvasHeight: contentHeight } }
      : block;

    return (
      <div 
        key={block.id}
        className="relative"
        ref={blockRefCallback}
        data-grid-block-wrapper={block.id}
        style={{ 
          ...(inFlex ? {
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
          } : {
            gridColumn: `span ${blockGridSpan}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: (
              (block.content as any)?.verticalAlign === 'center' ? 'center' :
              (block.content as any)?.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start'
            ),
          }),
        }}
        data-block-id={block.id}
        onMouseEnter={() => onHoverBlock?.(block.id)}
        onMouseLeave={() => onHoverBlock?.(null)}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Block content */}
        <EditableBlock
          block={blockForRender}
          isSelected={isSelected}
          isHovered={isHovered}
          onSelect={() => onSelectBlock(block.id)}
          onUpdate={(patch) => {
            // If patch contains 'image' (top-level block property), update it directly
            if (patch && typeof patch === 'object' && 'image' in patch) {
              onUpdateBlock(block.id, { image: patch.image });
            } else {
              onUpdateBlock(block.id, { content: patch });
              if (supportsFlow && onCommitTextFlow) {
                const existingTimer = textFlowCommitTimersRef.current[block.id];
                if (existingTimer) {
                  window.clearTimeout(existingTimer);
                }
                textFlowCommitTimersRef.current[block.id] = window.setTimeout(() => {
                  delete textFlowCommitTimersRef.current[block.id];
                  onCommitTextFlow(block.id);
                }, 120);
              }
            }
          }}
          onUpdateMargin={(margin) => onUpdateBlockMargin(block.id, margin)}
          onDelete={onDeleteBlock ? () => onDeleteBlock(block.id) : undefined}
          onDuplicate={onDuplicateBlock ? () => onDuplicateBlock(block.id) : undefined}
          onMoveLeft={onMoveBlockLeft && block.layoutSectionId ? () => onMoveBlockLeft(block.id) : undefined}
          onMoveRight={onMoveBlockRight && block.layoutSectionId ? () => onMoveBlockRight(block.id) : undefined}
          onMoveUp={onMoveBlockUp ? () => onMoveBlockUp(block.id) : undefined}
          onMoveDown={onMoveBlockDown ? () => onMoveBlockDown(block.id) : undefined}
          globalFontSize={globalFontSize}
          activityNumber={activityNumbers[block.id]}
          onOpenAI={onOpenAI}
          onTextFlowBlur={onCommitTextFlow}
          onTextFlowSplitAtCaret={onSplitTextFlowAtCaret}
        />

        {/* Selection border and bobánky */}
        {(isSelected || isHovered || isTextFlowSiblingSelected) && (
          <>
            {/* Blue selection border */}
            <div
              className="absolute inset-0 pointer-events-none print:hidden"
              style={{
                border: isSelected
                  ? '2px solid #3B82F6'
                  : isTextFlowSiblingSelected
                    ? '2px solid rgba(59, 130, 246, 0.55)'
                    : '2px dashed #93C5FD',
                borderRadius: '6px',
                zIndex: 90,
                boxShadow: isTextFlowSiblingSelected ? '0 0 0 3px rgba(59,130,246,0.12)' : undefined,
              }}
            />

            {/* Right bobánek - resize width */}
            {isSelected && (canShrinkRight || canGrowRight) && (
              <div
                onMouseDown={(e) => startResize(e, block.id, 'right', block)}
                className="absolute print:hidden transition-all hover:scale-105 active:scale-95 select-none cursor-ew-resize"
                style={{
                  right: '-12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '20px',
                  height: '56px',
                  backgroundColor: resizeState?.blockId === block.id && resizeState?.type === 'right' ? '#1D4ED8' : '#3B82F6',
                  borderRadius: '10px',
                  border: '2px solid white',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
                  zIndex: 10001,
                }}
                title={`Táhni pro změnu velikosti (${blockGridSpan}/${gridColumns} sloupců)`}
              />
            )}

            {/* Bottom bobánek - add margin */}
            {isSelected && (
              <>
                <div
                  onMouseDown={(e) => startResize(e, block.id, 'bottom', blockForRender)}
                  className="absolute print:hidden transition-all hover:scale-105 active:scale-95 select-none cursor-ns-resize"
                  style={{
                    bottom: '-14px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '56px',
                    height: '20px',
                    backgroundColor: isFlowOverflowing
                      ? (resizeState?.blockId === block.id && resizeState?.type === 'bottom' ? '#dc2626' : '#ef4444')
                      : (resizeState?.blockId === block.id && resizeState?.type === 'bottom' ? '#1D4ED8' : '#3B82F6'),
                    borderRadius: '10px',
                    border: '2px solid white',
                    boxShadow: isFlowOverflowing ? '0 2px 8px rgba(239, 68, 68, 0.35)' : '0 2px 8px rgba(59, 130, 246, 0.4)',
                    zIndex: 10001,
                  }}
                  title={supportsFlow ? 'Táhni nahoru pro ořez textu, dolů pro prostor pod blokem' : 'Táhni dolů pro přidání mezery'}
                />
                {flowDebugMetrics && (
                  <div
                    className="absolute print:hidden pointer-events-none rounded-md border border-slate-200 bg-white/95 px-2 py-1 text-[10px] font-medium text-slate-700 shadow-sm"
                    style={{
                      left: '50%',
                      bottom: '-52px',
                      transform: 'translateX(-50%)',
                      zIndex: 10003,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {`avail ${flowDebugMetrics.estimatedAvailableLines} / real ${flowDebugMetrics.estimatedRenderedLines} / vis ${flowDebugMetrics.estimatedVisibleLines} / h ${flowDebugMetrics.frameHeight}px / a ${flowDebugMetrics.availableHeight ?? '-'}`}
                  </div>
                )}
              </>
            )}

            {showFlowChainButton && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCreateTextFlowContinuation?.(block.id);
                }}
                className="absolute print:hidden transition-all hover:scale-105 active:scale-95"
                style={{
                  bottom: '-14px',
                  left: 'calc(50% + 42px)',
                  transform: 'translateX(-50%)',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: '2px solid white',
                  backgroundColor: isFlowOverflowing ? '#ef4444' : '#1e40af',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isFlowOverflowing ? '0 2px 10px rgba(239,68,68,0.4)' : '0 2px 10px rgba(30,64,175,0.35)',
                  zIndex: 10002,
                  cursor: 'pointer',
                }}
                title="Vytvořit navazující textový blok"
              >
                <Link2 size={14} />
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div 
      ref={containerRef}
      className="worksheet-pages-row pages-row"
      style={{ 
        width: `${pageWidth}px`, 
        marginLeft: 'auto', 
        marginRight: 'auto',
      }}
    >
      {/* Render pages */}
      {/* When any page is in two-column mode, twoColPagesData drives the page count and block distribution.
          Each column is paginated independently (colA/colB run in parallel, not sequentially). */}
      {(twoColPagesData ?? pagesData).map((_pageData, pageIndex) => {
        const page = twoColPagesData ? { units: [] as RenderUnit[], pageNumber: pageIndex + 1 } : (pagesData[pageIndex] ?? { units: [], pageNumber: pageIndex + 1 });
        // Per-page effective layout: override wins over global
        const effectivePageColumnLayout = pageOverrides?.[pageIndex]?.pageColumnLayout ?? pageColumnLayout;
        const effectiveTwoColumnASpan = pageOverrides?.[pageIndex]?.twoColumnASpan ?? twoColumnASpan;
        return (
        <React.Fragment key={pageIndex}>
          <div
            ref={(node) => registerPageRef(node, pageIndex)}
            data-page-index={pageIndex}
            className="relative shadow-xl rounded-sm print:shadow-none print:rounded-none worksheet-a4-page a4-page"
            style={{
              position: 'relative',
              zIndex: 10,
              width: `${pageWidth}px`,
              height: `${pageHeight}px`,
              marginBottom: 0,
              boxShadow: '0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
              backgroundColor: pageBackgroundColor || '#FFFFFF',
              overflow: 'visible',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={() => onSelectBlock(null)}
          >
            {/* Safe zone border indicator – 5mm inset, editor only */}
            <div
              className="print:hidden"
              style={{
                position: 'absolute',
                inset: `${Math.round(5 * MM_TO_PX)}px`,
                border: '1px dashed rgba(148,163,184,0.4)',
                borderRadius: '2px',
                pointerEvents: 'none',
                zIndex: 4,
              }}
            />

            {/* Grid overlay */}
            {showGridOverlay && (
              <GridOverlay
                columns={gridColumns}
                gap={gridGapPx}
                pageWidth={pageWidth}
                headerHeight={HEADER_HEIGHT}
                footerHeight={FOOTER_HEIGHT}
              />
            )}

            {/* Fixed header */}
            <PageHeader config={pageHeader} padding={PADDING} style={{ flexShrink: 0 }} />

            {/* Content area - CSS Grid layout (or two-column split) */}
            <div
              data-page-content-grid="true"
              style={{
                paddingLeft: PADDING,
                paddingRight: PADDING,
                paddingTop: contentPadTop,
                paddingBottom: contentPadBot,
                flex: 1,
                minHeight: 0,
                position: 'relative',
                zIndex: 20,
                overflow: 'visible',
                // Písanka: jednotný okraj ze všech stran (viz PISANKA_PAGE_OUTER_INSET_PX)
                ...({
                  '--vb-pisanka-page-outer-inset': `${PISANKA_PAGE_OUTER_INSET_PX}px`,
                  '--vb-pisanka-page-inner-min-height': `${Math.max(0, contentHeight - 2 * PISANKA_PAGE_OUTER_INSET_PX)}px`,
                } as React.CSSProperties),
                ...(effectivePageColumnLayout === 'two-columns'
                  ? { display: 'flex', gap: `${gridGapPx}px`, alignItems: 'flex-start' }
                  : { display: 'grid', gridTemplateColumns: `repeat(${gridColumns}, 1fr)`, gap: `${gridGapPx}px`, alignItems: 'start', alignContent: 'start' }),
              }}
            >
              {(twoColPagesData ? (twoColPagesData[pageIndex]?.colA.length === 0 && twoColPagesData[pageIndex]?.colB.length === 0) : page.units.length === 0) && pageIndex === 0 ? (
                /* Empty state */
                <>
                  {/* Drop zone for empty page */}
                  {isDraggingFromPanel && (
                    <DropZone
                      zoneId="end"
                      isActive={dropZoneActive === 'end'}
                      onDragEnter={() => setDropZoneActive('end')}
                      onDragLeave={() => setDropZoneActive(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        const blockType = e.dataTransfer.getData('application/x-block-type') as BlockType;
                        if (blockType && onDropBlock) {
                          onDropBlock(blockType, null);
                        }
                        setDropZoneActive(null);
                      }}
                      gridColumns={gridColumns}
                    />
                  )}
                  <div 
                    className="h-full flex flex-col items-center justify-center text-center py-20"
                    style={{ gridColumn: '1 / -1' }} // Span all columns
                  >
                    <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                      <Sparkles className="h-8 w-8 text-blue-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">
                      Začněte tvořit
                    </h3>
                    <p className="text-slate-500 max-w-sm mb-6">
                      Popište AI asistentovi, jaký pracovní list chcete vytvořit, nebo přidejte bloky ručně.
                    </p>
                  </div>
                </>
              ) : effectivePageColumnLayout === 'two-columns' ? (
                /* ── Two-column page layout ── */
                (() => {
                  // Use twoColPagesData for block selection — each column is paginated independently.
                  // This means colA and colB are distributed based on their own height budgets (parallel),
                  // not summed sequentially, so blocks fit correctly without premature page breaks.
                  const tcPage = twoColPagesData?.[pageIndex];
                  const fallbackBlocks = page.units.flatMap((unit) => {
                    if (unit.type === 'normal') return unit.blocks;
                    if (unit.type === 'float') return [unit.anchor, ...unit.mainBlocks];
                    return [unit.section, ...unit.columnIds.flatMap((columnId) => unit.columns[columnId] || [])];
                  });
                  const colA = tcPage ? tcPage.colA : fallbackBlocks.filter(b => (b.columnAssignment ?? 'A') === 'A');
                  const colB = tcPage ? tcPage.colB : fallbackBlocks.filter(b => b.columnAssignment === 'B');
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
                  const colColor = (col: 'A' | 'B') => col === 'A' ? '#10b981' : '#3b82f6';
                  const renderCol = (blocks: WorksheetBlock[], col: 'A' | 'B') => {
                    const colSpan = col === 'A' ? aSpan : bSpan;
                    return (
                    <div key={col} style={colStyle(col)}>
                      {blocks.map(b => {
                        // Remap gridSpan to column's grid: full-width blocks fill column, others capped
                        const origSpan = b.gridSpan || gridColumns;
                        const remappedSpan = origSpan >= gridColumns ? colSpan : Math.min(origSpan, colSpan);
                        const adjustedBlock: WorksheetBlock = remappedSpan === origSpan ? b : { ...b, gridSpan: remappedSpan };
                        return <React.Fragment key={b.id}>{renderBlock(adjustedBlock)}</React.Fragment>;
                      })}
                      {blocks.length === 0 && (
                        <div style={{
                          gridColumn: '1 / -1',
                          border: `2px dashed ${colColor(col)}44`,
                          borderRadius: 8, padding: '24px 12px',
                          color: `${colColor(col)}88`,
                          textAlign: 'center', fontSize: 11,
                        }}>
                          Sloupec {col} — přetáhni nebo přiřaď bloky tlačítkem A/B
                        </div>
                      )}
                    </div>
                    );
                  };
                  return <>{renderCol(colA, 'A')}{renderCol(colB, 'B')}</>;
                })()
              ) : (
                /* ── Normal CSS Grid ── */
                <>
                  {page.units.map((unit) => {
                    if (unit.type === 'layout-section') {
                      const sectionContent = normalizeLayoutSectionContent(unit.section.content);
                      const layoutSelected = selectedBlockId === unit.section.id
                        || unit.columnIds.some((columnId) => (unit.columns[columnId] || []).some((block) => block.id === selectedBlockId));
                      const layoutGridSpan = Math.min(gridColumns, unit.section.gridSpan || gridColumns);
                      const columnRatios = sectionContent.columnRatios ?? (sectionContent.columns === 3 ? [34, 33, 33] : [50, 50]);
                      const totalRatios = columnRatios.reduce((sum, value) => sum + value, 0) || 100;
                      const layoutGapPx = sectionContent.columnGap ?? gridGapPx;
                      const visualGapPx = layoutGapPx;
                      const totalGapPx = (sectionContent.columns - 1) * visualGapPx;
                      const columnTemplate = columnRatios.map((ratio) => `minmax(0, ${ratio}fr)`).join(' ');

                      return (
                        <div
                          key={unit.unitId}
                          style={{
                            gridColumn: `span ${layoutGridSpan}`,
                            padding: 0,
                          }}
                          onClick={() => onSelectBlock(unit.section.id)}
                        >
                          <div
                            style={{
                              position: 'relative',
                              display: 'grid',
                              gridTemplateColumns: columnTemplate,
                              gap: `${visualGapPx}px`,
                              alignItems: 'stretch',
                            }}
                          >
                            {unit.columnIds.map((columnId) => {
                              const columnBlocks = unit.columns[columnId] || [];
                              const zoneLabel = `layout-${unit.section.id}-${columnId}`;

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
                                    boxShadow: layoutSelected
                                      ? 'inset 0 0 0 1px rgba(59, 130, 246, 0.18)'
                                      : 'none',
                                    transition: 'background-color 0.18s ease, box-shadow 0.18s ease',
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

                                  {columnBlocks.map((block) => (
                                    <React.Fragment key={block.id}>
                                      {isDraggingFromPanel && (
                                        <LayoutColumnDropZone
                                          isActive={dropZoneActive === `layout-before-${block.id}`}
                                          onDragEnter={() => setDropZoneActive(`layout-before-${block.id}`)}
                                          onDragLeave={() => setDropZoneActive(null)}
                                          onDrop={(e) => {
                                            e.preventDefault();
                                            const blockType = e.dataTransfer.getData('application/x-block-type') as BlockType;
                                            if (blockType && onDropBlock) {
                                              onDropBlock(blockType, null, {
                                                layoutSectionId: unit.section.id,
                                                layoutColumnId: columnId,
                                                insertBeforeId: block.id,
                                              });
                                            }
                                            setDropZoneActive(null);
                                          }}
                                        />
                                      )}
                                      {renderBlock({
                                        ...block,
                                        width: 'full',
                                        widthPercent: undefined,
                                        gridSpan: layoutGridSpan,
                                      }, true)}
                                    </React.Fragment>
                                  ))}

                                  {isDraggingFromPanel && (
                                    <LayoutColumnDropZone
                                      isActive={dropZoneActive === `${zoneLabel}-end`}
                                      onDragEnter={() => setDropZoneActive(`${zoneLabel}-end`)}
                                      onDragLeave={() => setDropZoneActive(null)}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        const blockType = e.dataTransfer.getData('application/x-block-type') as BlockType;
                                        if (blockType && onDropBlock) {
                                          onDropBlock(blockType, null, {
                                            layoutSectionId: unit.section.id,
                                            layoutColumnId: columnId,
                                          });
                                        }
                                        setDropZoneActive(null);
                                      }}
                                    />
                                  )}
                                </div>
                              );
                            })}
                            {layoutSelected && unit.segmentIndex === 0 && Array.from({ length: sectionContent.columns - 1 }).map((_, boundaryIndex) => {
                              const cumulativeRatio = columnRatios
                                .slice(0, boundaryIndex + 1)
                                .reduce((sum, value) => sum + value, 0);
                              const percent = (cumulativeRatio / totalRatios) * 100;
                              const offsetPx = boundaryIndex * layoutGapPx + (layoutGapPx / 2) - ((cumulativeRatio / totalRatios) * totalGapPx);
                              return (
                                <LayoutRatioHandle
                                  key={`layout-handle-${unit.unitId}-${boundaryIndex}`}
                                  left={`calc(${percent}% + ${offsetPx}px)`}
                                  columns={sectionContent.columns}
                                  columnGapPx={visualGapPx}
                                  boundaryIndex={boundaryIndex}
                                  ratios={columnRatios}
                                  onChange={(nextRatios) => {
                                    onUpdateBlock(unit.section.id, {
                                      content: {
                                        ...sectionContent,
                                        layoutStyle: 'custom',
                                        columnRatios: nextRatios,
                                      },
                                    });
                                  }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    // Float group: anchor + main blocks side by side
                    if (unit.type === 'float') {
                      const anchorBlock = unit.anchor;
                      const isLeft = unit.side === 'left';
                      const floatSelected = selectedBlockId === anchorBlock.id || unit.mainBlocks.some(b => b.id === selectedBlockId);
                      const currentFloatSpan: number = (anchorBlock as any).floatGridSpan ?? 5;

                      return (
                        <React.Fragment key={anchorBlock.id}>
                          {isDraggingFromPanel && (
                            <DropZone
                              zoneId={`before-${anchorBlock.id}`}
                              isActive={dropZoneActive === `before-${anchorBlock.id}`}
                              onDragEnter={() => setDropZoneActive(`before-${anchorBlock.id}`)}
                              onDragLeave={() => setDropZoneActive(null)}
                              onDrop={(e) => {
                                e.preventDefault();
                                const blockType = e.dataTransfer.getData('application/x-block-type') as BlockType;
                                if (blockType && onDropBlock) onDropBlock(blockType, anchorBlock.id);
                                setDropZoneActive(null);
                              }}
                              gridColumns={gridColumns}
                            />
                          )}
                          {/* Float group wrapper with orange background when selected */}
                          <div
                            style={{
                              gridColumn: '1 / -1',
                              position: 'relative',
                              borderRadius: 10,
                              background: floatSelected ? '#FFE3DA' : 'transparent',
                              transition: 'background 0.15s',
                              padding: floatSelected ? '6px' : 0,
                              margin: floatSelected ? -6 : 0,
                              zIndex: floatSelected ? 2147483646 : 'auto',
                            }}
                            onClick={() => onSelectBlock(anchorBlock.id)}
                          >
                            {/* Float content: anchor + main blocks */}
                            <div style={{
                              display: 'flex',
                              gap: `${gridGapPx}px`,
                              alignItems: 'flex-start',
                              flexDirection: isLeft ? 'row' : 'row-reverse',
                            }}>
                              {/* Anchor block */}
                              <div style={{
                                position: 'relative', width: `${unit.anchorPx}px`, flexShrink: 0,
                                borderRadius: 10,
                              }}>
                                {renderBlock(anchorBlock, true)}
                                {/* Resize bobánek – vždy na LEVÉM okraji anchor bloku */}
                                {floatSelected && (
                                  <FloatResizeHandle
                                    side="left"
                                    currentSpan={currentFloatSpan}
                                    columnWidth={columnWidth}
                                    gridGapPx={gridGapPx}
                                    gridColumns={gridColumns}
                                    isLeft={isLeft}
                                    onSpanChange={(newSpan) => {
                                      onUpdateBlock(anchorBlock.id, { floatGridSpan: newSpan } as any);
                                    }}
                                  />
                                )}
                              </div>
                              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: `${gridGapPx}px` }}>
                                {unit.mainBlocks.map(b => renderBlock(b, true))}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    }
                    // Normal grid row
                    return unit.blocks.map((block) => (
                      <React.Fragment key={block.id}>
                        {isDraggingFromPanel && (
                          <DropZone
                            zoneId={`before-${block.id}`}
                            isActive={dropZoneActive === `before-${block.id}`}
                            onDragEnter={() => setDropZoneActive(`before-${block.id}`)}
                            onDragLeave={() => setDropZoneActive(null)}
                            onDrop={(e) => {
                              e.preventDefault();
                              const blockType = e.dataTransfer.getData('application/x-block-type') as BlockType;
                              if (blockType && onDropBlock) onDropBlock(blockType, block.id);
                              setDropZoneActive(null);
                            }}
                            gridColumns={gridColumns}
                          />
                        )}
                        {renderBlock(block)}
                      </React.Fragment>
                    ));
                  })}
                  {isDraggingFromPanel && (
                    <DropZone
                      zoneId="end"
                      isActive={dropZoneActive === 'end'}
                      onDragEnter={() => setDropZoneActive('end')}
                      onDragLeave={() => setDropZoneActive(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        const blockType = e.dataTransfer.getData('application/x-block-type') as BlockType;
                        if (blockType && onDropBlock) onDropBlock(blockType, null);
                        setDropZoneActive(null);
                      }}
                      gridColumns={gridColumns}
                    />
                  )}
                </>
              )}
            </div>

            {/* Fixed footer */}
            <PageFooter
              config={pageFooter}
              pageNumber={page.pageNumber}
              totalPages={pagesData.length}
              padding={PADDING}
              style={{ flexShrink: 0 }}
            />

            {/* Page number indicator (right side) */}
            <div 
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-100 text-slate-500 px-2 py-1 rounded text-xs print:hidden"
            >
              {page.pageNumber}
            </div>
          </div>

          {/* Page break between pages */}
          {pageIndex < pagesData.length - 1 && (
            <PageBreak pageNumber={page.pageNumber} />
          )}

        </React.Fragment>
      );
      })}
    </div>
  );
}
