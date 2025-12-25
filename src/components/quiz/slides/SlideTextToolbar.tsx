/**
 * SlideTextToolbar
 * 
 * Simple text formatting toolbar displayed above the slide editor
 * when editing text in a block.
 */

import React from 'react';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  ChevronDown,
  Type,
} from 'lucide-react';

interface SlideTextToolbarProps {
  // Text formatting state
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
  // Callbacks
  onBoldToggle?: () => void;
  onItalicToggle?: () => void;
  onUnderlineToggle?: () => void;
  onAlignChange?: (align: 'left' | 'center' | 'right') => void;
  onFontSizeChange?: (size: 'small' | 'medium' | 'large' | 'xlarge') => void;
  onClose?: () => void;
}

export function SlideTextToolbar({
  isBold = false,
  isItalic = false,
  isUnderline = false,
  textAlign = 'left',
  fontSize = 'medium',
  onBoldToggle,
  onItalicToggle,
  onUnderlineToggle,
  onAlignChange,
  onFontSizeChange,
  onClose,
}: SlideTextToolbarProps) {
  const [showFontMenu, setShowFontMenu] = React.useState(false);

  const fontSizeLabels: Record<string, string> = {
    small: 'Malý',
    medium: 'Normální',
    large: 'Velký',
    xlarge: 'Největší',
  };

  return (
    <div 
      className="flex items-center gap-1 px-3 py-2 bg-white rounded-xl shadow-lg border border-slate-200"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.preventDefault()} // Prevent blur on textarea when clicking toolbar
    >
      {/* Font Size Dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowFontMenu(!showFontMenu)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-700"
        >
          <Type className="w-4 h-4" />
          <span className="text-sm font-medium min-w-[60px]">{fontSizeLabels[fontSize]}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
        
        {showFontMenu && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowFontMenu(false)}
            />
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[120px] z-50">
              {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    onFontSizeChange?.(size);
                    setShowFontMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
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
          isBold ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-600'
        }`}
        title="Tučné (Ctrl+B)"
      >
        <Bold className="w-4 h-4" strokeWidth={2.5} />
      </button>
      
      {/* Italic */}
      <button
        onClick={onItalicToggle}
        className={`p-2 rounded-lg transition-colors ${
          isItalic ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-600'
        }`}
        title="Kurzíva (Ctrl+I)"
      >
        <Italic className="w-4 h-4" />
      </button>
      
      {/* Underline */}
      <button
        onClick={onUnderlineToggle}
        className={`p-2 rounded-lg transition-colors ${
          isUnderline ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-600'
        }`}
        title="Podtržené (Ctrl+U)"
      >
        <Underline className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      {/* Align Left */}
      <button
        onClick={() => onAlignChange?.('left')}
        className={`p-2 rounded-lg transition-colors ${
          textAlign === 'left' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-600'
        }`}
        title="Zarovnat vlevo"
      >
        <AlignLeft className="w-4 h-4" />
      </button>
      
      {/* Align Center */}
      <button
        onClick={() => onAlignChange?.('center')}
        className={`p-2 rounded-lg transition-colors ${
          textAlign === 'center' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-600'
        }`}
        title="Zarovnat na střed"
      >
        <AlignCenter className="w-4 h-4" />
      </button>
      
      {/* Align Right */}
      <button
        onClick={() => onAlignChange?.('right')}
        className={`p-2 rounded-lg transition-colors ${
          textAlign === 'right' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-600'
        }`}
        title="Zarovnat vpravo"
      >
        <AlignRight className="w-4 h-4" />
      </button>
    </div>
  );
}

