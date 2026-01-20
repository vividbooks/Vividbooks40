/**
 * Info Slide Editor
 * 
 * Block-based editor for information/content slides.
 * Supports multiple layout types with resizable blocks.
 * Responsive: on mobile, blocks stack vertically.
 */

import React, { useState, useCallback } from 'react';
import { Palette, Layout, Scissors, Plus } from 'lucide-react';
import {
  InfoSlide, 
  SlideLayout, 
  SlideLayoutType, 
  SlideBlock,
  createSlideLayout,
  BackgroundSettings,
  getTemplateById,
  SlideTemplate,
} from '../../../types/quiz';
import { SlideBlockEditor } from './SlideBlockEditor';
import { BlockResizer } from './BlockResizer';
import { LayoutSelector } from './LayoutSelector';
import { BackgroundPicker } from './BackgroundPicker';
import { getContrastColor } from '../../../utils/color-utils';

interface InfoSlideEditorProps {
  slide: InfoSlide;
  onUpdate: (id: string, updates: Partial<InfoSlide>) => void;
  onSlideClick?: () => void;
  selectedBlockIndex: number | null;
  onBlockSelect: (index: number | null) => void;
  onOpenBlockSettings?: (blockIndex: number) => void;
  onTextEditStart?: (blockIndex: number) => void;
  onTextEditEnd?: () => void;
}

export function InfoSlideEditor({ 
  slide, 
  onUpdate, 
  onSlideClick, 
  selectedBlockIndex,
  onBlockSelect,
  onOpenBlockSettings,
  onTextEditStart, 
  onTextEditEnd 
}: InfoSlideEditorProps) {
  const [showLayoutPanel, setShowLayoutPanel] = useState(false);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);

  const isEditing = selectedBlockIndex !== null;

  // Get or create layout
  const layout = slide.layout || createSlideLayout('title-content');

  // Check if layout can be split into more columns
  const canSplit = ['single', 'title-content', '2cols', 'title-2cols'].includes(layout.type);
  
  // Check if columns can be split vertically (horizontally split)
  // Note: title layouts (title-2cols) don't support vertical split - limited vertical space
  const canVerticalSplit = ['2cols', 'left-large-right-split', 'right-large-left-split'].includes(layout.type);

  // Handle layout change - preserve existing block contents
  const handleLayoutChange = useCallback((layoutType: SlideLayoutType) => {
    const newLayout = createSlideLayout(layoutType);
    
    // Preserve existing block contents
    if (layout.blocks) {
      const existingBlocks = layout.blocks.filter(b => b.content || (b.gallery && b.gallery.length > 0));
      const slideBgColor = slide.slideBackground?.type === 'color' ? slide.slideBackground.color : '#ffffff';
      const defaultContrastColor = getContrastColor(slideBgColor || '#ffffff');
      
      // Copy content from existing blocks to new blocks
      for (let i = 0; i < Math.min(existingBlocks.length, newLayout.blocks.length); i++) {
        newLayout.blocks[i] = {
          ...newLayout.blocks[i],
          content: existingBlocks[i].content,
          type: existingBlocks[i].type,
          gallery: existingBlocks[i].gallery,
          galleryIndex: existingBlocks[i].galleryIndex,
          galleryNavType: existingBlocks[i].galleryNavType,
          imageScale: existingBlocks[i].imageScale,
          imagePositionX: existingBlocks[i].imagePositionX,
          imagePositionY: existingBlocks[i].imagePositionY,
          imageCaption: existingBlocks[i].imageCaption,
          imageLink: existingBlocks[i].imageLink,
          imageFit: existingBlocks[i].imageFit,
          background: existingBlocks[i].background,
          textAlign: existingBlocks[i].textAlign,
          fontSize: existingBlocks[i].fontSize,
          fontWeight: existingBlocks[i].fontWeight,
          textColor: existingBlocks[i].textColor || defaultContrastColor,
        };
      }

      // Fill remaining blocks with default contrast color
      for (let i = existingBlocks.length; i < newLayout.blocks.length; i++) {
        newLayout.blocks[i] = {
          ...newLayout.blocks[i],
          textColor: defaultContrastColor,
        };
      }
    }
    
    onUpdate(slide.id, { layout: newLayout });
    setShowLayoutPanel(false);
    onBlockSelect(null);
  }, [layout.blocks, slide.id, slide.slideBackground, onUpdate, onBlockSelect]);

  // Handle splitting layout into more columns (plus action)
  const handleSplitLayout = useCallback(() => {
    const splitMap: Record<string, SlideLayoutType> = {
      'single': '2cols',
      'title-content': 'title-2cols',
      '2cols': '3cols',
      'title-2cols': 'title-3cols'
    };
    
    const nextType = splitMap[layout.type];
    if (nextType) {
      handleLayoutChange(nextType);
    }
  }, [layout.type, handleLayoutChange]);

  // Handle vertical split of a column (creating a split layout)
  const handleVerticalSplit = useCallback((side: 'left' | 'right') => {
    if (layout.type === '2cols' || layout.type === 'title-2cols') {
      const nextType = side === 'left' ? 'right-large-left-split' : 'left-large-right-split';
      handleLayoutChange(nextType);
    } else if (layout.type === 'left-large-right-split' && side === 'left') {
      handleLayoutChange('grid-2x2');
    } else if (layout.type === 'right-large-left-split' && side === 'right') {
      handleLayoutChange('grid-2x2');
    }
  }, [layout.type, handleLayoutChange]);

  // Handle block deletion - changes layout by removing a block
  const handleBlockDelete = useCallback((blockIndex: number) => {
    // Determine new layout type based on current type and remaining blocks
    let newLayoutType: SlideLayoutType;
    const currentType = layout.type;
    const remainingCount = layout.blocks.length - 1;
    
    // Custom mapping for grid-2x2 to split layouts
    if (currentType === 'grid-2x2') {
      if (blockIndex === 0 || blockIndex === 2) {
        newLayoutType = 'left-large-right-split';
      } else {
        newLayoutType = 'right-large-left-split';
      }

      const newLayout = createSlideLayout(newLayoutType);
      
      // Explicit block mapping for grid-2x2 deletion
      if (blockIndex === 0) { // Delete Top Left
        newLayout.blocks[0] = { ...newLayout.blocks[0], ...layout.blocks[2] }; // Bottom Left -> Left Large
        newLayout.blocks[1] = { ...newLayout.blocks[1], ...layout.blocks[1] }; // Top Right -> Top Right
        newLayout.blocks[2] = { ...newLayout.blocks[2], ...layout.blocks[3] }; // Bottom Right -> Bottom Right
      } else if (blockIndex === 2) { // Delete Bottom Left
        newLayout.blocks[0] = { ...newLayout.blocks[0], ...layout.blocks[0] }; // Top Left -> Left Large
        newLayout.blocks[1] = { ...newLayout.blocks[1], ...layout.blocks[1] }; // Top Right -> Top Right
        newLayout.blocks[2] = { ...newLayout.blocks[2], ...layout.blocks[3] }; // Bottom Right -> Bottom Right
      } else if (blockIndex === 1) { // Delete Top Right
        newLayout.blocks[0] = { ...newLayout.blocks[0], ...layout.blocks[0] }; // Top Left -> Top Left
        newLayout.blocks[1] = { ...newLayout.blocks[1], ...layout.blocks[2] }; // Bottom Left -> Bottom Left
        newLayout.blocks[2] = { ...newLayout.blocks[2], ...layout.blocks[3] }; // Bottom Right -> Right Large
      } else if (blockIndex === 3) { // Delete Bottom Right
        newLayout.blocks[0] = { ...newLayout.blocks[0], ...layout.blocks[0] }; // Top Left -> Top Left
        newLayout.blocks[1] = { ...newLayout.blocks[1], ...layout.blocks[2] }; // Bottom Left -> Bottom Left
        newLayout.blocks[2] = { ...newLayout.blocks[2], ...layout.blocks[1] }; // Top Right -> Right Large
      }
      
      // Ensure IDs are preserved correctly for the new structure
      newLayout.blocks.forEach((b, i) => {
        b.id = createSlideLayout(newLayoutType).blocks[i].id;
      });

      onUpdate(slide.id, { layout: newLayout });
      onBlockSelect(null);
      return;
    }

    // Map current layout to next one down
    if (currentType === '3cols') {
      newLayoutType = '2cols';
    } else if (currentType === '2cols') {
      newLayoutType = 'single';
    } else if (currentType === 'title-3cols') {
      newLayoutType = 'title-2cols';
    } else if (currentType === 'title-2cols') {
      newLayoutType = 'title-content';
    } else if (currentType === 'title-content' && blockIndex === 1) {
      newLayoutType = 'single';
    } else if (currentType === 'left-large-right-split' || currentType === 'right-large-left-split') {
      newLayoutType = '2cols';
    } else {
      // Fallback
      if (remainingCount <= 1) {
        newLayoutType = 'single';
      } else if (remainingCount === 2) {
        newLayoutType = '2cols';
      } else {
        newLayoutType = '3cols';
      }
    }
    
    // Get remaining blocks (preserve their order as much as possible)
    const blocksWithContent = layout.blocks.filter((b, i) => i !== blockIndex);
    
    // Create new layout and preserve contents
    const newLayout = createSlideLayout(newLayoutType);
    
    // Copy content from remaining blocks to new blocks
    for (let i = 0; i < Math.min(blocksWithContent.length, newLayout.blocks.length); i++) {
      newLayout.blocks[i] = {
        ...newLayout.blocks[i],
        ...blocksWithContent[i],
        id: newLayout.blocks[i].id, // Keep new block ID for consistency with layout structure
      };
    }
    
    onUpdate(slide.id, { layout: newLayout });
    onBlockSelect(null);
  }, [layout, onUpdate, slide.id, onBlockSelect]);

  // Get template if set
  const template: SlideTemplate | undefined = slide.templateId ? getTemplateById(slide.templateId) : undefined;

  // Get block color based on template
  const getBlockColor = useCallback((blockIndex: number): string | undefined => {
    if (!template?.blockColors) return undefined;
    return template.blockColors[blockIndex % template.blockColors.length];
  }, [template]);

  // Get font family from template
  const getFontFamily = useCallback((): string => {
    if (!template?.font) return 'inherit';
    // Add quotes for font names with spaces and fallback
    const fontName = template.font;
    if (fontName.includes(' ')) {
      return `"${fontName}", sans-serif`;
    }
    return `${fontName}, sans-serif`;
  }, [template]);

  // Get gap between blocks
  const getBlockGap = useCallback((): number => {
    if (slide.blockGap !== undefined) return slide.blockGap;
    if (template?.defaultGap !== undefined) return template.defaultGap;
    return 8; // Default gap
  }, [slide.blockGap, template]);

  // Get border radius for blocks
  const getBlockRadius = useCallback((): number => {
    if (slide.blockRadius !== undefined) return slide.blockRadius;
    if (template?.defaultRadius !== undefined) return template.defaultRadius;
    return 8; // Default radius
  }, [slide.blockRadius, template]);

  // Handle block update
  const handleBlockUpdate = useCallback((blockIndex: number, updates: Partial<SlideBlock>) => {
    const newBlocks = [...layout.blocks];
    newBlocks[blockIndex] = { ...newBlocks[blockIndex], ...updates };
    onUpdate(slide.id, {
      layout: { ...layout, blocks: newBlocks }
    });
  }, [layout, onUpdate, slide.id]);

  // Helper to render block editor with all props
  const renderBlockEditor = (blockIndex: number, placeholder: string) => {
    const block = layout.blocks?.[blockIndex];
    if (!block) {
      return (
        <div className="flex items-center justify-center h-full text-slate-400 text-sm">
          Blok není definován
        </div>
      );
    }
    return (
      <SlideBlockEditor
        block={block}
        onUpdate={(updates) => handleBlockUpdate(blockIndex, updates)}
        onDelete={() => handleBlockDelete(blockIndex)}
        isSelected={selectedBlockIndex === blockIndex}
        onSelect={() => {
          onBlockSelect(blockIndex);
        }}
        onSettingsClick={() => {
          onBlockSelect(blockIndex);
          onOpenBlockSettings?.(blockIndex);
        }}
        onTextEditStart={() => {
          onTextEditStart?.(blockIndex);
          onBlockSelect(blockIndex);
        }}
        onTextEditEnd={onTextEditEnd}
        placeholder={placeholder}
        templateColor={getBlockColor(blockIndex)}
        borderRadius={getBlockRadius()}
      />
    );
  };

  // Handle title height change
  const handleTitleHeightChange = useCallback((newHeight: number) => {
    onUpdate(slide.id, {
      layout: { ...layout, titleHeight: newHeight }
    });
  }, [layout, onUpdate, slide.id]);

  // Handle column ratio change
  const handleColumnRatioChange = useCallback((index: number, newValue: number) => {
    const newRatios = [...(layout.columnRatios || [50, 50])];
    const oldValue = newRatios[index];
    const diff = newValue - oldValue;
    
    // Adjust adjacent column
    if (index < newRatios.length - 1) {
      newRatios[index] = newValue;
      newRatios[index + 1] = newRatios[index + 1] - diff;
    }
    
    onUpdate(slide.id, {
      layout: { ...layout, columnRatios: newRatios }
    });
  }, [layout, onUpdate, slide.id]);

  // Handle split ratio change (for split layouts)
  const handleSplitRatioChange = useCallback((newValue: number) => {
    onUpdate(slide.id, {
      layout: { ...layout, splitRatio: newValue }
    });
  }, [layout, onUpdate, slide.id]);

  // Handle swap blocks
  const handleSwapBlocks = useCallback((idx1: number, idx2: number) => {
    const newBlocks = [...layout.blocks];
    const temp = newBlocks[idx1];
    newBlocks[idx1] = newBlocks[idx2];
    newBlocks[idx2] = temp;
    
    onUpdate(slide.id, {
      layout: { ...layout, blocks: newBlocks }
    });
  }, [layout, onUpdate, slide.id]);

  // Handle slide background change
  const handleSlideBackgroundChange = (bg: BackgroundSettings | undefined) => {
    onUpdate(slide.id, { slideBackground: bg });
  };

  // Get slide background style
  const getSlideBackgroundStyle = (): React.CSSProperties => {
    if (!slide.slideBackground) return { backgroundColor: '#ffffff' };
    
    const bg = slide.slideBackground;
    const style: React.CSSProperties = {};
    
    if (bg.type === 'color' && bg.color) {
      style.backgroundColor = bg.color === 'transparent' ? 'transparent' : bg.color;
    } else if (bg.type === 'image' && bg.imageUrl) {
      style.backgroundImage = `url(${bg.imageUrl})`;
      style.backgroundSize = 'cover';
      style.backgroundPosition = 'center';
    }
    
    return style;
  };

  // Render layout based on type
  const renderLayout = () => {
    const titleHeight = layout.titleHeight || 15;
    const columnRatios = layout.columnRatios || [50, 50];
    const splitRatio = layout.splitRatio || 50;
    const gap = getBlockGap();

    // Helper to calculate flex-basis with gap compensation
    const calcWidth = (percent: number, numGaps: number = 1) => {
      if (gap === 0) return `${percent}%`;
      return `calc(${percent}% - ${(gap * numGaps) / (numGaps + 1)}px)`;
    };

    switch (layout.type) {
      case 'single':
        return (
          <div className="h-full flex flex-col">
            {/* Single full-page block */}
            <div style={{ flex: 1, minHeight: 0 }}>
              {renderBlockEditor(0, "Obsah...")}
            </div>
          </div>
        );

      case 'title-content':
        return (
          <div className="h-full flex flex-col relative overflow-visible" style={{ gap }}>
            {/* Title block */}
            <div className="relative z-0 overflow-visible" style={{ flex: `0 0 ${titleHeight}%`, minHeight: 60 }}>
              {renderBlockEditor(0, "Nadpis...")}
            </div>
            
            {/* Title-Content resizer */}
            {!isEditing && (
              <BlockResizer
                direction="vertical"
                value={titleHeight}
                onChange={handleTitleHeightChange}
                onSwap={() => handleSwapBlocks(0, 1)}
                min={10}
                max={40}
                snapTo={[15, 20, 25]}
              />
            )}
            
            {/* Content block */}
            <div className="relative z-0 overflow-visible" style={{ flex: 1, minHeight: 0 }}>
              {renderBlockEditor(1, "Obsah...")}
            </div>
          </div>
        );

      case 'title-2cols':
        return (
          <div className="h-full flex flex-col relative overflow-visible" style={{ gap }}>
            {/* Title block */}
            <div className="relative z-0 overflow-visible" style={{ flex: `0 0 ${titleHeight}%`, minHeight: 60 }}>
              {renderBlockEditor(0, "Nadpis...")}
            </div>
            
            {!isEditing && (
              <BlockResizer
                direction="vertical"
                value={titleHeight}
                onChange={handleTitleHeightChange}
                onSwap={() => handleSwapBlocks(0, 1)}
                min={10}
                max={40}
              />
            )}
            
            {/* Two columns */}
            <div className="flex relative z-0 overflow-visible" style={{ flex: 1, minHeight: 0, gap }}>
              <div className="relative z-0 overflow-visible" style={{ flex: `0 0 calc(${columnRatios[0]}% - ${gap / 2}px)`, minWidth: 0 }}>
                {renderBlockEditor(1, "Levý sloupec...")}
              </div>
              
              {!isEditing && (
                <BlockResizer
                  direction="horizontal"
                  value={columnRatios[0]}
                  onChange={(v) => handleColumnRatioChange(0, v)}
                  onSwap={() => handleSwapBlocks(1, 2)}
                  min={25}
                  max={75}
                />
              )}
              
              <div className="relative z-0 overflow-visible" style={{ flex: 1, minWidth: 0 }}>
                {renderBlockEditor(2, "Pravý sloupec...")}
              </div>
            </div>
          </div>
        );

      case 'title-3cols':
        return (
          <div className="h-full flex flex-col relative overflow-visible" style={{ gap }}>
            {/* Title block */}
            <div className="relative z-0 overflow-visible" style={{ flex: `0 0 ${titleHeight}%`, minHeight: 60 }}>
              {renderBlockEditor(0, "Nadpis...")}
            </div>
            
            {!isEditing && (
              <BlockResizer
                direction="vertical"
                value={titleHeight}
                onChange={handleTitleHeightChange}
                onSwap={() => handleSwapBlocks(0, 1)}
                min={10}
                max={40}
              />
            )}
            
            {/* Three columns */}
            <div className="flex relative z-0 overflow-visible" style={{ flex: 1, minHeight: 0, gap }}>
              <div className="relative z-0 overflow-visible" style={{ flex: `0 0 calc(${columnRatios[0]}% - ${gap * 2 / 3}px)`, minWidth: 0 }}>
                {renderBlockEditor(1, "Sloupec 1...")}
              </div>
              
              {!isEditing && (
                <BlockResizer
                  direction="horizontal"
                  value={columnRatios[0]}
                  onChange={(v) => handleColumnRatioChange(0, v)}
                  onSwap={() => handleSwapBlocks(1, 2)}
                  min={20}
                  max={50}
                />
              )}
              
              <div className="relative z-0 overflow-visible" style={{ flex: `0 0 calc(${columnRatios[1]}% - ${gap * 2 / 3}px)`, minWidth: 0 }}>
                {renderBlockEditor(2, "Sloupec 2...")}
              </div>
              
              {!isEditing && (
                <BlockResizer
                  direction="horizontal"
                  value={columnRatios[0] + columnRatios[1]}
                  onChange={(v) => handleColumnRatioChange(1, v - columnRatios[0])}
                  onSwap={() => handleSwapBlocks(2, 3)}
                  min={50}
                  max={80}
                />
              )}
              
              <div className="relative z-0 overflow-visible" style={{ flex: 1, minWidth: 0 }}>
                {renderBlockEditor(3, "Sloupec 3...")}
              </div>
            </div>
          </div>
        );

      case '2cols':
        return (
          <div className="h-full flex relative z-0 overflow-visible" style={{ gap }}>
            <div className="relative z-0 overflow-visible" style={{ flex: `0 0 calc(${columnRatios[0]}% - ${gap / 2}px)`, minWidth: 0 }}>
              {renderBlockEditor(0, "Levý sloupec...")}
            </div>
            
            {!isEditing && (
              <BlockResizer
                direction="horizontal"
                value={columnRatios[0]}
                onChange={(v) => handleColumnRatioChange(0, v)}
                onSwap={() => handleSwapBlocks(0, 1)}
                min={25}
                max={75}
              />
            )}
            
            <div className="relative z-0 overflow-visible" style={{ flex: 1, minWidth: 0 }}>
              {renderBlockEditor(1, "Pravý sloupec...")}
            </div>
          </div>
        );

      case '3cols':
        return (
          <div className="h-full flex relative z-0 overflow-visible" style={{ gap }}>
            <div className="relative z-0 overflow-visible" style={{ flex: `0 0 calc(${columnRatios[0]}% - ${gap * 2 / 3}px)`, minWidth: 0 }}>
              {renderBlockEditor(0, "Sloupec 1...")}
            </div>
            
            {!isEditing && (
              <BlockResizer
                direction="horizontal"
                value={columnRatios[0]}
                onChange={(v) => handleColumnRatioChange(0, v)}
                onSwap={() => handleSwapBlocks(0, 1)}
                min={20}
                max={50}
              />
            )}
            
            <div className="relative z-0 overflow-visible" style={{ flex: `0 0 calc(${columnRatios[1]}% - ${gap * 2 / 3}px)`, minWidth: 0 }}>
              {renderBlockEditor(1, "Sloupec 2...")}
            </div>
            
            {!isEditing && (
              <BlockResizer
                direction="horizontal"
                value={columnRatios[0] + columnRatios[1]}
                onChange={(v) => handleColumnRatioChange(1, v - columnRatios[0])}
                onSwap={() => handleSwapBlocks(1, 2)}
                min={50}
                max={80}
              />
            )}
            
            <div className="relative z-0 overflow-visible" style={{ flex: 1, minWidth: 0 }}>
              {renderBlockEditor(2, "Sloupec 3...")}
            </div>
          </div>
        );

      case 'left-large-right-split':
        return (
          <div className="h-full flex relative z-0 overflow-visible" style={{ gap }}>
            {/* Left large column */}
            <div className="relative z-0 overflow-visible" style={{ flex: `0 0 calc(${columnRatios[0]}% - ${gap / 2}px)`, minWidth: 0 }}>
              {renderBlockEditor(0, "Hlavní obsah...")}
            </div>
            
            {!isEditing && (
              <BlockResizer
                direction="horizontal"
                value={columnRatios[0]}
                onChange={(v) => handleColumnRatioChange(0, v)}
                onSwap={() => handleSwapBlocks(0, 1)}
                min={40}
                max={75}
              />
            )}
            
            {/* Right split column */}
            <div style={{ flex: 1, minWidth: 0, gap }} className="flex flex-col relative z-0 overflow-visible">
              <div className="relative z-0 overflow-visible" style={{ flex: `0 0 calc(${splitRatio}% - ${gap / 2}px)`, minHeight: 0 }}>
                {renderBlockEditor(1, "Horní...")}
              </div>
              
              {!isEditing && (
                <BlockResizer
                  direction="vertical"
                  value={splitRatio}
                  onChange={handleSplitRatioChange}
                  onSwap={() => handleSwapBlocks(1, 2)}
                  min={25}
                  max={75}
                />
              )}
              
              <div className="relative z-0 overflow-visible" style={{ flex: 1, minHeight: 0 }}>
                {renderBlockEditor(2, "Dolní...")}
              </div>
            </div>
          </div>
        );

      case 'right-large-left-split':
        return (
          <div className="h-full flex relative z-0 overflow-visible" style={{ gap }}>
            {/* Left split column */}
            <div style={{ flex: `0 0 calc(${columnRatios[0]}% - ${gap / 2}px)`, minWidth: 0, gap }} className="flex flex-col relative z-0 overflow-visible">
              <div className="relative z-0 overflow-visible" style={{ flex: `0 0 calc(${splitRatio}% - ${gap / 2}px)`, minHeight: 0 }}>
                {renderBlockEditor(0, "Horní...")}
              </div>
              
              {!isEditing && (
                <BlockResizer
                  direction="vertical"
                  value={splitRatio}
                  onChange={handleSplitRatioChange}
                  onSwap={() => handleSwapBlocks(0, 1)}
                  min={25}
                  max={75}
                />
              )}
              
              <div className="relative z-0 overflow-visible" style={{ flex: 1, minHeight: 0 }}>
                {renderBlockEditor(1, "Dolní...")}
              </div>
            </div>
            
            {!isEditing && (
              <BlockResizer
                direction="horizontal"
                value={columnRatios[0]}
                onChange={(v) => handleColumnRatioChange(0, v)}
                onSwap={() => handleSwapBlocks(1, 2)}
                min={25}
                max={60}
              />
            )}
            
            {/* Right large column */}
            <div className="relative z-0 overflow-visible" style={{ flex: 1, minWidth: 0 }}>
              {renderBlockEditor(2, "Hlavní obsah...")}
            </div>
          </div>
        );

      case 'grid-2x2':
        return (
          <div className="h-full flex relative z-0 overflow-visible" style={{ gap }}>
            {/* Left column split */}
            <div style={{ flex: `0 0 calc(${columnRatios[0]}% - ${gap / 2}px)`, minWidth: 0, gap }} className="flex flex-col relative z-0 overflow-visible">
              <div className="relative z-0 overflow-visible" style={{ flex: `0 0 calc(${splitRatio}% - ${gap / 2}px)`, minHeight: 0 }}>
                {renderBlockEditor(0, "Vlevo nahoře...")}
              </div>
              {!isEditing && (
                <BlockResizer
                  direction="vertical"
                  value={splitRatio}
                  onChange={handleSplitRatioChange}
                  onSwap={() => handleSwapBlocks(0, 2)}
                  min={20}
                  max={80}
                />
              )}
              <div className="relative z-0 overflow-visible" style={{ flex: 1, minHeight: 0 }}>
                {renderBlockEditor(2, "Vlevo dole...")}
              </div>
            </div>
            
            {!isEditing && (
              <BlockResizer
                direction="horizontal"
                value={columnRatios[0]}
                onChange={(v) => handleColumnRatioChange(0, v)}
                onSwap={() => {
                  handleSwapBlocks(0, 1);
                  handleSwapBlocks(2, 3);
                }}
                min={20}
                max={80}
              />
            )}
            
            {/* Right column split */}
            <div style={{ flex: 1, minWidth: 0, gap }} className="flex flex-col relative z-0 overflow-visible">
              <div className="relative z-0 overflow-visible" style={{ flex: `0 0 calc(${splitRatio}% - ${gap / 2}px)`, minHeight: 0 }}>
                {renderBlockEditor(1, "Vpravo nahoře...")}
              </div>
              {!isEditing && (
                <BlockResizer
                  direction="vertical"
                  value={splitRatio}
                  onChange={handleSplitRatioChange}
                  onSwap={() => handleSwapBlocks(1, 3)}
                  min={20}
                  max={80}
                />
              )}
              <div className="relative z-0 overflow-visible" style={{ flex: 1, minHeight: 0 }}>
                {renderBlockEditor(3, "Vpravo dole...")}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // If no layout selected, show layout selector
  if (showLayoutPanel) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-4">
          <h2 className="text-white font-bold text-lg">Vyberte rozložení</h2>
          <p className="text-white/70 text-sm">Zvolte jak bude slide strukturován</p>
        </div>
        
        <div className="p-6">
          <LayoutSelector
            selectedLayout={layout.type}
            onSelectLayout={handleLayoutChange}
          />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="bg-white rounded-lg shadow-sm border border-slate-200 cursor-pointer relative overflow-visible"
      style={{ 
        aspectRatio: '4/3', 
        containerType: 'inline-size',
        ...getSlideBackgroundStyle(),
        fontFamily: getFontFamily(),
        color: getContrastColor(
          slide.slideBackground?.type === 'color' 
            ? (slide.slideBackground.color || '#ffffff') 
            : '#ffffff'
        ),
      }}
      onClick={() => {
        onBlockSelect(null);
        onSlideClick?.();
      }}
    >
      {/* Main content area - padding depends on gap setting */}
      <div 
        className="h-full relative z-0 overflow-visible"
        style={{ padding: getBlockGap() > 0 ? getBlockGap() : 0 }}
        onClick={(e) => {
          e.stopPropagation();
          onBlockSelect(null);
          onSlideClick?.();
        }}
      >
        {renderLayout()}
      </div>

      {/* Split layout (Plus) button on right edge */}
      {!isEditing && canSplit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleSplitLayout();
          }}
          className="absolute pointer-events-auto w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow flex items-center justify-center transition-all hover:scale-110"
          title="Přidat sloupec"
          style={{
            backgroundColor: 'rgb(59, 130, 246)',
            border: '2px solid white',
            right: '0',
            top: layout.type.startsWith('title-') 
              ? `${(layout.titleHeight || 15) + (100 - (layout.titleHeight || 15)) / 2}%` 
              : '50%',
            transform: 'translate(50%, -50%)',
            zIndex: 2000000,
          }}
        >
          <Plus className="w-5 h-5" />
        </button>
      )}

      {/* Vertical split (Plus) buttons at the bottom edge */}
      {!isEditing && canVerticalSplit && (
        <>
          {/* Left column split button */}
          {(layout.type === '2cols' || layout.type === 'title-2cols' || layout.type === 'left-large-right-split') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleVerticalSplit('left');
              }}
              className="absolute pointer-events-auto w-12 h-7 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow flex items-center justify-center transition-all hover:scale-110"
              title="Rozdělit sloupec horizontálně"
              style={{
                backgroundColor: 'rgb(59, 130, 246)',
                border: '2px solid white',
                bottom: '0',
                left: `${(layout.columnRatios || [50, 50])[0] / 2}%`,
                transform: 'translate(-50%, 50%)',
                zIndex: 2000000,
              }}
            >
              <Plus className="w-5 h-5" />
            </button>
          )}

          {/* Right column split button */}
          {(layout.type === '2cols' || layout.type === 'title-2cols' || layout.type === 'right-large-left-split') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleVerticalSplit('right');
              }}
              className="absolute pointer-events-auto w-12 h-7 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow flex items-center justify-center transition-all hover:scale-110"
              title="Rozdělit sloupec horizontálně"
              style={{
                backgroundColor: 'rgb(59, 130, 246)',
                border: '2px solid white',
                bottom: '0',
                left: `${(layout.columnRatios || [50, 50])[0] + (100 - (layout.columnRatios || [50, 50])[0]) / 2}%`,
                transform: 'translate(-50%, 50%)',
                zIndex: 2000000,
              }}
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </>
      )}
  </div>
);
}

export default InfoSlideEditor;
