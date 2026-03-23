import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase/client';

interface StudentResponse {
  slideId: string;
  answer: string | string[];
  isCorrect?: boolean;
  answeredAt: string;
}

interface SessionStudent {
  studentName: string;
  responses: Record<string, StudentResponse>;
  completedAt?: string;
  joinedAt?: string;
  isOnline?: boolean;
}

export interface SessionData {
  id: string;
  type: 'live' | 'shared';
  sessionName?: string;
  quizId: string;
  createdAt: string;
  endedAt?: string;
  students: Record<string, SessionStudent>;
  settings?: {
    anonymousAccess?: boolean;
    showSolutionHints?: boolean;
    showActivityResults?: boolean;
  };
}

export interface UseSessionsDataReturn {
  sessions: SessionData[];
  loadingSessions: boolean;
}

export function useSessionsData(
  quizId: string | undefined,
  viewMode: string
): UseSessionsDataReturn {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    if (viewMode !== 'results' || !quizId) return;

    let cancelled = false;
    setLoadingSessions(true);

    Promise.all([
      supabase.from('live_sessions').select('public_id, kind, title, source_board_id, created_at, ended_at, settings').eq('source_board_id', quizId),
      supabase.from('live_session_participants').select('session_public_id, client_identity_id, display_name, responses, completed_at'),
    ])
      .then(([supabaseSessionsRes, supabaseParticipantsRes]) => {
        if (cancelled) return;

        const supabaseData: SessionData[] = [];
        const supabaseSessions = supabaseSessionsRes.data || [];
        const supabaseParticipants = supabaseParticipantsRes.data || [];
        const participantsBySession = supabaseParticipants.reduce<Record<string, typeof supabaseParticipants>>((acc, participant) => {
          if (!acc[participant.session_public_id]) acc[participant.session_public_id] = [];
          acc[participant.session_public_id].push(participant);
          return acc;
        }, {});

        supabaseSessions.forEach((session) => {
          const students: Record<string, SessionStudent> = {};
          (participantsBySession[session.public_id] || []).forEach((participant: any) => {
            students[participant.client_identity_id] = {
              studentName: participant.display_name || 'Anonymní',
              responses: Array.isArray(participant.responses)
                ? participant.responses.reduce((acc: Record<string, StudentResponse>, response: StudentResponse) => {
                    if (response?.slideId) acc[response.slideId] = response;
                    return acc;
                  }, {})
                : (participant.responses || {}),
              completedAt: participant.completed_at || undefined,
            };
          });

          supabaseData.push({
            id: session.public_id,
            type: session.kind === 'share' ? 'shared' : 'live',
            sessionName: session.title || (session.kind === 'share' ? 'Sdílený úkol' : 'Živé promítání'),
            quizId: session.source_board_id,
            createdAt: session.created_at,
            endedAt: session.ended_at || undefined,
            students,
            settings: session.settings || undefined,
          });
        });

        // Include sessions regardless of student count — show all sessions for this quiz
        const deduped = new Map<string, SessionData>();
        supabaseData.forEach((session) => {
          deduped.set(`${session.type}:${session.id}`, session);
        });
        const allSessions = [...deduped.values()];
        allSessions.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setSessions(allSessions);
        setLoadingSessions(false);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[useSessionsData] Failed to load sessions:', err);
          setLoadingSessions(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [viewMode, quizId]);

  return { sessions, loadingSessions };
}
