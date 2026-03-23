import React, { createContext, useContext, useMemo } from 'react';
import { boardClassroomAdapter } from '../adapters/boardClassroomAdapter';
import { boardCommentsAdapter } from '../adapters/boardCommentsAdapter';
import { boardPersistenceAdapter } from '../adapters/boardPersistenceAdapter';
import { useBoardRoutingAdapter } from '../adapters/boardRoutingAdapter';
import { boardSessionAdapter } from '../adapters/boardSessionAdapter';
import { boardRoutes } from '../routes/boardRoutes';

export interface BoardV2Dependencies {
  persistence: typeof boardPersistenceAdapter;
  comments: typeof boardCommentsAdapter;
  sessions: typeof boardSessionAdapter;
  classroom: typeof boardClassroomAdapter;
  routes: typeof boardRoutes;
}

const defaultDependencies: BoardV2Dependencies = {
  persistence: boardPersistenceAdapter,
  comments: boardCommentsAdapter,
  sessions: boardSessionAdapter,
  classroom: boardClassroomAdapter,
  routes: boardRoutes,
};

const BoardV2DependenciesContext = createContext<BoardV2Dependencies>(defaultDependencies);

export interface BoardV2ProviderProps {
  children: React.ReactNode;
  dependencies?: Partial<BoardV2Dependencies>;
}

export function BoardV2Provider({ children, dependencies }: BoardV2ProviderProps) {
  const value = useMemo<BoardV2Dependencies>(() => ({
    persistence: dependencies?.persistence || defaultDependencies.persistence,
    comments: dependencies?.comments || defaultDependencies.comments,
    sessions: dependencies?.sessions || defaultDependencies.sessions,
    classroom: dependencies?.classroom || defaultDependencies.classroom,
    routes: dependencies?.routes || defaultDependencies.routes,
  }), [dependencies]);

  return (
    <BoardV2DependenciesContext.Provider value={value}>
      {children}
    </BoardV2DependenciesContext.Provider>
  );
}

export function useBoardV2Dependencies(): BoardV2Dependencies {
  return useContext(BoardV2DependenciesContext);
}

export function useBoardV2Runtime() {
  const dependencies = useBoardV2Dependencies();
  const routing = useBoardRoutingAdapter();

  return {
    ...dependencies,
    routing,
  };
}

export function BoardV2Boundary({ children }: { children: React.ReactNode }) {
  useBoardV2Runtime();
  return <>{children}</>;
}
