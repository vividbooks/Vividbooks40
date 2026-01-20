/**
 * Image Hotspots Slide Editor (Poznávačka)
 * 
 * Editor for creating image identification activities
 * Click on image to add hotspots, each becomes a question
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Plus,
  Trash2,
  MapPin,
  Upload,
  Settings,
  X,
  Image as ImageIcon,
  Edit2,
  Sparkles,
} from 'lucide-react';
import { ImageHotspotsActivitySlide, ImageHotspot, HotspotMarkerStyle } from '../../../types/quiz';
import { AssetPicker } from '../../shared/AssetPicker';
import type { AssetPickerResult } from '../../../types/assets';
import { getContrastColor } from '../../../utils/color-utils';

interface ImageHotspotsEditorProps {
  slide: ImageHotspotsActivitySlide;
  onUpdate: (id: string, updates: Partial<ImageHotspotsActivitySlide>) => void;
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

// Marker styles - simplified (size controlled separately)
const MARKER_STYLES: { id: HotspotMarkerStyle; label: string; preview: React.ReactNode }[] = [
  { id: 'circle-medium', label: 'Kruh', preview: <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#64748b' }} /> },
  { id: 'pin', label: 'Špendlík', preview: <MapPin style={{ width: '20px', height: '20px', color: '#64748b' }} /> },
  { id: 'question-mark', label: 'Otazník', preview: <div style={{ width: '18px', height: '18px', borderRadius: '4px', backgroundColor: 'white', border: '2px solid #7C3AED', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>?</div> },
];

// Size options
const SIZE_OPTIONS: { id: number; label: string }[] = [
  { id: 0.7, label: 'Malá' },
  { id: 1.0, label: 'Střední' },
  { id: 1.4, label: 'Velká' },
  { id: 1.8, label: 'Největší' },
];

// Get marker size based on style (base size before multiplier)
function getEditorMarkerSize(style: HotspotMarkerStyle): number {
  switch (style) {
    case 'circle-medium': return 32;
    case 'pin': return 32;
    case 'question-mark': return 28;
    default: return 32;
  }
}

// Hotspot marker component for editor
function EditorHotspotMarker({
  hotspot,
  index,
  isSelected,
  onClick,
  markerStyle,
  markerSize = 1,
}: {
  hotspot: ImageHotspot;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  markerStyle: HotspotMarkerStyle;
  markerSize?: number;
}) {
  const baseSize = getEditorMarkerSize(markerStyle);
  const size = Math.round(baseSize * markerSize);

  const getMarkerStyle = (): React.CSSProperties => {
    const baseColor = isSelected ? '#14b8a6' : '#0f766e';
    const base: React.CSSProperties = {
      left: `${hotspot.x}%`,
      top: `${hotspot.y}%`,
      width: `${size}px`,
      height: `${size}px`,
    };

    if (markerStyle === 'question-mark') {
      return {
        ...base,
        backgroundColor: 'white',
        border: '2px solid #7C3AED',
        borderRadius: '6px',
      };
    }

    if (markerStyle === 'pin') {
      return {
        ...base,
        backgroundColor: baseColor,
        borderRadius: '50% 50% 50% 0',
        transform: 'translate(-50%, -50%) rotate(-45deg)',
      };
    }

    return {
      ...base,
      backgroundColor: baseColor,
      borderRadius: '50%',
    };
  };

  const renderContent = () => {
    if (markerStyle === 'question-mark') {
      return <span className="text-violet-600 font-bold" style={{ fontSize: `${Math.max(10, size * 0.4)}px` }}>?</span>;
    }
    return <span className="text-white font-bold" style={{ fontSize: `${Math.max(10, size * 0.4)}px` }}>{index + 1}</span>;
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`
        absolute transform -translate-x-1/2 -translate-y-1/2
        flex items-center justify-center
        transition-all hover:scale-110 cursor-pointer
        ${isSelected ? 'ring-4 ring-white ring-offset-2 ring-offset-teal-500 scale-110' : ''}
      `}
      style={{
        ...getMarkerStyle(),
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
      title={hotspot.label}
    >
      {markerStyle === 'pin' ? (
        <div style={{ transform: 'rotate(45deg)' }}>{renderContent()}</div>
      ) : (
        renderContent()
      )}
    </button>
  );
}

export function ImageHotspotsEditor({ slide, onUpdate }: ImageHotspotsEditorProps) {
  const [editingInstruction, setEditingInstruction] = useState(false);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [showImageInput, setShowImageInput] = useState(!slide.imageUrl);
  const [imageInputValue, setImageInputValue] = useState(slide.imageUrl || '');
  const [showAssetPicker, setShowAssetPicker] = useState(false);

  // Handle asset selection
  const handleAssetSelect = (result: AssetPickerResult) => {
    onUpdate(slide.id, { imageUrl: result.url });
    setShowAssetPicker(false);
    setShowImageInput(false);
  };
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [isHoveringImage, setIsHoveringImage] = useState(false);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const selectedHotspot = slide.hotspots.find(h => h.id === selectedHotspotId);

  // Handle mouse move to update preview marker position
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPlacementMode || !imageContainerRef.current) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPreviewPos({ x, y });
  }, [isPlacementMode]);

  // Handle image click to add hotspot
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return;
    
    // Only add if in placement mode or if it's the first point
    if (!isPlacementMode && slide.hotspots.length > 0) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newHotspot: ImageHotspot = {
      id: `hotspot-${Date.now()}`,
      x,
      y,
      label: `Bod ${slide.hotspots.length + 1}`,
      markerStyle: slide.markerStyle || 'circle-medium',
    };

    onUpdate(slide.id, { hotspots: [...slide.hotspots, newHotspot] });
    setSelectedHotspotId(newHotspot.id);
    setEditingLabel(newHotspot.id);
    
    // Exit placement mode after adding
    setIsPlacementMode(false);
    setPreviewPos(null);
  }, [slide, onUpdate, isPlacementMode]);

  // Update hotspot
  const updateHotspot = (hotspotId: string, updates: Partial<ImageHotspot>) => {
    const newHotspots = slide.hotspots.map(h => 
      h.id === hotspotId ? { ...h, ...updates } : h
    );
    onUpdate(slide.id, { hotspots: newHotspots });
  };

  // Delete hotspot
  const deleteHotspot = (hotspotId: string) => {
    onUpdate(slide.id, { 
      hotspots: slide.hotspots.filter(h => h.id !== hotspotId) 
    });
    if (selectedHotspotId === hotspotId) {
      setSelectedHotspotId(null);
    }
  };

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        onUpdate(slide.id, { imageUrl: dataUrl });
        setShowImageInput(false);
      };
      reader.readAsDataURL(file);
    }
  };

  // Save image URL
  const saveImageUrl = () => {
    if (imageInputValue.trim()) {
      onUpdate(slide.id, { imageUrl: imageInputValue.trim() });
      setShowImageInput(false);
    }
  };

  // Get background color and contrast color for text
  const bgColor = (slide as any).slideBackground?.color || '#ffffff';
  const textColor = getContrastColor(bgColor);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: bgColor, color: textColor }}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-2 text-sm mb-1" style={{ opacity: 0.7 }}>
          <MapPin className="w-4 h-4" />
          <span>Poznávačka</span>
        </div>
        <h2 className="font-bold text-lg">Označ body na obrázku</h2>
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
            placeholder="Označ správné místo na obrázku..."
            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none"
          />
        ) : (
          <div
            onClick={() => setEditingInstruction(true)}
            className="px-4 py-2 rounded-xl border border-slate-200 hover:border-teal-300 cursor-text"
          >
            {slide.instruction || <span className="text-slate-400">Klikni pro zadání instrukce...</span>}
          </div>
        )}
      </div>

      {/* Image section */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-medium text-slate-700">
            Obrázek s body ({slide.hotspots.length})
          </label>
          {slide.imageUrl && (
            <button
              onClick={() => setShowAssetPicker(true)}
              className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              Změnit obrázek
            </button>
          )}
        </div>

        {showImageInput || !slide.imageUrl ? (
          <div className="space-y-3">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
              <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">Vyberte obrázek pro poznávačku</p>
              
              <div className="flex flex-col items-center gap-3">
                <button 
                  onClick={() => setShowAssetPicker(true)}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg cursor-pointer hover:bg-indigo-600 transition-colors flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Vybrat obrázek
                </button>
                
                <span className="text-slate-400">nebo</span>
                
                <div className="flex gap-2 w-full max-w-md">
                  <input
                    type="text"
                    value={imageInputValue}
                    onChange={(e) => setImageInputValue(e.target.value)}
                    placeholder="URL obrázku"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  />
                  <button
                    onClick={saveImageUrl}
                    disabled={!imageInputValue.trim()}
                    className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    Použít
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative group/image-area">
            {/* Image with hotspots */}
            <div
              ref={imageContainerRef}
              onClick={handleImageClick}
              onMouseMove={handleMouseMove}
              onMouseEnter={() => setIsHoveringImage(true)}
              onMouseLeave={() => {
                setIsHoveringImage(false);
                if (!isPlacementMode) setPreviewPos(null);
              }}
              className={`relative w-full rounded-xl overflow-hidden ${isPlacementMode ? 'cursor-none' : 'cursor-default'}`}
              style={{ minHeight: '300px' }}
            >
              <img
                src={slide.imageUrl}
                alt="Obrázek k poznávačce"
                className="w-full h-auto"
                style={{ display: 'block' }}
              />
              
              {/* Hotspot markers */}
              {slide.hotspots.map((hotspot, index) => (
                <EditorHotspotMarker
                  key={hotspot.id}
                  hotspot={hotspot}
                  index={index}
                  isSelected={selectedHotspotId === hotspot.id}
                  onClick={() => {
                    setSelectedHotspotId(hotspot.id);
                    setEditingLabel(hotspot.id);
                  }}
                  markerStyle={slide.markerStyle || 'circle-medium'}
                  markerSize={slide.markerSize || 1}
                />
              ))}

              {/* Preview marker (follows cursor in placement mode) */}
              {isPlacementMode && previewPos && (
                <div
                  className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center opacity-70"
                  style={{
                    left: `${previewPos.x}%`,
                    top: `${previewPos.y}%`,
                    width: `${Math.round(getEditorMarkerSize(slide.markerStyle || 'circle-medium') * (slide.markerSize || 1))}px`,
                    height: `${Math.round(getEditorMarkerSize(slide.markerStyle || 'circle-medium') * (slide.markerSize || 1))}px`,
                    backgroundColor: '#14b8a6',
                    borderRadius: (slide.markerStyle || 'circle-medium') === 'pin' ? '50% 50% 50% 0' : '50%',
                    transform: `translate(-50%, -50%) ${(slide.markerStyle || 'circle-medium') === 'pin' ? 'rotate(-45deg)' : ''}`,
                    boxShadow: '0 0 15px rgba(20, 184, 166, 0.5)',
                    zIndex: 40,
                  }}
                >
                  <span className="text-white font-bold text-xs" style={{ transform: (slide.markerStyle || 'circle-medium') === 'pin' ? 'rotate(45deg)' : 'none' }}>
                    {slide.hotspots.length + 1}
                  </span>
                </div>
              )}
              
              {/* Overlay Button - Umístit body */}
              {!isPlacementMode && isHoveringImage && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors pointer-events-none">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsPlacementMode(true);
                    }}
                    className="pointer-events-auto px-6 py-3 bg-white text-[#4E5871] rounded-2xl shadow-xl border-none font-bold flex items-center gap-2 hover:scale-105 transition-all"
                    style={{
                      padding: '12px 24px',
                      backgroundColor: 'white',
                      color: '#4E5871',
                      borderRadius: '16px',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Plus className="w-5 h-5" />
                    Umístit body
                  </button>
                </div>
              )}

              {/* Placement mode active hint */}
              {isPlacementMode && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-teal-600 text-white px-4 py-2 rounded-full shadow-lg font-medium flex items-center gap-2 z-50">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  Klikněte kamkoliv pro umístění bodu
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsPlacementMode(false); }}
                    className="ml-2 hover:text-teal-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              
              {/* Click hint (only if no points yet) */}
              {slide.hotspots.length === 0 && !isPlacementMode && (
                <div className="absolute bottom-2 left-2 right-2 bg-black/50 text-white text-xs py-1.5 px-3 rounded-lg text-center">
                  Nahráno. Klikněte pro přidání bodů.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hotspot list & editor */}
      {slide.hotspots.length > 0 && (
        <div className="p-4 border-b border-slate-100">
          <label className="text-sm font-medium text-slate-700 mb-3 block">
            Body k identifikaci
          </label>
          
          <div className="space-y-2">
            {slide.hotspots.map((hotspot, index) => (
              <div
                key={hotspot.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  selectedHotspotId === hotspot.id 
                    ? 'border-teal-500 bg-teal-50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white"
                  style={{ backgroundColor: '#0f766e' }}
                >
                  {index + 1}
                </div>
                
                {editingLabel === hotspot.id ? (
                  <input
                    type="text"
                    value={hotspot.label}
                    onChange={(e) => updateHotspot(hotspot.id, { label: e.target.value })}
                    onBlur={() => setEditingLabel(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingLabel(null)}
                    autoFocus
                    className="flex-1 px-3 py-1.5 rounded-lg border border-teal-300 outline-none text-sm"
                    placeholder="Název bodu..."
                  />
                ) : (
                  <span 
                    className="flex-1 text-slate-700 font-medium cursor-pointer"
                    onClick={() => setEditingLabel(hotspot.id)}
                  >
                    {hotspot.label || 'Bez názvu'}
                  </span>
                )}
                
                <button
                  onClick={() => setEditingLabel(hotspot.id)}
                  className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => deleteHotspot(hotspot.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Marker Style, Size & Answer Type - compact row with dropdowns */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Marker Style - dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700 flex-shrink-0">
              Vzhled
            </label>
            <select
              value={slide.markerStyle || 'circle-medium'}
              onChange={(e) => onUpdate(slide.id, { markerStyle: e.target.value as HotspotMarkerStyle })}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 cursor-pointer"
            >
              {MARKER_STYLES.map((style) => (
                <option key={style.id} value={style.id}>{style.label}</option>
              ))}
            </select>
          </div>

          {/* Size dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700 flex-shrink-0">
              Velikost
            </label>
            <select
              value={slide.markerSize || 1}
              onChange={(e) => onUpdate(slide.id, { markerSize: parseFloat(e.target.value) })}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 cursor-pointer"
            >
              {SIZE_OPTIONS.map((size) => (
                <option key={size.id} value={size.id}>{size.label}</option>
              ))}
            </select>
          </div>

          {/* Answer Type - dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700 flex-shrink-0">
              Odpověď
            </label>
            <select
              value={slide.answerType || 'abc'}
              onChange={(e) => onUpdate(slide.id, { answerType: e.target.value as 'abc' | 'numeric' | 'text' })}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 cursor-pointer"
            >
              <option value="abc">ABC možnosti</option>
              <option value="numeric">Číselná klávesnice</option>
              <option value="text">Textová odpověď</option>
            </select>
          </div>
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
            ? `Každý bod = 1 bod (celkem ${slide.hotspots.length} bodů)` 
            : 'Celá aktivita = 1 bod'}
        />

        <ToggleSwitch
          enabled={slide.showAllHotspots}
          onChange={(v) => onUpdate(slide.id, { showAllHotspots: v })}
          label="Zobrazit všechny body"
          description={slide.showAllHotspots 
            ? 'Student vidí všechny body najednou' 
            : 'Jeden bod za druhým (náhodné pořadí)'}
        />

        {/* Only show randomize option when showing all hotspots */}
        {slide.showAllHotspots && (
          <ToggleSwitch
            enabled={slide.randomizeOrder}
            onChange={(v) => onUpdate(slide.id, { randomizeOrder: v })}
            label="Náhodné pořadí"
            description="Ptát se na body v náhodném pořadí"
          />
        )}
      </div>

      {/* Preview hint */}
      <div className="px-4 pb-4">
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <MapPin className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h4 className="font-medium text-teal-900">Poznávačka</h4>
              <p className="text-sm text-teal-700 mt-1">
                Student vidí obrázek a postupně vybírá správné odpovědi z ABC možností 
                pro každý označený bod.
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Asset Picker Modal */}
      <AssetPicker
        isOpen={showAssetPicker}
        onClose={() => setShowAssetPicker(false)}
        onSelect={handleAssetSelect}
        showUpload={true}
        showLibrary={true}
        showGiphy={false}
        showGoogle={true}
        showVividbooks={true}
        defaultTab="upload"
      />
    </div>
  );
}

export default ImageHotspotsEditor;

