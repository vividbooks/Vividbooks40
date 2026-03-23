import type { Quiz } from '../../../types/quiz';
import {
  duplicateQuiz,
  getPublicQuizAsync,
  getQuiz,
  getQuizAsync,
  moveQuizToFolder,
  saveQuiz,
  setBoardPublic,
} from '../../../utils/quiz-storage';

export const boardPersistenceAdapter = {
  loadBoard(boardId: string): Quiz | null {
    return getQuiz(boardId);
  },

  loadBoardAsync(boardId: string): Promise<Quiz | null> {
    return getQuizAsync(boardId);
  },

  saveBoard(board: Quiz, folderId?: string | null): void {
    saveQuiz(board, folderId);
  },

  duplicateBoard(boardId: string): Quiz | null {
    return duplicateQuiz(boardId);
  },

  moveBoardToFolder(boardId: string, folderId: string | null): void {
    moveQuizToFolder(boardId, folderId);
  },

  getPublicBoard(boardId: string): Promise<Quiz | null> {
    return getPublicQuizAsync(boardId);
  },

  setBoardPublic(boardId: string, isPublic: boolean): Promise<boolean> {
    return setBoardPublic(boardId, isPublic);
  },
};

export type BoardPersistenceAdapter = typeof boardPersistenceAdapter;
