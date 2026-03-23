import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, ImageIcon, Scissors, Trash2 } from 'lucide-react';
import { ImageEditModal } from '../ImageEditModal';

export function BlockImageEditor({
  block,
  onUpdateBlock,
  openAssetPicker,
}: {
  block: any;
  onUpdateBlock: (id: string, patch: any) => void;
  openAssetPicker: (ctx: any) => void;
}) {
  const img = block.image as any;

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [editModalIdx, setEditModalIdx] = useState<number | null>(null);
  const [colorOpen, setColorOpen] = useState<'stroke' | 'label' | null>(null);
  const [colorPos, setColorPos] = useState<{ top: number; left: number } | null>(null);
  const strokeRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLButtonElement>(null);

  const updateImg = (patch: any) =>
    onUpdateBlock(block.id, { image: { url: '', position: 'beside-right', size: 'medium', ...(img || {}), ...patch } });

  const removeAll = () => onUpdateBlock(block.id, { image: undefined });

  // Gallery: unified list of image URLs
  const gallery: string[] = img?.gallery?.length ? img.gallery : (img?.url ? [img.url] : []);
  const galleryCaptions: string[] = img?.galleryCaptions || [];

  const addImage = () => openAssetPicker({ type: 'block-image-gallery-add' });
  const replaceImage = (idx: number) => openAssetPicker({ type: 'block-image-gallery-replace', imageIndex: idx });
  const removeImage = (idx: number) => {
    const next = gallery.filter((_, i) => i !== idx);
    const nextCaptions = galleryCaptions.filter((_, i) => i !== idx);
    if (next.length === 0) { removeAll(); setSelectedIdx(null); return; }
    updateImg({ url: next[0], gallery: next, galleryCaptions: nextCaptions });
    setSelectedIdx(prev => prev !== null && prev >= next.length ? next.length - 1 : prev);
  };
  const updateCaption = (idx: number, cap: string) => {
    const next = [...galleryCaptions];
    while (next.length <= idx) next.push('');
    next[idx] = cap;
    updateImg({ galleryCaptions: next });
  };

  const position = img?.position || 'beside-right';
  const widthPercent: number = img?.widthPercent ?? (img?.size === 'small' ? 25 : img?.size === 'large' ? 50 : 35);
  const shape = img?.galleryItemShape || 'rectangle';
  const borderRadius = img?.galleryBorderRadius ?? 8;
  const strokeColor = img?.galleryStrokeColor || '#334155';
  const strokeWidth = img?.galleryStrokeWidth ?? 0;
  const galleryRotate = !!img?.galleryRotate;
  const galleryRotateMax = img?.galleryRotateMax ?? 5;
  const labelType = img?.galleryLabelType || 'none';
  const labelColor = img?.galleryLabelColor || '#3b82f6';
  const activityType = img?.imageActivityType || 'none';

  const ls: React.CSSProperties = { fontSize: 10, color: '#94a3b8', marginBottom: 4, display: 'block', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase' };
  const is: React.CSSProperties = { width: '100%', padding: '5px 8px', borderRadius: 5, border: '1px solid #334155', background: '#020617', color: '#e2e8f0', fontSize: 11, boxSizing: 'border-box' };
  const btn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500 };

  const openColor = (which: 'stroke' | 'label') => {
    const ref = which === 'stroke' ? strokeRef : labelRef;
    if (colorOpen === which) { setColorOpen(null); setColorPos(null); return; }
    const r = ref.current?.getBoundingClientRect();
    if (r) setColorPos({ top: r.bottom + 4, left: r.left });
    setColorOpen(which);
  };

  return (
    <div style={{ marginTop: 4, padding: '10px 12px', borderRadius: 8, border: '1px solid #1e3a5f', background: '#0f172a' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', letterSpacing: '0.6px' }}>📎 VLOŽENÝ OBRÁZEK</span>
        <button onClick={removeAll} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 2 }}><X size={13} /></button>
      </div>

      {/* Gallery thumbnails + ADD button */}
      <div style={{ marginBottom: 10 }}>
        <label style={ls}>Obrázky</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {gallery.map((url, idx) => (
            <div key={idx} onClick={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
              style={{ width: 56, height: 56, borderRadius: 8, border: selectedIdx === idx ? '2px solid #5C5CFF' : '2px solid #334155', overflow: 'hidden', cursor: 'pointer', flexShrink: 0, position: 'relative' }}>
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
          {/* ADD button */}
          <div onClick={addImage}
            style={{ width: 56, height: 56, borderRadius: 8, border: '2px dashed #475569', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 2, color: '#64748b', flexShrink: 0 }}>
            <Plus size={18} />
            <span style={{ fontSize: 9, fontWeight: 700 }}>PŘIDAT</span>
          </div>
        </div>
      </div>

      {/* Selected image detail panel */}
      {selectedIdx !== null && gallery[selectedIdx] && (
        <div style={{ marginBottom: 12, padding: '8px 10px', borderRadius: 8, border: '1px solid #334155', background: '#0a1628' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 8, letterSpacing: '0.6px' }}>
            OBRÁZEK {selectedIdx + 1}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button onClick={() => setEditModalIdx(selectedIdx)}
              style={{ ...btn, flex: 1, justifyContent: 'center', backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}>
              <Scissors size={12} /> Upravit
            </button>
            <button onClick={() => replaceImage(selectedIdx)}
              style={{ ...btn, flex: 1, justifyContent: 'center', backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}>
              <ImageIcon size={12} /> Změnit
            </button>
            <button onClick={() => removeImage(selectedIdx)}
              style={{ ...btn, flex: 1, justifyContent: 'center', backgroundColor: '#1e293b', color: '#ef4444', border: '1px solid #7f1d1d' }}>
              <Trash2 size={12} /> Smazat
            </button>
          </div>
          <label style={{ ...ls, marginBottom: 2 }}>Popisek k obrázku</label>
          <input type="text" value={galleryCaptions[selectedIdx] || ''} onChange={e => updateCaption(selectedIdx, e.target.value)}
            placeholder="Popisek k tomuto obrázku..." style={is} />
        </div>
      )}

      {/* Position */}
      <div style={{ marginBottom: 10 }}>
        <label style={ls}>Pozice</label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[['before', '↑ Nad'], ['beside-left', '← Vlevo'], ['beside-right', 'Vpravo →'], ['after', '↓ Pod']].map(([val, lab]) => (
            <button key={val} onClick={() => updateImg({ position: val })}
              style={{ ...btn, flex: 1, minWidth: 60, justifyContent: 'center', backgroundColor: position === val ? '#5C5CFF' : '#334155', color: position === val ? 'white' : '#94a3b8', fontWeight: position === val ? 700 : 400 }}>
              {lab}
            </button>
          ))}
        </div>
      </div>

      {/* Width */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ ...ls, display: 'flex', justifyContent: 'space-between' }}>
          <span>Šířka obrázku</span>
          <span style={{ color: '#5C5CFF', fontWeight: 700 }}>{widthPercent}%</span>
        </label>
        <input type="range" min={15} max={70} step={5} value={widthPercent}
          onChange={e => updateImg({ widthPercent: parseInt(e.target.value) })}
          style={{ width: '100%', accentColor: '#5C5CFF' }} />
      </div>

      {/* Zoom / crop */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ ...ls, display: 'flex', justifyContent: 'space-between' }}>
          <span>Zoom / ořez</span>
          <span style={{ color: '#5C5CFF', fontWeight: 700 }}>{img?.imageZoom ?? 100}%</span>
        </label>
        <input type="range" min={100} max={250} step={5} value={img?.imageZoom ?? 100}
          onChange={e => updateImg({ imageZoom: parseInt(e.target.value), imageOffsetX: 0, imageOffsetY: 0 })}
          style={{ width: '100%', accentColor: '#5C5CFF', marginBottom: 2 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#64748b', fontWeight: 700, marginBottom: 8 }}>
          <span>Originál</span><span>Střední zoom</span><span>Velký zoom</span>
        </div>
        {/* Offset controls — only show when zoomed */}
        {(img?.imageZoom ?? 100) > 100 && (
          <div style={{ background: '#0a1628', borderRadius: 7, padding: '8px 10px', border: '1px solid #1e3a5f' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700 }}>📐 Pozice ořezu</span>
              <button
                onClick={() => updateImg({ imageOffsetX: 0, imageOffsetY: 0 })}
                style={{ fontSize: 9, padding: '2px 8px', borderRadius: 5, border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', cursor: 'pointer', fontWeight: 700 }}>
                Vycentrovat
              </button>
            </div>
            <label style={{ ...ls, display: 'flex', justifyContent: 'space-between' }}>
              <span>← X →</span>
              <span style={{ color: '#5C5CFF', fontWeight: 700 }}>{Math.round(img?.imageOffsetX ?? 0)}px</span>
            </label>
            <input type="range" min={-200} max={200} step={1} value={img?.imageOffsetX ?? 0}
              onChange={e => updateImg({ imageOffsetX: parseInt(e.target.value) })}
              style={{ width: '100%', accentColor: '#5C5CFF', marginBottom: 6 }} />
            <label style={{ ...ls, display: 'flex', justifyContent: 'space-between' }}>
              <span>↑ Y ↓</span>
              <span style={{ color: '#5C5CFF', fontWeight: 700 }}>{Math.round(img?.imageOffsetY ?? 0)}px</span>
            </label>
            <input type="range" min={-200} max={200} step={1} value={img?.imageOffsetY ?? 0}
              onChange={e => updateImg({ imageOffsetY: parseInt(e.target.value) })}
              style={{ width: '100%', accentColor: '#5C5CFF' }} />
            <div style={{ fontSize: 9, color: '#475569', marginTop: 4 }}>💡 Nebo táhni přímo na obrázku</div>
          </div>
        )}
      </div>

      {/* Visual style */}
      <div style={{ borderTop: '1px solid #1e293b', paddingTop: 10, marginBottom: 8 }}>
        <label style={{ ...ls, color: '#7c3aed' }}>✦ Vizuální styl</label>

        <label style={ls}>Tvar výřezu</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, marginBottom: 10 }}>
          {[['rectangle','▭'],['circle','●'],['heart','♥'],['triangle','▲'],['star','★'],['speech-bubble','💬']].map(([id, lab]) => (
            <button key={id} onClick={() => updateImg({ galleryItemShape: id })}
              style={{ ...btn, justifyContent: 'center', fontSize: id === 'speech-bubble' ? 14 : 16, backgroundColor: shape === id ? '#7c3aed' : '#334155', color: shape === id ? 'white' : '#94a3b8', padding: '5px 0' }}>
              {lab}
            </button>
          ))}
        </div>

        {shape === 'rectangle' && (
          <div style={{ marginBottom: 10 }}>
            <label style={{ ...ls, display: 'flex', justifyContent: 'space-between' }}>
              <span>Zakulacení</span><span style={{ color: '#7c3aed', fontWeight: 700 }}>{borderRadius}px</span>
            </label>
            <input type="range" min={0} max={80} value={borderRadius}
              onChange={e => updateImg({ galleryBorderRadius: parseInt(e.target.value) })}
              style={{ width: '100%', accentColor: '#7c3aed' }} />
          </div>
        )}

        <div style={{ marginBottom: 10 }}>
          <label style={{ ...ls, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Obrys (stroke)</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button ref={strokeRef} onClick={() => openColor('stroke')}
                style={{ width: 20, height: 20, padding: 0, border: colorOpen === 'stroke' ? '2px solid #7c3aed' : '2px solid #475569', borderRadius: 4, cursor: 'pointer', backgroundColor: strokeColor }} />
              <span style={{ color: '#7c3aed', fontWeight: 700, fontSize: 11 }}>{strokeWidth}px</span>
            </div>
          </label>
          <input type="range" min={0} max={10} value={strokeWidth}
            onChange={e => updateImg({ galleryStrokeWidth: parseInt(e.target.value) })}
            style={{ width: '100%', accentColor: '#7c3aed' }} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ ...ls, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Náhodné natočení</span>
            <button onClick={() => updateImg({ galleryRotate: !galleryRotate })}
              style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, cursor: 'pointer', border: 'none', backgroundColor: galleryRotate ? '#7c3aed' : '#334155', color: galleryRotate ? 'white' : '#94a3b8' }}>
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

        <div style={{ marginBottom: 10 }}>
          <label style={{ ...ls, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Štítky</span>
            {labelType !== 'none' && (
              <button ref={labelRef} onClick={() => openColor('label')}
                style={{ width: 20, height: 20, padding: 0, border: colorOpen === 'label' ? '2px solid #7c3aed' : '2px solid #475569', borderRadius: '50%', cursor: 'pointer', backgroundColor: labelColor }} />
            )}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
            {[['none','Žádné'],['letters','A,B,C'],['numbers','1,2,3'],['roman','I,II,III']].map(([id, lab]) => (
              <button key={id} onClick={() => updateImg({ galleryLabelType: id })}
                style={{ ...btn, justifyContent: 'center', fontSize: 10, backgroundColor: labelType === id ? '#7c3aed' : '#334155', color: labelType === id ? 'white' : '#94a3b8' }}>
                {lab}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={ls}>Aktivita na obrázku</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {[['none','Žádná'],['text-input','Pole pro text'],['checkbox-circle','Kolečko'],['checkbox-square','Čtvereček']].map(([id, lab]) => (
              <button key={id} onClick={() => updateImg({ imageActivityType: id })}
                style={{ ...btn, justifyContent: 'center', fontSize: 10, backgroundColor: activityType === id ? '#5C5CFF' : '#334155', color: activityType === id ? 'white' : '#94a3b8' }}>
                {lab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Color picker portal */}
      {colorOpen && colorPos && createPortal(
        <div onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', top: colorPos.top, left: colorPos.left, zIndex: 99999, padding: 8, backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 4, width: 170 }}>
          {[...[
            '#e11d48','#ef4444','#f97316','#ea580c','#f59e0b','#eab308',
            '#84cc16','#22c55e','#16a34a','#10b981','#14b8a6','#06b6d4',
            '#0ea5e9','#3b82f6','#2563eb','#6366f1','#8b5cf6','#9333ea',
            '#a855f7','#d946ef','#ec4899','#f43f5e','#475569','#1e293b',
          ],'#ffffff','#000000'].map(color => (
            <button key={color} onClick={() => { colorOpen === 'stroke' ? updateImg({ galleryStrokeColor: color }) : updateImg({ galleryLabelColor: color }); setColorOpen(null); setColorPos(null); }}
              style={{ width: 22, height: 22, padding: 0, border: (colorOpen === 'stroke' ? strokeColor : labelColor) === color ? '2px solid white' : '2px solid transparent', borderRadius: 4, cursor: 'pointer', backgroundColor: color }} />
          ))}
        </div>,
        document.body
      )}

      {/* Edit modal */}
      {editModalIdx !== null && gallery[editModalIdx] && (
        <ImageEditModal
          imageUrl={gallery[editModalIdx]}
          altText={galleryCaptions[editModalIdx] || ''}
          onClose={() => setEditModalIdx(null)}
          onApply={(newUrl) => {
            const next = [...gallery];
            next[editModalIdx] = newUrl;
            updateImg({ url: next[0], gallery: next });
            setEditModalIdx(null);
          }}
        />
      )}
    </div>
  );
}
