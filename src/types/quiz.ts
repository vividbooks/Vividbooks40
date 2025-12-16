// =============================================
// VIVIDBOARD QUIZ/TEST TYPES
// =============================================

/**
 * Slide types in a quiz
 */
export type SlideType = 'info' | 'activity' | 'tools';

/**
 * Activity types for activity slides
 */
export type ActivityType = 'abc' | 'open' | 'example' | 'true-false' | 'matching' | 'ordering';

/**
 * Base slide interface
 */
export interface BaseSlide {
  id: string;
  type: SlideType;
  order: number;
  backgroundColor?: string;
}

/**
 * Information slide - displays content without interaction
 */
export interface InfoSlide extends BaseSlide {
  type: 'info';
  title: string;
  content: string; // HTML content
  media?: {
    type: 'image' | 'video' | 'lottie';
    url: string;
    caption?: string;
  };
}

/**
 * ABC Question - Multiple choice with one correct answer
 */
export interface ABCOption {
  id: string;
  label: string; // A, B, C, D...
  content: string; // Can be text, math (LaTeX), or HTML
  isCorrect: boolean;
}

export interface ABCActivitySlide extends BaseSlide {
  type: 'activity';
  activityType: 'abc';
  question: string; // Can include LaTeX math
  options: ABCOption[];
  explanation?: string; // Shown after answering
  points: number;
  timeLimit?: number; // seconds, optional
  media?: {
    type: 'image' | 'video' | 'lottie';
    url: string;
  };
}

/**
 * Open Question - Text answer
 */
export interface OpenActivitySlide extends BaseSlide {
  type: 'activity';
  activityType: 'open';
  question: string;
  correctAnswers: string[]; // Multiple accepted answers
  caseSensitive: boolean;
  explanation?: string;
  points: number;
  timeLimit?: number;
  media?: {
    type: 'image' | 'video' | 'lottie';
    url: string;
  };
}

/**
 * Example slide - Shows worked example with steps
 */
export interface ExampleStep {
  id: string;
  content: string; // HTML/LaTeX content
  hint?: string;
}

export interface ExampleActivitySlide extends BaseSlide {
  type: 'activity';
  activityType: 'example';
  title: string;
  problem: string;
  steps: ExampleStep[];
  finalAnswer: string;
  media?: {
    type: 'image' | 'video' | 'lottie';
    url: string;
  };
}

/**
 * True/False Question
 */
export interface TrueFalseActivitySlide extends BaseSlide {
  type: 'activity';
  activityType: 'true-false';
  statement: string;
  isTrue: boolean;
  explanation?: string;
  points: number;
  timeLimit?: number;
}

/**
 * Tools slide - Interactive tools (calculator, drawing, etc.)
 */
export interface ToolsSlide extends BaseSlide {
  type: 'tools';
  toolType: 'calculator' | 'drawing' | 'graph' | 'timer' | 'random';
  config?: Record<string, unknown>;
}

/**
 * Union type for all slide types
 */
export type QuizSlide = 
  | InfoSlide 
  | ABCActivitySlide 
  | OpenActivitySlide 
  | ExampleActivitySlide 
  | TrueFalseActivitySlide
  | ToolsSlide;

/**
 * Activity slides union
 */
export type ActivitySlide = 
  | ABCActivitySlide 
  | OpenActivitySlide 
  | ExampleActivitySlide 
  | TrueFalseActivitySlide;

/**
 * Quiz/Test definition
 */
export interface Quiz {
  id: string;
  title: string;
  description?: string;
  subject?: string;
  grade?: number;
  slides: QuizSlide[];
  settings: QuizSettings;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/**
 * Quiz settings
 */
export interface QuizSettings {
  showProgress: boolean;
  showScore: boolean;
  allowSkip: boolean;
  allowBack: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showExplanations: 'immediately' | 'after-submit' | 'never';
  passingScore?: number; // percentage
  timeLimit?: number; // total time in minutes
}

// =============================================
// STUDENT RESPONSE TYPES
// =============================================

/**
 * Student's answer to a slide
 */
export interface SlideResponse {
  slideId: string;
  activityType: ActivityType;
  answer: string | string[]; // Selected option ID(s) or text answer
  isCorrect?: boolean;
  points?: number;
  answeredAt: string;
  timeSpent: number; // seconds
}

/**
 * Student's quiz session
 */
export interface QuizSession {
  id: string;
  quizId: string;
  
  // Student info
  studentId?: string;
  studentName?: string;
  
  // Progress
  currentSlideIndex: number;
  responses: SlideResponse[];
  
  // Scoring
  totalPoints: number;
  maxPoints: number;
  correctCount: number;
  incorrectCount: number;
  
  // Timing
  startedAt: string;
  completedAt?: string;
  
  // Status
  status: 'in-progress' | 'completed' | 'abandoned';
}

/**
 * Live session for classroom sharing (Firebase)
 */
export interface LiveQuizSession {
  id: string;
  quizId: string;
  teacherId: string;
  teacherName: string;
  
  // Session state
  isActive: boolean;
  currentSlideIndex: number;
  
  // Control
  isPaused: boolean;
  showResults: boolean;
  isLocked: boolean; // true = students follow teacher, false = students can navigate freely
  
  // Quiz data (stored in Firebase for students to load)
  quizData?: {
    id: string;
    title: string;
    slides: QuizSlide[];
  };
  
  // Connected students
  students?: {
    [studentId: string]: {
      name: string;
      joinedAt: string;
      currentSlide: number;
      responses: SlideResponse[];
      isOnline: boolean;
      isFocused?: boolean;
      lastSeen?: string;
      deviceId?: string;
    };
  };
  
  // Timestamps
  createdAt: string;
  endedAt?: string;
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Create empty quiz
 */
export function createEmptyQuiz(id: string): Quiz {
  return {
    id,
    title: 'Nový kvíz',
    slides: [],
    settings: {
      showProgress: true,
      showScore: true,
      allowSkip: false,
      allowBack: true,
      shuffleQuestions: false,
      shuffleOptions: false,
      showExplanations: 'immediately',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create ABC question slide
 */
export function createABCSlide(order: number): ABCActivitySlide {
  return {
    id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'activity',
    activityType: 'abc',
    order,
    question: '',
    options: [
      { id: 'a', label: 'A', content: '', isCorrect: true },
      { id: 'b', label: 'B', content: '', isCorrect: false },
      { id: 'c', label: 'C', content: '', isCorrect: false },
      { id: 'd', label: 'D', content: '', isCorrect: false },
    ],
    points: 1,
  };
}

/**
 * Create Open question slide
 */
export function createOpenSlide(order: number): OpenActivitySlide {
  return {
    id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'activity',
    activityType: 'open',
    order,
    question: '',
    correctAnswers: [],
    caseSensitive: false,
    points: 1,
  };
}

/**
 * Create Example slide
 */
export function createExampleSlide(order: number): ExampleActivitySlide {
  return {
    id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'activity',
    activityType: 'example',
    order,
    title: '',
    problem: '',
    steps: [],
    finalAnswer: '',
  };
}

/**
 * Create Info slide
 */
export function createInfoSlide(order: number): InfoSlide {
  return {
    id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'info',
    order,
    title: '',
    content: '',
  };
}

/**
 * Calculate quiz score
 */
export function calculateQuizScore(responses: SlideResponse[], slides: QuizSlide[]): {
  totalPoints: number;
  maxPoints: number;
  correctCount: number;
  incorrectCount: number;
  percentage: number;
} {
  let totalPoints = 0;
  let maxPoints = 0;
  let correctCount = 0;
  let incorrectCount = 0;

  for (const slide of slides) {
    if (slide.type === 'activity' && 'points' in slide) {
      maxPoints += slide.points;
      
      const response = responses.find(r => r.slideId === slide.id);
      if (response) {
        if (response.isCorrect) {
          totalPoints += response.points || slide.points;
          correctCount++;
        } else {
          incorrectCount++;
        }
      }
    }
  }

  return {
    totalPoints,
    maxPoints,
    correctCount,
    incorrectCount,
    percentage: maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0,
  };
}

/**
 * Generate option labels (A, B, C, D, E, ...)
 */
export function getOptionLabel(index: number): string {
  return String.fromCharCode(65 + index); // A = 65
}

