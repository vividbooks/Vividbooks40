/**
 * Hook for managing student submissions
 * 
 * Provides functionality to:
 * - Track submission status (not_started, writing, submitted, graded)
 * - Record paste events for AI detection
 * - Submit work
 * - Receive teacher grades
 */

import { useState, useCallback, useEffect } from 'react';
import { 
  StudentSubmission, 
  PasteEvent, 
  InlineComment,
  SubmissionGrade,
  SubmissionStatus,
  calculateAiSuspicion,
  createEmptySubmission
} from '../types/student-submission';

// =============================================
// LOCAL STORAGE HELPERS
// =============================================

const SUBMISSIONS_KEY = 'vividbooks_student_submissions';

function getStoredSubmissions(): Record<string, StudentSubmission> {
  try {
    const stored = localStorage.getItem(SUBMISSIONS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function storeSubmissions(submissions: Record<string, StudentSubmission>): void {
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions));
}

// =============================================
// HOOK: useStudentSubmission
// =============================================

interface UseStudentSubmissionOptions {
  /** Assignment ID */
  assignmentId: string;
  /** Assignment title */
  assignmentTitle: string;
  /** Assignment type */
  assignmentType: 'worksheet' | 'document' | 'board';
  /** Student ID */
  studentId: string;
  /** Student name */
  studentName: string;
  /** Class ID */
  classId: string;
  /** Class name */
  className: string;
  /** Assignment settings */
  settings: {
    aiAssistantEnabled: boolean;
    hasAssignment: boolean;
    assignmentDescription?: string;
    dueDate?: string;
  };
  /** Callback when status changes */
  onStatusChange?: (status: SubmissionStatus) => void;
}

export function useStudentSubmission(options: UseStudentSubmissionOptions) {
  const {
    assignmentId,
    assignmentTitle,
    assignmentType,
    studentId,
    studentName,
    classId,
    className,
    settings,
    onStatusChange,
  } = options;

  const submissionKey = `${assignmentId}_${studentId}`;

  // Load or create submission
  const [submission, setSubmission] = useState<StudentSubmission>(() => {
    const stored = getStoredSubmissions();
    if (stored[submissionKey]) {
      return stored[submissionKey];
    }
    return createEmptySubmission(
      assignmentId,
      assignmentTitle,
      assignmentType,
      studentId,
      studentName,
      classId,
      className,
      settings
    );
  });

  // Save to localStorage whenever submission changes
  useEffect(() => {
    const stored = getStoredSubmissions();
    stored[submissionKey] = submission;
    storeSubmissions(stored);
  }, [submission, submissionKey]);

  // Notify on status change
  useEffect(() => {
    onStatusChange?.(submission.status);
  }, [submission.status, onStatusChange]);

  // Update submission
  const updateSubmission = useCallback((updates: Partial<StudentSubmission>) => {
    setSubmission(prev => ({
      ...prev,
      ...updates,
      lastEditedAt: new Date().toISOString(),
    }));
  }, []);

  // Start working (changes status to 'writing')
  const startWorking = useCallback(() => {
    if (submission.status === 'not_started') {
      updateSubmission({
        status: 'writing',
        startedAt: new Date().toISOString(),
      });
    }
  }, [submission.status, updateSubmission]);

  // Record a paste event
  const recordPasteEvent = useCallback((event: PasteEvent) => {
    const newPasteEvents = [...submission.pasteEvents, event];
    updateSubmission({
      pasteEvents: newPasteEvents,
      aiSuspicionLevel: calculateAiSuspicion(newPasteEvents),
    });
  }, [submission.pasteEvents, updateSubmission]);

  // Submit the work
  const submitWork = useCallback(async () => {
    if (submission.status === 'submitted' || submission.status === 'graded') {
      throw new Error('Práce již byla odevzdána');
    }

    updateSubmission({
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    });

    // TODO: Send to server/Supabase
    // await supabase.from('submissions').upsert(...)

    return true;
  }, [submission.status, updateSubmission]);

  // Check if work can be edited
  const canEdit = submission.status === 'not_started' || submission.status === 'writing';

  // Check if work is submitted
  const isSubmitted = submission.status === 'submitted' || submission.status === 'graded';

  // Check if work is graded
  const isGraded = submission.status === 'graded';

  return {
    submission,
    updateSubmission,
    startWorking,
    recordPasteEvent,
    submitWork,
    canEdit,
    isSubmitted,
    isGraded,
  };
}

// =============================================
// HOOK: useTeacherGrading
// =============================================

interface UseTeacherGradingOptions {
  /** The submission to grade */
  submission: StudentSubmission;
  /** Teacher info */
  teacherId: string;
  teacherName: string;
  /** Callback when grading is complete */
  onGraded?: (grade: SubmissionGrade) => void;
}

export function useTeacherGrading(options: UseTeacherGradingOptions) {
  const { submission, teacherId, teacherName, onGraded } = options;

  const [comments, setComments] = useState<InlineComment[]>(submission.inlineComments);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add a comment
  const addComment = useCallback((commentData: Omit<InlineComment, 'id' | 'createdAt' | 'isRead'>) => {
    const newComment: InlineComment = {
      ...commentData,
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    setComments(prev => [...prev, newComment]);
  }, []);

  // Delete a comment
  const deleteComment = useCallback((commentId: string) => {
    setComments(prev => prev.filter(c => c.id !== commentId));
  }, []);

  // Submit grade
  const submitGrade = useCallback(async (grade: SubmissionGrade) => {
    setIsSubmitting(true);

    try {
      // Update the submission in storage
      const stored = getStoredSubmissions();
      const key = `${submission.assignmentId}_${submission.studentId}`;
      
      if (stored[key]) {
        stored[key] = {
          ...stored[key],
          status: 'graded',
          gradedAt: grade.gradedAt,
          inlineComments: comments,
          grade,
        };
        storeSubmissions(stored);
      }

      // TODO: Send to server/Supabase
      // await supabase.from('submissions').update(...)

      onGraded?.(grade);
    } finally {
      setIsSubmitting(false);
    }
  }, [submission, comments, onGraded]);

  return {
    comments,
    addComment,
    deleteComment,
    submitGrade,
    isSubmitting,
  };
}

// =============================================
// HOOK: useClassSubmissions
// =============================================

/**
 * Hook to get all submissions for a class/assignment
 * For teacher view of class status
 */
export function useClassSubmissions(classId: string, assignmentId?: string) {
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    
    // Get from localStorage for now
    const stored = getStoredSubmissions();
    const filtered = Object.values(stored).filter(s => {
      if (s.classId !== classId) return false;
      if (assignmentId && s.assignmentId !== assignmentId) return false;
      return true;
    });
    
    setSubmissions(filtered);
    setLoading(false);
  }, [classId, assignmentId]);

  // Count by status
  const statusCounts = {
    not_started: submissions.filter(s => s.status === 'not_started').length,
    writing: submissions.filter(s => s.status === 'writing').length,
    submitted: submissions.filter(s => s.status === 'submitted').length,
    graded: submissions.filter(s => s.status === 'graded').length,
  };

  return {
    submissions,
    loading,
    statusCounts,
  };
}

export default {
  useStudentSubmission,
  useTeacherGrading,
  useClassSubmissions,
};


















