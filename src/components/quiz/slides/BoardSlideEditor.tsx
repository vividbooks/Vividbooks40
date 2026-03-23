/**
 * Board (Nástěnka) Slide Editor
 * 
 * Editor for collaborative board/wall activities where students can post and like
 */

import React, { useState } from 'react';
import {
  MessageSquare,
  Image as ImageIcon,
  Upload,
  Trash2,
  Users,
  Heart,
  EyeOff,
  Hash,
  FileText,
  Presentation,
  Scale,
  Columns2,
} from 'lucide-react';
import { BoardActivitySlide, BoardType } from '../../../types/quiz';
import { getContrastColor } from '../../../utils/color-utils';
import { AssetPicker } from '../../shared/AssetPicker';
import type { AssetPickerResult } from '../../../types/assets';

interface BoardSlideEditorProps {
  slide: BoardActivitySlide;
  onUpdate: (id: string, updates: Partial<BoardActivitySlide>) => void;
}

function getBoardTypeButtonStyle(active: boolean): React.CSSProperties {
  return active
    ? {
        backgroundColor: '#59627B',
        color: '#ffffff',
        boxShadow: '0 6px 16px rgba(89, 98, 123, 0.18)',
      }
    : {
        backgroundColor: '#f8fafc',
        color: '#64748b',
      };
}

export function BoardSlideEditor({ slide, onUpdate }: BoardSlideEditorProps) {
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(false);

  // Determine current board type
  const currentBoardType: BoardType = slide.boardType || (slide.allowMedia ? 'presentation' : 'text');

  const handleBoardTypeChange = (type: BoardType) => {
    const updates: Partial<BoardActivitySlide> = { boardType: type };
    
    if (type === 'text') {
      updates.allowMedia = false;
    } else if (type === 'presentation') {
      updates.allowMedia = true;
    } else if (type === 'pros-cons') {
      updates.allowMedia = false;
      // Set default labels if not set
      if (!slide.leftColumnLabel) updates.leftColumnLabel = 'Pro';
      if (!slide.rightColumnLabel) updates.rightColumnLabel = 'Proti';
    }
    
    onUpdate(slide.id, updates);
  };

  const handleAssetSelect = (result: AssetPickerResult) => {
    onUpdate(slide.id, { questionImage: result.url });
    setShowAssetPicker(false);
  };
  
  // Get background color and contrast color for text
  const bgColor = (slide as any).slideBackground?.color || '#ffffff';
  const textColor = getContrastColor(bgColor);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: bgColor, color: textColor }}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-2 text-sm mb-1" style={{ opacity: 0.7 }}>
          <MessageSquare className="w-4 h-4" />
          <span>Nástěnka</span>
        </div>
        <h2 className="font-bold text-lg">Žáci sdílí příspěvky</h2>
      </div>

      {/* Column Labels for Pros-Cons */}
      {currentBoardType === 'pros-cons' && (
        <div className="px-6 pb-6 border-b border-slate-100">
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Názvy sloupců
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-green-700 mb-1">Levý sloupec (Pro)</label>
              <input
                type="text"
                value={slide.leftColumnLabel || 'Pro'}
                onChange={(e) => onUpdate(slide.id, { leftColumnLabel: e.target.value })}
                placeholder="Pro"
                className="w-full px-3 py-2 rounded-lg border border-green-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-red-700 mb-1">Pravý sloupec (Proti)</label>
              <input
                type="text"
                value={slide.rightColumnLabel || 'Proti'}
                onChange={(e) => onUpdate(slide.id, { rightColumnLabel: e.target.value })}
                placeholder="Proti"
                className="w-full px-3 py-2 rounded-lg border border-red-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none text-sm bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Board Type Selector */}
      <div className="p-6 border-b border-slate-100">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Typ nástěnky
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => handleBoardTypeChange('text')}
            className="flex-1 min-w-0 flex flex-col items-center gap-2 px-2.5 py-3 rounded-2xl transition-all text-center"
            style={getBoardTypeButtonStyle(currentBoardType === 'text')}
          >
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: currentBoardType === 'text' ? 'rgba(255,255,255,0.14)' : '#ffffff' }}
            >
              <FileText className={`w-5 h-5 ${currentBoardType === 'text' ? 'text-white' : 'text-slate-500'}`} />
            </div>
            <div>
              <h4 className={`font-semibold text-sm leading-tight ${currentBoardType === 'text' ? 'text-white' : 'text-slate-700'}`}>Textové příspěvky</h4>
              <p className={`text-[11px] leading-tight mt-1 ${currentBoardType === 'text' ? 'text-white/75' : 'text-slate-500'}`}>Jednoduché odpovědi</p>
            </div>
          </button>

          <button
            onClick={() => handleBoardTypeChange('presentation')}
            className="flex-1 min-w-0 flex flex-col items-center gap-2 px-2.5 py-3 rounded-2xl transition-all text-center"
            style={getBoardTypeButtonStyle(currentBoardType === 'presentation')}
          >
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: currentBoardType === 'presentation' ? 'rgba(255,255,255,0.14)' : '#ffffff' }}
            >
              <Presentation className={`w-5 h-5 ${currentBoardType === 'presentation' ? 'text-white' : 'text-slate-500'}`} />
            </div>
            <div>
              <h4 className={`font-semibold text-sm leading-tight ${currentBoardType === 'presentation' ? 'text-white' : 'text-slate-700'}`}>Prezentace</h4>
              <p className={`text-[11px] leading-tight mt-1 ${currentBoardType === 'presentation' ? 'text-white/75' : 'text-slate-500'}`}>Obrázky a videa</p>
            </div>
          </button>

          <button
            onClick={() => handleBoardTypeChange('pros-cons')}
            className="flex-1 min-w-0 flex flex-col items-center gap-2 px-2.5 py-3 rounded-2xl transition-all text-center"
            style={getBoardTypeButtonStyle(currentBoardType === 'pros-cons')}
          >
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: currentBoardType === 'pros-cons' ? 'rgba(255,255,255,0.14)' : '#ffffff' }}
            >
              <Columns2 className={`w-5 h-5 ${currentBoardType === 'pros-cons' ? 'text-white' : 'text-slate-500'}`} />
            </div>
            <div>
              <h4 className={`font-semibold text-sm leading-tight ${currentBoardType === 'pros-cons' ? 'text-white' : 'text-slate-700'}`}>Pro a proti</h4>
              <p className={`text-[11px] leading-tight mt-1 ${currentBoardType === 'pros-cons' ? 'text-white/75' : 'text-slate-500'}`}>Dva sloupce</p>
            </div>
          </button>
        </div>
      </div>

      {/* Question input */}
      <div className="p-6 border-b border-slate-100">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Otázka / Téma diskuze *
        </label>
        {editingQuestion ? (
          <textarea
            value={slide.question}
            onChange={(e) => onUpdate(slide.id, { question: e.target.value })}
            onBlur={() => setEditingQuestion(false)}
            autoFocus
            placeholder="Co si myslíte o...? Napište svůj názor na..."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition-all resize-none text-lg"
            rows={3}
          />
        ) : (
          <div
            onClick={() => setEditingQuestion(true)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 hover:border-pink-300 cursor-text min-h-[80px] text-lg"
          >
            {slide.question ? (
              <span className="text-[#4E5871]">{slide.question}</span>
            ) : (
              <span className="text-slate-400">Co si myslíte o...? (klikni pro editaci)</span>
            )}
          </div>
        )}
        
        {/* Image section - only for text and presentation types */}
        {currentBoardType !== 'pros-cons' && (
          <div className="mt-4">
            {slide.questionImage ? (
              <div className="space-y-2">
                <div
                  className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50"
                  style={{ width: '250px', height: '250px' }}
                >
                  <img 
                    src={slide.questionImage} 
                    alt="Obrázek k tématu"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAssetPicker(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Nahradit obrázek</span>
                  </button>
                  <button
                    onClick={() => onUpdate(slide.id, { questionImage: undefined })}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Smazat</span>
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setShowAssetPicker(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Přidat obrázek k tématu</span>
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Settings */}
      <div className="p-6 space-y-4">
        <h3 className="text-sm font-medium text-slate-700 mb-3">Další nastavení</h3>
        
        {/* Allow anonymous toggle */}
        <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-slate-500" />
              <span className="font-medium text-slate-700">Anonymní příspěvky</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Jména autorů nebudou viditelná
            </p>
          </div>
          <div 
            className="relative flex-shrink-0"
            style={{ 
              width: '52px', 
              height: '28px', 
              borderRadius: '14px',
              backgroundColor: slide.allowAnonymous ? '#ec4899' : '#94a3b8',
              transition: 'background-color 0.2s ease',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)'
            }}
          >
            <div 
              style={{ 
                position: 'absolute',
                top: '2px',
                left: slide.allowAnonymous ? '26px' : '2px',
                width: '24px', 
                height: '24px', 
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.1)',
                transition: 'left 0.2s ease'
              }}
            />
          </div>
          <input
            type="checkbox"
            checked={slide.allowAnonymous || false}
            onChange={(e) => onUpdate(slide.id, { allowAnonymous: e.target.checked })}
            className="sr-only"
          />
        </label>
        
        {/* Max posts per student */}
        <div className="p-3 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <Hash className="w-4 h-4 text-slate-500" />
            <span className="font-medium text-slate-700">Max příspěvků na žáka</span>
          </div>
          <input
            type="number"
            value={slide.maxPosts || ''}
            onChange={(e) => onUpdate(slide.id, { 
              maxPosts: e.target.value ? parseInt(e.target.value) : undefined 
            })}
            placeholder="Bez limitu"
            min={1}
            max={20}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none text-sm"
          />
        </div>
      </div>
      
      <AssetPicker
        isOpen={showAssetPicker}
        onClose={() => setShowAssetPicker(false)}
        onSelect={handleAssetSelect}
        title="Vybrat obrázek k tématu"
        allowMultiple={false}
      />
    </div>
  );
}

export default BoardSlideEditor;
