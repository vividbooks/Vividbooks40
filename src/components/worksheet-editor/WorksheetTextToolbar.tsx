/**
 * WorksheetTextToolbar
 * 
 * Text formatting toolbar displayed above a block when editing text.
 * Matches VividBoard's SlideTextToolbar with all formatting options.
 */

import React, { useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
  Type,
  List,
  ListOrdered,
  ListChecks,
  Superscript,
  Subscript,
  Sparkles,
} from 'lucide-react';

// Available font sizes (in pt) - reduced selection up to 64
const FONT_SIZES = [9, 12, 18, 24, 36, 48, 64] as const;
type FontSizeValue = typeof FONT_SIZES[number];

interface WorksheetTextToolbarProps {
  // Text formatting state
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  fontSize?: number; // Font size in pt (8-68)
  textColor?: string;
  highlightColor?: string;
  listType?: 'none' | 'bullet' | 'numbered' | 'checklist';
  // Callbacks
  onBoldToggle?: () => void;
  onItalicToggle?: () => void;
  onUnderlineToggle?: () => void;
  onAlignChange?: (align: 'left' | 'center' | 'right') => void;
  onFontSizeChange?: (size: number) => void;
  onTextColorChange?: (color: string) => void;
  onHighlightColorChange?: (color: string) => void;
  onListTypeChange?: (type: 'none' | 'bullet' | 'numbered' | 'checklist') => void;
  onInsertSymbol?: (symbol: string) => void;
  onOpenAI?: () => void;
}

export function WorksheetTextToolbar({
  isBold = false,
  isItalic = false,
  isUnderline = false,
  textAlign = 'left',
  fontSize = 12,
  textColor = '#000000',
  highlightColor = 'transparent',
  listType = 'none',
  onBoldToggle,
  onItalicToggle,
  onUnderlineToggle,
  onAlignChange,
  onFontSizeChange,
  onTextColorChange,
  onHighlightColorChange,
  onListTypeChange,
  onInsertSymbol,
  onOpenAI,
}: WorksheetTextToolbarProps) {
  const [showTextDropdown, setShowTextDropdown] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [showListDropdown, setShowListDropdown] = useState(false);
  const [showMathDropdown, setShowMathDropdown] = useState(false);
  const [showAlignDropdown, setShowAlignDropdown] = useState(false);

  const closeAllDropdowns = () => {
    setShowTextDropdown(false);
    setShowSizeDropdown(false);
    setShowColorDropdown(false);
    setShowListDropdown(false);
    setShowMathDropdown(false);
    setShowAlignDropdown(false);
  };

  const textColors = [
    '#000000', '#6b7280', '#dc2626', '#ea580c', '#ca8a04',
    '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777',
  ];

  const highlightColors = [
    'transparent', '#f3f4f6', '#fef3c7', '#fde68a', '#fef08a',
    '#bbf7d0', '#bfdbfe', '#c4b5fd', '#fbcfe8', '#fecaca',
  ];

  // Superscript/subscript Unicode mappings
  const superscriptMap: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    'n': 'ⁿ', 'x': 'ˣ', 'y': 'ʸ',
  };

  const subscriptMap: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ',
  };

  const insertSuperscript = () => {
    const input = prompt('Zadejte text pro horní index (0-9, +, -, n, x, y):', '2');
    if (input) {
      const converted = input.split('').map(c => superscriptMap[c] || c).join('');
      onInsertSymbol?.(converted);
    }
  };

  const insertSubscript = () => {
    const input = prompt('Zadejte text pro dolní index (0-9, +, -, a, e, o, x):', '2');
    if (input) {
      const converted = input.split('').map(c => subscriptMap[c] || c).join('');
      onInsertSymbol?.(converted);
    }
  };

  const insertLatex = () => {
    const input = prompt('Zadejte LaTeX vzorec:', 'x² + y² = r²');
    if (input) {
      // Convert common LaTeX to Unicode
      let result = input
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
        .replace(/\\sqrt\{([^}]+)\}/g, '√$1')
        .replace(/\\pi/g, 'π')
        .replace(/\\alpha/g, 'α')
        .replace(/\\beta/g, 'β')
        .replace(/\\gamma/g, 'γ')
        .replace(/\\delta/g, 'δ')
        .replace(/\\theta/g, 'θ')
        .replace(/\\lambda/g, 'λ')
        .replace(/\\mu/g, 'μ')
        .replace(/\\sigma/g, 'σ')
        .replace(/\\omega/g, 'ω')
        .replace(/\\sum/g, '∑')
        .replace(/\\int/g, '∫')
        .replace(/\\infty/g, '∞')
        .replace(/\\pm/g, '±')
        .replace(/\\times/g, '×')
        .replace(/\\div/g, '÷')
        .replace(/\\neq/g, '≠')
        .replace(/\\leq/g, '≤')
        .replace(/\\geq/g, '≥')
        .replace(/\\approx/g, '≈')
        .replace(/\^2/g, '²')
        .replace(/\^3/g, '³')
        .replace(/_2/g, '₂')
        .replace(/_3/g, '₃');
      onInsertSymbol?.(result);
    }
  };

  return (
    <div 
      className="flex items-center gap-1 px-3 py-2 bg-white rounded-xl shadow-lg border border-slate-200 worksheet-text-toolbar"
      data-toolbar-element="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        e.stopPropagation();
        // Prevent focus loss from the block being edited
        e.preventDefault();
      }}
      onMouseUp={(e) => {
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      {/* Text Style Dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            closeAllDropdowns();
            setShowTextDropdown(!showTextDropdown);
          }}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-700 border border-slate-200"
        >
          <span className="text-sm font-medium whitespace-nowrap">
            {fontSize >= 32 ? 'Nadpis 1' :
             fontSize >= 20 && fontSize < 32 ? 'Nadpis 2' :
             fontSize >= 16 && fontSize < 20 ? 'Nadpis 3' :
             fontSize >= 10 && fontSize < 16 ? 'Text' :
             'Popisek'}
          </span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
        
        {showTextDropdown && (
          <>
            <div 
              className="fixed inset-0 z-[9998] worksheet-text-toolbar" 
              onClick={(e) => {
                e.stopPropagation();
                setShowTextDropdown(false);
              }} 
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            />
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 w-[120px] z-[9999]">
              <button
                onClick={() => { onFontSizeChange?.(32); setShowTextDropdown(false); }}
                className={`w-full px-3 py-1.5 text-left text-lg font-bold hover:bg-slate-50 whitespace-nowrap ${fontSize >= 32 ? 'bg-indigo-50 text-indigo-600' : ''}`}
              >
                Nadpis 1
              </button>
              <button
                onClick={() => { onFontSizeChange?.(24); setShowTextDropdown(false); }}
                className={`w-full px-3 py-1.5 text-left text-base font-semibold hover:bg-slate-50 whitespace-nowrap ${fontSize >= 20 && fontSize < 32 ? 'bg-indigo-50 text-indigo-600' : ''}`}
              >
                Nadpis 2
              </button>
              <button
                onClick={() => { onFontSizeChange?.(18); setShowTextDropdown(false); }}
                className={`w-full px-3 py-1.5 text-left text-sm font-medium hover:bg-slate-50 whitespace-nowrap ${fontSize >= 16 && fontSize < 20 ? 'bg-indigo-50 text-indigo-600' : ''}`}
              >
                Nadpis 3
              </button>
              <div className="border-t border-slate-100 my-1" />
              <button
                onClick={() => { onFontSizeChange?.(12); setShowTextDropdown(false); }}
                className={`w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 whitespace-nowrap ${fontSize >= 10 && fontSize < 16 ? 'bg-indigo-50 text-indigo-600' : ''}`}
              >
                Text
              </button>
              <button
                onClick={() => { onFontSizeChange?.(9); setShowTextDropdown(false); }}
                className={`w-full px-3 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-50 whitespace-nowrap ${fontSize < 10 ? 'bg-indigo-50 text-indigo-600' : ''}`}
              >
                Popisek
              </button>
            </div>
          </>
        )}
      </div>

      {/* Font Size */}
      <div className="relative">
        <button
          onClick={() => {
            closeAllDropdowns();
            setShowSizeDropdown(!showSizeDropdown);
          }}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
        >
          <span className="text-sm font-medium min-w-[20px]">{fontSize}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
        
        {showSizeDropdown && (
          <>
            <div 
              className="fixed inset-0 z-[9998] worksheet-text-toolbar" 
              onClick={(e) => {
                e.stopPropagation();
                setShowSizeDropdown(false);
              }} 
              onMouseDown={(e) => e.stopPropagation()}
            />
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[60px] max-h-[300px] overflow-y-auto z-[9999]">
              {FONT_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => { onFontSizeChange?.(size); setShowSizeDropdown(false); }}
                  className={`w-full px-3 py-1.5 text-center text-sm hover:bg-slate-50 ${fontSize === size ? 'bg-indigo-50 text-indigo-600 font-medium' : ''}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="w-px h-5 bg-slate-200 mx-1" />
      
      {/* Bold */}
      <button
        onClick={onBoldToggle}
        className={`p-2 rounded-lg transition-colors ${isBold ? 'bg-slate-200 text-slate-900' : 'hover:bg-slate-100 text-slate-600'}`}
        title="Tučné (Ctrl+B)"
      >
        <Bold className="w-4 h-4" strokeWidth={2.5} />
      </button>
      
      {/* Italic */}
      <button
        onClick={onItalicToggle}
        className={`p-2 rounded-lg transition-colors ${isItalic ? 'bg-slate-200 text-slate-900' : 'hover:bg-slate-100 text-slate-600'}`}
        title="Kurzíva (Ctrl+I)"
      >
        <Italic className="w-4 h-4" />
      </button>
      
      {/* Underline */}
      <button
        onClick={onUnderlineToggle}
        className={`p-2 rounded-lg transition-colors ${isUnderline ? 'bg-slate-200 text-slate-900' : 'hover:bg-slate-100 text-slate-600'}`}
        title="Podtržené (Ctrl+U)"
      >
        <Underline className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      {/* Color Picker */}
      <div className="relative">
        <button
          onClick={() => {
            closeAllDropdowns();
            setShowColorDropdown(!showColorDropdown);
          }}
          className="flex items-center gap-0.5 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          title="Barvy"
        >
          <div 
            className="w-6 h-6 rounded flex items-center justify-center text-sm font-bold"
            style={{ 
              backgroundColor: highlightColor === 'transparent' ? '#fef08a' : highlightColor,
              color: textColor || '#000000'
            }}
          >
            A
          </div>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>
        
        {showColorDropdown && (
          <>
            <div 
              className="fixed inset-0 z-[9998] worksheet-text-toolbar" 
              onClick={(e) => {
                e.stopPropagation();
                setShowColorDropdown(false);
              }} 
              onMouseDown={(e) => e.stopPropagation()}
            />
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 p-3 z-[9999]" style={{ width: '220px' }}>
              <p className="text-xs font-medium text-slate-600 mb-2">Barva textu</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }} className="mb-3">
                {textColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => onTextColorChange?.(color)}
                    className="w-9 h-9 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                    style={{ backgroundColor: `${color}20` }}
                  >
                    <span style={{ color, fontWeight: 'bold', fontSize: '16px' }}>A</span>
                  </button>
                ))}
              </div>
              
              <p className="text-xs font-medium text-slate-600 mb-2">Zvýraznění</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                {highlightColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => onHighlightColorChange?.(color)}
                    className="w-9 h-9 rounded-full hover:scale-110 transition-transform"
                    style={{ 
                      backgroundColor: color === 'transparent' ? 'white' : color,
                      border: color === 'transparent' ? '2px solid #e2e8f0' : 'none',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      {/* Lists Dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            closeAllDropdowns();
            setShowListDropdown(!showListDropdown);
          }}
          className={`flex items-center gap-0.5 p-1.5 rounded-lg hover:bg-slate-100 transition-colors ${listType !== 'none' ? 'bg-slate-200' : ''}`}
          title="Seznamy"
        >
          {listType === 'numbered' ? (
            <ListOrdered className="w-4 h-4 text-slate-600" />
          ) : listType === 'checklist' ? (
            <ListChecks className="w-4 h-4 text-slate-600" />
          ) : (
            <List className="w-4 h-4 text-slate-600" />
          )}
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>
        
        {showListDropdown && (
          <>
            <div 
              className="fixed inset-0 z-[9998] worksheet-text-toolbar" 
              onClick={(e) => {
                e.stopPropagation();
                setShowListDropdown(false);
              }} 
              onMouseDown={(e) => e.stopPropagation()}
            />
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-[9999] min-w-[180px]">
              <button
                onClick={() => { onListTypeChange?.('numbered'); setShowListDropdown(false); }}
                className={`flex items-center gap-3 w-full px-3 py-2 hover:bg-slate-50 ${listType === 'numbered' ? 'bg-indigo-50 text-indigo-600' : ''}`}
              >
                <ListOrdered className="w-4 h-4" />
                <span className="text-sm">Číslovaný seznam</span>
              </button>
              <button
                onClick={() => { onListTypeChange?.('bullet'); setShowListDropdown(false); }}
                className={`flex items-center gap-3 w-full px-3 py-2 hover:bg-slate-50 ${listType === 'bullet' ? 'bg-indigo-50 text-indigo-600' : ''}`}
              >
                <List className="w-4 h-4" />
                <span className="text-sm">Odrážky</span>
              </button>
              <button
                onClick={() => { onListTypeChange?.('checklist'); setShowListDropdown(false); }}
                className={`flex items-center gap-3 w-full px-3 py-2 hover:bg-slate-50 ${listType === 'checklist' ? 'bg-indigo-50 text-indigo-600' : ''}`}
              >
                <ListChecks className="w-4 h-4" />
                <span className="text-sm">Checklist</span>
              </button>
              {listType !== 'none' && (
                <>
                  <div className="border-t border-slate-200 my-1" />
                  <button
                    onClick={() => { onListTypeChange?.('none'); setShowListDropdown(false); }}
                    className="flex items-center gap-3 w-full px-3 py-2 hover:bg-slate-50 text-slate-500"
                  >
                    <span className="text-sm">Zrušit seznam</span>
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Math Dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            closeAllDropdowns();
            setShowMathDropdown(!showMathDropdown);
          }}
          className="flex items-center gap-0.5 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          title="Matematika"
        >
          <span className="text-slate-600 font-serif text-lg">∑</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>
        
        {showMathDropdown && (
          <>
            <div 
              className="fixed inset-0 z-[9998] worksheet-text-toolbar" 
              onClick={(e) => {
                e.stopPropagation();
                setShowMathDropdown(false);
              }} 
              onMouseDown={(e) => e.stopPropagation()}
            />
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-[9999] min-w-[200px]">
              <button
                onClick={() => { insertSuperscript(); setShowMathDropdown(false); }}
                className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <Superscript className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">Horní index</span>
                </div>
                <span className="text-xs text-slate-400">x²</span>
              </button>
              <button
                onClick={() => { insertSubscript(); setShowMathDropdown(false); }}
                className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <Subscript className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">Dolní index</span>
                </div>
                <span className="text-xs text-slate-400">H₂O</span>
              </button>
              <button
                onClick={() => { insertLatex(); setShowMathDropdown(false); }}
                className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-serif">∑</span>
                  <span className="text-sm">LaTeX vzorec</span>
                </div>
                <span className="text-xs text-slate-400">∫ ∑ √</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Text Alignment Dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            closeAllDropdowns();
            setShowAlignDropdown(!showAlignDropdown);
          }}
          className="flex items-center gap-0.5 p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
          title="Zarovnání"
        >
          {textAlign === 'center' ? (
            <AlignCenter className="w-4 h-4" />
          ) : textAlign === 'right' ? (
            <AlignRight className="w-4 h-4" />
          ) : (
            <AlignLeft className="w-4 h-4" />
          )}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
        
        {showAlignDropdown && (
          <>
            <div 
              className="fixed inset-0 z-[9998] worksheet-text-toolbar" 
              onClick={(e) => {
                e.stopPropagation();
                setShowAlignDropdown(false);
              }} 
              onMouseDown={(e) => e.stopPropagation()}
            />
            <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-[9999]">
              <button
                onClick={() => { onAlignChange?.('left'); setShowAlignDropdown(false); }}
                className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 ${textAlign === 'left' ? 'bg-indigo-50 text-indigo-600' : ''}`}
              >
                <AlignLeft className="w-4 h-4" />
                <span className="text-sm">Vlevo</span>
              </button>
              <button
                onClick={() => { onAlignChange?.('center'); setShowAlignDropdown(false); }}
                className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 ${textAlign === 'center' ? 'bg-indigo-50 text-indigo-600' : ''}`}
              >
                <AlignCenter className="w-4 h-4" />
                <span className="text-sm">Na střed</span>
              </button>
              <button
                onClick={() => { onAlignChange?.('right'); setShowAlignDropdown(false); }}
                className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 ${textAlign === 'right' ? 'bg-indigo-50 text-indigo-600' : ''}`}
              >
                <AlignRight className="w-4 h-4" />
                <span className="text-sm">Vpravo</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* AI Button - at the end */}
      {onOpenAI && (
        <>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onOpenAI();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fef9c3', // bg-yellow-100
              color: '#713f12', // text-yellow-900
              border: '1px solid #fde047', // border-yellow-300
              padding: '6px 12px',
              borderRadius: '8px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef08a'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fef9c3'}
            title="AI asistent"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">AI</span>
          </button>
        </>
      )}
    </div>
  );
}
