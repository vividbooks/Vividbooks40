import type { Quiz } from '../../../../../types/quiz';
import type { SessionData } from '../../../../../hooks/quiz/useSessionsData';
import { buildWorksheetEditorPath } from '../../../../../utils/worksheet-editor-runtime';
import { saveBoardForView, type BoardEditorSavePersistence } from './boardEditorActions';
import type { boardRoutes } from '../../../routes/boardRoutes';

export interface BoardEditorNavigate {
  (to: string): void;
}

export function openBoardResultsPage({
  session,
  navigate,
  routes,
}: {
  session: Pick<SessionData, 'id' | 'type'>;
  navigate: BoardEditorNavigate;
  routes: Pick<typeof boardRoutes, 'results'>;
}): void {
  navigate(routes.results(session.id, { type: session.type }));
}

export function openWorksheetEditorFromBoard({
  quiz,
  persistence,
  navigate,
  saveWorksheet,
  createWorksheetFromBoard,
}: {
  quiz: Quiz;
  persistence: BoardEditorSavePersistence;
  navigate: BoardEditorNavigate;
  saveWorksheet: (worksheet: { id: string }) => void;
  createWorksheetFromBoard: (quiz: Quiz) => { id: string };
}): void {
  persistence.saveQuiz(quiz);
  const worksheet = createWorksheetFromBoard(quiz);
  saveWorksheet(worksheet);
  navigate(buildWorksheetEditorPath(worksheet.id));
}

export function openBoardViewFromEditor({
  quiz,
  persistence,
  navigate,
  routes,
  storage,
}: {
  quiz: Quiz;
  persistence: BoardEditorSavePersistence;
  navigate: BoardEditorNavigate;
  routes: Pick<typeof boardRoutes, 'view'>;
  storage?: Storage;
}): void {
  saveBoardForView({
    quiz,
    persistence,
    storage,
  });

  navigate(routes.view(quiz.id));
}
