import React, { useState, useRef, useEffect, createPortal } from 'react';
import { Plus, AlignLeft, AlignCenter, AlignRight, Check, Type, Layers, Trash2 } from 'lucide-react';
import { CircleDot, Square } from 'lucide-react';
import { ImageIcon } from 'lucide-react';
import {
  WorksheetBlock, ImageBlock, FreeAnswerSubQuestion, SubQuestionLabelType,
} from '../../../types/worksheet';
import { ImageEditModal } from '../ImageEditModal';
import { labelStyle, buttonStyle, inputStyle, subtleCardStyle, SIDEBAR_COLORS } from './shared';

const LABEL_COLOR_PALETTE = [
  '#e11d48','#ef4444','#f97316','#ea580c','#f59e0b','#eab308',
  '#84cc16','#22c55e','#16a34a','#10b981','#14b8a6','#06b6d4',
  '#0ea5e9','#3b82f6','#2563eb','#6366f1','#8b5cf6','#9333ea',
  '#a855f7','#d946ef','#ec4899','#f43f5e','#475569','#1e293b',
];

// ── Props ──────────────────────────────────────────────────────────────────
interface ImageBlockSettingsProps {
  block: WorksheetBlock;
  onUpdateBlock: (id: string, updates: Partial<WorksheetBlock>) => void;
  openAssetPicker: (ctx: { type: string; imageIndex?: number }) => void;
}

export function ImageBlockSettings({ block, onUpdateBlock, openAssetPicker }: ImageBlockSettingsProps) {
  const imageBlock = block as ImageBlock;
  const imgContent = imageBlock.content as any;

  const gallery: string[] = imgContent.gallery?.length ? imgContent.gallery : (imgContent.url ? [imgContent.url] : []);
  const galleryCaptions: string[] = imgContent.galleryCaptions || [];

  const addPlaceholder = () => {
    const cur: string[] = imgContent.gallery?.length ? imgContent.gallery : (imgContent.url ? [imgContent.url] : []);
    const newGallery = [...cur, ''];
    const newCaptions = [...(imgContent.galleryCaptions || []), ''];
    onUpdateBlock(block.id, {
      content: { ...imgContent, gallery: newGallery, galleryCaptions: newCaptions },
    } as any);
    setEditingGalleryIndex(newGallery.length - 1);
  };
  const gridCols: number = imgContent.gridColumns || 2;
  const imgSize: number = imgContent.size ?? 100;
  const imgContainerHeight: number = imgContent.containerHeight ?? 0;
  const imgAlignment: string = imgContent.alignment || 'center';
  const activityType: string = imgContent.imageActivityType || 'none';
  const itemShape: string = imgContent.galleryItemShape || 'rectangle';
  const borderRadius: number = imgContent.galleryBorderRadius ?? 8;
  const strokeColor: string = imgContent.galleryStrokeColor || '#334155';
  const strokeWidth: number = imgContent.galleryStrokeWidth ?? 0;
  const galleryRotate: boolean = !!imgContent.galleryRotate;
  const galleryRotateMax: number = imgContent.galleryRotateMax ?? 5;
  const labelType: string = imgContent.galleryLabelType || 'none';
  const labelColor: string = imgContent.galleryLabelColor || '#3b82f6';

  // Local state (was in parent)
  const [editingGalleryIndex, setEditingGalleryIndex] = useState<number | null>(null);
  const [imageEditModalIndex, setImageEditModalIndex] = useState<number | null>(null);
  const [imgColorPickerOpen, setImgColorPickerOpen] = useState<'stroke' | 'label' | null>(null);
  const [imgColorPickerPos, setImgColorPickerPos] = useState<{ top: number; left: number } | null>(null);
  const imgStrokeBtnRef = useRef<HTMLButtonElement>(null);
  const imgLabelBtnRef = useRef<HTMLButtonElement>(null);

  // Close color picker on outside click
  useEffect(() => {
    if (imgColorPickerOpen === null) return;
    const handler = (e: MouseEvent) => {
      const refBtn = imgColorPickerOpen === 'stroke' ? imgStrokeBtnRef.current : imgLabelBtnRef.current;
      const palette = document.querySelector('[data-img-color-palette]');
      if (refBtn && !refBtn.contains(e.target as Node) && palette && !palette.contains(e.target as Node)) {
        setImgColorPickerOpen(null);
        setImgColorPickerPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [imgColorPickerOpen]);

  const updateImg = (patch: Record<string, any>) =>
    onUpdateBlock(block.id, { content: { ...imgContent, ...patch } } as any);

  const handleRemoveGalleryImage = (idx: number) => {
    const newGallery = gallery.filter((_, i) => i !== idx);
    const newCaptions = galleryCaptions.filter((_, i) => i !== idx);
    updateImg({ url: newGallery[0] || '', gallery: newGallery, galleryCaptions: newCaptions });
    if (editingGalleryIndex === idx) setEditingGalleryIndex(null);
    else if (editingGalleryIndex !== null && editingGalleryIndex > idx)
      setEditingGalleryIndex(editingGalleryIndex - 1);
  };

  return (
    <>
      {/* Gallery thumbnails */}
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Obrázky</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          {gallery.map((url, idx) => (
            <div key={idx}
              style={{ position: 'relative', width: 56, height: 56, borderRadius: 8, overflow: 'hidden', border: editingGalleryIndex === idx ? '2px solid #5C5CFF' : '2px solid #334155', cursor: 'pointer', flexShrink: 0, backgroundColor: '#0f172a' }}
              onClick={() => {
                if (!url) {
                  openAssetPicker({ type: 'gallery-image-replace', imageIndex: idx });
                } else {
                  setEditingGalleryIndex(editingGalleryIndex === idx ? null : idx);
                }
              }}>
              {url
                ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <ImageIcon size={16} style={{ color: '#475569' }} />
                    <span style={{ fontSize: 8, color: '#475569', fontWeight: 600 }}>UPLOAD</span>
                  </div>}
              {editingGalleryIndex === idx && url && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(92,92,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={14} style={{ color: '#5C5CFF' }} />
                </div>
              )}
            </div>
          ))}
          <button onClick={addPlaceholder}
            style={{ width: 56, height: 56, borderRadius: 8, border: '2px dashed #475569', backgroundColor: '#0f172a', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#5C5CFF'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#475569'; }}>
            <Plus size={16} style={{ color: '#64748b' }} />
            <span style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>PŘIDAT</span>
          </button>
        </div>

        {gallery.length === 0 && (
          <button onClick={addPlaceholder}
            style={{ width: '100%', padding: 24, backgroundColor: '#0f172a', border: '2px dashed #475569', borderRadius: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 8 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#5C5CFF'; e.currentTarget.style.backgroundColor = '#1e293b'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#475569'; e.currentTarget.style.backgroundColor = '#0f172a'; }}>
            <ImageIcon size={28} style={{ color: '#5C5CFF' }} />
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>Přidat slot</span>
            <span style={{ fontSize: 10, color: '#64748b' }}>Vytvoří prázdný placeholder</span>
          </button>
        )}

        {/* Selected image detail */}
        {editingGalleryIndex !== null && gallery[editingGalleryIndex] !== undefined && (
          <div style={{ ...subtleCardStyle, backgroundColor: SIDEBAR_COLORS.panelAlt, marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Obrázek {editingGalleryIndex + 1}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setImageEditModalIndex(editingGalleryIndex)}
                  style={{ ...buttonStyle, fontSize: 10, padding: '3px 8px', backgroundColor: '#334155' }} title="Oříznout nebo přegenerovat">✂ Upravit</button>
                <button onClick={() => openAssetPicker({ type: 'gallery-image-replace', imageIndex: editingGalleryIndex })}
                  style={{ ...buttonStyle, fontSize: 10, padding: '3px 8px' }}><ImageIcon size={11} /> Změnit</button>
                <button onClick={() => handleRemoveGalleryImage(editingGalleryIndex)}
                  style={{ ...buttonStyle, fontSize: 10, padding: '3px 8px', color: '#ef4444' }}><Trash2 size={11} /> Smazat</button>
              </div>
            </div>
            <label style={labelStyle}>Popisek k obrázku</label>
            <input type="text" value={galleryCaptions[editingGalleryIndex] || ''}
              onChange={e => {
                const newCaptions = [...galleryCaptions];
                while (newCaptions.length <= editingGalleryIndex!) newCaptions.push('');
                newCaptions[editingGalleryIndex!] = e.target.value;
                updateImg({ galleryCaptions: newCaptions });
              }}
              placeholder="Popisek k tomuto obrázku..." style={inputStyle} />
          </div>
        )}
      </div>

      {/* Caption font size */}
      {galleryCaptions.some(c => !!c) && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
            <span>Velikost popisků</span>
            <span style={{ color: '#5C5CFF', fontWeight: 700 }}>{imgContent.captionFontSize ?? 11}px</span>
          </label>
          <input type="range" min={8} max={24} value={imgContent.captionFontSize ?? 11}
            onChange={e => updateImg({ captionFontSize: parseInt(e.target.value) })}
            style={{ width: '100%', accentColor: '#5C5CFF', marginBottom: 2 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#64748b', fontWeight: 700 }}>
            <span>Malé</span><span>Střední</span><span>Velké</span>
          </div>
        </div>
      )}

      {/* Grid columns (>1 image) */}
      {gallery.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Počet sloupců</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1,2,3,4].map(cols => (
              <button key={cols} onClick={() => updateImg({ gridColumns: cols })}
                style={{ ...buttonStyle, flex: 1, justifyContent: 'center',
                  backgroundColor: gridCols === cols ? '#5C5CFF' : '#334155',
                  color: gridCols === cols ? 'white' : '#94a3b8',
                  fontWeight: gridCols === cols ? 700 : 400 }}>{cols}</button>
            ))}
          </div>
        </div>
      )}

      {/* Frame height */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
          <span>Výška rámu</span>
          <span style={{ color: '#5C5CFF', fontWeight: 700 }}>{imgContainerHeight > 0 ? `${imgContainerHeight}px` : 'Auto'}</span>
        </label>
        <input type="range" min={0} max={600} step={10} value={imgContainerHeight}
          onChange={e => updateImg({ containerHeight: parseInt(e.target.value) })}
          style={{ width: '100%', accentColor: '#5C5CFF', marginBottom: 4 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
          <span>Auto</span><span>Střední</span><span>Vysoký</span>
        </div>
      </div>

      {/* Zoom */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
          <span>Zoom</span><span style={{ color: '#5C5CFF', fontWeight: 700 }}>{imgSize}%</span>
        </label>
        <input type="range" min={100} max={250} step={5} value={Math.max(100, imgSize)}
          onChange={e => updateImg({ size: parseInt(e.target.value), galleryOffsets: [] })}
          style={{ width: '100%', accentColor: '#5C5CFF', marginBottom: 4 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
          <span>Originál</span><span>Střední zoom</span><span>Velký zoom</span>
        </div>
      </div>

      {/* Alignment (single image) */}
      {gallery.length <= 1 && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Zarovnání</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {([['left', <AlignLeft size={14} />], ['center', <AlignCenter size={14} />], ['right', <AlignRight size={14} />]] as const).map(([value, icon]) => (
              <button key={value} onClick={() => updateImg({ alignment: value })}
                style={{ ...buttonStyle, flex: 1, justifyContent: 'center',
                  backgroundColor: imgAlignment === value ? '#5C5CFF' : '#334155',
                  color: imgAlignment === value ? 'white' : '#94a3b8' }}>{icon}</button>
            ))}
          </div>
        </div>
      )}

      {/* Gallery Visual Styles */}
      <div style={{ marginBottom: 16, borderTop: '1px solid #1e293b', paddingTop: 16 }}>
        <label style={{ ...labelStyle, marginBottom: 8, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 9 }}>✦ Vizuální styl</label>

        {/* Shape */}
        <label style={labelStyle}>Tvar výřezu</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, marginBottom: 12 }}>
          {[
            { id: 'rectangle', label: '▭', title: 'Obdélník' }, { id: 'circle', label: '●', title: 'Kolečko' },
            { id: 'heart', label: '♥', title: 'Srdíčko' }, { id: 'triangle', label: '▲', title: 'Trojúhelník' },
            { id: 'star', label: '★', title: 'Hvězdička' }, { id: 'speech-bubble', label: '💬', title: 'Komiksová bublina' },
          ].map(({ id, label, title }) => (
            <button key={id} title={title} onClick={() => updateImg({ galleryItemShape: id })}
              style={{ ...buttonStyle, justifyContent: 'center', fontSize: id === 'speech-bubble' ? 14 : 16,
                backgroundColor: itemShape === id ? '#7c3aed' : '#334155', color: itemShape === id ? 'white' : '#94a3b8', padding: '6px 0' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Border radius */}
        {itemShape === 'rectangle' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
              <span>Zakulacení rohů</span><span style={{ color: '#7c3aed', fontWeight: 700 }}>{borderRadius}px</span>
            </label>
            <input type="range" min={0} max={80} value={borderRadius}
              onChange={e => updateImg({ galleryBorderRadius: parseInt(e.target.value) })}
              style={{ width: '100%', accentColor: '#7c3aed' }} />
          </div>
        )}

        {/* Stroke */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Obrys (stroke)</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button ref={imgStrokeBtnRef}
                onClick={() => {
                  if (imgColorPickerOpen === 'stroke') { setImgColorPickerOpen(null); setImgColorPickerPos(null); }
                  else {
                    const rect = imgStrokeBtnRef.current?.getBoundingClientRect();
                    if (rect) setImgColorPickerPos({ top: rect.bottom + 4, left: rect.left });
                    setImgColorPickerOpen('stroke');
                  }
                }}
                title="Barva obrysu"
                style={{ width: 20, height: 20, padding: 0, border: imgColorPickerOpen === 'stroke' ? '2px solid #7c3aed' : '2px solid #475569', borderRadius: 4, cursor: 'pointer', backgroundColor: strokeColor }} />
              <span style={{ color: '#7c3aed', fontWeight: 700, fontSize: 11 }}>{strokeWidth}px</span>
            </div>
          </label>
          <input type="range" min={0} max={10} value={strokeWidth}
            onChange={e => updateImg({ galleryStrokeWidth: parseInt(e.target.value) })}
            style={{ width: '100%', accentColor: '#7c3aed' }} />
        </div>

        {/* Rotation */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Náhodné natočení</span>
            <button onClick={() => updateImg({ galleryRotate: !galleryRotate })}
              style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, cursor: 'pointer', border: 'none',
                backgroundColor: galleryRotate ? '#7c3aed' : '#334155', color: galleryRotate ? 'white' : '#94a3b8' }}>
              {galleryRotate ? 'Zap' : 'Vyp'}
            </button>
          </label>
          {galleryRotate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <input type="range" min={1} max={15} value={galleryRotateMax}
                onChange={e => updateImg({ galleryRotateMax: parseInt(e.target.value) })}
                style={{ flex: 1, accentColor: '#7c3aed' }} />
              <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700, minWidth: 32 }}>±{galleryRotateMax}°</span>
            </div>
          )}
        </div>

        {/* Labels */}
        <div style={{ marginBottom: 4 }}>
          <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Štítky</span>
            {labelType !== 'none' && (
              <button ref={imgLabelBtnRef}
                onClick={() => {
                  if (imgColorPickerOpen === 'label') { setImgColorPickerOpen(null); setImgColorPickerPos(null); }
                  else {
                    const rect = imgLabelBtnRef.current?.getBoundingClientRect();
                    if (rect) setImgColorPickerPos({ top: rect.bottom + 4, left: rect.left });
                    setImgColorPickerOpen('label');
                  }
                }}
                title="Barva štítku"
                style={{ width: 20, height: 20, padding: 0, border: imgColorPickerOpen === 'label' ? '2px solid #7c3aed' : '2px solid #475569', borderRadius: '50%', cursor: 'pointer', backgroundColor: labelColor }} />
            )}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            {[{ id: 'none', label: 'Žádné' }, { id: 'letters', label: 'A, B, C' }, { id: 'numbers', label: '1, 2, 3' }, { id: 'roman', label: 'I, II, III' }].map(({ id, label }) => (
              <button key={id} onClick={() => updateImg({ galleryLabelType: id })}
                style={{ ...buttonStyle, justifyContent: 'center', fontSize: 10,
                  backgroundColor: labelType === id ? '#7c3aed' : '#334155', color: labelType === id ? 'white' : '#94a3b8' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Color picker portal */}
      {imgColorPickerOpen !== null && imgColorPickerPos && createPortal(
        <div data-img-color-palette onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', top: imgColorPickerPos.top, left: imgColorPickerPos.left, zIndex: 99999, padding: 8, backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, width: 170 }}>
          {[...LABEL_COLOR_PALETTE, '#ffffff', '#000000'].map(color => (
            <button key={color} onClick={() => {
              if (imgColorPickerOpen === 'stroke') updateImg({ galleryStrokeColor: color });
              else updateImg({ galleryLabelColor: color });
              setImgColorPickerOpen(null); setImgColorPickerPos(null);
            }}
              style={{ width: 22, height: 22, padding: 0, border: (imgColorPickerOpen === 'stroke' ? strokeColor : labelColor) === color ? '2px solid white' : '2px solid transparent', borderRadius: 4, cursor: 'pointer', backgroundColor: color }} />
          ))}
        </div>,
        document.body
      )}

      {/* Activity overlay */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Aktivita na obrázku</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {[
            { id: 'none', label: 'Žádná', icon: null },
            { id: 'text-input', label: 'Pole pro text', icon: <Type size={11} /> },
            { id: 'checkbox-circle', label: 'Kolečko', icon: <CircleDot size={11} /> },
            { id: 'checkbox-square', label: 'Čtvereček', icon: <Square size={11} /> },
          ].map(({ id, label, icon }) => (
            <button key={id} onClick={() => updateImg({ imageActivityType: id })}
              style={{ ...buttonStyle, justifyContent: 'center', gap: 4, fontSize: 10,
                backgroundColor: activityType === id ? '#5C5CFF' : '#334155', color: activityType === id ? 'white' : '#94a3b8' }}>
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      {/* Global caption */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Popisek bloku</label>
        <input type="text" value={imgContent.caption || ''}
          onChange={e => updateImg({ caption: e.target.value })}
          placeholder="Volitelný popisek..." style={inputStyle} />
      </div>

      {/* Convert to sub-questions */}
      {gallery.length >= 2 && (
        <div style={{ marginBottom: 16, borderTop: '1px solid #1e293b', paddingTop: 16 }}>
          <label style={{ ...labelStyle, marginBottom: 8, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 9 }}>⇄ Transformace</label>
          <button onClick={() => {
            const subQs: FreeAnswerSubQuestion[] = gallery.map((url, idx) => ({
              id: `sq-${Date.now()}-${idx}`, text: galleryCaptions[idx] || '', lines: 2, imageUrl: url, imagePosition: 'below' as const,
            }));
            const cols = Math.min(gridCols, 3) as 1 | 2 | 3;
            const newLabelType: SubQuestionLabelType = (labelType === 'none' ? 'none' : labelType) as SubQuestionLabelType;
            onUpdateBlock(block.id, {
              type: 'free-answer',
              content: {
                question: imgContent.caption || '', lines: 2, subQuestions: subQs, subColumns: cols,
                subLabelType: newLabelType === 'none' ? 'letters' : newLabelType,
                subLabelStyle: 'circle', subLabelColors: [labelColor],
                subOutlineEnabled: strokeWidth > 0, subOutlineColors: strokeWidth > 0 ? [strokeColor] : ['#334155'],
                subBorderRadius: borderRadius, subAnswerStyle: 'dotted', subAnswerLines: 2, subShowBackground: false,
                subImageShape: itemShape as any, subImageBorderRadius: borderRadius,
                subImageStrokeColor: strokeColor, subImageStrokeWidth: strokeWidth,
                subImageRotate: galleryRotate, subImageRotateMax: galleryRotateMax,
                subImageHeight: typeof imgContent.height === 'number' ? imgContent.height : 150,
              },
            } as any);
          }}
            style={{ ...buttonStyle, width: '100%', justifyContent: 'center', gap: 6, backgroundColor: '#78350f', color: '#fcd34d', border: '1px solid #92400e', padding: '8px 12px', fontSize: 11, fontWeight: 600 }}>
            <Layers size={13} /> Převést galerii na Pod-otázky
          </button>
          <p style={{ color: '#78716c', fontSize: 9, marginTop: 5, lineHeight: 1.4 }}>
            Každý obrázek se stane samostatnou pod-otázkou s místem pro odpověď.
          </p>
        </div>
      )}

      {/* Image edit modal */}
      {imageEditModalIndex !== null && gallery[imageEditModalIndex] && (
        <ImageEditModal
          imageUrl={gallery[imageEditModalIndex]}
          altText={galleryCaptions[imageEditModalIndex] || imgContent.alt || ''}
          onClose={() => setImageEditModalIndex(null)}
          onApply={(newUrl) => {
            const newGallery = [...gallery];
            newGallery[imageEditModalIndex!] = newUrl;
            updateImg({ url: newGallery[0], gallery: newGallery });
            setImageEditModalIndex(null);
          }}
        />
      )}
    </>
  );
}
