/**
 * SortableBlockList - Seznam bloků v levém panelu s drag & drop
 * 
 * Obsahuje SortableContext a renderuje jednotlivé SortableBlock komponenty
 */

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { WorksheetBlock, BlockType } from '../../types/worksheet';
import { SortableBlock } from './SortableBlock';
import { Layers, Plus, Type, AlignLeft, Info, ListChecks, TextCursorInput, MessageSquare, SquareIcon, Calculator, ImageIcon, Table, FileText, QrCode } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface SortableBlockListProps {
  blocks: WorksheetBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
  onAddBlock: (type: BlockType) => void;
}

// Konfigurace typů bloků pro dropdown
const BLOCK_TYPE_CONFIG: Record<BlockType, { label: string; icon: typeof Type; color: string }> = {
  'heading': { label: 'Nadpis', icon: Type, color: 'text-blue-500' },
  'paragraph': { label: 'Odstavec', icon: AlignLeft, color: 'text-slate-500' },
  'infobox': { label: 'Infobox', icon: Info, color: 'text-amber-500' },
  'multiple-choice': { label: 'Výběr odpovědi', icon: ListChecks, color: 'text-green-500' },
  'fill-blank': { label: 'Doplňování', icon: TextCursorInput, color: 'text-purple-500' },
  'free-answer': { label: 'Volná odpověď', icon: MessageSquare, color: 'text-rose-500' },
  'connect-pairs': { label: 'Spojovačka', icon: Type, color: 'text-orange-500' },
  'image-hotspots': { label: 'Poznávačka', icon: Type, color: 'text-pink-500' },
  'video-quiz': { label: 'Video kvíz', icon: Type, color: 'text-red-500' },
  'examples': { label: 'Příklady', icon: Calculator, color: 'text-emerald-500' },
  'table': { label: 'Tabulka', icon: Table, color: 'text-indigo-500' },
  'spacer': { label: 'Volný prostor', icon: SquareIcon, color: 'text-gray-400' },
  'image': { label: 'Obrázek', icon: ImageIcon, color: 'text-cyan-500' },
  'qr-code': { label: 'QR kód', icon: QrCode, color: 'text-orange-500' },
  'header-footer': { label: 'Hlavička a patička', icon: FileText, color: 'text-violet-500' },
};

export function SortableBlockList({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onAddBlock,
}: SortableBlockListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-3 bg-white">
      {blocks.length === 0 ? (
        /* Empty state */
        <div className="text-center py-8 text-slate-400">
          <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm text-slate-500">Zatím žádné bloky</p>
          <p className="text-xs mt-1 text-slate-400">Přidej první blok nebo použij AI</p>
        </div>
      ) : (
        /* Sortable block list */
        <SortableContext
          items={blocks.map(b => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {blocks.map((block) => (
              <SortableBlock
                key={block.id}
                block={block}
                isSelected={selectedBlockId === block.id}
                onSelect={onSelectBlock}
              />
            ))}
          </div>
        </SortableContext>
      )}

      {/* Add block dropdown */}
      <div className="mt-4">
        <Select onValueChange={(value) => onAddBlock(value as BlockType)}>
          <SelectTrigger className="w-full bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Přidat blok</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(BLOCK_TYPE_CONFIG).map(([type, config]) => {
              const Icon = config.icon;
              return (
                <SelectItem key={type} value={type}>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <span>{config.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

