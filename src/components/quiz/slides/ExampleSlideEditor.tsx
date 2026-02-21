/**
 * Example Slide Editor
 * 
 * Simplified editor for example slides - just problem and answer
 * Same structure as Open question, but for examples
 * 
 * Includes reaction GIF settings for correct/wrong answers
 */

import React, { useState } from 'react';
import ReactDOM from 'react-dom';
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
  X,
  Plus,
  Settings,
} from 'lucide-react';
import { ExampleActivitySlide, ExampleKeyboardType, CustomKeyboardKey } from '../../../types/quiz';
import { MathText } from '../../math/MathText';
import MathKeyboard, { NumberPicker, FractionKeyboard, ComparisonPicker, PieFractionPicker } from '../../math/MathKeyboard';
import { AssetPicker } from '../../shared/AssetPicker';
import type { AssetPickerResult } from '../../../types/assets';
import { getContrastColor } from '../../../utils/color-utils';

// Asset picker targets
type AssetPickerTarget = 'problem' | 'correct' | 'wrong';

interface ExampleSlideEditorProps {
  slide: ExampleActivitySlide;
  onUpdate: (id: string, updates: Partial<ExampleActivitySlide>) => void;
  /** Board-level custom keys for simple keyboard */
  customKeys?: [CustomKeyboardKey | null, CustomKeyboardKey | null, CustomKeyboardKey | null];
  onCustomKeysChange?: (keys: [CustomKeyboardKey | null, CustomKeyboardKey | null, CustomKeyboardKey | null]) => void;
  /** Board-level extra keys row for simple keyboard */
  extraKeys?: [CustomKeyboardKey | null, CustomKeyboardKey | null, CustomKeyboardKey | null];
  onExtraKeysChange?: (keys: [CustomKeyboardKey | null, CustomKeyboardKey | null, CustomKeyboardKey | null]) => void;
}

export function ExampleSlideEditor({ slide, onUpdate, customKeys, onCustomKeysChange, extraKeys, onExtraKeysChange }: ExampleSlideEditorProps) {
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [assetPickerTarget, setAssetPickerTarget] = useState<AssetPickerTarget>('problem');
  const [showMathKeyboard, setShowMathKeyboard] = useState(false);
  const [mathTarget, setMathTarget] = useState<'problem' | 'answer'>('problem');
  const [mathValue, setMathValue] = useState('');
  const [editingProblem, setEditingProblem] = useState(false);
  const [showReactionSettings, setShowReactionSettings] = useState(false);
  const [editingAnswerIndex, setEditingAnswerIndex] = useState<number>(-1); // -1 = main answer, 0+ = alternative
  const [showCustomKeysPopup, setShowCustomKeysPopup] = useState(false);
  
  // Handle inserting math expression into problem field
  const handleMathInsert = () => {
    if (!mathValue.trim()) return;
    const mathExpression = `$${mathValue}$`;
    onUpdate(slide.id, { problem: (slide.problem || '') + mathExpression });
    setMathValue('');
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
              setShowMathKeyboard(showMathKeyboard && mathTarget === 'problem' ? false : true);
              setMathValue('');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${showMathKeyboard && mathTarget === 'problem' ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
            title="Vložit matematický zápis"
          >
            <Calculator className="w-4 h-4" />
            Matematika
          </button>
        </div>

        {/* Inline Math Keyboard for problem */}
        {showMathKeyboard && mathTarget === 'problem' && (
          <div className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200" style={{ maxWidth: 340 }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Matematický zápis → Zadání</span>
              <button onClick={() => setShowMathKeyboard(false)} className="p-1 rounded-lg hover:bg-slate-200 text-slate-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <MathKeyboard
              value={mathValue}
              onChange={setMathValue}
              placeholder="Napiš výraz..."
              showPreview={true}
              compact={true}
            />
            <button
              onClick={handleMathInsert}
              disabled={!mathValue.trim()}
              className="mt-2 w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Vložit do zadání
            </button>
          </div>
        )}

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
        
        {/* Image */}
        {slide.media?.url ? (
          <div className="mt-3 flex items-start gap-3">
            <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex-shrink-0" style={{ width: 120, height: 120 }}>
              <img src={slide.media.url} alt="Obrázek k příkladu" className="w-full h-full object-cover" />
              <button
                onClick={() => openAssetPicker('problem')}
                className="absolute bottom-1 right-1 p-1 bg-white/90 text-slate-600 rounded-full hover:bg-white transition-colors shadow-md"
                title="Změnit obrázek"
              >
                <ImageIcon className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={() => onUpdate(slide.id, { media: undefined })}
              className="mt-1 p-1.5 rounded-full hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
              title="Smazat obrázek"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => openAssetPicker('problem')}
            className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ImageIcon className="w-4 h-4 text-indigo-500" />
            Přidat obrázek
          </button>
        )}
      </div>
      
      {/* Correct answers + keyboard — two columns */}
      <div className="px-6 pb-4">
        <div className="flex gap-4">
          {/* Left column: answers + keyboard type */}
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Správné odpovědi *
            </label>

            {/* Main answer */}
            <div
              onClick={() => setEditingAnswerIndex(-1)}
              className={`flex items-center gap-3 mb-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-colors ${
                editingAnswerIndex === -1
                  ? 'border-indigo-400 bg-indigo-50'
                  : slide.finalAnswer
                    ? 'border-emerald-200 bg-emerald-50 hover:border-indigo-300'
                    : 'border-dashed border-slate-200 hover:border-indigo-300'
              }`}
            >
              {slide.finalAnswer ? (
                <>
                  <div className="flex-1 text-lg font-semibold text-slate-800">
                    <MathText>{slide.finalAnswer}</MathText>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onUpdate(slide.id, { finalAnswer: '' }); }}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Smazat"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <span className="text-slate-400 text-sm">Naklikejte odpověď →</span>
              )}
            </div>

            {/* Alternative answers */}
            {(slide.alternativeAnswers || []).map((alt, i) => (
              <div
                key={i}
                onClick={() => setEditingAnswerIndex(i)}
                className={`flex items-center gap-3 mb-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-colors ${
                  editingAnswerIndex === i
                    ? 'border-indigo-400 bg-indigo-50'
                    : alt
                      ? 'border-slate-200 bg-slate-50 hover:border-indigo-300'
                      : 'border-dashed border-slate-200 hover:border-indigo-300'
                }`}
              >
                {alt ? (
                  <>
                    <div className="flex-1 text-lg font-semibold text-slate-800">
                      <MathText>{alt}</MathText>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const updated = [...(slide.alternativeAnswers || [])];
                        updated.splice(i, 1);
                        onUpdate(slide.id, { alternativeAnswers: updated });
                        if (editingAnswerIndex === i) setEditingAnswerIndex(-1);
                        else if (editingAnswerIndex > i) setEditingAnswerIndex(editingAnswerIndex - 1);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Smazat alternativu"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <span className="text-slate-400 text-sm">Naklikejte alternativu →</span>
                )}
              </div>
            ))}

            {/* Add alternative button */}
            <button
              onClick={() => {
                const alts = [...(slide.alternativeAnswers || []), ''];
                onUpdate(slide.id, { alternativeAnswers: alts });
                setEditingAnswerIndex(alts.length - 1);
              }}
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 mt-1 mb-3"
            >
              <Plus className="w-3.5 h-3.5" />
              Přidat alternativní odpověď
            </button>

            <label className="block text-sm font-medium text-slate-700 mb-2">
              Typ klávesnice
            </label>
            <div className="flex gap-2 items-center relative">
              <select
                value={slide.keyboardType || 'simple'}
                onChange={(e) => { onUpdate(slide.id, { keyboardType: e.target.value as ExampleKeyboardType, finalAnswer: '', alternativeAnswers: [] }); setEditingAnswerIndex(-1); }}
                className="flex-1 p-3 rounded-xl border-2 border-slate-200 bg-white text-sm text-slate-700 font-medium focus:border-indigo-500 focus:outline-none transition-colors cursor-pointer"
              >
                <option value="simple">Základní – čísla, čárka, rovná se</option>
                <option value="fraction">Zlomek – čitatel / jmenovatel</option>
                <option value="pie-fraction">Koláč – vizuální zlomek</option>
                <option value="comparison">{'> = <'} – větší, menší, rovná se</option>
                <option value="number-only">Pouze čísla – jedno číslo 0–9</option>
                <option value="full">Rozšířená – zlomky, odmocniny...</option>
              </select>
              {(slide.keyboardType || 'simple') === 'simple' && onCustomKeysChange && (
                <>
                  <button
                    onClick={() => setShowCustomKeysPopup(!showCustomKeysPopup)}
                    className={`p-2.5 rounded-xl border-2 transition-colors flex-shrink-0 ${
                      showCustomKeysPopup
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                        : (customKeys?.some(k => k !== null) || extraKeys?.some(k => k !== null) ? 'border-indigo-300 bg-indigo-50 text-indigo-500' : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:border-slate-300')
                    }`}
                    title="Nastavení speciálních tlačítek"
                  >
                    <Settings className="w-4.5 h-4.5" />
                  </button>
                  {showCustomKeysPopup && (
                    <CustomKeysModal
                      customKeys={customKeys}
                      onCustomKeysChange={onCustomKeysChange!}
                      extraKeys={extraKeys}
                      onExtraKeysChange={onExtraKeysChange}
                      onClose={() => setShowCustomKeysPopup(false)}
                    />
                  )}
                </>
              )}
            </div>

            <label className="block text-sm font-medium text-slate-700 mb-2 mt-4">
              Přípona / jednotka
            </label>
            <input
              type="text"
              value={slide.answerSuffix || ''}
              onChange={(e) => onUpdate(slide.id, { answerSuffix: e.target.value })}
              placeholder="např. dm², kg, cm, Kč..."
              className="w-full p-3 rounded-xl border-2 border-slate-200 bg-white text-sm text-slate-700 font-medium focus:border-indigo-500 focus:outline-none transition-colors placeholder:text-slate-300"
            />
            <p className="mt-1 text-xs text-slate-400">
              Zobrazí se šedě za odpovědí studenta.
            </p>

            <p className="mt-3 text-xs text-slate-400">
              Tip: Odpovědi se porovnávají matematicky.
            </p>
          </div>

          {/* Right column: keyboard — edits the currently selected answer */}
          <div className="flex-1 min-w-0 p-4 rounded-xl" style={{ backgroundColor: '#f1f3f8' }}>
            {(() => {
              const currentValue = editingAnswerIndex === -1
                ? (slide.finalAnswer || '')
                : ((slide.alternativeAnswers || [])[editingAnswerIndex] || '');

              const handleChange = (v: string) => {
                if (editingAnswerIndex === -1) {
                  onUpdate(slide.id, { finalAnswer: v });
                } else {
                  const updated = [...(slide.alternativeAnswers || [])];
                  updated[editingAnswerIndex] = v;
                  onUpdate(slide.id, { alternativeAnswers: updated });
                }
              };

              const kbType = slide.keyboardType || 'simple';

              return kbType === 'number-only' ? (
                <NumberPicker value={currentValue} onChange={handleChange} compact />
              ) : kbType === 'fraction' ? (
                <FractionKeyboard value={currentValue} onChange={handleChange} compact />
              ) : kbType === 'comparison' ? (
                <ComparisonPicker value={currentValue} onChange={handleChange} compact />
              ) : kbType === 'pie-fraction' ? (
                <PieFractionPicker value={currentValue} onChange={handleChange} compact />
              ) : (
                <MathKeyboard
                  value={currentValue}
                  onChange={handleChange}
                  placeholder="Naklikejte odpověď..."
                  showPreview
                  compact
                  keyboardMode={kbType === 'full' ? 'full' : 'simple'}
                  customKeys={kbType === 'simple' ? customKeys?.map(k => k || undefined) as any : undefined}
                  extraKeys={kbType === 'simple' ? extraKeys?.map(k => k || undefined) as any : undefined}
                />
              );
            })()}
          </div>
        </div>
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

/** Standalone modal for custom keyboard keys - rendered via portal to document.body */
function CustomKeysModal({ customKeys, onCustomKeysChange, extraKeys, onExtraKeysChange, onClose }: {
  customKeys?: [CustomKeyboardKey | null, CustomKeyboardKey | null, CustomKeyboardKey | null];
  onCustomKeysChange: (keys: [CustomKeyboardKey | null, CustomKeyboardKey | null, CustomKeyboardKey | null]) => void;
  extraKeys?: [CustomKeyboardKey | null, CustomKeyboardKey | null, CustomKeyboardKey | null];
  onExtraKeysChange?: (keys: [CustomKeyboardKey | null, CustomKeyboardKey | null, CustomKeyboardKey | null]) => void;
  onClose: () => void;
}) {
  const defaults = [{ label: ',', latex: ',' }, { label: '=', latex: '=' }, { label: '−', latex: '-' }];

  return ReactDOM.createPortal(
    <div 
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div 
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} 
        onClick={onClose} 
      />
      <div style={{
        position: 'relative',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: 340,
        maxWidth: 'calc(100vw - 32px)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Speciální tlačítka</span>
          <button 
            onClick={onClose} 
            style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Platí pro celý board.</p>

        <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Nahradit  ,  =  −</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              type="text"
              value={customKeys?.[i]?.label ?? defaults[i].label}
              onChange={(e) => {
                const val = e.target.value.slice(0, 4);
                const newKeys: [CustomKeyboardKey | null, CustomKeyboardKey | null, CustomKeyboardKey | null] = [
                  customKeys?.[0] || null, customKeys?.[1] || null, customKeys?.[2] || null,
                ];
                if (val && val !== defaults[i].label) {
                  newKeys[i] = { label: val, latex: val };
                } else {
                  newKeys[i] = null;
                }
                onCustomKeysChange(newKeys);
              }}
              placeholder={defaults[i].label}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 12, border: '2px solid #e2e8f0', backgroundColor: '#f8fafc',
                textAlign: 'center', fontSize: 22, fontWeight: 700, color: '#334155', outline: 'none', width: '100%',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#6366f1'; e.target.style.backgroundColor = '#fff'; }}
              onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#f8fafc'; }}
            />
          ))}
        </div>

        {onExtraKeysChange && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Přidat řadu navíc</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <input
                  key={i}
                  type="text"
                  value={extraKeys?.[i]?.label ?? ''}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 4);
                    const newKeys: [CustomKeyboardKey | null, CustomKeyboardKey | null, CustomKeyboardKey | null] = [
                      extraKeys?.[0] || null, extraKeys?.[1] || null, extraKeys?.[2] || null,
                    ];
                    newKeys[i] = val ? { label: val, latex: val } : null;
                    onExtraKeysChange(newKeys);
                  }}
                  placeholder="—"
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 12, border: '2px dashed #e2e8f0', backgroundColor: '#fff',
                    textAlign: 'center', fontSize: 22, fontWeight: 700, color: '#334155', outline: 'none', width: '100%',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#6366f1'; e.target.style.backgroundColor = '#eef2ff'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#fff'; }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

export default ExampleSlideEditor;
