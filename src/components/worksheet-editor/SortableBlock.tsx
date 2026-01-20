/**
 * SortableBlock - Jednotlivý blok v seznamu s drag & drop podporou
 * 
 * Wrapper pro blok v levém panelu používající useSortable hook
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Type, AlignLeft, Info, ListChecks, TextCursorInput, MessageSquare, Square, Calculator, ImageIcon, Table, FileText, QrCode } from 'lucide-react';
import { WorksheetBlock, BlockType } from '../../types/worksheet';

interface SortableBlockProps {
  block: WorksheetBlock;
  isSelected: boolean;
  onSelect: (blockId: string) => void;
  onHover?: (blockId: string | null) => void;
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
  'spacer': { label: 'Volný prostor', icon: Square, color: 'text-gray-400' },
  'examples': { label: 'Příklady', icon: Calculator, color: 'text-emerald-500' },
  'image': { label: 'Obrázek', icon: ImageIcon, color: 'text-cyan-500' },
  'table': { label: 'Tabulka', icon: Table, color: 'text-indigo-500' },
  'qr-code': { label: 'QR kód', icon: QrCode, color: 'text-orange-500' },
  'header-footer': { label: 'Hlavička a patička', icon: FileText, color: 'text-violet-500' },
};

// Helper pro zkrácení obsahu bloku
function getBlockPreview(block: WorksheetBlock): string {
  switch (block.type) {
    case 'heading':
      return block.content.text || 'Nadpis...';
    case 'paragraph':
      // Strip HTML tags and truncate
      return block.content.html?.replace(/<[^>]*>/g, '').slice(0, 30) || 'Odstavec...';
    case 'infobox':
      return block.content.title || block.content.html?.replace(/<[^>]*>/g, '').slice(0, 30) || 'Infobox...';
    case 'multiple-choice':
      return block.content.question?.slice(0, 30) || 'Otázka...';
    case 'fill-blank':
      return block.content.instruction || 'Doplňování...';
    case 'free-answer':
      return block.content.question?.slice(0, 30) || 'Volná odpověď...';
    case 'connect-pairs':
      return block.content.instruction?.slice(0, 30) || `${block.content.pairs.length} dvojic`;
    case 'image-hotspots':
      return block.content.instruction?.slice(0, 30) || `${block.content.hotspots.length} bodů`;
    case 'video-quiz':
      return block.content.instruction?.slice(0, 30) || `${block.content.questions.length} otázek`;
    case 'spacer':
      return `${block.content.height}px`;
    case 'examples':
      return block.content.topic || `${block.content.examples.length} příkladů`;
    case 'image':
      return block.content.alt || block.content.caption || 'Obrázek';
    case 'table':
      return `${block.content.rows}×${block.content.columns} tabulka`;
    case 'qr-code':
      return block.content.caption || block.content.url || 'QR kód';
    case 'header-footer':
      return block.content.variant === 'header' ? 'Hlavička' : 'Patička';
    default:
      return 'Blok...';
  }
}

export function SortableBlock({ block, isSelected, onSelect, onHover }: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  const config = BLOCK_TYPE_CONFIG[block.type];
  const Icon = config.icon;
  const preview = getBlockPreview(block);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(block.id)}
      onMouseEnter={() => onHover?.(block.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`
        flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all
        ${isDragging ? 'shadow-lg scale-[1.02]' : ''}
        ${isSelected
          ? 'bg-blue-50 border border-blue-300'
          : 'bg-slate-50 hover:bg-slate-100 border border-slate-200'
        }
      `}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-slate-200 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4 text-slate-400" />
      </div>

      {/* Block icon */}
      <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />

      {/* Block info */}
      <div className="flex-1 min-w-0">
        <span className="text-xs text-slate-500 block">{config.label}</span>
        <span className="text-sm text-slate-800 truncate block">{preview}</span>
      </div>
    </div>
  );
}
