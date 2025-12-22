/**
 * Quiz Live Session
 * 
 * Manages live quiz sessions via Firebase
 * - Teacher starts session, gets code
 * - Students join with code
 * - Real-time sync of answers
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, set, onValue, off, update } from 'firebase/database';
import { database } from '../../utils/firebase-config';
import {
  Play,
  Users,
  Copy,
  CheckCircle,
  XCircle,
  Pause,
  StopCircle,
  BarChart2,
  RefreshCw,
  QrCode,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { syncResultsToSupabase } from '../../utils/supabase/classes';
import {
  Quiz,
  QuizSlide,
  ABCActivitySlide,
  SlideResponse,
  LiveQuizSession,
} from '../../types/quiz';

// ============================================
// FIREBASE PATHS
// ============================================

const QUIZ_SESSIONS_PATH = 'quiz_sessions';

function getSessionPath(sessionId: string) {
  return `${QUIZ_SESSIONS_PATH}/${sessionId}`;
}

// ============================================
// GENERATE SESSION CODE
// ============================================

function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================
// TEACHER SESSION MANAGER
// ============================================

interface TeacherSessionProps {
  quiz: Quiz;
  teacherId: string;
  teacherName: string;
  onClose: () => void;
}

export function TeacherSession({ quiz, teacherId, teacherName, onClose }: TeacherSessionProps) {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [session, setSession] = useState<LiveQuizSession | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  
  // Start session
  const startSession = useCallback(async () => {
    if (isStarting) return;
    setIsStarting(true);
    
    const code = generateSessionCode();
    const newSessionId = `quiz_${code}_${Date.now()}`;
    
    console.log('Starting session with code:', code);
    
    const sessionData: LiveQuizSession = {
      id: newSessionId,
      quizId: quiz.id,
      teacherId,
      teacherName,
      isActive: true,
      currentSlideIndex: 0,
      isPaused: false,
      showResults: false,
      isLocked: true, // Students follow teacher by default
      students: {},
      createdAt: new Date().toISOString(),
    };
    
    try {
      // Save session data
      await set(ref(database, getSessionPath(newSessionId)), sessionData);
      
      // Also save the quiz data so students can load it
      await set(ref(database, `${QUIZ_SESSIONS_PATH}/${newSessionId}/quizData`), {
        id: quiz.id,
        title: quiz.title,
        slides: quiz.slides,
      });
      console.log('Session started successfully:', newSessionId);
      setSessionId(newSessionId);
      setSessionCode(code);
      setSession(sessionData);
    } catch (error) {
      console.error('Failed to start session:', error);
      setIsStarting(false);
    }
  }, [quiz.id, teacherId, teacherName, isStarting]);
  
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
  
  // Update session state
  const updateSession = useCallback(async (updates: Partial<LiveQuizSession>) => {
    if (!sessionId) return;
    try {
      await update(ref(database, getSessionPath(sessionId)), updates);
    } catch (error) {
      console.error('Failed to update session:', error);
    }
  }, [sessionId]);
  
  // Navigation
  const goToSlide = (index: number) => {
    if (index < 0 || index >= quiz.slides.length) return;
    setCurrentSlideIndex(index);
    updateSession({ currentSlideIndex: index });
  };
  
  // End session
  const endSession = async (viewResults: boolean = false) => {
    if (sessionId && session) {
      await updateSession({ 
        isActive: false, 
        endedAt: new Date().toISOString() 
      });
      
      // Sync results to Supabase
      if (session.students) {
        const studentResults = Object.entries(session.students).map(([_, student]) => {
          const responses = student.responses || {};
          const slideResults = Object.entries(responses).map(([slideId, response]) => ({
            slideId,
            score: response.isCorrect ? 1 : 0,
            maxScore: 1,
            isCorrect: response.isCorrect || false,
          }));
          
          const totalScore = slideResults.filter(r => r.isCorrect).length;
          const maxPossibleScore = quiz.slides.filter(s => s.type === 'activity').length;
          
          return {
            studentName: student.name,
            responses: slideResults,
            totalScore,
            maxPossibleScore,
            timeSpentMs: student.totalTimeMs,
            completedAt: new Date().toISOString(),
          };
        });
        
        // Sync to Supabase (will be skipped if not using Supabase)
        await syncResultsToSupabase(
          sessionId,
          quiz.id,
          quiz.title,
          undefined, // TODO: Get class ID from quiz settings
          studentResults
        );
      }
      
      if (viewResults) {
        navigate(`/quiz/results/${sessionId}`);
        return;
      }
    }
    onClose();
  };
  
  // Copy code
  const copyCode = () => {
    if (sessionCode) {
      navigator.clipboard.writeText(sessionCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  // Get student stats
  const students = session?.students ? Object.entries(session.students) : [];
  const onlineStudents = students.filter(([_, s]) => s.isOnline);
  
  // Get current slide
  const currentSlide = quiz.slides[currentSlideIndex];
  
  // Get current slide responses
  const slideResponses = currentSlide ? students
    .map(([id, student]) => ({
      studentId: id,
      studentName: student.name,
      response: student.responses?.find((r: SlideResponse) => r.slideId === currentSlide.id),
    }))
    .filter(s => s.response) : [];
  
  // ========================================
  // START SCREEN
  // ========================================
  if (!sessionId || !sessionCode) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: '#4f46e5' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-700" />
        
        <div className="relative bg-white rounded-3xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-100 text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-6">
            <Play className="w-8 h-8 text-indigo-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            {quiz.title || 'Nový kvíz'}
          </h2>
          <p className="text-slate-500 mb-6">
            {quiz.slides.length} {quiz.slides.length === 1 ? 'slide' : 'slidů'}
          </p>
          
          {quiz.slides.length === 0 ? (
            <div className="text-amber-600 bg-amber-50 p-4 rounded-xl mb-4">
              <p className="font-medium">Kvíz je prázdný</p>
              <p className="text-sm mt-1">Přidejte alespoň jeden slide před spuštěním.</p>
            </div>
          ) : null}
          
          <button
            onClick={startSession}
            disabled={isStarting || quiz.slides.length === 0}
            className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg transition-colors flex items-center justify-center gap-2"
          >
            {isStarting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Spouštím...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Spustit session
              </>
            )}
          </button>
          
          <button
            onClick={onClose}
            className="mt-4 text-slate-400 hover:text-slate-600 text-sm"
          >
            Zrušit
          </button>
        </div>
      </div>
    );
  }
  
  // ========================================
  // LIVE SESSION SCREEN
  // ========================================
  return (
    <div className="fixed inset-0 z-50 flex" style={{ backgroundColor: '#0f172a' }}>
      {/* Left sidebar - Session info */}
      <div className="w-80 flex flex-col" style={{ backgroundColor: '#1e293b' }}>
        {/* Session code */}
        <div className="p-6" style={{ borderBottom: '1px solid #334155' }}>
          <p className="text-sm mb-3" style={{ color: '#94a3b8' }}>Kód pro připojení</p>
          
          {/* Code display - large and prominent */}
          <div 
            className="text-center py-4 px-6 rounded-xl mb-3"
            style={{ backgroundColor: '#334155' }}
            role="status"
            aria-label={`Kód session: ${sessionCode || '------'}`}
          >
            <div 
              className="text-4xl font-mono font-bold tracking-widest select-all"
              style={{ color: '#ffffff', letterSpacing: '0.2em' }}
            >
              {sessionCode || '------'}
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={copyCode}
              className="flex-1 py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              style={{ backgroundColor: '#334155', color: '#ffffff' }}
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4" style={{ color: '#4ade80' }} />
                  <span className="text-sm">Zkopírováno!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" style={{ color: '#94a3b8' }} />
                  <span className="text-sm">Kopírovat</span>
                </>
              )}
            </button>
            <button
              className="p-2 rounded-lg transition-colors"
              style={{ backgroundColor: '#334155' }}
              title="QR kód"
            >
              <QrCode className="w-5 h-5" style={{ color: '#94a3b8' }} />
            </button>
          </div>
          
          <p className="text-xs mt-3 text-center" style={{ color: '#64748b' }}>
            Studenti: <span style={{ color: '#94a3b8' }}>{window.location.origin}{import.meta.env.BASE_URL || '/'}quiz/join</span>
          </p>
        </div>
        
        {/* Students */}
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
              {students.map(([id, student]) => (
                <div
                  key={id}
                  className="flex items-center gap-3 p-2 rounded-lg"
                  style={{ backgroundColor: 'rgba(51, 65, 85, 0.5)' }}
                >
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: student.isOnline ? '#4ade80' : '#64748b' }}
                  />
                  <span className="text-sm flex-1" style={{ color: '#ffffff' }}>{student.name}</span>
                  <span className="text-xs" style={{ color: '#94a3b8' }}>
                    {student.responses?.length || 0}/{quiz.slides.filter(s => s.type === 'activity').length}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Controls */}
        <div className="p-4 space-y-2" style={{ borderTop: '1px solid #334155' }}>
          <button
            onClick={() => setShowResults(!showResults)}
            className="w-full py-2 rounded-lg text-white text-sm flex items-center justify-center gap-2"
            style={{ backgroundColor: '#334155' }}
          >
            <BarChart2 className="w-4 h-4" />
            {showResults ? 'Skrýt výsledky' : 'Zobrazit výsledky'}
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
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
              <h3 className="text-lg font-bold text-slate-800 mb-2">Ukončit session?</h3>
              <p className="text-slate-500 text-sm mb-6">
                Session bude ukončena a studenti budou odpojeni.
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => endSession(true)}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center justify-center gap-2"
                >
                  <BarChart2 className="w-4 h-4" />
                  Ukončit a zobrazit výsledky
                </button>
                <button
                  onClick={() => endSession(false)}
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
      
      {/* Main area - Current slide */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div 
          className="h-16 flex items-center justify-between px-6"
          style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155' }}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => goToSlide(currentSlideIndex - 1)}
              disabled={currentSlideIndex === 0}
              className="px-4 py-2 rounded-lg text-white text-sm disabled:opacity-30"
              style={{ backgroundColor: '#334155' }}
            >
              <ChevronLeft className="w-4 h-4 inline mr-1" />
              Předchozí
            </button>
            <span style={{ color: '#ffffff' }}>
              Slide {currentSlideIndex + 1} / {quiz.slides.length}
            </span>
            <button
              onClick={() => goToSlide(currentSlideIndex + 1)}
              disabled={currentSlideIndex === quiz.slides.length - 1}
              className="px-4 py-2 rounded-lg text-white text-sm disabled:opacity-30"
              style={{ backgroundColor: '#334155' }}
            >
              Další
              <ChevronRight className="w-4 h-4 inline ml-1" />
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsPaused(!isPaused);
                updateSession({ isPaused: !isPaused });
              }}
              className="px-4 py-2 rounded-lg text-white text-sm flex items-center gap-2"
              style={{ backgroundColor: isPaused ? '#d97706' : '#334155' }}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {isPaused ? 'Pokračovat' : 'Pozastavit'}
            </button>
          </div>
        </div>
        
        {/* Slide preview */}
        <div 
          className="flex-1 flex items-center justify-center p-8"
          style={{ background: 'linear-gradient(to bottom right, #1e293b, #0f172a)' }}
        >
          {quiz.slides.length === 0 ? (
            <div className="text-center" style={{ color: '#64748b' }}>
              <p className="text-xl">Žádné slidy</p>
              <p className="text-sm mt-2">Přidejte slidy do kvízu</p>
            </div>
          ) : currentSlide ? (
            <div className="w-full max-w-4xl">
              <div className="bg-white rounded-3xl shadow-2xl p-8">
                {/* Slide type badge */}
                <div className="flex justify-center mb-4">
                  <span 
                    className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{ 
                      backgroundColor: currentSlide.type === 'activity' ? '#dcfce7' : '#e0e7ff',
                      color: currentSlide.type === 'activity' ? '#166534' : '#3730a3'
                    }}
                  >
                    {currentSlide.type === 'activity' 
                      ? `Aktivita: ${(currentSlide as any).activityType?.toUpperCase() || 'OTÁZKA'}`
                      : 'Informace'
                    }
                  </span>
                </div>
                
                {/* Slide content */}
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-slate-800 mb-6">
                    {currentSlide.type === 'activity' 
                      ? ((currentSlide as any).question || (currentSlide as any).problem || (currentSlide as any).title || 'Otázka bez textu')
                      : ((currentSlide as any).title || 'Informace')
                    }
                  </h2>
                  
                  {/* ABC Options preview */}
                  {currentSlide.type === 'activity' && (currentSlide as any).activityType === 'abc' && (
                    <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                      {((currentSlide as ABCActivitySlide).options || []).map((opt) => {
                        const responseCount = slideResponses.filter(r => r.response?.answer === opt.id).length;
                        const percentage = students.length > 0 
                          ? Math.round((responseCount / Math.max(students.length, 1)) * 100) 
                          : 0;
                        
                        return (
                          <div
                            key={opt.id}
                            className="p-4 rounded-xl text-left transition-all"
                            style={{ 
                              backgroundColor: showResults && opt.isCorrect ? '#dcfce7' : '#f1f5f9',
                              border: showResults && opt.isCorrect ? '2px solid #22c55e' : '2px solid transparent'
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <span 
                                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                                style={{ 
                                  backgroundColor: showResults && opt.isCorrect ? '#22c55e' : '#cbd5e1',
                                  color: showResults && opt.isCorrect ? '#ffffff' : '#475569'
                                }}
                              >
                                {opt.label}
                              </span>
                              <span className="flex-1 text-slate-700">{opt.content || '...'}</span>
                            </div>
                            
                            {showResults && (
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full transition-all duration-500"
                                    style={{ 
                                      width: `${percentage}%`,
                                      backgroundColor: opt.isCorrect ? '#22c55e' : '#6366f1'
                                    }}
                                  />
                                </div>
                                <span className="text-sm font-medium" style={{ color: '#64748b' }}>
                                  {responseCount} ({percentage}%)
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Open question preview */}
                  {currentSlide.type === 'activity' && (currentSlide as any).activityType === 'open' && (
                    <div className="max-w-md mx-auto">
                      <div 
                        className="p-4 rounded-xl text-center"
                        style={{ backgroundColor: '#f1f5f9' }}
                      >
                        <p style={{ color: '#64748b' }}>Studenti odpovídají textově...</p>
                        {showResults && slideResponses.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {slideResponses.slice(0, 5).map((sr, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <span style={{ color: '#94a3b8' }}>{sr.studentName}:</span>
                                <span className="font-medium" style={{ color: sr.response?.isCorrect ? '#22c55e' : '#ef4444' }}>
                                  {sr.response?.answer as string}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Response counter */}
                <div className="mt-8 flex justify-center">
                  <div 
                    className="px-4 py-2 rounded-full flex items-center gap-2"
                    style={{ backgroundColor: '#f1f5f9' }}
                  >
                    <Users className="w-4 h-4" style={{ color: '#64748b' }} />
                    <span style={{ color: '#64748b' }}>
                      {slideResponses.length} / {students.length} odpovědí
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center" style={{ color: '#64748b' }}>
              <p>Slide nenalezen</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TeacherSession;
