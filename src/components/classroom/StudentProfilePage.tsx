import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Trophy, TrendingUp, TrendingDown, Minus, Calendar,
  CheckCircle, XCircle, Clock, BookOpen, User, Star, MessageSquare,
  ChevronRight, Award, Target, Zap, FileText
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { cs } from 'date-fns/locale';

// Types
interface StudentResult {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  assignmentType: 'test' | 'practice' | 'individual';
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  totalQuestions: number;
  completedAt: string;
  timeSpentMs?: number;
  teacherComment?: string;
  boardId?: string;
}

interface StudentProfile {
  id: string;
  name: string;
  initials: string;
  color: string;
  classId: string;
  className: string;
  averageScore: number;
  totalTests: number;
  totalPractice: number;
  totalIndividual: number;
  trend: 'up' | 'down' | 'stable';
  results: StudentResult[];
}

// Demo data generator
function generateDemoStudentProfile(studentId: string): StudentProfile {
  const names = [
    { name: 'Jan Novák', initials: 'JN', color: '#6366F1' },
    { name: 'Marie Svobodová', initials: 'MS', color: '#EC4899' },
    { name: 'Petr Dvořák', initials: 'PD', color: '#10B981' },
    { name: 'Anna Černá', initials: 'AC', color: '#F59E0B' },
    { name: 'Tomáš Procházka', initials: 'TP', color: '#8B5CF6' },
  ];
  
  const studentIndex = parseInt(studentId.replace(/\D/g, '')) % names.length || 0;
  const student = names[studentIndex];
  
  const results: StudentResult[] = [
    { id: 'r1', assignmentId: 'a1', assignmentTitle: 'Závěrečný test - Teplo a teplota', assignmentType: 'test', score: 8, maxScore: 10, percentage: 80, correctCount: 8, totalQuestions: 10, completedAt: '2024-12-15T10:30:00Z', timeSpentMs: 1200000, teacherComment: 'Výborná práce!', boardId: 'board_teplo' },
    { id: 'r2', assignmentId: 'a2', assignmentTitle: 'Práce a energie', assignmentType: 'test', score: 6, maxScore: 10, percentage: 60, correctCount: 6, totalQuestions: 10, completedAt: '2024-12-10T09:15:00Z', timeSpentMs: 900000, boardId: 'board_prace' },
    { id: 'r3', assignmentId: 'a3', assignmentTitle: 'Newtonovy zákony', assignmentType: 'test', score: 9, maxScore: 10, percentage: 90, correctCount: 9, totalQuestions: 10, completedAt: '2024-12-05T11:00:00Z', teacherComment: 'Skvělý výsledek!', boardId: 'board_newton' },
    { id: 'r4', assignmentId: 'a4', assignmentTitle: 'Procvičování - Síla', assignmentType: 'practice', score: 7, maxScore: 10, percentage: 70, correctCount: 7, totalQuestions: 10, completedAt: '2024-12-08T14:20:00Z', boardId: 'board_sila' },
    { id: 'r5', assignmentId: 'a5', assignmentTitle: 'Procvičování - Energie', assignmentType: 'practice', score: 8, maxScore: 10, percentage: 80, correctCount: 8, totalQuestions: 10, completedAt: '2024-12-01T16:45:00Z', boardId: 'board_energie' },
    { id: 'r6', assignmentId: 'i1', assignmentTitle: 'Hmota - samostatné', assignmentType: 'individual', score: 9, maxScore: 10, percentage: 90, correctCount: 9, totalQuestions: 10, completedAt: '2024-12-14T18:30:00Z', boardId: 'board_hmota' },
    { id: 'r7', assignmentId: 'i2', assignmentTitle: 'Síla - samostatné', assignmentType: 'individual', score: 7, maxScore: 10, percentage: 70, correctCount: 7, totalQuestions: 10, completedAt: '2024-12-12T20:15:00Z', boardId: 'board_sila' },
    { id: 'r8', assignmentId: 'i3', assignmentTitle: 'Newton - samostatné', assignmentType: 'individual', score: 10, maxScore: 10, percentage: 100, correctCount: 10, totalQuestions: 10, completedAt: '2024-12-06T19:00:00Z', boardId: 'board_newton' },
  ];
  
  const testResults = results.filter(r => r.assignmentType === 'test');
  const practiceResults = results.filter(r => r.assignmentType === 'practice');
  const individualResults = results.filter(r => r.assignmentType === 'individual');
  
  const allScores = results.map(r => r.percentage);
  const averageScore = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
  
  const sortedResults = [...results].sort((a, b) => parseISO(b.completedAt).getTime() - parseISO(a.completedAt).getTime());
  
  return {
    id: studentId, name: student.name, initials: student.initials, color: student.color,
    classId: '1', className: '6.A', averageScore, totalTests: testResults.length,
    totalPractice: practiceResults.length, totalIndividual: individualResults.length, trend: 'up', results: sortedResults,
  };
}

function getScoreColor(percentage: number): string {
  if (percentage >= 90) return '#10B981';
  if (percentage >= 70) return '#84CC16';
  if (percentage >= 50) return '#F59E0B';
  return '#EF4444';
}

function getScoreBgColor(percentage: number): string {
  if (percentage >= 90) return '#D1FAE5';
  if (percentage >= 70) return '#ECFCCB';
  if (percentage >= 50) return '#FEF3C7';
  return '#FEE2E2';
}

function formatTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return minutes + ' min';
  return Math.floor(minutes / 60) + 'h ' + (minutes % 60) + 'min';
}

function getAssignmentIcon(type: 'test' | 'practice' | 'individual') {
  switch (type) {
    case 'test': return <FileText className="w-5 h-5 text-indigo-600" />;
    case 'practice': return <Target className="w-5 h-5 text-emerald-600" />;
    case 'individual': return <Zap className="w-5 h-5 text-amber-500" />;
  }
}

function getAssignmentLabel(type: 'test' | 'practice' | 'individual') {
  switch (type) {
    case 'test': return 'Test';
    case 'practice': return 'Procvičování';
    case 'individual': return 'Samostatná práce';
  }
}

function ResultCard({ result, onViewDetail }: { result: StudentResult; onViewDetail: (r: StudentResult) => void }) {
  const isIndividual = result.assignmentType === 'individual';
  
  return (
    <div className={'bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md ' + (isIndividual ? 'opacity-80' : '')}>
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: getScoreBgColor(result.percentage) }}>
              {getAssignmentIcon(result.assignmentType)}
            </div>
            <div>
              <h3 className={'font-semibold text-slate-800 ' + (isIndividual ? 'text-sm' : 'text-base')}>{result.assignmentTitle}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ 
                  backgroundColor: isIndividual ? '#FEF3C7' : result.assignmentType === 'test' ? '#EEF2FF' : '#D1FAE5',
                  color: isIndividual ? '#92400E' : result.assignmentType === 'test' ? '#4338CA' : '#065F46',
                }}>{getAssignmentLabel(result.assignmentType)}</span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDistanceToNow(parseISO(result.completedAt), { addSuffix: true, locale: cs })}
                </span>
              </div>
            </div>
          </div>
          <div className="text-center px-4 py-2 rounded-xl" style={{ backgroundColor: getScoreBgColor(result.percentage) }}>
            <div className="text-2xl font-bold" style={{ color: getScoreColor(result.percentage) }}>{result.percentage}%</div>
            <div className="text-xs text-slate-500">{result.score}/{result.maxScore}</div>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 bg-slate-50 flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-slate-600">{result.correctCount} správně</span></div>
        <div className="flex items-center gap-2 text-sm"><XCircle className="w-4 h-4 text-red-400" /><span className="text-slate-600">{result.totalQuestions - result.correctCount} špatně</span></div>
        {result.timeSpentMs && <div className="flex items-center gap-2 text-sm"><Clock className="w-4 h-4 text-slate-400" /><span className="text-slate-600">{formatTime(result.timeSpentMs)}</span></div>}
      </div>
      {result.teacherComment && (
        <div className="px-4 py-3 border-t border-slate-100">
          <div className="flex items-start gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
            <div><span className="text-xs font-medium text-indigo-600">Hodnocení učitele:</span><p className="text-sm text-slate-700 mt-0.5">{result.teacherComment}</p></div>
          </div>
        </div>
      )}
      {result.boardId && !isIndividual && (
        <button onClick={() => onViewDetail(result)} className="w-full px-4 py-3 border-t border-slate-100 flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors">
          Zobrazit detail<ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function StudentProfilePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'test' | 'practice' | 'individual'>('all');
  
  useEffect(() => {
    if (studentId) { setProfile(generateDemoStudentProfile(studentId)); setLoading(false); }
  }, [studentId]);
  
  const filteredResults = useMemo(() => {
    if (!profile) return [];
    if (filter === 'all') return profile.results;
    return profile.results.filter(r => r.assignmentType === filter);
  }, [profile, filter]);
  
  const handleViewDetail = (result: StudentResult) => { console.log('View detail for:', result.assignmentTitle); };
  
  if (loading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;
  if (!profile) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><p className="text-slate-600">Student nenalezen</p></div>;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-4"><ArrowLeft className="w-5 h-5" /><span>Zpět</span></button>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden mb-6">
          <div className="h-24" style={{ background: 'linear-gradient(135deg, ' + profile.color + ' 0%, ' + profile.color + '99 100%)' }} />
          <div className="px-6 pb-6 -mt-12">
            <div className="flex items-end gap-4 mb-4">
              <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg border-4 border-white" style={{ backgroundColor: profile.color }}>{profile.initials}</div>
              <div className="pb-2"><h1 className="text-2xl font-bold text-slate-800">{profile.name}</h1><p className="text-slate-500 flex items-center gap-2"><BookOpen className="w-4 h-4" />Třída {profile.className}</p></div>
            </div>
            <div className="grid grid-cols-4 gap-3 mt-6">
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1"><span className="text-3xl font-bold text-indigo-600">{profile.averageScore}%</span>{profile.trend === 'up' && <TrendingUp className="w-5 h-5 text-emerald-500" />}{profile.trend === 'down' && <TrendingDown className="w-5 h-5 text-red-500" />}{profile.trend === 'stable' && <Minus className="w-5 h-5 text-slate-400" />}</div>
                <p className="text-xs text-slate-500">Průměr</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 text-center"><div className="text-2xl font-bold text-slate-800">{profile.totalTests}</div><p className="text-xs text-slate-500">Testů</p></div>
              <div className="bg-slate-50 rounded-2xl p-4 text-center"><div className="text-2xl font-bold text-slate-800">{profile.totalPractice}</div><p className="text-xs text-slate-500">Procvič.</p></div>
              <div className="bg-slate-50 rounded-2xl p-4 text-center"><div className="text-2xl font-bold text-slate-800">{profile.totalIndividual}</div><p className="text-xs text-slate-500">Samost.</p></div>
            </div>
            <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center"><Trophy className="w-6 h-6 text-white" /></div>
                <div><h3 className="font-semibold text-emerald-800">{profile.averageScore >= 80 ? 'Výborný výkon!' : profile.averageScore >= 60 ? 'Dobrá práce!' : 'Pokračuj v učení!'}</h3><p className="text-sm text-emerald-700">{profile.trend === 'up' ? 'Tvé výsledky se zlepšují 📈' : profile.trend === 'down' ? 'Zkus se více soustředit' : 'Udržuješ stabilní výkon'}</p></div>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-2 mb-6 flex gap-1">
          {[{ key: 'all', label: 'Vše', count: profile.results.length }, { key: 'test', label: 'Testy', count: profile.totalTests }, { key: 'practice', label: 'Procvičování', count: profile.totalPractice }, { key: 'individual', label: 'Samostatné', count: profile.totalIndividual }].map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key as any)} className={'flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ' + (filter === tab.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100')}>
              {tab.label}<span className={'text-xs px-1.5 py-0.5 rounded-full ' + (filter === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600')}>{tab.count}</span>
            </button>
          ))}
        </div>
        <div className="space-y-4 pb-8">
          {filteredResults.length === 0 ? (<div className="bg-white rounded-2xl p-8 text-center"><BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">Žádné výsledky v této kategorii</p></div>)
          : filteredResults.map(result => (<ResultCard key={result.id} result={result} onViewDetail={handleViewDetail} />))}
        </div>
      </div>
    </div>
  );
}

export default StudentProfilePage;
