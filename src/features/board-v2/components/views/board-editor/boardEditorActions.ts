import type { Quiz } from '../../../../../types/quiz';

export interface BoardEditorSavePersistence {
  saveQuiz: (quiz: Quiz) => void;
}

export interface BoardEditorSaveOptions {
  quiz: Quiz;
  persistence: BoardEditorSavePersistence;
  projectId: string;
  storage?: Storage;
  fetchImpl?: typeof fetch;
}

export function getBoardServerAccessToken(storage?: Storage): string | undefined {
  try {
    const stored = storage?.getItem('sb-njbtqmsxbyvpwigfceke-auth-token');
    if (!stored) return undefined;

    const parsed = JSON.parse(stored);
    return parsed?.access_token;
  } catch {
    return undefined;
  }
}

export async function saveBoardToServer({
  quiz,
  projectId,
  storage,
  fetchImpl = fetch,
}: BoardEditorSaveOptions): Promise<boolean> {
  const accessToken = getBoardServerAccessToken(storage);
  if (!accessToken) return false;

  const boardSlug = `board-${quiz.id}`;

  await fetchImpl(
    `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: boardSlug,
        title: quiz.title || 'Board',
        category: 'knihovna-vividbooks',
        type: 'board',
        worksheetData: quiz,
      }),
    },
  );

  return true;
}

export async function persistBoardDraft(options: BoardEditorSaveOptions): Promise<boolean> {
  options.persistence.saveQuiz(options.quiz);
  return saveBoardToServer(options);
}

export function buildBoardReturnUrl({
  quiz,
  returnUrl,
}: {
  quiz?: Quiz | null;
  returnUrl?: string | null;
}): string {
  let targetUrl = returnUrl || '/library/my-content';
  const sourceWorksheet = quiz?.sourceWorksheet;

  if (quiz && sourceWorksheet) {
    const separator = targetUrl.includes('?') ? '&' : '?';
    targetUrl = `${targetUrl}${separator}linkBoard=${quiz.id}&linkToItem=${sourceWorksheet.id}`;
  }

  return targetUrl;
}

export function saveBoardForView({
  quiz,
  persistence,
  storage,
}: {
  quiz: Quiz;
  persistence: BoardEditorSavePersistence;
  storage?: Storage;
}): void {
  persistence.saveQuiz(quiz);

  if (!storage) return;

  const storageKey = `vividbooks_quiz_${quiz.id}`;
  const saved = storage.getItem(storageKey);
  console.log(
    '[QuizEditor] Verify save:',
    saved ? 'SUCCESS' : 'FAILED',
    saved ? `${JSON.parse(saved).slides?.length} slides` : '',
  );
}
