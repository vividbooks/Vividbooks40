/**
 * Quiz Results Page
 * 
 * Comprehensive results view after a quiz session ends
 * - Přehled (Overview): Stats, success chart, student list
 * - Aktivity (Activities): Breakdown by question
 * - Studenti (Students): Individual student results
 */

import React, { useState, useEffect } from 'react';
import {
  useParams,
  useNavigate,
  useSearchParams,
  type NavigateFunction,
  type SetURLSearchParams,
} from 'react-router-dom';
import { useDeleteDialog } from '../../hooks/quiz/useDeleteDialog';
import { useClassSync } from '../../hooks/quiz/useClassSync';
import { useClassRecommendation } from '../../hooks/quiz/useClassRecommendation';
import { useFormativeAssessment } from '../../hooks/quiz/useFormativeAssessment';
import { FirstTimeSetupDialog } from './results/FirstTimeSetupDialog';
import { SyncToClassDialog } from './results/SyncToClassDialog';
import { DeleteResultsDialog } from './results/DeleteResultsDialog';
import { getABCSelectedAnswerIds } from '../../utils/abc-evaluation';
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
import { toast } from 'sonner';
import { boardRoutes } from '../../features/board-v2';
import { SessionBackend } from '../../utils/live-session-repository';
import { supabase } from '../../utils/supabase/client';
import {
  defaultResultsSessions,
  loadBoardPostsForSlides,
  loadIndividualResultsSnapshot,
  loadPaperTestResultsSnapshot,
  loadVotingResultsForSlides,
  subscribeToResultsSession,
  type ResultsSessionsApi,
} from '../../features/board-v2/components/views/board-view';

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
  correctResponses: number;
  totalResponses: number;
  averageTime: number;
}

// Removed tabs - now using two-column layout

interface QuizResultsPageProps {
  sessionId?: string;
  queryParams?: URLSearchParams;
  setQueryParams?: SetURLSearchParams;
  navigateOverride?: NavigateFunction;
  routes?: Pick<typeof boardRoutes, 'edit'>;
  sessions?: ResultsSessionsApi;
}

export function QuizResultsPage({
  sessionId: sessionIdOverride,
  queryParams,
  setQueryParams,
  navigateOverride,
  routes = boardRoutes,
  sessions = defaultResultsSessions,
}: QuizResultsPageProps = {}) {
  const { sessionId: routedSessionId } = useParams<{ sessionId: string }>();
  const [routerSearchParams, routerSetSearchParams] = useSearchParams();
  const routerNavigate = useNavigate();
  const sessionId = sessionIdOverride ?? routedSessionId;
  const searchParams = queryParams ?? routerSearchParams;
  const setSearchParams = setQueryParams ?? routerSetSearchParams;
  const navigate = navigateOverride ?? routerNavigate;
  
  const sessionType = searchParams.get('type') || 'live';
  const studentFilter = searchParams.get('studentFilter'); // Filter to show only specific student
  const viewMode = searchParams.get('viewMode'); // 'student' for student/parent view
  const studentIdParam = searchParams.get('studentId'); // Student ID for student view
  const isStudentView = viewMode === 'student';
  
  const [session, setSession] = useState<LiveQuizSession | null>(null);
  const [sessionBackend, setSessionBackend] = useState<SessionBackend>('supabase');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'success' | 'time'>('name');
  
  // Voting and board results
  const [votingResults, setVotingResults] = useState<Record<string, Record<string, { selectedOptions: string[]; voterName?: string }>>>({});
  const [boardPosts, setBoardPosts] = useState<Record<string, BoardPost[]>>({});
  
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Settings dropdown state
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // Activity sorting state
  const [activitySort, setActivitySort] = useState<'default' | 'easiest' | 'hardest'>('default');

  // Left column tabs state - start on 'students' tab if in student view
  const [leftTab, setLeftTab] = useState<'class' | 'students'>(isStudentView ? 'students' : 'class');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null); // Will be set by useEffect for student view

  // ── Custom hooks ──────────────────────────────────────────────────────────

  const {
    showDeleteDialog, setShowDeleteDialog,
    deleteMode, setDeleteMode,
    studentToDelete, setStudentToDelete,
    isDeleting,
    handleDeleteResults,
    openDeleteStudentDialog,
  } = useDeleteDialog({ sessionId, sessionType });

  const {
    availableClasses,
    showSyncDialog, setShowSyncDialog,
    selectedClassId, setSelectedClassId,
    selectedSubject, setSelectedSubject,
    isSyncing,
    syncSuccess,
    showFirstTimeSetup, setShowFirstTimeSetup,
    setupClassId, setSetupClassId,
    setupSubject, setSetupSubject,
    suggestedClassName,
    handleFirstTimeSetupConfirm,
    handleSyncToClass,
  } = useClassSync({
    isStudentView,
    sessionId,
    session,
    quiz,
    onRecommendationLoaded: (rec) => {
      setClassRecommendation(rec);
      setRecommendationSaved(true);
    },
  });
  
  // Load session data based on type
  useEffect(() => {
    if (!sessionId) return;

    const isIndividual = searchParams.get('individual') === 'true';
    const isPaperTest = sessionType === 'paper_test';

    const applySnapshot = (snapshot: { session: LiveQuizSession; quiz: Quiz | null }) => {
      setSession(snapshot.session);
      if (snapshot.quiz) {
        setQuiz(snapshot.quiz);
      }
      setLoading(false);
    };

    if (isPaperTest) {
      console.log(
        '[QuizResults] Loading paper test results, assignmentId:',
        sessionId,
        'classId:',
        searchParams.get('classId'),
      );

      loadPaperTestResultsSnapshot(sessionId)
        .then((snapshot) => {
          if (!snapshot) {
            setLoading(false);
            return;
          }
          applySnapshot(snapshot);
        })
        .catch((error) => {
          console.error('[QuizResults] Error loading paper test results:', error);
          setLoading(false);
        });

      return;
    }

    if (isIndividual) {
      console.log(
        '[QuizResults] Loading individual work, classId:',
        searchParams.get('classId'),
        'title:',
        searchParams.get('title'),
      );

      loadIndividualResultsSnapshot({ sessionId, sessions })
        .then((snapshot) => {
          if (!snapshot) {
            setLoading(false);
            return;
          }
          applySnapshot(snapshot);
        })
        .catch((error) => {
          console.error('[QuizResults] Error loading individual results:', error);
          setLoading(false);
        });

      return;
    }

    let unsubscribe: (() => void) | null = null;

    subscribeToResultsSession({
      sessionId,
      sessionType,
      sessions,
      onBackend: setSessionBackend,
      onData: applySnapshot,
    })
      .then((nextUnsubscribe) => {
        unsubscribe = nextUnsubscribe;
        if (!nextUnsubscribe) {
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error('[QuizResults] Failed to load session:', error);
        setLoading(false);
      });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [sessionId, sessionType, searchParams]);
  
  // Load voting results for all voting slides
  useEffect(() => {
    if (!sessionId || !quiz) return;

    const loadVotes = async () => {
      const results = await loadVotingResultsForSlides({
        quiz,
        sessionBackend,
        sessionId,
        sessionType,
        sessions,
      });
      if (results) {
        setVotingResults(results);
      }
    };

    const channel = supabase
      .channel(`results-votes:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_session_votes', filter: `session_public_id=eq.${sessionId}` }, () => {
        loadVotes().catch(console.error);
      })
      .subscribe();

    loadVotes().catch(console.error);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionBackend, sessionId, sessionType, quiz]);
  
  // Load board posts for all board slides
  useEffect(() => {
    if (!sessionId || !quiz) return;

    const loadPosts = async () => {
      const results = await loadBoardPostsForSlides({
        quiz,
        sessionBackend,
        sessionId,
        sessionType,
        sessions,
      });
      if (results) {
        setBoardPosts(results);
      }
    };

    const channel = supabase
      .channel(`results-posts:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_session_posts', filter: `session_public_id=eq.${sessionId}` }, () => {
        loadPosts().catch(console.error);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_session_post_likes', filter: `session_public_id=eq.${sessionId}` }, () => {
        loadPosts().catch(console.error);
      })
      .subscribe();

    loadPosts().catch(console.error);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionBackend, sessionId, sessionType, quiz]);
  
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
        let correctResponses = 0;
        
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
            const rawAnswer = response.answer;
            const abcSelectedIds = slide.activityType === 'abc'
              ? getABCSelectedAnswerIds(rawAnswer as string | string[] | undefined)
              : [];

            if (slide.activityType === 'abc' && abcSelectedIds.length > 0) {
              abcSelectedIds.forEach((answerId) => {
                answerCounts[answerId] = (answerCounts[answerId] || 0) + 1;
              });
            } else {
              let answer = String(rawAnswer);

              // For paper tests, answer is a letter (A, B, C, D) - map to option id
              if (isPaperTest && options && answer.match(/^[A-Z]$/)) {
                const optionIndex = answer.charCodeAt(0) - 65; // A=0, B=1, etc
                const option = options[optionIndex];
                if (option) {
                  answer = option.id || option.label || answer;
                }
              }

              answerCounts[answer] = (answerCounts[answer] || 0) + 1;
            }
            totalTime += response.timeSpent || 0;
            responseCount++;
            if (response.isCorrect === true) {
              correctResponses++;
            }
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
          correctResponses,
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

  // ── Hooks that depend on computed data ────────────────────────────────────

  const {
    classRecommendation, setClassRecommendation,
    isGeneratingRecommendation,
    recommendationSaved, setRecommendationSaved,
    handleGenerateClassRecommendation,
    handleSaveRecommendation,
  } = useClassRecommendation({
    quiz,
    session,
    sessionId,
    studentResults,
    questionStats,
    overallStats,
  });

  const {
    showEvaluationPanel, setShowEvaluationPanel,
    teacherNotes, setTeacherNotes,
    generatedAssessment, setGeneratedAssessment,
    isGeneratingAssessment,
    currentResultId,
    isEvaluationSaved,
    isEvaluationShared,
    isEditing, setIsEditing,
    editedAssessment, setEditedAssessment,
    handleGenerateAssessment,
    handleSaveAssessment,
    handleShareWithStudent,
  } = useFormativeAssessment({
    selectedStudentId,
    sessionId,
    quiz,
    studentResults,
    questionStats,
  });

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
      const aSuccessRate = a.totalResponses > 0 ? a.correctResponses / a.totalResponses : 0;
      const bSuccessRate = b.totalResponses > 0 ? b.correctResponses / b.totalResponses : 0;
      
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
        <FirstTimeSetupDialog
          studentCount={Object.keys(session?.students || {}).length}
          availableClasses={availableClasses}
          setupClassId={setupClassId}
          setSetupClassId={setSetupClassId}
          suggestedClassName={suggestedClassName}
          setupSubject={setupSubject}
          setSetupSubject={setSetupSubject}
          isSyncing={isSyncing}
          sessionId={sessionId}
          onConfirm={handleFirstTimeSetupConfirm}
          onDismiss={() => setShowFirstTimeSetup(false)}
        />
      )}
      
      {/* Sync to Class Dialog */}
      {showSyncDialog && (
        <SyncToClassDialog
          studentCount={studentResults.length}
          availableClasses={availableClasses}
          selectedClassId={selectedClassId}
          setSelectedClassId={setSelectedClassId}
          selectedSubject={selectedSubject}
          setSelectedSubject={setSelectedSubject}
          syncSuccess={syncSuccess}
          isSyncing={isSyncing}
          onSync={handleSyncToClass}
          onClose={() => { setShowSyncDialog(false); setSelectedClassId(''); }}
        />
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
                            onClick={() => { navigate(routes.edit(quiz.id)); setShowSettingsMenu(false); }}
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
                        onClick={() => handleGenerateAssessment(selectedStudent || filteredStudent)}
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
                            onClick={() => handleGenerateAssessment(selectedStudent || filteredStudent)}
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
                              const isStudentAnswer = selectedStudent && getABCSelectedAnswerIds(studentAnswer as string | string[] | undefined).includes(option.id);
                              
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
          <DeleteResultsDialog
            students={studentResults.map(s => ({ id: s.id, name: s.name, score: s.correctCount, maxScore: s.totalAnswered }))}
            deleteMode={deleteMode}
            setDeleteMode={setDeleteMode}
            studentToDelete={studentToDelete}
            setStudentToDelete={setStudentToDelete}
            isDeleting={isDeleting}
            onConfirm={handleDeleteResults}
            onClose={() => setShowDeleteDialog(false)}
          />
        )}
        </div>
      </div>
  );
}