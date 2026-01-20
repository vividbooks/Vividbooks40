/**
 * Board (Nástěnka) Slide Editor
 * 
 * Editor for collaborative board/wall activities where students can post and like
 */

import React, { useState } from 'react';
import {
  MessageSquare,
  Image as ImageIcon,
  Trash2,
  Users,
  Heart,
  EyeOff,
  Hash,
  FileText,
  Presentation,
  Scale,
} from 'lucide-react';
import { BoardActivitySlide, BoardType } from '../../../types/quiz';
import { getContrastColor } from '../../../utils/color-utils';

interface BoardSlideEditorProps {
  slide: BoardActivitySlide;
  onUpdate: (id: string, updates: Partial<BoardActivitySlide>) => void;
}

export function BoardSlideEditor({ slide, onUpdate }: BoardSlideEditorProps) {
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageUrl, setImageUrl] = useState(slide.questionImage || '');
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

      {/* Board Type Selector */}
      <div className="p-6 border-b border-slate-100">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Typ nástěnky
        </label>
        <div className="grid grid-cols-3 gap-3">
          {/* Text posts option */}
          <button
            onClick={() => handleBoardTypeChange('text')}
            className="relative p-4 rounded-xl border-2 transition-all text-left"
            style={{
              borderColor: currentBoardType === 'text' ? '#ec4899' : '#e2e8f0',
              backgroundColor: currentBoardType === 'text' ? '#fdf2f8' : '#ffffff',
            }}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ 
                  background: currentBoardType === 'text' 
                    ? 'linear-gradient(135deg, #ec4899, #f43f5e)' 
                    : '#f1f5f9' 
                }}
              >
                <FileText className={`w-6 h-6 ${currentBoardType === 'text' ? 'text-white' : 'text-slate-400'}`} />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 text-sm">Textové příspěvky</h4>
                <p className="text-xs text-slate-500">Jednoduché odpovědi</p>
              </div>
            </div>
            {currentBoardType === 'text' && (
              <div 
                className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)' }}
              >
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>

          {/* Presentation option */}
          <button
            onClick={() => handleBoardTypeChange('presentation')}
            className="relative p-4 rounded-xl border-2 transition-all text-left"
            style={{
              borderColor: currentBoardType === 'presentation' ? '#ec4899' : '#e2e8f0',
              backgroundColor: currentBoardType === 'presentation' ? '#fdf2f8' : '#ffffff',
            }}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ 
                  background: currentBoardType === 'presentation' 
                    ? 'linear-gradient(135deg, #ec4899, #f43f5e)' 
                    : '#f1f5f9' 
                }}
              >
                <Presentation className={`w-6 h-6 ${currentBoardType === 'presentation' ? 'text-white' : 'text-slate-400'}`} />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 text-sm">Společná prezentace</h4>
                <p className="text-xs text-slate-500">S obrázky a videi</p>
              </div>
            </div>
            {currentBoardType === 'presentation' && (
              <div 
                className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)' }}
              >
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>

          {/* Pros and Cons option */}
          <button
            onClick={() => handleBoardTypeChange('pros-cons')}
            className="relative p-4 rounded-xl border-2 transition-all text-left"
            style={{
              borderColor: currentBoardType === 'pros-cons' ? '#ec4899' : '#e2e8f0',
              backgroundColor: currentBoardType === 'pros-cons' ? '#fdf2f8' : '#ffffff',
            }}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ 
                  background: currentBoardType === 'pros-cons' 
                    ? 'linear-gradient(135deg, #ec4899, #f43f5e)' 
                    : '#f1f5f9' 
                }}
              >
                <Scale className={`w-6 h-6 ${currentBoardType === 'pros-cons' ? 'text-white' : 'text-slate-400'}`} />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 text-sm">Pro a proti</h4>
                <p className="text-xs text-slate-500">Dva sloupce</p>
              </div>
            </div>
            {currentBoardType === 'pros-cons' && (
              <div 
                className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)' }}
              >
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Column Labels for Pros-Cons */}
      {currentBoardType === 'pros-cons' && (
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-green-50 to-red-50">
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
          <>
            {slide.questionImage ? (
              <div className="mt-4 relative">
                <img 
                  src={slide.questionImage} 
                  alt="Obrázek k tématu"
                  className="max-w-full max-h-48 rounded-lg border border-slate-200"
                />
                <button
                  onClick={() => onUpdate(slide.id, { questionImage: undefined })}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : showImageInput ? (
              <div className="mt-4 space-y-2">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="URL obrázku (např. https://example.com/obrazek.jpg)"
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (imageUrl.trim()) {
                        onUpdate(slide.id, { questionImage: imageUrl.trim() });
                      }
                      setShowImageInput(false);
                    }}
                    className="px-3 py-1.5 bg-pink-500 text-white rounded-lg text-sm hover:bg-pink-600 transition-colors"
                  >
                    Uložit
                  </button>
                  <button
                    onClick={() => {
                      setShowImageInput(false);
                      setImageUrl('');
                    }}
                    className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-300 transition-colors"
                  >
                    Zrušit
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setShowImageInput(true)}
                className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                Přidat obrázek k tématu
              </button>
            )}
          </>
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
      
      {/* Preview hint */}
      <div className="px-6 pb-6">
        <div className="bg-pink-50 border border-pink-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-pink-100 rounded-lg">
              <Users className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <h4 className="font-medium text-pink-900">
                {currentBoardType === 'text' && 'Textové příspěvky'}
                {currentBoardType === 'presentation' && 'Společná prezentace'}
                {currentBoardType === 'pros-cons' && 'Pro a proti'}
              </h4>
              <p className="text-sm text-pink-700 mt-1">
                {currentBoardType === 'text' && 'Žáci odpovídají krátkými textovými příspěvky. Všechny příspěvky se zobrazí v seznamu.'}
                {currentBoardType === 'presentation' && 'Žáci vytvoří prezentaci společně. Každý příspěvek je jeden slide s textem a médiem.'}
                {currentBoardType === 'pros-cons' && `Žáci přidávají argumenty do dvou sloupců: "${slide.leftColumnLabel || 'Pro'}" a "${slide.rightColumnLabel || 'Proti'}".`}
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs text-pink-600">
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Příspěvky
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3" /> Lajky
                </span>
                {currentBoardType === 'presentation' && (
                  <span className="flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Média
                  </span>
                )}
                {currentBoardType === 'pros-cons' && (
                  <span className="flex items-center gap-1">
                    <Scale className="w-3 h-3" /> Dva sloupce
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BoardSlideEditor;
