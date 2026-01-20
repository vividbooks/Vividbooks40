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
  Play,
  Pause,
  Sparkles,
  QrCode,
  ExternalLink,
  Globe,
  Youtube,
  ChevronDown,
  Layout,
  Check,
} from 'lucide-react';
import Lottie from 'lottie-react';
import { QRCodeSVG } from 'qrcode.react';
import { SlideBlock, SlideBlockType } from '../../../types/quiz';
import { getContrastColor } from '../../../utils/color-utils';
import { preventOrphans } from '../../math/MathText';
import { AssetPicker } from '../../shared/AssetPicker';
import type { AssetPickerResult } from '../../../types/assets';

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

/**
 * Lottie Block Content Component
 * Renders a Lottie animation with play/pause controls
 */
function LottieBlockContent({ 
  block, 
  onUpdate 
}: { 
  block: SlideBlock; 
  onUpdate: (updates: Partial<SlideBlock>) => void;
}) {
  const [animationData, setAnimationData] = React.useState<any>(null);
  const [isPlaying, setIsPlaying] = React.useState(block.lottieAutoplay !== false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const lottieRef = React.useRef<any>(null);

  // Load animation data from URL
  React.useEffect(() => {
    const url = block.lottieUrl || block.content;
    if (!url) return;

    setIsLoading(true);
    setError(null);

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load animation');
        return res.json();
      })
      .then(data => {
        setAnimationData(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Lottie load error:', err);
        setError('Nepodařilo se načíst animaci');
        setIsLoading(false);
      });
  }, [block.lottieUrl, block.content]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lottieRef.current) {
      if (isPlaying) {
        lottieRef.current.pause();
      } else {
        lottieRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  if (!block.lottieUrl && !block.content) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
        <Play className="w-12 h-12" />
        <span className="text-sm">Vložte URL animace</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-red-400">
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full flex items-center justify-center">
      {animationData && (
        <Lottie
          lottieRef={lottieRef}
          animationData={animationData}
          loop={block.lottieLoop !== false}
          autoplay={block.lottieAutoplay !== false}
          style={{ 
            width: '100%', 
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        />
      )}
      
      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className="absolute bottom-3 right-3 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
    </div>
  );
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
  const [isHovered, setIsHovered] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [showOverflowDialog, setShowOverflowDialog] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [fitFontSize, setFitFontSize] = useState<number | null>(null);
  const [showPaddingGuides, setShowPaddingGuides] = useState(false);
  const paddingGuideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevTextPaddingRef = useRef(block.textPadding);
  
  // Show padding guides when textPadding changes
  useEffect(() => {
    if (block.type === 'text' && prevTextPaddingRef.current !== block.textPadding) {
      // Clear any existing timeout
      if (paddingGuideTimeoutRef.current) {
        clearTimeout(paddingGuideTimeoutRef.current);
      }
      setShowPaddingGuides(true);
      paddingGuideTimeoutRef.current = setTimeout(() => setShowPaddingGuides(false), 1500);
      prevTextPaddingRef.current = block.textPadding;
    }
    return () => {
      if (paddingGuideTimeoutRef.current) {
        clearTimeout(paddingGuideTimeoutRef.current);
      }
    };
  }, [block.textPadding, block.type]);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [showLinkModeDropdown, setShowLinkModeDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when not editing
  useEffect(() => {
    if (!isEditing) {
      setShowLinkModeDropdown(false);
    }
  }, [isEditing]);

  // Close dropdown or exit editing when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close link mode dropdown if clicking outside it
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowLinkModeDropdown(false);
      }
      
      // Exit editing mode if clicking outside the entire block container
      if (isEditing && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Only exit if we're not clicking on the AssetPicker (which is a portal)
        const target = event.target as HTMLElement;
        if (!target.closest('.asset-picker-content')) {
          setIsEditing(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLinkModeDropdown, isEditing]);
  const textContainerRef = useRef<HTMLDivElement>(null);
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
    if (!block) return;
    if (!isEditing && block.type === 'text' && textContainerRef.current && block.textOverflow === undefined) {
      const container = textContainerRef.current;
      const hasOverflow = container.scrollHeight > container.clientHeight + 5; // 5px tolerance
      setIsOverflowing(hasOverflow);
      if (hasOverflow && block.content && block.content.length > 50) {
        setShowOverflowDialog(true);
      }
    }
  }, [isEditing, block?.content, block?.type, block?.textOverflow]);

  // Auto-fit font size calculation - runs on content change and container resize
  // Note: We calculate even when editing to keep consistent size
  const calculateFitFontSize = React.useCallback(() => {
    if (!block) return;
    // ONLY for text blocks in fit mode
    const isFitMode = block.type === 'text' && (block.textOverflow === 'fit' || block.textOverflow === undefined);
    if (!isFitMode || !textContainerRef.current || !block.content) return;
    
    // Skip if content is clearly an image/data URL to avoid lag
    if (block.content.startsWith('data:image/')) return;

    const container = textContainerRef.current;
    // Use dynamic textPadding for text blocks (default 20), or default padding for others
    const actualPadding = block.type === 'text'
      ? (block.textPadding ?? 20) * 2 
      : (block.type === 'link' && !isEditing && (block.linkMode === 'video' || block.linkMode === 'embed') ? 0 : 32);
    const targetHeight = (container.clientHeight - actualPadding) * 0.85; // 85% of available height for safety
    const containerWidth = container.clientWidth - actualPadding; // minus padding

    if (targetHeight <= 0 || containerWidth <= 0) return;

    // Binary search for optimal font size - can go up to 200px for short text in large blocks
    let minSize = 8;
    let maxSize = 200;

    // Create a temporary element for measurement
    const measureEl = document.createElement('div');
    const fontFamilyMap: Record<string, string> = {
      fenomen: '"Fenomen Sans", ui-sans-serif, system-ui, sans-serif',
      cooper: '"Cooper Light", serif',
      space: '"Space Grotesk", sans-serif',
      sora: '"Sora", sans-serif',
      playfair: '"Playfair Display", serif',
      itim: '"Itim", cursive',
      sacramento: '"Sacramento", cursive',
      lora: '"Lora", serif',
      oswald: '"Oswald", sans-serif',
    };
    const fontFamily = fontFamilyMap[block.fontFamily || 'fenomen'] || fontFamilyMap.fenomen;
    measureEl.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre-wrap;
      overflow-wrap: normal;
      word-break: normal;
      hyphens: none;
      width: ${containerWidth}px;
      font-family: ${fontFamily};
      overflow-wrap: normal;
      word-break: normal;
      hyphens: none;
          font-weight: ${block.fontWeight === 'bold' ? 'bold' : 'normal'};
          font-style: ${block.fontStyle === 'italic' ? 'italic' : 'normal'};
          line-height: ${block.lineHeight ?? 1.5};
          letter-spacing: ${block.letterSpacing ?? 0}px;
          box-sizing: border-box;
    `;
    measureEl.textContent = block.content;
    document.body.appendChild(measureEl);

    let optimalSize = minSize;
    while (minSize <= maxSize) {
      const midSize = Math.floor((minSize + maxSize) / 2);
      measureEl.style.fontSize = `${midSize}px`;
      
      // It fits if height is within bounds AND no single word is wider than the container
      const fitsHeight = measureEl.scrollHeight <= targetHeight;
      const fitsWidth = measureEl.scrollWidth <= containerWidth;
      
      if (fitsHeight && fitsWidth) {
        optimalSize = midSize;
        minSize = midSize + 1;
      } else {
        maxSize = midSize - 1;
      }
    }

    document.body.removeChild(measureEl);
    
    // Store in state so it's available for both display and editing
    setFitFontSize(optimalSize);
  }, [block.type, block.textOverflow, block.content, block.fontWeight, block.fontStyle, block.lineHeight, block.letterSpacing, block.textPadding, block.fontFamily]);

  // Run calculation on content/settings change
  useEffect(() => {
    // Only run if it's a text block and content actually changed to avoid Base64 processing lag
    if (block.type === 'text') {
      calculateFitFontSize();
    }
  }, [calculateFitFontSize, block.content, block.type]);

  // Initial calculation when switching to fit mode
  useEffect(() => {
    const isFitMode = block.type === 'text' && (block.textOverflow === 'fit' || block.textOverflow === undefined);
    if (isFitMode && !fitFontSize) {
      calculateFitFontSize();
    }
  }, [block.textOverflow, fitFontSize, calculateFitFontSize, block.type]);

  // Recalculate font size when typography settings change
  useEffect(() => {
    const isFitMode = block.type === 'text' && (block.textOverflow === 'fit' || block.textOverflow === undefined);
    if (isFitMode) {
      calculateFitFontSize();
    }
  }, [block.textPadding, block.lineHeight, block.letterSpacing, block.type, block.textOverflow, calculateFitFontSize]);

  // Use ResizeObserver to recalculate when block size changes
  useEffect(() => {
    const isFitMode = block.type === 'text' && (block.textOverflow === 'fit' || block.textOverflow === undefined);
    if (!isFitMode || !textContainerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      calculateFitFontSize();
    });

    resizeObserver.observe(textContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [block.textOverflow, calculateFitFontSize, block.textPadding]);

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
    e.stopPropagation(); // Prevent opening slide settings when clicking a block
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

  const isLottie = (url?: string) => {
    if (!url) return false;
    return (url.toLowerCase().endsWith('.json') || url.includes('lottie')) && (url.startsWith('http') || url.startsWith('data:'));
  };

  const isValidMediaUrl = (url?: string) => {
    if (!url) return false;
    return url.startsWith('http') || url.startsWith('data:image/') || url.startsWith('data:application/json');
  };

  const handleAssetSelect = (result: AssetPickerResult) => {
    // Automatically switch type based on selected asset
    const newType = isLottie(result.url) ? 'lottie' : 'image';
    onUpdate({ 
      type: newType, 
      content: result.url,
      // Clear lottie-specific fields if switching to image and vice versa
      lottieUrl: newType === 'lottie' ? result.url : undefined,
    });
    setShowAssetPicker(false);
  };

  const handleTypeChange = (newType: SlideBlockType) => {
    onUpdate({ type: newType });
  };

  // Use cqw (container query width) for consistent sizing relative to container
  // Falls back to vw for browsers without container query support
  const getFontSize = (): string => {
    switch (block.fontSize) {
      case 'xsmall': return 'clamp(12px, 1.5cqw, 16px)';
      case 'small': return 'clamp(16px, 2.2cqw, 24px)';
      case 'medium': return 'clamp(22px, 3cqw, 36px)';
      case 'large': return 'clamp(32px, 4.5cqw, 54px)';
      case 'xlarge': return 'clamp(48px, 6.5cqw, 80px)';
      case 'xxlarge': return 'clamp(64px, 9cqw, 120px)';
      default: return 'clamp(22px, 3cqw, 36px)';
    }
  };

  const getFontFamily = (): string => {
    switch (block.fontFamily) {
      case 'fenomen': return '"Fenomen Sans", ui-sans-serif, system-ui, sans-serif';
      case 'cooper': return '"Cooper Light", serif';
      case 'space': return '"Space Grotesk", sans-serif';
      case 'sora': return '"Sora", sans-serif';
      case 'playfair': return '"Playfair Display", serif';
      case 'itim': return '"Itim", cursive';
      case 'sacramento': return '"Sacramento", cursive';
      case 'lora': return '"Lora", serif';
      case 'oswald': return '"Oswald", sans-serif';
      default: return '"Fenomen Sans", ui-sans-serif, system-ui, sans-serif';
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

  const getVerticalAlignClass = () => {
    switch (block.verticalAlign) {
      case 'top': return 'justify-start';
      case 'middle': return 'justify-center';
      case 'bottom': return 'justify-end';
      default: return 'justify-start';
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

  // Calculate the most appropriate text color based on background
  const getEffectiveTextColor = (): string => {
    if (block.textColor) return block.textColor;
    
    // If block has its own background color, use contrast color for it
    if (block.background?.type === 'color' && block.background.color && block.background.color !== 'transparent') {
      return getContrastColor(block.background.color);
    }
    
    // If template color is set and no block background, use contrast for template color
    if (templateColor && !block.background) {
      return getContrastColor(templateColor);
    }
    
    // Otherwise inherit from parent (which has slide background contrast)
    return 'inherit';
  };

  // Check if block has content
  const hasContent = block?.content || (block?.gallery && block.gallery.length > 0);

  // Early return if block is undefined (can happen with AI-generated slides)
  if (!block) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Blok není definován
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`
        relative group h-full transition-all
        ${isSelected ? 'z-[100]' : isHovered ? 'z-[90]' : 'z-10'}
      `}
      style={{
        borderRadius: borderRadius,
        boxShadow: isSelected 
          ? '0 0 0 2px rgba(0, 0, 0, 0.2), 0 10px 15px -3px rgba(0, 0, 0, 0.1)' 
          : isHovered 
            ? '0 0 0 2px rgba(0, 0, 0, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
            : 'none',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      onDoubleClick={(e) => {
        if (hasContent) {
          e.stopPropagation();
          onSettingsClick?.();
        }
      }}
    >
      {/* Type switcher & Settings - LEFT of block (OUTSIDE), visible on select */}
      <div 
        className={`
          absolute transition-opacity flex flex-col items-center gap-2
          ${isSelected ? 'opacity-100' : 'opacity-0'}
        `}
        style={{ 
          top: '0',
          left: '0',
          transform: 'translateX(-100%)',
          zIndex: 9999,
          paddingRight: '2px', // Very small gap just to not touch the border line
          pointerEvents: isSelected ? 'auto' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Type buttons */}
        <div className="flex flex-col items-center bg-white rounded-xl shadow-xl border border-slate-200 p-1 gap-1">
          <button
            onClick={() => handleTypeChange('text')}
            className="p-2 rounded-lg transition-colors"
            style={{
              backgroundColor: block.type === 'text' ? '#64748b' : undefined,
              color: block.type === 'text' ? 'white' : '#64748b',
            }}
            onMouseEnter={(e) => { if (block.type !== 'text') e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
            onMouseLeave={(e) => { if (block.type !== 'text') e.currentTarget.style.backgroundColor = ''; }}
            title="Text"
          >
            <Type className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              if (block.type !== 'image' && block.type !== 'lottie') {
                handleTypeChange('image');
              }
              // Don't auto-open asset picker - user clicks on empty block to open
            }}
            className="p-2 rounded-lg transition-colors"
            style={{
              backgroundColor: (block.type === 'image' || block.type === 'lottie') ? '#6366f1' : undefined,
              color: (block.type === 'image' || block.type === 'lottie') ? 'white' : '#64748b',
            }}
            onMouseEnter={(e) => { if (block.type !== 'image' && block.type !== 'lottie') e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
            onMouseLeave={(e) => { if (block.type !== 'image' && block.type !== 'lottie') e.currentTarget.style.backgroundColor = ''; }}
            title="Média (Obrázek/Animace)"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleTypeChange('link')}
            className="p-2 rounded-lg transition-colors"
            style={{
              backgroundColor: block.type === 'link' ? '#f97316' : undefined,
              color: block.type === 'link' ? 'white' : '#64748b',
            }}
            onMouseEnter={(e) => { if (block.type !== 'link') e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
            onMouseLeave={(e) => { if (block.type !== 'link') e.currentTarget.style.backgroundColor = ''; }}
            title="Odkaz"
          >
            <Link2 className="w-5 h-5" />
          </button>
        </div>

        {/* Settings button - opens left panel */}
        <button
          onClick={() => onSettingsClick?.()}
          className="p-2 rounded-xl shadow-xl border bg-white text-slate-500 hover:bg-slate-100 border-slate-200 transition-colors"
          title="Nastavení bloku"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Delete button - always visible on hover/select */}
          <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasContent) {
              onUpdate({ 
                content: '', 
                gallery: undefined, 
                galleryIndex: undefined, 
                imagePositionX: undefined, 
                imagePositionY: undefined,
                lottieUrl: undefined,
                linkTitle: undefined,
                linkDescription: undefined,
                linkThumbnail: undefined,
              });
            } else if (onDelete) {
              onDelete();
            }
          }}
          className="p-2 rounded-xl shadow-xl border transition-colors"
          style={{
            backgroundColor: hasContent ? '#ef4444' : '#ffffff',
            borderColor: hasContent ? '#ef4444' : '#e2e8f0',
            color: hasContent ? '#ffffff' : '#94a3b8',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#dc2626';
            e.currentTarget.style.borderColor = '#dc2626';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = hasContent ? '#ef4444' : '#ffffff';
            e.currentTarget.style.borderColor = hasContent ? '#ef4444' : '#e2e8f0';
            e.currentTarget.style.color = hasContent ? '#ffffff' : '#94a3b8';
          }}
          title={hasContent ? "Smazat obsah" : "Smazat blok"}
          >
            <Trash2 className="w-5 h-5" />
          </button>
      </div>

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

      {/* Content wrapper with overflow-hidden and background */}
      <div 
        ref={textContainerRef}
        className={`relative h-full flex flex-col min-h-0 ${getVerticalAlignClass()} ${
          (isEditing && block.type === 'link') ? 'overflow-visible' : 'overflow-hidden'
        } ${block.textOverflow === 'scroll' ? 'overflow-y-auto' : ''}`}
        style={{
          ...getBackgroundStyle(),
          borderRadius: borderRadius,
          padding: block.type === 'link' && !isEditing && (block.linkMode === 'video' || block.linkMode === 'embed') 
            ? '0' 
            : block.type === 'text'
              ? `${block.textPadding ?? 20}px` 
              : '16px',
          scrollbarWidth: block.textOverflow === 'scroll' ? 'thin' : undefined,
          scrollbarColor: block.textOverflow === 'scroll' ? '#cbd5e1 transparent' : undefined,
        }}
      >
        {/* Padding guides visualization when adjusting */}
        {showPaddingGuides && block.type === 'text' && (
          <>
            {/* Top border */}
            <div 
              className="absolute left-0 right-0 pointer-events-none z-10"
              style={{ 
                top: 0,
                height: block.textPadding ?? 20,
                background: 'linear-gradient(to bottom, rgba(99, 102, 241, 0.3), transparent)',
                borderBottom: '1px dashed rgba(99, 102, 241, 0.6)',
              }}
            />
            {/* Bottom border */}
            <div 
              className="absolute left-0 right-0 pointer-events-none z-10"
              style={{ 
                bottom: 0,
                height: block.textPadding ?? 20,
                background: 'linear-gradient(to top, rgba(99, 102, 241, 0.3), transparent)',
                borderTop: '1px dashed rgba(99, 102, 241, 0.6)',
              }}
            />
            {/* Left border */}
            <div 
              className="absolute top-0 bottom-0 pointer-events-none z-10"
              style={{ 
                left: 0,
                width: block.textPadding ?? 20,
                background: 'linear-gradient(to right, rgba(99, 102, 241, 0.3), transparent)',
                borderRight: '1px dashed rgba(99, 102, 241, 0.6)',
              }}
            />
            {/* Right border */}
            <div 
              className="absolute top-0 bottom-0 pointer-events-none z-10"
              style={{ 
                right: 0,
                width: block.textPadding ?? 20,
                background: 'linear-gradient(to left, rgba(99, 102, 241, 0.3), transparent)',
                borderLeft: '1px dashed rgba(99, 102, 241, 0.6)',
              }}
            />
          </>
        )}
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
                  w-full h-auto bg-transparent outline-none resize-none min-h-0 p-0
                  ${block.textOverflow === 'fit' || block.textOverflow === undefined ? 'overflow-hidden' : 'overflow-y-auto'}
                  ${getTextAlignClass()}
                  ${block.fontWeight === 'bold' ? 'font-bold' : 'font-normal'}
                  ${block.fontStyle === 'italic' ? 'italic' : ''}
                  ${block.textDecoration === 'underline' ? 'underline' : ''}
                `}
                style={{
                  fontSize: (block.textOverflow === 'fit' || block.textOverflow === undefined) && fitFontSize ? `${fitFontSize}px` : getFontSize(),
                  fontFamily: getFontFamily(),
                  color: getEffectiveTextColor(),
                  backgroundColor: block.highlightColor && block.highlightColor !== 'transparent' ? block.highlightColor : 'transparent',
                  lineHeight: block.lineHeight ?? 1.5,
                  letterSpacing: `${block.letterSpacing ?? 0}px`,
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'normal',
                  wordBreak: 'normal',
                  hyphens: 'none',
                }}
                placeholder={placeholder}
              />
            ) : (
              <div
                className={`
                  w-full h-auto min-h-0 overflow-hidden
                  ${getTextAlignClass()}
                  ${block.fontWeight === 'bold' ? 'font-bold' : 'font-normal'}
                  ${block.fontStyle === 'italic' ? 'italic' : ''}
                  ${block.textDecoration === 'underline' ? 'underline' : ''}
                  ${!block.content ? 'text-slate-400' : ''}
                `}
                style={{
                  // For placeholder, use a reasonable fixed size; for content, use fit calculation
                  fontSize: !block.content 
                    ? '24px' 
                    : ((block.textOverflow === 'fit' || block.textOverflow === undefined) && fitFontSize ? `${fitFontSize}px` : getFontSize()),
                  fontFamily: getFontFamily(),
                  color: !block.content ? '#94a3b8' : getEffectiveTextColor(),
                  backgroundColor: block.highlightColor && block.highlightColor !== 'transparent' ? block.highlightColor : 'transparent',
                  lineHeight: block.lineHeight ?? 1.5,
                  letterSpacing: `${block.letterSpacing ?? 0}px`,
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'normal',
                  wordBreak: 'normal',
                  hyphens: 'none',
                }}
              >
                {block.content ? preventOrphans(block.content) : placeholder}
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

              const isActualImage = isValidMediaUrl(displayImage);

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
              
              if (displayImage && isActualImage) {
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
                      setShowAssetPicker(true);
                    }}
                    className="flex flex-col items-center gap-3 p-6 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-indigo-600" />
                    </div>
                    <span className="text-sm text-slate-600">Vybrat obrázek nebo animaci</span>
                  </button>
                );
              }
            })()}
          </div>
        )}

        {block.type === 'lottie' && (
          <LottieBlockContent 
            block={isValidMediaUrl(block.content) ? block : { ...block, content: '' }} 
            onUpdate={onUpdate}
          />
        )}

        {block.type === 'link' && (
          <div className="relative h-full w-full flex items-center justify-center min-h-0">
            {/* Editor Overlay to capture clicks and prevent iframe interaction */}
            {!isEditing && (
              <div 
                className="absolute inset-0 z-20 cursor-pointer"
                onClick={handleClick}
              />
            )}
            
            {(() => {
              if (!isValidMediaUrl(block.content) && !isEditing) {
                return (
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Link2 className="w-8 h-8" />
                    <span className="text-sm">Vložte odkaz</span>
                  </div>
                );
              }

              if (isEditing) {
                const youtubeId = (url: string) => {
                  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                  const match = url.match(regExp);
                  return (match && match[2].length === 11) ? match[2] : null;
                };

                return (
                  <div className="w-full flex flex-col items-center gap-4 p-4 max-w-xl">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Link2 className="w-6 h-6 text-blue-500" />
                    </div>
                    <div className="w-full space-y-2">
              <input
                type="url"
                value={block.content}
                        onChange={(e) => {
                          const url = e.target.value;
                          onUpdate({ content: url });
                          
                          // Auto-identify YouTube
                          const ytId = youtubeId(url);
                          if (ytId && block.linkMode !== 'video') {
                            onUpdate({ 
                              linkMode: 'video',
                              linkTitle: block.linkTitle || 'Přehrát video'
                            });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setIsEditing(false);
                          }
                          if (e.key === 'Escape') {
                            setIsEditing(false);
                          }
                        }}
                placeholder="https://..."
                        className="w-full px-4 py-3 rounded-xl border-2 border-indigo-100 text-center outline-none focus:border-indigo-500 transition-all shadow-sm"
                autoFocus
              />
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold text-center">Stiskněte Enter pro uložení</p>
                    </div>

                    {/* Narrow Custom Dropdown for mode selection */}
                    <div ref={dropdownRef} className="w-full max-w-[130px] pt-2 relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowLinkModeDropdown(!showLinkModeDropdown);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-medium text-slate-600 hover:border-indigo-300 transition-all shadow-sm"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          {(() => {
                            const m = block.linkMode || 'button';
                            if (m === 'button') return <ExternalLink className="w-3 h-3 text-indigo-500 shrink-0" />;
                            if (m === 'preview') return <Layout className="w-3 h-3 text-indigo-500 shrink-0" />;
                            if (m === 'video') return <Youtube className="w-3 h-3 text-indigo-500 shrink-0" />;
                            if (m === 'qr') return <QrCode className="w-3 h-3 text-indigo-500 shrink-0" />;
                            if (m === 'embed') return <Globe className="w-3 h-3 text-indigo-500 shrink-0" />;
                            return null;
                          })()}
                          <span className="truncate">
                            {(() => {
                              const m = block.linkMode || 'button';
                              if (m === 'button') return 'Tlačítko';
                              if (m === 'preview') return 'Náhled';
                              if (m === 'video') return 'Video';
                              if (m === 'qr') return 'QR kód';
                              if (m === 'embed') return 'Embed';
                              return m;
                            })()}
              </span>
                        </div>
                        <ChevronDown className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${showLinkModeDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showLinkModeDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[100] overflow-hidden">
                          {[
                            { id: 'button', label: 'Tlačítko', icon: ExternalLink },
                            { id: 'preview', label: 'Náhled', icon: Layout },
                            { id: 'video', label: 'Video', icon: Youtube, disabled: !youtubeId(block.content) },
                            { id: 'qr', label: 'QR kód', icon: QrCode },
                            { id: 'embed', label: 'Embed', icon: Globe },
                          ].map((option) => (
                            <button
                              key={option.id}
                              disabled={option.disabled}
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdate({ linkMode: option.id as any });
                                setShowLinkModeDropdown(false);
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium transition-colors text-left
                                ${option.disabled ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:bg-indigo-50 text-slate-500 hover:text-indigo-700'}
                                ${block.linkMode === option.id ? 'bg-indigo-50 text-indigo-600' : ''}
                              `}
                            >
                              <option.icon className="w-3 h-3 shrink-0" />
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* OK Button to finish editing */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(false);
                      }}
                      style={{
                        marginTop: '8px',
                        padding: '10px 24px',
                        backgroundColor: '#4E5871',
                        color: 'white',
                        borderRadius: '12px',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3d4660'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4E5871'}
                    >
                      <Check className="w-4 h-4" />
                      Hotovo
                    </button>
                  </div>
                );
              }

              // Rendering based on linkMode
              const mode = block.linkMode || 'button';
              const url = block.content;

              switch (mode) {
                case 'qr':
                  return (
                    <div className="w-full h-full flex items-center justify-center p-2">
                      <div className="w-full h-full max-w-full max-h-full flex items-center justify-center bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                        <QRCodeSVG 
                          value={url} 
                          size={1000} // Large value, CSS will handle actual size
                          style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }}
                          level="H" 
                          includeMargin={true} 
                        />
                      </div>
                    </div>
                  );

                case 'video':
                  const getYoutubeId = (url: string) => {
                    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                    const match = url.match(regExp);
                    return (match && match[2].length === 11) ? match[2] : null;
                  };
                  const videoId = getYoutubeId(url);
                  if (videoId) {
                    return (
                      <div 
                        className="absolute inset-0 w-full h-full overflow-hidden bg-black"
                        style={{ borderRadius }}
                      >
                        <iframe
                          src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=0`}
                          className="absolute inset-0 w-full h-full border-none"
                          title="YouTube video"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    );
                  }
                  return (
                    <div className="p-4 text-amber-600 bg-amber-50 rounded-xl border border-amber-200 text-center text-xs">
                      Neplatná URL videa
                    </div>
                  );

                case 'embed':
                  // Convert http:// to https:// to avoid mixed content errors
                  const secureEmbedUrl = url.startsWith('http://') ? url.replace('http://', 'https://') : url;
                  return (
                    <div 
                      className="absolute inset-0 w-full h-full overflow-hidden bg-slate-50"
                      style={{ borderRadius }}
                    >
                      <iframe
                        src={secureEmbedUrl}
                        className="w-full h-full border-none"
                        title="Embedded content"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      />
                    </div>
                  );

                case 'preview':
                  return (
                    <div 
                      className="absolute inset-0 w-full h-full flex flex-col overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                      style={{ borderRadius }}
                      onClick={() => window.open(url, '_blank')}
                    >
                      {block.linkThumbnail ? (
                        <div className="flex-1 min-h-0 bg-slate-100 overflow-hidden">
                          <img src={block.linkThumbnail} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="flex-1 min-h-0 flex items-center justify-center bg-slate-50">
                          <Globe className="w-12 h-12 text-slate-200" />
          </div>
        )}
                      <div className="p-4 flex flex-col gap-1 shrink-0">
                        <h4 className="font-bold text-slate-800 truncate line-clamp-1">
                          {block.linkTitle || 'Náhled odkazu'}
                        </h4>
                        {block.linkDescription && (
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {block.linkDescription}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-1.5 text-blue-600 font-medium text-[10px] uppercase tracking-wider">
                          <ExternalLink className="w-3 h-3" />
                          <span>Otevřít stránku</span>
                        </div>
      </div>
    </div>
                  );

                case 'button':
                default:
                  return (
                    <button
                      onClick={() => window.open(url, '_blank')}
                      className="group flex flex-col items-center gap-3 p-6 rounded-2xl transition-all hover:scale-105 active:scale-95"
                      style={{
                        backgroundColor: templateColor || '#4f46e5',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center transition-colors group-hover:bg-white/30">
                        <ExternalLink className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-lg font-bold text-white tracking-tight">
                        {block.linkTitle || 'Přejít na odkaz'}
                      </span>
                    </button>
                  );
              }
            })()}
          </div>
        )}
      </div>

      {/* AssetPicker Modal */}
      <AssetPicker
        isOpen={showAssetPicker}
        onClose={() => setShowAssetPicker(false)}
        onSelect={handleAssetSelect}
        showUpload={true}
        showLibrary={true}
        showGiphy={true}
        showGoogle={true}
        showVividbooks={true}
        defaultTab="upload"
      />
    </div>
  );
}

export default SlideBlockEditor;
