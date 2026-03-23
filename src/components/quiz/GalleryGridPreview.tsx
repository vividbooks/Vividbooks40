/**
 * GalleryGridPreview
 *
 * Shared component used by both SlideBlockEditor (editor preview)
 * and QuizPreview (student view) to render a worksheet-style image grid
 * with shapes, rotation, labels and stroke.
 *
 * Props:
 *   interactive — if true (default), clicking an image opens a lightbox. Pass false in the editor.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

export const GALLERY_CLIP_PATHS: Record<string, string> = {
  rectangle: '',
  circle: 'circle(50% at 50% 50%)',
  triangle: 'polygon(50% 0%, 0% 100%, 100% 100%)',
  star: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  heart: 'polygon(50% 30%, 61% 15%, 72% 10%, 83% 13%, 90% 22%, 90% 32%, 82% 43%, 70% 55%, 58% 68%, 50% 78%, 42% 68%, 30% 55%, 18% 43%, 10% 32%, 10% 22%, 17% 13%, 28% 10%, 39% 15%)',
  'speech-bubble': 'polygon(0% 0%, 100% 0%, 100% 72%, 65% 72%, 50% 95%, 35% 72%, 0% 72%)',
};

export function galleryLabel(index: number, type: string): string {
  if (type === 'letters') return String.fromCharCode(65 + index);
  if (type === 'numbers') return String(index + 1);
  if (type === 'roman') {
    const v = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
    const s = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
    let n = index + 1; let r = '';
    for (let i = 0; i < v.length; i++) { while (n >= v[i]) { r += s[i]; n -= v[i]; } }
    return r;
  }
  return '';
}

interface GalleryGridPreviewProps {
  images: string[];
  captions?: string[];       // Per-image captions (parallel to images[])
  shape?: string;
  borderRadius?: number;
  strokeColor?: string;
  strokeWidth?: number;
  rotate?: boolean;
  rotateMax?: number;
  labelType?: string;
  labelColor?: string;
  cols?: number;
  itemHeight?: number;
  /** When true, images stretch to fill the full container height (ignores itemHeight). */
  fillHeight?: boolean;
  caption?: string;          // Overall gallery caption shown at bottom
  interactive?: boolean;     // If true (default), clicking opens lightbox
}

// ── Lightbox ─────────────────────────────────────────────────────────────────

interface LightboxProps {
  images: string[];
  captions?: string[];
  startIndex: number;
  onClose: () => void;
}

function Lightbox({ images, captions, startIndex, onClose }: LightboxProps) {
  const [idx, setIdx] = useState(startIndex);

  const prev = useCallback(() => setIdx(i => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, prev, next]);

  const caption = captions?.[idx];

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        backgroundColor: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 56px 40px', // room for close btn top, arrows sides, dots bottom
        boxSizing: 'border-box',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 12, right: 16,
          color: '#fff', background: 'rgba(255,255,255,0.15)',
          border: 'none', borderRadius: '50%',
          width: 38, height: 38, fontSize: 20, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1,
        }}
        aria-label="Zavřít"
      >
        ✕
      </button>

      {/* Image — always fills the available space regardless of native resolution */}
      <img
        src={images[idx]}
        alt={caption || ''}
        onClick={e => e.stopPropagation()}
        style={{
          width: '96vw',
          height: caption ? '78vh' : '88vh',
          objectFit: 'contain',
          borderRadius: 6,
          boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
          userSelect: 'none',
          display: 'block',
          imageRendering: 'auto',
        }}
      />

      {/* Caption */}
      {caption && (
        <div style={{
          marginTop: 14, color: '#e2e8f0', fontSize: 15,
          textAlign: 'center', maxWidth: '70vw', lineHeight: 1.5,
        }}>
          {caption}
        </div>
      )}

      {/* Counter */}
      {images.length > 1 && (
        <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 13 }}>
          {idx + 1} / {images.length}
        </div>
      )}

      {/* Prev / Next arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); prev(); }}
            style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              color: '#fff', background: 'rgba(255,255,255,0.15)',
              border: 'none', borderRadius: '50%',
              width: 48, height: 48, fontSize: 24, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Předchozí"
          >
            ‹
          </button>
          <button
            onClick={e => { e.stopPropagation(); next(); }}
            style={{
              position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
              color: '#fff', background: 'rgba(255,255,255,0.15)',
              border: 'none', borderRadius: '50%',
              width: 48, height: 48, fontSize: 24, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Následující"
          >
            ›
          </button>
        </>
      )}

      {/* Dot strip */}
      {images.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {images.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setIdx(i); }}
              style={{
                width: i === idx ? 24 : 8, height: 8,
                borderRadius: 4, border: 'none', cursor: 'pointer',
                backgroundColor: i === idx ? '#fff' : 'rgba(255,255,255,0.35)',
                transition: 'width 0.2s, background-color 0.2s',
                padding: 0,
              }}
              aria-label={`Obrázek ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GalleryGridPreview({
  images,
  captions,
  shape = 'rectangle',
  borderRadius = 8,
  strokeColor = '#334155',
  strokeWidth = 0,
  rotate = false,
  rotateMax = 5,
  labelType = 'none',
  labelColor = '#3b82f6',
  cols = 2,
  itemHeight = 200,
  fillHeight = false,
  caption,
  interactive = true,
}: GalleryGridPreviewProps) {
  const isRect = shape === 'rectangle';
  const clipPath = GALLERY_CLIP_PATHS[shape] || '';

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = useCallback((idx: number) => {
    if (interactive) setLightboxIndex(idx);
  }, [interactive]);

  // Single row → center vertically; multi row → start at top
  const isSingleRow = images.length <= cols;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          // fillHeight: use 1fr rows so each row stretches to fill the container equally
          gridAutoRows: fillHeight ? '1fr' : undefined,
          alignContent: fillHeight ? 'stretch' : (isSingleRow ? 'center' : 'start'),
          gap: '10px',
          width: '100%',
          flex: 1,
          minHeight: 0,
          padding: '8px',
          boxSizing: 'border-box',
          overflowY: fillHeight ? 'hidden' : 'auto',
        }}
      >
        {images.map((url, idx) => {
          const rotDeg = rotate
            ? (((idx * 137 + 29) % (rotateMax * 2 + 1)) - rotateMax)
            : 0;
          const dropShadow = (!isRect && strokeWidth > 0)
            ? `drop-shadow(0 0 ${strokeWidth}px ${strokeColor}) drop-shadow(0 0 ${Math.ceil(strokeWidth / 2)}px ${strokeColor})`
            : undefined;
          const label = labelType !== 'none' ? galleryLabel(idx, labelType) : '';
          const itemCaption = captions?.[idx];

          return (
            <div
              key={idx}
              onClick={() => openLightbox(idx)}
              style={{
                position: 'relative',
                transform: rotDeg !== 0 ? `rotate(${rotDeg}deg)` : undefined,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                cursor: interactive ? 'zoom-in' : 'default',
              }}
            >
              <div style={{ filter: dropShadow, position: 'relative', flex: fillHeight ? 1 : undefined, minHeight: 0 }}>
                {isRect ? (
                  <div style={{
                    position: 'relative', width: '100%',
                    height: fillHeight ? '100%' : `${itemHeight}px`,
                    borderRadius: `${borderRadius}px`, overflow: 'hidden', backgroundColor: '#f8fafc',
                  }}>
                    <img src={url} alt={itemCaption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {strokeWidth > 0 && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        borderRadius: `${borderRadius}px`,
                        boxShadow: `inset 0 0 0 ${strokeWidth}px ${strokeColor}`,
                        pointerEvents: 'none',
                      }} />
                    )}
                  </div>
                ) : (
                  <div style={{ width: '100%', height: `${itemHeight}px` }}>
                    <img
                      src={url} alt={itemCaption || ''}
                      style={{
                        width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                        clipPath, WebkitClipPath: clipPath,
                      } as React.CSSProperties}
                    />
                  </div>
                )}
                {label && (
                  <div style={{
                    position: 'absolute', top: '6px', left: '6px',
                    width: '24px', height: '24px', borderRadius: '50%',
                    backgroundColor: labelColor, color: '#fff',
                    fontSize: '11px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.4)', zIndex: 10,
                  }}>
                    {label}
                  </div>
                )}
              </div>
              {itemCaption && (
                <div style={{
                  fontSize: '11px',
                  color: '#475569',
                  textAlign: 'center',
                  lineHeight: 1.3,
                  marginTop: '4px',
                  padding: '0 2px',
                  wordBreak: 'break-word',
                }}>
                  {itemCaption}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {caption && (
        <div style={{
          padding: '4px 8px 6px',
          fontSize: '12px',
          color: '#64748b',
          textAlign: 'center',
          lineHeight: 1.4,
        }}>
          {caption}
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          captions={captions}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

/** Helper to detect if a SlideBlock should be rendered as a grid */
export function isGalleryGrid(block: any): boolean {
  if (block.galleryDisplayMode === 'grid') return true;
  if (block.galleryDisplayMode === 'carousel') return false;
  // Worksheet-origin: auto-detect from styling props
  return !!(block.galleryItemShape || block.galleryGridColumns || block.galleryContainerHeight);
}
