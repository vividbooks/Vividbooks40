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
  onDelete?: () => void; // Delete the entire block (change layout)
  isSelected?: boolean;
  onSelect?: () => void;
  onSettingsClick?: () => void;
  onTextEditStart?: () => void; // Called when text editing starts
  onTextEditEnd?: () => void; // Called when text editing ends
  placeholder?: string;
  templateColor?: string;
  borderRadius?: number;
}

export function SlideBlockEditor({
  block,
  onUpdate,
  onDelete,
  isSelected = false,
  onSelect,
  onSettingsClick,
  onTextEditStart,
  onTextEditEnd,
  placeholder = 'Klikněte pro úpravu...',
  templateColor,
  borderRadius = 8,
}: SlideBlockEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [showOverflowDialog, setShowOverflowDialog] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  
  // Drag state for image positioning
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 50, posY: 50 });

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      autoResize();
    }
  }, [isEditing]);

  // Check for text overflow when not editing
  useEffect(() => {
    if (!isEditing && block.type === 'text' && textContainerRef.current && !block.textOverflow) {
      const container = textContainerRef.current;
      const hasOverflow = container.scrollHeight > container.clientHeight + 5; // 5px tolerance
      setIsOverflowing(hasOverflow);
      if (hasOverflow && block.content && block.content.length > 50) {
        setShowOverflowDialog(true);
      }
    }
  }, [isEditing, block.content, block.type, block.textOverflow]);

  // Auto-fit font size calculation - runs on content change and container resize
  const calculateFitFontSize = React.useCallback(() => {
    if (block.textOverflow !== 'fit' || !textContainerRef.current || !block.content || isEditing) return;
    
    const container = textContainerRef.current;
    const targetHeight = container.clientHeight * 0.9; // 90% of block height
    const containerWidth = container.clientWidth - 32; // minus padding

    if (targetHeight <= 0 || containerWidth <= 0) return;

    // Binary search for optimal font size - can go up to 120px for large blocks
    let minSize = 8;
    let maxSize = 120;

    // Create a temporary element for measurement
    const measureEl = document.createElement('div');
    measureEl.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      width: ${containerWidth}px;
      font-weight: ${block.fontWeight === 'bold' ? 'bold' : 'normal'};
      font-style: ${block.fontStyle === 'italic' ? 'italic' : 'normal'};
      line-height: 1.4;
    `;
    measureEl.textContent = block.content;
    document.body.appendChild(measureEl);

    let optimalSize = minSize;
    while (minSize <= maxSize) {
      const midSize = Math.floor((minSize + maxSize) / 2);
      measureEl.style.fontSize = `${midSize}px`;
      
      if (measureEl.scrollHeight <= targetHeight) {
        optimalSize = midSize;
        minSize = midSize + 1;
      } else {
        maxSize = midSize - 1;
      }
    }

    document.body.removeChild(measureEl);
    
    // Apply the calculated font size via CSS variable
    container.style.setProperty('--fit-font-size', `${optimalSize}px`);
  }, [block.textOverflow, block.content, block.fontWeight, block.fontStyle, isEditing]);

  // Run calculation on content/settings change
  useEffect(() => {
    calculateFitFontSize();
  }, [calculateFitFontSize]);

  // Use ResizeObserver to recalculate when block size changes
  useEffect(() => {
    if (block.textOverflow !== 'fit' || !textContainerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      calculateFitFontSize();
    });

    resizeObserver.observe(textContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [block.textOverflow, calculateFitFontSize]);

  // Simple image drag using object-position (0-100%)
  const handleImageMouseDown = (e: React.MouseEvent) => {
    const scale = block.imageScale || 100;
    if (scale <= 100) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // imagePositionX/Y are stored as 0-100 (percentage for object-position)
    // Default is 50 (centered)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: block.imagePositionX ?? 50,
      posY: block.imagePositionY ?? 50
    };
    
    setIsDragging(true);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Delta in pixels - drag right = show left side = decrease X
      const deltaX = moveEvent.clientX - dragStartRef.current.x;
      const deltaY = moveEvent.clientY - dragStartRef.current.y;
      
      // Sensitivity: 200px drag = full range (0-100)
      const sensitivity = 0.5;
      
      let newX = dragStartRef.current.posX - deltaX * sensitivity;
      let newY = dragStartRef.current.posY - deltaY * sensitivity;
      
      // Clamp to 0-100
      newX = Math.max(0, Math.min(100, newX));
      newY = Math.max(0, Math.min(100, newY));
      
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
      onTextEditStart?.();
    } else if (block.type === 'link') {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    onTextEditEnd?.();
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

  // Use cqw (container query width) for consistent sizing relative to container
  // Falls back to vw for browsers without container query support
  const getFontSize = (): string => {
    switch (block.fontSize) {
      case 'small': return 'clamp(12px, 1.4cqw, 14px)';
      case 'medium': return 'clamp(14px, 1.8cqw, 20px)';
      case 'large': return 'clamp(18px, 2.4cqw, 28px)';
      case 'xlarge': return 'clamp(24px, 3.2cqw, 38px)';
      default: return 'clamp(14px, 1.8cqw, 20px)';
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

  // Check if block has content
  const hasContent = block.content || (block.gallery && block.gallery.length > 0);

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
      onDoubleClick={(e) => {
        if (hasContent) {
          e.stopPropagation();
          onSettingsClick?.();
        }
      }}
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
      {hasContent && (
        <div 
          className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onUpdate({ content: '', gallery: undefined, galleryIndex: undefined, imagePositionX: undefined, imagePositionY: undefined })}
            className="p-2 rounded-lg shadow-lg transition-colors"
            style={{ backgroundColor: '#ef4444', color: 'white' }}
            title="Smazat obsah"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Overflow Dialog */}
      {showOverflowDialog && (
        <div 
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 rounded-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-xl shadow-2xl p-5 max-w-xs mx-4">
            <h3 className="font-semibold text-slate-800 mb-3 text-center">Text přesahuje blok</h3>
            <p className="text-sm text-slate-600 mb-4 text-center">Jak chcete zobrazit delší text?</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  onUpdate({ textOverflow: 'scroll' });
                  setShowOverflowDialog(false);
                }}
                className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ backgroundColor: '#4f46e5', color: 'white' }}
              >
                📜 Scrollovací blok
              </button>
              <button
                onClick={() => {
                  onUpdate({ textOverflow: 'fit' });
                  setShowOverflowDialog(false);
                }}
                className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ backgroundColor: '#0891b2', color: 'white' }}
              >
                🔤 Přizpůsobit velikost písma
              </button>
              <button
                onClick={() => setShowOverflowDialog(false)}
                className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Ponechat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div 
        ref={textContainerRef}
        className={`h-full p-4 flex flex-col ${block.textOverflow === 'scroll' ? 'overflow-y-auto' : 'overflow-hidden'} ${block.textOverflow === 'fit' ? '' : 'justify-center'}`}
      >
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
                  ${getTextAlignClass()}
                  ${block.fontWeight === 'bold' ? 'font-bold' : 'font-normal'}
                  ${block.fontStyle === 'italic' ? 'italic' : ''}
                  ${block.textDecoration === 'underline' ? 'underline' : ''}
                `}
                style={{
                  fontSize: getFontSize(),
                  color: block.textColor || 'inherit',
                  backgroundColor: block.highlightColor && block.highlightColor !== 'transparent' ? block.highlightColor : 'transparent',
                }}
                placeholder={placeholder}
              />
            ) : (
              <div
                className={`
                  w-full whitespace-pre-wrap
                  ${getTextAlignClass()}
                  ${block.fontWeight === 'bold' ? 'font-bold' : 'font-normal'}
                  ${block.fontStyle === 'italic' ? 'italic' : ''}
                  ${block.textDecoration === 'underline' ? 'underline' : ''}
                  ${!block.content ? 'text-slate-400' : ''}
                `}
                style={{
                  fontSize: block.textOverflow === 'fit' ? 'var(--fit-font-size, ' + getFontSize() + ')' : getFontSize(),
                  color: block.content ? (block.textColor || '#1e293b') : undefined,
                  backgroundColor: block.highlightColor && block.highlightColor !== 'transparent' ? block.highlightColor : 'transparent',
                }}
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
                // Position values 0-100 (for object-position), default 50 = centered
                const posX = block.imagePositionX ?? 50;
                const posY = block.imagePositionY ?? 50;
                
                const imageElement = imageFit === 'cover' ? (
                  <div 
                    ref={imageContainerRef}
                    className={`absolute inset-0 overflow-hidden ${imageScale > 100 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
                    onMouseDown={handleImageMouseDown}
                  >
                    {/* Simple image with object-fit and object-position */}
                    <img
                      src={displayImage}
                      alt={block.imageCaption || ''}
                      className="w-full h-full pointer-events-none select-none"
                      style={{
                        objectFit: 'cover',
                        objectPosition: `${posX}% ${posY}%`,
                        transform: imageScale > 100 ? `scale(${imageScale / 100})` : undefined,
                      }}
                      draggable={false}
                    />
                    
                    {/* Drag indicator */}
                    {imageScale > 100 && isDragging && (
                      <div className="absolute inset-0 pointer-events-none border-4 border-indigo-500 bg-indigo-500/10" style={{ borderRadius }} />
                    )}
                    
                    {/* Position indicator when dragging */}
                    {imageScale > 100 && isDragging && (
                      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded pointer-events-none z-50">
                        Pozice: {Math.round(posX)}%, {Math.round(posY)}%
                      </div>
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
