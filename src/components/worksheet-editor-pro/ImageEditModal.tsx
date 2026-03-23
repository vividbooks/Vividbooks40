/**
 * ImageEditModal
 * Floating modal for cropping or AI-regenerating a single image in a gallery block.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Crop, Sparkles, Loader2, Check, RefreshCw, ImageIcon, Figma, Copy, ExternalLink, ClipboardCheck,
} from 'lucide-react';
import { generateImageWithImagen } from '../../utils/ai-chat-proxy';
import { uploadBase64ToStorage } from '../../utils/supabase/upload-image';

// ─── Style prompts (abbreviated from material-generators.ts) ─────────────────

const ILLUSTRATION_STYLE = `Create a vibrant educational illustration in Ligne Claire style (like Tintin comics):
LINE ART: Clean, consistent ink outlines. Every object clearly defined with bold contours.
COLORS: Vivid, saturated colors — rich blues, warm oranges, bright greens, deep reds. High contrast. NOT pastel, NOT muted. Think vivid comic-book colors, fully saturated fills.
BACKGROUND: Pure white or very light neutral. No gradients.
TEXT: NO text, labels, numbers or annotations in the image whatsoever.
COMPOSITION: Educational, professional look, suitable for school materials.`;

const ILLUSTRATION_TEXT_STYLE = `Create a vibrant educational illustration in Ligne Claire style (like Tintin comics):
LINE ART: Clean, consistent ink outlines. Every object clearly defined with bold contours.
COLORS: Vivid, saturated colors — rich blues, warm oranges, bright greens, deep reds. High contrast. NOT pastel, NOT muted. Think vivid comic-book colors, fully saturated fills.
BACKGROUND: Pure white or very light neutral. No gradients.
TEXT: Include all text labels, numbers, annotations and captions from the subject or description. Render every text element in a simple geometric grotesque sans-serif typeface (like Futura or Avenir) — clean, minimal, clearly legible. NO decorative or serif fonts.
COMPOSITION: Educational, professional look, suitable for school materials.`;

const SCHEMA_STYLE = `Create a clean BLACK AND WHITE educational diagram/schema:
LINE ART: Precise technical drawing style. Clear outlines, varying line weights for hierarchy.
COLORS: ONLY black, white and shades of gray. NO color whatsoever.
STYLE: Scientific textbook diagram style. Can include arrows, cross-sections, anatomical drawings.
BACKGROUND: Pure white background.
TEXT: NO text labels or annotations in the image. Clean diagram only.
COMPOSITION: Clean, precise, educational.`;

const SCHEMA_TEXT_STYLE = `Create a clean BLACK AND WHITE educational diagram/schema:
LINE ART: Precise technical drawing style. Clear outlines, varying line weights for hierarchy.
COLORS: ONLY black, white and shades of gray. NO color whatsoever.
STYLE: Scientific textbook diagram style. Can include arrows, cross-sections, anatomical drawings, numbered steps.
BACKGROUND: Pure white background.
TEXT: Include all text labels, numbers, annotations and captions from the subject or description. Render every text element in a simple geometric grotesque sans-serif typeface (like Futura or Helvetica Neue) — minimal, precise, clearly legible. NO decorative or serif fonts.
COMPOSITION: Clean, precise, educational.`;

const CUTOUT_STYLE = `Create a clean product-style CUTOUT image on a pure white background:
BACKGROUND: Pure white (#FFFFFF). No shadows, no gradients, no textures, absolutely nothing except the subject.
SUBJECT: The main subject from the reference image only — isolate it completely. Remove ALL background elements, text, other objects, labels, watermarks, and any surrounding context.
STYLE: Clean, crisp edges. The subject should look like a professional product photo or textbook cutout illustration.
If the subject is a living creature: keep natural colors, remove habitat/environment background.
If the subject is an object: keep its exact shape and color, pure white background only.
FORBIDDEN: any background color other than white, shadows cast on background, text, labels, decorative elements.`;

const CUTOUT_NEW_STYLE = `Generate a BRAND NEW photorealistic image of the same subject on a pure white background — do NOT try to extract from the reference, generate completely fresh:
BACKGROUND: Pure white (#FFFFFF). Absolutely nothing else.
SUBJECT: Identify what the main subject is in the reference image, then draw/photograph it completely fresh and clean.
STYLE: Professional product photography style. Crisp, detailed, natural colors. No shadows on the background.
If living creature: show it in a neutral pose, natural colors, perfectly isolated on white.
If object/plant/material: show it clearly from a clean angle, isolated on white.
FORBIDDEN: any background, text, labels, other objects, shadows on background.
IMPORTANT: This is a completely NEW generation — do not attempt to remove background from the reference. Generate fresh.`;

const PHOTO_STYLE = `CRITICAL: Generate a REAL PHOTOGRAPH, NOT an illustration or cartoon.
- Photorealistic 8K photograph with natural lighting
- Shot on professional DSLR camera (Canon EOS R5 or Sony A7R IV)
- Documentary / National Geographic style photography
FORBIDDEN: illustration, drawing, cartoon, anime, digital art, painting, vector art`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface CropBox { x: number; y: number; w: number; h: number }

type Handle = 'nw' | 'ne' | 'se' | 'sw' | 'move';

export interface ImageEditModalProps {
  imageUrl: string;
  altText?: string;
  onClose: () => void;
  /** Called with the new image URL after crop or regenerate. */
  onApply: (newUrl: string) => void;
}

// ─── Crop helpers ─────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

async function cropAndUpload(
  imageUrl: string,
  cropRatio: CropBox,               // 0–1 relative to natural image
): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      const sx = Math.round(cropRatio.x * img.naturalWidth);
      const sy = Math.round(cropRatio.y * img.naturalHeight);
      const sw = Math.round(cropRatio.w * img.naturalWidth);
      const sh = Math.round(cropRatio.h * img.naturalHeight);
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const dataUrl = canvas.toDataURL('image/png');
      const url = await uploadBase64ToStorage(dataUrl, `cropped-${Date.now()}`, 'imported-images');
      resolve(url || null);
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}

// ─── CropTab ─────────────────────────────────────────────────────────────────

function CropTab({ imageUrl, onApply, onClose }: { imageUrl: string; onApply: (u: string) => void; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Crop box in px relative to the displayed image
  const [cropPx, setCropPx] = useState<CropBox>({ x: 0, y: 0, w: 1, h: 1 }); // will reset after load
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const drag = useRef<{
    handle: Handle;
    startX: number; startY: number;
    startCrop: CropBox;
  } | null>(null);

  const onImgLoad = () => {
    const el = imgRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setImgDims({ w: width, h: height });
    setCropPx({ x: 0, y: 0, w: width, h: height });
  };

  const startDrag = useCallback((e: React.MouseEvent, handle: Handle) => {
    e.preventDefault();
    e.stopPropagation();
    drag.current = { handle, startX: e.clientX, startY: e.clientY, startCrop: { ...cropPx } };
  }, [cropPx]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!drag.current || !imgDims) return;
      const dx = e.clientX - drag.current.startX;
      const dy = e.clientY - drag.current.startY;
      const s = drag.current.startCrop;
      const W = imgDims.w;
      const H = imgDims.h;
      const MIN = 30;

      setCropPx(prev => {
        let { x, y, w, h } = s;
        switch (drag.current!.handle) {
          case 'move':
            x = clamp(s.x + dx, 0, W - prev.w);
            y = clamp(s.y + dy, 0, H - prev.h);
            w = prev.w; h = prev.h;
            break;
          case 'nw':
            x = clamp(s.x + dx, 0, s.x + s.w - MIN);
            y = clamp(s.y + dy, 0, s.y + s.h - MIN);
            w = s.w - (x - s.x);
            h = s.h - (y - s.y);
            break;
          case 'ne':
            y = clamp(s.y + dy, 0, s.y + s.h - MIN);
            w = clamp(s.w + dx, MIN, W - s.x);
            h = s.h - (y - s.y);
            break;
          case 'sw':
            x = clamp(s.x + dx, 0, s.x + s.w - MIN);
            w = s.w - (x - s.x);
            h = clamp(s.h + dy, MIN, H - s.y);
            break;
          case 'se':
            w = clamp(s.w + dx, MIN, W - s.x);
            h = clamp(s.h + dy, MIN, H - s.y);
            break;
        }
        return { x, y, w, h };
      });
    };
    const onUp = () => { drag.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [imgDims]);

  const handleApply = async () => {
    if (!imgDims) return;
    setIsCropping(true); setError(null);
    try {
      const ratio: CropBox = {
        x: cropPx.x / imgDims.w,
        y: cropPx.y / imgDims.h,
        w: cropPx.w / imgDims.w,
        h: cropPx.h / imgDims.h,
      };
      const url = await cropAndUpload(imageUrl, ratio);
      if (!url) { setError('Nepodařilo se nahrát oříznutý obrázek.'); return; }
      onApply(url);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Chyba ořezu.');
    } finally {
      setIsCropping(false);
    }
  };

  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    width: 12, height: 12,
    background: '#5C5CFF',
    border: '2px solid white',
    borderRadius: 3,
    zIndex: 10,
    cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
        Přetáhni rohy výběru pro ořez obrázku.
      </p>

      {/* Image + crop overlay */}
      <div
        ref={containerRef}
        style={{ position: 'relative', display: 'inline-block', userSelect: 'none', overflow: 'hidden' }}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt=""
          onLoad={onImgLoad}
          style={{ display: 'block', maxWidth: '100%', maxHeight: 360, objectFit: 'contain' }}
          draggable={false}
        />

        {imgDims && (
          <>
            {/* Dark overlay outside selection */}
            {[
              /* top */   { left: 0, top: 0, width: imgDims.w, height: cropPx.y },
              /* bottom */ { left: 0, top: cropPx.y + cropPx.h, width: imgDims.w, height: imgDims.h - cropPx.y - cropPx.h },
              /* left */  { left: 0, top: cropPx.y, width: cropPx.x, height: cropPx.h },
              /* right */  { left: cropPx.x + cropPx.w, top: cropPx.y, width: imgDims.w - cropPx.x - cropPx.w, height: cropPx.h },
            ].map((r, i) => (
              <div key={i} style={{ position: 'absolute', background: 'rgba(0,0,0,0.5)', ...r, pointerEvents: 'none' }} />
            ))}

            {/* Selection border */}
            <div
              onMouseDown={(e) => startDrag(e, 'move')}
              style={{
                position: 'absolute',
                left: cropPx.x, top: cropPx.y,
                width: cropPx.w, height: cropPx.h,
                border: '1.5px solid #5C5CFF',
                boxSizing: 'border-box',
                cursor: 'move',
              }}
            />

            {/* Corner handles */}
            {([
              { handle: 'nw', style: { left: cropPx.x - 6, top: cropPx.y - 6, cursor: 'nw-resize' } },
              { handle: 'ne', style: { left: cropPx.x + cropPx.w - 6, top: cropPx.y - 6, cursor: 'ne-resize' } },
              { handle: 'sw', style: { left: cropPx.x - 6, top: cropPx.y + cropPx.h - 6, cursor: 'sw-resize' } },
              { handle: 'se', style: { left: cropPx.x + cropPx.w - 6, top: cropPx.y + cropPx.h - 6, cursor: 'se-resize' } },
            ] as { handle: Handle; style: React.CSSProperties }[]).map(({ handle, style }) => (
              <div
                key={handle}
                onMouseDown={(e) => startDrag(e, handle)}
                style={{ ...handleStyle, ...style }}
              />
            ))}
          </>
        )}
      </div>

      {error && <p style={{ fontSize: 11, color: '#ef4444', margin: 0 }}>{error}</p>}

      <button
        onClick={handleApply}
        disabled={isCropping || !imgDims}
        style={{
          padding: '10px 0',
          borderRadius: 8,
          border: 'none',
          backgroundColor: '#5C5CFF',
          color: 'white',
          fontWeight: 700,
          fontSize: 13,
          cursor: isCropping ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          opacity: isCropping ? 0.7 : 1,
        }}
      >
        {isCropping ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
        {isCropping ? 'Nahrávám...' : 'Potvrdit ořez'}
      </button>
    </div>
  );
}

// ─── RegenTab ────────────────────────────────────────────────────────────────


function RegenTab({ imageUrl, altText, onApply, onClose }: { imageUrl: string; altText?: string; onApply: (u: string) => void; onClose: () => void }) {
  const [description, setDescription] = useState(altText || '');
  const [style, setStyle] = useState<'photo' | 'illustration' | 'illustration-text' | 'schema' | 'schema-text' | 'cutout' | 'cutout-new'>('photo');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true); setError(null); setPreviewUrl(null);
    try {
      const stylePrompt = style === 'photo' ? PHOTO_STYLE : style === 'schema' ? SCHEMA_STYLE : style === 'schema-text' ? SCHEMA_TEXT_STYLE : style === 'cutout' ? CUTOUT_STYLE : style === 'cutout-new' ? CUTOUT_NEW_STYLE : style === 'illustration-text' ? ILLUSTRATION_TEXT_STYLE : ILLUSTRATION_STYLE;
      const fullPrompt = description.trim()
        ? `${stylePrompt}\n\nSUBJECT: ${description.trim()}\n\nUse the reference image as visual context — keep the same subject/composition but apply the requested style.`
        : `${stylePrompt}\n\nRegenerate the reference image in this style. Keep the same subject and composition exactly, only change the visual style.`;

      setLastPrompt(
        `📎 Ref. obrázek URL: ${imageUrl?.startsWith('http') ? '✅ ' + imageUrl : '❌ Není HTTP URL'}\n` +
        `ℹ️  Edge funkce ho stáhne a zakóduje do base64 před odesláním Gemini.\n\n${fullPrompt}`
      );

      const result = await generateImageWithImagen(fullPrompt, {
        aspectRatio: '1:1',
        numberOfImages: 1,
        model: 'flash',
        ...(imageUrl?.startsWith('http') ? { referenceImageUrl: imageUrl } : {}),
      });
      if (!result.success) { setError(result.error || 'Generování selhalo.'); return; }

      // Get preview URL
      if (result.url) {
        setPreviewUrl(result.url);
      } else if (result.images?.[0]?.base64) {
        const b64 = result.images[0].base64;
        const mime = result.images[0].mimeType || 'image/png';
        setPreviewUrl(`data:${mime};base64,${b64}`);
      } else {
        setError('Nebyl vrácen žádný obrázek.');
      }
    } catch (e: any) {
      setError(e.message || 'Neznámá chyba.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = async () => {
    if (!previewUrl) return;
    setIsUploading(true);
    try {
      let finalUrl = previewUrl;
      if (previewUrl.startsWith('data:')) {
        const url = await uploadBase64ToStorage(previewUrl, `regen-${Date.now()}`, 'imported-images');
        if (!url) { setError('Nepodařilo se nahrát obrázek.'); setIsUploading(false); return; }
        finalUrl = url;
      }
      onApply(finalUrl);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 12,
    padding: '8px 10px',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical' as const,
    minHeight: 72,
    fontFamily: 'inherit',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Description */}
      <div>
        <label style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
          Co chceš zobrazit?
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Volitelné — pokud necháš prázdné, přegeneruje se stejný obrázek v novém stylu..."
          style={inputStyle}
        />
      </div>

      {/* Style selector */}
      <div>
        <label style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
          Styl
        </label>
        {/* Row 1: photo + cutouts */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          {([
            { id: 'photo', emoji: '📷', label: 'Fotka', desc: 'Realistická fotografie' },
            { id: 'cutout', emoji: '✂️', label: 'Výřez', desc: 'Motiv na bílém pozadí' },
            { id: 'cutout-new', emoji: '✨', label: 'Výřez nový', desc: 'Nová generace na bílé' },
          ] as const).map(({ id, emoji, label, desc }) => (
            <button key={id} onClick={() => setStyle(id)}
              style={{ flex: 1, padding: '8px 6px', borderRadius: 8, border: style === id ? '2px solid #5C5CFF' : '2px solid #334155', backgroundColor: style === id ? 'rgba(92,92,255,0.15)' : '#0f172a', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 15 }}>{emoji}</span>
              <span style={{ fontSize: 10, color: style === id ? '#a5b4fc' : '#94a3b8', fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 9, color: '#64748b' }}>{desc}</span>
            </button>
          ))}
        </div>
        {/* Row 2: illustration variants */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          {([
            { id: 'illustration', emoji: '🎨', label: 'Ilustrace', desc: 'Bez textu' },
            { id: 'illustration-text', emoji: '🎨', label: 'Ilustrace + text', desc: 'Se štítky' },
          ] as const).map(({ id, emoji, label, desc }) => (
            <button key={id} onClick={() => setStyle(id)}
              style={{ flex: 1, padding: '8px 6px', borderRadius: 8, border: style === id ? '2px solid #22c55e' : '2px solid #334155', backgroundColor: style === id ? 'rgba(34,197,94,0.12)' : '#0f172a', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 15 }}>{emoji}</span>
              <span style={{ fontSize: 10, color: style === id ? '#86efac' : '#94a3b8', fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 9, color: '#64748b' }}>{desc}</span>
            </button>
          ))}
        </div>
        {/* Row 3: schema variants */}
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            { id: 'schema', emoji: '⬛', label: 'Schéma', desc: 'Bez textu' },
            { id: 'schema-text', emoji: '⬛', label: 'Schéma + text', desc: 'Se štítky' },
          ] as const).map(({ id, emoji, label, desc }) => (
            <button key={id} onClick={() => setStyle(id)}
              style={{ flex: 1, padding: '8px 6px', borderRadius: 8, border: style === id ? '2px solid #f59e0b' : '2px solid #334155', backgroundColor: style === id ? 'rgba(245,158,11,0.12)' : '#0f172a', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 15 }}>{emoji}</span>
              <span style={{ fontSize: 10, color: style === id ? '#fcd34d' : '#94a3b8', fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 9, color: '#64748b' }}>{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ fontSize: 11, color: '#ef4444', margin: 0 }}>{error}</p>}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        style={{
          padding: '10px 0',
          borderRadius: 8,
          border: 'none',
          backgroundColor: isGenerating ? '#334155' : '#f59e0b',
          color: isGenerating ? '#64748b' : '#0f172a',
          fontWeight: 700,
          fontSize: 13,
          cursor: isGenerating ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        {isGenerating
          ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generuji... (~30s)</>
          : <><Sparkles size={14} /> Generovat obrázek</>
        }
      </button>

      {/* Prompt debug (shown when preview is visible) */}
      {lastPrompt && (
        <div>
          <button
            onClick={() => setShowPrompt(v => !v)}
            style={{ background: 'none', border: 'none', color: '#475569', fontSize: 10, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {showPrompt ? '▲' : '▼'} Zobrazit odeslaný prompt
          </button>
          {showPrompt && (
            <pre style={{
              marginTop: 6, padding: 8, borderRadius: 6, backgroundColor: '#020617',
              border: '1px solid #1e293b', fontSize: 9, color: '#64748b', fontFamily: 'monospace',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 160, overflowY: 'auto',
            }}>
              {lastPrompt}
            </pre>
          )}
        </div>
      )}

      {/* Preview */}
      {previewUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Náhled
          </label>
          <img
            src={previewUrl}
            alt="Náhled"
            style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 8, backgroundColor: '#0f172a', border: '1px solid #334155' }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleApply}
              disabled={isUploading}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                backgroundColor: '#22c55e', color: 'white', fontWeight: 700, fontSize: 13,
                cursor: isUploading ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {isUploading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
              {isUploading ? 'Nahrávám...' : 'Použít obrázek'}
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              title="Generovat znovu"
              style={{
                width: 42, borderRadius: 8, border: '1px solid #334155',
                backgroundColor: '#1e293b', color: '#94a3b8', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FigmaTab ─────────────────────────────────────────────────────────────────

async function copyImageToClipboard(imageUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context failed');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(async (blob) => {
          if (!blob) { reject(new Error('Blob failed')); return; }
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          resolve();
        }, 'image/png');
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = imageUrl;
  });
}

function FigmaTab({ imageUrl }: { imageUrl: string }) {
  const [status, setStatus] = useState<'idle' | 'copying' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleCopy = async () => {
    setStatus('copying');
    setErrorMsg('');
    try {
      await copyImageToClipboard(imageUrl);
      setStatus('done');
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e?.message || 'Kopírování selhalo');
    }
  };

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px 0', borderRadius: 10, border: 'none',
    fontWeight: 700, fontSize: 13, cursor: 'pointer', width: '100%', transition: 'opacity 0.15s',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Thumbnail */}
      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #334155', backgroundColor: '#0f172a', maxHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 160, objectFit: 'contain', display: 'block' }} />
      </div>

      {/* Step 1 – Copy */}
      <div style={{ backgroundColor: '#0f172a', borderRadius: 10, padding: 14, border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>
          Krok 1 — Zkopírovat obrázek
        </div>
        <button
          onClick={handleCopy}
          disabled={status === 'copying'}
          style={{
            ...btnBase,
            backgroundColor: status === 'done' ? '#16a34a' : status === 'error' ? '#dc2626' : '#5C5CFF',
            color: 'white',
            opacity: status === 'copying' ? 0.7 : 1,
          }}
        >
          {status === 'copying' && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
          {status === 'done' && <ClipboardCheck size={15} />}
          {status === 'idle' && <Copy size={15} />}
          {status === 'error' && <Copy size={15} />}
          {status === 'idle' && 'Zkopírovat obrázek do schránky'}
          {status === 'copying' && 'Kopíruji...'}
          {status === 'done' && 'Zkopírováno! ✓'}
          {status === 'error' && 'Zkusit znovu'}
        </button>
        {status === 'error' && (
          <div style={{ fontSize: 10, color: '#f87171', padding: '4px 0' }}>
            ⚠ {errorMsg}. Zkuste obrázek stáhnout ručně.
          </div>
        )}
      </div>

      {/* Step 2 – Open Figma */}
      <div style={{ backgroundColor: '#0f172a', borderRadius: 10, padding: 14, border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>
          Krok 2 — Vložit do Figmy
        </div>
        <button
          onClick={() => window.open('https://www.figma.com', '_blank')}
          style={{ ...btnBase, backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' }}
        >
          <Figma size={15} style={{ color: '#a78bfa' }} />
          Otevřít Figmu
          <ExternalLink size={12} style={{ color: '#475569' }} />
        </button>
        {status === 'done' && (
          <div style={{
            backgroundColor: '#14532d', border: '1px solid #16a34a', borderRadius: 8,
            padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ color: '#86efac', fontSize: 12, fontWeight: 700 }}>
              Obrázek je ve schránce!
            </div>
            <div style={{ color: '#4ade80', fontSize: 11, lineHeight: 1.5 }}>
              Ve Figmě stiskněte <kbd style={{ backgroundColor: '#166534', border: '1px solid #22c55e', borderRadius: 4, padding: '1px 5px', fontFamily: 'monospace', fontSize: 11 }}>Ctrl+V</kbd> (nebo <kbd style={{ backgroundColor: '#166534', border: '1px solid #22c55e', borderRadius: 4, padding: '1px 5px', fontFamily: 'monospace', fontSize: 11 }}>⌘+V</kbd>) a obrázek se vloží na plátno.
            </div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.5, textAlign: 'center' }}>
        Obrázek se zkopíruje do schránky jako PNG.<br />
        Ve Figmě použijte Ctrl+V / ⌘+V pro vložení.
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function ImageEditModal({ imageUrl, altText, onClose, onApply }: ImageEditModalProps) {
  const [tab, setTab] = useState<'crop' | 'regen' | 'figma'>('crop');

  const tabBtn = (id: 'crop' | 'regen' | 'figma', label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setTab(id)}
      style={{
        flex: 1,
        padding: '8px 0',
        borderRadius: 8,
        border: 'none',
        backgroundColor: tab === id ? '#5C5CFF' : 'transparent',
        color: tab === id ? 'white' : '#64748b',
        fontWeight: 600,
        fontSize: 12,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        transition: 'all 0.15s',
      }}
    >
      {icon} {label}
    </button>
  );

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 99990, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 99991,
        width: 520,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 48px)',
        overflowY: 'auto',
        backgroundColor: '#1e293b',
        borderRadius: 16,
        border: '1px solid #334155',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ImageIcon size={16} style={{ color: '#5C5CFF' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Úprava obrázku</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 4, backgroundColor: '#0f172a', borderRadius: 10, padding: 4 }}>
          {tabBtn('crop', 'Oříznout', <Crop size={13} />)}
          {tabBtn('regen', 'Přegenerovat', <Sparkles size={13} />)}
          {tabBtn('figma', 'Figma', <Figma size={13} />)}
        </div>

        {/* Tab content */}
        {tab === 'crop' && <CropTab imageUrl={imageUrl} onApply={onApply} onClose={onClose} />}
        {tab === 'regen' && <RegenTab imageUrl={imageUrl} altText={altText} onApply={onApply} onClose={onClose} />}
        {tab === 'figma' && <FigmaTab imageUrl={imageUrl} />}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>,
    document.body,
  );
}
