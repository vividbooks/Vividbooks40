import type { Quiz, QuizSlide } from '../../../types/quiz';

export function cloneBoardJson(board: Quiz): Quiz {
  return JSON.parse(JSON.stringify(board)) as Quiz;
}

export function cloneBoardSlides(slides: QuizSlide[]): QuizSlide[] {
  return JSON.parse(JSON.stringify(slides)) as QuizSlide[];
}

export function isQuizLike(value: unknown): value is Quiz {
  if (!value || typeof value !== 'object') return false;
  const maybeQuiz = value as Partial<Quiz>;
  return typeof maybeQuiz.id === 'string' && Array.isArray(maybeQuiz.slides);
}
