/**
 * WorksheetTypeSelector - Popup pro výběr typu pracovního listu
 */

import React from 'react';
import { X, FileText, ClipboardList, BookOpen, CheckCircle2, HelpCircle, PenLine } from 'lucide-react';

export type WorksheetType = 'test' | 'pisemka' | 'pracovni-list';

interface WorksheetTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: WorksheetType) => void;
  documentTitle: string;
}

const WORKSHEET_TYPES = [
  {
    id: 'test' as WorksheetType,
    name: 'Test',
    icon: ClipboardList,
    iconGradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200 hover:border-blue-400',
    description: 'Klasický test s otázkami ABC a otevřenými odpověďmi',
    includes: [
      { icon: CheckCircle2, text: 'Otázky s výběrem odpovědi (ABC)' },
      { icon: HelpCircle, text: 'Otevřené otázky' },
      { icon: PenLine, text: 'Bodové hodnocení' },
    ],
    promptModifier: `Vytvoř TEST s následující strukturou:
1. Nadpis testu
2. 5-7 otázek s výběrem odpovědi (multiple-choice) s 3-4 možnostmi
3. 2-3 otevřené otázky (free-answer)

Každá otázka by měla mít jasné bodové ohodnocení. Test by měl pokrývat hlavní body z dokumentu.`,
  },
  {
    id: 'pisemka' as WorksheetType,
    name: 'Písemka',
    icon: PenLine,
    iconGradient: 'linear-gradient(135deg, #a855f7, #9333ea)',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200 hover:border-purple-400',
    description: 'Písemná práce pouze s otevřenými otázkami',
    includes: [
      { icon: HelpCircle, text: 'Pouze otevřené otázky' },
      { icon: PenLine, text: 'Rozvíjení myšlenek' },
      { icon: BookOpen, text: 'Hlubší porozumění tématu' },
    ],
    promptModifier: `Vytvoř PÍSEMKU pouze s otevřenými otázkami:
1. Nadpis písemky
2. 5-8 otevřených otázek (free-answer) různé obtížnosti
3. Otázky by měly testovat porozumění, schopnost vysvětlit a aplikovat znalosti

NEPOUŽÍVEJ otázky s výběrem odpovědi. Pouze free-answer bloky.`,
  },
  {
    id: 'pracovni-list' as WorksheetType,
    name: 'Pracovní list',
    icon: FileText,
    iconGradient: 'linear-gradient(135deg, #10b981, #059669)',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200 hover:border-emerald-400',
    description: 'Kombinace informací a různých typů aktivit',
    includes: [
      { icon: BookOpen, text: 'Informační bloky a vysvětlení' },
      { icon: CheckCircle2, text: 'Otázky s výběrem odpovědi' },
      { icon: PenLine, text: 'Doplňovací cvičení a otevřené otázky' },
    ],
    promptModifier: `Vytvoř kompletní PRACOVNÍ LIST s pestrou kombinací:
1. Nadpis pracovního listu
2. Krátký úvodní text shrnující téma (paragraph)
3. Informační box s důležitými fakty (infobox)
4. 2-3 otázky s výběrem odpovědi (multiple-choice)
5. 1-2 doplňovací cvičení (fill-blank)
6. 1-2 otevřené otázky (free-answer)

Vytvoř zajímavý a pestrý pracovní list pro aktivní práci žáků.`,
  },
];

export function WorksheetTypeSelector({ 
  isOpen, 
  onClose, 
  onSelect, 
  documentTitle 
}: WorksheetTypeSelectorProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-start justify-center p-4 overflow-y-auto"
      style={{ paddingTop: '20px' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" style={{ zIndex: -1 }} />
      
      {/* Modal */}
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[calc(100vh-40px)] overflow-auto animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Vytvořit materiál</h2>
            <p className="text-sm text-slate-500 mt-1">
              Z dokumentu: <span className="font-medium text-slate-700">{documentTitle}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          <p className="text-slate-600 mb-6">
            Vyberte typ materiálu, který chcete vygenerovat z aktuálního dokumentu:
          </p>
          
          <div className="grid gap-3">
            {WORKSHEET_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => onSelect(type.id)}
                  className={`group relative flex items-center gap-4 p-4 rounded-xl border-2 ${type.borderColor} ${type.bgColor} transition-all hover:shadow-lg text-left`}
                >
                  {/* Icon */}
                  <div 
                    className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-md"
                    style={{ background: type.iconGradient }}
                  >
                    <Icon className="w-6 h-6 text-white" strokeWidth={2} />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-800 group-hover:text-slate-900">
                        {type.name}
                      </h3>
                      <svg className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="text-slate-500 text-sm mt-0.5">
                      {type.description}
                    </p>
                    
                    {/* Features */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {type.includes.map((feature, idx) => {
                        const FeatureIcon = feature.icon;
                        return (
                          <span 
                            key={idx}
                            className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-white/80 px-2 py-1 rounded-md"
                          >
                            <FeatureIcon size={14} className="text-slate-500" strokeWidth={2} />
                            {feature.text}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
          <p className="text-xs text-slate-500 text-center">
            AI vygeneruje materiál na základě obsahu dokumentu. Můžete ho později upravit v editoru.
          </p>
        </div>
      </div>
    </div>
  );
}

// Export prompt modifiers for use in generation
export function getPromptModifier(type: WorksheetType): string {
  const typeConfig = WORKSHEET_TYPES.find(t => t.id === type);
  return typeConfig?.promptModifier || '';
}

export { WORKSHEET_TYPES };

