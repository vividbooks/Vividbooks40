/**
 * ProBlockSettingsPanel - Dark mode block settings panel for PRO editor
 * 
 * Simplified version of BlockSettingsOverlay with dark theme.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  ChevronUp,
  ChevronDown,
  Trash2,
  Copy,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Info,
  ListChecks,
  TextCursorInput,
  MessageSquare,
  Calculator,
  ImageIcon,
  Table,
  FileText,
  QrCode,
  Square,
  LayoutGrid,
  ChevronDown as ChevronDownIcon,
  ArrowUpToLine,
  ArrowDownToLine,
  AlignVerticalJustifyCenter,
  Palette,
  Check,
  Indent,
  CircleDot,
  Blend,
  RectangleHorizontal,
  SquareRoundCorner,
  Figma,
  ExternalLink,
  RefreshCw,
  Link2,
  Link2Off,
  Layers,
  Scissors,
  ListOrdered,
} from 'lucide-react';
import { supabase } from '../../utils/supabase/client';
import {
  WorksheetBlock,
  BlockType,
  HeadingBlock,
  ParagraphBlock,
  InfoboxBlock,
  MultipleChoiceBlock,
  FillBlankBlock,
  FreeAnswerBlock,
  SpacerBlock,
  ImageBlock,
  InfoboxVariant,
  SpacerStyle,
  FreeCanvasBlock,
  PlayfulAnswerShape,
  PlayfulAnswerStyle,
  PlayfulAnswerSettings,
  PlayfulAnswerPosition,
  FreeAnswerSubQuestion,
  SubQuestionLabelType,
  generateBlockId,
} from '../../types/worksheet';
import { toast } from 'sonner';
import { AssetPicker } from '../shared/AssetPicker';
import type { AssetPickerResult } from '../../types/assets';
import { ImageEditModal } from './ImageEditModal';

// Asset picker context types
type AssetPickerContext = 
  | { type: 'image-block' }
  | { type: 'gallery-image-add' }
  | { type: 'gallery-image-replace'; imageIndex: number }
  | { type: 'paragraph-image' }
  | { type: 'mc-option'; optionIndex: number }
  | { type: 'canvas-image' }
  | { type: 'sub-question-image'; subQuestionIndex: number }
  | { type: 'block-image-set' }
  | { type: 'block-image-gallery-add' }
  | { type: 'block-image-gallery-replace'; imageIndex: number };

// Color palette for label color picker (basic library)
const LABEL_COLOR_PALETTE = [
  '#e11d48', '#ef4444', '#f97316', '#ea580c', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#16a34a', '#10b981', '#14b8a6', '#06b6d4',
  '#0ea5e9', '#3b82f6', '#2563eb', '#6366f1', '#8b5cf6', '#9333ea',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#475569', '#1e293b',
];

// All available shapes for random selection (excludes 'mix')
const RANDOM_SHAPES: Exclude<PlayfulAnswerShape, 'mix'>[] = [
  'circle', 'square', 'pill', 'star', 'heart', 'hexagon', 'diamond', 'cloud'
];

// Color palette for random colors
const RANDOM_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
];

/**
 * Generuje náhodné pozice pro "Hravé ABC" odpovědi
 * Používá seeded random pro konzistenci mezi renderováními
 */
function generatePlayfulPositions(count: number, seed: string): PlayfulAnswerPosition[] {
  // Simple seeded random function
  const seededRandom = (s: string, idx: number) => {
    const hash = s.split('').reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1) + idx * 31, 0);
    const x = Math.sin(hash) * 10000;
    return x - Math.floor(x);
  };

  const positions: PlayfulAnswerPosition[] = [];
  
  // Calculate grid layout based on count
  const cols = count <= 4 ? 2 : count <= 6 ? 3 : 4;
  const rows = Math.ceil(count / cols);
  
  const cellWidth = 100 / cols;
  const cellHeight = 100 / rows;
  
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    
    // Base position (center of cell)
    const baseX = cellWidth * col + cellWidth / 2;
    const baseY = cellHeight * row + cellHeight / 2;
    
    // Random offset within cell (±15% of cell size)
    const offsetX = (seededRandom(seed, i * 2) - 0.5) * cellWidth * 0.3;
    const offsetY = (seededRandom(seed, i * 2 + 1) - 0.5) * cellHeight * 0.3;
    
    // Random rotation (-12 to +12 degrees)
    const rotation = (seededRandom(seed, i * 3) - 0.5) * 24;
    
    // Random scale (90-110%)
    const scale = 90 + seededRandom(seed, i * 4) * 20;
    
    // Random shape for 'mix' mode
    const shapeIndex = Math.floor(seededRandom(seed, i * 5) * RANDOM_SHAPES.length);
    const shape = RANDOM_SHAPES[shapeIndex];
    
    // Random color for 'randomColors' mode
    const colorIndex = Math.floor(seededRandom(seed, i * 6) * RANDOM_COLORS.length);
    const color = RANDOM_COLORS[colorIndex];
    
    positions.push({
      x: Math.max(10, Math.min(90, baseX + offsetX)),
      y: Math.max(10, Math.min(90, baseY + offsetY)),
      rotation: Math.round(rotation * 10) / 10,
      scale: Math.round(scale),
      shape, // Náhodný tvar pro každou odpověď
      color, // Náhodná barva pro každou odpověď
    });
  }
  
  return positions;
}

interface ProBlockSettingsPanelProps {
  block: WorksheetBlock;
  onClose: () => void;
  onUpdateBlock: (id: string, updates: Partial<WorksheetBlock>) => void;
  onDeleteBlock: (id: string) => void;
  onDuplicateBlock: (id: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  gridColumns?: number;
}

const BLOCK_ICONS: Record<BlockType, typeof Type> = {
  'heading': Type,
  'paragraph': AlignLeft,
  'infobox': Info,
  'multiple-choice': ListChecks,
  'fill-blank': TextCursorInput,
  'free-answer': MessageSquare,
  'connect-pairs': Type,
  'image-hotspots': Type,
  'video-quiz': Type,
  'examples': Calculator,
  'table': Table,
  'spacer': Square,
  'image': ImageIcon,
  'qr-code': QrCode,
  'header-footer': FileText,
  'free-canvas': Figma,
};

const BLOCK_LABELS: Record<BlockType, string> = {
  'heading': 'Nadpis',
  'paragraph': 'Odstavec',
  'infobox': 'Infobox',
  'multiple-choice': 'Výběr odpovědi',
  'fill-blank': 'Doplňování',
  'free-answer': 'Volná odpověď',
  'connect-pairs': 'Spojovačka',
  'image-hotspots': 'Poznávačka',
  'video-quiz': 'Video kvíz',
  'examples': 'Příklady',
  'table': 'Tabulka',
  'spacer': 'Volný prostor',
  'image': 'Obrázek',
  'qr-code': 'QR kód',
  'header-footer': 'Hlavička',
  'free-canvas': 'Figma',
};

const INFOBOX_VARIANTS: { value: InfoboxVariant; label: string; color: string }[] = [
  { value: 'blue', label: 'Modrá', color: '#3B82F6' },
  { value: 'green', label: 'Zelená', color: '#10B981' },
  { value: 'yellow', label: 'Žlutá', color: '#F59E0B' },
  { value: 'purple', label: 'Fialová', color: '#8B5CF6' },
];

const SPACER_STYLES: { value: SpacerStyle; label: string }[] = [
  { value: 'empty', label: 'Prázdný' },
  { value: 'dotted', label: 'Tečky' },
  { value: 'lined', label: 'Linky' },
];

// Font options for typography
const FONT_FAMILIES = [
  { value: "'Fenomen Sans', sans-serif", label: 'Fenomen Sans' },
  { value: "'Inter', sans-serif", label: 'Inter' },
  { value: "'Roboto', sans-serif", label: 'Roboto' },
  { value: "'Open Sans', sans-serif", label: 'Open Sans' },
  { value: "'Lato', sans-serif", label: 'Lato' },
  { value: "'Comic Neue', cursive", label: 'Comic Neue' },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64];

const TEXT_COLORS = [
  // Row 1 - Blacks & Grays
  { value: '#000000', label: 'Černá' },
  { value: '#1F2937', label: 'Antracit' },
  { value: '#374151', label: 'Tmavě šedá' },
  { value: '#6B7280', label: 'Šedá' },
  { value: '#9CA3AF', label: 'Světle šedá' },
  { value: '#D1D5DB', label: 'Stříbrná' },
  // Row 2 - Warm colors
  { value: '#EF4444', label: 'Červená' },
  { value: '#F97316', label: 'Oranžová' },
  { value: '#F59E0B', label: 'Žlutá' },
  { value: '#EAB308', label: 'Zlatá' },
  { value: '#84CC16', label: 'Limetka' },
  { value: '#22C55E', label: 'Zelená' },
  // Row 3 - Cool colors
  { value: '#10B981', label: 'Smaragdová' },
  { value: '#14B8A6', label: 'Tyrkysová' },
  { value: '#06B6D4', label: 'Azurová' },
  { value: '#3B82F6', label: 'Modrá' },
  { value: '#6366F1', label: 'Indigová' },
  { value: '#8B5CF6', label: 'Fialová' },
  // Row 4 - Pastels & Special
  { value: '#A855F7', label: 'Purpurová' },
  { value: '#EC4899', label: 'Růžová' },
  { value: '#F43F5E', label: 'Malinová' },
  { value: '#78350F', label: 'Hnědá' },
  { value: '#FFFFFF', label: 'Bílá' },
  { value: '#1E40AF', label: 'Královská modrá' },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  backgroundColor: '#334155',
  border: '1px solid #475569',
  borderRadius: '6px',
  color: '#E5E5E5',
  fontSize: '12px',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 500,
  color: '#808080',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const buttonStyle: React.CSSProperties = {
  padding: '6px 10px',
  backgroundColor: '#334155',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: 500,
  color: '#94a3b8',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  transition: 'all 0.1s ease',
};

// Typography presets
const TEXT_PRESETS = [
  { 
    id: 'h1', 
    label: 'Nadpis H1', 
    styles: { fontSize: 32, fontWeight: 'bold', lineHeight: 1.2, fontFamily: "'Fenomen Sans', sans-serif" } 
  },
  { 
    id: 'h2', 
    label: 'Podnadpis H2', 
    styles: { fontSize: 24, fontWeight: '600', lineHeight: 1.3, fontFamily: "'Fenomen Sans', sans-serif" } 
  },
  { 
    id: 'text', 
    label: 'Text', 
    styles: { fontSize: 12, fontWeight: 'normal', lineHeight: 1.5, fontFamily: "'Fenomen Sans', sans-serif" } 
  },
  { 
    id: 'caption', 
    label: 'Popisek', 
    styles: { fontSize: 10, fontWeight: 'normal', lineHeight: 1.4, fontFamily: "'Fenomen Sans', sans-serif", italic: true } 
  },
];
  
  // Visual style presets
  const STYLE_PRESETS = [
    { 
      id: 'none', 
      label: 'Žádný',
      styles: { backgroundColor: undefined, borderColor: undefined, borderWidth: undefined, borderStyle: undefined, borderRadius: undefined, shadow: undefined }
    },
    { 
      id: 'border', 
      label: 'Rámeček',
      styles: { backgroundColor: undefined, borderColor: '#374151', borderWidth: 1, borderStyle: 'solid' as const, borderRadius: 8, shadow: undefined }
    },
    { 
      id: 'card', 
      label: 'Karta',
      styles: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', borderWidth: 1, borderStyle: 'solid' as const, borderRadius: 12, shadow: 'medium' as const }
    },
    { 
      id: 'highlight', 
      label: 'Zvýraznění',
      styles: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 2, borderStyle: 'dashed' as const, borderRadius: 8, shadow: undefined }
    },
    { 
      id: 'info', 
      label: 'Info',
      styles: { backgroundColor: '#DBEAFE', borderColor: '#3B82F6', borderWidth: 2, borderStyle: 'solid' as const, borderRadius: 8, shadow: undefined }
    },
  ];

// ─── BlockImage Editor ────────────────────────────────────────────────────────
// Full image settings panel reused for blocks with side images (infobox, free-answer, etc.)
function BlockImageEditor({
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

      {/* Width % – for beside positions show relative %, for above/below show absolute max-width */}
      {(position === 'beside-left' || position === 'beside-right') ? (
        <div style={{ marginBottom: 12 }}>
          <label style={{ ...ls, display: 'flex', justifyContent: 'space-between' }}>
            <span>Šířka obrázku</span>
            <span style={{ color: '#5C5CFF', fontWeight: 700 }}>{widthPercent}%</span>
          </label>
          <input type="range" min={15} max={70} value={widthPercent}
            onChange={e => updateImg({ widthPercent: parseInt(e.target.value), size: 'medium' })}
            style={{ width: '100%', accentColor: '#5C5CFF', marginBottom: 2 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#64748b', fontWeight: 700 }}>
            <span>Úzký</span><span>Střední</span><span>Široký</span>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <label style={{ ...ls, display: 'flex', justifyContent: 'space-between' }}>
            <span>Max. šířka obrázku</span>
            <span style={{ color: '#5C5CFF', fontWeight: 700 }}>{widthPercent}%</span>
          </label>
          <input type="range" min={20} max={100} value={widthPercent}
            onChange={e => updateImg({ widthPercent: parseInt(e.target.value), size: 'medium' })}
            style={{ width: '100%', accentColor: '#5C5CFF', marginBottom: 2 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#64748b', fontWeight: 700 }}>
            <span>Úzký</span><span>Střední</span><span>Plná šířka</span>
          </div>
        </div>
      )}

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
// ──────────────────────────────────────────────────────────────────────────────

export function ProBlockSettingsPanel({
  block,
  onClose,
  onUpdateBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  gridColumns = 12,
}: ProBlockSettingsPanelProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [showBorderColorPicker, setShowBorderColorPicker] = useState(false);
  const [showCircleColorPicker, setShowCircleColorPicker] = useState(false);
  const [showPlayfulColorPicker, setShowPlayfulColorPicker] = useState(false);
  const [showCustomStyles, setShowCustomStyles] = useState(false);
  const [showVisualAdvanced, setShowVisualAdvanced] = useState(false);
  const [colorPaletteForSubQ, setColorPaletteForSubQ] = useState<number | null>(null);
  const [colorPalettePos, setColorPalettePos] = useState<{ top: number; left: number } | null>(null);
  const colorBtnRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const [expandedSubQ, setExpandedSubQ] = useState<number | null>(null);
  const [editingGalleryIndex, setEditingGalleryIndex] = useState<number | null>(null);
  const [imageEditModalIndex, setImageEditModalIndex] = useState<number | null>(null);
  const [imgColorPickerOpen, setImgColorPickerOpen] = useState<'stroke' | 'label' | null>(null);
  const [imgColorPickerPos, setImgColorPickerPos] = useState<{ top: number; left: number } | null>(null);
  const imgStrokeBtnRef = useRef<HTMLButtonElement>(null);
  const imgLabelBtnRef = useRef<HTMLButtonElement>(null);
  const [faImgPickerOpen, setFaImgPickerOpen] = useState(false);
  const [showParaImgEdit, setShowParaImgEdit] = useState(false);
  const [faImgPickerPos, setFaImgPickerPos] = useState<{ top: number; left: number } | null>(null);
  const faImgStrokeBtnRef = useRef<HTMLButtonElement>(null);

  // Figma integration state (for free-canvas blocks)
  const blockContentRef = useRef<any>(block.content); // always latest content, avoids stale closures
  useEffect(() => { blockContentRef.current = block.content; }, [block.content]);

  const [figmaConnected, setFigmaConnected] = useState(false);
  const [figmaLoading, setFigmaLoading] = useState(false);
  const [figmaSyncing, setFigmaSyncing] = useState(false);
  const [figmaFileInput, setFigmaFileInput] = useState('');
  const [figmaNodeInput, setFigmaNodeInput] = useState('');
  const [figmaPanelOpen, setFigmaPanelOpen] = useState(false);
  const [figmaAutoSync, setFigmaAutoSync] = useState(true);
  const figmaAutoSyncRef = useRef(false);
  const figmaSyncingRef = useRef(false);

  const FIGMA_EDGE_URL = 'https://njbtqmsxbyvpwigfceke.supabase.co/functions/v1/figma-oauth';

  useEffect(() => {
    if (block.type !== 'free-canvas') return;
    const c = block.content as any;
    setFigmaFileInput(c.figmaFileId ?? '');
    setFigmaNodeInput(c.figmaNodeId ?? '');
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const res = await fetch(`${FIGMA_EDGE_URL}?action=token-status`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const d = await res.json();
          setFigmaConnected(d.connected && !d.expired);
        }
      } catch { /* offline */ }
    })();
  }, [block.id, block.type]);

  const connectFigma = useCallback(async () => {
    setFigmaLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { alert('Nejste přihlášeni'); return; }
      const res = await fetch(`${FIGMA_EDGE_URL}?action=auth-url`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) { alert('Figma OAuth není nakonfigurováno'); return; }
      const { url } = await res.json();
      const popup = window.open(url, 'figma-oauth', 'width=600,height=700,menubar=no,toolbar=no');
      const onMsg = (e: MessageEvent) => {
        if (e.data?.type === 'FIGMA_AUTH_SUCCESS') {
          setFigmaConnected(true);
          window.removeEventListener('message', onMsg);
          popup?.close();
        }
      };
      window.addEventListener('message', onMsg);
    } finally {
      setFigmaLoading(false);
    }
  }, []);

  const saveFigmaLink = useCallback(() => {
    onUpdateBlock(block.id, {
      content: {
        ...blockContentRef.current,
        figmaFileId: figmaFileInput.trim() || undefined,
        figmaNodeId: figmaNodeInput.trim() || undefined,
        figmaFrameName: figmaNodeInput.trim() ? `Frame ${figmaNodeInput.trim()}` : undefined,
      },
    } as any);
  }, [block.id, onUpdateBlock, figmaFileInput, figmaNodeInput]);

  const syncFigmaSvg = useCallback(async () => {
    const c = blockContentRef.current;
    if (!c.figmaFileId || !c.figmaNodeId) { alert('Nejprve ulož propojení (File ID + Node ID)'); return; }
    setFigmaSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { alert('Nejste přihlášeni'); return; }
      const res = await fetch(`${FIGMA_EDGE_URL}?action=sync-svg`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: c.figmaFileId, nodeId: c.figmaNodeId, blockId: block.id }),
      });
      if (!res.ok) { const d = await res.json(); alert(`Chyba: ${d.error}`); return; }
      const { svgUrl, syncedAt } = await res.json();
      onUpdateBlock(block.id, { content: { ...blockContentRef.current, figmaSvgUrl: svgUrl, figmaSyncedAt: syncedAt } } as any);
      toast.success('SVG synchronizováno z Figmy!');
    } finally {
      setFigmaSyncing(false);
    }
  }, [block.id, onUpdateBlock]);

  // Auto-sync: poll Figma every 30s for changes
  useEffect(() => {
    figmaAutoSyncRef.current = figmaAutoSync;
  }, [figmaAutoSync]);

  useEffect(() => {
    if (!figmaAutoSync) return;
    const c = blockContentRef.current;
    if (!c.figmaFileId || !c.figmaNodeId) return;

    const poll = async () => {
      if (!figmaAutoSyncRef.current || figmaSyncingRef.current) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        // Check if file was modified since last sync
        const res = await fetch(
          `https://api.figma.com/v1/files/${blockContentRef.current.figmaFileId}?depth=1`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        // We use our edge function to avoid CORS - check last_modified via token
        if (!res.ok) return;
        const data = await res.json();
        const figmaLastModified = data.lastModified as string | undefined;
        const lastSync = blockContentRef.current.figmaSyncedAt;
        if (!figmaLastModified) return;
        if (!lastSync || new Date(figmaLastModified) > new Date(lastSync)) {
          figmaSyncingRef.current = true;
          // Trigger sync
          const syncRes = await fetch(`${FIGMA_EDGE_URL}?action=sync-svg`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileId: blockContentRef.current.figmaFileId,
              nodeId: blockContentRef.current.figmaNodeId,
              blockId: block.id,
            }),
          });
          if (syncRes.ok) {
            const { svgUrl, syncedAt } = await syncRes.json();
            onUpdateBlock(block.id, { content: { ...blockContentRef.current, figmaSvgUrl: svgUrl, figmaSyncedAt: syncedAt } } as any);
          }
          figmaSyncingRef.current = false;
        }
      } catch { /* ignore */ }
    };

    poll(); // immediate first check
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [figmaAutoSync, block.id, onUpdateBlock]);

  const openInFigma = useCallback(() => {
    const c = blockContentRef.current;
    if (!c.figmaFileId) return;
    let url = `https://www.figma.com/design/${c.figmaFileId}`;
    if (c.figmaNodeId) url += `?node-id=${encodeURIComponent(c.figmaNodeId)}`;
    window.open(url, '_blank');
  }, []);

  const createFigmaFrame = useCallback(() => {
    const c = blockContentRef.current;
    if (!c.figmaFileId) { alert('Nejprve ulož File ID Figma souboru'); return; }
    const w = Math.round((c.canvasWidth || 700) * (25.4 / 96)); // px → mm
    const h = Math.round((c.canvasHeight || 400) * (25.4 / 96));
    const wPx = c.canvasWidth || 700;
    const hPx = c.canvasHeight || 400;
    const hint = `Frame: ${wPx} × ${hPx} px  (${w} × ${h} mm)`;
    navigator.clipboard.writeText(hint).catch(() => {});
    // Open Figma at the file
    window.open(`https://www.figma.com/design/${c.figmaFileId}`, '_blank');
  }, []);
  const [openColorPicker, setOpenColorPicker] = useState<'fill' | 'outline' | 'label' | null>(null);

  // Track the last textarea/input that had a text selection, so B/I/U buttons work
  // even after the panel steals focus (e.g. when opening the "DALŠÍ NASTAVENÍ" toggle).
  const lastSelRef = useRef<{ el: HTMLTextAreaElement | HTMLInputElement; start: number; end: number; text: string } | null>(null);

  useEffect(() => {
    const onSelectionChange = () => {
      const el = document.activeElement;
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) {
        const ta = el as HTMLTextAreaElement | HTMLInputElement;
        const start = ta.selectionStart ?? 0;
        const end = ta.selectionEnd ?? 0;
        if (end > start) {
          lastSelRef.current = { el: ta, start, end, text: ta.value };
        }
      }
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  // Applies an inline format (bold/italic/underline) to selected text.
  // Uses the last known textarea selection so it works even after panel interactions steal focus.
  // togglePattern: if the selection already matches this pattern, formatting is REMOVED instead of added.
  // E.g. bold: /^\*\*([\s\S]+)\*\*$/ — clicking Bold on "**text**" → removes markers → "text"
  const applyInlineFormat = (
    wrap: (s: string) => string,
    togglePattern: RegExp | null,
    fallbackProp: string,
    fallbackVal: any
  ) => {
    // Prefer the currently focused element; fall back to last remembered selection
    let targetEl: HTMLTextAreaElement | HTMLInputElement | null = null;
    let start = 0, end = 0, text = '';

    const active = document.activeElement;
    if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
      const ta = active as HTMLTextAreaElement | HTMLInputElement;
      start = ta.selectionStart ?? 0;
      end = ta.selectionEnd ?? 0;
      if (end > start) {
        targetEl = ta;
        text = ta.value;
      }
    }

    // If the currently focused element has no selection, use the last remembered one
    if (!targetEl && lastSelRef.current) {
      const saved = lastSelRef.current;
      // Only use it if the stored text still matches the element's current value
      if (saved.el.isConnected && saved.el.value === saved.text) {
        targetEl = saved.el;
        start = saved.start;
        end = saved.end;
        text = saved.text;
      }
    }

    if (targetEl && end > start) {
      const sel = text.substring(start, end);

      // Toggle: if selection is already wrapped with this format, remove it
      let replacement: string;
      if (togglePattern && togglePattern.test(sel)) {
        replacement = sel.replace(togglePattern, '$1');
      } else {
        replacement = wrap(sel);
      }

      const newValue = text.substring(0, start) + replacement + text.substring(end);

      if (block.type === 'multiple-choice') {
        const mcBlock = block as MultipleChoiceBlock;
        const optIdx = mcBlock.content.options.findIndex(o => o.text === text);
        if (optIdx !== -1) {
          const opts = [...mcBlock.content.options];
          opts[optIdx] = { ...opts[optIdx], text: newValue };
          onUpdateBlock(block.id, { content: { ...mcBlock.content, options: opts } } as any);
        } else {
          onUpdateBlock(block.id, { content: { ...mcBlock.content, question: newValue } } as any);
        }
      } else if (block.type === 'free-answer') {
        onUpdateBlock(block.id, { content: { ...(block.content as any), question: newValue } } as any);
      } else {
        onUpdateBlock(block.id, { content: { ...(block.content as any), text: newValue } } as any);
      }

      // Restore focus and selection (select the replacement content, without markers)
      const el = targetEl;
      lastSelRef.current = null;
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start, start + replacement.length);
      }, 10);
      return;
    }

    // No selection anywhere — toggle the whole-block style
    onUpdateBlock(block.id, { content: { ...(block.content as any), [fallbackProp]: fallbackVal } } as any);
  };

  // Close color palette on click outside
  useEffect(() => {
    if (colorPaletteForSubQ === null) return;
    const handler = (e: MouseEvent) => {
      const btn = colorBtnRefs.current.get(colorPaletteForSubQ);
      if (btn && btn.contains(e.target as Node)) return;
      setColorPaletteForSubQ(null);
      setColorPalettePos(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colorPaletteForSubQ]);

  // Close image color picker (stroke / label) on click outside
  useEffect(() => {
    if (imgColorPickerOpen === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const refBtn = imgColorPickerOpen === 'stroke' ? imgStrokeBtnRef.current : imgLabelBtnRef.current;
      if (refBtn && refBtn.contains(target)) return;
      // Don't close if clicking inside the palette portal itself
      const el = target instanceof HTMLElement ? target : (target.parentElement as HTMLElement | null);
      if (el?.closest?.('[data-img-color-palette]')) return;
      setImgColorPickerOpen(null);
      setImgColorPickerPos(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [imgColorPickerOpen]);
  
  // Close free-answer image stroke color picker on click outside
  useEffect(() => {
    if (!faImgPickerOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (faImgStrokeBtnRef.current && faImgStrokeBtnRef.current.contains(target)) return;
      const el = target instanceof HTMLElement ? target : (target.parentElement as HTMLElement | null);
      if (el?.closest?.('[data-fa-img-palette]')) return;
      setFaImgPickerOpen(false);
      setFaImgPickerPos(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [faImgPickerOpen]);

  // Asset picker state
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [assetPickerContext, setAssetPickerContext] = useState<AssetPickerContext | null>(null);

  const openAssetPicker = (context: AssetPickerContext) => {
    setAssetPickerContext(context);
    setAssetPickerOpen(true);
  };

  const handleAssetSelect = (result: AssetPickerResult) => {
    if (!assetPickerContext) return;
    
    switch (assetPickerContext.type) {
      case 'image-block': {
        onUpdateBlock(block.id, {
          content: { ...(block.content as any), url: result.url, gallery: [result.url] }
        } as any);
        break;
      }
      case 'block-image-set': {
        const existing = (block as any).image || {};
        const newGallery = existing.gallery?.length ? existing.gallery : (existing.url ? [existing.url] : []);
        onUpdateBlock(block.id, {
          image: { ...existing, url: result.url, gallery: newGallery.length ? newGallery : [result.url] }
        } as any);
        break;
      }
      case 'block-image-gallery-add': {
        const existing = (block as any).image || {};
        const cur: string[] = existing.gallery?.length ? existing.gallery : (existing.url ? [existing.url] : []);
        const newGallery = [...cur, result.url];
        onUpdateBlock(block.id, { image: { ...existing, url: newGallery[0], gallery: newGallery } } as any);
        break;
      }
      case 'block-image-gallery-replace': {
        const existing = (block as any).image || {};
        const cur: string[] = existing.gallery?.length ? [...existing.gallery] : (existing.url ? [existing.url] : []);
        cur[assetPickerContext.imageIndex] = result.url;
        onUpdateBlock(block.id, { image: { ...existing, url: cur[0], gallery: cur } } as any);
        break;
      }
      case 'gallery-image-add': {
        const imgC = block.content as any;
        const cur = imgC.gallery?.length ? imgC.gallery : (imgC.url ? [imgC.url] : []);
        const newGallery = [...cur, result.url];
        const newCaptions = [...(imgC.galleryCaptions || []), ''];
        onUpdateBlock(block.id, {
          content: { ...imgC, url: newGallery[0], gallery: newGallery, galleryCaptions: newCaptions }
        } as any);
        setEditingGalleryIndex(newGallery.length - 1);
        break;
      }
      case 'gallery-image-replace': {
        const imgC = block.content as any;
        const cur = imgC.gallery?.length ? [...imgC.gallery] : (imgC.url ? [imgC.url] : []);
        cur[assetPickerContext.imageIndex] = result.url;
        onUpdateBlock(block.id, {
          content: { ...imgC, url: cur[0], gallery: cur }
        } as any);
        break;
      }
      case 'paragraph-image': {
        onUpdateBlock(block.id, {
          content: { 
            ...(block.content as any), 
            imageUrl: result.url,
            imagePosition: (block.content as any).imagePosition || 'right'
          }
        } as any);
        setShowParaImgEdit(true);
        break;
      }
      case 'mc-option': {
        const mcBlock = block as MultipleChoiceBlock;
        const newOptions = [...(mcBlock.content.options || [])];
        const idx = assetPickerContext.optionIndex;
        if (newOptions[idx]) {
          newOptions[idx] = { ...newOptions[idx], imageUrl: result.url };
          onUpdateBlock(block.id, {
            content: { ...mcBlock.content, options: newOptions }
          } as Partial<MultipleChoiceBlock>);
        }
        break;
      }
      case 'canvas-image': {
        const canvasContent = block.content as any;
        const newObject: any = {
          id: `obj-${Date.now()}`,
          type: 'image',
          x: 50 + Math.random() * 100,
          y: 50 + Math.random() * 100,
          width: 150,
          height: 150,
          zIndex: (canvasContent.objects?.length || 0) + 1,
          locked: false,
          url: result.url,
          alt: result.name || '',
          objectFit: 'contain',
        };
        onUpdateBlock(block.id, {
          content: {
            ...canvasContent,
            objects: [...(canvasContent.objects || []), newObject],
          }
        });
        break;
      }
      case 'sub-question-image': {
        const faBlock = block as FreeAnswerBlock;
        const updated = [...(faBlock.content.subQuestions || [])];
        const sqIdx = assetPickerContext.subQuestionIndex;
        if (updated[sqIdx]) {
          updated[sqIdx] = { ...updated[sqIdx], imageUrl: result.url, imagePosition: updated[sqIdx].imagePosition || 'below' };
          onUpdateBlock(block.id, {
            content: { ...faBlock.content, subQuestions: updated }
          } as any);
        }
        break;
      }
    }
    
    setAssetPickerOpen(false);
    setAssetPickerContext(null);
  };
  
  // Refs for inputs to handle formatting
  const questionInputRef = useRef<HTMLTextAreaElement>(null);
  const optionInputRefs = useRef<Record<number, HTMLInputElement>>({});

  // Determine current preset
  const getCurrentPreset = () => {
    const vs = block.visualStyles;
    if (!vs || (!vs.backgroundColor && !vs.borderColor && !vs.shadow)) return 'none';
    for (const preset of STYLE_PRESETS) {
      if (preset.id === 'none') continue;
      const ps = preset.styles;
      if (vs.backgroundColor === ps.backgroundColor && 
          vs.borderColor === ps.borderColor && 
          vs.borderWidth === ps.borderWidth &&
          vs.borderRadius === ps.borderRadius &&
          vs.shadow === ps.shadow) {
        return preset.id;
      }
    }
    return 'custom';
  };

  const currentPreset = getCurrentPreset();
  
  const Icon = BLOCK_ICONS[block.type] || Type;
  const label = BLOCK_LABELS[block.type] || block.type;

  const renderTypeSpecificSettings = () => {
    switch (block.type) {
      case 'heading': {
        const headingBlock = block as HeadingBlock;
        const currentHeadingStyle = headingBlock.content.headingStyle || 'plain';
        const currentHighlight = headingBlock.content.highlightColor || 'transparent';
        return (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Úroveň</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[1, 2, 3].map((level) => (
                  <button
                    key={level}
                    onClick={() => onUpdateBlock(block.id, {
                      content: { ...headingBlock.content, level: `h${level}` as any }
                    } as Partial<HeadingBlock>)}
                    style={{
                      ...buttonStyle,
                      flex: 1,
                      justifyContent: 'center',
                      backgroundColor: headingBlock.content.level === `h${level}` ? '#5C5CFF' : '#334155',
                      color: headingBlock.content.level === `h${level}` ? 'white' : '#94a3b8',
                    }}
                  >
                    H{level}
                  </button>
                ))}
              </div>
            </div>
            {/* Heading visual style */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Vizuální styl</label>
              <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                {([
                  { value: 'plain', label: 'Prostý' },
                  { value: 'pill', label: 'Pill' },
                  { value: 'left-border', label: '│ Lišta' },
                  { value: 'underline', label: '_ Podtrž.' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onUpdateBlock(block.id, {
                      content: { ...headingBlock.content, headingStyle: opt.value }
                    } as Partial<HeadingBlock>)}
                    style={{
                      ...buttonStyle,
                      flex: 1,
                      justifyContent: 'center',
                      fontSize: '9px',
                      padding: '4px 3px',
                      backgroundColor: currentHeadingStyle === opt.value ? '#5C5CFF' : '#334155',
                      color: currentHeadingStyle === opt.value ? 'white' : '#94a3b8',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Heading highlight color (for pill, left-border, underline) */}
            {currentHeadingStyle !== 'plain' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Barva stylu</label>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Zelená', color: '#dcfce7' },
                    { label: 'Modrá', color: '#dbeafe' },
                    { label: 'Žlutá', color: '#fef3c7' },
                    { label: 'Fialová', color: '#f3e8ff' },
                    { label: 'Růžová', color: '#fce7f3' },
                    { label: 'Červená', color: '#fee2e2' },
                    { label: 'Tyrkys', color: '#cffafe' },
                    { label: 'Šedá', color: '#e2e8f0' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => onUpdateBlock(block.id, {
                        content: { ...headingBlock.content, highlightColor: preset.color }
                      } as Partial<HeadingBlock>)}
                      style={{
                        ...buttonStyle,
                        padding: '3px 6px',
                        fontSize: '9px',
                        backgroundColor: currentHighlight === preset.color ? '#5C5CFF' : '#334155',
                        color: currentHighlight === preset.color ? 'white' : '#94a3b8',
                      }}
                    >
                      <div style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: currentHeadingStyle === 'pill' ? '50%' : '2px',
                        backgroundColor: preset.color,
                        marginRight: '3px',
                        flexShrink: 0,
                        border: '1px solid rgba(255,255,255,0.2)',
                      }} />
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      }

      case 'paragraph': {
        const paragraphBlock = block as ParagraphBlock;
        const paragraphColumns = (paragraphBlock.content as any).columns || 1;
        return (
          <>
            {/* Column layout */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>ROZLOŽENÍ SLOUPCŮ</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1, 2, 3].map((col) => (
                  <button
                    key={col}
                    onClick={() => onUpdateBlock(block.id, {
                      content: { ...paragraphBlock.content, columns: col } as any,
                    })}
                    style={{
                      ...buttonStyle,
                      flex: 1,
                      justifyContent: 'center',
                      padding: '8px 4px',
                      fontSize: '12px',
                      backgroundColor: paragraphColumns === col ? '#3b82f6' : '#334155',
                      color: paragraphColumns === col ? 'white' : '#e5e7eb',
                    }}
                  >
                    {col === 1 ? '▌ 1 sloupec' : col === 2 ? '▌▌ 2 sloupce' : '▌▌▌ 3 sloupce'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '16px', paddingTop: '12px', borderTop: '1px solid #334155' }}>
              <label style={labelStyle}>Převést na</label>
              <button
                onClick={() => {
                  const plainText = (paragraphBlock.content.html || '')
                    .replace(/<[^>]*>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/^\d+\.\s*/, '')
                    .trim();
                  onUpdateBlock(block.id, {
                    type: 'free-answer' as any,
                    content: {
                      question: plainText,
                      lines: 0,
                    },
                  } as any);
                }}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  justifyContent: 'center',
                  backgroundColor: '#334155',
                  gap: '6px',
                }}
              >
                <MessageSquare size={14} />
                Aktivitu (free-answer)
              </button>
            </div>
          </>
        );
      }

      case 'infobox': {
        const infoboxBlock = block as InfoboxBlock;
        // Infobox presets – same visual style as STYLE_PRESETS in VZHLED BLOKU
        const INFOBOX_STYLE_PRESETS = [
          { id: 'blue',   variant: 'blue'   as const, label: 'Info',        styles: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', borderWidth: 2, borderStyle: 'solid' as const, borderRadius: 12, shadow: undefined } },
          { id: 'green',  variant: 'green'  as const, label: 'Tip',         styles: { backgroundColor: '#dcfce7', borderColor: '#22c55e', borderWidth: 2, borderStyle: 'solid' as const, borderRadius: 12, shadow: undefined } },
          { id: 'yellow', variant: 'yellow' as const, label: 'Pozor',       styles: { backgroundColor: '#fef9c3', borderColor: '#eab308', borderWidth: 2, borderStyle: 'solid' as const, borderRadius: 12, shadow: undefined } },
          { id: 'purple', variant: 'purple' as const, label: 'Zajímavost',  styles: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', borderWidth: 2, borderStyle: 'solid' as const, borderRadius: 12, shadow: undefined } },
          { id: 'card',   variant: 'blue'   as const, label: 'Karta',       styles: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', borderWidth: 1, borderStyle: 'solid' as const, borderRadius: 12, shadow: 'medium' as const } },
        ];
        // Determine which infobox preset is active
        const getCurrentInfoboxPreset = () => {
          const vs = block.visualStyles;
          if (!vs || (!vs.backgroundColor && !vs.borderColor)) return 'none';
          for (const p of INFOBOX_STYLE_PRESETS) {
            const ps = p.styles;
            if (vs.backgroundColor === ps.backgroundColor && vs.borderColor === ps.borderColor && vs.borderRadius === ps.borderRadius) return p.id;
          }
          return 'custom';
        };
        const currentInfoboxPreset = getCurrentInfoboxPreset();

        return (
          <>
            {/* Title input */}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Titulek</label>
              <input
                type="text"
                value={infoboxBlock.content.title || ''}
                onChange={(e) => onUpdateBlock(block.id, {
                  content: { ...infoboxBlock.content, title: e.target.value }
                } as Partial<InfoboxBlock>)}
                placeholder="Titulek infoboxu (volitelný)..."
                style={inputStyle}
              />
            </div>

            {/* Style presets — identical look to VZHLED BLOKU */}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#CCCCCC', letterSpacing: '0.8px' }}>STYL INFOBOXU</span>
              </div>
              {/* Same grid as GIVEN BLOKU */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', marginBottom: '16px' }}>
                {INFOBOX_STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      onUpdateBlock(block.id, {
                        content: { ...infoboxBlock.content, variant: preset.variant },
                        visualStyles: { ...block.visualStyles, ...preset.styles },
                      } as any);
                      setShowVisualAdvanced(false);
                    }}
                    title={preset.label}
                    style={{
                      ...buttonStyle,
                      width: '100%',
                      aspectRatio: '1/1',
                      padding: '4px',
                      backgroundColor: '#1e293b',
                      border: currentInfoboxPreset === preset.id ? '2px solid #5C5CFF' : '1px solid #334155',
                      borderRadius: '6px',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    <div style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: preset.styles.backgroundColor || '#334155',
                      border: preset.styles.borderColor ? `${Math.min(2, preset.styles.borderWidth || 1)}px ${preset.styles.borderStyle || 'solid'} ${preset.styles.borderColor}` : 'none',
                      borderRadius: '3px',
                      boxShadow: preset.styles.shadow === 'medium' ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
                    }} />
                  </button>
                ))}
                {/* Custom style button — identical to GIVEN BLOKU */}
                <button
                  onClick={() => setShowVisualAdvanced(!showVisualAdvanced)}
                  title="Vlastní nastavení"
                  style={{
                    ...buttonStyle,
                    width: '100%',
                    aspectRatio: '1/1',
                    padding: '4px',
                    backgroundColor: '#1e293b',
                    border: (currentInfoboxPreset === 'custom' || showVisualAdvanced) ? '2px solid #5C5CFF' : '1px solid #334155',
                    borderRadius: '6px',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ width: '100%', height: '100%', border: '1px dashed #475569', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Palette size={12} style={{ color: '#808080' }} />
                  </div>
                </button>
              </div>
            </div>

            {/* Inline advanced settings – appear directly below presets when palette button is clicked */}
            {showVisualAdvanced && (
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0a1628' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {/* Background color */}
                  <div style={{ flex: 1, position: 'relative' }}>
                    <span style={{ fontSize: 10, color: '#808080', display: 'block', marginBottom: 4 }}>Pozadí</span>
                    <div onClick={() => setShowBgColorPicker(!showBgColorPicker)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', backgroundColor: '#334155', borderRadius: 6, cursor: 'pointer' }}>
                      <div style={{ width: 20, height: 20, backgroundColor: block.visualStyles?.backgroundColor || 'transparent', borderRadius: '50%', border: '1px solid #475569', flexShrink: 0 }} />
                      {block.visualStyles?.backgroundColor && (
                        <button onClick={(e) => { e.stopPropagation(); onUpdateBlock(block.id, { visualStyles: { ...block.visualStyles, backgroundColor: undefined } }); }}
                          style={{ background: 'none', border: 'none', color: '#808080', cursor: 'pointer', padding: 0, marginLeft: 'auto' }}>
                          <X size={10} />
                        </button>
                      )}
                    </div>
                    {showBgColorPicker && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, padding: 12, backgroundColor: '#1e293b', borderRadius: 8, border: '1px solid #334155', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 1000, width: 200 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 10 }}>
                          {TEXT_COLORS.map((color) => (
                            <div key={color.value} title={color.label} onClick={() => { onUpdateBlock(block.id, { visualStyles: { ...block.visualStyles, backgroundColor: color.value } }); setShowBgColorPicker(false); }}
                              style={{ width: 24, height: 24, backgroundColor: color.value, borderRadius: '50%', cursor: 'pointer', border: block.visualStyles?.backgroundColor === color.value ? '2px solid #5C5CFF' : color.value === '#FFFFFF' ? '1px solid #475569' : 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                          ))}
                        </div>
                        <div onClick={() => { const i = document.createElement('input'); i.type = 'color'; i.value = block.visualStyles?.backgroundColor || '#ffffff'; i.onchange = (e) => { onUpdateBlock(block.id, { visualStyles: { ...block.visualStyles, backgroundColor: (e.target as HTMLInputElement).value } }); setShowBgColorPicker(false); }; i.click(); }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6, backgroundColor: '#334155', borderRadius: 4, cursor: 'pointer', fontSize: 10, color: '#E5E5E5' }}>
                          <Palette size={12} /> Vlastní
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Border color */}
                  <div style={{ flex: 1, position: 'relative' }}>
                    <span style={{ fontSize: 10, color: '#808080', display: 'block', marginBottom: 4 }}>Ohraničení</span>
                    <div onClick={() => setShowBorderColorPicker(!showBorderColorPicker)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', backgroundColor: '#334155', borderRadius: 6, cursor: 'pointer' }}>
                      <div style={{ width: 20, height: 20, backgroundColor: 'transparent', borderRadius: '50%', border: `3px ${block.visualStyles?.borderStyle || 'solid'} ${block.visualStyles?.borderColor || '#475569'}`, flexShrink: 0 }} />
                      {block.visualStyles?.borderColor && (
                        <button onClick={(e) => { e.stopPropagation(); onUpdateBlock(block.id, { visualStyles: { ...block.visualStyles, borderColor: undefined, borderWidth: undefined, borderStyle: undefined } }); }}
                          style={{ background: 'none', border: 'none', color: '#808080', cursor: 'pointer', padding: 0, marginLeft: 'auto' }}>
                          <X size={10} />
                        </button>
                      )}
                    </div>
                    {showBorderColorPicker && (
                      <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, padding: 12, backgroundColor: '#1e293b', borderRadius: 8, border: '1px solid #334155', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 1000, width: 200 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 10 }}>
                          {TEXT_COLORS.map((color) => (
                            <div key={color.value} title={color.label} onClick={() => { onUpdateBlock(block.id, { visualStyles: { ...block.visualStyles, borderColor: color.value, borderWidth: block.visualStyles?.borderWidth || 2, borderStyle: 'solid' } }); setShowBorderColorPicker(false); }}
                              style={{ width: 24, height: 24, backgroundColor: color.value, borderRadius: '50%', cursor: 'pointer', border: block.visualStyles?.borderColor === color.value ? '2px solid #5C5CFF' : color.value === '#FFFFFF' ? '1px solid #475569' : 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                          ))}
                        </div>
                        <div onClick={() => { const i = document.createElement('input'); i.type = 'color'; i.value = block.visualStyles?.borderColor || '#3b82f6'; i.onchange = (e) => { onUpdateBlock(block.id, { visualStyles: { ...block.visualStyles, borderColor: (e.target as HTMLInputElement).value, borderWidth: block.visualStyles?.borderWidth || 2, borderStyle: 'solid' } }); setShowBorderColorPicker(false); }; i.click(); }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6, backgroundColor: '#334155', borderRadius: 4, cursor: 'pointer', fontSize: 10, color: '#E5E5E5' }}>
                          <Palette size={12} /> Vlastní
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {/* Border radius */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 10, color: '#808080' }}>Zakulacení rohů</span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{block.visualStyles?.borderRadius ?? 12}px</span>
                  </div>
                  <input type="range" min={0} max={40} step={2} value={block.visualStyles?.borderRadius ?? 12}
                    onChange={(e) => onUpdateBlock(block.id, { visualStyles: { ...block.visualStyles, borderRadius: parseInt(e.target.value) } })}
                    style={{ width: '100%', height: 4, accentColor: '#5C5CFF', cursor: 'pointer' }} />
                </div>
                {/* Border width */}
                {block.visualStyles?.borderColor && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 10, color: '#808080' }}>Tloušťka ohraničení</span>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>{block.visualStyles?.borderWidth ?? 2}px</span>
                    </div>
                    <input type="range" min={1} max={8} step={1} value={block.visualStyles?.borderWidth ?? 2}
                      onChange={(e) => onUpdateBlock(block.id, { visualStyles: { ...block.visualStyles, borderWidth: parseInt(e.target.value) } })}
                      style={{ width: '100%', height: 4, accentColor: '#5C5CFF', cursor: 'pointer' }} />
                  </div>
                )}
              </div>
            )}

            {/* block.image editor */}
            <div style={{ borderTop: '1px solid #334155', marginTop: 12, paddingTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#CCCCCC', letterSpacing: '0.8px' }}>OBRÁZEK VEDLE</span>
                <ImageIcon size={14} style={{ color: '#808080' }} />
              </div>
              {(block as any).image ? (
                <BlockImageEditor block={block} onUpdateBlock={onUpdateBlock} openAssetPicker={openAssetPicker} />
              ) : (
                <button
                  onClick={() => onUpdateBlock(block.id, { image: { url: '', position: 'beside-right', size: 'medium', widthPercent: 35 } } as any)}
                  style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px dashed #334155', background: 'none', color: '#64748b', fontSize: 11, cursor: 'pointer' }}
                >
                  + Přidat obrázek vedle
                </button>
              )}
            </div>
          </>
        );
      }

      case 'image': {
        const imageBlock = block as ImageBlock;
        const imgContent = imageBlock.content as any;
        const gallery: string[] = imgContent.gallery?.length
          ? imgContent.gallery
          : (imgContent.url ? [imgContent.url] : []);
        const galleryCaptions: string[] = imgContent.galleryCaptions || [];
        const gridCols: number = imgContent.gridColumns || 2;
        const imgSize: number = imgContent.size ?? 100;
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
            {/* ── Gallery thumbnails ── */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Obrázky</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {gallery.map((url, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: 'relative',
                      width: '56px',
                      height: '56px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: editingGalleryIndex === idx ? '2px solid #5C5CFF' : '2px solid #334155',
                      cursor: 'pointer',
                      flexShrink: 0,
                      backgroundColor: '#0f172a',
                    }}
                    onClick={() => setEditingGalleryIndex(editingGalleryIndex === idx ? null : idx)}
                  >
                    {url ? (
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ImageIcon size={20} style={{ color: '#475569' }} />
                      </div>
                    )}
                    {editingGalleryIndex === idx && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(92,92,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={14} style={{ color: '#5C5CFF' }} />
                      </div>
                    )}
                  </div>
                ))}
                {/* Add image button */}
                <button
                  onClick={() => openAssetPicker({ type: 'gallery-image-add' })}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '8px',
                    border: '2px dashed #475569',
                    backgroundColor: '#0f172a',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    flexShrink: 0,
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#5C5CFF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#475569'; }}
                >
                  <Plus size={16} style={{ color: '#64748b' }} />
                  <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 600 }}>PŘIDAT</span>
                </button>
              </div>

              {/* Empty state */}
              {gallery.length === 0 && (
                <button
                  onClick={() => openAssetPicker({ type: 'gallery-image-add' })}
                  style={{
                    width: '100%',
                    padding: '24px',
                    backgroundColor: '#0f172a',
                    border: '2px dashed #475569',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#5C5CFF'; e.currentTarget.style.backgroundColor = '#1e293b'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#475569'; e.currentTarget.style.backgroundColor = '#0f172a'; }}
                >
                  <ImageIcon size={28} style={{ color: '#5C5CFF' }} />
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>Vybrat obrázek</span>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>Nahrát, knihovna, GIFy...</span>
                </button>
              )}

              {/* Selected image detail panel */}
              {editingGalleryIndex !== null && gallery[editingGalleryIndex] !== undefined && (
                <div style={{ backgroundColor: '#0f172a', borderRadius: '10px', padding: '12px', border: '1px solid #334155', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Obrázek {editingGalleryIndex + 1}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => setImageEditModalIndex(editingGalleryIndex)}
                        style={{ ...buttonStyle, fontSize: '10px', padding: '3px 8px', backgroundColor: '#334155' }}
                        title="Oříznout nebo přegenerovat"
                      >
                        ✂ Upravit
                      </button>
                      <button
                        onClick={() => openAssetPicker({ type: 'gallery-image-replace', imageIndex: editingGalleryIndex })}
                        style={{ ...buttonStyle, fontSize: '10px', padding: '3px 8px' }}
                      >
                        <ImageIcon size={11} /> Změnit
                      </button>
                      <button
                        onClick={() => handleRemoveGalleryImage(editingGalleryIndex)}
                        style={{ ...buttonStyle, fontSize: '10px', padding: '3px 8px', color: '#ef4444' }}
                      >
                        <Trash2 size={11} /> Smazat
                      </button>
                    </div>
                  </div>
                  <label style={labelStyle}>Popisek k obrázku</label>
                  <input
                    type="text"
                    value={galleryCaptions[editingGalleryIndex] || ''}
                    onChange={(e) => {
                      const newCaptions = [...galleryCaptions];
                      while (newCaptions.length <= editingGalleryIndex) newCaptions.push('');
                      newCaptions[editingGalleryIndex] = e.target.value;
                      updateImg({ galleryCaptions: newCaptions });
                    }}
                    placeholder="Popisek k tomuto obrázku..."
                    style={inputStyle}
                  />
                </div>
              )}
            </div>

            {/* ── Caption font size (only when at least one caption exists) ── */}
            {galleryCaptions.some(c => !!c) && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Velikost popisků</span>
                  <span style={{ color: '#5C5CFF', fontWeight: 700 }}>{imgContent.captionFontSize ?? 11}px</span>
                </label>
                <input
                  type="range"
                  min={8}
                  max={24}
                  value={imgContent.captionFontSize ?? 11}
                  onChange={e => updateImg({ captionFontSize: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: '#5C5CFF', marginBottom: 2 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#64748b', fontWeight: 700 }}>
                  <span>Malé</span><span>Střední</span><span>Velké</span>
                </div>
              </div>
            )}

            {/* ── Grid columns (only when > 1 image) ── */}
            {gallery.length > 1 && (
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Počet sloupců</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[1, 2, 3, 4].map(cols => (
                    <button
                      key={cols}
                      onClick={() => updateImg({ gridColumns: cols })}
                      style={{
                        ...buttonStyle,
                        flex: 1,
                        justifyContent: 'center',
                        backgroundColor: gridCols === cols ? '#5C5CFF' : '#334155',
                        color: gridCols === cols ? 'white' : '#94a3b8',
                        fontWeight: gridCols === cols ? 700 : 400,
                      }}
                    >
                      {cols}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Size / Crop ── */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
                <span>Velikost</span>
                <span style={{ color: '#5C5CFF', fontWeight: 700 }}>{imgSize}%</span>
              </label>
              <input
                type="range"
                min={10}
                max={200}
                value={imgSize}
                onChange={(e) => updateImg({ size: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: '#5C5CFF', marginBottom: '4px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                <span>Zmenšení</span>
                <span style={imgSize === 100 ? { color: '#5C5CFF' } : {}}>Původní</span>
                <span>Ořez</span>
              </div>
            </div>

            {/* ── Alignment (single image only) ── */}
            {gallery.length <= 1 && (
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Zarovnání</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {([['left', <AlignLeft size={14} />], ['center', <AlignCenter size={14} />], ['right', <AlignRight size={14} />]] as const).map(([value, icon]) => (
                    <button
                      key={value}
                      onClick={() => updateImg({ alignment: value })}
                      style={{
                        ...buttonStyle,
                        flex: 1,
                        justifyContent: 'center',
                        backgroundColor: imgAlignment === value ? '#5C5CFF' : '#334155',
                        color: imgAlignment === value ? 'white' : '#94a3b8',
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Gallery Visual Styles ── */}
            <div style={{ marginBottom: '16px', borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
              <label style={{ ...labelStyle, marginBottom: '8px', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '9px' }}>
                ✦ Vizuální styl
              </label>

              {/* Shape */}
              <label style={labelStyle}>Tvar výřezu</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', marginBottom: '12px' }}>
                {[
                  { id: 'rectangle', label: '▭', title: 'Obdélník' },
                  { id: 'circle', label: '●', title: 'Kolečko' },
                  { id: 'heart', label: '♥', title: 'Srdíčko' },
                  { id: 'triangle', label: '▲', title: 'Trojúhelník' },
                  { id: 'star', label: '★', title: 'Hvězdička' },
                  { id: 'speech-bubble', label: '💬', title: 'Komiksová bublina' },
                ].map(({ id, label, title }) => (
                  <button
                    key={id}
                    title={title}
                    onClick={() => updateImg({ galleryItemShape: id })}
                    style={{
                      ...buttonStyle,
                      justifyContent: 'center',
                      fontSize: id === 'speech-bubble' ? '14px' : '16px',
                      backgroundColor: itemShape === id ? '#7c3aed' : '#334155',
                      color: itemShape === id ? 'white' : '#94a3b8',
                      padding: '6px 0',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Border radius (only for rectangle) */}
              {itemShape === 'rectangle' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Zakulacení rohů</span>
                    <span style={{ color: '#7c3aed', fontWeight: 700 }}>{borderRadius}px</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    value={borderRadius}
                    onChange={(e) => updateImg({ galleryBorderRadius: parseInt(e.target.value) })}
                    style={{ width: '100%', accentColor: '#7c3aed' }}
                  />
                </div>
              )}

              {/* Stroke */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Obrys (stroke)</span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {/* Stroke color button */}
                    <button
                      ref={imgStrokeBtnRef}
                      onClick={() => {
                        if (imgColorPickerOpen === 'stroke') {
                          setImgColorPickerOpen(null); setImgColorPickerPos(null);
                        } else {
                          const btn = imgStrokeBtnRef.current;
                          if (btn) {
                            const rect = btn.getBoundingClientRect();
                            setImgColorPickerPos({ top: rect.bottom + 4, left: rect.left });
                          }
                          setImgColorPickerOpen('stroke');
                        }
                      }}
                      title="Barva obrysu"
                      style={{
                        width: '20px', height: '20px', padding: 0,
                        border: imgColorPickerOpen === 'stroke' ? '2px solid #7c3aed' : '2px solid #475569',
                        borderRadius: '4px', cursor: 'pointer',
                        backgroundColor: strokeColor,
                      }}
                    />
                    <span style={{ color: '#7c3aed', fontWeight: 700, fontSize: '11px' }}>{strokeWidth}px</span>
                  </div>
                </label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={strokeWidth}
                  onChange={(e) => updateImg({ galleryStrokeWidth: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: '#7c3aed' }}
                />
              </div>

              {/* Rotation */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Náhodné natočení</span>
                  <button
                    onClick={() => updateImg({ galleryRotate: !galleryRotate })}
                    style={{
                      fontSize: '10px', padding: '2px 8px', borderRadius: '6px', cursor: 'pointer', border: 'none',
                      backgroundColor: galleryRotate ? '#7c3aed' : '#334155',
                      color: galleryRotate ? 'white' : '#94a3b8',
                    }}
                  >
                    {galleryRotate ? 'Zap' : 'Vyp'}
                  </button>
                </label>
                {galleryRotate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <input
                      type="range"
                      min={1}
                      max={15}
                      value={galleryRotateMax}
                      onChange={(e) => updateImg({ galleryRotateMax: parseInt(e.target.value) })}
                      style={{ flex: 1, accentColor: '#7c3aed' }}
                    />
                    <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 700, minWidth: '32px' }}>±{galleryRotateMax}°</span>
                  </div>
                )}
              </div>

              {/* Labels */}
              <div style={{ marginBottom: '4px' }}>
                <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Štítky</span>
                  {labelType !== 'none' && (
                    <button
                      ref={imgLabelBtnRef}
                      onClick={() => {
                        if (imgColorPickerOpen === 'label') {
                          setImgColorPickerOpen(null); setImgColorPickerPos(null);
                        } else {
                          const btn = imgLabelBtnRef.current;
                          if (btn) {
                            const rect = btn.getBoundingClientRect();
                            setImgColorPickerPos({ top: rect.bottom + 4, left: rect.left });
                          }
                          setImgColorPickerOpen('label');
                        }
                      }}
                      title="Barva štítku"
                      style={{
                        width: '20px', height: '20px', padding: 0,
                        border: imgColorPickerOpen === 'label' ? '2px solid #7c3aed' : '2px solid #475569',
                        borderRadius: '50%', cursor: 'pointer',
                        backgroundColor: labelColor,
                      }}
                    />
                  )}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                  {[
                    { id: 'none', label: 'Žádné' },
                    { id: 'letters', label: 'A, B, C' },
                    { id: 'numbers', label: '1, 2, 3' },
                    { id: 'roman', label: 'I, II, III' },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => updateImg({ galleryLabelType: id })}
                      style={{
                        ...buttonStyle,
                        justifyContent: 'center',
                        fontSize: '10px',
                        backgroundColor: labelType === id ? '#7c3aed' : '#334155',
                        color: labelType === id ? 'white' : '#94a3b8',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Color palette portal for stroke / label */}
            {imgColorPickerOpen !== null && imgColorPickerPos && createPortal(
              <div
                data-img-color-palette
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'fixed',
                  top: imgColorPickerPos.top,
                  left: imgColorPickerPos.left,
                  zIndex: 99999,
                  padding: '8px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gap: '4px',
                  width: '170px',
                }}
              >
                {LABEL_COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      if (imgColorPickerOpen === 'stroke') updateImg({ galleryStrokeColor: color });
                      else updateImg({ galleryLabelColor: color });
                      setImgColorPickerOpen(null);
                      setImgColorPickerPos(null);
                    }}
                    style={{
                      width: '22px', height: '22px', padding: 0,
                      border: (imgColorPickerOpen === 'stroke' ? strokeColor : labelColor) === color ? '2px solid white' : '2px solid transparent',
                      borderRadius: '4px', cursor: 'pointer',
                      backgroundColor: color,
                    }}
                  />
                ))}
                {/* white + black */}
                {['#ffffff', '#000000'].map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      if (imgColorPickerOpen === 'stroke') updateImg({ galleryStrokeColor: color });
                      else updateImg({ galleryLabelColor: color });
                      setImgColorPickerOpen(null);
                      setImgColorPickerPos(null);
                    }}
                    style={{
                      width: '22px', height: '22px', padding: 0,
                      border: (imgColorPickerOpen === 'stroke' ? strokeColor : labelColor) === color ? '2px solid #5C5CFF' : '2px solid #475569',
                      borderRadius: '4px', cursor: 'pointer',
                      backgroundColor: color,
                    }}
                  />
                ))}
              </div>,
              document.body
            )}

            {/* ── Activity overlay ── */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Aktivita na obrázku</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                {[
                  { id: 'none', label: 'Žádná' },
                  { id: 'text-input', label: 'Pole pro text', icon: <Type size={11} /> },
                  { id: 'checkbox-circle', label: 'Kolečko', icon: <CircleDot size={11} /> },
                  { id: 'checkbox-square', label: 'Čtvereček', icon: <Square size={11} /> },
                ].map(({ id, label, icon }) => (
                  <button
                    key={id}
                    onClick={() => updateImg({ imageActivityType: id })}
                    style={{
                      ...buttonStyle,
                      justifyContent: 'center',
                      gap: '4px',
                      backgroundColor: activityType === id ? '#5C5CFF' : '#334155',
                      color: activityType === id ? 'white' : '#94a3b8',
                      fontSize: '10px',
                    }}
                  >
                    {icon}{label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Global caption ── */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Popisek bloku</label>
              <input
                type="text"
                value={imgContent.caption || ''}
                onChange={(e) => updateImg({ caption: e.target.value })}
                placeholder="Volitelný popisek..."
                style={inputStyle}
              />
            </div>

            {/* ── Convert to sub-questions ── */}
            {gallery.length >= 2 && (
              <div style={{ marginBottom: '16px', borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
                <label style={{ ...labelStyle, marginBottom: '8px', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '9px' }}>
                  ⇄ Transformace
                </label>
                <button
                  onClick={() => {
                    const subQs: FreeAnswerSubQuestion[] = gallery.map((url, idx) => ({
                      id: `sq-${Date.now()}-${idx}`,
                      text: galleryCaptions[idx] || '',
                      lines: 2,
                      imageUrl: url,
                      imagePosition: 'below' as const,
                    }));
                    const cols = Math.min(gridCols, 3) as 1 | 2 | 3;
                    const newLabelType: SubQuestionLabelType = (labelType === 'none' ? 'none' : labelType) as SubQuestionLabelType;
                    onUpdateBlock(block.id, {
                      type: 'free-answer',
                      content: {
                        question: imgContent.caption || '',
                        lines: 2,
                        subQuestions: subQs,
                        subColumns: cols,
                        subLabelType: newLabelType === 'none' ? 'letters' : newLabelType,
                        subLabelStyle: 'circle',
                        subLabelColors: [labelColor],
                        subOutlineEnabled: strokeWidth > 0,
                        subOutlineColors: strokeWidth > 0 ? [strokeColor] : ['#334155'],
                        subBorderRadius: borderRadius,
                        subAnswerStyle: 'dotted',
                        subAnswerLines: 2,
                        subShowBackground: false,
                        // Přenést vizuální vlastnosti galerie
                        subImageShape: itemShape as any,
                        subImageBorderRadius: borderRadius,
                        subImageStrokeColor: strokeColor,
                        subImageStrokeWidth: strokeWidth,
                        subImageRotate: galleryRotate,
                        subImageRotateMax: galleryRotateMax,
                        subImageHeight: typeof imgContent.height === 'number' ? imgContent.height : 150,
                      },
                    } as any);
                  }}
                  style={{
                    ...buttonStyle,
                    width: '100%',
                    justifyContent: 'center',
                    gap: '6px',
                    backgroundColor: '#78350f',
                    color: '#fcd34d',
                    border: '1px solid #92400e',
                    padding: '8px 12px',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  <Layers size={13} />
                  Převést galerii na Pod-otázky
                </button>
                <p style={{ color: '#78716c', fontSize: '9px', marginTop: '5px', lineHeight: 1.4 }}>
                  Každý obrázek se stane samostatnou pod-otázkou s místem pro odpověď. Vizuální styl se zachová.
                </p>
              </div>
            )}

            {/* ── Image edit modal ── */}
            {imageEditModalIndex !== null && gallery[imageEditModalIndex] && (
              <ImageEditModal
                imageUrl={gallery[imageEditModalIndex]}
                altText={galleryCaptions[imageEditModalIndex] || imgContent.alt || ''}
                onClose={() => setImageEditModalIndex(null)}
                onApply={(newUrl) => {
                  const newGallery = [...gallery];
                  newGallery[imageEditModalIndex] = newUrl;
                  updateImg({ url: newGallery[0], gallery: newGallery });
                  setImageEditModalIndex(null);
                }}
              />
            )}
          </>
        );
      }

      case 'spacer': {
        const spacerBlock = block as SpacerBlock;
        return (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Výška (px)</label>
              <input
                type="number"
                value={spacerBlock.content.height || 100}
                onChange={(e) => onUpdateBlock(block.id, {
                  content: { ...spacerBlock.content, height: parseInt(e.target.value) || 100 }
                } as Partial<SpacerBlock>)}
                min={10}
                max={500}
                style={{ ...inputStyle, width: '100px' }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Styl</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {SPACER_STYLES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => onUpdateBlock(block.id, {
                      content: { ...spacerBlock.content, style: value }
                    } as Partial<SpacerBlock>)}
                    style={{
                      ...buttonStyle,
                      backgroundColor: spacerBlock.content.style === value ? '#5C5CFF' : '#334155',
                      color: spacerBlock.content.style === value ? 'white' : '#94a3b8',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#1e293b',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px',
        borderBottom: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexShrink: 0,
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          backgroundColor: '#5C5CFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon size={16} style={{ color: 'white' }} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#E5E5E5', margin: 0 }}>
            {label}
          </h3>
          <p style={{ fontSize: '10px', color: '#808080', margin: 0 }}>
            Nastavení bloku
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            padding: '4px',
            cursor: 'pointer',
            color: '#808080',
            display: 'flex',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Actions */}
      <div style={{
        padding: '12px',
        borderBottom: '1px solid #334155',
        display: 'flex',
        gap: '8px',
        flexShrink: 0,
        backgroundColor: '#1e293b',
      }}>
        <button
          onClick={() => onMoveUp?.(block.id)}
          disabled={!canMoveUp}
          style={{
            ...buttonStyle,
            backgroundColor: '#F97316',
            color: 'white',
            opacity: canMoveUp ? 1 : 0.4,
            cursor: canMoveUp ? 'pointer' : 'not-allowed',
          }}
        >
          <ChevronUp size={14} />
        </button>
        <button
          onClick={() => onMoveDown?.(block.id)}
          disabled={!canMoveDown}
          style={{
            ...buttonStyle,
            backgroundColor: '#F97316',
            color: 'white',
            opacity: canMoveDown ? 1 : 0.4,
            cursor: canMoveDown ? 'pointer' : 'not-allowed',
          }}
        >
          <ChevronDown size={14} />
        </button>
        <button
          onClick={() => onDuplicateBlock(block.id)}
          style={buttonStyle}
        >
          <Copy size={14} />
          Duplikovat
        </button>
        <div style={{ flex: 1 }} />
        {confirmDelete ? (
          <>
            <button
              onClick={() => setConfirmDelete(false)}
              style={buttonStyle}
            >
              Zrušit
            </button>
            <button
              onClick={() => {
                onDeleteBlock(block.id);
                onClose();
              }}
              style={{
                ...buttonStyle,
                backgroundColor: '#EF4444',
                color: 'white',
              }}
            >
              Potvrdit
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              ...buttonStyle,
              color: '#EF4444',
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>

        {/* Typ bloku (Aktivita/Informace) - úplně nahoře pro free-canvas */}
        {block.type === 'free-canvas' && (
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Typ bloku</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => onUpdateBlock(block.id, { noActivityNumber: false } as any)}
                style={{
                  ...buttonStyle, flex: 1, justifyContent: 'center',
                  backgroundColor: !block.noActivityNumber ? '#5C5CFF' : '#334155',
                  color: !block.noActivityNumber ? 'white' : '#94a3b8',
                }}
              >
                Aktivita
              </button>
              <button
                onClick={() => onUpdateBlock(block.id, { noActivityNumber: true } as any)}
                style={{
                  ...buttonStyle, flex: 1, justifyContent: 'center',
                  backgroundColor: block.noActivityNumber ? '#5C5CFF' : '#334155',
                  color: block.noActivityNumber ? 'white' : '#94a3b8',
                }}
              >
                Informace
              </button>
            </div>
          </div>
        )}

        {/* Type-specific settings (heading levels, paragraph convert, spacer styles...) */}
        {renderTypeSpecificSettings()}

        {/* ABC Question specific settings - SEPARATED FROM TEXT SECTION */}
        {block.type === 'multiple-choice' && (
          <div style={{ 
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#1e293b',
            borderRadius: '8px',
          }}>
        <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Typ odpovědí</label>
              <select
                value={(block as MultipleChoiceBlock).content.variant || 'text'}
                onChange={(e) => {
                  const mcBlock = block as MultipleChoiceBlock;
                  const newVariant = e.target.value as any;
                  // If switching to playful or playful-image, initialize playful settings
                  let updates: any = { content: { ...mcBlock.content, variant: newVariant } };
                  if (newVariant === 'playful' || newVariant === 'playful-image') {
                    const existingSettings = mcBlock.content.playfulSettings;
                    const needsNewPositions = !existingSettings?.positions || 
                      existingSettings.positions.length < mcBlock.content.options.length;
                    
                    updates.content.playfulSettings = {
                      shape: existingSettings?.shape || 'circle' as PlayfulAnswerShape,
                      style: existingSettings?.style || 'stroke' as PlayfulAnswerStyle,
                      primaryColor: existingSettings?.primaryColor || '#ef4444',
                      textColor: existingSettings?.textColor || '#ef4444',
                      strokeWidth: existingSettings?.strokeWidth || 2,
                      randomColors: existingSettings?.randomColors || false,
                      positions: needsNewPositions 
                        ? generatePlayfulPositions(mcBlock.content.options.length, block.id)
                        : existingSettings.positions,
                    };
                    updates.content.visualStyle = newVariant;
                  } else {
                    updates.content.visualStyle = 'list';
                  }
                  onUpdateBlock(block.id, updates as Partial<MultipleChoiceBlock>);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#334155',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  color: '#e5e7eb',
                  fontSize: '12px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="text">📝 ABC text</option>
                <option value="mixed">🖼️ ABC text + obrázky</option>
                <option value="image">🎨 ABC obrázky</option>
                <option value="boolean">✅ Ano / Ne</option>
                <option value="playful">🎯 Hravé ABC</option>
                <option value="playful-image">🖼️ Hravé obrázky</option>
              </select>
            </div>

            {/* Playful ABC / Playful Image Settings */}
            {((block as MultipleChoiceBlock).content.variant === 'playful' || (block as MultipleChoiceBlock).content.variant === 'playful-image') && (
              <div style={{ 
                marginBottom: '16px', 
                padding: '12px', 
                backgroundColor: '#0f172a', 
                borderRadius: '8px',
                border: '1px solid #334155',
              }}>
                <label style={{ ...labelStyle, color: '#f59e0b', marginBottom: '12px', display: 'block' }}>
                  🎨 Nastavení hravého stylu
          </label>
                
                {/* Shape selection */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ ...labelStyle, fontSize: '10px' }}>Tvar</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                    {[
                      { value: 'circle', label: '⭕ Kolečka' },
                      { value: 'square', label: '⬜ Čtverce' },
                      { value: 'pill', label: '💊 Bobánky' },
                      { value: 'bubble', label: '💬 Bubliny' },
                      { value: 'heart', label: '❤️ Srdce' },
                      { value: 'hexagon', label: '⬡ Šestiúhel.' },
                      { value: 'diamond', label: '◇ Kosočtv.' },
                      { value: 'cloud', label: '☁️ Mráčky' },
                      { value: 'mix', label: '🎲 Mix' },
                    ].map((shape) => (
                      <button
                        key={shape.value}
                        onClick={() => {
                          const mcBlock = block as MultipleChoiceBlock;
                          const currentSettings = mcBlock.content.playfulSettings || {
                            shape: 'circle' as PlayfulAnswerShape,
                            style: 'stroke' as PlayfulAnswerStyle,
                            primaryColor: '#ef4444',
                            textColor: '#ef4444',
                            strokeWidth: 2,
                            positions: [],
                          };
                          onUpdateBlock(block.id, {
                            content: {
                              ...mcBlock.content,
                              playfulSettings: { ...currentSettings, shape: shape.value as PlayfulAnswerShape }
                            }
                          } as Partial<MultipleChoiceBlock>);
                        }}
                        style={{
                          ...buttonStyle,
                          justifyContent: 'center',
                          backgroundColor: ((block as MultipleChoiceBlock).content.playfulSettings?.shape || 'circle') === shape.value ? '#f59e0b' : '#334155',
                          color: ((block as MultipleChoiceBlock).content.playfulSettings?.shape || 'circle') === shape.value ? '#0f172a' : '#94a3b8',
                          fontSize: '9px',
                          padding: '6px 2px',
                        }}
                      >
                        {shape.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Style selection */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ ...labelStyle, fontSize: '10px' }}>Styl</label>
          <div style={{ display: 'flex', gap: '4px' }}>
                    {[
                      { value: 'stroke', label: 'Obrys' },
                      { value: 'fill', label: 'Výplň' },
                    ].map((style) => (
              <button
                        key={style.value}
                        onClick={() => {
                          const mcBlock = block as MultipleChoiceBlock;
                          const currentSettings = mcBlock.content.playfulSettings || {
                            shape: 'circle' as PlayfulAnswerShape,
                            style: 'stroke' as PlayfulAnswerStyle,
                            primaryColor: '#ef4444',
                            textColor: '#ef4444',
                            strokeWidth: 2,
                            positions: [],
                          };
                          onUpdateBlock(block.id, {
                            content: {
                              ...mcBlock.content,
                              playfulSettings: { ...currentSettings, style: style.value as PlayfulAnswerStyle }
                            }
                          } as Partial<MultipleChoiceBlock>);
                        }}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  justifyContent: 'center',
                          backgroundColor: ((block as MultipleChoiceBlock).content.playfulSettings?.style || 'stroke') === style.value ? '#f59e0b' : '#334155',
                          color: ((block as MultipleChoiceBlock).content.playfulSettings?.style || 'stroke') === style.value ? '#0f172a' : '#94a3b8',
                          fontSize: '11px',
                          padding: '8px 4px',
                        }}
                      >
                        {style.label}
              </button>
            ))}
          </div>
        </div>

                {/* Color picker - same style as text color picker */}
                <div style={{ marginBottom: '12px', position: 'relative' }}>
                  <label style={{ ...labelStyle, fontSize: '10px' }}>Barva tvaru</label>
                  
                  {/* Color picker trigger (dropdown style) */}
                  <div 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      backgroundColor: '#334155',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: '1px solid #475569',
                    }}
                    onClick={() => setShowPlayfulColorPicker(!showPlayfulColorPicker)}
                  >
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        backgroundColor: (block as MultipleChoiceBlock).content.playfulSettings?.primaryColor || '#ef4444',
                        borderRadius: '50%',
                        border: '1px solid #475569',
                      }}
                    />
                    <span style={{ fontSize: '12px', color: '#E5E5E5', flex: 1 }}>
                      {(block as MultipleChoiceBlock).content.playfulSettings?.randomColors 
                        ? '🎲 Náhodné barvy'
                        : TEXT_COLORS.find(c => c.value === (block as MultipleChoiceBlock).content.playfulSettings?.primaryColor)?.label || 'Vlastní barva'
                      }
                    </span>
                    <ChevronDownIcon 
                      size={14} 
                      style={{ 
                        color: '#808080',
                        transform: showPlayfulColorPicker ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }} 
                    />
                  </div>
                  
                  {/* Color Picker Dropdown */}
                  {showPlayfulColorPicker && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        padding: '12px',
                        backgroundColor: '#1e293b',
                        borderRadius: '8px',
                        border: '1px solid #334155',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        zIndex: 1000,
                      }}
                    >
                      {/* Preset Colors Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(6, 1fr)',
                        gap: '8px',
                        marginBottom: '12px',
                      }}>
                        {TEXT_COLORS.map((color) => (
                          <div
                            key={color.value}
                            title={color.label}
                            onClick={() => {
                              const mcBlock = block as MultipleChoiceBlock;
                              const currentSettings = mcBlock.content.playfulSettings || {
                                shape: 'circle' as PlayfulAnswerShape,
                                style: 'stroke' as PlayfulAnswerStyle,
                                primaryColor: '#ef4444',
                                textColor: '#ef4444',
                                strokeWidth: 2,
                                positions: [],
                              };
                              onUpdateBlock(block.id, {
                                content: {
                                  ...mcBlock.content,
                                  playfulSettings: { ...currentSettings, primaryColor: color.value, textColor: color.value, randomColors: false }
                                }
                              } as Partial<MultipleChoiceBlock>);
                              setShowPlayfulColorPicker(false);
                            }}
                            style={{
                              width: '28px',
                              height: '28px',
                              backgroundColor: color.value,
                              borderRadius: '50%',
                              cursor: 'pointer',
                              border: (block as MultipleChoiceBlock).content.playfulSettings?.primaryColor === color.value && 
                                     !(block as MultipleChoiceBlock).content.playfulSettings?.randomColors
                                ? '2px solid #5C5CFF' 
                                : color.value === '#FFFFFF' 
                                  ? '1px solid #475569' 
                                  : 'none',
                              boxShadow: (block as MultipleChoiceBlock).content.playfulSettings?.primaryColor === color.value 
                                ? '0 0 0 2px rgba(92, 92, 255, 0.3)' 
                                : '0 1px 3px rgba(0,0,0,0.3)',
                              transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                            }}
                          />
                        ))}
                      </div>
                      
                      {/* Random colors toggle */}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => {
                            const mcBlock = block as MultipleChoiceBlock;
                            const currentSettings = mcBlock.content.playfulSettings || {
                              shape: 'circle' as PlayfulAnswerShape,
                              style: 'stroke' as PlayfulAnswerStyle,
                              primaryColor: '#ef4444',
                              textColor: '#ef4444',
                              strokeWidth: 2,
                              positions: [],
                            };
                            
                            // Generate random colors for each position
                            const newPositions = currentSettings.positions.map((pos, i) => ({
                              ...pos,
                              color: RANDOM_COLORS[i % RANDOM_COLORS.length],
                            }));
                            
                            onUpdateBlock(block.id, {
                              content: {
                                ...mcBlock.content,
                                playfulSettings: { 
                                  ...currentSettings, 
                                  randomColors: true,
                                  positions: newPositions,
                                }
                              }
                            } as Partial<MultipleChoiceBlock>);
                            setShowPlayfulColorPicker(false);
                          }}
                          style={{
                            flex: 1,
                            padding: '8px',
                            backgroundColor: (block as MultipleChoiceBlock).content.playfulSettings?.randomColors ? '#5C5CFF' : '#334155',
                            color: (block as MultipleChoiceBlock).content.playfulSettings?.randomColors ? 'white' : '#94a3b8',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 500,
                          }}
                        >
                          🎲 Náhodné barvy
                        </button>
                        
                        {/* Regenerate random colors button */}
                        {(block as MultipleChoiceBlock).content.playfulSettings?.randomColors && (
                          <button
                            onClick={() => {
                              const mcBlock = block as MultipleChoiceBlock;
                              const currentSettings = mcBlock.content.playfulSettings!;
                              
                              // Shuffle colors - generate new random combination
                              const shuffledColors = [...RANDOM_COLORS].sort(() => Math.random() - 0.5);
                              const newPositions = currentSettings.positions.map((pos, i) => ({
                                ...pos,
                                color: shuffledColors[i % shuffledColors.length],
                              }));
                              
                              onUpdateBlock(block.id, {
                                content: {
                                  ...mcBlock.content,
                                  playfulSettings: { 
                                    ...currentSettings, 
                                    positions: newPositions,
                                  }
                                }
                              } as Partial<MultipleChoiceBlock>);
                            }}
                            style={{
                              padding: '8px 12px',
                              backgroundColor: '#334155',
                              color: '#94a3b8',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 500,
                            }}
                            title="Vygenerovat nové barvy"
                          >
                            🔄
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Regenerate positions button */}
                <button
                  onClick={() => {
                    const mcBlock = block as MultipleChoiceBlock;
                    const currentSettings = mcBlock.content.playfulSettings || {
                      shape: 'circle' as PlayfulAnswerShape,
                      style: 'stroke' as PlayfulAnswerStyle,
                      primaryColor: '#ef4444',
                      textColor: '#ef4444',
                      strokeWidth: 2,
                      positions: [],
                    };
                    onUpdateBlock(block.id, {
                      content: {
                        ...mcBlock.content,
                        playfulSettings: {
                          ...currentSettings,
                          positions: generatePlayfulPositions(mcBlock.content.options.length, Date.now().toString()),
                        }
                      }
                    } as Partial<MultipleChoiceBlock>);
                    toast.success('Pozice přegenerovány!');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#334155',
                    border: '1px dashed #475569',
                    borderRadius: '6px',
                    color: '#94a3b8',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  🔄 Přegenerovat pozice
                </button>
              </div>
            )}

            {/* Layout options for text variant */}
            {((block as MultipleChoiceBlock).content.variant || 'text') === 'text' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Rozložení odpovědí</label>
          <div style={{ display: 'flex', gap: '4px' }}>
                  {[
                    { value: 1, label: 'Pod sebou' },
                    { value: 2, label: '2 sloupce' },
                    { value: 4, label: 'V řádku' },
                  ].map((layout) => (
              <button
                      key={layout.value}
                      onClick={() => onUpdateBlock(block.id, {
                        content: { ...(block as MultipleChoiceBlock).content, gridColumns: layout.value }
                      } as any)}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  justifyContent: 'center',
                        backgroundColor: ((block as MultipleChoiceBlock).content.gridColumns || 1) === layout.value ? '#5C5CFF' : '#334155',
                        color: ((block as MultipleChoiceBlock).content.gridColumns || 1) === layout.value ? 'white' : '#94a3b8',
                        fontSize: '10px',
                }}
              >
                      {layout.label}
              </button>
            ))}
          </div>
        </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderTop: '1px solid #333', paddingTop: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#CCCCCC' }}>MOŽNOSTI ODPOVĚDÍ</span>
            </div>

            {((block as MultipleChoiceBlock).content.variant === 'boolean') ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['Ano', 'Ne'].map((label, idx) => {
                  const mcBlock = block as MultipleChoiceBlock;
                  const optionId = `opt-bool-${idx}`;
                  const isCorrect = mcBlock.content.correctAnswers.includes(optionId);
                  
                  // Ensure boolean options exist
                  if (!mcBlock.content.options.find(o => o.id === optionId)) {
                    const newOptions = [...mcBlock.content.options];
                    if (!newOptions.find(o => o.id === optionId)) {
                      newOptions.push({ id: optionId, text: label });
                      onUpdateBlock(block.id, { content: { ...mcBlock.content, options: newOptions } } as any);
                    }
                  }

                  return (
                    <div key={optionId} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <div style={{
                        flex: 1,
                        padding: '8px 12px',
                        backgroundColor: '#334155',
                        borderRadius: '6px',
                        color: '#E5E5E5',
                        fontSize: '12px',
                        fontWeight: 500
                      }}>
                        {label}
                      </div>
                      <button
                        onClick={() => {
                          onUpdateBlock(block.id, {
                            content: { ...mcBlock.content, correctAnswers: [optionId] }
                          } as any);
                        }}
                        style={{
                          ...buttonStyle,
                          width: '32px',
                          height: '32px',
                          padding: 0,
                          justifyContent: 'center',
                          backgroundColor: isCorrect ? '#10B981' : '#334155',
                          color: isCorrect ? 'white' : '#94a3b8',
                        }}
                      >
                        <Check size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                {((block as MultipleChoiceBlock).content.variant === 'image' || (block as MultipleChoiceBlock).content.variant === 'mixed') && (
                  <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Velikost obrázků</label>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[
                          { value: 2, label: 'Malé' },
                          { value: 3, label: 'Střední' },
                          { value: 4, label: 'Velké' },
                          { value: 6, label: 'Max' },
                        ].map((size) => (
                          <button
                            key={size.value}
                            onClick={() => onUpdateBlock(block.id, {
                              content: { ...(block as MultipleChoiceBlock).content, gridColumns: 12 / size.value }
                            } as any)}
                            style={{
                              ...buttonStyle,
                              flex: 1,
                              justifyContent: 'center',
                              backgroundColor: ((block as MultipleChoiceBlock).content.gridColumns === 12 / size.value) ? '#5C5CFF' : '#334155',
                              color: ((block as MultipleChoiceBlock).content.gridColumns === 12 / size.value) ? 'white' : '#94a3b8',
                            }}
                          >
                            {size.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Show letter position for both image and mixed mode */}
                    {((block as MultipleChoiceBlock).content.variant === 'image' || (block as MultipleChoiceBlock).content.variant === 'mixed') && (
                      <div>
                        <label style={labelStyle}>Pozice písmen</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[
                            { value: 'bottom', label: 'Pod obrázkem' },
                            { value: 'overlay', label: 'V rohu' },
                          ].map((pos) => (
                            <button
                              key={pos.value}
                              onClick={() => onUpdateBlock(block.id, {
                                content: { ...(block as MultipleChoiceBlock).content, letterPosition: pos.value as any }
                              } as any)}
                              style={{
                                ...buttonStyle,
                                flex: 1,
                                justifyContent: 'center',
                                backgroundColor: ((block as MultipleChoiceBlock).content.letterPosition || 'bottom') === pos.value ? '#5C5CFF' : '#334155',
                                color: ((block as MultipleChoiceBlock).content.letterPosition || 'bottom') === pos.value ? 'white' : '#94a3b8',
                              }}
                            >
                              {pos.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {((block as MultipleChoiceBlock).content.options || []).map((option, idx) => (
                  <div key={option.id} style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      backgroundColor: '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: '#808080',
                      flexShrink: 0,
                      marginTop: '4px',
                    }}>
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {((block as MultipleChoiceBlock).content.variant !== 'image' && (block as MultipleChoiceBlock).content.variant !== 'playful-image') && (
                        <input
                          type="text"
                          value={option.text}
                          onChange={(e) => {
                            const mcBlock = block as MultipleChoiceBlock;
                            const newOptions = [...(mcBlock.content.options || [])];
                            newOptions[idx] = { ...option, text: e.target.value };
                            onUpdateBlock(block.id, {
                              content: { ...mcBlock.content, options: newOptions }
                            } as Partial<MultipleChoiceBlock>);
                          }}
                          placeholder={`Možnost ${String.fromCharCode(65 + idx)}`}
                          style={{ ...inputStyle, width: '100%' }}
                        />
                      )}
                      {((block as MultipleChoiceBlock).content.variant === 'mixed' || (block as MultipleChoiceBlock).content.variant === 'image' || (block as MultipleChoiceBlock).content.variant === 'playful-image') && (
                        <div 
                          style={{ 
                            height: ((block as MultipleChoiceBlock).content.variant === 'image' || (block as MultipleChoiceBlock).content.variant === 'playful-image') ? '80px' : '40px', 
                            backgroundColor: '#0f172a', 
                            borderRadius: '4px', 
                            border: '1px dashed #475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            overflow: 'hidden'
                          }}
                          onClick={() => {
                            openAssetPicker({ type: 'mc-option', optionIndex: idx });
                          }}
                        >
                          {option.imageUrl ? (
                            <img src={option.imageUrl} style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <ImageIcon size={14} style={{ color: '#64748b' }} />
                              {((block as MultipleChoiceBlock).content.variant === 'image' || (block as MultipleChoiceBlock).content.variant === 'playful-image') && <span style={{ fontSize: '9px', color: '#475569' }}>Vložit obrázek</span>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        const mcBlock = block as MultipleChoiceBlock;
                        const newCorrect = mcBlock.content.correctAnswers.includes(option.id)
                          ? mcBlock.content.correctAnswers.filter(id => id !== option.id)
                          : [...mcBlock.content.correctAnswers, option.id];
                        onUpdateBlock(block.id, {
                          content: { ...mcBlock.content, correctAnswers: newCorrect }
                        } as Partial<MultipleChoiceBlock>);
                      }}
                      style={{
                        ...buttonStyle,
                        width: '32px',
                        height: '32px',
                        padding: 0,
                        justifyContent: 'center',
                        backgroundColor: (block as MultipleChoiceBlock).content.correctAnswers.includes(option.id) ? '#10B981' : '#334155',
                        color: (block as MultipleChoiceBlock).content.correctAnswers.includes(option.id) ? 'white' : '#94a3b8',
                        flexShrink: 0,
                      }}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => {
                        const mcBlock = block as MultipleChoiceBlock;
                        const newOptions = (mcBlock.content.options || []).filter(o => o.id !== option.id);
                        const newCorrect = mcBlock.content.correctAnswers.filter(id => id !== option.id);
                        onUpdateBlock(block.id, {
                          content: { ...mcBlock.content, options: newOptions, correctAnswers: newCorrect }
                        } as Partial<MultipleChoiceBlock>);
                      }}
                      style={{
                        ...buttonStyle,
                        width: '32px',
                        height: '32px',
                        padding: 0,
                        justifyContent: 'center',
                        color: '#EF4444',
                        backgroundColor: 'transparent',
                        flexShrink: 0,
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                
                <button
                  onClick={() => {
                    const mcBlock = block as MultipleChoiceBlock;
                    const newOptions = [...(mcBlock.content.options || [])];
                    const nextLetter = String.fromCharCode(65 + newOptions.length);
                    newOptions.push({ id: `opt-${Date.now()}`, text: `Možnost ${nextLetter}` });
                    onUpdateBlock(block.id, {
                      content: { ...mcBlock.content, options: newOptions }
                    } as Partial<MultipleChoiceBlock>);
                  }}
                  style={{
                    ...buttonStyle,
                    width: '100%',
                    marginTop: '8px',
                    justifyContent: 'center',
                    backgroundColor: '#3B82F6',
                    color: 'white',
                  }}
                >
                  <Plus size={14} />
                  Přidat možnost
                </button>
              </>
            )}
          </div>
        )}



        {/* TEXT Section - for text blocks */}
        {['heading', 'paragraph', 'infobox', 'fill-blank', 'free-answer', 'multiple-choice', 'free-canvas'].includes(block.type) && (
          <div style={{ paddingBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#CCCCCC' }}>TEXT</span>
              <LayoutGrid size={14} style={{ color: '#808080' }} />
            </div>

            {/* Presets Row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
              {TEXT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => onUpdateBlock(block.id, {
                    content: { ...(block.content as any), ...preset.styles }
                  } as any)}
                  style={{
                    ...buttonStyle,
                    flex: '1 1 auto',
                    justifyContent: 'center',
                    fontSize: '10px',
                    padding: '4px 8px',
                    backgroundColor: '#334155',
                  }}
                >
                  {preset.label}
                </button>
              ))}
              <button
                onClick={() => {
                  const name = prompt('Název stylu:');
                  if (name) {
                    toast.success(`Styl "${name}" byl uložen do konfigurace.`);
                  }
                }}
                style={{
                  ...buttonStyle,
                  backgroundColor: '#334155',
                  padding: '4px',
                }}
                title="Uložit konfiguraci"
              >
                <Plus size={12} />
              </button>
            </div>

            {/* Question/Instruction Textarea */}
            {(block.type === 'multiple-choice' || block.type === 'free-answer' || block.type === 'free-canvas') && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>{block.type === 'free-canvas' ? 'Zadání' : 'Otázka'}</label>
                  {/* Inline formatting buttons */}
                  <div style={{ display: 'flex', gap: 2 }}>
                    {[
                      { label: 'B', title: 'Tučné (Ctrl+B)', style: { fontWeight: 'bold' }, wrap: (s: string) => `**${s}**`, pattern: /^\*\*([\s\S]+)\*\*$/ },
                      { label: 'I', title: 'Kurzíva (Ctrl+I)', style: { fontStyle: 'italic' }, wrap: (s: string) => `*${s}*`, pattern: /^\*([\s\S]+)\*$/ },
                      { label: 'U', title: 'Podtržení', style: { textDecoration: 'underline' }, wrap: (s: string) => `<u>${s}</u>`, pattern: /^<u>([\s\S]+)<\/u>$/ },
                    ].map(({ label, title, style: btnStyle, wrap, pattern }) => (
                      <button
                        key={label}
                        title={title}
                        onMouseDown={(e) => { e.preventDefault(); applyInlineFormat(wrap, pattern, '', null); }}
                        style={{
                          width: 22, height: 22, borderRadius: 4, border: '1px solid #475569',
                          background: '#1e293b', color: '#e2e8f0', cursor: 'pointer',
                          fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          ...btnStyle,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  ref={questionInputRef}
                  value={(block.content as any).question || ''}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    onUpdateBlock(block.id, {
                      content: { ...block.content, question: newValue }
                    });
                  }}
                  placeholder={block.type === 'free-canvas' ? "Zadejte zadání aktivity..." : "Zadejte otázku..."}
                  style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                />
              </div>
            )}

            {/* Canvas height info (resizable via bottom bobánek) */}
            {block.type === 'free-canvas' && (
              <div style={{ marginBottom: '12px', fontSize: 10, color: '#4B5563', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Výška: <strong style={{ color: '#94a3b8' }}>{(block.content as any).canvasHeight || 400}px</strong></span>
                <span style={{ color: '#374151' }}>— táhni spodní bobánek pro změnu</span>
              </div>
            )}

            {/* Pozadí bloku (free-canvas only) */}
            {block.type === 'free-canvas' && (
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Barva pozadí</label>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {[
                    { value: '#ffffff', label: 'Bílá' },
                    { value: '#f8fafc', label: 'Světle šedá' },
                    { value: '#f1f5f9', label: 'Šedá' },
                    { value: '#1e293b', label: 'Tmavá' },
                    { value: '#000000', label: 'Černá' },
                    { value: 'transparent', label: 'Průhledná' },
                  ].map(({ value, label: lbl }) => {
                    const current = (block.content as any).backgroundColor || '#ffffff';
                    const isActive = current === value;
                    return (
                      <button
                        key={value}
                        title={lbl}
                        onClick={() => onUpdateBlock(block.id, { content: { ...block.content, backgroundColor: value } } as any)}
                        style={{
                          width: 22, height: 22, borderRadius: 4, border: isActive ? '2px solid #5C5CFF' : '1px solid #475569',
                          backgroundColor: value === 'transparent' ? undefined : value,
                          backgroundImage: value === 'transparent'
                            ? 'repeating-conic-gradient(#94a3b8 0% 25%, #334155 0% 50%) 0 0 / 8px 8px'
                            : undefined,
                          cursor: 'pointer', flexShrink: 0,
                          boxShadow: isActive ? '0 0 0 2px #5C5CFF44' : undefined,
                        }}
                      />
                    );
                  })}
                  {/* Custom color input */}
                  <label style={{ position: 'relative', cursor: 'pointer' }} title="Vlastní barva">
                    <input
                      type="color"
                      value={(block.content as any).backgroundColor || '#ffffff'}
                      onChange={(e) => onUpdateBlock(block.id, { content: { ...block.content, backgroundColor: e.target.value } } as any)}
                      style={{ opacity: 0, position: 'absolute', width: 0, height: 0 }}
                    />
                    <div style={{
                      width: 22, height: 22, borderRadius: 4, border: '1px solid #475569',
                      background: 'linear-gradient(135deg, #f43f5e, #8b5cf6, #06b6d4)',
                      cursor: 'pointer',
                    }} />
                  </label>
                </div>
              </div>
            )}

            {/* Barva textu + kolečko (free-canvas only, přesunuto sem) */}
            {block.type === 'free-canvas' && (
              <div style={{ marginBottom: 12, borderTop: '1px solid #333', paddingTop: 12 }}>
                <label style={labelStyle}>Barva textu</label>
                <div style={{ marginBottom: 10, position: 'relative' }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', backgroundColor: '#334155', borderRadius: 6, cursor: 'pointer' }}
                    onClick={() => setShowColorPicker(!showColorPicker)}
                  >
                    <div style={{ width: 20, height: 20, backgroundColor: (block.content as any)?.textColor || '#000000', borderRadius: '50%', border: (block.content as any)?.textColor === '#FFFFFF' ? '1px solid #475569' : 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                    <span style={{ fontSize: 12, color: '#E5E5E5', flex: 1 }}>{TEXT_COLORS.find(c => c.value === (block.content as any)?.textColor)?.label || 'Vlastní barva'}</span>
                    <ChevronDownIcon size={14} style={{ color: '#808080', transform: showColorPicker ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                  </div>
                  {showColorPicker && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, padding: 12, backgroundColor: '#1e293b', borderRadius: 8, border: '1px solid #334155', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 1000 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                        {TEXT_COLORS.map((color) => (
                          <div key={color.value} title={color.label} onClick={() => { onUpdateBlock(block.id, { content: { ...(block.content as any), textColor: color.value } } as any); setShowColorPicker(false); }}
                            style={{ width: 28, height: 28, backgroundColor: color.value, borderRadius: '50%', cursor: 'pointer', border: (block.content as any)?.textColor === color.value ? '2px solid #5C5CFF' : color.value === '#FFFFFF' ? '1px solid #475569' : 'none', boxShadow: (block.content as any)?.textColor === color.value ? '0 0 0 2px rgba(92,92,255,0.3)' : '0 1px 3px rgba(0,0,0,0.3)' }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <label style={{ ...labelStyle, marginTop: 4 }}>Kroužek a číslo</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', backgroundColor: '#334155', borderRadius: 6, cursor: 'pointer' }} onClick={() => setShowCircleColorPicker(!showCircleColorPicker)}>
                      <div style={{ width: 16, height: 16, backgroundColor: (block.content as any)?.circleColor || '#1e293b', borderRadius: '50%', border: '1px solid #475569' }} />
                      <span style={{ fontSize: 11, color: '#E5E5E5' }}>Barva</span>
                    </div>
                    {showCircleColorPicker && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, padding: 8, backgroundColor: '#1e293b', borderRadius: 8, border: '1px solid #334155', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, zIndex: 1000 }}>
                        {TEXT_COLORS.map((color) => (
                          <div key={color.value} onClick={() => { onUpdateBlock(block.id, { content: { ...(block.content as any), circleColor: color.value } } as any); setShowCircleColorPicker(false); }}
                            style={{ width: 20, height: 20, backgroundColor: color.value, borderRadius: '50%', cursor: 'pointer', border: (block.content as any)?.circleColor === color.value ? '2px solid #5C5CFF' : 'none' }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: '#808080' }}>Velikost</span>
                    <input type="range" min="16" max="32" value={(block.content as any)?.circleSize || 21}
                      onChange={(e) => onUpdateBlock(block.id, { content: { ...(block.content as any), circleSize: parseInt(e.target.value) } } as any)}
                      style={{ flex: 1, height: 4 }} />
                  </div>
                </div>
              </div>
            )}

            {/* Fullscreen (free-canvas only) */}
            {block.type === 'free-canvas' && (
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Zobrazení</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => onUpdateBlock(block.id, { content: { ...(block.content as any), fullscreen: false }, gridSpan: undefined } as any)}
                    style={{ ...buttonStyle, flex: 1, justifyContent: 'center', backgroundColor: !(block.content as any).fullscreen ? '#5C5CFF' : '#334155', color: !(block.content as any).fullscreen ? 'white' : '#94a3b8' }}
                  >
                    Normální
                  </button>
                  <button
                    onClick={() => {
                      // canvasHeight is computed in GridCanvas from page format constants — we just set the flag
                      onUpdateBlock(block.id, {
                        gridSpan: 12,
                        content: { ...(block.content as any), fullscreen: true },
                      } as any);
                    }}
                    style={{ ...buttonStyle, flex: 1, justifyContent: 'center', backgroundColor: (block.content as any).fullscreen ? '#5C5CFF' : '#334155', color: (block.content as any).fullscreen ? 'white' : '#94a3b8' }}
                  >
                    Celá strana
                  </button>
                </div>
                {(block.content as any).fullscreen && (
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                    Blok vyplní celou A4 stránku. Výšku uprav spodním bobánkem.
                  </div>
                )}
              </div>
            )}

            {/* Figma Integration (free-canvas only) */}
            {block.type === 'free-canvas' && (
              <div style={{ marginBottom: 16, borderTop: '1px solid #333', paddingTop: 14 }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Figma size={14} color="#a78bfa" />
                  <span style={{ fontSize: 11, color: '#a0a0a0', fontWeight: 600, letterSpacing: '0.05em', flex: 1 }}>FIGMA</span>
                  {/* Connection badge */}
                  <span style={{
                    fontSize: 10,
                    padding: '2px 7px',
                    borderRadius: 20,
                    backgroundColor: figmaConnected ? '#052e16' : '#1f2937',
                    color: figmaConnected ? '#4ade80' : '#6B7280',
                    border: `1px solid ${figmaConnected ? '#166534' : '#374151'}`,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {figmaConnected ? <><Link2 size={9} /> Připojeno</> : <><Link2Off size={9} /> Nepřipojeno</>}
                  </span>
                </div>

                {/* Connect button if not connected */}
                {!figmaConnected && (
                  <button
                    onClick={connectFigma}
                    disabled={figmaLoading}
                    style={{
                      width: '100%', padding: '8px', marginBottom: 10,
                      backgroundColor: '#7c3aed', border: 'none', borderRadius: 6,
                      cursor: figmaLoading ? 'wait' : 'pointer', color: 'white',
                      fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <Figma size={13} />
                    {figmaLoading ? 'Načítám...' : 'Připojit Figma účet'}
                  </button>
                )}

                {/* Collapsible link panel */}
                <button
                  onClick={() => setFigmaPanelOpen(v => !v)}
                  style={{
                    width: '100%', padding: '7px 10px', marginBottom: figmaPanelOpen ? 8 : 0,
                    backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 6,
                    cursor: 'pointer', color: '#94a3b8', fontSize: 11,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Link2 size={12} />
                    {(block.content as any).figmaFileId ? 'Propojení nastaveno' : 'Propojit s framem'}
                  </span>
                  {figmaPanelOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {figmaPanelOpen && (
                  <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, padding: 10, marginBottom: 8 }}>
                    <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                      Vlož link z Figmy (Copy link na frame)
                    </label>
                    <input
                      placeholder="https://www.figma.com/design/..."
                      style={{
                        width: '100%', padding: '6px 8px', boxSizing: 'border-box',
                        backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 5,
                        color: '#e2e8f0', fontSize: 11, marginBottom: 6,
                      }}
                      onChange={e => {
                        const val = e.target.value;
                        // Parse figma URL: figma.com/design/FILEID/... or figma.com/file/FILEID/...
                        const fileMatch = val.match(/figma\.com\/(?:design|file)\/([^/?#]+)/);
                        const nodeMatch = val.match(/node-id=([^&]+)/);
                        if (fileMatch) setFigmaFileInput(fileMatch[1]);
                        if (nodeMatch) setFigmaNodeInput(decodeURIComponent(nodeMatch[1]));
                      }}
                    />
                    {/* Parsed preview */}
                    {(figmaFileInput || figmaNodeInput) && (
                      <div style={{ fontSize: 10, color: '#4B5563', marginBottom: 6, padding: '4px 6px', backgroundColor: '#1e293b', borderRadius: 4 }}>
                        {figmaFileInput && <div>File: <span style={{ color: '#94a3b8' }}>{figmaFileInput}</span></div>}
                        {figmaNodeInput && <div>Node: <span style={{ color: '#94a3b8' }}>{figmaNodeInput}</span></div>}
                      </div>
                    )}
                    <button
                      onClick={saveFigmaLink}
                      style={{
                        width: '100%', padding: '7px', backgroundColor: '#3b82f6',
                        border: 'none', borderRadius: 5, cursor: 'pointer', color: 'white',
                        fontSize: 11, fontWeight: 600,
                      }}
                    >
                      Uložit propojení
                    </button>
                  </div>
                )}

                {/* Last sync info + auto-sync toggle */}
                {(block.content as any).figmaFileId && (block.content as any).figmaNodeId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      {(block.content as any).figmaSyncedAt && (
                        <div style={{ fontSize: 10, color: '#4B5563' }}>
                          Sync: {new Date((block.content as any).figmaSyncedAt).toLocaleString('cs-CZ')}
                        </div>
                      )}
                    </div>
                    {/* Auto-sync toggle */}
                    <button
                      onClick={() => setFigmaAutoSync(v => !v)}
                      title={figmaAutoSync ? 'Auto-sync zapnut (každých 30s)' : 'Zapnout auto-sync'}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '4px 8px',
                        backgroundColor: figmaAutoSync ? '#052e16' : '#1e293b',
                        border: `1px solid ${figmaAutoSync ? '#166534' : '#334155'}`,
                        borderRadius: 20,
                        cursor: 'pointer',
                        color: figmaAutoSync ? '#4ade80' : '#64748b',
                        fontSize: 10, fontWeight: 600,
                        transition: 'all 0.2s',
                      }}
                    >
                      <RefreshCw size={10} style={{ animation: figmaAutoSync ? 'spin 2s linear infinite' : 'none' }} />
                      Auto
                    </button>
                  </div>
                )}

                {/* Create frame button - shown when file linked but no node yet */}
                {(block.content as any).figmaFileId && !(block.content as any).figmaNodeId && (
                  <div style={{ marginBottom: 8 }}>
                    <button
                      onClick={createFigmaFrame}
                      style={{
                        width: '100%', padding: '9px', backgroundColor: '#4c1d95',
                        border: '1px solid #7c3aed', borderRadius: 6, cursor: 'pointer',
                        color: '#c4b5fd', fontSize: 11, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      <Figma size={13} />
                      Otevřít Figmu + zkopírovat rozměry
                    </button>
                    <div style={{ fontSize: 10, color: '#6B7280', marginTop: 5, textAlign: 'center', lineHeight: 1.4 }}>
                      Rozměry plátna ({(block.content as any).canvasWidth || 700} × {(block.content as any).canvasHeight || 400} px)
                      se zkopírují do schránky. Ve Figmě vytvoř frame (F), vlož rozměry,
                      pak zkopíruj link a vlož ho sem.
                    </div>
                  </div>
                )}

                {/* Dimensions + copy button - always shown when file is linked */}
                {(block.content as any).figmaFileId && (() => {
                  const w = (block.content as any).canvasWidth || 700;
                  const h = (block.content as any).canvasHeight || 400;
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
                      padding: '6px 10px', backgroundColor: '#0f172a',
                      border: '1px solid #1e293b', borderRadius: 6,
                    }}>
                      <span style={{ fontSize: 11, color: '#64748b', flex: 1 }}>
                        Rozměry plátna: <strong style={{ color: '#94a3b8' }}>{w} × {h} px</strong>
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${w} × ${h}`);
                        }}
                        title="Kopírovat rozměry"
                        style={{
                          padding: '3px 8px', backgroundColor: '#1e293b',
                          border: '1px solid #334155', borderRadius: 4,
                          cursor: 'pointer', color: '#94a3b8', fontSize: 10,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <Copy size={10} />
                        Kopírovat
                      </button>
                    </div>
                  );
                })()}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {(block.content as any).figmaFileId && (block.content as any).figmaNodeId && (
                    <button
                      onClick={openInFigma}
                      style={{
                        flex: 1, padding: '7px 6px', backgroundColor: '#1e293b',
                        border: '1px solid #334155', borderRadius: 6, cursor: 'pointer',
                        color: '#94a3b8', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}
                    >
                      <ExternalLink size={12} />
                      Otevřít
                    </button>
                  )}
                  {(block.content as any).figmaFileId && (block.content as any).figmaNodeId && (
                    <button
                      onClick={syncFigmaSvg}
                      disabled={figmaSyncing}
                      style={{
                        flex: 1, padding: '7px 6px', backgroundColor: figmaSyncing ? '#1e293b' : '#052e16',
                        border: `1px solid ${figmaSyncing ? '#334155' : '#166534'}`, borderRadius: 6,
                        cursor: figmaSyncing ? 'wait' : 'pointer',
                        color: figmaSyncing ? '#6B7280' : '#4ade80', fontSize: 11,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}
                    >
                      <RefreshCw size={12} style={{ animation: figmaSyncing ? 'spin 1s linear infinite' : 'none' }} />
                      {figmaSyncing ? 'Sync...' : 'Sync SVG'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Fill / Text Color Row (skryto pro free-canvas - je výše) */}
            {block.type !== 'free-canvas' && <div style={{ marginBottom: '12px', position: 'relative' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
              {/* Text color */}
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 8px',
                  backgroundColor: '#334155',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  flex: 1,
                }}
                onClick={() => setShowColorPicker(!showColorPicker)}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: (block.content as any)?.textColor || '#000000',
                    borderRadius: '50%',
                    border: (block.content as any)?.textColor === '#FFFFFF' ? '1px solid #475569' : 'none',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
                />
                <span style={{ fontSize: '12px', color: '#E5E5E5', flex: 1 }}>
                  {TEXT_COLORS.find(c => c.value === (block.content as any)?.textColor)?.label || 'Vlastní barva'}
                </span>
                <ChevronDownIcon 
                  size={14} 
                  style={{ 
                    color: '#808080',
                    transform: showColorPicker ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }} 
                />
              </div>
              {/* Circle color – only for free-answer */}
              {block.type === 'free-answer' && (
                <div style={{ position: 'relative' }}>
                  <div
                    title="Barva kroužku"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', backgroundColor: '#334155', borderRadius: '6px', cursor: 'pointer', height: '100%' }}
                    onClick={() => setShowCircleColorPicker(!showCircleColorPicker)}
                  >
                    <div style={{ width: 20, height: 20, backgroundColor: (block.content as any)?.circleColor || '#1e293b', borderRadius: '50%', border: '1px solid #475569', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>Kroužek</span>
                  </div>
                  {showCircleColorPicker && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, padding: 10, backgroundColor: '#1e293b', borderRadius: 8, border: '1px solid #334155', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, zIndex: 1100 }}>
                      {TEXT_COLORS.map((color) => (
                        <div
                          key={color.value}
                          title={color.label}
                          onClick={() => { onUpdateBlock(block.id, { content: { ...(block.content as any), circleColor: color.value } } as any); setShowCircleColorPicker(false); }}
                          style={{ width: 22, height: 22, backgroundColor: color.value, borderRadius: '50%', cursor: 'pointer', border: (block.content as any)?.circleColor === color.value ? '2px solid #5C5CFF' : color.value === '#FFFFFF' ? '1px solid #475569' : 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
                        />
                      ))}
                      {/* Custom color */}
                      <label title="Vlastní barva" style={{ cursor: 'pointer', position: 'relative' }}>
                        <input type="color" value={(block.content as any)?.circleColor || '#1e293b'} onChange={(e) => onUpdateBlock(block.id, { content: { ...(block.content as any), circleColor: e.target.value } } as any)} style={{ opacity: 0, position: 'absolute', width: 0, height: 0 }} />
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg, #f43f5e, #8b5cf6, #06b6d4)', cursor: 'pointer', border: '1px solid #475569' }} />
                      </label>
                    </div>
                  )}
                </div>
              )}
              </div>
              
              {/* Color Picker Dropdown */}
              {showColorPicker && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    padding: '12px',
                    backgroundColor: '#1e293b',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    zIndex: 1000,
                  }}
                >
                  {/* Preset Colors Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: '8px',
                    marginBottom: '12px',
                  }}>
                    {TEXT_COLORS.map((color) => (
                      <div
                        key={color.value}
                        title={color.label}
                        onClick={() => {
                          onUpdateBlock(block.id, {
                            content: { ...(block.content as any), textColor: color.value }
                          } as any);
                          setShowColorPicker(false);
                        }}
                        style={{
                          width: '28px',
                          height: '28px',
                          backgroundColor: color.value,
                          borderRadius: '50%',
                          cursor: 'pointer',
                          border: (block.content as any)?.textColor === color.value 
                            ? '2px solid #5C5CFF' 
                            : color.value === '#FFFFFF' 
                              ? '1px solid #475569' 
                              : 'none',
                          boxShadow: (block.content as any)?.textColor === color.value 
                            ? '0 0 0 2px rgba(92, 92, 255, 0.3)' 
                            : '0 1px 3px rgba(0,0,0,0.3)',
                          transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>}

            {/* Circle/Number Styles for Multiple Choice or Free Canvas */}
            {(block.type === 'multiple-choice') && (
              <div style={{ 
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid #333',
              }}>
                <label style={{ ...labelStyle, marginBottom: '8px', display: 'block' }}>KROUŽEK A ČÍSLO</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {/* Circle Color Picker */}
                  <div style={{ position: 'relative', flex: 1 }}>
                    <div 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        backgroundColor: '#334155',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                      onClick={() => setShowCircleColorPicker(!showCircleColorPicker)}
                    >
                      <div
                        style={{
                          width: '16px',
                          height: '16px',
                          backgroundColor: (block.content as any)?.circleColor || '#1e293b',
                          borderRadius: '50%',
                          border: '1px solid #475569',
                        }}
                      />
                      <span style={{ fontSize: '11px', color: '#E5E5E5' }}>Barva</span>
                    </div>
                    
                    {showCircleColorPicker && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: '4px',
                          padding: '8px',
                          backgroundColor: '#1e293b',
                          borderRadius: '8px',
                          border: '1px solid #334155',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(5, 1fr)',
                          gap: '4px',
                          zIndex: 1000,
                        }}
                      >
                        {TEXT_COLORS.map((color) => (
                          <div
                            key={color.value}
                            onClick={() => {
                              onUpdateBlock(block.id, {
                                content: { ...(block.content as any), circleColor: color.value }
                              } as any);
                              setShowCircleColorPicker(false);
                            }}
                            style={{
                              width: '20px',
                              height: '20px',
                              backgroundColor: color.value,
                              borderRadius: '50%',
                              cursor: 'pointer',
                              border: (block.content as any)?.circleColor === color.value ? '2px solid #5C5CFF' : 'none',
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Circle Size Slider */}
                  <div style={{ flex: 1.5, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: '#808080' }}>Velikost</span>
                    <input
                      type="range"
                      min="16"
                      max="32"
                      value={(block.content as any)?.circleSize || 21}
                      onChange={(e) => onUpdateBlock(block.id, {
                        content: { ...(block.content as any), circleSize: parseInt(e.target.value) }
                      } as any)}
                      style={{ flex: 1, height: '4px' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Collapsible Advanced Settings */}
            <div 
              style={{
                borderTop: '1px solid #333',
                paddingTop: '8px',
                marginTop: '8px',
              }}
            >
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowCustomStyles(!showCustomStyles)}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  justifyContent: 'space-between',
                  backgroundColor: 'transparent',
                  padding: '4px 0',
                }}
              >
                <span style={{ fontSize: '10px', color: '#808080' }}>DALŠÍ NASTAVENÍ</span>
                <ChevronDownIcon size={12} style={{ transform: showCustomStyles ? 'rotate(180deg)' : 'none' }} />
              </button>

              {showCustomStyles && (
                <div style={{ marginTop: '12px' }}>
            {/* Font Family */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ position: 'relative' }}>
                <select
                  value={(block.content as any)?.fontFamily || "'Fenomen Sans', sans-serif"}
                  onChange={(e) => onUpdateBlock(block.id, {
                    content: { ...(block.content as any), fontFamily: e.target.value }
                  } as any)}
                  style={{
                    ...inputStyle,
                    appearance: 'none',
                    paddingRight: '28px',
                    cursor: 'pointer',
                  }}
                >
                  {FONT_FAMILIES.map((font) => (
                    <option key={font.value} value={font.value}>{font.label}</option>
                  ))}
                </select>
                <ChevronDownIcon size={14} style={{ 
                  position: 'absolute', 
                  right: '10px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: '#808080',
                }} />
              </div>
            </div>

            {/* Font Size and Weight Row */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              {/* Font Weight */}
              <div style={{ flex: 1, position: 'relative' }}>
                <select
                  value={(block.content as any)?.fontWeight || 'normal'}
                  onChange={(e) => onUpdateBlock(block.id, {
                    content: { ...(block.content as any), fontWeight: e.target.value }
                  } as any)}
                  style={{
                    ...inputStyle,
                    appearance: 'none',
                    paddingRight: '28px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="normal">Regular</option>
                  <option value="500">Medium</option>
                  <option value="600">Semibold</option>
                  <option value="bold">Bold</option>
                </select>
                <ChevronDownIcon size={14} style={{ 
                  position: 'absolute', 
                  right: '10px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: '#808080',
                }} />
              </div>

              {/* Font Size */}
              <div style={{ width: '70px', position: 'relative' }}>
                <select
                  value={(block.content as any)?.fontSize || 12}
                  onChange={(e) => onUpdateBlock(block.id, {
                    content: { ...(block.content as any), fontSize: parseInt(e.target.value) }
                  } as any)}
                  style={{
                    ...inputStyle,
                    appearance: 'none',
                    paddingRight: '24px',
                    cursor: 'pointer',
                  }}
                >
                  {FONT_SIZES.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <ChevronDownIcon size={14} style={{ 
                  position: 'absolute', 
                  right: '8px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: '#808080',
                }} />
              </div>
            </div>

            {/* Line Height and Letter Spacing */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle, marginBottom: '2px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>A</span>
                    <span style={{ fontSize: '10px' }}>{(block.content as any)?.lineHeight || 1.5}</span>
                  </span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.1"
                  value={(block.content as any)?.lineHeight || 1.5}
                  onChange={(e) => onUpdateBlock(block.id, {
                    content: { ...(block.content as any), lineHeight: parseFloat(e.target.value) }
                  } as any)}
                  style={{
                    width: '100%',
                    height: '4px',
                    appearance: 'none',
                    backgroundColor: '#475569',
                    borderRadius: '2px',
                    cursor: 'pointer',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle, marginBottom: '2px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12px' }}>|A|</span>
                    <span style={{ fontSize: '10px' }}>{(block.content as any)?.letterSpacing || 0}%</span>
                  </span>
                </label>
                <input
                  type="range"
                  min="-5"
                  max="20"
                  step="1"
                  value={(block.content as any)?.letterSpacing || 0}
                  onChange={(e) => onUpdateBlock(block.id, {
                    content: { ...(block.content as any), letterSpacing: parseInt(e.target.value) }
                  } as any)}
                  style={{
                    width: '100%',
                    height: '4px',
                    appearance: 'none',
                    backgroundColor: '#475569',
                    borderRadius: '2px',
                    cursor: 'pointer',
                  }}
                />
              </div>
            </div>

            {/* Text Alignment - Horizontal */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
              <button
                onClick={() => onUpdateBlock(block.id, {
                  content: { ...(block.content as any), align: 'left' }
                } as any)}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  justifyContent: 'center',
                  backgroundColor: ((block.content as any)?.align || 'left') === 'left' ? '#5C5CFF' : '#334155',
                  color: ((block.content as any)?.align || 'left') === 'left' ? 'white' : '#94a3b8',
                }}
              >
                <AlignLeft size={14} />
              </button>
              <button
                onClick={() => onUpdateBlock(block.id, {
                  content: { ...(block.content as any), align: 'center' }
                } as any)}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  justifyContent: 'center',
                  backgroundColor: (block.content as any)?.align === 'center' ? '#5C5CFF' : '#334155',
                  color: (block.content as any)?.align === 'center' ? 'white' : '#94a3b8',
                }}
              >
                <AlignCenter size={14} />
              </button>
              <button
                onClick={() => onUpdateBlock(block.id, {
                  content: { ...(block.content as any), align: 'right' }
                } as any)}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  justifyContent: 'center',
                  backgroundColor: (block.content as any)?.align === 'right' ? '#5C5CFF' : '#334155',
                  color: (block.content as any)?.align === 'right' ? 'white' : '#94a3b8',
                }}
              >
                <AlignRight size={14} />
              </button>

              {/* Separator */}
              <div style={{ width: '1px', backgroundColor: '#475569', margin: '0 4px' }} />

              {/* Text Alignment - Vertical */}
              <button
                onClick={() => onUpdateBlock(block.id, {
                  content: { ...(block.content as any), verticalAlign: 'top' }
                } as any)}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  justifyContent: 'center',
                  backgroundColor: ((block.content as any)?.verticalAlign || 'top') === 'top' ? '#5C5CFF' : '#334155',
                  color: ((block.content as any)?.verticalAlign || 'top') === 'top' ? 'white' : '#94a3b8',
                }}
                title="Zarovnat nahoru"
              >
                <ArrowUpToLine size={14} />
              </button>
              <button
                onClick={() => onUpdateBlock(block.id, {
                  content: { ...(block.content as any), verticalAlign: 'center' }
                } as any)}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  justifyContent: 'center',
                  backgroundColor: (block.content as any)?.verticalAlign === 'center' ? '#5C5CFF' : '#334155',
                  color: (block.content as any)?.verticalAlign === 'center' ? 'white' : '#94a3b8',
                }}
                title="Zarovnat na střed"
              >
                <AlignVerticalJustifyCenter size={14} />
              </button>
              <button
                onClick={() => onUpdateBlock(block.id, {
                  content: { ...(block.content as any), verticalAlign: 'bottom' }
                } as any)}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  justifyContent: 'center',
                  backgroundColor: (block.content as any)?.verticalAlign === 'bottom' ? '#5C5CFF' : '#334155',
                  color: (block.content as any)?.verticalAlign === 'bottom' ? 'white' : '#94a3b8',
                }}
                title="Zarovnat dolů"
              >
                <ArrowDownToLine size={14} />
              </button>
            </div>

            {/* Text Style Toggles */}
                  <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onMouseDown={(e) => { e.preventDefault(); applyInlineFormat(s => `**${s}**`, /^\*\*([\s\S]+)\*\*$/, 'isBold', !(block.content as any)?.isBold); }}
                style={{
                  ...buttonStyle, flex: 1, justifyContent: 'center',
                  backgroundColor: (block.content as any)?.isBold ? '#5C5CFF' : '#334155',
                  color: (block.content as any)?.isBold ? 'white' : '#94a3b8',
                }}
              >
                <Bold size={14} />
              </button>
              <button
                onMouseDown={(e) => { e.preventDefault(); applyInlineFormat(s => `*${s}*`, /^\*([\s\S]+)\*$/, 'isItalic', !(block.content as any)?.isItalic); }}
                style={{
                  ...buttonStyle, flex: 1, justifyContent: 'center',
                  backgroundColor: (block.content as any)?.isItalic ? '#5C5CFF' : '#334155',
                  color: (block.content as any)?.isItalic ? 'white' : '#94a3b8',
                }}
              >
                <Italic size={14} />
              </button>
              <button
                onMouseDown={(e) => { e.preventDefault(); applyInlineFormat(s => `<u>${s}</u>`, /^<u>([\s\S]+)<\/u>$/, 'isUnderline', !(block.content as any)?.isUnderline); }}
                style={{
                  ...buttonStyle, flex: 1, justifyContent: 'center',
                  backgroundColor: (block.content as any)?.isUnderline ? '#5C5CFF' : '#334155',
                  color: (block.content as any)?.isUnderline ? 'white' : '#94a3b8',
                }}
              >
                <Underline size={14} />
              </button>
            </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Visual Styles Section */}
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#CCCCCC' }}>VZHLED BLOKU</span>
            <button
                        onClick={() => {
                const name = prompt('Název vzhledu bloku:');
                if (name) {
                  toast.success(`Vzhled "${name}" byl uložen do knihovny.`);
                }
                        }}
                        style={{
                ...buttonStyle,
                backgroundColor: 'transparent',
                padding: '2px',
                color: '#808080',
              }}
              title="Uložit vzhled bloku"
            >
              <Plus size={14} />
            </button>
                  </div>
                  
          {/* Margin Style (Space below block) - MOVED UP */}
          {(block.marginBottom || 0) > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { value: 'empty', label: 'Prázdný', icon: null },
                  { value: 'dotted', label: 'Tečky', icon: 'dots' },
                  { value: 'lined', label: 'Linky', icon: 'lines' },
                ].map((styleOption) => (
                  <button
                    key={styleOption.value}
                    onClick={() => {
                        onUpdateBlock(block.id, {
                        marginStyle: styleOption.value as any,
                      });
                    }}
                    style={{
                      ...buttonStyle,
                      flex: 1,
                      flexDirection: 'column',
                      height: '42px',
                      justifyContent: 'center',
                      backgroundColor: (block.marginStyle || 'empty') === styleOption.value ? '#3B82F6' : '#1e293b',
                      border: (block.marginStyle || 'empty') === styleOption.value ? '1px solid #60A5FA' : '1px solid #334155',
                      color: (block.marginStyle || 'empty') === styleOption.value ? 'white' : '#94a3b8',
                      padding: '4px',
                      gap: '0',
                    }}
                    title={styleOption.label}
                  >
                    {/* Texture Preview */}
                    <div style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '4px',
                      backgroundColor: (block.marginStyle || 'empty') === styleOption.value ? 'rgba(255,255,255,0.2)' : '#0f172a',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: '3px',
                      padding: '6px',
                      overflow: 'hidden',
                    }}>
                      {styleOption.icon === 'dots' && (
                        <div style={{ 
                          height: '100%', 
                          backgroundImage: `radial-gradient(${(block.marginStyle || 'empty') === styleOption.value ? '#FFFFFF' : '#CCCCCC'} 1.5px, transparent 1.5px)`, 
                          backgroundSize: '6px 6px' 
                        }} />
                      )}
                      {styleOption.icon === 'lines' && (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
                          <div style={{ height: '1.5px', backgroundColor: (block.marginStyle || 'empty') === styleOption.value ? '#FFFFFF' : '#CCCCCC', width: '100%' }} />
                          <div style={{ height: '1.5px', backgroundColor: (block.marginStyle || 'empty') === styleOption.value ? '#FFFFFF' : '#CCCCCC', width: '100%' }} />
                          <div style={{ height: '1.5px', backgroundColor: (block.marginStyle || 'empty') === styleOption.value ? '#FFFFFF' : '#CCCCCC', width: '100%' }} />
                  </div>
                      )}
                      {styleOption.icon === null && (
                        <div style={{ height: '100%', border: '1px dashed #475569', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <X size={14} style={{ color: '#64748b', opacity: 0.5 }} />
                </div>
              )}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}

          {/* Style Presets Grid - Minimalist Squares (hidden for infobox – has its own preset grid above) */}
        {block.type !== 'infobox' && <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(6, 1fr)', 
            gap: '6px',
            marginBottom: '16px' 
          }}>
              {STYLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    onUpdateBlock(block.id, { visualStyles: { ...block.visualStyles, ...preset.styles } });
                    setShowCustomStyles(false);
                  }}
                title={preset.label}
                  style={{
                    ...buttonStyle,
                    width: '100%',
                    aspectRatio: '1/1',
                    padding: '4px',
                    backgroundColor: '#1e293b',
                    border: currentPreset === preset.id ? '2px solid #5C5CFF' : '1px solid #334155',
                    borderRadius: '6px',
                    justifyContent: 'center',
                    position: 'relative',
                }}
              >
                <div style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: preset.styles.backgroundColor || '#334155',
                  border: preset.styles.borderColor ? `${preset.styles.borderWidth ? Math.min(2, preset.styles.borderWidth) : 1}px ${preset.styles.borderStyle || 'solid'} ${preset.styles.borderColor}` : 'none',
                  borderRadius: '3px',
                  boxShadow: preset.styles.shadow === 'medium' ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
                }} />
                </button>
              ))}
            
            {/* Custom Style Button */}
              <button
              onClick={() => setShowVisualAdvanced(!showVisualAdvanced)}
              title="Vlastní nastavení"
                style={{
                  ...buttonStyle,
                width: '100%',
                aspectRatio: '1/1',
                padding: '4px',
                backgroundColor: '#1e293b',
                border: (currentPreset === 'custom' || showVisualAdvanced) ? '2px solid #5C5CFF' : '1px solid #334155',
                borderRadius: '6px',
                  justifyContent: 'center',
              }}
            >
              <div style={{
                width: '100%',
                height: '100%',
                border: '1px dashed #475569',
                borderRadius: '3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Palette size={12} style={{ color: '#808080' }} />
              </div>
              </button>
          </div>}

          {/* Collapsible Advanced Visual Settings */}
          <div 
            style={{
              borderTop: '1px solid #333',
              paddingTop: '8px',
              marginTop: '8px',
            }}
          >
            <button
              onClick={() => setShowVisualAdvanced(!showVisualAdvanced)}
              style={{
                ...buttonStyle,
                width: '100%',
                justifyContent: 'space-between',
                backgroundColor: 'transparent',
                padding: '4px 0',
              }}
            >
              <span style={{ fontSize: '10px', color: '#808080' }}>DALŠÍ NASTAVENÍ</span>
              <ChevronDownIcon size={12} style={{ transform: (showVisualAdvanced || currentPreset === 'custom') ? 'rotate(180deg)' : 'none' }} />
            </button>

            {(showVisualAdvanced || currentPreset === 'custom') && (
              <div style={{ marginTop: '12px' }}>
              {/* ROW 1: Background & Border Colors */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  {/* Background Color */}
                  <div style={{ flex: 1, position: 'relative' }}>
                    <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Pozadí</span>
                    <div 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 8px',
                        backgroundColor: '#334155',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                      onClick={() => setShowBgColorPicker(!showBgColorPicker)}
                    >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      backgroundColor: block.visualStyles?.backgroundColor || 'transparent',
                      borderRadius: '50%',
                      border: '1px solid #475569',
                      flexShrink: 0,
                    }}
                  />
                  {block.visualStyles?.backgroundColor && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateBlock(block.id, {
                          visualStyles: { ...block.visualStyles, backgroundColor: undefined }
                        });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#808080',
                        cursor: 'pointer',
                        padding: '0',
                        marginLeft: 'auto',
                      }}
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
                {/* Background Color Picker Dropdown */}
                {showBgColorPicker && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '4px',
                      padding: '12px',
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      zIndex: 1000,
                      width: '200px',
                    }}
                  >
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(6, 1fr)',
                      gap: '6px',
                      marginBottom: '10px',
                    }}>
                      {TEXT_COLORS.map((color) => (
                        <div
                          key={color.value}
                          title={color.label}
                          onClick={() => {
                            onUpdateBlock(block.id, {
                              visualStyles: { ...block.visualStyles, backgroundColor: color.value }
                            });
                            setShowBgColorPicker(false);
                          }}
                          style={{
                            width: '24px',
                            height: '24px',
                            backgroundColor: color.value,
                            borderRadius: '50%',
                            cursor: 'pointer',
                            border: block.visualStyles?.backgroundColor === color.value 
                              ? '2px solid #5C5CFF' 
                              : color.value === '#FFFFFF' ? '1px solid #475569' : 'none',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                          }}
                        />
                      ))}
                    </div>
                    <div
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'color';
                        input.value = block.visualStyles?.backgroundColor || '#ffffff';
                        input.onchange = (e) => {
                          onUpdateBlock(block.id, {
                            visualStyles: { ...block.visualStyles, backgroundColor: (e.target as HTMLInputElement).value }
                          });
                          setShowBgColorPicker(false);
                        };
                        input.click();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        padding: '6px',
                        backgroundColor: '#334155',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        color: '#E5E5E5',
                      }}
                    >
                      <Palette size={12} />
                      Vlastní
                    </div>
                  </div>
                )}
              </div>

              {/* Border Color */}
              <div style={{ flex: 1, position: 'relative' }}>
                <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Ohraničení</span>
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 8px',
                    backgroundColor: '#334155',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowBorderColorPicker(!showBorderColorPicker)}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      backgroundColor: 'transparent',
                      borderRadius: '50%',
                      border: `3px ${block.visualStyles?.borderStyle || 'solid'} ${block.visualStyles?.borderColor || '#475569'}`,
                      flexShrink: 0,
                    }}
                  />
                  {block.visualStyles?.borderColor && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateBlock(block.id, {
                          visualStyles: { ...block.visualStyles, borderColor: undefined, borderWidth: undefined, borderStyle: undefined }
                        });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#808080',
                        cursor: 'pointer',
                        padding: '0',
                        marginLeft: 'auto',
                      }}
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
                {/* Border Color Picker Dropdown */}
                {showBorderColorPicker && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '4px',
                      padding: '12px',
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      zIndex: 1000,
                      width: '200px',
                    }}
                  >
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(6, 1fr)',
                      gap: '6px',
                      marginBottom: '10px',
                    }}>
                      {TEXT_COLORS.map((color) => (
                        <div
                          key={color.value}
                          title={color.label}
                          onClick={() => {
                            onUpdateBlock(block.id, {
                              visualStyles: { 
                                ...block.visualStyles, 
                                borderColor: color.value,
                                borderWidth: block.visualStyles?.borderWidth || 2,
                                borderStyle: block.visualStyles?.borderStyle || 'solid',
                              }
                            });
                            setShowBorderColorPicker(false);
                          }}
                          style={{
                            width: '24px',
                            height: '24px',
                            backgroundColor: color.value,
                            borderRadius: '50%',
                            cursor: 'pointer',
                            border: block.visualStyles?.borderColor === color.value 
                              ? '2px solid #5C5CFF' 
                              : color.value === '#FFFFFF' ? '1px solid #475569' : 'none',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                          }}
                        />
                      ))}
                    </div>
                    <div
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'color';
                        input.value = block.visualStyles?.borderColor || '#000000';
                        input.onchange = (e) => {
                          onUpdateBlock(block.id, {
                            visualStyles: { 
                              ...block.visualStyles, 
                              borderColor: (e.target as HTMLInputElement).value,
                              borderWidth: block.visualStyles?.borderWidth || 2,
                              borderStyle: block.visualStyles?.borderStyle || 'solid',
                            }
                          });
                          setShowBorderColorPicker(false);
                        };
                        input.click();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        padding: '6px',
                        backgroundColor: '#334155',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        color: '#E5E5E5',
                      }}
                    >
                      <Palette size={12} />
                      Vlastní
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ROW 2: Border Width, Style, and Border Radius - only show if border color is set */}
          {block.visualStyles?.borderColor && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                {/* Border Width Dropdown */}
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Tloušťka</span>
                  <select
                    value={block.visualStyles?.borderWidth || 2}
                    onChange={(e) => onUpdateBlock(block.id, {
                      visualStyles: { ...block.visualStyles, borderWidth: parseInt(e.target.value) }
                    })}
                    style={{
                      width: '100%',
                      padding: '8px 6px',
                      backgroundColor: '#334155',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#E5E5E5',
                      fontSize: '11px',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6, 8].map((w) => (
                      <option key={w} value={w}>{w}px</option>
                    ))}
                  </select>
                </div>

                {/* Border Style */}
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Styl</span>
                  <select
                    value={block.visualStyles?.borderStyle || 'solid'}
                    onChange={(e) => onUpdateBlock(block.id, {
                      visualStyles: { ...block.visualStyles, borderStyle: e.target.value as 'solid' | 'dashed' | 'dotted' }
                    })}
                    style={{
                      width: '100%',
                      padding: '8px 6px',
                      backgroundColor: '#334155',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#E5E5E5',
                      fontSize: '11px',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="solid">Plná</option>
                    <option value="dashed">Přerušovaná</option>
                    <option value="dotted">Tečkovaná</option>
                  </select>
                </div>

                {/* Border Radius */}
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Zaoblení</span>
                  <select
                    value={block.visualStyles?.borderRadius || 0}
                    onChange={(e) => onUpdateBlock(block.id, {
                      visualStyles: { ...block.visualStyles, borderRadius: parseInt(e.target.value) }
                    })}
                    style={{
                      width: '100%',
                      padding: '8px 6px',
                      backgroundColor: '#334155',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#E5E5E5',
                      fontSize: '11px',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    {[0, 4, 8, 12, 16, 24, 32].map((r) => (
                      <option key={r} value={r}>{r}px</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

              {/* Shadow */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#CCCCCC' }}>Stín</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['none', 'small', 'medium', 'large'] as const).map((shadowType) => (
                    <button
                      key={shadowType}
                      onClick={() => onUpdateBlock(block.id, {
                        visualStyles: { ...block.visualStyles, shadow: shadowType }
                      })}
                      style={{
                        ...buttonStyle,
                        flex: 1,
                        justifyContent: 'center',
                        backgroundColor: (block.visualStyles?.shadow || 'none') === shadowType ? '#5C5CFF' : '#334155',
                        color: (block.visualStyles?.shadow || 'none') === shadowType ? 'white' : '#94a3b8',
                        padding: '6px 4px',
                        fontSize: '10px',
                      }}
                    >
                      {shadowType === 'none' ? 'Žádný' : 
                       shadowType === 'small' ? 'S' : 
                       shadowType === 'medium' ? 'M' : 'L'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Padding with Visual Preview */}
              <div style={{ marginTop: '16px' }}>
                <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '8px' }}>Odsazení obsahu</span>
                
                {/* Visual Padding Preview */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  {/* Graphical box showing padding */}
                  <div style={{
                    width: '70px',
                    height: '50px',
                    backgroundColor: '#475569',
                    borderRadius: '6px',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}>
                    {/* Padding visualization - outer colored area */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: '#5C5CFF',
                      opacity: 0.3,
                      transition: 'all 0.15s ease',
                    }} />
                    {/* Content area - the white inner box */}
                    <div style={{
                      backgroundColor: '#1e293b',
                      borderRadius: '3px',
                      transition: 'all 0.15s ease',
                      width: `${Math.max(20, 100 - (block.padding || 0) * 1.5)}%`,
                      height: `${Math.max(20, 100 - (block.padding || 0) * 2)}%`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <div style={{
                        width: '60%',
                        height: '3px',
                        backgroundColor: '#808080',
                        borderRadius: '2px',
                      }} />
                    </div>
                    {/* Padding value labels */}
                    {(block.padding || 0) > 0 && (
                      <>
                        <span style={{
                          position: 'absolute',
                          top: '1px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          fontSize: '7px',
                          color: '#A0A0FF',
                          fontWeight: 600,
                        }}>
                          {block.padding || 0}
                        </span>
                        <span style={{
                          position: 'absolute',
                          left: '1px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '7px',
                          color: '#A0A0FF',
                          fontWeight: 600,
                        }}>
                          {block.padding || 0}
                        </span>
                        <span style={{
                          position: 'absolute',
                          right: '1px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '7px',
                          color: '#A0A0FF',
                          fontWeight: 600,
                        }}>
                          {block.padding || 0}
                        </span>
                        <span style={{
                          position: 'absolute',
                          bottom: '1px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          fontSize: '7px',
                          color: '#A0A0FF',
                          fontWeight: 600,
                        }}>
                          {block.padding || 0}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Slider and value */}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '4px',
                    }}>
                      <span style={{ fontSize: '9px', color: '#94a3b8' }}>Okraje</span>
                      <span style={{ fontSize: '10px', color: '#EEEEEE', fontWeight: 600 }}>
                        {block.padding || 0}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="48"
                      step="4"
                      value={block.padding || 0}
                      onChange={(e) => onUpdateBlock(block.id, { padding: parseInt(e.target.value) })}
                      style={{
                        width: '100%',
                        height: '4px',
                        appearance: 'none',
                        backgroundColor: '#475569',
                        borderRadius: '2px',
                        cursor: 'pointer',
                      }}
                    />
                    {/* Quick preset buttons */}
                    <div style={{ display: 'flex', gap: '3px', marginTop: '6px' }}>
                      {[0, 8, 16, 24, 32, 48].map((val) => (
                        <button
                          key={val}
                          onClick={() => onUpdateBlock(block.id, { padding: val })}
                          style={{
                            ...buttonStyle,
                            flex: 1,
                            padding: '3px 1px',
                            fontSize: '8px',
                            backgroundColor: (block.padding || 0) === val ? '#5C5CFF' : '#334155',
                            color: (block.padding || 0) === val ? 'white' : '#94a3b8',
                            justifyContent: 'center',
                          }}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
              </div>

          {/* Bottom Margin Slider - always visible */}
          <div style={{ borderTop: '1px solid #334155', marginTop: '4px', paddingTop: '16px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}>
              <span style={labelStyle}>Výška prostoru pod blokem</span>
                    <span style={{ fontSize: '10px', color: '#CCCCCC' }}>{block.marginBottom || 0}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="200"
              step="10"
              value={block.marginBottom || 0}
              onChange={(e) => onUpdateBlock(block.id, {
                marginBottom: parseInt(e.target.value)
              })}
              style={{
                width: '100%',
                height: '4px',
                appearance: 'none',
                backgroundColor: '#475569',
                borderRadius: '2px',
                cursor: 'pointer',
              }}
            />
              </div>

        {/* FREE ANSWER - block.image editor */}
        {block.type === 'free-answer' && (() => {
          const hasImg = !!(block as any).image;
          return (
            <div style={{ borderTop: '1px solid #334155', marginTop: 16, paddingTop: 16, paddingBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#CCCCCC', letterSpacing: '0.8px' }}>OBRÁZEK VEDLE</span>
                <ImageIcon size={14} style={{ color: '#808080' }} />
              </div>
              {hasImg ? (
                <BlockImageEditor block={block} onUpdateBlock={onUpdateBlock} openAssetPicker={openAssetPicker} />
              ) : (
                <button
                  onClick={() => onUpdateBlock(block.id, { image: { url: '', position: 'beside-right', size: 'medium', widthPercent: 35 } } as any)}
                  style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px dashed #334155', background: 'none', color: '#64748b', fontSize: 11, cursor: 'pointer' }}
                >
                  + Přidat obrázek vedle
                </button>
              )}
            </div>
          );
        })()}

        {/* FREE ANSWER - Sub-questions settings */}
        {block.type === 'free-answer' && (() => {
          const faBlock = block as FreeAnswerBlock;
          const hasSubQ = faBlock.content.subQuestions && faBlock.content.subQuestions.length > 0;
          
          return (
          <div style={{ 
              borderTop: '1px solid #334155',
            marginTop: '16px',
              paddingTop: '16px',
              paddingBottom: '16px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#CCCCCC', letterSpacing: '0.8px' }}>POD-OTÁZKY</span>
                <LayoutGrid size={14} style={{ color: '#808080' }} />
            </div>

              {/* Toggle sub-questions */}
            <div style={{ marginBottom: '12px' }}>
                <button
                  onClick={() => {
                    if (hasSubQ) {
                      onUpdateBlock(block.id, {
                        content: { ...faBlock.content, subQuestions: undefined, subColumns: undefined, subLabelType: undefined, subQuestionColors: undefined, subOutlineEnabled: undefined, subOutlineColors: undefined }
                      } as any);
                    } else {
                      onUpdateBlock(block.id, {
                        content: {
                          ...faBlock.content,
                          subQuestions: [
                            { id: generateBlockId(), text: '', lines: 2 },
                            { id: generateBlockId(), text: '', lines: 2 },
                          ],
                          subColumns: 1,
                          subLabelType: 'numbers' as SubQuestionLabelType,
                          subLabelStyle: 'circle-outline',
                          subLabelColors: ['#3b82f6'],
                          subShowBackground: false,
                          subShowLines: true,
                          subAnswerStyle: 'dotted',
                        }
                      } as any);
                    }
                  }}
                  style={{
                    ...buttonStyle,
                    width: '100%',
                    justifyContent: 'center',
                    backgroundColor: hasSubQ ? '#22c55e' : '#334155',
                    color: hasSubQ ? 'white' : '#e5e7eb',
                    fontWeight: hasSubQ ? 600 : 400,
                  }}
                >
                  {hasSubQ ? '✓ Pod-otázky zapnuty' : 'Zapnout pod-otázky'}
                </button>
              </div>

              {hasSubQ && (
                <>
                  {/* ── Sloupce + Odsazení ── */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ ...labelStyle, marginBottom: '6px', fontSize: '10px', letterSpacing: '0.8px', color: '#CCCCCC' }}>SLOUPCE</label>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {[1, 2, 3].map((col) => (
                        <button
                          key={col}
                          onClick={() => onUpdateBlock(block.id, { content: { ...faBlock.content, subColumns: col } } as any)}
                          style={{
                            ...buttonStyle, flex: 1, justifyContent: 'center', padding: '6px',
                            fontSize: '13px',
                            backgroundColor: (faBlock.content.subColumns || 1) === col ? '#3b82f6' : '#334155',
                            color: (faBlock.content.subColumns || 1) === col ? 'white' : '#e5e7eb',
                          }}
                        >{col}</button>
                      ))}
                      <button
                        onClick={() => onUpdateBlock(block.id, { content: { ...faBlock.content, subIndent: faBlock.content.subIndent === false ? true : false } } as any)}
                        title="Odsazení"
                        style={{
                          ...buttonStyle, padding: '6px 12px',
                          backgroundColor: faBlock.content.subIndent !== false ? '#3b82f6' : '#334155',
                          color: faBlock.content.subIndent !== false ? 'white' : '#94a3b8',
                        }}
                      ><Indent size={15} /></button>
                    </div>
                  </div>

                  {/* ── Označení ── */}
                  <div style={{ marginBottom: '14px', borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
                    <label style={{ ...labelStyle, marginBottom: '6px', fontSize: '10px', letterSpacing: '0.8px', color: '#CCCCCC' }}>OZNAČENÍ</label>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {[
                        { value: 'letters', label: 'A)' },
                        { value: 'numbers', label: '1)' },
                        { value: 'roman', label: 'I.' },
                        { value: 'none', label: '—' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => onUpdateBlock(block.id, { content: { ...faBlock.content, subLabelType: opt.value } } as any)}
                          style={{
                            ...buttonStyle, flex: 1, justifyContent: 'center', fontSize: '12px', padding: '6px 4px',
                            backgroundColor: (faBlock.content.subLabelType || 'letters') === opt.value ? '#3b82f6' : '#334155',
                            color: (faBlock.content.subLabelType || 'letters') === opt.value ? 'white' : '#e5e7eb',
                          }}
                        >{opt.label}</button>
                      ))}
                      <div style={{ width: '1px', background: '#475569', alignSelf: 'stretch', flexShrink: 0 }} />
                      {[
                        { value: 'text', label: 'Aa' },
                        { value: 'circle', label: '●' },
                        { value: 'circle-outline', label: '○' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => onUpdateBlock(block.id, { content: { ...faBlock.content, subLabelStyle: opt.value } } as any)}
                          style={{
                            ...buttonStyle, width: '34px', justifyContent: 'center', fontSize: '13px', padding: '6px',
                            backgroundColor: (faBlock.content.subLabelStyle || 'text') === opt.value ? '#3b82f6' : '#334155',
                            color: (faBlock.content.subLabelStyle || 'text') === opt.value ? 'white' : '#e5e7eb',
                            flexShrink: 0,
                          }}
                        >{opt.label}</button>
                      ))}
                      {/* Color dot – only when circle */}
                      {(faBlock.content.subLabelStyle === 'circle' || faBlock.content.subLabelStyle === 'circle-outline') && (() => {
                        const labelPresets = [
                          { colors: ['#e11d48','#2563eb','#16a34a','#ea580c','#9333ea','#475569'], c: '' },
                          { colors: ['#e11d48'], c: '#e11d48' }, { colors: ['#2563eb'], c: '#2563eb' },
                          { colors: ['#16a34a'], c: '#16a34a' }, { colors: ['#ea580c'], c: '#ea580c' },
                          { colors: ['#9333ea'], c: '#9333ea' }, { colors: ['#475569'], c: '#475569' },
                          { colors: ['#ffffff'], c: '#ffffff' },
                        ];
                        const cur = faBlock.content.subLabelColors || ['#e11d48'];
                        const preview = cur.length === 1 ? cur[0] : null;
                        const isOpen = openColorPicker === 'label';
                        return (
                          <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                            <button onClick={() => setOpenColorPicker(isOpen ? null : 'label')} style={{
                              width: '22px', height: '22px', borderRadius: '50%', cursor: 'pointer', padding: 0,
                              border: isOpen ? '2px solid #3b82f6' : '2px solid #64748b',
                              backgroundColor: preview || undefined, display: 'flex', overflow: 'hidden', position: 'relative', flexShrink: 0,
                            }}>
                              {!preview && cur.slice(0, 6).map((c, ci) => <div key={ci} style={{ flex: 1, height: '100%', backgroundColor: c }} />)}
                            </button>
                            {isOpen && labelPresets.map((preset, pi) => {
                              const active = JSON.stringify(cur) === JSON.stringify(preset.colors);
                              const isWhite = preset.c === '#ffffff';
                              return (
                                <button key={pi} onClick={() => { onUpdateBlock(block.id, { content: { ...faBlock.content, subLabelColors: preset.colors } } as any); setOpenColorPicker(null); }}
                                  style={{ width: '18px', height: '18px', borderRadius: '50%', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', overflow: 'hidden',
                                    border: active ? '2px solid #3b82f6' : isWhite ? '1px solid #94a3b8' : '1px solid #475569', backgroundColor: preset.c || undefined }}>
                                  {!preset.c && preset.colors.slice(0, 6).map((c, ci) => <div key={ci} style={{ flex: 1, height: '100%', backgroundColor: c }} />)}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* ── Vizuální styl ── */}
                  <div style={{ marginBottom: '14px', borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
                    <label style={{ ...labelStyle, marginBottom: '6px', fontSize: '10px', letterSpacing: '0.8px', color: '#CCCCCC' }}>VIZUÁLNÍ STYL</label>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {/* Výplň */}
                      {(() => {
                        const isFillActive = faBlock.content.subShowBackground !== false && (faBlock.content.subBackgroundMode || 'fill') === 'fill';
                        const fillPresets = [
                          { colors: ['#dbeafe','#dcfce7','#fef3c7','#f3e8ff','#fce7f3','#ffedd5'], c: '' },
                          { colors: ['#dbeafe'], c: '#dbeafe' }, { colors: ['#dcfce7'], c: '#dcfce7' },
                          { colors: ['#fef3c7'], c: '#fef3c7' }, { colors: ['#f3e8ff'], c: '#f3e8ff' },
                          { colors: ['#fce7f3'], c: '#fce7f3' }, { colors: ['#ffedd5'], c: '#ffedd5' },
                          { colors: ['#f1f5f9'], c: '#f1f5f9' }, { colors: ['#ffffff'], c: '#ffffff' },
                        ];
                        const cur = faBlock.content.subQuestionColors || ['#dbeafe'];
                        const preview = isFillActive ? (cur.length === 1 ? cur[0] : null) : undefined;
                        const isOpen = openColorPicker === 'fill';
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                            <span style={{ fontSize: '10px', color: '#94a3b8', flexShrink: 0 }}>Výplň</span>
                            <button onClick={() => setOpenColorPicker(isOpen ? null : 'fill')} style={{
                              width: '22px', height: '22px', borderRadius: '50%', cursor: 'pointer', padding: 0,
                              border: isOpen ? '2px solid #3b82f6' : '1px solid #64748b',
                              backgroundColor: preview || undefined, display: 'flex', overflow: 'hidden', position: 'relative', flexShrink: 0,
                            }}>
                              {!preview && isFillActive && cur.slice(0, 6).map((c, ci) => <div key={ci} style={{ flex: 1, height: '100%', backgroundColor: c }} />)}
                              {!isFillActive && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#334155' }}><div style={{ width: '120%', height: '2px', backgroundColor: '#ef4444', transform: 'rotate(-45deg)' }} /></div>}
                            </button>
                            {isOpen && fillPresets.map((preset, pi) => {
                              const active = isFillActive && JSON.stringify(cur) === JSON.stringify(preset.colors);
                              const isWhite = preset.c === '#ffffff';
                              return (
                                <button key={pi} onClick={() => { if (active) { onUpdateBlock(block.id, { content: { ...faBlock.content, subShowBackground: false } } as any); } else { onUpdateBlock(block.id, { content: { ...faBlock.content, subShowBackground: true, subBackgroundMode: 'fill', subQuestionColors: preset.colors } } as any); } setOpenColorPicker(null); }}
                                  style={{ width: '18px', height: '18px', borderRadius: '50%', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', overflow: 'hidden', position: 'relative',
                                    border: active ? '2px solid #3b82f6' : isWhite ? '1px solid #94a3b8' : '1px solid #475569', backgroundColor: preset.c || undefined }}>
                                  {!preset.c && preset.colors.slice(0, 6).map((c, ci) => <div key={ci} style={{ flex: 1, height: '100%', backgroundColor: c }} />)}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                      {/* Obrys */}
                      {(() => {
                        const isOutlineActive = faBlock.content.subOutlineEnabled === true;
                        const outlinePresets = [
                          { colors: ['#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899','#f97316'], c: '' },
                          { colors: ['#3b82f6'], c: '#3b82f6' }, { colors: ['#22c55e'], c: '#22c55e' },
                          { colors: ['#f59e0b'], c: '#f59e0b' }, { colors: ['#a855f7'], c: '#a855f7' },
                          { colors: ['#ec4899'], c: '#ec4899' }, { colors: ['#f97316'], c: '#f97316' },
                          { colors: ['#64748b'], c: '#64748b' }, { colors: ['#ffffff'], c: '#ffffff' },
                        ];
                        const cur = faBlock.content.subOutlineColors || ['#3b82f6'];
                        const preview = isOutlineActive ? (cur.length === 1 ? cur[0] : null) : undefined;
                        const isOpen = openColorPicker === 'outline';
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                            <span style={{ fontSize: '10px', color: '#94a3b8', flexShrink: 0 }}>Obrys</span>
                            <button onClick={() => setOpenColorPicker(isOpen ? null : 'outline')} style={{
                              width: '22px', height: '22px', borderRadius: '50%', cursor: 'pointer', padding: 0,
                              border: isOpen ? '2px solid #3b82f6' : preview ? `2px solid ${preview}` : '1px solid #64748b',
                              backgroundColor: 'transparent', display: 'flex', overflow: 'hidden', position: 'relative', flexShrink: 0,
                            }}>
                              {!preview && isOutlineActive && cur.slice(0, 6).map((c, ci) => <div key={ci} style={{ flex: 1, height: '100%', backgroundColor: c }} />)}
                              {!isOutlineActive && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#334155' }}><div style={{ width: '120%', height: '2px', backgroundColor: '#ef4444', transform: 'rotate(-45deg)' }} /></div>}
                            </button>
                            {isOpen && outlinePresets.map((preset, pi) => {
                              const active = isOutlineActive && JSON.stringify(cur) === JSON.stringify(preset.colors);
                              const isWhite = preset.c === '#ffffff';
                              return (
                                <button key={pi} onClick={() => { if (active) { onUpdateBlock(block.id, { content: { ...faBlock.content, subOutlineEnabled: false } } as any); } else { onUpdateBlock(block.id, { content: { ...faBlock.content, subOutlineEnabled: true, subOutlineColors: preset.colors } } as any); } setOpenColorPicker(null); }}
                                  style={{ width: '18px', height: '18px', borderRadius: '50%', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', overflow: 'hidden',
                                    border: active ? '2px solid #3b82f6' : preset.c && !isWhite ? `2px solid ${preset.c}` : isWhite ? '1px solid #94a3b8' : '1px solid #475569', backgroundColor: 'transparent' }}>
                                  {!preset.c && preset.colors.slice(0, 6).map((c, ci) => <div key={ci} style={{ flex: 1, height: '100%', backgroundColor: c }} />)}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* ── Stín + Zakulacení ── */}
                  {(faBlock.content.subShowBackground !== false || faBlock.content.subOutlineEnabled === true) && (
                    <div style={{ marginBottom: '14px', borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {/* Stín */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
                            <Blend size={11} style={{ color: '#808080', flexShrink: 0 }} />
                            <span style={{ ...labelStyle, marginBottom: 0, fontSize: '10px', letterSpacing: '0.6px', color: '#CCCCCC' }}>STÍN</span>
                          </div>
                          <div style={{ position: 'relative' }}>
                            <select
                              value={faBlock.content.subShadow || 'none'}
                              onChange={(e) => onUpdateBlock(block.id, { content: { ...faBlock.content, subShadow: e.target.value as 'none' | 'sm' | 'md' } } as any)}
                              style={{ width: '100%', backgroundColor: '#1e293b', color: '#e5e7eb', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px', padding: '8px 28px 8px 10px', cursor: 'pointer', appearance: 'none', fontWeight: 500 }}
                            >
                              <option value="none">Bez stínu</option>
                              <option value="sm">Malý stín</option>
                              <option value="md">Velký stín</option>
                            </select>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#808080' }}>
                              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        </div>
                        {/* Zakulacení */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
                            <SquareRoundCorner size={11} style={{ color: '#808080', flexShrink: 0 }} />
                            <span style={{ ...labelStyle, marginBottom: 0, fontSize: '10px', letterSpacing: '0.6px', color: '#CCCCCC' }}>ZAKULACENÍ</span>
                          </div>
                          <div style={{ position: 'relative' }}>
                            <select
                              value={(() => {
                                const r = faBlock.content.subBorderRadius ?? 10;
                                if (r === 0) return 'none';
                                if (r <= 8) return 'sm';
                                if (r <= 16) return 'md';
                                return 'lg';
                              })()}
                              onChange={(e) => {
                                const map: Record<string, number> = { none: 0, sm: 6, md: 12, lg: 20 };
                                onUpdateBlock(block.id, { content: { ...faBlock.content, subBorderRadius: map[e.target.value] } } as any);
                              }}
                              style={{ width: '100%', backgroundColor: '#1e293b', color: '#e5e7eb', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px', padding: '8px 28px 8px 10px', cursor: 'pointer', appearance: 'none', fontWeight: 500 }}
                            >
                              <option value="none">Žádné</option>
                              <option value="sm">Malé</option>
                              <option value="md">Střední</option>
                              <option value="lg">Velké</option>
                            </select>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#808080' }}>
                              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Answer space style - visual icons matching VZHLED BLOKU */}
                  <div style={{ marginBottom: '14px', borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
                    <label style={{ ...labelStyle, marginBottom: '6px', fontSize: '10px', letterSpacing: '0.8px', color: '#CCCCCC' }}>PROSTOR PRO ODPOVĚĎ</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {([
                        { value: 'none', label: 'Nic', icon: 'empty' },
                        { value: 'dotted', label: 'Tečky', icon: 'dots' },
                        { value: 'solid', label: 'Linky', icon: 'lines' },
                        { value: 'space', label: 'Prostor', icon: 'space' },
                        { value: 'inline-line', label: 'Vedle', icon: 'inline' },
                      ] as const).map((opt) => {
                        const current = faBlock.content.subAnswerStyle || (faBlock.content.subShowLines === false ? 'none' : 'dotted');
                        const isActive = current === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => onUpdateBlock(block.id, {
                              content: { ...faBlock.content, subAnswerStyle: opt.value, subShowLines: opt.value !== 'none' }
                            } as any)}
                            style={{
                              ...buttonStyle,
                              flex: 1,
                              flexDirection: 'column',
                              height: '42px',
                              justifyContent: 'center',
                              backgroundColor: isActive ? '#3B82F6' : '#1e293b',
                              border: isActive ? '1px solid #60A5FA' : '1px solid #334155',
                              color: isActive ? 'white' : '#94a3b8',
                              padding: '4px',
                              gap: '0',
                            }}
                            title={opt.label}
                          >
                            <div style={{
                              width: '100%',
                              height: '100%',
                              borderRadius: '4px',
                              backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#0f172a',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              gap: '3px',
                              padding: '6px',
                              overflow: 'hidden',
                            }}>
                              {opt.icon === 'dots' && (
                                <div style={{
                                  height: '100%',
                                  backgroundImage: `radial-gradient(${isActive ? '#FFFFFF' : '#CCCCCC'} 1.5px, transparent 1.5px)`,
                                  backgroundSize: '6px 6px',
                                }} />
                              )}
                              {opt.icon === 'lines' && (
                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
                                  <div style={{ height: '1.5px', backgroundColor: isActive ? '#FFFFFF' : '#CCCCCC', width: '100%' }} />
                                  <div style={{ height: '1.5px', backgroundColor: isActive ? '#FFFFFF' : '#CCCCCC', width: '100%' }} />
                                  <div style={{ height: '1.5px', backgroundColor: isActive ? '#FFFFFF' : '#CCCCCC', width: '100%' }} />
                                </div>
                              )}
                              {opt.icon === 'empty' && (
                                <div style={{ height: '100%', border: '1px dashed #475569', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <X size={14} style={{ color: '#64748b', opacity: 0.5 }} />
                                </div>
                              )}
                              {opt.icon === 'space' && (
                                <div style={{ height: '100%', border: '1px dashed #475569', borderRadius: '2px' }} />
                              )}
                              {opt.icon === 'inline' && (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <span style={{ fontSize: '7px', color: isActive ? '#FFFFFF' : '#CCCCCC', flexShrink: 0 }}>A:</span>
                                  <div style={{ flex: 1, height: '3px', backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : 'rgba(200,200,200,0.3)', borderRadius: '1px' }} />
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sub-question font settings */}
                  <div style={{ marginBottom: '14px', borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
                    <label style={{ ...labelStyle, marginBottom: '6px', fontSize: '10px', letterSpacing: '0.8px', color: '#CCCCCC' }}>FONT POD-OTÁZEK</label>
                    {/* Font family - full width */}
                    <div style={{ position: 'relative', marginBottom: '6px' }}>
                      <select
                        value={faBlock.content.subFontFamily || (faBlock.content as any).fontFamily || "'Fenomen Sans', sans-serif"}
                        onChange={(e) => onUpdateBlock(block.id, {
                          content: { ...faBlock.content, subFontFamily: e.target.value }
                        } as any)}
                        style={{ width: '100%', backgroundColor: '#1e293b', color: '#e5e7eb', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px', padding: '8px 28px 8px 10px', cursor: 'pointer', appearance: 'none', fontWeight: 500 }}
                      >
                        {FONT_FAMILIES.map((font) => (
                          <option key={font.value} value={font.value}>{font.label}</option>
                        ))}
                      </select>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#808080' }}>
                        <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    {/* Weight + Size row */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <select
                          value={faBlock.content.subFontWeight || (faBlock.content as any).fontWeight || 'normal'}
                          onChange={(e) => onUpdateBlock(block.id, {
                            content: { ...faBlock.content, subFontWeight: e.target.value }
                          } as any)}
                          style={{ width: '100%', backgroundColor: '#1e293b', color: '#e5e7eb', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px', padding: '8px 28px 8px 10px', cursor: 'pointer', appearance: 'none', fontWeight: 500 }}
                        >
                          <option value="normal">Regular</option>
                          <option value="500">Medium</option>
                          <option value="600">Semibold</option>
                          <option value="bold">Bold</option>
                        </select>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#808080' }}>
                          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div style={{ width: '68px', position: 'relative' }}>
                        <select
                          value={faBlock.content.subFontSize || (faBlock.content as any).fontSize || 12}
                          onChange={(e) => onUpdateBlock(block.id, {
                            content: { ...faBlock.content, subFontSize: parseInt(e.target.value) }
                          } as any)}
                          style={{ width: '100%', backgroundColor: '#1e293b', color: '#e5e7eb', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px', padding: '8px 24px 8px 10px', cursor: 'pointer', appearance: 'none', fontWeight: 500 }}
                        >
                          {FONT_SIZES.map((size) => (
                            <option key={size} value={size}>{size}</option>
                          ))}
                        </select>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#808080' }}>
                          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* (Label style + color circles are now in the Označení section above) */}

                  {/* Sub-questions list */}
                  <div style={{ marginBottom: '8px' }}>
                    <label style={labelStyle}>Pod-otázky ({faBlock.content.subQuestions!.length})</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {faBlock.content.subQuestions!.map((sq, i) => {
                        const isCircleMode = faBlock.content.subLabelStyle === 'circle' || faBlock.content.subLabelStyle === 'circle-outline';
                        const globalLabelColors = faBlock.content.subLabelColors || ['#e11d48'];
                        const effectiveColor = sq.labelColor || globalLabelColors[i % globalLabelColors.length] || '#e11d48';
                        const isExpanded = expandedSubQ === i;
                        
                        return (
                        <div key={sq.id} style={{
                          backgroundColor: '#0f172a',
                          borderRadius: '6px',
                          border: isExpanded ? '1px solid #475569' : '1px solid #1e293b',
                          overflow: 'hidden',
                        }}>
                          {/* Main row */}
                          <div style={{
                            display: 'flex',
                            gap: '4px',
                            alignItems: 'center',
                            padding: '4px 6px',
                          }}>
                            {/* Color circle with palette popup (portal) */}
                            {isCircleMode ? (
                              <div style={{ flexShrink: 0 }}>
                                <button
                                  ref={(el) => { if (el) colorBtnRefs.current.set(i, el); }}
                                  onClick={() => {
                                    if (colorPaletteForSubQ === i) {
                                      setColorPaletteForSubQ(null);
                                      setColorPalettePos(null);
                                    } else {
                                      const btn = colorBtnRefs.current.get(i);
                                      if (btn) {
                                        const rect = btn.getBoundingClientRect();
                                        setColorPalettePos({ top: rect.bottom + 4, left: rect.left });
                                      }
                                      setColorPaletteForSubQ(i);
                                    }
                                  }}
                                  title={`Barva ${faBlock.content.subLabelType === 'numbers' ? i + 1 : String.fromCharCode(65 + i)}`}
                                  style={{
                                    width: '22px',
                                    height: '22px',
                                    padding: 0,
                                    border: colorPaletteForSubQ === i ? '2px solid #3b82f6' : '2px solid #475569',
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                    backgroundColor: effectiveColor,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                  }}
                                >
                                  {faBlock.content.subLabelType === 'numbers' ? i + 1 : String.fromCharCode(65 + i)}
                                </button>
                                {/* Color palette rendered via portal */}
                                {colorPaletteForSubQ === i && colorPalettePos && createPortal(
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      position: 'fixed',
                                      top: colorPalettePos.top,
                                      left: colorPalettePos.left,
                                      zIndex: 99999,
                                      padding: '8px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                                      borderRadius: '8px',
                                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(6, 1fr)',
                                      gap: '4px',
                                      width: '170px',
                                    }}
                                  >
                                    {LABEL_COLOR_PALETTE.map((color) => (
                                      <button
                                        key={color}
                                        onClick={() => {
                                          const updated = [...faBlock.content.subQuestions!];
                                          updated[i] = { ...updated[i], labelColor: color };
                                          onUpdateBlock(block.id, {
                                            content: { ...faBlock.content, subQuestions: updated }
                                          } as any);
                                          setColorPaletteForSubQ(null);
                                          setColorPalettePos(null);
                                        }}
                                        style={{
                                          width: '24px',
                                          height: '24px',
                                          borderRadius: '50%',
                                          backgroundColor: color,
                                          border: effectiveColor === color ? '2px solid white' : '2px solid transparent',
                                          cursor: 'pointer',
                                          padding: 0,
                                          transition: 'transform 0.1s',
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.2)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                                      />
                                    ))}
                                    {sq.labelColor && (
                                      <button
                                        onClick={() => {
                                          const updated = [...faBlock.content.subQuestions!];
                                          updated[i] = { ...updated[i], labelColor: undefined };
                                          onUpdateBlock(block.id, {
                                            content: { ...faBlock.content, subQuestions: updated }
                                          } as any);
                                          setColorPaletteForSubQ(null);
                                          setColorPalettePos(null);
                                        }}
                                        style={{
                                          gridColumn: 'span 6',
                                          padding: '4px',
                                          backgroundColor: '#334155',
                                          border: '1px solid #475569',
                                          borderRadius: '4px',
                                          color: '#94a3b8',
                                          fontSize: '10px',
                                          cursor: 'pointer',
                                          marginTop: '2px',
                                        }}
                                      >
                                        Resetovat na globální
                                      </button>
                                    )}
                                  </div>,
                                  document.body
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: '10px', color: '#94a3b8', width: '20px', flexShrink: 0 }}>
                                {faBlock.content.subLabelType === 'numbers' ? `${i + 1})` : `${String.fromCharCode(65 + i)})`}
                              </span>
                            )}
                            <input
                              type="text"
                              value={sq.text}
                              onChange={(e) => {
                                const updated = [...faBlock.content.subQuestions!];
                                updated[i] = { ...updated[i], text: e.target.value };
                                onUpdateBlock(block.id, {
                                  content: { ...faBlock.content, subQuestions: updated }
                                } as any);
                              }}
                              placeholder="Text otázky..."
                              style={{
                                flex: 1,
                                padding: '4px 8px',
                                backgroundColor: '#334155',
                                border: '1px solid #475569',
                                borderRadius: '4px',
                  color: '#e5e7eb',
                  fontSize: '11px',
                  outline: 'none',
                }}
              />
                            {/* Lines counter inline */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                              <button
                                onClick={() => {
                                  const updated = [...faBlock.content.subQuestions!];
                                  updated[i] = { ...updated[i], lines: Math.max(0, (sq.lines ?? 1) - 1) };
                                  onUpdateBlock(block.id, { content: { ...faBlock.content, subQuestions: updated } } as any);
                                }}
                                style={{ ...buttonStyle, padding: '2px 4px', fontSize: '12px', color: '#94a3b8', minWidth: '18px', justifyContent: 'center' }}
                              >−</button>
                              <span style={{ fontSize: '10px', color: '#cbd5e1', minWidth: '14px', textAlign: 'center' }}>{sq.lines ?? 1}</span>
                              <button
                                onClick={() => {
                                  const updated = [...faBlock.content.subQuestions!];
                                  updated[i] = { ...updated[i], lines: (sq.lines ?? 1) + 1 };
                                  onUpdateBlock(block.id, { content: { ...faBlock.content, subQuestions: updated } } as any);
                                }}
                                style={{ ...buttonStyle, padding: '2px 4px', fontSize: '12px', color: '#94a3b8', minWidth: '18px', justifyContent: 'center' }}
                              >+</button>
                            </div>
                            {/* Expand/collapse */}
                            <button
                              onClick={() => setExpandedSubQ(isExpanded ? null : i)}
                              style={{ ...buttonStyle, padding: '4px', color: '#94a3b8' }}
                              title="Rozbalit detaily"
                            >
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                            <button
                              onClick={() => {
                                const updated = faBlock.content.subQuestions!.filter((_, idx) => idx !== i);
                                onUpdateBlock(block.id, {
                                  content: { ...faBlock.content, subQuestions: updated }
                                } as any);
                                if (expandedSubQ === i) setExpandedSubQ(null);
                              }}
                              style={{ ...buttonStyle, padding: '4px', color: '#ef4444' }}
                              title="Smazat"
                            >
                              <Trash2 size={12} />
                            </button>
            </div>

                          {/* Expanded section: sampleAnswer + image */}
                          {isExpanded && (
                            <div style={{
                              padding: '6px 6px 8px 6px',
                              borderTop: '1px solid #1e293b',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                            }}>
                              {/* Hint */}
                              <div>
                                <label style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px', display: 'block' }}>Nápověda</label>
                                <input
                                  type="text"
                                  value={(sq as any).hint || ''}
                                  onChange={(e) => {
                                    const updated = [...faBlock.content.subQuestions!];
                                    updated[i] = { ...updated[i], hint: e.target.value || undefined } as any;
                                    onUpdateBlock(block.id, { content: { ...faBlock.content, subQuestions: updated } } as any);
                                  }}
                                  placeholder="Nápověda pro žáka..."
                                  style={{ width: '100%', padding: '4px 8px', backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '4px', color: '#fbbf24', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}
                                />
                              </div>
                              {/* Sample answer */}
                              <div>
                                <label style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px', display: 'block' }}>Vzorové řešení</label>
                                <input
                                  type="text"
                                  value={sq.sampleAnswer || ''}
                                  onChange={(e) => {
                                    const updated = [...faBlock.content.subQuestions!];
                                    updated[i] = { ...updated[i], sampleAnswer: e.target.value || undefined };
                                    onUpdateBlock(block.id, {
                                      content: { ...faBlock.content, subQuestions: updated }
                                    } as any);
                                  }}
                                  placeholder="Správná odpověď..."
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    backgroundColor: '#334155',
                                    border: '1px solid #475569',
                                    borderRadius: '4px',
                                    color: '#22c55e',
                                    fontSize: '11px',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                  }}
                                />
                              </div>
                              {/* Image */}
                              <div>
                                <label style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px', display: 'block' }}>Obrázek</label>
                                {sq.imageUrl ? (
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                    <div style={{
                                      width: '60px',
                                      height: '60px',
                                      borderRadius: '4px',
                                      overflow: 'hidden',
                                      border: '1px solid #475569',
                                      flexShrink: 0,
                                      cursor: 'pointer',
                                    }}
                                      onClick={() => openAssetPicker({ type: 'sub-question-image', subQuestionIndex: i })}
                                    >
                                      <img src={sq.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                                      {/* Position selector */}
                                      <div style={{ display: 'flex', gap: '3px' }}>
                                        {([
                                          { value: 'below', label: 'Pod textem' },
                                          { value: 'beside', label: 'Vedle' },
                                        ] as const).map((pos) => (
                                          <button
                                            key={pos.value}
                                            onClick={() => {
                                              const updated = [...faBlock.content.subQuestions!];
                                              updated[i] = { ...updated[i], imagePosition: pos.value };
                                              onUpdateBlock(block.id, {
                                                content: { ...faBlock.content, subQuestions: updated }
                                              } as any);
                                            }}
                                            style={{
                                              ...buttonStyle,
                                              flex: 1,
                                              justifyContent: 'center',
                                              fontSize: '9px',
                                              padding: '3px 4px',
                                              backgroundColor: (sq.imagePosition || 'below') === pos.value ? '#3b82f6' : '#334155',
                                              color: (sq.imagePosition || 'below') === pos.value ? 'white' : '#e5e7eb',
                                            }}
                                          >
                                            {pos.label}
                                          </button>
                                        ))}
                                      </div>
                                      {/* Remove image */}
                                      <button
                                        onClick={() => {
                                          const updated = [...faBlock.content.subQuestions!];
                                          updated[i] = { ...updated[i], imageUrl: undefined, imagePosition: undefined };
                                          onUpdateBlock(block.id, {
                                            content: { ...faBlock.content, subQuestions: updated }
                                          } as any);
                                        }}
                                        style={{
                                          ...buttonStyle,
                                          justifyContent: 'center',
                                          fontSize: '9px',
                                          padding: '3px 4px',
                                          color: '#ef4444',
                                        }}
                                      >
                                        <Trash2 size={10} /> Odebrat
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => openAssetPicker({ type: 'sub-question-image', subQuestionIndex: i })}
                                    style={{
                                      ...buttonStyle,
                                      width: '100%',
                                      justifyContent: 'center',
                                      fontSize: '10px',
                                      padding: '6px',
                                      backgroundColor: '#334155',
                                    }}
                                  >
                                    <ImageIcon size={12} /> Přidat obrázek
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Add sub-question */}
                  <button
                    onClick={() => {
                      const updated = [
                        ...(faBlock.content.subQuestions || []),
                        { id: generateBlockId(), text: '', lines: 1 } as FreeAnswerSubQuestion,
                      ];
                      onUpdateBlock(block.id, {
                        content: { ...faBlock.content, subQuestions: updated }
                      } as any);
                    }}
                    style={{
                      ...buttonStyle,
                      width: '100%',
                      justifyContent: 'center',
                      backgroundColor: '#334155',
                    }}
                  >
                    <Plus size={14} />
                    Přidat pod-otázku
                  </button>

                  {/* ── Vizuální styl obrázků (jen pokud mají pod-otázky obrázky) ── */}
                  {faBlock.content.subQuestions!.some(sq => sq.imageUrl) && (() => {
                    const siShape = (faBlock.content as any).subImageShape || 'rectangle';
                    const siRadius = (faBlock.content as any).subImageBorderRadius ?? 8;
                    const siStrokeColor = (faBlock.content as any).subImageStrokeColor || '#334155';
                    const siStrokeWidth = (faBlock.content as any).subImageStrokeWidth ?? 0;
                    const siRotate = !!(faBlock.content as any).subImageRotate;
                    const siRotateMax = (faBlock.content as any).subImageRotateMax ?? 5;
                    const siHeight = (faBlock.content as any).subImageHeight ?? 150;
                    const updateFaImg = (patch: Record<string, any>) =>
                      onUpdateBlock(block.id, { content: { ...faBlock.content, ...patch } } as any);
                    return (
                      <div style={{ marginTop: '12px', borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
                        <label style={{ ...labelStyle, marginBottom: '8px', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '9px' }}>
                          ✦ Vizuální styl obrázků
                        </label>

                        {/* Shape */}
                        <label style={labelStyle}>Tvar výřezu</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', marginBottom: '10px' }}>
                          {[
                            { id: 'rectangle', label: '▭', title: 'Obdélník' },
                            { id: 'circle', label: '●', title: 'Kolečko' },
                            { id: 'heart', label: '♥', title: 'Srdíčko' },
                            { id: 'triangle', label: '▲', title: 'Trojúhelník' },
                            { id: 'star', label: '★', title: 'Hvězdička' },
                            { id: 'speech-bubble', label: '💬', title: 'Komiksová bublina' },
                          ].map(({ id, label, title }) => (
                            <button key={id} title={title} onClick={() => updateFaImg({ subImageShape: id })}
                              style={{ ...buttonStyle, justifyContent: 'center', fontSize: id === 'speech-bubble' ? '14px' : '16px',
                                backgroundColor: siShape === id ? '#7c3aed' : '#334155',
                                color: siShape === id ? 'white' : '#94a3b8', padding: '6px 0' }}>
                              {label}
                            </button>
                          ))}
                        </div>

                        {/* Border radius (rectangle only) */}
                        {siShape === 'rectangle' && (
                          <div style={{ marginBottom: '10px' }}>
                            <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
                              <span>Zakulacení rohů</span>
                              <span style={{ color: '#7c3aed', fontWeight: 700 }}>{siRadius}px</span>
                            </label>
                            <input type="range" min={0} max={80} value={siRadius}
                              onChange={(e) => updateFaImg({ subImageBorderRadius: parseInt(e.target.value) })}
                              style={{ width: '100%', height: '4px', appearance: 'none', backgroundColor: '#475569', borderRadius: '2px', cursor: 'pointer' }} />
                          </div>
                        )}

                        {/* Stroke */}
                        <div style={{ marginBottom: '10px' }}>
                          <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
                            <span>Obrys obrázku</span>
                            <span style={{ color: '#7c3aed', fontWeight: 700 }}>{siStrokeWidth}px</span>
                          </label>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input type="range" min={0} max={12} value={siStrokeWidth}
                              onChange={(e) => updateFaImg({ subImageStrokeWidth: parseInt(e.target.value) })}
                              style={{ flex: 1, height: '4px', appearance: 'none', backgroundColor: '#475569', borderRadius: '2px', cursor: 'pointer' }} />
                            <button
                              ref={faImgStrokeBtnRef}
                              onClick={() => {
                                if (faImgPickerOpen) { setFaImgPickerOpen(false); setFaImgPickerPos(null); return; }
                                const btn = faImgStrokeBtnRef.current;
                                if (btn) {
                                  const rect = btn.getBoundingClientRect();
                                  setFaImgPickerPos({ top: rect.bottom + 4, left: rect.left });
                                }
                                setFaImgPickerOpen(true);
                              }}
                              style={{ width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', padding: 0, flexShrink: 0,
                                backgroundColor: siStrokeColor, border: faImgPickerOpen ? '2px solid #7c3aed' : '2px solid #475569' }}
                            />
                          </div>
                        </div>

                        {/* Image height */}
                        <div style={{ marginBottom: '10px' }}>
                          <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
                            <span>Výška obrázku</span>
                            <span style={{ color: '#7c3aed', fontWeight: 700 }}>{siHeight}px</span>
                          </label>
                          <input type="range" min={60} max={300} step={10} value={siHeight}
                            onChange={(e) => updateFaImg({ subImageHeight: parseInt(e.target.value) })}
                            style={{ width: '100%', height: '4px', appearance: 'none', backgroundColor: '#475569', borderRadius: '2px', cursor: 'pointer' }} />
                        </div>

                        {/* Rotation */}
                        <div style={{ marginBottom: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <label style={{ ...labelStyle, marginBottom: 0 }}>Náhodné natočení</label>
                            <button onClick={() => updateFaImg({ subImageRotate: !siRotate })}
                              style={{ ...buttonStyle, padding: '4px 10px', fontSize: '10px',
                                backgroundColor: siRotate ? '#7c3aed' : '#334155',
                                color: siRotate ? 'white' : '#94a3b8' }}>
                              {siRotate ? 'Zapnuto' : 'Vypnuto'}
                            </button>
                          </div>
                          {siRotate && (
                            <div>
                              <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
                                <span>Max. úhel</span>
                                <span style={{ color: '#7c3aed', fontWeight: 700 }}>±{siRotateMax}°</span>
                              </label>
                              <input type="range" min={1} max={15} value={siRotateMax}
                                onChange={(e) => updateFaImg({ subImageRotateMax: parseInt(e.target.value) })}
                                style={{ width: '100%', height: '4px', appearance: 'none', backgroundColor: '#475569', borderRadius: '2px', cursor: 'pointer' }} />
                            </div>
                          )}
                        </div>

                        {/* Stroke color portal */}
                        {faImgPickerOpen && faImgPickerPos && createPortal(
                          <div
                            data-fa-img-palette
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            style={{ position: 'fixed', top: faImgPickerPos.top, left: faImgPickerPos.left, zIndex: 99999,
                              padding: '8px', backgroundColor: '#1e293b', border: '1px solid #475569',
                              borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                              display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', width: '170px' }}
                          >
                            {LABEL_COLOR_PALETTE.map((color) => (
                              <button key={color}
                                onClick={() => { updateFaImg({ subImageStrokeColor: color }); setFaImgPickerOpen(false); setFaImgPickerPos(null); }}
                                style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: color, cursor: 'pointer', padding: 0,
                                  border: siStrokeColor === color ? '2px solid white' : '2px solid transparent', transition: 'transform 0.1s' }}
                                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.2)')}
                                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                              />
                            ))}
                          </div>,
                          document.body
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          );
        })()}

                {/* PARAGRAPH IMAGE Section - gallery-style UX */}
        {block.type === 'paragraph' && (() => {
          const paraImgUrl = (block.content as any).imageUrl as string | undefined;
          const paraImgPos = (block.content as any).imagePosition || 'right';
          const paraImgShape = (block.content as any).imageShape || 'square';
          const paraImgSize = (block.content as any).imageSize || 120;
          return (
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#f59e0b', display: 'block', marginBottom: '10px' }}>🖼️ OBRÁZEK V ODSTAVCI</span>

            {/* Thumbnail row */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {paraImgUrl ? (
                <div
                  style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '8px', overflow: 'hidden', border: showParaImgEdit ? '2px solid #5C5CFF' : '2px solid #334155', cursor: 'pointer', flexShrink: 0, backgroundColor: '#0f172a' }}
                  onClick={() => setShowParaImgEdit(!showParaImgEdit)}
                >
                  <img src={paraImgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {showParaImgEdit && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(92,92,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={14} style={{ color: '#5C5CFF' }} />
                    </div>
                  )}
                </div>
              ) : null}
              {/* Add / replace button */}
              <button
                onClick={() => openAssetPicker({ type: 'paragraph-image' })}
                style={{ width: '56px', height: '56px', backgroundColor: '#1e293b', border: '2px dashed #475569', borderRadius: '8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', transition: 'border-color 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#5C5CFF'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#475569'; }}
              >
                <ImageIcon size={18} style={{ color: '#64748b' }} />
                <span style={{ fontSize: '8px', color: '#64748b' }}>{paraImgUrl ? 'Přidat' : 'Vybrat'}</span>
              </button>
            </div>

            {/* Detail panel – shown when thumbnail selected */}
            {showParaImgEdit && paraImgUrl && (
              <div style={{ backgroundColor: '#0f172a', borderRadius: '10px', padding: '12px', border: '1px solid #334155', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Obrázek</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => { setImageEditModalIndex(-99 as any); }}
                      style={{ ...buttonStyle, fontSize: '10px', padding: '3px 8px', backgroundColor: '#334155' }}
                      title="Oříznout nebo přegenerovat"
                    >
                      ✂ Upravit
                    </button>
                    <button
                      onClick={() => openAssetPicker({ type: 'paragraph-image' })}
                      style={{ ...buttonStyle, fontSize: '10px', padding: '3px 8px' }}
                    >
                      <ImageIcon size={11} /> Změnit
                    </button>
                    <button
                      onClick={() => { onUpdateBlock(block.id, { content: { ...(block.content as any), imageUrl: '' } } as any); setShowParaImgEdit(false); }}
                      style={{ ...buttonStyle, fontSize: '10px', padding: '3px 8px', color: '#ef4444' }}
                    >
                      <Trash2 size={11} /> Smazat
                    </button>
                  </div>
                </div>

                {/* Position */}
                <label style={{ ...labelStyle, fontSize: '10px', marginBottom: '6px', display: 'block' }}>Pozice</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '10px' }}>
                  {[{ value: 'left', label: '⬅ Vlevo' }, { value: 'right', label: '➡ Vpravo' }, { value: 'top', label: '⬆ Nad' }, { value: 'bottom', label: '⬇ Pod' }].map((pos) => (
                    <button key={pos.value} onClick={() => onUpdateBlock(block.id, { content: { ...(block.content as any), imagePosition: pos.value } } as any)}
                      style={{ ...buttonStyle, padding: '5px 2px', fontSize: '9px', justifyContent: 'center', backgroundColor: paraImgPos === pos.value ? '#5C5CFF' : '#334155', color: paraImgPos === pos.value ? 'white' : '#94a3b8' }}>
                      {pos.label}
                    </button>
                  ))}
                </div>

                {/* Shape */}
                <label style={{ ...labelStyle, fontSize: '10px', marginBottom: '6px', display: 'block' }}>Tvar</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginBottom: '10px' }}>
                  {[{ value: 'square', label: '⬜ Čtverec' }, { value: 'rounded', label: '🔲 Zaoblený' }, { value: 'circle', label: '⭕ Kolečko' }].map((shape) => (
                    <button key={shape.value} onClick={() => onUpdateBlock(block.id, { content: { ...(block.content as any), imageShape: shape.value } } as any)}
                      style={{ ...buttonStyle, padding: '5px 4px', fontSize: '9px', justifyContent: 'center', backgroundColor: paraImgShape === shape.value ? '#5C5CFF' : '#334155', color: paraImgShape === shape.value ? 'white' : '#94a3b8' }}>
                      {shape.label}
                    </button>
                  ))}
                </div>

                {/* Size slider */}
                <label style={{ ...labelStyle, fontSize: '10px', marginBottom: '4px', display: 'block' }}>Velikost: {paraImgSize}px</label>
                <input type="range" min="60" max="300" step="10" value={paraImgSize}
                  onChange={(e) => onUpdateBlock(block.id, { content: { ...(block.content as any), imageSize: parseInt(e.target.value) } } as any)}
                  style={{ width: '100%', height: '4px', appearance: 'none', backgroundColor: '#475569', borderRadius: '2px', cursor: 'pointer' }}
                />
              </div>
            )}

            {/* If no image yet, show prompt */}
            {!paraImgUrl && (
              <p style={{ fontSize: '10px', color: '#64748b', margin: 0 }}>Klikni na tlačítko výše pro výběr obrázku</p>
            )}
          </div>
          );
        })()}

        {/* Paragraph image edit modal */}
        {(imageEditModalIndex as any) === -99 && (block.content as any).imageUrl && (
          <ImageEditModal
            imageUrl={(block.content as any).imageUrl}
            altText=""
            onClose={() => setImageEditModalIndex(null)}
            onApply={(newUrl) => {
              onUpdateBlock(block.id, { content: { ...(block.content as any), imageUrl: newUrl } } as any);
              setImageEditModalIndex(null);
            }}
          />
        )}
        </div>
      </div>
      
      {/* Asset Picker Modal */}
      <AssetPicker
        isOpen={assetPickerOpen}
        onClose={() => {
          setAssetPickerOpen(false);
          setAssetPickerContext(null);
        }}
        onSelect={handleAssetSelect}
      />
    </div>
  );
}
