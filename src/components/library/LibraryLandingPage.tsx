import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book, LayoutGrid, Atom, FlaskConical, Leaf, Calculator, FileText, Sprout, ChevronRight, Sparkles, GraduationCap, Users, Settings } from 'lucide-react';
import { CategoryOverview } from '../admin/CategoryOverview';
import { TeacherAssistant } from './TeacherAssistant';
import { Button } from '../ui/button';

interface LibraryLandingPageProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const SUBJECTS = [
  { id: 'fyzika', label: 'Fyzika', icon: Atom, color: '#8B5CF6', description: '6. – 9. ročník základní školy' },
  { id: 'matematika', label: 'Matematika', icon: Calculator, color: '#F97316', description: '1. a 2. stupeň základní školy' },
  { id: 'biologie', label: 'Biologie', icon: Leaf, color: '#10B981', description: 'Připravujeme pro vás' },
  { id: 'chemie', label: 'Chemie', icon: FlaskConical, color: '#3B82F6', description: 'Připravujeme pro vás' },
];

export function LibraryLandingPage({ theme, toggleTheme }: LibraryLandingPageProps) {
  const navigate = useNavigate();
  const [showAssistant, setShowAssistant] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header / Top Bar */}
      <header className="h-16 border-b border-border bg-card/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
            VB
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">Vividbooks</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Knihovna</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAssistant(!showAssistant)}
            className={`gap-2 rounded-xl transition-all ${showAssistant ? 'bg-indigo-500/10 text-indigo-600' : ''}`}
          >
            <Sparkles className={`w-4 h-4 ${showAssistant ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">AI Asistent</span>
          </Button>
          
          {/* Dark mode toggle removed */}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Welcome Message */}
          <div className="mb-10">
            <h2 className="text-3xl font-bold mb-2">Vítejte zpět! 👋</h2>
            <p className="text-muted-foreground">Který předmět budeme dnes prozkoumávat?</p>
          </div>

          {/* Subjects Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {SUBJECTS.map((subject) => (
              <button
                key={subject.id}
                onClick={() => navigate(`/docs/${subject.id}`)}
                className="group relative flex flex-col p-6 rounded-3xl bg-card border border-border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left overflow-hidden"
              >
                {/* Background Decor */}
                <div 
                  className="absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-5 group-hover:opacity-10 transition-opacity"
                  style={{ backgroundColor: subject.color }}
                />
                
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${subject.color}15`, color: subject.color }}
                >
                  <subject.icon className="w-7 h-7" />
                </div>
                
                <h3 className="text-xl font-bold mb-1">{subject.label}</h3>
                <p className="text-sm text-muted-foreground">{subject.description}</p>
                
                <div className="mt-8 flex items-center gap-2 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0">
                  <span style={{ color: subject.color }}>Otevřít předmět</span>
                  <ChevronRight className="w-4 h-4" style={{ color: subject.color }} />
                </div>
              </button>
            ))}
          </div>

          {/* Quick Actions / Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="p-8 rounded-3xl bg-card border border-border shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-500" />
                  Moje třídy a aktivita
                </h3>
                <div className="space-y-4">
                  {[
                    { class: '9.C', task: 'Elektrický proud', status: '82% odevzdáno', color: 'bg-emerald-500' },
                    { class: '8.A', task: 'Atomy a molekuly', status: 'Rozpracováno', color: 'bg-amber-500' },
                    { class: '6.B', task: 'Hustota látek', status: 'Čeká na kontrolu', color: 'bg-indigo-500' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-accent/30 hover:bg-accent/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full ${item.color} flex items-center justify-center text-white font-bold text-xs`}>
                          {item.class}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{item.task}</p>
                          <p className="text-xs text-muted-foreground">{item.class} • {item.status}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
                <Button variant="ghost" className="w-full mt-4 rounded-xl text-indigo-500 hover:text-indigo-600 hover:bg-indigo-500/5">
                  Zobrazit všechny třídy
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-8 rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 overflow-hidden relative group">
                {/* Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-700" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />
                
                <div className="relative z-10">
                  <Sparkles className="w-10 h-10 mb-6 text-indigo-200" />
                  <h3 className="text-xl font-bold mb-2">Potřebujete pomoct s přípravou?</h3>
                  <p className="text-indigo-100 text-sm mb-6 leading-relaxed">
                    Náš AI asistent vám pomůže naplánovat hodinu, zadat úkol nebo analyzovat výsledky testů.
                  </p>
                  <Button 
                    onClick={() => setShowAssistant(true)}
                    className="w-full bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl font-bold"
                  >
                    Vyzkoušet asistenta
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* AI Assistant Sidebar / Overlay */}
      {showAssistant && (
        <TeacherAssistant onClose={() => setShowAssistant(false)} />
      )}
    </div>
  );
}


