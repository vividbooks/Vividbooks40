import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ChevronDown, 
  ChevronRight,
  FileText,
  SlidersHorizontal,
  Palette,
  Bookmark,
  MessageSquare,
  Zap,
  Info,
  HelpCircle
} from 'lucide-react';
import { QuizSlide, InfoSlide, SlideLayoutType, createSlideLayout } from '../../../types/quiz';
import { BackgroundPicker } from './BackgroundPicker';

interface PageSettingsPanelProps {
  slide: QuizSlide;
  onClose: () => void;
  onUpdate: (updates: Partial<QuizSlide>) => void;
}

type SectionId = 'type' | 'layout' | 'background' | 'chapter' | 'note';

const SLIDE_TYPES = [
  { id: 'info', label: 'Informace', icon: Info, description: 'Informační slide s textem a obrázky' },
  { id: 'activity', label: 'Aktivita', icon: Zap, description: 'Interaktivní úkol pro studenty' },
];

const LAYOUTS = [
  { id: 'title-content', label: 'Nadpis + obsah', preview: '📝' },
  { id: 'title-2cols', label: 'Nadpis + 2 sloupce', preview: '📊' },
  { id: 'title-3cols', label: 'Nadpis + 3 sloupce', preview: '📋' },
  { id: '2cols', label: '2 sloupce', preview: '⬜⬜' },
  { id: '3cols', label: '3 sloupce', preview: '⬜⬜⬜' },
  { id: 'left-large-right-split', label: 'Levý velký', preview: '⬛⬜' },
  { id: 'right-large-left-split', label: 'Pravý velký', preview: '⬜⬛' },
];

export function PageSettingsPanel({ slide, onClose, onUpdate }: PageSettingsPanelProps) {
  const [expandedSection, setExpandedSection] = useState<SectionId | null>(null);

  const toggleSection = (sectionId: SectionId) => {
    setExpandedSection(prev => prev === sectionId ? null : sectionId);
  };

  const getSlideTypeName = () => {
    if (slide.type === 'info') return 'Informace';
    if (slide.type === 'activity') return 'Aktivita';
    return 'Neznámý';
  };

  const getLayoutName = () => {
    if (slide.type !== 'info') return '-';
    const slideLayout = (slide as InfoSlide).layout;
    const layoutOption = LAYOUTS.find(l => l.id === slideLayout?.type);
    return layoutOption?.label || 'Nadpis + obsah';
  };

  const getBackgroundPreview = () => {
    const bg = slide.background || (slide as any).backgroundColor;
    if (!bg) return 'Bílá';
    if (typeof bg === 'string') return bg;
    if (bg.type === 'color' && bg.color) {
      return (
        <span 
          className="inline-block w-4 h-4 rounded-full border border-slate-300"
          style={{ backgroundColor: bg.color }}
        />
      );
    }
    if (bg.type === 'image') return 'Obrázek';
    return 'Bílá';
  };

  // Accordion Section Component
  const AccordionSection = ({ 
    id, 
    icon: Icon, 
    title, 
    value, 
    children 
  }: { 
    id: SectionId; 
    icon: React.ElementType; 
    title: string; 
    value: React.ReactNode; 
    children: React.ReactNode;
  }) => {
    const isExpanded = expandedSection === id;
    
    return (
      <div className="border-b border-slate-100 last:border-b-0">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Icon className="w-5 h-5 text-slate-500" />
            <span className="font-medium text-slate-700">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{value}</span>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </button>
        
        {isExpanded && (
          <div className="px-5 pb-4 bg-slate-50/50">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className="fixed top-0 left-0 h-full bg-white shadow-2xl z-40 flex flex-col overflow-hidden"
      style={{ width: '420px' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50">
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-slate-800">Nastavení stránky</h2>
      </div>
      
      {/* Accordion Sections */}
      <div className="flex-1 overflow-y-auto">
        {/* 1. Typ stránky */}
        <AccordionSection 
          id="type" 
          icon={FileText} 
          title="Typ stránky" 
          value={getSlideTypeName()}
        >
          <div className="space-y-2 pt-2">
            {SLIDE_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  // Note: Changing slide type would require more complex logic
                  // For now, just show the options
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  slide.type === type.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <type.icon className={`w-5 h-5 ${slide.type === type.id ? 'text-indigo-600' : 'text-slate-500'}`} />
                <div className="text-left">
                  <div className={`font-medium ${slide.type === type.id ? 'text-indigo-700' : 'text-slate-700'}`}>
                    {type.label}
                  </div>
                  <div className="text-xs text-slate-500">{type.description}</div>
                </div>
              </button>
            ))}
          </div>
        </AccordionSection>

        {/* 2. Rozložení (only for info slides) */}
        {slide.type === 'info' && (
          <AccordionSection 
            id="layout" 
            icon={SlidersHorizontal} 
            title="Rozložení" 
            value={getLayoutName()}
          >
            <div className="grid grid-cols-2 gap-2 pt-2">
              {LAYOUTS.map((layoutOption) => (
                <button
                  key={layoutOption.id}
                  onClick={() => {
                    const newLayout = createSlideLayout(layoutOption.id as SlideLayoutType);
                    onUpdate({ layout: newLayout } as any);
                  }}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    (slide as InfoSlide).layout?.type === layoutOption.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <span className="text-xl mb-1 block">{layoutOption.preview}</span>
                  <span className="text-xs font-medium text-slate-700">{layoutOption.label}</span>
                </button>
              ))}
            </div>
          </AccordionSection>
        )}

        {/* 3. Barva pozadí */}
        <AccordionSection 
          id="background" 
          icon={Palette} 
          title="Barva pozadí" 
          value={getBackgroundPreview()}
        >
          <div className="pt-2">
            <BackgroundPicker
              value={slide.background || { type: 'color', color: (slide as any).backgroundColor || '#ffffff' }}
              onChange={(bg) => {
                if (bg?.type === 'color' && bg.color) {
                  onUpdate({ backgroundColor: bg.color, background: bg } as any);
                } else if (bg) {
                  onUpdate({ background: bg } as any);
                }
              }}
              onClose={() => {}}
              showUpload={true}
              showOpacity={true}
              showBlur={false}
              inline={true}
            />
          </div>
        </AccordionSection>

        {/* 4. Jméno kapitoly */}
        <AccordionSection 
          id="chapter" 
          icon={Bookmark} 
          title="Jméno kapitoly" 
          value={(slide as any).chapterName || '-'}
        >
          <div className="pt-2">
            <input
              type="text"
              value={(slide as any).chapterName || ''}
              onChange={(e) => onUpdate({ chapterName: e.target.value } as any)}
              placeholder="Např. Úvod do fyziky"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-700"
            />
            <p className="text-xs text-slate-500 mt-2">
              Kapitola pomáhá organizovat slidy do logických celků
            </p>
          </div>
        </AccordionSection>

        {/* 5. Poznámka ke stránce */}
        <AccordionSection 
          id="note" 
          icon={MessageSquare} 
          title="Poznámka ke stránce" 
          value={(slide as any).note ? 'Přidána' : '-'}
        >
          <div className="pt-2">
            <textarea
              value={(slide as any).note || ''}
              onChange={(e) => onUpdate({ note: e.target.value } as any)}
              placeholder="Soukromá poznámka pro učitele..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-700 resize-none"
            />
            <p className="text-xs text-slate-500 mt-2">
              Poznámka je viditelná pouze pro učitele, studenti ji neuvidí
            </p>
          </div>
        </AccordionSection>
      </div>
    </div>
  );
}

export default PageSettingsPanel;

