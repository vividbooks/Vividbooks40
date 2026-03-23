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
  X,
  ChevronUp,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface CustomKey {
  label: string;
  latex: string;
}

interface MathKeyboardProps {
  value: string;
  onChange: (value: string) => void;
  onClose?: () => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  showPreview?: boolean;
  /** Gray suffix/unit displayed after the value in the preview area (e.g. "dm²", "kg") */
  suffix?: string;
  mode?: 'inline' | 'block';
  compact?: boolean; // Compact mode for narrow panels
  /** Keyboard variant: 'full' = all features, 'simple' = basic numbers + operators only */
  keyboardMode?: 'full' | 'simple';
  /** Custom keys for the 3 special buttons in simple mode: [key1, key2, key3] replacing [,  =  −] */
  customKeys?: [(CustomKey | null)?, (CustomKey | null)?, (CustomKey | null)?];
  /** Extra row of 3 buttons added below the simple keyboard */
  extraKeys?: [(CustomKey | null)?, (CustomKey | null)?, (CustomKey | null)?];
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
  suffix,
  mode = 'inline',
  compact = false,
  keyboardMode = 'full',
  customKeys,
  extraKeys,
}: MathKeyboardProps) {
  const isSimple = keyboardMode === 'simple';
  const ck0 = customKeys?.[0] || { label: ',', latex: ',' };
  const ck1 = customKeys?.[1] || { label: '=', latex: '=' };
  const ck2 = customKeys?.[2] || { label: '−', latex: '-' };
  const [cursorPosition, setCursorPosition] = useState(value.length);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close "more" menu on outside click
  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMoreMenu]);

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

  // Walk backwards from pos to find the matching opening { for a closing }
  const findOpeningBrace = useCallback((str: string, closePos: number): number => {
    let depth = 0;
    for (let i = closePos; i >= 0; i--) {
      if (str[i] === '}') depth++;
      if (str[i] === '{') { depth--; if (depth === 0) return i; }
    }
    return -1;
  }, []);

  // Detect if position is preceded by a LaTeX command, return start index of command
  const findCommandStart = useCallback((str: string, bracePos: number): number => {
    if (bracePos <= 0) return bracePos;
    // Check for ^{ or _{
    if (str[bracePos - 1] === '^' || str[bracePos - 1] === '_') return bracePos - 1;
    // Check for \commandname{ or \commandname[...]{
    let i = bracePos - 1;
    // Skip optional [...] before {
    if (i >= 0 && str[i] === ']') {
      while (i >= 0 && str[i] !== '[') i--;
      i--;
    }
    // Now walk back over alpha chars to find \command
    const nameEnd = i;
    while (i >= 0 && /[a-zA-Z]/.test(str[i])) i--;
    if (i >= 0 && str[i] === '\\') return i;
    return bracePos;
  }, []);

  // Find the end of a brace-delimited group starting at the opening {
  const findMatchingBrace = useCallback((str: string, openPos: number): number => {
    let depth = 0;
    for (let i = openPos; i < str.length; i++) {
      if (str[i] === '{') depth++;
      if (str[i] === '}') { depth--; if (depth === 0) return i; }
    }
    return str.length - 1;
  }, []);

  // Smart backspace: deletes whole LaTeX commands so value stays valid
  const handleBackspace = useCallback(() => {
    if (cursorPosition <= 0) {
      inputRef.current?.focus();
      return;
    }

    const before = value.slice(0, cursorPosition);
      const after = value.slice(cursorPosition);
    const charBefore = before[before.length - 1];

    // Case 1: Cursor right after }, e.g. \sqrt{...}| or \frac{...}{...}|
    if (charBefore === '}') {
      const openPos = findOpeningBrace(before, before.length - 1);
      if (openPos >= 0) {
        let cmdStart = findCommandStart(before, openPos);
        // For \frac: also consume the second {...} group
        if (before.slice(cmdStart).startsWith('\\frac')) {
          // We're after the second }, delete entire \frac{...}{...}
          const newBefore = before.slice(0, cmdStart);
          onChange(newBefore + after);
          setCursorPosition(newBefore.length);
          inputRef.current?.focus();
          return;
        }
        // Check if this } belongs to the FIRST group of \frac{...}| and there's }{...} after
        // In that case the cursor is between the two groups — delete whole \frac
        if (cmdStart > 0) {
          const newBefore = before.slice(0, cmdStart);
          onChange(newBefore + after);
          setCursorPosition(newBefore.length);
          inputRef.current?.focus();
          return;
        }
      }
    }

    // Case 2: Cursor inside empty braces of a command, e.g. \sqrt{|} or \frac{|}{}
    if (charBefore === '{' && after.startsWith('}')) {
      const cmdStart = findCommandStart(before, before.length - 1);
      if (cmdStart < before.length - 1) {
        // For \frac — delete entire \frac{}{} including the second group
        const cmd = before.slice(cmdStart);
        if (cmd.startsWith('\\frac{')) {
          // after starts with } — find the second {...} after it
          let rest = after.slice(1); // skip the first }
          if (rest.startsWith('{')) {
            const closeIdx = findMatchingBrace('}' + rest, 1);
            rest = rest.slice(closeIdx); // skip {…}
          }
          onChange(before.slice(0, cmdStart) + rest);
          setCursorPosition(cmdStart);
        } else {
          // \sqrt{|} or ^{|} etc — delete command + closing brace
          onChange(before.slice(0, cmdStart) + after.slice(1));
          setCursorPosition(cmdStart);
        }
        inputRef.current?.focus();
        return;
      }
    }

    // Case 3: Cursor right after a backslash
    if (charBefore === '\\') {
      onChange(before.slice(0, -1) + after);
      setCursorPosition(cursorPosition - 1);
      inputRef.current?.focus();
      return;
    }

    // Default: delete one character
    onChange(before.slice(0, -1) + after);
    setCursorPosition(cursorPosition - 1);
    inputRef.current?.focus();
  }, [value, cursorPosition, onChange, findOpeningBrace, findCommandStart, findMatchingBrace]);

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

  // Handle keyboard events in input — route Backspace/Delete through smart handler
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      handleBackspace();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      // Move cursor right then backspace (delete forward)
      if (cursorPosition < value.length) {
        setCursorPosition(cursorPosition + 1);
        handleBackspace();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveCursor('left');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveCursor('right');
    } else if (e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit(value);
    } else if (e.key === 'Escape' && onClose) {
      e.preventDefault();
      onClose();
    }
  };


  // Detect if value contains a fraction
  const hasFraction = value.includes('\\frac{');

  // Current fraction region based on cursor
  const currentFracRegion: 'number' | 'numerator' | 'denominator' = (() => {
    if (!value || !hasFraction) return 'number';
    const before = value.slice(0, cursorPosition);
    if (before.match(/\\frac\{[^}]*$/)) return 'numerator';
    if (before.match(/\\frac\{[^{}]*\}\{[^}]*$/)) return 'denominator';
    return 'number';
  })();

  // Find the fraction nearest to the cursor position
  const findNearestFrac = useCallback((pos: number): number => {
    const positions: number[] = [];
    let from = 0;
    while (true) {
      const idx = value.indexOf('\\frac{', from);
      if (idx === -1) break;
      positions.push(idx);
      from = idx + 1;
    }
    if (positions.length === 0) return -1;
    if (positions.length === 1) return positions[0];

    for (const fp of positions) {
      const numEnd = findMatchingBrace(value, fp + 5);
      const denomEnd = findMatchingBrace(value, numEnd + 1);
      if (pos >= fp && pos <= denomEnd + 1) return fp;
    }

    let nearest = positions[0];
    let minDist = Math.abs(pos - positions[0]);
    for (const fp of positions) {
      const d = Math.abs(pos - fp);
      if (d < minDist) { minDist = d; nearest = fp; }
    }
    return nearest;
  }, [value, findMatchingBrace]);

  // Navigate cursor to a specific part of the fraction nearest to cursor
  const navigateToFracPart = useCallback((part: 'number' | 'numerator' | 'denominator') => {
    const fracIndex = findNearestFrac(cursorPosition);
    if (fracIndex === -1) return;

    if (part === 'numerator') {
      setCursorPosition(fracIndex + 6);
    } else if (part === 'denominator') {
      const numEnd = findMatchingBrace(value, fracIndex + 5);
      if (numEnd + 1 < value.length && value[numEnd + 1] === '{') {
        setCursorPosition(numEnd + 2);
      }
    } else {
      const numEnd = findMatchingBrace(value, fracIndex + 5);
      const denomEnd = findMatchingBrace(value, numEnd + 1);
      setCursorPosition(denomEnd + 1);
    }
    inputRef.current?.focus();
  }, [value, cursorPosition, findNearestFrac, findMatchingBrace]);

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
      
      {/* Preview area */}
      {showPreview && (
        <div className="mx-3" style={{ marginTop: compact ? 8 : 20, marginBottom: compact ? 8 : 12 }}>
          <div 
            className="bg-white rounded-xl flex items-center justify-center border-b-2 border-slate-300 overflow-hidden"
            style={compact ? { padding: '8px 12px', minHeight: 80 } : { padding: 24, minHeight: 160 }}
          >
          {value ? (
              <div 
                style={{ 
                  fontSize: compact 
                    ? `${Math.max(3.6 - Math.max(0, value.length - 15) * 0.05, 1.8)}rem` 
                    : '2.75rem', 
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textAlign: 'center',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'center',
                  gap: 8,
                }} 
                className="text-slate-800 [&_.katex-error]:!text-transparent [&_.katex-error]:!text-[0px] [&_.katex-error]:overflow-hidden [&_.katex-error]:h-0"
              >
                <InlineMath math={value} />
                {suffix && <span style={{ color: '#94a3b8', fontSize: '0.7em', fontWeight: 500 }}>{suffix}</span>}
              </div>
            ) : (
              <span className="text-slate-400" style={{ fontSize: compact ? '1.1rem' : '1.25rem' }}>
                {suffix ? `?  ${suffix}` : placeholder}
              </span>
            )}
          </div>
          {/* Fraction navigation buttons (full mode only) */}
          {!isSimple && hasFraction && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => navigateToFracPart('number')}
                className={`flex-1 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  currentFracRegion === 'number'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                }`}
              >
                Číslo
              </button>
              <button
                onClick={() => navigateToFracPart('numerator')}
                className={`flex-1 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  currentFracRegion === 'numerator'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                }`}
              >
                Čitatel
              </button>
              <button
                onClick={() => navigateToFracPart('denominator')}
                className={`flex-1 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  currentFracRegion === 'denominator'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                }`}
              >
                Jmenovatel
              </button>
            </div>
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
      
      {/* Main keyboard */}
      <div className={`${compact ? 'px-3 pb-3' : 'px-5 pb-5'} space-y-2`}>
        {/* Control row */}
        <div className="flex gap-2">
          <button onClick={handleClear} className="flex-1 aspect-square rounded-full flex items-center justify-center transition-colors hover:opacity-90" style={{ backgroundColor: '#EF4444', maxHeight: compact ? 48 : 56 }} title="Smazat vše">
            <X className={compact ? 'w-5 h-5 text-white' : 'w-6 h-6 text-white'} strokeWidth={3} />
        </button>
          <button onClick={handleBackspace} className="flex-1 aspect-square rounded-full flex items-center justify-center transition-colors hover:opacity-90" style={{ backgroundColor: '#F4A259', maxHeight: compact ? 48 : 56 }} title="Smazat">
            <Delete className={compact ? 'w-5 h-5 text-white' : 'w-6 h-6 text-white'} />
        </button>
          {isSimple ? (
            <button onClick={() => handleKeyPress({ label: ck2.label, latex: ck2.latex })} className="flex-1 aspect-square rounded-full text-slate-600 font-semibold flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1', fontSize: compact ? '1.15rem' : '1.25rem', maxHeight: compact ? 48 : 56 }}>{ck2.label}</button>
          ) : (
            <>
              <button onClick={() => handleKeyPress({ label: '½', latex: '\\frac{}{}', cursorOffset: 3 })} className="flex-1 aspect-square rounded-full flex items-center justify-center transition-colors text-slate-600 hover:opacity-80" style={{ backgroundColor: '#CBD5E1', maxHeight: compact ? 48 : 56, fontSize: '0.85rem' }} title="Zlomek">
                <span style={{ lineHeight: 1 }}><InlineMath math="\frac{a}{b}" /></span>
            </button>
              <button onClick={() => handleKeyPress({ label: '√', latex: '\\sqrt{}', cursorOffset: 1 })} className="flex-1 aspect-square rounded-full flex items-center justify-center transition-colors text-slate-600 hover:opacity-80" style={{ backgroundColor: '#CBD5E1', maxHeight: compact ? 48 : 56, fontSize: compact ? '1.15rem' : '1.25rem' }} title="Odmocnina">√</button>
            </>
          )}
          {!compact && !isSimple && <div className="flex-1" style={{ maxHeight: 56 }} />}
        </div>

        {/* Row 1: 7 8 9 */}
        <div className="flex gap-2">
          <button onClick={() => handleKeyPress({ label: '7', latex: '7' })} className="flex-1 aspect-square rounded-full text-white font-semibold flex items-center justify-center transition-colors hover:opacity-90" style={{ backgroundColor: '#5C6B7A', fontSize: compact ? '1.15rem' : '1.25rem', maxHeight: compact ? 48 : 56 }}>7</button>
          <button onClick={() => handleKeyPress({ label: '8', latex: '8' })} className="flex-1 aspect-square rounded-full text-white font-semibold flex items-center justify-center transition-colors hover:opacity-90" style={{ backgroundColor: '#5C6B7A', fontSize: compact ? '1.15rem' : '1.25rem', maxHeight: compact ? 48 : 56 }}>8</button>
          <button onClick={() => handleKeyPress({ label: '9', latex: '9' })} className="flex-1 aspect-square rounded-full text-white font-semibold flex items-center justify-center transition-colors hover:opacity-90" style={{ backgroundColor: '#5C6B7A', fontSize: compact ? '1.15rem' : '1.25rem', maxHeight: compact ? 48 : 56 }}>9</button>
          {!isSimple && (
            <>
              <button onClick={() => handleKeyPress({ label: ':', latex: ':' })} className="flex-1 aspect-square rounded-full text-slate-600 font-semibold flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1', fontSize: compact ? '1.15rem' : '1.25rem', maxHeight: compact ? 48 : 56 }}>:</button>
              {!compact && <button onClick={() => handleKeyPress({ label: '%', latex: '\\%' })} className="flex-1 aspect-square rounded-full text-slate-600 text-xl flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1', maxHeight: 56 }}>%</button>}
          </>
        )}
      </div>
      
        {/* Row 2: 4 5 6 */}
        <div className="flex gap-2">
          <button onClick={() => handleKeyPress({ label: '4', latex: '4' })} className="flex-1 aspect-square rounded-full text-white font-semibold flex items-center justify-center transition-colors hover:opacity-90" style={{ backgroundColor: '#5C6B7A', fontSize: compact ? '1.15rem' : '1.25rem', maxHeight: compact ? 48 : 56 }}>4</button>
          <button onClick={() => handleKeyPress({ label: '5', latex: '5' })} className="flex-1 aspect-square rounded-full text-white font-semibold flex items-center justify-center transition-colors hover:opacity-90" style={{ backgroundColor: '#5C6B7A', fontSize: compact ? '1.15rem' : '1.25rem', maxHeight: compact ? 48 : 56 }}>5</button>
          <button onClick={() => handleKeyPress({ label: '6', latex: '6' })} className="flex-1 aspect-square rounded-full text-white font-semibold flex items-center justify-center transition-colors hover:opacity-90" style={{ backgroundColor: '#5C6B7A', fontSize: compact ? '1.15rem' : '1.25rem', maxHeight: compact ? 48 : 56 }}>6</button>
          {!isSimple && (
            <>
              <button onClick={() => handleKeyPress({ label: '·', latex: '\\cdot' })} className="flex-1 aspect-square rounded-full text-slate-600 font-semibold flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1', fontSize: compact ? '1.15rem' : '1.25rem', maxHeight: compact ? 48 : 56 }}>·</button>
              {!compact && <button onClick={() => handleKeyPress({ label: 'x²', latex: '^{}', cursorOffset: 1 })} className="flex-1 aspect-square rounded-full text-slate-600 flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1', maxHeight: 56 }}><span className="text-base">x<sup className="text-xs">n</sup></span></button>}
            </>
          )}
        </div>
        
        {/* Row 3: 1 2 3 */}
        <div className="flex gap-2">
          <button onClick={() => handleKeyPress({ label: '1', latex: '1' })} className="flex-1 aspect-square rounded-full text-white font-semibold flex items-center justify-center transition-colors hover:opacity-90" style={{ backgroundColor: '#5C6B7A', fontSize: compact ? '1.15rem' : '1.25rem', maxHeight: compact ? 48 : 56 }}>1</button>
          <button onClick={() => handleKeyPress({ label: '2', latex: '2' })} className="flex-1 aspect-square rounded-full text-white font-semibold flex items-center justify-center transition-colors hover:opacity-90" style={{ backgroundColor: '#5C6B7A', fontSize: compact ? '1.15rem' : '1.25rem', maxHeight: compact ? 48 : 56 }}>2</button>
          <button onClick={() => handleKeyPress({ label: '3', latex: '3' })} className="flex-1 aspect-square rounded-full text-white font-semibold flex items-center justify-center transition-colors hover:opacity-90" style={{ backgroundColor: '#5C6B7A', fontSize: compact ? '1.15rem' : '1.25rem', maxHeight: compact ? 48 : 56 }}>3</button>
          {!isSimple && (
            <>
              <button onClick={() => handleKeyPress({ label: '−', latex: '-' })} className="flex-1 aspect-square rounded-full text-slate-600 font-semibold flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1', fontSize: compact ? '1.15rem' : '1.25rem', maxHeight: compact ? 48 : 56 }}>−</button>
              {!compact && <button onClick={() => handleKeyPress({ label: '()', latex: '()', cursorOffset: 1 })} className="flex-1 aspect-square rounded-full text-slate-600 text-lg flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1', maxHeight: 56 }}>( )</button>}
            </>
          )}
        </div>
        
        {/* Row 4: 0 , = (+) */}
        <div className="flex gap-2">
          <button onClick={() => handleKeyPress({ label: '0', latex: '0' })} className="flex-1 aspect-square rounded-full text-white font-semibold flex items-center justify-center transition-colors hover:opacity-90" style={{ backgroundColor: '#5C6B7A', fontSize: compact ? '1.15rem' : '1.25rem', maxHeight: compact ? 48 : 56 }}>0</button>
          <button onClick={() => handleKeyPress({ label: ck0.label, latex: ck0.latex })} className="flex-1 aspect-square rounded-full text-slate-600 font-semibold flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1', fontSize: compact ? (ck0.label.length > 2 ? '0.85rem' : '1.15rem') : (ck0.label.length > 2 ? '1rem' : '1.25rem'), maxHeight: compact ? 48 : 56 }}>{ck0.label}</button>
          <button onClick={() => handleKeyPress({ label: ck1.label, latex: ck1.latex })} className="flex-1 aspect-square rounded-full text-slate-600 font-semibold flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1', fontSize: compact ? (ck1.label.length > 2 ? '0.85rem' : '1.15rem') : (ck1.label.length > 2 ? '1rem' : '1.25rem'), maxHeight: compact ? 48 : 56 }}>{ck1.label}</button>
          {!isSimple && (
            <>
              <button onClick={() => handleKeyPress({ label: '+', latex: '+' })} className="flex-1 aspect-square rounded-full text-slate-600 font-semibold flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1', fontSize: compact ? '1.15rem' : '1.25rem', maxHeight: compact ? 48 : 56 }}>+</button>
              {!compact && <div className="flex-1" style={{ maxHeight: 56 }} />}
            </>
          )}
        </div>
        
        {/* Extra row: custom additional buttons (simple mode only) */}
        {isSimple && extraKeys && extraKeys.some(k => k) && (
          <div className="flex gap-2">
            {extraKeys.map((ek, i) => {
              if (!ek) return <div key={i} className="flex-1" style={{ maxHeight: compact ? 48 : 56 }} />;
              return (
                <button key={i} onClick={() => handleKeyPress({ label: ek.label, latex: ek.latex })} className="flex-1 aspect-square rounded-full text-slate-600 font-semibold flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1', fontSize: compact ? (ek.label.length > 2 ? '0.85rem' : '1.15rem') : (ek.label.length > 2 ? '1rem' : '1.25rem'), maxHeight: compact ? 48 : 56 }}>{ek.label}</button>
              );
            })}
        </div>
        )}
        
        {/* Row 5: advanced buttons (full mode only) */}
        {!isSimple && (
        <div className="flex gap-2">
          <div className="flex-1 flex gap-1" style={{ maxHeight: compact ? 48 : 56 }}>
            <button onClick={() => handleKeyPress({ label: 'x²', latex: '^{}', cursorOffset: 1 })} className="flex-1 rounded-full text-slate-600 flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1', fontSize: compact ? '0.75rem' : '0.85rem' }} title="Horní index">
              <span>x<sup className="text-[0.55rem]">n</sup></span>
            </button>
            <button onClick={() => handleKeyPress({ label: 'x₂', latex: '_{}', cursorOffset: 1 })} className="flex-1 rounded-full text-slate-600 flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1', fontSize: compact ? '0.75rem' : '0.85rem' }} title="Dolní index">
              <span>x<sub className="text-[0.55rem]">n</sub></span>
            </button>
          </div>
          <div className="flex-1 flex gap-1" style={{ maxHeight: compact ? 48 : 56 }}>
            <button onClick={() => handleKeyPress({ label: '(', latex: '(' })} className="flex-1 rounded-full text-slate-600 font-semibold flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1', fontSize: compact ? '1.15rem' : '1.25rem' }} title="Závorka levá">(</button>
            <button onClick={() => handleKeyPress({ label: ')', latex: ')' })} className="flex-1 rounded-full text-slate-600 font-semibold flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1', fontSize: compact ? '1.15rem' : '1.25rem' }} title="Závorka pravá">)</button>
          </div>
          <button onClick={() => handleKeyPress({ label: '%', latex: '\\%' })} className="flex-1 aspect-square rounded-full text-slate-600 font-semibold flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1', fontSize: compact ? '1.05rem' : '1.15rem', maxHeight: compact ? 48 : 56 }}>%</button>
          <div className="flex-1 relative" style={{ maxHeight: compact ? 48 : 56 }} ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`w-full h-full aspect-square rounded-full flex items-center justify-center transition-colors ${showMoreMenu ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:opacity-80'}`}
              style={showMoreMenu ? {} : { backgroundColor: '#CBD5E1' }}
              title="Více"
            >
              <ChevronUp className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
            </button>
            {showMoreMenu && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 grid grid-cols-4 gap-1.5 z-50" style={{ width: compact ? 220 : 260 }}>
                <button onClick={() => { handleKeyPress({ label: 'x', latex: 'x' }); setShowMoreMenu(false); }} className="aspect-square rounded-xl text-slate-700 font-medium flex items-center justify-center hover:bg-slate-100 transition-colors" style={{ fontSize: '1.1rem' }} title="x">x</button>
                <button onClick={() => { handleKeyPress({ label: '<', latex: '<' }); setShowMoreMenu(false); }} className="aspect-square rounded-xl text-slate-700 font-medium flex items-center justify-center hover:bg-slate-100 transition-colors" style={{ fontSize: '1.1rem' }} title="Menší">&lt;</button>
                <button onClick={() => { handleKeyPress({ label: '>', latex: '>' }); setShowMoreMenu(false); }} className="aspect-square rounded-xl text-slate-700 font-medium flex items-center justify-center hover:bg-slate-100 transition-colors" style={{ fontSize: '1.1rem' }} title="Větší">&gt;</button>
                <button onClick={() => { handleKeyPress({ label: '°', latex: '^{\\circ}' }); setShowMoreMenu(false); }} className="aspect-square rounded-xl text-slate-700 font-medium flex items-center justify-center hover:bg-slate-100 transition-colors" style={{ fontSize: '1.1rem' }} title="Stupeň">°</button>
                <button onClick={() => { handleKeyPress({ label: 'π', latex: '\\pi' }); setShowMoreMenu(false); }} className="aspect-square rounded-xl text-slate-700 font-medium flex items-center justify-center hover:bg-slate-100 transition-colors" style={{ fontSize: '1.1rem' }} title="Pí">π</button>
                <button onClick={() => { handleKeyPress({ label: '∞', latex: '\\infty' }); setShowMoreMenu(false); }} className="aspect-square rounded-xl text-slate-700 font-medium flex items-center justify-center hover:bg-slate-100 transition-colors" style={{ fontSize: '1.1rem' }} title="Nekonečno">∞</button>
                <button onClick={() => { handleKeyPress({ label: 'α', latex: '\\alpha' }); setShowMoreMenu(false); }} className="aspect-square rounded-xl text-slate-700 font-medium flex items-center justify-center hover:bg-slate-100 transition-colors" style={{ fontSize: '1.1rem' }} title="Alfa">α</button>
                <button onClick={() => { handleKeyPress({ label: 'β', latex: '\\beta' }); setShowMoreMenu(false); }} className="aspect-square rounded-xl text-slate-700 font-medium flex items-center justify-center hover:bg-slate-100 transition-colors" style={{ fontSize: '1.1rem' }} title="Beta">β</button>
                <button onClick={() => { handleKeyPress({ label: 'γ', latex: '\\gamma' }); setShowMoreMenu(false); }} className="aspect-square rounded-xl text-slate-700 font-medium flex items-center justify-center hover:bg-slate-100 transition-colors" style={{ fontSize: '1.1rem' }} title="Gama">γ</button>
                <button onClick={() => { handleKeyPress({ label: 'δ', latex: '\\delta' }); setShowMoreMenu(false); }} className="aspect-square rounded-xl text-slate-700 font-medium flex items-center justify-center hover:bg-slate-100 transition-colors" style={{ fontSize: '1.1rem' }} title="Delta">δ</button>
              </div>
            )}
          </div>
          {!compact && <div className="flex-1" style={{ maxHeight: 56 }} />}
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
// NUMBER PICKER COMPONENT
// ============================================

interface NumberPickerProps {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}

/**
 * Simple number picker (0-9) for single-digit answers.
 * No input field — just tap a number to select it.
 */
export function NumberPicker({ value, onChange, compact = false }: NumberPickerProps) {
  const btnSize = compact ? 72 : 84;
  const fontSize = compact ? '1.6rem' : '1.85rem';
  const gap = compact ? 12 : 16;

  const numBtn = (n: number) => {
    const selected = value === String(n);
    return (
      <button
        key={n}
        onClick={() => onChange(String(n))}
        className="flex items-center justify-center font-bold transition-all"
        style={{
          width: btnSize,
          height: btnSize,
          borderRadius: '50%',
          fontSize,
          backgroundColor: selected ? '#4338CA' : '#BFDBFE',
          color: selected ? '#ffffff' : '#6B7280',
          transform: selected ? 'scale(1.12)' : 'scale(1)',
          boxShadow: selected ? '0 4px 20px rgba(67,56,202,0.45)' : 'none',
          border: 'none',
        }}
      >
        {n}
      </button>
    );
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap }}>{[7, 8, 9].map(numBtn)}</div>
        <div style={{ display: 'flex', gap }}>{[4, 5, 6].map(numBtn)}</div>
        <div style={{ display: 'flex', gap }}>{[1, 2, 3].map(numBtn)}</div>
        <div style={{ display: 'flex', gap }}>{numBtn(0)}</div>
      </div>
    </div>
  );
}

// ============================================
// FRACTION KEYBOARD COMPONENT
// ============================================

interface FractionKeyboardProps {
  value: string; // LaTeX value like \frac{3}{8}
  onChange: (value: string) => void;
  compact?: boolean;
}

/**
 * Fraction keyboard — visual fraction display (numerator/denominator)
 * with a simple number pad. Tap on numerator or denominator to select it,
 * then type digits.
 */
export function FractionKeyboard({ value, onChange, compact = false }: FractionKeyboardProps) {
  const [activeField, setActiveField] = useState<'numerator' | 'denominator'>('numerator');
  const fracInputRef = useRef<HTMLInputElement>(null);

  // Keep focus on hidden input for HW keyboard support
  useEffect(() => {
    fracInputRef.current?.focus();
  }, [value, activeField]);

  // Parse current value to extract numerator and denominator
  const parseFrac = (v: string): { num: string; den: string } => {
    const m = v.match(/\\frac\{([^}]*)\}\{([^}]*)\}/);
    if (m) return { num: m[1], den: m[2] };
    return { num: '', den: '' };
  };

  const { num, den } = parseFrac(value);

  const buildValue = (newNum: string, newDen: string) => {
    if (!newNum && !newDen) return '';
    return `\\frac{${newNum}}{${newDen}}`;
  };

  const handleDigit = useCallback((d: string) => {
    if (activeField === 'numerator') {
      onChange(buildValue(num + d, den));
    } else {
      onChange(buildValue(num, den + d));
    }
  }, [activeField, num, den, onChange]);

  const handleBackspace = useCallback(() => {
    if (activeField === 'numerator') {
      onChange(buildValue(num.slice(0, -1), den));
    } else {
      onChange(buildValue(num, den.slice(0, -1)));
    }
  }, [activeField, num, den, onChange]);

  const handleClear = useCallback(() => {
    onChange('');
  }, [onChange]);

  const btnH = compact ? 48 : 56;
  const fontSize = compact ? '1.15rem' : '1.25rem';
  const gap = 6;

  const numBtn = (d: number) => (
    <button
      key={d}
      onClick={() => handleDigit(String(d))}
      className="flex-1 rounded-full text-white font-semibold flex items-center justify-center transition-colors hover:opacity-90"
      style={{ backgroundColor: '#5C6B7A', fontSize, height: btnH }}
    >
      {d}
    </button>
  );

  const fieldStyle = (field: 'numerator' | 'denominator'): React.CSSProperties => ({
    flex: 1,
    textAlign: 'center',
    fontSize: compact ? '1.8rem' : '2.2rem',
    fontWeight: 700,
    padding: compact ? '8px 12px' : '12px 16px',
    minHeight: compact ? 48 : 56,
    cursor: 'pointer',
    borderRadius: 12,
    backgroundColor: activeField === field ? '#EEF2FF' : 'white',
    border: activeField === field ? '2px solid #4F46E5' : '2px solid transparent',
    color: '#1E293B',
    outline: 'none',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  const handleHWKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      handleBackspace();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setActiveField(activeField === 'numerator' ? 'denominator' : 'numerator');
    } else if (/^[0-9,\-]$/.test(e.key)) {
      e.preventDefault();
      handleDigit(e.key);
    }
  }, [activeField, handleBackspace, handleDigit]);

  return (
    <div
      className="flex flex-col bg-[#E8EAF0] rounded-2xl shadow-xl"
      style={{ width: '100%', maxWidth: '100%', padding: compact ? 12 : 16 }}
      onClick={() => fracInputRef.current?.focus()}
    >
      {/* Hidden input for HW keyboard */}
      <input
        ref={fracInputRef}
        type="text"
        className="sr-only"
        onKeyDown={handleHWKeyDown}
        aria-label="Zlomek"
        readOnly
      />
      {/* Fraction display */}
      <div className="bg-white rounded-xl overflow-hidden mb-3" style={{ padding: compact ? 12 : 16 }}>
        {/* Numerator */}
        <div
          onClick={() => setActiveField('numerator')}
          style={fieldStyle('numerator')}
        >
          {num || <span style={{ color: '#94A3B8', fontSize: compact ? '1rem' : '1.1rem', fontWeight: 400 }}>Čitatel</span>}
        </div>

        {/* Fraction line */}
        <div style={{ height: 3, backgroundColor: '#1E293B', margin: '6px 16px', borderRadius: 2 }} />

        {/* Denominator */}
        <div
          onClick={() => setActiveField('denominator')}
          style={fieldStyle('denominator')}
        >
          {den || <span style={{ color: '#94A3B8', fontSize: compact ? '1rem' : '1.1rem', fontWeight: 400 }}>Jmenovatel</span>}
        </div>
      </div>

      {/* Simple numpad */}
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        {/* Control row */}
        <div style={{ display: 'flex', gap }}>
          <button onClick={handleClear} className="flex-1 rounded-full flex items-center justify-center transition-colors hover:opacity-90" style={{ backgroundColor: '#EF4444', height: btnH }}>
            <X className="w-5 h-5 text-white" strokeWidth={3} />
          </button>
          <button onClick={handleBackspace} className="flex-1 rounded-full flex items-center justify-center transition-colors hover:opacity-90" style={{ backgroundColor: '#F4A259', height: btnH }}>
            <Delete className="w-5 h-5 text-white" />
          </button>
          <button onClick={() => handleDigit('-')} className="flex-1 rounded-full text-slate-600 font-semibold flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1', fontSize, height: btnH }}>−</button>
        </div>
        {/* Numbers */}
        <div style={{ display: 'flex', gap }}>{[7, 8, 9].map(numBtn)}</div>
        <div style={{ display: 'flex', gap }}>{[4, 5, 6].map(numBtn)}</div>
        <div style={{ display: 'flex', gap }}>{[1, 2, 3].map(numBtn)}</div>
        <div style={{ display: 'flex', gap }}>
          {numBtn(0)}
          <button onClick={() => handleDigit(',')} className="flex-1 rounded-full text-slate-600 font-semibold flex items-center justify-center transition-colors hover:opacity-80" style={{ backgroundColor: '#CBD5E1', fontSize, height: btnH }}>,</button>
          <button
            onClick={() => setActiveField(activeField === 'numerator' ? 'denominator' : 'numerator')}
            className="flex-1 rounded-full font-semibold flex items-center justify-center transition-colors hover:opacity-80"
            style={{ backgroundColor: '#4F46E5', color: 'white', fontSize: compact ? '0.7rem' : '0.8rem', height: btnH }}
          >
            {activeField === 'numerator' ? '↓ Jmen.' : '↑ Čitat.'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPARISON PICKER COMPONENT
// ============================================

interface ComparisonPickerProps {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}

/**
 * Comparison picker — three buttons: >, =, <
 * Same visual style as NumberPicker (light blue circles).
 */
export function ComparisonPicker({ value, onChange, compact = false }: ComparisonPickerProps) {
  const btnSize = compact ? 72 : 84;
  const fontSize = compact ? '1.8rem' : '2.2rem';
  const gap = compact ? 16 : 20;

  const options = [
    { label: '>', val: '>' },
    { label: '=', val: '=' },
    { label: '<', val: '<' },
  ];

  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap, alignItems: 'center' }}>
        {options.map(opt => {
          const selected = value === opt.val;
          return (
            <button
              key={opt.val}
              onClick={() => onChange(opt.val)}
              className="flex items-center justify-center font-bold transition-all"
              style={{
                width: btnSize,
                height: btnSize,
                borderRadius: '50%',
                fontSize,
                backgroundColor: selected ? '#4338CA' : '#BFDBFE',
                color: selected ? '#ffffff' : '#6B7280',
                transform: selected ? 'scale(1.12)' : 'scale(1)',
                boxShadow: selected ? '0 4px 20px rgba(67,56,202,0.45)' : 'none',
                border: 'none',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// PIE FRACTION PICKER (visual fraction as pie chart)
// ============================================

interface PieFractionPickerProps {
  value: string;
  onChange: (val: string) => void;
  compact?: boolean;
}

export function PieFractionPicker({ value, onChange, compact = false }: PieFractionPickerProps) {
  const [numPies, setNumPies] = useState(1);
  const [slicesPerPie, setSlicesPerPie] = useState(6);
  const [filled, setFilled] = useState<Set<string>>(new Set());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const hasInteracted = useRef(false);

  // Sync fraction value to parent (skip initial mount)
  useEffect(() => {
    if (!hasInteracted.current) return;
    const numerator = filled.size;
    onChangeRef.current(`\\frac{${numerator}}{${slicesPerPie}}`);
  }, [filled, slicesPerPie]);

  const markInteracted = () => { hasInteracted.current = true; };

  const toggleSlice = (pieIdx: number, sliceIdx: number) => {
    markInteracted();
    setFilled(prev => {
      const key = `${pieIdx}-${sliceIdx}`;
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const changeSlices = (delta: number) => {
    markInteracted();
    const newSlices = Math.max(2, Math.min(12, slicesPerPie + delta));
    if (newSlices === slicesPerPie) return;
    // Keep same filled count per pie, capped at new slice count, re-assigned sequentially
    const newFilled = new Set<string>();
    for (let p = 0; p < numPies; p++) {
      let count = 0;
      for (const key of filled) {
        if (key.startsWith(`${p}-`)) count++;
      }
      const capped = Math.min(count, newSlices);
      for (let s = 0; s < capped; s++) {
        newFilled.add(`${p}-${s}`);
      }
    }
    setSlicesPerPie(newSlices);
    setFilled(newFilled);
  };

  const changePies = (delta: number) => {
    markInteracted();
    const newCount = Math.max(1, Math.min(5, numPies + delta));
    if (newCount === numPies) return;
    if (newCount < numPies) {
      const newFilled = new Set<string>();
      for (const key of filled) {
        const pieIdx = parseInt(key.split('-')[0]);
        if (pieIdx < newCount) newFilled.add(key);
      }
      setFilled(newFilled);
    }
    setNumPies(newCount);
  };

  const piesContainerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(300);

  useEffect(() => {
    const el = piesContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setContainerW(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const gap = compact ? 8 : 16;
  const cols = Math.min(numPies, 2);
  const maxPie = compact ? 280 : 340;
  const pieSize = Math.max(80, Math.min(maxPie, Math.floor((containerW - gap * (cols - 1)) / cols)));
  const vb = 200;
  const cx = vb / 2;
  const cy = vb / 2;
  const rd = vb / 2 - 6;
  const totalFilled = filled.size;

  const renderSlice = (pieIdx: number, sliceIdx: number, total: number) => {
    const key = `${pieIdx}-${sliceIdx}`;
    const isFilled = filled.has(key);
    const fillColor = isFilled ? '#3B82F6' : '#BFDBFE';

    if (total === 1) {
      return (
        <circle
          key={sliceIdx}
          cx={cx} cy={cy} r={rd}
          fill={fillColor}
          stroke="white" strokeWidth={3}
          className="pie-sl"
          onClick={() => toggleSlice(pieIdx, sliceIdx)}
        />
      );
    }

    const startAngle = (sliceIdx / total) * 2 * Math.PI - Math.PI / 2;
    const endAngle = ((sliceIdx + 1) / total) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + rd * Math.cos(startAngle);
    const y1 = cy + rd * Math.sin(startAngle);
    const x2 = cx + rd * Math.cos(endAngle);
    const y2 = cy + rd * Math.sin(endAngle);
    const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;

    return (
      <path
        key={sliceIdx}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${rd} ${rd} 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={fillColor}
        stroke="white" strokeWidth={3}
        className="pie-sl"
        onClick={() => toggleSlice(pieIdx, sliceIdx)}
      />
    );
  };

  const disSliceMinus = slicesPerPie <= 2;
  const disSlicePlus = slicesPerPie >= 12;
  const disPieMinus = numPies <= 1;
  const disPiePlus = numPies >= 5;

  const ctrlBtn = (
    color: string, disabled: boolean, icon: string, label: string, action: () => void
  ) => (
    <button
      onClick={action}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: compact ? '8px 16px' : '10px 20px',
        borderRadius: 14,
        backgroundColor: disabled ? '#D1D5DB' : color,
        color: 'white',
        fontWeight: 700,
        fontSize: compact ? 14 : 16,
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'transform 0.1s, opacity 0.2s, background-color 0.2s',
        boxShadow: disabled ? 'none' : `0 2px 8px ${color}44`,
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      {label}
    </button>
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: compact ? 10 : 14,
      width: '100%',
      padding: compact ? 8 : 12,
    }}>
      {/* Pies */}
      <div
        ref={piesContainerRef}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap,
          width: '100%',
        }}
      >
        {Array.from({ length: numPies }, (_, pieIdx) => (
          <svg
            key={pieIdx}
            width={pieSize}
            height={pieSize}
            viewBox={`0 0 200 200`}
            style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.10))' }}
          >
            <style>{`.pie-sl { transition: fill 0.15s ease; cursor: pointer; } .pie-sl:hover { filter: brightness(0.9); }`}</style>
            {Array.from({ length: slicesPerPie }, (_, sliceIdx) =>
              renderSlice(pieIdx, sliceIdx, slicesPerPie)
            )}
          </svg>
        ))}
      </div>

      {/* Slice controls */}
      <div style={{ display: 'flex', gap: 10 }}>
        {ctrlBtn('#3B82F6', disSliceMinus, '−', 'Kousek', () => changeSlices(-1))}
        {ctrlBtn('#3B82F6', disSlicePlus, '+', 'Kousek', () => changeSlices(1))}
      </div>

      {/* Pie controls */}
      <div style={{ display: 'flex', gap: 10 }}>
        {ctrlBtn('#8B5CF6', disPieMinus, '−', 'Koláč', () => changePies(-1))}
        {ctrlBtn('#8B5CF6', disPiePlus, '+', 'Koláč', () => changePies(1))}
      </div>
    </div>
  );
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

