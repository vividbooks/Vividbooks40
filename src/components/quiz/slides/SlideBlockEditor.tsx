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
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import { SlideBlock, SlideBlockType } from '../../../types/quiz';
import { BackgroundPicker } from './BackgroundPicker';

interface SlideBlockEditorProps {
  block: SlideBlock;
  onUpdate: (updates: Partial<SlideBlock>) => void;
  isSelected?: boolean;
  onSelect?: () => void;
  placeholder?: string;
  templateColor?: string;
  borderRadius?: number;
}

export function SlideBlockEditor({
  block,
  onUpdate,
  isSelected = false,
  onSelect,
  placeholder = 'Klikněte pro úpravu...',
  templateColor,
  borderRadius = 8,
}: SlideBlockEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [imageSize, setImageSize] = useState<'contain' | 'cover' | 'fill'>('contain');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      autoResize();
    }
  }, [isEditing]);

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

  const getImageSizeStyle = () => {
    switch (imageSize) {
      case 'cover': return 'object-cover w-full h-full';
      case 'fill': return 'object-fill w-full h-full';
      default: return 'object-contain max-w-full max-h-full';
    }
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
      {/* Type switcher - visible on hover */}
      <div 
        className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Type buttons */}
        <div className="flex items-center bg-white rounded-lg shadow-lg border border-slate-200 p-0.5">
          <button
            onClick={() => handleTypeChange('text')}
            className={`p-1.5 rounded-md transition-colors ${
              block.type === 'text' 
                ? 'bg-slate-700 text-white' 
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
                ? 'bg-slate-700 text-white' 
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
                ? 'bg-slate-700 text-white' 
                : 'hover:bg-slate-100 text-slate-500'
            }`}
            title="Odkaz"
          >
            <Link2 className="w-4 h-4" />
          </button>
        </div>

        {/* Settings button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-1.5 rounded-lg shadow-lg border transition-colors ${
            showSettings 
              ? 'bg-indigo-600 text-white border-indigo-600' 
              : 'bg-white text-slate-500 hover:bg-slate-100 border-slate-200'
          }`}
          title="Nastavení bloku"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div 
          className="absolute top-12 right-2 z-30 bg-white rounded-xl shadow-2xl border border-slate-200 w-72"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="font-medium text-slate-700 text-sm">Nastavení bloku</span>
            <button 
              onClick={() => setShowSettings(false)}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Background color */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-2 block">Barva bloku</label>
              <BackgroundPicker
                value={block.background}
                onChange={(bg) => onUpdate({ background: bg })}
                onClose={() => {}}
                showBlur={false}
                showUpload={false}
                showOpacity={false}
                inline={true}
              />
            </div>

            {/* Image sizing options (only for images) */}
            {block.type === 'image' && block.content && (
              <div>
                <label className="text-xs font-medium text-slate-600 mb-2 block">Velikost obrázku</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImageSize('contain')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      imageSize === 'contain' 
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Minimize2 className="w-4 h-4" />
                    Přizpůsobit
                  </button>
                  <button
                    onClick={() => setImageSize('cover')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      imageSize === 'cover' 
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Maximize2 className="w-4 h-4" />
                    Vyplnit
                  </button>
                </div>
              </div>
            )}

            {/* Replace image button */}
            {block.type === 'image' && block.content && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm text-slate-600 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Nahrát jiný obrázek
              </button>
            )}
          </div>
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
          <div className="h-full flex items-center justify-center">
            {block.content ? (
              <img
                src={block.content}
                alt=""
                className={`rounded-lg ${getImageSizeStyle()}`}
              />
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-slate-500" />
                </div>
                <span className="text-sm text-slate-500">nahrát</span>
              </button>
            )}
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
