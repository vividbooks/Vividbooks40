/**
 * Quiz Storage - Utility funkce pro ukládání kvízů/boardů do localStorage
 */

import { Quiz, QuizSlide } from '../types/quiz';

const QUIZZES_KEY = 'vividbooks_quizzes';
const QUIZ_PREFIX = 'vividbooks_quiz_';

/**
 * Typ pro seznam kvízů (metadata)
 */
export interface QuizListItem {
  id: string;
  title: string;
  subject?: string;
  grade?: number;
  createdAt: string;
  updatedAt: string;
  slidesCount: number;
  folderId?: string | null; // ID složky, ve které je kvíz uložen (null = root)
}

/**
 * Získat seznam všech kvízů (metadata)
 */
export function getQuizList(): QuizListItem[] {
  try {
    const list = localStorage.getItem(QUIZZES_KEY);
    const parsedList = list ? JSON.parse(list) : [];
    
    // Filter out empty quizzes (0 slides)
    // This cleans up any "zombie" files created by opening the editor without saving content
    return parsedList.filter((item: QuizListItem) => item.slidesCount > 0);
  } catch (error) {
    console.error('Error loading quiz list:', error);
    return [];
  }
}

/**
 * Uložit/aktualizovat kvíz
 */
export function saveQuiz(quiz: Quiz): void {
  try {
    // Uložit samotný quiz
    localStorage.setItem(
      `${QUIZ_PREFIX}${quiz.id}`, 
      JSON.stringify(quiz)
    );
    
    // Aktualizovat seznam
    const list = getQuizList();
    const existingIndex = list.findIndex(item => item.id === quiz.id);
    
    const listItem: QuizListItem = {
      id: quiz.id,
      title: quiz.title || 'Bez názvu',
      subject: quiz.subject || undefined,
      grade: quiz.grade || undefined,
      updatedAt: new Date().toISOString(),
      createdAt: existingIndex >= 0 ? list[existingIndex].createdAt : new Date().toISOString(),
      slidesCount: quiz.slides?.length || 0,
      // Preserve folderId from existing item
      folderId: existingIndex >= 0 ? list[existingIndex].folderId : undefined,
    };
    
    if (existingIndex >= 0) {
      list[existingIndex] = listItem;
    } else {
      list.unshift(listItem); // Nové na začátek
    }
    
    localStorage.setItem(QUIZZES_KEY, JSON.stringify(list));
  } catch (error) {
    console.error('Error saving quiz:', error);
  }
}

/**
 * Načíst kvíz podle ID
 */
export function getQuiz(id: string): Quiz | null {
  try {
    const data = localStorage.getItem(`${QUIZ_PREFIX}${id}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error loading quiz:', error);
    return null;
  }
}

/**
 * Smazat kvíz
 */
export function deleteQuiz(id: string): void {
  try {
    localStorage.removeItem(`${QUIZ_PREFIX}${id}`);
    
    const list = getQuizList().filter(item => item.id !== id);
    localStorage.setItem(QUIZZES_KEY, JSON.stringify(list));
  } catch (error) {
    console.error('Error deleting quiz:', error);
  }
}

/**
 * Duplikovat kvíz
 */
export function duplicateQuiz(id: string): Quiz | null {
  try {
    const original = getQuiz(id);
    if (!original) return null;
    
    const duplicate: Quiz = {
      ...original,
      id: crypto.randomUUID(),
      title: `${original.title || 'Bez názvu'} (kopie)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    saveQuiz(duplicate);
    return duplicate;
  } catch (error) {
    console.error('Error duplicating quiz:', error);
    return null;
  }
}

/**
 * Zkontrolovat, zda quiz existuje
 */
export function quizExists(id: string): boolean {
  return localStorage.getItem(`${QUIZ_PREFIX}${id}`) !== null;
}

/**
 * Přesunout kvíz do složky
 */
export function moveQuizToFolder(quizId: string, folderId: string | null): void {
  try {
    const list = getQuizList();
    const index = list.findIndex(item => item.id === quizId);
    
    if (index >= 0) {
      list[index].folderId = folderId;
      localStorage.setItem(QUIZZES_KEY, JSON.stringify(list));
    }
  } catch (error) {
    console.error('Error moving quiz to folder:', error);
  }
}

/**
 * Získat kvízy v konkrétní složce
 */
export function getQuizzesInFolder(folderId: string | null): QuizListItem[] {
  const list = getQuizList();
  return list.filter(item => (item.folderId || null) === folderId);
}

/**
 * Získat kvízy v root (bez složky)
 */
export function getRootQuizzes(): QuizListItem[] {
  return getQuizzesInFolder(null);
}

/**
 * Migrate from old storage format if needed
 */
export function migrateOldQuizStorage(): void {
  try {
    // Check for quizzes stored with old key format
    const keys = Object.keys(localStorage);
    const oldQuizKeys = keys.filter(k => k.startsWith('vivid-quiz-'));
    
    for (const key of oldQuizKeys) {
      const data = localStorage.getItem(key);
      if (data) {
        const quiz = JSON.parse(data);
        // Save to new format
        saveQuiz(quiz);
        // Remove old format
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error('Error migrating old quiz storage:', error);
  }
}

