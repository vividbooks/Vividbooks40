import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase/client';
import { UserStats, UserOnboarding } from '../../types/analytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CheckCircle2, Circle, Clock, FileText, Layout, BookOpen, BrainCircuit } from 'lucide-react';

export function MyStatistics() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [onboarding, setOnboarding] = useState<UserOnboarding | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    loadData();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        loadData();
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      setIsAuthenticated(true);

      const [statsRes, onboardingRes] = await Promise.all([
        supabase.from('user_stats').select('*').eq('user_id', user.id).single(),
        supabase.from('user_onboarding').select('*').eq('user_id', user.id).single()
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (onboardingRes.data) setOnboarding(onboardingRes.data);
    } catch (err) {
      console.error('Error loading statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Načítám statistiky...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-amber-800 mb-2">Přihlaste se pro zobrazení statistik</h2>
          <p className="text-amber-600">Pro zobrazení vašich statistik se prosím přihlaste.</p>
        </div>
      </div>
    );
  }

  const chartData = [
    { name: 'Lekce', value: stats?.lessons_opened || 0 },
    { name: 'Dokumenty', value: stats?.documents_created || 0 },
    { name: 'Worksheety', value: stats?.worksheets_created || 0 },
    { name: 'Boardy', value: stats?.boards_created || 0 },
  ];

  const onboardingSteps = [
    { key: 'opened_lesson', label: 'Otevřít lekci' },
    { key: 'edited_lesson', label: 'Upravit lekci' },
    { key: 'used_ai_teach_me', label: 'Vyzkoušet AI "Nauč mě"' },
    { key: 'opened_workbook', label: 'Otevřít pracovní sešit' },
    { key: 'created_document', label: 'Vytvořit dokument' },
    { key: 'created_worksheet', label: 'Vytvořit pracovní list' },
  ];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold text-slate-800">Moje statistiky</h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium">Čas v aplikaci</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {Math.round((stats?.total_time_minutes || 0) / 60)} <span className="text-lg font-normal text-slate-400">hod</span>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <BrainCircuit className="w-5 h-5" />
            <span className="text-sm font-medium">AI Tokeny</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {stats?.ai_tokens_used || 0}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Layout className="w-5 h-5" />
            <span className="text-sm font-medium">Aktivita</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {stats?.percentile_rank || 0}<span className="text-lg">%</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Percentil mezi učiteli</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <FileText className="w-5 h-5" />
            <span className="text-sm font-medium">Materiály</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {(stats?.documents_created || 0) + (stats?.worksheets_created || 0)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Activity Chart */}
        <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">Přehled tvorby</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" fill="#4E5871" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Onboarding Checklist */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">Začínáme</h2>
          <div className="space-y-4">
            {onboardingSteps.map((step) => {
              const isCompleted = onboarding ? (onboarding as any)[step.key] : false;
              return (
                <div key={step.key} className="flex items-center gap-3">
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-200 shrink-0" />
                  )}
                  <span className={`text-sm ${isCompleted ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          
          {onboarding && Object.values(onboarding).filter(v => v === true).length === 6 && (
            <div className="mt-6 p-4 bg-emerald-50 rounded-lg text-emerald-700 text-sm font-medium text-center">
              🎉 Skvělá práce! Máte splněno.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

