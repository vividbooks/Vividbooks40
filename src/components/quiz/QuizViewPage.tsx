/**
 * Quiz View Page
 * 
 * Display quiz/board with slide navigation and action panel
 * Based on Vividboard design from screenshot
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, type NavigateFunction } from 'react-router-dom';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  HelpCircle,
  Lightbulb,
  CheckCircle,
  XCircle,
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
  RefreshCw,
  Lock,
  Unlock,
  AlertTriangle,
  MessageSquare,
  Vote,
  Swords,
  Crosshair,
  Settings,
} from 'lucide-react';
import { useDeviceDetect } from '../../hooks/useDeviceDetect';
import { Quiz, QuizSlide, ABCActivitySlide, OpenActivitySlide, ExampleActivitySlide, BoardActivitySlide, VotingActivitySlide, ConnectPairsActivitySlide, FillBlanksActivitySlide, ImageHotspotsActivitySlide, VideoQuizActivitySlide, InfoSlide, LiveQuizSession, SlideResponse, ToolsSlide } from '../../types/quiz';
import { BoardSlideView } from './slides/BoardSlideView';
import { VotingSlideView } from './slides/VotingSlideView';
import { ConnectPairsView } from './slides/ConnectPairsView';
import { FillBlanksView } from './slides/FillBlanksView';
import { ImageHotspotsView } from './slides/ImageHotspotsView';
import { VideoQuizView } from './slides/VideoQuizView';
import { FormView } from './slides/FormView';
import { CertificateView } from './slides/CertificateView';
import { FlashcardSlideView } from './slides/FlashcardSlideView';
import { useBoardPosts } from '../../hooks/useBoardPosts';
import { ShareEditDialog } from './ShareEditDialog';
import ClassroomDashboard from './ClassroomDashboard';
import CompetitionView from './CompetitionView';
import TeamCompetitionView from './TeamCompetitionView';
import DuelCompetitionView from './DuelCompetitionView';
import TacticalCompetitionView from './TacticalCompetitionView';
import { useVoting } from '../../hooks/useVoting';
import { getQuiz, saveQuiz, duplicateQuiz, moveQuizToFolder } from '../../utils/quiz-storage';
import * as storage from '../../utils/profile-storage';
import { boardToWorksheet, getConversionSummary } from '../../utils/content-converter';
import { saveWorksheet } from '../../utils/worksheet-storage';
import { MathText } from '../math/MathText';
import { ExampleActivityView } from './ExampleActivityView';
import { AutoScaleQuestion } from './AutoScaleQuestion';
import { QRCodeSVG } from 'qrcode.react';
import { BlockLayoutView } from './BlockLayoutView';
import { getClasses, ClassGroup } from '../../utils/supabase/classes';
import { supabase } from '../../utils/supabase/client';
import { projectId } from '../../utils/supabase/info';
import { OsnovaPanel, OsnovaIcon } from './OsnovaPanel';
import { NoteIcon } from './editor/NoteIcon';
import { ABCSlideView } from './slides/ABCSlideView';
import { OpenSlideView } from './slides/OpenSlideView';
import { evaluateABCAnswer } from '../../utils/abc-evaluation';
import { TeacherExampleView } from './slides/TeacherExampleView';
import { InfoSlideView } from './slides/InfoSlideView';
import {
  getPreferredSessionBackend,
  SessionBackend,
  subscribeLiveSession,
  updateLiveStudentRecord,
} from '../../utils/live-session-repository';
import { boardRoutes } from '../../features/board-v2';
import type { BoardViewEntryFlags } from '../../features/board-v2/components/views/board-view';
import { PresentationAnnotationsLayer } from '../../features/board-v2/annotations/PresentationAnnotationsLayer';
import { usePresentationAnnotations } from '../../features/board-v2/annotations/annotation-session-store';
import {
  BoardViewEndSessionDialog,
  BoardViewLiveEvaluateControls,
  BoardViewRightPanel,
  beginBoardClassroomShare,
  buildCompetitionBoardSession,
  buildBoardClassroomShareSession,
  buildBoardShareLink,
  buildBoardShareSession,
  buildLiveBoardSession,
  closeBoardEndDialog,
  closeBoardLiveSettings,
  closeBoardQrPopup,
  closeBoardShareSettings,
  closeBoardStudentOptions,
  clearBoardClassroomUnsubscribe,
  copyBoardText,
  createBoardSessionId,
  createBoardShareId,
  createBoardShareSessionRecord,
  finishBoardLiveSession,
  generateBoardSessionCode,
  getBoardTeacherIdentity,
  loadBoardViewQuiz,
  navigateToBoardLibrary,
  openBoardEndDialog,
  openBoardLiveSettings,
  openBoardQrPopup,
  openBoardShareSettings,
  openBoardShareEditDialog,
  openBoardStudentOptions,
  patchBoardLiveSession,
  printBoardWorksheet,
  storeBoardClassroomUnsubscribe,
  startBoardLiveSession,
  subscribeToBoardClassroomShare,
  toggleBoardOsnovaPanel,
  toggleBoardRightPanel,
} from '../../features/board-v2/components/views/board-view';

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

function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================
// MAIN COMPONENT
// ============================================

interface QuizViewPageProps {
  boardId?: string;
  queryParams?: URLSearchParams;
  navigateOverride?: NavigateFunction;
  entryFlags?: BoardViewEntryFlags;
  persistence?: {
    loadBoardLocal: (boardId: string) => Quiz | null;
    loadBoardAsync: (boardId: string) => Promise<Quiz | null>;
    saveBoard: (quiz: Quiz) => void;
  };
  routes?: Pick<typeof boardRoutes, 'edit' | 'present' | 'results' | 'student'>;
}

const TEACHER_EVALUATABLE_ACTIVITY_TYPES = new Set([
  'abc',
  'example',
  'true-false',
  'trueFalse',
  'connect-pairs',
  'fill-blanks',
  'image-hotspots',
  'video-quiz',
]);

export function QuizViewPage({
  boardId,
  queryParams,
  navigateOverride,
  entryFlags,
  persistence,
  routes = boardRoutes,
}: QuizViewPageProps = {}) {
  const { id: routedId } = useParams<{ id: string }>();
  const navigateFromRouter = useNavigate();
  const [searchParamsFromRouter] = useSearchParams();
  const id = boardId ?? routedId;
  const navigate = navigateOverride ?? navigateFromRouter;
  const searchParams = queryParams ?? searchParamsFromRouter;
  
  // Topic and subject from URL params (for folder structure when copying)
  const resolvedEntryFlags = entryFlags ?? {
    topicSlug: searchParams.get('topic') || '',
    subjectSlug: searchParams.get('subject') || 'fyzika',
  };
  const topicSlug = resolvedEntryFlags.topicSlug;
  const subjectSlug = resolvedEntryFlags.subjectSlug;
  const viewPersistence = useMemo(() => (
    persistence ?? {
      loadBoardLocal: getQuiz,
      loadBoardAsync: async (boardId: string) => getQuiz(boardId),
      saveBoard: saveQuiz,
    }
  ), [persistence]);
  
  // State
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [prevSlideIndex, setPrevSlideIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showStudentOptions, setShowStudentOptions] = useState(false);
  const [hoveredStudentOption, setHoveredStudentOption] = useState<string | null>(null);
  const [showCompetitionPicker, setShowCompetitionPicker] = useState(false);
  const [showShareSettings, setShowShareSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showOsnovaPanel, setShowOsnovaPanel] = useState(false);
  const [showNotePanel, setShowNotePanel] = useState(false);
  const [osnovaWidth, setOsnovaWidth] = useState(300);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => (
    typeof window === 'undefined' ? true : window.innerWidth >= 1024
  ));
  const osnovaSidebarRef = React.useRef<HTMLDivElement>(null);
  
  // Device detection
  const { isMobile, isTablet, isTouchDevice } = useDeviceDetect();
  const isMobileOrTablet = isMobile || isTablet;
  
  useEffect(() => {
    const handleResize = () => setIsDesktopViewport(window.innerWidth >= 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Live session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [session, setSession] = useState<LiveQuizSession | null>(null);
  const [sessionBackend, setSessionBackend] = useState<SessionBackend>(getPreferredSessionBackend());
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showLiveSettings, setShowLiveSettings] = useState(false);
  const [showQRPopup, setShowQRPopup] = useState<'qr' | 'code' | null>(null);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [formPreviewAnswer, setFormPreviewAnswer] = useState<Record<string, string | string[]>>({});
  
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
  
  // Classroom mode state
  const [classroomShareId, setClassroomShareId] = useState<string | null>(null);
  const [classroomShareCode, setClassroomShareCode] = useState<string | null>(null);
  const [classroomShareLink, setClassroomShareLink] = useState<string | null>(null);
  const [classroomStudents, setClassroomStudents] = useState<Record<string, any>>({});
  const [classroomStarted, setClassroomStarted] = useState(false);
  const [classroomShareBackend, setClassroomShareBackend] = useState<SessionBackend>(getPreferredSessionBackend());
  
  // Competition mode
  const [competitionActive, setCompetitionActive] = useState(false);
  const [teamCompetitionActive, setTeamCompetitionActive] = useState(false);
  const [duelCompetitionActive, setDuelCompetitionActive] = useState(false);
  const [tacticalCompetitionActive, setTacticalCompetitionActive] = useState(false);
  
  // Share edit dialog
  const [showShareEditDialog, setShowShareEditDialog] = useState(false);
  const annotations = usePresentationAnnotations();
  const annotationDockHeight = annotations.toolbarOpen && isDesktopViewport ? 60 : 0;
  
  // Get current user
  const profile = storage.getCurrentUserProfile();
  const currentUserId = profile?.userId || profile?.id;
  const currentUserName = (profile as any)?.firstName || profile?.name;
  
  // Check ownership - user owns the board if they created it OR if it's a system board (no createdBy)
  // System boards (from library) should show "Copy and Edit" for all users
  const isSystemBoard = quiz?.id?.startsWith('board_') && !quiz?.createdBy;
  const isOwner = quiz?.createdBy === profile?.userId;
  const canDirectEdit = isOwner || (!isSystemBoard && !quiz?.createdBy); // Only own boards can be directly edited
  
  // Current slide for board posts hook (must be called unconditionally)
  const currentSlideForBoard = quiz?.slides?.[currentSlideIndex];
  
  // Board posts for current slide (if it's a board activity)
  // Must be called before any early returns to satisfy React hooks rules
  const boardPosts = useBoardPosts({
    sessionId: sessionId,
    slideId: currentSlideForBoard?.id || '',
    currentUserId,
    currentUserName,
    sessionType: 'live',
    backend: sessionBackend,
  });
  
  // Voting for current slide (if it's a voting activity)
  const voting = useVoting({
    sessionId: sessionId,
    slideId: currentSlideForBoard?.id || '',
    currentUserId,
    currentUserName,
    sessionType: 'live',
    backend: sessionBackend,
  });
  
  // Load quiz
  // Re-read quiz from localStorage when thumbnails are updated in the background
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ quizId: string }>).detail;
      if (detail?.quizId !== id) return;
      const fresh = viewPersistence.loadBoardLocal(id);
      if (fresh) setQuiz(fresh);
    };
    window.addEventListener('quiz-thumbnails-updated', handler);
    return () => window.removeEventListener('quiz-thumbnails-updated', handler);
  }, [id, viewPersistence]);

  useEffect(() => {
    if (!id) {
      console.log('[QuizViewPage] No ID provided');
      setLoading(false);
      return;
    }
    
    const fetchFromSupabase = async () => {
      try {
        const result = await loadBoardViewQuiz({
          boardId: id,
          persistence: viewPersistence,
          supabase,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          projectId,
        });

        setQuiz(result.quiz);
        setLoading(false);
      } catch (err) {
        console.error(`[QuizViewPage] Error fetching from Supabase:`, err);
        setLoading(false);
      }
    };
    
    fetchFromSupabase();
  }, [id, viewPersistence]);
  
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

  // Re-read quiz from localStorage when thumbnails are updated in the background
  useEffect(() => {
    const handleThumbnailsUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ quizId: string }>).detail;
      if (!quiz || detail?.quizId !== quiz.id) return;
      const fresh = viewPersistence.loadBoardLocal(quiz.id);
      if (fresh?.worksheetMap) {
        setQuiz((prev) => prev ? { ...prev, worksheetMap: fresh.worksheetMap } : prev);
      }
    };
    window.addEventListener('quiz-thumbnails-updated', handleThumbnailsUpdated);
    return () => window.removeEventListener('quiz-thumbnails-updated', handleThumbnailsUpdated);
  }, [quiz?.id, viewPersistence]);
  
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
    
    const code = generateBoardSessionCode();
    const newSessionId = createBoardSessionId(code);
    const sessionData = buildLiveBoardSession({
      quiz,
      code,
      sessionId: newSessionId,
      teacher: getBoardTeacherIdentity(profile),
      currentSlideIndex,
      showSolutionHints: liveShowSolutionHints,
    });
    
    try {
      const backend = await startBoardLiveSession({ quiz, session: sessionData });
      setSessionBackend(backend);
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
  
  // Start competition session
  const startCompetition = useCallback(async () => {
    if (isStartingSession || !quiz) return;
    setIsStartingSession(true);
    
    const code = generateBoardSessionCode();
    const newSessionId = createBoardSessionId(code);
    const sessionData = buildCompetitionBoardSession({
      quiz,
      code,
      sessionId: newSessionId,
      teacher: getBoardTeacherIdentity(profile),
      mode: 'competition',
    });
    
    try {
      const backend = await startBoardLiveSession({ quiz, session: sessionData });
      setSessionBackend(backend);
      setSessionId(newSessionId);
      setSessionCode(code);
      setSession(sessionData);
      setCompetitionActive(true);
      setShowStudentOptions(false);
    } catch (error) {
      console.error('Failed to start competition:', error);
    } finally {
      setIsStartingSession(false);
    }
  }, [quiz, profile, isStartingSession]);
  
  // End competition
  const endCompetition = useCallback(() => {
    if (sessionId) {
      finishBoardLiveSession({ backend: sessionBackend, sessionId });
    }
    setCompetitionActive(false);
    setSessionId(null);
    setSessionCode(null);
    setSession(null);
  }, [sessionBackend, sessionId]);

  // Start team competition session
  const startTeamCompetition = useCallback(async () => {
    if (isStartingSession || !quiz) return;
    setIsStartingSession(true);

    const code = generateBoardSessionCode();
    const newSessionId = createBoardSessionId(code);
    const sessionData = buildCompetitionBoardSession({
      quiz,
      code,
      sessionId: newSessionId,
      teacher: getBoardTeacherIdentity(profile),
      mode: 'team-competition',
    });

    const backend = await startBoardLiveSession({ quiz, session: sessionData });
    setSessionBackend(backend);
    setSessionId(newSessionId);
    setSessionCode(code);
    setSession(sessionData);
    setTeamCompetitionActive(true);
    setIsStartingSession(false);
  }, [quiz, profile, isStartingSession]);

  // End team competition
  const endTeamCompetition = useCallback(() => {
    if (sessionId) {
      finishBoardLiveSession({ backend: sessionBackend, sessionId });
    }
    setTeamCompetitionActive(false);
    setSessionId(null);
    setSessionCode(null);
    setSession(null);
  }, [sessionBackend, sessionId]);

  // Start duel competition
  const startDuelCompetition = useCallback(async () => {
    if (isStartingSession || !quiz) return;
    setIsStartingSession(true);

    const code = generateBoardSessionCode();
    const newSessionId = createBoardSessionId(code);
    const sessionData = buildCompetitionBoardSession({
      quiz,
      code,
      sessionId: newSessionId,
      teacher: getBoardTeacherIdentity(profile),
      mode: 'duel-competition',
    });

    const backend = await startBoardLiveSession({ quiz, session: sessionData });
    setSessionBackend(backend);
    setSessionId(newSessionId);
    setSessionCode(code);
    setSession(sessionData);
    setDuelCompetitionActive(true);
    setIsStartingSession(false);
  }, [quiz, profile, isStartingSession]);

  // End duel competition
  const endDuelCompetition = useCallback(() => {
    if (sessionId) {
      finishBoardLiveSession({ backend: sessionBackend, sessionId });
    }
    setDuelCompetitionActive(false);
    setSessionId(null);
    setSessionCode(null);
    setSession(null);
  }, [sessionBackend, sessionId]);

  // Start tactical competition
  const startTacticalCompetition = useCallback(async () => {
    if (isStartingSession || !quiz) return;
    setIsStartingSession(true);

    const code = generateBoardSessionCode();
    const newSessionId = createBoardSessionId(code);
    const sessionData = buildCompetitionBoardSession({
      quiz,
      code,
      sessionId: newSessionId,
      teacher: getBoardTeacherIdentity(profile),
      mode: 'tactical-competition',
    });

    const backend = await startBoardLiveSession({ quiz, session: sessionData });
    setSessionBackend(backend);
    setSessionId(newSessionId);
    setSessionCode(code);
    setSession(sessionData);
    setTacticalCompetitionActive(true);
    setIsStartingSession(false);
  }, [quiz, profile, isStartingSession]);

  // End tactical competition
  const endTacticalCompetition = useCallback(() => {
    if (sessionId) {
      finishBoardLiveSession({ backend: sessionBackend, sessionId });
    }
    setTacticalCompetitionActive(false);
    setSessionId(null);
    setSessionCode(null);
    setSession(null);
  }, [sessionBackend, sessionId]);
  
  // Listen to session updates
  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = subscribeLiveSession(sessionBackend, sessionId, (data) => {
      setSession(data as LiveQuizSession);
    });

    return () => unsubscribe();
  }, [sessionBackend, sessionId]);
  
  // Sync slide index to session and reset showResults for new slide
  useEffect(() => {
    if (sessionId && session?.isActive) {
      patchBoardLiveSession({
        backend: sessionBackend,
        sessionId,
        updates: {
        currentSlideIndex,
        showResults: false // Reset so students don't see results until teacher evaluates
        },
      });
    }
  }, [sessionBackend, sessionId, currentSlideIndex, session?.isActive]);
  
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
      await finishBoardLiveSession({ backend: sessionBackend, sessionId });
      
      if (viewResults) {
        navigate(routes.results(sessionId));
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
      copyToClipboard(sessionCode);
    }
  };
  
  // Update live session
  const updateLiveSession = async (updates: Partial<LiveQuizSession>) => {
    if (sessionId) {
      await patchBoardLiveSession({
        backend: sessionBackend,
        sessionId,
        updates,
      });
    }
  };
  
  // Get student stats
  const students = session?.students ? Object.entries(session.students) : [];
  const onlineStudents = students.filter(([_, s]) => s.isOnline);

  const currentSlide = quiz?.slides[currentSlideIndex];
  const progress = quiz && quiz.slides.length > 0
    ? ((currentSlideIndex + 1) / quiz.slides.length) * 100
    : 0;

  useEffect(() => {
    if (showNotePanel && !String((currentSlide as any)?.note || '').trim()) {
      setShowNotePanel(false);
    }
  }, [currentSlide, showNotePanel]);
  
  const getSlideBackground = (slide: QuizSlide) => {
    return slide?.backgroundColor || '#ffffff';
  };
  
  // Convert to worksheet and open print
  const handlePrint = () => {
    printBoardWorksheet({
      quiz,
      createWorksheetFromBoard: boardToWorksheet,
      saveWorksheet,
      navigate,
    });
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
    const shareId = createBoardShareId(shareCode);
    const shareData = buildBoardShareSession({
      shareId,
      shareCode,
      quiz,
      sessionName,
      settings: {
        anonymousAccess,
        showSolutionHints,
        showActivityResults,
        requireAnswerToProgress,
        showNotes,
      },
      createdBy: profile?.userId || 'anonymous',
    });
    
    try {
      const backend = await createBoardShareSessionRecord(shareData);
      setClassroomShareBackend(backend);
      
      const baseUrl = import.meta.env.BASE_URL || '/';
      const link = buildBoardShareLink({
        shareId,
        studentRoute: routes.student,
        baseUrl,
        origin: window.location.origin,
      });
      setShareLink(link);
    } catch (error) {
      console.error('Error creating share session:', error);
    }
  };
  
  // Start classroom session (Zadat ve výuce)
  const startClassroomSession = async () => {
    const shareCode = generateShareCode();
    const shareId = createBoardShareId(shareCode);
    const shareData = buildBoardClassroomShareSession({
      shareId,
      shareCode,
      quiz,
      createdBy: profile?.userId || 'anonymous',
    });
    
    try {
      const backend = await createBoardShareSessionRecord(shareData);
      
      const baseUrl = import.meta.env.BASE_URL || '/';
      const link = buildBoardShareLink({
        shareId,
        studentRoute: routes.student,
        baseUrl,
        origin: window.location.origin,
      });
      
      setClassroomShareBackend(backend);
      setClassroomShareId(shareId);
      setClassroomShareCode(shareCode);
      setClassroomShareLink(link);
      setShowStudentOptions(false);
      setShowRightPanel(true);
      
      // Subscribe to student updates in real-time
      const unsubscribe = subscribeToBoardClassroomShare({
        backend,
        shareId,
        onResponses: (responses) => {
          setClassroomStudents(responses);
        },
      });
      storeBoardClassroomUnsubscribe(unsubscribe);
    } catch (error) {
      console.error('Error creating classroom session:', error);
    }
  };
  
  // Begin classroom (teacher clicks "Zahájit" — students can now proceed)
  const beginClassroom = async () => {
    if (!classroomShareId) return;
    try {
      await beginBoardClassroomShare({
        backend: classroomShareBackend,
        shareId: classroomShareId,
      });
      setClassroomStarted(true);
    } catch (error) {
      console.error('Error starting classroom:', error);
    }
  };
  
  // End classroom session
  const endClassroomSession = (showResults = false) => {
    const endedClassroomShareId = classroomShareId;
    clearBoardClassroomUnsubscribe();
    setClassroomShareId(null);
    setClassroomShareCode(null);
    setClassroomShareLink(null);
    setClassroomStudents({});
    setClassroomStarted(false);
    closeBoardEndDialog(setShowEndDialog);

    if (showResults && endedClassroomShareId) {
      navigate(routes.results(endedClassroomShareId, { type: 'shared' }));
    }
  };

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await copyBoardText({
        text,
        onCopied: setCopied,
      });
    } catch (error) {
      console.error('Clipboard copy failed:', error);
    }
  }, []);

  const handleToggleOsnovaPanel = useCallback(() => {
    toggleBoardOsnovaPanel({
      showOsnovaPanel,
      setShowOsnovaPanel,
      setShowRightPanel,
    });
  }, [showOsnovaPanel]);

  const handleToggleRightPanel = useCallback(() => {
    toggleBoardRightPanel({
      showRightPanel,
      setShowRightPanel,
      setShowOsnovaPanel,
    });
    if (!showRightPanel) {
      setShowNotePanel(false);
    }
  }, [showRightPanel]);

  const handleOpenEndDialog = useCallback(() => {
    openBoardEndDialog(setShowEndDialog);
  }, []);

  const handleCloseEndDialog = useCallback(() => {
    closeBoardEndDialog(setShowEndDialog);
  }, []);

  const handleCloseShareSettings = useCallback(() => {
    closeBoardShareSettings({
      setShowShareSettings,
      setShareLink,
    });
  }, []);

  const handleOpenShareSettings = useCallback(() => {
    openBoardShareSettings(setShowShareSettings);
  }, []);

  const handleOpenStudentOptions = useCallback(() => {
    openBoardStudentOptions(setShowStudentOptions);
  }, []);

  const handleCloseStudentOptions = useCallback(() => {
    closeBoardStudentOptions(setShowStudentOptions);
  }, []);

  const handleOpenLiveSettings = useCallback(() => {
    openBoardLiveSettings(setShowLiveSettings);
  }, []);

  const handleCloseLiveSettings = useCallback(() => {
    closeBoardLiveSettings(setShowLiveSettings);
  }, []);

  const handleCloseQrPopup = useCallback(() => {
    closeBoardQrPopup(setShowQRPopup);
  }, []);

  const handleOpenQrPopup = useCallback((mode: 'qr' | 'code') => {
    openBoardQrPopup({
      mode,
      setShowQRPopup,
    });
  }, []);

  const handleOpenShareEditDialog = useCallback(() => {
    openBoardShareEditDialog(setShowShareEditDialog);
  }, []);

  const handleEditBoard = useCallback(() => {
    if (!quiz) return;
    navigate(routes.edit(quiz.id));
  }, [navigate, quiz, routes]);

  const handleOpenBoardResults = useCallback(() => {
    if (!quiz) return;
    navigate(routes.edit(quiz.id, { tab: 'results' }));
  }, [navigate, quiz, routes]);

  const handleCopyAndEditBoard = useCallback(() => {
    if (!quiz) return;
    const boardTitle = quiz.title || 'Board';

    const newQuizId = crypto.randomUUID();
    const newQuiz = {
      ...quiz,
      id: newQuizId,
      title: boardTitle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: profile?.userId,
    };
    saveQuiz(newQuiz);

    const FOLDER_COLORS = ['#bbf7d0', '#bfdbfe', '#fde68a', '#fecaca', '#e9d5ff', '#99f6e4', '#fed7aa', '#fca5a5'];

    const subjectMap: { [key: string]: string } = {
      fyzika: 'Fyzika',
      chemie: 'Chemie',
      prirodopis: 'Přírodopis',
      matematika: 'Matematika',
    };
    const subjectId = subjectSlug || quiz.subject || 'fyzika';
    const categoryLabel = subjectMap[subjectId] || subjectMap.fyzika;

    const topicLabelMap: { [key: string]: string } = {
      zaklady: 'Základy',
      sily: 'Síly',
      'kapaliny-a-plyny': 'Kapaliny a plyny',
      optika: 'Optika',
      energie: 'Energie',
      akustika: 'Akustika',
      'elektrina-a-magnetismus': 'Elektřina a magnetismus',
      'fyzika-mikrosveta': 'Fyzika mikrosvěta',
      vesmir: 'Vesmír',
    };
    const bookLabel = topicSlug ? (topicLabelMap[topicSlug] || topicSlug.charAt(0).toUpperCase() + topicSlug.slice(1)) : 'Základy';

    const existingFoldersJson = localStorage.getItem('vivid-my-folders');
    let existingFolders: any[] = [];
    if (existingFoldersJson) {
      try {
        existingFolders = JSON.parse(existingFoldersJson);
      } catch (error) {
        console.error('Failed to parse existing folders', error);
      }
    }

    let subjectFolder = existingFolders.find(f => f.name === categoryLabel && f.copiedFrom === 'vividbooks-category');
    if (!subjectFolder) {
      const randomColor = FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)];
      subjectFolder = {
        id: `folder-vb-${subjectId}-${Date.now()}`,
        name: categoryLabel,
        type: 'folder',
        color: randomColor,
        copiedFrom: 'vividbooks-category',
        children: [],
      };
      existingFolders.push(subjectFolder);
    }

    subjectFolder.children = subjectFolder.children || [];
    let bookFolder = subjectFolder.children.find((f: any) => f.name === bookLabel && f.type === 'folder');
    if (!bookFolder) {
      bookFolder = {
        id: `folder-vb-book-${Date.now()}`,
        name: bookLabel,
        type: 'folder',
        color: '#4eebc0',
        copiedFrom: 'vividbooks-book',
        children: [],
      };
      subjectFolder.children.push(bookFolder);
    }

    const newItem = {
      id: newQuizId,
      name: boardTitle,
      type: 'board',
      copiedFrom: 'vividbooks',
      originalId: quiz.id,
      createdAt: new Date().toISOString(),
    };

    bookFolder.children = bookFolder.children || [];
    bookFolder.children.push(newItem);

    const updatedFolders = existingFolders.map(f => (
      f.id === subjectFolder.id ? subjectFolder : f
    ));
    localStorage.setItem('vivid-my-folders', JSON.stringify(updatedFolders));

    moveQuizToFolder(newQuizId, bookFolder.id);

    sessionStorage.setItem('copied-doc-toast', JSON.stringify({
      title: boardTitle,
      path: `Můj obsah → Zkopírováno z VividBooks → ${categoryLabel} → ${bookLabel}`,
    }));

    navigate(routes.edit(newQuiz.id));
  }, [navigate, profile?.userId, quiz, routes, subjectSlug, topicSlug]);

  const handleEvaluateCurrentLiveSlide = useCallback(async () => {
    if (!sessionId || !quiz) return;

    const currentSlideData = quiz.slides[currentSlideIndex];
    const slide = currentSlideData as any;
    if (currentSlideData.type !== 'activity' || !TEACHER_EVALUATABLE_ACTIVITY_TYPES.has(slide.activityType)) {
      return;
    }

    const exampleCorrectAnswers = slide.activityType === 'example'
      ? [
          ...(slide.finalAnswer ? [slide.finalAnswer] : []),
          ...((slide.alternativeAnswers || []).filter(Boolean)),
        ]
      : [];
    const trueFalseCorrectAnswer = slide.activityType === 'true-false' || slide.activityType === 'trueFalse'
      ? String(slide.correctAnswer)
      : null;

    for (const [studentId, student] of students) {
      const responses = student.responses || [];
      const responseIndex = responses.findIndex(r => r.slideId === currentSlideData.id);

      if (responseIndex >= 0) {
        const response = responses[responseIndex];
        let isCorrect = false;

        if (slide.activityType === 'abc') {
          isCorrect = evaluateABCAnswer(slide, response.answer);
        } else if (slide.activityType === 'example') {
          const studentAnswer = String(response.answer).trim().toLowerCase();
          isCorrect = exampleCorrectAnswers.some((answer: string) => answer.trim().toLowerCase() === studentAnswer);
        } else if (slide.activityType === 'true-false' || slide.activityType === 'trueFalse') {
          isCorrect = String(response.answer) === trueFalseCorrectAnswer;
        } else if (slide.activityType === 'connect-pairs') {
          const answerMap = typeof response.answer === 'object' && !Array.isArray(response.answer) ? response.answer : {};
          const totalPairs = Array.isArray(slide.pairs) ? slide.pairs.length : 0;
          const correctPairs = (slide.pairs || []).filter((pair: any) => answerMap[pair.left.id] === pair.right.id).length;
          isCorrect = totalPairs > 0 && correctPairs === totalPairs;
        } else if (slide.activityType === 'fill-blanks') {
          const answerMap = typeof response.answer === 'object' && !Array.isArray(response.answer) ? response.answer : {};
          const blanks = (slide.sentences || []).flatMap((sentence: any) => sentence.blanks || []);
          const totalBlanks = blanks.length;
          const correctBlanks = blanks.filter((blank: any) =>
            String(answerMap[blank.id] || '').trim().toLowerCase() === String(blank.text || '').trim().toLowerCase()
          ).length;
          isCorrect = totalBlanks > 0 && correctBlanks === totalBlanks;
        } else if (slide.activityType === 'image-hotspots') {
          const answerMap = typeof response.answer === 'object' && !Array.isArray(response.answer) ? response.answer : {};
          const totalHotspots = Array.isArray(slide.hotspots) ? slide.hotspots.length : 0;
          const correctHotspots = Object.values(answerMap).filter((value) => value === 'correct').length;
          isCorrect = totalHotspots > 0 && correctHotspots === totalHotspots;
        } else if (slide.activityType === 'video-quiz') {
          const answerMap = typeof response.answer === 'object' && !Array.isArray(response.answer) ? response.answer : {};
          const totalQuestions = Array.isArray(slide.questions) ? slide.questions.length : 0;
          const correctQuestions = (slide.questions || []).filter((question: any) => {
            const correctOption = (question.options || []).find((option: any) => option.isCorrect);
            return answerMap[question.id] === correctOption?.id;
          }).length;
          isCorrect = totalQuestions > 0 && correctQuestions === totalQuestions;
        }

        let points = isCorrect ? (slide.points || 1) : 0;
        if (slide.activityType === 'connect-pairs' && slide.countAsMultiple) {
          const answerMap = typeof response.answer === 'object' && !Array.isArray(response.answer) ? response.answer : {};
          points = (slide.pairs || []).filter((pair: any) => answerMap[pair.left.id] === pair.right.id).length;
        } else if (slide.activityType === 'fill-blanks' && slide.countAsMultiple) {
          const answerMap = typeof response.answer === 'object' && !Array.isArray(response.answer) ? response.answer : {};
          const blanks = (slide.sentences || []).flatMap((sentence: any) => sentence.blanks || []);
          points = blanks.filter((blank: any) =>
            String(answerMap[blank.id] || '').trim().toLowerCase() === String(blank.text || '').trim().toLowerCase()
          ).length;
        } else if (slide.activityType === 'image-hotspots' && slide.countAsMultiple) {
          const answerMap = typeof response.answer === 'object' && !Array.isArray(response.answer) ? response.answer : {};
          points = Object.values(answerMap).filter((value) => value === 'correct').length;
        } else if (slide.activityType === 'video-quiz' && slide.countAsMultiple) {
          const answerMap = typeof response.answer === 'object' && !Array.isArray(response.answer) ? response.answer : {};
          points = (slide.questions || []).filter((question: any) => {
            const correctOption = (question.options || []).find((option: any) => option.isCorrect);
            return answerMap[question.id] === correctOption?.id;
          }).length;
        }

        const updatedResponses = [...responses];
        updatedResponses[responseIndex] = {
          ...response,
          isCorrect,
          points,
        };

        await updateLiveStudentRecord(sessionBackend, sessionId, studentId, {
          responses: updatedResponses,
        });
      }
    }

    await patchBoardLiveSession({
      backend: sessionBackend,
      sessionId,
      updates: {
        showResults: true,
      },
    });
  }, [currentSlideIndex, quiz, sessionBackend, sessionId, students]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!quiz || !currentSlide) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-100">
        <HelpCircle className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-xl font-bold text-slate-600 mb-2">Board nenalezen</h1>
        <p className="text-slate-500 mb-6">Tento board neexistuje nebo byl smazán.</p>
        <button
          onClick={() => navigateToBoardLibrary(navigate)}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Zpět do knihovny
        </button>
      </div>
    );
  }
  
  
  // Student connection options (defined at component level so overlay can access it)
  const STUDENT_OPTIONS = [
    {
      key: 'projection',
      label: 'Připojit do promítání',
      section: 'together',
      accent: '#4eebc0',
      desc: 'Studenti odpovídají na svých zařízeních, ty vidíš výsledky živě.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9">
          <rect x="2" y="3" width="20" height="13" rx="2" stroke="#4eebc0" strokeWidth="1.8"/>
          <path d="M8 21h8M12 16v5" stroke="#4eebc0" strokeWidth="1.8" strokeLinecap="round"/>
          <circle cx="8" cy="9.5" r="2" fill="#4eebc0" opacity="0.7"/>
          <path d="M13 8.5l3 2-3 2V8.5Z" fill="#4eebc0"/>
        </svg>
      ),
    },
    {
      key: 'competition',
      label: 'Zahájit soutěž',
      section: 'together',
      accent: '#fbbf24',
      desc: 'Rychlá soutěž o body a pořadí v reálném čase.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9">
          <path d="M12 2l2.4 6.4H21l-5.4 4 2.1 6.6L12 15l-5.7 4 2.1-6.6L3 8.4h6.6L12 2Z" fill="#fbbf24" opacity="0.9"/>
        </svg>
      ),
    },
    {
      key: 'present',
      label: 'Promítání bez studentů',
      section: 'together',
      accent: '#818cf8',
      desc: 'Klasická prezentace bez připojených studentů.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9">
          <rect x="2" y="3" width="20" height="13" rx="2" stroke="#818cf8" strokeWidth="1.8"/>
          <path d="M8 21h8M12 16v5" stroke="#818cf8" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M10 8.5l5 3-5 3V8.5Z" fill="#818cf8" opacity="0.9"/>
        </svg>
      ),
    },
    {
      key: 'classroom',
      label: 'Zadat ve výuce',
      section: 'solo',
      accent: '#f87171',
      desc: 'Zadání do třídy s průběžným přehledem práce žáků.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9">
          <rect x="4" y="3" width="16" height="18" rx="2" stroke="#f87171" strokeWidth="1.8"/>
          <path d="M8 8h8M8 12h8M8 16h5" stroke="#f87171" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      key: 'share',
      label: 'Sdílet obsah',
      section: 'solo',
      accent: '#60a5fa',
      desc: 'Pošli odkaz a studenti mohou pracovat samostatně kdykoli.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9">
          <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M12 3v12M8 7l4-4 4 4" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
  ];

  // Render the right panel content
  const renderRightPanel = () => {
    return (
      <BoardViewRightPanel
        classroomShareId={classroomShareId}
        classroomPanelProps={{
          classroomStarted,
          classroomStudents: classroomStudents as Record<string, { studentName?: string; isOnline?: boolean; isFocused?: boolean; completedAt?: string }>,
          classroomShareCode,
          classroomShareLink,
          copied,
          onOpenQrPopup: handleOpenQrPopup,
          onCopyLink: copyToClipboard,
          onOpenEndDialog: handleOpenEndDialog,
          showEndDialog,
          endDialog: (
            <BoardViewEndSessionDialog
              onEndAndShowResults={() => endClassroomSession(true)}
              onEndWithoutResults={() => endClassroomSession(false)}
              onCancel={handleCloseEndDialog}
            />
          ),
        }}
        sessionId={sessionId}
        sessionCode={sessionCode}
        liveSessionPanelProps={{
          session,
          sessionCode: sessionCode || '',
          showModeDropdown,
          onToggleModeDropdown: () => setShowModeDropdown(!showModeDropdown),
          onCloseModeDropdown: () => setShowModeDropdown(false),
          onSelectTeacherPresent: () => {
            updateLiveSession({ isLocked: true });
            setShowModeDropdown(false);
          },
          onSelectStudentsSelf: () => {
            updateLiveSession({ isLocked: false });
            setShowModeDropdown(false);
          },
          onStartCompetition: () => {
            startCompetition();
            setShowModeDropdown(false);
          },
          onStartTeamCompetition: () => {
            startTeamCompetition();
            setShowModeDropdown(false);
          },
          onStartDuelCompetition: () => {
            startDuelCompetition();
            setShowModeDropdown(false);
          },
          onStartTacticalCompetition: () => {
            startTacticalCompetition();
            setShowModeDropdown(false);
          },
          onOpenQrPopup: handleOpenQrPopup,
          onCopyLink: copyToClipboard,
          copied,
          students,
          onlineStudentsCount: onlineStudents.length,
          quiz,
          currentSlideIndex,
          votingVotes: voting.votes,
          boardPosts: boardPosts.posts,
          evaluateControls: (
            <BoardViewLiveEvaluateControls
              sessionLocked={session?.isLocked ?? true}
              quiz={quiz}
              currentSlideIndex={currentSlideIndex}
              students={students}
              onEvaluate={handleEvaluateCurrentLiveSlide}
            />
          ),
          onViewResults: () => {
            if (sessionId) navigate(routes.results(sessionId, { type: 'live' }));
          },
          onOpenEndDialog: handleOpenEndDialog,
          showEndDialog,
          endDialog: (
            <BoardViewEndSessionDialog
              onEndAndShowResults={() => endLiveSession(true)}
              onEndWithoutResults={() => endLiveSession(false)}
              onCancel={handleCloseEndDialog}
            />
          ),
        }}
        showLiveSettings={showLiveSettings}
        liveSettingsPanelProps={{
          loadingClasses,
          availableClasses,
          selectedClassId,
          onSelectedClassChange: setSelectedClassId,
          liveShowSolutionHints,
          onLiveShowSolutionHintsChange: setLiveShowSolutionHints,
          isStartingSession,
          onClose: handleCloseLiveSettings,
          onStart: () => {
            handleCloseLiveSettings();
            startLiveSession();
          },
          ToggleSwitchComponent: ToggleSwitch,
        }}
        showShareSettings={showShareSettings}
        shareSettingsPanelProps={{
          shareLink,
          sessionName,
          anonymousAccess,
          showSolutionHints,
          showActivityResults,
          requireAnswerToProgress,
          showNotes,
          onClose: handleCloseShareSettings,
          onCopyLink: () => shareLink && copyToClipboard(shareLink),
          onResetShareLink: () => setShareLink(null),
          onSessionNameChange: setSessionName,
          onAnonymousAccessChange: setAnonymousAccess,
          onShowSolutionHintsChange: setShowSolutionHints,
          onShowActivityResultsChange: setShowActivityResults,
          onRequireAnswerToProgressChange: setRequireAnswerToProgress,
          onShowNotesChange: setShowNotes,
          onStartSharing: handleStartSharing,
          ToggleSwitchComponent: ToggleSwitch,
        }}
        showCompetitionPicker={showCompetitionPicker}
        competitionPickerPanelProps={{
          onClose: () => setShowCompetitionPicker(false),
          onStartCompetition: () => {
            setShowCompetitionPicker(false);
            startCompetition();
          },
          onStartTeamCompetition: () => {
            setShowCompetitionPicker(false);
            startTeamCompetition();
          },
          onStartDuelCompetition: () => {
            setShowCompetitionPicker(false);
            startDuelCompetition();
          },
          onStartTacticalCompetition: () => {
            setShowCompetitionPicker(false);
            startTacticalCompetition();
          },
        }}
        showStudentOptions={showStudentOptions}
        studentOptionsPanelProps={{
          studentOptions: STUDENT_OPTIONS,
          hoveredStudentOption,
          setHoveredStudentOption,
          onClose: handleCloseStudentOptions,
          onProjection: handleOpenLiveSettings,
          onCompetition: () => setShowCompetitionPicker(true),
          onPresent: () => navigate(routes.present(quiz?.id || '')),
          onClassroom: startClassroomSession,
          onShare: handleOpenShareSettings,
        }}
        defaultPanelProps={{
          title: quiz.title || 'bez názvu',
          canDirectEdit,
          onOpenStudentOptions: handleOpenStudentOptions,
          onEdit: handleEditBoard,
          onCopyAndEdit: handleCopyAndEditBoard,
          onResults: handleOpenBoardResults,
          onPrint: handlePrint,
          onOpenShareEditDialog: handleOpenShareEditDialog,
        }}
      />
    );
  };
  
  // Simple progress bar - EXACT copy from QuizStudentView (for mobile)
  const renderSimpleProgressBar = () => {
    return (
      <>
        {currentSlideIndex >= 0 && (
          <div
            className="rounded-full"
            style={{ 
              height: '8px',
              backgroundColor: '#475569',
              flex: currentSlideIndex + 1
            }}
          />
        )}
        {quiz.slides.slice(currentSlideIndex + 1).map((_, idx) => (
          <div
            key={idx}
            className="flex-1 rounded-full"
            style={{ 
              height: '8px',
              backgroundColor: '#CBD5E1'
            }}
          />
        ))}
      </>
    );
  };

  // Render progress bar segments (desktop - clickable)
  const renderProgressBar = () => {
    const totalSlides = quiz.slides.length;
    const progressPercent = totalSlides > 0 ? ((currentSlideIndex + 1) / totalSlides) * 100 : 0;
    
    // For more than 30 slides, show a simple continuous progress bar
    if (totalSlides > 30) {
      return (
        <div 
          className="flex-1 h-2 rounded-full overflow-hidden cursor-pointer"
          style={{ backgroundColor: isDarkMode ? '#334155' : '#CBD5E1' }}
          onClick={(e) => {
            if (isAnimating) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickPercent = clickX / rect.width;
            const targetIndex = Math.floor(clickPercent * totalSlides);
            const clampedIndex = Math.max(0, Math.min(totalSlides - 1, targetIndex));
            
            if (clampedIndex !== currentSlideIndex) {
              setIsAnimating(true);
              setPrevSlideIndex(currentSlideIndex);
              setCurrentSlideIndex(clampedIndex);
              setTimeout(() => setIsAnimating(false), 400);
            }
          }}
        >
          <div 
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{ 
              width: `${progressPercent}%`,
              backgroundColor: isDarkMode ? '#94a3b8' : '#475569'
            }}
          />
        </div>
      );
    }
    
    // For 30 or fewer slides, show individual segments
    return (
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
  };
  
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
            return <TeacherExampleView slide={slide as ExampleActivitySlide} customKeys={quiz?.settings?.customKeys} extraKeys={quiz?.settings?.extraKeys} />;
          case 'board':
            return (
              <BoardSlideView 
                slide={slide as BoardActivitySlide}
                posts={boardPosts.posts}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
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
          case 'form':
            return (
              <FormView 
                slide={slide as any}
                answer={formPreviewAnswer}
                onAnswerChange={setFormPreviewAnswer}
                isReadOnly={false}
              />
            );
          case 'flashcard':
            return (
              <div className="w-full h-full">
                <FlashcardSlideView slide={slide as any} />
              </div>
            );
          default:
            return <div className="text-slate-500 text-center">Nepodporovaný typ aktivity</div>;
        }
      case 'tools':
        const toolsSlide = slide as ToolsSlide;
        switch (toolsSlide.toolType) {
          case 'certificate':
            return (
              <CertificateView 
                slide={toolsSlide}
                quiz={quiz}
                isPreview={true}
              />
            );
          default:
            return <div className="text-slate-500 text-center">Nepodporovaný typ nástroje</div>;
        }
      default:
        return <div className="text-slate-500 text-center">Nepodporovaný typ slidu</div>;
    }
  };

  // Background color based on session state
  const bgColor = sessionId ? '#1e2533' : '#F0F1F8';
  const isDarkMode = !!sessionId;
  const showLeftChrome = !classroomShareId;
  
  // ============================================
  // RENDER: COMPETITION MODE (full-screen takeover)
  // ============================================
  if (competitionActive && session && sessionId && sessionCode && quiz) {
    return (
      <div className="h-screen w-screen overflow-hidden">
        <CompetitionView
          session={session}
          sessionId={sessionId}
          sessionBackend={sessionBackend}
          quiz={quiz}
          sessionCode={sessionCode}
          onEnd={endCompetition}
          renderSlide={renderSlideView}
        />
      </div>
    );
  }
  
  // ============================================
  // RENDER: TEAM COMPETITION MODE (full-screen takeover)
  // ============================================
  if (teamCompetitionActive && session && sessionId && sessionCode && quiz) {
    return (
      <div className="h-screen w-screen overflow-hidden">
        <TeamCompetitionView
          session={session}
          sessionId={sessionId}
          sessionBackend={sessionBackend}
          quiz={quiz}
          sessionCode={sessionCode}
          onEnd={endTeamCompetition}
          renderSlide={renderSlideView}
        />
      </div>
    );
  }
  
  // ============================================
  // RENDER: DUEL COMPETITION MODE (full-screen takeover)
  // ============================================
  if (duelCompetitionActive && session && sessionId && sessionCode && quiz) {
    return (
      <div className="h-screen w-screen overflow-hidden">
        <DuelCompetitionView
          session={session}
          sessionId={sessionId}
          sessionBackend={sessionBackend}
          quiz={quiz}
          sessionCode={sessionCode}
          onEnd={endDuelCompetition}
          renderSlide={renderSlideView}
        />
      </div>
    );
  }
  
  // ============================================
  // RENDER: TACTICAL COMPETITION MODE (full-screen takeover)
  // ============================================
  if (tacticalCompetitionActive && session && sessionId && sessionCode && quiz) {
    return (
      <div className="h-screen w-screen overflow-hidden">
        <TacticalCompetitionView
          session={session}
          sessionId={sessionId}
          sessionBackend={sessionBackend}
          quiz={quiz}
          sessionCode={sessionCode}
          onEnd={endTacticalCompetition}
          renderSlide={renderSlideView}
        />
      </div>
    );
  }
  
  const hasOsnova = !!(quiz.worksheetMap && quiz.worksheetMap.pages.length > 0);
  const hasCurrentSlideNote = !!String((currentSlide as any)?.note || '').trim();
  const hasLeftPanelContent = hasOsnova || hasCurrentSlideNote;
  const isLeftPanelOpen = showOsnovaPanel || showNotePanel;
  
  return (
    <div className="flex h-screen overflow-hidden relative" style={{ backgroundColor: bgColor }}>
      {/* QR/Code Popup - displays over entire presentation area */}
      {showQRPopup && (sessionCode || classroomShareId) && (() => {
        const isClassroom = !!classroomShareId;
        const popupCode = isClassroom ? (classroomShareCode || '') : (sessionCode || '');
        const popupLink = isClassroom
          ? (classroomShareLink || '')
          : `${window.location.origin}${import.meta.env.BASE_URL || '/'}go/${popupCode}`;
        // For classroom mode, always show QR (no code-only popup)
        const effectivePopup = isClassroom ? 'qr' : showQRPopup;
        return (
        <div 
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ 
            backgroundColor: 'white',
            right: showRightPanel ? '320px' : '0' 
          }}
        >
          <button
            onClick={handleCloseQrPopup}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
          >
            <X className="w-8 h-8" />
          </button>
          
          <div className="flex flex-col items-center justify-center h-full w-full p-8">
            {effectivePopup === 'qr' ? (
              <div className="flex flex-col items-center">
                <QRCodeSVG 
                  value={popupLink}
                  size={Math.min(window.innerWidth * 0.6, window.innerHeight * 0.75, 700)}
                  level="M"
                />
                <button
                  onClick={() => copyToClipboard(popupLink)}
                  className="mt-8 px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2"
                  style={{ backgroundColor: '#f59e0b', color: 'white' }}
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      <span>Zkopírováno!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      <span>Zkopírovat odkaz</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <p className="mb-6 text-slate-500 text-xl">
                  Připojte se na <span className="font-medium text-slate-700">{window.location.host}{import.meta.env.BASE_URL || ''}/go</span>
                </p>
                
                <div 
                  className="font-mono font-bold tracking-[0.4em] text-slate-800"
                  style={{ fontSize: 'min(25vw, 250px)' }}
                >
                  {popupCode}
                </div>
                
                <button
                  onClick={() => copyToClipboard(popupLink)}
                  className="mt-8 px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2"
                  style={{ backgroundColor: '#f59e0b', color: 'white' }}
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      <span>Zkopírováno!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      <span>Zkopírovat odkaz</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
        );
      })()}
      
      {/* Left sidebar - Osnova (desktop only) */}
      {showLeftChrome && isLeftPanelOpen && (
        <div className="hidden lg:flex h-full flex-shrink-0 relative">
          <div
            ref={osnovaSidebarRef}
            className="flex flex-col flex-shrink-0 bg-white/95 backdrop-blur-sm z-30 border-r border-slate-100"
            style={{ width: osnovaWidth, minWidth: 240, maxWidth: 600 }}
          >
            {showOsnovaPanel && hasOsnova ? (
              <OsnovaPanel
                worksheetMap={quiz.worksheetMap!}
                slides={quiz.slides}
                selectedSlideId={quiz.slides[currentSlideIndex]?.id ?? null}
                onSlideSelect={(id) => {
                  const idx = quiz.slides.findIndex(s => s.id === id);
                  if (idx >= 0) setCurrentSlideIndex(idx);
                }}
                headerPaddingTop={16}
              />
            ) : showNotePanel && hasCurrentSlideNote ? (
              <div className="flex-1 overflow-y-auto px-5 py-10" style={{ paddingTop: 100 }}>
                <div className="flex flex-col gap-4">
                  <h3 className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-2">Poznamka:</h3>
                  <p className="text-[#4E5871] text-lg font-medium leading-relaxed">
                    {(currentSlide as any).note}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
          {/* Subtle edge line only */}
          <div className="absolute top-0 right-0 h-full w-px bg-slate-200 z-30" style={{ right: -1 }} />
        </div>
      )}

      {/* Left control column - desktop only */}
      <div className={`${showLeftChrome ? 'hidden lg:flex' : 'hidden'} flex-col items-center flex-shrink-0 h-full relative`} style={{ width: 64, paddingTop: 20, gap: 0 }}>
        {/* Buttons group at top */}
        <div className="flex flex-col items-center gap-3">
          {/* Close button */}
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.8)', color: '#64748b', border: 'none' }}
            title="Zavřít"
          >
            <X className="w-5 h-5" />
          </button>
          
          {/* Left panel toggle — hidden when board has no outline and no note */}
          {hasLeftPanelContent && (
            <button
              onClick={() => {
                if (isLeftPanelOpen) {
                  setShowOsnovaPanel(false);
                  setShowNotePanel(false);
                  return;
                }

                if (hasOsnova) {
                  handleToggleOsnovaPanel();
                  return;
                }

                if (hasCurrentSlideNote) {
                  setShowRightPanel(false);
                  setShowOsnovaPanel(false);
                  setShowNotePanel(true);
                }
              }}
              className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors"
              style={{ backgroundColor: isLeftPanelOpen ? '#334155' : 'rgba(255,255,255,0.8)', color: isLeftPanelOpen ? 'white' : '#64748b', border: 'none' }}
              title={isLeftPanelOpen ? 'Zavřít panel' : 'Otevřít panel'}
            >
              {isLeftPanelOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
            </button>
          )}

          {/* Osnova icon button */}
          {hasOsnova && (
            <button
              onClick={() => {
                setShowNotePanel(false);
                handleToggleOsnovaPanel();
              }}
              className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors"
              style={{ backgroundColor: showOsnovaPanel ? '#334155' : 'rgba(255,255,255,0.8)', border: 'none' }}
              title="Osnova pracovního listu"
            >
              <OsnovaIcon active={showOsnovaPanel} />
            </button>
          )}

          {hasCurrentSlideNote && (
            <button
              onClick={() => {
                setShowOsnovaPanel(false);
                setShowRightPanel(false);
                setShowNotePanel((value) => !value);
              }}
              className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors"
              style={{ backgroundColor: showNotePanel ? '#334155' : 'rgba(255,255,255,0.8)', color: showNotePanel ? 'white' : '#64748b', border: 'none' }}
              title="Poznámka"
            >
              <NoteIcon size={20} />
            </button>
          )}

        </div>
        
        {/* Resize grip — visible only when osnova panel is open */}
        {isLeftPanelOpen && (
          <div
            className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 cursor-col-resize group z-50"
            style={{ top: '70%', transform: 'translate(-50%, -50%)' }}
            title="Přetáhnout pro změnu šířky"
            onMouseDown={(e) => {
              e.preventDefault();
              const sidebar = osnovaSidebarRef.current;
              if (!sidebar) return;
              const startX = e.clientX;
              const startW = sidebar.getBoundingClientRect().width;
              const onMove = (mv: MouseEvent) => {
                const newW = Math.min(600, Math.max(240, startW + mv.clientX - startX));
                sidebar.style.width = `${newW}px`;
              };
              const onUp = (mv: MouseEvent) => {
                const newW = Math.min(600, Math.max(240, startW + mv.clientX - startX));
                setOsnovaWidth(newW);
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
              };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
          >
            {[0,1,2,3,4].map(i => (
              <div
                key={i}
                className="rounded-full transition-colors group-hover:bg-indigo-400"
                style={{ width: 5, height: 5, backgroundColor: '#94a3b8' }}
              />
            ))}
          </div>
        )}

        {/* Arrow - absolutely centered in the column */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <button
            onClick={goToPrevSlide}
            disabled={currentSlideIndex === 0}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-out ${currentSlideIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:h-28'} ${isDarkMode ? 'bg-white/10 text-white/70' : 'bg-[#CBD5E1] text-slate-600'}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col relative">
        
        {/* Mobile: Top navigation - exact same as QuizStudentView (hidden in classroom mode) */}
        <div className={`${classroomShareId ? 'hidden' : 'flex'} lg:hidden items-center gap-3 px-4 py-4`} style={{ backgroundColor: '#F0F1F8' }}>
          {/* Left arrow */}
          <button
            onClick={goToPrevSlide}
            disabled={currentSlideIndex === 0}
            className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${currentSlideIndex === 0 ? 'opacity-30 cursor-not-allowed' : ''} bg-[#CBD5E1] text-slate-600`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          {/* Progress bar - simple version like QuizStudentView */}
          <div className="flex-1 flex items-center gap-1.5">
            {renderSimpleProgressBar()}
          </div>
          
          {/* Right arrow */}
          <button
            onClick={goToNextSlide}
            disabled={currentSlideIndex === quiz.slides.length - 1}
            className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-white ${currentSlideIndex === quiz.slides.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
            style={{ backgroundColor: '#7C3AED' }}
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          
        </div>
        
        {/* Main content area */}
        {classroomShareId ? (
          classroomStarted ? (
            <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
              <ClassroomDashboard
                students={classroomStudents}
                quiz={quiz}
                sessionCode={classroomShareCode || ''}
                shareLink={classroomShareLink || ''}
                onEnd={handleOpenEndDialog}
              />
            </div>
          ) : (
            /* Lobby — waiting for teacher to start */
            <div className="flex-1 flex flex-col items-center justify-center overflow-hidden" style={{ backgroundColor: '#0f172a', minHeight: 0 }}>
              <div className="flex flex-col items-center gap-6 max-w-lg w-full px-6">
                <h1 className="text-3xl font-bold text-white text-center">Čekání na studenty</h1>
                <p className="text-slate-400 text-center">Studenti se připojují. Až budou všichni, klikněte na Zahájit.</p>
                
                {/* QR code */}
                <div 
                  className="bg-white p-4 rounded-2xl shadow-xl cursor-pointer transition-all group"
                  onClick={() => handleOpenQrPopup('qr')}
                >
                  <QRCodeSVG value={classroomShareLink || ''} size={Math.min(280, window.innerWidth * 0.35)} level="M" />
                </div>
                
                {/* Copy link */}
                <button
                  onClick={() => copyToClipboard(classroomShareLink || '')}
                  className="py-2.5 px-5 rounded-xl transition-colors flex items-center gap-2 text-sm font-medium hover:opacity-90"
                  style={{ backgroundColor: '#f59e0b', color: '#1e293b' }}
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Zkopírováno!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Kopírovat odkaz</span>
                    </>
                  )}
                </button>
                
                {/* Connected students count */}
                <div className="flex items-center gap-2 text-white text-lg mt-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold">{Object.keys(classroomStudents).length}</span>
                  <span className="text-slate-400">
                    {Object.keys(classroomStudents).length === 1 ? 'student připojen' : 'studentů připojeno'}
                  </span>
                </div>
                
                {/* Start button */}
                <button
                  onClick={beginClassroom}
                  disabled={Object.keys(classroomStudents).length === 0}
                  className="mt-4 py-4 rounded-2xl text-white font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.03] active:scale-[0.97]"
                  style={{ backgroundColor: '#7C3AED', width: '100%', maxWidth: 400 }}
                >
                  <Play className="w-6 h-6" />
                  Zahájit
                </button>
              </div>
            </div>
          )
        ) : (
        <div 
          className="flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-out" 
          style={{ 
            backgroundColor: bgColor,
            minHeight: 0,
            paddingBottom: annotationDockHeight,
          }}
        >
          {/* Desktop: Segmented progress bar - above slide, within 40px top margin */}
          <div 
            className="hidden lg:flex items-end justify-center flex-shrink-0 overflow-hidden transition-all duration-300 ease-out"
            style={{
              height: annotations.toolbarOpen ? 0 : 40,
              paddingBottom: annotations.toolbarOpen ? 0 : 8,
              opacity: annotations.toolbarOpen ? 0 : 1,
            }}
          >
            <div className="w-1/2 max-w-xl flex items-center gap-1.5">
              {renderProgressBar()}
            </div>
          </div>
          
          {/* Content with arrows - with bottom padding */}
          <div
            className="flex-1 flex items-stretch overflow-hidden transition-all duration-300 ease-out"
            style={{ minHeight: 0, paddingBottom: 5 }}
          >
          
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
              data-annotation-capture-slide-id={currentSlide.id}
              className={`
                w-full h-full rounded-3xl shadow-md overflow-hidden flex flex-col relative
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
                <>
                  <div
                    className="flex-1 flex flex-col"
                    style={{
                      minHeight: 0,
                      pointerEvents: annotations.toolbarOpen ? 'none' : 'auto',
                      userSelect: annotations.toolbarOpen ? 'none' : 'auto',
                    }}
                  >
                    {renderSlideView(currentSlide)}
                    
                    {/* Submit button for form activity */}
                    {currentSlide.type === 'activity' && (currentSlide as any).activityType === 'form' && (
                      <div className="p-6 flex justify-center border-t border-slate-100">
                        <button
                          onClick={() => {
                            // In teacher view, just reset the form for testing
                            setFormPreviewAnswer({});
                          }}
                          disabled={
                            ((currentSlide as any).fields || []).some((field: any) => 
                              field.required && (
                                !formPreviewAnswer[field.id] || 
                                (Array.isArray(formPreviewAnswer[field.id]) && (formPreviewAnswer[field.id] as string[]).length === 0) ||
                                (typeof formPreviewAnswer[field.id] === 'string' && !(formPreviewAnswer[field.id] as string).trim())
                              )
                            )
                          }
                          className="px-8 py-3 rounded-xl font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-300 disabled:cursor-not-allowed"
                        >
                          Odeslat formulář
                        </button>
                      </div>
                    )}
                  </div>
                  {isDesktopViewport && (
                    <PresentationAnnotationsLayer slideId={currentSlide.id} controller={annotations} renderToolbar={false} />
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-white/70">
                  <p className="text-xl">Žádné slidy</p>
                </div>
              )}
            </div>
            
            {/* Mobile: Extra space at bottom for scrolling */}
            {isMobileOrTablet && (
              <div style={{ height: '120px', flexShrink: 0 }} />
            )}
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
        )}
      </div>

      {!classroomShareId && currentSlide && isDesktopViewport && (
        <PresentationAnnotationsLayer
          slideId={currentSlide.id}
          controller={annotations}
          renderCanvas={false}
          toolbarPlacement="screen-corner"
          toolbarRightOffset={showRightPanel ? 336 : 18}
        />
      )}
      
      {/* Right panel toggle button - circle at top right edge */}
      <div className="hidden lg:block flex-shrink-0 relative" style={{ width: 0 }}>
        <button
          onClick={handleToggleRightPanel}
          className="absolute w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-lg"
          style={{ top: 20, right: 20, backgroundColor: '#1e2533', color: 'rgba(255,255,255,0.7)' }}
          title={showRightPanel ? 'Zavřít panel' : 'Otevřít panel'}
          onMouseEnter={e => (e.currentTarget.style.color = 'white')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
      
      {/* Right panel - dark background */}
      <div 
        className={`
          hidden lg:flex text-white flex-col transition-all duration-300 ease-out overflow-hidden
          ${showRightPanel ? 'w-80' : 'w-0'}
        `}
        style={{ backgroundColor: '#1e2533' }}
      >
        {showRightPanel && renderRightPanel()}
      </div>
      
      {/* Share Edit Dialog */}
      {quiz && (
        <ShareEditDialog
          isOpen={showShareEditDialog}
          onClose={() => setShowShareEditDialog(false)}
          boardId={quiz.id}
          boardTitle={quiz.title || 'Board'}
        />
      )}
      
    </div>
  );
}

export default QuizViewPage;
