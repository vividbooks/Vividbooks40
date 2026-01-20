/**
 * Quiz Self-Study Page
 * 
 * For students practicing boards individually (not in a live session)
 * Results are saved to their personal history and visible to teachers
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Send,
  HelpCircle,
  Home,
  User,
  Trophy,
} from 'lucide-react';
import { Quiz, QuizSlide, ABCActivitySlide, OpenActivitySlide, SlideResponse } from '../../types/quiz';
import { getQuiz } from '../../utils/quiz-storage';
import { MathText } from '../math/MathText';
import {
  getStudentIdentity,
  saveStudentIdentity,
  generateStudentId,
  startWorkSession,
  updateWorkSession,
  completeWorkSession,
} from '../../utils/student-work';
import { syncIndividualWorkToClass, isUsingSupabase } from '../../utils/supabase/classes';
import { checkMathAnswer } from '../../utils/math-compare';

export function QuizSelfStudyPage() {
  const { id: boardId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Quiz state
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Student identity
  const [showIdentityForm, setShowIdentityForm] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);
  
  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideStartTime, setSlideStartTime] = useState(Date.now());
  
  // Answer state
  const [responses, setResponses] = useState<{ [slideId: string]: SlideResponse }>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  
  // Completion state
  const [isCompleted, setIsCompleted] = useState(false);
  
  // Load quiz
  useEffect(() => {
    if (!boardId) {
      setError('Board ID chybí');
      setLoading(false);
      return;
    }
    
    const loadedQuiz = getQuiz(boardId);
    if (loadedQuiz) {
      setQuiz(loadedQuiz);
    } else {
      setError('Board nenalezen');
    }
    setLoading(false);
  }, [boardId]);
  
  // Check for existing student identity
  useEffect(() => {
    const identity = getStudentIdentity();
    if (identity) {
      setStudentName(identity.name);
      setStudentId(identity.id);
    } else {
      setShowIdentityForm(true);
    }
  }, []);
  
  // Start session when student is identified
  useEffect(() => {
    if (studentId && quiz && !sessionId) {
      const identity = getStudentIdentity();
      if (identity) {
        startWorkSession(
          quiz.id,
          quiz.title,
          'user', // TODO: Detect if from Vividbooks library
          quiz.createdBy,
          identity
        ).then((newSessionId) => {
          setSessionId(newSessionId);
          setSessionStartTime(Date.now());
          setSlideStartTime(Date.now());
        });
      }
    }
  }, [studentId, quiz, sessionId]);
  
  // Handle student identity submission
  const handleIdentitySubmit = () => {
    if (!studentName.trim()) return;
    
    const id = generateStudentId();
    const identity = {
      id,
      name: studentName.trim(),
    };
    
    saveStudentIdentity(identity);
    setStudentId(id);
    setShowIdentityForm(false);
  };
  
  // Get current slide
  const currentSlide = quiz?.slides[currentSlideIndex];
  const currentResponse = currentSlide ? responses[currentSlide.id] : undefined;
  
  // Calculate stats
  const correctCount = Object.values(responses).filter(r => r.isCorrect).length;
  const wrongCount = Object.values(responses).filter(r => r.isCorrect === false).length;
  const totalQuestions = quiz?.slides.filter(s => s.type === 'activity').length || 0;
  
  // Submit answer
  const submitAnswer = useCallback(async () => {
    if (!currentSlide || currentSlide.type !== 'activity' || !sessionId || !studentId) return;
    if (hasAnswered) return;
    
    const timeSpentSeconds = Math.round((Date.now() - slideStartTime) / 1000);
    let isCorrect = false;
    let answer: string = '';
    
    if (currentSlide.activityType === 'abc') {
      const abcSlide = currentSlide as ABCActivitySlide;
      const correctOption = abcSlide.options.find(o => o.isCorrect);
      isCorrect = selectedOption === correctOption?.id;
      answer = selectedOption || '';
    } else if (currentSlide.activityType === 'open') {
      const openSlide = currentSlide as OpenActivitySlide;
      // Use mathematical comparison for numeric answers
      isCorrect = checkMathAnswer(textAnswer, openSlide.correctAnswers);
      answer = textAnswer;
    }
    
    const response: SlideResponse = {
      slideId: currentSlide.id,
      activityType: currentSlide.activityType,
      answer,
      isCorrect,
      points: isCorrect ? 1 : 0,
      answeredAt: new Date().toISOString(),
      timeSpent: timeSpentSeconds,
    };
    
    const newResponses = { ...responses, [currentSlide.id]: response };
    setResponses(newResponses);
    setHasAnswered(true);
    
    // Save to Firebase
    const totalTimeMs = Date.now() - sessionStartTime;
    await updateWorkSession(
      studentId,
      sessionId,
      currentSlide.id,
      response,
      totalTimeMs,
      quiz?.createdBy,
      quiz?.id
    );
  }, [currentSlide, sessionId, studentId, selectedOption, textAnswer, hasAnswered, slideStartTime, responses, sessionStartTime, quiz]);
  
  // Go to next slide
  const goToNextSlide = useCallback(() => {
    if (!quiz) return;
    
    if (currentSlideIndex < quiz.slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
      setSelectedOption(null);
      setTextAnswer('');
      setHasAnswered(false);
      setSlideStartTime(Date.now());
    } else {
      // Complete the session
      handleComplete();
    }
  }, [quiz, currentSlideIndex]);
  
  // Go to previous slide
  const goToPrevSlide = useCallback(() => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
      // Restore previous answer if exists
      const prevSlide = quiz?.slides[currentSlideIndex - 1];
      if (prevSlide) {
        const prevResponse = responses[prevSlide.id];
        if (prevResponse) {
          setHasAnswered(true);
          if (prevSlide.type === 'activity') {
            if ((prevSlide as any).activityType === 'abc') {
              setSelectedOption(prevResponse.answer as string);
            } else {
              setTextAnswer(prevResponse.answer as string);
            }
          }
        } else {
          setHasAnswered(false);
          setSelectedOption(null);
          setTextAnswer('');
        }
      }
    }
  }, [currentSlideIndex, quiz, responses]);
  
  // Handle completion
  const handleComplete = async () => {
    if (!sessionId || !studentId || !quiz) return;
    
    const totalTimeMs = Date.now() - sessionStartTime;
    await completeWorkSession(
      studentId,
      sessionId,
      correctCount,
      totalQuestions,
      totalTimeMs,
      quiz.createdBy,
      quiz.id
    );
    
    // Sync to Supabase if enabled and quiz has a class assignment
    if (isUsingSupabase() && quiz.createdBy) {
      const identity = getStudentIdentity();
      if (identity) {
        await syncIndividualWorkToClass(
          'c1', // TODO: Get actual class ID from quiz or student
          quiz.id,
          quiz.title,
          [{
            studentName: identity.name,
            score: correctCount,
            maxScore: totalQuestions,
            timeSpentMs: totalTimeMs,
            completedAt: new Date().toISOString(),
          }]
        );
      }
    }
    
    setIsCompleted(true);
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }
  
  // Error state
  if (error || !quiz) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
        <HelpCircle className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-xl font-bold text-slate-600 mb-2">{error || 'Board nenalezen'}</h1>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Zpět domů
        </button>
      </div>
    );
  }
  
  // Identity form
  if (showIdentityForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <User className="w-16 h-16 mx-auto text-indigo-500 mb-4" />
            <h1 className="text-2xl font-bold text-slate-800">Vítej v procvičování!</h1>
            <p className="text-slate-500 mt-2">Zadej své jméno pro uložení výsledků</p>
          </div>
          
          <div className="space-y-4">
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Tvoje jméno"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-lg"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleIdentitySubmit()}
            />
            
            <button
              onClick={handleIdentitySubmit}
              disabled={!studentName.trim()}
              className="w-full py-4 rounded-xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Začít procvičovat
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Completion screen
  if (isCompleted) {
    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md text-center">
          <Trophy className="w-20 h-20 mx-auto text-yellow-500 mb-4" />
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Skvělá práce!</h1>
          <p className="text-slate-500 mb-6">{quiz.title}</p>
          
          <div className="bg-slate-50 rounded-2xl p-6 mb-6">
            <div className="text-5xl font-bold text-emerald-600 mb-2">{score}%</div>
            <p className="text-slate-500">
              {correctCount} z {totalQuestions} správně
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => {
                setCurrentSlideIndex(0);
                setResponses({});
                setIsCompleted(false);
                setSessionId(null);
                setHasAnswered(false);
                setSelectedOption(null);
                setTextAnswer('');
              }}
              className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
            >
              Zkusit znovu
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 py-3 rounded-xl bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" />
              Domů
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Main quiz view
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-slate-100"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        
        <div className="flex-1 text-center">
          <h1 className="font-semibold text-slate-800 truncate">{quiz.title}</h1>
          <p className="text-xs text-slate-500">
            {currentSlideIndex + 1} / {quiz.slides.length}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-emerald-600">
            <CheckCircle className="w-4 h-4" />
            <span className="font-bold text-sm">{correctCount}</span>
          </div>
          <div className="flex items-center gap-1 text-red-500">
            <XCircle className="w-4 h-4" />
            <span className="font-bold text-sm">{wrongCount}</span>
          </div>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="h-1 bg-slate-200">
        <div 
          className="h-full bg-indigo-500 transition-all duration-300"
          style={{ width: `${((currentSlideIndex + 1) / quiz.slides.length) * 100}%` }}
        />
      </div>
      
      {/* Content */}
      <div className="flex-1 flex flex-col p-4 md:p-8">
        {currentSlide && (
          <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
            {/* Question */}
            {currentSlide.type === 'activity' && (
              <>
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 text-center mb-6">
                  <MathText>{(currentSlide as any).question || ''}</MathText>
                </h2>
                
                {/* ABC Options */}
                {(currentSlide as any).activityType === 'abc' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(currentSlide as ABCActivitySlide).options.map((option) => {
                      const isSelected = selectedOption === option.id;
                      const isCorrectOption = option.isCorrect;
                      const wasSelected = currentResponse?.answer === option.id;
                      const showResult = hasAnswered;
                      
                      return (
                        <button
                          key={option.id}
                          onClick={() => !hasAnswered && setSelectedOption(option.id)}
                          disabled={hasAnswered}
                          className={`
                            p-4 rounded-xl text-left transition-all border-2 flex items-center gap-3
                            ${showResult && isCorrectOption ? 'bg-green-50 border-green-500' : ''}
                            ${showResult && wasSelected && !isCorrectOption ? 'bg-red-50 border-red-500' : ''}
                            ${!hasAnswered && isSelected ? 'border-indigo-500 bg-indigo-50' : ''}
                            ${!hasAnswered && !isSelected ? 'bg-white border-slate-200 hover:border-indigo-300' : ''}
                            ${showResult && !isCorrectOption && !wasSelected ? 'opacity-50' : ''}
                          `}
                        >
                          <span className={`
                            w-10 h-10 rounded-lg flex items-center justify-center font-bold
                            ${showResult && isCorrectOption ? 'bg-green-200 text-green-700' : ''}
                            ${showResult && wasSelected && !isCorrectOption ? 'bg-red-200 text-red-700' : ''}
                            ${!showResult && isSelected ? 'bg-indigo-200 text-indigo-700' : ''}
                            ${!showResult && !isSelected ? 'bg-slate-100 text-slate-600' : ''}
                          `}>
                            {option.label || option.id?.toUpperCase()}
                          </span>
                          <span className="flex-1 text-slate-700">
                            <MathText>{option.content || ''}</MathText>
                          </span>
                          {showResult && isCorrectOption && <CheckCircle className="w-6 h-6 text-green-600" />}
                        </button>
                      );
                    })}
                  </div>
                )}
                
                {/* Open question */}
                {(currentSlide as any).activityType === 'open' && (
                  <div className="space-y-4">
                    <textarea
                      value={hasAnswered ? (currentResponse?.answer as string) || '' : textAnswer}
                      onChange={(e) => setTextAnswer(e.target.value)}
                      disabled={hasAnswered}
                      placeholder="Napiš svou odpověď..."
                      className={`
                        w-full h-32 p-4 rounded-xl border-2 text-lg resize-none
                        ${hasAnswered && currentResponse?.isCorrect ? 'bg-green-50 border-green-500' : ''}
                        ${hasAnswered && !currentResponse?.isCorrect ? 'bg-red-50 border-red-500' : ''}
                        ${!hasAnswered ? 'border-slate-200 focus:border-indigo-500' : ''}
                      `}
                    />
                    
                    {hasAnswered && (
                      <div className="flex items-center justify-center gap-2">
                        {currentResponse?.isCorrect ? (
                          <>
                            <CheckCircle className="w-6 h-6 text-green-500" />
                            <span className="text-green-600 font-medium">Správně!</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-6 h-6 text-red-500" />
                            <span className="text-red-600">
                              Správně: {(currentSlide as OpenActivitySlide).correctAnswers?.[0]}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Explanation */}
                {hasAnswered && (currentSlide as any).explanation && (
                  <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                      <HelpCircle className="w-5 h-5" />
                      <span>Vysvětlení:</span>
                    </div>
                    <p className="text-slate-700">
                      <MathText>{(currentSlide as any).explanation}</MathText>
                    </p>
                  </div>
                )}
              </>
            )}
            
            {/* Info slide */}
            {currentSlide.type === 'info' && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-slate-600">
                  {(currentSlide as any).content && (
                    <div dangerouslySetInnerHTML={{ __html: (currentSlide as any).content }} />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Bottom actions */}
      <div className="bg-white shadow-lg px-4 py-4 flex items-center justify-center gap-4">
        <button
          onClick={goToPrevSlide}
          disabled={currentSlideIndex === 0}
          className="p-3 rounded-xl bg-slate-100 text-slate-600 disabled:opacity-30"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        
        {currentSlide?.type === 'activity' && !hasAnswered ? (
          <button
            onClick={submitAnswer}
            disabled={
              ((currentSlide as any).activityType === 'abc' && !selectedOption) ||
              ((currentSlide as any).activityType === 'open' && !textAnswer.trim())
            }
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
            Odpovědět
          </button>
        ) : (
          <button
            onClick={goToNextSlide}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-indigo-600 text-white font-semibold"
          >
            {currentSlideIndex === quiz.slides.length - 1 ? 'Dokončit' : 'Další'}
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
        
        <button
          onClick={goToNextSlide}
          disabled={currentSlideIndex === quiz.slides.length - 1}
          className="p-3 rounded-xl bg-slate-100 text-slate-600 disabled:opacity-30"
        >
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

