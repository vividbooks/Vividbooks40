import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Trophy, TrendingUp, TrendingDown, Minus, Calendar,
  CheckCircle, XCircle, Clock, BookOpen, User, MessageSquare,
  ChevronRight, Target, Zap, FileText, X, PanelLeftClose, PanelLeft, Users
} from 'lucide-react';
import { parseISO, formatDistanceToNow } from 'date-fns';
import { cs } from 'date-fns/locale';
import VividLogo from '../../imports/Group70';
import { ToolsDropdown } from '../ToolsDropdown';
import { ToolsMenu } from '../ToolsMenu';

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

interface ClassStudent {
  id: string;
  name: string;
  initials: string;
  color: string;
  averageScore: number;
}

// Demo students for sidebar
const DEMO_CLASS_STUDENTS: ClassStudent[] = [
  { id: 's1', name: 'Jan Novák', initials: 'JN', color: '#6366F1', averageScore: 82 },
  { id: 's2', name: 'Marie Svobodová', initials: 'MS', color: '#EC4899', averageScore: 91 },
  { id: 's3', name: 'Petr Dvořák', initials: 'PD', color: '#10B981', averageScore: 75 },
  { id: 's4', name: 'Anna Černá', initials: 'AC', color: '#F59E0B', averageScore: 88 },
  { id: 's5', name: 'Tomáš Procházka', initials: 'TP', color: '#8B5CF6', averageScore: 67 },
  { id: 's6', name: 'Lucie Veselá', initials: 'LV', color: '#EF4444', averageScore: 79 },
  { id: 's7', name: 'Ondřej Němec', initials: 'ON', color: '#3B82F6', averageScore: 85 },
  { id: 's8', name: 'Karolína Marková', initials: 'KM', color: '#14B8A6', averageScore: 72 },
  { id: 's9', name: 'Filip Horák', initials: 'FH', color: '#F97316', averageScore: 64 },
  { id: 's10', name: 'Adéla Králová', initials: 'AK', color: '#A855F7', averageScore: 93 },
  { id: 's11', name: 'Jakub Kučera', initials: 'JK', color: '#22C55E', averageScore: 58 },
  { id: 's12', name: 'Tereza Pospíšilová', initials: 'TP', color: '#06B6D4', averageScore: 86 },
];

// Demo data generator
function generateDemoStudentProfile(studentId: string): StudentProfile {
  const student = DEMO_CLASS_STUDENTS.find(s => s.id === studentId) || DEMO_CLASS_STUDENTS[0];
  
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
  const sortedResults = [...results].sort((a, b) => parseISO(b.completedAt).getTime() - parseISO(a.completedAt).getTime());
  
  return {
    id: studentId, name: student.name, initials: student.initials, color: student.color,
    classId: '1', className: '6.A', averageScore: student.averageScore, totalTests: testResults.length,
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
  
  // Sidebar states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [toolsOpen, setToolsOpen] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);
  
  // Class students for sidebar
  const classStudents = DEMO_CLASS_STUDENTS;
  
  useEffect(() => {
    if (studentId) { 
      setProfile(generateDemoStudentProfile(studentId)); 
      setLoading(false); 
    }
  }, [studentId]);
  
  const filteredResults = useMemo(() => {
    if (!profile) return [];
    if (filter === 'all') return profile.results;
    return profile.results.filter(r => r.assignmentType === filter);
  }, [profile, filter]);
  
  const handleViewDetail = (result: StudentResult) => { 
    console.log('View detail for:', result.assignmentTitle); 
  };
  
  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
    </div>
  );
  
  if (!profile) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-slate-600">Student nenalezen</p>
    </div>
  );
  
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        {/* Left Sidebar - Green with student list */}
        <aside 
          className={`
            top-0 h-screen shrink-0 flex flex-col 
            transition-all duration-300 ease-in-out
            fixed left-0 z-30 w-[294px]
            ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
            lg:sticky lg:translate-x-0 lg:shadow-none lg:w-[312px]
          `}
          style={{ backgroundColor: '#084939' }}
        >
          <div 
            className="w-[294px] lg:w-[312px] h-full flex flex-col min-w-[294px] lg:min-w-[312px]"
            style={{ backgroundColor: '#084939' }}
          >
            {/* Header */}
            <div className="p-4" style={{ backgroundColor: toolsOpen ? '#4E5871' : undefined }}>
              {toolsOpen ? (
                <div className="flex items-center justify-between min-h-[40px] animate-in fade-in duration-200">
                  <span className="text-white/90 font-bold text-[12px] uppercase tracking-wider pl-1">Naše produkty</span>
                  <button onClick={() => setToolsOpen(false)} className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/90">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <div className="flex items-center justify-center min-h-[40px] w-20">
                      <Link to="/docs/knihovna-vividbooks/introduction" className="flex items-center">
                        <div className="w-20 h-10 text-white"><VividLogo /></div>
                      </Link>
                    </div>
                    <ToolsDropdown isOpen={toolsOpen} onToggle={() => setToolsOpen(!toolsOpen)} label="Moje třídy" variant="green" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-md transition-colors text-white/70 hover:text-white hover:bg-white/10">
                      <X className="h-5 w-5" />
                    </button>

                  </div>
                </div>
              )}
            </div>

            {/* Navigation Content */}
            <div className="flex-1 overflow-hidden text-white flex flex-col">
              {toolsOpen ? (
                <div className="h-full" style={{ backgroundColor: '#4E5871' }}>
                  <ToolsMenu activeItem="my-classes" onItemClick={() => { setToolsOpen(false); setSidebarOpen(false); }} />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {/* Back to class button */}
                  <div className="px-4 pb-3">
                    <button
                      onClick={() => navigate('/library/my-classes')}
                      className="flex items-center gap-2 text-white/70 hover:text-white text-sm py-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Zpět na třídy
                    </button>
                  </div>
                  
                  {/* Class name header */}
                  <div className="px-4 pb-3">
                    <div className="flex items-center gap-2 text-white">
                      <Users className="w-5 h-5" />
                      <span className="font-semibold">Třída {profile.className}</span>
                      <span className="text-white/60 text-sm">({classStudents.length} žáků)</span>
                    </div>
                  </div>
                  
                  {/* Student list */}
                  <div className="px-3 pb-20">
                    <div className="space-y-1">
                      {classStudents.map((student) => {
                        const isActive = student.id === studentId;
                        return (
                          <button
                            key={student.id}
                            onClick={() => navigate(`/library/student/${student.id}`)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                              isActive 
                                ? 'bg-white/20 text-white' 
                                : 'text-white/80 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <div 
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: student.color }}
                            >
                              {student.initials}
                            </div>
                            <span className="text-sm font-medium truncate flex-1 text-left">{student.name}</span>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                              student.averageScore >= 80 ? 'bg-emerald-500/20 text-emerald-300' :
                              student.averageScore >= 60 ? 'bg-amber-500/20 text-amber-300' :
                              'bg-red-500/20 text-red-300'
                            }`}>
                              {student.averageScore}%
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
        
        {/* Mobile menu toggle */}

        
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        
        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Mobile header */}
          <div className="lg:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-slate-100">
              <PanelLeft className="h-5 w-5 text-slate-600" />
            </button>
            <span className="font-medium text-slate-800">{profile.name}</span>
          </div>
          
          <div className="max-w-3xl mx-auto px-4 py-6">
            {/* Profile Card */}
            <div className="bg-white rounded-3xl shadow-lg overflow-hidden mb-6">
              <div className="h-24" style={{ background: 'linear-gradient(135deg, ' + profile.color + ' 0%, ' + profile.color + '99 100%)' }} />
              <div className="px-6 pb-6 -mt-12">
                <div className="flex items-end gap-4 mb-4">
                  <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg border-4 border-white" style={{ backgroundColor: profile.color }}>{profile.initials}</div>
                  <div className="pb-2">
                    <h1 className="text-2xl font-bold text-slate-800">{profile.name}</h1>
                    <p className="text-slate-500 flex items-center gap-2"><BookOpen className="w-4 h-4" />Třída {profile.className}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 mt-6">
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="text-3xl font-bold text-indigo-600">{profile.averageScore}%</span>
                      {profile.trend === 'up' && <TrendingUp className="w-5 h-5 text-emerald-500" />}
                      {profile.trend === 'down' && <TrendingDown className="w-5 h-5 text-red-500" />}
                      {profile.trend === 'stable' && <Minus className="w-5 h-5 text-slate-400" />}
                    </div>
                    <p className="text-xs text-slate-500">Průměr</p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4 text-center"><div className="text-2xl font-bold text-slate-800">{profile.totalTests}</div><p className="text-xs text-slate-500">Testů</p></div>
                  <div className="bg-slate-50 rounded-2xl p-4 text-center"><div className="text-2xl font-bold text-slate-800">{profile.totalPractice}</div><p className="text-xs text-slate-500">Procvič.</p></div>
                  <div className="bg-slate-50 rounded-2xl p-4 text-center"><div className="text-2xl font-bold text-slate-800">{profile.totalIndividual}</div><p className="text-xs text-slate-500">Samost.</p></div>
                </div>
                <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center"><Trophy className="w-6 h-6 text-white" /></div>
                    <div>
                      <h3 className="font-semibold text-emerald-800">{profile.averageScore >= 80 ? 'Výborný výkon!' : profile.averageScore >= 60 ? 'Dobrá práce!' : 'Pokračuj v učení!'}</h3>
                      <p className="text-sm text-emerald-700">{profile.trend === 'up' ? 'Tvé výsledky se zlepšují 📈' : profile.trend === 'down' ? 'Zkus se více soustředit' : 'Udržuješ stabilní výkon'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Filter tabs */}
            <div className="bg-white rounded-2xl shadow-sm p-2 mb-6 flex gap-1">
              {[
                { key: 'all', label: 'Vše', count: profile.results.length },
                { key: 'test', label: 'Testy', count: profile.totalTests },
                { key: 'practice', label: 'Procvičování', count: profile.totalPractice },
                { key: 'individual', label: 'Samostatné', count: profile.totalIndividual },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as any)}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    filter === tab.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
            
            {/* Results feed */}
            <div className="space-y-4 pb-8">
              {filteredResults.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center">
                  <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Žádné výsledky v této kategorii</p>
                </div>
              ) : (
                filteredResults.map(result => (
                  <ResultCard key={result.id} result={result} onViewDetail={handleViewDetail} />
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default StudentProfilePage;
