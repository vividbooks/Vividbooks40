import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useBoardV2Runtime } from '../../../context/BoardV2Context';
import { boardRoutes } from '../../../routes/boardRoutes';
import type { Quiz } from '../../../../../types/quiz';
import type { BoardViewEntryFlags } from './boardViewBootstrap';

export interface BoardViewEntryRuntime {
  boardId?: string;
  navigate: ReturnType<typeof useNavigate>;
  searchParams: URLSearchParams;
  entryFlags: BoardViewEntryFlags;
  persistence: {
    loadBoardLocal: (boardId: string) => Quiz | null;
    loadBoardAsync: (boardId: string) => Promise<Quiz | null>;
    saveBoard: (quiz: Quiz) => void;
  };
  routes: {
    edit: typeof boardRoutes.edit;
    present: typeof boardRoutes.present;
    results: typeof boardRoutes.results;
    student: typeof boardRoutes.student;
  };
}

export function getBoardViewEntryFlags(searchParams: URLSearchParams): BoardViewEntryFlags {
  return {
    topicSlug: searchParams.get('topic') || '',
    subjectSlug: searchParams.get('subject') || 'fyzika',
  };
}

export function useBoardViewEntry(): BoardViewEntryRuntime {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { persistence, routes } = useBoardV2Runtime();

  const viewPersistence = useMemo(
    () => ({
      loadBoardLocal: (boardId: string) => persistence.loadBoard(boardId),
      loadBoardAsync: (boardId: string) => persistence.loadBoardAsync(boardId),
      saveBoard: (quiz: Quiz) => persistence.saveBoard(quiz),
    }),
    [persistence],
  );

  const entryFlags = useMemo(
    () => getBoardViewEntryFlags(searchParams),
    [searchParams],
  );

  return {
    boardId: id,
    navigate,
    searchParams,
    entryFlags,
    persistence: viewPersistence,
    routes: {
      edit: routes.edit,
      present: routes.present,
      results: routes.results,
      student: routes.student,
    },
  };
}
