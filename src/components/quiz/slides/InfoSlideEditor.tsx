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
} from '../../../types/quiz';
import { SlideBlockEditor } from './SlideBlockEditor';
import { BlockResizer } from './BlockResizer';
import { LayoutSelector } from './LayoutSelector';
import { BackgroundPicker } from './BackgroundPicker';

interface InfoSlideEditorProps {
  slide: InfoSlide;
  onUpdate: (id: string, updates: Partial<InfoSlide>) => void;
}

export function InfoSlideEditor({ slide, onUpdate }: InfoSlideEditorProps) {
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [showLayoutPanel, setShowLayoutPanel] = useState(!slide.layout);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);

  // Get or create layout
  const layout = slide.layout || createSlideLayout('title-content');

  // Handle layout change
  const handleLayoutChange = (layoutType: SlideLayoutType) => {
    const newLayout = createSlideLayout(layoutType);
    onUpdate(slide.id, { layout: newLayout });
    setShowLayoutPanel(false);
    setSelectedBlockIndex(null);
  };

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
          <div className="h-full flex flex-col">
            {/* Title block */}
            <div style={{ height: `${titleHeight}%`, minHeight: 60 }}>
              <SlideBlockEditor
                block={layout.blocks[0]}
                onUpdate={(updates) => handleBlockUpdate(0, updates)}
                isSelected={selectedBlockIndex === 0}
                onSelect={() => setSelectedBlockIndex(0)}
                placeholder="Nadpis..."
              />
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
              <SlideBlockEditor
                block={layout.blocks[1]}
                onUpdate={(updates) => handleBlockUpdate(1, updates)}
                isSelected={selectedBlockIndex === 1}
                onSelect={() => setSelectedBlockIndex(1)}
                placeholder="Obsah..."
              />
            </div>
          </div>
        );

      case 'title-2cols':
        return (
          <div className="h-full flex flex-col">
            {/* Title block */}
            <div style={{ height: `${titleHeight}%`, minHeight: 60 }}>
              <SlideBlockEditor
                block={layout.blocks[0]}
                onUpdate={(updates) => handleBlockUpdate(0, updates)}
                isSelected={selectedBlockIndex === 0}
                onSelect={() => setSelectedBlockIndex(0)}
                placeholder="Nadpis..."
              />
            </div>
            
            <BlockResizer
              direction="vertical"
              value={titleHeight}
              onChange={handleTitleHeightChange}
              min={10}
              max={40}
            />
            
            {/* Two columns */}
            <div className="flex-1 flex" style={{ minHeight: 100 }}>
              <div style={{ width: `${columnRatios[0]}%` }}>
                <SlideBlockEditor
                  block={layout.blocks[1]}
                  onUpdate={(updates) => handleBlockUpdate(1, updates)}
                  isSelected={selectedBlockIndex === 1}
                  onSelect={() => setSelectedBlockIndex(1)}
                  placeholder="Levý sloupec..."
                />
              </div>
              
              <BlockResizer
                direction="horizontal"
                value={columnRatios[0]}
                onChange={(v) => handleColumnRatioChange(0, v)}
                min={25}
                max={75}
              />
              
              <div style={{ width: `${columnRatios[1]}%` }}>
                <SlideBlockEditor
                  block={layout.blocks[2]}
                  onUpdate={(updates) => handleBlockUpdate(2, updates)}
                  isSelected={selectedBlockIndex === 2}
                  onSelect={() => setSelectedBlockIndex(2)}
                  placeholder="Pravý sloupec..."
                />
              </div>
            </div>
          </div>
        );

      case 'title-3cols':
        return (
          <div className="h-full flex flex-col">
            {/* Title block */}
            <div style={{ height: `${titleHeight}%`, minHeight: 60 }}>
              <SlideBlockEditor
                block={layout.blocks[0]}
                onUpdate={(updates) => handleBlockUpdate(0, updates)}
                isSelected={selectedBlockIndex === 0}
                onSelect={() => setSelectedBlockIndex(0)}
                placeholder="Nadpis..."
              />
            </div>
            
            <BlockResizer
              direction="vertical"
              value={titleHeight}
              onChange={handleTitleHeightChange}
              min={10}
              max={40}
            />
            
            {/* Three columns */}
            <div className="flex-1 flex" style={{ minHeight: 100 }}>
              <div style={{ width: `${columnRatios[0]}%` }}>
                <SlideBlockEditor
                  block={layout.blocks[1]}
                  onUpdate={(updates) => handleBlockUpdate(1, updates)}
                  isSelected={selectedBlockIndex === 1}
                  onSelect={() => setSelectedBlockIndex(1)}
                  placeholder="Sloupec 1..."
                />
              </div>
              
              <BlockResizer
                direction="horizontal"
                value={columnRatios[0]}
                onChange={(v) => handleColumnRatioChange(0, v)}
                min={20}
                max={50}
              />
              
              <div style={{ width: `${columnRatios[1]}%` }}>
                <SlideBlockEditor
                  block={layout.blocks[2]}
                  onUpdate={(updates) => handleBlockUpdate(2, updates)}
                  isSelected={selectedBlockIndex === 2}
                  onSelect={() => setSelectedBlockIndex(2)}
                  placeholder="Sloupec 2..."
                />
              </div>
              
              <BlockResizer
                direction="horizontal"
                value={columnRatios[0] + columnRatios[1]}
                onChange={(v) => handleColumnRatioChange(1, v - columnRatios[0])}
                min={50}
                max={80}
              />
              
              <div style={{ width: `${columnRatios[2]}%` }}>
                <SlideBlockEditor
                  block={layout.blocks[3]}
                  onUpdate={(updates) => handleBlockUpdate(3, updates)}
                  isSelected={selectedBlockIndex === 3}
                  onSelect={() => setSelectedBlockIndex(3)}
                  placeholder="Sloupec 3..."
                />
              </div>
            </div>
          </div>
        );

      case '2cols':
        return (
          <div className="h-full flex">
            <div style={{ width: `${columnRatios[0]}%` }}>
              <SlideBlockEditor
                block={layout.blocks[0]}
                onUpdate={(updates) => handleBlockUpdate(0, updates)}
                isSelected={selectedBlockIndex === 0}
                onSelect={() => setSelectedBlockIndex(0)}
                placeholder="Levý sloupec..."
              />
            </div>
            
            <BlockResizer
              direction="horizontal"
              value={columnRatios[0]}
              onChange={(v) => handleColumnRatioChange(0, v)}
              min={25}
              max={75}
            />
            
            <div style={{ width: `${columnRatios[1]}%` }}>
              <SlideBlockEditor
                block={layout.blocks[1]}
                onUpdate={(updates) => handleBlockUpdate(1, updates)}
                isSelected={selectedBlockIndex === 1}
                onSelect={() => setSelectedBlockIndex(1)}
                placeholder="Pravý sloupec..."
              />
            </div>
          </div>
        );

      case '3cols':
        return (
          <div className="h-full flex">
            <div style={{ width: `${columnRatios[0]}%` }}>
              <SlideBlockEditor
                block={layout.blocks[0]}
                onUpdate={(updates) => handleBlockUpdate(0, updates)}
                isSelected={selectedBlockIndex === 0}
                onSelect={() => setSelectedBlockIndex(0)}
                placeholder="Sloupec 1..."
              />
            </div>
            
            <BlockResizer
              direction="horizontal"
              value={columnRatios[0]}
              onChange={(v) => handleColumnRatioChange(0, v)}
              min={20}
              max={50}
            />
            
            <div style={{ width: `${columnRatios[1]}%` }}>
              <SlideBlockEditor
                block={layout.blocks[1]}
                onUpdate={(updates) => handleBlockUpdate(1, updates)}
                isSelected={selectedBlockIndex === 1}
                onSelect={() => setSelectedBlockIndex(1)}
                placeholder="Sloupec 2..."
              />
            </div>
            
            <BlockResizer
              direction="horizontal"
              value={columnRatios[0] + columnRatios[1]}
              onChange={(v) => handleColumnRatioChange(1, v - columnRatios[0])}
              min={50}
              max={80}
            />
            
            <div style={{ width: `${columnRatios[2]}%` }}>
              <SlideBlockEditor
                block={layout.blocks[2]}
                onUpdate={(updates) => handleBlockUpdate(2, updates)}
                isSelected={selectedBlockIndex === 2}
                onSelect={() => setSelectedBlockIndex(2)}
                placeholder="Sloupec 3..."
              />
            </div>
          </div>
        );

      case 'left-large-right-split':
        return (
          <div className="h-full flex">
            {/* Left large column */}
            <div style={{ width: `${columnRatios[0]}%` }}>
              <SlideBlockEditor
                block={layout.blocks[0]}
                onUpdate={(updates) => handleBlockUpdate(0, updates)}
                isSelected={selectedBlockIndex === 0}
                onSelect={() => setSelectedBlockIndex(0)}
                placeholder="Hlavní obsah..."
              />
            </div>
            
            <BlockResizer
              direction="horizontal"
              value={columnRatios[0]}
              onChange={(v) => handleColumnRatioChange(0, v)}
              min={40}
              max={75}
            />
            
            {/* Right split column */}
            <div style={{ width: `${columnRatios[1]}%` }} className="flex flex-col">
              <div style={{ height: `${splitRatio}%` }}>
                <SlideBlockEditor
                  block={layout.blocks[1]}
                  onUpdate={(updates) => handleBlockUpdate(1, updates)}
                  isSelected={selectedBlockIndex === 1}
                  onSelect={() => setSelectedBlockIndex(1)}
                  placeholder="Horní..."
                />
              </div>
              
              <BlockResizer
                direction="vertical"
                value={splitRatio}
                onChange={handleSplitRatioChange}
                min={25}
                max={75}
              />
              
              <div style={{ height: `${100 - splitRatio}%` }}>
                <SlideBlockEditor
                  block={layout.blocks[2]}
                  onUpdate={(updates) => handleBlockUpdate(2, updates)}
                  isSelected={selectedBlockIndex === 2}
                  onSelect={() => setSelectedBlockIndex(2)}
                  placeholder="Dolní..."
                />
              </div>
            </div>
          </div>
        );

      case 'right-large-left-split':
        return (
          <div className="h-full flex">
            {/* Left split column */}
            <div style={{ width: `${columnRatios[0]}%` }} className="flex flex-col">
              <div style={{ height: `${splitRatio}%` }}>
                <SlideBlockEditor
                  block={layout.blocks[0]}
                  onUpdate={(updates) => handleBlockUpdate(0, updates)}
                  isSelected={selectedBlockIndex === 0}
                  onSelect={() => setSelectedBlockIndex(0)}
                  placeholder="Horní..."
                />
              </div>
              
              <BlockResizer
                direction="vertical"
                value={splitRatio}
                onChange={handleSplitRatioChange}
                min={25}
                max={75}
              />
              
              <div style={{ height: `${100 - splitRatio}%` }}>
                <SlideBlockEditor
                  block={layout.blocks[1]}
                  onUpdate={(updates) => handleBlockUpdate(1, updates)}
                  isSelected={selectedBlockIndex === 1}
                  onSelect={() => setSelectedBlockIndex(1)}
                  placeholder="Dolní..."
                />
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
              <SlideBlockEditor
                block={layout.blocks[2]}
                onUpdate={(updates) => handleBlockUpdate(2, updates)}
                isSelected={selectedBlockIndex === 2}
                onSelect={() => setSelectedBlockIndex(2)}
                placeholder="Hlavní obsah..."
              />
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
      className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
      style={{ aspectRatio: '4/3', ...getSlideBackgroundStyle() }}
    >
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <button
          onClick={() => setShowLayoutPanel(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur rounded-lg shadow-sm border border-slate-200 text-slate-600 hover:bg-white transition-colors text-sm"
        >
          <Layout className="w-4 h-4" />
          Rozložení
        </button>
        
        <div className="relative">
          <button
            onClick={() => setShowBackgroundPicker(!showBackgroundPicker)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur rounded-lg shadow-sm border border-slate-200 text-slate-600 hover:bg-white transition-colors text-sm"
          >
            <Palette className="w-4 h-4" />
            Pozadí
          </button>
          
          {showBackgroundPicker && (
            <BackgroundPicker
              value={slide.slideBackground}
              onChange={handleSlideBackgroundChange}
              onClose={() => setShowBackgroundPicker(false)}
            />
          )}
        </div>
      </div>

      {/* Main content area */}
      <div 
        className="h-full p-4"
        onClick={() => setSelectedBlockIndex(null)}
      >
        {renderLayout()}
      </div>
    </div>
  );
}

export default InfoSlideEditor;
