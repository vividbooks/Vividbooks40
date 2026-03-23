import { QuizResultsPage } from '../../../../../components/quiz/QuizResultsPage';
import { useBoardResultsEntry } from './useBoardResultsEntry';

export function BoardResultsShellV2() {
  const entry = useBoardResultsEntry();

  return (
    <QuizResultsPage
      sessionId={entry.sessionId}
      queryParams={entry.searchParams}
      setQueryParams={entry.setSearchParams}
      navigateOverride={entry.navigate}
      routes={entry.routes}
      sessions={entry.sessions}
    />
  );
}
