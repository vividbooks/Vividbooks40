/**
 * Quiz Join Page
 * 
 * Robust student session management:
 * - Persistent student identity across sessions
 * - Auto-reconnect on page reload/return
 * - Works across devices (wifi/data)
 * - Results tied to student name
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import {
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  Pause,
  ChevronRight,
  Send,
  Users,
  ArrowLeft,
  ArrowRight,
  WifiOff,
  AlertCircle,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import MathKeyboard, { MathDisplay } from '../math/MathKeyboard';
import { MathText } from '../math/MathText';
import { ExampleActivityView } from './ExampleActivityView';
import {
  Quiz,
  QuizSlide,
  ABCActivitySlide,
  OpenActivitySlide,
  ExampleActivitySlide,
  BoardActivitySlide,
  VotingActivitySlide,
  SlideResponse,
  LiveQuizSession,
  InfoSlide,
  ConnectPairsActivitySlide,
  FillBlanksActivitySlide,
  ImageHotspotsActivitySlide,
  VideoQuizActivitySlide,
  ToolsSlide,
  TreasureType,
} from '../../types/quiz';
import { BlockLayoutView } from './BlockLayoutView';
import { BoardSlideView } from './slides/BoardSlideView';
import { ABCSlideView } from './slides/ABCSlideView';
import { OpenSlideView } from './slides/OpenSlideView';
import { InfoSlideView } from './slides/InfoSlideView';
import { VotingSlideView } from './slides/VotingSlideView';
import { ConnectPairsView } from './slides/ConnectPairsView';
import { FillBlanksView } from './slides/FillBlanksView';
import { ImageHotspotsView } from './slides/ImageHotspotsView';
import { VideoQuizView } from './slides/VideoQuizView';
import { evaluateABCAnswer, getABCSelectedAnswerIds } from '../../utils/abc-evaluation';
import { FormView } from './slides/FormView';
import { FlashcardSlideView } from './slides/FlashcardSlideView';
import type { FlashcardActivitySlide } from '../../types/quiz';
import { CertificateView } from './slides/CertificateView';
import { useBoardPosts } from '../../hooks/useBoardPosts';
import { useVoting } from '../../hooks/useVoting';
import { checkMathAnswer } from '../../utils/math-compare';
import Lottie from 'lottie-react';
import sadFaceLottie from '../../assets/lottie/sad-face.json';
import { StudentAccessShell } from '../shared/StudentAccessShell';
import {
  StudentData,
  SavedSession,
  getDeviceId,
  getStudentIdentity,
  matchesStudentIdentity,
  saveActiveSession,
  getSavedSession,
  clearSavedSession,
  retryOperation,
} from '../../utils/student-session';
import {
  loadLiveSession,
  lookupLiveSessionByCode,
  SessionBackend,
  subscribeLiveSession,
  updateLiveSessionRecord,
  updateLiveStudentRecord,
  upsertLiveStudentRecord,
} from '../../utils/live-session-repository';

// Competition assets (Supabase storage — competition_files bucket)
const COMP_SB = 'https://njbtqmsxbyvpwigfceke.supabase.co/storage/v1/object/public/competition_files';
const COMP_ASSETS = {
  countdown: `${COMP_SB}/animace/321.json`,
  celebrate: `${COMP_SB}/animace/celebrate.json`,
  rank: (n: number) => `${COMP_SB}/animace/rank_${n}.json`,
  drum: `${COMP_SB}/Drum.json`,
};


// ============================================
// MAIN COMPONENT
// ============================================

export function QuizJoinPage() {
  const [searchParams] = useSearchParams();
  const { code: urlCode } = useParams<{ code?: string }>();
  const initialCode = urlCode || searchParams.get('code') || '';
  
  // Connection state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Join state
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [boardTitle, setBoardTitle] = useState<string | null>(null);
  const [isLookingUpBoard, setIsLookingUpBoard] = useState(false);
  
  // Session state
  const [isJoined, setIsJoined] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [session, setSession] = useState<LiveQuizSession | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [sessionBackend, setSessionBackend] = useState<SessionBackend>('supabase');
  
  // Track scrolling for floating nav visibility (must be after isJoined is defined)
  useEffect(() => {
    if (!isJoined || !isMobile) return;
    
    // Wait a bit for ref to be set after render
    const timeout = setTimeout(() => {
      const scrollEl = mobileScrollRef.current;
      if (!scrollEl) return;
      
      const handleScroll = () => {
        setIsScrolling(true);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false);
        }, 2000);
      };
      
      scrollEl.addEventListener('scroll', handleScroll, { passive: true });
      
      // Cleanup stored for outer effect
      (scrollEl as any)._scrollHandler = handleScroll;
    }, 100);
    
    return () => {
      clearTimeout(timeout);
      const scrollEl = mobileScrollRef.current;
      if (scrollEl && (scrollEl as any)._scrollHandler) {
        scrollEl.removeEventListener('scroll', (scrollEl as any)._scrollHandler);
      }
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [isMobile, isJoined]);
  
  // Quiz progress
  const [responses, setResponses] = useState<SlideResponse[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | string[] | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [formAnswer, setFormAnswer] = useState<Record<string, string | string[]>>({});
  const [showResult, setShowResult] = useState(false);
  
  
  // Tactical: two-step treasure choice (first pick risk, then see options)
  const [showTreasureOptions, setShowTreasureOptions] = useState(false);
  
  // Local slide index for unlocked mode
  const [localSlideIndex, setLocalSlideIndex] = useState(0);
  const [prevSlideIndex, setPrevSlideIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Time tracking
  const [sessionStartTime] = useState<number>(Date.now());
  const [slideStartTime, setSlideStartTime] = useState<number>(Date.now());
  
  // Wiggle animation for answer button
  const [showWiggle, setShowWiggle] = useState(false);
  const answerButtonRef = useRef<HTMLButtonElement | null>(null);
  
  // Refs for cleanup and state tracking
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const sessionUnsubscribe = useRef<(() => void) | null>(null);
  const responsesRef = useRef<SlideResponse[]>(responses);
  
  // Keep ref in sync with state
  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  // ============================================
  // COMPUTED: ONLINE STUDENTS COUNT
  // ============================================
  
  const onlineStudentsCount = session?.students 
    ? Object.values(session.students).filter((s: any) => s.isOnline).length 
    : 0;

  // ============================================
  // NETWORK STATUS MONITORING
  // ============================================
  
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionError(null);
      // Trigger reconnect if we were in a session
      if (sessionId && studentId) {
        reconnectToSession();
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setConnectionError('Ztráta připojení k internetu');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [sessionId, studentId]);

  // ============================================
  // LIVE BOARD TITLE LOOKUP
  // ============================================
  
  useEffect(() => {
    // Only lookup when code is complete (6 chars)
    if (code.length !== 6) {
      setBoardTitle(null);
      return;
    }
    
    const lookupBoardTitle = async () => {
      setIsLookingUpBoard(true);
      try {
        const codeUpper = code.toUpperCase();
        const result = await lookupLiveSessionByCode(codeUpper);
        if (result?.session?.quizData?.title) {
          setBoardTitle(result.session.quizData.title);
        }
      } catch (e) {
        console.log('Board title lookup failed:', e);
      } finally {
        setIsLookingUpBoard(false);
      }
    };
    
    lookupBoardTitle();
  }, [code]);

  // ============================================
  // AUTO-RECONNECT ON PAGE LOAD
  // ============================================
  
  useEffect(() => {
    const savedSession = getSavedSession();
    const identity = getStudentIdentity();
    
    // Pre-fill name from identity
    if (identity.name && !name) {
      setName(identity.name);
    }
    
    // If URL has a code, check if it matches the saved session
    if (initialCode && savedSession) {
      // Extract session code from saved session ID (format: quiz_XXXXXX_timestamp)
      const savedCodeMatch = savedSession.sessionId.match(/quiz_([A-Z0-9]+)_/);
      const savedCode = savedCodeMatch ? savedCodeMatch[1] : null;
      
      if (savedCode && savedCode.toUpperCase() !== initialCode.toUpperCase()) {
        // URL code is different from saved session - clear saved and use URL code
        console.log('URL code differs from saved session, clearing saved session');
        clearSavedSession();
        return; // Don't auto-reconnect, let user join with URL code
      }
    }
    
    // Try to reconnect to saved session (only if no URL code or URL matches saved)
    if (savedSession) {
      console.log('Found saved session, attempting reconnect:', savedSession);
      attemptReconnect(savedSession);
    }
  }, [initialCode]);

  // Attempt to reconnect to a saved session
  const attemptReconnect = async (savedSession: SavedSession) => {
    setIsReconnecting(true);
    setError('');
    
    try {
      const loaded = await loadLiveSession(savedSession.sessionId);
      
      if (!loaded) {
        console.log('Session no longer exists');
        clearSavedSession();
        setIsReconnecting(false);
        return;
      }
      const sessionData = loaded.session;
      setSessionBackend(loaded.backend);
      
      if (!sessionData.isActive) {
        console.log('Session has ended');
        // Show results if session ended
        setSession(sessionData);
        if (sessionData.quizData) {
          setQuiz(sessionData.quizData as Quiz);
        }
        // Restore student data
        const studentData = sessionData.students?.[savedSession.studentId];
        if (studentData) {
          setResponses(studentData.responses || []);
          setLocalSlideIndex(studentData.currentSlide || 0);
          setName(savedSession.studentName);
        }
        setSessionId(savedSession.sessionId);
        setStudentId(savedSession.studentId);
        setIsJoined(true);
        setIsReconnecting(false);
        return;
      }
      
      // Check if student record still exists
      const studentData = sessionData.students?.[savedSession.studentId];
      
      if (studentData) {
        console.log('Reconnecting to existing student record');
        // Restore state from Firebase
        setResponses(studentData.responses || []);
        setLocalSlideIndex(studentData.currentSlide || 0);
        setName(savedSession.studentName);
        
        // Update online status
        await retryOperation(() => 
          updateLiveStudentRecord(loaded.backend, savedSession.sessionId, savedSession.studentId, {
            isOnline: true,
            isFocused: true,
            lastSeen: new Date().toISOString(),
            deviceId: getDeviceId(),
          })
        );
        
        // Set session state
        setSessionId(savedSession.sessionId);
        setStudentId(savedSession.studentId);
        setSession(sessionData);
        if (sessionData.quizData) {
          setQuiz(sessionData.quizData as Quiz);
        }
        setIsJoined(true);
      } else {
        console.log('Student record not found, clearing saved session');
        clearSavedSession();
      }
    } catch (error) {
      console.error('Reconnect failed:', error);
      setConnectionError('Nepodařilo se obnovit připojení');
      clearSavedSession();
    } finally {
      setIsReconnecting(false);
    }
  };

  // Manual reconnect
  const reconnectToSession = async () => {
    if (!sessionId || !studentId) return;
    
    setIsReconnecting(true);
    try {
      await retryOperation(() =>
        updateLiveStudentRecord(sessionBackend, sessionId, studentId, {
          isOnline: true,
          isFocused: document.visibilityState === 'visible',
          lastSeen: new Date().toISOString(),
        })
      );
      setConnectionError(null);
    } catch (error) {
      console.error('Reconnect failed:', error);
      setConnectionError('Nepodařilo se obnovit připojení');
    } finally {
      setIsReconnecting(false);
    }
  };

  // ============================================
  // SESSION LISTENER
  // ============================================
  
  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = subscribeLiveSession(sessionBackend, sessionId, (data) => {
      setSession(data as LiveQuizSession);
      setConnectionError(null);

      if (data.quizData && !quiz) {
        console.log('Loading quiz from session backend:', data.quizData);
        setQuiz(data.quizData as Quiz);
      }

      if (studentId && data.students?.[studentId]) {
        const serverResponses = data.students[studentId].responses || [];
        const currentResponses = responsesRef.current;
        const hasNewResponses = serverResponses.length > currentResponses.length;
        const hasEvaluationChanged = serverResponses.some((sr: any, idx: number) => {
          const localResponse = currentResponses[idx];
          return localResponse && sr.isCorrect !== localResponse.isCorrect;
        });
        if (hasNewResponses || hasEvaluationChanged) {
          setResponses(serverResponses);
        }
      }
    }, (error) => {
      console.error('Session listener error:', error);
      setConnectionError('Ztráta spojení se serverem');
    });

    sessionUnsubscribe.current = unsubscribe;

    return () => {
      unsubscribe();
      sessionUnsubscribe.current = null;
    };
  }, [sessionBackend, sessionId, studentId, quiz]);

  // ============================================
  // HEARTBEAT - Keep online status updated
  // ============================================
  
  useEffect(() => {
    if (!sessionId || !studentId) return;
    
    const updateHeartbeat = async () => {
      try {
        await updateLiveStudentRecord(sessionBackend, sessionId, studentId, {
          lastSeen: new Date().toISOString(),
          isOnline: true,
        });
      } catch (error) {
        console.warn('Heartbeat failed:', error);
      }
    };
    
    // Update immediately
    updateHeartbeat();
    
    // Optimized: 45s heartbeat for better scalability with many students
    heartbeatInterval.current = setInterval(updateHeartbeat, 45000);
    
    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
    };
  }, [sessionBackend, sessionId, studentId]);

  // ============================================
  // ONLINE/FOCUS STATUS
  // ============================================
  
  useEffect(() => {
    if (!sessionId || !studentId) return;
    
    const handleBeforeUnload = () => {
      updateLiveStudentRecord(sessionBackend, sessionId, studentId, { isOnline: false });
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updateLiveStudentRecord(sessionBackend, sessionId, studentId, { isOnline: false });
    };
  }, [sessionBackend, sessionId, studentId]);
  
  // Track focus/visibility
  useEffect(() => {
    if (!sessionId || !studentId) return;
    
    const handleVisibilityChange = () => {
      const isFocused = document.visibilityState === 'visible';
      updateLiveStudentRecord(sessionBackend, sessionId, studentId, { isFocused, lastSeen: new Date().toISOString() });
    };
    
    const handleBlur = () => {
      updateLiveStudentRecord(sessionBackend, sessionId, studentId, { isFocused: false, lastSeen: new Date().toISOString() });
    };
    
    const handleFocus = () => {
      updateLiveStudentRecord(sessionBackend, sessionId, studentId, { isFocused: true, lastSeen: new Date().toISOString() });
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [sessionBackend, sessionId, studentId]);

  // ============================================
  // SYNC SLIDE INDEX
  // ============================================
  
  useEffect(() => {
    if (session?.isLocked !== false && session?.currentSlideIndex !== undefined) {
      // Trigger animation when teacher changes slide
      if (session.currentSlideIndex !== localSlideIndex) {
        setPrevSlideIndex(localSlideIndex);
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 300);
      }
      
      setLocalSlideIndex(session.currentSlideIndex);
      
      if (sessionId && studentId) {
        updateLiveStudentRecord(sessionBackend, sessionId, studentId, {
          currentSlide: session.currentSlideIndex,
        });
      }
    }
  }, [sessionBackend, session?.currentSlideIndex, session?.isLocked, sessionId, studentId]);
  
  // Reset selection and start time when slide changes
  const effectiveSlideIndex = session?.isLocked === false ? localSlideIndex : (session?.currentSlideIndex || 0);
  useEffect(() => {
    setSelectedOption(null);
    setTextAnswer('');
    setShowResult(false);
    setShowTreasureOptions(false);
    setSlideStartTime(Date.now()); // Reset slide timer
  }, [effectiveSlideIndex]);

  // ============================================
  // JOIN SESSION
  // ============================================
  
  const joinSession = async () => {
    if (!code || !name) {
      setError('Vyplň kód a jméno');
      return;
    }
    
    // Clear any saved session that doesn't match the code being joined
    const savedSession = getSavedSession();
    if (savedSession) {
      const savedCodeMatch = savedSession.sessionId.match(/quiz_([A-Z0-9]+)_/);
      const savedCode = savedCodeMatch ? savedCodeMatch[1] : null;
      if (!savedCode || savedCode.toUpperCase() !== code.toUpperCase()) {
        console.log('Clearing old session before joining new one');
        clearSavedSession();
      }
    }
    
    setIsJoining(true);
    setError('');
    
    try {
      // Get or create student identity
      const identity = getStudentIdentity(name);
      const deviceId = getDeviceId();
      
      const result = await lookupLiveSessionByCode(code.toUpperCase());

      if (!result) {
        setError('Neplatný kód');
        setIsJoining(false);
        return;
      }

      const foundSessionId = result.sessionId;
      const sessionData = result.session;
      setSessionBackend(result.backend);
      
      if (!sessionData.isActive) {
        setError('Session již skončila');
        setIsJoining(false);
        return;
      }
      
      let existingStudentId: string | null = null;
      if (sessionData.students) {
        const existingEntry = Object.entries(sessionData.students).find(
          ([_, student]) => matchesStudentIdentity(student as any, identity, deviceId, name)
        );
        if (existingEntry) {
          existingStudentId = existingEntry[0];
          console.log('Found existing student record by identity:', existingStudentId);
        }
      }
      
      const finalStudentId = existingStudentId || identity.id;
      
      // Prepare student data
      const studentData: StudentData = {
        name,
        schoolName: school || '',
        joinedAt: existingStudentId 
          ? (sessionData.students![existingStudentId].joinedAt || new Date().toISOString())
          : new Date().toISOString(),
        currentSlide: existingStudentId 
          ? (sessionData.students![existingStudentId].currentSlide || 0)
          : 0,
        responses: existingStudentId 
          ? (sessionData.students![existingStudentId].responses || [])
          : [],
        isOnline: true,
        isFocused: true,
        lastSeen: new Date().toISOString(),
        deviceId,
        // Time tracking - preserve existing startTime or set new one
        startTime: existingStudentId
          ? ((sessionData.students![existingStudentId] as any).startTime || new Date().toISOString())
          : new Date().toISOString(),
        totalTimeMs: existingStudentId
          ? ((sessionData.students![existingStudentId] as any).totalTimeMs || 0)
          : 0,
        clientIdentityId: identity.id,
      };
      
      // Save/update student in session backend
      await retryOperation(() =>
        upsertLiveStudentRecord(result.backend, foundSessionId, finalStudentId, studentData)
      );
      
      // Save session to localStorage for reconnect
      saveActiveSession({
        sessionId: foundSessionId,
        sessionCode: code.toUpperCase(),
        studentId: finalStudentId,
        studentName: name,
        joinedAt: studentData.joinedAt,
        backend: result.backend,
      });
      
      // Load quiz from Firebase session
      if ((sessionData as any).quizData) {
        setQuiz((sessionData as any).quizData as Quiz);
      }
      
      // Restore responses if reconnecting
      if (existingStudentId && studentData.responses.length > 0) {
        setResponses(studentData.responses);
        setLocalSlideIndex(studentData.currentSlide);
      }
      
      setSessionId(foundSessionId);
      setStudentId(finalStudentId);
      setIsJoined(true);
      setIsJoining(false);
      
    } catch (err) {
      console.error('Join error:', err);
      setError('Nepodařilo se připojit. Zkus to znovu.');
      setIsJoining(false);
    }
  };

  // ============================================
  // SUBMIT ANSWER
  // ============================================
  
  const submitAnswer = useCallback(async (submissionResult?: {
    correct: number;
    total: number;
    answers?: Record<string, string>;
    connections?: Record<string, string>;
  } | boolean) => {
    if (!session || !quiz || !sessionId || !studentId) return;
    
    const slideIndex = session.isLocked === false ? localSlideIndex : session.currentSlideIndex;
    const currentSlideForAnswer = quiz.slides[slideIndex];
    if (!currentSlideForAnswer || currentSlideForAnswer.type !== 'activity') return;
    
    // Check if already answered
    if (responses.some(r => r.slideId === currentSlideForAnswer.id)) {
      setShowResult(true);
      return;
    }
    
    let isCorrect: boolean | undefined = false;
    let answer: string | string[] | Record<string, string> = '';
    
    if (currentSlideForAnswer.activityType === 'abc') {
      const abcSlide = currentSlideForAnswer as ABCActivitySlide;
      isCorrect = evaluateABCAnswer(abcSlide, selectedOption);
      const selectedIds = getABCSelectedAnswerIds(selectedOption);
      answer = abcSlide.allowMultipleCorrect ? selectedIds : (selectedIds[0] || '');
    } else if (currentSlideForAnswer.activityType === 'open') {
      const openSlide = currentSlideForAnswer as OpenActivitySlide;
      // Use mathematical comparison for numeric answers
      isCorrect = checkMathAnswer(textAnswer, openSlide.correctAnswers);
      answer = textAnswer;
    } else if (currentSlideForAnswer.activityType === 'example') {
      const exampleSlide = currentSlideForAnswer as ExampleActivitySlide;
      // Use mathematical comparison for example answers (including alternatives)
      const correctAnswers = [
        ...(exampleSlide.finalAnswer ? [exampleSlide.finalAnswer] : []),
        ...(exampleSlide.alternativeAnswers || []).filter(Boolean),
      ];
      isCorrect = checkMathAnswer(textAnswer, correctAnswers);
      answer = textAnswer;
    } else if (currentSlideForAnswer.activityType === 'form') {
      // Form answers are stored as JSON string
      answer = JSON.stringify(formAnswer);
      isCorrect = undefined;
    } else if (currentSlideForAnswer.activityType === 'flashcard') {
      answer = submissionResult === true ? 'known' : 'unknown';
      isCorrect = undefined;
    } else if (currentSlideForAnswer.activityType === 'connect-pairs') {
      answer = typeof submissionResult === 'object' && submissionResult ? submissionResult.connections || {} : {};
      isCorrect = typeof submissionResult === 'object' && !!submissionResult && submissionResult.total > 0 && submissionResult.correct === submissionResult.total;
    } else if (
      currentSlideForAnswer.activityType === 'fill-blanks' ||
      currentSlideForAnswer.activityType === 'image-hotspots' ||
      currentSlideForAnswer.activityType === 'video-quiz'
    ) {
      answer = typeof submissionResult === 'object' && submissionResult ? submissionResult.answers || {} : {};
      isCorrect = typeof submissionResult === 'object' && !!submissionResult && submissionResult.total > 0 && submissionResult.correct === submissionResult.total;
    }
    
    // Calculate time spent on this slide in seconds
    const timeSpentSeconds = Math.round((Date.now() - slideStartTime) / 1000);
    
    // In teacher-present mode, answers stay unevaluated until the teacher clicks "Vyhodnotit".
    // Immediate feedback is only allowed in self-paced mode.
    const shouldShowImmediateResult = session?.isLocked === false && session?.settings?.showSolutionHints === true;
    
    const shouldTrackEvaluation =
      currentSlideForAnswer.activityType !== 'form' &&
      currentSlideForAnswer.activityType !== 'flashcard';

    const response: SlideResponse = {
      slideId: currentSlideForAnswer.id,
      activityType: currentSlideForAnswer.activityType,
      answer,
      // Set isCorrect immediately if showSolutionHints is enabled, otherwise null until teacher evaluates
      isCorrect: shouldTrackEvaluation
        ? (shouldShowImmediateResult ? isCorrect : (null as any))
        : undefined,
      points: shouldTrackEvaluation && shouldShowImmediateResult && isCorrect ? 1 : 0,
      answeredAt: new Date().toISOString(),
      timeSpent: timeSpentSeconds,
    };
    
    const newResponses = [...responses, response];
    setResponses(newResponses);
    setShowResult(true);
    
    // Calculate total session time
    const totalTimeMs = Date.now() - sessionStartTime;
    
    // Save to Firebase with retry
    try {
      await retryOperation(() =>
        updateLiveStudentRecord(sessionBackend, sessionId, studentId, {
          responses: newResponses,
          currentSlide: slideIndex,
          lastSeen: new Date().toISOString(),
          totalTimeMs,
        })
      );
    } catch (error) {
      console.error('Failed to save answer:', error);
      setConnectionError('Odpověď se možná neuložila. Zkontroluj připojení.');
    }
  }, [session, quiz, sessionId, studentId, localSlideIndex, responses, selectedOption, textAnswer, formAnswer, slideStartTime, sessionStartTime]);

  // ============================================
  // NAVIGATION
  // ============================================
  
  const goToPrevSlide = async () => {
    if (!quiz || localSlideIndex <= 0 || isAnimating) return;
    
    setPrevSlideIndex(localSlideIndex);
    setIsAnimating(true);
    
    const newIndex = localSlideIndex - 1;
    setLocalSlideIndex(newIndex);
    
    // Reset animation after it completes
    setTimeout(() => setIsAnimating(false), 300);
    
    if (sessionId && studentId) {
      await updateLiveStudentRecord(sessionBackend, sessionId, studentId, {
        currentSlide: newIndex,
        lastSeen: new Date().toISOString(),
      });
    }
  };
  
  const goToNextSlide = async () => {
    if (!quiz || localSlideIndex >= quiz.slides.length - 1 || isAnimating) return;
    
    setPrevSlideIndex(localSlideIndex);
    setIsAnimating(true);
    
    const newIndex = localSlideIndex + 1;
    setLocalSlideIndex(newIndex);
    
    // Reset animation after it completes
    setTimeout(() => setIsAnimating(false), 300);
    
    // Scroll to top on mobile - with fallback for older browsers
    try {
      if ('scrollBehavior' in document.documentElement.style) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo(0, 0);
      }
    } catch (e) {
      window.scrollTo(0, 0);
    }
    
    if (sessionId && studentId) {
      await updateLiveStudentRecord(sessionBackend, sessionId, studentId, {
        currentSlide: newIndex,
        lastSeen: new Date().toISOString(),
      });
    }
  };

  // ============================================
  // COMPUTED VALUES
  // ============================================
  
  const currentSlideIndex = session && session.isLocked === false ? localSlideIndex : (session && session.currentSlideIndex ? session.currentSlideIndex : 0);
  const currentSlide = quiz && quiz.slides ? quiz.slides[currentSlideIndex] : undefined;
  const currentSlideId = currentSlide ? currentSlide.id : '';
  const hasAnswered = responses.some(function(r) { return r.slideId === currentSlideId; });

  // Helper to collect form responses for certificate
  const collectFormResponses = useCallback((): Record<string, Record<string, string | string[]>> => {
    const formResponses: Record<string, Record<string, string | string[]>> = {};
    
    if (quiz) {
      quiz.slides.forEach(slide => {
        if (slide.type === 'activity' && (slide as any).activityType === 'form') {
          const response = responses.find(r => r.slideId === slide.id);
          // Try to parse saved response
          if (response?.answer && typeof response.answer === 'string' && response.answer.trim()) {
            try {
              const parsed = JSON.parse(response.answer);
              if (parsed && typeof parsed === 'object') {
                formResponses[slide.id] = parsed;
              }
            } catch {
              // If not valid JSON, skip
            }
          }
          
          // If formAnswer has data for this slide
          const formSlide = slide as any;
          if (formSlide.fields && formSlide.fields.length > 0) {
            const slideFieldIds = formSlide.fields.map((f: any) => f.id);
            const hasDataForThisSlide = Object.keys(formAnswer).some(key => slideFieldIds.includes(key));
            
            if (hasDataForThisSlide && Object.keys(formAnswer).length > 0) {
              formResponses[slide.id] = formAnswer;
            }
          }
        }
      });
    }
    
    return formResponses;
  }, [quiz, responses, formAnswer]);
  const currentResponse = responses.find(function(r) { return r.slideId === currentSlideId; });
  
  // Board posts for current slide (if it's a board activity)
  const boardPosts = useBoardPosts({
    sessionId: sessionId,
    slideId: currentSlideId,
    currentUserId: studentId || undefined,
    currentUserName: name || undefined,
    sessionType: 'live',
    backend: sessionBackend,
  });
  
  // Voting for current slide (if it's a voting activity)
  const voting = useVoting({
    sessionId: sessionId,
    slideId: currentSlideId,
    currentUserId: studentId || undefined,
    currentUserName: name || undefined,
    sessionType: 'live',
    backend: sessionBackend,
  });
  
  const shouldCountInEvaluation = (activityType?: string) =>
    activityType !== 'form' &&
    activityType !== 'flashcard';

  // Only count responses where isCorrect has been set by teacher (not null/undefined)
  const correctCount = responses.filter(function(r) { return shouldCountInEvaluation(r.activityType) && r.isCorrect === true; }).length;
  const wrongCount = responses.filter(function(r) { return shouldCountInEvaluation(r.activityType) && r.isCorrect === false; }).length;
  // Count of answers submitted but not yet evaluated
  const pendingCount = responses.filter(function(r) { return shouldCountInEvaluation(r.activityType) && (r.isCorrect === null || r.isCorrect === undefined); }).length;
  const canNavigate = session && session.isLocked === false;
  
  // Require answer to proceed (for activity slides)
  const canProceed = !currentSlide || currentSlide.type !== 'activity' || hasAnswered;

  // Preload adjacent slides (previous and next) for faster navigation
  useEffect(() => {
    if (!quiz?.slides) return;
    
    const preloadSlideImages = (slide: QuizSlide | undefined) => {
      if (!slide) return;
      
      const imageUrls: string[] = [];
      
      // Check for media on activity slides
      if ((slide as any).media?.url && (slide as any).media?.type === 'image') {
        imageUrls.push((slide as any).media.url);
      }
      
      // Check for block-based layouts (info slides)
      if (slide.type === 'info') {
        const infoSlide = slide as InfoSlide;
        if (infoSlide.layout?.blocks) {
          infoSlide.layout.blocks.forEach(block => {
            if (block.type === 'image' && block.content) {
              imageUrls.push(block.content);
              if (block.gallery) {
                block.gallery.forEach(url => imageUrls.push(url));
              }
            }
          });
        }
        if (infoSlide.imageUrl) {
          imageUrls.push(infoSlide.imageUrl);
        }
      }
      
      // Check for slide background image
      if ((slide as any).slideBackground?.type === 'image' && (slide as any).slideBackground?.imageUrl) {
        imageUrls.push((slide as any).slideBackground.imageUrl);
      }
      
      // Preload each image
      imageUrls.forEach(url => {
        if (url && url.startsWith('http')) {
          const img = new Image();
          img.src = url;
        }
      });
    };
    
    // Preload previous slide
    if (currentSlideIndex > 0) {
      preloadSlideImages(quiz.slides[currentSlideIndex - 1]);
    }
    
    // Preload next slide
    if (currentSlideIndex < quiz.slides.length - 1) {
      preloadSlideImages(quiz.slides[currentSlideIndex + 1]);
    }
  }, [currentSlideIndex, quiz?.slides]);

  // ============================================
  // WIGGLE ANIMATION - triggers when clicking disabled arrow
  // ============================================
  
  const triggerWiggle = () => {
    // Scroll to the answer button and wiggle it
    try {
      if (answerButtonRef.current) {
        // Try smooth scroll, fall back to instant scroll for older browsers
        if ('scrollBehavior' in document.documentElement.style) {
          answerButtonRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          answerButtonRef.current.scrollIntoView(true);
        }
      }
    } catch (e) {
      // Ignore scroll errors on old browsers
    }
    setShowWiggle(true);
    setTimeout(function() { setShowWiggle(false); }, 800);
  };

  // ============================================
  // RENDER: CONNECTION ERROR BANNER
  // ============================================
  
  const renderConnectionBanner = () => {
    if (!connectionError && isOnline) return null;
    
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4" />
            <span className="text-sm font-medium">Offline - čekám na připojení...</span>
          </>
        ) : connectionError ? (
          <>
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{connectionError}</span>
            <button 
              onClick={reconnectToSession}
              className="ml-2 px-2 py-1 bg-white/20 rounded text-xs hover:bg-white/30"
            >
              Zkusit znovu
            </button>
          </>
        ) : null}
      </div>
    );
  };

  // ============================================
  // RENDER: RECONNECTING
  // ============================================
  
  if (isReconnecting) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Obnovuji připojení...</p>
          <p className="text-slate-400 text-sm mt-2">Chvilku strpení</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: JOIN SCREEN
  // ============================================
  
  if (!isJoined) {
    return (
      <StudentAccessShell
        icon={<Users className="w-8 h-8" />}
        title={
          boardTitle ? (
            <>
              Připojte se do:{' '}
              <span className="text-indigo-600">{boardTitle}</span>
            </>
          ) : (
            'Připojte se'
          )
        }
        subtitle={
          !code ? (
            'Zadej kód od učitele.'
          ) : isLookingUpBoard && code.length === 6 ? (
            <span className="inline-flex items-center gap-2 text-sm">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Hledám relaci...
            </span>
          ) : undefined
        }
        maxWidthClassName="max-w-xl"
        contentWidthClassName="max-w-2xl"
      >
        {renderConnectionBanner()}
        <div className="space-y-4">
          <div>
            <label
              className="block mb-2 text-sm font-semibold text-slate-600"
              style={{ letterSpacing: '-0.01em' }}
            >
              Kód relace
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD12"
              maxLength={6}
              className="w-full text-center font-mono font-black uppercase outline-none transition-all"
              style={{
                height: '78px',
                padding: '0 24px',
                fontSize: '2.1rem',
                letterSpacing: '0.12em',
                borderRadius: '20px',
                border: '2px solid #e2e8f0',
                background: '#f8fafc',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
              }}
            />
          </div>

          <div>
            <label
              className="block mb-2 text-sm font-semibold text-slate-600"
              style={{ letterSpacing: '-0.01em' }}
            >
              Jméno
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jan Novák"
              className="w-full outline-none transition-all"
              style={{
                height: '64px',
                padding: '0 20px',
                fontSize: '1.3rem',
                borderRadius: '18px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
              }}
            />
          </div>

          {error && (
            <div
              className="text-sm text-center flex items-center justify-center gap-2"
              style={{
                padding: '14px 16px',
                borderRadius: '16px',
                background: '#fef2f2',
                color: '#dc2626',
              }}
            >
              <XCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            onClick={joinSession}
            disabled={isJoining || !code || !name || !isOnline}
            className="w-full text-white font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              marginTop: '8px',
              height: '66px',
              border: 'none',
              borderRadius: '18px',
              fontSize: '1.75rem',
              background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 45%, #a855f7 100%)',
              boxShadow: '0 16px 34px rgba(124,58,237,0.28)',
            }}
          >
            {isJoining ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : !isOnline ? (
              <>
                <WifiOff className="w-5 h-5" />
                Čekám na připojení
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Připojit se
              </>
            )}
          </button>
        </div>
      </StudentAccessShell>
    );
  }

  // ============================================
  // RENDER: WAITING FOR QUIZ DATA
  // ============================================
  
  if (!quiz || !session) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        {renderConnectionBanner()}
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Načítám kvíz...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: SESSION ENDED
  // ============================================
  
  if (!session.isActive) {
    const totalQuestions = quiz.slides.filter(s => s.type === 'activity').length;
    
    // Clear saved session when it ends
    clearSavedSession();
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            Kvíz dokončen!
          </h2>
          
          <div className="bg-slate-50 rounded-2xl p-6 my-6">
            <div className="text-5xl font-bold text-green-600 mb-2">
              {totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%
            </div>
            <p className="text-slate-600">
              {correctCount} z {totalQuestions} správně
            </p>
          </div>
          
          <p className="text-slate-500">Děkujeme za účast, {name}!</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: PAUSED
  // ============================================
  
  if (session.isPaused) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center p-4">
        {renderConnectionBanner()}
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <Pause className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            Kvíz pozastaven
          </h2>
          <p className="text-slate-500">Čekej na pokračování od učitele...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: WAITING FOR SLIDE
  // ============================================
  
  if (!currentSlide) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        {renderConnectionBanner()}
        <p className="text-slate-500">Čekám na další otázku...</p>
      </div>
    );
  }

  // ============================================
  // RENDER: COMPETITION MODE (student side)
  // ============================================
  
  if (session.mode === 'competition') {
    const compPhase = session.competitionPhase;
    const compData = session.competitionData;
    const currentQSlide = currentSlide;
    const myResponse = currentQSlide ? responses.find(r => r.slideId === currentQSlide.id) : null;
    const evaluated = compData?.evaluated;
    
    // Helper: load lottie from URL with error handling
    const CompLottie = ({ url, loop = true, className = '' }: { url: string; loop?: boolean; className?: string }) => {
      const [data, setData] = React.useState<any>(null);
      const [err, setErr] = React.useState(false);
      React.useEffect(() => {
        setData(null); setErr(false);
        fetch(url)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then(json => { if (json && (json.layers || json.assets)) setData(json); else setErr(true); })
          .catch(() => setErr(true));
      }, [url]);
      if (err || !data) return null;
      return <Lottie animationData={data} loop={loop} autoplay className={className} />;
    };
    
    // COUNTDOWN
    if (compPhase === 'countdown') {
      return (
        <div className="flex items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div style={{ width: '70vmin', height: '70vmin' }}>
            <CompLottie url={COMP_ASSETS.countdown} loop={false} />
          </div>
        </div>
      );
    }
    
    // EVALUATION — student sees dark screen with their answer
    if (compPhase === 'evaluation') {
      const myAnswer = myResponse?.answer;
      let answerLabel = myAnswer ? String(myAnswer) : 'Neodpovězeno';
      
      if (currentQSlide && (currentQSlide as any).activityType === 'abc') {
        const optIdx = ((currentQSlide as any).options || []).findIndex((o: any) => o.id === myAnswer);
        answerLabel = optIdx >= 0 ? String.fromCharCode(65 + optIdx) : 'Neodpovězeno';
      }
      
      // After teacher evaluates, show success/fail
      if (evaluated && myResponse) {
        const isCorrect = myResponse.isCorrect;
        return (
          <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: isCorrect ? '#00DE69' : '#dc2626' }}>
            {isCorrect ? (
              <>
                <div style={{ width: '60vmin', height: '60vmin' }}>
                  <CompLottie url={COMP_ASSETS.celebrate} loop={false} />
                </div>
                <h2 className="text-4xl font-black text-emerald-300 mt-4">Správně!</h2>
                <p className="text-emerald-400/60 text-lg mt-2">+1 bod</p>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center">
                  <div style={{ width: '45vmin', height: '45vmin' }}>
                    <Lottie animationData={sadFaceLottie} loop autoplay />
                  </div>
                  <h2 className="text-4xl font-black text-white/90 mt-2">Škoda!</h2>
                  <p className="text-white/40 text-lg mt-2">Příště to bude lepší</p>
                  <div className="mt-5 px-6 py-3 rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                    <p className="text-white/50 text-sm">Tvá odpověď: <span className="font-bold text-white/70">{answerLabel}</span></p>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      }
      
      // Before evaluation — show what the student answered
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <p className="text-slate-400 text-lg mb-4">Tvá odpověď</p>
          <div className="px-8 py-4 rounded-2xl text-3xl font-bold text-white" style={{ backgroundColor: '#7C3AED' }}>
            {answerLabel}
          </div>
          <p className="text-slate-500 text-sm mt-6">Čekám na vyhodnocení...</p>
        </div>
      );
    }
    
    // RESULTS — show student's rank
    if (compPhase === 'results') {
      const scores = compData?.scores || {};
      const sorted = Object.entries(scores).sort(([,a], [,b]) => (b as number) - (a as number));
      const myRank = sorted.findIndex(([id]) => id === studentId) + 1;
      const rankForAnim = Math.min(myRank || 99, 10);
      
      return (
        <div className="flex flex-col h-screen w-full" style={{ backgroundColor: '#ffffff' }}>
          {/* "Gratulujeme k N. místu!" at top */}
          <div className="flex items-center justify-center pb-4 flex-shrink-0" style={{ paddingTop: 80 }}>
            <h1 className="text-4xl font-black text-slate-800">Gratulujeme k {myRank}. místu!</h1>
          </div>
          
          {/* Animation — fills remaining space, anchored to bottom */}
          <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
            <div className="absolute bottom-0 left-0 right-0">
              <CompLottie url={COMP_ASSETS.rank(rankForAnim)} loop className="w-full" />
            </div>
          </div>
        </div>
      );
    }
    
    // LOBBY — student waits for start
    if (compPhase === 'lobby' || !compPhase) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div style={{ width: '55vmin', height: '55vmin' }}>
            <CompLottie url={COMP_ASSETS.drum} loop />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Připraven!</h1>
          <p className="text-slate-300">Čekám na zahájení soutěže...</p>
        </div>
      );
    }
    
    // QUESTION phase — falls through to normal quiz rendering below
    // (student answers normally using the existing quiz UI)
  }

  // ============================================
  // RENDER: TEAM COMPETITION MODE (student side)
  // ============================================

  if (session.mode === 'team-competition') {
    const compPhase = session.competitionPhase;
    const tData = session.teamCompetitionData;
    const currentQSlide = currentSlide;
    const myResponse = currentQSlide ? responses.find(r => r.slideId === currentQSlide.id) : null;
    const evaluated = tData?.evaluated;

    // My team info
    const myTeamId = tData?.studentTeamMap?.[studentId || ''];
    const myTeam = myTeamId ? tData?.teams?.[myTeamId] : null;
    const isActivePlayer = myTeamId ? tData?.activePlayerMap?.[myTeamId] === studentId : false;
    const activePlayerName = myTeamId && tData?.activePlayerMap?.[myTeamId]
      ? session.students?.[tData.activePlayerMap[myTeamId]]?.name || '?'
      : '';
    const roundType = tData?.currentRoundType || 'normal';

    const CompLottie = ({ url, loop = true, className = '' }: { url: string; loop?: boolean; className?: string }) => {
      const [data, setData] = React.useState<any>(null);
      const [err, setErr] = React.useState(false);
      React.useEffect(() => {
        setData(null); setErr(false);
        fetch(url)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then(json => { if (json && (json.layers || json.assets)) setData(json); else setErr(true); })
          .catch(() => setErr(true));
      }, [url]);
      if (err || !data) return null;
      return <Lottie animationData={data} loop={loop} autoplay className={className} />;
    };

    // COUNTDOWN
    if (compPhase === 'countdown') {
      return (
        <div className="flex items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div style={{ width: '70vmin', height: '70vmin' }}>
            <CompLottie url={COMP_ASSETS.countdown} loop={false} />
          </div>
        </div>
      );
    }

    // EVALUATION
    if (compPhase === 'evaluation') {
      const myAnswer = myResponse?.answer;
      let answerLabel = myAnswer ? String(myAnswer) : 'Neodpovězeno';

      if (currentQSlide && (currentQSlide as any).activityType === 'abc') {
        const optIdx = ((currentQSlide as any).options || []).findIndex((o: any) => o.id === myAnswer);
        answerLabel = optIdx >= 0 ? String.fromCharCode(65 + optIdx) : 'Neodpovězeno';
      }

      if (evaluated && myResponse) {
        const isCorrect = myResponse.isCorrect;
        const points = roundType === 'double' ? 2 : 1;
        return (
          <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: isCorrect ? '#00DE69' : '#dc2626' }}>
            {myTeam && (
              <div className="flex items-center gap-2 mb-6 px-5 py-2.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}>
                <span className="text-2xl">{myTeam.emoji}</span>
                <span className="font-bold text-white">{myTeam.name}</span>
              </div>
            )}
            {isCorrect ? (
              <>
                <div style={{ width: '50vmin', height: '50vmin' }}>
                  <CompLottie url={COMP_ASSETS.celebrate} loop={false} />
                </div>
                <h2 className="text-4xl font-black text-emerald-300 mt-4">Správně!</h2>
                <p className="text-emerald-400/60 text-lg mt-2">+{points} {points > 1 ? 'body' : 'bod'} pro tým</p>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center">
                  <div style={{ width: '45vmin', height: '45vmin' }}>
                    <Lottie animationData={sadFaceLottie} loop autoplay />
                  </div>
                  <h2 className="text-4xl font-black text-white/90 mt-2">Škoda!</h2>
                  <p className="text-white/40 text-lg mt-2">Příště to bude lepší</p>
                  {isActivePlayer && (
                    <div className="mt-5 px-6 py-3 rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                      <p className="text-white/50 text-sm">Tvá odpověď: <span className="font-bold text-white/70">{answerLabel}</span></p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          {myTeam && (
            <div className="flex items-center gap-2 mb-6 px-4 py-2 rounded-full" style={{ backgroundColor: `${myTeam.color}30` }}>
              <span className="text-xl">{myTeam.emoji}</span>
              <span className="font-bold text-sm" style={{ color: myTeam.color }}>{myTeam.name}</span>
            </div>
          )}
          {isActivePlayer ? (
            <>
              <p className="text-slate-400 text-lg mb-4">Tvá odpověď</p>
              <div className="px-8 py-4 rounded-2xl text-3xl font-bold text-white" style={{ backgroundColor: myTeam?.color || '#7C3AED' }}>
                {answerLabel}
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-lg">Čekám na vyhodnocení...</p>
          )}
          <p className="text-slate-500 text-sm mt-6">Čekám na vyhodnocení...</p>
        </div>
      );
    }

    // RESULTS
    if (compPhase === 'results') {
      const teamsSorted = tData?.teams
        ? Object.entries(tData.teams).sort(([, a], [, b]) => b.score - a.score)
        : [];
      const myTeamRank = teamsSorted.findIndex(([tid]) => tid === myTeamId) + 1;
      const rankForAnim = Math.min(myTeamRank || 99, 10);

      return (
        <div className="flex flex-col lg:flex-row h-screen w-full" style={{ backgroundColor: '#ffffff' }}>
          {/* Text section - stacked top on mobile, left 50% on desktop */}
          <div className="flex flex-col items-center justify-center flex-shrink-0 lg:min-h-0" style={{ paddingTop: 60, paddingBottom: 20, flex: '1 1 50%' }}>
            {myTeam && (
              <div className="flex items-center gap-2 mb-3 px-5 py-2 rounded-full" style={{ backgroundColor: `${myTeam.color}20` }}>
                <span className="text-2xl">{myTeam.emoji}</span>
                <span className="text-lg font-bold" style={{ color: myTeam.color }}>{myTeam.name}</span>
              </div>
            )}
            <h1 className="text-4xl lg:text-6xl font-black text-slate-800">
              {myTeamRank === 1 ? 'Vyhráli jste!' : `${myTeamRank}. místo!`}
            </h1>
            {/* Desktop: show team scores */}
            <div className="hidden lg:flex flex-col items-center mt-8 gap-2">
              {teamsSorted.map(([tid, team], idx) => (
                <div key={tid} className="flex items-center gap-3 px-5 py-2 rounded-xl" style={{ backgroundColor: tid === myTeamId ? `${team.color}15` : 'transparent' }}>
                  <span className="text-lg font-black text-slate-400 w-6 text-right">{idx + 1}.</span>
                  <span className="text-xl">{team.emoji}</span>
                  <span className="font-bold text-slate-700">{team.name}</span>
                  <span className="font-black text-slate-500 ml-2">{team.score} b.</span>
                </div>
              ))}
            </div>
          </div>
          {/* Animation section - bottom on mobile, right 50% on desktop */}
          <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0, flex: '1 1 50%' }}>
            <div className="absolute bottom-0 left-0 right-0 lg:inset-0 lg:flex lg:items-end">
              <CompLottie url={COMP_ASSETS.rank(rankForAnim)} loop className="w-full" />
            </div>
          </div>
        </div>
      );
    }

    // LOBBY — student sees their team
    if (compPhase === 'lobby' || !compPhase) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: myTeam ? `${myTeam.color}18` : '#4E5871' }}>
          {myTeam ? (
            <>
              <div className="rounded-full flex items-center justify-center mb-4" style={{ width: 140, height: 140, backgroundColor: `${myTeam.color}25` }}>
                <span style={{ fontSize: '5rem', lineHeight: 1 }}>{myTeam.emoji}</span>
              </div>
              <h1 className="text-4xl font-black mb-1" style={{ color: myTeam.color }}>{myTeam.name}</h1>
              <p className="text-lg font-medium mb-8" style={{ color: `${myTeam.color}99` }}>Tvůj tým</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-xs">
                {(myTeam.memberIds || []).map(mid => {
                  const s = session.students?.[mid];
                  return s ? (
                    <span key={mid} className="px-4 py-2 rounded-full text-sm font-bold" style={{ backgroundColor: `${myTeam.color}30`, color: myTeam.color }}>
                      {s.name}{mid === studentId ? ' (ty)' : ''}
                    </span>
                  ) : null;
                })}
              </div>
            </>
          ) : (
            <>
              <div style={{ width: '55vmin', height: '55vmin' }}>
                <CompLottie url={COMP_ASSETS.drum} loop />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Připraven!</h1>
              <p className="text-slate-300">Řadím do týmu...</p>
            </>
          )}
        </div>
      );
    }

    // QUESTION phase — TIP ROUND special case
    if (compPhase === 'question' && tData?.tipRoundActive && !isActivePlayer) {
      const myVote = tData.tipVotes?.[studentId || ''];
      const hasVoted = myVote !== undefined;

      return (
        <div className="flex flex-col items-center justify-center h-screen w-full relative overflow-hidden" style={{ backgroundColor: '#4E5871' }}>
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'linear-gradient(135deg, #10B981, #06B6D4, #10B981, #34D399)',
            backgroundSize: '300% 300%',
            animation: 'specialGradientShift 3s ease infinite',
            opacity: 0.25,
          }} />
          <div className="relative z-10 flex flex-col items-center">
          {myTeam && (
            <div className="flex items-center gap-2 mb-4 px-4 py-2 rounded-full" style={{ backgroundColor: `${myTeam.color}30` }}>
              <span className="text-xl">{myTeam.emoji}</span>
              <span className="font-bold text-sm" style={{ color: myTeam.color }}>{myTeam.name}</span>
            </div>
          )}
          <h2 className="text-2xl font-bold text-white mb-2">Tip kolo!</h2>
          <p className="text-slate-300 mb-6 text-center px-8">
            Myslíš, že <span className="font-bold text-white">{activePlayerName}</span> odpověděl/a správně?
          </p>

          {hasVoted ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: myVote ? '#10b98130' : '#ef444430' }}>
                {myVote ? <ThumbsUp className="w-10 h-10 text-emerald-400" /> : <ThumbsDown className="w-10 h-10 text-red-400" />}
              </div>
              <p className="text-slate-400 text-sm">Hlasováno!</p>
            </div>
          ) : (
            <div className="flex gap-6">
              <button
                onClick={() => {
                  if (studentId && session.teamCompetitionData) {
                    updateLiveSessionRecord(sessionBackend, session.id, {
                      teamCompetitionData: {
                        ...session.teamCompetitionData,
                        tipVotes: {
                          ...(session.teamCompetitionData.tipVotes || {}),
                          [studentId]: true,
                        },
                      },
                    });
                  }
                }}
                className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all hover:scale-110 active:scale-95"
                style={{ backgroundColor: '#10b981' }}
              >
                <ThumbsUp className="w-10 h-10 text-white" />
                <span className="text-xs text-white font-bold">ANO</span>
              </button>
              <button
                onClick={() => {
                  if (studentId && session.teamCompetitionData) {
                    updateLiveSessionRecord(sessionBackend, session.id, {
                      teamCompetitionData: {
                        ...session.teamCompetitionData,
                        tipVotes: {
                          ...(session.teamCompetitionData.tipVotes || {}),
                          [studentId]: false,
                        },
                      },
                    });
                  }
                }}
                className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all hover:scale-110 active:scale-95"
                style={{ backgroundColor: '#ef4444' }}
              >
                <ThumbsDown className="w-10 h-10 text-white" />
                <span className="text-xs text-white font-bold">NE</span>
              </button>
            </div>
          )}
          </div>
        </div>
      );
    }

    // QUESTION phase — not active player (waiting)
    if (compPhase === 'question' && !isActivePlayer && roundType !== 'power') {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full relative overflow-hidden" style={{ backgroundColor: '#4E5871' }}>
          {roundType === 'double' && (
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'linear-gradient(135deg, #F59E0B, #EF4444, #F59E0B, #FF6B00)',
              backgroundSize: '300% 300%',
              animation: 'specialGradientShift 3s ease infinite, specialPulseOpacity 2s ease-in-out infinite',
            }} />
          )}
          <div className="relative z-10 flex flex-col items-center">
            {roundType === 'double' && (
              <div className="flex items-center gap-2 mb-4 px-5 py-2.5 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(245,158,11,0.3)' }}>
                <span className="text-2xl font-black text-amber-300">x2</span>
                <span className="text-white font-bold text-sm">Dvojité body!</span>
              </div>
            )}
            {myTeam && (
              <div className="flex items-center gap-2 mb-6 px-4 py-2 rounded-full" style={{ backgroundColor: `${myTeam.color}30` }}>
                <span className="text-xl">{myTeam.emoji}</span>
                <span className="font-bold text-sm" style={{ color: myTeam.color }}>{myTeam.name}</span>
              </div>
            )}
            <p className="text-slate-300 text-lg mb-2">Odpovídá</p>
            <h2 className="text-3xl font-bold text-white mb-6">{activePlayerName}</h2>
            <div className="w-16 h-16 rounded-full flex items-center justify-center animate-pulse" style={{ backgroundColor: 'rgba(124,58,237,0.3)' }}>
              <Users className="w-8 h-8 text-white" />
            </div>
            <p className="text-slate-400 text-sm mt-6">Drž palce!</p>
          </div>
        </div>
      );
    }

    // QUESTION phase — active player OR power round (everyone answers)
    // Falls through to normal quiz rendering below
  }

  // ============================================
  // RENDER: DUEL COMPETITION MODE (student side)
  // ============================================

  if (session.mode === 'duel-competition') {
    const compPhase = session.competitionPhase;
    const dData = session.duelCompetitionData;
    const currentQSlide = currentSlide;
    const myResponse = currentQSlide ? responses.find(r => r.slideId === currentQSlide.id) : null;
    const evaluated = dData?.evaluated;

    const myDuelId = dData?.studentDuelMap?.[studentId || ''];
    const myDuel = myDuelId ? dData?.duels?.[myDuelId] : null;
    const opponents = myDuel ? myDuel.playerIds.filter(pid => pid !== studentId) : [];
    const opponentNames = opponents.map(pid => session.students?.[pid]?.name || '?');
    const isTriple = myDuel ? myDuel.playerIds.length > 2 : false;
    const myScore = myDuel?.scores?.[studentId || ''] || 0;

    const DuelCompLottie = ({ url, loop = true, className = '' }: { url: string; loop?: boolean; className?: string }) => {
      const [data, setData] = React.useState<any>(null);
      const [err, setErr] = React.useState(false);
      React.useEffect(() => {
        setData(null); setErr(false);
        fetch(url)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then(json => { if (json && (json.layers || json.assets)) setData(json); else setErr(true); })
          .catch(() => setErr(true));
      }, [url]);
      if (err || !data) return null;
      return <Lottie animationData={data} loop={loop} autoplay className={className} />;
    };

    // COUNTDOWN
    if (compPhase === 'countdown') {
      return (
        <div className="flex items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div style={{ width: '70vmin', height: '70vmin' }}>
            <DuelCompLottie url={COMP_ASSETS.countdown} loop={false} />
          </div>
        </div>
      );
    }

    // EVALUATION
    if (compPhase === 'evaluation') {
      const myAnswer = myResponse?.answer;
      let answerLabel = myAnswer ? String(myAnswer) : 'Neodpovězeno';

      if (currentQSlide && (currentQSlide as any).activityType === 'abc') {
        const optIdx = ((currentQSlide as any).options || []).findIndex((o: any) => o.id === myAnswer);
        answerLabel = optIdx >= 0 ? String.fromCharCode(65 + optIdx) : 'Neodpovězeno';
      }

      if (evaluated && myResponse) {
        const isCorrect = myResponse.isCorrect;

        // Check if I won this round vs opponents
        const opponentResults = opponents.map(pid => {
          const s = session.students?.[pid];
          const resp = (s?.responses || []).find((r: any) => r.slideId === currentQSlide?.id);
          return resp?.isCorrect || false;
        });
        const allOpponentsWrong = opponentResults.every(r => !r);
        const iWon = isCorrect && allOpponentsWrong;

        return (
          <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: isCorrect ? '#00DE69' : '#dc2626' }}>
            {/* Duel score badge */}
            <div className="flex items-center gap-3 mb-6 px-5 py-2.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}>
              <span className="font-bold text-white">{name}</span>
              <span className="text-2xl font-black text-white">{myScore}</span>
              <span className="font-black text-white/60">:</span>
              {opponents.map((pid, i) => (
                <React.Fragment key={pid}>
                  <span className="text-2xl font-black text-white">{myDuel?.scores?.[pid] || 0}</span>
                  <span className="font-bold text-white">{opponentNames[i]}</span>
                </React.Fragment>
              ))}
            </div>

            {isCorrect ? (
              <>
                <div style={{ width: '50vmin', height: '50vmin' }}>
                  <DuelCompLottie url={COMP_ASSETS.celebrate} loop={false} />
                </div>
                <h2 className="text-4xl font-black text-white mt-4">
                  {iWon ? 'Jen ty správně!' : 'Správně!'}
                </h2>
                <p className="text-white/60 text-lg mt-2">
                  {iWon ? '+2 body!' : '+1 bod'}
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center">
                  <div style={{ width: '45vmin', height: '45vmin' }}>
                    <Lottie animationData={sadFaceLottie} loop autoplay />
                  </div>
                  <h2 className="text-4xl font-black text-white/90 mt-2">Škoda!</h2>
                  <p className="text-white/40 text-lg mt-2">Příště to bude lepší</p>
                  <div className="mt-5 px-6 py-3 rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                    <p className="text-white/50 text-sm">Tvá odpověď: <span className="font-bold text-white/70">{answerLabel}</span></p>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      }

      // Waiting for evaluation
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div className="flex items-center gap-3 mb-6 px-5 py-2.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <span className="font-bold text-white">{name}</span>
            <span className="text-2xl font-black text-white">{myScore}</span>
            <span className="font-black text-white/60">:</span>
            {opponents.map((pid, i) => (
              <React.Fragment key={pid}>
                <span className="text-2xl font-black text-white">{myDuel?.scores?.[pid] || 0}</span>
                <span className="font-bold text-white">{opponentNames[i]}</span>
              </React.Fragment>
            ))}
          </div>
          <p className="text-slate-400 text-lg mb-4">Tvá odpověď</p>
          <div className="px-8 py-4 rounded-2xl text-3xl font-bold text-white" style={{ backgroundColor: '#FF6B35' }}>
            {answerLabel}
          </div>
          <p className="text-slate-500 text-sm mt-6">Čekám na vyhodnocení...</p>
        </div>
      );
    }

    // RESULTS
    if (compPhase === 'results') {
      if (!myDuel) {
        return (
          <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#ffffff' }}>
            <h1 className="text-3xl font-bold text-slate-800">Soutěž skončila!</h1>
          </div>
        );
      }

      // Determine my rank in the duel
      const sorted = [...myDuel.playerIds].sort((a, b) => (myDuel.scores[b] || 0) - (myDuel.scores[a] || 0));
      const myRank = sorted.indexOf(studentId || '') + 1;
      const topScore = myDuel.scores[sorted[0]] || 0;
      const isTie = sorted.length > 1 && myScore === topScore && myScore > 0;
      const iWon = myRank === 1 && !isTie && topScore > 0;
      const rankForAnim = iWon ? 1 : isTie ? 2 : Math.min(myRank + 1, 10);

      return (
        <div className="flex flex-col lg:flex-row h-screen w-full" style={{ backgroundColor: '#ffffff' }}>
          <div className="flex flex-col items-center justify-center flex-shrink-0 lg:min-h-0" style={{ paddingTop: 60, paddingBottom: 20, flex: '1 1 50%' }}>
            <h1 className="text-4xl lg:text-6xl font-black text-slate-800 mb-4">
              {iWon ? 'Vyhrál/a jsi!' : isTie ? 'Remíza!' : 'Prohrál/a jsi'}
            </h1>

            {/* Duel final score */}
            <div className="flex items-center gap-4 mb-8">
              {myDuel.playerIds.map((pid, i) => {
                const s = session.students?.[pid];
                const isMe = pid === studentId;
                return (
                  <React.Fragment key={pid}>
                    {i > 0 && <span className="text-2xl font-black text-slate-300">:</span>}
                    <div className="flex flex-col items-center">
                      <span className={`text-5xl font-black ${isMe ? 'text-orange-500' : 'text-slate-400'}`}>
                        {myDuel.scores[pid] || 0}
                      </span>
                      <span className={`text-sm font-bold mt-1 ${isMe ? 'text-orange-500' : 'text-slate-400'}`}>
                        {isMe ? name : s?.name || '?'}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
          <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0, flex: '1 1 50%' }}>
            <div className="absolute bottom-0 left-0 right-0 lg:inset-0 lg:flex lg:items-end">
              <DuelCompLottie url={COMP_ASSETS.rank(rankForAnim)} loop className="w-full" />
            </div>
          </div>
        </div>
      );
    }

    // LOBBY
    if (compPhase === 'lobby' || !compPhase) {
      if (myDuel) {
        // Duels created: show VS screen
        return (
          <div className="flex flex-col items-center justify-center h-screen w-full relative overflow-hidden" style={{ backgroundColor: '#1e2533' }}>
            {/* Pulsing background */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'linear-gradient(135deg, #FF6B35, #EF4444, #FF6B35, #F59E0B)',
              backgroundSize: '300% 300%',
              animation: 'specialGradientShift 3s ease infinite',
              opacity: 0.15,
            }} />
            <div className="relative z-10 flex flex-col items-center">
              <h2 className="text-lg font-bold text-white/60 mb-8 uppercase tracking-widest">Tvůj souboj</h2>
              <div className="flex items-center gap-6">
                {/* My name */}
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-white" style={{ backgroundColor: '#FF6B35' }}>
                    {(name || '?')[0]?.toUpperCase()}
                  </div>
                  <span className="text-white font-bold mt-3 text-lg">{name}</span>
                  <span className="text-xs text-white/40">(ty)</span>
                </div>

                <span className="text-4xl font-black" style={{ color: '#FF6B35' }}>VS</span>

                {/* Opponents */}
                {opponents.map((pid, i) => {
                  const oppName = opponentNames[i];
                  return (
                    <React.Fragment key={pid}>
                      {i > 0 && <span className="text-4xl font-black" style={{ color: '#FF6B35' }}>VS</span>}
                      <div className="flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-white" style={{ backgroundColor: '#EF4444' }}>
                          {(oppName || '?')[0]?.toUpperCase()}
                        </div>
                        <span className="text-white font-bold mt-3 text-lg">{oppName}</span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
              <p className="text-slate-400 text-sm mt-10">Čekám na zahájení...</p>
            </div>
          </div>
        );
      }

      // Waiting to be paired
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div style={{ width: '55vmin', height: '55vmin' }}>
            <CompLottie url={COMP_ASSETS.drum} loop />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Připraven!</h1>
          <p className="text-slate-300">Čekám na rozlosování...</p>
        </div>
      );
    }

    // QUESTION phase — falls through to normal quiz rendering below
    // The VS banner will be added separately
  }

  // ============================================
  // TACTICAL COMPETITION MODE (student view)
  // ============================================
  if (session.mode === 'tactical-competition') {
    const compPhase = session.competitionPhase;
    const tacData = session.tacticalCompetitionData;
    const myScore = tacData?.scores?.[studentId || ''] || 0;
    const myStreak = tacData?.streaks?.[studentId || ''] || 0;
    const myPowerUps = tacData?.powerUps?.[studentId || ''] || {};
    const isBlocked = tacData?.blockedPlayers?.[studentId || ''];
    const myChoice = tacData?.choices?.[studentId || ''];
    const myTreasureOffer = tacData?.treasureOffers?.[studentId || ''];
    const isPowerRound = tacData?.isPowerRound;
    const basePoints = isPowerRound ? 6 : 3;
    const streakBonus = myStreak >= 3 ? 1 : 0;

    const TREASURE_INFO_LOCAL: Record<string, { emoji: string; label: string; desc: string; color: string }> = {
      double: { emoji: '💰', label: 'Dvojnásobek', desc: `+${(basePoints + streakBonus) * 2} bodů místo ${basePoints + streakBonus}`, color: '#F59E0B' },
      sabotage: { emoji: '💣', label: 'Sabotáž', desc: `Uber ${isPowerRound ? 5 : 3} body soupeři`, color: '#EF4444' },
      block: { emoji: '🚫', label: 'Blokáda', desc: 'Zablokuj soupeře na kolo', color: '#8B5CF6' },
      shield: { emoji: '🛡️', label: 'Štít', desc: 'Ochrana před sabotáží', color: '#3B82F6' },
      xray: { emoji: '👁️', label: 'Rentgen', desc: 'Uvidíš správnou odpověď', color: '#10B981' },
      timeBoost: { emoji: '⏰', label: 'Čas+', desc: '+15s na příští otázku', color: '#06B6D4' },
    };

    const CompLottie = ({ url, loop = true, className = '' }: { url: string; loop?: boolean; className?: string }) => {
      const [data, setData] = React.useState<any>(null);
      const [err, setErr] = React.useState(false);
      React.useEffect(() => {
        setData(null); setErr(false);
        fetch(url)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then(json => { if (json && (json.layers || json.assets)) setData(json); else setErr(true); })
          .catch(() => setErr(true));
      }, [url]);
      if (err || !data) return null;
      return <Lottie animationData={data} loop={loop} autoplay className={className} />;
    };

    // Helper: student picks "safe points" — adds base points
    const chooseSafePoints = () => {
      if (!tacData || !studentId) return;
      const points = basePoints + streakBonus;
      const updatedScores = { ...tacData.scores, [studentId]: (tacData.scores[studentId] || 0) + points };
      const updatedChoices = { ...tacData.choices, [studentId]: 'points' as const };
      updateLiveSessionRecord(sessionBackend, session.id, {
        tacticalCompetitionData: { ...tacData, scores: updatedScores, choices: updatedChoices },
      });
    };

    // Helper: student picks a treasure INSTEAD of safe points
    const chooseTreasure = (treasure: TreasureType) => {
      if (!tacData || !studentId || !myTreasureOffer) return;
      const updatedOffers = { ...tacData.treasureOffers, [studentId]: { ...myTreasureOffer, picked: treasure } };

      if (treasure === 'sabotage' || treasure === 'block') {
        // Keep choice as 'pending' — target selection screen comes next
        updateLiveSessionRecord(sessionBackend, session.id, {
          tacticalCompetitionData: {
            ...tacData,
            treasureOffers: updatedOffers,
          },
        });
        return;
      }

      // Non-targeted treasures: apply effect and mark as 'treasure'
      const updatedChoices = { ...tacData.choices, [studentId]: 'treasure' as const };
      let updatedScores = { ...tacData.scores };
      let updatedPowerUps = { ...tacData.powerUps };
      let updatedEvents = [...(tacData.events || [])];
      const myName = name || '?';

      if (treasure === 'double') {
        // Give 2x the base points instead of 1x
        const doublePoints = (basePoints + streakBonus) * 2;
        updatedScores[studentId] = (updatedScores[studentId] || 0) + doublePoints;
        updatedEvents.push({ id: `${Date.now()}`, type: 'double', fromName: myName, points: doublePoints, timestamp: new Date().toISOString() });
      } else if (treasure === 'shield') {
        updatedPowerUps[studentId] = { ...updatedPowerUps[studentId], shield: true };
      } else if (treasure === 'xray') {
        updatedPowerUps[studentId] = { ...updatedPowerUps[studentId], xray: true };
      } else if (treasure === 'timeBoost') {
        updatedPowerUps[studentId] = { ...updatedPowerUps[studentId], timeBoost: true };
      }

      updateLiveSessionRecord(sessionBackend, session.id, {
        tacticalCompetitionData: {
          ...tacData,
          scores: updatedScores,
          choices: updatedChoices,
          treasureOffers: updatedOffers,
          powerUps: updatedPowerUps,
          events: updatedEvents,
        },
      });
    };

    // Helper: apply sabotage/block to a target — finalizes the choice
    const applyTargetedTreasure = (targetId: string) => {
      if (!tacData || !studentId || !myTreasureOffer?.picked) return;
      const treasure = myTreasureOffer.picked;
      let updatedScores = { ...tacData.scores };
      let updatedPowerUps = { ...tacData.powerUps };
      let updatedEvents = [...(tacData.events || [])];
      let updatedBlocked = { ...tacData.blockedPlayers };
      const updatedChoices = { ...tacData.choices, [studentId]: 'treasure' as const };
      const updatedOffers = { ...tacData.treasureOffers, [studentId]: { ...myTreasureOffer, target: targetId } };

      const myName = name || '?';
      const targetName = session.students?.[targetId]?.name || '?';
      const targetHasShield = updatedPowerUps[targetId]?.shield;

      if (treasure === 'sabotage') {
        if (targetHasShield) {
          updatedPowerUps[targetId] = { ...updatedPowerUps[targetId], shield: false };
          updatedEvents.push({ id: `${Date.now()}`, type: 'shield_block', fromName: myName, toName: targetName, timestamp: new Date().toISOString() });
        } else {
          const points = isPowerRound ? 5 : 3;
          updatedScores[targetId] = Math.max(0, (updatedScores[targetId] || 0) - points);
          updatedEvents.push({ id: `${Date.now()}`, type: 'sabotage', fromName: myName, toName: targetName, points, timestamp: new Date().toISOString() });
        }
      } else if (treasure === 'block') {
        if (targetHasShield) {
          updatedPowerUps[targetId] = { ...updatedPowerUps[targetId], shield: false };
          updatedEvents.push({ id: `${Date.now()}`, type: 'shield_block', fromName: myName, toName: targetName, timestamp: new Date().toISOString() });
        } else {
          updatedBlocked[targetId] = myName;
          updatedEvents.push({ id: `${Date.now()}`, type: 'block', fromName: myName, toName: targetName, timestamp: new Date().toISOString() });
        }
      }

      updateLiveSessionRecord(sessionBackend, session.id, {
        tacticalCompetitionData: {
          ...tacData,
          scores: updatedScores,
          choices: updatedChoices,
          powerUps: updatedPowerUps,
          events: updatedEvents,
          blockedPlayers: updatedBlocked,
          treasureOffers: updatedOffers,
        },
      });
    };

    // LOBBY
    if (compPhase === 'lobby' || !compPhase) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div style={{ width: '55vmin', height: '55vmin' }}>
            <CompLottie url={COMP_ASSETS.drum} loop />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Připraven!</h1>
          <p className="text-slate-300">Čekám na zahájení soutěže...</p>
        </div>
      );
    }

    // COUNTDOWN
    if (compPhase === 'countdown') {
      return (
        <div className="flex items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div style={{ width: '70vmin', height: '70vmin' }}>
            <CompLottie url={COMP_ASSETS.countdown} loop={false} />
          </div>
        </div>
      );
    }

    // EVALUATION — choice phase for correct answers
    if (compPhase === 'evaluation' && tacData?.evaluated) {
      // Check if student answered correctly
      const currentQSlide = quiz.slides[session.currentSlideIndex];
      const myResponse = (session.students?.[studentId || '']?.responses || []).find(
        (r: any) => r.slideId === currentQSlide?.id
      );
      const wasCorrect = myResponse?.isCorrect;

      // BLOCKED
      if (isBlocked) {
        return (
          <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
            <div className="text-6xl mb-4">🚫</div>
            <h1 className="text-2xl font-bold text-white mb-2">Zablokováno!</h1>
            <p className="text-slate-300">{isBlocked} tě zablokoval na toto kolo</p>
          </div>
        );
      }

      // WRONG ANSWER
      if (!wasCorrect) {
        return (
          <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#EF4444' }}>
            <div className="text-7xl mb-4">😔</div>
            <h1 className="text-3xl font-bold text-white mb-2">Škoda!</h1>
            <p className="text-white/80">Tentokrát žádné body</p>
            <div className="mt-6 px-6 py-3 rounded-2xl bg-white/20">
              <span className="text-white font-bold text-xl">Skóre: {myScore}</span>
            </div>
          </div>
        );
      }

      // CORRECT — CHOICE PHASE
      if (myChoice === 'pending' && tacData.choicePhaseActive) {
        // Need to pick sabotage/block target?
        if (myTreasureOffer?.picked === 'sabotage' || myTreasureOffer?.picked === 'block') {
          if (!myTreasureOffer?.target) {
            const treasure = myTreasureOffer.picked;
            const info = TREASURE_INFO_LOCAL[treasure];
            const otherStudents = Object.entries(session.students || {}).filter(([id]) => id !== studentId && session.students?.[id]?.isOnline);
            return (
              <div className="flex flex-col items-center justify-center h-screen w-full p-6" style={{ backgroundColor: info.color }}>
                <div className="text-5xl mb-4">{info.emoji}</div>
                <h1 className="text-2xl font-bold text-white mb-2">Vyber cíl!</h1>
                <p className="text-white/80 mb-6">{info.desc}</p>
                <div className="flex flex-wrap gap-3 justify-center max-w-md">
                  {otherStudents.map(([id, s]) => (
                    <button
                      key={id}
                      onClick={() => applyTargetedTreasure(id)}
                      className="px-5 py-3 rounded-xl bg-white/20 text-white font-bold text-lg hover:bg-white/30 transition-all active:scale-95"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          }
        }

        // Main choice: safe points or treasure (two-step flow)
        // Step 1: Choose between safe points or "risk it"
        if (!showTreasureOptions) {
          return (
          <div className="flex flex-col items-center justify-center h-screen w-full p-5" style={{
            backgroundColor: isPowerRound ? '#F59E0B' : '#10B981',
          }}>
            <div className="text-7xl mb-3">🎉</div>
            <h1 className="text-4xl font-black text-white mb-2">Správně!</h1>
            {myStreak >= 3 && (
              <div className="px-4 py-1 rounded-full mb-2" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                <span className="text-yellow-300 font-bold text-sm">🔥 Série {myStreak}!</span>
              </div>
            )}
            <p className="text-white/80 font-bold text-xl mb-5">Co si vybereš?</p>

              <div className="w-full max-w-sm flex flex-col gap-4">
                {/* Take points */}
            <button
              onClick={chooseSafePoints}
              className="w-full px-6 py-7 rounded-3xl transition-all active:scale-95 text-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.95)' }}
            >
              <div className="text-5xl font-black" style={{ color: '#059669' }}>+{basePoints + streakBonus} bodů</div>
              <p className="text-slate-400 text-base mt-2 font-medium">Jistota</p>
            </button>

                {/* Risk it — open treasure instead */}
                <button
                  onClick={() => setShowTreasureOptions(true)}
                  className="w-full px-6 py-7 rounded-3xl transition-all active:scale-95 text-center"
                  style={{ backgroundColor: '#7C3AED' }}
                >
                  <div className="text-5xl mb-1">🎲</div>
                  <div className="text-2xl font-black text-white">Otevřít truhlu!</div>
                  <p className="text-white/70 text-sm mt-1">Žádné body, ale bonus!</p>
                </button>
              </div>

            </div>
          );
        }

        // Step 2: Pick a treasure
        return (
          <div className="flex flex-col items-center justify-center h-screen w-full p-5" style={{
            backgroundColor: '#4C1D95',
          }}>
            <h1 className="text-3xl font-black text-white mb-6" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>Vyber si bonus!</h1>

            <div className="flex flex-col gap-4 w-full max-w-md">
              {(myTreasureOffer?.options || []).map((t: TreasureType) => {
                const info = TREASURE_INFO_LOCAL[t];
                return (
                  <button
                    key={t}
                    onClick={() => { chooseTreasure(t); setShowTreasureOptions(false); }}
                    className="w-full flex items-center gap-5 px-6 py-6 rounded-2xl transition-all active:scale-95"
                    style={{
                      backgroundColor: info.color,
                    }}
                  >
                    <span className="text-5xl flex-shrink-0">{info.emoji}</span>
                    <div className="flex-1 text-left">
                      <div className="text-2xl font-black text-white">{info.label}</div>
                      <div className="text-white/80 text-sm mt-0.5">{info.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowTreasureOptions(false)}
              className="mt-6 text-white/50 text-sm hover:text-white/80 transition-colors"
            >
              ← Zpět na body
            </button>

          </div>
        );
      }

      // Already chose
      if (myChoice === 'points') {
        return (
          <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#10B981' }}>
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-white mb-2">Body přidány!</h1>
            <div className="mt-4 px-8 py-4 rounded-2xl bg-white/20">
              <span className="text-white font-black text-3xl">{myScore}</span>
              <span className="text-white/70 text-lg ml-2">bodů</span>
            </div>
          </div>
        );
      }

      if (myChoice === 'treasure' && myTreasureOffer?.picked) {
        const info = TREASURE_INFO_LOCAL[myTreasureOffer.picked];
        return (
          <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: info.color }}>
            <div className="text-7xl mb-4">{info.emoji}</div>
            <h1 className="text-2xl font-bold text-white mb-2">{info.label}!</h1>
            <p className="text-white/80">{info.desc}</p>
            {myTreasureOffer.target && (
              <p className="text-white font-bold mt-2">→ {session.students?.[myTreasureOffer.target]?.name}</p>
            )}
            <div className="mt-6 px-8 py-4 rounded-2xl bg-white/20">
              <span className="text-white font-black text-3xl">{myScore}</span>
              <span className="text-white/70 text-lg ml-2">bodů</span>
            </div>
          </div>
        );
      }

      // Default evaluation (waiting for teacher to evaluate)
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div className="text-5xl mb-4 animate-pulse">⏳</div>
          <h1 className="text-2xl font-bold text-white">Vyhodnocuji...</h1>
        </div>
      );
    }

    // EVALUATION — waiting for teacher to evaluate
    if (compPhase === 'evaluation' && !tacData?.evaluated) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div className="text-5xl mb-4 animate-pulse">⏳</div>
          <h1 className="text-2xl font-bold text-white">Čekám na vyhodnocení...</h1>
        </div>
      );
    }

    // RESULTS
    if (compPhase === 'results') {
      const allScores = Object.entries(tacData?.scores || {})
        .map(([id, score]) => ({ id, name: session.students?.[id]?.name || '?', score: score as number }))
        .sort((a, b) => b.score - a.score);
      
      const myRank = allScores.findIndex(s => s.id === studentId) + 1;
      const isWinner = myRank === 1;
      const isTopThree = myRank <= 3;

      return (
        <div className="flex flex-col items-center justify-center h-screen w-full p-6" style={{
          backgroundColor: isWinner ? '#F59E0B' : isTopThree ? '#10B981' : '#4E5871',
        }}>
          {isWinner && (
            <div style={{ width: '50vmin', height: '50vmin', position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }}>
              <CompLottie url={COMP_ASSETS.celebrate} loop />
            </div>
          )}
          <h1 className="text-4xl font-black text-white mb-2 relative z-10">
            {isWinner ? '🏆 Vítěz!' : `${myRank}. místo`}
          </h1>
          <div className="text-6xl font-black text-white mb-6 relative z-10">{myScore} bodů</div>
          
          {/* Leaderboard */}
          <div className="w-full max-w-sm relative z-10">
            {allScores.slice(0, 5).map((entry, i) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-4 py-2 rounded-xl mb-1"
                style={{
                  backgroundColor: entry.id === studentId ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                }}
              >
                <span className="w-6 text-center font-bold text-white">{i + 1}.</span>
                <span className="flex-1 text-white font-medium">{entry.name}</span>
                <span className="text-white font-black">{entry.score}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // QUESTION — show power round indicator and power-up status, then fall through to normal quiz
    // (handled by floating banners below)
  }

  // ============================================
  // RENDER: PROGRESS BAR
  // ============================================
  
  const renderProgressBar = () => {
    const totalSlides = quiz.slides.length;
    const progressPercent = totalSlides > 0 ? ((currentSlideIndex + 1) / totalSlides) * 100 : 0;
    
    // For more than 30 slides, show a simple continuous progress bar
    if (totalSlides > 30) {
      return (
        <div 
          className="flex-1 h-full rounded-full overflow-hidden"
          style={{ backgroundColor: '#CBD5E1' }}
        >
          <div 
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{ 
              width: `${progressPercent}%`,
              backgroundColor: '#475569'
            }}
          />
        </div>
      );
    }
    
    // For 30 or fewer slides, show individual segments
    return (
      <>
        {currentSlideIndex >= 0 && (
          <div
            className="rounded-full h-full"
            style={{ 
              backgroundColor: '#475569',
              flex: currentSlideIndex + 1
            }}
          />
        )}
        {quiz.slides.slice(currentSlideIndex + 1).map((_, idx) => {
          const actualIndex = currentSlideIndex + 1 + idx;
          return (
            <div
              key={actualIndex}
              className="flex-1 rounded-full h-full"
              style={{ 
                backgroundColor: '#CBD5E1'
              }}
            />
          );
        })}
      </>
    );
  };

  // ============================================
  // RENDER: QUIZ VIEW
  // ============================================
  
  const teamRoundType = session.mode === 'team-competition' ? (session.teamCompetitionData?.currentRoundType || 'normal') : 'normal';
  const isTeamSpecialRound = teamRoundType === 'power' || teamRoundType === 'double';
  const isCompetitionMode = session.mode === 'competition' || session.mode === 'team-competition' || session.mode === 'duel-competition' || session.mode === 'tactical-competition';
  
  return (
    <div className="flex flex-col h-screen relative" style={{ backgroundColor: '#F0F1F8' }}>
      {renderConnectionBanner()}
      
      {/* Special round overlay for team competition */}
      {isTeamSpecialRound && (
        <>
          <div className="absolute inset-0 pointer-events-none z-0" style={{
            background: teamRoundType === 'power'
              ? 'linear-gradient(135deg, #7C3AED, #F59E0B, #7C3AED, #EC4899)'
              : 'linear-gradient(135deg, #F59E0B, #EF4444, #F59E0B, #FF6B00)',
            backgroundSize: '300% 300%',
            animation: 'specialGradientShift 3s ease infinite, specialPulseOpacity 2s ease-in-out infinite',
          }} />
          <div className="absolute top-0 left-0 right-0 z-50 flex justify-center pt-2 pointer-events-none">
            <div className="flex items-center gap-2 px-5 py-2 rounded-full shadow-lg animate-pulse" style={{
              backgroundColor: teamRoundType === 'power' ? '#7C3AED' : '#F59E0B',
            }}>
              {teamRoundType === 'power' ? (
                <>
                  <span className="text-yellow-300 text-lg">⚡</span>
                  <span className="text-white font-bold text-sm">POWER KOLO — Všichni hrají!</span>
                  <span className="text-yellow-300 text-lg">⚡</span>
                </>
              ) : (
                <>
                  <span className="text-slate-900 font-black text-lg">x2</span>
                  <span className="text-slate-900 font-bold text-sm">Dvojité body!</span>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Duel competition VS banner */}
      {session.mode === 'duel-competition' && session.competitionPhase === 'question' && (() => {
        const dData = session.duelCompetitionData;
        const myDuelId = dData?.studentDuelMap?.[studentId || ''];
        const myDuel = myDuelId ? dData?.duels?.[myDuelId] : null;
        if (!myDuel) return null;
        const opponents = myDuel.playerIds.filter(pid => pid !== studentId);
        const opponentNames = opponents.map(pid => session.students?.[pid]?.name || '?');
        const myScore = myDuel.scores?.[studentId || ''] || 0;
        return (
          <div className="absolute top-0 left-0 right-0 z-50 flex justify-center pt-2 pointer-events-none">
            <div className="flex items-center gap-2 px-5 py-2 rounded-full shadow-lg" style={{ backgroundColor: '#FF6B35' }}>
              <span className="text-white font-bold text-sm">{name}</span>
              <span className="text-white font-black text-lg">{myScore}</span>
              <span className="text-white/60 font-black">:</span>
              {opponents.map((pid, i) => (
                <React.Fragment key={pid}>
                  <span className="text-white font-black text-lg">{myDuel.scores?.[pid] || 0}</span>
                  <span className="text-white font-bold text-sm">{opponentNames[i]}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Tactical competition top banner */}
      {session.mode === 'tactical-competition' && session.competitionPhase === 'question' && (() => {
        const tacData = session.tacticalCompetitionData;
        const myTacScore = tacData?.scores?.[studentId || ''] || 0;
        const myTacStreak = tacData?.streaks?.[studentId || ''] || 0;
        const myPU = tacData?.powerUps?.[studentId || ''] || {};
        const tacBlocked = tacData?.blockedPlayers?.[studentId || ''];
        const isPR = tacData?.isPowerRound;
        return (
          <div className="absolute top-0 left-0 right-0 z-50 flex justify-center pt-2 pointer-events-none">
            <div className="flex items-center gap-3 px-5 py-2 rounded-full shadow-lg" style={{ backgroundColor: isPR ? '#F59E0B' : '#10B981' }}>
              {isPR && <span className="text-sm">⚡</span>}
              <span className="text-white font-bold text-sm">{name}</span>
              <span className="text-white font-black text-lg">{myTacScore}</span>
              {myTacStreak >= 3 && <span className="text-yellow-200 text-xs">🔥{myTacStreak}</span>}
              {myPU.shield && <span className="text-xs">🛡️</span>}
              {myPU.xray && <span className="text-xs">👁️</span>}
              {myPU.timeBoost && <span className="text-xs">⏰</span>}
              {tacBlocked && <span className="text-red-200 text-xs">🚫</span>}
            </div>
          </div>
        );
      })()}
      
      {/* Progress bar header - height 40px on desktop only (hidden in competition modes) */}
      {!isCompetitionMode && (
      <div 
        className="hidden lg:flex items-center justify-center px-4" 
        style={{ 
          backgroundColor: '#F0F1F8',
          height: 40,
        }}
      >
        {/* Progress bar - centered with max width */}
        <div className="flex items-center gap-1.5" style={{ width: '50%', maxWidth: '600px', height: '8px' }}>
          {renderProgressBar()}
        </div>
      </div>
      )}
      
      {/* Main content area */}
      <div 
        className="flex-1 flex flex-col overflow-hidden" 
        style={{ 
          minHeight: 0,
        }}
      >
        {/* Content with arrows - bottom padding 5px */}
        <div className="flex-1 flex items-stretch overflow-hidden" style={{ minHeight: 0, paddingBottom: isMobile ? 16 : 5 }}>
          {/* Desktop: Left arrow */}
          <div className="hidden lg:flex flex-shrink-0 items-center justify-center" style={{ width: 65 }}>
            {canNavigate && (
              <button
                onClick={goToPrevSlide}
                disabled={currentSlideIndex === 0}
                className={`w-12 h-12 rounded-full bg-[#CBD5E1] flex items-center justify-center text-slate-600 transition-all duration-300 ease-out ${currentSlideIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:h-24'}`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
          </div>
          
          {/* Slide card - fills remaining space */}
          <div 
            ref={mobileScrollRef}
            className="flex-1 relative"
            style={{
              minHeight: 0,
              overflowY: isMobile ? 'auto' : 'hidden',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              // Padding - top for nav (smaller if locked mode), sides for shadow. No top padding in competition modes.
              padding: isMobile ? (isCompetitionMode ? '8px 8px 8px 8px' : (canNavigate ? '75px 8px 8px 8px' : '50px 8px 8px 8px')) : 16,
            }}
          >
            {/* Mobile: Fixed top navigation (hidden in competition modes) */}
            {isMobile && !isCompetitionMode && (
              <div 
                className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-3 pb-2"
              >
                {/* Locked mode: only progress bar */}
                {!canNavigate ? (
                  <div 
                    className={`rounded-full px-6 py-3 transition-all duration-300 ${isScrolling ? 'bg-white shadow-lg' : ''}`}
                  >
                    <div className="flex items-center gap-0.5" style={{ height: '8px', width: '150px' }}>
                      {renderProgressBar()}
                    </div>
                  </div>
                ) : (
                  /* Unlocked mode: buttons + progress bar */
                  <div 
                    className={`flex items-center gap-3 rounded-full px-4 py-2 transition-all duration-300 ${isScrolling ? 'bg-white shadow-lg' : ''}`}
                  >
                    <button
                      onClick={goToPrevSlide}
                      disabled={currentSlideIndex === 0}
                      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${currentSlideIndex === 0 ? 'opacity-30 cursor-not-allowed' : ''} bg-[#E2E8F0] text-slate-500`}
                    >
                      <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="flex items-center gap-0.5" style={{ height: '8px', width: '120px' }}>
                      {renderProgressBar()}
                    </div>
                    <button
                      onClick={() => (currentSlideIndex < quiz.slides.length - 1 && canProceed) ? goToNextSlide() : (!canProceed ? triggerWiggle() : null)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${(currentSlideIndex === quiz.slides.length - 1 || !canProceed) ? 'bg-slate-300 text-slate-400' : 'text-white'}`}
                      style={{ backgroundColor: (currentSlideIndex < quiz.slides.length - 1 && canProceed) ? '#7C3AED' : undefined }}
                    >
                      <ArrowRight className="w-6 h-6" />
                    </button>
                  </div>
                )}
              </div>
            )}
            <div 
              className={`
                w-full rounded-3xl overflow-hidden flex flex-col
                ${(currentSlide?.type === 'tools' && (currentSlide as ToolsSlide).toolType === 'certificate' && (currentSlide as ToolsSlide).certificateConfig?.customPdfUrl) || (currentSlide as any)?.activityType === 'flashcard' ? '' : 'bg-white shadow-md'}
                ${currentSlide?.type !== 'info' ? 'max-w-5xl mx-auto' : ''}
                ${currentSlideIndex > prevSlideIndex && isAnimating ? 'animate-slide-in' : ''}
                ${currentSlideIndex < prevSlideIndex && isAnimating ? 'animate-slide-in-left' : ''}
              `}
              style={{
                height: isMobile ? 'auto' : '100%',
                minHeight: isMobile ? 'calc(100vh - 140px)' : undefined,
              }}
              key={currentSlideIndex}
            >
              {/* Info slide with block layout - render ONLY BlockLayoutView */}
              {currentSlide.type === 'info' && (currentSlide as InfoSlide).layout && (currentSlide as InfoSlide).layout!.blocks.length > 0 ? (
                <div className="flex-1 flex flex-col" style={{ minHeight: isMobile ? '100%' : 0, height: '100%' }}>
                  <BlockLayoutView slide={currentSlide as InfoSlide} />
                </div>
              ) : (
                <>
                  {/* Question - only for activity slides that do not render their own full layout */}
                  {currentSlide.type === 'activity' && currentSlide.activityType !== 'abc' && currentSlide.activityType !== 'open' && currentSlide.activityType !== 'board' && currentSlide.activityType !== 'voting' && currentSlide.activityType !== 'connect-pairs' && currentSlide.activityType !== 'fill-blanks' && currentSlide.activityType !== 'image-hotspots' && currentSlide.activityType !== 'video-quiz' && currentSlide.activityType !== 'form' && currentSlide.activityType !== 'example' && currentSlide.activityType !== 'flashcard' && (
                    <div className={`flex flex-col items-center justify-center p-4 md:p-8 ${(currentSlide as any).media?.url && (currentSlide as any).media?.type === 'image' ? 'flex-shrink-0' : 'flex-1'}`}>
                      <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold text-[#4E5871] text-center leading-tight break-words max-w-full overflow-hidden">
                        <MathText>{(currentSlide as any).question || (currentSlide as any).title || 'Otázka'}</MathText>
                      </h1>
                      
                      {/* Question image — capped height so options remain visible */}
                      {(currentSlide as any).media?.url && (currentSlide as any).media?.type === 'image' && (
                        <img 
                          src={(currentSlide as any).media.url} 
                          alt="Obrázek k otázce"
                          className="mt-3 max-w-full object-contain"
                          style={{ maxHeight: isMobile ? '35vh' : '40vh' }}
                        />
                      )}
                    </div>
                  )}
              
              {/* ABC Options */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'abc' && (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ABCSlideView
                    slide={currentSlide as ABCActivitySlide}
                    showHint={false}
                    showSolution={session?.showResults === true || (currentResponse?.isCorrect !== null && currentResponse?.isCorrect !== undefined)}
                    selectedAnswer={(currentResponse?.answer as string | string[] | undefined) || selectedOption || undefined}
                    onSelectAnswer={(answerId) => {
                      if (!hasAnswered && !showResult) {
                        setSelectedOption(answerId);
                      }
                    }}
                  />
                </div>
              )}
              
              {/* Example activity - shared component */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'example' && (
                <ExampleActivityView
                  slide={currentSlide as ExampleActivitySlide}
                  textAnswer={textAnswer}
                  setTextAnswer={setTextAnswer}
                  hasAnswered={hasAnswered}
                  response={currentResponse}
                  showResults={currentResponse?.isCorrect !== undefined && currentResponse?.isCorrect !== null}
                  showExplanation={!!session?.settings?.showSolutionHints}
                  onSubmit={submitAnswer}
                  customKeys={quiz?.settings?.customKeys}
                  extraKeys={quiz?.settings?.extraKeys}
                />
              )}

              {/* Open question (separate from example) */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'open' && (
                <div className="w-full">
                  <OpenSlideView
                    slide={currentSlide as OpenActivitySlide}
                    answer={hasAnswered ? String(currentResponse?.answer || '') : textAnswer}
                    onAnswerChange={setTextAnswer}
                    disabled={hasAnswered || showResult}
                  />

                  <div className="flex justify-center pt-6">
                    {!hasAnswered && !showResult ? (
                      <button
                        ref={answerButtonRef}
                        onClick={submitAnswer}
                        disabled={!textAnswer.trim()}
                        className={`flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all ${showWiggle ? 'animate-wiggle' : ''}`}
                        style={{
                          backgroundColor: '#4F46E5',
                          boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.25)',
                        }}
                      >
                        <Send className="w-5 h-5" />
                        Odpovědět
                      </button>
                    ) : canNavigate ? (
                      <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 text-slate-500">
                        <ArrowRight className="w-5 h-5" />
                        <span>Použij šipky pro další otázku</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Čekám na další otázku...</span>
                      </div>
                    )}
                  </div>

                  {session?.showResults === true && currentResponse?.isCorrect !== undefined && currentResponse?.isCorrect !== null && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      {currentResponse.isCorrect ? (
                        <>
                          <CheckCircle className="w-6 h-6 text-green-500" />
                          <span className="text-green-600 font-medium">Správně!</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-6 h-6 text-red-500" />
                          <span className="text-red-600 font-medium">Ještě není správně</span>
                        </>
                      )}
                    </div>
                  )}

                </div>
              )}
              
              {/* Board activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'board' && (
                <div className="flex-1 overflow-hidden">
                  <BoardSlideView 
                    slide={currentSlide as BoardActivitySlide}
                    posts={boardPosts.posts}
                    currentUserId={studentId || undefined}
                    currentUserName={name || undefined}
                    isTeacher={false}
                    onAddPost={boardPosts.addPost}
                    onLikePost={boardPosts.likePost}
                    onDeletePost={boardPosts.deletePost}
                    readOnly={false}
                  />
                </div>
              )}
              
              {/* Voting activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'voting' && (
                <div className="flex-1 overflow-hidden">
                  <VotingSlideView 
                    slide={currentSlide as VotingActivitySlide}
                    isTeacher={false}
                    hasVoted={voting.hasVoted}
                    myVote={voting.myVote}
                    voteCounts={voting.getVoteCounts()}
                    totalVoters={voting.getTotalVotes()}
                    onVote={voting.vote}
                    readOnly={false}
                  />
                </div>
              )}
              
              {/* Connect Pairs activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'connect-pairs' && (
                <div className="flex-1 overflow-hidden">
                  <ConnectPairsView 
                    slide={currentSlide as ConnectPairsActivitySlide}
                    isTeacher={false}
                    readOnly={false}
                    showResults={session?.showResults === true}
                    deferEvaluation={session?.isLocked === true}
                    onSubmit={(result) => {
                      submitAnswer(result);
                    }}
                  />
                </div>
              )}
              
              {/* Fill Blanks activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'fill-blanks' && (
                <div className="flex-1 overflow-hidden">
                  <FillBlanksView 
                    slide={currentSlide as FillBlanksActivitySlide}
                    isTeacher={false}
                    readOnly={false}
                    showResults={session?.showResults === true}
                    deferEvaluation={session?.isLocked === true}
                    onSubmit={(result) => {
                      submitAnswer(result);
                    }}
                  />
                </div>
              )}
              
              {/* Image Hotspots activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'image-hotspots' && (
                <div className="flex-1 overflow-hidden">
                  <ImageHotspotsView 
                    slide={currentSlide as ImageHotspotsActivitySlide}
                    isTeacher={false}
                    readOnly={false}
                    showResults={session?.showResults === true}
                    deferEvaluation={session?.isLocked === true}
                    onSubmit={(result) => {
                      submitAnswer(result);
                    }}
                  />
                </div>
              )}
              
              {/* Video Quiz activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'video-quiz' && (
                <div className="flex-1 overflow-hidden">
                  <VideoQuizView 
                    slide={currentSlide as VideoQuizActivitySlide}
                    isTeacher={false}
                    readOnly={false}
                    showResults={session?.showResults === true}
                    deferEvaluation={session?.isLocked === true}
                    onSubmit={(result) => {
                      submitAnswer(result);
                    }}
                  />
                </div>
              )}
              
              {/* Form activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'form' && (
                <div className="flex-1 overflow-y-auto">
                  <FormView 
                    slide={currentSlide as any}
                    answer={formAnswer}
                    onAnswerChange={(answer) => {
                      setFormAnswer(answer);
                      setTextAnswer(JSON.stringify(answer));
                    }}
                    isReadOnly={false}
                  />
                </div>
              )}

              {/* Flashcard — non-graded flip card, fills full slide area */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'flashcard' && (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <FlashcardSlideView
                    slide={currentSlide as FlashcardActivitySlide}
                    selfAssessResult={
                      currentResponse?.answer === 'known'
                        ? true
                        : currentResponse?.answer === 'unknown'
                          ? false
                          : null
                    }
                    onSelfAssess={(knows) => {
                      if (!hasAnswered) {
                        submitAnswer(knows);
                      }
                    }}
                  />
                </div>
              )}

              {/* Tools slide - Certificate */}
              {currentSlide.type === 'tools' && (currentSlide as ToolsSlide).toolType === 'certificate' && (
                <div className="flex-1 overflow-y-auto">
                  <CertificateView 
                    slide={currentSlide as ToolsSlide}
                    quiz={quiz}
                    formResponses={collectFormResponses()}
                    isPreview={false}
                  />
                </div>
              )}
              
              {/* Legacy info slide (without block layout) */}
              {currentSlide.type === 'info' && (!(currentSlide as InfoSlide).layout || (currentSlide as InfoSlide).layout!.blocks.length === 0) && (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <InfoSlideView slide={currentSlide as InfoSlide} />
                </div>
              )}
              
              {/* Submit button or waiting indicator - only for activity slides (except those with their own buttons) */}
              {currentSlide.type === 'activity' && currentSlide.activityType !== 'board' && currentSlide.activityType !== 'voting' && currentSlide.activityType !== 'connect-pairs' && currentSlide.activityType !== 'fill-blanks' && currentSlide.activityType !== 'image-hotspots' && currentSlide.activityType !== 'video-quiz' && currentSlide.activityType !== 'open' && currentSlide.activityType !== 'example' && currentSlide.activityType !== 'flashcard' && (
              <div className="flex justify-center py-6 md:py-10">
                {!hasAnswered && !showResult && currentSlide.type === 'activity' ? (
                  <button
                    ref={answerButtonRef}
                    onClick={submitAnswer}
                    disabled={
                      (currentSlide.activityType === 'abc' && getABCSelectedAnswerIds(selectedOption).length === 0) ||
                      (currentSlide.activityType === 'open' && !textAnswer.trim()) ||
                      (currentSlide.activityType === 'example' && !textAnswer.trim()) ||
                      // Form: disabled if required fields are not filled
                      (currentSlide.activityType === 'form' && 
                        ((currentSlide as any).fields || []).some((field: any) => 
                          field.required && (
                            !formAnswer[field.id] || 
                            (Array.isArray(formAnswer[field.id]) && (formAnswer[field.id] as string[]).length === 0) ||
                            (typeof formAnswer[field.id] === 'string' && !(formAnswer[field.id] as string).trim())
                          )
                        )
                      )
                    }
                    className={`flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all ${showWiggle ? 'animate-wiggle' : ''}`}
                    style={{ 
                      backgroundColor: '#4F46E5', 
                      boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.25)',
                    }}
                  >
                    <Send className="w-5 h-5" />
                    {currentSlide.activityType === 'form' ? 'Odeslat formulář' : 'Odpovědět'}
                  </button>
                ) : canNavigate ? (
                  <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 text-slate-500">
                    <ArrowRight className="w-5 h-5" />
                    <span>Použij šipky pro další otázku</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Čekám na další otázku...</span>
                  </div>
                )}
              </div>
              )}
              </>
              )}
            </div>
            
            {/* Mobile: Extra space at bottom for scrolling */}
            {isMobile && (
              <div style={{ height: '120px', flexShrink: 0 }} />
            )}
          </div>
          
          {/* Desktop: Right arrow */}
          <div className="hidden lg:flex flex-shrink-0 items-center justify-center" style={{ width: 65 }}>
            {canNavigate && (
              <button
                onClick={() => (currentSlideIndex < quiz.slides.length - 1 && canProceed) ? goToNextSlide() : (!canProceed ? triggerWiggle() : null)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-out ${(currentSlideIndex === quiz.slides.length - 1 || !canProceed) ? 'bg-slate-300 text-slate-400' : 'text-white hover:h-24'}`}
                style={{ backgroundColor: (currentSlideIndex < quiz.slides.length - 1 && canProceed) ? '#7C3AED' : undefined }}
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}

export default QuizJoinPage;
