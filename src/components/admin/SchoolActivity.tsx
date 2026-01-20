import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase/client';
import { SchoolStats, CSTask } from '../../types/analytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, School, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

export function SchoolActivity() {
  const [schools, setSchools] = useState<SchoolStats[]>([]);
  const [tasks, setTasks] = useState<CSTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [schoolsRes, tasksRes] = await Promise.all([
        supabase.from('school_stats').select('*').order('total_ai_cost_cents', { ascending: false }),
        supabase.from('cs_tasks').select('*').order('priority', { ascending: false }).limit(20)
      ]);

      if (schoolsRes.data) setSchools(schoolsRes.data);
      if (tasksRes.data) setTasks(tasksRes.data);
    } catch (err) {
      console.error('Error loading admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSchools = schools.filter(s => 
    // Usually we would join with school name, but here we just have ID
    // Assuming we might have fetched school names separately or joined in query
    // For now filtering by ID
    s.school_id.includes(filter)
  );

  if (loading) {
    return <div className="p-8 text-center">Načítám data...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Aktivita škol</h1>
        <div className="flex gap-2">
          <Input 
            placeholder="Hledat školu..." 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-64"
          />
          <Button variant="outline" size="icon">
            <Search className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Stats - Schools List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Přehled škol</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">ID Školy</th>
                    <th className="px-4 py-3">Učitelé</th>
                    <th className="px-4 py-3">Aktivní (7d)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 rounded-r-lg">AI Náklady</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSchools.map((school) => (
                    <tr key={school.school_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium font-mono text-xs">{school.school_id.substring(0, 8)}...</td>
                      <td className="px-4 py-3">{school.total_teachers}</td>
                      <td className="px-4 py-3 text-emerald-600 font-medium">{school.active_teachers_7d}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          school.activity_level === 'very_active' ? 'bg-emerald-100 text-emerald-700' :
                          school.activity_level === 'active' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {school.activity_level}
                        </span>
                      </td>
                      <td className="px-4 py-3">{(school.total_ai_cost_cents / 100).toFixed(2)} $</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* AI CS Agent Tasks */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                CS Agent Úkoly
              </h2>
              <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                AI Powered
              </span>
            </div>
            
            <div className="space-y-4">
              {tasks.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Žádné úkoly k řešení.</p>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="p-4 rounded-lg bg-slate-50 border border-slate-100 hover:border-amber-200 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-slate-800 text-sm">{task.title}</h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        task.priority >= 4 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        P{task.priority}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">{task.ai_reasoning}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs w-full">Detail</Button>
                      <Button size="sm" className="h-7 text-xs w-full bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Vyřešit
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


