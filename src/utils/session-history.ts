/**
 * Session History Utilities
 * 
 * Fetches historical quiz sessions from Supabase for teacher dashboard
 */
import { supabase } from './supabase/client';

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

function getStudentMap(data: any, type: 'live' | 'shared'): Record<string, any> {
  if (type === 'shared') {
    return data.responses || data.students || {};
  }
  return data.students || {};
}

function normalizeResponses(responses: any): any[] {
  if (!responses) return [];
  return Array.isArray(responses) ? responses : Object.values(responses);
}

function buildHistoricalSession(id: string, type: 'live' | 'shared', data: any): HistoricalSession {
  const studentMap = getStudentMap(data, type);
  const students = Object.keys(studentMap).length;
  const studentResults = Object.values(studentMap) as any[];

  let totalScore = 0;
  let completedStudents = 0;

  studentResults.forEach((student: any) => {
    if (student.responses) {
      const responses = normalizeResponses(student.responses);
      const correct = responses.filter((r: any) => r.isCorrect === true).length;
      const total = responses.length;
      if (total > 0) {
        totalScore += (correct / total) * 100;
        completedStudents++;
      }
    }
  });

  const avgScore = completedStudents > 0 ? Math.round(totalScore / completedStudents) : 0;
  return {
    id,
    type,
    quizId: data.quizId || data.quizData?.id || data.source_board_id || '',
    quizTitle: data.quizTitle || data.quizData?.title || data.sessionName || data.title || 'Bez názvu',
    subject: data.subject || data.quizData?.subject || '',
    sessionCode: data.sessionCode || data.code || data.join_code || undefined,
    isActive: data.isActive === true || data.status === 'active' || data.status === 'paused',
    createdAt: data.createdAt || data.created_at || new Date().toISOString(),
    endedAt: data.endedAt || data.ended_at || undefined,
    studentsCount: students,
    averageScore: avgScore,
    completedCount: completedStudents,
    className: data.className || data.class_name || '',
  };
}

// =============================================
// FETCH FUNCTIONS
// =============================================

/**
 * Get all historical sessions (both live and shared)
 */
export async function getAllSessions(): Promise<HistoricalSession[]> {
  const sessions: HistoricalSession[] = [];
  
  try {
    const [{ data: supabaseSessions }, { data: supabaseParticipants }] = await Promise.all([
      supabase.from('live_sessions').select('public_id, kind, source_board_id, title, join_code, status, created_at, ended_at'),
      supabase.from('live_session_participants').select('session_public_id, client_identity_id, display_name, responses, completed_at, total_time_ms'),
    ]);

    const participantsBySession = (supabaseParticipants || []).reduce<Record<string, any[]>>((acc, participant: any) => {
      if (!acc[participant.session_public_id]) acc[participant.session_public_id] = [];
      acc[participant.session_public_id].push(participant);
      return acc;
    }, {});

    (supabaseSessions || []).forEach((session: any) => {
      const participants = participantsBySession[session.public_id] || [];
      const type = session.kind === 'share' ? 'shared' : 'live';
      const data = {
        ...session,
        responses: type === 'shared'
          ? participants.reduce((acc: Record<string, any>, participant: any) => {
              acc[participant.client_identity_id] = {
                studentName: participant.display_name,
                responses: participant.responses || {},
                completedAt: participant.completed_at || undefined,
                totalTimeMs: participant.total_time_ms || 0,
              };
              return acc;
            }, {})
          : undefined,
        students: type === 'live'
          ? participants.reduce((acc: Record<string, any>, participant: any) => {
              acc[participant.client_identity_id] = {
                name: participant.display_name,
                responses: participant.responses || [],
                completedAt: participant.completed_at || undefined,
                totalTimeMs: participant.total_time_ms || 0,
              };
              return acc;
            }, {})
          : undefined,
      };
      sessions.push(buildHistoricalSession(session.public_id, type, data));
    });
    
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
  getAllSessions().then(callback).catch((error) => {
    console.error('Error loading sessions:', error);
    callback([]);
  });

  const channel = supabase
    .channel('session-history')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, () => {
      getAllSessions().then(callback).catch((error) => {
        console.error('Error refreshing sessions:', error);
      });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_session_participants' }, () => {
      getAllSessions().then(callback).catch((error) => {
        console.error('Error refreshing sessions:', error);
      });
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Get session details with all student results
 */
export async function getSessionDetails(
  sessionId: string, 
  type: 'live' | 'shared'
): Promise<{ session: HistoricalSession; students: SessionStudent[] } | null> {
  try {
    const [{ data: sessionRow }, { data: participantRows }] = await Promise.all([
      supabase.from('live_sessions').select('*').eq('public_id', sessionId).maybeSingle(),
      supabase.from('live_session_participants').select('*').eq('session_public_id', sessionId),
    ]);

    if (!sessionRow) return null;

    const data = {
      ...sessionRow,
      students: type === 'live'
        ? (participantRows || []).reduce((acc: Record<string, any>, participant: any) => {
            acc[participant.client_identity_id] = {
              name: participant.display_name,
              responses: participant.responses || [],
              lastSeen: participant.last_seen_at,
              totalTimeMs: participant.total_time_ms || 0,
            };
            return acc;
          }, {})
        : undefined,
      responses: type === 'shared'
        ? (participantRows || []).reduce((acc: Record<string, any>, participant: any) => {
            acc[participant.client_identity_id] = {
              studentName: participant.display_name,
              responses: participant.responses || {},
              completedAt: participant.completed_at,
              totalTimeMs: participant.total_time_ms || 0,
            };
            return acc;
          }, {})
        : undefined,
    };

    const studentResults: SessionStudent[] = [];
    const studentMap = getStudentMap(data, type);
    Object.entries(studentMap).forEach(([id, student]: [string, any]) => {
      const responses = student.responses || {};
      let totalScore = 0;
      let maxScore = 0;

      Object.values(responses).forEach((r: any) => {
        maxScore++;
        if (r.isCorrect) totalScore++;
      });

      studentResults.push({
        id,
        name: student.name || student.studentName || 'Anonym',
        responses,
        totalScore,
        maxScore,
        completedAt: student.completedAt || student.lastSeen,
        totalTimeMs: student.totalTimeMs,
      });
    });

    return {
      session: {
        ...buildHistoricalSession(sessionId, type, data),
        studentsCount: studentResults.length,
        averageScore: studentResults.length > 0 
          ? Math.round(studentResults.reduce((sum, s) => sum + (s.maxScore > 0 ? (s.totalScore / s.maxScore) * 100 : 0), 0) / studentResults.length)
          : 0,
        completedCount: studentResults.filter(s => s.maxScore > 0).length,
      },
      students: studentResults,
    };
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

