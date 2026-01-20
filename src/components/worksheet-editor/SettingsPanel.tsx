/**
 * SettingsPanel - Nastavení pracovního listu
 * 
 * Zobrazuje a umožňuje editovat:
 * - Název
 * - Popis
 * - Předmět
 * - Ročník
 * - Časová náročnost
 * - Klíčová slova
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, LayoutTemplate, Columns, Key, Eye, EyeOff, Presentation, ArrowRight, Loader2, Layers } from 'lucide-react';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Worksheet, Subject, Grade, ColumnCount } from '../../types/worksheet';
import { worksheetToBoard, getConversionSummary } from '../../utils/content-converter';
import { saveQuiz } from '../../utils/quiz-storage';

interface SettingsPanelProps {
  worksheet: Worksheet;
  onUpdateWorksheet: (updates: Partial<Worksheet>) => void;
}

// Předměty
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

// Ročníky
const GRADES: Grade[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function SettingsPanel({ worksheet, onUpdateWorksheet }: SettingsPanelProps) {
  const navigate = useNavigate();
  const [keywordInput, setKeywordInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  // Calculate actual layout state from blocks
  const allFull = worksheet.blocks.length === 0 || worksheet.blocks.every(b => b.width === 'full' || !b.width);
  const allHalf = worksheet.blocks.length > 0 && worksheet.blocks.every(b => b.width === 'half');
  const layoutState: 'single' | 'double' | 'mixed' = allFull ? 'single' : allHalf ? 'double' : 'mixed';

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('anthropic_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    if (value.trim()) {
      localStorage.setItem('anthropic_api_key', value.trim());
    } else {
      localStorage.removeItem('anthropic_api_key');
    }
  };

  const addKeyword = () => {
    if (keywordInput.trim()) {
      const keywords = [...(worksheet.metadata.keywords || []), keywordInput.trim()];
      onUpdateWorksheet({
        metadata: { ...worksheet.metadata, keywords }
      });
      setKeywordInput('');
    }
  };

  const removeKeyword = (index: number) => {
    const keywords = worksheet.metadata.keywords?.filter((_, i) => i !== index);
    onUpdateWorksheet({
      metadata: { ...worksheet.metadata, keywords }
    });
  };

  // Convert worksheet to board
  const handleConvertToBoard = async () => {
    setIsConverting(true);
    try {
      const board = worksheetToBoard(worksheet);
      saveQuiz(board);
      // Navigate to the new board editor
      navigate(`/quiz/edit/${board.id}`);
    } catch (error) {
      console.error('Error converting to board:', error);
      setIsConverting(false);
    }
  };

  // Get conversion preview
  const conversionSummary = getConversionSummary(worksheet, 'toBoard');

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200">
        <h2 className="font-semibold text-slate-800">Nastavení listu</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Název */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Název
          </Label>
          <Input
            value={worksheet.title}
            onChange={(e) => onUpdateWorksheet({ title: e.target.value })}
            placeholder="Název pracovního listu"
            className="bg-slate-50 border-slate-200"
          />
        </div>

        {/* Popis */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Popis
          </Label>
          <Textarea
            value={worksheet.description || ''}
            onChange={(e) => onUpdateWorksheet({ description: e.target.value })}
            placeholder="Krátký popis pracovního listu..."
            rows={3}
            className="bg-slate-50 border-slate-200 resize-none"
          />
        </div>

        {/* Předmět */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Předmět
          </Label>
          <Select
            value={worksheet.metadata.subject}
            onValueChange={(value) =>
              onUpdateWorksheet({
                metadata: { ...worksheet.metadata, subject: value as Subject }
              })
            }
          >
            <SelectTrigger className="bg-slate-50 border-slate-200">
              <SelectValue placeholder="Vyberte předmět" />
            </SelectTrigger>
            <SelectContent>
              {SUBJECTS.map((subject) => (
                <SelectItem key={subject.value} value={subject.value}>
                  {subject.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ročník */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Ročník
          </Label>
          <Select
            value={String(worksheet.metadata.grade)}
            onValueChange={(value) =>
              onUpdateWorksheet({
                metadata: { ...worksheet.metadata, grade: Number(value) as Grade }
              })
            }
          >
            <SelectTrigger className="bg-slate-50 border-slate-200">
              <SelectValue placeholder="Vyberte ročník" />
            </SelectTrigger>
            <SelectContent>
              {GRADES.map((grade) => (
                <SelectItem key={grade} value={String(grade)}>
                  {grade}. třída
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Časová náročnost */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Časová náročnost
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={120}
              value={worksheet.metadata.estimatedTime || ''}
              onChange={(e) =>
                onUpdateWorksheet({
                  metadata: { ...worksheet.metadata, estimatedTime: Number(e.target.value) || undefined }
                })
              }
              placeholder="15"
              className="w-20 bg-slate-50 border-slate-200"
            />
            <span className="text-sm text-slate-500">minut</span>
          </div>
        </div>

        {/* Rozložení stránky */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Rozložení stránky
          </Label>
          <div className="flex gap-2">
            <button
              onClick={() => onUpdateWorksheet({
                metadata: { ...worksheet.metadata, columns: 1 },
                // Set all blocks to full-width
                blocks: worksheet.blocks.map(block => ({
                  ...block,
                  width: 'full' as const,
                  widthPercent: undefined,
                }))
              })}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                layoutState === 'single'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <LayoutTemplate className="h-4 w-4" />
              1 sloupec
            </button>
            <button
              onClick={() => onUpdateWorksheet({
                metadata: { ...worksheet.metadata, columns: 2 },
                // Set all blocks to half-width
                blocks: worksheet.blocks.map(block => ({
                  ...block,
                  width: 'half' as const,
                  widthPercent: 50,
                }))
              })}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                layoutState === 'double'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Columns className="h-4 w-4" />
              2 sloupce
            </button>
          </div>
          {layoutState === 'mixed' && (
            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
              <Layers className="h-3 w-3" />
              Smíšené rozložení (bloky mají různé šířky)
            </p>
          )}
        </div>

        {/* Klíčová slova */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Klíčová slova
          </Label>
          <div className="flex gap-2">
            <Input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addKeyword();
                }
              }}
              placeholder="Přidat klíčové slovo..."
              className="flex-1 bg-slate-50 border-slate-200"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={addKeyword}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Tags */}
          {worksheet.metadata.keywords && worksheet.metadata.keywords.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {worksheet.metadata.keywords.map((keyword, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-full text-sm text-slate-700"
                >
                  {keyword}
                  <button
                    onClick={() => removeKeyword(index)}
                    className="hover:text-red-500 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200 my-4" />

        {/* Convert to Board */}
        <div className="space-y-3">
          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Presentation className="h-3.5 w-3.5" />
            Převod na Board
          </Label>
          
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
            <p className="text-sm text-slate-600 mb-3">
              Převeďte pracovní list na interaktivní board pro prezentaci ve třídě.
            </p>
            
            {/* Preview stats */}
            <div className="flex gap-4 mb-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <span className="text-slate-600">{conversionSummary.questions} otázek</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <span className="text-slate-600">{conversionSummary.infoItems} info slidů</span>
              </div>
            </div>
            
            <button
              onClick={handleConvertToBoard}
              disabled={isConverting || conversionSummary.convertibleItems === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium text-sm hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              {isConverting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Převádím...
                </>
              ) : (
                <>
                  <Presentation className="h-4 w-4" />
                  Vytvořit Board
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            
            {conversionSummary.convertibleItems === 0 && (
              <p className="text-xs text-amber-600 mt-2 text-center">
                Přidejte obsah pro možnost převodu
              </p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200 my-4" />

        {/* API Key for AI */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Key className="h-3.5 w-3.5" />
            API Klíč (pro AI)
          </Label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="sk-ant-api..."
                className="bg-slate-50 border-slate-200 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            {apiKey ? (
              <span className="text-green-600">✓ Klíč je uložen lokálně</span>
            ) : (
              'Pro AI funkce. Klíč zůstává pouze v prohlížeči.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

