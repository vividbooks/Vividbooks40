import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { boardRoutes, type BoardRoutes, type RouteQuery } from '../routes/boardRoutes';

export interface BoardRoutingAdapter {
  routes: BoardRoutes;
  goToEdit: (boardId: string, query?: RouteQuery) => void;
  goToView: (boardId: string, query?: RouteQuery) => void;
  goToPresent: (boardId: string, query?: RouteQuery) => void;
  goToResults: (sessionId: string, query?: RouteQuery) => void;
  goToJoin: (code?: string, query?: RouteQuery) => void;
  goToStudent: (shareId: string, query?: RouteQuery) => void;
  goToPublic: (boardId: string, query?: RouteQuery) => void;
  goToCopy: (boardId: string, query?: RouteQuery) => void;
}

export function useBoardRoutingAdapter(): BoardRoutingAdapter {
  const navigate = useNavigate();

  return {
    routes: boardRoutes,
    goToEdit: useCallback((boardId: string, query?: RouteQuery) => navigate(boardRoutes.edit(boardId, query)), [navigate]),
    goToView: useCallback((boardId: string, query?: RouteQuery) => navigate(boardRoutes.view(boardId, query)), [navigate]),
    goToPresent: useCallback((boardId: string, query?: RouteQuery) => navigate(boardRoutes.present(boardId, query)), [navigate]),
    goToResults: useCallback((sessionId: string, query?: RouteQuery) => navigate(boardRoutes.results(sessionId, query)), [navigate]),
    goToJoin: useCallback((code?: string, query?: RouteQuery) => navigate(boardRoutes.join(code, query)), [navigate]),
    goToStudent: useCallback((shareId: string, query?: RouteQuery) => navigate(boardRoutes.student(shareId, query)), [navigate]),
    goToPublic: useCallback((boardId: string, query?: RouteQuery) => navigate(boardRoutes.public(boardId, query)), [navigate]),
    goToCopy: useCallback((boardId: string, query?: RouteQuery) => navigate(boardRoutes.copy(boardId, query)), [navigate]),
  };
}
