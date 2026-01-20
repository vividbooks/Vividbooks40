import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Trophy, TrendingUp, TrendingDown, Minus, Calendar,
  CheckCircle, XCircle, Clock, BookOpen, User, MessageSquare,
  ChevronRight, Target, Zap, FileText, X, PanelLeftClose, PanelLeft, Users,
  Database, HardDrive, Settings, ChevronDown, ChevronUp, BarChart3
} from 'lucide-react';
import { parseISO, formatDistanceToNow } from 'date-fns';
import { cs } from 'date-fns/locale';
import VividLogo from '../../imports/Group70';
import { ToolsDropdown } from '../ToolsDropdown';
import { ToolsMenu } from '../ToolsMenu';
import { 
  isUsingSupabase, 
  getStudents,
  getResults,
  getAssignments,
  Student,
} from '../../utils/supabase/classes';
import { getStudentReceivedEvaluations, ClassEvaluation, StudentEvaluation } from '../../utils/class-evaluations';
import { format } from 'date-fns';

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
  subject?: string; // Subject for filtering
  sessionId?: string; // Quiz session ID for matching evaluations
  // Formative assessment (from Supabase results table)
  formativeAssessment?: string;
  teacherNotes?: string;
  sharedWithStudent?: boolean;
  sharedAt?: string;
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

// Demo students for sidebar - IDs match the format from ClassResultsGrid (s_{classId}_{index})
const DEMO_CLASS_STUDENTS: ClassStudent[] = [
  { id: 's_1_1', name: 'Anna Nováková', initials: 'AN', color: '#EC4899', averageScore: 82 },
  { id: 's_1_2', name: 'Jakub Svoboda', initials: 'JS', color: '#3B82F6', averageScore: 91 },
  { id: 's_1_3', name: 'Tereza Dvořáková', initials: 'TD', color: '#8B5CF6', averageScore: 75 },
  { id: 's_1_4', name: 'Martin Černý', initials: 'MČ', color: '#10B981', averageScore: 88 },
  { id: 's_1_5', name: 'Karolína Procházková', initials: 'KP', color: '#F59E0B', averageScore: 67 },
  { id: 's_1_6', name: 'David Kučera', initials: 'DK', color: '#EF4444', averageScore: 79 },
  { id: 's_1_7', name: 'Eliška Veselá', initials: 'EV', color: '#06B6D4', averageScore: 85 },
  { id: 's_1_8', name: 'Tomáš Horák', initials: 'TH', color: '#84CC16', averageScore: 72 },
  { id: 's_1_9', name: 'Natálie Marková', initials: 'NM', color: '#EC4899', averageScore: 64 },
  { id: 's_1_10', name: 'Filip Poláček', initials: 'FP', color: '#3B82F6', averageScore: 93 },
  { id: 's_1_11', name: 'Adéla Králová', initials: 'AK', color: '#8B5CF6', averageScore: 58 },
  { id: 's_1_12', name: 'Ondřej Němec', initials: 'ON', color: '#10B981', averageScore: 86 },
];

// Demo data generator
function generateDemoStudentProfile(studentId: string): StudentProfile {
  // Find student by ID, fallback to first student if not found
  let student = DEMO_CLASS_STUDENTS.find(s => s.id === studentId);
  
  // If not found, try to parse the ID and find by index
  if (!student && studentId) {
    const parts = studentId.split('_');
    if (parts.length === 3) {
      const index = parseInt(parts[2]) - 1;
      if (index >= 0 && index < DEMO_CLASS_STUDENTS.length) {
        student = DEMO_CLASS_STUDENTS[index];
      }
    }
  }
  
  if (!student) {
    student = DEMO_CLASS_STUDENTS[0];
  }
  
  const results: StudentResult[] = [
    // FYZIKA results
    { id: 'r1', assignmentId: 'a1', assignmentTitle: 'Závěrečný test - Teplo a teplota', assignmentType: 'test', score: 8, maxScore: 10, percentage: 80, correctCount: 8, totalQuestions: 10, completedAt: '2024-12-15T10:30:00Z', timeSpentMs: 1200000, teacherComment: 'Výborná práce! Jen pozor na převody jednotek.', boardId: 'board_teplo', subject: 'Fyzika' },
    { id: 'r2', assignmentId: 'a2', assignmentTitle: 'Práce a energie', assignmentType: 'test', score: 6, maxScore: 10, percentage: 60, correctCount: 6, totalQuestions: 10, completedAt: '2024-12-10T09:15:00Z', timeSpentMs: 900000, boardId: 'board_prace', subject: 'Fyzika' },
    { id: 'r3', assignmentId: 'a3', assignmentTitle: 'Newtonovy zákony', assignmentType: 'test', score: 9, maxScore: 10, percentage: 90, correctCount: 9, totalQuestions: 10, completedAt: '2024-12-05T11:00:00Z', teacherComment: 'Skvělý výsledek!', boardId: 'board_newton', subject: 'Fyzika' },
    { id: 'r4', assignmentId: 'a4', assignmentTitle: 'Procvičování - Síla', assignmentType: 'practice', score: 7, maxScore: 10, percentage: 70, correctCount: 7, totalQuestions: 10, completedAt: '2024-12-08T14:20:00Z', boardId: 'board_sila', subject: 'Fyzika' },
    { id: 'r5', assignmentId: 'a5', assignmentTitle: 'Procvičování - Energie', assignmentType: 'practice', score: 8, maxScore: 10, percentage: 80, correctCount: 8, totalQuestions: 10, completedAt: '2024-12-01T16:45:00Z', boardId: 'board_energie', subject: 'Fyzika' },
    { id: 'r6', assignmentId: 'i1', assignmentTitle: 'Hmota - samostatné', assignmentType: 'individual', score: 9, maxScore: 10, percentage: 90, correctCount: 9, totalQuestions: 10, completedAt: '2024-12-14T18:30:00Z', boardId: 'board_hmota', subject: 'Fyzika' },
    { id: 'r7', assignmentId: 'i2', assignmentTitle: 'Síla - samostatné', assignmentType: 'individual', score: 7, maxScore: 10, percentage: 70, correctCount: 7, totalQuestions: 10, completedAt: '2024-12-12T20:15:00Z', boardId: 'board_sila', subject: 'Fyzika' },
    { id: 'r8', assignmentId: 'i3', assignmentTitle: 'Newton - samostatné', assignmentType: 'individual', score: 10, maxScore: 10, percentage: 100, correctCount: 10, totalQuestions: 10, completedAt: '2024-12-06T19:00:00Z', boardId: 'board_newton', subject: 'Fyzika' },
    
    // MATEMATIKA results - distinctly different stats (lower average, more tests)
    { id: 'm1', assignmentId: 'm_a1', assignmentTitle: 'Zlomky - úvod', assignmentType: 'test', score: 5, maxScore: 10, percentage: 50, correctCount: 5, totalQuestions: 10, completedAt: '2024-12-14T09:00:00Z', timeSpentMs: 1100000, teacherComment: 'Zkus si procvičit sčítání zlomků.', boardId: 'board_zlomky', subject: 'Matematika' },
    { id: 'm2', assignmentId: 'm_a2', assignmentTitle: 'Desetinná čísla', assignmentType: 'test', score: 6, maxScore: 10, percentage: 60, correctCount: 6, totalQuestions: 10, completedAt: '2024-12-11T14:00:00Z', boardId: 'board_desetinna', subject: 'Matematika' },
    { id: 'm3', assignmentId: 'm_a3', assignmentTitle: 'Procenta', assignmentType: 'test', score: 7, maxScore: 10, percentage: 70, correctCount: 7, totalQuestions: 10, completedAt: '2024-12-08T10:30:00Z', boardId: 'board_procenta', subject: 'Matematika' },
    { id: 'm4', assignmentId: 'm_a4', assignmentTitle: 'Rovnice', assignmentType: 'test', score: 5, maxScore: 10, percentage: 50, correctCount: 5, totalQuestions: 10, completedAt: '2024-12-04T15:20:00Z', teacherComment: 'Potřebuješ více cvičit.', boardId: 'board_rovnice', subject: 'Matematika' },
    { id: 'm5', assignmentId: 'm_i1', assignmentTitle: 'Zlomky - procvičování', assignmentType: 'individual', score: 6, maxScore: 10, percentage: 60, correctCount: 6, totalQuestions: 10, completedAt: '2024-12-13T19:00:00Z', boardId: 'board_zlomky', subject: 'Matematika' },
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

// Format markdown-like text to HTML
function formatEvaluationText(text: string): string {
  if (!text) return '';
  
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Bold **text**
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-slate-900 font-semibold">$1</strong>')
    // Bullet points (• or -)
    .replace(/^[•\-]\s+(.+)$/gm, '<li class="ml-4">$1</li>')
    // Numbered lists (1. 2. 3.)
    .replace(/^(\d+)\.\s+(.+)$/gm, '<li class="ml-4"><span class="font-medium text-purple-700">$1.</span> $2</li>')
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
  // Show evaluation only if shared with student
  const showEvaluation = result.formativeAssessment && result.sharedWithStudent;
  // Individual work is always clickable (uses assignment ID), others need sessionId
  const canClick = isIndividual || result.sessionId;
  
  return (
    <div 
      className={'bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md ' + (isIndividual ? 'opacity-80' : '') + (canClick ? ' cursor-pointer' : '')}
      onClick={() => canClick && onViewDetail(result)}
    >
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
        <div className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-slate-600">{result.correctCount ?? 0} správně</span></div>
        <div className="flex items-center gap-2 text-sm"><XCircle className="w-4 h-4 text-red-400" /><span className="text-slate-600">{(result.totalQuestions ?? 0) - (result.correctCount ?? 0)} špatně</span></div>
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
      {showEvaluation && (
        <div className="px-4 py-4 border-t border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-violet-700">Formativní hodnocení</span>
                {result.sharedAt && (
                  <span className="text-xs text-violet-500">
                    {formatDistanceToNow(parseISO(result.sharedAt), { addSuffix: true, locale: cs })}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{result.formativeAssessment}</p>
            </div>
          </div>
        </div>
      )}
      {canClick && (
        <div className="w-full px-4 py-3 border-t border-slate-100 flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors">
          Zobrazit detail<ChevronRight className="w-4 h-4" />
        </div>
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
  const [selectedSubject, setSelectedSubject] = useState<string>('Fyzika');
  
  // Received evaluations from teacher
  const [receivedEvaluations, setReceivedEvaluations] = useState<Array<{
    evaluation: ClassEvaluation;
    studentEvaluation: StudentEvaluation;
  }>>([]);
  
  // Check if using Supabase
  const useSupabase = isUsingSupabase();
  
  // Available subjects in Vividbooks
  const STUDENT_SUBJECTS = ['Fyzika', 'Matematika'];
  
  // Sidebar states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  
  // Average settings
  const [showAverageChart, setShowAverageChart] = useState(false);
  const [includeIndividualInAverage, setIncludeIndividualInAverage] = useState(false);
  const [showAverageSettings, setShowAverageSettings] = useState(false);
  
  // Class students for sidebar
  const [classStudents, setClassStudents] = useState<ClassStudent[]>(DEMO_CLASS_STUDENTS);
  
  
  useEffect(() => {
    async function loadStudentData() {
      if (!studentId) return;
      
      setLoading(true);
      
      if (useSupabase) {
        try {
          console.log('Loading student profile from Supabase for:', studentId);
          
          // Load student data using direct fetch
          const projectId = 'njbtqmsxbyvpwigfceke';
          const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';
          
          // Get student
          const studentRes = await fetch(`https://${projectId}.supabase.co/rest/v1/students?id=eq.${studentId}&select=*`, {
            headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` }
          });
          const [student] = await studentRes.json();
          
          if (!student) {
            setProfile(null);
            setLoading(false);
            return;
          }
          
          // Get assignments for this student's class
          const assignmentsRes = await fetch(`https://${projectId}.supabase.co/rest/v1/assignments?class_id=eq.${student.class_id}&select=*`, {
            headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` }
          });
          const assignments = await assignmentsRes.json();
          
          // Get results for this student
          const resultsRes = await fetch(`https://${projectId}.supabase.co/rest/v1/results?student_id=eq.${studentId}&select=*`, {
            headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` }
          });
          const results = await resultsRes.json();
          
          // Build profile
          const studentResults: StudentResult[] = results.map((r: any) => {
            const assignment = assignments.find((a: any) => a.id === r.assignment_id);
            return {
              id: r.id,
              assignmentId: r.assignment_id,
              assignmentTitle: assignment?.title || 'Neznámý test',
              assignmentType: assignment?.type || 'test',
              score: r.score,
              maxScore: r.max_score,
              percentage: r.percentage ?? (r.max_score > 0 ? Math.round((r.score / r.max_score) * 100) : 0),
              correctCount: r.correct_count ?? r.score ?? 0,
              totalQuestions: r.total_questions ?? r.max_score ?? 0,
              subject: assignment?.subject || 'Quiz',
              completedAt: r.completed_at || r.created_at,
              timeSpentMs: r.time_spent_ms || 0,
              sessionId: assignment?.session_id,
              // Formative assessment fields from Supabase
              formativeAssessment: r.formative_assessment,
              teacherNotes: r.teacher_notes,
              sharedWithStudent: r.shared_with_student,
              sharedAt: r.shared_at,
            };
          });
          
          // Calculate averages - EXCLUDE individual work for consistency with ClassResultsGrid
          const resultsForAverage = studentResults.filter(r => 
            r.assignmentType !== 'individual' && r.assignmentType !== 'task'
          );
          const totalPercentage = resultsForAverage.reduce((sum, r) => sum + r.percentage, 0);
          const averageScore = resultsForAverage.length > 0 ? Math.round(totalPercentage / resultsForAverage.length) : 0;
          
          const profile: StudentProfile = {
            id: student.id,
            name: student.name,
            initials: student.initials || student.name.charAt(0).toUpperCase(),
            color: student.color || '#6366F1',
            classId: student.class_id || '',
            className: student.class_name || '',
            totalAssignments: assignments.length,
            completedAssignments: studentResults.length,
            averageScore,
            lastActive: student.last_seen || student.created_at,
            results: studentResults,
          };
          
          setProfile(profile);
          
          // Load received evaluations
          console.log('[StudentProfile] Loading evaluations for student:', studentId);
          const evals = await getStudentReceivedEvaluations(studentId);
          console.log('[StudentProfile] Received evaluations:', evals);
          setReceivedEvaluations(evals);
          
          setLoading(false);
          return;
        } catch (error) {
          console.error('Error loading student from Supabase:', error);
          setProfile(null);
          setLoading(false);
          return;
        }
      }
      
      // Use demo data
      setProfile(generateDemoStudentProfile(studentId)); 
      setLoading(false);
    }
    
    loadStudentData();
  }, [studentId, useSupabase]);
  
  // Subject-specific results (but always include live quiz and individual results)
  const subjectResults = useMemo(() => {
    if (!profile) return [];
    return profile.results.filter(r => 
      r.subject === selectedSubject || 
      r.assignmentType === 'live' || 
      r.assignmentType === 'individual' ||
      r.subject === 'Quiz'
    );
  }, [profile, selectedSubject]);
  
  // Subject-specific stats
  const subjectStats = useMemo(() => {
    if (subjectResults.length === 0) return { average: 0, tests: 0, practice: 0, individual: 0, chartData: [] };
    
    // Count 'live' as 'test' for display purposes
    const tests = subjectResults.filter(r => r.assignmentType === 'test' || r.assignmentType === 'live').length;
    const practice = subjectResults.filter(r => r.assignmentType === 'practice').length;
    const individual = subjectResults.filter(r => r.assignmentType === 'individual').length;
    
    // Calculate average - optionally exclude individual work
    const resultsForAverage = includeIndividualInAverage 
      ? subjectResults 
      : subjectResults.filter(r => r.assignmentType !== 'individual');
    
    const average = resultsForAverage.length > 0 
      ? Math.round(resultsForAverage.reduce((sum, r) => sum + r.percentage, 0) / resultsForAverage.length) 
      : 0;
    
    // Chart data - sorted by date
    const chartData = [...resultsForAverage]
      .sort((a, b) => parseISO(a.completedAt).getTime() - parseISO(b.completedAt).getTime())
      .map(r => ({
        date: parseISO(r.completedAt),
        percentage: r.percentage,
        title: r.assignmentTitle,
      }));
    
    return { average, tests, practice, individual, chartData };
  }, [subjectResults, includeIndividualInAverage]);
  
  const filteredResults = useMemo(() => {
    if (filter === 'all') return subjectResults;
    // Include 'live' in 'test' filter
    if (filter === 'test') {
      return subjectResults.filter(r => r.assignmentType === 'test' || r.assignmentType === 'live');
    }
    return subjectResults.filter(r => r.assignmentType === filter);
  }, [subjectResults, filter]);
  
  const handleViewDetail = (result: StudentResult) => { 
    console.log('View detail for:', result.assignmentTitle, 'sessionId:', result.sessionId, 'type:', result.assignmentType);
    
    if (result.assignmentType === 'individual') {
      // For individual work, navigate with assignment ID and class info
      const boardTitle = result.assignmentTitle.replace(' - ind.', '');
      navigate(`/quiz/results/${result.assignmentId}?type=shared&studentFilter=${profile?.id || ''}&title=${encodeURIComponent(boardTitle)}&individual=true&classId=${profile?.classId || ''}`);
    } else if (result.sessionId) {
      // Navigate to quiz results with student view mode
      navigate(`/quiz/results/${result.sessionId}?viewMode=student&studentId=${profile?.name || ''}&type=live`);
    }
  };
  
  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
    </div>
  );
  
  if (!profile) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-center p-8 bg-white rounded-2xl shadow-lg max-w-md">
        {useSupabase ? (
          <>
            <Database className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Supabase mód</h2>
            <p className="text-slate-600 mb-4">
              Profil studenta ze Supabase zatím není k dispozici. 
              Data se ukládají při vytvoření testů a procvičování.
            </p>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Zpět
            </button>
          </>
        ) : (
          <>
            <User className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">Student nenalezen</p>
          </>
        )}
      </div>
    </div>
  );
  
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        {/* Left Sidebar - Green with student list - ALWAYS visible on desktop */}
        <aside 
          className="sticky top-0 h-screen shrink-0 flex-col transition-all duration-300 ease-in-out hidden lg:flex"
          style={{ backgroundColor: '#084939', width: '312px', minWidth: '312px' }}
        >
          <div className="h-full flex flex-col" style={{ backgroundColor: '#084939' }}>
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
        
        {/* Mobile sidebar */}
        {sidebarOpen && (
          <>
            <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
            <aside 
              className="fixed left-0 top-0 h-screen z-30 w-[294px] flex flex-col lg:hidden"
              style={{ backgroundColor: '#084939' }}
            >
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <div className="w-20 h-10 text-white"><VividLogo /></div>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-20">
                <div className="px-1 pb-3">
                  <button onClick={() => navigate('/library/my-classes')} className="flex items-center gap-2 text-white/70 hover:text-white text-sm py-2">
                    <ArrowLeft className="w-4 h-4" />Zpět na třídy
                  </button>
                </div>
                <div className="px-1 pb-3 flex items-center gap-2 text-white">
                  <Users className="w-5 h-5" /><span className="font-semibold">Třída {profile.className}</span>
                </div>
                <div className="space-y-1">
                  {classStudents.map((student) => (
                    <button
                      key={student.id}
                      onClick={() => { navigate(`/library/student/${student.id}`); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${student.id === studentId ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10'}`}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: student.color }}>{student.initials}</div>
                      <span className="text-sm font-medium truncate flex-1 text-left">{student.name}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${student.averageScore >= 80 ? 'bg-emerald-500/20 text-emerald-300' : student.averageScore >= 60 ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>{student.averageScore}%</span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </>
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
            {/* Profile Card - Simplified header */}
            <div className="bg-white rounded-3xl shadow-lg overflow-hidden mb-6">
              <div className="px-6 pt-6 pb-4">
                {/* Student info row */}
                <div className="flex items-center gap-4 mb-4">
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md"
                    style={{ backgroundColor: profile.color }}
                  >
                    {profile.initials}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800">{profile.name}</h1>
                    <p className="text-slate-500 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Třída {profile.className}
                    </p>
                  </div>
                </div>
                
                {/* Subject tabs */}
                <div className="flex items-center gap-2 mt-4 mb-2">
                  {STUDENT_SUBJECTS.map((subject) => (
                    <button
                      key={subject}
                      onClick={() => setSelectedSubject(subject)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        selectedSubject === subject
                          ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full ${selectedSubject === subject ? 'bg-indigo-500' : 'bg-slate-400'}`} />
                      {subject}
                    </button>
                  ))}
                </div>
                
                <div className="grid grid-cols-4 gap-3 mt-4">
                  <button 
                    onClick={() => setShowAverageChart(!showAverageChart)}
                    className="rounded-2xl p-4 text-center transition-all hover:scale-105 cursor-pointer"
                    style={{ backgroundColor: getScoreBgColor(subjectStats.average) }}
                  >
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="text-3xl font-bold" style={{ color: getScoreColor(subjectStats.average) }}>{subjectStats.average}%</span>
                      {subjectStats.average >= 75 && <TrendingUp className="w-5 h-5 text-emerald-500" />}
                      {subjectStats.average < 60 && <TrendingDown className="w-5 h-5 text-red-500" />}
                      {subjectStats.average >= 60 && subjectStats.average < 75 && <Minus className="w-5 h-5 text-slate-400" />}
                    </div>
                    <p className="text-xs text-slate-600 flex items-center justify-center gap-1">
                      Průměr
                      <BarChart3 className="w-3 h-3" />
                      {showAverageChart ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </p>
                  </button>
                  <div className="bg-slate-50 rounded-2xl p-4 text-center"><div className="text-2xl font-bold text-slate-800">{subjectStats.tests}</div><p className="text-xs text-slate-500">Testů</p></div>
                  <div className="bg-slate-50 rounded-2xl p-4 text-center"><div className="text-2xl font-bold text-slate-800">{subjectStats.practice}</div><p className="text-xs text-slate-500">Procvič.</p></div>
                  <div className="bg-slate-50 rounded-2xl p-4 text-center"><div className="text-2xl font-bold text-slate-800">{subjectStats.individual}</div><p className="text-xs text-slate-500">Samost.</p></div>
                </div>
                
                {/* Average Chart - Smooth Area Chart */}
                {showAverageChart && (
                  <div className="mt-4 p-6 bg-white rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-medium text-slate-700">Vývoj výsledků</h4>
                      <button
                        onClick={() => setShowAverageSettings(!showAverageSettings)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <Settings className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>
                    
                    {/* Settings */}
                    {showAverageSettings && (
                      <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeIndividualInAverage}
                            onChange={(e) => setIncludeIndividualInAverage(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Zahrnout samostatnou práci do průměru
                        </label>
                      </div>
                    )}
                    
                    {subjectStats.chartData.length > 0 ? (
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
                          <div className="border-t border-dashed border-slate-200" />
                          <div className="border-t border-dashed border-slate-200" />
                          <div className="border-t border-dashed border-slate-200" />
                        </div>
                        {/* SVG Chart */}
                        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#22C55E" stopOpacity="0.4" />
                              <stop offset="100%" stopColor="#22C55E" stopOpacity="0.05" />
                            </linearGradient>
                          </defs>
                          {/* Area fill */}
                          <path
                            d={(() => {
                              const data = subjectStats.chartData;
                              if (data.length === 0) return '';
                              const stepX = 100 / Math.max(data.length - 1, 1);
                              let path = `M 0 ${100 - data[0].percentage}`;
                              
                              // Create smooth curve using quadratic bezier
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
                            fill="url(#areaGradient)"
                          />
                          {/* Line */}
                          <path
                            d={(() => {
                              const data = subjectStats.chartData;
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
                          {subjectStats.chartData.map((point, idx) => {
                            const stepX = 100 / Math.max(subjectStats.chartData.length - 1, 1);
                            const left = `${idx * stepX}%`;
                            const bottom = `${point.percentage}%`;
                            return (
                              <div
                                key={idx}
                                className="absolute w-2 h-2 -ml-1 -mb-1 rounded-full bg-emerald-500 border-2 border-white shadow-sm cursor-pointer hover:scale-150 transition-transform group"
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
                        {subjectStats.chartData.length > 0 && (
                          <>
                            <span>{subjectStats.chartData[0].date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}</span>
                            {subjectStats.chartData.length > 2 && (
                              <span>{subjectStats.chartData[Math.floor(subjectStats.chartData.length / 2)].date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}</span>
                            )}
                            <span>{subjectStats.chartData[subjectStats.chartData.length - 1].date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}</span>
                          </>
                        )}
                      </div>
                    </div>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">
                        Zatím nejsou žádné výsledky k zobrazení.
                      </p>
                    )}
                  </div>
                )}
                <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center"><Trophy className="w-6 h-6 text-white" /></div>
                    <div>
                      <h3 className="font-semibold text-emerald-800">{subjectStats.average >= 80 ? 'Výborný výkon!' : subjectStats.average >= 60 ? 'Dobrá práce!' : 'Pokračuj v učení!'}</h3>
                      <p className="text-sm text-emerald-700">{subjectStats.average >= 75 ? 'Tvé výsledky jsou skvělé! 📈' : subjectStats.average >= 60 ? 'Udržuješ stabilní výkon' : 'Zkus se více soustředit'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Filter tabs */}
            <div className="bg-white rounded-2xl shadow-sm p-2 mb-6 flex gap-1">
              {[
                { key: 'all', label: 'Vše', count: subjectResults.length },
                { key: 'test', label: 'Testy', count: subjectStats.tests },
                { key: 'practice', label: 'Procvičování', count: subjectStats.practice },
                { key: 'individual', label: 'Samostatné', count: subjectStats.individual },
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
            
            {/* Received Evaluations from Teacher */}
            {receivedEvaluations.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-purple-500" />
                  <h3 className="text-lg font-semibold text-slate-800">Hodnocení od učitele</h3>
                </div>
                
                <div className="space-y-4">
                  {receivedEvaluations.map(({ evaluation, studentEvaluation }) => (
                    <div 
                      key={studentEvaluation.id}
                      className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 border border-purple-200"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-semibold text-purple-900">
                            {evaluation?.title || 'Hodnocení'}
                          </h4>
                          <p className="text-sm text-purple-600">
                            {evaluation?.sent_at && format(parseISO(evaluation.sent_at), 'd. MMMM yyyy', { locale: cs })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-purple-200 rounded-full">
                          <Trophy className="w-4 h-4 text-purple-700" />
                          <span className="text-sm font-medium text-purple-700">
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
                          <span className="text-sm text-purple-700">Průměr za období:</span>
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
                            <span className="text-sm text-purple-600">
                              ({studentEvaluation.results_count} aktivit)
                            </span>
                          )}
                        </div>
                      )}
                      
                      <div className="bg-white/60 rounded-xl p-4">
                        <div 
                          className="text-slate-700 leading-relaxed prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ 
                            __html: formatEvaluationText(studentEvaluation.final_text || 'Hodnocení není k dispozici.')
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Results feed */}
            <div className="space-y-4 pb-8">
              {filteredResults.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center">
                  <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Žádné výsledky v této kategorii</p>
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
          </div>
        </main>
      </div>
    </div>
  );
}

export default StudentProfilePage;
