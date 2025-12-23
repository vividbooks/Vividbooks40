/**
 * Quiz Editor Layout
 * 
 * 3-column layout similar to WorksheetEditorLayout:
 * 1. Narrow toolbar (slide types)
 * 2. Structure panel (slide list)
 * 3. Main editing area
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Save,
  Play,
  Settings,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Copy,
  GripVertical,
  FileText,
  HelpCircle,
  MessageSquare,
  Calculator,
  CheckCircle,
  XCircle,
  MoreVertical,
  Eye,
  Share2,
  ListOrdered,
  Lightbulb,
  BarChart2,
  Users,
  Radio,
  Link2,
  BookOpen,
  Sparkles,
  SlidersHorizontal,
  Loader2,
  ArrowLeft,
  Palette,
  History,
} from 'lucide-react';
import { useVersionHistory } from '../../hooks/useVersionHistory';
import { VersionHistoryPanel } from '../shared/VersionHistoryPanel';
import { database } from '../../utils/firebase-config';
import { ref, onValue, off } from 'firebase/database';
import {
  Quiz,
  QuizSlide,
  ActivityType,
  createEmptyQuiz,
  createABCSlide,
  createOpenSlide,
  createExampleSlide,
  createInfoSlide,
} from '../../types/quiz';
import { ABCSlideEditor } from './slides/ABCSlideEditor';
import { OpenSlideEditor } from './slides/OpenSlideEditor';
import { ExampleSlideEditor } from './slides/ExampleSlideEditor';
import { InfoSlideEditor } from './slides/InfoSlideEditor';
import { BackgroundPicker } from './slides/BackgroundPicker';
import { QuizPreview } from './QuizPreview';
import { TeacherSession } from './QuizLiveSession';
import { AIBoardPanel } from './AIBoardPanel';
import * as storage from '../../utils/profile-storage';
import * as quizStorage from '../../utils/quiz-storage';

const SLIDE_COLORS = [
  { color: '#ffffff', label: 'Bílá' },
  { color: '#f8fafc', label: 'Šedá' },
  { color: '#eff6ff', label: 'Modrá' },
  { color: '#f0fdf4', label: 'Zelená' },
  { color: '#fefce8', label: 'Žlutá' },
  { color: '#fff1f2', label: 'Červená' },
  { color: '#faf5ff', label: 'Fialová' },
];

// ============================================
// UI COMPONENTS (SIDEBAR)
// ============================================

type ActivePanel = 'board' | 'content' | 'ai' | 'settings';

function SidebarButton({ 
  onClick, 
  isActive = false, 
  icon: Icon, 
  label,
  variant = 'default',
  disabled = false,
  isLoading = false,
}: { 
  onClick: () => void;
  isActive?: boolean;
  icon: any;
  label: string;
  variant?: 'default' | 'orange' | 'green';
  disabled?: boolean;
  isLoading?: boolean;
}) {
  let bgColor = isActive ? '#4E5871' : 'white';
  let iconColor = isActive ? 'white' : '#4E5871';
  let labelColor = '#4E5871';

  if (variant === 'orange') {
    bgColor = isLoading ? '#F5A574' : '#E8956D';
    iconColor = 'white';
    labelColor = '#E8956D';
  } else if (variant === 'green') {
    bgColor = '#4eebc0';
    iconColor = '#4E5871';
    labelColor = '#4E5871';
  }
  
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        if (!disabled && !isLoading) {
          onClick();
        }
      }}
      disabled={disabled || isLoading}
      style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: 'none',
        border: 'none',
        padding: 0,
        marginBottom: '8px',
      }}
    >
      <div 
        style={{ 
          width: '70px', 
          height: '70px',
          backgroundColor: bgColor,
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
        }}
      >
        {isLoading ? (
          <Loader2 size={28} className="animate-spin" style={{ color: iconColor }} strokeWidth={1.5} />
        ) : (
          <Icon size={28} strokeWidth={1.5} style={{ color: iconColor }} />
        )}
      </div>
      <span 
        style={{ 
          fontSize: '12px',
          fontWeight: 500,
          marginTop: '8px',
          color: labelColor,
          textAlign: 'center',
        }}
      >
        {isLoading ? 'Načítám...' : label}
      </span>
    </button>
  );
}

function AddContentButton({ 
  onClick, 
  isActive,
}: { 
  onClick: () => void;
  isActive: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        padding: 0,
        marginBottom: '8px',
      }}
    >
      <div 
        style={{ 
          width: '70px', 
          height: '70px',
          backgroundColor: isActive ? '#4E5871' : 'white',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div 
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#4E5871',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={22} strokeWidth={2} style={{ color: 'white' }} />
        </div>
      </div>
      <span 
        style={{ 
          fontSize: '12px',
          fontWeight: 500,
          marginTop: '8px',
          color: '#4E5871',
          textAlign: 'center',
        }}
      >
        Přidat obsah
      </span>
    </button>
  );
}

// ============================================
// INLINE COLOR PICKER (for page settings panel)
// ============================================

const COLOR_GRID = {
  grays: ['transparent', '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#1e293b', '#0f172a'],
  colors: [
    '#7f1d1d', '#b91c1c', '#166534', '#0f766e', '#0369a1', '#1d4ed8', '#6d28d9', '#a21caf',
    '#dc2626', '#ef4444', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6', '#8b5cf6', '#d946ef',
    '#fca5a5', '#fecaca', '#86efac', '#5eead4', '#7dd3fc', '#93c5fd', '#c4b5fd', '#f0abfc',
    '#fee2e2', '#fef2f2', '#dcfce7', '#ccfbf1', '#e0f2fe', '#dbeafe', '#ede9fe', '#fae8ff',
  ],
};

function InlineColorPicker({ value, onChange }: { value?: string; onChange: (color: string) => void }) {
  const selectedColor = value || '#ffffff';
  
  return (
    <div className="space-y-3">
      {/* Grays row */}
      <div className="flex gap-1.5 flex-wrap">
        {COLOR_GRID.grays.map((color, idx) => (
          <button
            key={`gray-${idx}`}
            onClick={() => onChange(color === 'transparent' ? '#ffffff' : color)}
            className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
              selectedColor === color ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'
            }`}
            style={{ backgroundColor: color === 'transparent' ? '#fff' : color }}
          >
            {color === 'transparent' && (
              <div className="w-full h-full rounded-full relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-0.5 bg-red-400 rotate-45" />
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
      
      {/* Color grid */}
      <div className="grid grid-cols-8 gap-1.5">
        {COLOR_GRID.colors.map((color, idx) => (
          <button
            key={`color-${idx}`}
            onClick={() => onChange(color)}
            className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
              selectedColor === color ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// SLIDE TYPE DEFINITIONS
// ============================================

interface SlideTypeOption {
  id: string;
  type: 'info' | 'activity' | 'tools';
  activityType?: ActivityType;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const SLIDE_TYPES: SlideTypeOption[] = [
  // Info slides
  {
    id: 'info',
    type: 'info',
    label: 'Informace',
    icon: <FileText className="w-5 h-5" />,
    color: '#6366f1',
    description: 'Text, obrázky, video',
  },
  // Activity slides
  {
    id: 'abc',
    type: 'activity',
    activityType: 'abc',
    label: 'ABC otázka',
    icon: <ListOrdered className="w-5 h-5" />,
    color: '#10b981',
    description: 'Výběr z možností',
  },
  {
    id: 'open',
    type: 'activity',
    activityType: 'open',
    label: 'Otevřená',
    icon: <MessageSquare className="w-5 h-5" />,
    color: '#f59e0b',
    description: 'Textová odpověď',
  },
  {
    id: 'example',
    type: 'activity',
    activityType: 'example',
    label: 'Příklad',
    icon: <Lightbulb className="w-5 h-5" />,
    color: '#8b5cf6',
    description: 'Řešený příklad',
  },
  // Tools slides (future)
  {
    id: 'calculator',
    type: 'tools',
    label: 'Kalkulačka',
    icon: <Calculator className="w-5 h-5" />,
    color: '#64748b',
    description: 'Interaktivní nástroj',
  },
];

// ============================================
// STORAGE (using centralized quiz-storage)
// ============================================

const { saveQuiz, getQuiz: loadQuiz } = quizStorage;

// ============================================
// SESSION TYPES
// ============================================

interface StudentResponse {
  slideId: string;
  answer: string | string[];
  isCorrect?: boolean;
  answeredAt: string;
}

interface SessionStudent {
  studentName: string;
  responses: Record<string, StudentResponse>;
  completedAt?: string;
  joinedAt?: string;
  isOnline?: boolean;
}

interface SessionData {
  id: string;
  type: 'live' | 'shared';
  sessionName?: string;
  quizId: string;
  createdAt: string;
  endedAt?: string;
  students: Record<string, SessionStudent>;
  settings?: {
    anonymousAccess?: boolean;
    showSolutionHints?: boolean;
    showActivityResults?: boolean;
  };
}

// ============================================
// MAIN COMPONENT
// ============================================

interface QuizEditorLayoutProps {
  theme?: 'light' | 'dark';
}

export function QuizEditorLayout({ theme = 'light' }: QuizEditorLayoutProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Quiz state
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // UI state
  const [isResizing, setIsResizing] = useState(false);
  const [showLiveSession, setShowLiveSession] = useState(false);
  const [viewMode, setViewMode] = useState<'editor' | 'results'>(
    (searchParams.get('tab') as 'editor' | 'results') || 'editor'
  );
  const [activePanel, setActivePanel] = useState<ActivePanel>('board');
  const [showSettings, setShowSettings] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showPageSettings, setShowPageSettings] = useState(false);
  
  // Results state
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  
  // Get current user
  const profile = storage.getCurrentUserProfile();
  
  // Version history hook
  const versionHistory = useVersionHistory({
    documentId: id || '',
    documentType: 'quiz',
    content: quiz ? JSON.stringify(quiz) : '',
    title: quiz?.title || 'Nová tabule',
    userId: profile?.userId,
    userType: 'teacher',
    userName: profile?.firstName,
    autoSave: true,
    autoSaveDelay: 60000, // Auto-save every minute
    onVersionRestored: useCallback((version) => {
      try {
        const restoredQuiz = JSON.parse(version.content);
        setQuiz(restoredQuiz);
        setIsDirty(true);
      } catch (e) {
        console.error('Failed to parse restored quiz:', e);
      }
    }, []),
  });
  
  // Load sessions when Results tab is active
  useEffect(() => {
    if (viewMode !== 'results' || !id) return;
    
    setLoadingSessions(true);
    
    // Load live sessions
    const liveSessionsRef = ref(database, 'quiz_sessions');
    const sharedSessionsRef = ref(database, 'quiz_shares');
    
    // Combined loading
    let liveLoaded = false;
    let sharedLoaded = false;
    let liveData: SessionData[] = [];
    let sharedData: SessionData[] = [];
    
    const combineAndSetSessions = () => {
      if (liveLoaded && sharedLoaded) {
        const allSessions = [...liveData, ...sharedData];
        // Filter out sessions with 0 participants
        const activeSessions = allSessions.filter(session => {
          const studentCount = Object.keys(session.students || {}).length;
          return studentCount > 0;
        });
        
        activeSessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setSessions(activeSessions);
        setLoadingSessions(false);
      }
    };
    
    // Listener for live sessions
    onValue(liveSessionsRef, (snapshot) => {
      const data = snapshot.val();
      liveData = [];
      if (data) {
        Object.entries(data).forEach(([sessionId, sessionData]: [string, any]) => {
          if (sessionData.quizId === id) {
            liveData.push({
              id: sessionId,
              type: 'live',
              sessionName: sessionData.teacherName ? `Živé promítání - ${sessionData.teacherName}` : 'Živé promítání',
              quizId: sessionData.quizId,
              createdAt: sessionData.createdAt,
              endedAt: sessionData.endedAt,
              students: sessionData.students || {},
            });
          }
        });
      }
      liveLoaded = true;
      combineAndSetSessions();
    });
    
    // Listener for shared sessions
    onValue(sharedSessionsRef, (snapshot) => {
      const data = snapshot.val();
      sharedData = [];
      if (data) {
        Object.entries(data).forEach(([sessionId, sessionData]: [string, any]) => {
          if (sessionData.quizId === id) {
            // Convert responses format to students format for consistency
            const students: Record<string, SessionStudent> = {};
            if (sessionData.responses) {
              Object.entries(sessionData.responses).forEach(([studentId, studentData]: [string, any]) => {
                students[studentId] = {
                  studentName: studentData.studentName || 'Anonymní',
                  responses: studentData.responses || {},
                  completedAt: studentData.completedAt,
                };
              });
            }
            
            sharedData.push({
              id: sessionId,
              type: 'shared',
              sessionName: sessionData.sessionName || 'Sdílený úkol',
              quizId: sessionData.quizId,
              createdAt: sessionData.createdAt,
              students: students,
              settings: sessionData.settings,
            });
          }
        });
      }
      sharedLoaded = true;
      combineAndSetSessions();
    });
    
    return () => {
      off(liveSessionsRef);
      off(sharedSessionsRef);
    };
  }, [viewMode, id]);
  
  // Load or create quiz
  useEffect(() => {
    if (!id) return;
    
    const existingQuiz = loadQuiz(id);
    if (existingQuiz) {
      setQuiz(existingQuiz);
      if (existingQuiz.slides.length > 0) {
        setSelectedSlideId(existingQuiz.slides[0].id);
      }
    } else {
      const newQuiz = createEmptyQuiz(id);
      setQuiz(newQuiz);
      // Don't save immediately to avoid empty files
      // saveQuiz(newQuiz); 
    }
  }, [id]);
  
  // Auto-save
  useEffect(() => {
    if (quiz && isDirty) {
      const timer = setTimeout(() => {
        saveQuiz(quiz);
        setIsDirty(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [quiz, isDirty]);
  
  // Get selected slide
  const selectedSlide = quiz?.slides.find(s => s.id === selectedSlideId) || null;
  
  // ============================================
  // SLIDE OPERATIONS
  // ============================================
  
  const addSlide = useCallback((typeOption: SlideTypeOption) => {
    if (!quiz) return;
    
    const order = quiz.slides.length;
    let newSlide: QuizSlide;
    
    switch (typeOption.id) {
      case 'abc':
        newSlide = createABCSlide(order);
        break;
      case 'open':
        newSlide = createOpenSlide(order);
        break;
      case 'example':
        newSlide = createExampleSlide(order);
        break;
      case 'info':
      default:
        newSlide = createInfoSlide(order);
        break;
    }
    
    setQuiz({
      ...quiz,
      slides: [...quiz.slides, newSlide],
      updatedAt: new Date().toISOString(),
    });
    setSelectedSlideId(newSlide.id);
    setIsDirty(true);
    
    // Switch to board view after adding
    setActivePanel('board');
  }, [quiz]);
  
  const deleteSlide = useCallback((slideId: string) => {
    if (!quiz) return;
    
    const newSlides = quiz.slides.filter(s => s.id !== slideId);
    // Reorder
    newSlides.forEach((s, i) => s.order = i);
    
    setQuiz({
      ...quiz,
      slides: newSlides,
      updatedAt: new Date().toISOString(),
    });
    
    if (selectedSlideId === slideId) {
      setSelectedSlideId(newSlides[0]?.id || null);
    }
    setIsDirty(true);
  }, [quiz, selectedSlideId]);
  
  const duplicateSlide = useCallback((slideId: string) => {
    if (!quiz) return;
    
    const slide = quiz.slides.find(s => s.id === slideId);
    if (!slide) return;
    
    const newSlide = {
      ...slide,
      id: crypto.randomUUID(),
      order: slide.order + 1,
    };
    
    const newSlides = [...quiz.slides];
    newSlides.splice(slide.order + 1, 0, newSlide);
    // Reorder
    newSlides.forEach((s, i) => s.order = i);
    
    setQuiz({
      ...quiz,
      slides: newSlides,
      updatedAt: new Date().toISOString(),
    });
    setSelectedSlideId(newSlide.id);
    setIsDirty(true);
  }, [quiz]);
  
  const updateSlide = useCallback((slideId: string, updates: Partial<QuizSlide>) => {
    if (!quiz) return;
    
    const newSlides = quiz.slides.map(s => 
      s.id === slideId ? { ...s, ...updates } : s
    );
    
    setQuiz({
      ...quiz,
      slides: newSlides,
      updatedAt: new Date().toISOString(),
    });
    setIsDirty(true);
  }, [quiz]);
  
  const moveSlide = useCallback((slideId: string, direction: 'up' | 'down') => {
    if (!quiz) return;
    
    const idx = quiz.slides.findIndex(s => s.id === slideId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === quiz.slides.length - 1) return;
    
    const newSlides = [...quiz.slides];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newSlides[idx], newSlides[targetIdx]] = [newSlides[targetIdx], newSlides[idx]];
    
    // Reorder
    newSlides.forEach((s, i) => s.order = i);
    
    setQuiz({
      ...quiz,
      slides: newSlides,
      updatedAt: new Date().toISOString(),
    });
    setIsDirty(true);
  }, [quiz]);
  
  // Navigate to full results page
  const openSessionResults = (session: SessionData) => {
    // For both live and shared sessions, navigate to the results page
    // The results page needs to know the session type to load from the correct Firebase path
    navigate(`/quiz/results/${session.id}?type=${session.type}`);
  };
  
  // ============================================
  // RENDER HELPERS
  // ============================================
  
  const renderSessionsList = () => (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-white">
        <h2 className="text-xl font-bold text-slate-800">Výsledky</h2>
        <p className="text-sm text-slate-500 mt-1">Přehled všech sessions pro tento board</p>
      </div>
      
      {/* Sessions list */}
      <div className="flex-1 overflow-auto p-4">
        {loadingSessions ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <BarChart2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Žádné aktivní sessions</p>
            <p className="text-sm mt-1">Spusťte kvíz nebo sdílejte ho se studenty</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const studentCount = Object.keys(session.students || {}).length;
              
              return (
                <button
                  key={session.id}
                  onClick={() => openSessionResults(session)}
                  className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        session.type === 'live' ? 'bg-amber-100' : 'bg-blue-100'
                      }`}>
                        {session.type === 'live' ? (
                          <Radio className="w-6 h-6 text-amber-600" />
                        ) : (
                          <Link2 className="w-6 h-6 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{session.sessionName}</p>
                        <p className="text-sm text-slate-500">
                          {session.type === 'live' ? 'Živé promítání' : 'Sdílený úkol'} • {new Date(session.createdAt).toLocaleDateString('cs-CZ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-indigo-600">{studentCount}</p>
                        <p className="text-xs text-slate-400">účastníků</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ============================================
  // RENDER
  // ============================================
  
  if (!quiz) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }
  
  if (showPreview) {
    return (
      <QuizPreview 
        quiz={quiz} 
        onClose={() => setShowPreview(false)} 
      />
    );
  }
  
  if (showLiveSession) {
    return (
      <TeacherSession
        quiz={quiz}
        teacherId={profile?.userId || 'anonymous'}
        teacherName={profile?.firstName || 'Učitel'}
        onClose={() => setShowLiveSession(false)}
      />
    );
  }
  
  return (
    <div className="flex h-screen bg-[#F8F9FB] overflow-hidden font-sans">
      {/* 1. LEFT NARROW NAVIGATION STRIP */}
      <div 
        className="left-toolbar print:!hidden"
        style={{ 
          width: '100px',
          minWidth: '100px',
          height: '100%',
          backgroundColor: '#E8ECF4',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '16px',
          paddingBottom: '16px',
          borderRight: '1px solid #D8DCE6',
          zIndex: 20,
        }}
      >
        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate('/library/my-content')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '16px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <ArrowLeft size={16} strokeWidth={2} style={{ color: '#4E5871' }} />
          <span style={{ fontSize: '12px', fontWeight: 500, color: '#4E5871' }}>Zpět</span>
        </button>
        
        {/* My Board Tab */}
        <SidebarButton
          onClick={() => {
            setActivePanel('board');
            setViewMode('editor');
          }}
          isActive={activePanel === 'board' && viewMode === 'editor'}
          icon={BookOpen}
          label="Můj board"
        />
        
        {/* Add Content Tab */}
        <AddContentButton
          onClick={() => {
            setActivePanel('content');
            setViewMode('editor');
          }}
          isActive={activePanel === 'content' && viewMode === 'editor'}
        />
        
        {/* AI Tab */}
        <SidebarButton
          onClick={() => {
            setActivePanel('ai');
            setViewMode('editor');
          }}
          isActive={activePanel === 'ai' && viewMode === 'editor'}
          icon={Sparkles}
          label="AI"
        />
        
        {/* Separator */}
        <div style={{ width: '48px', height: '1px', backgroundColor: '#C5CCD9', margin: '12px 0' }} />
        
        {/* Settings Tab */}
        <SidebarButton
          onClick={() => {
            setActivePanel('settings');
            setViewMode('editor');
          }}
          isActive={activePanel === 'settings' && viewMode === 'editor'}
          icon={SlidersHorizontal}
          label="Nastavení"
        />
        
        {/* Spacer */}
        <div style={{ flex: 1 }} />
        
        {/* Separator */}
        <div style={{ width: '48px', height: '1px', backgroundColor: '#C5CCD9', margin: '12px 0' }} />
        
        {/* Results Button */}
        <SidebarButton
          onClick={() => setViewMode('results')}
          isActive={viewMode === 'results'}
          icon={BarChart2}
          label="Výsledky"
          variant="orange"
        />
        
        {/* Play Button */}
        <SidebarButton
          onClick={() => setShowLiveSession(true)}
          disabled={quiz.slides.length === 0}
          icon={Play}
          label="Přehrát"
          variant="green"
        />
      </div>
      
      {/* 2. CONTEXTUAL SIDEBAR PANEL (Only visible in editor mode) */}
      {viewMode === 'editor' && (
        <div 
          className="bg-white border-r border-slate-200 flex flex-col transition-all duration-300"
          style={{ width: '320px', minWidth: '320px' }}
        >
          {/* PANEL CONTENT */}
          
          {/* BOARD STRUCTURE PANEL */}
          {activePanel === 'board' && (
            <div className="flex flex-col h-full">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-xl font-bold text-[#4E5871]">Struktura</h2>
                <p className="text-sm text-slate-500 mt-1">Uspořádejte slidy vašeho boardu</p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 bg-[#F8F9FB]">
                {quiz.slides.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                      <BookOpen className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="font-medium text-slate-600 mb-1">Zatím žádné slidy</p>
                    <p className="text-xs text-slate-400 mb-4">Začněte přidáním obsahu nebo použijte AI</p>
                    <button
                      onClick={() => setActivePanel('content')}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                    >
                      Přidat obsah
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {quiz.slides.map((slide, index) => {
                      const typeInfo = SLIDE_TYPES.find(t => 
                        t.type === slide.type && 
                        (slide.type !== 'activity' || t.activityType === (slide as any).activityType)
                      ) || SLIDE_TYPES[0];
                      
                      return (
                        <div
                          key={slide.id}
                          onClick={() => setSelectedSlideId(slide.id)}
                          className={`
                            group relative p-3 rounded-xl cursor-pointer transition-all border
                            ${selectedSlideId === slide.id 
                              ? 'bg-white border-indigo-500 ring-1 ring-indigo-500 shadow-sm' 
                              : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'
                            }
                          `}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-bold text-slate-400 w-5 text-center">{index + 1}</span>
                              <div className="text-slate-300 cursor-grab active:cursor-grabbing p-1 hover:bg-slate-50 rounded">
                                <GripVertical className="w-3 h-3" />
                              </div>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <div 
                                  className="w-5 h-5 rounded flex items-center justify-center"
                                  style={{ backgroundColor: `${typeInfo.color}20`, color: typeInfo.color }}
                                >
                                  {React.cloneElement(typeInfo.icon, { size: 12 })}
                                </div>
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                  {typeInfo.label}
                                </span>
                              </div>
                              <p className="text-sm font-medium text-slate-700 truncate leading-snug">
                                {getSlideTitle(slide) || <span className="text-slate-400 italic">Bez názvu</span>}
                              </p>
                            </div>
                            
                            {/* Actions overlay */}
                            <div className="opacity-0 group-hover:opacity-100 flex flex-col gap-1 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); duplicateSlide(slide.id); }}
                                className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600"
                                title="Duplikovat"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteSlide(slide.id); }}
                                className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                                title="Smazat"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-slate-200 bg-white">
                <button
                  onClick={() => setActivePanel('content')}
                  className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-medium hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Přidat stránku
                </button>
              </div>
            </div>
          )}
          
          {/* ADD CONTENT PANEL */}
          {activePanel === 'content' && (
            <div className="flex flex-col h-full">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-xl font-bold text-[#4E5871]">Přidat obsah</h2>
                <p className="text-sm text-slate-500 mt-1">Vyberte typ slidu pro přidání</p>
              </div>
              
              <div className="p-4 overflow-y-auto bg-[#F8F9FB] flex-1">
                <div className="grid grid-cols-1 gap-3">
                  {SLIDE_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => addSlide(type)}
                      className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:shadow-md transition-all text-left group"
                    >
                      <div 
                        className="w-12 h-12 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                        style={{ backgroundColor: `${type.color}15`, color: type.color }}
                      >
                        {React.cloneElement(type.icon, { size: 24 })}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">
                          {type.label}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {type.id === 'info' && 'Text, obrázky a vysvětlivky'}
                          {type.id === 'abc' && 'Výběr z více možností'}
                          {type.id === 'open' && 'Volná odpověď studenta'}
                          {type.id === 'example' && 'Krokovaný postup řešení'}
                        </p>
                      </div>
                      <Plus className="w-5 h-5 text-slate-300 ml-auto group-hover:text-indigo-500" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* AI PANEL */}
          {activePanel === 'ai' && (
            <AIBoardPanel
              quiz={quiz}
              onAddSlides={(newSlides) => {
                // Add slides to quiz
                const updatedSlides = [...quiz.slides];
                newSlides.forEach((slide, idx) => {
                  slide.order = updatedSlides.length + idx;
                  updatedSlides.push(slide);
                });
                setQuiz({
                  ...quiz,
                  slides: updatedSlides,
                  updatedAt: new Date().toISOString(),
                });
                setIsDirty(true);
                // Select first new slide
                if (newSlides.length > 0) {
                  setSelectedSlideId(newSlides[0].id);
                }
                // Switch to board view to see results
                setActivePanel('board');
              }}
              onClose={() => setActivePanel('board')}
            />
          )}
          
          {/* SETTINGS PANEL */}
          {activePanel === 'settings' && (
            <div className="flex flex-col h-full">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-xl font-bold text-[#4E5871]">Nastavení</h2>
                <p className="text-sm text-slate-500 mt-1">Upravte parametry boardu</p>
              </div>
              
              <div className="p-6 space-y-6 bg-[#F8F9FB] flex-1">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Název boardu
                  </label>
                  <input
                    type="text"
                    value={quiz.title}
                    onChange={(e) => {
                      setQuiz({ ...quiz, title: e.target.value });
                      setIsDirty(true);
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                    placeholder="Zadejte název..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Předmět
                  </label>
                  <select 
                    value={quiz.subject || ''}
                    onChange={(e) => {
                      setQuiz({ ...quiz, subject: e.target.value });
                      setIsDirty(true);
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 outline-none"
                  >
                    <option value="">Vyberte předmět...</option>
                    <option value="matematika">Matematika</option>
                    <option value="fyzika">Fyzika</option>
                    <option value="cestina">Český jazyk</option>
                    <option value="anglictina">Anglický jazyk</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Ročník
                  </label>
                  <select 
                    value={quiz.grade || ''}
                    onChange={(e) => {
                      setQuiz({ ...quiz, grade: Number(e.target.value) });
                      setIsDirty(true);
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 outline-none"
                  >
                    <option value="">Vyberte ročník...</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(g => (
                      <option key={g} value={g}>{g}. ročník</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* 3. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
        {viewMode === 'editor' ? (
          <>
            {/* Top bar - simplified */}
            <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10">
              <div className="flex items-center gap-4">
                <h1 className="text-lg font-bold text-slate-800 truncate max-w-md">
                  {quiz.title || 'Nový board'}
                </h1>
                {isDirty && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full font-medium">
                    Neuloženo
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowVersionHistory(true)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium text-sm ${
                    versionHistory.hasUnsavedChanges 
                      ? 'text-amber-600 hover:bg-amber-50' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title={`Historie verzí${versionHistory.totalVersions > 0 ? ` (${versionHistory.totalVersions})` : ''}`}
                >
                  <History className="w-4 h-4" />
                  Historie
                  {versionHistory.autoSavePending && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </button>
                <button
                  onClick={() => setShowPreview(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors font-medium text-sm"
                >
                  <Eye className="w-4 h-4" />
                  Náhled
                </button>
                <button
                  onClick={() => {
                    saveQuiz(quiz);
                    setIsDirty(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm font-medium text-sm"
                >
                  <Save className="w-4 h-4" />
                  Uložit
                </button>
              </div>
            </div>
            
            {/* Editor Canvas */}
            <div className="flex-1 overflow-auto p-8 flex justify-center bg-slate-100/50">
              {selectedSlide ? (
                <div className="w-full max-w-5xl flex flex-col mb-8">
                  {/* Navigation above slide */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => moveSlide(selectedSlide.id, 'up')}
                        disabled={selectedSlide.order === 0}
                        className="p-2 rounded-lg hover:bg-white text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="text-sm font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
                        Slide {selectedSlide.order + 1} / {quiz.slides.length}
                      </span>
                      <button
                        onClick={() => moveSlide(selectedSlide.id, 'down')}
                        disabled={selectedSlide.order === quiz.slides.length - 1}
                        className="p-2 rounded-lg hover:bg-white text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Page Settings Button */}
                    <button
                      onClick={() => setShowPageSettings(true)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                      title="Nastavení stránky"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* The actual editor */}
                  <div 
                    className="rounded-xl shadow-sm border border-slate-200 transition-colors duration-300"
                    style={{ backgroundColor: selectedSlide.backgroundColor || '#ffffff' }}
                  >
                    {renderSlideEditor(selectedSlide, updateSlide)}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-6 opacity-50">
                    <Plus className="w-10 h-10 text-slate-400" />
                  </div>
                  <p className="text-xl font-medium text-slate-600">Začněte tvořit</p>
                  <p className="text-slate-500 mt-2 mb-6">Vyberte "Přidat obsah" v levém panelu pro vytvoření prvního slidu.</p>
                  <button
                    onClick={() => setActivePanel('content')}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all"
                  >
                    + Přidat první blok
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Results View */
          <div className="flex-1 bg-slate-50 overflow-hidden">
            {renderSessionsList()}
          </div>
        )}
      </div>

      {/* Version History Modal */}
      {showVersionHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <VersionHistoryPanel
            versions={versionHistory.versions}
            loading={versionHistory.loading}
            error={versionHistory.error}
            totalVersions={versionHistory.totalVersions}
            hasMoreVersions={versionHistory.hasMoreVersions}
            hasUnsavedChanges={versionHistory.hasUnsavedChanges}
            autoSavePending={versionHistory.autoSavePending}
            currentVersion={versionHistory.lastSavedVersion}
            onSaveManual={versionHistory.saveManualVersion}
            onRestore={versionHistory.restoreVersion}
            onLoadMore={versionHistory.loadMoreVersions}
            onClose={() => setShowVersionHistory(false)}
          />
        </div>
      )}
      
      {/* Page Settings Panel - Overlay on left side */}
      {showPageSettings && selectedSlide && (
        <div 
          className="fixed top-0 left-0 h-full bg-white shadow-2xl z-40 flex flex-col overflow-hidden"
          style={{ width: '420px' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50">
            <button
              onClick={() => setShowPageSettings(false)}
              className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-slate-800">Nastavení stránky</h2>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Layout Section */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                Rozložení
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'title-content', label: 'Nadpis + obsah', icon: '📝' },
                  { id: 'title-2cols', label: 'Nadpis + 2 sloupce', icon: '📊' },
                  { id: 'title-3cols', label: 'Nadpis + 3 sloupce', icon: '📋' },
                  { id: '2cols', label: '2 sloupce', icon: '⬜⬜' },
                  { id: '3cols', label: '3 sloupce', icon: '⬜⬜⬜' },
                  { id: 'left-large-right-split', label: 'Levý velký', icon: '⬛⬜' },
                  { id: 'right-large-left-split', label: 'Pravý velký', icon: '⬜⬛' },
                ].map((layout) => (
                  <button
                    key={layout.id}
                    onClick={() => {
                      if (selectedSlide.type === 'info') {
                        updateSlide(selectedSlide.id, { layout: layout.id as any });
                      }
                    }}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      (selectedSlide as any).layout === layout.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xl mb-1 block">{layout.icon}</span>
                    <span className="text-xs font-medium text-slate-700">{layout.label}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Color Section - using BackgroundPicker inline */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Barva pozadí
              </h3>
              <BackgroundPicker
                value={selectedSlide.background || { type: 'color', color: selectedSlide.backgroundColor || '#ffffff' }}
                onChange={(bg) => {
                  if (bg?.type === 'color' && bg.color) {
                    updateSlide(selectedSlide.id, { backgroundColor: bg.color, background: bg });
                  } else if (bg) {
                    updateSlide(selectedSlide.id, { background: bg });
                  }
                }}
                onClose={() => {}}
                showUpload={true}
                showOpacity={true}
                showBlur={false}
                inline={true}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Backdrop for page settings */}
      {showPageSettings && (
        <div 
          className="fixed inset-0 bg-black/20 z-30"
          onClick={() => setShowPageSettings(false)}
        />
      )}
    </div>
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getSlideTitle(slide: QuizSlide): string {
  switch (slide.type) {
    case 'info':
      return slide.title || '';
    case 'activity':
      if ('question' in slide) return slide.question?.substring(0, 50) || '';
      if ('title' in slide) return slide.title || '';
      return '';
    default:
      return '';
  }
}

function renderSlideEditor(
  slide: QuizSlide, 
  onUpdate: (id: string, updates: Partial<QuizSlide>) => void
): React.ReactNode {
  switch (slide.type) {
    case 'info':
      return <InfoSlideEditor slide={slide} onUpdate={onUpdate} />;
    case 'activity':
      switch ((slide as any).activityType) {
        case 'abc':
          return <ABCSlideEditor slide={slide as any} onUpdate={onUpdate} />;
        case 'open':
          return <OpenSlideEditor slide={slide as any} onUpdate={onUpdate} />;
        case 'example':
          return <ExampleSlideEditor slide={slide as any} onUpdate={onUpdate} />;
        default:
          return <div>Nepodporovaný typ aktivity</div>;
      }
    default:
      return <div>Nepodporovaný typ slidu</div>;
  }
}

export default QuizEditorLayout;
