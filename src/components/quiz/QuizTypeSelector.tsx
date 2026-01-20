/**
 * QuizTypeSelector - Popup pro výběr typu kvízu/boardu
 */

import React from 'react';
import { X, Play, ClipboardList, Presentation, CheckCircle2, HelpCircle, Users, Zap, Brain } from 'lucide-react';

export type QuizType = 'test' | 'pisemka' | 'aktivita';

interface QuizTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: QuizType) => void;
  documentTitle: string;
  /** Optional: images/animations extracted from the document */
  documentMedia?: { type: 'image' | 'lottie'; url: string; caption?: string }[];
}

const QUIZ_TYPES = [
  {
    id: 'test' as QuizType,
    name: 'Test',
    icon: ClipboardList,
    iconGradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200 hover:border-blue-400',
    description: 'Otázky s výběrem odpovědi, příklady k procvičení',
    includes: [
      { icon: CheckCircle2, text: 'Otázky ABC s výběrem odpovědi' },
      { icon: Brain, text: 'Příklady s postupným řešením' },
      { icon: ClipboardList, text: 'Automatické vyhodnocení' },
    ],
    promptModifier: `Vytvoř TEST s otázkami a příklady:
1. 10-15 otázek/příkladů
2. Otázky s výběrem odpovědi (A/B/C/D) - jasné správné odpovědi
3. Příklady (example) s postupným řešením pro matematiku/fyziku
4. Různé úrovně obtížnosti (lehké, střední, těžší)
5. Pokrývej všechny hlavní body dokumentu

Test by měl objektivně ověřit porozumění tématu.`,
  },
  {
    id: 'pisemka' as QuizType,
    name: 'Písemka',
    icon: HelpCircle,
    iconGradient: 'linear-gradient(135deg, #a855f7, #9333ea)',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200 hover:border-purple-400',
    description: 'Otevřené otázky k zamyšlení a porozumění',
    includes: [
      { icon: HelpCircle, text: 'Otevřené otázky' },
      { icon: Brain, text: 'Porozumění a souvislosti' },
      { icon: Users, text: 'Vysvětlování vlastními slovy' },
    ],
    promptModifier: `Vytvoř PÍSEMKU s otevřenými otázkami:
1. 6-10 otevřených otázek (type: "open")
2. Otázky na porozumění, vysvětlení a aplikaci znalostí
3. Otázky propojující různé části tématu
4. Každá otázka má pole correctAnswers s možnými odpověďmi
5. Žádné ABC otázky - pouze otevřené!

Písemka by měla testovat hlubší porozumění, ne jen zapamatování faktů.`,
  },
  {
    id: 'aktivita' as QuizType,
    name: 'Aktivita do hodiny',
    icon: Presentation,
    iconGradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200 hover:border-amber-400',
    description: 'Interaktivní board věrně sledující strukturu lekce',
    includes: [
      { icon: Users, text: 'Nástěnky pro diskuzi třídy' },
      { icon: Zap, text: 'Hlasování a zpětná vazba' },
      { icon: Play, text: 'Obrázky a animace z lekce' },
    ],
    promptModifier: `Vytvoř INTERAKTIVNÍ AKTIVITU DO HODINY podle struktury dokumentu.

## KRITICKY DŮLEŽITÉ - SLEDUJ STRUKTURU DOKUMENTU:

1. **ANALYZUJ DOKUMENT** - Projdi dokument a identifikuj:
   - Úvodní text → info slide na začátku
   - Cíle/popisky → vlož do pole "note" u slidů (poznámka pro učitele)
   - Otázky v dokumentu → každou otázku převeď na NÁSTĚNKU (board)
   - Příklady/cvičení → zachovej jako příklady nebo ABC
   - Definice/pojmy → můžeš udělat spojovačku nebo doplňovačku
   - Obrázky/animace → vlož do info slidů

2. **ZACHOVEJ POŘADÍ** - Slidy by měly následovat pořadí v dokumentu!

3. **OTÁZKY Z DOKUMENTU → NÁSTĚNKY**:
   - Pokud dokument obsahuje otázky k zamyšlení, udělej z KAŽDÉ nástěnku (board)
   - Otázky dej za sebou tak, jak jsou v dokumentu
   - Použij boardType: "text" pro volné odpovědi
   - Použij boardType: "pros-cons" pro otázky typu "souhlasíte/nesouhlasíte"

## DOSTUPNÉ TYPY SLIDŮ:

**info** - Informační slide (pro úvod, shrnutí, obrázky)
{ "type": "info", "title": "...", "content": "<p>...</p>", "note": "Poznámka pro učitele" }

**board** - Nástěnka pro diskuzi (POUŽÍVEJ PRO OTÁZKY Z DOKUMENTU!)
{ "type": "board", "boardType": "text", "question": "Otázka z dokumentu?", "note": "Cíl: ..." }

**voting** - Hlasování
{ "type": "voting", "votingType": "single|multiple|scale|feedback", "question": "...", "options": [...] }

**abc** - Kvízová otázka (jen pokud je v dokumentu jako test)
{ "type": "abc", "question": "...", "options": [...] }

**fill-blanks** - Doplňování (pro klíčové pojmy)
**connect-pairs** - Spojovačka (pro definice a pojmy)

## PRAVIDLA:

1. NEBUĎ příliš kreativní - sleduj dokument!
2. Pokud je v dokumentu 5 otázek k zamyšlení → udělej 5 nástěnek za sebou
3. Úvodní text vždy na začátek jako info slide
4. Cíle a popisky z dokumentu vlož do "note" pole
5. Na KONCI přidej feedback hlasování: { "type": "voting", "votingType": "feedback", "question": "Jak se ti pracovalo?" }
6. Obrázky/animace z dokumentu vlož kam patří podle kontextu`,
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


