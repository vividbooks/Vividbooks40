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

import React, { useMemo, useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { BackgroundSettings } from '../../../types/quiz';
import { useAssetPicker } from '../../../hooks/useAssetPicker';

// Predefined color palette
const COLOR_PALETTE = {
  grays: [
    'transparent', // Empty/transparent
    '#ffffff',     // White
    '#e2e8f0',     // Slate 200
    '#94a3b8',     // Slate 400
    '#64748b',     // Slate 500
    '#1e293b',     // Slate 800
    '#0f172a',     // Slate 900
  ],
  colors: [
    // Row 1 - Deep/Dark
    '#450a0a', '#7f1d1d', '#78350f', '#14532d', '#134e4a', '#0c4a6e', '#1e3a8a', '#4c1d95', '#701a75',
    // Row 2 - Dark
    '#7f1d1d', '#b91c1c', '#a16207', '#166534', '#0f766e', '#0369a1', '#1d4ed8', '#6d28d9', '#a21caf',
    // Row 3 - Medium
    '#dc2626', '#ef4444', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6', '#8b5cf6', '#d946ef',
    // Row 4 - Light
    '#fca5a5', '#fecaca', '#fde047', '#86efac', '#5eead4', '#7dd3fc', '#93c5fd', '#c4b5fd', '#f0abfc',
    // Row 5 - Very light
    '#fee2e2', '#fef2f2', '#fef9c3', '#dcfce7', '#ccfbf1', '#e0f2fe', '#dbeafe', '#ede9fe', '#fae8ff',
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

type PickerLayer = 'fill' | 'stroke';

const CHECKERBOARD_STYLE: React.CSSProperties = {
  backgroundColor: '#ffffff',
  backgroundImage: `
    linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
    linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
    linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)
  `,
  backgroundSize: '10px 10px',
  backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0',
};

export function BackgroundPicker({
  value,
  onChange,
  onClose,
  showUpload = true,
  showOpacity = true,
  showBlur = true,
  inline = false,
}: BackgroundPickerProps) {
  const [activeLayer, setActiveLayer] = useState<PickerLayer>('fill');
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    const saved = localStorage.getItem('vividboard-recent-colors');
    return saved ? JSON.parse(saved) : [];
  });
  const colorInputRef = useRef<HTMLInputElement>(null);
  
  const { openAssetPicker, AssetPickerModal } = useAssetPicker({
    onSelect: (result) => {
      onChange({
        type: 'image',
        imageUrl: result.url,
        opacity,
        blur,
        strokeColor: value?.strokeColor,
        strokeWidth: value?.strokeWidth,
      });
    },
  });

  const selectedFillColor = value?.type === 'color' ? (value.color || 'transparent') : 'transparent';
  const selectedStrokeColor = value?.strokeColor || '#0f172a';
  const opacity = value?.opacity ?? 100;
  const blur = value?.blur ?? 0;
  const strokeWidth = value?.strokeWidth ?? 0;
  const selectedColor = activeLayer === 'fill' ? selectedFillColor : selectedStrokeColor;
  const colorInputValue = useMemo(() => {
    if (selectedColor && selectedColor.startsWith('#')) return selectedColor;
    return '#ffffff';
  }, [selectedColor]);

  const handleColorSelect = (color: string) => {
    // Add to recent colors
    const newRecent = [color, ...recentColors.filter(c => c !== color)].slice(0, 10);
    setRecentColors(newRecent);
    localStorage.setItem('vividboard-recent-colors', JSON.stringify(newRecent));

    if (activeLayer === 'stroke') {
      onChange({
        ...(value || { type: 'color', color: '#ffffff' }),
        type: value?.type || 'color',
        color: value?.color || '#ffffff',
        strokeColor: color,
        strokeWidth: strokeWidth > 0 ? strokeWidth : 2,
      });
      return;
    }

    onChange({
      ...value,
      type: 'color',
      color,
      imageUrl: undefined,
      opacity,
      blur,
      strokeColor: value?.strokeColor,
      strokeWidth: value?.strokeWidth,
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
      color: value?.color || '#ffffff',
      opacity: newOpacity,
    });
  };

  const handleBlurChange = (newBlur: number) => {
    onChange({
      ...value,
      type: value?.type || 'color',
      color: value?.color || '#ffffff',
      blur: newBlur,
    });
  };

  const handleStrokeWidthChange = (newStrokeWidth: number) => {
    onChange({
      ...(value || { type: 'color', color: '#ffffff' }),
      type: value?.type || 'color',
      color: value?.color || '#ffffff',
      strokeWidth: newStrokeWidth,
      strokeColor: newStrokeWidth > 0 ? selectedStrokeColor : undefined,
    });
  };

  const clearStroke = () => {
    onChange({
      ...(value || { type: 'color', color: '#ffffff' }),
      type: value?.type || 'color',
      color: value?.color || '#ffffff',
      strokeWidth: 0,
      strokeColor: undefined,
    });
  };

  const renderSwatchFill = (color: string) => {
    if (color === 'transparent') {
      return (
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div className="absolute inset-0" style={CHECKERBOARD_STYLE} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-0.5 bg-rose-400 rotate-45" />
          </div>
        </div>
      );
    }

    return <div className="absolute inset-0 rounded-full" style={{ backgroundColor: color }} />;
  };

  const currentPreview = useMemo<React.CSSProperties>(() => {
    if (activeLayer === 'stroke') return {};

    if (value?.type === 'image' && value.imageUrl) {
      return {
        backgroundImage: `url(${value.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }

    if (selectedFillColor !== 'transparent') {
      return { backgroundColor: selectedFillColor };
    }

    return CHECKERBOARD_STYLE;
  }, [activeLayer, value, selectedFillColor]);

  return (
    <div 
      className={`bg-white rounded-2xl border border-slate-200 p-2.5 ${
        inline ? 'w-full' : 'absolute z-50 shadow-2xl w-[320px]'
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

      <div className="flex gap-2 mb-2.5">
        <button
          onClick={() => setActiveLayer('fill')}
          className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-2xl transition-all ${
            activeLayer === 'fill'
              ? 'text-white shadow-sm'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
          style={activeLayer === 'fill' ? { backgroundColor: '#59627B' } : undefined}
        >
          <div
            className="relative rounded-full border border-slate-200 overflow-hidden shrink-0"
            style={value?.type === 'image' && value.imageUrl ? {
              width: 30,
              height: 30,
              flex: '0 0 30px',
              backgroundImage: `url(${value.imageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            } : selectedFillColor === 'transparent' ? {
              width: 30,
              height: 30,
              flex: '0 0 30px',
              ...CHECKERBOARD_STYLE,
            } : {
              width: 30,
              height: 30,
              flex: '0 0 30px',
              backgroundColor: selectedFillColor,
            }}
          >
            {selectedFillColor === 'transparent' && value?.type !== 'image' ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-0.5 bg-rose-400 rotate-45" />
              </div>
            ) : null}
          </div>
          <div className="text-left leading-tight">
            <div className="font-medium text-[12px]">Výplň</div>
            <div className={`text-[10px] ${activeLayer === 'fill' ? 'text-white/75' : 'text-slate-400'}`}>Barva nebo obrázek</div>
          </div>
        </button>
        <button
          onClick={() => setActiveLayer('stroke')}
          className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-2xl transition-all ${
            activeLayer === 'stroke'
              ? 'text-white shadow-sm'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
          style={activeLayer === 'stroke' ? { backgroundColor: '#59627B' } : undefined}
        >
          <div
            className="relative rounded-full border border-slate-200 bg-white shrink-0 flex items-center justify-center"
            style={{
              width: 30,
              height: 30,
              flex: '0 0 30px',
            }}
          >
            <div
              className="rounded-full"
              style={{
                width: Math.max(Math.min(strokeWidth * 2, 8), 2),
                height: 18,
                backgroundColor: strokeWidth > 0 ? selectedStrokeColor : '#cbd5e1',
              }}
            />
            {strokeWidth === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-0.5 bg-slate-300 rotate-45" />
              </div>
            )}
          </div>
          <div className="text-left leading-tight">
            <div className="font-medium text-[12px]">Stroke</div>
            <div className={`text-[10px] ${activeLayer === 'stroke' ? 'text-white/75' : 'text-slate-400'}`}>Obrys prvku</div>
          </div>
        </button>
      </div>

      <input
        ref={colorInputRef}
        type="color"
        value={colorInputValue}
        onChange={(e) => handleColorSelect(e.target.value)}
        className="hidden"
      />

      {activeLayer === 'fill' ? (
        <>
          {(showOpacity || showBlur) && (
            <div className={`grid ${showOpacity && showBlur ? 'grid-cols-2' : 'grid-cols-1'} gap-2 mb-2.5`}>
              {showOpacity && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-500 block">Krytí</label>
                    <span className="text-xs font-medium text-slate-600">{opacity}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md border border-slate-200 shrink-0" style={CHECKERBOARD_STYLE} />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={opacity}
                      onChange={(e) => handleOpacityChange(Number(e.target.value))}
                      className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
                    />
                    <div
                      className="w-6 h-6 rounded-md border border-slate-200 shrink-0"
                      style={value?.type === 'image' && value.imageUrl ? {
                        backgroundImage: `url(${value.imageUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      } : selectedFillColor === 'transparent' ? CHECKERBOARD_STYLE : { backgroundColor: selectedFillColor }}
                    />
                  </div>
                </div>
              )}
              {showBlur && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-500 block">Rozmlžení</label>
                    <span className="text-xs font-medium text-slate-600">{blur}px</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 flex items-center justify-center shrink-0">
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
                    <div className="w-6 h-6 flex items-center justify-center shrink-0">
                      <div className="w-4 h-4 rounded-full bg-slate-400 blur-[2px]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2 mb-2.5">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-slate-500 block">Síla tahu</label>
            <span className="text-xs font-medium text-slate-600">{strokeWidth}px</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div
              className="rounded-full border border-slate-200 bg-white shrink-0 flex items-center justify-center"
              style={{ width: 30, height: 30, flex: '0 0 30px' }}
            >
              <div
                className="rounded-full"
                style={{
                  width: Math.max(Math.min(strokeWidth * 2, 8), 2),
                  height: 18,
                  backgroundColor: strokeWidth > 0 ? selectedStrokeColor : '#cbd5e1',
                }}
              />
            </div>
            <input
              type="range"
              min="0"
              max="12"
              value={strokeWidth}
              onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
              className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
            />
            <button
              onClick={clearStroke}
              className="px-2 py-1 rounded-xl bg-white border border-slate-200 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Bez tahu
            </button>
          </div>
        </div>
      )}

      {recentColors.length > 0 && (
        <div className="mb-2.5">
          <label className="text-[11px] text-slate-500 mb-1 block">Naposledy použité</label>
          <div className="flex gap-1 flex-wrap">
            {recentColors.map((color, idx) => (
              <button
                key={`${color}-${idx}`}
                onClick={() => handleColorSelect(color)}
                className={`relative w-9 h-9 rounded-full border-2 transition-all hover:scale-110 shrink-0 ${
                  selectedColor === color ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'
                }`}
                style={{ width: 30, height: 30, flex: '0 0 30px' }}
              >
                {renderSwatchFill(color)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="text-[11px] text-slate-500 mb-1 block">Výběr barev</label>
        <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))' }}>
          <button
            onClick={openAssetPicker}
            className="relative rounded-full border-2 border-slate-200 transition-all hover:scale-110 shrink-0 flex items-center justify-center text-slate-500 bg-white"
            style={{ width: 30, height: 30, flex: '0 0 30px' }}
            title="Nahrát"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCustomColor}
            className="relative rounded-full border-2 border-slate-200 transition-all hover:scale-110 shrink-0 overflow-hidden"
            style={{ width: 30, height: 30, flex: '0 0 30px', background: 'conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)' }}
            title="Vlastní barva"
          />
          {COLOR_PALETTE.grays.map((color, idx) => (
            <button
              key={`gray-${idx}`}
              onClick={() => handleColorSelect(color)}
              className={`relative w-9 h-9 rounded-full border-2 transition-all hover:scale-110 shrink-0 ${
                selectedColor === color ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'
              }`}
              style={{ width: 30, height: 30, flex: '0 0 30px' }}
            >
              {renderSwatchFill(color)}
            </button>
          ))}
        </div>

        <div className="grid gap-1 mb-0.5" style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))' }}>
          {COLOR_PALETTE.colors.map((color, idx) => (
            <button
              key={`color-${idx}`}
              onClick={() => handleColorSelect(color)}
              className={`relative w-9 h-9 rounded-full border-2 transition-all hover:scale-110 shrink-0 ${
                selectedColor === color ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-transparent'
              }`}
              style={{ backgroundColor: color, width: 30, height: 30, flex: '0 0 30px' }}
            />
          ))}
        </div>
      </div>
      
      {AssetPickerModal}
    </div>
  );
}

export default BackgroundPicker;

