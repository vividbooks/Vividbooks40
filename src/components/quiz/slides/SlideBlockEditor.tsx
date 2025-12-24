/**
 * SlideBlockEditor
 * 
 * Editable block component for slide layouts.
 * Supports text, image, and link content types.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Type,
  Image as ImageIcon,
  Link2,
  Settings,
  Upload,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { SlideBlock, SlideBlockType } from '../../../types/quiz';

interface SlideBlockEditorProps {
  block: SlideBlock;
  onUpdate: (updates: Partial<SlideBlock>) => void;
  isSelected?: boolean;
  onSelect?: () => void;
  onSettingsClick?: () => void;
  placeholder?: string;
  templateColor?: string;
  borderRadius?: number;
}

export function SlideBlockEditor({
  block,
  onUpdate,
  isSelected = false,
  onSelect,
  onSettingsClick,
  placeholder = 'Klikněte pro úpravu...',
  templateColor,
  borderRadius = 8,
}: SlideBlockEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const dragDataRef = useRef({ 
    startX: 0, 
    startY: 0, 
    startPosX: 0, 
    startPosY: 0,
    scale: 100,
    containerWidth: 0,
    containerHeight: 0
  });

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      autoResize();
    }
  }, [isEditing]);

  // Image drag handlers for positioning when scale > 100%
  const handleImageMouseDown = (e: React.MouseEvent) => {
    const scale = block.imageScale || 100;
    if (scale <= 100) return;
    if (!imageContainerRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = imageContainerRef.current.getBoundingClientRect();
    
    // Store all needed data at drag start
    dragDataRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: block.imagePositionX || 0,
      startPosY: block.imagePositionY || 0,
      scale: scale,
      containerWidth: rect.width,
      containerHeight: rect.height
    };
    
    setIsDragging(true);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const data = dragDataRef.current;
      
      // Delta in pixels
      const deltaX = moveEvent.clientX - data.startX;
      const deltaY = moveEvent.clientY - data.startY;
      
      // Simple: full container width drag = move from -100 to 100 (range of 200)
      // So sensitivity = 200 / containerWidth
      const sensitivityX = 400 / data.containerWidth; // More sensitive
      const sensitivityY = 400 / data.containerHeight;
      
      let newX = data.startPosX + deltaX * sensitivityX;
      let newY = data.startPosY + deltaY * sensitivityY;
      
      // Clamp to -100 to 100
      newX = Math.max(-100, Math.min(100, newX));
      newY = Math.max(-100, Math.min(100, newY));
      
      onUpdate({ imagePositionX: newX, imagePositionY: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    onSelect?.();
    if (block.type === 'text') {
      setIsEditing(true);
    } else if (block.type === 'link') {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onUpdate({ content: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTypeChange = (newType: SlideBlockType) => {
    onUpdate({ type: newType, content: '' });
  };

  const getFontSizeClass = () => {
    switch (block.fontSize) {
      case 'small': return 'text-sm';
      case 'medium': return 'text-base';
      case 'large': return 'text-xl';
      case 'xlarge': return 'text-3xl';
      default: return 'text-base';
    }
  };

  const getTextAlignClass = () => {
    switch (block.textAlign) {
      case 'left': return 'text-left';
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      default: return 'text-left';
    }
  };

  const getBackgroundStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {};
    
    if (templateColor && !block.background) {
      style.backgroundColor = templateColor;
      return style;
    }
    
    if (!block.background) return {};
    
    const bg = block.background;
    
    if (bg.type === 'color' && bg.color) {
      style.backgroundColor = bg.color === 'transparent' ? 'transparent' : bg.color;
      if (bg.opacity !== undefined && bg.opacity < 100) {
        style.opacity = bg.opacity / 100;
      }
    } else if (bg.type === 'image' && bg.imageUrl) {
      style.backgroundImage = `url(${bg.imageUrl})`;
      style.backgroundSize = 'cover';
      style.backgroundPosition = 'center';
      if (bg.blur) {
        style.filter = `blur(${bg.blur}px)`;
      }
    }
    
    return style;
  };

  return (
    <div
      className={`
        relative group h-full transition-all overflow-hidden
        ${isSelected ? 'ring-2 ring-blue-400 ring-offset-2' : ''}
      `}
      style={{
        ...getBackgroundStyle(),
        borderRadius: borderRadius,
      }}
      onClick={handleClick}
    >
      {/* Type switcher & Settings - LEFT corner, visible on hover */}
      <div 
        className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Type buttons */}
        <div className="flex items-center bg-white rounded-lg shadow-lg border border-slate-200 p-0.5">
          <button
            onClick={() => handleTypeChange('text')}
            className={`p-1.5 rounded-md transition-colors ${
              block.type === 'text' 
                ? 'bg-indigo-600 text-white' 
                : 'hover:bg-slate-100 text-slate-500'
            }`}
            title="Text"
          >
            <Type className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleTypeChange('image')}
            className={`p-1.5 rounded-md transition-colors ${
              block.type === 'image' 
                ? 'bg-indigo-600 text-white' 
                : 'hover:bg-slate-100 text-slate-500'
            }`}
            title="Obrázek"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleTypeChange('link')}
            className={`p-1.5 rounded-md transition-colors ${
              block.type === 'link' 
                ? 'bg-indigo-600 text-white' 
                : 'hover:bg-slate-100 text-slate-500'
            }`}
            title="Odkaz"
          >
            <Link2 className="w-4 h-4" />
          </button>
        </div>

        {/* Settings button - opens left panel */}
        <button
          onClick={() => onSettingsClick?.()}
          className="p-1.5 rounded-lg shadow-lg border bg-white text-slate-500 hover:bg-slate-100 border-slate-200 transition-colors"
          title="Nastavení bloku"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Delete button - RIGHT corner, visible on hover when there's content */}
      {(block.content || (block.gallery && block.gallery.length > 0)) && (
        <div 
          className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onUpdate({ content: '', gallery: undefined, galleryIndex: undefined })}
            className="p-2 rounded-lg shadow-lg transition-colors"
            style={{ backgroundColor: '#ef4444', color: 'white' }}
            title="Smazat obsah"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="h-full p-4 flex flex-col justify-center">
        {block.type === 'text' && (
          <>
            {isEditing ? (
              <textarea
                ref={textareaRef}
                value={block.content}
                onChange={(e) => {
                  onUpdate({ content: e.target.value });
                  autoResize();
                }}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onInput={autoResize}
                className={`
                  w-full bg-transparent outline-none resize-none
                  ${getFontSizeClass()} ${getTextAlignClass()}
                  ${block.fontWeight === 'bold' ? 'font-bold' : 'font-normal'}
                `}
                placeholder={placeholder}
              />
            ) : (
              <div
                className={`
                  w-full whitespace-pre-wrap
                  ${getFontSizeClass()} ${getTextAlignClass()}
                  ${block.fontWeight === 'bold' ? 'font-bold' : 'font-normal'}
                  ${!block.content ? 'text-slate-400' : 'text-slate-800'}
                `}
              >
                {block.content || placeholder}
              </div>
            )}
          </>
        )}

        {block.type === 'image' && (
          <div className="h-full flex items-center justify-center overflow-hidden">
            {(() => {
              // Get current image - from gallery or single content
              const hasGallery = block.gallery && block.gallery.length > 0;
              const galleryLength = block.gallery?.length || 0;
              const currentIndex = block.galleryIndex || 0;
              const currentImage = hasGallery 
                ? block.gallery![currentIndex] 
                : block.content;
              
              const imageScale = block.imageScale || 100;
              // If scale > 100%, use cover mode (crop), otherwise contain
              const imageFit = imageScale > 100 ? 'cover' : (block.imageFit || 'contain');
              const navType = block.galleryNavType || 'dots-bottom';
              
              // For solution type: first image is "question", second is "solution"
              const isSolutionMode = navType === 'solution' && hasGallery && galleryLength >= 2;
              const displayImage = isSolutionMode 
                ? (showSolution ? block.gallery![1] : block.gallery![0])
                : currentImage;

              const goNext = () => {
                if (hasGallery && galleryLength > 1) {
                  onUpdate({ galleryIndex: (currentIndex + 1) % galleryLength });
                }
              };

              const goPrev = () => {
                if (hasGallery && galleryLength > 1) {
                  onUpdate({ galleryIndex: (currentIndex - 1 + galleryLength) % galleryLength });
                }
              };

              // Render gallery navigation based on type
              const renderNavigation = (isDark: boolean) => {
                if (!hasGallery || galleryLength <= 1) return null;
                
                switch (navType) {
                  case 'dots-bottom':
                    return (
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 bg-black/30 px-3 py-2 rounded-full">
                        {block.gallery!.map((_, idx) => (
                          <button 
                            key={idx}
                            onClick={(e) => { e.stopPropagation(); onUpdate({ galleryIndex: idx }); }}
                            className={`w-3 h-3 rounded-full transition-all shadow-sm ${
                              idx === currentIndex
                                ? 'bg-white scale-125'
                                : 'bg-white/50 hover:bg-white/80'
                            }`}
                          />
                        ))}
                      </div>
                    );
                  
                  case 'dots-side':
                    return (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 bg-black/30 px-2 py-3 rounded-full">
                        {block.gallery!.map((_, idx) => (
                          <button 
                            key={idx}
                            onClick={(e) => { e.stopPropagation(); onUpdate({ galleryIndex: idx }); }}
                            className={`w-3 h-3 rounded-full transition-all shadow-sm ${
                              idx === currentIndex
                                ? 'bg-white scale-125'
                                : 'bg-white/50 hover:bg-white/80'
                            }`}
                          />
                        ))}
                      </div>
                    );
                  
                  case 'arrows':
                    return (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); goPrev(); }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all shadow-lg"
                          style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }}
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); goNext(); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all shadow-lg"
                          style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }}
                        >
                          <ChevronRight className="w-6 h-6" />
                        </button>
                      </>
                    );
                  
                  case 'solution':
                    return (
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setShowSolution(!showSolution);
                        }}
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 px-5 py-2 rounded-full font-medium text-sm transition-all flex items-center gap-2 shadow-lg z-30"
                        style={{
                          backgroundColor: showSolution ? '#334155' : '#4f46e5',
                          color: 'white',
                        }}
                      >
                        {showSolution ? (
                          <>
                            <EyeOff className="w-4 h-4" />
                            Skrýt řešení
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4" />
                            Zobrazit řešení
                          </>
                        )}
                      </button>
                    );
                  
                  default:
                    return null;
                }
              };
              
              if (displayImage) {
                // Position values from -100 to 100
                const posX = block.imagePositionX || 0;
                const posY = block.imagePositionY || 0;
                
                // Simple positioning:
                // posX/posY go from -100 to 100
                // When posX = 0: image centered
                // When posX = -100: image all the way left (we see right side)
                // When posX = 100: image all the way right (we see left side)
                // 
                // For a 150% image:
                // - Center: left = -25% (half of extra 50%)
                // - Left edge (posX=-100): left = 0%
                // - Right edge (posX=100): left = -50%
                const extraPercent = imageScale - 100; // e.g., 50 for 150%
                const maxOffset = extraPercent / 2; // e.g., 25 for 150%
                
                // posX = -100 -> imageLeft = 0
                // posX = 0 -> imageLeft = -maxOffset
                // posX = 100 -> imageLeft = -extraPercent
                const imageLeft = -maxOffset - (posX / 100) * maxOffset;
                const imageTop = -maxOffset - (posY / 100) * maxOffset;
                
                const imageElement = imageFit === 'cover' ? (
                  <div 
                    ref={imageContainerRef}
                    className={`absolute inset-0 ${imageScale > 100 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
                    onMouseDown={handleImageMouseDown}
                    style={{ overflow: isDragging ? 'visible' : 'hidden' }}
                  >
                    {/* Gray overlay showing image bounds when dragging */}
                    {imageScale > 100 && isDragging && (
                      <div 
                        className="absolute pointer-events-none bg-slate-200/80 border-2 border-dashed border-slate-400"
                        style={{
                          width: `${imageScale}%`,
                          height: `${imageScale}%`,
                          left: `${imageLeft}%`,
                          top: `${imageTop}%`,
                          zIndex: 5,
                        }}
                      />
                    )}
                    
                    {/* Image positioned inside container */}
                    <img
                      src={displayImage}
                      alt={block.imageCaption || ''}
                      className="absolute pointer-events-none select-none"
                      style={{
                        width: `${imageScale}%`,
                        height: `${imageScale}%`,
                        objectFit: 'cover',
                        left: `${imageLeft}%`,
                        top: `${imageTop}%`,
                        zIndex: 10,
                      }}
                      draggable={false}
                    />
                    
                    {/* Block boundary indicator when dragging */}
                    {imageScale > 100 && isDragging && (
                      <div 
                        className="absolute inset-0 pointer-events-none border-4 border-indigo-500 z-20"
                        style={{ borderRadius: borderRadius }}
                      />
                    )}
                    
                    {renderNavigation(true)}
                    {/* Caption */}
                    {block.imageCaption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-sm px-3 py-2 text-center pointer-events-none z-30">
                        {block.imageCaption}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative flex flex-col items-center justify-center w-full h-full">
                    <img
                      src={displayImage}
                      alt={block.imageCaption || ''}
                      className="rounded-lg transition-transform"
                      style={{
                        maxWidth: `${imageScale}%`,
                        maxHeight: `${imageScale}%`,
                        objectFit: 'contain',
                      }}
                    />
                    {renderNavigation(false)}
                    {/* Caption */}
                    {block.imageCaption && (
                      <div className="text-slate-600 text-sm mt-2 text-center px-2">
                        {block.imageCaption}
                      </div>
                    )}
                  </div>
                );

                // Wrap with link if imageLink is set
                if (block.imageLink) {
                  return (
                    <a 
                      href={block.imageLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full h-full"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {imageElement}
                    </a>
                  );
                }
                
                return imageElement;
              } else {
                return (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="flex flex-col items-center gap-3 p-6 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-slate-500" />
                    </div>
                    <span className="text-sm text-slate-500">nahrát</span>
                  </button>
                );
              }
            })()}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        )}

        {block.type === 'link' && (
          <div className="h-full flex flex-col items-center justify-center gap-2">
            <Link2 className="w-8 h-8 text-blue-500" />
            {isEditing ? (
              <input
                type="url"
                value={block.content}
                onChange={(e) => onUpdate({ content: e.target.value })}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-center"
                autoFocus
              />
            ) : (
              <span className={`text-blue-600 underline ${!block.content && 'text-slate-400'}`}>
                {block.title || block.content || 'Přidat odkaz'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SlideBlockEditor;
