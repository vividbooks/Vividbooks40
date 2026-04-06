import { useState, useEffect } from 'react';
import {
  getClasses,
  ClassGroup,
  syncQuizResultsToClass,
  QuizSessionResult,
} from '../../utils/supabase/classes';
import { isQuizSetupDismissed } from '../../features/moje-trida';
import { LiveQuizSession, Quiz } from '../../types/quiz';

interface UseClassSyncProps {
  isStudentView: boolean;
  sessionId: string | undefined;
  session: LiveQuizSession | null;
  quiz: Quiz | null;
  /** Called when a saved class recommendation is found for this session */
  onRecommendationLoaded?: (recommendation: string) => void;
}

export interface UseClassSyncReturn {
  availableClasses: ClassGroup[];
  showSyncDialog: boolean;
  setShowSyncDialog: (show: boolean) => void;
  selectedClassId: string;
  setSelectedClassId: (id: string) => void;
  selectedSubject: string;
  setSelectedSubject: (subject: string) => void;
  isSyncing: boolean;
  syncSuccess: boolean;
  showFirstTimeSetup: boolean;
  setShowFirstTimeSetup: (show: boolean) => void;
  setupClassId: string;
  setSetupClassId: (id: string) => void;
  setupSubject: string;
  setSetupSubject: (subject: string) => void;
  suggestedClassName: string;
  handleFirstTimeSetupConfirm: () => Promise<void>;
  handleSyncToClass: () => Promise<void>;
}

const SUPABASE_PROJECT_ID = 'njbtqmsxbyvpwigfceke';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';

function supabaseRestHeaders() {
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
}

export function useClassSync({
  isStudentView,
  sessionId,
  session,
  quiz,
  onRecommendationLoaded,
}: UseClassSyncProps): UseClassSyncReturn {
  const [availableClasses, setAvailableClasses] = useState<ClassGroup[]>([]);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('Matematika');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const [showFirstTimeSetup, setShowFirstTimeSetup] = useState(false);
  const [setupClassId, setSetupClassId] = useState('');
  const [setupSubject, setSetupSubject] = useState('');
  const [suggestedClassName, setSuggestedClassName] = useState('');
  const [hasCheckedSync, setHasCheckedSync] = useState(false);

  // Load available classes
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

  // Check if results need to be synced (first-time setup)
  useEffect(() => {
    let cancelled = false;

    async function checkIfNeedsSync() {
      if (isStudentView || !sessionId) return;

      if (hasCheckedSync || !session?.students || availableClasses.length === 0) return;

      let dismissed = false;
      try {
        dismissed = await isQuizSetupDismissed(sessionId);
      } catch (e) {
        console.warn('[FirstTimeSetup] isQuizSetupDismissed', e);
      }
      if (cancelled) return;
      if (dismissed) {
        console.log('[FirstTimeSetup] User dismissed dialog previously (repo or legacy), skipping');
        setHasCheckedSync(true);
        return;
      }

      setHasCheckedSync(true);

      try {
        const res = await fetch(
          `https://${SUPABASE_PROJECT_ID}.supabase.co/rest/v1/assignments?session_id=eq.${sessionId}&select=id,class_recommendation`,
          { headers: supabaseRestHeaders() }
        );

        if (res.ok) {
          const assignments = await res.json();
          if (assignments.length > 0) {
            console.log('[FirstTimeSetup] Results already synced, skipping dialog');

            if (assignments[0].class_recommendation) {
              onRecommendationLoaded?.(assignments[0].class_recommendation);
            }
            return;
          }
        }

        // Not synced — detect class from students
        const students = Object.values(session.students);
        const studentClassIds = students.map((s: any) => s.classId).filter(Boolean);

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

        const detectedSubject = quiz?.subject || 'Matematika';
        const matchedClass = availableClasses.find((c) => c.id === suggestedClass);

        console.log(
          '[FirstTimeSetup] Showing dialog, suggested class:',
          matchedClass?.name,
          'subject:',
          detectedSubject
        );

        setSetupClassId(suggestedClass);
        setSetupSubject(detectedSubject);
        setSuggestedClassName(matchedClass?.name || '');
        setShowFirstTimeSetup(true);
      } catch (error) {
        console.error('[FirstTimeSetup] Error checking sync status:', error);
      }
    }

    void checkIfNeedsSync();
    return () => {
      cancelled = true;
    };
  }, [sessionId, session, quiz, availableClasses, hasCheckedSync, isStudentView, onRecommendationLoaded]);

  const buildStudentResults = (students: Record<string, any>): QuizSessionResult[] =>
    Object.entries(students).map(([_, student]) => {
      const responses = student.responses || [];
      const totalCorrect = responses.filter((r: any) => r.isCorrect === true).length;
      const totalQuestions = responses.length;
      const timeSpentMs = responses.reduce((sum: number, r: any) => sum + (r.timeSpentMs || 0), 0);
      return {
        studentName: student.name,
        studentId: (student as any).studentDbId,
        responses: responses.map((r: any) => ({
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

  const handleFirstTimeSetupConfirm = async () => {
    if (!setupClassId || !session?.students || !quiz || !sessionId) return;

    setIsSyncing(true);

    const results = buildStudentResults(session.students);
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

  const handleSyncToClass = async () => {
    if (!selectedClassId || !session?.students || !quiz || !sessionId) return;

    setIsSyncing(true);
    setSyncSuccess(false);

    const results = buildStudentResults(session.students);
    const result = await syncQuizResultsToClass(
      selectedClassId,
      quiz.id,
      quiz.title,
      sessionId,
      results,
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

  return {
    availableClasses,
    showSyncDialog,
    setShowSyncDialog,
    selectedClassId,
    setSelectedClassId,
    selectedSubject,
    setSelectedSubject,
    isSyncing,
    syncSuccess,
    showFirstTimeSetup,
    setShowFirstTimeSetup,
    setupClassId,
    setSetupClassId,
    setupSubject,
    setSetupSubject,
    suggestedClassName,
    handleFirstTimeSetupConfirm,
    handleSyncToClass,
  };
}
