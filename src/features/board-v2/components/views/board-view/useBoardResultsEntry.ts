import { useMemo } from 'react';
import {
  useNavigate,
  useParams,
  useSearchParams,
  type NavigateFunction,
  type SetURLSearchParams,
} from 'react-router-dom';
import { useBoardV2Runtime } from '../../../context/BoardV2Context';
import { boardRoutes } from '../../../routes/boardRoutes';

export interface BoardResultsEntryRuntime {
  sessionId?: string;
  navigate: NavigateFunction;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  routes: {
    edit: typeof boardRoutes.edit;
  };
  sessions: ReturnType<typeof useBoardV2Runtime>['sessions'];
}

export function useBoardResultsEntry(): BoardResultsEntryRuntime {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { routes, sessions } = useBoardV2Runtime();

  const resultRoutes = useMemo(
    () => ({
      edit: routes.edit,
    }),
    [routes],
  );

  return {
    sessionId,
    navigate,
    searchParams,
    setSearchParams,
    routes: resultRoutes,
    sessions,
  };
}
