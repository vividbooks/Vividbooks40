/**
 * StudentWallLayout - Student's personal dashboard
 * 
 * Shows the same view as teachers see in StudentProfilePage:
 * - Test results with scores and teacher comments
 * - Formative assessments (shared by teacher)
 * - Shared folders from teachers
 * - Pending assignments
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  BookOpen, 
  Trophy, 
  Clock, 
  CheckCircle,
  XCircle, 
  AlertCircle, 
  Star, 
  Flame,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText,
  MessageSquare,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  User,
  GraduationCap,
  Menu,
  X,
  Sun,
  Moon,
  Folder,
  Target,
  Zap,
  LogOut,
  Loader2,
  Settings,
  BarChart3,
  Building
} from 'lucide-react';
import VividLogo from '../imports/Group70';
import { ToolsMenu } from './ToolsMenu';
import { useStudentAuth, StudentProfile, AvatarConfig } from '../contexts/StudentAuthContext';
import SimpleAvatarCreator, { AvatarDisplay, DEFAULT_AVATAR } from './student/SimpleAvatarCreator';
import { useViewMode } from '../contexts/ViewModeContext';
import { SharedFolder } from '../contexts/ViewModeContext';
import { supabase } from '../utils/supabase/client';
import { getEvaluationsForStudent, SavedEvaluation } from '../utils/ai-formative-assessment';
import { getStudentReceivedEvaluations, ClassEvaluation, StudentEvaluation } from '../utils/class-evaluations';
import { parseISO, formatDistanceToNow, format, isPast } from 'date-fns';
import { cs } from 'date-fns/locale';
import { 
  getAssignmentsForStudent,
  getStudentSubmissions,
} from '../utils/student-assignments';
import {
  StudentAssignment,
  StudentSubmission,
  ASSIGNMENT_TYPE_LABELS,
} from '../types/student-assignment';
import { getMessagesForStudent, markMessageAsRead, ClassMessage } from '../utils/class-messages';
import { ChatMessage, SharedContent, getTeacherSharedContent } from '../utils/class-chat';
import { GradedAssignmentCard } from './student/GradedAssignmentCard';

interface StudentWallLayoutProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

// Result from Supabase
interface StudentResult {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  assignmentType: 'test' | 'practice' | 'individual' | 'live';
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  totalQuestions: number;
  completedAt: string;
  timeSpentMs?: number;
  teacherComment?: string;
  subject?: string;
  sessionId?: string;
  // Formative assessment
  formativeAssessment?: string;
  teacherNotes?: string;
  sharedWithStudent?: boolean;
  sharedAt?: string;
}

interface StudentStats {
  averageScore: number;
  totalTests: number;
  totalPractice: number;
  totalIndividual: number;
  trend: 'up' | 'down' | 'stable';
  chartData: Array<{ date: Date; percentage: number; title: string }>;
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

// Format markdown-like text to HTML
function formatEvaluationText(text: string): string {
  if (!text) return '';
  
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Bold **text**
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-slate-900 dark:text-white font-semibold">$1</strong>')
    // Bullet points (• or -)
    .replace(/^[•\-]\s+(.+)$/gm, '<li class="ml-4">$1</li>')
    // Numbered lists (1. 2. 3.)
    .replace(/^(\d+)\.\s+(.+)$/gm, '<li class="ml-4"><span class="font-medium text-purple-700 dark:text-purple-400">$1.</span> $2</li>')
    // Line breaks
    .replace(/\n/g, '<br/>');
  
  // Wrap consecutive <li> items in <ul>
  html = html.replace(/(<li[^>]*>.*?<\/li>)(<br\/>)?(<li[^>]*>)/g, '$1$3');
  html = html.replace(/(<li[^>]*>.*?<\/li>)/g, '<ul class="list-none space-y-1 my-2">$1</ul>');
  // Remove extra <ul> wrappers
  html = html.replace(/<\/ul><br\/><ul[^>]*>/g, '');
  
  return html;
}

function formatTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return minutes + ' min';
  return Math.floor(minutes / 60) + 'h ' + (minutes % 60) + 'min';
}

function getAssignmentIcon(type: 'test' | 'practice' | 'individual' | 'live') {
  switch (type) {
    case 'test': 
    case 'live':
      return <FileText className="w-5 h-5 text-indigo-600" />;
    case 'practice': return <Target className="w-5 h-5 text-emerald-600" />;
    case 'individual': return <Zap className="w-5 h-5 text-amber-500" />;
  }
}

function getAssignmentLabel(type: 'test' | 'practice' | 'individual' | 'live') {
  switch (type) {
    case 'test': 
    case 'live':
      return 'Test';
    case 'practice': return 'Procvičování';
    case 'individual': return 'Samostatná práce';
  }
}

// Result Card Component
function ResultCard({ result, onViewDetail }: { result: StudentResult; onViewDetail?: (r: StudentResult) => void }) {
  const isIndividual = result.assignmentType === 'individual';
  const showEvaluation = result.formativeAssessment && result.sharedWithStudent;
  const canClick = result.sessionId && !isIndividual && onViewDetail;
  
  return (
    <div 
      className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all hover:shadow-md ${isIndividual ? 'opacity-80' : ''} ${canClick ? 'cursor-pointer' : ''}`}
      onClick={() => canClick && onViewDetail?.(result)}
    >
      <div className="p-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: getScoreBgColor(result.percentage) }}>
              {getAssignmentIcon(result.assignmentType)}
            </div>
            <div>
              <h3 className={`font-semibold text-slate-800 dark:text-white ${isIndividual ? 'text-sm' : 'text-base'}`}>
                {result.assignmentTitle}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ 
                  backgroundColor: isIndividual ? '#FEF3C7' : result.assignmentType === 'test' || result.assignmentType === 'live' ? '#EEF2FF' : '#D1FAE5',
                  color: isIndividual ? '#92400E' : result.assignmentType === 'test' || result.assignmentType === 'live' ? '#4338CA' : '#065F46',
                }}>
                  {getAssignmentLabel(result.assignmentType)}
                </span>
                {result.subject && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {result.subject}
                  </span>
                )}
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDistanceToNow(parseISO(result.completedAt), { addSuffix: true, locale: cs })}
                </span>
              </div>
            </div>
          </div>
          <div className="text-center px-4 py-2 rounded-xl" style={{ backgroundColor: getScoreBgColor(result.percentage) }}>
            <div className="text-2xl font-bold" style={{ color: getScoreColor(result.percentage) }}>
              {result.percentage}%
            </div>
            <div className="text-xs text-slate-500">{result.score}/{result.maxScore}</div>
          </div>
        </div>
      </div>
      
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <span className="text-slate-600 dark:text-slate-300">{result.correctCount ?? 0} správně</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <XCircle className="w-4 h-4 text-red-400" />
          <span className="text-slate-600 dark:text-slate-300">{(result.totalQuestions ?? 0) - (result.correctCount ?? 0)} špatně</span>
        </div>
        {result.timeSpentMs && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600 dark:text-slate-300">{formatTime(result.timeSpentMs)}</span>
          </div>
        )}
      </div>
      
      {result.teacherComment && (
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-start gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Hodnocení učitele:</span>
              <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{result.teacherComment}</p>
            </div>
          </div>
        </div>
      )}
      
      {showEvaluation && (
        <div className="px-4 py-4 border-t border-violet-100 dark:border-violet-900 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">Formativní hodnocení</span>
                {result.sharedAt && (
                  <span className="text-xs text-violet-500 dark:text-violet-400">
                    {formatDistanceToNow(parseISO(result.sharedAt), { addSuffix: true, locale: cs })}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{result.formativeAssessment}</p>
            </div>
          </div>
        </div>
      )}
      
      {canClick && (
        <div className="w-full px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
          Zobrazit detail<ChevronRight className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}

export function StudentWallLayout({ theme, toggleTheme }: StudentWallLayoutProps) {
  const navigate = useNavigate();
  const { student, logout, loading: authLoading, updateAvatar } = useStudentAuth();
  const { sharedFolders } = useViewMode();
  
  // Avatar modal state
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  
  // School modal state
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizEvaluations, setQuizEvaluations] = useState<SavedEvaluation[]>([]);
  const [filter, setFilter] = useState<'all' | 'test' | 'assignments' | 'individual' | 'evaluations' | 'messages'>('all');
  const [pendingAssignments, setPendingAssignments] = useState<(StudentAssignment & { submission?: StudentSubmission })[]>([]);
  const [gradedAssignments, setGradedAssignments] = useState<(StudentAssignment & { submission: StudentSubmission })[]>([]);
  const [expandedEvaluations, setExpandedEvaluations] = useState<Set<string>>(new Set());
  
  const toggleEvaluation = (id: string) => {
    setExpandedEvaluations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };
  
  // Subject filter
  const [selectedSubject, setSelectedSubject] = useState<string>('Fyzika');
  const SUBJECTS = ['Fyzika', 'Matematika'];
  
  // Messages from teacher
  const [messages, setMessages] = useState<ClassMessage[]>([]);
  
  // Chat messages with shared content from teacher
  const [teacherContent, setTeacherContent] = useState<ChatMessage[]>([]);
  
  // Average settings
  const [showAverageChart, setShowAverageChart] = useState(false);
  const [includeIndividualInAverage, setIncludeIndividualInAverage] = useState(false);
  const [showAverageSettings, setShowAverageSettings] = useState(false);
  
  // Received evaluations (from teacher)
  const [receivedEvaluations, setReceivedEvaluations] = useState<Array<{
    evaluation: ClassEvaluation;
    studentEvaluation: StudentEvaluation;
  }>>([]);

  // Load student results from Supabase
  useEffect(() => {
    async function loadStudentResults() {
      if (!student?.id) {
        setLoading(false);
        return;
      }
      
      console.log('[StudentWall] Loading results for student:', student.name, student.id);
      
      try {
        // Get assignments for this student's class
        const { data: assignments, error: assignmentsError } = await supabase
          .from('assignments')
          .select('*')
          .eq('class_id', student.class_id);
        
        if (assignmentsError) {
          console.error('Error loading assignments:', assignmentsError);
        }
        
        // Get results for this student
        const { data: resultsData, error: resultsError } = await supabase
          .from('results')
          .select('*')
          .eq('student_id', student.id)
          .order('completed_at', { ascending: false });
        
        if (resultsError) {
          console.error('Error loading results:', resultsError);
        }
        
        if (resultsData) {
          const studentResults: StudentResult[] = resultsData.map((r: any) => {
            const assignment = assignments?.find((a: any) => a.id === r.assignment_id);
            return {
              id: r.id,
              assignmentId: r.assignment_id,
              assignmentTitle: assignment?.title || 'Neznámý test',
              assignmentType: assignment?.type || 'test',
              score: r.score || 0,
              maxScore: r.max_score || 10,
              percentage: r.percentage || 0,
              correctCount: r.correct_count || 0,
              totalQuestions: r.total_questions || 0,
              subject: assignment?.subject || 'Quiz',
              completedAt: r.completed_at || r.created_at,
              timeSpentMs: r.time_spent_ms || 0,
              sessionId: assignment?.session_id,
              teacherComment: r.teacher_comment,
              formativeAssessment: r.formative_assessment,
              teacherNotes: r.teacher_notes,
              sharedWithStudent: r.shared_with_student,
              sharedAt: r.shared_at,
            };
          });
          
          setResults(studentResults);
          console.log('[StudentWall] Loaded', studentResults.length, 'results');
        }
        
        // Load quiz evaluations from localStorage (for older evaluations)
        if (student.id || student.name) {
          const evaluations = getEvaluationsForStudent(student.id, student.name);
          setQuizEvaluations(evaluations);
        }
        
        // Load pending and graded assignments
        if (student.class_id) {
          const assignments = await getAssignmentsForStudent(student.class_id);
          const submissions = await getStudentSubmissions(student.id);
          
          // Filter to only pending assignments
          const pending = assignments.filter(a => {
            const sub = submissions.find(s => s.assignment_id === a.id);
            return !sub || sub.status === 'not_started' || sub.status === 'draft';
          }).map(a => ({
            ...a,
            submission: submissions.find(s => s.assignment_id === a.id),
          }));
          
          setPendingAssignments(pending);
          
          // Filter to graded assignments (for wall display)
          const graded = assignments
            .map(a => ({
              ...a,
              submission: submissions.find(s => s.assignment_id === a.id),
            }))
            .filter((a): a is (StudentAssignment & { submission: StudentSubmission }) => 
              a.submission?.status === 'graded'
            )
            .sort((a, b) => 
              new Date(b.submission.graded_at || 0).getTime() - 
              new Date(a.submission.graded_at || 0).getTime()
            );
          
          setGradedAssignments(graded);
        }
        
        // Load received evaluations
        console.log('[StudentWall] Loading evaluations for student:', student.id);
        const evals = await getStudentReceivedEvaluations(student.id);
        console.log('[StudentWall] Received evaluations:', evals);
        setReceivedEvaluations(evals);
        
        // Load messages from teacher
        if (student.class_id) {
          const msgs = await getMessagesForStudent(student.class_id, student.id);
          console.log('[StudentWall] Loaded messages:', msgs.length);
          setMessages(msgs);
          
          // Load chat messages with shared content
          const chatContent = await getTeacherSharedContent(student.class_id);
          console.log('[StudentWall] Loaded teacher shared content:', chatContent.length);
          setTeacherContent(chatContent);
        }
      } catch (error) {
        console.error('[StudentWall] Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadStudentResults();
  }, [student?.id, student?.class_id, student?.name]);

  // Filter results by subject first
  const subjectResults = useMemo(() => {
    return results.filter(r => {
      // Strict subject matching
      if (r.subject === selectedSubject) return true;
      
      // For results without subject, check if they belong to this subject based on title
      if (!r.subject || r.subject === 'Quiz') {
        // Try to match by title keywords
        const title = r.assignmentTitle.toLowerCase();
        if (selectedSubject === 'Matematika') {
          return title.includes('matem') || title.includes('math') || title.includes('počít') || title.includes('rovnic');
        }
        if (selectedSubject === 'Fyzika') {
          return title.includes('fyzik') || title.includes('newton') || title.includes('síla') || title.includes('pohyb') || title.includes('energie');
        }
      }
      
      return false;
    });
  }, [results, selectedSubject]);

  // Calculate stats (based on subject-filtered results)
  const stats: StudentStats = useMemo(() => {
    if (subjectResults.length === 0) {
      return { averageScore: 0, totalTests: 0, totalPractice: 0, totalIndividual: 0, trend: 'stable', chartData: [] };
    }
    
    const totalTests = subjectResults.filter(r => r.assignmentType === 'test' || r.assignmentType === 'live').length;
    const totalPractice = subjectResults.filter(r => r.assignmentType === 'practice').length;
    const totalIndividual = subjectResults.filter(r => r.assignmentType === 'individual').length;
    
    // Calculate average - optionally exclude individual work
    const resultsForAverage = includeIndividualInAverage 
      ? subjectResults 
      : subjectResults.filter(r => r.assignmentType !== 'individual');
    
    const totalPercentage = resultsForAverage.reduce((sum, r) => sum + r.percentage, 0);
    const averageScore = resultsForAverage.length > 0 ? Math.round(totalPercentage / resultsForAverage.length) : 0;
    
    // Calculate trend from last 3 results
    const recentResults = resultsForAverage.slice(0, 3);
    const olderResults = resultsForAverage.slice(3, 6);
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (recentResults.length >= 2 && olderResults.length >= 2) {
      const recentAvg = recentResults.reduce((sum, r) => sum + r.percentage, 0) / recentResults.length;
      const olderAvg = olderResults.reduce((sum, r) => sum + r.percentage, 0) / olderResults.length;
      if (recentAvg > olderAvg + 5) trend = 'up';
      else if (recentAvg < olderAvg - 5) trend = 'down';
    }
    
    // Chart data - sorted by date
    const chartData = [...resultsForAverage]
      .sort((a, b) => parseISO(a.completedAt).getTime() - parseISO(b.completedAt).getTime())
      .map(r => ({
        date: parseISO(r.completedAt),
        percentage: r.percentage,
        title: r.assignmentTitle,
      }));
    
    return { averageScore, totalTests, totalPractice, totalIndividual, trend, chartData };
  }, [subjectResults, includeIndividualInAverage]);
  
  // Filter results based on active tab
  const filteredResults = useMemo(() => {
    switch (filter) {
      case 'all':
        return subjectResults;
      case 'test':
        return subjectResults.filter(r => r.assignmentType === 'test' || r.assignmentType === 'live');
      case 'individual':
        return subjectResults.filter(r => r.assignmentType === 'individual');
      case 'assignments':
      case 'evaluations':
      case 'messages':
        // These tabs don't show results, they show different content
        return [];
      default:
        return subjectResults;
    }
  }, [subjectResults, filter]);
  
  // Helper function to check if item matches subject
  const matchesSubject = useCallback((title: string, subject?: string) => {
    if (subject === selectedSubject) return true;
    if (!subject || subject === 'Quiz') {
      const t = title.toLowerCase();
      if (selectedSubject === 'Matematika') {
        return t.includes('matem') || t.includes('math') || t.includes('počít') || t.includes('rovnic');
      }
      if (selectedSubject === 'Fyzika') {
        return t.includes('fyzik') || t.includes('newton') || t.includes('síla') || t.includes('pohyb') || t.includes('energie');
      }
    }
    return false;
  }, [selectedSubject]);

  // Filter pending assignments by subject
  const filteredPendingAssignments = useMemo(() => {
    return pendingAssignments.filter(a => matchesSubject(a.title, a.subject));
  }, [pendingAssignments, matchesSubject]);

  // Filter graded assignments by subject
  const filteredGradedAssignments = useMemo(() => {
    return gradedAssignments.filter(a => matchesSubject(a.title, a.subject));
  }, [gradedAssignments, matchesSubject]);

  // Filter messages by subject (check if subject mentioned in content or title)
  const filteredMessages = useMemo(() => {
    return messages.filter(m => {
      const content = (m.content + ' ' + (m.title || '')).toLowerCase();
      if (selectedSubject === 'Matematika') {
        return content.includes('matem') || content.includes('math') || content.includes('počít');
      }
      if (selectedSubject === 'Fyzika') {
        return content.includes('fyzik') || content.includes('newton') || content.includes('síla');
      }
      return true; // Show all if no match keywords
    });
  }, [messages, selectedSubject]);

  // Filter evaluations by subject
  const filteredReceivedEvaluations = useMemo(() => {
    return receivedEvaluations.filter(e => {
      // If evaluation has no subject, show for all subjects
      if (!e.evaluation.subject) return true;
      // Otherwise use subject matching
      return matchesSubject(e.evaluation.title || '', e.evaluation.subject);
    });
  }, [receivedEvaluations, matchesSubject]);
  
  // Count unread messages (filtered by subject)
  const unreadMessagesCount = useMemo(() => {
    return filteredMessages.filter(m => !m.is_read).length;
  }, [filteredMessages]);

  // Calculate notification counts per subject
  const subjectNotifications = useMemo(() => {
    const counts: Record<string, number> = {};
    
    SUBJECTS.forEach(subject => {
      let count = 0;
      
      // Count pending assignments for this subject
      pendingAssignments.forEach(a => {
        const t = a.title.toLowerCase();
        const s = a.subject;
        if (s === subject) count++;
        else if (!s || s === 'Quiz') {
          if (subject === 'Matematika' && (t.includes('matem') || t.includes('math'))) count++;
          if (subject === 'Fyzika' && (t.includes('fyzik') || t.includes('newton'))) count++;
        }
      });
      
      // Count unread messages for this subject
      messages.filter(m => !m.is_read).forEach(m => {
        const content = (m.content + ' ' + (m.title || '')).toLowerCase();
        if (subject === 'Matematika' && (content.includes('matem') || content.includes('math'))) count++;
        if (subject === 'Fyzika' && (content.includes('fyzik') || content.includes('newton'))) count++;
      });
      
      // Count new evaluations (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      receivedEvaluations.forEach(e => {
        if (!e.evaluation?.createdAt) return;
        try {
          const created = parseISO(e.evaluation.createdAt);
          if (created > weekAgo) {
            const t = (e.evaluation.title || '').toLowerCase();
            const s = e.evaluation.subject;
            if (s === subject) count++;
            else if (!s) {
              if (subject === 'Matematika' && (t.includes('matem') || t.includes('math'))) count++;
              if (subject === 'Fyzika' && (t.includes('fyzik') || t.includes('newton'))) count++;
            }
          }
        } catch {
          // Ignore parse errors
        }
      });
      
      counts[subject] = count;
    });
    
    return counts;
  }, [pendingAssignments, messages, receivedEvaluations]);

  const handleViewDetail = (result: StudentResult) => {
    if (result.sessionId) {
      navigate(`/quiz/results/${result.sessionId}?viewMode=student&studentId=${student?.name || ''}&type=live`);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/student/login');
  };

  // Show login prompt if not logged in
  if (!authLoading && !student) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
        <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg max-w-md">
          <User className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Nejsi přihlášen/a</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Pro zobrazení své nástěnky se musíš přihlásit.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/student/login')}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              Přihlásit se
            </button>
            <button
              onClick={async () => {
                // Clear all student-related data
                localStorage.removeItem('viewMode');
                localStorage.removeItem('vividbooks_student_profile');
                localStorage.removeItem('supabase.auth.token');
                // Sign out from Supabase
                const { supabase } = await import('../utils/supabase/client');
                await supabase.auth.signOut();
                // Force full page reload to reset all state
                window.location.href = '/';
              }}
              className="px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Vrátit se na hlavní stránku
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
      {/* Sidebar */}
      <aside 
        className={`
          fixed top-0 left-0 bottom-0 z-30 w-[294px]
          ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
          lg:sticky lg:translate-x-0 lg:shadow-none lg:w-[312px]
        `}
        style={{ backgroundColor: '#4E5871' }}
      >
        <div className="w-[294px] lg:w-[312px] h-full flex flex-col min-w-[294px] lg:min-w-[312px]" style={{ backgroundColor: '#4E5871' }}>
          {/* Header */}
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <div className="flex items-center justify-center min-h-[40px] w-20">
                  <div className="w-20 h-10 text-white">
                    <VividLogo />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden p-1.5 rounded-md transition-colors text-white/70 hover:text-white hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Tools Menu - Always show */}
          <div className="flex-1 overflow-y-auto">
            <ToolsMenu 
              onClose={() => setToolsOpen(false)} 
              onItemClick={() => setSidebarOpen(false)}
              activeItem="student-wall"
              isStudentMode={true}
            />
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
        <div className="p-6 lg:p-8 max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Avatar - clickable to edit */}
                <button
                  onClick={() => setShowAvatarModal(true)}
                  className="relative group shrink-0"
                  title="Upravit avatar"
                >
                  {student?.avatar ? (
                    <AvatarDisplay avatar={student.avatar} size={90} />
                  ) : (
                    <div 
                      className="w-[90px] h-[90px] rounded-full flex items-center justify-center text-white font-bold text-3xl"
                      style={{ backgroundColor: student?.color || '#6366f1' }}
                    >
                      {student?.initials || '?'}
                    </div>
                  )}
                  {/* Edit overlay */}
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Settings className="w-6 h-6 text-white" />
                  </div>
                </button>
                
                <div>
                  <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-1">
                    Ahoj, {student?.name?.split(' ')[0] || 'studente'}! 👋
                  </h1>
                  <p className="text-slate-600 dark:text-slate-400">
                    Tady najdeš své výsledky, hodnocení a materiály od učitelů.
                  </p>
                </div>
              </div>

              {/* Right side buttons */}
              <div className="flex items-center gap-3">
                {/* School button */}
                <button
                  onClick={() => setShowSchoolModal(true)}
                  className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                >
                  <Building className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {student?.school_name || 'Škola'}
                  </span>
                </button>

                {/* Logout button */}
                <button
                  onClick={async () => {
                    try {
                      await logout();
                      navigate('/');
                    } catch (error) {
                      console.error('Logout failed:', error);
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    Odhlásit se
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-8">
            {/* Subject filter - above stats */}
            <div className="flex gap-2 mb-4">
              {SUBJECTS.map(subject => (
                <button
                  key={subject}
                  onClick={() => setSelectedSubject(subject)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedSubject === subject
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${selectedSubject === subject ? 'bg-indigo-500' : 'bg-slate-400'}`} />
                  {subject}
                  {subjectNotifications[subject] > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                      {subjectNotifications[subject]}
                    </span>
                  )}
                </button>
              ))}
            </div>
            
            <div className="grid grid-cols-4 gap-4">
              <button 
                onClick={() => setShowAverageChart(!showAverageChart)}
                className="rounded-2xl p-4 text-center transition-all hover:scale-105 cursor-pointer"
                style={{ backgroundColor: getScoreBgColor(stats.averageScore) }}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="text-3xl font-bold" style={{ color: getScoreColor(stats.averageScore) }}>{stats.averageScore}%</span>
                  {stats.trend === 'up' && <TrendingUp className="w-5 h-5 text-emerald-500" />}
                  {stats.trend === 'down' && <TrendingDown className="w-5 h-5 text-red-500" />}
                  {stats.trend === 'stable' && <Minus className="w-5 h-5 text-slate-400" />}
                </div>
                <p className="text-xs text-slate-600 flex items-center justify-center gap-1">
                  Průměr
                  <BarChart3 className="w-3 h-3" />
                  {showAverageChart ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </p>
              </button>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalTests}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Testů</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalPractice}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Procvičování</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalIndividual}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Samostatné</p>
              </div>
            </div>
            
            {/* Average Chart - Smooth Area Chart */}
            {showAverageChart && (
              <div className="mt-4 p-6 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Vývoj výsledků</h4>
                  <button
                    onClick={() => setShowAverageSettings(!showAverageSettings)}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  </button>
                </div>
                
                {/* Settings */}
                {showAverageSettings && (
                  <div className="mb-4 p-3 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600">
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeIndividualInAverage}
                        onChange={(e) => setIncludeIndividualInAverage(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-500 text-indigo-600 focus:ring-indigo-500"
                      />
                      Zahrnout samostatnou práci do průměru
                    </label>
                  </div>
                )}
                
                {stats.chartData.length > 0 ? (
                <div className="relative h-48">
                  {/* Y-axis labels */}
                  <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between text-xs text-slate-400">
                    <span>100</span>
                    <span>50</span>
                    <span>0</span>
                  </div>
                  {/* Chart area */}
                  <div className="ml-10 h-40 relative">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                      <div className="border-t border-dashed border-slate-200 dark:border-slate-600" />
                      <div className="border-t border-dashed border-slate-200 dark:border-slate-600" />
                      <div className="border-t border-dashed border-slate-200 dark:border-slate-600" />
                    </div>
                    {/* SVG Chart */}
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="studentAreaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22C55E" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#22C55E" stopOpacity="0.05" />
                        </linearGradient>
                      </defs>
                      {/* Area fill */}
                      <path
                        d={(() => {
                          const data = stats.chartData;
                          if (data.length === 0) return '';
                          const stepX = 100 / Math.max(data.length - 1, 1);
                          let path = `M 0 ${100 - data[0].percentage}`;
                          
                          for (let i = 1; i < data.length; i++) {
                            const x = i * stepX;
                            const y = 100 - data[i].percentage;
                            const prevX = (i - 1) * stepX;
                            const prevY = 100 - data[i - 1].percentage;
                            const cpX = (prevX + x) / 2;
                            path += ` Q ${cpX} ${prevY}, ${x} ${y}`;
                          }
                          path += ` L 100 100 L 0 100 Z`;
                          return path;
                        })()}
                        fill="url(#studentAreaGradient)"
                      />
                      {/* Line */}
                      <path
                        d={(() => {
                          const data = stats.chartData;
                          if (data.length === 0) return '';
                          const stepX = 100 / Math.max(data.length - 1, 1);
                          let path = `M 0 ${100 - data[0].percentage}`;
                          
                          for (let i = 1; i < data.length; i++) {
                            const x = i * stepX;
                            const y = 100 - data[i].percentage;
                            const prevX = (i - 1) * stepX;
                            const prevY = 100 - data[i - 1].percentage;
                            const cpX = (prevX + x) / 2;
                            path += ` Q ${cpX} ${prevY}, ${x} ${y}`;
                          }
                          return path;
                        })()}
                        fill="none"
                        stroke="#22C55E"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                    {/* Data points with tooltips */}
                    <div className="absolute inset-0 flex">
                      {stats.chartData.map((point, idx) => {
                        const stepX = 100 / Math.max(stats.chartData.length - 1, 1);
                        const left = `${idx * stepX}%`;
                        const bottom = `${point.percentage}%`;
                        return (
                          <div
                            key={idx}
                            className="absolute w-2 h-2 -ml-1 -mb-1 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-700 shadow-sm cursor-pointer hover:scale-150 transition-transform group"
                            style={{ left, bottom }}
                          >
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 shadow-lg">
                              <div className="font-medium">{point.percentage}%</div>
                              <div className="text-slate-300 text-[10px]">{point.title}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* X-axis labels */}
                  <div className="ml-10 flex justify-between mt-2 text-xs text-slate-400">
                    {stats.chartData.length > 0 && (
                      <>
                        <span>{stats.chartData[0].date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}</span>
                        {stats.chartData.length > 2 && (
                          <span>{stats.chartData[Math.floor(stats.chartData.length / 2)].date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}</span>
                        )}
                        <span>{stats.chartData[stats.chartData.length - 1].date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}</span>
                      </>
                    )}
                  </div>
                </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                    Zatím nemáš žádné výsledky k zobrazení.
                  </p>
                )}
              </div>
            )}
            
            {/* Motivational message */}
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-100 dark:border-emerald-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-emerald-800 dark:text-emerald-300">
                    {stats.averageScore >= 80 ? 'Výborný výkon!' : stats.averageScore >= 60 ? 'Dobrá práce!' : 'Pokračuj v učení!'}
                  </h3>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    {stats.averageScore >= 75 ? 'Tvé výsledky jsou skvělé! 📈' : stats.averageScore >= 60 ? 'Udržuješ stabilní výkon' : 'Zkus se více soustředit'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Shared Folders from Teachers */}
          {sharedFolders.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Folder className="w-5 h-5 text-emerald-500" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Materiály od učitelů</h2>
                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-full">
                  {sharedFolders.length}
                </span>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sharedFolders.map((folder) => (
                  <button 
                    key={folder.id}
                    onClick={() => navigate(`/library/student-wall/folder/${folder.id}`)}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all cursor-pointer text-left group"
                  >
                    <div className="flex items-start gap-4">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform"
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

          {/* Filter tabs */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-2 pt-4 mb-6 border border-slate-200 dark:border-slate-700 overflow-visible">
            <div className="flex gap-1 overflow-x-auto overflow-y-visible" style={{ paddingTop: '8px', marginTop: '-8px' }}>
              {[
                { key: 'all', label: 'Vše', newCount: 0 },
                { key: 'evaluations', label: 'Hodnocení', newCount: filteredReceivedEvaluations.length },
                { key: 'test', label: 'Testy', newCount: 0 },
                { key: 'assignments', label: 'Úkoly', newCount: filteredPendingAssignments.length },
                { key: 'individual', label: 'Vlastní práce', newCount: 0 },
                { key: 'messages', label: 'Zprávy', newCount: unreadMessagesCount },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as any)}
                  className={`relative flex-shrink-0 py-2.5 px-5 rounded-xl text-sm font-semibold transition-all ${
                    filter === tab.key 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                  {tab.newCount > 0 && (
                    <span 
                      className="absolute flex items-center justify-center text-xs font-bold rounded-full"
                      style={{ 
                        top: '-6px', 
                        right: '-6px', 
                        minWidth: '20px', 
                        height: '20px',
                        padding: '0 6px',
                        backgroundColor: '#EF4444',
                        color: '#FFFFFF'
                      }}
                    >
                      {tab.newCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Content based on active tab */}
          
          {/* Messages Tab */}
          {filter === 'messages' && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Zprávy od učitele</h2>
              </div>
              
              {/* Shared Content from Chat */}
              {teacherContent.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Sdílený obsah
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {teacherContent.map(chatMsg => (
                      <Link
                        key={chatMsg.id}
                        to={chatMsg.sharedContent?.url || '/class-chat'}
                        className="group bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl p-5 border border-indigo-200 dark:border-indigo-700/50 hover:shadow-lg transition-all hover:border-indigo-400"
                      >
                        <div className="flex items-start gap-4">
                          <div className={`shrink-0 w-14 h-14 rounded-xl flex items-center justify-center ${
                            chatMsg.sharedContent?.type === 'lesson' ? 'bg-indigo-500' :
                            chatMsg.sharedContent?.type === 'worksheet' ? 'bg-green-500' :
                            chatMsg.sharedContent?.type === 'quiz' ? 'bg-amber-500' :
                            chatMsg.sharedContent?.type === 'board' ? 'bg-purple-500' :
                            'bg-blue-500'
                          }`}>
                            {chatMsg.sharedContent?.type === 'lesson' && <BookOpen className="w-7 h-7 text-white" />}
                            {chatMsg.sharedContent?.type === 'worksheet' && <FileText className="w-7 h-7 text-white" />}
                            {chatMsg.sharedContent?.type === 'quiz' && <Target className="w-7 h-7 text-white" />}
                            {chatMsg.sharedContent?.type === 'board' && <Folder className="w-7 h-7 text-white" />}
                            {chatMsg.sharedContent?.type === 'document' && <FileText className="w-7 h-7 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                              {chatMsg.sharedContent?.title || 'Obsah'}
                            </h4>
                            {chatMsg.sharedContent?.description && (
                              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                {chatMsg.sharedContent.description}
                              </p>
                            )}
                            <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                              {chatMsg.authorName} • {formatDistanceToNow(new Date(chatMsg.createdAt), { addSuffix: true, locale: cs })}
                            </p>
                            {chatMsg.content && chatMsg.content !== `Sdílím: ${chatMsg.sharedContent?.title}` && (
                              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 line-clamp-2">
                                "{chatMsg.content}"
                              </p>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Regular Messages */}
              {filteredMessages.length === 0 && teacherContent.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-700">
                  <MessageSquare className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">Žádné zprávy pro {selectedSubject}</p>
                </div>
              ) : filteredMessages.length > 0 && (
                <>
                  {teacherContent.length > 0 && (
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                      Oznámení
                    </h3>
                  )}
                  <div className="space-y-4">
                    {filteredMessages.map(message => (
                      <div 
                        key={message.id}
                        onClick={async () => {
                          if (!message.is_read && student?.id) {
                            await markMessageAsRead(message.id, student.id);
                            setMessages(prev => prev.map(m => 
                              m.id === message.id ? { ...m, is_read: true, read_at: new Date().toISOString() } : m
                            ));
                          }
                        }}
                        className={`bg-white dark:bg-slate-800 rounded-2xl p-5 border cursor-pointer transition-all hover:shadow-md ${
                          message.is_read 
                            ? 'border-slate-200 dark:border-slate-700' 
                            : 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        } ${message.priority === 'urgent' ? 'ring-2 ring-red-400' : message.priority === 'important' ? 'ring-2 ring-amber-400' : ''}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {!message.is_read && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full" />
                            )}
                            <h3 className="font-semibold text-slate-800 dark:text-white">{message.title}</h3>
                            {message.priority === 'urgent' && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Urgentní</span>
                            )}
                            {message.priority === 'important' && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">Důležité</span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {formatDistanceToNow(parseISO(message.created_at), { addSuffix: true, locale: cs })}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{message.content}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
          
          {/* Evaluations Tab */}
          {filter === 'evaluations' && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-purple-500" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Hodnocení od učitele</h2>
              </div>
              
              {filteredReceivedEvaluations.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-700">
                  <Award className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">Žádná hodnocení pro {selectedSubject}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredReceivedEvaluations.map(({ evaluation, studentEvaluation }) => {
                    const isExpanded = expandedEvaluations.has(studentEvaluation.id);
                    return (
                      <div 
                        key={studentEvaluation.id}
                        className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                              {evaluation?.title || 'Hodnocení'}
                            </h3>
                            <p className="text-sm text-purple-600 dark:text-purple-400">
                              {evaluation?.sent_at && format(parseISO(evaluation.sent_at), 'd. MMMM yyyy', { locale: cs })}
                            </p>
                          </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-purple-100 dark:bg-purple-900/50 rounded-full">
                          <Trophy className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                              {evaluation?.period_type === 'semester' && 'Pololetní'}
                              {evaluation?.period_type === 'final' && 'Závěrečné'}
                              {evaluation?.period_type === 'quarterly' && 'Čtvrtletní'}
                              {evaluation?.period_type === 'custom' && 'Hodnocení'}
                              {!evaluation?.period_type && 'Hodnocení'}
                            </span>
                          </div>
                        </div>
                        
                        {studentEvaluation.average_score !== undefined && studentEvaluation.average_score !== null && (
                          <div className="mb-4 flex items-center gap-3">
                            <span className="text-sm text-purple-700 dark:text-purple-300">Průměr za období:</span>
                            <span 
                              className="text-lg font-bold px-3 py-1 rounded-lg"
                              style={{
                                backgroundColor: getScoreBgColor(studentEvaluation.average_score),
                                color: getScoreColor(studentEvaluation.average_score),
                              }}
                            >
                              {studentEvaluation.average_score}%
                            </span>
                            {studentEvaluation.results_count && (
                              <span className="text-sm text-purple-600 dark:text-purple-400">
                                ({studentEvaluation.results_count} aktivit)
                              </span>
                            )}
                          </div>
                        )}
                        
                        {isExpanded && (
                          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 mb-4">
                            <div 
                              className="text-slate-700 dark:text-slate-300 leading-relaxed prose prose-sm max-w-none dark:prose-invert"
                              dangerouslySetInnerHTML={{ 
                                __html: formatEvaluationText(studentEvaluation.final_text || 'Hodnocení není k dispozici.')
                              }}
                            />
                          </div>
                        )}
                        
                        <button
                          onClick={() => toggleEvaluation(studentEvaluation.id)}
                          className="w-full flex items-center justify-center gap-2 py-2 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 transition-colors"
                        >
                          <span className="text-sm font-medium">
                            {isExpanded ? 'Skrýt detail' : 'Zobrazit detail'}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
          
          {/* Assignments Tab */}
          {filter === 'assignments' && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-indigo-500" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Úkoly k vypracování</h2>
                {filteredPendingAssignments.length > 0 && (
                  <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded-full">
                    {filteredPendingAssignments.length}
                  </span>
                )}
              </div>
              
              {filteredPendingAssignments.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-700">
                  <CheckCircle className="w-12 h-12 text-emerald-300 dark:text-emerald-600 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">Nemáš žádné úkoly pro {selectedSubject} 🎉</p>
                </div>
              ) : (
              <div className="space-y-3">
                  {filteredPendingAssignments.map((assignment) => {
                  const isDraft = assignment.submission?.status === 'draft';
                  const isOverdue = assignment.due_date && isPast(parseISO(assignment.due_date));
                  
                  return (
                    <Link
                      key={assignment.id}
                      to={`/student/assignment/${assignment.id}`}
                      className="block bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          assignment.type === 'document'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : assignment.type === 'presentation'
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        }`}>
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-800 dark:text-white truncate">
                              {assignment.title}
                            </h3>
                            {isDraft && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full shrink-0">
                                Rozpracováno
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
                            {assignment.description}
                          </p>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-slate-400">
                              {ASSIGNMENT_TYPE_LABELS[assignment.type]}
                            </span>
                            {assignment.due_date && (
                              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                                <Calendar className="w-3 h-3" />
                                {isOverdue ? 'Po termínu' : `Do ${format(parseISO(assignment.due_date), 'd. M.', { locale: cs })}`}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 shrink-0 mt-3" />
                      </div>
                    </Link>
                  );
                })}
              </div>
              )}
            </section>
          )}

          {/* Received Evaluations - Show in "all" view too */}
          {filter === 'all' && filteredReceivedEvaluations.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-purple-500" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Hodnocení od učitele</h2>
              </div>
              
              <div className="space-y-4">
                {filteredReceivedEvaluations.map(({ evaluation, studentEvaluation }) => {
                  const isExpanded = expandedEvaluations.has(studentEvaluation.id);
                  return (
                    <div 
                      key={studentEvaluation.id}
                      className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                            {evaluation.title}
                          </h3>
                          <p className="text-sm text-purple-600 dark:text-purple-400">
                            {evaluation.sent_at && format(parseISO(evaluation.sent_at), 'd. MMMM yyyy', { locale: cs })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-purple-100 dark:bg-purple-900/50 rounded-full">
                          <Award className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                            {evaluation.period_type === 'semester' && 'Pololetní'}
                            {evaluation.period_type === 'final' && 'Závěrečné'}
                            {evaluation.period_type === 'quarterly' && 'Čtvrtletní'}
                            {evaluation.period_type === 'custom' && 'Hodnocení'}
                          </span>
                        </div>
                      </div>
                      
                      {studentEvaluation.average_score !== undefined && (
                        <div className="mb-4 flex items-center gap-3">
                          <span className="text-sm text-purple-700 dark:text-purple-300">Průměr za období:</span>
                          <span 
                            className="text-lg font-bold px-3 py-1 rounded-lg"
                            style={{
                              backgroundColor: getScoreBgColor(studentEvaluation.average_score),
                              color: getScoreColor(studentEvaluation.average_score),
                            }}
                          >
                            {studentEvaluation.average_score}%
                          </span>
                          {studentEvaluation.results_count && (
                            <span className="text-sm text-purple-600 dark:text-purple-400">
                              ({studentEvaluation.results_count} aktivit)
                            </span>
                          )}
                        </div>
                      )}
                      
                      {isExpanded && (
                        <div className="bg-white/60 dark:bg-slate-800/60 rounded-xl p-4 mb-4">
                          <div 
                            className="text-slate-700 dark:text-slate-300 leading-relaxed prose prose-sm max-w-none dark:prose-invert"
                            dangerouslySetInnerHTML={{ 
                              __html: formatEvaluationText(studentEvaluation.final_text || 'Hodnocení není k dispozici.')
                            }}
                          />
                        </div>
                      )}
                      
                      <button
                        onClick={() => toggleEvaluation(studentEvaluation.id)}
                        className="w-full flex items-center justify-center gap-2 py-2 text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 transition-colors"
                      >
                        <span className="text-sm font-medium">
                          {isExpanded ? 'Skrýt detail' : 'Zobrazit detail'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Graded Assignments - Show in "all" view */}
          {filter === 'all' && filteredGradedAssignments.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-indigo-500" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Ohodnocené úkoly</h2>
                <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                  {filteredGradedAssignments.length}
                </span>
              </div>
              
              <div className="space-y-4">
                {filteredGradedAssignments.slice(0, 3).map((item) => (
                  <GradedAssignmentCard
                    key={item.id}
                    assignment={item}
                    submission={item.submission}
                    onViewDocument={() => {
                      // Navigate to view graded work (read-only)
                      navigate(`/library/my-content/${item.document_id}?studentMode=true&readOnly=true`);
                    }}
                  />
                ))}
                
                {filteredGradedAssignments.length > 3 && (
                  <button
                    onClick={() => navigate('/student/my-content?tab=submitted')}
                    className="w-full py-3 text-center text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                  >
                    Zobrazit všechny ({filteredGradedAssignments.length})
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Results List - only show in relevant tabs */}
          {(filter === 'all' || filter === 'test' || filter === 'individual') && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-amber-500" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Moje výsledky</h2>
            </div>
            
            <div className="space-y-4">
              {filteredResults.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-700">
                  <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">
                    {results.length === 0 
                      ? 'Zatím nemáš žádné výsledky. Začni testy a procvičování!'
                      : 'Žádné výsledky v této kategorii'
                    }
                  </p>
                      </div>
              ) : (
                filteredResults.map(result => (
                  <ResultCard 
                    key={result.id} 
                    result={result} 
                    onViewDetail={handleViewDetail}
                  />
                ))
              )}
            </div>
          </section>
          )}

          {/* Quiz Formative Evaluations from localStorage */}
          {quizEvaluations.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-5 h-5 text-purple-500" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Formativní hodnocení</h2>
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
                        <h3 className="font-semibold text-slate-800 dark:text-white">{evaluation.title}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{evaluation.subject || 'Hodnocení'}</p>
                      </div>
                      <div className="ml-auto text-xs text-slate-400">
                        {formatDistanceToNow(parseISO(evaluation.sharedAt || evaluation.createdAt), { addSuffix: true, locale: cs })}
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
        </div>
      </main>
      
      {/* Avatar Editor Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div 
            className="bg-white rounded-3xl shadow-2xl overflow-hidden"
            style={{ width: '900px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <SimpleAvatarCreator
              initialAvatar={student?.avatar || DEFAULT_AVATAR}
              onSave={async (avatar) => {
                const result = await updateAvatar(avatar);
                if (result.success) {
                  setShowAvatarModal(false);
                } else {
                  console.error('Failed to save avatar:', result.error);
                  alert('Nepodařilo se uložit avatar: ' + result.error);
                }
              }}
              onCancel={() => setShowAvatarModal(false)}
            />
          </div>
        </div>
      )}

      {/* School Modal */}
      {showSchoolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowSchoolModal(false)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-8 border-b border-slate-200">
              <h2 className="text-3xl font-bold text-slate-900">
                Účet a škola
              </h2>
            </div>

            {/* Content - Two columns */}
            <div className="p-8 grid md:grid-cols-2 gap-6">
              {/* Left Column - Můj profil */}
              <div className="bg-blue-50 rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-8">
                  <GraduationCap className="w-8 h-8 text-slate-900" />
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Můj profil</h3>
                    <p className="text-sm text-slate-600">Informace o tvém účtu</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Name */}
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">Jméno</label>
                    <p className="text-lg font-bold text-slate-900">{student?.name}</p>
                  </div>

                  {/* Email */}
                  {student?.email && (
                    <div>
                      <label className="text-sm text-slate-600 mb-1 block">E-mail</label>
                      <p className="text-lg font-bold text-slate-900">{student.email}</p>
                    </div>
                  )}

                  {/* Role */}
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">Role</label>
                    <p className="text-lg font-bold text-slate-900">Žák</p>
                  </div>

                  {/* Student Code */}
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">Žákovský kód</label>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold text-emerald-600">{student?.id?.slice(0, 10).toUpperCase() || 'N/A'}</p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(student?.id || '');
                        }}
                        className="p-1 hover:bg-slate-200 rounded transition-colors"
                        title="Kopírovat"
                      >
                        <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  onClick={async () => {
                    try {
                      await logout();
                      navigate('/');
                    } catch (error) {
                      console.error('Logout failed:', error);
                    }
                  }}
                  className="mt-8 w-full py-3 px-4 rounded-xl bg-white border-2 border-red-200 text-red-600 font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut className="w-5 h-5" />
                  Odhlásit se
                </button>
              </div>

              {/* Right Column - Moje škola */}
              <div className="bg-amber-50 rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-8">
                  <Building className="w-8 h-8 text-slate-900" />
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Moje škola</h3>
                    <p className="text-sm text-slate-600">Propojeno se školou</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* School Name & Address */}
                  <div className="bg-white rounded-xl p-4">
                    <label className="text-sm text-slate-600 mb-2 block">Název školy</label>
                    <p className="text-xl font-bold text-slate-900">{student?.school_name || 'ZŠ Vividbooks'}</p>
                    <p className="text-sm text-slate-600 mt-1">Dukelská 42, Strakonice</p>
                  </div>

                  {/* Class */}
                  <div className="bg-white rounded-xl p-4">
                    <label className="text-sm text-slate-600 mb-2 block">Moje třída</label>
                    <p className="text-xl font-bold text-emerald-600">{student?.class_name || 'Vividbooks třída'}</p>
                    <p className="text-sm text-slate-600 mt-1">6. ročník</p>
                  </div>

                  {/* Teacher */}
                  <div className="bg-white rounded-xl p-4">
                    <label className="text-sm text-indigo-600 mb-3 block">Přidán učitelem</label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Mgr. Petra Svobodová</p>
                        <p className="text-sm text-slate-600">Třídní učitel</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Disconnect Button */}
                <button
                  className="mt-8 w-full py-3 px-4 rounded-xl bg-white border-2 border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Odpojit se ze školy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
