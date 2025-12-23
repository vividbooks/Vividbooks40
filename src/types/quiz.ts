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

// =============================================
// BLOCK-BASED LAYOUT SYSTEM FOR INFO SLIDES
// =============================================

/**
 * Block content types
 */
export type SlideBlockType = 'text' | 'image' | 'link';

/**
 * Background settings for blocks and slides
 */
export interface BackgroundSettings {
  type: 'color' | 'image';
  color?: string;
  imageUrl?: string;
  opacity?: number; // 0-100
  blur?: number; // 0-20
}

/**
 * Individual block in a slide layout
 */
export interface SlideBlock {
  id: string;
  type: SlideBlockType;
  content: string; // Text content, image URL, or link URL
  title?: string; // For links - display text
  background?: BackgroundSettings;
  textAlign?: 'left' | 'center' | 'right';
  fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
  fontWeight?: 'normal' | 'bold';
  // Image settings
  imageFit?: 'contain' | 'cover'; // contain = show slider, cover = fill block
  imageScale?: number; // 10-200, percentage of image size (when imageFit = contain)
  imageCaption?: string; // Image description/caption
  imageLink?: string; // URL to open when image is clicked
  // Gallery settings
  gallery?: string[]; // Array of image URLs for gallery mode
  galleryIndex?: number; // Current gallery index
  galleryNavType?: 'dots-bottom' | 'dots-side' | 'arrows' | 'solution'; // Navigation type
}

/**
 * Layout types for info slides
 * Desktop view - on mobile, blocks stack vertically
 */
export type SlideLayoutType = 
  | 'title-content'      // Title block + main content
  | 'title-2cols'        // Title + 2 columns
  | 'title-3cols'        // Title + 3 columns
  | '2cols'              // 2 columns only
  | '3cols'              // 3 columns only
  | 'left-large-right-split'  // Left column large, right split in half vertically
  | 'right-large-left-split'; // Right column large, left split in half vertically

/**
 * Layout configuration with block ratios
 */
export interface SlideLayout {
  type: SlideLayoutType;
  blocks: SlideBlock[];
  // Ratios for resizable areas (stored as percentages)
  titleHeight?: number;     // % height of title block (default 20)
  columnRatios?: number[];  // % widths of columns, e.g. [50, 50] or [33, 34, 33]
  splitRatio?: number;      // % for split layouts (how much of split area is top vs bottom)
}

// =============================================
// SLIDE TEMPLATES (FONTS & COLORS)
// =============================================

/**
 * Available font families for templates
 * Using Google Fonts compatible names
 */
export type TemplateFontFamily = 
  | 'Sora'
  | 'Space Grotesk'
  | 'Playfair Display'
  | 'Itim'
  | 'Sacramento'
  | 'Lora'
  | 'Oswald';

/**
 * Color scheme for a template
 */
export interface TemplateColorScheme {
  primary: string;      // Main background/accent color
  secondary: string;    // Secondary color for blocks
  tertiary?: string;    // Third color if needed
  text: string;         // Text color
  textLight?: string;   // Light text color
}

/**
 * Slide template definition
 */
export interface SlideTemplate {
  id: string;
  name: string;
  font: TemplateFontFamily;
  colors: TemplateColorScheme;
  blockColors?: string[]; // Optional specific colors for each block
  defaultGap?: number; // Default gap between blocks
  defaultRadius?: number; // Default border radius
}

/**
 * Predefined templates
 */
export const SLIDE_TEMPLATES: SlideTemplate[] = [
  {
    id: 'modern-blue',
    name: 'Moderní modrá',
    font: 'Sora',
    colors: {
      primary: '#3B82F6',
      secondary: '#DBEAFE',
      tertiary: '#EFF6FF',
      text: '#1E3A8A',
      textLight: '#60A5FA',
    },
    blockColors: ['#DBEAFE', '#BFDBFE', '#93C5FD'],
    defaultGap: 11,
    defaultRadius: 12,
  },
  {
    id: 'elegant-serif',
    name: 'Elegantní',
    font: 'Playfair Display',
    colors: {
      primary: '#7C3AED',
      secondary: '#EDE9FE',
      tertiary: '#F5F3FF',
      text: '#4C1D95',
      textLight: '#A78BFA',
    },
    blockColors: ['#EDE9FE', '#DDD6FE', '#C4B5FD'],
    defaultGap: 0,
    defaultRadius: 0,
  },
  {
    id: 'warm-creative',
    name: 'Kreativní',
    font: 'Itim',
    colors: {
      primary: '#F59E0B',
      secondary: '#FEF3C7',
      tertiary: '#FFFBEB',
      text: '#92400E',
      textLight: '#FBBF24',
    },
    blockColors: ['#FEF3C7', '#FDE68A', '#FCD34D'],
    defaultGap: 16,
    defaultRadius: 24,
  },
  {
    id: 'minimal-dark',
    name: 'Minimalistická',
    font: 'Space Grotesk',
    colors: {
      primary: '#1F2937',
      secondary: '#F3F4F6',
      tertiary: '#E5E7EB',
      text: '#111827',
      textLight: '#6B7280',
    },
    blockColors: ['#F3F4F6', '#E5E7EB', '#D1D5DB'],
    defaultGap: 4,
    defaultRadius: 4,
  },
];

/**
 * Get template by ID
 */
export function getTemplateById(templateId: string): SlideTemplate | undefined {
  return SLIDE_TEMPLATES.find(t => t.id === templateId);
}

/**
 * Information slide - displays content without interaction
 * Now supports block-based layouts
 */
export interface InfoSlide extends BaseSlide {
  type: 'info';
  templateId?: string; // Reference to template
  // Block styling options
  blockGap?: number; // Gap between blocks in pixels (0-40)
  blockRadius?: number; // Border radius of blocks in pixels (0-32)
  // Legacy fields (for backwards compatibility)
  title: string;
  content: string; // HTML content
  media?: {
    type: 'image' | 'video' | 'lottie';
    url: string;
    caption?: string;
  };
  // New block-based layout system
  layout?: SlideLayout;
  slideBackground?: BackgroundSettings;
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
  
  // Settings for live session
  settings?: {
    showSolutionHints?: boolean;
  };
}

// =============================================
// STUDENT INDIVIDUAL WORK (Self-study mode)
// =============================================

/**
 * Record of a student's individual work session on a board
 */
export interface StudentWorkSession {
  id: string;
  
  // Board/Quiz info
  boardId: string;
  boardTitle: string;
  boardSource: 'user' | 'vividbooks'; // user-created or from library
  boardOwnerId?: string; // Teacher who owns the board (if user-created)
  
  // Student info
  studentId: string;
  studentName: string;
  studentEmail?: string;
  
  // Session data
  startedAt: string;
  completedAt?: string;
  totalTimeMs: number;
  
  // Results
  responses: {
    [slideId: string]: SlideResponse;
  };
  correctCount: number;
  totalQuestions: number;
  score: number; // percentage 0-100
  
  // Status
  status: 'in_progress' | 'completed' | 'abandoned';
}

/**
 * Student's work history (all their individual sessions)
 */
export interface StudentWorkHistory {
  studentId: string;
  studentName: string;
  studentEmail?: string;
  
  // All work sessions indexed by session ID
  sessions: {
    [sessionId: string]: StudentWorkSession;
  };
  
  // Stats
  totalSessionsCompleted: number;
  totalTimeSpentMs: number;
  lastActiveAt: string;
}

/**
 * Teacher's view of student work in their classroom
 */
export interface ClassroomStudentWork {
  // Indexed by board ID
  [boardId: string]: {
    boardTitle: string;
    students: {
      [studentId: string]: StudentWorkSession;
    };
  };
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
 * Create a unique block ID
 */
function createBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new block with defaults
 */
export function createSlideBlock(type: SlideBlockType = 'text'): SlideBlock {
  return {
    id: createBlockId(),
    type,
    content: '',
    textAlign: 'left',
    fontSize: 'medium',
    fontWeight: 'normal',
  };
}

/**
 * Create a layout with the specified type
 */
export function createSlideLayout(layoutType: SlideLayoutType): SlideLayout {
  switch (layoutType) {
    case 'title-content':
      return {
        type: layoutType,
        blocks: [
          { ...createSlideBlock('text'), fontSize: 'xlarge', fontWeight: 'bold' }, // Title
          createSlideBlock('text'), // Content
        ],
        titleHeight: 15,
      };
    case 'title-2cols':
      return {
        type: layoutType,
        blocks: [
          { ...createSlideBlock('text'), fontSize: 'xlarge', fontWeight: 'bold' }, // Title
          createSlideBlock('text'), // Left column
          createSlideBlock('text'), // Right column
        ],
        titleHeight: 15,
        columnRatios: [50, 50],
      };
    case 'title-3cols':
      return {
        type: layoutType,
        blocks: [
          { ...createSlideBlock('text'), fontSize: 'xlarge', fontWeight: 'bold' }, // Title
          createSlideBlock('text'), // Left column
          createSlideBlock('text'), // Middle column
          createSlideBlock('text'), // Right column
        ],
        titleHeight: 15,
        columnRatios: [33, 34, 33],
      };
    case '2cols':
      return {
        type: layoutType,
        blocks: [
          createSlideBlock('text'), // Left column
          createSlideBlock('text'), // Right column
        ],
        columnRatios: [50, 50],
      };
    case '3cols':
      return {
        type: layoutType,
        blocks: [
          createSlideBlock('text'), // Left column
          createSlideBlock('text'), // Middle column
          createSlideBlock('text'), // Right column
        ],
        columnRatios: [33, 34, 33],
      };
    case 'left-large-right-split':
      return {
        type: layoutType,
        blocks: [
          createSlideBlock('text'), // Left large
          createSlideBlock('text'), // Right top
          createSlideBlock('text'), // Right bottom
        ],
        columnRatios: [60, 40],
        splitRatio: 50,
      };
    case 'right-large-left-split':
      return {
        type: layoutType,
        blocks: [
          createSlideBlock('text'), // Left top
          createSlideBlock('text'), // Left bottom
          createSlideBlock('text'), // Right large
        ],
        columnRatios: [40, 60],
        splitRatio: 50,
      };
    default:
      return {
        type: 'title-content',
        blocks: [
          { ...createSlideBlock('text'), fontSize: 'xlarge', fontWeight: 'bold' },
          createSlideBlock('text'),
        ],
        titleHeight: 15,
      };
  }
}

/**
 * Create Info slide with optional layout
 */
export function createInfoSlide(order: number, layoutType?: SlideLayoutType): InfoSlide {
  return {
    id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'info',
    order,
    title: '',
    content: '',
    layout: layoutType ? createSlideLayout(layoutType) : undefined,
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

