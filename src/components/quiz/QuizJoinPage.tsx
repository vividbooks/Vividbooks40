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
import { useSearchParams } from 'react-router-dom';
import { ref, onValue, off, set, update, get } from 'firebase/database';
import { database } from '../../utils/firebase-config';
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
  Calculator,
} from 'lucide-react';
import { MathInputModal, MathDisplay } from '../math/MathKeyboard';
import { MathText } from '../math/MathText';
import {
  Quiz,
  QuizSlide,
  ABCActivitySlide,
  OpenActivitySlide,
  SlideResponse,
  LiveQuizSession,
} from '../../types/quiz';

// ============================================
// CONSTANTS
// ============================================

const QUIZ_SESSIONS_PATH = 'quiz_sessions';
const STUDENT_SESSION_KEY = 'vivid-student-session';
const STUDENT_IDENTITY_KEY = 'vivid-student-identity';

// ============================================
// TYPES
// ============================================

interface StudentData {
  name: string;
  joinedAt: string;
  currentSlide: number;
  responses: SlideResponse[];
  isOnline: boolean;
  isFocused?: boolean;
  lastSeen: string;
  deviceId: string;
  // Time tracking
  startTime?: string;
  totalTimeMs?: number;
}

interface SavedSession {
  sessionId: string;
  sessionCode: string;
  studentId: string;
  studentName: string;
  joinedAt: string;
}

interface StudentIdentity {
  id: string;
  name: string;
  createdAt: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Generate a unique device ID
function getDeviceId(): string {
  let deviceId = localStorage.getItem('vivid-device-id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('vivid-device-id', deviceId);
  }
  return deviceId;
}

// Get or create student identity
function getStudentIdentity(name?: string): StudentIdentity {
  const saved = localStorage.getItem(STUDENT_IDENTITY_KEY);
  if (saved) {
    const identity = JSON.parse(saved) as StudentIdentity;
    // Update name if provided and different
    if (name && name !== identity.name) {
      identity.name = name;
      localStorage.setItem(STUDENT_IDENTITY_KEY, JSON.stringify(identity));
    }
    return identity;
  }
  
  // Create new identity
  const newIdentity: StudentIdentity = {
    id: `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name || '',
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(STUDENT_IDENTITY_KEY, JSON.stringify(newIdentity));
  return newIdentity;
}

// Save active session
function saveActiveSession(session: SavedSession): void {
  localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(session));
}

// Get saved session
function getSavedSession(): SavedSession | null {
  const saved = localStorage.getItem(STUDENT_SESSION_KEY);
  return saved ? JSON.parse(saved) : null;
}

// Clear saved session
function clearSavedSession(): void {
  localStorage.removeItem(STUDENT_SESSION_KEY);
}

// Retry wrapper for Firebase operations
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries}):`, error);
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  
  throw lastError;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function QuizJoinPage() {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';
  
  // Connection state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  // Join state
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  
  // Session state
  const [isJoined, setIsJoined] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [session, setSession] = useState<LiveQuizSession | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  
  // Quiz progress
  const [responses, setResponses] = useState<SlideResponse[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [showMathKeyboard, setShowMathKeyboard] = useState(false);
  
  // Local slide index for unlocked mode
  const [localSlideIndex, setLocalSlideIndex] = useState(0);
  
  // Time tracking
  const [sessionStartTime] = useState<number>(Date.now());
  const [slideStartTime, setSlideStartTime] = useState<number>(Date.now());
  
  // Wiggle animation for answer button
  const [showWiggle, setShowWiggle] = useState(false);
  const answerButtonRef = useRef<HTMLButtonElement | null>(null);
  
  // Refs for cleanup
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const sessionUnsubscribe = useRef<(() => void) | null>(null);

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
  // AUTO-RECONNECT ON PAGE LOAD
  // ============================================
  
  useEffect(() => {
    const savedSession = getSavedSession();
    const identity = getStudentIdentity();
    
    // Pre-fill name from identity
    if (identity.name && !name) {
      setName(identity.name);
    }
    
    // Try to reconnect to saved session
    if (savedSession) {
      console.log('Found saved session, attempting reconnect:', savedSession);
      attemptReconnect(savedSession);
    }
  }, []);

  // Attempt to reconnect to a saved session
  const attemptReconnect = async (savedSession: SavedSession) => {
    setIsReconnecting(true);
    setError('');
    
    try {
      // Check if session still exists and is active
      const sessionRef = ref(database, `${QUIZ_SESSIONS_PATH}/${savedSession.sessionId}`);
      const snapshot = await get(sessionRef);
      
      if (!snapshot.exists()) {
        console.log('Session no longer exists');
        clearSavedSession();
        setIsReconnecting(false);
        return;
      }
      
      const sessionData = snapshot.val() as LiveQuizSession;
      
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
          update(ref(database, `${QUIZ_SESSIONS_PATH}/${savedSession.sessionId}/students/${savedSession.studentId}`), {
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
        update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), {
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
    
    const sessionRef = ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}`);
    
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSession(data as LiveQuizSession);
        setConnectionError(null);
        
        // Load quiz from Firebase session data
        if (data.quizData && !quiz) {
          console.log('Loading quiz from Firebase:', data.quizData);
          setQuiz(data.quizData as Quiz);
        }
        
        // Sync responses from server (in case of multi-device)
        if (studentId && data.students?.[studentId]) {
          const serverResponses = data.students[studentId].responses || [];
          // Only update if server has more responses (avoid overwriting local state)
          if (serverResponses.length > responses.length) {
            setResponses(serverResponses);
          }
        }
      }
    }, (error) => {
      console.error('Session listener error:', error);
      setConnectionError('Ztráta spojení se serverem');
    });
    
    sessionUnsubscribe.current = () => off(sessionRef);
    
    return () => {
      off(sessionRef);
      sessionUnsubscribe.current = null;
    };
  }, [sessionId, studentId, quiz]);

  // ============================================
  // HEARTBEAT - Keep online status updated
  // ============================================
  
  useEffect(() => {
    if (!sessionId || !studentId) return;
    
    const updateHeartbeat = async () => {
      try {
        await update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), {
          lastSeen: new Date().toISOString(),
          isOnline: true,
        });
      } catch (error) {
        console.warn('Heartbeat failed:', error);
      }
    };
    
    // Update immediately
    updateHeartbeat();
    
    // Then every 30 seconds
    heartbeatInterval.current = setInterval(updateHeartbeat, 30000);
    
    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
    };
  }, [sessionId, studentId]);

  // ============================================
  // ONLINE/FOCUS STATUS
  // ============================================
  
  useEffect(() => {
    if (!sessionId || !studentId) return;
    
    const studentRef = ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`);
    
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline update
      const url = `https://${process.env.REACT_APP_FIREBASE_PROJECT_ID || 'your-project'}.firebaseio.com/${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}.json`;
      navigator.sendBeacon?.(url, JSON.stringify({ isOnline: false }));
      update(studentRef, { isOnline: false });
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      update(studentRef, { isOnline: false });
    };
  }, [sessionId, studentId]);
  
  // Track focus/visibility
  useEffect(() => {
    if (!sessionId || !studentId) return;
    
    const studentRef = ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`);
    
    const handleVisibilityChange = () => {
      const isFocused = document.visibilityState === 'visible';
      update(studentRef, { isFocused, lastSeen: new Date().toISOString() });
    };
    
    const handleBlur = () => {
      update(studentRef, { isFocused: false, lastSeen: new Date().toISOString() });
    };
    
    const handleFocus = () => {
      update(studentRef, { isFocused: true, lastSeen: new Date().toISOString() });
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [sessionId, studentId]);

  // ============================================
  // SYNC SLIDE INDEX
  // ============================================
  
  useEffect(() => {
    if (session?.isLocked !== false && session?.currentSlideIndex !== undefined) {
      setLocalSlideIndex(session.currentSlideIndex);
      
      if (sessionId && studentId) {
        update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), {
          currentSlide: session.currentSlideIndex,
        });
      }
    }
  }, [session?.currentSlideIndex, session?.isLocked, sessionId, studentId]);
  
  // Reset selection and start time when slide changes
  const effectiveSlideIndex = session?.isLocked === false ? localSlideIndex : (session?.currentSlideIndex || 0);
  useEffect(() => {
    setSelectedOption(null);
    setTextAnswer('');
    setShowResult(false);
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
    
    setIsJoining(true);
    setError('');
    
    try {
      // Get or create student identity
      const identity = getStudentIdentity(name);
      
      const sessionsRef = ref(database, QUIZ_SESSIONS_PATH);
      const snapshot = await get(sessionsRef);
      
      if (!snapshot.exists()) {
        setError('Session nenalezena');
        setIsJoining(false);
        return;
      }
      
      const sessions = snapshot.val();
      
      // Find session with matching code
      const sessionEntry = Object.entries(sessions).find(([id, _]) => 
        id.includes(`quiz_${code.toUpperCase()}_`)
      );
      
      if (!sessionEntry) {
        setError('Neplatný kód');
        setIsJoining(false);
        return;
      }
      
      const [foundSessionId, sessionData] = sessionEntry as [string, LiveQuizSession];
      
      if (!sessionData.isActive) {
        setError('Session již skončila');
        setIsJoining(false);
        return;
      }
      
      // Check if student already exists in this session (by name)
      let existingStudentId: string | null = null;
      if (sessionData.students) {
        const existingEntry = Object.entries(sessionData.students).find(
          ([_, student]) => student.name.toLowerCase() === name.toLowerCase()
        );
        if (existingEntry) {
          existingStudentId = existingEntry[0];
          console.log('Found existing student record by name:', existingStudentId);
        }
      }
      
      const finalStudentId = existingStudentId || identity.id;
      
      // Prepare student data
      const studentData: StudentData = {
        name,
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
        deviceId: getDeviceId(),
        // Time tracking - preserve existing startTime or set new one
        startTime: existingStudentId
          ? ((sessionData.students![existingStudentId] as any).startTime || new Date().toISOString())
          : new Date().toISOString(),
        totalTimeMs: existingStudentId
          ? ((sessionData.students![existingStudentId] as any).totalTimeMs || 0)
          : 0,
      };
      
      // Save/update student in Firebase
      await retryOperation(() =>
        set(ref(database, `${QUIZ_SESSIONS_PATH}/${foundSessionId}/students/${finalStudentId}`), studentData)
      );
      
      // Save session to localStorage for reconnect
      saveActiveSession({
        sessionId: foundSessionId,
        sessionCode: code.toUpperCase(),
        studentId: finalStudentId,
        studentName: name,
        joinedAt: studentData.joinedAt,
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
  
  const submitAnswer = useCallback(async () => {
    if (!session || !quiz || !sessionId || !studentId) return;
    
    const slideIndex = session.isLocked === false ? localSlideIndex : session.currentSlideIndex;
    const currentSlideForAnswer = quiz.slides[slideIndex];
    if (!currentSlideForAnswer || currentSlideForAnswer.type !== 'activity') return;
    
    // Check if already answered
    if (responses.some(r => r.slideId === currentSlideForAnswer.id)) {
      setShowResult(true);
      return;
    }
    
    let isCorrect = false;
    let answer: string = '';
    
    if (currentSlideForAnswer.activityType === 'abc') {
      const abcSlide = currentSlideForAnswer as ABCActivitySlide;
      const correctOption = abcSlide.options.find(o => o.isCorrect);
      isCorrect = selectedOption === correctOption?.id;
      answer = selectedOption || '';
    } else if (currentSlideForAnswer.activityType === 'open') {
      const openSlide = currentSlideForAnswer as OpenActivitySlide;
      const normalizedAnswer = openSlide.caseSensitive ? textAnswer : textAnswer.toLowerCase();
      isCorrect = openSlide.correctAnswers.some(correct => 
        (openSlide.caseSensitive ? correct : correct.toLowerCase()) === normalizedAnswer
      );
      answer = textAnswer;
    }
    
    // Calculate time spent on this slide in seconds
    const timeSpentSeconds = Math.round((Date.now() - slideStartTime) / 1000);
    
    const response: SlideResponse = {
      slideId: currentSlideForAnswer.id,
      activityType: currentSlideForAnswer.activityType,
      answer,
      isCorrect,
      points: isCorrect ? (currentSlideForAnswer as any).points || 1 : 0,
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
        update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), {
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
  }, [session, quiz, sessionId, studentId, localSlideIndex, responses, selectedOption, textAnswer, slideStartTime, sessionStartTime]);

  // ============================================
  // NAVIGATION
  // ============================================
  
  const goToPrevSlide = async () => {
    if (!quiz || localSlideIndex <= 0) return;
    const newIndex = localSlideIndex - 1;
    setLocalSlideIndex(newIndex);
    
    if (sessionId && studentId) {
      await update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), {
        currentSlide: newIndex,
        lastSeen: new Date().toISOString(),
      });
    }
  };
  
  const goToNextSlide = async () => {
    if (!quiz || localSlideIndex >= quiz.slides.length - 1) return;
    const newIndex = localSlideIndex + 1;
    setLocalSlideIndex(newIndex);
    
    if (sessionId && studentId) {
      await update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), {
        currentSlide: newIndex,
        lastSeen: new Date().toISOString(),
      });
    }
  };

  // ============================================
  // COMPUTED VALUES
  // ============================================
  
  const currentSlideIndex = session?.isLocked === false ? localSlideIndex : (session?.currentSlideIndex || 0);
  const currentSlide = quiz?.slides[currentSlideIndex];
  const hasAnswered = responses.some(r => r.slideId === currentSlide?.id);
  const currentResponse = responses.find(r => r.slideId === currentSlide?.id);
  const correctCount = responses.filter(r => r.isCorrect).length;
  const wrongCount = responses.filter(r => !r.isCorrect).length;
  const canNavigate = session?.isLocked === false;
  
  // Require answer to proceed (for activity slides)
  const canProceed = !currentSlide || currentSlide.type !== 'activity' || hasAnswered;

  // ============================================
  // WIGGLE ANIMATION ON MOBILE
  // ============================================
  
  useEffect(() => {
    // Only trigger on mobile when option is selected but not yet answered
    if (selectedOption && !hasAnswered && !showResult && window.innerWidth < 1024) {
      setTimeout(() => {
        answerButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setShowWiggle(true);
        setTimeout(() => setShowWiggle(false), 1000);
      }, 100);
    }
  }, [selectedOption, hasAnswered, showResult]);

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
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center p-4">
        {renderConnectionBanner()}
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">
              Připojit se ke kvízu
            </h1>
            <p className="text-slate-500 mt-1">Zadej kód od učitele</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Kód session
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABCD12"
                maxLength={6}
                className="w-full px-4 py-4 text-center text-3xl font-mono font-bold rounded-2xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none uppercase tracking-[0.5em] transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tvé jméno
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jan Novák"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-lg"
              />
            </div>
            
            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm text-center flex items-center justify-center gap-2">
                <XCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            
            <button
              onClick={joinSession}
              disabled={isJoining || !code || !name || !isOnline}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25"
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
        </div>
      </div>
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
  // RENDER: PROGRESS BAR
  // ============================================
  
  const renderProgressBar = () => (
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
      {quiz.slides.slice(currentSlideIndex + 1).map((_, idx) => {
        const actualIndex = currentSlideIndex + 1 + idx;
        return (
          <div
            key={actualIndex}
            className="flex-1 rounded-full"
            style={{ 
              height: '8px',
              backgroundColor: '#CBD5E1'
            }}
          />
        );
      })}
    </>
  );

  // ============================================
  // RENDER: QUIZ VIEW
  // ============================================
  
  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: '#F0F1F8' }}>
      {renderConnectionBanner()}
      
      {/* Desktop: Top bar with stats */}
      <div className="hidden lg:flex relative items-center justify-center px-6 py-4" style={{ backgroundColor: '#F0F1F8' }}>
        <div className="w-1/2 max-w-xl flex items-center gap-1.5">
          {renderProgressBar()}
        </div>
        <div className="absolute right-6 flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-emerald-600">
            <CheckCircle className="w-5 h-5" />
            <span className="font-bold">{correctCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-red-500">
            <XCircle className="w-5 h-5" />
            <span className="font-bold">{wrongCount}</span>
          </div>
        </div>
      </div>
      
      {/* Mobile: Top navigation */}
      <div className="flex lg:hidden items-center gap-3 px-4 py-4" style={{ backgroundColor: '#F0F1F8' }}>
        {canNavigate ? (
          <>
            <button
              onClick={goToPrevSlide}
              disabled={currentSlideIndex === 0}
              className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${currentSlideIndex === 0 ? 'opacity-30 cursor-not-allowed' : ''} bg-[#CBD5E1] text-slate-600`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 flex items-center gap-1.5">
              {renderProgressBar()}
            </div>
            <button
              onClick={goToNextSlide}
              disabled={currentSlideIndex === quiz.slides.length - 1 || !canProceed}
              className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${(currentSlideIndex === quiz.slides.length - 1 || !canProceed) ? 'cursor-not-allowed bg-slate-300 text-slate-400' : 'text-white'}`}
              style={{ backgroundColor: (currentSlideIndex < quiz.slides.length - 1 && canProceed) ? '#7C3AED' : undefined }}
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </>
        ) : (
          <>
            <div className="flex-1 flex items-center gap-1.5">
              {renderProgressBar()}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-1 text-emerald-600">
                <CheckCircle className="w-4 h-4" />
                <span className="font-bold text-sm">{correctCount}</span>
              </div>
              <div className="flex items-center gap-1 text-red-500">
                <XCircle className="w-4 h-4" />
                <span className="font-bold text-sm">{wrongCount}</span>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Main content area */}
      <div className="flex-1 flex flex-col pb-4 lg:pt-4 lg:pb-4" style={{ backgroundColor: '#F0F1F8' }}>
        <div className="flex-1 flex items-stretch">
          {/* Desktop: Left arrow */}
          <div className="hidden lg:flex w-16 flex-shrink-0 items-center justify-center">
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
          
          {/* Slide card */}
          <div className="flex-1 flex items-stretch px-4">
            <div className="w-full max-w-5xl mx-auto rounded-3xl shadow-2xl overflow-hidden flex flex-col bg-white">
              {/* Question */}
              <div className="flex-1 flex items-center justify-center p-4 md:p-8">
                <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold text-[#4E5871] text-center leading-tight break-words max-w-full overflow-hidden">
                  <MathText>{(currentSlide as any).question || (currentSlide as any).title || 'Otázka'}</MathText>
                </h1>
              </div>
              
              {/* ABC Options */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'abc' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 p-4 md:p-6 max-w-4xl mx-auto w-full">
                  {(currentSlide as ABCActivitySlide).options.map((option) => {
                    const isSelected = selectedOption === option.id;
                    const isCorrect = option.isCorrect;
                    const wasSelected = currentResponse?.answer === option.id;
                    
                    return (
                      <button
                        key={option.id}
                        onClick={() => !hasAnswered && !showResult && setSelectedOption(option.id)}
                        disabled={hasAnswered || showResult}
                        className={`
                          relative p-3 lg:p-4 rounded-2xl text-left transition-all border-2 flex items-center gap-3 lg:gap-4
                          ${(showResult || hasAnswered) && isCorrect ? 'bg-green-50 border-green-500' : ''}
                          ${(showResult || hasAnswered) && wasSelected && !isCorrect ? 'bg-red-50 border-red-500' : ''}
                          ${!showResult && !hasAnswered && isSelected ? 'border-indigo-500 bg-indigo-50' : ''}
                          ${!showResult && !hasAnswered && !isSelected ? 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md' : ''}
                          ${(showResult || hasAnswered) && !isCorrect && !wasSelected ? 'bg-white border-slate-100 opacity-50' : ''}
                        `}
                      >
                        <span 
                          className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center font-bold text-base lg:text-lg flex-shrink-0 transition-colors"
                          style={{
                            backgroundColor: (showResult || hasAnswered) && isCorrect ? '#bbf7d0' 
                              : (showResult || hasAnswered) && wasSelected && !isCorrect ? '#fecaca'
                              : !showResult && !hasAnswered && isSelected ? '#c7d2fe' 
                              : '#E2E8F0',
                            color: (showResult || hasAnswered) && isCorrect ? '#166534' 
                              : (showResult || hasAnswered) && wasSelected && !isCorrect ? '#991b1b'
                              : !showResult && !hasAnswered && isSelected ? '#3730a3' 
                              : '#475569',
                          }}
                        >
                          {option.label || option.id?.toUpperCase() || '?'}
                        </span>
                        <span className="text-base sm:text-lg lg:text-xl font-medium text-[#4E5871] flex-1 break-words overflow-hidden">
                          <MathText>{option.content || ''}</MathText>
                        </span>
                        
                        {(showResult || hasAnswered) && isCorrect && (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              
              {/* Open question */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'open' && (
                <div className="w-full max-w-2xl mx-auto px-6">
                  <textarea
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    disabled={hasAnswered || showResult}
                    placeholder="Napište svou odpověď..."
                    className={`
                      w-full h-36 p-5 rounded-2xl border-2 text-lg resize-none shadow-sm
                      ${(showResult || hasAnswered)
                        ? currentResponse?.isCorrect 
                          ? 'bg-green-50 border-green-500' 
                          : 'bg-red-50 border-red-500'
                        : 'border-slate-200 focus:border-indigo-400 focus:ring-0'
                      }
                    `}
                  />
                  
                  {/* Math preview */}
                  {textAnswer.includes('$') && !hasAnswered && !showResult && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl">
                      <span className="text-xs text-slate-400 block mb-1">Náhled:</span>
                      <div className="text-lg text-[#4E5871]">
                        {textAnswer.split(/(\$[^$]+\$)/g).map((part, i) => {
                          if (part.startsWith('$') && part.endsWith('$')) {
                            return <MathDisplay key={i} math={part.slice(1, -1)} />;
                          }
                          return <span key={i}>{part}</span>;
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Math keyboard button */}
                  {!hasAnswered && !showResult && (
                    <button
                      onClick={() => setShowMathKeyboard(true)}
                      className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors text-sm font-medium mx-auto"
                    >
                      <Calculator className="w-4 h-4" />
                      Vložit matematiku
                    </button>
                  )}
                  
                  {(showResult || hasAnswered) && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      {currentResponse?.isCorrect ? (
                        <>
                          <CheckCircle className="w-6 h-6 text-green-500" />
                          <span className="text-green-600 font-medium">Správně!</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-6 h-6 text-red-500" />
                          <span className="text-red-600">
                            Správně: {(currentSlide as OpenActivitySlide).correctAnswers?.[0] || ''}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* Info slide */}
              {currentSlide.type === 'info' && (
                <div className="flex-1 flex items-center justify-center p-8">
                  {(currentSlide as any).content && (
                    <div 
                      className="prose prose-lg max-w-3xl text-center text-slate-600"
                      dangerouslySetInnerHTML={{ __html: (currentSlide as any).content }}
                    />
                  )}
                </div>
              )}
              
              {/* Submit button or waiting indicator */}
              <div className="flex justify-center py-6 md:py-10">
                {!hasAnswered && !showResult && currentSlide.type === 'activity' ? (
                  <button
                    ref={answerButtonRef}
                    onClick={submitAnswer}
                    disabled={
                      (currentSlide.activityType === 'abc' && !selectedOption) ||
                      (currentSlide.activityType === 'open' && !textAnswer.trim())
                    }
                    className={`flex items-center gap-2 px-8 py-4 rounded-xl bg-indigo-600 text-white font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/25 ${showWiggle ? 'animate-wiggle' : ''}`}
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
            </div>
          </div>
          
          {/* Desktop: Right arrow */}
          <div className="hidden lg:flex w-16 flex-shrink-0 items-center justify-center">
            {canNavigate && (
              <button
                onClick={goToNextSlide}
                disabled={currentSlideIndex === quiz.slides.length - 1 || !canProceed}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-out ${(currentSlideIndex === quiz.slides.length - 1 || !canProceed) ? 'cursor-not-allowed bg-slate-300 text-slate-400' : 'text-white hover:h-24'}`}
                style={{ backgroundColor: (currentSlideIndex < quiz.slides.length - 1 && canProceed) ? '#7C3AED' : undefined }}
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Math Input Modal */}
      <MathInputModal
        isOpen={showMathKeyboard}
        onClose={() => setShowMathKeyboard(false)}
        onSubmit={(latex) => {
          setTextAnswer(prev => prev + `$${latex}$`);
          setShowMathKeyboard(false);
        }}
        title="Vložit matematiku"
      />
    </div>
  );
}

export default QuizJoinPage;
