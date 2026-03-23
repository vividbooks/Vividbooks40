import type { LiveQuizSession, Quiz, QuizSlide } from '../../../../../types/quiz';
import type { SessionBackend } from '../../../../../utils/live-session-repository';
import { boardSessionAdapter } from '../../../adapters/boardSessionAdapter';

export interface BoardTeacherIdentity {
  teacherId: string;
  teacherName: string;
}

export type BoardCompetitionMode =
  | 'competition'
  | 'team-competition'
  | 'duel-competition'
  | 'tactical-competition';

export function getBoardTeacherIdentity(profile: {
  userId?: string;
  id?: string;
  firstName?: string;
  name?: string;
} | null | undefined): BoardTeacherIdentity {
  return {
    teacherId: profile?.userId || profile?.id || 'anonymous',
    teacherName: profile?.firstName || profile?.name || 'Učitel',
  };
}

export function generateBoardSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  for (let i = 0; i < 6; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
}

export function createBoardSessionId(code: string): string {
  return `quiz_${code}_${Date.now()}`;
}

export function buildLiveBoardSession({
  quiz,
  code,
  sessionId,
  teacher,
  currentSlideIndex,
  showSolutionHints,
}: {
  quiz: Quiz;
  code: string;
  sessionId: string;
  teacher: BoardTeacherIdentity;
  currentSlideIndex: number;
  showSolutionHints: boolean;
}): LiveQuizSession {
  return {
    id: sessionId,
    quizId: quiz.id,
    code,
    teacherId: teacher.teacherId,
    teacherName: teacher.teacherName,
    isActive: true,
    currentSlideIndex,
    isPaused: false,
    showResults: false,
    isLocked: true,
    students: {},
    createdAt: new Date().toISOString(),
    settings: {
      showSolutionHints,
    },
  };
}

function getActivitySlideIds(slides: QuizSlide[]): string[] {
  return slides.filter((slide) => slide.type === 'activity').map((slide) => slide.id);
}

export function buildCompetitionBoardSession({
  quiz,
  code,
  sessionId,
  teacher,
  mode,
}: {
  quiz: Quiz;
  code: string;
  sessionId: string;
  teacher: BoardTeacherIdentity;
  mode: BoardCompetitionMode;
}): LiveQuizSession {
  const baseSession: LiveQuizSession = {
    id: sessionId,
    quizId: quiz.id,
    code,
    teacherId: teacher.teacherId,
    teacherName: teacher.teacherName,
    isActive: true,
    currentSlideIndex: 0,
    mode,
    competitionPhase: 'lobby',
    isPaused: false,
    showResults: false,
    isLocked: true,
    students: {},
    createdAt: new Date().toISOString(),
  };

  if (mode === 'competition') {
    return {
      ...baseSession,
      competitionData: {
        currentQuestionIndex: 0,
        questionSlideIds: getActivitySlideIds(quiz.slides),
        timerDuration: 45,
        timerPaused: false,
        evaluated: false,
        scores: {},
      },
      settings: {
        showSolutionHints: false,
      },
    };
  }

  return {
    ...baseSession,
    quizData: {
      id: quiz.id,
      title: quiz.title,
      slides: quiz.slides,
    },
  };
}

export async function startBoardLiveSession({
  quiz,
  session,
}: {
  quiz: Quiz;
  session: LiveQuizSession;
}): Promise<SessionBackend> {
  const created = await boardSessionAdapter.createLiveSession({
    quiz,
    session,
  });

  return created.backend;
}

export async function finishBoardLiveSession({
  backend,
  sessionId,
}: {
  backend: SessionBackend;
  sessionId: string;
}): Promise<void> {
  await boardSessionAdapter.updateLiveSession(backend, sessionId, {
    isActive: false,
    endedAt: new Date().toISOString(),
  });
}

export async function patchBoardLiveSession({
  backend,
  sessionId,
  updates,
}: {
  backend: SessionBackend;
  sessionId: string;
  updates: Partial<LiveQuizSession>;
}): Promise<void> {
  await boardSessionAdapter.updateLiveSession(backend, sessionId, updates);
}
