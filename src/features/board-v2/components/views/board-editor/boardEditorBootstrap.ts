import { createEmptyQuiz, type Quiz } from '../../../../../types/quiz';
import type { BoardEditorEntryFlags } from './useBoardEditorEntry';

export interface BoardEditorBootstrapPersistence {
  loadQuizLocal: (boardId: string) => Quiz | null;
  loadQuizAsync: (boardId: string) => Promise<Quiz | null>;
}

export interface BoardEditorSessionStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

export interface BoardEditorBootstrapResult {
  quiz: Quiz;
  selectedSlideId: string | null;
  created: boolean;
}

interface PdfBoardSeedData {
  title?: string;
  sourceTitle?: string;
  transcript?: string;
  sourceId?: string;
  sourceSlug?: string;
  sourceCategory?: string;
  linkBackToWorksheet?: boolean;
}

export function getInitialSelectedSlideId(quiz: Quiz): string | null {
  return quiz.slides[0]?.id ?? null;
}

function enrichNewBoardFromEntryFlags(
  quiz: Quiz,
  entryFlags: BoardEditorEntryFlags,
  storage?: BoardEditorSessionStorage,
): Quiz {
  if (!entryFlags.fromPdf && !entryFlags.fromWorksheet) {
    return quiz;
  }

  const nextQuiz = { ...quiz };
  const pdfDataStr = storage?.getItem('vividboard_from_pdf');

  console.log('[QuizEditor] fromPdf:', entryFlags.fromPdf, 'fromWorksheet:', entryFlags.fromWorksheet);
  console.log('[QuizEditor] sessionStorage data exists:', !!pdfDataStr);

  if (pdfDataStr) {
    try {
      const pdfData = JSON.parse(pdfDataStr) as PdfBoardSeedData;
      console.log('[QuizEditor] Parsed PDF data:', {
        title: pdfData.title,
        transcriptLength: pdfData.transcript?.length || 0,
        sourceId: pdfData.sourceId,
        preview: pdfData.transcript?.substring(0, 100),
      });

      nextQuiz.title = pdfData.title || pdfData.sourceTitle || 'Nový Vividboard';
      nextQuiz.pdfTranscript = pdfData.transcript;

      if (pdfData.linkBackToWorksheet && pdfData.sourceId) {
        nextQuiz.sourceWorksheet = {
          id: pdfData.sourceId,
          slug: pdfData.sourceSlug,
          category: pdfData.sourceCategory,
        };
      }

      storage?.removeItem('vividboard_from_pdf');
      return nextQuiz;
    } catch (error) {
      console.error('[QuizEditor] Failed to parse PDF data:', error);
    }
  }

  console.log('[QuizEditor] No PDF data in sessionStorage, checking URL params');

  if (entryFlags.sourceId && entryFlags.sourceCategory) {
    console.log('[QuizEditor] Found source info in URL:', {
      sourceId: entryFlags.sourceId,
      sourceSlug: entryFlags.sourceSlug,
      sourceCategory: entryFlags.sourceCategory,
    });

    nextQuiz.sourceWorksheet = {
      id: entryFlags.sourceId,
      slug: entryFlags.sourceSlug || entryFlags.sourceId,
      category: entryFlags.sourceCategory,
    };
  }

  return nextQuiz;
}

export async function loadOrCreateBoardEditorQuiz({
  boardId,
  entryFlags,
  persistence,
  storage,
}: {
  boardId: string;
  entryFlags: BoardEditorEntryFlags;
  persistence: BoardEditorBootstrapPersistence;
  storage?: BoardEditorSessionStorage;
}): Promise<BoardEditorBootstrapResult> {
  let existingQuiz = persistence.loadQuizLocal(boardId);

  if (!existingQuiz) {
    console.log('[QuizEditor] Quiz not in localStorage, trying Supabase...');
    existingQuiz = await persistence.loadQuizAsync(boardId);
  }

  if (existingQuiz) {
    console.log('[QuizEditor] Loaded existing quiz:', existingQuiz.id, existingQuiz.title);
    return {
      quiz: existingQuiz,
      selectedSlideId: getInitialSelectedSlideId(existingQuiz),
      created: false,
    };
  }

  console.log('[QuizEditor] Creating new quiz:', boardId);

  const newQuiz = enrichNewBoardFromEntryFlags(createEmptyQuiz(boardId), entryFlags, storage);

  console.log('[QuizEditor] Setting quiz with sourceWorksheet:', newQuiz.sourceWorksheet);

  return {
    quiz: newQuiz,
    selectedSlideId: getInitialSelectedSlideId(newQuiz),
    created: true,
  };
}
