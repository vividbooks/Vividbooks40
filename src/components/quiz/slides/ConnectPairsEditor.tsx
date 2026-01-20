/**
 * Connect Pairs Slide Editor (Spojovačka)
 * 
 * Editor for creating matching pair activities
 * Supports text-text, image-text, and image-image pairs
 */

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Link2,
  Image as ImageIcon,
  Type,
  GripVertical,
  ArrowLeftRight,
  Settings,
} from 'lucide-react';
import { ConnectPairsActivitySlide, ConnectPair, ConnectPairItem } from '../../../types/quiz';
import { useAssetPicker } from '../../../hooks/useAssetPicker';
import { getContrastColor } from '../../../utils/color-utils';

interface ConnectPairsEditorProps {
  slide: ConnectPairsActivitySlide;
  onUpdate: (id: string, updates: Partial<ConnectPairsActivitySlide>) => void;
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

// Pair Item Editor
function PairItemEditor({
  item,
  side,
  onUpdate,
}: {
  item: ConnectPairItem;
  side: 'left' | 'right';
  onUpdate: (updates: Partial<ConnectPairItem>) => void;
}) {
  const { openAssetPicker, AssetPickerModal } = useAssetPicker({
    onSelect: (result) => {
      onUpdate({ type: 'image', content: result.url });
    },
  });

  const toggleType = () => {
    if (item.type === 'text') {
      openAssetPicker();
    } else {
      onUpdate({ type: 'text', content: '' });
    }
  };

  return (
    <>
      <div className="flex-1 min-w-0">
        {item.type === 'image' && item.content ? (
          <div className="relative group">
            <img 
              src={item.content} 
              alt="Pair item"
              className="w-full h-24 object-cover rounded-lg border border-slate-200"
            />
            <button
              onClick={() => onUpdate({ type: 'text', content: '' })}
              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={item.content}
              onChange={(e) => onUpdate({ content: e.target.value })}
              placeholder={side === 'left' ? 'Levá strana...' : 'Pravá strana...'}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-violet-500 outline-none"
            />
            <button
              onClick={toggleType}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500"
              title="Přidat obrázek"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      
      {AssetPickerModal}
    </>
  );
}

export function ConnectPairsEditor({ slide, onUpdate }: ConnectPairsEditorProps) {
  const [editingInstruction, setEditingInstruction] = useState(false);

  const updatePair = (pairId: string, side: 'left' | 'right', updates: Partial<ConnectPairItem>) => {
    const newPairs = slide.pairs.map(pair => {
      if (pair.id === pairId) {
        return {
          ...pair,
          [side]: { ...pair[side], ...updates },
        };
      }
      return pair;
    });
    onUpdate(slide.id, { pairs: newPairs });
  };

  const addPair = () => {
    const newId = Date.now().toString();
    const newPair: ConnectPair = {
      id: `pair-${newId}`,
      left: { id: `left-${newId}`, type: 'text', content: '' },
      right: { id: `right-${newId}`, type: 'text', content: '' },
    };
    onUpdate(slide.id, { pairs: [...slide.pairs, newPair] });
  };

  const removePair = (pairId: string) => {
    if (slide.pairs.length <= 2) return; // Minimum 2 pairs
    onUpdate(slide.id, { pairs: slide.pairs.filter(p => p.id !== pairId) });
  };

  // Get background color and contrast color for text
  const bgColor = (slide as any).slideBackground?.color || '#ffffff';
  const textColor = getContrastColor(bgColor);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: bgColor, color: textColor }}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-2 text-sm mb-1" style={{ opacity: 0.7 }}>
          <Link2 className="w-4 h-4" />
          <span>Spojovačka</span>
        </div>
        <h2 className="font-bold text-lg">Spoj správné dvojice</h2>
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
            placeholder="Spoj správné dvojice..."
            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-violet-500 outline-none"
          />
        ) : (
          <div
            onClick={() => setEditingInstruction(true)}
            className="px-4 py-2 rounded-xl border border-slate-200 hover:border-violet-300 cursor-text"
          >
            {slide.instruction || <span className="text-slate-400">Klikni pro zadání instrukce...</span>}
          </div>
        )}
      </div>

      {/* Pairs */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-medium text-slate-700">
            Dvojice k spojení ({slide.pairs.length})
          </label>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Type className="w-3 h-3" /> Text
            <ArrowLeftRight className="w-3 h-3 mx-1" />
            <ImageIcon className="w-3 h-3" /> Obrázek
          </div>
        </div>

        <div className="space-y-3">
          {slide.pairs.map((pair, index) => (
            <div
              key={pair.id}
              className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl"
            >
              {/* Drag handle */}
              <div className="flex items-center justify-center w-6 h-10 text-slate-400">
                <GripVertical className="w-4 h-4" />
              </div>

              {/* Left side */}
              <PairItemEditor
                item={pair.left}
                side="left"
                onUpdate={(updates) => updatePair(pair.id, 'left', updates)}
              />

              {/* Connection indicator */}
              <div className="flex items-center justify-center w-10 h-10">
                <div className="w-8 h-0.5 bg-violet-300 relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-violet-400 rounded-full" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-violet-400 rounded-full" />
                </div>
              </div>

              {/* Right side */}
              <PairItemEditor
                item={pair.right}
                side="right"
                onUpdate={(updates) => updatePair(pair.id, 'right', updates)}
              />

              {/* Delete button */}
              <button
                onClick={() => removePair(pair.id)}
                disabled={slide.pairs.length <= 2}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add pair button */}
        {slide.pairs.length < 12 && (
          <button
            onClick={addPair}
            className="mt-4 w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Přidat dvojici
          </button>
        )}
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
            ? `Každá dvojice = 1 bod (celkem ${slide.pairs.length} bodů)` 
            : 'Celá aktivita = 1 bod'}
        />

        <ToggleSwitch
          enabled={slide.shuffleSides}
          onChange={(v) => onUpdate(slide.id, { shuffleSides: v })}
          label="Zamíchat strany"
          description="Položky na obou stranách budou v náhodném pořadí"
        />
      </div>

      {/* Preview hint */}
      <div className="px-4 pb-4">
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Link2 className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h4 className="font-medium text-violet-900">Spojovačka</h4>
              <p className="text-sm text-violet-700 mt-1">
                Student vybere položku vlevo, pak vpravo a propojí je. 
                Funguje dobře na dotyku i myší.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConnectPairsEditor;










