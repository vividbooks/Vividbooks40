/**
 * SlideTextToolbar
 * 
 * Text formatting toolbar displayed above the slide editor
 * when editing text in a block. Inspired by document editor.
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
  Maximize,
  MousePointer2,
} from 'lucide-react';

interface SlideTextToolbarProps {
  // Text formatting state
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  fontSize?: 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge';
  textColor?: string;
  highlightColor?: string;
  listType?: 'none' | 'bullet' | 'numbered' | 'checklist';
  textOverflow?: 'scroll' | 'fit';
  // Callbacks
  onBoldToggle?: () => void;
  onItalicToggle?: () => void;
  onUnderlineToggle?: () => void;
  onAlignChange?: (align: 'left' | 'center' | 'right') => void;
  onFontSizeChange?: (size: 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge') => void;
  onTextColorChange?: (color: string) => void;
  onHighlightColorChange?: (color: string) => void;
  onListTypeChange?: (type: 'none' | 'bullet' | 'numbered' | 'checklist') => void;
  onTextOverflowChange?: (overflow: 'scroll' | 'fit') => void;
  onSizePresetChange?: (preset: { fontSize: 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge'; textOverflow: 'scroll' | 'fit' }) => void;
  onInsertSymbol?: (symbol: string) => void;
}

export function SlideTextToolbar({
  isBold = false,
  isItalic = false,
  isUnderline = false,
  textAlign = 'left',
  fontSize = 'medium',
  textColor = '#000000',
  highlightColor = 'transparent',
  listType = 'none',
  textOverflow = 'fit',
  onBoldToggle,
  onItalicToggle,
  onUnderlineToggle,
  onAlignChange,
  onFontSizeChange,
  onTextColorChange,
  onHighlightColorChange,
  onListTypeChange,
  onTextOverflowChange,
  onSizePresetChange,
  onInsertSymbol,
}: SlideTextToolbarProps) {
  const [showOverflowDropdown, setShowOverflowDropdown] = useState(false);
  const [showTextDropdown, setShowTextDropdown] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [showListDropdown, setShowListDropdown] = useState(false);
  const [showMathDropdown, setShowMathDropdown] = useState(false);
  const [showAlignDropdown, setShowAlignDropdown] = useState(false);

  const closeAllDropdowns = () => {
    setShowOverflowDropdown(false);
    setShowTextDropdown(false);
    setShowSizeDropdown(false);
    setShowColorDropdown(false);
    setShowListDropdown(false);
    setShowMathDropdown(false);
    setShowAlignDropdown(false);
  };

  const fontSizeLabels: Record<string, string> = {
    xsmall: '10',
    small: '12',
    medium: '16',
    large: '24',
    xlarge: '32',
    xxlarge: '48',
  };

  const textColors = [
    '#ffffff', '#000000', '#6b7280', '#dc2626', '#ea580c', '#ca8a04',
    '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777',
  ];

  const highlightOptions = [
    { color: 'transparent', label: 'Bez podbarvení' },
    { color: '#f3f4f6', label: 'Svetle seda' },
    { color: '#fef3c7', label: 'Kremova' },
    { color: '#fde68a', label: 'Jantarova' },
    { color: '#fef08a', label: 'Zluta' },
    { color: '#bbf7d0', label: 'Zelena' },
    { color: '#bfdbfe', label: 'Modra' },
    { color: '#c4b5fd', label: 'Fialova' },
    { color: '#fbcfe8', label: 'Ruzova' },
    { color: '#fecaca', label: 'Cervena' },
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
    // Open a dialog for LaTeX input
    const input = window.prompt('Zadejte LaTeX vzorec:', 'x² + y² = r²');
    if (input && input.trim()) {
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
      if (onInsertSymbol) {
        onInsertSymbol(result);
      }
    }
  };

  return (
    <div 
      className="flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Text Size Dropdown - in its own container */}
      <div className="relative">
        <button
          onClick={() => {
            closeAllDropdowns();
            setShowSizeDropdown(!showSizeDropdown);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-slate-400 rounded-2xl transition-all h-10"
        >
          <span className="text-[13px] font-medium text-[#4E5871] whitespace-nowrap">
            {textOverflow === 'fit' ? 'Auto' : (
              fontSize === 'xxlarge' ? 'Obrovský' :
              fontSize === 'xlarge' ? 'Extra velký' :
              fontSize === 'large' ? 'Velký' :
              fontSize === 'medium' ? 'Střední' :
              fontSize === 'small' ? 'Malý' :
              fontSize === 'xsmall' ? 'Mini' : 'Střední'
            )}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>
        
        {showSizeDropdown && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowSizeDropdown(false)} />
            <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-2 w-[280px] z-50">
              <button
                onClick={() => { 
                  onSizePresetChange?.({ fontSize, textOverflow: 'fit' });
                  setShowSizeDropdown(false); 
                }}
                className={`w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center justify-between ${textOverflow === 'fit' ? 'bg-indigo-50' : ''}`}
              >
                <span className={`text-sm font-medium ${textOverflow === 'fit' ? 'text-indigo-600' : 'text-slate-700'}`}>Velikost</span>
                <span className="text-[10px] text-slate-400">přizpůsobí se bloku</span>
              </button>
              
              <div className="border-t border-slate-100 my-2 mx-3" />
              
              <button
                onClick={() => { 
                  onSizePresetChange?.({ fontSize: 'xxlarge', textOverflow: 'scroll' });
                  setShowSizeDropdown(false); 
                }}
                className={`w-full px-4 py-1.5 text-left hover:bg-slate-50 ${textOverflow === 'scroll' && fontSize === 'xxlarge' ? 'bg-indigo-50' : ''}`}
              >
                <span className={`text-3xl font-bold ${textOverflow === 'scroll' && fontSize === 'xxlarge' ? 'text-indigo-600' : 'text-slate-700'}`}>Obrovský</span>
              </button>
              <button
                onClick={() => { 
                  onSizePresetChange?.({ fontSize: 'xlarge', textOverflow: 'scroll' });
                  setShowSizeDropdown(false); 
                }}
                className={`w-full px-4 py-1.5 text-left hover:bg-slate-50 ${textOverflow === 'scroll' && fontSize === 'xlarge' ? 'bg-indigo-50' : ''}`}
              >
                <span className={`text-2xl font-bold ${textOverflow === 'scroll' && fontSize === 'xlarge' ? 'text-indigo-600' : 'text-slate-700'}`}>Extra velký</span>
              </button>
              <button
                onClick={() => { 
                  onSizePresetChange?.({ fontSize: 'large', textOverflow: 'scroll' });
                  setShowSizeDropdown(false); 
                }}
                className={`w-full px-4 py-1.5 text-left hover:bg-slate-50 ${textOverflow === 'scroll' && fontSize === 'large' ? 'bg-indigo-50' : ''}`}
              >
                <span className={`text-xl font-semibold ${textOverflow === 'scroll' && fontSize === 'large' ? 'text-indigo-600' : 'text-slate-700'}`}>Velký</span>
              </button>
              <button
                onClick={() => { 
                  onSizePresetChange?.({ fontSize: 'medium', textOverflow: 'scroll' });
                  setShowSizeDropdown(false); 
                }}
                className={`w-full px-4 py-1.5 text-left hover:bg-slate-50 ${textOverflow === 'scroll' && fontSize === 'medium' ? 'bg-indigo-50' : ''}`}
              >
                <span className={`text-lg ${textOverflow === 'scroll' && fontSize === 'medium' ? 'text-indigo-600' : 'text-slate-700'}`}>Střední</span>
              </button>
              <button
                onClick={() => { 
                  onSizePresetChange?.({ fontSize: 'small', textOverflow: 'scroll' });
                  setShowSizeDropdown(false); 
                }}
                className={`w-full px-4 py-1.5 text-left hover:bg-slate-50 ${textOverflow === 'scroll' && fontSize === 'small' ? 'bg-indigo-50' : ''}`}
              >
                <span className={`text-base ${textOverflow === 'scroll' && fontSize === 'small' ? 'text-indigo-600' : 'text-slate-700'}`}>Malý</span>
              </button>
              <button
                onClick={() => { 
                  onSizePresetChange?.({ fontSize: 'xsmall', textOverflow: 'scroll' });
                  setShowSizeDropdown(false); 
                }}
                className={`w-full px-4 py-1.5 text-left hover:bg-slate-50 ${textOverflow === 'scroll' && fontSize === 'xsmall' ? 'bg-indigo-50' : ''}`}
              >
                <span className={`text-sm ${textOverflow === 'scroll' && fontSize === 'xsmall' ? 'text-indigo-600' : 'text-slate-700'}`}>Mini</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Text formatting container - all other controls */}
      <div className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-2xl h-10">
        {/* Bold, Italic, Underline */}
        <button
          onClick={onBoldToggle}
          className={`p-1.5 rounded-lg transition-colors ${isBold ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-600'}`}
          title="Tučné"
        >
          <Bold className="w-4 h-4" strokeWidth={2.5} />
        </button>
        <button
          onClick={onItalicToggle}
          className={`p-1.5 rounded-lg transition-colors ${isItalic ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-600'}`}
          title="Kurzíva"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={onUnderlineToggle}
          className={`p-1.5 rounded-lg transition-colors ${isUnderline ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-600'}`}
          title="Podtržené"
        >
          <Underline className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-slate-200" />

        {/* Color Picker */}
        <div className="relative">
          <button
            onClick={() => {
              closeAllDropdowns();
              setShowColorDropdown(!showColorDropdown);
            }}
            className="flex items-center gap-0.5 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            title="Barvy"
          >
            <div 
              className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
              style={{ 
                backgroundColor: highlightColor === 'transparent' ? '#ffffff' : highlightColor,
                border: highlightColor === 'transparent' ? '1px solid #e2e8f0' : '1px solid transparent',
                color: textColor || '#000000'
              }}
            >
              A
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
        
          {showColorDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowColorDropdown(false)} />
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 p-3 z-50 min-w-[260px]">
                <p className="text-xs font-medium text-slate-600 mb-2">Barva textu</p>
                <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                  {textColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => onTextColorChange?.(color)}
                      className="w-9 h-9 rounded-full flex items-center justify-center hover:scale-110 transition-transform border border-slate-200"
                      style={{
                        backgroundColor: color === '#ffffff' ? '#ffffff' : `${color}20`,
                        borderColor: color === '#ffffff' ? '#cbd5e1' : undefined,
                        boxShadow: textColor === color ? '0 0 0 2px #c7d2fe' : undefined,
                      }}
                      title={color}
                    >
                      <span style={{ color, fontWeight: 'bold', fontSize: '12px' }}>A</span>
                    </button>
                  ))}
                </div>
                
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-slate-600">Zvýraznění</p>
                  <div
                    className="px-2 py-1 rounded-lg text-[10px] font-medium text-slate-500 border border-slate-200"
                    style={{ backgroundColor: highlightColor === 'transparent' ? '#ffffff' : highlightColor }}
                  >
                    Aktivní
                  </div>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                  {highlightOptions.map(({ color, label }) => (
                    <button
                      key={color}
                      onClick={() => onHighlightColorChange?.(color)}
                      className="w-9 h-9 rounded-full border border-slate-200 hover:border-slate-300 hover:scale-110 transition-all relative overflow-hidden flex items-center justify-center"
                      style={{
                        backgroundColor: color === 'transparent' ? '#ffffff' : color,
                        boxShadow: highlightColor === color ? '0 0 0 2px #c7d2fe' : undefined,
                      }}
                      title={label}
                    >
                      <span
                        className="relative w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                        style={{
                          backgroundColor: color === 'transparent' ? '#ffffff' : `${color}cc`,
                          color: textColor || '#111827',
                          border: color === 'transparent' ? '1px solid #e2e8f0' : '1px solid transparent',
                        }}
                      >
                        A
                        {color === 'transparent' && (
                          <span
                            className="absolute left-1/2 top-1/2"
                            style={{
                              width: 14,
                              height: 2,
                              backgroundColor: '#f87171',
                              transform: 'translate(-50%, -50%) rotate(45deg)',
                            }}
                          />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="w-px h-5 bg-slate-200" />

        {/* Lists Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              closeAllDropdowns();
              setShowListDropdown(!showListDropdown);
            }}
            className={`flex items-center gap-0.5 p-1 rounded-lg hover:bg-slate-100 transition-colors ${listType !== 'none' ? 'bg-indigo-100' : ''}`}
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
              <div className="fixed inset-0 z-40" onClick={() => setShowListDropdown(false)} />
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50 min-w-[180px]">
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

        {/* Math/Index Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              closeAllDropdowns();
              setShowMathDropdown(!showMathDropdown);
            }}
            className="flex items-center gap-0.5 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            title="Indexy a matematika"
          >
            <span className="text-slate-600 text-sm">x²</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          
          {showMathDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMathDropdown(false)} />
              <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 min-w-[220px]">
                <button
                  onClick={() => { insertSuperscript(); setShowMathDropdown(false); }}
                  className="flex items-center justify-between w-full px-4 py-2 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <Superscript className="w-4 h-4 text-slate-500" />
                    <span className="text-sm">Horní index</span>
                  </div>
                  <span className="text-sm text-slate-400">x²</span>
                </button>
                <button
                  onClick={() => { insertSubscript(); setShowMathDropdown(false); }}
                  className="flex items-center justify-between w-full px-4 py-2 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <Subscript className="w-4 h-4 text-slate-500" />
                    <span className="text-sm">Dolní index</span>
                  </div>
                  <span className="text-sm text-slate-400">H₂O</span>
                </button>
                
                <div className="border-t border-slate-100 my-2 mx-3" />
                
                <button
                  onClick={() => { insertLatex(); setShowMathDropdown(false); }}
                  className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-indigo-50 bg-slate-50 mx-2 rounded-lg"
                  style={{ width: 'calc(100% - 16px)' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-indigo-600 font-serif text-lg">∑</span>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium text-slate-700">Matematický zápis</span>
                      <span className="text-[10px] text-slate-400">vzorce, symboly, rovnice</span>
                    </div>
                  </div>
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
            className="flex items-center gap-0.5 p-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
            title="Zarovnání"
          >
            {textAlign === 'center' ? (
              <AlignCenter className="w-4 h-4" />
            ) : textAlign === 'right' ? (
              <AlignRight className="w-4 h-4" />
            ) : (
              <AlignLeft className="w-4 h-4" />
            )}
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          
          {showAlignDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowAlignDropdown(false)} />
              <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
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
      </div>
    </div>
  );
}
