import { memo, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Worksheet } from '../../types/worksheet';
import { PAGE_DIMENSIONS, type PageFormat } from '../../utils/page-layout';
import { PrintGridCanvas } from '../worksheet-editor-pro/PrintGridCanvas';

const stablePreviewKeys = new Set<string>();

interface WorkbookLivePagePreviewProps {
  worksheet: Worksheet | null;
  pageIndex: number;
  width: number;
  height: number;
  borderRadius?: string;
  onLoadRequested?: () => void;
}

export const WorkbookLivePagePreview = memo(function WorkbookLivePagePreview({
  worksheet,
  pageIndex,
  width,
  height,
  borderRadius = '7px',
  onLoadRequested,
}: WorkbookLivePagePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isStable, setIsStable] = useState(false);
  const hasEverBeenStableRef = useRef(false);
  const stableKey = `${worksheet?.id ?? 'empty'}:${worksheet?.updatedAt ?? 'none'}:${pageIndex}`;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (stablePreviewKeys.has(stableKey)) {
      setIsStable(true);
      hasEverBeenStableRef.current = true;
    } else if (!hasEverBeenStableRef.current) {
      setIsStable(false);
    }
    // When the page was already shown once, DON'T reset isStable to false.
    // The old content stays visible while PrintGridCanvas silently re-renders
    // with the new worksheet data. onStable will fire when the new render
    // stabilises, updating the stableKey set.
  }, [stableKey]);

  useEffect(() => {
    if (!isVisible) return;
    if (worksheet && Array.isArray(worksheet.blocks)) return;
    onLoadRequested?.();
  }, [isVisible, onLoadRequested, worksheet]);

  const pageFormat = (worksheet?.metadata?.pageFormat as PageFormat | undefined) || 'a4';
  const dims = PAGE_DIMENSIONS[pageFormat] || PAGE_DIMENSIONS.a4;
  const scale = Math.min(width / dims.width, height / dims.height);
  const canRender = Boolean(worksheet && Array.isArray(worksheet.blocks) && isVisible);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        borderRadius,
        background: '#ffffff',
        fontSize: '16px',
      }}
    >
      {canRender && (
        <div
          style={{
            width: `${dims.width}px`,
            height: `${dims.height}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <PrintGridCanvas
            worksheet={worksheet!}
            renderOnlyPageIndex={pageIndex}
            hideAttributions={true}
            onStable={() => {
              stablePreviewKeys.add(stableKey);
              setIsStable(true);
              hasEverBeenStableRef.current = true;
            }}
          />
        </div>
      )}

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 5,
          background: 'transparent',
        }}
      />

      {!canRender || !isStable ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            background: '#f8fafc',
            color: '#64748b',
          }}
        >
          <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: '10px', fontWeight: 500 }}>
            Načítám stránku…
          </span>
        </div>
      ) : null}
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.pageIndex !== nextProps.pageIndex) return false;
  if (prevProps.width !== nextProps.width || prevProps.height !== nextProps.height) return false;
  if (prevProps.borderRadius !== nextProps.borderRadius) return false;

  const prevId = prevProps.worksheet?.id ?? null;
  const nextId = nextProps.worksheet?.id ?? null;
  if (prevId !== nextId) return false;

  const prevUpdatedAt = prevProps.worksheet?.updatedAt ?? null;
  const nextUpdatedAt = nextProps.worksheet?.updatedAt ?? null;
  if (prevUpdatedAt !== nextUpdatedAt) return false;

  const prevLoaded = Boolean(prevProps.worksheet && Array.isArray(prevProps.worksheet.blocks));
  const nextLoaded = Boolean(nextProps.worksheet && Array.isArray(nextProps.worksheet.blocks));
  if (prevLoaded !== nextLoaded) return false;

  return true;
});
