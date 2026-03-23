import type { SupabaseClient } from '@supabase/supabase-js';
import type { Quiz } from '../../../../../types/quiz';

export interface BoardViewBootstrapPersistence {
  loadBoardLocal: (boardId: string) => Quiz | null;
  loadBoardAsync: (boardId: string) => Promise<Quiz | null>;
  saveBoard: (quiz: Quiz) => void;
}

export interface BoardViewEntryFlags {
  topicSlug: string;
  subjectSlug: string;
}

export interface BoardViewBootstrapResult {
  quiz: Quiz | null;
}

function readRawLocalBoard(boardId: string, storage?: Storage): Quiz | null {
  try {
    const rawData = storage?.getItem(`vividbooks_quiz_${boardId}`);
    if (!rawData) return null;

    const directQuiz = JSON.parse(rawData) as Quiz;
    return directQuiz && directQuiz.slides ? directQuiz : null;
  } catch (error) {
    console.error('[QuizViewPage] Direct parse failed:', error);
    return null;
  }
}

async function fetchBoardFromPagesApi(
  boardId: string,
  fetchImpl: typeof fetch,
  persistence: BoardViewBootstrapPersistence,
  projectId: string,
): Promise<Quiz | null> {
  const boardSlug = `board-${boardId}`;
  const categories = ['knihovna-vividbooks', 'matematika', 'fyzika', 'chemie', 'prirodopis'];

  for (const category of categories) {
    const url = `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${boardSlug}?category=${category}`;
    console.log(`[QuizViewPage] Trying: ${url}`);

    const response = await fetchImpl(url);
    if (!response.ok) continue;

    const data = await response.json();
    const pageData = data.page || data;

    if (!pageData.worksheetData) continue;

    const quizData = pageData.worksheetData as Quiz;
    console.log(`[QuizViewPage] Loaded quiz from Supabase:`, {
      id: quizData.id,
      slides: quizData.slides?.length,
    });

    persistence.saveBoard(quizData);
    return quizData;
  }

  return null;
}

async function fetchBoardFromTeacherBoards(
  boardId: string,
  persistence: BoardViewBootstrapPersistence,
  supabase: SupabaseClient,
): Promise<Quiz | null> {
  console.log('[QuizViewPage] Trying teacher_boards table...');

  try {
    const { data: boardData, error: boardError } = await supabase
      .from('teacher_boards')
      .select('*')
      .eq('id', boardId)
      .maybeSingle();

    if (!boardData || boardError) {
      console.log('[QuizViewPage] Not found in teacher_boards:', boardError?.message || 'no record');
      return null;
    }

    const quizFromTeacher: Quiz = {
      id: boardData.id,
      title: boardData.title || 'Board',
      slides: boardData.slides || [],
      createdAt: boardData.created_at,
      updatedAt: boardData.updated_at,
    };

    console.log('[QuizViewPage] Found in teacher_boards:', {
      id: boardData.id,
      slides: boardData.slides?.length,
    });

    persistence.saveBoard(quizFromTeacher);
    return quizFromTeacher;
  } catch (error) {
    console.error('[QuizViewPage] Error fetching from teacher_boards:', error);
    return null;
  }
}

export async function loadBoardViewQuiz({
  boardId,
  persistence,
  supabase,
  storage,
  fetchImpl = fetch,
  projectId,
}: {
  boardId: string;
  persistence: BoardViewBootstrapPersistence;
  supabase: SupabaseClient;
  storage?: Storage;
  fetchImpl?: typeof fetch;
  projectId: string;
}): Promise<BoardViewBootstrapResult> {
  console.log(`[QuizViewPage] Loading quiz with ID: ${boardId}`);

  const rawData = storage?.getItem(`vividbooks_quiz_${boardId}`);
  console.log(
    `[QuizViewPage] Direct localStorage check for vividbooks_quiz_${boardId}: ${rawData ? `EXISTS (${rawData.length} bytes)` : 'NOT FOUND'}`
  );

  const allQuizKeys = storage
    ? Object.keys(storage).filter((key) => key.startsWith('vividbooks_quiz'))
    : [];
  console.log('[QuizViewPage] All quiz keys in localStorage:', allQuizKeys);

  const loadedQuiz = persistence.loadBoardLocal(boardId);
  console.log(
    '[QuizViewPage] loadBoardLocal result:',
    loadedQuiz ? { id: loadedQuiz.id, title: loadedQuiz.title, slides: loadedQuiz.slides?.length } : 'NULL',
  );

  if (loadedQuiz?.slides?.length) {
    return { quiz: loadedQuiz };
  }

  console.log('[QuizViewPage] Not in localStorage (or empty), trying remote sources...');

  const asyncQuiz = await persistence.loadBoardAsync(boardId);
  if (asyncQuiz?.slides?.length) {
    persistence.saveBoard(asyncQuiz);
    return { quiz: asyncQuiz };
  }

  const pageQuiz = await fetchBoardFromPagesApi(boardId, fetchImpl, persistence, projectId);
  if (pageQuiz) {
    return { quiz: pageQuiz };
  }

  const teacherQuiz = await fetchBoardFromTeacherBoards(boardId, persistence, supabase);
  if (teacherQuiz) {
    return { quiz: teacherQuiz };
  }

  const rawQuiz = readRawLocalBoard(boardId, storage);
  if (rawQuiz) {
    console.log('[QuizViewPage] Direct parse successful:', {
      id: rawQuiz.id,
      slides: rawQuiz.slides.length,
    });
    return { quiz: rawQuiz };
  }

  console.log('[QuizViewPage] Board not found anywhere');
  return { quiz: null };
}
