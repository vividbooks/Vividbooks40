import { boardSessionAdapter } from '../../../adapters/boardSessionAdapter';
import type { SessionBackend } from '../../../../../utils/live-session-repository';
import type { Quiz } from '../../../../../types/quiz';

const CLASSROOM_UNSUBSCRIBE_KEY = '__vividClassroomShareUnsubscribe';

export interface BoardShareSettings {
  anonymousAccess: boolean;
  showSolutionHints: boolean;
  showActivityResults: boolean;
  requireAnswerToProgress: boolean;
  showNotes: boolean;
}

export interface BoardShareIdentity {
  userId?: string;
}

export function createBoardShareId(shareCode: string): string {
  return `share_${shareCode}_${Date.now()}`;
}

export function buildBoardShareLink({
  shareId,
  studentRoute,
  baseUrl,
  origin,
}: {
  shareId: string;
  studentRoute: (shareId: string) => string;
  baseUrl: string;
  origin: string;
}): string {
  return new URL(studentRoute(shareId).replace(/^\//, ''), `${origin}${baseUrl}`).toString();
}

export function buildBoardShareSession({
  shareId,
  shareCode,
  quiz,
  sessionName,
  settings,
  createdBy,
}: {
  shareId: string;
  shareCode: string;
  quiz: Quiz;
  sessionName: string;
  settings: BoardShareSettings;
  createdBy: string;
}) {
  return {
    id: shareId,
    quizId: quiz.id,
    quizData: quiz,
    sessionName,
    shareCode,
    settings,
    createdAt: new Date().toISOString(),
    createdBy,
    responses: {},
  };
}

export function buildBoardClassroomShareSession({
  shareId,
  shareCode,
  quiz,
  createdBy,
}: {
  shareId: string;
  shareCode: string;
  quiz: Quiz;
  createdBy: string;
}) {
  return {
    id: shareId,
    quizId: quiz.id,
    quizData: quiz,
    sessionName: quiz.title || 'Výuka',
    shareCode,
    mode: 'classroom',
    settings: {
      anonymousAccess: false,
      showSolutionHints: true,
      showActivityResults: true,
      requireAnswerToProgress: false,
      showNotes: false,
    },
    createdAt: new Date().toISOString(),
    createdBy,
    responses: {},
  };
}

export async function createBoardShareSessionRecord(share: Record<string, any>): Promise<SessionBackend> {
  const created = await boardSessionAdapter.createShareSession({
    share,
  });

  return created.backend;
}

export async function beginBoardClassroomShare({
  backend,
  shareId,
}: {
  backend: SessionBackend;
  shareId: string;
}): Promise<void> {
  await boardSessionAdapter.updateShareSession(backend, shareId, {
    startedAt: new Date().toISOString(),
  });
}

export function storeBoardClassroomUnsubscribe(unsubscribe: () => void): void {
  if (typeof window === 'undefined') return;
  (window as Window & { [CLASSROOM_UNSUBSCRIBE_KEY]?: () => void })[CLASSROOM_UNSUBSCRIBE_KEY] = unsubscribe;
}

export function clearBoardClassroomUnsubscribe(): void {
  if (typeof window === 'undefined') return;
  const windowWithUnsubscribe = window as Window & { [CLASSROOM_UNSUBSCRIBE_KEY]?: () => void };
  const unsubscribe = windowWithUnsubscribe[CLASSROOM_UNSUBSCRIBE_KEY];
  if (typeof unsubscribe === 'function') unsubscribe();
  delete windowWithUnsubscribe[CLASSROOM_UNSUBSCRIBE_KEY];
}

export function subscribeToBoardClassroomShare({
  backend,
  shareId,
  onResponses,
}: {
  backend: SessionBackend;
  shareId: string;
  onResponses: (responses: Record<string, any>) => void;
}): () => void {
  return boardSessionAdapter.subscribeShareSession(backend, shareId, (data) => {
    onResponses((data as any).responses || {});
  });
}
