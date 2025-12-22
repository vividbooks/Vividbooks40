import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Trophy, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Star, 
  Flame,
  ChevronRight,
  FileText,
  MessageSquare,
  Award,
  TrendingUp,
  Calendar,
  User,
  GraduationCap,
  Menu,
  X,
  Sun,
  Moon,
  Folder
} from 'lucide-react';
import VividLogo from '../imports/Group70';
import { ToolsMenu } from './ToolsMenu';
import { ToolsDropdown } from './ToolsDropdown';
import { useViewMode, MOCK_STUDENT } from '../contexts/ViewModeContext';
import { getEvaluationsForStudent, SavedEvaluation } from '../utils/ai-formative-assessment';

interface StudentWallLayoutProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export function StudentWallLayout({ theme, toggleTheme }: StudentWallLayoutProps) {
  const navigate = useNavigate();
  const { 
    currentStudent, 
    studentAssignments, 
    studentTestResults, 
    studentEvaluations,
    studentActivities,
    isStudent,
    sharedFolders 
  } = useViewMode();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [quizEvaluations, setQuizEvaluations] = useState<SavedEvaluation[]>([]);

  // Load quiz evaluations for current student
  useEffect(() => {
    if (currentStudent?.id) {
      // Pass both ID and name for matching (name as fallback for Firebase/Supabase ID mismatch)
      const evaluations = getEvaluationsForStudent(currentStudent.id, currentStudent.name);
      setQuizEvaluations(evaluations);
    }
  }, [currentStudent?.id, currentStudent?.name]);

  // Redirect if not in student mode
  useEffect(() => {
    if (!isStudent) {
      navigate('/docs/fyzika');
    }
  }, [isStudent, navigate]);

  const student = currentStudent || MOCK_STUDENT;
  const pendingAssignments = studentAssignments.filter(a => !a.completed);
  const completedAssignments = studentAssignments.filter(a => a.completed);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Dnes';
    if (diffDays === 1) return 'Zítra';
    if (diffDays === -1) return 'Včera';
    if (diffDays > 0 && diffDays < 7) return `Za ${diffDays} dní`;
    
    return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
  };

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffHours < 1) return 'Právě teď';
    if (diffHours < 24) return `Před ${diffHours}h`;
    if (diffDays === 1) return 'Včera';
    if (diffDays < 7) return `Před ${diffDays} dny`;
    
    return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case '1': return 'text-emerald-600 bg-emerald-100';
      case '2': return 'text-green-600 bg-green-100';
      case '3': return 'text-yellow-600 bg-yellow-100';
      case '4': return 'text-orange-600 bg-orange-100';
      case '5': return 'text-red-600 bg-red-100';
      default: return 'text-slate-600 bg-slate-100';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'lesson_completed': return <BookOpen className="w-4 h-4 text-indigo-500" />;
      case 'test_completed': return <Trophy className="w-4 h-4 text-amber-500" />;
      case 'assignment_submitted': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'material_viewed': return <FileText className="w-4 h-4 text-blue-500" />;
      default: return <Star className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
      {/* Sidebar */}
      <aside 
        className={`
          fixed top-0 left-0 bottom-0 z-30 w-[294px]
          ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
          lg:sticky lg:translate-x-0 lg:shadow-none lg:w-[312px]
          ${toolsOpen ? 'bg-[#4E5871]' : 'bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700'}
        `}
      >
        <div className={`w-[294px] lg:w-[312px] h-full flex flex-col min-w-[294px] lg:min-w-[312px] ${toolsOpen ? 'bg-[#4E5871]' : 'bg-white dark:bg-slate-800'}`}>
          {/* Header */}
          <div className={`p-4 ${toolsOpen ? '' : 'border-b border-slate-200 dark:border-slate-700'}`}>
            {toolsOpen ? (
              <div className="flex items-center justify-between min-h-[40px] animate-in fade-in duration-200">
                <span className="text-white/90 font-bold text-[12px] uppercase tracking-wider pl-1">
                  Naše produkty
                </span>
                <button
                  onClick={() => setToolsOpen(false)}
                  className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/90"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <div className="flex items-center justify-center min-h-[40px] w-20">
                    <div className="w-20 h-10 text-[#4E5871] dark:text-white">
                      <VividLogo />
                    </div>
                  </div>
                  <ToolsDropdown 
                    isOpen={toolsOpen} 
                    onToggle={() => setToolsOpen(!toolsOpen)} 
                    label="Moje zeď"
                    variant="green"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="lg:hidden p-1.5 rounded-md transition-colors text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tools Menu or Sidebar Content */}
          <div className="flex-1 overflow-y-auto">
            {toolsOpen ? (
              <ToolsMenu 
                onClose={() => setToolsOpen(false)} 
                onItemClick={() => setSidebarOpen(false)}
                isStudentMode={true}
              />
            ) : (
              <div className="p-4">
                {/* Student Profile Card */}
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold">{student.name}</h3>
                      <p className="text-sm text-white/80">{student.className} • {student.grade}. ročník</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white/10 rounded-lg p-2">
                      <div className="text-lg font-bold">{student.stats?.completedLessons || 0}</div>
                      <div className="text-xs text-white/70">Lekcí</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-2">
                      <div className="text-lg font-bold">{student.stats?.averageScore || 0}%</div>
                      <div className="text-xs text-white/70">Průměr</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-2">
                      <div className="text-lg font-bold flex items-center justify-center gap-1">
                        <Flame className="w-4 h-4 text-orange-300" />
                        {student.stats?.streakDays || 0}
                      </div>
                      <div className="text-xs text-white/70">Série</div>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="space-y-2 mb-6">
                  <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors">
                    <Clock className="w-5 h-5" />
                    <span className="flex-1 text-left text-sm font-medium">{pendingAssignments.length} čekající úkoly</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  
                  <button 
                    onClick={() => navigate('/docs/fyzika')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <BookOpen className="w-5 h-5" />
                    <span className="flex-1 text-left text-sm font-medium">Pokračovat v učení</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Recent Activity */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Poslední aktivita</h4>
                  <div className="space-y-2">
                    {studentActivities.slice(0, 4).map((activity) => (
                      <div key={activity.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        {getActivityIcon(activity.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{activity.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{activity.subjectName}</p>
                        </div>
                        <span className="text-xs text-slate-400">{formatRelativeDate(activity.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-slate-800 dark:text-white">Moje zeď</span>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>

        {/* Content */}
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">
              Ahoj, {student.name.split(' ')[0]}! 👋
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Tady najdeš své úkoly, výsledky a hodnocení od učitelů.
            </p>
          </div>

          {/* Shared Folders from Teachers */}
          {sharedFolders.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Folder className="w-5 h-5 text-emerald-500" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Materiály od učitelů</h2>
                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-full">
                  {sharedFolders.length}
                </span>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sharedFolders.map((folder) => (
                  <button 
                    key={folder.id}
                    onClick={() => navigate(`/library/student-wall/folder/${folder.id}`)}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all cursor-pointer text-left group"
                  >
                    <div className="flex items-start gap-4">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform relative"
                        style={{ backgroundColor: folder.color }}
                      >
                        <Folder className="w-6 h-6 text-slate-700" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-800 dark:text-white truncate mb-1">
                          {folder.name}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {folder.itemCount} {folder.itemCount === 1 ? 'položka' : folder.itemCount < 5 ? 'položky' : 'položek'}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          Od: {folder.sharedBy}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 shrink-0 mt-3" />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Pending Assignments */}
          {pendingAssignments.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Nové úkoly</h2>
                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-full">
                  {pendingAssignments.length}
                </span>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pendingAssignments.map((assignment) => (
                  <div 
                    key={assignment.id}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        assignment.type === 'lesson' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' :
                        assignment.type === 'worksheet' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' :
                        assignment.type === 'test' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
                        'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                      }`}>
                        {assignment.type === 'lesson' ? 'Lekce' :
                         assignment.type === 'worksheet' ? 'Pracovní list' :
                         assignment.type === 'test' ? 'Test' : 'Materiál'}
                      </div>
                      {assignment.dueDate && (
                        <span className={`text-xs font-medium ${
                          new Date(assignment.dueDate) < new Date() 
                            ? 'text-red-500' 
                            : 'text-slate-500 dark:text-slate-400'
                        }`}>
                          {formatDate(assignment.dueDate)}
                        </span>
                      )}
                    </div>
                    
                    <h3 className="font-semibold text-slate-800 dark:text-white mb-1">{assignment.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{assignment.subjectName}</p>
                    
                    {assignment.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 line-clamp-2">{assignment.description}</p>
                    )}
                    
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                      <span className="text-xs text-slate-400">Od: {assignment.assignedBy}</span>
                      <button className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700">
                        Otevřít →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Test Results */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Výsledky testů</h2>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {studentTestResults.map((result) => (
                  <div key={result.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${getGradeColor(result.grade || '')}`}>
                        {result.grade || '-'}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-800 dark:text-white">{result.testName}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{result.subjectName}</p>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-semibold text-slate-800 dark:text-white">{result.percentage}%</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{result.score}/{result.maxScore} bodů</div>
                      </div>
                      
                      <div className="text-xs text-slate-400 w-20 text-right">
                        {formatRelativeDate(result.completedAt)}
                      </div>
                    </div>
                    
                    {result.teacherComment && (
                      <div className="mt-3 ml-16 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5" />
                          <p className="text-sm text-slate-600 dark:text-slate-300">{result.teacherComment}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Quiz Formative Evaluations */}
          {quizEvaluations.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-5 h-5 text-purple-500" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Formativní hodnocení z testů</h2>
              </div>
              
              <div className="space-y-4">
                {quizEvaluations.map((evaluation) => (
                  <div 
                    key={evaluation.id}
                    className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 rounded-2xl border border-violet-100 dark:border-violet-800 p-5"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800 dark:text-white">{evaluation.quizTitle}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{evaluation.subjectName}</p>
                      </div>
                      <div className="ml-auto text-xs text-slate-400">
                        {formatRelativeDate(evaluation.sharedAt || evaluation.createdAt)}
                      </div>
                    </div>
                    
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                      {evaluation.assessment}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          
          {/* Teacher Evaluations */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-violet-500" />
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Hodnocení od učitelů</h2>
            </div>
            
            <div className="space-y-3">
              {studentEvaluations.map((evaluation) => (
                <div 
                  key={evaluation.id}
                  className={`p-4 rounded-xl border ${
                    evaluation.type === 'praise' 
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' 
                      : evaluation.type === 'warning'
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      evaluation.type === 'praise' 
                        ? 'bg-emerald-100 dark:bg-emerald-900/50' 
                        : evaluation.type === 'warning'
                        ? 'bg-amber-100 dark:bg-amber-900/50'
                        : 'bg-blue-100 dark:bg-blue-900/50'
                    }`}>
                      {evaluation.type === 'praise' ? (
                        <Star className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : evaluation.type === 'warning' ? (
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <p className="text-slate-800 dark:text-white">{evaluation.message}</p>
                      <div className="flex items-center gap-2 mt-2 text-sm text-slate-500 dark:text-slate-400">
                        <span>{evaluation.teacherName}</span>
                        <span>•</span>
                        <span>{evaluation.subjectName}</span>
                        <span>•</span>
                        <span>{formatRelativeDate(evaluation.date)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Completed Assignments */}
          {completedAssignments.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Splněné úkoly</h2>
              </div>
              
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                {completedAssignments.map((assignment) => (
                  <div key={assignment.id} className="p-4 flex items-center gap-4">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-800 dark:text-white">{assignment.title}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{assignment.subjectName}</p>
                    </div>
                    <span className="text-sm text-slate-400">
                      {assignment.completedAt && formatRelativeDate(assignment.completedAt)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}




