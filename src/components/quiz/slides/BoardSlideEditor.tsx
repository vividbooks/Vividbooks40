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
  Video,
  EyeOff,
  Hash,
} from 'lucide-react';
import { BoardActivitySlide } from '../../../types/quiz';

interface BoardSlideEditorProps {
  slide: BoardActivitySlide;
  onUpdate: (id: string, updates: Partial<BoardActivitySlide>) => void;
}

export function BoardSlideEditor({ slide, onUpdate }: BoardSlideEditorProps) {
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageUrl, setImageUrl] = useState(slide.questionImage || '');
  const [editingQuestion, setEditingQuestion] = useState(false);
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-4">
        <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
          <MessageSquare className="w-4 h-4" />
          <span>Nástěnka</span>
        </div>
        <h2 className="text-white font-bold text-lg">Žáci sdílí příspěvky</h2>
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
        
        {/* Image section */}
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
      </div>
      
      {/* Settings */}
      <div className="p-6 space-y-4">
        <h3 className="text-sm font-medium text-slate-700 mb-3">Nastavení nástěnky</h3>
        
        {/* Allow media toggle */}
        <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
          <div className={`w-10 h-6 rounded-full transition-colors relative ${slide.allowMedia ? 'bg-pink-500' : 'bg-slate-300'}`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${slide.allowMedia ? 'left-5' : 'left-1'}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-slate-500" />
              <span className="font-medium text-slate-700">Povolit média v příspěvcích</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Žáci mohou přidat obrázek nebo YouTube video (jako Padlet)
            </p>
          </div>
          <input
            type="checkbox"
            checked={slide.allowMedia}
            onChange={(e) => onUpdate(slide.id, { allowMedia: e.target.checked })}
            className="sr-only"
          />
        </label>
        
        {/* Allow anonymous toggle */}
        <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
          <div className={`w-10 h-6 rounded-full transition-colors relative ${slide.allowAnonymous ? 'bg-pink-500' : 'bg-slate-300'}`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${slide.allowAnonymous ? 'left-5' : 'left-1'}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-slate-500" />
              <span className="font-medium text-slate-700">Anonymní příspěvky</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Jména autorů nebudou viditelná
            </p>
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
              <h4 className="font-medium text-pink-900">Jak to funguje</h4>
              <p className="text-sm text-pink-700 mt-1">
                Žáci uvidí otázku a mohou přidávat příspěvky v reálném čase. 
                Každý může lajkovat příspěvky ostatních. 
                {slide.allowMedia && ' Příspěvky mohou obsahovat obrázky nebo videa.'}
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs text-pink-600">
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Příspěvky
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3" /> Lajky
                </span>
                {slide.allowMedia && (
                  <span className="flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Média
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

