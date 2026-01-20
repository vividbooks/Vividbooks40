/**
 * Session History Utilities
 * 
 * Fetches historical quiz sessions from Firebase for teacher dashboard
 */

import { ref, get, onValue, off } from 'firebase/database';
import { database } from './firebase-config';

// Firebase paths
const QUIZ_SESSIONS_PATH = 'quiz_sessions';
const QUIZ_SHARES_PATH = 'quiz_shares';

// =============================================
// TYPES
// =============================================

export interface HistoricalSession {
  id: string;
  type: 'live' | 'shared';
  
  // Quiz info
  quizId: string;
  quizTitle: string;
  subject?: string;
  
  // Session info
  sessionCode?: string;
  isActive: boolean;
  
  // Timing
  createdAt: string;
  endedAt?: string;
  
  // Stats
  studentsCount: number;
  averageScore: number;
  completedCount: number;
  
  // For display
  className?: string;
}

export interface SessionStudent {
  id: string;
  name: string;
  responses: {
    [slideId: string]: {
      answer: string;
      isCorrect: boolean | null;
      points: number;
      timeSpent?: number;
    };
  };
  totalScore: number;
  maxScore: number;
  completedAt?: string;
  totalTimeMs?: number;
}

// =============================================
// FETCH FUNCTIONS
// =============================================

/**
 * Get all historical sessions (both live and shared)
 */
export async function getAllSessions(): Promise<HistoricalSession[]> {
  if (!database) {
    console.warn('Firebase not available');
    return [];
  }
  
  const sessions: HistoricalSession[] = [];
  
  try {
    // Fetch live sessions
    const liveRef = ref(database, QUIZ_SESSIONS_PATH);
    const liveSnapshot = await get(liveRef);
    
    if (liveSnapshot.exists()) {
      const liveData = liveSnapshot.val();
      Object.entries(liveData).forEach(([id, data]: [string, any]) => {
        const students = data.students ? Object.keys(data.students).length : 0;
        const studentResults = data.students ? Object.values(data.students) as any[] : [];
        
        // Calculate average score
        let totalScore = 0;
        let completedStudents = 0;
        
        studentResults.forEach((student: any) => {
          if (student.responses) {
            const responses = Object.values(student.responses) as any[];
            const correct = responses.filter((r: any) => r.isCorrect === true).length;
            const total = responses.length;
            if (total > 0) {
              totalScore += (correct / total) * 100;
              completedStudents++;
            }
          }
        });
        
        const avgScore = completedStudents > 0 ? Math.round(totalScore / completedStudents) : 0;
        
        sessions.push({
          id,
          type: 'live',
          quizId: data.quizId || data.quizData?.id || '',
          quizTitle: data.quizTitle || data.quizData?.title || 'Bez názvu',
          subject: data.subject || data.quizData?.subject || '',
          sessionCode: data.sessionCode,
          isActive: data.isActive === true,
          createdAt: data.createdAt || new Date().toISOString(),
          endedAt: data.endedAt,
          studentsCount: students,
          averageScore: avgScore,
          completedCount: completedStudents,
          className: data.className,
        });
      });
    }
    
    // Fetch shared sessions
    const sharedRef = ref(database, QUIZ_SHARES_PATH);
    const sharedSnapshot = await get(sharedRef);
    
    if (sharedSnapshot.exists()) {
      const sharedData = sharedSnapshot.val();
      Object.entries(sharedData).forEach(([id, data]: [string, any]) => {
        const students = data.students ? Object.keys(data.students).length : 0;
        const studentResults = data.students ? Object.values(data.students) as any[] : [];
        
        // Calculate average score
        let totalScore = 0;
        let completedStudents = 0;
        
        studentResults.forEach((student: any) => {
          if (student.responses) {
            const responses = Object.values(student.responses) as any[];
            const correct = responses.filter((r: any) => r.isCorrect === true).length;
            const total = responses.length;
            if (total > 0) {
              totalScore += (correct / total) * 100;
              completedStudents++;
            }
          }
        });
        
        const avgScore = completedStudents > 0 ? Math.round(totalScore / completedStudents) : 0;
        
        sessions.push({
          id,
          type: 'shared',
          quizId: data.quizId || '',
          quizTitle: data.quizTitle || 'Bez názvu',
          subject: data.subject || '',
          className: data.className || '',
          isActive: data.isActive === true,
          createdAt: data.createdAt || new Date().toISOString(),
          endedAt: data.endedAt,
          studentsCount: students,
          averageScore: avgScore,
          completedCount: completedStudents,
        });
      });
    }
    
    // Sort by date (newest first)
    sessions.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
    
  } catch (error) {
    console.error('Error fetching sessions:', error);
  }
  
  return sessions;
}

/**
 * Subscribe to sessions (real-time updates)
 */
export function subscribeToSessions(
  callback: (sessions: HistoricalSession[]) => void
): () => void {
  if (!database) {
    callback([]);
    return () => {};
  }
  
  const liveRef = ref(database, QUIZ_SESSIONS_PATH);
  const sharedRef = ref(database, QUIZ_SHARES_PATH);
  
  let liveSessions: HistoricalSession[] = [];
  let sharedSessions: HistoricalSession[] = [];
  
  const updateCallback = () => {
    const allSessions = [...liveSessions, ...sharedSessions].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
    callback(allSessions);
  };
  
  const liveUnsubscribe = onValue(liveRef, (snapshot) => {
    liveSessions = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      Object.entries(data).forEach(([id, sessionData]: [string, any]) => {
        const students = sessionData.students ? Object.keys(sessionData.students).length : 0;
        const studentResults = sessionData.students ? Object.values(sessionData.students) as any[] : [];
        
        let totalScore = 0;
        let completedStudents = 0;
        
        studentResults.forEach((student: any) => {
          if (student.responses) {
            const responses = Object.values(student.responses) as any[];
            const correct = responses.filter((r: any) => r.isCorrect === true).length;
            const total = responses.length;
            if (total > 0) {
              totalScore += (correct / total) * 100;
              completedStudents++;
            }
          }
        });
        
        const avgScore = completedStudents > 0 ? Math.round(totalScore / completedStudents) : 0;
        
        liveSessions.push({
          id,
          type: 'live',
          quizId: sessionData.quizId || sessionData.quizData?.id || '',
          quizTitle: sessionData.quizTitle || sessionData.quizData?.title || 'Bez názvu',
          subject: sessionData.subject || sessionData.quizData?.subject || '',
          sessionCode: sessionData.sessionCode,
          isActive: sessionData.isActive === true,
          createdAt: sessionData.createdAt || new Date().toISOString(),
          endedAt: sessionData.endedAt,
          studentsCount: students,
          averageScore: avgScore,
          completedCount: completedStudents,
          className: sessionData.className,
        });
      });
    }
    updateCallback();
  });
  
  const sharedUnsubscribe = onValue(sharedRef, (snapshot) => {
    sharedSessions = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      Object.entries(data).forEach(([id, sessionData]: [string, any]) => {
        const students = sessionData.students ? Object.keys(sessionData.students).length : 0;
        const studentResults = sessionData.students ? Object.values(sessionData.students) as any[] : [];
        
        let totalScore = 0;
        let completedStudents = 0;
        
        studentResults.forEach((student: any) => {
          if (student.responses) {
            const responses = Object.values(student.responses) as any[];
            const correct = responses.filter((r: any) => r.isCorrect === true).length;
            const total = responses.length;
            if (total > 0) {
              totalScore += (correct / total) * 100;
              completedStudents++;
            }
          }
        });
        
        const avgScore = completedStudents > 0 ? Math.round(totalScore / completedStudents) : 0;
        
        sharedSessions.push({
          id,
          type: 'shared',
          quizId: sessionData.quizId || '',
          quizTitle: sessionData.quizTitle || 'Bez názvu',
          subject: sessionData.subject || '',
          className: sessionData.className || '',
          isActive: sessionData.isActive === true,
          createdAt: sessionData.createdAt || new Date().toISOString(),
          endedAt: sessionData.endedAt,
          studentsCount: students,
          averageScore: avgScore,
          completedCount: completedStudents,
        });
      });
    }
    updateCallback();
  });
  
  return () => {
    off(liveRef);
    off(sharedRef);
  };
}

/**
 * Get session details with all student results
 */
export async function getSessionDetails(
  sessionId: string, 
  type: 'live' | 'shared'
): Promise<{ session: HistoricalSession; students: SessionStudent[] } | null> {
  if (!database) return null;
  
  const path = type === 'live' ? QUIZ_SESSIONS_PATH : QUIZ_SHARES_PATH;
  
  try {
    const sessionRef = ref(database, `${path}/${sessionId}`);
    const snapshot = await get(sessionRef);
    
    if (!snapshot.exists()) return null;
    
    const data = snapshot.val();
    const studentResults: SessionStudent[] = [];
    
    if (data.students) {
      Object.entries(data.students).forEach(([id, student]: [string, any]) => {
        const responses = student.responses || {};
        let totalScore = 0;
        let maxScore = 0;
        
        Object.values(responses).forEach((r: any) => {
          maxScore++;
          if (r.isCorrect) totalScore++;
        });
        
        studentResults.push({
          id,
          name: student.name || 'Anonym',
          responses,
          totalScore,
          maxScore,
          completedAt: student.lastSeen,
          totalTimeMs: student.totalTimeMs,
        });
      });
    }
    
    const session: HistoricalSession = {
      id: sessionId,
      type,
      quizId: data.quizId || data.quizData?.id || '',
      quizTitle: data.quizTitle || data.quizData?.title || 'Bez názvu',
      sessionCode: data.sessionCode,
      isActive: data.isActive === true,
      createdAt: data.createdAt || new Date().toISOString(),
      endedAt: data.endedAt,
      studentsCount: studentResults.length,
      averageScore: studentResults.length > 0 
        ? Math.round(studentResults.reduce((sum, s) => sum + (s.maxScore > 0 ? (s.totalScore / s.maxScore) * 100 : 0), 0) / studentResults.length)
        : 0,
      completedCount: studentResults.filter(s => s.maxScore > 0).length,
    };
    
    return { session, students: studentResults };
  } catch (error) {
    console.error('Error fetching session details:', error);
    return null;
  }
}

/**
 * Format date for display
 */
export function formatSessionDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('cs-CZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Format time for display
 */
export function formatSessionTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

