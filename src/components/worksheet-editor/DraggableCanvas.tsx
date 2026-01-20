/**
 * DraggableCanvas - A4 canvas s drag & drop, inline editací, stránkováním a resizerem
 * 
 * Zobrazuje náhled pracovního listu s:
 * - Drag & drop pro přesouvání bloků
 * - Inline editace
 * - A4 stránkování s viditelným předělem
 * - Podpora polovičních bloků (dva vedle sebe)
 * - Resizer pro změnu poměru mezi polovičními bloky
 */

import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { WorksheetBlock, BlockType, BlockWidth, GlobalFontSize } from '../../types/worksheet';
import { Sparkles, Plus, Scissors, Type, ImageIcon, Info, CheckSquare, PenLine, MessageSquare, PlusCircle, QrCode } from 'lucide-react';
import { Button } from '../ui/button';
import { EditableBlock } from './EditableBlock';

// A4 dimensions at 96dpi
const A4_HEIGHT_PX = 1123; // 297mm
const A4_WIDTH_PX = 794;   // 210mm
const PADDING_PX = 22;     // ~6mm padding (reduced by 70%)
const CONTENT_HEIGHT = A4_HEIGHT_PX - (PADDING_PX * 2);

interface DraggableCanvasProps {
  blocks: WorksheetBlock[];
  selectedBlockId: string | null;
  hoveredBlockId?: string | null;
  onSelectBlock: (blockId: string | null) => void;
  onUpdateBlock: (blockId: string, content: any) => void;
  onUpdateBlockWidth: (blockId: string, width: BlockWidth, widthPercent?: number) => void;
  onUpdateBlockMargin: (blockId: string, marginBottom: number) => void;
  onDeleteBlock?: (blockId: string) => void;
  onDuplicateBlock?: (blockId: string) => void;
  onMoveBlockUp?: (blockId: string) => void;
  onMoveBlockDown?: (blockId: string) => void;
  onAddBlock: (type: BlockType) => void;
  onSwitchToAI: () => void;
  onOpenAddPanel: () => void;
  onOpenAI?: () => void;
  columns?: 1 | 2;
  globalFontSize?: GlobalFontSize;
  /** If set, user is choosing where to insert this block type */
  pendingInsertType?: BlockType | null;
  /** Insert pending block above given block id */
  onInsertBefore?: (targetBlockId: string) => void;
}

// Quick add bar component - hidden in print
function QuickAddBar({ 
  onAddBlock, 
  onSwitchToAI, 
  onOpenAddPanel 
}: { 
  onAddBlock: (type: BlockType) => void; 
  onSwitchToAI: () => void; 
  onOpenAddPanel: () => void;
}) {
  const Item = ({ 
    icon: Icon, 
    label, 
    onClick, 
    variant = 'default' 
  }: { 
    icon: any; 
    label: string; 
    onClick: () => void;
    variant?: 'default' | 'ai' | 'more';
  }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex flex-col items-center justify-start gap-1.5 group transition-all shrink-0 py-2 px-2.5"
    >
      <div className="w-10 h-10 flex items-center justify-center">
        <Icon 
          size={27} 
          strokeWidth={1.5} 
          className={`transition-colors ${
            variant === 'ai' ? 'text-blue-500 group-hover:text-blue-600' : 
            variant === 'more' ? 'text-slate-500 group-hover:text-slate-600' : 
            'text-slate-400 group-hover:text-slate-500'
          }`}
        />
      </div>
      <span className={`font-normal text-center leading-tight transition-colors ${
        variant === 'ai' ? 'text-blue-500 group-hover:text-blue-600' : 'text-slate-400 group-hover:text-slate-500'
      }`} style={{ fontSize: '13px' }}>
        {label}
      </span>
    </button>
  );

  const Divider = () => <div className="w-px h-9 bg-slate-200 self-center" />;

  return (
    <div 
      className="bg-slate-50 rounded-xl py-2 px-3 print:hidden"
      data-print-hide="true"
    >
      <div className="text-[8px] font-medium text-slate-400 mb-1.5 px-1">Přidat:</div>
      <div className="flex items-center justify-center gap-1">
        <Item icon={Sparkles} label="Podle AI" onClick={onSwitchToAI} variant="ai" />

        <Divider />

        <Item icon={Type} label="Odstavec" onClick={() => onAddBlock('paragraph')} />
        <Item icon={ImageIcon} label="Obrázek" onClick={() => onAddBlock('image')} />
        <Item icon={Info} label="Infobox" onClick={() => onAddBlock('infobox')} />
        <Item icon={QrCode} label="QR kód" onClick={() => onAddBlock('qr-code')} />

        <Divider />

        <Item icon={CheckSquare} label="Výběr" onClick={() => onAddBlock('multiple-choice')} />
        <Item icon={PenLine} label="Doplnění" onClick={() => onAddBlock('fill-blank')} />
        <Item icon={MessageSquare} label="Volná" onClick={() => onAddBlock('free-answer')} />

        <Divider />

        <Item icon={PlusCircle} label="Více" onClick={onOpenAddPanel} variant="more" />
      </div>
    </div>
  );
}

// Page break indicator component - hidden in print
function PageBreak({ pageNumber }: { pageNumber: number }) {
  return (
    <div 
      className="w-full py-6 relative flex items-center justify-center print:hidden"
      data-print-hide="true"
    >
      <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-slate-300" />
      <div className="relative flex items-center gap-2 px-4 bg-slate-200">
        <Scissors className="h-4 w-4 text-slate-400 rotate-90" />
        <span className="text-xs font-medium text-slate-500">
          Konec strany {pageNumber}
        </span>
        <Scissors className="h-4 w-4 text-slate-400 -rotate-90" />
      </div>
    </div>
  );
}

// Resizer component between two half-width blocks
interface ResizerProps {
  block1Id: string;
  block2Id: string;
  block1Percent: number;
  onResize: (block1Id: string, block2Id: string, newPercent: number) => void;
}

function Resizer({ block1Id, block2Id, block1Percent, onResize }: ResizerProps) {
  const resizerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [localPercent, setLocalPercent] = useState<number | null>(null);
  
  // Use local percent during drag, otherwise use prop
  const displayPercent = localPercent !== null ? localPercent : block1Percent;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const container = resizerRef.current?.parentElement;
    if (!container) return;
    
    const containerWidth = container.offsetWidth;
    if (containerWidth <= 0) return;

    setIsResizing(true);
    setLocalPercent(block1Percent);
    
    const startX = e.clientX;
    const startPercent = block1Percent;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const deltaPercent = (delta / containerWidth) * 100;
      let newPercent = startPercent + deltaPercent;
      
      // Clamp between 20% and 80%
      newPercent = Math.min(80, Math.max(20, newPercent));
      
      // Snap to 50% if close
      if (Math.abs(newPercent - 50) < 3) {
        newPercent = 50;
      }
      
      // Only update local state during drag (no flickering)
      setLocalPercent(Math.round(newPercent));
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      // Calculate final percent on mouse up
      const delta = upEvent.clientX - startX;
      const deltaPercent = (delta / containerWidth) * 100;
      let finalPercent = startPercent + deltaPercent;
      finalPercent = Math.min(80, Math.max(20, finalPercent));
      if (Math.abs(finalPercent - 50) < 3) {
        finalPercent = 50;
      }
      
      // Commit the change
      onResize(block1Id, block2Id, Math.round(finalPercent));
      
      setIsResizing(false);
      setLocalPercent(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
  
  // Expose displayPercent for parent to use
  // We need to update the parent's visual during drag
  useEffect(() => {
    if (localPercent !== null && resizerRef.current?.parentElement) {
      const parent = resizerRef.current.parentElement;
      const leftCol = parent.children[0] as HTMLElement;
      const rightCol = parent.children[2] as HTMLElement;
      if (leftCol && rightCol) {
        leftCol.style.width = `calc(${localPercent}% - 12px)`;
        rightCol.style.width = `calc(${100 - localPercent}% - 12px)`;
      }
    }
  }, [localPercent]);

  return (
    <div
      ref={resizerRef}
      data-print-hide="true"
      className="relative w-6 cursor-col-resize flex-shrink-0 flex items-center justify-center group resize-handle print:hidden"
      onMouseDown={handleMouseDown}
      title="Přetáhněte pro změnu poměru"
    >
      {/* Vertical line - shorter, light gray */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 transition-colors"
        style={{ 
          width: '2px', 
          height: '60%',
          top: '20%',
          backgroundColor: isResizing ? '#3b82f6' : '#e5e7eb'
        }}
      />
      {/* Handle (bobánek) */}
      <div 
        className={`
          relative z-10 w-3 h-8 rounded-full border-2 transition-colors
          ${isResizing 
            ? 'bg-blue-500 border-blue-500' 
            : 'bg-white border-slate-400 group-hover:border-blue-400'
          }
        `}
      />
    </div>
  );
}

export function DraggableCanvas({
  blocks,
  selectedBlockId,
  hoveredBlockId,
  onSelectBlock,
  onUpdateBlock,
  onUpdateBlockWidth,
  onUpdateBlockMargin,
  onDeleteBlock,
  onDuplicateBlock,
  onMoveBlockUp,
  onMoveBlockDown,
  onAddBlock,
  onSwitchToAI,
  onOpenAddPanel,
  onOpenAI,
  columns = 1,
  globalFontSize = 'small',
  pendingInsertType,
  onInsertBefore,
}: DraggableCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLElement>(null);
  const [blockHeights, setBlockHeights] = useState<Record<string, number>>({});
  const [insertHoverId, setInsertHoverId] = useState<string | null>(null);

  useEffect(() => {
    // Reset hover when entering/leaving insert mode
    setInsertHoverId(null);
  }, [pendingInsertType]);

  // Calculate activity numbers for activity blocks (multiple-choice, fill-blank, free-answer)
  const activityNumbers = useMemo(() => {
    const activityTypes = ['multiple-choice', 'fill-blank', 'free-answer'];
    const numbers: Record<string, number> = {};
    let counter = 1;
    
    blocks.forEach((block) => {
      if (activityTypes.includes(block.type)) {
        numbers[block.id] = counter;
        counter++;
      }
    });
    
    return numbers;
  }, [blocks]);

  // Deselect block when clicking outside of any block
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // If the target is no longer in the document, ignore
      if (!document.contains(target)) {
        return;
      }
      
      // Check if click was inside a block
      const clickedBlock = target.closest('[data-block-id]');
      
      // Check if click was inside the block settings overlay
      const clickedOverlay = target.closest('[data-settings-overlay]');
      
      // Check if click was inside the sidebar
      const clickedSidebar = target.closest('[data-sidebar]');

      // Check if click was inside the text toolbar (by class or data attribute)
      const clickedToolbar = target.closest('.worksheet-text-toolbar') || 
                             target.closest('[data-toolbar-for-block]') ||
                             target.closest('[data-toolbar-element]');
      
      // If click was NOT on a block, NOT on overlay, NOT on sidebar, and NOT on toolbar - deselect
      if (!clickedBlock && !clickedOverlay && !clickedSidebar && !clickedToolbar) {
        onSelectBlock(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onSelectBlock]);

  // Handle resize between two half-width blocks
  // Only update the first block - the second will use (100 - firstPercent)
  const handleResize = useCallback((block1Id: string, _block2Id: string, newPercent: number) => {
    onUpdateBlockWidth(block1Id, 'half', newPercent);
  }, [onUpdateBlockWidth]);

  // Calculate page breaks based on cumulative heights
  const pagesData = useMemo(() => {
    const pages: { blocks: WorksheetBlock[]; pageNumber: number }[] = [];
    let currentPage: WorksheetBlock[] = [];
    let currentHeight = 0;
    let pageNumber = 1;

    // Group blocks considering half-width blocks
    let i = 0;
    while (i < blocks.length) {
      const block = blocks[i];
      const blockHeight = blockHeights[block.id] || 100; // Default height estimate
      
      // Check if this block and next form a half-width pair
      const isHalf = block.width === 'half';
      const nextBlock = blocks[i + 1];
      const nextIsHalf = nextBlock?.width === 'half';
      
      let rowHeight = blockHeight;
      
      if (isHalf && nextIsHalf) {
        // Two half blocks side by side - use max height
        const nextHeight = blockHeights[nextBlock.id] || 100;
        rowHeight = Math.max(blockHeight, nextHeight);
      }

      // Check if adding this row would exceed page height
      if (currentHeight + rowHeight > CONTENT_HEIGHT && currentPage.length > 0) {
        // Start new page
        pages.push({ blocks: currentPage, pageNumber });
        currentPage = [];
        currentHeight = 0;
        pageNumber++;
      }

      currentPage.push(block);
      
      if (isHalf && nextIsHalf) {
        currentPage.push(nextBlock);
        i += 2;
      } else {
        i++;
      }
      
      currentHeight += rowHeight + 16; // 16px gap
    }

    // Don't forget the last page
    if (currentPage.length > 0) {
      pages.push({ blocks: currentPage, pageNumber });
    }

    return pages;
  }, [blocks, blockHeights]);

  // Measure block heights
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const newHeights: Record<string, number> = {};
      entries.forEach((entry) => {
        const blockId = (entry.target as HTMLElement).dataset.blockId;
        if (blockId) {
          newHeights[blockId] = entry.contentRect.height;
        }
      });
      setBlockHeights((prev) => ({ ...prev, ...newHeights }));
    });

    const blockElements = containerRef.current.querySelectorAll('[data-block-id]');
    blockElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [blocks]);

  // Render blocks with half-width support and resizer
  const renderBlocksWithLayout = (pageBlocks: WorksheetBlock[]) => {
    const rows: JSX.Element[] = [];
    let i = 0;

    // Memoized handlers to prevent unnecessary re-renders and stale closures
    const getUpdateHandler = (id: string) => (content: any) => onUpdateBlock(id, content);
    const getMarginUpdateHandler = (id: string) => (margin: number) => onUpdateBlockMargin(id, margin);
    const getDeleteHandler = (id: string) => onDeleteBlock ? () => onDeleteBlock(id) : undefined;
    const getDuplicateHandler = (id: string) => onDuplicateBlock ? () => onDuplicateBlock(id) : undefined;
    const getMoveUpHandler = (id: string) => onMoveBlockUp ? () => onMoveBlockUp(id) : undefined;
    const getMoveDownHandler = (id: string) => onMoveBlockDown ? () => onMoveBlockDown(id) : undefined;

    while (i < pageBlocks.length) {
      const block = pageBlocks[i];
      const isHalf = block.width === 'half';
      const nextBlock = pageBlocks[i + 1];
      const nextIsHalf = nextBlock?.width === 'half';

      if (isHalf && nextIsHalf) {
        console.log('[Canvas] PAIR found:', block.type, '+', nextBlock.type);
        // Get width percentages (default to 50)
        const block1Percent = block.widthPercent ?? 50;
        const block2Percent = 100 - block1Percent;
        
        // Render two half blocks side by side with resizer
        rows.push(
          <div key={`row-${block.id}`} className="flex items-stretch relative" style={{ minHeight: '40px' }}>
            <div
              className="overflow-visible relative"
              style={{
                width: `calc(${block1Percent}% - 12px)`,
                flexShrink: 0,
                zIndex: selectedBlockId === block.id ? 50 : 1,
              }}
              data-block-id={block.id}
              onMouseEnter={() => pendingInsertType && setInsertHoverId(block.id)}
            >
              {pendingInsertType && insertHoverId === block.id && (
                <button
                  type="button"
                  className="absolute left-0 right-0 h-6 flex items-center justify-center"
                  style={{ top: '-12px', zIndex: 9999 }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onInsertBefore?.(block.id);
                  }}
                >
                  <div 
                    className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-full"
                    style={{ height: '4px', backgroundColor: '#2563eb', zIndex: 1 }}
                  />
                  <div 
                    className="relative flex items-center justify-center shadow-lg"
                    style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#2563eb', color: 'white', zIndex: 10 }}
                  >
                    <Plus className="w-4 h-4" />
                  </div>
                </button>
              )}
              <EditableBlock
                block={block}
                isSelected={selectedBlockId === block.id}
                isHovered={hoveredBlockId === block.id}
                onSelect={() => onSelectBlock(block.id)}
                onUpdate={getUpdateHandler(block.id)}
                onUpdateMargin={getMarginUpdateHandler(block.id)}
                onDelete={getDeleteHandler(block.id)}
                onDuplicate={getDuplicateHandler(block.id)}
                onMoveUp={getMoveUpHandler(block.id)}
                onMoveDown={getMoveDownHandler(block.id)}
                globalFontSize={globalFontSize}
                activityNumber={activityNumbers[block.id]}
                columnPosition="left"
                onOpenAI={onOpenAI}
              />
            </div>
            
            {/* Resizer */}
            <Resizer
              block1Id={block.id}
              block2Id={nextBlock.id}
              block1Percent={block1Percent}
              onResize={handleResize}
            />
            
            <div
              className="overflow-visible relative"
              style={{
                width: `calc(${block2Percent}% - 12px)`,
                flexShrink: 0,
                zIndex: selectedBlockId === nextBlock.id ? 50 : 1,
              }}
              data-block-id={nextBlock.id}
              onMouseEnter={() => pendingInsertType && setInsertHoverId(nextBlock.id)}
            >
              {pendingInsertType && insertHoverId === nextBlock.id && (
                <button
                  type="button"
                  className="absolute left-0 right-0 h-6 flex items-center justify-center"
                  style={{ top: '-12px', zIndex: 9999 }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onInsertBefore?.(nextBlock.id);
                  }}
                >
                  <div 
                    className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-full"
                    style={{ height: '4px', backgroundColor: '#2563eb', zIndex: 1 }}
                  />
                  <div 
                    className="relative flex items-center justify-center shadow-lg"
                    style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#2563eb', color: 'white', zIndex: 10 }}
                  >
                    <Plus className="w-4 h-4" />
                  </div>
                </button>
              )}
              <EditableBlock
                block={nextBlock}
                isSelected={selectedBlockId === nextBlock.id}
                isHovered={hoveredBlockId === nextBlock.id}
                onSelect={() => onSelectBlock(nextBlock.id)}
                onUpdate={getUpdateHandler(nextBlock.id)}
                onUpdateMargin={getMarginUpdateHandler(nextBlock.id)}
                onDelete={getDeleteHandler(nextBlock.id)}
                onDuplicate={getDuplicateHandler(nextBlock.id)}
                onMoveUp={getMoveUpHandler(nextBlock.id)}
                onMoveDown={getMoveDownHandler(nextBlock.id)}
                globalFontSize={globalFontSize}
                activityNumber={activityNumbers[nextBlock.id]}
                columnPosition="right"
                onOpenAI={onOpenAI}
              />
            </div>
          </div>
        );
        i += 2;
      } else {
        // Render full width block (or lone half block)
        rows.push(
          <div 
            key={block.id}
            className={`${isHalf ? 'w-1/2' : 'w-full'} relative overflow-visible`}
            data-block-id={block.id}
            onMouseEnter={() => pendingInsertType && setInsertHoverId(block.id)}
          >
            {pendingInsertType && insertHoverId === block.id && (
              <button
                type="button"
                className="absolute left-0 right-0 h-6 flex items-center justify-center"
                style={{ top: '-12px', zIndex: 9999 }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onInsertBefore?.(block.id);
                }}
              >
                <div 
                  className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-full"
                  style={{ height: '4px', backgroundColor: '#2563eb', zIndex: 1 }}
                />
                <div 
                  className="relative flex items-center justify-center shadow-lg"
                  style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#2563eb', color: 'white', zIndex: 10 }}
                >
                  <Plus className="w-4 h-4" />
                </div>
              </button>
            )}
            <EditableBlock
              block={block}
              isSelected={selectedBlockId === block.id}
              isHovered={hoveredBlockId === block.id}
              onSelect={() => onSelectBlock(block.id)}
              onUpdate={getUpdateHandler(block.id)}
              onUpdateMargin={getMarginUpdateHandler(block.id)}
              onDelete={getDeleteHandler(block.id)}
              onDuplicate={getDuplicateHandler(block.id)}
              onMoveUp={getMoveUpHandler(block.id)}
              onMoveDown={getMoveDownHandler(block.id)}
              activityNumber={activityNumbers[block.id]}
              globalFontSize={globalFontSize}
              onOpenAI={onOpenAI}
            />
          </div>
        );
        i++;
      }
    }

    return rows;
  };

  // Handle resize for 2-column layout (different from half-width blocks)
  // In 2-column mode, we store widthPercent on the first block of each pair
  const handleTwoColumnResize = useCallback((block1Id: string, _block2Id: string, newPercent: number) => {
    // Just update the first block's widthPercent - the second block will calculate based on 100 - percent
    const block = blocks.find(b => b.id === block1Id);
    if (block) {
      onUpdateBlockWidth(block1Id, block.width || 'full', newPercent);
    }
  }, [onUpdateBlockWidth, blocks]);

  // Render 2-column layout with resizers between pairs
  const renderTwoColumnLayout = (pageBlocks: WorksheetBlock[]) => {
    const rows: JSX.Element[] = [];
    
    for (let i = 0; i < pageBlocks.length; i += 2) {
      const block1 = pageBlocks[i];
      const block2 = pageBlocks[i + 1];
      
      if (block2) {
        // Two blocks side by side with resizer
        const block1Percent = block1.widthPercent ?? 50;
        const block2Percent = 100 - block1Percent;
        
        rows.push(
          <div key={`row-${block1.id}`} className="flex items-stretch relative" style={{ minHeight: '40px' }}>
            <div
              className="overflow-visible relative"
              style={{
                width: `calc(${block1Percent}% - 12px)`,
                flexShrink: 0,
                zIndex: selectedBlockId === block1.id ? 50 : 1,
              }}
              data-block-id={block1.id}
              onMouseEnter={() => pendingInsertType && setInsertHoverId(block1.id)}
            >
              {pendingInsertType && insertHoverId === block1.id && (
                <button
                  type="button"
                  className="absolute left-0 right-0 h-6 flex items-center justify-center"
                  style={{ top: '-12px', zIndex: 9999 }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onInsertBefore?.(block1.id);
                  }}
                >
                  <div 
                    className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-full"
                    style={{ height: '4px', backgroundColor: '#2563eb', zIndex: 1 }}
                  />
                  <div 
                    className="relative flex items-center justify-center shadow-lg"
                    style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#2563eb', color: 'white', zIndex: 10 }}
                  >
                    <Plus className="w-4 h-4" />
                  </div>
                </button>
              )}
              <EditableBlock
                block={block1}
                isSelected={selectedBlockId === block1.id}
                isHovered={hoveredBlockId === block1.id}
                onSelect={() => onSelectBlock(block1.id)}
                onUpdate={(content) => onUpdateBlock(block1.id, content)}
                onUpdateMargin={(margin) => onUpdateBlockMargin(block1.id, margin)}
                onDelete={onDeleteBlock ? () => onDeleteBlock(block1.id) : undefined}
                onDuplicate={onDuplicateBlock ? () => onDuplicateBlock(block1.id) : undefined}
                onMoveUp={onMoveBlockUp ? () => onMoveBlockUp(block1.id) : undefined}
                onMoveDown={onMoveBlockDown ? () => onMoveBlockDown(block1.id) : undefined}
                globalFontSize={globalFontSize}
                activityNumber={activityNumbers[block1.id]}
                columnPosition="left"
                onOpenAI={onOpenAI}
              />
            </div>
            
            {/* Resizer */}
            <Resizer
              block1Id={block1.id}
              block2Id={block2.id}
              block1Percent={block1Percent}
              onResize={handleTwoColumnResize}
            />
            
            <div
              className="overflow-visible relative"
              style={{
                width: `calc(${block2Percent}% - 12px)`,
                flexShrink: 0,
                zIndex: selectedBlockId === block2.id ? 50 : 1,
              }}
              data-block-id={block2.id}
              onMouseEnter={() => pendingInsertType && setInsertHoverId(block2.id)}
            >
              {pendingInsertType && insertHoverId === block2.id && (
                <button
                  type="button"
                  className="absolute left-0 right-0 h-6 flex items-center justify-center"
                  style={{ top: '-12px', zIndex: 9999 }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onInsertBefore?.(block2.id);
                  }}
                >
                  <div 
                    className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-full"
                    style={{ height: '4px', backgroundColor: '#2563eb', zIndex: 1 }}
                  />
                  <div 
                    className="relative flex items-center justify-center shadow-lg"
                    style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#2563eb', color: 'white', zIndex: 10 }}
                  >
                    <Plus className="w-4 h-4" />
                  </div>
                </button>
              )}
              <EditableBlock
                block={block2}
                isSelected={selectedBlockId === block2.id}
                isHovered={hoveredBlockId === block2.id}
                onSelect={() => onSelectBlock(block2.id)}
                onUpdate={(content) => onUpdateBlock(block2.id, content)}
                onUpdateMargin={(margin) => onUpdateBlockMargin(block2.id, margin)}
                onDelete={onDeleteBlock ? () => onDeleteBlock(block2.id) : undefined}
                onDuplicate={onDuplicateBlock ? () => onDuplicateBlock(block2.id) : undefined}
                onMoveUp={onMoveBlockUp ? () => onMoveBlockUp(block2.id) : undefined}
                onMoveDown={onMoveBlockDown ? () => onMoveBlockDown(block2.id) : undefined}
                globalFontSize={globalFontSize}
                activityNumber={activityNumbers[block2.id]}
                columnPosition="right"
                onOpenAI={onOpenAI}
              />
            </div>
          </div>
        );
      } else {
        // Single block takes full width
        rows.push(
          <div key={block1.id} data-block-id={block1.id}>
            <EditableBlock
              block={block1}
              isSelected={selectedBlockId === block1.id}
              isHovered={hoveredBlockId === block1.id}
              onSelect={() => onSelectBlock(block1.id)}
              onUpdate={(content) => onUpdateBlock(block1.id, content)}
              onUpdateMargin={(margin) => onUpdateBlockMargin(block1.id, margin)}
              onDelete={onDeleteBlock ? () => onDeleteBlock(block1.id) : undefined}
              onDuplicate={onDuplicateBlock ? () => onDuplicateBlock(block1.id) : undefined}
              onMoveUp={onMoveBlockUp ? () => onMoveBlockUp(block1.id) : undefined}
              onMoveDown={onMoveBlockDown ? () => onMoveBlockDown(block1.id) : undefined}
              activityNumber={activityNumbers[block1.id]}
              globalFontSize={globalFontSize}
              onOpenAI={onOpenAI}
            />
          </div>
        );
      }
    }
    
    return rows;
  };

  return (
      <main 
        ref={canvasRef}
        className="flex-1 overflow-auto p-8 bg-slate-200 min-w-0 worksheet-center-area center-area print:p-0 print:bg-white print:overflow-visible"
        style={{ paddingTop: '100px' }}
        onClick={(e) => {
          // Deselect when clicking on the canvas background (not on a block)
        const target = e.target as HTMLElement;
        if (!target.closest('[data-block-id]') && !target.closest('[data-settings-overlay]') && !target.closest('.worksheet-text-toolbar') && !target.closest('[data-toolbar-for-block]') && !target.closest('[data-toolbar-element]')) {
          onSelectBlock(null);
        }
      }}
    >
      <div 
        ref={containerRef} 
        className="ml-auto mr-8 worksheet-pages-row pages-row" 
        style={{ width: A4_WIDTH_PX, maxWidth: '100%' }}
        onClick={(e) => {
          // Also handle clicks on the pages container
          const target = e.target as HTMLElement;
          if (!target.closest('[data-block-id]') && !target.closest('[data-settings-overlay]') && !target.closest('.worksheet-text-toolbar') && !target.closest('[data-toolbar-for-block]') && !target.closest('[data-toolbar-element]')) {
            onSelectBlock(null);
          }
        }}
      >
        {blocks.length === 0 ? (
          /* Empty state - single A4 page */
          <div
            className="bg-white shadow-lg rounded-sm relative worksheet-a4-page a4-page print:shadow-none print:rounded-none"
            style={{
              minHeight: A4_HEIGHT_PX,
              padding: PADDING_PX,
            }}
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('[data-settings-overlay]') || target.closest('.worksheet-text-toolbar') || target.closest('[data-toolbar-for-block]') || target.closest('[data-toolbar-element]')) {
                return;
              }
              onSelectBlock(null);
            }}
          >
            <div className="h-full flex flex-col items-center justify-center text-center py-20">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                Začněte tvořit
              </h3>
              <p className="text-slate-500 max-w-sm mb-6">
                Popište AI asistentovi, jaký pracovní list chcete vytvořit, nebo přidejte bloky ručně.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSwitchToAI();
                  }}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Použít AI
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddBlock('heading');
                  }}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Přidat blok
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Render pages with blocks */
          <SortableContext
            items={blocks.map(b => b.id)}
            strategy={verticalListSortingStrategy}
          >
            {pagesData.map((page, pageIndex) => (
              <div key={`page-${page.pageNumber}`}>
                {/* A4 Page */}
                <div
                  className="bg-white shadow-lg rounded-sm relative mb-0 worksheet-a4-page a4-page print:shadow-none print:rounded-none"
                  style={{
                    minHeight: A4_HEIGHT_PX,
                    padding: PADDING_PX,
                  }}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    // Don't deselect if clicking on settings overlay or toolbar
                    if (target.closest('[data-settings-overlay]') || target.closest('.worksheet-text-toolbar') || target.closest('[data-toolbar-for-block]') || target.closest('[data-toolbar-element]')) {
                      return;
                    }
                    onSelectBlock(null);
                  }}
                >
                  {/* Blocks - with optional 2-column layout */}
                  <div 
                    className="pl-6"
                    onClick={(e) => {
                      // If click was directly on this wrapper (not on a block), deselect
                      if (e.target === e.currentTarget) {
                        const target = e.target as HTMLElement;
                        // Don't deselect if clicking on settings overlay or toolbar
                        if (target.closest('[data-settings-overlay]') || target.closest('.worksheet-text-toolbar') || target.closest('[data-toolbar-for-block]') || target.closest('[data-toolbar-element]')) {
                          return;
                        }
                        onSelectBlock(null);
                      }
                    }}
                  >
                    {columns === 2 ? (
                      // 2-column layout with resizers between pairs
                      <div className="flex flex-col" style={{ gap: '8px' }}>
                        {renderTwoColumnLayout(page.blocks)}
                        
                        {/* Quick access bar for adding blocks - only on the last page */}
                        {pageIndex === pagesData.length - 1 && (
                          <div className="mt-8">
                            <QuickAddBar 
                              onAddBlock={onAddBlock}
                              onSwitchToAI={onSwitchToAI}
                              onOpenAddPanel={onOpenAddPanel}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      // Standard layout with half-width support
                      <div className="flex flex-col" style={{ gap: '8px' }}>
                        {renderBlocksWithLayout(page.blocks)}
                        
                        {/* Quick access bar for adding blocks - only on the last page */}
                        {pageIndex === pagesData.length - 1 && (
                          <div className="mt-8">
                            <QuickAddBar 
                              onAddBlock={onAddBlock}
                              onSwitchToAI={onSwitchToAI}
                              onOpenAddPanel={onOpenAddPanel}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Page break between pages */}
                {pageIndex < pagesData.length - 1 && (
                  <PageBreak pageNumber={page.pageNumber} />
                )}
              </div>
            ))}
          </SortableContext>
        )}
      </div>
    </main>
  );
}
