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
  Image as ImageIcon,
  Calculator,
  Upload,
  X,
  Shuffle,
  Smile,
  Type,
} from 'lucide-react';
import { ABCActivitySlide, ABCOption, getOptionLabel } from '../../../types/quiz';
import { MathText } from '../../math/MathText';
import MathKeyboard from '../../math/MathKeyboard';
import { AssetPicker } from '../../shared/AssetPicker';
import type { AssetPickerResult } from '../../../types/assets';
import { getContrastColor } from '../../../utils/color-utils';

interface ABCSlideEditorProps {
  slide: ABCActivitySlide;
  onUpdate: (id: string, updates: Partial<ABCActivitySlide>) => void;
}

// Popular emoji categories for picker
const EMOJI_CATEGORIES = {
  'Smajlíci': ['😀', '😃', '😄', '😁', '😆', '🥹', '😅', '😂', '🤣', '🥲', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷'],
  'Gesta': ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '👏', '🙌', '👐', '🤲', '🙏', '💪', '🦾', '🦿'],
  'Symboly': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '⭐', '🌟', '✨', '💫', '🔥', '💯', '✅', '❌', '⚠️', '🎯', '🏆', '🎉'],
  'Příroda': ['🌈', '☀️', '🌤️', '⛅', '🌦️', '🌧️', '⛈️', '🌩️', '❄️', '💨', '🌊', '🌸', '🌺', '🌻', '🌷', '🌱', '🌲', '🌳', '🍀', '🍁', '🍂', '🍃', '🌵', '🌴', '🌾', '🌿', '☘️', '🪴', '🎋', '🎍'],
  'Jídlo': ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🥗', '🍿', '🍩', '🍪', '🎂', '🍰', '🧁'],
  'Zvířata': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌'],
};

export function ABCSlideEditor({ slide, onUpdate }: ABCSlideEditorProps) {
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [showMathKeyboard, setShowMathKeyboard] = useState(false);
  const [mathTarget, setMathTarget] = useState<'question' | 'explanation' | string>('question');
  const [mathValue, setMathValue] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerTarget, setEmojiPickerTarget] = useState<string | null>(null);
  const [emojiCategory, setEmojiCategory] = useState<string>('Smajlíci');

  // Open emoji picker for an option
  const openEmojiPicker = (optionId: string) => {
    setEmojiPickerTarget(optionId);
    setShowEmojiPicker(true);
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    if (emojiPickerTarget) {
      updateOption(emojiPickerTarget, { emojiContent: emoji } as any);
    }
    setShowEmojiPicker(false);
    setEmojiPickerTarget(null);
  };
  
  // Handle asset selection
  const handleAssetSelect = (result: AssetPickerResult) => {
    // If editing an option in image mode, add image to that option
    if (editingOption && (slide as any).answerType === 'image') {
      updateOption(editingOption, { imageUrl: result.url } as any);
      setEditingOption(null);
    } else {
      // Otherwise add to question
      onUpdate(slide.id, { media: { type: 'image', url: result.url } });
    }
    setShowAssetPicker(false);
  };
  
  // Handle inserting math expression from inline keyboard
  const handleMathInsert = () => {
    if (!mathValue.trim()) return;
    const mathExpression = `$${mathValue}$`;
    
    if (mathTarget === 'question') {
      onUpdate(slide.id, { question: (slide.question || '') + mathExpression });
    } else if (mathTarget === 'explanation') {
      onUpdate(slide.id, { explanation: (slide.explanation || '') + mathExpression });
    } else {
      const option = slide.options.find(o => o.id === mathTarget);
      if (option) {
        updateOption(mathTarget, { content: (option.content || '') + mathExpression });
      }
    }
    setMathValue('');
    setShowMathKeyboard(false);
  };
  
  // Open math keyboard for a specific target
  const openMathKeyboard = (target: 'question' | 'explanation' | string) => {
    if (showMathKeyboard && mathTarget === target) {
      setShowMathKeyboard(false);
    } else {
    setMathTarget(target);
      setMathValue('');
    setShowMathKeyboard(true);
    }
  };
  
  const updateOption = (optionId: string, updates: Partial<ABCOption>) => {
    const newOptions = slide.options.map(opt =>
      opt.id === optionId ? { ...opt, ...updates } : opt
    );
    onUpdate(slide.id, { options: newOptions });
  };
  
  const setCorrectOption = (optionId: string) => {
    // Always toggle mode - multiple can be correct
    const newOptions = slide.options.map(opt => ({
      ...opt,
      isCorrect: opt.id === optionId ? !opt.isCorrect : opt.isCorrect,
    }));
    // Ensure at least one is correct
    if (!newOptions.some(opt => opt.isCorrect)) {
      newOptions[0].isCorrect = true;
    }
    onUpdate(slide.id, { options: newOptions, allowMultipleCorrect: true });
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
  
  // Get background color and contrast color for text
  const bgColor = (slide as any).slideBackground?.color || '#ffffff';
  const textColor = getContrastColor(bgColor);
  const isDarkBg = textColor === '#FFFFFF';

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: bgColor, color: textColor }}>
      {/* Header with Math button */}
      <div className="p-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm mb-1" style={{ opacity: 0.7 }}>
            <CheckCircle className="w-4 h-4" />
            <span>ABC otázka</span>
          </div>
          <h2 className="font-bold text-lg">Výběr z možností</h2>
        </div>
        <button
          onClick={() => openMathKeyboard('question')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${showMathKeyboard && mathTarget === 'question' ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
          title="Vložit matematický zápis"
        >
          <Calculator className="w-4 h-4" />
          Matematika
        </button>
      </div>

      {/* Inline Math Keyboard for question */}
      {showMathKeyboard && mathTarget === 'question' && (
        <div className="mx-4 mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200" style={{ maxWidth: 340 }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Matematický zápis → Otázka</span>
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
            Vložit do otázky
          </button>
        </div>
      )}
      
      {/* Question and Image section */}
      <div className="px-6 pb-6 border-b border-slate-100">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Otázka *
        </label>
        {editingQuestion ? (
          <div className="space-y-2">
            <textarea
              value={slide.question}
              onChange={(e) => onUpdate(slide.id, { question: e.target.value })}
              onBlur={() => setEditingQuestion(false)}
              autoFocus
              placeholder="Zadej otázku... (můžeš použít LaTeX: $\\frac{8}{30}$)"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all resize-none text-lg"
              rows={4}
            />
            {slide.question && (slide.question.includes('$') || slide.question.includes('\\')) && (
              <div className="px-4 py-2 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500 mb-1">Náhled:</div>
                <div className="text-lg">
                  <MathText>{slide.question}</MathText>
                </div>
              </div>
            )}
          </div>
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

        <div className="mt-4">
          {slide.media?.url ? (
            <div className="space-y-2">
              <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50" style={{ width: '250px', height: '250px' }}>
                <img 
                  src={slide.media.url} 
                  alt="Obrázek k otázce"
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
                  onClick={() => onUpdate(slide.id, { media: undefined })}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <X className="w-4 h-4" strokeWidth={3} />
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
              <span>Přidat obrázek k otázce</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Options */}
      <div className="p-6">
        {/* Header with controls */}
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-slate-700">
            Možnosti odpovědí
          </label>
          <div className="flex items-center gap-2">
            {/* Answer type dropdown */}
            <select
              value={(slide as any).answerType || 'text'}
              onChange={(e) => onUpdate(slide.id, { answerType: e.target.value } as any)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 font-medium focus:border-indigo-500 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="text">📝 Text</option>
              <option value="image">🖼️ Obrázky</option>
              <option value="emoji">😀 Emoji</option>
              <option value="bubbles">🫧 Bubliny</option>
              <option value="squares">🟦 Čtverce</option>
            </select>
            {/* Shuffle button */}
            <button
              onClick={() => {
                const shuffled = [...slide.options].sort(() => Math.random() - 0.5);
                // Reassign labels A, B, C, D...
                const relabeled = shuffled.map((opt, idx) => ({
                  ...opt,
                  id: getOptionLabel(idx).toLowerCase(),
                  label: getOptionLabel(idx),
                }));
                onUpdate(slide.id, { options: relabeled });
              }}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
              title="Zamíchat odpovědi"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* BUBBLES / SQUARES MODE - Colorful shapes */}
        {(slide as any).answerType === 'bubbles' || (slide as any).answerType === 'squares' ? (
          <div className="flex flex-wrap gap-3 justify-center">
            {slide.options.map((option, idx) => {
              const bubbleColors = ['#93C5FD', '#7DD3FC', '#A5B4FC', '#BAE6FD', '#C7D2FE', '#E0F2FE'];
              const color = bubbleColors[idx % bubbleColors.length];
              return (
                <div key={option.id} className="flex flex-col items-center gap-1.5">
                  <div
                    className="relative flex items-center justify-center cursor-text transition-all"
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: (slide as any).answerType === 'squares' ? 16 : '50%',
                      backgroundColor: color,
                      transform: (slide as any).answerType === 'squares' ? `rotate(${(idx % 2 === 0 ? 1 : -1) * (3 + idx * 2)}deg)` : undefined,
                      boxShadow: option.isCorrect ? '0 0 0 4px rgba(59,130,246,0.2), 0 4px 12px rgba(59,130,246,0.3)' : '0 2px 8px rgba(59,130,246,0.15)',
                      border: option.isCorrect ? '3px solid #10b981' : '3px solid transparent',
                    }}
                    onClick={() => setEditingOption(option.id)}
                  >
                    <span style={{ position: 'absolute', top: 4, fontSize: 10, fontWeight: 800, opacity: 0.45, letterSpacing: 1, color: '#1e3a5f' }}>{String.fromCharCode(65 + idx)}</span>
                    {editingOption === option.id ? (
                      <input
                        type="text"
                        value={option.content}
                        onChange={(e) => updateOption(option.id, { content: e.target.value })}
                        onBlur={() => setEditingOption(null)}
                        autoFocus
                        className="bg-transparent border-none outline-none text-center font-bold"
                        style={{ width: '80%', fontSize: 14, color: '#1e3a5f' }}
                        placeholder="..."
                      />
                    ) : (
                      <span className="font-bold text-sm text-center px-2 leading-tight" style={{ color: '#1e3a5f' }}>
                        {option.content ? <MathText>{option.content}</MathText> : option.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCorrectOption(option.id)}
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: option.isCorrect ? '#10b981' : '#e2e8f0' }}
                      title="Správná odpověď"
                    >
                      {option.isCorrect && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => removeOption(option.id)}
                      className="w-5 h-5 rounded-full flex items-center justify-center transition-colors hover:bg-red-200"
                      style={{ backgroundColor: '#fecaca', color: '#dc2626' }}
                      title="Smazat"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : ((slide as any).answerType === 'image' || (slide as any).answerType === 'emoji') ? (
          <div className="grid grid-cols-4 gap-4">
            {slide.options.map((option) => (
              <div
                key={option.id}
                className="relative group"
                style={{ aspectRatio: '1' }}
              >
                {/* Main card */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`${(slide as any).answerType === 'emoji' ? 'Emoji' : 'Obrázek'} ${option.label}`}
                  className={`
                    w-full h-full rounded-2xl overflow-hidden transition-all cursor-pointer
                    ${option.isCorrect 
                      ? 'ring-4 ring-emerald-400 ring-offset-2' 
                      : 'ring-1 ring-slate-200 hover:ring-2 hover:ring-slate-300'
                    }
                  `}
                  onClick={() => {
                    if ((slide as any).answerType === 'image') {
                      setEditingOption(option.id);
                      setShowAssetPicker(true);
                    } else {
                      // Emoji mode - open emoji picker
                      openEmojiPicker(option.id);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if ((slide as any).answerType === 'image') {
                        setEditingOption(option.id);
                        setShowAssetPicker(true);
                      } else {
                        openEmojiPicker(option.id);
                      }
                    }
                  }}
                  style={{ 
                    backgroundColor: option.isCorrect ? '#ecfdf5' : '#f8fafc',
                  }}
                >
                  {(slide as any).answerType === 'image' ? (
                    // IMAGE
                    (option as any).imageUrl ? (
                      <img 
                        src={(option as any).imageUrl} 
                        alt={option.label}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                        <ImageIcon className="w-8 h-8 mb-1" />
                      </div>
                    )
                  ) : (
                    // EMOJI - click to open picker
                    <div className="w-full h-full flex items-center justify-center">
                      <span 
                        className="text-5xl"
                        style={{ fontFamily: 'Apple Color Emoji, Segoe UI Emoji, sans-serif' }}
                      >
                        {(option as any).emojiContent || '😊'}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Label - below card */}
                <div className="flex items-center justify-center gap-2 mt-2">
                  <div 
                    className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs"
                    style={{
                      backgroundColor: option.isCorrect ? '#10b981' : '#cbd5e1',
                      color: option.isCorrect ? '#ffffff' : '#475569',
                    }}
                  >
                    {option.label}
                  </div>
                  
                  {/* Correct checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setCorrectOption(option.id); }}
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: option.isCorrect ? '#10b981' : '#e2e8f0' }}
                    title="Správná odpověď"
                  >
                    {option.isCorrect && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  
                  {/* Delete - always visible */}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeOption(option.id); }}
                    className="w-5 h-5 rounded-full flex items-center justify-center transition-colors hover:bg-red-200"
                    style={{ backgroundColor: '#fecaca', color: '#dc2626' }}
                    title="Smazat"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // TEXT MODE - List layout
          <div className="space-y-3">
            {slide.options.map((option) => (
              <React.Fragment key={option.id}>
              <div
                className={`
                  group flex items-center gap-3 p-3 rounded-xl border-2 transition-all
                  ${option.isCorrect 
                    ? 'border-emerald-500 bg-emerald-50' 
                    : 'border-slate-200 hover:border-slate-300'
                  }
                `}
              >
                {/* Option label */}
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{
                    backgroundColor: option.isCorrect ? '#10b981' : '#cbd5e1',
                    color: option.isCorrect ? '#ffffff' : '#475569',
                  }}
                >
                  {option.label}
                </div>
                
                {/* Text content */}
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
                
                {/* Math button */}
                <button
                  onClick={() => openMathKeyboard(option.id)}
                  className={`p-2 rounded-lg transition-colors ${showMathKeyboard && mathTarget === option.id ? 'text-indigo-600 bg-indigo-100' : 'text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100'}`}
                  title="Vložit matematiku"
                >
                  <Calculator className="w-4 h-4" />
                </button>
                
                {/* Correct toggle */}
                <button
                  onClick={() => setCorrectOption(option.id)}
                  className="p-2 rounded-lg transition-colors"
                  title={option.isCorrect ? 'Správná odpověď' : 'Označit jako správnou'}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
                    style={{ backgroundColor: option.isCorrect ? '#10b981' : '#e2e8f0' }}
                  >
                    {option.isCorrect ? (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-white" />
                    )}
                  </div>
                </button>
                
                {/* Delete option - always visible, unified X icon */}
                <button
                  onClick={() => removeOption(option.id)}
                  className="w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:bg-red-200"
                  style={{ backgroundColor: '#fecaca', color: '#dc2626' }}
                  title="Smazat možnost"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Inline Math Keyboard for this option */}
              {showMathKeyboard && mathTarget === option.id && (
                <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200" style={{ maxWidth: 340 }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">Matematický zápis → Odpověď {option.label}</span>
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
                    Vložit
                  </button>
                </div>
              )}
              </React.Fragment>
            ))}
          </div>
        )}
        
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
      
      <div className="border-t border-slate-100 px-6 py-6 space-y-4">
        <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="font-medium text-slate-700">Více správných odpovědí</span>
            </div>
          </div>
          <div 
            className="relative flex-shrink-0"
            style={{ 
              width: '52px', 
              height: '28px', 
              borderRadius: '14px',
              backgroundColor: slide.allowMultipleCorrect ? '#10b981' : '#94a3b8',
              transition: 'background-color 0.2s ease',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)'
            }}
          >
            <div 
              style={{ 
                position: 'absolute',
                top: '2px',
                left: slide.allowMultipleCorrect ? '26px' : '2px',
                width: '24px', 
                height: '24px', 
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                transition: 'left 0.2s ease'
              }}
            />
          </div>
          <input
            type="checkbox"
            checked={slide.allowMultipleCorrect || false}
            onChange={(e) => {
              if (!e.target.checked) {
                const firstCorrectIdx = slide.options.findIndex(o => o.isCorrect);
                const newOptions = slide.options.map((opt, idx) => ({
                  ...opt,
                  isCorrect: idx === (firstCorrectIdx >= 0 ? firstCorrectIdx : 0)
                }));
                onUpdate(slide.id, {
                  allowMultipleCorrect: false,
                  multipleCorrectRequirement: undefined,
                  options: newOptions,
                });
              } else {
                onUpdate(slide.id, {
                  allowMultipleCorrect: true,
                  multipleCorrectRequirement: slide.multipleCorrectRequirement || 'all',
                });
              }
            }}
            className="sr-only"
          />
        </label>

        {slide.allowMultipleCorrect && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Pro správnou odpověď je potřeba
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdate(slide.id, { multipleCorrectRequirement: 'all' })}
                className={`p-3 rounded-2xl text-left transition-all ${
                  (slide.multipleCorrectRequirement || 'all') === 'all'
                    ? 'text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                style={(slide.multipleCorrectRequirement || 'all') === 'all' ? { backgroundColor: '#59627B' } : undefined}
              >
                <span className="font-medium">Zaškrtnout všechno</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdate(slide.id, { multipleCorrectRequirement: 'any' })}
                className={`p-3 rounded-2xl text-left transition-all ${
                  slide.multipleCorrectRequirement === 'any'
                    ? 'text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                style={slide.multipleCorrectRequirement === 'any' ? { backgroundColor: '#59627B' } : undefined}
              >
                <span className="font-medium">Zaškrtnout alespoň jeden</span>
              </button>
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
        defaultTab="upload"
      />

      {/* Emoji Picker Modal */}
      {showEmojiPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowEmojiPicker(false)}
          />
          
          {/* Picker */}
          <div className="relative bg-white rounded-2xl shadow-2xl p-4 max-w-md w-full mx-4 max-h-[70vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg text-slate-800">Vyber emoji</h3>
              <button
                onClick={() => setShowEmojiPicker(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            
            {/* Category tabs */}
            <div className="flex gap-1 overflow-x-auto pb-2 mb-3 scrollbar-hide">
              {Object.keys(EMOJI_CATEGORIES).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setEmojiCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    emojiCategory === cat
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            
            {/* Emoji grid */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-8 gap-1">
                {EMOJI_CATEGORIES[emojiCategory as keyof typeof EMOJI_CATEGORIES]?.map((emoji, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleEmojiSelect(emoji)}
                    className="w-10 h-10 rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-center text-2xl"
                    style={{ fontFamily: 'Apple Color Emoji, Segoe UI Emoji, sans-serif' }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ABCSlideEditor;

