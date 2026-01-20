/**
 * BackgroundPicker
 * 
 * Color/background picker for slide blocks and pages.
 * Based on the UI from the screenshot with:
 * - Upload button
 * - Custom color button
 * - Opacity slider
 * - Blur slider
 * - Recently used colors
 * - Color palette grid
 */

import React, { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { BackgroundSettings } from '../../../types/quiz';
import { useAssetPicker } from '../../../hooks/useAssetPicker';

// Predefined color palette
const COLOR_PALETTE = {
  grays: [
    'transparent', // Empty/transparent
    '#ffffff',     // White
    '#f8fafc',     // Slate 50
    '#f1f5f9',     // Slate 100
    '#e2e8f0',     // Slate 200
    '#cbd5e1',     // Slate 300
    '#94a3b8',     // Slate 400
    '#64748b',     // Slate 500
    '#1e293b',     // Slate 800
    '#0f172a',     // Slate 900
  ],
  colors: [
    // Row 1 - Deep/Dark
    '#450a0a', '#7f1d1d', '#14532d', '#134e4a', '#0c4a6e', '#1e3a8a', '#4c1d95', '#701a75',
    // Row 2 - Dark
    '#7f1d1d', '#b91c1c', '#166534', '#0f766e', '#0369a1', '#1d4ed8', '#6d28d9', '#a21caf',
    // Row 3 - Medium
    '#dc2626', '#ef4444', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6', '#8b5cf6', '#d946ef',
    // Row 4 - Light
    '#fca5a5', '#fecaca', '#86efac', '#5eead4', '#7dd3fc', '#93c5fd', '#c4b5fd', '#f0abfc',
    // Row 5 - Very light
    '#fee2e2', '#fef2f2', '#dcfce7', '#ccfbf1', '#e0f2fe', '#dbeafe', '#ede9fe', '#fae8ff',
  ],
  outlines: [
    // Outline colors (white fill with colored border)
    { fill: '#ffffff', stroke: '#ef4444' },
    { fill: '#ffffff', stroke: '#f97316' },
    { fill: '#ffffff', stroke: '#eab308' },
    { fill: '#ffffff', stroke: '#22c55e' },
    { fill: '#ffffff', stroke: '#06b6d4' },
    { fill: '#ffffff', stroke: '#3b82f6' },
    { fill: '#ffffff', stroke: '#8b5cf6' },
    { fill: '#ffffff', stroke: '#ec4899' },
  ],
};

interface BackgroundPickerProps {
  value: BackgroundSettings | undefined;
  onChange: (value: BackgroundSettings | undefined) => void;
  onClose: () => void;
  showUpload?: boolean;
  showOpacity?: boolean;
  showBlur?: boolean;
  inline?: boolean; // If true, renders inline without absolute positioning
}

export function BackgroundPicker({
  value,
  onChange,
  onClose,
  showUpload = true,
  showOpacity = true,
  showBlur = true,
  inline = false,
}: BackgroundPickerProps) {
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    const saved = localStorage.getItem('vividboard-recent-colors');
    return saved ? JSON.parse(saved) : [];
  });
  const [customColorOpen, setCustomColorOpen] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);
  
  const { openAssetPicker, AssetPickerModal } = useAssetPicker({
    onSelect: (result) => {
      onChange({
        type: 'image',
        imageUrl: result.url,
        opacity,
        blur,
      });
    },
  });

  const selectedColor = value?.color || 'transparent';
  const opacity = value?.opacity ?? 100;
  const blur = value?.blur ?? 0;

  const handleColorSelect = (color: string) => {
    // Add to recent colors
    const newRecent = [color, ...recentColors.filter(c => c !== color)].slice(0, 10);
    setRecentColors(newRecent);
    localStorage.setItem('vividboard-recent-colors', JSON.stringify(newRecent));

    onChange({
      type: 'color',
      color,
      opacity,
      blur,
    });
  };

  const handleCustomColor = () => {
    if (colorInputRef.current) {
      colorInputRef.current.click();
    }
  };


  const handleOpacityChange = (newOpacity: number) => {
    onChange({
      ...value,
      type: value?.type || 'color',
      opacity: newOpacity,
    });
  };

  const handleBlurChange = (newBlur: number) => {
    onChange({
      ...value,
      type: value?.type || 'color',
      blur: newBlur,
    });
  };

  return (
    <div 
      className={`bg-white rounded-2xl border border-slate-200 p-4 ${
        inline ? 'w-full' : 'absolute z-50 shadow-2xl w-[360px]'
      }`}
      style={inline ? {} : { top: '100%', left: 0, marginTop: 8 }}
    >
      {/* Header with close button - only show for popup mode */}
      {!inline && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Upload and Custom Color buttons */}
      <div className="flex gap-2 mb-4">
        {showUpload && (
          <button
            onClick={openAssetPicker}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            Nahrát
          </button>
        )}
        <button
          onClick={handleCustomColor}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
        >
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 via-green-500 to-blue-500" />
          Vlastní barva
        </button>
        <input
          ref={colorInputRef}
          type="color"
          value={selectedColor === 'transparent' ? '#ffffff' : selectedColor}
          onChange={(e) => handleColorSelect(e.target.value)}
          className="hidden"
        />
      </div>

      {/* Opacity and Blur sliders */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {showOpacity && (
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Krytí</label>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjY2NjIi8+PHJlY3QgeD0iOCIgeT0iOCIgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0iI2NjYyIvPjwvc3ZnPg==')]" />
              <input
                type="range"
                min="0"
                max="100"
                value={opacity}
                onChange={(e) => handleOpacityChange(Number(e.target.value))}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
              />
              <div className="w-6 h-6 rounded bg-slate-800" />
            </div>
          </div>
        )}
        {showBlur && (
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Rozmlžení</label>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full border-2 border-slate-400 border-dotted" />
              </div>
              <input
                type="range"
                min="0"
                max="20"
                value={blur}
                onChange={(e) => handleBlurChange(Number(e.target.value))}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
              />
              <div className="w-6 h-6 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-slate-400 blur-[2px]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recently used colors */}
      {recentColors.length > 0 && (
        <div className="mb-4">
          <label className="text-xs text-slate-500 mb-2 block">Naposledy použité</label>
          <div className="flex gap-1.5 flex-wrap">
            {recentColors.map((color, idx) => (
              <button
                key={`${color}-${idx}`}
                onClick={() => handleColorSelect(color)}
                className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                  selectedColor === color ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'
                }`}
                style={{ backgroundColor: color === 'transparent' ? '#fff' : color }}
              >
                {color === 'transparent' && (
                  <div className="w-full h-full rounded-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZTJlOGYwIi8+PHJlY3QgeD0iOCIgeT0iOCIgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0iI2UyZThmMCIvPjwvc3ZnPg==')]" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color palette */}
      <div>
        <label className="text-xs text-slate-500 mb-2 block">Výběr barev</label>
        
        {/* Grays row */}
        <div className="flex gap-1.5 mb-2">
          {COLOR_PALETTE.grays.map((color, idx) => (
            <button
              key={`gray-${idx}`}
              onClick={() => handleColorSelect(color)}
              className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                selectedColor === color ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'
              }`}
              style={{ backgroundColor: color === 'transparent' ? '#fff' : color }}
            >
              {color === 'transparent' && (
                <div className="w-full h-full rounded-full relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZTJlOGYwIi8+PHJlY3QgeD0iOCIgeT0iOCIgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0iI2UyZThmMCIvPjwvc3ZnPg==')]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-0.5 bg-red-400 rotate-45" />
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Main color grid */}
        <div className="grid grid-cols-8 gap-1.5 mb-2">
          {COLOR_PALETTE.colors.map((color, idx) => (
            <button
              key={`color-${idx}`}
              onClick={() => handleColorSelect(color)}
              className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                selectedColor === color ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        {/* Outline colors row */}
        <div className="flex gap-1.5">
          {COLOR_PALETTE.outlines.map((outline, idx) => (
            <button
              key={`outline-${idx}`}
              onClick={() => handleColorSelect(outline.stroke)}
              className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                selectedColor === outline.stroke ? 'ring-2 ring-indigo-200' : ''
              }`}
              style={{ 
                backgroundColor: outline.fill,
                borderColor: outline.stroke,
              }}
            />
          ))}
        </div>
      </div>
      
      {AssetPickerModal}
    </div>
  );
}

export default BackgroundPicker;

