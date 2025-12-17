/**
 * ABC Question Slide Editor
 * 
 * Editor for multiple choice questions
 */

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle,
  Circle,
  GripVertical,
  Image as ImageIcon,
  Clock,
  Star,
  Calculator,
} from 'lucide-react';
import { ABCActivitySlide, ABCOption, getOptionLabel } from '../../../types/quiz';
import { MathText } from '../../math/MathText';
import { MathInputModal } from '../../math/MathKeyboard';

interface ABCSlideEditorProps {
  slide: ABCActivitySlide;
  onUpdate: (id: string, updates: Partial<ABCActivitySlide>) => void;
}

export function ABCSlideEditor({ slide, onUpdate }: ABCSlideEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState(false);
  const [editingExplanation, setEditingExplanation] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageUrl, setImageUrl] = useState(slide.media?.url || '');
  const [showMathKeyboard, setShowMathKeyboard] = useState(false);
  const [mathTarget, setMathTarget] = useState<'question' | 'explanation' | string>('question'); // 'question', 'explanation', or option id
  
  // Handle inserting math expression
  const handleMathInsert = (latex: string) => {
    const mathExpression = `$${latex}$`;
    
    if (mathTarget === 'question') {
      onUpdate(slide.id, { question: (slide.question || '') + mathExpression });
    } else if (mathTarget === 'explanation') {
      onUpdate(slide.id, { explanation: (slide.explanation || '') + mathExpression });
    } else {
      // It's an option id
      const option = slide.options.find(o => o.id === mathTarget);
      if (option) {
        updateOption(mathTarget, { content: (option.content || '') + mathExpression });
      }
    }
    setShowMathKeyboard(false);
  };
  
  // Open math keyboard for a specific target
  const openMathKeyboard = (target: 'question' | 'explanation' | string) => {
    setMathTarget(target);
    setShowMathKeyboard(true);
  };
  
  const updateOption = (optionId: string, updates: Partial<ABCOption>) => {
    const newOptions = slide.options.map(opt =>
      opt.id === optionId ? { ...opt, ...updates } : opt
    );
    onUpdate(slide.id, { options: newOptions });
  };
  
  const setCorrectOption = (optionId: string) => {
    const newOptions = slide.options.map(opt => ({
      ...opt,
      isCorrect: opt.id === optionId,
    }));
    onUpdate(slide.id, { options: newOptions });
  };
  
  const addOption = () => {
    const newLabel = getOptionLabel(slide.options.length);
    const newOption: ABCOption = {
      id: newLabel.toLowerCase(),
      label: newLabel,
      content: '',
      isCorrect: false,
    };
    onUpdate(slide.id, { options: [...slide.options, newOption] });
  };
  
  const removeOption = (optionId: string) => {
    if (slide.options.length <= 2) return; // Minimum 2 options
    
    const newOptions = slide.options
      .filter(opt => opt.id !== optionId)
      .map((opt, idx) => ({
        ...opt,
        id: getOptionLabel(idx).toLowerCase(),
        label: getOptionLabel(idx),
      }));
    
    // Ensure at least one is correct
    if (!newOptions.some(opt => opt.isCorrect)) {
      newOptions[0].isCorrect = true;
    }
    
    onUpdate(slide.id, { options: newOptions });
  };
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-4">
        <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
          <CheckCircle className="w-4 h-4" />
          <span>ABC otázka</span>
        </div>
        <h2 className="text-white font-bold text-lg">Výběr z možností</h2>
      </div>
      
      {/* Question input */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700">
            Otázka *
          </label>
          <button
            onClick={() => openMathKeyboard('question')}
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
            placeholder="Zadej otázku... (můžeš použít LaTeX: $\frac{8}{30}$)"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all resize-none text-lg"
            rows={3}
          />
        ) : (
          <div
            onClick={() => setEditingQuestion(true)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 hover:border-emerald-300 cursor-text min-h-[80px] text-lg"
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
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (imageUrl.trim()) {
                    onUpdate(slide.id, { media: { type: 'image', url: imageUrl.trim() } });
                  }
                  setShowImageInput(false);
                }}
                className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600 transition-colors"
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
      
      {/* Options */}
      <div className="p-6">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Možnosti odpovědí
        </label>
        
        <div className="space-y-3">
          {slide.options.map((option, index) => (
            <div
              key={option.id}
              className={`
                group flex items-center gap-3 p-3 rounded-xl border-2 transition-all
                ${option.isCorrect 
                  ? 'border-emerald-500 bg-emerald-50' 
                  : 'border-slate-200 hover:border-slate-300'
                }
              `}
            >
              {/* Drag handle */}
              <div className="text-slate-300 cursor-grab hover:text-slate-400">
                <GripVertical className="w-4 h-4" />
              </div>
              
              {/* Option label */}
              <div 
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0
                  ${option.isCorrect 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-slate-200 text-slate-600'
                  }
                `}
              >
                {option.label}
              </div>
              
              {/* Option content */}
              <div className="flex-1">
                {editingOption === option.id ? (
                  <input
                    type="text"
                    value={option.content}
                    onChange={(e) => updateOption(option.id, { content: e.target.value })}
                    onBlur={() => setEditingOption(null)}
                    autoFocus
                    placeholder={`Odpověď ${option.label}... (můžeš použít $\\frac{1}{2}$)`}
                    className="w-full bg-transparent border-none outline-none text-[#4E5871] placeholder-slate-400"
                  />
                ) : (
                  <div
                    onClick={() => setEditingOption(option.id)}
                    className="cursor-text min-h-[24px] text-[#4E5871]"
                  >
                    {option.content ? (
                      <MathText>{option.content}</MathText>
                    ) : (
                      <span className="text-slate-400">Odpověď {option.label}...</span>
                    )}
                  </div>
                )}
              </div>
              
              {/* Math button for option */}
              <button
                onClick={() => openMathKeyboard(option.id)}
                className="p-2 rounded-lg text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors opacity-0 group-hover:opacity-100"
                title="Vložit matematiku"
              >
                <Calculator className="w-4 h-4" />
              </button>
              
              {/* Correct toggle */}
              <button
                onClick={() => setCorrectOption(option.id)}
                className={`
                  p-2 rounded-lg transition-colors
                  ${option.isCorrect 
                    ? 'text-emerald-600' 
                    : 'text-slate-300 hover:text-emerald-500'
                  }
                `}
                title={option.isCorrect ? 'Správná odpověď' : 'Označit jako správnou'}
              >
                {option.isCorrect ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </button>
              
              {/* Delete option */}
              <button
                onClick={() => removeOption(option.id)}
                className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                title="Smazat možnost"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        
        {/* Add option button */}
        {slide.options.length < 6 && (
          <button
            onClick={addOption}
            className="mt-3 w-full py-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-emerald-300 hover:text-emerald-500 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Přidat možnost
          </button>
        )}
      </div>
      
      {/* Explanation */}
      <div className="px-6 pb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Vysvětlení (zobrazí se po odpovědi)
        </label>
        {editingExplanation ? (
          <textarea
            value={slide.explanation || ''}
            onChange={(e) => onUpdate(slide.id, { explanation: e.target.value })}
            onBlur={() => setEditingExplanation(false)}
            autoFocus
            placeholder="Proč je tato odpověď správná... (můžeš použít LaTeX: $\frac{1}{2}$)"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all resize-none text-sm"
            rows={2}
          />
        ) : (
          <div
            onClick={() => setEditingExplanation(true)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 hover:border-emerald-300 cursor-text min-h-[56px] text-sm"
          >
            {slide.explanation ? (
              <MathText>{slide.explanation}</MathText>
            ) : (
              <span className="text-slate-400">Proč je tato odpověď správná... (klikni pro editaci)</span>
            )}
          </div>
        )}
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
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
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
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
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
    </div>
  );
}

export default ABCSlideEditor;

