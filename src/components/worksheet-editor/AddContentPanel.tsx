/**
 * AddContentPanel - Panel pro přidávání nového obsahu (Mailchimp style)
 * 
 * Grid s typy bloků k přidání, rozdělený na sekce
 */

import {
  Type,
  AlignLeft,
  ListChecks,
  PenLine,
  MessageSquare,
  Square,
  Calculator,
  ImageIcon,
  Table,
  Link2,
  MapPin,
  Video,
  Info,
  FileText,
  QrCode,
} from 'lucide-react';
import { BlockType } from '../../types/worksheet';

interface AddContentPanelProps {
  onAddBlock: (type: BlockType) => void;
  pendingInsertType?: BlockType | null;
  onInsertAtEnd?: () => void;
  onCancelInsert?: () => void;
}

// Sekce: Informace
const informationBlocks: Array<{
  type: BlockType;
  icon: typeof Type;
  label: string;
  color: string;
}> = [
  { type: 'heading', icon: Type, label: 'Nadpis', color: 'text-blue-600' },
  { type: 'paragraph', icon: AlignLeft, label: 'Odstavec', color: 'text-slate-600' },
  { type: 'infobox', icon: Info, label: 'Infobox', color: 'text-amber-600' },
  { type: 'image', icon: ImageIcon, label: 'Obrázek', color: 'text-cyan-600' },
  { type: 'table', icon: Table, label: 'Tabulka', color: 'text-indigo-600' },
  { type: 'qr-code', icon: QrCode, label: 'QR kód', color: 'text-orange-500' },
  { type: 'spacer', icon: Square, label: 'Volný prostor', color: 'text-gray-500' },
  { type: 'header-footer', icon: FileText, label: 'Hlavička a patička', color: 'text-violet-600' },
];

// Sekce: Aktivity
const activityBlocks: Array<{
  type: BlockType;
  icon: typeof Type;
  label: string;
  color: string;
}> = [
  { type: 'multiple-choice', icon: ListChecks, label: 'Výběr odpovědi', color: 'text-green-600' },
  { type: 'fill-blank', icon: PenLine, label: 'Doplňování', color: 'text-purple-600' },
  { type: 'free-answer', icon: MessageSquare, label: 'Volná odpověď', color: 'text-rose-600' },
  { type: 'connect-pairs', icon: Link2, label: 'Spojovačka', color: 'text-orange-600' },
  { type: 'image-hotspots', icon: MapPin, label: 'Poznávačka', color: 'text-pink-600' },
  { type: 'video-quiz', icon: Video, label: 'Video kvíz', color: 'text-red-600' },
  { type: 'examples', icon: Calculator, label: 'Příklady', color: 'text-emerald-600' },
];

// Všechny bloky pro hledání v pending mode
const allBlocks = [...informationBlocks, ...activityBlocks];

export function AddContentPanel({ onAddBlock, pendingInsertType, onInsertAtEnd, onCancelInsert }: AddContentPanelProps) {
  if (pendingInsertType) {
    const selected = allBlocks.find(b => b.type === pendingInsertType);
    const SelectedIcon = selected?.icon;
    return (
      <div className="p-6 h-full overflow-y-auto bg-white flex flex-col">
        {/* Selected block indicator */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            {SelectedIcon && <SelectedIcon className={`w-5 h-5 ${selected?.color || ''}`} />}
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Vkládáte</p>
            <p className="text-sm font-semibold text-slate-800">
              {selected?.label || pendingInsertType}
            </p>
          </div>
        </div>

        {/* Main instruction */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <h2 className="text-xl font-semibold text-slate-800 mb-3">
            Kam to chcete vložit?
          </h2>
          <p className="text-sm text-slate-500 mb-8">
            Přejeďte myší nad blok a klikněte na modrou linku s pluskem.
          </p>

          {/* Divider with "nebo" */}
          <div className="flex items-center gap-3 w-full mb-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 uppercase tracking-wide">nebo</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Insert at end button */}
          <button
            type="button"
            onClick={onInsertAtEnd}
            className="w-full px-4 py-3 rounded-xl font-semibold transition-colors"
            style={{ backgroundColor: '#2563eb', color: 'white' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
          >
            Vložit na konec stránky
          </button>
        </div>

        {/* Cancel button at bottom */}
        <div className="pt-4 mt-auto">
          <button
            type="button"
            onClick={onCancelInsert}
            className="w-full px-4 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-500 font-medium border border-slate-200 transition-colors"
          >
            Zrušit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto bg-white">
      {/* Sekce: Informace */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
        Informace
      </h2>
      <p className="text-xs text-slate-400 mb-3">
        Obsah a struktura listu
      </p>
      
      <div className="grid grid-cols-2 gap-2 mb-6">
        {informationBlocks.map(({ type, icon: Icon, label, color }) => (
          <button
            key={type}
            onClick={() => onAddBlock(type)}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all hover:shadow-sm"
          >
            <Icon className={`w-6 h-6 ${color}`} />
            <span className="text-xs font-medium text-slate-700 text-center leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Sekce: Aktivity */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
        Aktivity
      </h2>
      <p className="text-xs text-slate-400 mb-3">
        Cvičení a úkoly pro žáky
      </p>
      
      <div className="grid grid-cols-2 gap-2">
        {activityBlocks.map(({ type, icon: Icon, label, color }) => (
          <button
            key={type}
            onClick={() => onAddBlock(type)}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-green-300 hover:bg-green-50 transition-all hover:shadow-sm"
          >
            <Icon className={`w-6 h-6 ${color}`} />
            <span className="text-xs font-medium text-slate-700 text-center leading-tight">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
