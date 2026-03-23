import { useState, useEffect, useRef } from 'react';
import {
  saveFormativeAssessment,
  shareFormativeAssessment,
  getResultByStudentAndSession,
} from '../../utils/supabase/classes';
import { generateFormativeAssessment } from '../../utils/ai-formative-assessment';
import { Quiz } from '../../types/quiz';

interface StudentResult {
  id: string;
  studentDbId?: string;
  name: string;
  correctCount: number;
  totalAnswered: number;
  successRate: number;
  totalTime: number;
  responses: Array<{ slideId: string; answer: any; isCorrect?: boolean }>;
}

interface QuestionStat {
  slideId: string;
  question: string;
  activityType?: string;
  correctAnswer?: string;
}

interface UseFormativeAssessmentProps {
  selectedStudentId: string | null;
  sessionId: string | undefined;
  quiz: Quiz | null;
  studentResults: StudentResult[];
  questionStats: QuestionStat[];
}

export interface UseFormativeAssessmentReturn {
  showEvaluationPanel: boolean;
  setShowEvaluationPanel: (show: boolean) => void;
  teacherNotes: string;
  setTeacherNotes: (notes: string) => void;
  generatedAssessment: string;
  setGeneratedAssessment: (text: string) => void;
  isGeneratingAssessment: boolean;
  currentResultId: string | null;
  isEvaluationSaved: boolean;
  isEvaluationShared: boolean;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  editedAssessment: string;
  setEditedAssessment: (text: string) => void;
  handleGenerateAssessment: (selectedStudent: StudentResult | undefined) => Promise<void>;
  handleSaveAssessment: () => Promise<void>;
  handleShareWithStudent: () => Promise<void>;
}

export function useFormativeAssessment({
  selectedStudentId,
  sessionId,
  quiz,
  studentResults,
  questionStats,
}: UseFormativeAssessmentProps): UseFormativeAssessmentReturn {
  const [showEvaluationPanel, setShowEvaluationPanel] = useState(false);
  const [teacherNotes, setTeacherNotes] = useState('');
  const [generatedAssessment, setGeneratedAssessment] = useState('');
  const [isGeneratingAssessment, setIsGeneratingAssessment] = useState(false);
  const [currentResultId, setCurrentResultId] = useState<string | null>(null);
  const [isEvaluationSaved, setIsEvaluationSaved] = useState(false);
  const [isEvaluationShared, setIsEvaluationShared] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedAssessment, setEditedAssessment] = useState('');

  const lastLoadedStudentRef = useRef<string | null>(null);
  const justSavedRef = useRef(false);

  // Load existing evaluation when selected student changes
  useEffect(() => {
    async function loadExistingEvaluation() {
      if (!selectedStudentId || !sessionId) {
        setCurrentResultId(null);
        setIsEvaluationSaved(false);
        setIsEvaluationShared(false);
        setGeneratedAssessment('');
        setTeacherNotes('');
        lastLoadedStudentRef.current = null;
        return;
      }

      if (justSavedRef.current) {
        console.log('[Evaluation] Skipping load - just saved, waiting for propagation');
        return;
      }

      if (lastLoadedStudentRef.current === selectedStudentId) {
        console.log('[Evaluation] Skipping load - already loaded for this student');
        return;
      }

      const student = studentResults.find((s) => s.id === selectedStudentId);
      const studentDbId = student?.studentDbId || null;
      const studentName = student?.name;

      console.log(
        '[Evaluation] Loading from Supabase for student:',
        studentDbId,
        'name:',
        studentName,
        'session:',
        sessionId
      );

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
  }, [selectedStudentId, sessionId, studentResults]);

  const handleGenerateAssessment = async (selectedStudent: StudentResult | undefined) => {
    if (!selectedStudent || !quiz) return;

    justSavedRef.current = true;
    setIsGeneratingAssessment(true);

    const questions = questionStats.map((stat) => {
      const response = selectedStudent.responses.find((r) => r.slideId === stat.slideId);
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
      subjectName: 'Kvíz',
      studentPerformance: {
        studentName: selectedStudent.name,
        totalCorrect: selectedStudent.correctCount,
        totalQuestions: selectedStudent.totalAnswered,
        successRate: selectedStudent.successRate,
        totalTimeSeconds: selectedStudent.totalTime,
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

  const handleSaveAssessment = async () => {
    if (!currentResultId || !generatedAssessment) {
      console.log('[Save] No result ID or assessment to save');
      return;
    }

    const assessmentText = isEditing ? editedAssessment : generatedAssessment;

    console.log('[Save] Saving to Supabase, resultId:', currentResultId);
    justSavedRef.current = true;

    const result = await saveFormativeAssessment(currentResultId, assessmentText, teacherNotes);

    if (result.success) {
      console.log('[Save] ✅ Saved successfully');
      setIsEvaluationSaved(true);
      setGeneratedAssessment(assessmentText);
      setIsEditing(false);

      setTimeout(() => {
        justSavedRef.current = false;
      }, 3000);
    } else {
      console.error('[Save] ❌ Failed:', result.error);
      justSavedRef.current = false;
      alert('Nepodařilo se uložit hodnocení: ' + result.error);
    }
  };

  const handleShareWithStudent = async () => {
    if (!currentResultId) {
      console.log('[Share] No result ID');
      return;
    }

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

  return {
    showEvaluationPanel,
    setShowEvaluationPanel,
    teacherNotes,
    setTeacherNotes,
    generatedAssessment,
    setGeneratedAssessment,
    isGeneratingAssessment,
    currentResultId,
    isEvaluationSaved,
    isEvaluationShared,
    isEditing,
    setIsEditing,
    editedAssessment,
    setEditedAssessment,
    handleGenerateAssessment,
    handleSaveAssessment,
    handleShareWithStudent,
  };
}
