/**
 * BlockSettingsPanel
 * 
 * Left panel for editing individual block settings.
 */

import React, { useState, useRef } from 'react';
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
} from 'lucide-react';
import { SlideBlock, SlideBlockType } from '../../../types/quiz';
import { BackgroundPicker } from './BackgroundPicker';

interface BlockSettingsPanelProps {
  block: SlideBlock;
  blockIndex: number;
  onUpdate: (updates: Partial<SlideBlock>) => void;
  onClose: () => void;
  onImageUpload: (file: File) => void;
  onGalleryImageUpload?: (files: File[]) => void;
}

export function BlockSettingsPanel({
  block,
  blockIndex,
  onUpdate,
  onClose,
  onImageUpload,
  onGalleryImageUpload,
}: BlockSettingsPanelProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(
    block.type === 'image' ? 'image' : 'type'
  );
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const handleTypeChange = (newType: SlideBlockType) => {
    onUpdate({ type: newType, content: '', gallery: undefined, galleryIndex: undefined });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageUpload(file);
    }
  };

  const handleGalleryFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      // Convert files to data URLs
      Promise.all(files.map(file => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            resolve(event.target?.result as string);
          };
          reader.readAsDataURL(file);
        });
      })).then(urls => {
        const currentGallery = block.gallery || (block.content ? [block.content] : []);
        onUpdate({ 
          gallery: [...currentGallery, ...urls],
          galleryIndex: currentGallery.length > 0 ? block.galleryIndex : 0
        });
      });
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

  const getBlockTypeName = () => {
    switch (block.type) {
      case 'text': return 'Text';
      case 'image': return 'Obrázek';
      case 'link': return 'Odkaz';
      default: return 'Text';
    }
  };

  const imageFit = block.imageFit || 'contain';
  const imageScale = block.imageScale || 100;
  const hasGallery = block.gallery && block.gallery.length > 1;

  return (
    <div
      className="fixed top-0 left-0 h-full bg-white shadow-2xl z-40 flex flex-col overflow-hidden"
      style={{ width: '420px' }}
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
              {expandedSection === 'type' ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </button>

          {expandedSection === 'type' && (
            <div className="px-5 pb-4">
              <div className="flex gap-2">
                <button
                  onClick={() => handleTypeChange('text')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                    block.type === 'text'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <Type className="w-5 h-5" />
                  <span className="font-medium">Text</span>
                </button>
                <button
                  onClick={() => handleTypeChange('image')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                    block.type === 'image'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <ImageIcon className="w-5 h-5" />
                  <span className="font-medium">Obrázek</span>
                </button>
                <button
                  onClick={() => handleTypeChange('link')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                    block.type === 'link'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <Link2 className="w-5 h-5" />
                  <span className="font-medium">Odkaz</span>
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
              {expandedSection === 'format' ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {expandedSection === 'format' && (
              <div className="px-5 pb-4 space-y-3">
                {/* Font weight */}
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-2 block">Tučnost</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onUpdate({ fontWeight: 'normal' })}
                      className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm transition-all ${
                        block.fontWeight !== 'bold'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      Normální
                    </button>
                    <button
                      onClick={() => onUpdate({ fontWeight: 'bold' })}
                      className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all ${
                        block.fontWeight === 'bold'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      Tučné
                    </button>
                  </div>
                </div>

                {/* Text alignment */}
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-2 block">Zarovnání</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onUpdate({ textAlign: 'left' })}
                      className={`flex-1 flex items-center justify-center py-2 rounded-lg border-2 transition-all ${
                        block.textAlign === 'left' || !block.textAlign
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <AlignLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onUpdate({ textAlign: 'center' })}
                      className={`flex-1 flex items-center justify-center py-2 rounded-lg border-2 transition-all ${
                        block.textAlign === 'center'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <AlignCenter className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onUpdate({ textAlign: 'right' })}
                      className={`flex-1 flex items-center justify-center py-2 rounded-lg border-2 transition-all ${
                        block.textAlign === 'right'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <AlignRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Font size */}
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-2 block">Velikost písma</label>
                  <select
                    value={block.fontSize || 'medium'}
                    onChange={(e) => onUpdate({ fontSize: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={block.textOverflow === 'fit'}
                  >
                    <option value="small">Malé</option>
                    <option value="medium">Střední</option>
                    <option value="large">Velké</option>
                    <option value="xlarge">Extra velké</option>
                  </select>
                  {block.textOverflow === 'fit' && (
                    <p className="text-xs text-slate-400 mt-1">Velikost je automaticky přizpůsobena</p>
                  )}
                </div>

                {/* Text overflow */}
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-2 block">Přetečení textu</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onUpdate({ textOverflow: undefined })}
                      className={`flex-1 py-2 px-3 rounded-lg border-2 text-xs font-medium transition-all ${
                        !block.textOverflow
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      Výchozí
                    </button>
                    <button
                      onClick={() => onUpdate({ textOverflow: 'scroll' })}
                      className={`flex-1 py-2 px-3 rounded-lg border-2 text-xs font-medium transition-all ${
                        block.textOverflow === 'scroll'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      📜 Scroll
                    </button>
                    <button
                      onClick={() => onUpdate({ textOverflow: 'fit' })}
                      className={`flex-1 py-2 px-3 rounded-lg border-2 text-xs font-medium transition-all ${
                        block.textOverflow === 'fit'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      🔤 Auto
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Image settings (only for image blocks) */}
        {block.type === 'image' && (
          <div className="border-b border-slate-100">
            <button
              onClick={() => toggleSection('image')}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ImageIcon className="w-5 h-5 text-slate-400" />
                <span className="font-medium text-slate-700">Nastavení obrázku</span>
              </div>
              {expandedSection === 'image' ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {expandedSection === 'image' && (
              <div className="px-5 pb-4 space-y-4">
                {/* Gallery preview */}
                {hasGallery && (
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
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-colors">
                    <Upload className="w-5 h-5 text-slate-500" />
                    <span className="text-sm text-slate-600">
                      {block.content || hasGallery ? 'Změnit' : 'Nahrát'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                  
                  <button
                    onClick={createGallery}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                  >
                    <Images className="w-5 h-5 text-slate-500" />
                    <span className="text-sm text-slate-600">
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

                {/* Gallery navigation type (only if gallery has 2+ images) */}
                {hasGallery && block.gallery && block.gallery.length > 1 && (
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

                {/* Image scale slider (only if image exists) */}
                {(block.content || hasGallery) && (
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
                              left: `${((imageScale - 10) / 290) * 100}%`,
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

                    {/* Image caption */}
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-2 block">Popisek obrázku</label>
                      <input
                        type="text"
                        value={block.imageCaption || ''}
                        onChange={(e) => onUpdate({ imageCaption: e.target.value })}
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

        {/* Background color */}
        <div className="border-b border-slate-100">
          <button
            onClick={() => toggleSection('background')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Palette className="w-5 h-5 text-slate-400" />
              <span className="font-medium text-slate-700">Barva bloku</span>
            </div>
            <div className="flex items-center gap-2">
              {block.background?.color && (
                <div
                  className="w-5 h-5 rounded-full border border-slate-200"
                  style={{ backgroundColor: block.background.color }}
                />
              )}
              {expandedSection === 'background' ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </button>

          {expandedSection === 'background' && (
            <div className="px-5 pb-4">
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
          )}
        </div>
      </div>
    </div>
  );
}

export default BlockSettingsPanel;
