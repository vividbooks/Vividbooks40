import { describe, expect, it } from 'vitest';
import type { LiveQuizSession, Quiz } from '../types/quiz';
import {
  buildQuizResultsOverallStats,
  buildQuizResultsQuestionAggregates,
  buildQuizResultsStudentRows,
  sortQuizResultsQuestionAggregates,
} from './quiz-results-aggregates';

const slideAbcId = 'slide-abc-1';

function minimalQuiz(): Quiz {
  return {
    id: 'q1',
    title: 'Test',
    slides: [
      {
        id: slideAbcId,
        type: 'activity',
        activityType: 'abc',
        order: 0,
        question: 'Otázka 1?',
        options: [
          { id: 'a', label: 'A', content: 'Špatně', isCorrect: false },
          { id: 'b', label: 'B', content: 'Správně', isCorrect: true },
        ],
      } as Quiz['slides'][0],
    ],
  } as Quiz;
}

function minimalSession(students: LiveQuizSession['students']): LiveQuizSession {
  return {
    id: 'sess',
    quizId: 'q1',
    teacherId: 't',
    teacherName: 'Učitel',
    isActive: false,
    currentSlideIndex: 0,
    isPaused: false,
    showResults: true,
    isLocked: false,
    createdAt: new Date().toISOString(),
    students,
  };
}

describe('buildQuizResultsStudentRows', () => {
  it('aggregates scores from responses', () => {
    const quiz = minimalQuiz();
    const session = minimalSession({
      s1: {
        name: 'Anna',
        joinedAt: '',
        currentSlide: 0,
        isOnline: false,
        responses: [
          {
            slideId: slideAbcId,
            activityType: 'abc',
            answer: 'b',
            isCorrect: true,
            answeredAt: '',
            timeSpent: 10,
          },
        ],
      },
    });

    const rows = buildQuizResultsStudentRows(session, quiz, {});
    expect(rows).toHaveLength(1);
    expect(rows[0].correctCount).toBe(1);
    expect(rows[0].totalAnswered).toBe(1);
    expect(rows[0].successRate).toBe(100);
    expect(rows[0].totalTime).toBe(10);
  });

  it('filters by studentFilter when not student view', () => {
    const quiz = minimalQuiz();
    const session = minimalSession({
      s1: { name: 'A', joinedAt: '', currentSlide: 0, isOnline: false, responses: [] },
      s2: { name: 'B', joinedAt: '', currentSlide: 0, isOnline: false, responses: [] },
    });

    const rows = buildQuizResultsStudentRows(session, quiz, { studentFilter: 's2', isStudentView: false });
    expect(rows.map((r) => r.id)).toEqual(['s2']);
  });
});

describe('buildQuizResultsQuestionAggregates', () => {
  it('counts ABC answers per option', () => {
    const quiz = minimalQuiz();
    const session = minimalSession({
      s1: {
        name: 'A',
        joinedAt: '',
        currentSlide: 0,
        isOnline: false,
        responses: [
          {
            slideId: slideAbcId,
            activityType: 'abc',
            answer: 'a',
            isCorrect: false,
            answeredAt: '',
            timeSpent: 5,
          },
        ],
      },
      s2: {
        name: 'B',
        joinedAt: '',
        currentSlide: 0,
        isOnline: false,
        responses: [
          {
            slideId: slideAbcId,
            activityType: 'abc',
            answer: 'b',
            isCorrect: true,
            answeredAt: '',
            timeSpent: 15,
          },
        ],
      },
    });

    const agg = buildQuizResultsQuestionAggregates(session, quiz);
    expect(agg).toHaveLength(1);
    expect(agg[0].answerCounts.a).toBe(1);
    expect(agg[0].answerCounts.b).toBe(1);
    expect(agg[0].correctResponses).toBe(1);
    expect(agg[0].totalResponses).toBe(2);
    expect(agg[0].averageTime).toBe(10);
  });
});

describe('buildQuizResultsOverallStats', () => {
  it('computes distribution bands', () => {
    const q = [{ slideId: '1', question: '', type: 'activity', answerCounts: {}, correctResponses: 0, totalResponses: 0, averageTime: 0 }];
    const students = [
      { id: '1', name: 'X', responses: [], correctCount: 0, totalAnswered: 1, successRate: 85, totalTime: 0 },
      { id: '2', name: 'Y', responses: [], correctCount: 0, totalAnswered: 1, successRate: 50, totalTime: 0 },
      { id: '3', name: 'Z', responses: [], correctCount: 0, totalAnswered: 1, successRate: 10, totalTime: 0 },
    ];
    const o = buildQuizResultsOverallStats(q as any, students as any);
    expect(o.distribution.excellent).toBe(1);
    expect(o.distribution.average).toBe(1);
    expect(o.distribution.poor).toBe(1);
    expect(o.avgSuccessRate).toBe(48);
  });
});

describe('sortQuizResultsQuestionAggregates', () => {
  it('orders by difficulty', () => {
    const stats = [
      {
        slideId: 'e',
        question: '',
        type: 'activity',
        answerCounts: {},
        correctResponses: 1,
        totalResponses: 2,
        averageTime: 0,
      },
      {
        slideId: 'h',
        question: '',
        type: 'activity',
        answerCounts: {},
        correctResponses: 0,
        totalResponses: 2,
        averageTime: 0,
      },
    ] as ReturnType<typeof buildQuizResultsQuestionAggregates>;

    const easiest = sortQuizResultsQuestionAggregates(stats, 'easiest');
    expect(easiest[0].slideId).toBe('e');

    const hardest = sortQuizResultsQuestionAggregates(stats, 'hardest');
    expect(hardest[0].slideId).toBe('h');
  });
});
