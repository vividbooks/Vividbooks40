/**
 * StructurePanel - Seznam bloků s drag & drop
 * 
 * Zobrazuje:
 * - Nastavení sloupců a velikosti písma
 * - Seznam bloků (scrollovatelný)
 * - Tlačítko Přidat blok
 * 
 * Nastavení bloku se zobrazuje v BlockSettingsOverlay
 */

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  Type,
  AlignLeft,
  Info,
  ListChecks,
  TextCursorInput,
  MessageSquare,
  Plus,
  Layers,
  Columns2,
  SquareIcon,
  Calculator,
  ImageIcon,
  Table,
  FileText,
  QrCode,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '../ui/select';
import {
  Worksheet,
  BlockType,
  ColumnCount,
  GlobalFontSize,
} from '../../types/worksheet';
import { SortableBlock } from './SortableBlock';

interface StructurePanelProps {
  worksheet: Worksheet;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
  onHoverBlock?: (blockId: string | null) => void;
  onAddBlock: (type: BlockType) => void;
  onUpdateColumns: (columns: ColumnCount) => void;
  onUpdateGlobalFontSize: (fontSize: GlobalFontSize) => void;
}

// Konfigurace typů bloků
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

export function StructurePanel({
  worksheet,
  selectedBlockId,
  onSelectBlock,
  onHoverBlock,
  onAddBlock,
  onUpdateColumns,
  onUpdateGlobalFontSize,
}: StructurePanelProps) {
  const globalFontSize = worksheet.metadata.globalFontSize || 'small';

  // Calculate actual layout state from blocks
  const allFull = worksheet.blocks.length === 0 || worksheet.blocks.every(b => b.width === 'full' || !b.width);
  const allHalf = worksheet.blocks.length > 0 && worksheet.blocks.every(b => b.width === 'half');
  const layoutState: 'single' | 'double' | 'mixed' = allFull ? 'single' : allHalf ? 'double' : 'mixed';

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex-shrink-0">
        <h2 className="font-semibold text-slate-800">Struktura</h2>
      </div>

      {/* Layout settings */}
      <div className="px-3 py-3 border-b border-slate-200 flex-shrink-0 space-y-3">
        {/* Column layout */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Rozložení</label>
          <div className="flex gap-2">
            <button
              onClick={() => onUpdateColumns(1)}
              style={{
                backgroundColor: layoutState === 'single' ? '#4E5871' : '#f1f5f9',
                color: layoutState === 'single' ? 'white' : '#64748b',
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <SquareIcon className="w-4 h-4" />
              <span>1 sloupec</span>
            </button>
            <button
              onClick={() => onUpdateColumns(2)}
              style={{
                backgroundColor: layoutState === 'double' ? '#4E5871' : '#f1f5f9',
                color: layoutState === 'double' ? 'white' : '#64748b',
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Columns2 className="w-4 h-4" />
              <span>2 sloupce</span>
            </button>
          </div>
          {layoutState === 'mixed' && (
            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
              <Layers className="w-3 h-3" />
              Smíšené rozložení (bloky mají různé šířky)
            </p>
          )}
        </div>

        {/* Global font size */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Velikost písma</label>
          <div className="flex gap-2">
            <button
              onClick={() => onUpdateGlobalFontSize('small')}
              style={{
                backgroundColor: globalFontSize === 'small' ? '#4E5871' : '#f1f5f9',
                color: globalFontSize === 'small' ? 'white' : '#64748b',
              }}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Malé
            </button>
            <button
              onClick={() => onUpdateGlobalFontSize('normal')}
              style={{
                backgroundColor: globalFontSize === 'normal' ? '#4E5871' : '#f1f5f9',
                color: globalFontSize === 'normal' ? 'white' : '#64748b',
              }}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Normální
            </button>
            <button
              onClick={() => onUpdateGlobalFontSize('large')}
              style={{
                backgroundColor: globalFontSize === 'large' ? '#4E5871' : '#f1f5f9',
                color: globalFontSize === 'large' ? 'white' : '#64748b',
              }}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Velké
            </button>
          </div>
        </div>
      </div>

      {/* Block list - scrollable */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {worksheet.blocks.length === 0 ? (
          /* Empty state */
          <div className="text-center py-8 text-slate-400">
            <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm text-slate-500">Zatím žádné bloky</p>
            <p className="text-xs mt-1 text-slate-400">Přidej první blok nebo použij AI</p>
          </div>
        ) : (
          /* Sortable block list */
          <SortableContext
            items={worksheet.blocks.map(b => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {worksheet.blocks.map((block) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  isSelected={selectedBlockId === block.id}
                  onSelect={onSelectBlock}
                  onHover={onHoverBlock}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>

      {/* Add block dropdown - sticky at bottom */}
      <div className="px-3 py-2 border-t border-slate-200 flex-shrink-0 bg-white">
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
