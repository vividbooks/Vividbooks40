/**
 * EditableBlock - Blok s inline editací v canvasu
 * 
 * Umožňuje editovat obsah bloků přímo v A4 náhledu
 */

import { useState, useRef, useEffect, useCallback, useId } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, X, Bold, Italic, Underline, List, Sigma, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Copy, Trash2, ImageIcon, Table as TableIcon } from 'lucide-react';
import { WorksheetBlock, ChoiceOption, GlobalFontSize, SpacerStyle, ExamplesContent, MathExample, ExampleDifficulty, AnswerBoxStyle, ImageContent, ImageSize, BlockImage, TableContent } from '../../types/worksheet';
import { LatexRenderer } from './LatexRenderer';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

function PrintSafePattern({ variant, lineSpacing = 40 }: { variant: 'dotted' | 'lined'; lineSpacing?: number }) {
  const id = useId().replace(/:/g, '');
  const patternId = `${variant}-pattern-${id}`;
  const dotColor = '#94a3b8';   // slate-400
  const lineColor = '#cbd5e1';  // slate-300

  if (variant === 'dotted') {
    return (
      <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
        <defs>
          <pattern id={patternId} patternUnits="userSpaceOnUse" width="16" height="16">
            <circle cx="2" cy="2" r="1" fill={dotColor} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    );
  }

  return (
    <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width="1" height={lineSpacing}>
          <line x1="0" y1={lineSpacing - 1} x2="2000" y2={lineSpacing - 1} stroke={lineColor} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}

// Get font sizes based on global setting
const getFontSizes = (globalSize: GlobalFontSize = 'normal') => {
  const multipliers = {
    small: 0.85,
    normal: 1,
    large: 1.2,
  };
  const m = multipliers[globalSize];
  
  return {
    title: `${Math.round(10 * m)}pt`,    // base 10pt
    body: `${Math.round(10 * m)}pt`,     // base 10pt
    small: `${Math.round(9 * m)}pt`,     // base 9pt
    large: `${Math.round(12 * m)}pt`,    // base 12pt
    h1: `${Math.round(19 * m)}pt`,       // base 19pt
    h2: `${Math.round(12 * m)}pt`,       // base 12pt
    h3: `${Math.round(11 * m)}pt`,       // base 11pt
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
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  globalFontSize?: GlobalFontSize;
  activityNumber?: number; // Number for activity blocks (multiple-choice, fill-blank, free-answer)
  /** If block is rendered in a side-by-side row, which column is it in? */
  columnPosition?: 'left' | 'right';
}

export function EditableBlock({ block, isSelected, isHovered, onSelect, onUpdate, onUpdateMargin, onDelete, onDuplicate, onMoveUp, onMoveDown, globalFontSize = 'normal', activityNumber, columnPosition }: EditableBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isResizingMargin, setIsResizingMargin] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const marginBottom = block.marginBottom || 0;
  const marginStyle = block.marginStyle || 'empty';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Check if the new focus target is still within this block
    const blockElement = e.currentTarget.closest('[data-block-id]');
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    
    // If focus is moving to another element within the same block, don't exit editing
    if (relatedTarget && blockElement?.contains(relatedTarget)) {
      return;
    }
    
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  // Handle margin resize
  const handleMarginMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onUpdateMargin) return;
    
    setIsResizingMargin(true);
    const startY = e.clientY;
    const startMargin = marginBottom;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - startY;
      const newMargin = Math.max(0, Math.min(200, startMargin + delta));
      onUpdateMargin(newMargin);
    };

    const handleMouseUp = () => {
      setIsResizingMargin(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [marginBottom, onUpdateMargin]);

  const highlightClass = isSelected
    ? 'ring-2 ring-blue-500 bg-blue-50/50'
    : isHovered
      ? 'ring-2 ring-blue-300 bg-blue-50/40'
      : 'hover:bg-slate-50 cursor-pointer';

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-block-id={block.id}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`
        group relative py-1 px-4 rounded-lg transition-all
        ${isDragging ? 'shadow-xl scale-[1.01]' : ''}
        ${block.type === 'table' ? '' : highlightClass}
        ${isEditing && block.type !== 'table' ? 'ring-2 ring-blue-500' : ''}
      `}
    >
      
      {/* Block content with optional image */}
      <BlockWithImage
        block={block}
        isEditing={isEditing}
        onUpdate={onUpdate}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        globalFontSize={globalFontSize}
        activityNumber={activityNumber}
      />
      
      {/* Bottom margin space with optional pattern */}
      {marginBottom > 0 && (
        <div style={{ height: marginBottom }} className="relative">
          {marginStyle === 'dotted' && (
            <PrintSafePattern variant="dotted" />
          )}
          {marginStyle === 'lined' && (
            <PrintSafePattern variant="lined" lineSpacing={40} />
          )}
        </div>
      )}
      
      {/* Margin resize handle - visible on hover, always at the very bottom (not for tables) */}
      {onUpdateMargin && block.type !== 'table' && (
        <div
          onMouseDown={handleMarginMouseDown}
          className={`
            absolute left-1/2 -translate-x-1/2 w-16 h-4 cursor-row-resize
            flex items-center justify-center
            opacity-0 group-hover:opacity-100 transition-opacity
            ${isResizingMargin ? 'opacity-100' : ''}
          `}
          style={{ bottom: -8 }}
        >
          <div 
            className={`
              w-10 h-3 rounded-full border-2 transition-colors
              ${isResizingMargin 
                ? 'bg-blue-500 border-blue-500' 
                : 'bg-white border-slate-300 hover:border-blue-400'
              }
            `}
          />
        </div>
      )}

      {/* Action buttons - 2x2 grid, positioned OUTSIDE on the right */}
      {isSelected && (
        <div 
          className="absolute top-1/2 z-[100]"
          style={{ 
            right: '0px',
            transform: 'translateX(100%) translateY(-50%)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-1 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5">
            {/* Row 1: Up + Duplicate */}
            <button
              onClick={() => onMoveUp?.()}
              className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-colors"
              title={columnPosition === 'right' ? 'Přesunout doleva' : 'Posunout nahoru'}
            >
              {columnPosition === 'right' ? (
                <ChevronLeft size={20} className="text-blue-600" />
              ) : (
                <ChevronUp size={20} className="text-blue-600" />
              )}
            </button>
            <button
              onClick={() => onDuplicate?.()}
              className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-colors"
              title="Duplikovat"
            >
              <Copy size={16} className="text-blue-600" />
            </button>
            
            {/* Row 2: Down + Delete */}
            <button
              onClick={() => onMoveDown?.()}
              className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-colors"
              title={columnPosition === 'left' ? 'Přesunout doprava' : 'Posunout dolů'}
            >
              {columnPosition === 'left' ? (
                <ChevronRight size={20} className="text-blue-600" />
              ) : (
                <ChevronDown size={20} className="text-blue-600" />
              )}
            </button>
            <button
              onClick={() => onDelete?.()}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{ backgroundColor: '#ef4444', border: '1px solid #dc2626' }}
              title="Smazat"
            >
              <Trash2 size={16} color="white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// BLOCK CONTENT COMPONENTS
// ============================================

interface BlockContentProps {
  block: WorksheetBlock;
  isEditing: boolean;
  onUpdate: (content: any) => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
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
 * BlockWithImage - Wrapper that renders optional image alongside block content
 */
function BlockWithImage({ block, isEditing, onUpdate, onBlur, onKeyDown, globalFontSize = 'normal', activityNumber }: BlockContentProps) {
  const image = block.image;
  
  // If no image, just render the content directly
  if (!image?.url) {
    return (
      <BlockContent
        block={block}
        isEditing={isEditing}
        onUpdate={onUpdate}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        globalFontSize={globalFontSize}
        activityNumber={activityNumber}
      />
    );
  }

  const imageWidth = imageSizeToWidth[image.size] || '35%';

  // Image before content (above)
  if (image.position === 'before') {
    return (
      <div className="flex flex-col gap-3">
        <div style={{ maxWidth: imageWidth }}>
          <img 
            src={image.url} 
            alt={image.alt || ''} 
            className="w-full h-auto rounded-lg"
          />
        </div>
        <BlockContent
          block={block}
          isEditing={isEditing}
          onUpdate={onUpdate}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          globalFontSize={globalFontSize}
          activityNumber={activityNumber}
        />
      </div>
    );
  }

  // Image beside content (left or right)
  const isImageLeft = image.position === 'beside-left';
  
  return (
    <div className="flex gap-4 items-start">
      {isImageLeft && (
        <div style={{ width: imageWidth, flexShrink: 0 }}>
          <img 
            src={image.url} 
            alt={image.alt || ''} 
            className="w-full h-auto rounded-lg"
          />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <BlockContent
          block={block}
          isEditing={isEditing}
          onUpdate={onUpdate}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          globalFontSize={globalFontSize}
          activityNumber={activityNumber}
        />
      </div>
      {!isImageLeft && (
        <div style={{ width: imageWidth, flexShrink: 0 }}>
          <img 
            src={image.url} 
            alt={image.alt || ''} 
            className="w-full h-auto rounded-lg"
          />
        </div>
      )}
    </div>
  );
}

function BlockContent({ block, isEditing, onUpdate, onBlur, onKeyDown, globalFontSize = 'normal', activityNumber }: BlockContentProps) {
  const fontSizes = getFontSizes(globalFontSize);
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
          fontSizes={fontSizes}
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
          fontSizes={fontSizes}
        />
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
          isEditing={isEditing}
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

interface HeadingEditorProps {
  content: { text: string; level: 'h1' | 'h2' | 'h3'; align?: 'left' | 'center' | 'right' };
  isEditing: boolean;
  onUpdate: (content: any) => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  fontSizes: FontSizes;
}

function HeadingEditor({ content, isEditing, onUpdate, onBlur, onKeyDown, fontSizes }: HeadingEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...content, text: e.target.value });
  };

  const handleKeyDownLocal = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onBlur();
    }
    onKeyDown(e);
  };

  // Font sizes for headings - use global font size
  const sizeStyle = {
    h1: fontSizes.h1,
    h2: fontSizes.h2,
    h3: fontSizes.h3,
  }[content.level];

  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[content.align || 'left'];

  // H1 uses Cooper Light font - no quotes format like index.css line 510
  const isH1 = content.level === 'h1';
  const fontClass = isH1 ? 'font-cooper' : '';
  const fontWeight = isH1 ? 300 : 700;
  const fontFamily = isH1 ? 'Cooper Light, serif' : undefined;

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={content.text}
        onChange={handleChange}
        onBlur={onBlur}
        onKeyDown={handleKeyDownLocal}
        className={`w-full text-slate-800 bg-transparent border-none outline-none ${alignClass} ${fontClass}`}
        style={{ fontSize: sizeStyle, fontWeight, fontFamily }}
        placeholder="Zadejte nadpis..."
      />
    );
  }

  const HeadingTag = content.level as keyof JSX.IntrinsicElements;
  
  // Style object with font for H1 - apply to all child elements too
  const headingStyle: React.CSSProperties = {
    fontSize: sizeStyle,
    fontWeight,
    fontFamily,
  };
  
  // For H1, we need to ensure the font is applied to ALL nested elements
  // because Tailwind's base styles can override inherited fonts
  const innerStyle: React.CSSProperties = isH1 
    ? { fontFamily: 'Cooper Light, serif', fontWeight: 300 }
    : {};
  
  return (
    <HeadingTag 
      className={`text-slate-800 ${alignClass} ${fontClass}`}
      style={headingStyle}
    >
      {content.text ? (
        <span style={innerStyle}>
          <LatexRenderer text={content.text} style={innerStyle} />
        </span>
      ) : (
        <span className="text-slate-400" style={innerStyle}>Nadpis...</span>
      )}
    </HeadingTag>
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
    fontSize?: 'small' | 'normal' | 'large';
  };
  isEditing: boolean;
  onUpdate: (content: any) => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  fontSizes: FontSizes;
}

// Formatting toolbar button
function FormatButton({ 
  icon: Icon, 
  command, 
  title,
  onClick,
}: { 
  icon: React.ElementType; 
  command?: string; 
  title: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClick) {
      onClick(e);
    } else if (command) {
      document.execCommand(command, false);
    }
  };

  return (
    <button
      type="button"
      onMouseDown={handleClick}
      className="p-1.5 rounded transition-colors hover:bg-slate-200"
      style={{ color: '#64748b' }}
      title={title}
    >
      <Icon size={16} />
    </button>
  );
}

// Reusable formatting toolbar
interface FormattingToolbarProps {
  onInsertLatex: (latex: string) => void;
}

function FormattingToolbar({ onInsertLatex }: FormattingToolbarProps) {
  const [showLatexInput, setShowLatexInput] = useState(false);
  const [latexValue, setLatexValue] = useState('');
  const latexInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showLatexInput && latexInputRef.current) {
      latexInputRef.current.focus();
    }
  }, [showLatexInput]);

  const handleLatexSubmit = () => {
    if (latexValue.trim()) {
      onInsertLatex(`$${latexValue}$`);
      setLatexValue('');
      setShowLatexInput(false);
    }
  };

  const handleLatexKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLatexSubmit();
    } else if (e.key === 'Escape') {
      setShowLatexInput(false);
      setLatexValue('');
    }
  };

  return (
    <div className="flex flex-col gap-2 mb-2 pb-2 border-b border-slate-200">
      <div className="flex gap-1 items-center">
        <FormatButton icon={Bold} command="bold" title="Tučné (Ctrl+B)" />
        <FormatButton icon={Italic} command="italic" title="Kurzíva (Ctrl+I)" />
        <FormatButton icon={Underline} command="underline" title="Podtržené (Ctrl+U)" />
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={() => setShowLatexInput(!showLatexInput)}
          className={`p-1.5 rounded transition-colors ${showLatexInput ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-200 text-slate-500'}`}
          title="Vložit LaTeX vzorec"
        >
          <Sigma size={16} />
        </button>
      </div>
      
      {showLatexInput && (
        <div className="flex gap-2 items-center">
          <span className="text-slate-400 text-sm">$</span>
          <input
            ref={latexInputRef}
            type="text"
            value={latexValue}
            onChange={(e) => setLatexValue(e.target.value)}
            onKeyDown={handleLatexKeyDown}
            placeholder="x^2 + y^2 = z^2"
            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:border-blue-400"
          />
          <span className="text-slate-400 text-sm">$</span>
          <button
            type="button"
            onClick={handleLatexSubmit}
            className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Vložit
          </button>
        </div>
      )}
    </div>
  );
}

function ParagraphEditor({ content, isEditing, onUpdate, onBlur, onKeyDown, fontSizes }: ParagraphEditorProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  
  const displayMode = content.displayMode || 'normal';
  const bgColor = content.bgColor || 'blue';
  const hasBorder = content.hasBorder ?? true;
  const align = content.align || 'left';
  const fontSize = content.fontSize || 'normal';

  // Get colors
  const colors = PARAGRAPH_BG_COLORS[bgColor] || PARAGRAPH_BG_COLORS.blue;

  // Font size using global font sizes
  const fontSizeStyle = {
    small: fontSizes.small,
    normal: fontSizes.body,
    large: fontSizes.large,
  }[fontSize];

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.style.height = 'auto';
      editorRef.current.style.height = `${editorRef.current.scrollHeight}px`;
    }
  }, []);

  // Focus editor when editing starts
  useEffect(() => {
    if (isEditing && editorRef.current) {
      editorRef.current.focus();
      // Place cursor at end
      const len = editorRef.current.value.length;
      editorRef.current.setSelectionRange(len, len);
      // Auto-resize on initial focus
      autoResize();
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
  const plainText = content.html?.replace(/<[^>]*>/g, '') || '';

  const textStyle: React.CSSProperties = {
    textAlign: align,
    fontSize: fontSizeStyle,
    fontFamily: FONT_FAMILY,
    lineHeight: 1.5,
    outline: 'none',
    minHeight: '1.5em',
    margin: 0,
  };

  const handleInsertLatex = (latex: string) => {
    const newValue = plainText + ' ' + latex;
    onUpdate({ ...content, html: newValue });
  };

  if (isEditing) {
    return (
      <div
        style={wrapperStyle}
        className={displayMode === 'infobox' ? 'paragraph-infobox' : undefined}
        data-bg-color={displayMode === 'infobox' ? bgColor : undefined}
        data-has-border={displayMode === 'infobox' ? (hasBorder ? 'true' : 'false') : undefined}
      >
        {/* Formatting toolbar with LaTeX */}
        <FormattingToolbar onInsertLatex={handleInsertLatex} />
        
        {/* Editable content - use textarea for consistent font */}
        <textarea
          ref={editorRef}
          value={plainText}
          onChange={(e) => {
            onUpdate({ ...content, html: e.target.value });
            autoResize();
          }}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          onInput={autoResize}
          className="w-full text-slate-600 bg-transparent border-none outline-none resize-none overflow-hidden"
          style={{ ...textStyle, minHeight: '40px' }}
          placeholder="Odstavec textu..."
        />
      </div>
    );
  }

  // Non-editing view - with LaTeX support
  return (
    <div
      style={wrapperStyle}
      className={displayMode === 'infobox' ? 'paragraph-infobox' : undefined}
      data-bg-color={displayMode === 'infobox' ? bgColor : undefined}
      data-has-border={displayMode === 'infobox' ? (hasBorder ? 'true' : 'false') : undefined}
    >
      <div 
        className="text-slate-600"
        style={textStyle}
      >
        {plainText ? (
          <LatexRenderer text={plainText} />
        ) : (
          <span style={{ color: '#94a3b8' }}>Odstavec textu...</span>
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
  fontSizes: FontSizes;
}

function InfoboxEditor({ content, isEditing, onUpdate, onBlur, onKeyDown, fontSizes }: InfoboxEditorProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const plainText = content.html?.replace(/<[^>]*>/g, '') || '';

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

  const variantStyles = {
    blue: 'bg-blue-50 border-l-4 border-blue-500',
    green: 'bg-green-50 border-l-4 border-green-500',
    yellow: 'bg-yellow-50 border-l-4 border-yellow-500',
    purple: 'bg-purple-50 border-l-4 border-purple-500',
  };

  return (
    <div className={`p-4 rounded-lg ${variantStyles[content.variant]}`} style={{ fontSize: fontSizes.body }}>
      {isEditing ? (
        <>
          <input
            ref={titleRef}
            type="text"
            value={content.title || ''}
            onChange={(e) => onUpdate({ ...content, title: e.target.value })}
            onKeyDown={onKeyDown}
            className="w-full font-semibold text-slate-800 bg-transparent border-none outline-none mb-2"
            style={{ fontSize: fontSizes.title }}
            placeholder="Titulek (volitelný)..."
          />
          <textarea
            ref={textRef}
            value={plainText}
            onChange={(e) => {
              onUpdate({ ...content, html: `<p>${e.target.value}</p>` });
              autoResize();
            }}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            onInput={autoResize}
            className="w-full text-slate-700 bg-transparent border-none outline-none resize-none overflow-hidden"
            style={{ fontSize: fontSizes.body, minHeight: '40px' }}
            placeholder="Text infoboxu..."
          />
        </>
      ) : (
        <>
          {content.title && (
            <h4 className="font-semibold mb-1 text-slate-800" style={{ fontSize: fontSizes.title }}>{content.title}</h4>
          )}
          <div 
            className="text-slate-700"
            style={{ fontSize: fontSizes.body }}
            dangerouslySetInnerHTML={{ 
              __html: content.html || '<p class="text-slate-400">Infobox...</p>' 
            }}
          />
        </>
      )}
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
  const questionRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    if (questionRef.current) {
      questionRef.current.style.height = 'auto';
      questionRef.current.style.height = `${questionRef.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    if (isEditing && questionRef.current) {
      questionRef.current.focus();
      setTimeout(autoResize, 0);
    }
  }, [isEditing, autoResize]);

  const handleQuestionChange = (value: string) => {
    onUpdate({ ...content, question: value });
  };

  const handleOptionChange = (optionId: string, text: string) => {
    onUpdate({
      ...content,
      options: content.options.map(opt =>
        opt.id === optionId ? { ...opt, text } : opt
      ),
    });
  };

  const addOption = () => {
    const newOption: ChoiceOption = {
      id: `opt-${Date.now()}`,
      text: '',
    };
    onUpdate({
      ...content,
      options: [...content.options, newOption],
    });
  };

  const removeOption = (optionId: string) => {
    if (content.options.length <= 2) return;
    onUpdate({
      ...content,
      options: content.options.filter(opt => opt.id !== optionId),
      correctAnswers: content.correctAnswers.filter(id => id !== optionId),
    });
  };

  const handleInsertLatex = (latex: string) => {
    handleQuestionChange(content.question + ' ' + latex);
  };

  return (
    <div style={{ fontSize: fontSizes.body }}>
      {/* Question with optional activity number */}
      <div className="flex items-start gap-3 mb-3">
        {activityNumber && (
          <div
            className="flex items-center justify-center shrink-0 font-bold text-white activity-number-circle"
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
            <>
              <FormattingToolbar onInsertLatex={handleInsertLatex} />
              <textarea
                ref={questionRef}
                value={content.question}
                onChange={(e) => {
                  handleQuestionChange(e.target.value);
                  autoResize();
                }}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                onInput={autoResize}
                className="w-full font-medium text-slate-800 bg-transparent border-none outline-none resize-none overflow-hidden"
                style={{ fontSize: fontSizes.title, minHeight: '1.5em' }}
                placeholder="Zadejte otázku..."
                rows={1}
              />
            </>
          ) : (
            <p className="font-medium text-slate-800" style={{ fontSize: fontSizes.title }}>
              {content.question ? (
                <LatexRenderer text={content.question} />
              ) : (
                <span className="text-slate-400">Otázka...</span>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {content.options.map((opt, i) => {
          const isCorrect = content.correctAnswers.includes(opt.id);
          return (
            <div key={opt.id} className="flex items-center gap-3 group/option">
            {/* Circle with letter A, B, C, D - green if correct */}
            <div
              className={`flex items-center justify-center shrink-0 font-semibold choice-circle ${isCorrect ? 'choice-circle--correct' : ''}`}
              style={{
                width: '21px',
                height: '21px',
                minWidth: '21px',
                minHeight: '21px',
                borderRadius: '50%',
                border: isCorrect ? 'none' : '1.5px solid #1e293b',
                color: isCorrect ? '#ffffff' : '#1e293b',
                backgroundColor: isCorrect ? '#22c55e' : 'transparent',
                fontSize: '12px',
              }}
            >
              {String.fromCharCode(65 + i)}
            </div>
            
            {isEditing ? (
              <>
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => handleOptionChange(opt.id, e.target.value)}
                  onBlur={onBlur}
                  onKeyDown={onKeyDown}
                  className="flex-1 text-slate-600 bg-transparent border-none outline-none"
                  style={{ fontSize: fontSizes.body }}
                  placeholder={`Možnost ${i + 1}`}
                />
                {content.options.length > 2 && (
                  <button
                    onClick={() => removeOption(opt.id)}
                    className="opacity-0 group-hover/option:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </>
            ) : (
              <span className="text-slate-600" style={{ fontSize: fontSizes.body }}>
                {opt.text ? (
                  <LatexRenderer text={opt.text} />
                ) : (
                  `Možnost ${i + 1}`
                )}
              </span>
            )}
          </div>
          );
        })}

        {isEditing && (
          <button
            onClick={addOption}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mt-1"
            style={{ fontSize: fontSizes.small }}
          >
            <Plus className="h-3 w-3" />
            Přidat možnost
          </button>
        )}
      </div>
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

  useEffect(() => {
    if (isEditing && instructionRef.current) {
      instructionRef.current.focus();
    }
  }, [isEditing]);

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
            <input
              ref={instructionRef}
              type="text"
              value={content.instruction || ''}
              onChange={(e) => onUpdate({ ...content, instruction: e.target.value })}
              onKeyDown={onKeyDown}
              className="w-full text-slate-500 bg-transparent border-none outline-none mb-1"
              style={{ fontSize: fontSizes.small }}
              placeholder="Instrukce (volitelné)..."
            />
          ) : content.instruction ? (
            <p className="text-slate-500 mb-1" style={{ fontSize: fontSizes.small }}>
              <LatexRenderer text={content.instruction} />
            </p>
          ) : null}

          <p className="text-slate-600" style={{ fontSize: fontSizes.body }}>
            {content.segments.map((seg, i) => (
              <span key={i}>
                {seg.type === 'text' ? (
                  <LatexRenderer text={seg.content} />
                ) : (
                  <span className="inline-block min-w-[60px] border-b-2 border-slate-400 text-center mx-1 px-1">
                    <span className="text-slate-400" style={{ fontSize: FONT_SIZES.small }}>{seg.correctAnswer || '...'}</span>
                  </span>
                )}
              </span>
            ))}
          </p>
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
  };
  isEditing: boolean;
  onUpdate: (content: any) => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  fontSizes: FontSizes;
  activityNumber?: number;
}

function FreeAnswerEditor({ content, isEditing, onUpdate, onBlur, onKeyDown, fontSizes, activityNumber }: FreeAnswerEditorProps) {
  const questionRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    if (questionRef.current) {
      questionRef.current.style.height = 'auto';
      questionRef.current.style.height = `${questionRef.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    if (isEditing && questionRef.current) {
      questionRef.current.focus();
      setTimeout(autoResize, 0);
    }
  }, [isEditing, autoResize]);

  const handleInsertLatex = (latex: string) => {
    onUpdate({ ...content, question: content.question + ' ' + latex });
  };

  return (
    <div style={{ fontSize: fontSizes.body }}>
      {/* Question with optional activity number */}
      <div className="flex items-start gap-3 mb-3">
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
            <>
              <FormattingToolbar onInsertLatex={handleInsertLatex} />
              <textarea
                ref={questionRef}
                value={content.question}
                onChange={(e) => {
                  onUpdate({ ...content, question: e.target.value });
                  autoResize();
                }}
                onKeyDown={onKeyDown}
                onInput={autoResize}
                className="w-full font-medium text-slate-800 bg-transparent border-none outline-none resize-none overflow-hidden"
                style={{ fontSize: fontSizes.title, minHeight: '1.5em' }}
                placeholder="Zadejte otázku..."
                rows={1}
              />
            </>
          ) : (
            <p className="font-medium text-slate-800" style={{ fontSize: fontSizes.title }}>
              {content.question ? (
                <LatexRenderer text={content.question} />
              ) : (
                <span className="text-slate-400">Otázka...</span>
              )}
            </p>
          )}
        </div>
      </div>

      {content.hint && (
        <p className="text-slate-500 mb-1 italic" style={{ fontSize: fontSizes.small, paddingLeft: activityNumber ? '40px' : 0 }}>
          <LatexRenderer text={content.hint} />
        </p>
      )}

      <div 
        className="mt-1"
        style={{ height: `${content.lines * 40}px`, marginLeft: activityNumber ? '40px' : 0 }}
      >
        {Array.from({ length: content.lines }).map((_, i) => (
          <div key={i} className="border-b border-slate-300" style={{ height: '40px' }} />
        ))}
      </div>
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  // Default values for safety
  const height = content?.height ?? 100;
  const style = content?.style ?? 'empty';

  // Handle vertical resize drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startY = e.clientY;
    const startHeight = height;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - startY;
      const newHeight = Math.max(20, Math.min(500, startHeight + delta));
      onUpdate({ height: newHeight, style });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [height, style, onUpdate]);

  // Render pattern based on style
  const renderPattern = () => {
    const lineSpacing = 40; // px between lines (increased by 70%)
    
    switch (style) {
      case 'dotted':
        return <PrintSafePattern variant="dotted" />;
      case 'lined':
        return <PrintSafePattern variant="lined" lineSpacing={lineSpacing} />;
      case 'empty':
      default:
        return null;
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative ${isEditing ? 'ring-1 ring-blue-400 ring-dashed' : ''}`}
      style={{ height }}
    >
      {renderPattern()}
      
      {/* Resize handle */}
      {isEditing && (
        <div
          onMouseDown={handleMouseDown}
          className={`
            absolute bottom-0 left-0 right-0 h-4 cursor-row-resize
            flex items-center justify-center
            ${isResizing ? 'bg-blue-50' : 'hover:bg-slate-50'}
          `}
        >
          <div className="w-16 h-1 bg-slate-300 rounded-full" />
        </div>
      )}
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

function ImageEditor({ content, isEditing, onUpdate }: ImageEditorProps) {
  const { url, alt, caption, showCaption = true, size = 'medium', alignment = 'center' } = content;
  
  // Hooks must be before any early returns!
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Reset loading state when URL changes
  useEffect(() => {
    if (url) {
      setIsLoading(true);
      setHasError(false);
    }
  }, [url]);

  // If the image is cached, onLoad may not fire reliably. Unblock based on `complete`.
  useEffect(() => {
    if (!url) return;
    const img = imgRef.current;
    if (!img) return;
    if (img.complete) {
      // If it loaded successfully, naturalWidth will be > 0.
      if (img.naturalWidth > 0) {
        setIsLoading(false);
        setHasError(false);
      }
    }
  }, [url, size, alignment]);

  // Size to max-width mapping
  const sizeToWidth: Record<ImageSize, string> = {
    small: '30%',
    medium: '50%',
    large: '75%',
    full: '100%',
  };

  // Alignment to justify-content mapping
  const alignmentToJustify: Record<string, string> = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
  };

  // No image URL - show placeholder
  if (!url) {
    return (
      <div 
        className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50"
      >
        <ImageIcon className="w-12 h-12 text-slate-400 mb-2" />
        <p className="text-slate-500 text-sm mb-2">Žádný obrázek</p>
        {isEditing && (
          <input
            type="text"
            placeholder="Vložte URL obrázku..."
            className="w-full max-w-md px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            onBlur={(e) => {
              if (e.target.value) {
                onUpdate({ ...content, url: e.target.value });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
                onUpdate({ ...content, url: (e.target as HTMLInputElement).value });
              }
            }}
          />
        )}
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center py-6 px-4 border border-slate-200 rounded-lg bg-slate-50">
        <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
        <p className="text-slate-500 text-sm">Obrázek se nepodařilo načíst</p>
        {alt && <p className="text-slate-400 text-xs mt-1">{alt}</p>}
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col"
      style={{ alignItems: alignmentToJustify[alignment] }}
    >
      <div style={{ maxWidth: sizeToWidth[size], width: '100%' }}>
        {isLoading && (
          <div className="flex items-center justify-center py-8 bg-slate-100 rounded-lg">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <img
          ref={imgRef}
          src={url}
          alt={alt || ''}
          className="w-full h-auto rounded-lg"
          // Keep in layout so browser can resolve load correctly; fade in when ready.
          style={{ opacity: isLoading ? 0 : 1, transition: 'opacity 150ms ease' }}
          loading="eager"
          decoding="async"
          onLoad={() => {
            setIsLoading(false);
            setHasError(false);
          }}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
        />
        {!isLoading && caption && showCaption && (
          <p className="text-center text-slate-500 text-sm mt-2 italic">
            {caption}
          </p>
        )}
      </div>
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
      });
    },
  });

  // Apply styles to table element
  useEffect(() => {
    if (editorWrapperRef.current) {
      const table = editorWrapperRef.current.querySelector('table');
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
    }
  }, [hasBorder, hasRoundedCorners, colorStyle, editor]);

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

  if (!editor) return null;

  return (
    <div 
      className="worksheet-table-container relative" 
      ref={editorWrapperRef} 
      style={{ paddingTop: isEditing ? '50px' : '0', paddingBottom: isEditing ? '60px' : '0' }}
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
              bottom: 52,
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
              bottom: 16,
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
