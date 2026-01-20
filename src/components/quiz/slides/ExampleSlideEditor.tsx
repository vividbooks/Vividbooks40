/**
 * Example Slide Editor
 * 
 * Simplified editor for example slides - just problem and answer
 * Same structure as Open question, but for examples
 * 
 * Includes reaction GIF settings for correct/wrong answers
 */

import React, { useState } from 'react';
import {
  Lightbulb,
  Image as ImageIcon,
  Trash2,
  Calculator,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ExampleActivitySlide } from '../../../types/quiz';
import { MathText } from '../../math/MathText';
import { MathInputModal } from '../../math/MathKeyboard';
import { AssetPicker } from '../../shared/AssetPicker';
import type { AssetPickerResult } from '../../../types/assets';
import { getContrastColor } from '../../../utils/color-utils';

// Asset picker targets
type AssetPickerTarget = 'problem' | 'correct' | 'wrong';

interface ExampleSlideEditorProps {
  slide: ExampleActivitySlide;
  onUpdate: (id: string, updates: Partial<ExampleActivitySlide>) => void;
}

export function ExampleSlideEditor({ slide, onUpdate }: ExampleSlideEditorProps) {
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [assetPickerTarget, setAssetPickerTarget] = useState<AssetPickerTarget>('problem');
  const [showMathKeyboard, setShowMathKeyboard] = useState(false);
  const [mathTarget, setMathTarget] = useState<'problem' | 'answer'>('problem');
  const [editingProblem, setEditingProblem] = useState(false);
  const [showReactionSettings, setShowReactionSettings] = useState(false);
  
  // Handle inserting math expression
  const handleMathInsert = (latex: string) => {
    const mathExpression = `$${latex}$`;
    if (mathTarget === 'problem') {
      onUpdate(slide.id, { problem: (slide.problem || '') + mathExpression });
    } else {
      onUpdate(slide.id, { finalAnswer: (slide.finalAnswer || '') + mathExpression });
    }
    setShowMathKeyboard(false);
  };

  // Handle asset selection based on target
  const handleAssetSelect = (result: AssetPickerResult) => {
    if (assetPickerTarget === 'problem') {
      onUpdate(slide.id, { media: { type: 'image', url: result.url } });
    } else if (assetPickerTarget === 'correct') {
      onUpdate(slide.id, { 
        correctAnswerMedia: { 
          type: result.mimeType?.includes('gif') ? 'gif' : 'image', 
          url: result.url,
          name: result.name 
        } 
      });
    } else if (assetPickerTarget === 'wrong') {
      onUpdate(slide.id, { 
        wrongAnswerMedia: { 
          type: result.mimeType?.includes('gif') ? 'gif' : 'image', 
          url: result.url,
          name: result.name 
        } 
      });
    }
    setShowAssetPicker(false);
  };

  // Open asset picker with specific target
  const openAssetPicker = (target: AssetPickerTarget) => {
    setAssetPickerTarget(target);
    setShowAssetPicker(true);
  };
  
  // Get background color and contrast color for text
  const bgColor = (slide as any).slideBackground?.color || '#ffffff';
  const textColor = getContrastColor(bgColor);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: bgColor, color: textColor }}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-2 text-sm mb-1" style={{ opacity: 0.7 }}>
          <Lightbulb className="w-4 h-4" />
          <span>Příklad</span>
        </div>
        <h2 className="font-bold text-lg">Matematický příklad</h2>
      </div>
      
      {/* Problem input */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700">
            Zadání *
          </label>
          <button
            onClick={() => {
              setMathTarget('problem');
              setShowMathKeyboard(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
            title="Vložit matematický zápis"
          >
            <Calculator className="w-4 h-4" />
            Matematika
          </button>
        </div>
        {editingProblem ? (
          <textarea
            value={slide.problem}
            onChange={(e) => onUpdate(slide.id, { problem: e.target.value })}
            onBlur={() => setEditingProblem(false)}
            autoFocus
            placeholder="Zadej příklad... (můžeš použít LaTeX: $\frac{1}{2}$)"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all resize-none text-lg"
            rows={3}
          />
        ) : (
          <div
            onClick={() => setEditingProblem(true)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 hover:border-violet-300 cursor-text min-h-[80px] text-lg"
          >
            {slide.problem ? (
              <MathText>{slide.problem}</MathText>
            ) : (
              <span className="text-slate-400">Zadej příklad... (klikni pro editaci)</span>
            )}
          </div>
        )}
        
        {/* Image section */}
        {slide.media?.url ? (
          <div className="mt-4 relative">
            <img 
              src={slide.media.url} 
              alt="Obrázek k příkladu"
              className="max-w-full max-h-48 rounded-lg border border-slate-200"
            />
            <div className="absolute top-2 right-2 flex gap-1">
              <button
                onClick={() => openAssetPicker('problem')}
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
            onClick={() => openAssetPicker('problem')}
            className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Přidat obrázek
          </button>
        )}
      </div>
      
      {/* Correct answer */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700">
            Správná odpověď *
          </label>
          <button
            onClick={() => {
              setMathTarget('answer');
              setShowMathKeyboard(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
            title="Vložit matematický zápis"
          >
            <Calculator className="w-4 h-4" />
            Matematika
          </button>
        </div>
        
        <input
          type="text"
          value={slide.finalAnswer}
          onChange={(e) => onUpdate(slide.id, { finalAnswer: e.target.value })}
          placeholder="Správná odpověď (např. 6,5 nebo $\frac{13}{2}$)"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-lg"
        />
        
        {/* Preview if contains math */}
        {slide.finalAnswer && slide.finalAnswer.includes('$') && (
          <div className="mt-2 p-3 bg-emerald-50 rounded-lg">
            <span className="text-xs text-emerald-600 mb-1 block">Náhled:</span>
            <div className="text-[#4E5871] font-medium">
              <MathText>{slide.finalAnswer}</MathText>
            </div>
          </div>
        )}
        
        <p className="mt-2 text-xs text-slate-400">
          Tip: Odpovědi se porovnávají matematicky. Např. 8/8 = 1, 6,5 = 6.5
        </p>
      </div>
      
      {/* Reaction GIF settings */}
      <div className="border-t border-slate-100">
        <button
          onClick={() => setShowReactionSettings(!showReactionSettings)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-medium text-slate-700">Reakce na odpověď</span>
            {(slide.correctAnswerMedia || slide.wrongAnswerMedia) && (
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                Nastaveno
              </span>
            )}
          </div>
          {showReactionSettings ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>
        
        {showReactionSettings && (
          <div className="px-6 pb-6 space-y-4">
            <p className="text-xs text-slate-500">
              Nastavte GIF nebo obrázek, který se zobrazí studentům po odpovědění.
            </p>
            
            {/* Correct answer reaction */}
            <div className="flex items-start gap-4 p-4 bg-emerald-50 rounded-xl">
              <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <ThumbsUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-emerald-800">Správná odpověď</span>
                </div>
                
                {slide.correctAnswerMedia?.url ? (
                  <div className="relative inline-block">
                    <img 
                      src={slide.correctAnswerMedia.url} 
                      alt="Reakce na správnou odpověď"
                      className="h-20 rounded-lg border border-emerald-200"
                    />
                    <div className="absolute -top-2 -right-2 flex gap-1">
                      <button
                        onClick={() => openAssetPicker('correct')}
                        className="p-1 bg-white text-slate-600 rounded-full shadow hover:bg-slate-50 transition-colors"
                        title="Změnit"
                      >
                        <Sparkles className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onUpdate(slide.id, { correctAnswerMedia: undefined })}
                        className="p-1 bg-red-500 text-white rounded-full shadow hover:bg-red-600 transition-colors"
                        title="Smazat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => openAssetPicker('correct')}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Vybrat GIF / obrázek
                  </button>
                )}
                <p className="mt-2 text-xs text-emerald-600">
                  Tip: Klikněte na "Gify" a vyberte kategorii "Paráda" nebo "Správně"
                </p>
              </div>
            </div>
            
            {/* Wrong answer reaction */}
            <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-xl">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <ThumbsDown className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-amber-800">Špatná odpověď</span>
                </div>
                
                {slide.wrongAnswerMedia?.url ? (
                  <div className="relative inline-block">
                    <img 
                      src={slide.wrongAnswerMedia.url} 
                      alt="Reakce na špatnou odpověď"
                      className="h-20 rounded-lg border border-amber-200"
                    />
                    <div className="absolute -top-2 -right-2 flex gap-1">
                      <button
                        onClick={() => openAssetPicker('wrong')}
                        className="p-1 bg-white text-slate-600 rounded-full shadow hover:bg-slate-50 transition-colors"
                        title="Změnit"
                      >
                        <Sparkles className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onUpdate(slide.id, { wrongAnswerMedia: undefined })}
                        className="p-1 bg-red-500 text-white rounded-full shadow hover:bg-red-600 transition-colors"
                        title="Smazat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => openAssetPicker('wrong')}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Vybrat GIF / obrázek
                  </button>
                )}
                <p className="mt-2 text-xs text-amber-600">
                  Tip: Klikněte na "Gify" a vyberte kategorii "Špatně" nebo "Hmm"
                </p>
              </div>
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
        defaultTab={assetPickerTarget === 'problem' ? 'upload' : 'giphy'}
      />
    </div>
  );
}

export default ExampleSlideEditor;
