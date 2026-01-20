/**
 * BlockSettingsOverlay - Overlay panel pro nastavení vybraného bloku
 * 
 * Překryje celý levý panel včetně mini sidebaru.
 * Obsahuje detailní nastavení specifické pro typ bloku.
 */

import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  ChevronDown as ChevronDownIcon,
  Trash2,
  Copy,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Info,
  List,
  ListOrdered,
  ListChecks,
  TextCursorInput,
  MessageSquare,
  Minus,
  Plus,
  Square,
  Circle,
  Calculator,
  Sparkles,
  RectangleHorizontal,
  LayoutGrid,
  Columns2,
  MoreHorizontal,
  ImageIcon,
  RefreshCw,
  Table,
  FileText,
  QrCode,
  Check,
  Link2,
  ArrowLeftRight,
  GripVertical,
  X,
  PlayCircle,
  MapPin,
  Map,
} from 'lucide-react';

// Alias for better naming
const LayoutColumns = Columns2;
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';
import {
  WorksheetBlock,
  BlockType,
  BlockWidth,
  HeadingBlock,
  ParagraphBlock,
  InfoboxBlock,
  MultipleChoiceBlock,
  FillBlankBlock,
  FreeAnswerBlock,
  ConnectPairsBlock,
  ImageHotspotsBlock,
  VideoQuizBlock,
  SpacerBlock,
  ExamplesBlock,
  ImageBlock,
  HeaderFooterBlock,
  QRCodeBlock,
  InfoboxVariant,
  SpacerStyle,
  ExamplesLabelType,
  AnswerBoxStyle,
  ImageSize,
  BlockImage,
  ImagePosition,
  HeaderFooterContent,
  QRCodeContent,
  ConnectPairsContent,
  ImageHotspotsContent,
  VideoQuizContent,
  FeedbackType,
} from '../../types/worksheet';
import { generateExamplesFromSample } from '../../utils/ai-examples-generator';
import { editBlockWithAI } from '../../utils/ai-worksheet-generator';
import { toast } from 'sonner';

interface BlockSettingsOverlayProps {
  block: WorksheetBlock;
  allBlocks?: WorksheetBlock[]; // All blocks for AI context
  onClose: () => void;
  onUpdateBlock: (blockId: string, content: any) => void;
  onUpdateBlockWidth: (blockId: string, width: BlockWidth, widthPercent?: number) => void;
  onUpdateBlockMarginStyle: (blockId: string, marginStyle: 'empty' | 'dotted' | 'lined') => void;
  onUpdateBlockImage?: (blockId: string, image: BlockImage | undefined) => void;
  onUpdateBlockVisualStyles?: (blockId: string, visualStyles: any) => void;
  onDeleteBlock: (blockId: string) => void;
  onDuplicateBlock: (blockId: string) => void;
  onMoveUp: (blockId: string) => void;
  onMoveDown: (blockId: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  forceOpenAI?: boolean;
}

// Konfigurace typů bloků
const BLOCK_TYPE_CONFIG: Record<BlockType, { label: string; icon: typeof Type }> = {
  'heading': { label: 'Nadpis', icon: Type },
  'paragraph': { label: 'Odstavec', icon: AlignLeft },
  'infobox': { label: 'Infobox', icon: Info },
  'multiple-choice': { label: 'Výběr odpovědi', icon: ListChecks },
  'fill-blank': { label: 'Doplňování', icon: TextCursorInput },
  'free-answer': { label: 'Volná odpověď', icon: MessageSquare },
  'connect-pairs': { label: 'Spojovačka', icon: Link2 },
  'image-hotspots': { label: 'Poznávačka', icon: MapPin },
  'video-quiz': { label: 'Video kvíz', icon: PlayCircle },
  'spacer': { label: 'Volný prostor', icon: Square },
  'examples': { label: 'Příklady', icon: Calculator },
  'image': { label: 'Obrázek', icon: ImageIcon },
  'table': { label: 'Tabulka', icon: Table },
  'qr-code': { label: 'QR kód', icon: QrCode },
  'header-footer': { label: 'Hlavička a patička', icon: FileText },
};

// Barvy pozadí
const BACKGROUND_OPTIONS = [
  { value: 'none', label: 'Žádné', bgClass: 'bg-white border' },
  { value: 'gray', label: 'Světle šedé', bgClass: 'bg-slate-100' },
  { value: 'blue', label: 'Světle modré', bgClass: 'bg-blue-50' },
  { value: 'green', label: 'Světle zelené', bgClass: 'bg-green-50' },
  { value: 'yellow', label: 'Světle žluté', bgClass: 'bg-yellow-50' },
];

// Barvy infoboxu
const INFOBOX_VARIANTS: { value: InfoboxVariant; label: string; bgClass: string }[] = [
  { value: 'blue', label: 'Modrá', bgClass: 'bg-blue-500' },
  { value: 'green', label: 'Zelená', bgClass: 'bg-green-500' },
  { value: 'yellow', label: 'Žlutá', bgClass: 'bg-yellow-500' },
  { value: 'purple', label: 'Fialová', bgClass: 'bg-purple-500' },
];

// Visual style color options - more saturated colors for better visibility
const VISUAL_BG_COLORS = [
  { value: 'transparent', label: 'Žádná', color: 'transparent', displayColor: '#ffffff' },
  { value: '#f1f5f9', label: 'Šedá', color: '#f1f5f9', displayColor: '#94a3b8' },
  { value: '#dbeafe', label: 'Modrá', color: '#dbeafe', displayColor: '#3b82f6' },
  { value: '#dcfce7', label: 'Zelená', color: '#dcfce7', displayColor: '#22c55e' },
  { value: '#fef08a', label: 'Žlutá', color: '#fef08a', displayColor: '#eab308' },
  { value: '#fee2e2', label: 'Červená', color: '#fee2e2', displayColor: '#ef4444' },
  { value: '#f3e8ff', label: 'Fialová', color: '#f3e8ff', displayColor: '#a855f7' },
];

const VISUAL_BORDER_COLORS = [
  { value: 'transparent', label: 'Žádný', color: 'transparent', displayColor: '#ffffff' },
  { value: '#94a3b8', label: 'Šedý', color: '#94a3b8', displayColor: '#64748b' },
  { value: '#3b82f6', label: 'Modrý', color: '#3b82f6', displayColor: '#2563eb' },
  { value: '#22c55e', label: 'Zelený', color: '#22c55e', displayColor: '#16a34a' },
  { value: '#eab308', label: 'Žlutý', color: '#eab308', displayColor: '#ca8a04' },
  { value: '#ef4444', label: 'Červený', color: '#ef4444', displayColor: '#dc2626' },
  { value: '#a855f7', label: 'Fialový', color: '#a855f7', displayColor: '#9333ea' },
];

// Border radius presets (3 options to fit better)
const BORDER_RADIUS_OPTIONS = [
  { value: 0, label: '0' },
  { value: 8, label: '8' },
  { value: 16, label: '16' },
];

export function BlockSettingsOverlay({
  block,
  allBlocks,
  onClose,
  onUpdateBlock,
  onUpdateBlockWidth,
  onUpdateBlockMarginStyle,
  onUpdateBlockImage,
  onUpdateBlockVisualStyles,
  onDeleteBlock,
  onDuplicateBlock,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  forceOpenAI,
}: BlockSettingsOverlayProps) {
  const config = BLOCK_TYPE_CONFIG[block.type];
  const Icon = config.icon;
  
  // AI Assistant state
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);

  // Force open AI assistant if requested from parent
  useEffect(() => {
    if (forceOpenAI) {
      setIsAIOpen(true);
      // Optional: scroll to the AI section if needed
    }
  }, [forceOpenAI]);
  
  // Visual styles state
  const visualStyles = block.visualStyles || {};
  
  const updateVisualStyle = (key: string, value: any) => {
    onUpdateBlockVisualStyles?.(block.id, {
      ...visualStyles,
      [key]: value,
    });
  };

  const handleDelete = () => {
    onDeleteBlock(block.id);
    onClose();
  };

  const handleDuplicate = () => {
    onDuplicateBlock(block.id);
    onClose();
  };

  const handleMoveUp = () => {
    onMoveUp(block.id);
  };

  const handleMoveDown = () => {
    onMoveDown(block.id);
  };

  const handleAIEdit = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Napiš, co chceš udělat');
      return;
    }
    
    setIsAILoading(true);
    
    try {
      const result = await editBlockWithAI({
        block,
        prompt: aiPrompt,
        existingBlocks: allBlocks,
      });
      
      if (result.success && result.content) {
        onUpdateBlock(block.id, result.content);
        setAIPrompt('');
        setIsAIOpen(false);
        toast.success('Blok byl upraven pomocí AI');
      } else {
        toast.error(result.error || 'Nepodařilo se upravit blok');
      }
    } catch (error) {
      console.error('AI edit error:', error);
      toast.error('Chyba při volání AI');
    } finally {
      setIsAILoading(false);
    }
  };

  return (
    <div 
      data-settings-overlay
      data-print-hide="true"
      className="fixed top-0 left-0 bottom-0 bg-white z-[100] shadow-2xl flex flex-col border-r border-slate-200 overflow-hidden pages-settings print:hidden"
      style={{ width: '420px' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white sticky top-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Zpět</span>
        </button>
        
        <div className="flex-1" />
        
        <div className="flex items-center gap-2 text-slate-600">
          <Icon className="h-4 w-4" />
          <span className="text-sm font-medium">{config.label}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Pozice a rozměry - horizontal layout */}
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="flex gap-4">
            {/* Pořadí */}
            <div className="flex-shrink-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Pořadí</p>
              <div className="flex gap-1">
                <IconButton
                  onClick={handleMoveUp}
                  disabled={!canMoveUp}
                  title="Posunout nahoru"
                >
                  <ChevronUp className="h-5 w-5" />
                </IconButton>
                <IconButton
                  onClick={handleMoveDown}
                  disabled={!canMoveDown}
                  title="Posunout dolů"
                >
                  <ChevronDown className="h-5 w-5" />
                </IconButton>
              </div>
            </div>

            {/* Šířka */}
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Šířka bloku</p>
              <div className="flex gap-2">
                <button
                  onClick={() => onUpdateBlockWidth(block.id, 'full')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: block.width === 'full' ? '#334155' : 'white',
                    color: block.width === 'full' ? 'white' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: block.width === 'full' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  <RectangleHorizontal size={18} />
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>Celá</span>
                </button>
                <button
                  onClick={() => onUpdateBlockWidth(block.id, 'half')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: block.width === 'half' ? '#334155' : 'white',
                    color: block.width === 'half' ? 'white' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: block.width === 'half' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  <LayoutColumns size={18} />
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>Půlka</span>
                </button>
              </div>
            </div>
          </div>

          {/* Volný prostor pod blokem - jen když je marginBottom > 0 a NENÍ to spacer */}
          {(block.marginBottom ?? 0) > 0 && block.type !== 'spacer' && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Volný prostor</p>
              <div className="flex gap-2">
                {/* Prázdný - empty box */}
                <button
                  onClick={() => onUpdateBlockMarginStyle(block.id, 'empty')}
                  className={`flex-1 h-12 rounded-lg border-2 transition-all ${
                    (block.marginStyle || 'empty') === 'empty'
                      ? 'border-slate-700 bg-slate-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                  title="Prázdný"
                />
                
                {/* Tečkovaný - dotted pattern */}
                <button
                  onClick={() => onUpdateBlockMarginStyle(block.id, 'dotted')}
                  className={`flex-1 h-12 rounded-lg border-2 transition-all overflow-hidden ${
                    block.marginStyle === 'dotted'
                      ? 'border-slate-700'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  title="Tečkovaný"
                  style={{
                    backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)',
                    backgroundSize: '8px 8px',
                    backgroundColor: '#f8fafc',
                  }}
                />
                
                {/* Linkovaný - lined pattern */}
                <button
                  onClick={() => onUpdateBlockMarginStyle(block.id, 'lined')}
                  className={`flex-1 h-12 rounded-lg border-2 transition-all overflow-hidden ${
                    block.marginStyle === 'lined'
                      ? 'border-slate-700'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  title="Linkovaný"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 7px, #cbd5e1 7px, #cbd5e1 8px)',
                    backgroundColor: '#f8fafc',
                  }}
                />
              </div>
            </div>
          )}
          
          {/* Display Preset Section */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            {block.type === 'spacer' && (
              <div className="mb-6">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Styl volného prostoru</p>
                <div className="flex gap-2">
                  {/* Prázdný - empty box */}
                  <button
                    onClick={() => onUpdateBlock(block.id, { ...block.content, style: 'empty' })}
                    className={`flex-1 h-12 rounded-lg border-2 transition-all ${
                      (block.content as any).style === 'empty'
                        ? 'border-slate-700 bg-slate-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                    title="Prázdný"
                  />
                  
                  {/* Tečkovaný - dotted pattern */}
                  <button
                    onClick={() => onUpdateBlock(block.id, { ...block.content, style: 'dotted' })}
                    className={`flex-1 h-12 rounded-lg border-2 transition-all overflow-hidden ${
                      (block.content as any).style === 'dotted'
                        ? 'border-slate-700'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    title="Tečkovaný"
                    style={{
                      backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)',
                      backgroundSize: '8px 8px',
                      backgroundColor: '#f8fafc',
                    }}
                  />
                  
                  {/* Linkovaný - lined pattern */}
                  <button
                    onClick={() => onUpdateBlock(block.id, { ...block.content, style: 'lined' })}
                    className={`flex-1 h-12 rounded-lg border-2 transition-all overflow-hidden ${
                      (block.content as any).style === 'lined'
                        ? 'border-slate-700'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    title="Linkovaný"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 7px, #cbd5e1 7px, #cbd5e1 8px)',
                      backgroundColor: '#f8fafc',
                    }}
                  />
                </div>
              </div>
            )}
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Zobrazení</p>
            
            <div className="flex flex-wrap gap-2 mb-3">
              <ToggleButton
                isActive={!visualStyles.displayPreset || visualStyles.displayPreset === 'normal'}
                onClick={() => {
                  // Reset all visual styles for normal
                  onUpdateBlockVisualStyles?.(block.id, {
                    displayPreset: 'normal',
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    borderRadius: 0,
                    shadow: 'none',
                  });
                }}
              >
                Normální
                </ToggleButton>
                <ToggleButton
                isActive={visualStyles.displayPreset === 'infobox'}
                onClick={() => {
                  onUpdateBlockVisualStyles?.(block.id, {
                    displayPreset: 'infobox',
                    backgroundColor: '#dbeafe',
                    borderColor: '#3b82f6',
                    borderRadius: 12,
                    shadow: 'none',
                  });
                }}
              >
                Infobox
                </ToggleButton>
                <ToggleButton
                isActive={visualStyles.displayPreset === 'highlight'}
                onClick={() => {
                  onUpdateBlockVisualStyles?.(block.id, {
                    displayPreset: 'highlight',
                    backgroundColor: '#fef08a',
                    borderColor: 'transparent',
                    borderRadius: 8,
                    shadow: 'none',
                  });
                }}
              >
                Zvýraznění
              </ToggleButton>
              <ToggleButton
                isActive={visualStyles.displayPreset === 'custom'}
                onClick={() => {
                  onUpdateBlockVisualStyles?.(block.id, {
                    ...visualStyles,
                    displayPreset: 'custom',
                  });
                }}
              >
                Vlastní
                </ToggleButton>
            </div>
            
            {/* Custom Visual Styles - only show when "Vlastní" is selected */}
            {visualStyles.displayPreset === 'custom' && (
              <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                {/* Background Color */}
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-2">Podbarvení</p>
                  <div className="flex gap-3 flex-wrap items-center">
                    {VISUAL_BG_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => updateVisualStyle('backgroundColor', c.value)}
                        className={`shrink-0 transition-all hover:scale-110 ${
                          (visualStyles.backgroundColor || 'transparent') === c.value 
                            ? 'ring-2 ring-slate-500 ring-offset-2' 
                            : 'shadow hover:shadow-md'
                        }`}
                        style={{ 
                          width: 32,
                          height: 32,
                          minWidth: 32,
                          minHeight: 32,
                          borderRadius: '50%',
                          backgroundColor: c.displayColor,
                          border: '2px solid #e2e8f0',
                          backgroundImage: c.value === 'transparent' 
                            ? 'linear-gradient(135deg, #cbd5e1 25%, transparent 25%, transparent 50%, #cbd5e1 50%, #cbd5e1 75%, transparent 75%)' 
                            : undefined,
                          backgroundSize: c.value === 'transparent' ? '8px 8px' : undefined,
                        }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Border Color */}
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-2">Ohraničení</p>
                  <div className="flex gap-3 flex-wrap items-center">
                    {VISUAL_BORDER_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => updateVisualStyle('borderColor', c.value)}
                        className={`shrink-0 transition-all hover:scale-110 ${
                          (visualStyles.borderColor || 'transparent') === c.value 
                            ? 'ring-2 ring-slate-500 ring-offset-2' 
                            : 'shadow hover:shadow-md'
                        }`}
                        style={{ 
                          width: 32,
                          height: 32,
                          minWidth: 32,
                          minHeight: 32,
                          borderRadius: '50%',
                          backgroundColor: c.displayColor,
                          border: '2px solid #e2e8f0',
                          backgroundImage: c.value === 'transparent' 
                            ? 'linear-gradient(135deg, #cbd5e1 25%, transparent 25%, transparent 50%, #cbd5e1 50%, #cbd5e1 75%, transparent 75%)' 
                            : undefined,
                          backgroundSize: c.value === 'transparent' ? '8px 8px' : undefined,
                        }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
            
                {/* Shadow and Border Radius - same row */}
                <div className="flex gap-4 items-end">
                  {/* Shadow Toggle */}
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Stín</p>
                    <div className="flex">
                      <ToggleButton
                        isActive={!!(visualStyles.shadow && visualStyles.shadow !== 'none')}
                        onClick={() => {
                          const hasShadow = visualStyles.shadow && visualStyles.shadow !== 'none';
                          updateVisualStyle('shadow', hasShadow ? 'none' : 'medium');
                        }}
                      >
                        {visualStyles.shadow && visualStyles.shadow !== 'none' ? 'Ano' : 'Ne'}
                      </ToggleButton>
                    </div>
                  </div>
                  
                  {/* Border Radius */}
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 mb-2">Zaoblení</p>
                    <div className="flex gap-1">
                      {BORDER_RADIUS_OPTIONS.map((r) => (
                        <ToggleButton
                          key={r.value}
                          isActive={(visualStyles.borderRadius ?? 0) === r.value}
                          onClick={() => updateVisualStyle('borderRadius', r.value)}
                        >
                          {r.label}
                        </ToggleButton>
                      ))}
                    </div>
                  </div>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Block-specific settings */}
        {block.type === 'heading' && (
          <HeadingSettings
            block={block as HeadingBlock}
            onUpdate={(content) => onUpdateBlock(block.id, content)}
          />
        )}

        {block.type === 'paragraph' && (
          <ParagraphSettings
            block={block as ParagraphBlock}
            onUpdate={(content) => onUpdateBlock(block.id, content)}
          />
        )}

        {block.type === 'infobox' && (
          <InfoboxSettings
            block={block as InfoboxBlock}
            onUpdate={(content) => onUpdateBlock(block.id, content)}
          />
        )}

        {block.type === 'multiple-choice' && (
          <MultipleChoiceSettings
            block={block as MultipleChoiceBlock}
            onUpdate={(content) => onUpdateBlock(block.id, content)}
          />
        )}

        {block.type === 'fill-blank' && (
          <FillBlankSettings
            block={block as FillBlankBlock}
            onUpdate={(content) => onUpdateBlock(block.id, content)}
          />
        )}

        {block.type === 'connect-pairs' && (
          <ConnectPairsSettings
            block={block as ConnectPairsBlock}
            onUpdate={(content) => onUpdateBlock(block.id, content)}
          />
        )}

        {block.type === 'image-hotspots' && (
          <ImageHotspotsSettings
            block={block as ImageHotspotsBlock}
            onUpdate={(content) => onUpdateBlock(block.id, content)}
          />
        )}

        {block.type === 'video-quiz' && (
          <VideoQuizSettings
            block={block as VideoQuizBlock}
            onUpdate={(content) => onUpdateBlock(block.id, content)}
          />
        )}

        {block.type === 'free-answer' && (
          <FreeAnswerSettings
            block={block as FreeAnswerBlock}
            onUpdate={(content) => onUpdateBlock(block.id, content)}
          />
        )}

        {block.type === 'spacer' && (
          <SpacerSettings
            block={block as SpacerBlock}
            onUpdate={(content) => onUpdateBlock(block.id, content)}
          />
        )}

        {block.type === 'examples' && (
          <ExamplesSettings
            block={block as ExamplesBlock}
            onUpdate={(content) => onUpdateBlock(block.id, content)}
          />
        )}

        {block.type === 'image' && (
          <ImageSettings
            block={block as ImageBlock}
            onUpdate={(content) => onUpdateBlock(block.id, content)}
          />
        )}

        {block.type === 'header-footer' && (
          <HeaderFooterSettings
            block={block as HeaderFooterBlock}
            onUpdate={(content) => onUpdateBlock(block.id, content)}
          />
        )}

        {block.type === 'qr-code' && (
          <QRCodeSettings
            block={block as QRCodeBlock}
            onUpdate={(content) => onUpdateBlock(block.id, content)}
          />
        )}

        {/* Block Image - available for all blocks except image blocks, spacer, and header-footer */}
        {block.type !== 'image' && block.type !== 'spacer' && block.type !== 'header-footer' && block.type !== 'qr-code' && onUpdateBlockImage && (
          <BlockImageSettings
            image={block.image}
            onUpdate={(image) => onUpdateBlockImage(block.id, image)}
          />
        )}

      </div>

      {/* Footer Actions - Delete and AI Assistant */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-4">
        {isAIOpen && (
          <div className="p-4 rounded-2xl border-2 border-yellow-400 bg-white shadow-xl ring-4 ring-yellow-400/10 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-yellow-600" />
              <p className="text-xs text-yellow-900 font-bold uppercase tracking-wider">
                Instrukce pro AI
              </p>
            </div>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAIPrompt(e.target.value)}
              placeholder="např. 'Přepiš tento text jednodušeji', 'Přidej více příkladů'..."
              className="mb-3 bg-slate-50 border-slate-200 focus:border-yellow-500 focus:ring-yellow-500 min-h-[100px] text-sm"
            />
            <Button
              style={{
                backgroundColor: isAILoading || !aiPrompt.trim() ? '#fef08a' : '#facc15',
                color: '#713f12',
                border: 'none',
                fontWeight: 'bold',
                padding: '12px 24px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                cursor: isAILoading || !aiPrompt.trim() ? 'not-allowed' : 'pointer',
                opacity: isAILoading || !aiPrompt.trim() ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isAILoading && aiPrompt.trim()) {
                  e.currentTarget.style.backgroundColor = '#eab308';
                }
              }}
              onMouseLeave={(e) => {
                if (!isAILoading && aiPrompt.trim()) {
                  e.currentTarget.style.backgroundColor = '#facc15';
                }
              }}
              onClick={handleAIEdit}
              disabled={isAILoading || !aiPrompt.trim()}
            >
              {isAILoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isAILoading ? 'Generuji...' : 'Upravit blok'}
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          {/* AI Asistent - Large button */}
          <button
            onClick={() => setIsAIOpen(!isAIOpen)}
            style={{
              backgroundColor: isAIOpen ? '#eab308' : '#facc15',
              color: isAIOpen ? '#422006' : '#713f12',
              border: 'none',
              padding: '12px 16px',
              borderRadius: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              flex: 2, // Larger flex for AI button
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
            onMouseEnter={(e) => {
              if (!isAIOpen) e.currentTarget.style.backgroundColor = '#eab308';
            }}
            onMouseLeave={(e) => {
              if (!isAIOpen) e.currentTarget.style.backgroundColor = '#facc15';
            }}
          >
            <Sparkles className={`h-4 w-4 ${isAILoading ? 'animate-pulse' : ''}`} />
            <span>AI Asistent</span>
            <ChevronDown 
              className={`h-4 w-4 transition-transform duration-300 ${isAIOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Duplicate - Icon only */}
          <button
            onClick={handleDuplicate}
            title="Duplikovat blok"
            style={{
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: '1px solid #e2e8f0',
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e2e8f0';
              e.currentTarget.style.color = '#1e293b';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.color = '#475569';
            }}
          >
            <Copy className="h-5 w-5" />
          </button>

          {/* Delete - Icon only */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                title="Smazat blok"
                style={{
                  backgroundColor: '#f8fafc',
                  color: '#64748b',
                  border: '1px solid #e2e8f0',
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#fef2f2';
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.borderColor = '#fecaca';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Smazat blok?</AlertDialogTitle>
                <AlertDialogDescription>
                  Opravdu chcete smazat tento blok? Tuto akci nelze vrátit zpět.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
              >
                Smazat
              </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {title}
      </Label>
      {children}
    </div>
  );
}

// Toggle button with proper active state (using inline styles for reliability)
function ToggleButton({ 
  isActive, 
  onClick, 
  children,
  disabled = false,
  className = "",
}: { 
  isActive: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1 ${className}`}
      style={{
        backgroundColor: isActive ? '#334155' : '#f1f5f9',
        color: isActive ? '#ffffff' : '#475569',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

// Icon button for compact controls (order, width, etc.)
function IconButton({ 
  isActive = false,
  onClick, 
  children,
  disabled = false,
  title,
}: { 
  isActive?: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-2 rounded-lg transition-all flex items-center justify-center"
      style={{
        backgroundColor: isActive ? '#334155' : '#ffffff',
        color: isActive ? '#ffffff' : disabled ? '#cbd5e1' : '#475569',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: '1px solid #e2e8f0',
      }}
    >
      {children}
    </button>
  );
}

// ============================================
// BLOCK-SPECIFIC SETTINGS
// ============================================

// Heading level options
const HEADING_LEVEL_OPTIONS = [
  { value: 'h1', label: 'Nadpis 1', size: 32 },
  { value: 'h2', label: 'Nadpis 2', size: 24 },
  { value: 'h3', label: 'Nadpis 3', size: 18 },
];

// Alignment options for headings (without justify)
const HEADING_ALIGNMENT_OPTIONS = [
  { value: 'left', label: 'Vlevo', Icon: AlignLeft },
  { value: 'center', label: 'Na střed', Icon: AlignCenter },
  { value: 'right', label: 'Vpravo', Icon: AlignRight },
];

function HeadingSettings({ block, onUpdate }: { block: HeadingBlock; onUpdate: (content: any) => void }) {
  const currentAlign = (block.content as any).align || 'left';
  const currentLevel = block.content.level || 'h1';
  
  const [showLevelDropdown, setShowLevelDropdown] = useState(false);
  const [showAlignDropdown, setShowAlignDropdown] = useState(false);
  
  // Get current values
  const CurrentAlignIcon = HEADING_ALIGNMENT_OPTIONS.find(o => o.value === currentAlign)?.Icon || AlignLeft;
  const currentLevelOption = HEADING_LEVEL_OPTIONS.find(o => o.value === currentLevel) || HEADING_LEVEL_OPTIONS[0];
  
  return (
    <div className="flex gap-2 mb-3">
      {/* Heading Level */}
      <div className="flex-1">
        <p className="text-xs text-slate-500 mb-1.5">Velikost</p>
        <div className="relative">
          <button
            onClick={() => {
              setShowAlignDropdown(false);
              setShowLevelDropdown(!showLevelDropdown);
            }}
            className="flex items-center justify-between w-full px-2 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <span className="text-xs text-slate-700 truncate">{currentLevelOption.label}</span>
            <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
          </button>
          
          {showLevelDropdown && (
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setShowLevelDropdown(false)} />
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-[9999] min-w-[120px]">
                {HEADING_LEVEL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onUpdate({ ...block.content, level: opt.value });
                      setShowLevelDropdown(false);
                    }}
                    className={`flex items-center justify-between w-full px-3 py-2 hover:bg-slate-50 ${
                      currentLevel === opt.value ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700'
                    }`}
                  >
                    <span className="text-sm">{opt.label}</span>
                    <span className="text-xs text-slate-400">{opt.size}pt</span>
                  </button>
          ))}
        </div>
            </>
          )}
        </div>
      </div>
      
      {/* Alignment */}
      <div className="flex-1">
        <p className="text-xs text-slate-500 mb-1.5">Zarovnání</p>
        <div className="relative">
          <button
            onClick={() => {
              setShowLevelDropdown(false);
              setShowAlignDropdown(!showAlignDropdown);
            }}
            className="flex items-center justify-center gap-1 w-full px-2 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <CurrentAlignIcon className="w-4 h-4 text-slate-600" />
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          
          {showAlignDropdown && (
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setShowAlignDropdown(false)} />
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-[9999] min-w-[120px]">
                {HEADING_ALIGNMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onUpdate({ ...block.content, align: opt.value });
                      setShowAlignDropdown(false);
                    }}
                    className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 ${
                      currentAlign === opt.value ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700'
                    }`}
                  >
                    <opt.Icon className="w-4 h-4" />
                    <span className="text-sm">{opt.label}</span>
                  </button>
          ))}
        </div>
    </>
          )}
        </div>
      </div>
    </div>
  );
}

// Background color options for paragraph/infobox
const PARAGRAPH_COLORS = [
  { value: 'none', label: 'Žádné', color: 'transparent', border: '#e2e8f0' },
  { value: 'blue', label: 'Modrá', color: '#dbeafe', border: '#93c5fd' },
  { value: 'green', label: 'Zelená', color: '#dcfce7', border: '#86efac' },
  { value: 'yellow', label: 'Žlutá', color: '#fef9c3', border: '#fde047' },
  { value: 'red', label: 'Červená', color: '#fee2e2', border: '#fca5a5' },
  { value: 'purple', label: 'Fialová', color: '#f3e8ff', border: '#d8b4fe' },
  { value: 'gray', label: 'Šedá', color: '#f1f5f9', border: '#cbd5e1' },
];

// Font size options for dropdown - named styles
const TEXT_SIZE_OPTIONS = [
  { value: 'h1', label: 'Nadpis 1', numericSize: 32 },
  { value: 'h2', label: 'Nadpis 2', numericSize: 24 },
  { value: 'h3', label: 'Nadpis 3', numericSize: 18 },
  { value: 'text', label: 'Text', numericSize: 12 },
  { value: 'caption', label: 'Popisek', numericSize: 9 },
];

// Alignment options with icons
const ALIGNMENT_OPTIONS = [
  { value: 'left', label: 'Vlevo', Icon: AlignLeft },
  { value: 'center', label: 'Na střed', Icon: AlignCenter },
  { value: 'right', label: 'Vpravo', Icon: AlignRight },
  { value: 'justify', label: 'Do bloku', Icon: AlignJustify },
];

// List type options with icons
const LIST_TYPE_OPTIONS = [
  { value: 'none', label: 'Žádný', Icon: Type },
  { value: 'bullet', label: 'Odrážky', Icon: List },
  { value: 'numbered', label: 'Číslovaný', Icon: ListOrdered },
  { value: 'checklist', label: 'Checkboxy', Icon: ListChecks },
];

// Helper to convert numeric size to named style
function getTextStyleFromSize(size: number | string): string {
  if (typeof size === 'string' && ['h1', 'h2', 'h3', 'text', 'caption'].includes(size)) {
    return size;
  }
  const numSize = typeof size === 'number' ? size : 12;
  if (numSize >= 32) return 'h1';
  if (numSize >= 24) return 'h2';
  if (numSize >= 18) return 'h3';
  if (numSize >= 12) return 'text';
  return 'caption';
}

function ParagraphSettings({ block, onUpdate }: { block: ParagraphBlock; onUpdate: (content: any) => void }) {
  const content = block.content as any;
  const currentAlign = content.align || 'left';
  // Handle both legacy string and numeric font sizes
  const textStyle = getTextStyleFromSize(content.fontSize || content.textStyle || 'text');
  const listType = content.listType || 'none';
  
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [showAlignDropdown, setShowAlignDropdown] = useState(false);
  const [showListDropdown, setShowListDropdown] = useState(false);
  
  // Get current values
  const CurrentAlignIcon = ALIGNMENT_OPTIONS.find(o => o.value === currentAlign)?.Icon || AlignLeft;
  const CurrentListIcon = LIST_TYPE_OPTIONS.find(o => o.value === listType)?.Icon || Type;
  const currentSizeOption = TEXT_SIZE_OPTIONS.find(o => o.value === textStyle) || TEXT_SIZE_OPTIONS[3];
  
  return (
    <div className="flex gap-2 mb-3">
      {/* Text Size */}
      <div className="flex-1">
        <p className="text-xs text-slate-500 mb-1.5">Velikost</p>
        <div className="relative">
          <button
            onClick={() => {
              setShowAlignDropdown(false);
              setShowListDropdown(false);
              setShowSizeDropdown(!showSizeDropdown);
            }}
            className="flex items-center justify-between w-full px-2 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <span className="text-xs text-slate-700 truncate">{currentSizeOption.label}</span>
            <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
          </button>
          
          {showSizeDropdown && (
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setShowSizeDropdown(false)} />
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-[9999] min-w-[120px]">
                {TEXT_SIZE_OPTIONS.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => {
                      onUpdate({ ...content, fontSize: opt.numericSize, textStyle: opt.value });
                      setShowSizeDropdown(false);
                    }}
                    className={`flex items-center justify-between w-full px-3 py-2 hover:bg-slate-50 ${
                      textStyle === opt.value ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700'
                    }`}
                  >
                    <span className="text-sm">{opt.label}</span>
                    <span className="text-xs text-slate-400">{opt.numericSize}pt</span>
                  </button>
              ))}
            </div>
        </>
      )}
        </div>
      </div>

      {/* Alignment */}
      <div className="flex-1">
        <p className="text-xs text-slate-500 mb-1.5">Zarovnání</p>
        <div className="relative">
          <button
            onClick={() => {
              setShowSizeDropdown(false);
              setShowListDropdown(false);
              setShowAlignDropdown(!showAlignDropdown);
            }}
            className="flex items-center justify-center gap-1 w-full px-2 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <CurrentAlignIcon className="w-4 h-4 text-slate-600" />
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          
          {showAlignDropdown && (
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setShowAlignDropdown(false)} />
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-[9999] min-w-[120px]">
                {ALIGNMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onUpdate({ ...content, align: opt.value });
                      setShowAlignDropdown(false);
                    }}
                    className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 ${
                      currentAlign === opt.value ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700'
                    }`}
                  >
                    <opt.Icon className="w-4 h-4" />
                    <span className="text-sm">{opt.label}</span>
                  </button>
          ))}
        </div>
            </>
          )}
        </div>
      </div>
      
      {/* List Format */}
      <div className="flex-1">
        <p className="text-xs text-slate-500 mb-1.5">Seznam</p>
        <div className="relative">
          <button
            onClick={() => {
              setShowSizeDropdown(false);
              setShowAlignDropdown(false);
              setShowListDropdown(!showListDropdown);
            }}
            className="flex items-center justify-center gap-1 w-full px-2 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <CurrentListIcon className="w-4 h-4 text-slate-600" />
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          
          {showListDropdown && (
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setShowListDropdown(false)} />
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-[9999] min-w-[120px]">
                {LIST_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onUpdate({ ...content, listType: opt.value });
                      setShowListDropdown(false);
                    }}
                    className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 ${
                      listType === opt.value ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700'
                    }`}
                  >
                    <opt.Icon className="w-4 h-4" />
                    <span className="text-sm">{opt.label}</span>
                  </button>
                ))}
        </div>
    </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoboxSettings({ block, onUpdate }: { block: InfoboxBlock; onUpdate: (content: any) => void }) {
  return (
    <>
      <SettingSection title="Barva">
        <div className="flex gap-2">
          {INFOBOX_VARIANTS.map((variant) => (
            <button
              key={variant.value}
              onClick={() => onUpdate({ ...block.content, variant: variant.value })}
              className={`
                w-10 h-10 rounded-lg ${variant.bgClass} transition-all
                ${block.content.variant === variant.value 
                  ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' 
                  : 'opacity-70 hover:opacity-100'
                }
              `}
              title={variant.label}
            />
          ))}
        </div>
      </SettingSection>

      <SettingSection title="Styl">
        <div className="flex gap-2">
          <ToggleButton
            isActive={(block.content as any).style === 'bordered' || !(block.content as any).style}
            onClick={() => onUpdate({ ...block.content, style: 'bordered' })}
          >
            S okrajem
          </ToggleButton>
          <ToggleButton
            isActive={(block.content as any).style === 'filled'}
            onClick={() => onUpdate({ ...block.content, style: 'filled' })}
          >
            Vyplněný
          </ToggleButton>
        </div>
      </SettingSection>
    </>
  );
}

function MultipleChoiceSettings({ block, onUpdate }: { block: MultipleChoiceBlock; onUpdate: (content: any) => void }) {
  const content = block.content;
  const variant = content.variant || 'text';
  const gridColumns = content.gridColumns || 4;

  return (
    <>
      <SettingSection title="Varianta odpovědí">
        <div className="flex gap-2">
          <ToggleButton
            isActive={variant === 'text'}
            onClick={() => onUpdate({ ...content, variant: 'text' })}
          >
            <Type className="h-4 w-4 mr-2" />
            Textové
          </ToggleButton>
          <ToggleButton
            isActive={variant === 'image'}
            onClick={() => onUpdate({ ...content, variant: 'image' })}
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            Obrázkové
          </ToggleButton>
        </div>
      </SettingSection>

      {variant === 'image' && (
        <SettingSection title="Rozložení mřížky">
          <div className="space-y-2">
            <Label className="text-xs text-slate-500 font-bold uppercase tracking-wider">Počet sloupců</Label>
            <div className="flex gap-2">
              {[2, 3, 4, 5].map(cols => (
                <ToggleButton
                  key={cols}
                  isActive={gridColumns === cols}
                  onClick={() => onUpdate({ ...content, gridColumns: cols })}
                >
                  {cols}
                </ToggleButton>
              ))}
            </div>
          </div>
        </SettingSection>
      )}

      <SettingSection title="Možnosti a správné odpovědi">
        <div className="space-y-3">
          {content.options.map((option, index) => (
            variant === 'image' ? (
              /* Image variant - Card layout */
              <div key={option.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={content.correctAnswers.includes(option.id)}
                    onChange={(e) => {
                      const newCorrect = e.target.checked
                        ? [...content.correctAnswers, option.id]
                        : content.correctAnswers.filter(id => id !== option.id);
                      onUpdate({ ...content, correctAnswers: newCorrect });
                    }}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex-1">
                    Možnost {String.fromCharCode(65 + index)}
                  </span>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">URL obrázku</Label>
                  <Input
                    value={option.imageUrl || ''}
                    onChange={(e) => {
                      const newOptions = [...content.options];
                      newOptions[index] = { ...option, imageUrl: e.target.value };
                      onUpdate({ ...content, options: newOptions });
                    }}
                    placeholder="Vložte URL obrázku..."
                    className="bg-white text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Popisek (volitelný)</Label>
                  <Input
                    value={option.text}
                    onChange={(e) => {
                      const newOptions = [...content.options];
                      newOptions[index] = { ...option, text: e.target.value };
                      onUpdate({ ...content, options: newOptions });
                    }}
                    placeholder="Text možnosti..."
                    className="bg-white text-sm"
                  />
                </div>
              </div>
            ) : (
              /* Text variant - Compact layout as before */
              <div key={option.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                <input
                  type="checkbox"
                  checked={content.correctAnswers.includes(option.id)}
                  onChange={(e) => {
                    const newCorrect = e.target.checked
                      ? [...content.correctAnswers, option.id]
                      : content.correctAnswers.filter(id => id !== option.id);
                    onUpdate({ ...content, correctAnswers: newCorrect });
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-400 w-6">
                  {String.fromCharCode(65 + index)}
                </span>
                <input 
                  type="text"
                  value={option.text}
                  onChange={(e) => {
                    const newOptions = [...content.options];
                    newOptions[index] = { ...option, text: e.target.value };
                    onUpdate({ ...content, options: newOptions });
                  }}
                  className="flex-1 bg-transparent border-none text-sm text-slate-700 outline-none p-0 focus:ring-0"
                  placeholder={`Možnost ${String.fromCharCode(65 + index)}...`}
                />
              </div>
            )
          ))}
        </div>
      </SettingSection>
    </>
  );
}

function FillBlankSettings({ block, onUpdate }: { block: FillBlankBlock; onUpdate: (content: any) => void }) {
  return (
    <>
      <SettingSection title="Barva mezer">
        <div className="flex gap-2">
          {[
            { value: 'yellow', bgClass: 'bg-yellow-200' },
            { value: 'green', bgClass: 'bg-green-200' },
            { value: 'pink', bgClass: 'bg-pink-200' },
            { value: 'blue', bgClass: 'bg-blue-200' },
          ].map((color) => (
            <button
              key={color.value}
              onClick={() => onUpdate({ ...block.content, blankColor: color.value })}
              className={`
                w-10 h-10 rounded-lg ${color.bgClass} transition-all
                ${(block.content as any).blankColor === color.value 
                  ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' 
                  : 'opacity-70 hover:opacity-100'
                }
              `}
            />
          ))}
        </div>
      </SettingSection>

      <SettingSection title="Velikost mezery">
        <Select
          value={(block.content as any).blankSize || 'medium'}
          onValueChange={(value) => onUpdate({ ...block.content, blankSize: value })}
        >
          <SelectTrigger className="bg-slate-50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Malá</SelectItem>
            <SelectItem value="medium">Střední</SelectItem>
            <SelectItem value="large">Velká</SelectItem>
          </SelectContent>
        </Select>
      </SettingSection>
    </>
  );
}

function ImageHotspotsSettings({ block, onUpdate }: { block: ImageHotspotsBlock; onUpdate: (content: ImageHotspotsContent) => void }) {
  const content = block.content;
  
  const updateHotspot = (id: string, updates: Partial<any>) => {
    onUpdate({
      ...content,
      hotspots: content.hotspots.map((h) => (h.id === id ? { ...h, ...updates } : h)),
    });
  };

  const removeHotspot = (id: string) => {
    onUpdate({
      ...content,
      hotspots: content.hotspots.filter((h) => h.id !== id),
    });
  };

  const isABC = content.answerType === 'abc';

  return (
    <>
      <SettingSection title="Instrukce">
        <Input
          value={content.instruction || ''}
          onChange={(e) => onUpdate({ ...content, instruction: e.target.value })}
          placeholder="Označ správná místa na obrázku..."
          className="bg-slate-50"
        />
      </SettingSection>

      <SettingSection title="Obrázek">
        <div className="space-y-2">
          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">URL obrázku</Label>
          <Input
            value={content.imageUrl || ''}
            onChange={(e) => onUpdate({ ...content, imageUrl: e.target.value })}
            placeholder="https://..."
            className="bg-slate-50"
          />
          <p className="text-[10px] text-slate-400 italic">
            Body se umisťují kliknutím přímo na obrázek v náhledu vpravo.
          </p>
        </div>
      </SettingSection>

      <SettingSection title="Vzhled markerů">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Styl</Label>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
              {(['circle', 'pin'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => onUpdate({ ...content, markerStyle: s })}
                  className={`flex-1 flex justify-center py-1.5 rounded-md transition-all ${content.markerStyle === s ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500'}`}
                >
                  {s === 'circle' && <Circle size={14} />}
                  {s === 'pin' && <MapPin size={14} />}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Velikost</Label>
            <Slider
              value={[content.markerSize || 100]}
              min={50}
              max={200}
              step={10}
              onValueChange={([val]) => onUpdate({ ...content, markerSize: val })}
            />
          </div>
        </div>
      </SettingSection>

      <SettingSection title="Typ značení">
        <div className="flex gap-2">
          {[
            { value: 'abc', label: 'Písmena (A, B, C)' },
            { value: 'numeric', label: 'Čísla (1, 2, 3)' },
          ].map((t) => (
            <ToggleButton
              key={t.value}
              isActive={(content.answerType || 'abc') === t.value}
              onClick={() => onUpdate({ ...content, answerType: t.value as any })}
            >
              {t.label}
            </ToggleButton>
          ))}
        </div>
      </SettingSection>

      <SettingSection title="Rozložení">
        <div className="flex gap-2">
          {[
            { value: 'stacked', label: 'Pod sebou' },
            { value: 'side-by-side', label: 'Vedle sebe' },
          ].map((l) => (
            <ToggleButton
              key={l.value}
              isActive={(content.layout || 'stacked') === l.value}
              onClick={() => onUpdate({ ...content, layout: l.value as any })}
            >
              {l.label}
            </ToggleButton>
          ))}
        </div>
      </SettingSection>

      <SettingSection title="Seznam bodů">
        <div className="space-y-2">
          {content.hotspots.map((hotspot, index) => (
            <div key={hotspot.id} className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm space-y-3 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-purple-100 text-purple-700 rounded-lg flex items-center justify-center text-xs font-black border border-purple-200/50">
                    {isABC ? String.fromCharCode(65 + index) : index + 1}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bod {index + 1}</span>
                </div>
                <button
                  onClick={() => removeHotspot(hotspot.id)}
                  className="w-7 h-7 flex items-center justify-center bg-slate-50 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-[9px] font-bold text-slate-400 uppercase">Správná odpověď</Label>
                <Input
                  value={hotspot.label}
                  onChange={(e) => updateHotspot(hotspot.id, { label: e.target.value })}
                  placeholder="Co má žák doplnit..."
                  className="h-9 text-xs bg-slate-50 border-transparent focus:bg-white focus:border-purple-300 transition-all"
                />
              </div>
            </div>
          ))}
          {content.hotspots.length === 0 && (
            <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-2xl">
              <p className="text-xs text-slate-400 italic">
                Klikněte do obrázku vpravo pro přidání prvního bodu.
              </p>
            </div>
          )}
        </div>
      </SettingSection>
    </>
  );
}

function VideoQuizSettings({ block, onUpdate }: { block: VideoQuizBlock; onUpdate: (content: VideoQuizContent) => void }) {
  const content = block.content;

  const updateQuestion = (id: string, updates: Partial<any>) => {
    onUpdate({
      ...content,
      questions: content.questions.map((q) => (q.id === id ? { ...q, ...updates } : q)),
    });
  };

  const removeQuestion = (id: string) => {
    onUpdate({
      ...content,
      questions: content.questions.filter((q) => q.id !== id),
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <>
      <SettingSection title="Instrukce">
        <Input
          value={content.instruction || ''}
          onChange={(e) => onUpdate({ ...content, instruction: e.target.value })}
          placeholder="Video kvíz..."
          className="bg-slate-50"
        />
      </SettingSection>

      <SettingSection title="YouTube Video">
        <div className="space-y-2">
          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">URL videa</Label>
          <Input
            value={content.videoUrl || ''}
            onChange={(e) => {
              const url = e.target.value;
              const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
              onUpdate({ ...content, videoUrl: url, videoId: match ? match[1] : undefined });
            }}
            placeholder="https://www.youtube.com/watch?v=..."
            className="bg-slate-50 text-sm"
          />
        </div>
      </SettingSection>

      <SettingSection title="Otázky k videu">
        <div className="space-y-4">
          {content.questions.map((q, index) => (
            <div key={q.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 group">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono bg-slate-200 px-2 py-0.5 rounded-md">
                  {formatTime(q.timestamp)}
                </span>
                <button
                  onClick={() => removeQuestion(q.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Otázka</Label>
                <Input
                  value={q.question}
                  onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                  placeholder="Zadejte otázku..."
                  className="bg-white text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Možnosti</Label>
                <div className="space-y-2">
                  {q.options.map((opt, optIdx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={opt.isCorrect}
                        onChange={(e) => {
                          const newOptions = [...q.options];
                          newOptions[optIdx] = { ...opt, isCorrect: e.target.checked };
                          updateQuestion(q.id, { options: newOptions });
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-400 w-4">
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <input
                        type="text"
                        value={opt.content}
                        onChange={(e) => {
                          const newOptions = [...q.options];
                          newOptions[optIdx] = { ...opt, content: e.target.value };
                          updateQuestion(q.id, { options: newOptions });
                        }}
                        className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-sm outline-none"
                        placeholder={`Možnost ${String.fromCharCode(65 + optIdx)}...`}
                      />
                    </div>
                  ))}
                  {q.options.length < 4 && (
                    <button
                      onClick={() => {
                        const newOptions = [...q.options];
                        newOptions.push({
                          id: `opt-${Date.now()}`,
                          label: String.fromCharCode(65 + q.options.length),
                          content: '',
                          isCorrect: false,
                        });
                        updateQuestion(q.id, { options: newOptions });
                      }}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                    >
                      <Plus size={12} /> Přidat možnost
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {content.questions.length === 0 && (
            <p className="text-center py-4 text-xs text-slate-400 italic">
              V tomto videu nejsou zatím žádné otázky.
            </p>
          )}
        </div>
      </SettingSection>
    </>
  );
}

function ConnectPairsSettings({ block, onUpdate }: { block: ConnectPairsBlock; onUpdate: (content: ConnectPairsContent) => void }) {
  const content = block.content;
  
  const addPair = () => {
    const newId = Date.now().toString();
    onUpdate({
      ...content,
      pairs: [
        ...content.pairs,
        {
          id: `pair-${newId}`,
          left: { id: `left-${newId}`, type: 'text', content: '' },
          right: { id: `right-${newId}`, type: 'text', content: '' },
        },
      ],
    });
  };

  const removePair = (pairId: string) => {
    if (content.pairs.length <= 2) return;
    onUpdate({
      ...content,
      pairs: content.pairs.filter((p) => p.id !== pairId),
    });
  };

  const updatePair = (pairId: string, side: 'left' | 'right', value: string) => {
    onUpdate({
      ...content,
      pairs: content.pairs.map((p) =>
        p.id === pairId ? { ...p, [side]: { ...p[side], content: value } } : p
      ),
    });
  };

  const updatePairType = (pairId: string, side: 'left' | 'right', type: 'text' | 'image') => {
    onUpdate({
      ...content,
      pairs: content.pairs.map((p) =>
        p.id === pairId ? { ...p, [side]: { ...p[side], type, content: '' } } : p
      ),
    });
  };

  return (
    <>
      <SettingSection title="Instrukce">
        <Input
          value={content.instruction || ''}
          onChange={(e) => onUpdate({ ...content, instruction: e.target.value })}
          placeholder="Spoj správné dvojice..."
          className="bg-slate-50"
        />
      </SettingSection>

      <SettingSection title="Nastavení">
        <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-slate-200 shadow-sm">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-700">Zamíchat strany</span>
            <span className="text-[10px] text-slate-400 italic">Položky vpravo budou v náhodném pořadí</span>
          </div>
          <Switch
            checked={content.shuffleSides}
            onCheckedChange={(checked) => onUpdate({ ...content, shuffleSides: checked })}
          />
        </div>
      </SettingSection>

      <SettingSection title="Dvojice k propojení">
        <div className="space-y-3">
          {content.pairs.map((pair, index) => (
            <div key={pair.id} className="relative bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                    {index + 1}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    DVOJICE
                  </span>
                </div>
                {content.pairs.length > 2 && (
                  <button
                    onClick={() => removePair(pair.id)}
                    className="w-7 h-7 flex items-center justify-center bg-slate-50 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Left side */}
                <div className="space-y-3">
                  <div className="flex justify-center p-1 bg-slate-100 rounded-xl">
                    <button
                      onClick={() => updatePairType(pair.id, 'left', 'text')}
                      className={`flex-1 flex justify-center py-2 rounded-lg transition-all ${pair.left.type === 'text' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <Type size={18} />
                    </button>
                    <button
                      onClick={() => updatePairType(pair.id, 'left', 'image')}
                      className={`flex-1 flex justify-center py-2 rounded-lg transition-all ${pair.left.type === 'image' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <ImageIcon size={18} />
                    </button>
                  </div>
                  <Input
                    value={pair.left.content}
                    onChange={(e) => updatePair(pair.id, 'left', e.target.value)}
                    placeholder={pair.left.type === 'text' ? "Text vlevo..." : "URL obrázku..."}
                    className="text-xs h-9 bg-slate-50 border-transparent focus:bg-white focus:border-blue-300 transition-all"
                  />
                </div>

                {/* Right side */}
                <div className="space-y-3 relative border-l border-slate-100 pl-4">
                  <div className="flex justify-center p-1 bg-slate-100 rounded-xl">
                    <button
                      onClick={() => updatePairType(pair.id, 'right', 'text')}
                      className={`flex-1 flex justify-center py-2 rounded-lg transition-all ${pair.right.type === 'text' ? 'bg-white shadow-md text-purple-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <Type size={18} />
                    </button>
                    <button
                      onClick={() => updatePairType(pair.id, 'right', 'image')}
                      className={`flex-1 flex justify-center py-2 rounded-lg transition-all ${pair.right.type === 'image' ? 'bg-white shadow-md text-purple-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <ImageIcon size={18} />
                    </button>
                  </div>
                  <Input
                    value={pair.right.content}
                    onChange={(e) => updatePair(pair.id, 'right', e.target.value)}
                    placeholder={pair.right.type === 'text' ? "Text vpravo..." : "URL obrázku..."}
                    className="text-xs h-9 bg-slate-50 border-transparent focus:bg-white focus:border-purple-300 transition-all"
                  />
                </div>
              </div>
            </div>
          ))}

          <Button
            onClick={addPair}
            variant="outline"
            className="w-full border-dashed border-2 hover:bg-slate-50 text-slate-500 h-12 rounded-2xl transition-all"
          >
            <Plus size={18} className="mr-2" />
            <span className="font-bold uppercase text-[10px] tracking-widest">Přidat novou dvojici</span>
          </Button>
        </div>
      </SettingSection>
    </>
  );
}

function FreeAnswerSettings({ block, onUpdate }: { block: FreeAnswerBlock; onUpdate: (content: any) => void }) {
  return (
    <>
      <SettingSection title="Počet řádků">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onUpdate({ ...block.content, lines: Math.max(1, block.content.lines - 1) })}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-12 text-center text-lg font-semibold">{block.content.lines}</span>
          <button
            onClick={() => onUpdate({ ...block.content, lines: Math.min(10, block.content.lines + 1) })}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </SettingSection>

      <SettingSection title="Styl řádků">
        <div className="flex gap-2">
          {[
            { value: 'dotted', label: 'Tečkovaný' },
            { value: 'lined', label: 'Linkovaný' },
            { value: 'blank', label: 'Prázdný' },
          ].map((style) => (
            <ToggleButton
              key={style.value}
              isActive={(block.content as any).lineStyle === style.value || (!(block.content as any).lineStyle && style.value === 'lined')}
              onClick={() => onUpdate({ ...block.content, lineStyle: style.value })}
            >
              {style.label}
            </ToggleButton>
          ))}
        </div>
      </SettingSection>

      <SettingSection title="Nápověda">
        <Input
          value={block.content.hint || ''}
          onChange={(e) => onUpdate({ ...block.content, hint: e.target.value })}
          placeholder="Volitelná nápověda pro žáky..."
          className="bg-slate-50"
        />
      </SettingSection>
    </>
  );
}

function SpacerSettings({ block, onUpdate }: { block: SpacerBlock; onUpdate: (content: any) => void }) {
  return (
    <SettingSection title="Výška (px)">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onUpdate({ ...block.content, height: Math.max(20, block.content.height - 20) })}
          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-16 text-center text-lg font-semibold">{block.content.height}</span>
        <button
          onClick={() => onUpdate({ ...block.content, height: Math.min(1000, block.content.height + 20) })}
          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-slate-500 mt-2">
        Nebo táhněte za spodní hranu v náhledu
      </p>
    </SettingSection>
  );
}

function ExamplesSettings({ block, onUpdate }: { block: ExamplesBlock; onUpdate: (content: any) => void }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [sampleInput, setSampleInput] = useState(block.content.sampleExample || '');
  const content = block.content;
  const examplesCount = content.examplesCount || 15;

  const handleGenerate = async () => {
    if (!sampleInput.trim()) return;
    
    setIsGenerating(true);
    try {
      const result = await generateExamplesFromSample(sampleInput, {
        count: examplesCount,
        difficultyProgression: content.difficultyProgression,
      });
      
      onUpdate({
        ...content,
        sampleExample: sampleInput,
        topic: result.topic,
        examples: result.examples,
      });
    } catch (error) {
      console.error('Failed to generate examples:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Shuffle examples when difficultyProgression is toggled off
  const handleDifficultyProgressionChange = (checked: boolean) => {
    if (!checked && content.examples.length > 0) {
      // Shuffle examples randomly
      const shuffled = [...content.examples].sort(() => Math.random() - 0.5);
      onUpdate({ ...content, difficultyProgression: checked, examples: shuffled });
    } else if (checked && content.examples.length > 0) {
      // Sort by difficulty: easy -> medium -> hard
      const sorted = [...content.examples].sort((a, b) => {
        const order = { easy: 0, medium: 1, hard: 2 };
        return order[a.difficulty] - order[b.difficulty];
      });
      onUpdate({ ...content, difficultyProgression: checked, examples: sorted });
    } else {
      onUpdate({ ...content, difficultyProgression: checked });
    }
  };

  return (
    <>
      {/* Vzorový příklad */}
      <SettingSection title="Vzorový příklad">
        <textarea
          value={sampleInput}
          onChange={(e) => setSampleInput(e.target.value)}
          placeholder="Zadejte vzorový příklad, např.:&#10;0,4 + 0,5 =&#10;$\frac{1}{2} + \frac{1}{4} =$"
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />
      </SettingSection>

      {/* Počet příkladů */}
      <SettingSection title="Počet příkladů">
        <div className="flex gap-2">
          {[6, 9, 12, 15, 18, 21].map((count) => (
            <ToggleButton
              key={count}
              isActive={examplesCount === count}
              onClick={() => onUpdate({ ...content, examplesCount: count })}
            >
              {count}
            </ToggleButton>
          ))}
        </div>
      </SettingSection>

      {/* Tlačítko Generovat - zvýrazněné */}
      <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !sampleInput.trim()}
          className="w-full py-3 px-4 rounded-xl text-base font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          style={{
            backgroundColor: isGenerating ? '#059669' : '#059669',
            color: 'white',
          }}
        >
          {isGenerating ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generuji příklady...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Vygenerovat {examplesCount} příkladů
            </>
          )}
        </button>
        {content.topic && (
          <p className="text-xs text-emerald-600 font-medium mt-2 text-center">
            AI rozpoznalo: {content.topic}
          </p>
        )}
      </div>

      {/* Počet sloupců */}
      <SettingSection title="Počet sloupců">
        <div className="flex gap-2">
          {([1, 2, 3] as const).map((cols) => (
            <ToggleButton
              key={cols}
              isActive={content.columns === cols}
              onClick={() => onUpdate({ ...content, columns: cols })}
            >
              {cols}
            </ToggleButton>
          ))}
        </div>
      </SettingSection>

      {/* Označení */}
      <SettingSection title="Označení příkladů">
        <div className="flex gap-2">
          {[
            { value: 'none' as ExamplesLabelType, label: 'Bez označení' },
            { value: 'letters' as ExamplesLabelType, label: 'Písmena (A, B, C)' },
            { value: 'numbers' as ExamplesLabelType, label: 'Čísla (1, 2, 3)' },
          ].map((opt) => (
            <ToggleButton
              key={opt.value}
              isActive={content.labelType === opt.value}
              onClick={() => onUpdate({ ...content, labelType: opt.value })}
            >
              {opt.label}
            </ToggleButton>
          ))}
        </div>
      </SettingSection>

      {/* Obtížnost - vedle sebe */}
      <SettingSection title="Obtížnost">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-slate-200">
            <span className="text-xs text-slate-700 leading-tight">Od jednoduchého<br/>ke složitějšímu</span>
            <Switch
              checked={content.difficultyProgression}
              onCheckedChange={handleDifficultyProgressionChange}
            />
          </div>
          <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-700">Barvy</span>
              <div className="flex gap-0.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              </div>
            </div>
            <Switch
              checked={content.showDifficultyColors}
              onCheckedChange={(checked) => onUpdate({ ...content, showDifficultyColors: checked })}
            />
          </div>
        </div>
      </SettingSection>

      {/* Pole pro odpovědi */}
      <SettingSection title="Pole pro odpovědi">
        <div className="flex gap-2">
          {[
            { value: 'block' as AnswerBoxStyle, label: 'Blok' },
            { value: 'line' as AnswerBoxStyle, label: 'Linka' },
            { value: 'none' as AnswerBoxStyle, label: 'Žádné' },
          ].map((opt) => (
            <ToggleButton
              key={opt.value}
              isActive={(content.answerBoxStyle || 'block') === opt.value}
              onClick={() => onUpdate({ ...content, answerBoxStyle: opt.value })}
            >
              {opt.label}
            </ToggleButton>
          ))}
        </div>
      </SettingSection>

      {/* Rozestupy a Velikost písma - vedle sebe se slidery */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Rozestupy
          </label>
          <div className="space-y-2">
            <div className="relative pt-1">
              <input
                type="range"
                min="8"
                max="48"
                step="4"
                value={content.rowSpacing || 16}
                onChange={(e) => onUpdate({ ...content, rowSpacing: parseInt(e.target.value) })}
                className="w-full h-2 rounded-lg cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((content.rowSpacing || 16) - 8) / 40 * 100}%, #e2e8f0 ${((content.rowSpacing || 16) - 8) / 40 * 100}%, #e2e8f0 100%)`,
                }}
              />
            </div>
            <div className="text-center text-sm font-semibold text-slate-700">
              {content.rowSpacing || 16} px
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Písmo
          </label>
          <div className="space-y-2">
            <div className="relative pt-1">
              <input
                type="range"
                min="10"
                max="24"
                step="2"
                value={content.fontSize || 14}
                onChange={(e) => onUpdate({ ...content, fontSize: parseInt(e.target.value) })}
                className="w-full h-2 rounded-lg cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((content.fontSize || 14) - 10) / 14 * 100}%, #e2e8f0 ${((content.fontSize || 14) - 10) / 14 * 100}%, #e2e8f0 100%)`,
                }}
              />
            </div>
            <div className="text-center text-sm font-semibold text-slate-700">
              {content.fontSize || 14} px
            </div>
          </div>
        </div>
      </div>

      {/* Info o příkladech */}
      {content.examples.length > 0 && (
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
          <p className="text-sm text-emerald-700 font-medium">
            {content.examples.length} příkladů vygenerováno
          </p>
          <p className="text-xs text-emerald-600 mt-1">
            {content.examples.filter(e => e.difficulty === 'easy').length} snadných, 
            {' '}{content.examples.filter(e => e.difficulty === 'medium').length} středních, 
            {' '}{content.examples.filter(e => e.difficulty === 'hard').length} těžkých
          </p>
        </div>
      )}
    </>
  );
}

function ImageSettings({ block, onUpdate }: { block: ImageBlock; onUpdate: (content: any) => void }) {
  const content = block.content;
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  const gallery = content.gallery || (content.url ? [content.url] : []);
  const galleryLayout = content.galleryLayout || 'grid';
  const gridColumns = content.gridColumns || 2;
  const size = content.size ?? 100;

  const handleUpdateGallery = (newGallery: string[], newCaptions?: string[]) => {
    onUpdate({
      ...content,
      url: newGallery[0] || '',
      gallery: newGallery,
      galleryCaptions: newCaptions || content.galleryCaptions || [],
    });
  };

  const handleAddImage = () => {
    const newGallery = [...gallery, ''];
    const newCaptions = [...(content.galleryCaptions || []), ''];
    handleUpdateGallery(newGallery, newCaptions);
    setEditingIndex(newGallery.length - 1);
    setShowUrlInput(true);
  };

  const handleRemoveImage = (index: number) => {
    const newGallery = gallery.filter((_, i) => i !== index);
    handleUpdateGallery(newGallery);
    if (editingIndex === index) {
      setEditingIndex(null);
      setShowUrlInput(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Gallery / Thumbnails */}
      <SettingSection title="Obrázky">
        <div className="flex flex-wrap gap-2 mb-4">
          {gallery.map((url, idx) => (
            <div 
              key={idx}
              className={`
                relative w-16 h-16 rounded-lg border-2 transition-all cursor-pointer overflow-hidden bg-white
                ${editingIndex === idx ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300'}
              `}
              onClick={() => {
                setEditingIndex(idx);
                setShowUrlInput(true);
              }}
            >
              {url ? (
                <img src={url} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-50">
                  <ImageIcon className="w-6 h-6 text-slate-300" />
                </div>
              )}
              {editingIndex === idx && (
                <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                  <div className="bg-blue-500 text-white rounded-full p-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                </div>
              )}
            </div>
          ))}
          <button
            onClick={handleAddImage}
            className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex flex-col items-center justify-center gap-1 transition-all"
          >
            <Plus className="w-5 h-5 text-slate-400" />
            <span className="text-[10px] font-medium text-slate-400 uppercase">Přidat</span>
          </button>
        </div>

        {editingIndex !== null && (
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                Nastavení obrázku {editingIndex + 1}
              </p>
              <button
                onClick={() => handleRemoveImage(editingIndex)}
                className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium"
              >
                <Trash2 className="h-3 w-3" />
                Smazat
              </button>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">URL obrázku</Label>
              <Input
                value={gallery[editingIndex] || ''}
                onChange={(e) => {
                  const newGallery = [...gallery];
                  newGallery[editingIndex] = e.target.value;
                  handleUpdateGallery(newGallery);
                }}
                placeholder="https://..."
                className="bg-white text-sm"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vlastní popisek obrázku</Label>
              <Input
                value={(content.galleryCaptions || [])[editingIndex] || ''}
                onChange={(e) => {
                  const newCaptions = [...(content.galleryCaptions || [])];
                  // Vyplníme pole prázdnými stringy až k indexu, pokud je kratší
                  while (newCaptions.length <= editingIndex) newCaptions.push('');
                  newCaptions[editingIndex] = e.target.value;
                  handleUpdateGallery(gallery, newCaptions);
                }}
                placeholder="Popisek k tomuto obrázku..."
                className="bg-white text-sm"
              />
            </div>
          </div>
        )}
      </SettingSection>

      {/* Grid Columns */}
      {gallery.length > 1 && (
        <SettingSection title="Rozložení mřížky">
          <div className="space-y-2">
            <Label className="text-xs text-slate-500 font-bold uppercase tracking-wider">Počet sloupců</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(cols => (
                <ToggleButton
                  key={cols}
                  isActive={(content.gridColumns || 2) === cols}
                  onClick={() => onUpdate({ ...content, gridColumns: cols })}
                >
                  {cols === 1 ? '1' : cols}
                </ToggleButton>
              ))}
            </div>
          </div>
        </SettingSection>
      )}

      {/* Size and Crop Slider */}
      <SettingSection title="Velikost a ořez">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <Slider
              value={[size]}
              min={10}
              max={200}
              step={1}
              onValueChange={([val]) => onUpdate({ ...content, size: val })}
              className="flex-1"
            />
            <span className="text-sm text-slate-600 w-12 text-right font-medium">
              {size}%
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 uppercase font-bold tracking-wider">
            <span>Zmenšení</span>
            <span className={size === 100 ? 'text-blue-500' : ''}>Původní</span>
            <span>Ořez</span>
          </div>
        </div>
      </SettingSection>

      {gallery.length <= 1 && (
        <SettingSection title="Zarovnání">
          <div className="flex gap-2">
            <ToggleButton
              isActive={content.alignment === 'left'}
              onClick={() => onUpdate({ ...content, alignment: 'left' })}
            >
              <AlignLeft className="h-4 w-4" />
            </ToggleButton>
            <ToggleButton
              isActive={content.alignment === 'center'}
              onClick={() => onUpdate({ ...content, alignment: 'center' })}
            >
              <AlignCenter className="h-4 w-4" />
            </ToggleButton>
            <ToggleButton
              isActive={content.alignment === 'right'}
              onClick={() => onUpdate({ ...content, alignment: 'right' })}
            >
              <AlignRight className="h-4 w-4" />
            </ToggleButton>
          </div>
        </SettingSection>
      )}

      {/* Aktivita */}
      <SettingSection title="Aktivita na obrázcích">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <ToggleButton
              isActive={content.imageActivityType === 'none' || !content.imageActivityType}
              onClick={() => onUpdate({ ...content, imageActivityType: 'none' })}
              className="flex items-center gap-2 justify-center"
            >
              Žádná
            </ToggleButton>
            <ToggleButton
              isActive={content.imageActivityType === 'text-input'}
              onClick={() => onUpdate({ ...content, imageActivityType: 'text-input' })}
              className="flex items-center gap-2 justify-center text-xs"
            >
              <Type className="w-4 h-4" /> Pole pro text
            </ToggleButton>
            <ToggleButton
              isActive={content.imageActivityType === 'checkbox-circle'}
              onClick={() => onUpdate({ ...content, imageActivityType: 'checkbox-circle' })}
              className="flex items-center gap-2 justify-center text-xs"
            >
              <Circle className="w-4 h-4" /> Kolečko
            </ToggleButton>
            <ToggleButton
              isActive={content.imageActivityType === 'checkbox-square'}
              onClick={() => onUpdate({ ...content, imageActivityType: 'checkbox-square' })}
              className="flex items-center gap-2 justify-center text-xs"
            >
              <Square className="w-4 h-4" /> Čtvereček
            </ToggleButton>
          </div>
          <p className="text-[10px] text-slate-400 italic">
            Zobrazí interaktivní prvek pro vepsání odpovědi nebo zaškrtnutí přímo na každém obrázku.
          </p>
        </div>
      </SettingSection>

      {/* Popisek */}
      <SettingSection title="Popisek">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-slate-500 font-bold uppercase tracking-wider">Zobrazit popisek</Label>
            <Switch
              checked={content.showCaption !== false}
              onCheckedChange={(checked) => onUpdate({ ...content, showCaption: checked })}
            />
          </div>
          <Textarea
            value={content.caption || ''}
            onChange={(e) => onUpdate({ ...content, caption: e.target.value })}
            placeholder="Volitelný popisek..."
            className="text-sm min-h-[80px]"
          />
        </div>
      </SettingSection>
    </div>
  );
}

/**
 * Block Image Settings - for adding optional image to any block
 */
function BlockImageSettings({ 
  image, 
  onUpdate 
}: { 
  image?: BlockImage; 
  onUpdate: (image: BlockImage | undefined) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(!!image?.url);

  const handleAddImage = () => {
    setIsExpanded(true);
    if (!image) {
      onUpdate({
        url: '',
        position: 'before',
        size: 'medium',
      });
    }
  };

  const handleRemoveImage = () => {
    setIsExpanded(false);
    onUpdate(undefined);
  };

  const updateImage = (updates: Partial<BlockImage>) => {
    onUpdate({
      url: image?.url || '',
      position: image?.position || 'before',
      size: image?.size || 'medium',
      ...updates,
    });
  };

  return (
    <div className="border-t border-slate-200 pt-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Obrázek k bloku
        </span>
        {!isExpanded ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddImage}
            className="text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Přidat
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveImage}
            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Odebrat
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div>
            <Label className="text-xs text-slate-600 mb-1 block">URL obrázku</Label>
            <Input
              value={image?.url || ''}
              onChange={(e) => updateImage({ url: e.target.value })}
              placeholder="https://..."
              className="bg-white text-sm"
            />
          </div>

          <div>
            <Label className="text-xs text-slate-600 mb-1 block">Popisek (alt)</Label>
            <Input
              value={image?.alt || ''}
              onChange={(e) => updateImage({ alt: e.target.value })}
              placeholder="Popis obrázku..."
              className="bg-white text-sm"
            />
          </div>

          <div>
            <Label className="text-xs text-slate-600 mb-2 block">Pozice</Label>
            <div className="flex gap-2">
              <ToggleButton
                isActive={image?.position === 'before'}
                onClick={() => updateImage({ position: 'before' })}
              >
                Nad obsahem
              </ToggleButton>
              <ToggleButton
                isActive={image?.position === 'beside-left'}
                onClick={() => updateImage({ position: 'beside-left' })}
              >
                Vlevo
              </ToggleButton>
              <ToggleButton
                isActive={image?.position === 'beside-right'}
                onClick={() => updateImage({ position: 'beside-right' })}
              >
                Vpravo
              </ToggleButton>
            </div>
          </div>

          <div>
            <Label className="text-xs text-slate-600 mb-2 block">Velikost</Label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'small' as ImageSize, label: 'Malý' },
                { value: 'medium' as ImageSize, label: 'Střední' },
                { value: 'large' as ImageSize, label: 'Velký' },
              ].map((size) => (
                <ToggleButton
                  key={size.value}
                  isActive={image?.size === size.value}
                  onClick={() => updateImage({ size: size.value })}
                >
                  {size.label}
                </ToggleButton>
              ))}
            </div>
          </div>

          {image?.url && (
            <div className="pt-2 border-t border-slate-200">
              <p className="text-xs text-slate-500 mb-2">Náhled:</p>
              <img 
                src={image.url} 
                alt={image.alt || ''} 
                className="max-w-full h-auto rounded-lg max-h-24 object-contain"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// HEADER FOOTER SETTINGS
// ============================================

const FEEDBACK_TYPES: { value: FeedbackType; label: string; preview: string }[] = [
  { value: 'smileys', label: 'Smajlíci', preview: '😢 🙁 😐 🙂 😊' },
  { value: 'hearts', label: 'Srdíčka', preview: '💔 🖤 🤍 🩷 ❤️' },
  { value: 'stars', label: 'Hvězdičky', preview: '☆ ☆ ☆ ☆ ☆' },
  { value: 'none', label: 'Žádná', preview: '' },
];

// ============================================
// QR CODE SETTINGS
// ============================================

function QRCodeSettings({ block, onUpdate }: { block: QRCodeBlock; onUpdate: (content: QRCodeContent) => void }) {
  const { url, caption, captionPosition, size = 150 } = block.content;

  return (
    <div className="space-y-6">
      <SettingSection title="Obsah QR kódu">
        <div className="space-y-2">
          <Label className="text-xs text-slate-500 uppercase tracking-wider font-bold">Odkaz / Text</Label>
          <Input 
            value={url} 
            onChange={(e) => onUpdate({ ...block.content, url: e.target.value })}
            placeholder="https://..."
          />
        </div>
      </SettingSection>

      <SettingSection title="Popisek">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-slate-500 uppercase tracking-wider font-bold">Text popisku</Label>
            <Textarea 
              value={caption} 
              onChange={(e) => onUpdate({ ...block.content, caption: e.target.value })}
              placeholder="Naskenujte pro více informací..."
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-slate-500 uppercase tracking-wider font-bold">Pozice popisku</Label>
            <div className="flex gap-2">
              <ToggleButton
                isActive={captionPosition === 'under'}
                onClick={() => onUpdate({ ...block.content, captionPosition: 'under' })}
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs">Pod kódem</span>
                </div>
              </ToggleButton>
              <ToggleButton
                isActive={captionPosition === 'left'}
                onClick={() => onUpdate({ ...block.content, captionPosition: 'left' })}
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs">Vlevo</span>
                </div>
              </ToggleButton>
            </div>
          </div>
        </div>
      </SettingSection>

      <SettingSection title="Velikost QR kódu">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">{size} px</span>
          </div>
          <Slider
            value={[size]}
            min={100}
            max={300}
            step={10}
            onValueChange={([val]) => onUpdate({ ...block.content, size: val })}
          />
        </div>
      </SettingSection>
    </div>
  );
}

function HeaderFooterSettings({ block, onUpdate }: { block: HeaderFooterBlock; onUpdate: (content: HeaderFooterContent) => void }) {
  const content = block.content;
  const isHeader = content.variant === 'header';

  return (
    <>
      {/* Typ: Hlavička / Patička */}
      <SettingSection title="Typ">
        <div className="flex gap-2">
          <ToggleButton
            isActive={content.variant === 'header'}
            onClick={() => onUpdate({ ...content, variant: 'header' })}
          >
            Hlavička
          </ToggleButton>
          <ToggleButton
            isActive={content.variant === 'footer'}
            onClick={() => onUpdate({ ...content, variant: 'footer' })}
          >
            Patička
          </ToggleButton>
        </div>
      </SettingSection>

      {isHeader ? (
        // === NASTAVENÍ HLAVIČKY ===
        <>
          <SettingSection title="Pole k zobrazení">
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <Switch
                  checked={content.showName !== false}
                  onCheckedChange={(checked) => onUpdate({ ...content, showName: checked })}
                />
                <span className="text-sm text-slate-700">Jméno</span>
              </label>
              <label className="flex items-center gap-2">
                <Switch
                  checked={content.showSurname !== false}
                  onCheckedChange={(checked) => onUpdate({ ...content, showSurname: checked })}
                />
                <span className="text-sm text-slate-700">Příjmení</span>
              </label>
              <label className="flex items-center gap-2">
                <Switch
                  checked={content.showClass !== false}
                  onCheckedChange={(checked) => onUpdate({ ...content, showClass: checked })}
                />
                <span className="text-sm text-slate-700">Třída</span>
              </label>
              <label className="flex items-center gap-2">
                <Switch
                  checked={content.showGrade !== false}
                  onCheckedChange={(checked) => onUpdate({ ...content, showGrade: checked })}
                />
                <span className="text-sm text-slate-700">Známka</span>
              </label>
              <label className="flex items-center gap-2">
                <Switch
                  checked={content.showQrCode || false}
                  onCheckedChange={(checked) => onUpdate({ ...content, showQrCode: checked })}
                />
                <span className="text-sm text-slate-700">QR kód</span>
              </label>
              <label className="flex items-center gap-2">
                <Switch
                  checked={content.showPageNumber || false}
                  onCheckedChange={(checked) => onUpdate({ ...content, showPageNumber: checked })}
                />
                <span className="text-sm text-slate-700">Číslo stránky</span>
              </label>
            </div>
          </SettingSection>

          {content.showQrCode && (
            <SettingSection title="QR kód">
              <div className="space-y-2">
                <Label className="text-xs text-slate-500 mb-1">URL adresa:</Label>
                <Input
                  value={content.qrCodeUrl || ''}
                  onChange={(e) => onUpdate({ ...content, qrCodeUrl: e.target.value })}
                  placeholder="https://example.com/dokument"
                  className="bg-slate-50"
                />
              </div>
            </SettingSection>
          )}

          <SettingSection title="Vlastní info">
            <Textarea
              value={content.customInfo || ''}
              onChange={(e) => onUpdate({ ...content, customInfo: e.target.value })}
              placeholder="Doplňující informace (volitelné)..."
              className="bg-slate-50 h-16"
            />
          </SettingSection>
        </>
      ) : (
        // === NASTAVENÍ PATIČKY ===
        <>
          <SettingSection title="Rozložení">
            <div className="flex gap-2">
              <ToggleButton
                isActive={content.columns === 1}
                onClick={() => onUpdate({ ...content, columns: 1 })}
              >
                1 sloupec
              </ToggleButton>
              <ToggleButton
                isActive={content.columns === 2}
                onClick={() => onUpdate({ ...content, columns: 2 })}
              >
                2 sloupce
              </ToggleButton>
            </div>
          </SettingSection>

          <SettingSection title="Pole k zobrazení">
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <Switch
                  checked={content.showFooterInfo || false}
                  onCheckedChange={(checked) => onUpdate({ ...content, showFooterInfo: checked })}
                />
                <span className="text-sm text-slate-700">Info text</span>
              </label>
              <label className="flex items-center gap-2">
                <Switch
                  checked={content.showFeedback || false}
                  onCheckedChange={(checked) => onUpdate({ ...content, showFeedback: checked })}
                />
                <span className="text-sm text-slate-700">Zpětná vazba</span>
              </label>
              <label className="flex items-center gap-2">
                <Switch
                  checked={content.showQrCode || false}
                  onCheckedChange={(checked) => onUpdate({ ...content, showQrCode: checked })}
                />
                <span className="text-sm text-slate-700">QR kód</span>
              </label>
              <label className="flex items-center gap-2">
                <Switch
                  checked={content.showPageNumber || false}
                  onCheckedChange={(checked) => onUpdate({ ...content, showPageNumber: checked })}
                />
                <span className="text-sm text-slate-700">Číslo stránky</span>
              </label>
            </div>
          </SettingSection>

          {content.showFooterInfo && (
            <SettingSection title="Info text">
              <Textarea
                value={content.footerInfo || ''}
                onChange={(e) => onUpdate({ ...content, footerInfo: e.target.value })}
                placeholder="Informace v patičce..."
                className="bg-slate-50 h-16"
              />
            </SettingSection>
          )}

          {content.showFeedback && (
            <SettingSection title="Zpětná vazba">
              <div className="space-y-3">
                <Input
                  value={content.feedbackText || ''}
                  onChange={(e) => onUpdate({ ...content, feedbackText: e.target.value })}
                  placeholder="Text zpětné vazby..."
                  className="bg-slate-50"
                />
                
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">Typ:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {FEEDBACK_TYPES.map((type) => (
                      <ToggleButton
                        key={type.value}
                        isActive={content.feedbackType === type.value}
                        onClick={() => onUpdate({ ...content, feedbackType: type.value })}
                      >
                        <div className="text-center">
                          <span className="block text-xs">{type.label}</span>
                          {type.preview && (
                            <span className="text-[10px] opacity-60">{type.preview.slice(0, 10)}</span>
                          )}
                        </div>
                      </ToggleButton>
                    ))}
                  </div>
                </div>

                {content.feedbackType && content.feedbackType !== 'none' && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Počet možností:</p>
                    <div className="flex gap-2">
                      {[3, 4, 5].map((count) => (
                        <ToggleButton
                          key={count}
                          isActive={(content.feedbackCount || 5) === count}
                          onClick={() => onUpdate({ ...content, feedbackCount: count })}
                        >
                          {count}
                        </ToggleButton>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SettingSection>
          )}

          {content.showQrCode && (
            <SettingSection title="QR kód">
              <div className="space-y-2">
                <Label className="text-xs text-slate-500 mb-1">URL adresa:</Label>
                <Input
                  value={content.qrCodeUrl || ''}
                  onChange={(e) => onUpdate({ ...content, qrCodeUrl: e.target.value })}
                  placeholder="https://example.com/dokument"
                  className="bg-slate-50"
                />
              </div>
            </SettingSection>
          )}
        </>
      )}
    </>
  );
}