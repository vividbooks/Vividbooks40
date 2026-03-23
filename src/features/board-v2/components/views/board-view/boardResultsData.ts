import type { BoardPost, LiveQuizSession, Quiz } from '../../../../../types/quiz';
import {
  listSessionPosts,
  listSessionVotes,
  loadLiveSession,
  loadShareSession,
  subscribeLiveSession,
  subscribeShareSession,
  type SessionBackend,
  type SessionKind,
  type ShareSessionRecord,
} from '../../../../../utils/live-session-repository';
import { supabase } from '../../../../../utils/supabase/client';

const PAPER_TEST_PROJECT_ID = 'njbtqmsxbyvpwigfceke';
const PAPER_TEST_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';
const PAPER_TEST_HEADERS = {
  apikey: PAPER_TEST_API_KEY,
  Authorization: `Bearer ${PAPER_TEST_API_KEY}`,
};

export const defaultResultsSessions = {
  loadLiveSession,
  loadShareSession,
  subscribeLiveSession,
  subscribeShareSession,
  listVotes: listSessionVotes,
  listPosts: listSessionPosts,
};

export type ResultsSessionsApi = typeof defaultResultsSessions;

export interface LoadedResultsSnapshot {
  session: LiveQuizSession;
  quiz: Quiz | null;
}

function convertShareResponsesToStudents(data: ShareSessionRecord): Record<string, any> {
  const convertedStudents: Record<string, any> = {};

  Object.entries(data.responses || {}).forEach(([studentId, studentData]) => {
    convertedStudents[studentId] = {
      name: studentData.studentName || 'Anonymní',
      studentDbId: studentId,
      responses: studentData.responses ? Object.values(studentData.responses) : [],
      joinedAt: studentData.joinedAt || data.createdAt,
      isOnline: !!studentData.isOnline,
      totalTimeMs: studentData.totalTimeMs || 0,
      startTime: studentData.startTime,
      completedAt: studentData.completedAt,
    };
  });

  return convertedStudents;
}

export function buildResultsSnapshotFromShare(data: ShareSessionRecord): LoadedResultsSnapshot {
  return {
    session: {
      ...(data as any),
      students: convertShareResponsesToStudents(data),
    } as LiveQuizSession,
    quiz: data.quizData ? (data.quizData as Quiz) : null,
  };
}

export function buildResultsSnapshotFromLive(data: LiveQuizSession): LoadedResultsSnapshot {
  return {
    session: data,
    quiz: data.quizData ? (data.quizData as Quiz) : null,
  };
}

export async function loadIndividualResultsSnapshot(params: {
  sessionId: string;
  sessions: ResultsSessionsApi;
}): Promise<LoadedResultsSnapshot | null> {
  const exactShare = await params.sessions.loadShareSession(params.sessionId);
  if (exactShare) {
    return buildResultsSnapshotFromShare(exactShare.share);
  }

  const { data: assignment } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', params.sessionId)
    .maybeSingle();

  if (!assignment) return null;

  const [{ data: results }, { data: students }] = await Promise.all([
    supabase.from('results').select('*').eq('assignment_id', params.sessionId),
    supabase.from('students').select('*').eq('class_id', assignment.class_id),
  ]);

  const convertedStudents: Record<string, any> = {};
  (results || []).forEach((result: any) => {
    const student = (students || []).find((item: any) => item.id === result.student_id);
    if (!student) return;

    convertedStudents[student.id] = {
      name: student.name,
      studentDbId: student.id,
      responses: [],
      joinedAt: result.created_at,
      isOnline: false,
      totalTimeMs: result.time_spent_ms || 0,
      completedAt: result.completed_at,
      score: result.score,
      maxScore: result.max_score,
      percentage: result.percentage,
    };
  });

  return {
    session: {
      id: params.sessionId,
      quizId: assignment.id,
      sessionName: assignment.title,
      createdAt: assignment.created_at,
      students: convertedStudents,
    } as any,
    quiz: {
      id: assignment.id,
      title: assignment.title.replace(' - ind.', ''),
      slides: [],
    } as any,
  };
}

async function fetchPaperTestAssignment(sessionId: string) {
  const assignmentRes = await fetch(
    `https://${PAPER_TEST_PROJECT_ID}.supabase.co/rest/v1/assignments?id=eq.${sessionId}&select=*`,
    { headers: PAPER_TEST_HEADERS },
  );
  const [assignment] = await assignmentRes.json();
  return assignment;
}

async function fetchPaperTestResults(sessionId: string) {
  const resultsRes = await fetch(
    `https://${PAPER_TEST_PROJECT_ID}.supabase.co/rest/v1/results?assignment_id=eq.${sessionId}&select=*`,
    { headers: PAPER_TEST_HEADERS },
  );
  return resultsRes.json();
}

async function fetchPaperTestStudents(classId: string) {
  const studentsRes = await fetch(
    `https://${PAPER_TEST_PROJECT_ID}.supabase.co/rest/v1/students?class_id=eq.${classId}&select=*`,
    { headers: PAPER_TEST_HEADERS },
  );
  return studentsRes.json();
}

function loadPaperTestAnswers(sessionId: string, studentId: string, result?: any): any[] {
  let answers: any[] = result?.answers || [];

  if (answers.length > 0) {
    return answers;
  }

  const answersKey = `paper-test-answers-${sessionId}-${studentId}`;
  try {
    const storedAnswers = localStorage.getItem(answersKey);
    if (storedAnswers) {
      answers = JSON.parse(storedAnswers);
      console.log('[QuizResults] Loaded answers from localStorage for', studentId, ':', answers.length, 'answers');
    }
  } catch (error) {
    console.error('[QuizResults] Error loading answers from localStorage:', error);
  }

  return answers;
}

function convertPaperTestAnswersToResponses(answers: any[]) {
  return answers.map((answer: any, idx: number) => ({
    slideId: `question-${answer.questionNumber || idx + 1}`,
    answer: answer.answer || '',
    isCorrect: answer.isCorrect ?? (answer.points > 0),
    timeSpent: 0,
    points: answer.points || 0,
    maxPoints: answer.maxPoints || 1,
    questionType: answer.questionType || 'abc',
    feedback: answer.feedback || '',
  }));
}

function buildPaperTestStudents(params: {
  sessionId: string;
  assignment: any;
  results: any[];
  students: any[];
}) {
  const convertedStudents: Record<string, any> = {};

  params.students.forEach((student: any) => {
    const result = params.results.find((item: any) => item.student_id === student.id);
    const answers = loadPaperTestAnswers(params.sessionId, student.id, result);

    if (result?.answers?.length > 0) {
      console.log('[QuizResults] Loaded answers from Supabase for', student.name, ':', result.answers.length, 'answers');
    }

    convertedStudents[student.id] = {
      name: student.name,
      studentDbId: student.id,
      responses: convertPaperTestAnswersToResponses(answers),
      joinedAt: result?.created_at || params.assignment.created_at,
      isOnline: false,
      totalTimeMs: 0,
      completedAt: result?.created_at,
      score: result?.score ?? null,
      maxScore: result?.max_score || 10,
      percentage: result?.percentage ?? null,
      teacherComment: result?.teacher_comment,
      paperTestAnswers: answers,
    };
  });

  return convertedStudents;
}

function buildWorksheetQuestionsFromStoredWorksheet(worksheet: any) {
  if (!worksheet?.content) return null;

  return {
    questions: worksheet.content.map((item: any, idx: number) => ({
      number: idx + 1,
      type: item.type || 'abc',
      question: item.question || item.text || '',
      correctAnswer: item.correctAnswer || item.correct || null,
      options: item.options || null,
      maxPoints: item.points || (item.type === 'open' ? 2 : 1),
    })),
    totalQuestions: worksheet.content.length,
  };
}

async function loadPaperTestWorksheetContent(assignment: any): Promise<any | null> {
  if (assignment.questions?.length > 0) {
    return { questions: assignment.questions };
  }

  const storedKeys = Object.keys(localStorage).filter((key) => key.startsWith('paper-test-content-'));
  for (const key of storedKeys) {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      if (stored.questions?.length > 0) {
        console.log('[QuizResults] Using stored paper-test content from:', key);
        return stored;
      }
    } catch {
      // Ignore parse errors in unrelated localStorage entries.
    }
  }

  if (assignment.worksheet_id) {
    const storedWorksheets = localStorage.getItem('vivid-worksheets');
    if (storedWorksheets) {
      const worksheets = JSON.parse(storedWorksheets);
      const worksheet = worksheets.find((item: any) => item.id === assignment.worksheet_id);
      const localWorksheetContent = buildWorksheetQuestionsFromStoredWorksheet(worksheet);
      if (localWorksheetContent) return localWorksheetContent;
    }
  }

  if (!assignment.worksheet_id) return null;

  try {
    const worksheetRes = await fetch(
      `https://${PAPER_TEST_PROJECT_ID}.supabase.co/rest/v1/teacher_worksheets?id=eq.${assignment.worksheet_id}&select=*`,
      { headers: PAPER_TEST_HEADERS },
    );
    const [worksheet] = await worksheetRes.json();
    if (!worksheet?.content) return null;

    const content = typeof worksheet.content === 'string'
      ? JSON.parse(worksheet.content)
      : worksheet.content;

    return {
      questions: content.map((item: any, idx: number) => ({
        number: idx + 1,
        type: item.type || 'abc',
        question: item.question || item.text || '',
        correctAnswer: item.correctAnswer || item.correct || null,
        options: item.options || null,
        maxPoints: item.points || (item.type === 'open' ? 2 : 1),
      })),
      totalQuestions: content.length,
    };
  } catch (error) {
    console.error('[QuizResults] Error loading worksheet:', error);
    return null;
  }
}

function buildPaperTestSlides(worksheetContent: any, results: any[]) {
  let slides: any[] = [];

  if (worksheetContent?.questions?.length > 0) {
    slides = worksheetContent.questions.map((question: any, idx: number) => ({
      id: `question-${idx + 1}`,
      type: 'activity',
      activityType: question.type === 'open' ? 'open' : 'abc',
      question: question.question || `Otázka ${idx + 1}`,
      correctAnswer: question.correctAnswer,
      options: question.options?.map((option: any) => ({
        id: option.label || option.id,
        label: option.label,
        content: option.text || option.content || '',
        isCorrect: option.label === question.correctAnswer,
      })),
      maxPoints: question.maxPoints || 1,
    }));
  }

  if (slides.length === 0 && results.length > 0) {
    const firstResultWithAnswers = results.find((result: any) => result.answers?.length > 0);
    if (firstResultWithAnswers?.answers) {
      slides = firstResultWithAnswers.answers.map((answer: any, idx: number) => ({
        id: `question-${answer.questionNumber || idx + 1}`,
        type: 'activity',
        activityType: answer.questionType === 'open' ? 'open' : 'abc',
        question: `Otázka ${answer.questionNumber || idx + 1}`,
        correctAnswer: answer.correctAnswer,
        maxPoints: answer.maxPoints || 1,
      }));
      console.log('[QuizResults] Generated slides from answers:', slides.length);
    }
  }

  return slides.length > 0
    ? slides
    : [{
        id: 'paper-test-summary',
        type: 'activity',
        activityType: 'abc',
        question: 'Papírový test - hodnocení',
        isPaperTestSummary: true,
      }];
}

export async function loadPaperTestResultsSnapshot(sessionId: string): Promise<LoadedResultsSnapshot | null> {
  const assignment = await fetchPaperTestAssignment(sessionId);
  if (!assignment) {
    console.error('[QuizResults] Assignment not found:', sessionId);
    return null;
  }

  console.log('[QuizResults] Assignment loaded:', assignment);

  const [results, students, worksheetContent] = await Promise.all([
    fetchPaperTestResults(sessionId),
    fetchPaperTestStudents(assignment.class_id),
    loadPaperTestWorksheetContent(assignment),
  ]);

  console.log('[QuizResults] Results loaded:', results.length);
  console.log('[QuizResults] Students loaded:', students.length);
  console.log('[QuizResults] Worksheet content:', worksheetContent);

  const finalSlides = buildPaperTestSlides(worksheetContent, results);

  return {
    session: {
      id: sessionId,
      quizId: assignment.id,
      sessionName: assignment.title,
      createdAt: assignment.created_at,
      students: buildPaperTestStudents({ sessionId, assignment, results, students }),
      isPaperTest: true,
    } as any,
    quiz: {
      id: assignment.id,
      title: assignment.title,
      slides: finalSlides,
      isPaperTest: true,
      totalQuestions: worksheetContent?.totalQuestions || finalSlides.length,
    } as any,
  };
}

export async function subscribeToResultsSession(params: {
  sessionId: string;
  sessionType: string;
  sessions: ResultsSessionsApi;
  onBackend: (backend: SessionBackend) => void;
  onData: (snapshot: LoadedResultsSnapshot) => void;
}): Promise<(() => void) | null> {
  if (params.sessionType === 'shared') {
    const loaded = await params.sessions.loadShareSession(params.sessionId);
    if (!loaded) return null;

    params.onBackend(loaded.backend);
    params.onData(buildResultsSnapshotFromShare(loaded.share));

    return params.sessions.subscribeShareSession(loaded.backend, params.sessionId, (share) => {
      params.onData(buildResultsSnapshotFromShare(share));
    });
  }

  const loaded = await params.sessions.loadLiveSession(params.sessionId);
  if (!loaded) return null;

  params.onBackend(loaded.backend);
  params.onData(buildResultsSnapshotFromLive(loaded.session));

  return params.sessions.subscribeLiveSession(loaded.backend, params.sessionId, (session) => {
    params.onData(buildResultsSnapshotFromLive(session));
  });
}

export async function loadVotingResultsForSlides(params: {
  quiz: Quiz;
  sessionBackend: SessionBackend;
  sessionId: string;
  sessionType: string;
  sessions: ResultsSessionsApi;
}) {
  const votingSlides = params.quiz.slides.filter(
    (slide) => slide.type === 'activity' && slide.activityType === 'voting',
  );

  if (votingSlides.length === 0) {
    return null;
  }

  const sessionKind: SessionKind = params.sessionType === 'shared' ? 'share' : 'live';
  const results = await Promise.all(votingSlides.map(async (slide) => ({
    slideId: slide.id,
    votes: await params.sessions.listVotes(params.sessionBackend, params.sessionId, sessionKind, slide.id),
  })));

  return results.reduce<Record<string, Record<string, { selectedOptions: string[]; voterName?: string }>>>(
    (acc, item) => {
      acc[item.slideId] = item.votes;
      return acc;
    },
    {},
  );
}

export async function loadBoardPostsForSlides(params: {
  quiz: Quiz;
  sessionBackend: SessionBackend;
  sessionId: string;
  sessionType: string;
  sessions: ResultsSessionsApi;
}) {
  const boardSlides = params.quiz.slides.filter(
    (slide) => slide.type === 'activity' && slide.activityType === 'board',
  );

  if (boardSlides.length === 0) {
    return null;
  }

  const sessionKind: SessionKind = params.sessionType === 'shared' ? 'share' : 'live';
  const results = await Promise.all(boardSlides.map(async (slide) => ({
    slideId: slide.id,
    posts: await params.sessions.listPosts(params.sessionBackend, params.sessionId, sessionKind, slide.id),
  })));

  return results.reduce<Record<string, BoardPost[]>>((acc, item) => {
    acc[item.slideId] = item.posts;
    return acc;
  }, {});
}
