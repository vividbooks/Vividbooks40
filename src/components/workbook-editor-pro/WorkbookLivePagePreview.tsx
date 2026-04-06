import { memo, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Worksheet } from '../../types/worksheet';
import { PAGE_DIMENSIONS, type PageFormat } from '../../utils/page-layout';
import { PrintGridCanvas } from '../worksheet-editor-pro/PrintGridCanvas';

const stablePreviewKeys = new Set<string>();

/** Re-render jen když se opravdu změní obsah/struktura listu — ne při každém `ds.updated_at` v náhledovém worksheetu. */
function worksheetVisualMemoKey(w: Worksheet | null): string {
  if (!w) return '';
  const blocks = w.blocks ?? [];
  if (blocks.length === 0) return `${w.id}:0`;
  return `${w.id}:${blocks.length}:${blocks.map((b) => b.id).join(',')}`;
}

interface WorkbookLivePagePreviewProps {
  worksheet: Worksheet | null;
  pageIndex: number;
  width: number;
  height: number;
  borderRadius?: string;
  onLoadRequested?: () => void;
  /** Vnořený scroll (náhled toku) — viewport IO by jinak stránky neviděl. */
  forceVisible?: boolean;
  /**
   * Zobrazí jen horní část stránky (hodnota 0–1 z výšky stránky). Měřítko se počítá jen ze šířky,
   * aby spodní prázdný papír u krátkých layoutů nebyl v náhledu vidět (oříznutí overflow).
   */
  clipPageHeightFraction?: number;
  /** Násobí měřítko oproti „na šířku“ (např. 1,2) a ořízne boky — užší výřez textové oblasti stránky. */
  clipPreviewZoom?: number;
}

export const WorkbookLivePagePreview = memo(function WorkbookLivePagePreview({
  worksheet,
  pageIndex,
  width,
  height,
  borderRadius = '7px',
  onLoadRequested,
  forceVisible = false,
  clipPageHeightFraction,
  clipPreviewZoom,
}: WorkbookLivePagePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(forceVisible);
  const [isStable, setIsStable] = useState(false);
  /** Bez `updatedAt` — jinak při každém autosave DS problikává „Načítám stránku…“. */
  const stableKey = `${worksheet?.id ?? 'empty'}:${pageIndex}`;

  useEffect(() => {
    if (forceVisible) {
      setIsVisible(true);
      return;
    }
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
  }, [forceVisible]);

  useEffect(() => {
    if (stablePreviewKeys.has(stableKey)) {
      setIsStable(true);
    } else {
      setIsStable(false);
    }
  }, [stableKey]);

  useEffect(() => {
    if (!isVisible) return;
    if (worksheet && Array.isArray(worksheet.blocks)) return;
    onLoadRequested?.();
  }, [isVisible, onLoadRequested, worksheet]);

  const pageFormat = (worksheet?.metadata?.pageFormat as PageFormat | undefined) || 'a4';
  const dims = PAGE_DIMENSIONS[pageFormat] || PAGE_DIMENSIONS.a4;
  const zoom = clipPreviewZoom ?? 1;
  const scale =
    clipPageHeightFraction != null
      ? (width / dims.width) * zoom
      : Math.min(width / dims.width, height / dims.height);
  const clipLayout = clipPageHeightFraction != null;
  const scaledPageW = dims.width * scale;
  const clipLeftPx = clipLayout ? (width - scaledPageW) / 2 : 0;
  const canRender = Boolean(worksheet && Array.isArray(worksheet.blocks) && isVisible);

  /** Náhled toku (design systém) — když PrintGridCanvas neohlásí onStable, stejně po chvíli skrýt loader. */
  useEffect(() => {
    if (!forceVisible || !canRender) return;
    const t = window.setTimeout(() => {
      stablePreviewKeys.add(stableKey);
      setIsStable(true);
    }, 1200);
    return () => window.clearTimeout(t);
  }, [forceVisible, canRender, stableKey]);

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
          style={
            clipLayout
              ? {
                  position: 'absolute',
                  left: clipLeftPx,
                  top: 0,
                  width: `${dims.width}px`,
                  height: `${dims.height}px`,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }
              : {
                  width: `${dims.width}px`,
                  height: `${dims.height}px`,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }
          }
        >
          <PrintGridCanvas
            worksheet={worksheet!}
            renderOnlyPageIndex={pageIndex}
            hideAttributions={true}
            onStable={() => {
              stablePreviewKeys.add(stableKey);
              setIsStable(true);
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
  if (prevProps.clipPageHeightFraction !== nextProps.clipPageHeightFraction) return false;
  if (prevProps.clipPreviewZoom !== nextProps.clipPreviewZoom) return false;
  if (prevProps.borderRadius !== nextProps.borderRadius) return false;
  if (prevProps.forceVisible !== nextProps.forceVisible) return false;

  if (worksheetVisualMemoKey(prevProps.worksheet) !== worksheetVisualMemoKey(nextProps.worksheet)) return false;

  const prevLoaded = Boolean(prevProps.worksheet && Array.isArray(prevProps.worksheet.blocks));
  const nextLoaded = Boolean(nextProps.worksheet && Array.isArray(nextProps.worksheet.blocks));
  if (prevLoaded !== nextLoaded) return false;

  return true;
});
