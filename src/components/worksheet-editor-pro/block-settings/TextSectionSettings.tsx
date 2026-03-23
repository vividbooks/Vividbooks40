import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabase/client';
import { toast } from 'sonner';
import {
  Type, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  ChevronDown, ChevronUp, RefreshCw, ExternalLink, Link2, Link2Off, Figma,
  LayoutGrid, Copy, ArrowUpToLine, ArrowDownToLine, AlignVerticalJustifyCenter,
} from 'lucide-react';
const ChevronDownIcon = ChevronDown;
import type { WorksheetBlock } from '../../../types/worksheet';
import {
  FONT_FAMILIES,
  FONT_SIZES,
  SIDEBAR_COLORS,
  sectionTitleStyle,
  sectionHeaderRowStyle,
  subtleCardStyle,
  inputStyle,
  textareaStyle,
  selectStyle,
  labelStyle,
  buttonStyle,
  iconButtonStyle,
  getSegmentedButtonStyle,
} from './shared';
import { ColorPickerField } from './ColorPickerField';
import { legacyQuestionStringToHtml } from '../../../utils/worksheet-text';

const TEXT_PRESETS = [
  { 
    id: 'h1', 
    label: 'Nadpis H1', 
    styles: { fontSize: 32, fontWeight: 'bold', lineHeight: 1.2, fontFamily: "'Fenomen Sans', sans-serif", isItalic: false } 
  },
  { 
    id: 'h2', 
    label: 'Podnadpis H2', 
    styles: { fontSize: 24, fontWeight: '600', lineHeight: 1.3, fontFamily: "'Fenomen Sans', sans-serif", isItalic: false } 
  },
  { 
    id: 'text', 
    label: 'Text', 
    styles: { fontSize: 12, fontWeight: 'normal', lineHeight: 1.5, fontFamily: "'Fenomen Sans', sans-serif", isItalic: false } 
  },
  { 
    id: 'caption', 
    label: 'Popisek', 
    styles: { fontSize: 10, fontWeight: 'normal', lineHeight: 1.4, fontFamily: "'Fenomen Sans', sans-serif", isItalic: true } 
  },
];

const FREE_CANVAS_BG_COLORS = [
  { value: '#ffffff', label: 'Bílá' },
  { value: '#f8fafc', label: 'Světle šedá' },
  { value: '#f1f5f9', label: 'Šedá' },
  { value: '#1e293b', label: 'Tmavá' },
  { value: '#000000', label: 'Černá' },
  { value: 'transparent', label: 'Průhledná' },
];


interface TextSectionSettingsProps {
  block: WorksheetBlock;
  onUpdateBlock: (id: string, patch: any) => void;
  openAssetPicker: (ctx: any) => void;
  showBlockAppearanceToggle?: boolean;
  isBlockAppearanceOpen?: boolean;
  onToggleBlockAppearance?: () => void;
}

export function TextSectionSettings({
  block,
  onUpdateBlock,
  openAssetPicker,
  showBlockAppearanceToggle = false,
  isBlockAppearanceOpen = false,
  onToggleBlockAppearance,
}: TextSectionSettingsProps) {
  const [showCustomStyles, setShowCustomStyles] = useState(true);

  const questionInputRef = useRef<HTMLTextAreaElement>(null);

  // Track the last textarea/input that had a text selection, so B/I/U buttons work
  // even after the panel steals focus.
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

  const updateQuestionSource = useCallback((value: string) => {
    const nextContent = { ...(block.content as any), question: value };
    if (block.type === 'multiple-choice' || block.type === 'free-answer') {
      nextContent.questionHtml = legacyQuestionStringToHtml(value);
    }
    onUpdateBlock(block.id, { content: nextContent } as any);
  }, [block, onUpdateBlock]);

  const applyInlineFormat = (
    wrap: (s: string) => string,
    togglePattern: RegExp | null,
    fallbackProp: string,
    fallbackVal: any
  ) => {
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

    if (!targetEl && lastSelRef.current) {
      const saved = lastSelRef.current;
      if (saved.el.isConnected && saved.el.value === saved.text) {
        targetEl = saved.el;
        start = saved.start;
        end = saved.end;
        text = saved.text;
      }
    }

    if (targetEl && end > start) {
      const sel = text.substring(start, end);
      let replacement: string;
      if (togglePattern && togglePattern.test(sel)) {
        replacement = sel.replace(togglePattern, '$1');
      } else {
        replacement = wrap(sel);
      }
      const newValue = text.substring(0, start) + replacement + text.substring(end);

      if (block.type === 'multiple-choice' || block.type === 'free-answer' || block.type === 'free-canvas') {
        updateQuestionSource(newValue);
      } else {
        onUpdateBlock(block.id, { content: { ...(block.content as any), text: newValue } } as any);
      }

      const el = targetEl;
      lastSelRef.current = null;
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start, start + replacement.length);
      }, 10);
      return;
    }

    onUpdateBlock(block.id, { content: { ...(block.content as any), [fallbackProp]: fallbackVal } } as any);
  };

  // Figma integration state (free-canvas only)
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
    const w = Math.round((c.canvasWidth || 700) * (25.4 / 96));
    const h = Math.round((c.canvasHeight || 400) * (25.4 / 96));
    const wPx = c.canvasWidth || 700;
    const hPx = c.canvasHeight || 400;
    const hint = `Frame: ${wPx} × ${hPx} px  (${w} × ${h} mm)`;
    navigator.clipboard.writeText(hint).catch(() => {});
    window.open(`https://www.figma.com/design/${c.figmaFileId}`, '_blank');
  }, []);

  const defaultFontFamily = (block.type === 'heading' && (block.content as any)?.level === 'h1')
    ? 'Cooper Light, serif'
    : "'Fenomen Sans', sans-serif";
  const currentFontFamily = (block.content as any)?.fontFamily || defaultFontFamily;
  const currentFontWeight = String((block.content as any)?.fontWeight || 'normal');
  const currentFontSize = Number((block.content as any)?.fontSize || 12);
  const currentLineHeight = Number((block.content as any)?.lineHeight || 1.5);
  const currentIsItalic = Boolean((block.content as any)?.isItalic);
  const currentTextPresetId = TEXT_PRESETS.find((preset) => (
    preset.styles.fontFamily === currentFontFamily
    && String(preset.styles.fontWeight) === currentFontWeight
    && Number(preset.styles.fontSize) === currentFontSize
    && Number(preset.styles.lineHeight) === currentLineHeight
    && Boolean((preset.styles as any).isItalic) === currentIsItalic
  ))?.id || 'custom';

  return (
    <>
        {/* TEXT Section - for text blocks */}
        {['heading', 'paragraph', 'infobox', 'fill-blank', 'free-answer', 'multiple-choice', 'free-canvas'].includes(block.type) && (
          <div style={{ paddingBottom: '16px' }}>
            <div style={sectionHeaderRowStyle}>
              <span style={sectionTitleStyle}>Text</span>
              <LayoutGrid size={14} style={{ color: '#808080' }} />
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
                          ...iconButtonStyle,
                          width: 24,
                          minWidth: 24,
                          height: 24,
                          minHeight: 24,
                          borderRadius: 6,
                          border: `1px solid ${SIDEBAR_COLORS.controlBorder}`,
                          background: SIDEBAR_COLORS.panelAlt,
                          color: SIDEBAR_COLORS.text,
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
                  onChange={(e) => updateQuestionSource(e.target.value)}
                  placeholder={block.type === 'free-canvas' ? "Zadejte zadání aktivity..." : "Zadejte otázku..."}
                  style={{ ...textareaStyle, minHeight: '60px' }}
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
                <ColorPickerField
                  value={(block.content as any).backgroundColor || '#ffffff'}
                  palette={FREE_CANVAS_BG_COLORS}
                  placeholder="Barva pozadí"
                  defaultCustomColor="#ffffff"
                  onChange={(color) => onUpdateBlock(block.id, { content: { ...block.content, backgroundColor: color } } as any)}
                />
              </div>
            )}

            {/* Barva textu + kolečko (free-canvas only, přesunuto sem) */}
            {block.type === 'free-canvas' && (
              <div style={{ marginBottom: 12, borderTop: '1px solid #333', paddingTop: 12 }}>
                <label style={labelStyle}>Barva textu</label>
                <div style={{ marginBottom: 10 }}>
                  <ColorPickerField
                    value={(block.content as any)?.textColor || '#000000'}
                    placeholder="Vlastní barva"
                    defaultCustomColor="#000000"
                    onChange={(color) => onUpdateBlock(block.id, {
                      content: { ...(block.content as any), textColor: color }
                    } as any)}
                  />
                </div>

                <label style={{ ...labelStyle, marginTop: 4 }}>Kroužek a číslo</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <ColorPickerField
                    value={(block.content as any)?.circleColor || '#1e293b'}
                    placeholder="Barva"
                    defaultCustomColor="#1e293b"
                    onChange={(color) => onUpdateBlock(block.id, {
                      content: { ...(block.content as any), circleColor: color }
                    } as any)}
                  />
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
                    style={{ ...getSegmentedButtonStyle(!(block.content as any).fullscreen) }}
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
                    style={{ ...getSegmentedButtonStyle(!!(block.content as any).fullscreen) }}
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

            {/* Nastavení textu */}
            <div 
              style={{
                borderTop: '1px solid #333',
                paddingTop: '8px',
                marginTop: '8px',
                marginBottom: '12px',
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
                <span style={{ fontSize: '10px', color: '#808080' }}>NASTAVENÍ TEXTU</span>
                <ChevronDownIcon size={12} style={{ transform: showCustomStyles ? 'rotate(180deg)' : 'none' }} />
              </button>

              {showCustomStyles && (
                <div style={{ marginTop: '12px' }}>
            {block.type === 'heading' && (
              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Úroveň nadpisu</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[1, 2, 3].map((level) => (
                    <button
                      key={level}
                      onClick={() => onUpdateBlock(block.id, {
                        content: { ...(block.content as any), level: `h${level}` }
                      } as any)}
                      style={{
                        ...getSegmentedButtonStyle((block.content as any)?.level === `h${level}`),
                        flex: 1,
                      }}
                    >
                      H{level}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Text Preset + Font Family */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              {block.type !== 'heading' && (
                <div style={{ flex: 1, position: 'relative' }}>
                  <select
                    value={currentTextPresetId}
                    onChange={(e) => {
                      const preset = TEXT_PRESETS.find((item) => item.id === e.target.value);
                      if (!preset) return;
                      onUpdateBlock(block.id, {
                        content: { ...(block.content as any), ...preset.styles }
                      } as any);
                    }}
                    style={{
                      ...selectStyle,
                      appearance: 'none',
                      paddingRight: '28px',
                    }}
                  >
                    <option value="custom">Styl textu</option>
                    {TEXT_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>{preset.label}</option>
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
              )}

              <div style={{ flex: block.type === 'heading' ? 1 : 1.35, position: 'relative' }}>
                <select
                  value={currentFontFamily}
                  onChange={(e) => onUpdateBlock(block.id, {
                    content: { ...(block.content as any), fontFamily: e.target.value }
                  } as any)}
                  style={{
                    ...selectStyle,
                    appearance: 'none',
                    paddingRight: '28px',
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
              <div style={{ flex: 1, position: 'relative' }}>
                <select
                  value={(block.content as any)?.fontWeight || 'normal'}
                  onChange={(e) => onUpdateBlock(block.id, {
                    content: { ...(block.content as any), fontWeight: e.target.value }
                  } as any)}
                  style={{
                    ...selectStyle,
                    appearance: 'none',
                    paddingRight: '28px',
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

              <div style={{ width: '70px', position: 'relative' }}>
                <select
                  value={(block.content as any)?.fontSize || 12}
                  onChange={(e) => onUpdateBlock(block.id, {
                    content: { ...(block.content as any), fontSize: parseInt(e.target.value) }
                  } as any)}
                  style={{
                    ...selectStyle,
                    appearance: 'none',
                    paddingRight: '24px',
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

              <div style={{ width: '1px', backgroundColor: '#475569', margin: '0 4px' }} />

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

            {/* Fill / Text Color Row (skryto pro free-canvas - je výše) */}
            {block.type !== 'free-canvas' && <div style={{ marginBottom: '12px', position: 'relative' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
              {/* Text color */}
              <ColorPickerField
                value={(block.content as any)?.textColor || '#000000'}
                placeholder="Vlastní barva"
                defaultCustomColor="#000000"
                onChange={(color) => onUpdateBlock(block.id, {
                  content: { ...(block.content as any), textColor: color }
                } as any)}
              />
              {showBlockAppearanceToggle && (
                <button
                  onClick={onToggleBlockAppearance}
                  style={{
                    ...buttonStyle,
                    flex: 1,
                    justifyContent: 'space-between',
                    backgroundColor: isBlockAppearanceOpen ? '#334155' : '#334155',
                    border: isBlockAppearanceOpen ? '1px solid #5C5CFF' : '1px solid transparent',
                    color: '#E5E5E5',
                    padding: '6px 10px',
                  }}
                >
                  <span style={{ whiteSpace: 'nowrap' }}>Vzhled bloku</span>
                  <ChevronDownIcon size={14} style={{ transform: isBlockAppearanceOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                </button>
              )}
              {/* Circle color – only for free-answer */}
              {block.type === 'free-answer' && (
                <ColorPickerField
                  value={(block.content as any)?.circleColor || '#1e293b'}
                  placeholder="Kroužek"
                  defaultCustomColor="#1e293b"
                  align="right"
                  onChange={(color) => onUpdateBlock(block.id, { content: { ...(block.content as any), circleColor: color } } as any)}
                />
              )}
              </div>
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
                  <ColorPickerField
                    value={(block.content as any)?.circleColor || '#1e293b'}
                    placeholder="Barva"
                    defaultCustomColor="#1e293b"
                    onChange={(color) => onUpdateBlock(block.id, {
                      content: { ...(block.content as any), circleColor: color }
                    } as any)}
                  />

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

          </div>
        )}


    </>
  );
}
