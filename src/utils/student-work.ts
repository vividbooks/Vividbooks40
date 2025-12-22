/**
 * Student Individual Work Management
 * 
 * Handles saving and retrieving student's individual work sessions
 * when they open boards themselves (self-study mode)
 */

import { ref, set, get, update, onValue, off } from 'firebase/database';
import { database } from './firebase-config';
import { StudentWorkSession, StudentWorkHistory, SlideResponse } from '../types/quiz';

// Firebase paths
const STUDENT_WORK_PATH = 'student_work';
const CLASSROOM_WORK_PATH = 'classroom_work';

// =============================================
// STUDENT IDENTITY (for self-study mode)
// =============================================

interface StudentIdentity {
  id: string;
  name: string;
  email?: string;
  schoolName?: string;
}

const STUDENT_IDENTITY_KEY = 'vividbooks_student_identity';

export function getStudentIdentity(): StudentIdentity | null {
  try {
    const stored = localStorage.getItem(STUDENT_IDENTITY_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading student identity:', e);
  }
  return null;
}

export function saveStudentIdentity(identity: StudentIdentity): void {
  try {
    localStorage.setItem(STUDENT_IDENTITY_KEY, JSON.stringify(identity));
  } catch (e) {
    console.error('Error saving student identity:', e);
  }
}

export function generateStudentId(): string {
  return `student_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// =============================================
// WORK SESSION MANAGEMENT
// =============================================

/**
 * Start a new work session for a student
 */
export async function startWorkSession(
  boardId: string,
  boardTitle: string,
  boardSource: 'user' | 'vividbooks',
  boardOwnerId: string | undefined,
  student: StudentIdentity
): Promise<string> {
  const sessionId = `work_${boardId}_${student.id}_${Date.now()}`;
  
  const session: StudentWorkSession = {
    id: sessionId,
    boardId,
    boardTitle,
    boardSource,
    boardOwnerId,
    studentId: student.id,
    studentName: student.name,
    studentEmail: student.email,
    startedAt: new Date().toISOString(),
    totalTimeMs: 0,
    responses: {},
    correctCount: 0,
    totalQuestions: 0,
    score: 0,
    status: 'in_progress',
  };
  
  if (!database) {
    console.error('Firebase database not initialized');
    return sessionId;
  }
  
  try {
    // Save to student's personal work history
    const studentWorkRef = ref(database, `${STUDENT_WORK_PATH}/${student.id}/sessions/${sessionId}`);
    await set(studentWorkRef, session);
    
    // If board has an owner (teacher), also save to classroom work
    if (boardOwnerId) {
      const classroomRef = ref(database, `${CLASSROOM_WORK_PATH}/${boardOwnerId}/${boardId}/${student.id}`);
      await set(classroomRef, session);
    }
    
    // Update student's last active time
    const studentMetaRef = ref(database, `${STUDENT_WORK_PATH}/${student.id}`);
    await update(studentMetaRef, {
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email || null,
      lastActiveAt: new Date().toISOString(),
    });
    
    console.log('Work session started:', sessionId);
  } catch (error) {
    console.error('Error starting work session:', error);
  }
  
  return sessionId;
}

/**
 * Update work session with a new response
 */
export async function updateWorkSession(
  studentId: string,
  sessionId: string,
  slideId: string,
  response: SlideResponse,
  totalTimeMs: number,
  boardOwnerId?: string,
  boardId?: string
): Promise<void> {
  if (!database) return;
  
  try {
    // Update student's work
    const studentSessionRef = ref(database, `${STUDENT_WORK_PATH}/${studentId}/sessions/${sessionId}`);
    await update(studentSessionRef, {
      [`responses/${slideId}`]: response,
      totalTimeMs,
    });
    
    // Update classroom work if applicable
    if (boardOwnerId && boardId) {
      const classroomRef = ref(database, `${CLASSROOM_WORK_PATH}/${boardOwnerId}/${boardId}/${studentId}`);
      await update(classroomRef, {
        [`responses/${slideId}`]: response,
        totalTimeMs,
      });
    }
  } catch (error) {
    console.error('Error updating work session:', error);
  }
}

/**
 * Complete a work session
 */
export async function completeWorkSession(
  studentId: string,
  sessionId: string,
  correctCount: number,
  totalQuestions: number,
  totalTimeMs: number,
  boardOwnerId?: string,
  boardId?: string
): Promise<void> {
  if (!database) return;
  
  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  
  const updateData = {
    completedAt: new Date().toISOString(),
    correctCount,
    totalQuestions,
    score,
    totalTimeMs,
    status: 'completed',
  };
  
  try {
    // Update student's work
    const studentSessionRef = ref(database, `${STUDENT_WORK_PATH}/${studentId}/sessions/${sessionId}`);
    await update(studentSessionRef, updateData);
    
    // Update stats
    const studentMetaRef = ref(database, `${STUDENT_WORK_PATH}/${studentId}`);
    const snapshot = await get(studentMetaRef);
    const currentData = snapshot.val() || {};
    await update(studentMetaRef, {
      totalSessionsCompleted: (currentData.totalSessionsCompleted || 0) + 1,
      totalTimeSpentMs: (currentData.totalTimeSpentMs || 0) + totalTimeMs,
      lastActiveAt: new Date().toISOString(),
    });
    
    // Update classroom work if applicable
    if (boardOwnerId && boardId) {
      const classroomRef = ref(database, `${CLASSROOM_WORK_PATH}/${boardOwnerId}/${boardId}/${studentId}`);
      await update(classroomRef, updateData);
    }
    
    console.log('Work session completed:', sessionId, 'Score:', score);
  } catch (error) {
    console.error('Error completing work session:', error);
  }
}

// =============================================
// TEACHER VIEW FUNCTIONS
// =============================================

/**
 * Get all student work for a teacher's boards
 */
export function subscribeToClassroomWork(
  teacherId: string,
  callback: (work: { [boardId: string]: { [studentId: string]: StudentWorkSession } }) => void
): () => void {
  if (!database) {
    callback({});
    return () => {};
  }
  
  const classroomRef = ref(database, `${CLASSROOM_WORK_PATH}/${teacherId}`);
  
  const unsubscribe = onValue(classroomRef, (snapshot) => {
    const data = snapshot.val() || {};
    callback(data);
  });
  
  return () => off(classroomRef);
}

/**
 * Get student work for a specific board
 */
export async function getStudentWorkForBoard(
  teacherId: string,
  boardId: string
): Promise<{ [studentId: string]: StudentWorkSession }> {
  if (!database) return {};
  
  try {
    const boardWorkRef = ref(database, `${CLASSROOM_WORK_PATH}/${teacherId}/${boardId}`);
    const snapshot = await get(boardWorkRef);
    return snapshot.val() || {};
  } catch (error) {
    console.error('Error getting student work:', error);
    return {};
  }
}

// =============================================
// STUDENT HISTORY FUNCTIONS
// =============================================

/**
 * Get student's own work history
 */
export async function getStudentWorkHistory(studentId: string): Promise<StudentWorkHistory | null> {
  if (!database) return null;
  
  try {
    const studentWorkRef = ref(database, `${STUDENT_WORK_PATH}/${studentId}`);
    const snapshot = await get(studentWorkRef);
    return snapshot.val();
  } catch (error) {
    console.error('Error getting student work history:', error);
    return null;
  }
}

/**
 * Subscribe to student's work history (real-time updates)
 */
export function subscribeToStudentWorkHistory(
  studentId: string,
  callback: (history: StudentWorkHistory | null) => void
): () => void {
  if (!database) {
    callback(null);
    return () => {};
  }
  
  const studentWorkRef = ref(database, `${STUDENT_WORK_PATH}/${studentId}`);
  
  const unsubscribe = onValue(studentWorkRef, (snapshot) => {
    callback(snapshot.val());
  });
  
  return () => off(studentWorkRef);
}

