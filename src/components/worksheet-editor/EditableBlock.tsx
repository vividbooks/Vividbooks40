/**
 * EditableBlock - Blok s inline editací v canvasu
 * 
 * Umožňuje editovat obsah bloků přímo v A4 náhledu
 */

import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, X, Check, Circle, Square, Type, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Copy, Trash2, ImageIcon, Table as TableIcon, QrCode, ArrowLeftRight, Bold, Italic, Underline, Info, LayoutGrid } from 'lucide-react';
import { WorksheetBlock, ChoiceOption, GlobalFontSize, SpacerStyle, ExamplesContent, MathExample, ExampleDifficulty, AnswerBoxStyle, ImageContent, ImageSize, BlockImage, TableContent, ConnectPairsContent, ImageHotspotsContent, VideoQuizContent, ConnectPairContent, WorksheetHotspot, WorksheetVideoQuestion, HeaderFooterContent, QRCodeContent, FreeCanvasContent, ChartContent, FreeAnswerSubQuestion, SubQuestionLabelType, SubQuestionLabelStyle } from '../../types/worksheet';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { FreeCanvasEditor } from './FreeCanvasEditor';
import { FreeCanvasFullscreen } from './FreeCanvasFullscreen';
import { PlayfulAnswersDisplay } from './PlayfulAnswersDisplay';
import { PlayfulImagesDisplay } from './PlayfulImagesDisplay';
import { QRCodeSVG } from 'qrcode.react';
import { LatexRenderer, preventOrphansInHtml } from './LatexRenderer';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { WorksheetTextToolbar } from './WorksheetTextToolbar';
import { TextSelectionBubble } from './TextSelectionBubble';
import { useAssetPicker } from '../../hooks/useAssetPicker';
import {
  getQuestionHtml,
  legacyQuestionStringToHtml,
  normalizeRichHtml,
  richHtmlToPlainText,
  setQuestionHtml,
} from '../../utils/worksheet-text';
import {
  buildCompareCountsHtml,
  mergeCompareCountsMiniApp,
} from '../../utils/mini-apps/compare-counts';
import { mergePisankaMiniApp, buildPisankaHtml, isPisankaParagraphBlock } from '../../utils/mini-apps/pisanka';
import { PisankaGuideDotsLayer } from './PisankaGuideDotsLayer';

function PrintSafePattern({ variant, lineSpacing = 40 }: { variant: 'dotted' | 'lined'; lineSpacing?: number }) {
  const id = useId().replace(/:/g, '');
  const patternId = `${variant}-pattern-${id}`;
  const dotColor = '#94a3b8';   // slate-400
  const lineColor = '#cbd5e1';  // slate-300

  if (variant === 'dotted') {
    return (
      <svg className="absolute inset-0 w-full h-full" aria-hidden="true" style={{ display: 'block' }}>
        <defs>
          <pattern id={patternId} patternUnits="userSpaceOnUse" width="16" height="16">
            <circle cx="2" cy="2" r="1" fill={dotColor} />
          </pattern>
        </defs>
        <rect y="12" width="100%" height="calc(100% - 12px)" fill={`url(#${patternId})`} />
      </svg>
    );
  }

  return (
    <svg className="absolute inset-0 w-full h-full" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width="1" height={lineSpacing}>
          <line x1="0" y1={lineSpacing - 1} x2="2000" y2={lineSpacing - 1} stroke={lineColor} strokeWidth="1" />
        </pattern>
      </defs>
      <rect y="8" width="100%" height="calc(100% - 8px)" fill={`url(#${patternId})`} />
    </svg>
  );
}

// Get font sizes based on global setting
const getFontSizes = (globalSize: GlobalFontSize = 'normal') => {
  const multipliers = {
    small: 0.7,
    normal: 0.85,
    large: 1.05,
  };
  const m = multipliers[globalSize];
  
  return {
    title: `${Math.round(14 * m)}pt`,    // base 14pt
    body: `${Math.round(12 * m)}pt`,     // base 12pt
    small: `${Math.round(9 * m)}pt`,     // base 9pt
    large: `${Math.round(14 * m)}pt`,    // base 14pt
    h1: `${Math.round(36 * m)}pt`,       // base 36pt (Nadpis 1)
    h2: `${Math.round(24 * m)}pt`,       // base 24pt (Nadpis 2)
    h3: `${Math.round(18 * m)}pt`,       // base 18pt (Nadpis 3)
  };
};

// Default font sizes
const FONT_SIZES = getFontSizes('normal');

// Consistent font family
const FONT_FAMILY = "'Fenomen Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

interface EditableBlockProps {
  block: WorksheetBlock;
  isSelected: boolean;
  isHovered?: boolean;
  onSelect: () => void;
  onUpdate: (content: any) => void;
  onUpdateMargin?: (marginBottom: number) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  globalFontSize?: GlobalFontSize;
  activityNumber?: number; // Number for activity blocks (multiple-choice, fill-blank, free-answer)
  /** If block is rendered in a side-by-side row, which column is it in? */
  columnPosition?: 'left' | 'right';
  onOpenAI?: () => void;
  onTextFlowBlur?: (blockId: string) => void;
  onTextFlowSplitAtCaret?: (blockId: string, charIndex: number, currentHtml?: string) => void;
}

export function EditableBlock({ block, isSelected, isHovered, onSelect, onUpdate, onUpdateMargin, onDelete, onDuplicate, onMoveLeft, onMoveRight, onMoveUp, onMoveDown, globalFontSize = 'normal', activityNumber, columnPosition, onOpenAI, onTextFlowBlur, onTextFlowSplitAtCaret }: EditableBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isResizingMargin, setIsResizingMargin] = useState(false);
  const [localMargin, setLocalMargin] = useState<number | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const [actionButtonsSide, setActionButtonsSide] = useState<'right' | 'left'>('right');
  const blockRef = useRef<HTMLDivElement>(null);

  // Check if this is a block that can be edited inline (shows toolbar or resize handles)
  const isTextBlock = ['heading', 'paragraph', 'infobox', 'multiple-choice', 'fill-blank', 'free-answer', 'spacer', 'image-hotspots', 'connect-pairs'].includes(block.type);

  // Check if we should show the text formatting toolbar
  const showTextToolbar = isEditing && isTextBlock && block.type !== 'spacer';

  // Current margin value - use local during drag
  const marginBottom = localMargin ?? block.marginBottom ?? 0;
  const marginStyle = block.marginStyle || 'empty';
  const verticalAlign = (block.content as any)?.verticalAlign || 'top';
  // Vertical alignment: shift text down using paddingTop, compensate by shrinking marginBottom div
  const vAlignTopPad = verticalAlign === 'center' ? Math.round(marginBottom / 2)
    : verticalAlign === 'bottom' ? marginBottom : 0;
  const vAlignBottomMargin = marginBottom - vAlignTopPad;

  // Sync isEditing with isSelected from parent to ensure only one toolbar is open
  useEffect(() => {
    if (isSelected && !isEditing) {
      setIsEditing(true);
    } else if (!isSelected && isEditing) {
      setIsEditing(false);
    }
  }, [isSelected]);

  // Global click handler to close toolbar when clicking outside the canvas
  useEffect(() => {
    if (!isEditing) return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // If the target is no longer in the document, it might have been a dropdown item
      // that was just removed. In this case, we should assume it was a valid click inside the toolbar.
      if (!document.contains(target)) {
        return;
      }

      // Check if clicking on this block
      const clickedOnBlock = target.closest(`[data-block-id="${block.id}"]`);
      // Check if clicking on the toolbar (either by class or by data attribute)
      const clickedOnToolbar = target.closest('.worksheet-text-toolbar') || 
                               target.closest('[data-toolbar-for-block]') ||
                               target.closest('[data-toolbar-element]');
      
      // Check if clicking on settings overlay
      const clickedOnSettings = target.closest('[data-settings-overlay]');
      
      // If clicking outside both the block and its toolbar/settings, close editing
      if (!clickedOnBlock && !clickedOnToolbar && !clickedOnSettings) {
        setIsEditing(false);
      }
    };

    // Use capture to catch clicks before they are stopped by other handlers
    document.addEventListener('mousedown', handleGlobalClick, true);
    return () => document.removeEventListener('mousedown', handleGlobalClick, true);
  }, [isEditing, block.id]);

  // Calculate toolbar position when editing starts
  useEffect(() => {
    if (isEditing && isTextBlock && blockRef.current) {
      const updatePosition = () => {
        const rect = blockRef.current?.getBoundingClientRect();
        if (rect) {
          setToolbarPosition({
            top: rect.top - 64, // 64px above the block (increased to avoid overlaps)
            left: rect.left + rect.width / 2, // Centered horizontally
          });
        }
      };
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isEditing, isTextBlock]);

  useEffect(() => {
    if (!isSelected || !blockRef.current) {
      setActionButtonsSide('right');
      return;
    }

    const updateActionButtonsPlacement = () => {
      const rect = blockRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mainRect = blockRef.current?.closest('main')?.getBoundingClientRect();
      const safeLeftEdge = (mainRect?.left ?? 0) + 12;
      const safeRightEdge = (mainRect?.right ?? window.innerWidth) - 12;
      const panelWidth = 88;
      const gap = 12;
      const hasRoomOnRight = rect.right + gap + panelWidth <= safeRightEdge;
      const hasRoomOnLeft = rect.left - gap - panelWidth >= safeLeftEdge;

      if (hasRoomOnRight || !hasRoomOnLeft) {
        setActionButtonsSide('right');
      } else {
        setActionButtonsSide('left');
      }
    };

    updateActionButtonsPlacement();
    window.addEventListener('resize', updateActionButtonsPlacement);
    window.addEventListener('scroll', updateActionButtonsPlacement, true);
    return () => {
      window.removeEventListener('resize', updateActionButtonsPlacement);
      window.removeEventListener('scroll', updateActionButtonsPlacement, true);
    };
  }, [isSelected]);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  // For legacy infobox blocks without visualStyles, derive them from the variant
  const getInfoboxFallbackStyles = (variant: string) => {
    const map: Record<string, { backgroundColor: string; borderColor: string; borderWidth: number; borderStyle: 'solid'; borderRadius: number }> = {
      blue:   { backgroundColor: '#dbeafe', borderColor: '#3b82f6', borderWidth: 2, borderStyle: 'solid', borderRadius: 12 },
      green:  { backgroundColor: '#dcfce7', borderColor: '#22c55e', borderWidth: 2, borderStyle: 'solid', borderRadius: 12 },
      yellow: { backgroundColor: '#fef9c3', borderColor: '#eab308', borderWidth: 2, borderStyle: 'solid', borderRadius: 12 },
      purple: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', borderWidth: 2, borderStyle: 'solid', borderRadius: 12 },
      orange: { backgroundColor: '#fff7ed', borderColor: '#f97316', borderWidth: 2, borderStyle: 'solid', borderRadius: 12 },
      red:    { backgroundColor: '#fee2e2', borderColor: '#ef4444', borderWidth: 2, borderStyle: 'solid', borderRadius: 12 },
      gray:   { backgroundColor: '#f1f5f9', borderColor: '#94a3b8', borderWidth: 2, borderStyle: 'solid', borderRadius: 12 },
      teal:   { backgroundColor: '#ccfbf1', borderColor: '#14b8a6', borderWidth: 2, borderStyle: 'solid', borderRadius: 12 },
    };
    return map[variant] || map['blue'];
  };

  // Get visual styles from block (for infobox type, use variant-derived styles as fallback)
  const rawVisualStyles = block.visualStyles || {};
  const visualStyles = (block.type === 'infobox' && !block.visualStyles)
    ? getInfoboxFallbackStyles((block.content as any).variant || 'blue')
    : rawVisualStyles;
  
  // Map shadow option to CSS box-shadow
  const getShadowStyle = (shadow?: 'none' | 'small' | 'medium' | 'large'): string => {
    switch (shadow) {
      case 'small': return '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)';
      case 'medium': return '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)';
      case 'large': return '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)';
      default: return 'none';
    }
  };

  // Check if visual styles require extra padding
  const hasVisualBackground = visualStyles.backgroundColor && visualStyles.backgroundColor !== 'transparent';
  const hasVisualBorder = visualStyles.borderColor && visualStyles.borderColor !== 'transparent';
  const hasVisualShadow = visualStyles.shadow && visualStyles.shadow !== 'none';

  // Determine padding: use block.padding if explicitly set (even 0), otherwise use visual style padding
  const blockPadding = block.padding;
  const isPisankaCanvasBlock = isPisankaParagraphBlock(block);
  let effectivePadding: string | undefined = blockPadding !== undefined
    ? blockPadding > 0
      ? `${blockPadding}px`
      : '0px'
    : hasVisualBackground || hasVisualBorder || hasVisualShadow
      ? '12px 16px'
      : undefined;
  /* Písanka: žádný padding obalu — vnější mezery řídí výhradně CSS proměnné (--vb-pisanka-page-outer-inset), aby byly stejné ze všech stran */
  if (isPisankaCanvasBlock) {
    effectivePadding = '0px';
  }

  // Build visual style object
  const visualStyleObj: React.CSSProperties = {
    backgroundColor: hasVisualBackground ? visualStyles.backgroundColor : undefined,
    border: hasVisualBorder ? `${visualStyles.borderWidth ?? 2}px solid ${visualStyles.borderColor}` : undefined,
    borderRadius: typeof visualStyles.borderRadius === 'number' ? `${visualStyles.borderRadius}px` : undefined,
    boxShadow: getShadowStyle(visualStyles.shadow),
    // Apply padding from block settings or visual styles
    padding: effectivePadding,
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    ...(vAlignTopPad > 0 ? { paddingTop: vAlignTopPad } : {}),
    ...visualStyleObj,
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
    // Single click to edit for text blocks
    if (isTextBlock) {
      setIsEditing(true);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Check if the new focus target is still within this block
    const blockElement = e.currentTarget.closest('[data-block-id]');
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    
    // If focus is moving to another element within the same block OR to the toolbar, don't exit editing
    if (relatedTarget && (
      blockElement?.contains(relatedTarget) || 
      relatedTarget.closest('.worksheet-text-toolbar') || 
      relatedTarget.closest('[data-toolbar-element]')
    )) {
      return;
    }
    
    setIsEditing(false);
    onTextFlowBlur?.(block.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only handle Escape to exit editing mode
    // Do NOT prevent Enter - it should create new lines in textareas
    if (e.key === 'Escape') {
      setIsEditing(false);
      return;
    }

    if (
      e.key === 'Enter'
      && supportsTextFlow(block)
      && (hasTextFlowFrame(block) || isTextFlowLinked(block))
    ) {
      setTimeout(() => {
        onTextFlowBlur?.(block.id);
      }, 0);
    }
  };

  // Handle margin resize
  const handleMarginMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onUpdateMargin) return;
    
    setIsResizingMargin(true);
    const startY = e.clientY;
    const startMargin = block.marginBottom ?? 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startY;
      const newMargin = Math.max(0, Math.min(500, startMargin + delta));
      setLocalMargin(newMargin);
      onUpdateMargin(newMargin);
    };

    const handleMouseUp = () => {
      setIsResizingMargin(false);
      setLocalMargin(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [block.marginBottom, onUpdateMargin]);

  const highlightClass = isSelected
    ? 'ring-2 ring-blue-500 bg-blue-50/50'
    : isHovered
      ? 'ring-2 ring-blue-300 bg-blue-50/40'
      : 'hover:bg-slate-50 cursor-pointer';

  // Get current text formatting state from block content
  const getTextFormatState = () => {
    const content = block.content as any;
    
    // Get default font size based on block type
    let defaultFontSize = 12;
    if (block.type === 'heading') {
      // Default font sizes for headings (from getFontSizes)
      const headingDefaults = { h1: 36, h2: 24, h3: 18 };
      defaultFontSize = headingDefaults[content?.level as 'h1' | 'h2' | 'h3'] || 36;
    }
    
    // Handle legacy 'small'/'normal'/'large' values by converting to numbers
    let fontSizeValue = content?.fontSize;
    if (fontSizeValue === 'small') fontSizeValue = 9;
    else if (fontSizeValue === 'normal') fontSizeValue = 12;
    else if (fontSizeValue === 'large') fontSizeValue = 18;
    else if (typeof fontSizeValue !== 'number') fontSizeValue = defaultFontSize;
    
    return {
      fontSize: fontSizeValue,
      textAlign: content?.align || 'left',
      isBold: content?.isBold || false,
      isItalic: content?.isItalic || false,
      isUnderline: content?.isUnderline || false,
      textColor: content?.textColor || '#000000',
      highlightColor: content?.highlightColor || 'transparent',
      listType: content?.listType || 'none',
    };
  };

  const formatState = getTextFormatState();

  // Handlers for text formatting
  const handleFontSizeChange = (size: number) => {
    const content = block.content as any;
    onUpdate({ ...content, fontSize: size });
  };

  const handleAlignChange = (align: 'left' | 'center' | 'right') => {
    const content = block.content as any;
    onUpdate({ ...content, align });
  };

  const handleBoldToggle = () => {
    const content = block.content as any;
    onUpdate({ ...content, isBold: !content?.isBold });
  };

  const handleItalicToggle = () => {
    const content = block.content as any;
    onUpdate({ ...content, isItalic: !content?.isItalic });
  };

  const handleUnderlineToggle = () => {
    const content = block.content as any;
    onUpdate({ ...content, isUnderline: !content?.isUnderline });
  };

  const handleTextColorChange = (color: string) => {
    const content = block.content as any;
    onUpdate({ ...content, textColor: color });
  };

  const handleHighlightColorChange = (color: string) => {
    const content = block.content as any;
    onUpdate({ ...content, highlightColor: color });
  };

  const handleListTypeChange = (listType: 'none' | 'bullet' | 'numbered' | 'checklist') => {
    const content = block.content as any;
    onUpdate({ ...content, listType });
  };

  const handleInsertSymbol = (symbol: string) => {
    const content = block.content as any;
    // Insert symbol at the end of text/html content
    if (content?.html !== undefined) {
      onUpdate({ ...content, html: (content.html || '') + symbol });
    } else if (content?.text !== undefined) {
      onUpdate({ ...content, text: (content.text || '') + symbol });
    } else if (content?.question !== undefined) {
      onUpdate(setQuestionHtml(content, `${getQuestionHtml(content)}${symbol}`));
    }
  };

  const isInsideLayoutSection = Boolean(block.layoutSectionId);

  return (
    <>
    <div
      ref={(node) => {
        setNodeRef(node);
        // @ts-ignore - node might be null
        blockRef.current = node;
      }}
      style={style}
      data-block-id={block.id}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`
        group relative rounded-lg
        ${isInsideLayoutSection ? 'py-0 px-0' : isPisankaCanvasBlock ? 'py-0 px-0' : 'py-1 px-4'}
        ${isDragging ? 'shadow-xl scale-[1.01]' : ''}
        ${block.type === 'table' ? '' : highlightClass}
        ${isEditing && block.type !== 'table' ? 'ring-2 ring-blue-500' : ''}
      `}
    >
      
      {/* Block content with optional image */}
      <div
        data-text-flow-frame-for={block.id}
        style={
          block.textFlowFrameHeight
            ? {
                height: `${block.textFlowFrameHeight}px`,
                overflow: 'hidden',
              }
            : undefined
        }
      >
        <div style={isInsideLayoutSection ? { padding: '4px 16px' } : undefined}>
          <BlockWithImage
            block={block}
            isEditing={isEditing}
            isSelected={isSelected}
            onUpdate={onUpdate}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            globalFontSize={globalFontSize}
            activityNumber={activityNumber}
            onTextFlowSplitAtCaret={onTextFlowSplitAtCaret ? (charIndex, currentHtml) => onTextFlowSplitAtCaret(block.id, charIndex, currentHtml) : undefined}
          />
        </div>
      </div>
      
      {/* Bottom margin space with optional pattern */}
            {vAlignBottomMargin > 0 && (
              <div style={{ height: vAlignBottomMargin }} className="relative">
                {marginStyle === 'dotted' && (
                  <PrintSafePattern key={`dotted-margin-${marginBottom}`} variant="dotted" />
                )}
                {marginStyle === 'lined' && (
                  <PrintSafePattern key={`lined-margin-${marginBottom}`} variant="lined" lineSpacing={40} />
                )}
              </div>
            )}
      
      {/* Margin resize handle - prominent on selected block, similar to PRO editor */}
      {onUpdateMargin && block.type !== 'table' && block.type !== 'spacer' && block.type !== 'paragraph' && block.type !== 'infobox' && (
        <div
          onMouseDown={handleMarginMouseDown}
          className={`
            absolute print:hidden transition-all hover:scale-105 active:scale-95 select-none cursor-ns-resize
            ${isSelected || isResizingMargin ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
          `}
          style={{
            bottom: '-14px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '56px',
            height: '20px',
            backgroundColor: isResizingMargin ? '#1D4ED8' : '#3B82F6',
            borderRadius: '10px',
            border: '2px solid white',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
            zIndex: 10001,
          }}
          title="Táhni dolů pro přidání mezery"
        />
      )}

      {/* Action buttons */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            right: actionButtonsSide === 'right' ? '-76px' : 'auto',
            left: actionButtonsSide === 'left' ? '-76px' : 'auto',
            transform: 'translateY(-50%)',
            zIndex: 2147483647,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 p-1.5">
            {block.layoutSectionId && (
              <div className="grid grid-cols-2 gap-1 mb-1">
                <button
                  onClick={() => onMoveLeft?.()}
                  disabled={!onMoveLeft}
                  className="w-9 h-9 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Posunout doleva"
                >
                  <ChevronLeft size={18} className="text-blue-600" />
                </button>
                <button
                  onClick={() => onMoveRight?.()}
                  disabled={!onMoveRight}
                  className="w-9 h-9 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Posunout doprava"
                >
                  <ChevronRight size={18} className="text-blue-600" />
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => onMoveUp?.()}
                disabled={!onMoveUp}
                className="w-9 h-9 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Posunout nahoru"
              >
                <ChevronUp size={20} className="text-blue-600" />
              </button>
              <button
                onClick={() => onDuplicate?.()}
                className="w-9 h-9 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-colors"
                title="Duplikovat"
              >
                <Copy size={16} className="text-blue-600" />
              </button>
              <button
                onClick={() => onMoveDown?.()}
                disabled={!onMoveDown}
                className="w-9 h-9 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Posunout dolů"
              >
                <ChevronDown size={20} className="text-blue-600" />
              </button>
              <button
                onClick={() => onDelete?.()}
                className="w-9 h-9 rounded-md flex items-center justify-center transition-colors"
                style={{ backgroundColor: '#ef4444', border: '1px solid #dc2626' }}
                title="Smazat"
              >
                <Trash2 size={16} color="white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Text formatting toolbar - REMOVED per user request */}
    {/* showTextToolbar && createPortal(...) */}
    </>
  );
}

// ============================================
// BLOCK CONTENT COMPONENTS
// ============================================

interface BlockContentProps {
  block: WorksheetBlock;
  isEditing: boolean;
  isSelected?: boolean;
  onUpdate: (content: any) => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onTextFlowSplitAtCaret?: (charIndex: number, currentHtml?: string) => void;
  globalFontSize?: GlobalFontSize;
  activityNumber?: number;
}

// Size to width mapping for block images
const imageSizeToWidth: Record<ImageSize, string> = {
  small: '25%',
  medium: '35%',
  large: '50%',
  full: '100%',
};

/**
 * BlockWithImage - Wrapper that renders optional image alongside block content.
 * Supports widthPercent, visual styles (shape/stroke/rotation) and a drag handle when selected.
 */
function BlockWithImage({ block, isEditing, isSelected, onUpdate, onBlur, onKeyDown, onTextFlowSplitAtCaret, globalFontSize = 'normal', activityNumber }: BlockContentProps) {
  const image = block.image as any;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imgContainerRef = React.useRef<HTMLDivElement>(null);
  const draggingRef = React.useRef(false);
  const heightDraggingRef = React.useRef(false);
  const imageRef = React.useRef(image);
  imageRef.current = image;
  const panOffsetRef = React.useRef({ x: (image?.imageOffsetX ?? 0), y: (image?.imageOffsetY ?? 0) });

  // No image → just render content
  if (!image?.url) {
    return (
      <BlockContent block={block} isEditing={isEditing} isSelected={isSelected}
        onUpdate={onUpdate} onBlur={onBlur} onKeyDown={onKeyDown} onTextFlowSplitAtCaret={onTextFlowSplitAtCaret}
        globalFontSize={globalFontSize} activityNumber={activityNumber} />
    );
  }

  const resolvedWidth = image.widthPercent
    ? `${image.widthPercent}%`
    : (imageSizeToWidth[image.size as ImageSize] || '35%');
  const isImageLeft = image.position === 'beside-left';

  // Visual styles from image settings
  const shape: string = image.galleryItemShape || 'rectangle';
  const borderRadiusCss = shape === 'rectangle' ? `${image.galleryBorderRadius ?? 8}px` : '0';
  const clipPath = GALLERY_CLIP_PATHS[shape] || '';
  const strokeWidth: number = image.galleryStrokeWidth ?? 0;
  const strokeColor: string = image.galleryStrokeColor || '#334155';
  const rotateMax: number = image.galleryRotateMax ?? 5;
  const rotateDeg = image.galleryRotate ? (((137 + 29) % (rotateMax * 2 + 1)) - rotateMax) : 0;
  const dropShadowFilter = strokeWidth > 0
    ? `drop-shadow(0 0 ${strokeWidth}px ${strokeColor}) drop-shadow(0 0 ${Math.ceil(strokeWidth / 2)}px ${strokeColor})`
    : undefined;

  // Gallery: use gallery array if present, otherwise single url
  const galleryUrls: string[] = image.gallery?.length ? image.gallery : [image.url];
  const hasMultiple = galleryUrls.length > 1;

  const maxH = image.maxHeightPx;
  const imageZoom: number = image.imageZoom ?? 100;
  const zoomScale = imageZoom / 100;
  const rawOffsetX: number = image.imageOffsetX ?? 0;
  const rawOffsetY: number = image.imageOffsetY ?? 0;
  panOffsetRef.current = { x: rawOffsetX, y: rawOffsetY };

  // object-position: 50% 50% = center. Drag shifts the position.
  // Clamped to [0, 100] — image always covers container, no white space possible.
  const objPosX = Math.max(0, Math.min(100, 50 - rawOffsetX / 3));
  const objPosY = Math.max(0, Math.min(100, 50 - rawOffsetY / 3));

  // When zoomed: use object-fit:cover so the image always fills the container.
  // When not zoomed: use object-fit:contain to show the full image.
  const isZoomed = zoomScale > 1;

  const renderOneImg = (url: string, idx: number) => {
    const idxRotateDeg = image.galleryRotate ? (((idx * 137 + 29) % (rotateMax * 2 + 1)) - rotateMax) : 0;

    const containerStyle: React.CSSProperties = {
      position: 'relative',
      overflow: 'hidden',
      ...(idxRotateDeg !== 0 ? { transform: `rotate(${idxRotateDeg}deg)` } : {}),
      ...(dropShadowFilter ? { filter: dropShadowFilter } : {}),
      ...(shape === 'rectangle' ? { borderRadius: borderRadiusCss } : {}),
      ...(maxH ? { maxHeight: maxH } : {}),
    };

    if (isZoomed) {
      // ZOOMED: hidden <img> for layout sizing + background-image for visual.
      // background-size > 100% + background-position → physically impossible to show white space.
      return (
        <div key={idx} style={containerStyle}>
          {/* Invisible img determines the container's natural height */}
          <img src={url} alt="" style={{ width: '100%', height: 'auto', display: 'block', visibility: 'hidden' }} />
          {/* Visible background layer — always covers the container */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${url})`,
            backgroundSize: `${zoomScale * 100}% auto`,
            backgroundPosition: `${objPosX}% ${objPosY}%`,
            backgroundRepeat: 'no-repeat',
            ...(shape === 'rectangle' ? { borderRadius: borderRadiusCss } : {}),
            ...(shape !== 'rectangle' ? { clipPath, WebkitClipPath: clipPath } : {}),
          }} />
          {shape === 'rectangle' && strokeWidth > 0 && (
            <div style={{ position: 'absolute', inset: 0, borderRadius: borderRadiusCss, boxShadow: `inset 0 0 0 ${strokeWidth}px ${strokeColor}`, pointerEvents: 'none', zIndex: 10 }} />
          )}
        </div>
      );
    }

    // NOT ZOOMED: normal <img> rendering
    return (
      <div key={idx} style={containerStyle}>
        <img src={url} alt={image.alt || ''} style={{
          width: '100%', height: 'auto', display: 'block',
          ...(shape === 'rectangle' ? { borderRadius: borderRadiusCss } : {}),
          ...(shape !== 'rectangle' ? { clipPath, WebkitClipPath: clipPath } : {}),
        }} />
        {shape === 'rectangle' && strokeWidth > 0 && (
          <div style={{ position: 'absolute', inset: 0, borderRadius: borderRadiusCss, boxShadow: `inset 0 0 0 ${strokeWidth}px ${strokeColor}`, pointerEvents: 'none', zIndex: 10 }} />
        )}
      </div>
    );
  };

  const renderImg = () => hasMultiple ? (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(galleryUrls.length, 2)}, 1fr)`, gap: 4, alignItems: 'start' }}>
      {galleryUrls.map((url, idx) => renderOneImg(url, idx))}
    </div>
  ) : renderOneImg(galleryUrls[0], 0);

  // Drag handle (bobánek) – only when block is selected
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    const container = containerRef.current;
    if (!container) return;
    const onMove = (mv: MouseEvent) => {
      if (!draggingRef.current) return;
      const rect = container.getBoundingClientRect();
      const mouseX = mv.clientX - rect.left;
      let pct = isImageLeft
        ? Math.round((mouseX / rect.width) * 100)
        : Math.round(((rect.width - mouseX) / rect.width) * 100);
      pct = Math.max(15, Math.min(70, pct));
      onUpdate({ image: { ...image, widthPercent: pct, size: 'medium' } });
    };
    const onUp = () => { draggingRef.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const dragHandle = isSelected ? (
    <div onMouseDown={handleDragStart}
      style={{ width: 12, flexShrink: 0, cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', zIndex: 10 }}>
      <div style={{ width: 8, height: 36, borderRadius: 4, backgroundColor: '#6366f1', boxShadow: '0 0 0 2px #818cf8, 0 2px 8px rgba(99,102,241,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 2, height: 2, borderRadius: '50%', backgroundColor: 'white' }} />)}
      </div>
    </div>
  ) : <div style={{ width: 12, flexShrink: 0 }} />;

  // Height drag handle (bobánek) – horizontal strip at the bottom of the image
  const handleHeightDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    heightDraggingRef.current = true;
    const imgEl = imgContainerRef.current;
    if (!imgEl) return;
    const startY = imgEl.getBoundingClientRect().top;
    const onMove = (mv: MouseEvent) => {
      if (!heightDraggingRef.current) return;
      const newH = Math.round(mv.clientY - startY);
      const clamped = Math.max(50, Math.min(600, newH));
      onUpdate({ image: { ...image, maxHeightPx: clamped } });
    };
    const onUp = () => { heightDraggingRef.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const heightDragHandle = isSelected ? (
    <div onMouseDown={handleHeightDragStart}
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 16, cursor: 'row-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
      <div style={{ width: 36, height: 8, borderRadius: 4, backgroundColor: '#6366f1', boxShadow: '0 0 0 2px #818cf8, 0 2px 8px rgba(99,102,241,0.5)', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 2, height: 2, borderRadius: '50%', backgroundColor: 'white' }} />)}
      </div>
    </div>
  ) : null;

  // Drag-to-pan – only active when zoom > 100 or maxHeightPx is set
  const canPan = imageZoom > 100 || !!maxH;
  const handlePanStart = (e: React.MouseEvent) => {
    if (!isSelected || !canPan) return;
    e.preventDefault();
    e.stopPropagation();
    let lastX = e.clientX;
    let lastY = e.clientY;
    const onMove = (mv: MouseEvent) => {
      const dx = mv.clientX - lastX;
      const dy = mv.clientY - lastY;
      lastX = mv.clientX;
      lastY = mv.clientY;
      const newX = panOffsetRef.current.x + dx;
      const newY = panOffsetRef.current.y + dy;
      // Clamp to ±150px — render clamps transformOrigin to 0–100%
      const clampedX = Math.max(-150, Math.min(150, newX));
      const clampedY = Math.max(-150, Math.min(150, newY));
      panOffsetRef.current = { x: clampedX, y: clampedY };
      onUpdate({ image: { ...imageRef.current, imageOffsetX: clampedX, imageOffsetY: clampedY } });
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const panOverlay = (isSelected && canPan) ? (
    <div onMouseDown={handlePanStart}
      style={{ position: 'absolute', inset: 0, cursor: 'grab', zIndex: 5, userSelect: 'none' }} />
  ) : null;

  const imgWrapStyle = (w: string): React.CSSProperties => ({
    width: w,
    flexShrink: 0,
    position: 'relative',
    overflow: 'hidden',
    ...(shape === 'rectangle' ? { borderRadius: borderRadiusCss } : {}),
    ...(maxH ? { maxHeight: maxH } : {}),
  });

  const imgBox = (w: string) => (
    <div ref={imgContainerRef} style={imgWrapStyle(w)}>
      {renderImg()}
      {panOverlay}
      {heightDragHandle}
    </div>
  );

  // Image before content (above)
  if (image.position === 'before') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {imgBox(resolvedWidth)}
        {image.caption && <p style={{ fontSize: 11, color: '#64748b', textAlign: 'center', margin: 0 }}>{image.caption}</p>}
        <BlockContent block={block} isEditing={isEditing} isSelected={isSelected}
          onUpdate={onUpdate} onBlur={onBlur} onKeyDown={onKeyDown} onTextFlowSplitAtCaret={onTextFlowSplitAtCaret}
          globalFontSize={globalFontSize} activityNumber={activityNumber} />
      </div>
    );
  }

  // Image after content (below)
  if (image.position === 'after') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <BlockContent block={block} isEditing={isEditing} isSelected={isSelected}
          onUpdate={onUpdate} onBlur={onBlur} onKeyDown={onKeyDown} onTextFlowSplitAtCaret={onTextFlowSplitAtCaret}
          globalFontSize={globalFontSize} activityNumber={activityNumber} />
        {imgBox(resolvedWidth)}
        {image.caption && <p style={{ fontSize: 11, color: '#64748b', textAlign: 'center', margin: 0 }}>{image.caption}</p>}
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ display: 'flex', alignItems: 'flex-start' }}>
      {isImageLeft && imgBox(resolvedWidth)}
      {isImageLeft && dragHandle}
      <div style={{ flex: 1, minWidth: 0 }}>
        <BlockContent block={block} isEditing={isEditing} isSelected={isSelected}
          onUpdate={onUpdate} onBlur={onBlur} onKeyDown={onKeyDown} onTextFlowSplitAtCaret={onTextFlowSplitAtCaret}
          globalFontSize={globalFontSize} activityNumber={activityNumber} />
      </div>
      {!isImageLeft && dragHandle}
      {!isImageLeft && imgBox(resolvedWidth)}
    </div>
  );
}

function BlockContent({ block, isEditing, isSelected, onUpdate, onBlur, onKeyDown, onTextFlowSplitAtCaret, globalFontSize = 'normal', activityNumber }: BlockContentProps) {
  const fontSizes = getFontSizes(globalFontSize);
  const effectiveIsEditing = isEditing || (isSelected && ['image-hotspots', 'connect-pairs', 'fill-blank'].includes(block.type));
  switch (block.type) {
    case 'heading':
      return (
        <HeadingEditor
          content={block.content}
          isEditing={isEditing}
          onUpdate={onUpdate}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          fontSizes={fontSizes}
        />
      );
    case 'paragraph':
      return (
        <ParagraphEditor
          content={block.content}
          isEditing={isEditing}
          onUpdate={onUpdate}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          onEnterAtCaret={onTextFlowSplitAtCaret}
          fontSizes={fontSizes}
          activityNumber={activityNumber}
        />
      );
    case 'infobox':
      return (
        <InfoboxEditor
          content={block.content}
          isEditing={isEditing}
          onUpdate={onUpdate}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          onEnterAtCaret={onTextFlowSplitAtCaret}
          fontSizes={fontSizes}
        />
      );
    case 'layout-section':
      return (
        <div
          style={{
            border: '1px dashed #94a3b8',
            borderRadius: 12,
            padding: '16px',
            background: 'rgba(248,250,252,0.8)',
            color: '#475569',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontWeight: 700 }}>
            <LayoutGrid size={16} />
            Layout sekce
          </div>
          <div style={{ fontSize: 13 }}>
            {(block.content as any)?.columns === 3 ? '3 sloupce' : '2 sloupce'}
          </div>
        </div>
      );
    case 'multiple-choice':
      return (
        <MultipleChoiceEditor
          content={block.content}
          isEditing={isEditing}
          onUpdate={onUpdate}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          fontSizes={fontSizes}
          activityNumber={activityNumber}
        />
      );
    case 'fill-blank':
      return (
        <FillBlankEditor
          content={block.content}
          isEditing={effectiveIsEditing}
          onUpdate={onUpdate}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          fontSizes={fontSizes}
          activityNumber={activityNumber}
        />
      );
    case 'free-answer':
      return (
        <FreeAnswerEditor
          content={block.content}
          isEditing={isEditing}
          onUpdate={onUpdate}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          fontSizes={fontSizes}
          activityNumber={activityNumber}
        />
      );
    case 'spacer':
      return (
        <SpacerEditor
          content={block.content as { height: number; style: SpacerStyle }}
          isEditing={isEditing}
          onUpdate={onUpdate}
        />
      );
    case 'examples':
      return (
        <ExamplesEditor
          content={block.content as ExamplesContent}
          isEditing={isEditing}
          onUpdate={onUpdate}
        />
      );
    case 'image':
      return (
        <ImageEditor
          content={block.content as ImageContent}
          isEditing={isEditing}
          onUpdate={onUpdate}
        />
      );
    case 'table':
      return (
        <TableEditor
          content={block.content as TableContent}
          isEditing={isEditing}
          onUpdate={onUpdate}
          onBlur={onBlur}
        />
      );
    case 'connect-pairs':
      return (
        <ConnectPairsEditorBlock
          content={block.content as ConnectPairsContent}
          isEditing={effectiveIsEditing}
          onUpdate={onUpdate}
          activityNumber={activityNumber}
          fontSizes={fontSizes}
        />
      );
    case 'image-hotspots':
      return (
        <ImageHotspotsEditorBlock
          content={block.content as ImageHotspotsContent}
          isEditing={effectiveIsEditing}
          onUpdate={onUpdate}
          activityNumber={activityNumber}
          fontSizes={fontSizes}
        />
      );
    case 'video-quiz':
      return (
        <VideoQuizEditorBlock
          content={block.content as VideoQuizContent}
          isEditing={isEditing}
          onUpdate={onUpdate}
          activityNumber={activityNumber}
          fontSizes={fontSizes}
        />
      );
    case 'qr-code':
      return (
        <QRCodeEditor
          content={block.content as QRCodeContent}
          isEditing={isEditing}
          onUpdate={onUpdate}
        />
      );
    case 'header-footer':
      return (
        <HeaderFooterEditorBlock
          content={block.content as HeaderFooterContent}
          isEditing={isEditing}
          onUpdate={onUpdate}
        />
      );
    case 'free-canvas':
      return (
        <FreeCanvasActivityBlock
          block={block}
          isEditing={isEditing}
          onUpdate={onUpdate}
          activityNumber={activityNumber}
        />
      );
    case 'chart':
      return (
        <WorksheetChartBlock
          content={block.content as ChartContent}
          onUpdate={onUpdate}
          isEditing={isEditing}
        />
      );
    default:
      return <p className="text-slate-400">Neznámý typ bloku</p>;
  }
}

// ============================================
// HEADING EDITOR
// ============================================

interface FontSizes {
  title: string;
  body: string;
  small: string;
  large: string;
  h1: string;
  h2: string;
  h3: string;
}

function getActivityLabelStyle(fontSizes?: FontSizes): React.CSSProperties {
  const compactBody = getFontSizes('small').body;
  const isCompact = fontSizes?.body === compactBody;
  return {
    fontSize: isCompact ? '11pt' : '12pt',
    lineHeight: 1.3,
    fontWeight: 600,
  };
}

interface HeadingEditorProps {
  content: { text: string; level: 'h1' | 'h2' | 'h3'; align?: 'left' | 'center' | 'right'; isBold?: boolean; isItalic?: boolean; isUnderline?: boolean; fontSize?: number; textColor?: string; highlightColor?: string; headingStyle?: 'plain' | 'pill' | 'underline' | 'left-border' };
  isEditing: boolean;
  onUpdate: (content: any) => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  fontSizes: FontSizes;
}

function HeadingEditor({ content, isEditing, onUpdate, onBlur, onKeyDown, fontSizes }: HeadingEditorProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const lastHtmlRef = useRef('');
  const didFocusRef = useRef(false);
  const isBold = content.isBold || false;
  const isItalic = content.isItalic || false;
  const isUnderline = content.isUnderline || false;
  const textColor = content.textColor || '#1e293b';
  const highlightColor = content.highlightColor || 'transparent';

  const [headingBubblePos, setHeadingBubblePos] = useState<{ top: number; left: number } | null>(null);
  const [showHeadingHighlights, setShowHeadingHighlights] = useState(false);

  // Sync content.text → innerHTML when value changes externally
  const normalizeHtml = (html: string) =>
    html
      .replace(/<div><br\s*\/?><\/div>/gi, '<br>')
      .replace(/<\/div><div>/gi, '<br>')
      .replace(/<div>/gi, '<br>')
      .replace(/<\/div>/gi, '');

  useEffect(() => {
    const el = editableRef.current;
    if (!el) return;
    const incoming = normalizeHtml(content.text ?? '');
    if (incoming === lastHtmlRef.current) return;
    lastHtmlRef.current = incoming;
    if (el.innerHTML !== incoming) el.innerHTML = incoming;
  }, [content.text]);

  // Focus when editing starts — also set initial innerHTML (sync effect won't fire if content.text didn't change)
  useEffect(() => {
    if (isEditing && !didFocusRef.current && editableRef.current) {
      didFocusRef.current = true;
      const el = editableRef.current;
      // Normalize on load — old stored HTML may have <div> blocks from contenteditable
      const incoming = normalizeHtml(content.text ?? '');
      if (el.innerHTML !== incoming) {
        el.innerHTML = incoming;
        lastHtmlRef.current = incoming;
      }
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
    if (!isEditing) {
      didFocusRef.current = false;
      lastHtmlRef.current = ''; // reset so next entry always syncs
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const syncHtml = useCallback(() => {
    const el = editableRef.current;
    if (!el) return;
    const normalized = normalizeHtml(el.innerHTML);
    lastHtmlRef.current = normalized;
    onUpdate({ ...content, text: normalized });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, onUpdate]);

  const checkSel = useCallback(() => {
    const sel = window.getSelection();
    const el = editableRef.current;
    if (!sel || sel.isCollapsed || !sel.rangeCount || !el) { setHeadingBubblePos(null); return; }
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) { setHeadingBubblePos(null); return; }
    const rect = range.getBoundingClientRect();
    if (rect.width === 0) { setHeadingBubblePos(null); return; }
    setHeadingBubblePos({ top: rect.top - 52, left: rect.left + rect.width / 2 });
  }, []);

  const applyFmt = useCallback((cmd: string, val?: string) => {
    const el = editableRef.current;
    if (!el) return;
    el.focus();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(cmd, false, val);
    syncHtml();
    setHeadingBubblePos(null);
    setShowHeadingHighlights(false);
  }, [syncHtml]);

  const headingBubble = headingBubblePos && isEditing ? createPortal(
    <div
      data-toolbar-element="true"
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        top: Math.max(8, headingBubblePos.top),
        left: headingBubblePos.left,
        transform: 'translateX(-50%)',
        zIndex: 99999,
        background: 'white',
        borderRadius: '10px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '4px 8px',
        height: '40px',
        userSelect: 'none',
      }}
    >
      <RichBubbleBtn title="Tučné"     onClick={() => applyFmt('bold')}><Bold     size={14} strokeWidth={2.5} /></RichBubbleBtn>
      <RichBubbleBtn title="Kurzíva"   onClick={() => applyFmt('italic')}><Italic   size={14} /></RichBubbleBtn>
      <RichBubbleBtn title="Podtržené" onClick={() => applyFmt('underline')}><Underline size={14} /></RichBubbleBtn>
      <div style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 4px' }} />
      <div style={{ position: 'relative' }}>
        <RichBubbleBtn title="Zvýraznit" onClick={() => setShowHeadingHighlights(v => !v)}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 4, background: '#fef08a', fontWeight: 700, fontSize: 12, color: '#78350f' }}>A</span>
        </RichBubbleBtn>
        {showHeadingHighlights && (
          <div
            data-toolbar-element="true"
            onMouseDown={(e) => e.preventDefault()}
            style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6, background: 'white', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', display: 'flex', gap: 6, padding: '8px 10px' }}
          >
            {RICH_HIGHLIGHTS.map(({ bg, label }) => (
              <button
                key={bg}
                data-toolbar-element="true"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyFmt('hiliteColor', bg === 'transparent' ? 'transparent' : bg)}
                title={label}
                style={{ width: 22, height: 22, borderRadius: 6, background: bg === 'transparent' ? 'white' : bg, border: bg === 'transparent' ? '2px dashed #cbd5e1' : '2px solid transparent', cursor: 'pointer' }}
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  // Font sizes for headings
  const defaultSize = { h1: fontSizes.h1, h2: fontSizes.h2, h3: fontSizes.h3 }[content.level];
  const sizeStyle = content.fontSize ? `${content.fontSize}pt` : defaultSize;

  const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' }[content.align || 'left'];

  const isH1 = content.level === 'h1';
  // Read fontFamily from content; fall back to Cooper for H1, undefined for others
  const defaultFontFamily = isH1 ? 'Cooper Light, serif' : undefined;
  const fontFamily = (content as any).fontFamily || defaultFontFamily;
  const isCooper = fontFamily?.toLowerCase().includes('cooper');
  const fontClass = isCooper ? 'font-cooper' : '';
  const baseFontWeight = isH1 && isCooper ? 300 : 700;
  const fontWeight = content.fontWeight || (isBold && !isCooper ? 'bold' : baseFontWeight);

  const hStyle = content.headingStyle || 'plain';

  const formattingStyle: React.CSSProperties = {
    fontStyle: isItalic ? 'italic' : 'normal',
    textDecoration: isUnderline ? 'underline' : 'none',
    color: textColor,
    backgroundColor: hStyle === 'pill' ? 'transparent' : highlightColor,
  };

  const headingStyle: React.CSSProperties = {
    fontSize: sizeStyle,
    fontWeight,
    fontFamily,
    lineHeight: (content as any).lineHeight || 1.2,
    letterSpacing: (content as any).letterSpacing ? `${(content as any).letterSpacing / 100}em` : undefined,
    margin: 0,
    padding: 0,
    ...formattingStyle,
  };

  const innerStyle: React.CSSProperties = {
    fontFamily, fontWeight,
    lineHeight: (content as any).lineHeight || 1.2,
    letterSpacing: (content as any).letterSpacing ? `${(content as any).letterSpacing / 100}em` : undefined,
    ...formattingStyle,
  };

  const hasHtml = /<[a-z][\s\S]*>/i.test(content.text || '');
  const sharedDivStyle: React.CSSProperties = { ...headingStyle, minHeight: '1.2em', whiteSpace: 'pre-wrap', wordBreak: 'break-word' };
  const sharedDivClass = `w-full ${alignClass} ${fontClass}`;

  const renderContent = () => {
    if (isEditing) {
      // Edit mode: contenteditable div (no dangerouslySetInnerHTML — content managed via ref/useEffect)
      return (
        <>
          {headingBubble}
          <div
            ref={editableRef}
            contentEditable
            suppressContentEditableWarning
            onInput={syncHtml}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onBlur(e as unknown as React.FocusEvent);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                document.execCommand('insertLineBreak');
              }
              onKeyDown(e);
            }}
            onMouseUp={checkSel}
            onKeyUp={checkSel}
            className={`${sharedDivClass} bg-transparent border-none outline-none`}
            style={sharedDivStyle}
            data-placeholder="Zadejte nadpis..."
          />
        </>
      );
    }
    // View mode: plain div with dangerouslySetInnerHTML — no contentEditable to avoid PDF issues
    if (!content.text) return <span className="text-slate-400" style={innerStyle}>Nadpis...</span>;
    if (!hasHtml) return <span style={innerStyle}><LatexRenderer text={content.text} style={innerStyle} /></span>;
    return (
      <div
        className={`${sharedDivClass} heading-html-view worksheet-rich-html-content`}
        style={sharedDivStyle}
        dangerouslySetInnerHTML={{ __html: preventOrphansInHtml(normalizeHtml(content.text)) }}
      />
    );
  };

  // Heading style decorations
  if (hStyle === 'pill') {
    const pillBg = highlightColor !== 'transparent' ? highlightColor : '#dcfce7';
    return (
      <div className={alignClass}>
        <span
          style={{
            ...headingStyle,
            backgroundColor: pillBg,
            padding: '6px 20px',
            borderRadius: '10px',
            display: 'inline-block',
          }}
        >
          {renderContent()}
        </span>
      </div>
    );
  }

  if (hStyle === 'left-border') {
    const borderColor = highlightColor !== 'transparent' ? highlightColor : '#3b82f6';
    return (
      <div
        style={{
          borderLeft: `4px solid ${borderColor}`,
          paddingLeft: '12px',
        }}
      >
        <div className={`${alignClass} ${fontClass}`} style={headingStyle}>
          {renderContent()}
        </div>
      </div>
    );
  }

  if (hStyle === 'underline') {
    const lineColor = highlightColor !== 'transparent' ? highlightColor : '#e2e8f0';
    return (
      <div style={{ borderBottom: `3px solid ${lineColor}`, paddingBottom: '6px' }}>
        <div className={`${alignClass} ${fontClass}`} style={headingStyle}>
          {renderContent()}
        </div>
      </div>
    );
  }
  
  // Default: plain
  return (
    <div className={`${alignClass} ${fontClass}`} style={headingStyle}>
      {renderContent()}
    </div>
  );
}

// ============================================
// PARAGRAPH EDITOR
// ============================================

// Color definitions for infobox mode
const PARAGRAPH_BG_COLORS: Record<string, { bg: string; border: string }> = {
  none: { bg: 'transparent', border: 'transparent' },
  blue: { bg: '#dbeafe', border: '#93c5fd' },
  green: { bg: '#dcfce7', border: '#86efac' },
  yellow: { bg: '#fef9c3', border: '#fde047' },
  red: { bg: '#fee2e2', border: '#fca5a5' },
  purple: { bg: '#f3e8ff', border: '#d8b4fe' },
  gray: { bg: '#f1f5f9', border: '#cbd5e1' },
};

interface ParagraphEditorProps {
  content: {
    html: string;
    displayMode?: 'normal' | 'infobox';
    bgColor?: string;
    hasBorder?: boolean;
    align?: 'left' | 'center' | 'right' | 'justify';
    fontSize?: number | 'small' | 'normal' | 'large'; // number in pt, or legacy string values
    textColor?: string;
    highlightColor?: string;
  };
  isEditing: boolean;
  onUpdate: (content: any) => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onEnterAtCaret?: (charIndex: number, currentHtml?: string) => void;
  fontSizes: FontSizes;
  activityNumber?: number;
}

function ParagraphEditor({ content, isEditing, onUpdate, onBlur, onKeyDown, onEnterAtCaret, fontSizes, activityNumber }: ParagraphEditorProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const didFocusPRef = useRef(false);
  const pisankaHostRef = useRef<HTMLDivElement>(null);

  // Písanka (čJ) — náhled vždy z miniApp (barva/průhlednost, mezery řádků — ne zastaralé uložené html)
  if ((content as any).miniApp?.type === 'pisanka') {
    const rawMini = mergePisankaMiniApp(undefined, (content as any).miniApp ?? {});
    const htmlOut = buildPisankaHtml(rawMini);
    return (
      <div className="vb-miniapp-paragraph-host" style={{ width: '100%' }}>
        <div
          ref={pisankaHostRef}
          className="worksheet-rich-html-content vb-pisanka-view"
          style={{ width: '100%', userSelect: 'none' }}
          dangerouslySetInnerHTML={{
            __html: preventOrphansInHtml(htmlOut),
          }}
        />
        <PisankaGuideDotsLayer rootRef={pisankaHostRef} mini={rawMini} />
      </div>
    );
  }

  // Miniaplikace „porovnávání počtů“ — hlavička jako u klasické otázky, widget v pravém panelu / náhled
  if ((content as any).miniApp?.type === 'compare-counts') {
    const rawMini = (content as any).miniApp;
    const mini = mergeCompareCountsMiniApp(undefined, rawMini ?? {});
    const rawHtml = String((content as any).html || '').trim();
    const circleColor = mini.circleColor || '#1e293b';
    const circleSize = mini.circleSize || 21;
    const questionStyles: React.CSSProperties = {
      fontFamily: mini.qFontFamily || "'Fenomen Sans', sans-serif",
      fontSize: mini.qFontSize ? `${mini.qFontSize}pt` : fontSizes.title,
      fontWeight: mini.qFontWeight === 'bold' || mini.qIsBold ? 'bold' : (mini.qFontWeight || '500'),
      color: mini.qTextColor || '#1e293b',
      lineHeight: mini.qLineHeight || 1.2,
      letterSpacing: `${(mini.qLetterSpacing || 0) / 100}em`,
      textAlign: mini.qAlign || 'left',
      fontStyle: mini.qIsItalic ? 'italic' : 'normal',
      textDecoration: mini.qIsUnderline ? 'underline' : 'none',
    };
    const qHtml = getQuestionHtml({ question: mini.question, questionHtml: mini.questionHtml });

    const patchCompareQuestion = (questionHtml: string) => {
      const q = setQuestionHtml({ question: mini.question, questionHtml: mini.questionHtml }, questionHtml);
      const nextMini = mergeCompareCountsMiniApp(mini, q);
      onUpdate({
        ...(content as any),
        miniApp: nextMini,
        html: buildCompareCountsHtml(nextMini),
      });
    };

    return (
      <div className="vb-miniapp-paragraph-host" style={{ width: '100%' }}>
        <div className="flex items-start gap-3 mb-3">
          {activityNumber != null && activityNumber > 0 ? (
            <div
              className="flex items-center justify-center shrink-0 font-bold text-white activity-number-circle"
              style={{
                width: `${circleSize}px`,
                height: `${circleSize}px`,
                minWidth: `${circleSize}px`,
                minHeight: `${circleSize}px`,
                borderRadius: '50%',
                backgroundColor: circleColor,
                fontSize: `${Math.round(circleSize * 0.57)}px`,
              }}
            >
              {activityNumber}
            </div>
          ) : null}
          <div className="flex-1 relative" style={{ ...questionStyles, minHeight: '1.5em' }}>
            {isEditing ? (
              <RichQuestionEditor
                value={qHtml}
                onChange={patchCompareQuestion}
                style={questionStyles}
                placeholder="Zde zadejte zadání úlohy…"
                onKeyDown={onKeyDown}
                onBlur={onBlur}
                autoFocus
              />
            ) : qHtml ? (
              <div
                className="worksheet-rich-html-content"
                style={{ ...questionStyles, minHeight: '1.5em' }}
                dangerouslySetInnerHTML={{ __html: preventOrphansInHtml(qHtml) }}
              />
            ) : (
              <span className="text-slate-400">Zadejte zadání úlohy…</span>
            )}
          </div>
        </div>
        <div
          data-text-flow-content="true"
          className="worksheet-rich-html-content vb-compare-counts-view"
          style={{ width: '100%', userSelect: 'none' }}
          dangerouslySetInnerHTML={{
            __html: rawHtml
              ? preventOrphansInHtml(rawHtml)
              : '<div style="font-size:12px;color:#94a3b8;padding:8px 0;">Nastavení úlohy je v pravém sloupci.</div>',
          }}
        />
      </div>
    );
  }

  const displayMode = content.displayMode || 'normal';
  const bgColor = content.bgColor || 'blue';
  const hasBorder = content.hasBorder ?? true;
  const align = content.align || 'left';
  const rawFontSize = content.fontSize;
  const isBold = content.isBold || false;
  const isItalic = content.isItalic || false;
  const isUnderline = content.isUnderline || false;
  const textColor = content.textColor || '#475569'; // default slate-600
  const highlightColor = content.highlightColor || 'transparent';

  // Get colors
  const colors = PARAGRAPH_BG_COLORS[bgColor] || PARAGRAPH_BG_COLORS.blue;

  // Font size - handle both numeric and legacy string values
  let fontSizeStyle: string;
  if (typeof rawFontSize === 'number') {
    fontSizeStyle = `${rawFontSize}pt`;
  } else if (rawFontSize === 'small') {
    fontSizeStyle = fontSizes.small;
  } else if (rawFontSize === 'large') {
    fontSizeStyle = fontSizes.large;
  } else {
    fontSizeStyle = fontSizes.body; // default 'normal'
  }

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.style.height = 'auto';
      editorRef.current.style.height = `${editorRef.current.scrollHeight}px`;
    }
  }, []);

  // Focus editor when editing starts – only once per editing session
  useEffect(() => {
    if (isEditing && !didFocusPRef.current && editorRef.current) {
      didFocusPRef.current = true;
      editorRef.current.focus();
      const len = editorRef.current.value.length;
      editorRef.current.setSelectionRange(len, len);
      autoResize();
    }
    if (!isEditing) {
      didFocusPRef.current = false;
    }
  }, [isEditing, autoResize]);

  // Infobox wrapper style
  const wrapperStyle: React.CSSProperties = displayMode === 'infobox' 
    ? {
        backgroundColor: colors.bg,
        border: hasBorder ? `2px solid ${colors.border}` : 'none',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
      }
    : {};

  // Strip HTML to get plain text
  const normalizedHtml = normalizeRichBlockHtml(content.html || '');
  const plainText = normalizedHtml.replace(/<[^>]*>/g, '') || '';

  const textStyle: React.CSSProperties = {
    textAlign: align,
    fontSize: fontSizeStyle,
    fontFamily: content.fontFamily || FONT_FAMILY,
    lineHeight: content.lineHeight || 1.5,
    letterSpacing: content.letterSpacing ? `${content.letterSpacing / 100}em` : undefined,
    outline: 'none',
    minHeight: '1.5em',
    margin: 0,
    fontWeight: content.fontWeight === 'bold' || isBold ? 'bold' : (content.fontWeight || 'normal'),
    fontStyle: isItalic ? 'italic' : 'normal',
    textDecoration: isUnderline ? 'underline' : 'none',
    color: textColor,
    backgroundColor: highlightColor,
  };

  const handleInsertLatex = (latex: string) => {
    const newValue = plainText + ' ' + latex;
    onUpdate({ ...content, html: newValue });
  };

  // Image settings
  const imageUrl = content.imageUrl;
  const imagePosition = (content.imagePosition && content.imagePosition !== 'none') ? content.imagePosition : 'right';
  const imageShape = content.imageShape || 'square';
  const imageSize = content.imageSize || 120;

  // Image style based on shape
  const getImageBorderRadius = () => {
    switch (imageShape) {
      case 'circle': return '50%';
      case 'rounded': return '12px';
      default: return '4px';
    }
  };

  // Render image component
  const renderImage = () => {
    if (!imageUrl) return null;
    
    return (
      <div
        style={{
          width: imageSize,
          height: imageShape === 'circle' ? imageSize : 'auto',
          minHeight: imageShape === 'circle' ? imageSize : imageSize * 0.75,
          flexShrink: 0,
          overflow: 'hidden',
          borderRadius: getImageBorderRadius(),
        }}
      >
        <img
          src={imageUrl}
          alt=""
          style={{
            width: '100%',
            height: imageShape === 'circle' ? '100%' : 'auto',
            objectFit: 'cover',
            display: 'block',
            borderRadius: getImageBorderRadius(),
          }}
        />
      </div>
    );
  };

  // Container style based on image position
  const getContainerStyle = (): React.CSSProperties => {
    if (!imageUrl) return wrapperStyle;
    
    const isHorizontal = imagePosition === 'left' || imagePosition === 'right';
    
    return {
      ...wrapperStyle,
      display: 'flex',
      flexDirection: isHorizontal 
        ? (imagePosition === 'left' ? 'row' : 'row-reverse')
        : (imagePosition === 'top' ? 'column' : 'column-reverse'),
      gap: '16px',
      alignItems: isHorizontal ? 'flex-start' : 'stretch',
    };
  };

  const columns = (content as any).columns || 1;
  const hasHtml = normalizedHtml && /<[a-z][\s\S]*>/i.test(normalizedHtml);

  const columnStyle: React.CSSProperties = columns > 1 ? {
    columnCount: columns,
    columnGap: '24px',
  } : {};

  return (
    <div
      style={getContainerStyle()}
      className={displayMode === 'infobox' ? 'paragraph-infobox' : undefined}
      data-bg-color={displayMode === 'infobox' ? bgColor : undefined}
      data-has-border={displayMode === 'infobox' ? (hasBorder ? 'true' : 'false') : undefined}
    >
      {renderImage()}
      <div
        data-text-flow-content="true"
        style={{ ...textStyle, whiteSpace: hasHtml ? undefined : 'pre-wrap', flex: 1, minHeight: '1.5em', ...columnStyle }}
      >
        {isEditing ? (
          <RichHtmlEditor
            value={normalizedHtml}
            onChange={(v) => onUpdate({ ...content, html: normalizeRichBlockHtml(v) })}
            style={{ ...textStyle, width: '100%', minHeight: '1.5em' }}
            placeholder="Odstavec textu..."
            onKeyDown={onKeyDown}
            onEnterAtCaret={onEnterAtCaret}
            onBlur={onBlur}
            autoFocus
          />
        ) : (
          normalizedHtml ? (
            hasHtml ? (
              <div
                className="worksheet-rich-html-content"
                style={textStyle}
                dangerouslySetInnerHTML={{ __html: preventOrphansInHtml(normalizedHtml) }}
              />
            ) : (
              <LatexRenderer text={normalizedHtml} style={textStyle} />
            )
          ) : (
            <span style={{ color: '#94a3b8' }}>Odstavec textu...</span>
          )
        )}
      </div>
    </div>
  );
}

// ============================================
// INFOBOX EDITOR
// ============================================

interface InfoboxEditorProps {
  content: { title?: string; html: string; variant: 'blue' | 'green' | 'yellow' | 'purple' };
  isEditing: boolean;
  onUpdate: (content: any) => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onEnterAtCaret?: (charIndex: number, currentHtml?: string) => void;
  fontSizes: FontSizes;
}

function InfoboxEditor({ content, isEditing, onUpdate, onBlur, onKeyDown, onEnterAtCaret, fontSizes }: InfoboxEditorProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const normalizedHtml = normalizeRichBlockHtml(content.html || '');
  const plainText = normalizedHtml.replace(/<[^>]*>/g, '') || '';

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    if (textRef.current) {
      textRef.current.style.height = 'auto';
      textRef.current.style.height = `${textRef.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    if (isEditing && titleRef.current) {
      titleRef.current.focus();
    }
    if (isEditing) {
      // Delay to ensure DOM is ready
      setTimeout(autoResize, 0);
    }
  }, [isEditing, autoResize]);

  // Accent color per variant (for title text)
  const variantAccent: Record<string, string> = {
    blue: '#1d4ed8',
    green: '#15803d',
    yellow: '#b45309',
    purple: '#7e22ce',
  };
  const accent = variantAccent[content.variant] || '#1d4ed8';

  return (
    <div style={{ fontSize: fontSizes.body }}>
      {isEditing ? (
        <>
          <input
            ref={titleRef}
            type="text"
            value={content.title || ''}
            onChange={(e) => onUpdate({ ...content, title: e.target.value })}
            onKeyDown={onKeyDown}
            className="w-full bg-transparent border-none outline-none"
            style={{ fontSize: fontSizes.title, fontWeight: 600, color: accent, padding: 0, margin: 0, marginBottom: '6px', display: 'block' }}
            placeholder="Titulek (volitelný)..."
          />
          <div data-text-flow-content="true">
            <RichHtmlEditor
              value={normalizedHtml}
              onChange={(v) => onUpdate({ ...content, html: normalizeRichBlockHtml(v) })}
              style={{ fontSize: fontSizes.body, minHeight: '40px', padding: 0, margin: 0, color: '#374151' }}
              placeholder="Text infoboxu..."
              onKeyDown={onKeyDown}
              onEnterAtCaret={onEnterAtCaret}
              onBlur={onBlur}
              autoFocus={false}
            />
          </div>
        </>
      ) : (
        <>
          {content.title && (
            <h4 style={{ fontSize: fontSizes.title, fontWeight: 600, color: accent, marginBottom: '4px', marginTop: 0 }}>
              {content.title}
            </h4>
          )}
          <div
            className="worksheet-rich-html-content"
            data-text-flow-content="true"
            style={{ fontSize: fontSizes.body, color: '#374151' }}
            dangerouslySetInnerHTML={{ 
              __html: preventOrphansInHtml(normalizedHtml || '<p style="color:#9ca3af">Infobox...</p>')
            }}
          />
        </>
      )}
    </div>
  );
}

// ============================================
// RICH QUESTION EDITOR
// contenteditable that shows markdown as formatted HTML,
// with a floating Bold/Italic/Underline/Highlight toolbar on selection.
// ============================================

/** Convert contenteditable innerHTML to our normalized rich HTML. */
function richHtmlToMd(html: string): string {
  return normalizeRichHtml(html);
}

/** Convert legacy text/markdown-like content to editable HTML. */
function mdToRichHtml(md: string): string {
  return legacyQuestionStringToHtml(md);
}

/** Plain-text option editor — textarea with guaranteed Enter support */
function OptionTextEditor({
  value, onChange, onBlur, style, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: (e: React.FocusEvent) => void;
  style?: React.CSSProperties;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-size on every render
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  });

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={(e) => {
        // Explicitly stop ALL propagation for Enter so nothing above can block it
        if (e.key === 'Enter') {
          e.stopPropagation();
          // Do NOT preventDefault — let browser insert \n naturally
        }
      }}
      placeholder={placeholder}
      rows={1}
      style={{
        ...style,
        display: 'block',
        width: '100%',
        padding: 0,
        margin: 0,
        border: 'none',
        outline: 'none',
        background: 'transparent',
        resize: 'none',
        overflow: 'hidden',
        lineHeight: (style as any)?.lineHeight || 'normal',
      }}
    />
  );
}

function RichBubbleBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#374151', transition: 'background 0.1s' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  );
}

const RICH_HIGHLIGHTS = [
  { bg: '#fef08a', label: 'Žlutá' },
  { bg: '#bbf7d0', label: 'Zelená' },
  { bg: '#bfdbfe', label: 'Modrá' },
  { bg: '#fbcfe8', label: 'Růžová' },
  { bg: '#fde68a', label: 'Oranžová' },
  { bg: 'transparent', label: 'Zrušit' },
];

interface RichQuestionEditorProps {
  value: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onBlur?: (e: React.FocusEvent) => void;
  autoFocus?: boolean;
}

function RichQuestionEditor({ value, onChange, style, placeholder, onKeyDown, onBlur, autoFocus }: RichQuestionEditorProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const lastHtmlRef = useRef('');
  const [showBubble,     setShowBubble]     = useState(false);
  const [bubblePos,      setBubblePos]      = useState<{ top: number; left: number } | null>(null);
  const [showHighlights, setShowHighlights] = useState(false);

  // Sync external value → innerHTML (only when value changes from outside)
  useEffect(() => {
    const el = editableRef.current;
    const safeValue = value ?? '';
    const newHtml = normalizeRichHtml(mdToRichHtml(safeValue));
    if (!el || newHtml === lastHtmlRef.current) return;
    lastHtmlRef.current = newHtml;
    if (el.innerHTML !== newHtml) el.innerHTML = newHtml;
  }, [value]);

  // Auto-focus + move cursor to end
  useEffect(() => {
    if (!autoFocus || !editableRef.current) return;
    const el = editableRef.current;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [autoFocus]);

  const syncToMd = useCallback(() => {
    const el = editableRef.current;
    if (!el) return;
    const html = richHtmlToMd(el.innerHTML);
    lastHtmlRef.current = html;
    onChange(html);
  }, [onChange]);

  const checkSel = useCallback(() => {
    const sel = window.getSelection();
    const el  = editableRef.current;
    if (!sel || sel.isCollapsed || !sel.rangeCount || !el) { setShowBubble(false); return; }
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) { setShowBubble(false); return; }
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) { setShowBubble(false); return; }
    setShowBubble(true);
    setBubblePos({ top: rect.top - 52, left: rect.left + rect.width / 2 });
  }, []);

  const applyFmt = useCallback((cmd: string, val?: string) => {
    const el = editableRef.current;
    if (!el) return;
    el.focus();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(cmd, false, val);
    syncToMd();
    setShowBubble(false);
    setShowHighlights(false);
  }, [syncToMd]);

  const bubble = showBubble && bubblePos ? createPortal(
    <div
      data-toolbar-element="true"
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        top: Math.max(8, bubblePos.top),
        left: bubblePos.left,
        transform: 'translateX(-50%)',
        zIndex: 99999,
        background: 'white',
        borderRadius: '10px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '4px 8px',
        height: '40px',
        userSelect: 'none',
      }}
    >
      <RichBubbleBtn title="Tučné"     onClick={() => applyFmt('bold')}><Bold     size={14} strokeWidth={2.5} /></RichBubbleBtn>
      <RichBubbleBtn title="Kurzíva"   onClick={() => applyFmt('italic')}><Italic   size={14} /></RichBubbleBtn>
      <RichBubbleBtn title="Podtržené" onClick={() => applyFmt('underline')}><Underline size={14} /></RichBubbleBtn>
      <div style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 4px' }} />
      <div style={{ position: 'relative' }}>
        <RichBubbleBtn title="Zvýraznit" onClick={() => setShowHighlights(v => !v)}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 4, background: '#fef08a', fontWeight: 700, fontSize: 12, color: '#78350f' }}>A</span>
        </RichBubbleBtn>
        {showHighlights && (
          <div
            data-toolbar-element="true"
            onMouseDown={(e) => e.preventDefault()}
            style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6, background: 'white', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', display: 'flex', gap: 6, padding: '8px 10px' }}
          >
            {RICH_HIGHLIGHTS.map(({ bg, label }) => (
              <button
                key={bg}
                title={label}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (bg === 'transparent') applyFmt('removeFormat');
                  else applyFmt('backColor', bg);
                }}
                style={{ width: 24, height: 24, borderRadius: '50%', background: bg === 'transparent' ? 'white' : bg, border: bg === 'transparent' ? '2px solid #e2e8f0' : '2px solid transparent', cursor: 'pointer', position: 'relative', flexShrink: 0 }}
              >
                {bg === 'transparent' && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: 16, fontWeight: 700, lineHeight: 1 }}>×</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ position: 'relative', minHeight: '1.5em' }}>
      {!value && placeholder && (
        <span style={{ ...style, position: 'absolute', top: 0, left: 0, pointerEvents: 'none', color: '#94a3b8' }}>{placeholder}</span>
      )}
      <div
        ref={editableRef}
        contentEditable
        suppressContentEditableWarning
        onInput={syncToMd}
        onMouseUp={checkSel}
        onKeyUp={(e) => { checkSel(); onKeyDown?.(e as any); }}
        onBlur={(e) => {
          setTimeout(() => {
            if (!(document.activeElement as HTMLElement)?.closest?.('[data-toolbar-element]')) {
              setShowBubble(false);
              setShowHighlights(false);
            }
          }, 150);
          onBlur?.(e);
        }}
        style={{ ...style, outline: 'none', minHeight: '1.5em', wordBreak: 'break-word' }}
      />
      {bubble}
    </div>
  );
}

// ============================================
// RICH HTML EDITOR
// contenteditable that works directly with HTML (no markdown conversion),
// with a floating Bold/Italic/Underline/Highlight bubble toolbar on selection.
// Used by ParagraphEditor and InfoboxEditor.
// ============================================
function normalizeRichBlockHtml(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined') return html;

  const root = document.createElement('div');
  root.innerHTML = html;

  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    el.style.removeProperty('font-size');
    el.style.removeProperty('font-family');
    el.style.removeProperty('line-height');
    el.style.removeProperty('letter-spacing');
    el.style.removeProperty('color');
    el.style.removeProperty('text-align');

    if (!el.getAttribute('style')?.trim()) {
      el.removeAttribute('style');
    }
  });

  return root.innerHTML;
}

interface RichHtmlEditorProps {
  value: string;
  onChange: (html: string) => void;
  style?: React.CSSProperties;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onEnterAtCaret?: (charIndex: number, currentHtml?: string) => void;
  onBlur?: (e: React.FocusEvent) => void;
  autoFocus?: boolean;
}

function RichHtmlEditor({ value, onChange, style, placeholder, onKeyDown, onEnterAtCaret, onBlur, autoFocus }: RichHtmlEditorProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const lastHtmlRef = useRef('');
  const [showBubble, setShowBubble] = useState(false);
  const [bubblePos, setBubblePos] = useState<{ top: number; left: number } | null>(null);
  const [showHighlights, setShowHighlights] = useState(false);

  // Sync external HTML value → innerHTML (only when changed from outside)
  useEffect(() => {
    const el = editableRef.current;
    const safeVal = normalizeRichBlockHtml(value ?? '');
    if (!el || safeVal === lastHtmlRef.current) return;
    lastHtmlRef.current = safeVal;
    if (el.innerHTML !== safeVal) el.innerHTML = safeVal;
  }, [value]);

  // Auto-focus + move cursor to end
  useEffect(() => {
    if (!autoFocus || !editableRef.current) return;
    const el = editableRef.current;
    // Use requestAnimationFrame to avoid layout thrash during mount
    requestAnimationFrame(() => {
      el.focus({ preventScroll: true });
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
  }, [autoFocus]);

  const syncHtml = useCallback(() => {
    const el = editableRef.current;
    if (!el) return;
    const html = normalizeRichBlockHtml(el.innerHTML);
    lastHtmlRef.current = html;
    onChange(html);
  }, [onChange]);

  const getCaretCharIndex = useCallback((): number | null => {
    const el = editableRef.current;
    const sel = window.getSelection();
    if (!el || !sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer)) return null;
    const probe = range.cloneRange();
    probe.selectNodeContents(el);
    probe.setEnd(range.startContainer, range.startOffset);
    return probe.toString().length;
  }, []);

  const checkSel = useCallback(() => {
    const sel = window.getSelection();
    const el = editableRef.current;
    if (!sel || sel.isCollapsed || !sel.rangeCount || !el) { setShowBubble(false); return; }
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) { setShowBubble(false); return; }
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) { setShowBubble(false); return; }
    setShowBubble(true);
    setBubblePos({ top: rect.top - 52, left: rect.left + rect.width / 2 });
  }, []);

  const applyFmt = useCallback((cmd: string, val?: string) => {
    const el = editableRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(cmd, false, val);
    syncHtml();
    setShowBubble(false);
    setShowHighlights(false);
  }, [syncHtml]);

  const bubble = showBubble && bubblePos ? createPortal(
    <div
      data-toolbar-element="true"
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        top: Math.max(8, bubblePos.top),
        left: bubblePos.left,
        transform: 'translateX(-50%)',
        zIndex: 99999,
        background: 'white',
        borderRadius: '10px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '4px 8px',
        height: '40px',
        userSelect: 'none',
      }}
    >
      <RichBubbleBtn title="Tučné"     onClick={() => applyFmt('bold')}><Bold     size={14} strokeWidth={2.5} /></RichBubbleBtn>
      <RichBubbleBtn title="Kurzíva"   onClick={() => applyFmt('italic')}><Italic   size={14} /></RichBubbleBtn>
      <RichBubbleBtn title="Podtržené" onClick={() => applyFmt('underline')}><Underline size={14} /></RichBubbleBtn>
      <div style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 4px' }} />
      <div style={{ position: 'relative' }}>
        <RichBubbleBtn title="Zvýraznit" onClick={() => setShowHighlights(v => !v)}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 4, background: '#fef08a', fontWeight: 700, fontSize: 12, color: '#78350f' }}>A</span>
        </RichBubbleBtn>
        {showHighlights && (
          <div
            data-toolbar-element="true"
            onMouseDown={(e) => e.preventDefault()}
            style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6, background: 'white', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', display: 'flex', gap: 6, padding: '8px 10px' }}
          >
            {RICH_HIGHLIGHTS.map(({ bg, label }) => (
              <button
                key={bg}
                title={label}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (bg === 'transparent') applyFmt('removeFormat');
                  else applyFmt('backColor', bg);
                }}
                style={{ width: 24, height: 24, borderRadius: '50%', background: bg === 'transparent' ? 'white' : bg, border: bg === 'transparent' ? '2px solid #e2e8f0' : '2px solid transparent', cursor: 'pointer', position: 'relative', flexShrink: 0 }}
              >
                {bg === 'transparent' && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: 16, fontWeight: 700, lineHeight: 1 }}>×</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ position: 'relative', minHeight: '1.5em' }}>
      {!value && placeholder && (
        <span style={{ ...style, position: 'absolute', top: 0, left: 0, pointerEvents: 'none', color: '#94a3b8' }}>{placeholder}</span>
      )}
      <div
        ref={editableRef}
        className="worksheet-rich-html-editor"
        contentEditable
        suppressContentEditableWarning
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnterAtCaret && (e.metaKey || e.ctrlKey || e.altKey)) {
            e.preventDefault();
            const el = editableRef.current;
            const html = normalizeRichBlockHtml(el?.innerHTML || value || '');
            lastHtmlRef.current = html;
            onChange(html);
            onEnterAtCaret(getCaretCharIndex() ?? 0, html);
            return;
          }
          onKeyDown?.(e as any);
        }}
        onInput={syncHtml}
        onMouseUp={checkSel}
        onKeyUp={() => { checkSel(); }}
        onBlur={(e) => {
          setTimeout(() => {
            if (!(document.activeElement as HTMLElement)?.closest?.('[data-toolbar-element]')) {
              setShowBubble(false);
              setShowHighlights(false);
            }
          }, 150);
          onBlur?.(e);
        }}
        style={{ ...style, outline: 'none', minHeight: '1.5em', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
      />
      {bubble}
    </div>
  );
}


// ============================================
// MULTIPLE CHOICE EDITOR
// ============================================

interface MultipleChoiceEditorProps {
  content: {
    question: string;
    options: ChoiceOption[];
    correctAnswers: string[];
    allowMultiple: boolean;
    explanation?: string;
  };
  isEditing: boolean;
  onUpdate: (content: any) => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  fontSizes: FontSizes;
  activityNumber?: number;
}

function MultipleChoiceEditor({ content, isEditing, onUpdate, onBlur, onKeyDown, fontSizes, activityNumber }: MultipleChoiceEditorProps) {
  const variant = content.variant || 'text';
  const gridColumns = content.gridColumns || 1;
  const letterPosition = content.letterPosition || 'bottom';

  // State for playful-image upload
  const [uploadingOptionId, setUploadingOptionId] = useState<string | null>(null);
  
  const { openAssetPicker, AssetPickerModal } = useAssetPicker({
    onSelect: (result) => {
      if (uploadingOptionId) {
        onUpdate({
          ...content,
          options: content.options.map(opt =>
            opt.id === uploadingOptionId ? { ...opt, imageUrl: result.url } : opt
          ),
        });
        setUploadingOptionId(null);
      }
    },
  });
  
  // Text styles for question
  const questionStyles: React.CSSProperties = {
    fontFamily: content.fontFamily || "'Fenomen Sans', sans-serif",
    fontSize: content.fontSize ? `${content.fontSize}pt` : fontSizes.title,
    fontWeight: content.fontWeight === 'bold' || content.isBold ? 'bold' : (content.fontWeight || '500'),
    color: content.textColor || '#1e293b',
    lineHeight: content.lineHeight || 1.2,
    letterSpacing: `${(content.letterSpacing || 0) / 100}em`,
    textAlign: content.align || 'left',
    fontStyle: content.isItalic ? 'italic' : 'normal',
    textDecoration: content.isUnderline ? 'underline' : 'none',
  };

  // Text styles for options
  const optionTextStyles: React.CSSProperties = {
    fontFamily: content.fontFamily || "'Fenomen Sans', sans-serif",
    fontSize: content.fontSize ? `${Math.max(8, content.fontSize * 0.85)}pt` : fontSizes.body,
    fontWeight: content.fontWeight === 'bold' || content.isBold ? 'bold' : 'normal',
    color: content.textColor || '#475569',
    lineHeight: content.lineHeight || 1.5,
    letterSpacing: `${(content.letterSpacing || 0) / 100}em`,
    fontStyle: content.isItalic ? 'italic' : 'normal',
    textDecoration: content.isUnderline ? 'underline' : 'none',
  };

  const correctAnswers = content.correctAnswers || [];
  const circleColor = content.circleColor || '#1e293b';
  const circleSize = content.circleSize || 21;

  const handleQuestionChange = (value: string) => {
    onUpdate(setQuestionHtml(content, value));
  };

  const handleOptionChange = (optionId: string, text: string) => {
    onUpdate({
      ...content,
      options: content.options.map(opt =>
        opt.id === optionId ? { ...opt, text } : opt
      ),
    });
  };

  const applyOptionFormat = (optionId: string, command: string) => {
    const option = content.options.find(o => o.id === optionId);
    if (!option) return;

    // We don't have refs for each option input, so we'll use a simpler approach
    // or just rely on the user manually typing markdown for now.
    // But since you asked for bold/italic on selection, I'll add a helper that
    // can be triggered if we find the active element.
    const activeEl = document.activeElement as HTMLInputElement;
    if (!activeEl || activeEl.tagName !== 'INPUT') return;

    const start = activeEl.selectionStart || 0;
    const end = activeEl.selectionEnd || 0;
    const text = activeEl.value;
    const selectedText = text.substring(start, end);

    if (!selectedText) return;

    let formattedText = '';
    switch (command) {
      case 'bold': formattedText = `**${selectedText}**`; break;
      case 'italic': formattedText = `*${selectedText}*`; break;
      case 'underline': formattedText = `<u>${selectedText}</u>`; break;
    }

    const newValue = text.substring(0, start) + formattedText + text.substring(end);
    handleOptionChange(optionId, newValue);
  };

  const removeOption = (optionId: string) => {
    if (content.options.length <= 2) return;
    onUpdate({
      ...content,
      options: content.options.filter(opt => opt.id !== optionId),
      correctAnswers: content.correctAnswers.filter(id => id !== optionId),
    });
  };

  // 1. ABC text
  const renderTextVariant = () => (
    <div 
      className="grid"
      style={{ 
        gridTemplateColumns: gridColumns === 4 
          ? 'repeat(auto-fill, minmax(160px, 1fr))' 
          : `repeat(${gridColumns}, minmax(0, 1fr))`,
        columnGap: '24px',
        rowGap: gridColumns <= 2 ? '12px' : '16px',
        marginTop: '12px'
      }}
    >
      {content.options.map((opt, i) => {
        const isCorrect = correctAnswers.includes(opt.id);
  return (
          <div key={opt.id} className="flex items-start gap-3 group/option min-w-0">
            {/* Circle with letter */}
          <div
              className={`flex items-center justify-center shrink-0 font-semibold choice-circle ${isCorrect ? 'choice-circle--correct' : ''}`}
            style={{ 
                width: `${circleSize}px`,
                height: `${circleSize}px`,
                minWidth: `${circleSize}px`,
                minHeight: `${circleSize}px`,
              borderRadius: '50%',
                border: isCorrect ? 'none' : `1.5px solid ${circleColor}`,
                color: isCorrect ? '#ffffff' : circleColor,
                backgroundColor: isCorrect ? '#22c55e' : 'transparent',
                fontSize: `${Math.round(circleSize * 0.57)}px`,
                marginTop: '2px'
            }}
          >
              {String.fromCharCode(65 + i)}
          </div>
            
            {/* Text area */}
            <div className="flex-1 min-w-0 leading-normal group/option-text relative">
          {isEditing ? (
                <div className="flex items-start gap-2 w-full relative">
                  <OptionTextEditor
                    value={opt.text}
                    onChange={(v) => handleOptionChange(opt.id, v)}
                    onBlur={onBlur}
                    style={{ ...optionTextStyles, lineHeight: optionTextStyles.lineHeight || 'normal' }}
                    placeholder={`Možnost ${i + 1}`}
                  />
                  {/* Mini format toolbar for options */}
                  <div className="absolute -top-7 left-0 flex items-center gap-1 bg-white border border-slate-200 rounded-md shadow-sm p-0.5 z-50 opacity-0 group-hover/option-text:opacity-100 transition-opacity">
                    <button
                      onMouseDown={(e) => { e.preventDefault(); applyOptionFormat(opt.id, 'bold'); }}
                      className="p-0.5 hover:bg-slate-100 rounded text-slate-600"
                    >
                      <Bold size={12} />
                    </button>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); applyOptionFormat(opt.id, 'italic'); }}
                      className="p-0.5 hover:bg-slate-100 rounded text-slate-600"
                    >
                      <Italic size={12} />
                    </button>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); applyOptionFormat(opt.id, 'underline'); }}
                      className="p-0.5 hover:bg-slate-100 rounded text-slate-600"
                    >
                      <Underline size={12} />
                    </button>
                  </div>
                  {content.options.length > 2 && (
                    <button
                      onClick={() => removeOption(opt.id)}
                      className="opacity-0 group-hover/option:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ) : (
                <div 
                  style={{ 
                    ...optionTextStyles, 
                    lineHeight: optionTextStyles.lineHeight || 'normal',
                    padding: 0,
                    margin: 0
                  }} 
                  className="break-words"
                >
                  {opt.text ? (
                    <LatexRenderer text={opt.text} />
              ) : (
                    <span className="text-slate-300 italic">Možnost {i + 1}...</span>
              )}
                </div>
          )}
        </div>
      </div>
        );
      })}
    </div>
  );

  // 2. ABC text + obr. (Mixed) AND 3. ABC obrázky
  const renderImageVariant = (isMixed: boolean) => (
        <div 
      className="grid gap-6 mt-4"
          style={{ 
        gridTemplateColumns: `repeat(${content.gridColumns || 4}, minmax(0, 1fr))` 
          }}
        >
          {content.options.map((opt, i) => {
            const isCorrect = correctAnswers.includes(opt.id);
            return (
          <div key={opt.id} className="relative group/opt flex flex-col">
            {/* Image Box */}
                <div 
              className="aspect-square bg-slate-50 rounded-xl border border-slate-300 relative mb-2"
              style={{ overflow: 'visible' }}
                >
              <div className="w-full h-full rounded-xl overflow-hidden relative">
                  {opt.imageUrl ? (
                  <img src={opt.imageUrl} className="w-full h-full object-cover" alt={opt.text} style={{ display: 'block' }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ImageIcon className="w-8 h-8 opacity-20" />
                    </div>
                  )}
                  {isEditing && (
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover/opt:opacity-100 transition-opacity pointer-events-none" />
                  )}
                </div>
                
              {/* Letter Overlay */}
              {letterPosition === 'overlay' && (
                <div
                  className={`flex items-center justify-center font-semibold choice-circle ${isCorrect ? 'choice-circle--correct' : ''}`}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    width: `${circleSize + 3}px`,
                    height: `${circleSize + 3}px`,
                    borderRadius: '50%',
                    border: isCorrect ? 'none' : `1.5px solid ${circleColor}`,
                    color: isCorrect ? '#ffffff' : circleColor,
                    backgroundColor: isCorrect ? '#22c55e' : 'rgba(255,255,255,0.95)',
                    fontSize: `${Math.round(circleSize * 0.57)}px`,
                    zIndex: 100,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    pointerEvents: 'none'
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </div>
              )}
            </div>
            
            {/* Bottom section (Letter and Text) */}
            <div className="flex items-start gap-2 px-1 min-h-[24px]">
              {/* Letter Bottom */}
              {letterPosition === 'bottom' && (
                  <div
                    className={`flex items-center justify-center shrink-0 font-semibold choice-circle ${isCorrect ? 'choice-circle--correct' : ''}`}
                    style={{
                    width: `${circleSize}px`,
                    height: `${circleSize}px`,
                    minWidth: `${circleSize}px`,
                    minHeight: `${circleSize}px`,
                      borderRadius: '50%',
                    border: isCorrect ? 'none' : `1.5px solid ${circleColor}`,
                    color: isCorrect ? '#ffffff' : circleColor,
                      backgroundColor: isCorrect ? '#22c55e' : 'transparent',
                    fontSize: `${Math.round(circleSize * 0.57)}px`,
                      marginTop: '1px'
                    }}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
              )}

              {/* Text - ONLY visible in Mixed variant */}
              {isMixed && (
                <div className="flex-1 min-w-0 leading-tight group/mixed-text relative">
                    {isEditing ? (
                    <div className="relative">
                      <OptionTextEditor
                        value={opt.text}
                        onChange={(v) => handleOptionChange(opt.id, v)}
                        onBlur={onBlur}
                        style={{ ...optionTextStyles, lineHeight: optionTextStyles.lineHeight || 'tight' }}
                        placeholder={`Možnost ${i + 1}`}
                      />
                      {/* Mini format toolbar for mixed options */}
                      <div className="absolute -top-7 left-0 flex items-center gap-1 bg-white border border-slate-200 rounded-md shadow-sm p-0.5 z-50 opacity-0 group-hover/mixed-text:opacity-100 transition-opacity">
                        <button
                          onMouseDown={(e) => { e.preventDefault(); applyOptionFormat(opt.id, 'bold'); }}
                          className="p-0.5 hover:bg-slate-100 rounded text-slate-600"
                        >
                          <Bold size={12} />
                        </button>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); applyOptionFormat(opt.id, 'italic'); }}
                          className="p-0.5 hover:bg-slate-100 rounded text-slate-600"
                        >
                          <Italic size={12} />
                        </button>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); applyOptionFormat(opt.id, 'underline'); }}
                          className="p-0.5 hover:bg-slate-100 rounded text-slate-600"
                        >
                          <Underline size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      style={{ 
                        ...optionTextStyles, 
                        lineHeight: optionTextStyles.lineHeight || 'tight',
                        padding: 0,
                        margin: 0
                      }} 
                      className="break-words"
                    >
                      {opt.text ? (
                        <LatexRenderer text={opt.text} />
                      ) : (
                        <span className="text-slate-300 italic">Možnost {i + 1}...</span>
                    )}
                  </div>
                  )}
                </div>
              )}
                </div>

            {/* Delete button when editing */}
                {isEditing && content.options.length > 2 && (
                  <button
                    onClick={() => removeOption(opt.id)}
                    className="absolute -top-2 -right-2 bg-white border border-slate-200 rounded-full p-1 shadow-sm text-slate-400 hover:text-red-500 opacity-0 group-hover/opt:opacity-100 transition-all z-20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
  );

  // 4. Ano / Ne (Boolean)
  const renderBooleanVariant = () => (
    <div 
      className="grid gap-x-6"
      style={{ 
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        rowGap: '12px',
        marginTop: '12px'
      }}
    >
      {[
        { id: 'opt-bool-0', text: 'Ano' },
        { id: 'opt-bool-1', text: 'Ne' }
      ].map((opt, i) => {
            const isCorrect = correctAnswers.includes(opt.id);
            return (
          <div 
            key={opt.id} 
            className="flex items-center gap-3 group/option cursor-pointer min-w-0"
            onClick={() => isEditing && onUpdate({ ...content, correctAnswers: [opt.id] })}
          >
                <div
                  className={`flex items-center justify-center shrink-0 font-semibold choice-circle ${isCorrect ? 'choice-circle--correct' : ''}`}
                  style={{
              width: `${circleSize}px`,
              height: `${circleSize}px`,
              minWidth: `${circleSize}px`,
              minHeight: `${circleSize}px`,
                    borderRadius: '50%',
              border: isCorrect ? 'none' : `1.5px solid ${circleColor}`,
              color: isCorrect ? '#ffffff' : circleColor,
                    backgroundColor: isCorrect ? '#22c55e' : 'transparent',
              fontSize: `${Math.round(circleSize * 0.57)}px`,
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </div>
                
            <div className="flex-1 leading-normal min-w-0">
              <div style={optionTextStyles} className="font-bold">
                {opt.text}
              </div>
            </div>
            </div>
        );
      })}
    </div>
  );

  // 5. Hravé ABC (Playful)
  const renderPlayfulVariant = () => {
    const playfulSettings = content.playfulSettings || {
      shape: 'circle' as const,
      style: 'stroke' as const,
      primaryColor: '#ef4444',
      textColor: '#ef4444',
      strokeWidth: 2,
      positions: [],
    };
    
    // Calculate container height based on number of options
    const optionCount = content.options.length;
    const rows = Math.ceil(optionCount / (optionCount <= 4 ? 2 : optionCount <= 6 ? 3 : 4));
    const containerHeight = Math.max(150, rows * 80 + 40);
    
    return (
      <div style={{ marginTop: '16px' }}>
        <PlayfulAnswersDisplay
          options={content.options}
          settings={playfulSettings}
          containerWidth={700}
          containerHeight={containerHeight}
          selectedAnswers={correctAnswers}
          onSelectAnswer={isEditing ? (optionId) => {
            onUpdate({ ...content, correctAnswers: [optionId] });
          } : undefined}
          isEditing={isEditing}
          onEditOption={isEditing ? (optionId, newText) => {
            onUpdate({
              ...content,
              options: content.options.map(opt =>
                opt.id === optionId ? { ...opt, text: newText } : opt
              ),
            });
          } : undefined}
          onUpdatePosition={isEditing ? (index, newPosition) => {
            const currentPositions = [...(content.playfulSettings?.positions || [])];
            currentPositions[index] = newPosition;
            onUpdate({
              ...content,
              playfulSettings: {
                ...playfulSettings,
                positions: currentPositions,
              },
            });
          } : undefined}
          baseFontSize={fontSizes.body}
        />
      </div>
    );
  };

  // 6. Hravé obrázky (Playful Images)
  const renderPlayfulImageVariant = () => {
    const playfulSettings = content.playfulSettings || {
      shape: 'circle' as const,
      style: 'stroke' as const,
      primaryColor: '#ef4444',
      textColor: '#ef4444',
      strokeWidth: 2,
      positions: [],
    };
    
    // Calculate container height based on number of options
    const optionCount = content.options.length;
    const rows = Math.ceil(optionCount / (optionCount <= 4 ? 2 : optionCount <= 6 ? 3 : 4));
    const containerHeight = Math.max(200, rows * 120 + 60);
    
    return (
      <div style={{ marginTop: '16px' }}>
        <PlayfulImagesDisplay
          options={content.options}
          settings={playfulSettings}
          containerWidth={700}
          containerHeight={containerHeight}
          selectedAnswers={correctAnswers}
          onSelectAnswer={(optionId) => {
            onUpdate({ ...content, correctAnswers: [optionId] });
          }}
          isEditing={isEditing}
          onUpdatePosition={isEditing ? (index, newPosition) => {
            const currentPositions = [...(content.playfulSettings?.positions || [])];
            currentPositions[index] = newPosition;
            onUpdate({
              ...content,
              playfulSettings: {
                ...playfulSettings,
                positions: currentPositions,
              },
            });
          } : undefined}
          onUploadImage={isEditing ? (optionId) => {
            setUploadingOptionId(optionId);
            openAssetPicker();
          } : undefined}
        />
        {AssetPickerModal}
      </div>
    );
  };

  return (
    <div style={{ fontSize: fontSizes.body }}>
      {/* Question section */}
      <div className="flex items-start gap-3 mb-3">
        {activityNumber && (
          <div
            className="flex items-center justify-center shrink-0 font-bold text-white activity-number-circle"
            style={{ 
              width: `${circleSize}px`,
              height: `${circleSize}px`,
              minWidth: `${circleSize}px`,
              minHeight: `${circleSize}px`,
              borderRadius: '50%',
              backgroundColor: circleColor,
              fontSize: `${Math.round(circleSize * 0.57)}px`,
            }}
          >
            {activityNumber}
          </div>
        )}
        <div className="flex-1 relative" style={{ ...questionStyles, minHeight: '1.5em' }}>
          {isEditing ? (
            <RichQuestionEditor
              value={getQuestionHtml(content)}
              onChange={handleQuestionChange}
              style={questionStyles}
              placeholder="Zadejte otázku..."
              onKeyDown={onKeyDown}
              onBlur={onBlur}
              autoFocus
            />
          ) : (
            getQuestionHtml(content) ? (
              <div
                className="worksheet-rich-html-content"
                style={{ ...questionStyles, minHeight: '1.5em' }}
                dangerouslySetInnerHTML={{ __html: preventOrphansInHtml(getQuestionHtml(content)) }}
              />
            ) : (
              <span className="text-slate-400">Otázka...</span>
            )
          )}
        </div>
        </div>

      {/* Answer options based on variant */}
      {(() => {
        switch (variant) {
          case 'text': return renderTextVariant();
          case 'mixed': return renderImageVariant(true);
          case 'image': return renderImageVariant(false);
          case 'boolean': return renderBooleanVariant();
          case 'playful': return renderPlayfulVariant();
          case 'playful-image': return renderPlayfulImageVariant();
          default: return renderTextVariant();
        }
      })()}
    </div>
  );
}

// ============================================
// FILL BLANK EDITOR
// ============================================

interface FillBlankEditorProps {
  content: {
    instruction?: string;
    segments: Array<
      | { type: 'text'; content: string }
      | { type: 'blank'; id: string; correctAnswer: string; acceptedAnswers?: string[] }
    >;
  };
  isEditing: boolean;
  onUpdate: (content: any) => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  fontSizes: FontSizes;
  activityNumber?: number;
}

function FillBlankEditor({ content, isEditing, onUpdate, onBlur, onKeyDown, fontSizes, activityNumber }: FillBlankEditorProps) {
  const instructionRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const activityLabelStyle = getActivityLabelStyle(fontSizes);

  // Convert segments to editable text with [brackets]
  const segmentsToText = (segments: FillBlankSegment[]) => {
    return segments.map(s => s.type === 'text' ? s.content : `[${s.correctAnswer}]`).join('');
  };

  // Convert editable text with [brackets] back to segments
  const textToSegments = (text: string): FillBlankSegment[] => {
    const segments: FillBlankSegment[] = [];
    const regex = /\[([^\]]+)\]/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', content: text.substring(lastIndex, match.index) });
      }
      segments.push({ 
        type: 'blank', 
        id: `blank-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, 
        correctAnswer: match[1] 
      });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      segments.push({ type: 'text', content: text.substring(lastIndex) });
    }

    return segments.length > 0 ? segments : [{ type: 'text', content: '' }];
  };

  useEffect(() => {
    if (isEditing && instructionRef.current) {
      instructionRef.current.focus();
    }
  }, [isEditing]);

  const [localText, setLocalText] = useState(segmentsToText(content.segments));

  useEffect(() => {
    if (!isEditing) {
      setLocalText(segmentsToText(content.segments));
    }
  }, [isEditing, content.segments]);

  const insertBlank = () => {
    if (!textRef.current) return;
    const start = textRef.current.selectionStart;
    const end = textRef.current.selectionEnd;
    const text = textRef.current.value;
    const selectedText = text.substring(start, end) || 'odpověď';
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = `${before}[${selectedText}]${after}`;
    
    setLocalText(newText);
    onUpdate({ ...content, segments: textToSegments(newText) });
    
    // Focus back and select the placeholder text inside brackets
    setTimeout(() => {
      if (textRef.current) {
        textRef.current.focus();
        textRef.current.setSelectionRange(start + 1, start + 1 + selectedText.length);
      }
    }, 0);
  };

  return (
    <div style={{ fontSize: fontSizes.body }}>
      <div className="flex items-start gap-3">
        {activityNumber && (
          <div
            className="flex items-center justify-center shrink-0 font-bold text-white"
            style={{ 
              width: '21px',
              height: '21px',
              minWidth: '21px',
              minHeight: '21px',
              borderRadius: '50%',
              backgroundColor: '#1e293b',
              fontSize: '12px',
            }}
          >
            {activityNumber}
          </div>
        )}
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border-2 border-slate-100">
              <div className="flex items-center justify-between gap-4">
                <input
                  ref={instructionRef}
                  type="text"
                  value={content.instruction || ''}
                  onChange={(e) => onUpdate({ ...content, instruction: e.target.value })}
                  onKeyDown={onKeyDown}
                  className="flex-1 text-slate-500 bg-transparent border-none outline-none font-medium"
                  style={activityLabelStyle}
                  placeholder="Instrukce (např. Doplňte chybějící slova)..."
                />
                <button
                  onClick={insertBlank}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-purple-600 hover:border-purple-300 hover:bg-purple-50 transition-all shadow-sm shrink-0"
                >
                  <Plus size={14} />
                  Vytvořit mezeru
                </button>
              </div>
              
              <textarea
                ref={textRef}
                value={localText}
                onChange={(e) => {
                  setLocalText(e.target.value);
                  onUpdate({ ...content, segments: textToSegments(e.target.value) });
                }}
                className="w-full bg-white p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-purple-500/20 text-slate-700 min-h-[120px] resize-none shadow-inner"
                style={{ fontSize: fontSizes.body }}
                placeholder="Napište text a slova k doplnění dejte do hranatých závorek, např. [slovo]..."
              />
              
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <Info size={12} />
                <span>Tip: Označte slovo a klikněte na „Vytvořit mezeru“ nebo pište přímo <strong>[slovo]</strong>.</span>
              </div>
            </div>
          ) : (
            <>
              {content.instruction && (
                <p className="text-slate-500 mb-2 font-medium" style={activityLabelStyle}>
                  <LatexRenderer text={content.instruction} />
                </p>
              )}
              <p className="text-slate-700 leading-relaxed" style={{ fontSize: fontSizes.body }}>
                {content.segments.map((seg, i) => (
                  <span key={i}>
                    {seg.type === 'text' ? (
                      <LatexRenderer text={seg.content} />
                    ) : (
                      <span className="inline-block min-w-[80px] border-b-2 border-slate-400 text-center mx-1 px-1">
                        <span className="text-slate-400 opacity-0 print:opacity-0" style={{ fontSize: fontSizes.small }}>{seg.correctAnswer || '...'}</span>
                      </span>
                    )}
                  </span>
                ))}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// FREE ANSWER EDITOR
// ============================================

interface FreeAnswerEditorProps {
  content: {
    question: string;
    lines: number;
    hint?: string;
    sampleAnswer?: string;
    subQuestions?: FreeAnswerSubQuestion[];
    subColumns?: 1 | 2 | 3;
    subLabelType?: SubQuestionLabelType;
    subQuestionColors?: string[];
    subShowBackground?: boolean;
    subShowLines?: boolean;
    subLabelStyle?: SubQuestionLabelStyle;
    subLabelColors?: string[];
    subAnswerLines?: number;
    subAnswerStyle?: 'dotted' | 'solid' | 'space' | 'none' | 'inline-line';
    subIndent?: boolean;
    subBackgroundMode?: 'fill' | 'outline';
    subShadow?: 'none' | 'sm' | 'md';
    subBorderRadius?: number;
    // Font settings (from block content)
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    lineHeight?: number;
    letterSpacing?: number;
    textColor?: string;
    // Sub-question font settings
    subFontSize?: number;
    subFontWeight?: string;
    subFontFamily?: string;
  };
  isEditing: boolean;
  onUpdate: (content: any) => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  fontSizes: FontSizes;
  activityNumber?: number;
}

function toRoman(num: number): string {
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let r = '';
  for (let i = 0; i < vals.length; i++) { while (num >= vals[i]) { r += syms[i]; num -= vals[i]; } }
  return r;
}

function getSubQuestionLabel(index: number, labelType: SubQuestionLabelType): string {
  if (labelType === 'letters') return String.fromCharCode(65 + index);
  if (labelType === 'numbers') return String(index + 1);
  if (labelType === 'roman') return toRoman(index + 1);
  return '';
}

const DEFAULT_SUB_QUESTION_COLORS = ['#dbeafe', '#dbeafe', '#dbeafe', '#dbeafe', '#dbeafe', '#dbeafe', '#fef3c7', '#fef3c7'];
const DEFAULT_SUB_LABEL_COLOR = '#e11d48';

function FreeAnswerEditor({ content, isEditing, onUpdate, onBlur, onKeyDown, fontSizes, activityNumber }: FreeAnswerEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef(content);
  contentRef.current = content;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const [selectedSubQ, setSelectedSubQ] = useState<number | null>(null);
  const [resizingSubQ, setResizingSubQ] = useState<number | null>(null);
  const [resizingWidthIdx, setResizingWidthIdx] = useState<number | null>(null);
  const hasSubQuestions = content.subQuestions && content.subQuestions.length > 0;
  const showBg = content.subShowBackground !== false;
  const answerStyle = content.subAnswerStyle || (content.subShowLines === false ? 'none' : 'dotted');
  const globalLines = content.subAnswerLines || 1;
  const labelStyle = content.subLabelStyle || 'text';
  const bgMode = content.subBackgroundMode || 'fill';
  const subShadow = content.subShadow || 'none';
  const subBorderRadius = content.subBorderRadius ?? 10;
  const columns = content.subColumns || 1;
  const defaultWidth = Math.floor(100 / columns);
  const hasVisualStyle = showBg || content.subOutlineEnabled === true;
  const gap = hasVisualStyle ? 16 : 12;

  // Question font styles (from block content settings)
  const questionFontStyle: React.CSSProperties = {
    fontFamily: content.fontFamily || FONT_FAMILY,
    fontSize: content.fontSize ? `${content.fontSize}pt` : fontSizes.title,
    fontWeight: content.fontWeight || '500',
    lineHeight: content.lineHeight || 1.4,
    letterSpacing: content.letterSpacing ? `${content.letterSpacing / 100}em` : undefined,
    color: content.textColor || '#1e293b',
  };

  // Sub-question font styles (from sub-specific settings, falling back to block font)
  const subFontStyle: React.CSSProperties = {
    fontFamily: content.subFontFamily || content.fontFamily || FONT_FAMILY,
    fontSize: content.subFontSize ? `${content.subFontSize}pt` : (content.fontSize ? `${content.fontSize}pt` : fontSizes.body),
    fontWeight: content.subFontWeight || content.fontWeight || 'normal',
    color: content.textColor || '#334155',
  };

  const handleSubQuestionUpdate = (index: number, field: string, value: string) => {
    if (!content.subQuestions) return;
    const updated = [...content.subQuestions];
    updated[index] = { ...updated[index], [field]: value };
    onUpdate({ ...content, subQuestions: updated });
  };

  // In "skupina otázek" mode (subQuestions + empty question), hide the main question header entirely.
  const isSkupina = hasSubQuestions && !content.question;

  return (
    <div style={{ fontSize: fontSizes.body }} onClick={() => setSelectedSubQ(null)}>
      {/* Main question / instruction – hidden in "skupina otázek" mode */}
      {!isSkupina && <div className="flex items-start gap-3 mb-3">
        {activityNumber && (
          <div
            className="flex items-center justify-center shrink-0 font-bold text-white"
            style={{ 
              width: '21px',
              height: '21px',
              minWidth: '21px',
              minHeight: '21px',
              borderRadius: '50%',
              backgroundColor: '#1e293b',
              fontSize: '12px',
            }}
          >
            {activityNumber}
          </div>
        )}
        <div className="flex-1" style={{ ...questionFontStyle, minHeight: '1.5em' }}>
          {isEditing ? (
            <RichQuestionEditor
              value={getQuestionHtml(content)}
              onChange={(v) => onUpdate(setQuestionHtml(content, v))}
              style={questionFontStyle}
              placeholder="Zadejte otázku..."
              onKeyDown={onKeyDown}
              onBlur={onBlur}
              autoFocus
            />
          ) : (
            getQuestionHtml(content) ? (
              <div
                className="worksheet-rich-html-content"
                style={{ ...questionFontStyle, minHeight: '1.5em' }}
                dangerouslySetInnerHTML={{ __html: preventOrphansInHtml(getQuestionHtml(content)) }}
              />
            ) : (
              <span className="text-slate-400">Otázka...</span>
            )
          )}
        </div>
      </div>}

      {content.hint && !isSkupina && (
        <p className="mb-1 italic" style={{ fontSize: fontSizes.small, paddingLeft: activityNumber ? '40px' : 0, color: content.textColor ? `${content.textColor}99` : '#64748b', fontFamily: questionFontStyle.fontFamily }}>
          <LatexRenderer text={content.hint} />
        </p>
      )}

      {/* Sub-questions flex layout */}
      {hasSubQuestions ? (
        <div
          ref={containerRef}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            gap: `${gap}px`,
            marginLeft: (activityNumber && !isSkupina && content.subIndent !== false) ? '40px' : 0,
            marginTop: '8px',
            overflow: 'visible',
          }}
        >
          {content.subQuestions!.map((sq, i) => {
            const bgColors = content.subQuestionColors || DEFAULT_SUB_QUESTION_COLORS;
            const bgColor = showBg ? (bgColors[i % bgColors.length] || '#dbeafe') : 'transparent';
            const labelType = content.subLabelType || 'letters';
            const label = getSubQuestionLabel(i, labelType);
            const labelColors = content.subLabelColors || [DEFAULT_SUB_LABEL_COLOR];
            const labelColor = sq.labelColor || labelColors[i % labelColors.length] || DEFAULT_SUB_LABEL_COLOR;
            const isOutline = labelStyle === 'circle-outline';
            const isCircle = labelStyle === 'circle' || isOutline;

            const isBeside = sq.imagePosition === 'beside';

            const sqLines = sq.lines !== undefined ? sq.lines : globalLines;
            const isSelected = selectedSubQ === i && isEditing;
            const shadowMap = { none: 'none', sm: '0 1px 3px rgba(0,0,0,0.12)', md: '0 4px 12px rgba(0,0,0,0.15)' };
            const sqWidth = sq.widthPercent ?? defaultWidth;
            const gapAdjust = columns > 1 ? `${gap * (columns - 1) / columns}px` : '0px';

            return (
              <div
                key={sq.id}
                onClick={(e) => { if (isEditing) { e.stopPropagation(); setSelectedSubQ(i); } }}
                style={{
                  width: `calc(${sqWidth}% - ${gapAdjust})`,
                  backgroundColor: showBg && bgMode === 'fill' ? bgColor : 'transparent',
                  border: (() => {
                    const outlineOn = content.subOutlineEnabled === true;
                    const outlineColors = content.subOutlineColors || ['#3b82f6'];
                    const oColor = outlineColors[i % outlineColors.length];
                    if (outlineOn) return `2px solid ${oColor}`;
                    if (showBg && bgMode === 'outline') return `2px solid ${bgColor}`;
                    if (isSelected) return '2px solid #6366f1';
                    if (showBg) return '2px solid transparent';
                    return 'none';
                  })(),
                  borderRadius: (showBg || content.subOutlineEnabled) ? `${subBorderRadius}px` : '0',
                  padding: (showBg || content.subOutlineEnabled) ? '10px 12px' : '4px 0',
                  display: 'flex',
                  flexDirection: isBeside && sq.imageUrl ? 'row' : 'column',
                  gap: isBeside && sq.imageUrl ? '10px' : '4px',
                  boxShadow: (showBg || content.subOutlineEnabled) ? shadowMap[subShadow] : 'none',
                  position: 'relative',
                  overflow: 'visible',
                  cursor: isEditing ? 'pointer' : undefined,
                  transition: 'border-color 0.15s',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div className="flex items-start gap-2">
                    {label && isCircle && (
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          minWidth: '24px',
                          borderRadius: '50%',
                          backgroundColor: isOutline ? 'transparent' : labelColor,
                          border: isOutline ? `2px solid ${labelColor}` : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isOutline ? labelColor : 'white',
                          fontSize: '12px',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {label}
                      </div>
                    )}
                    {label && !isCircle && (
                      <span style={{ fontWeight: 700, fontSize: fontSizes.body, color: '#334155', flexShrink: 0 }}>
                        {label})
                      </span>
                    )}
                    <div style={{ minWidth: 0, flex: '1 1 0%' }}>
                      {isEditing ? (
                        <OptionTextEditor
                          value={sq.text}
                          onChange={(v) => handleSubQuestionUpdate(i, 'text', v)}
                          style={{ ...subFontStyle, width: '100%' }}
                          placeholder="Text pod-otázky..."
                        />
                      ) : (
                        <span style={{ ...subFontStyle }}>
                          <LatexRenderer text={sq.text || 'Pod-otázka...'} />
                        </span>
                      )}
                      {/* Inline line – shown below wrapped text */}
                      {answerStyle === 'inline-line' && (
                        <div
                          style={{
                            height: '2px',
                            backgroundColor: `${labelColor}44`,
                            borderRadius: '2px',
                            marginTop: '4px',
                            width: '100%',
                          }}
                        />
                      )}
                    </div>
                  </div>
                  {/* Image below text */}
                  {sq.imageUrl && !isBeside && (() => {
                    const siShape = content.subImageShape || 'rectangle';
                    const siRadius = content.subImageBorderRadius ?? 8;
                    const siStrokeColor = content.subImageStrokeColor || '#334155';
                    const siStrokeWidth = content.subImageStrokeWidth ?? 0;
                    const siRotate = content.subImageRotate ?? false;
                    const siRotateMax = content.subImageRotateMax ?? 5;
                    const siHeight = content.subImageHeight || 140;
                    const siZoom: number = (content as any).subImageZoom ?? 100;
                    const siZoomScale = siZoom / 100;
                    const siOffX: number = (sq as any).imageOffsetX ?? 0;
                    const siOffY: number = (sq as any).imageOffsetY ?? 0;
                    const siTransform = (siZoom > 100 || siOffX !== 0 || siOffY !== 0)
                      ? `translate(${siOffX}px, ${siOffY}px) scale(${siZoomScale})`
                      : undefined;
                    const siClipPath = (GALLERY_CLIP_PATHS as Record<string, string>)[siShape] || '';
                    const siIsRect = siShape === 'rectangle';
                    const siRotDeg = siRotate
                      ? (((i * 137 + 29) % (siRotateMax * 2 + 1)) - siRotateMax)
                      : 0;
                    const siDropShadow = (!siIsRect && siStrokeWidth > 0)
                      ? `drop-shadow(0 0 ${siStrokeWidth}px ${siStrokeColor}) drop-shadow(0 0 ${Math.ceil(siStrokeWidth / 2)}px ${siStrokeColor})`
                      : undefined;
                    const handleSiPanStart = (e: React.MouseEvent) => {
                      if (!isEditing) return;
                      e.preventDefault(); e.stopPropagation();
                      let lx = e.clientX, ly = e.clientY;
                      const onMove = (mv: MouseEvent) => {
                        const nx = (siOffX + mv.clientX - lx), ny = (siOffY + mv.clientY - ly);
                        lx = mv.clientX; ly = mv.clientY;
                        const updated = [...(content.subQuestions || [])];
                        updated[i] = { ...updated[i], imageOffsetX: nx, imageOffsetY: ny } as any;
                        onUpdate({ ...content, subQuestions: updated });
                      };
                      const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                      document.addEventListener('mousemove', onMove);
                      document.addEventListener('mouseup', onUp);
                    };
                    return (
                      <div
                        style={{
                          marginTop: '6px',
                          transform: siRotDeg !== 0 ? `rotate(${siRotDeg}deg)` : undefined,
                        }}
                      >
                        <div style={{ filter: siDropShadow }}>
                          {siIsRect ? (
                            <div
                              style={{
                                position: 'relative',
                                width: '100%',
                                height: `${siHeight}px`,
                                borderRadius: `${siRadius}px`,
                                overflow: 'hidden',
                                backgroundColor: '#f8fafc',
                              }}
                            >
                              <img
                                src={sq.imageUrl}
                                alt=""
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  display: 'block',
                                  ...(siTransform ? { transform: siTransform, transformOrigin: 'center center' } : {}),
                                }}
                              />
                              {siStrokeWidth > 0 && (
                                <div style={{ position: 'absolute', inset: 0, borderRadius: `${siRadius}px`, boxShadow: `inset 0 0 0 ${siStrokeWidth}px ${siStrokeColor}`, pointerEvents: 'none', zIndex: 10 }} />
                              )}
                              {isEditing && (
                                <div onMouseDown={handleSiPanStart} style={{ position: 'absolute', inset: 0, cursor: 'grab', zIndex: 5, userSelect: 'none' }} />
                              )}
                            </div>
                          ) : (
                            <div style={{ position: 'relative', width: '100%', height: `${siHeight}px` }}>
                              <img
                                src={sq.imageUrl}
                                alt=""
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  display: 'block',
                                  clipPath: siClipPath,
                                  WebkitClipPath: siClipPath,
                                  ...(siTransform ? { transform: siTransform, transformOrigin: 'center center' } : {}),
                                } as React.CSSProperties}
                              />
                              {isEditing && (
                                <div onMouseDown={handleSiPanStart} style={{ position: 'absolute', inset: 0, cursor: 'grab', zIndex: 5, userSelect: 'none' }} />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  {/* Answer space – uses individual sq.lines if set, otherwise global */}
                  {answerStyle !== 'none' && answerStyle !== 'inline-line' && sqLines > 0 && (
                    <div style={{ marginTop: '4px', height: `${sqLines * 40}px`, position: 'relative' }}>
                      {answerStyle === 'dotted' && (
                        <PrintSafePattern variant="dotted" />
                      )}
                      {answerStyle === 'solid' && (
                        <PrintSafePattern variant="lined" lineSpacing={40} />
                      )}
                    </div>
                  )}
                </div>
                {/* Image beside text */}
                {sq.imageUrl && isBeside && (() => {
                  const siShape = content.subImageShape || 'rectangle';
                  const siRadius = content.subImageBorderRadius ?? 8;
                  const siStrokeColor = content.subImageStrokeColor || '#334155';
                  const siStrokeWidth = content.subImageStrokeWidth ?? 0;
                  const siHeight = content.subImageHeight || 100;
                  const siZoom: number = (content as any).subImageZoom ?? 100;
                  const siZoomScale = siZoom / 100;
                  const siOffX: number = (sq as any).imageOffsetX ?? 0;
                  const siOffY: number = (sq as any).imageOffsetY ?? 0;
                  const siTransform = (siZoom > 100 || siOffX !== 0 || siOffY !== 0)
                    ? `translate(${siOffX}px, ${siOffY}px) scale(${siZoomScale})`
                    : undefined;
                  const siClipPath = (GALLERY_CLIP_PATHS as Record<string, string>)[siShape] || '';
                  const siIsRect = siShape === 'rectangle';
                  const siDropShadow = (!siIsRect && siStrokeWidth > 0)
                    ? `drop-shadow(0 0 ${siStrokeWidth}px ${siStrokeColor}) drop-shadow(0 0 ${Math.ceil(siStrokeWidth / 2)}px ${siStrokeColor})`
                    : undefined;
                  const handleSiPanStart = (e: React.MouseEvent) => {
                    if (!isEditing) return;
                    e.preventDefault(); e.stopPropagation();
                    let lx = e.clientX, ly = e.clientY;
                    const onMove = (mv: MouseEvent) => {
                      const nx = (siOffX + mv.clientX - lx), ny = (siOffY + mv.clientY - ly);
                      lx = mv.clientX; ly = mv.clientY;
                      const updated = [...(content.subQuestions || [])];
                      updated[i] = { ...updated[i], imageOffsetX: nx, imageOffsetY: ny } as any;
                      onUpdate({ ...content, subQuestions: updated });
                    };
                    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                  };
                  return (
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      <div style={{ filter: siDropShadow }}>
                        {siIsRect ? (
                          <div
                            style={{
                              position: 'relative',
                              width: `${siHeight}px`,
                              height: `${siHeight}px`,
                              borderRadius: `${siRadius}px`,
                              overflow: 'hidden',
                              backgroundColor: '#f8fafc',
                            }}
                          >
                            <img
                              src={sq.imageUrl}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...(siTransform ? { transform: siTransform, transformOrigin: 'center center' } : {}) }}
                            />
                            {siStrokeWidth > 0 && (
                              <div style={{ position: 'absolute', inset: 0, borderRadius: `${siRadius}px`, boxShadow: `inset 0 0 0 ${siStrokeWidth}px ${siStrokeColor}`, pointerEvents: 'none', zIndex: 10 }} />
                            )}
                            {isEditing && (
                              <div onMouseDown={handleSiPanStart} style={{ position: 'absolute', inset: 0, cursor: 'grab', zIndex: 5, userSelect: 'none' }} />
                            )}
                          </div>
                        ) : (
                          <div style={{ position: 'relative', width: `${siHeight}px`, height: `${siHeight}px` }}>
                            <img
                              src={sq.imageUrl}
                              alt=""
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block',
                                clipPath: siClipPath,
                                WebkitClipPath: siClipPath,
                                ...(siTransform ? { transform: siTransform, transformOrigin: 'center center' } : {}),
                              } as React.CSSProperties}
                            />
                            {isEditing && (
                              <div onMouseDown={handleSiPanStart} style={{ position: 'absolute', inset: 0, cursor: 'grab', zIndex: 5, userSelect: 'none' }} />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {/* Resize handles */}
                {isEditing && (() => {
                  const pillColor = resizingSubQ === i ? '#4f46e5' : '#6366f1';
                  const pillOpacity = resizingSubQ === i || resizingWidthIdx === i ? 1 : 0.85;
                  const pillShadow = '0 1px 3px rgba(99,102,241,0.4)';
                  return (
                    <>
                      {/* Bottom handle – height resize */}
                      {answerStyle !== 'none' && answerStyle !== 'inline-line' && (
                        <div
                          data-editor-only="true"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setResizingSubQ(i);
                            setSelectedSubQ(i);
                            const startY = e.clientY;
                            const startLines = sqLines;
                            const idx = i;
                            const handleMove = (me: MouseEvent) => {
                              const delta = me.clientY - startY;
                              const newLines = Math.max(1, Math.min(20, Math.round(startLines + delta / 30)));
                              const cur = contentRef.current;
                              if (!cur.subQuestions) return;
                              const updated = [...cur.subQuestions];
                              updated[idx] = { ...updated[idx], lines: newLines };
                              onUpdateRef.current({ ...cur, subQuestions: updated });
                            };
                            const handleUp = () => {
                              setResizingSubQ(null);
                              document.removeEventListener('mousemove', handleMove);
                              document.removeEventListener('mouseup', handleUp);
                              document.body.style.cursor = '';
                              document.body.style.userSelect = '';
                            };
                            document.addEventListener('mousemove', handleMove);
                            document.addEventListener('mouseup', handleUp);
                            document.body.style.cursor = 'row-resize';
                            document.body.style.userSelect = 'none';
                          }}
                          style={{
                            position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)',
                            width: '64px', height: '16px', cursor: 'row-resize',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
                          }}
                        >
                          <div style={{
                            width: '48px', height: '8px', borderRadius: '4px',
                            backgroundColor: pillColor, opacity: pillOpacity,
                            transition: 'opacity 0.15s', boxShadow: pillShadow,
                          }} />
                        </div>
                      )}
                      {/* Right handle – individual width resize */}
                      {columns >= 2 && (
                        <div
                          data-editor-only="true"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setResizingWidthIdx(i);
                            setSelectedSubQ(i);
                            const startX = e.clientX;
                            const startW = sqWidth;
                            const idx = i;
                            const sqs = content.subQuestions || [];
                            const rowStart = Math.floor(idx / columns) * columns;
                            const rowEnd = Math.min(rowStart + columns, sqs.length);
                            const neighborIdx = (idx + 1 < rowEnd) ? idx + 1 : -1;
                            const hasNeighbor = neighborIdx >= 0 && sqs[neighborIdx];
                            const nW = hasNeighbor
                              ? (sqs[neighborIdx].widthPercent ?? defaultWidth)
                              : 0;
                            const totalRow = hasNeighbor ? startW + nW : 100;
                            const cw = containerRef.current?.clientWidth || 600;
                            const handleMove = (me: MouseEvent) => {
                              const deltaX = me.clientX - startX;
                              const deltaPct = (deltaX / cw) * 100;
                              const maxW = hasNeighbor ? totalRow - 15 : 100;
                              const newW = Math.max(15, Math.min(maxW, Math.round(startW + deltaPct)));
                              const cur = contentRef.current;
                              if (!cur.subQuestions) return;
                              const updated = [...cur.subQuestions];
                              updated[idx] = { ...updated[idx], widthPercent: newW };
                              if (hasNeighbor && updated[neighborIdx]) {
                                updated[neighborIdx] = { ...updated[neighborIdx], widthPercent: totalRow - newW };
                              }
                              onUpdateRef.current({ ...cur, subQuestions: updated });
                            };
                            const handleUp = () => {
                              setResizingWidthIdx(null);
                              document.removeEventListener('mousemove', handleMove);
                              document.removeEventListener('mouseup', handleUp);
                              document.body.style.cursor = '';
                              document.body.style.userSelect = '';
                            };
                            document.addEventListener('mousemove', handleMove);
                            document.addEventListener('mouseup', handleUp);
                            document.body.style.cursor = 'col-resize';
                            document.body.style.userSelect = 'none';
                          }}
                          style={{
                            position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)',
                            width: '18px', height: '64px', cursor: 'col-resize',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20,
                          }}
                        >
                          <div style={{
                            width: '8px', height: '48px', borderRadius: '4px',
                            backgroundColor: resizingWidthIdx === i ? '#4f46e5' : '#6366f1',
                            opacity: resizingWidthIdx === i ? 1 : 0.85,
                            transition: 'opacity 0.15s', boxShadow: pillShadow,
                          }} />
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            );
          })}
        </div>
      ) : (
        /* Original single answer lines */
        <div 
          className="mt-1"
          style={{ height: `${content.lines * 40}px`, marginLeft: activityNumber ? '40px' : 0 }}
        >
          {Array.from({ length: content.lines }).map((_, i) => (
            <div key={i} className="border-b border-slate-300" style={{ height: '40px' }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// SPACER EDITOR
// ============================================

interface SpacerEditorProps {
  content: {
    height: number;
    style: SpacerStyle;
  };
  isEditing: boolean;
  onUpdate: (content: any) => void;
}

function SpacerEditor({ content, isEditing, onUpdate }: SpacerEditorProps) {
  const [isResizing, setIsResizing] = useState(false);
  // Track height locally during drag for smoothness
  const [localHeight, setLocalHeight] = useState<number | null>(null);

  // Default values for safety
  const height = localHeight ?? content?.height ?? 100;
  const style = content?.style ?? 'empty';

  // Handle vertical resize drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startY = e.clientY;
    const startHeight = content?.height ?? 100;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startY;
      const newHeight = Math.max(20, Math.min(1000, startHeight + delta));
      setLocalHeight(newHeight);
      onUpdate({ height: newHeight, style });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setLocalHeight(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [content?.height, style, onUpdate]);

  // Render pattern based on style
  const renderPattern = () => {
    const lineSpacing = 40; // px between lines (increased by 70%)
    
    switch (style) {
      case 'dotted':
        return <PrintSafePattern key={`dotted-${height}`} variant="dotted" />;
      case 'lined':
        return <PrintSafePattern key={`lined-${height}`} variant="lined" lineSpacing={lineSpacing} />;
      case 'empty':
      default:
        return null;
    }
  };

  return (
    <div 
      className={`relative ${isEditing ? 'ring-1 ring-blue-400 ring-dashed' : ''}`}
      style={{ height }}
    >
      {renderPattern()}
      
      {/* Resize handle */}
      {isEditing && (
        <div
          onMouseDown={handleMouseDown}
          className={`
            absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-4 cursor-row-resize
            flex items-center justify-center
            z-[1000]
          `}
          style={{ bottom: -8 }}
        >
          <div 
            className={`
              w-10 h-3 rounded-full border-2 transition-colors
              ${isResizing 
                ? 'bg-blue-500 border-blue-500' 
                : 'bg-white border-slate-300 hover:border-blue-400'
              }
            `}
          />
        </div>
      )}
    </div>
  );
}

// ============================================
// QR CODE EDITOR
// ============================================

interface QRCodeEditorProps {
  content: QRCodeContent;
  isEditing: boolean;
  onUpdate: (content: QRCodeContent) => void;
}

function QRCodeEditor({ content, isEditing, onUpdate }: QRCodeEditorProps) {
  const { url, caption, captionPosition, size = 150 } = content;
  const inputRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && !url && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing, url]);

  return (
    <div className="flex flex-col gap-4 py-4">
      {isEditing ? (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Odkaz / Text pro QR kód</label>
              <input
                ref={inputRef}
                type="text"
                value={url}
                onChange={(e) => onUpdate({ ...content, url: e.target.value })}
                placeholder="https://vividbooks.com..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Popisek</label>
              <textarea
                ref={captionRef}
                value={caption}
                onChange={(e) => onUpdate({ ...content, caption: e.target.value })}
                placeholder="Naskenujte pro více informací..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none min-h-[60px]"
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className={`flex ${captionPosition === 'left' ? 'flex-row-reverse' : 'flex-col'} items-center gap-4 w-full`}>
        <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100 flex-shrink-0">
          {url ? (
            <QRCodeSVG value={url} size={size} level="M" includeMargin={false} />
          ) : (
            <div 
              className="bg-slate-50 flex items-center justify-center rounded border border-dashed border-slate-200"
              style={{ width: size, height: size }}
            >
              <QrCode className="w-8 h-8 text-slate-300" />
            </div>
          )}
        </div>
        
        {caption && (
          <div className={`text-slate-600 leading-relaxed flex-1 min-w-0 break-words ${captionPosition === 'left' ? 'text-left' : 'text-center'}`} style={{ fontSize: '11pt' }}>
            {caption}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// EXAMPLES EDITOR
// ============================================

interface ExamplesEditorProps {
  content: ExamplesContent;
  isEditing: boolean;
  onUpdate: (content: ExamplesContent) => void;
}

function ExamplesEditor({ content, isEditing, onUpdate }: ExamplesEditorProps) {
  const { examples, columns, labelType, showDifficultyColors } = content;
  const answerBoxStyle: AnswerBoxStyle = content.answerBoxStyle || 'block';
  const rowSpacing = content.rowSpacing || 16; // default 16px
  const fontSize = content.fontSize || 14; // default 14px
  const [editingId, setEditingId] = useState<string | null>(null);

  // Update single example expression
  const handleExpressionChange = (id: string, newExpression: string) => {
    const updatedExamples = examples.map(ex => 
      ex.id === id ? { ...ex, expression: newExpression } : ex
    );
    onUpdate({ ...content, examples: updatedExamples });
  };

  // Get label for example
  const getLabel = (index: number): string => {
    if (labelType === 'none') return '';
    if (labelType === 'numbers') return `${index + 1}`;
    // letters: A, B, C, ...
    return String.fromCharCode(65 + index);
  };

  // Get difficulty color
  const getDifficultyColor = (difficulty: ExampleDifficulty): string => {
    if (!showDifficultyColors) return '#9ca3af'; // gray-400 when colors off
    switch (difficulty) {
      case 'easy': return '#22c55e'; // green-500
      case 'medium': return '#f97316'; // orange-500
      case 'hard': return '#ef4444'; // red-500
      default: return '#9ca3af';
    }
  };

  // Get answer box background color
  const getAnswerBoxBg = (difficulty: ExampleDifficulty): string => {
    if (!showDifficultyColors) return '#f1f5f9'; // slate-100 when colors off
    switch (difficulty) {
      case 'easy': return '#dcfce7'; // green-100
      case 'medium': return '#ffedd5'; // orange-100
      case 'hard': return '#fee2e2'; // red-100
      default: return '#f1f5f9';
    }
  };

  // Get answer box border color for line style
  const getAnswerBoxBorder = (difficulty: ExampleDifficulty): string => {
    if (!showDifficultyColors) return '#9ca3af'; // gray-400 when colors off
    switch (difficulty) {
      case 'easy': return '#22c55e'; // green-500
      case 'medium': return '#f97316'; // orange-500
      case 'hard': return '#ef4444'; // red-500
      default: return '#9ca3af';
    }
  };

  // If no examples, show placeholder
  if (examples.length === 0) {
    return (
      <div 
        className={`
          flex items-center justify-center py-12 rounded-xl border-2 border-dashed
          ${isEditing ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}
        `}
      >
        <div className="text-center">
          <p className="text-slate-500 font-medium">Příklady</p>
          <p className="text-sm text-slate-400 mt-1">
            {isEditing 
              ? 'Klikněte na "Nastavení" a zadejte vzorový příklad'
              : 'Žádné příklady k zobrazení'
            }
          </p>
        </div>
      </div>
    );
  }

  // Calculate actual row spacing - bigger when answer boxes are shown
  const actualRowSpacing = answerBoxStyle !== 'none' ? rowSpacing + 8 : rowSpacing;

  return (
    <div 
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        columnGap: '32px',
        rowGap: `${actualRowSpacing}px`,
      }}
    >
      {examples.map((example, index) => (
        <div 
          key={example.id} 
          className="flex items-center gap-2"
        >
          {/* Label/bullet - only show if labelType is not 'none' */}
          {labelType !== 'none' && (
            <div 
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ 
                border: `2px solid ${getDifficultyColor(example.difficulty)}`,
              }}
            >
              <span 
                className="text-xs font-bold"
                style={{ color: getDifficultyColor(example.difficulty) }}
              >
                {getLabel(index)}
              </span>
            </div>
          )}

          {/* Bullet point for 'none' label type */}
          {labelType === 'none' && (
            <div 
              className="flex-shrink-0 w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: getDifficultyColor(example.difficulty) }}
            />
          )}

          {/* Expression - editable when clicked */}
          {editingId === example.id ? (
            <input
              type="text"
              value={example.expression}
              onChange={(e) => handleExpressionChange(example.id, e.target.value)}
              onBlur={() => setEditingId(null)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
              autoFocus
              className="text-slate-800 font-medium bg-blue-50 border border-blue-300 rounded px-1 outline-none"
              style={{ fontSize: `${fontSize}px`, minWidth: '80px' }}
            />
          ) : (
            <span 
              className="text-slate-800 font-medium whitespace-nowrap cursor-text hover:bg-slate-100 rounded px-1 -mx-1"
              style={{ fontSize: `${fontSize}px` }}
              onClick={() => isEditing && setEditingId(example.id)}
              title={isEditing ? 'Klikněte pro úpravu' : ''}
            >
              {example.expression}
            </span>
          )}

          {/* Answer box - block style */}
          {answerBoxStyle === 'block' && (
            <div 
              className="rounded-lg"
              style={{ 
                backgroundColor: getAnswerBoxBg(example.difficulty),
                minWidth: '60px',
                maxWidth: '90px',
                height: '28px',
                flex: 1,
              }}
            />
          )}

          {/* Answer box - line style */}
          {answerBoxStyle === 'line' && (
            <div 
              style={{ 
                borderBottom: `2px solid ${getAnswerBoxBorder(example.difficulty)}`,
                minWidth: '60px',
                maxWidth: '90px',
                height: '24px',
                flex: 1,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================
// IMAGE EDITOR
// ============================================

interface ImageEditorProps {
  content: ImageContent;
  isEditing: boolean;
  onUpdate: (content: any) => void;
}

// Clip-path definitions for gallery item shapes
const GALLERY_CLIP_PATHS: Record<string, string> = {
  rectangle: '',
  circle: 'circle(50% at 50% 50%)',
  triangle: 'polygon(50% 0%, 0% 100%, 100% 100%)',
  star: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  heart: 'polygon(50% 30%, 61% 15%, 72% 10%, 83% 13%, 90% 22%, 90% 32%, 82% 43%, 70% 55%, 58% 68%, 50% 78%, 42% 68%, 30% 55%, 18% 43%, 10% 32%, 10% 22%, 17% 13%, 28% 10%, 39% 15%)',
  'speech-bubble': 'polygon(0% 0%, 100% 0%, 100% 72%, 65% 72%, 50% 95%, 35% 72%, 0% 72%)',
};

function getGalleryItemLabel(index: number, type: string): string {
  if (type === 'letters') return String.fromCharCode(65 + index);
  if (type === 'numbers') return String(index + 1);
  if (type === 'roman') return toRoman(index + 1);
  return '';
}

function ImageEditor({ content, isEditing, onUpdate }: ImageEditorProps) {
  const { 
    url, 
    alt, 
    caption, 
    showCaption = true, 
    size = 100, 
    alignment = 'center',
    gallery = [],
    galleryLayout = 'grid',
    gridColumns = 2,
    containerHeight = 0,
    imageActivityType = 'none',
    galleryItemShape = 'rectangle',
    galleryBorderRadius = 8,
    galleryStrokeColor = '#334155',
    galleryStrokeWidth = 0,
    galleryRotate = false,
    galleryRotateMax = 5,
    galleryLabelType = 'none',
    galleryLabelColor = '#3b82f6',
  } = content as any;
  
  // Hooks must be before any early returns!
  const [isLoading, setIsLoading] = useState(true);
  const panDraggingRef = React.useRef<{ idx: number; lastX: number; lastY: number } | null>(null);
  const heightDraggingRef = React.useRef(false);
  const frameRefs = React.useRef<Record<number, HTMLDivElement | null>>({});
  const naturalSizeRefs = React.useRef<Record<number, { width: number; height: number }>>({});

  const handleImgPanStart = (e: React.MouseEvent, imgIdx: number) => {
    if (!isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    let lastX = e.clientX, lastY = e.clientY;
    const existingOffsets: { x: number; y: number }[] = (content as any).galleryOffsets || [];
    let curX = existingOffsets[imgIdx]?.x ?? 0;
    let curY = existingOffsets[imgIdx]?.y ?? 0;
    const onMove = (mv: MouseEvent) => {
      curX += mv.clientX - lastX;
      curY += mv.clientY - lastY;
      lastX = mv.clientX; lastY = mv.clientY;
      const clamped = clampImagePanOffset(imgIdx, curX, curY);
      curX = clamped.x;
      curY = clamped.y;
      const offs = [...existingOffsets];
      while (offs.length <= imgIdx) offs.push({ x: 0, y: 0 });
      offs[imgIdx] = { x: curX, y: curY };
      onUpdate({ ...content, galleryOffsets: offs } as any);
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleImgHeightDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    heightDraggingRef.current = true;
    const startY = e.clientY;
    const startH = containerHeight > 0 ? containerHeight : 250;
    const onMove = (mv: MouseEvent) => {
      if (!heightDraggingRef.current) return;
      const newH = Math.max(50, Math.min(800, Math.round(startH + mv.clientY - startY)));
      onUpdate({ ...content, containerHeight: newH } as any);
    };
    const onUp = () => { heightDraggingRef.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const slotIndexRef = React.useRef<number | null>(null);
  const { openAssetPicker, AssetPickerModal } = useAssetPicker({
    onSelect: (result) => {
      const idx = slotIndexRef.current;
      if (idx !== null) {
        const newGallery = [...(content.gallery || [])];
        newGallery[idx] = result.url;
        onUpdate({ ...content, url: newGallery[0] || result.url, gallery: newGallery });
        slotIndexRef.current = null;
      } else {
        onUpdate({ ...content, url: result.url, gallery: [result.url] });
      }
    },
  });
  const openAssetPickerForSlot = (idx: number) => {
    slotIndexRef.current = idx;
    openAssetPicker();
  };

  // Keep empty strings (placeholder slots) – filter only undefined/null
  const rawImages = gallery.length > 0 ? gallery : (url ? [url] : []);
  const displayImages = rawImages.filter(u => u !== undefined && u !== null);
  const hasGallery = displayImages.length > 1;

  // Size and Crop logic
  const zoomFactor = size > 100 ? size / 100 : 1;

  const getImagePanMetrics = React.useCallback((imgIdx: number) => {
    const frame = frameRefs.current[imgIdx];
    const natural = naturalSizeRefs.current[imgIdx];
    if (!frame || !natural || natural.width <= 0 || natural.height <= 0) {
      return null;
    }

    const frameRect = frame.getBoundingClientRect();
    const frameWidth = frameRect.width;
    const frameHeight = frameRect.height;
    if (frameWidth <= 0 || frameHeight <= 0) {
      return null;
    }

    const baseScale = Math.max(frameWidth / natural.width, frameHeight / natural.height);
    const renderedWidth = natural.width * baseScale * zoomFactor;
    const renderedHeight = natural.height * baseScale * zoomFactor;
    const maxOffsetX = Math.max(0, (renderedWidth - frameWidth) / 2);
    const maxOffsetY = Math.max(0, (renderedHeight - frameHeight) / 2);

    return { maxOffsetX, maxOffsetY };
  }, [zoomFactor]);

  const clampImagePanOffset = React.useCallback((imgIdx: number, x: number, y: number) => {
    const metrics = getImagePanMetrics(imgIdx);
    if (!metrics) {
      return { x, y };
    }
    const { maxOffsetX, maxOffsetY } = metrics;
    return {
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, x)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, y)),
    };
  }, [getImagePanMetrics]);

  const getImageObjectPosition = React.useCallback((imgIdx: number, x: number, y: number) => {
    const clamped = clampImagePanOffset(imgIdx, x, y);
    const metrics = getImagePanMetrics(imgIdx);
    if (!metrics) {
      return '50% 50%';
    }
    const posX = metrics.maxOffsetX > 0 ? 50 + (clamped.x / metrics.maxOffsetX) * 50 : 50;
    const posY = metrics.maxOffsetY > 0 ? 50 - (clamped.y / metrics.maxOffsetY) * 50 : 50;
    return {
      x: Math.max(0, Math.min(100, posX)),
      y: Math.max(0, Math.min(100, posY)),
    };
  }, [clampImagePanOffset, getImagePanMetrics]);
  
  // Pro galerii držíme šířku (obrázky na pozicích) a zmenšujeme jen výšku.
  // Pro samostatný obrázek zmenšujeme šířku standardně.
  const containerMaxWidth = (hasGallery || size > 100) ? '100%' : `${size}%`;

  // Alignment to justify-content mapping
  const alignmentToJustify: Record<string, string> = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
  };

  // No image URL and no gallery - show placeholder
  if (displayImages.length === 0) {
    return (
      <>
        <div 
          className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 w-full"
        >
          <ImageIcon className="w-12 h-12 text-slate-400 mb-2" />
          <p className="text-slate-500 text-sm mb-2">Žádný obrázek</p>
          {isEditing && (
            <button
              onClick={openAssetPicker}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
            >
              Vybrat obrázek
            </button>
          )}
        </div>
        
        {AssetPickerModal}
      </>
    );
  }

  const renderSingleImage = (imgUrl: string, index?: number) => {
    // Prázdný placeholder slot
    if (!imgUrl) {
      const baseH = containerHeight > 0 ? containerHeight : 200;
      const idx = index ?? 0;
      return (
        <div key={idx} style={{ position: 'relative', width: '100%' }}>
          <div
            onClick={() => openAssetPickerForSlot(idx)}
            style={{
              width: '100%', height: baseH,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: '#f1f5f9', border: '2px dashed #cbd5e1', borderRadius: 8,
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
          >
            <ImageIcon className="w-8 h-8 text-slate-400" />
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>Nahrát obrázek</span>
          </div>
          {/* X tlačítko pro smazání slotu */}
          {isEditing && (
            <button
              onClick={e => {
                e.stopPropagation();
                const newGallery = [...(content.gallery || [])];
                newGallery.splice(idx, 1);
                const newCaptions = [...(content.galleryCaptions || [])];
                newCaptions.splice(idx, 1);
                onUpdate({ ...content, gallery: newGallery, galleryCaptions: newCaptions, url: newGallery[0] || '' });
              }}
              style={{
                position: 'absolute', top: 6, right: 6,
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
              }}
            >
              <span style={{ color: 'white', fontSize: 13, lineHeight: 1 }}>×</span>
            </button>
          )}
        </div>
      );
    }

    // Základní výška pro mřížku (pokud není nastavena explicitně)
    const baseHeight = containerHeight > 0 ? containerHeight : 250;
    
    // Výpočet výšky: pro galerii měníme při size < 100 pouze výšku políček
    const currentHeight = hasGallery 
      ? (size < 100 ? (size / 100) * baseHeight : baseHeight)
      : (containerHeight > 0 ? containerHeight : 'auto');

    const itemCaption = (content.galleryCaptions || [])[index ?? 0];

    // Shape / clip-path
    const clipPath = GALLERY_CLIP_PATHS[galleryItemShape] || '';
    const isRect = galleryItemShape === 'rectangle';
    const borderRadiusCss = isRect ? `${galleryBorderRadius}px` : '0';

    // Rotation: deterministic per index so it's stable
    const idx = index ?? 0;
    const rotationDeg = galleryRotate
      ? (((idx * 137 + 29) % (galleryRotateMax * 2 + 1)) - galleryRotateMax)
      : 0;

    // Stroke: handled via dropShadowFilter for both rect and shape

    // Label
    const labelText = galleryLabelType !== 'none' ? getGalleryItemLabel(idx, galleryLabelType) : '';

    const imgH = typeof currentHeight === 'number' ? `${currentHeight}px` : currentHeight;
    const imgObjectFit = (hasGallery || size > 100 || containerHeight > 0) ? 'cover' : 'contain';
    const galleryOffsets: { x: number; y: number }[] = (content as any).galleryOffsets || [];
    const panX: number = galleryOffsets[idx]?.x ?? 0;
    const panY: number = galleryOffsets[idx]?.y ?? 0;
    const clampedPan = clampImagePanOffset(idx, panX, panY);
    const objectPosition = getImageObjectPosition(idx, clampedPan.x, clampedPan.y);
    const imgTransform = zoomFactor !== 1 ? `scale(${zoomFactor})` : 'none';
    const dropShadowFilter = (!isRect && galleryStrokeWidth > 0)
      ? `drop-shadow(0 0 ${galleryStrokeWidth}px ${galleryStrokeColor}) drop-shadow(0 0 ${Math.ceil(galleryStrokeWidth / 2)}px ${galleryStrokeColor})`
      : undefined;

    return (
      <div
        key={index ?? 0}
        className="relative w-full flex flex-col"
        style={{ transform: rotationDeg !== 0 ? `rotate(${rotationDeg}deg)` : undefined }}
      >
        {/* X tlačítko pro smazání obrázku z galerie */}
        {isEditing && (
          <button
            onClick={e => {
              e.stopPropagation();
              const newGallery = [...(content.gallery || [])];
              newGallery.splice(idx, 1);
              const newCaptions = [...(content.galleryCaptions || [])];
              newCaptions.splice(idx, 1);
              onUpdate({ ...content, gallery: newGallery, galleryCaptions: newCaptions, url: newGallery[0] || '' });
            }}
            style={{
              position: 'absolute', top: 6, right: 6,
              width: 22, height: 22, borderRadius: '50%',
              background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20,
            }}
          >
            <span style={{ color: 'white', fontSize: 14, lineHeight: 1 }}>×</span>
          </button>
        )}
        {/* ── Image + overlays wrapper (relative so absolute children position here) ── */}
        <div
          className="relative w-full"
          style={{ filter: dropShadowFilter }}
        >
          {/* Image */}
          {isRect ? (
            <div
              className="relative overflow-hidden w-full bg-slate-50"
              ref={(node) => { frameRefs.current[idx] = node; }}
              style={{ height: imgH, borderRadius: borderRadiusCss }}
            >
              <img
                src={imgUrl} alt={alt || ''}
                className="w-full transition-opacity duration-300"
                style={{ opacity: isLoading ? 0.5 : 1, height: currentHeight === 'auto' ? 'auto' : '100%', objectFit: imgObjectFit, objectPosition: `${objectPosition.x}% ${objectPosition.y}%`, transform: imgTransform, transformOrigin: 'center center' }}
                onLoad={(e) => {
                  naturalSizeRefs.current[idx] = {
                    width: e.currentTarget.naturalWidth,
                    height: e.currentTarget.naturalHeight,
                  };
                  setIsLoading(false);
                }}
              />
              {galleryStrokeWidth > 0 && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: borderRadiusCss, boxShadow: `inset 0 0 0 ${galleryStrokeWidth}px ${galleryStrokeColor}`, pointerEvents: 'none', zIndex: 10 }} />
              )}
              {isEditing && (
                <div onMouseDown={(e) => handleImgPanStart(e, idx)} style={{ position: 'absolute', inset: 0, cursor: 'grab', zIndex: 5, userSelect: 'none' }} />
              )}
            </div>
          ) : (
            <div className="relative w-full" ref={(node) => { frameRefs.current[idx] = node; }} style={{ height: imgH }}>
              <img
                src={imgUrl} alt={alt || ''}
                style={{ opacity: isLoading ? 0.5 : 1, width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${objectPosition.x}% ${objectPosition.y}%`, display: 'block', clipPath: clipPath, WebkitClipPath: clipPath, transform: imgTransform, transformOrigin: 'center center' }}
                onLoad={(e) => {
                  naturalSizeRefs.current[idx] = {
                    width: e.currentTarget.naturalWidth,
                    height: e.currentTarget.naturalHeight,
                  };
                  setIsLoading(false);
                }}
              />
              {isEditing && (
                <div onMouseDown={(e) => handleImgPanStart(e, idx)} style={{ position: 'absolute', inset: 0, cursor: 'grab', zIndex: 5, userSelect: 'none' }} />
              )}
            </div>
          )}

          {/* Activity Overlays */}
          {imageActivityType === 'text-input' && (
            <div className="absolute shadow-lg pointer-events-none" style={{ bottom: '12px', left: '12px', right: '12px', height: '32px', backgroundColor: '#ffffff', border: '2.5px solid #334155', borderRadius: '8px', zIndex: 50 }} />
          )}
          {imageActivityType === 'checkbox-circle' && (
            <div className="absolute shadow-lg pointer-events-none" style={{ top: '12px', right: '12px', width: '32px', height: '32px', backgroundColor: '#ffffff', border: '2.5px solid #334155', borderRadius: '50%', zIndex: 50 }} />
          )}
          {imageActivityType === 'checkbox-square' && (
            <div className="absolute shadow-lg pointer-events-none" style={{ top: '12px', left: '12px', width: '32px', height: '32px', backgroundColor: '#ffffff', border: '2.5px solid #334155', borderRadius: '6px', zIndex: 50 }} />
          )}

          {/* Label badge */}
          {labelText && (
            <div
              className="absolute pointer-events-none flex items-center justify-center"
              style={{ top: '6px', left: '6px', width: '26px', height: '26px', borderRadius: '50%', backgroundColor: galleryLabelColor, color: '#ffffff', fontSize: '11px', fontWeight: 700, zIndex: 60, boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
            >
              {labelText}
            </div>
          )}
        </div>

        {/* Individual Item Caption */}
        {hasGallery && itemCaption && (
          <div
            className="text-center font-medium text-slate-600 px-1 leading-tight"
            style={{
              marginTop: '10px',
              fontSize: content.captionFontSize ? `${content.captionFontSize}px` : '11px',
            }}
          >
            {itemCaption}
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className="flex flex-col group/image w-full"
      style={{ alignItems: hasGallery ? 'stretch' : alignmentToJustify[alignment] }}
    >
      <div className="relative w-full" style={{ maxWidth: containerMaxWidth }}>
        
        {/* Grid Layout (handles 1 or more images) */}
        <div 
          className="grid gap-4 w-full"
          style={{ 
            gridTemplateColumns: displayImages.length > 1 
              ? `repeat(${gridColumns}, minmax(0, 1fr))` 
              : '1fr'
          }}
        >
          {displayImages.map((imgUrl, idx) => renderSingleImage(imgUrl, idx))}
        </div>

        {/* Height drag handle (bobánek) */}
        {isEditing && (containerHeight > 0 || displayImages.length > 0) && (
          <div onMouseDown={handleImgHeightDragStart}
            style={{ position: 'absolute', bottom: -8, left: 0, right: 0, height: 16, cursor: 'row-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
            <div style={{ width: 36, height: 8, borderRadius: 4, backgroundColor: '#6366f1', boxShadow: '0 0 0 2px #818cf8, 0 2px 8px rgba(99,102,241,0.5)', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 2, height: 2, borderRadius: '50%', backgroundColor: 'white' }} />)}
            </div>
          </div>
        )}
      </div>
      
      {showCaption && caption && (
        <div className="mt-2 text-slate-500 text-sm text-center w-full">
          {caption}
        </div>
      )}
      
      {AssetPickerModal}
    </div>
  );
}

// ============================================
// TABLE EDITOR
// ============================================

interface TableEditorProps {
  content: TableContent;
  isEditing: boolean;
  onUpdate: (content: TableContent) => void;
  onBlur: (e: React.FocusEvent) => void;
}

function TableEditor({ content, isEditing, onUpdate, onBlur }: TableEditorProps) {
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const [hasBorder, setHasBorder] = useState(content.hasBorder);
  const [hasRoundedCorners, setHasRoundedCorners] = useState(content.hasRoundedCorners);
  const [colorStyle, setColorStyle] = useState(content.colorStyle || 'default');
  const [fontSize, setFontSize] = useState(content.fontSize || 'base');
  const [density, setDensity] = useState(content.density || 'normal');

  // Sync fontSize/density when content prop is updated externally (e.g. from ProBlockSettingsPanel)
  useEffect(() => { setFontSize(content.fontSize || 'base'); }, [content.fontSize]);
  useEffect(() => { setDensity(content.density || 'normal'); }, [content.density]);

  // Click outside detection to close editing
  useEffect(() => {
    if (!isEditing) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const container = editorWrapperRef.current;
      if (container && !container.contains(e.target as Node)) {
        // Trigger blur to close editing
        onBlur({ currentTarget: container, relatedTarget: null } as unknown as React.FocusEvent);
      }
    };

    // Small delay to prevent immediate triggering
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, onBlur]);
  
  // Generate table HTML from rows/columns if html is empty
  const generateTableHTML = (rows: number, cols: number, hasHeader: boolean): string => {
    let html = '<table>';
    for (let r = 0; r < rows; r++) {
      if (r === 0 && hasHeader) {
        html += '<thead><tr>';
        for (let c = 0; c < cols; c++) {
          html += '<th></th>';
        }
        html += '</tr></thead><tbody>';
      } else {
        if (r === 1 && hasHeader) {
          // Already opened tbody
        } else if (r === 0 && !hasHeader) {
          html += '<tbody>';
        }
        html += '<tr>';
        for (let c = 0; c < cols; c++) {
          html += '<td></td>';
        }
        html += '</tr>';
      }
    }
    html += '</tbody></table>';
    return html;
  };

  const initialHTML = content.html || generateTableHTML(content.rows, content.columns, content.hasHeader);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'worksheet-table',
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialHTML,
    editable: true, // Always editable
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      onUpdate({
        ...content,
        html,
        hasBorder,
        hasRoundedCorners,
        colorStyle,
        fontSize,
        density,
      });
    },
  });

  // Derive CSS vars from density and fontSize
  const DENSITY_VARS: Record<string, { paddingV: string; paddingH: string; minWidth: string }> = {
    compact:  { paddingV: '3px',   paddingH: '6px',  minWidth: '0px'  },
    normal:   { paddingV: '10px',  paddingH: '14px', minWidth: '60px' },
    spacious: { paddingV: '18px',  paddingH: '20px', minWidth: '80px' },
  };
  const FONT_SIZE_MAP: Record<string, string> = {
    xs:   '10px',
    sm:   '12px',
    base: '13px',
    lg:   '15px',
  };

  // Apply styles to table element
  useEffect(() => {
    if (editorWrapperRef.current) {
      const table = editorWrapperRef.current.querySelector('table');
      const wrapper = editorWrapperRef.current;
      if (table) {
        // Apply border class
        if (!hasBorder) {
          table.classList.add('no-border');
        } else {
          table.classList.remove('no-border');
        }
        // Apply rounded corners class
        if (!hasRoundedCorners) {
          table.classList.add('no-rounded');
        } else {
          table.classList.remove('no-rounded');
        }
        // Apply density class
        table.classList.toggle('table-density-compact', density === 'compact');

        // Apply color style
        if (colorStyle && colorStyle !== 'default') {
          const colorMap: Record<string, { header: string; border: string }> = {
            blue: { header: '#dbeafe', border: '#3b82f6' },
            green: { header: '#dcfce7', border: '#22c55e' },
            purple: { header: '#f3e8ff', border: '#a855f7' },
            yellow: { header: '#fef3c7', border: '#f59e0b' },
            red: { header: '#fee2e2', border: '#ef4444' },
            pink: { header: '#fce7f3', border: '#ec4899' },
            cyan: { header: '#cffafe', border: '#06b6d4' },
          };
          const colors = colorMap[colorStyle];
          if (colors) {
            table.style.setProperty('--table-header-bg', colors.header);
            table.style.setProperty('--table-border-color', colors.border);
          }
        } else {
          table.style.removeProperty('--table-header-bg');
          table.style.removeProperty('--table-border-color');
        }
      }
      // Apply density + font-size CSS vars on the wrapper so they cascade into cells
      const dv = DENSITY_VARS[density] || DENSITY_VARS.normal;
      wrapper.style.setProperty('--table-cell-padding-v', dv.paddingV);
      wrapper.style.setProperty('--table-cell-padding-h', dv.paddingH);
      wrapper.style.setProperty('--table-cell-min-width', dv.minWidth);
      wrapper.style.setProperty('--table-font-size', FONT_SIZE_MAP[fontSize] || FONT_SIZE_MAP.base);
    }
  }, [hasBorder, hasRoundedCorners, colorStyle, density, fontSize, editor]);

  const applyColorStyle = (style: string) => {
    setColorStyle(style as TableContent['colorStyle']);
    onUpdate({
      ...content,
      html: editor?.getHTML() || content.html,
      colorStyle: style as TableContent['colorStyle'],
    });
  };

  const toggleBorder = (checked: boolean) => {
    setHasBorder(checked);
    onUpdate({
      ...content,
      html: editor?.getHTML() || content.html,
      hasBorder: checked,
    });
  };

  const toggleRoundedCorners = (checked: boolean) => {
    setHasRoundedCorners(checked);
    onUpdate({
      ...content,
      html: editor?.getHTML() || content.html,
      hasRoundedCorners: checked,
    });
  };

  const applyFontSize = (size: TableContent['fontSize']) => {
    setFontSize(size || 'base');
    onUpdate({
      ...content,
      html: editor?.getHTML() || content.html,
      fontSize: size,
    });
  };

  const applyDensity = (d: TableContent['density']) => {
    setDensity(d || 'normal');
    onUpdate({
      ...content,
      html: editor?.getHTML() || content.html,
      density: d,
    });
  };

  if (!editor) return null;

  return (
    <div 
      className="worksheet-table-container relative" 
      ref={editorWrapperRef} 
      style={{ paddingTop: isEditing ? '50px' : '0', paddingBottom: '0' }}
      onBlur={(e) => {
        // Check if focus is moving outside the table container
        const container = editorWrapperRef.current;
        const relatedTarget = e.relatedTarget as HTMLElement | null;
        if (container && relatedTarget && !container.contains(relatedTarget)) {
          onBlur(e);
        }
      }}
    >
      <div className="tiptap-editor">
        <EditorContent editor={editor} />
      </div>

      {/* Table control buttons - only visible when editing */}
      {isEditing && (
        <>
        {/* TOP row: Style dropdown, Add Row, Delete dropdown */}
          <div
            className="flex justify-between items-center px-0"
            style={{
              position: 'absolute',
              top: 8,
              left: 0,
              right: 0,
              zIndex: 9999,
              pointerEvents: 'none'
            }}
          >
            {/* Style dropdown */}
            <div className="relative" style={{ pointerEvents: 'auto' }}>
              <details className="table-dropdown">
                <summary className="table-dropdown-btn">
                  <span>Styl</span>
                  <ChevronDown size={14} />
                </summary>
                <div className="table-dropdown-menu" style={{ minWidth: '200px' }}>
                  <div className="table-dropdown-section-title">Barvy</div>
                  <div className="table-color-grid">
                    <button
                      onClick={() => applyColorStyle('default')}
                      className="table-color-btn"
                      style={{ background: '#f8fafc', borderColor: '#94a3b8' }}
                      title="Výchozí"
                    />
                    <button
                      onClick={() => applyColorStyle('blue')}
                      className="table-color-btn"
                      style={{ background: '#dbeafe', borderColor: '#3b82f6' }}
                      title="Modrá"
                    />
                    <button
                      onClick={() => applyColorStyle('green')}
                      className="table-color-btn"
                      style={{ background: '#dcfce7', borderColor: '#22c55e' }}
                      title="Zelená"
                    />
                    <button
                      onClick={() => applyColorStyle('purple')}
                      className="table-color-btn"
                      style={{ background: '#f3e8ff', borderColor: '#a855f7' }}
                      title="Fialová"
                    />
                    <button
                      onClick={() => applyColorStyle('yellow')}
                      className="table-color-btn"
                      style={{ background: '#fef3c7', borderColor: '#f59e0b' }}
                      title="Žlutá"
                    />
                    <button
                      onClick={() => applyColorStyle('red')}
                      className="table-color-btn"
                      style={{ background: '#fee2e2', borderColor: '#ef4444' }}
                      title="Červená"
                    />
                    <button
                      onClick={() => applyColorStyle('pink')}
                      className="table-color-btn"
                      style={{ background: '#fce7f3', borderColor: '#ec4899' }}
                      title="Růžová"
                    />
                    <button
                      onClick={() => applyColorStyle('cyan')}
                      className="table-color-btn"
                      style={{ background: '#cffafe', borderColor: '#06b6d4' }}
                      title="Tyrkysová"
                    />
                  </div>

                  <div className="table-dropdown-divider" />
                  <div className="table-dropdown-section-title">Nastavení</div>

                  <label className="table-dropdown-checkbox">
                    <input
                      type="checkbox"
                      checked={editor.isActive('tableHeader')}
                      onChange={() => editor.chain().focus().toggleHeaderRow().run()}
                    />
                    <span>Záhlaví</span>
                  </label>

                  <label className="table-dropdown-checkbox">
                    <input
                      type="checkbox"
                      checked={hasBorder}
                      onChange={(e) => toggleBorder(e.target.checked)}
                    />
                    <span>Ohraničení</span>
                  </label>

                  <label className="table-dropdown-checkbox">
                    <input
                      type="checkbox"
                      checked={hasRoundedCorners}
                      onChange={(e) => toggleRoundedCorners(e.target.checked)}
                    />
                    <span>Zaoblené rohy</span>
                  </label>
                </div>
              </details>
            </div>

            {/* Add Row button */}
            <button
              onClick={() => editor.chain().focus().addRowBefore().run()}
              className="table-add-btn table-add-btn-blue"
              style={{ pointerEvents: 'auto' }}
              title="Přidat řádek nahoře"
            >
              <Plus size={16} />
              <span className="table-add-btn-text">Přidat řádek</span>
            </button>

            {/* Delete dropdown */}
            <div className="relative" style={{ pointerEvents: 'auto' }}>
              <details className="table-dropdown">
                <summary className="table-dropdown-btn table-dropdown-btn-danger">
                  <span>Smazat</span>
                  <ChevronDown size={14} />
                </summary>
                <div className="table-dropdown-menu table-dropdown-menu-right">
                  <button
                    onClick={() => editor.chain().focus().deleteRow().run()}
                    className="table-dropdown-item table-dropdown-item-danger"
                  >
                    Smazat řádek
                  </button>
                  <button
                    onClick={() => editor.chain().focus().deleteColumn().run()}
                    className="table-dropdown-item table-dropdown-item-danger"
                  >
                    Smazat sloupec
                  </button>
                  <div className="table-dropdown-divider" />
                  <button
                    onClick={() => editor.chain().focus().deleteTable().run()}
                    className="table-dropdown-item table-dropdown-item-danger-strong"
                  >
                    Smazat celou tabulku
                  </button>
                </div>
              </details>
            </div>
          </div>

          {/* Resize handle - on the bottom edge of table */}
          <div
            className="flex justify-center"
            style={{
              position: 'absolute',
              bottom: -8,
              left: 0,
              right: 0,
              zIndex: 10000,
              pointerEvents: 'none'
            }}
          >
            <div
              className="table-resize-handle"
              style={{ pointerEvents: 'auto' }}
              onMouseDown={(e) => {
                e.preventDefault();
                const startY = e.clientY;
                const table = editorWrapperRef.current?.querySelector('table');
                if (!table) return;
                const startHeight = table.offsetHeight;

                const onMouseMove = (moveEvent: MouseEvent) => {
                  const delta = moveEvent.clientY - startY;
                  const newHeight = Math.max(60, startHeight + delta);
                  table.style.height = `${newHeight}px`;
                };

                const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);
                  // Save the new height
                  if (editor) {
                    onUpdate({
                      ...content,
                      html: editor.getHTML(),
                    });
                  }
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
              }}
            />
          </div>

          {/* BOTTOM row: Add Column Left, Add Row, Add Column Right */}
          <div
            className="flex justify-between items-center"
            style={{
              position: 'absolute',
              bottom: -28,
              left: 0,
              right: 0,
              zIndex: 9999,
              pointerEvents: 'none'
            }}
          >
            {/* Add Column Left */}
            <button
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              className="table-add-btn table-add-btn-green"
              style={{ pointerEvents: 'auto' }}
              title="Přidat sloupec vlevo"
            >
              <Plus size={16} />
              <span className="table-add-btn-text">Přidat sloupec</span>
            </button>

            {/* Add Row bottom */}
            <button
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className="table-add-btn table-add-btn-blue"
              style={{ pointerEvents: 'auto' }}
              title="Přidat řádek dole"
            >
              <Plus size={16} />
              <span className="table-add-btn-text">Přidat řádek</span>
            </button>

            {/* Add Column Right */}
            <button
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className="table-add-btn table-add-btn-green"
              style={{ pointerEvents: 'auto' }}
              title="Přidat sloupec vpravo"
            >
              <Plus size={16} />
              <span className="table-add-btn-text">Přidat sloupec</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// CONNECT PAIRS EDITOR (SPOJOVAČKA)
// ============================================

interface ConnectPairsEditorBlockProps {
  content: ConnectPairsContent;
  isEditing: boolean;
  onUpdate: (content: ConnectPairsContent) => void;
  activityNumber?: number;
  fontSizes: FontSizes;
}

function ConnectPairsEditorBlock({ content, isEditing, onUpdate, activityNumber, fontSizes }: ConnectPairsEditorBlockProps) {
  const compactFontSizes = getFontSizes('small');
  const isCompact = fontSizes.body === compactFontSizes.body;
  const activityLabelStyle = getActivityLabelStyle(fontSizes);
  const headerGap = isCompact ? '10px' : '12px';
  const outerSpacingClass = isCompact ? 'space-y-2.5' : 'space-y-4';
  const pairsSpacingClass = isCompact ? 'space-y-2' : 'space-y-3';
  const connectorWidth = isCompact ? '28px' : '40px';
  const cardPaddingClass = isCompact ? 'px-2.5 py-2' : 'px-3 py-2.5';
  const cardTextClass = isCompact ? 'text-[13px]' : 'text-sm';
  const itemGapClass = isCompact ? 'gap-2' : 'gap-3';
  const pairGapClass = isCompact ? 'gap-8' : 'gap-12';
  const instructionStyle: React.CSSProperties = activityLabelStyle;
  const choiceBubbleStyle: React.CSSProperties = {
    width: isCompact ? '19px' : '21px',
    height: isCompact ? '19px' : '21px',
    minWidth: isCompact ? '19px' : '21px',
    minHeight: isCompact ? '19px' : '21px',
    borderRadius: '50%',
    border: '1.5px solid #1e293b',
    color: '#1e293b',
    backgroundColor: '#ffffff',
    fontSize: isCompact ? '10px' : '11px',
  };

  // Logic for shuffling in view mode (consistent with print)
  const rightItems = React.useMemo(() => {
    const items = content.pairs.map((p, idx) => ({ ...p.right, originalIdx: idx }));
    if (content.shuffleSides && !isEditing) {
      // Stable shuffle based on pair IDs to avoid jumping on every re-render
      // but still be "shuffled" for the preview
      return [...items].sort((a, b) => {
        const hashA = a.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const hashB = b.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return hashA - hashB;
      });
    }
    return items;
  }, [content.pairs, content.shuffleSides, isEditing]);

  const addPair = () => {
    const newId = Date.now().toString();
    const newPair: ConnectPairContent = {
      id: `pair-${newId}`,
      left: { id: `left-${newId}`, type: 'text', content: '' },
      right: { id: `right-${newId}`, type: 'text', content: '' },
    };
    onUpdate({
      ...content,
      pairs: [...content.pairs, newPair],
    });
  };

  const updatePair = (pairId: string, side: 'left' | 'right', value: string) => {
    onUpdate({
      ...content,
      pairs: content.pairs.map(pair =>
        pair.id === pairId
          ? { ...pair, [side]: { ...pair[side], content: value } }
          : pair
      ),
    });
  };

  const removePair = (pairId: string) => {
    if (content.pairs.length <= 2) return;
    onUpdate({
      ...content,
      pairs: content.pairs.filter(pair => pair.id !== pairId),
    });
  };

  const renderItem = (item: any, side: 'left' | 'right', pairId: string, label?: string) => {
    if (isEditing) {
      if (item.type === 'image') {
        return (
          <div className="flex-1 space-y-2">
            <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
              {item.content ? (
                <img src={item.content} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <ImageIcon size={20} />
                </div>
              )}
            </div>
            <input
              type="text"
              value={item.content}
              onChange={(e) => updatePair(pairId, side, e.target.value)}
              placeholder="URL obrázku..."
              className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        );
      }
      return (
        <input
          type="text"
          value={item.content}
          onChange={(e) => updatePair(pairId, side, e.target.value)}
          placeholder={side === 'left' ? 'Levá strana' : 'Pravá strana'}
          className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      );
    }

    // View mode - UI polished with labels inside
    return (
      <div className={`flex-1 flex items-center ${itemGapClass} ${cardPaddingClass} rounded-xl ${cardTextClass} border shadow-sm transition-all ${
        side === 'left' 
          ? 'bg-blue-50 border-blue-100 text-blue-900' 
          : 'bg-purple-50 border-purple-100 text-purple-900'
      }`}>
        {label && (
          <div 
            className="flex items-center justify-center shrink-0 font-semibold choice-circle"
            style={choiceBubbleStyle}
          >
            {label.replace('.', '').replace(':', '')}
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          {item.type === 'image' ? (
            <div className="aspect-video rounded-lg overflow-hidden border border-black/5 bg-white/50">
              {item.content ? (
                <img src={item.content} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <ImageIcon size={20} />
                </div>
              )}
            </div>
          ) : (
            <div className="leading-tight" style={{ fontSize: fontSizes.body }}>
              {item.content ? <LatexRenderer text={item.content} /> : <span className="opacity-30 italic">...</span>}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={outerSpacingClass}>
      {/* Header with activity number */}
      <div className="flex items-center" style={{ gap: headerGap }}>
        {activityNumber && (
          <div
            className="flex items-center justify-center shrink-0 font-bold text-white"
            style={{ 
              width: '21px',
              height: '21px',
              borderRadius: '50%',
              backgroundColor: '#1e293b',
              fontSize: '12px',
            }}
          >
            {activityNumber}
          </div>
        )}
        <span className="font-semibold text-slate-800" style={instructionStyle}>
          {content.instruction || 'Spoj správné dvojice'}
        </span>
      </div>

      {/* Pairs grid */}
      <div className={pairsSpacingClass} style={{ paddingLeft: activityNumber ? '32px' : 0 }}>
        {isEditing ? (
          // Editing mode - show pairs directly
          content.pairs.map((pair, idx) => (
            <div key={pair.id} className="flex items-center gap-3 group">
              <span className="text-slate-400 text-[10px] font-bold w-4 flex-shrink-0">{idx + 1}.</span>
              {renderItem(pair.left, 'left', pair.id)}
              <div className="flex-shrink-0 text-slate-300">
                <ArrowLeftRight size={14} />
              </div>
              {renderItem(pair.right, 'right', pair.id)}
              {content.pairs.length > 2 && (
                <button
                  onClick={() => removePair(pair.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))
        ) : (
          // View mode - UI polished with labels inside
          content.pairs.map((pair, idx) => (
            <div key={pair.id} className={`flex items-center ${pairGapClass} group`}>
              {renderItem(pair.left, 'left', pair.id, `${idx + 1}.`)}
              
              <div className="flex-shrink-0 flex flex-col items-center">
                <div className="h-[1.5px] bg-slate-200 relative" style={{ width: connectorWidth }}>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-slate-300" style={{ width: isCompact ? '5px' : '6px', height: isCompact ? '5px' : '6px' }} />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full bg-slate-300" style={{ width: isCompact ? '5px' : '6px', height: isCompact ? '5px' : '6px' }} />
                </div>
              </div>
              
              {renderItem(rightItems[idx], 'right', rightItems[idx].id, `${String.fromCharCode(65 + idx)}:`)}
            </div>
          ))
        )}

        {isEditing && (
          <button
            onClick={addPair}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mt-2 text-sm font-medium"
          >
            <Plus size={14} />
            Přidat dvojici
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// IMAGE HOTSPOTS EDITOR (POZNÁVAČKA)
// ============================================

interface ImageHotspotsEditorBlockProps {
  content: ImageHotspotsContent;
  isEditing: boolean;
  onUpdate: (content: ImageHotspotsContent) => void;
  activityNumber?: number;
  fontSizes: FontSizes;
}

function ImageHotspotsEditorBlock({ content, isEditing, onUpdate, activityNumber, fontSizes }: ImageHotspotsEditorBlockProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [draggedHotspotId, setDraggedHotspotId] = useState<string | null>(null);
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [ghostPos, setGhostPos] = useState<{ x: number, y: number } | null>(null);
  const isDraggingRef = React.useRef(false);
  const activityLabelStyle = getActivityLabelStyle(fontSizes);
  const ignoreNextClickRef = React.useRef(false);
  const dragStartRef = React.useRef<{ x: number; y: number; hX: number; hY: number } | null>(null);

  const updateHotspot = (hotspotId: string, updates: Partial<WorksheetHotspot>) => {
    onUpdate({
      ...content,
      hotspots: content.hotspots.map(h =>
        h.id === hotspotId ? { ...h, ...updates } : h
      ),
    });
  };

  const removeHotspot = (hotspotId: string) => {
    onUpdate({
      ...content,
      hotspots: content.hotspots.filter(h => h.id !== hotspotId),
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPlacementMode || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setGhostPos({ x, y });
  };

  const handlePointerLeave = () => {
    setGhostPos(null);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (!isEditing || !containerRef.current) {
      console.log('[Hotspots] Click ignored:', { isEditing, hasRef: !!containerRef.current });
      return;
    }
    
    if (isPlacementMode) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      console.log('[Hotspots] Adding point at:', { x, y });
      
      onUpdate({
        ...content,
        hotspots: [...content.hotspots, {
          id: `hotspot-${Date.now()}`,
          x,
          y,
          label: '',
        }]
      });
      return;
    }

    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      return;
    }
    
    // Check if clicking on an existing hotspot
    if ((e.target as HTMLElement).closest('.hotspot-marker')) return;
  };

  const handleMarkerPointerDown = (hotspot: WorksheetHotspot, e: React.PointerEvent) => {
    if (!isEditing || isPlacementMode) return;
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    
    setDraggedHotspotId(hotspot.id);
    isDraggingRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      hX: hotspot.x,
      hY: hotspot.y
    };
  };

  const handleMarkerPointerMove = (e: React.PointerEvent) => {
    if (!draggedHotspotId || !dragStartRef.current || !containerRef.current) return;
    
    const dx = Math.abs(e.clientX - dragStartRef.current.x);
    const dy = Math.abs(e.clientY - dragStartRef.current.y);
    
    if (dx > 3 || dy > 3) {
      isDraggingRef.current = true;
      ignoreNextClickRef.current = true;
    }

    if (isDraggingRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dxPercent = ((e.clientX - dragStartRef.current.x) / rect.width) * 100;
      const dyPercent = ((e.clientY - dragStartRef.current.y) / rect.height) * 100;
      
      let x = dragStartRef.current.hX + dxPercent;
      let y = dragStartRef.current.hY + dyPercent;
      
      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));
      
      updateHotspot(draggedHotspotId, { x, y });
    }
  };

  const handleMarkerPointerUp = (e: React.PointerEvent) => {
    if (!draggedHotspotId) return;
    const target = e.currentTarget as HTMLElement;
    target.releasePointerCapture(e.pointerId);
    setDraggedHotspotId(null);
    dragStartRef.current = null;
    
    if (isDraggingRef.current) {
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 50);
    }
  };

  const markerSize = (content.markerSize || 100) / 100;
  const isABC = content.answerType === 'abc';
  const isSideBySide = content.layout === 'side-by-side';

  return (
    <div className="space-y-4">
      {/* Header with activity number */}
      <div className="flex items-center gap-3">
        {activityNumber && (
          <div
            className="flex items-center justify-center shrink-0 font-bold text-white shadow-sm"
            style={{ 
              width: '21px',
              height: '21px',
              borderRadius: '50%',
              backgroundColor: '#1e293b',
              fontSize: '12px',
            }}
          >
            {activityNumber}
          </div>
        )}
        <span className="font-semibold text-slate-800" style={activityLabelStyle}>
          {content.instruction || 'Označ správná místa na obrázku'}
        </span>
      </div>

      <div style={{ paddingLeft: activityNumber ? '32px' : 0 }}>
        <div className={isSideBySide ? "flex gap-8 items-start" : "space-y-8"}>
          {/* Image Area */}
          <div 
            ref={containerRef}
            className={`relative rounded-2xl overflow-hidden border-2 border-slate-100 bg-white shadow-sm group/image-area ${isEditing ? (isPlacementMode ? 'cursor-none' : 'cursor-crosshair') : ''} ring-2 ring-purple-500/10 ${isSideBySide ? "flex-1" : "w-full mb-6"}`}
            onClick={handleContainerClick}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            style={{ minHeight: content.imageUrl ? 'auto' : '200px', touchAction: 'none' }}
          >
            {content.imageUrl ? (
              <img
                src={content.imageUrl}
                alt="Poznávačka"
                className="w-full h-auto max-h-[600px] object-contain block pointer-events-none select-none"
              />
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="text-center text-slate-400">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ImageIcon size={32} className="opacity-20" />
                  </div>
                  <span className="text-sm font-medium">Obrázek nebyl nastaven</span>
                  {isEditing && <p className="text-xs mt-2 text-slate-400">Vložte URL v nastavení vlevo</p>}
                </div>
              </div>
            )}

            {/* Placement mode control toggle - Always visible when selected */}
            {isEditing && content.imageUrl && (
              <div className="absolute top-4 right-4 z-[100] transition-all duration-300">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const newMode = !isPlacementMode;
                    setIsPlacementMode(newMode);
                    if (!newMode) setGhostPos(null);
                    console.log('[Hotspots] Toggle placement mode:', newMode);
                  }}
                  className={`pointer-events-auto flex items-center gap-2 px-5 py-2.5 rounded-full shadow-lg font-bold transition-all border-2 ${
                    isPlacementMode 
                      ? 'bg-purple-600 text-white border-purple-400 scale-105' 
                      : 'bg-white text-purple-700 border-purple-500 hover:scale-105 hover:bg-purple-50 active:scale-95'
                  }`}
                  style={{ 
                    fontSize: '14px',
                  }}
                >
                  {isPlacementMode ? (
                    <>
                      <X size={18} strokeWidth={2.5} />
                      Ukončit vkládání
                    </>
                  ) : (
                    <>
                      <Plus size={18} strokeWidth={2.5} />
                      Umístit body
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Ghost marker */}
            {isPlacementMode && ghostPos && (
              <div
                className="absolute pointer-events-none flex items-center justify-center shadow-lg z-30 opacity-70 animate-pulse"
                style={{
                  left: `${ghostPos.x}%`,
                  top: `${ghostPos.y}%`,
                  transform: `translate(-50%, -50%) scale(${markerSize})`,
                  width: '28px',
                  height: '28px',
                  borderRadius: content.markerStyle === 'pin' ? '28px 28px 0 28px' : '50%',
                  backgroundColor: '#9333ea',
                  border: '2px solid white',
                  rotate: content.markerStyle === 'pin' ? '45deg' : '0deg',
                }}
              >
                <span className="text-white font-black" style={{ fontSize: '12px', rotate: content.markerStyle === 'pin' ? '-45deg' : '0deg' }}>
                  {isABC ? String.fromCharCode(65 + content.hotspots.length) : (content.hotspots.length + 1)}
                </span>
              </div>
            )}
            
            {/* Hotspot markers on image */}
            {content.hotspots.map((hotspot, idx) => {
              const labelChar = isABC ? String.fromCharCode(65 + idx) : (idx + 1).toString();
              const isBeingDragged = draggedHotspotId === hotspot.id;
              
              return (
                <div
                  key={hotspot.id}
                  onPointerDown={(e) => handleMarkerPointerDown(hotspot, e)}
                  onPointerMove={handleMarkerPointerMove}
                  onPointerUp={handleMarkerPointerUp}
                  className={`absolute hotspot-marker flex items-center justify-center shadow-lg z-20 transition-all ${isBeingDragged ? 'scale-125 cursor-grabbing ring-4 ring-purple-500/20' : 'hover:scale-110 cursor-grab'} group/pin ${isPlacementMode ? 'pointer-events-none opacity-50' : ''}`}
                  style={{
                    left: `${hotspot.x}%`,
                    top: `${hotspot.y}%`,
                    transform: `translate(-50%, -50%) scale(${markerSize})`,
                    width: '28px',
                    height: '28px',
                    borderRadius: content.markerStyle === 'pin' ? '28px 28px 0 28px' : '50%',
                    backgroundColor: '#9333ea',
                    border: '2px solid white',
                    rotate: content.markerStyle === 'pin' ? '45deg' : '0deg',
                    touchAction: 'none'
                  }}
                >
                  <span 
                    className="text-white font-black pointer-events-none select-none"
                    style={{ 
                      fontSize: '12px',
                      rotate: content.markerStyle === 'pin' ? '-45deg' : '0deg'
                    }}
                  >
                    {labelChar}
                  </span>
                  
                  {isEditing && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeHotspot(hotspot.id); }}
                      className="absolute -top-6 -right-6 w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 shadow-sm opacity-0 group-hover/pin:opacity-100 transition-opacity"
                      style={{ rotate: content.markerStyle === 'pin' ? '-45deg' : '0deg' }}
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              );
            })}
            
            {isEditing && content.imageUrl && !isPlacementMode && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] font-bold px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10 uppercase tracking-widest pointer-events-none">
                Tažením přesuňte • Umístit body pro přidání
              </div>
            )}
          </div>

          {/* Legend (Answers Area) */}
          {content.hotspots.length > 0 && (
            <div className={isSideBySide ? "flex-1" : "mt-8"}>
              <div className={isSideBySide ? "flex flex-col gap-y-6" : "grid grid-cols-2 gap-x-12 gap-y-10"}>
                {content.hotspots.map((hotspot, idx) => {
                  const labelChar = isABC ? String.fromCharCode(65 + idx) : (idx + 1).toString();
                  return (
                    <div key={hotspot.id} className="flex items-center gap-4 group">
                      <div 
                        className="flex items-center justify-center shrink-0 font-semibold choice-circle"
                        style={{
                          width: '21px',
                          height: '21px',
                          minWidth: '21px',
                          minHeight: '21px',
                          borderRadius: '50%',
                          border: '1.5px solid #1e293b',
                          color: '#1e293b',
                          backgroundColor: '#ffffff',
                          fontSize: '12px',
                        }}
                      >
                        {labelChar}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-2 group/edit">
                            <input
                              type="text"
                              value={hotspot.label}
                              onChange={(e) => updateHotspot(hotspot.id, { label: e.target.value })}
                              placeholder="Správná odpověď..."
                              className="w-full bg-transparent border-b-2 border-slate-200 focus:border-slate-400 py-1 text-sm outline-none transition-colors font-medium text-slate-700"
                            />
                            <button
                              onClick={() => removeHotspot(hotspot.id)}
                              className="opacity-0 group-hover/edit:opacity-100 p-1.5 text-slate-300 hover:text-red-500 transition-all hover:bg-red-50 rounded-lg"
                              title="Smazat bod"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 w-full border-b-2 border-dotted border-slate-300 pb-1 px-1">
                            <span className="text-sm text-slate-800 font-medium">{hotspot.label || '...'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// VIDEO QUIZ EDITOR
// ============================================

interface VideoQuizEditorBlockProps {
  content: VideoQuizContent;
  isEditing: boolean;
  onUpdate: (content: VideoQuizContent) => void;
  activityNumber?: number;
  fontSizes: FontSizes;
}

function VideoQuizEditorBlock({ content, isEditing, onUpdate, activityNumber, fontSizes }: VideoQuizEditorBlockProps) {
  const activityLabelStyle = getActivityLabelStyle(fontSizes);
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const updateQuestion = (questionId: string, question: string) => {
    onUpdate({
      ...content,
      questions: content.questions.map(q =>
        q.id === questionId ? { ...q, question } : q
      ),
    });
  };

  const removeQuestion = (questionId: string) => {
    onUpdate({
      ...content,
      questions: content.questions.filter(q => q.id !== questionId),
    });
  };

  // Extract video ID for thumbnail
  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? match[1] : null;
  };

  const videoId = content.videoId || getYouTubeId(content.videoUrl);
  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;

  return (
    <div className="space-y-4">
      {/* Header with activity number */}
      <div className="flex items-center gap-3">
        {activityNumber && (
          <div
            className="flex items-center justify-center shrink-0 font-bold text-white"
            style={{ 
              width: '21px',
              height: '21px',
              borderRadius: '50%',
              backgroundColor: '#1e293b',
              fontSize: '12px',
            }}
          >
            {activityNumber}
          </div>
        )}
        <span className="font-medium text-slate-700" style={activityLabelStyle}>
          {content.instruction || 'Video kvíz'}
        </span>
      </div>

      <div style={{ paddingLeft: activityNumber ? '32px' : 0 }} className="space-y-4">
        {/* Video Card - Always show if URL exists */}
        {content.videoUrl ? (
          <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm max-w-2xl">
            <div className="relative aspect-video bg-black flex items-center justify-center">
              {thumbnailUrl ? (
                <>
                  <img
                    src={thumbnailUrl}
                    alt="Video thumbnail"
                    className="w-full h-full object-cover opacity-80"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center shadow-2xl transition-transform hover:scale-105">
                      <div className="w-0 h-0 border-t-10 border-b-10 border-l-16 border-transparent border-l-white ml-1.5" />
                    </div>
                  </div>
                </>
              ) : (
                <PlayCircle className="w-12 h-12 text-white/20" />
              )}
              {isEditing && (
                <div className="absolute top-3 right-3 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-md">
                  YouTube Video
                </div>
              )}
            </div>
            <div className="px-4 py-3 flex items-center justify-between bg-white border-t border-slate-100">
              <div className="flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-red-600" />
                <span className="text-xs font-semibold text-slate-700 truncate max-w-[200px]">
                  {content.videoUrl}
                </span>
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {content.questions.length} OTÁZEK
              </div>
            </div>
          </div>
        ) : isEditing && (
          <div className="flex items-center justify-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <div className="text-center text-slate-400">
              <PlayCircle size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Vložte odkaz na video v nastavení</p>
            </div>
          </div>
        )}

        {/* Questions Summary */}
        {content.questions.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Otázky ve videu:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {content.questions.map((q, idx) => (
                <div key={q.id} className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <span className="flex items-center justify-center w-6 h-6 bg-slate-800 text-white rounded-lg text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-50 px-1 rounded">
                      {formatTime(q.timestamp)}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0 pt-0.5">
                    {isEditing ? (
                      <input
                        type="text"
                        value={q.question}
                        onChange={(e) => updateQuestion(q.id, e.target.value)}
                        placeholder={`Otázka ${idx + 1}`}
                        className="w-full bg-transparent border-none text-sm text-slate-700 outline-none p-0 focus:ring-0 font-medium"
                      />
                    ) : (
                      <p className="text-sm text-slate-700 font-medium leading-snug">
                        {q.question || `Otázka ${idx + 1}...`}
                      </p>
                    )}
                    
                    {/* Compact options preview */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {q.options.map((opt, optIdx) => (
                        <div 
                          key={opt.id} 
                          className={`text-[9px] px-1.5 py-0.5 rounded-full border ${opt.isCorrect ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                        >
                          {String.fromCharCode(65 + optIdx)}
                        </div>
                      ))}
                    </div>
                  </div>

                  {isEditing && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeQuestion(q.id); }}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// HEADER FOOTER EDITOR
// ============================================

interface HeaderFooterEditorBlockProps {
  content: HeaderFooterContent;
  isEditing: boolean;
  onUpdate: (content: HeaderFooterContent) => void;
}

function HeaderFooterEditorBlock({ content, isEditing, onUpdate }: HeaderFooterEditorBlockProps) {
  const isHeader = content.variant === 'header';
  
  // Smajlíci pro zpětnou vazbu
  const SMILEYS = ['😢', '🙁', '😐', '🙂', '😊'];
  const HEARTS = ['💔', '🖤', '🤍', '🩷', '❤️'];
  const STARS = ['☆', '☆', '☆', '☆', '☆'];
  
  const feedbackIcons = content.feedbackType === 'smileys' ? SMILEYS 
    : content.feedbackType === 'hearts' ? HEARTS 
    : content.feedbackType === 'stars' ? STARS 
    : [];
    
  const PageNumberIcon = () => (
    <div className="flex items-center flex-shrink-0 ml-auto">
      <div 
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: '#000000',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 'bold',
        }}
      >
        1
      </div>
    </div>
  );
  
  return (
    <div className="py-3">
      {/* Oddělovací linka nahoře (pouze pro patičku) */}
      {!isHeader && (
        <div className="border-t-2 border-slate-300 mb-4" />
      )}
      
      {isHeader ? (
        // === HLAVIČKA ===
        <div className="flex gap-4 items-start">
          {/* Hlavní pole - vše v jednom řádku */}
          <div className="flex-1 min-w-0 flex gap-4 items-end">
            {/* Jméno a příjmení */}
            {(content.showName !== false || content.showSurname !== false) && (
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-slate-500">Jméno a příjmení:</span>
                <div className="border-b-2 border-dotted border-slate-300 mt-1 h-6" />
              </div>
            )}
            
            {/* Třída */}
            {content.showClass !== false && (
              <div className="w-36">
                <span className="text-xs font-medium text-slate-500">{content.classLabel || 'Třída'}:</span>
                <div className="border-b-2 border-dotted border-slate-300 mt-1 h-6" />
              </div>
            )}
            
            {/* Známka */}
            {content.showGrade !== false && (
              <div className="w-20">
                <span className="text-xs font-medium text-slate-500">{content.gradeLabel || 'Známka'}:</span>
                <div className="border-b-2 border-dotted border-slate-300 mt-1 h-6" />
              </div>
            )}
            
            {/* Vlastní info - inline s poli */}
            {content.customInfo && (
              <div className="flex-shrink-0">
                <p className="text-xs text-slate-500 italic">{content.customInfo}</p>
              </div>
            )}
            
            {/* Číslo stránky */}
            {content.showPageNumber && <PageNumberIcon />}
          </div>
          
          {/* QR kód */}
          {content.showQrCode && content.qrCodeUrl && (
            <div className="flex-shrink-0">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(content.qrCodeUrl)}`}
                alt="QR kód"
                className="w-20 h-20 border border-slate-200 rounded"
              />
            </div>
          )}
        </div>
      ) : (
        // === PATIČKA ===
        <div className="flex gap-4 items-start">
          {/* Info text a zpětná vazba v gridu */}
          <div className="flex-1 grid grid-cols-2 gap-4">
            {/* Levý sloupec: Info text */}
            <div>
              {content.showFooterInfo && content.footerInfo && (
                <p className="text-sm text-slate-600">{content.footerInfo}</p>
              )}
            </div>
            
            {/* Pravý sloupec: Zpětná vazba */}
            <div>
              {content.showFeedback && content.feedbackType && content.feedbackType !== 'none' && (
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-2">
                    {content.feedbackText || 'Tento pracovní list se mi vyplňoval:'}
                  </p>
                  <div className="flex gap-2 items-center">
                    {feedbackIcons.slice(0, content.feedbackCount || 5).map((icon, idx) => (
                      <span 
                        key={idx} 
                        className="text-2xl opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
                        title={`${idx + 1} z ${content.feedbackCount || 5}`}
                      >
                        {icon}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* QR kód */}
          {content.showQrCode && content.qrCodeUrl && (
            <div className="flex-shrink-0">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(content.qrCodeUrl)}`}
                alt="QR kód"
                className="w-20 h-20 border border-slate-200 rounded"
              />
            </div>
          )}

          {/* Číslo stránky */}
          {content.showPageNumber && <PageNumberIcon />}
        </div>
      )}
    </div>
  );
}

// ============================================
// FREE CANVAS EDITOR BLOCK
// ============================================

// ============================================
// FREE CANVAS ACTIVITY BLOCK - Kompletně nová struktura
// ============================================

interface FreeCanvasActivityBlockProps {
  block: WorksheetBlock;
  isEditing: boolean;
  onUpdate: (content: any) => void;
  activityNumber?: number;
}

function FreeCanvasActivityBlock({ block, isEditing, onUpdate, activityNumber }: FreeCanvasActivityBlockProps) {
  const content = block.content as FreeCanvasContent;
  const instructionText = (content as any).question || '';
  const isFullscreen = !!(content as any).fullscreen;

  // Fullscreen: break out of EditableBlock padding (px-4 = 16px) + page PADDING (24px) = 40px each side
  //            vertically: paddingTop/Bottom (16px) + py-1 (4px) = 20px top & bottom
  // Normal:    break out of EditableBlock padding only (16px each side, 4px top/bottom)
  const sidePull = isFullscreen ? 40 : 16;
  const topPull  = isFullscreen ? 20 : 4;  // GridCanvas paddingTop:16 + EditableBlock py-1:4
  const botPull  = isFullscreen ? 20 : 4;  // GridCanvas paddingBottom:16 + EditableBlock py-1:4

  return (
    <div
      className="w-full"
      style={{
        margin: `-${topPull}px -${sidePull}px -${botPull}px -${sidePull}px`,
        width: `calc(100% + ${sidePull * 2}px)`,
      }}
    >
      {/* Zadání — skryté v info módu (bez čísla aktivity) nebo ve fullscreen */}
      {activityNumber !== undefined && !isFullscreen && (
        <div
          className="flex gap-3 items-start px-4 py-1"
          style={{
            fontFamily: content.fontFamily || FONT_FAMILY,
            fontSize: content.fontSize || FONT_SIZES.body,
            fontWeight: content.fontWeight || 'normal',
            fontStyle: content.italic ? 'italic' : 'normal',
            color: content.textColor || '#1e293b',
            lineHeight: content.lineHeight || 1.5,
          }}
        >
          <div style={{
            width: `${content.circleSize || 21}px`,
            height: `${content.circleSize || 21}px`,
            borderRadius: '50%',
            backgroundColor: content.circleColor || '#1e293b',
            color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: `${(content.circleSize || 21) * 0.6}px`,
            fontWeight: 'bold', flexShrink: 0, marginTop: '2px',
          }}>
            {activityNumber}
          </div>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <textarea
                value={instructionText}
                onChange={(e) => onUpdate({ ...content, question: e.target.value } as any)}
                className="w-full bg-transparent border-none outline-none resize-none overflow-hidden p-0 m-0"
                style={{ minHeight: '1.5em' }}
                placeholder="Zadejte zadání aktivity..."
              />
            ) : (
              <div style={{ minHeight: '1.5em' }}>
                {instructionText || <span className="text-slate-400">Zadání aktivity...</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Figma SVG viewer */}
      <div className="w-full overflow-hidden" style={{ borderTop: isFullscreen ? 'none' : '1px solid #e5e7eb' }}>
        <FreeCanvasEditor content={content} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

// ============================================
// CHART BLOCK
// ============================================

const WS_CHART_PALETTE = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a78bfa', '#34d399', '#fb923c'];
const WS_CHART_CAT_COLORS: Record<string, string> = {
  válka: '#ef4444', politika: '#6366f1', kultura: '#f59e0b',
  ekonomika: '#10b981', věda: '#22d3ee', náboženství: '#a78bfa',
};

const WS_CHART_TYPES = [
  { id: 'bar' as const,      label: 'Sloupce',  emoji: '📊' },
  { id: 'line' as const,     label: 'Linie',    emoji: '📈' },
  { id: 'area' as const,     label: 'Oblast',   emoji: '🌊' },
  { id: 'pie' as const,      label: 'Koláč',    emoji: '🥧' },
  { id: 'radar' as const,    label: 'Pavučina', emoji: '🕸️' },
  { id: 'timeline' as const, label: 'Timeline', emoji: '⏳' },
];

export function WorksheetChartBlock({
  content,
  onUpdate,
  isEditing,
}: {
  content: ChartContent;
  onUpdate: (patch: any) => void;
  isEditing: boolean;
}) {
  const { chartType = 'bar', chartTitle = '', chartColumns = ['Kategorie', 'Hodnota'], chartRows = [], chartHeight = 320 } = content;
  const isTimeline = chartType === 'timeline';
  const dataKeys = chartColumns.slice(1);

  const setContent = (patch: Partial<ChartContent>) => onUpdate({ ...content, ...patch });
  const updateCell = (ri: number, ci: number, val: string) => {
    const r = chartRows.map(row => [...row]);
    r[ri][ci] = val;
    setContent({ chartRows: r });
  };
  const addRow = () => setContent({ chartRows: [...chartRows, new Array(chartColumns.length).fill('')] });
  const removeRow = (ri: number) => setContent({ chartRows: chartRows.filter((_, i) => i !== ri) });
  const updateCol = (ci: number, val: string) => { const c = [...chartColumns]; c[ci] = val; setContent({ chartColumns: c }); };
  const addSeries = () => {
    const c = [...chartColumns, `Řada ${chartColumns.length}`];
    setContent({ chartColumns: c, chartRows: chartRows.map(r => [...r, '']) });
  };
  const removeSeries = () => {
    if (chartColumns.length <= 2) return;
    setContent({ chartColumns: chartColumns.slice(0, -1), chartRows: chartRows.map(r => r.slice(0, -1)) });
  };
  const setType = (t: ChartContent['chartType']) => {
    if (t === 'timeline') {
      setContent({ chartType: t, chartColumns: ['Rok/Období', 'Popis', 'Kategorie'], chartRows: chartRows.map(r => [r[0] ?? '', r[1] ?? '', r[2] ?? '']) });
    } else if (isTimeline) {
      setContent({ chartType: t, chartColumns: ['Kategorie', 'Hodnota'], chartRows: chartRows.map(r => [r[0] ?? '', r[1] ?? '']) });
    } else {
      setContent({ chartType: t });
    }
  };

  const rechartsData = chartRows.map(row => {
    const obj: Record<string, string | number> = { name: row[0] || '' };
    dataKeys.forEach((k, i) => { obj[k] = parseFloat(row[i + 1]) || 0; });
    return obj;
  });
  const tt = { borderRadius: 10, fontSize: 12, border: '1px solid #e2e8f0', background: '#fff' };

  const renderChart = () => {
    if (chartType === 'timeline') {
      return (
        <div style={{ paddingLeft: 28, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 10, top: 0, bottom: 0, width: 3, background: 'linear-gradient(to bottom,#6366f1,#22d3ee)', borderRadius: 99 }} />
          {chartRows.map((row, i) => {
            const color = WS_CHART_CAT_COLORS[(row[2] || '').toLowerCase()] || WS_CHART_PALETTE[i % WS_CHART_PALETTE.length];
            return (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12, position: 'relative' }}>
                <div style={{ position: 'absolute', left: -22, top: 5, width: 12, height: 12, borderRadius: '50%', backgroundColor: color, border: '3px solid white', boxShadow: `0 0 0 2px ${color}` }} />
                <div style={{ background: 'white', borderRadius: 10, padding: '8px 12px', border: `1px solid ${color}33`, borderLeft: `4px solid ${color}`, flex: 1, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color }}>{row[0]}</div>
                  <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.4 }}>{row[1]}</div>
                  {row[2] && <div style={{ marginTop: 3, fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>{row[2]}</div>}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    const height = chartHeight;
    if (chartType === 'pie') return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart><Pie data={rechartsData.map(d => ({ name: d.name, value: (d[dataKeys[0]] as number) || 0 }))} cx="50%" cy="50%" outerRadius="70%" innerRadius="30%" paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
          {rechartsData.map((_, i) => <Cell key={i} fill={WS_CHART_PALETTE[i % WS_CHART_PALETTE.length]} />)}
        </Pie><Tooltip contentStyle={tt} /></PieChart>
      </ResponsiveContainer>
    );
    if (chartType === 'line') return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rechartsData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} />
          <Tooltip contentStyle={tt} />{dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {dataKeys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={WS_CHART_PALETTE[i]} strokeWidth={3} dot={{ r: 4 }} />)}
        </LineChart>
      </ResponsiveContainer>
    );
    if (chartType === 'area') return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={rechartsData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
          <defs>{dataKeys.map((k, i) => <linearGradient key={k} id={`wscg${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={WS_CHART_PALETTE[i]} stopOpacity={0.35} /><stop offset="95%" stopColor={WS_CHART_PALETTE[i]} stopOpacity={0} /></linearGradient>)}</defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} />
          <Tooltip contentStyle={tt} />{dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {dataKeys.map((k, i) => <Area key={k} type="monotone" dataKey={k} stroke={WS_CHART_PALETTE[i]} strokeWidth={2.5} fill={`url(#wscg${i})`} />)}
        </AreaChart>
      </ResponsiveContainer>
    );
    if (chartType === 'radar') return (
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={rechartsData}><PolarGrid stroke="#e2e8f0" /><PolarAngleAxis dataKey="name" tick={{ fontSize: 12 }} />
          {dataKeys.map((k, i) => <Radar key={k} dataKey={k} stroke={WS_CHART_PALETTE[i]} fill={WS_CHART_PALETTE[i]} fillOpacity={0.28} />)}
          {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          <Tooltip contentStyle={tt} />
        </RadarChart>
      </ResponsiveContainer>
    );
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rechartsData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }} barCategoryGap="8%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} />
          <Tooltip contentStyle={tt} />{dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {dataKeys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={WS_CHART_PALETTE[i]} radius={[6, 6, 0, 0]}>
              {dataKeys.length === 1 && rechartsData.map((_, idx) => <Cell key={idx} fill={WS_CHART_PALETTE[idx % WS_CHART_PALETTE.length]} />)}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div style={{ borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', background: 'white' }}>
      {isEditing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
          {WS_CHART_TYPES.map(ct => (
            <button
              key={ct.id}
              onClick={() => setType(ct.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 8,
                border: `2px solid ${chartType === ct.id ? '#6366f1' : '#e2e8f0'}`,
                background: chartType === ct.id ? '#eef2ff' : 'white',
                color: chartType === ct.id ? '#4338ca' : '#64748b',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 12 }}>{ct.emoji}</span> {ct.label}
            </button>
          ))}
          <input value={chartTitle} onChange={e => setContent({ chartTitle: e.target.value })} placeholder="Název grafu…" style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 8px', border: '1px solid #e2e8f0', borderRadius: 6, width: 140, color: '#334155' }} />
          <input type="number" value={chartHeight} onChange={e => setContent({ chartHeight: parseInt(e.target.value) || 320 })} min={150} max={600} step={20} title="Výška grafu" style={{ fontSize: 11, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 6, width: 60, color: '#334155' }} />
          <span style={{ fontSize: 10, color: '#94a3b8' }}>px</span>
        </div>
      )}
      <div style={{ padding: isTimeline ? '16px 16px 16px 28px' : '16px', position: 'relative' }}>
        {chartTitle && <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 12 }}>{chartTitle}</div>}
        {renderChart()}
      </div>
      {isEditing && (
        <div style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc', padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>Data tabulka</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            {chartColumns.map((col, ci) => (
              <input key={ci} value={col} onChange={e => updateCol(ci, e.target.value)} style={{ flex: 1, minWidth: 60, fontSize: 11, fontWeight: 700, padding: '4px 8px', border: '1px solid #c7d2fe', borderRadius: 6, background: '#eef2ff', color: '#4338ca' }} placeholder={ci === 0 ? 'Kategorie' : `Řada ${ci}`} />
            ))}
            {!isTimeline && (
              <>
                <button onClick={addSeries} style={{ padding: '4px 10px', borderRadius: 6, border: '1px dashed #c7d2fe', background: 'white', color: '#6366f1', fontSize: 16, cursor: 'pointer' }} title="Přidat řadu">+</button>
                {chartColumns.length > 2 && <button onClick={removeSeries} style={{ padding: '4px 10px', borderRadius: 6, border: '1px dashed #fca5a5', background: 'white', color: '#ef4444', fontSize: 16, cursor: 'pointer' }} title="Odebrat řadu">−</button>}
              </>
            )}
          </div>
          {chartRows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              {row.map((cell, ci) => (
                <input key={ci} value={cell} onChange={e => updateCell(ri, ci, e.target.value)} style={{ flex: 1, minWidth: 60, fontSize: 11, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, background: ri % 2 === 0 ? '#f8fafc' : 'white', color: '#334155' }} placeholder={ci === 0 ? (isTimeline ? 'Rok' : 'Název') : ci === 1 && isTimeline ? 'Popis' : isTimeline ? 'Kategorie' : '0'} />
              ))}
              <button onClick={() => removeRow(ri)} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: '#cbd5e1', cursor: 'pointer', fontSize: 16 }} onMouseEnter={e => ((e.target as HTMLElement).style.color = '#ef4444')} onMouseLeave={e => ((e.target as HTMLElement).style.color = '#cbd5e1')}>×</button>
            </div>
          ))}
          <button onClick={addRow} style={{ marginTop: 4, width: '100%', padding: '6px', borderRadius: 6, border: '1px dashed #c7d2fe', background: 'white', color: '#6366f1', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>+ Přidat řádek</button>
        </div>
      )}
    </div>
  );
}
