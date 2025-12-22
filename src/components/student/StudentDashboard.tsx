/**
 * Student Dashboard
 * 
 * Main page for logged-in students showing their progress, recent results, and upcoming work.
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  GraduationCap, 
  Trophy, 
  TrendingUp, 
  BookOpen, 
  Play,
  LogOut,
  User,
  BarChart3,
  Calendar,
  Clock,
  CheckCircle,
  Target
} from 'lucide-react';
import { useStudentAuth } from '../../contexts/StudentAuthContext';

export function StudentDashboard() {
  const navigate = useNavigate();
  const { student, logout, loading } = useStudentAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/student/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg">
          <User className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Nejsi přihlášen/a</h2>
          <p className="text-slate-600 mb-4">Pro zobrazení dashboardu se musíš přihlásit.</p>
          <Link
            to="/student/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Přihlásit se
          </Link>
        </div>
      </div>
    );
  }

  // Demo stats
  const stats = {
    averageScore: 78,
    completedTests: 12,
    completedPractice: 24,
    streak: 5,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-indigo-600" />
                </div>
                <span className="text-xl font-bold text-slate-800" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                  Vividbooks
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Student info */}
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: student.color }}
                >
                  {student.initials}
                </div>
                <div className="hidden sm:block">
                  <p className="font-medium text-slate-800">{student.name}</p>
                  <p className="text-sm text-slate-500">{student.class_name}</p>
                </div>
              </div>
              
              <button
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title="Odhlásit se"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
            Ahoj, {student.name.split(' ')[0]}! 👋
          </h1>
          <p className="text-slate-600">
            Připraven/a na další učení? Tady je přehled tvých výsledků.
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
              <Trophy className="w-6 h-6 text-indigo-600" />
            </div>
            <p className="text-3xl font-bold text-slate-800">{stats.averageScore}%</p>
            <p className="text-sm text-slate-500">Průměrné skóre</p>
          </div>
          
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-slate-800">{stats.completedTests}</p>
            <p className="text-sm text-slate-500">Dokončených testů</p>
          </div>
          
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
              <Target className="w-6 h-6 text-amber-600" />
            </div>
            <p className="text-3xl font-bold text-slate-800">{stats.completedPractice}</p>
            <p className="text-sm text-slate-500">Procvičování</p>
          </div>
          
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-pink-600" />
            </div>
            <p className="text-3xl font-bold text-slate-800">{stats.streak} dní</p>
            <p className="text-sm text-slate-500">Série učení</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Practice */}
          <Link
            to="/docs/knihovna-vividbooks/introduction"
            className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white hover:from-indigo-600 hover:to-purple-700 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">Procvičovat</h3>
                <p className="text-white/80">Otevři knihovnu a začni se učit</p>
              </div>
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <BookOpen className="w-7 h-7" />
              </div>
            </div>
          </Link>
          
          {/* Join session */}
          <Link
            to="/quiz/join"
            className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white hover:from-emerald-600 hover:to-teal-700 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">Připojit se k testu</h3>
                <p className="text-white/80">Zadej kód od učitele</p>
              </div>
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play className="w-7 h-7" />
              </div>
            </div>
          </Link>
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-indigo-600" />
              Poslední aktivita
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {/* Demo activities */}
            {[
              { title: 'Newtonovy zákony - Test', score: 85, date: 'Včera', type: 'test' },
              { title: 'Síla a pohyb - Procvičování', score: 72, date: 'Před 2 dny', type: 'practice' },
              { title: 'Hmota - Samostatná práce', score: 90, date: 'Před 3 dny', type: 'individual' },
            ].map((activity, index) => (
              <div key={index} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      activity.type === 'test' ? 'bg-indigo-100' : 
                      activity.type === 'practice' ? 'bg-emerald-100' : 'bg-amber-100'
                    }`}>
                      {activity.type === 'test' ? <CheckCircle className="w-5 h-5 text-indigo-600" /> :
                       activity.type === 'practice' ? <Target className="w-5 h-5 text-emerald-600" /> :
                       <BookOpen className="w-5 h-5 text-amber-600" />}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{activity.title}</p>
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {activity.date}
                      </p>
                    </div>
                  </div>
                  <div className={`px-4 py-2 rounded-xl font-bold ${
                    activity.score >= 80 ? 'bg-emerald-100 text-emerald-700' :
                    activity.score >= 60 ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {activity.score}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}



