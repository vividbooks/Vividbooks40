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
      {/* Type switcher & Settings - visible on hover */}
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
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            ) : (
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
