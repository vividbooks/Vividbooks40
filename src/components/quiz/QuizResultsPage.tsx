/**
 * Quiz Results Page
 * 
 * Comprehensive results view after a quiz session ends
 * - Přehled (Overview): Stats, success chart, student list
 * - Aktivity (Activities): Breakdown by question
 * - Studenti (Students): Individual student results
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ref, onValue, off, get } from 'firebase/database';
import { database } from '../../utils/firebase-config';
import {
  ArrowLeft,
  RefreshCw,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  BarChart2,
  Printer,
  Share2,
  Settings,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
  Send,
  Edit3,
  MessageSquare,
  Camera,
  Upload,
  Trash2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  Quiz,
  QuizSlide,
  ABCActivitySlide,
  OpenActivitySlide,
  VotingActivitySlide,
  BoardActivitySlide,
  BoardPost,
  SlideResponse,
  LiveQuizSession,
} from '../../types/quiz';
import { MathText } from '../math/MathText';
import { 
  getClasses, 
  ClassGroup, 
  syncQuizResultsToClass, 
  QuizSessionResult,
  saveFormativeAssessment,
  shareFormativeAssessment,
  getResultByStudentAndSession,
} from '../../utils/supabase/classes';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { 
  generateFormativeAssessment, 
} from '../../utils/ai-formative-assessment';

const QUIZ_SESSIONS_PATH = 'quiz_sessions';
const QUIZ_SHARES_PATH = 'quiz_shares';

interface StudentResult {
  id: string;
  studentDbId?: string; // Database ID for matching with student profile
  name: string;
  responses: SlideResponse[];
  correctCount: number;
  totalAnswered: number;
  successRate: number;
  totalTime: number;
}

interface QuestionStats {
  slideId: string;
  question: string;
  type: string;
  activityType?: string;
  options?: { id: string; label: string; content: string; isCorrect: boolean }[];
  answerCounts: Record<string, number>;
  correctAnswer?: string;
  totalResponses: number;
  averageTime: number;
}

// Removed tabs - now using two-column layout

export function QuizResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const sessionType = searchParams.get('type') || 'live';
  const studentFilter = searchParams.get('studentFilter'); // Filter to show only specific student
  const viewMode = searchParams.get('viewMode'); // 'student' for student/parent view
  const studentIdParam = searchParams.get('studentId'); // Student ID for student view
  const isStudentView = viewMode === 'student';
  
  const [session, setSession] = useState<LiveQuizSession | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'success' | 'time'>('name');
  
  // Voting and board results
  const [votingResults, setVotingResults] = useState<Record<string, Record<string, { selectedOptions: string[]; voterName?: string }>>>({});
  const [boardPosts, setBoardPosts] = useState<Record<string, BoardPost[]>>({});
  
  // Sync to class state
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<ClassGroup[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('Matematika');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // First-time setup dialog state
  const [showFirstTimeSetup, setShowFirstTimeSetup] = useState(false);
  const [setupClassId, setSetupClassId] = useState('');
  const [setupSubject, setSetupSubject] = useState('');
  const [suggestedClassName, setSuggestedClassName] = useState('');
  const [hasCheckedSync, setHasCheckedSync] = useState(false);
  
  // Settings dropdown state
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  
  // Delete results state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'all' | 'student'>('all');
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Activity sorting state
  const [activitySort, setActivitySort] = useState<'default' | 'easiest' | 'hardest'>('default');
  
  // AI Recommendations state
  const [classRecommendation, setClassRecommendation] = useState('');
  const [isGeneratingRecommendation, setIsGeneratingRecommendation] = useState(false);
  const [recommendationSaved, setRecommendationSaved] = useState(false);
  
  // Left column tabs state - start on 'students' tab if in student view
  const [leftTab, setLeftTab] = useState<'class' | 'students'>(isStudentView ? 'students' : 'class');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null); // Will be set by useEffect for student view
  
  // Formative assessment state
  const [showEvaluationPanel, setShowEvaluationPanel] = useState(false);
  const [teacherNotes, setTeacherNotes] = useState('');
  const [generatedAssessment, setGeneratedAssessment] = useState('');
  const [isGeneratingAssessment, setIsGeneratingAssessment] = useState(false);
  const [currentResultId, setCurrentResultId] = useState<string | null>(null); // Supabase result ID
  const [isEvaluationSaved, setIsEvaluationSaved] = useState(false);
  const [isEvaluationShared, setIsEvaluationShared] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedAssessment, setEditedAssessment] = useState('');
  
  // Ref to track last loaded student to prevent unnecessary reloads
  const lastLoadedStudentRef = React.useRef<string | null>(null);
  // Ref to protect against overwriting freshly saved assessment
  const justSavedRef = React.useRef(false);
  
  // Load available classes for sync
  useEffect(() => {
    async function loadClasses() {
      try {
        const classes = await getClasses();
        setAvailableClasses(classes);
      } catch (error) {
        console.error('Failed to load classes:', error);
      }
    }
    loadClasses();
  }, []);
  
  // Check if results need to be synced (first time setup) - skip for student view
  useEffect(() => {
    async function checkIfNeedsSync() {
      // Early exit conditions
      if (isStudentView || !sessionId) return;
      
      // Check localStorage FIRST - before any other checks
      const dismissedKey = `quiz_setup_dismissed_${sessionId}`;
      const wasDismissed = localStorage.getItem(dismissedKey);
      if (wasDismissed) {
        console.log('[FirstTimeSetup] User dismissed dialog previously, skipping');
        return;
      }
      
      // Only proceed if we have all data
      if (hasCheckedSync || !session?.students || availableClasses.length === 0) return;
      
      setHasCheckedSync(true);
      
      // Check if assignment already exists for this session
      const projectId = 'njbtqmsxbyvpwigfceke';
      const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';
      
      try {
        const res = await fetch(`https://${projectId}.supabase.co/rest/v1/assignments?session_id=eq.${sessionId}&select=id,class_recommendation`, {
          headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` }
        });
        
        if (res.ok) {
          const assignments = await res.json();
          if (assignments.length > 0) {
            console.log('[FirstTimeSetup] Results already synced, skipping dialog');
            
            // Load saved recommendation if exists
            if (assignments[0].class_recommendation) {
              setClassRecommendation(assignments[0].class_recommendation);
              setRecommendationSaved(true);
              console.log('[Recommendation] Loaded saved recommendation');
            }
            
            return; // Already synced
          }
        }
        
        // Not synced - try to detect class from students
        const students = Object.values(session.students);
        const studentClassIds = students
          .map((s: any) => s.classId)
          .filter(Boolean);
        
        // Find most common class
        const classCount: Record<string, number> = {};
        studentClassIds.forEach((cid: string) => {
          classCount[cid] = (classCount[cid] || 0) + 1;
        });
        
        let suggestedClass = '';
        let maxCount = 0;
        Object.entries(classCount).forEach(([cid, count]) => {
          if (count > maxCount) {
            maxCount = count;
            suggestedClass = cid;
          }
        });
        
        // Get subject from quiz
        const detectedSubject = quiz?.subject || 'Matematika';
        
        // Find class name
        const matchedClass = availableClasses.find(c => c.id === suggestedClass);
        
        console.log('[FirstTimeSetup] Showing dialog, suggested class:', matchedClass?.name, 'subject:', detectedSubject);
        
        setSetupClassId(suggestedClass);
        setSetupSubject(detectedSubject);
        setSuggestedClassName(matchedClass?.name || '');
        setShowFirstTimeSetup(true);
        
      } catch (error) {
        console.error('[FirstTimeSetup] Error checking sync status:', error);
      }
    }
    
    checkIfNeedsSync();
  }, [sessionId, session, quiz, availableClasses, hasCheckedSync]);
  
  // Handle first time setup confirmation
  const handleFirstTimeSetupConfirm = async () => {
    if (!setupClassId || !session?.students || !quiz || !sessionId) return;
    
    setIsSyncing(true);
    
    // Build student results
    const results: QuizSessionResult[] = Object.entries(session.students).map(([_, student]) => {
      const responses = student.responses || [];
      const totalCorrect = responses.filter(r => r.isCorrect === true).length;
      const totalQuestions = responses.length;
      const timeSpentMs = responses.reduce((sum, r) => sum + (r.timeSpentMs || 0), 0);
      
      return {
        studentName: student.name,
        studentId: (student as any).studentDbId,
        responses: responses.map(r => ({
          slideId: r.slideId,
          answer: r.answer,
          isCorrect: r.isCorrect,
        })),
        totalCorrect,
        totalQuestions,
        timeSpentMs,
      };
    });
    
    const syncResult = await syncQuizResultsToClass(
      setupClassId,
      quiz.id,
      quiz.title,
      sessionId,
      results,
      setupSubject
    );
    
    setIsSyncing(false);
    
    if (syncResult.success) {
      console.log('[FirstTimeSetup] Sync successful');
      setShowFirstTimeSetup(false);
      setSyncSuccess(true);
      setSelectedClassId(setupClassId);
    } else {
      alert('Nepodařilo se uložit výsledky: ' + syncResult.error);
    }
  };
  
  // Generate formative assessment
  const handleGenerateAssessment = async () => {
    // Use selectedStudent (local state) instead of filteredStudent (URL param)
    const targetStudent = selectedStudent || filteredStudent;
    if (!targetStudent || !quiz) return;
    
    // Protect against reload during and after generation
    justSavedRef.current = true;
    setIsGeneratingAssessment(true);
    
    // Build questions data
    const questions = questionStats.map(stat => {
      const response = targetStudent.responses.find(r => r.slideId === stat.slideId);
      return {
        question: stat.question,
        studentAnswer: response ? String(response.answer) : 'Bez odpovědi',
        correctAnswer: stat.correctAnswer,
        isCorrect: response?.isCorrect || false,
        type: stat.activityType || 'unknown',
      };
    });
    
    const result = await generateFormativeAssessment({
      quizTitle: quiz.title,
      subjectName: 'Kvíz', // Could be improved with actual subject
      studentPerformance: {
        studentName: targetStudent.name,
        totalCorrect: targetStudent.correctCount,
        totalQuestions: targetStudent.totalAnswered,
        successRate: targetStudent.successRate,
        totalTimeSeconds: targetStudent.totalTime,
        questions,
      },
      teacherNotes: teacherNotes || undefined,
    });
    
    setIsGeneratingAssessment(false);
    
    if (result.success && result.assessment) {
      setGeneratedAssessment(result.assessment);
      setEditedAssessment(result.assessment);
    } else {
      alert(result.error || 'Nepodařilo se vygenerovat hodnocení');
    }
  };
  
  // Save assessment to Supabase
  const handleSaveAssessment = async () => {
    if (!currentResultId || !generatedAssessment) {
      console.log('[Save] No result ID or assessment to save');
      return;
    }
    
    const assessmentText = isEditing ? editedAssessment : generatedAssessment;
    
    console.log('[Save] Saving to Supabase, resultId:', currentResultId);
    
    // Set protection flag to prevent useEffect from overwriting
    justSavedRef.current = true;
    
    const result = await saveFormativeAssessment(currentResultId, assessmentText, teacherNotes);
    
    if (result.success) {
      console.log('[Save] ✅ Saved successfully');
      setIsEvaluationSaved(true);
      setGeneratedAssessment(assessmentText);
      setIsEditing(false);
      
      // Keep protection for 3 seconds to allow Supabase to propagate
      setTimeout(() => {
        justSavedRef.current = false;
      }, 3000);
    } else {
      console.error('[Save] ❌ Failed:', result.error);
      justSavedRef.current = false;
      alert('Nepodařilo se uložit hodnocení: ' + result.error);
    }
  };
  
  // Delete results - all or for specific student
  const handleDeleteResults = async () => {
    setIsDeleting(true);
    try {
      const classIdParam = searchParams.get('classId');
      
      if (deleteMode === 'all') {
        // Delete all results for this assignment/session
        if (sessionType === 'paper_test') {
          // Paper test - delete from results table
          const { error } = await supabase
            .from('results')
            .delete()
            .eq('assignment_id', sessionId);
          
          if (error) throw error;
          
          // Also delete the assignment itself
          const { error: assignmentError } = await supabase
            .from('assignments')
            .delete()
            .eq('id', sessionId);
          
          if (assignmentError) console.error('Error deleting assignment:', assignmentError);
          
          toast.success('Výsledky a test byly smazány');
          
          // Navigate back to class or home
          if (classIdParam) {
            navigate(`/library/my-classes?classId=${classIdParam}`);
          } else {
            navigate('/library/my-classes');
          }
        } else {
          // Live session - delete from session history
          // Note: This may require additional implementation for Firebase sessions
          toast.info('Pro živé session použijte Firebase konzoli');
        }
      } else if (deleteMode === 'student' && studentToDelete) {
        // Delete results for specific student
        if (sessionType === 'paper_test') {
          const { error } = await supabase
            .from('results')
            .delete()
            .eq('assignment_id', sessionId)
            .eq('student_id', studentToDelete);
          
          if (error) throw error;
          
          // Also clear localStorage answers
          localStorage.removeItem(`paper-test-answers-${sessionId}-${studentToDelete}`);
          
          toast.success('Výsledky žáka byly smazány');
          
          // Reload page to refresh data
          window.location.reload();
        } else {
          toast.info('Mazání jednotlivých výsledků z živé session není podporováno');
        }
      }
    } catch (error: any) {
      console.error('Error deleting results:', error);
      toast.error(`Chyba při mazání: ${error.message}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setStudentToDelete(null);
    }
  };
  
  // Open delete dialog for specific student
  const openDeleteStudentDialog = (studentId: string) => {
    setDeleteMode('student');
    setStudentToDelete(studentId);
    setShowDeleteDialog(true);
  };
  
  // Share with student via Supabase
  const handleShareWithStudent = async () => {
    if (!currentResultId) {
      console.log('[Share] No result ID');
      return;
    }
    
    // Save first if not saved
    if (!isEvaluationSaved && generatedAssessment) {
      await handleSaveAssessment();
    }
    
    console.log('[Share] Sharing with student, resultId:', currentResultId);
    
    const result = await shareFormativeAssessment(currentResultId);
    
    if (result.success) {
      console.log('[Share] ✅ Shared successfully');
      setIsEvaluationShared(true);
      alert('Hodnocení bylo sdíleno se studentem!');
    } else {
      console.error('[Share] ❌ Failed:', result.error);
      alert('Nepodařilo se sdílet hodnocení: ' + result.error);
    }
  };
  
  // Generate class recommendations using AI
  const handleGenerateClassRecommendation = async () => {
    if (!quiz || !session?.students || studentResults.length === 0) return;
    
    setIsGeneratingRecommendation(true);
    
    try {
      // Build comprehensive data for AI analysis
      const classData = {
        quizTitle: quiz.title,
        totalStudents: studentResults.length,
        averageSuccessRate: overallStats.avgSuccessRate,
        questions: questionStats.map(stat => {
          const correctCount = stat.correctAnswer ? (stat.answerCounts[stat.correctAnswer] || 0) : 0;
          const successRate = stat.totalResponses > 0 ? Math.round((correctCount / stat.totalResponses) * 100) : 0;
          return {
            question: stat.question,
            type: stat.activityType,
            successRate,
            totalResponses: stat.totalResponses,
            correctAnswer: stat.correctAnswer,
            answerDistribution: stat.answerCounts,
          };
        }),
        students: studentResults.map(s => ({
          name: s.name,
          correctCount: s.correctCount,
          totalAnswered: s.totalAnswered,
          successRate: s.successRate,
          timeSpent: s.totalTime,
          answers: s.responses.map(r => ({
            slideId: r.slideId,
            answer: r.answer,
            isCorrect: r.isCorrect,
          })),
        })),
      };
      
      // Check for similar answers (potential cheating)
      const answerPatterns: Record<string, string[]> = {};
      studentResults.forEach(student => {
        const pattern = student.responses.map(r => String(r.answer)).join('|');
        if (!answerPatterns[pattern]) {
          answerPatterns[pattern] = [];
        }
        answerPatterns[pattern].push(student.name);
      });
      
      const suspiciousPairs = Object.entries(answerPatterns)
        .filter(([_, names]) => names.length > 1)
        .map(([_, names]) => names);
      
      const prompt = `Jsi učitel analyzující výsledky testu "${quiz.title}".

SHRNUTÍ TESTU:
- Počet studentů: ${classData.totalStudents}
- Průměrná úspěšnost: ${Math.round(classData.averageSuccessRate)}%

OTÁZKY A ÚSPĚŠNOST:
${classData.questions.map((q, i) => `${i + 1}. "${q.question}" - úspěšnost: ${q.successRate}% (${q.totalResponses} odpovědí)`).join('\n')}

VÝSLEDKY STUDENTŮ:
${classData.students.map(s => `- ${s.name}: ${s.successRate}% (${s.correctCount}/${s.totalAnswered})`).join('\n')}

${suspiciousPairs.length > 0 ? `UPOZORNĚNÍ - Studenti se stejnými odpověďmi:\n${suspiciousPairs.map(pair => `- ${pair.join(', ')}`).join('\n')}` : ''}

Na základě těchto dat prosím poskytni učiteli:
1. Hlavní závěry z testu (co třída zvládla, co ne)
2. Konkrétní doporučení na co se zaměřit
3. Upozornění na jednotlivé studenty, kteří potřebují pozornost
4. Případná podezření nebo zajímavé vzorce v datech

Piš stručně, prakticky a v češtině. Formátuj přehledně s odrážkami.`;

      const { chatWithAIProxy } = await import('../../utils/ai-chat-proxy');
      
      const recommendation = await chatWithAIProxy(
        [
          { role: 'system', content: 'Jsi zkušený učitel, který analyzuje výsledky testů a dává praktická doporučení.' },
          { role: 'user', content: prompt }
        ],
        'gpt-4o-mini',
        { max_tokens: 1000, temperature: 0.7 }
      );
      
      setClassRecommendation(recommendation);
      setRecommendationSaved(false);
      
    } catch (error) {
      console.error('[Recommendation] Error:', error);
      alert('Nepodařilo se vygenerovat doporučení');
    } finally {
      setIsGeneratingRecommendation(false);
    }
  };
  
  // Save class recommendation to Supabase
  const handleSaveRecommendation = async () => {
    if (!classRecommendation || !sessionId) return;
    
    try {
      const projectId = 'njbtqmsxbyvpwigfceke';
      const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';
      
      // Find assignment for this session
      const assignmentRes = await fetch(
        `https://${projectId}.supabase.co/rest/v1/assignments?session_id=eq.${sessionId}&select=id`,
        { headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` } }
      );
      
      if (assignmentRes.ok) {
        const assignments = await assignmentRes.json();
        if (assignments.length > 0) {
          // Update assignment with recommendation
          const updateRes = await fetch(
            `https://${projectId}.supabase.co/rest/v1/assignments?id=eq.${assignments[0].id}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': apiKey,
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
              },
              body: JSON.stringify({ class_recommendation: classRecommendation }),
            }
          );
          
          if (updateRes.ok) {
            setRecommendationSaved(true);
            console.log('[Recommendation] Saved successfully');
          }
        }
      }
    } catch (error) {
      console.error('[Recommendation] Save error:', error);
    }
  };
  
  // Sync results to class
  const handleSyncToClass = async () => {
    if (!selectedClassId || !session?.students || !quiz || !sessionId) return;
    
    setIsSyncing(true);
    setSyncSuccess(false);
    
    // Convert students to QuizSessionResult format
    const studentResults: QuizSessionResult[] = Object.entries(session.students).map(([_, student]) => {
      const responses = student.responses || [];
      const totalCorrect = responses.filter(r => r.isCorrect === true).length;
      const totalQuestions = responses.length;
      const timeSpentMs = responses.reduce((sum, r) => sum + (r.timeSpentMs || 0), 0);
      
      return {
        studentName: student.name,
        studentId: (student as any).studentDbId,
        responses: responses.map(r => ({
          slideId: r.slideId,
          answer: r.answer,
          isCorrect: r.isCorrect,
          timeSpentMs: r.timeSpentMs,
        })),
        totalCorrect,
        totalQuestions,
        timeSpentMs,
      };
    });
    
    const result = await syncQuizResultsToClass(
      selectedClassId,
      quiz.id,
      quiz.title,
      sessionId,
      studentResults,
      selectedSubject || quiz.subject || 'Kvíz'
    );
    
    setIsSyncing(false);
    
    if (result.success) {
      setSyncSuccess(true);
      setTimeout(() => {
        setShowSyncDialog(false);
        setSyncSuccess(false);
      }, 2000);
    } else {
      alert('Nepodařilo se uložit výsledky: ' + result.error);
    }
  };
  
  // Load session data based on type
  useEffect(() => {
    if (!sessionId) return;
    
    const isIndividual = searchParams.get('individual') === 'true';
    const isPaperTest = sessionType === 'paper_test';
    
    // For paper tests, load directly from Supabase
    if (isPaperTest) {
      const loadPaperTestResults = async () => {
        try {
          const classIdParam = searchParams.get('classId');
          console.log('[QuizResults] Loading paper test results, assignmentId:', sessionId, 'classId:', classIdParam);
          
          const projectId = 'njbtqmsxbyvpwigfceke';
          const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';
          
          // Get assignment
          const assignmentRes = await fetch(`https://${projectId}.supabase.co/rest/v1/assignments?id=eq.${sessionId}&select=*`, {
            headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` }
          });
          const [assignment] = await assignmentRes.json();
          
          if (!assignment) {
            console.error('[QuizResults] Assignment not found:', sessionId);
            setLoading(false);
            return;
          }
          
          console.log('[QuizResults] Assignment loaded:', assignment);
          
          // Get results for this assignment
          const resultsRes = await fetch(`https://${projectId}.supabase.co/rest/v1/results?assignment_id=eq.${sessionId}&select=*`, {
            headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` }
          });
          const results = await resultsRes.json();
          console.log('[QuizResults] Results loaded:', results.length);
          
          // Get students
          const studentsRes = await fetch(`https://${projectId}.supabase.co/rest/v1/students?class_id=eq.${assignment.class_id}&select=*`, {
            headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` }
          });
          const students = await studentsRes.json();
          console.log('[QuizResults] Students loaded:', students.length);
          
          // Build session-like structure for display
          const convertedStudents: Record<string, any> = {};
          students.forEach((student: any) => {
            const result = results.find((r: any) => r.student_id === student.id);
            
            // Load answers from Supabase result (answers column should exist after migration)
            let answers: any[] = result?.answers || [];
            
            // Fallback to localStorage if no answers in Supabase
            if (answers.length === 0) {
              const answersKey = `paper-test-answers-${sessionId}-${student.id}`;
              try {
                const storedAnswers = localStorage.getItem(answersKey);
                if (storedAnswers) {
                  answers = JSON.parse(storedAnswers);
                  console.log('[QuizResults] Loaded answers from localStorage for', student.name, ':', answers.length, 'answers');
                }
              } catch (e) {
                console.error('[QuizResults] Error loading answers from localStorage:', e);
              }
            } else {
              console.log('[QuizResults] Loaded answers from Supabase for', student.name, ':', answers.length, 'answers');
            }
            
            // Convert answers to responses format for display
            const responses = answers.map((answer: any, idx: number) => ({
              slideId: `question-${answer.questionNumber || idx + 1}`,
              answer: answer.answer || '',
              isCorrect: answer.isCorrect ?? (answer.points > 0),
              timeSpent: 0,
              points: answer.points || 0,
              maxPoints: answer.maxPoints || 1,
              questionType: answer.questionType || 'abc',
              feedback: answer.feedback || '',
            }));
            
            convertedStudents[student.id] = {
              name: student.name,
              studentDbId: student.id,
              responses, // Now populated from answers
              joinedAt: result?.created_at || assignment.created_at,
              isOnline: false,
              totalTimeMs: 0,
              completedAt: result?.created_at,
              score: result?.score ?? null,
              maxScore: result?.max_score || 10,
              percentage: result?.percentage ?? null,
              teacherComment: result?.teacher_comment,
              paperTestAnswers: answers, // Keep original format too
            };
          });
          
          setSession({
            id: sessionId,
            quizId: assignment.id,
            sessionName: assignment.title,
            createdAt: assignment.created_at,
            students: convertedStudents,
            isPaperTest: true,
          } as any);
          
          // Build quiz-like structure from assignment.questions (stored in Supabase)
          let worksheetContent: any = null;
          
          // First, try to load from assignment.questions (stored when assignment was created)
          if ((assignment as any).questions && (assignment as any).questions.length > 0) {
            worksheetContent = { questions: (assignment as any).questions };
            console.log('[QuizResults] Loaded questions from assignment:', worksheetContent.questions.length);
          }
          
          // Fallback to paper-test-content localStorage
          if (!worksheetContent) {
            const storedKeys = Object.keys(localStorage).filter(k => k.startsWith('paper-test-content-'));
            for (const key of storedKeys) {
              try {
                const stored = JSON.parse(localStorage.getItem(key) || '{}');
                if (stored.questions && stored.questions.length > 0) {
                  worksheetContent = stored;
                  console.log('[QuizResults] Using stored paper-test content from:', key);
                  break;
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
          
          // If no worksheet_content, try to load from worksheet_id or localStorage
          if (!worksheetContent && (assignment as any).worksheet_id) {
            console.log('[QuizResults] Loading worksheet from worksheet_id:', (assignment as any).worksheet_id);
            // Try localStorage first
            const storedWorksheets = localStorage.getItem('vivid-worksheets');
            if (storedWorksheets) {
              const worksheets = JSON.parse(storedWorksheets);
              const worksheet = worksheets.find((w: any) => w.id === (assignment as any).worksheet_id);
              if (worksheet?.content) {
                worksheetContent = {
                  questions: worksheet.content.map((item: any, idx: number) => ({
                    number: idx + 1,
                    type: item.type || 'abc',
                    question: item.question || item.text || '',
                    correctAnswer: item.correctAnswer || item.correct || null,
                    options: item.options || null,
                    maxPoints: item.points || (item.type === 'open' ? 2 : 1),
                  })),
                  totalQuestions: worksheet.content.length,
                };
              }
            }
          }
          
          // If still no content, try to fetch worksheet from Supabase
          if (!worksheetContent && (assignment as any).worksheet_id) {
            try {
              const wsRes = await fetch(`https://${projectId}.supabase.co/rest/v1/teacher_worksheets?id=eq.${(assignment as any).worksheet_id}&select=*`, {
                headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` }
              });
              const [worksheet] = await wsRes.json();
              if (worksheet?.content) {
                const content = typeof worksheet.content === 'string' ? JSON.parse(worksheet.content) : worksheet.content;
                worksheetContent = {
                  questions: content.map((item: any, idx: number) => ({
                    number: idx + 1,
                    type: item.type || 'abc',
                    question: item.question || item.text || '',
                    correctAnswer: item.correctAnswer || item.correct || null,
                    options: item.options || null,
                    maxPoints: item.points || (item.type === 'open' ? 2 : 1),
                  })),
                  totalQuestions: content.length,
                };
              }
            } catch (e) {
              console.error('[QuizResults] Error loading worksheet:', e);
            }
          }
          
          console.log('[QuizResults] Worksheet content:', worksheetContent);
          
          let slides: any[] = [];
          
          // First, try to create slides from worksheet content
          if (worksheetContent?.questions?.length > 0) {
            slides = worksheetContent.questions.map((q: any, idx: number) => ({
              id: `question-${idx + 1}`,
              type: 'activity',
              activityType: q.type === 'open' ? 'open' : 'abc',
              question: q.question || `Otázka ${idx + 1}`,
              correctAnswer: q.correctAnswer,
              // Map options to expected format with 'content' instead of 'text'
              options: q.options?.map((opt: any) => ({
                id: opt.label || opt.id,
                label: opt.label,
                content: opt.text || opt.content || '',
                isCorrect: opt.label === q.correctAnswer,
              })),
              maxPoints: q.maxPoints || 1,
            }));
          }
          
          // If no worksheet content, try to create slides from the first result's answers
          if (slides.length === 0 && results.length > 0) {
            const firstResultWithAnswers = results.find((r: any) => r.answers?.length > 0);
            if (firstResultWithAnswers?.answers) {
              slides = firstResultWithAnswers.answers.map((answer: any, idx: number) => ({
                id: `question-${answer.questionNumber || idx + 1}`,
                type: 'activity',
                activityType: answer.questionType === 'open' ? 'open' : 'abc',
                question: `Otázka ${answer.questionNumber || idx + 1}`,
                correctAnswer: answer.correctAnswer,
                maxPoints: answer.maxPoints || 1,
              }));
              console.log('[QuizResults] Generated slides from answers:', slides.length);
            }
          }
          
          console.log('[QuizResults] Generated slides:', slides.length);
          
          // If no slides from worksheet or answers, create a single summary slide for paper test
          const finalSlides = slides.length > 0 ? slides : [{
            id: 'paper-test-summary',
            type: 'activity',
            activityType: 'abc',
            question: 'Papírový test - hodnocení',
            isPaperTestSummary: true,
          }];
          
          setQuiz({
            id: assignment.id,
            title: assignment.title,
            slides: finalSlides,
            isPaperTest: true,
            totalQuestions: worksheetContent?.totalQuestions || finalSlides.length,
          } as any);
          
          setLoading(false);
        } catch (error) {
          console.error('[QuizResults] Error loading paper test results:', error);
          setLoading(false);
        }
      };
      
      loadPaperTestResults();
      return;
    }
    
    // For individual work, try to find Firebase session first
    if (isIndividual) {
      const loadIndividualResults = async () => {
        try {
          const classIdParam = searchParams.get('classId');
          const titleParam = searchParams.get('title');
          
          console.log('[QuizResults] Loading individual work, classId:', classIdParam, 'title:', titleParam);
          
          // Try to find Firebase session by searching quiz_shares
          if (classIdParam) {
            // Get all quiz_shares and find matching session by classId
            const sharesRef = ref(database, 'quiz_shares');
            const sharesSnapshot = await get(sharesRef);
            
            if (sharesSnapshot.exists()) {
              const allShares = sharesSnapshot.val();
              
              // Find session that matches classId and title
              for (const [shareId, shareData] of Object.entries(allShares) as [string, any][]) {
                const matchesClass = shareData.classId === classIdParam || shareId.includes(classIdParam);
                const matchesTitle = titleParam && shareData.sessionName && 
                  shareData.sessionName.toLowerCase().includes(titleParam.toLowerCase());
                
                if (matchesClass || matchesTitle) {
                  console.log('[QuizResults] Found matching Firebase session:', shareId);
                  
                  // Convert responses format
                  const convertedStudents: Record<string, any> = {};
                  if (shareData.responses) {
                    Object.entries(shareData.responses).forEach(([studentId, studentData]: [string, any]) => {
                      convertedStudents[studentId] = {
                        name: studentData.studentName || 'Anonymní',
                        studentDbId: studentId,
                        responses: studentData.responses ? Object.values(studentData.responses) : [],
                        joinedAt: studentData.joinedAt || shareData.createdAt,
                        isOnline: false,
                        totalTimeMs: studentData.totalTimeMs || 0,
                        startTime: studentData.startTime,
                        completedAt: studentData.completedAt,
                      };
                    });
                  }
                  
                  setSession({
                    ...shareData,
                    students: convertedStudents,
                  } as any);
                  
                  if (shareData.quizData) {
                    setQuiz(shareData.quizData as Quiz);
                  }
                  
                  setLoading(false);
                  return;
                }
              }
            }
          }
          
          // Fallback to Supabase if no Firebase session found
          console.log('[QuizResults] No Firebase session found, loading from Supabase');
          
          const projectId = 'njbtqmsxbyvpwigfceke';
          const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';
          
          // Get assignment
          const assignmentRes = await fetch(`https://${projectId}.supabase.co/rest/v1/assignments?id=eq.${sessionId}&select=*`, {
            headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` }
          });
          const [assignment] = await assignmentRes.json();
          
          if (!assignment) {
            setLoading(false);
            return;
          }
          
          // Get results for this assignment
          const resultsRes = await fetch(`https://${projectId}.supabase.co/rest/v1/results?assignment_id=eq.${sessionId}&select=*`, {
            headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` }
          });
          const results = await resultsRes.json();
          
          // Get students
          const studentsRes = await fetch(`https://${projectId}.supabase.co/rest/v1/students?class_id=eq.${assignment.class_id}&select=*`, {
            headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` }
          });
          const students = await studentsRes.json();
          
          // Build session-like structure for display
          const convertedStudents: Record<string, any> = {};
          results.forEach((result: any) => {
            const student = students.find((s: any) => s.id === result.student_id);
            if (student) {
              convertedStudents[student.id] = {
                name: student.name,
                studentDbId: student.id,
                responses: [],
                joinedAt: result.created_at,
                isOnline: false,
                totalTimeMs: result.time_spent_ms || 0,
                completedAt: result.completed_at,
                score: result.score,
                maxScore: result.max_score,
                percentage: result.percentage,
              };
            }
          });
          
          setSession({
            id: sessionId,
            quizId: assignment.id,
            sessionName: assignment.title,
            createdAt: assignment.created_at,
            students: convertedStudents,
          } as any);
          
          setQuiz({
            id: assignment.id,
            title: assignment.title.replace(' - ind.', ''),
            slides: [],
          } as any);
          
          setLoading(false);
        } catch (error) {
          console.error('[QuizResults] Error loading individual results:', error);
          setLoading(false);
        }
      };
      
      loadIndividualResults();
      return;
    }
    
    // For live/shared sessions, load from Firebase
    const path = sessionType === 'shared' ? QUIZ_SHARES_PATH : QUIZ_SESSIONS_PATH;
    const sessionRef = ref(database, `${path}/${sessionId}`);
    
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // For shared sessions, convert the responses format to match LiveQuizSession structure
        if (sessionType === 'shared' && data.responses) {
          const convertedStudents: Record<string, any> = {};
          Object.entries(data.responses).forEach(([studentId, studentData]: [string, any]) => {
            convertedStudents[studentId] = {
              name: studentData.studentName || 'Anonymní',
              responses: studentData.responses ? Object.values(studentData.responses) : [],
              joinedAt: studentData.joinedAt || data.createdAt,
              isOnline: false,
              // Include time tracking data
              totalTimeMs: studentData.totalTimeMs || 0,
              startTime: studentData.startTime,
              completedAt: studentData.completedAt,
            };
          });
          
          setSession({
            ...data,
            students: convertedStudents,
          } as LiveQuizSession);
        } else {
          setSession(data as LiveQuizSession);
        }
        
        if (data.quizData) {
          setQuiz(data.quizData as Quiz);
        }
      }
      setLoading(false);
    });
    
    return () => off(sessionRef);
  }, [sessionId, sessionType, searchParams]);
  
  // Load voting results for all voting slides
  useEffect(() => {
    if (!sessionId || !quiz) return;
    
    const votingSlides = quiz.slides.filter(s => s.type === 'activity' && s.activityType === 'voting');
    if (votingSlides.length === 0) return;
    
    const path = sessionType === 'shared' ? QUIZ_SHARES_PATH : QUIZ_SESSIONS_PATH;
    
    votingSlides.forEach(slide => {
      const votesRef = ref(database, `${path}/${sessionId}/votes/${slide.id}`);
      onValue(votesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setVotingResults(prev => ({ ...prev, [slide.id]: data }));
        }
      });
    });
    
    return () => {
      votingSlides.forEach(slide => {
        const votesRef = ref(database, `${path}/${sessionId}/votes/${slide.id}`);
        off(votesRef);
      });
    };
  }, [sessionId, sessionType, quiz]);
  
  // Load board posts for all board slides
  useEffect(() => {
    if (!sessionId || !quiz) return;
    
    const boardSlides = quiz.slides.filter(s => s.type === 'activity' && s.activityType === 'board');
    if (boardSlides.length === 0) return;
    
    const path = sessionType === 'shared' ? QUIZ_SHARES_PATH : QUIZ_SESSIONS_PATH;
    
    boardSlides.forEach(slide => {
      const postsRef = ref(database, `${path}/${sessionId}/boardPosts/${slide.id}`);
      onValue(postsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const postsArray = Object.entries(data).map(([key, post]: [string, any]) => ({
            id: key,
            text: post.text || '',
            mediaUrl: post.mediaUrl,
            mediaType: post.mediaType,
            authorName: post.authorName || 'Anonymní',
            authorId: post.authorId || '',
            likes: Array.isArray(post.likes) ? post.likes : Object.keys(post.likes || {}),
            createdAt: post.createdAt || Date.now(),
            backgroundColor: post.backgroundColor,
            column: post.column,
          }));
          setBoardPosts(prev => ({ ...prev, [slide.id]: postsArray }));
        }
      });
    });
    
    return () => {
      boardSlides.forEach(slide => {
        const postsRef = ref(database, `${path}/${sessionId}/boardPosts/${slide.id}`);
        off(postsRef);
      });
    };
  }, [sessionId, sessionType, quiz]);
  
  // Calculate student results
  const studentResults: StudentResult[] = React.useMemo(() => {
    if (!session?.students || !quiz) {
      console.log('[StudentResults] No session.students or quiz:', { hasStudents: !!session?.students, hasQuiz: !!quiz });
      return [];
    }
    
    const activitySlides = quiz.slides.filter(s => s.type === 'activity');
    
    let entries = Object.entries(session.students);
    console.log('[StudentResults] All students:', entries.length, entries.map(([id, s]) => s.name));
    
    // Filter to specific student if studentFilter is set (but NOT in student view mode)
    // In student view mode, we show all students and auto-select via useEffect
    if (studentFilter && !isStudentView) {
      console.log('[QuizResults] Filtering by studentFilter:', studentFilter);
      console.log('[QuizResults] Available students:', entries.map(([id, s]) => ({
        id,
        name: s.name,
        studentDbId: (s as any).studentDbId
      })));
      
      // Try to find the student name from the filter (for matching)
      const decodedFilter = decodeURIComponent(studentFilter);
      
      entries = entries.filter(([id, student]) => {
        const studentDbId = (student as any).studentDbId;
        // Match by studentDbId, Firebase session ID, or name
        return studentDbId === studentFilter || 
               id === studentFilter || 
               student.name === decodedFilter ||
               student.name.toLowerCase() === decodedFilter.toLowerCase();
      });
      
      console.log('[QuizResults] Filtered entries:', entries.length);
      
      // If still no match and only one student exists, don't filter
      if (entries.length === 0) {
        console.log('[QuizResults] No match found, showing all students');
        entries = Object.entries(session.students);
      }
    } else if (isStudentView) {
      console.log('[StudentView] Showing all students, will auto-select via useEffect');
    }
    
    return entries.map(([id, student]) => {
      const responses = student.responses || [];
      
      // For individual work from Supabase, we have score/maxScore directly on student
      const studentData = student as any;
      const hasDirectScore = studentData.score !== undefined;
      
      const correctCount = hasDirectScore ? studentData.score : responses.filter(r => r.isCorrect).length;
      const totalAnswered = hasDirectScore ? studentData.maxScore : responses.length;
      
      // Use totalTimeMs from session if available (more accurate), otherwise sum up slide times
      const slidesTime = responses.reduce((sum, r) => sum + (r.timeSpent || 0), 0);
      const totalTime = studentData.totalTimeMs 
        ? Math.round(studentData.totalTimeMs / 1000) // Convert ms to seconds
        : slidesTime;
      
      const successRate = hasDirectScore && studentData.percentage !== undefined
        ? studentData.percentage
        : (totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0);
      
      return {
        id,
        studentDbId: studentData.studentDbId, // Database ID for matching
        name: student.name,
        responses,
        correctCount,
        totalAnswered,
        successRate,
        totalTime,
      };
    });
  }, [session, quiz, studentFilter]);
  
  // Load existing evaluation for selected student from Supabase
  useEffect(() => {
    async function loadExistingEvaluation() {
      if (!selectedStudentId || !sessionId) {
        // Clear when no student selected
        setCurrentResultId(null);
        setIsEvaluationSaved(false);
        setIsEvaluationShared(false);
        setGeneratedAssessment('');
        setTeacherNotes('');
        lastLoadedStudentRef.current = null;
        return;
      }
      
      // Skip if we just saved (protect against overwriting with stale data)
      if (justSavedRef.current) {
        console.log('[Evaluation] Skipping load - just saved, waiting for propagation');
        return;
      }
      
      // Skip if we already loaded for this student
      if (lastLoadedStudentRef.current === selectedStudentId) {
        console.log('[Evaluation] Skipping load - already loaded for this student');
        return;
      }
      
      const student = studentResults.find(s => s.id === selectedStudentId);
      const studentDbId = student?.studentDbId || null;
      const studentName = student?.name;
      
      console.log('[Evaluation] Loading from Supabase for student:', studentDbId, 'name:', studentName, 'session:', sessionId);
      
      // Try to find by ID first, fallback to name
      const result = await getResultByStudentAndSession(studentDbId, sessionId, studentName);
      
      if (result) {
        console.log('[Evaluation] Found result:', result.id, 'has assessment:', !!result.formative_assessment);
        setCurrentResultId(result.id);
        lastLoadedStudentRef.current = selectedStudentId;
        
        if (result.formative_assessment) {
          setGeneratedAssessment(result.formative_assessment);
          setTeacherNotes(result.teacher_notes || '');
          setIsEvaluationSaved(true);
          setIsEvaluationShared(result.shared_with_student || false);
        } else {
          setGeneratedAssessment('');
          setTeacherNotes('');
          setIsEvaluationSaved(false);
          setIsEvaluationShared(false);
        }
      } else {
        console.log('[Evaluation] No result found in Supabase');
        setCurrentResultId(null);
        setIsEvaluationSaved(false);
        setIsEvaluationShared(false);
        setGeneratedAssessment('');
        setTeacherNotes('');
      }
    }
    
    loadExistingEvaluation();
    // Note: studentResults is needed for lookup but we use refs to prevent unnecessary reloads
  }, [selectedStudentId, sessionId, studentResults]);
  
  // Calculate question stats
  const questionStats: QuestionStats[] = React.useMemo(() => {
    if (!quiz || !session?.students) return [];
    
    const isPaperTest = (session as any).isPaperTest || (quiz as any).isPaperTest;
    
    return quiz.slides
      .filter(s => s.type === 'activity')
      .map(slide => {
        const answerCounts: Record<string, number> = {};
        let totalTime = 0;
        let responseCount = 0;
        
        // Get correct answer for ABC
        let correctAnswer: string | undefined;
        let options: { id: string; label: string; content: string; isCorrect: boolean }[] | undefined;
        
        if (slide.activityType === 'abc') {
          const abcSlide = slide as ABCActivitySlide;
          options = abcSlide.options || [];
          correctAnswer = options.find(o => o.isCorrect)?.id || (slide as any).correctAnswer;
        }
        
        // Get all responses for this slide
        Object.values(session.students || {}).forEach(student => {
          const response = student.responses?.find((r: any) => r.slideId === slide.id);
          if (response) {
            let answer = String(response.answer);
            
            // For paper tests, answer is a letter (A, B, C, D) - map to option id
            if (isPaperTest && options && answer.match(/^[A-Z]$/)) {
              const optionIndex = answer.charCodeAt(0) - 65; // A=0, B=1, etc
              const option = options[optionIndex];
              if (option) {
                answer = option.id || option.label || answer;
              }
            }
            
            answerCounts[answer] = (answerCounts[answer] || 0) + 1;
            totalTime += response.timeSpent || 0;
            responseCount++;
          }
        });
        
        return {
          slideId: slide.id,
          question: (slide as any).question || (slide as any).problem || 'Otázka',
          type: slide.type,
          activityType: slide.activityType,
          options,
          answerCounts,
          correctAnswer,
          totalResponses: responseCount,
          averageTime: responseCount > 0 ? totalTime / responseCount : 0,
        };
      });
  }, [quiz, session]);
  
  // Overall stats
  const overallStats = React.useMemo(() => {
    const totalQuestions = questionStats.length;
    const totalStudents = studentResults.length;
    const avgCorrect = totalStudents > 0 
      ? studentResults.reduce((sum, s) => sum + s.correctCount, 0) / totalStudents 
      : 0;
    const avgSuccessRate = totalStudents > 0
      ? studentResults.reduce((sum, s) => sum + s.successRate, 0) / totalStudents
      : 0;
    const avgTime = totalStudents > 0
      ? studentResults.reduce((sum, s) => sum + s.totalTime, 0) / totalStudents
      : 0;
    
    // Success distribution for bar chart
    const distribution = {
      excellent: studentResults.filter(s => s.successRate >= 80).length,
      good: studentResults.filter(s => s.successRate >= 60 && s.successRate < 80).length,
      average: studentResults.filter(s => s.successRate >= 40 && s.successRate < 60).length,
      belowAverage: studentResults.filter(s => s.successRate >= 20 && s.successRate < 40).length,
      poor: studentResults.filter(s => s.successRate < 20).length,
    };
    
    return {
      totalQuestions,
      totalStudents,
      avgCorrect: Math.round(avgCorrect * 10) / 10,
      avgSuccessRate: Math.round(avgSuccessRate),
      avgTime,
      distribution,
    };
  }, [questionStats, studentResults]);
  
  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins.toString().padStart(2, '0')}.${secs.toString().padStart(2, '0')}`;
  };
  
  // Get success color
  const getSuccessColor = (rate: number) => {
    if (rate >= 80) return '#10b981'; // green
    if (rate >= 60) return '#84cc16'; // lime
    if (rate >= 40) return '#f59e0b'; // amber
    if (rate >= 20) return '#f97316'; // orange
    return '#dc2626'; // red
  };
  
  // Initialize all activities as expanded
  useEffect(() => {
    if (questionStats.length > 0 && expandedActivities.size === 0) {
      const allSlideIds = new Set(questionStats.map(stat => stat.slideId));
      setExpandedActivities(allSlideIds);
    }
  }, [questionStats]);
  
  // Sort activities based on filter
  const sortedQuestionStats = React.useMemo(() => {
    if (activitySort === 'default') return questionStats;
    
    return [...questionStats].sort((a, b) => {
      // Calculate success rate for each activity
      const aCorrectCount = a.correctAnswer ? (a.answerCounts[a.correctAnswer] || 0) : 0;
      const bCorrectCount = b.correctAnswer ? (b.answerCounts[b.correctAnswer] || 0) : 0;
      const aSuccessRate = a.totalResponses > 0 ? aCorrectCount / a.totalResponses : 0;
      const bSuccessRate = b.totalResponses > 0 ? bCorrectCount / b.totalResponses : 0;
      
      if (activitySort === 'easiest') {
        return bSuccessRate - aSuccessRate; // Highest success rate first
      } else {
        return aSuccessRate - bSuccessRate; // Lowest success rate first (hardest)
      }
    });
  }, [questionStats, activitySort]);
  
  // Auto-select student in student view mode
  useEffect(() => {
    if (isStudentView && studentResults.length > 0) {
      // Decode the student name from URL
      const decodedName = studentIdParam ? decodeURIComponent(studentIdParam) : '';
      console.log('[StudentView] Looking for student:', decodedName, 'in', studentResults.map(s => s.name));
      
      // Try to find student by name or id
      const matchingStudent = studentResults.find(s => 
        s.name === decodedName || 
        s.id === studentIdParam ||
        s.name.toLowerCase() === decodedName.toLowerCase()
      );
      
      if (matchingStudent) {
        console.log('[StudentView] Found student:', matchingStudent.name);
        if (selectedStudentId !== matchingStudent.id) {
          setSelectedStudentId(matchingStudent.id);
        }
      } else if (studentResults.length > 0 && !selectedStudentId) {
        // Fallback: select first student if no match found
        console.log('[StudentView] Fallback: selecting first student:', studentResults[0].name);
        setSelectedStudentId(studentResults[0].id);
      }
    }
  }, [isStudentView, studentIdParam, studentResults]);
  
  // Toggle activity expansion
  const toggleActivity = (slideId: string) => {
    const newExpanded = new Set(expandedActivities);
    if (newExpanded.has(slideId)) {
      newExpanded.delete(slideId);
    } else {
      newExpanded.add(slideId);
    }
    setExpandedActivities(newExpanded);
  };
  
  // Sort students
  const sortedStudents = [...studentResults].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (sortBy === 'success') {
      comparison = a.successRate - b.successRate;
    } else if (sortBy === 'time') {
      comparison = a.totalTime - b.totalTime;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Načítám výsledky...</p>
        </div>
      </div>
    );
  }
  
  if (!session || !quiz) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Session nenalezena</p>
          <button
            onClick={() => navigate('/quiz')}
            className="text-indigo-600 hover:text-indigo-700"
          >
            Zpět na kvízy
          </button>
        </div>
      </div>
    );
  }
  
  // Get the filtered student info for single student view (URL-based)
  const filteredStudent = studentFilter && studentResults.length > 0 ? studentResults[0] : null;
  
  // Get the selected student for the right column activities view (tab-based)
  const selectedStudent = selectedStudentId 
    ? studentResults.find(s => s.id === selectedStudentId) 
    : null;
  
  // Helper to clear filter
  const clearFilter = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('studentFilter');
    setSearchParams(newParams);
  };
  
  return (
    <div className="min-h-screen bg-slate-100">
      {/* First Time Setup Dialog */}
      {showFirstTimeSetup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Kam uložit výsledky?</h3>
                <p className="text-slate-500 text-sm">
                  {Object.keys(session?.students || {}).length} studentů dokončilo kvíz
                </p>
              </div>
            </div>
            
            <div className="space-y-4 mb-6">
              {/* Class selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Třída
                </label>
                <select
                  value={setupClassId}
                  onChange={(e) => setSetupClassId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '2px solid #e2e8f0',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                    color: '#1f2937',
                  }}
                >
                  <option value="">-- Vyberte třídu --</option>
                  {availableClasses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.id === setupClassId && suggestedClassName ? '(doporučeno)' : ''}
                    </option>
                  ))}
                </select>
                {suggestedClassName && setupClassId && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Detekováno podle připojených studentů
                  </p>
                )}
              </div>
              
              {/* Subject confirmation */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Předmět
                </label>
                <div className="flex gap-2">
                  {['Matematika', 'Fyzika', 'Chemie', 'Přírodopis', 'Jiný'].map(subject => (
                    <button
                      key={subject}
                      onClick={() => setSetupSubject(subject)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: 500,
                        border: setupSubject === subject ? '2px solid #6366f1' : '2px solid #e2e8f0',
                        backgroundColor: setupSubject === subject ? '#eef2ff' : '#ffffff',
                        color: setupSubject === subject ? '#4f46e5' : '#64748b',
                        cursor: 'pointer',
                      }}
                    >
                      {subject}
                    </button>
                  ))}
                </div>
                {setupSubject && (
                  <p className="text-xs text-slate-500 mt-2">
                    Předmět "{setupSubject}" bude přiřazen k výsledkům
                  </p>
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
              <button
                onClick={handleFirstTimeSetupConfirm}
                disabled={!setupClassId || isSyncing}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: '12px',
                  background: (!setupClassId || isSyncing) ? '#94a3b8' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '15px',
                  border: 'none',
                  cursor: (!setupClassId || isSyncing) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                    Ukládám...
                  </>
                ) : (
                  <>
                    <CheckCircle style={{ width: '18px', height: '18px' }} />
                    Uložit do třídy
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  // Remember that user dismissed this dialog
                  if (sessionId) {
                    localStorage.setItem(`quiz_setup_dismissed_${sessionId}`, 'true');
                  }
                  setShowFirstTimeSetup(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Přeskočit
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Sync to Class Dialog */}
      {showSyncDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Synchronizace se třídou</h3>
                <p className="text-slate-500 text-sm">
                  {studentResults.length} studentů bude synchronizováno
                </p>
              </div>
            </div>
            
            <div className="space-y-4 mb-6">
              {/* Class selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Třída</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '2px solid #e2e8f0',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                    color: '#1f2937',
                  }}
                >
                  <option value="">-- Vyberte třídu --</option>
                  {availableClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Subject selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Předmět</label>
                <div className="flex flex-wrap gap-2">
                  {['Matematika', 'Fyzika', 'Chemie', 'Přírodopis', 'Jiný'].map(subject => (
                    <button
                      key={subject}
                      onClick={() => setSelectedSubject(subject)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: 500,
                        border: selectedSubject === subject ? '2px solid #10b981' : '2px solid #e2e8f0',
                        backgroundColor: selectedSubject === subject ? '#ecfdf5' : '#ffffff',
                        color: selectedSubject === subject ? '#059669' : '#64748b',
                        cursor: 'pointer',
                      }}
                    >
                      {subject}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {syncSuccess ? (
              <div className="bg-emerald-100 text-emerald-700 p-4 rounded-xl text-center mb-4">
                ✓ Výsledky byly úspěšně synchronizovány!
              </div>
            ) : null}
            
            <div className="flex gap-2">
              <button
                onClick={handleSyncToClass}
                disabled={!selectedClassId || isSyncing}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Ukládám...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Synchronizovat
                  </>
                )}
              </button>
              <button
                onClick={() => { setShowSyncDialog(false); setSelectedClassId(''); }}
                className="px-6 py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Minimal back button */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-white/80 text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
      
      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        
        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '0.7fr 1fr', gap: '24px' }}>
          
          {/* LEFT COLUMN - Overview with Tabs */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            
            {/* Quiz info header */}
            <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '12px', 
                    background: 'linear-gradient(135deg, #10b981, #0d9488)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <FileText style={{ width: '24px', height: '24px', color: 'white' }} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '2px' }}>
                      {isStudentView ? 'Moje výsledky' : quiz.title || 'Kvíz'}
                    </h2>
                    <p style={{ fontSize: '13px', color: '#64748b' }}>
                      {quiz.title} • {new Date(session.createdAt).toLocaleDateString('cs-CZ')} {new Date(session.createdAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                
                {/* Upload photos button - only for paper tests */}
                {!isStudentView && sessionType === 'paper_test' && (
                  <button
                    onClick={() => {
                      const classIdParam = searchParams.get('classId');
                      if (classIdParam) {
                        navigate(`/paper-test/upload/${sessionId}?classId=${classIdParam}`);
                      }
                    }}
                    title="Nahrát fotky testů"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#7c3aed'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#8b5cf6'; }}
                  >
                    <Camera style={{ width: '18px', height: '18px' }} />
                    Nahrát fotky
                  </button>
                )}
                
                {/* Settings icon - hidden in student view */}
                {!isStudentView && (
                <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                      title="Nastavení"
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: showSettingsMenu ? '#f1f5f9' : 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { if (!showSettingsMenu) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                      onMouseLeave={(e) => { if (!showSettingsMenu) e.currentTarget.style.backgroundColor = 'white'; }}
                    >
                      <Settings style={{ width: '18px', height: '18px', color: '#64748b' }} />
                    </button>
                    
                    {showSettingsMenu && (
                      <div 
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: '100%',
                          marginTop: '8px',
                          backgroundColor: 'white',
                          borderRadius: '12px',
                          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                          border: '1px solid #e2e8f0',
                          padding: '8px 0',
                          minWidth: '200px',
                          zIndex: 20,
                        }}
                        onMouseLeave={() => setShowSettingsMenu(false)}
                      >
                        <button 
                          onClick={() => { setShowSyncDialog(true); setShowSettingsMenu(false); }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <Users style={{ width: '18px', height: '18px', color: '#10b981' }} />
                          <span style={{ color: '#334155', fontSize: '14px' }}>Synchronizace se třídou</span>
                        </button>
                        <button 
                          onClick={() => { window.location.reload(); setShowSettingsMenu(false); }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <RefreshCw style={{ width: '18px', height: '18px', color: '#64748b' }} />
                          <span style={{ color: '#334155', fontSize: '14px' }}>Obnovit výsledky</span>
                        </button>
                        <button 
                          onClick={() => { setShowSettingsMenu(false); }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <Share2 style={{ width: '18px', height: '18px', color: '#64748b' }} />
                          <span style={{ color: '#334155', fontSize: '14px' }}>Sdílet</span>
                        </button>
                        {quiz?.id && (
                          <button 
                            onClick={() => { navigate(`/quiz/edit/${quiz.id}`); setShowSettingsMenu(false); }}
                            style={{
                              width: '100%',
                              padding: '10px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              cursor: 'pointer',
                              textAlign: 'left',
                              borderTop: '1px solid #e2e8f0',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <FileText style={{ width: '18px', height: '18px', color: '#6366f1' }} />
                            <span style={{ color: '#334155', fontSize: '14px' }}>Otevřít board</span>
                          </button>
                        )}
                        
                        {/* Delete results */}
                        <button 
                          onClick={() => { 
                            setShowDeleteDialog(true); 
                            setShowSettingsMenu(false); 
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left',
                            borderTop: '1px solid #e2e8f0',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <Trash2 style={{ width: '18px', height: '18px', color: '#ef4444' }} />
                          <span style={{ color: '#ef4444', fontSize: '14px' }}>Smazat výsledky</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
              <button
                onClick={() => { setLeftTab('class'); setSelectedStudentId(null); }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '14px',
                  transition: 'all 0.2s',
                  backgroundColor: leftTab === 'class' ? 'white' : 'transparent',
                  color: leftTab === 'class' ? '#1e293b' : '#64748b',
                  boxShadow: leftTab === 'class' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <Users style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                Celá třída
              </button>
              <button
                onClick={() => setLeftTab('students')}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '14px',
                  transition: 'all 0.2s',
                  backgroundColor: leftTab === 'students' ? 'white' : 'transparent',
                  color: leftTab === 'students' ? '#1e293b' : '#64748b',
                  boxShadow: leftTab === 'students' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <BarChart2 style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                Studenti
              </button>
            </div>
            
            {/* Tab Content */}
            {leftTab === 'class' ? (
              /* Class Overview Tab */
              <div>
                {/* Distribution bar */}
                <div style={{ height: '90px', borderRadius: '12px', overflow: 'hidden', display: 'flex', marginBottom: '20px' }}>
                  {overallStats.distribution.excellent > 0 && (
                    <div 
                      style={{ 
                        height: '100%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'flex-start',
                        padding: '6px',
                        width: `${(overallStats.distribution.excellent / overallStats.totalStudents) * 100}%`,
                        backgroundColor: '#10b981'
                      }}
                    >
                      <span style={{ color: 'white', fontSize: '11px', fontWeight: 500 }}>
                        {Math.round((overallStats.distribution.excellent / overallStats.totalStudents) * 100)}%
                      </span>
                    </div>
                  )}
                  {overallStats.distribution.good > 0 && (
                    <div 
                      style={{ 
                        height: '100%',
                        width: `${(overallStats.distribution.good / overallStats.totalStudents) * 100}%`,
                        backgroundColor: '#84cc16'
                      }}
                    />
                  )}
                  {overallStats.distribution.average > 0 && (
                    <div 
                      style={{ 
                        height: '100%',
                        width: `${(overallStats.distribution.average / overallStats.totalStudents) * 100}%`,
                        backgroundColor: '#f59e0b'
                      }}
                    />
                  )}
                  {overallStats.distribution.belowAverage > 0 && (
                    <div 
                      style={{ 
                        height: '100%',
                        width: `${(overallStats.distribution.belowAverage / overallStats.totalStudents) * 100}%`,
                        backgroundColor: '#f97316'
                      }}
                    />
                  )}
                  {overallStats.distribution.poor > 0 && (
                    <div 
                      style={{ 
                        height: '100%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'flex-end',
                        padding: '6px',
                        width: `${(overallStats.distribution.poor / overallStats.totalStudents) * 100}%`,
                        backgroundColor: '#dc2626'
                      }}
                    >
                      <span style={{ color: 'white', fontSize: '11px', fontWeight: 500 }}>
                        {Math.round((overallStats.distribution.poor / overallStats.totalStudents) * 100)}%
                      </span>
                    </div>
                  )}
                </div>
                
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginBottom: '16px' }}>Přehled třídy</h2>
                
                {/* Stats cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                    <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Otázek</p>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{overallStats.totalQuestions}</p>
                  </div>
                  <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                    <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Počet studentů</p>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{overallStats.totalStudents}</p>
                  </div>
                  <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                    <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Úspěšnost</p>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{overallStats.avgSuccessRate}%</p>
                  </div>
                  <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                    <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Průměrný čas</p>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock style={{ width: '20px', height: '20px' }} />
                      {formatTime(overallStats.avgTime)}
                    </p>
                  </div>
                </div>
                
                {/* AI Recommendations Panel - only for teachers */}
                {!isStudentView && (
                  <div 
                    style={{
                      marginTop: '16px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '10px',
                      padding: '14px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <Sparkles style={{ width: '16px', height: '16px', color: '#64748b' }} />
                      <span style={{ fontWeight: 500, color: '#475569', fontSize: '13px' }}>AI doporučení</span>
                      {recommendationSaved && (
                        <span style={{ 
                          marginLeft: 'auto',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          backgroundColor: '#dcfce7',
                          color: '#16a34a',
                          fontSize: '10px',
                          fontWeight: 500,
                        }}>
                          ✓ Uloženo
                        </span>
                      )}
                    </div>
                    
                    {!classRecommendation ? (
                      <button
                        onClick={handleGenerateClassRecommendation}
                        disabled={isGeneratingRecommendation || studentResults.length === 0}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '8px',
                          backgroundColor: isGeneratingRecommendation ? '#e2e8f0' : '#fff',
                          color: '#475569',
                          fontWeight: 500,
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          border: '1px solid #cbd5e1',
                          cursor: isGeneratingRecommendation ? 'not-allowed' : 'pointer',
                          opacity: studentResults.length === 0 ? 0.5 : 1,
                        }}
                      >
                        {isGeneratingRecommendation ? (
                          <>
                            <RefreshCw style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
                            Analyzuji...
                          </>
                        ) : (
                          'Zanalyzovat data'
                        )}
                      </button>
                    ) : (
                      <div>
                        <div 
                          style={{
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            padding: '12px',
                            border: '1px solid #e2e8f0',
                            whiteSpace: 'pre-wrap',
                            color: '#475569',
                            fontSize: '12px',
                            lineHeight: 1.5,
                            maxHeight: '200px',
                            overflowY: 'auto',
                          }}
                        >
                          {classRecommendation}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                          <button
                            onClick={handleGenerateClassRecommendation}
                            disabled={isGeneratingRecommendation}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              backgroundColor: 'white',
                              color: '#64748b',
                              fontWeight: 500,
                              fontSize: '11px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            <RefreshCw style={{ width: '12px', height: '12px' }} />
                            Znovu
                          </button>
                          {!recommendationSaved && (
                            <button
                              onClick={handleSaveRecommendation}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                backgroundColor: '#10b981',
                                color: 'white',
                                fontWeight: 500,
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              <CheckCircle style={{ width: '12px', height: '12px' }} />
                              Uložit
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Students Tab */
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', marginBottom: '12px' }}>Seznam studentů</h2>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
                  Klikněte na studenta pro zobrazení detailů
                </p>
                
                {/* Student list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {sortedStudents.map((student) => (
                    <div
                      key={student.id}
                      onClick={() => setSelectedStudentId(selectedStudentId === student.id ? null : student.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        backgroundColor: selectedStudentId === student.id ? '#eef2ff' : '#f8fafc',
                        border: selectedStudentId === student.id ? '2px solid #6366f1' : '2px solid transparent',
                      }}
                    >
                      {/* Avatar */}
                      <div 
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          backgroundColor: selectedStudentId === student.id ? '#6366f1' : '#cbd5e1',
                          color: 'white',
                          flexShrink: 0,
                        }}
                      >
                        {student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      
                      {/* Name and stats */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 500, color: '#1e293b', margin: 0, fontSize: '14px' }}>{student.name}</p>
                        <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                          {student.correctCount}/{student.totalAnswered} • {student.totalTime > 0 ? formatTime(student.totalTime) : '-'}
                        </p>
                      </div>
                      
                      {/* Success rate badge */}
                      <span 
                        style={{
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: 500,
                          backgroundColor: getSuccessColor(student.successRate),
                        }}
                      >
                        {student.successRate}%
                      </span>
                      
                      {/* Delete button - only for paper tests */}
                      {sessionType === 'paper_test' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteStudentDialog(student.id);
                          }}
                          style={{
                            padding: '6px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0.6,
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#fef2f2';
                            e.currentTarget.style.color = '#ef4444';
                            e.currentTarget.style.opacity = '1';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#94a3b8';
                            e.currentTarget.style.opacity = '0.6';
                          }}
                          title="Smazat výsledky žáka"
                        >
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* RIGHT COLUMN - Activities */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            {/* Header with selected student info and filter */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Přehled aktivit</h2>
                
                {/* Activity sort filter */}
                <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                  <button
                    onClick={() => setActivitySort('default')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500,
                      backgroundColor: activitySort === 'default' ? 'white' : 'transparent',
                      color: activitySort === 'default' ? '#1e293b' : '#64748b',
                      boxShadow: activitySort === 'default' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    Pořadí
                  </button>
                  <button
                    onClick={() => setActivitySort('easiest')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500,
                      backgroundColor: activitySort === 'easiest' ? 'white' : 'transparent',
                      color: activitySort === 'easiest' ? '#10b981' : '#64748b',
                      boxShadow: activitySort === 'easiest' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    Nejsnazší
                  </button>
                  <button
                    onClick={() => setActivitySort('hardest')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500,
                      backgroundColor: activitySort === 'hardest' ? 'white' : 'transparent',
                      color: activitySort === 'hardest' ? '#ef4444' : '#64748b',
                      boxShadow: activitySort === 'hardest' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    Nejtěžší
                  </button>
                </div>
              </div>
              {selectedStudent && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div 
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: '#6366f1',
                      color: 'white',
                    }}
                  >
                    {selectedStudent.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <span style={{ fontWeight: 500, color: '#1e293b', fontSize: '14px' }}>{selectedStudent.name}</span>
                  <button
                    onClick={() => setSelectedStudentId(null)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: 'white',
                      color: '#64748b',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            
            {/* Formative Assessment Panel - when student is selected */}
            {selectedStudent && (
              <div 
                style={{
                  marginBottom: '20px',
                  background: 'linear-gradient(to bottom right, #f5f3ff, #eef2ff)',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid #e0e7ff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div 
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'linear-gradient(to bottom right, #8b5cf6, #9333ea)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MessageSquare style={{ width: '18px', height: '18px', color: 'white' }} />
                    </div>
                    <div>
                      <h3 style={{ fontWeight: 'bold', color: '#1e293b', margin: 0, fontSize: '14px' }}>
                        {isStudentView ? 'Hodnocení od učitele' : 'Formativní hodnocení'}
                      </h3>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>pro {selectedStudent.name}</p>
                    </div>
                  </div>
                  {isEvaluationShared && !isStudentView && (
                    <span 
                      style={{
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        backgroundColor: '#d1fae5',
                        color: '#047857',
                        fontSize: '12px',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <CheckCircle style={{ width: '14px', height: '14px' }} />
                      Sdíleno
                    </span>
                  )}
                </div>
                
                {/* Student View - Read-only assessment display */}
                {isStudentView ? (
                  generatedAssessment ? (
                    <div 
                      style={{
                        backgroundColor: 'white',
                        borderRadius: '10px',
                        padding: '16px',
                        border: '1px solid #e2e8f0',
                        whiteSpace: 'pre-wrap',
                        color: '#334155',
                        fontSize: '14px',
                        lineHeight: 1.6,
                      }}
                    >
                      {generatedAssessment}
                    </div>
                  ) : (
                    <div 
                      style={{
                        backgroundColor: 'white',
                        borderRadius: '10px',
                        padding: '16px',
                        border: '1px solid #e2e8f0',
                        color: '#94a3b8',
                        fontSize: '14px',
                        textAlign: 'center',
                      }}
                    >
                      Učitel zatím nepřidal hodnocení.
                    </div>
                  )
                ) : (
                  <>
                    {/* Teacher notes input */}
                    <div style={{ marginBottom: '12px' }}>
                      <textarea
                        value={teacherNotes}
                        onChange={(e) => setTeacherNotes(e.target.value)}
                        placeholder="Vaše poznámka pro AI (volitelné)..."
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          outline: 'none',
                          resize: 'none',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                        }}
                        rows={2}
                      />
                    </div>
                    
                    {/* Generate button or generated assessment */}
                    {!generatedAssessment ? (
                      <button
                        onClick={handleGenerateAssessment}
                        disabled={isGeneratingAssessment}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '10px',
                          background: 'linear-gradient(to right, #7c3aed, #9333ea)',
                          color: 'white',
                          fontWeight: 500,
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          border: 'none',
                          cursor: isGeneratingAssessment ? 'not-allowed' : 'pointer',
                          opacity: isGeneratingAssessment ? 0.5 : 1,
                        }}
                      >
                        {isGeneratingAssessment ? (
                          <>
                            <RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                            Generuji...
                          </>
                        ) : (
                          <>
                            <Sparkles style={{ width: '16px', height: '16px' }} />
                            Vygenerovat hodnocení
                          </>
                        )}
                      </button>
                    ) : (
                      <div>
                        <div 
                          style={{
                            backgroundColor: 'white',
                            borderRadius: '10px',
                            padding: '12px',
                            border: '1px solid #e2e8f0',
                            whiteSpace: 'pre-wrap',
                            color: '#334155',
                            fontSize: '13px',
                            maxHeight: '120px',
                            overflowY: 'auto',
                            marginBottom: '10px',
                          }}
                        >
                          {generatedAssessment}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={handleGenerateAssessment}
                            disabled={isGeneratingAssessment}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                              backgroundColor: 'white',
                              color: '#334155',
                              fontWeight: 500,
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            <RefreshCw style={{ width: '14px', height: '14px' }} />
                            Znovu
                          </button>
                          <button
                            onClick={handleShareWithStudent}
                            disabled={isEvaluationShared || !currentResultId}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              borderRadius: '8px',
                              backgroundColor: isEvaluationShared ? '#9ca3af' : (!currentResultId ? '#cbd5e1' : '#059669'),
                              color: 'white',
                              fontWeight: 500,
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              border: 'none',
                              cursor: isEvaluationShared || !currentResultId ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <Send style={{ width: '14px', height: '14px' }} />
                            {isEvaluationShared ? 'Sdíleno' : (!currentResultId ? 'Nejprve uložte do třídy' : 'Sdílet se studentem')}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Special UI for paper tests - show individual questions from answers */}
              {sessionType === 'paper_test' && sortedQuestionStats.length <= 1 && (
                <>
                  {/* Check if we have any student with answers */}
                  {(() => {
                    // Get all unique questions from all students' answers
                    const allQuestions: Map<number, { questionNumber: number; questionType: string; maxPoints: number }> = new Map();
                    Object.values(session?.students || {}).forEach((student: any) => {
                      const answers = student.paperTestAnswers || [];
                      answers.forEach((answer: any) => {
                        const qNum = answer.questionNumber || 1;
                        if (!allQuestions.has(qNum)) {
                          allQuestions.set(qNum, {
                            questionNumber: qNum,
                            questionType: answer.questionType || 'abc',
                            maxPoints: answer.maxPoints || 1,
                          });
                        }
                      });
                    });
                    
                    const sortedQuestions = Array.from(allQuestions.values()).sort((a, b) => a.questionNumber - b.questionNumber);
                    
                    if (sortedQuestions.length === 0) {
                      // No answers yet - show upload prompt
                      return (
                        <div style={{ 
                          padding: '24px', 
                          backgroundColor: '#f8fafc', 
                          borderRadius: '12px',
                          textAlign: 'center'
                        }}>
                          <Camera style={{ width: '48px', height: '48px', color: '#94a3b8', margin: '0 auto 16px' }} />
                          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                            Papírový test
                          </h3>
                          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                            Zatím nebyly nahrány žádné fotky testů. Nahrajte fotky pro zobrazení výsledků.
                          </p>
                          <button
                            onClick={() => {
                              const classIdParam = searchParams.get('classId');
                              if (classIdParam) {
                                navigate(`/paper-test/upload/${sessionId}?classId=${classIdParam}`);
                              }
                            }}
                            style={{
                              marginTop: '16px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '12px 24px',
                              borderRadius: '8px',
                              border: 'none',
                              backgroundColor: '#8b5cf6',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: 500,
                            }}
                          >
                            <Upload style={{ width: '18px', height: '18px' }} />
                            Nahrát fotky testů
                          </button>
                        </div>
                      );
                    }
                    
                    // Show each question with student answers
                    return sortedQuestions.map((question) => {
                      const questionNum = question.questionNumber;
                      
                      return (
                        <div 
                          key={`q-${questionNum}`}
                          style={{ 
                            border: '1px solid #e2e8f0', 
                            borderRadius: '12px', 
                            overflow: 'hidden',
                            backgroundColor: 'white',
                          }}
                        >
                          {/* Question header */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            backgroundColor: '#f8fafc',
                            borderBottom: '1px solid #e2e8f0',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                backgroundColor: '#6366f1',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '14px',
                                fontWeight: 'bold',
                              }}>
                                {questionNum}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>
                                  Otázka {questionNum}
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>
                                  {question.questionType === 'open' ? 'Otevřená otázka' : 'Výběr z možností'} • max {question.maxPoints} {question.maxPoints === 1 ? 'bod' : 'body'}
                                </div>
                              </div>
                            </div>
                            {/* Success rate for this question */}
                            {(() => {
                              let correct = 0;
                              let total = 0;
                              Object.values(session?.students || {}).forEach((student: any) => {
                                const answer = (student.paperTestAnswers || []).find((a: any) => a.questionNumber === questionNum);
                                if (answer) {
                                  total++;
                                  if (answer.isCorrect || answer.points > 0) correct++;
                                }
                              });
                              const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
                              return (
                                <div style={{
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  backgroundColor: rate >= 70 ? '#dcfce7' : rate >= 50 ? '#fef9c3' : '#fee2e2',
                                  color: rate >= 70 ? '#166534' : rate >= 50 ? '#854d0e' : '#991b1b',
                                  fontWeight: 600,
                                  fontSize: '13px',
                                }}>
                                  {rate}% úspěšnost
                                </div>
                              );
                            })()}
                          </div>
                          
                          {/* Student answers */}
                          <div style={{ padding: '12px 16px' }}>
                            {studentResults.map((student) => {
                              const studentData = session?.students?.[student.id];
                              const answers = (studentData as any)?.paperTestAnswers || [];
                              const answer = answers.find((a: any) => a.questionNumber === questionNum);
                              
                              if (!answer) {
                                return (
                                  <div 
                                    key={student.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '8px 0',
                                      borderBottom: '1px solid #f1f5f9',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        backgroundColor: '#94a3b8',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                      }}>
                                        {student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                      </div>
                                      <span style={{ fontSize: '13px', color: '#64748b' }}>{student.name}</span>
                                    </div>
                                    <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                      Nehodnoceno
                                    </span>
                                  </div>
                                );
                              }
                              
                              const isCorrect = answer.isCorrect || answer.points > 0;
                              
                              return (
                                <div 
                                  key={student.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 0',
                                    borderBottom: '1px solid #f1f5f9',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                    <div style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '50%',
                                      backgroundColor: isCorrect ? '#10b981' : '#ef4444',
                                      color: 'white',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '10px',
                                      fontWeight: 'bold',
                                    }}>
                                      {student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                    </div>
                                    <span style={{ fontSize: '13px', color: '#1e293b' }}>{student.name}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      backgroundColor: isCorrect ? '#f0fdf4' : '#fef2f2',
                                      border: `1px solid ${isCorrect ? '#bbf7d0' : '#fecaca'}`,
                                      color: isCorrect ? '#166534' : '#991b1b',
                                      fontSize: '12px',
                                      fontWeight: 500,
                                      maxWidth: '200px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}>
                                      {answer.answer || '-'}
                                    </div>
                                    <div style={{
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      color: isCorrect ? '#10b981' : '#ef4444',
                                    }}>
                                      {answer.points || 0}/{answer.maxPoints || 1}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                  
                  {/* Upload more photos button */}
                  <div style={{ textAlign: 'center', paddingTop: '8px' }}>
                    <button
                      onClick={() => {
                        const classIdParam = searchParams.get('classId');
                        if (classIdParam) {
                          navigate(`/library/my-classes?classId=${classIdParam}&openUpload=${sessionId}`);
                        }
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        border: '1px solid #8b5cf6',
                        backgroundColor: 'white',
                        color: '#8b5cf6',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                      }}
                    >
                      <Upload style={{ width: '16px', height: '16px' }} />
                      Nahrát další fotky
                    </button>
                  </div>
                </>
              )}
              
              {/* Regular activities for non-paper tests */}
              {(sessionType !== 'paper_test' || sortedQuestionStats.length > 1) && sortedQuestionStats.map((stat, index) => {
                // Find original index for numbering
                const originalIndex = questionStats.findIndex(q => q.slideId === stat.slideId);
                // Get selected student's response for this question
                const studentResponse = selectedStudent?.responses.find(r => r.slideId === stat.slideId);
                const studentAnswer = studentResponse?.answer;
                const studentIsCorrect = studentResponse?.isCorrect;
                
                return (
                  <div 
                    key={stat.slideId} 
                    style={{ 
                      border: selectedStudent && studentResponse 
                        ? `2px solid ${studentIsCorrect ? '#10b981' : '#ef4444'}` 
                        : '1px solid #e2e8f0', 
                      borderRadius: '12px', 
                      overflow: 'hidden' 
                    }}
                  >
                    {/* Activity header */}
                    <div 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        backgroundColor: selectedStudent && studentResponse
                          ? (studentIsCorrect ? '#f0fdf4' : '#fef2f2')
                          : '#f8fafc',
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleActivity(stat.slideId)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span 
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: selectedStudent && studentResponse
                              ? (studentIsCorrect ? '#10b981' : '#ef4444')
                              : '#334155',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 'bold',
                          }}
                        >
                          {selectedStudent && studentResponse ? (
                            studentIsCorrect ? <CheckCircle style={{ width: '16px', height: '16px' }} /> : <XCircle style={{ width: '16px', height: '16px' }} />
                          ) : (
                            originalIndex + 1
                          )}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>
                          {stat.activityType?.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#64748b' }}>
                        {selectedStudent && studentResponse && (
                          <span 
                            style={{
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 500,
                              backgroundColor: studentIsCorrect ? '#dcfce7' : '#fee2e2',
                              color: studentIsCorrect ? '#166534' : '#991b1b',
                            }}
                          >
                            {studentIsCorrect ? 'Správně' : 'Špatně'}
                          </span>
                        )}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Users style={{ width: '14px', height: '14px' }} />
                          {stat.totalResponses}
                        </span>
                        {expandedActivities.has(stat.slideId) ? (
                          <ChevronUp style={{ width: '16px', height: '16px' }} />
                        ) : (
                          <ChevronDown style={{ width: '16px', height: '16px' }} />
                        )}
                      </div>
                    </div>
                    
                    {/* Activity content */}
                    {expandedActivities.has(stat.slideId) && (
                      <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0' }}>
                        <p style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b', marginBottom: '12px' }}>
                          <MathText>{stat.question}</MathText>
                        </p>
                        
                        {stat.activityType === 'abc' && stat.options && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {stat.options.map(option => {
                              // Try both id and label for paper tests
                              const count = stat.answerCounts[option.id] || stat.answerCounts[option.label] || 0;
                              const percentage = stat.totalResponses > 0 
                                ? (count / stat.totalResponses) * 100 
                                : 0;
                              const isStudentAnswer = selectedStudent && String(studentAnswer) === option.id;
                              
                              return (
                                <div 
                                  key={option.id} 
                                  style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '4px',
                                    padding: isStudentAnswer ? '8px' : '0',
                                    borderRadius: isStudentAnswer ? '8px' : '0',
                                    backgroundColor: isStudentAnswer 
                                      ? (option.isCorrect ? '#f0fdf4' : '#fef2f2')
                                      : 'transparent',
                                    border: isStudentAnswer 
                                      ? `2px solid ${option.isCorrect ? '#10b981' : '#ef4444'}`
                                      : 'none',
                                  }}
                                >
                                  {/* Option label and content */}
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                    <span 
                                      style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 'bold',
                                        fontSize: '11px',
                                        backgroundColor: option.isCorrect ? '#10b981' : (isStudentAnswer ? '#ef4444' : '#e2e8f0'),
                                        color: option.isCorrect || isStudentAnswer ? '#ffffff' : '#475569',
                                        flexShrink: 0,
                                      }}
                                    >
                                      {option.label || option.id?.toUpperCase() || '?'}
                                    </span>
                                    <span style={{ fontSize: '16px', color: '#334155', flex: 1 }}>
                                      <MathText>{option.content}</MathText>
                                    </span>
                                    {isStudentAnswer && (
                                      <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: 500, flexShrink: 0 }}>
                                        ← {selectedStudent.name}
                                      </span>
                                    )}
                                  </div>
                                  {/* Progress bar */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '32px' }}>
                                    <div style={{ flex: 1, height: '20px', backgroundColor: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
                                      <div 
                                        style={{ 
                                          width: `${percentage}%`,
                                          height: '100%',
                                          borderRadius: '10px',
                                          backgroundColor: option.isCorrect ? '#10b981' : (isStudentAnswer ? '#ef4444' : '#94a3b8'),
                                          transition: 'all 0.3s'
                                        }}
                                      />
                                    </div>
                                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#475569', width: '24px', textAlign: 'right' }}>{count}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        {stat.activityType === 'open' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {Object.entries(stat.answerCounts).map(([answer, count]) => {
                              const isStudentAnswer = selectedStudent && String(studentAnswer) === answer;
                              return (
                                <div 
                                  key={answer} 
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    backgroundColor: isStudentAnswer ? '#eef2ff' : '#f8fafc',
                                    borderRadius: '8px',
                                    border: isStudentAnswer ? '2px solid #6366f1' : 'none',
                                  }}
                                >
                                  <span style={{ color: '#334155', fontSize: '13px' }}>"{answer}"</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {isStudentAnswer && (
                                      <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: 500 }}>
                                        ← {selectedStudent.name}
                                      </span>
                                    )}
                                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#475569' }}>{count}x</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        {/* Voting results */}
                        {stat.activityType === 'voting' && (() => {
                          const votes = votingResults[stat.slideId] || {};
                          const votingSlide = quiz?.slides.find(s => s.id === stat.slideId) as VotingActivitySlide | undefined;
                          const voteOptions = votingSlide?.options || [];
                          const totalVoters = Object.keys(votes).length;
                          
                          // Calculate vote counts per option
                          const voteCounts: Record<string, number> = {};
                          Object.values(votes).forEach((vote: any) => {
                            (vote.selectedOptions || []).forEach((optId: string) => {
                              voteCounts[optId] = (voteCounts[optId] || 0) + 1;
                            });
                          });
                          
                          const maxVotes = Math.max(...Object.values(voteCounts), 1);
                          
                          const VOTING_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16'];
                          
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <BarChart2 style={{ width: 16, height: 16, color: '#0ea5e9' }} />
                                <span style={{ fontSize: '14px', color: '#64748b' }}>{totalVoters} hlasů</span>
                              </div>
                              {voteOptions.map((option, idx) => {
                                const count = voteCounts[option.id] || 0;
                                const percentage = totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0;
                                const barWidth = maxVotes > 0 ? (count / maxVotes) * 100 : 0;
                                const color = option.color || VOTING_COLORS[idx % VOTING_COLORS.length];
                                
                                return (
                                  <div key={option.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span 
                                          style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 'bold',
                                            fontSize: '11px',
                                            backgroundColor: color,
                                            color: '#ffffff',
                                          }}
                                        >
                                          {option.label}
                                        </span>
                                        <span style={{ fontSize: '14px', color: '#334155' }}>{option.content || option.label}</span>
                                      </div>
                                      <span style={{ fontSize: '14px', fontWeight: 500, color: '#475569' }}>
                                        {count} ({percentage}%)
                                      </span>
                                    </div>
                                    <div style={{ height: '24px', backgroundColor: '#f1f5f9', borderRadius: '8px', overflow: 'hidden' }}>
                                      <div 
                                        style={{ 
                                          width: `${barWidth}%`,
                                          height: '100%',
                                          borderRadius: '8px',
                                          backgroundColor: color,
                                          transition: 'all 0.3s',
                                          minWidth: count > 0 ? '30px' : '0',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'flex-end',
                                          paddingRight: '8px',
                                        }}
                                      >
                                        {count > 0 && (
                                          <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>{count}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                        
                        {/* Board posts */}
                        {stat.activityType === 'board' && (() => {
                          const posts = boardPosts[stat.slideId] || [];
                          const boardSlide = quiz?.slides.find(s => s.id === stat.slideId) as BoardActivitySlide | undefined;
                          
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <MessageSquare style={{ width: 16, height: 16, color: '#ec4899' }} />
                                <span style={{ fontSize: '14px', color: '#64748b' }}>{posts.length} příspěvků</span>
                              </div>
                              {posts.length === 0 ? (
                                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
                                  <span style={{ color: '#94a3b8', fontSize: '14px' }}>Žádné příspěvky</span>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                                  {posts.slice(0, 10).map(post => (
                                    <div 
                                      key={post.id}
                                      style={{
                                        padding: '12px',
                                        backgroundColor: post.backgroundColor || '#f8fafc',
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                      }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>{post.authorName}</span>
                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                          ❤️ {Array.isArray(post.likes) ? post.likes.length : Object.keys(post.likes || {}).length}
                                        </span>
                                      </div>
                                      <p style={{ fontSize: '14px', color: '#334155', margin: 0 }}>{post.text}</p>
                                      {post.mediaUrl && (
                                        <div style={{ marginTop: '8px' }}>
                                          {post.mediaType === 'image' ? (
                                            <img 
                                              src={post.mediaUrl} 
                                              alt="Příloha" 
                                              style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '8px', objectFit: 'cover' }}
                                            />
                                          ) : (
                                            <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontSize: '13px' }}>
                                              🎬 Video
                                            </a>
                                          )}
                                        </div>
                                      )}
                                      {boardSlide?.boardType === 'pros-cons' && post.column && (
                                        <span 
                                          style={{
                                            display: 'inline-block',
                                            marginTop: '8px',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            fontWeight: 500,
                                            backgroundColor: post.column === 'left' ? '#dcfce7' : '#fee2e2',
                                            color: post.column === 'left' ? '#166534' : '#991b1b',
                                          }}
                                        >
                                          {post.column === 'left' ? (boardSlide.leftColumnLabel || 'Pro') : (boardSlide.rightColumnLabel || 'Proti')}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                  {posts.length > 10 && (
                                    <div style={{ textAlign: 'center', padding: '8px' }}>
                                      <span style={{ color: '#64748b', fontSize: '13px' }}>+{posts.length - 10} dalších příspěvků</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Delete Results Dialog */}
        {showDeleteDialog && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => { setShowDeleteDialog(false); setStudentToDelete(null); setDeleteMode('all'); }}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '0',
              maxWidth: '450px',
              width: '90%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ 
              padding: '20px 24px', 
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Trash2 style={{ width: '20px', height: '20px', color: '#ef4444' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: 0 }}>
                  Smazat výsledky
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Vyberte co chcete smazat
                </p>
              </div>
            </div>
            
            {/* Content */}
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
              {/* Delete All Option */}
              <button
                onClick={() => { setDeleteMode('all'); setStudentToDelete(null); }}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '12px',
                  border: deleteMode === 'all' && !studentToDelete ? '2px solid #ef4444' : '1px solid #e2e8f0',
                  backgroundColor: deleteMode === 'all' && !studentToDelete ? '#fef2f2' : 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: deleteMode === 'all' && !studentToDelete ? '6px solid #ef4444' : '2px solid #cbd5e1',
                  backgroundColor: 'white',
                }} />
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '15px' }}>
                    Smazat všechny výsledky
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                    Smaže výsledky všech žáků a test ze třídy
                  </div>
                </div>
              </button>
              
              {/* Divider */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                marginBottom: '16px',
              }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>NEBO VYBERTE ŽÁKA</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
              </div>
              
              {/* Student List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {studentResults.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => { setDeleteMode('student'); setStudentToDelete(student.id); }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: studentToDelete === student.id ? '2px solid #ef4444' : '1px solid #e2e8f0',
                      backgroundColor: studentToDelete === student.id ? '#fef2f2' : 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: studentToDelete === student.id ? '5px solid #ef4444' : '2px solid #cbd5e1',
                      backgroundColor: 'white',
                      flexShrink: 0,
                    }} />
                    <div style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '13px',
                      flexShrink: 0,
                    }}>
                      {student.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, color: '#1e293b', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {student.name}
                      </div>
                      {student.score !== undefined && (
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {student.score}/{student.maxScore || session?.quiz?.slides?.filter((s: any) => s.type === 'activity').length || '?'} bodů
                        </div>
                      )}
                    </div>
                  </button>
                ))}
                
                {studentResults.length === 0 && (
                  <div style={{ 
                    padding: '24px', 
                    textAlign: 'center', 
                    color: '#94a3b8',
                    fontSize: '14px',
                  }}>
                    Žádní žáci k zobrazení
                  </div>
                )}
              </div>
            </div>
            
            {/* Footer */}
            <div style={{ 
              padding: '16px 24px', 
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setStudentToDelete(null);
                  setDeleteMode('all');
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  color: '#64748b',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Zrušit
              </button>
              <button
                onClick={handleDeleteResults}
                disabled={isDeleting}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  fontWeight: 500,
                  cursor: isDeleting ? 'wait' : 'pointer',
                  opacity: isDeleting ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {isDeleting ? (
                  <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Trash2 style={{ width: '16px', height: '16px' }} />
                )}
                {isDeleting ? 'Mažu...' : studentToDelete ? 'Smazat výsledky žáka' : 'Smazat vše'}
              </button>
            </div>
          </div>
        </div>
        )}
        </div>
      </div>
  );
}

export default QuizResultsPage;

