import { QuizEditorLayout } from '../../../../../components/quiz/QuizEditorLayout';
import { useBoardEditorEntry } from './useBoardEditorEntry';

export interface BoardEditorShellV2Props {
  theme?: 'light' | 'dark';
}

/**
 * Transitional V2 shell.
 * For now it renders the legacy editor layout behind a stable V2 entrypoint,
 * so future extraction can happen inside this boundary instead of in routes.
 */
export function BoardEditorShellV2({ theme = 'light' }: BoardEditorShellV2Props) {
  const entry = useBoardEditorEntry();

  return (
    <QuizEditorLayout
      theme={theme}
      boardId={entry.boardId}
      queryParams={entry.searchParams}
      navigateOverride={entry.navigate}
      entryFlags={entry.entryFlags}
      persistence={entry.persistence}
      routes={entry.routes}
    />
  );
}
