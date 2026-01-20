/**
 * Math Keyboard Component
 * 
 * Interactive keyboard for entering LaTeX mathematical expressions
 * Used in quiz activities (example slides) and anywhere math input is needed
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import {
  Delete,
  CornerDownLeft,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface MathKeyboardProps {
  value: string;
  onChange: (value: string) => void;
  onClose?: () => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  showPreview?: boolean;
  mode?: 'inline' | 'block';
  compact?: boolean; // Compact mode for narrow panels
}

interface KeyButton {
  label: string;
  latex: string;
  display?: string; // LaTeX for display (if different from insert)
  cursorOffset?: number; // How many chars to move cursor back after insert
  description?: string;
}

interface KeyCategory {
  id: string;
  name: string;
  icon?: string;
  keys: KeyButton[];
}

// ============================================
// KEY DEFINITIONS
// ============================================

const keyCategories: KeyCategory[] = [
  {
    id: 'numbers',
    name: 'Čísla',
    keys: [
      { label: '7', latex: '7' },
      { label: '8', latex: '8' },
      { label: '9', latex: '9' },
      { label: ':', latex: ':' },
      { label: '4', latex: '4' },
      { label: '5', latex: '5' },
      { label: '6', latex: '6' },
      { label: '.', latex: '.' },
      { label: '1', latex: '1' },
      { label: '2', latex: '2' },
      { label: '3', latex: '3' },
      { label: '-', latex: '-' },
      { label: '0', latex: '0' },
      { label: ',', latex: ',' },
      { label: '=', latex: '=' },
      { label: '+', latex: '+' },
    ],
  },
  {
    id: 'operators',
    name: 'Operátory',
    keys: [
      { label: '+', latex: '+', description: 'Plus' },
      { label: '-', latex: '-', description: 'Minus' },
      { label: '×', latex: '\\times', description: 'Krát' },
      { label: '÷', latex: '\\div', description: 'Děleno' },
      { label: '±', latex: '\\pm', description: 'Plus minus' },
      { label: '∓', latex: '\\mp', description: 'Minus plus' },
      { label: '·', latex: '\\cdot', description: 'Tečka' },
      { label: '∘', latex: '\\circ', description: 'Stupeň' },
      { label: '≠', latex: '\\neq', description: 'Nerovná se' },
      { label: '≈', latex: '\\approx', description: 'Přibližně' },
      { label: '<', latex: '<', description: 'Menší' },
      { label: '>', latex: '>', description: 'Větší' },
      { label: '≤', latex: '\\leq', description: 'Menší nebo rovno' },
      { label: '≥', latex: '\\geq', description: 'Větší nebo rovno' },
      { label: '∈', latex: '\\in', description: 'Patří' },
      { label: '∉', latex: '\\notin', description: 'Nepatří' },
    ],
  },
  {
    id: 'fractions',
    name: 'Zlomky',
    keys: [
      { label: '½', latex: '\\frac{□}{□}', display: '\\frac{a}{b}', cursorOffset: 4, description: 'Zlomek' },
      { label: '⅓', latex: '\\frac{1}{3}', description: '1/3' },
      { label: '¼', latex: '\\frac{1}{4}', description: '1/4' },
      { label: '⅔', latex: '\\frac{2}{3}', description: '2/3' },
      { label: '¾', latex: '\\frac{3}{4}', description: '3/4' },
      { label: '⅕', latex: '\\frac{1}{5}', description: '1/5' },
    ],
  },
  {
    id: 'powers',
    name: 'Mocniny',
    keys: [
      { label: 'x²', latex: '^{2}', display: 'x^{2}', description: 'Na druhou' },
      { label: 'x³', latex: '^{3}', display: 'x^{3}', description: 'Na třetí' },
      { label: 'xⁿ', latex: '^{□}', display: 'x^{n}', cursorOffset: 1, description: 'Mocnina' },
      { label: '√', latex: '\\sqrt{□}', display: '\\sqrt{x}', cursorOffset: 1, description: 'Odmocnina' },
      { label: '∛', latex: '\\sqrt[3]{□}', display: '\\sqrt[3]{x}', cursorOffset: 1, description: 'Třetí odmocnina' },
      { label: 'ⁿ√', latex: '\\sqrt[□]{□}', display: '\\sqrt[n]{x}', cursorOffset: 4, description: 'N-tá odmocnina' },
      { label: 'x₁', latex: '_{1}', display: 'x_{1}', description: 'Index 1' },
      { label: 'xₙ', latex: '_{□}', display: 'x_{n}', cursorOffset: 1, description: 'Index' },
    ],
  },
  {
    id: 'brackets',
    name: 'Závorky',
    keys: [
      { label: '( )', latex: '(□)', cursorOffset: 1, description: 'Kulaté závorky' },
      { label: '[ ]', latex: '[□]', cursorOffset: 1, description: 'Hranaté závorky' },
      { label: '{ }', latex: '\\{□\\}', cursorOffset: 2, description: 'Složené závorky' },
      { label: '| |', latex: '|□|', cursorOffset: 1, description: 'Absolutní hodnota' },
      { label: '⟨ ⟩', latex: '\\langle □ \\rangle', cursorOffset: 8, description: 'Úhlové závorky' },
      { label: '⌊ ⌋', latex: '\\lfloor □ \\rfloor', cursorOffset: 8, description: 'Dolní celá část' },
      { label: '⌈ ⌉', latex: '\\lceil □ \\rceil', cursorOffset: 7, description: 'Horní celá část' },
    ],
  },
  {
    id: 'greek',
    name: 'Řecká',
    keys: [
      { label: 'α', latex: '\\alpha', description: 'Alfa' },
      { label: 'β', latex: '\\beta', description: 'Beta' },
      { label: 'γ', latex: '\\gamma', description: 'Gama' },
      { label: 'δ', latex: '\\delta', description: 'Delta' },
      { label: 'ε', latex: '\\varepsilon', description: 'Epsilon' },
      { label: 'π', latex: '\\pi', description: 'Pí' },
      { label: 'θ', latex: '\\theta', description: 'Théta' },
      { label: 'λ', latex: '\\lambda', description: 'Lambda' },
      { label: 'μ', latex: '\\mu', description: 'Mí' },
      { label: 'σ', latex: '\\sigma', description: 'Sigma' },
      { label: 'φ', latex: '\\varphi', description: 'Fí' },
      { label: 'ω', latex: '\\omega', description: 'Omega' },
      { label: 'Δ', latex: '\\Delta', description: 'Delta (velké)' },
      { label: 'Σ', latex: '\\Sigma', description: 'Sigma (velké)' },
      { label: 'Π', latex: '\\Pi', description: 'Pí (velké)' },
      { label: 'Ω', latex: '\\Omega', description: 'Omega (velké)' },
    ],
  },
  {
    id: 'functions',
    name: 'Funkce',
    keys: [
      { label: 'sin', latex: '\\sin(□)', cursorOffset: 1, description: 'Sinus' },
      { label: 'cos', latex: '\\cos(□)', cursorOffset: 1, description: 'Kosinus' },
      { label: 'tan', latex: '\\tan(□)', cursorOffset: 1, description: 'Tangens' },
      { label: 'log', latex: '\\log(□)', cursorOffset: 1, description: 'Logaritmus' },
      { label: 'ln', latex: '\\ln(□)', cursorOffset: 1, description: 'Přirozený log' },
      { label: 'lim', latex: '\\lim_{□}', cursorOffset: 1, description: 'Limita' },
      { label: '∑', latex: '\\sum_{□}^{□}', cursorOffset: 4, description: 'Suma' },
      { label: '∏', latex: '\\prod_{□}^{□}', cursorOffset: 4, description: 'Součin' },
      { label: '∫', latex: '\\int_{□}^{□}', cursorOffset: 4, description: 'Integrál' },
      { label: 'e', latex: 'e', description: 'Eulerovo číslo' },
      { label: '∞', latex: '\\infty', description: 'Nekonečno' },
      { label: '∂', latex: '\\partial', description: 'Parciální' },
    ],
  },
  {
    id: 'arrows',
    name: 'Šipky',
    keys: [
      { label: '→', latex: '\\rightarrow', description: 'Šipka vpravo' },
      { label: '←', latex: '\\leftarrow', description: 'Šipka vlevo' },
      { label: '↔', latex: '\\leftrightarrow', description: 'Obousměrná' },
      { label: '⇒', latex: '\\Rightarrow', description: 'Implikace' },
      { label: '⇔', latex: '\\Leftrightarrow', description: 'Ekvivalence' },
      { label: '↑', latex: '\\uparrow', description: 'Šipka nahoru' },
      { label: '↓', latex: '\\downarrow', description: 'Šipka dolů' },
      { label: '↦', latex: '\\mapsto', description: 'Zobrazení' },
    ],
  },
  {
    id: 'sets',
    name: 'Množiny',
    keys: [
      { label: '∪', latex: '\\cup', description: 'Sjednocení' },
      { label: '∩', latex: '\\cap', description: 'Průnik' },
      { label: '⊂', latex: '\\subset', description: 'Podmnožina' },
      { label: '⊆', latex: '\\subseteq', description: 'Podmnožina nebo rovna' },
      { label: '∅', latex: '\\emptyset', description: 'Prázdná množina' },
      { label: 'ℕ', latex: '\\mathbb{N}', description: 'Přirozená čísla' },
      { label: 'ℤ', latex: '\\mathbb{Z}', description: 'Celá čísla' },
      { label: 'ℚ', latex: '\\mathbb{Q}', description: 'Racionální čísla' },
      { label: 'ℝ', latex: '\\mathbb{R}', description: 'Reálná čísla' },
      { label: 'ℂ', latex: '\\mathbb{C}', description: 'Komplexní čísla' },
      { label: '∀', latex: '\\forall', description: 'Pro všechna' },
      { label: '∃', latex: '\\exists', description: 'Existuje' },
    ],
  },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function MathKeyboard({
  value,
  onChange,
  onClose,
  onSubmit,
  placeholder = 'Zadejte matematický výraz...',
  showPreview = true,
  mode = 'inline',
  compact = false,
}: MathKeyboardProps) {
  const [cursorPosition, setCursorPosition] = useState(value.length);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Insert text at cursor position
  const insertAtCursor = useCallback((text: string, cursorOffset: number = 0) => {
    const before = value.slice(0, cursorPosition);
    const after = value.slice(cursorPosition);
    const newValue = before + text + after;
    const newCursorPos = cursorPosition + text.length - cursorOffset;
    
    onChange(newValue);
    setCursorPosition(newCursorPos);
    
    // Replace □ placeholder with empty and adjust cursor
    const placeholderIndex = newValue.indexOf('□');
    if (placeholderIndex !== -1) {
      const cleanedValue = newValue.replace('□', '');
      onChange(cleanedValue);
      setCursorPosition(placeholderIndex);
    }
    
    inputRef.current?.focus();
  }, [value, cursorPosition, onChange]);

  // Handle key press
  const handleKeyPress = useCallback((key: KeyButton) => {
    insertAtCursor(key.latex, key.cursorOffset || 0);
  }, [insertAtCursor]);

  // Handle backspace
  const handleBackspace = useCallback(() => {
    if (cursorPosition > 0) {
      const before = value.slice(0, cursorPosition - 1);
      const after = value.slice(cursorPosition);
      onChange(before + after);
      setCursorPosition(cursorPosition - 1);
    }
    inputRef.current?.focus();
  }, [value, cursorPosition, onChange]);

  // Handle clear
  const handleClear = useCallback(() => {
    onChange('');
    setCursorPosition(0);
    inputRef.current?.focus();
  }, [onChange]);

  // Handle cursor movement
  const moveCursor = useCallback((direction: 'left' | 'right') => {
    if (direction === 'left' && cursorPosition > 0) {
      setCursorPosition(cursorPosition - 1);
    } else if (direction === 'right' && cursorPosition < value.length) {
      setCursorPosition(cursorPosition + 1);
    }
    inputRef.current?.focus();
  }, [cursorPosition, value.length]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setCursorPosition(e.target.selectionStart || e.target.value.length);
  };

  // Handle input selection change
  const handleInputSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    setCursorPosition(target.selectionStart || 0);
  };

  // Handle keyboard events in input
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit(value);
    } else if (e.key === 'Escape' && onClose) {
      e.preventDefault();
      onClose();
    }
  };


  // Render math preview safely
  const renderPreview = () => {
    if (!value) return null;
    
    try {
      if (mode === 'block') {
        return <BlockMath math={value} />;
      }
      return <InlineMath math={value} />;
    } catch (e) {
      return <span className="text-red-500 text-sm">Chyba v zápisu</span>;
    }
  };

  return (
    <div 
      className="flex flex-col bg-[#E8EAF0] rounded-2xl shadow-xl pt-3" 
      style={compact ? { width: '100%', maxWidth: '100%' } : { width: '600px', minWidth: '600px' }}
    >
      {/* Header with submit button */}
      {onSubmit && (
        <button
          onClick={() => onSubmit(value)}
          disabled={!value.trim()}
          className={`mx-3 mb-3 ${compact ? 'py-2 text-sm' : 'py-4 text-lg'} px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-full transition-colors flex items-center justify-center gap-2`}
        >
          {compact ? 'Vložit' : 'Vložit matematický zápis'}
        </button>
      )}
      
      {/* Preview area with cursor indicator */}
      {showPreview && (
        <div className={`bg-white mx-3 ${compact ? 'mt-2 p-3 min-h-[100px]' : 'mt-5 p-6 min-h-[160px]'} rounded-xl flex flex-col items-center justify-center border-b-2 border-slate-300`}>
          {value ? (
            <>
              <div className={`${compact ? 'text-xl' : 'text-4xl'} text-slate-800 mb-2`}>
                {renderPreview()}
              </div>
              {/* LaTeX source with cursor */}
              <div className={`${compact ? 'text-xs px-2 py-1' : 'text-base px-4 py-2'} text-slate-600 font-mono bg-slate-100 rounded-lg flex items-center border-2 border-indigo-200 max-w-full overflow-x-auto`}>
                <span className="whitespace-nowrap">{value.slice(0, cursorPosition)}</span>
                <span className="inline-block w-0.5 h-4 bg-indigo-600 animate-pulse rounded-sm flex-shrink-0" />
                <span className="whitespace-nowrap">{value.slice(cursorPosition)}</span>
              </div>
            </>
          ) : (
            <span className={`text-slate-400 ${compact ? 'text-sm' : 'text-xl'}`}>{placeholder}</span>
          )}
        </div>
      )}
      
      {/* Input field (hidden but functional) */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onSelect={handleInputSelect}
        onKeyDown={handleInputKeyDown}
        className="sr-only"
        aria-label="Matematický výraz"
      />
      
      {/* Control buttons row - same layout as number rows */}
      <div className={`flex gap-1 ${compact ? 'px-2 py-2' : 'px-5 py-3'}`}>
        <button
          onClick={handleBackspace}
          className={`flex-1 ${compact ? 'h-10' : 'h-14'} rounded-xl flex items-center justify-center transition-colors hover:opacity-90`}
          style={{ backgroundColor: '#F4A259' }}
          title="Smazat"
        >
          <Delete className={compact ? 'w-4 h-4 text-white' : 'w-6 h-6 text-white'} />
        </button>
        
        <button
          onClick={handleClear}
          className={`flex-1 ${compact ? 'h-10' : 'h-14'} rounded-xl flex items-center justify-center transition-colors hover:opacity-90`}
          style={{ backgroundColor: '#F4A259' }}
          title="Vymazat vše"
        >
          <CornerDownLeft className={compact ? 'w-4 h-4 text-white' : 'w-6 h-6 text-white'} />
        </button>
        
        <button
          onClick={() => moveCursor('left')}
          className={`flex-1 ${compact ? 'h-10' : 'h-14'} rounded-xl flex items-center justify-center transition-colors hover:opacity-90`}
          style={{ backgroundColor: '#F4A259' }}
          title="Kurzor vlevo"
        >
          <ArrowLeft className={compact ? 'w-4 h-4 text-white' : 'w-6 h-6 text-white'} />
        </button>
        
        <button
          onClick={() => moveCursor('right')}
          className={`flex-1 ${compact ? 'h-10' : 'h-14'} rounded-xl flex items-center justify-center transition-colors hover:opacity-90`}
          style={{ backgroundColor: '#F4A259' }}
          title="Kurzor vpravo"
        >
          <ArrowRight className={compact ? 'w-4 h-4 text-white' : 'w-6 h-6 text-white'} />
        </button>
        
        {!compact && (
          <>
            <button
              onClick={() => handleKeyPress({ label: 'x²', latex: '^{}', cursorOffset: 1 })}
              className="flex-1 h-14 rounded-xl flex items-center justify-center transition-colors text-slate-600 hover:opacity-90"
              style={{ backgroundColor: '#CBD5E1' }}
              title="Horní index"
            >
              <span className="text-base">x<sup className="text-xs">n</sup></span>
            </button>
            
            <button
              onClick={() => handleKeyPress({ label: 'x₂', latex: '_{}', cursorOffset: 1 })}
              className="flex-1 h-14 rounded-xl flex items-center justify-center transition-colors text-slate-600 hover:opacity-90"
              style={{ backgroundColor: '#CBD5E1' }}
              title="Dolní index"
            >
              <span className="text-base">x<sub className="text-xs">n</sub></span>
            </button>
          </>
        )}
      </div>
      
      {/* Main keyboard - using flex rows */}
      <div className={`${compact ? 'px-2 pb-2' : 'px-5 pb-5'} space-y-1`}>
        {/* Row 1 */}
        <div className="flex gap-1">
          <button onClick={() => handleKeyPress({ label: '7', latex: '7' })} className={`flex-1 ${compact ? 'h-10 text-base' : 'h-14 text-xl'} rounded-xl text-white font-medium flex items-center justify-center transition-colors hover:opacity-90`} style={{ backgroundColor: '#5C6B7A' }}>7</button>
          <button onClick={() => handleKeyPress({ label: '8', latex: '8' })} className={`flex-1 ${compact ? 'h-10 text-base' : 'h-14 text-xl'} rounded-xl text-white font-medium flex items-center justify-center transition-colors hover:opacity-90`} style={{ backgroundColor: '#5C6B7A' }}>8</button>
          <button onClick={() => handleKeyPress({ label: '9', latex: '9' })} className={`flex-1 ${compact ? 'h-10 text-base' : 'h-14 text-xl'} rounded-xl text-white font-medium flex items-center justify-center transition-colors hover:opacity-90`} style={{ backgroundColor: '#5C6B7A' }}>9</button>
          <button onClick={() => handleKeyPress({ label: ':', latex: ':' })} className={`flex-1 ${compact ? 'h-10 text-base' : 'h-14 text-xl'} rounded-xl text-white font-medium flex items-center justify-center transition-colors hover:opacity-90`} style={{ backgroundColor: '#5C6B7A' }}>:</button>
          {!compact && <button onClick={() => handleKeyPress({ label: '%', latex: '\\%' })} className="flex-1 h-14 rounded-xl text-slate-600 text-xl flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1' }}>%</button>}
        </div>
        
        {/* Row 2 */}
        <div className="flex gap-1">
          <button onClick={() => handleKeyPress({ label: '4', latex: '4' })} className={`flex-1 ${compact ? 'h-10 text-base' : 'h-14 text-xl'} rounded-xl text-white font-medium flex items-center justify-center transition-colors hover:opacity-90`} style={{ backgroundColor: '#5C6B7A' }}>4</button>
          <button onClick={() => handleKeyPress({ label: '5', latex: '5' })} className={`flex-1 ${compact ? 'h-10 text-base' : 'h-14 text-xl'} rounded-xl text-white font-medium flex items-center justify-center transition-colors hover:opacity-90`} style={{ backgroundColor: '#5C6B7A' }}>5</button>
          <button onClick={() => handleKeyPress({ label: '6', latex: '6' })} className={`flex-1 ${compact ? 'h-10 text-base' : 'h-14 text-xl'} rounded-xl text-white font-medium flex items-center justify-center transition-colors hover:opacity-90`} style={{ backgroundColor: '#5C6B7A' }}>6</button>
          <button onClick={() => handleKeyPress({ label: '·', latex: '\\cdot' })} className={`flex-1 ${compact ? 'h-10 text-base' : 'h-14 text-xl'} rounded-xl text-white font-medium flex items-center justify-center transition-colors hover:opacity-90`} style={{ backgroundColor: '#5C6B7A' }}>·</button>
          {!compact && <button onClick={() => handleKeyPress({ label: '½', latex: '\\frac{}{}', cursorOffset: 3 })} className="flex-1 h-14 rounded-xl text-slate-600 flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1' }} title="Zlomek"><span className="text-sm"><InlineMath math="\frac{a}{b}" /></span></button>}
        </div>
        
        {/* Row 3 */}
        <div className="flex gap-1">
          <button onClick={() => handleKeyPress({ label: '1', latex: '1' })} className={`flex-1 ${compact ? 'h-10 text-base' : 'h-14 text-xl'} rounded-xl text-white font-medium flex items-center justify-center transition-colors hover:opacity-90`} style={{ backgroundColor: '#5C6B7A' }}>1</button>
          <button onClick={() => handleKeyPress({ label: '2', latex: '2' })} className={`flex-1 ${compact ? 'h-10 text-base' : 'h-14 text-xl'} rounded-xl text-white font-medium flex items-center justify-center transition-colors hover:opacity-90`} style={{ backgroundColor: '#5C6B7A' }}>2</button>
          <button onClick={() => handleKeyPress({ label: '3', latex: '3' })} className={`flex-1 ${compact ? 'h-10 text-base' : 'h-14 text-xl'} rounded-xl text-white font-medium flex items-center justify-center transition-colors hover:opacity-90`} style={{ backgroundColor: '#5C6B7A' }}>3</button>
          <button onClick={() => handleKeyPress({ label: '−', latex: '-' })} className={`flex-1 ${compact ? 'h-10 text-base' : 'h-14 text-xl'} rounded-xl text-white font-medium flex items-center justify-center transition-colors hover:opacity-90`} style={{ backgroundColor: '#5C6B7A' }}>−</button>
          {!compact && <button onClick={() => handleKeyPress({ label: '√', latex: '\\sqrt{}', cursorOffset: 1 })} className="flex-1 h-14 rounded-xl text-slate-600 text-xl flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1' }}>√</button>}
        </div>
        
        {/* Row 4 */}
        <div className="flex gap-1">
          <button onClick={() => handleKeyPress({ label: '0', latex: '0' })} className={`flex-1 ${compact ? 'h-10 text-base' : 'h-14 text-xl'} rounded-xl text-white font-medium flex items-center justify-center transition-colors hover:opacity-90`} style={{ backgroundColor: '#5C6B7A' }}>0</button>
          <button onClick={() => handleKeyPress({ label: ',', latex: ',' })} className={`flex-1 ${compact ? 'h-10 text-base' : 'h-14 text-xl'} rounded-xl text-white font-medium flex items-center justify-center transition-colors hover:opacity-90`} style={{ backgroundColor: '#5C6B7A' }}>,</button>
          <button onClick={() => handleKeyPress({ label: '=', latex: '=' })} className={`flex-1 ${compact ? 'h-10 text-base' : 'h-14 text-xl'} rounded-xl text-white font-medium flex items-center justify-center transition-colors hover:opacity-90`} style={{ backgroundColor: '#5C6B7A' }}>=</button>
          <button onClick={() => handleKeyPress({ label: '+', latex: '+' })} className={`flex-1 ${compact ? 'h-10 text-base' : 'h-14 text-xl'} rounded-xl text-white font-medium flex items-center justify-center transition-colors hover:opacity-90`} style={{ backgroundColor: '#5C6B7A' }}>+</button>
          {!compact && <button onClick={() => handleKeyPress({ label: '()', latex: '()', cursorOffset: 1 })} className="flex-1 h-14 rounded-xl text-slate-600 text-lg flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1' }}>( )</button>}
        </div>
        
        {/* Extra row for compact - fractions and special */}
        {compact && (
          <div className="flex gap-1">
            <button onClick={() => handleKeyPress({ label: '½', latex: '\\frac{}{}', cursorOffset: 3 })} className="flex-1 h-10 rounded-xl text-slate-600 text-sm flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1' }} title="Zlomek">a/b</button>
            <button onClick={() => handleKeyPress({ label: '√', latex: '\\sqrt{}', cursorOffset: 1 })} className="flex-1 h-10 rounded-xl text-slate-600 text-base flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1' }}>√</button>
            <button onClick={() => handleKeyPress({ label: 'x²', latex: '^{}', cursorOffset: 1 })} className="flex-1 h-10 rounded-xl text-slate-600 text-sm flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1' }}>x<sup className="text-xs">n</sup></button>
            <button onClick={() => handleKeyPress({ label: '()', latex: '()', cursorOffset: 1 })} className="flex-1 h-10 rounded-xl text-slate-600 text-sm flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1' }}>( )</button>
          </div>
        )}
      </div>
      
      {/* Close button */}
      {onClose && (
        <div className={compact ? 'px-2 pb-2' : 'px-5 pb-5'}>
          <button
            onClick={onClose}
            className={`w-full ${compact ? 'py-2 text-sm' : 'py-4 text-base'} bg-slate-200 hover:bg-slate-300 rounded-xl text-slate-600 font-medium transition-colors`}
          >
            Zavřít
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// MATH DISPLAY COMPONENT
// ============================================

interface MathDisplayProps {
  math: string;
  mode?: 'inline' | 'block';
  className?: string;
}

export function MathDisplay({ math, mode = 'inline', className = '' }: MathDisplayProps) {
  if (!math) return null;
  
  try {
    if (mode === 'block') {
      return (
        <div className={className}>
          <BlockMath math={math} />
        </div>
      );
    }
    return (
      <span className={className}>
        <InlineMath math={math} />
      </span>
    );
  } catch (e) {
    return <span className="text-red-500">Chyba v matematickém zápisu</span>;
  }
}

// ============================================
// MATH INPUT MODAL
// ============================================

interface MathInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (latex: string) => void;
  initialValue?: string;
  title?: string;
}

export function MathInputModal({
  isOpen,
  onClose,
  onSubmit,
  initialValue = '',
  title = 'Vložit matematický výraz',
}: MathInputModalProps) {
  const [value, setValue] = useState(initialValue);
  
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue, isOpen]);
  
  if (!isOpen) return null;
  
  const handleSubmit = (latex: string) => {
    onSubmit(latex);
    onClose();
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-visible">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-10 overflow-visible">
        <MathKeyboard
          value={value}
          onChange={setValue}
          onClose={onClose}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}

export default MathKeyboard;

