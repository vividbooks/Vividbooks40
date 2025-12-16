/**
 * BlockSettingsPanel - Pravý panel pro nastavení bloků a pracovního listu
 * 
 * Zobrazuje pouze NASTAVENÍ (ne obsah - ten se edituje inline v canvasu):
 * - Nastavení celého pracovního listu (když není vybraný blok)
 * - Nastavení specifické pro typ bloku (level, barva, počet řádků...)
 * - Akce (duplikovat, smazat)
 */

import { useState } from 'react';
import {
  Type,
  AlignLeft,
  Info,
  ListChecks,
  TextCursorInput,
  MessageSquare,
  Trash2,
  Copy,
  Plus,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
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
  Worksheet,
  WorksheetBlock,
  HeadingBlock,
  ParagraphBlock,
  InfoboxBlock,
  MultipleChoiceBlock,
  FillBlankBlock,
  FreeAnswerBlock,
  InfoboxVariant,
  Subject,
  Grade,
  BlockWidth,
} from '../../types/worksheet';

// ============================================
// PROPS & TYPES
// ============================================

interface BlockSettingsPanelProps {
  worksheet: Worksheet;
  selectedBlock: WorksheetBlock | null;
  onUpdateWorksheet: (updates: Partial<Worksheet>) => void;
  onUpdateBlock: (blockId: string, content: any) => void;
  onUpdateBlockWidth: (blockId: string, width: BlockWidth, widthPercent?: number) => void;
  onDeleteBlock: (blockId: string) => void;
  onDuplicateBlock: (blockId: string) => void;
}

// Konfigurace typů bloků
const BLOCK_TYPE_LABELS: Record<WorksheetBlock['type'], string> = {
  'heading': 'Nadpis',
  'paragraph': 'Odstavec',
  'infobox': 'Infobox',
  'multiple-choice': 'Výběr odpovědi',
  'fill-blank': 'Doplňování',
  'free-answer': 'Volná odpověď',
};

const BLOCK_TYPE_ICONS: Record<WorksheetBlock['type'], typeof Type> = {
  'heading': Type,
  'paragraph': AlignLeft,
  'infobox': Info,
  'multiple-choice': ListChecks,
  'fill-blank': TextCursorInput,
  'free-answer': MessageSquare,
};

// Předměty pro select
const SUBJECTS: { value: Subject; label: string }[] = [
  { value: 'matematika', label: 'Matematika' },
  { value: 'fyzika', label: 'Fyzika' },
  { value: 'chemie', label: 'Chemie' },
  { value: 'prirodopis', label: 'Přírodověda' },
  { value: 'cestina', label: 'Český jazyk' },
  { value: 'anglictina', label: 'Angličtina' },
  { value: 'dejepis', label: 'Dějepis' },
  { value: 'zemepis', label: 'Zeměpis' },
  { value: 'other', label: 'Jiný' },
];

// Barvy infoboxu
const INFOBOX_VARIANTS: { value: InfoboxVariant; label: string; bgClass: string }[] = [
  { value: 'blue', label: 'Modrá', bgClass: 'bg-blue-500' },
  { value: 'green', label: 'Zelená', bgClass: 'bg-green-500' },
  { value: 'yellow', label: 'Žlutá', bgClass: 'bg-yellow-500' },
  { value: 'purple', label: 'Fialová', bgClass: 'bg-purple-500' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function BlockSettingsPanel({
  worksheet,
  selectedBlock,
  onUpdateWorksheet,
  onUpdateBlock,
  onUpdateBlockWidth,
  onDeleteBlock,
  onDuplicateBlock,
}: BlockSettingsPanelProps) {
  const [keywordInput, setKeywordInput] = useState('');

  // ============================================
  // WORKSHEET SETTINGS
  // ============================================

  const WorksheetSettings = () => (
    <div className="space-y-6">
      {/* Název */}
      <div className="space-y-2">
        <Label htmlFor="ws-title" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Název pracovního listu
        </Label>
        <Input
          id="ws-title"
          value={worksheet.title}
          onChange={(e) => onUpdateWorksheet({ title: e.target.value })}
          placeholder="Název pracovního listu"
        />
      </div>

      {/* Popis */}
      <div className="space-y-2">
        <Label htmlFor="ws-description" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Popis
        </Label>
        <Textarea
          id="ws-description"
          value={worksheet.description || ''}
          onChange={(e) => onUpdateWorksheet({ description: e.target.value })}
          placeholder="Krátký popis pracovního listu..."
          className="min-h-[80px] resize-none"
        />
      </div>

      <div className="h-px bg-slate-200" />

      {/* Předmět */}
      <div className="space-y-2">
        <Label htmlFor="ws-subject" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Předmět
        </Label>
        <Select
          value={worksheet.metadata.subject}
          onValueChange={(value) => onUpdateWorksheet({
            metadata: { ...worksheet.metadata, subject: value as Subject }
          })}
        >
          <SelectTrigger id="ws-subject">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUBJECTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Ročník */}
      <div className="space-y-2">
        <Label htmlFor="ws-grade" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Ročník
        </Label>
        <Select
          value={String(worksheet.metadata.grade)}
          onValueChange={(value) => onUpdateWorksheet({
            metadata: { ...worksheet.metadata, grade: Number(value) as Grade }
          })}
        >
          <SelectTrigger id="ws-grade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
              <SelectItem key={g} value={String(g)}>
                {g}. třída
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Časová náročnost */}
      <div className="space-y-2">
        <Label htmlFor="ws-time" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Časová náročnost
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="ws-time"
            type="number"
            min={5}
            max={90}
            step={5}
            value={worksheet.metadata.estimatedTime || ''}
            onChange={(e) => onUpdateWorksheet({
              metadata: { ...worksheet.metadata, estimatedTime: Number(e.target.value) || undefined }
            })}
            className="flex-1"
          />
          <span className="text-sm text-slate-500">minut</span>
        </div>
      </div>

      <div className="h-px bg-slate-200" />

      {/* Klíčová slova */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Klíčová slova
        </Label>
        <div className="flex gap-2">
          <Input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && keywordInput.trim()) {
                e.preventDefault();
                const keywords = worksheet.metadata.keywords || [];
                if (!keywords.includes(keywordInput.trim())) {
                  onUpdateWorksheet({
                    metadata: { ...worksheet.metadata, keywords: [...keywords, keywordInput.trim()] }
                  });
                }
                setKeywordInput('');
              }
            }}
            placeholder="Přidat klíčové slovo..."
            className="flex-1"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (keywordInput.trim()) {
                const keywords = worksheet.metadata.keywords || [];
                if (!keywords.includes(keywordInput.trim())) {
                  onUpdateWorksheet({
                    metadata: { ...worksheet.metadata, keywords: [...keywords, keywordInput.trim()] }
                  });
                }
                setKeywordInput('');
              }
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {worksheet.metadata.keywords && worksheet.metadata.keywords.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {worksheet.metadata.keywords.map((keyword, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-full text-sm text-slate-700"
              >
                {keyword}
                <button
                  onClick={() => {
                    const keywords = worksheet.metadata.keywords?.filter((_, i) => i !== index);
                    onUpdateWorksheet({
                      metadata: { ...worksheet.metadata, keywords }
                    });
                  }}
                  className="hover:text-red-500 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ============================================
  // BLOCK HEADER (shared for all block types)
  // ============================================

  const BlockHeader = ({ block }: { block: WorksheetBlock }) => {
    const Icon = BLOCK_TYPE_ICONS[block.type];
    return (
      <div className="space-y-4">
        {/* Block type display */}
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
          <div className="p-2 rounded-md bg-white shadow-sm">
            <Icon className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Typ bloku</p>
            <p className="font-medium text-slate-700">{BLOCK_TYPE_LABELS[block.type]}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDuplicateBlock(block.id)}
            className="flex-1 gap-2"
          >
            <Copy className="h-4 w-4" />
            Duplikovat
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Smazat
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
                  onClick={() => onDeleteBlock(block.id)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Smazat
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="h-px bg-slate-200" />

        {/* Block width */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Šířka bloku
          </Label>
          <div className="flex gap-2">
            <button
              onClick={() => onUpdateBlockWidth(block.id, 'full')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                block.width === 'full'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Celá šířka
            </button>
            <button
              onClick={() => onUpdateBlockWidth(block.id, 'half')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                block.width === 'half'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Poloviční
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Dva bloky s poloviční šířkou se zobrazí vedle sebe.
          </p>
        </div>

        <div className="h-px bg-slate-200" />
      </div>
    );
  };

  // ============================================
  // HEADING SETTINGS (only level - text is edited inline)
  // ============================================

  const HeadingSettings = ({ block }: { block: HeadingBlock }) => (
    <div className="space-y-4">
      <BlockHeader block={block} />

      {/* Úroveň nadpisu */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Úroveň nadpisu
        </Label>
        <div className="flex gap-2">
          {(['h1', 'h2', 'h3'] as const).map((level) => (
            <button
              key={level}
              onClick={() => onUpdateBlock(block.id, { ...block.content, level })}
              className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-colors ${
                block.content.level === level
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {level.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        💡 Dvojklikem na nadpis v náhledu můžete upravit text.
      </p>
    </div>
  );

  // ============================================
  // PARAGRAPH SETTINGS (no settings - text is edited inline)
  // ============================================

  const ParagraphSettings = ({ block }: { block: ParagraphBlock }) => (
    <div className="space-y-4">
      <BlockHeader block={block} />

      <p className="text-xs text-slate-400">
        💡 Dvojklikem na odstavec v náhledu můžete upravit text.
      </p>
    </div>
  );

  // ============================================
  // INFOBOX SETTINGS (only variant - content is edited inline)
  // ============================================

  const InfoboxSettings = ({ block }: { block: InfoboxBlock }) => (
    <div className="space-y-4">
      <BlockHeader block={block} />

      {/* Barva */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Barva infoboxu
        </Label>
        <div className="flex gap-2">
          {INFOBOX_VARIANTS.map((variant) => (
            <button
              key={variant.value}
              onClick={() => onUpdateBlock(block.id, { ...block.content, variant: variant.value })}
              className={`w-10 h-10 rounded-lg ${variant.bgClass} transition-all ${
                block.content.variant === variant.value
                  ? 'ring-2 ring-offset-2 ring-slate-400 scale-110'
                  : 'hover:scale-105'
              }`}
              title={variant.label}
            />
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        💡 Dvojklikem na infobox v náhledu můžete upravit titulek a text.
      </p>
    </div>
  );

  // ============================================
  // MULTIPLE CHOICE SETTINGS (correctAnswers, allowMultiple - questions/options edited inline)
  // ============================================

  const MultipleChoiceSettings = ({ block }: { block: MultipleChoiceBlock }) => {
    const toggleCorrectAnswer = (optionId: string) => {
      const currentCorrect = block.content.correctAnswers;
      let newCorrect: string[];
      
      if (block.content.allowMultiple) {
        // Toggle in multi-select mode
        newCorrect = currentCorrect.includes(optionId)
          ? currentCorrect.filter(id => id !== optionId)
          : [...currentCorrect, optionId];
      } else {
        // Single select mode
        newCorrect = currentCorrect.includes(optionId) ? [] : [optionId];
      }
      
      onUpdateBlock(block.id, { ...block.content, correctAnswers: newCorrect });
    };

    return (
      <div className="space-y-4">
        <BlockHeader block={block} />

        {/* Povolit více odpovědí */}
        <div className="flex items-center justify-between">
          <Label htmlFor="allow-multiple" className="text-sm text-slate-600">
            Povolit více odpovědí
          </Label>
          <Switch
            id="allow-multiple"
            checked={block.content.allowMultiple}
            onCheckedChange={(checked) => onUpdateBlock(block.id, {
              ...block.content,
              allowMultiple: checked,
              correctAnswers: checked ? block.content.correctAnswers : block.content.correctAnswers.slice(0, 1)
            })}
          />
        </div>

        <div className="h-px bg-slate-200" />

        {/* Správné odpovědi */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Správné odpovědi
          </Label>
          <div className="space-y-2">
            {block.content.options.map((opt, i) => (
              <label
                key={opt.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type={block.content.allowMultiple ? 'checkbox' : 'radio'}
                  name={`correct-${block.id}`}
                  checked={block.content.correctAnswers.includes(opt.id)}
                  onChange={() => toggleCorrectAnswer(opt.id)}
                  className="w-4 h-4 text-green-600 border-slate-300 focus:ring-green-500"
                />
                <span className="text-sm text-slate-600">
                  {opt.text || `Možnost ${i + 1}`}
                </span>
              </label>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-400">
          💡 Dvojklikem na otázku v náhledu můžete upravit text a možnosti.
        </p>
      </div>
    );
  };

  // ============================================
  // FILL BLANK SETTINGS (show blanks with correct answers)
  // ============================================

  const FillBlankSettings = ({ block }: { block: FillBlankBlock }) => {
    const blanks = block.content.segments.filter(seg => seg.type === 'blank');

    return (
      <div className="space-y-4">
        <BlockHeader block={block} />

        {/* Seznam mezer a správných odpovědí */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Správné odpovědi ({blanks.length} {blanks.length === 1 ? 'mezera' : 'mezer'})
          </Label>
          
          {blanks.length > 0 ? (
            <div className="space-y-2">
              {blanks.map((blank, i) => (
                <div key={blank.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                  <span className="text-xs font-medium text-slate-400 w-6">{i + 1}.</span>
                  <Input
                    value={(blank as any).correctAnswer || ''}
                    onChange={(e) => {
                      const newSegments = block.content.segments.map(seg =>
                        seg.type === 'blank' && seg.id === blank.id
                          ? { ...seg, correctAnswer: e.target.value }
                          : seg
                      );
                      onUpdateBlock(block.id, { ...block.content, segments: newSegments });
                    }}
                    placeholder="Správná odpověď..."
                    className="flex-1 h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">
              Žádné mezery k doplnění. Upravte text v náhledu.
            </p>
          )}
        </div>

        <p className="text-xs text-slate-400">
          💡 Dvojklikem na text v náhledu můžete upravit větu a mezery.
        </p>
      </div>
    );
  };

  // ============================================
  // FREE ANSWER SETTINGS (lines, hint - question edited inline)
  // ============================================

  const FreeAnswerSettings = ({ block }: { block: FreeAnswerBlock }) => (
    <div className="space-y-4">
      <BlockHeader block={block} />

      {/* Počet řádků */}
      <div className="space-y-2">
        <Label htmlFor="lines" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Počet řádků pro odpověď
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="lines"
            type="number"
            min={1}
            max={10}
            value={block.content.lines}
            onChange={(e) => onUpdateBlock(block.id, {
              ...block.content,
              lines: Math.min(10, Math.max(1, Number(e.target.value) || 3))
            })}
            className="w-20"
          />
          <span className="text-sm text-slate-500">řádků</span>
        </div>
      </div>

      {/* Nápověda */}
      <div className="space-y-2">
        <Label htmlFor="hint" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Nápověda pro žáky (volitelné)
        </Label>
        <Input
          id="hint"
          value={block.content.hint || ''}
          onChange={(e) => onUpdateBlock(block.id, { ...block.content, hint: e.target.value })}
          placeholder="Např. Odpověz celou větou..."
        />
      </div>

      {/* Vzorová odpověď (pro učitele) */}
      <div className="space-y-2">
        <Label htmlFor="sample" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Vzorová odpověď (pro učitele)
        </Label>
        <Textarea
          id="sample"
          value={block.content.sampleAnswer || ''}
          onChange={(e) => onUpdateBlock(block.id, { ...block.content, sampleAnswer: e.target.value })}
          placeholder="Vzorová odpověď pro kontrolu..."
          className="min-h-[80px] resize-none"
        />
      </div>

      <p className="text-xs text-slate-400">
        💡 Dvojklikem na otázku v náhledu můžete upravit text.
      </p>
    </div>
  );

  // ============================================
  // RENDER
  // ============================================

  if (!selectedBlock) {
    return (
      <div className="p-4 overflow-y-auto">
        <WorksheetSettings />
      </div>
    );
  }

  return (
    <div className="p-4 overflow-y-auto">
      {selectedBlock.type === 'heading' && (
        <HeadingSettings block={selectedBlock as HeadingBlock} />
      )}
      {selectedBlock.type === 'paragraph' && (
        <ParagraphSettings block={selectedBlock as ParagraphBlock} />
      )}
      {selectedBlock.type === 'infobox' && (
        <InfoboxSettings block={selectedBlock as InfoboxBlock} />
      )}
      {selectedBlock.type === 'multiple-choice' && (
        <MultipleChoiceSettings block={selectedBlock as MultipleChoiceBlock} />
      )}
      {selectedBlock.type === 'fill-blank' && (
        <FillBlankSettings block={selectedBlock as FillBlankBlock} />
      )}
      {selectedBlock.type === 'free-answer' && (
        <FreeAnswerSettings block={selectedBlock as FreeAnswerBlock} />
      )}
    </div>
  );
}
