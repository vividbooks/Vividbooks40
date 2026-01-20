/**
 * Fill-in-the-Blanks Slide Editor (Doplňování)
 * 
 * Simple editor: type sentence, click words to hide them
 * Single sentence only
 */

import React, { useState } from 'react';
import {
  Puzzle,
  Settings,
  Edit2,
  Check,
  Plus,
  X,
} from 'lucide-react';
import { FillBlanksActivitySlide, BlankItem } from '../../../types/quiz';
import { getContrastColor } from '../../../utils/color-utils';

interface FillBlanksEditorProps {
  slide: FillBlanksActivitySlide;
  onUpdate: (id: string, updates: Partial<FillBlanksActivitySlide>) => void;
}

// Toggle Switch component
const ToggleSwitch = ({ 
  enabled, 
  onChange, 
  label, 
  description 
}: { 
  enabled: boolean; 
  onChange: (v: boolean) => void; 
  label: string;
  description?: string;
}) => (
  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
    <div className="flex-1">
      <span className="font-medium text-slate-700">{label}</span>
      {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
    </div>
    <div 
      className="relative flex-shrink-0"
      style={{ 
        width: '52px', 
        height: '28px', 
        borderRadius: '14px',
        backgroundColor: enabled ? '#7C3AED' : '#94a3b8',
        transition: 'background-color 0.2s ease',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)'
      }}
    >
      <div 
        style={{ 
          position: 'absolute',
          top: '2px',
          left: enabled ? '26px' : '2px',
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
      checked={enabled}
      onChange={(e) => onChange(e.target.checked)}
      className="sr-only"
    />
  </label>
);

export function FillBlanksEditor({ slide, onUpdate }: FillBlanksEditorProps) {
  const [editingInstruction, setEditingInstruction] = useState(false);
  const [isEditingText, setIsEditingText] = useState(!slide.sentences[0]?.text);
  const [editText, setEditText] = useState(slide.sentences[0]?.text || '');
  const [newDistractor, setNewDistractor] = useState('');

  // Get the single sentence
  const sentence = slide.sentences[0] || { id: 'sentence-1', text: '', blanks: [] };

  // Get distractors (wrong answers)
  const distractors: string[] = slide.distractors || [];

  // Parse sentence into words
  const parseWords = (text: string): { word: string; start: number; end: number }[] => {
    const words: { word: string; start: number; end: number }[] = [];
    const regex = /\S+/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      words.push({
        word: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
    return words;
  };

  // Check if a word is a blank
  const isWordBlank = (wordStart: number): BlankItem | undefined => {
    return sentence.blanks.find(b => b.position === wordStart);
  };

  // Toggle word as blank
  const toggleWordBlank = (word: string, start: number) => {
    const existingBlank = sentence.blanks.find(b => b.position === start);
    
    let newBlanks: BlankItem[];
    if (existingBlank) {
      newBlanks = sentence.blanks.filter(b => b.id !== existingBlank.id);
    } else {
      const newBlank: BlankItem = {
        id: `blank-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        text: word.replace(/[.,!?;:]+$/, ''), // Remove trailing punctuation
        position: start,
      };
      newBlanks = [...sentence.blanks, newBlank].sort((a, b) => a.position - b.position);
    }
    
    const newSentences = [{ ...sentence, blanks: newBlanks }];
    onUpdate(slide.id, { sentences: newSentences });
  };

  // Save text
  const saveText = () => {
    if (!editText.trim()) return;
    
    // Recalculate blank positions
    const newBlanks: BlankItem[] = [];
    sentence.blanks.forEach(blank => {
      const newPos = editText.indexOf(blank.text);
      if (newPos !== -1) {
        newBlanks.push({ ...blank, position: newPos });
      }
    });
    
    const newSentences = [{ ...sentence, text: editText, blanks: newBlanks }];
    onUpdate(slide.id, { sentences: newSentences });
    setIsEditingText(false);
  };

  // Add distractor
  const addDistractor = () => {
    if (!newDistractor.trim()) return;
    const newDistractors = [...distractors, newDistractor.trim()];
    onUpdate(slide.id, { distractors: newDistractors });
    setNewDistractor('');
  };

  // Remove distractor
  const removeDistractor = (idx: number) => {
    const newDistractors = distractors.filter((_, i) => i !== idx);
    onUpdate(slide.id, { distractors: newDistractors });
  };

  const words = parseWords(sentence.text);
  const totalBlanks = sentence.blanks.length;

  // Get background color and contrast color for text
  const bgColor = (slide as any).slideBackground?.color || '#ffffff';
  const textColor = getContrastColor(bgColor);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: bgColor, color: textColor }}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-2 text-sm mb-1" style={{ opacity: 0.7 }}>
          <Puzzle className="w-4 h-4" />
          <span>Doplňování</span>
        </div>
        <h2 className="font-bold text-lg">Doplň chybějící slova</h2>
      </div>

      {/* Instruction */}
      <div className="p-4 border-b border-slate-100">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Instrukce
        </label>
        {editingInstruction ? (
          <input
            type="text"
            value={slide.instruction || ''}
            onChange={(e) => onUpdate(slide.id, { instruction: e.target.value })}
            onBlur={() => setEditingInstruction(false)}
            autoFocus
            placeholder="Doplň správná slova..."
            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-orange-500 outline-none"
          />
        ) : (
          <div
            onClick={() => setEditingInstruction(true)}
            className="px-4 py-2 rounded-xl border border-slate-200 hover:border-orange-300 cursor-text"
          >
            {slide.instruction || <span className="text-slate-400">Klikni pro zadání instrukce...</span>}
          </div>
        )}
      </div>

      {/* Sentence editor */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-slate-700">Věta</label>
          {totalBlanks > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium">
              <span>{totalBlanks} {totalBlanks === 1 ? 'mezera' : 'mezer'}</span>
            </div>
          )}
        </div>

        {isEditingText ? (
          <div className="space-y-3">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-orange-500 outline-none resize-none text-lg"
              placeholder="Napiš větu..."
            />
            <div className="flex gap-2">
              <button
                onClick={saveText}
                disabled={!editText.trim()}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Uložit
              </button>
              {sentence.text && (
                <button
                  onClick={() => {
                    setEditText(sentence.text);
                    setIsEditingText(false);
                  }}
                  className="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg"
                >
                  Zrušit
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-slate-500">
                Klikni na slovo pro skrytí/zobrazení
              </div>
              <button
                onClick={() => setIsEditingText(true)}
                className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                title="Upravit text"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>

            {/* Clickable words */}
            <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-xl border border-slate-200 min-h-[80px]">
              {words.length > 0 ? words.map((w, idx) => {
                const isBlank = !!isWordBlank(w.start);
                
                return (
                  <button
                    key={idx}
                    onClick={() => toggleWordBlank(w.word, w.start)}
                    className="px-4 py-2 rounded-xl font-medium text-xl transition-all hover:scale-105"
                    style={{
                      backgroundColor: isBlank ? '#7C3AED' : 'white',
                      color: isBlank ? 'white' : '#4E5871',
                      boxShadow: isBlank 
                        ? '0 4px 12px rgba(124, 58, 237, 0.3)' 
                        : '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                  >
                    {w.word}
                  </button>
                );
              }) : (
                <span className="text-slate-400 text-lg">Prázdná věta - klikni na tužku pro zadání</span>
              )}
            </div>

            {/* Blanks summary */}
            {sentence.blanks.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>Skrytá slova:</span>
                <div className="flex flex-wrap gap-1">
                  {sentence.blanks.map(b => (
                    <span key={b.id} className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">
                      {b.text}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Distractors (wrong answers) */}
      <div className="p-4 border-b border-slate-100">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Špatné odpovědi (distraktory)
        </label>
        <p className="text-xs text-slate-500 mb-3">
          Přidej špatné možnosti, které se zobrazí mezi správnými odpověďmi
        </p>
        
        <div className="flex flex-wrap gap-2 mb-3">
          {distractors.map((d, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-medium"
            >
              {d}
              <button
                onClick={() => removeDistractor(idx)}
                className="p-0.5 rounded-full hover:bg-red-200"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newDistractor}
            onChange={(e) => setNewDistractor(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDistractor()}
            placeholder="Napiš špatnou odpověď..."
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:border-orange-500 outline-none text-sm"
          />
          <button
            onClick={addDistractor}
            disabled={!newDistractor.trim()}
            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
          <Settings className="w-4 h-4" />
          Nastavení
        </div>

        <ToggleSwitch
          enabled={slide.countAsMultiple}
          onChange={(v) => onUpdate(slide.id, { countAsMultiple: v })}
          label="Počítat jako více otázek"
          description={slide.countAsMultiple 
            ? `Každá mezera = 1 bod (celkem ${totalBlanks} bodů)` 
            : 'Celá aktivita = 1 bod'}
        />

        <ToggleSwitch
          enabled={slide.shuffleOptions}
          onChange={(v) => onUpdate(slide.id, { shuffleOptions: v })}
          label="Zamíchat možnosti"
          description="Slova k doplnění budou v náhodném pořadí"
        />
      </div>

      {/* Preview hint */}
      <div className="px-4 pb-4">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Puzzle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h4 className="font-medium text-orange-900">Jak to funguje</h4>
              <p className="text-sm text-orange-700 mt-1">
                Student uvidí větu s mezerami nahoře. 
                Klikne na mezeru a vybere správné slovo z možností dole.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FillBlanksEditor;
