/**
 * BlockSettingsOverlay - Overlay panel pro nastavení vybraného bloku
 * 
 * Překryje celý levý panel včetně mini sidebaru.
 * Obsahuje detailní nastavení specifické pro typ bloku.
 */

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Trash2,
  Copy,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Info,
  ListChecks,
  TextCursorInput,
  MessageSquare,
  Minus,
  Plus,
  Square,
  Calculator,
  Sparkles,
  RectangleHorizontal,
  Columns2,
  MoreHorizontal,
  ImageIcon,
  RefreshCw,
  Table,
} from 'lucide-react';

// Alias for better naming
const LayoutColumns = Columns2;
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
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
  SpacerBlock,
  ExamplesBlock,
  ImageBlock,
  InfoboxVariant,
  SpacerStyle,
  ExamplesLabelType,
  AnswerBoxStyle,
  ImageSize,
  BlockImage,
  ImagePosition,
} from '../../types/worksheet';
import { generateExamplesFromSample } from '../../utils/ai-examples-generator';

interface BlockSettingsOverlayProps {
  block: WorksheetBlock;
  onClose: () => void;
  onUpdateBlock: (blockId: string, content: any) => void;
  onUpdateBlockWidth: (blockId: string, width: BlockWidth, widthPercent?: number) => void;
  onUpdateBlockMarginStyle: (blockId: string, marginStyle: 'empty' | 'dotted' | 'lined') => void;
  onUpdateBlockImage?: (blockId: string, image: BlockImage | undefined) => void;
  onDeleteBlock: (blockId: string) => void;
  onDuplicateBlock: (blockId: string) => void;
  onMoveUp: (blockId: string) => void;
  onMoveDown: (blockId: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

// Konfigurace typů bloků
const BLOCK_TYPE_CONFIG: Record<BlockType, { label: string; icon: typeof Type }> = {
  'heading': { label: 'Nadpis', icon: Type },
  'paragraph': { label: 'Odstavec', icon: AlignLeft },
  'infobox': { label: 'Infobox', icon: Info },
  'multiple-choice': { label: 'Výběr odpovědi', icon: ListChecks },
  'fill-blank': { label: 'Doplňování', icon: TextCursorInput },
  'free-answer': { label: 'Volná odpověď', icon: MessageSquare },
  'spacer': { label: 'Volný prostor', icon: Square },
  'examples': { label: 'Příklady', icon: Calculator },
  'image': { label: 'Obrázek', icon: ImageIcon },
  'table': { label: 'Tabulka', icon: Table },
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

export function BlockSettingsOverlay({
  block,
  onClose,
  onUpdateBlock,
  onUpdateBlockWidth,
  onUpdateBlockMarginStyle,
  onUpdateBlockImage,
  onDeleteBlock,
  onDuplicateBlock,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: BlockSettingsOverlayProps) {
  const config = BLOCK_TYPE_CONFIG[block.type];
  const Icon = config.icon;

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
          <div className="flex gap-6">
            {/* Pořadí */}
            <div className="flex-1">
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
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Šířka</p>
              <div className="flex gap-1">
                <IconButton
                  isActive={block.width === 'full'}
                  onClick={() => onUpdateBlockWidth(block.id, 'full')}
                  title="Celá šířka"
                >
                  <RectangleHorizontal className="h-5 w-5" />
                </IconButton>
                <IconButton
                  isActive={block.width === 'half'}
                  onClick={() => onUpdateBlockWidth(block.id, 'half')}
                  title="Poloviční šířka"
                >
                  <LayoutColumns className="h-5 w-5" />
                </IconButton>
              </div>
            </div>
          </div>

          {/* Volný prostor pod blokem - jen když je marginBottom > 0 */}
          {(block.marginBottom ?? 0) > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Volný prostor</p>
              <div className="flex gap-2">
                <ToggleButton
                  isActive={(block.marginStyle || 'empty') === 'empty'}
                  onClick={() => onUpdateBlockMarginStyle(block.id, 'empty')}
                >
                  Prázdný
                </ToggleButton>
                <ToggleButton
                  isActive={block.marginStyle === 'dotted'}
                  onClick={() => onUpdateBlockMarginStyle(block.id, 'dotted')}
                >
                  Tečkovaný
                </ToggleButton>
                <ToggleButton
                  isActive={block.marginStyle === 'lined'}
                  onClick={() => onUpdateBlockMarginStyle(block.id, 'lined')}
                >
                  Linkovaný
                </ToggleButton>
              </div>
            </div>
          )}
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

        {/* Block Image - available for all blocks except image blocks */}
        {block.type !== 'image' && block.type !== 'spacer' && onUpdateBlockImage && (
          <BlockImageSettings
            image={block.image}
            onUpdate={(image) => onUpdateBlockImage(block.id, image)}
          />
        )}

        {/* Duplicate button */}
        <div className="pt-4 border-t border-slate-200">
          <Button
            variant="outline"
            onClick={handleDuplicate}
            className="w-full gap-2"
          >
            <Copy className="h-4 w-4" />
            Duplikovat blok
          </Button>
        </div>
      </div>

      {/* Delete button at bottom */}
      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
              Smazat blok
            </Button>
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
                className="bg-red-600 hover:bg-red-700"
              >
                Smazat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
}: { 
  isActive: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1"
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

function HeadingSettings({ block, onUpdate }: { block: HeadingBlock; onUpdate: (content: any) => void }) {
  const currentAlign = (block.content as any).align || 'left';
  
  return (
    <>
      <SettingSection title="Úroveň nadpisu">
        <div className="flex gap-2">
          {(['h1', 'h2', 'h3'] as const).map((level) => (
            <ToggleButton
              key={level}
              isActive={block.content.level === level}
              onClick={() => onUpdate({ ...block.content, level })}
            >
              {level.toUpperCase()}
            </ToggleButton>
          ))}
        </div>
      </SettingSection>

      <SettingSection title="Zarovnání">
        <div className="flex gap-2">
          {[
            { value: 'left', icon: AlignLeft },
            { value: 'center', icon: AlignCenter },
            { value: 'right', icon: AlignRight },
          ].map(({ value, icon: AlignIcon }) => (
            <ToggleButton
              key={value}
              isActive={currentAlign === value}
              onClick={() => onUpdate({ ...block.content, align: value })}
            >
              <AlignIcon className="h-5 w-5" />
            </ToggleButton>
          ))}
        </div>
      </SettingSection>
    </>
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

function ParagraphSettings({ block, onUpdate }: { block: ParagraphBlock; onUpdate: (content: any) => void }) {
  const content = block.content as any;
  const currentAlign = content.align || 'left';
  const displayMode = content.displayMode || 'normal';
  const bgColor = content.bgColor || 'none';
  const hasBorder = content.hasBorder || false;
  const fontSize = content.fontSize || 'normal';
  
  return (
    <>
      {/* Display mode */}
      <SettingSection title="Zobrazení">
        <div className="flex gap-2">
          <ToggleButton
            isActive={displayMode === 'normal'}
            onClick={() => onUpdate({ ...content, displayMode: 'normal' })}
          >
            Normální text
          </ToggleButton>
          <ToggleButton
            isActive={displayMode === 'infobox'}
            onClick={() => onUpdate({ ...content, displayMode: 'infobox' })}
          >
            Infobox
          </ToggleButton>
        </div>
      </SettingSection>

      {/* Background color - only show when infobox */}
      {displayMode === 'infobox' && (
        <>
          <SettingSection title="Podbarvení">
            <div className="flex gap-2 flex-wrap">
              {PARAGRAPH_COLORS.filter(c => c.value !== 'none').map((colorOption) => (
                <button
                  key={colorOption.value}
                  onClick={() => onUpdate({ ...content, bgColor: colorOption.value })}
                  className="w-10 h-10 rounded-lg transition-all"
                  style={{
                    backgroundColor: colorOption.color,
                    border: `2px solid ${colorOption.border}`,
                    transform: bgColor === colorOption.value ? 'scale(1.1)' : 'scale(1)',
                    boxShadow: bgColor === colorOption.value ? '0 0 0 2px #3b82f6' : 'none',
                  }}
                  title={colorOption.label}
                />
              ))}
            </div>
          </SettingSection>

          <SettingSection title="Okraj">
            <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-slate-200">
              <span className="text-sm text-slate-700">Zobrazit okraj</span>
              <Switch
                checked={hasBorder}
                onCheckedChange={(checked) => onUpdate({ ...content, hasBorder: checked })}
              />
            </div>
          </SettingSection>
        </>
      )}

      {/* Alignment */}
      <SettingSection title="Zarovnání">
        <div className="flex gap-2">
          {[
            { value: 'left', icon: AlignLeft },
            { value: 'center', icon: AlignCenter },
            { value: 'right', icon: AlignRight },
            { value: 'justify', icon: AlignJustify },
          ].map(({ value, icon: AlignIcon }) => (
            <ToggleButton
              key={value}
              isActive={currentAlign === value}
              onClick={() => onUpdate({ ...content, align: value })}
            >
              <AlignIcon className="h-5 w-5" />
            </ToggleButton>
          ))}
        </div>
      </SettingSection>

      {/* Font size */}
      <SettingSection title="Velikost písma">
        <div className="flex gap-2">
          <ToggleButton
            isActive={fontSize === 'small'}
            onClick={() => onUpdate({ ...content, fontSize: 'small' })}
          >
            Malé
          </ToggleButton>
          <ToggleButton
            isActive={fontSize === 'normal'}
            onClick={() => onUpdate({ ...content, fontSize: 'normal' })}
          >
            Normální
          </ToggleButton>
          <ToggleButton
            isActive={fontSize === 'large'}
            onClick={() => onUpdate({ ...content, fontSize: 'large' })}
          >
            Velké
          </ToggleButton>
        </div>
      </SettingSection>
    </>
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
  return (
    <>
      <SettingSection title="Více odpovědí">
        <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
          <span className="text-sm text-slate-700">Povolit více odpovědí</span>
          <Switch
            checked={block.content.allowMultiple}
            onCheckedChange={(checked) => onUpdate({ ...block.content, allowMultiple: checked })}
          />
        </div>
      </SettingSection>

      <SettingSection title="Správné odpovědi">
        <div className="space-y-2">
          {block.content.options.map((option, index) => (
            <label
              key={option.id}
              className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-100 transition-colors"
            >
              <input
                type="checkbox"
                checked={block.content.correctAnswers.includes(option.id)}
                onChange={(e) => {
                  const newCorrect = e.target.checked
                    ? [...block.content.correctAnswers, option.id]
                    : block.content.correctAnswers.filter(id => id !== option.id);
                  onUpdate({ ...block.content, correctAnswers: newCorrect });
                }}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 flex-1">
                {option.text || `Možnost ${index + 1}`}
              </span>
            </label>
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
    <>
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
            onClick={() => onUpdate({ ...block.content, height: Math.min(500, block.content.height + 20) })}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Nebo táhněte za spodní hranu v náhledu
        </p>
      </SettingSection>

      <SettingSection title="Styl">
        <div className="flex gap-2">
          {[
            { value: 'empty' as SpacerStyle, label: 'Prázdný' },
            { value: 'dotted' as SpacerStyle, label: 'Tečkovaný' },
            { value: 'lined' as SpacerStyle, label: 'Linkovaný' },
          ].map((style) => (
            <ToggleButton
              key={style.value}
              isActive={block.content.style === style.value}
              onClick={() => onUpdate({ ...block.content, style: style.value })}
            >
              {style.label}
            </ToggleButton>
          ))}
        </div>
      </SettingSection>
    </>
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
  
  // Convert ImageSize to percentage (for slider)
  const sizeToPercent: Record<ImageSize, number> = {
    small: 30,
    medium: 50,
    large: 75,
    full: 100,
  };
  
  // Convert percentage to closest ImageSize
  const percentToSize = (percent: number): ImageSize => {
    if (percent <= 35) return 'small';
    if (percent <= 60) return 'medium';
    if (percent <= 85) return 'large';
    return 'full';
  };
  
  const currentPercent = sizeToPercent[content.size] || 50;

  return (
    <>
      {/* Preview with replace button */}
      {content.url && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500">Náhled</p>
            <button
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <RefreshCw className="h-3 w-3" />
              Nahradit
            </button>
          </div>
          <img 
            src={content.url} 
            alt={content.alt || ''} 
            className="max-w-full h-auto rounded-lg max-h-32 object-contain"
          />
          {showUrlInput && (
            <div className="mt-3">
              <Input
                value={content.url || ''}
                onChange={(e) => onUpdate({ ...content, url: e.target.value })}
                placeholder="Nová URL obrázku..."
                className="bg-white text-xs"
              />
            </div>
          )}
        </div>
      )}

      {/* Size slider */}
      <SettingSection title="Velikost">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <Slider
              value={[currentPercent]}
              min={30}
              max={100}
              step={5}
              onValueChange={(values) => {
                const newSize = percentToSize(values[0]);
                onUpdate({ ...content, size: newSize });
              }}
              className="flex-1"
            />
            <span className="text-sm text-slate-600 w-12 text-right font-medium">
              {currentPercent}%
            </span>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Malý</span>
            <span>Plná šířka</span>
          </div>
        </div>
      </SettingSection>

      {/* Caption */}
      <SettingSection title="Popisek">
        <div className="flex items-center gap-3">
          <Input
            value={content.caption || ''}
            onChange={(e) => onUpdate({ ...content, caption: e.target.value })}
            placeholder="Volitelný popisek..."
            className="bg-slate-50 flex-1"
          />
          {content.caption && (
            <div className="flex items-center gap-2 shrink-0">
              <Switch
                checked={content.showCaption !== false}
                onCheckedChange={(checked) => onUpdate({ ...content, showCaption: checked })}
              />
              <span className="text-xs text-slate-500">Zobrazit</span>
            </div>
          )}
        </div>
      </SettingSection>
    </>
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

