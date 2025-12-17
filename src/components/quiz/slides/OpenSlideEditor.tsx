/**
 * Open Question Slide Editor
 * 
 * Editor for text answer questions
 */

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  MessageSquare,
  Image as ImageIcon,
  Clock,
  Star,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { OpenActivitySlide } from '../../../types/quiz';

interface OpenSlideEditorProps {
  slide: OpenActivitySlide;
  onUpdate: (id: string, updates: Partial<OpenActivitySlide>) => void;
}

export function OpenSlideEditor({ slide, onUpdate }: OpenSlideEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newAnswer, setNewAnswer] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageUrl, setImageUrl] = useState(slide.media?.url || '');
  
  const addCorrectAnswer = () => {
    if (!newAnswer.trim()) return;
    onUpdate(slide.id, { 
      correctAnswers: [...slide.correctAnswers, newAnswer.trim()] 
    });
    setNewAnswer('');
  };
  
  const removeCorrectAnswer = (index: number) => {
    const newAnswers = slide.correctAnswers.filter((_, i) => i !== index);
    onUpdate(slide.id, { correctAnswers: newAnswers });
  };
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-4">
        <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
          <MessageSquare className="w-4 h-4" />
          <span>Otevřená otázka</span>
        </div>
        <h2 className="text-white font-bold text-lg">Textová odpověď</h2>
      </div>
      
      {/* Question input */}
      <div className="p-6 border-b border-slate-100">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Otázka *
        </label>
        <textarea
          value={slide.question}
          onChange={(e) => onUpdate(slide.id, { question: e.target.value })}
          placeholder="Zadej otázku..."
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all resize-none text-lg"
          rows={3}
        />
        
        {/* Image section */}
        {slide.media?.url ? (
          <div className="mt-4 relative">
            <img 
              src={slide.media.url} 
              alt="Obrázek k otázce"
              className="max-w-full max-h-48 rounded-lg border border-slate-200"
            />
            <button
              onClick={() => onUpdate(slide.id, { media: undefined })}
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
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (imageUrl.trim()) {
                    onUpdate(slide.id, { media: { type: 'image', url: imageUrl.trim() } });
                  }
                  setShowImageInput(false);
                }}
                className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 transition-colors"
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
            Přidat obrázek
          </button>
        )}
      </div>
      
      {/* Correct answers */}
      <div className="p-6">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Správné odpovědi
          <span className="font-normal text-slate-400 ml-2">
            (může být více variant)
          </span>
        </label>
        
        {/* Answer list */}
        <div className="space-y-2 mb-3">
          {slide.correctAnswers.map((answer, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200"
            >
              <span className="flex-1 text-amber-800">{answer}</span>
              <button
                onClick={() => removeCorrectAnswer(index)}
                className="p-1.5 rounded-lg text-amber-400 hover:text-red-500 hover:bg-white transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          
          {slide.correctAnswers.length === 0 && (
            <p className="text-sm text-slate-400 italic">
              Žádné správné odpovědi (otázka bude hodnocena manuálně)
            </p>
          )}
        </div>
        
        {/* Add answer input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newAnswer}
            onChange={(e) => setNewAnswer(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCorrectAnswer()}
            placeholder="Přidej správnou odpověď..."
            className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
          />
          <button
            onClick={addCorrectAnswer}
            disabled={!newAnswer.trim()}
            className="px-4 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Přidat
          </button>
        </div>
        
        {/* Case sensitivity toggle */}
        <button
          onClick={() => onUpdate(slide.id, { caseSensitive: !slide.caseSensitive })}
          className="mt-4 flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
        >
          {slide.caseSensitive ? (
            <ToggleRight className="w-5 h-5 text-amber-500" />
          ) : (
            <ToggleLeft className="w-5 h-5 text-slate-400" />
          )}
          <span>Rozlišovat velká/malá písmena</span>
        </button>
      </div>
      
      {/* Explanation */}
      <div className="px-6 pb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Vysvětlení (zobrazí se po odpovědi)
        </label>
        <textarea
          value={slide.explanation || ''}
          onChange={(e) => onUpdate(slide.id, { explanation: e.target.value })}
          placeholder="Vysvětlení správné odpovědi..."
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all resize-none text-sm"
          rows={2}
        />
      </div>
      
      {/* Advanced settings */}
      <div className="border-t border-slate-100">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full p-4 text-left text-sm text-slate-500 hover:bg-slate-50 transition-colors flex items-center justify-between"
        >
          <span>Pokročilá nastavení</span>
          <span className="text-xs">{showAdvanced ? '▲' : '▼'}</span>
        </button>
        
        {showAdvanced && (
          <div className="px-6 pb-6 grid grid-cols-2 gap-4">
            {/* Points */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <Star className="w-4 h-4 text-amber-500" />
                Body
              </label>
              <input
                type="number"
                value={slide.points}
                onChange={(e) => onUpdate(slide.id, { points: parseInt(e.target.value) || 1 })}
                min={1}
                max={10}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none"
              />
            </div>
            
            {/* Time limit */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Časový limit (s)
              </label>
              <input
                type="number"
                value={slide.timeLimit || ''}
                onChange={(e) => onUpdate(slide.id, { 
                  timeLimit: e.target.value ? parseInt(e.target.value) : undefined 
                })}
                placeholder="Bez limitu"
                min={5}
                max={300}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OpenSlideEditor;


