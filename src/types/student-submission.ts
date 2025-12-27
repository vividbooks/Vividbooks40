/**
 * Student Submission Types
 * 
 * Types for student assignment submissions including
 * paste detection and AI suspicion tracking.
 */

// Submission status
export type SubmissionStatus = 'not_started' | 'writing' | 'submitted' | 'graded';

// AI suspicion level based on paste events
export type AiSuspicionLevel = 'none' | 'low' | 'medium' | 'high';

// Individual paste event
export interface PasteEvent {
  /** Unique identifier */
  id: string;
  /** When the paste occurred */
  timestamp: string;
  /** The pasted text content */
  text: string;
  /** Number of words pasted */
  wordCount: number;
  /** Whether user provided a source */
  sourceProvided: boolean;
  /** The source URL/reference if provided */
  source?: string;
  /** Whether user dismissed the warning without providing source */
  dismissedWithoutSource: boolean;
}

// Submission settings (from teacher)
export interface SubmissionSettings {
  /** Whether the assignment has a description */
  hasAssignment: boolean;
  /** Assignment description text */
  assignmentDescription?: string;
  /** Whether AI assistant is enabled */
  aiAssistantEnabled: boolean;
  /** Due date for the assignment */
  dueDate?: string;
}

// Full student submission
export interface StudentSubmission {
  /** Unique submission ID */
  id: string;
  /** Student ID */
  studentId: string;
  /** Assignment ID */
  assignmentId: string;
  /** Assignment title */
  assignmentTitle: string;
  /** Current submission status */
  status: SubmissionStatus;
  /** When the student started working */
  startedAt?: string;
  /** When last edited */
  lastEditedAt?: string;
  /** When submitted */
  submittedAt?: string;
  /** All paste events */
  pasteEvents: PasteEvent[];
  /** Calculated AI suspicion level */
  aiSuspicionLevel: AiSuspicionLevel;
  /** Submission settings from teacher */
  settings: SubmissionSettings;
  /** Grade if graded */
  grade?: number;
  /** Teacher feedback */
  feedback?: string;
}

/**
 * Calculate AI suspicion level based on paste events
 * 
 * Logic:
 * - No paste events = 'none'
 * - Paste events with sources = 'low' (student is citing)
 * - Some paste events without sources = 'medium'
 * - Many paste events without sources or large pastes = 'high'
 */
export function calculateAiSuspicion(pasteEvents: PasteEvent[]): AiSuspicionLevel {
  if (pasteEvents.length === 0) {
    return 'none';
  }

  const eventsWithoutSource = pasteEvents.filter(e => e.dismissedWithoutSource);
  const totalWords = eventsWithoutSource.reduce((sum, e) => sum + e.wordCount, 0);

  // High suspicion: many events without source or large word count
  if (eventsWithoutSource.length >= 5 || totalWords >= 200) {
    return 'high';
  }

  // Medium suspicion: some events without source
  if (eventsWithoutSource.length >= 2 || totalWords >= 50) {
    return 'medium';
  }

  // Low suspicion: one event without source or all have sources
  if (eventsWithoutSource.length >= 1) {
    return 'low';
  }

  // All paste events have sources provided
  return 'low';
}



