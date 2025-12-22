/**
 * Types for Student Document Submissions and Teacher Grading
 */

// =============================================
// SUBMISSION STATUS
// =============================================

/**
 * Status of a student's work on an assignment
 */
export type SubmissionStatus = 
  | 'not_started'     // Student hasn't opened it yet
  | 'writing'         // Student is currently working (píše)
  | 'submitted'       // Student submitted (odevzdáno)
  | 'graded';         // Teacher graded it (oznámkováno)

// =============================================
// INLINE COMMENTS (Google Docs style)
// =============================================

/**
 * Position of text selection for a comment
 */
export interface TextSelection {
  /** Block ID where the comment is attached */
  blockId: string;
  /** Start offset in the text content */
  startOffset: number;
  /** End offset in the text content */
  endOffset: number;
  /** The selected text (for display when original text changes) */
  selectedText: string;
}

/**
 * A single inline comment from teacher
 */
export interface InlineComment {
  id: string;
  /** Teacher who created the comment */
  teacherId: string;
  teacherName: string;
  /** Position in document */
  selection: TextSelection;
  /** Comment content */
  content: string;
  /** When the comment was created */
  createdAt: string;
  /** Whether student has read this comment */
  isRead: boolean;
}

// =============================================
// AI DETECTION / PASTE WARNING
// =============================================

/**
 * Record of a paste event for AI detection
 */
export interface PasteEvent {
  id: string;
  /** When the paste happened */
  timestamp: string;
  /** Number of words pasted */
  wordCount: number;
  /** What the student said about the source */
  sourceUrl?: string;
  /** If student dismissed warning without providing source */
  dismissedWithoutSource: boolean;
  /** The pasted text (first 100 chars for reference) */
  textPreview: string;
}

// =============================================
// GRADING
// =============================================

/**
 * Grade given by teacher
 */
export interface SubmissionGrade {
  /** Percentage score (0-100) */
  percentage: number;
  /** Final comment from teacher */
  finalComment: string;
  /** When graded */
  gradedAt: string;
  /** Teacher who graded */
  gradedBy: string;
  gradedByName: string;
}

// =============================================
// STUDENT SUBMISSION
// =============================================

/**
 * A student's submission of an assignment/worksheet
 */
export interface StudentSubmission {
  id: string;
  
  /** Assignment info */
  assignmentId: string;
  assignmentTitle: string;
  assignmentType: 'worksheet' | 'document' | 'board';
  
  /** Student info */
  studentId: string;
  studentName: string;
  
  /** Class info */
  classId: string;
  className: string;
  
  /** Current status */
  status: SubmissionStatus;
  
  /** Timestamps */
  createdAt: string;
  startedAt?: string;
  submittedAt?: string;
  gradedAt?: string;
  lastEditedAt?: string;
  
  /** The actual content - worksheet ID or document content */
  contentId: string;
  contentSnapshot?: any; // Snapshot of worksheet/document at submission time
  
  /** Teacher comments */
  inlineComments: InlineComment[];
  
  /** AI detection data */
  pasteEvents: PasteEvent[];
  aiSuspicionLevel: 'none' | 'low' | 'medium' | 'high';
  
  /** Grade (only present if status === 'graded') */
  grade?: SubmissionGrade;
  
  /** Settings from assignment */
  settings: {
    /** Whether AI assistant is allowed */
    aiAssistantEnabled: boolean;
    /** Whether there's an assignment description */
    hasAssignment: boolean;
    /** Assignment description/instructions */
    assignmentDescription?: string;
    /** Due date */
    dueDate?: string;
  };
}

// =============================================
// ASSIGNMENT (Teacher creates this)
// =============================================

/**
 * An assignment created by a teacher
 */
export interface TeacherAssignment {
  id: string;
  
  /** Teacher info */
  teacherId: string;
  teacherName: string;
  
  /** Assignment details */
  title: string;
  description?: string;
  type: 'worksheet' | 'document' | 'board';
  
  /** What content to start from (template) */
  templateId?: string;
  
  /** Target classes */
  classIds: string[];
  
  /** Settings */
  settings: {
    aiAssistantEnabled: boolean;
    dueDate?: string;
  };
  
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
  
  /** Submissions from students (indexed by studentId) */
  submissions: Record<string, StudentSubmission>;
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Get AI suspicion level based on paste events
 */
export function calculateAiSuspicion(pasteEvents: PasteEvent[]): 'none' | 'low' | 'medium' | 'high' {
  if (pasteEvents.length === 0) return 'none';
  
  const dismissedWithoutSource = pasteEvents.filter(e => e.dismissedWithoutSource).length;
  const totalLargePasstes = pasteEvents.filter(e => e.wordCount > 20).length;
  
  if (dismissedWithoutSource >= 3 || totalLargePasstes >= 5) return 'high';
  if (dismissedWithoutSource >= 2 || totalLargePasstes >= 3) return 'medium';
  if (dismissedWithoutSource >= 1 || totalLargePasstes >= 1) return 'low';
  
  return 'none';
}

/**
 * Get Czech status label
 */
export function getStatusLabel(status: SubmissionStatus): string {
  switch (status) {
    case 'not_started': return 'Nezahájeno';
    case 'writing': return 'Píše';
    case 'submitted': return 'Odevzdáno';
    case 'graded': return 'Oznámkováno';
  }
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: SubmissionStatus): string {
  switch (status) {
    case 'not_started': return 'bg-slate-100 text-slate-600';
    case 'writing': return 'bg-amber-100 text-amber-700';
    case 'submitted': return 'bg-blue-100 text-blue-700';
    case 'graded': return 'bg-green-100 text-green-700';
  }
}

/**
 * Create empty submission for a student
 */
export function createEmptySubmission(
  assignmentId: string,
  assignmentTitle: string,
  assignmentType: 'worksheet' | 'document' | 'board',
  studentId: string,
  studentName: string,
  classId: string,
  className: string,
  settings: StudentSubmission['settings']
): StudentSubmission {
  return {
    id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    assignmentId,
    assignmentTitle,
    assignmentType,
    studentId,
    studentName,
    classId,
    className,
    status: 'not_started',
    createdAt: new Date().toISOString(),
    contentId: '',
    inlineComments: [],
    pasteEvents: [],
    aiSuspicionLevel: 'none',
    settings,
  };
}









