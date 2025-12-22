/**
 * QuizTypeSelector - Popup pro výběr typu kvízu/boardu
 */

import React from 'react';
import { X, Play, ClipboardList, Presentation, CheckCircle2, HelpCircle, Users, Zap, Brain } from 'lucide-react';

export type QuizType = 'prezentace' | 'test' | 'pisemka';

interface QuizTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: QuizType) => void;
  documentTitle: string;
}

const QUIZ_TYPES = [
  {
    id: 'prezentace' as QuizType,
    name: 'Prezentace / Aktivita do hodiny',
    icon: Presentation,
    iconGradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200 hover:border-amber-400',
    description: 'Interaktivní kvíz pro společnou práci ve třídě',
    includes: [
      { icon: Users, text: 'Pro celou třídu najednou' },
      { icon: Zap, text: 'Rychlé otázky s okamžitou zpětnou vazbou' },
      { icon: Play, text: 'Živé promítání s QR kódem' },
    ],
    promptModifier: `Vytvoř INTERAKTIVNÍ PREZENTACI pro živou práci ve třídě:
1. 8-12 rychlých otázek vhodných pro společnou aktivitu
2. Většina otázek s výběrem odpovědi (A/B/C/D) - rychle zodpověditelné
3. Zajímavé a poutavé formulace otázek
4. Obrázky nebo vizuální prvky kde to dává smysl

Kvíz by měl být zábavný, energický a podporovat zapojení všech žáků.`,
  },
  {
    id: 'test' as QuizType,
    name: 'Test (ABC otázky)',
    icon: ClipboardList,
    iconGradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200 hover:border-blue-400',
    description: 'Klasický test s otázkami na výběr odpovědi',
    includes: [
      { icon: CheckCircle2, text: 'Otázky s výběrem A/B/C/D' },
      { icon: Brain, text: 'Testování znalostí a faktů' },
      { icon: ClipboardList, text: 'Automatické vyhodnocení' },
    ],
    promptModifier: `Vytvoř TEST s otázkami na výběr odpovědi:
1. 10-15 otázek s výběrem odpovědi (A/B/C/D)
2. Otázky pokrývající všechny hlavní body dokumentu
3. Různé úrovně obtížnosti (lehké, střední, těžší)
4. Jasné a jednoznačné správné odpovědi

Test by měl objektivně ověřit porozumění tématu.`,
  },
  {
    id: 'pisemka' as QuizType,
    name: 'Písemka (otázky na porozumění)',
    icon: HelpCircle,
    iconGradient: 'linear-gradient(135deg, #a855f7, #9333ea)',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200 hover:border-purple-400',
    description: 'Hlubší otázky na porozumění a aplikaci',
    includes: [
      { icon: HelpCircle, text: 'Otevřené otázky i výběr' },
      { icon: Brain, text: 'Porozumění a souvislosti' },
      { icon: CheckCircle2, text: 'Kombinace typů otázek' },
    ],
    promptModifier: `Vytvoř PÍSEMKU na porozumění tématu:
1. 6-10 otázek různých typů
2. Mix otázek s výběrem odpovědi a otevřených otázek
3. Otázky na porozumění, vysvětlení a aplikaci znalostí
4. Otázky propojující různé části tématu

Písemka by měla testovat hlubší porozumění, ne jen zapamatování faktů.`,
  },
];

export function QuizTypeSelector({ 
  isOpen, 
  onClose, 
  onSelect, 
  documentTitle 
}: QuizTypeSelectorProps) {
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
            <h2 className="text-xl font-bold text-slate-800">Vytvořit kvíz</h2>
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
            Vyberte typ kvízu, který chcete vygenerovat z aktuálního dokumentu:
          </p>
          
          <div className="grid gap-3">
            {QUIZ_TYPES.map((type) => {
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
            AI vygeneruje kvíz na základě obsahu dokumentu. Můžete ho později upravit v editoru.
          </p>
        </div>
      </div>
    </div>
  );
}

// Export prompt modifiers for use in generation
export function getQuizPromptModifier(type: QuizType): string {
  const typeConfig = QUIZ_TYPES.find(t => t.id === type);
  return typeConfig?.promptModifier || '';
}

export { QUIZ_TYPES };


