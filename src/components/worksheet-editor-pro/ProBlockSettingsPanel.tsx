/**
 * ProBlockSettingsPanel - Dark mode block settings panel for PRO editor
 * 
 * Simplified version of BlockSettingsOverlay with dark theme.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { BoardSettingsSection } from './block-settings/BoardSettingsSection';
import { MultipleChoiceSettings } from './block-settings/MultipleChoiceSettings';
import { ImageBlockSettings } from './block-settings/ImageBlockSettings';
import { FreeAnswerSettings } from './block-settings/FreeAnswerSettings';
import { BlockImageEditor } from './block-settings/BlockImageEditor';
import { TextSectionSettings } from './block-settings/TextSectionSettings';
import { VisualStylesSection } from './block-settings/VisualStylesSection';
import { CompareCountsMiniAppSettings } from './mini-apps/CompareCountsMiniAppSettings';
import { PisankaMiniAppSettings } from './mini-apps/PisankaMiniAppSettings';
import { ColorPickerField } from './block-settings/ColorPickerField';
import {
  FONT_FAMILIES,
  FONT_SIZES,
  SIDEBAR_COLORS,
  sidebarPanelStyle,
  sidebarContentStyle,
  sectionBlockStyle,
  subtleCardStyle,
  inputStyle,
  labelStyle,
  buttonStyle,
  iconButtonStyle,
  getButtonVariantStyle,
  getSegmentedButtonStyle,
} from './block-settings/shared';
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
  BarChart2,
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
  TableBlock,
  TableContent,
  ChoiceOption,
  MultipleChoiceContent,
  FreeAnswerContent,
  ParagraphContent,
} from '../../types/worksheet';
import { toast } from 'sonner';
import { AssetPicker } from '../shared/AssetPicker';
import type { AssetPickerResult } from '../../types/assets';
import { ImageEditModal } from './ImageEditModal';
import { getQuestionHtml, richHtmlToPlainText } from '../../utils/worksheet-text';
import {
  getLayoutSectionColumnIds,
  normalizeLayoutSectionContent,
} from '../../utils/layout-sections';
import {
  getTextFlowLineStep,
  getTextFlowNaturalFrameHeight,
  resolveTextFlowCombinedHeight,
  supportsTextFlow,
} from '../../utils/text-flow';
import { buildPisankaHtml, mergePisankaMiniApp } from '../../utils/mini-apps/pisanka';

// Asset picker context types
type AssetPickerContext = 
  | { type: 'image-block' }
  | { type: 'gallery-image-add' }
  | { type: 'gallery-image-replace'; imageIndex: number }
  | { type: 'mc-option'; optionIndex: number }
  | { type: 'canvas-image' }
  | { type: 'sub-question-image'; subQuestionIndex: number }
  | { type: 'block-image-set' }
  | { type: 'block-image-gallery-add' }
  | { type: 'block-image-gallery-replace'; imageIndex: number }
  | { type: 'pisanka-row-image'; rowIndex: number };

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
  allBlocks?: WorksheetBlock[];
  onClose: () => void;
  onUpdateBlock: (id: string, updates: Partial<WorksheetBlock>) => void;
  onUpdateTextFlowFrameHeight?: (id: string, height?: number, options?: { reflow?: boolean }) => void;
  onApplyGroupLayout?: (id: string, mode: 'full' | 'half' | 'third') => void;
  onDeleteBlock: (id: string) => void;
  onDuplicateBlock: (id: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  gridColumns?: number;
  pageColumnLayout?: 'single' | 'two-columns';
  twoColumnASpan?: number;
  datasetImages?: Array<{ url: string; title?: string; alt?: string }>;
  designSystem?: import('../../types/design-system').DesignSystem | null;
}

const BLOCK_ICONS: Record<BlockType, typeof Type> = {
  'heading': Type,
  'paragraph': AlignLeft,
  'infobox': Info,
  'layout-section': LayoutGrid,
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
  'chart': BarChart2,
};

const BLOCK_LABELS: Record<BlockType, string> = {
  'heading': 'Nadpis',
  'paragraph': 'Odstavec',
  'infobox': 'Infobox',
  'layout-section': 'Layout sekce',
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
  'chart': 'Graf a data',
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

// ──────────────────────────────────────────────────────────────────────────────

export function ProBlockSettingsPanel({
  block,
  onClose,
  onUpdateBlock,
  onUpdateTextFlowFrameHeight,
  onApplyGroupLayout,
  onDeleteBlock,
  onDuplicateBlock,
  allBlocks,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  gridColumns = 12,
  pageColumnLayout = 'single',
  twoColumnASpan,
  datasetImages,
  designSystem,
}: ProBlockSettingsPanelProps) {
  const isTwoColPage = pageColumnLayout === 'two-columns';
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDissolveGroupLayout, setConfirmDissolveGroupLayout] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  useEffect(() => {
    setConfirmDissolveGroupLayout(false);
  }, [block.id, block.layoutSectionId]);
  const [showVisualAdvanced, setShowVisualAdvanced] = useState(false);
  const [showVisualStylesSection, setShowVisualStylesSection] = useState(false);
  const supportsInlineTextAppearance = ['heading', 'paragraph', 'infobox', 'fill-blank', 'free-answer', 'multiple-choice', 'free-canvas'].includes(block.type);

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
      case 'pisanka-row-image': {
        const pc = block.content as ParagraphContent;
        const mini = mergePisankaMiniApp(undefined, (pc.miniApp as any) ?? {});
        const rows = mini.rows.map((r) => ({ ...r }));
        const idx = assetPickerContext.rowIndex;
        if (idx >= 0 && idx < rows.length) {
          rows[idx] = { ...rows[idx], imageUrl: result.url, imageEnabled: true, allowRowImage: true };
          const nextMini = mergePisankaMiniApp(mini, { rows });
          onUpdateBlock(block.id, {
            content: {
              ...pc,
              miniApp: nextMini,
              html: buildPisankaHtml(nextMini),
            } as ParagraphContent,
          });
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

  
  const Icon = BLOCK_ICONS[block.type] || Type;
  const label = BLOCK_LABELS[block.type] || block.type;
  const canChangeBlockType = (
    block.type === 'heading' ||
    block.type === 'paragraph' ||
    block.type === 'infobox' ||
    block.type === 'free-answer' ||
    block.type === 'multiple-choice'
  );
  const currentLayoutSection = block.layoutSectionId
    ? (allBlocks || []).find((section) => section.id === block.layoutSectionId && section.type === 'layout-section') || null
    : null;
  const currentLayoutSectionContent = currentLayoutSection
    ? normalizeLayoutSectionContent(currentLayoutSection.content)
    : null;
  const currentGroupLayoutMode: 'full' | 'half' | 'third' = currentLayoutSectionContent
    ? (currentLayoutSectionContent.columns === 3 ? 'third' : 'half')
    : 'full';
  const isGroupLayoutEnabled = currentGroupLayoutMode !== 'full';
  const paragraphColumns = block.type === 'paragraph' ? (((block as ParagraphBlock).content as any).columns || 1) : 1;
  const paragraphMiniType =
    block.type === 'paragraph' ? ((block as ParagraphBlock).content as any)?.miniApp?.type : undefined;
  const isCompareCountsMini = paragraphMiniType === 'compare-counts';
  const isPisankaMini = paragraphMiniType === 'pisanka';
  const isRichParagraphMini = isCompareCountsMini || isPisankaMini;
  const hasTextFlowSupport = supportsTextFlow(block);
  const measuredTextFlowNaturalHeight = useMemo(() => {
    if (!hasTextFlowSupport) return 0;
    return getTextFlowNaturalFrameHeight(block.id, block.textFlowFrameHeight ?? 180);
  }, [block.id, block.textFlowFrameHeight, hasTextFlowSupport]);
  const measuredTextFlowLineStep = useMemo(() => {
    if (!hasTextFlowSupport) return 24;
    return getTextFlowLineStep(block.id, 24);
  }, [block.id, hasTextFlowSupport]);
  const textFlowBaseHeight = hasTextFlowSupport
    ? (block.textFlowFrameHeight ?? measuredTextFlowNaturalHeight ?? 180)
    : 0;
  const combinedTextFlowHeight = hasTextFlowSupport
    ? textFlowBaseHeight + (block.marginBottom || 0)
    : 0;
  const headingBlock = block.type === 'heading' ? (block as HeadingBlock) : null;
  const currentHeadingStyle = headingBlock?.content.headingStyle || 'plain';
  const currentHeadingHighlight = headingBlock?.content.highlightColor || 'transparent';
  const headingHighlightColors = [
    { label: 'Zelená', value: '#dcfce7' },
    { label: 'Modrá', value: '#dbeafe' },
    { label: 'Žlutá', value: '#fef3c7' },
    { label: 'Fialová', value: '#f3e8ff' },
    { label: 'Růžová', value: '#fce7f3' },
    { label: 'Červená', value: '#fee2e2' },
    { label: 'Tyrkys', value: '#cffafe' },
    { label: 'Šedá', value: '#e2e8f0' },
  ];

  const renderTypeSpecificSettings = () => {
    switch (block.type) {
      case 'layout-section': {
        const layoutContent = normalizeLayoutSectionContent((block as any).content);
        const columnIds = getLayoutSectionColumnIds(layoutContent.columns);
        return (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Sloupce</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {([2, 3] as const).map((columns) => {
                  const active = layoutContent.columns === columns;
                  return (
                  <button
                      key={columns}
                    onClick={() => onUpdateBlock(block.id, {
                        content: {
                          ...layoutContent,
                          columns,
                          layoutStyle: columns === 3 ? 'equal' : layoutContent.layoutStyle,
                        },
                      } as any)}
                      style={{ ...getSegmentedButtonStyle(active), flex: 1, justifyContent: 'center' }}
                    >
                      {columns} sloupce
                  </button>
                  );
                })}
              </div>
            </div>

            {layoutContent.columns === 2 && (
            <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Poměr sloupců</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([
                    { value: 'equal', label: '1:1' },
                    { value: 'sidebar-left', label: 'Širší vlevo' },
                    { value: 'sidebar-right', label: 'Širší vpravo' },
                  ] as const).map((option) => (
                  <button
                      key={option.value}
                      onClick={() => onUpdateBlock(block.id, { content: { ...layoutContent, layoutStyle: option.value } } as any)}
                      style={{ ...getSegmentedButtonStyle(layoutContent.layoutStyle === option.value), flex: 1, justifyContent: 'center', fontSize: 10 }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
                <span>Gap sloupců</span>
                <span style={{ color: '#94a3b8' }}>{layoutContent.columnGap ?? 16}px</span>
              </label>
              <input
                type="range"
                min={8}
                max={40}
                step={2}
                value={layoutContent.columnGap ?? 16}
                onChange={(e) => onUpdateBlock(block.id, { content: { ...layoutContent, columnGap: parseInt(e.target.value, 10) } } as any)}
                style={{ width: '100%', accentColor: '#5C5CFF', cursor: 'pointer' }}
              />
              </div>

            <div style={{ marginBottom: '6px' }}>
              <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
                <span>Min. výška</span>
                <span style={{ color: '#94a3b8' }}>{layoutContent.minHeight ?? 180}px</span>
              </label>
              <input
                type="range"
                min={120}
                max={420}
                step={10}
                value={layoutContent.minHeight ?? 180}
                onChange={(e) => onUpdateBlock(block.id, { content: { ...layoutContent, minHeight: parseInt(e.target.value, 10) } } as any)}
                style={{ width: '100%', accentColor: '#5C5CFF', cursor: 'pointer' }}
              />
            </div>

            <div style={{ ...subtleCardStyle, fontSize: 11, color: '#94a3b8', lineHeight: 1.45 }}>
              {columnIds.length} sloupce, bloky se skládají pod sebe. Obsah přiřadíš níž u každého bloku.
            </div>
          </>
        );
      }

      case 'heading': {
        return null;
      }

      case 'paragraph': {
        return null;
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
        const dsSwatches = designSystem?.colors.flatMap((group) => group.swatches) ?? [];

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
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 10, color: '#808080', display: 'block', marginBottom: 4 }}>Pozadí</span>
                    <ColorPickerField
                      value={block.visualStyles?.backgroundColor}
                      placeholder="Vlastní barva"
                      designSystemSwatches={dsSwatches}
                      defaultCustomColor="#ffffff"
                      onChange={(color) => onUpdateBlock(block.id, {
                        visualStyles: { ...block.visualStyles, backgroundColor: color }
                      })}
                      onClear={() => onUpdateBlock(block.id, {
                        visualStyles: { ...block.visualStyles, backgroundColor: undefined }
                      })}
                    />
                  </div>
                  {/* Border color */}
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 10, color: '#808080', display: 'block', marginBottom: 4 }}>Ohraničení</span>
                    <ColorPickerField
                      value={block.visualStyles?.borderColor}
                      placeholder="Vlastní barva"
                      designSystemSwatches={dsSwatches}
                      defaultCustomColor="#3b82f6"
                      swatchStyle="border"
                      borderStyle={block.visualStyles?.borderStyle || 'solid'}
                      onChange={(color) => onUpdateBlock(block.id, {
                        visualStyles: {
                          ...block.visualStyles,
                          borderColor: color,
                          borderWidth: block.visualStyles?.borderWidth || 2,
                          borderStyle: block.visualStyles?.borderStyle || 'solid',
                        }
                      })}
                      onClear={() => onUpdateBlock(block.id, {
                        visualStyles: { ...block.visualStyles, borderColor: undefined, borderWidth: undefined, borderStyle: undefined }
                      })}
                    />
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

      case 'image':
        return <ImageBlockSettings block={block} onUpdateBlock={onUpdateBlock} openAssetPicker={openAssetPicker} />;

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

      case 'table': {
        const tableBlock = block as TableBlock;
        const tc = tableBlock.content as TableContent;
        const currentFontSize = tc.fontSize || 'base';
        const currentDensity = tc.density || 'normal';

        const updateTable = (patch: Partial<TableContent>) =>
          onUpdateBlock(block.id, { content: { ...tc, ...patch } } as Partial<TableBlock>);

        return (
          <>
            {/* Font size */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Velikost textu</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {([
                  { value: 'xs', label: 'XS' },
                  { value: 'sm', label: 'S' },
                  { value: 'base', label: 'M' },
                  { value: 'lg', label: 'L' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateTable({ fontSize: opt.value })}
                    style={{
                      ...buttonStyle,
                      flex: 1,
                      justifyContent: 'center',
                      backgroundColor: currentFontSize === opt.value ? '#5C5CFF' : '#334155',
                      color: currentFontSize === opt.value ? 'white' : '#94a3b8',
                      fontWeight: currentFontSize === opt.value ? 700 : 400,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Density */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Prostor buněk</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {([
                  { value: 'compact', label: 'Kompakt' },
                  { value: 'normal', label: 'Střední' },
                  { value: 'spacious', label: 'Vzdušný' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateTable({ density: opt.value })}
                    style={{
                      ...buttonStyle,
                      flex: 1,
                      justifyContent: 'center',
                      fontSize: 10,
                      padding: '4px 2px',
                      backgroundColor: currentDensity === opt.value ? '#5C5CFF' : '#334155',
                      color: currentDensity === opt.value ? 'white' : '#94a3b8',
                      fontWeight: currentDensity === opt.value ? 700 : 400,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {currentDensity === 'compact' && (
                <p style={{ fontSize: 9, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
                  Kompaktní mód — šířka sloupců se přizpůsobí obsahu.
                </p>
              )}
            </div>
          </>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div style={sidebarPanelStyle}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      {/* ── Změnit typ bloku ──────────────────────────────────────────────────── */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${SIDEBAR_COLORS.panelBorder}`, backgroundColor: '#182235', flexShrink: 0 }}>
            <button
              onClick={() => {
              if (canChangeBlockType) {
                setShowTypePicker((p) => !p);
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', background: 'none', border: 'none', cursor: canChangeBlockType ? 'pointer' : 'default',
              padding: '4px 0', color: '#94a3b8',
            }}
          >
            <span style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748b' }}>
              Typ bloku
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  ...getSegmentedButtonStyle(true),
                  flex: '0 0 auto',
                  minHeight: 30,
                  padding: '0 12px',
                  gap: 8,
                  borderRadius: 10,
                }}
              >
                <Icon size={14} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'inherit' }}>
                {BLOCK_LABELS[block.type]}
              </span>
              </div>
              {canChangeBlockType && (
              <ChevronDownIcon size={12} style={{ color: '#64748b', transform: showTypePicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              )}
            </div>
          </button>

          {canChangeBlockType && showTypePicker && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {(['heading', 'paragraph', 'infobox', 'free-answer', 'multiple-choice'] as const).map(targetType => {
                const TIcon = BLOCK_ICONS[targetType];
                const isActive = block.type === targetType;

                // Helper: extract plain question/text from any source block
                const extractText = (): string => {
                  if (block.type === 'heading')        return (block as HeadingBlock).content.text || '';
                  if (block.type === 'paragraph')      return ((block as ParagraphBlock).content.html || '').replace(/<[^>]+>/g, '').trim();
                  if (block.type === 'infobox')        return (block as InfoboxBlock).content.title || ((block as InfoboxBlock).content.html || '').replace(/<[^>]+>/g, '').trim();
                  if (block.type === 'free-answer')    return richHtmlToPlainText(getQuestionHtml((block as FreeAnswerBlock).content));
                  if (block.type === 'multiple-choice') return richHtmlToPlainText(getQuestionHtml((block as MultipleChoiceBlock).content));
                  return '';
                };

                // Helper: extract HTML from source block
                const extractHtml = (): string => {
                  if (block.type === 'heading')        return `<p>${(block as HeadingBlock).content.text || ''}</p>`;
                  if (block.type === 'paragraph')      return (block as ParagraphBlock).content.html || '';
                  if (block.type === 'infobox') {
                    const ib = block as InfoboxBlock;
                    return [ib.content.title ? `<p><strong>${ib.content.title}</strong></p>` : '', ib.content.html || ''].filter(Boolean).join('\n');
                  }
                  if (block.type === 'free-answer')    return getQuestionHtml((block as FreeAnswerBlock).content);
                  if (block.type === 'multiple-choice') return getQuestionHtml((block as MultipleChoiceBlock).content);
                  return '';
                };

                return (
                  <button
                    key={targetType}
                    onClick={() => {
                      if (isActive) { setShowTypePicker(false); return; }

                      let updates: Partial<WorksheetBlock>;

                      if (targetType === 'heading') {
                        updates = { type: 'heading', content: { text: extractText(), level: 'h2', headingStyle: 'plain' } } as any;

                      } else if (targetType === 'paragraph') {
                        updates = { type: 'paragraph', content: { html: extractHtml() } } as any;

                      } else if (targetType === 'infobox') {
                        const titleSrc = (block.type === 'heading' || block.type === 'free-answer' || block.type === 'multiple-choice')
                          ? extractText() : (block as InfoboxBlock).content?.title || '';
                        const htmlSrc = (block.type === 'paragraph') ? (block as ParagraphBlock).content.html
                          : (block.type === 'infobox') ? (block as InfoboxBlock).content.html
                          : '';
                        updates = { type: 'infobox', content: { title: titleSrc, html: htmlSrc || '', variant: 'blue' } } as any;

                      } else if (targetType === 'free-answer') {
                        const freeContent: FreeAnswerContent = {
                          question: extractText(),
                          questionHtml: extractHtml(),
                          lines: 3,
                        };
                        updates = { type: 'free-answer', content: freeContent } as any;

                      } else {
                        // multiple-choice
                        const opts: ChoiceOption[] = [
                          { id: generateBlockId(), text: '' },
                          { id: generateBlockId(), text: '' },
                          { id: generateBlockId(), text: '' },
                        ];
                        const mcContent: MultipleChoiceContent = {
                          question: extractText(),
                          questionHtml: extractHtml(),
                          options: opts,
                          correctAnswers: [],
                          allowMultiple: false,
                          layout: 'vertical',
                          visualStyle: 'list',
                        };
                        updates = { type: 'multiple-choice', content: mcContent } as any;
                      }

                      onUpdateBlock(block.id, updates);
                      setShowTypePicker(false);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', borderRadius: 8, border: 'none',
                      cursor: isActive ? 'default' : 'pointer', fontSize: 11, fontWeight: 500,
                      backgroundColor: isActive ? '#5C5CFF' : '#1e293b',
                      color: isActive ? 'white' : '#cbd5e1',
                      outline: isActive ? 'none' : '1px solid #334155',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#273549'; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1e293b'; }}
                  >
                    <TIcon size={13} />
                    {BLOCK_LABELS[targetType]}
                  </button>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div style={{
            padding: '14px 0 0',
            marginTop: 14,
            borderTop: `1px solid ${SIDEBAR_COLORS.panelBorder}`,
            display: 'flex',
            gap: '8px',
            flexShrink: 0,
            backgroundColor: '#182235',
            alignItems: 'center',
          }}>
            <button
              onClick={() => onMoveUp?.(block.id)}
              disabled={!canMoveUp}
              style={{
                ...iconButtonStyle,
                ...getButtonVariantStyle(true, 'warning'),
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
                ...iconButtonStyle,
                ...getButtonVariantStyle(true, 'warning'),
                opacity: canMoveDown ? 1 : 0.4,
                cursor: canMoveDown ? 'pointer' : 'not-allowed',
              }}
            >
              <ChevronDown size={14} />
            </button>
            <button
              onClick={() => onDuplicateBlock(block.id)}
              style={{ ...buttonStyle, minWidth: 112, justifyContent: 'center' }}
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
                    ...getButtonVariantStyle(true, 'danger'),
                  }}
                >
                  Potvrdit
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  ...iconButtonStyle,
                  color: SIDEBAR_COLORS.danger,
                }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          {block.type !== 'layout-section' && (
            <div style={{ ...sectionBlockStyle, backgroundColor: '#182235' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Skupinovy layout</label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isGroupLayoutEnabled}
                  onClick={() => {
                    if (isGroupLayoutEnabled) {
                      if (block.layoutSectionId) {
                        setConfirmDissolveGroupLayout(true);
                        return;
                      }
                      onApplyGroupLayout?.(block.id, 'full');
                      return;
                    }
                    onApplyGroupLayout?.(block.id, currentGroupLayoutMode === 'third' ? 'third' : 'half');
                  }}
                  style={{
                    position: 'relative',
                    width: 42,
                    height: 24,
                    borderRadius: 999,
                    border: `1px solid ${isGroupLayoutEnabled ? '#818cf8' : SIDEBAR_COLORS.controlBorder}`,
                    backgroundColor: isGroupLayoutEnabled ? SIDEBAR_COLORS.accent : SIDEBAR_COLORS.panelSoft,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease, border-color 0.15s ease',
                    flexShrink: 0,
                  }}
                  title={isGroupLayoutEnabled ? 'Vypnout skupinovy layout' : 'Zapnout skupinovy layout'}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: isGroupLayoutEnabled ? 20 : 2,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.35)',
                      transition: 'left 0.15s ease',
                    }}
                  />
                </button>
              </div>
              {confirmDissolveGroupLayout && (
                <div
                  style={{
                    ...subtleCardStyle,
                    marginBottom: 8,
                    borderColor: 'rgba(245, 158, 11, 0.5)',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  }}
                >
                  <div style={{ fontSize: 11, color: SIDEBAR_COLORS.text, lineHeight: 1.45, marginBottom: 10 }}>
                    Rozpuštěním skupinového layoutu zrušíš rozložení pro celou tuto skupinu bloků.
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setConfirmDissolveGroupLayout(false)}
                      style={{ ...buttonStyle, flex: 1, justifyContent: 'center' }}
                    >
                      Zrušit
                    </button>
                    <button
                      onClick={() => {
                        setConfirmDissolveGroupLayout(false);
                        onApplyGroupLayout?.(block.id, 'full');
                      }}
                      style={{ ...buttonStyle, ...getButtonVariantStyle(true, 'warning'), flex: 1, justifyContent: 'center' }}
                    >
                      Rozpustit
                    </button>
                  </div>
                </div>
              )}
              {isGroupLayoutEnabled && (
                <div style={{ ...subtleCardStyle, padding: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                  {([
                    { id: 'half', label: '2 sloupce', columns: 2 },
                    { id: 'third', label: '3 sloupce', columns: 3 },
                  ] as const).map((option) => {
                    const active = currentGroupLayoutMode === option.id;
                    const selectableColumnIds = getLayoutSectionColumnIds(option.columns as 2 | 3);
                    const activeColumnId = (block.layoutColumnId ?? 'col-1') as (typeof selectableColumnIds)[number] | 'col-1';
                    return (
                      <button
                        key={option.id}
                        onClick={() => onApplyGroupLayout?.(block.id, option.id)}
                        style={{
                          ...getSegmentedButtonStyle(active),
                          minHeight: 74,
                          padding: '8px 6px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 7,
                          borderRadius: 10,
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            height: 28,
                            borderRadius: 8,
                            border: `1px solid ${active ? 'rgba(199, 210, 254, 0.8)' : SIDEBAR_COLORS.controlBorder}`,
                            display: 'flex',
                            gap: 4,
                            padding: 4,
                            background: active ? 'rgba(255,255,255,0.08)' : SIDEBAR_COLORS.panelAlt,
                          }}
                        >
                          {Array.from({ length: option.columns }).map((_, index) => {
                            const columnId = selectableColumnIds[index];
                            const isColumnActive = active && columnId && activeColumnId === columnId;
                            return (
                              <div
                                key={index}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onApplyGroupLayout?.(block.id, option.id);
                                  if (columnId) {
                                    onUpdateBlock(block.id, { layoutColumnId: columnId, layoutOrder: undefined });
                                  }
                                }}
                                style={{
                                  flex: 1,
                                  borderRadius: 4,
                                  backgroundColor: isColumnActive
                                    ? 'rgba(255,255,255,0.92)'
                                    : active
                                      ? 'rgba(191, 219, 254, 0.38)'
                                      : index === 0
                                        ? 'rgba(226,232,240,0.92)'
                                        : 'rgba(148,163,184,0.28)',
                                  boxShadow: isColumnActive ? 'inset 0 0 0 1px rgba(99,102,241,0.2)' : 'none',
                                  cursor: 'pointer',
                                }}
                              />
                            );
                          })}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>{option.label}</span>
                      </button>
                    );
                  })}
                  </div>
        </div>
      )}

            </div>
          )}
        </div>

      {/* ── A / B přiřazení (jen když stránka používá two-column layout) ──────── */}
      {isTwoColPage && (
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${SIDEBAR_COLORS.panelBorder}`, backgroundColor: SIDEBAR_COLORS.panelAlt, flexShrink: 0 }}>
          <label style={{ ...labelStyle, marginBottom: 6, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '9px' }}>
            ⬚ Sloupec
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['A', 'B'] as const).map((col) => {
              const isActive = (block.columnAssignment ?? 'A') === col;
              const colColor = col === 'A' ? '#10b981' : '#3b82f6';
              const aSpan = twoColumnASpan ?? Math.round(gridColumns / 2);
              const colSpan = col === 'A' ? aSpan : gridColumns - aSpan;
              return (
                      <button
                  key={col}
                  onClick={() => onUpdateBlock(block.id, { columnAssignment: col })}
                        style={{
                  flex: 1,
                          padding: '8px 4px',
                    backgroundColor: isActive ? colColor : '#334155',
                    color: isActive ? 'white' : '#94a3b8',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '13px',
                    transition: 'all 0.15s ease',
                          }}
                        >
                  {col} <span style={{ fontSize: '10px', opacity: 0.75 }}>({colSpan} sl.)</span>
                        </button>
              );
            })}
                      </div>
          </div>
        )}

      {/* Content */}
      <div style={{ ...sidebarContentStyle, overflowY: 'visible' }}>

        {/* Typ bloku (Aktivita/Informace) - úplně nahoře pro free-canvas */}
            {block.type === 'free-canvas' && (
          <div style={{ ...subtleCardStyle, marginBottom: 12 }}>
            <label style={labelStyle}>Režim bloku</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => onUpdateBlock(block.id, { noActivityNumber: false } as any)}
                style={{
                  ...getSegmentedButtonStyle(!block.noActivityNumber),
                }}
              >
                Aktivita
              </button>
              <button
                onClick={() => onUpdateBlock(block.id, { noActivityNumber: true } as any)}
                style={{
                  ...getSegmentedButtonStyle(!!block.noActivityNumber),
                }}
              >
                Informace
              </button>
            </div>
          </div>
        )}

        {/* Type-specific settings (heading levels, paragraph convert, spacer styles...) */}
        {renderTypeSpecificSettings()}

        {/* ABC Question specific settings */}
        {block.type === 'multiple-choice' && (
          <MultipleChoiceSettings
            block={block}
            onUpdateBlock={onUpdateBlock}
            openAssetPicker={openAssetPicker}
          />
        )}

        {/* Miniaplikace: porovnávání počtů — vlastní sekce místo editoru odstavce */}
        {isCompareCountsMini && (
          <CompareCountsMiniAppSettings block={block} onUpdateBlock={onUpdateBlock} />
        )}
        {isPisankaMini && (
          <PisankaMiniAppSettings block={block} onUpdateBlock={onUpdateBlock} openAssetPicker={openAssetPicker} />
        )}

        {/* TEXT Section - typography, colors, figma (for text-based blocks) */}
        {!isRichParagraphMini && (
          <TextSectionSettings
            block={block}
            onUpdateBlock={onUpdateBlock}
            openAssetPicker={openAssetPicker}
            showBlockAppearanceToggle={supportsInlineTextAppearance}
            isBlockAppearanceOpen={showVisualStylesSection}
            onToggleBlockAppearance={() => setShowVisualStylesSection((prev) => !prev)}
          />
        )}

        {headingBlock && (
          <div style={sectionBlockStyle}>
            {currentHeadingStyle !== 'plain' && (
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Barva stylu</label>
                <ColorPickerField
                  value={currentHeadingHighlight}
                  palette={headingHighlightColors}
                  placeholder="Vlastní barva"
                  defaultCustomColor="#dbeafe"
                  onChange={(color) => onUpdateBlock(block.id, {
                    content: { ...headingBlock.content, highlightColor: color }
                  } as Partial<HeadingBlock>)}
                />
              </div>
            )}
            <div>
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
                      content: opt.value === 'plain'
                        ? {
                            ...headingBlock.content,
                            headingStyle: undefined,
                            highlightColor: undefined,
                          }
                        : {
                            ...headingBlock.content,
                            headingStyle: opt.value,
                          }
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
          </div>
        )}

        {/* Visual Styles Section */}
        <VisualStylesSection
          block={block}
          onUpdateBlock={onUpdateBlock}
          showVisualAdvanced={showVisualAdvanced}
          setShowVisualAdvanced={setShowVisualAdvanced}
          designSystem={designSystem}
          compact={supportsInlineTextAppearance}
          isSectionOpen={showVisualStylesSection}
        />

        {hasTextFlowSupport && (
          <div style={sectionBlockStyle}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}>
              <span style={labelStyle}>Výška textu + prostoru pod blokem</span>
              <span style={{ fontSize: '10px', color: '#CCCCCC' }}>
                {combinedTextFlowHeight}px
              </span>
            </div>
            <input
              type="range"
              min="36"
              max="1500"
              step="10"
              value={combinedTextFlowHeight}
              onChange={(e) => {
                const nextValue = parseInt(e.target.value, 10);
                const { frameHeight, marginBottom } = resolveTextFlowCombinedHeight(
                  nextValue,
                  measuredTextFlowNaturalHeight,
                  measuredTextFlowLineStep,
                );
                onUpdateTextFlowFrameHeight?.(block.id, frameHeight);
                onUpdateBlock(block.id, { marginBottom });
              }}
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
        )}

        <div style={sectionBlockStyle}>
          {!hasTextFlowSupport && (
            <>
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
                  marginBottom: parseInt(e.target.value, 10),
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
            </>
          )}

          {(block.marginBottom || 0) > 0 && (
            <div style={{ ...subtleCardStyle, marginTop: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { value: 'empty', label: 'Prázdný', icon: null },
                  { value: 'dotted', label: 'Tečky', icon: 'dots' },
                  { value: 'lined', label: 'Linky', icon: 'lines' },
                ].map((styleOption) => (
                  <button
                    key={styleOption.value}
                    onClick={() => onUpdateBlock(block.id, { marginStyle: styleOption.value as any })}
                    style={{
                      ...buttonStyle,
                      flex: 1,
                      flexDirection: 'column',
                      height: '42px',
                      justifyContent: 'center',
                      ...getSegmentedButtonStyle((block.marginStyle || 'empty') === styleOption.value),
                      padding: '4px',
                      gap: '0',
                    }}
                    title={styleOption.label}
                  >
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
                          backgroundSize: '6px 6px',
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

          {block.type === 'paragraph' && (
            <div style={{ marginTop: '16px' }}>
              {!isRichParagraphMini && (
                <>
                  <label style={labelStyle}>SLOUPCE TEXTU</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1, 2, 3].map((col) => (
                      <button
                        key={col}
                        onClick={() => onUpdateBlock(block.id, {
                          content: { ...(block as ParagraphBlock).content, columns: col } as any,
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
                </>
              )}

              <div style={{ marginTop: !isRichParagraphMini ? '14px' : 0 }}>
                <label style={labelStyle}>Odsazení obsahu</label>
                <div style={{ ...subtleCardStyle, padding: '10px 12px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}>
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
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: '#5C5CFF',
                        opacity: 0.3,
                        transition: 'all 0.15s ease',
                      }} />
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
                    </div>

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
                        onChange={(e) => onUpdateBlock(block.id, { padding: parseInt(e.target.value, 10) })}
                        style={{
                          width: '100%',
                          height: '4px',
                          appearance: 'none',
                          backgroundColor: '#475569',
                          borderRadius: '2px',
                          cursor: 'pointer',
                        }}
                      />
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
            </div>
          )}
        </div>

        {/* FREE ANSWER settings (image editor + sub-questions) */}
        <FreeAnswerSettings block={block} onUpdateBlock={onUpdateBlock} openAssetPicker={openAssetPicker} />

        {/* ── BOARD SETTINGS ───────────────────────────────────────────────── */}
        <BoardSettingsSection block={block} allBlocks={allBlocks} onUpdateBlock={onUpdateBlock} />
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
        datasetImages={datasetImages}
      />
    </div>
  );
}
