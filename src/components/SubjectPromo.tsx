import { BookOpen, Shield, Users, Clock, CheckCircle2, Sparkles, GraduationCap, FileText, Play, ShoppingCart, School } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SubjectPromoProps {
  subject: string;
  subjectLabel: string;
  needsSchoolConnection?: boolean; // If true, show school connection CTA instead of purchase
}

const SUBJECT_FEATURES: Record<string, { features: string[]; description: string }> = {
  fyzika: {
    description: 'Interaktivní výuka fyziky pro 6.-9. ročník ZŠ s animacemi, experimenty a procvičováním.',
    features: [
      'Kompletní učivo fyziky pro 2. stupeň ZŠ',
      'Interaktivní animace fyzikálních jevů',
      'Virtuální experimenty a laboratorní práce',
      'Procvičování s okamžitou zpětnou vazbou',
      'Metodické materiály pro učitele',
      'Testy a písemné práce s automatickým hodnocením',
    ]
  },
  chemie: {
    description: 'Moderní výuka chemie s 3D modely molekul, virtuálními pokusy a interaktivními cvičeními.',
    features: [
      'Kompletní učivo chemie pro 2. stupeň ZŠ',
      '3D modely molekul a chemických vazeb',
      'Virtuální chemické pokusy',
      'Periodická tabulka s interaktivními prvky',
      'Procvičování chemických rovnic',
      'Bezpečnostní pravidla a laboratorní cvičení',
    ]
  },
  prirodopis: {
    description: 'Živá biologie s HD fotografiemi, anatomickými modely a ekologickými simulacemi.',
    features: [
      'Kompletní učivo přírodopisu pro 2. stupeň ZŠ',
      'HD fotografie a videa z přírody',
      'Interaktivní anatomické modely',
      'Ekologické simulace a potravní řetězce',
      'Herbář a atlas živočichů',
      'Terénní cvičení a projekty',
    ]
  },
  'matematika-2': {
    description: 'Matematika pro 2. stupeň s vizualizacemi, krokovými řešeními a adaptivním procvičováním.',
    features: [
      'Kompletní učivo matematiky pro 6.-9. ročník',
      'Vizualizace matematických pojmů',
      'Krokové řešení úloh s vysvětlením',
      'Adaptivní procvičování podle úrovně žáka',
      'Geometrické konstrukce a grafy',
      'Příprava na přijímací zkoušky',
    ]
  },
  'matematika-1': {
    description: 'Hravá matematika pro 1. stupeň s interaktivními hrami a vizuálními pomůckami.',
    features: [
      'Kompletní učivo matematiky pro 1.-5. ročník',
      'Interaktivní matematické hry',
      'Vizuální znázornění čísel a operací',
      'Slovní úlohy s obrázky',
      'Geometrické tvary a měření',
      'Logické úlohy a hlavolamy',
    ]
  },
  prvouka: {
    description: 'Poznávání světa kolem nás s interaktivními mapami, příběhy a experimenty.',
    features: [
      'Kompletní učivo prvouky pro 1.-3. ročník',
      'Interaktivní mapy a atlasy',
      'Příběhy a pohádky s poučením',
      'Jednoduché experimenty',
      'Roční období a příroda',
      'Lidské tělo a zdraví',
    ]
  },
};

export function SubjectPromo({ subject, subjectLabel, needsSchoolConnection = false }: SubjectPromoProps) {
  const navigate = useNavigate();
  const subjectInfo = SUBJECT_FEATURES[subject] || SUBJECT_FEATURES['fyzika'];
  
  // If user needs to connect to school, show a different header
  if (needsSchoolConnection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50/30">
        <div className="max-w-3xl mx-auto px-6 py-12">
          {/* School Connection Header */}
          <div className="text-center mb-12">
            <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <School className="w-12 h-12 text-orange-500" />
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              Pro zobrazení {subjectLabel} se propojte se školou
            </h1>
            
            <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
              Pro přístup k předmětům a materiálům se nejprve propojte se svou školou pomocí kódu učitele nebo žáka.
            </p>
          </div>

          {/* School Connection Card */}
          <div className="max-w-md mx-auto mb-8">
            <div className="bg-white rounded-2xl p-8 border-2 border-orange-200 shadow-lg text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <School className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Propojit se školou</h3>
              <p className="text-slate-500 text-sm mb-6">
                Zadejte kód školy, který jste dostali od vedení školy nebo kolegy
              </p>
              <button 
                onClick={() => navigate('/library/profile?section=ucet')}
                className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors"
              >
                Zadat kód školy
              </button>
              
              {/* Homeschooler link */}
              <button 
                onClick={() => navigate('/library/profile?section=ucet')}
                className="mt-4 text-sm text-slate-500 hover:text-slate-700 hover:underline transition-colors"
              >
                Vzdělávám se doma → Přihlásit jako domškolák
              </button>
            </div>
          </div>

          {/* Info about what's inside */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              Co najdete v předmětu {subjectLabel}:
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {subjectInfo.features.slice(0, 4).map((feature, index) => (
                <div key={index} className="flex items-start gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium mb-6">
            <Shield className="w-4 h-4" />
            Schváleno MŠMT
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
            {subjectLabel}
          </h1>
          
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            {subjectInfo.description}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-4 mb-12">
          {subjectInfo.features.map((feature, index) => (
            <div 
              key={index}
              className="flex items-start gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
              <span className="text-slate-700">{feature}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-white rounded-xl p-5 border border-slate-200 text-center">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold text-slate-800">100+</div>
            <div className="text-sm text-slate-500">Interaktivních lekcí</div>
          </div>
          
          <div className="bg-white rounded-xl p-5 border border-slate-200 text-center">
            <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Play className="w-6 h-6 text-violet-600" />
            </div>
            <div className="text-2xl font-bold text-slate-800">50+</div>
            <div className="text-sm text-slate-500">Animací a videí</div>
          </div>
          
          <div className="bg-white rounded-xl p-5 border border-slate-200 text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-slate-800">200+</div>
            <div className="text-sm text-slate-500">Cvičení a testů</div>
          </div>
          
          <div className="bg-white rounded-xl p-5 border border-slate-200 text-center">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <GraduationCap className="w-6 h-6 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-slate-800">4</div>
            <div className="text-sm text-slate-500">Ročníky ZŠ</div>
          </div>
        </div>

        {/* CTA Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* Trial */}
          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-6 text-white shadow-xl">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-4">
              <Clock className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold mb-2">Vyzkoušejte zdarma</h3>
            <p className="text-white/80 text-sm mb-4">
              14 dní plný přístup ke všem materiálům bez závazků
            </p>
            <button className="w-full py-3 bg-white text-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 transition-colors">
              Spustit zkušební verzi
            </button>
          </div>

          {/* Purchase */}
          <div className="bg-white rounded-2xl p-6 border-2 border-slate-200 shadow-lg">
            <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
              <ShoppingCart className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Zakoupit licenci</h3>
            <p className="text-slate-500 text-sm mb-4">
              Získejte plný přístup pro celou školu nebo jako jednotlivec
            </p>
            <button className="w-full py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors">
              Zobrazit ceník
            </button>
          </div>

          {/* Invite */}
          <div className="bg-white rounded-2xl p-6 border-2 border-slate-200 shadow-lg">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Pozvat kolegy</h3>
            <p className="text-slate-500 text-sm mb-4">
              Sdílejte Vividbooks s kolegy a učte společně
            </p>
            <button className="w-full py-3 border-2 border-blue-200 text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-colors">
              Pozvat do {subjectLabel}
            </button>
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-500" />
            <span>Doložka MŠMT</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-500" />
            <span>Soulad s RVP</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            <span>500+ škol v ČR</span>
          </div>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-amber-500" />
            <span>50 000+ žáků</span>
          </div>
        </div>
      </div>
    </div>
  );
}


