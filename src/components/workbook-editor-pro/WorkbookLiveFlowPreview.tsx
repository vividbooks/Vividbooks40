import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { PenLine } from 'lucide-react';
import type { Worksheet } from '../../types/worksheet';
import { PAGE_DIMENSIONS, type PageFormat } from '../../utils/page-layout';
import { PrintGridCanvas } from '../worksheet-editor-pro/PrintGridCanvas';
import { WorkbookLivePagePreview } from './WorkbookLivePagePreview';
import { createTextFlowContinuation, reflowTextFlowChain, supportsTextFlow } from '../../utils/text-flow';

interface WorkbookLiveFlowPreviewProps {
  worksheet: Worksheet | null;
  containerWidth: number;
  borderRadius?: string;
  maxScrollHeight?: number;
  /** Otevře Pro editor se stejným obsahem, scroll na vybranou stránku. */
  onOpenPageInEditor?: (worksheet: Worksheet, pageIndex: number) => void;
}

/**
 * Více stránek pod sebou — každá v poměru formátu (A4…) jako v knize.
 * Nejprve skrytý celý PrintGridCanvas zjistí počet stránek, pak se vykreslí jednotlivé náhledy.
 */
export const WorkbookLiveFlowPreview = memo(function WorkbookLiveFlowPreview({
  worksheet,
  containerWidth,
  borderRadius = '12px',
  maxScrollHeight = 920,
  onOpenPageInEditor,
}: WorkbookLiveFlowPreviewProps) {
  const [previewWorksheet, setPreviewWorksheet] = useState<Worksheet | null>(worksheet);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const autoFlowBusyRef = useRef(false);
  const measureRootRef = useRef<HTMLDivElement | null>(null);

  const pageFormat = (previewWorksheet?.metadata?.pageFormat as PageFormat | undefined) || 'a4';
  const dims = PAGE_DIMENSIONS[pageFormat] || PAGE_DIMENSIONS.a4;
  const pagePreviewH = Math.round((containerWidth * dims.height) / dims.width);

  const measureKey = `${previewWorksheet?.id ?? ''}:${previewWorksheet?.updatedAt ?? ''}`;
  const fallbackPageCount = Math.max(1, Number(previewWorksheet?.metadata?.pageCount ?? 1) || 1);
  const resolvedPageCount = pageCount ?? fallbackPageCount;

  useEffect(() => {
    setPreviewWorksheet(worksheet);
  }, [worksheet]);

  useEffect(() => {
    setPageCount(null);
  }, [measureKey]);

  const handleStableMeta = useCallback(({ pageCount: n }: { pageCount: number }) => {
    setPageCount(Math.max(1, n));
  }, []);

  useEffect(() => {
    if (!previewWorksheet || typeof document === 'undefined' || autoFlowBusyRef.current || !measureRootRef.current) return;

    const timer = window.setTimeout(() => {
      if (autoFlowBusyRef.current) return;
      const overflowing = previewWorksheet.blocks.find((block) => {
        if (!supportsTextFlow(block)) return false;
        const frameEl = measureRootRef.current?.querySelector<HTMLElement>(`[data-text-flow-frame-for="${block.id}"]`);
        const contentEl = frameEl?.closest<HTMLElement>('[data-page-content-grid="true"]');
        if (!frameEl || !contentEl) return false;
        const frameRect = frameEl.getBoundingClientRect();
        const contentRect = contentEl.getBoundingClientRect();
        return frameRect.bottom > contentRect.bottom + 1;
      });

      if (!overflowing) return;
      autoFlowBusyRef.current = true;
      setPreviewWorksheet((prev) => {
        if (!prev) return prev;
        const frameEl = measureRootRef.current?.querySelector<HTMLElement>(`[data-text-flow-frame-for="${overflowing.id}"]`);
        const contentEl = frameEl?.closest<HTMLElement>('[data-page-content-grid="true"]');
        if (!frameEl || !contentEl) return prev;
        const availableHeight = Math.floor(contentEl.getBoundingClientRect().bottom - frameEl.getBoundingClientRect().top - 4);
        if (!Number.isFinite(availableHeight) || availableHeight < 36) return prev;

        let nextBlocks = prev.blocks.map((block) => (
          block.id === overflowing.id
            ? { ...block, textFlowFrameHeight: availableHeight, textFlowFrameMode: 'auto', marginBottom: 0 }
            : block
        ));
        const linked = nextBlocks.find((block) => block.id === overflowing.id);
        if (!linked) return prev;

        let didCreateContinuation = false;
        if (linked.textFlowNextBlockId) {
          nextBlocks = reflowTextFlowChain(nextBlocks, overflowing.id);
        } else {
          const result = createTextFlowContinuation(nextBlocks, overflowing.id);
          if (!result.newBlockId) return prev;
          nextBlocks = result.blocks;
          didCreateContinuation = true;
        }

        return {
          ...prev,
          blocks: nextBlocks,
          metadata: {
            ...prev.metadata,
            pageCount: didCreateContinuation
              ? Math.max(1, Number(prev.metadata?.pageCount ?? 1) + 1)
              : Math.max(1, Number(prev.metadata?.pageCount ?? 1)),
          },
          updatedAt: new Date().toISOString(),
        };
      });
      window.setTimeout(() => {
        autoFlowBusyRef.current = false;
      }, 0);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [previewWorksheet, resolvedPageCount]);

  const canRender = Boolean(previewWorksheet && Array.isArray(previewWorksheet.blocks));

  return (
    <div
      style={{
        width: '100%',
        maxWidth: containerWidth,
        maxHeight: maxScrollHeight,
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
        borderRadius,
        background: '#f1f5f9',
        fontSize: '16px',
      }}
    >
      {canRender ? (
        <div
          ref={measureRootRef}
          aria-hidden
          style={{
            position: 'absolute',
            left: -28000,
            top: 0,
            width: dims.width,
            pointerEvents: 'none',
            opacity: 0,
          }}
        >
          <PrintGridCanvas worksheet={previewWorksheet!} hideAttributions={true} onStableMeta={handleStableMeta} />
        </div>
      ) : null}

      {canRender ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 0' }}>
          {Array.from({ length: resolvedPageCount }, (_, i) => (
            <div key={`${measureKey}-p-${i}`} style={{ width: containerWidth, flexShrink: 0 }}>
              <div
                style={{
                  width: containerWidth,
                  height: pagePreviewH,
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: '1px solid rgba(15, 23, 42, 0.12)',
                  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.12)',
                  backgroundColor: '#ffffff',
                }}
              >
                <WorkbookLivePagePreview
                  worksheet={previewWorksheet}
                  pageIndex={i}
                  width={containerWidth}
                  height={pagePreviewH}
                  borderRadius="10px"
                  forceVisible
                />
              </div>
              {onOpenPageInEditor ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => previewWorksheet && onOpenPageInEditor(previewWorksheet, i)}
                    title="Otevřít tento souvislý náhled v Pro editoru (nová karta / rozšířená úprava)."
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 10px',
                      borderRadius: 8,
                      border: '1px solid rgba(51, 65, 85, 0.9)',
                      backgroundColor: 'rgba(15, 23, 42, 0.04)',
                      color: '#334155',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <PenLine size={12} />
                    Otevřít v editoru
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {!canRender ? (
        <div
          style={{
            minHeight: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: 11,
          }}
        >
          —
        </div>
      ) : null}
    </div>
  );
}, (prev, next) => {
  if (prev.containerWidth !== next.containerWidth) return false;
  if (prev.borderRadius !== next.borderRadius) return false;
  if (prev.maxScrollHeight !== next.maxScrollHeight) return false;
  if ((prev.worksheet?.id ?? null) !== (next.worksheet?.id ?? null)) return false;
  if ((prev.worksheet?.updatedAt ?? null) !== (next.worksheet?.updatedAt ?? null)) return false;
  const prevOk = Boolean(prev.worksheet && Array.isArray(prev.worksheet.blocks));
  const nextOk = Boolean(next.worksheet && Array.isArray(next.worksheet.blocks));
  if (prevOk !== nextOk) return false;
  if (prev.onOpenPageInEditor !== next.onOpenPageInEditor) return false;
  return true;
});
