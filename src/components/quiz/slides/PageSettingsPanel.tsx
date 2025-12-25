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
import { QuizSlide, InfoSlide, SlideLayoutType, createSlideLayout, SLIDE_TEMPLATES, SlideTemplate, getTemplateById } from '../../../types/quiz';
import { BackgroundPicker } from './BackgroundPicker';
import { Paintbrush } from 'lucide-react';

interface PageSettingsPanelProps {
  slide: QuizSlide;
  onClose: () => void;
  onUpdate: (updates: Partial<QuizSlide>) => void;
}

type SectionId = 'type' | 'template' | 'layout' | 'background' | 'chapter' | 'note';

const SLIDE_TYPES = [
  { id: 'info', label: 'Informace', icon: Info, description: 'Informační slide s textem a obrázky' },
  { id: 'activity', label: 'Aktivita', icon: Zap, description: 'Interaktivní úkol pro studenty' },
];

// SVG Layout Icons
const LayoutIcon = ({ type }: { type: string }) => {
  const colors = {
    title: '#c7d2fe',   // light indigo
    block1: '#a5b4fc',  // indigo
    block2: '#818cf8',  // darker indigo
    block3: '#6366f1',  // even darker
  };
  
  const svgProps = { width: 48, height: 36, viewBox: '0 0 48 36' };
  
  switch (type) {
    case 'title-content':
      return (
        <svg {...svgProps}>
          <rect x="2" y="2" width="44" height="8" rx="2" fill={colors.title} />
          <rect x="2" y="12" width="44" height="22" rx="2" fill={colors.block1} />
        </svg>
      );
    case 'title-2cols':
      return (
        <svg {...svgProps}>
          <rect x="2" y="2" width="44" height="8" rx="2" fill={colors.title} />
          <rect x="2" y="12" width="21" height="22" rx="2" fill={colors.block1} />
          <rect x="25" y="12" width="21" height="22" rx="2" fill={colors.block2} />
        </svg>
      );
    case 'title-3cols':
      return (
        <svg {...svgProps}>
          <rect x="2" y="2" width="44" height="8" rx="2" fill={colors.title} />
          <rect x="2" y="12" width="13" height="22" rx="2" fill={colors.block1} />
          <rect x="17" y="12" width="14" height="22" rx="2" fill={colors.block2} />
          <rect x="33" y="12" width="13" height="22" rx="2" fill={colors.block3} />
        </svg>
      );
    case '2cols':
      return (
        <svg {...svgProps}>
          <rect x="2" y="2" width="21" height="32" rx="2" fill={colors.block1} />
          <rect x="25" y="2" width="21" height="32" rx="2" fill={colors.block2} />
        </svg>
      );
    case '3cols':
      return (
        <svg {...svgProps}>
          <rect x="2" y="2" width="13" height="32" rx="2" fill={colors.block1} />
          <rect x="17" y="2" width="14" height="32" rx="2" fill={colors.block2} />
          <rect x="33" y="2" width="13" height="32" rx="2" fill={colors.block3} />
        </svg>
      );
    case 'left-large-right-split':
      return (
        <svg {...svgProps}>
          <rect x="2" y="2" width="28" height="32" rx="2" fill={colors.block1} />
          <rect x="32" y="2" width="14" height="15" rx="2" fill={colors.block2} />
          <rect x="32" y="19" width="14" height="15" rx="2" fill={colors.block3} />
        </svg>
      );
    case 'right-large-left-split':
      return (
        <svg {...svgProps}>
          <rect x="2" y="2" width="14" height="15" rx="2" fill={colors.block1} />
          <rect x="2" y="19" width="14" height="15" rx="2" fill={colors.block2} />
          <rect x="18" y="2" width="28" height="32" rx="2" fill={colors.block3} />
        </svg>
      );
    default:
      return null;
  }
};

const LAYOUTS = [
  { id: 'title-content', label: 'Nadpis + obsah' },
  { id: 'title-2cols', label: 'Nadpis + 2 sloupce' },
  { id: 'title-3cols', label: 'Nadpis + 3 sloupce' },
  { id: '2cols', label: '2 sloupce' },
  { id: '3cols', label: '3 sloupce' },
  { id: 'left-large-right-split', label: 'Levý velký' },
  { id: 'right-large-left-split', label: 'Pravý velký' },
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
    const bg = (slide as any).slideBackground;
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

  const getTemplateName = () => {
    if (slide.type !== 'info') return '-';
    const templateId = (slide as InfoSlide).templateId;
    if (!templateId) return 'Žádná';
    const template = getTemplateById(templateId);
    return template?.name || 'Žádná';
  };

  const getCurrentTemplate = (): SlideTemplate | undefined => {
    if (slide.type !== 'info') return undefined;
    const templateId = (slide as InfoSlide).templateId;
    if (!templateId) return undefined;
    return getTemplateById(templateId);
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

        {/* 2. Šablona (only for info slides) */}
        {slide.type === 'info' && (
          <AccordionSection 
            id="template" 
            icon={Paintbrush} 
            title="Šablona" 
            value={
              <div className="flex items-center gap-2">
                {getCurrentTemplate() && (
                  <span 
                    className="inline-block w-4 h-4 rounded-full border border-slate-300"
                    style={{ backgroundColor: getCurrentTemplate()?.colors.primary }}
                  />
                )}
                <span>{getTemplateName()}</span>
              </div>
            }
          >
            <div className="space-y-2 pt-2">
              {/* No template option */}
              <button
                onClick={() => onUpdate({ templateId: undefined } as any)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  !(slide as InfoSlide).templateId
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                  ✕
                </div>
                <div className="text-left">
                  <div className={`font-medium ${!(slide as InfoSlide).templateId ? 'text-indigo-700' : 'text-slate-700'}`}>
                    Žádná šablona
                  </div>
                  <div className="text-xs text-slate-500">Vlastní nastavení</div>
                </div>
              </button>

              {/* Template options */}
              {SLIDE_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => onUpdate({ templateId: template.id } as any)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    (slide as InfoSlide).templateId === template.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  {/* Color preview */}
                  <div className="flex gap-0.5">
                    {template.blockColors?.slice(0, 3).map((color, idx) => (
                      <div 
                        key={idx}
                        className="w-3 h-10 rounded-sm first:rounded-l-lg last:rounded-r-lg"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="text-left flex-1">
                    <div 
                      className={`font-medium ${(slide as InfoSlide).templateId === template.id ? 'text-indigo-700' : 'text-slate-700'}`}
                      style={{ fontFamily: template.font }}
                    >
                      {template.name}
                    </div>
                    <div className="text-xs text-slate-500">Font: {template.font}</div>
                  </div>
                </button>
              ))}
            </div>
          </AccordionSection>
        )}

        {/* 3. Rozložení (only for info slides) */}
        {slide.type === 'info' && (
          <AccordionSection 
            id="layout" 
            icon={SlidersHorizontal} 
            title="Rozložení" 
            value={getLayoutName()}
          >
            <div className="space-y-4 pt-2">
              {/* Layout grid - 3 columns */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {LAYOUTS.map((layoutOption) => (
                  <button
                    key={layoutOption.id}
                    onClick={() => {
                      const currentSlide = slide as InfoSlide;
                      const oldBlocks = currentSlide.layout?.blocks || [];
                      const savedBlocks = currentSlide.savedBlocks || [];
                      const newLayout = createSlideLayout(layoutOption.id as SlideLayoutType);
                      
                      // Combine old blocks with saved blocks for maximum content preservation
                      const allOldBlocks = [...oldBlocks, ...savedBlocks];
                      
                      // Preserve content from old blocks
                      const updatedBlocks = newLayout.blocks.map((newBlock, index) => {
                        const oldBlock = allOldBlocks[index];
                        if (oldBlock && (oldBlock.content || oldBlock.gallery?.length)) {
                          return {
                            ...newBlock,
                            type: oldBlock.type,
                            content: oldBlock.content,
                            title: oldBlock.title,
                            background: oldBlock.background,
                            textAlign: oldBlock.textAlign,
                            fontSize: oldBlock.fontSize,
                            fontWeight: oldBlock.fontWeight,
                            fontStyle: oldBlock.fontStyle,
                            textDecoration: oldBlock.textDecoration,
                            textColor: oldBlock.textColor,
                            highlightColor: oldBlock.highlightColor,
                            textOverflow: oldBlock.textOverflow,
                            imageFit: oldBlock.imageFit,
                            imageScale: oldBlock.imageScale,
                            imagePositionX: oldBlock.imagePositionX,
                            imagePositionY: oldBlock.imagePositionY,
                            imageCaption: oldBlock.imageCaption,
                            imageLink: oldBlock.imageLink,
                            gallery: oldBlock.gallery,
                            galleryIndex: oldBlock.galleryIndex,
                            galleryNavType: oldBlock.galleryNavType,
                          };
                        }
                        return newBlock;
                      });
                      
                      // Save blocks that don't fit in new layout
                      const newSavedBlocks = allOldBlocks
                        .slice(newLayout.blocks.length)
                        .filter(b => b.content || b.gallery?.length);
                      
                      onUpdate({ 
                        layout: { ...newLayout, blocks: updatedBlocks },
                        savedBlocks: newSavedBlocks.length > 0 ? newSavedBlocks : undefined
                      } as any);
                    }}
                    className={`p-2 rounded-lg border-2 flex flex-col items-center transition-all ${
                      (slide as InfoSlide).layout?.type === layoutOption.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <LayoutIcon type={layoutOption.id} />
                    <span className="text-[9px] font-medium text-slate-600 mt-0.5 text-center leading-tight">{layoutOption.label}</span>
                  </button>
                ))}
              </div>

              {/* Gap and Radius dropdowns - side by side */}
              <div className="flex gap-3 pt-2">
                {/* Gap dropdown */}
                <div className="flex-1">
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Mezera</label>
                    <select
                      value={(slide as InfoSlide).blockGap ?? getTemplateById((slide as InfoSlide).templateId || '')?.defaultGap ?? 11}
                      onChange={(e) => onUpdate({ blockGap: parseInt(e.target.value) } as any)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
                    >
                      <option value={0}>Žádná</option>
                      <option value={4}>Malá (4px)</option>
                      <option value={11}>Střední (11px)</option>
                      <option value={16}>Velká (16px)</option>
                      <option value={24}>Extra (24px)</option>
                    </select>
                </div>

                {/* Border radius dropdown */}
                <div className="flex-1">
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Zakulacení</label>
                  <select
                    value={(slide as InfoSlide).blockRadius ?? getTemplateById((slide as InfoSlide).templateId || '')?.defaultRadius ?? 8}
                    onChange={(e) => onUpdate({ blockRadius: parseInt(e.target.value) } as any)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
                  >
                    <option value={0}>Žádné</option>
                    <option value={4}>Malé (4px)</option>
                    <option value={8}>Střední (8px)</option>
                    <option value={16}>Velké (16px)</option>
                    <option value={24}>Extra (24px)</option>
                  </select>
                </div>
              </div>
            </div>
          </AccordionSection>
        )}

        {/* 4. Barva pozadí */}
        <AccordionSection 
          id="background" 
          icon={Palette} 
          title="Barva pozadí" 
          value={getBackgroundPreview()}
        >
          <div className="pt-2">
            <BackgroundPicker
              value={(slide as any).slideBackground || { type: 'color', color: '#ffffff' }}
              onChange={(bg) => {
                onUpdate({ slideBackground: bg } as any);
              }}
              onClose={() => {}}
              showUpload={true}
              showOpacity={true}
              showBlur={false}
              inline={true}
            />
          </div>
        </AccordionSection>

        {/* 5. Jméno kapitoly */}
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

        {/* 6. Poznámka ke stránce */}
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

