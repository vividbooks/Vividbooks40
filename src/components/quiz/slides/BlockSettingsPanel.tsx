/**
 * BlockSettingsPanel
 * 
 * Left panel for editing individual block settings.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Palette,
  Upload,
  Type,
  Image as ImageIcon,
  Link2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Plus,
  Trash2,
  Images,
  Sparkles,
  QrCode,
  ExternalLink,
  Globe,
  Youtube,
  Layout,
  MessageSquare,
  Code2,
  MousePointer,
  Layers,
  Volume2,
} from 'lucide-react';
import { SlideBlock, SlideBlockType } from '../../../types/quiz';
import { BackgroundPicker } from './BackgroundPicker';
import { getContrastColor } from '../../../utils/color-utils';
import { AssetPicker } from '../../shared/AssetPicker';
import type { AssetPickerResult } from '../../../types/assets';
import { useFileStorage } from '../../../hooks/useFileStorage';
import { toast } from 'sonner';

const AlignTopIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 3h16"/>
    <rect width="12" height="6" x="6" y="7" rx="1"/>
    <path d="M8 17h8"/>
  </svg>
);

const AlignMiddleIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 12h16"/>
    <rect width="12" height="6" x="6" y="4" rx="1"/>
    <rect width="12" height="6" x="6" y="14" rx="1"/>
  </svg>
);

const AlignBottomIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 21h16"/>
    <rect width="12" height="6" x="6" y="11" rx="1"/>
    <path d="M8 7h8"/>
  </svg>
);

const ColorIcon = ({ className = "w-5 h-5 text-slate-400" }: { className?: string }) => (
  <svg width="21" height="19" viewBox="0 0 21 19" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g>
      <path d="M4.15823 17.3472H0.835443C0.379747 17.3472 0 17.7186 0 18.1644C0 18.6101 0.379747 18.9816 0.835443 18.9816H4.13924C4.59494 18.9816 4.97468 18.6101 4.97468 18.1644C4.97468 17.7186 4.59494 17.3472 4.13924 17.3472H4.15823Z" fill="currentColor"/>
      <path d="M16.6899 0L14.1076 5.99902C14.1076 5.99902 14.1646 5.99902 14.2025 5.99902C15.8734 5.99902 17.3544 6.70479 18.3987 7.80059L20.981 1.78299L16.6709 0.0185728L16.6899 0Z" fill="currentColor"/>
      <path d="M14.2025 7.52197C11.8861 7.52197 10.0063 9.36068 10.0063 11.6266C10.0063 14.3939 9.91138 17.4027 6.70252 17.4213C6.2848 17.4213 5.94302 17.7556 5.94302 18.1828C5.94302 18.6099 6.2848 18.9257 6.70252 18.9443C15.8544 18.9443 18.3987 13.911 18.3987 11.6451C18.3987 9.37925 16.519 7.54055 14.2025 7.54055V7.52197Z" fill="currentColor"/>
    </g>
  </svg>
);

function ToggleSwitch({
  checked,
  onToggle,
  label,
  labelClassName = 'text-sm text-slate-600',
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  labelClassName?: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        className="relative inline-flex shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
        style={{
          width: 40,
          height: 24,
          padding: 2,
          backgroundColor: checked ? '#6366f1' : '#e5e7eb',
        }}
      >
        <span
          className="pointer-events-none block rounded-full bg-white shadow-sm transition-transform"
          style={{
            width: 20,
            height: 20,
            transform: checked ? 'translateX(16px)' : 'translateX(0)',
          }}
        />
      </button>
      <span className={labelClassName}>{label}</span>
    </label>
  );
}

function getSidebarChoiceButtonClass(active: boolean, layout: 'row' | 'tile' = 'row') {
  const base =
    layout === 'row'
      ? 'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl transition-all'
      : 'flex flex-col items-center justify-center gap-2 p-3 rounded-2xl transition-all';

  return `${base} ${
    active
      ? 'text-white shadow-sm'
      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
  }`;
}

function getSidebarActionButtonClass() {
  return 'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all';
}

function getSidebarChoiceButtonStyle(active: boolean): React.CSSProperties | undefined {
  return active ? { backgroundColor: '#59627B' } : undefined;
}

interface BlockSettingsPanelProps {
  block: SlideBlock;
  blockIndex: number;
  onUpdate: (updates: Partial<SlideBlock>) => void;
  onClose: () => void;
  onImageUpload: (file: File) => void;
  onGalleryImageUpload?: (files: File[]) => void;
  initialSection?: string;
  onPaddingPreview?: () => void;
  datasetImages?: Array<{ url: string; title?: string; alt?: string }>;
}

export function BlockSettingsPanel({
  block,
  blockIndex,
  onUpdate,
  onClose,
  onImageUpload,
  onPaddingPreview,
  onGalleryImageUpload,
  initialSection,
  datasetImages,
}: BlockSettingsPanelProps) {
  const { uploadFile } = useFileStorage();
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    const saved = localStorage.getItem('vividboard-recent-colors');
    const colors = saved ? JSON.parse(saved) : [];
    // Ensure we have at least some default colors if empty
    return colors.length > 0 ? colors : ['#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1'];
  });

  const updateRecentColors = (color: string) => {
    if (!color || color === 'transparent') return;
    const newRecent = [color, ...recentColors.filter(c => c !== color)].slice(0, 10);
    setRecentColors(newRecent);
    localStorage.setItem('vividboard-recent-colors', JSON.stringify(newRecent));
  };

  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (initialSection) {
      initial.add(initialSection);
    } else {
      initial.add('type');
      if (block.type === 'image' || block.type === 'lottie') initial.add('image');
      if (block.type === 'text') initial.add('format');
    }
    return initial;
  });
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const backgroundSectionRef = useRef<HTMLDivElement>(null);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [assetPickerMode, setAssetPickerMode] = useState<'single' | 'gallery' | 'thumbnail'>('single');
  const [showFontDropdown, setShowFontDropdown] = useState(false);

  // Update expanded sections when initialSection prop changes
  useEffect(() => {
    if (initialSection) {
      setExpandedSections(new Set([initialSection]));
      if (initialSection === 'background') {
        setTimeout(() => {
          backgroundSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [initialSection]);

  const expandedSection = (section: string) => expandedSections.has(section);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleTypeChange = (newType: SlideBlockType) => {
    onUpdate({ type: newType });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageUpload(file);
    }
  };

  const handleGalleryFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const toastId = toast.loading(`Nahrávám ${files.length} ${files.length === 1 ? 'obrázek' : 'obrázků'}...`);
      
      try {
        const uploadPromises = files.map(file => uploadFile(file));
        const results = await Promise.all(uploadPromises);
        
        const successfulUrls = results
          .filter(r => r.success && r.file)
          .map(r => r.file!.filePath);
        
        if (successfulUrls.length > 0) {
          const currentGallery = block.gallery || (block.content ? [block.content] : []);
          onUpdate({ 
            gallery: [...currentGallery, ...successfulUrls],
            galleryIndex: currentGallery.length > 0 ? block.galleryIndex : 0
          });
          
          if (successfulUrls.length === files.length) {
            toast.success('Všechny obrázky nahrány', { id: toastId });
          } else {
            toast.warning(`Nahráno ${successfulUrls.length} z ${files.length} obrázků`, { id: toastId });
          }
        } else {
          toast.error('Nepodařilo se nahrát žádný obrázek', { id: toastId });
        }
      } catch (err) {
        console.error('Gallery upload error:', err);
        toast.error('Chyba při nahrávání galerie', { id: toastId });
      }
    }
  };

  const removeGalleryImage = (index: number) => {
    const newGallery = [...(block.gallery || [])];
    newGallery.splice(index, 1);
    
    if (newGallery.length === 0) {
      // No images left
      onUpdate({ gallery: undefined, galleryIndex: undefined, content: '', galleryNavType: undefined });
    } else if (newGallery.length === 1) {
      // Only one image left - convert back to single image mode
      onUpdate({ 
        gallery: undefined, 
        galleryIndex: undefined, 
        content: newGallery[0],
        galleryNavType: undefined 
      });
    } else {
      const newIndex = Math.min(block.galleryIndex || 0, newGallery.length - 1);
      onUpdate({ gallery: newGallery, galleryIndex: newIndex });
    }
  };

  const createGallery = () => {
    // If there's already a single image, convert it to gallery
    if (block.content && !block.gallery) {
      onUpdate({ gallery: [block.content], galleryIndex: 0 });
    }
    galleryInputRef.current?.click();
  };

  const isLottie = (url?: string) => {
    if (!url) return false;
    return url.toLowerCase().endsWith('.json') || url.includes('lottie');
  };

  // Handle asset selection from AssetPicker
  const handleAssetSelect = (result: AssetPickerResult) => {
    if (assetPickerMode === 'thumbnail') {
      onUpdate({ linkThumbnail: result.url });
    } else {
      const isLottieAsset = isLottie(result.url);
      const newType = isLottieAsset ? 'lottie' : 'image';

      if (assetPickerMode === 'gallery') {
        // Add to gallery - currently gallery only supports images, but we'll allow adding both if possible
        // (Rendering might need adjustment if gallery mixed, but for now focus on single media)
        const currentGallery = block.gallery || (block.content ? [block.content] : []);
        onUpdate({ 
          gallery: [...currentGallery, result.url],
          galleryIndex: currentGallery.length > 0 ? block.galleryIndex : 0
        });
      } else {
        // Single media - replace current
        onUpdate({ 
          type: newType,
          content: result.url, 
          lottieUrl: isLottieAsset ? result.url : undefined,
          gallery: undefined, 
          galleryIndex: undefined 
        });
      }
    }
    setShowAssetPicker(false);
  };

  const openAssetPicker = (mode: 'single' | 'gallery' | 'thumbnail') => {
    setAssetPickerMode(mode);
    setShowAssetPicker(true);
  };

  const getBlockTypeName = () => {
    switch (block.type) {
      case 'text': return 'Text';
      case 'image': return 'Obrázek';
      case 'lottie': return 'Animace';
      case 'link': return 'Odkaz';
      default: return 'Text';
    }
  };

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const identifyLink = (url: string) => {
    if (!url) return;
    
    // YouTube identification
    const youtubeId = getYoutubeId(url);
    if (youtubeId) {
      onUpdate({ 
        linkMode: 'video',
        linkTitle: block.linkTitle || 'Přehrát video',
        linkThumbnail: block.linkThumbnail || `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`
      });
      return;
    }

    // Wikipedia identification
    if (url.includes('wikipedia.org')) {
      onUpdate({ 
        linkMode: 'preview',
        linkTitle: block.linkTitle || 'Wikipedia',
        linkDescription: block.linkDescription || 'Otevřená encyklopedie'
      });
      return;
    }

    // Default to button if not special
    if (!block.linkMode) {
      onUpdate({ linkMode: 'button' });
    }
  };

  const imageFit = block.imageFit || 'contain';
  const imageScale = block.imageScale || 100;
  const hasGallery = block.gallery && block.gallery.length > 1;

  return (
    <div
      className="flex flex-col overflow-hidden"
      data-settings-panel="block"
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '420px',
        height: '100%',
        backgroundColor: 'white',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        zIndex: 999999,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50">
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Nastavení bloku</h2>
          <p className="text-xs text-slate-500">Blok {blockIndex + 1}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Block Type */}
        <div className="border-b border-slate-100">
          <button
            onClick={() => toggleSection('type')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Type className="w-5 h-5 text-slate-400" />
              <span className="font-medium text-slate-700">Typ bloku</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">{getBlockTypeName()}</span>
              {expandedSection('type') ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </button>

          {expandedSection('type') && (
            <div className="px-5 pb-4">
              <div className="flex gap-2">
                <button
                  onClick={() => handleTypeChange('text')}
                  className={getSidebarChoiceButtonClass(block.type === 'text')}
                  style={getSidebarChoiceButtonStyle(block.type === 'text')}
                >
                  <Type className="w-5 h-5" />
                  <span className="font-medium">Text</span>
                </button>
                <button
                  onClick={() => handleTypeChange('image')}
                  className={getSidebarChoiceButtonClass(block.type === 'image' || block.type === 'lottie')}
                  style={getSidebarChoiceButtonStyle(block.type === 'image' || block.type === 'lottie')}
                >
                  <ImageIcon className="w-5 h-5" />
                  <span className="font-medium">Média</span>
                </button>
                <button
                  onClick={() => handleTypeChange('link')}
                  className={getSidebarChoiceButtonClass(block.type === 'link' || block.type === 'table')}
                  style={getSidebarChoiceButtonStyle(block.type === 'link' || block.type === 'table')}
                >
                  <MousePointer className="w-5 h-5" />
                  <span className="font-medium">Interaktivní</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Text formatting (only for text blocks) */}
        {block.type === 'text' && (
          <div className="border-b border-slate-100">
            <button
              onClick={() => toggleSection('format')}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Bold className="w-5 h-5 text-slate-400" />
                <span className="font-medium text-slate-700">Formátování</span>
              </div>
              {expandedSection('format') ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {expandedSection('format') && (
              <div className="px-5 pb-5 space-y-4">
                {/* Row 1: Font + Size */}
                <div className="flex gap-2">
                  {/* Font Family Dropdown */}
                  <div className="flex-1 relative">
                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1 block">Font</label>
                    <button
                      onClick={() => setShowFontDropdown(!showFontDropdown)}
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 text-sm font-medium text-slate-700 cursor-pointer focus:outline-none focus:border-blue-400 flex items-center justify-between transition-colors"
                      style={{
                        fontFamily: {
                          fenomen: '"Fenomen Sans", sans-serif',
                          cooper: '"Cooper Light", serif',
                          space: '"Space Grotesk", sans-serif',
                          sora: '"Sora", sans-serif',
                          playfair: '"Playfair Display", serif',
                          itim: '"Itim", cursive',
                          sacramento: '"Sacramento", cursive',
                          lora: '"Lora", serif',
                          oswald: '"Oswald", sans-serif',
                          visby: '"Visby Round", sans-serif',
                          vividscript: '"Vividbooks Script", cursive',
                        }[block.fontFamily || 'fenomen'],
                      }}
                    >
                      <span className="text-sm truncate">
                        {{
                          fenomen: 'Fenomen',
                          cooper: 'Cooper',
                          space: 'Space Grotesk',
                          sora: 'Sora',
                          playfair: 'Playfair',
                          itim: 'Itim',
                          sacramento: 'Sacramento',
                          lora: 'Lora',
                          oswald: 'Oswald',
                          visby: 'Visby Round',
                          vividscript: 'Vividbooks Script',
                        }[block.fontFamily || 'fenomen']}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${showFontDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showFontDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowFontDropdown(false)} />
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 max-h-[280px] overflow-y-auto">
                          {[
                            { value: 'fenomen', label: 'Fenomen', family: '"Fenomen Sans", sans-serif' },
                            { value: 'visby', label: 'Visby Round', family: '"Visby Round", sans-serif' },
                            { value: 'vividscript', label: 'Vividbooks Script', family: '"Vividbooks Script", cursive' },
                            { value: 'cooper', label: 'Cooper', family: '"Cooper Light", serif' },
                            { value: 'space', label: 'Space Grotesk', family: '"Space Grotesk", sans-serif' },
                            { value: 'sora', label: 'Sora', family: '"Sora", sans-serif' },
                            { value: 'playfair', label: 'Playfair', family: '"Playfair Display", serif' },
                            { value: 'itim', label: 'Itim', family: '"Itim", cursive' },
                            { value: 'sacramento', label: 'Sacramento', family: '"Sacramento", cursive' },
                            { value: 'lora', label: 'Lora', family: '"Lora", serif' },
                            { value: 'oswald', label: 'Oswald', family: '"Oswald", sans-serif' },
                          ].map((font) => (
                            <button
                              key={font.value}
                              onClick={() => {
                                onUpdate({ fontFamily: font.value as any });
                                setShowFontDropdown(false);
                              }}
                              className={`w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors ${
                                (block.fontFamily || 'fenomen') === font.value ? 'bg-blue-50' : ''
                              }`}
                              style={{ fontFamily: font.family }}
                            >
                              <span className={`text-lg ${(block.fontFamily || 'fenomen') === font.value ? 'text-blue-600' : 'text-slate-700'}`}>
                                {font.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Size Dropdown */}
                  <div className="flex-1 relative">
                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1 block">Velikost</label>
                    <div className="relative flex items-center">
                      <select
                        value={block.textOverflow === 'fit' || block.textOverflow === undefined ? 'auto' : block.fontSize || 'medium'}
                        onChange={(e) => {
                          if (e.target.value === 'auto') {
                            onUpdate({ textOverflow: 'fit', fontSize: undefined });
                          } else {
                            onUpdate({ textOverflow: 'scroll', fontSize: e.target.value as any });
                          }
                        }}
                        className="w-full py-2.5 px-3 pr-9 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 text-sm font-medium text-slate-700 cursor-pointer focus:outline-none focus:border-blue-400 appearance-none transition-colors"
                      >
                        <option value="auto">Auto</option>
                        <option value="xxlarge">Obrovský</option>
                        <option value="xlarge">Velký</option>
                        <option value="large">Větší</option>
                        <option value="medium">Střední</option>
                        <option value="small">Malý</option>
                        <option value="xsmall">Mini</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Row 2: Line Height + Letter Spacing */}
                <div className="flex gap-3">
                  {/* Line Height */}
                  <div className="flex-1 min-w-0">
                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1 block">Řádkování</label>
                    <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-slate-50 border border-slate-100">
                      <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M21 10H3M21 6H3M21 14H3M21 18H3" />
                      </svg>
                      <input
                        type="range"
                        min="1"
                        max="2.5"
                        step="0.1"
                        value={block.lineHeight ?? 1.5}
                        onChange={(e) => onUpdate({ lineHeight: parseFloat(e.target.value) })}
                        className="flex-1 min-w-0 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer"
                      />
                      <span className="text-xs font-medium text-slate-600 w-7 text-right shrink-0">{(block.lineHeight ?? 1.5).toFixed(1)}</span>
                    </div>
                  </div>

                  {/* Letter Spacing */}
                  <div className="flex-1 min-w-0">
                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1 block">Proklad</label>
                    <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-slate-50 border border-slate-100">
                      <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4" />
                      </svg>
                      <input
                        type="range"
                        min="-2"
                        max="8"
                        step="1"
                        value={block.letterSpacing ?? 0}
                        onChange={(e) => onUpdate({ letterSpacing: parseInt(e.target.value) })}
                        className="flex-1 min-w-0 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer"
                      />
                      <span className="text-xs font-medium text-slate-600 w-5 text-right shrink-0">{block.letterSpacing ?? 0}</span>
                    </div>
                  </div>
                </div>

                {/* Row 3: Horizontal + Vertical Alignment + Text Padding */}
                <div className="flex gap-3">
                  {/* Horizontal Alignment */}
                  <div className="flex-1 min-w-0">
                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1 block">Vodorovně</label>
                    <div className="flex gap-0.5 p-1 bg-slate-100 rounded-xl">
                      <button
                        onClick={() => onUpdate({ textAlign: 'left' })}
                        className={`p-2 rounded-lg transition-all ${
                          block.textAlign === 'left' || !block.textAlign
                            ? 'bg-white shadow-sm text-blue-500'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                        title="Vlevo"
                      >
                        <AlignLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onUpdate({ textAlign: 'center' })}
                        className={`p-2 rounded-lg transition-all ${
                          block.textAlign === 'center'
                            ? 'bg-white shadow-sm text-blue-500'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                        title="Na střed"
                      >
                        <AlignCenter className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onUpdate({ textAlign: 'right' })}
                        className={`p-2 rounded-lg transition-all ${
                          block.textAlign === 'right'
                            ? 'bg-white shadow-sm text-blue-500'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                        title="Vpravo"
                      >
                        <AlignRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Vertical Alignment */}
                  <div className="flex-1 min-w-0">
                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1 block">Svisle</label>
                    <div className="flex gap-0.5 p-1 bg-slate-100 rounded-xl">
                      <button
                        onClick={() => onUpdate({ verticalAlign: 'top' })}
                        className={`p-2 rounded-lg transition-all ${
                          block.verticalAlign === 'top' || !block.verticalAlign
                            ? 'bg-white shadow-sm text-blue-500'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                        title="Nahoru"
                      >
                        <AlignTopIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onUpdate({ verticalAlign: 'middle' })}
                        className={`p-2 rounded-lg transition-all ${
                          block.verticalAlign === 'middle'
                            ? 'bg-white shadow-sm text-blue-500'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                        title="Na střed"
                      >
                        <AlignMiddleIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onUpdate({ verticalAlign: 'bottom' })}
                        className={`p-2 rounded-lg transition-all ${
                          block.verticalAlign === 'bottom'
                            ? 'bg-white shadow-sm text-blue-500'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                        title="Dolů"
                      >
                        <AlignBottomIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Text Padding / Margins */}
                  <div className="flex-1 min-w-0">
                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1 block">Okraje textu</label>
                    <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-slate-50 border border-slate-100">
                      <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <rect x="7" y="7" width="10" height="10" rx="1" strokeDasharray="2 2" />
                      </svg>
                      <input
                        type="range"
                        min="0"
                        max="48"
                        step="4"
                        value={block.textPadding ?? 20}
                        onChange={(e) => onUpdate({ textPadding: parseInt(e.target.value) })}
                        className="flex-1 min-w-0 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer"
                      />
                      <span className="text-xs font-medium text-slate-600 w-8 text-right shrink-0">{block.textPadding ?? 20}px</span>
                    </div>
                  </div>
                </div>

                {/* Vizuální styl — pill / underline / left-border */}
                <div className="space-y-3">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wide block">Vizuální styl</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {([
                      { id: 'plain',       label: 'Prostý' },
                      { id: 'pill',        label: '⬭ Pilulka' },
                      { id: 'underline',   label: '_ Podtrž.' },
                      { id: 'left-border', label: '| Lišta' },
                    ] as const).map(({ id, label }) => {
                      const active = ((block as any).headingStyle ?? 'plain') === id;
                      return (
                        <button
                          key={id}
                          onClick={() => {
                            const updates: Record<string, any> = { headingStyle: id === 'plain' ? undefined : id };
                            updates.textDecoration = id === 'underline' ? 'underline' : 'none';
                            onUpdate(updates as any);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                            active
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {(block as any).headingStyle && (block as any).headingStyle !== 'plain' && (
                    <div>
                      <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wide block mb-2">Barva stylu</label>
                      <div className="flex gap-2 flex-wrap items-center">
                        {[
                          '#fce7f3', '#dbeafe', '#dcfce7', '#fef9c3', '#f3e8ff', '#fee2e2',
                          '#ccfbf1', '#e0f2fe', '#3b82f6', '#ec4899', '#22c55e', '#f59e0b',
                        ].map(color => (
                          <button
                            key={color}
                            onClick={() => onUpdate({ headingStyleColor: color } as any)}
                            className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 shadow-sm shrink-0 ${
                              (block as any).headingStyleColor === color
                                ? 'border-indigo-500 ring-2 ring-indigo-100'
                                : 'border-slate-100'
                            }`}
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                        <label
                          className="w-8 h-8 rounded-full border-2 border-slate-200 flex items-center justify-center cursor-pointer hover:scale-110 transition-all shadow-sm shrink-0 overflow-hidden"
                          style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
                          title="Vlastní barva"
                        >
                          <input
                            type="color"
                            value={(block as any).headingStyleColor || '#e0f2fe'}
                            onChange={(e) => onUpdate({ headingStyleColor: e.target.value } as any)}
                            className="opacity-0 w-0 h-0 absolute"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TTS – Mluvené slovo */}
        {block.type === 'text' && (
          <div className="border-b border-slate-100">
            <button
              onClick={() => toggleSection('tts')}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-slate-400" />
                <span className="font-medium text-slate-700">Mluvené slovo</span>
                {block.ttsEnabled && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                    Zapnuto
                  </span>
                )}
              </div>
              {expandedSection('tts') ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {expandedSection('tts') && (
              <div className="px-5 pb-5 space-y-4">
                {/* Enable toggle */}
                <ToggleSwitch
                  checked={!!block.ttsEnabled}
                  onToggle={() => onUpdate({ ttsEnabled: !block.ttsEnabled })}
                  label="Zobrazit tlačítko přehrát"
                  labelClassName="text-sm font-medium text-slate-700"
                />

                {block.ttsEnabled && (
                  <>
                    {/* Language picker */}
                    <div>
                      <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5 block">
                        Jazyk
                      </label>
                      <select
                        value={block.ttsLang || 'cs-CZ'}
                        onChange={(e) => onUpdate({ ttsLang: e.target.value as any })}
                        className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-indigo-400"
                      >
                        <option value="cs-CZ">🇨🇿 Čeština</option>
                        <option value="sk-SK">🇸🇰 Slovenština</option>
                        <option value="en-US">🇺🇸 Angličtina (US)</option>
                        <option value="en-GB">🇬🇧 Angličtina (UK)</option>
                        <option value="de-DE">🇩🇪 Němčina</option>
                      </select>
                    </div>

                    {/* Custom TTS text (optional) */}
                    <div>
                      <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5 block">
                        Vlastní text pro přehrání <span className="normal-case text-slate-300">(prázdné = obsah bloku)</span>
                      </label>
                      <textarea
                        value={block.ttsText || ''}
                        onChange={(e) => onUpdate({ ttsText: e.target.value })}
                        placeholder="Přepište nebo doplňte text..."
                        rows={3}
                        className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 resize-none placeholder-slate-300"
                      />
                    </div>

                    {/* Autoplay toggle */}
                    <ToggleSwitch
                      checked={!!block.ttsAutoplay}
                      onToggle={() => onUpdate({ ttsAutoplay: !block.ttsAutoplay })}
                      label="Přehrát automaticky při zobrazení slidu"
                    />
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Media settings (for image or lottie blocks) */}
        {(block.type === 'image' || block.type === 'lottie') && (
          <div className="border-b border-slate-100">
            <button
              onClick={() => toggleSection('image')}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ImageIcon className="w-5 h-5 text-slate-400" />
                <span className="font-medium text-slate-700">Nastavení média</span>
              </div>
              {expandedSection('image') ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {expandedSection('image') && (
              <div className="px-5 pb-4 space-y-4">
                {/* Lottie specific settings */}
                {block.type === 'lottie' && (
                  <div className="p-3 bg-indigo-50 rounded-xl space-y-3">
                    <label className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Animace (Lottie)</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={block.lottieAutoplay !== false}
                          onChange={(e) => onUpdate({ lottieAutoplay: e.target.checked })}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-700">Automaticky přehrát</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={block.lottieLoop !== false}
                          onChange={(e) => onUpdate({ lottieLoop: e.target.checked })}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-700">Smyčka</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Gallery preview (only for images for now) */}
                {block.type === 'image' && hasGallery && (
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-2 block">Galerie</label>
                    <div className="flex flex-wrap gap-2">
                      {block.gallery?.map((url, index) => (
                        <div 
                          key={index} 
                          className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                            index === (block.galleryIndex || 0) 
                              ? 'border-indigo-500 ring-2 ring-indigo-200' 
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                          onClick={() => onUpdate({ galleryIndex: index })}
                        >
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeGalleryImage(index);
                            }}
                            className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {/* Add more button */}
                      <button
                        onClick={() => galleryInputRef.current?.click()}
                        className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-5 h-5 text-slate-400" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Upload / Create gallery / Delete buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => openAssetPicker('single')}
                    className={getSidebarActionButtonClass()}
                  >
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    <span className="text-sm">
                      {block.content || hasGallery ? 'Změnit' : 'Vybrat obrázek / animaci'}
                    </span>
                  </button>
                  
                  <button
                    onClick={() => {
                      // If there's already a single image, convert it to gallery first
                      if (block.content && !block.gallery) {
                        onUpdate({ gallery: [block.content], galleryIndex: 0 });
                      }
                      openAssetPicker('gallery');
                    }}
                    className={getSidebarActionButtonClass()}
                  >
                    <Images className="w-5 h-5 text-slate-500" />
                    <span className="text-sm">
                      {hasGallery ? 'Přidat' : 'Galerie'}
                    </span>
                  </button>
                </div>

                {/* Delete current image button */}
                {hasGallery && block.gallery && block.gallery.length > 0 && (
                  <button
                    onClick={() => removeGalleryImage(block.galleryIndex || 0)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-red-600 hover:bg-red-50 transition-colors text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Smazat označený obrázek
                  </button>
                )}

                {/* Hidden input for multiple files */}
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleGalleryFilesSelect}
                  className="hidden"
                />

                {/* Gallery display mode toggle + mode-specific settings */}
                {hasGallery && block.gallery && block.gallery.length > 1 && (() => {
                  const displayMode = block.galleryDisplayMode || 'carousel';
                  const gridCols = (block as any).galleryGridColumns ?? 2;
                  const gridHeight = (block as any).galleryContainerHeight ?? 200;
                  return (
                    <>
                      {/* Mode toggle */}
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-2 block">Zobrazení galerie</label>
                        <div className="flex rounded-lg overflow-hidden border border-slate-200">
                          {([
                            { id: 'carousel', label: 'Přepínání' },
                            { id: 'grid', label: 'Grid' },
                          ] as const).map(({ id, label }) => (
                            <button
                              key={id}
                              onClick={() => onUpdate({ galleryDisplayMode: id } as any)}
                              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                                displayMode === id
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Carousel: nav type */}
                      {displayMode === 'carousel' && (
                        <div>
                          <label className="text-xs font-medium text-slate-600 mb-2 block">Tlačítka</label>
                          <select
                            value={block.galleryNavType || 'dots-bottom'}
                            onChange={(e) => onUpdate({ galleryNavType: e.target.value as any })}
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="dots-bottom">Tečky dole</option>
                            <option value="dots-side">Tečky na boku</option>
                            <option value="arrows">Šipky na stranách</option>
                            <option value="solution">Řešení</option>
                          </select>
                        </div>
                      )}

                      {/* Grid: columns + height */}
                      {displayMode === 'grid' && (
                        <>
                          <div>
                            <label className="text-xs font-medium text-slate-600 mb-2 block">Sloupce</label>
                            <div className="flex gap-2">
                              {[1, 2, 3, 4].map(n => (
                                <button
                                  key={n}
                                  onClick={() => onUpdate({ galleryGridColumns: n } as any)}
                                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                                    gridCols === n
                                      ? 'bg-indigo-600 text-white border-indigo-600'
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400'
                                  }`}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-xs font-medium text-slate-600">Výška obrázků</label>
                              <span className="text-xs font-medium text-indigo-600">{gridHeight}px</span>
                            </div>
                            <input
                              type="range"
                              min={80}
                              max={500}
                              step={10}
                              value={gridHeight}
                              onChange={(e) => onUpdate({ galleryContainerHeight: Number(e.target.value) } as any)}
                              className="w-full accent-indigo-600"
                            />
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}

                {/* Image scale slider (only in carousel mode — grid uses its own height slider) */}
                {(block.content || hasGallery) && (block.galleryDisplayMode !== 'grid') && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-slate-600">Velikost obrázku</label>
                        <span className={`text-xs font-medium ${imageScale > 100 ? 'text-amber-600' : 'text-indigo-600'}`}>
                          {imageScale}%
                        </span>
                      </div>
                      
                      {/* Custom slider with visible track */}
                      <div className="relative pt-2 pb-2">
                        {/* Track container */}
                        <div className="relative h-3 w-full">
                          {/* Background track - gray */}
                          <div 
                            className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-2 rounded-full"
                            style={{ backgroundColor: '#e2e8f0' }}
                          />
                          
                          {/* Filled track - indigo or amber */}
                          <div 
                            className="absolute top-1/2 -translate-y-1/2 left-0 h-2 rounded-full"
                            style={{ 
                              width: `${((imageScale - 10) / 290) * 100}%`,
                              backgroundColor: imageScale > 100 ? '#f59e0b' : '#6366f1'
                            }}
                          />
                          
                          {/* 100% marker */}
                          <div 
                            className="absolute top-1/2 -translate-y-1/2 w-1 h-4 rounded-full"
                            style={{ 
                              left: `${((100 - 10) / 290) * 100}%`,
                              backgroundColor: '#94a3b8',
                              transform: 'translate(-50%, -50%)'
                            }}
                          />
                          
                          {/* Thumb */}
                          <div 
                            className="absolute top-1/2 w-5 h-5 rounded-full border-2 shadow-md cursor-pointer"
                            style={{ 
                              left: `${((100 - 10) / 290) * 100}%`,
                              transform: 'translate(-50%, -50%)',
                              backgroundColor: 'white',
                              borderColor: imageScale > 100 ? '#f59e0b' : '#6366f1'
                            }}
                          />
                        </div>
                        
                        {/* Invisible range input for interaction */}
                        <input
                          type="range"
                          min="10"
                          max="300"
                          value={imageScale}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            onUpdate({ 
                              imageScale: val,
                              imageFit: val > 100 ? 'cover' : 'contain'
                            });
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                      
                      {/* Labels below slider */}
                      <div className="flex justify-between text-xs text-slate-400 mt-1">
                        <span>10%</span>
                        <span>100%</span>
                        <span>300%</span>
                      </div>
                      
                      {/* Info about cropping */}
                      {imageScale > 100 && (
                        <div className="mt-2 p-2 bg-amber-50 rounded-lg text-xs text-amber-700">
                          💡 Přetáhni obrázek v bloku pro nastavení pozice ořezu
                        </div>
                      )}
                    </div>

                  </>
                )}

                {/* Image caption — always visible, per-image when gallery is active */}
                {(block.content || hasGallery) && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-2 block">
                        Popisek obrázku
                        {hasGallery && (
                          <span className="ml-1 text-slate-400 font-normal">
                            ({(block.galleryIndex || 0) + 1}/{block.gallery!.length})
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={
                          hasGallery
                            ? (((block as any).galleryCaptions as string[] | undefined)?.[block.galleryIndex || 0] ?? '')
                            : (block.imageCaption || '')
                        }
                        onChange={(e) => {
                          if (hasGallery) {
                            const idx = block.galleryIndex || 0;
                            const caps = [...(((block as any).galleryCaptions as string[] | undefined) || Array(block.gallery!.length).fill(''))];
                            caps[idx] = e.target.value;
                            onUpdate({ galleryCaptions: caps } as any);
                          } else {
                            onUpdate({ imageCaption: e.target.value });
                          }
                        }}
                        placeholder="Popis obrázku..."
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Image link */}
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-2 block">Odkaz z obrázku</label>
                      <input
                        type="url"
                        value={block.imageLink || ''}
                        onChange={(e) => onUpdate({ imageLink: e.target.value })}
                        placeholder="https://..."
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* HTML settings (for link blocks in html mode) */}
        {block.type === 'link' && block.linkMode === 'html' && (
          <div className="border-b border-slate-100">
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-medium text-slate-700">HTML kód</span>
              </div>
              <p className="text-xs text-slate-500 leading-snug">
                Vložte libovolný HTML kód. Zobrazí se přesně tak, jak je napsán. Použijte pro 1:1 přenos složitých bloků z pracovního listu.
              </p>
              <textarea
                value={block.content || ''}
                onChange={(e) => onUpdate({ content: e.target.value })}
                rows={12}
                className="w-full text-xs font-mono border border-slate-200 rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-violet-400"
                style={{ backgroundColor: '#f8fafc', color: '#334155', lineHeight: 1.5 }}
                placeholder="<div class=&quot;...&quot;>...</div>"
                spellCheck={false}
              />
              {block.content && (
                <button
                  onClick={() => onUpdate({ content: '' })}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Vymazat HTML
                </button>
              )}
            </div>
          </div>
        )}

        {/* SVG / Figma settings */}
        {block.type === 'link' && block.linkMode === 'svg' && (
          <div className="border-b border-slate-100">
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-medium text-slate-700">SVG / Figma</span>
              </div>
              <p className="text-xs text-slate-500 leading-snug">
                Vložte SVG kód zkopírovaný z Figmy nebo jiného nástroje. V Figmě: vyberte vrstvu → pravý klik → Copy as SVG.
              </p>
              <textarea
                value={block.content || ''}
                onChange={(e) => onUpdate({ content: e.target.value })}
                rows={12}
                className="w-full text-xs font-mono border border-slate-200 rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-violet-400"
                style={{ backgroundColor: '#f8fafc', color: '#334155', lineHeight: 1.5 }}
                placeholder="<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; ...>...</svg>"
                spellCheck={false}
              />
              {block.content && (
                <button
                  onClick={() => onUpdate({ content: '' })}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Vymazat SVG
                </button>
              )}
            </div>
          </div>
        )}

        {/* Link settings (only for link blocks) */}
        {block.type === 'link' && (
        <div className="border-b border-slate-100">
          <button
              onClick={() => toggleSection('link')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
                <Link2 className="w-5 h-5 text-slate-400" />
                <span className="font-medium text-slate-700">Nastavení odkazu</span>
            </div>
              {expandedSection('link') ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {expandedSection('link') && (
              <div className="px-5 pb-4 space-y-5">
                {/* URL Input */}
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-2 block">URL adresa</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={block.content || ''}
                      onChange={(e) => {
                        onUpdate({ content: e.target.value });
                        identifyLink(e.target.value);
                      }}
                      placeholder="https://..."
                      className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Link Mode Selection */}
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-2 block">Způsob zobrazení</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onUpdate({ linkMode: 'button' })}
                      className={getSidebarChoiceButtonClass(block.linkMode === 'button' || !block.linkMode, 'tile')}
                      style={getSidebarChoiceButtonStyle(block.linkMode === 'button' || !block.linkMode)}
                    >
                      <ExternalLink className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase">Tlačítko</span>
                    </button>
                    <button
                      onClick={() => onUpdate({ linkMode: 'preview' })}
                      className={getSidebarChoiceButtonClass(block.linkMode === 'preview', 'tile')}
                      style={getSidebarChoiceButtonStyle(block.linkMode === 'preview')}
                    >
                      <Layout className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase">Náhled</span>
                    </button>
                    <button
                      onClick={() => onUpdate({ linkMode: 'video' })}
                      disabled={!getYoutubeId(block.content)}
                      className={`${getSidebarChoiceButtonClass(block.linkMode === 'video', 'tile')} ${!getYoutubeId(block.content) ? 'opacity-40 cursor-not-allowed grayscale' : ''}`}
                      style={getSidebarChoiceButtonStyle(block.linkMode === 'video')}
                    >
                      <Youtube className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase">Video</span>
                    </button>
                    <button
                      onClick={() => onUpdate({ linkMode: 'qr' })}
                      className={getSidebarChoiceButtonClass(block.linkMode === 'qr', 'tile')}
                      style={getSidebarChoiceButtonStyle(block.linkMode === 'qr')}
                    >
                      <QrCode className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase">QR kód</span>
                    </button>
                    <button
                      onClick={() => onUpdate({ linkMode: 'embed' })}
                      className={`${getSidebarChoiceButtonClass(block.linkMode === 'embed', 'tile')} col-span-2`}
                      style={getSidebarChoiceButtonStyle(block.linkMode === 'embed')}
                    >
                      <Globe className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase">Webová stránka (Embed)</span>
                    </button>
                  </div>
                </div>

                {/* Specific settings based on mode */}
                {(block.linkMode === 'button' || block.linkMode === 'preview' || !block.linkMode) && (
                  <div className="p-4 bg-slate-50 rounded-2xl space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                        {block.linkMode === 'preview' ? 'Titulek karty' : 'Text tlačítka'}
                      </label>
                      <input
                        type="text"
                        value={block.linkTitle || ''}
                        onChange={(e) => onUpdate({ linkTitle: e.target.value })}
                        placeholder={block.linkMode === 'preview' ? 'Zadejte název...' : 'Přejít na odkaz...'}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {block.linkMode === 'preview' && (
                      <>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Popis</label>
                          <textarea
                            value={block.linkDescription || ''}
                            onChange={(e) => onUpdate({ linkDescription: e.target.value })}
                            placeholder="Stručný popis stránky..."
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Obrázek (URL)</label>
                          <div className="flex gap-2">
                            <input
                              type="url"
                              value={block.linkThumbnail || ''}
                              onChange={(e) => onUpdate({ linkThumbnail: e.target.value })}
                              placeholder="https://.../image.jpg"
                              className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                              onClick={() => openAssetPicker('single')}
                              className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500"
                              title="Vybrat z knihovny"
                            >
                              <ImageIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {block.linkMode === 'embed' && (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-xs text-amber-700 leading-relaxed">
                      <strong>Pozor:</strong> Některé stránky (např. Google, Facebook) zakazují vkládání do cizích webů. Pokud se stránka nezobrazí, použijte raději režim <strong>Tlačítko</strong> nebo <strong>Náhled</strong>.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {/* ── Chart settings ── */}
        {block.type === 'chart' && (
          <div className="border-b border-slate-100">
            <button
              onClick={() => toggleSection('chart')}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-slate-400">📊</span>
                <span className="font-medium text-slate-700">Graf a data</span>
              </div>
              {expandedSection('chart') ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>
            {expandedSection('chart') && (
              <div className="px-5 pb-5 space-y-4">
                {/* Chart title */}
                <div>
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1 block">Název grafu</label>
                  <input
                    type="text"
                    value={block.chartTitle ?? ''}
                    onChange={e => onUpdate({ chartTitle: e.target.value })}
                    placeholder="Název grafu (nepovinný)"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                {/* Chart type */}
                <div>
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1 block">Typ grafu</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['bar', 'line', 'area', 'pie', 'radar', 'timeline'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => onUpdate({ chartType: t })}
                        className="px-2 py-1.5 text-xs font-medium rounded-lg border-2 transition-all"
                        style={{
                          borderColor: (block.chartType ?? 'bar') === t ? '#6366f1' : '#e2e8f0',
                          background: (block.chartType ?? 'bar') === t ? '#eef2ff' : 'white',
                          color: (block.chartType ?? 'bar') === t ? '#4338ca' : '#64748b',
                        }}
                      >
                        {t === 'bar' ? '📊 Sloupce' : t === 'line' ? '📈 Linie' : t === 'area' ? '🌊 Oblast' : t === 'pie' ? '🥧 Koláč' : t === 'radar' ? '🕸️ Pavučina' : '⏳ Timeline'}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Data table editor */}
                <div>
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2 block">Data</label>
                  {block.chartType === 'timeline' ? (
                    /* Timeline: label = year/period, value = description, category */
                    <div className="space-y-2">
                      <div className="grid text-[9px] font-semibold text-slate-400 uppercase" style={{ gridTemplateColumns: '80px 1fr 80px 28px', gap: 4 }}>
                        <span>Rok / Období</span><span>Popis události</span><span>Kategorie</span><span />
                      </div>
                      {(block.chartRows ?? []).map((row: string[], ri: number) => (
                        <div key={ri} className="grid items-center" style={{ gridTemplateColumns: '80px 1fr 80px 28px', gap: 4 }}>
                          <input value={row[0] ?? ''} onChange={e => { const r = [...(block.chartRows ?? [])]; r[ri] = [...r[ri]]; r[ri][0] = e.target.value; onUpdate({ chartRows: r }); }} className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-300" placeholder="1914" />
                          <input value={row[1] ?? ''} onChange={e => { const r = [...(block.chartRows ?? [])]; r[ri] = [...r[ri]]; r[ri][1] = e.target.value; onUpdate({ chartRows: r }); }} className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-300" placeholder="Popis…" />
                          <input value={row[2] ?? ''} onChange={e => { const r = [...(block.chartRows ?? [])]; r[ri] = [...r[ri]]; r[ri][2] = e.target.value; onUpdate({ chartRows: r }); }} className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-300" placeholder="Kategorie" />
                          <button onClick={() => { const r = (block.chartRows ?? []).filter((_: any, i: number) => i !== ri); onUpdate({ chartRows: r }); }} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      ))}
                      <button onClick={() => onUpdate({ chartRows: [...(block.chartRows ?? []), ['', '', '']] })} className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg border border-dashed border-indigo-200 transition-colors">
                        <Plus className="w-3 h-3" />Přidat událost
                      </button>
                    </div>
                  ) : (
                    /* Regular chart: editable column headers + rows */
                    <div className="space-y-2">
                      {/* Column headers */}
                      <div className="flex gap-1 items-center">
                        {(block.chartColumns ?? ['Kategorie', 'Hodnota']).map((col: string, ci: number) => (
                          <input key={ci} value={col} onChange={e => { const c = [...(block.chartColumns ?? [])]; c[ci] = e.target.value; onUpdate({ chartColumns: c }); }} className="flex-1 min-w-0 px-2 py-1 text-xs font-semibold border border-indigo-200 bg-indigo-50 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-300 text-indigo-700" placeholder={ci === 0 ? 'Kategorie' : `Řada ${ci}`} />
                        ))}
                        {/* Add/remove series */}
                        <button onClick={() => { const c = [...(block.chartColumns ?? [])]; c.push(`Řada ${c.length}`); const r = (block.chartRows ?? []).map((row: string[]) => [...row, '']); onUpdate({ chartColumns: c, chartRows: r }); }} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-indigo-50 text-indigo-400 border border-dashed border-indigo-200" title="Přidat řadu"><Plus className="w-3 h-3" /></button>
                        {(block.chartColumns ?? []).length > 2 && (
                          <button onClick={() => { const c = (block.chartColumns ?? []).slice(0, -1); const r = (block.chartRows ?? []).map((row: string[]) => row.slice(0, -1)); onUpdate({ chartColumns: c, chartRows: r }); }} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-50 text-red-400 border border-dashed border-red-200" title="Odebrat řadu"><Trash2 className="w-3 h-3" /></button>
                        )}
                      </div>
                      {/* Data rows */}
                      {(block.chartRows ?? []).map((row: string[], ri: number) => (
                        <div key={ri} className="flex gap-1 items-center">
                          {row.map((cell: string, ci: number) => (
                            <input key={ci} value={cell} onChange={e => { const r = [...(block.chartRows ?? [])]; r[ri] = [...r[ri]]; r[ri][ci] = e.target.value; onUpdate({ chartRows: r }); }} className="flex-1 min-w-0 px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-300" placeholder={ci === 0 ? 'Název' : '0'} />
                          ))}
                          <button onClick={() => { const r = (block.chartRows ?? []).filter((_: any, i: number) => i !== ri); onUpdate({ chartRows: r }); }} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      ))}
                      <button onClick={() => onUpdate({ chartRows: [...(block.chartRows ?? []), new Array((block.chartColumns ?? ['Kategorie', 'Hodnota']).length).fill('')] })} className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg border border-dashed border-indigo-200 transition-colors">
                        <Plus className="w-3 h-3" />Přidat řádek
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="border-b border-slate-100" ref={backgroundSectionRef}>
          <div className="px-5 py-4">
            <button
              onClick={() => toggleSection('background')}
              className="w-full flex items-center justify-between mb-3 hover:opacity-70 transition-opacity"
            >
              <div className="flex items-center gap-3">
                <ColorIcon className="w-5 h-5 text-slate-400" />
                <span className="font-medium text-slate-700">Barva bloku</span>
              </div>
              <div className="flex items-center gap-2">
              {expandedSection('background') ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </button>

            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              {recentColors.slice(0, 9).map((color, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onUpdate({ 
                      background: { type: 'color', color },
                      textColor: getContrastColor(color)
                    });
                    updateRecentColors(color);
                  }}
                  className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 shadow-sm shrink-0 ${
                    block.background?.color === color ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-100'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {expandedSection('background') && (
            <div className="px-5 pb-4">
              <BackgroundPicker
                value={block.background}
                onChange={(bg) => {
                  const updates: Partial<SlideBlock> = { background: bg };
                  // Auto-update text color based on background contrast
                  if (bg.type === 'color' && bg.color) {
                    updates.textColor = getContrastColor(bg.color);
                    updateRecentColors(bg.color);
                  }
                  onUpdate(updates);
                }}
                onClose={() => {}}
                showBlur={false}
                showUpload={true}
                showOpacity={false}
                inline={true}
              />
            </div>
          )}
        </div>
      </div>

      {/* Map info */}
      {block.type === 'map' && (
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <span>🗺️</span>
            <span>Mapový blok – editujte data přímo v bloku kliknutím na <strong>✏️ Editovat data</strong></span>
          </div>
          {block.mapData && (
            <div className="mt-2 text-[11px] text-slate-400">
              Oblast: {block.mapData.region} · Styl: {block.mapData.style} · {block.mapData.markers?.length || 0} bodů
            </div>
          )}
        </div>
      )}

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

export default BlockSettingsPanel;
