/**
 * Kanonický view-model pro obrazovku výsledků relace (celá třída / studenti / přehled otázek).
 * Použitelné jako kontrakt při přenosu UI do jiného projektu (např. vividbooks-ultra).
 */

import type { SlideResponse } from './quiz';

/** Jeden řádek žáka v tabulce / levém panelu výsledků */
export interface QuizResultsStudentRow {
  id: string;
  studentDbId?: string;
  name: string;
  responses: SlideResponse[];
  correctCount: number;
  totalAnswered: number;
  successRate: number;
  /** Sekundy (součet slide times nebo totalTimeMs/1000) */
  totalTime: number;
}

/** Jedna volba u ABC aktivity (pro sloupce odpovědí) */
export interface QuizResultsQuestionOption {
  id: string;
  label: string;
  content: string;
  isCorrect: boolean;
}

/** Agregace přes všechny žáky pro jeden aktivní slide */
export interface QuizResultsQuestionAggregate {
  slideId: string;
  question: string;
  type: string;
  activityType?: string;
  options?: QuizResultsQuestionOption[];
  answerCounts: Record<string, number>;
  correctAnswer?: string;
  correctResponses: number;
  totalResponses: number;
  averageTime: number;
}

/** Počty žáků v pásmech úspěšnosti (horní distribuční pruh) */
export interface QuizResultsClassDistribution {
  excellent: number;
  good: number;
  average: number;
  belowAverage: number;
  poor: number;
}

/** Souhrn třídy (KPI pod distribucí) */
export interface QuizResultsOverallStats {
  totalQuestions: number;
  totalStudents: number;
  avgCorrect: number;
  avgSuccessRate: number;
  avgTime: number;
  distribution: QuizResultsClassDistribution;
}

/** Řazení pravého sloupce „Přehled aktivit“ */
export type QuizResultsActivitySort = 'default' | 'easiest' | 'hardest';

/** Režim načtení z URL / routeru (cílový projekt může mapovat `share` → `shared`) */
export type QuizResultsRouteMode = 'live' | 'shared' | 'paper_test' | string;
