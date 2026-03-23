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
  Plus,
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
  ChevronUp,
  Layout,
  Check,
  Code2,
  MousePointer,
  Table2,
  Layers,
  BarChart2,
  Map as MapIcon,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import Lottie from 'lottie-react';
import { QRCodeSVG } from 'qrcode.react';
import { SlideBlock, SlideBlockType } from '../../../types/quiz';
import { VividMap, MapDataEditor } from '../../shared/VividMap';
import { QuizMap } from '../../shared/QuizMap';
import type { SavedMap } from '../../../types/topic-dataset';
import { getContrastColor } from '../../../utils/color-utils';
import { preventOrphans } from '../../math/MathText';
import { AssetPicker } from '../../shared/AssetPicker';
import type { AssetPickerResult } from '../../../types/assets';
import { GalleryGridPreview, isGalleryGrid } from '../GalleryGridPreview';
import { ScaledHtmlBlock } from '../ScaledHtmlBlock';
import { VividTableBlock } from '../VividTableBlock';
import { isRenderableLinkUrl, normalizeLinkUrl } from '../../../utils/link-url';

interface SlideBlockEditorProps {
  block: SlideBlock;
  onUpdate: (updates: Partial<SlideBlock>) => void;
  onDelete?: () => void; // Delete the entire block (change layout)
  isSelected?: boolean;
  onSelect?: () => void;
  onSettingsClick?: (initialSection?: string) => void;
  onTextEditStart?: () => void; // Called when text editing starts
  onTextEditEnd?: () => void; // Called when text editing ends
  placeholder?: string;
  templateColor?: string;
  datasetImages?: Array<{ url: string; title?: string; alt?: string }>;
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
  datasetImages,
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
  const prevBlockContentRef = useRef(block.content);
  
  // Show padding guides only when the user adjusts the padding slider (same block, padding changed)
  // When switching to a different block (content changes), just update ref silently
  useEffect(() => {
    const blockContentChanged = prevBlockContentRef.current !== block.content;
    prevBlockContentRef.current = block.content;

    if (blockContentChanged) {
      // Different block - just update ref, don't show guides
      prevTextPaddingRef.current = block.textPadding;
      setShowPaddingGuides(false);
      if (paddingGuideTimeoutRef.current) {
        clearTimeout(paddingGuideTimeoutRef.current);
      }
      return;
    }

    if (block.type === 'text' && prevTextPaddingRef.current !== block.textPadding) {
      // Same block, padding changed by user slider
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
  }, [block.textPadding, block.type, block.content]);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [showLinkModeDropdown, setShowLinkModeDropdown] = useState(false);
  const [showInteractiveMenu, setShowInteractiveMenu] = useState(false);
  const [showAdvancedInteractiveItems, setShowAdvancedInteractiveItems] = useState(
    block.type === 'table' || block.type === 'chart' || block.type === 'map' || (block.type === 'link' && (block.linkMode === 'html' || block.linkMode === 'svg'))
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when not editing
  useEffect(() => {
    if (!isEditing) {
      setShowLinkModeDropdown(false);
    }
  }, [isEditing]);

  useEffect(() => {
    if (block.type === 'table' || block.type === 'chart' || block.type === 'map' || (block.type === 'link' && (block.linkMode === 'html' || block.linkMode === 'svg'))) {
      setShowAdvancedInteractiveItems(true);
    }
  }, [block.type, block.linkMode]);

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
    if (!isFitMode || !textContainerRef.current) return;

    const textToMeasure = (block.content || placeholder || '').replace(/<[^>]+>/g, '');
    if (!textToMeasure.trim()) {
      setFitFontSize(null);
      return;
    }
    
    // Skip if content is clearly an image/data URL to avoid lag
    if (block.content?.startsWith('data:image/')) return;

    const container = textContainerRef.current;
    // Use dynamic textPadding for text blocks (default 20), or default padding for others
    const actualPadding = block.type === 'text'
      ? (block.textPadding ?? 20) * 2 
      : (block.type === 'link' && !isEditing && (block.linkMode === 'video' || block.linkMode === 'embed') ? 0 : 32);
    const targetHeight = (container.clientHeight - actualPadding) * 0.85; // 85% of available height for safety
    const containerWidth = container.clientWidth - actualPadding - 2; // -2px buffer for sub-pixel rounding

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
      visby: '"Visby Round", ui-sans-serif, sans-serif',
      vividscript: '"Vividbooks Script", cursive',
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
      font-weight: ${block.fontFamily === 'cooper' ? 'normal' : (block.fontWeight === 'bold' ? 'bold' : 'normal')};
      font-style: ${block.fontStyle === 'italic' ? 'italic' : 'normal'};
      line-height: ${block.lineHeight ?? 1.5};
      letter-spacing: ${block.letterSpacing ?? 0}px;
      box-sizing: border-box;
    `;
    // Strip HTML tags for measurement so only visible text is sized
    measureEl.textContent = textToMeasure;
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
  }, [block.type, block.textOverflow, block.content, block.fontWeight, block.fontStyle, block.lineHeight, block.letterSpacing, block.textPadding, block.fontFamily, placeholder]);

  // Run calculation on content/settings change (also after fonts are loaded to avoid measuring with fallback font)
  useEffect(() => {
    if (block.type !== 'text') return;
    document.fonts.ready.then(() => calculateFitFontSize());
  }, [calculateFitFontSize, block.content, block.type, placeholder]);

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
    return isRenderableLinkUrl(url);
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
      case 'visby': return '"Visby Round", ui-sans-serif, sans-serif';
      case 'vividscript': return '"Vividbooks Script", cursive';
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

    if (bg.strokeColor && (bg.strokeWidth ?? 0) > 0) {
      style.border = `${bg.strokeWidth}px solid ${bg.strokeColor}`;
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
      data-slide-block
      className={`
        relative group h-full transition-all
        ${isSelected ? 'z-[100]' : isHovered ? 'z-[90]' : 'z-10'}
      `}
      style={{
        borderRadius: (block as any).blockBorderRadius ?? borderRadius,
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
          onSettingsClick?.(block.type === 'link' ? 'link' : undefined);
        }
      }}
    >
      {/* Type switcher & Settings - LEFT of block (OUTSIDE), visible on select */}
      <div 
        data-slide-block
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
          {/* Text */}
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

          {/* Image / Media */}
          <button
            onClick={() => {
              if (block.type !== 'image' && block.type !== 'lottie') handleTypeChange('image');
            }}
            className="p-2 rounded-lg transition-colors"
            style={{
              backgroundColor: (block.type === 'image' || block.type === 'lottie') ? '#6366f1' : undefined,
              color: (block.type === 'image' || block.type === 'lottie') ? 'white' : '#64748b',
            }}
            onMouseEnter={(e) => { if (block.type !== 'image' && block.type !== 'lottie') e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
            onMouseLeave={(e) => { if (block.type !== 'image' && block.type !== 'lottie') e.currentTarget.style.backgroundColor = ''; }}
            title="Obrázek / Animace"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* Interactive — link / html / table — with submenu */}
          <div className="relative">
            <button
              onClick={() => setShowInteractiveMenu(v => !v)}
              className="p-2 rounded-lg transition-colors"
              style={{
              backgroundColor: (block.type === 'link' || block.type === 'table' || block.type === 'chart') ? '#f97316' : undefined,
              color: (block.type === 'link' || block.type === 'table' || block.type === 'chart') ? 'white' : '#64748b',
              }}
              onMouseEnter={(e) => { if (block.type !== 'link' && block.type !== 'table' && block.type !== 'chart') e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
              onMouseLeave={(e) => { if (block.type !== 'link' && block.type !== 'table' && block.type !== 'chart') e.currentTarget.style.backgroundColor = ''; }}
              title="Interaktivní"
            >
              <MousePointer className="w-5 h-5" />
            </button>

            {showInteractiveMenu && (
              <div
                className="absolute left-full top-0 ml-2 bg-white border border-slate-200 rounded-xl shadow-xl z-[200] overflow-hidden"
                style={{ minWidth: 180 }}
                onMouseLeave={() => setShowInteractiveMenu(false)}
              >
                {([
                  { id: 'link-button',  label: 'Tlačítko',    icon: ExternalLink, type: 'link' as const, mode: 'button' },
                  { id: 'link-video',   label: 'Video',        icon: Youtube,      type: 'link' as const, mode: 'video' },
                  { id: 'link-embed',   label: 'Embed webu',   icon: Globe,        type: 'link' as const, mode: 'embed' },
                  { id: 'link-qr',      label: 'QR kód',       icon: QrCode,       type: 'link' as const, mode: 'qr' },
                  { id: 'link-preview', label: 'Náhled webu',  icon: Layout,       type: 'link' as const, mode: 'preview' },
                ] as const).map(opt => {
                  const isActive = block.type === 'link' && (block.linkMode || 'button') === opt.mode;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        onUpdate({ type: 'link', linkMode: opt.mode as any });
                        setShowInteractiveMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium transition-colors text-left"
                      style={{
                        backgroundColor: isActive ? '#fff7ed' : undefined,
                        color: isActive ? '#f97316' : '#475569',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = ''; }}
                    >
                      <Icon className="w-3 h-3 shrink-0" />
                      {opt.label}
                    </button>
                  );
                })}

                <div className="border-t border-slate-100">
                  <button
                    onClick={() => setShowAdvancedInteractiveItems(v => !v)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 transition-colors text-left"
                  >
                    <span>Pokročilé</span>
                    {showAdvancedInteractiveItems ? (
                      <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    )}
                  </button>
                </div>

                {showAdvancedInteractiveItems && ([
                  { id: 'link-html',    label: 'HTML kód',     icon: Code2,        type: 'link' as const, mode: 'html' },
                  { id: 'link-svg',     label: 'SVG / Figma',  icon: Layers,       type: 'link' as const, mode: 'svg' },
                  { id: 'table',        label: 'Tabulka',      icon: Table2,       type: 'table' as const, mode: null },
                  { id: 'chart',        label: 'Graf a data',  icon: BarChart2,    type: 'chart' as const, mode: null },
                  { id: 'map',          label: 'Mapa',         icon: MapIcon,      type: 'map' as const,   mode: null },
                ] as const).map(opt => {
                  const isActive = opt.type === 'table'
                    ? block.type === 'table'
                    : opt.type === 'chart'
                    ? block.type === 'chart'
                    : opt.type === 'map'
                    ? block.type === 'map'
                    : block.type === 'link' && (block.linkMode || 'button') === opt.mode;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        if (opt.type === 'table') {
                          onUpdate({
                            type: 'table',
                            content: '',
                            tableData: block.tableData ?? {
                              html: '<table><thead><tr><th></th><th></th><th></th></tr></thead><tbody><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></tbody></table>',
                              hasBorder: true,
                              hasRoundedCorners: true,
                              colorStyle: 'default',
                            },
                          });
                        } else if (opt.type === 'chart') {
                          onUpdate({
                            type: 'chart',
                            content: '',
                            chartType: block.chartType ?? 'bar',
                            chartTitle: block.chartTitle ?? '',
                            chartColumns: block.chartColumns ?? ['Kategorie', 'Hodnota'],
                            chartRows: block.chartRows ?? [
                              ['Leden', '42'],
                              ['Únor', '67'],
                              ['Březen', '53'],
                              ['Duben', '88'],
                              ['Květen', '74'],
                            ],
                          });
                        } else if (opt.type === 'map') {
                          onUpdate({
                            type: 'map',
                            content: '',
                            mapData: block.mapData ?? {
                              id: crypto.randomUUID(),
                              title: 'Nová mapa',
                              region: 'europe' as const,
                              style: 'political' as const,
                              exerciseType: 'info' as const,
                              markers: [],
                              highlights: [],
                              routes: [],
                              createdAt: new Date().toISOString(),
                            },
                          });
                        } else {
                          onUpdate({ type: 'link', linkMode: opt.mode as any });
                        }
                        setShowInteractiveMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium transition-colors text-left"
                      style={{
                        backgroundColor: isActive ? '#fff7ed' : undefined,
                        color: isActive ? '#f97316' : '#475569',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = ''; }}
                    >
                      <Icon className="w-3 h-3 shrink-0" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Settings button - opens left panel */}
        <button
          onClick={() => onSettingsClick?.(block.type === 'link' ? 'link' : undefined)}
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
          block.type === 'html'
            ? 'overflow-hidden'
            : (isEditing && block.type === 'link') || (block as any).headingStyle === 'pill'
              ? 'overflow-visible'
              : 'overflow-hidden'
        } ${block.textOverflow === 'scroll' ? 'overflow-y-auto' : ''}`}
        style={{
          ...getBackgroundStyle(),
          borderRadius: (block as any).blockBorderRadius ?? borderRadius,
          ...((block as any).headingStyle === 'left-border' ? {
            borderLeft: `6px solid ${(block as any).headingStyleColor || '#3b82f6'}`,
            paddingLeft: '16px',
          } : (block as any).blockBorderLeft ? {
            borderLeft: (block as any).blockBorderLeft,
            paddingLeft: '16px',
          } : {}),
          padding: block.type === 'html'
            ? '0'
            : block.type === 'link' && !isEditing && (block.linkMode === 'video' || block.linkMode === 'embed') 
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
            {/* HTML-formatted text (from worksheet sync with bold/marks/highlights) */}
            {(block as any).contentFormat === 'html' ? (
              <div
                className="w-full overflow-y-auto"
                style={{
                  height: '100%',
                  fontSize: getFontSize(),
                  fontFamily: getFontFamily(),
                  lineHeight: block.lineHeight ?? 1.65,
                  letterSpacing: `${block.letterSpacing ?? 0}px`,
                  color: getEffectiveTextColor(),
                  overflowWrap: 'break-word',
                  wordBreak: 'normal',
                }}
                dangerouslySetInnerHTML={{ __html: block.content || '' }}
              />
            ) : isEditing ? (
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
                  ${(block.fontFamily !== 'cooper' && block.fontWeight === 'bold') ? 'font-bold' : 'font-normal'}
                  ${block.fontStyle === 'italic' ? 'italic' : ''}
                  ${block.textDecoration === 'underline' ? 'underline' : ''}
                `}
                style={{
                  fontSize: !block.content
                    ? (((block.textOverflow === 'fit' || block.textOverflow === undefined) && fitFontSize) ? `${fitFontSize}px` : '24px')
                    : ((block.textOverflow === 'fit' || block.textOverflow === undefined) && fitFontSize ? `${fitFontSize}px` : getFontSize()),
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
                  ${(block.fontFamily !== 'cooper' && block.fontWeight === 'bold') ? 'font-bold' : 'font-normal'}
                  ${block.fontStyle === 'italic' ? 'italic' : ''}
                  ${block.textDecoration === 'underline' ? 'underline' : ''}
                  ${!block.content ? 'text-slate-400' : ''}
                `}
                style={{
                  fontSize: !block.content
                    ? (((block.textOverflow === 'fit' || block.textOverflow === undefined) && fitFontSize) ? `${fitFontSize}px` : '24px')
                    : ((block.textOverflow === 'fit' || block.textOverflow === undefined) && fitFontSize ? `${fitFontSize}px` : getFontSize()),
                  fontFamily: getFontFamily(),
                  color: !block.content ? '#94a3b8' : getEffectiveTextColor(),
                  backgroundColor: block.highlightColor && block.highlightColor !== 'transparent' ? block.highlightColor : 'transparent',
                  lineHeight: block.lineHeight ?? 1.5,
                  letterSpacing: `${block.letterSpacing ?? 0}px`,
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'break-word',
                  wordBreak: 'normal',
                  hyphens: 'none',
                }}
              >
                {(block as any).headingStyle === 'pill' ? (
                  <div style={{ width: '100%', textAlign: block.textAlign || 'center', overflow: 'visible' }}>
                    <span style={{
                      display: 'inline-block',
                      backgroundColor: (block as any).headingStyleColor || '#e0f2fe',
                      padding: '6px 20px',
                      borderRadius: '10px',
                    }}>
                      {block.content ? preventOrphans(block.content) : placeholder}
                    </span>
                  </div>
                ) : (
                  block.content ? preventOrphans(block.content) : placeholder
                )}
              </div>
            )}
          </>
        )}

        {/* Table block */}
        {block.type === 'table' && (
          <div className="h-full w-full p-2" style={{ overflow: 'visible' }}>
            <VividTableBlock
              data={block.tableData ?? { html: '', hasBorder: true, hasRoundedCorners: true }}
              onChange={(data) => onUpdate({ tableData: data })}
              editable={true}
            />
          </div>
        )}

        {block.type === 'chart' && (
          <InlineChartEditor block={block} onUpdate={onUpdate} />
        )}

        {block.type === 'map' && (
          <InlineMapEditor block={block} onUpdate={onUpdate} />
        )}

        {/* html linkMode is rendered inside the link block section below */}

        {block.type === 'image' && (
          <div className={`h-full overflow-hidden ${isGalleryGrid(block) && block.gallery && block.gallery.length > 0 ? 'flex flex-col' : 'flex items-center justify-center'}`}>
            {(() => {
              // Grid mode — render all images as a grid
              if (isGalleryGrid(block) && block.gallery && block.gallery.length > 0) {
                return (
                  <GalleryGridPreview
                    images={block.gallery}
                    captions={(block as any).galleryCaptions}
                    shape={(block as any).galleryItemShape}
                    borderRadius={(block as any).galleryBorderRadius}
                    strokeColor={(block as any).galleryStrokeColor}
                    strokeWidth={(block as any).galleryStrokeWidth}
                    rotate={(block as any).galleryRotate}
                    rotateMax={(block as any).galleryRotateMax}
                    labelType={(block as any).galleryLabelType}
                    labelColor={(block as any).galleryLabelColor}
                    cols={(block as any).galleryGridColumns ?? 2}
                    itemHeight={(block as any).galleryContainerHeight ?? 200}
                    fillHeight={true}
                    caption={block.imageCaption}
                    interactive={false}
                  />
                );
              }

              // Get current image - from gallery or single content
              const hasGallery = block.gallery && block.gallery.length > 0;
              const galleryLength = block.gallery?.length || 0;
              const currentIndex = block.galleryIndex || 0;
              const currentImage = hasGallery 
                ? block.gallery![currentIndex] 
                : block.content;
              // Per-image caption: prefer galleryCaptions[idx], fall back to block.imageCaption
              const galleryCaptions = (block as any).galleryCaptions as string[] | undefined;
              const currentCaption = (galleryCaptions?.[currentIndex]) || block.imageCaption || '';
              
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
                    {currentCaption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-sm px-3 py-2 text-center pointer-events-none z-30">
                        {currentCaption}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative flex flex-col items-center justify-center w-full h-full">
                    <img
                      src={displayImage}
                      alt={currentCaption}
                      className="rounded-lg transition-transform"
                      style={{
                        maxWidth: `${imageScale}%`,
                        maxHeight: `${imageScale}%`,
                        objectFit: 'contain',
                      }}
                    />
                    {renderNavigation(false)}
                    {/* Caption */}
                    {currentCaption && (
                      <div className="text-slate-600 text-sm mt-2 text-center px-2">
                        {currentCaption}
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

        {/* Backward compat: old blocks saved as type='html' render as linkMode='html' */}
        {(block as any).type === 'html' && (
          <div style={{ position: 'absolute', inset: 0 }}>
            {block.content ? (
              <ScaledHtmlBlock html={block.content} mode="scroll" style={{ position: 'absolute', inset: 0 }} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                <Code2 className="w-8 h-8" />
                <span className="text-sm">HTML blok (starý formát)</span>
              </div>
            )}
          </div>
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
              const isHtmlMode = block.linkMode === 'html';
              if (!isHtmlMode && !isValidMediaUrl(block.content) && !isEditing) {
                return (
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Link2 className="w-8 h-8" />
                    <span className="text-sm">Vložte odkaz</span>
                  </div>
                );
              }

              if (isEditing && !isHtmlMode) {
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
                            if (m === 'html') return <Code2 className="w-3 h-3 text-indigo-500 shrink-0" />;
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
                              if (m === 'html') return 'HTML (1:1)';
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
                            { id: 'html', label: 'HTML (1:1)', icon: Code2 },
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
              const url = normalizeLinkUrl(block.content);

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
                  return (
                    <div 
                      className="absolute inset-0 w-full h-full overflow-hidden bg-slate-50"
                      style={{ borderRadius }}
                    >
                      <iframe
                        src={url}
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

                case 'html':
                  return block.content ? (
                    <ScaledHtmlBlock
                      html={block.content}
                      mode="scroll"
                      style={{ position: 'absolute', inset: 0 }}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                      <Code2 className="w-8 h-8" />
                      <span className="text-sm">Vložte HTML kód v nastavení bloku</span>
                    </div>
                  );

                case 'svg':
                  return block.content ? (
                    <div
                      className="h-full w-full flex items-center justify-center overflow-hidden p-2"
                      dangerouslySetInnerHTML={{ __html: block.content }}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                      <Layers className="w-8 h-8" />
                      <span className="text-sm">Vložte SVG kód v nastavení bloku</span>
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
        datasetImages={datasetImages}
      />
    </div>
  );
}

// ─── Inline Chart Editor ────────────────────────────────────────────────────
const CHART_PALETTE_ED = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a78bfa', '#34d399', '#fb923c'];
const CHART_CAT_COLORS_ED: Record<string, string> = { válka: '#ef4444', politika: '#6366f1', kultura: '#f59e0b', ekonomika: '#10b981', věda: '#22d3ee', náboženství: '#a78bfa' };

const CHART_TYPES_ED = [
  { id: 'bar',      label: 'Sloupce',  emoji: '📊' },
  { id: 'line',     label: 'Linie',    emoji: '📈' },
  { id: 'area',     label: 'Oblast',   emoji: '🌊' },
  { id: 'pie',      label: 'Koláč',    emoji: '🥧' },
  { id: 'radar',    label: 'Pavučina', emoji: '🕸️' },
  { id: 'timeline', label: 'Timeline', emoji: '⏳' },
] as const;

function InlineChartEditor({ block, onUpdate }: { block: SlideBlock; onUpdate: (u: Partial<SlideBlock>) => void }) {
  const type = block.chartType ?? 'bar';
  const isTimeline = type === 'timeline';
  const cols: string[] = block.chartColumns ?? ['Kategorie', 'Hodnota'];
  const rows: string[][] = block.chartRows ?? [
    ['Leden', '42'],
    ['Únor', '67'],
    ['Březen', '53'],
    ['Duben', '88'],
    ['Květen', '74'],
  ];
  const dataKeys = cols.slice(1);

  const setRows = (r: string[][]) => onUpdate({ chartRows: r });
  const setCols = (c: string[]) => onUpdate({ chartColumns: c });
  const setType = (t: typeof CHART_TYPES_ED[number]['id']) => {
    if (t === 'timeline') {
      onUpdate({ chartType: t, chartColumns: ['Rok/Období', 'Popis', 'Kategorie'], chartRows: rows.map(r => [r[0] ?? '', r[1] ?? '', r[2] ?? '']) });
    } else if (isTimeline) {
      onUpdate({ chartType: t, chartColumns: ['Kategorie', 'Hodnota'], chartRows: rows.map(r => [r[0] ?? '', r[1] ?? '']) });
    } else {
      onUpdate({ chartType: t });
    }
  };

  const updateCell = (ri: number, ci: number, val: string) => {
    const r = rows.map(row => [...row]);
    r[ri][ci] = val;
    setRows(r);
  };

  const addRow = () => setRows([...rows, new Array(cols.length).fill('')]);
  const removeRow = (ri: number) => setRows(rows.filter((_, i) => i !== ri));
  const addSeries = () => { const c = [...cols, `Řada ${cols.length}`]; setCols(c); setRows(rows.map(r => [...r, ''])); };
  const removeSeries = () => { if (cols.length <= 2) return; setCols(cols.slice(0, -1)); setRows(rows.map(r => r.slice(0, -1))); };
  const updateCol = (ci: number, val: string) => { const c = [...cols]; c[ci] = val; setCols(c); };

  // Build recharts data
  const chartData = rows.map(row => {
    const obj: any = { name: row[0] || '' };
    dataKeys.forEach((k, i) => { obj[k] = parseFloat(row[i + 1]) || 0; });
    return obj;
  });
  const hasData = rows.some(r => r.some(c => c.trim()));
  const tt = { borderRadius: 8, fontSize: 10, border: '1px solid #e2e8f0', background: '#fff' };

  const renderChart = () => {
    if (!hasData) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 11 }}>Vyplň data v tabulce →</div>;
    if (type === 'timeline') return (
      <div style={{ overflowY: 'auto', height: '100%', paddingLeft: 22, paddingRight: 8, paddingTop: 6, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 3, background: 'linear-gradient(to bottom,#6366f1,#22d3ee)', borderRadius: 99 }} />
        {rows.map((row, i) => { const color = CHART_CAT_COLORS_ED[(row[2] || '').toLowerCase()] || CHART_PALETTE_ED[i % CHART_PALETTE_ED.length]; return (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, position: 'relative' }}>
            <div style={{ position: 'absolute', left: -20, top: 4, width: 10, height: 10, borderRadius: '50%', backgroundColor: color, border: '2px solid white', boxShadow: `0 0 0 2px ${color}` }} />
            <div style={{ background: 'white', borderRadius: 8, padding: '4px 8px', border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`, flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color }}>{row[0]}</div>
              <div style={{ fontSize: 10, color: '#334155', lineHeight: 1.3 }}>{row[1]}</div>
            </div>
          </div>
        ); })}
      </div>
    );
    if (type === 'pie') return <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData.map(d => ({ name: d.name, value: d[dataKeys[0]] || 0 }))} cx="50%" cy="50%" outerRadius="65%" innerRadius="25%" paddingAngle={3} dataKey="value">{chartData.map((_: any, i: number) => <Cell key={i} fill={CHART_PALETTE_ED[i % CHART_PALETTE_ED.length]} />)}</Pie><Tooltip contentStyle={tt} /></PieChart></ResponsiveContainer>;
    if (type === 'line') return <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 4, right: 8, left: -22, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip contentStyle={tt} />{dataKeys.map((k: string, i: number) => <Line key={k} type="monotone" dataKey={k} stroke={CHART_PALETTE_ED[i]} strokeWidth={2.5} dot={{ r: 3 }} />)}</LineChart></ResponsiveContainer>;
    if (type === 'area') return <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 4, right: 8, left: -22, bottom: 4 }}><defs>{dataKeys.map((k: string, i: number) => <linearGradient key={k} id={`ie${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={CHART_PALETTE_ED[i]} stopOpacity={0.3} /><stop offset="95%" stopColor={CHART_PALETTE_ED[i]} stopOpacity={0} /></linearGradient>)}</defs><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip contentStyle={tt} />{dataKeys.map((k: string, i: number) => <Area key={k} type="monotone" dataKey={k} stroke={CHART_PALETTE_ED[i]} strokeWidth={2} fill={`url(#ie${i})`} />)}</AreaChart></ResponsiveContainer>;
    if (type === 'radar') return <ResponsiveContainer width="100%" height="100%"><RadarChart data={chartData}><PolarGrid stroke="#e2e8f0" /><PolarAngleAxis dataKey="name" tick={{ fontSize: 9 }} />{dataKeys.map((k: string, i: number) => <Radar key={k} dataKey={k} stroke={CHART_PALETTE_ED[i]} fill={CHART_PALETTE_ED[i]} fillOpacity={0.25} />)}<Tooltip contentStyle={tt} /></RadarChart></ResponsiveContainer>;
    return <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 4, right: 8, left: -22, bottom: 4 }} barCategoryGap="8%"><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip contentStyle={tt} />{dataKeys.map((k: string, i: number) => (<Bar key={k} dataKey={k} fill={CHART_PALETTE_ED[i]} radius={[5, 5, 0, 0]}>{dataKeys.length === 1 && chartData.map((_: any, idx: number) => <Cell key={idx} fill={CHART_PALETTE_ED[idx % CHART_PALETTE_ED.length]} />)}</Bar>))}</BarChart></ResponsiveContainer>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#f8fafc' }}>
      {/* Top bar: type selector + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'white', borderBottom: '1px solid #e2e8f0', flexShrink: 0, flexWrap: 'wrap' }}>
        {CHART_TYPES_ED.map(ct => (
          <button
            key={ct.id}
            onClick={() => setType(ct.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 8,
              border: `2px solid ${type === ct.id ? '#6366f1' : '#e2e8f0'}`,
              background: type === ct.id ? '#eef2ff' : 'white',
              color: type === ct.id ? '#4338ca' : '#64748b',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 12 }}>{ct.emoji}</span> {ct.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <input
          value={block.chartTitle ?? ''}
          onChange={e => onUpdate({ chartTitle: e.target.value })}
          placeholder="Název grafu…"
          style={{ fontSize: 11, padding: '3px 8px', border: '1px solid #e2e8f0', borderRadius: 6, width: 130, outline: 'none', color: '#334155' }}
        />
      </div>

      {/* Body: table left, chart right */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Data table */}
        <div style={{ width: '42%', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', background: 'white' }}>
          <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
            {/* Column headers */}
            <div style={{ display: 'flex', gap: 3, marginBottom: 4, alignItems: 'center' }}>
              {cols.map((col, ci) => (
                <input
                  key={ci}
                  value={col}
                  onChange={e => updateCol(ci, e.target.value)}
                  style={{
                    flex: 1, minWidth: 0, fontSize: 10, fontWeight: 700, padding: '3px 6px',
                    border: '1px solid #c7d2fe', borderRadius: 5, background: '#eef2ff', color: '#4338ca', outline: 'none',
                  }}
                  placeholder={ci === 0 ? 'Kategorie' : `Řada ${ci}`}
                />
              ))}
              {!isTimeline && (
                <>
                  <button onClick={addSeries} style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: '1px dashed #c7d2fe', color: '#6366f1', background: 'white', cursor: 'pointer' }} title="Přidat řadu"><Plus style={{ width: 10, height: 10 }} /></button>
                  {cols.length > 2 && <button onClick={removeSeries} style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: '1px dashed #fca5a5', color: '#ef4444', background: 'white', cursor: 'pointer' }} title="Odebrat řadu"><Trash2 style={{ width: 10, height: 10 }} /></button>}
                </>
              )}
            </div>
            {/* Rows */}
            {rows.map((row, ri) => (
              <div key={ri} style={{ display: 'flex', gap: 3, marginBottom: 3, alignItems: 'center' }}>
                {row.map((cell, ci) => (
                  <input
                    key={ci}
                    value={cell}
                    onChange={e => updateCell(ri, ci, e.target.value)}
                    style={{ flex: 1, minWidth: 0, fontSize: 10, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 5, background: ri % 2 === 0 ? '#f8fafc' : 'white', color: '#334155', outline: 'none' }}
                    placeholder={ci === 0 ? (isTimeline ? 'Rok' : 'Název') : ci === 1 && isTimeline ? 'Popis' : isTimeline ? 'Kategorie' : '0'}
                  />
                ))}
                <button onClick={() => removeRow(ri)} style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: 'none', background: 'transparent', color: '#cbd5e1', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={e => (e.currentTarget.style.color = '#cbd5e1')}><Trash2 style={{ width: 10, height: 10 }} /></button>
              </div>
            ))}
          </div>
          {/* Add row */}
          <button
            onClick={addRow}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px', fontSize: 10, color: '#6366f1', background: '#f8fafc', border: 'none', borderTop: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 600 }}
          >
            <Plus style={{ width: 10, height: 10 }} /> Přidat řádek
          </button>
        </div>

        {/* Chart preview */}
        <div style={{ flex: 1, minWidth: 0, padding: type === 'timeline' ? '8px 8px 8px 26px' : 8, overflow: 'hidden', position: 'relative' }}>
          {block.chartTitle && <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', textAlign: 'center', marginBottom: 4 }}>{block.chartTitle}</div>}
          <div style={{ height: block.chartTitle ? 'calc(100% - 20px)' : '100%' }}>
            {renderChart()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Map Editor ────────────────────────────────────────────────────────
const REGION_OPTIONS: { value: string; label: string }[] = [
  { value: 'world', label: '🌍 Svět' },
  { value: 'europe', label: '🗺️ Evropa' },
  { value: 'central-europe', label: '🗺️ Střední Evropa' },
  { value: 'mediterranean', label: '🌊 Středomoří' },
  { value: 'middle-east', label: '🏜️ Blízký východ' },
  { value: 'africa', label: '🌍 Afrika' },
  { value: 'asia', label: '🌏 Asie' },
  { value: 'americas', label: '🌎 Amerika' },
  { value: 'czech-republic', label: '🇨🇿 Česko' },
  { value: 'italy', label: '🇮🇹 Itálie' },
  { value: 'greece', label: '🇬🇷 Řecko' },
  { value: 'france', label: '🇫🇷 Francie' },
  { value: 'germany', label: '🇩🇪 Německo' },
];

const STYLE_OPTIONS: { value: string; label: string; group: 'primary' | 'advanced' }[] = [
  { value: 'blank_pure', label: '⬜ Slepá (GeoJSON)', group: 'primary' },
  { value: 'political',  label: '🗺️ Politická (CartoDB)', group: 'primary' },
  { value: 'physical',   label: '⛰️ Fyzická (terén)', group: 'advanced' },
  { value: 'historical', label: '📜 Historická', group: 'advanced' },
  { value: 'blank',      label: '🔲 Slepá (Esri)', group: 'advanced' },
  { value: 'satellite',  label: '🛰️ Satelit', group: 'advanced' },
  { value: 'dark',       label: '🌑 Tmavá', group: 'advanced' },
];

const EXERCISE_OPTIONS: { value: string; label: string }[] = [
  { value: 'info', label: '🗺️ Informativní' },
  { value: 'identify', label: '🎯 Kvíz – klikni' },
  { value: 'label', label: '✍️ Označování' },
  { value: 'color', label: '🎨 Barvení regionů' },
  { value: 'route', label: '📍 Trasa' },
];

function InlineMapEditor({ block, onUpdate }: { block: SlideBlock; onUpdate: (u: Partial<SlideBlock>) => void }) {
  const [showDataPanel, setShowDataPanel] = React.useState(false);
  const [showAdvancedStyles, setShowAdvancedStyles] = React.useState(false);
  const map: SavedMap = block.mapData ?? {
    id: block.id,
    title: 'Nová mapa',
    region: 'europe' as const,
    style: 'blank_pure' as const,
    exerciseType: 'identify' as const,
    markers: [],
    highlights: [],
    routes: [],
    createdAt: new Date().toISOString(),
  };

  const updateMap = (updated: SavedMap) => onUpdate({ mapData: updated });

  const primaryStyles = STYLE_OPTIONS.filter(o => o.group === 'primary');
  const advancedStyles = STYLE_OPTIONS.filter(o => o.group === 'advanced');
  const isAdvancedActive = advancedStyles.some(o => o.value === map.style);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#f8fafc' }}>
      {/* Toolbar – řádek 1: region + cvičení + toggle panel */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'white', borderBottom: '1px solid #f1f5f9', flexShrink: 0, flexWrap: 'wrap' }}>
        <select
          value={map.region}
          onChange={e => updateMap({ ...map, region: e.target.value as any })}
          style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white' }}
        >
          {REGION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={map.exerciseType}
          onChange={e => updateMap({ ...map, exerciseType: e.target.value as any })}
          style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white' }}
        >
          {EXERCISE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowDataPanel(v => !v)}
          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #c7d2fe', background: showDataPanel ? '#eef2ff' : 'white', color: '#6366f1', fontWeight: 600, cursor: 'pointer' }}
        >
          {showDataPanel ? '🗺️ Mapa' : '✏️ Editovat data'}
        </button>
      </div>

      {/* Toolbar – řádek 2: styl mapy + vrstvy */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'white', borderBottom: '1px solid #e2e8f0', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginRight: 2 }}>Styl</span>
        {primaryStyles.map(o => (
          <button key={o.value} onClick={() => updateMap({ ...map, style: o.value as any })}
            style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 600, cursor: 'pointer',
              border: `1.5px solid ${map.style === o.value ? '#6366f1' : '#e2e8f0'}`,
              background: map.style === o.value ? '#eef2ff' : '#f8fafc',
              color: map.style === o.value ? '#4338ca' : '#64748b',
              transition: 'all .12s',
            }}
          >{o.label}</button>
        ))}
        <button
          onClick={() => setShowAdvancedStyles(v => !v)}
          style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 600, cursor: 'pointer',
            border: `1.5px solid ${isAdvancedActive ? '#6366f1' : '#e2e8f0'}`,
            background: isAdvancedActive ? '#eef2ff' : 'transparent',
            color: isAdvancedActive ? '#4338ca' : '#94a3b8',
          }}
        >{showAdvancedStyles ? '▲' : (isAdvancedActive ? `${advancedStyles.find(o => o.value === map.style)?.label ?? 'Další'} ▾` : '▼ Další')}</button>
        {showAdvancedStyles && advancedStyles.map(o => (
          <button key={o.value} onClick={() => { updateMap({ ...map, style: o.value as any }); setShowAdvancedStyles(false); }}
            style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 600, cursor: 'pointer',
              border: `1.5px solid ${map.style === o.value ? '#6366f1' : '#e2e8f0'}`,
              background: map.style === o.value ? '#eef2ff' : '#f8fafc',
              color: map.style === o.value ? '#4338ca' : '#64748b',
            }}
          >{o.label}</button>
        ))}

        {/* Oddělovač */}
        <span style={{ width: 1, height: 16, background: '#e2e8f0', margin: '0 4px' }} />

        {/* Vrstvy — jen pro kvíz mód (QuizMap) */}
        {map.exerciseType !== 'info' && (() => {
          const groups: { label: string; layers: { key: keyof import('../../types/topic-dataset').SavedMapOverlays; label: string; color: string }[] }[] = [
            { label: 'Hydrografie', layers: [
              { key: 'showRivers',   label: '〰 Řeky',   color: '#5eabf0' },
              { key: 'showLakes',    label: '💧 Jezera',  color: '#3a7ab8' },
              { key: 'showOceans',   label: '🌊 Moře',   color: '#4a90c8' },
            ]},
            { label: 'Reliéf', layers: [
              { key: 'showPhysical', label: '🏔 Reliéf',  color: '#b8956a' },
              { key: 'showClimate',  label: '🌡 Klima',   color: '#f59e0b' },
              { key: 'showBiomes',   label: '🌿 Biomy',   color: '#22c55e' },
            ]},
            { label: 'Geologie', layers: [
              { key: 'showTectonics',   label: '🌍 Tektonika',     color: '#e11d48' },
              { key: 'showVolcanoes',   label: '🌋 Vulkány',       color: '#dc2626' },
              { key: 'showEarthquakes', label: '📡 Zemětřesení',   color: '#f97316' },
            ]},
            { label: 'Lidská geografie', layers: [
              { key: 'showCities',    label: '🏙 Města',     color: '#e11d48' },
              { key: 'showAirports',  label: '✈ Letiště',   color: '#7c3aed' },
              { key: 'showRailroads', label: '🚂 Železnice', color: '#64748b' },
              { key: 'showTimezones', label: '🕐 Čas. zóny', color: '#0ea5e9' },
            ]},
          ];
          return (
            <>
              {groups.map(group => (
                <React.Fragment key={group.label}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginLeft: 2 }}>{group.label}</span>
                  {group.layers.map(({ key, label, color }) => {
                    const active = (map.overlays as any)?.[key] ?? false;
                    return (
                      <button key={key}
                        onClick={() => updateMap({ ...map, overlays: { ...(map.overlays ?? {}), [key]: !active } })}
                        style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 99, fontWeight: 600, cursor: 'pointer',
                          border: `1.5px solid ${active ? color : '#e2e8f0'}`,
                          background: active ? `${color}18` : '#f8fafc',
                          color: active ? color : '#64748b',
                          transition: 'all .12s',
                        }}
                      >{label}</button>
                    );
                  })}
                </React.Fragment>
              ))}
            </>
          );
        })()}
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {showDataPanel ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            <MapDataEditor map={map} onUpdate={updateMap} />
          </div>
        ) : (
          <div style={{ flex: 1, padding: 8, overflow: 'hidden' }}>
            {map.exerciseType === 'info' ? (
              <VividMap map={map} height={320} />
            ) : (
              <QuizMap map={map} height={320} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SlideBlockEditor;
