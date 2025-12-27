/**
 * Quiz View Page
 * 
 * Display quiz/board with slide navigation and action panel
 * Based on Vividboard design from screenshot
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  X,
  Menu,
  ChevronLeft,
  ChevronRight,
  Users,
  Edit3,
  BarChart2,
  Printer,
  Share2,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  CheckCircle,
  Play,
  ArrowRight,
  ArrowLeft,
  SkipForward,
  Upload,
  Sparkles,
  ChevronDown,
  PanelLeft,
  PanelLeftClose,
  Copy,
  QrCode,
  StopCircle,
  RefreshCw,
  Lock,
  Unlock,
  AlertTriangle,
  MessageSquare,
  Vote,
} from 'lucide-react';
import { Quiz, QuizSlide, ABCActivitySlide, OpenActivitySlide, ExampleActivitySlide, BoardActivitySlide, VotingActivitySlide, ConnectPairsActivitySlide, FillBlanksActivitySlide, ImageHotspotsActivitySlide, VideoQuizActivitySlide, InfoSlide, LiveQuizSession, SlideResponse } from '../../types/quiz';
import { BoardSlideView } from './slides/BoardSlideView';
import { VotingSlideView } from './slides/VotingSlideView';
import { ConnectPairsView } from './slides/ConnectPairsView';
import { FillBlanksView } from './slides/FillBlanksView';
import { ImageHotspotsView } from './slides/ImageHotspotsView';
import { VideoQuizView } from './slides/VideoQuizView';
import { useBoardPosts } from '../../hooks/useBoardPosts';
import { useVoting } from '../../hooks/useVoting';
import { getQuiz, saveQuiz, duplicateQuiz } from '../../utils/quiz-storage';
import * as storage from '../../utils/profile-storage';
import { database } from '../../utils/firebase-config';
import { ref, set, onValue, off, update } from 'firebase/database';
import { boardToWorksheet, getConversionSummary } from '../../utils/content-converter';
import { saveWorksheet } from '../../utils/worksheet-storage';
import { MathText } from '../math/MathText';
import { QRCodeSVG } from 'qrcode.react';
import { BlockLayoutView } from './QuizPreview';
import { getClasses, ClassGroup } from '../../utils/supabase/classes';

// Toggle switch component - simple working version
const ToggleSwitch = ({ enabled, onChange, label }: { enabled: boolean; onChange: (v: boolean) => void; label: string }) => {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-white font-medium">{label}</span>
      <div 
        onClick={() => onChange(!enabled)}
        style={{
          width: '52px',
          height: '28px',
          backgroundColor: enabled ? '#10b981' : '#64748b',
          borderRadius: '14px',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background-color 0.2s',
          flexShrink: 0,
        }}
      >
        <div 
          style={{
            width: '22px',
            height: '22px',
            backgroundColor: 'white',
            borderRadius: '11px',
            position: 'absolute',
            top: '3px',
            left: enabled ? '27px' : '3px',
            transition: 'left 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        />
      </div>
    </div>
  );
};

// Firebase paths
const QUIZ_SESSIONS_PATH = 'quiz_sessions';

function getSessionPath(sessionId: string) {
  return `${QUIZ_SESSIONS_PATH}/${sessionId}`;
}

function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================
// SLIDE RENDERERS
// ============================================

interface SlideViewProps {
  slide: QuizSlide;
  showHint: boolean;
  showSolution: boolean;
  selectedAnswer?: string;
  onSelectAnswer?: (answerId: string) => void;
}

function ABCSlideView({ slide, showHint, showSolution, selectedAnswer, onSelectAnswer }: SlideViewProps & { slide: ABCActivitySlide }) {
  
  return (
    <div className="flex flex-col h-full">
      {/* Question */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <h1 className="text-4xl md:text-5xl font-bold text-[#4E5871] text-center leading-tight">
          <MathText>{slide.question || 'Otázka...'}</MathText>
        </h1>
        
        {/* Question image */}
        {slide.media?.url && slide.media?.type === 'image' && (
          <img 
            src={slide.media.url} 
            alt="Obrázek k otázce"
            className="mt-4 max-w-full max-h-48 md:max-h-64 rounded-xl shadow-lg object-contain"
          />
        )}
      </div>
      
      {/* Options */}
      <div className="grid grid-cols-2 gap-4 p-6 max-w-4xl mx-auto w-full">
        {slide.options.map((option, index) => {
          const isSelected = selectedAnswer === option.id;
          const isCorrect = showSolution && option.isCorrect;
          const isWrong = showSolution && isSelected && !option.isCorrect;
          
          return (
            <button
              key={option.id}
              onClick={() => onSelectAnswer?.(option.id)}
              disabled={showSolution}
              className={`
                relative p-4 rounded-2xl text-left transition-all border-2 flex items-center gap-4
                ${isCorrect ? 'bg-green-50 border-green-500' : ''}
                ${isWrong ? 'bg-red-50 border-red-500' : ''}
                ${!showSolution && isSelected ? 'border-indigo-500 bg-indigo-50' : ''}
                ${!showSolution && !isSelected ? 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md' : ''}
                ${!isCorrect && !isWrong && !isSelected && showSolution ? 'bg-white border-slate-100 opacity-50' : ''}
              `}
            >
              <span 
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  flexShrink: 0,
                  transition: 'all 0.2s',
                  backgroundColor: isCorrect ? '#bbf7d0' : isWrong ? '#fecaca' : (!showSolution && isSelected) ? '#c7d2fe' : '#E2E8F0',
                  color: isCorrect ? '#166534' : isWrong ? '#991b1b' : (!showSolution && isSelected) ? '#3730a3' : '#475569',
                }}
              >
                {option.label || option.id?.toUpperCase() || '?'}
              </span>
              <span className="text-xl font-medium text-[#4E5871] flex-1">
                <MathText>{option.content || ''}</MathText>
              </span>
              
              {isCorrect && (
                <CheckCircle className="w-6 h-6 text-green-600" />
              )}
            </button>
          );
        })}
      </div>
      
    </div>
  );
}

function OpenSlideView({ slide }: { slide: OpenActivitySlide }) {
  return (
    <div className="flex flex-col h-full items-center justify-center p-8">
      <h1 className="text-4xl md:text-5xl font-bold text-[#4E5871] text-center leading-tight mb-4">
        {slide.question || 'Otevřená otázka...'}
      </h1>
      
      {/* Question image */}
      {slide.media?.url && slide.media?.type === 'image' && (
        <img 
          src={slide.media.url} 
          alt="Obrázek k otázce"
          className="mb-6 max-w-full max-h-48 md:max-h-64 rounded-xl shadow-lg object-contain"
        />
      )}
      
      <div className="w-full max-w-2xl">
        <textarea 
          className="w-full h-40 p-4 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:ring-0 text-lg resize-none"
          placeholder="Napište svou odpověď..."
        />
      </div>
    </div>
  );
}

function ExampleSlideView({ slide }: { slide: ExampleActivitySlide }) {
  const [currentStep, setCurrentStep] = useState(0);
  
  return (
    <div className="flex flex-col h-full p-8">
      <h1 className="text-3xl font-bold text-[#4E5871] mb-6">
        {slide.title || 'Příklad'}
      </h1>
      
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-medium text-slate-600 mb-2">Zadání</h2>
        <p className="text-xl text-[#4E5871]">{slide.problem}</p>
      </div>
      
      {slide.steps.length > 0 && (
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm font-medium text-slate-500">
              Krok {currentStep + 1} z {slide.steps.length}
            </span>
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all"
                style={{ width: `${((currentStep + 1) / slide.steps.length) * 100}%` }}
              />
            </div>
          </div>
          
          <div className="bg-indigo-50 rounded-xl p-6 min-h-[200px]">
            <p className="text-lg text-[#4E5871]">
              {slide.steps[currentStep]?.content || ''}
            </p>
          </div>
          
          <div className="flex justify-between mt-4">
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
            >
              Předchozí krok
            </button>
            <button
              onClick={() => setCurrentStep(Math.min(slide.steps.length - 1, currentStep + 1))}
              disabled={currentStep === slide.steps.length - 1}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Další krok
            </button>
          </div>
        </div>
      )}
      
      {slide.finalAnswer && (
        <div className="bg-emerald-50 rounded-xl p-6 mt-4">
          <h3 className="text-sm font-medium text-emerald-600 mb-2">Výsledek</h3>
          <p className="text-xl font-bold text-emerald-800">{slide.finalAnswer}</p>
        </div>
      )}
    </div>
  );
}

function InfoSlideView({ slide }: { slide: InfoSlide }) {
  // If slide has new block-based layout, render it
  if (slide.layout && slide.layout.blocks.length > 0) {
    return (
      <div className="flex-1 h-full">
        <BlockLayoutView slide={slide} />
      </div>
    );
  }

  // Fallback to legacy format
  return (
    <div className="flex flex-col h-full items-center justify-center p-8">
      {slide.title && (
        <h1 className="text-4xl md:text-5xl font-bold text-[#4E5871] text-center leading-tight mb-6">
          {slide.title}
        </h1>
      )}
      {slide.content && (
        <div 
          className="prose prose-lg max-w-3xl text-center"
          dangerouslySetInnerHTML={{ __html: slide.content }}
        />
      )}
      {slide.media && (
        <div className="mt-8">
          {slide.media.type === 'image' && (
            <img src={slide.media.url} alt={slide.media.caption || ''} className="max-h-96 rounded-xl" />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function QuizViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // State
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [prevSlideIndex, setPrevSlideIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showStudentOptions, setShowStudentOptions] = useState(false);
  const [showShareSettings, setShowShareSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(true);
  
  // Live session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [session, setSession] = useState<LiveQuizSession | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showLiveSettings, setShowLiveSettings] = useState(false);
  
  // Live session settings
  const [liveShowSolutionHints, setLiveShowSolutionHints] = useState(true);
  
  // Class connection state
  const [availableClasses, setAvailableClasses] = useState<ClassGroup[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(false);
  
  // Share settings
  const [sessionName, setSessionName] = useState('Nová relace');
  const [anonymousAccess, setAnonymousAccess] = useState(false);
  const [showSolutionHints, setShowSolutionHints] = useState(true);
  const [showActivityResults, setShowActivityResults] = useState(true);
  const [requireAnswerToProgress, setRequireAnswerToProgress] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  
  // Get current user
  const profile = storage.getCurrentUserProfile();
  
  // Current slide for board posts hook (must be called unconditionally)
  const currentSlideForBoard = quiz?.slides?.[currentSlideIndex];
  
  // Board posts for current slide (if it's a board activity)
  // Must be called before any early returns to satisfy React hooks rules
  const boardPosts = useBoardPosts({
    sessionId: sessionId,
    slideId: currentSlideForBoard?.id || '',
    currentUserId: profile?.id,
    currentUserName: profile?.name,
  });
  
  // Voting for current slide (if it's a voting activity)
  const voting = useVoting({
    sessionId: sessionId,
    slideId: currentSlideForBoard?.id || '',
    currentUserId: profile?.id,
    currentUserName: profile?.name,
  });
  
  // Load quiz
  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    
    const loadedQuiz = getQuiz(id);
    if (loadedQuiz) {
      setQuiz(loadedQuiz);
    }
    setLoading(false);
  }, [id]);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        goToPrevSlide();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        goToNextSlide();
      } else if (e.key === 'Escape') {
        if (showStudentOptions) {
          setShowStudentOptions(false);
        } else {
          navigate(-1);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlideIndex, quiz, showStudentOptions]);
  
  const goToNextSlide = useCallback(() => {
    if (quiz && currentSlideIndex < quiz.slides.length - 1 && !isAnimating) {
      setIsAnimating(true);
      setPrevSlideIndex(currentSlideIndex);
      setCurrentSlideIndex(prev => prev + 1);
      setTimeout(() => setIsAnimating(false), 500);
    }
  }, [quiz, currentSlideIndex, isAnimating]);
  
  const goToPrevSlide = useCallback(() => {
    if (currentSlideIndex > 0 && !isAnimating) {
      setIsAnimating(true);
      setPrevSlideIndex(currentSlideIndex);
      setCurrentSlideIndex(prev => prev - 1);
      setTimeout(() => setIsAnimating(false), 500);
    }
  }, [currentSlideIndex, isAnimating]);
  
  // ============================================
  // LIVE SESSION FUNCTIONS
  // ============================================
  
  // Start live session
  const startLiveSession = useCallback(async () => {
    if (isStartingSession || !quiz) return;
    setIsStartingSession(true);
    
    const code = generateSessionCode();
    const newSessionId = `quiz_${code}_${Date.now()}`;
    
    const sessionData: LiveQuizSession = {
      id: newSessionId,
      quizId: quiz.id,
      code: code, // IMPORTANT: Store code so students can find the session!
      teacherId: profile?.userId || 'anonymous',
      teacherName: (profile as any)?.firstName || profile?.name || 'Učitel',
      isActive: true,
      currentSlideIndex: currentSlideIndex,
      isPaused: false,
      showResults: false,
      isLocked: true, // Default: students follow teacher
      students: {},
      createdAt: new Date().toISOString(),
      settings: {
        showSolutionHints: liveShowSolutionHints,
      },
    };
    
    try {
      await set(ref(database, getSessionPath(newSessionId)), sessionData);
      await set(ref(database, `${QUIZ_SESSIONS_PATH}/${newSessionId}/quizData`), {
        id: quiz.id,
        title: quiz.title,
        slides: quiz.slides,
      });
      
      setSessionId(newSessionId);
      setSessionCode(code);
      setSession(sessionData);
      setShowStudentOptions(false);
    } catch (error) {
      console.error('Failed to start session:', error);
    } finally {
      setIsStartingSession(false);
    }
  }, [quiz, profile, currentSlideIndex, isStartingSession]);
  
  // Listen to session updates
  useEffect(() => {
    if (!sessionId) return;
    
    const sessionRef = ref(database, getSessionPath(sessionId));
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSession(data as LiveQuizSession);
      }
    });
    
    return () => off(sessionRef);
  }, [sessionId]);
  
  // Sync slide index to session and reset showResults for new slide
  useEffect(() => {
    if (sessionId && session?.isActive) {
      update(ref(database, getSessionPath(sessionId)), { 
        currentSlideIndex,
        showResults: false // Reset so students don't see results until teacher evaluates
      });
    }
  }, [sessionId, currentSlideIndex, session?.isActive]);
  
  // Load available classes when live settings panel opens
  useEffect(() => {
    if (showLiveSettings && availableClasses.length === 0 && !loadingClasses) {
      setLoadingClasses(true);
      getClasses()
        .then(classes => {
          setAvailableClasses(classes);
        })
        .catch(err => {
          console.error('Failed to load classes:', err);
        })
        .finally(() => {
          setLoadingClasses(false);
        });
    }
  }, [showLiveSettings, availableClasses.length, loadingClasses]);
  
  // End session
  const endLiveSession = async (viewResults: boolean = false) => {
    if (sessionId) {
      await update(ref(database, getSessionPath(sessionId)), { 
        isActive: false, 
        endedAt: new Date().toISOString() 
      });
      
      if (viewResults) {
        navigate(`/quiz/results/${sessionId}`);
        return;
      }
    }
    setSessionId(null);
    setSessionCode(null);
    setSession(null);
    setShowEndDialog(false);
  };
  
  // Copy session code
  const copySessionCode = () => {
    if (sessionCode) {
      navigator.clipboard.writeText(sessionCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  // Update live session
  const updateLiveSession = async (updates: Partial<LiveQuizSession>) => {
    if (sessionId) {
      await update(ref(database, getSessionPath(sessionId)), updates);
    }
  };
  
  // Get student stats
  const students = session?.students ? Object.entries(session.students) : [];
  const onlineStudents = students.filter(([_, s]) => s.isOnline);
  
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }
  
  // No quiz found
  if (!quiz) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-100">
        <HelpCircle className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-xl font-bold text-slate-600 mb-2">Board nenalezen</h1>
        <p className="text-slate-500 mb-6">Tento board neexistuje nebo byl smazán.</p>
        <button
          onClick={() => navigate('/library/my-content')}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Zpět do knihovny
        </button>
      </div>
    );
  }
  
  const currentSlide = quiz.slides[currentSlideIndex];
  const progress = quiz.slides.length > 0 ? ((currentSlideIndex + 1) / quiz.slides.length) * 100 : 0;
  
  const getSlideBackground = (slide: QuizSlide) => {
    return slide?.backgroundColor || '#ffffff';
  };
  
  // Convert to worksheet and open print
  const handlePrint = () => {
    const worksheet = boardToWorksheet(quiz);
    saveWorksheet(worksheet);
    // Navigate to worksheet editor with print mode
    navigate(`/worksheet/edit/${worksheet.id}?print=true`);
  };

  // Generate share code (similar to session code)
  const generateShareCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };
  
  // Generate share link
  const handleStartSharing = async () => {
    const shareCode = generateShareCode();
    const shareId = `share_${shareCode}_${Date.now()}`;
    
    // Store share settings in Firebase
    const shareData = {
      id: shareId,
      quizId: quiz.id,
      quizData: quiz,
      sessionName,
      shareCode,
      settings: {
        anonymousAccess,
        showSolutionHints,
        showActivityResults,
        requireAnswerToProgress,
        showNotes,
      },
      createdAt: new Date().toISOString(),
      createdBy: profile?.userId || 'anonymous',
      responses: {}, // Will store student responses
    };
    
    try {
      const shareRef = ref(database, `quiz_shares/${shareId}`);
      await set(shareRef, shareData);
      
      // Use BASE_URL for correct path on GitHub Pages
      const baseUrl = import.meta.env.BASE_URL || '/';
      const link = `${window.location.origin}${baseUrl}quiz/student/${shareId}`;
      setShareLink(link);
    } catch (error) {
      console.error('Error creating share session:', error);
    }
  };
  
  
  // Render the right panel content
  const renderRightPanel = () => {
    // Active live session panel
    if (sessionId && sessionCode) {
      return (
        <div className="flex flex-col h-full text-white" style={{ backgroundColor: '#1e2533' }}>
          {/* Session code and QR */}
          <div className="p-4" style={{ borderBottom: '1px solid #334155' }}>
            {/* QR Code - full join URL */}
            <div className="flex justify-center mb-4">
              <div className="bg-white p-3 rounded-xl">
                <QRCodeSVG 
                  value={`${window.location.origin}${import.meta.env.BASE_URL || '/'}quiz/join/${sessionCode}`}
                  size={160}
                  level="M"
                />
              </div>
            </div>
            
            {/* Code display */}
            <div 
              className="text-center py-3 px-4 rounded-xl mb-3"
              style={{ backgroundColor: '#334155' }}
            >
              <p className="text-xs mb-1" style={{ color: '#64748b' }}>Kód pro ruční zadání</p>
              <div 
                className="text-3xl font-mono font-bold tracking-widest select-all"
                style={{ color: '#ffffff', letterSpacing: '0.2em' }}
              >
                {sessionCode}
              </div>
            </div>
            
            {/* Copy full link button */}
            <button
              onClick={() => {
                const fullLink = `${window.location.origin}${import.meta.env.BASE_URL || '/'}quiz/join/${sessionCode}`;
                navigator.clipboard.writeText(fullLink);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="w-full py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              style={{ backgroundColor: '#334155', color: '#ffffff' }}
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4" style={{ color: '#4ade80' }} />
                  <span className="text-sm font-medium">Odkaz zkopírován!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" style={{ color: '#94a3b8' }} />
                  <span className="text-sm font-medium">Kopírovat odkaz pro studenty</span>
                </>
              )}
            </button>
            
            <p className="text-xs mt-3 text-center" style={{ color: '#64748b' }}>
              Nebo: <span style={{ color: '#94a3b8' }}>{window.location.origin}{import.meta.env.BASE_URL || '/'}quiz/join</span>
            </p>
          </div>
          
          {/* Lock mode toggle */}
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #334155' }}>
            <button
              onClick={() => updateLiveSession({ isLocked: !(session?.isLocked ?? true) })}
              className="w-full flex items-center justify-between p-3 rounded-xl transition-colors"
              style={{ backgroundColor: '#334155' }}
            >
              <div className="flex items-center gap-3">
                {(session?.isLocked ?? true) ? (
                  <Lock className="w-5 h-5" style={{ color: '#94a3b8' }} />
                ) : (
                  <Unlock className="w-5 h-5" style={{ color: '#4ade80' }} />
                )}
                <div className="text-left">
                  <p className="text-sm font-medium" style={{ color: '#ffffff' }}>
                    {(session?.isLocked ?? true) ? 'Zamčený mód' : 'Odemčený mód'}
                  </p>
                  <p className="text-xs" style={{ color: '#64748b' }}>
                    {(session?.isLocked ?? true) ? 'Studenti sledují učitele' : 'Studenti se pohybují sami'}
                  </p>
                </div>
              </div>
              <div 
                className="w-12 h-7 rounded-full flex items-center transition-colors"
                style={{ 
                  backgroundColor: (session?.isLocked ?? true) ? '#475569' : '#4ade80',
                  padding: '2px'
                }}
              >
                <div 
                  className="w-6 h-6 rounded-full bg-white shadow transition-transform"
                  style={{ 
                    transform: (session?.isLocked ?? true) ? 'translateX(0)' : 'translateX(20px)'
                  }}
                />
              </div>
            </button>
          </div>
          
          {/* Students list */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2" style={{ color: '#94a3b8' }}>
                <Users className="w-4 h-4" />
                <span className="text-sm">Připojení studenti</span>
              </div>
              <span className="font-bold" style={{ color: '#ffffff' }}>{onlineStudents.length}</span>
            </div>
            
            {students.length === 0 ? (
              <div className="text-center py-8" style={{ color: '#64748b' }}>
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Čekám na studenty...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {students.map(([id, student]) => {
                  const totalSlides = quiz?.slides.length || 1;
                  const studentSlide = student.currentSlide || 0;
                  const progressPercent = ((studentSlide + 1) / totalSlides) * 100;
                  const studentResponses = student.responses || [];
                  const correctCount = studentResponses.filter(r => r.isCorrect).length;
                  const wrongCount = studentResponses.filter(r => !r.isCorrect).length;
                  const hasFinished = studentResponses.length >= (quiz?.slides.filter(s => s.type === 'activity').length || 0);
                  const isDistracted = student.isOnline && student.isFocused === false;
                  
                  // Get student's answer for current slide (in locked mode)
                  const currentSlideData = quiz?.slides[currentSlideIndex];
                  const currentSlideResponse = studentResponses.find(r => r.slideId === currentSlideData?.id);
                  let answerLabel = '';
                  let answerColor = '#7C3AED'; // default purple
                  
                  if (currentSlideData?.type === 'activity') {
                    const activityType = (currentSlideData as any).activityType;
                    
                    if (activityType === 'abc' && currentSlideResponse) {
                      // Find the option label (A, B, C, D)
                      const optionIndex = (currentSlideData as any).options?.findIndex((o: any) => o.id === currentSlideResponse.answer);
                      if (optionIndex >= 0) {
                        answerLabel = String.fromCharCode(65 + optionIndex); // A, B, C, D...
                      }
                    } else if (activityType === 'open' && currentSlideResponse) {
                      answerLabel = String(currentSlideResponse.answer).substring(0, 10) + (String(currentSlideResponse.answer).length > 10 ? '...' : '');
                    } else if (activityType === 'voting') {
                      // Check voting data for this student
                      const studentVote = voting.votes[id];
                      if (studentVote && studentVote.selectedOptions?.length > 0) {
                        // Find option labels
                        const votedOptions = studentVote.selectedOptions.map(optId => {
                          const optIndex = (currentSlideData as any).options?.findIndex((o: any) => o.id === optId);
                          return optIndex >= 0 ? String.fromCharCode(65 + optIndex) : '?';
                        });
                        answerLabel = votedOptions.join(', ');
                        answerColor = '#0ea5e9'; // sky blue for voting
                      }
                    } else if (activityType === 'board') {
                      // Count posts from this student
                      const studentPosts = boardPosts.posts.filter(p => p.authorId === id);
                      if (studentPosts.length > 0) {
                        const lastPost = studentPosts[studentPosts.length - 1];
                        // Show post count and preview
                        answerLabel = `${studentPosts.length}× ${lastPost.text?.substring(0, 8) || ''}${(lastPost.text?.length || 0) > 8 ? '...' : ''}`;
                        answerColor = '#10b981'; // green for board posts
                      }
                    }
                  }
                  
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-3 p-3 rounded-lg transition-colors"
                      style={{ 
                        backgroundColor: isDistracted ? 'rgba(251, 146, 60, 0.2)' : 'rgba(51, 65, 85, 0.5)',
                        borderLeft: isDistracted ? '3px solid #fb923c' : '3px solid transparent'
                      }}
                    >
                      {/* Online/Focus indicator */}
                      {isDistracted ? (
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#fb923c' }} />
                      ) : (
                        <div 
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: student.isOnline ? '#4ade80' : '#64748b' }}
                        />
                      )}
                      
                      {/* Name */}
                      <span 
                        className="text-sm flex-1 truncate" 
                        style={{ color: isDistracted ? '#fb923c' : '#ffffff' }}
                      >
                        {student.name}
                      </span>
                      
                      {/* Show answer in locked mode, or progress in unlocked mode */}
                      {(session?.isLocked ?? true) && currentSlideData?.type === 'activity' ? (
                        // Show student's answer for current slide
                        answerLabel ? (
                          <div 
                            className="px-2 py-1 rounded text-xs font-bold flex-shrink-0 max-w-[120px] truncate flex items-center gap-1"
                            style={{ 
                              backgroundColor: currentSlideResponse?.isCorrect === true ? '#4ade80' : 
                                             currentSlideResponse?.isCorrect === false ? '#f87171' : answerColor,
                              color: '#ffffff'
                            }}
                            title={answerLabel}
                          >
                            {(currentSlideData as any).activityType === 'voting' && <Vote className="w-3 h-3" />}
                            {(currentSlideData as any).activityType === 'board' && <MessageSquare className="w-3 h-3" />}
                            <span className="truncate">{answerLabel}</span>
                          </div>
                        ) : (
                          <span className="text-xs flex-shrink-0" style={{ color: '#64748b' }}>—</span>
                        )
                      ) : hasFinished ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-medium" style={{ color: '#4ade80' }}>{correctCount}✓</span>
                          <span className="text-xs font-medium" style={{ color: '#f87171' }}>{wrongCount}✗</span>
                        </div>
                      ) : (session?.isLocked === false) ? (
                        <div 
                          className="w-20 h-2 rounded-full overflow-hidden flex-shrink-0"
                          style={{ backgroundColor: '#1e2533' }}
                        >
                          <div 
                            className="h-full rounded-full transition-all duration-300"
                            style={{ 
                              width: `${progressPercent}%`,
                              backgroundColor: isDistracted ? '#fb923c' : (studentSlide === currentSlideIndex ? '#7C3AED' : '#475569')
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Controls */}
          <div className="p-4 space-y-2" style={{ borderTop: '1px solid #334155' }}>
            {/* Evaluate button - show in locked mode when students have answered */}
            {(session?.isLocked ?? true) && quiz?.slides[currentSlideIndex]?.type === 'activity' && (() => {
              const currentSlideData = quiz.slides[currentSlideIndex];
              const studentsWithAnswer = students.filter(([_, student]) => {
                const responses = student.responses || [];
                return responses.some(r => r.slideId === currentSlideData.id);
              });
              const hasUnevaluatedAnswers = studentsWithAnswer.some(([_, student]) => {
                const responses = student.responses || [];
                const response = responses.find(r => r.slideId === currentSlideData.id);
                // Check for null or undefined (Firebase strips undefined, so we use null)
                return response && (response.isCorrect === undefined || response.isCorrect === null);
              });
              
              if (studentsWithAnswer.length > 0) {
                return (
                  <button
                    onClick={async () => {
                      // Evaluate all student answers for current slide
                      if (!sessionId || !quiz) return;
                      
                      const slide = currentSlideData as any;
                      const correctOptionId = slide.activityType === 'abc' 
                        ? slide.options?.find((o: any) => o.isCorrect)?.id
                        : null;
                      const correctAnswers = slide.activityType === 'open'
                        ? slide.correctAnswers || []
                        : [];
                      
                      for (const [studentId, student] of students) {
                        const responses = student.responses || [];
                        const responseIndex = responses.findIndex(r => r.slideId === currentSlideData.id);
                        
                        if (responseIndex >= 0) {
                          const response = responses[responseIndex];
                          let isCorrect = false;
                          
                          if (slide.activityType === 'abc') {
                            isCorrect = response.answer === correctOptionId;
                          } else if (slide.activityType === 'open') {
                            const studentAnswer = String(response.answer).trim().toLowerCase();
                            isCorrect = correctAnswers.some((a: string) => 
                              a.trim().toLowerCase() === studentAnswer
                            );
                          }
                          
                          // Update the response in Firebase
                          const updatedResponses = [...responses];
                          updatedResponses[responseIndex] = {
                            ...response,
                            isCorrect,
                            points: isCorrect ? (slide.points || 1) : 0
                          };
                          
                          await update(ref(database, `${getSessionPath(sessionId)}/students/${studentId}`), {
                            responses: updatedResponses
                          });
                        }
                      }
                      
                      // Set showResults to true so students can see correct/incorrect
                      await update(ref(database, getSessionPath(sessionId)), {
                        showResults: true
                      });
                    }}
                    className="w-full py-3 rounded-lg text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                    style={{ backgroundColor: hasUnevaluatedAnswers ? '#7C3AED' : '#4ade80' }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {hasUnevaluatedAnswers ? `Vyhodnotit (${studentsWithAnswer.length})` : `Vyhodnoceno ✓`}
                  </button>
                );
              }
              return null;
            })()}
            
            <button
              className="w-full py-2 rounded-lg text-white text-sm flex items-center justify-center gap-2"
              style={{ backgroundColor: '#334155' }}
            >
              <BarChart2 className="w-4 h-4" />
              Zobrazit výsledky
            </button>
            <button
              onClick={() => setShowEndDialog(true)}
              className="w-full py-2 rounded-lg text-white text-sm flex items-center justify-center gap-2"
              style={{ backgroundColor: '#dc2626' }}
            >
              <StopCircle className="w-4 h-4" />
              Ukončit session
            </button>
          </div>
          
          {/* End session dialog */}
          {showEndDialog && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                <h3 className="text-lg font-bold text-slate-800 mb-2">Ukončit session?</h3>
                <p className="text-slate-500 text-sm mb-6">
                  Session bude ukončena a studenti budou odpojeni.
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => endLiveSession(true)}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center justify-center gap-2"
                  >
                    <BarChart2 className="w-4 h-4" />
                    Ukončit a zobrazit výsledky
                  </button>
                  <button
                    onClick={() => endLiveSession(false)}
                    className="w-full py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium"
                  >
                    Ukončit bez výsledků
                  </button>
                  <button
                    onClick={() => setShowEndDialog(false)}
                    className="w-full py-2 text-slate-500 hover:text-slate-700 text-sm"
                  >
                    Zrušit
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    // Live session settings panel
    if (showLiveSettings) {
      return (
        <div className="flex flex-col h-full" style={{ backgroundColor: '#4a5568' }}>
          {/* Header */}
          <div className="p-4">
            <button 
              onClick={() => setShowLiveSettings(false)}
              className="flex items-center gap-2 text-white/70 hover:text-white mb-4"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-white text-center mb-2">Živé promítání</h2>
            <p className="text-white/60 text-center text-sm">Nastavení relace</p>
          </div>
          
          {/* Settings form */}
          <div className="flex-1 px-6 flex flex-col overflow-y-auto">
            {/* Class selector */}
            <div className="mt-4">
              <label className="text-white font-medium block mb-2">
                <Users className="w-4 h-4 inline-block mr-2" />
                Připojit třídu (volitelné)
              </label>
              {loadingClasses ? (
                <div className="text-white/50 text-sm py-3">Načítám třídy...</div>
              ) : availableClasses.length === 0 ? (
                <div className="text-white/50 text-sm py-3">Žádné třídy k dispozici</div>
              ) : (
                <select
                  value={selectedClassId || ''}
                  onChange={(e) => setSelectedClassId(e.target.value || null)}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 outline-none"
                >
                  <option value="" className="text-slate-800">Bez třídy (veřejná relace)</option>
                  {availableClasses.map(cls => (
                    <option key={cls.id} value={cls.id} className="text-slate-800">
                      {cls.name}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-white/50 text-xs pl-1 pt-2 pb-3">
                Připojením třídy budou výsledky automaticky přiřazeny studentům.
              </p>
            </div>
            
            {/* Toggle settings */}
            <div className="space-y-1 mt-4">
              <ToggleSwitch
                enabled={liveShowSolutionHints}
                onChange={setLiveShowSolutionHints}
                label="Zobrazit řešení a nápovědu"
              />
              <p className="text-white/50 text-xs pl-1 pb-3">
                Při špatné odpovědi se ukáže správná odpověď. Pokud má otázka nápovědu, zobrazí se tlačítko.
              </p>
            </div>
            
            {/* Start button */}
            <div className="mt-auto pb-6">
              <button
                onClick={() => {
                  setShowLiveSettings(false);
                  startLiveSession();
                }}
                disabled={isStartingSession}
                className="w-full py-5 rounded-xl font-bold text-xl transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#e8f84a', color: '#1e293b' }}
              >
                {isStartingSession ? 'Spouštím...' : 'Spustit promítání'}
              </button>
            </div>
          </div>
        </div>
      );
    }
    
    // Share settings panel
    if (showShareSettings) {
      return (
        <div className="flex flex-col h-full" style={{ backgroundColor: '#4a5568' }}>
          {/* Header */}
          <div className="p-4">
            <button 
              onClick={() => {
                setShowShareSettings(false);
                setShareLink(null);
              }}
              className="flex items-center gap-2 text-white/70 hover:text-white mb-4"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-white text-center mb-6">Nastavení</h2>
          </div>
          
          {shareLink ? (
            // Show generated link
            <div className="flex-1 px-6 flex flex-col">
              <div className="bg-white/10 rounded-xl p-4 mb-4">
                <p className="text-sm text-slate-300 mb-2">Odkaz pro studenty:</p>
                <p className="text-white font-mono text-sm break-all">{shareLink}</p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareLink);
                }}
                className="w-full py-4 rounded-xl bg-emerald-400 text-slate-900 font-bold text-lg hover:bg-emerald-300 transition-colors mb-4"
              >
                Kopírovat odkaz
              </button>
              <button
                onClick={() => setShareLink(null)}
                className="w-full py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
              >
                Upravit nastavení
              </button>
            </div>
          ) : (
            // Show settings form
            <div className="flex-1 px-6 flex flex-col">
              {/* Session name */}
              <div className="mb-6">
                <label className="text-white font-medium mb-2 block">Jméno relace</label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-emerald-400"
                  placeholder="Nová relace"
                />
              </div>
              
              {/* Toggle settings */}
              <div className="space-y-1">
                <ToggleSwitch
                  enabled={anonymousAccess}
                  onChange={setAnonymousAccess}
                  label="Anonymní přístup (bez jména)"
                />
                <ToggleSwitch
                  enabled={showSolutionHints}
                  onChange={setShowSolutionHints}
                  label="Ověřit řešení a zobrazit nápovědu"
                />
                <ToggleSwitch
                  enabled={showActivityResults}
                  onChange={setShowActivityResults}
                  label="Zobrazovat vyhodnocení aktivit"
                />
                <ToggleSwitch
                  enabled={requireAnswerToProgress}
                  onChange={setRequireAnswerToProgress}
                  label="Vyžadovat odpověď pro posunutí"
                />
                <ToggleSwitch
                  enabled={showNotes}
                  onChange={setShowNotes}
                  label="Zobrazit poznámky"
                />
              </div>
              
              {/* Start sharing button */}
              <div className="mt-auto pb-6">
                <button
                  onClick={handleStartSharing}
                  className="w-full py-5 rounded-xl bg-emerald-400 text-slate-900 font-bold text-xl hover:bg-emerald-300 transition-colors"
                >
                  Zahájit sdílení
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    // Student connection options panel
    if (showStudentOptions) {
      return (
        <div className="flex flex-col h-full text-white" style={{ backgroundColor: '#1e2533' }}>
          {/* Back button and title */}
          <div className="p-6">
            <button 
              onClick={() => setShowStudentOptions(false)}
              className="flex items-center gap-2 text-white/70 hover:text-white mb-6"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-white text-center">
              Vyberte, jakým způsobem<br />zapojit studenty:
            </h2>
          </div>
          
          {/* Options */}
          <div className="flex-1 px-6 space-y-4">
            {/* Live projection - show settings first */}
            <button 
              onClick={() => setShowLiveSettings(true)}
              className="w-full flex items-center gap-4 p-5 rounded-2xl transition-colors"
              style={{ backgroundColor: '#e8f84a' }}
            >
              <div className="w-14 h-14 flex items-center justify-center">
                <svg viewBox="0 0 64 64" className="w-full h-full">
                  <circle cx="32" cy="20" r="10" fill="#4E5871" opacity="0.3" />
                  <circle cx="18" cy="38" r="8" fill="#4E5871" opacity="0.5" />
                  <circle cx="46" cy="38" r="8" fill="#4E5871" opacity="0.5" />
                  <circle cx="32" cy="48" r="8" fill="#4E5871" />
                  <rect x="26" y="10" width="12" height="10" rx="2" fill="#4E5871" />
                  <polygon points="32,6 38,12 26,12" fill="#4E5871" />
                </svg>
              </div>
              <div className="text-left">
                <span className="text-lg font-bold text-slate-800 block">Živé promítání</span>
                <span className="text-sm text-slate-600">Studenti sledují společně</span>
              </div>
            </button>
            
            {/* Share / Assign task */}
            <button 
              onClick={() => setShowShareSettings(true)}
              className="w-full flex items-center gap-4 p-5 rounded-2xl transition-colors"
              style={{ backgroundColor: '#b5d4ff' }}
            >
              <div className="w-14 h-14 flex items-center justify-center">
                <Share2 className="w-10 h-10 text-slate-800" />
              </div>
              <div className="text-left">
                <span className="text-lg font-bold text-slate-800 block">Sdílet (Zadat úkol)</span>
                <span className="text-sm text-slate-600">Studenti pracují samostatně</span>
              </div>
            </button>
          </div>
          
          {/* Cancel button */}
          <div className="p-6">
            <button 
              onClick={() => setShowStudentOptions(false)}
              className="w-full py-4 rounded-xl text-white/70 font-medium hover:text-white hover:bg-white/10 transition-colors"
            >
              Zrušit
            </button>
          </div>
        </div>
      );
    }
    
    // Default panel - main actions
    return (
      <div className="flex flex-col h-full text-white" style={{ backgroundColor: '#1e2533' }}>
        {/* Header */}
        <div className="p-6 text-center border-b border-white/10">
          <span className="text-xs text-slate-400 uppercase tracking-wide">Procvičování</span>
          <h2 className="text-xl font-bold mt-1 truncate text-white">{quiz.title || 'bez názvu'}</h2>
        </div>
        
        {/* Main actions */}
        <div className="flex-1 p-4 flex flex-col">
          {/* Connect students - primary */}
          <button 
            onClick={() => setShowStudentOptions(true)}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-xl font-semibold hover:opacity-90 transition-colors mb-3"
            style={{ backgroundColor: '#4eebc0', color: '#4E5871' }}
          >
            <div className="w-12 h-12 flex items-center justify-center">
              <svg viewBox="0 0 48 48" className="w-full h-full">
                <circle cx="24" cy="14" r="8" fill="currentColor" opacity="0.3" />
                <circle cx="12" cy="26" r="6" fill="currentColor" opacity="0.5" />
                <circle cx="36" cy="26" r="6" fill="currentColor" opacity="0.5" />
                <circle cx="24" cy="34" r="6" fill="currentColor" />
                <rect x="20" y="6" width="8" height="8" rx="2" fill="currentColor" />
                <polygon points="24,4 28,8 20,8" fill="currentColor" />
              </svg>
            </div>
            <span>Připojit studenty</span>
          </button>
          
          {/* Edit */}
          <button 
            onClick={() => navigate(`/quiz/edit/${quiz.id}`)}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-xl text-white font-medium hover:bg-white/20 transition-colors mb-3"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <Edit3 className="w-6 h-6 text-slate-400" />
            <span>Upravit</span>
          </button>
          
          {/* Results */}
          <button 
            onClick={() => navigate(`/quiz/edit/${quiz.id}?tab=results`)}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-xl text-white font-medium hover:bg-white/20 transition-colors mb-3"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <BarChart2 className="w-6 h-6 text-slate-400" />
            <span>Výsledky</span>
          </button>
          
          {/* Copy to my content */}
          <button 
            onClick={() => {
              if (!quiz) return;
              // Create a duplicate with new ID
              const newQuiz = {
                ...quiz,
                id: crypto.randomUUID(),
                title: `${quiz.title || 'Board'} (kopie)`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              saveQuiz(newQuiz);
              // Navigate to the new board in editor
              navigate(`/quiz/edit/${newQuiz.id}`);
            }}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-xl text-white font-medium hover:bg-white/20 transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <Copy className="w-6 h-6 text-slate-400" />
            <span>Kopírovat k sobě</span>
          </button>
          
          {/* Spacer */}
          <div className="flex-1" />
          
          {/* Secondary actions */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <button 
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-slate-300 font-medium hover:bg-slate-600/50 transition-colors"
              style={{ backgroundColor: 'rgba(71,85,105,0.5)' }}
            >
              <Printer className="w-4 h-4" />
              <span className="text-sm">Tisknout</span>
            </button>
            <button 
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-slate-300 font-medium hover:bg-slate-600/50 transition-colors"
              style={{ backgroundColor: 'rgba(71,85,105,0.5)' }}
            >
              <Share2 className="w-4 h-4" />
              <span className="text-sm">Sdílet</span>
            </button>
          </div>
          
          {/* Share edit link */}
          <button 
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-slate-300 font-medium hover:bg-slate-600/50 transition-colors mt-3"
            style={{ backgroundColor: 'rgba(71,85,105,0.5)' }}
          >
            <ExternalLink className="w-4 h-4" />
            <span className="text-sm">Sdílet odkaz pro úpravu</span>
          </button>
        </div>
      </div>
    );
  };
  
  // Render progress bar segments
  const renderProgressBar = () => (
    <>
      {/* Completed slides - one merged segment */}
      {currentSlideIndex >= 0 && (
        <div
          className="rounded-full cursor-pointer hover:opacity-80"
          style={{ 
            height: '8px',
            backgroundColor: isDarkMode ? '#94a3b8' : '#475569',
            flex: currentSlideIndex + 1
          }}
          onClick={() => {
            if (!isAnimating && currentSlideIndex > 0) {
              setIsAnimating(true);
              setPrevSlideIndex(currentSlideIndex);
              setCurrentSlideIndex(0);
              setTimeout(() => setIsAnimating(false), 400);
            }
          }}
        />
      )}
      {/* Remaining slides - individual segments */}
      {quiz.slides.slice(currentSlideIndex + 1).map((_, idx) => {
        const actualIndex = currentSlideIndex + 1 + idx;
        return (
          <div
            key={actualIndex}
            onClick={() => {
              if (!isAnimating) {
                setIsAnimating(true);
                setPrevSlideIndex(currentSlideIndex);
                setCurrentSlideIndex(actualIndex);
                setTimeout(() => setIsAnimating(false), 400);
              }
            }}
            className="flex-1 rounded-full cursor-pointer hover:opacity-80"
            style={{ 
              height: '8px',
              backgroundColor: isDarkMode ? '#334155' : '#CBD5E1'
            }}
          />
        );
      })}
    </>
  );
  
  // ============================================
  // RENDER SLIDE VIEW (inside component for access to boardPosts and profile)
  // ============================================
  
  const renderSlideView = (slide: QuizSlide): React.ReactNode => {
    switch (slide.type) {
      case 'info':
        return <InfoSlideView slide={slide as InfoSlide} />;
      case 'activity':
        switch ((slide as any).activityType) {
          case 'abc':
            return (
              <ABCSlideView 
                slide={slide as ABCActivitySlide} 
                showHint={false}
                showSolution={false}
              />
            );
          case 'open':
            return <OpenSlideView slide={slide as OpenActivitySlide} />;
          case 'example':
            return <ExampleSlideView slide={slide as ExampleActivitySlide} />;
          case 'board':
            return (
              <BoardSlideView 
                slide={slide as BoardActivitySlide}
                posts={boardPosts.posts}
                currentUserId={profile?.id}
                currentUserName={profile?.name}
                isTeacher={true}
                onDeletePost={boardPosts.deletePost}
                readOnly={false}
              />
            );
          case 'voting':
            return (
              <VotingSlideView 
                slide={slide as VotingActivitySlide}
                isTeacher={true}
                voteCounts={voting.getVoteCounts()}
                totalVoters={voting.getTotalVotes()}
                readOnly={true}
              />
            );
          case 'connect-pairs':
            return (
              <ConnectPairsView 
                slide={slide as ConnectPairsActivitySlide}
                isTeacher={true}
                readOnly={true}
              />
            );
          case 'fill-blanks':
            return (
              <FillBlanksView 
                slide={slide as FillBlanksActivitySlide}
                isTeacher={true}
                readOnly={true}
              />
            );
          case 'image-hotspots':
            return (
              <ImageHotspotsView 
                slide={slide as ImageHotspotsActivitySlide}
                isTeacher={true}
                readOnly={true}
              />
            );
          case 'video-quiz':
            return (
              <VideoQuizView 
                slide={slide as VideoQuizActivitySlide}
                isTeacher={true}
                readOnly={true}
              />
            );
          default:
            return <div className="text-slate-500 text-center">Nepodporovaný typ aktivity</div>;
        }
      default:
        return <div className="text-slate-500 text-center">Nepodporovaný typ slidu</div>;
    }
  };

  // Background color based on session state
  const bgColor = sessionId ? '#1e2533' : '#F0F1F8';
  const isDarkMode = !!sessionId;
  
  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: bgColor }}>
      {/* Main content area */}
      <div className="flex-1 flex flex-col relative">
        {/* Desktop: Top bar with X and panel toggle */}
        <div className="hidden lg:flex absolute top-0 left-0 right-0 z-20 items-center justify-between px-4 py-3">
          {/* Close button */}
          <button
            onClick={() => navigate(-1)}
            className={`w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors ${
              isDarkMode 
                ? 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white' 
                : 'bg-white/80 text-slate-500 hover:bg-white hover:text-slate-700'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
          
          {/* Toggle panel button */}
          <button
            onClick={() => setShowRightPanel(!showRightPanel)}
            className={`w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors ${
              isDarkMode 
                ? 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white' 
                : 'bg-white/80 text-slate-500 hover:bg-white hover:text-slate-700'
            }`}
          >
            {showRightPanel ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
          </button>
        </div>
        
        {/* Mobile: Top navigation with arrows and progress bar */}
        <div className="flex lg:hidden items-center gap-3 px-4 py-4" style={{ backgroundColor: bgColor }}>
          {/* Left arrow */}
          <button
            onClick={goToPrevSlide}
            disabled={currentSlideIndex === 0}
            className={`
              w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0
              ${currentSlideIndex === 0 ? 'opacity-30 cursor-not-allowed' : ''}
              ${isDarkMode ? 'bg-white/10 text-white/70' : 'bg-[#CBD5E1] text-slate-600'}
            `}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          {/* Progress bar */}
          <div className="flex-1 flex items-center gap-1.5">
            {renderProgressBar()}
          </div>
          
          {/* Right arrow */}
          <button
            onClick={goToNextSlide}
            disabled={currentSlideIndex === quiz.slides.length - 1}
            className={`
              w-14 h-14 rounded-full flex items-center justify-center text-white flex-shrink-0
              ${currentSlideIndex === quiz.slides.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}
            `}
            style={{ backgroundColor: '#7C3AED' }}
          >
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
        
        {/* Main content area with arrows */}
        <div 
          className="flex-1 flex flex-col overflow-hidden" 
          style={{ 
            backgroundColor: bgColor,
            minHeight: 0,
          }}
        >
          {/* Desktop: Segmented progress bar - above slide, within 40px top margin */}
          <div 
            className="hidden lg:flex items-end justify-center flex-shrink-0"
            style={{ height: 40, paddingBottom: 8 }}
          >
            <div className="w-1/2 max-w-xl flex items-center gap-1.5">
              {renderProgressBar()}
            </div>
          </div>
          
          {/* Content with arrows - with bottom padding */}
          <div className="flex-1 flex items-stretch overflow-hidden" style={{ minHeight: 0, paddingBottom: 5 }}>
          {/* Desktop: Left arrow */}
          <div className="hidden lg:flex flex-shrink-0 items-center justify-center" style={{ width: 65 }}>
            <button
              onClick={goToPrevSlide}
              disabled={currentSlideIndex === 0}
              className={`
                w-12 h-12 rounded-full flex items-center justify-center
                transition-all duration-300 ease-out
                ${currentSlideIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:h-28 hover:rounded-full'}
                ${isDarkMode ? 'bg-white/10 text-white/70' : 'bg-[#CBD5E1] text-slate-600'}
              `}
              style={{ transitionProperty: 'height, background-color' }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
          
          {/* Slide content - fills remaining space */}
          <div 
            className="flex-1"
            style={{ 
              minHeight: 0,
              // Padding for shadow visibility
              padding: 16,
            }}
          >
            <div 
              className={`
                w-full h-full rounded-3xl shadow-2xl overflow-hidden flex flex-col
                ${currentSlide?.type !== 'info' ? 'max-w-5xl mx-auto' : ''}
                ${currentSlideIndex > prevSlideIndex && isAnimating ? 'animate-slide-in' : ''}
                ${currentSlideIndex < prevSlideIndex && isAnimating ? 'animate-slide-in-left' : ''}
              `}
              style={{ 
                backgroundColor: getSlideBackground(currentSlide),
                // Fill available space exactly - no growing beyond
                height: '100%',
              }}
              key={currentSlideIndex}
            >
              {currentSlide ? (
                <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
                  {renderSlideView(currentSlide)}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-white/70">
                  <p className="text-xl">Žádné slidy</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Desktop: Right arrow */}
          <div className="hidden lg:flex flex-shrink-0 items-center justify-center" style={{ width: 65 }}>
            <button
              onClick={goToNextSlide}
              disabled={currentSlideIndex === quiz.slides.length - 1}
              className={`
                w-12 h-12 rounded-full flex items-center justify-center text-white
                transition-all duration-300 ease-out
                ${currentSlideIndex === quiz.slides.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:h-28'}
              `}
              style={{ 
                backgroundColor: '#7C3AED',
                transitionProperty: 'height, background-color, box-shadow' 
              }}
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
          </div>
        </div>
      </div>
      
      {/* Right panel - dark background */}
      <div 
        className={`
          hidden lg:flex text-white flex-col transition-all duration-300 ease-out
          ${showRightPanel ? 'w-80' : 'w-0'}
        `}
        style={{ backgroundColor: '#1e2533' }}
      >
        {showRightPanel && renderRightPanel()}
      </div>
    </div>
  );
}

export default QuizViewPage;
