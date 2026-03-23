import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Quiz } from '../../../../../types/quiz';
import { useBoardV2Runtime } from '../../../context/BoardV2Context';
import { boardRoutes } from '../../../routes/boardRoutes';

export interface BoardEditorEntryFlags {
  returnUrl: string | null;
  initialTab: 'editor' | 'results';
  fromPdf: boolean;
  fromWorksheet: boolean;
  openAI: boolean;
  sourceId: string | null;
  sourceSlug: string | null;
  sourceCategory: string | null;
}

export interface BoardEditorEntryRuntime {
  boardId?: string;
  navigate: ReturnType<typeof useNavigate>;
  searchParams: URLSearchParams;
  entryFlags: BoardEditorEntryFlags;
  persistence: {
    loadQuizLocal: (boardId: string) => Quiz | null;
    loadQuizAsync: (boardId: string) => Promise<Quiz | null>;
    saveQuiz: (quiz: Quiz) => void;
  };
  routes: {
    results: typeof boardRoutes.results;
    view: typeof boardRoutes.view;
  };
}

export function getBoardEditorEntryFlags(searchParams: URLSearchParams): BoardEditorEntryFlags {
  return {
    returnUrl: searchParams.get('returnUrl'),
    initialTab: (searchParams.get('tab') as 'editor' | 'results') || 'editor',
    fromPdf: searchParams.get('fromPdf') === 'true',
    fromWorksheet: searchParams.get('fromWorksheet') === 'true',
    openAI: searchParams.get('openAI') === 'true',
    sourceId: searchParams.get('sourceId'),
    sourceSlug: searchParams.get('sourceSlug'),
    sourceCategory: searchParams.get('sourceCategory'),
  };
}

export function useBoardEditorEntry(): BoardEditorEntryRuntime {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { persistence, routes } = useBoardV2Runtime();

  const editorPersistence = useMemo(
    () => ({
      loadQuizLocal: (boardId: string) => persistence.loadBoard(boardId),
      loadQuizAsync: (boardId: string) => persistence.loadBoardAsync(boardId),
      saveQuiz: (quiz: Quiz) => persistence.saveBoard(quiz),
    }),
    [persistence],
  );

  const entryFlags = useMemo(
    () => getBoardEditorEntryFlags(searchParams),
    [searchParams],
  );

  return {
    boardId: id,
    navigate,
    searchParams,
    entryFlags,
    persistence: editorPersistence,
    routes: {
      results: routes.results,
      view: routes.view,
    },
  };
}
