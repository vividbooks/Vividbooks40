/**
 * Info Slide Editor
 * 
 * Block-based editor for information/content slides.
 * Supports multiple layout types with resizable blocks.
 * Responsive: on mobile, blocks stack vertically.
 */

import React, { useState, useCallback } from 'react';
import { Palette, Layout } from 'lucide-react';
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

interface InfoSlideEditorProps {
  slide: InfoSlide;
  onUpdate: (id: string, updates: Partial<InfoSlide>) => void;
  onSlideClick?: () => void;
  onBlockSettingsClick?: (blockIndex: number) => void;
  onTextEditStart?: (blockIndex: number) => void;
  onTextEditEnd?: () => void;
}

export function InfoSlideEditor({ slide, onUpdate, onSlideClick, onBlockSettingsClick, onTextEditStart, onTextEditEnd }: InfoSlideEditorProps) {
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [showLayoutPanel, setShowLayoutPanel] = useState(!slide.layout);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);

  // Get or create layout
  const layout = slide.layout || createSlideLayout('title-content');

  // Get template if set
  const template: SlideTemplate | undefined = slide.templateId ? getTemplateById(slide.templateId) : undefined;

  // Get block color based on template
  const getBlockColor = (blockIndex: number): string | undefined => {
    if (!template?.blockColors) return undefined;
    return template.blockColors[blockIndex % template.blockColors.length];
  };

  // Get font family from template
  const getFontFamily = (): string => {
    if (!template?.font) return 'inherit';
    // Add quotes for font names with spaces and fallback
    const fontName = template.font;
    if (fontName.includes(' ')) {
      return `"${fontName}", sans-serif`;
    }
    return `${fontName}, sans-serif`;
  };

  // Get gap between blocks
  const getBlockGap = (): number => {
    if (slide.blockGap !== undefined) return slide.blockGap;
    if (template?.defaultGap !== undefined) return template.defaultGap;
    return 8; // Default gap
  };

  // Get border radius for blocks
  const getBlockRadius = (): number => {
    if (slide.blockRadius !== undefined) return slide.blockRadius;
    if (template?.defaultRadius !== undefined) return template.defaultRadius;
    return 8; // Default radius
  };

  // Handle layout change - preserve existing block contents
  const handleLayoutChange = (layoutType: SlideLayoutType) => {
    const newLayout = createSlideLayout(layoutType);
    
    // Preserve existing block contents
    if (layout.blocks) {
      const existingBlocks = layout.blocks.filter(b => b.content || (b.gallery && b.gallery.length > 0));
      
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
        };
      }
    }
    
    onUpdate(slide.id, { layout: newLayout });
    setShowLayoutPanel(false);
    setSelectedBlockIndex(null);
  };
  
  // Handle block deletion - changes layout by removing a block
  const handleBlockDelete = useCallback((blockIndex: number) => {
    // Get current blocks with content
    const blocksWithContent = layout.blocks.filter((b, i) => i !== blockIndex);
    
    // Determine new layout type based on remaining blocks
    let newLayoutType: SlideLayoutType;
    const remainingCount = blocksWithContent.length;
    
    if (remainingCount <= 1) {
      newLayoutType = 'title-content';
    } else if (remainingCount === 2) {
      newLayoutType = '2cols';
    } else {
      newLayoutType = '3cols';
    }
    
    // Create new layout and preserve contents
    const newLayout = createSlideLayout(newLayoutType);
    for (let i = 0; i < Math.min(blocksWithContent.length, newLayout.blocks.length); i++) {
      newLayout.blocks[i] = {
        ...newLayout.blocks[i],
        ...blocksWithContent[i],
        id: newLayout.blocks[i].id, // Keep new block ID
      };
    }
    
    onUpdate(slide.id, { layout: newLayout });
    setSelectedBlockIndex(null);
  }, [layout, onUpdate, slide.id]);

  // Helper to render block editor with all props
  const renderBlockEditor = (blockIndex: number, placeholder: string) => (
    <SlideBlockEditor
      block={layout.blocks[blockIndex]}
      onUpdate={(updates) => handleBlockUpdate(blockIndex, updates)}
      onDelete={() => handleBlockDelete(blockIndex)}
      isSelected={selectedBlockIndex === blockIndex}
      onSelect={() => setSelectedBlockIndex(blockIndex)}
      onSettingsClick={() => onBlockSettingsClick?.(blockIndex)}
      onTextEditStart={() => onTextEditStart?.(blockIndex)}
      onTextEditEnd={onTextEditEnd}
      placeholder={placeholder}
      templateColor={getBlockColor(blockIndex)}
      borderRadius={getBlockRadius()}
    />
  );

  // Handle block update
  const handleBlockUpdate = useCallback((blockIndex: number, updates: Partial<SlideBlock>) => {
    const newBlocks = [...layout.blocks];
    newBlocks[blockIndex] = { ...newBlocks[blockIndex], ...updates };
    onUpdate(slide.id, { 
      layout: { ...layout, blocks: newBlocks } 
    });
  }, [layout, onUpdate, slide.id]);

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

    switch (layout.type) {
      case 'title-content':
        return (
          <div className="h-full flex flex-col" style={{ gap: getBlockGap() }}>
            {/* Title block */}
            <div style={{ height: `${titleHeight}%`, minHeight: 60 }}>
              {renderBlockEditor(0, "Nadpis...")}
            </div>
            
            {/* Title-Content resizer */}
            <BlockResizer
              direction="vertical"
              value={titleHeight}
              onChange={handleTitleHeightChange}
              min={10}
              max={40}
              snapTo={[15, 20, 25]}
            />
            
            {/* Content block */}
            <div className="flex-1" style={{ minHeight: 100 }}>
              {renderBlockEditor(1, "Obsah...")}
            </div>
          </div>
        );

      case 'title-2cols':
        return (
          <div className="h-full flex flex-col" style={{ gap: getBlockGap() }}>
            {/* Title block */}
            <div style={{ height: `${titleHeight}%`, minHeight: 60 }}>
              {renderBlockEditor(0, "Nadpis...")}
            </div>
            
            <BlockResizer
              direction="vertical"
              value={titleHeight}
              onChange={handleTitleHeightChange}
              min={10}
              max={40}
            />
            
            {/* Two columns */}
            <div className="flex-1 flex" style={{ minHeight: 100, gap: getBlockGap() }}>
              <div style={{ width: `${columnRatios[0]}%` }}>
                {renderBlockEditor(1, "Levý sloupec...")}
              </div>
              
              <BlockResizer
                direction="horizontal"
                value={columnRatios[0]}
                onChange={(v) => handleColumnRatioChange(0, v)}
                min={25}
                max={75}
              />
              
              <div style={{ width: `${columnRatios[1]}%` }}>
                {renderBlockEditor(2, "Pravý sloupec...")}
              </div>
            </div>
          </div>
        );

      case 'title-3cols':
        return (
          <div className="h-full flex flex-col" style={{ gap: getBlockGap() }}>
            {/* Title block */}
            <div style={{ height: `${titleHeight}%`, minHeight: 60 }}>
              {renderBlockEditor(0, "Nadpis...")}
            </div>
            
            <BlockResizer
              direction="vertical"
              value={titleHeight}
              onChange={handleTitleHeightChange}
              min={10}
              max={40}
            />
            
            {/* Three columns */}
            <div className="flex-1 flex" style={{ minHeight: 100, gap: getBlockGap() }}>
              <div style={{ width: `${columnRatios[0]}%` }}>
                {renderBlockEditor(1, "Sloupec 1...")}
              </div>
              
              <BlockResizer
                direction="horizontal"
                value={columnRatios[0]}
                onChange={(v) => handleColumnRatioChange(0, v)}
                min={20}
                max={50}
              />
              
              <div style={{ width: `${columnRatios[1]}%` }}>
                {renderBlockEditor(2, "Sloupec 2...")}
              </div>
              
              <BlockResizer
                direction="horizontal"
                value={columnRatios[0] + columnRatios[1]}
                onChange={(v) => handleColumnRatioChange(1, v - columnRatios[0])}
                min={50}
                max={80}
              />
              
              <div style={{ width: `${columnRatios[2]}%` }}>
                {renderBlockEditor(3, "Sloupec 3...")}
              </div>
            </div>
          </div>
        );

      case '2cols':
        return (
          <div className="h-full flex" style={{ gap: getBlockGap() }}>
            <div style={{ width: `${columnRatios[0]}%` }}>
              {renderBlockEditor(0, "Levý sloupec...")}
            </div>
            
            <BlockResizer
              direction="horizontal"
              value={columnRatios[0]}
              onChange={(v) => handleColumnRatioChange(0, v)}
              min={25}
              max={75}
            />
            
            <div style={{ width: `${columnRatios[1]}%` }}>
              {renderBlockEditor(1, "Pravý sloupec...")}
            </div>
          </div>
        );

      case '3cols':
  return (
          <div className="h-full flex" style={{ gap: getBlockGap() }}>
            <div style={{ width: `${columnRatios[0]}%` }}>
              {renderBlockEditor(0, "Sloupec 1...")}
            </div>
            
            <BlockResizer
              direction="horizontal"
              value={columnRatios[0]}
              onChange={(v) => handleColumnRatioChange(0, v)}
              min={20}
              max={50}
            />
            
            <div style={{ width: `${columnRatios[1]}%` }}>
              {renderBlockEditor(1, "Sloupec 2...")}
            </div>
            
            <BlockResizer
              direction="horizontal"
              value={columnRatios[0] + columnRatios[1]}
              onChange={(v) => handleColumnRatioChange(1, v - columnRatios[0])}
              min={50}
              max={80}
            />
            
            <div style={{ width: `${columnRatios[2]}%` }}>
              {renderBlockEditor(2, "Sloupec 3...")}
            </div>
        </div>
        );

      case 'left-large-right-split':
        return (
          <div className="h-full flex" style={{ gap: getBlockGap() }}>
            {/* Left large column */}
            <div style={{ width: `${columnRatios[0]}%` }}>
              {renderBlockEditor(0, "Hlavní obsah...")}
      </div>
      
            <BlockResizer
              direction="horizontal"
              value={columnRatios[0]}
              onChange={(v) => handleColumnRatioChange(0, v)}
              min={40}
              max={75}
            />
            
            {/* Right split column */}
            <div style={{ width: `${columnRatios[1]}%`, gap: getBlockGap() }} className="flex flex-col">
              <div style={{ height: `${splitRatio}%` }}>
                {renderBlockEditor(1, "Horní...")}
      </div>
      
              <BlockResizer
                direction="vertical"
                value={splitRatio}
                onChange={handleSplitRatioChange}
                min={25}
                max={75}
              />
              
              <div style={{ height: `${100 - splitRatio}%` }}>
                {renderBlockEditor(2, "Dolní...")}
              </div>
        </div>
          </div>
        );

      case 'right-large-left-split':
        return (
          <div className="h-full flex" style={{ gap: getBlockGap() }}>
            {/* Left split column */}
            <div style={{ width: `${columnRatios[0]}%`, gap: getBlockGap() }} className="flex flex-col">
              <div style={{ height: `${splitRatio}%` }}>
                {renderBlockEditor(0, "Horní...")}
      </div>
      
              <BlockResizer
                direction="vertical"
                value={splitRatio}
                onChange={handleSplitRatioChange}
                min={25}
                max={75}
              />
              
              <div style={{ height: `${100 - splitRatio}%` }}>
                {renderBlockEditor(1, "Dolní...")}
              </div>
            </div>
            
            <BlockResizer
              direction="horizontal"
              value={columnRatios[0]}
              onChange={(v) => handleColumnRatioChange(0, v)}
              min={25}
              max={60}
            />
            
            {/* Right large column */}
            <div style={{ width: `${columnRatios[1]}%` }}>
              {renderBlockEditor(2, "Hlavní obsah...")}
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
      className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden cursor-pointer"
      style={{ 
        aspectRatio: '4/3', 
        containerType: 'inline-size',
        ...getSlideBackgroundStyle(),
        fontFamily: getFontFamily(),
      }}
      onClick={() => {
        onSlideClick?.();
      }}
    >
      {/* Main content area - padding depends on gap setting */}
      <div 
        className="h-full"
        style={{ padding: getBlockGap() > 0 ? getBlockGap() : 0 }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedBlockIndex(null);
          onSlideClick?.();
        }}
      >
        {renderLayout()}
      </div>
    </div>
  );
}

export default InfoSlideEditor;
