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
  Calculator,
  Sparkles,
} from 'lucide-react';
import { OpenActivitySlide } from '../../../types/quiz';
import { MathText } from '../../math/MathText';
import { MathInputModal } from '../../math/MathKeyboard';
import { AssetPicker } from '../../shared/AssetPicker';
import type { AssetPickerResult } from '../../../types/assets';
import { getContrastColor } from '../../../utils/color-utils';

interface OpenSlideEditorProps {
  slide: OpenActivitySlide;
  onUpdate: (id: string, updates: Partial<OpenActivitySlide>) => void;
}

export function OpenSlideEditor({ slide, onUpdate }: OpenSlideEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newAnswer, setNewAnswer] = useState('');
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [showMathKeyboard, setShowMathKeyboard] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(false);
  
  // Handle inserting math expression
  const handleMathInsert = (latex: string) => {
    const mathExpression = `$${latex}$`;
    onUpdate(slide.id, { question: (slide.question || '') + mathExpression });
    setShowMathKeyboard(false);
  };

  // Handle asset selection
  const handleAssetSelect = (result: AssetPickerResult) => {
    onUpdate(slide.id, { media: { type: 'image', url: result.url } });
    setShowAssetPicker(false);
  };
  
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
  
  // Get background color and contrast color for text
  const bgColor = (slide as any).slideBackground?.color || '#ffffff';
  const textColor = getContrastColor(bgColor);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: bgColor, color: textColor }}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-2 text-sm mb-1" style={{ opacity: 0.7 }}>
          <MessageSquare className="w-4 h-4" />
          <span>Otevřená otázka</span>
        </div>
        <h2 className="font-bold text-lg">Textová odpověď</h2>
      </div>
      
      {/* Question input */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700">
            Otázka *
          </label>
          <button
            onClick={() => setShowMathKeyboard(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
            title="Vložit matematický zápis"
          >
            <Calculator className="w-4 h-4" />
            Matematika
          </button>
        </div>
        {editingQuestion ? (
          <textarea
            value={slide.question}
            onChange={(e) => onUpdate(slide.id, { question: e.target.value })}
            onBlur={() => setEditingQuestion(false)}
            autoFocus
            placeholder="Zadej otázku... (můžeš použít LaTeX: $\frac{1}{2}$)"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all resize-none text-lg"
            rows={3}
          />
        ) : (
          <div
            onClick={() => setEditingQuestion(true)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 hover:border-amber-300 cursor-text min-h-[80px] text-lg"
          >
            {slide.question ? (
              <MathText>{slide.question}</MathText>
            ) : (
              <span className="text-slate-400">Zadej otázku... (klikni pro editaci)</span>
            )}
          </div>
        )}
        
        {/* Image section */}
        {slide.media?.url ? (
          <div className="mt-4 relative">
            <img 
              src={slide.media.url} 
              alt="Obrázek k otázce"
              className="max-w-full max-h-48 rounded-lg border border-slate-200"
            />
            <div className="absolute top-2 right-2 flex gap-1">
              <button
                onClick={() => setShowAssetPicker(true)}
                className="p-1.5 bg-white/90 text-slate-600 rounded-full hover:bg-white transition-colors"
                title="Změnit obrázek"
              >
                <Sparkles className="w-4 h-4" />
              </button>
              <button
                onClick={() => onUpdate(slide.id, { media: undefined })}
                className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                title="Smazat obrázek"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setShowAssetPicker(true)}
            className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-indigo-500" />
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
      
      {/* Math Keyboard Modal */}
      <MathInputModal
        isOpen={showMathKeyboard}
        onClose={() => setShowMathKeyboard(false)}
        onSubmit={handleMathInsert}
        title="Vložit matematický výraz"
      />

      {/* Asset Picker Modal */}
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
      />
    </div>
  );
}

export default OpenSlideEditor;


