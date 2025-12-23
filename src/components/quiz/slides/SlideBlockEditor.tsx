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
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Upload,
} from 'lucide-react';
import { SlideBlock, SlideBlockType, BackgroundSettings } from '../../../types/quiz';
import { BackgroundPicker } from './BackgroundPicker';

interface SlideBlockEditorProps {
  block: SlideBlock;
  onUpdate: (updates: Partial<SlideBlock>) => void;
  isSelected?: boolean;
  onSelect?: () => void;
  placeholder?: string;
}

export function SlideBlockEditor({
  block,
  onUpdate,
  isSelected = false,
  onSelect,
  placeholder = 'Klikněte pro úpravu...',
}: SlideBlockEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      autoResize();
    }
  }, [isEditing]);

  // Auto-resize textarea
  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleClick = () => {
    onSelect?.();
    if (block.type === 'text') {
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
    setShowTypeMenu(false);
  };

  // Get font size class
  const getFontSizeClass = () => {
    switch (block.fontSize) {
      case 'small': return 'text-sm';
      case 'medium': return 'text-base';
      case 'large': return 'text-xl';
      case 'xlarge': return 'text-3xl';
      default: return 'text-base';
    }
  };

  // Get text align class
  const getTextAlignClass = () => {
    switch (block.textAlign) {
      case 'left': return 'text-left';
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      default: return 'text-left';
    }
  };

  // Get background style
  const getBackgroundStyle = (): React.CSSProperties => {
    if (!block.background) return {};
    
    const bg = block.background;
    const style: React.CSSProperties = {};
    
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
        relative group h-full rounded-xl transition-all overflow-hidden
        ${isSelected 
          ? 'ring-2 ring-blue-500 ring-offset-2' 
          : 'hover:ring-2 hover:ring-blue-200'
        }
      `}
      style={getBackgroundStyle()}
      onClick={handleClick}
    >
      {/* Content */}
      <div className="h-full p-4">
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
                  w-full h-full bg-transparent outline-none resize-none
                  ${getFontSizeClass()} ${getTextAlignClass()}
                  ${block.fontWeight === 'bold' ? 'font-bold' : 'font-normal'}
                `}
                placeholder={placeholder}
              />
            ) : (
              <div
                className={`
                  w-full h-full whitespace-pre-wrap
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
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 p-8 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <Upload className="w-8 h-8 text-slate-400" />
                <span className="text-sm text-slate-500">Nahrát obrázek</span>
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

      {/* Block toolbar - visible on hover/select */}
      {isSelected && (
        <div 
          className="absolute top-2 right-2 flex items-center gap-1 bg-white rounded-lg shadow-lg border border-slate-200 p-1"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Block type selector */}
          <div className="relative">
            <button
              onClick={() => setShowTypeMenu(!showTypeMenu)}
              className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
              title="Typ bloku"
            >
              {block.type === 'text' && <Type className="w-4 h-4 text-slate-600" />}
              {block.type === 'image' && <ImageIcon className="w-4 h-4 text-slate-600" />}
              {block.type === 'link' && <Link2 className="w-4 h-4 text-slate-600" />}
            </button>
            
            {showTypeMenu && (
              <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                <button
                  onClick={() => handleTypeChange('text')}
                  className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-100 ${block.type === 'text' ? 'bg-blue-50 text-blue-600' : ''}`}
                >
                  <Type className="w-4 h-4" />
                  <span className="text-sm">Text</span>
                </button>
                <button
                  onClick={() => handleTypeChange('image')}
                  className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-100 ${block.type === 'image' ? 'bg-blue-50 text-blue-600' : ''}`}
                >
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-sm">Obrázek</span>
                </button>
                <button
                  onClick={() => handleTypeChange('link')}
                  className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-100 ${block.type === 'link' ? 'bg-blue-50 text-blue-600' : ''}`}
                >
                  <Link2 className="w-4 h-4" />
                  <span className="text-sm">Odkaz</span>
                </button>
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-slate-200" />

          {/* Text formatting (only for text blocks) */}
          {block.type === 'text' && (
            <>
              <button
                onClick={() => onUpdate({ fontWeight: block.fontWeight === 'bold' ? 'normal' : 'bold' })}
                className={`p-1.5 rounded-md hover:bg-slate-100 transition-colors ${block.fontWeight === 'bold' ? 'bg-blue-100 text-blue-600' : ''}`}
                title="Tučné"
              >
                <Bold className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => onUpdate({ textAlign: 'left' })}
                className={`p-1.5 rounded-md hover:bg-slate-100 transition-colors ${block.textAlign === 'left' ? 'bg-blue-100 text-blue-600' : ''}`}
                title="Zarovnat vlevo"
              >
                <AlignLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => onUpdate({ textAlign: 'center' })}
                className={`p-1.5 rounded-md hover:bg-slate-100 transition-colors ${block.textAlign === 'center' ? 'bg-blue-100 text-blue-600' : ''}`}
                title="Zarovnat na střed"
              >
                <AlignCenter className="w-4 h-4" />
              </button>
              <button
                onClick={() => onUpdate({ textAlign: 'right' })}
                className={`p-1.5 rounded-md hover:bg-slate-100 transition-colors ${block.textAlign === 'right' ? 'bg-blue-100 text-blue-600' : ''}`}
                title="Zarovnat vpravo"
              >
                <AlignRight className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-slate-200" />
            </>
          )}

          {/* Background */}
          <div className="relative">
            <button
              onClick={() => setShowBackgroundPicker(!showBackgroundPicker)}
              className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
              title="Pozadí bloku"
            >
              <Palette className="w-4 h-4 text-slate-600" />
            </button>
            
            {showBackgroundPicker && (
              <BackgroundPicker
                value={block.background}
                onChange={(bg) => onUpdate({ background: bg })}
                onClose={() => setShowBackgroundPicker(false)}
                showBlur={false}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SlideBlockEditor;

