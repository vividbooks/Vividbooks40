/**
 * BlockSettingsPanel
 * 
 * Left panel for editing individual block settings.
 */

import React, { useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Palette,
  Maximize2,
  Minimize2,
  Upload,
  Type,
  Image as ImageIcon,
  Link2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
} from 'lucide-react';
import { SlideBlock, SlideBlockType } from '../../../types/quiz';
import { BackgroundPicker } from './BackgroundPicker';

interface BlockSettingsPanelProps {
  block: SlideBlock;
  blockIndex: number;
  onUpdate: (updates: Partial<SlideBlock>) => void;
  onClose: () => void;
  onImageUpload: (file: File) => void;
}

export function BlockSettingsPanel({
  block,
  blockIndex,
  onUpdate,
  onClose,
  onImageUpload,
}: BlockSettingsPanelProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('type');
  const [imageSize, setImageSize] = useState<'contain' | 'cover'>('contain');

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const handleTypeChange = (newType: SlideBlockType) => {
    onUpdate({ type: newType, content: '' });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageUpload(file);
    }
  };

  const getBlockTypeName = () => {
    switch (block.type) {
      case 'text': return 'Text';
      case 'image': return 'Obrázek';
      case 'link': return 'Odkaz';
      default: return 'Text';
    }
  };

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
                  >
                    <option value="small">Malé</option>
                    <option value="medium">Střední</option>
                    <option value="large">Velké</option>
                    <option value="xlarge">Extra velké</option>
                  </select>
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
              <div className="px-5 pb-4 space-y-3">
                {/* Upload button */}
                <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-colors">
                  <Upload className="w-5 h-5 text-slate-500" />
                  <span className="text-sm text-slate-600">
                    {block.content ? 'Nahrát jiný obrázek' : 'Nahrát obrázek'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>

                {/* Image size (only if image is uploaded) */}
                {block.content && (
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-2 block">Velikost</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setImageSize('contain')}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 text-sm transition-all ${
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
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 text-sm transition-all ${
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

