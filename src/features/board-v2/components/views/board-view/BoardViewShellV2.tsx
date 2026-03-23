import { QuizViewPage } from '../../../../../components/quiz/QuizViewPage';
import { useBoardViewEntry } from './useBoardViewEntry';

/**
 * Transitional V2 shell.
 * Keeps a stable component boundary while the legacy teacher/view runtime
 * is gradually extracted out of `QuizViewPage`.
 */
export function BoardViewShellV2() {
  const entry = useBoardViewEntry();

  return (
    <QuizViewPage
      boardId={entry.boardId}
      queryParams={entry.searchParams}
      navigateOverride={entry.navigate}
      entryFlags={entry.entryFlags}
      persistence={entry.persistence}
      routes={entry.routes}
    />
  );
}
