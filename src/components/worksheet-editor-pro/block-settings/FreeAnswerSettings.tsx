import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ImageIcon, LayoutGrid, Plus, Trash2, ChevronDown, ChevronUp, Blend, Indent, SquareRoundCorner, X } from 'lucide-react';
import type { WorksheetBlock, FreeAnswerBlock, FreeAnswerSubQuestion, SubQuestionLabelType } from '../../../types/worksheet';
import { generateBlockId } from '../../../types/worksheet';
import { BlockImageEditor } from './BlockImageEditor';
import { inputStyle, labelStyle, buttonStyle, FONT_FAMILIES, FONT_SIZES } from './shared';

const LABEL_COLOR_PALETTE = [
  '#e11d48', '#ef4444', '#f97316', '#ea580c', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#16a34a', '#10b981', '#14b8a6', '#06b6d4',
  '#0ea5e9', '#3b82f6', '#2563eb', '#6366f1', '#8b5cf6', '#9333ea',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#475569', '#1e293b',
];

interface FreeAnswerSettingsProps {
  block: WorksheetBlock;
  onUpdateBlock: (id: string, patch: any) => void;
  openAssetPicker: (ctx: any) => void;
}

export function FreeAnswerSettings({ block, onUpdateBlock, openAssetPicker }: FreeAnswerSettingsProps) {
  const [expandedSubQ, setExpandedSubQ] = useState<number | null>(null);
  const [colorPaletteForSubQ, setColorPaletteForSubQ] = useState<number | null>(null);
  const [colorPalettePos, setColorPalettePos] = useState<{ top: number; left: number } | null>(null);
  const [faImgPickerOpen, setFaImgPickerOpen] = useState(false);
  const [faImgPickerPos, setFaImgPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [openColorPicker, setOpenColorPicker] = useState<'fill' | 'outline' | 'label' | null>(null);
  const colorBtnRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const faImgStrokeBtnRef = useRef<HTMLButtonElement>(null);

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

  if (block.type !== 'free-answer') return null;

  const faBlock = block as FreeAnswerBlock;
  const hasSubQ = !!(faBlock.content.subQuestions && faBlock.content.subQuestions.length > 0);
  const hasImg = !!(block as any).image;

  return (
    <>
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
                    const siZoom = (faBlock.content as any).subImageZoom ?? 100;
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
                          <input type="range" min={60} max={400} step={10} value={siHeight}
                            onChange={(e) => updateFaImg({ subImageHeight: parseInt(e.target.value) })}
                            style={{ width: '100%', height: '4px', appearance: 'none', backgroundColor: '#475569', borderRadius: '2px', cursor: 'pointer' }} />
                        </div>

                        {/* Zoom */}
                        <div style={{ marginBottom: '10px' }}>
                          <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
                            <span>Zoom</span>
                            <span style={{ color: '#7c3aed', fontWeight: 700 }}>{siZoom}%</span>
                          </label>
                          <input type="range" min={100} max={250} step={5} value={siZoom}
                            onChange={(e) => {
                              const updated = (faBlock.content.subQuestions || []).map((sq: any) => ({ ...sq, imageOffsetX: 0, imageOffsetY: 0 }));
                              updateFaImg({ subImageZoom: parseInt(e.target.value), subQuestions: updated });
                            }}
                            style={{ width: '100%', height: '4px', appearance: 'none', backgroundColor: '#475569', borderRadius: '2px', cursor: 'pointer' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#64748b', fontWeight: 700 }}>
                            <span>Originál</span><span>Střední</span><span>Velký zoom</span>
                          </div>
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

    </>
  );
}
