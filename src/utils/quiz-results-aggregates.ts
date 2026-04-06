/**
 * Čisté funkce: z LiveQuizSession + Quiz vyrobí řádky žáků, agregace po otázkách a souhrn třídy.
 * Logika odpovídá původní implementaci v QuizResultsPage (žádná změna chování).
 */

import type { ABCActivitySlide, LiveQuizSession, Quiz, QuizSlide } from '../types/quiz';
import type {
  QuizResultsActivitySort,
  QuizResultsOverallStats,
  QuizResultsQuestionAggregate,
  QuizResultsStudentRow,
} from '../types/quiz-results-view-model';
import { getABCSelectedAnswerIds } from './abc-evaluation';

export interface BuildQuizResultsStudentRowsOptions {
  /** `?studentFilter=` — zúžení na jednoho žáka (mimo student view) */
  studentFilter?: string | null;
  /** `viewMode=student` — nefiltruj seznam, výběr žáka řeší jiný efekt */
  isStudentView?: boolean;
}

function isPaperTestSession(session: LiveQuizSession | null, quiz: Quiz | null): boolean {
  return Boolean((session as { isPaperTest?: boolean } | null)?.isPaperTest || (quiz as { isPaperTest?: boolean } | null)?.isPaperTest);
}

/**
 * Záznam žáka ve session (může mít rozšíření z písemky / Supabase: score, maxScore, …).
 */
type SessionStudentValue = NonNullable<LiveQuizSession['students']>[string] & {
  studentDbId?: string;
  score?: number;
  maxScore?: number;
  percentage?: number;
  totalTimeMs?: number;
};

export function buildQuizResultsStudentRows(
  session: LiveQuizSession | null,
  quiz: Quiz | null,
  options: BuildQuizResultsStudentRowsOptions = {},
): QuizResultsStudentRow[] {
  const { studentFilter, isStudentView } = options;

  if (!session?.students || !quiz) {
    return [];
  }

  let entries = Object.entries(session.students) as [string, SessionStudentValue][];

  if (studentFilter && !isStudentView) {
    const decodedFilter = decodeURIComponent(studentFilter);
    entries = entries.filter(([id, student]) => {
      const studentDbId = student.studentDbId;
      return (
        studentDbId === studentFilter ||
        id === studentFilter ||
        student.name === decodedFilter ||
        student.name.toLowerCase() === decodedFilter.toLowerCase()
      );
    });
    if (entries.length === 0) {
      entries = Object.entries(session.students) as [string, SessionStudentValue][];
    }
  }

  return entries.map(([id, student]) => {
    const responses = student.responses || [];
    const hasDirectScore = student.score !== undefined;

    const correctCount = hasDirectScore ? student.score! : responses.filter((r) => r.isCorrect).length;
    const totalAnswered = hasDirectScore ? student.maxScore! : responses.length;

    const slidesTime = responses.reduce((sum, r) => sum + (r.timeSpent || 0), 0);
    const totalTime = student.totalTimeMs ? Math.round(student.totalTimeMs / 1000) : slidesTime;

    const successRate =
      hasDirectScore && student.percentage !== undefined
        ? student.percentage
        : totalAnswered > 0
          ? Math.round((correctCount / totalAnswered) * 100)
          : 0;

    return {
      id,
      studentDbId: student.studentDbId,
      name: student.name,
      responses,
      correctCount,
      totalAnswered,
      successRate,
      totalTime,
    };
  });
}

function slideQuestionText(slide: QuizSlide): string {
  const s = slide as { question?: string; problem?: string };
  return s.question || s.problem || 'Otázka';
}

export function buildQuizResultsQuestionAggregates(
  session: LiveQuizSession | null,
  quiz: Quiz | null,
): QuizResultsQuestionAggregate[] {
  if (!quiz || !session?.students) return [];

  const isPaperTest = isPaperTestSession(session, quiz);

  return quiz.slides
    .filter((s) => s.type === 'activity')
    .map((slide) => {
      const answerCounts: Record<string, number> = {};
      let totalTime = 0;
      let responseCount = 0;
      let correctResponses = 0;

      let correctAnswer: string | undefined;
      let options: QuizResultsQuestionAggregate['options'];

      if (slide.activityType === 'abc') {
        const abcSlide = slide as ABCActivitySlide;
        options = abcSlide.options || [];
        correctAnswer = options.find((o) => o.isCorrect)?.id || (slide as { correctAnswer?: string }).correctAnswer;
      }

      Object.values(session.students || {}).forEach((student) => {
        const response = student.responses?.find((r) => r.slideId === slide.id);
        if (response) {
          const rawAnswer = response.answer;
          const abcSelectedIds =
            slide.activityType === 'abc' ? getABCSelectedAnswerIds(rawAnswer as string | string[] | undefined) : [];

          if (slide.activityType === 'abc' && abcSelectedIds.length > 0) {
            abcSelectedIds.forEach((answerId) => {
              answerCounts[answerId] = (answerCounts[answerId] || 0) + 1;
            });
          } else {
            let answer = String(rawAnswer);
            if (isPaperTest && options && /^[A-Z]$/.test(answer)) {
              const optionIndex = answer.charCodeAt(0) - 65;
              const option = options[optionIndex];
              if (option) {
                answer = option.id || option.label || answer;
              }
            }
            answerCounts[answer] = (answerCounts[answer] || 0) + 1;
          }
          totalTime += response.timeSpent || 0;
          responseCount++;
          if (response.isCorrect === true) {
            correctResponses++;
          }
        }
      });

      return {
        slideId: slide.id,
        question: slideQuestionText(slide),
        type: slide.type,
        activityType: slide.activityType,
        options,
        answerCounts,
        correctAnswer,
        correctResponses,
        totalResponses: responseCount,
        averageTime: responseCount > 0 ? totalTime / responseCount : 0,
      };
    });
}

export function buildQuizResultsOverallStats(
  questionStats: QuizResultsQuestionAggregate[],
  studentRows: QuizResultsStudentRow[],
): QuizResultsOverallStats {
  const totalQuestions = questionStats.length;
  const totalStudents = studentRows.length;

  const avgCorrect =
    totalStudents > 0
      ? studentRows.reduce((sum, s) => sum + s.correctCount, 0) / totalStudents
      : 0;
  const avgSuccessRate =
    totalStudents > 0
      ? studentRows.reduce((sum, s) => sum + s.successRate, 0) / totalStudents
      : 0;
  const avgTime =
    totalStudents > 0 ? studentRows.reduce((sum, s) => sum + s.totalTime, 0) / totalStudents : 0;

  const distribution = {
    excellent: studentRows.filter((s) => s.successRate >= 80).length,
    good: studentRows.filter((s) => s.successRate >= 60 && s.successRate < 80).length,
    average: studentRows.filter((s) => s.successRate >= 40 && s.successRate < 60).length,
    belowAverage: studentRows.filter((s) => s.successRate >= 20 && s.successRate < 40).length,
    poor: studentRows.filter((s) => s.successRate < 20).length,
  };

  return {
    totalQuestions,
    totalStudents,
    avgCorrect: Math.round(avgCorrect * 10) / 10,
    avgSuccessRate: Math.round(avgSuccessRate),
    avgTime,
    distribution,
  };
}

export function sortQuizResultsQuestionAggregates(
  questionStats: QuizResultsQuestionAggregate[],
  activitySort: QuizResultsActivitySort,
): QuizResultsQuestionAggregate[] {
  if (activitySort === 'default') return questionStats;

  return [...questionStats].sort((a, b) => {
    const aRate = a.totalResponses > 0 ? a.correctResponses / a.totalResponses : 0;
    const bRate = b.totalResponses > 0 ? b.correctResponses / b.totalResponses : 0;
    if (activitySort === 'easiest') return bRate - aRate;
    return aRate - bRate;
  });
}
