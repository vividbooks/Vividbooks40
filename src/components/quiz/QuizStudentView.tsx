/**
 * Quiz Student View (Shared Quiz)
 * 
 * Asynchronous quiz mode - students can access anytime via link
 * - Persistent student identity
 * - Auto-reconnect on page reload
 * - Progress saved to Firebase
 * - Same design as live session
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ref, onValue, off, update, set, get } from 'firebase/database';
import { database } from '../../utils/firebase-config';
import {
  CheckCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Send,
  X,
  XCircle,
  RefreshCw,
  WifiOff,
  AlertCircle,
  Users,
  Play,
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
  InfoSlide 
} from '../../types/quiz';
import { BlockLayoutView } from './QuizPreview';

// ============================================
// CONSTANTS
// ============================================

const QUIZ_SHARES_PATH = 'quiz_shares';
const STUDENT_SHARE_KEY = 'vivid-share-session';
const STUDENT_IDENTITY_KEY = 'vivid-student-identity';

// ============================================
// TYPES
// ============================================

interface ShareData {
  quizId: string;
  quizData: Quiz;
  sessionName: string;
  shareCode: string;
  settings: {
    anonymousAccess: boolean;
    showSolutionHints: boolean;
    showActivityResults: boolean;
    requireAnswerToProgress: boolean;
    showNotes: boolean;
  };
  createdAt: string;
  createdBy: string;
}

interface StudentShareData {
  studentId: string;
  studentName: string;
  schoolName?: string;
  joinedAt: string;
  lastActiveAt: string;
  currentSlide: number;
  isOnline: boolean;
  completedAt?: string;
  responses: Record<string, SlideResponse>;
  deviceId: string;
  // Time tracking
  startTime?: string;
  totalTimeMs?: number;
}

interface SavedShareSession {
  shareId: string;
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

function getDeviceId(): string {
  let deviceId = localStorage.getItem('vivid-device-id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('vivid-device-id', deviceId);
  }
  return deviceId;
}

function getStudentIdentity(name?: string): StudentIdentity {
  const saved = localStorage.getItem(STUDENT_IDENTITY_KEY);
  if (saved) {
    const identity = JSON.parse(saved) as StudentIdentity;
    if (name && name !== identity.name) {
      identity.name = name;
      localStorage.setItem(STUDENT_IDENTITY_KEY, JSON.stringify(identity));
    }
    return identity;
  }
  
  const newIdentity: StudentIdentity = {
    id: `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name || '',
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(STUDENT_IDENTITY_KEY, JSON.stringify(newIdentity));
  return newIdentity;
}

function getSavedShareSession(shareId: string): SavedShareSession | null {
  const saved = localStorage.getItem(`${STUDENT_SHARE_KEY}_${shareId}`);
  return saved ? JSON.parse(saved) : null;
}

function saveShareSession(shareId: string, session: SavedShareSession): void {
  localStorage.setItem(`${STUDENT_SHARE_KEY}_${shareId}`, JSON.stringify(session));
}

function clearShareSession(shareId: string): void {
  localStorage.removeItem(`${STUDENT_SHARE_KEY}_${shareId}`);
}

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

export function QuizStudentView() {
  const { shareId } = useParams<{ shareId: string }>();
  
  // Connection state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Loading state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Session state
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  
  // Quiz progress
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [prevSlideIndex, setPrevSlideIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [responses, setResponses] = useState<Record<string, SlideResponse>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [showMathKeyboard, setShowMathKeyboard] = useState(false);
  
  // Time tracking
  const [sessionStartTime] = useState<number>(Date.now());
  const [slideStartTime, setSlideStartTime] = useState<number>(Date.now());
  
  // Wiggle animation for answer button
  const [showWiggle, setShowWiggle] = useState(false);
  const answerButtonRef = useRef<HTMLButtonElement | null>(null);
  
  // Refs
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  // ============================================
  // NETWORK STATUS
  // ============================================
  
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionError(null);
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
  }, []);

  // ============================================
  // LOAD SHARE DATA & AUTO-RECONNECT
  // ============================================
  
  useEffect(() => {
    if (!shareId) {
      setLoading(false);
      setError('Chybí ID sdílení');
      return;
    }
    
    // Check for saved session
    const savedSession = getSavedShareSession(shareId);
    const identity = getStudentIdentity();
    
    // Pre-fill name from identity
    if (identity.name && !studentName) {
      setStudentName(identity.name);
    }
    
    // Load share data from Firebase
    const loadShareData = async () => {
      try {
        const shareRef = ref(database, `${QUIZ_SHARES_PATH}/${shareId}`);
        const snapshot = await get(shareRef);
        
        if (!snapshot.exists()) {
          setError('Kvíz nenalezen nebo odkaz vypršel');
          setLoading(false);
          return;
        }
        
        const data = snapshot.val() as ShareData;
        setShareData(data);
        setQuiz(data.quizData);
        
        // Try to reconnect if we have saved session
        if (savedSession) {
          console.log('Found saved share session, attempting reconnect:', savedSession);
          await attemptReconnect(data, savedSession);
        } else if (data.settings.anonymousAccess) {
          // Auto-start for anonymous access
          const newStudentId = identity.id;
          setStudentId(newStudentId);
          setStudentName('Anonymní');
          setHasStarted(true);
          
          // Register anonymous student
          await registerStudent(newStudentId, 'Anonymní');
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Failed to load share data:', err);
        setError('Nepodařilo se načíst kvíz');
        setLoading(false);
      }
    };
    
    loadShareData();
    
    // Listen for real-time updates
    const shareRef = ref(database, `${QUIZ_SHARES_PATH}/${shareId}`);
    const unsubscribe = onValue(shareRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setShareData(data as ShareData);
        if (data.quizData) {
          setQuiz(data.quizData);
        }
      }
    });
    
    return () => off(shareRef);
  }, [shareId]);

  // Attempt reconnect to saved session
  const attemptReconnect = async (shareData: ShareData, savedSession: SavedShareSession) => {
    setIsReconnecting(true);
    
    try {
      const studentRef = ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses/${savedSession.studentId}`);
      const snapshot = await get(studentRef);
      
      if (snapshot.exists()) {
        const studentData = snapshot.val() as StudentShareData;
        
        // Restore state
        setStudentId(savedSession.studentId);
        setStudentName(savedSession.studentName);
        setResponses(studentData.responses || {});
        setCurrentSlideIndex(studentData.currentSlide || 0);
        setHasStarted(true);
        
        // Check if already completed
        if (studentData.completedAt) {
          setIsCompleted(true);
        }
        
        // Update online status
        await update(studentRef, {
          isOnline: true,
          lastActiveAt: new Date().toISOString(),
          deviceId: getDeviceId(),
        });
        
        console.log('Successfully reconnected to share session');
      } else {
        // Student record doesn't exist, clear saved session
        clearShareSession(shareId!);
      }
    } catch (error) {
      console.error('Reconnect failed:', error);
      clearShareSession(shareId!);
    } finally {
      setIsReconnecting(false);
    }
  };

  // Register new student
  const registerStudent = async (newStudentId: string, name: string, school?: string) => {
    if (!shareId) return;
    
    const studentData: StudentShareData = {
      studentId: newStudentId,
      studentName: name,
      schoolName: school || '',
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      currentSlide: 0,
      isOnline: true,
      responses: {},
      deviceId: getDeviceId(),
      // Time tracking
      startTime: new Date().toISOString(),
      totalTimeMs: 0,
    };
    
    try {
      await retryOperation(() =>
        set(ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses/${newStudentId}`), studentData)
      );
      
      // Save to localStorage
      saveShareSession(shareId, {
        shareId,
        studentId: newStudentId,
        studentName: name,
        joinedAt: studentData.joinedAt,
      });
    } catch (error) {
      console.error('Failed to register student:', error);
      setConnectionError('Nepodařilo se zaregistrovat');
    }
  };

  // ============================================
  // HEARTBEAT
  // ============================================
  
  useEffect(() => {
    if (!shareId || !studentId || !hasStarted) return;
    
    const updateHeartbeat = async () => {
      try {
        await update(ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses/${studentId}`), {
          lastActiveAt: new Date().toISOString(),
          isOnline: true,
          currentSlide: currentSlideIndex,
        });
      } catch (error) {
        console.warn('Heartbeat failed:', error);
      }
    };
    
    updateHeartbeat();
    heartbeatInterval.current = setInterval(updateHeartbeat, 30000);
    
    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };
  }, [shareId, studentId, hasStarted, currentSlideIndex]);

  // ============================================
  // ONLINE STATUS
  // ============================================
  
  useEffect(() => {
    if (!shareId || !studentId) return;
    
    const handleBeforeUnload = () => {
      update(ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses/${studentId}`), { 
        isOnline: false 
      });
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      update(ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses/${studentId}`), { 
        isOnline: false 
      });
    };
  }, [shareId, studentId]);

  // ============================================
  // START SESSION
  // ============================================
  
  const startSession = async () => {
    if (!studentName.trim() || !shareId) return;
    
    const identity = getStudentIdentity(studentName);
    
    // Check if student with same name already exists
    try {
      const responsesRef = ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses`);
      const snapshot = await get(responsesRef);
      
      let existingStudentId: string | null = null;
      
      if (snapshot.exists()) {
        const responses = snapshot.val();
        const existing = Object.entries(responses).find(
          ([_, data]: [string, any]) => data.studentName?.toLowerCase() === studentName.toLowerCase()
        );
        if (existing) {
          existingStudentId = existing[0];
          console.log('Found existing student by name:', existingStudentId);
        }
      }
      
      const finalStudentId = existingStudentId || identity.id;
      
      if (existingStudentId) {
        // Reconnect to existing record
        const studentData = snapshot.val()[existingStudentId] as StudentShareData;
        setStudentId(finalStudentId);
        setResponses(studentData.responses || {});
        setCurrentSlideIndex(studentData.currentSlide || 0);
        
        if (studentData.completedAt) {
          setIsCompleted(true);
        }
        
        await update(ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses/${finalStudentId}`), {
          isOnline: true,
          lastActiveAt: new Date().toISOString(),
          deviceId: getDeviceId(),
        });
      } else {
        // Create new record
        setStudentId(finalStudentId);
        await registerStudent(finalStudentId, studentName, schoolName);
      }
      
      // Save session
      saveShareSession(shareId, {
        shareId,
        studentId: finalStudentId,
        studentName,
        joinedAt: new Date().toISOString(),
      });
      
      setHasStarted(true);
    } catch (error) {
      console.error('Failed to start session:', error);
      setConnectionError('Nepodařilo se připojit');
    }
  };

  // ============================================
  // ANSWER HANDLING
  // ============================================
  
  const submitAnswer = useCallback(async () => {
    if (!quiz || !shareId || !studentId) return;
    
    const currentSlide = quiz.slides[currentSlideIndex];
    if (!currentSlide || currentSlide.type !== 'activity') return;
    
    // Check if already answered
    if (responses[currentSlide.id]) return;
    
    let isCorrect = false;
    let answer: string = '';
    
    if ((currentSlide as any).activityType === 'abc') {
      const abcSlide = currentSlide as ABCActivitySlide;
      const correctOption = abcSlide.options.find(o => o.isCorrect);
      isCorrect = selectedOption === correctOption?.id;
      answer = selectedOption || '';
    } else if ((currentSlide as any).activityType === 'open') {
      const openSlide = currentSlide as OpenActivitySlide;
      const normalizedAnswer = openSlide.caseSensitive ? textAnswer : textAnswer.toLowerCase();
      isCorrect = openSlide.correctAnswers.some(correct => 
        (openSlide.caseSensitive ? correct : correct.toLowerCase()) === normalizedAnswer
      );
      answer = textAnswer;
    }
    
    // Calculate time spent on this slide in seconds
    const timeSpentSeconds = Math.round((Date.now() - slideStartTime) / 1000);
    
    const response: SlideResponse = {
      slideId: currentSlide.id,
      activityType: (currentSlide as any).activityType,
      answer,
      isCorrect,
      points: isCorrect ? ((currentSlide as any).points || 1) : 0,
      answeredAt: new Date().toISOString(),
      timeSpent: timeSpentSeconds,
    };
    
    const newResponses = { ...responses, [currentSlide.id]: response };
    setResponses(newResponses);
    
    // Calculate total session time
    const totalTimeMs = Date.now() - sessionStartTime;
    
    // Save to Firebase
    try {
      await retryOperation(() =>
        update(ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses/${studentId}`), {
          responses: newResponses,
          currentSlide: currentSlideIndex,
          lastActiveAt: new Date().toISOString(),
          totalTimeMs,
        })
      );
    } catch (error) {
      console.error('Failed to save answer:', error);
      setConnectionError('Odpověď se možná neuložila');
    }
  }, [quiz, shareId, studentId, currentSlideIndex, responses, selectedOption, textAnswer, slideStartTime, sessionStartTime]);

  // ============================================
  // NAVIGATION
  // ============================================
  
  const goToPrevSlide = () => {
    if (currentSlideIndex > 0 && !isAnimating) {
      setIsAnimating(true);
      setPrevSlideIndex(currentSlideIndex);
      setCurrentSlideIndex(prev => prev - 1);
      setSelectedOption(null);
      setTextAnswer('');
      setSlideStartTime(Date.now()); // Reset slide timer
      setTimeout(() => setIsAnimating(false), 450);
    }
  };
  
  const goToNextSlide = async () => {
    if (!quiz || !shareId || !studentId || isAnimating) return;
    
    const currentSlide = quiz.slides[currentSlideIndex];
    
    // Check if answer required
    if (shareData?.settings.requireAnswerToProgress && currentSlide.type === 'activity') {
      if (!responses[currentSlide.id]) {
        return;
      }
    }
    
    if (currentSlideIndex < quiz.slides.length - 1) {
      setIsAnimating(true);
      setPrevSlideIndex(currentSlideIndex);
      setCurrentSlideIndex(prev => prev + 1);
      setSelectedOption(null);
      setTextAnswer('');
      setSlideStartTime(Date.now()); // Reset slide timer
      setTimeout(() => setIsAnimating(false), 450);
      
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
      
      // Update progress
      await update(ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses/${studentId}`), {
        currentSlide: currentSlideIndex + 1,
        lastActiveAt: new Date().toISOString(),
      });
    } else {
      // Complete the quiz - save final total time
      const totalTimeMs = Date.now() - sessionStartTime;
      await update(ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses/${studentId}`), {
        completedAt: new Date().toISOString(),
        isOnline: false,
        totalTimeMs,
      });
      setIsCompleted(true);
    }
  };

  // ============================================
  // COMPUTED VALUES
  // ============================================
  
  const currentSlide = quiz && quiz.slides ? quiz.slides[currentSlideIndex] : undefined;
  const currentResponse = currentSlide && responses ? responses[currentSlide.id] : undefined;
  const hasAnswered = !!currentResponse;
  const responsesArray = responses ? Object.values(responses) : [];
  const correctCount = responsesArray.filter(function(r) { return r && r.isCorrect; }).length;
  const wrongCount = responsesArray.filter(function(r) { return r && !r.isCorrect; }).length;
  const totalQuestions = quiz && quiz.slides ? quiz.slides.filter(function(s) { return s.type === 'activity'; }).length : 0;
  
  const canProceed = () => {
    // If requireAnswerToProgress is disabled, always allow proceeding
    if (!shareData?.settings?.requireAnswerToProgress) return true;
    
    // Otherwise, require answer for activity slides before proceeding
    if (!currentSlide || currentSlide.type !== 'activity') return true;
    return !!responses[currentSlide.id]; // Must have submitted answer
  };

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
  // RENDER: CONNECTION BANNER
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
        ) : (
          <>
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{connectionError}</span>
          </>
        )}
      </div>
    );
  };

  // ============================================
  // RENDER: PROGRESS BAR
  // ============================================
  
  const renderProgressBar = () => {
    if (!quiz) return null;
    
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

  // ============================================
  // RENDER: LOADING
  // ============================================
  
  if (loading || isReconnecting) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">
            {isReconnecting ? 'Obnovuji připojení...' : 'Načítám kvíz...'}
          </p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: ERROR
  // ============================================
  
  if (error || !quiz || !shareData) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <HelpCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-600 mb-2">Kvíz nenalezen</h1>
          <p className="text-slate-500">{error || 'Tento odkaz je neplatný nebo vypršel.'}</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: START SCREEN
  // ============================================
  
  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
        {renderConnectionBanner()}
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Připojte se do soutěže!</h1>
            <p className="text-slate-500 mt-1">{quiz.title}</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Jméno
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Jan Novák"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Jméno školy
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="ZŠ Příklad"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-lg"
              />
            </div>
            
            <button
              onClick={startSession}
              disabled={!studentName.trim() || !isOnline}
              className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#7C3AED' }}
            >
              {!isOnline ? (
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
            
            <p className="text-center text-sm text-slate-400">
              {quiz.slides.filter(s => s.type === 'activity').length} otázek
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: COMPLETED
  // ============================================
  
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            Kvíz dokončen!
          </h2>
          
          {shareData.settings.showActivityResults && totalQuestions > 0 && (
            <div className="bg-slate-50 rounded-2xl p-6 my-6">
              <div className="text-5xl font-bold text-green-600 mb-2">
                {totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%
              </div>
              <p className="text-slate-600">
                {correctCount} z {totalQuestions} správně
              </p>
            </div>
          )}
          
          <p className="text-slate-500">Děkujeme za účast, {studentName}!</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: QUIZ VIEW
  // ============================================
  
  if (!currentSlide) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-500">Čekám na otázku...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: '#F0F1F8' }}>
      {renderConnectionBanner()}
      
      {/* Desktop: Top bar - using grid for proper layout */}
      <div className="hidden lg:grid px-6 py-4" style={{ backgroundColor: '#F0F1F8', gridTemplateColumns: '1fr auto 1fr' }}>
        {/* Left spacer */}
        <div />
        {/* Center: Progress bar */}
        <div className="flex items-center gap-1.5" style={{ width: '500px' }}>
          {renderProgressBar()}
        </div>
        {/* Right: Stats */}
        <div className="flex items-center justify-end gap-4">
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
          onClick={() => canProceed() ? goToNextSlide() : triggerWiggle()}
          className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${!canProceed() ? 'bg-slate-300 text-slate-400' : 'text-white'}`}
          style={{ backgroundColor: canProceed() ? '#7C3AED' : undefined }}
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col pb-4 lg:pt-4 lg:pb-4" style={{ backgroundColor: '#F0F1F8' }}>
        <div className="flex-1 flex items-stretch">
          {/* Desktop: Left arrow */}
          <div className="hidden lg:flex w-16 flex-shrink-0 items-center justify-center">
            <button
              onClick={goToPrevSlide}
              disabled={currentSlideIndex === 0}
              className={`w-12 h-12 rounded-full bg-[#CBD5E1] flex items-center justify-center text-slate-600 transition-all duration-300 ease-out ${currentSlideIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:h-24'}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
          
          {/* Slide card */}
          <div 
            className="flex-1 flex items-stretch"
            style={{
              overflowY: isMobile ? 'auto' : 'hidden',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              // Info slides fill width, activity slides centered with padding
              paddingLeft: currentSlide?.type === 'info' ? 0 : 16,
              paddingRight: currentSlide?.type === 'info' ? 0 : 16,
            }}
          >
            <div 
              className={`
                w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col bg-white
                ${currentSlide?.type !== 'info' ? 'max-w-5xl mx-auto' : ''}
                ${currentSlideIndex > prevSlideIndex && isAnimating ? 'animate-slide-in' : ''}
                ${currentSlideIndex < prevSlideIndex && isAnimating ? 'animate-slide-in-left' : ''}
              `}
              style={{
                // Keep aspect ratio for proper proportions on desktop
                aspectRatio: currentSlide?.type === 'info' && !isMobile ? '16/9' : undefined,
                // On mobile: auto height for scrolling
                height: isMobile ? 'auto' : undefined,
                alignSelf: isMobile ? 'flex-start' : 'center',
              }}
              key={currentSlideIndex}
            >
              {/* Info slide with block layout - render ONLY BlockLayoutView */}
              {currentSlide.type === 'info' && (currentSlide as InfoSlide).layout && (currentSlide as InfoSlide).layout!.blocks.length > 0 ? (
                <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
                  <BlockLayoutView slide={currentSlide as InfoSlide} />
                </div>
              ) : (
                <>
                  {/* Question - only for activity slides */}
                  {currentSlide.type === 'activity' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
                      <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold text-[#4E5871] text-center leading-tight break-words max-w-full overflow-hidden">
                        <MathText>{(currentSlide as any).question || (currentSlide as any).title || 'Otázka'}</MathText>
                      </h1>
                      
                      {/* Question image */}
                      {(currentSlide as any).media?.url && (currentSlide as any).media?.type === 'image' && (
                        <img 
                          src={(currentSlide as any).media.url} 
                          alt="Obrázek k otázce"
                          className="mt-4 max-w-full max-h-48 md:max-h-64 rounded-xl shadow-lg object-contain"
                        />
                      )}
                    </div>
                  )}
              
              {/* ABC Options */}
              {currentSlide.type === 'activity' && (currentSlide as any).activityType === 'abc' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 p-4 md:p-6 max-w-4xl mx-auto w-full">
                    {(currentSlide as ABCActivitySlide).options.map((option) => {
                      const isSelected = selectedOption === option.id;
                      const showResult = hasAnswered && shareData.settings.showActivityResults;
                      const isCorrect = showResult && option.isCorrect;
                      const wasSelected = currentResponse?.answer === option.id;
                      const isWrong = showResult && wasSelected && !option.isCorrect;
                      
                      return (
                        <button
                          key={option.id}
                          onClick={() => !hasAnswered && setSelectedOption(option.id)}
                          disabled={hasAnswered}
                          className={`
                            relative p-3 lg:p-4 rounded-2xl text-left transition-all border-2 flex items-center gap-3 lg:gap-4
                            ${isCorrect ? 'bg-green-50 border-green-500' : ''}
                            ${isWrong ? 'bg-red-50 border-red-500' : ''}
                            ${!hasAnswered && isSelected ? 'border-indigo-500 bg-indigo-50' : ''}
                            ${!hasAnswered && !isSelected ? 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md' : ''}
                            ${showResult && !isCorrect && !isWrong ? 'bg-white border-slate-100 opacity-50' : ''}
                          `}
                        >
                          <span 
                            className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center font-bold text-base lg:text-lg flex-shrink-0 transition-colors"
                            style={{
                              backgroundColor: isCorrect ? '#bbf7d0' 
                                : isWrong ? '#fecaca'
                                : !hasAnswered && isSelected ? '#c7d2fe' 
                                : '#E2E8F0',
                              color: isCorrect ? '#166534' 
                                : isWrong ? '#991b1b'
                                : !hasAnswered && isSelected ? '#3730a3' 
                                : '#475569',
                            }}
                          >
                            {option.label || option.id?.toUpperCase() || '?'}
                          </span>
                          <span className="text-base sm:text-lg lg:text-xl font-medium text-[#4E5871] flex-1 break-words overflow-hidden">
                            <MathText>{option.content || ''}</MathText>
                          </span>
                          
                          {isCorrect && <CheckCircle className="w-6 h-6 text-green-600" />}
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Show explanation/hint for ABC after answer */}
                  {shareData.settings.showSolutionHints && hasAnswered && (currentSlide as ABCActivitySlide).explanation && (
                    <div className="mt-4 mx-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                        <HelpCircle className="w-5 h-5" />
                        <span>Vysvětlení:</span>
                      </div>
                      <p className="text-slate-700">
                        <MathText>{(currentSlide as ABCActivitySlide).explanation || ''}</MathText>
                      </p>
                    </div>
                  )}
                </>
              )}
              
              {/* Open question */}
              {currentSlide.type === 'activity' && (currentSlide as any).activityType === 'open' && (
                <div className="w-full max-w-2xl mx-auto px-6">
                  <textarea
                    value={hasAnswered ? (currentResponse?.answer as string) : textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    disabled={hasAnswered}
                    placeholder="Napište svou odpověď..."
                    className={`
                      w-full h-36 p-5 rounded-2xl border-2 text-lg resize-none shadow-sm
                      ${hasAnswered && shareData.settings.showActivityResults
                        ? currentResponse?.isCorrect 
                          ? 'bg-green-50 border-green-500' 
                          : 'bg-red-50 border-red-500'
                        : 'border-slate-200 focus:border-indigo-400 focus:ring-0'
                      }
                    `}
                  />
                  
                  {/* Math preview */}
                  {textAnswer.includes('$') && !hasAnswered && (
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
                  {!hasAnswered && (
                    <button
                      onClick={() => setShowMathKeyboard(true)}
                      className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors text-sm font-medium mx-auto"
                    >
                      <Calculator className="w-4 h-4" />
                      Vložit matematiku
                    </button>
                  )}
                  
                  {hasAnswered && shareData.settings.showActivityResults && (
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
                  
                  {/* Show explanation/hint for open question after answer */}
                  {shareData.settings.showSolutionHints && hasAnswered && (currentSlide as OpenActivitySlide).explanation && (
                    <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                        <HelpCircle className="w-5 h-5" />
                        <span>Vysvětlení:</span>
                      </div>
                      <p className="text-slate-700">
                        <MathText>{(currentSlide as OpenActivitySlide).explanation || ''}</MathText>
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Legacy info slide (without block layout) */}
              {currentSlide.type === 'info' && (!(currentSlide as InfoSlide).layout || (currentSlide as InfoSlide).layout!.blocks.length === 0) && (
                <div className="flex-1 flex items-center justify-center p-8">
                  {(currentSlide as any).content && (
                    <div 
                      className="prose prose-lg max-w-3xl text-center text-slate-600"
                      dangerouslySetInnerHTML={{ __html: (currentSlide as any).content }}
                    />
                  )}
                </div>
              )}
              
              {/* Submit button - only for activity slides */}
              {currentSlide.type === 'activity' && (
              <div className="flex justify-center py-6 md:py-10">
                {!hasAnswered ? (
                  <button
                    ref={answerButtonRef}
                    onClick={submitAnswer}
                    disabled={
                      ((currentSlide as any).activityType === 'abc' && !selectedOption) ||
                      ((currentSlide as any).activityType === 'open' && !textAnswer.trim())
                    }
                    className={`flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all ${showWiggle ? 'animate-wiggle' : ''}`}
                    style={{ 
                      backgroundColor: '#4F46E5', 
                      boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.25)',
                    }}
                  >
                    <Send className="w-5 h-5" />
                    Odpovědět
                  </button>
                ) : currentSlideIndex < quiz.slides.length - 1 ? (
                  <button
                    onClick={goToNextSlide}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    Další otázka
                    <ArrowRight className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={goToNextSlide}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Dokončit kvíz
                  </button>
                )}
              </div>
              )}
              </>
              )}
            </div>
          </div>
          
          {/* Desktop: Right arrow */}
          <div className="hidden lg:flex w-16 flex-shrink-0 items-center justify-center">
            <button
              onClick={() => canProceed() ? goToNextSlide() : triggerWiggle()}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-out ${!canProceed() ? 'bg-slate-300 text-slate-400' : 'text-white hover:h-24'}`}
              style={{ backgroundColor: canProceed() ? '#7C3AED' : undefined }}
            >
              <ArrowRight className="w-5 h-5" />
            </button>
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

export default QuizStudentView;
