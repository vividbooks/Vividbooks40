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
} from 'lucide-react';

interface SlideTextToolbarProps {
  // Text formatting state
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
  textColor?: string;
  highlightColor?: string;
  // Callbacks
  onBoldToggle?: () => void;
  onItalicToggle?: () => void;
  onUnderlineToggle?: () => void;
  onAlignChange?: (align: 'left' | 'center' | 'right') => void;
  onFontSizeChange?: (size: 'small' | 'medium' | 'large' | 'xlarge') => void;
  onTextColorChange?: (color: string) => void;
  onHighlightColorChange?: (color: string) => void;
}

export function SlideTextToolbar({
  isBold = false,
  isItalic = false,
  isUnderline = false,
  textAlign = 'left',
  fontSize = 'medium',
  textColor = '#000000',
  highlightColor = 'transparent',
  onBoldToggle,
  onItalicToggle,
  onUnderlineToggle,
  onAlignChange,
  onFontSizeChange,
  onTextColorChange,
  onHighlightColorChange,
}: SlideTextToolbarProps) {
  const [showTextDropdown, setShowTextDropdown] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [showAlignDropdown, setShowAlignDropdown] = useState(false);

  const fontSizeLabels: Record<string, string> = {
    small: '12',
    medium: '16',
    large: '24',
    xlarge: '32',
  };

  const textColors = [
    '#000000', '#6b7280', '#dc2626', '#ea580c', '#ca8a04',
    '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777',
  ];

  const highlightColors = [
    'transparent', '#f3f4f6', '#fef3c7', '#fde68a', '#fef08a',
    '#bbf7d0', '#bfdbfe', '#c4b5fd', '#fbcfe8', '#fecaca',
  ];

  return (
    <div 
      className="flex items-center gap-0.5 px-2 py-1.5 bg-white rounded-xl shadow-lg border border-slate-200"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Text Style Dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            setShowTextDropdown(!showTextDropdown);
            setShowSizeDropdown(false);
            setShowColorDropdown(false);
            setShowAlignDropdown(false);
          }}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-700 border border-slate-200"
        >
          <span className="text-sm font-medium">Text</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
        
        {showTextDropdown && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowTextDropdown(false)} />
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[120px] z-50">
              <button
                onClick={() => {
                  onFontSizeChange?.('medium');
                  setShowTextDropdown(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${fontSize === 'medium' ? 'bg-indigo-50 text-indigo-600' : ''}`}
              >
                Text
              </button>
              <button
                onClick={() => {
                  onFontSizeChange?.('xlarge');
                  setShowTextDropdown(false);
                }}
                className={`w-full px-3 py-2 text-left text-lg font-semibold hover:bg-slate-50 ${fontSize === 'xlarge' ? 'bg-indigo-50 text-indigo-600' : ''}`}
              >
                Nadpis 1
              </button>
              <button
                onClick={() => {
                  onFontSizeChange?.('large');
                  setShowTextDropdown(false);
                }}
                className={`w-full px-3 py-2 text-left text-base font-semibold hover:bg-slate-50 ${fontSize === 'large' ? 'bg-indigo-50 text-indigo-600' : ''}`}
              >
                Nadpis 2
              </button>
              <button
                onClick={() => {
                  onFontSizeChange?.('small');
                  setShowTextDropdown(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-50 ${fontSize === 'small' ? 'bg-indigo-50 text-indigo-600' : ''}`}
              >
                Malý text
              </button>
            </div>
          </>
        )}
      </div>

      {/* Font Size */}
      <div className="relative">
        <button
          onClick={() => {
            setShowSizeDropdown(!showSizeDropdown);
            setShowTextDropdown(false);
            setShowColorDropdown(false);
            setShowAlignDropdown(false);
          }}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
        >
          <span className="text-sm font-medium min-w-[20px]">{fontSizeLabels[fontSize]}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
        
        {showSizeDropdown && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowSizeDropdown(false)} />
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[80px] z-50 max-h-[200px] overflow-y-auto">
              {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    onFontSizeChange?.(size);
                    setShowSizeDropdown(false);
                  }}
                  className={`w-full px-3 py-1.5 text-center text-sm hover:bg-slate-50 ${
                    fontSize === size ? 'bg-indigo-50 text-indigo-600 font-medium' : ''
                  }`}
                >
                  {fontSizeLabels[size]}
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
        className={`p-2 rounded-lg transition-colors ${
          isBold ? 'bg-slate-200 text-slate-900' : 'hover:bg-slate-100 text-slate-600'
        }`}
        title="Tučné"
      >
        <Bold className="w-4 h-4" strokeWidth={2.5} />
      </button>
      
      {/* Italic */}
      <button
        onClick={onItalicToggle}
        className={`p-2 rounded-lg transition-colors ${
          isItalic ? 'bg-slate-200 text-slate-900' : 'hover:bg-slate-100 text-slate-600'
        }`}
        title="Kurzíva"
      >
        <Italic className="w-4 h-4" />
      </button>
      
      {/* Underline */}
      <button
        onClick={onUnderlineToggle}
        className={`p-2 rounded-lg transition-colors ${
          isUnderline ? 'bg-slate-200 text-slate-900' : 'hover:bg-slate-100 text-slate-600'
        }`}
        title="Podtržené"
      >
        <Underline className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      {/* Color Picker */}
      <div className="relative">
        <button
          onClick={() => {
            setShowColorDropdown(!showColorDropdown);
            setShowTextDropdown(false);
            setShowSizeDropdown(false);
            setShowAlignDropdown(false);
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
            <div className="fixed inset-0 z-40" onClick={() => setShowColorDropdown(false)} />
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 p-3 z-50 min-w-[200px]">
              <p className="text-xs font-medium text-slate-600 mb-2">Barva textu</p>
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {textColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      onTextColorChange?.(color);
                    }}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                    style={{ backgroundColor: `${color}20` }}
                    title={color}
                  >
                    <span style={{ color, fontWeight: 'bold', fontSize: '12px' }}>A</span>
                  </button>
                ))}
              </div>
              
              <p className="text-xs font-medium text-slate-600 mb-2">Zvýraznění</p>
              <div className="grid grid-cols-5 gap-1.5">
                {highlightColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      onHighlightColorChange?.(color);
                    }}
                    className="w-7 h-7 rounded-full hover:scale-110 transition-transform"
                    style={{ 
                      backgroundColor: color === 'transparent' ? 'white' : color,
                      border: color === 'transparent' ? '2px solid #e2e8f0' : '2px solid transparent'
                    }}
                    title={color === 'transparent' ? 'Žádné' : color}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      {/* Text Alignment Dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            setShowAlignDropdown(!showAlignDropdown);
            setShowTextDropdown(false);
            setShowSizeDropdown(false);
            setShowColorDropdown(false);
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
            <div className="fixed inset-0 z-40" onClick={() => setShowAlignDropdown(false)} />
            <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
              <button
                onClick={() => {
                  onAlignChange?.('left');
                  setShowAlignDropdown(false);
                }}
                className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 ${textAlign === 'left' ? 'bg-indigo-50 text-indigo-600' : ''}`}
              >
                <AlignLeft className="w-4 h-4" />
                <span className="text-sm">Vlevo</span>
              </button>
              <button
                onClick={() => {
                  onAlignChange?.('center');
                  setShowAlignDropdown(false);
                }}
                className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 ${textAlign === 'center' ? 'bg-indigo-50 text-indigo-600' : ''}`}
              >
                <AlignCenter className="w-4 h-4" />
                <span className="text-sm">Na střed</span>
              </button>
              <button
                onClick={() => {
                  onAlignChange?.('right');
                  setShowAlignDropdown(false);
                }}
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
  );
}
