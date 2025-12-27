/**
 * Quiz Editor Layout
 * 
 * 3-column layout similar to WorksheetEditorLayout:
 * 1. Narrow toolbar (slide types)
 * 2. Structure panel (slide list)
 * 3. Main editing area
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Save,
  Play,
  Settings,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Undo2,
  Redo2,
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
  EyeOff,
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
  LayoutGrid,
  Printer,
  Layers,
  // New activity icons
  Puzzle,
  MapPin,
  Film,
} from 'lucide-react';
import { boardToWorksheet } from '../../utils/content-converter';
import { saveWorksheet } from '../../utils/worksheet-storage';
import { useVersionHistory } from '../../hooks/useVersionHistory';
import { VersionHistoryPanel } from '../shared/VersionHistoryPanel';
import { database } from '../../utils/firebase-config';
import { ref, onValue, off } from 'firebase/database';
import {
  Quiz,
  QuizSlide,
  InfoSlide,
  ActivityType,
  createEmptyQuiz,
  createABCSlide,
  createOpenSlide,
  createExampleSlide,
  createInfoSlide,
  createBoardSlide,
  createVotingSlide,
  createFillBlanksSlide,
  createImageHotspotsSlide,
  createConnectPairsSlide,
  createVideoQuizSlide,
  FillBlanksActivitySlide,
  ImageHotspotsActivitySlide,
  ConnectPairsActivitySlide,
  VideoQuizActivitySlide,
} from '../../types/quiz';
import { ABCSlideEditor } from './slides/ABCSlideEditor';
import { OpenSlideEditor } from './slides/OpenSlideEditor';
import { ExampleSlideEditor } from './slides/ExampleSlideEditor';
import { InfoSlideEditor } from './slides/InfoSlideEditor';
import { BoardSlideEditor } from './slides/BoardSlideEditor';
import { VotingSlideEditor } from './slides/VotingSlideEditor';
import { ConnectPairsEditor } from './slides/ConnectPairsEditor';
import { FillBlanksEditor } from './slides/FillBlanksEditor';
import { ImageHotspotsEditor } from './slides/ImageHotspotsEditor';
import { VideoQuizEditor } from './slides/VideoQuizEditor';
import { SlideTextToolbar } from './slides/SlideTextToolbar';
import { BackgroundPicker } from './slides/BackgroundPicker';
import { PageSettingsPanel } from './slides/PageSettingsPanel';
import { BlockSettingsPanel } from './slides/BlockSettingsPanel';
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

// Slide thumbnail - renders visual representation of the slide
function SlidePreviewThumbnail({ slide }: { slide: QuizSlide }) {
  // Info slide
  if (slide.type === 'info') {
    const infoSlide = slide as InfoSlide;
    const bgColor = infoSlide.slideBackground?.color || '#ffffff';
    
    // Check for layout blocks
    if (infoSlide.layout?.blocks?.length) {
      return (
        <div 
          className="w-full h-full p-3 flex flex-col gap-2"
          style={{ backgroundColor: bgColor }}
        >
          {infoSlide.layout.blocks.slice(0, 3).map((block, i) => (
            <div key={i}>
              {block.type === 'text' && block.content && (
                <p 
                  className="text-slate-800 leading-tight"
                  style={{ 
                    fontSize: i === 0 ? '14px' : '10px',
                    fontWeight: block.fontWeight === 'bold' || i === 0 ? 600 : 400,
                  }}
                >
                  {block.content.slice(0, 60)}{block.content.length > 60 ? '...' : ''}
                </p>
              )}
              {block.type === 'image' && block.content && (
                <img 
                  src={block.content} 
                  alt="" 
                  className="w-full h-20 object-cover rounded"
                />
              )}
            </div>
          ))}
        </div>
      );
    }
    
    // Legacy
    return (
      <div className="w-full h-full p-3 flex flex-col justify-center" style={{ backgroundColor: bgColor }}>
        {infoSlide.title && (
          <p className="text-sm font-bold text-slate-800 text-center mb-2">{infoSlide.title}</p>
        )}
        {infoSlide.media?.url && (
          <img src={infoSlide.media.url} alt="" className="w-full h-16 object-cover rounded" />
        )}
      </div>
    );
  }
  
  // Activity slides
  const activitySlide = slide as any;
  const question = activitySlide.question || activitySlide.instruction || '';
  
  switch (activitySlide.activityType) {
    case 'abc':
    case 'true-false':
      return (
        <div className="w-full h-full p-3 bg-white flex flex-col">
          <p className="text-xs font-bold text-slate-800 text-center mb-2 line-clamp-2">{question || 'Otázka'}</p>
          <div className="flex-1 flex flex-col gap-1 justify-center">
            {(activitySlide.options || []).slice(0, 4).map((opt: any, i: number) => (
              <div 
                key={i} 
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px]"
                style={{ backgroundColor: opt.isCorrect ? '#dcfce7' : '#f1f5f9' }}
              >
                <span className="font-bold text-slate-500">{String.fromCharCode(65 + i)}</span>
                <span className="text-slate-700 truncate">{opt.text?.slice(0, 25) || ''}</span>
              </div>
            ))}
          </div>
        </div>
      );
    
    case 'open':
      return (
        <div className="w-full h-full p-3 bg-white flex flex-col">
          <p className="text-xs font-bold text-slate-800 text-center mb-3 line-clamp-2">{question || 'Otázka'}</p>
          <div className="flex-1 border-2 border-dashed border-slate-300 rounded bg-slate-50" />
        </div>
      );
    
    case 'example':
      return (
        <div className="w-full h-full p-3 bg-white flex flex-col">
          <p className="text-xs font-bold text-slate-800 text-center mb-2">{activitySlide.topic || 'Příklady'}</p>
          <div className="flex-1 flex flex-col gap-1">
            {(activitySlide.examples || []).slice(0, 3).map((ex: any, i: number) => (
              <div key={i} className="text-[10px] text-slate-700 bg-emerald-50 px-2 py-1 rounded truncate">
                {i + 1}) {ex.question?.slice(0, 20) || '...'}
              </div>
            ))}
          </div>
        </div>
      );
    
    case 'fill-blanks':
      return (
        <div className="w-full h-full p-3 bg-white flex items-center justify-center">
          <div className="text-[10px] text-slate-700 text-center flex flex-wrap justify-center gap-1">
            <span>Text</span>
            <span className="bg-purple-200 px-2 rounded">____</span>
            <span>slovo</span>
            <span className="bg-purple-200 px-2 rounded">____</span>
          </div>
        </div>
      );
    
    case 'connect-pairs':
      return (
        <div className="w-full h-full p-2 bg-white flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1 flex-1">
            {(activitySlide.pairs || []).slice(0, 4).map((_: any, i: number) => (
              <div key={i} className="h-4 bg-orange-100 rounded text-[8px] flex items-center justify-center text-orange-700">
                {i + 1}
              </div>
            ))}
          </div>
          <div className="text-orange-400 text-lg">↔</div>
          <div className="flex flex-col gap-1 flex-1">
            {(activitySlide.pairs || []).slice(0, 4).map((_: any, i: number) => (
              <div key={i} className="h-4 bg-orange-100 rounded text-[8px] flex items-center justify-center text-orange-700">
                {String.fromCharCode(65 + i)}
              </div>
            ))}
          </div>
        </div>
      );
    
    case 'image-hotspots':
      return (
        <div className="w-full h-full relative bg-slate-100">
          {activitySlide.imageUrl ? (
            <>
              <img src={activitySlide.imageUrl} alt="" className="w-full h-full object-cover" />
              {(activitySlide.hotspots || []).slice(0, 5).map((h: any, i: number) => (
                <div 
                  key={i}
                  className="absolute w-3 h-3 bg-pink-500 rounded-full border border-white"
                  style={{ left: `${h.x}%`, top: `${h.y}%`, transform: 'translate(-50%, -50%)' }}
                />
              ))}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[10px] text-slate-400">Obrázek</span>
            </div>
          )}
        </div>
      );
    
    case 'video-quiz':
      return (
        <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center">
          <div className="w-12 h-8 bg-black rounded flex items-center justify-center mb-1">
            <div className="w-0 h-0 border-l-[8px] border-l-white border-y-[5px] border-y-transparent" />
          </div>
          <span className="text-[9px] text-white/70">{activitySlide.questions?.length || 0} otázek</span>
        </div>
      );
    
    case 'voting':
      return (
        <div className="w-full h-full p-3 bg-white flex flex-col">
          <p className="text-[10px] font-bold text-slate-800 text-center mb-2 truncate">{question || 'Hlasování'}</p>
          <div className="flex-1 flex items-end justify-center gap-1">
            {[40, 70, 30, 55].map((h, i) => (
              <div key={i} className="w-4 bg-indigo-400 rounded-t" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      );
    
    case 'board':
      return (
        <div className="w-full h-full p-2 bg-white flex flex-col">
          <p className="text-[10px] font-bold text-slate-800 text-center mb-2 truncate">{question || 'Nástěnka'}</p>
          <div className="flex-1 grid grid-cols-3 gap-1">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-amber-100 rounded" />
            ))}
          </div>
        </div>
      );
    
    default:
      return (
        <div className="w-full h-full bg-slate-100 flex items-center justify-center">
          <span className="text-xs text-slate-400">Náhled</span>
        </div>
      );
  }
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
  {
    id: 'board',
    type: 'activity',
    activityType: 'board',
    label: 'Nástěnka',
    icon: <LayoutGrid className="w-5 h-5" />,
    color: '#ec4899',
    description: 'Sdílené příspěvky',
  },
  {
    id: 'voting',
    type: 'activity',
    activityType: 'voting',
    label: 'Hlasování',
    icon: <BarChart2 className="w-5 h-5" />,
    color: '#0ea5e9',
    description: 'Anketa s grafem',
  },
  // New multi-step activities
  {
    id: 'fill-blanks',
    type: 'activity',
    activityType: 'fill-blanks',
    label: 'Doplňování',
    icon: <Puzzle className="w-5 h-5" />,
    color: '#f97316',
    description: 'Přetáhni slova',
  },
  {
    id: 'connect-pairs',
    type: 'activity',
    activityType: 'connect-pairs',
    label: 'Spojovačka',
    icon: <Link2 className="w-5 h-5" />,
    color: '#a855f7',
    description: 'Spoj dvojice',
  },
  {
    id: 'image-hotspots',
    type: 'activity',
    activityType: 'image-hotspots',
    label: 'Poznávačka',
    icon: <MapPin className="w-5 h-5" />,
    color: '#14b8a6',
    description: 'Označ na obrázku',
  },
  {
    id: 'video-quiz',
    type: 'activity',
    activityType: 'video-quiz',
    label: 'Video kvíz',
    icon: <Film className="w-5 h-5" />,
    color: '#ef4444',
    description: 'Otázky ve videu',
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
  
  // Get returnUrl from search params (for admin navigation)
  const returnUrl = searchParams.get('returnUrl');
  
  // Quiz state
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // Undo/Redo state
  const [undoStack, setUndoStack] = useState<Quiz[]>([]);
  const [redoStack, setRedoStack] = useState<Quiz[]>([]);
  const maxUndoSteps = 50;

  // Update quiz with undo support
  const updateQuizWithUndo = useCallback((newQuiz: Quiz) => {
    if (quiz) {
      setUndoStack(prev => {
        const newStack = [...prev, quiz];
        return newStack.slice(-maxUndoSteps);
      });
      setRedoStack([]); // Clear redo on new action
    }
    setQuiz(newQuiz);
    setIsDirty(true);
  }, [quiz]);

  // Undo action
  const undo = useCallback(() => {
    if (undoStack.length > 0) {
      const previousState = undoStack[undoStack.length - 1];
      setUndoStack(prev => prev.slice(0, -1));
      if (quiz) {
        setRedoStack(prev => [...prev, quiz]);
      }
      setQuiz(previousState);
      setIsDirty(true);
    }
  }, [undoStack, quiz]);

  // Redo action
  const redo = useCallback(() => {
    if (redoStack.length > 0) {
      const nextState = redoStack[redoStack.length - 1];
      setRedoStack(prev => prev.slice(0, -1));
      if (quiz) {
        setUndoStack(prev => [...prev, quiz]);
      }
      setQuiz(nextState);
      setIsDirty(true);
    }
  }, [redoStack, quiz]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);
  
  // UI state
  const [isResizing, setIsResizing] = useState(false);
  const [showLiveSession, setShowLiveSession] = useState(false);
  const [viewMode, setViewMode] = useState<'editor' | 'results'>(
    (searchParams.get('tab') as 'editor' | 'results') || 'editor'
  );
  const [activePanel, setActivePanel] = useState<ActivePanel>('settings');
  const [showSettings, setShowSettings] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showActivitiesSubmenu, setShowActivitiesSubmenu] = useState(false);
  const [showSlidePreviews, setShowSlidePreviews] = useState(false);
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [pageSettingsSection, setPageSettingsSection] = useState<'type' | 'template' | 'layout' | 'background' | 'chapter' | 'note' | undefined>(undefined);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [editingTextBlockIndex, setEditingTextBlockIndex] = useState<number | null>(null);
  
  
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
      case 'board':
        newSlide = createBoardSlide(order);
        break;
      case 'voting':
        newSlide = createVotingSlide(order);
        break;
      case 'fill-blanks':
        newSlide = createFillBlanksSlide(order);
        break;
      case 'connect-pairs':
        newSlide = createConnectPairsSlide(order);
        break;
      case 'image-hotspots':
        newSlide = createImageHotspotsSlide(order);
        break;
      case 'video-quiz':
        newSlide = createVideoQuizSlide(order);
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
    
    updateQuizWithUndo({
      ...quiz,
      slides: newSlides,
      updatedAt: new Date().toISOString(),
    });
  }, [quiz, updateQuizWithUndo]);
  
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
    // Calculate the current slide index from selectedSlideId
    const previewSlideIndex = selectedSlideId 
      ? quiz.slides.findIndex(s => s.id === selectedSlideId)
      : 0;
    
    return (
      <QuizPreview 
        quiz={quiz} 
        onClose={() => setShowPreview(false)} 
        initialSlideIndex={previewSlideIndex >= 0 ? previewSlideIndex : 0}
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
          onClick={() => navigate(returnUrl || '/library/my-content')}
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
        
        {/* My Board Tab (Settings) */}
        <SidebarButton
          onClick={() => {
            setActivePanel('settings');
            setViewMode('editor');
          }}
          isActive={activePanel === 'settings' && viewMode === 'editor'}
          icon={BookOpen}
          label="Můj board"
        />
        
        {/* Structure Tab (Slide list) */}
        <SidebarButton
          onClick={() => {
            setActivePanel('board');
            setViewMode('editor');
          }}
          isActive={activePanel === 'board' && viewMode === 'editor'}
          icon={Layers}
          label="Struktura"
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
        
        {/* Spacer */}
        <div style={{ flex: 1 }} />
      </div>
      
      {/* 2. CONTEXTUAL SIDEBAR PANEL (Only visible in editor mode) */}
      {viewMode === 'editor' && (
        <div 
          className="flex flex-col transition-all duration-300"
          style={{ width: '320px', minWidth: '320px', backgroundColor: '#F2F5F9' }}
        >
          {/* PANEL CONTENT */}
          
          {/* BOARD STRUCTURE PANEL */}
          {activePanel === 'board' && (
            <div className="flex flex-col h-full bg-white">
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-[#4E5871]">Struktura</h2>
                  <button
                    onClick={() => setShowSlidePreviews(!showSlidePreviews)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      showSlidePreviews 
                        ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title={showSlidePreviews ? 'Skrýt náhledy' : 'Zobrazit náhledy'}
                  >
                    {showSlidePreviews ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
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
                  <div className={showSlidePreviews ? 'space-y-3' : 'space-y-2'}>
                    {quiz.slides.map((slide, index) => {
                      const typeInfo = SLIDE_TYPES.find(t => 
                        t.type === slide.type && 
                        (slide.type !== 'activity' || t.activityType === (slide as any).activityType)
                      ) || SLIDE_TYPES[0];
                      
                      // Compact view (no visual preview)
                      if (!showSlidePreviews) {
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
                      }
                      
                      // Preview view with visual thumbnail
                      return (
                        <div
                          key={slide.id}
                          onClick={() => setSelectedSlideId(slide.id)}
                          className={`
                            group relative rounded-xl cursor-pointer transition-all border overflow-hidden
                            ${selectedSlideId === slide.id 
                              ? 'border-indigo-500 ring-2 ring-indigo-500 shadow-md' 
                              : 'border-slate-200 hover:border-indigo-300 hover:shadow-md'
                            }
                          `}
                        >
                          {/* Header bar */}
                          <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 border-b border-slate-200">
                            <div className="text-slate-300 cursor-grab active:cursor-grabbing p-0.5 hover:bg-slate-200 rounded">
                              <GripVertical className="w-3 h-3" />
                            </div>
                            <span className="text-xs font-bold text-slate-400">{index + 1}</span>
                            <div 
                              className="w-4 h-4 rounded flex items-center justify-center"
                              style={{ backgroundColor: `${typeInfo.color}20`, color: typeInfo.color }}
                            >
                              {React.cloneElement(typeInfo.icon, { size: 10 })}
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide flex-1 truncate">
                              {typeInfo.label}
                            </span>
                            
                            {/* Actions */}
                            <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); duplicateSlide(slide.id); }}
                                className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-indigo-600"
                                title="Duplikovat"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteSlide(slide.id); }}
                                className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500"
                                title="Smazat"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          
                          {/* Visual preview - slide thumbnail */}
                          <div style={{ height: '140px' }} className="overflow-hidden rounded-b-xl">
                            <SlidePreviewThumbnail slide={slide} />
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
            <div className="flex flex-col h-full bg-white">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-xl font-bold text-[#4E5871]">Přidat obsah</h2>
              </div>
              
              <div className="p-5 overflow-y-auto flex-1">
                {!showActivitiesSubmenu ? (
                  <>
                    {/* Main options */}
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-slate-500 mb-3">Přidat stránku:</h3>
                      <div className="space-y-2">
                        {/* Informace */}
                        <button
                          onClick={() => {
                            const infoType = SLIDE_TYPES.find(t => t.id === 'info');
                            if (infoType) addSlide(infoType);
                          }}
                          className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all text-left group"
                        >
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#6366f115', color: '#6366f1' }}>
                            <FileText className="w-5 h-5" />
                          </div>
                          <span className="font-semibold text-slate-700 group-hover:text-indigo-700">Informace</span>
                          <Plus className="w-5 h-5 text-slate-300 ml-auto group-hover:text-indigo-500" />
                        </button>
                        
                        {/* Aktivity */}
                        <button
                          onClick={() => setShowActivitiesSubmenu(true)}
                          className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all text-left group"
                        >
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#10b98115', color: '#10b981' }}>
                            <ListOrdered className="w-5 h-5" />
                          </div>
                          <span className="font-semibold text-slate-700 group-hover:text-indigo-700">Aktivity</span>
                          <ChevronRight className="w-5 h-5 text-slate-300 ml-auto group-hover:text-indigo-500" />
                        </button>
                        
                        {/* Nástroje */}
                        <button
                          onClick={() => {
                            const toolType = SLIDE_TYPES.find(t => t.type === 'tools');
                            if (toolType) addSlide(toolType);
                          }}
                          className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all text-left group"
                        >
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#64748b15', color: '#64748b' }}>
                            <Calculator className="w-5 h-5" />
                          </div>
                          <span className="font-semibold text-slate-700 group-hover:text-indigo-700">Nástroje</span>
                          <Plus className="w-5 h-5 text-slate-300 ml-auto group-hover:text-indigo-500" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Additional options */}
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          // TODO: Implement import from another board
                          alert('Funkce bude brzy dostupná');
                        }}
                        className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all text-left group"
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#8b5cf615', color: '#8b5cf6' }}>
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <span className="font-semibold text-slate-700 group-hover:text-indigo-700">Přidat obsah z jiného boardu</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          // TODO: Implement import from PDF
                          alert('Funkce bude brzy dostupná');
                        }}
                        className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all text-left group"
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f9731615', color: '#f97316' }}>
                          <FileText className="w-5 h-5" />
                        </div>
                        <span className="font-semibold text-slate-700 group-hover:text-indigo-700">Přidat obsah z PDF</span>
                      </button>
                    </div>
                  </>
                ) : (
                  /* Activities submenu */
                  <>
                    <button
                      onClick={() => setShowActivitiesSubmenu(false)}
                      className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="text-sm font-medium">Zpět</span>
                    </button>
                    
                    <h3 className="text-sm font-semibold text-slate-500 mb-3">Vyberte aktivitu:</h3>
                    <div className="space-y-2">
                      {SLIDE_TYPES.filter(t => t.type === 'activity').map((type) => (
                    <button
                      key={type.id}
                          onClick={() => {
                            addSlide(type);
                            setShowActivitiesSubmenu(false);
                          }}
                          className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all text-left group"
                    >
                      <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${type.color}15`, color: type.color }}
                      >
                            {React.cloneElement(type.icon, { className: 'w-5 h-5' })}
                      </div>
                      <div>
                            <span className="font-semibold text-slate-700 group-hover:text-indigo-700">{type.label}</span>
                            <p className="text-xs text-slate-500">{type.description}</p>
                      </div>
                      <Plus className="w-5 h-5 text-slate-300 ml-auto group-hover:text-indigo-500" />
                    </button>
                  ))}
                </div>
                  </>
                )}
              </div>
            </div>
          )}
          
          {/* AI PANEL */}
          {activePanel === 'ai' && (
            <div className="flex flex-col h-full bg-white">
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
            </div>
          )}
          
          {/* SETTINGS PANEL */}
          {activePanel === 'settings' && (
            <div className="flex flex-col h-full border-0" style={{ backgroundColor: '#F2F5F9' }}>
              <div className="px-6 flex-1 overflow-y-auto" style={{ paddingTop: '155px' }}>
                <div className="space-y-4">
                  {/* Board Name - 80px height */}
                  <input
                    type="text"
                    value={quiz.title}
                    onChange={(e) => {
                      setQuiz({ ...quiz, title: e.target.value });
                      setIsDirty(true);
                    }}
                    className="w-full px-5 text-2xl font-bold rounded-2xl border-0 focus:ring-2 focus:ring-indigo-300 outline-none transition-all text-slate-700 placeholder-slate-400"
                    placeholder="Název boardu"
                    style={{ backgroundColor: '#DFE4F0', height: '80px' }}
                  />
                  
                  {/* Označení dropdown */}
                  <div className="flex items-center gap-4">
                    <span className="text-base font-medium text-slate-500 whitespace-nowrap">Označení:</span>
                    <select 
                      value={(quiz as any).boardType || 'practice'}
                      onChange={(e) => {
                        setQuiz({ ...quiz, boardType: e.target.value } as any);
                        setIsDirty(true);
                      }}
                      className="flex-1 px-4 py-3.5 rounded-2xl border-0 focus:ring-2 focus:ring-indigo-300 outline-none text-slate-700 font-medium"
                      style={{ backgroundColor: '#DFE4F0' }}
                    >
                      <option value="practice">Procvičování</option>
                      <option value="text">Text</option>
                      <option value="test">Písemky</option>
                      <option value="lesson">Lekce</option>
                    </select>
                </div>
                
                  {/* Subject dropdown - full width */}
                  <select 
                    value={quiz.subject || ''}
                    onChange={(e) => {
                      setQuiz({ ...quiz, subject: e.target.value });
                      setIsDirty(true);
                    }}
                    className="w-full px-5 py-4 rounded-2xl border-0 focus:ring-2 focus:ring-indigo-300 outline-none text-slate-600 font-medium"
                    style={{ backgroundColor: '#DFE4F0' }}
                  >
                    <option value="">Předmět</option>
                    <option value="matematika">Matematika</option>
                    <option value="fyzika">Fyzika</option>
                    <option value="chemie">Chemie</option>
                    <option value="biologie">Biologie</option>
                    <option value="cestina">Český jazyk</option>
                    <option value="anglictina">Anglický jazyk</option>
                    <option value="dejepis">Dějepis</option>
                    <option value="zemepis">Zeměpis</option>
                  </select>
                </div>
                
                {/* Action buttons - no background, smaller spacing */}
                <div className="mt-8 space-y-2">
                  {/* Version History Button */}
                  <button
                    onClick={() => setShowVersionHistory(true)}
                    className="w-full flex items-center gap-4 px-2 py-2.5 rounded-lg hover:bg-slate-200/50 transition-colors text-slate-600"
                  >
                    <History className="w-5 h-5" />
                    <span className="font-medium">Historie verzí</span>
                  </button>
                  
                  {/* Share Edit Link Button */}
                  <button
                    onClick={() => {
                      const editUrl = `${window.location.origin}/quiz/edit/${quiz.id}`;
                      navigator.clipboard.writeText(editUrl);
                      alert('Odkaz pro úpravu zkopírován do schránky!');
                    }}
                    className="w-full flex items-center gap-4 px-2 py-2.5 rounded-lg hover:bg-slate-200/50 transition-colors text-slate-600"
                  >
                    <Share2 className="w-5 h-5" />
                    <span className="font-medium">Sdílet odkaz pro úpravu</span>
                  </button>
                  
                  {/* Results Button */}
                  <button
                    onClick={() => setViewMode('results')}
                    className="w-full flex items-center gap-4 px-2 py-2.5 rounded-lg hover:bg-slate-200/50 transition-colors text-slate-600"
                  >
                    <BarChart2 className="w-5 h-5" />
                    <span className="font-medium">Výsledky</span>
                  </button>
                  
                  {/* Print Button */}
                  <button
                    onClick={() => {
                      saveQuiz(quiz);
                      setIsDirty(false);
                      const worksheet = boardToWorksheet(quiz);
                      saveWorksheet(worksheet);
                      navigate(`/worksheet/edit/${worksheet.id}`);
                    }}
                    className="w-full flex items-center gap-4 px-2 py-2.5 rounded-lg hover:bg-slate-200/50 transition-colors text-slate-600"
                  >
                    <Printer className="w-5 h-5" />
                    <span className="font-medium">Tisknout</span>
                  </button>
                  
                  {/* Delete Button */}
                  <button
                    onClick={() => {
                      if (confirm('Opravdu chcete smazat tento board? Tato akce je nevratná.')) {
                        navigate('/quizzes');
                      }
                    }}
                    className="w-full flex items-center gap-4 px-2 py-2.5 rounded-lg hover:bg-red-100 transition-colors text-red-500"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="font-medium">Smazat</span>
                  </button>
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
            {/* Top bar - clean, no background */}
            <div className="h-16 flex items-center justify-between px-6 z-10">
              {/* Slide navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const currentIndex = quiz.slides.findIndex(s => s.id === selectedSlideId);
                    if (currentIndex > 0) {
                      setSelectedSlideId(quiz.slides[currentIndex - 1].id);
                    }
                  }}
                  disabled={!selectedSlideId || quiz.slides.findIndex(s => s.id === selectedSlideId) === 0}
                  className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center justify-center"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="px-4 py-1.5 rounded-full text-sm font-medium" style={{ backgroundColor: '#374151', color: '#f3f4f6' }}>
                  Stránka {selectedSlideId ? quiz.slides.findIndex(s => s.id === selectedSlideId) + 1 : 0} / {quiz.slides.length}
                </div>
                <button
                  onClick={() => {
                    const currentIndex = quiz.slides.findIndex(s => s.id === selectedSlideId);
                    if (currentIndex < quiz.slides.length - 1) {
                      setSelectedSlideId(quiz.slides[currentIndex + 1].id);
                    }
                  }}
                  disabled={!selectedSlideId || quiz.slides.findIndex(s => s.id === selectedSlideId) === quiz.slides.length - 1}
                  className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center justify-center"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
            </div>
            
                    <div className="flex items-center gap-2">
                {/* Undo/Redo buttons - square icons */}
                      <button
                  onClick={undo}
                  disabled={undoStack.length === 0}
                  className="w-10 h-10 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:opacity-30 disabled:hover:bg-slate-200 transition-colors flex items-center justify-center"
                  title="Zpět (Ctrl+Z)"
                >
                  <Undo2 className="w-5 h-5" />
                      </button>
                      <button
                  onClick={redo}
                  disabled={redoStack.length === 0}
                  className="w-10 h-10 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:opacity-30 disabled:hover:bg-slate-200 transition-colors flex items-center justify-center"
                  title="Vpřed (Ctrl+Shift+Z)"
                >
                  <Redo2 className="w-5 h-5" />
                      </button>

                {/* Preview - square icon */}
                      <button
                  onClick={() => setShowPreview(true)}
                  className="w-10 h-10 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors flex items-center justify-center"
                  title="Náhled"
                >
                  <Eye className="w-5 h-5" />
                      </button>

                {/* Print / Worksheet - square icon */}
                                <button
                                  onClick={() => {
                    // Auto-save first
                    saveQuiz(quiz);
                    setIsDirty(false);
                    // Convert to worksheet and open
                    const worksheet = boardToWorksheet(quiz);
                    saveWorksheet(worksheet);
                    navigate(`/worksheet/edit/${worksheet.id}`);
                  }}
                  className="w-10 h-10 rounded-lg text-white flex items-center justify-center transition-colors"
                  style={{ backgroundColor: '#f97316' }}
                  title="Pracovní list"
                >
                  <Printer className="w-5 h-5" />
                                </button>

                {/* Play and Share - green button */}
                <button
                  onClick={() => {
                    // Auto-save first
                    saveQuiz(quiz);
                    setIsDirty(false);
                    // Navigate to quiz view page
                    navigate(`/quiz/view/${quiz.id}`);
                  }}
                  disabled={quiz.slides.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white transition-all hover:scale-105 disabled:opacity-50 disabled:transform-none"
                  style={{ backgroundColor: '#22c55e' }}
                >
                  <Play className="w-5 h-5" />
                  Přehrát a sdílet
                </button>
                            </div>
                          </div>
            
            {/* Editor Canvas */}
            <div 
              className="flex-1 overflow-auto p-8 flex justify-center bg-slate-100/50"
              onClick={(e) => {
                // Close panels when clicking on the canvas background
                // Check if click is on the gray background area (not on slide content)
                const target = e.target as HTMLElement;
                if (target === e.currentTarget || target.classList.contains('bg-slate-100/50')) {
                  setShowPageSettings(false);
                  setSelectedBlockIndex(null);
                }
              }}
              onMouseDown={(e) => {
                // Also handle mousedown on the gray area
                if (e.target === e.currentTarget) {
                  setShowPageSettings(false);
                  setSelectedBlockIndex(null);
                }
              }}
            >
              {selectedSlide ? (
                <div className="relative w-full flex flex-col mb-8" style={{ maxWidth: 'min(1024px, calc((100vh - 200px) * 4 / 3))' }}>
                  {/* Settings and Slide Type Info - aligned left */}
                  <div className="flex items-center justify-start gap-3 mb-4">
                    {/* Settings Button - more prominent */}
                    <button
                      onClick={() => setShowPageSettings(true)}
                      className="w-10 h-10 bg-white rounded-lg border-2 border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-800 transition-colors flex items-center justify-center shadow-sm"
                      title="Nastavení stránky"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                    
                    {/* Slide Type - plain text */}
                    {(() => {
                      const typeInfo = SLIDE_TYPES.find(t => 
                        t.type === selectedSlide.type && 
                        (selectedSlide.type !== 'activity' || t.activityType === (selectedSlide as any).activityType)
                      ) || SLIDE_TYPES[0];
                      return (
                        <div className="flex items-center gap-2">
                          <div style={{ color: typeInfo.color }}>
                            {React.cloneElement(typeInfo.icon, { className: 'w-5 h-5' })}
                    </div>
                          <span className="text-sm font-semibold text-slate-600">
                            {typeInfo.label}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* Text Toolbar - shown when editing text, overlays the navigation */}
                  {editingTextBlockIndex !== null && selectedSlide?.type === 'info' && selectedSlide.layout && (
                    <div className="absolute top-0 left-0 z-50">
                      <SlideTextToolbar
                        isBold={selectedSlide.layout.blocks[editingTextBlockIndex]?.fontWeight === 'bold'}
                        isItalic={selectedSlide.layout.blocks[editingTextBlockIndex]?.fontStyle === 'italic'}
                        isUnderline={selectedSlide.layout.blocks[editingTextBlockIndex]?.textDecoration === 'underline'}
                        textAlign={selectedSlide.layout.blocks[editingTextBlockIndex]?.textAlign || 'left'}
                        fontSize={selectedSlide.layout.blocks[editingTextBlockIndex]?.fontSize || 'medium'}
                        textColor={selectedSlide.layout.blocks[editingTextBlockIndex]?.textColor || '#000000'}
                        highlightColor={selectedSlide.layout.blocks[editingTextBlockIndex]?.highlightColor || 'transparent'}
                        onBoldToggle={() => {
                          const block = selectedSlide.layout!.blocks[editingTextBlockIndex];
                          const newBlocks = [...selectedSlide.layout!.blocks];
                          newBlocks[editingTextBlockIndex] = { 
                            ...block, 
                            fontWeight: block.fontWeight === 'bold' ? 'normal' : 'bold' 
                          };
                          updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                        }}
                        onItalicToggle={() => {
                          const block = selectedSlide.layout!.blocks[editingTextBlockIndex];
                          const newBlocks = [...selectedSlide.layout!.blocks];
                          newBlocks[editingTextBlockIndex] = { 
                            ...block, 
                            fontStyle: block.fontStyle === 'italic' ? 'normal' : 'italic' 
                          };
                          updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                        }}
                        onUnderlineToggle={() => {
                          const block = selectedSlide.layout!.blocks[editingTextBlockIndex];
                          const newBlocks = [...selectedSlide.layout!.blocks];
                          newBlocks[editingTextBlockIndex] = { 
                            ...block, 
                            textDecoration: block.textDecoration === 'underline' ? 'none' : 'underline' 
                          };
                          updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                        }}
                        onAlignChange={(align) => {
                          const newBlocks = [...selectedSlide.layout!.blocks];
                          newBlocks[editingTextBlockIndex] = { 
                            ...newBlocks[editingTextBlockIndex], 
                            textAlign: align 
                          };
                          updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                        }}
                        onFontSizeChange={(size) => {
                          const newBlocks = [...selectedSlide.layout!.blocks];
                          newBlocks[editingTextBlockIndex] = { 
                            ...newBlocks[editingTextBlockIndex], 
                            fontSize: size 
                          };
                          updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                        }}
                        onTextColorChange={(color) => {
                          const newBlocks = [...selectedSlide.layout!.blocks];
                          newBlocks[editingTextBlockIndex] = { 
                            ...newBlocks[editingTextBlockIndex], 
                            textColor: color 
                          };
                          updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                        }}
                        onHighlightColorChange={(color) => {
                          const newBlocks = [...selectedSlide.layout!.blocks];
                          newBlocks[editingTextBlockIndex] = { 
                            ...newBlocks[editingTextBlockIndex], 
                            highlightColor: color 
                          };
                          updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                        }}
                        listType={selectedSlide.layout.blocks[editingTextBlockIndex]?.listType || 'none'}
                        onListTypeChange={(type) => {
                          const newBlocks = [...selectedSlide.layout!.blocks];
                          const block = newBlocks[editingTextBlockIndex];
                          let content = block.content || '';
                          
                          // Remove existing list formatting
                          content = content.split('\n').map(line => 
                            line.replace(/^(\d+\.\s|•\s|☐\s|☑\s)/, '')
                          ).join('\n');
                          
                          // Apply new list formatting
                          if (type !== 'none') {
                            content = content.split('\n').map((line, idx) => {
                              if (!line.trim()) return line;
                              if (type === 'numbered') return `${idx + 1}. ${line}`;
                              if (type === 'bullet') return `• ${line}`;
                              if (type === 'checklist') return `☐ ${line}`;
                              return line;
                            }).join('\n');
                          }
                          
                          newBlocks[editingTextBlockIndex] = { 
                            ...block, 
                            listType: type,
                            content 
                          };
                          updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                        }}
                        onInsertSymbol={(symbol) => {
                          const newBlocks = [...selectedSlide.layout!.blocks];
                          const block = newBlocks[editingTextBlockIndex];
                          newBlocks[editingTextBlockIndex] = { 
                            ...block, 
                            content: (block.content || '') + symbol 
                          };
                          updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                        }}
                      />
                            </div>
                      )}
                  
                  {/* The actual editor */}
                  <div 
                    className="rounded-xl shadow-sm border border-slate-200 transition-colors duration-300"
                    style={{ backgroundColor: selectedSlide.backgroundColor || '#ffffff' }}
                  >
                    {renderSlideEditor(
                      selectedSlide, 
                      updateSlide, 
                      () => setShowPageSettings(true),
                      (blockIndex) => {
                        setSelectedBlockIndex(blockIndex);
                        setShowPageSettings(false); // Close page settings when block settings open
                      },
                      (blockIndex) => {
                        setEditingTextBlockIndex(blockIndex);
                      },
                      () => {
                        setEditingTextBlockIndex(null);
                      }
                    )}
                  </div>
                  
                  {/* Buttons below slide */}
                  <div className="flex items-center justify-between mt-4">
                    {/* Nová kapitola - left */}
                    <button
                      onClick={() => {
                        setPageSettingsSection('chapter');
                        setShowPageSettings(true);
                      }}
                      className="flex items-center gap-2 px-2 py-1 text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      <ListOrdered className="w-4 h-4" />
                      <span className="text-sm">
                        {(selectedSlide as any).chapterName || 'Nová kapitola'}
                      </span>
                    </button>
                    
                    {/* Přidat poznámku - right */}
                    <button
                      onClick={() => {
                        setPageSettingsSection('note');
                        setShowPageSettings(true);
                      }}
                      className="flex items-center gap-2 px-2 py-1 text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-sm truncate max-w-[200px]">
                        {(selectedSlide as any).note 
                          ? ((selectedSlide as any).note.length > 30 
                              ? (selectedSlide as any).note.substring(0, 30) + '...' 
                              : (selectedSlide as any).note)
                          : 'Přidat poznámku'}
                      </span>
                    </button>
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
        <PageSettingsPanel
          slide={selectedSlide}
          onClose={() => {
            setShowPageSettings(false);
            setPageSettingsSection(undefined);
          }}
          onUpdate={(updates) => updateSlide(selectedSlide.id, updates)}
          initialSection={pageSettingsSection}
        />
      )}
      
      {/* Block Settings Panel - Overlay on left side */}
      {selectedBlockIndex !== null && selectedSlide?.type === 'info' && selectedSlide.layout && (
        <BlockSettingsPanel
          block={selectedSlide.layout.blocks[selectedBlockIndex]}
          blockIndex={selectedBlockIndex}
          onUpdate={(updates) => {
            const newBlocks = [...selectedSlide.layout!.blocks];
            newBlocks[selectedBlockIndex] = { ...newBlocks[selectedBlockIndex], ...updates };
            updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
          }}
          onClose={() => setSelectedBlockIndex(null)}
          onImageUpload={(file) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              const newBlocks = [...selectedSlide.layout!.blocks];
              newBlocks[selectedBlockIndex] = { ...newBlocks[selectedBlockIndex], content: event.target?.result as string };
              updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
            };
            reader.readAsDataURL(file);
          }}
        />
      )}
      
      {/* No backdrop - allow interaction with slide while panel is open */}
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
  onUpdate: (id: string, updates: Partial<QuizSlide>) => void,
  onSlideClick?: () => void,
  onBlockSettingsClick?: (blockIndex: number) => void,
  onTextEditStart?: (blockIndex: number) => void,
  onTextEditEnd?: () => void
): React.ReactNode {
  switch (slide.type) {
    case 'info':
      const infoSlide = slide as InfoSlide;
      return (
        <InfoSlideEditor 
          key={`${slide.id}-${infoSlide.layout?.type || 'default'}-${infoSlide.layout?.blocks?.length || 0}`}
          slide={slide} 
          onUpdate={onUpdate} 
          onSlideClick={onSlideClick} 
          onBlockSettingsClick={onBlockSettingsClick}
          onTextEditStart={onTextEditStart}
          onTextEditEnd={onTextEditEnd}
        />
      );
    case 'activity':
      switch ((slide as any).activityType) {
        case 'abc':
          return <ABCSlideEditor slide={slide as any} onUpdate={onUpdate} />;
        case 'open':
          return <OpenSlideEditor slide={slide as any} onUpdate={onUpdate} />;
        case 'example':
          return <ExampleSlideEditor slide={slide as any} onUpdate={onUpdate} />;
        case 'board':
          return <BoardSlideEditor slide={slide as any} onUpdate={onUpdate} />;
        case 'voting':
          return <VotingSlideEditor slide={slide as any} onUpdate={onUpdate} />;
        case 'connect-pairs':
          return <ConnectPairsEditor slide={slide as ConnectPairsActivitySlide} onUpdate={onUpdate} />;
        case 'fill-blanks':
          return <FillBlanksEditor slide={slide as FillBlanksActivitySlide} onUpdate={onUpdate} />;
        case 'image-hotspots':
          return <ImageHotspotsEditor slide={slide as ImageHotspotsActivitySlide} onUpdate={onUpdate} />;
        case 'video-quiz':
          return <VideoQuizEditor slide={slide as VideoQuizActivitySlide} onUpdate={onUpdate} />;
        default:
          return <div>Nepodporovaný typ aktivity</div>;
      }
    default:
      return <div>Nepodporovaný typ slidu</div>;
  }
}

export default QuizEditorLayout;
